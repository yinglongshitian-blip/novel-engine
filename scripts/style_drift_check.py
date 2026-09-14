#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""style_drift_check.py — 文风漂移检测。

用法:
    python scripts/style_drift_check.py .novel/

输出: JSON {"status":"success","drift_level":"none|light|moderate|severe","per_chapter":[...]}
"""
import os
import re
import sys
import statistics

from _common import configure_stdout, load_json, iter_chapters, emit, fail
from knowledge_loader import load_styles

DEFAULT_BASELINE = {
    "avg_sentence_len": 18.0,
    "dialogue_ratio": 0.30,
    "avg_sentence_stddev_min": 3.0,
}
_BASELINE_KEYS = ("avg_sentence_len", "dialogue_ratio", "avg_sentence_stddev_min")


def resolve_baseline():
    """默认基线来自 knowledge/data/styles.json，缺失时回退内置值。"""
    base = dict(DEFAULT_BASELINE)
    data = load_styles()
    defaults = data.get("style_lock_defaults") if isinstance(data, dict) else None
    if isinstance(defaults, dict):
        for k in _BASELINE_KEYS:
            if k in defaults:
                base[k] = defaults[k]
    return base
AI_WORDS = ["深深", "缓缓", "淡淡", "不禁", "竟然", "瞬间", "仿佛", "宛如", "如同"]


def split_sentences(text):
    return [p.strip() for p in re.split(r"[。！？!?…]+", text) if p.strip()]


def metrics_for(text):
    sents = split_sentences(text)
    lens = [len(s) for s in sents] or [0]
    avg = sum(lens) / len(lens)
    std = statistics.pstdev(lens) if len(lens) > 1 else 0.0
    dialogue_chars = sum(len(m) for m in re.findall(r"[「『“\"][^」』”\"]*[」』”\"]", text))
    total = max(1, len(re.sub(r"\s", "", text)))
    return {
        "avg_sentence_len": round(avg, 2),
        "sentence_stddev": round(std, 2),
        "dialogue_ratio": round(dialogue_chars / total, 3),
        "ai_word_hits": sum(text.count(w) for w in AI_WORDS),
        "sentence_count": len(sents),
    }


def main(argv):
    if len(argv) < 2:
        return fail("用法: style_drift_check.py <novel目录>")
    novel_dir = argv[1]
    ch_dir = os.path.join(novel_dir, "chapters")
    if not os.path.isdir(ch_dir):
        return fail("章节目录不存在: %s" % ch_dir)

    files = iter_chapters(ch_dir, recursive=True)
    if not files:
        return fail("未找到章节")

    baseline = resolve_baseline()
    cfg = load_json(os.path.join(novel_dir, "state", "style-lock.json"), {})
    if isinstance(cfg, dict):
        baseline.update(cfg)

    per_chapter, deviations = [], 0
    for f in files:
        with open(f, "r", encoding="utf-8") as fh:
            text = fh.read()
        m = metrics_for(text)
        dev = 0
        if abs(m["avg_sentence_len"] - baseline["avg_sentence_len"]) > 6:
            dev += 1
        if abs(m["dialogue_ratio"] - baseline["dialogue_ratio"]) > 0.15:
            dev += 1
        if m["sentence_stddev"] < baseline.get("avg_sentence_stddev_min", 3.0):
            dev += 1
        m["deviation"] = dev
        per_chapter.append({"file": os.path.basename(f), **m})
        deviations += dev

    avg_dev = deviations / len(files)
    if avg_dev < 0.5:
        level = "none"
    elif avg_dev < 1.0:
        level = "light"
    elif avg_dev < 1.8:
        level = "moderate"
    else:
        level = "severe"

    emit({"status": "success", "drift_level": level, "avg_deviation": round(avg_dev, 2),
          "baseline": baseline, "per_chapter": per_chapter,
          "warn": level in ("moderate", "severe")})
    return 0


if __name__ == "__main__":
    configure_stdout()
    sys.exit(main(sys.argv))
