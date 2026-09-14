#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""character_tracker.py — 角色出场统计。

用法:
    python scripts/character_tracker.py .novel/
    python scripts/character_tracker.py .novel/ --name 林凡

输出: JSON  {"status":"success","characters":[{"name":..,"count":..,"chapters":[..]}],"total_appearances":N}
"""
import os
import sys

from _common import configure_stdout, load_json, iter_chapters, emit, fail


def load_names(novel_dir):
    """从 characters.json 读取角色名。"""
    data = load_json(os.path.join(novel_dir, "state", "characters.json"), {})
    if isinstance(data, list):
        items = data
    elif isinstance(data, dict):
        items = data.get("characters", [])
    else:
        items = []
    names = []
    for it in items:
        if isinstance(it, dict) and it.get("name"):
            names.append(it["name"])
        elif isinstance(it, str):
            names.append(it)
    return names


def main(argv):
    if len(argv) < 2:
        return fail("用法: character_tracker.py <novel目录>")
    novel_dir = argv[1]

    names = load_names(novel_dir)
    if not names:
        if "--name" in argv:
            names = [argv[argv.index("--name") + 1]]
        else:
            return fail("未找到角色（characters.json 为空或不存在）")

    files = iter_chapters(os.path.join(novel_dir, "chapters"))
    if not files:
        return fail("未找到章节文件")

    stats = {n: {"count": 0, "chapters": []} for n in names}
    for f in files:
        try:
            with open(f, "r", encoding="utf-8") as fh:
                text = fh.read()
        except Exception:
            continue
        for n in names:
            c = text.count(n)
            if c:
                stats[n]["count"] += c
                stats[n]["chapters"].append(os.path.basename(f))

    characters = [{"name": n, "count": v["count"], "chapters": v["chapters"]}
                  for n, v in stats.items()]
    characters.sort(key=lambda x: x["count"], reverse=True)
    emit({"status": "success", "characters": characters,
          "total_appearances": sum(v["count"] for v in stats.values()),
          "chapter_count": len(files)})
    return 0


if __name__ == "__main__":
    configure_stdout()
    sys.exit(main(sys.argv))
