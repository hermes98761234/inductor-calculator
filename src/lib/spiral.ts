import { MU0, RHO_CU, skinDepth } from './units'

export type Shape = 'square' | 'hexagon' | 'octagon' | 'circle'
export const SHAPES: Shape[] = ['square', 'hexagon', 'octagon', 'circle']

/** Coefficients of the modified Wheeler expression, Mohan et al. 1999 (Table I). */
const WHEELER: Record<Shape, [number, number]> = {
  square: [2.34, 2.75],
  hexagon: [2.33, 3.82],
  octagon: [2.25, 3.55],
  circle: [2.25, 3.55], // not tabulated by Mohan: octagon values approximate a circle
}
/** Coefficients of the current-sheet expression, Mohan et al. 1999 (Table I). */
const SHEET: Record<Shape, [number, number, number, number]> = {
  square: [1.27, 2.07, 0.18, 0.13],
  hexagon: [1.09, 2.23, 0, 0.17],
  octagon: [1.07, 2.29, 0, 0.19],
  circle: [1.0, 2.46, 0, 0.2],
}

export interface Spiral {
  shape: Shape
  n: number
  /** Outer and inner diameters, metres. */
  dout: number
  din: number
}

/** Inner diameter from outer diameter, trace width w, spacing s and turns n. */
export const innerDiameter = (dout: number, w: number, s: number, n: number): number => dout - 2 * n * w - 2 * (n - 1) * s

const davgRho = (sp: Spiral) => ({ davg: (sp.dout + sp.din) / 2, rho: (sp.dout - sp.din) / (sp.dout + sp.din) })

/** Modified Wheeler: L = K1·µ0·n²·davg / (1 + K2·ρ). */
export function spiralWheelerL(sp: Spiral): number {
  const { davg, rho } = davgRho(sp)
  const [k1, k2] = WHEELER[sp.shape]
  return (k1 * MU0 * sp.n * sp.n * davg) / (1 + k2 * rho)
}

/** Current-sheet approximation: L = µ0·n²·davg·c1/2·[ln(c2/ρ) + c3·ρ + c4·ρ²]. */
export function spiralSheetL(sp: Spiral): number {
  const { davg, rho } = davgRho(sp)
  const [c1, c2, c3, c4] = SHEET[sp.shape]
  return ((MU0 * sp.n * sp.n * davg * c1) / 2) * (Math.log(c2 / rho) + c3 * rho + c4 * rho * rho)
}

/** Approximate trace length: each turn is a regular polygon (or circle) of the average diameter. */
export function spiralLength(sp: Spiral): number {
  const { davg } = davgRho(sp)
  const k = { square: 4, hexagon: 6 * Math.tan(Math.PI / 6), octagon: 8 * Math.tan(Math.PI / 8), circle: Math.PI }[sp.shape]
  return k * davg * sp.n
}

/** Copper thickness from weight in oz/ft². */
export const ozToThickness = (oz: number): number => oz * 34.79e-6

export interface SpiralAnalysis {
  L: number
  Lsheet: number
  length: number
  Rdc: number
  Rac: number
  Q: number
  din: number
  rho: number
}

export function analyseSpiral(sp: Spiral, w: number, t: number, f: number): SpiralAnalysis {
  const length = spiralLength(sp)
  const Rdc = (RHO_CU * length) / (w * t)
  const x = t / skinDepth(f)
  const Rac = Rdc * (x < 1e-6 ? 1 : x / (1 - Math.exp(-x)))
  const L = spiralWheelerL(sp)
  return {
    L,
    Lsheet: spiralSheetL(sp),
    length,
    Rdc,
    Rac,
    Q: (2 * Math.PI * f * L) / Rac,
    din: sp.din,
    rho: davgRho(sp).rho,
  }
}
