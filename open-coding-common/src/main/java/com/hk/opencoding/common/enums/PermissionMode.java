package com.hk.opencoding.common.enums;

import lombok.Getter;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/16 21:37
 */
@Getter
public enum PermissionMode {

    /** 询问审批（默认）：除只读操作外一律人工确认 */
    ASK("ASK", "询问审批"),

    /** 接受编辑：工作区文件写入自动放行，执行/网络/破坏性仍需确认 */
    ACCEPT_EDITS("ACCEPT_EDITS", "接受编辑"),

    /** 自动审批：DESTRUCTIVE 以下自动放行，仅破坏性操作仍需确认 */
    AUTO_APPROVE("AUTO_APPROVE", "自动审批"),

    /** 完全访问：全部自动放行（含破坏性），仅限受控环境 */
    FULL_ACCESS("FULL_ACCESS", "完全访问");

    private final String code;

    private final String desc;

    PermissionMode(String code, String desc) {
        this.code = code;
        this.desc = desc;
    }
}