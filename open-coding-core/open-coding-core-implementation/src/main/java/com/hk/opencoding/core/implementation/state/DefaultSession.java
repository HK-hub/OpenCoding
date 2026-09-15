package com.hk.opencoding.core.implementation.state;

import lombok.Data;
import lombok.EqualsAndHashCode;

import java.nio.file.Path;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/7 17:26
 */
@EqualsAndHashCode(callSuper = true)
@Data
public class DefaultSession extends AbstractSession {

    @Override
    public void initialize() {
        this.cwd = System.getProperty("user.dir");
        this.workspace = Path.of(this.cwd);
    }
}
