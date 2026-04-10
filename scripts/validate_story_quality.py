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
TITLE_RE = re.compile(r'^title:\s*"(.*)"\s*$', re.M)
SUMMARY_RE = re.compile(r'^summary:\s*"(.*)"\s*$', re.M)
LOCALIZED_LINK_RE = re.compile(r"\(/stories/(?:ko|en|zh|es|vi|th|uz)/[^)#?\s]+\)")
SERVICE_LINK_RE = re.compile(r"\(/(?:pricing|studio-info)\)")
CONTACT_MENTION_RE = re.compile(r"카카오톡 문의")
DIRECT_CTA_RE = re.compile(
    r"무료 견적|당일 답변|문의해 주세요|문의하세요|문의 주세요|문의주시면|문의 주세요|카카오톡으로 문의"
)
STRICT_REGION_FILES = {"gwanak1.md", "dongjak1.md", "jinhae1.md"}
STRICT_KNOWLEDGE_FILES = {
    "booking1.md",
    "cover1.md",
    "lesson1.md",
    "logicpro1.md",
    "pricing1.md",
}


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


def get_frontmatter_value(text: str, pattern: re.Pattern[str]) -> str:
    match = pattern.search(text)
    return match.group(1) if match else ""


def check_region_quality(filename: str, text: str) -> list[str]:
    failures: list[str] = []
    service_links = len(SERVICE_LINK_RE.findall(text))
    contact_mentions = len(CONTACT_MENTION_RE.findall(text))
    soft_cta_units = service_links + contact_mentions

    if DIRECT_CTA_RE.search(text):
        failures.append(f"{filename}: 지역 가이드에 직접 전환 문구가 남아 있음")
    if soft_cta_units > 1:
        failures.append(f"{filename}: 지역 가이드 soft CTA {soft_cta_units}회")
    return failures


def check_knowledge_quality(filename: str, text: str) -> list[str]:
    failures: list[str] = []
    service_links = len(SERVICE_LINK_RE.findall(text))
    contact_mentions = len(CONTACT_MENTION_RE.findall(text))

    if service_links:
        failures.append(f"{filename}: 지식형 글에 서비스 링크 {service_links}개")
    if contact_mentions:
        failures.append(f"{filename}: 지식형 글에 문의 유도 {contact_mentions}회")
    if DIRECT_CTA_RE.search(text):
        failures.append(f"{filename}: 지식형 글에 직접 전환 문구가 남아 있음")
    return failures


def main() -> int:
    files = sorted(STORIES_DIR.glob("*.md"))
    failures: list[str] = []

    invalid = validate_gray_matter()
    if invalid:
        failures.append(f"gray-matter parse failures: {len(invalid)}")
        failures.extend(f"{item['file']}: {item['reason']}" for item in invalid[:20])

    title_hits = []
    summary_hits = []
    openchat_hits = []
    onlinemix_label_hits = []
    onlinemix_href_hits = []
    localized_link_hits = []
    strict_quality_hits = []

    for path in files:
        text = path.read_text(encoding="utf-8", errors="ignore")
        title = get_frontmatter_value(text, TITLE_RE)
        summary = get_frontmatter_value(text, SUMMARY_RE)

        if "완전 가이드" in title:
            title_hits.append(path.name)
        if "완전 가이드" in summary:
            summary_hits.append(path.name)
        if "카카오톡 오픈채팅" in text:
            openchat_hits.append(path.name)
        if "온라인 믹싱 의뢰 방법" in text:
            onlinemix_label_hits.append(path.name)
        if "/stories/onlinemix1" in text:
            onlinemix_href_hits.append(path.name)
        if LOCALIZED_LINK_RE.search(text):
            localized_link_hits.append(path.name)

        if path.name in STRICT_REGION_FILES:
            strict_quality_hits.extend(check_region_quality(path.name, text))
        if path.name in STRICT_KNOWLEDGE_FILES:
            strict_quality_hits.extend(check_knowledge_quality(path.name, text))

    if title_hits:
        failures.append(f"title contains '완전 가이드': {len(title_hits)}")
        failures.extend(title_hits[:20])
    if summary_hits:
        failures.append(f"summary contains '완전 가이드': {len(summary_hits)}")
        failures.extend(summary_hits[:20])
    if openchat_hits:
        failures.append(f"'카카오톡 오픈채팅' remains: {len(openchat_hits)}")
        failures.extend(openchat_hits[:20])
    if onlinemix_label_hits:
        failures.append(f"'온라인 믹싱 의뢰 방법' remains: {len(onlinemix_label_hits)}")
        failures.extend(onlinemix_label_hits[:20])
    if onlinemix_href_hits:
        failures.append(f"'/stories/onlinemix1' remains: {len(onlinemix_href_hits)}")
        failures.extend(onlinemix_href_hits[:20])
    if localized_link_hits:
        failures.append(f"localized story href remains: {len(localized_link_hits)}")
        failures.extend(localized_link_hits[:20])
    if strict_quality_hits:
        failures.append(f"strict quality regressions: {len(strict_quality_hits)}")
        failures.extend(strict_quality_hits[:20])

    if failures:
        print("\n".join(failures))
        return 1

    print(f"Validated story quality for {len(files)} files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
