import { MU0, RHO_CU, skinDepth } from './units'

/** Complete elliptic integrals K(k) and E(k) (modulus k, 0 <= k < 1) by the arithmetic-geometric mean. */
export function ellipKE(k: number): { K: number; E: number } {
  let a = 1
  let b = Math.sqrt(1 - k * k)
  let c = k
  let sum = 0.5 * c * c
  let pow = 0.5
  for (let i = 0; i < 40 && Math.abs(c) > 1e-17; i++) {
    const an = (a + b) / 2
    c = (a - b) / 2
    b = Math.sqrt(a * b)
    a = an
    pow *= 2
    sum += pow * c * c
  }
  const K = Math.PI / (2 * a)
  return { K, E: K * (1 - sum) }
}

/**
 * Nagaoka coefficient K of a single-layer coil of mean diameter D and winding length l:
 * L = µ0·π·r²·N²·K / l for an infinitely thin current sheet.
 */
export function nagaokaK(D: number, l: number): number {
  const x = D / l
  if (x < 1e-3) return 1 / (1 + (4 / (3 * Math.PI)) * x)
  const h = Math.hypot(D, l)
  const k = D / h
  const kp = l / h // sqrt(1 - k²)
  const { K, E } = ellipKE(k)
  const k2 = k * k
  const bracket = ((kp * kp) / k2) * K + ((2 * k2 - 1) / k2) * E - k
  return (4 / (3 * Math.PI * kp)) * bracket
}

/** Inductance of the ideal current sheet (Nagaoka), henries. D mean diameter, l winding length, metres. */
export function sheetL(N: number, D: number, l: number): number {
  const r = D / 2
  return (MU0 * Math.PI * r * r * N * N * nagaokaK(D, l)) / l
}

function F(u: number): number {
  const a = Math.abs(u)
  return a === 0 ? 0 : (u * u * (Math.log(a) - 1.5)) / 2
}
/** ln(GMD) of two equal strips of unit width whose centres are k widths apart, minus ln(k). */
function gmdDefect(k: number): number {
  if (k >= 8) return 1 / (12 * k ** 2) + 1 / (60 * k ** 4) + 1 / (168 * k ** 6)
  return Math.log(k) - (F(k + 1) + F(k - 1) - 2 * F(k))
}

/**
 * Round-wire correction (Rosa / Grover / Lundin): A + B where A accounts for the self inductance of a
 * round wire versus a flat strip of width p, and B for the mutual inductance between separate turns.
 * L = L_sheet − µ0·a·N·(A + B), a = mean radius. d = wire diameter, p = pitch.
 */
export function wireCorrection(N: number, d: number, p: number): number {
  const A = 1.25 - Math.log((2 * p) / d)
  const B = (n: number): number => {
    let s = 0
    for (let k = 1; k < n; k++) s += (n - k) * gmdDefect(k)
    return n > 0 ? (2 * s) / n : 0
  }
  // Interpolate between integer turn counts so the function stays smooth for the turns solver.
  const n0 = Math.max(1, Math.floor(N))
  const t = Math.min(1, Math.max(0, N - n0))
  return A + (1 - t) * B(n0) + t * B(n0 + 1)
}

/** Single-layer coil by Nagaoka's sheet formula with the round-wire (Lundin/Rosa) correction. */
export function nagaokaL(N: number, D: number, l: number, wire: number): number {
  const p = l / N
  return sheetL(N, D, l) - MU0 * (D / 2) * N * wireCorrection(N, wire, p)
}

/** Wheeler's formula (1928), inches in, µH out: L = N²r² / (9r + 10l), accurate to ~1 % for l > 0.8 r. */
export function wheelerUH(N: number, rIn: number, lIn: number): number {
  return (N * N * rIn * rIn) / (9 * rIn + 10 * lIn)
}

/** Wheeler single-layer formula, SI in and out (D mean diameter, l length in metres → henries). */
export function wheelerL(N: number, D: number, l: number): number {
  return wheelerUH(N, D / 2 / 0.0254, l / 0.0254) * 1e-6
}

