#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
STORIES_DIR = ROOT / "content" / "stories"
GUIDELINES_PATH = ROOT / "docs" / "content-guidelines.md"
REPORT_DATE = "2026-04-10"

FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n?", re.S)
TITLE_RE = re.compile(r'^title:\s*"(.*)"\s*$', re.M)
CATEGORY_RE = re.compile(r'^category:\s*"(.*)"\s*$', re.M)
SUMMARY_RE = re.compile(r'^summary:\s*"(.*)"\s*$', re.M)
DATE_RE = re.compile(r'^date:\s*(.*)$', re.M)
HEADING_RE = re.compile(r"^(## .+)$", re.M)
STORY_LINK_RE = re.compile(r"\[([^\]]+)\]\((/[^)]+)\)")
TABLE_ROW_RE = re.compile(r"^\|.+\|$")

TONE_PATTERNS = {
    "free_quote": re.compile(r"무료 견적"),
    "same_day_reply": re.compile(r"당일 답변"),
    "instant": re.compile(r"즉시"),
    "ask_contact": re.compile(r"문의해 주세요|문의하세요|문의 주세요"),
    "pro_grade": re.compile(r"프로급"),
}

DIRECT_CTA_PATTERNS = {
    "contact_cta": re.compile(r"카카오톡 문의|카카오톡으로.*문의|예약 문의"),
    "ask_contact": re.compile(r"문의해 주세요|문의하세요|문의 주세요"),
    "book_now": re.compile(r"예약하세요|예약해주세요|예약해 주세요"),
    "check_now": re.compile(r"확인하세요|확인해 주세요"),
    "free_quote": re.compile(r"무료 견적"),
    "same_day_reply": re.compile(r"당일 답변"),
}

FORMAL_PATTERNS = {
    "formal_hamnida": re.compile(r"합니다"),
    "formal_thing": re.compile(r"것입니다"),
    "formal_see": re.compile(r"살펴보겠습니다"),
}

MENTOR_MARKERS = re.compile(r"저도|처음엔|어려워해요|해볼까요|거든요|일까요")
PERFECTION_RE = re.compile(r"완벽하게|완벽")
SUMMARY_GUIDE_RE = re.compile(r"가이드입니다")
CONTACT_RE = re.compile(r"카카오톡 문의")
PRICING_LINK_RE = re.compile(r"\(/pricing\)")
STUDIO_INFO_LINK_RE = re.compile(r"\(/studio-info\)")
PRICE_SIGNAL_RE = re.compile(r"시간당\s*\d|만원|패키지|요금")

TECH_PERFECTION_HINTS = (
    "비트",
    "튜닝",
    "교정",
    "정렬",
    "위상",
    "지원",
    "처리",
    "연주",
    "피치",
    "다루는",
    "외우",
    "일치",
    "맞추",
    "클린",
    "녹음",
    "오디오",
    "세팅",
    "마스터링",
    "믹싱",
)

PROMO_PERFECTION_HINTS = (
    "결과물",
    "서비스",
    "장비",
    "엔지니어",
    "프로급",
    "품질",
    "최상의 상태",
    "만들 수",
    "만들어드립니다",
    "제작",
)

REGION_SERVICE_CATEGORIES = {
    "지역 가이드",
    "후기",
    "후기·인터뷰",
    "review",
    "이벤트",
    "event",
    "서비스 안내",
    "공지",
    "notice",
    "interview",
    "인터뷰",
}

SERVICE_LIKE_CATEGORIES = {
    "서비스 안내",
    "후기",
    "후기·인터뷰",
    "review",
    "공지",
    "notice",
    "이벤트",
    "event",
    "interview",
    "인터뷰",
}

KNOWLEDGE_HINTS = (
    "강좌",
    "가이드",
    "guide",
    "lesson",
    "녹음",
    "믹싱",
    "보컬",
    "음반 제작",
    "음악 비즈니스",
    "음악 프로덕션",
    "장비",
    "작곡",
    "발성",
    "이론",
)

RECENT_REWRITE_PREFIX = "practice-room-"


@dataclass
class StoryRecord:
    name: str
    title: str
    category: str
    summary: str
    date: str
    text: str
    body: str
    headings: list[str]
    closing_line: str | None
    links: list[str]


@dataclass
class StoryAudit:
    record: StoryRecord
    tone_hits: dict[str, int]
    direct_cta_hits: dict[str, int]
    formal_hits: dict[str, int]
    contact_mentions: int
    pricing_links: int
    studio_info_links: int
    price_signal_lines: int
    summary_guide: bool
    has_machi: bool
    repeated_headings: list[str]
    repeated_closing: bool
    repeated_lines: list[str]
    technical_perfection_lines: list[str]
    promo_perfection_lines: list[str]
    rigid_style_score: int
    bucket_scores: dict[str, int]
    priority: str
    priority_score: int
    auto_fix_reasons: list[str] = field(default_factory=list)
    rule_ignore_reasons: list[str] = field(default_factory=list)
    manual_rewrite_reasons: list[str] = field(default_factory=list)


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


