#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""chapter_cut_check.py — 断章钩子强度检测。

用法:
    python scripts/chapter_cut_check.py .novel/chapters/
    python scripts/chapter_cut_check.py .novel/chapters/ch_001.md

输出: JSON {"status":"success","chapters":[{"chapter":N,"hook_strength":X,"level":"..."}],"weak":[...]}
hook_strength 取值 0-10；<4 触发 🟡 告警。
"""
import os
import re
import sys

from _common import configure_stdout, chapter_number, iter_chapters, emit, fail

# 钩子信号词
HOOK_WORDS = ["突然", "忽然", "竟然", "竟", "难道", "究竟", "却", "但是", "然而",
              "不料", "没想到", "这时", "就在这时", "下一秒", "轰", "砰", "！", "？",
              "为什么", "什么", "谁", "怎么", "不知道的是", "苏醒", "睁开", "冷笑",
              "僵住", "脸色一变", "猛地", "骤然"]
WEAK_ENDINGS = ["于是", "就这样", "后来", "从此", "平静地", "睡着了"]


def score_hook(tail):
    """基于结尾 200 字的钩子信号打分，0-10。"""
    score = 0.0
    if re.search(r"[？?]", tail):
        score += 2.5
    if re.search(r"[！!]", tail):
        score += 1.5
    hits = sum(1 for w in HOOK_WORDS if w in tail)
    score += min(hits, 4) * 1.0
    if "不知道的是" in tail or "殊不知" in tail:
        score += 2.0
    sents = [s.strip() for s in re.split(r"[。！？!?…]+", tail) if s.strip()]
    if sents and len(sents[-1]) <= 12:
        score += 2.0
    if any(w in tail for w in WEAK_ENDINGS):
        score -= 2.0
    if "……" in tail or "..." in tail:
        score += 1.0
    if len(tail.strip()) < 20:
        score -= 1.0
    return max(0.0, min(10.0, round(score, 1)))


def main(argv):
    if len(argv) < 2:
        return fail("用法: chapter_cut_check.py <目录|文件>")
    files = iter_chapters(argv[1], recursive=True)
    if not files:
        return fail("未找到章节文件")

    chapters, weak = [], []
    for f in files:
        try:
            with open(f, "r", encoding="utf-8") as fh:
                text = fh.read()
        except Exception:
            continue
        s = score_hook(text[-200:])
        level = "strong" if s >= 7 else ("medium" if s >= 4 else "weak")
        rec = {"chapter": chapter_number(f), "file": os.path.basename(f),
               "hook_strength": s, "level": level}
        chapters.append(rec)
        if s < 4:
            weak.append(rec)

    emit({"status": "success", "chapters": chapters, "weak": weak, "warn": len(weak) > 0})
    return 0


if __name__ == "__main__":
    configure_stdout()
    sys.exit(main(sys.argv))
