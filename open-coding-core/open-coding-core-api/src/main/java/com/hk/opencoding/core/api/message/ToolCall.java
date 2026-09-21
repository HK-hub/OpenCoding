package com.hk.opencoding.core.api.message;

import com.hk.opencoding.core.api.tool.ToolParameter;
import com.hk.opencoding.common.enums.ToolRiskLevel;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/2 18:07
 */
public interface ToolCall {

    /** 工具调用id，用于ToolMessage关联 */
    String getId();

    /** 工具函数名称 */
    String getToolName();

    /** 参数结构化对象 */
    ToolParameter getParameter();

    ToolRiskLevel getRiskLevel();
}
