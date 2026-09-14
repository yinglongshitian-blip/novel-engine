#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""_common.py — 脚本共享工具（单一事实来源）。

各脚本通过 `from _common import ...` 复用以下工具，消除重复实现。
以 `python scripts/x.py` 方式运行时，scripts/ 目录会进入 sys.path[0]，
因此可直接导入本模块。
"""
import os
import re
import sys
import json
import glob
import tempfile


def safe_base_dir(path):
    """脚本的写入基目录必须位于当前工作目录或系统临时目录内。

    防止「内容→工具」注入通过传入任意目录，让脚本在项目外落盘固定文件名。
    注意：cwd 与 temp 可能位于不同盘符，commonpath 跨盘会抛 ValueError，
    因此每个 base 单独 try，避免一处异常吞掉其余候选。
    """
    try:
        p = os.path.realpath(path)
    except Exception:
        return False
    for base in (os.getcwd(), tempfile.gettempdir()):
        try:
            b = os.path.realpath(base)
            if os.path.commonpath([p, b]) == b:
                return True
        except Exception:
            continue
    return False


def configure_stdout():
    """在 Windows 控制台强制 UTF-8 输出。"""
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


def safe_relpath(p):
    """跨盘符时 relpath 会抛异常，退化为绝对路径。"""
    try:
        return os.path.relpath(p)
    except ValueError:
        return os.path.abspath(p)


def load_json(path, default=None):
    """读取 JSON；文件缺失或解析失败时返回 default（默认 {}）。"""
    fallback = {} if default is None else default
    if not os.path.isfile(path):
        return fallback
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return fallback


def as_list(data, key):
    """从 dict(key)/list 中提取列表。"""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get(key, [])
    return []


def as_dict(data, default=None):
    """确保返回 dict；否则返回 default（默认 {}）。"""
    if isinstance(data, dict):
        return data
    return {} if default is None else default


def dict_only(items):
    """仅保留 dict 元素，避免对非 dict 项调用 .get 抛异常。"""
    if not isinstance(items, list):
        return []
    return [x for x in items if isinstance(x, dict)]


def chapter_number(path):
    """从文件名解析章节号，如 ch_012.md → 12。"""
    m = re.search(r"ch[_-]?(\d+)", os.path.basename(path), re.IGNORECASE)
    return int(m.group(1)) if m else None


def iter_chapters(target, recursive=True, max_files=5000):
    """返回按章节号排序的章节文件（自动排除 .outline. 章纲）。"""
    if os.path.isfile(target):
        return [target]
    if not os.path.isdir(target):
        return []
    pattern = "**/*.md" if recursive else "*.md"
    files = glob.glob(os.path.join(target, pattern), recursive=recursive)
    files = [f for f in files if ".outline." not in os.path.basename(f)]
    files = sorted(files, key=lambda p: (chapter_number(p) or 10**9, p))
    return files[:max_files]


def emit(obj):
    """向 stdout 输出单行 JSON（UTF-8）。"""
    print(json.dumps(obj, ensure_ascii=False))


def fail(message):
    """输出结构化错误并返回退出码 1（不抛异常）。"""
    emit({"status": "error", "message": message})
    return 1
