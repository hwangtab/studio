/**
 * Meta(Instagram·Threads) Graph API 공용 헬퍼 — 실행은 `node --env-file=.env.local …` 관례.
 *
 * 앱 ID·시크릿은 Vercel env → `vercel env pull`로 .env.local에 온다. 토큰은 Turso(아래).
 * 두 플랫폼은 도메인·버전·필드명이 다르므로 PLATFORMS 표 하나에 차이를 모아 둔다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const ENV_PATH = path.join(ROOT, '.env.local');
// Meta는 HTTPS redirect만 받는다(localhost http 거부 실측 2026-09-08). 사이트 페이지로 돌아온
// URL의 ?code= 를 auth.mjs --code 로 넘긴다.
export const REDIRECT_URI = 'https://studionol.co.kr/ko/';

export const PLATFORMS = {
  ig: {
    label: 'Instagram',
    appIdKey: 'INSTAGRAM_APP_ID',
    secretKey: 'INSTAGRAM_APP_SECRET',
    userIdKey: 'INSTAGRAM_USER_ID',
    authorizeUrl: 'https://www.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    graph: 'https://graph.instagram.com/v23.0',
    exchangeGrant: 'ig_exchange_token',
    refreshGrant: 'ig_refresh_token',
    scopes: [
      'instagram_business_basic',
      'instagram_business_content_publish',
      'instagram_business_manage_comments',
      'instagram_business_manage_insights',
      'instagram_business_manage_messages',
    ],
  },
  threads: {
    label: 'Threads',
    appIdKey: 'THREADS_APP_ID',
    secretKey: 'THREADS_APP_SECRET',
    userIdKey: 'THREADS_USER_ID',
    authorizeUrl: 'https://threads.net/oauth/authorize',
    tokenUrl: 'https://graph.threads.net/oauth/access_token',
    graph: 'https://graph.threads.net/v1.0',
    exchangeGrant: 'th_exchange_token',
    refreshGrant: 'th_refresh_token',
    scopes: [
      'threads_basic',
      'threads_content_publish',
      'threads_manage_replies',
      'threads_read_replies',
      'threads_manage_insights',
    ],
  },
};

export function requireEnv(key) {
  const v = process.env[key];
  if (!v) throw new Error(`${key}가 비어 있다. .env.local을 확인하거나 auth.mjs를 먼저 실행할 것.`);
  return v;
}

/** .env.local의 해당 키 줄만 교체(없으면 끝에 추가). 다른 줄은 그대로. */
export function saveEnv(updates) {
  let text = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    text = re.test(text) ? text.replace(re, line) : `${text.replace(/\n?$/, '\n')}${line}\n`;
    process.env[key] = value;
  }
  fs.writeFileSync(ENV_PATH, text);
}

export class GraphError extends Error {
  constructor(status, body, url) {
    const e = body?.error ?? {};
    super(`${e.message ?? 'Graph API error'} (HTTP ${status}, code ${e.code ?? '?'}${e.error_subcode ? `/${e.error_subcode}` : ''}) — ${url.split('?')[0]}`);
    this.status = status;
    this.code = e.code;
    this.subcode = e.error_subcode;
    this.body = body;
  }
}

