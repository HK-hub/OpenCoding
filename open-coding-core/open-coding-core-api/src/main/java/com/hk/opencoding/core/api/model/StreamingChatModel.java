package com.hk.opencoding.core.api.model;

import com.hk.opencoding.core.api.request.ChatRequest;
import com.hk.opencoding.core.api.response.ChatStreamEvent;
import reactor.core.publisher.Flux;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/1 21:10
 */
public interface StreamingChatModel extends AiModel, ChatModel {

    Flux<ChatStreamEvent> stream(ChatRequest request);
}

