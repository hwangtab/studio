#!/usr/bin/env python3

from __future__ import annotations

import argparse
import re
from collections import Counter
from pathlib import Path

from cleanup_categories import REGION_AND_HUB_SLUGS, STORIES_DIR

ROOT = Path(__file__).resolve().parent.parent
REDIRECTS_TS = ROOT / "lib" / "storyRedirects.ts"

KEEP_SLUGS = {
    "practice-room-guide1",
    "practice-room-price1",
    "practice-room-rental1",
    "practice-room-monthly1",
    "practice-room-soundproof1",
    "practice-room-private1",
    "practice-room-booking1",
    "practice-room-first1",
    "practice-room-equipment1",
    "practice-room-contract1",
}

STRATEGIC_REWRITE_SLUGS = {
    "practice-room-unmanned1",
    "practice-room-startup1",
    "practice-room-transfer1",
    "practice-room-vocal1",
    "practice-room-guitar1",
    "practice-room-piano1",
    "practice-room-drum1",
    "practice-room-bass1",
    "practice-room-keyboard1",
    "practice-room-night1",
    "practice-room-hobby1",
    "practice-room-weekend1",
    "practice-room-lesson1",
    "practice-room-audition1",
    "practice-room-recording1",
    "practice-room-storage1",
    "practice-room-nodeposit1",
    "practice-room-etiquette1",
    "practice-room-cover1",
    "practice-room-midi1",
    "practice-room-entrance1",
}

EXACT_TARGETS = {
    "practice-room-vs-home1": "practice-room-guide1",
    "practice-room-vs-studio1": "practice-room-guide1",
    "practice-room-vs-karaoke1": "practice-room-guide1",
    "practice-room-vs-rehearsal1": "practice-room-guide1",
    "practice-room-music-college1": "practice-room-entrance1",
    "practice-room-pre-recording1": "practice-room-recording1",
    "practice-room-singer-songwriter1": "practice-room-midi1",
    "practice-room-office-worker1": "practice-room-hobby1",
    "practice-room-voice-training1": "practice-room-vocal1",
    "practice-room-piano-beginner1": "practice-room-piano1",
    "practice-room-guitar-beginner1": "practice-room-guitar1",
    "practice-room-vocal-beginner1": "practice-room-vocal1",
    "practice-room-rehearsal-vocal1": "practice-room-vocal1",
    "practice-room-content-creator1": "practice-room-recording1",
    "practice-room-voice-health1": "practice-room-vocal1",
    "practice-room-goal-setting1": "practice-room-hobby1",
    "practice-room-ensemble-prep1": "practice-room-lesson1",
    "practice-room-smart-practice1": "practice-room-lesson1",
    "practice-room-ear-training1": "practice-room-lesson1",
    "practice-room-breath-control1": "practice-room-vocal1",
    "practice-room-sight-reading1": "practice-room-lesson1",
    "practice-room-stage-manner1": "practice-room-audition1",
    "practice-room-mental-training1": "practice-room-hobby1",
    "practice-room-classical-guitar1": "practice-room-guitar1",
    "practice-room-latin-music1": "practice-room-guide1",
    "practice-room-piano-technique1": "practice-room-piano1",
    "practice-room-bass-technique1": "practice-room-bass1",
    "practice-room-musical-theater1": "practice-room-vocal1",
    "practice-room-chord-melody1": "practice-room-guitar1",
    "practice-room-drum-rudiment1": "practice-room-drum1",
    "practice-room-vocal-power1": "practice-room-vocal1",
    "practice-room-vocal-range1": "practice-room-vocal1",
    "practice-room-pop-piano1": "practice-room-piano1",
    "practice-room-music-portfolio1": "practice-room-entrance1",
    "practice-room-electric-guitar1": "practice-room-guitar1",
    "practice-room-electric-bass1": "practice-room-bass1",
    "practice-room-digital-piano1": "practice-room-keyboard1",
    "practice-room-keyboard-synth1": "practice-room-keyboard1",
    "practice-room-online-lesson1": "practice-room-lesson1",
    "practice-room-video-audition1": "practice-room-audition1",
    "practice-room-self-study1": "practice-room-lesson1",
    "practice-room-band-vocal1": "practice-room-vocal1",
    "practice-room-college-student1": "practice-room-hobby1",
    "practice-room-classical1": "practice-room-soundproof1",
    "practice-room-anxiety1": "practice-room-audition1",
    "practice-room-ccm1": "practice-room-vocal1",
    "practice-room-church1": "practice-room-vocal1",
    "practice-room-composition1": "practice-room-midi1",
    "practice-room-jazz1": "practice-room-guide1",
    "practice-room-mix-voice1": "practice-room-vocal1",
    "practice-room-opera1": "practice-room-vocal1",
    "practice-room-violin1": "practice-room-soundproof1",
    "practice-room-accompanist1": "practice-room-piano1",
    "practice-room-acoustic-guitar1": "practice-room-guitar1",
    "practice-room-pop-vocal1": "practice-room-vocal1",
    "practice-room-kpop1": "practice-room-cover1",
    "practice-room-musical1": "practice-room-vocal1",
    "practice-room-rappers1": "practice-room-vocal1",
    "practice-room-shortterm1": "practice-room-hobby1",
    "practice-room-cajon1": "practice-room-drum1",
    "practice-room-percussion1": "practice-room-drum1",
    "practice-room-jazz-piano1": "practice-room-piano1",
    "practice-room-ukulele1": "practice-room-guitar1",
    "practice-room-journal1": "practice-room-hobby1",
}

