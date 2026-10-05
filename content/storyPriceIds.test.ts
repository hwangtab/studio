/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

import { getPricingData } from '../data/pricing';
import { buyerIntentHubs } from '../data/buyerIntentHubs';

/**
 * 스토리가 가리키는 가격 카드 id가 실제로 있는가.
 *
 * InlinePriceCallout은 id를 못 찾으면 **아무것도 그리지 않는다**(본문에 흔적을 남기지 않으려는
 * 설계). 그래서 오퍼 id를 바꾸거나 지우면 그 id를 물고 있던 글의 가격 카드가 에러 없이 사라진다.
 * 2026-09-26 Day Lock 재편에서 `recording-daylock`이 `-4h`/`-8h`로 갈리면서 11편이 그렇게
 * 비었고, cta-routing 기준선도 옛 id 문자열끼리 "일치"로 판정해 CI가 초록이었다.
 * 이 테스트는 문자열이 아니라 **존재**를 본다.
 */
const pools = getPricingData('ko');
const VALID_IDS = new Set<string>([
  ...pools.specialPackages.map((o) => o.id),
  ...pools.recordingOffers.map((o) => o.id),
  ...pools.mixingOffers.map((o) => o.id),
  ...pools.masteringOffers.map((o) => o.id),
  ...pools.additionalServices.map((o) => o.id),
  // 2026-10-05 — 작곡·편곡·MR 정가(InlinePriceCallout의 'arrangement' 풀과 같은 목록)
  ...pools.arrangementOffers.map((o) => o.id),
  ...Object.values(buyerIntentHubs)
    .map((h) => h.pricingFallback?.id)
    .filter((id): id is string => Boolean(id)),
]);

const STORIES = path.join(process.cwd(), 'content/stories');

describe('스토리 가격 카드 id', () => {
  const broken: string[] = [];
  for (const file of fs.readdirSync(STORIES).filter((f) => f.endsWith('.md'))) {
    const { data, content } = matter(fs.readFileSync(path.join(STORIES, file), 'utf-8'));
    const fallback = (data as { inlineFallback?: { price?: string } }).inlineFallback?.price;
    if (fallback && !VALID_IDS.has(fallback)) broken.push(`${file}: inlineFallback.price ${fallback}`);
    for (const m of content.matchAll(/%%price:([\w-]+)%%/g)) {
      if (!VALID_IDS.has(m[1])) broken.push(`${file}: %%price:${m[1]}%%`);
    }
  }

  it('frontmatter와 본문 숏코드의 가격 id가 전부 실재한다', () => {
    expect(broken).toEqual([]);
  });

  it('라우팅 기준선에 적힌 가격 id도 전부 실재한다', () => {
    const { entries } = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'content/cta-routing.baseline.json'), 'utf-8'),
    ) as { entries: Record<string, { price?: string | null }> };
    expect(Object.keys(entries).length).toBeGreaterThan(1000);
    const stale = Object.entries(entries)
      .filter(([, v]) => v.price && !VALID_IDS.has(v.price))
      .map(([slug, v]) => `${slug}: ${v.price}`);
    expect(stale).toEqual([]);
  });
});
