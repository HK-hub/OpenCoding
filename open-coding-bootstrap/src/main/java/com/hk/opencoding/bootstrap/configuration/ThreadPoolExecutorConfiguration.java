package com.hk.opencoding.bootstrap.configuration;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.SimpleAsyncTaskExecutor;
import org.springframework.core.task.TaskExecutor;
import org.springframework.core.task.support.TaskExecutorAdapter;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.SimpleAsyncTaskScheduler;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/8/28 13:05
 */
@EnableAsync
@Configuration
public class ThreadPoolExecutorConfiguration {


    /**
     * 配置专属异步任务，子任务等的线程池
     * @return ExecutorService
     */
    @Bean
    public ExecutorService openCodingExecutorService() {
        ThreadFactory factory = Thread.ofVirtual().name("OpenCoding-vt-",0).factory();
        return Executors.newThreadPerTaskExecutor(factory);
    }

}