/** Wheeler multilayer formula: L = 0.8·a²N² / (6a + 9b + 10c) µH, inches. a mean radius, b length, c build. */
export function wheelerMultiUH(N: number, aIn: number, bIn: number, cIn: number): number {
  return (0.8 * aIn * aIn * N * N) / (6 * aIn + 9 * bIn + 10 * cIn)
}

/** SI wrapper for the multilayer formula: a mean radius, b winding length, c build (radial depth), metres. */
export function multilayerL(N: number, a: number, b: number, c: number): number {
  return wheelerMultiUH(N, a / 0.0254, b / 0.0254, c / 0.0254) * 1e-6
}

/** Medhurst's self-capacitance factor H(l/D): C(pF) = H · D(cm). */
const MEDHURST: [number, number][] = [
  [0.1, 0.96], [0.2, 0.82], [0.3, 0.77], [0.4, 0.74], [0.5, 0.72], [0.6, 0.7], [0.8, 0.67], [1, 0.64],
  [1.5, 0.62], [2, 0.61], [3, 0.6], [4, 0.6], [6, 0.61], [8, 0.62], [10, 0.64],
]
export function medhurstH(lOverD: number): number {
  const t = MEDHURST
  if (lOverD <= t[0][0]) return t[0][1]
  if (lOverD >= t[t.length - 1][0]) return t[t.length - 1][1]
  for (let i = 1; i < t.length; i++) {
    if (lOverD <= t[i][0]) {
      const [x0, y0] = t[i - 1]
      const [x1, y1] = t[i]
      return y0 + ((y1 - y0) * (Math.log(lOverD) - Math.log(x0))) / (Math.log(x1) - Math.log(x0))
    }
  }
  return t[t.length - 1][1]
}

/** Self-capacitance of a single-layer coil (Medhurst), farads. D mean diameter and l length in metres. */
export function selfCapacitance(D: number, l: number): number {
  return medhurstH(l / D) * D * 100 * 1e-12
}

export const srf = (L: number, C: number): number => 1 / (2 * Math.PI * Math.sqrt(L * C))

/** AC/DC resistance ratio of a round wire from skin effect (no proximity effect). */
export function acRatioRound(d: number, f: number): number {
  const x = d / (4 * skinDepth(f))
  return Math.sqrt(1 + x * x)
}

/** DC resistance of a copper wire of diameter d and length len (metres), at 20 °C. */
export const wireRdc = (d: number, len: number): number => (RHO_CU * len) / (Math.PI * (d / 2) ** 2)

export interface AirAnalysis {
  L: number
  wireLen: number
  Rdc: number
  Rac: number
  Q: number
  C: number
  srf: number
}

/** Loss, Q and self-resonance of a single-layer coil at frequency f (Hz) given its inductance L. */
export function analyseAir(L: number, N: number, D: number, l: number, wire: number, f: number): AirAnalysis {
  const wireLen = N * Math.PI * D
  const Rdc = wireRdc(wire, wireLen)
  const Rac = Rdc * acRatioRound(wire, f)
  const C = selfCapacitance(D, l)
  const fr = srf(L, C)
  // Q from series resistance; the (1 - (f/SRF)²) factor models the rolloff towards self-resonance.
  const Q = ((2 * Math.PI * f * L) / Rac) * Math.max(0, 1 - (f / fr) ** 2)
  return { L, wireLen, Rdc, Rac, Q, C, srf: fr }
}

/**
 * Real-valued turns N (>0) with f(N) = target, f increasing, found by bisection over [lo, hi].
 * Returns null when the target is outside the bracket.
 */
export function solveTurns(f: (n: number) => number, target: number, lo = 0.25, hi = 1e5): number | null {
  if (!(target > 0) || !(f(lo) <= target) || !(f(hi) >= target)) return null
  for (let i = 0; i < 200; i++) {
    const mid = Math.sqrt(lo * hi)
    if (f(mid) < target) lo = mid
    else hi = mid
    if (hi / lo < 1 + 1e-13) break
  }
  return Math.sqrt(lo * hi)
}
