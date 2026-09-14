#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""consistency_check.py — 跨状态文件一致性检查。

用法:
    python scripts/consistency_check.py .novel/

检查项:
  1. 章节摘要引用的碰撞点是否存在于 collision-points.json
  2. 碰撞点引用的行动线是否存在
  3. 伏笔状态是否合法
  4. project-state.current_chapter 是否与实际章节数一致
输出: JSON {"status":"success","issues":[...],"passed":bool}
"""
import os
import sys

from _common import (configure_stdout, load_json, as_list, as_dict, dict_only,
                     iter_chapters, emit, fail)

VALID_FORESHADOW = ["planted", "foreshadowed", "reinforced", "pending_reveal",
                    "revealed", "resolved", "abandoned"]


def main(argv):
    if len(argv) < 2:
        return fail("用法: consistency_check.py <novel目录>")
    novel_dir = argv[1]
    state = os.path.join(novel_dir, "state")
    if not os.path.isdir(state):
        return fail("状态目录不存在: %s" % state)

    cp = dict_only(as_list(load_json(os.path.join(state, "collision-points.json"), {}), "collisions"))
    al = dict_only(as_list(load_json(os.path.join(state, "action-lines.json"), {}), "lines"))
    fs = dict_only(as_list(load_json(os.path.join(state, "foreshadow.json"), {}), "foreshadows"))
    summaries = dict_only(as_list(load_json(os.path.join(state, "chapter-summaries.json"), {}), "chapters"))
    proj = as_dict(load_json(os.path.join(state, "project-state.json"), {}))

    cp_ids = {c.get("id") for c in cp}
    line_ids = {l.get("id") for l in al}
    issues = []

    for s in summaries:
        cid = s.get("collision")
        if cid and cid not in cp_ids:
            issues.append({"type": "unknown_collision", "chapter": s.get("chapter"),
                           "detail": "章节引用了不存在的碰撞点: %s" % cid})

    for c in cp:
        for lid in c.get("lines_involved", []) or []:
            if lid and lid not in line_ids and lid not in ("主线", "main"):
                issues.append({"type": "unknown_line", "collision": c.get("id"),
                               "detail": "碰撞点引用了不存在的行动线: %s" % lid})

    for f in fs:
        if f.get("status") not in VALID_FORESHADOW:
            issues.append({"type": "invalid_foreshadow_status", "id": f.get("id"),
                           "detail": "非法伏笔状态: %s" % f.get("status")})

    actual = len(iter_chapters(os.path.join(novel_dir, "chapters")))
    cur = proj.get("current_chapter")
    if isinstance(cur, int) and cur > actual:
        issues.append({"type": "chapter_mismatch",
                       "detail": "project-state.current_chapter=%d 大于实际章节数 %d" % (cur, actual)})

    emit({"status": "success", "issues": issues, "passed": len(issues) == 0,
          "counts": {"collisions": len(cp), "lines": len(al),
                     "foreshadows": len(fs), "summaries": len(summaries)}})
    return 0


if __name__ == "__main__":
    configure_stdout()
    sys.exit(main(sys.argv))
