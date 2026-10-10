import { describe, expect, it } from 'vitest'
import { analyseAir, ellipKE, medhurstH, multilayerL, nagaokaK, nagaokaL, selfCapacitance, sheetL, solveTurns, srf, wheelerL, wheelerMultiUH, wheelerUH, wireCorrection } from './air'
import { MU0, skinDepth } from './units'

describe('elliptic integrals', () => {
  it('match tabulated values', () => {
    // Abramowitz & Stegun: K(k=sin 45°) = 1.8540746773, E = 1.3506438810
    const r = ellipKE(Math.SQRT1_2)
    expect(r.K).toBeCloseTo(1.8540746773, 9)
    expect(r.E).toBeCloseTo(1.350643881, 9)
    const z = ellipKE(0)
    expect(z.K).toBeCloseTo(Math.PI / 2, 12)
    expect(z.E).toBeCloseTo(Math.PI / 2, 12)
  })
})

describe('Nagaoka coefficient', () => {
  it('matches the classical table', () => {
    // Nagaoka's table, x = 2r/l: x=1 -> 0.6884, x=0.5 -> 0.8181 (to 4 digits), x=2 -> 0.5255
    expect(nagaokaK(1, 1)).toBeCloseTo(0.6884, 3)
    expect(nagaokaK(1, 2)).toBeCloseTo(0.8181, 3)
    expect(nagaokaK(2, 1)).toBeCloseTo(0.5255, 3)
  })
  it('tends to 1 for a long solenoid and to the loop limit for a short one', () => {
    expect(nagaokaK(1, 1e4)).toBeGreaterThan(0.9995)
    expect(nagaokaK(1, 1e4)).toBeLessThan(1)
    // short coil limit: L → µ0·N²·a·(ln(8a/l) − 1/2)
    const D = 1, l = 1e-3, a = D / 2
    const L = sheetL(1, D, l)
    expect(L / (MU0 * a * (Math.log((8 * a) / l) - 0.5))).toBeCloseTo(1, 2)
  })
  it('is continuous across the long-coil switch', () => {
    expect(nagaokaK(0.00099, 1)).toBeCloseTo(nagaokaK(0.00101, 1), 4)
  })
})

describe('Wheeler single layer', () => {
  it('reproduces the textbook value', () => {
    // 1 in diameter, 1 in long, 10 turns: L = d²N² / (18d + 40l) = 100/58 = 1.724 µH
    expect(wheelerUH(10, 0.5, 1)).toBeCloseTo(100 / 58, 9)
    expect(wheelerL(10, 0.0254, 0.0254)).toBeCloseTo(1.7241e-6, 10)
  })
  it('agrees with Nagaoka within 1 % for l > 0.8 r', () => {
    for (const [D, l, N] of [[0.0254, 0.0254, 10], [0.01, 0.03, 25], [0.05, 0.04, 8], [0.02, 0.1, 60]]) {
      expect(Math.abs(wheelerL(N, D, l) / sheetL(N, D, l) - 1)).toBeLessThan(0.01)
    }
  })
})

describe('wire correction', () => {
  it('B tends to about 0.33 and A follows the closed form', () => {
    // large N, d = p/2: A = 1.25 − ln 4, B ≈ 0.336 (Grover)
    const c = wireCorrection(400, 0.5, 1)
    expect(c - (1.25 - Math.log(4))).toBeGreaterThan(0.3)
    expect(c - (1.25 - Math.log(4))).toBeLessThan(0.36)
    // a single turn has no mutual term
    expect(wireCorrection(1, 0.5, 1)).toBeCloseTo(1.25 - Math.log(4), 12)
  })
  it('shifts a real coil by a few percent', () => {
    const D = 0.0254, l = 0.0254, N = 10
    const sheet = sheetL(N, D, l)
    const real = nagaokaL(N, D, l, 0.001)
    expect(Math.abs(real / sheet - 1)).toBeLessThan(0.05)
    expect(real).not.toBe(sheet)
    // thicker wire for the same pitch raises the correction term A (turns look less like a sheet)
    expect(wireCorrection(N, 0.002, 0.0025)).toBeGreaterThan(wireCorrection(N, 0.0005, 0.0025))
  })
})

describe('multilayer Wheeler', () => {
  it('matches the formula by hand', () => {
    // a=1, b=1, c=0.5, N=100: 0.8·10000 / (6 + 9 + 5) = 400 µH
    expect(wheelerMultiUH(100, 1, 1, 0.5)).toBeCloseTo(400, 9)
    expect(multilayerL(100, 0.0254, 0.0254, 0.0127)).toBeCloseTo(400e-6, 9)
  })
})

describe('Q and self-resonance', () => {
  it('skin depth of copper at 1 MHz is about 66 µm', () => {
    expect(skinDepth(1e6) * 1e6).toBeGreaterThan(64)
    expect(skinDepth(1e6) * 1e6).toBeLessThan(68)
  })
  it('Medhurst factor is in the usual range and interpolates', () => {
    expect(medhurstH(1)).toBeCloseTo(0.64, 6)
    expect(medhurstH(0.01)).toBeCloseTo(0.96, 6)
    expect(medhurstH(1.2)).toBeLessThan(0.64)
    expect(medhurstH(1.2)).toBeGreaterThan(0.62)
    expect(selfCapacitance(0.0254, 0.0254)).toBeCloseTo(0.64 * 2.54e-12, 15)
  })
  it('Q grows roughly with sqrt(f) and collapses at SRF', () => {
    const L = nagaokaL(10, 0.0254, 0.0254, 0.001)
    const a = analyseAir(L, 10, 0.0254, 0.0254, 0.001, 1e6)
    const b = analyseAir(L, 10, 0.0254, 0.0254, 0.001, 4e6)
    expect(b.Q / a.Q).toBeGreaterThan(1.5)
    expect(b.Q / a.Q).toBeLessThan(2.5)
    expect(analyseAir(L, 10, 0.0254, 0.0254, 0.001, a.srf * 1.01).Q).toBe(0)
    expect(srf(1e-6, 1e-12)).toBeCloseTo(159.155e6, -3)
  })
})

describe('solveTurns', () => {
  it('inverts L = k·N²', () => {
    expect(solveTurns((n) => 2e-9 * n * n, 2e-7)).toBeCloseTo(10, 6)
    expect(solveTurns((n) => n, -1)).toBeNull()
    expect(solveTurns((n) => n, 1e9)).toBeNull()
  })
  it('inverts the real coil model', () => {
    const f = (n: number) => nagaokaL(n, 0.02, 0.02, 0.0005)
    const n = solveTurns(f, 3e-6)!
    expect(f(n)).toBeCloseTo(3e-6, 12)
  })
})
