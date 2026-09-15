package com.hk.opencoding.common.enums;

import lombok.Getter;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/3 21:00
 */
@Getter
public enum MessageRole {

    SYSTEM("system", "系统"),
    USER("user", "用户"),
    ASSISTANT("assistant", "AI"),
    TOOL("tool", "工具调用");

    private final String code;

    private final String desc;

    MessageRole(String code, String desc) {
        this.code = code;
        this.desc = desc;
    }
}
