from pathlib import Path
import re
import sys


LOCALES = {"ko", "en", "zh", "es", "vi", "th", "uz"}
ROOT = Path(__file__).resolve().parents[1]
STORIES_DIR = ROOT / "content" / "stories"
REDIRECTS_FILE = ROOT / "lib" / "storyRedirects.ts"
LINK_RE = re.compile(r"\((/stories(?:/(?:ko|en|zh|es|vi|th|uz))?/[^)#?\s]+)\)")
REDIRECT_RE = re.compile(r'"([^"]+)":\s*"[^"]+"')
LOCALIZED_LINK_RE = re.compile(r"^/stories/(ko|en|zh|es|vi|th|uz)/")


def normalize_slug(filename: str) -> str:
    suffix = Path(filename).stem
    parts = suffix.split(".")
    if parts[-1] in LOCALES:
        return ".".join(parts[:-1])
    return suffix


def load_existing_slugs() -> set[str]:
    return {normalize_slug(path.name) for path in STORIES_DIR.glob("*.md")}


def load_redirect_only_slugs() -> set[str]:
    if not REDIRECTS_FILE.exists():
        return set()
    return set(REDIRECT_RE.findall(REDIRECTS_FILE.read_text()))


def iter_targets(argv: list[str]) -> list[Path]:
    if not argv:
        return sorted(STORIES_DIR.glob("*.md"))

    targets: list[Path] = []
    for raw in argv:
        path = Path(raw)
        if not path.is_absolute():
            path = ROOT / raw
        if path.is_dir():
            targets.extend(sorted(path.glob("*.md")))
        elif path.exists():
            targets.append(path)
        else:
            raise FileNotFoundError(f"Target not found: {raw}")
    return targets


def main(argv: list[str]) -> int:
    existing_slugs = load_existing_slugs()
    redirect_only_slugs = load_redirect_only_slugs()
    problems: list[tuple[Path, int, str, str]] = []

    for path in iter_targets(argv):
        for lineno, line in enumerate(path.read_text().splitlines(), start=1):
            for match in LINK_RE.finditer(line):
                href = match.group(1)
                if LOCALIZED_LINK_RE.match(href):
                    problems.append((path, lineno, href, "localized story path"))
                    continue
                slug = href.split("/")[-1]
                if slug in redirect_only_slugs:
                    problems.append((path, lineno, href, "redirect-only slug"))
                elif slug not in existing_slugs:
                    problems.append((path, lineno, href, "missing slug"))

    if problems:
        print("Invalid story links found:")
        for path, lineno, href, reason in problems:
            print(f"- {path.relative_to(ROOT)}:{lineno} {href} ({reason})")
        return 1

    print(f"Validated story links for {len(iter_targets(argv))} files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
