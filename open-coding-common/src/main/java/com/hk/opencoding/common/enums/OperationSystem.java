package com.hk.opencoding.common.enums;

import lombok.Getter;

import java.util.Locale;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/8/28 15:21
 */
@Getter
public enum OperationSystem {

    WINDOWS("Windows", "win"),
    MAC("Mac", "mac"),
    LINUX("Linux", "linux"),
    BSD("BSD", "bsd"),
    UNKNOWN(null, null);

    private final String name;
    private final String value;

    OperationSystem(String name, String value) {
        this.name = name;
        this.value = value;
    }

    public static boolean isWindows(String osName) {
        return osName.toLowerCase().contains(WINDOWS.getValue());
    }

    public static boolean isMac(String osName) {
        return osName.toLowerCase().contains(MAC.getValue());
    }

    public static boolean isLinux(String osName) {
        return osName.toLowerCase().contains(LINUX.getValue());
    }

    public static boolean isBsd(String osName) {
        return osName.toLowerCase().contains(BSD.getValue());
    }

    /**
     * 根据JVM系统属性 os.name 获取操作系统枚举
     */
    public static OperationSystem getOperationSystem() {
        String osName = System.getProperty("os.name").toLowerCase(Locale.ROOT);
        if (isWindows(osName)) {
            return WINDOWS;
        } else if (isMac(osName)) {
            return MAC;
        } else if (isLinux(osName)) {
            return LINUX;
        } else if (isBsd(osName)) {
            return BSD;
        }
        return UNKNOWN;
    }
}
