package com.hk.opencoding.core.api.annotation;

import com.hk.opencoding.common.enums.ToolRiskLevel;

import java.lang.annotation.*;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/16 21:10
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.METHOD})
public @interface Tool {

    String name();

    String description();

    String[] aliasNames() default {};

    String version() default "1.0.0";

    ToolRiskLevel riskLevel();
}
