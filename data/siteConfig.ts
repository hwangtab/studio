import type { SiteConfig, SEODefaults } from '../types/data';
import type { Locale } from '../lib/i18n';

// Translation helper
const t = (locale: Locale, dict: { ko: string; en: string; zh?: string; es?: string; vi?: string; th?: string; uz?: string }) => {
  return dict[locale] || dict['en'] || dict['ko'];
};

export const getSiteConfig = (locale: Locale): SiteConfig => {
  return {
    name: t(locale, { ko: '스튜디오 놀', en: 'Studio NOL', zh: 'Studio NOL', es: 'Studio NOL', vi: 'Studio NOL', th: 'Studio NOL', uz: 'Studio NOL' }),
    url: 'https://studionol.co.kr',
    logo: '/logo/logo.png',
    description: t(locale, {
      ko: '연신내 녹음실, 연습실, 믹싱, 마스터링, 음반 제작 스튜디오',
      en: 'Music recording, practice room, mixing, mastering, and production studio.',
      zh: '录音室、练习室、混音、母带处理、唱片制作工作室',
      es: 'Estudio de grabación, sala de práctica, mezcla, masterización y producción.',
      vi: 'Phòng thu, phòng tập, mixing, mastering và studio sản xuất âm nhạc.',
      th: 'สตูดิโอบันทึกเสียง ห้องซ้อม มิกซ์ มาสเตอริ่ง และโปรดักชันเพลง',
      uz: 'Yozuv studiyasi, mashg‘ulot xonasi, miks, mastering va musiqa prodakshn studiyasi.'
    }),
    contact: {
      phone: '02-764-3114',
      email: 'contact@kosmart.org',
      address: t(locale, {
        ko: '서울특별시 은평구 대조동 84-3 3층(동명여고 바로 옆)',
        en: '3rd Floor, 84-3 Daejo-dong, Eunpyeong-gu, Seoul',
        zh: '首尔特别市恩平区大枣洞 84-3 3层',
        es: '3er piso, 84-3 Daejo-dong, Eunpyeong-gu, Seúl',
        vi: 'Tầng 3, 84-3 Daejo-dong, Eunpyeong-gu, Seoul',
        th: 'ชั้น 3, 84-3 Daejo-dong, Eunpyeong-gu, Seoul',
        uz: 'Seul sh., Eunpyeong-gu, Daejo-dong 84-3, 3-qavat'
      }),
      kakaoUrl: 'https://open.kakao.com/me/nol',
      naverMapUrl: 'https://naver.me/5gFZhS3X',
    },
    vatNotice: t(locale, {
      ko: '* 모든 가격은 VAT 별도입니다.',
      en: '* All prices exclude VAT.',
      zh: '* 所有价格均不含增值税。',
      es: '* Todos los precios excluyen el IVA.',
      vi: '* Tất cả giá chưa bao gồm VAT.',
      th: '* ราคาทั้งหมดไม่รวม VAT',
      uz: '* Barcha narxlar VATsiz.'
    }),
  };
};

export const getSeoDefaults = (locale: Locale): SEODefaults => {
  return {
    title: t(locale, {
      ko: '스튜디오 놀 - 음악 제작 스튜디오',
      en: 'Studio NOL - Music Production Studio',
      zh: 'Studio NOL - 音乐制作工作室',
      es: 'Studio NOL - Estudio de Producción Musical',
      vi: 'Studio NOL - Studio sản xuất âm nhạc',
      th: 'Studio NOL - สตูดิโอผลิตเพลง',
      uz: 'Studio NOL - Musiqa ishlab chiqarish studiyasi'
    }),
    description: t(locale, {
      ko: '연신내역 도보 5분, 스튜디오 놀에서 녹음실·연습실·믹싱/마스터링 서비스를 한 번에 이용하세요.',
      en: '5-min walk from station. Experience recording, practice rooms, and mixing/mastering at Studio NOL.',
      zh: '步行5分钟即到。在 Studio NOL 一站式体验录音、练习、混音/母带服务。',
      es: 'A 5 min a pie de la estación. Experimenta grabación, salas de práctica y mezcla/masterización.',
      vi: 'Cách ga 5 phút đi bộ. Trải nghiệm thu âm, phòng tập và mixing/mastering tại Studio NOL.',
      th: 'เดิน 5 นาทีจากสถานี ใช้บริการบันทึกเสียง ห้องซ้อม และมิกซ์/มาสเตอริ่งที่ Studio NOL ได้ในที่เดียว',
      uz: 'Bekatdan 5 daqiqa piyoda. Studio NOL’da yozuv, mashg‘ulot xonasi va miks/mastering xizmatlarini bir joyda oling.'
    }),
    keywords: t(locale, {
      ko: '연신내 녹음실, 은평구 연습실, 스튜디오 놀, 서울 녹음실, 믹싱 마스터링 스튜디오, 음악 제작 스튜디오, 축가 녹음, 성우 녹음, 오디오북 녹음, 일반인 녹음실',
      en: 'Yeonsinnae recording studio, Eunpyeong practice room, Studio NOL, Seoul recording studio, mixing mastering studio, music production studio, wedding song recording, voice over recording, audiobook recording',
      zh: '延新内录音室, 恩平区练习室, Studio NOL, 首尔录音室, 混音母带工作室, 音乐制作工作室, 婚礼歌曲录制, 配音录制, 有声读物录制',
      es: 'estudio de grabación en Yeonsinnae, sala de práctica en Eunpyeong, Studio NOL, estudio de grabación en Seúl, estudio de mezcla y masterización, estudio de producción musical, grabación de canciones de boda, grabación de voz en off, grabación de audiolibros',
      vi: 'phòng thu Yeonsinnae, phòng tập Eunpyeong, Studio NOL, phòng thu Seoul, studio mixing mastering, studio sản xuất âm nhạc, thu âm nhạc cưới, thu âm voice over, thu âm sách nói',
      th: 'สตูดิโอบันทึกเสียง Yeonsinnae, ห้องซ้อม Eunpyeong, Studio NOL, สตูดิโอบันทึกเสียงในโซล, สตูดิโอมิกซ์มาสเตอริ่ง, สตูดิโอผลิตเพลง, อัดเพลงงานแต่ง, อัดเสียงพากย์, อัดเสียงอ่านหนังสือ',
      uz: 'Yeonsinnae yozuv studiyasi, Eunpyeong mashg‘ulot xonasi, Studio NOL, Seul yozuv studiyasi, miks mastering studiyasi, musiqa prodakshn studiyasi, to‘y qo‘shig‘i yozuvi, voice over yozuvi, audiokitob yozuvi'
    }),
  };
};
