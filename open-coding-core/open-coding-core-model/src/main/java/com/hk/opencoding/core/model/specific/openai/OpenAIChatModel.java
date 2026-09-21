package com.hk.opencoding.core.model.specific.openai;

import com.hk.opencoding.core.api.model.ChatModel;
import com.hk.opencoding.core.api.model.StreamingChatModel;
import com.hk.opencoding.core.api.request.ChatRequest;
import com.hk.opencoding.core.api.response.ChatResponse;
import com.hk.opencoding.core.api.response.ChatStreamEvent;
import com.hk.opencoding.core.model.base.AbstractStreamingChatModel;
import reactor.core.publisher.Flux;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/1 22:12
 */
public class OpenAIChatModel extends AbstractStreamingChatModel implements ChatModel, StreamingChatModel {


    @Override
    public Flux<ChatStreamEvent> stream(ChatRequest request) {
        return null;
    }

    @Override
    public ChatResponse chat(ChatRequest request) {
        return null;
    }
}
