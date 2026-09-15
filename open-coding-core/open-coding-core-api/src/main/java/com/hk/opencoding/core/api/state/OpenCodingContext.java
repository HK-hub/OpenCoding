package com.hk.opencoding.core.api.state;

import com.hk.opencoding.common.enums.OperationSystem;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/8/28 15:19
 */
public interface OpenCodingContext {

    public void init();

    public OperationSystem getOperationSystem();

    public String getGitBashPath();
}
