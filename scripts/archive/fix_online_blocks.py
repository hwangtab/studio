#!/usr/bin/env python3
"""
지역 가이드 페이지에서 아직 남은 WeTransfer 코드블록 섹션 제거.
다양한 형식(화살표형, 번호형, 변형 헤더)을 처리.
"""
import re, os

STORIES_DIR = "content/stories"

# 축약 대체 텍스트
SHORT_ONLINE = (
    '온라인 파일 의뢰도 가능합니다. 현지에서 드라이 보컬 WAV를 녹음해 파일로 보내주시면 '
    '믹싱·마스터링 후 납품합니다. [자세한 안내](/stories/onlinemix1)'
)

# 더 넓은 패턴: ---\n\n## *의뢰* 또는 *이용하기* 헤더 + 코드블록 포함 + ---
ONLINE_PATTERNS = [
    # 화살표형
    re.compile(
        r'---\n\n## [^\n]*(의뢰|이용하기)[^\n]*\n\n(?:[^\n`]+\n\n)?```\n.*?'
        r'(?:WeTransfer|구글 드라이브).*?```\n\n---',
        re.DOTALL
    ),
    # 변형: 헤더에 ---가 없는 경우 (본문 중간에 삽입된 경우)
    re.compile(
        r'\n\n## [^\n]*(의뢰|이용하기)[^\n]*\n\n(?:[^\n`]+\n\n)?```\n.*?'
        r'(?:WeTransfer|구글 드라이브).*?```\n\n',
        re.DOTALL
    ),
]


def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        raw = f.read()

    if 'category: "지역 가이드"' not in raw:
        return None
    if 'WeTransfer' not in raw and '구글 드라이브' not in raw:
        return None

    original = raw
    content = raw

    for pat in ONLINE_PATTERNS:
        if pat.pattern.startswith('---'):
            # Keep the surrounding separator
            content = pat.sub(f'---\n\n{SHORT_ONLINE}\n\n---', content)
        else:
            content = pat.sub(f'\n\n{SHORT_ONLINE}\n\n', content)

    if content == original:
        return None
    return content


def main():
    files = sorted([f for f in os.listdir(STORIES_DIR)
                    if f.endswith('.md') and f.count('.') == 1])
    modified = 0
    for fname in files:
        fpath = os.path.join(STORIES_DIR, fname)
        result = process_file(fpath)
        if result:
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(result)
            modified += 1

    print(f"수정: {modified}개")
    # Report remaining
    remaining = sum(1 for f in files
                    if 'WeTransfer' in open(os.path.join(STORIES_DIR, f)).read()
                    and 'category: "지역 가이드"' in open(os.path.join(STORIES_DIR, f)).read())
    print(f"남은 WeTransfer 블록: {remaining}개")


if __name__ == '__main__':
    main()
