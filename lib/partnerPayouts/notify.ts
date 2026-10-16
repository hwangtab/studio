import { eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingCreators, shows } from '../../db/schema';
import { FieldCryptoError } from '../crypto/fieldCrypto';
import { decryptPayoutAccount } from '../funding/payoutAccountCrypto';
import { recordAdminPrivacyAccess } from '../privacy/accessLog';
import { isManualPlaceholderRecipient } from '../privacy/manualPlaceholder';
import {
  payoutNoticeTitle, sendPartnerPayoutNoticeEmail, sendPartnerPayoutOperatorFallback, type PartnerPayoutNoticeEvent,
} from './payoutEmail';
import { getPartnerPayoutById } from './store';

import type { FundingPayoutAccountMasked } from '../funding/payoutAccount';
import type { IpBearingRequest } from '../contracts/client-ip';

/**
 * 상점·공연 정산 알림 메일의 **단일 진입점** (docs/settlement-record-design-2026-10.md §7·§8 P3).
 *
 * 정산 기록(`record`)과 지급 완료(`mark_paid`) 라우트가 DB 반영을 마친 **뒤에** 부른다. 종류(shop/show)를 가리지 않고
 * `partner_payouts` 행의 id만 받으므로 공연(P2) 라우트도 같은 호출 한 줄이면 된다:
 *
 *   const warnings = await sendPartnerPayoutNotice(payoutId, 'recorded', { req, actor: auth.actor });
 *   return res.status(200).json({ ok: true, ...(warnings.length > 0 ? { warnings } : {}) });
 *
 * 돌려주는 `warnings`가 비어 있지 않으면 화면이 "처리는 끝났지만 알림은 못 보냈다"를 보여야 한다(펀딩 `notifyPayout`과 같은 계약).
 * **이 함수는 던지지 않는다** — 기록·지급은 이미 DB에 반영됐고, 여기서 500을 내면 운영자가 같은 버튼을 다시 눌러 409만 받는다.
 *
 * 하는 일: 수취인 이메일을 개설자 행에서 읽고 → 계좌를 열어 **마스킹한 판**(은행명·예금주·뒤 4자리)을 만들고(접속기록
 * `partner_payout_account_email`, 대상은 정산 기록 id, 성공·실패 모두) → 메일을 보낸다. 메일이 실패하면 운영자 폴백 알림을 보낸다.
 * 보내지 않는 경우(모두 warnings로 알린다): 개설자 계정이 없는 정산(상점 파일 갈래), 수기 등록 플레이스홀더 주소, 기록을 못 읽음.
 */

export interface PartnerPayoutNoticeContext {
  /** 접속기록의 IP를 읽을 요청. */
  req: IpBearingRequest;
  /** 가드(`authenticateAdminApi`)가 돌려준 `auth.actor`. */
  actor: string;
}

interface PayeeRow {
  email: string;
  enc: string | null;
  last4: string | null;
  taxType: FundingPayoutAccountMasked['taxType'];
}

const loadPayee = async (creatorId: string): Promise<PayeeRow | null> => {
  const [row] = await getDb()
    .select({
      email: fundingCreators.email, enc: fundingCreators.payoutAccountEnc,
      last4: fundingCreators.payoutAccountLast4, taxType: fundingCreators.taxType,
    })
    .from(fundingCreators)
    .where(eq(fundingCreators.id, creatorId))
    .limit(1);
  return row ? { email: row.email, enc: row.enc?.trim() || null, last4: row.last4?.trim() || null, taxType: row.taxType ?? null } : null;
};

/**
 * 메일에 실을 판. 계좌번호 전체는 여기서 이미 잘려 나간다. 계좌가 없으면 null, 복호화에 실패하면 은행명·예금주만 비운다 —
 * 이미 기록된 정산을 알리는 메일이라 여기서 던지면 수취인이 아무 통지도 못 받는다(`loadFundingPayoutAccountMasked`와 같은 규칙).
 */
