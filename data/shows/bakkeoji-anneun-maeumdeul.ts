import type { ShowDefinition } from '../../lib/shows/seed';

/**
 * 〈베어지지 않는 마음들 — 풍천리를 위한 삼청동에서의 밤〉 공연 정의.
 *
 * 등록: `npx tsx scripts/seed-show.ts bakkeoji-anneun-maeumdeul` (dry-run) → `--apply`.
 * 이 파일이 정본이고, 값을 바꾸면 스크립트를 다시 돌린다(멱등). 새 공연은 이 파일을 복사해
 * 값만 바꾸고 data/shows/index.ts에 한 줄 더하면 된다 — 코드는 손대지 않는다.
 *
 * 이미지는 public/images/shows/ 아래 파일명에 날짜가 박혀 있다. 그림을 바꾸면 새 파일명으로
 * 바꾼다(/images/**는 immutable 1년 캐시 — CLAUDE.md "그림을 바꾸면 파일명도 바꾼다").
 * 시드가 파일 존재와 ogImage 치수(1200x630)를 검증한다.
 */

export const BAKKEOJI_SLUG = 'bakkeoji-anneun-maeumdeul';

/** 티켓 가격 — 안내문·티켓 타입이 같은 상수를 쓴다(가격 리터럴 가드: data/pricing.test.ts). */
const PRESALE_PRICE = 25000;
const ON_SITE_PRICE = 30000;
const won = (n: number): string => `${n.toLocaleString('ko-KR')}원`;

export const bakkeojiShow: ShowDefinition = {
  slug: BAKKEOJI_SLUG,
  title: '베어지지 않는 마음들',
  subtitle: '풍천리를 위한 삼청동에서의 밤',
  presenterName: '자이와 친구들',
  performers: [
    {
      name: '자이(Jai)',
      bio: "특유의 포근하고 깊은 음색으로 일상과 삶의 미세한 결을 어루만지는 싱어송라이터. 락밴드 '헤디마마' 활동을 거쳐 현재는 어쿠스틱·인디·로파이·재즈 스타일을 넘나드는 솔로 아티스트로서 독보적인 음악 세계를 구축해 오고 있다.",
      photo: '/images/shows/bakkeoji-jai-20261003.webp',
    },
    {
      name: '호와호(Howaho)',
      bio: '시적인 가사와 몰입감 넘치는 사운드스케이프를 엮어내는 오가닉 일렉트로닉 듀오. 다양한 매체로 국내외 무대를 유영하며, 경계 위에 선 존재들을 위한 사랑과 연대를 노래합니다.',
      photo: '/images/shows/bakkeoji-howaho-20261003.webp',
    },
    {
      name: '솔가(Solga)',
      bio: '오랫동안 삶의 현장에서 사람과 자연, 생명의 존엄을 단단하게 노래해 온 싱어송라이터.',
      photo: '/images/shows/bakkeoji-solga-20261003.webp',
    },
  ],
  ageRating: '전체 관람가',
  // 공연 시간 약 100분(주최 확인, 2026-10-03). 식사(18:00)는 포함하지 않는다.
  runningMinutes: 100,
  venueName: '삼청동 라플란드',
  venueAddress: '서울특별시 종로구 삼청로 83 가동 1층',
  description: [
    '홍천의 풍천리 마을을 아시나요? 지금 풍천리는 수백 년 된 푸른 숲을 허물고 양수발전소를 세우려는 계획 때문에 오랜 삶의 터전과 소중한 자연이 파괴될 위기에 놓여 있습니다. 마을과 숲을 지키기 위해 주민분들은 오랫동안 외롭고 힘겨운 싸움을 이어오고 계십니다. 마을을 지키기 위해 애쓰시는 주민분들의 목소리에 힘을 보태고, 풍천리의 이야기를 음악으로 나누며 따뜻하게 함께하는 연대의 마음을 모으고자 이번 자리를 마련했습니다.',
    "풍천리 공연은 늘 따뜻한 밥 한 끼를 나누는 마음과 함께해 왔습니다. 이번엔 삼청동 '라플란드'에서 사람을 위하는 마음과 정성이 담긴 '삼청모찬 도시락'을 준비했습니다. 정성 어린 음식과 다정한 음악으로 마음을 나누는 이 자리에 꼭 함께해 주세요. 10월 24일 라플란드에서 그 맘을 같이 나눠요.",
  ].join('\n\n'),
  coverImage: '/images/shows/bakkeoji-poster-20261003r2.webp',
  ogImage: '/images/shows/bakkeoji-og-20261003r2.webp',
  // 18:00 식사, 18:30 공연 시작 — startsAt은 공연 시작. 판매마감은 시작 전날 24:00(KST).
  scheduleNote: '18:00 식사 · 18:30 공연 시작',
  onSitePriceNote: `현장 판매 ${won(ON_SITE_PRICE)} (1드링크 포함, 현장 잔여석이 있는 경우)`,
  notices: ['티켓 수익은 공연에 참여한 뮤지션들과 공간에게 돌아갑니다.', '비지정석 선착순 입장입니다.'],
  mapUrl: null,
  zones: [{ code: 'GA', label: '비지정석', capacity: 50 }],
  showtimes: [{ startsAt: new Date('2026-10-24T18:30:00+09:00') }],
  ticketTypes: [
    // quota 없음: 구역 정원 50이 한도다. 초대권은 별도 한도(compQuota)를 두지 않는다 — 필요할 때 올린다.
    { zoneCode: 'GA', name: '사전 예매 (1드링크 포함)', price: PRESALE_PRICE, quota: null, compQuota: 0 },
  ],
};
