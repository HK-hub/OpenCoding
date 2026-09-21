package com.hk.opencoding.common.enums;

import lombok.Getter;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/17 16:25
 */
@Getter
public enum ToolSourceType {

    BUILTIN("builtin", "内置工具"),
    PLUGIN("plugin", "插件工具"),
    MCP("mcp", "MCP工具");

    private final String code;
    private final String desc;

    ToolSourceType(String code, String description) {
        this.code = code;
        this.desc = description;
    }
}

