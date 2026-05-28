import { useMemo, useState } from 'react'
import './App.css'
import PlotCard from './components/PlotCard'
import SequenceCatalog from './components/SequenceCatalog'
import {
  SEQUENCE_PRESETS,
  buildFrequencyRange,
  buildIntegerRange,
  buildSummaryMetrics,
  computeNumericDtft,
  formatDisplayNumber,
  formatOmegaLabel,
  getDefaultSequenceParams,
  getPresetById,
  round2,
  sanitizeRangeSettings,
} from './lib/dsp'
import {
  CUSTOM_EXAMPLES,
  CUSTOM_HINT_TEXT,
  evaluateCustomSequence,
  normalizeExpression,
} from './lib/expression'

const INITIAL_RANGE = {
  nMin: -8,
  nMax: 16,
  omegaMin: -Math.PI,
  omegaMax: Math.PI,
  omegaSamples: 256,
}

const DEFAULT_EXPRESSION = 'delta(n) + 0.5 * rect(n, 6) - 0.25 * delta(n - 3)'

function DataTable({ title, columns, rows, emptyText }) {
  return (
    <section className="panel table-card">
      <div className="panel__header">
        <div>
          <p className="eyebrow">{title}</p>
          <h3>{title}</h3>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="table-card__empty">{emptyText}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${title}-${index}`}>
                  {columns.map((column) => (
                    <td key={column.key}>{row[column.key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function App() {
  const [activeMode, setActiveMode] = useState('preset')
  const [activePresetId, setActivePresetId] = useState('impulse')
  const [sequenceParams, setSequenceParams] = useState(getDefaultSequenceParams())
  const [rangeSettings, setRangeSettings] = useState(INITIAL_RANGE)
  const [draftExpression, setDraftExpression] = useState(DEFAULT_EXPRESSION)
  const [committedExpression, setCommittedExpression] = useState(
    normalizeExpression(DEFAULT_EXPRESSION),
  )
  const [customError, setCustomError] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)

  const activePreset = getPresetById(activePresetId)
  const safeRangeSettings = useMemo(
    () => sanitizeRangeSettings(rangeSettings),
    [rangeSettings],
  )

  const analysis = useMemo(() => {
    const nValues = buildIntegerRange(safeRangeSettings.nMin, safeRangeSettings.nMax)
    const omegaValues = buildFrequencyRange(
      safeRangeSettings.omegaMin,
      safeRangeSettings.omegaMax,
      safeRangeSettings.omegaSamples,
    )

    try {
      let title = ''
      let formula = ''
      let theory = ''
      let analysisNote = ''
      let description = ''
      let samples = []

      if (activeMode === 'preset') {
        const currentPreset = getPresetById(activePresetId)
        const params = sequenceParams[currentPreset.id]
        title = currentPreset.name
        formula = currentPreset.formula(params)
        theory =
          typeof currentPreset.theory === 'function'
            ? currentPreset.theory(params)
            : currentPreset.theory
        analysisNote = currentPreset.analysisNote
        description = currentPreset.description
        samples = nValues.map((n) => ({
          n,
          value: round2(currentPreset.generator(n, params)),
        }))
      } else {
        title = '自定义序列'
        formula = committedExpression
        theory = '由当前表达式定义'
        analysisNote = '按当前 n 范围内的离散样本进行数值 DTFT 求和。'
        description = '支持典型序列的线性组合、乘法、除法和简单移位。'
        samples = evaluateCustomSequence(committedExpression, nValues)
      }

      const spectrum = computeNumericDtft(samples, omegaValues)
      const metrics = buildSummaryMetrics(samples, spectrum)

      return {
        hasError: false,
        title,
        formula,
        theory,
        analysisNote,
        description,
        samples,
        spectrum,
        metrics,
        nValues,
        omegaValues,
      }
    } catch (error) {
      return {
        hasError: true,
        message: error instanceof Error ? error.message : '计算失败，请检查输入参数。',
      }
    }
  }, [
    activeMode,
    activePresetId,
    committedExpression,
    safeRangeSettings,
    sequenceParams,
  ])

  const sequencePreviewRows = useMemo(() => {
    if (analysis.hasError) {
      return []
    }

    const candidateSamples = analysis.samples.filter(
      (sample) => Math.abs(sample.value) > 0.001,
    )
    const previewSource =
      candidateSamples.length > 0 ? candidateSamples : analysis.samples.slice(0, 10)

    return previewSource.slice(0, 10).map((sample) => ({
      n: formatDisplayNumber(sample.n),
      value: formatDisplayNumber(sample.value),
    }))
  }, [analysis])

  const spectrumPreviewRows = useMemo(() => {
    if (analysis.hasError || analysis.spectrum.length === 0) {
      return []
    }

    const rowCount = Math.min(10, analysis.spectrum.length)
    const step = Math.max(1, Math.floor(analysis.spectrum.length / rowCount))
    const selectedRows = []

    for (let index = 0; index < analysis.spectrum.length; index += step) {
      selectedRows.push(analysis.spectrum[index])
      if (selectedRows.length === rowCount) {
        break
      }
    }

    return selectedRows.map((item) => ({
      omega: formatOmegaLabel(item.omega),
      magnitude: formatDisplayNumber(item.magnitude),
      phase: formatDisplayNumber(item.phase),
    }))
  }, [analysis])

  const sequencePlotData = useMemo(() => {
    if (analysis.hasError) {
      return []
    }

    return analysis.samples.map((sample) => ({
      x: sample.n,
      y: sample.value,
    }))
  }, [analysis])

  const magnitudePlotData = useMemo(() => {
    if (analysis.hasError) {
      return []
    }

    return analysis.spectrum.map((item) => ({
      x: item.omega,
      y: item.magnitude,
    }))
  }, [analysis])

  const phasePlotData = useMemo(() => {
    if (analysis.hasError) {
      return []
    }

    return analysis.spectrum.map((item) => ({
      x: item.omega,
      y: item.phase,
    }))
  }, [analysis])

  const currentPresetParameters = activeMode === 'preset' ? activePreset.parameters : []
  const currentParameterValues =
    activeMode === 'preset' ? sequenceParams[activePreset.id] : {}

  const handleRangeChange = (key, value) => {
    const parsedValue =
      key === 'omegaSamples'
        ? Number.parseInt(value, 10)
        : Number.parseFloat(value)

    if (Number.isNaN(parsedValue)) {
      return
    }

    setRangeSettings((current) => ({
      ...current,
      [key]: parsedValue,
    }))
  }

  const handleParameterChange = (key, value) => {
    const parsedValue = Number.parseFloat(value)

    if (Number.isNaN(parsedValue)) {
      return
    }

    setSequenceParams((current) => ({
      ...current,
      [activePreset.id]: {
        ...current[activePreset.id],
        [key]: parsedValue,
      },
    }))
  }

  const activatePreset = (presetId) => {
    setActivePresetId(presetId)
    setActiveMode('preset')
    setCustomError('')
  }

  const submitCustomSequence = () => {
    try {
      const normalized = normalizeExpression(draftExpression)
      evaluateCustomSequence(
        normalized,
        buildIntegerRange(safeRangeSettings.nMin, safeRangeSettings.nMax),
      )
      setCommittedExpression(normalized)
      setActiveMode('custom')
      setCustomError('')
    } catch (error) {
      setCustomError(
        error instanceof Error ? error.message : '表达式有误，请重新输入。',
      )
    }
  }

  const handleExampleClick = (expression) => {
    setDraftExpression(expression)
  }

  const handleFileSelection = (event) => {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <p className="eyebrow">DSP Sequence Lab</p>
          <h1>离散时间序列与 DTFT 分析器</h1>
          <p className="brand-card__description">
            展示典型序列、自定义运算结果，以及对应的数值 DTFT 幅度谱与相位谱。
          </p>
        </div>

        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">典型序列</p>
              <h2>序列列表</h2>
            </div>
            <span className="panel-chip">
              {activeMode === 'preset' ? '当前查看典型序列' : '当前查看自定义序列'}
            </span>
          </div>
          <SequenceCatalog
            sequences={SEQUENCE_PRESETS}
            activeId={activePresetId}
            activeMode={activeMode}
            onSelect={activatePreset}
          />
        </section>

        <section className="panel upload-panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">接口预留</p>
              <h2>文件上传</h2>
            </div>
          </div>
          <label className="upload-dropzone" htmlFor="signal-upload">
            <input
              id="signal-upload"
              type="file"
              accept=".txt,.csv,audio/*,video/*"
              onChange={handleFileSelection}
            />
            <strong>上传离散信号 / 音频 / 视频文件</strong>
            <span>当前为预留接口，可继续接入波形抽样、FFT 与帧序列分析流程。</span>
          </label>
          <div className="upload-meta">
            {selectedFile ? (
              <>
                <div>
                  <span className="upload-meta__label">文件名</span>
                  <span>{selectedFile.name}</span>
                </div>
                <div>
                  <span className="upload-meta__label">大小</span>
                  <span>{formatDisplayNumber(selectedFile.size / 1024)} KB</span>
                </div>
              </>
            ) : (
              <div>
                <span className="upload-meta__label">状态</span>
                <span>尚未选择文件</span>
              </div>
            )}
          </div>
        </section>
      </aside>

      <main className="workspace">
        <section className="panel control-panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">分析控制</p>
              <h2>范围与表达式</h2>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => setRangeSettings(INITIAL_RANGE)}
            >
              恢复默认范围
            </button>
          </div>

          <div className="control-grid">
            <div className="field-group">
              <span className="field-group__title">n 范围</span>
              <div className="field-row">
                <label>
                  <span>起点</span>
                  <input
                    type="number"
                    step="1"
                    value={safeRangeSettings.nMin}
                    onChange={(event) => handleRangeChange('nMin', event.target.value)}
                  />
                </label>
                <label>
                  <span>终点</span>
                  <input
                    type="number"
                    step="1"
                    value={safeRangeSettings.nMax}
                    onChange={(event) => handleRangeChange('nMax', event.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="field-group">
              <span className="field-group__title">ω 范围</span>
              <div className="field-row">
                <label>
                  <span>起点</span>
                  <input
                    type="number"
                    step="0.1"
                    value={round2(safeRangeSettings.omegaMin)}
                    onChange={(event) =>
                      handleRangeChange('omegaMin', event.target.value)
                    }
                  />
                </label>
                <label>
                  <span>终点</span>
                  <input
                    type="number"
                    step="0.1"
                    value={round2(safeRangeSettings.omegaMax)}
                    onChange={(event) =>
                      handleRangeChange('omegaMax', event.target.value)
                    }
                  />
                </label>
                <label>
                  <span>采样点</span>
                  <input
                    type="number"
                    step="1"
                    value={safeRangeSettings.omegaSamples}
                    onChange={(event) =>
                      handleRangeChange('omegaSamples', event.target.value)
                    }
                  />
                </label>
              </div>
            </div>

            <div className="field-group field-group--wide">
              <span className="field-group__title">自定义序列表达式</span>
              <div className="expression-row">
                <input
                  type="text"
                  value={draftExpression}
                  onChange={(event) => setDraftExpression(event.target.value)}
                  placeholder="例如：delta(n) + 0.5 * rect(n, 6)"
                />
                <button type="button" className="primary-button" onClick={submitCustomSequence}>
                  确定
                </button>
              </div>
              <p className="expression-help">{CUSTOM_HINT_TEXT}</p>
              <div className="example-list">
                {CUSTOM_EXAMPLES.map((example) => (
                  <button
                    key={example.label}
                    type="button"
                    className="example-chip"
                    onClick={() => handleExampleClick(example.expression)}
                  >
                    {example.label}
                  </button>
                ))}
              </div>
              {customError ? <p className="error-text">{customError}</p> : null}
            </div>

            {activeMode === 'preset' && currentPresetParameters.length > 0 ? (
              <div className="field-group field-group--wide">
                <span className="field-group__title">当前典型序列参数</span>
                <div className="field-row">
                  {currentPresetParameters.map((parameter) => (
                    <label key={parameter.key}>
                      <span>{parameter.label}</span>
                      <input
                        type="number"
                        step={parameter.step}
                        min={parameter.min}
                        max={parameter.max}
                        value={currentParameterValues[parameter.key]}
                        onChange={(event) =>
                          handleParameterChange(parameter.key, event.target.value)
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {analysis.hasError ? (
          <section className="panel error-panel">
            <p className="eyebrow">错误</p>
            <h2>当前表达式无法完成计算</h2>
            <p>{analysis.message}</p>
          </section>
        ) : (
          <>
            <section className="overview-grid">
              <section className="panel">
                <div className="panel__header">
                  <div>
                    <p className="eyebrow">当前分析对象</p>
                    <h2>{analysis.title}</h2>
                  </div>
                  <span className="panel-chip">
                    {activeMode === 'preset' ? '典型序列' : '自定义序列'}
                  </span>
                </div>
                <div className="formula-box">
                  <div>
                    <span className="formula-box__label">序列表达式</span>
                    <code>{analysis.formula}</code>
                  </div>
                  <div>
                    <span className="formula-box__label">理论说明</span>
                    <p>{analysis.theory}</p>
                  </div>
                  <div>
                    <span className="formula-box__label">计算说明</span>
                    <p>{analysis.analysisNote}</p>
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel__header">
                  <div>
                    <p className="eyebrow">结果速览</p>
                    <h2>指标摘要</h2>
                  </div>
                </div>
                <div className="metric-grid">
                  {analysis.metrics.map((metric) => (
                    <article key={metric.label} className="metric-card">
                      <span className="metric-card__label">{metric.label}</span>
                      <strong>{metric.value}</strong>
                    </article>
                  ))}
                </div>
              </section>
            </section>

            <section className="charts-grid">
              <PlotCard
                title="序列散点图"
                subtitle="离散时间序列 x[n]"
                data={sequencePlotData}
                mode="stem"
                stroke="var(--accent-teal)"
                xLabel="n"
                yLabel="x[n]"
                xFormatter={formatDisplayNumber}
                yFormatter={formatDisplayNumber}
              />
              <PlotCard
                title="DTFT 幅度谱"
                subtitle="|X(e^{jω})|"
                data={magnitudePlotData}
                mode="line"
                stroke="var(--accent-orange)"
                xLabel="ω"
                yLabel="幅值"
                xFormatter={formatOmegaLabel}
                yFormatter={formatDisplayNumber}
              />
              <PlotCard
                title="DTFT 相位谱"
                subtitle="∠X(e^{jω})"
                data={phasePlotData}
                mode="line"
                stroke="var(--accent-ink)"
                xLabel="ω"
                yLabel="相位 / rad"
                xFormatter={formatOmegaLabel}
                yFormatter={formatDisplayNumber}
              />
            </section>

            <section className="data-grid">
              <DataTable
                title="序列样本预览"
                columns={[
                  { key: 'n', label: 'n' },
                  { key: 'value', label: 'x[n]' },
                ]}
                rows={sequencePreviewRows}
                emptyText="当前范围内没有可展示的样本。"
              />
              <DataTable
                title="频谱采样预览"
                columns={[
                  { key: 'omega', label: 'ω' },
                  { key: 'magnitude', label: '|X|' },
                  { key: 'phase', label: '∠X' },
                ]}
                rows={spectrumPreviewRows}
                emptyText="当前范围内没有可展示的频谱数据。"
              />
            </section>

            <section className="panel note-panel">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">使用说明</p>
                  <h2>表达式与分析约束</h2>
                </div>
              </div>
              <div className="note-grid">
                <article>
                  <h3>可用函数</h3>
                  <p>{CUSTOM_HINT_TEXT}</p>
                </article>
                <article>
                  <h3>范围联动</h3>
                  <p>
                    修改 n 范围后，序列散点图与数值 DTFT 会同步刷新；修改 ω
                    范围后，幅度谱与相位谱会在对应频带重新采样。
                  </p>
                </article>
                <article>
                  <h3>数据精度</h3>
                  <p>
                    所有展示数据在界面中统一保留到最多两位小数，便于教学展示与截图整理。
                  </p>
                </article>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default App
