# 小说创作引擎 v5.3

多 Agent 网文创作流水线：**推演 → 大纲 → 卷纲 → 章纲 → 正文 → 审查 → 交付**。
以「网状结构（碰撞网）」为核心模型：多条行动线持续碰撞，主线 = 主角行动线 + 碰撞点串联。

---

## 一、快速开始

```bash
# 1. 运行验收测试（V-01 ~ V-12）
node tests/run-tests.js

# 2. 运行端到端流水线（生成第1章 + 审查报告）
node tests/e2e.js

# 3. 或直接用 npm 脚本
npm test
npm run e2e
npm run verify
```

依赖：Node.js ≥ 18、Python ≥ 3.8（仅标准库，无第三方依赖）。

在 OpenCode 中使用：项目根 `opencode.json` 已将 `novel-architect` 设为默认 Agent，
并注册 7 个子 Agent。直接对 OpenCode 说「写一部小说」即可进入流水线。

**多项目：一本书 = 一个项目目录（推荐做法）。** 在同一目录开两本书会串状态。
如需同目录多书，主 Agent 的 `<project-detection>` 会创建 `.novel/books/{书名}/` 并维护 `.novel/active-book.json`。

---

## 二、目录结构

```
novel-engine/
├── opencode.json                 # Agent / Skill 权限配置
├── .opencode/
│   ├── agents/                   # 7 个 Agent 定义
│   │   ├── novel-architect.md    #   主调度（primary）
│   │   ├── deduction-agent.md    #   推演（只读）
│   │   ├── outline-agent.md      #   大纲/卷纲/章纲
│   │   ├── chapter-writer.md     #   正文生成
│   │   ├── review-agent.md       #   独立审查（只读）
│   │   ├── script-runner.md      #   脚本调用
│   │   └── character-tracker.md  #   角色追踪
│   └── skills/                   # 5 个 Skill
│       ├── novel-core/           #   核心认知（碰撞网）
│       ├── novel-deduction/      #   推演铁律
│       ├── novel-outline/        #   碰撞网大纲
│       ├── novel-chapter/        #   正文 + 18维审查
│       └── novel-utils/          #   状态/快照/决策轨迹
├── scripts/                      # 14 个 Python 脚本 + 2 个共享库（_common / knowledge_loader）
├── knowledge/                    # 15 个知识库模块（内容）
│   ├── 01-story-contract.md … 15-whitelist.md
│   └── data/                     # 机器可读层（genres/ai-words/styles/personalities .json）
├── src/                          # 3 个 Node 核心模块
│   ├── state-manager.js          #   状态读写（原子写）
│   ├── pause-manager.js          #   6 个暂停点
│   └── script-invoker.js         #   脚本调用封装
├── tests/                        # 验收测试 + 端到端
├── samples/                      # 示例项目
└── .novel/                       # 运行时状态（项目实例化后生成）
```

## 二之二、知识库（knowledge/）

15 个内容模块，供 Skill / Agent 加载；可机器消费的部分另在 `knowledge/data/` 提供 JSON。

| # | 模块 | 内容 |
|---|------|------|
| 1 | 故事合约 | 世界观硬规则 / 角色红线 / 文风铁律 |
| 2 | 21 类题材库 | 每类含世界观/红线/语言铁律/节奏/禁忌/疲劳词 + 审查维度 |
| 3 | 20 种套路库 | 起始/驱动/推进/高潮 + 碰撞来源 |
| 4 | 15 种金手指库 | 规则/成长/禁忌 + 行动线影响 |
| 5 | 24 种文风对照表 | 句式/对话占比/用词/节奏/范例/温度 |
| 6 | 14 种性格词库 | 行为特征/对话表现/OOC 陷阱 |
| 7 | 正文思维 | 4 原则 + 11 执行规则 |
| 8 | 去 AI 化词表 | 8 类高频词 + 阈值 |
| 9 | 信息释放 | 六条铁律 |
| 10 | 作者画像 | 七维问卷 + 样本分析 |
| 11 | 深度比较引擎 | 10 维度 + 4 模式 |
| 12 | 角色卡模板 | 17 字段 + 行动线/碰撞对象 |
| 13 | 伏笔管理 | 7 态 + 3 硬约束 + 4 步自检 |
| 14 | 读者视角测试 | 6 项 |
| 15 | 审查白名单 | 用户维护机制 |

