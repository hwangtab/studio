import type { NextApiRequest, NextApiResponse } from 'next';

import { FieldCryptoError, FIELD_CRYPTO_KEY_ENV } from '../../../../../../lib/crypto/fieldCrypto';
import { authenticateAdminApi } from '../../../../../../lib/contracts/admin-auth';
import { holderMatchesCustomer, loadRefundAccount, safeDbErrorSummary } from '../../../../../../lib/payments/refundAccount';
import { findFundingOrderById } from '../../../../../../lib/funding/service';
import { recordAdminPrivacyAccess, type PrivacyAccessResult } from '../../../../../../lib/privacy/accessLog';

/**
 * GET — 계좌 입금 후원자가 적은 **환불 계좌**를 응답으로만 내보낸다(마이그레이션 0048).
 *
 * 정산 계좌 조회(`pages/api/admin/funding/projects/[id]/payout-account.ts`)와 같은 축이다:
 * 관리자 후원 상세의 props(`__NEXT_DATA__`)에 계좌번호를 싣지 않고, 운영자가 송금하려고 "계좌 보기"를
 * 누른 그 순간에만 이 경로로 가져온다. 조회 사실은 성공·실패를 가리지 않고 `privacy_access_logs`에
 * 남기되(`funding_refund_account_view`) 계좌번호는 적지 않는다.
 *
 * 예금주가 후원자 이름과 다르면 `holderMismatch`로 알린다 — **막지 않는다**(가족 계좌가 흔하다).
 */

const CRYPTO_ERROR_MESSAGE: Record<FieldCryptoError['code'], string> = {
  missing_key: `이 환경에 복호화 키(${FIELD_CRYPTO_KEY_ENV})가 없습니다. 값은 그대로 있습니다 — 배포 환경 변수에 키를 등록한 뒤 다시 시도해 주세요.`,
  invalid_key: `복호화 키(${FIELD_CRYPTO_KEY_ENV})의 형식이 맞지 않습니다. 값은 그대로 있습니다 — 환경 변수를 고친 뒤 다시 시도해 주세요.`,
  malformed: '저장된 값이 암호화 형식이 아닙니다. 후원자에게 환불 계좌를 다시 받아 주세요.',
  unsupported_version: '저장된 값의 암호화 판본을 이 배포가 모릅니다. 배포 판본을 확인해 주세요 — 값을 지우거나 덮어쓰지 마세요.',
  key_mismatch: `이 값은 지금 이 배포의 키(${FIELD_CRYPTO_KEY_ENV})가 아니라 다른 키로 저장됐습니다. 값은 손상되지 않았습니다 — 키 회전이 중간에 멈춘 것이라면 scripts/rotate-field-key.mjs를 이어서 돌리면 열립니다.`,
  auth_failed: `복호화에 실패했습니다. 키(${FIELD_CRYPTO_KEY_ENV})가 저장 당시와 다르거나 값이 손상됐습니다. 후원자에게 계좌를 다시 받아야 할 수 있습니다.`,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false });
  }

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ ok: false, message: '잘못된 요청입니다.' });

  const log = (result: PrivacyAccessResult) =>
    recordAdminPrivacyAccess(req, auth.actor, 'funding_refund_account_view', id, result).catch((error: unknown) => {
      console.error('[privacy] 접속기록 호출 실패 — 조회는 계속됩니다', error);
    });

  try {
    const order = await findFundingOrderById(id);
    if (!order?.fundingPledge) {
      await log('not_found');
      return res.status(404).json({ ok: false, message: '펀딩 내역을 찾을 수 없습니다.' });
    }
    const account = await loadRefundAccount({ kind: 'funding', orderNo: order.orderNo });
    if (!account) {
      await log('not_found');
      return res.status(404).json({ ok: false, message: '접수된 환불 계좌가 없습니다.' });
    }
    await log('success');
    return res.status(200).json({
      ok: true,
      account,
      holderMismatch: !holderMatchesCustomer(account.accountHolder, order.customerName),
    });
  } catch (error: unknown) {
    if (error instanceof FieldCryptoError) {
      await log('decrypt_failed');
      console.error(`[funding] 환불 계좌 복호화 실패 (orderId=${id}, code=${error.code})`);
      return res.status(500).json({ ok: false, code: error.code, message: CRYPTO_ERROR_MESSAGE[error.code] });
    }
    await log('error');
    console.error(`[funding] 환불 계좌 조회 실패 (orderId=${id}):`, safeDbErrorSummary(error));
    return res.status(500).json({ ok: false, message: '환불 계좌를 읽지 못했습니다. 마이그레이션 0048이 적용됐는지 확인해 주세요.' });
  }
}
