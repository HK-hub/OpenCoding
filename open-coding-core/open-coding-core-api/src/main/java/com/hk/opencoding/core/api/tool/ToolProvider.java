package com.hk.opencoding.core.api.tool;

import com.hk.opencoding.common.enums.ToolSourceType;

import java.util.List;

/**
 * 工具来源聚合；BUILTIN | PLUGIN:<id> | MCP:<server>（v1.1）
 *
 * @author HK意境
 * @version 1.0
 * @since 2026/9/17 16:24
 */
public interface ToolProvider {

    String sourceId();

    ToolSourceType sourceType();

    List<Tool> tools();

    default int order() { return 100; }
}