**已接入脚本**：`ai_flavor_check.py` 读取 `ai-words.json` + 题材疲劳词 + 白名单；
`review_engine.py` 追加题材专属审查维度（`genre_dims`）；`style_drift_check.py` 读取 `styles.json` 默认基线；
`knowledge_loader.py` 统一加载。
运行期用户文件：`.novel/history/whitelist.md`、`.novel/state/style-lock.json`、`.novel/state/world-rules.json`。

**自定义出口机制**：五个库（题材/套路/金手指/文风/性格）均支持预设外需求。
统一流程见 `knowledge/README.md`「自定义出口统一规则」——用户给方向 → AI 匹配基线 → 逐项推导（标注来源）→ 用户逐项确认 → 写入 `.novel/state/custom-*.json`。
各库细则见对应模块的「自定义 XX 处理」章节；主 Agent 在立项阶段（步骤 3.5）自动检查是否需走自定义出口。

---

## 三、工作流（5 阶段）

| 阶段 | 负责 Agent | 产出 | 暂停点 |
|------|-----------|------|--------|
| 1 初始化 | novel-architect | 问卷立项、世界观 | **P1 世界观** |
| 2 创意层 | deduction-agent | 行动线、碰撞点 | **P2 推演**（逐条） |
| 3 规划层 | outline-agent | 主线节点、卷纲 | **P3 大纲** / **P4 卷纲** |
| 4 写作层 | chapter-writer → review-agent | 正文、审查报告 | **P5 审查** / **P6 批量** |
| 5 完结 | novel-architect | 复盘、合并导出 | — |

写作层循环：`章纲 → 正文 → 18维审查 →（不合格打回重写，最多3次）→ 脚本 → 更新状态`。
用户说「连写 N 章」时跳过逐章暂停，连续执行 N 章后进入 **P6** 统一交付。

---

## 四、六个暂停点

| 暂停点 | 触发时机 | 用户操作 |
|--------|----------|----------|
| P1 世界观 | 问卷立项完成后 | 确认 / 修改 |
| P2 推演 | deduction-agent 输出每条行动线后 | 逐条确认 |
| P3 大纲 | outline-agent 输出主线节点后 | 确认 / 修改 |
| P4 卷纲 | 卷纲生成后 | 确认 / 修改 |
| P5 审查 | review-agent 发现 🟡 及以上问题 | 修正 / 忽略继续 |
| P6 批量 | 连写 N 章完成后 | 统一确认 |

暂停点定义在 `src/pause-manager.js`，由主 Agent 转达用户后等待裁决。

---

## 五、14 个 Python 脚本（+ 共享库）

| 脚本 | 功能 |
|------|------|
| word_counter.py | 统计字数 |
| foreshadow_tracker.py | 伏笔检查（7态） |
| style_drift_check.py | 文风漂移 |
| character_tracker.py | 角色出场统计 |
| chapter_cut_check.py | 断章钩子强度 |
| validate_character.py | 角色行为红线 |
| outline_sync_check.py | 大纲/卷纲同步 |
| merge_chapters.py | 合并导出（`--output` 相对项目目录，越界拒绝） |
| collision_density_check.py | 碰撞密度（连续3章无碰撞告警） |
| ai_flavor_check.py | AI味检测（比喻词/AI高频词） |
| consistency_check.py | 跨状态文件一致性 |
| **review_engine.py** | **18维审查脚本化引擎（automated 4 + heuristic 9 + llm_required 5）** |
| init_project.py | 项目初始化 |
| snapshot_manager.py | 快照 save/restore（含 snapshot.json sidecar 真正回写） |

`_common.py`（通用工具）与 `knowledge_loader.py`（知识库加载）为**共享库**，
被各脚本 `from ... import ...` 复用，消除重复实现，不计入脚本数（`listScripts` 自动排除）。

所有脚本输出结构化 JSON 到 stdout，由 `script-invoker.js` 解析为 `{ status, data }`。

## 五之二、18 维审查的脚本化程度

`review_engine.py` 将 18 个审查维度按可自动化程度分为三类：

