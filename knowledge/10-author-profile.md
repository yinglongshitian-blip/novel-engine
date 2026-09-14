---
name: author-profile
description: 作者画像七维风格问卷。用七个维度把「想要的文风」量化为可执行参数，并通过 1-3 段旧文样本自动提取真实文风指纹，最终映射为 .novel/state/style-lock.json 的字段值，供文风锁校验与写作调用。
applies_to:
  - novel-architect
  - chapter-writer
  - review-agent
---

# 10 · 作者画像七维风格问卷

作者画像是「文风锁」的输入源。写作前先把作者想要的文风拆成七个可测量维度；写作后由脚本按这些维度校验是否漂移。本文件给出问卷、旧文样本自动分析法，以及画像到 `style-lock.json` 的映射规则。

核心原则：**画像不是感觉，是参数。** 每一维都必须落成可被脚本读取、可被 AI 复述的具体值。

---

## 一、七维风格问卷

七个维度彼此独立，各自回答「叙述方式」的一个侧面。每维三选一，选项中列在前的为常见默认。

| # | 维度 | 问题 | 选项 A | 选项 B | 选项 C |
|---|------|------|--------|--------|--------|
| 1 | 叙事距离 | 叙述离人物多近？ | 写实（贴身，进入人物感官与内心） | 写意（旁观，克制的外部视角） | 居中（在贴身与旁观之间切换） |
| 2 | 句法节奏 | 句子以什么节奏推进？ | 短句密集（拳拳到肉） | 长句连绵（一气呵成） | 混合（长短交错） |
| 3 | 感官密度 | 每段多少感官细节？ | 密集（五感全开） | 稀疏（视觉为主） | 适中（视/听/触为主） |
| 4 | 词汇层级 | 用词偏向什么层级？ | 口语（市井、生活化） | 书面（规范、文雅） | 文白夹杂（雅俗混用） |
| 5 | 比喻策略 | 比喻怎么用？ | 克制（点到为止） | 华丽（铺陈意象） | 不用（白描为主） |
| 6 | 情感表达 | 情绪怎么呈现？ | 直白（直接写情绪） | 含蓄（借景/借物） | 克制（行为呈现，不点破） |
| 7 | 对话比重 | 对话占多少？ | 高（40%+） | 中（25–35%） | 低（<20%） |

### 逐维说明与判定要点

**1. 叙事距离**
- 写实（贴身）：读者能读到人物的痛、痒、心跳；内心独白与身体感受占比高。适合爽文、代入感优先的作品。
- 写意（旁观）：叙述者退后，像镜头；冷静、留白多。适合群像、史诗感、悬疑。
- 居中：按场景切换——冲突场景贴身，过渡场景旁观。最常用。
- 影响：决定「内心戏」与「外部描写」的比例，也决定对话后是否跟内心反应。

**2. 句法节奏**
- 短句密集：平均句长通常 < 14 字，句长标准差偏大（长短对比强烈）。战斗、紧张段落首选。
- 长句连绵：平均句长 > 22 字，从句多，标点多用逗号与破折号。适合抒情、铺垫。
- 混合：平均句长 15–22 字，由内容自动调节。
- 影响：直接对应 `avg_sentence_len` 与 `avg_sentence_stddev_min`。

**3. 感官密度**
- 密集：每段至少 2–3 种感官（视/听/嗅/触/味），常用于「先体验后解释」的信息释放（见 09）。
- 稀疏：以视觉为主，偶有声音。适合快节奏、信息密集的章节。
- 适中：视/听/触三种为主，嗅/味点缀。

**4. 词汇层级**
- 口语：多用短促动词与生活化名词，允许俚语、语气词。
- 书面：用词规范，少用语气词，句式完整。
- 文白夹杂：叙述文雅、对话口语，形成反差（古风/仙侠常用）。

**5. 比喻策略**
- 克制：比喻词每千字 ≤ 2（与 `ai_flavor_check` 阈值一致），只在关键处用一次。
- 华丽：意象铺陈，比喻词每千字可 > 3，但需警惕 AI 味。
- 不用：纯白描，靠动作与细节说话。

**6. 情感表达**
- 直白：直接命名情绪（「他愤怒极了」）。
- 含蓄：借景/借物（「窗外的雨，下了一整夜」）。
- 克制（行为呈现）：只写行为与生理反应，让读者自行推断（「他握筷子的手，停了一下」）。三种中高级感最强，也最考验功力。

**7. 对话比重**
- 高（40%+）：对话推进剧情，适合轻喜剧、都市、日常。
- 中（25–35%）：对话与叙述均衡，最通用。
- 低（<20%）：以叙述与描写为主，适合史诗、氛围流。

> 七维问卷的结果先以「人类可读」形式记录，再在第四节映射为机器可读参数。

---

## 二、风格样本分析法