def split_frontmatter(text: str) -> tuple[str, str]:
    match = FRONTMATTER_RE.match(text)
    if not match:
        return "", text
    return match.group(1), text[match.end():]


def frontmatter_value(pattern: re.Pattern[str], text: str) -> str:
    match = pattern.search(text)
    return match.group(1).strip() if match else ""


def clean_line(line: str) -> str:
    return re.sub(r"\s+", " ", line.strip())


def should_track_repeated_line(line: str) -> bool:
    stripped = clean_line(line)
    if len(stripped) < 18:
        return False
    if stripped.startswith("![") or stripped.startswith("---"):
        return False
    if TABLE_ROW_RE.match(stripped):
        return False
    if stripped.startswith("[") and "](" in stripped:
        return False
    return True


def is_region_service(category: str) -> bool:
    return category in REGION_SERVICE_CATEGORIES


def is_recent_rewrite(name: str) -> bool:
    return name.startswith(RECENT_REWRITE_PREFIX)


def is_knowledge_category(category: str) -> bool:
    if is_region_service(category):
        return False
    lowered = category.lower()
    return any(hint.lower() in lowered for hint in KNOWLEDGE_HINTS)


def load_records() -> list[StoryRecord]:
    records: list[StoryRecord] = []
    for path in sorted(STORIES_DIR.glob("*.md")):
        text = path.read_text(encoding="utf-8", errors="ignore")
        _, body = split_frontmatter(text)
        body = body.lstrip("\n")
        headings = [match.group(1).strip() for match in HEADING_RE.finditer(body)]
        links = [href for _, href in STORY_LINK_RE.findall(body)]
        closing_line = None
        lines = [clean_line(line) for line in body.splitlines()]
        for index, line in enumerate(lines):
            if line == "## 마치며":
                for candidate in lines[index + 1 :]:
                    if candidate:
                        closing_line = candidate
                        break
                break
        records.append(
            StoryRecord(
                name=path.name,
                title=frontmatter_value(TITLE_RE, text),
                category=frontmatter_value(CATEGORY_RE, text),
                summary=frontmatter_value(SUMMARY_RE, text),
                date=frontmatter_value(DATE_RE, text),
                text=text,
                body=body,
                headings=headings,
                closing_line=closing_line,
                links=links,
            )
        )
    return records


def build_global_counters(records: list[StoryRecord]) -> dict[str, Counter[str]]:
    heading_counts: Counter[str] = Counter()
    closing_counts: Counter[str] = Counter()
    body_line_counts: Counter[str] = Counter()

    for record in records:
        heading_counts.update(set(record.headings))
        if record.closing_line:
            closing_counts[record.closing_line] += 1
        unique_lines = {
            clean_line(line)
            for line in record.body.splitlines()
            if should_track_repeated_line(line)
        }
        body_line_counts.update(unique_lines)

    return {
        "headings": heading_counts,
        "closing_lines": closing_counts,
        "body_lines": body_line_counts,
    }


def classify_perfection_lines(record: StoryRecord) -> tuple[list[str], list[str]]:
    technical: list[str] = []
    promotional: list[str] = []
    for raw_line in record.text.splitlines():
        line = clean_line(raw_line)
        if not line or "완벽" not in line:
            continue
        if any(hint in line for hint in PROMO_PERFECTION_HINTS):
            promotional.append(line)
            continue
        if any(hint in line for hint in TECH_PERFECTION_HINTS):
            technical.append(line)
            continue
        if is_knowledge_category(record.category):
            technical.append(line)
            continue
        promotional.append(line)
    return technical, promotional


def count_matches(patterns: dict[str, re.Pattern[str]], text: str) -> dict[str, int]:
    return {key: len(pattern.findall(text)) for key, pattern in patterns.items()}


def compute_cta_score(record: StoryRecord, direct_cta_hits: dict[str, int], contact_mentions: int, pricing_links: int, studio_info_links: int, price_signal_lines: int) -> tuple[int, list[str], list[str], list[str]]:
    score = 0
    auto_fix: list[str] = []
    rule_only: list[str] = []
    manual_rewrite: list[str] = []

    service_link_total = pricing_links + studio_info_links
    direct_total = sum(direct_cta_hits.values())

    if record.category == "지역 가이드":
        soft_cta_units = service_link_total + contact_mentions
        excess = max(soft_cta_units - 1, 0)
        if excess:
            score += excess * 2
            auto_fix.append(f"soft CTA 허용치를 넘는 서비스 유도 {soft_cta_units}회")
        if direct_cta_hits["free_quote"] or direct_cta_hits["same_day_reply"] or direct_cta_hits["ask_contact"]:
            score += 4
            manual_rewrite.append("지역 가이드에 직접 전환 문구가 남아 있음")
        elif soft_cta_units == 1 and service_link_total <= 1:
            rule_only.append("지역 가이드 soft CTA 1회")
    elif is_knowledge_category(record.category):
        if service_link_total:
            score += service_link_total * 3
            auto_fix.append(f"지식형 글에 서비스 링크 {service_link_total}개")
        if contact_mentions:
            score += contact_mentions * 2
            auto_fix.append(f"지식형 글에 문의 유도 {contact_mentions}회")
        if direct_total:
            score += direct_total * 3
            manual_rewrite.append("지식형 글에 직접 행동 유도 문구가 남아 있음")
        if price_signal_lines:
            score += 2
            auto_fix.append("지식형 글에 가격/패키지 표 신호가 있음")
    elif record.category in SERVICE_LIKE_CATEGORIES:
        if direct_cta_hits["free_quote"] or direct_cta_hits["same_day_reply"]:
            score += 2
            manual_rewrite.append("서비스형 글에도 과한 판매 문구가 남아 있음")
        if service_link_total > 1:
            score += 1
            auto_fix.append("서비스 링크가 2개 이상 반복됨")
    else:
        if service_link_total:
            score += service_link_total
            auto_fix.append("서비스 링크가 남아 있음")
        if contact_mentions and record.category != "악기 연습":
            score += 1
            auto_fix.append("문의 유도 문장이 남아 있음")

    return score, auto_fix, rule_only, manual_rewrite


