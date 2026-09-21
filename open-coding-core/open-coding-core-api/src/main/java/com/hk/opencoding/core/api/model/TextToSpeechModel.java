package com.hk.opencoding.core.api.model;

import com.hk.opencoding.core.api.request.TextToSpeechRequest;
import com.hk.opencoding.core.api.response.AudioResponse;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/15 11:45
 */
public interface TextToSpeechModel extends AiModel {

    AudioResponse synthesize(TextToSpeechRequest request);
}