| method | 数量 | 维度 |
|--------|------|------|
| `automated` | 4 | 碰撞网对齐 / 去AI化 / 伏笔连贯性 / 碰撞密度 |
| `heuristic` | 9 | 世界观 / 金手指 / 人物红线 / 文风 / 时间线 / 台词 / 节奏 / 数值 / 角色主动性 |
| `llm_required` | 5 | 信息越界 / 战力崩坏 / 配角降智 / 利益链断裂 / 爽点虚化 |

`review-agent` 先跑该脚本，采纳 automated、复核 heuristic、补齐 llm_required，
合并为最终审查报告。13/18 维有脚本化支撑，其余 5 维如实标注需 LLM 语义判断。

## 五之三、模型配置

模型集中在 `opencode.json` 的 `agent.<name>.model`（**单一事实来源**），
Agent 定义文件的 frontmatter 不再硬编码模型，避免与实际可用模型漂移。

```jsonc
"novel-architect": { "model": "deepseek/deepseek-v4-flash", ... }
```

当前默认 `deepseek/deepseek-v4-flash`（本环境唯一已配置 provider）。
如需按档位分配更强模型，只需修改 `opencode.json` 中对应 agent 的 `model` 字段，
例如将创作/写作类 Agent 指向推理模型、分析类指向通用模型。

---

## 六、状态管理

项目实例化后在 `.novel/` 下维护：

- `state/` — 7 个 JSON 状态文件（项目/行动线/碰撞点/伏笔/角色/章节摘要/决策轨迹）
- `chapters/` — 章节正文与章纲
- `outline.md` / `volume.md` — 主线大纲与卷纲
- `snapshot.md` — 跨会话续写快照
- `reviews/` — 审查报告

**决策轨迹只追加不覆盖**；写入采用**原子写**（临时文件 → 重命名）。
快照保存时同时写出人类可读 `snapshot.md` 与机器可读 `snapshot.json`（sidecar）；
`snapshot_manager.py restore` 会依据 sidecar **真正回写**缺失或损坏（含 `__corrupt` 标记）的状态文件。

---

## 七、18 维审查

- 基础 6 维：世界观一致性 / 碰撞网对齐 / 金手指符合性 / 人物性格一致性 / 文风规则 / 去AI化
- 高级 10 维：时间线 / 伏笔连贯性 / 信息越界 / 战力崩坏 / 配角降智 / 利益链断裂 / 台词失真 / 爽点虚化 / 节奏失衡 / 数值细节
- 新增 2 维：碰撞密度 / 角色主动性

外加 AI 味六层面检测：词汇层 / 句式层 / 结构层 / 格式层。
其中 13/18 维由 `review_engine.py` 脚本化判定，5 维标注为需 LLM 语义判断（详见第五之二节）。

---

## 八、验收

`node tests/run-tests.js` 覆盖功能验收 **V-01 ~ V-12**、**V-08b / V-11b**、**C-01 脚本契约**、
**S-01 ~ S-10 安全回归**、**K-01 ~ K-10 知识库/自定义出口**、**v5.1-A ~ I 23+ 项补全**、**N-01 ~ N-05 安全加固**与 **v5.3-A ~ D 篇幅分类/书籍简介/字段修正**，共 **51 项断言，全部通过**。
`node tests/e2e.js` 演示从问卷到第1章交付的完整链路，审查报告由 `review_engine.py` 生成，退出码 0。

## 九、安全模型

本项目是**本地 CLI/编排工具**（无网络服务、无密钥）。已实施以下加固（对应独立安全审查 S-1 ~ S-12）：

| 面 | 加固 |
|----|------|
| 脚本调用 | `executeScript` 拒绝绝对路径 / `..` 穿越 / 非 `.py`，解析后必须落在 `scripts/` 内 |
| 写入基目录 | `merge_chapters` / `snapshot_manager` / `init_project` 的写入基目录必须位于 cwd 或系统临时目录内（`_common.safe_base_dir`，跨盘安全）|
| 快照恢复 | `restore` 仅接受 `STATE_FILES` 白名单键，越界键进入 `rejected`，不写盘 |
| 合并导出 | `--output` 必须位于项目目录内，越界拒绝 |
| 知识库加载 | `knowledge_loader.data_path` 限定在 `knowledge/data/` 内，拒绝越界 |
| 白名单 | 支持 `#exact` / `#check=` 标记；单条 ≤100 字、总数 ≤200，防「整章加白」使检测失效 |
| 自定义题材 | `custom-genres.json` 已接入 `genre_entry` / 疲劳词 / 审查维度 |
| 权限模型 | `opencode.json` 为唯一权限来源；各 agent 的 bash 使用 `"*": "deny"` + `"python scripts/*": "allow"`；`write`/`edit` 限定 `.novel/**`；agent 不能改写 `.opencode/**` 或 `opencode.json` |
| 提示注入 | 小说素材与**衍生规则文件**（`custom-*.json` / `story-contract.md` / `backup-settings.json` / `.novel/history/*`）视为不可信数据，绝不作为指令执行；工具参数不得直接取自素材 |
| 健壮性 | 畸形状态文件返回结构化错误（无 traceback）；`NUM_RE` 有界量词消除二次回溯；章节扫描上限 5000 文件 |

