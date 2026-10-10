import NumberField from './NumberField'
import { clean, mmToUnit, unitToMm, type LenUnit } from '../lib/units'

interface Props {
  label: string
  /** Value in millimetres. */
  mm: number
  onChange: (mm: number) => void
  unit: LenUnit
  bad?: boolean
  title?: string
}

/** Number field whose value is stored in mm but shown in the user's chosen length unit. */
export default function LenField({ label, mm, onChange, unit, bad, title }: Props) {
  return <NumberField label={label} value={clean(mmToUnit(mm, unit))} onChange={(v) => onChange(unitToMm(v, unit))} bad={bad} suffix={unit} title={title} />
}
