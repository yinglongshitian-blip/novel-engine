'use strict';
/**
 * run-tests.js — 小说创作引擎验收测试套件
 * 覆盖功能验收 V-01 ~ V-12。零外部依赖。
 *
 * 运行: node tests/run-tests.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS  ' + name);
  } catch (err) {
    failed++;
    failures.push({ name, message: err.message });
    console.log('  FAIL  ' + name + '  →  ' + err.message);
  }
}

function runPython(script, args) {
  const py = process.platform === 'win32' ? 'python' : 'python3';
  const res = spawnSync(py, [path.join(ROOT, 'scripts', script), ...args], {
    cwd: ROOT, encoding: 'utf8',
  });
  return { code: res.status, stdout: (res.stdout || '').trim(), stderr: (res.stderr || '').trim() };
}

console.log('\n=== 小说创作引擎 v5.0 — 验收测试 ===\n');

// ---------------------------------------------------------------------------
console.log('[V-01] 自动创建项目目录');
test('V-01 init_project 生成完整 .novel 结构', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-v01-'));
  const r = runPython('init_project.py', [tmp, '--name', '测试书', '--genre', '玄幻']);
  assert.strictEqual(r.code, 0, 'init_project 退出码非0: ' + r.stderr);
  for (const f of ['state/project-state.json', 'state/action-lines.json',
    'state/collision-points.json', 'state/foreshadow.json', 'state/characters.json',
    'state/chapter-summaries.json', 'state/decision-log.json',
    'outline.md', 'volume.md', 'snapshot.md']) {
    assert.ok(fs.existsSync(path.join(tmp, '.novel', f)), '缺少 ' + f);
  }
  assert.ok(fs.existsSync(path.join(tmp, '.novel', 'chapters')), '缺少 chapters 目录');
  fs.rmSync(tmp, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
console.log('\n[V-02] 自动执行问卷立项');
test('V-02 novel-architect 含问卷立项阶段', () => {
  const t = read('.opencode/agents/novel-architect.md');
  assert.ok(t.includes('问卷立项'), '缺少「问卷立项」');
  assert.ok(t.includes('5-8个问题') || t.includes('5-8'), '缺少问卷问题数量');
});

// ---------------------------------------------------------------------------
console.log('\n[V-03] 推演逐条确认');
test('V-03 deduction-agent 含逐条确认与单条输出格式', () => {
  const t = read('.opencode/agents/deduction-agent.md');
  assert.ok(t.includes('逐条推演逐条确认'), '缺少逐条确认铁律');
  assert.ok(t.includes('【推演 - 第X条】'), '缺少单条输出格式');
  assert.ok(t.includes('请确认'), '缺少确认项');
});

// ---------------------------------------------------------------------------
console.log('\n[V-04] 推演约束生效');
test('V-04 deduction-agent 含6条铁律且禁止价值观', () => {
  const t = read('.opencode/agents/deduction-agent.md');
  for (const r of ['只延伸不创造', '不许替用户表达价值观', '逐条推演逐条确认',
    '每条标注来源', '需引入新元素时暂停', '用户本意优先']) {
    assert.ok(t.includes(r), '缺少铁律: ' + r);
  }
});

// ---------------------------------------------------------------------------
console.log('\n[V-05] 网状大纲生成');
test('V-05 outline-agent 标注碰撞来源，卷纲覆盖章节', () => {
  const t = read('.opencode/agents/outline-agent.md');
  assert.ok(t.includes('碰撞来源'), '缺少碰撞来源标注');
  assert.ok(t.includes('覆盖章节'), '缺少覆盖章节');
  assert.ok(t.includes('CP-'), '缺少碰撞点编号示例');
});

// ---------------------------------------------------------------------------
console.log('\n[V-06] 章纲碰撞字段');
test('V-06 novel-outline 章纲含核心碰撞/涉及线/碰撞结果', () => {
  const t = read('.opencode/skills/novel-outline/SKILL.md');
  for (const f of ['本章核心碰撞', '碰撞涉及线', '碰撞结果', '本章未涉及的线']) {
    assert.ok(t.includes(f), '缺少章纲字段: ' + f);
  }
});

// ---------------------------------------------------------------------------
console.log('\n[V-07] 自动调用脚本');
test('V-07 script-invoker 执行脚本并解析 JSON', () => {
  const si = require(path.join(ROOT, 'src', 'script-invoker.js'));
  const r = si.executeScript('word_counter.py', ['samples/demo/.novel/chapters/']);
  assert.strictEqual(r.status, 'success', '执行失败');
  assert.ok(r.data && typeof r.data.total_words === 'number', '缺少 total_words');
  assert.strictEqual(si.listScripts().length, 15, '脚本数应为15（14 流水线脚本 + review_engine + knowledge_consistency_check）');
});
test('V-07b 不存在的脚本返回 error 而非抛异常', () => {
  const si = require(path.join(ROOT, 'src', 'script-invoker.js'));
  const r = si.executeScript('nope.py', []);
  assert.strictEqual(r.status, 'error', '应为 error');
  assert.ok(/不存在/.test(r.message), '缺少不存在提示');
});

// ---------------------------------------------------------------------------
console.log('\n[V-08] 18维审查自动执行');
test('V-08 review-agent 含18维与AI味六层面', () => {
  const t = read('.opencode/agents/review-agent.md');
  const dims = ['世界观一致性', '碰撞网对齐', '金手指符合性', '人物性格一致性', '文风规则', '去AI化',
    '时间线', '伏笔连贯性', '信息越界', '战力崩坏', '配角降智', '利益链断裂', '台词失真', '爽点虚化',
    '节奏失衡', '数值细节', '碰撞密度', '角色主动性'];
  for (const d of dims) assert.ok(t.includes(d), '缺少维度: ' + d);
  assert.ok(t.includes('AI味六层面'), '缺少AI味六层面');
  assert.ok(t.includes('综合评分'), '缺少综合评分');
});

// ---------------------------------------------------------------------------
console.log('\n[V-09] 关键节点暂停');
test('V-09 pause-manager 含6个暂停点', () => {
  const pm = require(path.join(ROOT, 'src', 'pause-manager.js'));
  assert.strictEqual(pm.PAUSE_POINTS.length, 6, '暂停点应为6个');
  const ids = pm.PAUSE_POINTS.map((p) => p.id).join(',');
  assert.strictEqual(ids, 'P1,P2,P3,P4,P5,P6', '暂停点id异常: ' + ids);
});
test('V-09b detectPause 在立项完成时触发 P1', () => {
  const pm = require(path.join(ROOT, 'src', 'pause-manager.js'));
  const r = pm.detectPause('questionnaire', { questionnaireDone: true, config: {} });
  assert.ok(r && r.paused && r.pausePoint.id === 'P1', '未触发P1');
});

// ---------------------------------------------------------------------------
console.log('\n[V-10] 连写N章模式');
test('V-10 novel-architect 含连写N章批量模式', () => {
  const t = read('.opencode/agents/novel-architect.md');
  assert.ok(t.includes('连写N章'), '缺少连写N章');
  assert.ok(t.includes('P6'), '缺少批量暂停点P6');
});

// ---------------------------------------------------------------------------
console.log('\n[V-11] 跨话题续写');
test('V-11 snapshot save/restore 往返一致', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-v11-'));
  let r = runPython('init_project.py', [tmp, '--name', '续写书']);
  assert.strictEqual(r.code, 0, r.stderr);
  // 写入 phase
  const psPath = path.join(tmp, '.novel', 'state', 'project-state.json');
  const ps = JSON.parse(fs.readFileSync(psPath, 'utf8'));
  ps.current_phase = 'writing'; ps.current_chapter = 5;
  fs.writeFileSync(psPath, JSON.stringify(ps));
  r = runPython('snapshot_manager.py', ['save', path.join(tmp, '.novel')]);
  assert.strictEqual(r.code, 0, 'save 失败: ' + r.stderr);
  const saved = JSON.parse(r.stdout);
  assert.strictEqual(saved.phase, 'writing', 'save phase 不符');
  r = runPython('snapshot_manager.py', ['restore', path.join(tmp, '.novel')]);
  assert.strictEqual(r.code, 0, 'restore 失败: ' + r.stderr);
  const restored = JSON.parse(r.stdout);
  assert.strictEqual(restored.phase, 'writing', 'restore phase 不符');
  assert.strictEqual(restored.chapter, 5, 'restore chapter 不符');
  fs.rmSync(tmp, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
console.log('\n[V-12] 决策轨迹只追加');
test('V-12 appendDecision 只追加不覆盖历史', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-v12-'));
  let r = runPython('init_project.py', [tmp]);
  assert.strictEqual(r.code, 0, r.stderr);
  // 清空 decision-log 后连续追加
  const logPath = path.join(tmp, '.novel', 'state', 'decision-log.json');
  fs.writeFileSync(logPath, JSON.stringify({ entries: [] }));
  const sm = require(path.join(ROOT, 'src', 'state-manager.js'));
  sm.appendDecision(tmp, '世界观决策', { decision: '第一条' });
  sm.appendDecision(tmp, '角色决策', { decision: '第二条' });
  const state = sm.loadState(tmp, 'decision-log');
  assert.strictEqual(state.entries.length, 2, '应有2条');
  assert.strictEqual(state.entries[0].decision, '第一条', '历史被覆盖');
  assert.strictEqual(state.entries[1].decision, '第二条', '追加顺序错误');
  fs.rmSync(tmp, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
console.log('\n[V-11b] 状态损坏后从快照真正回写');
test('V-11b 损坏的状态文件可被 restore 回写', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-v11b-'));
  let r = runPython('init_project.py', [tmp, '--name', '恢复书']);
  assert.strictEqual(r.code, 0, r.stderr);
  const psPath = path.join(tmp, '.novel', 'state', 'project-state.json');
  const ps = JSON.parse(fs.readFileSync(psPath, 'utf8'));
  ps.current_phase = 'writing'; ps.current_chapter = 7;
  fs.writeFileSync(psPath, JSON.stringify(ps));
  r = runPython('snapshot_manager.py', ['save', path.join(tmp, '.novel')]);
  assert.strictEqual(r.code, 0, 'save 失败: ' + r.stderr);
  fs.writeFileSync(psPath, '{ 这不是合法 JSON ');
  r = runPython('snapshot_manager.py', ['restore', path.join(tmp, '.novel')]);
  assert.strictEqual(r.code, 0, 'restore 失败: ' + r.stderr);
  const restored = JSON.parse(r.stdout);
  assert.ok(restored.restored.includes('project-state.json'), '未回写 project-state.json');
  const recovered = JSON.parse(fs.readFileSync(psPath, 'utf8'));
  assert.strictEqual(recovered.current_phase, 'writing', '恢复后 phase 不符');
  assert.strictEqual(recovered.current_chapter, 7, '恢复后 chapter 不符');
  fs.rmSync(tmp, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
console.log('\n[契约] 14个脚本 JSON 输出契约');
test('C-01 全部14个脚本输出含约定字段', () => {
  const contracts = [
    ['word_counter.py', ['samples/demo/.novel/chapters/'], 'total_words'],
    ['foreshadow_tracker.py', ['samples/demo/.novel/'], 'by_status'],
    ['style_drift_check.py', ['samples/demo/.novel/'], 'drift_level'],
    ['character_tracker.py', ['samples/demo/.novel/'], 'characters'],
    ['chapter_cut_check.py', ['samples/demo/.novel/chapters/'], 'chapters'],
    ['validate_character.py', ['samples/demo/.novel/chapters/ch_001.md'], 'violations'],
    ['outline_sync_check.py', ['samples/demo/.novel/'], 'synced'],
    ['merge_chapters.py', ['samples/demo/.novel/'], 'chapters'],
    ['collision_density_check.py', ['samples/demo/.novel/'], 'max_consecutive_no_collision'],
    ['ai_flavor_check.py', ['samples/demo/.novel/chapters/ch_001.md'], 'metaphor_per_1k'],
    ['consistency_check.py', ['samples/demo/.novel/'], 'issues'],
    ['review_engine.py', ['samples/demo/.novel/'], 'dims'],
    ['knowledge_consistency_check.py', [], 'checks'],
    ['snapshot_manager.py', ['save', 'samples/demo/.novel/'], 'status'],
  ];
  for (const [script, args, key] of contracts) {
    const r = runPython(script, args);
    assert.strictEqual(r.code, 0, `${script} 退出码 ${r.code}: ${r.stderr}`);
    const data = JSON.parse(r.stdout);
    assert.ok(key in data, `${script} 缺少字段 ${key}`);
  }
  // 13th script: init_project 需临时目录
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-c01-'));
  const r = runPython('init_project.py', [tmp]);
  assert.strictEqual(r.code, 0, 'init_project 失败: ' + r.stderr);
  assert.ok('created' in JSON.parse(r.stdout), 'init_project 缺少 created');
  fs.rmSync(tmp, { recursive: true, force: true });
  // 断章钩子字段
  const cut = JSON.parse(runPython('chapter_cut_check.py', ['samples/demo/.novel/chapters/']).stdout);
  assert.ok(typeof cut.chapters[0].hook_strength === 'number', '缺少 hook_strength');
});

// ---------------------------------------------------------------------------
console.log('\n[V-08b] 18维审查脚本化覆盖');
test('V-08b review_engine 输出18维且脚本化覆盖≥13', () => {
  const r = runPython('review_engine.py', ['samples/demo/.novel/']);
  assert.strictEqual(r.code, 0, 'review_engine 失败: ' + r.stderr);
  const data = JSON.parse(r.stdout);
  assert.strictEqual(data.dims.length, 18, '维度应为18');
  const scripted = data.automated + data.heuristic;
  assert.ok(scripted >= 13, '脚本化覆盖应≥13，实际 ' + scripted);
  assert.strictEqual(data.automated + data.heuristic + data.llm_required, 18, '方法分类应覆盖18维');
  assert.ok(['通过', '需修正', '需重写'].includes(data.conclusion), '结论异常');
  const methods = new Set(data.dims.map((d) => d.method));
  for (const m of methods) assert.ok(['automated', 'heuristic', 'llm_required'].includes(m), '非法 method: ' + m);
});

// ---------------------------------------------------------------------------
console.log('\n[安全] 加固回归测试');
test('S-01 script-invoker 拒绝越界脚本（绝对路径/穿越/非.py）', () => {
  const si = require(path.join(ROOT, 'src', 'script-invoker.js'));
  assert.strictEqual(si.executeScript('C:/Windows/System32/notepad.exe', []).status, 'error');
  assert.strictEqual(si.executeScript('../../evil.py', []).status, 'error');
  assert.strictEqual(si.executeScript('../../package.json', []).status, 'error');
  assert.strictEqual(si.executeScript('word_counter.py', ['samples/demo/.novel/chapters/']).status, 'success');
});
test('S-02 snapshot restore 拒绝越界键（无越界写入）', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-sec2-'));
  let r = runPython('init_project.py', [tmp]);
  assert.strictEqual(r.code, 0, r.stderr);
  fs.writeFileSync(path.join(tmp, '.novel', 'snapshot.json'), JSON.stringify({
    files: { '../../../pwned_sec.json': { x: 1 }, 'project-state.json': { current_phase: 'writing' } },
  }));
  r = runPython('snapshot_manager.py', ['restore', path.join(tmp, '.novel')]);
  assert.strictEqual(r.code, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.ok(out.rejected.includes('../../../pwned_sec.json'), '未拒绝越界键');
  assert.ok(!fs.existsSync(path.join(tmp, '..', 'pwned_sec.json')), '发生越界写入');
  fs.rmSync(tmp, { recursive: true, force: true });
});
test('S-03 merge_chapters 拒绝越界输出', () => {
  const r = runPython('merge_chapters.py', ['samples/demo/.novel/', '--output', '../../../pwned_merge.md']);
  assert.notStrictEqual(r.code, 0, '应拒绝越界输出');
  assert.strictEqual(JSON.parse(r.stdout).status, 'error');
});
test('S-04 init_project 拒绝项目/临时目录之外的路径', () => {
  const r = runPython('init_project.py', ['C:/ProgramData/novel-evil-sec']);
  assert.notStrictEqual(r.code, 0, '应拒绝项目外路径');
  assert.strictEqual(JSON.parse(r.stdout).status, 'error');
});
test('S-08 NUM_RE 对长数字串线性（无 ReDoS）', () => {
  const py = process.platform === 'win32' ? 'python' : 'python3';
  const code = "import sys;sys.path.insert(0,'scripts');import time,review_engine;"
    + "s='1'*50000;t=time.time();review_engine.NUM_RE.findall(s);print(round(time.time()-t,3))";
  const res = spawnSync(py, ['-c', code], { cwd: ROOT, encoding: 'utf8' });
  assert.strictEqual(res.status, 0, res.stderr);
  const secs = parseFloat(res.stdout.trim());
  assert.ok(secs < 1.0, 'NUM_RE 过慢（疑似回溯）: ' + secs + 's');
});
test('S-09 畸形状态文件返回结构化错误（无 traceback）', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-sec9-'));
  let r = runPython('init_project.py', [tmp]);
  assert.strictEqual(r.code, 0, r.stderr);
  fs.writeFileSync(path.join(tmp, '.novel', 'state', 'foreshadow.json'), '[1,2,"oops"]');
  r = runPython('foreshadow_tracker.py', [path.join(tmp, '.novel')]);
  assert.strictEqual(r.code, 0, '应正常退出，stderr=' + r.stderr);
  const out = JSON.parse(r.stdout);
  assert.strictEqual(out.status, 'success');
  assert.strictEqual(out.total, 0, '非 dict 项应被忽略');
  fs.rmSync(tmp, { recursive: true, force: true });
});
test('S-10 opencode.json 权限含 catch-all deny 且 bash 收窄', () => {
  const c = require(path.join(ROOT, 'opencode.json'));
  for (const [n, a] of Object.entries(c.agent)) {
    const bash = a.permission && a.permission.bash;
    if (bash && typeof bash === 'object') {
      assert.strictEqual(bash['*'], 'deny', n + ' 的 bash 缺少 "*": deny');
      assert.ok(!('python*' in bash), n + ' 仍使用过宽的 python*');
    }
  }
  assert.strictEqual(c.permission.edit['*'], 'deny', '全局 edit 缺少 catch-all deny');
  assert.ok(!('.opencode/**' in c.permission.edit), '全局 edit 不应允许 .opencode/**');
});

// ---------------------------------------------------------------------------
console.log('\n[知识库] 15 模块 + 机器可读层');
test('K-01 15 个知识模块存在且含 frontmatter', () => {
  const mods = ['01-story-contract', '02-genres', '03-tropes', '04-golden-fingers',
    '05-writing-styles', '06-personalities', '07-prose-principles', '08-ai-words',
    '09-info-release', '10-author-profile', '11-comparison-engine', '12-character-card',
    '13-foreshadow-rules', '14-reader-perspective', '15-whitelist'];
  for (const m of mods) {
    const p = `knowledge/${m}.md`;
    assert.ok(fs.existsSync(path.join(ROOT, p)), '缺少 ' + p);
    const t = read(p);
    assert.ok(/^---[\s\S]*?name:/.test(t), p + ' 缺少 frontmatter name');
    assert.ok(t.length > 500, p + ' 内容过短');
  }
});
test('K-02 data JSON 结构完整（21题材/24文风/14性格/8类AI词）', () => {
  const genres = JSON.parse(read('knowledge/data/genres.json'));
  assert.strictEqual(genres.genres.length, 21, '题材应为21');
  assert.ok(genres.general_fatigue_words.length >= 4, '通用疲劳词不足');
  const styles = JSON.parse(read('knowledge/data/styles.json'));
  assert.strictEqual(styles.styles.length, 24, '文风应为24');
  const pers = JSON.parse(read('knowledge/data/personalities.json'));
  assert.strictEqual(pers.personalities.length, 14, '性格应为14');
  const ai = JSON.parse(read('knowledge/data/ai-words.json'));
  assert.strictEqual(Object.keys(ai.classes).length, 8, 'AI词类应为8');
});
test('K-03 knowledge_loader 可加载题材与白名单', () => {
  const py = process.platform === 'win32' ? 'python' : 'python3';
  const code = "import sys;sys.path.insert(0,'scripts');import knowledge_loader as k,json;"
    + "e=k.genre_entry('samples/demo/.novel');"
    + "print(json.dumps({'genre':e['name'] if e else None,"
    + "'fatigue':len(k.genre_fatigue_words('samples/demo/.novel')),"
    + "'wl':len(k.load_whitelist('samples/demo/.novel'))}))";
  const res = spawnSync(py, ['-c', code], { cwd: ROOT, encoding: 'utf8' });
  assert.strictEqual(res.status, 0, res.stderr);
  const d = JSON.parse(res.stdout);
  assert.strictEqual(d.genre, '玄幻', '应识别题材玄幻');
  assert.ok(d.fatigue >= 4, '疲劳词应≥4');
  assert.ok(d.wl >= 1, '白名单应≥1条');
});
test('K-04 白名单中的词不计入疲劳词', () => {
  const r = runPython('ai_flavor_check.py', ['samples/demo/.novel/chapters/ch_001.md']);
  assert.strictEqual(r.code, 0, r.stderr);
  const d = JSON.parse(r.stdout);
  assert.ok(d.whitelist_applied >= 1, '应加载白名单');
  assert.ok(!('猛地' in d.fatigue_words), '被白名单的词不应计入');
});
test('K-05 review_engine 输出题材专属审查维度', () => {
  const r = runPython('review_engine.py', ['samples/demo/.novel/']);
  assert.strictEqual(r.code, 0, r.stderr);
  const d = JSON.parse(r.stdout);
  assert.strictEqual(d.genre, '玄幻', '应识别题材');
  assert.ok(Array.isArray(d.genre_dims) && d.genre_dims.length >= 1, '应输出题材专属维度');
  assert.ok(d.genre_dims.every((g) => g.item && g.level), '题材维度字段不完整');
});

test('K-06 性格词库冲突已消除（引用 06-personalities）', () => {
  const cc = read('knowledge/12-character-card.md');
  assert.ok(!cc.includes('14 种性格核心词库'), '仍存在独立性格词库');
  assert.ok(cc.includes('06-personalities.md'), '未引用 06-personalities.md');
});
test('K-07 文风锁来源指向 05-writing-styles，默认值仅兜底', () => {
  const nc = read('.opencode/skills/novel-chapter/SKILL.md');
  assert.ok(nc.includes('05-writing-styles.md'), '未指向 05-writing-styles');
  assert.ok(nc.includes('默认兜底值'), '缺少默认兜底说明');
});
test('K-08 五个库含自定义出口 + README 统一规则 + 主 Agent 接入', () => {
  const mods = {
    '02-genres.md': '自定义题材处理', '03-tropes.md': '自定义套路处理',
    '04-golden-fingers.md': '自定义金手指处理', '05-writing-styles.md': '自定义文风处理',
    '06-personalities.md': '自定义性格处理',
  };
  for (const [f, sec] of Object.entries(mods)) {
    assert.ok(read('knowledge/' + f).includes(sec), f + ' 缺少「' + sec + '」');
  }
  assert.ok(read('knowledge/README.md').includes('自定义出口统一规则'), 'README 缺少统一规则');
  const na = read('.opencode/agents/novel-architect.md');
  assert.ok(na.includes('3.5.') && na.includes('自定义出口统一规则'), 'novel-architect 未接入自定义出口');
});
test('K-09 genres.json 疲劳词与 02-genres.md 完全一致', () => {
  const g = JSON.parse(read('knowledge/data/genres.json'));
  const md = read('knowledge/02-genres.md');
  const blocks = md.split(/^## /m).slice(1);
  const map = {};
  for (const b of blocks) {
    const m = b.split('\n')[0].trim().match(/^(\d+)\s+(.+)$/);
    if (!m) continue;
    const fm = b.match(/### 疲劳词\s*\n+([^\n#]+)/);
    if (!fm) continue;
    map[m[2].trim()] = fm[1].replace(/（[^）]*）/g, '').trim()
      .split(/[、,，]/).map((w) => w.trim()).filter(Boolean);
  }
  for (const item of g.genres) {
    assert.deepStrictEqual(item.fatigue_words, map[item.name], item.name + ' 疲劳词与 md 不一致');
  }
});

test('K-10 自定义出口触发边界（预设命中 vs 未命中）', () => {
  const genres = JSON.parse(read('knowledge/data/genres.json'));
  const names = genres.genres.map((g) => g.name);
  assert.ok(names.includes('玄幻'), '玄幻 应在预设题材库（测试1）');
  assert.ok(!names.includes('克苏鲁修仙'), '克苏鲁修仙 不应在预设库 → 触发自定义（测试2）');
  assert.ok(read('knowledge/03-tropes.md').includes('退婚流'), '退婚流 应在套路库（测试1）');
  const styles = JSON.parse(read('knowledge/data/styles.json'));
  assert.ok(styles.styles.some((s) => s.name === '正剧风'), '正剧风 应在文风库');
  assert.ok(!styles.styles.some((s) => s.name === '王家卫式旁白风'), '自定义文风不应在预设库 → 触发自定义（测试3）');
  const pers = JSON.parse(read('knowledge/data/personalities.json'));
  assert.ok(pers.personalities.some((p) => p.name === '高冷'), '高冷 应在性格库');
  assert.ok(!pers.personalities.some((p) => p.name === '冷面复仇者'), '自定义性格不应在预设库 → 触发自定义（测试4）');
});

// ---------------------------------------------------------------------------
console.log('\n[v5.1] 23 项功能补全');
test('v5.1-A 上下文管理（恢复/分级/压缩/上下文提示）', () => {
  const a = read('.opencode/agents/novel-architect.md');
  const u = read('.opencode/skills/novel-utils/SKILL.md');
  assert.ok(a.includes('<resume-protocol>') && a.includes('【恢复简报】'), '缺少恢复协议 V-01');
  assert.ok(u.includes('状态分级加载') && u.includes('热数据') && u.includes('冷数据'), '缺少分级加载 V-02');
  assert.ok(u.includes('章节摘要压缩') && u.includes('volume_summaries'), '缺少摘要压缩 V-03');
  assert.ok(a.includes('上下文提示') && !a.includes('50万字'), '上下文提示未动态化 V-04');
});
test('v5.1-B 立项问卷四部分 + 写作模式 + 字数目标', () => {
  const a = read('.opencode/agents/novel-architect.md');
  for (const s of ['第一部分：核心问题', '第二部分：参数偏好', '第三部分：故事合约', '第四部分：作者画像']) {
    assert.ok(a.includes(s), '立项问卷缺少 ' + s);
  }
  assert.ok(a.includes('<writing-modes>') && a.includes('全书自动模式'), '缺少写作模式 V-06');
  const c = read('.opencode/skills/novel-chapter/SKILL.md');
  assert.ok(c.includes('字数目标与停章标准') && c.includes('user_preferences'), '缺少字数目标 V-07');
});
test('v5.1-C 编辑操作（影响分析/撤回/备用设定）', () => {
  const a = read('.opencode/agents/novel-architect.md');
  const u = read('.opencode/skills/novel-utils/SKILL.md');
  assert.ok(a.includes('<modification-impact>') && a.includes('modification-log'), '缺少影响分析 V-08');
  assert.ok(a.includes('<undo-mechanism>'), '缺少撤回机制 V-09');
  assert.ok(u.includes('备用设定管理') && u.includes('backup-settings.json'), '缺少备用设定 V-10');
});
test('v5.1-D 交互规范 + 生成参数', () => {
  const a = read('.opencode/agents/novel-architect.md');
  const c = read('.opencode/skills/novel-chapter/SKILL.md');
  assert.ok(a.includes('<output-layers>') && c.includes('输出五层分离'), '缺少输出分层 V-11');
  assert.ok(a.includes('<user-controls>') && a.includes('检查活人感'), '缺少用户控制 V-12');
  assert.ok(a.includes('进度输出格式') && a.includes('当前任务图谱'), '缺少进度显示 V-13');
  assert.ok(a.includes('<command-routing>') && a.includes('检查伏笔'), '缺少指令路由 V-14');
  assert.ok(a.includes('<model-params>') && a.includes('频率惩罚'), '缺少生成参数 V-15');
});
test('v5.1-E 章节标题 + 多主角 + 质量闭环', () => {
  const oa = read('.opencode/agents/outline-agent.md');
  const o = read('.opencode/skills/novel-outline/SKILL.md');
  const u = read('.opencode/skills/novel-utils/SKILL.md');
  const ra = read('.opencode/agents/review-agent.md');
  assert.ok(oa.includes('<chapter-title-rules>'), '缺少标题规则 V-16');
  assert.ok(o.includes('多主角适配') && oa.includes('<multi-protagonist>'), '缺少多主角 V-17');
  assert.ok(u.includes('审查问题追踪') && u.includes('issue-tracker.md') && ra.includes('issue-tracker'), '缺少质量闭环 V-18');
});
test('v5.1-F 用户引导 + 提交三件套 + 容错 + 复盘', () => {
  const a = read('.opencode/agents/novel-architect.md');
  assert.ok(a.includes('<first-use-guide>') && a.includes('欢迎使用小说创作引擎'), '缺少首次引导 V-19');
  assert.ok(a.includes('<quick-trial>') && a.includes('先写500字看看'), '缺少快速试写 V-20');
  assert.ok(a.includes('章节提交三件套') && a.includes('正文入档'), '缺少提交三件套 V-21');
  assert.ok(a.includes('系统容错清单') && a.includes('状态文件与快照冲突'), '缺少容错清单 V-22');
  assert.ok(a.includes('<final-report>') && a.includes('全书复盘报告'), '缺少复盘格式 V-23');
});

test('v5.1-G 参数化阈值与章节编号重排', () => {
  const ct = read('.opencode/agents/character-tracker.md');
  assert.ok(ct.includes('action_line_stall_threshold'), '停滞阈值未参数化');
  assert.ok(ct.includes('默认 20 章'), '缺少默认值说明');
  const sr = read('.opencode/agents/script-runner.md');
  assert.ok(sr.includes('重试 1 次') && sr.includes('默认兜底上限 10 秒'), '脚本超时未按复杂度判断');
  const u = read('.opencode/skills/novel-utils/SKILL.md');
  assert.ok(u.includes('## 七、状态分级加载') && u.includes('## 十、审查问题追踪'), 'novel-utils 编号未重排');
  assert.ok(!u.includes('## 八、状态分级加载'), 'novel-utils 仍残留旧编号「八、状态分级加载」');
  const c = read('.opencode/skills/novel-chapter/SKILL.md');
  assert.ok(c.includes('## 五、输出五层分离') && !c.includes('四之二'), 'novel-chapter 编号未重排');
  assert.ok(read('.opencode/agents/review-agent.md').includes('Skill §十 审查问题追踪'), 'review-agent 交叉引用未同步');
});

// ---------------------------------------------------------------------------
console.log('\n[N] v5.1 安全加固回归');
test('N-01 脚本写入基目录越界被拒（跨盘 cwd/temp 仍放行）', () => {
  let r = runPython('merge_chapters.py', ['C:/ProgramData/novel-n1', '--output', 'out.md']);
  assert.notStrictEqual(r.code, 0, '越界基目录应被拒');
  assert.strictEqual(JSON.parse(r.stdout).status, 'error');
  r = runPython('snapshot_manager.py', ['save', 'C:/ProgramData/novel-n1b']);
  assert.notStrictEqual(r.code, 0, '越界快照目录应被拒');
  r = runPython('merge_chapters.py', ['samples/demo/.novel/']);
  assert.strictEqual(r.code, 0, '项目内目录应放行: ' + r.stderr);
});
test('N-02 knowledge_loader.data_path 拒绝越界', () => {
  const py = process.platform === 'win32' ? 'python' : 'python3';
  const code = [
    "import sys", "sys.path.insert(0,'scripts')", "import knowledge_loader as k",
    "r='NOGUARD'", "try:", "    k.data_path('../../opencode')",
    "except ValueError:", "    r='BLOCKED'", "print(r)",
  ].join('\n');
  const res = spawnSync(py, ['-c', code], { cwd: ROOT, encoding: 'utf8' });
  assert.strictEqual(res.stdout.trim(), 'BLOCKED', 'data_path 未拦截越界');
});
test('N-04 白名单标记解析 + 超长条目丢弃', () => {
  const py = process.platform === 'win32' ? 'python' : 'python3';
  const code = [
    "import sys, os, tempfile", "sys.path.insert(0,'scripts')", "import knowledge_loader as k",
    "d=tempfile.mkdtemp(); os.makedirs(os.path.join(d,'history'))",
    "open(os.path.join(d,'history','whitelist.md'),'w',encoding='utf-8')"
      + ".write('\\u4eff\\u4f5b\\n\\u9752\\u83b2\\u5251\\u6b4c #exact\\nX #check=ai_flavor\\n' + 'y'*500 + '\\n')",
    "a=k.load_whitelist(d)", "b=k.load_whitelist(d, check='style_drift')",
    "ok = ('\\u4eff\\u4f5b' in a) and ('\\u9752\\u83b2\\u5251\\u6b4c' in a) and ('X' in a) "
      + "and ('X' not in b) and all(len(x) <= 100 for x in a)",
    "print('OK' if ok else 'FAIL:' + repr(a) + '|' + repr(b))",
  ].join('\n');
  const res = spawnSync(py, ['-c', code], { cwd: ROOT, encoding: 'utf8' });
  assert.strictEqual(res.stdout.trim(), 'OK', '白名单标记/截断处理异常: ' + res.stdout + res.stderr);
});
test('N-05 自定义题材驱动 genre_entry', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-n5-'));
  let r = runPython('init_project.py', [tmp, '--name', '克苏鲁书', '--genre', '克苏鲁修仙']);
  assert.strictEqual(r.code, 0, r.stderr);
  fs.writeFileSync(path.join(tmp, '.novel', 'state', 'custom-genres.json'), JSON.stringify({
    genres: [{ name: '克苏鲁修仙', fatigue_words: ['不可名状'], review_dims: [{ item: '不可理解性', level: '🔴' }] }],
  }));
  const py = process.platform === 'win32' ? 'python' : 'python3';
  const code = [
    "import sys", "sys.path.insert(0,'scripts')",
    "sys.stdout.reconfigure(encoding='utf-8')",
    "import knowledge_loader as k",
    `e=k.genre_entry(r'${tmp.replace(/\\/g, '/')}/.novel')`,
    "print(e.get('name') if e else 'NONE')",
  ].join('\n');
  const res = spawnSync(py, ['-c', code], { cwd: ROOT, encoding: 'utf8' });
  assert.strictEqual(res.stdout.trim(), '克苏鲁修仙', '自定义题材未被识别');
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('v5.1-H 架构缺口补全（多项目/权限/迁移/无章节/一致性）', () => {
  const a = read('.opencode/agents/novel-architect.md');
  assert.ok(a.includes('<project-detection>') && a.includes('active-book.json'), '缺少项目检测 V-01');
  assert.ok(a.includes('<write-permissions>') && a.includes('唯一写入者'), '缺少写入权限矩阵 V-07');
  assert.ok(a.includes('<version-migration>'), '缺少版本迁移 V-09');
  assert.ok(a.includes('<no-chapter-mode>') && a.includes('writing_mode'), '缺少无章节模式 V-14');
  assert.ok(a.includes('书名：XXX') && a.includes('snapshot.json'), '恢复简报未含书名/sidecar V-03');
  assert.ok(a.includes('回滚该章对状态文件的改动'), '撤回缺少状态回滚 V-08');
  assert.ok(a.includes('写到哪了'), '指令路由缺少同义表达 V-21');
  const u = read('.opencode/skills/novel-utils/SKILL.md');
  assert.ok(u.includes('### 快照定位') && u.includes('### 书名校验'), 'novel-utils 缺少快照定位/书名校验 V-10');
  const oa = read('.opencode/agents/outline-agent.md');
  assert.ok(oa.includes('冲突处理'), '标题规则缺少冲突处理 V-23');
  assert.ok(fs.existsSync(path.join(ROOT, 'knowledge/CHANGELOG.md')), '缺少 knowledge/CHANGELOG.md V-31');
  assert.ok(fs.existsSync(path.join(ROOT, 'tests/README.md')), '缺少测试覆盖说明 V-33');
});
test('v5.1-I 知识库一致性脚本 0 不一致', () => {
  const r = runPython('knowledge_consistency_check.py', []);
  assert.strictEqual(r.code, 0, '一致性校验失败: ' + r.stdout);
  const d = JSON.parse(r.stdout);
  assert.strictEqual(d.status, 'success');
  assert.strictEqual(d.issues.length, 0, '存在不一致: ' + JSON.stringify(d.issues));
});

// ---------------------------------------------------------------------------
console.log('\n[v5.3] 篇幅分类 + 书籍简介');
test('v5.3-A 篇幅方案数据 + project-state 字段', () => {
  const ws = JSON.parse(read('knowledge/data/work-scales.json'));
  assert.strictEqual(Object.keys(ws.scales).length, 3, '应有 short/medium/long');
  assert.strictEqual(ws.scales.short.rhythm.strategy, 'leap');
  assert.strictEqual(ws.scales.medium.rhythm.strategy, 'spiral');
  assert.strictEqual(ws.scales.long.rhythm.strategy, 'three_tier');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-v53-'));
  const r = runPython('init_project.py', [tmp, '--name', '短篇书', '--genre', '玄幻', '--words', '20000']);
  assert.strictEqual(r.code, 0, r.stderr);
  const ps = JSON.parse(fs.readFileSync(path.join(tmp, '.novel', 'state', 'project-state.json'), 'utf8'));
  assert.strictEqual(ps.work_scale, 'short', '字数未归入 short');
  assert.strictEqual(ps.total_word_target, 20000);
  assert.strictEqual(ps.rhythm.strategy, 'leap');
  assert.strictEqual(ps.structure.has_volumes, false);
  fs.rmSync(tmp, { recursive: true, force: true });
});
test('v5.3-B 立项问篇幅 + 写作层分流（outline/chapter/review/utils）', () => {
  const a = read('.opencode/agents/novel-architect.md');
  assert.ok(a.includes('第零问：篇幅') && a.includes('work_scale'), '缺少篇幅第一问 V-01');
  assert.ok(a.includes('生成书籍简介') && a.includes('summary.md'), '缺少阶段5 简介 V-16/V-30');
  assert.ok(a.includes('篇幅中途修改'), '缺少中途修改 V-12');
  const o = read('.opencode/skills/novel-outline/SKILL.md');
  assert.ok(o.includes('篇幅与节奏策略') && o.includes('三档制'), 'outline 缺少篇幅策略 V-15');
  const c = read('.opencode/skills/novel-chapter/SKILL.md');
  assert.ok(c.includes('节奏策略（按篇幅调整）') && c.includes('跨越式'), 'chapter 缺少节奏策略 V-06');
  const ra = read('.opencode/agents/review-agent.md');
  assert.ok(ra.includes('<scale-dimensions>') && ra.includes('基础 6 维 + 去 AI 化'), 'review 缺少按篇幅维度 V-09');
  const u = read('.opencode/skills/novel-utils/SKILL.md');
  assert.ok(u.includes('按篇幅调整（work_scale）') && u.includes('3态'), 'utils 缺少按篇幅调整 V-10/V-11');
});
test('v5.3-C 书籍简介知识模块（三段式 + 铁律 + 三大雷区）', () => {
  const s = read('knowledge/16-book-summary.md');
  assert.ok(s.includes('三段式结构') && s.includes('三句话快剪'), '缺少三段式 V-18');
  assert.ok(s.includes('铁律11') && s.includes('三大雷区'), '缺少铁律/雷区');
  assert.ok(s.includes('谜语人') && s.includes('不堆设定') && s.includes('不抒情'), '缺少三大雷区细则');
  assert.ok(s.includes('200-300 字'), '缺少字数要求 V-17');
  assert.ok(s.includes('按篇幅的侧重差异'), '缺少按篇幅侧重 V-31');
  assert.ok(s.includes('自检清单'), '缺少自检清单');
});

test('v5.3-D 字段定义修正（writing_mode / 模块数 / 洼地 / 伏笔）', () => {
  const a = read('.opencode/agents/novel-architect.md');
  const ip = read('scripts/init_project.py');
  // 1. writing_mode 合法值
  for (const v of ['chapter_by_chapter', 'stage_confirm', 'full_auto']) {
    assert.ok(a.includes(v), '缺少 writing_mode 值 ' + v);
  }
  assert.ok(a.includes('`batch`'), '缺少 batch');
  assert.ok(!/writing_mode[^\n]*per_chapter/.test(a), 'writing_mode 仍为 per_chapter');
  assert.ok(ip.includes('"writing_mode": "chapter_by_chapter"'), 'init_project 默认值未改');
  // 1d structure_mode
  assert.ok(a.includes('structure_mode'), 'no-chapter-mode 未改名 structure_mode');
  assert.ok(!/writing_mode: "chapter"/.test(a), 'no-chapter-mode 仍用 writing_mode');
  // 2. 模块数 16
  assert.ok(a.includes('16 个模块总索引'), 'architect 模块数未改');
  assert.ok(read('.opencode/skills/novel-core/SKILL.md').includes('16 个模块总索引'), 'novel-core 模块数未改');
  // 3. 分发洼地
  assert.ok(a.includes('分发洼地检查'), '缺少洼地主动提示');
  // 4. 长篇伏笔
  assert.ok(read('.opencode/skills/novel-utils/SKILL.md').includes('无上限（建议 10 条以上）'), '伏笔表述未改');
});

// ---------------------------------------------------------------------------
console.log('\n=== 结果 ===');
console.log(`通过: ${passed}  失败: ${failed}`);
if (failed > 0) {
  console.log('\n失败明细:');
  failures.forEach((f) => console.log('  - ' + f.name + ': ' + f.message));
  process.exit(1);
}
console.log('全部通过 ✅');
