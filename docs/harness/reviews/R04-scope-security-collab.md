# R04 · 安全与权限纵深评审（对抗性视角：impl/20、21、23、24、25、27、28）

> 评审轮次：REVIEW ROUND 4（镜头：安全与权限纵深；本文件以**攻击者身份**逐文件找绕过）
> 范围：`impl/20-workspace-provider-impl.md`、`21-git-worktree-impl.md`、`23-desktop-electron-vue-impl.md`、`24-a2a-gateway-impl.md`、`25-enterprise-iam-audit-impl.md`、`27-security-runtime-impl.md`、`28-distribution-telemetry-impl.md` + 本文件
> 参照基准：`07-sandbox-security.md`（档位/围栏）、`24-enterprise-operations.md`（身份与审计）、`30-security-engineering.md` §2.2 信任边界与 §4.3 STRIDE；竞品证据 `research/competitors/03-codex.md`（沙箱不变式 / `WritableRoot` / `denied-read` 谓词）、`04-deepseek-harness.md`（SSH 执行 provider / `ctx.credentials` / stdout 协议纪律）、`05-minimax-cli.md`（凭据遮蔽 / L-016 工具租约）、`07-qoder.md`（`security.blockGitExtensions` / `folderTrust` / hook 权限）、`09-secondary-tier.md`（Cline SSH、Roo `createSanitizedGit`）、`research/CROSS-COMPARISON.md` §4
> 交付约束：**只增不改**——未删除任何小节、决策编号（`I-*` / `D-*`）与 REQ 编号；新增内容均带「R04 新增」锚点便于机械检索
> 结论摘要：信任边界 **12 条**逐条登记；绕过注册 **15 项**——**全部在本轮文件内补齐控制**（其中 2 项为跨文件一致性缺陷 CO-1 / CO-2），另有 6 项无法就地闭合的场景登记为残余风险（§九）；凭据生命周期 **6 类**逐项核对（3 处缺口已补）；拒绝优先（deny-by-default）/ 最小权限 **14 项默认值**逐一核对；Mermaid **64/64 通过**、Java 代码块括号 0 失衡；新增 2 个实现级决策（`I-WS-9` / `I-GIT-10`）、2 条 REQ（`REQ-WS-21` / `REQ-GIT-20`）、9 个配置项（全部为安全/加固向，默认值一律「拒或最小」，非法值启动校验拒绝）。

---

## 一、方法与可复核口径

1. 逐文件读全部安全相关落点：§⑩「安全」小节、§⑨ 配置表与接口表、核心时序图、故障注入矩阵、DoD/负面 DoD；对每个「数据进入点」追问三件事——**载荷可控者是谁 / 控制在哪一步强制 / 控制缺失时后果是什么**。
2. 绕过构造清单（本轮 15 类，含任务点名场景）逐条对照文件：命中即**就地补控制**（表格 / 配置项 / 故障注入用例 / DoD 勾选项），无法就地闭合的登记进 §九 残余风险。
3. 跨文件链路（20→21→23→24→25→27→28）按「同一语义只有一处权威」核对，发现分歧即改到与权威源一致。
4. 复现命令见 §八（Mermaid 真实解析 + Java 块括号平衡 + 关键控制检索）。

## 二、逐文件攻击面速览（7 行，一文件一行；「缺口」= 本轮修复项）

