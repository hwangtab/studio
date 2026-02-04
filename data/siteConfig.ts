import type { SiteConfig, SEODefaults } from '../types/data';
import type { Locale } from '../lib/i18n';

// Translation helper
const t = (locale: Locale, dict: { ko: string; en: string; zh?: string; es?: string }) => {
  return dict[locale] || dict['en'] || dict['ko'];
};

export const getSiteConfig = (locale: Locale): SiteConfig => {
  return {
    name: t(locale, { ko: '스튜디오 놀', en: 'Studio NOL', zh: 'Studio NOL', es: 'Studio NOL' }),
    url: 'https://studionol.co.kr',
    description: t(locale, { 
      ko: '연신내 녹음실, 연습실, 믹싱, 마스터링, 음반 제작 스튜디오', 
      en: 'Music recording, practice room, mixing, mastering, and production studio.',
      zh: '录音室、练习室、混音、母带处理、唱片制作工作室',
      es: 'Estudio de grabación, sala de práctica, mezcla, masterización y producción.'
    }),
    contact: {
      phone: '02-764-3114',
      email: 'contact@kosmart.org',
      address: t(locale, { 
        ko: '서울특별시 은평구 대조동 84-3 3층(동명여고 바로 옆)', 
        en: '3rd Floor, 84-3 Daejo-dong, Eunpyeong-gu, Seoul',
        zh: '首尔特别市恩平区大枣洞 84-3 3层',
        es: '3er piso, 84-3 Daejo-dong, Eunpyeong-gu, Seúl'
      }),
      kakaoUrl: 'https://open.kakao.com/me/nol',
      naverMapUrl: 'https://naver.me/5gFZhS3X',
    },
    vatNotice: t(locale, { 
      ko: '* 모든 가격은 VAT 별도입니다.', 
      en: '* All prices exclude VAT.',
      zh: '* 所有价格均不含增值税。',
      es: '* Todos los precios excluyen el IVA.'
    }),
  };
};

export const getSeoDefaults = (locale: Locale): SEODefaults => {
  return {
    title: t(locale, { 
      ko: '스튜디오 놀 - 음악 제작 스튜디오', 
      en: 'Studio NOL - Music Production Studio',
      zh: 'Studio NOL - 音乐制作工作室',
      es: 'Studio NOL - Estudio de Producción Musical'
    }),
    description: t(locale, { 
      ko: '연신내역 도보 5분, 스튜디오 놀에서 녹음실·연습실·믹싱/마스터링 서비스를 한 번에 이용하세요.', 
      en: '5-min walk from station. Experience recording, practice rooms, and mixing/mastering at Studio NOL.',
      zh: '步行5分钟即到。在 Studio NOL 一站式体验录音、练习、混音/母带服务。',
      es: 'A 5 min a pie de la estación. Experimenta grabación, salas de práctica y mezcla/masterización.'
    }),
    keywords: '연신내 녹음실, 은평구 연습실, 스튜디오 놀, 서울 녹음실, 믹싱 마스터링 스튜디오, 음악 제작 스튜디오',
  };
};