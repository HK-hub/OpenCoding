package com.hk.opencoding.common.events;

import org.springframework.context.ApplicationEvent;

import java.time.Clock;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/8/28 12:54
 */
public abstract class AbstractOpenCodingEvent extends ApplicationEvent {

    public AbstractOpenCodingEvent(Object source) {
        super(source);
    }

    public AbstractOpenCodingEvent(Object source, Clock clock) {
        super(source, clock);
    }
}
