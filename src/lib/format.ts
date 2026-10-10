/** Number with `sig` significant digits, no trailing zeros, no exponent for ordinary magnitudes. */
export function fmt(x: number, sig = 4): string {
  if (!Number.isFinite(x)) return '–'
  if (x === 0) return '0'
  const a = Math.abs(x)
  if (a >= 1e7 || a < 1e-4) return x.toExponential(sig - 1).replace(/\.?0+e/, 'e')
  const s = x.toPrecision(sig)
  return s.includes('e') ? String(Number(s)) : s.includes('.') ? s.replace(/\.?0+$/, '') : s
}

export const fix = (x: number, d: number): string => (Number.isFinite(x) ? x.toFixed(d) : '–')

const SI: [number, string][] = [
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
  [1e-12, 'p'],
]

/** Engineering notation with an SI prefix: 1.5e-6, 'H' → "1.5 µH". */
export function fmtSI(x: number, unit: string, sig = 4): string {
  if (!Number.isFinite(x)) return '–'
  if (x === 0) return '0 ' + unit
  const a = Math.abs(x)
  const [m, p] = SI.find(([m]) => a >= m * 0.9999999) ?? SI[SI.length - 1]
  return `${fmt(x / m, sig)} ${p}${unit}`
}

export const fmtL = (h: number, sig = 4): string => fmtSI(h, 'H', sig)
export const fmtHz = (f: number, sig = 4): string => fmtSI(f, 'Hz', sig)
export const fmtOhm = (r: number, sig = 3): string => fmtSI(r, 'Ω', sig)
export const fmtF = (c: number, sig = 3): string => fmtSI(c, 'F', sig)
