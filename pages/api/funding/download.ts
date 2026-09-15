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
import { presignFundingDownload } from '../../../lib/funding/r2';

/**
 * 디지털 리워드 내려받기 — **최초 접근을 기록하는** 경로.
 *
 * 왜 직접 링크를 주지 않는가: 약관 제8조 2항이 "내려받기가 시작된 뒤에는 청약철회가
 * 제한됩니다"(전자상거래법 제17조 2항 5호)라고 고지하는데, 그 판정 근거가 서버에 없었다.
 * 고지만 있고 구현이 없어서, 1.8GB 원본을 전부 받고도 전액 환불이 그대로 됐다.
 *
 * 여기서 `downloaded_at`을 남기면 `assessSelfCancel`이 그 뒤의 셀프 취소를 막는다.
 *
 * **이제 접근 제어 수단이기도 하다.** 예전에는 저장소의 공개 주소로 302를 보냈고, 그
 * 주소가 확정 메일과 후원 확인 페이지에 그대로 실려 나갔다 — 후원자가 게이트를 건너뛰고
 * 직접 받으면 `downloaded_at`이 안 찍혀 **파일을 전부 받은 뒤 전액 셀프 환불**이 됐고,
 * 티어 간 파일명을 바꿔 상위 음질을 가져갈 수도 있었다. 지금 밖으로 나가는 값은 객체
 * 키뿐이고, 실제 주소는 여기서 서명해 만든다(lib/funding/r2.ts).
 *
 * 전제: 버킷의 공개 접근이 꺼져 있어야 한다. 켜져 있으면 서명을 떼고 같은 객체를 받을 수
 * 있어 이 경로가 다시 기록 장치로만 남는다.
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
  // `file`은 **이 후원자의 리워드가 주는 키**와 일치해야 한다. 목록에 없는 값을 넘겨
  // 다른 티어의 파일이나 버킷의 다른 객체에 서명을 받아 내지 못하게 한다.
  const target = reward?.downloads.find((d) => d.key === file);
  if (!target) return res.status(404).json(NOT_FOUND);

  /**
   * 최초 1회만 기록한다. `downloaded_at IS NULL`을 WHERE에 넣어 DB가 판정하게 하므로,
   * 같은 사람이 동시에 두 파일을 눌러도 먼저 도착한 쪽의 시각만 남는다. 판정 기준은
   * "언제 시작했는가"이지 "마지막으로 언제 받았는가"가 아니다.
   */
  /**
   * 서명을 **먼저** 받는다. 발급이 실패하면(자격증명 누락 등) 기록을 남기지 않아야 한다 —
   * 파일을 못 받았는데 `downloaded_at`만 찍히면 후원자가 셀프 취소까지 잃는다.
   */
  let signedUrl: string;
  try {
    signedUrl = await presignFundingDownload(target.key);
  } catch (error) {
    console.error('[funding-download] 서명 주소 발급 실패', { orderNo: order.orderNo, key: target.key, error });
    return res.status(503).json({ ok: false, message: '지금은 내려받을 수 없습니다. 잠시 후 다시 시도해 주세요.' });
  }

  await getDb()
    .update(fundingPledges)
    .set({ downloadedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(fundingPledges.id, pledge.id), isNull(fundingPledges.downloadedAt)));

  res.redirect(302, signedUrl);
}
