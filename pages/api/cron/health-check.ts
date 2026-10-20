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

import { autoImportCalendarEvents } from '../../../lib/booking/calendarAutoImport';
import { waitUntil } from '@vercel/functions';

import { isCronAuthorized } from '../../../lib/cron/auth';
import { rollRenewedTenancyCalendars } from '../../../lib/tenancy/calendar';
import { sendEmail } from '../../../lib/email/resend';
import { OPERATOR_EMAIL } from '../../../lib/operatorContact';
import { buildOperatorAlertHtml } from '../../../lib/email/operatorAlert';
import { buildHealthReportHtml, formatHealthReport, runHealthCheck } from '../../../lib/ops/healthCheck';

export const config = { maxDuration: 60 };

const IMPORT_BUDGET_MS = 15_000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (!isCronAuthorized(req, 'cron/health-check')) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  try {
    // 캘린더에 손으로 넣은 일정을 사이트에 자동 등록한다(대시보드를 안 연 날도). 실패해도 점검은 계속한다.
    // **시간 예산**을 둔다 — 구글이 느려지면 자동 등록이 60초(maxDuration)를 다 써서 운영 점검 메일과 실패 알림이 통째로 안 나갈 수 있다(감사 2026-10-18).
    // 예산을 넘긴 등록은 응답 뒤에도 끝까지 돌게 waitUntil에 맡긴다.
    const importing = autoImportCalendarEvents().catch((error: unknown) => console.error('[cron/health-check] 캘린더 자동 등록 실패', error instanceof Error ? error.name : 'unknown'));
    try {
      waitUntil(importing);
    } catch {
      // 요청 컨텍스트 밖(테스트)에서는 등록하지 않는다.
    }
    await Promise.race([importing, new Promise<void>((resolve) => { setTimeout(resolve, IMPORT_BUDGET_MS).unref?.(); })]);

    // 월 입주 자동 갱신(계약서 제3조①)으로 현재 기간 종료일이 바뀐 입주자의 캘린더 종료 일정을 옮긴다. 실패는 gcal_error로 남아 아래 점검이 알린다.
    // 자동 등록과 같은 이유로 시간 예산을 둔다 — 구글이 느리면 이 단계가 운영 점검 메일을 막는다. 넘긴 일은 waitUntil이 끝까지 돌린다.
    const rolling = rollRenewedTenancyCalendars().catch((error: unknown) => console.error('[cron/health-check] 월 입주 갱신 일정 이동 실패', error instanceof Error ? error.name : 'unknown'));
    try {
      waitUntil(rolling);
    } catch {
      // 요청 컨텍스트 밖(테스트)에서는 기다리지 않아도 된다.
    }
    await Promise.race([rolling, new Promise<void>((resolve) => { setTimeout(resolve, IMPORT_BUDGET_MS).unref?.(); })]);

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
      html: buildHealthReportHtml(report),
    });

    return res.status(200).json({ ok: true, issues: report.issues.length });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[cron/health-check] Failed:', error);

    /**
     * 점검 자체가 죽으면 "이상 없음"과 구분되지 않는다 — 조용한 실패를 잡으려고 만든
     * 것이 조용히 실패하는 셈이라, 이 실패도 반드시 알린다(backup-contracts와 같은 판단).
     */
    const alert = await sendEmail({
      to: OPERATOR_EMAIL,
      subject: '[Studio NOL] 운영 점검 실패',
      text:
        '운영 점검이 실행되지 못했습니다. 이상이 없어서 조용한 것이 아니라, 확인 자체를 못 한 상태입니다.\n\n' +
        `사유: ${detail}\n\n` +
        '반복되면 Turso 연결과 크론 설정을 확인해 주세요.',
      html: buildOperatorAlertHtml({
        title: '운영 점검이 실행되지 못했습니다',
        cron: 'cron/health-check',
        summary: '이상이 없어서 조용한 것이 아니라, 확인 자체를 못 한 상태입니다.',
        reason: detail,
        hints: ['반복되면 Turso 연결과 크론 설정을 확인해 주세요.'],
      }),
    }).catch((e: unknown): { ok: boolean; errorCode?: string } => ({ ok: false, errorCode: String(e) }));
    // 알림이 안 나간 사실을 삼키면 점검 실패가 조용히 묻힌다 — 응답은 그대로 두고 로그만 남긴다.
    if (!alert.ok) console.error('[cron/health-check] 운영자 실패 알림 발송 실패', alert.errorCode);

    return res.status(500).json({ ok: false, message: '점검에 실패했습니다.' });
  }
}
