import { RHO_CU } from './units'

export interface Awg {
  /** Gauge as printed: 0000 = -3, 000 = -2, 00 = -1. */
  n: number
  label: string
  /** Bare copper diameter, mm. */
  d: number
  /** Cross-section, mm². */
  area: number
  /** DC resistance at 20 °C, ohm per km. */
  ohmKm: number
  /** Diameter over single-build enamel, mm. */
  dIns: number
  /** Close-wound turns per cm. */
  turnsCm: number
  /** Guideline current at 3 A/mm², amperes. */
  amps: number
}

/** AWG bare diameter in mm: 0.127·92^((36−n)/39). */
export const awgDiameter = (n: number): number => 0.127 * Math.pow(92, (36 - n) / 39)

/** Approximate diameter over single-build enamel (grade 1) in mm: wire plus a coat that grows with size. */
export const enamelDiameter = (d: number): number => d + Math.max(0.01, 0.035 * d + 0.004)

export const awgLabel = (n: number): string => (n >= 1 ? String(n) : '0'.repeat(1 - n))

export const AWG_TABLE: Awg[] = (() => {
  const rows: Awg[] = []
  for (let n = -3; n <= 40; n++) {
    const d = awgDiameter(n)
    const area = (Math.PI / 4) * d * d
    const dIns = enamelDiameter(d)
    rows.push({ n, label: awgLabel(n), d, area, ohmKm: (RHO_CU * 1e9) / area, dIns, turnsCm: 10 / dIns, amps: 3 * area })
  }
  return rows
})()

/** The AWG row whose bare diameter matches d (mm) to within 0.05 %, if any. */
export function awgFor(dMm: number): Awg | undefined {
  return AWG_TABLE.find((r) => Math.abs(r.d - dMm) / r.d < 5e-4)
}
