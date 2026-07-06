#!/usr/bin/env python3
"""
Fix keyword cannibalization: replace the exact tag "연신내 녹음실" on 60 story files
with diversified long-tail alternatives using round-robin rotation.

5 cornerstone files are skipped (they keep "연신내 녹음실").
"""

import os
import re

STORIES_DIR = os.path.join(os.path.dirname(__file__), '..', 'content', 'stories')

# Files to skip (cornerstone — keep "연신내 녹음실")
SKIP_FILES = {
    'review6.md',
    'eunpyeong1.md',
    'bulgwang1.md',
    'seodaemun1.md',
    'guide1.md',
}

# 60 target files (sorted alphabetically)
TARGET_FILES = [
    'acoustic1.md', 'album1.md', 'aspiring1.md', 'audition1.md', 'ballad1.md',
    'band1.md', 'busking1.md', 'children1.md', 'church1.md', 'cover1.md',
    'direction1.md', 'dongtan1.md', 'duet1.md', 'folk1.md', 'gangbuk1.md',
    'gift1.md', 'gimpo1.md', 'goyang1.md', 'gwanak1.md', 'gwangmyeong1.md',
    'gwangjin1.md', 'hanam1.md', 'hip1.md', 'hwaseong1.md', 'icheon1.md',
    'incheon1.md', 'indie1.md', 'jazz1.md', 'jongno1.md', 'karaoke1.md',
    'mapo1.md', 'midirecord1.md', 'mistakes1.md', 'musical1.md', 'mv1.md',
    'namyangju1.md', 'nowon1.md', 'podcast1.md', 'pop1.md', 'portfolio1.md',
    'pricing1.md', 'recording-cost1.md', 'review1.md', 'review2.md', 'review3.md',
    'review4.md', 'review5.md', 'rnb1.md', 'seongbuk1.md', 'seongnam1.md',
    'songpa1.md', 'studio-compare1.md', 'suwon1.md', 'trot1.md', 'uijeongbu1.md',
    'wedding2.md', 'yangcheon1.md', 'yongsan1.md', 'youtube1.md', 'yeongdeungpo1.md',
]

# Replacement tags — round-robin by file index
REPLACEMENTS = [
    '연신내역 보컬 녹음',
    '은평구 녹음실',
    '서울 녹음실',
    '연신내 스튜디오',
    '은평구 보컬 녹음',
    '서울 보컬 녹음실',
    '연신내 음악 스튜디오',
    '녹음실 추천',
]

OLD_TAG = '연신내 녹음실'


def find_tags_line(lines):
    """Return the index of the tags: line inside YAML frontmatter, or -1."""
    in_frontmatter = False
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped == '---':
            if not in_frontmatter:
                in_frontmatter = True
                continue
            else:
                # End of frontmatter
                return -1
        if in_frontmatter and stripped.startswith('tags:'):
            return i
    return -1


def get_existing_tags(tags_line):
    """Extract tag strings from a tags line like: tags: ["tag1", "tag2"]"""
    # Find the array content between [ and ]
    match = re.search(r'\[(.+)\]', tags_line)
    if not match:
        return set()
    inner = match.group(1)
    # Extract all quoted strings
    return set(re.findall(r'"([^"]*)"', inner))


def replace_exact_tag(tags_line, old_tag, new_tag):
    """
    Replace the exact tag "old_tag" with "new_tag" in the tags line.
    Only matches the exact quoted tag — not substrings like "7호선 연신내 녹음실".
    """
    # Match "old_tag" as a complete quoted element (preceded by [ or , and optional space)
    # The pattern ensures we match the full quoted string exactly
    pattern = r'"' + re.escape(old_tag) + r'"'
    replacement = '"' + new_tag + '"'

    # Verify the match is exact (not a substring of a longer tag)
    # We check by finding all quoted strings and only replacing if exact match exists
    quoted_tags = re.findall(r'"([^"]*)"', tags_line)
    if old_tag not in quoted_tags:
        return tags_line, False

    # Now do the replacement — only replace the first occurrence
    new_line = re.sub(pattern, replacement, tags_line, count=1)
    return new_line, new_line != tags_line


def pick_replacement(file_index, existing_tags):
    """
    Pick a replacement tag using round-robin, skipping tags that already exist.
    """
    base_index = file_index % len(REPLACEMENTS)
    for offset in range(len(REPLACEMENTS)):
        candidate = REPLACEMENTS[(base_index + offset) % len(REPLACEMENTS)]
        if candidate not in existing_tags:
            return candidate
    # All replacement tags already exist — should not happen, but return base anyway
    return REPLACEMENTS[base_index]


def main():
    modified_count = 0
    samples = []

    for i, filename in enumerate(TARGET_FILES):
        if filename in SKIP_FILES:
            print(f'SKIP (cornerstone): {filename}')
            continue

        filepath = os.path.join(STORIES_DIR, filename)
        if not os.path.exists(filepath):
            print(f'WARNING: file not found: {filename}')
            continue

        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        lines = content.split('\n')
        tags_idx = find_tags_line(lines)
        if tags_idx == -1:
            print(f'WARNING: no tags line found in: {filename}')
            continue

        tags_line = lines[tags_idx]
        existing_tags = get_existing_tags(tags_line)

        if OLD_TAG not in existing_tags:
            print(f'SKIP (tag not found): {filename}')
            continue

        # Remove old tag from existing set for collision check
        check_tags = existing_tags - {OLD_TAG}
        replacement = pick_replacement(i, check_tags)

        new_line, changed = replace_exact_tag(tags_line, OLD_TAG, replacement)
        if not changed:
            print(f'WARNING: replacement failed for: {filename}')
            continue

        lines[tags_idx] = new_line
        new_content = '\n'.join(lines)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)

        modified_count += 1
        samples.append((filename, OLD_TAG, replacement))
        print(f'OK: {filename} — "{OLD_TAG}" → "{replacement}"')

    print(f'\n{"=" * 60}')
    print(f'Total files modified: {modified_count}')
    print(f'{"=" * 60}')

    if samples:
        print(f'\nSample replacements (first 5):')
        for fname, old, new in samples[:5]:
            print(f'  {fname}: "{old}" → "{new}"')


if __name__ == '__main__':
    main()
