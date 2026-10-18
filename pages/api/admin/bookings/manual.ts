import { safeDbErrorSummary } from '../../../../lib/payments/refundAccount';
import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { createManualBooking, parseManualBookingInput } from '../../../../lib/booking/manualEntry';

/**
 * 수기 예약 등록(카톡·전화로 받은 예약·믹싱 주문). 규칙은 lib/booking/manualEntry.ts.
 * 고객 연락처를 받아 저장하는 쓰기 경로라 관리자 세션 필수.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  const now = new Date();
  const parsed = parseManualBookingInput(req.body, now);
  if (!parsed.ok) return res.status(400).json({ ok: false, message: parsed.message });

  // 캘린더에만 있던 일정을 가져올 때의 일정 id(구글 일정 id는 소문자·숫자·밑줄, 반복 일정의 한 회차는 `_20261020T050000Z`처럼 대문자가 끼는 id). 모양이 틀리면 무시한다.
  const rawAdopt = (req.body as Record<string, unknown> | null)?.adoptEventId;
  const adoptEventId = typeof rawAdopt === 'string' && /^[A-Za-z0-9_]{5,1024}$/.test(rawAdopt) ? rawAdopt : null;

  try {
    const result = await createManualBooking(parsed.value, now, { adoptEventId });
    if (!result.ok) return res.status(409).json({ ok: false, message: result.message });
    return res.status(201).json({ ok: true, orderId: result.orderId, orderNo: result.orderNo, status: result.status, warnings: result.warnings });
  } catch (error: unknown) {
    // drizzle 오류 메시지에는 바인딩된 값(고객 이름·연락처·메모)이 실린다 — 이름과 코드만 남긴다.
    console.error('[API/admin/bookings/manual] 실패:', safeDbErrorSummary(error));
    return res.status(500).json({ ok: false, message: '등록하지 못했습니다. 예약 목록에 반쯤 만들어진 주문이 없는지 확인해 주세요.' });
  }
}
