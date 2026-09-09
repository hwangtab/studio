/**
 * Meta(Instagram·Threads) Graph API 공용 헬퍼 — 실행은 `node --env-file=.env.local …` 관례.
 *
 * 토큰은 .env.local에만 산다(저장소는 public). saveEnv()가 해당 키 줄만 바꿔 쓴다.
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
    tokenKey: 'INSTAGRAM_ACCESS_TOKEN',
    expiresKey: 'INSTAGRAM_TOKEN_EXPIRES_AT',
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
    tokenKey: 'THREADS_ACCESS_TOKEN',
    expiresKey: 'THREADS_TOKEN_EXPIRES_AT',
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
  const accessToken = token ?? requireEnv(p.tokenKey);
  const body = new URLSearchParams({ ...params, access_token: accessToken });
  const url = `${p.graph}${pathname}${method === 'GET' ? `?${body}` : ''}`;
  const res = await fetch(url, method === 'GET' ? {} : { method, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new GraphError(res.status, json, url);
  return json;
}


/**
 * 토큰 수명 관리 — Instagram·Threads 모두 **영구 토큰이 없다**. 장기 토큰 60일이고
 * `refresh_access_token`으로 무제한 연장할 수 있지만, 만료된 뒤에는 연장이 안 되고
 * 60일 동안 한 번도 갱신하지 않아도 영구 만료된다(2026-09-09 문서·실측 확인).
 * 그래서 "재발급 안 하고 영원히"의 실제 구현은 **자동 갱신을 빠뜨리지 않는 것**이다.
 *
 * 두 겹으로 막는다:
 *   1. 아래 ensureFreshToken() — 어떤 CLI를 실행하든 만료가 가까우면 먼저 갱신한다.
 *   2. launchd 주간 작업(scripts/social/refresh-token.sh) — CLI를 몇 달 안 써도 살아 있게.
 */
export const REFRESH_WHEN_DAYS_LEFT = 21;

export function saveToken(platform, { access_token: accessToken, expires_in: expiresIn }) {
  const p = PLATFORMS[platform];
  const updates = { [p.tokenKey]: accessToken };
  if (expiresIn) updates[p.expiresKey] = new Date(Date.now() + expiresIn * 1000).toISOString();
  saveEnv(updates);
}

/** 남은 일수. 만료 시각을 모르면 null(= 갱신 대상으로 본다). */
export function daysLeft(platform) {
  const raw = process.env[PLATFORMS[platform].expiresKey];
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : (ms - Date.now()) / 86400000;
}

export async function refreshToken(platform) {
  const p = PLATFORMS[platform];
  const res = await graph(platform, 'GET', '/refresh_access_token', { grant_type: p.refreshGrant });
  saveToken(platform, res);
  return Math.round(res.expires_in / 86400);
}

/**
 * 만료가 REFRESH_WHEN_DAYS_LEFT일 이내면 갱신한다. 실패해도 던지지 않는다 —
 * 토큰이 아직 유효할 수 있으므로 본 작업(발행·조회)을 막지 않는 편이 낫다.
 */
export async function ensureFreshToken(platform, { quiet = false } = {}) {
  const left = daysLeft(platform);
  if (left !== null && left > REFRESH_WHEN_DAYS_LEFT) return { refreshed: false, daysLeft: left };
  try {
    const days = await refreshToken(platform);
    if (!quiet) console.log(`[${PLATFORMS[platform].label}] 토큰 자동 갱신 — ${days}일 남음`);
    return { refreshed: true, daysLeft: days };
  } catch (err) {
    console.warn(`[${PLATFORMS[platform].label}] 토큰 자동 갱신 실패: ${err.message}`);
    if (left !== null && left <= 0) console.warn('만료된 토큰은 갱신할 수 없다. auth.mjs로 재승인할 것.');
    return { refreshed: false, daysLeft: left, error: err };
  }
}

/** 여러 플랫폼을 한 번에. 토큰이 없는 플랫폼은 건너뛴다(아직 승인 전). */
export async function ensureFreshTokens(platforms, opts) {
  for (const platform of platforms) {
    if (!process.env[PLATFORMS[platform].tokenKey]) continue;
    await ensureFreshToken(platform, opts);
  }
}

export function hintForError(err) {
  if (err instanceof GraphError && (err.code === 190 || err.status === 401)) {
    return '토큰이 만료됐거나 무효다. `node --env-file=.env.local scripts/social/auth.mjs --refresh` 또는 재인증.';
  }
  return null;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
