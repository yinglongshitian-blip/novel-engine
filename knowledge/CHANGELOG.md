# 知识库变更日志（knowledge/CHANGELOG.md）

> 每次更新 `knowledge/` 下的模块时，在此登记版本号与日期。
> 已写章节不追溯修改；新章节按新版规则执行。

## v1.3 — 2026-09-14
- 新增模块 16：`16-book-summary.md`（书籍简介生成规则）。
- 新增 `data/work-scales.json`（短/中/长三档结构规模 + 节奏策略）。

## v1.2 — 2026-09-14
- 新增知识库版本管理机制（见 `README.md`「知识库版本管理」）。
- 新增 `scripts/knowledge_consistency_check.py`，自动校验 md ↔ json 一致。

## v1.1 — 2026-09-14
- 修复：`12-character-card.md` 删除重复性格词库，改为引用 `06-personalities.md`。
- 修复：`data/genres.json` 疲劳词与 `02-genres.md` 逐条同步（7 处修正）。
- 修复：`02-genres.md` 附表1 补全为 21 类题材 + 通用词。
- 新增：五个库的「自定义出口」机制（题材/套路/金手指/文风/性格）。

## v1.0 — 2026-09-14
- 初始 15 个知识模块（01-story-contract ~ 15-whitelist）。
- 机器可读层 `data/`：genres.json / styles.json / personalities.json / ai-words.json。
