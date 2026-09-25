import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../../db/client';
import { orders } from '../../../../../db/schema';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { generateManageToken } from '../../../../../lib/booking/token';
import { rowsAffectedOf } from '../../../../../lib/booking/confirm';
import { listFundingOrders } from '../../../../../lib/funding/admin-list';
import { serializePledgeForAdmin } from '../../../../../lib/funding/admin-serialize';
import { computeFundingAmounts, splitFundingAmount } from '../../../../../lib/funding/amounts';
import { deliverConfirmedEmailsOnce } from '../../../../../lib/funding/confirm';
import {
  ADDITIONAL_AMOUNT_STEP, MAX_ADDITIONAL_AMOUNT, MAX_MANUAL_ACTUAL_AMOUNT, MAX_QUANTITY,
} from '../../../../../lib/funding/policy';
import { findReward } from '../../../../../lib/funding/projects';
import { getFundingProjectAsync } from '../../../../../lib/funding/repository';
import {
  MANUAL_PLACEHOLDER_EMAIL, MANUAL_PLACEHOLDER_PHONE,
  aggregateProjectStatus, expireStalePledges, findFundingOrderByOrderNo, fundingStockCondition,
  generateFundingOrderNo,
} from '../../../../../lib/funding/service';
import { SEND_PENDING } from '../../../../../lib/ops/notificationSentinel';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  if (req.method === 'GET') {
    await expireStalePledges(new Date());
    const slug = typeof req.query.slug === 'string' ? req.query.slug : null;
    const items = await listFundingOrders(slug);
    return res.status(200).json({
      ok: true,
      items: items.slice(0, 200).map((o) => serializePledgeForAdmin(o)),
      truncated: items.length > 200,
    });
  }

  if (req.method === 'POST') {
    const b = (typeof req.body === 'object' && req.body) || {};
    const project = await getFundingProjectAsync(String(b.projectSlug ?? ''));
    const reward = project && typeof b.rewardId === 'string' ? findReward(project, b.rewardId) : undefined;
    const quantity = Number(b.quantity ?? 1);
    const additionalAmount = Number(b.additionalAmount ?? 0);
    if (
      !project ||
      !reward ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY ||
      !Number.isInteger(additionalAmount) ||
      additionalAmount < 0 ||
      additionalAmount > MAX_ADDITIONAL_AMOUNT ||
      additionalAmount % ADDITIONAL_AMOUNT_STEP !== 0 ||
      typeof b.customerName !== 'string' ||
      !b.customerName
    ) {
      return res.status(400).json({ ok: false, message: '프로젝트·리워드·수량·이름을 확인해 주세요.' });
    }
    /**
     * 실수령액(선택) — 현금으로 실제 받은 금액이 리워드 단가 × 수량 + 추가금과 안 맞을 때
     * (에누리·잔돈) 그 값을 그대로 쓴다. 없으면 지금처럼 리워드가에서 계산한다.
     * 이 칸이 없을 때는 공개 모금액과 정산 grossAmount가 실수령액과 어긋났다.
     */
    const hasActualAmount = b.actualAmount !== undefined && b.actualAmount !== null && b.actualAmount !== '';
    const actualAmount = Number(b.actualAmount);
    if (
      hasActualAmount &&
      !(Number.isInteger(actualAmount) && actualAmount > 0 && actualAmount <= MAX_MANUAL_ACTUAL_AMOUNT)
    ) {
      return res.status(400).json({
        ok: false,
        message: `실수령액은 1원 이상 ${MAX_MANUAL_ACTUAL_AMOUNT.toLocaleString('ko-KR')}원 이하의 정수여야 합니다.`,
      });
    }
    const now = new Date();
    await expireStalePledges(now);
    // 이 사전 검사는 **사람에게 이유를 알려 주기 위한 것**이고, 초과 판매를 실제로 막는 것은
    // 아래 INSERT에 실린 재고 조건이다(fundingStockCondition). 여기서만 검사하면 읽기와 쓰기
    // 사이에 들어온 온라인 후원과 둘 다 통과해 한정 수량을 넘긴다.
    if (reward.totalQuantity !== null) {
      const status = await aggregateProjectStatus(project, now);
      const remaining = status.remaining[reward.id];
      if (remaining !== null && remaining !== undefined && quantity > remaining) {
        return res.status(409).json({ ok: false, message: `남은 수량(${remaining})을 초과합니다.` });
      }
    }
    const amounts = hasActualAmount
      ? splitFundingAmount(actualAmount)
      : computeFundingAmounts(reward.amount, quantity, additionalAmount);
    const orderNo = generateFundingOrderNo(now, true);
    // ?? 는 빈 문자열을 통과시킨다 — 관리자 폼이 비운 이메일 칸을 그대로 보내면
    // customer_email=''인 주문이 생겨 확정 메일이 빈 주소로 나가고 실패한다. 공백만 있는
    // 입력도 같다. 실제로 값이 있을 때만 쓰고, 아니면 플레이스홀더로 떨어뜨린다.
    const customerEmail = String(b.customerEmail || '').trim() || MANUAL_PLACEHOLDER_EMAIL;
    const hasRealEmail = customerEmail !== MANUAL_PLACEHOLDER_EMAIL;
    const db = getDb();
    const s = (typeof b.shipping === 'object' && b.shipping) || {};
    const orderId = randomUUID().replace(/-/g, '');
    const pledgeId = randomUUID().replace(/-/g, '');
    const epoch = (d: Date) => Math.floor(d.getTime() / 1000);
    /**
     * pledge INSERT에 **재고 조건을 실어** 온라인 경로(createFundingPledge)와 같은 원자적
     * 패턴을 쓴다. 예전엔 위 사전 검사만 하고 무조건 INSERT해서, 잔여 1개를 온라인 후원자와
     * 수기 등록이 수백 ms 차이로 동시에 집으면 둘 다 확정되고 한정 수량을 초과했다.
     * 둘 다 확정 상태라 자동 취소 대상이 아니고, aggregateProjectStatus의 remaining은
     * Math.max로 하한이 걸려 화면엔 '품절'로만 보여 초과분이 드러나지도 않았다.
     */
    const result = await db.batch([
      // orders·funding_pledges INSERT를 하나의 배치로 묶는다 — 둘 중 하나만 성공하면
      // payments 없이 paid로 남는 고아 주문이 생긴다(예약 confirm.ts의 batch 패턴).
      db.insert(orders).values({
        id: orderId,
        orderNo,
        type: 'funding',
        status: 'paid',
        customerName: b.customerName,
        customerPhone: String(b.customerPhone ?? MANUAL_PLACEHOLDER_PHONE),
        customerEmail,
        ...amounts,
        manageToken: generateManageToken(),
        // 온라인 확정과 같은 규약 — 확정 행을 쓰는 그 자리에서 센티널을 남겨야
        // deliverConfirmedEmailsOnce가 발송권을 선점할 수 있다. 플레이스홀더면 보낼 곳이
        // 없으므로 센티널도 남기지 않는다(남기면 헬스체크가 영영 울린다).
        ...(hasRealEmail ? { notificationError: SEND_PENDING } : {}),
      }),
      db.run(sql`
        INSERT INTO funding_pledges (
          id, order_id, project_slug, reward_id, reward_title, unit_amount, quantity, additional_amount,
          payment_method, hold_expires_at, paid_at, display_name_public, entry_source,
          shipping_name, shipping_phone, shipping_postcode, shipping_address1, shipping_address2, shipping_memo,
          admin_memo
        )
        SELECT ${pledgeId}, ${orderId}, ${project.slug}, ${reward.id}, ${reward.title}, ${reward.amount},
               ${quantity}, ${additionalAmount}, 'bank_transfer', ${epoch(now)}, ${epoch(now)},
               ${b.displayNamePublic === true ? 1 : 0}, 'manual',
               ${s.name ?? null}, ${s.phone ?? null}, ${s.postcode ?? null},
               ${s.address1 ?? null}, ${s.address2 ?? null}, ${s.memo ?? null},
               ${typeof b.adminMemo === 'string' ? b.adminMemo : null}
        WHERE ${fundingStockCondition(project.slug, reward, quantity, now)}
      `),
    ]);

    /**
     * libSQL batch는 트랜잭션이지만 "0행 INSERT"는 오류가 아니라 정상 커밋이라 롤백되지 않는다.
     * 그래서 진 쪽의 주문을 **온라인 경로와 같은 모양으로** 정리한다 — `status='failed'`
     * (lib/funding/service.ts createFundingPledge의 품절 처리와 같다).
     *
     * DELETE가 아닌 이유: 지우기는 실패하면 **pledge 없는 `paid` 주문**이 남는데, 그건 관리자
     * 목록이 걸러내고(listFundingOrders의 pledge EXISTS) 예약 목록도 안 싣는 상태라 어떤
     * 관리 화면에도 안 보인다. failed 마킹은 UPDATE가 실패해도 흔적이 남고, 무엇보다 같은
     * 상황을 두 경로가 같은 모양으로 남겨야 나중에 세는 사람이 헷갈리지 않는다.
     */
    if (rowsAffectedOf(result[1]) === 0) {
      await db.update(orders).set({ status: 'failed', updatedAt: now }).where(eq(orders.id, orderId));
      return res.status(409).json({ ok: false, message: '방금 마감되었습니다. 남은 수량을 다시 확인해 주세요.' });
    }
    /**
     * 확정 안내 메일을 **여기서 바로** 보낸다. 예전엔 등록만 하고 끝나서, 운영자가 관리자
     * 상세에서 '메일 재발송'을 따로 눌러야 후원자가 관리 링크(셀프 취소·명단 공개 철회)를
     * 받았다 — 그 버튼을 잊으면 후원자는 영영 못 받는다.
     *
     * 발송 실패가 등록을 되돌리지는 않는다: deliverConfirmedEmailsOnce는 예외를 삼켜
     * notification_error에 사유를 남기고, 관리자 화면·헬스체크가 그 값을 읽어 재발송을
     * 안내한다. 응답은 메일 결과와 무관하게 201이다.
     */
    if (hasRealEmail) {
      const created = await findFundingOrderByOrderNo(orderNo);
      if (created) await deliverConfirmedEmailsOnce(created);
      else console.error('[admin-funding-pledge] 방금 만든 주문을 다시 읽지 못해 확정 메일을 보내지 못했다', { orderNo });
    }
    return res.status(201).json({ ok: true, orderNo });
  }
  return res.status(405).json({ ok: false });
}
