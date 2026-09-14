#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""snapshot_manager.py — 状态快照保存与恢复。

用法:
    python scripts/snapshot_manager.py save .novel/
    python scripts/snapshot_manager.py restore .novel/

save    : 写出人类可读 snapshot.md + 机器可读 snapshot.json（sidecar，含全部状态）
restore : 依据 sidecar 真正回写缺失/损坏（含 __corrupt 标记）的状态文件
输出: JSON {"status":"success","command":"save|restore",...}
"""
import os
import sys
import json
import datetime

from _common import (configure_stdout, safe_relpath, load_json, as_list, as_dict,
                     dict_only, safe_base_dir, emit, fail)

STATE_FILES = ["project-state.json", "action-lines.json", "collision-points.json",
               "foreshadow.json", "characters.json", "chapter-summaries.json",
               "decision-log.json"]


def do_save(novel_dir):
    state = os.path.join(novel_dir, "state")
    proj = as_dict(load_json(os.path.join(state, "project-state.json"), {}))
    lines = dict_only(as_list(load_json(os.path.join(state, "action-lines.json"), {}), "lines"))
    fs = dict_only(as_list(load_json(os.path.join(state, "foreshadow.json"), {}), "foreshadows"))
    log = dict_only(as_list(load_json(os.path.join(state, "decision-log.json"), {}), "entries"))

    pending = [f for f in fs if f.get("status") in ("planted", "foreshadowed",
                                                     "reinforced", "pending_reveal")]
    recent = log[-3:]

    lines_md = "\n".join("- %s %s（最新推进：第%s章）" % (
        l.get("id"), l.get("character"), l.get("last_advanced_chapter"))
        for l in lines) or "（无）"
    fs_md = "\n".join("- %s [%s] %s" % (f.get("id"), f.get("status"), f.get("content"))
                      for f in pending) or "（无）"
    log_md = "\n".join("- [%s] %s" % (e.get("category"), e.get("decision")) for e in recent) or "（无）"

    content = (
        "# 状态快照\n\n"
        "- 生成时间：%s\n"
        "- 书名：%s\n"
        "- 当前阶段：%s\n"
        "- 当前章节：%s\n"
        "- 未回收伏笔：%d\n\n"
        "## 行动线进度\n%s\n\n"
        "## 未回收伏笔\n%s\n\n"
        "## 最近决策（3条）\n%s\n"
    ) % (
        datetime.datetime.now().isoformat(timespec="seconds"),
        proj.get("story_name", "未命名"),
        proj.get("current_phase", "unknown"),
        proj.get("current_chapter", 0),
        len(pending), lines_md, fs_md, log_md,
    )

    path = os.path.join(novel_dir, "snapshot.md")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(content)

    sidecar = os.path.join(novel_dir, "snapshot.json")
    snapshot_data = {
        "saved_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "files": {name: load_json(os.path.join(state, name), {}) for name in STATE_FILES},
    }
    with open(sidecar, "w", encoding="utf-8") as fh:
        json.dump(snapshot_data, fh, ensure_ascii=False, indent=2)

    return {"status": "success", "command": "save", "path": safe_relpath(path),
            "sidecar": safe_relpath(sidecar),
            "phase": proj.get("current_phase"), "chapter": proj.get("current_chapter"),
            "pending_foreshadows": len(pending), "recent_decisions": len(recent)}


def do_restore(novel_dir):
    state = os.path.join(novel_dir, "state")
    path = os.path.join(novel_dir, "snapshot.md")
    sidecar = os.path.join(novel_dir, "snapshot.json")
    if not os.path.isfile(path) and not os.path.isfile(sidecar):
        return {"status": "error", "command": "restore", "message": "快照不存在: %s" % path}

    snapshot_chars = 0
    if os.path.isfile(path):
        with open(path, "r", encoding="utf-8") as fh:
            snapshot_chars = len(fh.read())

    if not os.path.isfile(sidecar):
        return {"status": "error", "command": "restore",
                "message": "缺少机器可读 sidecar (snapshot.json)，无法回写状态"}

    try:
        with open(sidecar, "r", encoding="utf-8") as fh:
            snap = json.load(fh)
    except Exception as exc:
        return {"status": "error", "command": "restore", "message": "sidecar 解析失败: %s" % exc}

    files = snap.get("files") if isinstance(snap, dict) else None
    if not isinstance(files, dict):
        return {"status": "error", "command": "restore",
                "message": "sidecar 格式非法：files 必须为对象"}

    # 真正回写：仅允许 STATE_FILES 白名单内的键，防止路径穿越写入
    restored, skipped, rejected = [], [], []
    for name, content in files.items():
        if name not in STATE_FILES:
            rejected.append(name)
            continue
        target = os.path.join(state, name)
        need = True
        if os.path.isfile(target):
            try:
                with open(target, "r", encoding="utf-8") as fh:
                    cur = json.load(fh)
                need = bool(cur.get("__corrupt")) if isinstance(cur, dict) else False
            except Exception:
                need = True
        if need:
            os.makedirs(state, exist_ok=True)
            tmp = target + ".restore.tmp"
            with open(tmp, "w", encoding="utf-8") as fh:
                json.dump(content, fh, ensure_ascii=False, indent=2)
            os.replace(tmp, target)
            restored.append(name)
        else:
            skipped.append(name)

    proj = as_dict(load_json(os.path.join(state, "project-state.json"), {}))
    lines = dict_only(as_list(load_json(os.path.join(state, "action-lines.json"), {}), "lines"))
    log = dict_only(as_list(load_json(os.path.join(state, "decision-log.json"), {}), "entries"))

    return {"status": "success", "command": "restore", "snapshot_chars": snapshot_chars,
            "restored": restored, "skipped": skipped, "rejected": rejected,
            "phase": proj.get("current_phase"), "chapter": proj.get("current_chapter"),
            "active_lines": [l.get("id") for l in lines if l.get("status") == "active"],
            "recent_decisions": log[-3:]}


def main(argv):
    if len(argv) < 3:
        return fail("用法: snapshot_manager.py <save|restore> <novel目录>")
    cmd, novel_dir = argv[1], argv[2]
    if not safe_base_dir(novel_dir):
        return fail("快照目录必须位于当前项目目录或系统临时目录内: %s" % novel_dir)
    if cmd == "save":
        result = do_save(novel_dir)
    elif cmd == "restore":
        result = do_restore(novel_dir)
    else:
        return fail("未知命令: %s" % cmd)
    emit(result)
    return 0 if result.get("status") == "success" else 1


if __name__ == "__main__":
    configure_stdout()
    sys.exit(main(sys.argv))
