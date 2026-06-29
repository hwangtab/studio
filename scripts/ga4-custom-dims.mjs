#!/usr/bin/env node
// GA4 Admin API — 맞춤 측정기준(custom dimensions) 조회/생성
// 사용: node --env-file=.env.local scripts/ga4-custom-dims.mjs [--create]
import { google } from 'googleapis';

const oauth2 = new google.auth.OAuth2(
  process.env.GSC_OAUTH_CLIENT_ID,
  process.env.GSC_OAUTH_CLIENT_SECRET,
);
oauth2.setCredentials({ refresh_token: process.env.GA4_OAUTH_REFRESH_TOKEN });
const admin = google.analyticsadmin({ version: 'v1beta', auth: oauth2 });
const parent = `properties/${process.env.GA4_PROPERTY_ID}`;

const WANT = [
  { parameterName: 'field', displayName: 'field', scope: 'EVENT' },
  { parameterName: 'error_code', displayName: 'error_code', scope: 'EVENT' },
  { parameterName: 'error_type', displayName: 'error_type', scope: 'EVENT' },
  { parameterName: 'status_code', displayName: 'status_code', scope: 'EVENT' },
];

async function list() {
  const res = await admin.properties.customDimensions.list({ parent });
  return res.data.customDimensions || [];
}

const existing = await list();
console.log(`기존 맞춤 측정기준 ${existing.length}개:`);
for (const d of existing) console.log(`  - ${d.parameterName} (${d.scope}) "${d.displayName}"`);

if (!process.argv.includes('--create')) {
  console.log('\n(조회만. 생성하려면 --create 추가)');
  process.exit(0);
}

const existingParams = new Set(existing.map((d) => d.parameterName));
for (const dim of WANT) {
  if (existingParams.has(dim.parameterName)) {
    console.log(`SKIP ${dim.parameterName} — 이미 존재`);
    continue;
  }
  try {
    await admin.properties.customDimensions.create({ parent, requestBody: dim });
    console.log(`✓ 생성 완료: ${dim.parameterName}`);
  } catch (e) {
    console.log(`✗ 생성 실패 ${dim.parameterName}: ${e.message.slice(0, 160)}`);
  }
}
