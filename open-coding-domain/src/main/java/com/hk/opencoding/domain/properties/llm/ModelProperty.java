package com.hk.opencoding.domain.properties.llm;

import com.hk.opencoding.common.enums.ModelCapability;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Map;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/8/28 23:25
 */
@Data
public class ModelProperty {

    private String modelId;

    private String modelName;

    private String description;

    private ModelCapability modelCapability;

    private Boolean enable;

    /**
     * 上下文窗口大小
     */
    private Integer contextWindow;

    private Integer maxOutputTokens;

    /**
     * 是否支持 SSE 流式输出
     */
    private Boolean supportsStreaming;

    /**
     * 是否支持 Function‑call 工具调用
     */
    private Boolean supportsToolCall;

    /**
     * 是否支持图片输入（多模态）
     */
    private Boolean supportsVision;

    /**
     * 是否支持推理思考
     */
    private Boolean supportsReasoning;

    /**
     * 是否支持结构化输出:是否支持 JSON 强制输出
     */
    private Boolean supportsStructuredOutput;

    /**
     * 输入价格：每百万 token；计费统计使用
     */
    private BigDecimal inputPrice;

    /**
     * 输出价格：每百万 token；计费统计使用
     */
    private BigDecimal outputPrice;

    /**
     * 默认 0‑2；模型级别默认值，运行时可被用户请求覆盖
     */
    private BigDecimal defaultTemperature;

    /**
     * 默认 top_p, 默认 0‑1；模型级别默认值，运行时可被用户请求覆盖
     */
    private BigDecimal defaultTopP;

    /**
     * 默认 top_k, 默认 0‑100；模型级别默认值，运行时可被用户请求覆盖
     */
    private Integer defaultTopK;

    /**
     * 模型独有的追加 body 参数；覆盖 provider 级别的 extraBody
     */
    private Map<String, Object> extraBody;
}
