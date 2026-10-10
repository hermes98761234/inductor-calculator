import { useEffect, useMemo, useState } from 'react'
import { analyseAir } from './lib/air'
import { AWG_TABLE, awgFor, enamelDiameter } from './lib/awg'
import { runMultilayer, runPcb, runSolenoid, runToroid, type Mode, type PcbIn, type SolenoidIn } from './lib/calc'
import { MATERIALS, materialName, materialOf, coresFor } from './lib/cores'
import { fix, fmt, fmtF, fmtHz, fmtL, fmtOhm } from './lib/format'
import { TABS, invalidFields, loadState, saveState, type AppState, type Tab, type WireTab } from './lib/model'
import { ML_PRESETS, PCB_PRESETS, PRESETS_BY_TAB, SOL_PRESETS, TOR_PRESETS, type Preset } from './lib/presets'
import { SHAPES } from './lib/spiral'
import { LEN_UNITS, mmToUnit, type LenUnit } from './lib/units'
import { tr, type T } from './i18n'
import NumberField from './components/NumberField'
import LenField from './components/LenField'
import LineChart, { type ChartSeries } from './components/LineChart'

const WIRE_OF = { sol: 'solenoid', ml: 'multilayer', tor: 'toroid' } as const
const REPO = 'https://github.com/hermes98761234/inductor-calculator'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'warn' | 'err' }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={'stat-value' + (tone ? ' ' + tone : '')}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

function Notes({ codes, t }: { codes: string[]; t: T }) {
  const MSG: Record<string, string> = {
    noSolution: t('No solution in the supported range. Adjust the geometry or the target.'),
    pitchTooSmall: t('Pitch is smaller than the wire diameter: the turns would overlap.'),
    shortCoil: t('Very short coil (length under 0.8 of the radius): Wheeler loses accuracy, trust Nagaoka.'),
    singleLayer: t('Only one layer fits: the air-core solenoid tab is more accurate.'),
    thickWinding: t('The winding is very thick compared with its length; the formula is less accurate.'),
    windowFull: t('The wire will not fit through the core: use thinner wire or a larger core.'),
    multiLayer: t('More turns than one layer holds: expect several layers and extra winding capacitance.'),
    saturated: t('The core saturates at this current. Use a bigger core or fewer turns.'),
    highFlux: t('Flux density is above half of saturation: inductance may drop under DC bias.'),
    noRoom: t('The turns do not fit: the inner diameter would be negative. Reduce turns, width or spacing.'),
    targetTooBig: t('The target is higher than this footprint can reach. Enlarge the outer diameter or use thinner traces.'),
    denseCenter: t('The centre is almost filled: inner turns add little inductance and a lot of resistance.'),
  }
  if (!codes.length) return null
  return (
    <ul className="notes">
      {codes.map((c) => (
        <li key={c} className="warn-text">{MSG[c] ?? c}</li>
      ))}
    </ul>
  )
}

function ModeToggle({ mode, onChange, t }: { mode: Mode; onChange: (m: Mode) => void; t: T }) {
  return (
    <div className="row seg" role="group" aria-label={t('Task')}>
      <button className={mode === 'calc' ? 'on' : ''} onClick={() => onChange('calc')}>{t('Inductance from turns')}</button>
      <button className={mode === 'inverse' ? 'on' : ''} onClick={() => onChange('inverse')}>{t('Turns for inductance')}</button>
    </div>
  )
}

function WireField({ wire, unit, bad, onChange, t }: { wire: number; unit: LenUnit; bad: boolean; onChange: (mm: number) => void; t: T }) {
  const row = awgFor(wire)
  return (
    <>
      <div className="field">
        <label>{t('Wire gauge')}</label>
        <select value={row ? String(row.n) : 'custom'} onChange={(e) => e.target.value !== 'custom' && onChange(AWG_TABLE.find((r) => String(r.n) === e.target.value)!.d)}>
          <option value="custom">{t('Custom diameter')}</option>
          {AWG_TABLE.filter((r) => r.n >= 6 && r.n <= 36).map((r) => (
            <option key={r.n} value={r.n}>AWG {r.label} ({fmt(r.d, 3)} mm)</option>
          ))}
        </select>
      </div>
      <LenField label={t('Bare wire diameter')} mm={wire} unit={unit} onChange={onChange} bad={bad} title={t('Copper diameter without enamel')} />
    </>
  )
}

