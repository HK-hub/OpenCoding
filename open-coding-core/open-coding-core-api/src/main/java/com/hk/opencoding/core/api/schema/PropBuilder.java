package com.hk.opencoding.core.api.schema;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hk.opencoding.common.enums.TypeFormat;

import java.math.BigDecimal;
import java.util.function.Consumer;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/17 21:53
 */
public interface PropBuilder {

    // ── 类型选择（择一；重复调用 → Fail-Fast） ──
    public PropBuilder string();

    public PropBuilder integer();

    public PropBuilder number();

    public PropBuilder bool();                                  // boolean 是 Java 关键字，故命名 bool()

    public PropBuilder date();

    public PropBuilder time();

    public PropBuilder dateTime();

    public PropBuilder enumOf(String... values);                // string + enum

    public PropBuilder array(Consumer<PropBuilder> items);      // array + items（递归）

    public PropBuilder object(Consumer<ObjectBuilder> nested);  // 嵌套 object（递归）

    // ── 约束修饰 ──
    public PropBuilder description(String text);

    public PropBuilder pattern(String regex);

    public PropBuilder min(Object min);

    public PropBuilder max(Object max);

    public PropBuilder minLength(int length);

    public PropBuilder maxLength(int length);

    public PropBuilder examples(Object... examples);

    public PropBuilder format(TypeFormat format);

    // 冒泡到父 ObjectBuilder 的 required
    public PropBuilder required();

}