def compute_template_score(record: StoryRecord, counters: dict[str, Counter[str]]) -> tuple[int, list[str], list[str]]:
    score = 0
    auto_fix: list[str] = []
    manual_rewrite: list[str] = []

    if "## 마치며" in record.headings:
        score += 1
        auto_fix.append("마무리 heading 템플릿 사용")
    if SUMMARY_GUIDE_RE.search(record.summary):
        score += 1
        auto_fix.append("summary가 '가이드입니다'로 끝남")

    common_headings = [
        heading
        for heading in set(record.headings)
        if counters["headings"][heading] >= 20
    ]
    if len(common_headings) >= 2:
        score += 1
        auto_fix.append(f"반복 heading {len(common_headings)}개")

    repeated_lines = [
        clean_line(line)
        for line in record.body.splitlines()
        if should_track_repeated_line(line) and counters["body_lines"][clean_line(line)] >= 12
    ]
    if repeated_lines:
        score += 2
        auto_fix.append(f"반복 본문/CTA 문장 {len(set(repeated_lines))}개")

    repeated_closing = bool(record.closing_line and counters["closing_lines"][record.closing_line] >= 2)
    if repeated_closing:
        score += 1
        auto_fix.append("마무리 문장이 다른 글과 중복됨")

    return score, auto_fix, manual_rewrite


def compute_guideline_score(formal_hits: dict[str, int], mentor_markers: int, record: StoryRecord) -> tuple[int, list[str], list[str]]:
    score = 0
    auto_fix: list[str] = []
    rule_only: list[str] = []
    formal_total = sum(formal_hits.values())

    if formal_total >= 3 and mentor_markers == 0:
        score += 2
        auto_fix.append("가이드라인 금지 문체가 멘토 톤 없이 반복됨")
    elif formal_total:
        score += 1
        rule_only.append("형식적 문장 종결이 일부 남아 있음")

    if record.summary.endswith("합니다.") and "정리" not in record.summary:
        score += 1
        auto_fix.append("summary가 매뉴얼 톤으로 닫힘")

    return score, auto_fix, rule_only


