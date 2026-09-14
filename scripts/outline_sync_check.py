#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""outline_sync_check.py — 大纲与卷纲同步校验。

用法:
    python scripts/outline_sync_check.py .novel/outline.md .novel/volume.md
    python scripts/outline_sync_check.py .novel/

输出: JSON {"status":"success","synced":bool,"missing_in_volume":[...],"missing_in_outline":[...]}
"""
import os
import re
import sys

from _common import configure_stdout, emit, fail

CP_RE = re.compile(r"CP[-\s]?(\d+)", re.IGNORECASE)


def resolve(target):
    if os.path.isdir(target):
        return (os.path.join(target, "outline.md"), os.path.join(target, "volume.md"))
    return (target, None)


def ids(text, regex):
    return set(int(x) for x in regex.findall(text))


def main(argv):
    if len(argv) < 2:
        return fail("用法: outline_sync_check.py <outline.md> <volume.md> | <novel目录>")
    outline, volume = resolve(argv[1])
    if volume is None:
        if len(argv) < 3:
            return fail("需要同时提供 outline.md 与 volume.md")
        volume = argv[2]

    if not os.path.isfile(outline):
        return fail("大纲不存在: %s" % outline)
    if not os.path.isfile(volume):
        return fail("卷纲不存在: %s" % volume)

    with open(outline, "r", encoding="utf-8") as fh:
        o_text = fh.read()
    with open(volume, "r", encoding="utf-8") as fh:
        v_text = fh.read()

    o_cp, v_cp = ids(o_text, CP_RE), ids(v_text, CP_RE)
    missing_in_volume = sorted(o_cp - v_cp)
    missing_in_outline = sorted(v_cp - o_cp)

    emit({"status": "success", "synced": not missing_in_volume and not missing_in_outline,
          "outline_collisions": sorted(o_cp), "volume_collisions": sorted(v_cp),
          "missing_in_volume": missing_in_volume, "missing_in_outline": missing_in_outline})
    return 0


if __name__ == "__main__":
    configure_stdout()
    sys.exit(main(sys.argv))
