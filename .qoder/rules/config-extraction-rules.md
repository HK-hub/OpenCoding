---
trigger: always_on
---

# 配置抽取规范

适用于 Java 后端服务所有 Java 源代码与配置文件。约束配置与常量的边界、Properties 类组织、环境变量、敏感信息处理。

## 1. 配置与常量的边界（强制判断原则）

新增任何「可变值」时，先判断是否影响核心业务逻辑，再决定抽取方式：

| 判断条件 | 抽取方式 | 示例 |
| --- | --- | --- |
| 影响核心业务逻辑、可能因环境/部署变化、需要运维调整 | **Properties 配置**（`@ConfigurationProperties`） | 第三方 API 地址、密钥、超时、重试次数、分页大小、阈值 |
| 不影响业务逻辑、代码内固定、不会因环境变化 | **常量类**（`XxxConstants`） | 枚举 code、Redis Key 前缀、字段名、固定算法名 |
| 敏感信息（密码、密钥、Token） | **环境变量 + Properties**，禁止写死 | 数据库密码、Redis 密码、第三方 secretKey |

**核心判断**：如果该值变更需要重新发版，则抽常量；如果该值变更只需改配置文件/环境变量即可生效，则抽 Properties。

## 2. Properties 配置类规范

### 2.1 类组织

- 配置类放置在项目统一的 `properties`/`config` 包，第三方服务按服务维度独立建类。
- 使用 `@ConfigurationProperties(prefix = "...")` 绑定，前缀以项目统一命名空间开头，禁止散落多处。
- 通过 `@ConfigurationPropertiesScan` 或 `@EnableConfigurationProperties` 集中激活；纯数据配置类不声明 `@Component`（避免污染所属分层的依赖方向）。
- 字段使用 Lombok `@Getter`/`@Setter`，不加 Jackson/Schema 注解。

### 2.2 字段规范

- 每个字段必须有 JavaDoc 说明用途、默认值、是否必填、影响范围。
- 布尔字段命名统一（要么全部以 `is` 开头，要么全部不带，项目内保持一致）。
- 集合字段使用 `List`/`Map`，默认值在 yml 中配置。
- 必填字段在 `@PostConstruct` 中校验，缺失时抛异常导致启动失败（Fail-Fast）。

```java
/**
 * 对象存储配置。
 * 影响文件上传/下载核心业务，部署时需通过环境变量覆盖。
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "app.file.oss")
public class OssFileProperties {

    /** 服务 endpoint（必填） */
    private String endpoint;

    /** 访问密钥（必填，敏感信息，通过环境变量注入） */
    private String accessKey;

    /** 秘密密钥（必填，敏感信息，通过环境变量注入） */
    private String secretKey;

    /** 存储桶名称（必填） */
    private String bucket;

    /** 公共访问 URL 前缀（可选，用于生成可访问链接） */
    private String publicUrlPrefix;

    /** 是否使用 path-style 访问（默认 false） */
    private boolean pathStyleAccess;
}
```

### 2.3 yml 配置规范

- 配置项在 `application.yml`（或 profile 对应 yml）中按统一前缀分组组织。
- 默认值写明，敏感字段默认留空由环境变量覆盖。
- 配置项分组，相关配置放一起并加注释。

```yaml
# 对象存储配置
app:
  file:
    oss:
      endpoint: ${OSS_ENDPOINT:}
      access-key: ${OSS_ACCESS_KEY:}
      secret-key: ${OSS_SECRET_KEY:}
      bucket: ${OSS_BUCKET:}
      public-url-prefix: ${OSS_PUBLIC_URL_PREFIX:}
      path-style-access: ${OSS_PATH_STYLE_ACCESS:false}
```

## 3. 环境变量规范

### 3.1 命名与覆盖

- 环境变量名全大写下划线分隔（`UPPER_SNAKE_CASE`），与 Properties 字段松弛绑定。
- yml 中通过 `${ENV_VAR:default}` 引用，必须提供默认值或留空显式声明。
- 部署差异与敏感项一律通过环境变量注入；维护一份可提交的模板文件（如 `.env.example`）同步全部变量清单，实际配置文件（如 `.env`）禁止入库。
- 新增第三方服务配置时，环境变量以服务名前缀命名（如 `OSS_*`、`SMS_*`）。

### 3.2 已有环境变量（不可破坏）

- 已存在的环境变量名是部署契约，不得重命名或改变语义；确需变更时提供兼容过渡。
- 变量清单以模板文件为唯一权威，新增变量必须同步更新模板。

## 4. 敏感信息处理（强制）

- 密码、密钥、Token、连接串**禁止**硬编码在源代码或 yml 默认值中。
- 敏感字段必须通过环境变量注入，yml 中默认值为空。
- 启动时校验必填敏感字段，缺失则启动失败并明确报错。
- 日志输出敏感字段时必须脱敏（见 `logging-rules.md`）。
- Git 提交禁止包含实际部署配置文件，仅保留模板文件。

## 5. 第三方服务配置集中化

- 每个第三方服务独立的 Properties 类。
- 服务相关的 endpoint、appKey、appSecret、超时、重试集中在一个 Properties 类，禁止散落多处。

## 6. 业务阈值配置化

以下影响业务逻辑的阈值必须配置化，禁止写死：

- 分页大小上限（防止前端传超大 `size` 拖垮数据库）。
- 验证码长度、有效期、发送间隔、每日上限。
- 文件上传大小上限、允许的扩展名白名单、MIME 白名单。
- Webhook/外部调用的重试次数、重试间隔、超时。
- 认证 Token 有效期、分布式锁等待时间与租约时间。
- 任务队列并发度、批处理批大小。
- 定时任务 cron 表达式。

```yaml
app:
  sms:
    code-length: 6
    expire-seconds: 300
    send-interval-seconds: 60
    daily-limit: 10
  file:
    max-size: 104857600  # 100MB
    allowed-extensions: jpg,jpeg,png,pdf,doc,docx,xls,xlsx
  webhook:
    retry-count: 5
    retry-interval-seconds: 60
    timeout-seconds: 10
```

## 7. 配置变更与版本管理

- 新增配置项必须在环境变量模板文件同步添加。
- 删除配置项需评估向下兼容，旧配置失效需在启动日志告警。
- 配置项变更需在 PR 描述中说明影响范围与回滚方式。
- 数据库 schema 变更与配置变更分离，配置变更不依赖数据库迁移脚本。

## 8. 不应配置化的内容

以下内容**禁止**配置化，必须为常量或代码逻辑：

- 业务状态机定义（状态枚举、流转规则）。
- 业务唯一编码规则（编号前缀、长度）。
- 框架固定行为（如 HTTP header 约定名、框架内置约定）。
- 算法常量（哈希算法名、签名算法名、编码名）。
- 枚举 code 值。

## 9. 反例（禁止）

- 第三方 appSecret 写死在 yml 默认值或 Java 代码中。
- 分页大小 `100` 写死在 Service 方法内。
- 超时时间 `3000` 毫秒直接出现在 HTTP 调用处。
- 文件扩展名白名单写在 `if` 判断的字符串字面量中。
- 多环境差异通过注释切换 yml（应使用 profile + 环境变量）。
- 配置类字段无注释，运维不知道该字段影响什么。
- 必填配置缺失时静默使用 null 导致运行时 NPE（应 Fail-Fast 启动失败）。
