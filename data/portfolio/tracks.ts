import type { AudioTrack } from '../../types/data';
import type { Locale } from '../../lib/i18n';
import { translate } from './i18n';

const STUDIO_DESCRIPTION = {
  ko: '스튜디오 놀에서 레코딩, 믹싱한 트랙',
  en: 'Recorded and Mixed at Studio NOL',
  vi: 'Bản thu và mixing tại Studio NOL',
  th: 'บันทึกและมิกซ์ที่ Studio NOL',
  uz: 'Studio NOL’da yozilgan va miks qilingan trek',
};

export const buildAudioTracks = (locale: Locale): AudioTrack[] => {
  const description = translate(locale, STUDIO_DESCRIPTION);
  return [
    {
      id: 'track-1',
      title: 'Fever',
      artist: 'Jai',
      src: '/audio/jai-fever.mp3',
      albumArt: 'https://image.bugsm.co.kr/album/images/1000/373556/37355636.jpg',
      duration: '3:44',
      featured: true,
      description,
    },
    {
      id: 'track-2',
      title: '물결 (Wave)',
      artist: '김동산과 블루이웃',
      src: '/audio/wave.mp3',
      albumArt: 'https://image.bugsm.co.kr/album/images/500/366018/36601838.jpg',
      duration: '4:15',
      featured: true,
      description,
    },
    {
      id: 'track-3',
      title: '숨 (Breath)',
      artist: '류형수 (Vocal 김수린)',
      src: '/audio/sample3.mp3',
      albumArt: '/images/album3.jpg',
      duration: '3:58',
      featured: true,
      description,
    },
  ];
};