| 文件 | 高价值攻击面 | 原稿覆盖 | 本轮缺口与处置 |
| --- | --- | --- | --- |
| 20 | SSH 远端连接（主机密钥 / 跳板 / 转发）、路径围栏、远端端点选择 | 凭据引用、围栏、出站受限（§⑩.6） | 主机密钥纪律、跳板逐跳、转发约束、`deny-private` 端点、TOCTOU（TB-1/2，已补） |
| 21 | 仓库内容 → 宿主执行（hooks/config/attributes/子模块/预检）、worktree 路径与 ref | 提交扫描、危险操作护栏、凭据租约 | 执行面加固 G-1…G-7、slug/realpath 围栏（TB-3/4，已补） |
| 23 | 渲染进程 IPC（路径读取 / 外链 / 秘密写入）、深链、本机内核端点、分享链接 | `contextIsolation`+`sandbox`+CSP、sender 校验、通道清单 | 能力票据、主进程外链裁决、命名空间收口、深链白名单、双向令牌握手、跟随端审批上限（TB-5/6/7，已补） |
| 24 | 外部调用方认证/授权、审批回填、回调 Webhook、产物 URL、联邦 Card | 五类认证、scope 收窄、幂等、HMAC、L1+ 隔离 | 审批四元组绑定/自批禁止/一次性、回调 SSRF、凭据即时吊销（TB-8，已补） |
| 25 | IdP 断言、SCIM 载荷、JIT 开通、离职吊销、审计链 | state/nonce/验签、域名已验证、链路哈希 + WORM | 域独占 + `email_verified` + 最小角色 + 速率；吊销扇出七类 + 5 分钟 SLA + 双侧 fail-closed（TB-10，已补） |
| 27 | 10 条边界的可执行校验、密钥六态、命令判定、供应链、滥用 | 三阶段矩阵、fail-closed、哨兵、SBOM/签名 | B5 加固（主机密钥启动检查 + 仓库执行面运行期探针）；非 HTTP 凭据例外（TB-11/12，已补） |
| 28 | 更新四道关、防降级、通道绑定、遥测 egress、崩溃转储、许可 | 签名+哈希+防降级+通道、白名单构造器、本地预览 | 豁免票据签名、转储哨兵/指纹扫描、通道命名统一（TB-11，已补） |

## 三、信任边界登记表（7 份文件「谁 → 谁」）

| # | 文件 | 信任边界（不可信侧 → 受害侧） | 原稿控制 | 本轮判定 |
| --- | --- | --- | --- | --- |
| TB-1 | 20 | 远端工作区（SSH 主机 / 中间人）→ 本地内核 | 仅 `27 §4.2` B5 启动期「配置检查」指针，文件内无主机密钥纪律 | **缺口 → 已补**（REQ-WS-21 / I-WS-9 / §⑩.6；含 `SshHostKeyPolicyEnum` 样例） |
| TB-2 | 20 | 路径输入与仓库符号链接 → 本地文件系统 | `PathUri` 归一 + 卷 07 围栏 | **弱（未声明 TOCTOU）→ 已补**（§⑩.6 TOCTOU 围栏 + 21 G-7） |
| TB-3 | 21 | 仓库内容（hooks / config / attributes / 子模块 / `.oc/ci.yaml`）→ 宿主执行 | 提交扫描 + 危险操作护栏（只覆盖写方向） | **缺口（本轮最高危）→ 已补**（REQ-GIT-20 / I-GIT-10 / §⑩.7 G-1…G-7） |
| TB-4 | 21 | worktree 路径与分支名（`../`、slug 注入、链接替换）→ 文件系统 / ref 命名空间 | 未声明 | **缺口 → 已补**（G-7 + §⑪.5 负面 DoD） |
| TB-5 | 23 | 渲染进程 ↔ 主进程（IPC） | `contextIsolation` / `sandbox` / `nodeIntegration=false` / CSP / sender 校验 / 通道清单 | 通过；**3 处通道级缺口 → 已补**（`fs.readReference` / `shell.openExternal` / `secrets.put`，§⑨.1 通道纪律） |
| TB-6 | 23 | 深链 `oc://` / 第二实例参数 → 应用状态与审批 | 仅单实例 + 参数转发 | **缺口（一键钓鱼）→ 已补**（§⑨.1 深链白名单 + §⑩.5） |
| TB-7 | 23 | 主进程 → 本机内核端点（回环） | 客户端侧未声明（27 B2 只覆盖服务端校验） | **弱（端口抢注 / 假内核）→ 已补**（双向令牌握手，§⑩.5） |
| TB-8 | 24 | 外部调用方（A2A/ACP）→ 任务系统与审批 | 五类认证 + scope + 配额 + 幂等 + HMAC 回调 | 通过；**审批冒充/重放/自批、回调 SSRF → 已补**（§⑥.3 / §⑨.5 / §⑨.6 / §⑩.5） |
| TB-9 | 24 | 联邦节点 Agent Card → 路由与任务转发 | Card 签名 + 管理面审核 | 通过（信任根单列见残余风险 R4） |
| TB-10 | 25 | IdP 断言 / SCIM 载荷 → 用户与角色状态 | state/nonce/签名/域名已验证 + JIT | 通过；**域接管、批量伪造、JIT 提权、离职吊销滞后 → 已补**（§⑥.1 / §⑥.2 / §⑦.1 / §⑩.5） |
| TB-11 | 27 / 28 | 更新通道 / 遥测出口 → 已装二进制与数据外发 | 四道关 + 防降级 + 钉扎；白名单构造器 + 禁止项扫描 | 通过；**豁免票据未签名、转储夹带秘密 → 已补**（28 §4.2 / §4.3 / §⑩.4） |
| TB-12 | 27 | 全部 10 条边界（B1–B10） | 编译期 / 启动期 / 运行期三阶段校验矩阵 | 通过（本轮加固 B5：启动期主机密钥配置 + 运行期仓库执行面探针） |

