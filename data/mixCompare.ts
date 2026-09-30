import type { Locale } from '../lib/i18n';
import { MIX_COMPARE_TAG } from './mixComparePeaks';

/**
 * 홈의 "믹싱 전 · 후" 비교 (components/home/HomeMixCompare.tsx).
 *
 * 곡은 김동산과 블루이웃 〈물결〉(2024-12-20). 스튜디오 놀이 녹음·믹싱했고 **마스터링은 이재수**다
 * (data/portfolio/items.ts). 그래서 "믹싱 후"의 정체는 믹싱만 거친 소리가 아니라 **발매본**이고, 화면이
 * 그렇게 밝힌다 — 발매본의 음량·질감 일부는 마스터링 몫인데 그걸 전부 우리 믹싱으로 읽히게 두지 않는다.
 * 마스터링 전 믹스 파일이 생기면 scripts/build-mix-compare.mjs로 after를 바꿔 끼우고 라벨을 고친다.
 *
 * 음원은 두 파일의 시간·음량을 맞춰 만든 것이다(스크립트 머리 주석). 음원을 바꾸면 `--tag`를 새 날짜로 —
 * `/audio/**`도 오래 캐시되는 경로다.
 */
export const MIX_COMPARE_SOURCES = {
  before: `/audio/mix-compare-before-${MIX_COMPARE_TAG}.mp3`,
  after: `/audio/mix-compare-after-${MIX_COMPARE_TAG}.mp3`,
} as const;

/** 재생하면 내려받는 크기(파일 하나) — 화면에 "약 5MB"로 적는다. 128kbps × 305.9초. */
export const MIX_COMPARE_DOWNLOAD_MB = 5;

export interface MixCompareCopy {
  eyebrow: string;
  title: string;
  track: string;
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

export const getMixCompareCopy = (locale: Locale): MixCompareCopy => ({
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
  track: t(locale, {
    ko: '김동산과 블루이웃 〈물결〉',
    en: 'Kim Dong-san & Blueyouth — “Mulgyeol”',
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
    ko: '두 음원의 음량은 같게 맞췄습니다. 발매본은 스튜디오 놀이 녹음·믹싱했고 마스터링은 이재수가 맡았습니다.',
    en: 'Both versions play at the same volume. The released version was recorded and mixed at Studio NOL and mastered by Lee Jae-su.',
    zh: '两个版本的音量已调为一致。发行版由 Studio NOL 录音、混音，母带处理由 Lee Jae-su 完成。',
    es: 'Ambas versiones suenan al mismo volumen. La versión publicada se grabó y mezcló en Studio NOL y la masterizó Lee Jae-su.',
    vi: 'Hai bản được chỉnh về cùng mức âm lượng. Bản phát hành được thu âm và mix tại Studio NOL, mastering bởi Lee Jae-su.',
    th: 'ทั้งสองเวอร์ชันปรับระดับเสียงให้เท่ากัน เวอร์ชันวางจำหน่ายบันทึกเสียงและมิกซ์ที่ Studio NOL และมาสเตอริงโดย Lee Jae-su',
    uz: 'Ikkala versiya bir xil balandlikda ijro etiladi. Chiqarilgan versiya Studio NOLda yozilgan va miks qilingan, mastering Lee Jae-su tomonidan bajarilgan.',
  }),
  download: t(locale, {
    ko: `재생하면 음원을 내려받습니다(각 약 ${MIX_COMPARE_DOWNLOAD_MB}MB).`,
    en: `Playing downloads the audio (about ${MIX_COMPARE_DOWNLOAD_MB} MB each).`,
    zh: `播放时会下载音频（每个约 ${MIX_COMPARE_DOWNLOAD_MB}MB）。`,
    es: `Al reproducir se descarga el audio (unos ${MIX_COMPARE_DOWNLOAD_MB} MB cada uno).`,
    vi: `Khi phát sẽ tải âm thanh (khoảng ${MIX_COMPARE_DOWNLOAD_MB} MB mỗi bản).`,
    th: `เมื่อกดเล่นจะโหลดไฟล์เสียง (ประมาณ ${MIX_COMPARE_DOWNLOAD_MB} MB ต่อเวอร์ชัน)`,
    uz: `Ijro etilganda audio yuklanadi (har biri taxminan ${MIX_COMPARE_DOWNLOAD_MB} MB).`,
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
});
