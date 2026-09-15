import type { NextApiRequest, NextApiResponse } from 'next';
import { eq, isNull, and } from 'drizzle-orm';

import { getDb } from '../../../db/client';
import { fundingPledges } from '../../../db/schema';
import { getClientIp } from '../../../lib/contracts/client-ip';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { isTokenMatch } from '../../../lib/booking/token';
import { findFundingOrderByOrderNo } from '../../../lib/funding/service';
import { getFundingProject } from '../../../lib/funding/projects';
import { isLiveFundingOrderStatus } from '../../../lib/funding/refundable';

/**
 * 디지털 리워드 내려받기 — **최초 접근을 기록하는** 경로.
 *
 * 왜 직접 링크를 주지 않는가: 약관 제8조 2항이 "내려받기가 시작된 뒤에는 청약철회가
 * 제한됩니다"(전자상거래법 제17조 2항 5호)라고 고지하는데, 그 판정 근거가 서버에 없었다.
 * 고지만 있고 구현이 없어서, 1.8GB 원본을 전부 받고도 전액 환불이 그대로 됐다.
 *
 * 여기서 `downloaded_at`을 남기면 `assessSelfCancel`이 그 뒤의 셀프 취소를 막는다.
 *
 * **접근 제어 수단은 아니다.** 저장소 주소는 여전히 공개 URL이고 이 경로는 302로 그리로
 * 보낸다(projects.ts `downloads` 주석 참조) — 주소를 아는 사람은 이 경로를 거치지 않고도
 * 받을 수 있다. 여기서 하는 일은 "후원자가 받기 시작했다"를 남기는 것이다. 진짜 접근
 * 제어가 필요해지면 서명 URL을 발급해야 하고, 그때는 이 경로가 그 발급기가 된다.
 */

const NOT_FOUND = { ok: false, message: '후원을 찾을 수 없습니다.' } as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false });

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`funding_download:ip:${ip}`, 60, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });

  const { orderNo, token, file } = req.query;
  if (typeof orderNo !== 'string' || typeof token !== 'string' || typeof file !== 'string' || !orderNo || !token)
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });

  const order = await findFundingOrderByOrderNo(orderNo);
  // 주문 부재와 토큰 불일치를 같은 404로 — 다르게 답하면 주문의 존재를 떠볼 수 있다.
  if (!order || !isTokenMatch(order.manageToken, token)) return res.status(404).json(NOT_FOUND);
  const pledge = order.fundingPledge;
  if (!pledge) return res.status(404).json(NOT_FOUND);

  // 환불·취소된 건에는 내려주지 않는다. 화면 쪽 판정과 같은 집합을 쓴다.
  if (!isLiveFundingOrderStatus(order.status))
    return res.status(409).json({ ok: false, message: '결제가 살아 있는 후원만 내려받을 수 있습니다.' });

  const project = getFundingProject(pledge.projectSlug);
  const reward = project?.rewards.find((r) => r.id === pledge.rewardId);
  // `file`은 목록의 **주소와 일치**해야 한다. 임의 URL을 넘겨 리다이렉트 시키지 못하게
  // (open redirect) 목록에 있는 값만 허용한다.
  const target = reward?.downloads.find((d) => d.url === file);
  if (!target) return res.status(404).json(NOT_FOUND);

  /**
   * 최초 1회만 기록한다. `downloaded_at IS NULL`을 WHERE에 넣어 DB가 판정하게 하므로,
   * 같은 사람이 동시에 두 파일을 눌러도 먼저 도착한 쪽의 시각만 남는다. 판정 기준은
   * "언제 시작했는가"이지 "마지막으로 언제 받았는가"가 아니다.
   */
  await getDb()
    .update(fundingPledges)
    .set({ downloadedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(fundingPledges.id, pledge.id), isNull(fundingPledges.downloadedAt)));

  res.redirect(302, target.url);
}
