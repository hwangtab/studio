/**
 * Instagram·Threads 장기 토큰 저장소 + 갱신.
 *
 * 영구 토큰은 없다. 60일 토큰을 `refresh_access_token`으로 무제한 연장할 수 있을 뿐이고,
 * 만료된 뒤에는 연장이 불가능해 브라우저 재승인만 남는다. 그래서 유일한 실패 모드는
 * "갱신 누락"이고, 이 모듈은 그 한 가지를 막는다.
 *
 * 저장소가 Turso인 이유: Vercel 환경 변수는 배포 시점에 함수에 박히므로 크론이 갱신한
 * 값을 되써도 다음 배포 전까지 옛 토큰을 본다. 같은 표를 로컬 CLI(scripts/social/meta.mjs)도
 * 읽으므로 컬럼을 바꾸면 그쪽도 함께 고칠 것.
 */
import { eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { socialTokens } from '../../db/schema';

export type Platform = 'ig' | 'threads';

export const PLATFORM_LABEL: Record<Platform, string> = { ig: 'Instagram', threads: 'Threads' };

const REFRESH_ENDPOINT: Record<Platform, { url: string; grant: string }> = {
  ig: { url: 'https://graph.instagram.com/v23.0/refresh_access_token', grant: 'ig_refresh_token' },
  threads: { url: 'https://graph.threads.net/v1.0/refresh_access_token', grant: 'th_refresh_token' },
};

/** 이보다 적게 남았을 때만 갱신한다. 주간 크론을 두어 번 걸러도 60일 창을 못 넘기게 잡았다. */
export const REFRESH_WHEN_DAYS_LEFT = 21;

/** 발급 24시간 안에는 Meta가 갱신을 거부한다. */
const MIN_AGE_SECONDS = 24 * 3600;

type Db = ReturnType<typeof getDb>;

export type RefreshOutcome =
  | { platform: Platform; status: 'skipped'; daysLeft: number }
  | { platform: Platform; status: 'refreshed'; daysLeft: number }
  | { platform: Platform; status: 'missing' }
  | { platform: Platform; status: 'expired'; daysLeft: number }
  | { platform: Platform; status: 'failed'; daysLeft: number; error: string };

export const daysLeftOf = (expiresAt: number, now = Date.now()): number =>
  (expiresAt * 1000 - now) / 86_400_000;

export async function refreshPlatform(
  platform: Platform,
  { db = getDb(), now = Date.now(), force = false }: { db?: Db; now?: number; force?: boolean } = {},
): Promise<RefreshOutcome> {
  const row = await db.query.socialTokens.findFirst({ where: eq(socialTokens.platform, platform) });
  if (!row) return { platform, status: 'missing' };

  const daysLeft = daysLeftOf(row.expiresAt, now);
  if (daysLeft <= 0) return { platform, status: 'expired', daysLeft };
  if (!force && daysLeft > REFRESH_WHEN_DAYS_LEFT) return { platform, status: 'skipped', daysLeft };
  if (now / 1000 - row.updatedAt < MIN_AGE_SECONDS) return { platform, status: 'skipped', daysLeft };

  const { url, grant } = REFRESH_ENDPOINT[platform];
  const params = new URLSearchParams({ grant_type: grant, access_token: row.accessToken });
  try {
    const res = await fetch(`${url}?${params}`);
    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: { message?: string; code?: number };
    };
    if (!res.ok || !body.access_token || !body.expires_in) {
      const message = body.error?.message ?? `HTTP ${res.status}`;
      return { platform, status: 'failed', daysLeft, error: message };
    }
    const expiresAt = Math.floor(now / 1000) + body.expires_in;
    await db
      .update(socialTokens)
      .set({ accessToken: body.access_token, expiresAt, updatedAt: Math.floor(now / 1000) })
      .where(eq(socialTokens.platform, platform));
    return { platform, status: 'refreshed', daysLeft: daysLeftOf(expiresAt, now) };
  } catch (error: unknown) {
    return { platform, status: 'failed', daysLeft, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function refreshAll(opts: { db?: Db; now?: number; force?: boolean } = {}): Promise<RefreshOutcome[]> {
  const out: RefreshOutcome[] = [];
  for (const platform of ['ig', 'threads'] as const) out.push(await refreshPlatform(platform, opts));
  return out;
}

/** 운영자에게 알릴 것만 고른다 — 정상 스킵·정상 갱신은 조용히 지나간다. */
export const needsAttention = (o: RefreshOutcome): boolean =>
  o.status === 'missing' || o.status === 'expired' || o.status === 'failed';

export function formatOutcomes(outcomes: RefreshOutcome[]): string {
  return outcomes
    .map((o) => {
      const label = PLATFORM_LABEL[o.platform];
      switch (o.status) {
        case 'skipped':
          return `${label}: ${Math.floor(o.daysLeft)}일 남음 — 갱신 불필요`;
        case 'refreshed':
          return `${label}: 갱신 완료 — ${Math.floor(o.daysLeft)}일 남음`;
        case 'missing':
          return `${label}: 저장된 토큰 없음 — scripts/social/auth.mjs 로 승인할 것`;
        case 'expired':
          return `${label}: 만료됨 — 연장 불가. scripts/social/auth.mjs 로 재승인해야 한다`;
        case 'failed':
          return `${label}: 갱신 실패 (${o.error}) — ${Math.floor(o.daysLeft)}일 안에 해결 못 하면 재승인 필요`;
      }
    })
    .join('\n');
}
