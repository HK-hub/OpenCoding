package com.hk.opencoding.application.event;

import com.hk.opencoding.common.context.OpenCodingContext;
import com.hk.opencoding.domain.events.lifecycle.*;
import com.hk.opencoding.domain.events.tools.ToolInitializeEvent;
import lombok.RequiredArgsConstructor;
import org.jetbrains.annotations.NotNull;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.ApplicationListener;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/8/28 13:26
 */
@Component
@RequiredArgsConstructor
public class OpenCodingLifecycleEventListener {

    private final OpenCodingContext openCodingContext;

    private final ApplicationEventPublisher applicationEventPublisher;

    @EventListener(OpenCodingStartingEvent.class)
    public void onOpenCodingStartingEvent(@NotNull OpenCodingStartingEvent event) {

    }

    @EventListener(OpenCodingEnvironmentPreparedEvent.class)
    public void onOpenCodingEnvironmentPreparedEvent(@NotNull OpenCodingEnvironmentPreparedEvent event) {
    }

    @EventListener(OpenCodingContextInitializingEvent.class)
    public void onOpenCodingContextInitializingEvent(@NotNull OpenCodingContextInitializingEvent event) {
        this.openCodingContext.init();
    }

    @EventListener(OpenCodingContextInitializedEvent.class)
    public void onOpenCodingContextInitializedEvent(@NotNull OpenCodingContextInitializedEvent event) {
        this.applicationEventPublisher.publishEvent(new ToolInitializeEvent(this));
    }

    @EventListener(OpenCodingContextRefreshedEvent.class)
    public void onOpenCodingContextRefreshedEvent(@NotNull OpenCodingContextRefreshedEvent event) {

    }

    @EventListener(OpenCodingStartedEvent.class)
    public void onOpenCodingStartedEvent(@NotNull OpenCodingStartedEvent event) {

    }

    @EventListener(OpenCodingReadyEvent.class)
    public void onOpenCodingReadyEvent(@NotNull OpenCodingReadyEvent  event) {

    }
}
