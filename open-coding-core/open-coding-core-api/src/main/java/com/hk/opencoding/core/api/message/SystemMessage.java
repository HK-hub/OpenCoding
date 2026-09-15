package com.hk.opencoding.core.api.message;

import com.hk.opencoding.common.enums.MessageRole;

/**
 * 系统提示词/指令消息
 *
 * @author HK意境
 * @version 1.0
 * @since 2026/9/3 18:07
 */
public interface SystemMessage extends Message {

    @Override
    default MessageRole getRole() {
        return MessageRole.SYSTEM;
    }
}