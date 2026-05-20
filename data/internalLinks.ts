/**
 * 내부 링크 자동 삽입용 토픽-슬러그 매핑 레지스트리
 *
 * MarkdownRenderer에서 본문 내 키워드를 탐지하여 자동으로 링크를 삽입할 때 사용됩니다.
 * - 키워드 매칭은 기사당 최대 MAX_AUTO_LINKS개 까지
 * - 이미 링크가 걸린 키워드는 건너뜀
 * - 자기 자신 페이지로의 링크는 제외
 */

export interface TopicLink {
  /** 대상 스토리 slug (파일명에서 .md 제외) */
  slug: string;
  /** 링크 앵커 텍스트 (키워드와 다를 수 있음) */
  anchorText: string;
}

/** 기사당 자동 삽입 최대 링크 수 (3 → 5로 상향, 2026-05-08) */
export const MAX_AUTO_LINKS = 5;

/**
 * 토픽 키워드 → 링크 매핑
 *
 * 키: 본문에서 탐지할 키워드 (정확히 이 문자열이 본문에 포함되어야 함)
 * 값: 링크할 대상 slug과 앵커 텍스트
 *
 * 등록 규칙:
 * - 키워드는 2글자 이상, 너무 일반적인 단어(예: "음악", "녹음") 제외
 * - 동일 slug를 가리키는 키워드는 최대 3-4개 (anchor variants 다양화 위해 2 → 3-4로 완화, 2026-05-08)
 * - 전체 기사의 15%를 초과하여 링크되는 slug가 없도록 관리
 */
