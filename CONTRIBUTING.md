# Contributing to OpenCoding

> TL;DR — **Design first, then code.** Update `docs/harness/` before behavior changes; keep Java style per [`.qoder/rules/`](.qoder/rules); use Conventional Commits with a Chinese description; run `mvn -pl <module> -am test` before opening a PR.

感谢你愿意参与 OpenCoding。这是一个**设计先行**的 Harness 工程：`docs/harness/` 是契约，代码是契约的实现。请先花 15 分钟读完 [`docs/harness/impl/00-contracts/README.md`](docs/harness/impl/00-contracts/README.md) —— 它规定了阅读顺序、权威性规则与 M0 开工路径。

---

## 1. 从哪里开始

| 你的情况 | 建议入口 |
| --- | --- |
| 想动手实现 | [`impl/00-contracts/LOCAL-RUN-RECIPE.md`](docs/harness/impl/00-contracts/LOCAL-RUN-RECIPE.md)（7 条命令、零模型凭证跑通会话）→ `KERNEL-PORTS.md` 的 24 类 M0 开工集 |
| 想改某个系统的设计 | 对应 `docs/harness/NN-*.md`（设计卷）+ `docs/harness/impl/NN-*-impl.md`（实现方案）；改前先查 [`DECISIONS.md`](docs/harness/DECISIONS.md) |
| 想新增一个组件方案 | 参照 [`impl/components/C01-session-manager.md`](docs/harness/impl/components/C01-session-manager.md) 的 11 节模板，编号顺延，并在 `components/README.md` 登记 |
| 想修错 / 提建议 | 直接开 Issue，附 `文件:行` 与证据；若是竞品事实类问题，请给出仓库/路径（证据等级见 `research/00-research-plan.md` §2） |

## 2. 文档先行（硬性规则）

1. 行为、契约、数据结构的任何变更，**先在 `docs/harness/` 落文档**（设计卷 → 实现方案 → 必要时登记决策）。
2. 与契约层（`docs/harness/impl/00-contracts/`）冲突时，以契约层为准；确需变更契约层，请在 PR 描述里给出理由与回改清单。
3. 每个新决策必须登记：设计层 `H-xxx` / `D-<域>-<n>`（`DECISIONS.md`），实现层 `I-<域>-<n>`（`impl/IMPL-DECISIONS.md`），并写明**被放弃分支与回退触发条件**。
4. 图表只用保守 Mermaid 语法（`flowchart` / `classDiagram` / `sequenceDiagram` / `stateDiagram-v2`），标签含 `()[]{}:"` 必须加引号；提交前请在本地跑一遍解析校验（见 §5）。

## 3. 代码规范（Java）

由 [`.qoder/rules/`](.qoder/rules) 强制，摘要：

- **注释**：类/接口/枚举/record 必须有职责 JavaDoc；public/protected 方法必须有功能描述 + `@param`/`@return`/`@throws`；状态流转、乐观锁行数校验、幂等、事务/事件时机必须有中文行内注释解释「为什么」。
- **配置**：影响业务逻辑、随环境变化的 → `@ConfigurationProperties`；固定的 → 常量类。敏感信息一律环境变量注入 + 启动 Fail-Fast。
- **常量**：状态/类型用枚举（code + desc，DB 存 code）；Redis Key 走统一 Key 工厂；ORM 一律 `Entity::getField`，禁止手写列名与 `inSql()` 拼接。
- **异常**：内核层 `HarnessException(ErrorCode)`、外壳层 `BusinessException`；禁止裸 `RuntimeException`；写操作 `@Transactional(rollbackFor = Exception.class)`，外部调用移出事务；乐观锁 `updated != 1` 必须抛异常。
- **日志**：一律 `@Slf4j`；端点/写操作/状态流转/定时任务必须中文打点入参与返回值；占位符 `{}`，异常必须传 `Throwable`；敏感字段脱敏。

前端（`open-coding-client`）：React 19 + Vite + TypeScript，`npm run lint` 必须通过。

## 4. 提交与 PR

- **分支**：`feat/…`、`fix/…`、`docs/…`、`refactor/…`、`chore/…`（小写连字符）。
- **提交信息**：Conventional Commits，描述使用中文，例：
  `feat(kernel): 实现会话准入与单飞控制`
- **PR 描述**请包含：改了什么 / 为什么 / 对应文档章节或决策号 / 验证方式（命令与输出）。
- **合并前门禁**：`mvn -pl <module> -am test` 全绿；涉及 main 链路时跑 `mvn -pl open-coding-bootstrap -am test`；新增图通过校验；新增决策已登记。
- 禁止提交 `.env`、真实密钥、模型凭证与任何用户数据；`.env.example` 是唯一变量清单，新增变量必须同步。

## 5. 本地自检清单

```bash
# 构建 + 单测（按模块）
mvn -pl open-coding-bootstrap -am test

# Mermaid 图表校验（仓库自带脚本，需 Node.js）
node .research-cache/mmd-check/check.mjs $(find docs/harness -name '*.md' -not -path '*/archive/*')

# 前端
cd open-coding-client && npm install && npm run lint && npm run build
```

> 注：`.research-cache/` 是竞品源码浅克隆缓存（已 gitignore）。若不存在校验脚本，可用任意 mermaid CLI 替代，或在 PR 说明中标注未校验。

## 6. 行为准则与许可

- 讨论对事不对人；评审意见必须给出**可执行的修改建议**，不接受「感觉不对」式反馈。
- 本项目采用 **MIT** 许可证（见 [`LICENSE`](LICENSE)）。提交即表示你同意：你的贡献以 MIT 许可证发布。
