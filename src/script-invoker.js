'use strict';
/**
 * script-invoker.js — Python 脚本调用封装。
 *
 * executeScript(name, args) → { script, status, data|message, raw_output }
 * - 脚本不存在：返回 status='error'，不抛异常（对应稳定性验收 S-01）
 * - 脚本非 0 退出码：返回 status='error' 并携带 stderr
 * - stdout 为合法 JSON：解析到 data；否则放入 raw_output
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DEFAULT_SCRIPTS_DIR = path.resolve(__dirname, '..', 'scripts');
const DEFAULT_TIMEOUT_MS = 10000;

// 共享库（非可执行脚本，不计入脚本数）
const LIBRARY_FILES = new Set(['_common.py', 'knowledge_loader.py']);

/** 枚举可执行脚本（排除共享库） */
function listScripts(scriptsDir = DEFAULT_SCRIPTS_DIR) {
  if (!fs.existsSync(scriptsDir)) return [];
  return fs.readdirSync(scriptsDir)
    .filter((f) => f.endsWith('.py') && !f.startsWith('_') && !LIBRARY_FILES.has(f))
    .sort();
}

function resolvePython() {
  return process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
}

/**
 * 执行脚本。
 * @param {string} name 脚本文件名，如 'word_counter.py'
 * @param {string[]} args 参数
 * @param {object} [opts] { scriptsDir, timeoutMs, cwd, python }
 * @returns {object}
 */
function executeScript(name, args = [], opts = {}) {
  const scriptsDir = path.resolve(opts.scriptsDir || DEFAULT_SCRIPTS_DIR);
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
  const bad = (message) => ({ script: name, status: 'error', message, data: null });

  // 安全：脚本名必须是不含路径分隔的 .py 文件名，且解析后仍位于 scripts/ 内
  if (typeof name !== 'string' || name.length === 0 || name.includes('\0')) {
    return bad('非法脚本名');
  }
  if (path.isAbsolute(name)) {
    return bad(`拒绝绝对路径脚本: ${name}`);
  }
  const scriptPath = path.resolve(scriptsDir, name);
  const rel = path.relative(scriptsDir, scriptPath);
  if (rel.startsWith('..') || path.isAbsolute(rel) || !scriptPath.endsWith('.py')) {
    return bad(`脚本路径越界: ${name}`);
  }
  if (!fs.existsSync(scriptPath)) {
    return bad(`脚本不存在: ${name}`);
  }

  const safeArgs = (Array.isArray(args) ? args : []).map((a) => String(a));
  const python = opts.python || resolvePython();
  const res = spawnSync(python, [scriptPath, ...safeArgs], {
    cwd: opts.cwd || path.dirname(scriptsDir),
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 8 * 1024 * 1024,
  });

  const stdout = (res.stdout || '').trim();
  const stderr = (res.stderr || '').trim();

  if (res.error) {
    return { script: name, status: 'error', message: res.error.message, data: null, raw_output: stdout };
  }
  if (res.status !== 0) {
    return {
      script: name,
      status: 'error',
      message: stderr || `脚本退出码 ${res.status}`,
      data: null,
      raw_output: stdout,
      exit_code: res.status,
    };
  }

  try {
    const data = JSON.parse(stdout);
    return { script: name, status: 'success', data, raw_output: stdout };
  } catch (err) {
    return { script: name, status: 'success', data: null, raw_output: stdout };
  }
}

module.exports = {
  DEFAULT_SCRIPTS_DIR,
  DEFAULT_TIMEOUT_MS,
  listScripts,
  executeScript,
};