export const topicLinks: Record<string, TopicLink> = {
  // ─── 녹음 기초 ───
  '녹음실 처음': { slug: 'guide1', anchorText: '녹음실 처음 방문 가이드' },
  '녹음실 처음 이용': { slug: 'guide1', anchorText: '녹음실 첫 이용 가이드' },
  '보컬 녹음 준비': { slug: 'vocal-prep1', anchorText: '보컬 녹음 준비 체크리스트' },
  '처음 보컬 녹음': { slug: 'vocal-recording-guide1', anchorText: '처음 보컬 녹음하는 법' },
  '마이크 거리': { slug: 'vocal-recording-guide1', anchorText: '마이크 포지셔닝 가이드' },
  '보컬 컴핑': { slug: 'vocal-recording-guide1', anchorText: '보컬 컴핑 절차' },
  '1인 보컬 녹음': { slug: 'vocal-solo-recording1', anchorText: '1인 보컬 녹음 가이드' },
  '솔로 보컬': { slug: 'vocal-solo-recording1', anchorText: '솔로 보컬 녹음 가이드' },
  '홈레코딩': { slug: 'home-vs-studio1', anchorText: '홈레코딩 vs 스튜디오 비교' },
  '녹음실 비용': { slug: 'home-vs-studio1', anchorText: '녹음실 비용 비교' },
  '스튜디오 녹음 vs 홈': { slug: 'home-vs-studio1', anchorText: '스튜디오 vs 홈레코딩 비교' },

  // ─── 믹싱 & 마스터링 ───
  '믹싱 강좌': { slug: 'mixing-complete-guide', anchorText: '믹싱 완전 가이드 — 23편 로드맵' },
  '믹싱 로드맵': { slug: 'mixing-complete-guide', anchorText: '믹싱 학습 로드맵' },
  '보컬 EQ': { slug: 'eq-guide1', anchorText: '보컬 EQ 가이드' },
  '컴프레서 설정': { slug: 'compression-guide1', anchorText: '컴프레서 완전 가이드' },
  '디에서': { slug: 'de-esser1', anchorText: '디에서(De-esser) 가이드' },
  '오토튠': { slug: 'autotune1', anchorText: '오토튠·피치 교정 가이드' },
  '딜레이 종류': { slug: 'delay-types1', anchorText: '딜레이 종류 가이드' },
  'DAW 템플릿': { slug: 'daw-template1', anchorText: 'DAW 믹싱 템플릿 가이드' },

  // ─── 보컬 테크닉 ───
  '복식호흡': { slug: 'diaphragm1', anchorText: '복식호흡·횡격막 발성 가이드' },
  '호흡 지지': { slug: 'breath-support1', anchorText: '보컬 호흡 지지 가이드' },
  '음감 훈련': { slug: 'ear-training1', anchorText: '음감 훈련 가이드' },
  '애드립': { slug: 'adlib1', anchorText: '애드립·런 가이드' },
  '아티큘레이션': { slug: 'articulation1', anchorText: '보컬 아티큘레이션 가이드' },
  '발라드 창법': { slug: 'balladstyle1', anchorText: '발라드 창법 가이드' },
  '무대 공포증': { slug: 'practice-room-anxiety1', anchorText: '무대 공포증 극복 가이드' },

  // ─── 녹음 장르별 ───
  '밴드 녹음': { slug: 'band-recording-guide1', anchorText: '밴드 레코딩 가이드' },
  '어쿠스틱 녹음': { slug: 'acoustic-recording1', anchorText: '어쿠스틱 녹음 가이드' },
  'ASMR 녹음': { slug: 'asmr1', anchorText: 'ASMR 녹음 가이드' },
  '팟캐스트 녹음': { slug: 'podcast1', anchorText: '팟캐스트 녹음 가이드' },
  '오디오북 녹음': { slug: 'audiobook-guide1', anchorText: '오디오북 제작 가이드' },
  '합창 녹음': { slug: 'choir1', anchorText: '합창 녹음 가이드' },
  '축가 녹음': { slug: 'wedding-song-guide1', anchorText: '축가 녹음 준비 가이드' },
  '성우 데모': { slug: 'voice-actor-demo1', anchorText: '성우 데모 녹음 가이드' },
  '오디션 데모': { slug: 'voice-actor-demo1', anchorText: '오디션 데모 녹음 가이드' },

  // ─── 음악 제작 & 발매 ───
  '편곡 팁': { slug: 'arrangement-tips1', anchorText: '편곡 팁 가이드' },
  '음반 발매': { slug: 'album-release1', anchorText: '정규앨범 발매 가이드' },
  '음원 발매 절차': { slug: 'album-release1', anchorText: '음원 발매 가이드' },
  '음반 비용': { slug: 'album-cost1', anchorText: '음반 제작 비용 가이드' },
  '커버 아트': { slug: 'album-art1', anchorText: '앨범 아트 제작 가이드' },
  'AI 음악': { slug: 'ai-music1', anchorText: 'AI 음악 제작 가이드' },
  '808 베이스': { slug: '808-bass1', anchorText: '808 베이스 믹싱 가이드' },
  '혼자 앨범': { slug: 'solo-album1', anchorText: '혼자 앨범 내는 방법' },
  '1인 음반': { slug: 'solo-album1', anchorText: '1인 음반 제작 가이드' },
  '인디 뮤지션': { slug: 'indie-musician-studio1', anchorText: '인디 뮤지션 녹음실 가이드' },
  '인디 EP': { slug: 'indie-musician-studio1', anchorText: '인디 EP 제작 가이드' },

  // ─── 비즈니스 & 프로모션 ───
  '아티스트 브랜딩': { slug: 'artist-branding1', anchorText: '아티스트 브랜딩 가이드' },
  '커버 곡 저작권': { slug: 'copyright-cover1', anchorText: '커버 곡 저작권 가이드' },
  '해외 음원 발매': { slug: 'global-release1', anchorText: '글로벌 음원 발매 가이드' },
  '데모 녹음': { slug: 'demo-recording1', anchorText: '오디션 데모 녹음 가이드' },
  '데모 음원': { slug: 'demo-recording1', anchorText: '데모 녹음 절차' },

  // ─── 장비 & 기술 ───
  '오디오 인터페이스': { slug: 'audio-interface1', anchorText: '오디오 인터페이스 가이드' },
  '앰프 시뮬레이터': { slug: 'amp-simulator1', anchorText: '앰프 시뮬레이터 가이드' },
  'MP3 vs WAV': { slug: 'audioformat1', anchorText: 'MP3 vs WAV 차이 가이드' },
  '방음 처리': { slug: 'acoustic-treatment1', anchorText: '방음·흡음 가이드' },
  '방음 합주실': { slug: 'soundproof-rehearsal-seoul1', anchorText: '서울 방음 합주실 가이드' },
  '서울 합주실': { slug: 'soundproof-rehearsal-seoul1', anchorText: '서울 합주실 선택 가이드' },
  '합주실 예약': { slug: 'practice-room-booking1', anchorText: '합주실 예약 가이드' },
  '연습실 예약': { slug: 'practice-room-booking1', anchorText: '연습실 예약 가이드' },
  '마스터링 시점': { slug: 'mastering1', anchorText: '마스터링 의뢰 시점 가이드' },
  '스트리밍 LUFS': { slug: 'loudness1', anchorText: '스트리밍 LUFS 가이드' },
  '라우드니스': { slug: 'loudness1', anchorText: '라우드니스 정규화 가이드' },

  // ─── 오디션 & 입시 ───
  '보컬 오디션': { slug: 'audition-vocal1', anchorText: '보컬 오디션 가이드' },
  '예술고 입시': { slug: 'practice-room-arts-high1', anchorText: '예술고 입시 준비 가이드' },
  '가수 지망생': { slug: 'aspiring1', anchorText: '가수 지망생 로드맵' },

  // ─── 지역 LP (21개 동·역세권 dedicated) ───
  // hub-spoke 카니발리제이션 방지: 이 키워드들은 본문에서 자동 발견되면 dedicated LP로
  // 직접 연결돼 PageRank를 spoke로 집중시킨다.
  '연신내 음악연습실': { slug: 'practice-room-yeonsinnae1', anchorText: '연신내 음악연습실 입주 가이드' },
  '불광 음악연습실': { slug: 'practice-room-bulgwang1', anchorText: '불광 음악연습실 입주 가이드' },
  '은평구 음악연습실': { slug: 'practice-room-eunpyeong1', anchorText: '은평구 음악연습실 입주 가이드' },
  '대조동 음악연습실': { slug: 'practice-room-daejo1', anchorText: '대조동 음악연습실 입주 가이드' },
  '구산 음악연습실': { slug: 'practice-room-gusan1', anchorText: '구산 음악연습실 입주 가이드' },
  '서대문 음악연습실': { slug: 'practice-room-seodaemun1', anchorText: '서대문 음악연습실 입주 가이드' },
  '역촌 음악연습실': { slug: 'practice-room-yeokchon1', anchorText: '역촌 음악연습실 입주 가이드' },
  '응암 음악연습실': { slug: 'practice-room-eungam1', anchorText: '응암 음악연습실 입주 가이드' },
  '증산 음악연습실': { slug: 'practice-room-jeungsan1', anchorText: '증산 음악연습실 입주 가이드' },
  '새절 음악연습실': { slug: 'practice-room-saejeol1', anchorText: '새절 음악연습실 입주 가이드' },
  '독바위 음악연습실': { slug: 'practice-room-dokbawi1', anchorText: '독바위 음악연습실 입주 가이드' },
  '상암 음악연습실': { slug: 'practice-room-sangam1', anchorText: '상암 음악연습실 입주 가이드' },
  '구파발 음악연습실': { slug: 'practice-room-gupabal1', anchorText: '구파발 음악연습실 입주 가이드' },
  '지축 음악연습실': { slug: 'practice-room-jichuk1', anchorText: '지축 음악연습실 입주 가이드' },
  '원흥 음악연습실': { slug: 'practice-room-wonheung1', anchorText: '원흥 음악연습실 입주 가이드' },
  '녹번 음악연습실': { slug: 'practice-room-nokbeon1', anchorText: '녹번 음악연습실 입주 가이드' },
  '삼송 음악연습실': { slug: 'practice-room-samsong1', anchorText: '삼송 음악연습실 입주 가이드' },
  '원당 음악연습실': { slug: 'practice-room-wondang1', anchorText: '원당 음악연습실 입주 가이드' },
  '고양 음악연습실': { slug: 'practice-room-goyang1', anchorText: '고양 음악연습실 입주 가이드' },
  '덕양구 음악연습실': { slug: 'practice-room-deogyang1', anchorText: '덕양구 음악연습실 입주 가이드' },
  '일산 음악연습실': { slug: 'practice-room-ilsan1', anchorText: '일산 음악연습실 입주 가이드' },

  // ─── Buyer-intent 가이드 허브 4종 ───
  // 정보 의도 키워드 → 종합 가이드 hub로 연결. hub는 4종 dedicated 페이지로 운영.
  '보컬 입문': { slug: 'vocal-beginners-guide', anchorText: '보컬 입문 종합 가이드' },
  '보컬 초보': { slug: 'vocal-beginners-guide', anchorText: '보컬 초보자 학습 로드맵' },
  '홈레코딩 시작': { slug: 'home-recording-survival', anchorText: '홈레코딩 시작 가이드' },
  '홈레코딩 장비': { slug: 'home-recording-survival', anchorText: '홈레코딩 장비 선택 가이드' },
  '축가 부르기': { slug: 'wedding-song-singing', anchorText: '축가 부르기 종합 가이드' },
  '축가 연습': { slug: 'wedding-song-singing', anchorText: '축가 연습·녹음 가이드' },
  '오디오북·ASMR 입문': { slug: 'audiobook-asmr-getting-started', anchorText: '오디오북·ASMR 입문 가이드' },
  'ASMR 입문': { slug: 'audiobook-asmr-getting-started', anchorText: 'ASMR 입문 가이드' },
  '월세 입주': { slug: 'practice-room-monthly1', anchorText: '연습실 월세 입주 비용·계약 가이드' },
  '무인 연습실': { slug: 'practice-room-unmanned1', anchorText: '무인 연습실 완벽 가이드' },
  '연습실 운영': { slug: 'practice-room-startup1', anchorText: '음악연습실 창업·운영 가이드' },
  '스트리밍 수익': { slug: 'revenue1', anchorText: '스트리밍 수익 계산 가이드' },
  '샘플레이트': { slug: 'sample-rate1', anchorText: '샘플레이트·비트뎁스 선택 가이드' },
  '플러그인 추천': { slug: 'plugins1', anchorText: '보컬 믹싱 플러그인 추천 가이드' },
  'EPK': { slug: 'epk1', anchorText: 'EPK 제작 가이드' },
  '위상 문제': { slug: 'phase1', anchorText: '오디오 위상 문제 식별·교정 가이드' },
  '이조': { slug: 'transpose1', anchorText: '음역에 맞는 이조·키 설정 가이드' },
  'LA-2A': { slug: 'la2a1', anchorText: 'LA-2A 컴프레서 활용 가이드' },
};
