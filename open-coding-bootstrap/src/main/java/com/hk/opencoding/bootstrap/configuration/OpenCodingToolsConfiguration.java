package com.hk.opencoding.bootstrap.configuration;

import com.hk.opencoding.core.tools.command.CommandTools;
import com.hk.opencoding.core.tools.command.DefaultCommandTools;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/8/28 15:15
 */
@Configuration
public class OpenCodingToolsConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public CommandTools commandTools() {
        return new DefaultCommandTools();
    }
}




