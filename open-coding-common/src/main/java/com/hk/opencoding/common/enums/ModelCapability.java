package com.hk.opencoding.common.enums;

import lombok.Getter;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/8/30 20:53
 */
@Getter
public enum ModelCapability {

    CHAT("chat", "Chat Model"),
    IMAGE("image", "Image Model"),
    AUDIO("audio", "Audio Model"),
    VIDEO("video", "Video Model"),
    EMBEDDING("embedding", "Embedding Model"),
    MULTIMODAL("multimodal", "Multimodal");

    private final String value;
    private final String description;

    ModelCapability(String value, String description) {
        this.value = value;
        this.description = description;
    }
}


