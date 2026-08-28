package com.hk.opencoding.domain.events.lifecycle;

import com.hk.opencoding.common.events.AbstractOpenCodingEvent;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/8/28 13:22
 */
public class OpenCodingStartingEvent extends AbstractOpenCodingEvent {
    public OpenCodingStartingEvent(Object source) {
        super(source);
    }
}
