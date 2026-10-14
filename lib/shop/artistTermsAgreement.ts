import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { SHOP_ARTIST_TERMS_VERSION, type ShopArtistTermsState, type ShopArtistTermsStatus } from './artistTerms';
import { isMissingTableError } from './fulfillmentMode';

/**
 * 상점 아티스트 위탁 약관 동의 기록(`shop_artist_terms_agreements`, 마이그레이션 0059) — 서버 전용.
 *
 * **판정은 "현재 판본(`SHOP_ARTIST_TERMS_VERSION`)에 동의한 행이 있는가" 하나다.** 판본이 바뀌면 옛 행은 증거로 남고
 * 현재 판본 행이 없으니 다시 동의해야 한다.
 *
 * **fail-closed**: 표가 없는 DB(0059 전 배포)는 "동의 안 함"으로 본다 — 콘솔은 동의 화면을 보이고(동의 저장은 실패한다),
 * 쓰기 API와 상품 승인은 거부된다. 위탁 계약 없이 받는 분 정보를 넘기거나 상품을 승인하지 않게 하려는 것이다.
 * 그래서 순서는 반드시 **마이그레이션 → 배포**다(뒤집으면 아티스트 상점 쓰기·승인이 멈춘다. 결제·주문은 안 깨진다).
 * 표가 없다는 오류만 삼키고(`isMissingTableError(error, TABLE)`), 그 밖의 오류는 던진다.
 *
 * 스튜디오 상품 계정(`STUDIO_SHOP_ARTIST_SLUG`)은 위탁 계약이 없다 — 예외 판정은 호출부(승인 게이트)가 한다.
 */

const TABLE = 'shop_artist_terms_agreements';

export type { ShopArtistTermsState, ShopArtistTermsStatus };

const NONE: ShopArtistTermsStatus = { state: 'none', version: null, agreedAt: null };

type Row = { creator_id: string; terms_version: string; agreed_at: number };

const statusOf = (rows: readonly Row[]): ShopArtistTermsStatus => {
  const current = rows.find((r) => r.terms_version === SHOP_ARTIST_TERMS_VERSION);
  if (current) return { state: 'agreed', version: current.terms_version, agreedAt: Number(current.agreed_at) };
  if (rows.length === 0) return NONE;
  const latest = rows.reduce((a, b) => (Number(b.agreed_at) > Number(a.agreed_at) ? b : a));
  return { state: 'outdated', version: latest.terms_version, agreedAt: Number(latest.agreed_at) };
};

/** 여러 계정의 동의 상태(관리자 목록용). 표가 없으면 전부 'none'. */
export const loadShopArtistTermsStatuses = async (creatorIds: readonly string[]): Promise<Map<string, ShopArtistTermsStatus>> => {
  const out = new Map<string, ShopArtistTermsStatus>();
  for (const id of creatorIds) out.set(id, NONE);
  if (creatorIds.length === 0) return out;
  let rows: Row[];
  try {
    rows = await getDb().all<Row>(sql`
      SELECT creator_id, terms_version, agreed_at FROM shop_artist_terms_agreements
      WHERE creator_id IN (${sql.join(creatorIds.map((id) => sql`${id}`), sql`, `)})
    `);
  } catch (error: unknown) {
    if (isMissingTableError(error, TABLE)) return out;
    throw error;
  }
  const byCreator = new Map<string, Row[]>();
  for (const r of rows) byCreator.set(r.creator_id, [...(byCreator.get(r.creator_id) ?? []), r]);
  for (const [id, list] of byCreator) out.set(id, statusOf(list));
  return out;
};

export const loadShopArtistTermsStatus = async (creatorId: string): Promise<ShopArtistTermsStatus> =>
  (await loadShopArtistTermsStatuses([creatorId])).get(creatorId) ?? NONE;

/** 현재 판본에 동의했는가. 표가 없으면 false(fail-closed). */
export const hasAgreedCurrentShopArtistTerms = async (creatorId: string): Promise<boolean> =>
  (await loadShopArtistTermsStatus(creatorId)).state === 'agreed';

export type RecordShopArtistTermsResult =
  | { ok: true; agreedAt: number }
  | { ok: false; code: 'no_shop' | 'stale_version' | 'unavailable'; message: string };

/**
 * 현재 판본 동의를 기록한다. `version`은 화면이 보여 준 판본 — 화면을 연 뒤 판본이 바뀌었으면 거부한다(읽지 않은 판본에 동의시키지 않게).
 * 등재(`shop_artists` 행)가 없는 계정은 INSERT … SELECT의 WHERE가 0행으로 막는다. 이미 동의했으면 처음 동의한 시각을 그대로 둔다.
 */
export const recordShopArtistTermsAgreement = async (
  creatorId: string,
  version: string,
  now: Date = new Date(),
): Promise<RecordShopArtistTermsResult> => {
  if (version !== SHOP_ARTIST_TERMS_VERSION) {
    return { ok: false, code: 'stale_version', message: '약관이 바뀌었어요. 새로고침해 바뀐 약관을 확인해 주세요.' };
  }
  const epoch = Math.floor(now.getTime() / 1000);
  try {
    const result = await getDb().run(sql`
      INSERT INTO shop_artist_terms_agreements (creator_id, terms_version, agreed_at)
      SELECT ${creatorId}, ${SHOP_ARTIST_TERMS_VERSION}, ${epoch}
      WHERE EXISTS (SELECT 1 FROM shop_artists WHERE creator_id = ${creatorId})
      ON CONFLICT (creator_id, terms_version) DO NOTHING
    `);
    if (Number(result.rowsAffected) === 0) {
      const status = await loadShopArtistTermsStatus(creatorId);
      if (status.state === 'agreed' && status.agreedAt !== null) return { ok: true, agreedAt: status.agreedAt };
      return { ok: false, code: 'no_shop', message: '상점이 열린 계정이 아니에요.' };
    }
    return { ok: true, agreedAt: epoch };
  } catch (error: unknown) {
    if (isMissingTableError(error, TABLE)) {
      console.error('[shop/artistTerms] 동의 표가 없다 — 마이그레이션 0059를 적용할 것');
      return { ok: false, code: 'unavailable', message: '지금은 동의를 저장할 수 없어요. 잠시 후 다시 시도해 주세요.' };
    }
    throw error;
  }
};

/** 쓰기 API가 동의 전 요청에 돌려주는 문구 — 라우트 여러 곳이 한 벌을 쓴다(상태 403). */
export const SHOP_ARTIST_TERMS_REQUIRED_MESSAGE = '상점 위탁 약관에 먼저 동의해 주세요. 내 상점 화면에서 약관을 확인할 수 있어요.';
