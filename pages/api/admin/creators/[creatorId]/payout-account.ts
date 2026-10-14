import type { NextApiRequest, NextApiResponse } from 'next';

import { FieldCryptoError } from '../../../../../lib/crypto/fieldCrypto';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { hasApprovedEngagement } from '../../../../../lib/funding/creatorEligibility';
import { loadCreatorPayoutAccount, PAYOUT_ACCOUNT_CRYPTO_ERROR_MESSAGE } from '../../../../../lib/funding/payoutAccount';
import { recordAdminPrivacyAccess, type PrivacyAccessResult } from '../../../../../lib/privacy/accessLog';

/**
 * GET — 개설자의 정산 계좌를 **응답으로만** 내보낸다. 개설자 단위판이다.
 *
 * 프로젝트 단위 경로(`../../funding/projects/[id]/payout-account.ts`)는 펀딩 프로젝트 id로 개설자를 찾으므로,
 * 펀딩 프로젝트 없이 공연·상점으로만 정산받는 개설자의 계좌는 열 길이 없었다. 이 경로가 그 자리다 — 공연 등록
 * 상세·상점 아티스트 화면의 사업자 정보 패널(`components/admin/CreatorTaxProfilePanel.tsx`)이 버튼으로 부른다.
 *
 * 규칙은 프로젝트 단위 경로와 같다: 버튼을 누른 그 순간에만 가져오고(props에 싣지 않는다), 성공·실패를 가리지 않고
 * `privacy_access_logs`에 남기며(`creator_payout_account_view`, 대상 creatorId), 기록에 계좌번호를 적지 않는다.
 * 열기 전 선은 정산 정보를 받는 조건과 같은 `hasApprovedEngagement`다 — 승인된 일이 없는 계정의 계좌는 열지 않는다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false });
  }

  const creatorId = typeof req.query.creatorId === 'string' ? req.query.creatorId : '';
  if (!creatorId) return res.status(400).json({ ok: false, message: '잘못된 요청입니다.' });

  /** 기록 경로의 예외가 조회를 끊지 않게 한 겹 더 받는다(프로젝트 단위 경로와 같은 이유). */
  const log = (result: PrivacyAccessResult) =>
    recordAdminPrivacyAccess(req, auth.actor, 'creator_payout_account_view', creatorId, result).catch((error: unknown) => {
      console.error('[privacy] 접속기록 호출 실패 — 조회는 계속됩니다', error);
    });

  try {
    if (!(await hasApprovedEngagement(creatorId))) {
      await log('not_found');
      return res.status(404).json({ ok: false, message: '승인된 펀딩·공연·상점 등록이 있는 개설자의 정산 계좌만 조회할 수 있습니다.' });
    }
    const account = await loadCreatorPayoutAccount(creatorId);
    if (!account) {
      await log('not_found');
      return res.status(404).json({ ok: false, message: '등록된 정산 계좌가 없습니다. 개설자에게 등록을 요청해 주세요.' });
    }
    await log('success');
    console.warn(`[funding] 정산 계좌 조회 (creatorId=${creatorId}, at=${new Date().toISOString()})`);
    return res.status(200).json({ ok: true, account });
  } catch (error: unknown) {
    if (error instanceof FieldCryptoError) {
      await log('decrypt_failed');
      console.error(`[funding] 정산 계좌 복호화 실패 (creatorId=${creatorId}, code=${error.code})`);
      return res.status(500).json({ ok: false, code: error.code, message: PAYOUT_ACCOUNT_CRYPTO_ERROR_MESSAGE[error.code] });
    }
    await log('error');
    console.error(`[funding] 정산 계좌 조회 실패 (creatorId=${creatorId}):`, error);
    return res.status(500).json({ ok: false, message: '계좌 정보를 읽지 못했습니다.' });
  }
}
