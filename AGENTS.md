# OpenCoding — Agent 协作约定

OpenCoding 是企业级多模态 Coding Agent（Server + headless CLI）。后端为 Java 21 / Spring Boot 3.4 多模块 Maven 工程：PostgreSQL + MyBatis-Plus + Flyway + Redisson，MapStruct + Lombok，四协议模型适配（Anthropic / OpenAI / Gemini / Ollama 原生）；前端 `open-coding-client` 为 React 19 + Vite + TS 独立工程。

## 一、设计契约（最高优先级）

`docs/design/` 是**冻结契约**，实现必须与其一致：

- `core-api-contract-and-model-adapter.md` —— 核心 API 契约、适配器方案、D1–D36 决策日志；**§12 现状问题清单**（当前编译不过的原因）、**§14 实施顺序**（M0→M8）。
- `model-abstraction-layer.md` —— 模型抽象层 M1–M20。

**先改设计文档、再改代码**：与设计不符的实现视为缺陷；偏离须先在决策日志追加条目。M1 契约冻结前不写任何适配器代码。当前处于 M0 迁移阶段，仓库可能暂不可编译——现状以 §12 清单为准。

## 二、模块地图与依赖铁律

| 模块 | 职责 | Spring |
| --- | --- | --- |
| `open-coding-common` | 纯枚举与工具类（零 Spring） | ❌ |
| `open-coding-core-api` | 全部契约 + SPI（message/model/provider/agent/tool/permission/error/extension） | ❌ |
| `open-coding-core-model` | 四协议 SDK 适配器、请求/响应映射、ModelFactory | ❌ |
| `open-coding-core-agent` | AgentLoop（ReAct）、压缩、权限决策链、审批编排、重试装饰 | ❌ |
| `open-coding-core-tool` | 内置工具（nexec / pty4j） | ❌ |
| `open-coding-core-implementation` | 纯 Java 默认实现（内存 store/registry）+ 插件装配 | ❌ |
| `open-coding-domain` | `oc_*` 实体 + Mapper + Flyway + **DB 版 SPI 实现** | ✅ |
| `open-coding-infrastructure` | Redis 缓存、文件系统、媒体存储、加密 | ✅ |
| `open-coding-application` | 用例编排（Session/Project/Provider/AgentRunService） | ✅ |
| `open-coding-interfaces` | REST + WebSocket 端点、DTO、WS 帧协议 | ✅ |
| `open-coding-bootstrap` | `@AutoConfiguration`、配置绑定、启动入口 | ✅ |
| `open-coding-plugin` | 插件 SDK + 示例插件 | ❌ |
| `open-coding-client` | React 前端（独立 npm 工程） | — |

**依赖方向铁律**：

- `common ← core-api ← core-model / core-agent / core-tool / core-implementation`；core 系列**绝不依赖 Spring、domain、infrastructure**。
- `domain → application → interfaces → bootstrap` 单向无环；DB 版 SPI 实现住 `domain`，由 bootstrap 以 `@ConditionalOnMissingBean` 优先装配。

## 三、构建与运行

```bash
# 全量构建（Java 21 + Maven 3.9+）
mvn clean install

# 模块级编译 / 测试
mvn -pl <module> -am compile
mvn -pl open-coding-bootstrap -am test          # main 链路

# 本地启动（入口：com.hk.opencoding.bootstrap.OpenCodingApplication）
mvn -pl open-coding-bootstrap spring-boot:run

# 前端
cd open-coding-client && npm install && npm run dev
```

运行时依赖 PostgreSQL 14+ 与 Redis 7+；单元测试离线可跑（见 README）。

## 四、配置与环境变量

