#!/usr/bin/env node
/**
 * 스토리 한 편을 Instagram 피드·Threads에 발행한다.
 *
 *   node --env-file=.env.local scripts/social/post.mjs --slug ableton1 [--to ig,threads] [--dry-run] [--force]
 *
 * - 이미지: OG 카드(PNG) → sharp JPEG → Vercel Blob public 업로드(Instagram은 JPEG만 받는다).
 *   OG가 실패하면 썸네일 원본 .jpg로 폴백.
 * - 원장 docs/social/posted.json에 기록. 같은 slug+플랫폼은 --force 없이는 다시 올리지 않는다.
 * - 한 플랫폼 실패는 다른 플랫폼을 되돌리지 않는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { ROOT, graph, requireEnv, hintForError, sleep, PLATFORMS } from './meta.mjs';
import {
  buildInstagramCaption,
  buildThreadsText,
  fallbackJpegUrl,
  ogImageUrl,
  storyUrl,
} from './compose.mjs';

const LEDGER = path.join(ROOT, 'docs/social/posted.json');
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const slug = flag('--slug');
const to = (flag('--to') ?? 'ig,threads').split(',').map((s) => s.trim());
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');

if (!slug) {
  console.error('사용: post.mjs --slug <slug> [--to ig,threads] [--dry-run] [--force]');
  process.exit(2);
}
for (const t of to) if (!PLATFORMS[t]) { console.error(`알 수 없는 플랫폼: ${t}`); process.exit(2); }

function loadStory(s) {
  const file = path.join(ROOT, 'content/stories', `${s}.md`);
  if (!fs.existsSync(file)) throw new Error(`스토리 없음: ${file}`);
  const { data } = matter(fs.readFileSync(file, 'utf8'));
  if (!data.title) throw new Error('frontmatter title 없음');
  return { slug: s, title: data.title, summary: data.summary ?? '', tags: data.tags ?? [], thumbnail: data.thumbnail ?? null };
}

function readLedger() {
  return fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : {};
}
function writeLedger(ledger) {
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  fs.writeFileSync(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`);
}

/** OG PNG → JPEG → Blob. 실패하면 null(호출자가 폴백). */
async function uploadJpegCard(story) {
  const res = await fetch(ogImageUrl(story));
  if (!res.ok) { console.warn(`OG 카드 실패(HTTP ${res.status}) — 썸네일로 폴백`); return null; }
  const png = Buffer.from(await res.arrayBuffer());
  const { default: sharp } = await import('sharp');
  const jpeg = await sharp(png).jpeg({ quality: 85 }).toBuffer();
  const { put } = await import('@vercel/blob');
  const blob = await put(`social/${story.slug}.jpg`, jpeg, {
    access: 'public',
    contentType: 'image/jpeg',
    addRandomSuffix: true,
    token: requireEnv('BLOB_READ_WRITE_TOKEN'),
  });
  return blob.url;
}

async function resolveImageUrl(story) {
  if (dryRun) return `${ogImageUrl(story)}  (dry-run: JPEG 변환·Blob 업로드 생략)`;
  return (await uploadJpegCard(story)) ?? fallbackJpegUrl(story.thumbnail);
}

async function publishInstagram(story, imageUrl) {
  const caption = buildInstagramCaption(story);
  if (dryRun) return { plan: { image_url: imageUrl, caption } };
  const userId = requireEnv(PLATFORMS.ig.userIdKey);
  const { id: creationId } = await graph('ig', 'POST', `/${userId}/media`, { image_url: imageUrl, caption });
  for (let i = 0; i < 20; i++) {
    const { status_code: status } = await graph('ig', 'GET', `/${creationId}`, { fields: 'status_code' });
    if (status === 'FINISHED') break;
    if (status === 'ERROR' || status === 'EXPIRED') throw new Error(`Instagram 컨테이너 ${status}`);
    await sleep(3000);
  }
  const { id } = await graph('ig', 'POST', `/${userId}/media_publish`, { creation_id: creationId });
  const { permalink } = await graph('ig', 'GET', `/${id}`, { fields: 'permalink' });
  return { id, permalink };
}

async function publishThreads(story, imageUrl) {
  const text = buildThreadsText(story);
  const params = imageUrl ? { media_type: 'IMAGE', image_url: imageUrl, text } : { media_type: 'TEXT', text };
  if (dryRun) return { plan: params };
  const userId = requireEnv(PLATFORMS.threads.userIdKey);
  const { id: creationId } = await graph('threads', 'POST', `/${userId}/threads`, params);
  await sleep(imageUrl ? 30000 : 5000); // 문서 권장: 컨테이너 처리 대기
  const { id } = await graph('threads', 'POST', `/${userId}/threads_publish`, { creation_id: creationId });
  const { permalink } = await graph('threads', 'GET', `/${id}`, { fields: 'permalink' });
  return { id, permalink };
}

const publishers = { ig: publishInstagram, threads: publishThreads };

const story = loadStory(slug);
const ledger = readLedger();
const pending = to.filter((t) => {
  if (ledger[slug]?.[t] && !force) {
    console.log(`[${PLATFORMS[t].label}] 이미 발행됨(${ledger[slug][t].permalink ?? ledger[slug][t].id}). --force로 재발행.`);
    return false;
  }
  return true;
});
if (pending.length === 0) process.exit(0);

console.log(`${story.title}\n${storyUrl(slug)}`);
const imageUrl = await resolveImageUrl(story);
console.log(`이미지: ${imageUrl ?? '(없음 — Threads는 텍스트만, Instagram은 건너뜀)'}`);

let failed = false;
for (const t of pending) {
  if (t === 'ig' && !imageUrl) { console.error('[Instagram] JPEG 이미지가 없어 건너뜀'); failed = true; continue; }
  try {
    const result = await publishers[t](story, imageUrl);
    if (dryRun) { console.log(`\n[${PLATFORMS[t].label}] dry-run 계획:\n${JSON.stringify(result.plan, null, 2)}`); continue; }
    ledger[slug] = { ...(ledger[slug] ?? {}), [t]: { ...result, at: new Date().toISOString() } };
    writeLedger(ledger);
    console.log(`[${PLATFORMS[t].label}] 발행: ${result.permalink ?? result.id}`);
  } catch (err) {
    failed = true;
    console.error(`[${PLATFORMS[t].label}] 실패: ${err.message}`);
    const hint = hintForError(err);
    if (hint) console.error(hint);
  }
}
process.exit(failed ? 1 : 0);
