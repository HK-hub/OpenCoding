---
trigger: always_on
---

# 注释规范

适用于 Java 后端服务全部源代码（`controller`、`service`、`service.impl`、`mapper`、`enums`、`convert`、`scheduler`、`config`、`domain` 等包）。新增代码与重构代码必须严格遵守；存量代码逐步收敛。

## 1. 类级别 JavaDoc（强制）

所有 `class`、`interface`、`enum`、`record` 必须有 JavaDoc，包含以下要素：

- 一句话说明类的核心职责（做什么、属于哪个业务域）。
- 关键协作依赖（可选，当类职责不明显时补充）。
- 不可实例化的工具类/常量类需声明私有构造方法并注释。

示例：

```java
/**
 * 订单领域服务实现。
 * 负责订单创建、状态流转、归属校验等核心业务编排，事务边界在本层控制。
 */
@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {
}
```

```java
/**
 * Redis Key 统一管理。
 * 所有业务模块的 Redis Key 必须通过本类静态方法生成，禁止在业务代码中拼接字符串。
 */
public final class RedisKeys {

    private RedisKeys() {
    }
}
```

IDE 模板生成的头注释（`@author`/`@version`/`@since`）可以保留，但不能替代职责描述。

## 2. 方法级别 JavaDoc（强制）

所有 `public`、`protected` 方法（含接口方法、Controller 端点、Service 实现、Mapper 自定义方法）必须有 JavaDoc，包含：

- 方法功能描述（一句话说清业务目的，而非实现细节）。
- `@param` 每个参数：业务含义 + 取值约束（必填/可空/枚举范围）。
- `@return` 返回值业务含义；可能为空时说明；集合为空时返回空集合还是 null。
- `@throws` 业务异常场景及触发条件。

示例：

```java
/**
 * 提交订单（已创建 → 已支付）。
 * 校验当前用户为下单方、订单处于已创建状态后，乐观锁更新状态并发布事件。
 *
 * @param orderNo 订单业务编号（必填）
 * @return 提交后的订单简要信息
 * @throws BusinessException 订单不存在、状态非法、当前用户无权操作时抛出
 */
public OrderBriefVO submit(String orderNo) {
}
```

私有方法如逻辑非自明（包含状态判断、阈值、业务规则）也需 JavaDoc；纯 getter/setter、Lombok 生成方法可省略。

## 3. 核心业务逻辑行内注释（强制）

以下场景必须有中文行内注释，解释「为什么这样做」而非「做了什么」：

- 状态流转条件判断（如 `CREATED → PAID` 不可逆）。
- 乐观锁更新后的行数校验（`update != 1` 抛异常）。
- 业务规则校验（金额阈值、角色归属、配额限制、幂等判断）。
- 跨表事务、补偿动作、事件发布时机（`AFTER_COMMIT` + `@Async`）。
- 外部 API 调用、重试、降级逻辑。
- 不易理解的算法、位运算、SQL 拼接、JSONB 处理。

禁止：对 `if (x == null)`、`return list;`、变量声明等自明语句添加无意义注释。

示例：

```java
// 已支付订单禁止回退为已创建（硬约束，避免资金对账错乱）
if (OrderStatusEnum.PAID.getCode().equals(current.getStatus())) {
    throw new BusinessException("已支付订单不可回退为已创建");
}

// 乐观锁更新：仅当当前状态为 PAID 时才允许进入发货中，更新行数必须为 1
int updated = baseMapper.update(null, new LambdaUpdateWrapper<Order>()
        .eq(Order::getId, order.getId())
        .eq(Order::getStatus, OrderStatusEnum.PAID.getCode())
        .set(Order::getStatus, OrderStatusEnum.SHIPPING.getCode()));
if (updated != 1) {
    throw new BusinessException("订单状态已变更，请刷新后重试");
}
```

## 4. 方法内步骤分段与空行（强制）

方法体内不同业务步骤之间必须用空行分隔，并在每个步骤起始处加简短中文注释标识阶段：

- 参数校验 / 权限校验
- 数据加载 / 必查校验
- 业务规则校验
- 状态流转 / 数据写入
- 事件发布 / 缓存清理
- 结果组装与返回

示例：

```java
public OrderVO create(CreateOrderDTO dto) {

    // 1. 参数与权限校验
    User currentUser = authService.getCurrentUser();

    // 2. 加载资源并校验可操作
    Product product = productQueryService.requireOnSale(dto.getProductNo());
    validateCanCreate(product);

    // 3. 幂等校验：同一用户对同一资源短时间内只能操作一次
    checkCreateIdempotent(product.getId(), currentUser.getId());

    // 4. 写入业务数据，乐观锁扣减配额
    Order order = saveOrder(product, dto, currentUser);

    // 5. 发布领域事件（事务提交后异步消费）
    eventPublisher.publishEvent(new OrderCreatedEvent(order.getId()));

    // 6. 组装返回
    return orderConverter.toVO(order);
}
```

## 5. 字段与常量注释

- 常量类、枚举项、Properties 字段必须有 JavaDoc 说明用途与取值范围。
- 实体字段与数据库列含义不一致时，在实体字段上加注释说明映射关系。
- 配置项对应的 `@ConfigurationProperties` 类，每个字段必须注释默认值、是否必填、影响范围。

## 6. 注释语言与风格

- 注释统一使用中文；专有名词（如 `MapStruct`、`JSONB`、`Redisson`）可保留英文。
- 注释紧贴被注释代码上方，与代码同缩进；行尾注释与代码之间至少留 1 个空格。
- 禁止使用 `// TODO`、`// FIXME` 残留在提交代码中，必须改为具体任务或完成处理。

## 7. 反例（禁止）

- 类/方法只有 `@author`、`@date` 而无功能描述。
- 行内注释复述代码字面含义（如 `// 判断是否为空` 配 `if (x == null)`）。
- 整段方法无任何注释且包含状态判断、事务、外部调用。
- 注释与代码不一致（修改代码后未同步注释）。