def build_story_audit(record: StoryRecord, counters: dict[str, Counter[str]]) -> StoryAudit:
    tone_hits = count_matches(TONE_PATTERNS, record.text)
    direct_cta_hits = count_matches(DIRECT_CTA_PATTERNS, record.text)
    formal_hits = count_matches(FORMAL_PATTERNS, record.text)
    contact_mentions = len(CONTACT_RE.findall(record.text))
    pricing_links = len(PRICING_LINK_RE.findall(record.text))
    studio_info_links = len(STUDIO_INFO_LINK_RE.findall(record.text))
    price_signal_lines = sum(
        1
        for line in record.text.splitlines()
        if PRICE_SIGNAL_RE.search(line) and ("|" in line or "카카오톡 문의" in line)
    )
    technical_perfection_lines, promo_perfection_lines = classify_perfection_lines(record)
    mentor_markers = len(MENTOR_MARKERS.findall(record.text))

    tone_score = 0
    auto_fix: list[str] = []
    rule_only: list[str] = []
    manual_rewrite: list[str] = []

    hard_sales_hits = (
        tone_hits["free_quote"]
        + tone_hits["same_day_reply"]
        + tone_hits["ask_contact"]
        + tone_hits["pro_grade"]
    )
    if hard_sales_hits:
        tone_score += hard_sales_hits * 3
        manual_rewrite.append(f"과장/전환 톤 {hard_sales_hits}건")
    if tone_hits["instant"]:
        tone_score += tone_hits["instant"]
        auto_fix.append(f"'즉시' 표현 {tone_hits['instant']}건")
    if promo_perfection_lines:
        tone_score += len(promo_perfection_lines) * 2
        manual_rewrite.append(f"홍보성 '완벽' 문장 {len(promo_perfection_lines)}건")
    if technical_perfection_lines:
        rule_only.append(f"기술 맥락 '완벽' 문장 {len(technical_perfection_lines)}건")

    cta_score, cta_auto, cta_rule, cta_manual = compute_cta_score(
        record,
        direct_cta_hits,
        contact_mentions,
        pricing_links,
        studio_info_links,
        price_signal_lines,
    )
    auto_fix.extend(cta_auto)
    rule_only.extend(cta_rule)
    manual_rewrite.extend(cta_manual)

    template_score, template_auto, template_manual = compute_template_score(record, counters)
    auto_fix.extend(template_auto)
    manual_rewrite.extend(template_manual)

    guideline_score, guideline_auto, guideline_rule = compute_guideline_score(
        formal_hits,
        mentor_markers,
        record,
    )
    auto_fix.extend(guideline_auto)
    rule_only.extend(guideline_rule)

    bucket_scores = {
        "Tone Drift": tone_score,
        "CTA Drift": cta_score,
        "Template Fatigue": template_score,
        "Guideline Mismatch": guideline_score,
        "Manual Review Queue": 0,
    }

    priority_score = tone_score + cta_score + template_score + guideline_score
    major_manual_flags = (
        bool(promo_perfection_lines)
        or tone_hits["free_quote"] > 0
        or tone_hits["same_day_reply"] > 0
        or tone_hits["ask_contact"] > 0
        or direct_cta_hits["free_quote"] > 0
        or direct_cta_hits["same_day_reply"] > 0
        or direct_cta_hits["ask_contact"] > 0
        or direct_cta_hits["book_now"] > 0
    )

    if manual_rewrite and major_manual_flags and priority_score >= 4:
        priority = "Manual rewrite candidate"
    elif auto_fix:
        priority = "Auto-fix candidate"
    else:
        priority = "Rule-only ignore"

    repeated_headings = [
        heading
        for heading in set(record.headings)
        if counters["headings"][heading] >= 20
    ]
    repeated_lines = sorted(
        {
            clean_line(line)
            for line in record.body.splitlines()
            if should_track_repeated_line(line) and counters["body_lines"][clean_line(line)] >= 12
        }
    )

    return StoryAudit(
        record=record,
        tone_hits=tone_hits,
        direct_cta_hits=direct_cta_hits,
        formal_hits=formal_hits,
        contact_mentions=contact_mentions,
        pricing_links=pricing_links,
        studio_info_links=studio_info_links,
        price_signal_lines=price_signal_lines,
        summary_guide=bool(SUMMARY_GUIDE_RE.search(record.summary)),
        has_machi="## 마치며" in record.headings,
        repeated_headings=sorted(repeated_headings),
        repeated_closing=bool(record.closing_line and counters["closing_lines"][record.closing_line] >= 2),
        repeated_lines=repeated_lines,
        technical_perfection_lines=technical_perfection_lines,
        promo_perfection_lines=promo_perfection_lines,
        rigid_style_score=sum(formal_hits.values()),
        bucket_scores=bucket_scores,
        priority=priority,
        priority_score=priority_score,
        auto_fix_reasons=sorted(set(auto_fix)),
        rule_ignore_reasons=sorted(set(rule_only)),
        manual_rewrite_reasons=sorted(set(manual_rewrite)),
    )


def select_manual_review_queue(audits: list[StoryAudit]) -> dict[str, list[StoryAudit]]:
    region_service = sorted(
        (
            audit
            for audit in audits
            if is_region_service(audit.record.category)
        ),
        key=lambda audit: (audit.priority_score, audit.record.name),
        reverse=True,
    )[:6]

    tech_lecture = sorted(
        (
            audit
            for audit in audits
            if is_knowledge_category(audit.record.category)
        ),
        key=lambda audit: (audit.priority_score, audit.record.name),
        reverse=True,
    )[:6]

    recent_rewrites = sorted(
        (
            audit
            for audit in audits
            if is_recent_rewrite(audit.record.name)
        ),
        key=lambda audit: (
            audit.priority_score
            + (
                3
                if audit.record.name in {
                    "practice-room-yeonsinnae1.md",
                    "practice-room-guide1.md",
                    "practice-room-booking1.md",
                    "practice-room-recording1.md",
                    "practice-room-first1.md",
                    "practice-room-private1.md",
                }
                else 0
            ),
            audit.record.name,
        ),
        reverse=True,
    )[:6]

    return {
        "region_service": region_service,
        "tech_lecture": tech_lecture,
        "recent_rewrites": recent_rewrites,
    }


