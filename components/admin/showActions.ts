/**
 * 관리자 공연 화면의 조작 헬퍼 — fundingActions.ts와 같은 얕은 fetch 래퍼.
 * 서버 응답의 추가 필드(path·failedOrders 등)는 `data`로 그대로 돌려준다.
 */

export interface ShowActionResult {
  ok: boolean;
  message?: string;
  data?: Record<string, unknown>;
}

export const postShowAction = async (showId: string, body: Record<string, unknown>): Promise<ShowActionResult> => {
  try {
    const r = await fetch(`/api/admin/shows/${encodeURIComponent(showId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    let json: Record<string, unknown> = {};
    try {
      json = await r.json();
    } catch {
      /* 본문이 JSON이 아니면 기본 문구 */
    }
    const message = typeof json.message === 'string' ? json.message : undefined;
    return r.ok ? { ok: true, data: json } : { ok: false, message: message ?? '처리에 실패했습니다.' };
  } catch {
    return { ok: false, message: '네트워크 오류' };
  }
};
