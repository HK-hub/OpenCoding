package com.hk.opencoding.core.api.provider;

import com.hk.opencoding.common.enums.ProtocolType;
import com.hk.opencoding.core.api.model.AiModel;

import java.util.List;
import java.util.Map;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/8/28 23:14
 */
public interface ModelProvider {

    String getProviderId();

    String getProviderName();

    ProtocolType getProviderType();

    String getDescription();

    String getBaseUrl();

    String getApiKey();

    String getAuthHeader();

    Map<String, String> getCustomHeaders();

    /**
     * HTTP 超时，单位毫秒，推荐 60‑120 秒，
     */
    int getTimeout();

    /**
     * 连接超时，单位毫秒
     */
    int getConnectTimeout();

    /**
     * 全局追加到 request body 的参数，例如 `{"version":"2025‑09‑01"}`，所有模型请求都会带上
     */
    Map<String, String> getExtraBody();

    /**
     * 代理地址
     */
    String getProxy();

    List<AiModel> getModels();

    Boolean getEnable();
}
