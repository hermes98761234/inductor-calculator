import type { MultilayerIn, PcbIn, SolenoidIn, ToroidIn } from './calc'
import { LEN_UNITS, type LenUnit } from './units'

export type Lang = 'en' | 'uk'
export type Theme = 'auto' | 'light' | 'dark'
export type Tab = 'solenoid' | 'multilayer' | 'toroid' | 'pcb' | 'wire'
export type WireTab = 'solenoid' | 'multilayer' | 'toroid'
export const TABS: Tab[] = ['solenoid', 'multilayer', 'toroid', 'pcb', 'wire']

export interface Settings {
  lang: Lang
  theme: Theme
  unit: LenUnit
}

export interface AppState {
  tab: Tab
  settings: Settings
  /** Bare wire diameter for each winding tab, mm. */
  wires: Record<WireTab, number>
  preset: Record<Tab, string>
  sol: SolenoidIn
  ml: MultilayerIn
  tor: ToroidIn
  pcb: PcbIn
}

const KEY = 'inductor-calculator:v1'

export function defaultLang(): Lang {
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('uk') ? 'uk' : 'en'
}

export const DEFAULT_SOL: SolenoidIn = { mode: 'calc', method: 'nagaoka', N: 10, formerD: 24.4, spacing: 'pitch', pitch: 2.54, length: 25.4, targetUH: 5, fMHz: 10 }
export const DEFAULT_ML: MultilayerIn = { mode: 'inverse', N: 200, formerD: 10, length: 15, targetUH: 1000 }
export const DEFAULT_TOR: ToroidIn = { mode: 'inverse', core: 'T50', mix: '2', N: 20, targetUH: 2.2, current: 1 }
export const DEFAULT_PCB: PcbIn = { mode: 'calc', shape: 'square', n: 6, dout: 12, w: 0.3, s: 0.2, oz: 1, targetNH: 200, fMHz: 10 }

export const defaultState = (): AppState => ({
  tab: 'solenoid',
  settings: { lang: defaultLang(), theme: 'auto', unit: 'mm' },
  wires: { solenoid: 1, multilayer: 0.25, toroid: 0.64 },
  preset: { solenoid: 'classic', multilayer: 'choke1mH', toroid: 'lpf', pcb: 'default', wire: '' },
  sol: { ...DEFAULT_SOL },
  ml: { ...DEFAULT_ML },
  tor: { ...DEFAULT_TOR },
  pcb: { ...DEFAULT_PCB },
})

/** Keeps only stored values whose type matches the default, so stale data cannot break the app. */
function mergeTyped<T extends object>(base: T, stored: unknown): T {
  const out = { ...base } as Record<string, unknown>
  if (stored && typeof stored === 'object') {
    for (const [k, d] of Object.entries(base)) {
      const v = (stored as Record<string, unknown>)[k]
      if (typeof d === 'number' ? typeof v === 'number' && Number.isFinite(v) : typeof v === typeof d) out[k] = v
    }
  }
  return out as T
}

export function sanitize(raw: unknown): AppState {
  const base = defaultState()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Record<string, unknown>
  const st = (r.settings ?? {}) as Partial<Settings>
  const s: AppState = {
    tab: TABS.includes(r.tab as Tab) ? (r.tab as Tab) : base.tab,
    settings: {
      lang: st.lang === 'uk' || st.lang === 'en' ? st.lang : base.settings.lang,
      theme: st.theme === 'light' || st.theme === 'dark' || st.theme === 'auto' ? st.theme : 'auto',
      unit: LEN_UNITS.includes(st.unit as LenUnit) ? (st.unit as LenUnit) : 'mm',
    },
    wires: mergeTyped(base.wires, r.wires),
    preset: mergeTyped(base.preset, r.preset),
    sol: mergeTyped(base.sol, r.sol),
    ml: mergeTyped(base.ml, r.ml),
    tor: mergeTyped(base.tor, r.tor),
    pcb: mergeTyped(base.pcb, r.pcb),
  }
  const pick = <T extends string>(v: T, ok: T[], d: T): T => (ok.includes(v) ? v : d)
  for (const k of Object.keys(s.wires) as WireTab[]) if (!(s.wires[k] > 0 && s.wires[k] < 50)) s.wires[k] = base.wires[k]
  s.sol.mode = pick(s.sol.mode, ['calc', 'inverse'], 'calc')
  s.sol.method = pick(s.sol.method, ['nagaoka', 'wheeler'], 'nagaoka')
  s.sol.spacing = pick(s.sol.spacing, ['close', 'pitch', 'length'], 'pitch')
  s.ml.mode = pick(s.ml.mode, ['calc', 'inverse'], 'inverse')
  s.tor.mode = pick(s.tor.mode, ['calc', 'inverse'], 'inverse')
  s.pcb.mode = pick(s.pcb.mode, ['calc', 'inverse'], 'calc')
  s.pcb.shape = pick(s.pcb.shape, ['square', 'hexagon', 'octagon', 'circle'], 'square')
  return s
}

export function loadState(): AppState {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return defaultState()
  }
}

export function saveState(s: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable */
  }
}

/** Positive-number checks used to grey out results while a field is empty or zero. */
export function invalidFields(s: AppState): Set<string> {
  const bad = new Set<string>()
  const pos = (k: string, v: number) => {
    if (!(v > 0)) bad.add(k)
  }
  for (const k of Object.keys(s.wires) as WireTab[]) pos('wire.' + k, s.wires[k])
  pos('sol.formerD', s.sol.formerD)
  pos('sol.fMHz', s.sol.fMHz)
  if (s.sol.mode === 'calc') pos('sol.N', s.sol.N)
  else pos('sol.targetUH', s.sol.targetUH)
  if (s.sol.spacing === 'pitch') pos('sol.pitch', s.sol.pitch)
  if (s.sol.spacing === 'length') pos('sol.length', s.sol.length)
  pos('ml.formerD', s.ml.formerD)
  pos('ml.length', s.ml.length)
  if (s.ml.mode === 'calc') pos('ml.N', s.ml.N)
  else pos('ml.targetUH', s.ml.targetUH)
  if (s.tor.mode === 'calc') pos('tor.N', s.tor.N)
  else pos('tor.targetUH', s.tor.targetUH)
  if (!(s.tor.current >= 0)) bad.add('tor.current')
  for (const k of ['dout', 'w', 's', 'oz', 'fMHz'] as const) pos('pcb.' + k, s.pcb[k])
  if (s.pcb.mode === 'calc') pos('pcb.n', s.pcb.n)
  else pos('pcb.targetNH', s.pcb.targetNH)
  return bad
}
