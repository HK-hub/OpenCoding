package com.hk.opencoding.common.enums;

import lombok.Getter;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/16 21:37
 */
@Getter
public enum AgentMode {

    /** 计划模式：只读，denied={WRITE_LOCAL, EXECUTE, DESTRUCTIVE}，allowed={ASK, AUTO_APPROVE} */
    PLAN("PLAN", "计划模式"),

    /** 构建模式：可写，denied={}，allowed=全部权限模式，default=ASK */
    BUILD("BUILD", "构建模式");

    private final String code;

    private final String desc;

    AgentMode(String code, String desc) {
        this.code = code;
        this.desc = desc;
    }
}