#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""word_counter.py — 统计章节字数。

用法:
    python scripts/word_counter.py .novel/chapters/
    python scripts/word_counter.py .novel/chapters/ch_001.md

输出: JSON  {"status":"success","total_words":N,"chapters":[{"chapter":N,"word_count":N,...}]}
"""
import sys
import re

from _common import configure_stdout, safe_relpath, chapter_number, iter_chapters, emit, fail


def count_words(text):
    """网文字数：去除空白后的字符数为主，同时给出中文/英文细分。"""
    chars_no_space = len(re.sub(r"\s", "", text))
    cjk = len(re.findall(r"[\u4e00-\u9fff]", text))
    latin_words = len(re.findall(r"[A-Za-z]+", text))
    return {"word_count": chars_no_space, "cjk": cjk, "latin_words": latin_words}


def main(argv):
    if len(argv) < 2:
        return fail("用法: word_counter.py <目录|文件>")
    target = argv[1]
    files = iter_chapters(target, recursive=True)
    if not files:
        return fail("未找到章节文件: %s" % target)

    chapters = []
    total = 0
    for f in files:
        try:
            with open(f, "r", encoding="utf-8") as fh:
                text = fh.read()
        except Exception as exc:
            chapters.append({"file": f, "error": str(exc)})
            continue
        stats = count_words(text)
        total += stats["word_count"]
        chapters.append({
            "chapter": chapter_number(f),
            "file": safe_relpath(f),
            "word_count": stats["word_count"],
            "cjk": stats["cjk"],
            "latin_words": stats["latin_words"],
        })

    emit({"status": "success", "total_words": total, "chapter_count": len(chapters),
          "chapters": chapters})
    return 0


if __name__ == "__main__":
    configure_stdout()
    sys.exit(main(sys.argv))
