package com.hk.opencoding.core.api.tool.glob;

import com.hk.opencoding.common.enums.ToolRiskLevel;
import com.hk.opencoding.core.api.message.ToolCall;
import com.hk.opencoding.core.api.schema.ToolSchemaBuilder;
import com.hk.opencoding.core.api.tool.Tool;
import com.hk.opencoding.core.api.tool.ToolDefinition;
import com.hk.opencoding.core.api.tool.ToolExecutionContext;
import com.hk.opencoding.core.api.tool.ToolResult;

import java.util.List;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/17 21:23
 */
public interface GlobTool extends Tool {

    @Override
    default ToolDefinition getToolDefinition() {
        return ToolDefinition.builder()
                .name("fewf")
                .aliasNames(List.of("", "", ""))
                .description("")
                .riskLevel(ToolRiskLevel.READ_ONLY)
                .inputSchema(ToolSchemaBuilder.)
                .build();
    }

    @Override
    ToolResult execute(ToolCall call, ToolExecutionContext context);


}
