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

/** 기사당 자동 삽입 최대 링크 수 */
export const MAX_AUTO_LINKS = 3;

/**
 * 토픽 키워드 → 링크 매핑
 *
 * 키: 본문에서 탐지할 키워드 (정확히 이 문자열이 본문에 포함되어야 함)
 * 값: 링크할 대상 slug과 앵커 텍스트
 *
 * 등록 규칙:
 * - 키워드는 2글자 이상, 너무 일반적인 단어(예: "음악", "녹음") 제외
 * - 동일 slug를 가리키는 키워드는 최대 2개
 * - 전체 기사의 15%를 초과하여 링크되는 slug가 없도록 관리
 */
export const topicLinks: Record<string, TopicLink> = {
  // ─── 녹음 기초 ───
  '녹음실 처음': { slug: 'guide1', anchorText: '녹음실 처음 방문 가이드' },
  '보컬 녹음 준비': { slug: 'vocal-prep1', anchorText: '보컬 녹음 준비 체크리스트' },
  '홈레코딩': { slug: 'home-vs-studio1', anchorText: '홈레코딩 vs 스튜디오 비교' },

  // ─── 믹싱 & 마스터링 ───
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

  // ─── 음악 제작 & 발매 ───
  '편곡 팁': { slug: 'arrangement-tips1', anchorText: '편곡 팁 가이드' },
  '음반 발매': { slug: 'album-release1', anchorText: '정규앨범 발매 가이드' },
  '음반 비용': { slug: 'album-cost1', anchorText: '음반 제작 비용 가이드' },
  '커버 아트': { slug: 'album-art1', anchorText: '앨범 아트 제작 가이드' },
  'AI 음악': { slug: 'ai-music1', anchorText: 'AI 음악 제작 가이드' },
  '808 베이스': { slug: '808-bass1', anchorText: '808 베이스 믹싱 가이드' },

  // ─── 비즈니스 & 프로모션 ───
  '아티스트 브랜딩': { slug: 'artist-branding1', anchorText: '아티스트 브랜딩 가이드' },
  '커버 곡 저작권': { slug: 'copyright-cover1', anchorText: '커버 곡 저작권 가이드' },
  '해외 음원 발매': { slug: 'global-release1', anchorText: '글로벌 음원 발매 가이드' },
  '데모 녹음': { slug: 'demo-recording1', anchorText: '오디션 데모 녹음 가이드' },

  // ─── 장비 & 기술 ───
  '오디오 인터페이스': { slug: 'audio-interface1', anchorText: '오디오 인터페이스 가이드' },
  '앰프 시뮬레이터': { slug: 'amp-simulator1', anchorText: '앰프 시뮬레이터 가이드' },
  'MP3 vs WAV': { slug: 'audioformat1', anchorText: 'MP3 vs WAV 차이 가이드' },
  '방음 처리': { slug: 'acoustic-treatment1', anchorText: '방음·흡음 가이드' },

  // ─── 오디션 & 입시 ───
  '보컬 오디션': { slug: 'audition-vocal1', anchorText: '보컬 오디션 가이드' },
  '예술고 입시': { slug: 'practice-room-arts-high1', anchorText: '예술고 입시 준비 가이드' },
  '가수 지망생': { slug: 'aspiring1', anchorText: '가수 지망생 로드맵' },
};
