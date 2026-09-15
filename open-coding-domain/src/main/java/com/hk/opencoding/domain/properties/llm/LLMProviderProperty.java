package com.hk.opencoding.domain.properties.llm;

import com.hk.opencoding.common.enums.ProtocolType;
import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/8/28 23:22
 */
@Data
public class LLMProviderProperty {

    private String providerName;

    private ProtocolType providerType;

    private String description;

    private String baseUrl;

    private String apiKey;

    private String authHeader;

    private Map<String, String> customHeaders;

    private int timeout;

    private int connectTimeout;

    private Map<String, String> extraBody;

    private Boolean enable;

    private String proxy;

    private List<ModelProperty> models;
}
