import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../../../lib/contact/origin';
import { authenticateCreatorApi } from '../../../../../../lib/funding/creatorAuth';
import { loadCreatorShipping, type CreatorShippingRow } from '../../../../../../lib/funding/creatorShipping';
import { toCsv } from '../../../../../../lib/funding/csv';

/**
 * 발송 상태 라벨. `components/funding/creator/ShippingTable.tsx`의 `FULFILLMENT_LABELS`와
 * 같은 표기를 쓴다. 그 상수를 값으로 import하지 않는 이유는 그 파일이 `useState` 등 React
 * 훅을 문 클라이언트 컴포넌트라서다 — 값으로 가져오면 서버 라우트 번들에 컴포넌트 트리가
 * 끌려 들어간다(CLAUDE.md "개설자가 쓴 것은 우리가 쓴 것과 다르게 다룬다" 절이 경고하는
 * 것과 같은 함정). 표기를 바꾸면 두 곳을 함께 고칠 것.
 */
const FULFILLMENT_LABELS: Record<string, string> = {
  none: '미발송',
  preparing: '준비중',
  shipped: '발송완료',
  delivered: '수령완료',
};

/**
 * CSV 열은 Task 1의 화이트리스트(`CreatorShippingRow`, `lib/funding/creatorShipping.ts`)를
 * 그대로 옮긴 것이다 — `pledgeId`만 뺐다(발송 라벨을 뽑는 데 필요 없는 내부 id). 결제
 * 금액·결제수단·주문번호·서포터 이메일은 `loadCreatorShipping`이 애초에 그 행에 담지
 * 않으므로 여기서 늘어놓을 수도 없다. 화면(`ShippingTable`)이 보여주는 필드 집합과 여기
 * 열 집합이 갈라지면 한쪽으로만 정보가 새므로, 열을 늘리려면 먼저 Task 1의 화이트리스트를
 * 넓혀야 한다 — 이 파일 혼자 새 필드를 얹지 않는다.
 */
const COLUMNS = [
  '받는사람', '연락처', '우편번호', '배송지1', '배송지2', '배송지메모',
  '리워드', '수량', '발송상태', '택배사', '운송장번호',
];

const toCsvRow = (row: CreatorShippingRow): Record<string, string | number | null> => ({
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

  const view = await loadCreatorShipping(auth.creatorId, projectId);
  if (!view) return res.status(404).json({ ok: false, message: '프로젝트를 찾을 수 없습니다.' });

  if (view.state !== 'open') {
    return res.status(409).json({ ok: false, message: '모금이 끝난 뒤에만 배송 목록을 내려받을 수 있습니다.' });
  }

  const csv = toCsv(view.rows.map(toCsvRow), COLUMNS);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  // projectId는 DB가 randomblob(16)의 hex로 생성한다(db/schema.ts) — 영숫자뿐이라
  // 헤더 인젝션·경로 조작 소재가 없다. slug와 달리 별도 형식 검증을 두지 않는다.
  res.setHeader('Content-Disposition', `attachment; filename="shipping-${projectId}.csv"`);
  return res.status(200).send(csv);
}