function PresetPicker<T0>({ list, value, onPick, t }: { list: Preset<T0>[]; value: string; onPick: (id: string) => void; t: T }) {
  return (
    <div className="field">
      <label>{t('Example')}</label>
      <select value={list.some((p) => p.id === value) ? value : ''} onChange={(e) => e.target.value && onPick(e.target.value)}>
        <option value="">{t('Custom values')}</option>
        {list.map((p) => (
          <option key={p.id} value={p.id}>{t(p.name)}</option>
        ))}
      </select>
    </div>
  )
}

export default function App() {
  const [state, setState] = useState<AppState>(loadState)
  const [copied, setCopied] = useState(false)
  const { settings, tab } = state
  const unit = settings.unit
  const t: T = (s, ...a) => tr(settings.lang, s, ...a)
  const bad = useMemo(() => invalidFields(state), [state])

  useEffect(() => saveState(state), [state])
  useEffect(() => {
    const el = document.documentElement
    if (settings.theme === 'auto') el.removeAttribute('data-theme')
    else el.setAttribute('data-theme', settings.theme)
    el.lang = settings.lang
    document.title = t('Inductor calculator') + ': ' + t('air-core coils, toroids and PCB spirals')
  }, [settings.theme, settings.lang]) // eslint-disable-line react-hooks/exhaustive-deps

  const patch = <K extends 'sol' | 'ml' | 'tor' | 'pcb'>(key: K, p: Partial<AppState[K]>) =>
    setState((s) => ({ ...s, [key]: { ...s[key], ...p }, preset: { ...s.preset, [tabOf(key)]: '' } }))
  const tabOf = (k: 'sol' | 'ml' | 'tor' | 'pcb'): Tab => ({ sol: 'solenoid', ml: 'multilayer', tor: 'toroid', pcb: 'pcb' } as const)[k]
  const wireTab: WireTab = tab === 'multilayer' || tab === 'toroid' ? tab : 'solenoid'
  const wire = state.wires[wireTab]
  const setWire = (mm: number) => setState((s) => ({ ...s, wires: { ...s.wires, [wireTab]: mm }, preset: { ...s.preset, [s.tab]: '' } }))
  const setAllWires = (mm: number) => setState((s) => ({ ...s, wires: { solenoid: mm, multilayer: mm, toroid: mm } }))
  const applyPreset = (key: 'sol' | 'ml' | 'tor' | 'pcb', list: Preset<never>[], id: string) => {
    const p = list.find((x) => x.id === id)
    if (!p) return
    setState((s) => ({ ...s, wires: key === 'pcb' || p.wire === undefined ? s.wires : { ...s.wires, [WIRE_OF[key]]: p.wire }, [key]: { ...(s[key] as object), ...(p.patch as object) }, preset: { ...s.preset, [tabOf(key)]: id } }))
  }
  const num = <K extends 'sol' | 'ml' | 'tor' | 'pcb'>(key: K, field: keyof AppState[K] & string) => (v: number) => patch(key, { [field]: v } as Partial<AppState[K]>)
  const nf = (key: 'sol' | 'ml' | 'tor' | 'pcb', field: string) => ({
    value: (state[key] as unknown as Record<string, number>)[field],
    onChange: num(key, field as never),
    bad: bad.has(`${key}.${field}`),
  })
  const lf = (key: 'sol' | 'ml' | 'tor' | 'pcb', field: string) => ({
    mm: (state[key] as unknown as Record<string, number>)[field],
    onChange: num(key, field as never),
    bad: bad.has(`${key}.${field}`),
    unit,
  })

  const wireBad = bad.has('wire.' + wireTab)
  const solWireOk = !bad.has('wire.solenoid')
  const mlWireOk = !bad.has('wire.multilayer')
  const torWireOk = !bad.has('wire.toroid')
  const sol = useMemo(() => (solWireOk && !['sol.formerD', 'sol.fMHz', 'sol.N', 'sol.targetUH', 'sol.pitch', 'sol.length'].some((k) => bad.has(k)) ? runSolenoid(state.sol, state.wires.solenoid) : null), [state.sol, state.wires.solenoid, bad, solWireOk])
  const ml = useMemo(() => (mlWireOk && !['ml.formerD', 'ml.length', 'ml.N', 'ml.targetUH'].some((k) => bad.has(k)) ? runMultilayer(state.ml, state.wires.multilayer) : null), [state.ml, state.wires.multilayer, bad, mlWireOk])
  const tor = useMemo(() => (torWireOk && !['tor.N', 'tor.targetUH', 'tor.current'].some((k) => bad.has(k)) ? runToroid(state.tor, state.wires.toroid) : null), [state.tor, state.wires.toroid, bad, torWireOk])
  const pcb = useMemo(() => (![...bad].some((k) => k.startsWith('pcb.')) ? runPcb(state.pcb) : null), [state.pcb, bad])

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }
  const lenStr = (mm: number) => `${fmt(mmToUnit(mm, unit), 4)} ${unit}`
  const dInsMm = enamelDiameter(wire)

  // ----- Q versus frequency chart (solenoid, PCB spiral)
  const qSeries = useMemo<ChartSeries[]>(() => {
    const pts: [number, number][] = []
    if (tab === 'solenoid' && sol) {
      const fTop = sol.air.srf * 0.999
      const fLo = Math.max(1e4, fTop / 2000)
      for (let k = 0; k <= 80; k++) {
        const f = fLo * Math.pow(fTop / fLo, k / 80)
        pts.push([f / 1e6, analyseAir(sol.L, sol.N, sol.D, sol.l, state.wires.solenoid / 1000, f).Q])
      }
    } else if (tab === 'pcb' && pcb && pcb.a.din > 0) {
      const spiral = (f: number) => runPcb({ ...state.pcb, mode: 'calc', n: pcb.n, fMHz: f / 1e6 }).a.Q
      for (let k = 0; k <= 80; k++) {
        const f = 1e5 * Math.pow(3e3, k / 80)
        pts.push([f / 1e6, spiral(f)])
      }
    }
    return pts.length ? [{ id: 'q', color: 'var(--ok)', pts }] : []
  }, [tab, sol, pcb, state.pcb, state.wires.solenoid])

  const sheetSummary = (): string => {
    if (tab === 'solenoid' && sol) {
      const o = state.sol
      return [
        `${t('Air-core solenoid')}: ${sol.N} ${t('turns')}, ${t('wire')} ${fmt(state.wires.solenoid, 4)} mm, ${t('mean diameter')} ${fmt(sol.D * 1000, 4)} mm, ${t('length')} ${fmt(sol.l * 1000, 4)} mm`,
        `${t('Inductance')}: ${fmtL(sol.L)} (${o.method === 'nagaoka' ? 'Nagaoka' : 'Wheeler'}), Q ${fix(sol.air.Q, 0)} @ ${fmt(o.fMHz)} MHz, SRF ${fmtHz(sol.air.srf)}`,
      ].join('\n')
    }
    if (tab === 'multilayer' && ml) return `${t('Multilayer coil')}: ${ml.N} ${t('turns')}, ${ml.geom.layers} ${t('layers')}, ${fmtL(ml.L)}`
    if (tab === 'toroid' && tor) return `${tor.name}: ${tor.r.turns} ${t('turns')}, AL ${fmt(tor.r.AL)} nH/N², ${fmtL(tor.r.L)}`
    if (tab === 'pcb' && pcb) return `${t('PCB spiral')}: ${pcb.n} ${t('turns')}, ${fmtL(pcb.a.L)}, Rdc ${fmtOhm(pcb.a.Rdc)}`
    return ''
  }

  // ----- tab bodies
  const solPanel = (
    <>
      <PresetPicker list={SOL_PRESETS} value={state.preset.solenoid} onPick={(id) => applyPreset('sol', PRESETS_BY_TAB.solenoid, id)} t={t} />
      <ModeToggle mode={state.sol.mode} onChange={(m) => patch('sol', { mode: m })} t={t} />
      <Section title={t('Coil')}>
        {state.sol.mode === 'calc' ? (
          <NumberField label={t('Turns')} step={1} {...nf('sol', 'N')} />
        ) : (
          <NumberField label={t('Target inductance')} suffix="µH" {...nf('sol', 'targetUH')} />
        )}
        <LenField label={t('Former diameter')} title={t('Outside diameter of the tube the wire is wound on')} {...lf('sol', 'formerD')} />
        <WireField wire={wire} unit={unit} bad={wireBad} onChange={setWire} t={t} />
        <div className="field">
          <label>{t('Turn spacing')}</label>
          <select value={state.sol.spacing} onChange={(e) => patch('sol', { spacing: e.target.value as SolenoidIn['spacing'] })}>
            <option value="close">{t('Close wound')}</option>
            <option value="pitch">{t('Set pitch')}</option>
            <option value="length">{t('Set winding length')}</option>
          </select>
        </div>
        {state.sol.spacing === 'pitch' && <LenField label={t('Pitch (centre to centre)')} {...lf('sol', 'pitch')} />}
        {state.sol.spacing === 'length' && <LenField label={t('Winding length')} {...lf('sol', 'length')} />}
      </Section>
      <Section title={t('Formula and frequency')}>
        <div className="field">
          <label>{t('Formula')}</label>
          <select value={state.sol.method} onChange={(e) => patch('sol', { method: e.target.value as SolenoidIn['method'] })}>
            <option value="nagaoka">{t('Nagaoka with wire correction')}</option>
            <option value="wheeler">{t('Wheeler')}</option>
          </select>
        </div>
        <NumberField label={t('Operating frequency')} suffix="MHz" {...nf('sol', 'fMHz')} />
      </Section>
    </>
  )

  const solMain = sol && (
    <>
      <div className="cards">
        <Stat label={t('Inductance')} value={fmtL(sol.L)} sub={sol.exactN !== null ? t('target {0}', fmtL(state.sol.targetUH * 1e-6)) : state.sol.method === 'nagaoka' ? 'Nagaoka' : 'Wheeler'} tone="ok" />
        <Stat label={t('Turns')} value={String(sol.N)} sub={sol.exactN !== null ? t('exact {0}', fmt(sol.exactN, 4)) : undefined} />
        <Stat label={t('Winding length')} value={lenStr(sol.l * 1000)} sub={t('pitch {0}', lenStr(sol.pitch * 1000))} />
        <Stat label={t('Mean diameter')} value={lenStr(sol.D * 1000)} />
        <Stat label={t('Q at {0} MHz', fmt(state.sol.fMHz))} value={fix(sol.air.Q, 0)} sub={t('skin effect only, no proximity')} />
        <Stat label={t('Self-resonance')} value={fmtHz(sol.air.srf)} sub={t('self-capacitance {0}', fmtF(sol.air.C))} tone={state.sol.fMHz * 1e6 > sol.air.srf * 0.5 ? 'warn' : undefined} />
        <Stat label={t('Wire needed')} value={`${fix(sol.air.wireLen, sol.air.wireLen < 1 ? 3 : 2)} m`} sub={`Rdc ${fmtOhm(sol.air.Rdc)}, Rac ${fmtOhm(sol.air.Rac)}`} />
      </div>
      <Notes codes={sol.warnings} t={t} />
      <div className="box">
        <h3>{t('Both formulas')}</h3>
        <table className="data">
          <tbody>
            <tr><td>{t('Nagaoka with wire correction')}</td><td className="num">{fmtL(sol.Lnagaoka)}</td></tr>
            <tr><td>{t('Wheeler')}</td><td className="num">{fmtL(sol.Lwheeler)}</td><td className="num muted">{fix((sol.Lwheeler / sol.Lnagaoka - 1) * 100, 2)} %</td></tr>
          </tbody>
        </table>
      </div>
      <div className="box">
        <h3>{t('Inductance versus turns')}</h3>
        <LineChart series={[{ id: 'l', color: 'var(--accent)', pts: sol.curve }]} marker={[sol.N, sol.L]} xLabel={t('Turns')} yLabel={t('Inductance')} yFmt={(v) => fmtL(v, 3)} title={t('Inductance versus turns')} />
      </div>
      <div className="box">
        <h3>{t('Q versus frequency')}</h3>
        <LineChart series={qSeries} xLog marker={sol.air.Q > 0 && state.sol.fMHz < sol.air.srf / 1e6 ? [state.sol.fMHz, sol.air.Q] : undefined} xLabel={t('Frequency (MHz)')} yLabel="Q" yFmt={(v) => fmt(v, 3)} title={t('Q versus frequency')} />
      </div>
    </>
  )

  const mlPanel = (
    <>
      <PresetPicker list={ML_PRESETS} value={state.preset.multilayer} onPick={(id) => applyPreset('ml', PRESETS_BY_TAB.multilayer, id)} t={t} />
      <ModeToggle mode={state.ml.mode} onChange={(m) => patch('ml', { mode: m })} t={t} />
      <Section title={t('Coil')}>
        {state.ml.mode === 'calc' ? (
          <NumberField label={t('Turns')} step={1} {...nf('ml', 'N')} />
        ) : (
          <NumberField label={t('Target inductance')} suffix="µH" {...nf('ml', 'targetUH')} />
        )}
        <LenField label={t('Former diameter')} {...lf('ml', 'formerD')} />
        <LenField label={t('Winding length')} title={t('Width of the winding along the former')} {...lf('ml', 'length')} />
        <WireField wire={wire} unit={unit} bad={wireBad} onChange={setWire} t={t} />
      </Section>
      <p className="hint">{t('Layer wound: each layer sits on top of the previous one with the insulated wire diameter as spacing.')}</p>
    </>
  )

  const mlMain = ml && (
    <>
      <div className="cards">
        <Stat label={t('Inductance')} value={fmtL(ml.L)} sub={ml.exactN !== null ? t('target {0}', fmtL(state.ml.targetUH * 1e-6)) : 'Wheeler'} tone="ok" />
        <Stat label={t('Turns')} value={String(ml.N)} sub={ml.exactN !== null ? t('exact {0}', fmt(ml.exactN, 4)) : undefined} />
        <Stat label={t('Layers')} value={String(ml.geom.layers)} sub={t('{0} turns per layer', ml.geom.turnsPerLayer)} />
        <Stat label={t('Winding build')} value={lenStr(ml.geom.build * 1000)} />
        <Stat label={t('Wire needed')} value={`${fix(ml.wireLen, ml.wireLen < 1 ? 3 : 2)} m`} sub={`Rdc ${fmtOhm(ml.wireLen * 1.724e-8 / (Math.PI * (state.wires.multilayer / 2000) ** 2))}`} />
      </div>
      <Notes codes={ml.warnings} t={t} />
      <div className="box">
        <h3>{t('Inductance versus turns')}</h3>
        <LineChart series={[{ id: 'l', color: 'var(--accent)', pts: ml.curve }]} marker={[ml.N, ml.L]} xLabel={t('Turns')} yLabel={t('Inductance')} yFmt={(v) => fmtL(v, 3)} title={t('Inductance versus turns')} />
      </div>
      <p className="hint">{t('Wheeler multilayer formula, good to about 5 % for a build comparable to the former radius. Winding capacitance is not modelled.')}</p>
    </>
  )

  const mat = materialOf(state.tor.mix)
  const torPanel = (
    <>
      <PresetPicker list={TOR_PRESETS} value={state.preset.toroid} onPick={(id) => applyPreset('tor', PRESETS_BY_TAB.toroid, id)} t={t} />
      <ModeToggle mode={state.tor.mode} onChange={(m) => patch('tor', { mode: m })} t={t} />
      <Section title={t('Core')}>
        <div className="field">
          <label>{t('Material')}</label>
          <select
            value={state.tor.mix}
            onChange={(e) => {
              const m = materialOf(e.target.value)
              const core = coresFor(m).some((c) => c.id === state.tor.core) ? state.tor.core : coresFor(m).find((c) => c.id === (m.kind === 'iron' ? 'T50' : 'FT50'))!.id
              patch('tor', { mix: e.target.value, core })
            }}
          >
            <optgroup label={t('Powdered iron (T-series)')}>
              {MATERIALS.filter((m) => m.kind === 'iron').map((m) => (
                <option key={m.id} value={m.id}>{`${materialName(m)} (µ ${m.mu}, ${m.range})`}</option>
              ))}
            </optgroup>
            <optgroup label={t('Ferrite (FT-series)')}>
              {MATERIALS.filter((m) => m.kind === 'ferrite').map((m) => (
                <option key={m.id} value={m.id}>{`${materialName(m)} (µ ${m.mu})`}</option>
              ))}
            </optgroup>
          </select>
        </div>
        <div className="field">
          <label>{t('Size')}</label>
          <select value={tor?.core.id ?? state.tor.core} onChange={(e) => patch('tor', { core: e.target.value })}>
            {coresFor(mat).map((c) => (
              <option key={c.id} value={c.id}>{`${c.id} (${fmt(c.odIn * 25.4, 3)} mm OD)`}</option>
            ))}
          </select>
        </div>
      </Section>
      <Section title={t('Winding')}>
        {state.tor.mode === 'calc' ? (
          <NumberField label={t('Turns')} step={1} {...nf('tor', 'N')} />
        ) : (
          <NumberField label={t('Target inductance')} suffix="µH" {...nf('tor', 'targetUH')} />
        )}
        <NumberField label={t('DC current')} suffix="A" {...nf('tor', 'current')} />
        <WireField wire={wire} unit={unit} bad={wireBad} onChange={setWire} t={t} />
      </Section>
    </>
  )

  const torMain = tor && (
    <>
      <div className="cards">
        <Stat label={t('Inductance')} value={fmtL(tor.r.L)} sub={tor.exactN !== null ? t('target {0}', fmtL(state.tor.targetUH * 1e-6)) : `${tor.name}`} tone="ok" />
        <Stat label={t('Turns')} value={String(tor.r.turns)} sub={tor.exactN !== null ? t('exact {0}', fmt(tor.exactN, 4)) : t('one turn = one pass through the hole')} />
        <Stat label="AL" value={`${fmt(tor.r.AL, 4)} nH/N²`} sub={tor.r.published ? t('catalogue value') : t('computed from µ and core size')} />
        <Stat label={t('Peak flux density')} value={`${fmt(tor.r.Bpk * 1000, 3)} mT`} sub={t('{0}% of typical saturation', fix(tor.r.bUsage * 100, 0))} tone={tor.r.bUsage > 1 ? 'err' : tor.r.bUsage > 0.5 ? 'warn' : undefined} />
        <Stat label={t('Current at 50% of saturation')} value={`${fmt(tor.r.iMax, 3)} A`} />
        <Stat label={t('Window fill')} value={`${fix(tor.r.fill * 100, 0)}%`} sub={t('single layer holds about {0} turns', tor.r.maxSingleLayer)} tone={tor.r.fill > 0.4 ? 'err' : undefined} />
        <Stat label={t('Wire needed')} value={`${fix(tor.r.wireLen, tor.r.wireLen < 1 ? 3 : 2)} m`} sub={`Rdc ${fmtOhm(tor.r.Rdc)}`} />
      </div>
      <Notes codes={tor.warnings} t={t} />
      <div className="box">
        <h3>{t('Inductance versus turns')}</h3>
        <LineChart series={[{ id: 'l', color: 'var(--accent)', pts: tor.curve }]} marker={[tor.r.turns, tor.r.L]} xLabel={t('Turns')} yLabel={t('Inductance')} yFmt={(v) => fmtL(v, 3)} title={t('Inductance versus turns')} />
      </div>
      {tor.rows.length > 0 && (
        <div className="box">
          <h3>{t('Turns needed on every {0} core', materialName(tor.mat))}</h3>
          <div className="chart-scroll">
            <table className="data compare">
              <thead>
                <tr><th>{t('Core')}</th><th>AL (nH/N²)</th><th>{t('Turns')}</th><th>{t('Single layer')}</th><th>{t('Flux')}</th></tr>
              </thead>
              <tbody>
                {tor.rows.map((r) => (
                  <tr key={r.core.id} className={r.core.id === tor.core.id ? 'active' : ''}>
                    <td><button className="link" onClick={() => patch('tor', { core: r.core.id })}>{r.core.id}</button></td>
                    <td className="num">{fmt(r.AL, 4)}{r.published ? '' : '*'}</td>
                    <td className="num">{r.N}</td>
                    <td className={'num ' + (r.fits ? 'ok-text' : 'err-text')}>{r.fits ? t('fits') : t('no')}</td>
                    <td className={'num ' + (r.bUsage > 1 ? 'err-text' : r.bUsage > 0.5 ? 'warn-text' : '')}>{fix(r.bUsage * 100, 0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">{t('* computed from permeability and core size instead of a catalogue value. AL tolerance is typically ±10% for powdered iron and ±20-25% for ferrite.')}</p>
        </div>
      )}
    </>
  )

  const pcbPanel = (
    <>
      <PresetPicker list={PCB_PRESETS} value={state.preset.pcb} onPick={(id) => applyPreset('pcb', PRESETS_BY_TAB.pcb, id)} t={t} />
      <ModeToggle mode={state.pcb.mode} onChange={(m) => patch('pcb', { mode: m })} t={t} />
      <Section title={t('Spiral')}>
        <div className="field">
          <label>{t('Shape')}</label>
          <select value={state.pcb.shape} onChange={(e) => patch('pcb', { shape: e.target.value as PcbIn['shape'] })}>
            {SHAPES.map((s) => (
              <option key={s} value={s}>{t(s === 'square' ? 'Square' : s === 'hexagon' ? 'Hexagonal' : s === 'octagon' ? 'Octagonal' : 'Circular')}</option>
            ))}
          </select>
        </div>
        {state.pcb.mode === 'calc' ? (
          <NumberField label={t('Turns')} step={1} {...nf('pcb', 'n')} />
        ) : (
          <NumberField label={t('Target inductance')} suffix="nH" {...nf('pcb', 'targetNH')} />
        )}
        <LenField label={t('Outer diameter')} {...lf('pcb', 'dout')} />
        <div className="grid2">
          <LenField label={t('Trace width')} {...lf('pcb', 'w')} />
          <LenField label={t('Spacing')} {...lf('pcb', 's')} />
        </div>
        <div className="grid2">
          <NumberField label={t('Copper')} suffix="oz" {...nf('pcb', 'oz')} title={t('Copper weight in oz per square foot; 1 oz is 35 µm')} />
          <NumberField label={t('Frequency')} suffix="MHz" {...nf('pcb', 'fMHz')} />
        </div>
      </Section>
    </>
  )

  const pcbMain = pcb && (
    <>
      <div className="cards">
        <Stat label={t('Inductance')} value={fmtL(pcb.a.L)} sub={state.pcb.mode === 'inverse' ? t('target {0}', fmtL(state.pcb.targetNH * 1e-9)) : t('modified Wheeler')} tone="ok" />
        <Stat label={t('Current sheet')} value={fmtL(pcb.a.Lsheet)} sub={t('second estimate (Mohan)')} />
        <Stat label={t('Turns')} value={String(pcb.n)} />
        <Stat label={t('Inner diameter')} value={pcb.a.din > 0 ? lenStr(pcb.a.din * 1000) : '–'} sub={t('fill ratio {0}', fix(pcb.a.rho, 2))} />
        <Stat label={t('Trace length')} value={lenStr(pcb.a.length * 1000)} />
        <Stat label={t('DC resistance')} value={fmtOhm(pcb.a.Rdc)} sub={`Rac ${fmtOhm(pcb.a.Rac)} @ ${fmt(state.pcb.fMHz)} MHz`} />
        <Stat label={t('Q (upper bound)')} value={fix(pcb.a.Q, 1)} sub={t('conductor loss only')} />
      </div>
      <Notes codes={pcb.warnings} t={t} />
      <div className="box">
        <h3>{t('Inductance versus turns')}</h3>
        <LineChart series={[{ id: 'l', color: 'var(--accent)', pts: pcb.curve }]} marker={pcb.a.din > 0 ? [pcb.n, pcb.a.L] : undefined} xLabel={t('Turns')} yLabel={t('Inductance')} yFmt={(v) => fmtL(v, 3)} title={t('Inductance versus turns')} />
      </div>
      <div className="box">
        <h3>{t('Q versus frequency')}</h3>
        <LineChart series={qSeries} xLog marker={state.pcb.fMHz >= 0.1 && state.pcb.fMHz <= 1000 ? [state.pcb.fMHz, pcb.a.Q] : undefined} xLabel={t('Frequency (MHz)')} yLabel="Q" yFmt={(v) => fmt(v, 3)} title={t('Q versus frequency')} />
      </div>
      <p className="hint">{t('Same outer diameter, width and spacing for a fixed number of turns on one layer; the footprint is a spiral without a ground plane. Real boards add substrate loss and parasitic capacitance, so measure the result.')}</p>
    </>
  )

  const wireMain = (
    <div className="box">
      <h3>{t('Wire gauge table (copper, 20 °C)')}</h3>
      <div className="chart-scroll tall">
        <table className="data compare">
          <thead>
            <tr>
              <th>AWG</th><th>{t('Diameter')}</th><th>{t('Over enamel')}</th><th>mm²</th><th>Ω/km</th><th>{t('Turns per cm')}</th><th>{t('Current at 3 A/mm²')}</th><th></th>
            </tr>
          </thead>
          <tbody>
            {AWG_TABLE.map((r) => (
              <tr key={r.n} className={awgFor(wire)?.n === r.n ? 'active' : ''}>
                <td>{r.label}</td>
                <td className="num">{fmt(mmToUnit(r.d, unit), 4)} {unit}</td>
                <td className="num">{fmt(mmToUnit(r.dIns, unit), 4)} {unit}</td>
                <td className="num">{fmt(r.area, 4)}</td>
                <td className="num">{fmt(r.ohmKm, 4)}</td>
                <td className="num">{fix(r.turnsCm, 1)}</td>
                <td className="num">{fmt(r.amps, 3)} A</td>
                <td><button className="small" onClick={() => setAllWires(r.d)}>{t('Use')}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">{t('Enamel build is typical single-build magnet wire; check the datasheet of your wire. Use sets the wire on all coil tabs. 3 A/mm² is a common guideline for coils with some cooling, not a rating.')}</p>
    </div>
  )

  const tabNames: Record<Tab, string> = {
    solenoid: t('Air-core solenoid'),
    multilayer: t('Multilayer'),
    toroid: t('Toroid'),
    pcb: t('PCB spiral'),
    wire: t('Wire table'),
  }

  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">{t('Inductor calculator')}</span>
        <span className="hint grow">{t('Air-core, multilayer, toroid and PCB spiral coils: inductance, turns for a target, Q and self-resonance.')}</span>
        <label className="inline-label">
          {t('Units')}
          <select value={unit} onChange={(e) => setState((s) => ({ ...s, settings: { ...s.settings, unit: e.target.value as LenUnit } }))}>
            {LEN_UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </label>
        <label className="inline-label">
          {t('Language')}
          <select value={settings.lang} onChange={(e) => setState((s) => ({ ...s, settings: { ...s.settings, lang: e.target.value as 'en' | 'uk' } }))}>
            <option value="en">English</option>
            <option value="uk">Українська</option>
          </select>
        </label>
        <label className="inline-label">
          {t('Theme')}
          <select value={settings.theme} onChange={(e) => setState((s) => ({ ...s, settings: { ...s.settings, theme: e.target.value as 'auto' | 'light' | 'dark' } }))}>
            <option value="auto">{t('System')}</option>
            <option value="light">{t('Light')}</option>
            <option value="dark">{t('Dark')}</option>
          </select>
        </label>
      </header>
      <div className="tabs" role="tablist">
        {TABS.map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setState((s) => ({ ...s, tab: k }))}>
            {tabNames[k]}
          </button>
        ))}
      </div>
      <div className="body">
        {tab !== 'wire' && (
          <aside className="side">
            <div className="panel">
              {tab === 'solenoid' && solPanel}
              {tab === 'multilayer' && mlPanel}
              {tab === 'toroid' && torPanel}
              {tab === 'pcb' && pcbPanel}
            </div>
          </aside>
        )}
        <main className={'main' + (tab === 'wire' ? ' wide' : '')}>
          {tab === 'solenoid' && (sol ? solMain : <p className="verdict err">{t('Fix the highlighted fields.')}</p>)}
          {tab === 'multilayer' && (ml ? mlMain : <p className="verdict err">{t('Fix the highlighted fields.')}</p>)}
          {tab === 'toroid' && (tor ? torMain : <p className="verdict err">{t('Fix the highlighted fields.')}</p>)}
          {tab === 'pcb' && (pcb ? pcbMain : <p className="verdict err">{t('Fix the highlighted fields.')}</p>)}
          {tab === 'wire' && wireMain}
          {tab !== 'wire' && (
            <div className="row">
              <button onClick={() => copy(sheetSummary())}>{copied ? t('Copied') : t('Copy summary')}</button>
              {tab !== 'pcb' && <span className="hint">{t('Wire: {0} mm bare, {1} mm over enamel', fmt(wire, 4), fmt(dInsMm, 4))}</span>}
            </div>
          )}
        </main>
      </div>
      <footer className="foot hint">
        {t('Formulas: Nagaoka and Wheeler for single-layer coils with the Rosa/Grover/Lundin wire correction, Wheeler multilayer, catalogue AL for toroids, Mohan et al. for planar spirals. Estimates only; coil shape, nearby metal and the winding method change real values. Everything runs in your browser.')}{' '}
        <a href={REPO} target="_blank" rel="noreferrer">{t('Source on GitHub')}</a>
      </footer>
    </div>
  )
}
