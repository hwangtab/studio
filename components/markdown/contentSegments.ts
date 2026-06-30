export type ShortcodeSegment = { type: 'shortcode'; name: string; arg?: string };
export type MarkdownSegment = { type: 'markdown'; value: string };
export type ContentSegment = ShortcodeSegment | MarkdownSegment;

export const splitContentByShortcodes = (content: string): ContentSegment[] => {
  const segments: ContentSegment[] = [];
  // %%name%% 또는 %%name:arg%% 자체 라인 매칭
  const parts = content.split(/\n%%([\w-]+)(?::([^%\n]+))?%%(?=\n|$)/);

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
