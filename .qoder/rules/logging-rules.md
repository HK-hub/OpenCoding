---
trigger: always_on
---

# 日志规范

适用于 Java 后端服务所有 Java 源代码。约束日志的接入方式、输出内容、级别、语言与脱敏要求。

## 1. 日志接入方式

- 类级别使用 Lombok `@Slf4j` 注解获取 `log` 对象，禁止手写 `LoggerFactory.getLogger(...)`。
- 禁止使用 `System.out.println`、`e.printStackTrace()` 替代日志。
- 日志框架统一为 SLF4J + Logback。

```java
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {
}
```

## 2. 核心触发点必须打印入参与返回值（强制）

以下入口方法必须使用中文日志打印入参与返回值，便于链路追踪与排障：

- 所有 Controller 端点方法（`@GetMapping`/`@PostMapping`/...）。
- 所有 Service 暴露的写操作、状态流转方法。
- 所有 `@Scheduled` 定时任务入口。
- 所有事务事件监听、应用事件监听等事件消费方法。
- 所有 MQ/Webhook 回调、外部 API 调用入口。

入参日志在方法起始处使用 `log.info` 输出；返回值日志在方法返回前输出。日志文案为中文，描述业务动作。

示例：

```java
public OrderBriefVO submit(String orderNo) {
    log.info("提交订单开始，orderNo={}", orderNo);

    // ... 业务逻辑 ...

    log.info("提交订单完成，orderNo={}, 新状态={}", orderNo, OrderStatusEnum.PAID.getDesc());
    return briefVO;
}
```

## 3. 核心业务步骤必须打点（强制）

方法内部每个关键业务步骤必须使用 `log.info` 或 `log.debug` 记录，包括：

- 状态流转前后（旧状态 → 新状态）。
- 乐观锁更新结果（更新行数、是否成功）。
- 幂等校验命中、配额扣减、名额释放。
- 外部 API 调用前（请求参数）与调用后（响应码、耗时）。
- 事务提交后异步事件发布。
- 跨表写入、补偿动作、回滚分支。

示例：

```java
// 状态流转：从已支付进入发货中
int updated = baseMapper.update(null, new LambdaUpdateWrapper<Order>()
        .eq(Order::getId, orderId)
        .eq(Order::getStatus, OrderStatusEnum.PAID.getCode())
        .set(Order::getStatus, OrderStatusEnum.SHIPPING.getCode()));
log.info("订单状态流转，orderId={}, PAID -> SHIPPING, 更新行数={}", orderId, updated);
if (updated != 1) {
    log.warn("订单状态流转失败，orderId={}, 当前状态已被其他流程变更", orderId);
    throw new BusinessException("订单状态已变更，请刷新后重试");
}
```

## 4. 日志级别使用

| 级别 | 适用场景 |
| --- | --- |
| `ERROR` | 系统异常、不可恢复错误、外部依赖故障影响主流程（如数据库连接失败、第三方接口连续失败）。需附带异常堆栈。 |
| `WARN` | 业务异常、可恢复的降级、幂等命中、重试、配额不足、状态校验失败。 |
| `INFO` | 核心业务动作入参/返回值、状态流转、关键步骤打点。生产可见，需控制数量。 |
| `DEBUG` | 详细中间数据、循环内明细、查询结果集，生产默认关闭。 |
| `TRACE` | 极细粒度调试，仅临时排查使用，禁止提交。 |

## 5. 日志格式要求

- 必须使用占位符 `{}`，禁止字符串拼接（性能差且无法脱敏）。
  - 正确：`log.info("订单提交完成，orderNo={}", orderNo);`
  - 错误：`log.info("订单提交完成，orderNo=" + orderNo);`
- 异常日志必须传入 `Throwable` 对象，由框架打印堆栈，禁止 `e.getMessage()` 字符串拼接。
  - 正确：`log.error("文件上传失败，fileUuid={}", fileUuid, e);`
  - 错误：`log.error("文件上传失败：" + e.getMessage());`
- 日志文案为中文，描述业务含义，避免英文 + 变量名的代码式日志。
- 单条日志信息量充足，便于无源码情况下定位问题（包含业务编号、状态、关键参数）。

## 6. 敏感信息脱敏（强制）

以下信息禁止明文输出到日志：

- 用户密码、密钥、Token、签名（`signature`、`secretKey`、`accessToken`）。
- 完整身份证号、银行卡号、支付凭证。
- 手机号需脱敏（保留前 3 后 4，中间用 `****` 替换）。
- 验证码内容禁止打印明文，仅可打印「已发送验证码」。
- 文件流内容、二进制数据禁止打印。

如有脱敏需求，使用项目统一的脱敏工具方法处理后再输出。

## 7. 定时任务日志要求

`@Scheduled` 任务必须包含：

- 任务开始日志（任务名、本次触发时间）。
- 任务结束日志（任务名、处理数量、耗时）。
- 异常日志（任务名、失败原因、堆栈），且异常不得向上抛出导致调度中断。
- 长任务需按批次打点，避免单条日志过长或长时间无输出。

示例：

```java
@Scheduled(cron = "${app.scheduler.webhook-retry.cron}")
public void retryFailedWebhooks() {
    log.info("Webhook 重试任务开始");
    long start = System.currentTimeMillis();
    try {
        int count = webhookService.retryFailed();
        log.info("Webhook 重试任务完成，处理数量={}, 耗时={}ms", count, System.currentTimeMillis() - start);
    } catch (Exception e) {
        log.error("Webhook 重试任务异常", e);
    }
}
```

## 8. 事件消费与异步任务日志要求

- 事务提交后事件、异步方法必须记录事件入参与处理结果。
- 异步异常必须 `log.error` 记录堆栈，禁止静默吞掉。
- 长耗时操作记录分段耗时，便于定位性能瓶颈。

## 9. 反例（禁止）

- Controller/Service 方法内无任何日志。
- 使用 `log.info` 输出循环内明细导致日志洪泛。
- 日志文案为英文代码式（`log.info("update order, status={}", status);`）。
- 打印完整请求体或响应体含敏感字段。
- 异常被 `catch` 后只 `log.error(e.getMessage())` 丢失堆栈。
- 日志占位符数量与参数数量不匹配。
