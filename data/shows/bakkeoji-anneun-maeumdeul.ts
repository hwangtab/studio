import type { ShowDefinition } from '../../lib/shows/seed';

/**
 * 〈베어지지 않는 마음들 — 풍천리를 위한 삼청동에서의 밤〉 공연 정의.
 *
 * 등록: `npx tsx scripts/seed-show.ts bakkeoji-anneun-maeumdeul` (dry-run) → `--apply`.
 * 이 파일이 정본이고, 값을 바꾸면 스크립트를 다시 돌린다(멱등).
 *
 * 공개 페이지가 읽는 텍스트 규칙(lib/shows/content.ts):
 *  - title        `메인 제목 — 부제` → splitShowTitle()
 *  - performers   한 줄에 한 명 `이름 — 소개` → parsePerformers()
 *  - description  빈 줄로 문단 구분. 첫 문단이 요약(카드·메일·OG description).
 *
 * 포스터는 파일명에 날짜가 박혀 있다(public/images/shows/). 포스터를 고치면 새 파일명으로 바꾸고
 * 아래 두 상수와 coverImage를 함께 갱신한다(CLAUDE.md "그림을 바꾸면 파일명도 바꾼다").
 */

export const BAKKEOJI_SLUG = 'bakkeoji-anneun-maeumdeul';
export const BAKKEOJI_POSTER = '/images/shows/bakkeoji-poster-20261003.webp';
/** 1200x630 공유 카드용. DB 칸이 없어 상수로만 둔다 — 상세 페이지의 og:image가 이 값을 쓴다. */
export const BAKKEOJI_OG_IMAGE = '/images/shows/bakkeoji-og-20261003.webp';

const PERFORMERS = [
  '자이(Jai) — 특유의 포근하고 깊은 음색으로 일상과 삶의 미세한 결을 어루만지는 싱어송라이터. 락밴드 \'헤디마마\' 활동을 거쳐 현재는 어쿠스틱·인디·로파이·재즈 스타일을 넘나드는 솔로 아티스트로서 독보적인 음악 세계를 구축해 오고 있다.',
  '호와호(Howaho) — 시적인 가사와 몰입감 넘치는 사운드스케이프를 엮어내는 오가닉 일렉트로닉 듀오. 다양한 매체로 국내외 무대를 유영하며, 경계 위에 선 존재들을 위한 사랑과 연대를 노래합니다.',
  '솔가(Solga) — 오랫동안 삶의 현장에서 사람과 자연, 생명의 존엄을 단단하게 노래해 온 싱어송라이터.',
].join('\n');

/** 티켓 가격 — 설명문·티켓 타입이 같은 상수를 쓴다(가격 리터럴 가드: data/pricing.test.ts). */
const PRESALE_PRICE = 25000;
const ON_SITE_PRICE = 30000;
const won = (n: number): string => `${n.toLocaleString('ko-KR')}원`;

const DESCRIPTION = [
  '홍천의 풍천리 마을을 아시나요? 지금 풍천리는 수백 년 된 푸른 숲을 허물고 양수발전소를 세우려는 계획 때문에 오랜 삶의 터전과 소중한 자연이 파괴될 위기에 놓여 있습니다. 마을과 숲을 지키기 위해 주민분들은 오랫동안 외롭고 힘겨운 싸움을 이어오고 계십니다. 마을을 지키기 위해 애쓰시는 주민분들의 목소리에 힘을 보태고, 풍천리의 이야기를 음악으로 나누며 따뜻하게 함께하는 연대의 마음을 모으고자 이번 자리를 마련했습니다.',
  '풍천리 공연은 늘 따뜻한 밥 한 끼를 나누는 마음과 함께해 왔습니다. 이번엔 삼청동 \'라플란드\'에서 사람을 위하는 마음과 정성이 담긴 \'삼청모찬 도시락\'을 준비했습니다. 정성 어린 음식과 다정한 음악으로 마음을 나누는 이 자리에 꼭 함께해 주세요. 10월 24일 라플란드에서 그 맘을 같이 나눠요.',
  '시간: PM 6시 식사 / PM 6:30 공연 시작',
  '티켓 수익은 공연에 참여한 뮤지션들과 공간에게 돌아갑니다.',
  `사전 예매는 ${won(PRESALE_PRICE)}(1드링크 포함)입니다. 현장 판매는 ${won(ON_SITE_PRICE)}(1드링크 포함)이며 이 사이트에서는 받지 않고 공연 당일 현장에서 받습니다.`,
].join('\n\n');

export const bakkeojiShow: ShowDefinition = {
  slug: BAKKEOJI_SLUG,
  title: '베어지지 않는 마음들 — 풍천리를 위한 삼청동에서의 밤',
  presenterName: '자이와 친구들',
  performers: PERFORMERS,
  // TODO(확인 필요): 연령 등급은 주최 확인 전의 중립값이다.
  ageRating: '전연령',
  // TODO(확인 필요): 러닝타임은 식사(6시)부터 공연 종료까지를 가정한 추정값이다.
  runningMinutes: 150,
  venueName: '삼청동 라플란드',
  // TODO(확인 필요): 도로명 주소를 받으면 교체한다. 지금은 확인된 값만 넣었다.
  venueAddress: '삼청동 라플란드',
  description: DESCRIPTION,
  coverImage: BAKKEOJI_POSTER,
  zones: [{ code: 'GA', label: '비지정석', capacity: 50 }],
  // 18:00 식사, 18:30 공연 시작 — startsAt은 공연 시작. 판매마감은 시작 전날 24:00(KST).
  showtimes: [{ startsAt: new Date('2026-10-24T18:30:00+09:00') }],
  ticketTypes: [
    // quota 없음: 구역 정원 50이 한도다. 초대권은 별도 한도(compQuota)를 두지 않는다 — 필요할 때 올린다.
    { zoneCode: 'GA', name: '사전 예매 (1드링크 포함)', price: PRESALE_PRICE, quota: null, compQuota: 0 },
  ],
};
