import type { NextApiRequest, NextApiResponse } from 'next';

import { FieldCryptoError, FIELD_CRYPTO_KEY_ENV } from '../crypto/fieldCrypto';
import { authenticateAdminApi } from '../contracts/admin-auth';
import { recordAdminPrivacyAccess, type PrivacyAccessResult } from '../privacy/accessLog';
import { holderMatchesCustomer, loadRefundAccount, safeDbErrorSummary, type RefundAccountKey } from './refundAccount';

/**
 * 관리자 **"계좌 보기"** — 계좌 입금 주문의 환불 계좌를 응답으로만 내보내는 GET 핸들러(결제 공용).
 *
 * 펀딩(`pages/api/admin/funding/pledges/[id]/refund-account.ts`)과 공연·예약·믹싱
 * (`pages/api/admin/orders/[id]/refund-account.ts`)이 이 함수 하나를 쓴다. 정산 계좌 조회와 같은 축이다:
 * 관리자 상세의 props(`__NEXT_DATA__`)에는 계좌번호를 싣지 않고, 운영자가 송금하려고 누른 그 순간에만
 * 이 경로로 가져온다. 조회 사실은 성공·실패를 가리지 않고 `privacy_access_logs`에 `refund_account_view`로
 * 남기되(대상은 주문 id) 계좌번호는 적지 않는다. 응답은 no-store.
 *
 * 예금주가 주문자 이름과 다르면 `holderMismatch`로 알린다 — **막지 않는다**(가족 계좌가 흔하다).
 */

const CRYPTO_ERROR_MESSAGE: Record<FieldCryptoError['code'], string> = {
  missing_key: `이 환경에 복호화 키(${FIELD_CRYPTO_KEY_ENV})가 없어요. 값은 그대로 있어요 — 배포 환경 변수에 키를 등록한 뒤 다시 시도해 주세요.`,
  invalid_key: `복호화 키(${FIELD_CRYPTO_KEY_ENV})의 형식이 맞지 않아요. 값은 그대로 있어요 — 환경 변수를 고친 뒤 다시 시도해 주세요.`,
  malformed: '저장된 값이 암호화 형식이 아니에요. 고객에게 환불 계좌를 다시 받아 주세요.',
  unsupported_version: '저장된 값의 암호화 판본을 이 배포가 몰라요. 배포 판본을 확인해 주세요 — 값을 지우거나 덮어쓰지 마세요.',
  key_mismatch: `이 값은 지금 이 배포의 키(${FIELD_CRYPTO_KEY_ENV})가 아니라 다른 키로 저장됐어요. 값은 손상되지 않았어요 — 키 회전이 중간에 멈춘 것이라면 scripts/rotate-field-key.mjs를 이어서 돌리면 열려요.`,
  auth_failed: `복호화에 실패했어요. 키(${FIELD_CRYPTO_KEY_ENV})가 저장 당시와 다르거나 값이 손상됐어요. 고객에게 계좌를 다시 받아야 할 수 있어요.`,
};

/** 주문 id로 환불 계좌의 키와 주문자 이름을 찾는다. 없으면 null. */
export type RefundAccountTargetLoader = (orderId: string) => Promise<{ key: RefundAccountKey; customerName: string } | null>;

export const handleRefundAccountView = async (
  req: NextApiRequest,
  res: NextApiResponse,
  loadTarget: RefundAccountTargetLoader,
  logContext: string,
): Promise<void> => {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false });
  }

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ ok: false, message: '잘못된 요청이에요.' });

  const log = (result: PrivacyAccessResult) =>
    recordAdminPrivacyAccess(req, auth.actor, 'refund_account_view', id, result).catch((error: unknown) => {
      console.error('[privacy] 접속기록 호출 실패 — 조회는 계속됩니다', error);
    });

  try {
    const target = await loadTarget(id);
    if (!target) {
      await log('not_found');
      return res.status(404).json({ ok: false, message: '주문을 찾을 수 없어요.' });
    }
    const account = await loadRefundAccount(target.key);
    if (!account) {
      await log('not_found');
      return res.status(404).json({ ok: false, message: '접수된 환불 계좌가 없어요.' });
    }
    await log('success');
    return res.status(200).json({
      ok: true,
      account,
      holderMismatch: !holderMatchesCustomer(account.accountHolder, target.customerName),
    });
  } catch (error: unknown) {
    if (error instanceof FieldCryptoError) {
      await log('decrypt_failed');
      console.error(`[${logContext}] 환불 계좌 복호화 실패 (orderId=${id}, code=${error.code})`);
      return res.status(500).json({ ok: false, code: error.code, message: CRYPTO_ERROR_MESSAGE[error.code] });
    }
    await log('error');
    console.error(`[${logContext}] 환불 계좌 조회 실패 (orderId=${id}):`, safeDbErrorSummary(error));
    return res.status(500).json({ ok: false, message: '환불 계좌를 읽지 못했어요. 마이그레이션 0048이 적용됐는지 확인해 주세요.' });
  }
};
