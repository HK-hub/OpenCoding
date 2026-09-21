# 本地起跑配方 · 零凭证最小链路（Local Run Recipe）

> 定位：本文件是 `R10-walkthrough` 判定为**阻塞开工**的两处缺口的收口件——「无凭证跑不通最小链路」（R4）与「验收命令按未登记模块名书写、`-pl` 必失败」（B1）。
> 上游权威：`impl/01`（启动档与配置）、`impl/02`（模型网关与 provider 面）、`impl/19`（迁移与恢复）、`impl/22`（CLI 命令面）、`impl/33`（假模型、回放与门禁）、`impl/34`（探针）、`27-technical-path.md` §4.6/§4.7。凡本文件与上述文件冲突处，一律登记进 §7，不在本文件内单方面改口径。
> **模块名假设（显式声明）**：本文件所有 `-pl` 选择器按 `<segment>-<module>` 命名（聚合器 `harness-<segment>`，artifactId = 目录名，groupId `com.hk.opencoding`，version 由 `${opencoding.project.version}` 统一，取自根 `pom.xml:7/29`）。候选名取自 `impl/33` §11.5 与 `impl/01` §11.2。`impl/00-contracts/MODULE-MANIFEST.md` 落地后**以其为唯一权威**，本文件的选择器随之复核。

---

## §1 目标

### 1.1 新人路径（零凭证，≤ 15 分钟）

一个没读过任何卷册的新人，在不配置**任何**真实模型 API Key 的前提下，本地跑通五段闭环：

**新建会话 → 发一条消息 → 假模型流式返回 → 事件落库 → 恢复会话**

- 「零凭证」的判据不是「不报错」，而是：进程内**不存在任何真实出网连接**，且断言点不读取任何 `*_API_KEY`（对齐 `impl/33` REQ-QA-03/REQ-QA-31）。
- 「跑通」的判据是 §4.5 的事件序断言与 §3.4 的四条不变式断言全部成立，而不是「终端里有字打出」。
- 端到端预算：自动步骤合计 ≤ 13 分钟（§4 各段预算之和）；首次克隆含依赖下载 ≤ 30 分钟（对齐 `impl/33` §11.5.1）。

### 1.2 CI 路径（同一套配置，零凭证回归）

CI 用**同一份** `.env` 语义、**同一个**门禁入口（`scripts/ci/gate.mjs`）跑回归，差异只在于「是否发布产物」（卷 27 §4.6）。命令到 CI 阶段的映射见 §6；真模型相关阶段**默认跳过**（§6 标注 `需真凭证` 的行）。

### 1.3 非目标（本配方不覆盖）

- 真实 provider 的连通性与配额（`oc doctor model <provider> --probe` 属维护者场景，§6 默认跳过）。
- 完整评测（基准任务集、六维评分、红队）：本配方只跑 `oc qa replay --suite core` 的**回放子集**。
- 桌面端（`client/*`）与 A2A/联邦面；前端只在 §6 作为可选阶段出现。
- 生产部署形态（remote 档、多实例租约、对象存储/MinIO）。

---

## §2 前置依赖

### 2.1 基础软件

| 项 | 版本 / 说明 | 依据 |
| --- | --- | --- |
| JDK | 21（`java.version=21`） | 根 `pom.xml:31` |
| Maven | 3.9+（聚合 POM + Enforcer） | 卷 27 §4.6 D-PATH-4 |
| PostgreSQL | 14+（本配方容器用 16） | `AGENTS.md` §三 |
| Redis | 7+ | `AGENTS.md` §三 |
| Docker / Compose | 任一近期版本（也可用本机 PG/Redis 替代） | 卷 27 §4.7 |
| Node / pnpm | 20+ / 9+（**仅**前端阶段需要，可跳过） | 卷 27 §4.1 D-PATH-5 |
| `oc` CLI | 由 `harness-host/host-cli` 构建；未构建前可用 `curl` + REST/JSON-RPC 驱动同一链路 | `impl/22` §1.5 |

### 2.2 基础设施（docker compose 片段，落盘路径建议 `scripts/dev/compose.yaml`）

