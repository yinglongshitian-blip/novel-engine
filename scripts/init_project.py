#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""init_project.py — 初始化小说项目结构。

用法:
    python scripts/init_project.py <项目目录> [--name 书名] [--genre 玄幻] [--work-scale short|medium|long] [--words N]

work_scale 未指定时按 --words 归入档位（≤3万短篇 / 3-10万中篇 / ≥10万长篇），默认 long。
project-state.json 含 work_scale / total_word_target / structure / rhythm 字段。

在目标目录下生成:
    .novel/state/{project-state,action-lines,collision-points,foreshadow,
                  characters,chapter-summaries,decision-log}.json
    .novel/chapters/  .novel/outline.md  .novel/volume.md  .novel/snapshot.md
输出: JSON {"status":"success","root":"...","created":[...]}
"""
import os
import sys
import json
import datetime

from _common import configure_stdout, safe_base_dir, emit, fail
from knowledge_loader import load_data


def scale_from_words(n):
    """按字数归入档位（≤3万短篇 / 3-10万中篇 / ≥10万长篇）。"""
    if n <= 30000:
        return "short"
    if n < 100000:
        return "medium"
    return "long"


def scale_config(scale):
    data = load_data("work-scales", {})
    return (data.get("scales") or {}).get(scale) or {}


def default_state(name, genre, scale="long", word_target=0):
    now = datetime.datetime.now().isoformat(timespec="seconds")
    cfg = scale_config(scale)
    return {
        "project-state.json": {
            "story_name": name, "genre": genre, "trope": "", "golden_finger": "",
            "writing_style": "", "current_phase": "questionnaire", "current_chapter": 0,
            "total_chapters_planned": 0, "writing_mode": "chapter_by_chapter", "temperature": 0.85,
            "work_scale": scale, "total_word_target": word_target,
            "structure": cfg.get("structure", {}), "rhythm": cfg.get("rhythm", {}),
            "created_at": now, "last_updated": now,
        },
        "action-lines.json": {"lines": []},
        "collision-points.json": {"collisions": []},
        "foreshadow.json": {"foreshadows": []},
        "characters.json": {"characters": []},
        "chapter-summaries.json": {"chapters": []},
        "decision-log.json": {"entries": []},
    }


def main(argv):
    if len(argv) < 2:
        return fail("用法: init_project.py <项目目录> [--name 书名] [--genre 玄幻]")
    root = argv[1]
    if not safe_base_dir(root):
        return fail("拒绝在当前项目目录或系统临时目录之外创建: %s" % root)
    name = argv[argv.index("--name") + 1] if "--name" in argv else "未命名"
    genre = argv[argv.index("--genre") + 1] if "--genre" in argv else "玄幻"
    scale = argv[argv.index("--work-scale") + 1] if "--work-scale" in argv else None
    words = int(argv[argv.index("--words") + 1]) if "--words" in argv else 0
    if not scale:
        scale = scale_from_words(words) if words else "long"
    if scale not in ("short", "medium", "long"):
        return fail("未知篇幅档位: %s（应为 short/medium/long）" % scale)

    created = []
    state_dir = os.path.join(root, ".novel", "state")
    ch_dir = os.path.join(root, ".novel", "chapters")
    os.makedirs(state_dir, exist_ok=True)
    os.makedirs(ch_dir, exist_ok=True)
    created += [state_dir, ch_dir]

    for fname, content in default_state(name, genre, scale, words).items():
        path = os.path.join(state_dir, fname)
        if not os.path.isfile(path):
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(content, fh, ensure_ascii=False, indent=2)
            created.append(path)

    templates = {
        "outline.md": "# 主线大纲 — %s\n\n## 主角行动线\n- 角色：\n- 目标：\n- 方向：\n\n## 主线节点\n| 节点 | 碰撞来源 | 涉及线 | 结果 | 预估章节 |\n|------|----------|--------|------|----------|\n" % name,
        "volume.md": "# 卷纲 — 第1卷\n\n## 本卷碰撞网\n| 碰撞点 | 覆盖章节 | 碰撞角色 | 涉及线 | 碰撞结果 |\n|--------|----------|----------|--------|----------|\n",
        "snapshot.md": "# 状态快照\n\n- 当前阶段：questionnaire\n- 当前章节：0\n- 未回收伏笔：0\n\n## 最近决策\n（无）\n",
    }
    for fname, content in templates.items():
        path = os.path.join(root, ".novel", fname)
        if not os.path.isfile(path):
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(content)
            created.append(path)

    emit({"status": "success", "root": os.path.abspath(root),
          "created": [os.path.relpath(p, root) for p in created]})
    return 0


if __name__ == "__main__":
    configure_stdout()
    sys.exit(main(sys.argv))
