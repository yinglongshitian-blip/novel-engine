#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""validate_character.py — 角色行为红线校验。

用法:
    python scripts/validate_character.py .novel/chapters/ch_001.md
    python scripts/validate_character.py .novel/chapters/ch_001.md --cards .novel/state/characters.json

输出: JSON {"status":"success","violations":[...],"checked":N,"checkable":bool,"passed":bool}
红线来源：characters.json 中每个角色的 red_lines 字段。
支持两种写法：
    - 字符串: "不会主动认输"
    - 结构化: {"forbidden": ["认输", "滥杀"]}
"""
import os
import sys

from _common import configure_stdout, load_json, emit, fail


def normalize_rules(card):
    """返回可命中的 forbidden 短语列表。"""
    phrases = set()
    for rule in card.get("red_lines", []) or []:
        if isinstance(rule, dict):
            for p in rule.get("forbidden", []) or []:
                if p:
                    phrases.add(str(p))
        elif isinstance(rule, str):
            core = rule.strip()
            for prefix in ("不会", "不能", "不得", "绝不", "严禁"):
                if core.startswith(prefix):
                    core = core[len(prefix):].strip()
                    break
            if not core:
                continue
            phrases.add(core)
            if len(core) > 2:
                phrases.add(core[-2:])
            if len(core) > 3:
                phrases.add(core[-3:])
    return sorted(phrases)


def load_cards(path):
    data = load_json(path, {})
    if isinstance(data, list):
        items = data
    elif isinstance(data, dict):
        items = data.get("characters", [])
    else:
        items = []
    return [it for it in items if isinstance(it, dict)]


def main(argv):
    if len(argv) < 2:
        return fail("用法: validate_character.py <章节文件> [--cards characters.json]")
    chapter = argv[1]
    if "--cards" in argv:
        cards_path = argv[argv.index("--cards") + 1]
    else:
        d = os.path.dirname(os.path.abspath(chapter))
        cards_path = os.path.join(os.path.dirname(d), "state", "characters.json")

    if not os.path.isfile(chapter):
        return fail("章节文件不存在: %s" % chapter)

    with open(chapter, "r", encoding="utf-8") as fh:
        text = fh.read()

    violations, checked = [], 0
    for card in load_cards(cards_path):
        name = card.get("name")
        if not name or name not in text:
            continue
        for phrase in normalize_rules(card):
            checked += 1
            if phrase in text:
                violations.append({"character": name, "phrase": phrase,
                                   "reason": "正文中出现疑似违反红线的行为: %s" % phrase})

    emit({"status": "success", "checked": checked, "violations": violations,
          "checkable": checked > 0, "passed": len(violations) == 0})
    return 0


if __name__ == "__main__":
    configure_stdout()
    sys.exit(main(sys.argv))
