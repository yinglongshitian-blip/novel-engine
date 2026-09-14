#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""knowledge_loader.py — 知识库加载器。

加载 knowledge/data/*.json（机器可读层）与 .novel/history/whitelist.md，
供 ai_flavor_check.py / review_engine.py 等脚本消费。
"""
import os
import re

from _common import load_json

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KNOWLEDGE_DIR = os.path.join(_ROOT, "knowledge")
DATA_DIR = os.path.join(KNOWLEDGE_DIR, "data")

WHITELIST_MAX_ENTRIES = 200
WHITELIST_MAX_LEN = 100
_EXACT_RE = re.compile(r"\s*#exact\s*$")
_CHECK_RE = re.compile(r"\s*#check=([A-Za-z0-9_\-]+)\s*")


def data_path(name):
    fn = name if name.endswith(".json") else name + ".json"
    p = os.path.realpath(os.path.join(DATA_DIR, fn))
    base = os.path.realpath(DATA_DIR)
    if os.path.commonpath([p, base]) != base:
        raise ValueError("非法知识库文件: %s" % name)
    return p


def load_data(name, default=None):
    return load_json(data_path(name), default if default is not None else {})


def load_ai_words():
    return load_data("ai-words", {})


def load_genres():
    return load_data("genres", {})


def load_styles():
    return load_data("styles", {})


def load_personalities():
    return load_data("personalities", {})


def project_genre(novel_dir):
    proj = load_json(os.path.join(novel_dir, "state", "project-state.json"), {})
    return (proj.get("genre") or "").strip() if isinstance(proj, dict) else ""


def genre_entry(novel_dir):
    """按项目 genre 返回题材条目（优先自定义题材，其次预设库）。

    自定义题材来自 `.novel/state/custom-genres.json`（自定义出口写入）。
    """
    g = project_genre(novel_dir)
    custom = load_json(os.path.join(novel_dir, "state", "custom-genres.json"), {})
    if isinstance(custom, dict):
        for item in custom.get("genres", []) or []:
            if isinstance(item, dict):
                name = item.get("name", "")
                if g and (name == g or g in name or name in g):
                    return item
    if not g:
        return None
    for item in load_genres().get("genres", []):
        name = item.get("name", "")
        if name == g or g in name or name in g:
            return item
    return None


def genre_fatigue_words(novel_dir):
    data = load_genres()
    words = list(data.get("general_fatigue_words", []))
    entry = genre_entry(novel_dir)
    if entry:
        words += list(entry.get("fatigue_words", []))
    return words


def load_whitelist(novel_dir, check=None):
    """读取 .novel/history/whitelist.md，每行一条，忽略空行与 # 注释。

    支持标记（见 knowledge/15-whitelist.md）：
    - `#exact`      —— 去除标记（语义上按整句登记）
    - `#check=NAME` —— 仅对指定检查放行；无标记的条目对所有检查生效
    安全：单条长度 ≤ WHITELIST_MAX_LEN，总数 ≤ WHITELIST_MAX_ENTRIES，
    防止把整章文本加白而让检查失效。
    """
    path = os.path.join(novel_dir, "history", "whitelist.md")
    if not os.path.isfile(path):
        return []
    out = []
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            s = line.strip()
            if not s or s.startswith("#"):
                continue
            scope = None
            m = _CHECK_RE.search(s)
            if m:
                scope = m.group(1)
                s = _CHECK_RE.sub(" ", s).strip()
            s = _EXACT_RE.sub("", s).strip()
            if not s or len(s) > WHITELIST_MAX_LEN:
                continue
            if check and scope and scope != check:
                continue
            out.append(s)
            if len(out) >= WHITELIST_MAX_ENTRIES:
                break
    return out