```yaml
name: opencoding-dev
services:
  pg:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: opencoding          # 库名：与 DB_URL 的路径段一致
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres      # 本地容器约定值，非部署凭证（见 2.3 纪律）
      TZ: UTC
      PGTZ: UTC
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=C"
    command: ["postgres", "-c", "timezone=UTC", "-c", "lc_messages=C"]
    volumes: ["oc-pg-data:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d opencoding"]
      interval: 5s
      timeout: 3s
      retries: 10
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    command: ["redis-server", "--appendonly", "yes", "--save", ""]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10
volumes:
  oc-pg-data:
```

要点：库名 `opencoding`、用户 `postgres`、端口 5432/6379；两者都必须有 `healthcheck`，否则 §5-3 的「Redis 未起」会在迁移阶段以无关报错形式暴露（误导排障）。`redis` **不设**密码（`REDIS_PASSWORD` 留空），因为本地无凭证契约优先于「本地也加密」；需要密码的部署形态由环境变量注入。

### 2.3 `.env` 变量清单（对齐 `.env.example` 命名风格）

`cp .env.example .env` 即可用；下表中「假模型需要」列决定该值是否**必须**填写。

| 变量 | 假模型场景取值 | 假模型需要 | 说明 |
| --- | --- | --- | --- |
| `SERVER_PORT` | `8080` | 是 | 管理面与 WS 端口；占用见 §5-1 |
| `LOG_LEVEL_APP` / `LOG_LEVEL_SQL` | `DEBUG` / `DEBUG` | 是 | 排障期建议 DEBUG；CI 用 `INFO`（日志量门禁） |
| `DB_URL` | `jdbc:postgresql://localhost:5432/opencoding?stringtype=unspecified` | 是 | `stringtype=unspecified` 供 `jsonb` 写入（`impl/19` §8.1） |
| `DB_USERNAME` / `DB_PASSWORD` | `postgres` / `postgres` | 是 | **本地容器约定值**，非部署凭证；部署环境必须由环境变量注入且不得沿用默认值（配置抽取规范 §4） |
| `FLYWAY_ENABLED` | `true` | 是 | 迁移是唯一 DDL 权威（`impl/19` §1.5；禁止 `ddl-auto`） |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | `localhost` / `6379` / 空 | 是 | 空密码即 §2.2 的无密码容器 |
| `SWAGGER_ENABLED` | `true` | 否 | `/readyz` 之外的调试面 |
| `OC_KERNEL_PROFILE` | `sidecar` | 是 | 宿主形态档（`impl/01` §9.4）；CLI 内嵌调试可用 `embedded` |
| `OC_HOME` | 空（默认 `~/.opencoding`） | 否 | 内核目录（锁/端点文件/日志），§5-6 的定位点 |
| `OC_FAKE_ENABLED` | `true` | 是 | 假模型开关，映射 §3.1 的配置键 |
| `OC_FAKE_SCRIPT_HOME` | 空（默认内建脚本目录） | 否 | 脚本覆盖目录（§3.3） |
| `OC_HEADLESS_APPROVAL_POLICY` | `deny` | 否 | 非交互档审批收口（`impl/01` §9.4）；§5-7 的根因之一 |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` / `OLLAMA_BASE_URL` | **留空** | **否** | 假模型路径**完全不读取**（§3.2 规则一）；留空是本配方的正常状态，不是缺失 |
| `QA_JUDGE_API_KEY` | **留空** | **否** | 轨迹判官专用；留空时判官维度转人工抽样，**不阻塞门禁**（`impl/33` §9.4） |

**纪律**：上表新增的任何键必须同步 `.env.example`（模板是唯一变量清单，`AGENTS.md` §四）；本配方需要的 `OC_FAKE_*` / `OC_KERNEL_*` / `OC_PERS_*` 目前尚未在模板中，登记为 §7-7。

### 2.4 字符集与时区（硬约束，违反即产生「假差异」）

| 维度 | 要求 | 理由 |
| --- | --- | --- |
| 时区（PG） | `timezone=UTC`（compose 已固定） | 事件表按 `recorded_at`（写入时刻）**月范围分区**（`impl/19` §8.1 / 卷 16 §⑧.1）；本机时区漂移会让跨零点事件落错分区 |
| 时区（JVM） | 启动加 `TZ=UTC`（或 `-Duser.timezone=UTC`） | 与 PG 同源；`impl/33` §⑩.11 要求环境固定为 `C / UTC / \n` |
| 编码 | 库 `UTF8` + `--locale=C`；源码/文本 UTF-8 | 对拍要求逐字节可比；`project.build.sourceEncoding=UTF-8` |
| 行尾 | `LF`（`.gitattributes` 强制 `eol=lf`） | 快照与期望输出跨平台逐字节可比（`impl/33` §⑩.11） |
| 端口 | PG 5432 / Redis 6379 / 服务 8080 / 内核 WS 端口 `0`（随机并写端点文件） | `impl/01` §9.4 `ipc.ws-port` 默认 `0` |

---

## §3 假模型装配面

### 3.1 激活方式（三选一，选定：`@ConditionalOnProperty`）

**选定**：在 `harness-host/host-bootstrap` 上以 `@ConditionalOnProperty(name = "open-coding.model.providers.fake.enabled", havingValue = "true")` 条件装配 `FakeModelProvider` 装配段；配置键与 `impl/02` §9.5 的 `open-coding.model.*` 命名空间同族，环境变量形态为 `OC_FAKE_ENABLED`。

被拒的两支与理由：

| 分支 | 判决 | 理由 |
| --- | --- | --- |
| Spring profile（如 `--spring.profiles.active=fake`） | 拒 | `profile` 在本语料已有**三义**（宿主形态档 `open-coding.kernel.profile`、出厂档 `oc --profile headless`、门禁档 `gate.mjs --profile fast`，见 `R10-walkthrough` R3）——再加第四个含义会让「本地跑的到底是哪套装配」不可判定；且 Spring profile 无法被 CI 用单个环境变量覆盖 |
| 独立配置项但**不加**条件注解（运行期判空） | 拒 | 会把「开关开着但假模型不在 classpath」变成运行期 NPE 或静默降级；本配方要求 **Fail-Fast**：开关开启而 `kernel-qa` 缺失 → 退出码 78 + `UNSUPPORTED_CAPABILITY`（对齐 `impl/01` §5.1） |
| **`@ConditionalOnProperty` + 配置键** | **选** | ① 默认关闭 = 生产不会误开；② `OC_FAKE_ENABLED=true` 一个环境变量即可在本地/CI 同时切换；③ 与既有 `@ConditionalOnMissingBean` 装配纪律同族，装配结果可被 `oc doctor --print-plan` 打印复核（`impl/01` REQ-ARC-14）；④ 生产镜像可加静态门禁扫描（生产 profile 出现该键即构建失败） |

**键名口径**：本文件采用 `open-coding.model.providers.fake.enabled`；任务口径曾写作 `open-coding.ai.providers.fake.enabled`。二者**禁止并存**，收敛动作登记 §7-8。

### 3.2 与真实 provider 的优先级与互斥规则

装配裁决点是 `host-bootstrap`（单点裁决，先探测后装配，结果可打印），算法：

1. `fake.enabled=true` → 模型出口**唯一**为 `FakeModelProvider`；**不读取任何凭证**，配置里出现的真实 provider 一律不装配（REQ-QA-03）。
2. `fake.enabled=false`（默认）→ 按 `open-coding.model.providers[]` 装配；一个可用出口都没有 → 退出码 78（Fail-Fast，不静默兜底）。
3. **互斥硬规则**：同一进程内「假模型出口」与「真实 provider 出口」不得同时装配；违反即启动失败（配置错误，而非运行期择一）。
4. 留痕：启用假模型时写 `system.capability.degraded`（能力：模型出口）并在 `/readyz` 与 `oc doctor --print-plan` 中标注 `model=fake`；这条留痕是「生产不会被静默降级」的机械保障。

**CI 双向断言**（`impl/33` §11.2）：无任何 `*_API_KEY` 时，`fake=true` 必须启动成功且回放套件全绿；`fake=false` 必须启动失败并给出可读文案。

### 3.3 响应脚本来源与格式

- 内建回归集：`harness-testkit/src/test/resources/qa/scripts/`（随仓库提交、owner-local 维护，REQ-QA-05）。
- 覆盖目录：`OC_FAKE_SCRIPT_HOME` / `open-coding.qa.fake.script-home`（默认指向内建目录）。
- 单次选择：`oc chat --workspace . --model fake --fake-script local-chain.yaml`（命令面见 §7-3）。
- 未匹配到步骤 → **显式失败**（`FakeModelProvider.openStream` 抛 `AiException`，禁止静默返回空响应掩盖用例缺口，REQ-QA-02）。

```yaml
# harness-testkit/src/test/resources/qa/scripts/local-chain.yaml
scriptId: local-chain
seed: 20260921                          # 进入 RunIdentity；缺失即拒绝运行（impl/33 §⑩.11）
virtualClock: 2026-09-21T10:00:00Z      # 轨迹时间戳唯一来源；回放路径禁止 Instant.now()
steps:
  - ordinal: 1                          # 场景一：文本流（多分片 + 正常终止）
    kind: TEXT_DELTA
    chunks: ["你好", "，这是", "假模型回放"]
    chunkDelayMs: [0, 40, 40]
    terminate: END_TURN
  - ordinal: 2                          # 场景二：工具调用（走真实权限/沙箱管线）
    kind: TOOL_CALL
    toolName: read_file
    arguments: { path: "README.md" }
    afterResult: TEXT_DELTA             # 回喂工具结果后继续出字
    chunks: ["已读取 README"]
    terminate: END_TURN
  - ordinal: 3                          # 场景三：错误（限流，可重试）
    kind: ERROR
    errorCode: RATE_LIMITED
    retryable: true
    terminate: ERROR
  - ordinal: 4                          # 场景四：截断（写盘后截断 → 不可重试）
    kind: TRUNCATE
    chunks: ["被截断的前缀"]
    truncateAfterChunks: 1
    terminate: LENGTH_TRUNCATED
