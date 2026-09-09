/**
 * 관리자 펀딩 화면에서 공유하는 조작 헬퍼. bookingActions.ts와 같은 얕은 fetch 래퍼 패턴.
 */

export interface FundingActionResult {
  ok: boolean;
  message?: string;
}

const readMessage = async (r: Response, fb: string): Promise<string> => {
  try {
    const result = await r.json();
    return result?.message || fb;
  } catch {
    return fb;
  }
};

export const patchPledge = async (id: string, body: Record<string, unknown>): Promise<FundingActionResult> => {
  try {
    const r = await fetch(`/api/admin/funding/pledges/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    return r.ok ? { ok: true } : { ok: false, message: await readMessage(r, '처리에 실패했습니다.') };
  } catch {
    return { ok: false, message: '네트워크 오류' };
  }
};

export const createManualPledge = async (body: Record<string, unknown>): Promise<FundingActionResult> => {
  try {
    const r = await fetch('/api/admin/funding/pledges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    return r.ok ? { ok: true } : { ok: false, message: await readMessage(r, '등록에 실패했습니다.') };
  } catch {
    return { ok: false, message: '네트워크 오류' };
  }
};
