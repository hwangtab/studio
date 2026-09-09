#!/usr/bin/env node
/**
 * 1회 OAuth. Meta는 HTTPS redirect만 받으므로 로컬 서버 없이 두 단계로 나눈다.
 *   1) URL 출력:  node --env-file=.env.local scripts/social/auth.mjs --platform ig
 *      브라우저에서 승인하면 https://studionol.co.kr/ko/?code=XXXX#_ 로 돌아온다.
 *   2) 교환:      node --env-file=.env.local scripts/social/auth.mjs --platform ig --code XXXX
 *      (끝의 #_ 는 있어도 된다) → 단기→장기 토큰 → .env.local 저장.
 *   갱신:         node --env-file=.env.local scripts/social/auth.mjs --refresh [--platform …]
 *   상태:         node --env-file=.env.local scripts/social/auth.mjs --status
 *
 * 장기 토큰은 60일이고 영구 토큰은 없다. --refresh는 24시간 이상 지났고 아직 만료되지 않은
 * 토큰만 연장한다. 토큰은 Turso에 저장되고 주간 갱신은 Vercel Cron(api/cron/social-refresh)이
 * 한다. 이 스크립트는 최초 승인·재승인·수동 확인용이다.
 */
import {
  PLATFORMS, REDIRECT_URI, REFRESH_WHEN_DAYS_LEFT,
  graph, requireEnv, saveEnv, saveToken, refreshToken, daysLeft, hintForError,
} from './meta.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const which = flag('--platform') ?? 'all';
const targets = which === 'all' ? Object.keys(PLATFORMS) : [which];
if (flag('--code') && which === 'all') { console.error('--code 는 --platform 하나와 함께 써야 한다'); process.exit(2); }
const refresh = args.includes('--refresh');
const status = args.includes('--status');

async function authorize(platform) {
  const p = PLATFORMS[platform];
  const clientId = requireEnv(p.appIdKey);
  const secret = requireEnv(p.secretKey);
  const code = flag('--code')?.replace(/#_$/, '');
  if (!code) {
    const authUrl = `${p.authorizeUrl}?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      scope: p.scopes.join(','),
      response_type: 'code',
    })}`;
    console.log(`\n[${p.label}] 브라우저에서 승인 후, 돌아온 URL의 code 값을 --code 로 넘길 것:\n${authUrl}\n`);
    return;
  }

  const shortRes = await fetch(p.tokenUrl, {
    method: 'POST',
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      code,
    }),
  });
  const short = await shortRes.json();
  if (!shortRes.ok || !short.access_token) throw new Error(`단기 토큰 실패: ${JSON.stringify(short)}`);

  const long = await graph(platform, 'GET', '/access_token', {
    grant_type: p.exchangeGrant,
    client_secret: secret,
  }, { token: short.access_token });

  const me = await graph(platform, 'GET', '/me', { fields: 'id,username' }, { token: long.access_token });
  saveEnv({ [p.userIdKey]: me.id });
  await saveToken(platform, long);
  console.log(`[${p.label}] @${me.username} (id ${me.id}) 장기 토큰 저장. 만료 ${Math.round(long.expires_in / 86400)}일 후.`);
}

async function refresh1(platform) {
  const days = await refreshToken(platform);
  console.log(`[${PLATFORMS[platform].label}] 토큰 갱신. 만료 ${days}일 후.`);
}

async function report(platform) {
  const p = PLATFORMS[platform];
  const left = await daysLeft(platform);
  if (left === null) { console.log(`[${p.label}] 저장된 토큰 없음 — auth.mjs --platform ${platform} 로 승인할 것`); return; }
  const state = left <= 0 ? '만료됨 (재승인 필요)' : left <= REFRESH_WHEN_DAYS_LEFT ? '갱신 예정' : '정상';
  console.log(`[${p.label}] ${Math.floor(left)}일 남음 — ${state}`);
}

try {
  for (const t of targets) {
    if (!PLATFORMS[t]) throw new Error(`알 수 없는 플랫폼: ${t}`);
    if (status) await report(t);
    else await (refresh ? refresh1(t) : authorize(t));
  }
} catch (err) {
  console.error(`실패: ${err.message}`);
  const hint = hintForError(err);
  if (hint) console.error(hint);
  process.exit(1);
}
