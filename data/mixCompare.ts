import type { Locale } from '../lib/i18n';
import {
  MIX_COMPARE_DURATION_SECONDS,
  MIX_COMPARE_PEAKS,
  MIX_COMPARE_TAG,
} from './mixComparePeaks';
import {
  MIX_COMPARE_EXCERPT_DURATION_SECONDS,
  MIX_COMPARE_EXCERPT_PEAKS,
  MIX_COMPARE_EXCERPT_TAG,
} from './mixComparePeaks.excerpt';

/**
 * 홈의 "믹싱 전 · 후" 비교 (components/audio/MixComparePlayer.tsx).
 *
 * 곡은 김동산과 블루이웃 〈물결〉(2024-12-20). 스튜디오 놀이 녹음·믹싱했다(data/portfolio/items.ts). "믹싱 후"의
 * 정체는 믹싱만 거친 소리가 아니라 **발매본**이라 라벨이 "믹싱 후 · 발매본"이다. 마스터링 담당은 화면에 적지 않는다
 * (운영자 결정 2026-09-30). 마스터링 전 믹스 파일이 생기면 scripts/build-mix-compare.mjs로 after를 바꿔 끼운다.
 *
 * 음원은 두 파일의 시간·음량을 맞춰 만든 것이다(스크립트 머리 주석). 음원을 바꾸면 `--tag`를 새 날짜로 —
 * `/audio/**`도 오래 캐시되는 경로다.
 */
export const MIX_COMPARE_SOURCES = {
  before: `/audio/mix-compare-before-${MIX_COMPARE_TAG}.mp3`,
  after: `/audio/mix-compare-after-${MIX_COMPARE_TAG}.mp3`,
} as const;

export type MixCompareVariant = 'full' | 'excerpt';

/**
 * 곡 세트 둘. `full`은 홈의 전체 곡(305.9초), `excerpt`는 발매·주문·믹싱 페이지의 30초 발췌(160~190초 구간,
 * 밴드와 보컬이 모두 들어간 구간 — 도입부·끝을 피했다). 발췌는 음량을 그 구간 안에서 다시 맞춘 별도 음원이다
 * (scripts/build-mix-compare.mjs --variant excerpt).
 * `downloadMb`는 화면에 적는 재생 시 받는 크기(파일 하나) — 128kbps × 길이.
 */
export const MIX_COMPARE_SETS = {
  full: {
    sources: MIX_COMPARE_SOURCES,
    durationSeconds: MIX_COMPARE_DURATION_SECONDS,
    peaks: MIX_COMPARE_PEAKS,
    downloadMb: '5',
  },
  excerpt: {
    sources: {
      before: `/audio/mix-compare-before-${MIX_COMPARE_EXCERPT_TAG}.mp3`,
      after: `/audio/mix-compare-after-${MIX_COMPARE_EXCERPT_TAG}.mp3`,
    },
    durationSeconds: MIX_COMPARE_EXCERPT_DURATION_SECONDS,
    peaks: MIX_COMPARE_EXCERPT_PEAKS,
    downloadMb: '0.5',
  },
} as const;

export interface MixCompareCopy {
  eyebrow: string;
  title: string;
  /** 발췌본을 넣는 페이지들의 소제목 — 절 제목이 아니라 그 절 안의 블록 제목이다. */
  excerptTitle: string;
  before: string;
  after: string;
  group: string;
  play: string;
  pause: string;
  position: string;
  note: string;
  download: string;
  error: string;
  portfolio: string;
  switchedTo: { before: string; after: string };
}

const t = (
  locale: Locale,
  dict: { ko: string; en: string; zh?: string; es?: string; vi?: string; th?: string; uz?: string },
): string => dict[locale as keyof typeof dict] || dict.en || dict.ko;

