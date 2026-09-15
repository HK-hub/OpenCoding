package com.hk.opencoding.core.api.provider;

import com.hk.opencoding.common.enums.ProtocolType;
import com.hk.opencoding.core.api.model.AiModel;
import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/8/28 23:32
 */
@Data
public abstract class AbstractModelProvider implements ModelProvider {

    protected String providerId;

    protected String providerName;

    protected ProtocolType providerType;

    protected String description;

    protected String baseUrl;

    protected String apiKey;

    protected String authHeader;

    protected Map<String, String> customHeaders;

    protected int timeout;

    protected int connectTimeout;

    protected Map<String, String> extraBody;

    protected Boolean enable;

    protected String proxy;

    protected List<AiModel> models;
}
