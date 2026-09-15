package com.hk.opencoding.core.model.base;

import com.hk.opencoding.common.enums.ModelCapability;
import com.hk.opencoding.core.api.model.AiModel;
import com.hk.opencoding.core.api.provider.ModelProvider;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Set;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/8/28 23:38
 */
@Data
public abstract class AbstractAiModel implements AiModel {

    protected String modelId;

    protected String modelName;

    protected ModelProvider provider;

    protected String description;

    protected Set<ModelCapability> capabilities;

    protected Boolean enable;

    /**
     * 上下文窗口大小
     */
    protected Integer contextWindow;

    protected Integer maxOutputTokens;

    /**
     * 是否支持 SSE 流式输出
     */
    protected Boolean supportsStreaming;

    /**
     * 是否支持 Function‑call 工具调用
     */
    protected Boolean supportsToolCall;

    /**
     * 是否支持图片输入（多模态）
     */
    protected Boolean supportsVision;

    /**
     * 是否支持推理思考
     */
    protected Boolean supportsReasoning;

    /**
     * 是否支持结构化输出:是否支持 JSON 强制输出
     */
    protected Boolean supportsStructuredOutput;

    /**
     * 输入价格：每百万 token；计费统计使用
     */
    protected BigDecimal inputPrice;

    /**
     * 输出价格：每百万 token；计费统计使用
     */
    protected BigDecimal outputPrice;

    /**
     * 默认 0‑2；模型级别默认值，运行时可被用户请求覆盖
     */
    protected BigDecimal defaultTemperature;

    /**
     * 默认 top_p, 默认 0‑1；模型级别默认值，运行时可被用户请求覆盖
     */
    protected BigDecimal defaultTopP;

    /**
     * 默认 top_k, 默认 0‑100；模型级别默认值，运行时可被用户请求覆盖
     */
    protected Integer defaultTopK;

    /**
     * 模型独有的追加 body 参数；覆盖 provider 级别的 extraBody
     */
    protected Map<String, Object> extraBody;
}
