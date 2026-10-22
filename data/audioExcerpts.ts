import type { Locale } from '../lib/i18n';
import type { GlobalTrack } from '../components/audio/GlobalPlayerProvider';

/**
 * LP·커버 그리드가 트는 30초 발췌(라이너 노트 §3-6 b). 전부 스튜디오 놀에서 녹음·믹싱한 곡이다.
 *
 * - 파일 규격: public/audio/excerpt-<slug>-<YYYYMMDD>.mp3, 256k, 30초, 앞 0.25s·뒤 0.8s 페이드
 *   (믹싱 비교 발췌와 같다). 생성: ffmpeg -ss <start> -t 30 -af "afade=t=in:st=0:d=0.25,afade=t=out:st=29.2:d=0.8" -b:a 256k.
 *   파일을 바꾸면 날짜를 새로 박는다 — /audio도 캐시된다.
 * - `service`가 그 LP의 발췌 자리(ServiceExcerpt)를, `portfolioId`가 커버 재생 버튼(홈·포트폴리오 그리드·포트폴리오 상세)을
 *   연다. `service`는 비워도 된다 — 커버에서만 트는 곡. 한 서비스에 여러 곡이면 배열에서 앞의 것이 LP에 나온다. 둘 다 없는
 *   서비스(축가·성우·레슨)는 자리가 비어 있고, 음원과 동의(저작권·실연권)가 오면 한 줄만 더하면 된다 — 운영자 몫.
 * - 곡명·아티스트를 적는다. 믹싱 전·후 비교 플레이어의 "곡명을 적지 않는다" 규칙은 그 플레이어(마스터링 출처 문제)에
 *   한한다 — 여기 곡들은 포트폴리오 플레이어가 이미 이름을 걸고 틀어 온 것들이다(data/portfolio/tracks.ts).
 */
export type ExcerptService = 'recording' | 'release' | 'mixing' | 'wedding' | 'voice' | 'lesson';

export interface AudioExcerpt {
  id: string;
  service?: ExcerptService;
  src: string;
  title: string;
  artist: string;
  /** 스튜디오 놀이 이 곡에서 맡은 일 — 도크의 한 줄 크레딧. */
  credit: Record<'ko' | 'en', string>;
  seconds: number;
  cover?: string;
  /** 커버 그리드에서 재생 버튼이 붙는 포트폴리오 항목. */
  portfolioId?: string;
}

export const AUDIO_EXCERPTS: readonly AudioExcerpt[] = [
  {
    id: 'excerpt-jai-fever',
    service: 'release',
    src: '/audio/excerpt-jai-fever-20261006.mp3',
    title: 'Fever',
    artist: 'Jai',
    credit: { ko: '스튜디오 놀 기획·녹음·믹싱', en: 'Planned, recorded and mixed at Studio NOL' },
    seconds: 30,
    cover: 'https://image.bugsm.co.kr/album/images/1000/373556/37355636.jpg',
    portfolioId: 'jai-golden-hour',
  },
  {
    id: 'excerpt-ryu-breath',
    service: 'recording',
    src: '/audio/excerpt-ryu-breath-20261006.mp3',
    title: '숨 (Breath)',
    artist: '류형수 (Vocal 김수린)',
    credit: { ko: '스튜디오 놀 녹음·믹싱', en: 'Recorded and mixed at Studio NOL' },
    seconds: 30,
    cover: '/images/album3.jpg',
    // 정규 1집 〈하루〉(2023) 수록곡 — 운영자 확인 2026-10-22.
    portfolioId: 'ryu-hyeong-su-haru',
  },
  {
    // 커버 재생 전용(service 없음) — 믹싱 LP에는 같은 곡의 믹싱 전·후 비교가 이미 있다.
    // 파일은 믹싱 비교의 "믹싱 후" 발췌(160~190초, 20261001c)와 같은 바이트다. 그쪽 태그가 바뀌어도 여기는 그대로 남게 따로 둔다.
    // 마스터링은 외부(이재수) 작업이라 크레딧에 넣지 않는다.
    id: 'excerpt-kim-dongsan-mulgyeol',
    src: '/audio/excerpt-kim-dongsan-mulgyeol-20261022.mp3',
    title: '물결 (Wave)',
    artist: '김동산과 블루이웃',
    credit: { ko: '스튜디오 놀 녹음·믹싱', en: 'Recorded and mixed at Studio NOL' },
    seconds: 30,
    cover: 'https://image.bugsm.co.kr/album/images/500/366018/36601838.jpg',
    portfolioId: 'kim-dong-san-mulgyeol',
  },
];

export const getExcerptForService = (service: ExcerptService): AudioExcerpt | undefined =>
  AUDIO_EXCERPTS.find((e) => e.service === service);

export const getExcerptForPortfolio = (portfolioId: string): AudioExcerpt | undefined =>
  AUDIO_EXCERPTS.find((e) => e.portfolioId === portfolioId);

/** 글로벌 플레이어가 받는 모양으로. component는 어느 자리에서 눌렀는지(GA4). */
export const toGlobalTrack = (
  excerpt: AudioExcerpt,
  locale: Locale,
  component: string,
  href?: string,
): GlobalTrack => ({
  id: excerpt.id,
  src: excerpt.src,
  title: `${excerpt.artist} — ${excerpt.title}`,
  subtitle: excerpt.credit[locale === 'ko' ? 'ko' : 'en'],
  cover: excerpt.cover,
  href,
  component,
  locale,
});