const maskedAccountOf = (payee: PayeeRow, creatorId: string): FundingPayoutAccountMasked | null => {
  if (!payee.enc) return null;
  try {
    const fields = decryptPayoutAccount(payee.enc);
    return { bankName: fields.bankName, holder: fields.holder, accountLast4: payee.last4, taxType: payee.taxType };
  } catch (error: unknown) {
    console.error('[partner-payouts] 정산 계좌 복호화 실패 — 메일에는 뒤 4자리만 적습니다', {
      creatorId, code: error instanceof FieldCryptoError ? error.code : 'unknown',
    });
    return { bankName: null, holder: null, accountLast4: payee.last4, taxType: payee.taxType };
  }
};

const loadShowTitle = async (showId: string): Promise<string | null> => {
  try {
    const [row] = await getDb().select({ title: shows.title }).from(shows).where(eq(shows.id, showId)).limit(1);
    return row?.title ?? null;
  } catch {
    return null; // 제목은 꾸밈이다 — 못 읽어도 메일은 나간다.
  }
};

export const sendPartnerPayoutNotice = async (
  payoutId: string,
  event: PartnerPayoutNoticeEvent,
  ctx: PartnerPayoutNoticeContext,
): Promise<string[]> => {
  const what = event === 'recorded' ? '정산 기록' : '정산 지급';
  const warnings: string[] = [];
  try {
    // 지급 완료 직후의 메모·시각까지 정본에서 다시 읽는다 — 호출부가 상태를 따로 조립하다 어긋나지 않게.
    const payout = await getPartnerPayoutById(payoutId);
    if (!payout) {
      warnings.push('정산 기록을 다시 읽지 못해 알림 메일을 보내지 못했습니다. 수취인에게 직접 알려 주세요.');
      return warnings;
    }
    if (!payout.creatorId) {
      warnings.push(`${payout.payeeName}은(는) 계정이 없는 수취인이라 알림 메일을 보내지 않았습니다. 직접 알려 주세요.`);
      return warnings;
    }
    const payee = await loadPayee(payout.creatorId);
    if (!payee) {
      warnings.push('수취인 계정을 다시 읽지 못해 알림 메일을 보내지 못했습니다. 직접 알려 주세요.');
      return warnings;
    }
    if (isManualPlaceholderRecipient({ customerEmail: payee.email })) {
      // 반송되는 주소로 보내면 발신 도메인 평판만 깎인다.
      warnings.push('수취인 이메일이 수기 등록용 주소라 알림 메일을 보내지 않았습니다. 직접 알려 주세요.');
      return warnings;
    }

    const account = maskedAccountOf(payee, payout.creatorId);
    /**
     * **이 복호화만 값이 서버 밖으로 나간다** — 메일 본문에 은행명과 예금주가 실린다(펀딩 `funding_payout_account_email`과 같은 무게).
     * 결과는 반환값에서 갈린다: 계좌가 아예 없으면 not_found, 있는데 은행명이 비어 있으면 복호화가 실패한 것이다.
     */
    await recordAdminPrivacyAccess(
      ctx.req, ctx.actor, 'partner_payout_account_email', payoutId,
      account === null ? 'not_found' : account.bankName === null ? 'decrypt_failed' : 'success',
    ).catch((error: unknown) => {
      // 기록 실패가 알림을 막지 않는다 — 정산은 이미 DB에 반영됐다.
      console.error('[privacy] 접속기록 호출 실패 — 정산 알림은 계속됩니다', error);
    });

    const title = payoutNoticeTitle(payout, payout.kind === 'show' ? await loadShowTitle(payout.subjectKey) : null);
    const mailError = await sendPartnerPayoutNoticeEmail(payee.email, event, title, payout, account);
    if (mailError) {
      warnings.push(`수취인 알림 메일을 보내지 못했습니다(${mailError}). 직접 알려 주세요.`);
      const fallbackError = await sendPartnerPayoutOperatorFallback(payout, title, what, payee.email, mailError);
      if (fallbackError) {
        console.error(`[partner-payouts] 운영자 폴백 알림도 실패 (id=${payoutId}, ${what}):`, fallbackError);
        warnings.push(`운영자 폴백 알림도 실패했습니다: ${fallbackError}`);
      }
    }
  } catch (error: unknown) {
    console.error(`[partner-payouts] ${what} 후 알림 처리 실패 (id=${payoutId}):`, error);
    warnings.push('처리는 끝났지만 알림 메일 단계에서 오류가 났습니다. 수취인에게 직접 알려 주세요.');
  }
  return warnings;
};
