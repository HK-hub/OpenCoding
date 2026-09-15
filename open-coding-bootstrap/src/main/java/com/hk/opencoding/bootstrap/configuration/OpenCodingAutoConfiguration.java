package com.hk.opencoding.bootstrap.configuration;

import com.hk.opencoding.bootstrap.lunch.DefaultOpenCodingLuncher;
import com.hk.opencoding.bootstrap.lunch.OpenCodingLuncher;
import com.hk.opencoding.common.context.DefaultOpenCodingContext;
import com.hk.opencoding.common.context.OpenCodingContext;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/8/28 12:52
 */
@Configuration
public class OpenCodingAutoConfiguration {

    /**
     * OpenCoding上下文
     */
    @Bean
    @ConditionalOnMissingBean
    public OpenCodingContext openCodingContext() {
        return new DefaultOpenCodingContext();
    }

    /**
     * OpenCoding启动器
     */
    @Bean
    @ConditionalOnMissingBean
    public OpenCodingLuncher openCodingLuncher() {
        return new DefaultOpenCodingLuncher();
    }
}
