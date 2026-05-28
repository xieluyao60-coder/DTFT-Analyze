export const TWO_PI = Math.PI * 2

export function round2(value) {
  if (!Number.isFinite(value)) {
    return 0
  }

  const rounded = Math.round((value + Number.EPSILON) * 100) / 100
  return Object.is(rounded, -0) ? 0 : rounded
}

export function formatDisplayNumber(value) {
  const rounded = round2(value)

  if (Number.isInteger(rounded)) {
    return String(rounded)
  }

  return rounded.toFixed(2).replace(/\.?0+$/, '')
}

export function formatOmegaLabel(value) {
  const rounded = round2(value)
  const ratio = rounded / Math.PI

  if (Math.abs(ratio) < 0.05) {
    return '0'
  }

  if (Math.abs(Math.abs(ratio) - 1) < 0.05) {
    return rounded < 0 ? '-π' : 'π'
  }

  if (Math.abs(Math.abs(ratio) - 0.5) < 0.05) {
    return rounded < 0 ? '-π/2' : 'π/2'
  }

  return formatDisplayNumber(rounded)
}

export function buildIntegerRange(start, end) {
  const size = end - start + 1
  return Array.from({ length: size }, (_, index) => start + index)
}

export function buildFrequencyRange(start, end, sampleCount) {
  if (sampleCount <= 1) {
    return [start]
  }

  return Array.from({ length: sampleCount }, (_, index) => {
    const ratio = index / (sampleCount - 1)
    return start + (end - start) * ratio
  })
}

export function sanitizeRangeSettings(settings) {
  const boundedNMin = Math.max(-80, Math.min(79, Math.round(settings.nMin)))
  const boundedNMax = Math.max(-79, Math.min(80, Math.round(settings.nMax)))
  const nMin = Math.min(boundedNMin, boundedNMax - 1)
  const nMax = Math.max(boundedNMax, nMin + 1)
  const omegaMin = Math.max(-TWO_PI, Math.min(TWO_PI - 0.1, settings.omegaMin))
  const omegaMax = Math.max(
    omegaMin + 0.1,
    Math.min(TWO_PI, settings.omegaMax),
  )
  const omegaSamples = Math.max(64, Math.min(1024, Math.round(settings.omegaSamples)))

  return {
    nMin,
    nMax,
    omegaMin,
    omegaMax,
    omegaSamples,
  }
}

function impulse(n) {
  return n === 0 ? 1 : 0
}

function step(n) {
  return n >= 0 ? 1 : 0
}

function rectangular(n, width) {
  return n >= 0 && n <= width - 1 ? 1 : 0
}

function exponential(n, a) {
  return n >= 0 ? Math.pow(a, n) : 0
}

function triangular(n, width) {
  const distance = Math.abs(n)
  return distance > width ? 0 : round2(1 - distance / (width + 1))
}

function delayedImpulse(n, delay) {
  return n === delay ? 1 : 0
}

