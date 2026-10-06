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
const wonEn = (n: number): string => `₩${n.toLocaleString('en-US')}`;

export const bakkeojiShow: ShowDefinition = {
  slug: BAKKEOJI_SLUG,
  title: '베어지지 않는 마음들',
  subtitle: '풍천리를 위한 삼청동에서의 밤',
  presenterName: '자이와 친구들',
  performers: [
    {
      // 소개는 펀딩 프로젝트(components/funding/FundingLineupPerson.tsx의 mok-jareugi-next)에서 그대로 가져왔다.
      // 사진은 같은 파일을 날짜 이름으로 복사했다. SNS는 운영자가 준 인스타그램(2026-10-04) — 펀딩 쪽은 인스타그램 계정을 못 찾아
      // 페이스북 프로필로 연결돼 있다.
      name: '최양다음 NEXT',
      bio: "독학으로 음악을 익힌 싱어송라이터. 아버지 성 '최'와 어머니 성 '양'에 '다음'을 붙인 이름으로, 호주제에 맞선다는 뜻을 담아 지었습니다. 그 이름을 여러 나라 말로 씁니다 — 다음, NEXT, 次, Nächste, 翌. 세월호 10주기 추모, 수요시위, 팔레스타인 연대 집회, 5·18 기념식 같은 자리에서 노래해왔습니다.",
      photo: '/images/shows/bakkeoji-next-20261004.webp',
      sns: 'https://www.instagram.com/nextisnexttoyou/',
    },
    {
      name: '자이(Jai)',
      bio: "특유의 포근하고 깊은 음색으로 일상과 삶의 미세한 결을 어루만지는 싱어송라이터. 락밴드 '헤디마마' 활동을 거쳐 현재는 어쿠스틱·인디·로파이·재즈 스타일을 넘나드는 솔로 아티스트로서 독보적인 음악 세계를 구축해 오고 있다.",
      photo: '/images/shows/bakkeoji-jai-20261003.webp',
      sns: 'https://www.instagram.com/jai.music_official/',
    },
    {
      name: '호와호(Howaho)',
      bio: '시적인 가사와 몰입감 넘치는 사운드스케이프를 엮어내는 오가닉 일렉트로닉 듀오. 다양한 매체로 국내외 무대를 유영하며, 경계 위에 선 존재들을 위한 사랑과 연대를 노래합니다.',
      photo: '/images/shows/bakkeoji-howaho-20261003.webp',
      sns: 'https://www.instagram.com/howaho_official/',
    },
    {
      name: '솔가(Solga)',
      bio: '오랫동안 삶의 현장에서 사람과 자연, 생명의 존엄을 단단하게 노래해 온 싱어송라이터.',
      photo: '/images/shows/bakkeoji-solga-20261003.webp',
      sns: 'https://www.instagram.com/solga/',
    },
  ],
  ageRating: '전체 관람가',
  // 공연 시간 약 100분(주최 확인, 2026-10-03). 18:00 입장 시작 이후 대기 시간은 포함하지 않는다.
  runningMinutes: 100,
  venueName: '삼청동 라플란드',
  // 공연은 건물 2층에서 열린다(운영자 2026-10-04). 지도 검색은 층 표기를 떼고 건물 번호까지만 쓰므로(lib/shows/maps.ts) 영향이 없고,
  // 장소 링크(mapLinks)는 같은 건물의 업장 페이지다.
  venueAddress: '서울특별시 종로구 삼청로 83 가동 2층',
  // 소개 본문. 빈 줄로 문단을 가르고, `## `는 소제목, `> `는 인용이다(lib/shows/structured.ts descriptionBlocks).
  // 첫 두 문단은 주최 측이 쓴 글 그대로다. 풍천리 상황의 수치·주민 인용은 펀딩 프로젝트 페이지
  // (content/funding/mok-jareugi.md "풍천리에서 일어나고 있는 일")에 정리된 것을 그대로 옮겼다 — 새 사실을 더하지 않았다.
  // 티켓 수익 사용처는 소개에 적지 않는다(운영자 결정 2026-10-04 — TMI). 풍천리 후원금이 된다고도 쓰지 않는다.
  description: [
    '홍천의 풍천리 마을을 아시나요? 지금 풍천리는 수백 년 된 푸른 숲을 허물고 양수발전소를 세우려는 계획 때문에 오랜 삶의 터전과 소중한 자연이 파괴될 위기에 놓여 있습니다. 마을과 숲을 지키기 위해 주민분들은 오랫동안 외롭고 힘겨운 싸움을 이어오고 계십니다. 마을을 지키기 위해 애쓰시는 주민분들의 목소리에 힘을 보태고, 풍천리의 이야기를 음악으로 나누며 따뜻하게 함께하는 연대의 마음을 모으고자 이번 자리를 마련했습니다.',
    '## 풍천리에서 일어나고 있는 일',
    '강원도 홍천군 화촌면 풍천리에 600MW 규모의 홍천 양수발전소 1·2호기가 들어섭니다. 한국수력원자력이 추진하는 사업으로, 2025년 8월 29일 실시계획이 승인·고시됐고 2026년 1월 본공사가 착공됐습니다.',
    '이 공사로 산림청이 \'100대 명품숲\'으로 지정한 1,800ha 잣나무 숲이 훼손됩니다. 베어지는 잣나무는 111,999그루이고, 51가구가 살던 터는 물에 잠깁니다. 국내산 잣의 62%가 이 숲에서 납니다. 주민들은 이 숲에서 산양을 봤다고 증언합니다. 숲은 마을의 수입이자, 물을 머금어 논밭으로 내려보내는 삶의 뿌리입니다. 나무를 베는 일은 풍경을 바꾸는 일이 아니라, 사람이 여기서 계속 살 수 있는지를 정하는 일입니다.',
    '## 8년, 어르신들이 버텨 온 시간',
    '주민들이 양수발전소에 반대하며 거리에 선 지 8년째입니다. 2019년 3월 첫 집회 이후 705번 넘게 거리에 섰고, 평균 연령은 약 70세입니다. 예순에서 여든의 손들이 팻말을 들었고, 그 가운데 일곱 분은 지금도 재판을 받고 있습니다. 마을을 지켜 온 분들이 법정과 농성장과 거리를 오가며 보낸 시간입니다.',
    '싸움이 길어질수록 마을에서 사라지는 것은 나무만이 아닙니다. 웃음이 먼저 사라집니다.',
    '> "사람답게 산 것 같다. 몇 년 만에 웃어봤는지 모르겠다."\n— 허순이 주민, 2025년 7월 「잣나무골 여름잔치」에서',
    '## 이 밤을 여는 이유',
    '이 자리는 풍천리 어르신들의 이야기를 도시의 사람들에게 전하고, 오래 외롭고 힘겨웠던 그 시간의 설움을 함께 보듬기 위한 밤입니다. 서류와 숫자로만 오가던 이야기를 노래로 건네고, 한 사람이라도 더 그 이야기를 듣고 기억하게 하는 것. 마을을 지키는 일을 대신할 수는 없지만, 혼자 버티는 것이 아니라는 마음은 전할 수 있다고 믿습니다.',
    '다정한 음악으로 마음을 나누는 이 자리에 꼭 함께해 주세요. 10월 24일 라플란드에서 그 맘을 같이 나눠요.',
  ].join('\n\n'),
  coverImage: '/images/shows/bakkeoji-poster-20261004.webp',
  ogImage: '/images/shows/bakkeoji-og-20261004.webp',
  // 18:00 입장 시작, 18:30 공연 시작 — startsAt은 공연 시작. 판매마감은 시작 전날 24:00(KST).
  scheduleNote: '18:00 입장 시작 · 18:30 공연 시작',
  onSitePriceNote: `현장 판매 ${won(ON_SITE_PRICE)} (1드링크 포함, 현장 잔여석이 있는 경우)`,
  notices: ['공연은 건물 2층에서 열립니다.', '비지정석 선착순 입장입니다.'],
  // 제공자별 정확한 장소 주소(lib/shows/maps.ts).
  // - 카카오: 운영자가 준 장소 페이지(서울 종로구 삼청로 83 1층). 카카오에는 카테고리가 '의류판매'로 등록돼 있다(운영자 확인 —
  //   같은 업장이 공연도 하는 것) — 주소가 공연장과 같으므로 그대로 쓴다.
  // - 네이버: 운영자가 준 단축 주소 naver.me/xSFajz3G는 경기 파주시 돌곶이길 178-3의 다른 '라플란드'로 열려(2026-10-04, 모바일·
  //   데스크톱 UA 모두 place/1579699511) 쓰지 않았다. 대신 네이버 검색이 찾는 '라플란드 드 카페'(서울 종로구 삼청로 83 가동 1층 —
  //   공연장 주소와 글자까지 같다)의 장소 번호 840861453으로 직접 만든 주소를 쓴다(데스크톱·모바일에서 열어 확인함).
  mapLinks: {
    naver: 'https://map.naver.com/p/entry/place/840861453',
    kakao: 'https://place.map.kakao.com/1525155012',
  },
  zones: [{ code: 'GA', label: '비지정석', capacity: 50 }],
  showtimes: [{ startsAt: new Date('2026-10-24T18:30:00+09:00') }],
  ticketTypes: [
    // quota 없음: 구역 정원 50이 한도다. 초대권은 별도 한도(compQuota)를 두지 않는다 — 필요할 때 올린다.
    { zoneCode: 'GA', name: '사전 예매 (1드링크 포함)', price: PRESALE_PRICE, quota: null, compQuota: 0 },
  ],
  // 영어 화면(/en/shows/bakkeoji-anneun-maeumdeul) — 위 한국어 내용을 옮긴 것이다(2026-10-07). 새 사실을 더하지 않는다.
  // 한국어를 고치면 여기도 같이 고친다. 출연진은 위와 같은 순서.
  en: {
    title: "Hearts That Won't Be Cut Down",
    subtitle: 'A Night in Samcheong-dong for Pungcheon-ri',
    presenterName: 'Jai & Friends',
    performers: [
      {
        name: 'Choi-Yang Daeum (NEXT)',
        bio: "A self-taught singer-songwriter. The name joins the father's surname, Choi, and the mother's, Yang, with Daeum (\"next\") — a stand against Korea's patriarchal family-registry system — and is written in many languages: 다음, NEXT, 次, Nächste, 翌. Has sung at the 10th Sewol Ferry memorial, the Wednesday Demonstrations, Palestine solidarity rallies and the May 18 commemoration.",
      },
      {
        name: 'Jai',
        bio: "A singer-songwriter whose warm, deep voice traces the small textures of everyday life. After the rock band Headymama (헤디마마), now a solo artist moving freely across acoustic, indie, lo-fi and jazz, building a musical world all their own.",
      },
      {
        name: 'Howaho',
        bio: 'An organic electronic duo weaving poetic lyrics into immersive soundscapes. Drifting across stages at home and abroad through many media, they sing of love and solidarity for those who stand on the edges.',
      },
      {
        name: 'Solga',
        bio: 'A singer-songwriter who has long sung, steadily and firmly, of people, nature and the dignity of life from where life is actually lived.',
      },
    ],
    ageRating: 'All ages',
    venueName: 'Lapland, Samcheong-dong',
    venueAddress: '2F, Building Ga, 83 Samcheong-ro, Jongno-gu, Seoul',
    description: [
      "Have you heard of Pungcheon-ri, a village in Hongcheon? Right now Pungcheon-ri's centuries-old green forest is set to be cleared for a pumped-storage power plant, putting a long-held way of life and precious nature at risk. To protect their village and forest, residents have kept up a long, lonely and exhausting fight. We have prepared this evening to add strength to their voices, to share Pungcheon-ri's story through music, and to gather our hearts in warm solidarity.",
      '## What is happening in Pungcheon-ri',
      'Units 1 and 2 of the 600 MW Hongcheon pumped-storage power plant are being built in Pungcheon-ri, Hwachon-myeon, Hongcheon County, Gangwon Province. The project is run by Korea Hydro & Nuclear Power; its implementation plan was approved and announced on August 29, 2025, and main construction began in January 2026.',
      "The construction will damage a 1,800-hectare Korean pine forest that the Korea Forest Service has named one of its \"100 Best Forests.\" 111,999 Korean pines are to be cut down, and land where 51 households lived will be flooded. 62% of Korea's domestic pine nuts come from this forest. Residents say they have seen long-tailed gorals here. The forest is the village's income and the root of its life — it holds water and sends it down to the fields. Cutting these trees does not just change the view; it decides whether people can go on living here.",
      '## Eight years of holding on',
      'This is the eighth year residents have stood in the streets against the plant. Since their first rally in March 2019 they have taken to the streets more than 705 times; their average age is about 70. Hands aged sixty to eighty have held up the placards, and seven of them are still on trial. These are years spent going back and forth between courtrooms, sit-in tents and the streets by the people who have kept the village alive.',
      'The longer the fight goes on, trees are not the only thing the village loses. Laughter goes first.',
      '> "I felt like I was living like a human being. I can\'t remember how many years it\'s been since I last laughed."\n— Heo Sun-i, resident, at the "Pine Valley Summer Feast," July 2025',
      '## Why we are holding this night',
      'This night is for carrying the stories of Pungcheon-ri\'s elders to people in the city, and for sharing the grief of those long, lonely and hard years. To hand over in song a story that has only travelled as documents and numbers, so that even one more person hears it and remembers. We cannot protect the village in their place, but we believe we can let them know they are not holding on alone.',
      'Please join us for an evening of tender music and shared hearts. Let\'s share it together at Lapland on October 24.',
    ].join('\n\n'),
    scheduleNote: 'Doors 18:00 · Show 18:30 (KST)',
    onSitePriceNote: `At the door ${wonEn(ON_SITE_PRICE)} (1 drink included, if seats remain)`,
    notices: ['The show takes place on the 2nd floor of the building.', 'General admission, first come, first served.'],
    zoneLabels: { 비지정석: 'General admission' },
    ticketTypeNames: { '사전 예매 (1드링크 포함)': 'Advance ticket (1 drink included)' },
  },
};
