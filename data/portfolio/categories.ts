import type { PortfolioCategory } from '../../types/data';
import type { Locale } from '../../lib/i18n';
import { translate } from './i18n';

export const buildCategories = (locale: Locale): PortfolioCategory[] => [
  {
    id: 'all',
    name: translate(locale, { ko: '전체', en: 'All', zh: '全部', es: 'Todo', vi: 'Tất cả', th: 'ทั้งหมด', uz: 'Barchasi' }),
    description: translate(locale, { ko: '모든 프로젝트', en: 'All Projects', zh: '所有项目', es: 'Todos los proyectos', vi: 'Tất cả dự án', th: 'ทุกโปรเจกต์', uz: 'Barcha loyihalar' }),
    color: '#6d28d9',
  },
  {
    id: 'album',
    name: translate(locale, { ko: '앨범', en: 'Album', zh: '专辑', es: 'Álbum', vi: 'Album', th: 'อัลบั้ม', uz: 'Albom' }),
    description: translate(locale, { ko: '정규 앨범 프로젝트', en: 'Full Album Projects', zh: '正规专辑项目', es: 'Proyectos de Álbum Completo', vi: 'Dự án album đầy đủ', th: 'โปรเจกต์อัลบั้มเต็ม', uz: 'To‘liq albom loyihalari' }),
    color: '#db2777',
  },
  {
    id: 'single',
    name: translate(locale, { ko: '싱글', en: 'Single', zh: '单曲', es: 'Sencillo', vi: 'Single', th: 'ซิงเกิล', uz: 'Singl' }),
    description: translate(locale, { ko: '싱글 곡 프로젝트', en: 'Single Song Projects', zh: '单曲项目', es: 'Proyectos de Sencillo', vi: 'Dự án single', th: 'โปรเจกต์ซิงเกิล', uz: 'Singl loyihalari' }),
    color: '#059669',
  },
  {
    id: 'compilation',
    name: translate(locale, { ko: '컴필레이션', en: 'Compilation', zh: '合辑', es: 'Compilación', vi: 'Tuyển tập', th: 'รวมเพลง', uz: 'Kompilyatsiya' }),
    description: translate(locale, { ko: '아티스트 간 협업 및 컴필레이션 프로젝트', en: 'Collaboration & Compilation Projects', zh: '艺术家合作及合辑项目', es: 'Proyectos de Colaboración y Compilación', vi: 'Dự án hợp tác & tuyển tập', th: 'โปรเจกต์คอลแลบและรวมเพลง', uz: 'Hamkorlik va kompilyatsiya loyihalari' }),
    color: '#7c3aed',
  },
  {
    id: 'commercial',
    name: translate(locale, { ko: '상업음악', en: 'Commercial', zh: '商业音乐', es: 'Comercial', vi: 'Thương mại', th: 'เชิงพาณิชย์', uz: 'Tijoriy' }),
    description: translate(locale, { ko: 'CM송 및 상업적 목적의 음악', en: 'CM Songs & Commercial Music', zh: '广告歌曲及商业目的音乐', es: 'Música Comercial y Jingles', vi: 'Bài quảng cáo & nhạc thương mại', th: 'เพลงโฆษณาและเพลงเชิงพาณิชย์', uz: 'CM qo‘shiqlari va tijoriy musiqa' }),
    color: '#ea580c',
  },
];
