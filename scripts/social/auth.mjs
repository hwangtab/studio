#!/usr/bin/env node
/**
 * 1회 OAuth. Meta는 HTTPS redirect만 받으므로 로컬 서버 없이 두 단계로 나눈다.
 *   1) URL 출력:  node --env-file=.env.local scripts/social/auth.mjs --platform ig
 *      브라우저에서 승인하면 https://studionol.co.kr/ko/?code=XXXX#_ 로 돌아온다.
 *   2) 교환:      node --env-file=.env.local scripts/social/auth.mjs --platform ig --code XXXX
 *      (끝의 #_ 는 있어도 된다) → 단기→장기 토큰 → .env.local 저장.
 *   갱신:         node --env-file=.env.local scripts/social/auth.mjs --refresh [--platform …]
 *
 * 장기 토큰은 60일. --refresh는 24시간 이상 지난 유효 토큰만 연장된다.
 */
import { PLATFORMS, REDIRECT_URI, graph, requireEnv, saveEnv, hintForError } from './meta.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const which = flag('--platform') ?? 'all';
const targets = which === 'all' ? Object.keys(PLATFORMS) : [which];
if (flag('--code') && which === 'all') { console.error('--code 는 --platform 하나와 함께 써야 한다'); process.exit(2); }
const refresh = args.includes('--refresh');

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
  saveEnv({ [p.tokenKey]: long.access_token, [p.userIdKey]: me.id });
  console.log(`[${p.label}] @${me.username} (id ${me.id}) 장기 토큰 저장. 만료 ${Math.round(long.expires_in / 86400)}일 후.`);
}

async function refreshToken(platform) {
  const p = PLATFORMS[platform];
  const long = await graph(platform, 'GET', '/refresh_access_token', { grant_type: p.refreshGrant });
  saveEnv({ [p.tokenKey]: long.access_token });
  console.log(`[${p.label}] 토큰 갱신. 만료 ${Math.round(long.expires_in / 86400)}일 후.`);
}

try {
  for (const t of targets) {
    if (!PLATFORMS[t]) throw new Error(`알 수 없는 플랫폼: ${t}`);
    await (refresh ? refreshToken(t) : authorize(t));
  }
} catch (err) {
  console.error(`실패: ${err.message}`);
  const hint = hintForError(err);
  if (hint) console.error(hint);
  process.exit(1);
}