## 四、绕过注册表（场景 | 缓解控制 | 落点 file:line | 状态）

| # | 攻击场景（构造） | 缓解控制（修复内容） | 落点（file:line） | 状态 |
| --- | --- | --- | --- | --- |
| BP-1 | **仓库配置执行命令**：恶意仓库提交 `filter.*.clean/smudge`、`core.fsmonitor`、`core.sshCommand`、`credential.helper`，任何 `git checkout/status` 即宿主执行 | 执行类配置键只读白名单 + 命中即拒绝该次操作 + `GIT_CONFIG_NOSYSTEM=1`；`include.path` 禁外逃 | `21:888-895`（G-2）/ `21:765` | ✅ 已修 |
| BP-2 | **`.git/hooks` 与 `core.hooksPath`**：`pre-commit` / `post-checkout` 钩子被 `git commit/checkout` 触发执行 | `.git/hooks` 只读 + `core.hooksPath` 重定向空目录；真实钩子仅 folder trust + 审批（`git.trust.repo-hooks=never` 默认） | `21:891`（G-1）/ `21:758` | ✅ 已修 |
| BP-3 | **子模块与传输协议**：`.gitmodules` 用 `ext::sh -c ...` 或 `file:///` 拉取本地/任意命令；`url.*.insteadOf` 改写目标 | `GIT_ALLOW_PROTOCOL=https:ssh` + `protocol.ext.allow=never`；子模块默认不递归且需确认；`insteadOf` 仅白名单 | `21:894`（G-4） | ✅ 已修 |
| BP-4 | **仓库级预检命令注入**：`.oc/ci.yaml` 写入任意命令，合并队列在宿主执行 | 预检与普通命令同权限链 + 同沙箱 + 同超时；解析只取只读结构化子集；摘要首现/变更需审批；未信任仓库不执行 | `21:765-766` / `21:896`（G-6） | ✅ 已修 |
| BP-5 | **worktree 路径穿越 / 符号链接替换**：slug 含 `../`，或 check→use 之间把目录替换为外部链接（TOCTOU） | slug 白名单 `[a-z0-9._-]`；目标路径 `realpath` 必须落在 `git.worktree.root`；打开时解析以句柄操作，回收前重校验 | `21:897`（G-7）/ `20:1016`（TOCTOU 围栏） | ✅ 已修 |
| BP-6 | **SSH 主机密钥校验被绕过**：`StrictHostKeyChecking=no/accept-new` 或密钥变化时静默改写 known_hosts → 中间人拿到远端会话与口令 | 默认 `host-key-policy=strict`；密钥变化**阻断 + 告警 + 不改写 known_hosts**；首次信任人工核对指纹；非法值启动校验拒绝 | `20:112` / `20:235` / `20:921` / `20:1004` | ✅ 已修 |
| BP-7 | **SSH agent 转发滥用**：跳板机继承转发套接字，可在任意跳点用本地私钥签名 | `ForwardAgent` 默认关；开启时仅目标主机、跳板禁 `-A`、限制可转发密钥集、会话结束撤销；非 HTTP 凭据代理不可用即拒绝 | `20:1005` / `27:133` / `27:930` | ✅ 已修 |
| BP-8 | **Electron 任意文件读取**：渲染进程被注入后调用 `fs.readReference({path:"~/.ssh/id_rsa"})` 把私钥读进渲染层外发 | 路径必须来自主进程签发的一次性授权票据（绑定 windowId/realpath/有效期/单次）；A0 与敏感路径即使票据命中根也拒绝 | `23:734`（通道表）/ `23:750`（通道纪律） | ✅ 已修 |
| BP-9 | **外链确认被冒充**：`shell.openExternal({url, confirmed:true})` 由渲染进程自带 `confirmed`，绕过确认打开 `file:`/自定义 scheme | 确认由**主进程**原生弹窗裁决（字段语义废止）；协议白名单 `http/https/mailto`；其余一律 `PERMISSION_DENIED` | `23:745` / `23:751` | ✅ 已修 |
| BP-10 | **深链一键钓鱼批准**：`oc://approve?...` 或第二实例参数携带审批/安装/导出指令，一次点击即生效 | 深链只允许只读导航（打开会话/定位工作区/设置页）；状态变更必须窗口内显式操作；未知参数忽略并产 `ui.deeplink.rejected` | `23:753` / `23:883` | ✅ 已修 |
| BP-11 | **A2A 调用方冒充用户 / 重放审批 / 自批**：伪造 `decided_by`、跨 caller 回填他人审批、`AGENT_UNTRUSTED` 批准自身任务、放大授权范围 | 决定绑定 `approvalId+toolCallId+callerId+linkId`；决定人取自认证上下文；自批默认禁止（untrusted 恒拒）；范围只可收窄；决定一次性；回填经同一决策链复核 | `24:574` / `24:818` / `24:847` / `24:931` | ✅ 已修 |
| BP-12 | **回调 Webhook SSRF / DNS 重绑定**：`approvalCallback` 指向 `127.0.0.1` / `169.254.169.254` / 私网，借网关代发打内网或探测 | `egress.callback-policy=deny-private`（默认）；解析后以校验所得 IP 建连、不跟随重定向；目标变更重新登记并审计 | `24:575` / `24:848` | ✅ 已修（原稿只声明「出站 DLP + 域名策略」） |
| BP-13 | **SCIM 离职后令牌仍活**：主体已 `OFFBOARDED`，但其会话/API Key/委托 OAuth/MCP 授权/分享链接在窗口期继续可用 | 吊销扇出清单七类入口 + 完成 SLA ≤ 5 分钟；未确认期间认证层 + 授权层双侧 fail-closed；A2A 凭据吊销即时生效（缓存 TTL ≤ 60s） | `25:530` / `25:635` / `25:883` / `24:818` | ✅ 已修 |
| BP-14 | **更新降级 / 通道混淆**：切 nightly 后元数据回指旧版；或本机伪造 `--allow-downgrade` 跳过防降级 | 防降级单点谓词 + 豁免票据必须**签名**（含版本对绑定 / 到期 / 一次性 nonce，离线验签）；CLI 开关不构成豁免；通道取值经 `UpdateChannel.of()`，未知值拒绝 | `28:231` / `28:247-260` / `23:110` / `23:801` | ✅ 已修 |
| BP-15 | **遥测通道夹带秘密**：崩溃转储 / 诊断包含哨兵值、密钥、提示词全文，随「摘要自动上传」出站 | 转储与诊断包属 A1：上传前过 egress 白名单 + 禁止项 + **哨兵值/已知密钥指纹**扫描，命中即阻断 + 告警；正文 DEK 加密封存，清单不含原文 | `28:278` / `28:967-968` | ✅ 已修 |

