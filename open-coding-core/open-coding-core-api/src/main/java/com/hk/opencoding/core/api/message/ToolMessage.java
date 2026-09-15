package com.hk.opencoding.core.api.message;

import com.hk.opencoding.common.enums.MessageRole;

/**
 * 工具返回结果消息
 *
 * @author HK意境
 * @version 1.0
 * @since 2026/9/3 18:07
 */
public interface ToolMessage extends Message {

    @Override
    default MessageRole getRole() {
        return MessageRole.TOOL;
    }

    /** 对应工具调用id */
    String getToolCallId();

    /** 工具名称 */
    String getToolName();
}