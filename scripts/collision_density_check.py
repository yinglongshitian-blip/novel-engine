#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""collision_density_check.py — 碰撞密度检测。

用法:
    python scripts/collision_density_check.py .novel/

规则: 连续 3 章无碰撞 = 告警。
输出: JSON {"status":"success","max_consecutive_no_collision":N,"warn":bool,"gaps":[...]}
"""
import os
import sys

from _common import configure_stdout, load_json, as_list, dict_only, emit, fail


def main(argv):
    if len(argv) < 2:
        return fail("用法: collision_density_check.py <novel目录>")
    state = os.path.join(argv[1], "state")

    summaries = load_json(os.path.join(state, "chapter-summaries.json"), {})
    chapters = dict_only(as_list(summaries, "chapters"))
    if not chapters:
        return fail("无章节摘要数据 (chapter-summaries.json)")

    chapters = sorted(chapters, key=lambda c: c.get("chapter", 0))

    max_run, run, gaps, run_start = 0, 0, [], None
    for ch in chapters:
        no_collision = not (ch.get("collision") or ch.get("core_collision"))
        if no_collision:
            if run == 0:
                run_start = ch.get("chapter")
            run += 1
            max_run = max(max_run, run)
        else:
            if run >= 3:
                gaps.append({"from": run_start, "to": ch.get("chapter", run_start + run - 1),
                             "length": run})
            run = 0
    if run >= 3:
        gaps.append({"from": run_start, "to": run_start + run - 1, "length": run})

    emit({"status": "success", "total_chapters": len(chapters),
          "max_consecutive_no_collision": max_run, "gaps": gaps, "warn": max_run >= 3})
    return 0


if __name__ == "__main__":
    configure_stdout()
    sys.exit(main(sys.argv))
