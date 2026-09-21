package com.hk.opencoding.common.enums;

/**
 * 注解面类型 token —— 类级注解 DSL 的简写，不是类型系统本尊（类型系统 = §5.2 canonical 子集）。
 * 不含 OBJECT：Java 注解禁止循环引用（cyclic annotation element type），对象结构无法在注解内自嵌套，
 * 由方法签名 record 推断或 Builder 显式表达。
 */
public enum ToolParamType {
    STRING, INTEGER, NUMBER, BOOLEAN, ARRAY, INFER
}