#!/usr/bin/env python3
"""
지역 가이드 페이지 품질 개선 스크립트 (수정판)
1. 음악과 무관한 지역 특산/관광 태그 제거 (인라인 JSON 배열 형식 지원)
2. 5단계 온라인 파일 의뢰 코드블록 → 1문장으로 축약
3. 스튜디오 놀 서비스 테이블 섹션 제거
4. 본문 내 "스튜디오 주소" 중복 라인 제거
5. "마치며" 홍보성 문구를 실용적 문구로 교체
"""

import os
import re
import hashlib

STORIES_DIR = "content/stories"

# 음악과 무관한 태그에 포함되는 키워드 (지역 특산물·관광)
IRRELEVANT_KW = [
    "한우", "은어", "녹차", "반딧불이", "축제", "온천", "서피비치",
    "지평선", "팔경", "나비", "퍼플 섬", "송이", "오대쌀", "게장",
    "꽃게", "대게", "물회", "땅끝", "인삼", "막걸리", "한지",
    "도자기", "해수욕", "스키장", "눈꽃", "갈대밭", "낙산 서피",
    "쌀밥", "도라지", "곶감", "감자", "고구마", "배추",
]

# 부족할 때 채울 대체 태그 풀
REPLACEMENT_TAGS = [
    "서울 녹음실",
    "전문 녹음 스튜디오",
    "보컬 녹음 스튜디오",
    "음반 제작",
    "녹음실 추천",
]

# 거리 티어별 "마치며" 실용적 마무리 문장
ENDINGS = {
    "seoul": [
        "방문 전 카카오톡으로 예약 시간을 먼저 잡아두시면 대기 없이 바로 세션에 들어갈 수 있습니다.",
        "가까운 거리인 만큼 부담 없이 들러보세요. 예약 문의는 카카오톡으로 주시면 됩니다.",
        "세션 일정은 카카오톡으로 미리 조율해주세요. 도착 전 워밍업 시간을 여유 있게 잡는 걸 권장합니다.",
    ],
    "gyeonggi": [
        "당일 세션을 마치고 저녁 전 귀가 가능한 거리입니다. 방문 전 카카오톡으로 예약해주세요.",
        "세션 일정은 카카오톡으로 미리 잡아두시면 대기 없이 바로 시작합니다.",
        "이동 전 카카오톡으로 원하는 사운드 방향을 미리 공유해주시면 세션 준비 시간이 줄어듭니다.",
    ],
    "ktx": [
        "먼 거리를 오시는 만큼 방문 전 카카오톡으로 사운드 방향과 자료를 미리 공유해주시면 세션 시간을 절약할 수 있습니다.",
        "KTX 이동 피로가 있을 수 있으므로 세션 전 워밍업 시간을 여유롭게 확보하시길 권장합니다.",
        "왕복 일정을 고려해 세션 시간을 넉넉하게 잡아두세요. 예약 문의는 카카오톡으로 주세요.",
    ],
    "remote": [
        "이동이 부담스럽다면 온라인 파일 의뢰를 추천합니다. 현지에서 드라이 보컬 WAV만 녹음해 보내주시면 믹싱·마스터링 후 납품합니다.",
        "방문보다 파일 의뢰가 현실적인 선택입니다. 현지 WAV 녹음 → 카카오톡 전송 → 완성 파일 납품까지 소통합니다.",
        "거리가 있는 만큼 카카오톡으로 미리 충분히 소통해두세요. 온라인 의뢰도 동일한 결과물로 납품합니다.",
    ],
}


def pick_variant(variants, filename):
    """파일명 해시 기반으로 일관된 변형 선택."""
    h = int(hashlib.md5(filename.encode()).hexdigest(), 16)
    return variants[h % len(variants)]


def is_irrelevant_tag(tag):
    return any(kw in tag for kw in IRRELEVANT_KW)


def detect_tier(body):
    """교통수단·소요시간으로 거리 티어 판별."""
    if any(w in body for w in ["여객선", "도선", "울릉도", "독도"]):
        return "remote"
    time_match = re.search(r'총 소요시간[^\n]*약 (\d+)시간', body)
    if time_match:
        hours = int(time_match.group(1))
        if hours >= 3:
            return "remote"
        elif hours >= 1:
            return "ktx"
    bus_match = re.search(r'고속버스.*?약 (\d+)시간', body)
    if bus_match and int(bus_match.group(1)) >= 3:
        return "remote"
    if "KTX" in body:
        return "ktx"
    if "비행기" in body or "항공" in body:
        return "remote"
    min_match = re.search(r'총 소요시간[^\n]*약 (\d+)[~\-]?\d*분', body)
    if min_match:
        mins = int(min_match.group(1))
        return "seoul" if mins <= 40 else "gyeonggi"
    if "KTX" not in body and "고속버스" not in body and "기차" not in body:
        return "seoul"
    return "gyeonggi"


def fix_inline_tags(fm_text):
    """tags: ["tag1", "tag2", ...] 형식에서 무관한 태그 제거."""
    def process_tags(match):
        tags_str = match.group(1)
        tags = re.findall(r'"([^"]+)"', tags_str)
        filtered = [t for t in tags if not is_irrelevant_tag(t)]

        # 6개 미만이면 대체 태그 추가
        for rtag in REPLACEMENT_TAGS:
            if len(filtered) >= 7:
                break
            if rtag not in filtered:
                filtered.append(rtag)

        new_tags = ', '.join(f'"{t}"' for t in filtered)
        return f'tags: [{new_tags}]'

    return re.sub(r'tags: \[([^\]]+)\]', process_tags, fm_text)


