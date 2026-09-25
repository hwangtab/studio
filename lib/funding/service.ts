import { randomBytes, randomUUID } from 'node:crypto';
import { sql, type SQL } from 'drizzle-orm';

import { getDb } from '../../db/client';
import type { FundingPledge, Order, Payment, Refund } from '../../db/schema';
import { kstDateString } from '../booking/kst';
import { generateManageToken } from '../booking/token';
import { PURGED_MARK } from '../privacy/orderRetention';
import { computeFundingAmounts, type FundingAmounts } from './amounts';
import { FUNDING_TERMS_VERSION, TOSS_HOLD_SECONDS } from './policy';
import { liveFundingOrderStatusList } from './refundable';
import type { FundingProject, FundingReward } from './projects';
import type { CreatePledgePayload } from './validation';

const toEpoch = (d: Date): number => Math.floor(d.getTime() / 1000);

/**
 * libSQL batch 결과의 rowsAffected — 판정 불가는 undefined로 돌려 "정상"으로 흘려보낸다.
 * lib/booking/confirm.ts·lib/funding/confirm.ts의 같은 이름 함수와 같은 규약이다
 * (모듈 그래프를 섞지 않으려는 의도적 복제).
 */
const rowsAffectedOf = (result: unknown): number | undefined => {
  if (!result || typeof result !== 'object' || !('rowsAffected' in result)) return undefined;
  const n = Number((result as { rowsAffected: unknown }).rowsAffected);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * 수기 등록(오프라인 현금·계좌 후원)에서 연락처 칸이 비었을 때 채워 넣는 플레이스홀더.
 * 실제 수신함도 번호도 아니다 — pages/api/admin/funding/pledges/index.ts가 넣고,
 * [id].ts의 메일 재발송이 이 값을 보고 발송을 막는다. **한 곳만 보도록 여기 모은다.**
 */
export const MANUAL_PLACEHOLDER_EMAIL = 'manual@studionol.co.kr';
export const MANUAL_PLACEHOLDER_PHONE = '-';

/**
 * 이 주문의 고객 메일 주소가 **실제로 배달될 수 없는 플레이스홀더**인가.
 *
 * 수기 등록에서 이메일 칸을 비우면 customer_email에 MANUAL_PLACEHOLDER_EMAIL이 들어간다.
 * 우리 도메인이라 lib/email/resend.ts의 UNDELIVERABLE_DOMAIN(RFC 2606 예약 도메인)에는
 * 안 걸려서 Resend 호출이 실제로 일어나고, 그 메일은 우리 수신함으로 되돌아오거나 반송된다.
 * 반송이 쌓이면 발신 도메인 평판이 깎이고 그 대가는 진짜 고객 메일이 스팸함으로 가는
 * 형태로 돌아온다.
 *
 * 가드는 원래 메일 재발송 한 곳에만 있었다 — 관리자 환불(cancel.ts notifyCancelled)과
 * 환불 요청 취소는 같은 주소로 그냥 보내고 있었다. **판정을 여기 하나로 모은다.**
 * entrySource는 보지 않는다: 배달 가능 여부를 정하는 건 주소뿐이고, 경로를 함께 보면
 * 같은 주소를 다른 경로에서 통과시키는 구멍이 다시 생긴다.
 */
export const isManualPlaceholderRecipient = (order: { customerEmail: string }): boolean =>
  order.customerEmail === MANUAL_PLACEHOLDER_EMAIL;

/**
 * 후원 **인원**을 셀 때 쓰는 신원 키(SQL 조각). 기본은 이메일+전화 조합이지만,
 * 플레이스홀더가 들어간 건은 **주문 id로 떨어뜨린다.**
 *
 * 그렇게 하지 않으면 연락처 없이 등록한 수기 후원이 전부 같은 키(`manual@…|-`)를 갖는다.
 * 오프라인 부스에서 현금으로 받은 30건이 "확정 30건 / 후원자 1명"이 되는 식이라, 숫자
 * 불일치를 없애려다 새 불일치를 들이는 꼴이 된다. 플레이스홀더는 "신원 불명"이라는
 * 뜻이지 "같은 사람"이라는 뜻이 아니므로, 합칠 근거가 없을 때는 합치지 않는다.
 *
 * 빈 문자열 전화도 같이 본다 — customerPhone은 `?? '-'`라 빈 문자열을 통과시킨다.
 *
 * **파기 표식도 같은 근거로 떨어뜨린다.** 보존 기간이 지난 주문은 이름·연락처·이메일이
 * `PURGED_MARK`로 덮이므로(`lib/privacy/orderRetention.ts`), 그대로 두면 파기된 300건이
 * 전부 `(개인정보 파기됨)|(개인정보 파기됨)` 한 키로 뭉쳐 인원이 1로 붕괴한다 — 이 주석이
 * 막으려던 수기 등록 붕괴와 글자 그대로 같은 사고다. 표식은 "신원 불명"이지 "같은 사람"이
 * 아니므로, 합칠 근거가 없을 때는 합치지 않는다.
 *
 * **표기 차이는 읽을 때 정규화한다.** SQLite `=`·`||`는 대소문자를 구분하므로 `A@b.com`과
 * `a@b.com`이 다른 사람으로 세어졌고, `010-1234-5678`과 `01012345678`도 마찬가지였다 —
 * 둘 다 인원을 부풀리는 방향이다. 저장된 값 자체는 건드리지 않고(마이그레이션 없음) SQL
 * 표현식 안에서만 소문자·구분자 제거로 맞춘다. 그래야 새로 들어오는 건과 옛 데이터가
 * 같은 기준으로 세어진다.
 *
 * 호출할 때마다 새 조각을 만든다(하나를 여러 쿼리에 돌려 쓰지 않는다).
 */
export const backerIdentitySql = () => sql`CASE
  WHEN o.customer_email = ${MANUAL_PLACEHOLDER_EMAIL}
    OR o.customer_phone = ${MANUAL_PLACEHOLDER_PHONE}
    OR o.customer_phone = ''
    OR o.customer_email = ${PURGED_MARK}
    OR o.customer_phone = ${PURGED_MARK}
  THEN o.id
  ELSE LOWER(o.customer_email) || '|' || REPLACE(REPLACE(REPLACE(o.customer_phone, '-', ''), ' ', ''), '.', '')
END`;

export const generateFundingOrderNo = (now: Date, manual = false): string =>
  `FND-${manual ? 'M-' : ''}${kstDateString(now).replace(/-/g, '')}-${randomBytes(4).toString('hex').toUpperCase()}`;

/** payments 각각의 done/failed 환불까지 물고 온다 — 환불 잔액 계산(refundable.ts)이 전 결제행을 봐야 한다. */
export type FundingPaymentWithRefunds = Payment & { refunds?: Refund[] };
export type FundingOrder = Order & { fundingPledge: FundingPledge | null; payments: FundingPaymentWithRefunds[] };

export const findFundingOrderByOrderNo = async (orderNo: string): Promise<FundingOrder | undefined> => {
  // middleware.ts가 대문자 포함 경로를 소문자로 308 리다이렉트하므로, URL에서 온
  // orderNo는 소문자로 도착할 수 있다(generateFundingOrderNo는 항상 대문자만 생성) —
  // 대문자로 정규화해 비교한다. SQLite `=`는 대소문자 구분.
  const row = await getDb().query.orders.findFirst({
    where: (t, { eq }) => eq(t.orderNo, orderNo.toUpperCase()),
    with: { fundingPledge: true, payments: { with: { refunds: true } } },
  });
  return row?.type === 'funding' ? (row as FundingOrder) : undefined;
};

export const findFundingOrderById = async (id: string): Promise<FundingOrder | undefined> => {
  const row = await getDb().query.orders.findFirst({
    where: (t, { eq }) => eq(t.id, id),
    with: { fundingPledge: true, payments: { with: { refunds: true } } },
  });
  return row?.type === 'funding' ? (row as FundingOrder) : undefined;
};

/**
 * 재고 조건이 붙은 단일 INSERT — 동시 요청은 한쪽만 rowsAffected 1.
 * remaining = totalQuantity − Σ(paid ∨ partially_refunded) − Σ(pending ∧ hold 미만료). 무제한이면 조건 없음.
 * partially_refunded를 빼먹으면 aggregateProjectStatus(품절 표시)와 이 INSERT 조건이 어긋나,
 * 화면엔 품절인데 서버는 재고가 남았다고 보고 한정 리워드를 초과 판매한다.
 */
/**
 * 한정 리워드의 재고 조건 — `INSERT ... SELECT ... WHERE <이것>` 한 문장에 실어 쓴다.
 *
 * remaining = totalQuantity − Σ(paid ∨ partially_refunded) − Σ(pending ∧ hold 미만료).
 * 무제한(totalQuantity === null)이면 조건이 없다.
 *
 * **읽고-검사-쓰기로 대체하지 말 것.** 별도 SELECT로 남은 수량을 확인한 뒤 무조건 INSERT하면
 * 그 사이에 들어온 동시 요청과 둘 다 검사를 통과해 한정 수량을 초과 판매한다. 조건을 INSERT에
 * 실으면 진 쪽이 rowsAffected 0을 받는다. 온라인 후원 경로는 처음부터 이 패턴이었는데 관리자
 * 수기 등록만 아니어서, 잔여 1개를 온라인과 수기가 동시에 집으면 둘 다 확정됐다.
 * partially_refunded를 빼먹으면 aggregateProjectStatus(품절 표시)와 어긋나 화면엔 품절인데
 * 서버는 재고가 남았다고 본다.
 */
export const fundingStockCondition = (
  projectSlug: string, reward: Pick<FundingReward, 'id' | 'totalQuantity'>, quantity: number, now: Date,
  /**
   * 세지 않을 주문번호. 자기 홀드 해제 UPDATE에만 쓴다 — 해제를 같은 batch에 넣으면서
   * "해제한 뒤에도 자리가 있는가"를 물어야 하는데, 그 시점에는 아직 해제 전이라
   * 자기 홀드가 그대로 세어진다.
   */
  excludeOrderNo?: string | null,
): SQL =>
  reward.totalQuantity === null
    ? sql`1 = 1`
    : sql`(
        SELECT COALESCE(SUM(fp.quantity), 0) FROM funding_pledges fp
        JOIN orders o ON o.id = fp.order_id
        WHERE fp.project_slug = ${projectSlug} AND fp.reward_id = ${reward.id}
          AND (o.status IN (${liveFundingOrderStatusList()}) OR (o.status = 'pending' AND fp.hold_expires_at > ${toEpoch(now)}))
          ${excludeOrderNo ? sql`AND o.order_no != ${excludeOrderNo}` : sql.empty()}
      ) + ${quantity} <= ${reward.totalQuantity}`;

export const createFundingPledge = async (
  payload: CreatePledgePayload, project: FundingProject, reward: FundingReward, now: Date,
  options: {
    /**
     * 같은 위저드 세션이 **직전에 만든 자기 주문의 주문번호**. 있으면 그 주문 하나만 만료시킨다.
     *
     * 소유 증명이다. orderNo에는 randomBytes(4) 8자리가 들어 있어 추측할 수 없고, 이 값을
     * 아는 것은 그 주문을 만든 클라이언트뿐이다(생성 응답으로만 나간다).
     */
    releaseOrderNo?: string | null;
  } = {},
): Promise<{ ok: true; orderNo: string; manageToken: string; holdExpiresAt: Date; amounts: FundingAmounts } | { ok: false; code: 'sold_out' }> => {
  const db = getDb();
  const amounts = computeFundingAmounts(reward.amount, payload.quantity, payload.additionalAmount);
  const orderNo = generateFundingOrderNo(now);
  const manageToken = generateManageToken();
  // 결제수단은 토스 하나뿐이다(무통장입금 중단, 2026-09-11) — 홀드도 한 종류다.
  const holdExpiresAt = new Date(now.getTime() + TOSS_HOLD_SECONDS * 1000);

  const orderId = randomUUID().replace(/-/g, '');
  const pledgeId = randomUUID().replace(/-/g, '');
  const s = payload.shipping;
  const stockCondition = fundingStockCondition(project.slug, reward, payload.quantity, now);
  const releaseOrderNo = options.releaseOrderNo ? options.releaseOrderNo.toUpperCase() : null;

  /**
   * 홀드 해제 · 주문 INSERT · pledge INSERT를 **한 batch**로 묶는다.
   *
   * 예전에는 주문 INSERT와 pledge INSERT를 따로 await했다. pledge INSERT가 품절 외의
   * 이유로 예외를 던지면 pledge 없는 `pending` 주문이 남는데, expireStalePledges도
   * 관리자 목록도 healthCheck도 전부 funding_pledges 조인이라 그 행은 닫히지도 보이지도
   * 않았다.
   *
   * libSQL batch는 트랜잭션이지만 **0행 INSERT는 오류가 아니라 정상 커밋**이다. 그래서
   * 품절(재고 조건 0행)로 고아가 남지 않게, 주문 INSERT에도 같은 재고 조건을 실어
   * `INSERT ... SELECT ... WHERE`로 쓴다 — 품절이면 세 문장이 전부 0행이라 사후 정리
   * (status='failed' 마킹)가 아예 필요 없다.
   *
   * 자기 홀드 해제도 같은 단위에 넣는다. 해제만 성공하고 재취득이 품절로 떨어지면
   * 후원자가 멀쩡한 자기 홀드를 잃는다. 해제 UPDATE에는 **자기 홀드를 뺀** 재고 조건을
   * 건다 — 그래야 "해제해도 다시 잡을 자리가 있을 때만 해제한다"가 된다. 자기 홀드를 뺀
   * 수량이 모자라면 빼지 않은 수량은 더 모자라므로, 뒤따르는 두 INSERT도 함께 0행이 된다.
   */
  const statements = [];
  if (releaseOrderNo) {
    /**
     * 자기 홀드 해제 — 위저드에서 되돌아가 재제출한 **자기** pending 주문을 만료시킨다.
     *
     * **소유 증명(releaseOrderNo)이 없으면 아무것도 만료시키지 않는다.**
     *
     * 예전엔 조건이 `customer_email = ? AND customer_phone = ?`뿐이었다. 두 값은 요청 본문에서
     * 오는 미검증 문자열이고(validation.ts는 형식만 본다 — 인증 코드가 없다), manageToken 같은
     * 소유 증명은 어디에도 없었다. 그래서 피해자의 이메일·전화를 아는 제3자가 같은 프로젝트로
     * 후원 요청 한 번만 보내면 피해자의 pending 주문이 expired가 됐다. 피해자가 결제창 인증을
     * 마치고 success로 돌아오면 confirm이 `acceptableStatuses = ['pending']`에 걸려
     * '이미 처리되었거나 만료된 후원입니다'로 거절하고, 풀린 한정 재고는 공격자의 INSERT가
     * 가져간다. 돈은 안 움직이지만 결제가 실패한다.
     *
     * orderNo는 randomBytes(4) 8자리를 포함해 추측할 수 없고 생성 응답으로만 나가므로,
     * 그 값을 조건에 넣는 것만으로 이 경로가 남의 주문에 닿을 수 없게 된다. 이메일·전화·
     * 프로젝트 조건은 그대로 함께 건다(방어 깊이).
     *
     * 증명이 없는 요청은 자기 홀드가 자연 만료(TOSS_HOLD_SECONDS)될 때까지 기다린다 — 한정
     * 리워드 재고가 빠듯할 때만 체감되는 비용이고, 남의 결제를 깨뜨릴 수 있는 편보다 낫다.
     *
     * 무통장(bank_transfer) pending은 여전히 제외한다. 새 무통장 후원은 만들어질 수 없지만
     * (중단 전) 남아 있는 행이 이미 입금된 건일 수 있어, 재제출만으로 만료시키면 안 된다.
     */
    statements.push(db.run(sql`
      UPDATE orders SET status = 'expired', updated_at = unixepoch()
      WHERE type = 'funding' AND status = 'pending'
        AND order_no = ${releaseOrderNo}
        AND customer_email = ${payload.customerEmail} AND customer_phone = ${payload.customerPhone}
        AND id IN (SELECT order_id FROM funding_pledges WHERE project_slug = ${project.slug} AND payment_method != 'bank_transfer')
        AND ${fundingStockCondition(project.slug, reward, payload.quantity, now, releaseOrderNo)}
    `));
  }

  statements.push(db.run(sql`
    INSERT INTO orders (id, order_no, type, customer_name, customer_phone, customer_email,
                        item_amount, vat_amount, total_amount, manage_token)
    SELECT ${orderId}, ${orderNo}, 'funding', ${payload.customerName}, ${payload.customerPhone}, ${payload.customerEmail},
           ${amounts.itemAmount}, ${amounts.vatAmount}, ${amounts.totalAmount}, ${manageToken}
    WHERE ${stockCondition}
  `));

  // terms_agreed_at을 now로 적는 근거: validateCreatePledgePayload가 termsAgreed !== true를
  // 먼저 막으므로(lib/funding/validation.ts), 이 지점에 온 요청은 동의를 마친 요청뿐이다.
  statements.push(db.run(sql`
    INSERT INTO funding_pledges (
      id, order_id, project_slug, reward_id, reward_title, unit_amount, quantity, additional_amount,
      payment_method, hold_expires_at, supporter_message, display_name_public, public_name,
      shipping_name, shipping_phone, shipping_postcode, shipping_address1, shipping_address2, shipping_memo,
      terms_agreed_at, terms_version
    )
    SELECT ${pledgeId}, ${orderId}, ${project.slug}, ${reward.id}, ${reward.title}, ${reward.amount},
           ${payload.quantity}, ${payload.additionalAmount}, ${payload.paymentMethod}, ${toEpoch(holdExpiresAt)},
           ${payload.supporterMessage ?? null}, ${payload.displayNamePublic ? 1 : 0}, ${payload.publicName ?? null},
           ${s?.name ?? null}, ${s?.phone ?? null}, ${s?.postcode ?? null}, ${s?.address1 ?? null}, ${s?.address2 ?? null}, ${s?.memo ?? null},
           ${toEpoch(now)}, ${FUNDING_TERMS_VERSION}
    WHERE ${stockCondition}
  `));

  const results = await db.batch(statements as [typeof statements[number], ...typeof statements]);

  if (rowsAffectedOf(results[results.length - 1]) === 0) return { ok: false, code: 'sold_out' };
  return { ok: true, orderNo, manageToken, holdExpiresAt, amounts };
};

/** 홀드가 지난 pending 펀딩 주문을 expired로. 상태 API·생성·관리자 목록·confirm 진입에서 lazy 호출. */
export const expireStalePledges = async (now: Date): Promise<void> => {
  await getDb().run(sql`
    UPDATE orders SET status = 'expired', updated_at = unixepoch()
    WHERE type = 'funding' AND status = 'pending'
      AND id IN (SELECT order_id FROM funding_pledges WHERE hold_expires_at < ${toEpoch(now)})
  `);
};

export interface ProjectStatus {
  raisedAmount: number;
  /**
   * 확정 후원 **건수**(COUNT(*)). 사람 수가 아니다 — 같은 사람이 두 번 후원하면 2로 센다.
   * 이름을 바꾸지 않는 이유: 공개 API 응답 필드이고 소비처가 components/funding/** 에 있다.
   * 의미를 좁히는 대신 라벨을 'N건 후원'으로 맞추고, 인원이 필요한 자리에는 아래
   * backerPersonCount를 쓴다.
   */
  backerCount: number;
  /**
   * 확정 후원 **인원**. 이메일+전화 조합으로 중복 후원자를 제거한 수라 항상 backerCount 이하.
   * 추가 필드로 둔 것은 backerCount의 의미를 바꾸면 기존 소비처가 조용히 다른 수를 그리기
   * 때문이다 — 세는 대상이 다르면 필드도 다르다.
   */
  backerPersonCount: number;
  remaining: Record<string, number | null>;
  publicBackers: string[];
  publicMessages: Array<{ name: string; message: string; at: number }>;
}

/**
 * partially_refunded는 paid와 같이 집계한다 — 리워드 일부만 환불한 건이라 후원 자체는 살아
 * 있고, 리워드 재고도 여전히 나간 상태다. 모금액은 엄밀히는 total_amount − Σ(done 환불)이
 * 정확하지만, 그 차감은 payments/refunds 조인이 필요해 이 집계(핫 경로, 상태 API가 폴링)를
 * 무겁게 만든다. 부분환불은 드물고 오차는 하향이 아니라 상향이라, 지금은 total_amount를
 * 그대로 더한다.
 */
export const aggregateProjectStatus = async (project: FundingProject, now: Date): Promise<ProjectStatus> => {
  const db = getDb();
  const totals = await db.all<{ raised: number | null; backers: number | null; persons: number | null }>(sql`
    SELECT SUM(o.total_amount) AS raised,
           -- 펀딩 '건수'. 인원이 아니다.
           COUNT(*) AS backers,
           -- 펀딩 '인원'. 신원 키는 backerIdentitySql — 수기 등록 플레이스홀더는 주문 단위로
           -- 떨어뜨린다(연락처 없는 펀딩끼리 한 사람으로 뭉치면 인원이 1로 붕괴한다).
           COUNT(DISTINCT ${backerIdentitySql()}) AS persons
    FROM orders o JOIN funding_pledges fp ON fp.order_id = o.id
    WHERE fp.project_slug = ${project.slug} AND o.status IN (${liveFundingOrderStatusList()})
  `);
  const claimed = await db.all<{ reward_id: string; qty: number }>(sql`
    SELECT fp.reward_id, SUM(fp.quantity) AS qty
    FROM funding_pledges fp JOIN orders o ON o.id = fp.order_id
    WHERE fp.project_slug = ${project.slug}
      AND (o.status IN (${liveFundingOrderStatusList()}) OR (o.status = 'pending' AND fp.hold_expires_at > ${toEpoch(now)}))
    GROUP BY fp.reward_id
  `);
  const claimedBy = new Map(claimed.map((r) => [r.reward_id, Number(r.qty)]));
  const remaining: Record<string, number | null> = {};
  for (const r of project.rewards) {
    remaining[r.id] = r.totalQuantity === null ? null : Math.max(0, r.totalQuantity - (claimedBy.get(r.id) ?? 0));
  }
  /**
   * 공개 명단. `display_name_public = 1`이 공개 동의다 — 이름과 응원 메시지를 한 단위로 받는다.
   *
   * 한동안 메시지에 판본 게이트(`terms_version = FUNDING_TERMS_VERSION`)를 걸어 뒀다. 옛 동의
   * 문서가 메시지를 "운영자에게만 보입니다"라고 약속했기 때문이다. 그 게이트가 실제로 가린
   * 것은 **운영자 본인의 후원 1건**뿐이었고, 본인이 2026-09-15에 공개를 지시해 걷어 냈다.
   * 이후 들어오는 후원은 전부 현재 문서(이름·메시지 공개를 고지한다)에 동의하므로 게이트가
   * 보호할 대상이 없다.
   *
   * 옛 문서로 동의한 후원이 다시 생길 일이 있다면(과거 데이터 이관 등) 그때는 이 자리에
   * 판본 조건을 되살려야 한다.
   *
   * **파기된 건은 아예 뺀다.** 5년이 지나 이름이 `PURGED_MARK`로 덮이면, 펀딩 주문은 영구히
   * `paid`라 그 행이 계속 이 조회에 걸린다 — BackerWall·SupporterTicker에 "(개인정보 파기됨)"이
   * 최대 100번 늘어서고, 리워드 전달 표시를 안 한 프로젝트는 응원 메시지까지 그 이름에
   * 붙는다. 계약 서명 완료 화면(`pages/[locale]/contracts/[id]/complete.tsx`)은 이름 자리를
   * 다른 문장으로 갈아 끼우는데, 거기는 **한 사람에게 말을 거는 자리**라 대체 문장이 성립한다.
   * 여기는 사람을 세워 놓는 명단이라 갈아 끼울 문장이 없다 — 표식은 그 자리에 아무도 없다는
   * 뜻이므로 명단에서 내린다. LIMIT 앞에서 걸러야 남은 100자리가 실제 이름으로 채워진다.
   *
   * **표시 이름은 `public_name`이 먼저다**(가린 이름·닉네임, lib/funding/publicName.ts).
   * 1년 파기가 그 값을 `PURGED_MARK`로 덮으면 결제자 이름이 아직 남아 있어도 명단에서
   * 내린다 — 실명을 피하려고 닉네임을 고른 사람을 파기 시점에 실명으로 되돌리면 안 된다.
   */
  const names = await db.all<{ display_name: string; supporter_message: string | null; paid_at: number | null; created_at: number }>(sql`
    SELECT COALESCE(fp.public_name, o.customer_name) AS display_name,
           fp.supporter_message,
           fp.paid_at, o.created_at
    FROM orders o JOIN funding_pledges fp ON fp.order_id = o.id
    WHERE fp.project_slug = ${project.slug} AND o.status IN (${liveFundingOrderStatusList()}) AND fp.display_name_public = 1
      AND o.customer_name <> ${PURGED_MARK}
      AND (fp.public_name IS NULL OR fp.public_name <> ${PURGED_MARK})
    ORDER BY fp.paid_at DESC, o.created_at DESC LIMIT 100
  `);
  return {
    raisedAmount: Number(totals[0]?.raised ?? 0),
    backerCount: Number(totals[0]?.backers ?? 0),
    backerPersonCount: Number(totals[0]?.persons ?? 0),
    remaining,
    publicBackers: names.map((n) => n.display_name),
    publicMessages: names
      .map((n) => ({
        name: n.display_name,
        // 공백만 남은 값은 메시지가 아니다.
        message: (n.supporter_message ?? '').trim(),
        at: Number(n.paid_at ?? n.created_at),
      }))
      .filter((m) => m.message !== ''),
  };
};

/**
 * 리워드별 **확정 판매 수량**. 개설자 모금 현황이 쓴다.
 *
 * 집계 대상은 `aggregateProjectStatus`의 모금액·건수와 **같은 집합**이다 — 같은
 * `orders ⋈ funding_pledges` 조인, 같은 `liveFundingOrderStatusList()`. 기준이 갈리면
 * 개설자가 보는 판매 수량과 모금액이 서로 설명되지 않는다.
 *
 * 같은 함수의 `claimed`(재고 표시용)와는 **일부러 다르다.** 그쪽은 아직 결제 전인 pending
 * 홀드까지 세어 한정 수량 초과 판매를 막지만, 여기는 "몇 개 팔렸나"를 말하는 자리라
 * 결제가 끝나지 않은 홀드를 세면 실제보다 많게 보인다(홀드는 대부분 만료된다).
 */
export const aggregateRewardSales = async (projectSlug: string): Promise<Record<string, number>> => {
  const rows = await getDb().all<{ reward_id: string; qty: number }>(sql`
    SELECT fp.reward_id, SUM(fp.quantity) AS qty
    FROM funding_pledges fp JOIN orders o ON o.id = fp.order_id
    WHERE fp.project_slug = ${projectSlug} AND o.status IN (${liveFundingOrderStatusList()})
    GROUP BY fp.reward_id
  `);
  return Object.fromEntries(rows.map((r) => [r.reward_id, Number(r.qty)]));
};
