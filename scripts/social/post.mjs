#!/usr/bin/env node
/**
 * Instagram 피드·Threads 발행. 두 가지 입력을 받는다.
 *
 *   스토리:  post.mjs --slug ableton1 [--to ig,threads] [--dry-run] [--force]
 *   임의 글: post.mjs --text "…" --image <파일|URL> [--to …] [--dry-run] [--force]
 *            post.mjs --text-file post.txt --image …
 *
 * - 스토리는 frontmatter로 캡션을 조립하고(compose.mjs), 임의 글은 준 문장을 **그대로** 쓴다.
 *   공연·발매 안내처럼 글이 사이트에 없는 경우가 있어서 두 경로를 둔다.
 * - 이미지: 로컬 파일이면 sharp로 JPEG 변환(긴 변 1440) 후 Blob에 올리고, 공개 주소는
 *   /api/social/media/<파일명>으로 만든다(Blob 저장소가 계약서 때문에 private이라 직접
 *   공개 URL을 못 쓴다). Instagram은 공개 URL의 JPEG만 받고 비율 0.8~1.91만 허용한다.
 * - 원장 docs/social/posted.json에 기록. 같은 키+플랫폼은 --force 없이는 다시 올리지 않는다.
 *   임의 글의 키는 본문 해시라, 같은 글을 두 번 실행해도 중복 발행되지 않는다.
 * - 한 플랫폼 실패는 다른 플랫폼을 되돌리지 않는다.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { ROOT, graph, requireEnv, hintForError, sleep, PLATFORMS, ensureFreshTokens } from './meta.mjs';
import {
  SITE,
  THREADS_TEXT_LIMIT,
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
const textArg = flag('--text');
const textFile = flag('--text-file');
const image = flag('--image');
const to = (flag('--to') ?? 'ig,threads').split(',').map((s) => s.trim());
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');

const USAGE = '사용: post.mjs --slug <slug> | --text "…" --image <파일|URL>  [--to ig,threads] [--dry-run] [--force]';
if (!slug && !textArg && !textFile) { console.error(USAGE); process.exit(2); }
if (slug && (textArg || textFile)) { console.error('--slug 와 --text 는 함께 쓸 수 없다'); process.exit(2); }
for (const t of to) if (!PLATFORMS[t]) { console.error(`알 수 없는 플랫폼: ${t}`); process.exit(2); }

function readLedger() {
  return fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : {};
}
function writeLedger(ledger) {
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  fs.writeFileSync(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`);
}

/** 발행 대상 한 건 — 어떤 입력이든 여기로 모인다. */
function buildItem() {
  if (slug) {
    const file = path.join(ROOT, 'content/stories', `${slug}.md`);
    if (!fs.existsSync(file)) throw new Error(`스토리 없음: ${file}`);
    const { data } = matter(fs.readFileSync(file, 'utf8'));
    if (!data.title) throw new Error('frontmatter title 없음');
    const story = { slug, title: data.title, summary: data.summary ?? '', tags: data.tags ?? [], thumbnail: data.thumbnail ?? null };
    return {
      key: slug,
      heading: `${story.title}\n${storyUrl(slug)}`,
      igCaption: buildInstagramCaption(story),
      threadsText: buildThreadsText(story),
      story,
    };
  }

  const text = (textFile ? fs.readFileSync(path.resolve(textFile), 'utf8') : textArg).trim();
  if (!text) throw new Error('본문이 비어 있다');
  // 임의 글은 준 문장을 그대로 쓴다. 잘라내면 뜻이 바뀌므로 넘치면 멈춘다.
  if (text.length > THREADS_TEXT_LIMIT && to.includes('threads')) {
    throw new Error(`Threads 본문 ${text.length}자 — ${THREADS_TEXT_LIMIT}자를 넘는다`);
  }
  const key = `adhoc-${crypto.createHash('sha1').update(text).digest('hex').slice(0, 8)}`;
  return { key, heading: text.split('\n')[0], igCaption: text, threadsText: text, story: null };
}

