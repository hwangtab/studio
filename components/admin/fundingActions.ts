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
    // 성공 응답에도 안내가 실릴 수 있다(예: 입금은 확인됐는데 확정 메일이 실패한 경우) — 그대로 넘긴다.
    if (r.ok) {
      const message = await readMessage(r, '');
      return message ? { ok: true, message } : { ok: true };
    }
    return { ok: false, message: await readMessage(r, '처리에 실패했습니다.') };
  } catch {
    return { ok: false, message: '네트워크 오류' };
  }
};

export interface RefundAccountView {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

/**
 * 계좌 입금 후원자가 적은 환불 계좌를 **눌렀을 때만** 가져온다 — 값은 화면 state에만 머문다
 * (props에 싣지 않는다). 조회 사실은 서버가 접속기록에 남긴다.
 */
export const fetchRefundAccount = async (
  id: string,
): Promise<{ ok: true; account: RefundAccountView; holderMismatch: boolean } | { ok: false; message: string }> => {
  try {
    const r = await fetch(`/api/admin/funding/pledges/${id}/refund-account`, { credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok) return { ok: false, message: await readMessage(r, '환불 계좌를 불러오지 못했습니다.') };
    const json = await r.json();
    return { ok: true, account: json.account, holderMismatch: Boolean(json.holderMismatch) };
  } catch {
    return { ok: false, message: '네트워크 오류' };
  }
};

/** 수기 등록이 막힌 이유가 "같은 이름의 계좌 입금 신청이 있다"일 때 함께 오는 후보. */
export interface ExistingDepositCandidate {
  id: string; orderNo: string; status: string; projectSlug: string; totalAmount: number; createdAt: string;
}

export const createManualPledge = async (
  body: Record<string, unknown>,
): Promise<FundingActionResult & { candidates?: ExistingDepositCandidate[] }> => {
  try {
    const r = await fetch('/api/admin/funding/pledges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    if (r.ok) return { ok: true };
    let json: { message?: string; candidates?: ExistingDepositCandidate[] } = {};
    try { json = await r.json(); } catch { /* 본문 없음 */ }
    return {
      ok: false,
      message: json.message || '등록에 실패했습니다.',
      ...(Array.isArray(json.candidates) ? { candidates: json.candidates } : {}),
    };
  } catch {
    return { ok: false, message: '네트워크 오류' };
  }
};
