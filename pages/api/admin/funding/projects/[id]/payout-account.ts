import type { NextApiRequest, NextApiResponse } from 'next';

import { FieldCryptoError, FIELD_CRYPTO_KEY_ENV } from '../../../../../../lib/crypto/fieldCrypto';
import { authenticateAdminApi } from '../../../../../../lib/contracts/admin-auth';
import { isApprovedFundingProject, loadFundingPayoutAccount } from '../../../../../../lib/funding/payoutAccount';
import { recordAdminPrivacyAccess, type PrivacyAccessResult } from '../../../../../../lib/privacy/accessLog';

/**
 * GET — 개설자의 정산 계좌를 **응답으로만** 내보낸다.
 *
 * 왜 별도 라우트인가: 심사 화면(`pages/admin/funding/projects/[id].tsx`)의 props는
 * `__NEXT_DATA__` JSON으로 페이지 HTML에 박힌다. 계좌를 props에 담으면 화면을 열기만 해도
 * 소스·브라우저 캐시·화면 공유에 계좌번호가 남는다. 그래서 운영자가 이체하려고 버튼을
 * 누른 그 순간에만 이 경로로 가져오고, 값은 클라이언트 state에만 머문다.
 *
 * 조회 사실을 `privacy_access_logs`에 남긴다 — 남의 계좌를 언제 열어 봤는지가 어디에도
 * 없으면 사후에 확인할 방법이 없다. 기록에는 **계좌번호를 적지 않는다**(기록이 새면 같은
 * 사고다). 계좌번호 자체는 고유식별정보가 아니지만 주민등록번호 조회와 같은
 * 개인정보처리시스템이라 같은 표에 남고, 따라서 2년 보관 기준이 함께 걸린다.
 *
 * **성공만이 아니라 실패도 남긴다.** 계좌는 은행명·예금주까지 한 벌로 암호화돼 있어
 * (`lib/funding/payoutAccountCrypto.ts`) 키가 없거나 바뀌면 열리지 않는데, 열지 못한 시도의
 * 흔적이 없으면 사후에 "누가 무엇을 열려고 했는가"를 재구성할 수 없다.
 */

/** 복호화 실패 → 운영자가 해야 할 일. 사유마다 다르므로 문구를 가른다(resident-number.ts와 같은 축). */
const CRYPTO_ERROR_MESSAGE: Record<FieldCryptoError['code'], string> = {
  missing_key: `이 환경에 복호화 키(${FIELD_CRYPTO_KEY_ENV})가 없습니다. 값은 그대로 있습니다 — 배포 환경 변수에 키를 등록한 뒤 다시 시도해 주세요.`,
  invalid_key: `복호화 키(${FIELD_CRYPTO_KEY_ENV})의 형식이 맞지 않습니다(base64 32바이트여야 합니다). 값은 그대로 있습니다 — 환경 변수를 고친 뒤 다시 시도해 주세요.`,
  malformed: '저장된 값이 암호화 형식이 아니거나 내용이 형식과 다릅니다. 개설자에게 정산 계좌를 다시 등록해 달라고 요청해 주세요.',
  unsupported_version: '저장된 값의 암호화 판본을 이 배포가 모릅니다. 배포 판본을 확인해 주세요 — 값을 지우거나 덮어쓰지 마세요.',
  key_mismatch: `이 값은 지금 이 배포의 키(${FIELD_CRYPTO_KEY_ENV})가 아니라 다른 키로 저장됐습니다. 값은 손상되지 않았습니다 — 저장 당시의 키를 되돌리거나, 키 회전이 중간에 멈춘 것이라면 scripts/rotate-field-key.mjs를 이어서 돌리면 열립니다. 개설자에게 재등록을 요청하지 마세요.`,
  auth_failed: `복호화에 실패했습니다. 키(${FIELD_CRYPTO_KEY_ENV})가 저장 당시와 다르거나 값이 손상됐습니다. 다른 개설자의 계좌가 정상적으로 열리면 값 손상, 전부 안 열리면 키가 바뀐 것입니다 — 키가 바뀐 경우 옛 키를 되돌려야 하고, 되돌릴 수 없으면 개설자에게 다시 등록을 요청해야 합니다.`,
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

  /** 기록 경로의 예외가 조회를 끊지 않게 한 겹 더 받는다(resident-number.ts와 같은 이유). */
  const log = (result: PrivacyAccessResult) =>
    recordAdminPrivacyAccess(req, auth.actor, 'funding_payout_account_view', id, result).catch((error: unknown) => {
      console.error('[privacy] 접속기록 호출 실패 — 조회는 계속됩니다', error);
    });

  try {
    // 승인 전 프로젝트(초안 id)로는 열지 않는다 — 자세한 이유는
    // lib/funding/payoutAccount.ts의 isApprovedFundingProject 주석.
    if (!(await isApprovedFundingProject(id))) {
      await log('not_found');
      return res.status(404).json({ ok: false, message: '승인된 프로젝트의 정산 계좌만 조회할 수 있습니다.' });
    }
    const account = await loadFundingPayoutAccount(id);
    if (!account) {
      await log('not_found');
      return res.status(404).json({ ok: false, message: '등록된 정산 계좌가 없습니다. 개설자에게 등록을 요청해 주세요.' });
    }
    await log('success');
    console.warn(`[funding] 정산 계좌 조회 (projectId=${id}, at=${new Date().toISOString()})`);
    return res.status(200).json({ ok: true, account });
  } catch (error: unknown) {
    if (error instanceof FieldCryptoError) {
      await log('decrypt_failed');
      // 코드만 남긴다 — 값은 메시지에 들어 있지 않고, 로그에 적을 이유도 없다.
      console.error(`[funding] 정산 계좌 복호화 실패 (projectId=${id}, code=${error.code})`);
      return res.status(500).json({ ok: false, code: error.code, message: CRYPTO_ERROR_MESSAGE[error.code] });
    }
    await log('error');
    console.error(`[funding] 정산 계좌 조회 실패 (projectId=${id}):`, error);
    return res.status(500).json({ ok: false, message: '계좌 정보를 읽지 못했습니다.' });
  }
}
