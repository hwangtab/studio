import type { ShowSubmissionDraft } from '../../../lib/shows/organizer/draft';

/**
 * 주최자 공연 화면이 부르는 API(`pages/api/funding/creator/shows*`)를 한 곳에 모은다.
 * 응답은 `{ ok: true, ... }` 또는 `{ ok: false, message, problems? }` 한 벌이다
 * (`lib/shows/organizer/http.ts`의 respondWrite). 실패 메시지는 서버가 준 한국어를 그대로 쓴다 —
 * 펀딩 개설자 `components/funding/creator/api.ts`와 같은 규칙.
 */
export type ShowApiResult<T = Record<string, never>> =
  | ({ ok: true; warnings?: string[] } & T)
  | { ok: false; message: string; problems?: string[] };

const FALLBACK_MESSAGE = '연결에 실패했어요. 잠시 후 다시 시도해 주세요.';

async function send<T = Record<string, never>>(url: string, method: 'POST' | 'PUT', body: unknown): Promise<ShowApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok !== true) {
      return {
        ok: false,
        message: (data && typeof data.message === 'string' && data.message) || FALLBACK_MESSAGE,
        ...(data && Array.isArray(data.problems) ? { problems: data.problems.filter((p: unknown) => typeof p === 'string') } : {}),
      };
    }
    return data as ShowApiResult<T>;
  } catch {
    return { ok: false, message: FALLBACK_MESSAGE };
  }
}

const base = (id: string) => `/api/funding/creator/shows/${encodeURIComponent(id)}`;

export const createShowSubmission = () => send<{ id: string }>('/api/funding/creator/shows', 'POST', {});

export const saveShowDraft = (id: string, draft: ShowSubmissionDraft) => send(base(id), 'PUT', draft);

export const submitShowSubmission = (id: string, agreedTerms: boolean) => send(`${base(id)}/submit`, 'POST', { agreedTerms });

export const withdrawShowSubmission = (id: string) => send(`${base(id)}/withdraw`, 'POST', {});

/** ImageUploadField의 `uploadUrl` — 원문 바이트를 그대로 받는 라우트다. */
export const showUploadUrl = (id: string, kind: 'poster' | 'photo') => `${base(id)}/upload?kind=${kind}`;
