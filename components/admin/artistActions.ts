/**
 * 관리자 아티스트 화면의 fetch 래퍼. subscriptionActions.ts와 같은 얕은 패턴.
 */
export interface ArtistActionResult {
  ok: boolean;
  message?: string;
}

const post = async (url: string, body: unknown): Promise<ArtistActionResult> => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.ok) return { ok: false, message: result?.message || '요청을 처리하지 못했습니다.' };
    return { ok: true };
  } catch {
    return { ok: false, message: '네트워크 오류가 발생했습니다.' };
  }
};

/** 미리보기 숫자를 정산 기록으로 고정한다(pending). */
export const recordPayout = (artistSlug: string, period: string): Promise<ArtistActionResult> =>
  post('/api/admin/artists/payouts', { artistSlug, period });

/** 이체를 마친 뒤 지급 완료로 올린다. */
export const markPayoutPaid = (id: string, memo: string): Promise<ArtistActionResult> =>
  post(`/api/admin/artists/payouts/${encodeURIComponent(id)}`, { action: 'mark_paid', memo });
