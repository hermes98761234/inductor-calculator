import { describe, expect, it } from 'vitest'
import { AWG_TABLE, awgDiameter, awgFor } from './awg'
import { CORES, MATERIALS, computedAL, coreAL, coreGeom, coresFor, materialOf } from './cores'
import { toroid, turnsFor } from './toroid'
import { enamelDiameter } from './awg'

describe('AWG table', () => {
  it('matches the standard diameters', () => {
    expect(awgDiameter(36)).toBeCloseTo(0.127, 6)
    expect(awgDiameter(10)).toBeCloseTo(2.588, 3)
    expect(awgDiameter(22)).toBeCloseTo(0.6438, 3)
    expect(awgDiameter(-3)).toBeCloseTo(11.684, 3) // 4/0
    expect(awgDiameter(40)).toBeCloseTo(0.0799, 4)
  })
  it('has correct resistance and labels', () => {
    const r10 = AWG_TABLE.find((r) => r.n === 10)!
    expect(r10.ohmKm).toBeGreaterThan(3.25)
    expect(r10.ohmKm).toBeLessThan(3.32) // 3.277 Ω/km
    expect(AWG_TABLE[0].label).toBe('0000')
    expect(AWG_TABLE[3].label).toBe('0')
    expect(AWG_TABLE.at(-1)!.label).toBe('40')
    expect(AWG_TABLE).toHaveLength(44)
  })
  it('finds a gauge from a diameter', () => {
    expect(awgFor(0.6438)?.label).toBe('22')
    expect(awgFor(0.7)).toBeUndefined()
    expect(enamelDiameter(0.5)).toBeGreaterThan(0.5)
  })
})

describe('cores', () => {
  it('geometry of the T50', () => {
    const g = coreGeom(CORES.find((c) => c.id === 'T50')!)
    expect(g.od).toBeCloseTo(12.7, 6)
    expect(g.Ae).toBeCloseTo(12.08, 1)
    expect(g.le).toBeGreaterThan(30)
    expect(g.le).toBeLessThan(33)
  })
  it('computed AL agrees with published AL', () => {
    for (const c of CORES) {
      for (const m of MATERIALS.filter((x) => x.kind === c.kind)) {
        const { al, published } = coreAL(c, m)
        if (!published) continue
        const ratio = computedAL(c, m) / al
        // Catalogue AL includes tolerance, coating and the rounded nominal µ: stay within 30 %.
        expect(ratio, `${c.id}-${m.id}`).toBeGreaterThan(0.7)
        expect(ratio, `${c.id}-${m.id}`).toBeLessThan(1.3)
      }
    }
  })
  it('knows well-known values', () => {
    expect(coreAL(CORES.find((c) => c.id === 'T50')!, materialOf('2')).al).toBe(4.9)
    expect(coreAL(CORES.find((c) => c.id === 'FT140')!, materialOf('43')).al).toBe(885)
    expect(coresFor(materialOf('43')).every((c) => c.kind === 'ferrite')).toBe(true)
  })
})

describe('toroid', () => {
  const t50 = CORES.find((c) => c.id === 'T50')!
  it('L = AL·N²', () => {
    const r = toroid(t50, materialOf('2'), 20, 0.4, 0.45, 1)
    expect(r.L).toBeCloseTo(4.9e-9 * 400, 15)
    expect(turnsFor(r.L, 4.9)).toBeCloseTo(20, 9)
  })
  it('checks fit and flux', () => {
    const few = toroid(t50, materialOf('2'), 10, 0.4, 0.45, 1)
    const many = toroid(t50, materialOf('2'), 80, 0.4, 0.45, 1)
    expect(few.fill).toBeLessThan(many.fill)
    expect(few.maxSingleLayer).toBeGreaterThan(10)
    expect(many.maxSingleLayer).toBeLessThan(80)
    // B = L·I / (N·Ae)
    const ae = coreGeom(t50).Ae * 1e-6
    expect(few.Bpk).toBeCloseTo((few.L * 1) / (10 * ae), 12)
    expect(few.Rdc).toBeGreaterThan(0)
    expect(few.iMax).toBeGreaterThan(0)
  })
})
