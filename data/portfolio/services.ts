import type { LocaleDict } from './i18n';

// 포트폴리오 항목들이 공통으로 사용하는 서비스명 번역. 각 portfolio item의
// `services` 배열은 이 사전에서 골라 translate()로 현지화한다.
export const SERVICE_DICT = {
  planning: { ko: '기획', en: 'Planning', zh: '策划', es: 'Planificación', vi: 'Lên kế hoạch', th: 'วางแผน', uz: 'Rejalash' },
  recording: { ko: '레코딩', en: 'Recording', zh: '录音', es: 'Grabación', vi: 'Thu âm', th: 'บันทึกเสียง', uz: 'Yozuv' },
  mixing: { ko: '믹싱', en: 'Mixing', zh: '混音', es: 'Mezcla', vi: 'Mixing', th: 'มิกซ์', uz: 'Miks' },
  mastering: { ko: '마스터링', en: 'Mastering', zh: '母带', es: 'Masterización', vi: 'Mastering', th: 'มาสเตอริ่ง', uz: 'Mastering' },
  promotion: { ko: '홍보', en: 'Promotion', zh: '宣传', es: 'Promoción', vi: 'PR/Quảng bá', th: 'ประชาสัมพันธ์', uz: 'Targ‘ibot' },
  design: { ko: '아트워크', en: 'Artwork/Design', zh: '设计', es: 'Arte/Diseño', vi: 'Artwork/Thiết kế', th: 'อาร์ตเวิร์ก/ดีไซน์', uz: 'Artwork/Dizayn' },
  web: { ko: '웹사이트 제작', en: 'Web Development', zh: '网站制作', es: 'Desarrollo Web', vi: 'Phát triển web', th: 'พัฒนาเว็บไซต์', uz: 'Veb ishlab chiqish' },
  arrangement: { ko: '편곡', en: 'Arrangement', zh: '编曲', es: 'Arreglos', vi: 'Hòa âm/Arr.', th: 'เรียบเรียง', uz: 'Aranjim' },
  composition: { ko: '작곡', en: 'Composition', zh: '作曲', es: 'Composición', vi: 'Sáng tác', th: 'แต่งเพลง', uz: 'Kompozitsiya' },
} as const satisfies Record<string, LocaleDict>;

export type ServiceKey = keyof typeof SERVICE_DICT;
