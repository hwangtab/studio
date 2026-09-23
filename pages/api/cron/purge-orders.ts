/**
 * 주문·구독에 남은 고객 개인정보를 보관 기간에 따라 파기한다.
 *
 * 개인정보 보호법 제21조①은 개인정보가 불필요하게 되었을 때 지체 없이 파기하라고 한다.
 * `orders`·`subscriptions`에는 그 경로가 없어 전 주문유형의 이름·연락처가 기한 없이
 * 남아 있었다. 사람이 기억해서 지우는 방식이면 지켜지지 않으므로 Vercel Cron이 월 1회
 * 호출한다 — 매월 3일 18시(purge-contracts 1일, purge-funding 2일과 겹치지 않게).
 *
 * 판정(무엇을 법정 기록으로 보고 무엇을 아니라고 봤는지)은 `lib/privacy/orderRetention.ts`의
 * 각 함수 주석에 있다. 기준이 다섯 가지로 갈려 있으므로 여기서 요약하지 않는다 —
 * 두 곳에 적으면 한쪽이 먼저 낡는다.
 *
 * **후원 배송지·주민등록번호·접속기록 파기(`/api/cron/purge-funding`)와 섞지 않는다.**
 * 대상도 기산점도 기간도 다르고, 한 라우트에 몰면 어느 한쪽 표가 없다는 이유로 나머지가
 * 통째로 멈춘다.
 *
 * 인증: Vercel Cron이 Authorization: Bearer ${CRON_SECRET} 헤더를 붙인다.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

import { isCronAuthorized } from '../../../lib/cron/auth';
import { sendEmail } from '../../../lib/email/resend';
import { OPERATOR_EMAIL } from '../../../lib/operatorContact';
import {
  DISPUTE_RETENTION_YEARS,
  ORDER_LEGAL_RETENTION_YEARS,
  PAYMENT_FAIL_MESSAGE_RETENTION_YEARS,
  purgeEndedSubscriptionDisplayNames,
  purgeExpiredOrderCustomerData,
  purgeExpiredPaymentFailMessages,
  purgeExpiredSubscriptionCancelReasons,
  purgeExpiredSubscriptionCustomerData,
} from '../../../lib/privacy/orderRetention';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (!isCronAuthorized(req, 'cron/purge-orders')) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  /**
   * 다섯 파기는 **서로의 실패에 걸리지 않는다**(purge-funding과 같은 구조).
   *
   * 한 try에 나란히 세우면 앞의 것이 던졌을 때 뒤의 것이 그달에 아예 실행되지 않는다.
   * 다섯은 대상도 기산점도 기간도 다른 별개의 파기이고 전부 멱등이라, 실패한 것은 다음 달
   * 실행에서 다시 시도된다.
   */
  const failures: { label: string; detail: string }[] = [];

  const run = async <T>(label: string, task: () => Promise<T>): Promise<T | null> => {
    try {
      return await task();
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`[cron/purge-orders] ${label} 실패:`, error);
      failures.push({ label, detail });
      return null;
    }
  };

  // 각각 UPDATE...WHERE 한 번뿐이라 외부 API 호출이 없고 부분 실패라는 상태가 없다
  // (하나하나는 전부 성공하거나 던진다) — purge-funding과 같은 이유로 failed 분기가 없다.
  const orderCustomers = await run(
    `법정 보존 ${ORDER_LEGAL_RETENTION_YEARS}년이 지난 주문의 고객 이름·연락처 파기`,
    purgeExpiredOrderCustomerData,
  );
  const failMessages = await run(
    `결제 실패 후 ${PAYMENT_FAIL_MESSAGE_RETENTION_YEARS}년이 지난 결제사 실패 사유 원문 파기`,
    purgeExpiredPaymentFailMessages,
  );
  const subscriptionCustomers = await run(
    `구독 종료 후 ${ORDER_LEGAL_RETENTION_YEARS}년이 지난 구독의 고객 이름·연락처 파기`,
    purgeExpiredSubscriptionCustomerData,
  );
  const displayNames = await run(
    '종료된 구독의 후원자 명단 표시 이름 파기',
    purgeEndedSubscriptionDisplayNames,
  );
  const cancelReasons = await run(
    `해지 후 ${DISPUTE_RETENTION_YEARS}년이 지난 구독 해지 사유 파기`,
    purgeExpiredSubscriptionCancelReasons,
  );

  // 성공한 것은 건수를, 실패한 것은 null을 싣는다 — "0건 파기"와 "돌지 못함"은 다른 상태다.
  const body = {
    purgedOrderCustomers: orderCustomers ? orderCustomers.purged : null,
    purgedPaymentFailMessages: failMessages ? failMessages.purged : null,
    purgedSubscriptionCustomers: subscriptionCustomers ? subscriptionCustomers.purged : null,
    purgedSubscriptionDisplayNames: displayNames ? displayNames.purged : null,
    purgedSubscriptionCancelReasons: cancelReasons ? cancelReasons.purged : null,
  };

  if (failures.length > 0) {
    await sendEmail({
      to: OPERATOR_EMAIL,
      subject: `[Studio NOL] 주문·구독 개인정보 파기 실패 (${failures.length}건)`,
      text:
        `아래 파기 작업이 실패했습니다.\n\n${failures
          .map(({ label, detail }) => `· ${label}\n  사유: ${detail}`)
          .join('\n\n')}\n\n` +
        '개인정보 보호법 제21조①이 요구하는 파기이므로 확인이 필요합니다. ' +
        '표나 컬럼이 없다는 사유라면 운영 DB에 마이그레이션이 적용됐는지 먼저 확인해 주세요.',
    }).catch(() => {});

    return res.status(500).json({ ok: false, message: '개인정보 파기 작업에 실패했습니다.', ...body });
  }

  return res.status(200).json({ ok: true, ...body });
}
