#!/usr/bin/env python3

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STORIES_DIR = ROOT / "content" / "stories"

FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n?", re.S)
IMAGE_RE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")
STORY_LINK_RE = re.compile(r"\[([^\]]+)\]\((/stories/[^)]+)\)")
LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
LINK_LINE_RE = re.compile(r"(?:\[[^\]]+\]\([^)]+\))(?:\s*\|\s*\[[^\]]+\]\([^)]+\))*\s*$")

SOFT_CTA_TITLE_KEYWORDS = (
    "예약",
    "세션",
    "방문",
    "이용",
    "커버곡",
    "축가",
    "오디션 데모",
    "보컬 데모",
    "체크리스트",
    "처음 보컬 녹음",
    "스튜디오 놀",
)

PRICING_CTA_TITLE_KEYWORDS = (
    "예약",
    "세션",
    "방문",
    "이용",
    "커버곡",
    "축가",
    "오디션 데모",
    "보컬 데모",
    "체크리스트",
    "처음 보컬 녹음",
    "스튜디오 놀",
    "요금",
    "가격",
)

REGION_CATEGORY = "지역 가이드"

TEXT_REPLACEMENTS: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(r"온라인 믹싱 의뢰 방법"),
        "온라인 믹싱 가이드",
    ),
    (
        re.compile(r"방문 전 카카오톡(?: 오픈채팅)?으로 예약 시간을 먼저 잡아두시면 대기 없이 바로 세션에 들어갈 수 있습니다\."),
        "방문 전에는 카카오톡 문의로 일정과 준비 사항을 미리 확인해두는 편이 좋습니다.",
    ),
    (
        re.compile(r"세션 일정은 카카오톡(?: 오픈채팅)?으로 미리 조율해두시면 도착 즉시 바로 세션에 들어갈 수 있습니다\."),
        "세션 일정은 카카오톡 문의로 미리 확인해두는 편이 좋습니다.",
    ),
    (
        re.compile(r"세션 일정은 카카오톡(?: 오픈채팅)?으로 미리 잡아두시면 대기 없이 바로 시작합니다\."),
        "세션 일정은 카카오톡 문의로 미리 확인해두는 편이 좋습니다.",
    ),
    (
        re.compile(r"세션 일정은 카카오톡(?: 오픈채팅)?으로 미리 조율해주세요\."),
        "세션 일정과 준비 사항은 카카오톡 문의로 미리 확인해두는 편이 좋습니다.",
    ),
    (
        re.compile(r"카카오톡(?: 오픈채팅)?으로 문의하시면 예약과 맞춤 견적을 안내드립니다\."),
        "카카오톡 문의로 일정과 비용 범위를 확인할 수 있습니다.",
    ),
    (
        re.compile(r"카카오톡(?: 오픈채팅)?으로 문의하시면 용도에 맞는 패키지 견적을 드립니다\."),
        "카카오톡 문의로 용도에 맞는 진행 방식과 비용 범위를 확인할 수 있습니다.",
    ),
    (
        re.compile(r"카카오톡(?: 오픈채팅)?으로 문의하시면 맞춤 안내를 드립니다\."),
        "카카오톡 문의로 일정과 진행 방식을 확인할 수 있습니다.",
    ),
    (
        re.compile(r"카카오톡(?: 오픈채팅)?으로 문의하시면 당일 예약도 가능합니다\."),
        "카카오톡 문의로 당일 이용 가능 여부를 확인할 수 있습니다.",
    ),
    (
        re.compile(r"카카오톡(?: 오픈채팅)?으로 문의하시면 빠르게 확인해드립니다\."),
        "카카오톡 문의로 빠르게 확인할 수 있습니다.",
    ),
    (
        re.compile(r"카카오톡(?: 오픈채팅)?으로 예약 문의 주세요\."),
        "카카오톡으로 일정을 확인해주세요.",
    ),
    (
        re.compile(r"카카오톡(?: 오픈채팅)?으로 예약해주세요\."),
        "카카오톡 문의로 일정과 이용 가능 여부를 확인해주세요.",
    ),
    (
        re.compile(r"카카오톡(?: 오픈채팅)?으로 예약하세요\."),
        "카카오톡 문의로 일정과 이용 가능 여부를 확인하세요.",
    ),
    (
        re.compile(r"예약 문의는 카카오톡(?: 오픈채팅)?으로 주시면 됩니다\."),
        "문의는 카카오톡으로 남기면 됩니다.",
    ),
    (
        re.compile(r"카카오톡(?: 오픈채팅)?으로 녹음 목적\(음원 발매, 축가, 연습용 등\)과 희망 날짜·시간, 곡 수를 알려주시면 됩니다\. 당일 답변을 드리며 일정을 확정합니다\."),
        "카카오톡 문의로 녹음 목적과 희망 날짜, 곡 수를 남기면 됩니다. 확인 가능한 일정 범위를 안내합니다.",
    ),
    (
        re.compile(r"카카오톡(?: 오픈채팅)?으로 문의하시면 됩니다\."),
        "카카오톡 문의로 일정을 확인하시면 됩니다.",
    ),
    (
        re.compile(r"카카오톡(?: 오픈채팅)?으로 전달하면 전문 믹싱·마스터링 후 완성 파일을 납품합니다\."),
        "카카오톡 문의나 파일 링크로 전달하면 전문 믹싱·마스터링 후 완성 파일을 받을 수 있습니다.",
    ),
    (
        re.compile(r"카카오톡(?: 오픈채팅)?으로 파일을 전송하면 믹싱·마스터링을 온라인으로 진행할 수 있습니다\."),
        "카카오톡 문의나 파일 링크로 전달하면 믹싱·마스터링을 온라인으로 진행할 수 있습니다.",
    ),
    (
        re.compile(r"카카오톡(?: 오픈채팅)?으로 파일을 공유하거나"),
        "카카오톡 문의로 파일을 전달하거나",
    ),
    (
        re.compile(r"카카오톡(?: 오픈채팅)?으로 당일 빈 세션을 확인할 수 있습니다\."),
        "카카오톡 문의로 당일 이용 가능 여부를 확인할 수 있습니다.",
    ),
    (
        re.compile(r"카카오톡(?: 오픈채팅)?으로 당일 또는 단기 예약을 문의(?:해 주세요|하세요)\."),
        "카카오톡 문의로 당일 이용 가능 여부를 확인해보세요.",
    ),
    (
        re.compile(r"카카오톡(?: 오픈채팅)?으로 시간대를 확인하세요\."),
        "카카오톡 문의로 이용 가능한 시간대를 확인하세요.",
    ),
    (
        re.compile(r"카카오톡(?: 오픈채팅)?으로 당일 예약도 접수됩니다\."),
        "카카오톡 문의로 당일 이용 가능 여부도 확인할 수 있습니다.",
    ),
    (
        re.compile(r"카카오톡(?: 오픈채팅)?으로 예약하면 됩니다\."),
        "카카오톡 문의로 일정을 확인하면 됩니다.",
    ),
    (
        re.compile(r"카카오톡(?: 오픈채팅)?으로 하세요\."),
        "카카오톡 문의로 확인하세요.",
    ),
    (
        re.compile(r"카카오톡(?: 오픈채팅)? 또는 구글 드라이브로"),
        "카카오톡 문의나 구글 드라이브로",
    ),
    (
        re.compile(r"([^\n\"]+)에서 당일 일정 확인한가요\?"),
        r"\1에서 당일 이용이 가능한가요?",
    ),
    (
        re.compile(r"당일 일정 확인한가요\?"),
        "당일 이용이 가능한가요?",
    ),
    (
        re.compile(r"당일 예약도 가능합니다\."),
        "당일 이용 가능 여부도 확인할 수 있습니다.",
    ),
]

