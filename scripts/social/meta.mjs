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

export function hintForError(err) {
  if (err instanceof GraphError && (err.code === 190 || err.status === 401)) {
    return '토큰이 만료됐거나 무효다. `node --env-file=.env.local scripts/social/auth.mjs --refresh` 또는 재인증.';
  }
  return null;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
