import { describe, expect, it } from 'vitest'
import { runMultilayer, runPcb, runSolenoid, runToroid } from './calc'
import { DEFAULT_ML, DEFAULT_PCB, DEFAULT_SOL, DEFAULT_TOR, defaultState, invalidFields, sanitize } from './model'
import { ML_PRESETS, PCB_PRESETS, SOL_PRESETS, TOR_PRESETS } from './presets'

describe('state', () => {
  it('survives garbage', () => {
    expect(sanitize(null).tab).toBe('solenoid')
    const s = sanitize({ tab: 'nope', wires: { solenoid: -3, toroid: 0.5 }, sol: { N: 'x', formerD: 30, mode: 'weird' }, settings: { unit: 'furlong', lang: 'uk' } })
    expect(s.tab).toBe('solenoid')
    expect(s.wires.solenoid).toBe(1)
    expect(s.wires.toroid).toBe(0.5)
    expect(s.sol.N).toBe(DEFAULT_SOL.N)
    expect(s.sol.formerD).toBe(30)
    expect(s.sol.mode).toBe('calc')
    expect(s.settings.unit).toBe('mm')
    expect(s.settings.lang).toBe('uk')
  })
  it('defaults are valid', () => {
    expect(invalidFields(defaultState()).size).toBe(0)
    const s = defaultState()
    s.sol.N = 0
    expect(invalidFields(s).has('sol.N')).toBe(true)
  })
})

describe('presets', () => {
  const w = defaultState().wires
  it('all solve cleanly', () => {
    for (const p of SOL_PRESETS) {
      const r = runSolenoid({ ...DEFAULT_SOL, ...p.patch }, p.wire ?? w.solenoid)
      expect(r.warnings, p.id).toEqual([])
      expect(r.L).toBeGreaterThan(0)
    }
    for (const p of ML_PRESETS) {
      const r = runMultilayer({ ...DEFAULT_ML, ...p.patch }, p.wire ?? w.multilayer)
      expect(r.warnings.filter((x) => x === 'noSolution'), p.id).toEqual([])
    }
    for (const p of TOR_PRESETS) {
      const r = runToroid({ ...DEFAULT_TOR, ...p.patch }, p.wire ?? w.toroid)
      expect(r.warnings, p.id).toEqual([])
    }
    for (const p of PCB_PRESETS) {
      const r = runPcb({ ...DEFAULT_PCB, ...p.patch })
      expect(r.warnings, p.id).toEqual([])
    }
  })
  it('hit their targets within a turn', () => {
    const p = SOL_PRESETS[1]
    const r = runSolenoid({ ...DEFAULT_SOL, ...p.patch }, p.wire!)
    expect(Math.abs(r.L / 10e-6 - 1)).toBeLessThan(0.1)
  })
})
