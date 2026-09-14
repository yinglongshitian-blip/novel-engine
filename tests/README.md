# 测试用例覆盖说明（tests/）

运行方式：

```bash
node tests/run-tests.js    # 验收 + 安全 + 知识库 + v5.1 回归
node tests/e2e.js          # 端到端流水线
npm run verify             # 两者都跑
```

## 覆盖矩阵

| 测试类别 | 覆盖场景 | 对应断言 |
|----------|----------|----------|
| **功能验收** | 目录创建 / 问卷 / 推演 / 大纲 / 章纲 / 脚本 / 18维 / 暂停点 / 连写 / 续写 / 决策轨迹 | V-01 ~ V-12、V-08b、V-11b |
| **预设库内** | 21 题材 / 20 套路 / 15 金手指 / 24 文风 / 14 性格 | K-02、K-10 |
| **预设库外** | 自定义题材 / 套路 / 金手指 / 文风 / 性格（触发自定义出口） | K-07、K-10、N-05 |
| **知识库完整性** | 15 模块存在 + frontmatter、md↔json 一致 | K-01、K-06、K-08、K-09 |
| **脚本契约** | 全部可执行脚本输出约定 JSON 字段 | C-01 |
| **写作模式** | 逐章 / 阶段性 / 连写N章 / 全书自动 | v5.1-B |
| **上下文管理** | 跨话题恢复 / 分级加载 / 摘要压缩 / 动态上下文提示 | v5.1-A |
| **编辑操作** | 修改影响分析 / 撤回（含状态回滚）/ 备用设定 | v5.1-C |
| **交互规范** | 输出五层 / 用户控制 / 进度显示 / 指令路由 | v5.1-D |
| **章节规范/角色系统** | 标题规则 / 多主角 / 质量闭环 | v5.1-E |
| **用户引导/状态同步/容错/复盘** | 首次引导 / 快速试写 / 提交三件套 / 容错清单 / 复盘格式 | v5.1-F |
| **参数化与编号** | 阈值参数化、章节编号重排、交叉引用同步 | v5.1-G |
| **安全** | 脚本路径约束 / 快照越界 / 权限矩阵 / ReDoS / 畸形状态 | S-01 ~ S-10 |
| **安全加固（v5.1）** | 写入基目录 / data_path 越界 / 白名单标记与截断 / 自定义题材接线 | N-01 ~ N-05 |
| **篇幅分类（v5.3）** | 短/中/长三档、结构/节奏自动填充、按篇幅分流（审查/加载/伏笔）、中途改篇幅 | v5.3-A、v5.3-B |
| **书籍简介（v5.3）** | 三段式结构、11 铁律、三大雷区、自检清单 | v5.3-C |
| **端到端** | 问卷→推演→大纲→章纲→正文→审查→脚本→快照 全链路 | e2e.js |

## 多项目 / 容错说明
- **多项目隔离**：一书一目录为推荐做法；同目录多书由 `<project-detection>` 与 `.novel/active-book.json` 承载（行为规范，非脚本断言）。
- **容错 11 场景**：见 `novel-architect` 的 `<failure-handling>`（行为规范）；其中「状态文件损坏」「脚本超时」「畸形状态」有脚本级断言（V-11b / S-09）。

## 脚本清单（15 可执行 + 2 共享库）
可执行：`ai_flavor_check` `chapter_cut_check` `character_tracker` `collision_density_check`
`consistency_check` `foreshadow_tracker` `init_project` `knowledge_consistency_check` `merge_chapters`
`outline_sync_check` `review_engine` `snapshot_manager` `style_drift_check` `validate_character` `word_counter`。
共享库：`_common.py`、`knowledge_loader.py`。
