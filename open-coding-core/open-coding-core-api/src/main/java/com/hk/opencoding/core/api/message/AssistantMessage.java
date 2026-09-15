package com.hk.opencoding.core.api.message;

import com.hk.opencoding.common.enums.MessageRole;

import java.util.Optional;

/**
 * AI助手消息，包含文本、工具调用
 *
 * @author HK意境
 * @version 1.0
 * @since 2026/9/3 18:07
 */
public interface AssistantMessage extends Message {

    @Override
    default MessageRole getRole() {
        return MessageRole.ASSISTANT;
    }

    /** 是否完成流式输出结束 */
    boolean finished();

    /** stop reason，模型返回停止原因 */
    Optional<String> getFinishReason();
}