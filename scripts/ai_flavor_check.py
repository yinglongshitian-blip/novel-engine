#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ai_flavor_check.py — AI味检测（词汇层 + 题材疲劳词）。

用法:
    python scripts/ai_flavor_check.py .novel/chapters/ch_001.md
    python scripts/ai_flavor_check.py .novel/chapters/        # 自动带上题材疲劳词与白名单

输出: JSON {"status":"success","metaphor_per_1k":X,"ai_word_count":N,
            "fatigue_word_count":M,"fatigue_per_3k":Y,"pass":bool, ...}
阈值: 比喻词每千字 ≤ 2；AI高频词每章 ≤ 3；题材疲劳词每 3000 字 ≤ 1。
白名单（.novel/history/whitelist.md）中的词不计入。
"""
import os
import re
import sys

from _common import configure_stdout, iter_chapters, emit, fail
from knowledge_loader import (load_ai_words, genre_fatigue_words, load_whitelist)

METAPHOR_WORDS = ["仿佛", "宛如", "如同", "好似", "犹如", "恍若"]
AI_WORDS = ["深深", "缓缓", "淡淡", "不禁", "竟然", "瞬间", "微微", "轻轻",
            "默默", "静静", "悄悄", "徐徐", "渐渐"]
LIMITS = {"metaphor_per_1k": 2, "ai_word_per_chapter": 3, "fatigue_word_per_3k": 1}


def strip_whitelist(text, whitelist):
    for w in whitelist:
        if w:
            text = text.replace(w, "")
    return text


def analyze(text, whitelist=None, cfg=None, fatigue_words=None):
    whitelist = whitelist or []
    cfg = cfg or {}
    fatigue_words = fatigue_words or []
    metaphor_words = cfg.get("metaphor_words") or METAPHOR_WORDS
    ai_high = cfg.get("ai_high_freq") or AI_WORDS
    limits = cfg.get("thresholds") or LIMITS

    filtered = strip_whitelist(text, whitelist)
    chars = max(1, len(re.sub(r"\s", "", filtered)))

    metaphor = sum(filtered.count(w) for w in metaphor_words)
    metaphor_per_1k = round(metaphor / chars * 1000, 2)

    ai_hits = {w: filtered.count(w) for w in ai_high if filtered.count(w) > 0}
    ai_total = sum(ai_hits.values())

    fatigue_hits = {w: filtered.count(w) for w in fatigue_words if filtered.count(w) > 0}
    fatigue_total = sum(fatigue_hits.values())
    fatigue_per_3k = round(fatigue_total / chars * 3000, 2)
    # 每 3000 字 ≤1 次 → 按篇幅折算允许次数（短章至少允许 1 次）
    fatigue_allowed = max(1, chars // 3000)

    ok = (metaphor_per_1k <= limits.get("metaphor_per_1k", 2)
          and ai_total <= limits.get("ai_word_per_chapter", 3)
          and fatigue_total <= fatigue_allowed)

    return {
        "chars": chars,
        "metaphor_count": metaphor,
        "metaphor_per_1k": metaphor_per_1k,
        "ai_word_count": ai_total,
        "ai_words": ai_hits,
        "fatigue_word_count": fatigue_total,
        "fatigue_per_3k": fatigue_per_3k,
        "fatigue_allowed": fatigue_allowed,
        "fatigue_words": fatigue_hits,
        "whitelist_applied": len(whitelist),
        "pass": ok,
    }


def main(argv):
    if len(argv) < 2:
        return fail("用法: ai_flavor_check.py <章节文件|目录>")
    target = argv[1]
    files = iter_chapters(target, recursive=True)
    if not files:
        return fail("未找到章节文件")

    # 推断 novel 目录以加载题材疲劳词与白名单
    novel_dir = os.path.dirname(os.path.dirname(os.path.abspath(files[0])))
    cfg = load_ai_words()
    whitelist = load_whitelist(novel_dir, check="ai_flavor") if os.path.isdir(os.path.join(novel_dir, "state")) else []
    fatigue = genre_fatigue_words(novel_dir) if os.path.isdir(os.path.join(novel_dir, "state")) else []
    limits = cfg.get("thresholds") or LIMITS

    per_chapter, all_pass = [], True
    for f in files:
        with open(f, "r", encoding="utf-8") as fh:
            text = fh.read()
        a = analyze(text, whitelist, cfg, fatigue)
        a["file"] = os.path.basename(f)
        per_chapter.append(a)
        all_pass = all_pass and a["pass"]

    if len(per_chapter) == 1:
        emit({"status": "success", **per_chapter[0], "limits": limits})
    else:
        total_chars = sum(c["chars"] for c in per_chapter)
        total_meta = sum(c["metaphor_count"] for c in per_chapter)
        total_ai = sum(c["ai_word_count"] for c in per_chapter)
        total_fatigue = sum(c["fatigue_word_count"] for c in per_chapter)
        emit({"status": "success",
              "metaphor_per_1k": round(total_meta / max(1, total_chars) * 1000, 2),
              "ai_word_count": total_ai,
              "fatigue_word_count": total_fatigue,
              "pass": all_pass, "per_chapter": per_chapter, "limits": limits})
    return 0


if __name__ == "__main__":
    configure_stdout()
    sys.exit(main(sys.argv))
