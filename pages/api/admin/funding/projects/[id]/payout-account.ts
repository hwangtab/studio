import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../../../lib/contracts/admin-auth';
import { loadFundingPayoutAccount } from '../../../../../../lib/funding/payoutAccount';
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

  /** 기록 경로의 예외가 조회를 끊지 않게 한 겹 더 받는다(resident-number.ts와 같은 이유). */
  const log = (result: PrivacyAccessResult) =>
    recordAdminPrivacyAccess(req, 'funding_payout_account_view', id, result).catch((error: unknown) => {
      console.error('[privacy] 접속기록 호출 실패 — 조회는 계속됩니다', error);
    });

  try {
    const account = await loadFundingPayoutAccount(id);
    if (!account) {
      await log('not_found');
      return res.status(404).json({ ok: false, message: '등록된 정산 계좌가 없습니다. 개설자에게 등록을 요청해 주세요.' });
    }
    await log('success');
    console.warn(`[funding] 정산 계좌 조회 (projectId=${id}, at=${new Date().toISOString()})`);
    return res.status(200).json({ ok: true, account });
  } catch (error: unknown) {
    await log('error');
    console.error(`[funding] 정산 계좌 조회 실패 (projectId=${id}):`, error);
    return res.status(500).json({ ok: false, message: '계좌 정보를 읽지 못했습니다.' });
  }
}