/** GET은 query, POST는 x-www-form-urlencoded. 토큰은 항상 access_token 파라미터. */
export async function graph(platform, method, pathname, params = {}, { token } = {}) {
  const p = PLATFORMS[platform];
  const accessToken = token ?? (await loadToken(platform))?.accessToken;
  if (!accessToken) throw new Error(`${p.label} 토큰이 저장돼 있지 않다. scripts/social/auth.mjs --platform ${platform} 로 승인할 것.`);
  const body = new URLSearchParams({ ...params, access_token: accessToken });
  const url = `${p.graph}${pathname}${method === 'GET' ? `?${body}` : ''}`;
  const res = await fetch(url, method === 'GET' ? {} : { method, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new GraphError(res.status, json, url);
  return json;
}


/**
 * 토큰 저장소 = Turso `social_tokens` (lib/social/tokens.ts와 같은 표).
 *
 * 영구 토큰이 없어서(60일, 무제한 연장, 만료 후 연장 불가) 갱신은 Vercel Cron
 * (api/cron/social-refresh, 매주 월)이 맡는다. 로컬은 .env.local에 토큰을 두지 않고
 * `vercel env pull`로 받은 TURSO_* 자격으로 같은 행을 읽는다. 여기 ensureFreshToken은
 * 크론이 몇 주 죽어 있던 경우의 보조 장치일 뿐이다.
 *
 * 컬럼을 바꾸면 lib/social/tokens.ts·db/schema.ts도 함께 고칠 것.
 */
export const REFRESH_WHEN_DAYS_LEFT = 21;

let dbClient = null;
async function db() {
  if (dbClient) return dbClient;
  const { createClient } = await import('@libsql/client');
  const url = requireEnv('TURSO_DATABASE_URL');
  const authToken = process.env.TURSO_AUTH_TOKEN;
  dbClient = createClient({ url, authToken });
  return dbClient;
}

const tokenCache = new Map();

/** 저장된 토큰 행. 없으면 null. 결과는 프로세스 안에서 캐시한다. */
export async function loadToken(platform) {
  if (tokenCache.has(platform)) return tokenCache.get(platform);
  const c = await db();
  const { rows } = await c.execute({
    sql: 'select access_token, expires_at, updated_at from social_tokens where platform = ?',
    args: [platform],
  });
  const row = rows[0]
    ? { accessToken: rows[0].access_token, expiresAt: Number(rows[0].expires_at), updatedAt: Number(rows[0].updated_at) }
    : null;
  tokenCache.set(platform, row);
  return row;
}

export async function saveToken(platform, { access_token: accessToken, expires_in: expiresIn }) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + Number(expiresIn ?? 60 * 86400);
  const c = await db();
  await c.execute({
    sql: `insert into social_tokens (platform, access_token, expires_at, updated_at) values (?, ?, ?, ?)
          on conflict(platform) do update set access_token = excluded.access_token,
          expires_at = excluded.expires_at, updated_at = excluded.updated_at`,
    args: [platform, accessToken, expiresAt, now],
  });
  tokenCache.set(platform, { accessToken, expiresAt, updatedAt: now });
}

/** 남은 일수. 행이 없으면 null. */
export async function daysLeft(platform) {
  const row = await loadToken(platform);
  return row ? (row.expiresAt * 1000 - Date.now()) / 86400000 : null;
}

export async function refreshToken(platform) {
  const p = PLATFORMS[platform];
  const res = await graph(platform, 'GET', '/refresh_access_token', { grant_type: p.refreshGrant });
  await saveToken(platform, res);
  return Math.round(res.expires_in / 86400);
}

/**
 * 만료가 REFRESH_WHEN_DAYS_LEFT일 이내면 갱신한다. 실패해도 던지지 않는다 —
 * 토큰이 아직 유효할 수 있으므로 본 작업(발행·조회)을 막지 않는 편이 낫다.
 */
export async function ensureFreshToken(platform, { quiet = false } = {}) {
  const row = await loadToken(platform);
  if (!row) return { refreshed: false, daysLeft: null };
  const left = (row.expiresAt * 1000 - Date.now()) / 86400000;
  if (left > REFRESH_WHEN_DAYS_LEFT || Date.now() / 1000 - row.updatedAt < 86400) return { refreshed: false, daysLeft: left };
  try {
    const days = await refreshToken(platform);
    if (!quiet) console.log(`[${PLATFORMS[platform].label}] 토큰 자동 갱신 — ${days}일 남음`);
    return { refreshed: true, daysLeft: days };
  } catch (err) {
    console.warn(`[${PLATFORMS[platform].label}] 토큰 자동 갱신 실패: ${err.message}`);
    if (left <= 0) console.warn('만료된 토큰은 갱신할 수 없다. auth.mjs로 재승인할 것.');
    return { refreshed: false, daysLeft: left, error: err };
  }
}

/** 여러 플랫폼을 한 번에. 저장된 토큰이 없는 플랫폼은 건너뛴다(아직 승인 전). */
export async function ensureFreshTokens(platforms, opts) {
  for (const platform of platforms) {
    if (await loadToken(platform)) await ensureFreshToken(platform, opts);
  }
}

export function hintForError(err) {
  if (err instanceof GraphError && (err.code === 190 || err.status === 401)) {
    return '토큰이 만료됐거나 무효다. `node --env-file=.env.local scripts/social/auth.mjs --refresh` 또는 재인증.';
  }
  return null;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
