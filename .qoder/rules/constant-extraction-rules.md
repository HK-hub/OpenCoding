---
trigger: always_on
---

# 常量抽取规范

适用于 Java 后端服务所有 Java 源代码。约束魔法字符串/数字的消除、常量类组织、字段名引用方式。

## 1. 禁止魔法字符串与魔法数字（强制）

以下场景禁止直接出现字符串/数字字面量，必须抽取为常量或使用方法引用：

| 场景 | 抽取方式 |
| --- | --- |
| 用于判断的字符串（状态码、类型码、场景标识） | 枚举 `code` 或常量类 `public static final String` |
| Redis Key | `RedisKeys` 静态方法 |
| 返回值字段名 / Map 的 key | 常量类静态字段 |
| 实体类字段名（用于查询、更新、排序） | `Entity::getField` 方法引用 |
| 查询 SQL 列名（LambdaQueryWrapper） | `Entity::getField`，禁止手写字段字符串 |
| HTTP Header、Cookie、RequestParam 名 | 常量类静态字段 |
| 错误码、业务码 | 统一错误码枚举 |
| 业务阈值、超时、重试次数 | 常量类静态字段或 Properties 配置 |
| 文件扩展名、MIME 类型白名单 | 常量类静态字段集合 |

### 反例与正例

```java
// 错误：魔法字符串
if ("PAID".equals(order.getStatus())) { }
LambdaQueryWrapper<Order> wrapper = new LambdaQueryWrapper<Order>()
        .eq("status", "PAID");
redisTemplate.opsForValue().set("app:order:lock:" + orderId, "1");
return Collections.singletonMap("orderNo", order.getOrderNo());

// 正确：枚举与常量
if (OrderStatusEnum.PAID.getCode().equals(order.getStatus())) { }
LambdaQueryWrapper<Order> wrapper = new LambdaQueryWrapper<Order>()
        .eq(Order::getStatus, OrderStatusEnum.PAID.getCode());
redisTemplate.opsForValue().set(RedisKeys.lock(RedisKeys.Module.ORDER, "submit", orderId), "1");
```

## 2. 枚举优先于常量（强制）

状态、类型、场景等具有「编码 + 描述」含义且取值可枚举的，必须使用枚举，遵循：

- 枚举统一包含 `code` 与 `desc` 字段。
- 提供 `of(String code)` 静态工厂方法，非法值抛业务异常。
- 数据库存储枚举 `code`，不存储 `desc`。
- 前端交互传递 `code`，不传递 `desc`。

```java
@Getter
@RequiredArgsConstructor
public enum OrderStatusEnum {
    CREATED("CREATED", "已创建"),
    PAID("PAID", "已支付"),
    SHIPPING("SHIPPING", "发货中"),
    COMPLETED("COMPLETED", "已完成");

    private final String code;
    private final String desc;

    public static OrderStatusEnum of(String code) {
        for (OrderStatusEnum e : values()) {
            if (e.code.equals(code)) {
                return e;
            }
        }
        throw new BusinessException("未知订单状态：" + code);
    }
}
```

## 3. 常量类组织规范

### 3.1 常量类放置与命名

- 跨模块共享常量：公共模块的统一 `constant` 包。
- 模块内常量：本模块 `constant` 子包。
- 常量类命名：`XxxConstants`（业务常量）、`RedisKeys`（特殊场景）、`XxxEnum`（枚举）。
- 常量类必须 `final`，构造方法 `private`，禁止实例化。

### 3.2 常量类字段规范

- 所有常量 `public static final`，命名全大写下划线分隔（`UPPER_SNAKE_CASE`）。
- 每个常量必须有 JavaDoc 说明用途、取值含义。
- 相关常量分组，组间空行分隔。

```java
/**
 * 短信场景常量。
 */
public final class SmsConstants {

    private SmsConstants() {
    }

    /** 注册场景 */
    public static final String SCENARIO_REGISTER = "REGISTER";

    /** 重置密码场景 */
    public static final String SCENARIO_RESET_PASSWORD = "RESET_PASSWORD";

    /** 登录场景 */
    public static final String SCENARIO_LOGIN = "LOGIN";
}
```

## 4. Redis Key 常量化（强制）

- 所有 Redis Key 必须通过统一的 `RedisKeys` 静态方法生成，禁止业务代码拼接字符串。
- Key 格式统一为 `{app}:{module}:{type}:{business}`。
- Key 片段（module、type）使用枚举定义。
- 新增业务模块 Key 时，扩展 `RedisKeys` 而非新建常量类。

## 5. Map Key 与返回字段名常量化

- Controller/Service 返回的 `Map<String, Object>` 的 key 必须使用常量，禁止字面量。
- 在代码中引用接口字段名（前端联调字段、序列化字段）时抽取为常量。

```java
// 正确
public static final String FIELD_ORDER_NO = "orderNo";
Map<String, Object> result = Map.of(FIELD_ORDER_NO, order.getOrderNo());

// 错误
Map<String, Object> result = Map.of("orderNo", order.getOrderNo());
```

## 6. SQL 列名引用（强制）

- ORM 查询、更新、排序必须使用方法引用（如 MyBatis-Plus `Entity::getField`），禁止手写字段名字符串。
- Mapper XML 中引用列名时，使用 `<resultMap>` 与实体字段映射，避免在 SQL 中硬编码不一致的列名。
- 禁止 `inSql()` 等字符串拼接 SQL 的写法，必须改为参数化查询或条件构造器。

```java
// 正确
new LambdaQueryWrapper<Order>()
        .eq(Order::getStatus, OrderStatusEnum.PAID.getCode())
        .orderByDesc(Order::getCreatedTime);

// 错误
new LambdaQueryWrapper<Order>()
        .eq("status", "PAID")
        .orderByDesc("created_time");
```

## 7. HTTP 与外部协议常量化

- HTTP Header 名、Cookie 名、RequestParam 名、PathVariable 名抽取为常量。
- 第三方 API 路径、字段名抽取为对应 Properties 或常量类。
- 签名算法名、编码方式抽取为常量。

## 8. 魔法数字处理

- 阈值、超时、重试次数、分页大小等影响业务逻辑的数字，优先抽取为 Properties 配置（见 `config-extraction-rules.md`）。
- 不影响业务逻辑的固定数字（如状态码位数、固定偏移量）抽取为常量类字段。
- 禁止代码中直接出现 `1000`、`3`、`7` 等无注释数字。

## 9. 反例汇总

- `if ("1".equals(userType))` —— 使用枚举。
- `redisTemplate.delete("app:order:lock:" + id)` —— 使用统一 Key 工厂。
- `new LambdaQueryWrapper<User>().eq("phone", phone)` —— 使用方法引用。
- `Map.of("code", 200, "msg", "ok")` —— key 抽常量，且应返回统一响应体而非裸 Map。
- `TimeUnit.SECONDS.toMillis(30)` 中的 `30` 无注释 —— 抽常量或配置。
