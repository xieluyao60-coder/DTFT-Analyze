const SVG_WIDTH = 820
const SVG_HEIGHT = 320
const PADDING = { top: 22, right: 18, bottom: 48, left: 60 }

function createTicks(min, max, count) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return []
  }

  if (Math.abs(max - min) < 1e-9) {
    return [min]
  }

  return Array.from({ length: count }, (_, index) => {
    const ratio = index / (count - 1)
    return min + (max - min) * ratio
  })
}

function normalizeDomain(values, includeZero) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  let domainMin = includeZero ? Math.min(0, min) : min
  let domainMax = includeZero ? Math.max(0, max) : max

  if (Math.abs(domainMax - domainMin) < 1e-9) {
    const pad = Math.abs(domainMax || 1) * 0.2
    domainMin -= pad
    domainMax += pad
  } else {
    const padding = (domainMax - domainMin) * 0.12
    domainMin -= padding
    domainMax += padding
  }

  return { min: domainMin, max: domainMax }
}

function mapValue(value, min, max, start, end) {
  if (Math.abs(max - min) < 1e-9) {
    return (start + end) / 2
  }

  const ratio = (value - min) / (max - min)
  return start + ratio * (end - start)
}

function buildPolyline(points, xDomain, yDomain) {
  return points
    .map((point) => {
      const x = mapValue(
        point.x,
        xDomain.min,
        xDomain.max,
        PADDING.left,
        SVG_WIDTH - PADDING.right,
      )
      const y = mapValue(
        point.y,
        yDomain.min,
        yDomain.max,
        SVG_HEIGHT - PADDING.bottom,
        PADDING.top,
      )
      return `${x},${y}`
    })
    .join(' ')
}

function PlotCard({
  title,
  subtitle,
  data,
  mode,
  stroke,
  xLabel,
  yLabel,
  xFormatter,
  yFormatter,
}) {
  const hasData = data.length > 0

  if (!hasData) {
    return (
      <section className="panel plot-card">
        <div className="panel__header">
          <div>
            <p className="eyebrow">{subtitle}</p>
            <h2>{title}</h2>
          </div>
        </div>
        <div className="plot-card__empty">暂无可视化数据</div>
      </section>
    )
  }

  const xDomain = normalizeDomain(
    data.map((point) => point.x),
    false,
  )
  const yDomain = normalizeDomain(
    data.map((point) => point.y),
    true,
  )
  const xTicks = createTicks(xDomain.min, xDomain.max, 6)
  const yTicks = createTicks(yDomain.min, yDomain.max, 5)
  const baselineY = mapValue(
    0,
    yDomain.min,
    yDomain.max,
    SVG_HEIGHT - PADDING.bottom,
    PADDING.top,
  )
  const polylinePoints = buildPolyline(data, xDomain, yDomain)

  return (
    <section className="panel plot-card">
      <div className="panel__header">
        <div>
          <p className="eyebrow">{subtitle}</p>
          <h2>{title}</h2>
        </div>
      </div>

      <div className="plot-frame">
        <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} role="img" aria-label={title}>
          <rect
            x="0"
            y="0"
            width={SVG_WIDTH}
            height={SVG_HEIGHT}
            rx="24"
            fill="var(--plot-bg)"
          />

          {xTicks.map((tick) => {
            const x = mapValue(
              tick,
              xDomain.min,
              xDomain.max,
              PADDING.left,
              SVG_WIDTH - PADDING.right,
            )

            return (
              <g key={`x-grid-${tick}`}>
                <line
                  x1={x}
                  y1={PADDING.top}
                  x2={x}
                  y2={SVG_HEIGHT - PADDING.bottom}
                  className="plot-grid-line"
                />
                <text x={x} y={SVG_HEIGHT - 22} textAnchor="middle" className="plot-tick">
                  {xFormatter(tick)}
                </text>
              </g>
            )
          })}

          {yTicks.map((tick) => {
            const y = mapValue(
              tick,
              yDomain.min,
              yDomain.max,
              SVG_HEIGHT - PADDING.bottom,
              PADDING.top,
            )

            return (
              <g key={`y-grid-${tick}`}>
                <line
                  x1={PADDING.left}
                  y1={y}
                  x2={SVG_WIDTH - PADDING.right}
                  y2={y}
                  className="plot-grid-line"
                />
                <text x={18} y={y + 4} className="plot-tick">
                  {yFormatter(tick)}
                </text>
              </g>
            )
          })}

          <line
            x1={PADDING.left}
            y1={baselineY}
            x2={SVG_WIDTH - PADDING.right}
            y2={baselineY}
            className="plot-axis-line plot-axis-line--strong"
          />
          <line
            x1={PADDING.left}
            y1={PADDING.top}
            x2={PADDING.left}
            y2={SVG_HEIGHT - PADDING.bottom}
            className="plot-axis-line"
          />

          {mode === 'line' ? (
            <>
              <polyline
                points={polylinePoints}
                fill="none"
                stroke={stroke}
                strokeWidth="3.25"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {data.map((point) => {
                const cx = mapValue(
                  point.x,
                  xDomain.min,
                  xDomain.max,
                  PADDING.left,
                  SVG_WIDTH - PADDING.right,
                )
                const cy = mapValue(
                  point.y,
                  yDomain.min,
                  yDomain.max,
                  SVG_HEIGHT - PADDING.bottom,
                  PADDING.top,
                )

                return (
                  <circle
                    key={`point-${point.x}`}
                    cx={cx}
                    cy={cy}
                    r="2.6"
                    fill={stroke}
                    opacity="0.95"
                  />
                )
              })}
            </>
          ) : (
            data.map((point) => {
              const x = mapValue(
                point.x,
                xDomain.min,
                xDomain.max,
                PADDING.left,
                SVG_WIDTH - PADDING.right,
              )
              const y = mapValue(
                point.y,
                yDomain.min,
                yDomain.max,
                SVG_HEIGHT - PADDING.bottom,
                PADDING.top,
              )

              return (
                <g key={`stem-${point.x}`}>
                  <line
                    x1={x}
                    y1={baselineY}
                    x2={x}
                    y2={y}
                    stroke={stroke}
                    strokeWidth="2.25"
                    strokeLinecap="round"
                  />
                  <circle cx={x} cy={y} r="4.8" fill={stroke} />
                </g>
              )
            })
          )}

          <text
            x={(PADDING.left + SVG_WIDTH - PADDING.right) / 2}
            y={SVG_HEIGHT - 8}
            textAnchor="middle"
            className="plot-axis-label"
          >
            {xLabel}
          </text>
          <text
            x="18"
            y={(PADDING.top + SVG_HEIGHT - PADDING.bottom) / 2}
            transform={`rotate(-90, 18, ${(PADDING.top + SVG_HEIGHT - PADDING.bottom) / 2})`}
            textAnchor="middle"
            className="plot-axis-label"
          >
            {yLabel}
          </text>
        </svg>
      </div>
    </section>
  )
}

export default PlotCard
