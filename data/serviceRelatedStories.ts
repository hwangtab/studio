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

export type ServiceKey = 'wedding-song' | 'voice-acting' | 'lesson' | 'pricing' | 'cover-video' | 'release-project';

export const serviceRelatedStorySlugs: Record<ServiceKey, readonly string[]> = {
  'release-project': [
    'release-timeline1',
    'music-distribution1',
    'streaming-platforms1',
    'streaming-revenue1',
    'music-copyright1',
    'global-release1',
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
  'lesson': [
    'aspiring1',
    'audition-vocal1',
    'diaphragm1',
    'ear-training1',
    'adlib1',
    'balladstyle1',
  ],
  'cover-video': [
    'cover1',
    'music-video1',
    'practice-room-video-audition1',
    'youtube-music-channel1',
    'vocal-recording-guide1',
    'copyright-cover1',
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