MANUAL_REPLACEMENTS: dict[str, list[tuple[str, str]]] = {
    "gongdeok1.md": [
        ('- q:="', '- q: "'),
        ('- q: ""', '- q: "'),
        (
            "### 공덕역 출발 (6호선)\n\n### 공덕역 출발 (6호선)",
            "### 공덕역 출발 (6호선)",
        ),
        (
            "### 아현역 출발 (2호선)\n\n### 아현역 출발 (2호선)",
            "### 아현역 출발 (2호선)",
        ),
        (
            "### 마포역 출발 (5호선)\n\n### 마포역 출발 (5호선)",
            "### 마포역 출발 (5호선)",
        ),
        (
            "마포구 중심부 공덕·아현·도화·용강에서 20~30분 공덕역은 6호선 직통으로 가장 가까운 접근 지점입니다. 세션 일정은 카카오톡으로 미리 조율해주세요. 도착 전 워밍업 시간을 여유 있게 잡는 걸 권장합니다.",
            "마포구 중심부 공덕·아현·도화·용강은 연신내와의 접근성이 좋은 편입니다. 공덕역은 6호선 직통이라 이동 경로가 단순하고, 방문 전에는 카카오톡 문의로 일정과 준비 사항을 미리 확인해두는 편이 좋습니다.",
        ),
    ],
    "booking1.md": [
        (
            "스튜디오 놀은 **카카오톡 오픈채팅**으로 예약합니다. 전화 예약보다 더 편리하고, 파일 공유와 일정 확인이 카카오톡에서 한 번에 가능합니다.",
            "스튜디오 놀은 카카오톡 문의를 통해 일정을 확인합니다. 파일 공유나 준비 사항 정리도 같은 채널에서 함께 진행할 수 있습니다.",
        ),
        (
            '### Step 1: 카카오톡 오픈채팅 문의',
            "### Step 1: 카카오톡 문의",
        ),
    ],
    "namyangju-dasan1.md": [
        (
            "남양주 다산·와부·도농에서 경의중앙선으로 약 55~70분이면 연신내 방문이 어려운 경우 온라인 믹싱·마스터링 의뢰도 가능합니다. 카카오톡으로 문의하시면 맞춤 안내를 드립니다. 방문 전 카카오톡으로 예약 시간을 먼저 잡아두시면 대기 없이 바로 세션에 들어갈 수 있습니다.",
            "남양주 다산·와부·도농에서 연신내까지는 경의중앙선과 6호선을 이용해 약 55~70분 정도 걸립니다. 이동 시간이 긴 편이라면 방문 전 카카오톡 문의로 일정과 준비 사항을 먼저 확인해두는 편이 좋습니다.",
        ),
    ],
}


