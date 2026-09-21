package com.hk.opencoding.common.enums;

import lombok.Getter;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/15 21:49
 */
@Getter
public enum ToolRiskLevel {

    READ_ONLY,
    WRITE_LOCAL,
    EXECUTE,
    NETWORK,
    DESTRUCTIVE,
}
