package com.hk.opencoding.common.enums;

import lombok.Getter;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/8/28 23:27
 */
@Getter
public enum ProtocolType {

    // ===================== 独立私有协议 =====================
    ANTHROPIC("Anthropic", "anthropic"),
    GEMINI("Gemini", "gemini"),
    COHERE("Cohere", "cohere"),
    /** Ollama 原生私有接口 /api/chat，非OpenAI‑v1兼容；用于pull/list模型等ollama特有能力 */
    OLLAMA_NATIVE("Ollama Native", "ollama_native"),
    /** 百度千帆原生私有协议，不是兼容网关 */
    QIANFAN("Baidu Qianfan", "qianfan"),
    /** 火山方舟自有鉴权协议；火山也支持openai‑compatible模式 */
    VOLCENGINE_ARK("Volcengine Ark", "volcengine_ark"),

    // ===================== OpenAI 协议族 =====================
    OPENAI("OpenAI Native", "openai"),

    /**
     * 通用OpenAI兼容协议 /v1/chat/completions
     * Groq、XAI‑Grok、OpenRouter、DeepSeek、Kimi、智谱、硅基流动、StepFun、
     * Ollama‑v1兼容模式、vLLM、llama.cpp‑server、Llama Stack全部归此类
     */
    OPENAI_COMPATIBLE("OpenAI Compatible", "openai_compatible");

    private final String name;
    private final String description;

    ProtocolType(String name, String description) {
        this.name = name;
        this.description = description;
    }
}
