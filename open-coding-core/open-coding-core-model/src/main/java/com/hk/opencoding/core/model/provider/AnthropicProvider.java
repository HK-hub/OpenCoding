package com.hk.opencoding.core.model.provider;

import com.hk.opencoding.common.enums.ProtocolType;
import com.hk.opencoding.common.enums.ProviderBaseUrl;
import com.hk.opencoding.core.api.provider.AbstractModelProvider;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/8/30 21:26
 */
@EqualsAndHashCode(callSuper = true)
@Data
@NoArgsConstructor
@Builder
public class AnthropicProvider extends AbstractModelProvider {

    @Builder.Default
    private ProtocolType providerType = ProtocolType.ANTHROPIC;

    @Builder.Default
    private String baseUrl = ProviderBaseUrl.ANTHROPIC.getBaseUrl();
}
