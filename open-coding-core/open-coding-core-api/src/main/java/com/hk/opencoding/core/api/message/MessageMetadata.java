package com.hk.opencoding.core.api.message;

import java.util.Map;
import java.util.Optional;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/2 18:07
 */
public interface MessageMetadata {

    Optional<String> getTraceId();

    Optional<String> getSourceModel();

    Map<String, Object> getExtensions();
}