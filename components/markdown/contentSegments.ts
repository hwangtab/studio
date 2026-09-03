export type ShortcodeSegment = { type: 'shortcode'; name: string; arg?: string };
export type MarkdownSegment = { type: 'markdown'; value: string };
export type ContentSegment = ShortcodeSegment | MarkdownSegment;

export const splitContentByShortcodes = (content: string): ContentSegment[] => {
  const segments: ContentSegment[] = [];
  // %%name%% 또는 %%name:arg%% 자체 라인 매칭.
  // gray-matter는 frontmatter 종료 후 첫 줄 앞에 개행을 남기지 않으므로,
  // 본문이 shortcode로 바로 시작하는 경우를 위해 문자열 시작(^)도 매치한다.
  const parts = content.split(/(?:^|\n)%%([\w-]+)(?::([^%\n]+))?%%(?=\n|$)/);

  for (let i = 0; i < parts.length; i += 3) {
    if (parts[i] && parts[i].trim()) {
      segments.push({ type: 'markdown', value: parts[i] });
    }
    if (i + 1 < parts.length) {
      const name = parts[i + 1];
      const arg = parts[i + 2];
      segments.push({ type: 'shortcode', name, ...(arg !== undefined && { arg }) });
    }
  }

  return segments;
};
