#!/usr/bin/env node
// GA4 주요 이벤트(Key Event = 전환) 선언적 동기화 스크립트
// 사용: node --env-file=.env.local scripts/ga4-set-key-events.mjs           (누락분 생성 + 잉여분 미리보기)
//       node --env-file=.env.local scripts/ga4-set-key-events.mjs --prune   (잉여분까지 실제 해제)
//
// 하는 일:
//   GA4 속성의 주요 이벤트 집합을 KEY_EVENTS(정식 5종)와 **정확히 일치**시킨다.
//   - 누락된 정식 이벤트 → 생성.
//   - 정식 5종에 없는 잉여 주요 이벤트(page_view·scroll·click·오류 이벤트 등) →
//     기본 실행에서는 "해제 예정"으로 보고만 하고, --prune 플래그가 있을 때만 실제 해제.
//   해제는 이벤트/데이터를 지우지 않고 "전환 표시"만 내린다(가역적).
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

  const prune = process.argv.includes('--prune');

  // 기존 주요 이벤트 조회 (name + eventName 보존 — 해제는 리소스 name이 필요)
  let existing = [];
  try {
    const listRes = await admin.properties.keyEvents.list({ parent, pageSize: 200 });
    existing = (listRes.data.keyEvents || []).map((k) => ({ name: k.name, eventName: k.eventName }));
  } catch (e) {
    const msg = e?.errors?.[0]?.message || e.message;
    if (/insufficient|scope|permission/i.test(msg)) {
      console.error('\nERROR: 권한 부족. analytics.edit 재인증이 필요합니다.');
      console.error('  .env.local에서 GA4_OAUTH_EDIT_REFRESH_TOKEN 줄을 삭제하고 다시 실행하세요.\n');
      process.exit(1);
    }
    throw e;
  }

  const existingNames = existing.map((k) => k.eventName);
  const targetNames = new Set(KEY_EVENTS.map((k) => k.eventName));

  console.log(`현재 등록된 주요 이벤트(${existing.length}): ${existingNames.length ? existingNames.join(', ') : '(없음)'}\n`);

  // 1) 누락된 정식 이벤트 생성
  console.log('— 정식 전환 이벤트 동기화 —');
  for (const ke of KEY_EVENTS) {
    if (existingNames.includes(ke.eventName)) {
      console.log(`= ${ke.eventName} — 이미 등록됨 (skip)`);
      continue;
    }
    try {
      await admin.properties.keyEvents.create({
        parent,
        requestBody: { eventName: ke.eventName, countingMethod: ke.countingMethod },
      });
      console.log(`✓ ${ke.eventName} — 주요 이벤트로 등록 (${ke.countingMethod})`);
    } catch (e) {
      const msg = e?.errors?.[0]?.message || e.message;
      console.error(`✗ ${ke.eventName} — 등록 실패: ${msg}`);
    }
  }

  // 2) 잉여 주요 이벤트 정리 (page_view·scroll·click·session_start·오류 이벤트 등).
  //    이것들이 전환으로 남아 있으면 GA4 conversions가 무의미해진다.
  const extras = existing.filter((k) => !targetNames.has(k.eventName));
  console.log('\n— 잉여 주요 이벤트 정리 —');
  if (extras.length === 0) {
    console.log('정식 5종 외 잉여 주요 이벤트 없음. 집합이 이미 깨끗합니다.');
  } else if (!prune) {
    console.log(`해제 예정 ${extras.length}종 (전환 표시만 내림 — 이벤트/데이터는 보존, 가역적):`);
    extras.forEach((k) => console.log(`  ⚠ ${k.eventName}`));
    console.log('\n실제로 해제하려면 --prune 플래그로 다시 실행하세요:');
    console.log('  node --env-file=.env.local scripts/ga4-set-key-events.mjs --prune');
  } else {
    for (const k of extras) {
      try {
        await admin.properties.keyEvents.delete({ name: k.name });
        console.log(`✓ ${k.eventName} — 전환 표시 해제`);
      } catch (e) {
        const msg = e?.errors?.[0]?.message || e.message;
        console.error(`✗ ${k.eventName} — 해제 실패: ${msg}`);
      }
    }
  }

  console.log('\n완료. GA4 보고서에 반영되기까지 24~48시간 걸립니다.');
  console.log('실시간 보고서에서 카카오 버튼 클릭 → lead_click_kakao 즉시 확인 가능.');
}

main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
