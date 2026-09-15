package com.hk.opencoding.common.enums;

/**
 * 统一的模型输出结束原因枚举
 *
 * @author HK意境
 * @version 1.0
 * @since 2026/9/3 21:00
 */
public enum FinishReason {

    /** 正常结束，模型主动停止 */
    STOP,

    /** 达到最大输出 token 限制被截断 */
    MAX_TOKENS,

    /** 模型触发工具调用，需要执行工具后继续 */
    TOOL_CALLS,

    /** 内容被安全过滤拦截 */
    CONTENT_FILTER,

    /** 模型侧错误终止 */
    ERROR,

    /** 无法识别的结束原因，回退用 */
    UNKNOWN;

    /**
     * 从厂商原生字符串解析为统一枚举。
     * 覆盖 OpenAI / Anthropic / Gemini / Ollama 常见取值。
     */
    public static FinishReason from(String raw) {
        if (raw == null || raw.isBlank()) {
            return UNKNOWN;
        }
        return switch (raw.toLowerCase().trim()) {
            case "stop", "end_turn", "stop_sequence", "completed" -> STOP;
            case "length", "max_tokens", "max_output_tokens" -> MAX_TOKENS;
            case "tool_calls", "tool_use", "function_call" -> TOOL_CALLS;
            case "content_filter", "safety", "blocked" -> CONTENT_FILTER;
            case "error", "failed" -> ERROR;
            default -> UNKNOWN;
        };
    }
}
