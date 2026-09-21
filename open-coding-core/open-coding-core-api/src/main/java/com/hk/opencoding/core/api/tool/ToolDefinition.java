package com.hk.opencoding.core.api.tool;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hk.opencoding.common.enums.ToolRiskLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Collection;
import java.util.List;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/2 22:12
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ToolDefinition {

    /**
     * 占位哨兵（identity 判定）
     */
    public static final ToolDefinition UNSPECIFIED = new ToolDefinition();

    private String name;

    private List<String> aliasNames;

    private String description;

    private ObjectNode inputSchema;

    private ToolRiskLevel riskLevel;
}
