import { and, eq, inArray, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { artistPayouts, orders, payments, refunds, subscriptionPayments, subscriptions, type ArtistPayout } from '../../db/schema';
import { ARTIST_SUPPORT_SHARE_PERCENT, ARTIST_SUPPORT_WITHHOLDING_PERCENT } from '../../data/pricing';
import { getSupportedArtist, SUPPORTED_ARTISTS, type SupportedArtist } from '../../data/artists';
import { VAT_RATE } from '../booking/amounts';

/**
 * 아티스트 월 정산(스펙 §10).
 *
 * gross    = 그 달 결제 완료 회차 합계(VAT 포함)
 * refund   = 그 회차들에 대한 환불 합계
 * supply   = (gross − refund) − VAT(×10/110)
 * share    = supply × 90%
 * withhold = 원천징수 아티스트면 share × 3.3%, 사업자(세금계산서)면 0
 * net      = share − withhold  ← 실제 이체액
 *
 * 월 10,000원 1건: gross 10,000 → supply 9,091 → share 8,182 → withhold 270 → net 7,912.
 * 이 숫자가 아티스트 페이지의 "90%(VAT 제외) 지급" 문구의 근거다. 스튜디오 몫 909에서
 * 카드수수료(3.4% = 340)가 나간다.
 */
export interface PayoutBreakdown {
  grossAmount: number;
  refundAmount: number;
  supplyAmount: number;
  shareAmount: number;
  withholdingAmount: number;
  netAmount: number;
}

export const computeArtistPayout = (input: {
  grossAmount: number;
  refundAmount: number;
  taxType: SupportedArtist['taxType'];
}): PayoutBreakdown => {
  const netGross = Math.max(0, input.grossAmount - input.refundAmount);
  const supplyAmount = Math.round(netGross / (1 + VAT_RATE));
  const shareAmount = Math.round((supplyAmount * ARTIST_SUPPORT_SHARE_PERCENT) / 100);
  const withholdingAmount = input.taxType === 'withholding' ? Math.round((shareAmount * ARTIST_SUPPORT_WITHHOLDING_PERCENT) / 100) : 0;
  return {
    grossAmount: input.grossAmount,
    refundAmount: input.refundAmount,
    supplyAmount,
    shareAmount,
    withholdingAmount,
    netAmount: shareAmount - withholdingAmount,
  };
};

export const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface ArtistPayoutPreview extends PayoutBreakdown {
  artistSlug: string;
  artistName: string;
  taxType: SupportedArtist['taxType'];
  period: string;
  /** 그 달에 결제 완료 회차가 있는 구독 수(사람 수). */
  subscriberCount: number;
  /** 이미 기록된 정산이 있으면 그것. 있으면 화면은 미리보기 대신 기록을 보여준다. */
  recorded: ArtistPayout | null;
}

/**
 * 한 아티스트·한 달의 정산 미리보기 — DB 합계로 계산한다. 기록(artist_payouts)이 있으면
 * 그 값이 정본이고 미리보기는 참고용이다(환불이 뒤늦게 들어오면 둘이 달라질 수 있다 —
 * 그때 화면이 차이를 보여준다).
 */
export const buildArtistPayoutPreview = async (artistSlug: string, period: string): Promise<ArtistPayoutPreview | null> => {
  const artist = getSupportedArtist(artistSlug);
  if (!artist) return null;
  const db = getDb();

  // 그 달 결제 완료 회차 — 주문 단위로 gross·환불을 함께 읽는다.
  const rows = await db
    .select({
      subscriptionId: subscriptionPayments.subscriptionId,
      orderId: orders.id,
      amount: subscriptionPayments.amount,
      refunded: sql<number>`COALESCE((
        SELECT SUM(r.amount) FROM refunds r
        JOIN payments p ON p.id = r.payment_id
        WHERE p.order_id = ${orders.id} AND r.status = 'done'
      ), 0)`,
    })
    .from(subscriptionPayments)
    .innerJoin(subscriptions, eq(subscriptions.id, subscriptionPayments.subscriptionId))
    .innerJoin(orders, eq(orders.id, subscriptionPayments.orderId))
    .where(
      and(
        eq(subscriptions.kind, 'artist-support'),
        eq(subscriptions.artistSlug, artistSlug),
        eq(subscriptionPayments.cycleYm, period),
        eq(subscriptionPayments.status, 'paid'),
      ),
    );

  const grossAmount = rows.reduce((s, r) => s + r.amount, 0);
  const refundAmount = rows.reduce((s, r) => s + Number(r.refunded), 0);
  const subscriberCount = new Set(rows.map((r) => r.subscriptionId)).size;

  const recorded =
    (await db.query.artistPayouts.findFirst({
      where: (t, { and: all, eq: is }) => all(is(t.artistSlug, artistSlug), is(t.period, period)),
    })) ?? null;

  return {
    artistSlug,
    artistName: artist.name,
    taxType: artist.taxType,
    period,
    subscriberCount,
    recorded,
    ...computeArtistPayout({ grossAmount, refundAmount, taxType: artist.taxType }),
  };
};

/** 등록된 아티스트 전부의 한 달 미리보기 — 관리자 정산 표. */
export const buildAllArtistPayoutPreviews = async (period: string): Promise<ArtistPayoutPreview[]> => {
  const previews = await Promise.all(SUPPORTED_ARTISTS.map((a) => buildArtistPayoutPreview(a.slug, period)));
  return previews.filter((p): p is ArtistPayoutPreview => p !== null);
};

export type RecordPayoutResult =
  | { ok: true; payout: ArtistPayout }
  | { ok: false; code: 'not_found' | 'already_recorded' | 'nothing_to_pay' };

/**
 * 미리보기 숫자를 그 시점에 고정해 기록한다. 같은 (아티스트, 달)은 한 번만 — 유니크 인덱스가
 * 두 번째 INSERT를 막고, 그 실패를 already_recorded로 돌려준다(경합에서도 안전).
 */
export const recordArtistPayout = async (artistSlug: string, period: string, now: Date): Promise<RecordPayoutResult> => {
  const preview = await buildArtistPayoutPreview(artistSlug, period);
  if (!preview) return { ok: false, code: 'not_found' };
  if (preview.recorded) return { ok: false, code: 'already_recorded' };
  if (preview.grossAmount <= 0) return { ok: false, code: 'nothing_to_pay' };

  try {
    const [payout] = await getDb()
      .insert(artistPayouts)
      .values({
        artistSlug,
        period,
        grossAmount: preview.grossAmount,
        refundAmount: preview.refundAmount,
        supplyAmount: preview.supplyAmount,
        shareAmount: preview.shareAmount,
        withholdingAmount: preview.withholdingAmount,
        netAmount: preview.netAmount,
        subscriberCount: preview.subscriberCount,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return { ok: true, payout };
  } catch (error) {
    // 유니크 위반 = 동시에 두 번 눌렀다. 다른 오류면 그대로 올린다.
    if (String(error).includes('UNIQUE')) return { ok: false, code: 'already_recorded' };
    throw error;
  }
};

/** 운영자가 이체를 마친 뒤 누른다. pending → paid 한 방향, 되돌리지 않는다. */
export const markArtistPayoutPaid = async (id: string, memo: string | null, now: Date): Promise<boolean> => {
  const result = await getDb()
    .update(artistPayouts)
    .set({ status: 'paid', paidAt: now, memo, updatedAt: now })
    .where(and(eq(artistPayouts.id, id), eq(artistPayouts.status, 'pending')))
    .returning({ id: artistPayouts.id });
  return result.length > 0;
};

export const listArtistPayouts = async (limit = 120): Promise<ArtistPayout[]> =>
  getDb().query.artistPayouts.findMany({ orderBy: (t, { desc }) => [desc(t.period), desc(t.createdAt)], limit });

/** 기록된 정산 중 아직 이체 안 한 것 — 대시보드 대기열용. */
export const countPendingArtistPayouts = async (): Promise<number> => {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(artistPayouts)
    .where(inArray(artistPayouts.status, ['pending']));
  return Number(row?.count ?? 0);
};

// payments 테이블은 서브쿼리 SQL에서 문자열로 참조한다 — 위 import는 타입 참조용으로 남긴다.
void payments;
void refunds;
