import type { MultilayerIn, PcbIn, SolenoidIn, ToroidIn } from './calc'
import type { Tab } from './model'

export interface Preset<T> {
  id: string
  name: string
  patch: Partial<T>
  wire?: number
}

export const SOL_PRESETS: Preset<SolenoidIn>[] = [
  { id: 'classic', name: 'Classic 1 inch coil, 10 turns', wire: 1, patch: { mode: 'calc', N: 10, formerD: 24.4, spacing: 'pitch', pitch: 2.54, fMHz: 10 } },
  { id: 'hf', name: 'HF tank coil, 10 µH on 25 mm', wire: 1.024, patch: { mode: 'inverse', targetUH: 10, formerD: 25, spacing: 'close', fMHz: 7 } },
  { id: 'vhf', name: 'VHF air coil, 100 nH', wire: 0.812, patch: { mode: 'inverse', targetUH: 0.1, formerD: 6, spacing: 'pitch', pitch: 1.5, fMHz: 145 } },
  { id: 'loading', name: 'Loading coil, 100 µH on 50 mm pipe', wire: 1.291, patch: { mode: 'inverse', targetUH: 100, formerD: 50, spacing: 'close', fMHz: 3.7 } },
]

export const ML_PRESETS: Preset<MultilayerIn>[] = [
  { id: 'choke1mH', name: 'RF choke, 1 mH', wire: 0.25, patch: { mode: 'inverse', targetUH: 1000, formerD: 10, length: 15 } },
  { id: 'choke100', name: 'Choke, 100 µH on 8 mm', wire: 0.3, patch: { mode: 'inverse', targetUH: 100, formerD: 8, length: 12 } },
  { id: 'bobbin', name: 'Bobbin coil, 300 turns', wire: 0.4, patch: { mode: 'calc', N: 300, formerD: 12, length: 20 } },
]

export const TOR_PRESETS: Preset<ToroidIn>[] = [
  { id: 'lpf', name: 'Low-pass filter coil, 2.2 µH on T50-2', wire: 0.64, patch: { mode: 'inverse', core: 'T50', mix: '2', targetUH: 2.2, current: 1 } },
  { id: 'tuner', name: 'Antenna tuner roller coil, 20 µH on T200-2', wire: 1.29, patch: { mode: 'inverse', core: 'T200', mix: '2', targetUH: 20, current: 2 } },
  { id: 'choke43', name: 'Mains choke, 100 µH on FT140-43', wire: 0.8, patch: { mode: 'inverse', core: 'FT140', mix: '43', targetUH: 100, current: 1 } },
  { id: 'pwr', name: 'DC-DC filter, 22 µH on T106-26', wire: 0.81, patch: { mode: 'inverse', core: 'T106', mix: '26', targetUH: 22, current: 3 } },
]

export const PCB_PRESETS: Preset<PcbIn>[] = [
  { id: 'default', name: 'Square spiral, 6 turns, 12 mm', patch: { mode: 'calc', shape: 'square', n: 6, dout: 12, w: 0.3, s: 0.2, oz: 1, fMHz: 10 } },
  { id: 'rf20', name: 'RF matching spiral, about 20 nH', patch: { mode: 'inverse', shape: 'square', targetNH: 20, dout: 3, w: 0.2, s: 0.15, oz: 1, fMHz: 500 } },
  { id: 'coil1u', name: 'Planar coil, 1 µH in 30 mm', patch: { mode: 'inverse', shape: 'octagon', targetNH: 1000, dout: 30, w: 0.5, s: 0.3, oz: 2, fMHz: 1 } },
]

export const PRESETS_BY_TAB: Record<Exclude<Tab, 'wire'>, Preset<never>[]> = {
  solenoid: SOL_PRESETS as Preset<never>[],
  multilayer: ML_PRESETS as Preset<never>[],
  toroid: TOR_PRESETS as Preset<never>[],
  pcb: PCB_PRESETS as Preset<never>[],
}
