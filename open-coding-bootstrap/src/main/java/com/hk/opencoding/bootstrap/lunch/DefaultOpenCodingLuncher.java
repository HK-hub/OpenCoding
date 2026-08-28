package com.hk.opencoding.bootstrap.lunch;

import com.hk.opencoding.domain.events.lifecycle.*;
import jakarta.annotation.Resource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jetbrains.annotations.NotNull;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.ApplicationListener;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/8/28 15:49
 */
@Slf4j
@RequiredArgsConstructor
public class DefaultOpenCodingLuncher implements OpenCodingLuncher, ApplicationListener<ApplicationReadyEvent> {

    @Resource
    private ApplicationEventPublisher applicationEventPublisher;

    /**
     * 启动OpenCoding
     */
    @Override
    public void start() {
        log.info("OpenCoding is starting...");
        // 发送OpenCoding开始启动事件: 此时上下文还没创建，环境还没构建
        this.applicationEventPublisher.publishEvent(new OpenCodingStartingEvent(this));

        // 配置文件、yml、环境变量全部加载完毕
        this.applicationEventPublisher.publishEvent(new OpenCodingEnvironmentPreparedEvent(this));

        // 发送OpenCodingContext初始化事件
        this.applicationEventPublisher.publishEvent(new OpenCodingContextInitializingEvent(this));

        // 发送OpenCodingContext初始化完成事件
        this.applicationEventPublisher.publishEvent(new OpenCodingContextInitializedEvent(this));

        // 发送OpenCodingContext刷新事件，所有tools, plugin等都初始化，注入完成
        this.applicationEventPublisher.publishEvent(new OpenCodingContextRefreshedEvent(this));

        // 发送OpenCoding启动完成事件，但端口，服务还未启动
        this.applicationEventPublisher.publishEvent(new OpenCodingStartedEvent(this));

        // 发送OpenCoding就绪事件, 用户可以开始使用OpenCoding
        this.applicationEventPublisher.publishEvent(new OpenCodingReadyEvent(this));
        log.info("OpenCoding is ready.");
    }

    @Override
    public void onApplicationEvent(@NotNull ApplicationReadyEvent event) {
        this.start();
    }
}
