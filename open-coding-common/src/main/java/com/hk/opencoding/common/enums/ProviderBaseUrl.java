package com.hk.opencoding.common.enums;

import lombok.Getter;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/8/30 21:30
 */
@Getter
public enum ProviderBaseUrl {

    // ========== 海外厂商 ==========
    OPENAI("OpenAI", "https://api.openai.com/v1", "OpenAI 海外原版"),
    ANTHROPIC("Anthropic", "https://api.anthropic.com/v1", "Anthropic Claude 海外原版，自有协议"),
    COHERE_COMPAT("Cohere‑Compat", "https://api.cohere.ai/compatibility/v1", "Cohere OpenAI兼容网关，推荐使用"),    OLLAMA_COMPATIBLE("Ollama Compatible", "`http://127.0.0.1:11434/v1`", "Ollama兼容模式"),
    OLLAMA_NATIVE("Ollama Native", "http://127.0.0.1:11434/api", "Ollama原生协议"),
    GEMINI_NATIVE("Google‑Gemini‑Native", "https://generativelanguage.googleapis.com/v1beta", "Gemini generateContent原生REST协议，海外"),
    GEMINI_OPENAI_COMPAT("Google‑Gemini", "https://generativelanguage.googleapis.com/v1beta/openai", "Gemini OpenAI兼容接口，海外"),
    XAI_GROK("XAI‑Grok", "https://api.x.ai/v1", "xAI Grok模型(马斯克X旗下)"),
    MISTRAL("MistralAI", "https://api.mistral.ai/v1", "Mistral AI 海外原版"),
    GROQ("Groq", "https://api.groq.com/openai/v1", "Groq 海外高速推理网关"),
    OPENROUTER("OpenRouter", "https://openrouter.ai/api/v1", "OpenRouter 海外聚合模型网关"),
    TOGETHER_AI("TogetherAI", "https://api.together.xyz/v1", "Together AI 海外开源模型托管网关"),
    NOVITA_AI("NovitaAI", "https://api.novita.ai/v3/openai", "Novita AI 海外开源模型网关"),
    DEEPINFRA("DeepInfra", "https://api.deepinfra.com/v1/openai", "DeepInfra 海外开源模型推理服务"),
    LAMBDA_LABS("LambdaLabs", "https://api.lambdalabs.com/v1", "Lambda Labs 海外模型API"),
    PERPLEXITY("Perplexity", "https://api.perplexity.ai", "Perplexity 搜索增强大模型API"),
    OPENCODE("OpenCode", "https://opencode.ai/api/v1", "OpenCode coding agent 官方API网关"),

    // ========== 国内厂商 ==========
    DEEPSEEK("DeepSeek", "https://api.deepseek.com/v1", "DeepSeek 深度求索，国内服务"),
    MOONSHOT_KIMI("Moonshot‑Kimi", "https://api.moonshot.cn/v1", "Moonshot Kimi，国内服务"),
    ZHIPU_GLM("ZhipuAI‑GLM", "https://open.bigmodel.cn/api/paas/v4", "智谱AI GLM，国内开放平台"),
    ALIBABA_DASHSCOPE("Alibaba‑DashScope", "https://dashscope.aliyuncs.com/compatible-mode/v1", "阿里百炼DashScope OpenAI兼容，国内"),
    SILICONFLOW("SiliconFlow", "https://api.siliconflow.cn/v1", "硅基流动，国内模型聚合网关"),
    MINIMAX("MiniMax", "https://api.minimax.chat/v1", "MiniMax，国内服务"),
    STEPFUN("StepFun", "https://api.stepfun.com/v1", "阶跃星辰，国内标准按量接口"),
    STEPFUN_CODING_PLAN("StepFun", "https://api.stepfun.com/step_plan/v1", "阶跃星辰 Coding订阅专用独立endpoint，国内"),
    ZERO_ONE("ZeroOne", "https://api.lingyiwanwu.com/v1", "零一万物 Yi系列模型，国内"),
    BYTEDANCE_VOLCENGINE_ARK("Volcengine‑Ark", "https://ark.cn-beijing.volces.com/api/v3", "火山方舟，国内；使用推理接入点ID作为model参数"),
    BAIDU_QIANFAN_COMPAT("Baidu‑Qianfan‑Compat", "https://qianfan.baidubce.com/v2", "百度千帆 OpenAI兼容网关，国内");


    private final String provider;

    private final String baseUrl;

    private final String desc;

    ProviderBaseUrl(String provider, String baseUrl, String desc) {
        this.provider = provider;
        this.baseUrl = baseUrl;
        this.desc = desc;
    }

    /**
     * 根据provider名称查找枚举（精确匹配）
     */
    public static ProviderBaseUrl findByProvider(String providerName) {
        for (ProviderBaseUrl value : ProviderBaseUrl.values()) {
            if (value.getProvider().equals(providerName)) {
                return value;
            }
        }
        return null;
    }
}


