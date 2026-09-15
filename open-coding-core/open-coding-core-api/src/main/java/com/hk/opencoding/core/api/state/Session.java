package com.hk.opencoding.core.api.state;

import com.hk.opencoding.core.api.provider.ModelProvider;

import java.nio.file.Path;
import java.time.LocalDateTime;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/7 17:18
 */
public interface Session {

    public String getId();

    public String getTitle();

    public LocalDateTime getStartTime();

    public LocalDateTime getEndTime();

    /**
     * current working directory
     */
    public String getCwd();

    /**
     * project workspace
     */
    public Path getWorkspace();

    public OpenCodingContext getOpenCodingContext();

    public ModelProvider getModelProvider();
}
