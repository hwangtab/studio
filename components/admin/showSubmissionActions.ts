/** 주최자 공연 심사 화면(`/admin/shows/submissions/[id]`)의 조작 헬퍼 — pages/api/admin/shows/submissions/[id].ts가 받는 형태. */

export interface ShowSubmissionActionResult {
  ok: boolean;
  slug?: string;
  message?: string;
  warnings?: string[];
}

export type ShowSubmissionPatchBody =
  | { action: 'approve'; slug: string; expectedSubmittedAt: string }
  | { action: 'request_changes' | 'reject'; note: string; expectedSubmittedAt: string }
  | { action: 'set_internal_note'; note?: string };

export const patchShowSubmission = async (
  id: string,
  body: ShowSubmissionPatchBody,
): Promise<ShowSubmissionActionResult> => {
  try {
    const r = await fetch(`/api/admin/shows/submissions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    let result: { slug?: string; message?: string; warnings?: string[] } = {};
    try {
      result = await r.json();
    } catch {
      /* 본문 없는 응답 */
    }
    if (!r.ok) return { ok: false, message: result.message || '처리에 실패했습니다.' };
    return { ok: true, slug: result.slug, ...(result.warnings && result.warnings.length > 0 ? { warnings: result.warnings } : {}) };
  } catch {
    return { ok: false, message: '네트워크 오류' };
  }
};
