/**
 * 영상 제작 페이지(/music-video)의 감독 이력 — 박치치(본명 박건주) 감독.
 *
 * 출처: 감독 본인 포트폴리오(노션, 운영자가 2026-10-22에 준 링크)와 저장소의 확인된 기록
 * (《Dystopia 2025》 티저 — data/portfolio/items.ts). 연락처·이메일은 포트폴리오에 있어도 싣지 않는다
 * (공개 저장소·공개 페이지 — 문의는 스튜디오 카톡으로 받는다).
 *
 * 항목을 더할 때: 포트폴리오에 적힌 연도·역할을 그대로 옮긴다. 수상·방영처럼 확인이 필요한 말은
 * 근거가 포트폴리오나 공개 페이지에 있을 때만.
 */

interface L {
  ko: string;
  en: string;
}

export interface DirectorWork {
  year: string;
  title: L;
  role: L;
  note?: L;
}

export const DIRECTOR_WORKS: readonly DirectorWork[] = [
  {
    year: '2026',
    title: { ko: '마리코 & 유키에 〈남산타워〉 뮤직비디오', en: 'Mariko & Yukie, “Namsan Tower Lights” music video' },
    role: { ko: '제작(촬영·편집)', en: 'Production (camera, editing)' },
  },
  {
    year: '2026',
    title: { ko: '강정피스앤뮤직캠프 페스티벌 기록', en: 'Gangjeong Peace & Music Camp festival film' },
    role: { ko: '촬영·편집', en: 'Camera, editor' },
    note: { ko: '뮤지션 51팀 공연 영상, 셀러 인터뷰 14팀', en: 'Full sets by 51 acts, 14 vendor interviews' },
  },
  {
    year: '2025',
    title: { ko: '영화 「밥」', en: 'Feature film Bap' },
    role: { ko: '촬영 감독 / PD', en: 'Cinematographer / producer' },
    note: { ko: '광주문화재단 지원 사업 선정', en: 'Selected for Gwangju Cultural Foundation support' },
  },
  {
    year: '2025',
    title: { ko: '영화 「할머니와 나와 민들레」', en: 'Film Grandma, Me and the Dandelion' },
    role: { ko: '촬영 감독 / PD', en: 'Cinematographer / producer' },
    note: { ko: '전라남도 후반 제작 지원 사업 선정', en: 'Selected for Jeollanam-do post-production support' },
  },
  {
    year: '2025',
    title: { ko: '유튜브 「미취자」(우정잉 출연)', en: 'YouTube series Michwija (featuring Woojunging)' },
    role: { ko: '촬영 감독', en: 'Cinematographer' },
    note: { ko: '성남시 공식 채널 성남TV·가천대학교 제작', en: 'Produced with Seongnam TV and Gachon University' },
  },
  {
    year: '2025',
    title: { ko: '삼각전파사 《Dystopia 2025》 티저', en: 'Samgakjeonpasa, Dystopia 2025 teaser' },
    role: { ko: '연출', en: 'Director' },
  },
  {
    year: '2024',
    title: { ko: '영화 「열아홉 섬진강」', en: 'Film Nineteen, Seomjin River' },
    role: { ko: '촬영 감독 / PD', en: 'Cinematographer / producer' },
    note: { ko: '전라남도교육청 제작 지원', en: 'Supported by the Jeollanam-do Office of Education' },
  },
  {
    year: '2024',
    title: { ko: '다큐멘터리 「푸른바람」', en: 'Documentary Blue Wind' },
    role: { ko: '연출', en: 'Director' },
    note: { ko: '전라남도교육청 제작 지원', en: 'Supported by the Jeollanam-do Office of Education' },
  },
  {
    year: '2023',
    title: { ko: '웹드라마 「그 결혼, 거절할게요」', en: 'Web drama I Refuse That Marriage' },
    role: { ko: 'B캠 촬영 감독', en: 'B-camera operator' },
    note: { ko: '85부작', en: '85 episodes' },
  },
  {
    year: '2020',
    title: { ko: '음악 다큐멘터리 「한 사람을 위한 음악회 1·2」', en: 'Music documentary A Concert for One Person 1 & 2' },
    role: { ko: '연출', en: 'Director' },
    note: { ko: 'KBS 열린채널 방영', en: 'Aired on KBS Open Channel' },
  },
  {
    year: '2018',
    title: { ko: '영화 「임을 위한 행진곡」', en: 'Feature film March for the Beloved' },
    role: { ko: '연출부', en: 'Directing department' },
  },
];

export const DIRECTOR_CAREER: readonly DirectorWork[] = [
  {
    year: '2023–2025',
    title: { ko: '(주)무당벌레필름', en: 'Ladybug Film Co.' },
    role: { ko: '촬영 감독 / PD', en: 'Cinematographer / producer' },
    note: { ko: '기획·촬영·편집·색보정 전 과정', en: 'Planning, camera, editing and colour, end to end' },
  },
  {
    year: '2023–2025',
    title: { ko: '청풍초등학교 영화학교(전남 화순)', en: 'Cheongpung Elementary film school (Hwasun)' },
    role: { ko: '영화 강사', en: 'Film instructor' },
    note: { ko: '단편영화 3편·뮤직비디오 1편 제작 지도', en: 'Guided three short films and one music video' },
  },
  {
    year: '2020–2023',
    title: { ko: '스마트협동조합', en: 'Korea Smart Cooperative' },
    role: { ko: '사업팀장 · 미디어팀', en: 'Programme lead, media team' },
    note: {
      ko: '행사 스케치·뮤직비디오 제작, 밀양 청소년 연극제·씨앗페 미디어 총괄',
      en: 'Event films and music videos; media lead for the Miryang Youth Theatre Festival and Ssiat Fest',
    },
  },
  {
    year: '2019–2022',
    title: { ko: '해방필름', en: 'Haebang Film' },
    role: { ko: '대표', en: 'Head' },
    note: { ko: '독립 다큐멘터리 제작사 운영', en: 'Ran the independent documentary company' },
  },
  {
    year: '2023',
    title: { ko: '씨앗페', en: 'Ssiat Fest' },
    role: { ko: '기획·영상 총괄', en: 'Programming, video lead' },
    note: { ko: '아티스트 100여 팀, 예술인 상호부조 기금 2억 원 모금', en: '100+ artists; raised KRW 200 million for an artists’ mutual-aid fund' },
  },
  {
    year: '2019',
    title: { ko: '저항예술제', en: 'Resistance Arts Festival' },
    role: { ko: '기획·영상 총괄', en: 'Programming, video lead' },
    note: { ko: '수원 문화의 전당 주최, 국내외 아티스트 200여 팀', en: 'Hosted at the Gyeonggi Arts Center, Suwon; 200+ Korean and international acts' },
  },
];