- 解析顺序：OS 环境变量 > IDEA `.env` 插件 > 项目根 `.env`（`OpenCodingApplication#loadDotenv()`）。
- `.env` 不入库；**新增变量必须同步 `.env.example`**（模板是唯一变量清单）。
- yml 一律 `${ENV_VAR:default}` 写法，敏感项默认留空。
- 业务配置命名空间 `open-coding.*`（如 `open-coding.ai.providers`）。配置类放 `open-coding-domain` 的 `properties` 包，纯数据类**不加 `@Component`**，由 `@ConfigurationPropertiesScan` 激活（设计 §12-10）。
- 表名逐实体 `@TableName("oc_xxx")` 显式声明，**不用** MyBatis-Plus 全局 `table-prefix`（设计 §13）。
- 主要变量族：`DB_*`、`REDIS_*`、`ANTHROPIC_*`、`OPENAI_*`、`SERVER_PORT`、`LOG_LEVEL_*`、`SWAGGER_ENABLED`、`FLYWAY_ENABLED`。

## 五、编码规范（强制）

写任何 Java 代码前必须遵守以下 5 条规范，全文与反例清单见 `.qoder/rules/`：

### 1. 注释 —— `.qoder/rules/comment-rules.md`

- 类/接口/枚举/record 必须有职责 JavaDoc；public/protected 方法必须有功能描述 + `@param`/`@return`/`@throws`；仅 `@author`/`@since` 模板头不合格。
- 状态流转、乐观锁行数校验、幂等、事务/事件时机、外部调用必须有中文行内注释解释「为什么」。
- 方法内业务步骤用空行分段 + 简短中文注释（参数校验 → 加载 → 规则校验 → 写入 → 事件 → 组装）。

### 2. 配置抽取 —— `.qoder/rules/config-extraction-rules.md`

- 影响业务逻辑、随环境变化的 → `@ConfigurationProperties`；代码内固定的 → 常量类。判断线：变更是否需要重新发版。
- 敏感信息（api-key、密码、Token）禁止硬编码，一律环境变量注入 + 启动 Fail-Fast。
- 状态机定义、枚举 code、编码规则禁止配置化。

### 3. 常量抽取 —— `.qoder/rules/constant-extraction-rules.md`

- 状态/类型判断用枚举（code + desc，DB 存 code，前端传 code）；Redis Key 一律统一 Key 工厂生成；Map key / 接口字段名抽常量。
- ORM 查询、更新、排序一律 `Entity::getField` 方法引用，禁止手写列名字符串；禁止 `inSql()` 拼接 SQL。

### 4. 异常处理 —— `.qoder/rules/exception-handling-rules.md`

- 业务失败抛统一业务异常（禁止裸抛 `RuntimeException`/`IllegalArgumentException`）；全局异常处理器兜底，业务代码不自行 try-catch 包装返回。
- 模型/适配层异常**必须**翻译为 `AiException(ErrorCode)`（D33），SDK 原始异常不得外溢；重试只认 `ErrorCode.retryable`（D14：不做 fallback 链）。
- 能力不支持时抛 `UNSUPPORTED_CAPABILITY`，**不做静默降级**（§5.8-4）。
- 写操作 `@Transactional(rollbackFor = Exception.class)`；外部调用（HTTP/SDK）移出事务，用 `AFTER_COMMIT` 事件异步触发；乐观锁更新行数 != 1 必须抛异常。
- 例外：计量/观测上报（`UsageRecorder`/`ModelCallObserver`）失败是**有意吞异常 + WARN**（M19），不要「修复」为向上抛。

### 5. 日志 —— `.qoder/rules/logging-rules.md`

- 一律 `@Slf4j`；Controller 端点、写操作/状态流转、定时任务、事件消费必须中文打点入参与返回值；核心步骤（状态流转、外部调用耗时、乐观锁结果）必须打点。
- 占位符 `{}`，异常必须传 `Throwable`；敏感字段（api-key / Token / 密码、手机号、验证码）禁止明文输出。

## 六、完成前强制评审与验证

- **强制评审（硬性门禁）**：任何 Java 代码任务完成、收到 review / 评审 / 检查请求、或提交（commit）前，必须执行 `.qoder/rules/code-review-protocol.md`：逐条核对 5 条规范并输出逐条结论；存在未修复违规项、且用户未明确豁免时，不得宣告完成。
- 改完 Java 代码至少 `mvn -pl <module> -am compile`；涉及 main 链路跑 `mvn -pl open-coding-bootstrap -am test`。
- 提交信息沿用 Conventional Commits + 中文描述（见 `git log`）。
