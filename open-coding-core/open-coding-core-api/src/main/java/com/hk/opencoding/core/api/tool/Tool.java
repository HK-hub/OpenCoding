package com.hk.opencoding.core.api.tool;

import com.hk.opencoding.core.api.message.ToolCall;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/15 21:14
 */
public interface Tool {

    /**
     * 工具定义；默认返回 UNSPECIFIED 占位哨兵，触发注解兜底生成。
     */
    public ToolDefinition getToolDefinition();

    ToolResult execute(ToolCall call, ToolExecutionContext context);
}
