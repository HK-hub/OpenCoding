package com.hk.opencoding.core.api.tool.read;

import com.hk.opencoding.core.api.message.ToolCall;
import com.hk.opencoding.core.api.tool.Tool;
import com.hk.opencoding.core.api.tool.ToolDefinition;
import com.hk.opencoding.core.api.tool.ToolExecutionContext;
import com.hk.opencoding.core.api.tool.ToolResult;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/17 21:22
 */
public interface ReadFileTool extends Tool {

    @Override
    ToolDefinition getToolDefinition();

    @Override
    ToolResult execute(ToolCall call, ToolExecutionContext context);
}
