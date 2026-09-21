package com.hk.opencoding.core.api.tool;

/**
 * 执行体唯一接缝：raw 参数 → 具体实现调用。
 *
 * @author HK意境
 * @version 1.0
 * @since 2026/9/17 16:19
 */
@FunctionalInterface
public interface ToolHandler {

    ToolResult handle(ToolParameter parameter, ToolExecutionContext context);
}
