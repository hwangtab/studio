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
 */

const KEY = '9f2c1e8b7a4d4c62a5e3d8f1b6c9a0e4';
const HOST = 'studionol.co.kr';
const SITE = `https://${HOST}`;
const KEY_LOCATION = `${SITE}/${KEY}.txt`;
const ENDPOINTS = [
  'https://api.indexnow.org/indexnow', // 공유 엔드포인트(참여 엔진 전체에 전파)
  'https://searchadvisor.naver.com/indexnow', // 네이버 직행
];
const MAX_PER_RUN = 500; // 프로토콜 한도는 10,000이지만 운영상 보수적 캡

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

  const payload = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: urls };
  console.log(`IndexNow 제출: ${urls.length}개 URL → ${ENDPOINTS.length}개 엔드포인트`);

  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
      });
      // 200/202 = 접수. 4xx는 키 파일 미배포·형식 오류 등.
      console.log(`  ${endpoint} → ${res.status}${res.status === 200 || res.status === 202 ? ' OK' : ''}`);
    } catch (e) {
      console.error(`  ${endpoint} → 실패: ${e.message}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
