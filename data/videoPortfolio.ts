/**
 * 영상 제작 페이지(/music-video)의 작업 영상 — 해방필름 박치치 감독이 촬영·편집한 영상.
 *
 * 운영자가 준 링크 그대로다(2026-10-22). 아티스트 이름 노출은 운영자 확인을 받았다.
 * 영상은 아티스트·레이블·해방필름 채널 소유라 VideoObject 구조화 데이터는 붙이지 않는다 —
 * publisher를 우리로 적으면 남의 채널 영상을 우리 것으로 주장하게 된다(utils/schema/media.ts 주석).
 *
 * 새 영상을 넣을 때: 유튜브 주소의 v= 값(11자)만 youtubeId에 넣는다(&list=…는 버린다).
 * 제목은 영상 제목을 줄여 "아티스트 — 곡"으로. 촬영 감독이 찍지 않은 영상은 넣지 않는다.
 */

export type VideoWorkKind = 'music-video' | 'live' | 'youtube';

export interface VideoWork {
  youtubeId: string;
  kind: VideoWorkKind;
  /** 한국어 화면 */
  artist: string;
  title: string;
  /** 그 밖의 로케일 */
  artistEn: string;
  titleEn: string;
  /** 촬영·공연 장소·날짜 같은 한 줄(선택) */
  note?: string;
  noteEn?: string;
  /** 유튜브에 올라간 해 */
  year: number;
}

export const VIDEO_WORKS: readonly VideoWork[] = [
  // 뮤직비디오
  {
    youtubeId: 'bWIwjnij0XQ',
    kind: 'music-video',
    artist: '마리코 & 유키에',
    title: '남산타워',
    artistEn: 'Mariko & Yukie',
    titleEn: 'Namsan Tower Lights',
    year: 2026,
  },
  {
    youtubeId: 'emtWqYhuZQw',
    kind: 'music-video',
    artist: '강호중',
    title: '그대를 위해 부르는 노래',
    artistEn: 'Kang Ho Joong',
    titleEn: 'The Song For You',
    year: 2022,
  },
  {
    youtubeId: 'EsFqpkUfxxE',
    kind: 'music-video',
    artist: '경하와 세민',
    title: '혼약의 기도',
    artistEn: 'Kyungha & Semin',
    titleEn: 'Honyak-ui Gido (Wedding Prayer)',
    year: 2020,
  },
  // 라이브 클립
  {
    youtubeId: 'DvYm02uM2bU',
    kind: 'live',
    artist: '윤선애',
    title: '저 평등의 땅에',
    artistEn: 'Yoon Sun-ae',
    titleEn: 'Jeo Pyeongdeung-ui Ttang-e',
    note: "류형수 콘서트 '하루' · 소월아트홀 · 2023.6.24",
    noteEn: "Ryu Hyung-su concert 'Haru' · Sowol Art Hall · 24 June 2023",
    year: 2024,
  },
  {
    youtubeId: 'Tl3G4QzJE78',
    kind: 'live',
    artist: '자이',
    title: 'Golden Hour',
    artistEn: 'JAI',
    titleEn: 'Golden Hour',
    note: '아트스페이스 반쥴 · 2025.2.15',
    noteEn: 'Artspace Banjul · 15 February 2025',
    year: 2025,
  },
  {
    youtubeId: '3wCWkP0ZxV4',
    kind: 'live',
    artist: '마터스 MARTYRS',
    title: 'Rixe 내한공연',
    artistEn: 'MARTYRS',
    titleEn: 'Rixe Live in Korea',
    note: 'GBN · 2019.6.22',
    noteEn: 'GBN · 22 June 2019',
    year: 2019,
  },
  // 유튜브 콘텐츠 — 토크·인터뷰 시리즈 〈고효경과 재야의 고수들〉
  {
    youtubeId: '-iM6eEnTsNk',
    kind: 'youtube',
    artist: '카야',
    title: '고효경과 재야의 고수들 EP.5',
    artistEn: 'Kaya',
    titleEn: 'Ko Hyo-kyung & the Hidden Masters EP.5',
    year: 2023,
  },
  {
    youtubeId: '5dDUNP4Qtk0',
    kind: 'youtube',
    artist: 'Jinu Konda',
    title: '고효경과 재야의 고수들 EP.2',
    artistEn: 'Jinu Konda',
    titleEn: 'Ko Hyo-kyung & the Hidden Masters EP.2',
    year: 2023,
  },
  {
    youtubeId: '_30aURk2N_g',
    kind: 'youtube',
    artist: '박가빈',
    title: '고효경과 재야의 고수들 EP.3',
    artistEn: 'Park Ga-bin',
    titleEn: 'Ko Hyo-kyung & the Hidden Masters EP.3',
    year: 2023,
  },
];

export const VIDEO_WORK_KINDS: readonly VideoWorkKind[] = ['music-video', 'live', 'youtube'];
