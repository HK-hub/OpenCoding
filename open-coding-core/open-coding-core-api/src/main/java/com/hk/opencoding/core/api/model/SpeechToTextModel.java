package com.hk.opencoding.core.api.model;

import com.hk.opencoding.core.api.request.SpeechToTextRequest;
import com.hk.opencoding.core.api.response.TranscriptResponse;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/15 11:45
 */
public interface SpeechToTextModel extends AiModel {

    TranscriptResponse transcribe(SpeechToTextRequest request);
}
