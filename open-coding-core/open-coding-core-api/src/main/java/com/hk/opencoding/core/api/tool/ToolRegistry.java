package com.hk.opencoding.core.api.tool;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * 工具注册表：读（find/definitions）+ 写（register，供 provider 与插件提交）
 *
 * @author HK意境
 * @version 1.0
 * @since 2026/9/17 16:48
 */
public interface ToolRegistry {

    void register(Tool... tools);

    void register(Collection<Tool> tools);

    List<Tool> tools();

    /**
     * 索引 name + aliasNames
     */
    Optional<Tool> find(String name);

    /**
     * 冻结缓存，每 step 复用
     */
    List<ToolDefinition> definitions();
}