> 跨文件一致性缺陷（同轮修复）：**CO-1** 更新通道命名——23 原写 `stable/latest/beta` 与 28 `UpdateChannel{STABLE,BETA,NIGHTLY}` 冲突（通道混淆的直接来源），已统一为 `stable/beta/nightly` 并注明 `latest` 为迁移期别名（`23:110/801`，§6.5 时序同步）；**CO-2** 执行链顺序无单点声明——20/21/24 各自表述「权限链 / 沙箱 / 能力校验」次序，已在 `20:1056` 单点声明五步固定顺序（权限链 → 沙箱计划 → 能力校验 → 执行 → 审计）并要求 21/23/24 引用，A2A 外部审批仅作为第 ① 步的输入通道。

## 五、凭据 / 秘密生命周期核对（6 类）

| 类 | 存储与使用 | 轮换 / 吊销 | 日志与落盘 | 结论 |
| --- | --- | --- | --- | --- |
| SSH 私钥 / known_hosts | 优先 ssh-agent 签名代理；必须落临时文件时 0600 + 会话结束销毁 + 快照/检查点/诊断包强制排除（`20:1006`） | 主机密钥变化阻断 + 告警且不改写；非法策略值启动拒绝（`20:921`） | 审计只记引用 ID；命令内容 DLP 脱敏（`20:992/999`） | ✅ 闭环（新增 3 配置项） |
| A2A 调用方凭据（API Key / OAuth / mTLS） | 只存摘要或 `credential_ref`，禁止明文落库与日志（`24:818/924`） | 轮换 = 新凭据生效 + 旧凭据宽限（默认 0）后吊销；吊销逐请求校验（缓存 ≤ 60s）；离职经 25 扇出级联（`24:818` / `25:530`） | 调用方密钥/委托令牌/审批凭据一律脱敏（`24:928`） | ✅ 闭环（新增 3 配置项） |
| MCP OAuth 授权与服务器凭据 | 引用式（卷 09/18 持有），本 7 份文件不复制实现 | 纳入 25 离职吊销扇出第 ⑥ 项（`25:530`） | 由 09/18 域负责（交叉引用已建立） | ✅ 扇出已挂（实现期对表） |
| 桌面端令牌 / `secrets.put` | 只存系统钥匙串；渲染进程永不接触明文；`ref` 限 `ui:` 命名空间；**禁止新增 `secrets.get`**（接口面断言）（`23:741/752`） | 随会话退出失效；钥匙串不可用 → 会话内内存 + 明确警示（`23:873` ④） | 日志/诊断包字段白名单脱敏（`23:879`） | ✅ 闭环 |
| 发送/更新/许可签名私钥 | HSM / KMS 私钥不可导出（`27 §5.2` 接口无 `reveal()`；28 客户端仅持公钥） | 签名服务不可用即停发（禁降级为无签名，`28` §3 回退）；降级豁免票据需签名（`28:231`） | 更新器日志只记摘要前缀（`28:954`） | ✅ 闭环 |
| 遥测 / 转储 / 诊断包中的秘密 | 类型层白名单构造器 + A1 加密封存（`28:274/812`） | 匿名 ID 可轮换；DEK 销毁即删 | 上传前哨兵值/密钥指纹扫描，命中阻断（`28:278`） | ✅ 闭环（本轮补洞） |

