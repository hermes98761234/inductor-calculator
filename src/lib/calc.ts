import { analyseAir, nagaokaL, solveTurns, wheelerL, type AirAnalysis } from './air'
import { enamelDiameter } from './awg'
import { CORES, coresFor, materialName, materialOf, type Core, type Material } from './cores'
import { multilayerGeom, multilayerInductance, type MultilayerGeom } from './multilayer'
import { analyseSpiral, innerDiameter, ozToThickness, spiralWheelerL, type Shape, type SpiralAnalysis } from './spiral'
import { toroid, turnsFor, type ToroidResult } from './toroid'

export type Mode = 'calc' | 'inverse'
export type Warning = string

// All lengths below are in millimetres, as stored in the app state.

export interface SolenoidIn {
  mode: Mode
  method: 'nagaoka' | 'wheeler'
  N: number
  /** Diameter of the former (inside of the winding). */
  formerD: number
  spacing: 'close' | 'pitch' | 'length'
  pitch: number
  length: number
  targetUH: number
  fMHz: number
}

export interface SolenoidResult {
  /** Integer turns used for the result. */
  N: number
  /** Exact (fractional) turns for the target in inverse mode. */
  exactN: number | null
  L: number
  Lnagaoka: number
  Lwheeler: number
  /** Mean coil diameter, winding length and pitch in metres. */
  D: number
  l: number
  pitch: number
  air: AirAnalysis
  warnings: Warning[]
  curve: [number, number][]
}

function solGeom(i: SolenoidIn, wire: number, N: number) {
  const dIns = enamelDiameter(wire)
  const D = (i.formerD + wire) / 1000
  let pitch: number
  let l: number
  if (i.spacing === 'length') {
    l = i.length / 1000
    pitch = l / N
  } else {
    pitch = (i.spacing === 'close' ? dIns : i.pitch) / 1000
    l = N * pitch
  }
  return { D, l, pitch }
}

export function runSolenoid(i: SolenoidIn, wire: number): SolenoidResult {
  const w = wire / 1000
  const Lof = (n: number, method = i.method): number => {
    const g = solGeom(i, wire, n)
    return method === 'nagaoka' ? nagaokaL(n, g.D, g.l, w) : wheelerL(n, g.D, g.l)
  }
  let N = Math.max(1, Math.round(i.N))
  let exactN: number | null = null
  const warnings: Warning[] = []
  if (i.mode === 'inverse') {
    exactN = solveTurns((n) => Lof(n), i.targetUH * 1e-6, 1, 1e4)
    if (exactN === null) warnings.push('noSolution')
    else N = Math.max(1, Math.round(exactN))
  }
  const g = solGeom(i, wire, N)
  if (g.pitch < w * 0.999) warnings.push('pitchTooSmall')
  if (g.l < 0.8 * (g.D / 2)) warnings.push('shortCoil')
  const L = Lof(N)
  const air = analyseAir(L, N, g.D, g.l, w, i.fMHz * 1e6)
  const top = Math.max(10, Math.ceil(N * 2))
  const curve: [number, number][] = []
  for (let k = 1; k <= 60; k++) {
    const n = (top * k) / 60
    if (n >= 1) curve.push([n, Lof(n)])
  }
  return { N, exactN, L, Lnagaoka: Lof(N, 'nagaoka'), Lwheeler: Lof(N, 'wheeler'), ...g, air, warnings, curve }
}

export interface MultilayerIn {
  mode: Mode
  N: number
  formerD: number
  length: number
  targetUH: number
}

export interface MultilayerResult {
  N: number
  exactN: number | null
  L: number
  geom: MultilayerGeom
  wireLen: number
  warnings: Warning[]
  curve: [number, number][]
}

export function runMultilayer(i: MultilayerIn, wire: number): MultilayerResult {
  const dIns = enamelDiameter(wire) / 1000
  const former = i.formerD / 1000
  const len = i.length / 1000
  const Lof = (n: number) => multilayerInductance(n, former, len, dIns)
  let N = Math.max(1, Math.round(i.N))
  let exactN: number | null = null
  const warnings: Warning[] = []
  if (i.mode === 'inverse') {
    exactN = solveTurns(Lof, i.targetUH * 1e-6, 1, 1e6)
    if (exactN === null) warnings.push('noSolution')
    else N = Math.max(1, Math.round(exactN))
  }
  const geom = multilayerGeom(N, former, len, dIns)
  if (geom.layers < 2) warnings.push('singleLayer')
  if (geom.build > 3 * len) warnings.push('thickWinding')
  let wireLen = 0
  let left = N
  for (let k = 0; k < geom.layers; k++) {
    const turns = Math.min(left, geom.turnsPerLayer)
    left -= turns
    wireLen += turns * Math.PI * (former + dIns + 2 * k * dIns)
  }
  const top = Math.max(10, Math.ceil(N * 2))
  const curve: [number, number][] = []
  for (let k = 1; k <= 60; k++) curve.push([(top * k) / 60, Lof((top * k) / 60)])
  return { N, exactN, L: Lof(N), geom, wireLen, warnings, curve }
}