MANUAL_REVIEW_NOTES: dict[str, dict[str, Any]] = {
    "gwanak1.md": {
        "ratings": {
            "tone": "rewrite",
            "density": "watch",
            "cta": "rewrite",
            "template": "rewrite",
            "naturalness": "watch",
        },
        "note": "지역 이동 정보는 남아 있지만 가격표·예약 유도·홍보형 추천 이유가 많아 정보형 가이드보다 랜딩 페이지 톤이 강합니다.",
    },
    "dongjak1.md": {
        "ratings": {
            "tone": "rewrite",
            "density": "watch",
            "cta": "rewrite",
            "template": "rewrite",
            "naturalness": "watch",
        },
        "note": "생활권 안내는 유효하지만 서비스 소개, 예약 방법, 가격표가 본문 절반 가까이를 차지해 지역 가이드의 정보 밀도가 흐려집니다.",
    },
    "jinhae1.md": {
        "ratings": {
            "tone": "rewrite",
            "density": "watch",
            "cta": "rewrite",
            "template": "rewrite",
            "naturalness": "rewrite",
        },
        "note": "장거리 방문 정보는 useful하지만 summary의 '가이드을' 오타와 무료 견적·품질 보장형 문구가 함께 남아 있어 완성도가 낮습니다.",
    },
    "yangjae1.md": {
        "ratings": {
            "tone": "watch",
            "density": "watch",
            "cta": "rewrite",
            "template": "rewrite",
            "naturalness": "rewrite",
        },
        "note": "정보 자체는 평범하지만 heading 중복과 닫는 문장 압축이 어색하고, pricing 링크까지 붙어 있어 최근 자동 정리 자국이 보입니다.",
    },
    "wirye1.md": {
        "ratings": {
            "tone": "watch",
            "density": "watch",
            "cta": "watch",
            "template": "rewrite",
            "naturalness": "rewrite",
        },
        "note": "이동 정보는 살아 있지만 본문 중간의 삽입형 일반론과 중복 heading 때문에 지역 안내 흐름이 자주 끊깁니다.",
    },
    "seongdong1.md": {
        "ratings": {
            "tone": "watch",
            "density": "watch",
            "cta": "rewrite",
            "template": "rewrite",
            "naturalness": "rewrite",
        },
        "note": "당일 세션·예약 유도는 강하고, 본문에 들어간 일반론 문장과 마무리 압축 문장이 자연스럽지 않아 최근 정리 자국이 남습니다.",
    },
    "booking1.md": {
        "ratings": {
            "tone": "watch",
            "density": "good",
            "cta": "rewrite",
            "template": "watch",
            "naturalness": "watch",
        },
        "note": "절차 설명은 명확하지만 지식형 글 기준으로는 카카오톡 문의와 견적 유도가 여전히 강하고, 결론부도 서비스 안내에 가깝습니다.",
    },
    "cover1.md": {
        "ratings": {
            "tone": "rewrite",
            "density": "good",
            "cta": "rewrite",
            "template": "watch",
            "naturalness": "watch",
        },
        "note": "커버곡 녹음 실무 정보는 충분하지만 비용·문의 문구가 반복돼 정보형 강좌보다 서비스 세일즈 문서처럼 읽힙니다.",
    },
    "lesson1.md": {
        "ratings": {
            "tone": "rewrite",
            "density": "watch",
            "cta": "rewrite",
            "template": "watch",
            "naturalness": "watch",
        },
        "note": "보컬 레슨 소개라는 의도는 명확하지만 글 전반이 서비스 안내문 톤이라 ‘강좌’ 카테고리 기대치와 어긋납니다.",
    },
    "logicpro1.md": {
        "ratings": {
            "tone": "watch",
            "density": "good",
            "cta": "good",
            "template": "watch",
            "naturalness": "watch",
        },
        "note": "기술 정보 밀도는 높지만 '프로급' 같은 과장형 제목과 반복적인 boilerplate lead-in 문장이 멘토 톤을 약하게 만듭니다.",
    },
    "seongbuk1.md": {
        "ratings": {
            "tone": "rewrite",
            "density": "watch",
            "cta": "rewrite",
            "template": "rewrite",
            "naturalness": "rewrite",
        },
        "note": "지역형 랜딩 구조와 가이드 카테고리가 뒤섞여 있고 중복 구분선, 직접 문의 문구 등 편집 완성도 문제도 남아 있습니다.",
    },
    "pricing1.md": {
        "ratings": {
            "tone": "watch",
            "density": "good",
            "cta": "watch",
            "template": "watch",
            "naturalness": "good",
        },
        "note": "가격 가이드라는 검색 의도에는 맞지만 축가 패키지 홍보 문구와 직접 pricing 링크가 중립성을 조금 약하게 만듭니다.",
    },
    "practice-room-yeonsinnae1.md": {
        "ratings": {
            "tone": "good",
            "density": "good",
            "cta": "watch",
            "template": "good",
            "naturalness": "good",
        },
        "note": "최근 축약 허브 중에서는 가장 안정적입니다. 다만 관련 링크에 서비스 페이지와 가격 링크가 함께 있어 soft CTA 경계는 남아 있습니다.",
    },
    "practice-room-recording1.md": {
        "ratings": {
            "tone": "good",
            "density": "good",
            "cta": "watch",
            "template": "good",
            "naturalness": "watch",
        },
        "note": "톤과 정보 구조는 안정적이지만 related link가 `/stories/ko/...` 형태라 링크 정합성 블라인드 스팟이 드러납니다.",
    },
    "practice-room-private1.md": {
        "ratings": {
            "tone": "good",
            "density": "good",
            "cta": "watch",
            "template": "good",
            "naturalness": "watch",
        },
        "note": "최근 정리본답게 과한 SEO 문구는 거의 없지만, 마지막 추천 문장과 locale형 story link는 아직 자동 검증 밖에 있습니다.",
    },
    "practice-room-guide1.md": {
        "ratings": {
            "tone": "good",
            "density": "good",
            "cta": "watch",
            "template": "good",
            "naturalness": "good",
        },
        "note": "비교 기준이 명확하고 사람 읽기형 구조가 잘 유지됩니다. 남은 이슈는 soft CTA 수준의 관련 링크 관리 정도입니다.",
    },
    "practice-room-first1.md": {
        "ratings": {
            "tone": "good",
            "density": "good",
            "cta": "watch",
            "template": "good",
            "naturalness": "good",
        },
        "note": "입문자용 흐름이 매끄럽고 과장 톤도 적습니다. 다만 다른 최근 정리본과 같은 locale형 내부 링크 패턴은 점검이 필요합니다.",
    },
    "practice-room-booking1.md": {
        "ratings": {
            "tone": "good",
            "density": "good",
            "cta": "watch",
            "template": "good",
            "naturalness": "good",
        },
        "note": "예약 글답게 행동 정보가 분명하고 판매 압력은 낮은 편입니다. related link와 서비스 링크의 soft CTA 경계만 관리하면 됩니다.",
    },
}


