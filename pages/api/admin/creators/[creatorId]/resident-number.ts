import type { NextApiRequest, NextApiResponse } from 'next';

import { FieldCryptoError } from '../../../../../lib/crypto/fieldCrypto';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { hasApprovedEngagement } from '../../../../../lib/funding/creatorEligibility';
import { loadCreatorResidentNumber, RESIDENT_NUMBER_CRYPTO_ERROR_MESSAGE } from '../../../../../lib/funding/residentNumber';
import { recordAdminPrivacyAccess, type PrivacyAccessResult } from '../../../../../lib/privacy/accessLog';

/**
 * GET — 개설자의 주민등록번호를 **응답으로만** 내보낸다. 개설자 단위판이다.
 *
 * 프로젝트 단위 경로(`../../funding/projects/[id]/resident-number.ts`)는 펀딩 프로젝트 id로 개설자를 찾으므로,
 * 상점 아티스트처럼 펀딩 프로젝트 없이 원천징수 정산을 받는 개설자의 번호는 열 길이 없었다. 이 경로가 그 자리다 —
 * 사업자 정보 패널(`components/admin/CreatorTaxProfilePanel.tsx`)의 버튼이 부른다.
 *
 * 규칙은 프로젝트 단위 경로와 같다: 버튼을 누른 그 순간에만 가져오고(props·`__NEXT_DATA__`에 싣지 않는다),
 * 성공·실패를 가리지 않고 `privacy_access_logs`에 남기며(`creator_resident_number_view`, 대상 creatorId),
 * 기록과 서버 로그에 값을 적지 않는다. 열기 전 선은 계좌와 같은 `hasApprovedEngagement`다.
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
    recordAdminPrivacyAccess(req, auth.actor, 'creator_resident_number_view', creatorId, result).catch((error: unknown) => {
      console.error('[privacy] 접속기록 호출 실패 — 조회는 계속됩니다', error);
    });

  try {
    if (!(await hasApprovedEngagement(creatorId))) {
      await log('not_found');
      return res.status(404).json({ ok: false, message: '승인된 펀딩·공연·상점 등록이 있는 개설자의 주민등록번호만 조회할 수 있습니다.' });
    }
    const residentNumber = await loadCreatorResidentNumber(creatorId);
    if (!residentNumber) {
      await log('not_found');
      return res.status(404).json({
        ok: false,
        message: '등록된 주민등록번호가 없습니다. 원천징수 대상이면 개설자에게 등록을 요청해 주세요.',
      });
    }
    await log('success');
    console.warn(`[funding] 주민등록번호 조회 (creatorId=${creatorId}, at=${new Date().toISOString()})`);
    return res.status(200).json({ ok: true, residentNumber });
  } catch (error: unknown) {
    if (error instanceof FieldCryptoError) {
      await log('decrypt_failed');
      // 코드만 남긴다 — 값도 메시지도 로그에 적을 이유가 없다.
      console.error(`[funding] 주민등록번호 복호화 실패 (creatorId=${creatorId}, code=${error.code})`);
      return res.status(500).json({ ok: false, code: error.code, message: RESIDENT_NUMBER_CRYPTO_ERROR_MESSAGE[error.code] });
    }
    await log('error');
    console.error(`[funding] 주민등록번호 조회 실패 (creatorId=${creatorId}):`, error);
    return res.status(500).json({ ok: false, message: '주민등록번호를 읽지 못했습니다.' });
  }
}