当作者提供 1–3 段旧文（每段建议 ≥ 800 字）时，AI 不再依赖主观自述，而是从真实文本中提取「文风指纹」，与问卷结果交叉验证。若两者冲突，以**样本提取值为准**（旧文是真实行为，问卷是主观意愿）。

### 2.1 提取流程

1. **收集样本**：接受 1–3 个 `.md` / `.txt` 文件，或用户直接粘贴的文本。记录 `samples_analyzed` 与 `total_chars`。
2. **切句**：按 `[。！？!?…]+` 切分句子（与 `style_drift_check.py` 一致），得到句长列表。
3. **统计句法**：计算平均句长、句长标准差、句长分布分桶（≤8 / 9–20 / 21–35 / >35）。
4. **统计对话**：用 `[「『“"][^」』”"]*[」』”"]` 提取引号内文本，计算对话字符数 / 总字符数（去空白）。
5. **统计比喻**：统计比喻词（仿佛/宛如/如同/好似/犹如/恍若）出现次数，换算为每千字密度。
6. **统计感官**：按感官词库（看/听/闻/尝/触类动词与名词）统计每段感官细节数量，归一化为 0–1 的 `sensory_density`。
7. **判定情感呈现**：统计三类信号占比——直接情绪词（愤怒/悲伤/高兴）、借景借物句（以景物结尾/承接）、行为呈现句（动作 + 生理反应）。
8. **提取高频词指纹**：统计实词频次，取 Top 10 作为 `high_freq_words`（反映作者的「口头禅」）。
9. **AI 味交叉检查**：调用 `ai_flavor_check.analyze()`，得到 `metaphor_per_1k` 与 `ai_word_count`，作为负向指标。
10. **反推画像**：依据统计值反推七维选择，输出 `inferred_profile`，并生成 `style_lock_draft`。

### 2.2 阈值参考（用于反推七维）

| 统计量 | 写实/短句 | 居中/混合 | 写意/长句 |
|--------|-----------|-----------|-----------|
| `avg_sentence_len` | < 14 | 15–22 | > 22 |
| `sentence_stddev` | > 6（长短对比强） | 3–6 | < 3（句长均匀） |
| `dialogue_ratio` | 高 > 0.40 | 中 0.25–0.35 | 低 < 0.20 |
| `metaphor_per_1k` | 不用 ≈ 0 | 克制 ≤ 2 | 华丽 > 3 |
| `sensory_density` | 稀疏 < 0.35 | 适中 0.35–0.6 | 密集 > 0.6 |
| `emotion_presentation.behavioral` | — | 主导 | — |

### 2.3 输出格式（JSON）

分析结果以 JSON 落盘，供 `style-lock.json` 生成与人工复核：

```json
{
  "status": "success",
  "samples_analyzed": 2,
  "total_chars": 4200,
  "metrics": {
    "avg_sentence_len": 15.3,
    "sentence_stddev": 6.2,
    "sentence_len_distribution": {
      "le_8": 0.31,
      "9_to_20": 0.44,
      "21_to_35": 0.19,
      "gt_35": 0.06
    },
    "dialogue_ratio": 0.34,
    "metaphor_count": 11,
    "metaphor_per_1k": 2.62,
    "sensory_density": 0.62,
    "emotion_presentation": {
      "direct": 0.20,
      "implicit": 0.35,
      "behavioral": 0.45
    },
    "high_freq_words": [
      { "word": "沉声", "count": 7 },
      { "word": "冷笑", "count": 5 },
      { "word": "沉默", "count": 4 }
    ],
    "ai_word_hits": 3,
    "avg_paragraph_len": 62
  },
  "inferred_profile": {
    "narrative_distance": "close",
    "syntax_rhythm": "mixed",
    "sensory_density": "dense",
    "vocabulary_level": "mixed",
    "metaphor_strategy": "restrained",
    "emotion_mode": "behavioral",
    "dialogue_ratio_band": "medium"
  },
  "style_lock_draft": {
    "avg_sentence_len": 15.3,
    "avg_sentence_stddev_min": 5.5,
    "dialogue_ratio": 0.34,
    "metaphor_per_1k": 2.6,
    "sensory_density": "dense",
    "narrative_distance": "close",
    "vocabulary_level": "mixed",
    "emotion_mode": "behavioral"
  }
}
```

> 冲突处理：若问卷结果与 `inferred_profile` 不一致，AI 必须向作者指出差异（例如「你选了长句连绵，但旧文平均句长只有 12 字」），由作者决定最终取值。样本提取值作为 `style-lock.json` 的默认基线。

---

## 三、三个核心问题

七维问卷解决「怎么写」，三个核心问题解决「为什么写」。答案不进入数值参数，但决定文风锁的「上限」——同样的参数，不同意图会导出不同的取舍。

