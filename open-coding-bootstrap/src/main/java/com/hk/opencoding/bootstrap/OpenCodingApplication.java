package com.hk.opencoding.bootstrap;

import io.github.cdimascio.dotenv.Dotenv;
import lombok.extern.slf4j.Slf4j;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;

import java.io.File;

/**
 * OpenCoding core application entry point.
 *
 * <p>Bootstraps the Spring context with:
 * <ul>
 *   <li>Spring Web (REST endpoints under {@code /api/*})</li>
 *   <li>MyBatis-Plus + PostgreSQL + Flyway</li>
 *   <li>Redisson (Redis) caching</li>
 *   <li>Springdoc OpenAPI (Swagger UI at {@code /swagger-ui.html})</li>
 *   <li>Spring Boot Actuator (health/info/metrics under {@code /actuator/*})</li>
 * </ul>
 *
 * <p>Configuration is environment-driven: every value is resolved from
 * environment variables (which are typically loaded from a {@code .env}
 * file at the project root by the {@link #loadDotenv()} bootstrap step,
 * or by IntelliJ's built-in .env plugin).
 *
 * @author HK
 */
@Slf4j
@EnableCaching
@MapperScan("com.hk.coding.opencoding.core.mapper")
@SpringBootApplication
public class OpenCodingApplication {

    public static void main(String[] args) {
        loadDotenv();
        SpringApplication.run(OpenCodingApplication.class, args);
    }

    /**
     * Loads {@code .env} from the project root first, then from the current
     * working directory, and finally from the module directory. Each entry
     * is exposed as a JVM system property so Spring's placeholder resolver
     * ({@code ${VAR}}) can pick it up.
     *
     * <p>Missing or malformed files are silently ignored — this is purely a
     * developer-experience helper; production deployments inject env vars
     * through the platform.
     */
    private static void loadDotenv() {
        String[] candidates = {"../", "./"};
        for (String dir : candidates) {
            File envFile = new File(dir, ".env");
            if (!envFile.isFile()) {
                continue;
            }
            try {
                Dotenv dotenv = Dotenv.configure()
                        .directory(dir)
                        .ignoreIfMissing()
                        .ignoreIfMalformed()
                        .load();
                dotenv.entries().forEach(entry ->
                        System.setProperty(entry.getKey(), entry.getValue()));
                log.info("Loaded {} variable(s) from {}.env", dotenv.entries().size(), dir);
                return;
            } catch (Exception ex) {
                log.warn("Failed to load .env at {}: {}", envFile.getAbsolutePath(), ex.getMessage());
            }
        }
        log.debug("No .env file found in candidate locations; relying on OS env / IDE injection.");
    }
}
