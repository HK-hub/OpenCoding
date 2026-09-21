package com.hk.opencoding.common.enums;

import lombok.Getter;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/17 20:49
 */
@Getter
public enum TypeFormat {

    NO_SPECIFIED(""),
    INT64("int64"),
    DATE("date"),
    DATETIME("datetime"),
    TIME("time");

    private final String code;

    TypeFormat(String code) {
        this.code = code;
    }

}
