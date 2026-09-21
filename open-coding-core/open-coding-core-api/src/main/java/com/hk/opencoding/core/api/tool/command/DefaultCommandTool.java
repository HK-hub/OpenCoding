package com.hk.opencoding.core.api.tool.command;

import com.hk.opencoding.core.api.message.ToolCall;
import com.hk.opencoding.core.api.state.OpenCodingContext;
import com.hk.opencoding.core.api.tool.ToolDefinition;
import com.hk.opencoding.core.api.tool.ToolExecutionContext;
import com.hk.opencoding.core.api.tool.ToolResult;
import jakarta.annotation.Resource;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/8/28 15:14
 */
public class DefaultCommandTool implements CommandTool {

    @Resource
    private OpenCodingContext openCodingContext;

    private String gitBashPath;

    /**
     * 初始化命令执行工具
     */
    @Override
    public void init() {
        this.gitBashPath = openCodingContext.getGitBashPath();
    }


    @Override
    public ToolDefinition getToolDefinition() {
        return null;
    }

    @Override
    public ToolResult execute(ToolCall call, ToolExecutionContext context) {
        return null;
    }
}
