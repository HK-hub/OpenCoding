# OpenCoding

A multi-module Spring Boot 3.4 project on Java 21, backed by MyBatis-Plus, Redisson, and Flyway.

## Modules

| Module              | Purpose                                                              |
| ------------------- | -------------------------------------------------------------------- |
| `open-coding-core`  | Spring Boot application — Web, MyBatis-Plus, Redisson, MapStruct, Anthropic SDK |

## Tech stack

- **Runtime:** Java 21, Spring Boot 3.4.1 (Web, Validation, AOP, Cache, Actuator)
- **Persistence:** MyBatis-Plus 3.5 + PostgreSQL + Flyway
- **Cache / Redis:** Redisson 3.36
- **Mapping:** MapStruct 1.6 + Lombok 1.18
- **AI:** Anthropic Java SDK 2.57
- **Docs:** springdoc-openapi 2.6 (Swagger UI)
- **Utilities:** Apache Commons Lang3 / Collections4 / IO / Codec
- **Config:** `.env` file injection (dotenv-java)

## Requirements

- JDK 21+
- Maven 3.9+
- PostgreSQL 14+ (for runtime — tests run offline)
- Redis 7+ (for runtime — tests run offline)

## Quick start

```bash
# 1. Copy the env template and fill in local secrets
cp .env.example .env

# 2. Build
mvn clean install

# 3. Run
cd open-coding-core
mvn spring-boot:run
```

Then:

- `http://localhost:8080/api/health` — health probe
- `http://localhost:8080/swagger-ui.html` — Swagger UI
- `http://localhost:8080/actuator/health` — Actuator health
- `http://localhost:8080/v3/api-docs` — OpenAPI JSON

## Configuration via `.env`

All environment-specific values are read from environment variables, typically loaded from a `.env` file at the project root.

**Resolution order (highest to lowest priority):**

1. OS / shell env vars (`export DB_PASSWORD=...`)
2. IntelliJ IDEA Ultimate's built-in `.env` plugin (run configuration → EnvFile)
3. `.env` file at project root, loaded by `dotenv-java` in `OpenCodingApplication#loadDotenv()`

`.env` is gitignored; `.env.example` is the tracked template with all keys documented.

## Environment variables

| Variable              | Description                          | Default                                       |
| --------------------- | ------------------------------------ | --------------------------------------------- |
| `SERVER_PORT`         | HTTP port                            | `8080`                                        |
| `DB_URL`              | JDBC URL                             | `jdbc:postgresql://localhost:5432/opencoding` |
| `DB_USERNAME`         | Database username                    | `postgres`                                    |
| `DB_PASSWORD`         | Database password                    | `postgres`                                    |
| `DB_POOL_MAX_SIZE`    | HikariCP max pool size               | `20`                                          |
| `DB_POOL_MIN_IDLE`    | HikariCP min idle                    | `5`                                           |
| `FLYWAY_ENABLED`      | Run Flyway migrations on boot        | `true`                                        |
| `REDIS_HOST`          | Redis host                           | `localhost`                                   |
| `REDIS_PORT`          | Redis port                           | `6379`                                        |
| `REDIS_PASSWORD`      | Redis password (if any)              | empty                                         |
| `REDIS_DATABASE`      | Redis logical DB index               | `0`                                           |
| `SWAGGER_ENABLED`     | Toggle Swagger UI                    | `true`                                        |
| `ANTHROPIC_API_KEY`   | Anthropic API key                    | empty                                         |
| `ANTHROPIC_BASE_URL`  | Anthropic API base URL               | `https://api.anthropic.com`                   |
| `ANTHROPIC_API_VERSION` | Anthropic API version              | `2023-06-01`                                  |
| `LOG_LEVEL_ROOT`      | Root logger level                    | `INFO`                                        |
| `LOG_LEVEL_APP`       | `com.hk.coding` package level        | `INFO`                                        |

## Layout

```
OpenCoding/
├── pom.xml                            # parent: version + plugin management
├── .env.example                       # tracked env template
├── .env                               # local secrets (gitignored)
├── open-coding-core/
│   ├── pom.xml                        # module: actual dependencies
│   └── src/
│       ├── main/
│       │   ├── java/com/hk/coding/opencoding/core/
│       │   │   ├── com.hk.opencoding.bootstrap.OpenCodingApplication.java
│       │   │   └── web/HealthController.java
│       │   └── resources/
│       │       └── application.yml
│       └── test/
│           └── java/com/hk/coding/opencoding/core/
│               └── OpenCodingApplicationTests.java
└── README.md
```
