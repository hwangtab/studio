"""
Cross-link cleanup script for Studio NOL stories.

Removes bulk-added cross-links from all story markdown files.
Keeps only a clean 3-line footer for practice-room articles.
For non-practice-room articles, keeps curated pipe-separated links
but strips practice-room article links from them.

Excludes: practice-room-yeonsinnae1.md (pillar hub, keep all links)
"""

import os
import re

STORIES_DIR = "content/stories"
PRICING_ANCHOR = "[스튜디오 놀 이용 요금](/pricing)"
SKIP_FILES = {"practice-room-yeonsinnae1.md"}

# Standard footer inserted before pricing for practice-room articles
PRACTICE_FOOTER = [
    "**→ [스튜디오 놀 음악연습실 예약](/practice-room)**  ",
    "**→ [연신내 음악연습실 추천 가이드](/stories/ko/practice-room-yeonsinnae1)**",
]


def is_bulk_arrow_line(line: str) -> bool:
    """Matches **→ [ cross-link lines."""
    return line.strip().startswith("**→ [")


def is_dash_practice_link(line: str) -> bool:
    """Matches - [text](/stories/ko/practice-room-*) bulk links from intermediate era."""
    s = line.strip()
    return s.startswith("- [") and "/stories/ko/practice-room-" in s


def is_pipe_line(line: str) -> bool:
    """Matches long pipe-separated link lines (various starting formats)."""
    s = line.strip()
    return " | " in s and "[" in s and ("](/stories/" in s or "](/pricing" in s)


def filter_pipe_line(line: str) -> str | None:
    """
    For non-practice-room articles: remove practice-room links and
    embedded **→ items from the pipe-separated line.
    Returns None if nothing remains.
    """
    s = line.strip()
    parts = re.split(r" \| ", s)
    kept = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        # Drop practice-room article links (both old and new path formats)
        if "/stories/practice-room-" in part or "/stories/ko/practice-room-" in part:
            continue
        # Drop embedded **→ items that crept into the pipe line
        if part.startswith("**→"):
            continue
        kept.append(part)
    return " | ".join(kept) if kept else None


STANDARD_FOOTER = "\n".join([
    "**→ [스튜디오 놀 음악연습실 예약](/practice-room)**  ",
    "**→ [연신내 음악연습실 추천 가이드](/stories/ko/practice-room-yeonsinnae1)**",
    "[스튜디오 놀 이용 요금](/pricing)",
])


def process_file_no_anchor(path: str) -> bool:
    """
    For practice-room files that lack the pricing anchor:
    Trim all trailing arrow/pipe/dash-link lines from EOF,
    then append the standard 3-line footer.
    """
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    lines = content.split("\n")

    # Find last non-footer line by scanning backwards
    last_content_idx = len(lines) - 1
    while last_content_idx >= 0:
        line = lines[last_content_idx]
        s = line.strip()
        if not s:  # blank line
            last_content_idx -= 1
            continue
        if is_bulk_arrow_line(line) or is_dash_practice_link(line) or is_pipe_line(line):
            last_content_idx -= 1
            continue
        break

    new_lines = lines[: last_content_idx + 1]
    new_content = "\n".join(new_lines).rstrip() + "\n\n" + STANDARD_FOOTER + "\n"

    if new_content == content:
        return False

    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)
    return True


def process_non_practice_no_anchor(path: str) -> bool:
    """
    For non-practice-room files that lack the exact pricing anchor:
    Find pipe-separated lines and filter practice-room links from them.
    Also remove any **→ bulk links.
    """
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    lines = content.split("\n")
    new_lines: list[str] = []
    modified = False

    for line in lines:
        # Remove bulk arrow lines
        if is_bulk_arrow_line(line):
            modified = True
            continue
        # Remove dash-format practice-room links
        if is_dash_practice_link(line):
            modified = True
            continue
        # Filter pipe-separated lines
        if is_pipe_line(line):
            filtered = filter_pipe_line(line)
            if filtered != line.strip():
                modified = True
            if filtered:
                new_lines.append(filtered)
            continue
        new_lines.append(line)

    if not modified:
        return False

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(new_lines))
    return True


def process_file(path: str, is_practice: bool) -> bool:
    """Process a single file. Returns True if the file was modified."""
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    if PRICING_ANCHOR not in content:
        if is_practice:
            return process_file_no_anchor(path)
        # Non-practice-room files without exact pricing anchor:
        # use EOF-based trimming to clean practice-room links from pipe lines
        return process_non_practice_no_anchor(path)

    lines = content.split("\n")
    new_lines: list[str] = []
    pricing_done = False
    modified = False

    for line in lines:
        if pricing_done:
            new_lines.append(line)
            continue

        stripped = line.strip()

        # ── Pricing anchor → inject standard footer (practice-room only) ──
        if stripped == PRICING_ANCHOR:
            if is_practice:
                for fl in PRACTICE_FOOTER:
                    new_lines.append(fl)
                modified = True  # always mark modified for practice articles
            new_lines.append(line)
            pricing_done = True
            continue

        # ── Bulk **→ [ cross-links ───────────────────────────────────────
        if is_bulk_arrow_line(line):
            modified = True
            continue

        # ── Dash-format practice-room cross-links ────────────────────────
        if is_dash_practice_link(line):
            modified = True
            continue

        # ── Pipe-separated link lines ────────────────────────────────────
        if is_pipe_line(line):
            if is_practice:
                # Entire pipe line is redundant for practice-room articles
                modified = True
                continue
            else:
                filtered = filter_pipe_line(line)
                if filtered != stripped:
                    modified = True
                if filtered:
                    new_lines.append(filtered)
                # else: line completely removed (all links were practice-room)
                continue

        new_lines.append(line)

    if not modified:
        return False

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(new_lines))
    return True


def main() -> None:
    files = sorted(os.listdir(STORIES_DIR))
    updated_practice = 0
    updated_other = 0
    skipped = 0

    for fname in files:
        if not fname.endswith(".md"):
            continue
        if fname in SKIP_FILES:
            skipped += 1
            continue

        path = os.path.join(STORIES_DIR, fname)
        is_practice = fname.startswith("practice-room-")

        if process_file(path, is_practice):
            if is_practice:
                updated_practice += 1
            else:
                updated_other += 1

    total = updated_practice + updated_other
    print(f"Skipped (hub):          {skipped}")
    print(f"Updated practice-room:  {updated_practice}")
    print(f"Updated other articles: {updated_other}")
    print(f"Total updated:          {total}")


if __name__ == "__main__":
    main()
