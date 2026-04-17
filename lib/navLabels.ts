import { type Locale } from './i18n-config';

// SSR/SSG에서 i18n.t() 의존 없이 SiteNavigationElement JSON-LD를 생성하기 위한 정적 매핑.
// public/locales/*/common.json의 nav 섹션과 동기화 유지.
export type NavKey =
  | 'home'
  | 'pricing'
  | 'equipment'
  | 'practiceRoom'
  | 'lesson'
  | 'weddingSong'
  | 'voiceActing'
  | 'portfolio'
  | 'stories'
  | 'contact';

export const navLabels: Record<Locale, Record<NavKey, string>> = {
  ko: {
    home: '홈',
    pricing: '가격',
    equipment: '장비',
    practiceRoom: '음악연습실',
    lesson: '레슨',
    weddingSong: '축가 녹음',
    voiceActing: '성우 녹음',
    portfolio: '포트폴리오',
    stories: '스토리',
    contact: '문의',
  },
  en: {
    home: 'Home',
    pricing: 'Pricing',
    equipment: 'Gear',
    practiceRoom: 'Practice',
    lesson: 'Lesson',
    weddingSong: 'Wedding Song',
    voiceActing: 'Voice Acting',
    portfolio: 'Portfolio',
    stories: 'Stories',
    contact: 'Contact',
  },
  zh: {
    home: '主页',
    pricing: '价格',
    equipment: '设备介绍',
    practiceRoom: '练习室',
    lesson: '课程',
    weddingSong: '婚礼祝歌录音',
    voiceActing: '配音录音',
    portfolio: '作品集',
    stories: '故事',
    contact: '联系我们',
  },
  es: {
    home: 'Inicio',
    pricing: 'Precios',
    equipment: 'Equipo',
    practiceRoom: 'Sala',
    lesson: 'Clases',
    weddingSong: 'Canción de Boda',
    voiceActing: 'Locución',
    portfolio: 'Portafolio',
    stories: 'Historias',
    contact: 'Contacto',
  },
  vi: {
    home: 'Trang chủ',
    pricing: 'Giá dịch vụ',
    equipment: 'Thiết bị',
    practiceRoom: 'Phòng tập',
    lesson: 'Bài học',
    weddingSong: 'Thu Âm Bài Chúc',
    voiceActing: 'Lồng Tiếng',
    portfolio: 'Portfolio',
    stories: 'Câu chuyện',
    contact: 'Liên hệ',
  },
  th: {
    home: 'หน้าแรก',
    pricing: 'ราคา',
    equipment: 'อุปกรณ์',
    practiceRoom: 'ห้องซ้อม',
    lesson: 'บทเรียน',
    weddingSong: 'บันทึกเพลงอวยพร',
    voiceActing: 'บันทึกเสียงพากย์',
    portfolio: 'พอร์ตโฟลิโอ',
    stories: 'เรื่องราว',
    contact: 'ติดต่อ',
  },
  uz: {
    home: 'Bosh sahifa',
    pricing: 'Narxlar',
    equipment: 'Uskunalar',
    practiceRoom: "Mashg'ulot xonasi",
    lesson: 'Dars',
    weddingSong: "To'y qo'shig'i",
    voiceActing: 'Ovoz yozish',
    portfolio: 'Portfel',
    stories: 'Hikoyalar',
    contact: 'Aloqa',
  },
};