## 六、拒绝优先与最小权限默认值核对（deny-by-default / least-privilege）

| # | 面 | 开关与默认值 | 方向 | 落点 |
| --- | --- | --- | --- | --- |
| 1 | 远端工作区网络出口 | SSH/容器工作区默认受限出站（企业白名单方可开） | deny-by-default | `20:993`（§⑩.6） |
| 2 | 远端端点地址 | `remote.endpoint-policy=deny-private`（拒回环/链路本地/私网/元数据） | 默认拒内网探测 | `20:922` |
| 3 | SSH 主机密钥 | `host-key-policy=strict`；`accept-new`/`no` 启动校验拒绝 | fail-closed | `20:921` |
| 4 | SSH agent 转发 | `allow-agent-forward=false`（开启后仍限目标主机与密钥集） | least privilege | `20:923` |
| 5 | 仓库钩子 / 预检 | `repo-hooks=never` + `preflight-approval=true` | 仓库内容不是执行面 | `21:758-759` |
| 6 | A2A 服务面 | `enabled=false`（本地形态）/ `allowRemoteBind=false` | deny-by-default | `24:836-838` |
| 7 | A2A 审批自批 | `allowSelfApproval=false`；`AGENT_UNTRUSTED` 恒 false | 不可自授权 | `24:847` |
| 8 | 回调目标 | `egress.callback-policy=deny-private` + 以校验 IP 建连 + 不跟随重定向 | 抗 SSRF / DNS 重绑定 | `24:848` |
| 9 | 遥测 | 三级默认全关（opt-in）；`PRIVACY_STRICT` 不可覆盖；`DESKTOP_TELEMETRY_CONSENT=OFF` | 数据最小化 | `28:272` / `28:884` / `23:813` |
| 10 | 更新应用 | 四道关任一失败即拒；降级豁免需签名票据 | fail-closed | `28:230-231` |
| 11 | 许可 | **显式 fail-open**：宽限 30 天 + 过期只读不锁死 | 有意例外（已记录理由：许可故障不得阻断既有工作） | `28:950` |
| 12 | 分享链接审批 | 默认 `READ_ONLY`；`READ_ONLY_APPROVE` 需显式开启 + R3+ 不得由跟随端批准 | least privilege | `23:884` |
| 13 | 桌面 IPC | 清单外通道不可达；`fs.readReference` 需票据；无 `secrets.get`；`secrets.put` 限 `ui:` | least privilege | `23:748-753` |
| 14 | 执行链 | 权限 → 沙箱 → 能力 → 执行 → 审计，任一步拒绝即终态 | 顺序本身是控制 | `20:1056` |

