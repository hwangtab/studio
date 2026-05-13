#!/usr/bin/env node
// OAuth2 1회 부트스트랩 — 브라우저로 hwangtab@gmail.com 로그인 → refresh_token 발급 → .env.local 자동 추가.
//
// 전제: ~/.config/gsc/oauth-client.json 위치에 데스크톱 앱 OAuth client_secret JSON.
//
// 사용:
//   node scripts/gsc-oauth-bootstrap.mjs

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { google } from 'googleapis';
import os from 'node:os';

const CLIENT_SECRET_PATH = path.join(os.homedir(), '.config/gsc/oauth-client.json');
const ENV_LOCAL = path.join(process.cwd(), '.env.local');
const SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly'];
const LOOPBACK_PORT = 53682;
const REDIRECT_URI = `http://127.0.0.1:${LOOPBACK_PORT}/oauth2callback`;

function loadClient() {
  if (!fs.existsSync(CLIENT_SECRET_PATH)) {
    console.error(`X ${CLIENT_SECRET_PATH} 파일이 없습니다.`);
    console.error('   Cloud Console에서 OAuth 클라이언트 ID (데스크톱 앱) JSON 다운로드 후:');
    console.error(`   mv ~/Downloads/client_secret_*.json ${CLIENT_SECRET_PATH}`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(CLIENT_SECRET_PATH, 'utf-8'));
  const key = raw.installed || raw.web;
  if (!key) {
    console.error('X JSON 구조가 예상과 다름 - installed 또는 web 키가 없음');
    process.exit(1);
  }
  return { client_id: key.client_id, client_secret: key.client_secret };
}

function upsertEnvVar(file, name, value) {
  let body = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
  const line = `${name}=${value}`;
  const re = new RegExp(`^${name}=.*$`, 'm');
  if (re.test(body)) {
    body = body.replace(re, line);
  } else {
    if (body && !body.endsWith('\n')) body += '\n';
    body += line + '\n';
  }
  fs.writeFileSync(file, body, 'utf-8');
}

function openBrowser(url) {
  // execFile은 shell 인터프리테이션 없이 인자 배열을 그대로 전달 - 안전.
  const platform = process.platform;
  if (platform === 'darwin') execFile('open', [url], () => {});
  else if (platform === 'win32') execFile('cmd', ['/c', 'start', '', url], () => {});
  else execFile('xdg-open', [url], () => {});
}

async function main() {
  const { client_id, client_secret } = loadClient();
  const oauth2 = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  console.log('> 브라우저가 자동으로 열립니다. hwangtab@gmail.com으로 로그인 후 권한 허용.');
  console.log('  열리지 않으면 이 URL 수동 복사:\n');
  console.log('  ' + authUrl + '\n');

  openBrowser(authUrl);

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url.startsWith('/oauth2callback')) {
        res.writeHead(404); res.end(); return;
      }
      const u = new URL(req.url, REDIRECT_URI);
      const c = u.searchParams.get('code');
      const err = u.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      if (err) {
        res.end(`<h1>OAuth 오류</h1><p>${err}</p>`);
        server.close();
        reject(new Error('OAuth error: ' + err));
        return;
      }
      res.end('<h1>OK</h1><p>이 창은 닫아도 됩니다. 터미널로 돌아가세요.</p>');
      server.close();
      resolve(c);
    });
    server.listen(LOOPBACK_PORT, '127.0.0.1', () => {
      console.log(`  콜백 대기 중 (http://127.0.0.1:${LOOPBACK_PORT})...`);
    });
  });

  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    console.error('\nX refresh_token이 없습니다. consent 화면에서 권한을 새로 승인하지 않았거나, 이미 발급된 케이스.');
    console.error('   해결: https://myaccount.google.com/permissions 에서 "Studio NOL GSC Reader" 액세스 권한 제거 후 이 스크립트 재실행.');
    process.exit(1);
  }

  upsertEnvVar(ENV_LOCAL, 'GSC_OAUTH_CLIENT_ID', client_id);
  upsertEnvVar(ENV_LOCAL, 'GSC_OAUTH_CLIENT_SECRET', client_secret);
  upsertEnvVar(ENV_LOCAL, 'GSC_OAUTH_REFRESH_TOKEN', tokens.refresh_token);

  console.log('\nOK. .env.local에 다음 3개 변수 저장됨:');
  console.log('   GSC_OAUTH_CLIENT_ID');
  console.log('   GSC_OAUTH_CLIENT_SECRET');
  console.log('   GSC_OAUTH_REFRESH_TOKEN');
  console.log('\n이제: node --env-file=.env.local scripts/gsc-pseo-audit.mjs');
}

main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
