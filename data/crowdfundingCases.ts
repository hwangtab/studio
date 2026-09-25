/**
 * 운영자(황경하)가 기획·운영한 크라우드펀딩 중 **공개로 확인할 수 있는 것** — /ko/crowdfunding-design의
 * "진행한 펀딩" 표와 llms.txt가 이 목록 하나를 읽는다.
 *
 * 수치는 2026-09-25에 각 플랫폼에서 직접 확인했다: 텀블벅은 공개 API
 * (`/api/v2/user/{계정}/project-list`, 계정 hwangtab·yafumidoje(스튜디오 놀)·
 * qsrfdjgmfqldxdvk(한국스마트협동조합)·usertehayameja(김사월)), 씨앗페는 각 펀딩 페이지.
 * 종료된 펀딩의 수치는 바뀌지 않는다. **진행 중인 것(state: 'ongoing')은 바뀌므로**
 * 다시 확인할 때 CASES_CHECKED_ON도 함께 옮길 것.
 *
 * 목표에 못 미친 펀딩(2025 「장구 소리로 피어나는 궁중족발의 이야기」 21%)은 싣지 않았다 —
 * 운영자 판단 대기(2026-09-25). 이 표는 "성공률"을 주장하지 않는다. 비율을 말하게 되면
 * 미달 건도 분모에 넣어야 한다.
 *
 * 분야(kind)는 각 프로젝트 소개문에서 옮겼다. 소개문으로 판단이 안 되면 '기타'.
 *
 * 역할: 아래 전부 운영자가 기획·운영했다(2026-09-25 운영자 확인). 개설 계정이 한국스마트협동조합·
 * 아티스트 본인·씨앗페인 것도 마찬가지다 — 계정 명의와 기획·운영 주체는 다를 수 있다.
 */
export const CASES_CHECKED_ON = '2026-09-25';

export type CrowdfundingCase = {
  title: string;
  url: string;
  platform: '텀블벅' | '씨앗페';
  kind: '음반' | '공연' | '출판' | '영화 상영' | '문화유산 보존' | '기타';
  raised: number;
  percent: number;
  backers: number;
  /** YYYY-MM — 종료 월. 진행 중이면 시작 월. */
  period: string;
  state: 'succeeded' | 'ongoing';
  /**
   * 이 음반이 받은 상 — data/siteConfig.ts studioOperator.awards와 같은 음반일 때만.
   * 테이크아웃드로잉은 수상 연도(2015)가 펀딩 마감(2016-02)보다 앞서지만 같은 음반이다(운영자 확인).
   */
  award?: string;
  /**
   * 펀딩으로 제작비를 모아 스튜디오 놀이 **기획·제작·음향**까지 맡아 발매한 음반 —
   * 발매 페이지의 "펀딩으로 시작해 발매까지 간 음반" 카드가 이 필드가 있는 건만 싣는다.
   * portfolioId는 data/portfolio/items.ts의 id(카드의 "발매작 보기" 링크).
   * 2026-09-25 운영자 확인: 아래 넷은 기획·제작·음향을 전부 스튜디오가 했다.
   */
  release?: { portfolioId: string };
};