```

覆盖性说明：四类示例分别命中「文本流 / 工具调用 / 错误 / 截断」；`StepKind` 的完整八种终止形态（正常/长度截断/工具/拒答/空响应/畸形/超时/取消）以 `impl/33` REQ-QA-02 为准，本文件不重定义其字段级 Schema（§7-3）。

### 3.4 「模型可见 ⟺ 已记录」在假模型下的验证点

不变式来源：`impl/12` REQ-AG-04 与 `impl/16` REQ-EVT-23（内容进入模型请求前必须已由事件流记录；历史只能由投影得到）。

1. **同一条接缝**：`FakeModelProvider implements ModelProvider`（`impl/33` §5）——上下文组装、权限决策、工具管线、事件写入**全部是真实实现**，只替换模型出口。因此「假模型下成立」等价于「真实模型下成立」。
2. **事件序断言**：一次 Turn 后 `oc_event_log` 中 `model.request.* → model.delta.* → model.response.settled → agent.item.committed` 的 `seq` 单调、无缺口（SQL 见 §4.5）。
3. **逐字节对拍**：`ModelVisibleRebuildTest` 抽取模型请求历史与事件投影比对，常驻 CI；人为篡改一条 payload → 必须失败并给出**首个差异位置**。
4. **未结算即丢弃**：会话进行中 `kill -9` 或 `session.interrupt`，重启后未结算的流式内容不得出现在历史（它从未进入 `oc_item`，见 `impl/12` §⑩.6）。
5. **确定性**：脚本 `seed` 与 `virtualClock` 进入 `RunIdentity`；回放路径出现 `Instant.now()` / 未播种 `Random` 即判缺陷（架构断言扫描，`impl/33` §⑩.11）。

---

## §4 命令手册（逐条可复制）

> 每段给出「命令 / 预期输出 / 耗时预算」；首次克隆的依赖下载只发生在 4.3 第一次编译。

### 4.1 启动基础设施（≤ 1 min；首次拉镜像 ≤ 3 min）

```bash
docker compose -f scripts/dev/compose.yaml up -d
docker compose -f scripts/dev/compose.yaml ps --format 'table {{.Name}}\t{{.Health}}'
```

预期：`oc-pg` 与 `oc-redis` 的 `Health` 均为 `healthy`。任一为 `starting/unhealthy` → 先按 §5-1/§5-3 处置，不要带着不健康的基础设施进入 4.2。

### 4.2 建库与迁移（Flyway 为唯一 DDL 权威，≤ 1 min）

```bash
cp .env.example .env                 # 假模型无需填任何 key（§2.3）
oc data migrate plan                 # 只读：列出待执行迁移与破坏性级别
oc data migrate apply                # Flyway（版本+校验和）+ 编排器（阶段/门禁/限速）
oc data migrate status               # 期望：所有 domain 均为 APPLIED
```

预期：`oc_schema_version` / `oc_migration_record` 中出现 B1 批次记录（`impl/19` §1.5 清单），首轮迁移 ≤ 30s。
纪律：**不得手改**已提交迁移脚本——Flyway 的校验和是防篡改机制（不符即拒绝启动/执行，§5-2）；本地实验性 DDL 请走新版本号脚本。
未构建 `oc` 前的替代路径：应用启动时 `FLYWAY_ENABLED=true` 自动执行迁移（首次迁移的 B1 权威清单尚未收敛，见 §7-9）。

### 4.3 启动服务（首次含编译 ≤ 3 min；之后 ≤ 90 s）

```bash
TZ=UTC mvn -q -pl harness-host/host-bootstrap -am spring-boot:run
# 调试内嵌形态（不起独立进程）：oc --embedded
# 另开一个终端：
curl -sS http://127.0.0.1:8080/healthz           # 存活
curl -sS "http://127.0.0.1:8080/readyz"          # 就绪（含模型层标注 model=fake）
```

预期：stdout 出现 `system.started` → `system.ready`（事件名见 `impl/01` §8.3）；`/healthz` 200；`/readyz` 返回就绪且模型层强度为 `PARTIAL`（假模型出口）。
说明：`/healthz`+`/readyz` 取自 `impl/01` §9.2；`impl/34` §9.1 另有一套 `/live`+`/ready`+`/deep`，两套口径未收敛 → §7-5。

### 4.4 CLI 连接本地内核并发送消息（≤ 1 min）

```bash
oc doctor --print-plan                                   # 装配树：必须出现 model=fake
oc chat --workspace . --model fake --fake-script local-chain.yaml
# 非交互（脚本/CI）形态：
oc run "读 README.md 并概括一句" --model fake --non-interactive --output stream-json
```

预期：首 token ≤ 1.5s（假模型通常 ≤ 200ms，门禁线见 `impl/33` §11.4）；流式分片按脚本 `chunks` 逐片到达；`ordinal: 2` 的工具调用经**真实**权限/沙箱管线执行（可能被审批拦下 → §5-7）；`ordinal: 3/4` 分别触发可重试与不可重试错误分类。

### 4.5 查询事件与会话恢复（≤ 1 min）

```bash
oc session ls --json | jq '.[0].sessionId'
oc session show <sessionId> --json | jq '{state, lastEventSeq}'
psql "$DB_URL" -c "select seq, type, recorded_at from oc_event_log \
  where session_id = '<sessionId>' order by seq limit 20;"
