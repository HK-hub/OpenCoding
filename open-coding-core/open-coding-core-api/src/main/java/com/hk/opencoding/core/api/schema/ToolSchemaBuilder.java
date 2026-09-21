package com.hk.opencoding.core.api.schema;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hk.opencoding.common.enums.TypeFormat;

import java.util.function.Consumer;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/17 21:03
 */
public interface ToolSchemaBuilder {

    /** 创建 object 根 schema 构建器。 */
    public ObjectBuilder object();
}
