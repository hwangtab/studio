#!/usr/bin/env python3
"""
가이드·강좌 스토리 파일의 '마치며' 홍보성 문구 제거 스크립트.
- "스튜디오 놀에서 전문 ..." 광고 문장 제거
- "연신내역 도보 5분 ..." 광고 문장 제거
- 내용 요약 문장은 유지
- 홍보 문장만 있던 경우 카테고리별 실용적 대체 문장 추가
"""

import re
import os

STORIES_DIR = "content/stories"

# 홍보 문장 판별 키워드
PROMO_KEYWORDS = [
    '스튜디오 놀에서',
    '스튜디오 놀에 ',
    '연신내역 도보 5분',
    '연신내역 4번 출구',
    '연신내 스튜디오 놀',
]


def is_promo_sentence(sentence):
    return any(kw in sentence for kw in PROMO_KEYWORDS)


# 카테고리별 대체 문장 (홍보 문장만 있었던 경우)
CATEGORY_FALLBACKS = {
    '강좌': "직접 해보고, 듣고, 수정하는 과정이 가장 빠른 성장 방법입니다.",
    '음반 제작 가이드': "믹스에서 가장 중요한 건 전체 밸런스를 잃지 않는 것입니다.",
    '가이드': "기초를 탄탄히 해두면 어떤 장르에도 응용할 수 있습니다.",
    '녹음 가이드': "올바른 환경과 체인이 갖춰지면 후반 작업 시간이 크게 줄어듭니다.",
    '보컬 가이드': "꾸준한 연습과 녹음을 통한 자기 모니터링이 실력 향상의 핵심입니다.",
    '음악 비즈니스 가이드': "수치는 참고용입니다. 내 콘텐츠 방향과 실제 시장 상황에 맞게 조정하세요.",
    '믹싱 가이드': "믹싱은 정답이 없습니다. 레퍼런스 트랙과 계속 비교하면서 귀를 훈련하세요.",
    '음악 프로덕션 가이드': "프로덕션은 한 번에 완성되지 않습니다. 레이어를 쌓아가는 과정을 즐기세요.",
    '음악 비즈니스': "지속 가능한 수익 구조를 만드는 것이 독립 아티스트의 첫 번째 과제입니다.",
    '발성 가이드': "발성은 근육 훈련입니다. 매일 조금씩 꾸준히 하는 것이 효과적입니다.",
    '보컬 테크닉 가이드': "기술보다 자연스러운 표현이 먼저입니다. 테크닉은 표현을 돕는 수단입니다.",
    '마스터링 가이드': "마스터링에서 가장 중요한 건 레퍼런스입니다. 귀보다 레벨미터보다 레퍼런스를 믿으세요.",
    '장비 가이드': "장비보다 중요한 건 사용하는 방법입니다. 가진 장비를 끝까지 이해하고 쓰세요.",
    '보컬 트레이닝 가이드': "훈련의 효과는 누적됩니다. 오늘 연습이 한 달 뒤 차이로 나타납니다.",
    '음악 마케팅': "꾸준한 업로드와 커뮤니티 참여가 알고리즘보다 강합니다.",
    '음악 마케팅 가이드': "꾸준한 업로드와 커뮤니티 참여가 알고리즘보다 강합니다.",
    'SNS 마케팅': "팔로워 수보다 관계의 질이 중요합니다. 진짜 팬 10명이 숫자 1,000명보다 낫습니다.",
    'SNS 가이드': "팔로워 수보다 관계의 질이 중요합니다. 진짜 팬 10명이 숫자 1,000명보다 낫습니다.",
    '작곡 가이드': "완성이 완벽보다 중요합니다. 좋은 곡은 많이 만들다 보면 나옵니다.",
    '음악 제작 가이드': "아이디어가 생기면 완성도보다 속도를 먼저 택하세요. 나중에 다듬으면 됩니다.",
    '음악 제작': "아이디어가 생기면 완성도보다 속도를 먼저 택하세요. 나중에 다듬으면 됩니다.",
    '음악 이론 가이드': "이론은 도구입니다. 직접 연주하고 들어보면서 배운 내용을 체득하세요.",
    '홈 레코딩 가이드': "환경이 완벽하지 않아도 됩니다. 지금 가진 것으로 시작하세요.",
    '음악 커리어 가이드': "커리어는 하루아침에 만들어지지 않습니다. 지금 당장 시작할 수 있는 작은 것부터 하세요.",
    '음원 배포 가이드': "배포보다 중요한 건 나온 후 홍보입니다. 발매 전 커뮤니케이션 계획도 세워두세요.",
    '저작권 가이드': "저작권은 처음부터 꼼꼼히 챙기는 게 나중에 분쟁을 예방합니다.",
    '녹음 기초': "좋은 소리는 녹음 전 준비에서 70%가 결정됩니다.",
    '음악 가이드': "배운 내용을 직접 적용하고 피드백하는 과정을 반복하세요.",
    '서비스 안내': "궁금한 사항은 카카오톡으로 편하게 문의해주세요.",
}
DEFAULT_FALLBACK = "배운 내용을 직접 적용하고 피드백하는 과정을 반복하세요."


