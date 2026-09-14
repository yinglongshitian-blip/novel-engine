#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""foreshadow_tracker.py — 伏笔检查。

用法:
    python scripts/foreshadow_tracker.py .novel/
    python scripts/foreshadow_tracker.py .novel/state/foreshadow.json

输出: JSON  {"status":"success","total":N,"by_status":{...},"due":[...],"abandoned":[...]}
"""
import os
import sys

from _common import configure_stdout, load_json, dict_only, emit, fail

VALID_STATES = ["planted", "foreshadowed", "reinforced", "pending_reveal",
                "revealed", "resolved", "abandoned"]


def resolve_path(target):
    if os.path.isdir(target):
        return os.path.join(target, "state", "foreshadow.json")
    return target


def main(argv):
    if len(argv) < 2:
        return fail("用法: foreshadow_tracker.py <目录|foreshadow.json>")
    path = resolve_path(argv[1])
    if not os.path.isfile(path):
        return fail("伏笔文件不存在: %s" % path)

    data = load_json(path, None)
    if data is None:
        return fail("解析失败: %s" % path)

    if isinstance(data, list):
        items = data
    elif isinstance(data, dict):
        items = data.get("foreshadows", data.get("items", []))
    else:
        return fail("伏笔文件格式非法: %s" % path)
    if isinstance(items, dict):
        items = list(items.values())
    items = dict_only(items)

    by_status = {s: 0 for s in VALID_STATES}
    due, abandoned, unknown = [], [], []
    for it in items:
        st = it.get("status", "planted")
        if st not in by_status:
            unknown.append(it.get("id"))
            st = "planted"
        by_status[st] += 1
        if st == "pending_reveal":
            due.append({"id": it.get("id"), "content": it.get("content"),
                        "planned_reveal": it.get("planned_reveal")})
        if st == "abandoned":
            abandoned.append({"id": it.get("id"), "reason": it.get("reason")})

    emit({"status": "success", "total": len(items), "by_status": by_status,
          "due": due, "abandoned": abandoned, "unknown_status": unknown})
    return 0


if __name__ == "__main__":
    configure_stdout()
    sys.exit(main(sys.argv))
