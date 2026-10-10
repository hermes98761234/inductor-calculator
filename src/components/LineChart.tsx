export interface ChartSeries {
  id: string
  color: string
  pts: [number, number][]
}

interface Props {
  series: ChartSeries[]
  xLabel: string
  yLabel: string
  xLog?: boolean
  /** Formats y tick values, e.g. as inductance. */
  yFmt: (v: number) => string
  xFmt?: (v: number) => string
  /** Highlighted operating point. */
  marker?: [number, number]
  title: string
}

const W = 760
const H = 300
const M = { l: 62, r: 14, t: 12, b: 38 }

function niceTicks(lo: number, hi: number, count = 5): number[] {
  const span = hi - lo || Math.abs(hi) || 1
  const raw = span / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag
  const out: number[] = []
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(Number(v.toPrecision(12)))
  return out
}

function logTicks(lo: number, hi: number): number[] {
  const out: number[] = []
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) {
    for (const m of [1, 2, 5]) {
      const v = m * Math.pow(10, e)
      if (v >= lo * 0.999 && v <= hi * 1.001) out.push(v)
    }
  }
  return out
}

export default function LineChart({ series, xLabel, yLabel, xLog, yFmt, xFmt = (v) => String(+v.toPrecision(3)), marker, title }: Props) {
  const pts = series.flatMap((s) => s.pts).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && (!xLog || x > 0))
  if (pts.length < 2) return null
  let x0 = Math.min(...pts.map((p) => p[0]))
  let x1 = Math.max(...pts.map((p) => p[0]))
  if (x1 === x0) x1 = x0 + 1
  const yMax = Math.max(...pts.map((p) => p[1]), marker?.[1] ?? 0) * 1.05
  const yTicks = niceTicks(0, yMax)
  if (yTicks.length > 1 && yTicks[yTicks.length - 1] < yMax) yTicks.push(Number((2 * yTicks[yTicks.length - 1] - yTicks[yTicks.length - 2]).toPrecision(12)))
  const y1 = yTicks[yTicks.length - 1] || yMax
  const xTicks = xLog ? logTicks(x0, x1) : niceTicks(x0, x1)
  if (!xLog) {
    x0 = Math.min(x0, xTicks[0] ?? x0)
    x1 = Math.max(x1, xTicks[xTicks.length - 1] ?? x1)
  }
  const sx = (x: number) => M.l + ((xLog ? Math.log(x / x0) / Math.log(x1 / x0) : (x - x0) / (x1 - x0)) * (W - M.l - M.r))
  const sy = (y: number) => H - M.b - (y / y1) * (H - M.t - M.b)
  const path = (p: [number, number][]) => p.map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join('')
  return (
    <div className="chart-scroll">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        <title>{title}</title>
        {yTicks.map((v) => (
          <g key={'y' + v}>
            <line className="gridline" x1={M.l} x2={W - M.r} y1={sy(v)} y2={sy(v)} />
            <text className="axis" x={M.l - 6} y={sy(v) + 3.5} textAnchor="end">{yFmt(v)}</text>
          </g>
        ))}
        {xTicks.map((v) => (
          <g key={'x' + v}>
            <line className="gridline" x1={sx(v)} x2={sx(v)} y1={M.t} y2={H - M.b} />
            <text className="axis" x={sx(v)} y={H - M.b + 14} textAnchor="middle">{xFmt(v)}</text>
          </g>
        ))}
        <line className="gridline strong" x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} />
        <line className="gridline strong" x1={M.l} x2={M.l} y1={M.t} y2={H - M.b} />
        <text className="axis" x={(M.l + W - M.r) / 2} y={H - 4} textAnchor="middle">{xLabel}</text>
        <text className="axis" transform={`translate(12 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle">{yLabel}</text>
        {series.map((s) => (
          <path key={s.id} className="curve" d={path(s.pts.filter(([x, y]) => Number.isFinite(y) && (!xLog || x > 0)))} style={{ stroke: s.color }} />
        ))}
        {marker && (
          <g>
            <line className="mark-line" x1={sx(marker[0])} x2={sx(marker[0])} y1={M.t} y2={H - M.b} />
            <circle cx={sx(marker[0])} cy={sy(marker[1])} r={4.5} fill="var(--warn)" stroke="var(--chart-bg)" strokeWidth={1.5} />
          </g>
        )}
      </svg>
    </div>
  )
}
