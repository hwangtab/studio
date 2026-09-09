/**
 * 관리자 구독 화면에서 공유하는 fetch 헬퍼. bookingActions.ts와 같은 얕은 래퍼 패턴.
 */

export interface SubscriptionActionResult {
  ok: boolean;
  message?: string;
}

const readMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const result = await response.json();
    return result?.message || fallback;
  } catch {
    return fallback;
  }
};

export interface CreateSubscriptionPayload {
  kind: 'practice-room' | 'lesson';
  contractId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  billingDay: number;
}

export const createSubscription = async (
  payload: CreateSubscriptionPayload,
): Promise<SubscriptionActionResult & { id?: string; setupUrl?: string }> => {
  try {
    const response = await fetch('/api/admin/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.ok) {
      return { ok: false, message: result?.message || '구독 생성에 실패했습니다.' };
    }
    return { ok: true, id: result.id, setupUrl: result.setupUrl };
  } catch {
    return { ok: false, message: '네트워크 오류가 발생했습니다.' };
  }
};

export type SubscriptionMutation = 'charge' | 'cancel' | 'pause' | 'resume' | 'card_change_link' | 'resend_setup';

export const mutateSubscription = async (
  id: string,
  action: SubscriptionMutation,
  payload?: { reason?: string },
): Promise<SubscriptionActionResult & { url?: string }> => {
  try {
    const response = await fetch(`/api/admin/subscriptions/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action, ...payload }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.ok) {
      return { ok: false, message: result?.message || readMessageFallback(action) };
    }
    return { ok: true, url: result.url };
  } catch {
    return { ok: false, message: '네트워크 오류가 발생했습니다.' };
  }
};

const readMessageFallback = (action: SubscriptionMutation): string => {
  switch (action) {
    case 'charge':
      return '수동 결제에 실패했습니다.';
    case 'cancel':
      return '해지 처리에 실패했습니다.';
    case 'pause':
      return '일시정지에 실패했습니다.';
    case 'resume':
      return '재개에 실패했습니다.';
    case 'card_change_link':
      return '카드 변경 링크 발급에 실패했습니다.';
    case 'resend_setup':
      return '등록 링크 재발송에 실패했습니다.';
    default:
      return '요청을 처리하지 못했습니다.';
  }
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export { readMessage };
