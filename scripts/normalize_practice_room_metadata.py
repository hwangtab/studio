#!/usr/bin/env python3

from __future__ import annotations

import re
from pathlib import Path

from cleanup_categories import REGION_AND_HUB_SLUGS, STORIES_DIR

GENERIC_TAGS = {
    "음악연습실",
    "연신내 음악연습실",
    "은평구 음악연습실",
    "음악 연습실",
    "연신내 연습실",
    "은평구 연습실",
    "연습실",
}


def replace_field(text: str, field: str, value: str) -> str:
    return re.sub(
        rf'^({field}:\s*)"[^"]*"\s*$',
        rf'\1"{value}"',
        text,
        count=1,
        flags=re.MULTILINE,
    )


def parse_tags(text: str) -> list[str]:
    match = re.search(r"^tags:\s*\[(.*)\]\s*$", text, re.MULTILINE)
    if not match:
        return []
    raw = match.group(1)
    return [part.strip().strip('"') for part in raw.split(",") if part.strip()]


def dump_tags(tags: list[str]) -> str:
    return "tags: [" + ", ".join(f'"{tag}"' for tag in tags) + "]"


def normalize_summary(summary: str) -> str:
    summary = summary.replace("음악연습실", "연습실")
    summary = summary.replace("음악 연습실", "연습실")
    summary = summary.replace("개인 연습실 선택 가이드", "개인 연습실 선택 가이드")
    summary = re.sub(r"\s{2,}", " ", summary).strip()
    return summary


def normalize_tags(tags: list[str]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()

    for tag in tags:
        tag = tag.replace("음악연습실", "연습실").replace("음악 연습실", "연습실").strip()
        if not tag or tag in GENERIC_TAGS:
            continue
        if tag in seen:
            continue
        seen.add(tag)
        cleaned.append(tag)

    return cleaned[:5]


def normalize_file(path: Path) -> bool:
    if path.stem in REGION_AND_HUB_SLUGS:
        return False

    text = path.read_text(encoding="utf-8")
    updated = text

    summary_match = re.search(r'^summary:\s*"([^"]*)"\s*$', updated, re.MULTILINE)
    if summary_match:
        summary = normalize_summary(summary_match.group(1))
        updated = replace_field(updated, "summary", summary)

    tags = parse_tags(updated)
    if tags:
        new_tags = normalize_tags(tags)
        updated = re.sub(r"^tags:\s*\[(.*)\]\s*$", dump_tags(new_tags), updated, count=1, flags=re.MULTILINE)

    if updated == text:
        return False

    path.write_text(updated, encoding="utf-8")
    return True


def main() -> None:
    changed = 0
    for path in sorted(STORIES_DIR.glob("practice-room-*.md")):
        if normalize_file(path):
            changed += 1
    print(f"Normalized {changed} files")


if __name__ == "__main__":
    main()
