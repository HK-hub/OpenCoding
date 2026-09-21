package com.hk.opencoding.core.api.tool;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;
import java.util.Optional;

/**
 * 工具调用参数，统一封装模型返回的 function_call arguments。
 * 底层是 JSON 对象，提供类型安全的访问方法。
 */
public interface ToolParameter {

    /**
     * 获取原始 JSON 字符串。
     */
    String getRawJson();

    /**
     * 获取结构化 JsonNode，用于复杂场景自由解析。
     */
    JsonNode getJsonNode();

    /**
     * 按 key 获取字符串参数。
     */
    Optional<String> getString(String key);

    /**
     * 按 key 获取整数参数。
     */
    Optional<Integer> getInteger(String key);

    /**
     * 按 key 获取长整数参数。
     */
    Optional<Long> getLong(String key);

    /**
     * 按 key 获取布尔参数。
     */
    Optional<Boolean> getBoolean(String key);

    /**
     * 按 key 获取 Double 参数。
     */
    Optional<Double> getDouble(String key);

    /**
     * 按 key 获取嵌套对象（返回子 ToolParam）。
     */
    Optional<ToolParameter> getObject(String key);

    /**
     * 按 key 获取数组，返回元素列表。
     */
    List<ToolParameter> getArray(String key);

    /**
     * 将参数反序列化为指定类型的 POJO。
     * @param type 目标类型
     */
    <T> T as(Class<T> type);

    /**
     * 参数是否为空（空 JSON 对象或 null）。
     */
    boolean isEmpty();

    /**
     * 是否包含指定 key。
     */
    boolean containsKey(String key);
}
