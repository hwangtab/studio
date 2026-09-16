/**
 * 구독(빌링키 자동결제)의 서버 기반.
 *
 * 돈이 오가는 규칙은 전부 여기 있고, 화면·관리자·메일·cron 라우트는 이 함수들만 부른다.
 * 회차마다 orders 1건 + payments 1건을 남기는 것이 핵심 설계다(스펙 §4) — 기존 관리자
 * 목록·웹훅·환불 도구가 구독 회차를 특별 취급 없이 그대로 다룬다.
 */
import { and, asc, desc, eq, inArray, isNull, lte, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import {
  billingKeys,
  orders,
  payments,
  subscriptionPayments,
  subscriptions,
  type BillingKey,
  type Contract,
  type Subscription,
  type SubscriptionPayment,
} from '../../db/schema';
import { formatPriceAmount, getArtistSupportTier } from '../../data/pricing';
import { getSupportedArtist } from '../../data/artists';
import { rowsAffectedOf } from '../booking/confirm';
import { subscriptionAmounts, subscriptionOrderName, type SubscriptionKind } from './amounts';
import {
  computeNextBillingAt,
  cycleYmOf,
  MAX_CHARGE_ATTEMPTS,
  periodFor,
  retryAtFor,
} from './schedule';
import { sendSubscriptionOperatorAlert } from './email';
import { chargeBillingKey, fetchPaymentByOrderId, issueBillingKey, type TossPayment } from './toss-billing';
import {
  generateCustomerKey,
  generateManageToken,
  generateOrderNo,
  generateSetupToken,
  isTokenMatch,
  SETUP_TOKEN_TTL_SECONDS,
} from './token';

export type SubscriptionStatus = Subscription['status'];
export type ChargeReason = 'scheduled' | 'retry' | 'manual' | 'first';

/** 카드 등록 링크가 유효한 상태들 — 이미 끝난 구독의 링크로는 카드를 못 넣는다. */
const SETUP_ALLOWED_STATUSES: SubscriptionStatus[] = ['pending_card', 'active', 'past_due', 'paused'];
/** 같은 계약에 구독을 새로 못 만드는 상태들(진행 중인 청구가 이미 있다). */
const OCCUPYING_STATUSES: SubscriptionStatus[] = ['pending_card', 'active', 'past_due', 'paused'];
/**
 * 승인 결과를 반영하며 `active`로 전이시켜도 되는 상태들 — **해지·종료는 되살리지 않는다.**
 *
 * 승인은 우리가 요청한 시점과 기록하는 시점이 떨어져 있다(웹훅 복구는 수분~수시간, 청구
 * 왕복도 1~3초). 그 사이에 고객이 해지를 누를 수 있는데, 상태를 보지 않고 `active`로
 * 덮어쓰면 해지가 조용히 사라지고 nextBillingAt까지 다음 달로 다시 잡혀 **해지한 고객의
 * 카드를 다음 cron이 또 긁는다**(endsAt은 남지만 endExpiredSubscriptions는 `status =
 * 'cancelled'`만 보므로 더 이상 닫지도 못한다). 회차 기록(orders·subscriptionPayments)은
 * 그대로 paid로 반영하고 — 돈은 실제로 들어왔다 — 구독 전이만 건너뛴 뒤 로그로 알린다.
 */
const REACTIVATABLE_STATUSES: SubscriptionStatus[] = ['pending_card', 'active', 'past_due', 'paused'];

const toEpoch = (d: Date): number => Math.floor(d.getTime() / 1000);

/**
 * 해지·종료된 구독에 승인이 뒤늦게 도착했다 — 운영자에게 **메일로** 알린다.
 *
 * 이 상태는 고객이 한 달치를 냈는데 이용기간은 전진하지 않은 것이라 환불 기한이 도는 건이다.
 * console.error만 남기면 Vercel 런타임 로그에만 쌓여 사실상 아무도 못 본다 — 같은 형태의
 * 사고(무통장 환불 요청이 어디에도 안 보이던 문제)를 PR #59에서 이미 한 번 고쳤다.
 * 메일 실패도 삼키지 않고 notificationError에 남긴다(다른 발송 경로와 같은 관례).
 */
const alertLateApproval = async (
  subscription: Subscription,
  detail: string,
  now: Date,
): Promise<void> => {
  const notificationError = await sendSubscriptionOperatorAlert(subscription, 'late_approval', detail);
  if (!notificationError) return;
  console.error('[billing] 뒤늦은 승인 운영자 알림 발송 실패', { subscriptionId: subscription.id, notificationError });
  try {
    await getDb().update(subscriptions).set({ notificationError, updatedAt: now }).where(eq(subscriptions.id, subscription.id));
  } catch (error) {
    console.error('[billing] notificationError 기록 실패', { subscriptionId: subscription.id, error });
  }
};

// ─── 생성 ───────────────────────────────────────────────────────────────────

export interface CreateSubscriptionInput {
  kind: SubscriptionKind;
  contractId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  billingDay: number;
  /** 아티스트 구독(kind='artist-support')에서만. 둘 다 필수다. */
  artistSlug?: string;
  tierId?: string;
  /** 후원자 명단 표시명·동의. 동의 없으면 명단에 싣지 않는다. */
  displayName?: string;
  displayConsent?: boolean;
}

export type CreateSubscriptionResult =
  | { ok: true; id: string; setupToken: string; manageToken: string }
  | {
      ok: false;
      code: 'already_exists' | 'contract_required' | 'invalid_billing_day' | 'artist_required' | 'artist_not_open' | 'invalid_tier';
    };

export const createSubscription = async (
  input: CreateSubscriptionInput,
  now: Date,
): Promise<CreateSubscriptionResult> => {
  if (!Number.isInteger(input.billingDay) || input.billingDay < 1 || input.billingDay > 31) {
    return { ok: false, code: 'invalid_billing_day' };
  }
  // 연습실 구독의 청구 근거는 임대차 계약이다. 계약 없이 만들면 금액·결제일·해지 절차의
  // 출처가 사라지고, 아래 중복 검사도 무력해진다("한 계약에 구독 하나"를 셀 대상이 없다).
  if (input.kind === 'practice-room' && !input.contractId) return { ok: false, code: 'contract_required' };

  // 아티스트 구독은 "누구를, 얼마에"가 없으면 성립하지 않는다. 아티스트가 목록에 없거나
  // 후원을 닫아 둔 팀(supportActive=false)이면 페이지에 카드가 없으니 정상 경로로는 못 오지만,
  // API를 직접 부르면 올 수 있다 — 서버가 다시 거른다.
  if (input.kind === 'artist-support') {
    if (!input.artistSlug) return { ok: false, code: 'artist_required' };
    const artist = getSupportedArtist(input.artistSlug);
    if (!artist) return { ok: false, code: 'artist_required' };
    if (!artist.supportActive) return { ok: false, code: 'artist_not_open' };
    if (!input.tierId || !getArtistSupportTier(input.tierId)) return { ok: false, code: 'invalid_tier' };
  }

  const db = getDb();

  if (input.contractId) {
    const existing = await db.query.subscriptions.findFirst({
      where: (t, { and: all, eq: is, inArray: within }) =>
        all(is(t.contractId, input.contractId!), within(t.status, OCCUPYING_STATUSES)),
    });
    if (existing) return { ok: false, code: 'already_exists' };
  }

  const amounts = subscriptionAmounts(input.kind, input.tierId);
  // 위 검증을 통과했으면 null이 나올 수 없다 — 나온다면 등급 목록과 검증이 어긋난 것이라 멈춘다.
  if (!amounts) return { ok: false, code: 'invalid_tier' };
  const setupToken = generateSetupToken();
  const manageToken = generateManageToken();

  const [row] = await db
    .insert(subscriptions)
    .values({
      kind: input.kind,
      contractId: input.contractId ?? null,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      customerKey: generateCustomerKey(),
      itemAmount: amounts.itemAmount,
      vatAmount: amounts.vatAmount,
      totalAmount: amounts.totalAmount,
      billingDay: input.billingDay,
      status: 'pending_card',
      setupToken,
      setupTokenExpiresAt: new Date(now.getTime() + SETUP_TOKEN_TTL_SECONDS * 1000),
      setupMode: 'initial',
      manageToken,
      artistSlug: input.kind === 'artist-support' ? input.artistSlug! : null,
      tierId: input.kind === 'artist-support' ? input.tierId! : null,
      displayName: input.displayName?.trim() || null,
      displayConsent: input.kind === 'artist-support' ? Boolean(input.displayConsent) : false,
    })
    .returning({ id: subscriptions.id });

  return { ok: true, id: row.id, setupToken, manageToken };
};

// ─── 조회 ───────────────────────────────────────────────────────────────────

export const findSubscriptionById = async (id: string): Promise<Subscription | undefined> =>
  getDb().query.subscriptions.findFirst({ where: (t, { eq: is }) => is(t.id, id) });

/**
 * 카드 등록 링크 검증. 토큰은 1회성(발급 성공 시 비운다) + 7일 만료라, 값이 비어 있으면
 * "이미 쓴 링크"다 — 만료와 구분해 안내해야 고객이 재발송을 요청할 수 있다.
 */
export const findSubscriptionForSetup = async (
  id: string,
  token: string,
  now: Date,
): Promise<
  { ok: true; subscription: Subscription } | { ok: false; code: 'not_found' | 'used' | 'expired' | 'invalid_state' }
> => {
  const subscription = await findSubscriptionById(id);
  if (!subscription) return { ok: false, code: 'not_found' };
  if (!subscription.setupToken) return { ok: false, code: 'used' };
  if (!isTokenMatch(subscription.setupToken, token)) return { ok: false, code: 'not_found' };
  if (subscription.setupTokenExpiresAt && subscription.setupTokenExpiresAt.getTime() <= now.getTime())
    return { ok: false, code: 'expired' };
  if (!SETUP_ALLOWED_STATUSES.includes(subscription.status)) return { ok: false, code: 'invalid_state' };
  return { ok: true, subscription };
};

/** 고객 관리 링크(상시 토큰). 만료도 1회성도 없다 — orders.manageToken과 같은 성질. */
export const findSubscriptionForManage = async (
  id: string,
  token: string,
): Promise<{ ok: true; subscription: Subscription } | { ok: false; code: 'not_found' }> => {
  const subscription = await findSubscriptionById(id);
  if (!subscription) return { ok: false, code: 'not_found' };
  if (!isTokenMatch(subscription.manageToken, token)) return { ok: false, code: 'not_found' };
  return { ok: true, subscription };
};

export interface SubscriptionDetails {
  subscription: Subscription;
  /** 현재 유효한 카드(revoke되지 않은 것). 없으면 아직 등록 전이거나 교체 중. */
  billingKey: BillingKey | null;
  /** 회차 이력 — 최신 시도가 앞. */
  payments: SubscriptionPayment[];
  contract: Pick<Contract, 'id' | 'title' | 'roomNumber' | 'status' | 'paymentDay'> | null;
}

export const getSubscriptionWithDetails = async (id: string): Promise<SubscriptionDetails | null> => {
  const db = getDb();
  const subscription = await db.query.subscriptions.findFirst({
    where: (t, { eq: is }) => is(t.id, id),
    with: {
      billingKeys: { where: (t, { isNull: nul }) => nul(t.revokedAt), orderBy: (t) => [desc(t.issuedAt)] },
      subscriptionPayments: { orderBy: (t) => [desc(t.attemptedAt)] },
      contract: true,
    },
  });
  if (!subscription) return null;
  const { billingKeys: keys, subscriptionPayments: history, contract, ...rest } = subscription;
  return {
    subscription: rest as Subscription,
    billingKey: keys[0] ?? null,
    payments: history,
    contract: contract
      ? {
          id: contract.id,
          title: contract.title,
          roomNumber: contract.roomNumber,
          status: contract.status,
          paymentDay: contract.paymentDay,
        }
      : null,
  };
};

// ─── 카드 등록 ──────────────────────────────────────────────────────────────

export type CompleteCardSetupResult =
  | { ok: true; status: SubscriptionStatus; charged: boolean; paymentKey?: string }
  | {
      ok: false;
      code: 'not_found' | 'used' | 'expired' | 'invalid_state' | 'customer_key_mismatch' | 'issue_failed' | 'first_charge_failed';
      message: string;
    };

export const completeCardSetup = async (
  input: { id: string; token: string; authKey: string; customerKey: string },
  now: Date,
): Promise<CompleteCardSetupResult> => {
  const found = await findSubscriptionForSetup(input.id, input.token, now);
  if (!found.ok) return { ok: false, code: found.code, message: '카드 등록 링크를 확인해 주세요.' };
  const subscription = found.subscription;

  // customerKey는 우리가 만들어 SDK에 넘긴 값이 그대로 돌아온 것이다. 다르면 다른 구독의
  // 콜백이 섞였거나 조작된 것이므로, 남의 구독에 카드를 붙이기 전에 멈춘다.
  if (subscription.customerKey !== input.customerKey)
    return { ok: false, code: 'customer_key_mismatch', message: '카드 등록 정보가 일치하지 않습니다.' };

  const issued = await issueBillingKey({ authKey: input.authKey, customerKey: input.customerKey });
  if (!issued.ok) {
    console.error('[billing] 빌링키 발급 실패', { subscriptionId: subscription.id, code: issued.code, message: issued.message });
    return { ok: false, code: 'issue_failed', message: '카드 등록에 실패했습니다. 다른 카드로 다시 시도해 주세요.' };
  }

  const db = getDb();
  // 기존 키는 지우지 않고 revoke만 한다 — 과거 회차가 어떤 카드로 결제됐는지가 근거로 남아야 한다.
  await db
    .update(billingKeys)
    .set({ revokedAt: now })
    .where(and(eq(billingKeys.subscriptionId, subscription.id), isNull(billingKeys.revokedAt)));

  const [key] = await db
    .insert(billingKeys)
    .values({
      subscriptionId: subscription.id,
      billingKey: issued.billingKey,
      cardCompany: issued.card.company ?? null,
      cardNumberMasked: issued.card.numberMasked ?? null,
      cardType: issued.card.cardType ?? null,
      issuedAt: now,
      rawResponse: JSON.stringify(issued.raw),
    })
    .returning({ id: billingKeys.id });

  // setupToken 무효화는 발급 성공 시점에 한다(1회성, 스펙 §9). 첫 결제가 실패해도 되살리지
  // 않는다 — 키는 이미 붙었고, 다시 시도할 사람은 관리자가 새 링크를 내주면 된다.
  const wasChangeMode = subscription.setupMode === 'change';
  await db
    .update(subscriptions)
    .set({ billingKeyId: key.id, setupToken: null, setupTokenExpiresAt: null, setupMode: 'initial', updatedAt: now })
    .where(eq(subscriptions.id, subscription.id));

  // 카드 교체는 결제하지 않는다. 여기서 chargeCycle을 부르면 카드만 바꾸려던 고객에게
  // 한 달치가 더 청구된다(schema의 setupMode 주석).
  if (wasChangeMode) return { ok: true, status: subscription.status, charged: false };

  const charged = await chargeCycle(subscription.id, now, { reason: 'first' });
  if (!charged.ok) {
    return {
      ok: false,
      code: 'first_charge_failed',
      message: charged.message ?? '카드는 등록되었으나 첫 결제가 승인되지 않았습니다. 다른 카드로 다시 시도해 주세요.',
    };
  }
  return { ok: true, status: charged.status, charged: true, paymentKey: charged.paymentKey };
};

// ─── 회차 결제 ──────────────────────────────────────────────────────────────

export interface ChargeCycleResult {
  ok: boolean;
  status: SubscriptionStatus;
  paymentKey?: string;
  tossCode?: string;
  message?: string;
  cycleYm?: string;
  attempt?: number;
}

/**
 * 멱등키에 attempt가 들어가는 이유.
 *
 * 토스는 같은 멱등키의 재요청에 **최초 응답을 그대로 재사용한다**. 회차(cycleYm)까지만
 * 키에 넣으면 D+1 재시도가 D+0의 실패 응답을 replay해 카드가 정상이어도 영영 결제되지
 * 않는다. 반대로 attempt를 빼먹지 않는 한, 같은 시도의 재전송(타임아웃 후 재호출)은
 * 여전히 replay되어 이중 청구를 막는다.
 */
export const chargeIdempotencyKey = (subscriptionId: string, cycleYm: string, attempt: number): string =>
  `billing:${subscriptionId}:${cycleYm}:${attempt}`;

export const chargeCycle = async (
  subscriptionId: string,
  now: Date,
  options: { reason: ChargeReason },
): Promise<ChargeCycleResult> => {
  const db = getDb();
  const subscription = await findSubscriptionById(subscriptionId);
  if (!subscription) return { ok: false, status: 'ended', message: '구독을 찾을 수 없습니다.' };

  if (subscription.status === 'cancelled' || subscription.status === 'ended')
    return { ok: false, status: subscription.status, message: '해지된 구독입니다.' };
  // paused는 자동 청구 대상이 아니다(재시도 한도를 이미 소진했다). 관리자 수동 결제와
  // 카드 재등록 직후의 첫 결제만 통과시킨다.
  if (subscription.status === 'paused' && options.reason !== 'manual' && options.reason !== 'first')
    return { ok: false, status: subscription.status, message: '정지된 구독입니다.' };

  const key = await db.query.billingKeys.findFirst({
    where: (t, { and: all, eq: is, isNull: nul }) => all(is(t.subscriptionId, subscriptionId), nul(t.revokedAt)),
    orderBy: (t) => [desc(t.issuedAt)],
  });
  if (!key) return { ok: false, status: subscription.status, message: '등록된 카드가 없습니다.' };

  // 새 청구 전에 "응답을 못 받은 지난 시도"를 먼저 대사한다. NETWORK_ERROR로 끝난 회차는
  // orders가 pending인 채 남는데(위 규칙), 실제로는 토스가 승인했을 수 있다. 그걸 확인하지
  // 않고 새 회차를 내면 이중 청구다. cron만이 아니라 관리자 수동 결제·카드 재등록 첫 결제
  // 등 chargeCycle을 부르는 모든 경로가 같은 위험을 지므로, 대사는 호출부가 아니라 여기서 한다.
  const unresolved = await db
    .select({ orderNo: orders.orderNo, orderId: orders.id })
    .from(subscriptionPayments)
    .innerJoin(orders, eq(orders.id, subscriptionPayments.orderId))
    .where(and(eq(subscriptionPayments.subscriptionId, subscriptionId), eq(orders.status, 'pending')));
  for (const row of unresolved) {
    const refetched = await fetchPaymentByOrderId(row.orderNo);
    if (!refetched.ok) {
      // 재조회조차 안 되면 청구를 보류한다 — 모르는 채로 돈을 또 걷는 쪽이 훨씬 나쁘다.
      console.error('[billing] pending 회차 재조회 실패 — 청구 보류', {
        subscriptionId,
        orderNo: row.orderNo,
        code: refetched.code,
        message: refetched.message,
      });
      return {
        ok: false,
        status: subscription.status,
        tossCode: refetched.code,
        message: '이전 결제 상태를 확인하지 못해 청구를 보류했습니다. 잠시 후 다시 시도해 주세요.',
      };
    }
    if (refetched.payment.status === 'DONE') {
      await reconcileSubscriptionPaymentFromToss(refetched.payment, now);
    } else {
      // 토스도 승인하지 않았다(만료·취소·거절) — 이제야 failed로 확정해도 안전하다.
      await db.run(
        sql`UPDATE orders SET status = 'failed', updated_at = unixepoch() WHERE id = ${row.orderId} AND status = 'pending'`,
      );
    }
  }
  if (unresolved.length > 0) {
    // 대사가 회차를 이미 결제 완료로 되돌렸으면 다음 결제일이 미래로 밀려 있다 — 그러면 지금
    // 걷을 것이 없다(첫 결제는 예외: 그 회차가 곧 이번 청구다).
    const after = await findSubscriptionById(subscriptionId);
    if (after && after.status === 'active' && after.nextBillingAt && after.nextBillingAt.getTime() > now.getTime())
      return { ok: true, status: 'active', cycleYm: cycleYmOf(now) };
  }

  const cycleYm = cycleYmOf(now);
  const prior = await db
    .select({ attempt: subscriptionPayments.attempt })
    .from(subscriptionPayments)
    .where(and(eq(subscriptionPayments.subscriptionId, subscriptionId), eq(subscriptionPayments.cycleYm, cycleYm)));
  // 같은 달에 성공한 회차가 이미 있으면 다시 청구하지 않는다 — cron이 하루에 두 번 돌거나
  // 관리자가 수동 결제를 겹쳐 눌렀을 때의 이중 청구를 애플리케이션 층에서 먼저 막는다.
  const paid = await db.query.subscriptionPayments.findFirst({
    where: (t, { and: all, eq: is }) =>
      all(is(t.subscriptionId, subscriptionId), is(t.cycleYm, cycleYm), is(t.status, 'paid')),
  });
  if (paid)
    return { ok: true, status: subscription.status, paymentKey: paid.paymentKey ?? undefined, cycleYm, attempt: paid.attempt };

  const attempt = prior.length + 1;
  const orderNo = generateOrderNo(now);
  const orderName = subscriptionOrderName(subscription);

  const [order] = await db
    .insert(orders)
    .values({
      orderNo,
      type: 'subscription',
      customerName: subscription.customerName,
      customerPhone: subscription.customerPhone,
      customerEmail: subscription.customerEmail,
      itemAmount: subscription.itemAmount,
      vatAmount: subscription.vatAmount,
      totalAmount: subscription.totalAmount,
      manageToken: generateManageToken(),
    })
    .returning({ id: orders.id });

  const [attemptRow] = await db
    .insert(subscriptionPayments)
    .values({
      subscriptionId,
      orderId: order.id,
      cycleYm,
      attempt,
      amount: subscription.totalAmount,
      status: 'pending',
      attemptedAt: now,
    })
    .returning({ id: subscriptionPayments.id });

  const toss = await chargeBillingKey({
    billingKey: key.billingKey,
    customerKey: subscription.customerKey,
    amount: subscription.totalAmount,
    orderId: orderNo,
    orderName: `${orderName} (${cycleYm})`,
    customerEmail: subscription.customerEmail,
    customerName: subscription.customerName,
    idempotencyKey: chargeIdempotencyKey(subscriptionId, cycleYm, attempt),
  });

  if (!toss.ok) {
    // NETWORK_ERROR·CONFIG_ERROR는 "거절당했다"가 아니라 "물어보지도 못했다"이다. 실제로는
    // 승인됐을 수 있으므로 orders를 failed로 확정하지 않는다 — failed를 찍으면 뒤늦게 오는
    // 웹훅 DONE 복구가 막힌다(lib/booking/confirm.ts의 같은 규칙, #42).
    const isInternalError = toss.code === 'NETWORK_ERROR' || toss.code === 'CONFIG_ERROR';
    if (isInternalError) {
      console.error('[billing] 빌링 결제 응답 없음 — orders는 pending 유지, 토스 재조회 필요', {
        subscriptionId,
        orderNo,
        cycleYm,
        attempt,
        code: toss.code,
        message: toss.message,
      });
    } else {
      await db.run(
        sql`UPDATE orders SET status = 'failed', updated_at = unixepoch() WHERE id = ${order.id} AND status = 'pending'`,
      );
    }
    console.error('[billing] 빌링 결제 거부', {
      subscriptionId,
      orderNo,
      cycleYm,
      attempt,
      tossCode: toss.code,
      tossMessage: toss.message,
    });

    await db
      .update(subscriptionPayments)
      .set({ status: 'failed', tossCode: toss.code, tossMessage: toss.message })
      .where(eq(subscriptionPayments.id, attemptRow.id));

    // 첫 결제 실패는 구독이 시작되지 않은 것이다 — 재시도 일정을 걸지 않고 pending_card로
    // 남겨 고객이 다른 카드로 다시 등록하게 한다(스펙 §6).
    if (options.reason === 'first') {
      return { ok: false, status: subscription.status, tossCode: toss.code, message: toss.message, cycleYm, attempt };
    }

    const retryAt = attempt >= MAX_CHARGE_ATTEMPTS ? null : retryAtFor(now, attempt);
    const nextStatus: SubscriptionStatus = retryAt ? 'past_due' : 'paused';
    await db
      .update(subscriptions)
      .set({ status: nextStatus, nextBillingAt: retryAt ?? subscription.nextBillingAt, updatedAt: now })
      .where(eq(subscriptions.id, subscriptionId));

    return { ok: false, status: nextStatus, tossCode: toss.code, message: toss.message, cycleYm, attempt };
  }

  const approved = toss.payment;
  const period = periodFor(now, subscription.billingDay);

  const batchResults = await db.batch([
    // payments가 맨 앞 — paymentKey unique 위반이 동시 실행(cron 중복 기동)의 두 번째를
    // batch 전체 실패로 만들어 절반만 쓰인 상태를 남기지 않는다(confirm.ts와 같은 순서).
    db.insert(payments).values({
      orderId: order.id,
      paymentKey: approved.paymentKey,
      method: approved.method ?? null,
      approvedAt: approved.approvedAt ? new Date(approved.approvedAt) : null,
      receiptUrl: approved.receipt?.url ?? null,
      rawResponse: JSON.stringify(approved),
    }),
    db.update(orders).set({ status: 'paid', updatedAt: now }).where(and(eq(orders.id, order.id), eq(orders.status, 'pending'))),
    db
      .update(subscriptionPayments)
      .set({ status: 'paid', paymentKey: approved.paymentKey, paidAt: now, tossCode: null, tossMessage: null })
      .where(eq(subscriptionPayments.id, attemptRow.id)),
    db
      .update(subscriptions)
      .set({
        status: 'active',
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        nextBillingAt: computeNextBillingAt(now, subscription.billingDay),
        updatedAt: now,
      })
      // 진입부(위)의 cancelled/ended 검사는 **읽기 시점 한 번**이다. 승인 왕복(1~3초) 사이에
      // 들어온 셀프 해지를 여기서 되돌리지 않도록 상태를 다시 건다.
      .where(and(eq(subscriptions.id, subscriptionId), inArray(subscriptions.status, REACTIVATABLE_STATUSES))),
  ]);

  // orders 전이가 0행이면 승인 왕복 사이에 주문이 pending을 벗어난 것이다. 구독 회차는
  // 슬롯을 잡지 않아 자동 취소 대상은 아니지만(예약과 달리 남에게 피해가 없다) 돈이 들어온
  // 주문의 상태가 어긋난 것이므로 반드시 남긴다 — 관리자 미정합 목록의 단서가 된다.
  if (rowsAffectedOf(batchResults[1]) === 0) {
    console.error('[billing] 결제 승인 후 orders 전이 0행 — 수동 대사 필요', {
      subscriptionId,
      orderNo,
      paymentKey: approved.paymentKey,
    });
  }

  // 구독 전이가 0행이면 승인 왕복 사이에 해지·종료가 들어온 것이다. 돈은 들어왔고 회차는
  // paid로 남았으므로 환불 여부는 사람이 판단해야 한다 — 되살리지 않고 알린다.
  if (rowsAffectedOf(batchResults[3]) === 0) {
    console.error('[billing] 승인 후 구독 상태 전이 0행 — 해지·종료된 구독일 수 있다, 환불 판단 필요', {
      subscriptionId,
      orderNo,
      paymentKey: approved.paymentKey,
      cycleYm,
    });
    const current = await findSubscriptionById(subscriptionId);
    await alertLateApproval(
      current ?? subscription,
      [
        `${cycleYm}분 ${formatPriceAmount(subscription.totalAmount)}원이 승인됐지만 구독 상태가 ${current?.status ?? '알 수 없음'}이라 이용기간을 전진시키지 않았습니다.`,
        '승인 왕복 중에 해지가 들어온 것으로 보입니다 — 환불 여부를 판단해 주세요.',
        `주문번호 ${orderNo} / paymentKey ${approved.paymentKey}`,
      ].join('\n'),
      now,
    );
    return { ok: true, status: current?.status ?? subscription.status, paymentKey: approved.paymentKey, cycleYm, attempt };
  }

  return { ok: true, status: 'active', paymentKey: approved.paymentKey, cycleYm, attempt };
};

// ─── 상태 전이 ──────────────────────────────────────────────────────────────

export type MutateResult =
  | { ok: true; subscription: Subscription }
  | { ok: false; code: 'not_found' | 'invalid_state' };

/**
 * 해지. 이미 결제한 달은 기간 끝까지 쓴다(선불) — 즉시 환불하지 않는다. 연습실의 일할
 * 반환·위약금은 계약 절차라 코드가 관여하지 않는다(스펙 §8).
 */
export const cancelSubscription = async (
  id: string,
  input: { requestedBy: 'customer' | 'admin'; reason: string },
  now: Date,
): Promise<MutateResult> => {
  const db = getDb();
  const subscription = await findSubscriptionById(id);
  if (!subscription) return { ok: false, code: 'not_found' };
  if (subscription.status === 'cancelled' || subscription.status === 'ended') return { ok: false, code: 'invalid_state' };

  const endsAt = subscription.currentPeriodEnd ?? now;
  const [row] = await db
    .update(subscriptions)
    .set({
      status: 'cancelled',
      cancelledAt: now,
      cancelReason: `${input.requestedBy}: ${input.reason}`,
      endsAt,
      // 해지 후에는 어떤 경로로도 청구되지 않게 예약을 비운다(listDueSubscriptions는
      // status로도 거르지만, 두 겹으로 막는다).
      nextBillingAt: null,
      updatedAt: now,
    })
    .where(eq(subscriptions.id, id))
    .returning();
  return { ok: true, subscription: row };
};

/** 관리자 일시정지 — 청구만 멈춘다(카드는 그대로). */
export const pauseSubscription = async (id: string, now: Date): Promise<MutateResult> => {
  const db = getDb();
  const subscription = await findSubscriptionById(id);
  if (!subscription) return { ok: false, code: 'not_found' };
  if (subscription.status !== 'active' && subscription.status !== 'past_due') return { ok: false, code: 'invalid_state' };
  const [row] = await db
    .update(subscriptions)
    .set({ status: 'paused', updatedAt: now })
    .where(eq(subscriptions.id, id))
    .returning();
  return { ok: true, subscription: row };
};

/**
 * 재개. nextBillingAt을 now로 당겨 다음 cron이 즉시 청구한다 — 정지 기간의 미납분을
 * 여기서 몰아 청구하지는 않는다(밀린 달을 한꺼번에 긁으면 고객이 예상 못 한 금액을 맞는다).
 */
export const resumeSubscription = async (id: string, now: Date): Promise<MutateResult> => {
  const db = getDb();
  const subscription = await findSubscriptionById(id);
  if (!subscription) return { ok: false, code: 'not_found' };
  if (subscription.status !== 'paused') return { ok: false, code: 'invalid_state' };
  const [row] = await db
    .update(subscriptions)
    .set({ status: 'active', nextBillingAt: now, updatedAt: now })
    .where(eq(subscriptions.id, id))
    .returning();
  return { ok: true, subscription: row };
};

/**
 * 카드 교체 링크 발급.
 *
 * setupMode는 **상태에 따라 갈린다.** 이미 카드가 붙어 청구가 도는 구독(active·past_due·
 * paused)은 'change' — 등록이 끝나도 결제하지 않는다(카드만 바꾸려던 고객에게 한 달치가
 * 더 나가면 안 된다, schema의 setupMode 주석).
 *
 * 그런데 pending_card는 **첫 결제를 아직 한 번도 못 한 구독**이다(첫 결제 거절은 재시도
 * 일정을 걸지 않고 pending_card로 남긴다 — chargeCycle의 reason==='first' 분기). 여기에
 * 'change'를 걸면 고객이 새 카드를 정상 등록해도 completeCardSetup이 chargeCycle을 부르지
 * 않고 끝나, 카드는 붙었고 고객은 '등록 완료' 화면을 봤는데 status는 pending_card·
 * nextBillingAt은 null이라 **첫 달치가 조용히 미청구로 남는다**(listDueSubscriptions가
 * 영원히 집지 않고, 관리자 UI의 '결제' 버튼도 pending_card를 제외한다). 관리자 상세
 * 화면에는 pending_card에서도 '카드 변경 링크 발급' 버튼이 떠 있어 실제로 밟히는 길이다.
 *
 * 그래서 pending_card에는 'initial'을 준다 — 등록 직후 첫 결제가 정상으로 돈다.
 * 이중 청구 걱정은 없다: chargeCycle이 같은 회차에 성공한 기록이 있으면 다시 걷지 않는다.
 */
export const issueCardChangeToken = async (
  id: string,
  now: Date,
): Promise<
  // setupMode를 함께 돌려준다 — 호출부가 이 값으로 안내 메일 문구를 고른다. 발급 **전에**
  // 읽어 둔 구독 행에는 옛 값이 들어 있어서, 그걸 믿으면 'change' 링크에 "즉시 첫 달치가
  // 결제됩니다"라는 없는 청구 예고가 나간다.
  { ok: true; setupToken: string; setupMode: 'initial' | 'change' } | { ok: false; code: 'not_found' | 'invalid_state' }
> => {
  const db = getDb();
  const subscription = await findSubscriptionById(id);
  if (!subscription) return { ok: false, code: 'not_found' };
  if (!SETUP_ALLOWED_STATUSES.includes(subscription.status)) return { ok: false, code: 'invalid_state' };
  const setupToken = generateSetupToken();
  const setupMode = subscription.status === 'pending_card' ? 'initial' : 'change';
  await db
    .update(subscriptions)
    .set({
      setupToken,
      setupTokenExpiresAt: new Date(now.getTime() + SETUP_TOKEN_TTL_SECONDS * 1000),
      setupMode,
      updatedAt: now,
    })
    .where(eq(subscriptions.id, id));
  return { ok: true, setupToken, setupMode };
};

/** cron이 이번 회차에 청구할 구독들. paused는 자동 청구 대상이 아니다. */
export const listDueSubscriptions = async (now: Date): Promise<Subscription[]> =>
  getDb()
    .select()
    .from(subscriptions)
    .where(
      and(
        inArray(subscriptions.status, ['active', 'past_due']),
        lte(subscriptions.nextBillingAt, now),
      ),
    )
    .orderBy(asc(subscriptions.nextBillingAt));

/** 해지 예정일이 지난 구독을 ended로 닫는다. cron이 청구 전에 부른다. */
export const endExpiredSubscriptions = async (now: Date): Promise<number> => {
  const result = await getDb().run(sql`
    UPDATE subscriptions SET status = 'ended', updated_at = unixepoch()
    WHERE status = 'cancelled' AND ends_at IS NOT NULL AND ends_at <= ${toEpoch(now)}
  `);
  return rowsAffectedOf(result) ?? 0;
};

// ─── cron 동시 실행 방어 / 웹훅 대사 ────────────────────────────────────────

/**
 * cron 진입 시 이번 회차를 이 실행이 "가져간다"는 표시.
 *
 * chargeCycle 자체는 이미 이중 청구를 두 겹으로 막는다 — subscriptionPayments의
 * (subscriptionId, cycleYm, attempt) 유니크 인덱스가 있고, 그 INSERT가 토스 호출보다
 * **먼저** 일어난다(chargeCycle 본문). 그래서 같은 회차를 향해 동시에 두 프로세스가
 * 들어와도 토스에 결제 요청이 두 번 나가지는 않는다 — 뒤진 쪽은 INSERT에서 유니크
 * 위반으로 죽고, 토스 호출까지 가지도 못한다.
 *
 * 남는 구멍은 딱 하나: orders INSERT는 orderNo가 매번 새로 생성돼 유니크 충돌이 없으므로,
 * 뒤진 쪽도 orders 행 하나를 만들어 놓고서야 subscriptionPayments INSERT에서 죽는다 —
 * 결제는 안 되지만 주인 없는 pending orders 행이 하나 남는다. 이 CAS는 그 구멍만 막는다:
 * listDueSubscriptions가 읽은 nextBillingAt 그대로인 행만 골라 1초 앞당겨 두므로, 같은
 * 순간 시작한 두 cron 실행 중 하나만 rowsAffected 1을 받고 그 구독을 가져간다. 값을
 * 조금 앞당기는 것만으로 충분한 이유: chargeCycle 성공·재시도 경로는 끝에 nextBillingAt을
 * 자신이 다시 계산해 덮어쓰고, NETWORK_ERROR로 pending에 남는 경우만 이 값이 그대로
 * 남는데, 1초는 "다음 cron에서도 여전히 이 구독이 청구 대상"이라는 성질에 영향을 주지
 * 않는다(lte 비교 기준으로 하루 단위 스케줄에 1초는 무의미).
 */
export const claimDueSubscription = async (id: string, expectedNextBillingAt: Date): Promise<boolean> => {
  const result = await getDb().run(sql`
    UPDATE subscriptions
    SET next_billing_at = next_billing_at + 1, updated_at = unixepoch()
    WHERE id = ${id} AND next_billing_at = ${toEpoch(expectedNextBillingAt)}
  `);
  return (rowsAffectedOf(result) ?? 0) > 0;
};

/**
 * 웹훅 DONE 복구 — 구독 회차의 승인이 우리 기록보다 먼저 도착했을 때 반영한다.
 *
 * confirmBookingPayment를 재사용하지 못하는 이유: 그쪽은 bookings/work_orders라는 하위
 * 엔티티를 pending→confirmed로 미는데, 구독 회차의 하위 엔티티는 subscriptionPayments고
 * 전이 규칙(기간 전진·nextBillingAt 재계산)도 다르다. chargeCycle의 성공 batch와 같은
 * 계산(periodFor·computeNextBillingAt)을 그대로 쓴다 — 두 곳이 서로 다른 기간을 계산하면
 * 구독이 웹훅으로 살아난 달과 cron이 청구한 달의 기간이 어긋난다.
 *
 * 페이로드가 아니라 **재조회된 TossPayment만** 받는다 — 호출자(webhook.ts)가 이미
 * fetchPayment로 확인한 값이라는 뜻이고, 여기서 다시 금액·상태를 검증한다
 * (booking/confirm.ts와 같은 원칙: 재조회 결과만 신뢰).
 */
export const reconcileSubscriptionPaymentFromToss = async (payment: TossPayment, now: Date = new Date()): Promise<void> => {
  if (payment.status !== 'DONE') return; // CANCELED 등은 별도 경로(webhook.ts) — 여긴 승인 복구만 본다

  const db = getDb();
  const order = await db.query.orders.findFirst({
    where: (t, { eq: is }) => is(t.orderNo, payment.orderId),
    with: { subscriptionPayment: true },
  });
  if (!order || order.type !== 'subscription' || !order.subscriptionPayment) return; // 구독 회차가 아니다

  if (order.status === 'paid') return; // 이미 반영됨 — 재도착 웹훅의 정상 no-op

  if (payment.totalAmount !== order.totalAmount || payment.orderId !== order.orderNo) {
    console.error('[billing] 웹훅 DONE 복구 — 재조회 검증 불일치, 반영하지 않는다', {
      orderNo: order.orderNo,
      paymentKey: payment.paymentKey,
      totalAmount: payment.totalAmount,
      orderTotalAmount: order.totalAmount,
    });
    return;
  }

  const subscriptionPayment = order.subscriptionPayment;
  if (subscriptionPayment.status === 'paid') return; // 이미 반영됨(경합의 다른 쪽)

  const subscription = await findSubscriptionById(subscriptionPayment.subscriptionId);
  if (!subscription) {
    console.error('[billing] 웹훅 DONE 복구 — 구독을 찾을 수 없음, 수동 확인 필요', {
      orderNo: order.orderNo,
      subscriptionId: subscriptionPayment.subscriptionId,
    });
    return;
  }

  const period = periodFor(now, subscription.billingDay);
  let batchResults: unknown[];
  try {
    batchResults = await db.batch([
      // payments가 맨 앞 — paymentKey unique 위반(형제 이벤트·cron chargeCycle과의 경합)이
      // batch 전체를 실패시켜 절반만 쓰인 상태를 남기지 않는다(chargeCycle과 같은 순서).
      db.insert(payments).values({
        orderId: order.id,
        paymentKey: payment.paymentKey,
        method: payment.method ?? null,
        approvedAt: payment.approvedAt ? new Date(payment.approvedAt) : null,
        receiptUrl: payment.receipt?.url ?? null,
        rawResponse: JSON.stringify(payment),
      }),
      db
        .update(orders)
        .set({ status: 'paid', updatedAt: now })
        .where(and(eq(orders.id, order.id), inArray(orders.status, ['pending', 'failed']))),
      db
        .update(subscriptionPayments)
        .set({ status: 'paid', paymentKey: payment.paymentKey, paidAt: now, tossCode: null, tossMessage: null })
        .where(and(eq(subscriptionPayments.id, subscriptionPayment.id), inArray(subscriptionPayments.status, ['pending', 'failed']))),
      db
        .update(subscriptions)
        .set({
          status: 'active',
          currentPeriodStart: period.start,
          currentPeriodEnd: period.end,
          nextBillingAt: computeNextBillingAt(now, subscription.billingDay),
          updatedAt: now,
        })
        // 해지·종료된 구독은 되살리지 않는다 — 형제 항목(orders·subscriptionPayments)의
        // 상태 가드와 같은 이유다. 뒤늦은 DONE 웹훅은 수분~수시간 뒤에도 오고, 그 사이
        // 고객이 결제 실패 메일을 보고 셀프 해지를 누르는 것이 정상 동선이다.
        .where(and(eq(subscriptions.id, subscription.id), inArray(subscriptions.status, REACTIVATABLE_STATUSES))),
    ]);
  } catch (error) {
    // paymentKey unique 위반이면 cron chargeCycle이나 형제 웹훅 이벤트가 먼저 반영한 것 —
    // 멱등이므로 조용히 물러난다. 그 외 진짜 DB 장애는 로그로 남겨 수동 대사 대상이 되게 한다.
    let existing: unknown;
    try {
      existing = await db.query.payments.findFirst({ where: (t, { eq: is }) => is(t.paymentKey, payment.paymentKey) });
    } catch {
      // 판정 조회 자체가 실패 — 아래 else 분기로 진행해 로그만 남긴다.
    }
    if (!existing) {
      console.error('[billing] 웹훅 DONE 복구 — 기록 실패, 수동 대사 필요', {
        orderNo: order.orderNo,
        paymentKey: payment.paymentKey,
        error,
      });
    }
    return;
  }

  if (rowsAffectedOf(batchResults[1]) === 0) {
    console.error('[billing] 웹훅 DONE 복구 — orders 전이 0행, 수동 대사 필요', {
      orderNo: order.orderNo,
      paymentKey: payment.paymentKey,
    });
  }

  // 회차는 paid로 반영됐지만 구독은 그대로 둔 경우 — 해지·종료된 구독에 뒤늦은 승인이
  // 도착한 것이다. 재활성은 하지 않되 돈이 들어온 사실은 남겨 환불 여부를 사람이 정한다.
  if (rowsAffectedOf(batchResults[3]) === 0) {
    console.error('[billing] 웹훅 DONE 복구 — 해지·종료된 구독에 뒤늦은 승인 도착, 수동 환불 판단 필요', {
      orderNo: order.orderNo,
      paymentKey: payment.paymentKey,
      subscriptionId: subscription.id,
      status: subscription.status,
    });
    await alertLateApproval(
      subscription,
      [
        `${subscriptionPayment.cycleYm}분 ${formatPriceAmount(order.totalAmount)}원의 승인이 뒤늦게 도착했지만 구독이 ${subscription.status}라 이용기간을 전진시키지 않았습니다.`,
        '고객은 한 달치를 냈고 이용기간은 늘어나지 않은 상태입니다 — 환불 여부를 판단해 주세요.',
        `주문번호 ${order.orderNo} / paymentKey ${payment.paymentKey}`,
      ].join('\n'),
      now,
    );
  }
};