def serialize_audit(audit: StoryAudit) -> dict[str, Any]:
    tone_fragments: list[str] = []
    hard_sales = (
        audit.tone_hits["free_quote"]
        + audit.tone_hits["same_day_reply"]
        + audit.tone_hits["ask_contact"]
        + audit.tone_hits["pro_grade"]
    )
    if hard_sales:
        tone_fragments.append(f"과장/전환 톤 {hard_sales}건")
    if audit.promo_perfection_lines:
        tone_fragments.append(f"홍보성 '완벽' 문장 {len(audit.promo_perfection_lines)}건")
    if audit.technical_perfection_lines and not tone_fragments:
        tone_fragments.append(f"기술 맥락 '완벽' 문장 {len(audit.technical_perfection_lines)}건")

    cta_fragments: list[str] = []
    if audit.pricing_links or audit.studio_info_links:
        cta_fragments.append(f"서비스 링크 {audit.pricing_links + audit.studio_info_links}개")
    if audit.contact_mentions:
        cta_fragments.append(f"카카오톡 문의 {audit.contact_mentions}회")
    direct_total = sum(audit.direct_cta_hits.values())
    if direct_total:
        cta_fragments.append(f"직접 행동 유도 {direct_total}건")

    template_fragments: list[str] = []
    if audit.has_machi:
        template_fragments.append("`## 마치며` 사용")
    if audit.summary_guide:
        template_fragments.append("summary '가이드입니다'")
    if audit.repeated_headings:
        template_fragments.append(f"반복 heading {len(audit.repeated_headings)}개")
    if audit.repeated_lines:
        template_fragments.append(f"반복 본문/CTA 문장 {len(audit.repeated_lines)}개")
    if audit.repeated_closing:
        template_fragments.append("반복 마무리 문장")

    guideline_fragments: list[str] = []
    formal_total = sum(audit.formal_hits.values())
    if formal_total:
        guideline_fragments.append(f"형식적 종결 {formal_total}건")
    if audit.record.summary.endswith("합니다.") and "정리" not in audit.record.summary:
        guideline_fragments.append("summary 매뉴얼 톤")

    return {
        "file": audit.record.name,
        "title": audit.record.title,
        "category": audit.record.category,
        "date": audit.record.date,
        "priority": audit.priority,
        "priority_score": audit.priority_score,
        "bucket_scores": audit.bucket_scores,
        "auto_fix_reasons": audit.auto_fix_reasons,
        "rule_only_reasons": audit.rule_ignore_reasons,
        "manual_rewrite_reasons": audit.manual_rewrite_reasons,
        "contact_mentions": audit.contact_mentions,
        "pricing_links": audit.pricing_links,
        "studio_info_links": audit.studio_info_links,
        "summary_guide": audit.summary_guide,
        "has_machi": audit.has_machi,
        "technical_perfection_lines": audit.technical_perfection_lines[:3],
        "promo_perfection_lines": audit.promo_perfection_lines[:3],
        "repeated_headings": audit.repeated_headings[:6],
        "repeated_lines": audit.repeated_lines[:3],
        "bucket_notes": {
            "Tone Drift": tone_fragments,
            "CTA Drift": cta_fragments,
            "Template Fatigue": template_fragments,
            "Guideline Mismatch": guideline_fragments,
        },
    }


