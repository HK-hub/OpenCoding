package com.hk.opencoding.core.api.model;

import com.hk.opencoding.common.enums.ModelCapability;
import com.hk.opencoding.core.api.provider.ModelProvider;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Set;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/8/28 23:38
 */
public interface AiModel {

    public String getModelId();

    public String getModelName();

    public ModelProvider getProvider();

    public String getDescription();

    public Set<ModelCapability> getCapabilities();

    public Boolean getEnable();

    /**
     * 上下文窗口大小
     */
    public Integer getContextWindow();

    public Integer getMaxOutputTokens();

    /**
     * 是否支持 SSE 流式输出
     */
    public Boolean getSupportsStreaming();

    /**
     * 是否支持 Function‑call 工具调用
     */
    public Boolean getSupportsToolCall();

    /**
     * 是否支持图片输入（多模态）
     */
    public Boolean getSupportsVision();

    /**
     * 是否支持推理思考
     */
    public Boolean getSupportsReasoning();

    /**
     * 是否支持结构化输出:是否支持 JSON 强制输出
     */
    public Boolean getSupportsStructuredOutput();

    /**
     * 输入价格：每百万 token；计费统计使用
     */
    public BigDecimal getInputPrice();

    /**
     * 输出价格：每百万 token；计费统计使用
     */
    public BigDecimal getOutputPrice();

    /**
     * 默认 0‑2；模型级别默认值，运行时可被用户请求覆盖
     */
    public BigDecimal getDefaultTemperature();

    /**
     * 默认 top_p, 默认 0‑1；模型级别默认值，运行时可被用户请求覆盖
     */
    public BigDecimal getDefaultTopP();

    /**
     * 默认 top_k, 默认 0‑100；模型级别默认值，运行时可被用户请求覆盖
     */
    public Integer getDefaultTopK();

    /**
     * 模型独有的追加 body 参数；覆盖 provider 级别的 extraBody
     */
    public Map<String, Object> getExtraBody();

    /**
     * 工具方法快速判断是否具备某能力
     * @param cap 能力枚举
     * @return 是否具备该能力
     */

    public default boolean hasCapability(ModelCapability cap){
        return this.getCapabilities() != null && this.getCapabilities().contains(cap);
    }
}
