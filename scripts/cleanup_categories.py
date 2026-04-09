#!/usr/bin/env python3

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STORIES_DIR = ROOT / "content" / "stories"

REGION_SLUGS = {
    "practice-room-bucheon1",
    "practice-room-bulgwang1",
    "practice-room-dongdaemun1",
    "practice-room-eunpyeong1",
    "practice-room-gangbuk1",
    "practice-room-gangnam1",
    "practice-room-gangseo1",
    "practice-room-goyang1",
    "practice-room-guro1",
    "practice-room-gwanak1",
    "practice-room-hongdae1",
    "practice-room-jongno1",
    "practice-room-mapo1",
    "practice-room-namyangju1",
    "practice-room-nowon1",
    "practice-room-seongnam1",
    "practice-room-seoul1",
    "practice-room-sinchon1",
    "practice-room-songpa1",
    "practice-room-suwon1",
    "practice-room-uijeongbu1",
    "practice-room-yongsan1",
}
REGION_AND_HUB_SLUGS = REGION_SLUGS | {"practice-room-yeonsinnae1"}

EM_DASH = "—"
ROOM_KEYWORD = "음악연습실"
ROOM_KEYWORD_SPACED = "음악 연습실"
REGION_CATEGORY = "지역 가이드"
INSTRUMENT_CATEGORY = "악기 연습"

TITLE_PATTERNS = [
    (re.compile(rf" {ROOM_KEYWORD} {EM_DASH} "), f" {EM_DASH} "),
    (re.compile(rf" {EM_DASH} 연신내 {ROOM_KEYWORD}에서 "), f" {EM_DASH} "),
    (re.compile(rf" {EM_DASH} 연신내 {ROOM_KEYWORD} "), f" {EM_DASH} "),
    (re.compile(rf" {EM_DASH} {ROOM_KEYWORD}$"), ""),
    (re.compile(rf" {ROOM_KEYWORD} 완전 가이드$"), " 완전 가이드"),
]


def replace_frontmatter_value(text: str, field: str, value: str) -> str:
    pattern = re.compile(rf'^({field}:\s*)"[^"]*"\s*$', re.MULTILINE)
    updated, count = pattern.subn(rf'\1"{value}"', text, count=1)
    if count:
        return updated

    pattern = re.compile(rf"^({field}:\s*).*$", re.MULTILINE)
    updated, count = pattern.subn(rf'\1"{value}"', text, count=1)
    if not count:
        raise ValueError(f"Missing {field} field")
    return updated


def cleanup_title(title: str) -> str:
    cleaned = title
    for pattern, replacement in TITLE_PATTERNS:
        cleaned = pattern.sub(replacement, cleaned)

    cleaned = cleaned.replace(ROOM_KEYWORD_SPACED, "연습실")
    cleaned = cleaned.replace(ROOM_KEYWORD, "연습실")
    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()
    return cleaned


def update_story(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    updated = original

    category = REGION_CATEGORY if path.stem in REGION_AND_HUB_SLUGS else INSTRUMENT_CATEGORY
    updated = replace_frontmatter_value(updated, "category", category)

    if path.stem not in REGION_AND_HUB_SLUGS:
        title_match = re.search(r'^title:\s*"(.*)"\s*$', updated, re.MULTILINE)
        if not title_match:
            raise ValueError(f"Missing title field: {path.name}")
        original_title = title_match.group(1)
        cleaned_title = cleanup_title(original_title)
        updated = replace_frontmatter_value(updated, "title", cleaned_title)

    if updated == original:
        return False

    path.write_text(updated, encoding="utf-8")
    return True


def main() -> None:
    files = sorted(STORIES_DIR.glob("practice-room-*.md"))
    modified = 0

    for path in files:
        if update_story(path):
            modified += 1

    print(f"Scanned {len(files)} files")
    print(f"Modified {modified} files")


if __name__ == "__main__":
    main()
