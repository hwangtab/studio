#!/usr/bin/env node
// GA4 OAuth refresh token 발급 — 1회성 setup 스크립트
// 사용: node --env-file=.env.local scripts/ga4-oauth-setup.mjs
//
// 사전 조건: .env.local에 GSC_OAUTH_CLIENT_ID, GSC_OAUTH_CLIENT_SECRET

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PORT = 43821;
const REDIRECT_URI = `http://localhost:${PORT}`;
// Data API(runReport)는 analytics.readonly, Admin 쓰기(맞춤 측정기준 등록)는 analytics.edit를
// 각각 요구한다. edit는 readonly의 superset이 아니므로 둘 다 부여한다.
const SCOPE = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/analytics.edit',
];

async function main() {
  const clientId = process.env.GSC_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GSC_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('ERROR: GSC_OAUTH_CLIENT_ID, GSC_OAUTH_CLIENT_SECRET 환경변수 누락');
    process.exit(1);
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPE,
    prompt: 'consent',
  });

  console.log('\n=== GA4 OAuth 인증 ===\n');
  console.log('브라우저에서 아래 URL을 열고 hwangtab@gmail.com으로 로그인 후 동의해 주세요:\n');
  console.log(authUrl);
  console.log(`\n로컬 서버 대기 중 (port ${PORT})...`);
  console.log('(문제가 생기면 GCP Console > OAuth 클라이언트 > 승인된 리디렉션 URI에');
  console.log(` http://localhost:${PORT} 이 있는지 확인하세요)\n`);

  await new Promise((resolve, reject) => {
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
        res.end('<h1>✓ 인증 완료!</h1><p>터미널로 돌아가서 refresh token을 복사하세요.</p>');
        server.close();

        // .env.local에 저장 — 기존 GA4_OAUTH_REFRESH_TOKEN 라인이 있으면 교체(중복 방지), 없으면 append.
        const envPath = path.join(ROOT, '.env.local');
        const entry = `GA4_OAUTH_REFRESH_TOKEN="${tokens.refresh_token}"`;
        const current = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
        const next = /^GA4_OAUTH_REFRESH_TOKEN=.*$/m.test(current)
          ? current.replace(/^GA4_OAUTH_REFRESH_TOKEN=.*$/m, entry)
          : `${current}${current.endsWith('\n') || current === '' ? '' : '\n'}${entry}\n`;
        fs.writeFileSync(envPath, next, 'utf-8');

        console.log('✓ 인증 완료!');
        console.log('.env.local에 GA4_OAUTH_REFRESH_TOKEN이 자동 저장됐습니다.');
        console.log('\n다음 단계: node --env-file=.env.local scripts/ga4-fetch.mjs');
        resolve();
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
        console.error(`ERROR: port ${PORT}가 이미 사용 중입니다. 다른 프로세스를 종료 후 재시도하세요.`);
      }
      reject(e);
    });
  });
}

main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
