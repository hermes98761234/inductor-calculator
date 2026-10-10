import { describe, expect, it } from 'vitest'
import { nagaokaL } from './air'
import { runMultilayer, runPcb, runSolenoid, runToroid, type MultilayerIn, type PcbIn, type SolenoidIn, type ToroidIn } from './calc'

const sol: SolenoidIn = { mode: 'calc', method: 'nagaoka', N: 10, formerD: 24.4, spacing: 'pitch', pitch: 2.54, length: 25.4, targetUH: 1, fMHz: 10 }
// 1 mm wire on a 24.4 mm former → mean diameter 25.4 mm, 10 turns at 2.54 mm pitch → 25.4 mm long

describe('solenoid', () => {
  it('computes the classic 1 inch coil', () => {
    const r = runSolenoid(sol, 1)
    expect(r.D).toBeCloseTo(0.0254, 9)
    expect(r.l).toBeCloseTo(0.0254, 9)
    expect(r.Lwheeler * 1e6).toBeCloseTo(1.7241, 3)
    expect(Math.abs(r.Lnagaoka / r.Lwheeler - 1)).toBeLessThan(0.03)
    expect(r.L).toBe(r.Lnagaoka)
    expect(r.air.Q).toBeGreaterThan(50)
    expect(r.warnings).toEqual([])
  })
  it('inverse design hits the target', () => {
    const r = runSolenoid({ ...sol, mode: 'inverse', targetUH: 5 }, 1)
    expect(r.exactN).not.toBeNull()
    expect(Math.abs(r.L / 5e-6 - 1)).toBeLessThan(0.1)
    const exact = r.exactN!
    expect(nagaokaL(exact, 0.0254, exact * 0.00254, 0.001) * 1e6).toBeCloseTo(5, 6)
  })
  it('works in fixed-length mode and flags impossible pitch', () => {
    const r = runSolenoid({ ...sol, spacing: 'length', length: 30, N: 20 }, 1)
    expect(r.pitch).toBeCloseTo(0.0015, 9)
    expect(runSolenoid({ ...sol, spacing: 'pitch', pitch: 0.5 }, 1).warnings).toContain('pitchTooSmall')
    expect(runSolenoid({ ...sol, mode: 'inverse', targetUH: 1e9 }, 1).warnings).toContain('noSolution')
  })
  it('close winding uses the enamelled diameter', () => {
    const r = runSolenoid({ ...sol, spacing: 'close' }, 1)
    expect(r.pitch * 1000).toBeGreaterThan(1)
    expect(r.pitch * 1000).toBeLessThan(1.2)
  })
})

describe('multilayer', () => {
  const ml: MultilayerIn = { mode: 'calc', N: 200, formerD: 20, length: 20, targetUH: 500 }
  it('computes and inverts', () => {
    const r = runMultilayer(ml, 0.5)
    expect(r.geom.layers).toBeGreaterThan(1)
    expect(r.L).toBeGreaterThan(0)
    expect(r.wireLen).toBeGreaterThan(200 * Math.PI * 0.02)
    const inv = runMultilayer({ ...ml, mode: 'inverse' }, 0.5)
    expect(Math.abs(inv.L / 500e-6 - 1)).toBeLessThan(0.15)
  })
})

describe('toroid', () => {
  const tor: ToroidIn = { mode: 'calc', core: 'T50', mix: '2', N: 20, targetUH: 1.96, current: 0.5 }
  it('uses AL', () => {
    const r = runToroid(tor, 0.5)
    expect(r.r.L * 1e6).toBeCloseTo(1.96, 6)
    expect(r.name).toBe('T50-2')
  })
  it('finds turns for a target and tabulates cores', () => {
    const r = runToroid({ ...tor, mode: 'inverse', targetUH: 10 }, 0.5)
    expect(r.exactN).toBeCloseTo(Math.sqrt(10e-6 / 4.9e-9), 6)
    expect(r.rows.length).toBe(19)
    expect(r.rows.find((x) => x.core.id === 'T200')!.N).toBeLessThan(r.rows.find((x) => x.core.id === 'T25')!.N)
    const ferrite = runToroid({ ...tor, core: 'FT50', mix: '43', mode: 'inverse', targetUH: 100 }, 0.5)
    expect(ferrite.name).toBe('FT50-43')
    expect(ferrite.exactN).toBeCloseTo(Math.sqrt(100e-6 / 523e-9), 6)
  })
  it('falls back to a valid core when the mix kind changes', () => {
    expect(runToroid({ ...tor, core: 'T50', mix: '43' }, 0.5).core.kind).toBe('ferrite')
  })
})

describe('pcb', () => {
  const pcb: PcbIn = { mode: 'calc', shape: 'square', n: 5, dout: 10, w: 0.3, s: 0.2, oz: 1, targetNH: 100, fMHz: 10 }
  it('computes a spiral', () => {
    const r = runPcb(pcb)
    expect(r.a.din).toBeCloseTo(0.0054, 9)
    expect(r.a.L * 1e9).toBeGreaterThan(50)
    expect(r.a.L * 1e9).toBeLessThan(500)
    expect(r.warnings).toEqual([])
  })
  it('inverse picks the closest integer turns', () => {
    const r = runPcb({ ...pcb, mode: 'inverse', targetNH: 100 })
    const lo = runPcb({ ...pcb, n: r.n - 1 }).a.L
    const hi = runPcb({ ...pcb, n: r.n + 1 }).a.L
    const err = (x: number) => Math.abs(Math.log(x / 100e-9))
    expect(err(r.a.L)).toBeLessThanOrEqual(Math.min(err(lo), err(hi)))
  })
  it('flags layouts that do not fit', () => {
    expect(runPcb({ ...pcb, n: 20 }).warnings).toContain('noRoom')
  })
})