def build_payload() -> dict[str, Any]:
    invalid = validate_gray_matter()
    records = load_records()
    counters = build_global_counters(records)
    audits = [build_story_audit(record, counters) for record in records]
    queue = select_manual_review_queue(audits)

    bucket_counts: dict[str, int] = {
        "Tone Drift": sum(1 for audit in audits if audit.bucket_scores["Tone Drift"] > 0),
        "CTA Drift": sum(1 for audit in audits if audit.bucket_scores["CTA Drift"] > 0),
        "Template Fatigue": sum(1 for audit in audits if audit.bucket_scores["Template Fatigue"] > 0),
        "Guideline Mismatch": sum(1 for audit in audits if audit.bucket_scores["Guideline Mismatch"] > 0),
        "Manual Review Queue": sum(len(items) for items in queue.values()),
    }

    priority_counts = Counter(audit.priority for audit in audits)

    category_distribution: dict[str, dict[str, int]] = defaultdict(lambda: {
        "Tone Drift": 0,
        "CTA Drift": 0,
        "Template Fatigue": 0,
        "Guideline Mismatch": 0,
        "files": 0,
    })
    for audit in audits:
        entry = category_distribution[audit.record.category]
        entry["files"] += 1
        for bucket in ("Tone Drift", "CTA Drift", "Template Fatigue", "Guideline Mismatch"):
            if audit.bucket_scores[bucket] > 0:
                entry[bucket] += 1

    top_priority = sorted(
        audits,
        key=lambda audit: (audit.priority_score, audit.record.name),
        reverse=True,
    )[:20]

    top_repeated_headings = counters["headings"].most_common(15)
    top_repeated_closing = counters["closing_lines"].most_common(15)
    top_repeated_lines = [
        (line, count)
        for line, count in counters["body_lines"].most_common(20)
        if count >= 12
    ]

    return {
        "generated_on": REPORT_DATE,
        "guidelines_path": str(GUIDELINES_PATH.relative_to(ROOT)),
        "parse_failures": invalid,
        "totals": {
            "files": len(records),
            "bucket_counts": bucket_counts,
            "priority_counts": dict(priority_counts),
        },
        "bucket_examples": {
            bucket: [
                serialize_audit(audit)
                for audit in sorted(
                    [item for item in audits if item.bucket_scores[bucket] > 0],
                    key=lambda audit: (audit.bucket_scores[bucket], audit.priority_score, audit.record.name),
                    reverse=True,
                )[:10]
            ]
            for bucket in ("Tone Drift", "CTA Drift", "Template Fatigue", "Guideline Mismatch")
        },
        "category_distribution": dict(sorted(category_distribution.items())),
        "top_repeated_headings": top_repeated_headings,
        "top_repeated_closing": top_repeated_closing,
        "top_repeated_lines": top_repeated_lines,
        "top_priority_files": [serialize_audit(audit) for audit in top_priority],
        "manual_review_queue": {
            key: [serialize_audit(audit) for audit in value]
            for key, value in queue.items()
        },
        "manual_review_notes": MANUAL_REVIEW_NOTES,
        "all_priorities": {
            "Auto-fix candidate": [serialize_audit(audit) for audit in audits if audit.priority == "Auto-fix candidate"][:50],
            "Rule-only ignore": [serialize_audit(audit) for audit in audits if audit.priority == "Rule-only ignore"][:50],
            "Manual rewrite candidate": [serialize_audit(audit) for audit in audits if audit.priority == "Manual rewrite candidate"][:50],
        },
    }


def format_text(payload: dict[str, Any]) -> str:
    lines = [
        f"Stories blind-spot audit ({payload['generated_on']})",
        f"files: {payload['totals']['files']}",
        "",
        "bucket counts:",
    ]
    for bucket, count in payload["totals"]["bucket_counts"].items():
        lines.append(f"- {bucket}: {count}")

    lines.append("")
    lines.append("priority counts:")
    for priority, count in sorted(payload["totals"]["priority_counts"].items()):
        lines.append(f"- {priority}: {count}")

    lines.append("")
    lines.append("top risks:")
    for item in payload["top_priority_files"][:10]:
        lines.append(
            f"- {item['file']} [{item['category']}] {item['priority']} "
            f"(score={item['priority_score']})"
        )

    lines.append("")
    lines.append("manual review queue:")
    for key, items in payload["manual_review_queue"].items():
        lines.append(f"- {key}: {', '.join(item['file'] for item in items)}")

    return "\n".join(lines) + "\n"


