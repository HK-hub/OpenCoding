package com.hk.opencoding.core.api.schema;

import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.function.Consumer;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/17 21:52
 */
public interface ObjectBuilder {

    public ObjectBuilder property(String name, Consumer<PropBuilder> spec);

    /** 收尾：写入 required 数组（若非空）；additionalProperties:false 已在构造时写入。 */
    public ObjectNode build();
}