oc session resume <sessionId> --from-seq <n>             # 断线续传 / 恢复
```

预期：`agent.item.committed` 与 `model.*` 事件按 `seq` 单调且无缺口（§3.4-2）；`resume` 补发无缺口；窗口外走快照重建且 `lastEventSeq` 一致（`impl/01` §6.3）。
注意：`oc_event_log` 按 `recorded_at` 分区，查询**必须带时间谓词**否则全分区扫描；列名（`session_id` / `partition_key`）以 `impl/19` §8.1（DDL 唯一权威）为准——当前 `impl/01`/`12`/`16` 三处口径未收敛（`R10-walkthrough` B4/B6 → §7-9）。
恢复命令的最终参数面（`oc session resume` 与 JSON-RPC `session.resume` 的对应）见 §7-10。

### 4.6 单测 / 集成测试（含假模型回放，合计 ≤ 10 min）

```bash
mvn -q -pl harness-kernel/kernel-qa -am test        # 脚本引擎/注入器/评分器 ≤ 3 min
mvn -q -pl harness-platform/platform-qa -am test    # 快照台账/运行器（PG+Redis 容器）≤ 6 min
mvn -q -pl harness-testkit -am test                 # 基座自检（禁 sleep、等待原语诊断）≤ 3 min
oc qa replay --suite core --snapshot-dir harness-testkit/src/test/resources/qa/snapshots   # 零凭证回放 ≤ 6 min
```

预期：四段全绿；回放段在**无任何 `*_API_KEY`** 且**零出网**条件下通过（REQ-QA-03）；脚本耗尽用例显式失败而非静默兜底。
模块名与是否登记见 §7-1（`harness-testkit` 为根级测试期模块，未登记时 `-pl` 必失败 → §5-8）。

### 4.7 端到端冒烟（≤ 8 min）

```bash
./scripts/ci/gate.mjs --profile fast                 # 单入口、与 CI 同序（覆盖/差集/漂移/性能）
oc doctor --deep --format json                       # 五层探针（退出码 0/1/42/53）
curl -sS "http://127.0.0.1:8080/readyz?smoke=full"   # 合成三段冒烟
```

预期：`gate.mjs` 退出码 0 且总耗时 ≤ 8 min（超 1.5× 即告警，`impl/33` §11.5.1）；`oc doctor --deep` 输出五层结论且机读 JSON 可解析。
脚本名口径：本配方统一用 `gate.mjs`（`impl/33` I-QA-10 R06 已冻结快/全两档）；卷 27 §4.6/§4.7 与 §7 DoD 仍写 `all.sh`，收敛动作 → §7-6。

**零凭证路径合计 7 条命令**：`4.1 → 4.2（cp + apply）→ 4.3 → 4.4 → 4.5 → 4.7`。

---

## §5 故障排查（12 项）

| # | 症状 | 诊断命令 | 修复 |
| --- | --- | --- | --- |
| 1 | `BindException` / `port is already allocated`（5432/6379/8080） | `docker compose ps`；`netstat -ano \| findstr :8080` | 停占用进程，或改 `.env` 的 `SERVER_PORT` / compose 端口映射；内核 WS 端口为 `0` 时用端点文件定位，残留端点文件按 pid 清理后重试（`impl/22` §6.6 步骤 5） |
| 2 | `Migration checksum mismatch for migration version …` | `oc data migrate status --json` | **不得**手改已提交脚本：`git checkout -- <script>` 还原；本机私改且已应用 → 重建本地库（drop/create + `oc data migrate apply`）；生产走 Runbook 审批，禁止自动改历史（`impl/19` §9.1 `INTERNAL_ERROR`） |
| 3 | 启动日志 `DEPENDENCY_UNAVAILABLE`（Redis）或锁超时 | `docker compose ps redis`；`redis-cli -h 127.0.0.1 ping` | 起容器；单机形态允许进程内降级锁（`impl/19` §8.2 降级列），但 **CI 不允许降级**（须断言 `degraded=0`） |
| 4 | 事件「少了一天」或对拍出现整段差异 | `psql -c "show timezone;"`；`select min(recorded_at), max(recorded_at) from oc_event_log where session_id='<id>';` | 统一 UTC：compose 已固定 `timezone=UTC`，JVM 加 `TZ=UTC`；已漂移的数据重建本地库（分区键为 `recorded_at`，不可原地改） |
| 5 | 退出码 78 / 日志出现真实 SDK 出网报错 | `oc doctor --print-plan \| grep -i fake`；`env \| grep OC_FAKE` | 设 `OC_FAKE_ENABLED=true`；若报「假模型不可用」，确认 `kernel-qa` 在 classpath（§7-1）——这是 Fail-Fast 的预期行为，不要改成静默降级 |
| 6 | `oc` 连不上内核，退出码 44 `LINK_ERROR` | `oc doctor --json`；`ls "$OC_HOME"` 查端点文件 | 用 `oc --embedded` 直连；或核对 `OC_KERNEL_PROFILE=sidecar` 与 `OC_KERNEL_IPC_TRANSPORT`（`stdio`/`ws`/`both`）一致；版本不兼容按提示升级，不静默降级（`impl/22` §6.6） |
| 7 | 工具调用被拒（`APPROVAL_DENIED`，退出码 2） | 查会话 `approval.*` 事件；`oc doctor --print-plan` 看权限模式 | 非交互档审批默认为 `deny`（`OC_HEADLESS_APPROVAL_POLICY`）；在交互档显式授权，或给脚本加 `--yes`。**禁止**为跑通用例改成静默放行（安全边界，`impl/06`） |
| 8 | `Could not find the selected project in the reactor: harness-kernel/kernel-qa` | `grep -n "<module>" pom.xml`；查 `impl/00-contracts/MODULE-MANIFEST.md` | 模块尚未登记（§7-1）：临时改用聚合选择器 `-pl harness-kernel -am`；登记后回改命令 |
| 9 | `relation "oc_agent_input" does not exist` / 表族缺失 | `oc data migrate status`；`psql -c "\dt oc_*"` | 首次迁移的 B1 权威清单未收敛（§7-9）；先 `apply` 再核对 `impl/19` §8.1，不要在本地手写建表脚本 |
| 10 | `SNAPSHOT_INTEGRITY_FAILED`（回放拒绝加载） | 打开快照头比对 `checksum` 与登记值 | **重新录制**（`oc qa snapshot record`，维护者本机、需真凭证），禁止手改入仓快照（防「假绿」，REQ-QA-04） |
| 11 | 回放确定性失败（摘要 SHA-256 与记录不一致） | 看失败输出给出的**首个差异位置** | 检查路径归一（POSIX 相对路径）、行尾 LF、时钟（禁 `Instant.now()`）；CI 与开发机使用同一容器镜像（`impl/33` §⑩.11） |
| 12 | 首次构建卡在依赖下载超预算 | `mvn -o -q -pl harness-kernel/kernel-qa -am test`（离线试探） | 配 Maven 镜像（`~/.m2/settings.xml`）；预算 ≤ 15 min（`impl/33` §11.5.1），超时按体验缺陷登记 |

---

## §6 CI 对齐

命令 → CI 阶段映射（真模型行默认跳过；`零凭证` 列指该阶段在无任何 `*_API_KEY`、无出网条件下必须通过）：

| 阶段 | 命令 | 零凭证 | 对应卷 27 §4.6 门 | 预算 |
| --- | --- | --- | --- | --- |
| lint / 格式与规范 | `./scripts/ci/gate.mjs --profile fast --only lint`（含提交信息与编码规范校验） | 是 | 门 1「格式与规范」 | ≤ 1 min |
| 依赖规则 | Enforcer R1–R5（随任意 `mvn` 生命周期目标执行） | 是 | 门 2「依赖规则校验」 | 随构建 |
| 单测 + 覆盖率 | `mvn -q -pl harness-kernel/kernel-qa -am test` + 覆盖率门（核心域行 ≥ 80% / 分支 ≥ 70%，`impl/33` §9.4） | 是 | 门 3「单元测试 + 覆盖率门」 | ≤ 3 min |
| 集成 | `mvn -q -pl harness-platform/platform-qa -am test`（Testcontainers：PG + Redis） | 是 | 门 4「集成测试（PG/Redis 容器 + 沙箱）」 | ≤ 6 min |
| 契约 | `mvn -q -pl harness-host/host-protocol -am test -Dgroups=contract` | 是 | 门 5「契约测试（协议/事件 Schema/SPI/模型适配）」 | ≤ 5 min |
| 离线评测（回放子集） | `oc qa replay --suite core --snapshot-dir …` | 是 | 门 6「离线评测（核心集）」 | ≤ 6 min |
| 冒烟（端到端） | 4.3 → 4.4 → 4.5 的非交互形态 + `curl /readyz?smoke=full` | 是 | 门 4/5 之外的第 3–8 步「端到端可演示」验收入口 | ≤ 2 min |
| 前端（可选） | `pnpm -C client run lint:copy` + `pnpm -C client --filter @open-coding/sdk generate --check` | 是（不含真模型） | 门 7「前端构建 + 类型检查」 | ≤ 6 min |
| **真模型连通（默认跳过）** | `oc doctor model anthropic --probe` | **否（需 `ANTHROPIC_API_KEY`）** | 无对应门（维护者手工） | ≤ 3 s |
| **录制快照（默认跳过）** | `oc qa snapshot record --case <id> --profile headless` | **否（需真凭证，仅维护者本机）** | 无对应门 | 手动 |
| 全量（发布前） | `./scripts/ci/gate.mjs --profile full --no-skip` | 是（除上两行） | 门 6–9 全量 + 红队 + 性能 | ≤ 20 min |

映射要点：
1. 门 3–6 与 `impl/33` §11.5 的验收命令逐条对应；门 6 在无凭证环境**只跑回放子集**，判官维度自动转人工抽样（`QA_JUDGE_API_KEY` 留空不阻塞）。
2. 与卷 27 §4.6 的差异：§4.6 未给具体命令、且单入口名写作 `*.sh`/`all.sh`；本配方使用 `gate.mjs`（`impl/33` I-QA-10）。收敛登记 §7-6。
3. 「本地与 CI 同入口同序」是硬约束（REQ-QA-30）：CI 配置文件的阶段顺序必须与 `gate.mjs` 输出的顺序一致，并由一致性用例锁死；禁止在仓库根之外任意目录直接跑测试（目录守卫）。

---

## §7 待补项（本配方依赖但语料尚未定义）

| # | 缺口 | 本配方的依赖点 | 责任文档 |
| --- | --- | --- | --- |
| 1 | **模块坐标与测试期登记**：`harness-testkit`（根级测试期模块）、`kernel-qa`、`platform-qa` 的 artifactId、是否进生产 classpath、聚合 POM 是否存在 | §4.6/§4.7 全部 `-pl` 选择器；§5-8 | `impl/00-contracts/MODULE-MANIFEST.md`（并行编写）+ 卷 27 §4.1 |
| 2 | **契约冻结**：`ErrorCode`（含 `retryable`）、`HarnessException`/`AiException` 归属、12 个内核端口签名、`AdmissionOutcome` | §4.3/§4.5 的退出码与错误文案、`/readyz` 判据 | `appendix-b` §B.11/§B.2；`impl/01` §9.3 |
| 3 | **假模型脚本 Schema 与命令面**：`ResponseScript`/`ScriptStep`/`StepKind` 八种终止形态的字段级定义；`oc chat --model fake --fake-script`、`oc qa script validate` 是否成立 | §3.3 YAML 示例的对拍基线；§4.4 命令 | `impl/33` §5/§9.2 + `impl/02` §9.5 |
| 4 | `scripts/dev/compose.yaml` 与 `scripts/dev/up.sh` 的实体（当前仅有卷 27 §4.7 的一句提及） | §2.2/§4.1 | 卷 27 §4.7 |
| 5 | 探针端点口径二选一：`impl/01` §9.2（`/healthz`+`/readyz`） vs `impl/34` §9.1（`/live`+`/ready`+`/deep`） | §4.3/§4.7 | `impl/01` §9.2 与 `impl/34` §9.1 |
| 6 | CI 单入口名（`gate.mjs` vs `all.sh`）与 `scripts/` 清单表 | §4.7/§6-2 | 卷 27 §4.6/§4.7 |
| 7 | `.env.example` 缺失变量族：`OC_KERNEL_*`、`OC_FAKE_*`、`OC_PERS_*`、`QA_*` | §2.3 清单 | `.env.example` + `impl/01` §9.4 / `impl/22` §9.4 / `impl/33` §9.4 |
| 8 | 假模型配置键名收敛：`open-coding.model.providers.fake.enabled`（本文件） vs 任务口径 `open-coding.ai.providers.fake.enabled` | §3.1 | `impl/02` §9.5 |
| 9 | B1 权威表清单（首次迁移能否只跑 B1；`oc_item` 正文列与 `oc_event_log` 唯一性口径） | §4.2/§4.5/§5-9 | `impl/19` §8（升格为 DDL 唯一权威）；`R10-walkthrough` B4/B6 |
| 10 | 会话恢复命令面：`oc session resume <id> --from-seq <n>` 与 JSON-RPC `session.resume` 的参数/语义映射 | §4.5 | `impl/19` §9.3 / `impl/22` §9.1 |
| 11 | 事件命名分叉：`session.input.admitted/promoted`（`impl/01`） vs `agent.input.admitted`（`impl/12`）——影响 §4.5 的事件查询断言 | §4.5 | `impl/16` §8.3 跨域唯一事件清单 |
| 12 | `oc doctor --print-plan` 与 `--deep` 的输出 Schema（JSON 字段名与退出码矩阵的机读约定） | §3.2 留痕断言、§4.4/§4.7 | `impl/01` §9.1 / `impl/34` §9.1 |

---

### 附：本文件的取证与复核方式

- 所有模块名、命令、配置键均可回溯：模块与命令取自 `impl/33` §11.5（+ `impl/01` §11.2、`impl/19` §9.3、`impl/22` §9.2、`impl/34` §9.2）；配置键取自 `impl/01` §9.4、`impl/02` §9.5、`impl/19` §9.5、`impl/22` §9.4、`impl/33` §9.4；变量命名风格取自根 `.env.example`。
- 本文件不修改任何其它文件；§7 的 12 项由对应责任文档处置。`MODULE-MANIFEST.md` 落地后，§4 的全部 `-pl` 选择器与 §2.1 的基础软件版本表**必须复核一次**。
