---
trigger: always_on
---

# 异常处理规范

适用于 Java 后端服务所有 Java 源代码。约束异常类型选择、抛出位置、事务边界、捕获与日志、对外返回。

## 1. 异常类型选择

| 场景 | 使用的异常 | 说明 |
| --- | --- | --- |
| 业务规则校验失败、状态非法、权限不足、资源不存在 | 项目统一业务异常（如 `BusinessException`） | 由全局异常处理器统一捕获，转换为标准错误响应 |
| 参数校验失败 | Jakarta Validation 触发的校验异常 | 由 `@Valid` + 全局处理器处理，禁止在 Service 中手写 null 判断后抛 `IllegalArgumentException` |
| 认证授权异常 | 安全框架抛出的专用异常 | 由全局异常处理器转换为统一返回 |
| 系统级不可恢复异常 | 原始 `RuntimeException` | 不在业务代码捕获，向上抛出由全局处理器兜底 |

**禁止**：在业务代码中裸抛 `RuntimeException`、`IllegalArgumentException`、`NullPointerException` 表达业务失败；**禁止**自定义与项目异常体系平行的私有业务异常类。

## 2. 业务异常抛出规范

- 业务异常必须使用项目统一业务异常，文案为中文，描述清楚失败原因与可选恢复动作。
- 状态流转失败文案需体现当前状态与期望状态的差异。
- 资源不存在异常文案需包含业务编号便于定位。
- 禁止抛出仅含错误码无文案的异常。

示例：

```java
// 正确
throw new BusinessException("订单状态已变更，当前为「" + currentStatus.getDesc() + "」，无法提交");
throw new BusinessException("订单记录不存在，orderNo=" + orderNo);

// 错误
throw new RuntimeException("提交失败");
throw new BusinessException("");  // 空文案
```

## 3. 事务边界与异常回滚（强制）

- 所有写操作（新增、修改、删除、状态流转）Service 方法必须加 `@Transactional(rollbackFor = Exception.class)`。
  - 纯查询方法禁止加 `@Transactional`。
- 事务方法内调用外部 API（HTTP、第三方 SDK）必须移出事务边界，使用 `AFTER_COMMIT` 事件异步触发，避免长事务占连接池。
- 事务方法内禁止 `try-catch` 吞掉异常导致回滚失效；如需捕获，必须重新抛出业务异常或手动 `TransactionAspectSupport.currentTransactionStatus().setRollbackOnly()`。

示例：

```java
// 正确：写操作加事务
@Transactional(rollbackFor = Exception.class)
public void approveDelivery(String deliveryNo) {
}

// 正确：外部调用移出事务
@Transactional(rollbackFor = Exception.class)
public void reviewDelivery(String deliveryNo) {
    // ... 数据库写入 ...
    eventPublisher.publishEvent(new DeliveryApprovedEvent(delivery.getId()));
}
// 事件消费异步调用外部 webhook，不在事务内
```

## 4. 异常捕获与日志

- 业务异常捕获后使用 `log.warn` 记录，附带业务编号与异常文案。
- 系统异常捕获后使用 `log.error` 记录，必须传入异常对象保留堆栈。
- 禁止 `catch (Exception e) { }` 空捕获；禁止 `catch (Exception e) { log.error(e.getMessage()); }` 丢失堆栈。
- 定时任务、事件消费、异步任务的异常必须在本方法内捕获并记录，禁止向上抛出导致调度器中断。
- 仅在以下场景捕获并转换异常：外部 SDK 异常转业务异常、HTTP 客户端异常转业务异常。

示例：

```java
// 正确：捕获外部调用异常并转换
try {
    FaceIdResult result = faceIdClient.detect(request);
} catch (SdkClientException e) {
    log.error("人脸认证服务调用失败，taskId={}", taskId, e);
    throw new BusinessException("认证服务暂不可用，请稍后重试");
}

// 正确：定时任务兜底
try {
    webhookService.retryFailed();
} catch (Exception e) {
    log.error("Webhook 重试任务异常", e);
}

// 错误：吞异常
try {
    doSomething();
} catch (Exception e) {
    // 静默
}
```

## 5. 全局异常处理

- 所有异常由全局异常处理器统一处理，业务代码禁止自行 `try-catch` 后包装错误响应返回。
- 业务异常返回统一错误码枚举 + 中文文案。
- 参数校验异常合并所有字段校验错误后返回。
- 认证授权异常转换为统一登录/权限错误返回。
- 未捕获异常兜底返回系统错误码，并记录 ERROR 日志含完整堆栈。

## 6. 乐观锁与状态校验异常

- 状态流转使用条件更新（如 `LambdaUpdateWrapper.eq(status, oldStatus)`）限制当前状态，更新行数不为 1 时抛业务异常。
- 异常文案需提示用户刷新重试，体现并发冲突语义。
- **禁止**移除状态条件，禁止将更新行数判断改为 `>= 1`。

```java
int updated = baseMapper.update(null, new LambdaUpdateWrapper<Order>()
        .eq(Order::getId, orderId)
        .eq(Order::getStatus, OrderStatusEnum.PAID.getCode())
        .set(Order::getStatus, OrderStatusEnum.SHIPPING.getCode()));
if (updated != 1) {
    log.warn("订单状态流转失败，orderId={}, 期望状态=PAID 但已被并发变更", orderId);
    throw new BusinessException("订单状态已变更，请刷新后重试");
}
```

## 7. 资源必查校验

- 必查方法使用 `requireXxx` 命名，不存在时直接抛业务异常，文案包含查询条件。
- 跨用户资源访问必须校验归属，归属不符抛业务异常（如「无权访问该资源」），禁止返回 null 或空对象。

```java
public Order requireOrderByOwner(String orderNo, Long ownerUserId) {
    Order order = baseMapper.selectOne(new LambdaQueryWrapper<Order>()
            .eq(Order::getOrderNo, orderNo));
    if (order == null) {
        throw new BusinessException("订单不存在，orderNo=" + orderNo);
    }
    if (!Objects.equals(order.getOwnerUserId(), ownerUserId)) {
        throw new BusinessException("无权操作该订单");
    }
    return order;
}
```

## 8. 反例（禁止）

- `try-catch` 后吞异常或仅打印 `e.getMessage()`。
- 在事务方法内直接调用外部 HTTP/SDK 导致长事务。
- 业务代码抛 `RuntimeException` 或 `NullPointerException`。
- 状态更新不带条件，更新行数不校验。
- Controller 中 `try-catch` 后包装错误响应返回（应由全局处理器统一处理）。
- 必查方法返回 null 让调用方判空（应直接抛业务异常）。
