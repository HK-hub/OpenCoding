package com.hk.opencoding.core.api.tool;

import com.hk.opencoding.core.api.message.ContentPart;
import lombok.Data;

import java.util.List;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/15 21:14
 */
@Data
public class ToolResult {

    private String toolCallId;

    private String toolName;

    private boolean success;

    private List<ContentPart> contentParts;

    private String output;

    private String error;
}
