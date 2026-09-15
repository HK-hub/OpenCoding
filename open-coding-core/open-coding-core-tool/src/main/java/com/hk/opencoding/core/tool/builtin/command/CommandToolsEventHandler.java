package com.hk.opencoding.core.tool.builtin.command;

import com.hk.opencoding.domain.events.tools.ToolInitializeEvent;
import jakarta.annotation.Resource;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/8/28 13:36
 */
@Component
public class CommandToolsEventHandler {

    @Resource
    private CommandTools commandTools;

    /**
     * 处理工具初始化事件
     * @param event 工具初始化事件
     */
    @EventListener(ToolInitializeEvent.class)
    public void handleEvent(ToolInitializeEvent event) {

        // 初始化命令执行工具
        this.commandTools.init();
    }
}