export const SEQUENCE_PRESETS = [
  {
    id: 'impulse',
    name: '单位冲激序列',
    shortFormula: 'δ[n]',
    description: '仅在 n = 0 处取 1，其他位置为 0。',
    badge: '基础',
    formula: () => 'δ[n]',
    theory: 'X(e^{jω}) = 1',
    analysisNote: '该序列 DTFT 为常数，图中结果与理论完全一致。',
    parameters: [],
    defaultParams: {},
    generator: (n) => impulse(n),
  },
  {
    id: 'step',
    name: '单位阶跃序列',
    shortFormula: 'u[n]',
    description: 'n ≥ 0 时取 1，其余为 0。',
    badge: '无限长',
    formula: () => 'u[n]',
    theory: '广义意义下含有奇异项；界面中按当前 n 范围做数值 DTFT。',
    analysisNote: '为保持教学可视化，当前采用截断样本的数值 DTFT。',
    parameters: [],
    defaultParams: {},
    generator: (n) => step(n),
  },
  {
    id: 'rect',
    name: '矩形序列',
    shortFormula: 'rectN[n]',
    description: '0 ≤ n ≤ N - 1 时取 1，其余为 0。',
    badge: '有限长',
    formula: (params) => `rect[n], N = ${formatDisplayNumber(params.N)}`,
    theory: (params) =>
      `X(e^{jω}) = e^{-jω(${formatDisplayNumber(params.N)}-1)/2} · sin(${formatDisplayNumber(params.N)}ω/2) / sin(ω/2)`,
    analysisNote: '有限长序列，当前频谱与理论离散求和完全对应。',
    parameters: [
      { key: 'N', label: '宽度 N', min: 1, max: 20, step: 1 },
    ],
    defaultParams: { N: 6 },
    generator: (n, params) => rectangular(n, Math.round(params.N)),
  },
  {
    id: 'exp',
    name: '实指数序列',
    shortFormula: 'a^n u[n]',
    description: '|a| < 1 时为衰减指数序列。',
    badge: '常用',
    formula: (params) => `${formatDisplayNumber(params.a)}^n · u[n]`,
    theory: (params) =>
      `|a| < 1 时，X(e^{jω}) = 1 / (1 - ${formatDisplayNumber(params.a)}e^{-jω})`,
    analysisNote: '图中展示当前 n 范围的数值 DTFT，便于与时域截断结果联动。',
    parameters: [
      { key: 'a', label: '指数底数 a', min: -0.95, max: 0.95, step: 0.05 },
    ],
    defaultParams: { a: 0.8 },
    generator: (n, params) => exponential(n, params.a),
  },
  {
    id: 'tri',
    name: '三角序列',
    shortFormula: 'triN[n]',
    description: '中心对称有限长三角序列。',
    badge: '扩展',
    formula: (params) => `tri[n], N = ${formatDisplayNumber(params.N)}`,
    theory: '有限长序列，可直接按定义进行 DTFT 数值求和。',
    analysisNote: '适合观察有限支撑序列的主瓣和旁瓣变化。',
    parameters: [
      { key: 'N', label: '半宽 N', min: 2, max: 12, step: 1 },
    ],
    defaultParams: { N: 5 },
    generator: (n, params) => triangular(n, Math.round(params.N)),
  },
  {
    id: 'delay',
    name: '延时冲激序列',
    shortFormula: 'δ[n-k]',
    description: '通过 k 控制冲激出现的位置。',
    badge: '移位',
    formula: (params) => `δ[n - ${formatDisplayNumber(params.k)}]`,
    theory: (params) => `X(e^{jω}) = e^{-jω${formatDisplayNumber(params.k)}}`,
    analysisNote: '可直接观察时域移位对应的频域相位变化。',
    parameters: [
      { key: 'k', label: '延时 k', min: -12, max: 12, step: 1 },
    ],
    defaultParams: { k: 3 },
    generator: (n, params) => delayedImpulse(n, Math.round(params.k)),
  },
]

export function getDefaultSequenceParams() {
  return SEQUENCE_PRESETS.reduce((collection, preset) => {
    collection[preset.id] = { ...preset.defaultParams }
    return collection
  }, {})
}

export function getPresetById(presetId) {
  return (
    SEQUENCE_PRESETS.find((preset) => preset.id === presetId) ?? SEQUENCE_PRESETS[0]
  )
}

export function computeNumericDtft(samples, omegaValues) {
  return omegaValues.map((omega) => {
    let real = 0
    let imag = 0

    samples.forEach((sample) => {
      real += sample.value * Math.cos(omega * sample.n)
      imag -= sample.value * Math.sin(omega * sample.n)
    })

    const magnitude = Math.sqrt(real * real + imag * imag)
    const phase = magnitude < 0.01 ? 0 : Math.atan2(imag, real)

    return {
      omega: round2(omega),
      real: round2(real),
      imag: round2(imag),
      magnitude: round2(magnitude),
      phase: round2(phase),
    }
  })
}

export function buildSummaryMetrics(samples, spectrum) {
  const nonZeroCount = samples.filter((sample) => Math.abs(sample.value) > 0.001).length
  const maxAmplitude = Math.max(...samples.map((sample) => Math.abs(sample.value)))
  const maxMagnitude = Math.max(...spectrum.map((item) => item.magnitude))
  const energy = samples.reduce((sum, sample) => sum + sample.value * sample.value, 0)
  const phaseSpread =
    spectrum.length === 0
      ? 0
      : Math.max(...spectrum.map((item) => item.phase)) -
        Math.min(...spectrum.map((item) => item.phase))

  return [
    { label: '非零样本数', value: formatDisplayNumber(nonZeroCount) },
    { label: '最大 |x[n]|', value: formatDisplayNumber(maxAmplitude) },
    { label: '最大 |X|', value: formatDisplayNumber(maxMagnitude) },
    { label: '样本能量', value: formatDisplayNumber(energy) },
    { label: '相位跨度', value: `${formatDisplayNumber(phaseSpread)} rad` },
  ]
}
