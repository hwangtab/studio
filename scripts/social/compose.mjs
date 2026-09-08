/**
 * 소셜 발행용 순수 함수 — 네트워크·파일 접근 없음. post.mjs가 쓰고 compose.test.ts가 검사한다.
 *
 * 규칙:
 *  - Instagram 캡션에는 링크가 걸리지 않으므로 URL 대신 "링크는 프로필에" 문구를 둔다.
 *  - Threads는 본문 500자 제한. URL은 잘리면 안 되므로 본문 쪽을 먼저 줄인다.
 *  - 해시태그는 frontmatter tags에서 공백·특수문자를 걷어 최대 MAX_HASHTAGS개.
 */
export const SITE = 'https://studionol.co.kr';
export const THREADS_TEXT_LIMIT = 500;
export const IG_CAPTION_LIMIT = 2200;
export const MAX_HASHTAGS = 8;

export function storyUrl(slug) {
  return `${SITE}/ko/stories/${encodeURIComponent(slug)}`;
}

/** "Ableton Live 보컬" → "#AbletonLive보컬". 비면 버린다. 중복 제거. */
export function toHashtags(tags, max = MAX_HASHTAGS) {
  const seen = new Set();
  const out = [];
  for (const raw of tags ?? []) {
    const cleaned = String(raw).replace(/[^\p{L}\p{N}_]/gu, '');
    if (!cleaned || seen.has(cleaned.toLowerCase())) continue;
    seen.add(cleaned.toLowerCase());
    out.push(`#${cleaned}`);
    if (out.length >= max) break;
  }
  return out;
}

function trimTo(text, limit) {
  if (text.length <= limit) return text;
  const cut = text.slice(0, Math.max(0, limit - 1));
  // 단어 중간에서 끊지 않도록 마지막 공백까지 물러난다(너무 짧아지면 그냥 자른다).
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}…`;
}

export function buildInstagramCaption({ title, summary, tags }) {
  const hashtags = toHashtags(tags).join(' ');
  const parts = [title, summary, '전체 글은 프로필 링크에서 볼 수 있습니다.', hashtags]
    .map((s) => (s ?? '').trim())
    .filter(Boolean);
  return trimTo(parts.join('\n\n'), IG_CAPTION_LIMIT);
}

export function buildThreadsText({ title, summary, slug, tags }) {
  const url = storyUrl(slug);
  const hashtags = toHashtags(tags, 3).join(' ');
  const tail = [hashtags, url].filter(Boolean).join('\n');
  const budget = THREADS_TEXT_LIMIT - tail.length - 2; // "\n\n" 구분
  const body = trimTo([title, summary].map((s) => (s ?? '').trim()).filter(Boolean).join('\n\n'), budget);
  return `${body}\n\n${tail}`;
}

/**
 * Instagram은 JPEG만 받는다. 1순위 OG 카드(PNG → post.mjs가 JPEG 변환·업로드), 폴백은
 * 썸네일 원본 .jpg (public/images/*.webp는 원본 .jpg가 함께 있다).
 */
export function ogImageUrl({ slug, title }) {
  const q = new URLSearchParams({ slug, title: (title ?? '').slice(0, 100) });
  return `${SITE}/api/og/story?${q}`;
}

export function fallbackJpegUrl(thumbnail) {
  if (!thumbnail || !thumbnail.startsWith('/')) return null;
  const jpg = thumbnail.replace(/\.(webp|avif|png)$/i, '.jpg');
  return jpg.endsWith('.jpg') ? `${SITE}${jpg}` : null;
}
