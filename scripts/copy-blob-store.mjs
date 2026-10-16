#!/usr/bin/env node
/**
 * Blob 저장소 → 다른 Blob 저장소로 같은 경로·같은 형식 그대로 복사한다.
 *
 * 2026-10 함수 지역을 hnd1로 옮긴 뒤, iad1에 남은 private 저장소(seo-snapshots)를 도쿄로 옮기려고 만들었다.
 * 저장소는 지역을 바꿀 수 없어 새로 만들고 복사해야 한다. 절차는 CLAUDE.md "함수 지역은 도쿄(hnd1)다".
 *
 *   node --env-file=.env.local scripts/copy-blob-store.mjs --dry-run   # 무엇을 복사할지 보기
 *   node --env-file=.env.local scripts/copy-blob-store.mjs             # 복사(다시 돌려도 안전 — 같은 파일은 건너뛴다)
 *   node --env-file=.env.local scripts/copy-blob-store.mjs --verify    # 두 저장소의 내용 해시 대조
 *
 * 원본 토큰은 BLOB_READ_WRITE_TOKEN, 대상 토큰은 BLOB_NEXT_READ_WRITE_TOKEN(새 저장소를 `BLOB_NEXT` 접두사로
 * 프로젝트에 연결하면 생기는 이름). 둘이 같은 저장소면 멈춘다. 원본은 읽기만 한다 — 지우지 않는다.
 *
 * 경로가 같으면 코드는 그대로 동작한다: 펀딩 미디어·감상실 음원·서류는 경로로 다루고, 계약서 PDF도
 * 경로로 다루게 바꿨다(lib/contracts/pdfPath.ts). 주소(호스트 = 저장소 ID)는 바뀐다.
 */
import { createHash } from 'node:crypto';

import { get, list, put } from '@vercel/blob';

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const VERIFY = args.has('--verify');

// .env.local의 OIDC 토큰이 있으면 SDK가 토큰 대신 그쪽을 고른다 — 이 스크립트는 토큰을 명시해 쓴다.
delete process.env.VERCEL_OIDC_TOKEN;
delete process.env.BLOB_STORE_ID;

const SRC = process.env.BLOB_READ_WRITE_TOKEN;
const DEST = process.env.BLOB_NEXT_READ_WRITE_TOKEN;
if (!SRC || !DEST) {
  console.error('BLOB_READ_WRITE_TOKEN(원본)과 BLOB_NEXT_READ_WRITE_TOKEN(대상)이 모두 필요합니다.');
  process.exit(1);
}
/** 토큰 형식은 `vercel_blob_rw_<storeId>_<secret>` — 저장소 ID만 보여 준다. */
const storeIdOf = (token) => token.split('_')[3] ?? '?';
if (storeIdOf(SRC) === storeIdOf(DEST)) {
  console.error(`원본과 대상이 같은 저장소입니다(${storeIdOf(SRC)}).`);
  process.exit(1);
}
console.log(`원본 ${storeIdOf(SRC)} → 대상 ${storeIdOf(DEST)}${DRY_RUN ? ' (dry-run)' : ''}${VERIFY ? ' (verify)' : ''}`);

const listAll = async (token) => {
  const out = [];
  let cursor;
  do {
    const page = await list({ token, cursor, limit: 1000 });
    out.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
};

const download = async (pathname, token) => {
  const res = await get(pathname, { access: 'private', token });
  if (!res || res.statusCode !== 200) throw new Error(`읽기 실패: ${pathname}`);
  return { bytes: Buffer.from(await new Response(res.stream).arrayBuffer()), meta: res.blob };
};

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** `public, max-age=2592000` → 2592000. 못 읽으면 기본값(SDK 기본 1개월)에 맡긴다. */
const maxAgeOf = (cacheControl) => {
  const m = /max-age=(\d+)/.exec(cacheControl ?? '');
  return m ? Number(m[1]) : undefined;
};

const src = await listAll(SRC);
const dest = new Map((await listAll(DEST)).map((b) => [b.pathname, b]));
const totalMb = (src.reduce((s, b) => s + b.size, 0) / 1e6).toFixed(1);
console.log(`원본 ${src.length}개 ${totalMb}MB · 대상에 이미 ${dest.size}개`);

let copied = 0;
let skipped = 0;
let mismatched = 0;

for (const b of src) {
  const there = dest.get(b.pathname);

  if (VERIFY) {
    if (!there) {
      console.error(`  ✗ 대상에 없음  ${b.pathname}`);
      mismatched++;
      continue;
    }
    const [a, c] = await Promise.all([download(b.pathname, SRC), download(b.pathname, DEST)]);
    const same = sha256(a.bytes) === sha256(c.bytes) && a.meta.contentType === c.meta.contentType;
    if (!same) {
      console.error(`  ✗ 내용·형식 다름  ${b.pathname} (${a.meta.contentType} / ${c.meta.contentType})`);
      mismatched++;
    } else {
      console.log(`  ✓ ${b.pathname}`);
    }
    continue;
  }

  // 같은 크기이고 원본보다 나중에 올라갔으면 이미 복사한 것이다. 내용까지는 --verify가 본다.
  if (there && there.size === b.size && new Date(there.uploadedAt) >= new Date(b.uploadedAt)) {
    skipped++;
    continue;
  }

  console.log(`  → ${b.pathname} (${(b.size / 1e6).toFixed(1)}MB)${there ? ' [갱신]' : ''}`);
  if (DRY_RUN) {
    copied++;
    continue;
  }
  const { bytes, meta } = await download(b.pathname, SRC);
  await put(b.pathname, bytes, {
    access: 'private',
    token: DEST,
    contentType: meta.contentType,
    cacheControlMaxAge: maxAgeOf(meta.cacheControl),
    addRandomSuffix: false,
    allowOverwrite: true,
    multipart: bytes.length > 5 * 1024 * 1024,
  });
  copied++;
}

if (VERIFY) {
  const extra = [...dest.keys()].filter((p) => !src.some((b) => b.pathname === p));
  for (const p of extra) console.log(`  · 대상에만 있음  ${p}`);
  console.log(`대조 끝 — 다름 ${mismatched}건, 대상에만 있음 ${extra.length}건`);
  process.exit(mismatched > 0 ? 1 : 0);
}
console.log(`${DRY_RUN ? '복사 예정' : '복사'} ${copied}개 · 건너뜀 ${skipped}개`);
