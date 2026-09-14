'use strict';
/**
 * e2e.js — 端到端流水线：问卷→推演→大纲→章纲→正文→审查→脚本→交付。
 *
 * 由于 LLM Agent 需在 OpenCode 运行时中调度，本脚本以「确定性流水线」演示
 * 引擎的全部结构、状态流转、脚本调用与审查产出，验证端到端链路可跑通。
 *
 * 运行: node tests/e2e.js
 * 产物: samples/e2e-run/.novel/chapters/ch_001.md
 *       samples/e2e-run/.novel/reviews/ch_001.review.md
 *       更新 chapter-summaries.json
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'samples', 'e2e-run');
const NOVEL = path.join(OUT, '.novel');

const sm = require(path.join(ROOT, 'src', 'state-manager.js'));
const pm = require(path.join(ROOT, 'src', 'pause-manager.js'));
const si = require(path.join(ROOT, 'src', 'script-invoker.js'));

function log(step, msg) { console.log(`[${step}] ${msg}`); }

function runPython(script, args) {
  const py = process.platform === 'win32' ? 'python' : 'python3';
  const res = spawnSync(py, [path.join(ROOT, 'scripts', script), ...args], {
    cwd: ROOT, encoding: 'utf8',
  });
  if (res.status !== 0) throw new Error(`${script} 失败: ${res.stderr}`);
  return JSON.parse((res.stdout || '').trim());
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function write(p, content) { ensureDir(path.dirname(p)); fs.writeFileSync(p, content, 'utf8'); }

function main() {
  // 0. 清理
  fs.rmSync(OUT, { recursive: true, force: true });

  // 1. 阶段1 项目初始化
  log('P1', '问卷立项 → 初始化项目结构');
  runPython('init_project.py', [OUT, '--name', '端到端测试书', '--genre', '玄幻']);
  sm.updateState(OUT, 'project-state', (s) => ({
    ...s, trope: '退婚流', golden_finger: '空间灵田', writing_style: '标准节奏型',
    current_phase: 'deduction',
  }));
  sm.appendDecision(OUT, '世界观决策', { decision: '确立退婚流+空间灵田', reason: '用户确认', impact: '主线起点' });
  write(path.join(NOVEL, 'state', 'world-rules.json'), JSON.stringify({
    world_name: '青云界', cultivation_tiers: ['炼气', '筑基', '金丹'],
    forbidden_terms: ['魔法', '机甲', '手机'], required_terms: ['灵气'],
  }, null, 2));

  // 2. 阶段2 创意层推演（逐条确认 → 写入行动线）
  log('P2', '推演行动线 → 逐条确认后写入 action-lines.json');
  const lines = [
    { id: 'AL-01', character: '林凡', goal: '复仇、查明母亲死因', direction: '外门修炼→大比→夺宝',
      collision_targets: ['苏浅浅', '血煞教主'], status: 'active', last_advanced_chapter: 1 },
    { id: 'AL-02', character: '苏浅浅', goal: '完成家族任务', direction: '下山→重逢→并肩',
      collision_targets: ['林凡'], status: 'active', last_advanced_chapter: 1 },
    { id: 'AL-03', character: '血煞教主', goal: '夺取灵田', direction: '布局→试探→出手',
      collision_targets: ['林凡'], status: 'active', last_advanced_chapter: 1 },
  ];
  sm.saveState(OUT, 'action-lines', { lines });
  sm.saveState(OUT, 'characters', {
    characters: [
      { id: 'CH-01', name: '林凡', role: '主角', personality: '沉稳隐忍', goal: '复仇', red_lines: ['不会主动认输'] },
      { id: 'CH-02', name: '苏浅浅', role: '女主', personality: '清冷执拗', goal: '家族任务', red_lines: ['不会低声下气'] },
    ],
  });
  // 暂停点 P2 演示
  const p2 = pm.pauseForConfirmation('P2', { line: lines[0] });
  log('P2', '触发暂停点: ' + p2.prompt);

  // 3. 阶段3 规划层（主线节点 / 卷纲 / 章纲）
  log('P3', '生成主线节点 + 卷纲 + 章纲');
  sm.saveState(OUT, 'collision-points', {
    collisions: [
      { id: 'CP-01', name: '外门重逢', chapter_range: '第1-3章', characters: ['林凡', '苏浅浅'],
        location: '青云宗外门', reason: '退婚+重逢', result: '感情线启动',
        lines_involved: ['AL-01', 'AL-02'], status: 'in_progress' },
    ],
  });
  write(path.join(NOVEL, 'outline.md'),
    '# 主线大纲 — 端到端测试书\n\n## 主线节点\n| 节点 | 碰撞来源 | 涉及线 | 结果 | 预估章节 |\n|------|----------|--------|------|----------|\n| N-01 | CP-01: 林凡×苏浅浅 | 主线/感情线 | 感情线启动 | 第1-3章 |\n');
  write(path.join(NOVEL, 'volume.md'),
    '# 卷纲 — 第1卷\n\n## 本卷碰撞网\n| 碰撞点 | 覆盖章节 | 碰撞角色 | 涉及线 | 碰撞结果 |\n|--------|----------|----------|--------|----------|\n| CP-01 | 第1-3章 | 林凡, 苏浅浅 | 主线, 感情线 | 感情线启动 |\n');
  write(path.join(NOVEL, 'chapters', 'ch_001.outline.md'),
    '# 第1章 章纲\n\n## 本章核心碰撞\n- 碰撞ID：CP-01\n- 碰撞双方：林凡 × 苏浅浅\n- 碰撞地点：青云宗外门\n- 碰撞起因：退婚之事+重逢\n\n## 碰撞涉及线\n- [x] 主线（AL-01）\n- [x] 感情线（AL-02）\n\n## 碰撞结果\n感情线启动。\n\n## 本章未涉及的线\n- AL-03 血煞教主\n\n## 断章钩子\n门外传来脚步声，林凡猛地抬头：「谁？」\n');

  // 4. 阶段4 写作层（正文）
  log('P4', '生成第1章正文');
  const chapter1 = `第一章 退婚

青云宗外门的石阶上，林凡站了很久。

三年前，他还是林家最被看好的嫡子。三年后，他连一枚下品灵石都拿不出来。

「林凡，这门亲事，我苏家退了。」

苏浅浅站在他面前，声音很轻，却像一块石头砸进水里。她身后跟着两名苏家长老，面无表情。

林凡没有动。他只是看着那封退婚书，看了很久。

「好。」他说。

苏浅浅愣了一下。她原以为他会争辩，会愤怒，至少会问一句为什么。可他没有。

「你……」她张了张嘴，最终还是把话咽了回去。

林凡把退婚书折好，塞进怀里。他转身，一步步走回自己那间漏雨的柴房。

柴房里，他摸出怀里那半枚玉佩。母亲临终前说过，这玉佩的另一半，在青云宗。

门外，忽然传来一阵极轻的脚步声。林凡猛地抬头。

「谁？」
`;
  write(path.join(NOVEL, 'chapters', 'ch_001.md'), chapter1);

  // 5. 审查层（18维 + AI味 + 脚本）
  log('P5', '独立审查：调用脚本（字数/钩子/AI味/碰撞密度）');
  // 先落一章摘要（供碰撞密度/一致性脚本读取），随后再回填真实字数与钩子
  sm.saveState(OUT, 'chapter-summaries', {
    chapters: [
      { chapter: 1, title: '退婚', word_count: 0, collision: 'CP-01',
        lines: ['AL-01', 'AL-02'], hook_strength: 0,
        summary: '林凡被退婚，于外门遇见苏浅浅。' },
    ],
  });
  const wordR = si.executeScript('word_counter.py', [path.join(NOVEL, 'chapters')]);
  const cutR = si.executeScript('chapter_cut_check.py', [path.join(NOVEL, 'chapters')]);
  const aiR = si.executeScript('ai_flavor_check.py', [path.join(NOVEL, 'chapters', 'ch_001.md')]);
  const consR = si.executeScript('consistency_check.py', [NOVEL]);
  const syncR = si.executeScript('outline_sync_check.py', [NOVEL]);
  // 18维审查：由 review_engine.py 生成结构化结果（碰撞密度等已内聚其中）
  const reviewR = si.executeScript('review_engine.py', [NOVEL, '--chapter', '1']);
  if (reviewR.status !== 'success') throw new Error('review_engine 失败: ' + reviewR.message);

  const wordCount = wordR.data.chapters[0].word_count;
  const hook = cutR.data.chapters[0].hook_strength;
  const aiPass = aiR.data.pass;
  const consOk = consR.data.passed;
  const syncOk = syncR.data.synced;
  const review = reviewR.data;
  const score = review.score;
  const conclusion = review.conclusion;

  let report = `【审查报告 - 第${review.chapter}章】\n\n`;
  report += `| 维度 | 方法 | 结果 | 证据 |\n|------|------|------|------|\n`;
  for (const d of review.dims) report += `| ${d.name} | ${d.method} | ${d.status} | ${d.evidence} |\n`;
  report += `\n字数：${wordCount}  钩子强度：${hook}  AI味：${aiPass ? '达标' : '超标'}\n`;
  report += `脚本化覆盖：${review.automated + review.heuristic}/18（automated ${review.automated} + heuristic ${review.heuristic}）；LLM 补齐：${review.llm_required}\n`;
  report += `一致性：${consOk ? '通过' : '有问题'}  大纲同步：${syncOk ? '同步' : '不同步'}\n`;
  report += `综合评分：${score}/10\n结论：${conclusion}\n`;
  write(path.join(NOVEL, 'reviews', 'ch_001.review.md'), report);

  // 6. 更新状态（章节摘要 + 行动线 + 决策）
  log('P6', '更新状态文件');
  sm.saveState(OUT, 'chapter-summaries', {
    chapters: [
      { chapter: 1, title: '退婚', word_count: wordCount, collision: 'CP-01',
        lines: ['AL-01', 'AL-02'], hook_strength: hook,
        summary: '林凡被退婚，于外门遇见苏浅浅。' },
    ],
  });
  sm.updateState(OUT, 'action-lines', (s) => ({
    ...s, lines: s.lines.map((l) => (l.id === 'AL-01' || l.id === 'AL-02'
      ? { ...l, last_advanced_chapter: 1 } : l)),
  }));
  sm.appendDecision(OUT, '章节决策', { decision: '第1章交付', reason: '审查' + conclusion, impact: '进入第2章' });
  sm.updateState(OUT, 'project-state', (s) => ({
    ...s, current_phase: 'writing', current_chapter: 1,
  }));

  // 7. 快照
  runPython('snapshot_manager.py', ['save', NOVEL]);

  // 8. 汇总
  const chFile = path.join(NOVEL, 'chapters', 'ch_001.md');
  if (!fs.existsSync(chFile)) throw new Error('未生成 ch_001.md');
  console.log('\n=== E2E 完成 ===');
  console.log('第1章文件 :', path.relative(ROOT, chFile));
  console.log('审查报告  :', path.relative(ROOT, path.join(NOVEL, 'reviews', 'ch_001.review.md')));
  console.log('字数      :', wordCount);
  console.log('钩子强度  :', hook);
  console.log('审查结论  :', conclusion, `(${score}/10)`);
  console.log('状态更新  : chapter-summaries.json / action-lines.json / decision-log.json');
  return 0;
}

try {
  process.exit(main());
} catch (err) {
  console.error('E2E 失败:', err.message);
  process.exit(1);
}
