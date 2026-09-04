/**
 * 조용히 실패한 것들을 하루 한 번 훑어 운영자에게 알린다.
 *
 * 이 저장소는 후속 실패를 삼키되 기록하는 원칙을 지켜 왔다(결제·서명은 이미 끝났으므로).
 * 기록은 잘 되고 있었는데 읽는 사람이 없었다 — 배너는 관리자가 그 화면을 열 때만 보이고,
 * Vercel 런타임 로그는 24시간만 남아 드문 이벤트의 실패는 창을 놓치면 확인할 수 없다.
 *
 * 인증: Vercel Cron이 Authorization: Bearer ${CRON_SECRET} 헤더를 붙인다.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

import { isCronAuthorized } from '../../../lib/cron/auth';
import { sendEmail } from '../../../lib/email/resend';
import { OPERATOR_EMAIL } from '../../../lib/operatorContact';
import { formatHealthReport, runHealthCheck } from '../../../lib/ops/healthCheck';

export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (!isCronAuthorized(req, 'cron/health-check')) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  try {
    const report = await runHealthCheck();

    // 이상이 없으면 아무것도 보내지 않는다. 매일 "정상입니다"를 보내면 사람이 곧 안 읽게
    // 되고, 정작 문제가 생긴 날의 메일도 함께 묻힌다.
    if (report.issues.length === 0) {
      return res.status(200).json({ ok: true, issues: 0 });
    }

    const highCount = report.issues.filter((issue) => issue.severity === 'high').length;
    await sendEmail({
      to: OPERATOR_EMAIL,
      subject: `[Studio NOL] 운영 점검 — 처리 필요 ${report.issues.length}건${highCount > 0 ? ` (긴급 ${highCount})` : ''}`,
      text: formatHealthReport(report),
    });

    return res.status(200).json({ ok: true, issues: report.issues.length });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[cron/health-check] Failed:', error);

    /**
     * 점검 자체가 죽으면 "이상 없음"과 구분되지 않는다 — 조용한 실패를 잡으려고 만든
     * 것이 조용히 실패하는 셈이라, 이 실패도 반드시 알린다(backup-contracts와 같은 판단).
     */
    await sendEmail({
      to: OPERATOR_EMAIL,
      subject: '[Studio NOL] 운영 점검 실패',
      text:
        '운영 점검이 실행되지 못했습니다. 이상이 없어서 조용한 것이 아니라, 확인 자체를 못 한 상태입니다.\n\n' +
        `사유: ${detail}\n\n` +
        '반복되면 Turso 연결과 크론 설정을 확인해 주세요.',
    }).catch(() => {});

    return res.status(500).json({ ok: false, message: '점검에 실패했습니다.' });
  }
}
