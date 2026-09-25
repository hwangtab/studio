import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../../../lib/contact/origin';
import { authenticateCreatorApi } from '../../../../../../lib/funding/creatorAuth';
import { loadFulfillmentGate } from '../../../../../../lib/funding/creatorShipping';
import { setFulfillment } from '../../../../../../lib/funding/fulfillment';

// setFulfillment의 code → HTTP. 관리자 라우트(pages/api/admin/funding/pledges/[id].ts)와
// 같은 매핑을 쓴다 — 함수 계약은 하나이므로 매핑도 하나여야 한다.
const FULFILLMENT_STATUS: Record<string, number> = {
  not_found: 404, invalid_status: 400, not_live: 409, refund_requested: 409, conflict: 409, forbidden: 403,
};

/**
 * 개설자가 자기 프로젝트 후원의 발송 상태·송장을 직접 넣는 라우트.
 *
 * URL의 :id(프로젝트)는 라우팅 관례상 있을 뿐 인가·게이트 판정에 쓰지 않는다 — 실제
 * 판정은 body의 pledgeId에서 프로젝트를 되짚어 하는 `loadFulfillmentGate`가 맡는다.
 * 그래야 개설자가 URL의 다른(자기 소유) 프로젝트 id로 마감 게이트를 우회할 수 없다
 * (creatorShipping.ts의 `loadFulfillmentGate` 주석 참조).
 *
 * 화면(`ShippingTable`)은 마감 뒤에만 이 표를 보여 주지만, 그건 클라이언트 판단이다.
 * 서버가 같은 선(마감 여부)과 그 화면이 원래 걸던 다른 한 선(requiresShipping)을 다시
 * 긋지 않으면, 개설자가 마감 전 후원이나 디지털 전용 후원의 발송 상태를 직접 호출로
 * 바꿀 수 있다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  if (!isAllowedContactRequestOrigin(req)) {
    return res.status(403).json({ ok: false, message: 'Forbidden' });
  }

  const auth = await authenticateCreatorApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: '로그인이 필요합니다.' });

  const pledgeId = typeof req.body?.pledgeId === 'string' ? req.body.pledgeId : '';
  const fulfillmentStatus = typeof req.body?.fulfillmentStatus === 'string' ? req.body.fulfillmentStatus : '';
  if (!pledgeId || !fulfillmentStatus) {
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });
  }

  /**
   * `creator_save:<creatorId>`(구획 저장이 쓰는 키, 30회/60초)를 공유하지 않는다.
   *
   * 발송 처리는 구획 저장과 성격이 다르다 — 개설자가 한 자리에서 후원 건마다 행 하나씩
   * 연속으로 저장한다. 30/60초를 공유하면 후원 31건째부터 429가 뜨는데, 이건 남용이 아니라
   * 정상적인 작업 흐름이다. 별도 키 `creator_fulfillment:<creatorId>`로 300회/600초(10분)를
   * 준다 — 지금 유일한 실사례(강정피스앤뮤직캠프)가 26건이고, 몇백 건 규모의 캠페인이
   * 생겨도 한 세션에서 다 처리할 수 있을 만큼 넉넉하게 잡았다. 그래도 무한은 아니다 —
   * 스크립트로 무한 반복 호출하는 경로는 여전히 막는다.
   */
  if (!(await consumeRateLimit(`creator_fulfillment:${auth.creatorId}`, 300, 600))) {
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });
  }

  const now = new Date();
  const gate = await loadFulfillmentGate(pledgeId, now);
  if (!gate) return res.status(404).json({ ok: false, message: '펀딩 내역을 찾을 수 없습니다.' });

  // URL의 :id가 이 pledge가 실제로 속한 프로젝트와 다르면(다른 자기 프로젝트를 잘못
  // 짚었거나 조작한 값) 이 자리에서 찾을 수 없는 것으로 다룬다 — 인가는 이미
  // gate.creatorId로 판정하므로 이건 라우팅 스코프를 맞추기 위한 것일 뿐이다.
  const projectId = typeof req.query.id === 'string' ? req.query.id : '';
  if (projectId && projectId !== gate.projectId) {
    return res.status(404).json({ ok: false, message: '이 프로젝트에서 해당 후원을 찾을 수 없습니다.' });
  }

  // 남의 후원이면 '권한 없음'이 아니라 404다 — 403은 "그 pledge id는 존재한다"를 알려 주는
  // 셈이다. 다른 개설자 라우트는 전부 404로 통일돼 있다(preview.tsx:105의 원칙).
  if (gate.creatorId !== auth.creatorId) {
    return res.status(404).json({ ok: false, message: '펀딩 내역을 찾을 수 없습니다.' });
  }

  if (!gate.pastFundingEnd) {
    return res.status(409).json({ ok: false, message: '모금이 끝난 뒤에만 발송 상태를 바꿀 수 있습니다.' });
  }

  if (!gate.requiresShipping) {
    return res.status(409).json({ ok: false, message: '배송이 필요 없는 리워드입니다.' });
  }

  const trackingCompany = typeof req.body?.trackingCompany === 'string' ? req.body.trackingCompany : undefined;
  const trackingNumber = typeof req.body?.trackingNumber === 'string' ? req.body.trackingNumber : undefined;

  const result = await setFulfillment({
    pledgeId,
    status: fulfillmentStatus,
    trackingCompany,
    trackingNumber,
    actor: { kind: 'creator', creatorId: auth.creatorId },
    now,
  });

  if (!result.ok) {
    return res.status(FULFILLMENT_STATUS[result.code] ?? 500).json({ ok: false, message: result.message });
  }
  return res.status(200).json({ ok: true });
}
