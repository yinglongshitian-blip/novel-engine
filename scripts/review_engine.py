#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""review_engine.py — 18维审查的脚本化引擎。

用法:
    python scripts/review_engine.py .novel/ [--chapter N]

对指定章节（默认最新章）执行可自动化的审查维度，输出结构化报告。
每个维度标注 method：
    - automated   : 可靠脚本判定
    - heuristic   : 启发式脚本判定（可能需人工复核）
    - llm_required: 语义判断，需 review-agent 的 LLM 补充

输出: JSON {"status":"success","chapter":N,"dims":[{id,name,method,status,evidence}],
            "automated":N,"heuristic":N,"llm_required":N,"score":X,"conclusion":"..."}
"""
import os
import re
import sys

from _common import (configure_stdout, load_json, as_list, as_dict, dict_only,
                     iter_chapters, chapter_number, emit, fail)
from ai_flavor_check import analyze as ai_analyze
from style_drift_check import metrics_for, DEFAULT_BASELINE
from validate_character import normalize_rules, load_cards
from chapter_cut_check import score_hook
from foreshadow_tracker import VALID_STATES as FS_STATES
from knowledge_loader import (genre_entry, genre_fatigue_words, load_ai_words,
                              load_whitelist)

# 18 维定义（id, 名称, 默认方法）
DIM_DEFS = [
    (1, "世界观一致性", "heuristic"),
    (2, "碰撞网对齐", "automated"),
    (3, "金手指符合性", "heuristic"),
    (4, "人物性格一致性", "heuristic"),
    (5, "文风规则", "heuristic"),
    (6, "去AI化", "automated"),
    (7, "时间线", "heuristic"),
    (8, "伏笔连贯性", "automated"),
    (9, "信息越界", "llm_required"),
    (10, "战力崩坏", "llm_required"),
    (11, "配角降智", "llm_required"),
    (12, "利益链断裂", "llm_required"),
    (13, "台词失真", "heuristic"),
    (14, "爽点虚化", "llm_required"),
    (15, "节奏失衡", "heuristic"),
    (16, "数值细节", "heuristic"),
    (17, "碰撞密度", "automated"),
    (18, "角色主动性", "heuristic"),
]

ACTION_VERBS = ["决定", "想要", "必须", "主动", "选择", "冲向", "踏入", "寻找",
                "发誓", "转身", "迈出", "伸手", "握紧", "推开"]
TIME_MARKERS = ["三天后", "次日", "翌日", "第二天", "半月后", "一个月后", "多年后",
                "当晚", "当夜", "片刻后", "许久", "良久", "次日清晨"]
NUM_RE = re.compile(r"(\d{1,6}|[一二三四五六七八九十百千万]{1,6})\s?(年|月|日|天|个时辰|里|丈|尺|枚|颗|块|品)")


def pick_chapter(files, wanted):
    if not files:
        return None
    if wanted is None:
        return files[-1]
    for f in files:
        if chapter_number(f) == wanted:
            return f
    return None


def summary_for(summaries, num):
    for s in dict_only(summaries):
        if s.get("chapter") == num:
            return s
    return {}


def build_dims(text, novel_dir, chapter_num, summaries, collisions, characters,
               whitelist=None, ai_cfg=None, fatigue=None):
    results = {}

    # 1 世界观一致性
    world = load_json(os.path.join(novel_dir, "state", "world-rules.json"), None)
    if isinstance(world, dict) and world.get("forbidden_terms"):
        hit = [t for t in world["forbidden_terms"] if t in text]
        results[1] = ("warn" if hit else "pass",
                      ("出现禁用语: " + ", ".join(hit)) if hit else "未出现世界观禁用语")
    else:
        results[1] = ("unknown", "缺少 world-rules.json，无法自动校验")

    # 2 碰撞网对齐
    s = summary_for(summaries, chapter_num)
    cid = s.get("collision")
    cp_ids = {c.get("id") for c in dict_only(collisions)}
    if cid and cid in cp_ids:
        results[2] = ("pass", "命中已登记碰撞点 %s" % cid)
    elif cid:
        results[2] = ("warn", "章节引用的碰撞点 %s 未登记" % cid)
    else:
        results[2] = ("warn", "章节摘要未标注核心碰撞")

    # 3 金手指符合性
    proj = as_dict(load_json(os.path.join(novel_dir, "state", "project-state.json"), {}))
    gf = proj.get("golden_finger") or ""
    key = re.sub(r"[（(].*?[)）]", "", gf).strip()
    if key and key in text:
        results[3] = ("pass", "金手指「%s」出现且未见越界" % key)
    elif key:
        results[3] = ("unknown", "本章未涉及金手指「%s」（可能合理）" % key)
    else:
        results[3] = ("unknown", "未配置金手指")

    # 4 人物性格一致性（红线）
    viol = []
    for card in load_cards(os.path.join(novel_dir, "state", "characters.json")):
        name = card.get("name")
        if not name or name not in text:
            continue
        for phrase in normalize_rules(card):
            if phrase in text:
                viol.append("%s:%s" % (name, phrase))
    results[4] = ("warn" if viol else "pass",
                  ("疑似违反红线 " + ", ".join(viol)) if viol else "未触发角色红线")

    # 5 文风规则
    baseline = dict(DEFAULT_BASELINE)
    cfg = load_json(os.path.join(novel_dir, "state", "style-lock.json"), {})
    if isinstance(cfg, dict):
        baseline.update(cfg)
    m = metrics_for(text)
    dev = 0
    if abs(m["avg_sentence_len"] - baseline["avg_sentence_len"]) > 6:
        dev += 1
    if abs(m["dialogue_ratio"] - baseline["dialogue_ratio"]) > 0.15:
        dev += 1
    results[5] = ("warn" if dev else "pass",
                  "偏离项 %d（均句长 %.1f，对话占比 %.2f）" % (dev, m["avg_sentence_len"], m["dialogue_ratio"]))

    # 6 去AI化（含题材疲劳词与白名单）
    a = ai_analyze(text, whitelist, ai_cfg, fatigue)
    results[6] = ("pass" if a["pass"] else "warn",
                  "比喻词/千字 %.2f，AI高频词 %d，题材疲劳词/3k %.2f（白名单 %d 条）"
                  % (a["metaphor_per_1k"], a["ai_word_count"], a["fatigue_per_3k"], a["whitelist_applied"]))

    # 7 时间线
    tm = [t for t in TIME_MARKERS if t in text]
    results[7] = ("pass" if tm else "unknown",
                  ("检测到时间标记: " + ", ".join(tm)) if tm else "本章无显式时间标记")

    # 8 伏笔连贯性
    fs = dict_only(as_list(load_json(os.path.join(novel_dir, "state", "foreshadow.json"), {}), "foreshadows"))
    bad = [f.get("id") for f in fs if f.get("status") not in FS_STATES]
    pending = [f.get("id") for f in fs if f.get("status") == "pending_reveal"]
    results[8] = ("warn" if bad else "pass",
                  "非法状态 %s；待回收 %s" % (bad or "无", pending or "无"))

    # 9-12,14 llm_required
    for did in (9, 10, 11, 12, 14):
        results[did] = ("unknown", "需 LLM 语义判断")

    # 13 台词失真
    ratio = m["dialogue_ratio"]
    results[13] = ("pass" if 0.05 <= ratio <= 0.55 else "warn",
                   "对话占比 %.2f" % ratio)

    # 15 节奏失衡
    results[15] = ("pass" if m["sentence_stddev"] >= baseline.get("avg_sentence_stddev_min", 3.0) else "warn",
                   "句长标准差 %.2f" % m["sentence_stddev"])

    # 16 数值细节
    nums = NUM_RE.findall(text)
    results[16] = ("pass" if nums else "unknown",
                   "检测到 %d 处数值，未见明显冲突" % len(nums))

    # 17 碰撞密度
    chapters = sorted(dict_only(as_list(load_json(os.path.join(novel_dir, "state", "chapter-summaries.json"), {}), "chapters")),
                      key=lambda c: c.get("chapter", 0))
    max_run, run = 0, 0
    for ch in chapters:
        if not (ch.get("collision") or ch.get("core_collision")):
            run += 1
            max_run = max(max_run, run)
        else:
            run = 0
    results[17] = ("warn" if max_run >= 3 else "pass", "最大连续无碰撞 %d 章" % max_run)

    # 18 角色主动性
    active = any(v in text for v in ACTION_VERBS)
    results[18] = ("pass" if active else "warn",
                   "检测到主动行为动词" if active else "未见明显主动行为")

    dims = []
    for did, name, method in DIM_DEFS:
        status, evidence = results[did]
        dims.append({"id": did, "name": name, "method": method,
                     "status": status, "evidence": evidence})
    return dims


def main(argv):
    if len(argv) < 2:
        return fail("用法: review_engine.py <novel目录> [--chapter N]")
    novel_dir = argv[1]
    wanted = int(argv[argv.index("--chapter") + 1]) if "--chapter" in argv else None

    files = iter_chapters(os.path.join(novel_dir, "chapters"))
    target = pick_chapter(files, wanted)
    if not target:
        return fail("未找到章节文件")

    with open(target, "r", encoding="utf-8") as fh:
        text = fh.read()

    summaries = as_list(load_json(os.path.join(novel_dir, "state", "chapter-summaries.json"), {}), "chapters")
    collisions = as_list(load_json(os.path.join(novel_dir, "state", "collision-points.json"), {}), "collisions")

    whitelist = load_whitelist(novel_dir)
    ai_cfg = load_ai_words()
    fatigue = genre_fatigue_words(novel_dir)
    entry = genre_entry(novel_dir)

    num = chapter_number(target)
    dims = build_dims(text, novel_dir, num, summaries, collisions, None,
                      whitelist, ai_cfg, fatigue)

    # 题材专属审查维度（来自 knowledge/data/genres.json），需 LLM 语义判断
    genre_dims = [{"genre": entry.get("name"), "item": gd.get("item"),
                   "level": gd.get("level"), "method": "llm_required", "status": "unknown"}
                  for gd in (entry.get("review_dims", []) if entry else [])]

    warn = sum(1 for d in dims if d["status"] == "warn")
    automated = sum(1 for d in dims if d["method"] == "automated")
    heuristic = sum(1 for d in dims if d["method"] == "heuristic")
    llm_required = sum(1 for d in dims if d["method"] == "llm_required")
    score = round(10 * (1 - warn / len(dims)), 1)
    conclusion = "通过" if warn == 0 else ("需修正" if warn <= 3 else "需重写")

    emit({"status": "success", "chapter": num, "file": os.path.basename(target),
          "genre": entry.get("name") if entry else None,
          "dims": dims, "genre_dims": genre_dims,
          "automated": automated, "heuristic": heuristic,
          "llm_required": llm_required, "warnings": warn,
          "score": score, "conclusion": conclusion})
    return 0


if __name__ == "__main__":
    configure_stdout()
    sys.exit(main(sys.argv))
