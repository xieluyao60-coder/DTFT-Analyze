# 数字信号处理综合分析器

一个面向数字信号处理课程展示的 Web 端应用，当前仓库同时保留了：

- 可直接部署的单文件网页入口
- 原始 `html-version` 静态实现
- 早期 `React + Vite` 版本源码

## 在线访问

GitHub Pages:

https://xieluyao60-coder.github.io/DTFT-Analyze/

## 当前部署入口

GitHub Pages 使用仓库根目录的 `index.html`，它是当前可直接打开、可直接部署的单文件最终版页面。

项目中还保留了以下相关文件：

- `数字信号处理综合分析器_最终版.html`
- `html-version/index.html`
- `html-version/styles.css`
- `html-version/script.js`
- `src/` 与 `public/` 下的 React/Vite 源码

## 页面内容

当前网页包含以下部分：

1. 典型离散序列、DTFT、频谱图与相位谱
2. 模拟信号采样与插值重构
3. Z 变换零极点分析
4. 周期序列的离散傅里叶级数 DFS
5. 有限序列的离散傅里叶变换 DFT
6. 频域采样定理与频域插值重构
7. 线性调频 Z 变换 CZT

## 本地打开

最简单的方式是直接双击：

- `index.html`

或双击：

- `数字信号处理综合分析器_最终版.html`

## 开发说明

如果需要查看早期 React/Vite 版本：

```bash
npm install
npm run dev
```

构建命令：

```bash
npm run build
```
