#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""knowledge_consistency_check.py — 校验 knowledge/*.md 与 data/*.json 一致。

用法:
    python scripts/knowledge_consistency_check.py

比对:
    1. 02-genres.md       ↔ data/genres.json       （疲劳词）
    2. 05-writing-styles.md ↔ data/styles.json      （24 文风名）
    3. 06-personalities.md ↔ data/personalities.json（14 性格名）
    4. 08-ai-words.md     ↔ data/ai-words.json      （8 类词表）
输出: JSON {"status":"success|error","checks":[...],"issues":[...]}
退出码: 0 一致 / 1 有不一致
"""
import os
import re
import sys

from _common import configure_stdout, emit
from knowledge_loader import (load_genres, load_styles, load_personalities,
                              load_ai_words, KNOWLEDGE_DIR)


def read(p):
    return open(p, encoding="utf-8").read()


def md_genre_fatigue():
    t = read(os.path.join(KNOWLEDGE_DIR, "02-genres.md"))
    out = {}
    for b in re.split(r"^## ", t, flags=re.M)[1:]:
        m = re.match(r"^(\d+)\s+(.+)$", b.split("\n")[0].strip())
        if not m:
            continue
        fm = re.search(r"### 疲劳词\s*\n+([^\n#]+)", b)
        if not fm:
            continue
        raw = re.sub(r"（[^）]*）", "", fm.group(1)).strip()
        out[m.group(2).strip()] = [w.strip() for w in re.split(r"[、,，]", raw) if w.strip()]
    return out


def md_style_names():
    t = read(os.path.join(KNOWLEDGE_DIR, "05-writing-styles.md"))
    return [m.group(1).strip() for m in re.finditer(r"^### \d+\.\d+\s+(.+)$", t, re.M)]


def md_personality_names():
    t = read(os.path.join(KNOWLEDGE_DIR, "06-personalities.md"))
    names = []
    for m in re.finditer(r"^### (\d+)\.\s*(.+)$", t, re.M):
        n = int(m.group(1))
        if 1 <= n <= 14:
            names.append(re.sub(r"（.*?）", "", m.group(2).strip()).strip())
    return names


def main(argv):
    issues = []
    checks = []

    # 1. genres 疲劳词
    md_g = md_genre_fatigue()
    js_g = {i["name"]: i["fatigue_words"] for i in load_genres().get("genres", [])}
    for name, words in md_g.items():
        if name in js_g and js_g[name] != words:
            issues.append({"check": "genres.fatigue", "genre": name, "md": words, "json": js_g[name]})
    checks.append({"check": "genres.fatigue", "md": len(md_g), "json": len(js_g)})

    # 2. styles 名称
    md_s = md_style_names()
    js_s = [s["name"] for s in load_styles().get("styles", [])]
    miss = [n for n in js_s if n not in md_s]
    extra = [n for n in md_s if n not in js_s]
    if miss:
        issues.append({"check": "styles.names", "missing_in_md": miss})
    if extra:
        issues.append({"check": "styles.names", "extra_in_md": extra})
    checks.append({"check": "styles.names", "md": len(md_s), "json": len(js_s)})

    # 3. personalities 名称
    md_p = md_personality_names()
    js_p = [p["name"] for p in load_personalities().get("personalities", [])]
    miss = [n for n in js_p if n not in md_p]
    if miss:
        issues.append({"check": "personalities.names", "missing_in_md": miss})
    checks.append({"check": "personalities.names", "md": len(md_p), "json": len(js_p)})

    # 4. ai-words 词表
    ai_md = read(os.path.join(KNOWLEDGE_DIR, "08-ai-words.md"))
    classes = load_ai_words().get("classes", {})
    for key, cls in classes.items():
        for w in cls.get("words", []):
            if w not in ai_md:
                issues.append({"check": "ai-words.words", "class": key, "word": w,
                               "detail": "json 词未出现在 md"})
    checks.append({"check": "ai-words.classes", "json": len(classes)})

    if issues:
        emit({"status": "error", "checks": checks, "issues": issues})
        return 1
    emit({"status": "success", "checks": checks, "issues": []})
    return 0


if __name__ == "__main__":
    configure_stdout()
    sys.exit(main(sys.argv))