> 说明：20/24/28 的「企业可开」项全部要求**显式配置 + 白名单**（无「缺省放开」路径）；唯一有意 fail-open 的是许可状态机（第 11 行），已在 28 §10.3 明示方向与理由，不作为缺陷。

## 七、跨文件链路与顺序一致性

| 链路 | 权威单点 | 消费方与引用 | 状态 |
| --- | --- | --- | --- |
| 执行链（权限 → 沙箱 → 能力 → 执行 → 审计） | `20:1056`（R04 单点声明） | 21（Git 通道同链）/ 23（`kernel.call` 同链）/ 24（外部任务同链） | ✅ 一致（原稿各自表述，本轮收敛） |
| 硬拦截 / 软风险 / 审批次序 | `27 §1.3`（`deny → 硬拦截 → 软风险 → 审批`） | 06 决策链、20 执行链、24 外部审批 | ✅ 一致（24 明确「不形成第二套审批语义」） |
| 离职吊销扇出 | `25 §6.2`（七类入口 + 5 分钟 SLA） | 24 §9.5（A2A 凭据即时吊销）、23 §10.5（分享链接即时撤销）、27 REQ-SEC-8（5 分钟口径） | ✅ 新建单点（原三方各自为政） |
| 更新通道语义与防降级 | `28 §4.2`（四道关 + 裁决优先级） | 23 §6.5 / REQ-DSK-21 / §9.4（通道命名统一为 stable/beta/nightly） | ✅ 已收敛（CO-1） |
| 工作区/远端边界 B5 | `27 §4.2`（三阶段矩阵，本轮加固） | 20（主机密钥启动检查）、21（执行面加固进 CI 与运行期探针） | ✅ 双向交叉引用 |
| 遥测出口边界 B10 | `27 §4.2` B10 | 28 §4.3（egress 清单与 27 `oc_sec_egress_manifest` 同源治理） | ✅ 一致 |

## 八、复核命令（结论可独立复现）