**已知边界**：无网络暴露面；无密钥；`spawnSync` 不使用 shell（无命令注入）。残余风险仅限本地
受信操作者场景下的纵深防御项（如 `PYTHON` 环境变量可覆盖解释器、临时文件名可预测）。

## 十、v5.1 新增功能（23 项）

| 类别 | 功能 |
|------|------|
| 上下文管理 | 跨话题恢复简报 · 状态分级加载 · 章节摘要压缩 · 动态上下文提示 |
| 多项目 | 项目检测（一书一目录）· 快照书名校验 · 同目录多书切换 |
| 状态一致性 | 写入权限矩阵 · 状态回滚 · 版本升级迁移 · 快照定位 |
| 立项流程 | 四部分立项问卷（核心问题 / 参数偏好 / 故事合约 / 作者画像）|
| 写作控制 | 四种写作模式 · 字数目标与停章标准 · **无章节模式** |
| 编辑操作 | 修改影响分析 · 撤回（含状态回滚）· 备用设定管理 |
| 交互规范 | 输出五层分离 · 用户控制入口 · 进度显示 · 指令路由表（含同义表达）|
| 生成参数 | 温度/频率惩罚/存在惩罚（AI 可微调，用户可覆盖）|
| 章节规范 | 章节标题生成规则（第X章 + 悬念式短语，含冲突处理）|
| 角色系统 | 多主角适配（副线 / 视角 / 戏份平衡）|
| 质量闭环 | 审查问题跨章追踪（连续 N 章同类问题告警）|
| 用户引导 | 首次使用引导 · 快速试写模式 |
| 状态同步 | 章节提交三件套（正文入档 + 摘要写入 + 状态更新）|
| 容错边界 | 系统容错完整清单（11 种异常场景）|
| 收尾输出 | 全书复盘报告格式（六节）|
| 知识库维护 | 版本管理（`knowledge/CHANGELOG.md`）· md/json 一致性校验脚本 |

详见 `.opencode/agents/novel-architect.md` 与 `novel-utils` / `novel-chapter` / `novel-outline` Skill。

## 十一、v5.3 新增功能

**核心原则：创意层三层通用；写作层按篇幅分流。篇幅分类依据是「节奏哲学」，不是形态参数。**

### 篇幅分类（work_scale）

立项第一问确定篇幅，自动填充 `structure` + `rhythm`（配置见 `knowledge/data/work-scales.json`）：

| 档位 | 字数 | 章节 | 节奏策略 | 方法论内核 |
|------|------|------|----------|-----------|
| 短篇 short | 1-3 万 | 3-8 章 | 跨越式 | 横断面 + 一击即中 |
| 中篇 medium | 3-10 万 | 10-30 章 | 螺旋式 | 针的尖锐 + 山的面积 |
| 长篇 long | 10 万+ | 50-200 章 | 三档制 | 优雅从容 + 四段式 |

写作层按篇幅分流：结构规模 / 节奏策略 / 审查维度 / 分级加载 / 摘要压缩 / 快照 / 伏笔管理。
支持中途改篇幅（输出影响分析 + 重新生成未写部分）。

### 书籍简介自动生成

全书最后一章确认后自动生成 200-300 字简介到 `.novel/summary.md`。
**简介是诱饵不是摘要**：三段式（身份困境 / 核心卖点三句话快剪 / 结果），11 条铁律 + 三大雷区 + 自检清单。
详见 `knowledge/16-book-summary.md`。
