package com.hk.opencoding.core.api.tool.command;

import com.hk.opencoding.common.context.OpenCodingContext;
import jakarta.annotation.Resource;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/8/28 15:14
 */
public class DefaultCommandTool implements CommandTool {

    @Resource
    private OpenCodingContext openCodingContext;

    private String gitBashPath;

    /**
     * 初始化命令执行工具
     */
    @Override
    public void init() {
        this.gitBashPath = openCodingContext.getGitBashPath();
    }


}