export interface ToroidIn {
  mode: Mode
  core: string
  mix: string
  N: number
  targetUH: number
  current: number
}

export interface ToroidRow {
  core: Core
  AL: number
  published: boolean
  N: number
  fits: boolean
  Bpk: number
  bUsage: number
}

export interface ToroidOut {
  core: Core
  mat: Material
  name: string
  exactN: number | null
  r: ToroidResult
  rows: ToroidRow[]
  warnings: Warning[]
  curve: [number, number][]
}

export function coreById(id: string, mat: Material): Core {
  return CORES.find((c) => c.id === id && c.kind === mat.kind) ?? coresFor(mat)[0]
}

export function runToroid(i: ToroidIn, wire: number): ToroidOut {
  const mat = materialOf(i.mix)
  const core = coreById(i.core, mat)
  const dIns = enamelDiameter(wire)
  const unit = toroid(core, mat, 1, wire, dIns, i.current)
  let N = Math.max(1, Math.round(i.N))
  let exactN: number | null = null
  const warnings: Warning[] = []
  if (i.mode === 'inverse') {
    exactN = turnsFor(i.targetUH * 1e-6, unit.AL)
    N = Math.max(1, Math.round(exactN))
  }
  const r = toroid(core, mat, N, wire, dIns, i.current)
  if (N > r.maxSingleLayer) warnings.push(r.fill > 0.4 ? 'windowFull' : 'multiLayer')
  if (r.bUsage > 0.5) warnings.push(r.bUsage > 1 ? 'saturated' : 'highFlux')
  const rows: ToroidRow[] = []
  if (i.mode === 'inverse') {
    for (const c of coresFor(mat)) {
      const u = toroid(c, mat, 1, wire, dIns, i.current)
      const n = Math.max(1, Math.round(turnsFor(i.targetUH * 1e-6, u.AL)))
      const t = toroid(c, mat, n, wire, dIns, i.current)
      rows.push({ core: c, AL: u.AL, published: u.published, N: n, fits: n <= t.maxSingleLayer, Bpk: t.Bpk, bUsage: t.bUsage })
    }
  }
  const curve: [number, number][] = []
  const top = Math.max(10, Math.ceil(N * 2))
  for (let k = 0; k <= 60; k++) curve.push([(top * k) / 60, unit.AL * 1e-9 * ((top * k) / 60) ** 2])
  return { core, mat, name: core.id + materialName(mat).replace(/^(\d)/, '-$1'), exactN, r, rows, warnings, curve }
}

export interface PcbIn {
  mode: Mode
  shape: Shape
  n: number
  dout: number
  w: number
  s: number
  oz: number
  targetNH: number
  fMHz: number
}

export interface PcbResult {
  n: number
  a: SpiralAnalysis
  warnings: Warning[]
  curve: [number, number][]
}

export function runPcb(i: PcbIn): PcbResult {
  const dout = i.dout / 1000
  const w = i.w / 1000
  const s = i.s / 1000
  const make = (n: number) => ({ shape: i.shape, n, dout, din: innerDiameter(dout, w, s, n) })
  const maxN = Math.max(1, Math.floor((dout / 2 + s) / (w + s)))
  let n = Math.max(1, Math.round(i.n))
  const warnings: Warning[] = []
  if (i.mode === 'inverse') {
    let best = 0
    let bestErr = Infinity
    for (let k = 1; k <= maxN; k++) {
      const sp = make(k)
      if (sp.din <= 0) break
      const err = Math.abs(Math.log(spiralWheelerL(sp) / (i.targetNH * 1e-9)))
      if (err < bestErr) {
        bestErr = err
        best = k
      }
    }
    if (best === 0) warnings.push('noSolution')
    else n = best
    if (best === maxN || (best > 0 && make(best + 1).din <= 0)) {
      const sp = make(best || 1)
      if (spiralWheelerL(sp) < i.targetNH * 1e-9 * 0.95) warnings.push('targetTooBig')
    }
  }
  const sp = make(n)
  if (sp.din <= 0) warnings.push('noRoom')
  const a = analyseSpiral(sp, w, ozToThickness(i.oz), i.fMHz * 1e6)
  if (sp.din > 0 && a.rho > 0.9) warnings.push('denseCenter')
  const curve: [number, number][] = []
  for (let k = 1; k <= maxN; k++) {
    const q = make(k)
    if (q.din <= 0) break
    curve.push([k, spiralWheelerL(q)])
  }
  return { n, a, warnings, curve }
}
