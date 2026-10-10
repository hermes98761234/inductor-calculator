import { useId, useState } from 'react'

interface Props {
  label: string
  value: number
  onChange: (v: number) => void
  bad?: boolean
  step?: number | 'any'
  /** Optional unit selector shown next to the input. */
  unit?: { value: string; options: readonly string[]; onChange: (u: string) => void }
  /** Static unit text when there is nothing to choose. */
  suffix?: string
  title?: string
}

/** Number input that lets the user type freely ("-", "1.", empty) and commits only valid numbers. */
export default function NumberField({ label, value, onChange, bad, step = 'any', unit, suffix, title }: Props) {
  const id = useId()
  // While the user is typing, show their raw text; otherwise mirror the value.
  const [editing, setEditing] = useState<string | null>(null)
  const text = editing ?? String(value)
  return (
    <div className="field" title={title}>
      <label htmlFor={id}>{label}</label>
      <div className="inline">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          className={bad ? 'bad' : undefined}
          value={text}
          onChange={(e) => {
            setEditing(e.target.value)
            const n = e.target.valueAsNumber
            if (Number.isFinite(n)) onChange(n)
          }}
          onBlur={() => setEditing(null)}
        />
        {unit && (
          <select aria-label={label} value={unit.value} onChange={(e) => unit.onChange(e.target.value)}>
            {unit.options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        )}
        {suffix && <span className="suffix">{suffix}</span>}
      </div>
    </div>
  )
}