1. **你希望你的文字听起来像什么？**
   - 目的：捕捉质感隐喻（如「像老式收音机里的旁白」「像冬天呵出的白气」）。
   - 用法：写入 `style-lock.json` 的 `voice_metaphor` 字段，供 chapter-writer 作为整体语调锚点。

2. **作为作者，你最容易被忽略的是什么？**
   - 目的：找出作者自己看不见的盲区（如「我总是忘记写环境」「我从不写人物外貌」）。
   - 用法：写入 `style-lock.json` 的 `author_blind_spots` 数组，review-agent 在审查时重点检查这些项。

3. **你希望通过这个故事表达什么？**
   - 目的：确立主题与情感内核，防止文风为「炫技」服务。
   - 用法：写入 `style-lock.json` 的 `theme_intent`，在情节与人物动机偏离主题时提醒。

---

## 四、作者画像 → 文风锁参数映射表

七维问卷与样本分析的最终产物，是 `.novel/state/style-lock.json`。该文件被 `review_engine.py`（第 5 维文风规则）、`style_drift_check.py`、`ai_flavor_check.py` 读取。

### 4.1 映射表

| 七维结果 | style-lock.json 字段 | 取值示例 | 被哪个脚本/维度使用 |
|----------|----------------------|----------|---------------------|
| 句法节奏 | `avg_sentence_len` | 12.0 / 18.0 / 24.0 | `style_drift_check` 基线；`review_engine` 第 5 维 |
| 句法节奏 | `avg_sentence_stddev_min` | 2.5 / 3.0 / 4.5 | `review_engine` 第 15 维（节奏失衡） |
| 对话比重 | `dialogue_ratio` | 0.42 / 0.30 / 0.15 | `review_engine` 第 5、13 维；`style_drift_check` |
| 比喻策略 | `metaphor_per_1k` | 0.0 / 2.0 / 3.5 | `ai_flavor_check` 阈值参考；`review_engine` 第 6 维 |
| 感官密度 | `sensory_density` | `"sparse"` / `"moderate"` / `"dense"` | chapter-writer 写作提示 |
| 叙事距离 | `narrative_distance` | `"close"` / `"medium"` / `"far"` | chapter-writer 写作提示 |
| 词汇层级 | `vocabulary_level` | `"colloquial"` / `"mixed"` / `"literary"` | chapter-writer 写作提示 |
| 情感表达 | `emotion_mode` | `"direct"` / `"implicit"` / `"behavioral"` | chapter-writer、review-agent |
| 比喻/词汇 | `ai_words_blacklist` | `["深深","缓缓","淡淡",...]` | `ai_flavor_check` 补充黑名单 |
| 核心问题 1 | `voice_metaphor` | `"像冬天呵出的白气"` | chapter-writer 语调锚点 |
| 核心问题 2 | `author_blind_spots` | `["环境描写","人物外貌"]` | review-agent 重点检查项 |
| 核心问题 3 | `theme_intent` | `"小人物在乱世里守住底线"` | novel-architect / outline-agent |
| 全维溯源 | `author_profile` | 七维原始选择对象 | 全流程溯源 |

### 4.2 style-lock.json 完整示例

```json
{
  "avg_sentence_len": 15.3,
  "avg_sentence_stddev_min": 5.5,
  "dialogue_ratio": 0.34,
  "metaphor_per_1k": 2.6,
  "sensory_density": "dense",
  "narrative_distance": "close",
  "vocabulary_level": "mixed",
  "emotion_mode": "behavioral",
  "ai_words_blacklist": ["深深", "缓缓", "淡淡", "不禁", "竟然", "瞬间"],
  "voice_metaphor": "像冬天呵出的白气，冷，但看得见温度",
  "author_blind_spots": ["环境描写", "人物外貌"],
  "theme_intent": "小人物在乱世里守住底线",
  "author_profile": {
    "narrative_distance": "close",
    "syntax_rhythm": "mixed",
    "sensory_density": "dense",
    "vocabulary_level": "mixed",
    "metaphor_strategy": "restrained",
    "emotion_mode": "behavioral",
    "dialogue_ratio_band": "medium"
  }
}
```

> 注意：`style_drift_check.py` 使用 `baseline.update(cfg)` 合并配置，因此上述字段中 `avg_sentence_len` / `dialogue_ratio` / `avg_sentence_stddev_min` 为脚本强相关字段，其余为 agent 扩展字段。缺失字段将回退到 `DEFAULT_BASELINE`（18.0 / 0.30 / 3.0）。

### 4.3 生成流程小结

1. 作者填写七维问卷（第一节）。
2. 若提供旧文样本，执行第二节分析，得到 `inferred_profile`。
3. 交叉验证，冲突以样本为准并提示作者确认。
4. 回答三个核心问题（第三节）。
5. 按第四节映射表生成 `style-lock.json`，写入 `.novel/state/`。
6. 写作过程中，`review_engine` 第 5 维与 `style_drift_check` 按该文件持续校验漂移。
