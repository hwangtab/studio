import type { NextApiRequest, NextApiResponse } from 'next';

import { FieldCryptoError } from '../../../../../../lib/crypto/fieldCrypto';
import { authenticateAdminApi } from '../../../../../../lib/contracts/admin-auth';
import { isApprovedFundingProject } from '../../../../../../lib/funding/payoutAccount';
import { RESIDENT_NUMBER_CRYPTO_ERROR_MESSAGE, loadFundingResidentNumber } from '../../../../../../lib/funding/residentNumber';
import { recordAdminPrivacyAccess, type PrivacyAccessResult } from '../../../../../../lib/privacy/accessLog';

/**
 * GET — 개설자의 주민등록번호를 **응답으로만** 내보낸다.
 *
 * 계좌 조회(`payout-account.ts`)와 같은 모양이고 같은 이유다: props에 담으면
 * `__NEXT_DATA__`로 페이지 소스에 박히므로, 운영자가 버튼을 누른 그 순간에만 가져와
 * 화면 state에만 둔다. 다른 점은 **계좌와 합치지 않았다**는 것 하나다 — 계좌는 이체할
 * 때마다, 이 번호는 지급명세서를 낼 때만 연다. 합치면 계좌만 보려던 조회에서도 번호가
 * 복호화돼 응답에 실리고, 열람 기록도 둘을 구분하지 못한다.
 *
 * 조회 사실을 `privacy_access_logs`에 남기되 **값은 적지 않는다.** 로그가 새면 DB 암호화가
 * 무의미해진다. 서버 로그(console)에도 한 줄 남지만 그쪽은 며칠이면 사라지므로 법이 요구하는
 * 2년 보관은 표가 맡는다(「개인정보의 안전성 확보조치 기준」 제8조①).
 *
 * **성공만이 아니라 실패도 남긴다.** 열지 못한 시도의 흔적이 없으면 사후에 "누가 무엇을
 * 열려고 했는가"를 재구성할 수 없다.
 */

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

  /**
   * `recordAdminPrivacyAccess`는 스스로 실패를 삼키지만, 여기서 한 겹 더 받는다 —
   * 기록 경로의 어떤 예외도 운영자의 조회를 500으로 끊어서는 안 된다는 것이 이 라우트의
   * 보증이고, 그 보증은 라우트 자신이 지고 있어야 테스트로 고정할 수 있다.
   */
  const log = (result: PrivacyAccessResult) =>
    recordAdminPrivacyAccess(req, auth.actor, 'funding_resident_number_view', id, result).catch((error: unknown) => {
      console.error('[privacy] 접속기록 호출 실패 — 조회는 계속됩니다', error);
    });

  try {
    // 승인 전 프로젝트(초안 id)로는 열지 않는다 — 자세한 이유는
    // lib/funding/payoutAccount.ts의 isApprovedFundingProject 주석.
    if (!(await isApprovedFundingProject(id))) {
      await log('not_found');
      return res.status(404).json({ ok: false, message: '승인된 프로젝트의 주민등록번호만 조회할 수 있습니다.' });
    }
    const residentNumber = await loadFundingResidentNumber(id);
    if (!residentNumber) {
      await log('not_found');
      return res.status(404).json({
        ok: false,
        message: '등록된 주민등록번호가 없습니다. 원천징수 대상이면 개설자에게 등록을 요청해 주세요.',
      });
    }
    await log('success');
    console.warn(`[funding] 주민등록번호 조회 (projectId=${id}, at=${new Date().toISOString()})`);
    return res.status(200).json({ ok: true, residentNumber });
  } catch (error: unknown) {
    if (error instanceof FieldCryptoError) {
      await log('decrypt_failed');
      // 코드만 남긴다 — FieldCryptoError의 메시지에는 값이 들어 있지 않지만, 로그에 적을
      // 이유도 없다. 표에는 사유 코드를 두지 않는다(분류값 하나로 충분하고, 컬럼이 늘수록
      // 기록이 값에 가까워진다).
      console.error(`[funding] 주민등록번호 복호화 실패 (projectId=${id}, code=${error.code})`);
      return res.status(500).json({ ok: false, code: error.code, message: RESIDENT_NUMBER_CRYPTO_ERROR_MESSAGE[error.code] });
    }
    await log('error');
    console.error(`[funding] 주민등록번호 조회 실패 (projectId=${id}):`, error);
    return res.status(500).json({ ok: false, message: '주민등록번호를 읽지 못했습니다.' });
  }
}
