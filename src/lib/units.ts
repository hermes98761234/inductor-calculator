export type LenUnit = 'mm' | 'cm' | 'in' | 'mil'

/** Millimetres per unit. */
export const MM_PER: Record<LenUnit, number> = { mm: 1, cm: 10, in: 25.4, mil: 0.0254 }
export const LEN_UNITS: LenUnit[] = ['mm', 'cm', 'in', 'mil']

export const mmToUnit = (mm: number, u: LenUnit): number => mm / MM_PER[u]
export const unitToMm = (v: number, u: LenUnit): number => v * MM_PER[u]

/** Round to `sig` significant digits and drop float noise. */
export const clean = (x: number, sig = 6): number => (Number.isFinite(x) ? Number(x.toPrecision(sig)) : x)

export const MU0 = 4e-7 * Math.PI
/** Resistivity of annealed copper at 20 °C, ohm·m. */
export const RHO_CU = 1.724e-8
/** Temperature coefficient of copper resistance, 1/K. */
export const ALPHA_CU = 0.00393

/** Skin depth in copper at frequency f (Hz), metres. */
export const skinDepth = (f: number, rho = RHO_CU): number => Math.sqrt(rho / (Math.PI * f * MU0))
