import { describe, expect, it } from 'vitest'
import { analyseSpiral, innerDiameter, ozToThickness, spiralLength, spiralSheetL, spiralWheelerL, type Spiral } from './spiral'
import { multilayerGeom, multilayerInductance } from './multilayer'

describe('PCB spiral', () => {
  it('computes din from the layout', () => {
    // dout 10 mm, 5 turns, w = 0.3, s = 0.2 → 10 − 3.0 − 1.6 = 5.4 mm
    expect(innerDiameter(0.01, 0.0003, 0.0002, 5)).toBeCloseTo(0.0054, 9)
  })
  it('modified Wheeler by hand', () => {
    // n=5, dout=5 mm, din=1 mm: davg 3 mm, ρ = 2/3; L = 2.34µ0·25·3e-3 / (1 + 2.75·2/3) = 77.84 nH
    const sp: Spiral = { shape: 'square', n: 5, dout: 0.005, din: 0.001 }
    expect(spiralWheelerL(sp) * 1e9).toBeCloseTo(77.84, 1)
  })
  it('current-sheet and Wheeler forms agree within 15 % for typical layouts', () => {
    for (const shape of ['square', 'hexagon', 'octagon', 'circle'] as const) {
      const sp: Spiral = { shape, n: 6, dout: 0.01, din: 0.004 }
      const r = spiralSheetL(sp) / spiralWheelerL(sp)
      expect(r, shape).toBeGreaterThan(0.85)
      expect(r, shape).toBeLessThan(1.15)
    }
  })
  it('scales as n² for fixed davg and ρ', () => {
    const a = spiralWheelerL({ shape: 'square', n: 3, dout: 0.01, din: 0.005 })
    const b = spiralWheelerL({ shape: 'square', n: 6, dout: 0.01, din: 0.005 })
    expect(b / a).toBeCloseTo(4, 9)
  })
  it('length, resistance and Q', () => {
    const sp: Spiral = { shape: 'square', n: 5, dout: 0.01, din: 0.004 }
    expect(spiralLength(sp)).toBeCloseTo(4 * 0.007 * 5, 12)
    expect(spiralLength({ ...sp, shape: 'circle' })).toBeCloseTo(Math.PI * 0.007 * 5, 12)
    const t = ozToThickness(1)
    expect(t).toBeCloseTo(34.79e-6, 9)
    const a = analyseSpiral(sp, 0.0003, t, 1e6)
    // R = ρ·l/(w·t) = 1.724e-8·0.14 / (3e-4·34.79e-6) = 0.231 Ω
    expect(a.Rdc).toBeCloseTo(0.2313, 3)
    expect(a.Rac).toBeGreaterThanOrEqual(a.Rdc)
    expect(a.Q).toBeGreaterThan(0)
    // At 1 GHz skin effect pushes Rac above Rdc
    expect(analyseSpiral(sp, 0.0003, t, 1e9).Rac / a.Rdc).toBeGreaterThan(2)
  })
})

describe('multilayer geometry', () => {
  it('stacks layers', () => {
    const g = multilayerGeom(100, 0.01, 0.02, 0.001)
    expect(g.turnsPerLayer).toBe(20)
    expect(g.layers).toBe(5)
    expect(g.build).toBeCloseTo(0.005, 12)
    expect(g.meanRadius).toBeCloseTo(0.0075, 12)
  })
  it('inductance grows with turns', () => {
    expect(multilayerInductance(200, 0.01, 0.02, 0.001)).toBeGreaterThan(multilayerInductance(100, 0.01, 0.02, 0.001))
  })
})
