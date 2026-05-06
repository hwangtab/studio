// 음악연습실 hub-and-spoke 전용 지역 LP 메타. relatedGuides cluster와 분리해
// '지역별 음악연습실' 섹션 전용으로 사용. SSR HTML 직접 주입으로 하이드레이션 비용 0.
// 거리 short은 사용자가 한눈에 파악 가능한 형태(예: '4번 출구 5분', '3호선 2정거장').

export interface PracticeRoomRegionLP {
  slug: string;
  region: string;
  distance: string;
  group: 'walk' | 'eunpyeong' | 'seodaemun' | 'goyang';
}

export const PRACTICE_ROOM_REGION_LPS: PracticeRoomRegionLP[] = [
  // 도보권 — 사이트 인접
  { slug: 'practice-room-daejo1',      region: '대조동',   distance: '도보 0~10분',         group: 'walk' },
  { slug: 'practice-room-yeonsinnae1', region: '연신내',   distance: '4번 출구 도보 5분',    group: 'walk' },
  { slug: 'practice-room-bulgwang1',   region: '불광',     distance: '7번 출구 도보 7분',    group: 'walk' },

  // 은평구 권역 — 6호선·3호선
  { slug: 'practice-room-eunpyeong1',  region: '은평구',   distance: '광역 동별 가이드',     group: 'eunpyeong' },
  { slug: 'practice-room-nokbeon1',    region: '녹번',     distance: '3호선 1정거장 ~12분',  group: 'eunpyeong' },
  { slug: 'practice-room-dokbawi1',    region: '독바위',   distance: '6호선 1정거장 ~10분',  group: 'eunpyeong' },
  { slug: 'practice-room-gusan1',      region: '구산',     distance: '6호선 1정거장 ~10분',  group: 'eunpyeong' },
  { slug: 'practice-room-yeokchon1',   region: '역촌',     distance: '6호선 2정거장 ~12분',  group: 'eunpyeong' },
  { slug: 'practice-room-eungam1',     region: '응암',     distance: '6호선 3정거장 ~14분',  group: 'eunpyeong' },
  { slug: 'practice-room-saejeol1',    region: '새절',     distance: '6호선 응암루프 ~14분', group: 'eunpyeong' },
  { slug: 'practice-room-jeungsan1',   region: '증산',     distance: '6호선 응암루프 ~16분', group: 'eunpyeong' },
  { slug: 'practice-room-sangam1',     region: '상암(DMC)', distance: '6호선 응암루프 ~19분', group: 'eunpyeong' },

  // 서대문 권역 — 3호선
  { slug: 'practice-room-seodaemun1',  region: '서대문',   distance: '3호선 3정거장 ~13분',  group: 'seodaemun' },

  // 고양시 — 3호선 라인
  { slug: 'practice-room-gupabal1',    region: '구파발',   distance: '3호선 1정거장 ~10분',  group: 'goyang' },
  { slug: 'practice-room-jichuk1',     region: '지축',     distance: '3호선 2정거장 ~13분',  group: 'goyang' },
  { slug: 'practice-room-samsong1',    region: '삼송',     distance: '3호선 3정거장 ~16분',  group: 'goyang' },
  { slug: 'practice-room-wonheung1',   region: '원흥',     distance: '3호선 4정거장 ~18분',  group: 'goyang' },
  { slug: 'practice-room-wondang1',    region: '원당',     distance: '3호선 5정거장 ~20분',  group: 'goyang' },
  { slug: 'practice-room-deogyang1',   region: '덕양구',   distance: '광역 동별 가이드',     group: 'goyang' },
  { slug: 'practice-room-goyang1',     region: '고양시',   distance: '광역 3호선 라인',      group: 'goyang' },
  { slug: 'practice-room-ilsan1',      region: '일산',     distance: '3호선 8~12정거장',     group: 'goyang' },
];

export const PRACTICE_ROOM_REGION_GROUP_LABELS: Record<PracticeRoomRegionLP['group'], string> = {
  walk: '도보권 (사이트 인접)',
  eunpyeong: '은평구 권역 — 3호선·6호선',
  seodaemun: '서대문 권역 — 3호선',
  goyang: '고양시 — 3호선 라인',
};
