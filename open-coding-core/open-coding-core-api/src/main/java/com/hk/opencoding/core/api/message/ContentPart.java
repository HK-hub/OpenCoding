package com.hk.opencoding.core.api.message;

import com.hk.opencoding.common.enums.ContentPartType;

import java.util.Optional;

/**
 * 多模态内容片段：文本、图片
 */
public interface ContentPart {

    ContentPartType getType();

    Optional<String> getText();

    Optional<String> getImageUrl();

    Optional<String> getImageBase64();

    Optional<String> getAudioUrl();

    Optional<String> getVideoUrl();

    Optional<String> getFileUrl();
}