```bash
# Mermaid 全量真实解析（本 7 份，期望 total=64 fail=0；若用 docs/harness/impl/2[0-9]-*.md 通配则为 10 份 total=90）
node .research-cache/mmd-check/check.mjs docs/harness/impl/2[0-9]-*.md
# Java 代码块括号平衡（期望 0 UNBALANCED）
node /tmp/javabalance.mjs docs/harness/impl/20-workspace-provider-impl.md docs/harness/impl/21-git-worktree-impl.md docs/harness/impl/23-desktop-electron-vue-impl.md docs/harness/impl/24-a2a-gateway-impl.md docs/harness/impl/25-enterprise-iam-audit-impl.md docs/harness/impl/27-security-runtime-impl.md docs/harness/impl/28-distribution-telemetry-impl.md
# 本轮新增控制检索（应全部命中且带「R04」锚点）
grep -rn "REQ-WS-21\|REQ-GIT-20\|I-WS-9\|I-GIT-10" docs/harness/impl/2[0-9]-*.md
grep -rn "host-key-policy\|repo-hooks\|callback-policy\|allowSelfApproval\|revocationCacheTtl" docs/harness/impl/2[0-9]-*.md
grep -rn "R04" docs/harness/impl/2[0-9]-*.md | wc -l
# 通道命名一致性（期望：仅迁移期说明处出现 latest）
grep -rn "latest" docs/harness/impl/2[3-8]-*.md | grep -i "通道\|channel"
```

## 九、残余风险（按优先级排序）

| # | 风险 | 现状与理由 | 建议处置（下一轮/实现期） |
| --- | --- | --- | --- |
| R1 | **官方签名密钥失陷下的「伪安全补丁」**：`security=true` 标记在签名清单内，依 §4.2 A1 可无视企业锁定与延后窗口直接升级 | 属信任根失陷场景，本文件未增设第二控制（诚实登记） | 企业锁定开启时要求「补丁必须来自企业私仓验签根」或对 `security=true` 升级加双人复核；下轮把「信任根失陷」列为 B10 的威胁行 |
| R2 | **平台外 Git 执行不在加固范围**：用户手工 `git` 命令、IDE 内建 Git、CI 侧执行不经过本产品通道 | 加固清单只约束本产品执行通道（G-1…G-7 的前提） | 在 21 §10.7 与 27 B5 加一句边界声明（「受控范围 = 本产品执行通道」），并在用户文档提示 |
| R3 | **崩溃转储一次性链接无调用方认证**：预签名 URL 若泄漏，第三方可在过期前下载转储 | 服务端过期自动删除 + DEK 加密封存兜底；本轮未改 | 上传通道改「一次性 token 绑定上传者设备指纹 + 单次消费」，并加 IP/UA 复核 |
| R4 | **A2A 联邦 Card 信任根未单列**：`oc_federation_node` 有 `card_signature`/`approved_by`，但信任根加载、轮换与吊销未成章 | 依赖管理面人工审核（`/federation/nodes approve`） | 下轮把「联邦信任根与轮换」对齐 27 B9/B10 的信任根管理写法，单列一小节 |
| R5 | **`READ_ONLY_APPROVE` 分享链接的风险阈值边界未量化**：本轮已加「R3+ 不得由跟随端批准」，但 R2/R3 阈值仍需实现期评审 | 阈值属产品与安全联合裁决项 | 实现期在 06/23 之间对表风险等级语义（R0–R5）并补用例 |
| R6 | **SSH agent 约束扩展的跨平台可用性**：`SSH_AGENT_CONSTRAIN` 类机制在 Windows OpenSSH / ssh-agent 上行为差异 | 默认关闭转发（安全方向已保守） | 实现期补三平台验证矩阵；不可用平台直接禁用转发能力（保持 fail-closed） |

> 交付说明：本轮改动仅落在上述 7 份 impl 文件与本文；未删除任何小节 / 决策编号 / REQ；新增控制全部为「加严」方向（默认值取拒绝或最小权限），并同步写入各文件的故障注入矩阵与 DoD 勾选项，便于终局审计按「R04」锚点批量核验。
