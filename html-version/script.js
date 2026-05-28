(function () {
  const EPS = 1e-9
  const TAU = Math.PI * 2
  const CUSTOM_KEY = '__custom__'
  const UPLOAD_KEY = '__upload__'
  const MAX_UPLOAD_SAMPLES = 256

  const DISCRETE_DEFAULT_RANGE = {
    nMin: -8,
    nMax: 18,
    omegaMin: -Math.PI,
    omegaMax: Math.PI,
    omegaSamples: 256,
  }

  const SAMPLING_DEFAULT_RANGE = {
    tMin: -2,
    tMax: 2,
    fs: 8,
    denseSamples: 600,
  }

  const Z_DEFAULT_RANGE = {
    nMin: 0,
    nMax: 24,
    omegaMin: -Math.PI,
    omegaMax: Math.PI,
    omegaSamples: 256,
    xMin: -1.6,
    xMax: 1.6,
    yMin: -1.6,
    yMax: 1.6,
  }

  const DISCRETE_HELP =
    '可用函数：delta(x)、u(x)、rect(x, N)、tri(x, N)、expseq(a, x)、sinseq(ω0, x, φ)、cosseq(ω0, x, φ)、abs(x)、pow(a, b)、sqrt(x)、pi。支持加减乘除与括号。'
  const SAMPLING_HELP =
    '可用函数：sin(x)、cos(x)、exp(x)、abs(x)、sqrt(x)、sinc(x)、gauss(t, σ)、pulse(t, T)、pi。自变量为 t，支持加减乘除与括号。'

  const DISCRETE_EXAMPLES = [
    'u(n) - u(n - 6) + 0.4 * delta(n - 8)',
    'rect(n, 8) - 0.5 * rect(n - 4, 4)',
    '0.9 * expseq(0.82, n) + 0.6 * sinseq(0.55, n)',
  ]

  const SAMPLING_EXAMPLES = [
    'sin(2*pi*0.8*t) + 0.35*cos(2*pi*1.6*t)',
    'exp(-0.9*abs(t)) * cos(2*pi*1.2*t)',
    'pulse(t, 1.2) + 0.6*gauss(t, 0.45)',
  ]

  const Z_EXAMPLES = [
    { numerator: '1', denominator: '1, -0.78' },
    { numerator: '1, 0, -1', denominator: '1, -1.42, 0.81' },
    { numerator: '1, -0.8, 0.3', denominator: '1, -0.4' },
  ]

  const discretePresets = [
    {
      id: 'impulse',
      name: '单位冲激序列',
      badge: '基础',
      formulaLabel: 'δ[n]',
      description: '仅在 n = 0 处取 1，其余位置为 0。',
      parameters: [],
      defaults: {},
      build() {
        return {
          title: '单位冲激序列',
          formula: 'x[n] = δ[n]',
          theory: 'X(e^{jω}) = 1，幅频恒为 1，相频恒为 0。',
          note: '该序列常作为离散系统与卷积分析的基准输入。',
          generator(n) {
            return n === 0 ? 1 : 0
          },
        }
      },
    },
    {
      id: 'step',
      name: '单位阶跃序列',
      badge: '常用',
      formulaLabel: 'u[n]',
      description: 'n ≥ 0 时取 1，其余位置为 0。',
      parameters: [],
      defaults: {},
      build() {
        return {
          title: '单位阶跃序列',
          formula: 'x[n] = u[n]',
          theory: '严格意义下 DTFT 需结合广义函数；此处按当前 n 范围进行数值近似。',
          note: '当前图像展示的是所选范围内的截断样本与对应数值频谱。',
          generator(n) {
            return n >= 0 ? 1 : 0
          },
        }
      },
    },
    {
      id: 'rect',
      name: '矩形序列',
      badge: '有限长',
      formulaLabel: 'rect[n, N]',
      description: '0 ≤ n ≤ N - 1 时取 1，其余位置为 0。',
      parameters: [{ key: 'N', label: '宽度 N', min: 2, max: 20, step: 1 }],
      defaults: { N: 8 },
      build(params) {
        const N = Math.max(2, Math.round(params.N))
        return {
          title: '矩形序列',
          formula: `x[n] = rect[n, ${formatNumber(N)}]`,
          theory: `X(e^{jω}) 为有限长求和，主瓣宽度与 N 成反比，旁瓣振荡随 N 变化。`,
          note: '矩形序列适合观察时域截断与频域旁瓣之间的关系。',
          generator(n) {
            return n >= 0 && n <= N - 1 ? 1 : 0
          },
        }
      },
    },
    {
      id: 'exp',
      name: '实指数序列',
      badge: '衰减',
      formulaLabel: 'a^n u[n]',
      description: '|a| < 1 时为衰减指数序列。',
      parameters: [{ key: 'a', label: '底数 a', min: -0.95, max: 0.95, step: 0.05 }],
      defaults: { a: 0.82 },
      build(params) {
        const a = clamp(params.a, -0.95, 0.95)
        return {
          title: '实指数序列',
          formula: `x[n] = ${formatNumber(a)}^n u[n]`,
          theory: `|a| < 1 时，理论上 X(e^{jω}) = 1 / (1 - ${formatNumber(a)}e^{-jω})。`,
          note: '当 a 接近 1 时，幅频曲线主峰更集中；a 为负时相位会发生翻转。',
          generator(n) {
            return n >= 0 ? Math.pow(a, n) : 0
          },
        }
      },
    },
    {
      id: 'sin',
      name: '正弦型序列',
      badge: '周期',
      formulaLabel: 'A sin(ω0n + φ)',
      description: '典型离散正弦序列，可观察频谱尖峰位置。',
      parameters: [
        { key: 'A', label: '幅值 A', min: 0.2, max: 2, step: 0.1 },
        { key: 'w0', label: '角频率 ω0', min: 0.1, max: 2.8, step: 0.05 },
        { key: 'phi', label: '相位 φ', min: -3.14, max: 3.14, step: 0.1 },
      ],
      defaults: { A: 1, w0: 0.65, phi: 0 },
      build(params) {
        const A = Math.max(0.1, params.A)
        const w0 = clamp(params.w0, 0.05, 3.1)
        const phi = clamp(params.phi, -Math.PI, Math.PI)
        return {
          title: '正弦型序列',
          formula: `x[n] = ${formatNumber(A)}sin(${formatNumber(w0)}n + ${formatNumber(phi)})`,
          theory: '理想情况下频谱集中在 ±ω0 附近，当前图像受有限观察区间影响会出现谱泄漏。',
          note: '改变观察范围可直观看到窗长变化对谱线宽度与相位连续性的影响。',
          generator(n) {
            return A * Math.sin(w0 * n + phi)
          },
        }
      },
    },
  ]

  const samplingPresets = [
    {
      id: 'analog-sine',
      name: '连续正弦信号',
      badge: '基础',
      formulaLabel: 'A sin(2πft + φ)',
      description: '标准连续正弦波，用于演示采样与重构。',
      parameters: [
        { key: 'A', label: '幅值 A', min: 0.2, max: 2, step: 0.1 },
        { key: 'f', label: '频率 f', min: 0.2, max: 2, step: 0.05 },
        { key: 'phi', label: '相位 φ', min: -3.14, max: 3.14, step: 0.1 },
      ],
      defaults: { A: 1, f: 0.8, phi: 0 },
      build(params) {
        const A = Math.max(0.1, params.A)
        const f = Math.max(0.05, params.f)
        const phi = clamp(params.phi, -Math.PI, Math.PI)
        return {
          title: '连续正弦信号',
          formula: `x(t) = ${formatNumber(A)}sin(2π·${formatNumber(f)}t + ${formatNumber(phi)})`,
          theory: '采样频率高于 2f 时，线性插值与零阶保持均更容易逼近原信号。',
          note: '调高采样频率 fs 后，可明显减小重构误差。',
          nominalBandwidth: f,
          sourceFn(t) {
            return A * Math.sin(TAU * f * t + phi)
          },
        }
      },
    },
    {
      id: 'damped-sine',
      name: '阻尼正弦信号',
      badge: '衰减',
      formulaLabel: 'Ae^{-α|t|}cos(2πft)',
      description: '同时包含包络衰减与振荡信息。',
      parameters: [
        { key: 'A', label: '幅值 A', min: 0.2, max: 2, step: 0.1 },
        { key: 'alpha', label: '衰减 α', min: 0.1, max: 2, step: 0.05 },
        { key: 'f', label: '频率 f', min: 0.2, max: 2, step: 0.05 },
      ],
      defaults: { A: 1, alpha: 0.75, f: 1.1 },
      build(params) {
        const A = Math.max(0.1, params.A)
        const alpha = Math.max(0.05, params.alpha)
        const f = Math.max(0.05, params.f)
        return {
          title: '阻尼正弦信号',
          formula: `x(t) = ${formatNumber(A)}e^{-${formatNumber(alpha)}|t|}cos(2π·${formatNumber(f)}t)`,
          theory: '信号频率与包络衰减同时存在，采样过稀时易损失峰值细节。',
          note: '观察零阶保持与线性插值对衰减波包边缘的拟合差异。',
          nominalBandwidth: f,
          sourceFn(t) {
            return A * Math.exp(-alpha * Math.abs(t)) * Math.cos(TAU * f * t)
          },
        }
      },
    },
    {
      id: 'rect-pulse',
      name: '矩形脉冲信号',
      badge: '脉冲',
      formulaLabel: 'pulse(t, T)',
      description: '有限持续时间的连续矩形脉冲。',
      parameters: [{ key: 'T', label: '脉宽 T', min: 0.2, max: 2.5, step: 0.05 }],
      defaults: { T: 1.2 },
      build(params) {
        const T = Math.max(0.1, params.T)
        return {
          title: '矩形脉冲信号',
          formula: `x(t) = pulse(t, ${formatNumber(T)})`,
          theory: '边缘存在不连续点，零阶保持更接近“保持”效果，线性插值会引入斜坡过渡。',
          note: '矩形脉冲适合比较不同插值方法在跳变位置附近的重构形态。',
          nominalBandwidth: 1 / T,
          sourceFn(t) {
            return Math.abs(t) <= T / 2 ? 1 : 0
          },
        }
      },
    },
    {
      id: 'gaussian',
      name: '高斯脉冲',
      badge: '平滑',
      formulaLabel: 'Ae^{-(t/σ)^2}',
      description: '平滑连续脉冲，适合观察插值平滑性。',
      parameters: [
        { key: 'A', label: '幅值 A', min: 0.2, max: 2, step: 0.1 },
        { key: 'sigma', label: '宽度 σ', min: 0.15, max: 1.2, step: 0.05 },
      ],
      defaults: { A: 1, sigma: 0.45 },
      build(params) {
        const A = Math.max(0.1, params.A)
        const sigma = Math.max(0.05, params.sigma)
        return {
          title: '高斯脉冲',
          formula: `x(t) = ${formatNumber(A)}e^{-(t/${formatNumber(sigma)})^2}`,
          theory: '连续且平滑的信号在较低采样率下也通常具有更好的插值重构表现。',
          note: '该信号可直观看到线性插值对平滑波包的良好近似。',
          nominalBandwidth: 1 / Math.max(sigma, 0.15),
          sourceFn(t) {
            return A * Math.exp(-Math.pow(t / sigma, 2))
          },
        }
      },
    },
    {
      id: 'multi-tone',
      name: '多频组合信号',
      badge: '复合',
      formulaLabel: 'sin + cos',
      description: '低频与高频分量混合，更适合观察欠采样现象。',
      parameters: [
        { key: 'f1', label: '频率 f1', min: 0.2, max: 1.5, step: 0.05 },
        { key: 'f2', label: '频率 f2', min: 0.8, max: 2.5, step: 0.05 },
      ],
      defaults: { f1: 0.6, f2: 1.7 },
      build(params) {
        const f1 = Math.max(0.05, params.f1)
        const f2 = Math.max(0.1, params.f2)
        return {
          title: '多频组合信号',
          formula: `x(t) = sin(2π·${formatNumber(f1)}t) + 0.45cos(2π·${formatNumber(f2)}t)`,
          theory: '当采样频率不足时，高频分量更容易发生混叠与重构失真。',
          note: '建议拖动时域窗口并调整 fs，对比重构曲线与原始曲线的偏差。',
          nominalBandwidth: Math.max(f1, f2),
          sourceFn(t) {
            return Math.sin(TAU * f1 * t) + 0.45 * Math.cos(TAU * f2 * t)
          },
        }
      },
    },
  ]

  const zPresets = [
    {
      id: 'first-order',
      name: '一阶极点系统',
      badge: '单极点',
      formulaLabel: '1 / (1 - az^-1)',
      description: '典型一阶因果系统，便于观察单极点位置变化。',
      parameters: [{ key: 'a', label: '极点 a', min: -0.95, max: 0.95, step: 0.05 }],
      defaults: { a: 0.78 },
      build(params) {
        const a = clamp(params.a, -0.95, 0.95)
        return {
          title: '一阶极点系统',
          formula: `H(z) = 1 / (1 - ${formatNumber(a)}z^{-1})`,
          numerator: [1],
          denominator: [1, -a],
          roc: `因果实现时 ROC: |z| > ${formatNumber(Math.abs(a))}`,
          note: '极点越接近单位圆，频率响应主峰越尖锐，时域响应衰减越慢。',
        }
      },
    },
    {
      id: 'moving-average',
      name: '移动平均 FIR',
      badge: '零点组',
      formulaLabel: '(1/M)Σz^-k',
      description: '有限长 FIR 滤波器，展示单位圆上的零点分布。',
      parameters: [{ key: 'M', label: '长度 M', min: 2, max: 10, step: 1 }],
      defaults: { M: 5 },
      build(params) {
        const M = Math.max(2, Math.round(params.M))
        const numerator = Array.from({ length: M }, () => 1 / M)
        return {
          title: '移动平均 FIR',
          formula: `H(z) = (1/${formatNumber(M)})\\sum_{k=0}^{${formatNumber(M - 1)}} z^{-k}`,
          numerator,
          denominator: [1],
          roc: 'FIR 系统无有限极点，常按有限长序列进行零点分析。',
          note: '零点会落在单位圆上并均匀分布，z = 1 处除外。',
        }
      },
    },
    {
      id: 'resonator',
      name: '共轭极点谐振器',
      badge: '双极点',
      formulaLabel: '1 / (1 - 2r cosω0 z^-1 + r²z^-2)',
      description: '观察共轭极点随半径和角度变化带来的幅频峰值。',
      parameters: [
        { key: 'r', label: '极点半径 r', min: 0.2, max: 0.98, step: 0.02 },
        { key: 'w0', label: '角度 ω0', min: 0.2, max: 2.8, step: 0.05 },
      ],
      defaults: { r: 0.9, w0: 0.85 },
      build(params) {
        const r = clamp(params.r, 0.1, 0.98)
        const w0 = clamp(params.w0, 0.05, 3.1)
        return {
          title: '共轭极点谐振器',
          formula: `H(z) = 1 / (1 - 2·${formatNumber(r)}cos(${formatNumber(w0)})z^{-1} + ${formatNumber(r * r)}z^{-2})`,
          numerator: [1],
          denominator: [1, -2 * r * Math.cos(w0), r * r],
          roc: `因果实现时 ROC: |z| > ${formatNumber(r)}`,
          note: '极点越靠近单位圆，对应角频率附近的谐振峰越高且越窄。',
        }
      },
    },
    {
      id: 'notch',
      name: '陷波系统',
      badge: '零极对',
      formulaLabel: '(1 - 2cosω0 z^-1 + z^-2) / (...)',
      description: '零点位于单位圆，极点略收缩，可形成明显陷波。',
      parameters: [
        { key: 'r', label: '极点半径 r', min: 0.2, max: 0.98, step: 0.02 },
        { key: 'w0', label: '角度 ω0', min: 0.2, max: 2.8, step: 0.05 },
      ],
      defaults: { r: 0.88, w0: 1.1 },
      build(params) {
        const r = clamp(params.r, 0.1, 0.98)
        const w0 = clamp(params.w0, 0.05, 3.1)
        return {
          title: '陷波系统',
          formula: `H(z) = (1 - 2cos(${formatNumber(w0)})z^{-1} + z^{-2}) / (1 - 2·${formatNumber(r)}cos(${formatNumber(w0)})z^{-1} + ${formatNumber(r * r)}z^{-2})`,
          numerator: [1, -2 * Math.cos(w0), 1],
          denominator: [1, -2 * r * Math.cos(w0), r * r],
          roc: `因果实现时 ROC: |z| > ${formatNumber(r)}`,
          note: '零点位于单位圆上时，对应角频率附近会出现明显幅度衰减。',
        }
      },
    },
    {
      id: 'difference',
      name: '一阶差分器',
      badge: '零点',
      formulaLabel: '1 - z^-1',
      description: '在 z = 1 处存在零点，抑制直流分量。',
      parameters: [],
      defaults: {},
      build() {
        return {
          title: '一阶差分器',
          formula: 'H(z) = 1 - z^{-1}',
          numerator: [1, -1],
          denominator: [1],
          roc: 'FIR 系统无有限极点，可视为有限长离散序列的 Z 变换。',
          note: 'z = 1 处零点使其对低频特别是直流分量具有抑制作用。',
        }
      },
    },
  ]

  const extensionTopics = [
    {
      id: 'dfs',
      title: '周期序列的离散傅里叶级数（DFS）',
      description: '左侧按“文字一行 + 公式一行”的格式列出 DFS 定义与性质，右侧展示周期序列、DFS 系数及理论说明。',
      theory: [
        {
          text: 'DFS 分析式：对 N 周期离散序列，仅需一组长度为 N 的复指数系数即可刻画频域。',
          formula: 'C[k] = (1/N) &Sigma;<sub>n=0</sub><sup>N-1</sup> x[n]e<sup>-j2&pi;kn/N</sup>',
        },
        {
          text: 'DFS 合成式：时域序列可由一组离散频率指数基线性组合恢复。',
          formula: 'x[n] = &Sigma;<sub>k=0</sub><sup>N-1</sup> C[k]e<sup>j2&pi;kn/N</sup>',
        },
        {
          text: '周期性：时域与频域都满足 N 周期重复，因此只需保留一个主值周期。',
          formula: 'x[n + N] = x[n],&nbsp;&nbsp;C[k + N] = C[k]',
        },
        {
          text: '线性性质：线性组合在 DFS 域中仍保持线性叠加关系。',
          formula: 'ax<sub>1</sub>[n] + bx<sub>2</sub>[n] &harr; aC<sub>1</sub>[k] + bC<sub>2</sub>[k]',
        },
        {
          text: '圆周移位性质：主值序列的循环位移只会引入线性相位因子。',
          formula: 'x[(n-n<sub>0</sub>))<sub>N</sub>] &harr; C[k]e<sup>-j2&pi;kn<sub>0</sub>/N</sup>',
        },
        {
          text: '圆周卷积性质：时域 N 点圆周卷积对应 DFS 系数逐点相乘并乘上 N。',
          formula: 'x<sub>1</sub>[n] &otimes;<sub>N</sub> x<sub>2</sub>[n] &harr; N C<sub>1</sub>[k]C<sub>2</sub>[k]',
        },
      ],
    },
    {
      id: 'dft',
      title: '有限序列的离散傅里叶变换（DFT）',
      description: '左侧列出 DFT 定义、与其他变换的关系及性质；右侧给出关系流程图、圆周位移与圆周卷积步骤动画。',
      theory: [
        {
          text: 'DFT 定义：长度为 N 的有限序列在 N 个等间隔离散频率点上进行频域取样。',
          formula: 'X[k] = &Sigma;<sub>n=0</sub><sup>N-1</sup> x[n]e<sup>-j2&pi;kn/N</sup>',
        },
        {
          text: 'IDFT：长度为 N 的时域主值序列可由 N 个频域采样点精确恢复。',
          formula: 'x[n] = (1/N)&Sigma;<sub>k=0</sub><sup>N-1</sup> X[k]e<sup>j2&pi;kn/N</sup>',
        },
        {
          text: '与 DTFT 的关系：DFT 是 DTFT 在 &omega;<sub>k</sub> = 2&pi;k/N 处的等间隔采样。',
          formula: 'X[k] = X(e<sup>j&omega;</sup>)|<sub>&omega;=2&pi;k/N</sub>',
        },
        {
          text: '圆周移位：时域主值序列循环平移，对应频域乘上线性相位项。',
          formula: 'x[(n-m))<sub>N</sub>] &harr; X[k]e<sup>-j2&pi;km/N</sup>',
        },
        {
          text: '圆周卷积：长度 N 的圆周卷积在 DFT 域中对应逐点相乘。',
          formula: '(x &otimes;<sub>N</sub> h)[n] &harr; X[k]H[k]',
        },
        {
          text: '共轭对称：实序列的 DFT 在频域满足共轭对称结构，可减少有效计算量。',
          formula: 'x[n] &in; &#8477; &Rightarrow; X[N-k] = X<sup>*</sup>[k]',
        },
      ],
    },
    {
      id: 'sampling',
      title: '频域采样定理',
      description: '左侧给出频域采样、频域插值与重构的定义；右侧通过流程图和典型信号切换说明 DFT 频域采样的本质。',
      theory: [
        {
          text: '频域采样：长度为 N 的 DFT 等价于对 DTFT 在 N 个均匀频率点处取样。',
          formula: 'X[k] = X(e<sup>j&omega;</sup>)|<sub>&omega;=2&pi;k/N</sub>',
        },
        {
          text: '零填充插值：保持时域样本不变并在尾部补零，会得到更密的频域采样点。',
          formula: 'x[n] \u2192 [x[n], 0, \u2026, 0] &Rightarrow; DFT &nbsp; \u0394&omega; \u66f4\u5bc6',
        },
        {
          text: '主值序列与周期延拓：有限序列经 IDFT 恢复的是一个周期序列的主值段。',
          formula: 'x[n] \u2194 x<sub>p</sub>[n],&nbsp;&nbsp;x<sub>p</sub>[n+N]=x<sub>p</sub>[n]',
        },
        {
          text: '频域插值重构：通过更长长度的 DFT 采样，可逼近更平滑的连续频谱曲线。',
          formula: 'X<sub>M</sub>[k] = &Sigma;<sub>n=0</sub><sup>M-1</sup> x<sub>zp</sub>[n]e<sup>-j2&pi;kn/M</sup>,&nbsp; M&gt;N',
        },
      ],
    },
    {
      id: 'czt',
      title: '线性调频 Z 变换（CZT）',
      description: '左侧展示 CZT 定义与性质，右侧通过图表展示采样轨迹、频谱放大观察与理论说明。',
      theory: [
        {
          text: 'CZT 定义：沿复平面指定路径对 Z 变换进行离散采样，适合频带放大观察。',
          formula: 'X<sub>CZT</sub>[k] = &Sigma;<sub>n=0</sub><sup>N-1</sup> x[n]A<sup>-n</sup>W<sup>nk</sup>',
        },
        {
          text: '采样路径：每个采样点位于 z<sub>k</sub> = A W<sup>-k</sup> 上，可落在圆弧或螺旋线上。',
          formula: 'z<sub>k</sub> = A W<sup>-k</sup>,&nbsp;&nbsp;k=0,1,\u2026,M-1',
        },
        {
          text: 'DFT 是 CZT 的特例：当 A = 1，W = e<sup>-j2&pi;/M</sup> 时，采样路径退化为单位圆等角采样。',
          formula: 'A=1,\u00A0W=e<sup>-j2&pi;/M</sup> &Rightarrow; X<sub>CZT</sub>[k]=DFT\_M\{x[n]\}',
        },
        {
          text: '分辨率优势：通过调整 A 与 W，可只放大关注频带而不必全局细采样。',
          formula: 'W = r\_w e<sup>-j\u0394\u03b8</sup>,&nbsp;&nbsp;A = r\_0 e<sup>j\u03b8\_0</sup>',
        },
      ],
    },
  ]

  const dfsExamplePresets = [
    { id: 'square4', name: '四点方波', period: [1, 1, 0, 0] },
    { id: 'cos8', name: '八点余弦', period: Array.from({ length: 8 }, (_, n) => round2(Math.cos((TAU * n) / 8))) },
    { id: 'saw4', name: '四点斜坡', period: [0, 1, 2, 3] },
  ]

  const dftDemoPresets = [
    { id: 'demo1', name: '四点脉冲组合', x: [1, 2, 0, 0], h: [1, -1, 1, 0], shift: 1 },
    { id: 'demo2', name: '对称序列', x: [0, 1, 2, 1], h: [1, 1, 0, -1], shift: 2 },
    { id: 'demo3', name: '窗截断序列', x: [1, 1, 1, 0, 0, 0], h: [1, 0, -1, 0, 0, 0], shift: 3 },
  ]

  const freqSamplingPresets = [
    { id: 'rect8', name: '矩形窗序列', sequence: [1, 1, 1, 1, 0, 0, 0, 0] },
    { id: 'exp8', name: '指数衰减序列', sequence: Array.from({ length: 8 }, (_, n) => round2(Math.pow(0.82, n))) },
    { id: 'sin8', name: '正弦突发序列', sequence: Array.from({ length: 8 }, (_, n) => round2(Math.sin(0.62 * n))) },
  ]

  const cztSignalPresets = [
    { id: 'chirp', name: '线性调频脉冲', sequence: Array.from({ length: 16 }, (_, n) => round2(Math.cos(0.18 * n * n))) },
    { id: 'expburst', name: '阻尼振荡', sequence: Array.from({ length: 16 }, (_, n) => round2(Math.pow(0.92, n) * Math.cos(0.42 * n))) },
    { id: 'rectmix', name: '矩形与余弦混合', sequence: Array.from({ length: 16 }, (_, n) => round2((n < 6 ? 1 : 0) + 0.3 * Math.cos(0.55 * n))) },
  ]

  const cztContourPresets = {
    unit: { aRadius: 1, aAngle: 0, wRadius: 1, wAngle: TAU / 48 },
    arc: { aRadius: 1, aAngle: -0.9, wRadius: 1, wAngle: 0.05 },
    spiral: { aRadius: 1.18, aAngle: -1.0, wRadius: 0.98, wAngle: 0.08 },
  }

  const extensionTimers = {
    shift: null,
    conv: null,
  }

  const state = {
    activeSection: 'discrete',
    upload: {
      file: null,
      kind: 'none',
      name: '',
      message: '未上传文件。可上传 txt/csv 离散样本，也可上传音频/视频文件预览。',
      url: '',
      samples: [],
      sampleRate: null,
      duration: null,
      previewTitle: '',
      error: '',
    },
    drag: null,
    discrete: {
      selectedKey: 'impulse',
      draftExpression: DISCRETE_EXAMPLES[0],
      committedExpression: DISCRETE_EXAMPLES[0],
      error: '',
      range: { ...DISCRETE_DEFAULT_RANGE },
      params: buildDefaultParamStore(discretePresets),
    },
    sampling: {
      selectedKey: 'analog-sine',
      draftExpression: SAMPLING_EXAMPLES[0],
      committedExpression: SAMPLING_EXAMPLES[0],
      error: '',
      range: { ...SAMPLING_DEFAULT_RANGE },
      params: buildDefaultParamStore(samplingPresets),
    },
    zplane: {
      selectedKey: 'first-order',
      draftNumerator: Z_EXAMPLES[0].numerator,
      draftDenominator: Z_EXAMPLES[0].denominator,
      committedNumerator: parseCoefficientList(Z_EXAMPLES[0].numerator),
      committedDenominator: parseCoefficientList(Z_EXAMPLES[0].denominator),
      error: '',
      range: { ...Z_DEFAULT_RANGE },
      params: buildDefaultParamStore(zPresets),
    },
    extension: {
      activeTopic: 'dfs',
      dfs: {
        preset: 'square4',
        customPeriod: '1, 1, 0, 0',
      },
      dft: {
        preset: 'demo1',
        customX: '1, 2, 0, 0',
        customH: '1, -1, 1, 0',
        shift: 1,
        shiftStage: 0,
        convStage: 0,
        error: '',
      },
      samplingTheory: {
        signal: 'rect8',
        sampleCount: 8,
        interpCount: 32,
      },
      czt: {
        signal: 'chirp',
        contour: 'unit',
        points: 48,
        aRadius: 1,
        aAngle: 0,
        wRadius: 1,
        wAngle: round2(TAU / 48),
      },
    },
  }

  const elements = {
    sectionButtons: Array.from(document.querySelectorAll('.section-switcher__button')),
    uploadInput: document.getElementById('global-upload'),
    sidebarEyebrow: document.getElementById('sidebar-eyebrow'),
    sidebarTitle: document.getElementById('sidebar-title'),
    sidebarDescription: document.getElementById('sidebar-description'),
    sequenceList: document.getElementById('sequence-list'),
    controlTitle: document.getElementById('control-title'),
    sectionControls: document.getElementById('section-controls'),
    resetButton: document.getElementById('reset-button'),
    summaryTitle: document.getElementById('summary-title'),
    summaryChip: document.getElementById('summary-chip'),
    summaryBody: document.getElementById('summary-body'),
    uploadPreview: document.getElementById('upload-preview'),
    metricGrid: document.getElementById('metric-grid'),
    chartGrid: document.getElementById('chart-grid'),
    tableTitle: document.getElementById('table-title'),
    tableArea: document.getElementById('table-area'),
    notesArea: document.getElementById('notes-area'),
    extensionRoot: document.getElementById('extension-root'),
    extensionTopicButtons: Array.from(document.querySelectorAll('.extension-topic-switcher__button')),
    extensionTopicTitle: document.getElementById('extension-topic-title'),
    extensionTopicDescription: document.getElementById('extension-topic-description'),
    extensionTheoryList: document.getElementById('extension-theory-list'),
    extensionContent: document.getElementById('extension-content'),
  }

  let currentPayload = {
    charts: [],
  }

  bindEvents()
  render()

  function bindEvents() {
    elements.sectionButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const section = button.dataset.section
        if (!section || section === state.activeSection) {
          return
        }
        state.activeSection = section
        ensureValidSelection()
        render()
      })
    })

    elements.sequenceList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-item-id]')
      if (!button) {
        return
      }
      handleSidebarSelection(button.dataset.itemId || '')
    })

    elements.sectionControls.addEventListener('input', handleControlInput)
    elements.sectionControls.addEventListener('change', handleControlInput)
    elements.sectionControls.addEventListener('click', handleControlClick)
    elements.resetButton.addEventListener('click', resetActiveSection)
    elements.uploadInput.addEventListener('change', handleUploadChange)
    elements.extensionTopicButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const topic = button.dataset.extensionTopic
        if (!topic || topic === state.extension.activeTopic) {
          return
        }
        stopExtensionAnimations()
        state.extension.activeTopic = topic
        renderExtensionLab()
      })
    })
    elements.extensionRoot.addEventListener('click', handleExtensionClick)
    elements.extensionRoot.addEventListener('input', handleExtensionInput)
    elements.extensionRoot.addEventListener('change', handleExtensionInput)

    window.addEventListener('pointermove', handleDragMove)
    window.addEventListener('pointerup', finishDrag)
    window.addEventListener('pointercancel', finishDrag)
    window.addEventListener('resize', () => {
      renderCharts(currentPayload.charts)
      renderExtensionLab()
    })
  }

  function handleSidebarSelection(itemId) {
    if (state.activeSection === 'discrete') {
      state.discrete.selectedKey = itemId
      if (itemId === UPLOAD_KEY) {
        adoptUploadRangeForDiscrete()
      }
    } else if (state.activeSection === 'sampling') {
      state.sampling.selectedKey = itemId
      if (itemId === UPLOAD_KEY) {
        adoptUploadRangeForSampling()
      }
    } else {
      state.zplane.selectedKey = itemId
    }
    render()
  }

  function handleControlInput(event) {
    const target = event.target
    if (!(target instanceof HTMLElement)) {
      return
    }

    const input = target
    if (input.dataset.control === 'number') {
      const section = input.dataset.section
      const group = input.dataset.group
      const key = input.dataset.key
      const parseAs = input.dataset.parse || 'float'
      const value = parseAs === 'int' ? parseInt(input.value, 10) : parseFloat(input.value)
      if (!section || !group || !key || Number.isNaN(value)) {
        return
      }
      if (group === 'range') {
        state[section].range[key] = value
      } else if (group === 'param') {
        const presetId = input.dataset.preset
        if (!presetId) {
          return
        }
        state[section].params[presetId][key] = value
      }
      render()
      return
    }

    if (input.dataset.control === 'text') {
      const section = input.dataset.section
      const key = input.dataset.key
      if (!section || !key) {
        return
      }
      state[section][key] = input.value
    }
  }

  function handleControlClick(event) {
    const button = event.target.closest('[data-action]')
    if (!button) {
      return
    }
    const action = button.dataset.action

    if (action === 'submit-discrete-custom') {
      submitDiscreteCustom()
      return
    }
    if (action === 'submit-sampling-custom') {
      submitSamplingCustom()
      return
    }
    if (action === 'submit-z-custom') {
      submitZCustom()
      return
    }
    if (action === 'set-discrete-example') {
      const value = button.dataset.value || ''
      state.discrete.draftExpression = value
      render()
      return
    }
    if (action === 'set-sampling-example') {
      const value = button.dataset.value || ''
      state.sampling.draftExpression = value
      render()
      return
    }
    if (action === 'set-z-example') {
      state.zplane.draftNumerator = button.dataset.numerator || ''
      state.zplane.draftDenominator = button.dataset.denominator || ''
      render()
    }
  }

  async function handleUploadChange(event) {
    const file = event.target.files && event.target.files[0] ? event.target.files[0] : null
    revokeUploadUrlIfNeeded()
    state.upload = {
      file,
      kind: file ? 'loading' : 'none',
      name: file ? file.name : '',
      message: file ? '文件解析中，请稍候…' : '未上传文件。可上传 txt/csv 离散样本，也可上传音频/视频文件预览。',
      url: '',
      samples: [],
      sampleRate: null,
      duration: null,
      previewTitle: '',
      error: '',
    }
    render()

    if (!file) {
      ensureValidSelection()
      render()
      return
    }

    try {
      const lowerName = file.name.toLowerCase()
      if (file.type.startsWith('audio/')) {
        await ingestAudioFile(file)
      } else if (file.type.startsWith('video/')) {
        ingestVideoFile(file)
      } else if (
        file.type.startsWith('text/') ||
        lowerName.endsWith('.txt') ||
        lowerName.endsWith('.csv') ||
        lowerName.endsWith('.dat')
      ) {
        await ingestSampleFile(file)
      } else {
        state.upload.kind = 'unsupported'
        state.upload.message = '当前文件类型仅预留接口，推荐上传 txt/csv 数值样本或音频文件。'
      }
    } catch (error) {
      state.upload.kind = 'error'
      state.upload.error = error instanceof Error ? error.message : '文件解析失败。'
      state.upload.message = state.upload.error
    }

    ensureValidSelection()
    render()
  }

  async function ingestSampleFile(file) {
    const text = await file.text()
    const samples = parseNumericSamples(text)
    state.upload.kind = 'samples'
    state.upload.samples = samples
    state.upload.previewTitle = '上传离散样本'
    state.upload.message = `已读取 ${samples.length} 个样点，可在“典型离散序列”和“采样与插值重构”中直接分析。`
  }

  async function ingestAudioFile(file) {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext
    if (!AudioContextCtor) {
      throw new Error('当前浏览器不支持音频解码。')
    }
    const url = URL.createObjectURL(file)
    const audioContext = new AudioContextCtor()
    const buffer = await audioContext.decodeAudioData(await file.arrayBuffer())
    const channel = buffer.getChannelData(0)
    const samples = downsampleArray(Array.from(channel), MAX_UPLOAD_SAMPLES)
    await audioContext.close()
    state.upload.kind = 'audio'
    state.upload.url = url
    state.upload.samples = samples
    state.upload.sampleRate = buffer.sampleRate
    state.upload.duration = buffer.duration
    state.upload.previewTitle = '上传音频波形'
    state.upload.message = `音频首通道已抽取 ${samples.length} 个样点用于波形、DTFT 与重采样演示。`
  }

  function ingestVideoFile(file) {
    const url = URL.createObjectURL(file)
    state.upload.kind = 'video'
    state.upload.url = url
    state.upload.previewTitle = '上传视频预览'
    state.upload.message = '视频文件已预览。当前页面预留了后续提取音轨与关键帧进行三部分联动分析的接口。'
  }

  function revokeUploadUrlIfNeeded() {
    if (state.upload && state.upload.url) {
      URL.revokeObjectURL(state.upload.url)
    }
  }

  function resetActiveSection() {
    if (state.activeSection === 'discrete') {
      state.discrete = {
        selectedKey: 'impulse',
        draftExpression: DISCRETE_EXAMPLES[0],
        committedExpression: DISCRETE_EXAMPLES[0],
        error: '',
        range: { ...DISCRETE_DEFAULT_RANGE },
        params: buildDefaultParamStore(discretePresets),
      }
    } else if (state.activeSection === 'sampling') {
      state.sampling = {
        selectedKey: 'analog-sine',
        draftExpression: SAMPLING_EXAMPLES[0],
        committedExpression: SAMPLING_EXAMPLES[0],
        error: '',
        range: { ...SAMPLING_DEFAULT_RANGE },
        params: buildDefaultParamStore(samplingPresets),
      }
    } else {
      state.zplane = {
        selectedKey: 'first-order',
        draftNumerator: Z_EXAMPLES[0].numerator,
        draftDenominator: Z_EXAMPLES[0].denominator,
        committedNumerator: parseCoefficientList(Z_EXAMPLES[0].numerator),
        committedDenominator: parseCoefficientList(Z_EXAMPLES[0].denominator),
        error: '',
        range: { ...Z_DEFAULT_RANGE },
        params: buildDefaultParamStore(zPresets),
      }
    }
    render()
  }

  function submitDiscreteCustom() {
    try {
      const expression = normalizeExpression(state.discrete.draftExpression)
      const evaluator = compileExpression(expression, 'n', buildDiscreteHelpers())
      evaluator(0)
      state.discrete.committedExpression = expression
      state.discrete.selectedKey = CUSTOM_KEY
      state.discrete.error = ''
    } catch (error) {
      state.discrete.error = error instanceof Error ? error.message : '离散序列表达式无法解析。'
    }
    render()
  }

  function submitSamplingCustom() {
    try {
      const expression = normalizeExpression(state.sampling.draftExpression)
      const evaluator = compileExpression(expression, 't', buildSamplingHelpers())
      evaluator(0)
      state.sampling.committedExpression = expression
      state.sampling.selectedKey = CUSTOM_KEY
      state.sampling.error = ''
    } catch (error) {
      state.sampling.error = error instanceof Error ? error.message : '连续信号表达式无法解析。'
    }
    render()
  }

  function submitZCustom() {
    try {
      const numerator = parseCoefficientList(state.zplane.draftNumerator)
      const denominator = parseCoefficientList(state.zplane.draftDenominator)
      if (Math.abs(denominator[0]) < EPS) {
        throw new Error('分母首项不能为 0。')
      }
      state.zplane.committedNumerator = numerator
      state.zplane.committedDenominator = denominator
      state.zplane.selectedKey = CUSTOM_KEY
      state.zplane.error = ''
    } catch (error) {
      state.zplane.error = error instanceof Error ? error.message : '零极点系数无法解析。'
    }
    render()
  }

  function ensureValidSelection() {
    const hasUploadSignal = hasUploadAnalyzableSignal()
    if (state.discrete.selectedKey === UPLOAD_KEY && !hasUploadSignal) {
      state.discrete.selectedKey = 'impulse'
    }
    if (state.sampling.selectedKey === UPLOAD_KEY && !hasUploadSignal) {
      state.sampling.selectedKey = 'analog-sine'
    }
  }

  function adoptUploadRangeForDiscrete() {
    if (!hasUploadAnalyzableSignal()) {
      return
    }
    const maxIndex = Math.max(0, state.upload.samples.length - 1)
    state.discrete.range.nMin = 0
    state.discrete.range.nMax = Math.min(63, maxIndex)
  }

  function adoptUploadRangeForSampling() {
    if (!hasUploadAnalyzableSignal()) {
      return
    }
    const sampleRate = state.upload.sampleRate || 12
    const duration = state.upload.duration || (state.upload.samples.length - 1) / sampleRate
    state.sampling.range.tMin = 0
    state.sampling.range.tMax = Math.max(1, Math.min(duration, 6))
  }

  function render() {
    ensureValidSelection()
    elements.sectionButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.section === state.activeSection)
    })

    let payload
    if (state.activeSection === 'discrete') {
      payload = buildDiscretePayload()
    } else if (state.activeSection === 'sampling') {
      payload = buildSamplingPayload()
    } else {
      payload = buildZPayload()
    }
    currentPayload = payload

    renderSidebar(payload.sidebar)
    renderControls(payload.controls)
    renderSummary(payload.summary)
    renderUploadPreview()
    renderMetrics(payload.metrics)
    renderCharts(payload.charts)
    renderTable(payload.table)
    renderNotes(payload.notes)
    renderExtensionLab()
  }

  function renderSidebar(sidebar) {
    elements.sidebarEyebrow.textContent = sidebar.eyebrow
    elements.sidebarTitle.textContent = sidebar.title
    elements.sidebarDescription.textContent = sidebar.description
    elements.sequenceList.innerHTML = sidebar.items
      .map((item) => {
        return `
          <button type="button" class="sequence-item${item.active ? ' active' : ''}" data-item-id="${item.id}">
            <div class="sequence-item__head">
              <strong>${escapeHtml(item.name)}</strong>
              <span class="sequence-item__badge">${escapeHtml(item.badge)}</span>
            </div>
            <code class="sequence-item__formula">${escapeHtml(item.formula)}</code>
            <p class="sequence-item__desc">${escapeHtml(item.description)}</p>
          </button>
        `
      })
      .join('')
  }

  function renderControls(controls) {
    elements.controlTitle.textContent = controls.title
    elements.sectionControls.innerHTML = controls.html
  }

  function renderSummary(summary) {
    elements.summaryTitle.textContent = summary.title
    elements.summaryChip.textContent = summary.chip
    elements.summaryBody.innerHTML = summary.blocks.join('')
  }

  function renderUploadPreview() {
    const upload = state.upload
    const pieces = []

    if (!upload.file) {
      pieces.push(`<p class="upload-preview__empty">${escapeHtml(upload.message)}</p>`)
    } else {
      pieces.push(
        `<div class="upload-preview__meta">
          <div><span>文件名</span><strong>${escapeHtml(upload.name)}</strong></div>
          <div><span>文件类型</span><strong>${escapeHtml(upload.kind)}</strong></div>
          <div><span>接口状态</span><strong>${escapeHtml(upload.message)}</strong></div>
        </div>`,
      )

      if (upload.kind === 'audio' && upload.url) {
        pieces.push(`<audio controls src="${upload.url}"></audio>`)
      }
      if (upload.kind === 'video' && upload.url) {
        pieces.push(`<video controls src="${upload.url}"></video>`)
      }
      if ((upload.kind === 'samples' || upload.kind === 'audio') && upload.samples.length) {
        const previewX = upload.samples.map((_, index) => index)
        const previewSvg = buildStemOrLinePlot({
          mode: 'line',
          data: previewX.map((x, index) => ({ x, y: upload.samples[index] })),
          xDomain: [0, Math.max(1, previewX.length - 1)],
          yDomain: null,
          color: '#11839f',
          lineWidth: 1.4,
          xLabel: upload.kind === 'audio' ? '抽样索引' : '样本索引',
          yLabel: '幅值',
          height: 250,
        })
        pieces.push(
          `<div class="formula-block">
            <span class="formula-block__label">${escapeHtml(upload.previewTitle || '原始信号预览')}</span>
            <div class="plot-frame">${previewSvg}</div>
          </div>`,
        )
      }
      if (upload.kind === 'error' || upload.kind === 'unsupported') {
        pieces.push(`<p class="error-text">${escapeHtml(upload.error || upload.message)}</p>`)
      }
    }

    elements.uploadPreview.innerHTML = pieces.join('')
  }

  function renderMetrics(metrics) {
    elements.metricGrid.innerHTML = metrics
      .map((metric) => {
        return `
          <article class="metric-card">
            <span class="metric-card__label">${escapeHtml(metric.label)}</span>
            <strong>${escapeHtml(metric.value)}</strong>
          </article>
        `
      })
      .join('')
  }

  function renderCharts(charts) {
    elements.chartGrid.style.gridTemplateColumns =
      charts.length > 1 && window.innerWidth > 1180 ? 'repeat(2, minmax(0, 1fr))' : '1fr'
    elements.chartGrid.innerHTML = charts
      .map((chart) => {
        const legend = chart.legend && chart.legend.length ? `<div class="ghost-chip-list">${chart.legend.map(renderLegendChip).join('')}</div>` : ''
        return `
          <article class="panel chart-card">
            <div class="panel__header">
              <div>
                <p class="eyebrow">${escapeHtml(chart.eyebrow || '图形结果')}</p>
                <h2>${escapeHtml(chart.title)}</h2>
                <p class="chart-card__subtitle">${escapeHtml(chart.subtitle)}</p>
              </div>
            </div>
            <div class="plot-frame" ${chart.drag ? buildDragAttributes(chart.drag) : ''}>
              ${chart.svg}
            </div>
            ${legend}
          </article>
        `
      })
      .join('')

    Array.from(elements.chartGrid.querySelectorAll('.plot-frame[data-drag-kind]')).forEach((frame) => {
      frame.addEventListener('pointerdown', startDrag)
    })
  }

  function renderTable(table) {
    elements.tableTitle.textContent = table.title
    elements.tableArea.innerHTML = `
      <p class="table-caption">${escapeHtml(table.caption)}</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>${table.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${table.rows
              .map(
                (row) =>
                  `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join('')}</tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
  }

  function renderNotes(notes) {
    elements.notesArea.innerHTML = notes
      .map(
        (note) => `
          <article class="note-card">
            <h3>${escapeHtml(note.title)}</h3>
            <p>${escapeHtml(note.body)}</p>
          </article>
        `,
      )
      .join('')
  }

  function handleExtensionInput(event) {
    const target = event.target
    if (!(target instanceof HTMLElement)) {
      return
    }

    if (target.id === 'dfs-preset-select') {
      state.extension.dfs.preset = target.value
      renderExtensionLab()
      return
    }
    if (target.id === 'dfs-custom-period') {
      state.extension.dfs.customPeriod = target.value
      return
    }
    if (target.id === 'dft-preset-select') {
      const preset = dftDemoPresets.find((item) => item.id === target.value)
      if (preset) {
        state.extension.dft.preset = preset.id
        state.extension.dft.customX = preset.x.join(', ')
        state.extension.dft.customH = preset.h.join(', ')
        state.extension.dft.shift = preset.shift
        state.extension.dft.shiftStage = 0
        state.extension.dft.convStage = 0
      }
      renderExtensionLab()
      return
    }
    if (target.id === 'dft-custom-x') {
      state.extension.dft.customX = target.value
      return
    }
    if (target.id === 'dft-custom-h') {
      state.extension.dft.customH = target.value
      return
    }
    if (target.id === 'dft-shift-value') {
      const value = parseInt(target.value, 10)
      if (!Number.isNaN(value)) {
        state.extension.dft.shift = value
        renderExtensionLab()
      }
      return
    }
    if (target.id === 'fsamp-sample-count') {
      const value = parseInt(target.value, 10)
      if (!Number.isNaN(value)) {
        state.extension.samplingTheory.sampleCount = clamp(value, 4, 24)
        if (state.extension.samplingTheory.interpCount <= value) {
          state.extension.samplingTheory.interpCount = value * 4
        }
        renderExtensionLab()
      }
      return
    }
    if (target.id === 'fsamp-interp-count') {
      const value = parseInt(target.value, 10)
      if (!Number.isNaN(value)) {
        state.extension.samplingTheory.interpCount = clamp(value, 12, 128)
        renderExtensionLab()
      }
      return
    }
    if (target.id === 'czt-signal-select') {
      state.extension.czt.signal = target.value
      renderExtensionLab()
      return
    }
    if (target.id === 'czt-contour-select') {
      applyCztContourPreset(target.value)
      renderExtensionLab()
      return
    }
    if (target.id === 'czt-points') {
      const value = parseInt(target.value, 10)
      if (!Number.isNaN(value)) {
        state.extension.czt.points = clamp(value, 16, 96)
        renderExtensionLab()
      }
      return
    }
    if (target.id === 'czt-a-radius') {
      const value = parseFloat(target.value)
      if (!Number.isNaN(value)) {
        state.extension.czt.aRadius = clamp(value, 0.4, 2.2)
        renderExtensionLab()
      }
      return
    }
    if (target.id === 'czt-a-angle') {
      const value = parseFloat(target.value)
      if (!Number.isNaN(value)) {
        state.extension.czt.aAngle = clamp(value, -Math.PI, Math.PI)
        renderExtensionLab()
      }
      return
    }
    if (target.id === 'czt-w-radius') {
      const value = parseFloat(target.value)
      if (!Number.isNaN(value)) {
        state.extension.czt.wRadius = clamp(value, 0.85, 1.15)
        renderExtensionLab()
      }
      return
    }
    if (target.id === 'czt-w-angle') {
      const value = parseFloat(target.value)
      if (!Number.isNaN(value)) {
        state.extension.czt.wAngle = clamp(value, 0.01, 0.45)
        renderExtensionLab()
      }
    }
  }

  function handleExtensionClick(event) {
    const button = event.target.closest('[data-extension-action]')
    if (!button) {
      return
    }
    const action = button.dataset.extensionAction
    if (!action) {
      return
    }

    if (action === 'dfs-apply-custom') {
      state.extension.dfs.preset = 'custom'
      renderExtensionLab()
      return
    }
    if (action === 'dft-apply-custom') {
      state.extension.dft.preset = 'custom'
      state.extension.dft.shiftStage = 0
      state.extension.dft.convStage = 0
      renderExtensionLab()
      return
    }
    if (action === 'dft-shift-next') {
      stopShiftAnimation()
      state.extension.dft.shiftStage = (state.extension.dft.shiftStage + 1) % 4
      renderExtensionLab()
      return
    }
    if (action === 'dft-shift-reset') {
      stopShiftAnimation()
      state.extension.dft.shiftStage = 0
      renderExtensionLab()
      return
    }
    if (action === 'dft-shift-play') {
      toggleShiftAnimation()
      return
    }
    if (action === 'dft-conv-next') {
      stopConvAnimation()
      advanceConvStage()
      renderExtensionLab()
      return
    }
    if (action === 'dft-conv-reset') {
      stopConvAnimation()
      state.extension.dft.convStage = 0
      renderExtensionLab()
      return
    }
    if (action === 'dft-conv-play') {
      toggleConvAnimation()
      return
    }
    if (action === 'fsamp-set-signal') {
      state.extension.samplingTheory.signal = button.dataset.signalId || state.extension.samplingTheory.signal
      renderExtensionLab()
      return
    }
    if (action === 'czt-apply-contour') {
      applyCztContourPreset(button.dataset.contourId || 'unit')
      renderExtensionLab()
    }
  }

  function renderExtensionLab() {
    const topic = extensionTopics.find((item) => item.id === state.extension.activeTopic) || extensionTopics[0]
    elements.extensionTopicButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.extensionTopic === topic.id)
    })
    elements.extensionTopicTitle.textContent = topic.title
    elements.extensionTopicDescription.textContent = topic.description
    elements.extensionTheoryList.innerHTML = topic.theory
      .map(
        (item) => `
          <article class="extension-theory-item">
            <p>${escapeHtml(item.text)}</p>
            <div class="formula-math">${item.formula}</div>
          </article>
        `,
      )
      .join('')

    let content = ''
    if (topic.id === 'dfs') {
      content = buildDfsExtensionContent()
    } else if (topic.id === 'dft') {
      content = buildDftExtensionContent()
    } else if (topic.id === 'sampling') {
      content = buildFrequencySamplingContent()
    } else {
      content = buildCztExtensionContent()
    }
    elements.extensionContent.innerHTML = `<div class="extension-content">${content}</div>`
  }

  function buildDfsExtensionContent() {
    const period = resolveDfsPeriod()
    const N = period.length
    const coeffs = computeDfs(period)
    const magnitude = coeffs.map((value) => cAbs(value))
    const phase = coeffs.map((value) => cArg(value))
    const periodicData = buildPeriodicSequenceData(period, -N, 2 * N - 1)
    const dfsRows = coeffs.map((value, index) => [
      `k = ${index}`,
      formatNumber(value.re),
      formatNumber(value.im),
      formatNumber(magnitude[index]),
    ])

    return `
      <section class="extension-block">
        <div class="extension-block__header">
          <div>
            <h3>DFS 典型周期序列与系数展示</h3>
            <p>右侧三个图依次展示周期序列、DFS 幅度系数与 DFS 相位系数，所有数据保留两位小数。</p>
          </div>
          <span class="panel-chip">N = ${formatNumber(N)}</span>
        </div>
        <div class="extension-inline-toolbar">
          <div class="field">
            <label for="dfs-preset-select">典型周期序列</label>
            <select id="dfs-preset-select">
              ${dfsExamplePresets
                .map(
                  (preset) =>
                    `<option value="${preset.id}"${state.extension.dfs.preset === preset.id ? ' selected' : ''}>${escapeHtml(preset.name)}</option>`,
                )
                .join('')}
              <option value="custom"${state.extension.dfs.preset === 'custom' ? ' selected' : ''}>自定义周期</option>
            </select>
          </div>
          <div class="field" style="flex:1 1 320px;">
            <label for="dfs-custom-period">自定义一个周期样本</label>
            <input id="dfs-custom-period" type="text" value="${escapeAttribute(state.extension.dfs.customPeriod)}" />
          </div>
          <button type="button" class="primary-button" data-extension-action="dfs-apply-custom">应用自定义周期</button>
        </div>
        <div class="three-column-grid" style="margin-top:12px;">
          ${extensionChartCard(
            '周期序列 x[n]',
            '显示三个周期，便于观察周期延拓。',
            buildStemOrLinePlot({
              mode: 'stem',
              data: periodicData,
              xDomain: [periodicData[0].x, periodicData[periodicData.length - 1].x],
              yDomain: null,
              color: '#24b7a0',
              lineWidth: 1.35,
              xLabel: 'n',
              yLabel: 'x[n]',
              height: 280,
            }),
          )}
          ${extensionChartCard(
            'DFS 幅度系数 |C[k]|',
            'DFS 系数等于一周期 DFT 系数除以 N。',
            buildStemOrLinePlot({
              mode: 'stem',
              data: magnitude.map((value, index) => ({ x: index, y: value })),
              xDomain: [0, Math.max(1, N - 1)],
              yDomain: [0, Math.max(0.2, Math.max(...magnitude) * 1.15)],
              color: '#ef8a50',
              lineWidth: 1.3,
              xLabel: 'k',
              yLabel: '|C[k]|',
              height: 280,
            }),
          )}
          ${extensionChartCard(
            'DFS 相位系数 ∠C[k]',
            '主值相位区间为 [-π, π]。',
            buildStemOrLinePlot({
              mode: 'line',
              data: phase.map((value, index) => ({ x: index, y: value })),
              xDomain: [0, Math.max(1, N - 1)],
              yDomain: [-Math.PI, Math.PI],
              color: '#295874',
              lineWidth: 1.45,
              xLabel: 'k',
              yLabel: '相位',
              height: 280,
            }),
          )}
        </div>
      </section>
      <section class="two-column-grid">
        <section class="extension-block">
          <div class="extension-block__header">
            <div>
              <h3>DFS 与 DFT 的关系</h3>
              <p>对周期序列取一个完整周期，其 DFT 系数与 DFS 系数只差一个 1/N 的尺度因子。</p>
            </div>
          </div>
          <div class="flow-diagram">
            <div class="flow-node"><strong>周期序列 x[n]</strong><span>保留一个主值周期</span></div>
            <div class="flow-arrow">&rarr;</div>
            <div class="flow-node"><strong>N 点 DFT</strong><span>X<sub>DFT</sub>[k]</span></div>
            <div class="flow-arrow">&rarr;</div>
            <div class="flow-node"><strong>DFS 系数</strong><span>C[k] = X[k] / N</span></div>
          </div>
          <p class="extension-note">这也是周期序列频域离散化后最常用的计算方式：先截取一个周期，再做 DFT。</p>
        </section>
        <section class="theory-panel">
          <h4>理论说明面板</h4>
          <p>DFS 适用于严格周期序列。时域一旦具备 N 周期，频域只需要 N 个离散系数即可完整描述。图中幅度系数和相位系数能帮助直观看到不同周期波形在离散频率点上的能量分布。</p>
          <p>如果将一个周期样本直接送入 DFT，则其结果与 DFS 分析式完全一致，只是系数缩放不同：DFS 采用 1/N 的归一化。</p>
        </section>
      </section>
      <section class="extension-block">
        <div class="extension-block__header">
          <div>
            <h3>DFS 系数表</h3>
            <p>每行对应一个离散频率 k，展示实部、虚部与幅度。</p>
          </div>
        </div>
        ${buildCompactTable(['频率索引', 'Re{C[k]}', 'Im{C[k]}', '|C[k]|'], dfsRows)}
      </section>
    `
  }

  function buildDftExtensionContent() {
    const demo = resolveDftDemo()
    const N = demo.x.length
    const original = demo.x.map((value, index) => ({ x: index, y: value }))
    const extensionData = buildPeriodicSequenceData(demo.x, -N, 2 * N - 1)
    const linearShiftedData = extensionData.map((point) => ({ x: point.x, y: demo.x[mod(point.x - demo.shift, N)] }))
    const principalShift = circularShift(demo.x, demo.shift)
    const shiftStageCards = [
      { label: '原序列', desc: '有限长度主值序列', active: state.extension.dft.shiftStage === 0 },
      { label: '周期延拓', desc: '先做 N 周期延拓', active: state.extension.dft.shiftStage === 1 },
      { label: '线性位移', desc: '在延拓序列上平移', active: state.extension.dft.shiftStage === 2 },
      { label: '主值序列', desc: '再截取一个周期', active: state.extension.dft.shiftStage === 3 },
    ]
    const dftX = computeDft(demo.x)
    const dftMagnitude = dftX.map((value) => cAbs(value))
    const dftRows = dftX.map((value, index) => [
      `k = ${index}`,
      formatNumber(value.re),
      formatNumber(value.im),
      formatNumber(dftMagnitude[index]),
    ])

    const convStep = mod(state.extension.dft.convStage, N)
    const currentShiftedH = demo.h.map((_, k) => demo.h[mod(convStep - k, N)])
    const convTerms = demo.x.map((value, index) => value * currentShiftedH[index])
    const convOutput = circularConvolution(demo.x, demo.h)
    const partialOutput = convOutput.map((value, index) => (index <= convStep ? value : 0))
    const convRows = demo.x.map((value, index) => [
      `k = ${index}`,
      formatNumber(value),
      formatNumber(currentShiftedH[index]),
      formatNumber(convTerms[index]),
    ])

    return `
      <section class="extension-block">
        <div class="extension-block__header">
          <div>
            <h3>DFT 与其他变换的关系流程图</h3>
            <p>上方先给流程图，下方再分别解释 DFT 与 DFS、DTFT、Z 变换之间的联系与结果。</p>
          </div>
          <span class="panel-chip">N = ${formatNumber(N)}</span>
        </div>
        <div class="flow-diagram">
          <div class="flow-node"><strong>有限序列 x[n]</strong><span>主值序列</span></div>
          <div class="flow-arrow">&rarr;</div>
          <div class="flow-node"><strong>DFT X[k]</strong><span>N 个离散频率采样</span></div>
          <div class="flow-arrow">&rarr;</div>
          <div class="flow-node"><strong>DFS / DTFT / Z</strong><span>通过采样、周期延拓与单位圆取值互相关联</span></div>
        </div>
        <div class="relation-grid" style="margin-top:12px;">
          <article class="relation-card">
            <h4>DFT ↔ DFS</h4>
            <p>对周期序列截取一个周期做 DFT，可得到与 DFS 等价的离散频域描述，二者仅差比例系数。</p>
            <div class="formula-math">C[k] = X<sub>DFT</sub>[k] / N</div>
          </article>
          <article class="relation-card">
            <h4>DFT ↔ DTFT</h4>
            <p>DFT 是 DTFT 在单位圆上均匀取样的结果，点间隔取决于 N。</p>
            <div class="formula-math">X[k] = X(e<sup>j&omega;</sup>)|<sub>&omega;=2&pi;k/N</sub></div>
          </article>
          <article class="relation-card">
            <h4>DFT ↔ Z 变换</h4>
            <p>先取 Z 变换，再在单位圆 z = e<sup>j&omega;</sup> 上等间隔取样即可得到 DFT。</p>
            <div class="formula-math">X[k] = X(z)|<sub>z=e<sup>j2&pi;k/N</sup></sub></div>
          </article>
        </div>
      </section>

      <section class="extension-block">
        <div class="extension-block__header">
          <div>
            <h3>圆周位移步骤动画：原序列 → 周期延拓 → 线性位移 → 主值序列</h3>
            <p>可切换例子，也可手动输入主值序列和位移量。播放后会按四个阶段高亮展示。</p>
          </div>
        </div>
        <div class="extension-inline-toolbar">
          <div class="field">
            <label for="dft-preset-select">典型例子</label>
            <select id="dft-preset-select">
              ${dftDemoPresets
                .map(
                  (preset) =>
                    `<option value="${preset.id}"${state.extension.dft.preset === preset.id ? ' selected' : ''}>${escapeHtml(preset.name)}</option>`,
                )
                .join('')}
              <option value="custom"${state.extension.dft.preset === 'custom' ? ' selected' : ''}>自定义例子</option>
            </select>
          </div>
          <div class="field" style="flex:1 1 240px;">
            <label for="dft-custom-x">自定义 x[n]</label>
            <input id="dft-custom-x" type="text" value="${escapeAttribute(state.extension.dft.customX)}" />
          </div>
          <div class="field">
            <label for="dft-shift-value">圆周位移 m</label>
            <input id="dft-shift-value" type="number" value="${escapeAttribute(String(state.extension.dft.shift))}" />
          </div>
          <button type="button" class="primary-button" data-extension-action="dft-apply-custom">应用自定义位移例子</button>
        </div>
        <div class="step-strip">
          ${shiftStageCards
            .map(
              (item, index) => `
                <article class="step-card${item.active ? ' active' : ''}">
                  <span>步骤 ${index + 1}</span>
                  <h4>${escapeHtml(item.label)}</h4>
                  <p>${escapeHtml(item.desc)}</p>
                </article>
              `,
            )
            .join('')}
        </div>
        <div class="extension-button-row">
          <button type="button" class="text-button" data-extension-action="dft-shift-play">${extensionTimers.shift ? '暂停动画' : '播放步骤动画'}</button>
          <button type="button" class="text-button" data-extension-action="dft-shift-next">下一步</button>
          <button type="button" class="text-button" data-extension-action="dft-shift-reset">重置</button>
        </div>
        <div class="mini-chart-grid" style="margin-top:12px;">
          ${extensionChartCard(
            '原序列',
            '长度 N 的主值段。',
            buildStemOrLinePlot({
              mode: 'stem',
              data: original,
              xDomain: [0, Math.max(1, N - 1)],
              yDomain: null,
              color: '#24b7a0',
              lineWidth: 1.25,
              xLabel: 'n',
              yLabel: 'x[n]',
              height: 240,
            }),
            state.extension.dft.shiftStage === 0,
          )}
          ${extensionChartCard(
            '周期延拓',
            '先延拓为 N 周期序列。',
            buildStemOrLinePlot({
              mode: 'stem',
              data: extensionData,
              xDomain: [extensionData[0].x, extensionData[extensionData.length - 1].x],
              yDomain: null,
              color: '#11839f',
              lineWidth: 1.15,
              xLabel: 'n',
              yLabel: 'x_p[n]',
              height: 240,
            }),
            state.extension.dft.shiftStage === 1,
          )}
          ${extensionChartCard(
            '线性位移',
            `在延拓序列上平移 m = ${formatNumber(demo.shift)}。`,
            buildStemOrLinePlot({
              mode: 'stem',
              data: linearShiftedData,
              xDomain: [linearShiftedData[0].x, linearShiftedData[linearShiftedData.length - 1].x],
              yDomain: null,
              color: '#ef8a50',
              lineWidth: 1.15,
              xLabel: 'n',
              yLabel: 'x_p[n-m]',
              height: 240,
            }),
            state.extension.dft.shiftStage === 2,
          )}
          ${extensionChartCard(
            '主值序列',
            '截取一个周期得到圆周位移结果。',
            buildStemOrLinePlot({
              mode: 'stem',
              data: principalShift.map((value, index) => ({ x: index, y: value })),
              xDomain: [0, Math.max(1, N - 1)],
              yDomain: null,
              color: '#295874',
              lineWidth: 1.25,
              xLabel: 'n',
              yLabel: 'x[(n-m))_N]',
              height: 240,
            }),
            state.extension.dft.shiftStage === 3,
          )}
        </div>
      </section>

      <section class="extension-block">
        <div class="extension-block__header">
          <div>
            <h3>圆周卷积步骤动画</h3>
            <p>每一步展示当前对齐的 h[(n-k))<sub>N</sub>]、逐项乘积以及已累积的圆周卷积输出。</p>
          </div>
          <span class="panel-chip">当前输出索引 n = ${formatNumber(convStep)}</span>
        </div>
        <div class="extension-inline-toolbar">
          <div class="field" style="flex:1 1 220px;">
            <label for="dft-custom-h">自定义 h[n]</label>
            <input id="dft-custom-h" type="text" value="${escapeAttribute(state.extension.dft.customH)}" />
          </div>
          <button type="button" class="primary-button" data-extension-action="dft-apply-custom">应用自定义卷积例子</button>
          <button type="button" class="text-button" data-extension-action="dft-conv-play">${extensionTimers.conv ? '暂停动画' : '播放卷积步骤'}</button>
          <button type="button" class="text-button" data-extension-action="dft-conv-next">下一步</button>
          <button type="button" class="text-button" data-extension-action="dft-conv-reset">重置</button>
        </div>
        <div class="three-column-grid" style="margin-top:12px;">
          ${extensionChartCard(
            '序列 x[k]',
            '卷积中的第一组输入序列。',
            buildStemOrLinePlot({
              mode: 'stem',
              data: demo.x.map((value, index) => ({ x: index, y: value })),
              xDomain: [0, Math.max(1, N - 1)],
              yDomain: null,
              color: '#24b7a0',
              lineWidth: 1.25,
              xLabel: 'k',
              yLabel: 'x[k]',
              height: 240,
            }),
          )}
          ${extensionChartCard(
            `当前对齐 h[(n-k))_N]`,
            '本步对齐后的第二序列。',
            buildStemOrLinePlot({
              mode: 'stem',
              data: currentShiftedH.map((value, index) => ({ x: index, y: value })),
              xDomain: [0, Math.max(1, N - 1)],
              yDomain: null,
              color: '#ef8a50',
              lineWidth: 1.25,
              xLabel: 'k',
              yLabel: 'h[(n-k))_N]',
              height: 240,
            }),
          )}
          ${extensionChartCard(
            '已累积输出 y[n]',
            '每进一步，就多确定一个输出点。',
            buildStemOrLinePlot({
              mode: 'stem',
              data: partialOutput.map((value, index) => ({ x: index, y: value })),
              xDomain: [0, Math.max(1, N - 1)],
              yDomain: null,
              color: '#295874',
              lineWidth: 1.25,
              xLabel: 'n',
              yLabel: 'y[n]',
              height: 240,
            }),
          )}
        </div>
        <p class="step-caption">当前输出 y[${formatNumber(convStep)}] = ${convTerms.map((value) => formatNumber(value)).join(' + ')} = ${formatNumber(convOutput[convStep])}</p>
        ${buildCompactTable(['索引', 'x[k]', 'h[(n-k))_N]', '乘积'], convRows)}
      </section>

      <section class="two-column-grid">
        <section class="extension-block">
          <div class="extension-block__header">
            <div>
              <h3>DFT 系数结果</h3>
              <p>对当前 x[n] 做 DFT，便于把圆周位移性质和频域线性相位因子联系起来看。</p>
            </div>
          </div>
          ${extensionChartCard(
            'DFT 幅度 |X[k]|',
            '当前 x[n] 的离散频谱幅度。',
            buildStemOrLinePlot({
              mode: 'stem',
              data: dftMagnitude.map((value, index) => ({ x: index, y: value })),
              xDomain: [0, Math.max(1, N - 1)],
              yDomain: [0, Math.max(0.2, Math.max(...dftMagnitude) * 1.15)],
              color: '#11839f',
              lineWidth: 1.25,
              xLabel: 'k',
              yLabel: '|X[k]|',
              height: 250,
            }),
          )}
          ${buildCompactTable(['频率索引', 'Re{X[k]}', 'Im{X[k]}', '|X[k]|'], dftRows)}
        </section>
        <section class="theory-panel">
          <h4>理论说明面板</h4>
          <p>圆周位移的本质是：先把有限主值序列做周期延拓，再在这个周期序列上做普通位移，最后截回一个主值周期。图中四步正是这个过程，因此主值序列端点会“绕回”到前面。</p>
          <p>圆周卷积可视为第二个序列按输出索引逐步循环对齐，再和第一个序列逐项相乘求和。由于采用模 N 索引，超出主值段的样本会自动回卷到起点。</p>
        </section>
      </section>
    `
  }

  function buildFrequencySamplingContent() {
    const sequence = resolveFrequencySamplingSequence()
    const N = clamp(state.extension.samplingTheory.sampleCount, sequence.length, 24)
    const M = clamp(Math.max(state.extension.samplingTheory.interpCount, N + 4), N + 4, 128)
    const baseSequence = zeroPadSequence(sequence, N)
    const denseDtftOmega = linspace(-Math.PI, Math.PI, 256)
    const indexRange = buildIntegerRange(0, baseSequence.length - 1)
    const denseDtft = denseDtftOmega.map((omega) => cAbs(computeDtftAt(baseSequence, indexRange, omega)))
    const sampledSpectrum = sampleDftSpectrum(baseSequence, N)
    const interpolatedSpectrum = sampleDftSpectrum(zeroPadSequence(baseSequence, M), M)

    return `
      <section class="extension-block">
        <div class="extension-block__header">
          <div>
            <h3>频域采样定理流程图</h3>
            <p>借助 DFT 与 DTFT、DFS 的关系，把“频域采样”和“频域插值重构”串成一条直观流程。</p>
          </div>
          <span class="panel-chip">N = ${formatNumber(N)}，M = ${formatNumber(M)}</span>
        </div>
        <div class="flow-diagram">
          <div class="flow-node"><strong>有限序列 x[n]</strong><span>长度有限，可零填充</span></div>
          <div class="flow-arrow">&rarr;</div>
          <div class="flow-node"><strong>DTFT</strong><span>连续频谱 X(e<sup>j&omega;</sup>)</span></div>
          <div class="flow-arrow">&rarr;</div>
          <div class="flow-node"><strong>N 点采样</strong><span>得到 DFT 频域样点</span></div>
          <div class="flow-arrow">&rarr;</div>
          <div class="flow-node"><strong>零填充重采样</strong><span>得到更密的频域插值曲线</span></div>
        </div>
        <div class="signal-switch-row" style="margin-top:12px;">
          ${freqSamplingPresets
            .map(
              (preset) => `
                <button
                  type="button"
                  class="ghost-chip${preset.id === state.extension.samplingTheory.signal ? ' active' : ''}"
                  data-extension-action="fsamp-set-signal"
                  data-signal-id="${preset.id}"
                >
                  ${escapeHtml(preset.name)}
                </button>
              `,
            )
            .join('')}
        </div>
        <div class="extension-inline-toolbar" style="margin-top:12px;">
          <div class="field">
            <label for="fsamp-sample-count">频域采样点数 N</label>
            <input id="fsamp-sample-count" type="number" value="${escapeAttribute(String(N))}" />
          </div>
          <div class="field">
            <label for="fsamp-interp-count">插值频域点数 M</label>
            <input id="fsamp-interp-count" type="number" value="${escapeAttribute(String(M))}" />
          </div>
        </div>
      </section>

      <section class="three-column-grid">
        ${extensionChartCard(
          '原序列 x[n]',
          '典型有限长度序列，可点击上方按钮切换。',
          buildStemOrLinePlot({
            mode: 'stem',
            data: baseSequence.map((value, index) => ({ x: index, y: value })),
            xDomain: [0, Math.max(1, N - 1)],
            yDomain: null,
            color: '#24b7a0',
            lineWidth: 1.25,
            xLabel: 'n',
            yLabel: 'x[n]',
            height: 250,
          }),
        )}
        ${extensionChartCard(
          '连续频谱与 N 点采样',
          '细线表示 DTFT，圆点表示 N 点 DFT 频域采样。',
          buildSpectrumSamplingPlot(
            denseDtftOmega,
            denseDtft,
            sampledSpectrum.map((item) => ({ x: item.omega, y: item.magnitude })),
            [-Math.PI, Math.PI],
            '#11839f',
            '#ef8a50',
            '|X|',
          ),
        )}
        ${extensionChartCard(
          '频域插值重构',
          '通过时间域零填充，得到更密的频域采样曲线。',
          buildMultiLinePlot({
            series: [
              {
                name: '原连续频谱',
                color: '#11839f',
                width: 1.5,
                data: denseDtftOmega.map((x, index) => ({ x, y: denseDtft[index] })),
              },
              {
                name: '插值重构曲线',
                color: '#24b7a0',
                width: 1.45,
                data: interpolatedSpectrum.map((item) => ({ x: item.omega, y: item.magnitude })),
              },
            ],
            xDomain: [-Math.PI, Math.PI],
            yDomain: null,
            xLabel: 'ω',
            yLabel: '|X|',
            height: 250,
          }),
        )}
      </section>

      <section class="two-column-grid">
        <section class="extension-block">
          <div class="extension-block__header">
            <div>
              <h3>频域采样与插值结果表</h3>
              <p>前半部分给出 N 点采样，后半部分给出插值后更密的一组频域样点。</p>
            </div>
          </div>
          ${buildCompactTable(
            ['类别', '&omega;', '幅度'],
            buildFrequencySamplingRows(sampledSpectrum, interpolatedSpectrum),
          )}
        </section>
        <section class="theory-panel">
          <h4>理论说明面板</h4>
          <p>频域采样定理在这里的直观含义是：有限长度序列的 DFT 并不是“新的变换对象”，而是连续 DTFT 在一组等间隔频率上的离散采样。采样点数 N 决定了频率分辨率。</p>
          <p>当时域做零填充后，频谱本身并没有增加新的物理信息，但 DFT 会在单位圆上给出更密的采样点，因此图形看起来更加平滑，这就是常见的频域插值重构现象。</p>
        </section>
      </section>
    `
  }

  function buildCztExtensionContent() {
    const signal = resolveCztSignal()
    const points = clamp(state.extension.czt.points, 16, 96)
    const A = complexPolar(state.extension.czt.aRadius, state.extension.czt.aAngle)
    const W = complexPolar(state.extension.czt.wRadius, -state.extension.czt.wAngle)
    const contour = buildCztContour(A, W, points)
    const cztValues = computeCzt(signal, A, W, points)
    const magnitudes = cztValues.map((value) => cAbs(value))
    const dftReference = computeDft(zeroPadSequence(signal, points)).map((value) => cAbs(value))
    const zRows = contour.slice(0, Math.min(12, contour.length)).map((point, index) => [
      `k = ${index}`,
      formatNumber(point.re),
      formatNumber(point.im),
      formatNumber(magnitudes[index]),
    ])

    return `
      <section class="extension-block">
        <div class="extension-block__header">
          <div>
            <h3>CZT 参数与路径控制</h3>
            <p>通过调节 A 与 W，改变复平面采样轨迹，观察某一频带或某一螺旋轨迹上的变换结果。</p>
          </div>
          <span class="panel-chip">采样点数 M = ${formatNumber(points)}</span>
        </div>
        <div class="extension-inline-toolbar">
          <div class="field">
            <label for="czt-signal-select">信号例子</label>
            <select id="czt-signal-select">
              ${cztSignalPresets
                .map(
                  (preset) =>
                    `<option value="${preset.id}"${preset.id === state.extension.czt.signal ? ' selected' : ''}>${escapeHtml(preset.name)}</option>`,
                )
                .join('')}
            </select>
          </div>
          <div class="field">
            <label for="czt-contour-select">典型路径</label>
            <select id="czt-contour-select">
              <option value="unit"${state.extension.czt.contour === 'unit' ? ' selected' : ''}>单位圆等角采样</option>
              <option value="arc"${state.extension.czt.contour === 'arc' ? ' selected' : ''}>单位圆局部圆弧</option>
              <option value="spiral"${state.extension.czt.contour === 'spiral' ? ' selected' : ''}>外扩螺旋</option>
            </select>
          </div>
          <button type="button" class="text-button" data-extension-action="czt-apply-contour" data-contour-id="unit">DFT 特例</button>
          <button type="button" class="text-button" data-extension-action="czt-apply-contour" data-contour-id="arc">圆弧放大</button>
          <button type="button" class="text-button" data-extension-action="czt-apply-contour" data-contour-id="spiral">螺旋采样</button>
        </div>
        <div class="controls-grid controls-grid--wide" style="margin-top:12px;">
          <article class="control-card">
            <span class="control-card__title">A 参数</span>
            <div class="input-row">
              <div class="field">
                <label for="czt-a-radius">A 半径</label>
                <input id="czt-a-radius" type="number" step="0.01" value="${escapeAttribute(String(roundForInput(state.extension.czt.aRadius)))}" />
              </div>
              <div class="field">
                <label for="czt-a-angle">A 相角</label>
                <input id="czt-a-angle" type="number" step="0.01" value="${escapeAttribute(String(roundForInput(state.extension.czt.aAngle)))}" />
              </div>
            </div>
          </article>
          <article class="control-card">
            <span class="control-card__title">W 参数</span>
            <div class="input-row">
              <div class="field">
                <label for="czt-w-radius">W 半径</label>
                <input id="czt-w-radius" type="number" step="0.01" value="${escapeAttribute(String(roundForInput(state.extension.czt.wRadius)))}" />
              </div>
              <div class="field">
                <label for="czt-w-angle">W 角步长</label>
                <input id="czt-w-angle" type="number" step="0.01" value="${escapeAttribute(String(roundForInput(state.extension.czt.wAngle)))}" />
              </div>
            </div>
          </article>
          <article class="control-card">
            <span class="control-card__title">采样点数</span>
            <div class="field">
              <label for="czt-points">M</label>
              <input id="czt-points" type="number" value="${escapeAttribute(String(points))}" />
            </div>
          </article>
        </div>
      </section>

      <section class="three-column-grid">
        ${extensionChartCard(
          '输入序列 x[n]',
          'CZT 分析对象为有限长度序列。',
          buildStemOrLinePlot({
            mode: 'stem',
            data: signal.map((value, index) => ({ x: index, y: value })),
            xDomain: [0, Math.max(1, signal.length - 1)],
            yDomain: null,
            color: '#24b7a0',
            lineWidth: 1.25,
            xLabel: 'n',
            yLabel: 'x[n]',
            height: 250,
          }),
        )}
        ${extensionChartCard(
          'CZT 采样路径',
          '虚线圆为单位圆，实线为当前 z_k 采样轨迹。',
          buildComplexContourPlot(contour, [-1.8, 1.8], [-1.8, 1.8]),
        )}
        ${extensionChartCard(
          'CZT 与 DFT 幅度对比',
          '可观察 CZT 在指定路径上的放大采样效果。',
          buildMultiLinePlot({
            series: [
              {
                name: 'CZT',
                color: '#ef8a50',
                width: 1.5,
                data: magnitudes.map((value, index) => ({ x: index, y: value })),
              },
              {
                name: '同长度 DFT',
                color: '#11839f',
                width: 1.4,
                data: dftReference.map((value, index) => ({ x: index, y: value })),
              },
            ],
            xDomain: [0, Math.max(1, points - 1)],
            yDomain: null,
            xLabel: 'k',
            yLabel: '幅度',
            height: 250,
          }),
        )}
      </section>

      <section class="two-column-grid">
        <section class="extension-block">
          <div class="extension-block__header">
            <div>
              <h3>CZT 采样点数据</h3>
              <p>列出前 12 个采样点的复平面位置与对应幅值，方便截图与理论对照。</p>
            </div>
          </div>
          ${buildCompactTable(['采样点', 'Re{z_k}', 'Im{z_k}', '|X_CZT[k]|'], zRows)}
        </section>
        <section class="theory-panel">
          <h4>理论说明面板</h4>
          <p>CZT 的核心优势在于“沿指定路径采样”而不是只能沿单位圆均匀采样。这样可以把有限的计算量集中到某一段频带、某一条圆弧或者某一条螺旋线上。</p>
          <p>当 A = 1 且 W = e<sup>-j2&pi;/M</sup> 时，CZT 退化为 M 点 DFT；当改变 A 或 W 后，就可以得到比常规 DFT 更灵活的频带放大观察能力。</p>
        </section>
      </section>
    `
  }

  function resolveDfsPeriod() {
    if (state.extension.dfs.preset === 'custom') {
      try {
        return parseSequenceList(state.extension.dfs.customPeriod, 3)
      } catch (error) {
        return dfsExamplePresets[0].period.slice()
      }
    }
    const preset = dfsExamplePresets.find((item) => item.id === state.extension.dfs.preset) || dfsExamplePresets[0]
    return preset.period.slice()
  }

  function resolveDftDemo() {
    if (state.extension.dft.preset === 'custom') {
      try {
        const x = parseSequenceList(state.extension.dft.customX, 3)
        const h = parseSequenceList(state.extension.dft.customH, x.length)
        const N = Math.max(x.length, h.length)
        return {
          x: zeroPadSequence(x, N),
          h: zeroPadSequence(h, N),
          shift: mod(Math.round(state.extension.dft.shift), N),
        }
      } catch (error) {
        const preset = dftDemoPresets[0]
        return { x: preset.x.slice(), h: preset.h.slice(), shift: preset.shift }
      }
    }
    const preset = dftDemoPresets.find((item) => item.id === state.extension.dft.preset) || dftDemoPresets[0]
    return {
      x: preset.x.slice(),
      h: preset.h.slice(),
      shift: mod(Math.round(state.extension.dft.shift), preset.x.length),
    }
  }

  function resolveFrequencySamplingSequence() {
    const preset = freqSamplingPresets.find((item) => item.id === state.extension.samplingTheory.signal) || freqSamplingPresets[0]
    return preset.sequence.slice()
  }

  function resolveCztSignal() {
    const preset = cztSignalPresets.find((item) => item.id === state.extension.czt.signal) || cztSignalPresets[0]
    return preset.sequence.slice()
  }

  function stopExtensionAnimations() {
    stopShiftAnimation()
    stopConvAnimation()
  }

  function stopShiftAnimation() {
    if (extensionTimers.shift) {
      window.clearInterval(extensionTimers.shift)
      extensionTimers.shift = null
    }
  }

  function stopConvAnimation() {
    if (extensionTimers.conv) {
      window.clearInterval(extensionTimers.conv)
      extensionTimers.conv = null
    }
  }

  function toggleShiftAnimation() {
    if (extensionTimers.shift) {
      stopShiftAnimation()
      renderExtensionLab()
      return
    }
    extensionTimers.shift = window.setInterval(() => {
      state.extension.dft.shiftStage = (state.extension.dft.shiftStage + 1) % 4
      renderExtensionLab()
    }, 950)
    renderExtensionLab()
  }

  function advanceConvStage() {
    const N = resolveDftDemo().x.length
    state.extension.dft.convStage = (state.extension.dft.convStage + 1) % N
  }

  function toggleConvAnimation() {
    if (extensionTimers.conv) {
      stopConvAnimation()
      renderExtensionLab()
      return
    }
    extensionTimers.conv = window.setInterval(() => {
      advanceConvStage()
      renderExtensionLab()
    }, 900)
    renderExtensionLab()
  }

  function applyCztContourPreset(contourId) {
    const preset = cztContourPresets[contourId] || cztContourPresets.unit
    state.extension.czt.contour = contourId
    state.extension.czt.aRadius = preset.aRadius
    state.extension.czt.aAngle = preset.aAngle
    state.extension.czt.wRadius = preset.wRadius
    state.extension.czt.wAngle = preset.wAngle
  }

  function extensionChartCard(title, subtitle, svg, active) {
    return `
      <article class="extension-block${active ? ' step-card active' : ''}">
        <div class="extension-block__header">
          <div>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(subtitle)}</p>
          </div>
        </div>
        <div class="plot-frame">${svg}</div>
      </article>
    `
  }

  function buildCompactTable(columns, rows) {
    return `
      <div class="table-wrap">
        <table class="compact-table">
          <thead><tr>${columns.map((column) => `<th>${column}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows
              .map(
                (row) =>
                  `<tr>${row.map((cell) => `<td>${typeof cell === 'string' && cell.includes('<') ? cell : escapeHtml(String(cell))}</td>`).join('')}</tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
  }

  function buildDiscretePayload() {
    const selection = resolveDiscreteSelection()
    const range = sanitizeDiscreteRange(state.discrete.range)
    const nValues = buildIntegerRange(range.nMin, range.nMax)
    const sequence = nValues.map((n) => round2(selection.generator(n)))
    const omega = linspace(range.omegaMin, range.omegaMax, range.omegaSamples)
    const spectrum = omega.map((w) => computeDtftAt(sequence, nValues, w))
    const magnitudes = spectrum.map((value) => cAbs(value))
    const maxMagnitude = Math.max(...magnitudes, EPS)
    const phases = spectrum.map((value, index) => (magnitudes[index] < maxMagnitude * 0.001 ? 0 : cArg(value)))
    const peakIndex = indexOfMax(magnitudes)
    const peakOmega = omega[peakIndex]
    const energy = sequence.reduce((sum, value) => sum + value * value, 0)
    const nonzeroCount = sequence.filter((value) => Math.abs(value) > EPS).length

    return {
      sidebar: {
        eyebrow: '离散时域',
        title: '典型离散序列',
        description: '左侧点击典型序列、自定义表达式或上传样本，右侧立即显示散点序列图、DTFT 幅频图与相位谱。',
        items: buildDiscreteSidebarItems(),
      },
      controls: {
        title: '离散序列参数、范围与自定义表达式',
        html: buildDiscreteControlsHtml(selection),
      },
      summary: {
        title: selection.title,
        chip: selection.chip,
        blocks: [
          renderFormulaBlock('序列表达式', selection.formula),
          renderFormulaBlock('理论说明', selection.theory),
          renderFormulaBlock('当前说明', selection.note),
          renderComplexSummary([
            `n 范围: [${formatNumber(range.nMin)}, ${formatNumber(range.nMax)}]`,
            `ω 范围: [${formatNumber(range.omegaMin)}, ${formatNumber(range.omegaMax)}]`,
            `频谱点数: ${formatNumber(range.omegaSamples)}`,
            `非零样点数: ${formatNumber(nonzeroCount)}`,
          ]),
        ],
      },
      metrics: [
        { label: '样点数', value: formatNumber(sequence.length) },
        { label: '非零样点', value: formatNumber(nonzeroCount) },
        { label: '序列能量', value: formatNumber(energy) },
        { label: '峰值频率 ω', value: formatNumber(peakOmega) },
        { label: '峰值幅度', value: formatNumber(magnitudes[peakIndex]) },
      ],
      charts: [
        {
          eyebrow: '散点序列图',
          title: '离散序列 x[n]',
          subtitle: '按散点/抽样杆形式展示当前观察范围内的样点。',
          svg: buildStemOrLinePlot({
            mode: 'stem',
            data: nValues.map((x, index) => ({ x, y: sequence[index] })),
            xDomain: [range.nMin, range.nMax],
            yDomain: null,
            color: '#24b7a0',
            lineWidth: 1.4,
            xLabel: 'n',
            yLabel: 'x[n]',
            height: 320,
          }),
          drag: { kind: 'x-pan', section: 'discrete', axis: 'n' },
        },
        {
          eyebrow: 'DTFT 幅度谱',
          title: '幅频图 |X(e^{jω})|',
          subtitle: '折线较细，支持拖动横向查看不同频率范围。',
          svg: buildStemOrLinePlot({
            mode: 'line',
            data: omega.map((x, index) => ({ x, y: magnitudes[index] })),
            xDomain: [range.omegaMin, range.omegaMax],
            yDomain: [0, Math.max(0.1, Math.max(...magnitudes) * 1.08)],
            color: '#ef8a50',
            lineWidth: 1.6,
            xLabel: 'ω',
            yLabel: '|X|',
            height: 320,
          }),
          drag: { kind: 'x-pan', section: 'discrete', axis: 'omega' },
        },
        {
          eyebrow: 'DTFT 相位谱',
          title: '相位谱 ∠X(e^{jω})',
          subtitle: '幅值极小处相位已做抑制处理，避免无意义跳变。',
          svg: buildStemOrLinePlot({
            mode: 'line',
            data: omega.map((x, index) => ({ x, y: phases[index] })),
            xDomain: [range.omegaMin, range.omegaMax],
            yDomain: [-Math.PI, Math.PI],
            color: '#295874',
            lineWidth: 1.5,
            xLabel: 'ω',
            yLabel: '相位',
            height: 320,
          }),
          drag: { kind: 'x-pan', section: 'discrete', axis: 'omega' },
        },
      ],
      table: {
        title: '离散序列样点与频谱采样',
        caption: '表内所有数据保留两位小数。前 10 行为时域样点，后 10 行为频谱抽样。',
        columns: ['类别', '自变量', '数值 1', '数值 2'],
        rows: buildDiscreteTableRows(nValues, sequence, omega, magnitudes, phases),
      },
      notes: [
        { title: '频谱计算方式', body: '当前 DTFT 采用定义式数值求和，便于直接对照时域范围变化与频域结果变化。' },
        { title: '自定义输入', body: '可在右侧输入简单的序列运算表达式，点击“确定”后自动生成对应 DTFT 与相位谱。' },
        { title: '拖拽说明', body: '拖动序列图或频谱图，会平移对应的 n 或 ω 范围，用于查看不同区间下的图像细节。' },
      ],
    }
  }

  function buildSamplingPayload() {
    const selection = resolveSamplingSelection()
    const range = sanitizeSamplingRange(state.sampling.range)
    const denseT = linspace(range.tMin, range.tMax, range.denseSamples)
    const original = denseT.map((t) => selection.sourceFn(t))
    const sampleTimes = buildSampleTimes(range.tMin, range.tMax, range.fs)
    const sampleValues = sampleTimes.map((t) => selection.sourceFn(t))
    const zohValues = denseT.map((t) => reconstructZeroOrder(t, sampleTimes, sampleValues))
    const linearValues = denseT.map((t) => reconstructLinear(t, sampleTimes, sampleValues))
    const errorLinear = denseT.map((_, index) => original[index] - linearValues[index])
    const errorZoh = denseT.map((_, index) => original[index] - zohValues[index])
    const maxLinearError = maxAbs(errorLinear)
    const maxZohError = maxAbs(errorZoh)
    const nominalBandwidth = selection.nominalBandwidth || 0

    return {
      sidebar: {
        eyebrow: '模拟信号',
        title: '采样与插值重构',
        description: '展示连续信号原型、采样点、零阶保持与线性插值重构结果，可直接输入自定义连续信号表达式。',
        items: buildSamplingSidebarItems(),
      },
      controls: {
        title: '连续信号、采样频率与时域范围设置',
        html: buildSamplingControlsHtml(selection),
      },
      summary: {
        title: selection.title,
        chip: selection.chip,
        blocks: [
          renderFormulaBlock('连续信号表达式', selection.formula),
          renderFormulaBlock('采样理论提示', selection.theory),
          renderFormulaBlock('当前说明', selection.note),
          renderComplexSummary([
            `t 范围: [${formatNumber(range.tMin)}, ${formatNumber(range.tMax)}]`,
            `采样频率 fs: ${formatNumber(range.fs)} Hz`,
            `采样点数: ${formatNumber(sampleTimes.length)}`,
            `奈奎斯特频率: ${formatNumber(range.fs / 2)} Hz`,
          ]),
        ],
      },
      metrics: [
        { label: '采样点数', value: formatNumber(sampleTimes.length) },
        { label: '采样频率 fs', value: `${formatNumber(range.fs)} Hz` },
        { label: '奈奎斯特频率', value: `${formatNumber(range.fs / 2)} Hz` },
        { label: '线性插值最大误差', value: formatNumber(maxLinearError) },
        { label: '零阶保持最大误差', value: formatNumber(maxZohError) },
      ],
      charts: [
        {
          eyebrow: '原始与重构',
          title: '原信号 / 线性插值 / 零阶保持',
          subtitle: '同一图中对比原始连续曲线与两种插值重构结果。',
          svg: buildMultiLinePlot({
            series: [
              { name: '原始信号', color: '#11839f', width: 1.8, data: denseT.map((x, index) => ({ x, y: original[index] })) },
              { name: '线性插值', color: '#ef8a50', width: 1.5, data: denseT.map((x, index) => ({ x, y: linearValues[index] })) },
              { name: '零阶保持', color: '#24b7a0', width: 1.4, data: denseT.map((x, index) => ({ x, y: zohValues[index] })) },
            ],
            xDomain: [range.tMin, range.tMax],
            yDomain: null,
            xLabel: 't',
            yLabel: '幅值',
            height: 320,
          }),
          legend: [
            { label: '原始信号', color: '#11839f' },
            { label: '线性插值', color: '#ef8a50' },
            { label: '零阶保持', color: '#24b7a0' },
          ],
          drag: { kind: 'x-pan', section: 'sampling', axis: 'time' },
        },
        {
          eyebrow: '采样点',
          title: '采样点散点图',
          subtitle: '使用散点与采样杆突出显示时域采样位置。',
          svg: buildStemOrLinePlot({
            mode: 'stem',
            data: sampleTimes.map((x, index) => ({ x, y: sampleValues[index] })),
            xDomain: [range.tMin, range.tMax],
            yDomain: null,
            color: '#295874',
            lineWidth: 1.4,
            xLabel: 't',
            yLabel: 'x[nT]',
            height: 320,
          }),
          drag: { kind: 'x-pan', section: 'sampling', axis: 'time' },
        },
        {
          eyebrow: '重构误差',
          title: '插值误差对比',
          subtitle: '误差 = 原信号 - 重构信号，便于比较不同重构方法。',
          svg: buildMultiLinePlot({
            series: [
              { name: '线性插值误差', color: '#ef8a50', width: 1.4, data: denseT.map((x, index) => ({ x, y: errorLinear[index] })) },
              { name: '零阶保持误差', color: '#24b7a0', width: 1.4, data: denseT.map((x, index) => ({ x, y: errorZoh[index] })) },
            ],
            xDomain: [range.tMin, range.tMax],
            yDomain: null,
            xLabel: 't',
            yLabel: '误差',
            height: 320,
          }),
          legend: [
            { label: '线性插值误差', color: '#ef8a50' },
            { label: '零阶保持误差', color: '#24b7a0' },
          ],
          drag: { kind: 'x-pan', section: 'sampling', axis: 'time' },
        },
      ],
      table: {
        title: '采样点与重构数据抽样',
        caption: nominalBandwidth
          ? `表格展示部分采样时刻。当前信号主频特征约为 ${formatNumber(nominalBandwidth)} Hz，可与奈奎斯特频率对照。`
          : '表格展示部分采样时刻与线性/零阶重构结果，所有数值保留两位小数。',
        columns: ['t', '原信号', '线性插值', '零阶保持'],
        rows: buildSamplingTableRows(denseT, original, linearValues, zohValues),
      },
      notes: [
        { title: '采样与重构', body: '第二部分展示典型连续信号的采样、采样点与两类插值重构，可用于直观比较失真程度。' },
        { title: '自定义连续信号', body: '支持对典型连续信号做加减乘除等简单运算，点击“确定”后立即生成新的采样与重构图像。' },
        { title: '上传信号联动', body: hasUploadAnalyzableSignal() ? '已上传的数值样本或音频样点可在本模块中直接作为“原信号代理”进行重采样与插值实验。' : '若上传 txt/csv 数值样本或音频文件，则可在左侧切换到“上传信号”进行重采样演示。' },
      ],
    }
  }

  function buildZPayload() {
    const selection = resolveZSelection()
    const range = sanitizeZRange(state.zplane.range)
    const normalized = normalizeTransfer(selection.numerator, selection.denominator)
    const zeros = sortComplexPoints(polyRoots(normalized.numerator))
    const poles = sortComplexPoints(polyRoots(normalized.denominator))
    const omega = linspace(range.omegaMin, range.omegaMax, range.omegaSamples)
    const response = omega.map((w) => evaluateTransferAt(normalized.numerator, normalized.denominator, w))
    const magnitude = response.map((value) => cAbs(value))
    const phase = response.map((value) => cArg(value))
    const impulseN = buildIntegerRange(Math.max(0, range.nMin), Math.max(range.nMin, range.nMax))
    const impulse = impulseResponse(normalized.numerator, normalized.denominator, impulseN)
    const maxPoleRadius = poles.length ? Math.max(...poles.map((point) => cAbs(point))) : 0
    const stable = maxPoleRadius < 1 - 1e-6
    const peakIndex = indexOfMax(magnitude)

    return {
      sidebar: {
        eyebrow: 'Z 域分析',
        title: 'Z 变换零极点',
        description: '展示常见离散时间信号/系统的零极点分布、冲激响应与频率响应，并支持自定义分子分母系数输入。',
        items: buildZSidebarItems(),
      },
      controls: {
        title: '零极点、频率响应与系数设置',
        html: buildZControlsHtml(selection),
      },
      summary: {
        title: selection.title,
        chip: selection.chip,
        blocks: [
          renderFormulaBlock('Z 域表达式', selection.formula),
          renderFormulaBlock('ROC / 稳定性', `${selection.roc}；当前最大极点模为 ${formatNumber(maxPoleRadius)}，${stable ? '极点在单位圆内。' : '存在极点接近或超出单位圆。'}`),
          renderFormulaBlock('当前说明', selection.note),
          renderComplexSummary([
            `分子系数: ${formatCoefficientList(normalized.numerator)}`,
            `分母系数: ${formatCoefficientList(normalized.denominator)}`,
            `零点数: ${formatNumber(zeros.length)}`,
            `极点数: ${formatNumber(poles.length)}`,
          ]),
        ],
      },
      metrics: [
        { label: '零点数', value: formatNumber(zeros.length) },
        { label: '极点数', value: formatNumber(poles.length) },
        { label: '最大极点模', value: formatNumber(maxPoleRadius) },
        { label: '稳定性', value: stable ? '极点在单位圆内' : '需进一步判断' },
        { label: '主峰频率 ω', value: formatNumber(omega[peakIndex]) },
      ],
      charts: [
        {
          eyebrow: '零极点图',
          title: 'Z 平面零极点分布',
          subtitle: '圆圈表示零点，叉号表示极点，虚线圆为单位圆。',
          svg: buildZPlanePlot({
            zeros,
            poles,
            xDomain: [range.xMin, range.xMax],
            yDomain: [range.yMin, range.yMax],
            height: 360,
          }),
          legend: [
            { label: '零点', color: '#24b7a0' },
            { label: '极点', color: '#ef8a50' },
            { label: '单位圆', color: '#6f879c' },
          ],
          drag: { kind: 'xy-pan', section: 'zplane', axis: 'plane' },
        },
        {
          eyebrow: '冲激响应',
          title: 'h[n] 或有限序列展开',
          subtitle: '用散点/抽样杆查看对应系统或序列的前若干项时域结果。',
          svg: buildStemOrLinePlot({
            mode: 'stem',
            data: impulseN.map((x, index) => ({ x, y: impulse[index] })),
            xDomain: [Math.max(0, range.nMin), Math.max(range.nMin, range.nMax)],
            yDomain: null,
            color: '#11839f',
            lineWidth: 1.4,
            xLabel: 'n',
            yLabel: 'h[n]',
            height: 320,
          }),
          drag: { kind: 'x-pan', section: 'zplane', axis: 'n' },
        },
        {
          eyebrow: '幅频响应',
          title: '|H(e^{jω})|',
          subtitle: '极点靠近单位圆时，幅频曲线通常更尖锐。',
          svg: buildStemOrLinePlot({
            mode: 'line',
            data: omega.map((x, index) => ({ x, y: magnitude[index] })),
            xDomain: [range.omegaMin, range.omegaMax],
            yDomain: [0, Math.max(0.1, Math.max(...magnitude) * 1.08)],
            color: '#ef8a50',
            lineWidth: 1.6,
            xLabel: 'ω',
            yLabel: '|H|',
            height: 320,
          }),
          drag: { kind: 'x-pan', section: 'zplane', axis: 'omega' },
        },
        {
          eyebrow: '相位响应',
          title: '∠H(e^{jω})',
          subtitle: '便于将零极点位置与相位旋转趋势联系起来观察。',
          svg: buildStemOrLinePlot({
            mode: 'line',
            data: omega.map((x, index) => ({ x, y: phase[index] })),
            xDomain: [range.omegaMin, range.omegaMax],
            yDomain: [-Math.PI, Math.PI],
            color: '#295874',
            lineWidth: 1.5,
            xLabel: 'ω',
            yLabel: '相位',
            height: 320,
          }),
          drag: { kind: 'x-pan', section: 'zplane', axis: 'omega' },
        },
      ],
      table: {
        title: '零点、极点与频响抽样',
        caption: '表中同时给出部分零极点坐标和频率响应抽样值，便于作业截图与源码说明。',
        columns: ['类别', '位置 / ω', '实部 / 幅值', '虚部 / 相位'],
        rows: buildZTableRows(zeros, poles, omega, magnitude, phase),
      },
      notes: [
        { title: '零极点判读', body: '零点靠近单位圆会形成频率抑制，极点靠近单位圆会增强对应角频率附近的响应。' },
        { title: '自定义系数', body: '可直接输入分子与分母系数列表，例如“1, -0.8, 0.3”，点击“确定”后自动计算零极点。' },
        { title: '拖拽说明', body: '拖动零极点图可平移 z 平面显示范围，拖动冲激响应或频响图可平移 n/ω 范围。' },
      ],
    }
  }

  function buildDiscreteSidebarItems() {
    const items = discretePresets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      badge: preset.badge,
      formula: preset.formulaLabel,
      description: preset.description,
      active: state.discrete.selectedKey === preset.id,
    }))

    items.push({
      id: CUSTOM_KEY,
      name: '自定义离散序列',
      badge: '输入',
      formula: '表达式 x[n]',
      description: '对典型序列进行加减乘除等简单组合并观察 DTFT。',
      active: state.discrete.selectedKey === CUSTOM_KEY,
    })

    if (hasUploadAnalyzableSignal()) {
      items.push({
        id: UPLOAD_KEY,
        name: '上传样本序列',
        badge: '文件',
        formula: 'x_u[n]',
        description: '分析 txt/csv 样本或音频波形抽样的 DTFT 与频谱。',
        active: state.discrete.selectedKey === UPLOAD_KEY,
      })
    }

    return items
  }

  function buildSamplingSidebarItems() {
    const items = samplingPresets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      badge: preset.badge,
      formula: preset.formulaLabel,
      description: preset.description,
      active: state.sampling.selectedKey === preset.id,
    }))

    items.push({
      id: CUSTOM_KEY,
      name: '自定义连续信号',
      badge: '输入',
      formula: '表达式 x(t)',
      description: '输入连续信号表达式，实时生成采样点与插值重构结果。',
      active: state.sampling.selectedKey === CUSTOM_KEY,
    })

    if (hasUploadAnalyzableSignal()) {
      items.push({
        id: UPLOAD_KEY,
        name: '上传信号重采样',
        badge: '文件',
        formula: 'x_u(t)',
        description: '对上传样本或音频波形进行重采样与零阶/线性插值重构。',
        active: state.sampling.selectedKey === UPLOAD_KEY,
      })
    }

    return items
  }

  function buildZSidebarItems() {
    const items = zPresets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      badge: preset.badge,
      formula: preset.formulaLabel,
      description: preset.description,
      active: state.zplane.selectedKey === preset.id,
    }))

    items.push({
      id: CUSTOM_KEY,
      name: '自定义分子分母',
      badge: '系数',
      formula: 'B(z) / A(z)',
      description: '输入自定义分子和分母系数，自动完成零极点分析。',
      active: state.zplane.selectedKey === CUSTOM_KEY,
    })

    return items
  }

  function buildDiscreteControlsHtml(selection) {
    const activePresetId = discretePresets.some((preset) => preset.id === state.discrete.selectedKey)
      ? state.discrete.selectedKey
      : discretePresets[0].id
    const preset = discretePresets.find((item) => item.id === activePresetId)
    const range = sanitizeDiscreteRange(state.discrete.range)

    return `
      <div class="controls-grid controls-grid--wide">
        <article class="control-card">
          <span class="control-card__title">时域范围</span>
          <div class="input-row">
            ${numberField('n 最小值', 'discrete', 'range', 'nMin', range.nMin, 'int')}
            ${numberField('n 最大值', 'discrete', 'range', 'nMax', range.nMax, 'int')}
          </div>
        </article>
        <article class="control-card">
          <span class="control-card__title">频域范围</span>
          <div class="input-row">
            ${numberField('ω 最小值', 'discrete', 'range', 'omegaMin', range.omegaMin)}
            ${numberField('ω 最大值', 'discrete', 'range', 'omegaMax', range.omegaMax)}
          </div>
        </article>
        <article class="control-card">
          <span class="control-card__title">频谱采样点数</span>
          <div class="input-row input-row--full">
            ${numberField('ω 采样点数', 'discrete', 'range', 'omegaSamples', range.omegaSamples, 'int')}
          </div>
        </article>
        <article class="control-card">
          <span class="control-card__title">当前预设参数</span>
          ${
            preset && preset.parameters.length
              ? `<div class="input-row input-row--full">${preset.parameters
                  .map((param) =>
                    numberField(
                      param.label,
                      'discrete',
                      'param',
                      param.key,
                      state.discrete.params[preset.id][param.key],
                      Number.isInteger(param.step) ? 'int' : 'float',
                      preset.id,
                      param.step,
                      param.min,
                      param.max,
                    ),
                  )
                  .join('')}</div>`
              : '<p class="table-caption">当前项目没有额外参数，点击左侧其他典型序列可切换。</p>'
          }
        </article>
      </div>
      <article class="control-card">
        <span class="control-card__title">自定义离散序列表达式</span>
        <div class="inline-action">
          <div class="field">
            <label for="discrete-expression">输入表达式</label>
            <textarea id="discrete-expression" data-control="text" data-section="discrete" data-key="draftExpression">${escapeHtml(state.discrete.draftExpression)}</textarea>
          </div>
          <button type="button" class="primary-button" data-action="submit-discrete-custom">确定</button>
        </div>
        <p class="table-caption">${escapeHtml(DISCRETE_HELP)}</p>
        <div class="ghost-chip-list">
          ${DISCRETE_EXAMPLES.map(
            (example) =>
              `<button type="button" class="ghost-chip" data-action="set-discrete-example" data-value="${escapeAttribute(example)}">${escapeHtml(example)}</button>`,
          ).join('')}
        </div>
        ${state.discrete.error ? `<p class="error-text">${escapeHtml(state.discrete.error)}</p>` : ''}
      </article>
      ${
        state.discrete.selectedKey === UPLOAD_KEY && hasUploadAnalyzableSignal()
          ? `<article class="control-card"><span class="control-card__title">上传样本说明</span><p class="table-caption">当前已载入 ${formatNumber(
              state.upload.samples.length,
            )} 个样点，离散时域默认按 n = 0, 1, 2, ... 对齐；拖动图像或修改范围可查看不同片段。</p></article>`
          : ''
      }
    `
  }

  function buildSamplingControlsHtml(selection) {
    const activePresetId = samplingPresets.some((preset) => preset.id === state.sampling.selectedKey)
      ? state.sampling.selectedKey
      : samplingPresets[0].id
    const preset = samplingPresets.find((item) => item.id === activePresetId)
    const range = sanitizeSamplingRange(state.sampling.range)

    return `
      <div class="controls-grid">
        <article class="control-card">
          <span class="control-card__title">时域范围</span>
          <div class="input-row">
            ${numberField('t 最小值', 'sampling', 'range', 'tMin', range.tMin)}
            ${numberField('t 最大值', 'sampling', 'range', 'tMax', range.tMax)}
          </div>
        </article>
        <article class="control-card">
          <span class="control-card__title">采样频率</span>
          <div class="input-row input-row--full">
            ${numberField('fs (Hz)', 'sampling', 'range', 'fs', range.fs)}
          </div>
        </article>
        <article class="control-card">
          <span class="control-card__title">当前预设参数</span>
          ${
            preset && preset.parameters.length
              ? `<div class="input-row input-row--full">${preset.parameters
                  .map((param) =>
                    numberField(
                      param.label,
                      'sampling',
                      'param',
                      param.key,
                      state.sampling.params[preset.id][param.key],
                      Number.isInteger(param.step) ? 'int' : 'float',
                      preset.id,
                      param.step,
                      param.min,
                      param.max,
                    ),
                  )
                  .join('')}</div>`
              : '<p class="table-caption">当前项目没有额外参数，点击左侧其他信号可切换。</p>'
          }
        </article>
      </div>
      <article class="control-card">
        <span class="control-card__title">自定义连续信号表达式</span>
        <div class="inline-action">
          <div class="field">
            <label for="sampling-expression">输入表达式</label>
            <textarea id="sampling-expression" data-control="text" data-section="sampling" data-key="draftExpression">${escapeHtml(state.sampling.draftExpression)}</textarea>
          </div>
          <button type="button" class="primary-button" data-action="submit-sampling-custom">确定</button>
        </div>
        <p class="table-caption">${escapeHtml(SAMPLING_HELP)}</p>
        <div class="ghost-chip-list">
          ${SAMPLING_EXAMPLES.map(
            (example) =>
              `<button type="button" class="ghost-chip" data-action="set-sampling-example" data-value="${escapeAttribute(example)}">${escapeHtml(example)}</button>`,
          ).join('')}
        </div>
        ${state.sampling.error ? `<p class="error-text">${escapeHtml(state.sampling.error)}</p>` : ''}
      </article>
      ${
        state.sampling.selectedKey === UPLOAD_KEY && hasUploadAnalyzableSignal()
          ? `<article class="control-card"><span class="control-card__title">上传信号说明</span><p class="table-caption">上传样本在本模块中会先被视为“原始波形代理”，再按照当前 fs 重新采样并做零阶保持与线性插值重构。</p></article>`
          : ''
      }
    `
  }

  function buildZControlsHtml(selection) {
    const activePresetId = zPresets.some((preset) => preset.id === state.zplane.selectedKey)
      ? state.zplane.selectedKey
      : zPresets[0].id
    const preset = zPresets.find((item) => item.id === activePresetId)
    const range = sanitizeZRange(state.zplane.range)

    return `
      <div class="controls-grid controls-grid--wide">
        <article class="control-card">
          <span class="control-card__title">冲激响应范围</span>
          <div class="input-row">
            ${numberField('n 最小值', 'zplane', 'range', 'nMin', range.nMin, 'int')}
            ${numberField('n 最大值', 'zplane', 'range', 'nMax', range.nMax, 'int')}
          </div>
        </article>
        <article class="control-card">
          <span class="control-card__title">频域范围</span>
          <div class="input-row">
            ${numberField('ω 最小值', 'zplane', 'range', 'omegaMin', range.omegaMin)}
            ${numberField('ω 最大值', 'zplane', 'range', 'omegaMax', range.omegaMax)}
          </div>
        </article>
        <article class="control-card">
          <span class="control-card__title">Z 平面 x 轴</span>
          <div class="input-row">
            ${numberField('x 最小值', 'zplane', 'range', 'xMin', range.xMin)}
            ${numberField('x 最大值', 'zplane', 'range', 'xMax', range.xMax)}
          </div>
        </article>
        <article class="control-card">
          <span class="control-card__title">Z 平面 y 轴</span>
          <div class="input-row">
            ${numberField('y 最小值', 'zplane', 'range', 'yMin', range.yMin)}
            ${numberField('y 最大值', 'zplane', 'range', 'yMax', range.yMax)}
          </div>
        </article>
      </div>
      <div class="controls-grid">
        <article class="control-card">
          <span class="control-card__title">当前预设参数</span>
          ${
            preset && preset.parameters.length
              ? `<div class="input-row input-row--full">${preset.parameters
                  .map((param) =>
                    numberField(
                      param.label,
                      'zplane',
                      'param',
                      param.key,
                      state.zplane.params[preset.id][param.key],
                      Number.isInteger(param.step) ? 'int' : 'float',
                      preset.id,
                      param.step,
                      param.min,
                      param.max,
                    ),
                  )
                  .join('')}</div>`
              : '<p class="table-caption">当前项目没有额外参数，或你正在查看自定义分子分母项。</p>'
          }
        </article>
        <article class="control-card">
          <span class="control-card__title">自定义分子 / 分母系数</span>
          <div class="field">
            <label for="z-numerator">分子系数 b0, b1, ...</label>
            <input id="z-numerator" type="text" data-control="text" data-section="zplane" data-key="draftNumerator" value="${escapeAttribute(state.zplane.draftNumerator)}" />
          </div>
          <div class="field">
            <label for="z-denominator">分母系数 a0, a1, ...</label>
            <input id="z-denominator" type="text" data-control="text" data-section="zplane" data-key="draftDenominator" value="${escapeAttribute(state.zplane.draftDenominator)}" />
          </div>
          <div class="ghost-chip-list">
            ${Z_EXAMPLES.map(
              (example, index) =>
                `<button type="button" class="ghost-chip" data-action="set-z-example" data-numerator="${escapeAttribute(example.numerator)}" data-denominator="${escapeAttribute(example.denominator)}">示例 ${index + 1}</button>`,
            ).join('')}
          </div>
          <div style="margin-top: 10px;">
            <button type="button" class="primary-button" data-action="submit-z-custom">确定</button>
          </div>
          ${state.zplane.error ? `<p class="error-text">${escapeHtml(state.zplane.error)}</p>` : ''}
        </article>
      </div>
    `
  }

  function resolveDiscreteSelection() {
    if (state.discrete.selectedKey === CUSTOM_KEY) {
      const expression = state.discrete.committedExpression
      const evaluator = compileExpression(expression, 'n', buildDiscreteHelpers())
      return {
        title: '自定义离散序列',
        chip: '自定义',
        formula: `x[n] = ${expression}`,
        theory: '用户输入表达式按当前 n 范围逐点求值，再计算数值 DTFT。',
        note: '适用于对典型序列进行简单的相加、减、乘、除组合。',
        generator(n) {
          return evaluator(n)
        },
      }
    }

    if (state.discrete.selectedKey === UPLOAD_KEY && hasUploadAnalyzableSignal()) {
      const samples = state.upload.samples
      return {
        title: '上传样本序列',
        chip: state.upload.kind === 'audio' ? '上传音频' : '上传样本',
        formula: 'x_u[n] = 上传文件样点',
        theory: '将上传样点视作有限长离散序列并直接计算其数值 DTFT。',
        note: state.upload.message,
        generator(n) {
          return n >= 0 && n < samples.length ? samples[n] : 0
        },
      }
    }

    const preset = discretePresets.find((item) => item.id === state.discrete.selectedKey) || discretePresets[0]
    const model = preset.build(state.discrete.params[preset.id] || preset.defaults)
    return {
      ...model,
      chip: preset.badge,
    }
  }

  function resolveSamplingSelection() {
    if (state.sampling.selectedKey === CUSTOM_KEY) {
      const expression = state.sampling.committedExpression
      const evaluator = compileExpression(expression, 't', buildSamplingHelpers())
      return {
        title: '自定义连续信号',
        chip: '自定义',
        formula: `x(t) = ${expression}`,
        theory: '用户输入表达式按当前 t 范围连续采样，再进行重采样与两类插值重构。',
        note: '适用于对典型连续信号做简单加减乘除组合。',
        nominalBandwidth: 0,
        sourceFn(t) {
          return evaluator(t)
        },
      }
    }

    if (state.sampling.selectedKey === UPLOAD_KEY && hasUploadAnalyzableSignal()) {
      const samples = state.upload.samples
      const sampleRate = state.upload.sampleRate || 12
      return {
        title: '上传信号重采样',
        chip: state.upload.kind === 'audio' ? '上传音频' : '上传样本',
        formula: `x_u(t) = 上传样点线性代理，原采样率约 ${formatNumber(sampleRate)} Hz`,
        theory: '先将上传样本构造成线性连续代理，再按当前 fs 二次采样并进行插值重构。',
        note: state.upload.message,
        nominalBandwidth: sampleRate / 2,
        sourceFn(t) {
          return sampleProxyValue(samples, sampleRate, t)
        },
      }
    }

    const preset = samplingPresets.find((item) => item.id === state.sampling.selectedKey) || samplingPresets[0]
    const model = preset.build(state.sampling.params[preset.id] || preset.defaults)
    return {
      ...model,
      chip: preset.badge,
    }
  }

  function resolveZSelection() {
    if (state.zplane.selectedKey === CUSTOM_KEY) {
      return {
        title: '自定义分子分母系数',
        chip: '自定义',
        formula: `H(z) = B(z) / A(z)，B = ${formatCoefficientList(state.zplane.committedNumerator)}，A = ${formatCoefficientList(state.zplane.committedDenominator)}`,
        numerator: state.zplane.committedNumerator,
        denominator: state.zplane.committedDenominator,
        roc: 'ROC 需结合系统实现方式判断；若按因果系统解释，则通常位于最外极点之外。',
        note: '当前结果根据输入系数直接求根并生成零极点分布。',
      }
    }

    const preset = zPresets.find((item) => item.id === state.zplane.selectedKey) || zPresets[0]
    const model = preset.build(state.zplane.params[preset.id] || preset.defaults)
    return {
      ...model,
      chip: preset.badge,
    }
  }

  function buildDiscreteTableRows(nValues, sequence, omega, magnitude, phase) {
    const rows = []
    const sampleCount = Math.min(10, nValues.length)
    for (let index = 0; index < sampleCount; index += 1) {
      rows.push(['时域', formatNumber(nValues[index]), formatNumber(sequence[index]), '-'])
    }
    const omegaIndices = takeEvenlySpacedIndices(omega.length, Math.min(10, omega.length))
    omegaIndices.forEach((index) => {
      rows.push(['频域', formatNumber(omega[index]), formatNumber(magnitude[index]), formatNumber(phase[index])])
    })
    return rows
  }

  function buildSamplingTableRows(tValues, original, linearValues, zohValues) {
    const indices = takeEvenlySpacedIndices(tValues.length, Math.min(14, tValues.length))
    return indices.map((index) => [
      formatNumber(tValues[index]),
      formatNumber(original[index]),
      formatNumber(linearValues[index]),
      formatNumber(zohValues[index]),
    ])
  }

  function buildZTableRows(zeros, poles, omega, magnitude, phase) {
    const rows = []
    zeros.slice(0, 6).forEach((point, index) => {
      rows.push([`零点 ${index + 1}`, '-', formatNumber(point.re), formatNumber(point.im)])
    })
    poles.slice(0, 6).forEach((point, index) => {
      rows.push([`极点 ${index + 1}`, '-', formatNumber(point.re), formatNumber(point.im)])
    })
    const indices = takeEvenlySpacedIndices(omega.length, Math.min(6, omega.length))
    indices.forEach((index) => {
      rows.push(['频响', formatNumber(omega[index]), formatNumber(magnitude[index]), formatNumber(phase[index])])
    })
    return rows
  }

  function renderFormulaBlock(label, value) {
    return `
      <div class="formula-block">
        <span class="formula-block__label">${escapeHtml(label)}</span>
        <code>${escapeHtml(value)}</code>
      </div>
    `
  }

  function renderComplexSummary(items) {
    return `
      <div class="complex-summary">
        ${items.map((item) => `<div class="complex-pill">${escapeHtml(item)}</div>`).join('')}
      </div>
    `
  }

  function renderLegendChip(entry) {
    return `<span class="ghost-chip"><span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:${entry.color};margin-right:8px;vertical-align:middle;"></span>${escapeHtml(entry.label)}</span>`
  }

  function numberField(label, section, group, key, value, parseAs, presetId, step, min, max) {
    const attrs = [
      `data-control="number"`,
      `data-section="${section}"`,
      `data-group="${group}"`,
      `data-key="${key}"`,
      `data-parse="${parseAs || 'float'}"`,
    ]
    if (presetId) {
      attrs.push(`data-preset="${presetId}"`)
    }
    if (step != null) {
      attrs.push(`step="${step}"`)
    }
    if (min != null) {
      attrs.push(`min="${min}"`)
    }
    if (max != null) {
      attrs.push(`max="${max}"`)
    }
    return `
      <div class="field">
        <label>${escapeHtml(label)}</label>
        <input type="number" value="${escapeAttribute(String(roundForInput(value)))}" ${attrs.join(' ')} />
      </div>
    `
  }

  function buildDragAttributes(drag) {
    return `data-drag-kind="${drag.kind}" data-drag-section="${drag.section}" data-drag-axis="${drag.axis}"`
  }

  function startDrag(event) {
    const frame = event.currentTarget
    const section = frame.dataset.dragSection
    const kind = frame.dataset.dragKind
    const axis = frame.dataset.dragAxis
    if (!section || !kind || !axis) {
      return
    }
    state.drag = {
      section,
      kind,
      axis,
      startX: event.clientX,
      startY: event.clientY,
      snapshot: JSON.parse(JSON.stringify(state[section].range)),
    }
    event.preventDefault()
  }

  function handleDragMove(event) {
    if (!state.drag) {
      return
    }
    const drag = state.drag
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY

    if (drag.section === 'discrete') {
      applyDiscretePan(drag, dx)
    } else if (drag.section === 'sampling') {
      applySamplingPan(drag, dx)
    } else if (drag.section === 'zplane') {
      applyZPan(drag, dx, dy)
    }
    render()
  }

  function finishDrag() {
    state.drag = null
  }

  function applyDiscretePan(drag, dx) {
    const snapshot = drag.snapshot
    if (drag.axis === 'n') {
      const span = snapshot.nMax - snapshot.nMin
      const delta = Math.round((-dx / 900) * Math.max(1, span))
      state.discrete.range.nMin = snapshot.nMin + delta
      state.discrete.range.nMax = snapshot.nMax + delta
      return
    }
    const span = snapshot.omegaMax - snapshot.omegaMin
    const delta = (-dx / 900) * span
    state.discrete.range.omegaMin = round2(snapshot.omegaMin + delta)
    state.discrete.range.omegaMax = round2(snapshot.omegaMax + delta)
  }

  function applySamplingPan(drag, dx) {
    const snapshot = drag.snapshot
    const span = snapshot.tMax - snapshot.tMin
    const delta = (-dx / 900) * span
    state.sampling.range.tMin = round2(snapshot.tMin + delta)
    state.sampling.range.tMax = round2(snapshot.tMax + delta)
  }

  function applyZPan(drag, dx, dy) {
    const snapshot = drag.snapshot
    if (drag.axis === 'plane') {
      const spanX = snapshot.xMax - snapshot.xMin
      const spanY = snapshot.yMax - snapshot.yMin
      const deltaX = (-dx / 900) * spanX
      const deltaY = (dy / 900) * spanY
      state.zplane.range.xMin = round2(snapshot.xMin + deltaX)
      state.zplane.range.xMax = round2(snapshot.xMax + deltaX)
      state.zplane.range.yMin = round2(snapshot.yMin + deltaY)
      state.zplane.range.yMax = round2(snapshot.yMax + deltaY)
      return
    }
    if (drag.axis === 'n') {
      const span = snapshot.nMax - snapshot.nMin
      const delta = Math.round((-dx / 900) * Math.max(1, span))
      state.zplane.range.nMin = Math.max(0, snapshot.nMin + delta)
      state.zplane.range.nMax = Math.max(state.zplane.range.nMin + 1, snapshot.nMax + delta)
      return
    }
    const span = snapshot.omegaMax - snapshot.omegaMin
    const delta = (-dx / 900) * span
    state.zplane.range.omegaMin = round2(snapshot.omegaMin + delta)
    state.zplane.range.omegaMax = round2(snapshot.omegaMax + delta)
  }

  function buildStemOrLinePlot(config) {
    const width = 980
    const height = config.height || 320
    const margin = { top: 22, right: 24, bottom: 52, left: 66 }
    const xDomain = config.xDomain
    const yDomain = config.yDomain || computePaddedYDomain(config.data.map((item) => item.y), true)
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom
    const xTicks = createTicks(xDomain[0], xDomain[1], 5)
    const yTicks = createTicks(yDomain[0], yDomain[1], 5)
    const xAtZero = xDomain[0] <= 0 && xDomain[1] >= 0 ? scaleX(0, xDomain, margin.left, innerWidth) : null
    const yAtZero = yDomain[0] <= 0 && yDomain[1] >= 0 ? scaleY(0, yDomain, margin.top, innerHeight) : null

    const grid = [
      ...xTicks.map((tick) => {
        const x = scaleX(tick, xDomain, margin.left, innerWidth)
        return `<line x1="${x}" y1="${margin.top}" x2="${x}" y2="${height - margin.bottom}" stroke="rgba(111,132,153,0.12)" stroke-width="1" />`
      }),
      ...yTicks.map((tick) => {
        const y = scaleY(tick, yDomain, margin.top, innerHeight)
        return `<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="rgba(111,132,153,0.12)" stroke-width="1" />`
      }),
    ].join('')

    const stems =
      config.mode === 'stem'
        ? config.data
            .map((point) => {
              const x = scaleX(point.x, xDomain, margin.left, innerWidth)
              const y = scaleY(point.y, yDomain, margin.top, innerHeight)
              const baseY = yAtZero == null ? height - margin.bottom : yAtZero
              return `
                <line x1="${x}" y1="${baseY}" x2="${x}" y2="${y}" stroke="${config.color}" stroke-width="${config.lineWidth || 1.4}" />
                <circle cx="${x}" cy="${y}" r="4" fill="${config.color}" />
              `
            })
            .join('')
        : ''

    const path =
      config.mode === 'line'
        ? buildPathString(
            config.data.map((point) => ({
              x: scaleX(point.x, xDomain, margin.left, innerWidth),
              y: scaleY(point.y, yDomain, margin.top, innerHeight),
            })),
          )
        : ''

    const line =
      config.mode === 'line'
        ? `<path d="${path}" fill="none" stroke="${config.color}" stroke-width="${config.lineWidth || 1.6}" stroke-linejoin="round" stroke-linecap="round" />`
        : ''

    return `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttribute(config.xLabel)} 和 ${escapeAttribute(config.yLabel)} 图">
        ${grid}
        ${
          xAtZero != null
            ? `<line x1="${xAtZero}" y1="${margin.top}" x2="${xAtZero}" y2="${height - margin.bottom}" stroke="rgba(41,88,116,0.28)" stroke-width="1.2" />`
            : ''
        }
        ${
          yAtZero != null
            ? `<line x1="${margin.left}" y1="${yAtZero}" x2="${width - margin.right}" y2="${yAtZero}" stroke="rgba(41,88,116,0.28)" stroke-width="1.2" />`
            : ''
        }
        ${stems}
        ${line}
        ${renderAxesAndLabels(width, height, margin, xTicks, yTicks, xDomain, yDomain, config.xLabel, config.yLabel)}
      </svg>
    `
  }

  function buildMultiLinePlot(config) {
    const width = 980
    const height = config.height || 320
    const margin = { top: 22, right: 24, bottom: 52, left: 66 }
    const xDomain = config.xDomain
    const yValues = config.series.flatMap((series) => series.data.map((point) => point.y))
    const yDomain = config.yDomain || computePaddedYDomain(yValues, true)
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom
    const xTicks = createTicks(xDomain[0], xDomain[1], 5)
    const yTicks = createTicks(yDomain[0], yDomain[1], 5)
    const xAtZero = xDomain[0] <= 0 && xDomain[1] >= 0 ? scaleX(0, xDomain, margin.left, innerWidth) : null
    const yAtZero = yDomain[0] <= 0 && yDomain[1] >= 0 ? scaleY(0, yDomain, margin.top, innerHeight) : null

    const grid = [
      ...xTicks.map((tick) => {
        const x = scaleX(tick, xDomain, margin.left, innerWidth)
        return `<line x1="${x}" y1="${margin.top}" x2="${x}" y2="${height - margin.bottom}" stroke="rgba(111,132,153,0.12)" stroke-width="1" />`
      }),
      ...yTicks.map((tick) => {
        const y = scaleY(tick, yDomain, margin.top, innerHeight)
        return `<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="rgba(111,132,153,0.12)" stroke-width="1" />`
      }),
    ].join('')

    const paths = config.series
      .map((series) => {
        const path = buildPathString(
          series.data.map((point) => ({
            x: scaleX(point.x, xDomain, margin.left, innerWidth),
            y: scaleY(point.y, yDomain, margin.top, innerHeight),
          })),
        )
        return `<path d="${path}" fill="none" stroke="${series.color}" stroke-width="${series.width || 1.6}" stroke-linejoin="round" stroke-linecap="round" />`
      })
      .join('')

    return `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttribute(config.xLabel)} 和 ${escapeAttribute(config.yLabel)} 图">
        ${grid}
        ${
          xAtZero != null
            ? `<line x1="${xAtZero}" y1="${margin.top}" x2="${xAtZero}" y2="${height - margin.bottom}" stroke="rgba(41,88,116,0.28)" stroke-width="1.2" />`
            : ''
        }
        ${
          yAtZero != null
            ? `<line x1="${margin.left}" y1="${yAtZero}" x2="${width - margin.right}" y2="${yAtZero}" stroke="rgba(41,88,116,0.28)" stroke-width="1.2" />`
            : ''
        }
        ${paths}
        ${renderAxesAndLabels(width, height, margin, xTicks, yTicks, xDomain, yDomain, config.xLabel, config.yLabel)}
      </svg>
    `
  }

  function buildSpectrumSamplingPlot(omegaLine, valuesLine, sampledPoints, xDomain, lineColor, pointColor, yLabel) {
    const width = 980
    const height = 250
    const margin = { top: 22, right: 24, bottom: 52, left: 66 }
    const yDomain = computePaddedYDomain(valuesLine.concat(sampledPoints.map((item) => item.y)), true)
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom
    const xTicks = createTicks(xDomain[0], xDomain[1], 5)
    const yTicks = createTicks(yDomain[0], yDomain[1], 5)

    const linePath = buildPathString(
      omegaLine.map((x, index) => ({
        x: scaleX(x, xDomain, margin.left, innerWidth),
        y: scaleY(valuesLine[index], yDomain, margin.top, innerHeight),
      })),
    )

    const points = sampledPoints
      .map((point) => {
        const cx = scaleX(point.x, xDomain, margin.left, innerWidth)
        const cy = scaleY(point.y, yDomain, margin.top, innerHeight)
        return `<circle cx="${cx}" cy="${cy}" r="4.2" fill="${pointColor}" />`
      })
      .join('')

    const grid = [
      ...xTicks.map((tick) => {
        const x = scaleX(tick, xDomain, margin.left, innerWidth)
        return `<line x1="${x}" y1="${margin.top}" x2="${x}" y2="${height - margin.bottom}" stroke="rgba(111,132,153,0.12)" stroke-width="1" />`
      }),
      ...yTicks.map((tick) => {
        const y = scaleY(tick, yDomain, margin.top, innerHeight)
        return `<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="rgba(111,132,153,0.12)" stroke-width="1" />`
      }),
    ].join('')

    return `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="频域采样图">
        ${grid}
        <path d="${linePath}" fill="none" stroke="${lineColor}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
        ${points}
        ${renderAxesAndLabels(width, height, margin, xTicks, yTicks, xDomain, yDomain, 'ω', yLabel)}
      </svg>
    `
  }

  function buildComplexContourPlot(points, xDomain, yDomain) {
    const width = 980
    const height = 250
    const margin = { top: 24, right: 24, bottom: 42, left: 52 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom
    const xTicks = createTicks(xDomain[0], xDomain[1], 5)
    const yTicks = createTicks(yDomain[0], yDomain[1], 5)
    const xAxis = scaleX(0, xDomain, margin.left, innerWidth)
    const yAxis = scaleY(0, yDomain, margin.top, innerHeight)
    const unitRadius = Math.abs(scaleX(1, xDomain, margin.left, innerWidth) - scaleX(0, xDomain, margin.left, innerWidth))

    const contourPath = buildPathString(
      points.map((point) => ({
        x: scaleX(point.re, xDomain, margin.left, innerWidth),
        y: scaleY(point.im, yDomain, margin.top, innerHeight),
      })),
    )

    const dots = points
      .map((point, index) => {
        const cx = scaleX(point.re, xDomain, margin.left, innerWidth)
        const cy = scaleY(point.im, yDomain, margin.top, innerHeight)
        return `
          <circle cx="${cx}" cy="${cy}" r="4" fill="${index === 0 ? '#ef8a50' : '#24b7a0'}" />
        `
      })
      .join('')

    const grid = [
      ...xTicks.map((tick) => {
        const x = scaleX(tick, xDomain, margin.left, innerWidth)
        return `<line x1="${x}" y1="${margin.top}" x2="${x}" y2="${height - margin.bottom}" stroke="rgba(111,132,153,0.12)" stroke-width="1" />`
      }),
      ...yTicks.map((tick) => {
        const y = scaleY(tick, yDomain, margin.top, innerHeight)
        return `<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="rgba(111,132,153,0.12)" stroke-width="1" />`
      }),
    ].join('')

    return `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="CZT 轨迹图">
        ${grid}
        <circle cx="${xAxis}" cy="${yAxis}" r="${unitRadius}" fill="none" stroke="rgba(111,132,153,0.55)" stroke-width="1.4" stroke-dasharray="6 6" />
        <line x1="${margin.left}" y1="${yAxis}" x2="${width - margin.right}" y2="${yAxis}" stroke="rgba(41,88,116,0.32)" stroke-width="1.2" />
        <line x1="${xAxis}" y1="${margin.top}" x2="${xAxis}" y2="${height - margin.bottom}" stroke="rgba(41,88,116,0.32)" stroke-width="1.2" />
        <path d="${contourPath}" fill="none" stroke="#11839f" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
        ${dots}
        ${renderAxesAndLabels(width, height, margin, xTicks, yTicks, xDomain, yDomain, 'Re{z}', 'Im{z}')}
      </svg>
    `
  }

  function buildZPlanePlot(config) {
    const width = 980
    const height = config.height || 360
    const margin = { top: 24, right: 24, bottom: 42, left: 52 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom
    const xTicks = createTicks(config.xDomain[0], config.xDomain[1], 5)
    const yTicks = createTicks(config.yDomain[0], config.yDomain[1], 5)
    const xAxis = scaleX(0, config.xDomain, margin.left, innerWidth)
    const yAxis = scaleY(0, config.yDomain, margin.top, innerHeight)
    const unitRadius = Math.abs(config.xDomain[1] - config.xDomain[0]) > EPS ? Math.abs(scaleX(1, config.xDomain, margin.left, innerWidth) - scaleX(0, config.xDomain, margin.left, innerWidth)) : 0

    const grid = [
      ...xTicks.map((tick) => {
        const x = scaleX(tick, config.xDomain, margin.left, innerWidth)
        return `<line x1="${x}" y1="${margin.top}" x2="${x}" y2="${height - margin.bottom}" stroke="rgba(111,132,153,0.12)" stroke-width="1" />`
      }),
      ...yTicks.map((tick) => {
        const y = scaleY(tick, config.yDomain, margin.top, innerHeight)
        return `<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="rgba(111,132,153,0.12)" stroke-width="1" />`
      }),
    ].join('')

    const zeroMarks = config.zeros
      .map((point) => {
        const cx = scaleX(point.re, config.xDomain, margin.left, innerWidth)
        const cy = scaleY(point.im, config.yDomain, margin.top, innerHeight)
        return `<circle cx="${cx}" cy="${cy}" r="8" fill="none" stroke="#24b7a0" stroke-width="2.4" />`
      })
      .join('')

    const poleMarks = config.poles
      .map((point) => {
        const cx = scaleX(point.re, config.xDomain, margin.left, innerWidth)
        const cy = scaleY(point.im, config.yDomain, margin.top, innerHeight)
        return `
          <line x1="${cx - 8}" y1="${cy - 8}" x2="${cx + 8}" y2="${cy + 8}" stroke="#ef8a50" stroke-width="2.4" />
          <line x1="${cx - 8}" y1="${cy + 8}" x2="${cx + 8}" y2="${cy - 8}" stroke="#ef8a50" stroke-width="2.4" />
        `
      })
      .join('')

    return `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Z 平面零极点图">
        ${grid}
        <circle cx="${xAxis}" cy="${yAxis}" r="${unitRadius}" fill="none" stroke="rgba(111,132,153,0.6)" stroke-width="1.5" stroke-dasharray="6 6" />
        <line x1="${margin.left}" y1="${yAxis}" x2="${width - margin.right}" y2="${yAxis}" stroke="rgba(41,88,116,0.32)" stroke-width="1.4" />
        <line x1="${xAxis}" y1="${margin.top}" x2="${xAxis}" y2="${height - margin.bottom}" stroke="rgba(41,88,116,0.32)" stroke-width="1.4" />
        ${zeroMarks}
        ${poleMarks}
        ${renderAxesAndLabels(width, height, margin, xTicks, yTicks, config.xDomain, config.yDomain, 'Re{z}', 'Im{z}')}
      </svg>
    `
  }

  function renderAxesAndLabels(width, height, margin, xTicks, yTicks, xDomain, yDomain, xLabel, yLabel) {
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom
    const xLabels = xTicks
      .map((tick) => {
        const x = scaleX(tick, xDomain, margin.left, innerWidth)
        return `<text x="${x}" y="${height - margin.bottom + 22}" font-size="12" text-anchor="middle" fill="#6f879c">${formatNumber(tick)}</text>`
      })
      .join('')
    const yLabels = yTicks
      .map((tick) => {
        const y = scaleY(tick, yDomain, margin.top, innerHeight)
        return `<text x="${margin.left - 10}" y="${y + 4}" font-size="12" text-anchor="end" fill="#6f879c">${formatNumber(tick)}</text>`
      })
      .join('')
    return `
      ${xLabels}
      ${yLabels}
      <text x="${margin.left + innerWidth / 2}" y="${height - 10}" font-size="13" text-anchor="middle" fill="#38556d">${escapeHtml(xLabel)}</text>
      <text x="18" y="${margin.top + innerHeight / 2}" font-size="13" text-anchor="middle" fill="#38556d" transform="rotate(-90 18 ${margin.top + innerHeight / 2})">${escapeHtml(yLabel)}</text>
    `
  }

  function buildPathString(points) {
    return points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ')
  }

  function buildIntegerRange(min, max) {
    const values = []
    for (let current = Math.round(min); current <= Math.round(max); current += 1) {
      values.push(current)
    }
    return values
  }

  function buildSampleTimes(tMin, tMax, fs) {
    const step = 1 / Math.max(fs, 0.1)
    const startIndex = Math.ceil(tMin / step)
    const endIndex = Math.floor(tMax / step)
    const times = []
    for (let index = startIndex; index <= endIndex; index += 1) {
      times.push(round2(index * step))
    }
    if (!times.length) {
      times.push(round2(tMin), round2(tMax))
    }
    return times
  }

  function buildDefaultParamStore(presets) {
    return presets.reduce((store, preset) => {
      store[preset.id] = { ...(preset.defaults || {}) }
      return store
    }, {})
  }

  function buildDiscreteHelpers() {
    return {
      pi: Math.PI,
      e: Math.E,
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      abs: Math.abs,
      pow: Math.pow,
      exp: Math.exp,
      sqrt: Math.sqrt,
      log: Math.log,
      floor: Math.floor,
      ceil: Math.ceil,
      round: Math.round,
      delta(x) {
        return Math.abs(x) < EPS ? 1 : 0
      },
      u(x) {
        return x >= 0 ? 1 : 0
      },
      rect(x, N) {
        return x >= 0 && x <= Math.round(N) - 1 ? 1 : 0
      },
      tri(x, N) {
        const width = Math.max(1, Math.round(N))
        const distance = Math.abs(x)
        return distance > width ? 0 : 1 - distance / (width + 1)
      },
      expseq(a, x) {
        return x >= 0 ? Math.pow(a, x) : 0
      },
      sinseq(w0, x, phi) {
        return Math.sin(w0 * x + (phi || 0))
      },
      cosseq(w0, x, phi) {
        return Math.cos(w0 * x + (phi || 0))
      },
    }
  }

  function buildSamplingHelpers() {
    return {
      pi: Math.PI,
      e: Math.E,
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      abs: Math.abs,
      pow: Math.pow,
      exp: Math.exp,
      sqrt: Math.sqrt,
      log: Math.log,
      floor: Math.floor,
      ceil: Math.ceil,
      round: Math.round,
      sinc(x) {
        return Math.abs(x) < EPS ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)
      },
      gauss(t, sigma) {
        const width = Math.max(0.05, sigma || 0.4)
        return Math.exp(-Math.pow(t / width, 2))
      },
      pulse(t, T) {
        const width = Math.max(0.05, T || 1)
        return Math.abs(t) <= width / 2 ? 1 : 0
      },
    }
  }

  function compileExpression(expression, variableName, helpers) {
    const normalized = normalizeExpression(expression)
    if (!normalized) {
      throw new Error('表达式不能为空。')
    }
    if (!/^[0-9a-zA-Z_\s+\-*/^().,|]*$/.test(normalized)) {
      throw new Error('表达式包含不支持的字符。')
    }
    if (/(=>|=|;|\[|\]|\{|\}|`|\\|:|new\b|function\b|while\b|for\b|if\b|this\b|window\b|document\b|globalThis\b|constructor\b|prototype\b)/i.test(normalized)) {
      throw new Error('表达式包含不安全或不支持的写法。')
    }
    const source = normalized.replace(/\^/g, '**')
    const executor = new Function(
      variableName,
      'helpers',
      `
        const { pi, e, sin, cos, tan, abs, pow, exp, sqrt, log, floor, ceil, round, delta, u, rect, tri, expseq, sinseq, cosseq, sinc, gauss, pulse } = helpers;
        return ${source};
      `,
    )
    return (value) => {
      const result = executor(value, helpers)
      if (!Number.isFinite(result)) {
        throw new Error('表达式计算结果不是有限数值。')
      }
      return result
    }
  }

  function normalizeExpression(expression) {
    return String(expression || '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function parseCoefficientList(raw) {
    const values = String(raw || '')
      .split(/[\s,，;；]+/)
      .map((token) => token.trim())
      .filter(Boolean)
      .map((token) => Number(token))
    if (!values.length || values.some((value) => !Number.isFinite(value))) {
      throw new Error('系数列表必须是逗号分隔的数字。')
    }
    return values.map((value) => round2(value))
  }

  function parseNumericSamples(text) {
    const samples = String(text || '')
      .split(/[\s,，;；]+/)
      .map((token) => token.trim())
      .filter(Boolean)
      .map((token) => Number(token))
      .filter((value) => Number.isFinite(value))
    if (samples.length < 2) {
      throw new Error('样本文件中至少需要 2 个数值。')
    }
    return downsampleArray(samples, MAX_UPLOAD_SAMPLES).map((value) => round2(value))
  }

  function downsampleArray(values, limit) {
    if (values.length <= limit) {
      return values.slice()
    }
    const indices = takeEvenlySpacedIndices(values.length, limit)
    return indices.map((index) => values[index])
  }

  function takeEvenlySpacedIndices(length, count) {
    if (count <= 1 || length <= 1) {
      return [0]
    }
    const indices = []
    for (let step = 0; step < count; step += 1) {
      indices.push(Math.min(length - 1, Math.round((step / (count - 1)) * (length - 1))))
    }
    return Array.from(new Set(indices))
  }

  function sanitizeDiscreteRange(range) {
    const next = { ...range }
    next.nMin = Math.round(Number.isFinite(next.nMin) ? next.nMin : DISCRETE_DEFAULT_RANGE.nMin)
    next.nMax = Math.round(Number.isFinite(next.nMax) ? next.nMax : DISCRETE_DEFAULT_RANGE.nMax)
    if (next.nMax <= next.nMin) {
      next.nMax = next.nMin + 1
    }
    next.omegaMin = Number.isFinite(next.omegaMin) ? next.omegaMin : DISCRETE_DEFAULT_RANGE.omegaMin
    next.omegaMax = Number.isFinite(next.omegaMax) ? next.omegaMax : DISCRETE_DEFAULT_RANGE.omegaMax
    if (next.omegaMax <= next.omegaMin + 0.01) {
      next.omegaMax = next.omegaMin + 0.01
    }
    next.omegaSamples = clamp(Math.round(next.omegaSamples || DISCRETE_DEFAULT_RANGE.omegaSamples), 64, 1024)
    return next
  }

  function sanitizeSamplingRange(range) {
    const next = { ...range }
    next.tMin = Number.isFinite(next.tMin) ? next.tMin : SAMPLING_DEFAULT_RANGE.tMin
    next.tMax = Number.isFinite(next.tMax) ? next.tMax : SAMPLING_DEFAULT_RANGE.tMax
    if (next.tMax <= next.tMin + 0.01) {
      next.tMax = next.tMin + 0.01
    }
    next.fs = clamp(Number.isFinite(next.fs) ? next.fs : SAMPLING_DEFAULT_RANGE.fs, 0.5, 80)
    next.denseSamples = SAMPLING_DEFAULT_RANGE.denseSamples
    return next
  }

  function sanitizeZRange(range) {
    const next = { ...range }
    next.nMin = Math.max(0, Math.round(Number.isFinite(next.nMin) ? next.nMin : Z_DEFAULT_RANGE.nMin))
    next.nMax = Math.max(next.nMin + 1, Math.round(Number.isFinite(next.nMax) ? next.nMax : Z_DEFAULT_RANGE.nMax))
    next.omegaMin = Number.isFinite(next.omegaMin) ? next.omegaMin : Z_DEFAULT_RANGE.omegaMin
    next.omegaMax = Number.isFinite(next.omegaMax) ? next.omegaMax : Z_DEFAULT_RANGE.omegaMax
    if (next.omegaMax <= next.omegaMin + 0.01) {
      next.omegaMax = next.omegaMin + 0.01
    }
    next.omegaSamples = clamp(Math.round(next.omegaSamples || Z_DEFAULT_RANGE.omegaSamples), 64, 1024)
    next.xMin = Number.isFinite(next.xMin) ? next.xMin : Z_DEFAULT_RANGE.xMin
    next.xMax = Number.isFinite(next.xMax) ? next.xMax : Z_DEFAULT_RANGE.xMax
    next.yMin = Number.isFinite(next.yMin) ? next.yMin : Z_DEFAULT_RANGE.yMin
    next.yMax = Number.isFinite(next.yMax) ? next.yMax : Z_DEFAULT_RANGE.yMax
    if (next.xMax <= next.xMin + 0.01) {
      next.xMax = next.xMin + 0.01
    }
    if (next.yMax <= next.yMin + 0.01) {
      next.yMax = next.yMin + 0.01
    }
    return next
  }

  function hasUploadAnalyzableSignal() {
    return (state.upload.kind === 'samples' || state.upload.kind === 'audio') && state.upload.samples.length > 1
  }

  function linspace(start, end, count) {
    if (count <= 1) {
      return [start]
    }
    const step = (end - start) / (count - 1)
    return Array.from({ length: count }, (_, index) => start + index * step)
  }

  function computeDtftAt(sequence, nValues, omega) {
    let sum = complex(0, 0)
    for (let index = 0; index < sequence.length; index += 1) {
      const angle = -omega * nValues[index]
      sum = cAdd(sum, complex(sequence[index] * Math.cos(angle), sequence[index] * Math.sin(angle)))
    }
    return sum
  }

  function computeDft(sequence) {
    const N = sequence.length
    return Array.from({ length: N }, (_, k) => {
      let sum = complex(0, 0)
      for (let n = 0; n < N; n += 1) {
        const angle = (-TAU * k * n) / N
        sum = cAdd(sum, complex(sequence[n] * Math.cos(angle), sequence[n] * Math.sin(angle)))
      }
      return sum
    })
  }

  function computeDfs(period) {
    const N = period.length
    return computeDft(period).map((value) => cScale(value, 1 / N))
  }

  function zeroPadSequence(sequence, targetLength) {
    const values = sequence.slice()
    while (values.length < targetLength) {
      values.push(0)
    }
    return values.slice(0, targetLength)
  }

  function parseSequenceList(raw, minimumLength) {
    const values = String(raw || '')
      .split(/[\s,，;；]+/)
      .map((token) => token.trim())
      .filter(Boolean)
      .map((token) => Number(token))
    if (values.length < Math.max(1, minimumLength) || values.some((value) => !Number.isFinite(value))) {
      throw new Error('序列输入必须是逗号分隔的数字。')
    }
    return values.map((value) => round2(value))
  }

  function buildPeriodicSequenceData(period, start, end) {
    const N = period.length
    const data = []
    for (let n = start; n <= end; n += 1) {
      data.push({ x: n, y: period[mod(n, N)] })
    }
    return data
  }

  function circularShift(sequence, shift) {
    const N = sequence.length
    return sequence.map((_, index) => sequence[mod(index - shift, N)])
  }

  function circularConvolution(a, b) {
    const N = Math.max(a.length, b.length)
    const x = zeroPadSequence(a, N)
    const h = zeroPadSequence(b, N)
    return Array.from({ length: N }, (_, n) => {
      let sum = 0
      for (let k = 0; k < N; k += 1) {
        sum += x[k] * h[mod(n - k, N)]
      }
      return round2(sum)
    })
  }

  function sampleDftSpectrum(sequence, length) {
    const spectrum = computeDft(zeroPadSequence(sequence, length))
    return spectrum
      .map((value, index) => {
        const omega = index < length / 2 ? (TAU * index) / length : (TAU * (index - length)) / length
        return {
          omega,
          magnitude: cAbs(value),
          value,
        }
      })
      .sort((left, right) => left.omega - right.omega)
  }

  function buildFrequencySamplingRows(sampledSpectrum, interpolatedSpectrum) {
    const rows = []
    sampledSpectrum.slice(0, Math.min(8, sampledSpectrum.length)).forEach((item) => {
      rows.push(['N 点采样', formatNumber(item.omega), formatNumber(item.magnitude)])
    })
    takeEvenlySpacedIndices(interpolatedSpectrum.length, Math.min(8, interpolatedSpectrum.length)).forEach((index) => {
      const item = interpolatedSpectrum[index]
      rows.push(['插值重构', formatNumber(item.omega), formatNumber(item.magnitude)])
    })
    return rows
  }

  function complexPolar(radius, angle) {
    return complex(radius * Math.cos(angle), radius * Math.sin(angle))
  }

  function buildCztContour(A, W, points) {
    return Array.from({ length: points }, (_, k) => cMul(A, cPow(cInv(W), k)))
  }

  function computeCzt(sequence, A, W, points) {
    const contour = buildCztContour(A, W, points)
    return contour.map((z) => {
      let sum = complex(0, 0)
      for (let n = 0; n < sequence.length; n += 1) {
        sum = cAdd(sum, cScale(cPow(cInv(z), n), sequence[n]))
      }
      return sum
    })
  }

  function reconstructZeroOrder(t, sampleTimes, sampleValues) {
    if (t <= sampleTimes[0]) {
      return sampleValues[0]
    }
    if (t >= sampleTimes[sampleTimes.length - 1]) {
      return sampleValues[sampleValues.length - 1]
    }
    for (let index = 1; index < sampleTimes.length; index += 1) {
      if (t < sampleTimes[index]) {
        return sampleValues[index - 1]
      }
    }
    return sampleValues[sampleValues.length - 1]
  }

  function reconstructLinear(t, sampleTimes, sampleValues) {
    if (t <= sampleTimes[0]) {
      return sampleValues[0]
    }
    if (t >= sampleTimes[sampleTimes.length - 1]) {
      return sampleValues[sampleValues.length - 1]
    }
    for (let index = 1; index < sampleTimes.length; index += 1) {
      if (t <= sampleTimes[index]) {
        const t0 = sampleTimes[index - 1]
        const t1 = sampleTimes[index]
        const y0 = sampleValues[index - 1]
        const y1 = sampleValues[index]
        const ratio = (t - t0) / Math.max(t1 - t0, EPS)
        return y0 + (y1 - y0) * ratio
      }
    }
    return sampleValues[sampleValues.length - 1]
  }

  function sampleProxyValue(samples, sampleRate, t) {
    const step = 1 / Math.max(sampleRate, 0.1)
    const sampleTimes = samples.map((_, index) => index * step)
    return reconstructLinear(t, sampleTimes, samples)
  }

  function normalizeTransfer(numerator, denominator) {
    const den0 = denominator[0]
    const factor = Math.abs(den0) < EPS ? 1 : den0
    return {
      numerator: numerator.map((value) => value / factor),
      denominator: denominator.map((value) => value / factor),
    }
  }

  function evaluateTransferAt(numerator, denominator, omega) {
    const numeratorValue = evaluateSeriesAt(numerator, omega)
    const denominatorValue = evaluateSeriesAt(denominator, omega)
    return cDiv(numeratorValue, denominatorValue)
  }

  function evaluateSeriesAt(coefficients, omega) {
    return coefficients.reduce((sum, coefficient, index) => {
      const angle = -omega * index
      return cAdd(sum, complex(coefficient * Math.cos(angle), coefficient * Math.sin(angle)))
    }, complex(0, 0))
  }

  function impulseResponse(numerator, denominator, nValues) {
    const y = []
    const x = nValues.map((n) => (n === 0 ? 1 : 0))
    for (let index = 0; index < nValues.length; index += 1) {
      let sum = 0
      for (let k = 0; k < numerator.length; k += 1) {
        if (index - k >= 0) {
          sum += numerator[k] * x[index - k]
        }
      }
      for (let k = 1; k < denominator.length; k += 1) {
        if (index - k >= 0) {
          sum -= denominator[k] * y[index - k]
        }
      }
      y.push(round2(sum / Math.max(denominator[0], EPS)))
    }
    return y
  }

  function polyRoots(coefficients) {
    const trimmed = trimLeadingZeros(coefficients)
    const degree = trimmed.length - 1
    if (degree <= 0) {
      return []
    }
    if (degree === 1) {
      return [complex(-trimmed[1] / trimmed[0], 0)]
    }
    const normalized = trimmed.map((value) => value / trimmed[0])
    const radius = 1 + Math.max(...normalized.slice(1).map((value) => Math.abs(value)))
    let roots = Array.from({ length: degree }, (_, index) => complex(radius * Math.cos((TAU * index) / degree), radius * Math.sin((TAU * index) / degree)))
    for (let iteration = 0; iteration < 80; iteration += 1) {
      let maxDelta = 0
      roots = roots.map((root, index) => {
        const numerator = polyEval(normalized, root)
        let denominator = complex(1, 0)
        for (let j = 0; j < roots.length; j += 1) {
          if (j !== index) {
            denominator = cMul(denominator, cSub(root, roots[j]))
          }
        }
        const delta = cDiv(numerator, denominator)
        const next = cSub(root, delta)
        maxDelta = Math.max(maxDelta, cAbs(delta))
        return next
      })
      if (maxDelta < 1e-10) {
        break
      }
    }
    return roots
  }

  function trimLeadingZeros(coefficients) {
    const result = coefficients.slice()
    while (result.length > 1 && Math.abs(result[0]) < EPS) {
      result.shift()
    }
    return result
  }

  function polyEval(coefficients, z) {
    return coefficients.reduce((accumulator, coefficient) => cAdd(cMul(accumulator, z), complex(coefficient, 0)), complex(0, 0))
  }

  function sortComplexPoints(points) {
    return points
      .map((point) => complex(round2(point.re), round2(point.im)))
      .sort((left, right) => {
        if (Math.abs(left.re - right.re) > 1e-6) {
          return left.re - right.re
        }
        return left.im - right.im
      })
  }

  function createTicks(min, max, count) {
    return linspace(min, max, count).map((value) => round2(value))
  }

  function scaleX(value, domain, offset, size) {
    return offset + ((value - domain[0]) / Math.max(domain[1] - domain[0], EPS)) * size
  }

  function scaleY(value, domain, offset, size) {
    return offset + size - ((value - domain[0]) / Math.max(domain[1] - domain[0], EPS)) * size
  }

  function computePaddedYDomain(values, includeZero) {
    const finite = values.filter((value) => Number.isFinite(value))
    let min = finite.length ? Math.min(...finite) : -1
    let max = finite.length ? Math.max(...finite) : 1
    if (includeZero) {
      min = Math.min(min, 0)
      max = Math.max(max, 0)
    }
    if (Math.abs(max - min) < 1e-6) {
      const pad = Math.max(0.5, Math.abs(max) * 0.25 + 0.2)
      return [min - pad, max + pad]
    }
    const padding = (max - min) * 0.12
    return [min - padding, max + padding]
  }

  function complex(re, im) {
    return { re, im }
  }

  function cAdd(a, b) {
    return { re: a.re + b.re, im: a.im + b.im }
  }

  function cSub(a, b) {
    return { re: a.re - b.re, im: a.im - b.im }
  }

  function cMul(a, b) {
    return {
      re: a.re * b.re - a.im * b.im,
      im: a.re * b.im + a.im * b.re,
    }
  }

  function cScale(a, scalar) {
    return {
      re: a.re * scalar,
      im: a.im * scalar,
    }
  }

  function cInv(a) {
    const denominator = a.re * a.re + a.im * a.im
    if (denominator < EPS) {
      return complex(0, 0)
    }
    return {
      re: a.re / denominator,
      im: -a.im / denominator,
    }
  }

  function cPow(a, exponent) {
    let result = complex(1, 0)
    for (let index = 0; index < exponent; index += 1) {
      result = cMul(result, a)
    }
    return result
  }

  function cDiv(a, b) {
    const denominator = b.re * b.re + b.im * b.im
    if (denominator < EPS) {
      return complex(0, 0)
    }
    return {
      re: (a.re * b.re + a.im * b.im) / denominator,
      im: (a.im * b.re - a.re * b.im) / denominator,
    }
  }

  function cAbs(a) {
    return Math.hypot(a.re, a.im)
  }

  function cArg(a) {
    return Math.atan2(a.im, a.re)
  }

  function maxAbs(values) {
    return round2(values.reduce((max, value) => Math.max(max, Math.abs(value)), 0))
  }

  function indexOfMax(values) {
    let bestIndex = 0
    let bestValue = -Infinity
    values.forEach((value, index) => {
      if (value > bestValue) {
        bestValue = value
        bestIndex = index
      }
    })
    return bestIndex
  }

  function formatCoefficientList(values) {
    return `[${values.map((value) => formatNumber(value)).join(', ')}]`
  }

  function round2(value) {
    return Math.round(value * 100) / 100
  }

  function roundForInput(value) {
    return typeof value === 'number' ? round2(value) : value
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) {
      return '0.00'
    }
    return round2(value).toFixed(2)
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value))
  }

  function mod(value, base) {
    return ((value % base) + base) % base
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function escapeAttribute(value) {
    return escapeHtml(value)
  }
})()
