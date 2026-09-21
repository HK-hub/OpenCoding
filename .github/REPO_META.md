# GitHub 仓库元数据（About / Topics / 推广文案）

> 本文件用于在 GitHub 仓库页面右侧 **About** 面板、**Topics** 与社交预览 / 推广时复制粘贴。修改后请同步（GitHub 不读本文件，仅作唯一事实源保存）。

---

## 1. About · 仓库简介（英文，推荐）

GitHub About 输入框上限 350 字符。二选一：

**A. 标准版（约 240 字符，推荐）**

```
Enterprise-grade multi-modal Coding Agent Harness — kernel, tools, permissions, sandbox, memory, teams, goals, MCP, plugins, A2A. Java 21 · Spring Boot · PostgreSQL · Redis · Electron/Vue + CLI. Design-complete docs; implementation in progress.
```

**B. 精简版（约 150 字符）**

```
An enterprise multi-modal Coding Agent Harness. Kernel + tools + permissions + sandbox + memory + teams + goals + MCP, one core for CLI, desktop and IDE. Design-complete, M0 in progress.
```

**C. 中文版（用于国内平台，如 Gitee / 知乎 / 掘金）**

```
企业级多模态 Coding Agent Harness：内核、工具、权限、沙箱、记忆、团队、目标、MCP、插件一应俱全；一个内核驱动 CLI、桌面端与 IDE。设计全集已交付，实现处于 M0。
```

---

## 2. Website 字段（About 面板右侧链接）

建议顺序尝试（任一可用即可）：

1. `https://github.com/HK-hub/OpenCoding/tree/master/docs/harness` — 设计文档入口（当前无独立站点，最稳妥）
2. 若后续发布文档站（VitePress / Docusaurus），改为该站点域名

---

## 3. Topics（GitHub 最多 20 个；直接复制逐条添加）

```
coding-agent
ai-agent
agent-harness
llm
java
spring-boot
claude-code
codex
mcp
model-context-protocol
multi-agent
agent-teams
sandbox
electron
vue
postgresql
redis
rag
developer-tools
ai-coding-assistant
```

**优先级说明**（若只想加 10 个）：`coding-agent`、`ai-agent`、`agent-harness`、`llm`、`java`、`spring-boot`、`mcp`、`multi-agent`、`developer-tools`、`ai-coding-assistant`。

**不建议添加**：`awesome`、`hacktoberfest`（需真实参与活动）、`openai`/`anthropic`（避免与官方仓库混淆）、`framework`（易与 Web 框架混淆）。

---

## 4. Social preview（社交分享图，1280×640）

- 现有素材：[`docs/assets/banner.svg`](../docs/assets/banner.svg)（1600×420）→ 导出为 PNG 并按 1280×640 裁切/留白后上传至 **Settings → Social preview**。
- 命名建议：`opencoding-social-preview.png`；文案保留标题 + 一句话定位 + 关键数字（36 volumes · 82k lines · 606 diagrams）。

---

## 5. 一句话 / 一段话推广文案（发布时使用）

**One-liner (EN)**

> OpenCoding — an enterprise multi-modal Coding Agent Harness: 36 volumes of design, 35 system specs, 36 component specs, 9 source-level competitor studies. Java 21 + Spring Boot, CLI + desktop.

**一句话（中文）**

> OpenCoding：企业级多模态 Coding Agent Harness——36 卷设计、35 份系统方案、36 份组件方案、9 家竞品源码级研究；Java 21 + Spring Boot，CLI 与桌面端同源。

**一段话（中文，用于掘金/知乎/公众号）**

> 我们不只是又写了一个 Coding Agent，而是把「Harness」这一层完整设计了出来：内核零框架（纯 Java 21）、工具/权限/沙箱/上下文/记忆/知识库/Teams/Goal/MCP/插件全生命周期可扩展、企业级多租户与审计默认内置。设计文档 36 卷 8.2 万行、606 张图全部通过机器校验，并对 Claude Code、Codex、OpenCode、DeepSeek Harness 等 9 家做了逐源码级对标研究（证据分级 E1–E4）。仓库现处于 M0，契约层已就绪，欢迎一起实现。

## 6. License

**MIT**（根目录 [`LICENSE`](../LICENSE)，Copyright (c) 2026 HK-hub）。GitHub 会自动识别根目录 `LICENSE` 并在仓库侧栏显示 "MIT license" 标签，About 面板无需额外填写。

---

## 7. 发布纪律（重要）

- 所有对外文案必须与 `README.md` 的**状态表**一致：**设计已交付、运行时处于 M0**；不得暗示已有可用产品。
- 引用竞品能力时保留「设计目标 / 我们研究所得」口径，不得表述为已实现或绝对事实（详见 `docs/harness/research/` 的证据分级）。
- 数字类表述以 `docs/harness/AUDIT.md` 的实测值为准，变更后同步修订本文件与两份 README。
