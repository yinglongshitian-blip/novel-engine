# 知识库索引（knowledge/）

小说创作引擎的 16 个知识库模块。每个模块为独立 Markdown 文档，供对应 Skill / Agent 加载；
其中可机器消费的部分另在 `data/` 下提供 JSON 版本，供 `scripts/*.py` 直接读取。

## 模块清单

| # | 文件 | 内容 | 主要消费者 | JSON |
|---|------|------|-----------|------|
| 1 | `01-story-contract.md` | 故事合约模板（世界观硬规则/角色红线/文风铁律） | novel-architect | — |
| 2 | `02-genres.md` | 21 类题材库 + 疲劳词表 + 专属审查维度 | outline-agent / review-agent | `data/genres.json` |
| 3 | `03-tropes.md` | 20 种套路库（含碰撞来源） | deduction-agent / outline-agent | — |
| 4 | `04-golden-fingers.md` | 15 种金手指库（含行动线影响） | deduction-agent | — |
| 5 | `05-writing-styles.md` | 24 种文风执行对照表 + 温度 | chapter-writer | `data/styles.json` |
| 6 | `06-personalities.md` | 14 种性格词库 + 五维 DNA | chapter-writer | `data/personalities.json` |
| 7 | `07-prose-principles.md` | 正文思维 4 原则 + 11 执行规则 | chapter-writer | — |
| 8 | `08-ai-words.md` | 去 AI 化 8 类高频词表 | chapter-writer / review-agent | `data/ai-words.json` |
| 9 | `09-info-release.md` | 信息释放六条铁律 | novel-core / outline-agent | — |
| 10 | `10-author-profile.md` | 作者画像七维问卷 + 样本分析 | novel-architect | — |
| 11 | `11-comparison-engine.md` | 深度比较引擎（10 维 + 4 模式） | review-agent | — |
| 12 | `12-character-card.md` | 角色卡完整模板（17 字段） | deduction-agent | — |
| 13 | `13-foreshadow-rules.md` | 伏笔管理（7 态 + 3 硬约束） | novel-utils / script | — |
| 14 | `14-reader-perspective.md` | 读者视角测试（6 项） | review-agent | — |
| 15 | `15-whitelist.md` | 审查白名单机制 | review-agent / script | — |
| 16 | `16-book-summary.md` | 书籍简介生成规则（三段式 + 11 铁律 + 三大雷区） | novel-architect / review-agent | — |

## 机器可读层（`data/`）

| 文件 | 用途 | 消费者 |
|------|------|--------|
| `data/genres.json` | 21 题材的疲劳词 + 专属审查维度 | `ai_flavor_check.py` / `review_engine.py` |
| `data/ai-words.json` | 8 类高频词 + 比喻词 + 阈值 | `ai_flavor_check.py` |
| `data/styles.json` | 24 文风参数 + style-lock 默认值 | `style_drift_check.py` / 作者画像 |
| `data/personalities.json` | 14 性格 + 五维 DNA 维度 | 角色卡 |
| `data/work-scales.json` | 短/中/长三档结构规模 + 节奏策略 + 审查/加载/伏笔开关 | `init_project.py` / 各 Agent |

## 加载方式

- **Agent/Skill（LLM 读取）**：各 Skill/Agent 在需要时读取对应 `.md` 全文。
- **脚本（程序读取）**：`scripts/knowledge_loader.py` 提供
  `load_ai_words()` / `load_genres()` / `load_styles()` / `load_personalities()` /
  `genre_entry(novel_dir)` / `genre_fatigue_words(novel_dir)` / `load_whitelist(novel_dir)`。

## 自定义出口统一规则

五个知识库（题材/套路/金手指/文风/性格）均支持自定义出口。用户提出预设外需求时，按统一流程处理。

### 统一流程

1. **用户提出需求**：一句话描述新题材/套路/金手指/文风/性格。
2. **AI 匹配基线**：从预设库中找出最接近的 1–2 个条目作为结构基线。
3. **AI 逐项推导**：按该库的固定字段结构，逐项推导内容，每项标注来源：
   - 「基于【预设库：XXX】迁移」
   - 「基于【用户原话：XXX】」
   - 「AI 补充推导」
4. **AI 输出推导结果**：以表格形式展示，用户可逐项确认或修改。
5. **用户确认后写入状态**：写入对应的状态文件，标注为「自定义」。
6. **后续审查按新规则执行**：与预设条目同等待遇。

### 五条硬约束

1. **必须标注来源**：每条推导结果必须标注是迁移、用户原话还是 AI 补充。
2. **必须完整**：不能只给名字不给参数（如自定义文风必须给出对话占比数值）。
3. **必须逐项确认**：AI 不能推完就直接用，必须等用户逐项确认。
4. **必须写盘**：自定义条目写入状态文件，后续所有审查按新规则执行。
5. **必须标注「自定义」**：便于后续区分预设与自定义。

### 五个库的自定义出口入口

| 库 | 用户提供 | AI 推导字段 | 详见 |
|----|---------|------------|------|
| 题材 | 一句话描述新题材 | 六字段（见下） | `02-genres.md` 自定义章节 |
| 套路 | 一句话描述新套路 | 五字段（见下） | `03-tropes.md` 自定义章节 |
| 金手指 | 一句话描述新能力 | 四字段（见下） | `04-golden-fingers.md` 自定义章节 |
| 文风 | 参考文本或描述 | 六参数 + style-lock | `05-writing-styles.md` 自定义章节 |
| 性格 | 一句话描述角色性格 | 四字段（见下） | `06-personalities.md` 自定义章节 |

### 自定义条目的状态文件

| 库 | 写入文件 |
|----|----------|
| 题材 | `.novel/state/custom-genres.json` |
| 套路 | `.novel/state/custom-tropes.json` |
| 金手指 | `.novel/state/custom-golden-fingers.json` |
| 文风 | `.novel/state/style-lock.json`（+ `author_profile` 标注自定义文风名） |
| 性格 | `.novel/state/custom-personalities.json` |

## 知识库版本管理

- 每次更新 `knowledge/` 下的模块时，在对应文件顶部记录版本号与更新日期。
- 已写章节不追溯修改；新章节按新版规则执行。
- 版本变更记入 `knowledge/CHANGELOG.md`。
- md ↔ json 一致性由 `scripts/knowledge_consistency_check.py` 自动校验（0 不一致，退出码 0）。

## 运行期用户文件

| 文件 | 用途 |
|------|------|
| `.novel/history/whitelist.md` | 审查白名单（用户维护，见模块 15） |
| `.novel/history/contract-warnings.md` | 故事合约软提醒历史（见模块 1） |
| `.novel/state/style-lock.json` | 文风锁参数（见模块 5 附表） |
| `.novel/state/world-rules.json` | 世界观硬规则（见模块 1 区块 A） |
