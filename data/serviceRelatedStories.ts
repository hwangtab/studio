/**
 * Service LP → 큐레이션된 관련 스토리 매핑.
 *
 * 카테고리·태그 점수로 자동 매칭하는 getRelatedStories와 달리, 서비스 LP는
 * 구매 의도 직전 단계라 buyer-intent에 정확히 매칭되는 글만 손으로 골랐다.
 * 자산은 이미 1,730 스토리 안에 있고 surface 동선만 비어 있던 상태.
 *
 * 규칙:
 * - 모든 slug는 content/stories/{slug}.md 가 실재해야 함 (빌드 시 검증)
 * - 서비스당 6편 (StoryCard 그리드 1행 3개 × 2행에 자연스럽게 들어감)
 * - 카테고리 분포는 의도적으로 다양하게 (recording/vocal/lesson/business 혼합)
 */

export type ServiceKey = 'recording' | 'wedding-song' | 'voice-acting' | 'lesson' | 'pricing' | 'cover-video' | 'release-project' | 'mixing-mastering' | 'music-promotion';

export const serviceRelatedStorySlugs: Record<ServiceKey, readonly string[]> = {
  'recording': [
    'recording-price1',
    'studio-compare1',
    'vocal-recording-guide1',
    'demo-recording1',
    'home-vs-studio1',
    'solo-album1',
  ],
  'release-project': [
    'release-timeline1',
    'music-distribution1',
    'streaming-platforms1',
    'streaming-revenue1',
    'music-copyright1',
    'global-release1',
    // 발매 홍보(보도자료·기자·평론가·해외 매체 피칭)를 정면으로 다루는 유일한 글.
    'music-pr1',
  ],
  'music-promotion': [
    // 발매 홍보를 정면으로 다루는 글이 먼저 온다. 나머지는 발매 준비 전반이라
    // release-project와 겹치지만, 홍보를 찾아온 사람에게도 필요한 맥락이다.
    'music-pr1',
    'release-timeline1',
    'music-distribution1',
    'global-release1',
    'streaming-platforms1',
    'music-copyright1',
  ],
  'wedding-song': [
    'wedding-song-guide1',
    'vocal-prep1',
    'vocal-recording-guide1',
    'diaphragm1',
    'breath-support1',
    'balladstyle1',
  ],
  'voice-acting': [
    'voice-actor-hiring-quote-cost',
    'voice-actor-demo1',
    'audiobook-guide1',
    'asmr1',
    'podcast1',
    'articulation1',
    'audio-interface1',
  ],
  // 2026-07-28 교체: 이전 6편(aspiring1·audition-vocal1·diaphragm1·ear-training1·adlib1·
  // balladstyle1)은 전부 보컬 발성·오디션 주제였다. 레슨은 프로듀싱(작곡·미디·믹싱·발매)만
  // 가르치고 보컬 레슨은 아예 운영하지 않으므로, 읽고 온 사람의 기대와 실제 상품이 어긋났다.
  // 앞 3편은 등록 전에 실제로 걸리는 질문(건반을 못 치는데 되나·독학으로 될까·얼마가 정상인가),
  // 뒤 3편은 커리큘럼이 어디로 가는지 미리 보여주는 글이다.
  'lesson': [
    'lesson-keyboard-skill1',
    'self-study-vs-lesson1',
    'lesson-price-market-2026',
    'producer1',
    'daw-choice1',
    'mixing-complete-guide',
  ],
  'cover-video': [
    'cover1',
    'music-video1',
    'practice-room-video-audition1',
    'youtube-music-channel1',
    'vocal-recording-guide1',
    'copyright-cover1',
  ],
  'mixing-mastering': [
    'onlinemix1',
    'mixing-vs-mastering1',
    'mixing-mastering-price-by-track-count',
    'mix-prep1',
    'stem-mixing1',
    'mastering1',
  ],
  'pricing': [
    'home-vs-studio1',
    'album-cost1',
    'album-release1',
    'mixing-complete-guide',
    'demo-recording1',
    'guide1',
  ],
};