// 종료일 최신순.
export const CROWDFUNDING_CASES: readonly CrowdfundingCase[] = [
  { title: '멸실 위기의 오윤 구의동 테라코타 부조, 우리가 구합시다', url: 'https://saf2026.com/funding/oh-yoon-terracotta', platform: '씨앗페', kind: '문화유산 보존', raised: 62327000, percent: 62, backers: 843, period: '2026-08', state: 'ongoing' },
  { title: '마리코 & 유키에 《남산타워》', url: 'https://tumblbug.com/marikoandyukie', platform: '텀블벅', kind: '음반', raised: 5045000, percent: 100, backers: 53, period: '2026-08', state: 'succeeded', release: { portfolioId: 'mariko-yukie-namsan-tower' } },
  { title: '베어지기 전에 풍천리 — 청와대 앞 공연 개최 후원', url: 'https://saf2026.com/funding/pungcheonri', platform: '씨앗페', kind: '공연', raised: 7440000, percent: 148, backers: 186, period: '2026-08', state: 'succeeded' },
  { title: '아트만두의 비틀뉴스', url: 'https://tumblbug.com/artmandoo', platform: '텀블벅', kind: '기타', raised: 5555555, percent: 111, backers: 105, period: '2025-12', state: 'succeeded' },
  { title: '삼각전파사 <Dystopia 2025>', url: 'https://tumblbug.com/dystopia2025', platform: '텀블벅', kind: '음반', raised: 3001000, percent: 100, backers: 40, period: '2025-03', state: 'succeeded' },
  { title: '자이 Golden Hour 발매', url: 'https://tumblbug.com/goldenhour', platform: '텀블벅', kind: '음반', raised: 8101000, percent: 115, backers: 75, period: '2025-01', state: 'succeeded' },
  { title: '[침몰10년, 제로썸] 416개 극장에서!', url: 'https://tumblbug.com/sewolzerosum', platform: '텀블벅', kind: '영화 상영', raised: 31564000, percent: 105, backers: 538, period: '2024-12', state: 'succeeded' },
  { title: '이름을 모르는 먼 곳의 그대에게', url: 'https://tumblbug.com/peaceandmusic', platform: '텀블벅', kind: '음반', raised: 7693000, percent: 128, backers: 150, period: '2024-09', state: 'succeeded', award: '2024 레드어워드 주목할만한 연대', release: { portfolioId: 'peace-and-music' } },
  { title: '새벽, 노찾사의 작곡가 류형수의 솔로앨범 제작 프로젝트', url: 'https://tumblbug.com/hsryoo', platform: '텀블벅', kind: '음반', raised: 16106000, percent: 161, backers: 126, period: '2023-06', state: 'succeeded' },
  { title: '3인조 보이그룹 <엉아들> 데뷔앨범 뮤직북', url: 'https://tumblbug.com/brothers', platform: '텀블벅', kind: '음반', raised: 8496100, percent: 106, backers: 65, period: '2022-07', state: 'succeeded', release: { portfolioId: 'eongadeul-self-titled' } },
  { title: '<강호중> 앨범 발매 및 단독공연 프로젝트', url: 'https://tumblbug.com/kanghojoong', platform: '텀블벅', kind: '음반', raised: 14228000, percent: 142, backers: 72, period: '2022-03', state: 'succeeded', release: { portfolioId: 'kang-ho-jung-self-titled' } },
  { title: '새 민중음악 선곡집 - 소성리의 노래들', url: 'https://tumblbug.com/newprotestsong', platform: '텀블벅', kind: '음반', raised: 3531000, percent: 117, backers: 114, period: '2017-09', state: 'succeeded' },
  { title: "30년 맛의 비법, '아현포차 요리책'", url: 'https://tumblbug.com/pocha', platform: '텀블벅', kind: '출판', raised: 8258000, percent: 165, backers: 412, period: '2017-08', state: 'succeeded' },
  { title: '테이크아웃드로잉 컴필레이션 앨범', url: 'https://tumblbug.com/takeoutdrawingalbum', platform: '텀블벅', kind: '음반', raised: 2180000, percent: 121, backers: 99, period: '2016-02', state: 'succeeded', award: '2015 레드어워드 주목할만한 연대' },
  { title: '자립심 페스티벌', url: 'https://tumblbug.com/jaripsim', platform: '텀블벅', kind: '공연', raised: 4505000, percent: 112, backers: 126, period: '2015-08', state: 'succeeded' },
  { title: 'POPE X POPE의 정규앨범발매 및 단독공연', url: 'https://tumblbug.com/popexpope', platform: '텀블벅', kind: '음반', raised: 2072000, percent: 103, backers: 52, period: '2015-03', state: 'succeeded' },
  { title: '<에고펑션에러> 앨범발매 및 단독공연', url: 'https://tumblbug.com/egofunctionerror', platform: '텀블벅', kind: '음반', raised: 2487000, percent: 124, backers: 88, period: '2014-12', state: 'succeeded' },
  { title: '김사월X김해원의 EP앨범 발매 및 단독공연', url: 'https://tumblbug.com/kswxkhw', platform: '텀블벅', kind: '음반', raised: 3270000, percent: 109, backers: 75, period: '2014-09', state: 'succeeded' },
  { title: 'No control의 첫번째 정규앨범, [No control]', url: 'https://tumblbug.com/no_control', platform: '텀블벅', kind: '음반', raised: 978000, percent: 122, backers: 45, period: '2012-03', state: 'succeeded', award: '2012 다음뮤직 이달의 음반' },
];

const sum = (pick: (c: CrowdfundingCase) => number, cases: readonly CrowdfundingCase[]) =>
  cases.reduce((acc, c) => acc + pick(c), 0);

const SUCCEEDED = CROWDFUNDING_CASES.filter((c) => c.state === 'succeeded');

/** 표 위 요약 — 성공한 펀딩만 센다(진행 중인 금액은 아직 확정이 아니다). */
export const CASES_SUMMARY = {
  succeededCount: SUCCEEDED.length,
  succeededAlbumCount: SUCCEEDED.filter((c) => c.kind === '음반').length,
  succeededRaised: sum((c) => c.raised, SUCCEEDED),
  succeededBackers: sum((c) => c.backers, SUCCEEDED),
} as const;