def clean_ending(text, tier, filename):
    """마치며 텍스트에서 홍보성·잉여 문구 제거 후 실용적 문장 추가."""
    # 제거할 패턴 (앞 공백 포함하여 자연스럽게 분리)
    remove_patterns = [
        # "연신내역 도보 5분의 스튜디오 놀에서" 잔여 텍스트
        r',? 연신내역 도보 5분의 스튜디오 놀에서',
        r' 연신내역 도보 5분의 스튜디오 놀에서',
        # 홍보성 표현
        r' 스튜디오 놀에서 전문 보컬 녹음을 경험하세요\.',
        r' 스튜디오 놀에서 전문 보컬 녹음을 경험할 수 있습니다\.',
        r' 전문 보컬 녹음을 경험해보세요\.',
        r'\s*Neumann U87 AI와 전문 엔지니어로 완성도 높은 보컬 녹음을 경험하세요\.',
        # 온라인 의뢰 중복 안내
        r' 방문이 어렵다면 온라인 파일 의뢰도 가능합니다\.',
        r' 방문이 어렵다면 온라인 파일 의뢰로 동일한 서비스를 받으세요\.',
        r' 이동이 부담스럽다면 온라인 파일 의뢰로 동일한 서비스를 받으세요\.',
        r' 온라인 파일 의뢰도 가능합니다\.',
        r' 방문 또는 온라인 파일 의뢰로 이용 가능합니다\.',
        r'\s*드라이 보컬 WAV 파일만 있으면 스튜디오 놀의 전문 믹싱·마스터링 서비스를 받을 수 있습니다\.',
        r'\s*온라인 파일 의뢰 서비스를 적극 추천합니다\.',
        # 예약 안내 중복
        r' 카카오톡으로 사전 상담 후 예약해주세요\.',
    ]

    cleaned = text
    for pat in remove_patterns:
        cleaned = re.sub(pat, '', cleaned)

    cleaned = cleaned.strip().rstrip(',')

    action = pick_variant(ENDINGS[tier], filename)

    if not cleaned:
        return action
    else:
        # 마침표로 끝나지 않으면 추가
        if not cleaned.endswith('.'):
            cleaned = cleaned + '.'
        return cleaned + ' ' + action


def process_file(filepath, filename):
    with open(filepath, 'r', encoding='utf-8') as f:
        raw = f.read()

    if 'category: "지역 가이드"' not in raw:
        return None

    original = raw

    # 프론트매터 / 본문 분리
    parts = raw.split('---', 2)
    if len(parts) < 3:
        return None

    fm = parts[1]
    body = parts[2]

    # --- 1. 태그 정리 (인라인 JSON 배열 형식) ---
    fm = fix_inline_tags(fm)

    # 티어 감지
    tier = detect_tier(body)

    # --- 2. 5단계 온라인 파일 의뢰 코드블록 → 1문장 ---
    online_pattern = re.compile(
        r'---\n\n## 온라인 파일 의뢰 서비스\n\n(?:서울 방문이 어려울 때:\n\n)?```\n.*?'
        r'→ 구글 드라이브 또는 WeTransfer 업로드\n'
        r'→ 카카오톡으로 링크 전송\n'
        r'→ 믹싱·마스터링 \(영업일 2~5일\)\n'
        r'→ 완성 WAV \+ MP3 온라인 납품\n'
        r'```\n\n---',
        re.DOTALL
    )
    if online_pattern.search(body):
        body = online_pattern.sub(
            '---\n\n온라인 파일 의뢰도 가능합니다. 현지에서 드라이 보컬 WAV를 녹음해 파일로 보내주시면 '
            '믹싱·마스터링 후 납품합니다. [자세한 안내](/stories/onlinemix1)\n\n---',
            body
        )

    # --- 3. 스튜디오 놀 서비스 테이블 섹션 제거 ---
    service_pattern = re.compile(
        r'---\n\n## 스튜디오 놀 서비스\n\n\| 서비스 \| 내용 \|.*?'
        r'\*\*스튜디오 주소\*\*:.*?\n\n---',
        re.DOTALL
    )
    body = service_pattern.sub('---', body)

    # --- 4. 본문 내 단독 "스튜디오 주소" 라인 제거 ---
    body = re.sub(
        r'\n\*\*스튜디오 주소\*\*: 서울특별시 은평구 \(연신내역 4번 출구 도보 5분\)\n',
        '\n',
        body
    )

    # --- 5. "마치며" 홍보성 문구 교체 ---
    def replace_ending(m):
        header = m.group(1)
        old_content = m.group(2)
        footer_start = m.group(3)
        new_content = clean_ending(old_content, tier, filename)
        return header + new_content + footer_start

    body = re.sub(
        r'(## 마치며\n\n)(.*?)(\n\n\[)',
        replace_ending,
        body,
        flags=re.DOTALL
    )

    result = f'---{fm}---{body}'

    if result == original:
        return None
    return result


def main():
    files = sorted([
        f for f in os.listdir(STORIES_DIR)
        if f.endswith('.md') and f.count('.') == 1
    ])

    modified = 0
    skipped = 0

    for fname in files:
        filepath = os.path.join(STORIES_DIR, fname)
        result = process_file(filepath, fname)
        if result is not None:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(result)
            modified += 1
        else:
            skipped += 1

    print(f"완료: {modified}개 수정, {skipped}개 변경 없음")


if __name__ == '__main__':
    main()
