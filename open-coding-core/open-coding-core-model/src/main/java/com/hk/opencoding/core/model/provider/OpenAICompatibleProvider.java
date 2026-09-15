package com.hk.opencoding.core.model.provider;

import com.hk.opencoding.common.enums.ProtocolType;
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
public class OpenAICompatibleProvider extends AbstractModelProvider {

    @Builder.Default
    private ProtocolType providerType = ProtocolType.OPENAI_COMPATIBLE;

    /**
     * 兼容模式baseUrl没有统一默认值，业务必须赋值
     */
    private String baseUrl;
}
