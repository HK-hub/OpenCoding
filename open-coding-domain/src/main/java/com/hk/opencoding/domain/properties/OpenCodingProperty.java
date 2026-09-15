package com.hk.opencoding.domain.properties;

import com.hk.opencoding.domain.properties.llm.LLMProviderProperty;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/8/28 23:19
 */
@Data
@Component
@ConfigurationProperties(prefix = "open-coding")
public class OpenCodingProperty {

    private AI ai;

    @Data
    public static class AI {

        private List<LLMProviderProperty> providers;
    }
}
