#!/usr/bin/env python3
"""
모든 스토리 마크다운 파일에서 마지막 푸터 링크 줄 앞에 --- 구분선을 추가합니다.
이미 --- 가 있는 파일은 건너뜁니다.
"""
import os
import re

STORIES_DIR = os.path.join(os.path.dirname(__file__), '..', 'content', 'stories')

# 푸터 링크 패턴: 줄이 [로 시작하고 ](/ 를 포함하는 마크다운 링크
FOOTER_LINK_RE = re.compile(r'^\[.+\]\(/')

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.rstrip('\n').split('\n')

    # 마지막 줄에서 푸터 링크 줄 찾기 (보통 마지막 줄 또는 마지막에서 1~2번째)
    footer_idx = None
    for i in range(len(lines) - 1, max(len(lines) - 5, -1), -1):
        if FOOTER_LINK_RE.match(lines[i].strip()):
            footer_idx = i
            break

    if footer_idx is None:
        return False  # 푸터 링크 없음

    # 이미 --- 가 앞에 있는지 확인
    # 빈 줄 건너뛰고 --- 확인
    check_idx = footer_idx - 1
    while check_idx >= 0 and lines[check_idx].strip() == '':
        check_idx -= 1

    if check_idx >= 0 and lines[check_idx].strip() == '---':
        return False  # 이미 구분선 있음

    # 올바른 형식: 본문 → 빈줄 → --- → 빈줄 → [링크]
    # 기존 빈 줄 제거 후 정규화
    while footer_idx > 0 and lines[footer_idx - 1].strip() == '':
        lines.pop(footer_idx - 1)
        footer_idx -= 1

    # 본문 → '' → '---' → '' → [링크]
    lines.insert(footer_idx, '')
    lines.insert(footer_idx, '---')
    lines.insert(footer_idx, '')

    new_content = '\n'.join(lines) + '\n'
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    return True


def main():
    modified = 0
    skipped = 0
    no_footer = 0

    for fname in sorted(os.listdir(STORIES_DIR)):
        if not fname.endswith('.md'):
            continue
        filepath = os.path.join(STORIES_DIR, fname)
        result = process_file(filepath)
        if result:
            modified += 1
        elif result is False:
            # 구분선 이미 있거나 푸터 없음
            skipped += 1

    print(f"Modified: {modified}")
    print(f"Skipped (already has separator or no footer): {skipped}")


if __name__ == '__main__':
    main()
