package com.hk.opencoding.common.context;

import com.hk.opencoding.common.enums.OperationSystem;
import com.hk.opencoding.common.utils.GitBashDetector;
import lombok.Data;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.ApplicationListener;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/8/28 15:19
 */
@Data
public class DefaultOpenCodingContext implements OpenCodingContext {

    /**
     * operation system
     */
    private OperationSystem operationSystem;

    /**
     * git bash path
     */
    private String gitBashPath;

    @Override
    public void init() {
        this.operationSystem = OperationSystem.getOperationSystem();
        this.gitBashPath = GitBashDetector.detectGitBash(this.operationSystem);
    }
}
