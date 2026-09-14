#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""merge_chapters.py — 合并导出全书。

用法:
    python scripts/merge_chapters.py .novel/                     # 输出 .novel/merged.md
    python scripts/merge_chapters.py .novel/ --output book.md

输出: JSON {"status":"success","output":"...","chapters":N,"total_words":N}
"""
import os
import re
import sys

from _common import configure_stdout, safe_relpath, iter_chapters, safe_base_dir, emit, fail


def main(argv):
    if len(argv) < 2:
        return fail("用法: merge_chapters.py <novel目录|chapters目录> [--output 文件]")
    target = argv[1]
    if not safe_base_dir(target):
        return fail("目标目录必须位于当前项目目录或系统临时目录内: %s" % target)
    ch_dir = os.path.join(target, "chapters") if os.path.isdir(os.path.join(target, "chapters")) else target
    if not os.path.isdir(ch_dir):
        return fail("章节目录不存在: %s" % ch_dir)

    files = iter_chapters(ch_dir, recursive=True)
    if not files:
        return fail("未找到章节文件")

    raw_output = argv[argv.index("--output") + 1] if "--output" in argv else "merged.md"
    output = raw_output if os.path.isabs(raw_output) else os.path.join(target, raw_output)

    # 安全：输出必须位于项目目录内，防止任意路径覆盖
    try:
        target_abs = os.path.realpath(target)
        out_abs = os.path.realpath(output)
        if os.path.commonpath([out_abs, target_abs]) != target_abs:
            return fail("输出路径必须位于项目目录内: %s" % output)
    except ValueError:
        return fail("输出路径必须位于项目目录内: %s" % output)

    total_words, parts = 0, []
    for f in files:
        with open(f, "r", encoding="utf-8") as fh:
            text = fh.read()
        total_words += len(re.sub(r"\s", "", text))
        parts.append(text.strip())

    try:
        with open(output, "w", encoding="utf-8") as fh:
            fh.write("\n\n---\n\n".join(parts) + "\n")
    except Exception as exc:
        return fail("写入失败: %s" % exc)

    emit({"status": "success", "output": safe_relpath(output),
          "chapters": len(files), "total_words": total_words})
    return 0


if __name__ == "__main__":
    configure_stdout()
    sys.exit(main(sys.argv))
