import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../lib/contact/origin';
import { recordPaymentFailure } from '../../../lib/payments/recordFailure';

/**
 * 결제 실패 사유를 주문에 남기는 **유일한 입구**.
 *
 * 두 경우가 여기로 온다.
 * 1. `requestPayment`가 리다이렉트 **전에** 던진 경우 — 실패 화면 자체를 안 탄다.
 *    예전에는 세 위자드의 catch가 화면에 문구만 띄우고 사유를 버렸다.
 * 2. 토스가 `failUrl`로 되돌려 보낸 경우 — 실패 화면이 마운트된 뒤 이 비콘을 쏜다
 *    (`useReportPaymentFailureOnMount`). 예전에는 그 화면의 getServerSideProps가 직접
 *    기록했는데, 인증도 Origin 검사도 없는 GET이라 남의 주문번호를 넣은 링크 한 번으로
 *    (링크 프리뷰 봇 포함) 그 주문의 실패 사유가 덮였다. 그래서 검사가 있는 이쪽으로
 *    모았다 — 봇·프리뷰는 자바스크립트를 안 돌려 기록하지 못한다.
 *
 * 항상 204로 답한다. 결제자 화면은 이 응답을 기다리지 않고(fire-and-forget), 우리가
 * 무엇을 기록했는지 알려 줄 이유도 없다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }
  // 우리 화면에서만 받는다 — 주문번호를 넣어 보며 남의 주문 상태를 떠보는 경로를 막는다.
  if (!isAllowedContactRequestOrigin(req)) return res.status(204).end();

  const body = req.body as { orderNo?: unknown; code?: unknown; message?: unknown } | undefined;
  const orderNo = typeof body?.orderNo === 'string' ? body.orderNo.toUpperCase() : '';
  const code = typeof body?.code === 'string' ? body.code : null;
  const message = typeof body?.message === 'string' ? body.message : null;

  // 분당 20회. 실패를 여러 번 겪는 사람이 막히면 안 되지만(재시도가 정상 행동이다),
  // 훑기는 막아야 한다.
  const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown';
  const allowed = await consumeRateLimit(`payfail:${ip}`, 20, 60).catch(() => true);
  if (!allowed) return res.status(204).end();

  await recordPaymentFailure({ orderNo, code, message });
  return res.status(204).end();
}
