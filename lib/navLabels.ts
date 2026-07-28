import { type Locale } from './i18n-config';

// SSR/SSG에서 i18n.t() 의존 없이 SiteNavigationElement JSON-LD를 생성하기 위한 정적 매핑.
// public/locales/*/common.json의 nav 섹션과 동기화 유지.
export type NavKey =
  | 'home'
  | 'pricing'
  | 'equipment'
  | 'practiceRoom'
  | 'lesson'
  | 'mixingMastering'
  | 'weddingSong'
  | 'voiceActing'
  | 'portfolio'
  | 'stories'
  | 'contact'
  | 'releaseProject'
  | 'releaseSingle'
  | 'releaseEp'
  | 'releaseAlbum';

export const navLabels: Record<Locale, Record<NavKey, string>> = {
  ko: {
    home: '홈',
    pricing: '가격',
    equipment: '장비',
    practiceRoom: '음악연습실',
    lesson: '레슨',
    mixingMastering: '믹싱·마스터링',
    weddingSong: '축가 녹음',
    voiceActing: '성우 녹음',
    portfolio: '포트폴리오',
    stories: '스토리',
    contact: '문의',
    releaseProject: '음원 발매 개요',
    releaseSingle: '싱글 발매',
    releaseEp: 'EP 발매',
    releaseAlbum: '정규 발매',
  },
  en: {
    home: 'Home',
    pricing: 'Pricing',
    equipment: 'Gear',
    practiceRoom: 'Practice',
    lesson: 'Lesson',
    mixingMastering: 'Mixing & Mastering',
    weddingSong: 'Wedding Song',
    voiceActing: 'Voice Acting',
    portfolio: 'Portfolio',
    stories: 'Stories',
    contact: 'Contact',
    releaseProject: 'Overview',
    releaseSingle: 'Single',
    releaseEp: 'EP',
    releaseAlbum: 'Full Album',
  },
  zh: {
    home: '主页',
    pricing: '价格',
    equipment: '设备介绍',
    practiceRoom: '练习室',
    lesson: '课程',
    mixingMastering: '混音·母带',
    weddingSong: '婚礼祝歌录音',
    voiceActing: '配音录音',
    portfolio: '作品集',
    stories: '故事',
    contact: '联系我们',
    releaseProject: '概览',
    releaseSingle: '单曲',
    releaseEp: 'EP',
    releaseAlbum: '专辑',
  },
  es: {
    home: 'Inicio',
    pricing: 'Precios',
    equipment: 'Equipo',
    practiceRoom: 'Sala',
    lesson: 'Clases',
    mixingMastering: 'Mezcla y Masterización',
    weddingSong: 'Canción de Boda',
    voiceActing: 'Locución',
    portfolio: 'Portafolio',
    stories: 'Historias',
    contact: 'Contacto',
    releaseProject: 'Descripción general',
    releaseSingle: 'Single',
    releaseEp: 'EP',
    releaseAlbum: 'Álbum completo',
  },
  vi: {
    home: 'Trang chủ',
    pricing: 'Giá dịch vụ',
    equipment: 'Thiết bị',
    practiceRoom: 'Phòng tập',
    lesson: 'Bài học',
    mixingMastering: 'Mixing & Mastering',
    weddingSong: 'Thu Âm Bài Chúc',
    voiceActing: 'Lồng Tiếng',
    portfolio: 'Portfolio',
    stories: 'Câu chuyện',
    contact: 'Liên hệ',
    releaseProject: 'Tổng quan',
    releaseSingle: 'Single',
    releaseEp: 'EP',
    releaseAlbum: 'Album đầy đủ',
  },
  th: {
    home: 'หน้าแรก',
    pricing: 'ราคา',
    equipment: 'อุปกรณ์',
    practiceRoom: 'ห้องซ้อม',
    lesson: 'บทเรียน',
    mixingMastering: 'มิกซ์ & มาสเตอร์',
    weddingSong: 'บันทึกเพลงอวยพร',
    voiceActing: 'บันทึกเสียงพากย์',
    portfolio: 'พอร์ตโฟลิโอ',
    stories: 'เรื่องราว',
    contact: 'ติดต่อ',
    releaseProject: 'ภาพรวม',
    releaseSingle: 'ซิงเกิล',
    releaseEp: 'EP',
    releaseAlbum: 'อัลบั้มเต็ม',
  },
  uz: {
    home: 'Bosh sahifa',
    pricing: 'Narxlar',
    equipment: 'Uskunalar',
    practiceRoom: "Mashg'ulot xonasi",
    lesson: 'Dars',
    mixingMastering: 'Miks va mastering',
    weddingSong: "To'y qo'shig'i",
    voiceActing: 'Ovoz yozish',
    portfolio: 'Portfel',
    stories: 'Hikoyalar',
    contact: 'Aloqa',
    releaseProject: "Umumiy ko'rinish",
    releaseSingle: 'Singl',
    releaseEp: 'EP',
    releaseAlbum: "To'liq albom",
  },
};
