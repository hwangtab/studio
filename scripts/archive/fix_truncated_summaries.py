#!/usr/bin/env python3
"""
summary 필드가 `..."` 로 잘린 28개 파일을 복원합니다.

전략: 파일의 ## 섹션 제목들을 읽어 완성된 summary를 생성합니다.
- 첫 번째 ## (intro 섹션)과 마지막 ## 마치며 제외
- 나머지 섹션명을 · 구분으로 나열
- 끝에 "까지 정리합니다." 추가
- 160자 이내 유지
"""
import os
import re
import sys

STORIES_DIR = os.path.join(os.path.dirname(__file__), '..', 'content', 'stories')

# 수정 대상 파일 목록 (summary가 `..."` 로 끝나는 파일)
TARGET_FILES = [
    'ableton1.md', 'ai-music1.md', 'bus-compression1.md', 'comp1176.md',
    'comping1.md', 'compression-guide1.md', 'cubase1.md', 'daw1.md',
    'epk1.md', 'fabfilter1.md', 'flstudio1.md', 'headphone-mixing1.md',
    'la2a1.md', 'lofi-music1.md', 'logicpro1.md', 'lufs-guide1.md',
    'monitor-speakers1.md', 'music-analytics1.md', 'music-distribution1.md',
    'nectar1.md', 'pitch1.md', 'ssl-bus1.md', 'streaming-release1.md',
    'studioone1.md', 'vocal-breath1.md', 'vocal-comping1.md',
    'vocal-microphone1.md', 'vocal-reverb1.md',
]

# summary 첫 부분 패턴에서 제거할 반복 표현들
STRIP_ENDINGS = ['...', '..', '.']


def build_summary(current_summary, sections):
    """
    현재 절단된 summary와 섹션 목록으로 완성된 summary 생성.
    """
    # 현재 summary에서 절단 표시(`...`) 제거
    base = current_summary.rstrip()
    for ending in STRIP_ENDINGS:
        if base.endswith(ending + '"'):
            base = base[:-len(ending) - 1].rstrip(', ·').rstrip()
            break

    # 섹션 필터링: 제목 섹션(첫 번째)과 마치며 제외
    content_sections = []
    skip_patterns = ['마치며', '마무리', '결론', '스튜디오 놀', 'Studio NOL']
    for i, sec in enumerate(sections):
        if i == 0:
            continue  # 첫 번째 섹션(보통 intro) 제외
        if any(p in sec for p in skip_patterns):
            continue
        content_sections.append(sec)

    if not content_sections:
        return current_summary

    # 완성된 summary 구성
    # 이미 summary에 포함된 섹션명을 찾아 나머지만 추가
    # 간단하게: 전체 섹션을 · 구분으로 새로 구성
    full_sections_str = '·'.join(content_sections)

    # summary 첫 문장 (완전 가이드입니다 앞부분)만 유지
    first_sentence_m = re.match(r'^(.+?(?:입니다|가이드|방법|비교|가이드입니다)\.)', base)
    if first_sentence_m:
        intro = first_sentence_m.group(1)
    else:
        # 점이 없으면 전체 base를 intro로
        intro = base

    new_summary = f"{intro} {full_sections_str}까지 정리합니다."

    # 160자 초과 시 섹션 수 줄이기
    if len(new_summary) > 160:
        # 섹션을 줄여가며 160자 이내로
        for n in range(len(content_sections) - 1, 1, -1):
            truncated = '·'.join(content_sections[:n])
            candidate = f"{intro} {truncated}까지 정리합니다."
            if len(candidate) <= 160:
                new_summary = candidate
                break

    return new_summary


def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # summary 필드 찾기
    summary_m = re.search(r'^(summary:\s*["\'])(.+?)(["\'])\s*$', content, re.MULTILINE)
    if not summary_m:
        return False

    current_summary = summary_m.group(2)

    # 절단 여부 확인
    if not current_summary.endswith('...'):
        return False

    # 섹션 제목 추출
    sections = re.findall(r'^## (.+)$', content, re.MULTILINE)
    if not sections:
        return False

    new_summary = build_summary(current_summary, sections)

    if new_summary == current_summary:
        return False

    # 교체
    old_field = f"{summary_m.group(1)}{current_summary}{summary_m.group(3)}"
    new_field = f"{summary_m.group(1)}{new_summary}{summary_m.group(3)}"

    new_content = content.replace(old_field, new_field, 1)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

    return True


def main():
    if len(sys.argv) > 1:
        files = [os.path.join(STORIES_DIR, f) if not os.path.isabs(f) else f
                 for f in sys.argv[1:]]
    else:
        files = [os.path.join(STORIES_DIR, f) for f in TARGET_FILES]

    modified = 0
    for filepath in files:
        if not os.path.exists(filepath):
            print(f"NOT FOUND: {filepath}")
            continue
        result = fix_file(filepath)
        if result:
            modified += 1
            # 결과 출력
            with open(filepath) as fh:
                content = fh.read()
            m = re.search(r'^summary:\s*["\'](.+)["\']', content, re.MULTILINE)
            if m:
                print(f"OK  {os.path.basename(filepath)}: {m.group(1)[:80]}...")
        else:
            print(f"SKIP {os.path.basename(filepath)}")

    print(f"\nModified: {modified}/{len(files)}")


if __name__ == '__main__':
    main()