FAMILY_TARGETS = {
    "guitar": "practice-room-guitar1",
    "piano": "practice-room-piano1",
    "vocal": "practice-room-vocal1",
    "drum": "practice-room-drum1",
    "bass": "practice-room-bass1",
}

TITLE_FIXES = {
    "practice-room-recording1.md": 'title: "녹음 가능한 연습실 — 연습실 내 셀프 녹음 완벽 가이드"',
    "practice-room-storage1.md": 'title: "악기 보관 가능한 연습실 — 월세 입주 악기 보관 완벽 가이드"',
    "practice-room-nodeposit1.md": 'title: "보증금 없는 연습실 — 부담 없이 시작하는 입주 연습실 가이드"',
    "practice-room-entrance1.md": 'title: "실용음악 입시생 연습실 가이드 — 입시 준비를 위한 연습 공간 선택법"',
}


def read_frontmatter_field(text: str, field: str) -> str:
    match = re.search(rf'^{field}:\s*"([^"]*)"', text, re.MULTILINE)
    if match:
        return match.group(1)

    match = re.search(rf"^{field}:\s*(.+)$", text, re.MULTILINE)
    return match.group(1).strip() if match else ""


def get_slug_prefix(slug: str) -> str:
    tail = slug.removeprefix("practice-room-")
    return re.sub(r"\d+$", "", tail.split("-")[0])


def get_preserved_slugs() -> set[str]:
    return set(REGION_AND_HUB_SLUGS) | KEEP_SLUGS | STRATEGIC_REWRITE_SLUGS


def resolve_target(slug: str, title: str, summary: str) -> str:
    if slug in EXACT_TARGETS:
        return EXACT_TARGETS[slug]

    prefix = get_slug_prefix(slug)
    if prefix in FAMILY_TARGETS:
        return FAMILY_TARGETS[prefix]

    text = f"{slug} {title} {summary}".lower()

    if "practice-room-vs-" in slug or " 비교 " in text:
        return "practice-room-guide1"

    if any(keyword in text for keyword in ("입시", "예술고", "예고", "예중", "실기", "포트폴리오")):
        return "practice-room-entrance1"

    if any(keyword in text for keyword in ("오디션", "경연", "가요제")):
        return "practice-room-audition1"

    if any(keyword in text for keyword in ("커버", "k-pop", "kpop", "축가", "버스킹", "발표회", "메들리", "이벤트", "아이돌")):
        return "practice-room-cover1"

    if any(keyword in text for keyword in ("녹음", "레코딩", "데모", "오버더빙", "스트리밍", "영상", "콘텐츠")):
        return "practice-room-recording1"

    if any(keyword in text for keyword in ("미디", "daw", "작곡", "편곡", "프로덕션", "송라이팅")):
        return "practice-room-midi1"

    if any(keyword in text for keyword in ("직장인", "취미", "성인", "육아", "주부", "시니어", "가족", "커플", "복귀", "중장년")):
        return "practice-room-hobby1"

    if any(keyword in text for keyword in ("습관", "동기", "번아웃", "힐링", "스트레스", "집중", "체력", "몸 관리", "자세", "일지", "목표")):
        return "practice-room-hobby1"

    if any(keyword in text for keyword in ("레슨", "독학", "자격증", "시험", "이론", "청음", "리듬", "임프로비제이션", "표현력")):
        return "practice-room-lesson1"

    if "무인" in text:
        return "practice-room-unmanned1"

    if any(keyword in text for keyword in ("양도", "인수", "권리금")):
        return "practice-room-transfer1"

    if any(keyword in text for keyword in ("창업", "인허가", "수익 구조")):
        return "practice-room-startup1"

    if "보증금" in text:
        return "practice-room-nodeposit1"

    if any(keyword in text for keyword in ("보관", "악기 보관")):
        return "practice-room-storage1"

    if any(keyword in text for keyword in ("에티켓", "규칙")):
        return "practice-room-etiquette1"

    if any(keyword in text for keyword in ("야간", "새벽", "24시간")):
        return "practice-room-night1"

    if "주말" in text:
        return "practice-room-weekend1"

    if any(keyword in text for keyword in ("방음", "흡음")):
        return "practice-room-soundproof1"

    if any(keyword in text for keyword in ("장비", "냉난방", "환경")):
        return "practice-room-equipment1"

    if any(keyword in text for keyword in ("개인실", "드럼 없는", "독립 공간")):
        return "practice-room-private1"

    if any(keyword in text for keyword in ("예약", "대여")):
        return "practice-room-booking1"

    if any(keyword in text for keyword in ("처음", "입문")):
        return "practice-room-first1"

    if any(keyword in text for keyword in ("월세", "입주", "계약")):
        return "practice-room-monthly1"

    if any(keyword in text for keyword in ("건반", "키보드", "신디사이저", "신스", "디지털 피아노", "전자 키보드")):
        return "practice-room-keyboard1"

    if any(keyword in text for keyword in ("피아노", "반주자", "반주")):
        return "practice-room-piano1"

    if any(keyword in text for keyword in ("보컬", "노래", "발성", "성악", "합창", "코러스", "래퍼", "ccm", "찬양", "오페라", "뮤지컬")):
        return "practice-room-vocal1"

    if any(keyword in text for keyword in ("기타", "핑거스타일", "핑거피킹", "통기타", "어쿠스틱")):
        return "practice-room-guitar1"

    if any(keyword in text for keyword in ("드럼", "카혼", "퍼커션")):
        return "practice-room-drum1"

    if any(keyword in text for keyword in ("베이스", "더블베이스")):
        return "practice-room-bass1"

    if any(keyword in text for keyword in ("바이올린", "첼로", "플루트", "트럼펫", "색소폰", "오보에", "우쿨렐레", "현악기", "관악기", "목관악기", "금관악기", "국악")):
        return "practice-room-guide1"

    return "practice-room-guide1"