def split_frontmatter(text: str) -> tuple[str, str]:
    match = FRONTMATTER_RE.match(text)
    if not match:
        raise ValueError("Missing frontmatter block")
    return match.group(1), text[match.end():]


def rebuild_document(frontmatter: str, body: str) -> str:
    normalized_body = body.lstrip("\n")
    return f"---\n{frontmatter}\n---\n{normalized_body}".rstrip() + "\n"


def decode_frontmatter_scalar(raw_value: str) -> str:
    value = raw_value.strip()
    if len(value) >= 2 and value.startswith('"') and value.endswith('"'):
        value = value[1:-1]
        previous = None
        while previous != value:
            previous = value
            value = value.replace("\\\\", "\\").replace('\\"', '"')
        value = value.strip()
        while len(value) >= 2 and value.startswith('"') and value.endswith('"'):
            value = value[1:-1].strip()
        return value
    if len(value) >= 2 and value.startswith("'") and value.endswith("'"):
        return value[1:-1].strip()
    return value.strip()


def escape_double_quotes(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def get_frontmatter_value(frontmatter: str, field: str) -> str:
    pattern = re.compile(rf'^{re.escape(field)}:\s*(.*)$', re.M)
    match = pattern.search(frontmatter)
    if not match:
        raise ValueError(f"Missing {field} field")
    return decode_frontmatter_scalar(match.group(1))


def get_optional_frontmatter_value(frontmatter: str, field: str) -> str | None:
    pattern = re.compile(rf'^{re.escape(field)}:\s*(.*)$', re.M)
    match = pattern.search(frontmatter)
    if not match:
        return None
    return decode_frontmatter_scalar(match.group(1))


def replace_frontmatter_value(frontmatter: str, field: str, value: str) -> str:
    escaped = escape_double_quotes(value)
    quoted_pattern = re.compile(rf'^({re.escape(field)}:\s*)(?:"[^"]*"|\'[^\']*\')\s*$', re.M)
    updated, count = quoted_pattern.subn(rf'\1"{escaped}"', frontmatter, count=1)
    if count:
        return updated

    raw_pattern = re.compile(rf'^({re.escape(field)}:\s*).*$' , re.M)
    updated, count = raw_pattern.subn(rf'\1"{escaped}"', frontmatter, count=1)
    if not count:
        raise ValueError(f"Missing {field} field")
    return updated


def normalize_title_text(text: str) -> str:
    normalized = text.replace("완전 가이드", "가이드")
    normalized = normalized.replace("완벽 가이드", "가이드")
    normalized = normalized.replace("온라인 믹싱 의뢰 방법", "온라인 믹싱 가이드")
    normalized = re.sub(r"\s{2,}", " ", normalized)
    return normalized.strip()


def normalize_summary_text(text: str) -> str:
    normalized = normalize_title_text(text)
    normalized = normalized.replace("완벽히 안내합니다", "정리합니다")
    normalized = normalized.replace("모두 정리했습니다", "핵심을 정리했습니다")
    normalized = re.sub(r"\s{2,}", " ", normalized)
    return normalized.strip()


def normalize_story_link_label(label: str) -> str:
    normalized = normalize_title_text(label)
    normalized = re.sub(r"\s{2,}", " ", normalized)
    return normalized.strip()


def normalize_image_alts(body: str) -> str:
    def replacer(match: re.Match[str]) -> str:
        alt, src = match.groups()
        return f"![{normalize_title_text(alt)}]({src})"

    return IMAGE_RE.sub(replacer, body)


def normalize_story_link_labels(body: str) -> str:
    def replacer(match: re.Match[str]) -> str:
        label, href = match.groups()
        return f"[{normalize_story_link_label(label)}]({href})"

    return STORY_LINK_RE.sub(replacer, body)


def is_link_line(line: str) -> bool:
    return bool(LINK_LINE_RE.fullmatch(line.strip()))


def parse_links(line: str) -> list[tuple[str, str]]:
    return [(label.strip(), href.strip()) for label, href in LINK_RE.findall(line)]


def dedupe_links(links: list[tuple[str, str]]) -> list[tuple[str, str]]:
    seen: set[str] = set()
    deduped: list[tuple[str, str]] = []
    for label, href in links:
        if href in seen:
            continue
        seen.add(href)
        deduped.append((label, href))
    return deduped


def should_keep_soft_cta(category: str, title: str) -> bool:
    if category == REGION_CATEGORY:
        return True
    return any(keyword in title for keyword in SOFT_CTA_TITLE_KEYWORDS)


def should_use_pricing_link(category: str, title: str) -> bool:
    if category == REGION_CATEGORY:
        return True
    return any(keyword in title for keyword in PRICING_CTA_TITLE_KEYWORDS)


def normalize_tail_links(body: str, title: str, category: str) -> str:
    stripped_body = body.rstrip()
    lines = stripped_body.splitlines()
    trailing_links: list[str] = []
    index = len(lines) - 1

    while index >= 0:
        current = lines[index].strip()
        if not current:
            if trailing_links:
                break
            index -= 1
            continue
        if is_link_line(current):
            trailing_links.append(current)
            index -= 1
            continue
        break

    if not trailing_links:
        return body

    trailing_links.reverse()
    cut_index = index + 1

    while cut_index > 0 and not lines[cut_index - 1].strip():
        cut_index -= 1
    if cut_index > 0 and lines[cut_index - 1].strip() == "---":
        cut_index -= 1
        while cut_index > 0 and not lines[cut_index - 1].strip():
            cut_index -= 1

    prefix = "\n".join(lines[:cut_index]).rstrip()

    story_links: list[tuple[str, str]] = []
    for line in trailing_links:
        for label, href in parse_links(line):
            if href == "/stories/onlinemix1":
                continue
            if href.startswith("/stories/"):
                story_links.append((normalize_story_link_label(label), href))

    story_links = dedupe_links(story_links)[:4]

    service_link: tuple[str, str] | None = None
    if should_keep_soft_cta(category, title):
        if should_use_pricing_link(category, title):
            service_link = ("이용 요금 보기", "/pricing")
        else:
            service_link = ("스튜디오 정보 보기", "/studio-info")

    if not story_links and not service_link:
        return prefix.rstrip() + "\n"

    rebuilt_lines: list[str] = []
    if story_links:
        rebuilt_lines.append(" | ".join(f"[{label}]({href})" for label, href in story_links))
    if service_link:
        rebuilt_lines.append(f"[{service_link[0]}]({service_link[1]})")

    return prefix.rstrip() + "\n\n---\n\n" + "\n".join(rebuilt_lines) + "\n"


def strip_stray_onlinemix_links(body: str) -> str:
    lines = body.splitlines()
    updated_lines: list[str] = []
    for line in lines:
        if "/stories/onlinemix1" not in line:
            updated_lines.append(line)
            continue
        if not is_link_line(line.strip()):
            cleaned = re.sub(r"\s*\[[^\]]+\]\(/stories/onlinemix1\)", "", line)
            while re.search(r"\|\s*\|", cleaned):
                cleaned = re.sub(r"\|\s*\|", "|", cleaned)
            cleaned = re.sub(r"\s*\|\s*$", "", cleaned)
            cleaned = re.sub(r"^\s*\|\s*", "", cleaned)
            cleaned = re.sub(r"\s{2,}", " ", cleaned)
            cleaned = re.sub(r"\s+([.,!?])", r"\1", cleaned)
            updated_lines.append(cleaned.rstrip())
            continue

        rebuilt_links = []
        for label, href in parse_links(line):
            if href == "/stories/onlinemix1":
                continue
            rebuilt_links.append((normalize_story_link_label(label), href))

        if rebuilt_links:
            updated_lines.append(" | ".join(f"[{label}]({href})" for label, href in rebuilt_links))

    return "\n".join(updated_lines)


def collapse_duplicate_headings(body: str) -> str:
    lines = body.splitlines()
    collapsed: list[str] = []
    for line in lines:
        if line.startswith("### ") and collapsed and collapsed[-1].strip() == line.strip():
            continue
        collapsed.append(line)
    return "\n".join(collapsed)


def apply_text_replacements(body: str) -> str:
    updated = body
    for pattern, replacement in TEXT_REPLACEMENTS:
        updated = pattern.sub(replacement, updated)

    updated = updated.replace("카카오톡 오픈채팅", "카카오톡 문의")
    updated = updated.replace("카카오톡 문의으로", "카카오톡 문의로")
    updated = updated.replace("카카오톡 문의로 문의", "카카오톡 문의")
    updated = updated.replace("당일 예약 가능", "당일 일정 확인 가능")
    updated = updated.replace("당일 예약도 가능", "당일 일정 확인")
    updated = re.sub(r"\n{3,}", "\n\n", updated)
    return updated


def apply_manual_replacements(path: Path, text: str) -> str:
    updated = text
    for source, target in MANUAL_REPLACEMENTS.get(path.name, []):
        updated = updated.replace(source, target)
    return updated


def validate_gray_matter() -> list[dict[str, str]]:
    node_script = """
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const dir = path.join(process.cwd(), 'content', 'stories');
const invalid = [];
for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.md'))) {
  try {
    matter(fs.readFileSync(path.join(dir, file), 'utf8'));
  } catch (error) {
    invalid.push({ file, reason: error.reason || error.message });
  }
}
process.stdout.write(JSON.stringify(invalid));
"""

    result = subprocess.run(
        ["node", "-e", node_script],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def normalize_file(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    updated = apply_manual_replacements(path, original)

    frontmatter, body = split_frontmatter(updated)
    title = normalize_title_text(get_frontmatter_value(frontmatter, "title"))
    summary = get_optional_frontmatter_value(frontmatter, "summary")
    category = get_frontmatter_value(frontmatter, "category")

    frontmatter = replace_frontmatter_value(frontmatter, "title", title)
    if summary is not None:
        frontmatter = replace_frontmatter_value(frontmatter, "summary", normalize_summary_text(summary))
    frontmatter = apply_text_replacements(frontmatter)

    body = normalize_image_alts(body)
    body = normalize_story_link_labels(body)
    body = apply_text_replacements(body)
    body = strip_stray_onlinemix_links(body)
    body = collapse_duplicate_headings(body)
    body = normalize_tail_links(body, title, category)
    body = re.sub(r"\n{3,}", "\n\n", body).rstrip() + "\n"

    normalized = rebuild_document(frontmatter, body)
    if normalized == original:
        return False

    path.write_text(normalized, encoding="utf-8")
    return True


def main() -> int:
    files = sorted(STORIES_DIR.glob("*.md"))
    modified = 0

    for path in files:
        if normalize_file(path):
            modified += 1

    invalid = validate_gray_matter()
    if invalid:
        print(f"Modified {modified} files before parse check failed.")
        for item in invalid:
            print(f"{item['file']}\t{item['reason']}")
        return 1

    print(f"Scanned {len(files)} files")
    print(f"Modified {modified} files")
    print("gray-matter parse check passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