/**
 * 버퍼를 JPEG로 바꿔 Blob에 올리고 공개 주소를 돌려준다.
 *
 * Blob 저장소는 계약서 PDF 때문에 private이라 public 업로드를 섞을 수 없다. 대신
 * `social/` 접두사로 올리고 pages/api/social/media 라우트가 그 접두사만 공개로 내보낸다.
 */
async function uploadJpeg(buffer, name) {
  const { default: sharp } = await import('sharp');
  const jpeg = await sharp(buffer)
    .resize({ width: 1440, height: 1440, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
  const { put } = await import('@vercel/blob');
  const blob = await put(`social/${name}.jpg`, jpeg, {
    access: 'private',
    contentType: 'image/jpeg',
    addRandomSuffix: true,
    token: requireEnv('BLOB_READ_WRITE_TOKEN'),
  });
  return `${SITE}/api/social/media/${blob.pathname.replace(/^social\//, '')}`;
}

async function resolveImageUrl(item) {
  if (image) {
    if (/^https?:\/\//.test(image)) return image;
    const file = path.resolve(image);
    if (!fs.existsSync(file)) throw new Error(`이미지 없음: ${file}`);
    if (dryRun) return `${file}  (dry-run: JPEG 변환·Blob 업로드 생략)`;
    return uploadJpeg(fs.readFileSync(file), item.key);
  }
  if (!item.story) return null;
  if (dryRun) return `${ogImageUrl(item.story)}  (dry-run: JPEG 변환·Blob 업로드 생략)`;
  const res = await fetch(ogImageUrl(item.story));
  if (res.ok) return uploadJpeg(Buffer.from(await res.arrayBuffer()), item.key);
  console.warn(`OG 카드 실패(HTTP ${res.status}) — 썸네일로 폴백`);
  return fallbackJpegUrl(item.story.thumbnail);
}

async function publishInstagram(item, imageUrl) {
  if (dryRun) return { plan: { image_url: imageUrl, caption: item.igCaption } };
  const userId = requireEnv(PLATFORMS.ig.userIdKey);
  const { id: creationId } = await graph('ig', 'POST', `/${userId}/media`, { image_url: imageUrl, caption: item.igCaption });
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

async function publishThreads(item, imageUrl) {
  const params = imageUrl
    ? { media_type: 'IMAGE', image_url: imageUrl, text: item.threadsText }
    : { media_type: 'TEXT', text: item.threadsText };
  if (dryRun) return { plan: params };
  const userId = requireEnv(PLATFORMS.threads.userIdKey);
  const { id: creationId } = await graph('threads', 'POST', `/${userId}/threads`, params);
  await sleep(imageUrl ? 30000 : 5000); // 문서 권장: 컨테이너 처리 대기
  const { id } = await graph('threads', 'POST', `/${userId}/threads_publish`, { creation_id: creationId });
  const { permalink } = await graph('threads', 'GET', `/${id}`, { fields: 'permalink' });
  return { id, permalink };
}

const publishers = { ig: publishInstagram, threads: publishThreads };

const item = buildItem();
const ledger = readLedger();
const pending = to.filter((t) => {
  if (ledger[item.key]?.[t] && !force) {
    console.log(`[${PLATFORMS[t].label}] 이미 발행됨(${ledger[item.key][t].permalink ?? ledger[item.key][t].id}). --force로 재발행.`);
    return false;
  }
  return true;
});
if (pending.length === 0) process.exit(0);

if (!dryRun) await ensureFreshTokens(pending);

console.log(item.heading);
const imageUrl = await resolveImageUrl(item);
console.log(`이미지: ${imageUrl ?? '(없음 — Threads는 텍스트만, Instagram은 건너뜀)'}`);

let failed = false;
for (const t of pending) {
  if (t === 'ig' && !imageUrl) { console.error('[Instagram] JPEG 이미지가 없어 건너뜀'); failed = true; continue; }
  try {
    const result = await publishers[t](item, imageUrl);
    if (dryRun) { console.log(`\n[${PLATFORMS[t].label}] dry-run 계획:\n${JSON.stringify(result.plan, null, 2)}`); continue; }
    ledger[item.key] = { ...(ledger[item.key] ?? {}), [t]: { ...result, at: new Date().toISOString() } };
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
