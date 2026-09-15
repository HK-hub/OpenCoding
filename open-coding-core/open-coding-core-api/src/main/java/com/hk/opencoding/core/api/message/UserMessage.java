package com.hk.opencoding.core.api.message;

import com.hk.opencoding.common.enums.MessageRole;

/**
 * 用户消息，支持文本+图片多模态
 *
 * @author HK意境
 * @version 1.0
 * @since 2026/9/3 18:07
 */
public interface UserMessage extends Message {

    @Override
    default MessageRole getRole() {
        return MessageRole.USER;
    }
}