def write_redirects_ts(redirects: dict[str, str], preserved: set[str] | None = None) -> None:
    existing = load_existing_redirects()
    merged = {**existing, **redirects}
    if preserved:
        for slug in preserved:
            merged.pop(slug, None)

    lines = [
        "// Generated by scripts/prune_practice_room_cluster.py",
        "",
        "export const storyRedirects: Record<string, string> = {",
    ]

    for slug, target in sorted(merged.items()):
        lines.append(f'  "{slug}": "{target}",')

    lines.extend(
        [
            "};",
            "",
            "export const getStoryRedirectTarget = (slug: string): string | null => storyRedirects[slug] ?? null;",
            "",
        ]
    )

    REDIRECTS_TS.write_text("\n".join(lines), encoding="utf-8")


def load_existing_redirects() -> dict[str, str]:
    if not REDIRECTS_TS.exists():
        return {}

    text = REDIRECTS_TS.read_text(encoding="utf-8")
    pairs = re.findall(r'"([^"]+)": "([^"]+)"', text)
    return {slug: target for slug, target in pairs}


def apply_title_fixes() -> int:
    fixed = 0
    for filename, title_line in TITLE_FIXES.items():
        path = STORIES_DIR / filename
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        updated = re.sub(r'^title:\s*"[^"]*"\s*$', title_line, text, count=1, flags=re.MULTILINE)
        if updated != text:
            path.write_text(updated, encoding="utf-8")
            fixed += 1
    return fixed


def build_redirect_map() -> tuple[dict[str, str], set[str]]:
    preserved = get_preserved_slugs()
    redirects: dict[str, str] = {}

    for path in sorted(STORIES_DIR.glob("practice-room-*.md")):
        slug = path.stem
        if slug in preserved:
            continue

        text = path.read_text(encoding="utf-8")
        title = read_frontmatter_field(text, "title")
        summary = read_frontmatter_field(text, "summary")
        target = resolve_target(slug, title, summary)
        if target == slug:
            raise ValueError(f"Self redirect detected: {slug}")
        redirects[slug] = target

    missing_targets = {target for target in redirects.values() if not (STORIES_DIR / f"{target}.md").exists()}
    if missing_targets:
        raise ValueError(f"Missing redirect targets: {sorted(missing_targets)}")

    return redirects, preserved


def print_summary(redirects: dict[str, str], preserved: set[str]) -> None:
    target_counts = Counter(redirects.values())
    print(f"Preserved: {len(preserved)}")
    print(f"Redirected/removed: {len(redirects)}")
    print("Top targets:")
    for target, count in target_counts.most_common(20):
        print(f"  {count:>3} -> {target}")


def apply_redirect_prune(redirects: dict[str, str]) -> int:
    removed = 0
    for slug in sorted(redirects):
        path = STORIES_DIR / f"{slug}.md"
        if path.exists():
            path.unlink()
            removed += 1
    return removed


def main() -> None:
    parser = argparse.ArgumentParser(description="Prune low-value practice-room stories and generate redirects.")
    parser.add_argument("--apply", action="store_true", help="Delete redirected files and write redirects file.")
    args = parser.parse_args()

    redirects, preserved = build_redirect_map()
    print_summary(redirects, preserved)

    if not args.apply:
        return

    title_fixes = apply_title_fixes()
    write_redirects_ts(redirects, preserved)
    removed = apply_redirect_prune(redirects)

    print(f"Applied title fixes: {title_fixes}")
    print(f"Removed files: {removed}")
    print(f"Wrote redirects: {REDIRECTS_TS}")


if __name__ == "__main__":
    main()
