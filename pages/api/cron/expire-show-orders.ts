/**
 * 공연 티켓 주문 만료 정리 — 보류 시간과 30분 유예가 지난 pending 주문을 expired로 돌리고
 * held 티켓을 void로 바꾼다(lib/shows/service.ts `expireStaleShowOrders`).
 *
 * 좌석 점유 판정은 시각 조건(lib/shows/conditions.ts)이 하므로 이 크론이 늦어도 재고는
 * 풀려 있다 — 이 크론은 상태 정리다. 그래도 멈추면 운영자가 알아야 한다.
 *
 * 인증: Vercel Cron이 Authorization: Bearer ${CRON_SECRET} 헤더를 붙인다.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

import { isCronAuthorized } from '../../../lib/cron/auth';
import { buildOperatorAlertHtml } from '../../../lib/email/operatorAlert';
import { sendEmail } from '../../../lib/email/resend';
import { OPERATOR_EMAIL } from '../../../lib/operatorContact';
import { expireStaleShowOrders } from '../../../lib/shows/service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (!isCronAuthorized(req, 'cron/expire-show-orders')) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  try {
    const expired = await expireStaleShowOrders(new Date());
    console.log(`[cron/expire-show-orders] expired=${expired}`);
    return res.status(200).json({ ok: true, expired });
  } catch (error: unknown) {
    console.error('[cron/expire-show-orders] 실패:', error);
    const message = error instanceof Error ? error.message : String(error);
    const alert = await sendEmail({
      to: OPERATOR_EMAIL,
      subject: '[스튜디오 놀] 공연 주문 만료 정리 크론 실패',
      text: [
        '결제하지 않은 공연 티켓 주문을 만료 처리하는 크론이 실패했습니다.',
        `오류: ${message}`,
        '',
        '재고는 시각 조건으로 풀려 있어 판매에는 영향이 없고, 다음 실행에서 다시 정리됩니다.',
        'shows 테이블이 없다는 오류면 마이그레이션 0045 적용 여부부터 보세요.',
      ].join('\n'),
      html: buildOperatorAlertHtml({
        title: '공연 주문 만료 정리 크론이 실패했습니다',
        cron: 'cron/expire-show-orders',
        summary: '결제하지 않은 공연 티켓 주문을 만료 처리하는 크론이 실패했습니다.',
        reason: message,
        hints: [
          '재고는 시각 조건으로 풀려 있어 판매에는 영향이 없고, 다음 실행에서 다시 정리됩니다.',
          'shows 테이블이 없다는 오류면 마이그레이션 0045 적용 여부부터 보세요.',
        ],
      }),
    }).catch(() => ({ ok: false }));
    if (!alert.ok) console.error('[cron/expire-show-orders] 운영자 알림도 실패');
    return res.status(500).json({ ok: false, message });
  }
}
