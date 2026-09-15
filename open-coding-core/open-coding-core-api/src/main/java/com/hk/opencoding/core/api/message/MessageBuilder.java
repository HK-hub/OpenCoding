package com.hk.opencoding.core.api.message;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/2 18:07
 */
public interface MessageBuilder {

    MessageBuilder text(String text);

    MessageBuilder addTextPart(String text);
    MessageBuilder addImageUrlPart(String url);
    MessageBuilder addImageBase64Part(String base64);

    MessageBuilder metadata(MessageMetadata metadata);
    MessageBuilder putMetaExtension(String key, Object value);

    MessageBuilder toolCall(ToolCall toolCall);

    SystemMessage buildSystem();
    UserMessage buildUser();
    AssistantMessage buildAssistant();
    ToolMessage buildTool(String toolCallId, String toolName);

    static MessageBuilder newBuilder() {
        // SPI工厂查找，实际实现来自core模块
        return MessageBuilderFactory.getInstance().create();
    }
}