def clean_ending(text, category):
    """마치며 텍스트에서 홍보성 문장 제거, 필요시 대체 문장 추가."""
    # 문장 단위로 분리 (마침표/느낌표/물음표 뒤 공백 기준)
    sentences = re.split(r'(?<=[\.!?]) +', text.strip())
    kept = []
    for s in sentences:
        if is_promo_sentence(s):
            continue
        # 카카오톡 예약 멘트도 제거 (중복)
        if '카카오톡으로 예약' in s or '카카오톡으로 문의' in s:
            continue
        kept.append(s)

    cleaned = ' '.join(kept).strip()

    if not cleaned:
        # 모든 문장이 홍보성 → 카테고리별 대체 문장
        return CATEGORY_FALLBACKS.get(category, DEFAULT_FALLBACK)

    return cleaned


def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        raw = f.read()

    # 지역 가이드는 별도 스크립트에서 처리됨
    if 'category: "지역 가이드"' in raw:
        return None

    # 마치며 섹션이 없거나 홍보 문구가 없으면 건너뜀
    if '## 마치며' not in raw:
        return None
    if not any(kw in raw for kw in PROMO_KEYWORDS):
        return None

    original = raw

    # 카테고리 추출
    cat_match = re.search(r'category: "([^"]+)"', raw)
    category = cat_match.group(1) if cat_match else ''

    def replace_ending(m):
        header = m.group(1)
        old_content = m.group(2)
        footer_start = m.group(3)
        new_content = clean_ending(old_content, category)
        return header + new_content + footer_start

    # 마치며 ~ 푸터 링크 사이 교체
    result = re.sub(
        r'(## 마치며\n\n)(.*?)(\n\n\[)',
        replace_ending,
        raw,
        flags=re.DOTALL
    )

    # 마치며가 파일 끝에 있는 경우 (푸터 링크 없음)
    if result == raw and '---' not in raw.split('## 마치며')[-1]:
        def replace_ending_eof(m):
            header = m.group(1)
            old_content = m.group(2)
            new_content = clean_ending(old_content, category)
            return header + new_content
        result = re.sub(
            r'(## 마치며\n\n)(.*?)$',
            replace_ending_eof,
            raw,
            flags=re.DOTALL
        )

    if result == original:
        return None
    return result


def main():
    files = sorted([
        f for f in os.listdir(STORIES_DIR)
        if f.endswith('.md') and f.count('.') == 1
    ])

    modified = 0
    for fname in files:
        filepath = os.path.join(STORIES_DIR, fname)
        result = process_file(filepath)
        if result is not None:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(result)
            modified += 1

    print(f"완료: {modified}개 수정")

    # 검증
    remaining = 0
    for fname in files:
        filepath = os.path.join(STORIES_DIR, fname)
        with open(filepath) as f:
            c = f.read()
        if 'category: "지역 가이드"' in c:
            continue
        m = re.search(r'## 마치며\n\n(.+?)(\n\n\[|\Z)', c, re.DOTALL)
        if m and any(kw in m.group(1) for kw in PROMO_KEYWORDS):
            remaining += 1
    print(f"마치며에 홍보 문구 남은 파일: {remaining}개")


if __name__ == '__main__':
    main()
