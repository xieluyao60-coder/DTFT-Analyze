import { round2 } from './dsp'

const SAFE_EXPRESSION_PATTERN = /^[0-9a-zA-Z_+\-*/^().,\sπ]+$/
const FORBIDDEN_TOKENS = [
  'window',
  'document',
  'globalThis',
  'Function',
  'eval',
  'constructor',
  'import',
  'new',
  ';',
  '[',
  ']',
  '{',
  '}',
  '=',
]

const HELPERS = {
  pi: Math.PI,
  abs: Math.abs,
  pow: Math.pow,
  sqrt: Math.sqrt,
  delta: (offset) => (Math.abs(offset) < 1e-9 ? 1 : 0),
  impulse: (offset) => (Math.abs(offset) < 1e-9 ? 1 : 0),
  u: (offset) => (offset >= 0 ? 1 : 0),
  step: (offset) => (offset >= 0 ? 1 : 0),
  rect: (offset, width = 6) => (offset >= 0 && offset <= width - 1 ? 1 : 0),
  tri: (offset, width = 5) =>
    Math.abs(offset) > width ? 0 : 1 - Math.abs(offset) / (width + 1),
  expseq: (a, index) => (index >= 0 ? Math.pow(a, index) : 0),
  sinseq: (omega, index) => Math.sin(omega * index),
  cosseq: (omega, index) => Math.cos(omega * index),
}

export const CUSTOM_HINT_TEXT =
  '可用函数: delta(n), u(n), rect(n, N), tri(n, N), expseq(a, n), sinseq(ω, n), cosseq(ω, n), abs(x), pow(a, b), pi。支持 + - * / 与括号。'

export const CUSTOM_EXAMPLES = [
  {
    label: '冲激 + 矩形',
    expression: 'delta(n) + 0.5 * rect(n, 6)',
  },
  {
    label: '阶跃差分',
    expression: 'u(n) - u(n - 4)',
  },
  {
    label: '指数乘矩形',
    expression: 'expseq(0.8, n) * rect(n, 8)',
  },
  {
    label: '移位组合',
    expression: 'delta(n + 2) + delta(n - 2)',
  },
]

export function normalizeExpression(expression) {
  return expression
    .trim()
    .replaceAll('π', 'pi')
    .replaceAll('，', ',')
    .replaceAll('^', '**')
}

function compileSequenceExpression(expression) {
  if (!expression) {
    throw new Error('请输入自定义序列表达式。')
  }

  if (!SAFE_EXPRESSION_PATTERN.test(expression)) {
    throw new Error('表达式仅支持数字、括号、运算符和内置序列函数。')
  }

  const forbiddenToken = FORBIDDEN_TOKENS.find((token) => expression.includes(token))
  if (forbiddenToken) {
    throw new Error('表达式包含不支持的字符或关键字，请使用内置函数重新输入。')
  }

  const evaluator = new Function(
    'n',
    'helpers',
    `"use strict";
    const { pi, abs, pow, sqrt, delta, impulse, u, step, rect, tri, expseq, sinseq, cosseq } = helpers;
    return (${expression});
  `,
  )

  return (n) => {
    const result = evaluator(n, HELPERS)

    if (!Number.isFinite(result)) {
      throw new Error('表达式结果不是有限数，请检查是否存在除零或非法运算。')
    }

    return round2(result)
  }
}

export function evaluateCustomSequence(expression, nValues) {
  const normalized = normalizeExpression(expression)
  const calculateValue = compileSequenceExpression(normalized)

  return nValues.map((n) => ({
    n,
    value: calculateValue(n),
  }))
}
