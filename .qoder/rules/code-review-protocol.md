---
trigger: always_on
---

# 代码评审强制协议

**触发场景**：代码完成（新增/修改 Java 代码）后的自检、用户要求 review / 评审 / 检查代码、提交（commit）前的最终核对。**未执行本协议不得宣告完成。**

## 1. 核对范围

本次变更涉及的全部 Java 文件（新增、修改、迁移），逐文件核对，不得抽样。

## 2. 强制核对清单

逐条打开并核对以下规范文件的**全部条款**（条款全文以文件为准）：

| # | 规范文件 | 核对重点 |
| --- | --- | --- |
| 1 | `.qoder/rules/comment-rules.md` | 类/方法 JavaDoc 完整性；核心业务逻辑「为什么」注释；方法内步骤分段 |
| 2 | `.qoder/rules/config-extraction-rules.md` | 可变值抽取边界（配置 vs 常量）；敏感信息硬编码；业务阈值配置化 |
| 3 | `.qoder/rules/constant-extraction-rules.md` | 魔法字符串/数字；枚举 code+desc 与 `of()` 工厂；Redis Key 统一生成；ORM 方法引用 |
| 4 | `.qoder/rules/exception-handling-rules.md` | 异常类型选择与文案；事务边界与外部调用；乐观锁行数校验；全局处理器不被绕过 |
| 5 | `.qoder/rules/logging-rules.md` | 入口入参/返回值打点；核心步骤打点；级别选择；占位符与 Throwable；敏感信息脱敏 |

## 3. 输出格式（强制）

对每条规范输出核对结论，禁止只给一句「已检查通过」：

- **通过**：`comment-rules：通过（核对 N 个文件）`
- **违规**：`exception-handling-rules：OrderServiceImpl.java:88 违反「事务内调用外部 API」→ 修复：改为 AFTER_COMMIT 事件`，修复后对该条重新核对

## 4. 完成判据

- 5 条规范全部核对完毕，且**无未修复违规项** → 方可宣告完成 / 提交。
- 存在未修复违规且用户未明确豁免 → 禁止宣告完成。
