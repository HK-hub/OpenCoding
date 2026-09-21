package com.hk.opencoding.core.api.annotation;

import com.hk.opencoding.common.enums.ToolParamType;
import com.hk.opencoding.common.enums.TypeFormat;

import java.lang.annotation.*;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/17 16:15
 */
@Documented
@Target({ElementType.PARAMETER, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface ToolParam {

    /** 参数名。空 → 取字节码参数名（需 -parameters），再失败 Fail-Fast（D42）。 */
    String name() default "";

    /** schema 类型。方法参数可推断；类级（TYPE）使用必须显式，INFER → Fail-Fast。 */
    ToolParamType type() default ToolParamType.INFER;

    /** 仅 type=ARRAY 时生效：数组元素类型（标量）。元素为枚举/对象 → 用方法签名或 Builder。 */
    ToolParamType items() default ToolParamType.INFER;

    /** 仅 type=STRING 时生效：格式化提示，白名单 {date, date-time}（如 ISO-8601 日期）。 */
    TypeFormat format() default TypeFormat.NO_SPECIFIED;

    /** 是否必填。方法参数：primitive 恒必填（注解无效，改为装箱类型表达可选）；引用类型默认 false。 */
    boolean required() default false;

    /** 参数描述（模型填参准确率的关键，写清格式与默认值约定）。 */
    String description() default "";

    /** 枚举取值（仅 STRING 类型）；Java enum 参数自动取常量名。 */
    String[] enumValues() default {};
}
