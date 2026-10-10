import { multilayerL } from './air'

export interface MultilayerGeom {
  turnsPerLayer: number
  layers: number
  /** Radial build of the winding, metres. */
  build: number
  /** Mean radius of the winding, metres. */
  meanRadius: number
}

/** Layer-wound geometry for N turns of wire (insulated diameter dIns) on a former over a winding length. */
export function multilayerGeom(N: number, formerD: number, length: number, dIns: number): MultilayerGeom {
  const turnsPerLayer = Math.max(1, Math.floor(length / dIns + 1e-9))
  const layers = Math.max(1, Math.ceil(N / turnsPerLayer - 1e-9))
  const build = layers * dIns
  return { turnsPerLayer, layers, build, meanRadius: formerD / 2 + build / 2 }
}

export function multilayerInductance(N: number, formerD: number, length: number, dIns: number): number {
  const g = multilayerGeom(N, formerD, length, dIns)
  return multilayerL(N, g.meanRadius, length, g.build)
}
