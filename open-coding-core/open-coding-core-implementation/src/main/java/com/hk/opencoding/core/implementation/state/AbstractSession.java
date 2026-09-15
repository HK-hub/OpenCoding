package com.hk.opencoding.core.implementation.state;

import com.hk.opencoding.core.api.provider.ModelProvider;
import com.hk.opencoding.core.api.state.OpenCodingContext;
import com.hk.opencoding.core.api.state.Session;
import lombok.Data;

import java.nio.file.Path;
import java.time.LocalDateTime;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/7 17:29
 */
@Data
public abstract class AbstractSession implements Session {

    protected String id;

    protected String title;

    protected LocalDateTime startTime;

    protected LocalDateTime endTime;

    /**
     * current working directory
     */
    protected String cwd;

    /**
     * project workspace
     */
    protected Path workspace;

    protected OpenCodingContext openCodingContext;

    protected ModelProvider modelProvider;

    public abstract void initialize();
}
