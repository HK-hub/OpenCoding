# 归档区（archive）

本目录保存**已被取代的早期草案**。归档文件不再具备约束力，仅为逐字溯源与内容保全而保留。

| 归档文件 | 原文件名 | 取代者（唯一权威） | 说明 |
| --- | --- | --- | --- |
| `34-automation-playbooks.superseded.md` | `34-automation-playbooks.md` | `../34-automation-templates.md` | 早期草案（D-AUTO-1…10，13 字段模板结构）；独有内容（字段表、YAML 示例、12 模板清单、权限约束、早期事件命名）已提取并合并至卷 34 文末附录「既有草稿决策对齐」 |
| `35-ai-enhancements.superseded.md` | `35-ai-enhancements.md` | `../35-intelligent-augmentation.md` | 早期草案（D-AI-0…12，12 项特性清单）；共性约束表（逐字）、决策表与映射已合并至卷 35 文末附录「既有草稿决策对齐」 |

## 保留原因

- 两份草案含权威卷附录未逐字重复的原始表述（模板结构 13 字段表、YAML 示例、12 模板清单、共性约束表、早期事件与指标命名等），原文保留以便逐字对照与审计回溯。
- 不删除是硬约束：合并以「提取 + 归档」方式进行，**无内容丢失**。

## 使用规则

- 实现、评审与提交一律以权威卷为准：`docs/harness/34-automation-templates.md` 与 `docs/harness/35-intelligent-augmentation.md`；本目录内容**不得作为契约引用**，不得被其他卷 / 实现文档作为来源链接。
- 卷号 34/35 已被权威卷占用，归档文件带 `.superseded` 后缀，禁止复用原文件名。
- 后续增量一律写入权威卷；如需引用草案独有内容，引用权威卷附录对应小节。
