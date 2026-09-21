package com.hk.opencoding.core.api.schema;

import com.hk.opencoding.core.api.tool.ToolDefinition;

import java.lang.reflect.Method;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/17 17:18
 */
public interface ToolSchemaGenerator {

    /** 通道 A：@Tool 方法 → 完整定义（含 inputSchema，与绑定计划同源扫描）。 */
    public ToolDefinition definitionFromMethod(Method method);

    /** 通道 B：类级 @Tool + repeatable @ToolParam → 定义（execute 手写场景，仅生成定义）。 */
    public ToolDefinition definitionFromType(Class<?> toolClass);
}
