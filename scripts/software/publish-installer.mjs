#!/usr/bin/env node
/**
 * 설치 파일 하나를 R2(비공개 버킷, `software/<slug>/<version>/<파일 이름>`)에 올리고, 카탈로그에 붙일 `downloads` 한 줄을 찍는다.
 *
 *   node --env-file=.env.local scripts/software/publish-installer.mjs --slug analog-harmonizer --version 1.0.0 --platform macos --file ./AnalogHarmonizer-1.0.0.dmg
 *   … --dry-run   올리지 않고 sha256·크기·키만 계산
 *
 * - **같은 키가 이미 있으면 거부한다.** 버전마다 새 키로 올린다 — 덮어쓰면 카탈로그의 sha256과 실제 파일이 어긋난다.
 * - 코드서명·공증(macOS Developer ID, Windows 인증서)을 마친 **최종 파일**을 올릴 것. 올린 뒤에는 바꾸지 않는다.
 * - 화면·플러그인은 이 키를 직접 쓰지 않는다 — `/api/software/download/<slug>/<version>/<platform>`이 서명 주소로 보낸다.
 * - env: R2_ACCOUNT_ENDPOINT·R2_BUCKET·R2_ACCESS_KEY_ID·R2_SECRET_ACCESS_KEY(펀딩·상점과 같은 버킷).
 */
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import { parseArgs } from 'node:util';

import { AwsClient } from 'aws4fetch';

const { values } = parseArgs({
  options: {
    slug: { type: 'string' },
    version: { type: 'string' },
    platform: { type: 'string' },
    file: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
});

const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

const { slug, version, platform, file } = values;
if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) fail('--slug는 소문자·숫자·하이픈(카탈로그 slug)');
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) fail('--version은 1.2.3 형식');
if (platform !== 'macos' && platform !== 'windows') fail('--platform은 macos 또는 windows');
if (!file) fail('--file 경로가 필요합니다');

const name = basename(file);
if (!/^[A-Za-z0-9._-]+$/.test(name)) fail(`파일 이름은 영문·숫자·. _ - 만: ${name}`);
const key = `software/${slug}/${version}/${name}`;
const size = statSync(file).size;
const body = readFileSync(file);
const sha256 = createHash('sha256').update(body).digest('hex');

const line = `{ platform: '${platform}', objectKey: '${key}', sha256: '${sha256}', sizeBytes: ${size} },`;

if (values['dry-run']) {
  console.log('(dry-run — 올리지 않았습니다)');
  console.log(line);
  process.exit(0);
}

for (const v of ['R2_ACCOUNT_ENDPOINT', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) {
  if (!process.env[v]) fail(`${v}이(가) 없습니다 — node --env-file=.env.local 로 실행하세요`);
}
const client = new AwsClient({
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  service: 's3',
  region: 'auto',
});
const url = `${process.env.R2_ACCOUNT_ENDPOINT}/${process.env.R2_BUCKET}/${key}`;

const head = await client.fetch(url, { method: 'HEAD' });
if (head.status !== 404) {
  if (head.ok) fail(`이미 있는 키입니다: ${key}\n버전을 올려 새 키로 올리세요(덮어쓰면 카탈로그 sha256과 어긋납니다).`);
  fail(`R2 확인 실패: HTTP ${head.status}`);
}

console.log(`올리는 중: ${key} (${(size / 1024 / 1024).toFixed(1)} MB)`);
const put = await client.fetch(url, {
  method: 'PUT',
  body,
  headers: { 'Content-Type': 'application/octet-stream', 'x-amz-meta-sha256': sha256 },
});
if (!put.ok) fail(`올리기 실패: HTTP ${put.status} ${await put.text()}`);

const check = await client.fetch(url, { method: 'HEAD' });
if (!check.ok || Number(check.headers.get('content-length')) !== size) fail('올린 뒤 확인 실패 — 크기가 다릅니다. 다시 올리세요.');

console.log('완료. 카탈로그 releases[].downloads에 붙이세요:');
console.log(line);
