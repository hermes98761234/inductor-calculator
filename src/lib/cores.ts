import { MU0 } from './units'

export interface Material {
  id: string
  kind: 'iron' | 'ferrite'
  /** Initial relative permeability. */
  mu: number
  /** Typical saturation flux density, tesla. */
  bsat: number
  /** Suggested frequency range (powdered iron) or note key. */
  range: string
}

export const MATERIALS: Material[] = [
  { id: '1', kind: 'iron', mu: 20, bsat: 1.0, range: '0.5–5 MHz' },
  { id: '2', kind: 'iron', mu: 10, bsat: 1.0, range: '2–30 MHz' },
  { id: '3', kind: 'iron', mu: 35, bsat: 1.0, range: '0.05–0.5 MHz' },
  { id: '6', kind: 'iron', mu: 8, bsat: 1.0, range: '10–50 MHz' },
  { id: '10', kind: 'iron', mu: 6, bsat: 1.0, range: '30–100 MHz' },
  { id: '12', kind: 'iron', mu: 4, bsat: 1.0, range: '50–200 MHz' },
  { id: '17', kind: 'iron', mu: 4, bsat: 1.0, range: '40–180 MHz' },
  { id: '26', kind: 'iron', mu: 75, bsat: 1.4, range: '< 1 MHz' },
  { id: '52', kind: 'iron', mu: 75, bsat: 1.4, range: '< 1 MHz' },
  { id: '31', kind: 'ferrite', mu: 1500, bsat: 0.35, range: '1–300 MHz (suppression)' },
  { id: '43', kind: 'ferrite', mu: 850, bsat: 0.35, range: '1–50 MHz (broadband)' },
  { id: '52F', kind: 'ferrite', mu: 250, bsat: 0.3, range: '20–200 MHz' },
  { id: '61', kind: 'ferrite', mu: 125, bsat: 0.24, range: '0.2–10 MHz (HF transformers)' },
  { id: '73', kind: 'ferrite', mu: 2500, bsat: 0.25, range: '0.01–1 MHz' },
  { id: '77', kind: 'ferrite', mu: 2000, bsat: 0.49, range: '0.001–1 MHz' },
]

export const materialOf = (id: string): Material => MATERIALS.find((m) => m.id === id) ?? MATERIALS[1]
/** Display name of a material: "-2" for powdered iron mix 2, "43" for ferrite 43. */
export const materialName = (m: Material): string => (m.kind === 'iron' ? '-' + m.id : m.id.replace(/F$/, ''))

export interface Core {
  /** "T50" or "FT50". */
  id: string
  kind: 'iron' | 'ferrite'
  /** Outer diameter, inner diameter, height in inches as catalogued. */
  odIn: number
  idIn: number
  hIn: number
}

const T = (n: number, od: number, id: number, h: number): Core => ({ id: 'T' + n, kind: 'iron', odIn: od, idIn: id, hIn: h })
const FT = (n: number, od: number, id: number, h: number): Core => ({ id: 'FT' + n, kind: 'ferrite', odIn: od, idIn: id, hIn: h })

export const CORES: Core[] = [
  T(12, 0.125, 0.062, 0.05), T(16, 0.16, 0.078, 0.06), T(20, 0.2, 0.088, 0.07), T(25, 0.255, 0.12, 0.096),
  T(30, 0.307, 0.151, 0.128), T(37, 0.375, 0.205, 0.128), T(44, 0.44, 0.229, 0.159), T(50, 0.5, 0.303, 0.19),
  T(68, 0.69, 0.37, 0.19), T(80, 0.795, 0.495, 0.25), T(94, 0.942, 0.56, 0.312), T(106, 1.06, 0.57, 0.437),
  T(130, 1.3, 0.78, 0.437), T(157, 1.57, 0.95, 0.57), T(184, 1.84, 0.95, 0.71), T(200, 2.0, 1.25, 0.55),
  T(225, 2.25, 1.405, 0.55), T(300, 3.04, 1.93, 0.5), T(400, 4.0, 2.25, 0.65),
  FT(23, 0.23, 0.12, 0.06), FT(37, 0.375, 0.187, 0.125), FT(50, 0.5, 0.281, 0.188), FT(82, 0.825, 0.52, 0.25),
  FT(114, 1.142, 0.75, 0.295), FT(140, 1.4, 0.9, 0.5), FT(240, 2.4, 1.4, 0.5),
]

/** Published AL values (nH/turn²) from the Amidon/Micrometals and Fair-Rite catalogues, keyed "T50-2", "FT50-43". */
const PUBLISHED_AL: Record<string, number> = {
  'T12-2': 2.0, 'T16-2': 2.2, 'T20-2': 2.5, 'T25-2': 3.4, 'T30-2': 4.3, 'T37-2': 4.0, 'T44-2': 5.2, 'T50-2': 4.9,
  'T68-2': 5.7, 'T80-2': 5.5, 'T94-2': 8.4, 'T106-2': 13.5, 'T130-2': 11.0, 'T157-2': 14.0, 'T184-2': 24.0, 'T200-2': 12.0,
  'T12-6': 1.7, 'T16-6': 2.0, 'T20-6': 2.2, 'T25-6': 2.7, 'T30-6': 3.6, 'T37-6': 3.0, 'T44-6': 4.2, 'T50-6': 4.0,
  'T68-6': 4.7, 'T80-6': 4.5, 'T94-6': 7.0, 'T106-6': 11.6, 'T130-6': 9.6, 'T157-6': 11.5, 'T184-6': 18.0, 'T200-6': 10.0,
  'FT23-43': 188, 'FT37-43': 420, 'FT50-43': 523, 'FT82-43': 557, 'FT114-43': 603, 'FT140-43': 885, 'FT240-43': 1467,
  'FT23-61': 24.8, 'FT37-61': 55.3, 'FT50-61': 68, 'FT82-61': 73, 'FT114-61': 79.3, 'FT140-61': 140, 'FT240-61': 171,
}

export const coresFor = (m: Material): Core[] => CORES.filter((c) => c.kind === m.kind)

export interface CoreGeom {
  /** Outer diameter, inner diameter, height in mm (nominal, uncoated). */
  od: number
  id: number
  h: number
  /** Effective cross-section (mm²) and path length (mm). */
  Ae: number
  le: number
}

export function coreGeom(c: Core): CoreGeom {
  const od = c.odIn * 25.4
  const id = c.idIn * 25.4
  const h = c.hIn * 25.4
  const Ae = h * ((od - id) / 2)
  const le = (Math.PI * (od - id)) / Math.log(od / id)
  return { od, id, h, Ae, le }
}

/** AL value in nH/turn² from geometry and initial permeability: µ0·µi·Ae/le. */
export function computedAL(c: Core, m: Material): number {
  const g = coreGeom(c)
  return ((MU0 * m.mu * g.Ae * 1e-6) / (g.le * 1e-3)) * 1e9
}

export function coreAL(c: Core, m: Material): { al: number; published: boolean } {
  const key = `${c.id}-${materialName(m).replace('-', '')}`
  const pub = PUBLISHED_AL[key]
  return pub !== undefined ? { al: pub, published: true } : { al: computedAL(c, m), published: false }
}