export const getMixCompareCopy = (locale: Locale, variant: MixCompareVariant = 'full'): MixCompareCopy => {
  const mb = MIX_COMPARE_SETS[variant].downloadMb;
  return {
  eyebrow: t(locale, {
    ko: '믹싱 전후', en: 'Before & after', zh: '混音前后', es: 'Antes y después',
    vi: 'Trước & sau khi mix', th: 'ก่อนและหลังมิกซ์', uz: 'Miksdan oldin va keyin',
  }),
  title: t(locale, {
    ko: '믹싱 전과 후를 직접 들어 보세요',
    en: 'Hear the mix, before and after',
    zh: '亲耳听听混音前后的差别',
    es: 'Escucha la mezcla, antes y después',
    vi: 'Nghe bản mix trước và sau',
    th: 'ฟังเสียงก่อนและหลังมิกซ์ด้วยตัวเอง',
    uz: 'Miksdan oldingi va keyingi ovozni o‘zingiz tinglang',
  }),
  excerptTitle: t(locale, {
    ko: '믹싱 전과 후, 30초만 들어 보세요',
    en: 'Hear the mix in 30 seconds',
    zh: '30秒听听混音前后',
    es: 'Escucha la mezcla en 30 segundos',
    vi: 'Nghe bản mix trước và sau trong 30 giây',
    th: 'ฟังก่อนและหลังมิกซ์ใน 30 วินาที',
    uz: 'Miksdan oldingi va keyingi ovozni 30 soniyada tinglang',
  }),
  before: t(locale, {
    ko: '믹싱 전', en: 'Before mix', zh: '混音前', es: 'Antes de la mezcla',
    vi: 'Trước khi mix', th: 'ก่อนมิกซ์', uz: 'Miksdan oldin',
  }),
  after: t(locale, {
    ko: '믹싱 후 · 발매본', en: 'After mix · Released', zh: '混音后 · 发行版', es: 'Después de la mezcla · publicada',
    vi: 'Sau khi mix · bản phát hành', th: 'หลังมิกซ์ · เวอร์ชันวางจำหน่าย', uz: 'Miksdan keyin · chiqarilgan versiya',
  }),
  group: t(locale, {
    ko: '들어 볼 음원', en: 'Version to listen to', zh: '选择试听版本', es: 'Versión a escuchar',
    vi: 'Chọn bản nghe', th: 'เลือกเวอร์ชันที่จะฟัง', uz: 'Tinglash versiyasini tanlang',
  }),
  play: t(locale, { ko: '재생', en: 'Play', zh: '播放', es: 'Reproducir', vi: 'Phát', th: 'เล่น', uz: 'Ijro etish' }),
  pause: t(locale, { ko: '일시정지', en: 'Pause', zh: '暂停', es: 'Pausar', vi: 'Tạm dừng', th: 'หยุดชั่วคราว', uz: 'Pauza' }),
  position: t(locale, {
    ko: '재생 위치', en: 'Playback position', zh: '播放位置', es: 'Posición de reproducción',
    vi: 'Vị trí phát', th: 'ตำแหน่งการเล่น', uz: 'Ijro o‘rni',
  }),
  note: t(locale, {
    ko: '두 음원은 같은 녹음이고, 음량은 같게 맞췄습니다. 스튜디오 놀에서 녹음하고 믹싱한 곡입니다.',
    en: 'Both versions come from the same recording and play at the same volume. The song was recorded and mixed at Studio NOL.',
    zh: '两个版本来自同一次录音，音量已调为一致。这首歌在 Studio NOL 录音并混音。',
    es: 'Ambas versiones son la misma grabación y suenan al mismo volumen. La canción se grabó y mezcló en Studio NOL.',
    vi: 'Hai bản là cùng một bản thu và được chỉnh về cùng mức âm lượng. Bài hát được thu âm và mix tại Studio NOL.',
    th: 'ทั้งสองเวอร์ชันมาจากการบันทึกเสียงเดียวกันและปรับระดับเสียงให้เท่ากัน เพลงนี้บันทึกเสียงและมิกซ์ที่ Studio NOL',
    uz: 'Ikkala versiya bir xil yozuvdan olingan va bir xil balandlikda ijro etiladi. Qoʻshiq Studio NOLda yozilgan va miks qilingan.',
  }),
  download: t(locale, {
    ko: `재생하면 음원을 내려받습니다(각 약 ${mb}MB).`,
    en: `Playing downloads the audio (about ${mb} MB each).`,
    zh: `播放时会下载音频（每个约 ${mb}MB）。`,
    es: `Al reproducir se descarga el audio (unos ${mb} MB cada uno).`,
    vi: `Khi phát sẽ tải âm thanh (khoảng ${mb} MB mỗi bản).`,
    th: `เมื่อกดเล่นจะโหลดไฟล์เสียง (ประมาณ ${mb} MB ต่อเวอร์ชัน)`,
    uz: `Ijro etilganda audio yuklanadi (har biri taxminan ${mb} MB).`,
  }),
  error: t(locale, {
    ko: '음원을 불러오지 못했습니다. 잠시 뒤 다시 눌러 주세요.',
    en: 'Could not load the audio. Please try again in a moment.',
    zh: '音频加载失败，请稍后再试。',
    es: 'No se pudo cargar el audio. Inténtalo de nuevo en un momento.',
    vi: 'Không tải được âm thanh. Vui lòng thử lại sau.',
    th: 'โหลดไฟล์เสียงไม่สำเร็จ กรุณาลองอีกครั้งภายหลัง',
    uz: 'Audio yuklanmadi. Birozdan keyin qayta urinib ko‘ring.',
  }),
  portfolio: t(locale, {
    ko: '포트폴리오 보기', en: 'View portfolio', zh: '查看作品集', es: 'Ver portafolio',
    vi: 'Xem portfolio', th: 'ดูผลงาน', uz: 'Portfolioni ko‘rish',
  }),
  switchedTo: {
    before: t(locale, {
      ko: '믹싱 전 음원', en: 'Before mix', zh: '混音前', es: 'Antes de la mezcla',
      vi: 'Trước khi mix', th: 'ก่อนมิกซ์', uz: 'Miksdan oldin',
    }),
    after: t(locale, {
      ko: '믹싱 후 음원', en: 'After mix', zh: '混音后', es: 'Después de la mezcla',
      vi: 'Sau khi mix', th: 'หลังมิกซ์', uz: 'Miksdan keyin',
    }),
  },
};
};
