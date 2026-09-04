#!/usr/bin/env node
/**
 * IndexNow 제출 스크립트 — Bing·네이버가 소비하는 즉시 색인 프로토콜.
 *
 * 키는 비밀이 아니다(프로토콜 설계상 공개): public/{KEY}.txt로 사이트 소유를 증명하고,
 * 같은 값을 요청 본문에 실어 보낸다. 별도 계정·토큰 불필요.
 *
 * 사용:
 *   node scripts/indexnow-submit.mjs https://studionol.co.kr/ko/pricing [url...]
 *   node scripts/indexnow-submit.mjs --from-sitemap --limit 200 [--filter /guides/]
 *
 * 시점: 새 글 발행·주요 페이지 개편 직후 해당 URL만 제출(스팸성 전량 반복 제출 금지 —
 * --from-sitemap은 초기 1회 시딩이나 대규모 개편 후에만).
 *
 * 상수·submitUrls()는 scripts/indexnow-changed.mjs(CI가 push마다 변경분만 제출하는
 * 경로)가 그대로 재사용한다 — 제출 로직을 두 곳에 복제하지 않기 위해 export한다.
 * 이 파일을 직접 실행할 때의 동작(CLI 인자 파싱·에러 처리)은 바뀌지 않았다.
 */

export const KEY = '9f2c1e8b7a4d4c62a5e3d8f1b6c9a0e4';
export const HOST = 'studionol.co.kr';
export const SITE = `https://${HOST}`;
export const KEY_LOCATION = `${SITE}/${KEY}.txt`;
export const ENDPOINTS = [
  'https://api.indexnow.org/indexnow', // 공유 엔드포인트(참여 엔진 전체에 전파)
  'https://searchadvisor.naver.com/indexnow', // 네이버 직행
];
export const MAX_PER_RUN = 500; // 프로토콜 한도는 10,000이지만 운영상 보수적 캡

/** IndexNow 각 엔드포인트에 URL 목록을 제출한다. 상한·호스트 필터링은 호출부 책임. */
export async function submitUrls(urls) {
  const payload = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: urls };
  console.log(`IndexNow 제출: ${urls.length}개 URL → ${ENDPOINTS.length}개 엔드포인트`);

  const results = [];
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
      });
      // 200/202 = 접수. 4xx는 키 파일 미배포·형식 오류 등.
      console.log(`  ${endpoint} → ${res.status}${res.status === 200 || res.status === 202 ? ' OK' : ''}`);
      results.push({ endpoint, status: res.status });
    } catch (e) {
      console.error(`  ${endpoint} → 실패: ${e.message}`);
      results.push({ endpoint, error: e.message });
    }
  }
  return results;
}

async function urlsFromSitemap(limit, filter) {
  const res = await fetch(`${SITE}/sitemap-0.xml`);
  if (!res.ok) throw new Error(`sitemap fetch 실패: ${res.status}`);
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1])
    // 이미지 <image:loc>도 <loc>로 끝나므로 페이지 URL만: 자기 도메인 + 이미지 확장자 제외
    .filter((u) => u.startsWith(SITE) && !/\.(webp|avif|jpe?g|png|gif)$/i.test(u));
  const unique = [...new Set(locs)];
  const filtered = filter ? unique.filter((u) => u.includes(filter)) : unique;
  return filtered.slice(0, limit);
}

async function main() {
  const args = process.argv.slice(2);
  let urls = [];

  if (args.includes('--from-sitemap')) {
    const limitIdx = args.indexOf('--limit');
    const limit = limitIdx >= 0 ? Math.min(parseInt(args[limitIdx + 1], 10) || MAX_PER_RUN, MAX_PER_RUN) : MAX_PER_RUN;
    const filterIdx = args.indexOf('--filter');
    const filter = filterIdx >= 0 ? args[filterIdx + 1] : null;
    urls = await urlsFromSitemap(limit, filter);
  } else {
    urls = args.filter((a) => a.startsWith('http'));
  }

  if (urls.length === 0) {
    console.error('제출할 URL 없음. 사용법은 파일 상단 주석 참조.');
    process.exit(1);
  }
  const offHost = urls.filter((u) => !u.startsWith(SITE));
  if (offHost.length > 0) {
    console.error(`호스트 불일치 URL ${offHost.length}건 제외:`, offHost.slice(0, 3));
    urls = urls.filter((u) => u.startsWith(SITE));
  }
  urls = urls.slice(0, MAX_PER_RUN);

  await submitUrls(urls);
}

// 직접 실행됐을 때만 main()을 돈다 — indexnow-changed.mjs가 이 파일을 import할 때는
// submitUrls·상수만 재사용하고 CLI 진입점은 건드리지 않는다.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
