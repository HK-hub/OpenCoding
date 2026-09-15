package com.hk.opencoding.core.api.message;

import com.hk.opencoding.common.enums.MessageRole;

import java.util.List;
import java.util.Optional;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/2 18:07
 */
public interface Message {

    /** 消息角色 */
    MessageRole getRole();

    /**
     * 文本内容；多模态时可能为空
     */
    Optional<String> getTextContent();

    /**
     * 多模态内容块：文本、图片、音频等
     */
    List<ContentPart> getContentParts();

    /**
     * 获取工具调用；仅 ASSISTANT 消息有效
     */
    List<ToolCall> getToolCalls();

    /**
     * 消息元数据：traceId、modelHint、custom扩展字段，插件可以存放自定义信息
     */
    MessageMetadata getMetadata();
}