def format_markdown(payload: dict[str, Any]) -> str:
    lines = [
        f"# Stories 콘텐츠 품질 블라인드 스팟 감사 리포트 ({payload['generated_on']})",
        "",
        "## 전체 요약",
        f"- 대상 파일: `{payload['totals']['files']}`개",
        f"- 기준 문서: [`{payload['guidelines_path']}`](/Users/hwang-gyeongha/studio/{payload['guidelines_path']})",
        f"- 현행 검증 스크립트는 파싱 오류와 일부 금지 패턴만 막고 있어, 톤·CTA·템플릿 반복은 별도 감사가 필요합니다.",
        "",
        "## 버킷별 정량 결과",
    ]
    for bucket, count in payload["totals"]["bucket_counts"].items():
        lines.append(f"- `{bucket}`: `{count}`개 파일")

    lines.extend(
        [
            "",
            "### 우선순위 분포",
        ]
    )
    for priority, count in sorted(payload["totals"]["priority_counts"].items()):
        lines.append(f"- `{priority}`: `{count}`개 파일")

    for bucket, items in payload["bucket_examples"].items():
        lines.extend(["", f"### {bucket} 예시"])
        if not items:
            lines.append("- 없음")
            continue
        for item in items[:5]:
            notes = item["bucket_notes"].get(bucket) or []
            reason_text = "; ".join(notes[:3]) if notes else "세부 사유 없음"
            lines.append(
                f"- [{item['file']}](/Users/hwang-gyeongha/studio/content/stories/{item['file']}) "
                f"`{item['category']}` `{item['priority']}`: {reason_text}"
            )

    lines.extend(["", "## 카테고리별 분포"])
    for category, stats in sorted(
        payload["category_distribution"].items(),
        key=lambda item: item[1]["files"],
        reverse=True,
    )[:15]:
        lines.append(
            f"- `{category}`: files `{stats['files']}`, "
            f"Tone `{stats['Tone Drift']}`, CTA `{stats['CTA Drift']}`, "
            f"Template `{stats['Template Fatigue']}`, Guideline `{stats['Guideline Mismatch']}`"
        )

    lines.extend(["", "## 구조적 반복 신호"])
    lines.append("### 반복 heading")
    for heading, count in payload["top_repeated_headings"][:10]:
        lines.append(f"- `{heading}`: `{count}`개 파일")
    lines.append("")
    lines.append("### 반복 마무리 문장")
    for closing, count in payload["top_repeated_closing"][:10]:
        lines.append(f"- `{closing}`: `{count}`개 파일")
    lines.append("")
    lines.append("### 반복 본문/CTA 문장")
    for line, count in payload["top_repeated_lines"][:10]:
        lines.append(f"- `{count}`개: {line}")

    lines.extend(["", "## 분류별 후속 조치"])
    for key in ("Auto-fix candidate", "Rule-only ignore", "Manual rewrite candidate"):
        items = payload["all_priorities"][key]
        lines.append(f"### {key}")
        if not items:
            lines.append("- 없음")
            continue
        for item in items[:10]:
            reasons = item["manual_rewrite_reasons"] or item["auto_fix_reasons"] or item["rule_only_reasons"]
            lines.append(
                f"- [{item['file']}](/Users/hwang-gyeongha/studio/content/stories/{item['file']}) "
                f"`{item['category']}`: {'; '.join(reasons[:2]) if reasons else '세부 사유 없음'}"
            )

    lines.extend(["", "## 수동 리뷰 표본 (18개)"])
    queue_labels = {
        "region_service": "지역/서비스형 6개",
        "tech_lecture": "기술/강좌형 6개",
        "recent_rewrites": "최근 정리본 6개",
    }
    for key, label in queue_labels.items():
        lines.append(f"### {label}")
        for item in payload["manual_review_queue"][key]:
            note = payload["manual_review_notes"].get(item["file"])
            if not note:
                lines.append(
                    f"- [{item['file']}](/Users/hwang-gyeongha/studio/content/stories/{item['file']}) "
                    f"`{item['category']}`: 수동 판정 미기입"
                )
                continue
            ratings = note["ratings"]
            lines.append(
                f"- [{item['file']}](/Users/hwang-gyeongha/studio/content/stories/{item['file']}) "
                f"`{item['category']}` "
                f"(tone `{ratings['tone']}`, density `{ratings['density']}`, "
                f"cta `{ratings['cta']}`, template `{ratings['template']}`, "
                f"naturalness `{ratings['naturalness']}`) "
                f"- {note['note']}"
            )

    lines.extend(["", "## 우선순위 상위 20개 파일"])
    for item in payload["top_priority_files"]:
        reasons = item["manual_rewrite_reasons"] or item["auto_fix_reasons"] or item["rule_only_reasons"]
        lines.append(
            f"- [{item['file']}](/Users/hwang-gyeongha/studio/content/stories/{item['file']}) "
            f"`{item['category']}` `{item['priority']}` "
            f"(score `{item['priority_score']}`): {'; '.join(reasons[:3]) if reasons else '세부 사유 없음'}"
        )

    lines.extend(
        [
            "",
            "## 다음 단계 제안",
            "- `validate_story_quality.py`를 이 리포트의 기계적 패턴 일부까지 확장해 검증 범위를 넓힙니다.",
            "- `지역 가이드`와 `지식형 글`을 분리한 CTA 규칙을 추가해 카테고리별 기준을 강제합니다.",
            "- `Manual rewrite candidate` 상위 파일부터 사람 손 재작성 배치를 따로 진행합니다.",
        ]
    )

    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--format", choices=("text", "json", "md"), default="text")
    args = parser.parse_args()

    payload = build_payload()

    if args.format == "json":
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0
    if args.format == "md":
        print(format_markdown(payload))
        return 0

    print(format_text(payload), end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
