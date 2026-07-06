#!/usr/bin/env python3
"""
Shorten overlong summary fields in Korean base story markdown files.
Only modifies the summary: line in YAML frontmatter.
"""

import os
import re
import glob

STORIES_DIR = os.path.join(os.path.dirname(__file__), '..', 'content', 'stories')
MAX_LEN = 110
TARGET_LEN = 95


def shorten_summary(text):
    """Shorten summary text to ~95-100 characters at a natural boundary."""
    if len(text) <= MAX_LEN:
        return text

    # Strategy 1: Find last period between positions 70-95
    last_period = -1
    for i in range(min(TARGET_LEN, len(text) - 1), 69, -1):
        if text[i] == '.':
            last_period = i
            break

    if last_period >= 70:
        return text[:last_period + 1]

    # Strategy 2: Find last comma or space at or before position 95
    cut_pos = -1
    for i in range(min(TARGET_LEN, len(text) - 1), -1, -1):
        if text[i] in (',', ' '):
            cut_pos = i
            break

    if cut_pos > 0:
        result = text[:cut_pos].rstrip()
        # Add ... if it doesn't end with a period
        if not result.endswith('.'):
            # If it ends with a comma, remove it and add ...
            if result.endswith(','):
                result = result[:-1]
            result += '...'
        return result

    # Fallback: hard cut at 95 + ...
    return text[:TARGET_LEN].rstrip() + '...'


def process_files():
    pattern = os.path.join(STORIES_DIR, '*.md')
    all_files = glob.glob(pattern)

    # Filter: only Korean base files (exclude locale variants like .en.md, .es.md)
    base_files = [f for f in all_files if not re.search(r'\.[a-z]{2}\.md$', f)]
    base_files.sort()

    total_scanned = 0
    total_modified = 0
    changes = []  # (filename, old_summary, new_summary, old_len, new_len)

    for filepath in base_files:
        total_scanned += 1
        filename = os.path.basename(filepath)

        with open(filepath, 'r', encoding='utf-8') as fh:
            content = fh.read()

        # Match the summary line in YAML frontmatter
        m = re.search(r'^(summary:\s*)"(.+?)"\s*$', content, re.MULTILINE)
        if not m:
            continue

        prefix = m.group(1)  # e.g. 'summary: '
        old_summary = m.group(2)

        if len(old_summary) <= MAX_LEN:
            continue

        new_summary = shorten_summary(old_summary)

        # Replace only the summary line
        old_line = m.group(0)
        new_line = f'{prefix}"{new_summary}"'
        new_content = content.replace(old_line, new_line, 1)

        with open(filepath, 'w', encoding='utf-8') as fh:
            fh.write(new_content)

        total_modified += 1
        reduction = len(old_summary) - len(new_summary)
        changes.append((filename, old_summary, new_summary, len(old_summary), len(new_summary), reduction))

    # Sort by reduction (most dramatic first)
    changes.sort(key=lambda x: x[5], reverse=True)

    # Print report
    print(f'Total files scanned: {total_scanned}')
    print(f'Total files modified: {total_modified}')
    print()
    print('=== Top 5 most dramatically shortened ===')
    print()
    for i, (fname, old, new, old_len, new_len, reduction) in enumerate(changes[:5]):
        print(f'{i+1}. {fname}')
        print(f'   BEFORE ({old_len} chars): {old}')
        print(f'   AFTER  ({new_len} chars): {new}')
        print(f'   Reduction: {reduction} chars')
        print()


if __name__ == '__main__':
    process_files()
