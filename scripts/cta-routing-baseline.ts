#!/usr/bin/env -S npx tsx
/**
 * 스토리 라우팅 기준선 게이트 — 하단 CTA(storyCtaPolicy)와 본문 가격 카드 id
 * (resolveFallbackPriceId)의 판정을 전 ko 스토리에 대해 기록하고, 바뀌면 알린다.
 *
 * 왜 필요한가:
 * 라우팅은 세 층(슬러그 패턴·카테고리 폴백·frontmatter override)이 겹쳐 결정되고, 여러
 * 세션이 각각 한 층씩 만진다. 2026-09-03에 "보컬 테크닉은 lesson이 맞다"는 주석 한 줄과
 * frontmatter 일괄 주입이 합쳐져 보컬 글 76편이 미제공 서비스(보컬 레슨)를 광고하고 있었고,
 * 어떤 테스트도 이걸 몰랐다. 정책이나 frontmatter를 바꿀 때 "판정이 바뀐 페이지 목록"을
 * 강제로 보게 하는 것이 이 게이트다 — 의도한 변경이면 --update로 기준선을 갱신하고 커밋
 * 메시지에 왜 바뀌었는지 남긴다.
 *
 * 사용:
 *   npx tsx scripts/cta-routing-baseline.ts             # 검사 (CI, 바뀌면 exit 1)
 *   npx tsx scripts/cta-routing-baseline.ts --update    # 기준선 갱신
 *   npx tsx scripts/cta-routing-baseline.ts --baseline <path>   # 다른 기준선과 대조(검증용)
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { resolveStoryCTAType } from '../lib/storyCtaPolicy';
import { normalizeStoryCategoryKey } from '../lib/storyCategories';
import { resolveFallbackPriceId } from '../lib/storyAutoFallback';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const STORIES = path.join(ROOT, 'content/stories');
const DEFAULT_BASELINE = path.join(ROOT, 'content/cta-routing.baseline.json');

type Entry = { category: string; cta: string; price: string | null };
type Baseline = { note: string; entries: Record<string, Entry> };

export const computeRouting = (): Record<string, Entry> => {
  const out: Record<string, Entry> = {};
  for (const f of fs.readdirSync(STORIES).sort()) {
    if (!f.endsWith('.md') || /\.(en|zh|es|vi|th|uz)\.md$/.test(f)) continue;
    const slug = f.slice(0, -3);
    const { data } = matter(fs.readFileSync(path.join(STORIES, f), 'utf8'));
    const d = data as Record<string, unknown>;
    const categoryKey = normalizeStoryCategoryKey(String(d.category ?? ''));
    const cta = resolveStoryCTAType({ slug, categoryKey, override: d.cta as never });
    const price = resolveFallbackPriceId({
      categoryKey,
      slug,
      frontmatterFallback: d.inlineFallback as { price?: string } | undefined,
    });
    out[slug] = { category: categoryKey, cta, price };
  }
  return out;
};

export const diffRouting = (base: Record<string, Entry>, now: Record<string, Entry>) => {
  const changed: { slug: string; from: Entry | null; to: Entry | null }[] = [];
  for (const slug of new Set([...Object.keys(base), ...Object.keys(now)])) {
    const a = base[slug] ?? null;
    const b = now[slug] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) changed.push({ slug, from: a, to: b });
  }
  return changed;
};

const fmt = (e: Entry | null) => (e ? `${e.cta}/${e.price ?? '-'}` : '(없음)');

const main = () => {
  const args = process.argv.slice(2);
  const update = args.includes('--update');
  const bi = args.indexOf('--baseline');
  const baselinePath = bi >= 0 ? path.resolve(args[bi + 1]) : DEFAULT_BASELINE;
  const now = computeRouting();

  if (update) {
    const payload: Baseline = {
      note: '스토리 라우팅 기준선(하단 CTA·가격 카드 id). scripts/cta-routing-baseline.ts --update 로 갱신한다.',
      entries: now,
    };
    fs.writeFileSync(baselinePath, `${JSON.stringify(payload, null, 1)}\n`);
    console.log(`기준선 갱신: ${Object.keys(now).length}편 → ${path.relative(ROOT, baselinePath)}`);
    return;
  }
  if (!fs.existsSync(baselinePath)) {
    console.error(`기준선 파일이 없다: ${baselinePath}\n먼저 --update 로 생성할 것.`);
    process.exit(2);
  }
  const base = (JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as Baseline).entries;
  const changed = diffRouting(base, now);
  if (changed.length === 0) {
    console.log(`✅ 라우팅 판정 변화 없음 (${Object.keys(now).length}편)`);
    return;
  }
  // 카테고리 × from→to 로 묶어 한눈에 보이게
  const groups = new Map<string, string[]>();
  for (const c of changed) {
    const key = `${(c.to ?? c.from)?.category ?? '?'} | ${fmt(c.from)} → ${fmt(c.to)}`;
    groups.set(key, [...(groups.get(key) ?? []), c.slug]);
  }
  console.error(`❌ 라우팅 판정이 바뀐 글 ${changed.length}편 (하단CTA/가격카드):`);
  for (const [key, slugs] of [...groups.entries()].sort((x, y) => y[1].length - x[1].length)) {
    console.error(`  ${String(slugs.length).padStart(4)}  ${key}`);
    console.error(`        ${slugs.slice(0, 8).join(', ')}${slugs.length > 8 ? ' …' : ''}`);
  }
  console.error('\n의도한 변경이면: npx tsx scripts/cta-routing-baseline.ts --update  (커밋 메시지에 이유를 남길 것)');
  process.exit(1);
};

if (process.argv[1] && /cta-routing-baseline\.ts$/.test(process.argv[1])) main();
