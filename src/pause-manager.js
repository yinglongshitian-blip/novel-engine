'use strict';
/**
 * pause-manager.js — 关键节点暂停机制。
 *
 * 定义 6 个暂停点，并提供 pauseForConfirmation 生成结构化「暂停请求」，
 * 由主 Agent 转达用户并等待裁决。本模块不直接阻塞进程。
 */

/** 6 个暂停点定义 */
const PAUSE_POINTS = [
  {
    id: 'P1',
    key: 'worldview',
    name: '世界观确认',
    trigger: '问卷立项完成后',
    action: '确认/修改',
    description: '展示生成的题材/套路/金手指/文风/世界观框架',
  },
  {
    id: 'P2',
    key: 'deduction',
    name: '推演确认',
    trigger: 'deduction-agent 输出每条行动线后',
    action: '逐条确认',
    description: '逐条展示推演结果',
  },
  {
    id: 'P3',
    key: 'outline',
    name: '大纲确认',
    trigger: 'outline-agent 输出主线节点后',
    action: '确认/修改',
    description: '展示主线节点列表+碰撞来源',
  },
  {
    id: 'P4',
    key: 'volume',
    name: '卷纲确认',
    trigger: '卷纲生成后',
    action: '确认/修改',
    description: '展示碰撞网覆盖章节',
  },
  {
    id: 'P5',
    key: 'review',
    name: '审查暂停',
    trigger: 'review-agent 发现🟡及以上问题',
    action: '修正/忽略继续',
    description: '展示审查报告',
  },
  {
    id: 'P6',
    key: 'batch',
    name: '批量确认',
    trigger: '连写N章完成后',
    action: '统一确认',
    description: '展示N章摘要+质量报告',
  },
];

/** 按 id 或 key 查找暂停点 */
function getPausePoint(idOrKey) {
  return PAUSE_POINTS.find((p) => p.id === idOrKey || p.key === idOrKey) || null;
}

/**
 * 生成结构化暂停请求。
 * @param {string} idOrKey 暂停点 id 或 key
 * @param {object} payload 需要用户确认的内容
 * @param {object} [options] { options: string[] }
 * @returns {object} { paused, pausePoint, prompt, payload, options }
 */
function pauseForConfirmation(idOrKey, payload = {}, options = {}) {
  const point = getPausePoint(idOrKey);
  if (!point) {
    throw new Error(`未知暂停点: ${idOrKey}`);
  }
  const choices = options.options || ['确认', '修改', '否决'];
  return {
    paused: true,
    pausePoint: point,
    prompt: `【暂停 ${point.id} · ${point.name}】${point.description}（请选择：${choices.join(' / ')}）`,
    payload,
    options: choices,
  };
}

/**
 * 根据阶段与上下文判断是否应暂停。
 * @returns {object|null} 暂停请求或 null（不暂停）
 */
function detectPause(phase, context = {}) {
  switch (phase) {
    case 'questionnaire':
      return context.questionnaireDone
        ? pauseForConfirmation('P1', context.config)
        : null;
    case 'deduction':
      return context.latestLine
        ? pauseForConfirmation('P2', context.latestLine)
        : null;
    case 'outline':
      return context.outline
        ? pauseForConfirmation('P3', context.outline)
        : null;
    case 'volume':
      return context.volume
        ? pauseForConfirmation('P4', context.volume)
        : null;
    case 'writing':
      if (context.reviewIssueLevel && context.reviewIssueLevel !== 'ok') {
        return pauseForConfirmation('P5', context.review);
      }
      return null;
    case 'batch':
      return context.batchSummary
        ? pauseForConfirmation('P6', context.batchSummary)
        : null;
    default:
      return null;
  }
}

module.exports = { PAUSE_POINTS, getPausePoint, pauseForConfirmation, detectPause };
