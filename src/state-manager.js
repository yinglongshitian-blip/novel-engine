'use strict';
/**
 * state-manager.js — 小说项目状态读写（原子写）。
 *
 * 管理 .novel/state/ 下 7 个状态文件。
 * 所有写入采用原子写：先写临时文件，再重命名覆盖，避免半写损坏。
 */

const fs = require('fs');
const path = require('path');

const STATE_FILES = {
  'project-state': 'project-state.json',
  'action-lines': 'action-lines.json',
  'collision-points': 'collision-points.json',
  foreshadow: 'foreshadow.json',
  characters: 'characters.json',
  'chapter-summaries': 'chapter-summaries.json',
  'decision-log': 'decision-log.json',
};

const DEFAULTS = {
  'project-state': {},
  'action-lines': { lines: [] },
  'collision-points': { collisions: [] },
  foreshadow: { foreshadows: [] },
  characters: { characters: [] },
  'chapter-summaries': { chapters: [] },
  'decision-log': { entries: [] },
};

/** 状态目录 */
function stateDir(novelDir) {
  return path.join(novelDir, '.novel', 'state');
}

/** 解析状态文件绝对路径；未知名称抛错 */
function statePath(novelDir, name) {
  const file = STATE_FILES[name];
  if (!file) throw new Error(`未知状态文件: ${name}`);
  return path.join(stateDir(novelDir), file);
}

/** 读取状态；不存在时返回默认值（深拷贝） */
function loadState(novelDir, name) {
  const file = statePath(novelDir, name);
  if (!fs.existsSync(file)) {
    return JSON.parse(JSON.stringify(DEFAULTS[name] ?? {}));
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    // 状态文件损坏：返回默认值并附错误标记，交由上层决定是否从快照恢复
    const fallback = JSON.parse(JSON.stringify(DEFAULTS[name] ?? {}));
    fallback.__corrupt = true;
    fallback.__error = err.message;
    return fallback;
  }
}

/** 原子写：写临时文件 → rename 覆盖 */
function saveState(novelDir, name, data) {
  const file = statePath(novelDir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
  return file;
}

/** 以 updater 更新状态并原子落盘 */
function updateState(novelDir, name, updater) {
  const current = loadState(novelDir, name);
  const next = typeof updater === 'function' ? updater(current) : updater;
  saveState(novelDir, name, next);
  return next;
}

/**
 * 追加一条决策轨迹（9类，只追加不覆盖）。
 * @param {string} category 决策类别
 * @param {object} entry { decision, reason, impact }
 */
function appendDecision(novelDir, category, entry) {
  return updateState(novelDir, 'decision-log', (state) => {
    const entries = Array.isArray(state.entries) ? [...state.entries] : [];
    entries.push({
      timestamp: new Date().toISOString(),
      category,
      decision: entry.decision || '',
      reason: entry.reason || '',
      impact: entry.impact || '',
    });
    return { ...state, entries };
  });
}

module.exports = {
  STATE_FILES,
  DEFAULTS,
  loadState,
  saveState,
  updateState,
  appendDecision,
};
