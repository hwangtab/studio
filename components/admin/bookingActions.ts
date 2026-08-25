/**
 * 관리자 예약 화면에서 공유하는 조작 헬퍼.
 * contractActions.ts와 같은 얕은 fetch 래퍼 패턴 — 목록·상세 양쪽에서 재사용한다.
 */

export interface BookingActionResult {
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

/** id는 예약(주문) id — /admin/bookings/[id]와 동일한 값. */
export const setBookingStatus = async (
  id: string,
  status: 'completed' | 'no_show',
): Promise<BookingActionResult> => {
  try {
    const response = await fetch(`/api/admin/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      return { ok: false, message: await readMessage(response, '상태를 변경하지 못했습니다.') };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: '네트워크 오류가 발생했습니다.' };
  }
};

export const refundBooking = async (
  id: string,
  amount: number,
  reason: string,
): Promise<BookingActionResult & { refundAmount?: number }> => {
  try {
    const response = await fetch(`/api/admin/bookings/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action: 'refund', amount, reason }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.ok) {
      return { ok: false, message: result?.message || '환불 처리에 실패했습니다.' };
    }
    return { ok: true, refundAmount: result.refundAmount };
  } catch {
    return { ok: false, message: '네트워크 오류가 발생했습니다.' };
  }
};

export const resendBookingNotification = async (id: string): Promise<BookingActionResult> => {
  try {
    const response = await fetch(`/api/admin/bookings/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action: 'resend-notification' }),
    });
    if (!response.ok) {
      return { ok: false, message: await readMessage(response, '재발송에 실패했습니다.') };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: '네트워크 오류가 발생했습니다.' };
  }
};

export interface CreateBlockPayload {
  date: string;
  startHour: number;
  endHour: number;
  memo?: string;
}

export const createBlock = async (payload: CreateBlockPayload): Promise<BookingActionResult> => {
  try {
    const response = await fetch('/api/admin/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      return { ok: false, message: await readMessage(response, '블록 등록에 실패했습니다.') };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: '네트워크 오류가 발생했습니다.' };
  }
};

export const deleteBlock = async (id: string): Promise<BookingActionResult> => {
  try {
    const response = await fetch(`/api/admin/blocks/${id}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    if (!response.ok) {
      return { ok: false, message: await readMessage(response, '블록 삭제에 실패했습니다.') };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: '네트워크 오류가 발생했습니다.' };
  }
};
