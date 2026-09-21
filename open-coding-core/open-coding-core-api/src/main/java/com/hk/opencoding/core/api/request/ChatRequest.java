package com.hk.opencoding.core.api.request;

import com.fasterxml.jackson.databind.JsonNode;
import com.hk.opencoding.core.api.message.Message;
import com.hk.opencoding.core.api.tool.ToolDefinition;

import java.math.BigDecimal;
import java.util.List;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/2 16:14
 */
public interface ChatRequest extends AiRequest {

    String modelId();

    List<Message> messages();

    String systemPrompt();

    List<ToolDefinition> tools();

    BigDecimal temperature();

    BigDecimal topP();

    Integer maxOutputTokens();

    boolean enableReasoning();

    String previousResponseId();

    JsonNode extraParams();
}
