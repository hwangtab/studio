#!/usr/bin/env node
// GA4 주요 이벤트(Key Event = 전환) 일괄 등록 스크립트
// 사용: node --env-file=.env.local scripts/ga4-set-key-events.mjs
//
// 하는 일:
//   lead_click_kakao / lead_click_phone / lead_click_naver_map / lead_submit_success 를
//   GA4 속성의 "주요 이벤트(key event)"로 등록 → conversions 집계 시작.
//
// 인증:
//   - GA4 Admin API write는 analytics.edit scope가 필요 (ga4-fetch의
//     readonly 토큰으로는 불가). 이 스크립트는 별도 GA4_OAUTH_EDIT_REFRESH_TOKEN
//     을 사용하며, 없으면 자동으로 loopback OAuth 동의 흐름을 띄운다.
//   - edit 토큰은 .env.local에 GA4_OAUTH_EDIT_REFRESH_TOKEN으로 저장된다.
//     기존 readonly 토큰(GA4_OAUTH_REFRESH_TOKEN)은 건드리지 않는다.
//
// 사전 조건: .env.local에 GA4_PROPERTY_ID, GSC_OAUTH_CLIENT_ID, GSC_OAUTH_CLIENT_SECRET

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PORT = 43821;
const REDIRECT_URI = `http://localhost:${PORT}`;
const SCOPE = 'https://www.googleapis.com/auth/analytics.edit';

// 등록할 전환 이벤트. countingMethod:
//   ONCE_PER_SESSION — 세션당 1회만 전환 집계 (리드 클릭에 적합: 한 방문에서
//   카카오를 여러 번 눌러도 전환 1회로 계산해 과대집계 방지).
// scripts/ga4-fetch.mjs의 QUALIFIED_LEAD_EVENT_NAMES(정식 5개)와 1:1 일치시킨다.
// lead_click_email은 이메일 리드 계측 부착 후 추가됨 — 등록에서 빠지면 이메일 리드가
// GA4 주요 이벤트(conversion)로 집계되지 않는다. micro_* 이벤트는 절대 포함 금지.
const KEY_EVENTS = [
  { eventName: 'lead_click_kakao', countingMethod: 'ONCE_PER_SESSION' },
  { eventName: 'lead_click_phone', countingMethod: 'ONCE_PER_SESSION' },
  { eventName: 'lead_click_email', countingMethod: 'ONCE_PER_SESSION' },
  { eventName: 'lead_click_naver_map', countingMethod: 'ONCE_PER_SESSION' },
  { eventName: 'lead_submit_success', countingMethod: 'ONCE_PER_SESSION' },
];

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`ERROR: ${name} 환경변수 누락 (.env.local 확인)`);
    process.exit(1);
  }
  return v;
}

// loopback OAuth로 analytics.edit refresh token 1회 발급 → .env.local 저장.
async function obtainEditRefreshToken(clientId, clientSecret) {
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPE,
    prompt: 'consent',
  });

  console.log('\n=== GA4 쓰기 권한(analytics.edit) 인증 ===\n');
  console.log('브라우저에서 아래 URL을 열고 hwangtab@gmail.com으로 로그인 후 동의해 주세요:\n');
  console.log(authUrl);
  console.log(`\n로컬 서버 대기 중 (port ${PORT})...`);
  console.log('(GCP Console > OAuth 클라이언트 > 승인된 리디렉션 URI에');
  console.log(` http://localhost:${PORT} 이 등록돼 있어야 합니다)\n`);

  const refreshToken = await new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>오류: ${error}</h1><p>터미널을 확인하세요.</p>`);
        server.close();
        reject(new Error(`OAuth 오류: ${error}`));
        return;
      }
      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>인증 코드가 없습니다.</h1>');
        return;
      }

      try {
        const { tokens } = await oauth2.getToken(code);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>✓ 인증 완료!</h1><p>터미널로 돌아가세요. 주요 이벤트를 등록합니다.</p>');
        server.close();
        if (!tokens.refresh_token) {
          reject(new Error('refresh_token이 반환되지 않았습니다. GCP에서 기존 동의를 취소 후 재시도하세요.'));
          return;
        }
        resolve(tokens.refresh_token);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>토큰 교환 실패</h1><p>${e.message}</p>`);
        server.close();
        reject(e);
      }
    });

    server.listen(PORT, () => {});
    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        console.error(`ERROR: port ${PORT}가 이미 사용 중입니다. 해당 프로세스 종료 후 재시도하세요.`);
      }
      reject(e);
    });
  });

  // .env.local에 저장 (기존 readonly 토큰과 별도 키)
  const envPath = path.join(ROOT, '.env.local');
  fs.appendFileSync(envPath, `\nGA4_OAUTH_EDIT_REFRESH_TOKEN="${refreshToken}"\n`, 'utf-8');
  console.log('✓ analytics.edit 토큰을 .env.local(GA4_OAUTH_EDIT_REFRESH_TOKEN)에 저장했습니다.\n');
  return refreshToken;
}

async function main() {
  const clientId = requireEnv('GSC_OAUTH_CLIENT_ID');
  const clientSecret = requireEnv('GSC_OAUTH_CLIENT_SECRET');
  const propertyId = requireEnv('GA4_PROPERTY_ID');

  let editToken = process.env.GA4_OAUTH_EDIT_REFRESH_TOKEN;
  if (!editToken) {
    console.log('GA4_OAUTH_EDIT_REFRESH_TOKEN이 없습니다 → 1회 인증을 진행합니다.');
    editToken = await obtainEditRefreshToken(clientId, clientSecret);
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: editToken });

  const admin = google.analyticsadmin({ version: 'v1beta', auth: oauth2 });
  const parent = `properties/${propertyId}`;

  // 기존 주요 이벤트 조회 (중복 등록 방지)
  let existing = [];
  try {
    const listRes = await admin.properties.keyEvents.list({ parent, pageSize: 200 });
    existing = (listRes.data.keyEvents || []).map((k) => k.eventName);
  } catch (e) {
    const msg = e?.errors?.[0]?.message || e.message;
    if (/insufficient|scope|permission/i.test(msg)) {
      console.error('\nERROR: 권한 부족. analytics.edit 재인증이 필요합니다.');
      console.error('  .env.local에서 GA4_OAUTH_EDIT_REFRESH_TOKEN 줄을 삭제하고 다시 실행하세요.\n');
      process.exit(1);
    }
    throw e;
  }

  console.log(`현재 등록된 주요 이벤트: ${existing.length ? existing.join(', ') : '(없음)'}\n`);

  for (const ke of KEY_EVENTS) {
    if (existing.includes(ke.eventName)) {
      console.log(`= ${ke.eventName} — 이미 주요 이벤트로 등록됨 (skip)`);
      continue;
    }
    try {
      await admin.properties.keyEvents.create({
        parent,
        requestBody: { eventName: ke.eventName, countingMethod: ke.countingMethod },
      });
      console.log(`✓ ${ke.eventName} — 주요 이벤트로 등록 완료 (${ke.countingMethod})`);
    } catch (e) {
      const msg = e?.errors?.[0]?.message || e.message;
      console.error(`✗ ${ke.eventName} — 등록 실패: ${msg}`);
    }
  }

  console.log('\n완료. GA4 보고서에 전환이 집계되기까지 24~48시간 걸립니다.');
  console.log('실시간 보고서에서 카카오 버튼 클릭 → lead_click_kakao 즉시 확인 가능.');
}

main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
