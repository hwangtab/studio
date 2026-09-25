import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../../../lib/contact/origin';
import { authenticateCreatorApi } from '../../../../../../lib/funding/creatorAuth';
import { loadCreatorShipping, type CreatorShippingRow } from '../../../../../../lib/funding/creatorShipping';
import { toCsv } from '../../../../../../lib/funding/csv';
import { FULFILLMENT_LABELS } from '../../../../../../lib/funding/fulfillmentLabels';
import { privacyCreatorActor, recordPrivacyAccess, type PrivacyAccessResult } from '../../../../../../lib/privacy/accessLog';
import { getClientIp } from '../../../../../../lib/contracts/client-ip';

/**
 * CSV 열은 Task 1의 화이트리스트(`CreatorShippingRow`, `lib/funding/creatorShipping.ts`)를
 * 그대로 옮긴 것이다 — `pledgeId`만 뺐다(발송 라벨을 뽑는 데 필요 없는 내부 id). 결제
 * 금액·결제수단·주문번호·후원자 이메일은 `loadCreatorShipping`이 애초에 그 행에 담지
 * 않으므로 여기서 늘어놓을 수도 없다. 화면(`ShippingTable`)이 보여주는 필드 집합과 여기
 * 열 집합이 갈라지면 한쪽으로만 정보가 새므로, 열을 늘리려면 먼저 Task 1의 화이트리스트를
 * 넓혀야 한다 — 이 파일 혼자 새 필드를 얹지 않는다.
 */
const COLUMNS = [
  '발송금지', '받는사람', '연락처', '우편번호', '배송지1', '배송지2', '배송지메모',
  '리워드', '수량', '발송상태', '택배사', '운송장번호',
];

const toCsvRow = (row: CreatorShippingRow): Record<string, string | number | null> => ({
  // 관리자 CSV와 같은 이유로 맨 앞 — 주소로 정렬해 라벨을 뽑는 실무에서 이 열만 훑으면 걸러진다.
  발송금지: row.shipHold,
  받는사람: row.shippingName,
  연락처: row.shippingPhone,
  우편번호: row.shippingPostcode,
  배송지1: row.shippingAddress1,
  배송지2: row.shippingAddress2,
  배송지메모: row.shippingMemo,
  리워드: row.rewardTitle,
  수량: row.quantity,
  발송상태: FULFILLMENT_LABELS[row.fulfillmentStatus] ?? row.fulfillmentStatus,
  택배사: row.trackingCompany,
  운송장번호: row.trackingNumber,
});

/**
 * 개설자가 자기 프로젝트의 배송 목록을 CSV로 내려받는 라우트.
 *
 * 인증·Origin·no-store·레이트리밋 순서는 개설자 쓰기 라우트
 * (`pages/api/funding/creator/projects/[id]/fulfillment.ts`)와 같은 관례를 따른다.
 * 소유·마감 게이트는 이 라우트가 직접 판정하지 않는다 — `loadCreatorShipping`이 소유를
 * SQL JOIN으로 대조하고(남의 프로젝트면 null), 마감 전이면 `state: 'before_close'`를
 * 돌려주므로 이 라우트는 그 두 상태를 HTTP 상태로 옮기기만 한다.
 *
 * 내려받은 사실은 관리자 CSV와 같은 표(`privacy_access_logs`)에 남긴다. 다른 점은
 * 수행자다 — 개설자는 계정이 사람별로 갈려 있어 `creator:<creatorId>`로 특정된다. 담는
 * 것은 프로젝트 id와 건수뿐이고, 404·409처럼 아무것도 조회되지 않은 경로는 남기지 않는다.
 * 조회가 예외로 끝난 경우는 남긴다 — 그때는 이미 목록을 열려고 한 시도가 있었다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false });

  if (!isAllowedContactRequestOrigin(req)) {
    return res.status(403).json({ ok: false, message: 'Forbidden' });
  }

  const auth = await authenticateCreatorApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: '로그인이 필요합니다.' });

  /**
   * 개설자별 별도 키. `creator_fulfillment:<creatorId>`(300회/600초 — 행 단위 저장을
   * 연속으로 부르는 흐름)와 `creator_save:<creatorId>`(30회/60초 — 구획 저장)를 재사용하지
   * 않는다. CSV는 그 둘과 성격이 다르다 — 한 번에 목록 전체를 내려받는 동작이라 정상적인
   * 사용이라면 세션당 몇 번이면 충분하다.
   *
   * 20회/600초(10분)로 잡는다. 참고한 것은 관리자 계약서 다운로드
   * (`lib/contracts/admin-rate-limit.ts`의 `checkDownloadRateLimit`, 10회/600초)다 — 그
   * 두 배로 준 것은, 배송 라벨을 인쇄하는 동안 파일을 다시 받거나 새로고침을 몇 번
   * 반복해도 막히지 않게 하려는 것이다. 그러면서도 스크립트로 무한 반복 호출하는 경로는
   * 여전히 낮은 벽으로 막는다.
   */
  if (!(await consumeRateLimit(`funding_creator_csv:${auth.creatorId}`, 20, 600))) {
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });
  }

  const projectId = typeof req.query.id === 'string' ? req.query.id : '';
  if (!projectId) return res.status(404).json({ ok: false, message: '프로젝트를 찾을 수 없습니다.' });

  /**
   * 기록 경로의 예외가 다운로드를 끊지 않게 한 겹 더 받는다(payout-account.ts와 같은 이유).
   *
   * **실패한 시도도 남긴다.** 처리방침 19항이 이 기록을 "성공·실패를 가리지 않고" 남긴다고
   * 고지한다. 조회가 던졌을 때 500만 나가고 행이 안 남으면, 개설자가 배송 목록을 열려고
   * 시도한 사실 자체가 어디에도 안 보인다 — 접속기록이 막으려는 것이 바로 그 공백이다.
   */
  const log = (result: PrivacyAccessResult, rowCount?: number) =>
    recordPrivacyAccess({
      actor: privacyCreatorActor(auth.creatorId),
      action: 'funding_creator_shipping_export',
      targetId: projectId,
      result,
      rowCount,
      ip: getClientIp(req),
    }).catch((error: unknown) => {
      console.error('[privacy] 접속기록 호출 실패 — 다운로드는 계속됩니다', error);
    });

  let view: Awaited<ReturnType<typeof loadCreatorShipping>>;
  try {
    view = await loadCreatorShipping(auth.creatorId, projectId);
  } catch (error: unknown) {
    await log('error');
    console.error('[API/funding/creator/shipping.csv] 배송 목록 조회 실패:', error);
    return res.status(500).json({ ok: false, message: '배송 목록을 만들지 못했습니다.' });
  }
  if (!view) return res.status(404).json({ ok: false, message: '프로젝트를 찾을 수 없습니다.' });

  if (view.state !== 'open') {
    return res.status(409).json({ ok: false, message: '모금이 끝난 뒤에만 배송 목록을 내려받을 수 있습니다.' });
  }

  const csv = toCsv(view.rows.map(toCsvRow), COLUMNS);
  await log('success', view.rows.length);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  // projectId는 DB가 randomblob(16)의 hex로 생성한다(db/schema.ts) — 영숫자뿐이라
  // 헤더 인젝션·경로 조작 소재가 없다. slug와 달리 별도 형식 검증을 두지 않는다.
  res.setHeader('Content-Disposition', `attachment; filename="shipping-${projectId}.csv"`);
  return res.status(200).send(csv);
}
