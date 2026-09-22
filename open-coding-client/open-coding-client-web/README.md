# OpenCoding Harness — Web Client

企业级多模态 Coding Agent Harness 的 **Web 工作台**。按 `docs/harness/` 目标态设计（36 卷 + impl 层）实现，覆盖会话、任务/计划/Goal/Schedule、Agent 与 Teams、工具、权限与审批、沙箱、技能/MCP/Hooks/插件、知识与记忆、事件与回放、持久化与恢复、工作区、Git/Worktree、模型与提示词、上下文与成本、企业治理与安全、质量与运维、分发与生态、自动化模板库、智能增强、前沿探索等全部客户端功能面。

> **全部数据为 mock**：无后端依赖，接口调用经 `src/mock/runtime.ts` 统一模拟（延迟、cursor 分页、错误注入、离线只读）。

## 技术栈

| 项 | 选型 |
| --- | --- |
| 框架 | Vue 3.5 + TypeScript + Vite 7 |
| 状态 | Pinia（分域 store，端上仅保留草稿/滚动/焦点三类本地状态） |
| 路由 | vue-router 4（hash 模式；各域路由模块自注册，导航树由 meta 派生） |
| UI | **TDesign Vue Next** + `@tdesign-vue-next/chat`（对话组件）+ `tdesign-icons-vue-next`（经 `OcIcon` 统一入口） |

设计偏移登记：`docs/harness` 规定 Electron + Naive UI/Element Plus；本实现按需求方指令改为 **Web + TDesign**，未改动语料。

## 快速开始

```bash
cd open-coding-client/open-coding-client-web
npm install
npm run dev            # http://127.0.0.1:5178
```

其它脚本：

```bash
npm run typecheck      # vue-tsc 类型门禁（0 error 为通过）
npm run build          # 类型检查 + 生产构建
npm run build:only     # 仅构建
node scripts/check-routes.mjs   # 路由/视图完整性自检（重复路径、缺失视图、meta 缺项）
```

## 目录结构

```
src/
  layouts/           工作台外壳（导航 / 多标签 / 状态栏 / 上下文栏 / 命令面板 / 通知 / 搜索 / 键位帮助 / 撤销条 / 读屏公告）
  components/
    common/          OcIcon · PageHeader · StateShell(六态) · StatCard · OcChart(自研 SVG 图表) · InfoGrid · DiffView · RiskBadge · CliHint · JsonBlock · CopyableId
    chat/            Composer(输入区) · SessionItemView(会话流条目渲染)
  mock/
    rng.ts           确定性伪随机 + 生成工具（刷新数据一致）
    runtime.ts       请求语义（延迟/分页/错误注入/离线只读/错误码文案）
    bus.ts           双通道实时流（durable 带 seq / live 不带 seq）
    db.ts            门面（会话域 + 统一搜索）
    data/<domain>.ts 各域数据集（可被页面直接 import）
  router/
    index.ts         路由装配 + 导航树 + 命令面板数据源
    modules/*.ts     各域路由（新增域只需新增一个模块文件）
  stores/            ui（连接/标签/通知/降级/偏好/埋点）· session（会话/流式/审批/fork/书签）
  styles/index.scss  设计令牌 + 排版工具类 + diff/流式光标/减少动效
  views/<domain>/    页面
.recon/              构建资料：BUILD-MANIFEST（需求基线）· DEVELOPER-GUIDE（构建契约）· REVIEW-RUBRIC（自审评分表）
docs-mirror 对照：见下表
```

## 与 harness 卷册的对应

| 卷 | 主题 | 客户端落点 |
| --- | --- | --- |
| 00 | 愿景/功能全景/铁律 | 全局骨架（会话/任务/团队/知识/设置/监控七面板 + 自动化 + 智能增强） |
| 01 | 总体架构 | 状态栏连接态、`resume(fromSeq)` 续传、降级留痕、预算信封 |
| 02 | 模型网关 | `/model/*`：Provider、目录、能力矩阵、路由、限流、缓存、凭证、装饰器链、灰度、用量成本 |
| 03 | 上下文系统 | `/context/*`：九区段快照、压缩地图与撤销、引用再读 |
| 04 | 提示词系统 | `/prompt/*`：五类资产、组装预览、版本发布、覆盖继承、护栏 |
| 05 | 工具系统 | `/tools/*`：目录、详情、装配、11 步管线、调用时间线、工件、冲突、市场、别名、后台任务、副作用账本、宏 |
| 06 | 权限与审批 | `/permission/*`、`/approval/*`：风险矩阵、六档模式、策略树、自动批准、授权记忆、决策回放、升级链 |
| 07 | 沙箱安全 | `/sandbox/*`：五档、平台矩阵、计划、录制、快照、网络、出网、密钥代理、危险命令、资源、违规、供应链、逃逸 |
| 08 | Skill | `/registry/skills` 等 |
| 09 | MCP | `/mcp/*` |
| 10 | 记忆 | `/memory/*` |
| 11 | 知识库 | `/knowledge/*` |
| 12 | Agent 内核 | `/agent/*` + 会话内 Turn/检查器/循环防护 |
| 13 | Agent Teams | `/team/*` |
| 14 | 任务与计划 | `/task/*` |
| 15 | Goal/Schedule | `/goal/*`、`/schedule/*` |
| 16 | 事件系统 | `/event/*` |
| 17 | Hooks | `/hooks/*` |
| 18 | 插件扩展 | `/registry/plugins` 等 |
| 19 | 持久化恢复 | `/persistence/*` |
| 20 | 工作区 | `/workspace/*` |
| 21 | Git/Worktree | `/git/*` |
| 22 | 端形态与交互 | 工作台外壳、九界面规范、键位体系、无障碍 |
| 23 | A2A | `/a2a/*` |
| 24 | 企业运维 | `/enterprise/*` |
| 25 | 前沿探索 | `/frontier/*`（带「实验」徽标） |
| 26 | 质量与评测 | `/quality/*` |
| 27 | 技术路径 | 工程结构与脚本约定 |
| 28 | 更新/遥测/许可 | `/distribution/*` |
| 29 | 开发者生态 | `/ecosystem/*` |
| 30 | 安全工程 | `/security/*` |
| 31 | 容量与成本 | `/cost/*`、`/ops/capacity` |
| 32 | 运维手册 | `/ops/*` |
| 33 | 交互细则 | 六态渲染、文案三段式、危险确认四级、引导五层 |
| 34 | 自动化模板库 | `/automation/*` |
| 35 | 智能增强包 | `/intel/*` |

## 关键交互（可点验）

1. **会话主链路**：发送 → 三通道流式（文本/推理/工具）→ 工具卡展开 → 内联审批卡（A/S/R/Shift+R/D）→ 中断（安全点）→ 可回滚点 → 重放 → 导出复现包。
2. **六态**：任选列表页可演示 空/加载/错误/离线/权限/超长（页面内提供状态切换入口或自然触发）。
3. **命令面板** `Ctrl/Cmd+K`：页面 + 与 CLI 同名的动作（每项显示等价命令）。
4. **键位**：`Ctrl+Shift+A` 审批中心、`Ctrl+Shift+F` 搜索、`Alt+↑/↓` 切标签、`?` 键位帮助、`Esc` 中断/关闭。
5. **危险操作**：删除/回滚/放行类均为二次确认 + 后果说明 + 低风险 10s 撤销窗口。
6. **降级**：顶栏档位可切换并锁定，状态栏常驻显示；沙箱/能力/缓存降级一律显式标注。
