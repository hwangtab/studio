import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../lib/contact/origin';
import { authenticateCreatorApi } from '../../../../lib/funding/creatorAuth';
import { savePayoutSection } from '../../../../lib/funding/creatorProjectWrite';
import { validatePayoutSection } from '../../../../lib/funding/creatorValidation';
import { respondWriteResult } from '../../../../lib/funding/creatorWriteHttp';

/**
 * 정산 정보(계좌·세금 구분·주민등록번호·사업자 정보) 저장 — **저장 경로는 이것 하나다.**
 *
 * 값이 프로젝트가 아니라 계정(`funding_creators`·`creator_business_profiles`)에 붙어 있어 URL에 프로젝트 id가 없다.
 * 받아도 되는 계정인지(승인된 펀딩·공연·상점 중 하나)는 `savePayoutSection`이 판정한다.
 *
 * 응답은 `respondWriteResult`의 `{ ok: true, ...불리언·안내 문구 }` 한 벌이다 — 저장한 계좌를 되돌려 보내지 않는다.
 * 화면은 자기가 입력한 값을 이미 들고 있고, 응답에 실으면 그 JSON이 브라우저 캐시·개발자도구 네트워크 탭·프록시
 * 로그에 그대로 남는다. 검증 실패 메시지에도 입력값을 넣지 않는다(`validatePayoutSection`).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  if (!isAllowedContactRequestOrigin(req)) {
    return res.status(403).json({ ok: false, message: 'Forbidden' });
  }

  const auth = await authenticateCreatorApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: '로그인이 필요해요.' });

  // 프로젝트 구획 저장과 같은 예산을 쓴다 — 예전엔 같은 라우트의 한 갈래였다.
  if (!(await consumeRateLimit(`creator_save:${auth.creatorId}`, 30, 60))) {
    return res.status(429).json({ ok: false, message: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' });
  }

  const validated = validatePayoutSection(req.body?.value);
  if (!validated.ok) return res.status(400).json({ ok: false, message: validated.message });
  return respondWriteResult(res, await savePayoutSection(auth.creatorId, validated.value));
}
