import { coreAL, coreGeom, type Core, type Material } from './cores'
import { wireRdc } from './air'

/** Thickness of the epoxy/paint coating on a catalogued core, mm per surface. */
export const COATING_MM = 0.25

export interface ToroidResult {
  AL: number
  published: boolean
  /** Inductance in henries. */
  L: number
  turns: number
  /** Turns that fit in one layer on the inside circumference. */
  maxSingleLayer: number
  /** Window fill by wire cross-section, 0–1. */
  fill: number
  wireLen: number
  Rdc: number
  /** Peak flux density at the given current, tesla. */
  Bpk: number
  /** Fraction of the typical saturation flux density. */
  bUsage: number
  /** Current at which B reaches the design limit (50 % of Bsat), amperes. */
  iMax: number
}

/** L = AL·N² with all the winding/fit/flux checks. wire = bare diameter, dIns over enamel (mm); current in A. */
export function toroid(core: Core, mat: Material, N: number, wire: number, dIns: number, current: number): ToroidResult {
  const { al, published } = coreAL(core, mat)
  const g = coreGeom(core)
  const L = al * 1e-9 * N * N
  const idC = g.id - 2 * COATING_MM
  const tC = (g.od - g.id) / 2 + 2 * COATING_MM
  const hC = g.h + 2 * COATING_MM
  const maxSingleLayer = Math.max(0, Math.floor((Math.PI * (idC - dIns)) / dIns))
  const fill = (N * dIns * dIns) / (idC * idC)
  const turnLen = 2 * (hC + tC) + 4 * (dIns / 2) // mm, perimeter of the winding around the core section
  const wireLen = (N * turnLen) / 1000
  const Rdc = wireRdc(wire / 1000, wireLen)
  const Bpk = N > 0 ? (L * current) / (N * g.Ae * 1e-6) : 0
  const iMax = N > 0 ? (0.5 * mat.bsat * N * g.Ae * 1e-6) / L : 0
  return { AL: al, published, L, turns: N, maxSingleLayer, fill, wireLen, Rdc, Bpk, bUsage: Bpk / mat.bsat, iMax }
}

/** Turns for a target inductance: N = sqrt(L / AL). */
export const turnsFor = (targetL: number, alNh: number): number => Math.sqrt(targetL / (alNh * 1e-9))
