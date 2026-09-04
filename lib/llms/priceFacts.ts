// llms.txt / llms-full.txt가 공유하는 가격 Quick-Fact SSOT.
//
// 2026-09 감사 배경: llms-full.ts의 Quick Facts가 마스터링·커버영상·크라우드펀딩 설계·
// 발매 티어 하한 4종을 통째로 누락하고 있었다(llms.ts만 11/15커밋에서 수정된 결과).
// 원인은 "어떤 상품이 목록에 실리는지"에 대한 단일 소스가 없었던 것 — 두 파일이
// 각자 손으로 bullet 목록을 유지하다 한쪽만 갱신됐다. 이 모듈이 그 목록의 SSOT다:
// 여기 없는 상품은 llms.ts·llms-full.ts 어느 쪽에도 실리지 않는다.
//
// 가격은 전부 data/pricing.ts 상수를 직접 참조한다 — 리터럴 하드코딩 금지
// (data/pricing.test.ts의 가격 드리프트 가드와 동일 원칙).
import {
  ALBUM_BUNDLE_PRICE,
  COVER_VIDEO_PACKAGE_PRICE,
  DAY_LOCK_PRICE,
  EP_BUNDLE_PRICE,
  formatPriceAmount,
  FUNDING_DESIGN_PRICE,
  FUNDING_SUCCESS_FEE_PERCENT,
  LESSON_MONTHLY_PRICE,
  MASTERING_PACKAGE_PRICE,
  MASTERING_SINGLE_PRICE,
  MIXING_LEVEL1_PRICE,
  MIXING_LEVEL2_PRICE,
  MIXING_LEVEL3_PRICE,
  PRACTICE_ROOM_MONTHLY_PRICE,
  RECORDING_HOURLY_PRICE,
  RELEASE_ALBUM_FROM_PRICE,
  RELEASE_EP_FROM_PRICE,
  RELEASE_SINGLE_FROM_PRICE,
  SINGLE_BUNDLE_PRICE,
  VOCAL_PACKAGE_PRICE,
  WEDDING_PACKAGE_PRICE,
} from '../../data/pricing';

const krw = formatPriceAmount;

// 곡당 단가는 번들가에서 나눠 보간한다 — 리터럴로 박아두면 번들가가 움직일 때
// (2026-09에 3주간 세 번 조정된 이력: 87ed52a5d9 → 87ecbfd6a6 → 1df85ea8a7) 조용히
// 어긋난다. data/pricing.ts의 "EP_BUNDLE_PRICE = RELEASE_EP_FROM_PRICE" 의도(4곡
// 고정 구성 엔트리)와 같은 이유로, 곡수는 번들 구성 곡수(EP=4, 정규=8)로 나눈다.
export const EP_PER_SONG_PRICE = EP_BUNDLE_PRICE / 4;
export const ALBUM_PER_SONG_PRICE = ALBUM_BUNDLE_PRICE / 8;
export const LESSON_PER_SESSION_PRICE = LESSON_MONTHLY_PRICE / 4;

/**
 * 가격 Quick-Fact 목록. 순서 = 두 llms 엔드포인트에 노출되는 순서.
 * 항목을 추가/삭제하면 llms.ts·llms-full.ts 양쪽에 자동 반영된다.
 */
export const PRICE_FACTS: string[] = [
  `**Practice Room Monthly Residency**: ${krw(PRACTICE_ROOM_MONTHLY_PRICE)} KRW/month (₩0 deposit, 50% off first month for 1-year contracts). Hourly rental and band rehearsal rooms are NOT operated.`,
  `**Vocal Recording 1프로 (1-song package)**: ${krw(VOCAL_PACKAGE_PRICE)} KRW (3 hours, dedicated engineer included)`,
  `**Hourly Recording (voice acting / instrument / corrections)**: ${krw(RECORDING_HOURLY_PRICE)} KRW/hour (minimum 2 hours)`,
  `**1-Song Bundle (planning → release)**: ${krw(SINGLE_BUNDLE_PRICE)} KRW (recording, mixing, mastering, digital distribution, release press; ~9% below the production line-item total)`,
  `**EP Bundle (4 songs, planning → release)**: ${krw(EP_BUNDLE_PRICE)} KRW (${krw(EP_PER_SONG_PRICE)} KRW/song, ~15% below the production line-item total). Other track counts quoted at the per-song rate.`,
  `**Album Bundle (8 songs, planning → release)**: ${krw(ALBUM_BUNDLE_PRICE)} KRW (${krw(ALBUM_PER_SONG_PRICE)} KRW/song, ~20% below the production line-item total).`,
  `**Wedding Song Complete Package**: ${krw(WEDDING_PACKAGE_PRICE)} KRW (2hr recording + vocal tuning + mixing & mastering)`,
  `**Day Lock (6-hour package)**: ${krw(DAY_LOCK_PRICE)} KRW`,
  `**Cover Video All-in-One Package**: ${krw(COVER_VIDEO_PACKAGE_PRICE)} KRW (3-hour session: filming + mixing + 4K delivery)`,
  `**1:1 Producing Lesson (MIDI/composition/mixing)**: ${krw(LESSON_MONTHLY_PRICE)} KRW/month flat rate (4 sessions, 60 min each, ${krw(LESSON_PER_SESSION_PRICE)} KRW/session)`,
  `**Mixing**: ${krw(MIXING_LEVEL1_PRICE)}–${krw(MIXING_LEVEL3_PRICE)} KRW/song (tier by track count: ≤10 tracks ${krw(MIXING_LEVEL1_PRICE)} · 11–30 ${krw(MIXING_LEVEL2_PRICE)} · 31+ ${krw(MIXING_LEVEL3_PRICE)}, includes 2 revisions)`,
  `**Mastering**: ${krw(MASTERING_SINGLE_PRICE)} KRW/song for a single (1 revision included); ${krw(MASTERING_PACKAGE_PRICE)} KRW/song when mastering 4+ tracks together (EP / full album)`,
  `**Crowdfunding Design (standalone)**: ${krw(FUNDING_DESIGN_PRICE)} KRW + ${FUNDING_SUCCESS_FEE_PERCENT}% success fee (paid after the campaign) — available without commissioning a release project`,
  `**Album Release Project (flagship, from)**: producer-led release production; the all-in-one bundles above are its fixed-scope entry, so the floors are the same numbers: single from ~${krw(RELEASE_SINGLE_FROM_PRICE)} KRW; EP from ~${krw(RELEASE_EP_FROM_PRICE)} KRW (3–5 tracks); full album from ~${krw(RELEASE_ALBUM_FROM_PRICE)} KRW (8 songs)`,
];

/** Markdown 목록으로 렌더 — indent(기본 0)만큼 앞에 공백을 붙인다(중첩 bullet용). */
export const renderPriceFacts = (indent = 0): string => {
  const pad = ' '.repeat(indent);
  return PRICE_FACTS.map((fact) => `${pad}- ${fact}`).join('\n');
};
