import { type Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { ITEM_LIST_NAMES } from './shared';

export interface MusicRecordingInput {
  title: string;
  artist: string;
  image?: string;
  url?: string;
  datePublished?: string;
  genre?: string;
  duration?: string;
  /** 3–5 paragraph production notes (partial locale-map). When present, enables indexing. */
  productionNotes?: Partial<Record<Locale, string>>;
  /** Credit block: engineer, musicians, gear */
  credits?: {
    engineer?: string;
    musicians?: string[];
    gear?: string[];
  };
  /** Record label */
  label?: string;
  /** Track list with optional duration */
  trackList?: { no: number; title: string; duration?: string }[];
}

export const generateMusicRecordingSchema = (
  item: MusicRecordingInput,
  siteUrl: string,
  locale: Locale = 'ko'
) => {
  const config = getSiteConfig(locale);

  // Build workExample from trackList if available
  const workExample = item.trackList && item.trackList.length > 0
    ? item.trackList.map(track => ({
        '@type': 'MusicRecording' as const,
        name: track.title,
        duration: track.duration,
      }))
    : undefined;

  // Build performer from credits
  const performer = item.credits
    ? {
        '@type': 'MusicGroup' as const,
        name: item.artist,
        hasMember: item.credits.musicians
          ? item.credits.musicians.map(name => ({ '@type': 'Person' as const, name }))
          : undefined,
      }
    : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    ...(item.url && { '@id': `${item.url.startsWith('http') ? item.url : `${siteUrl}${item.url}`}#recording` }),
    name: item.title,
    byArtist: {
      '@type': 'MusicGroup',
      name: item.artist,
    },
    recordingOf: {
      '@type': 'MusicComposition',
      name: item.title,
    },
    producer: {
      '@type': 'Organization',
      name: config.name,
      url: siteUrl,
    },
    ...(item.image && { image: item.image }),
    ...(item.url && { url: item.url }),
    ...(item.url && {
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${item.url.startsWith('http') ? item.url : `${siteUrl}${item.url}`}#webpage`,
      },
    }),
    ...(item.datePublished && { datePublished: item.datePublished }),
    ...(item.genre && { genre: item.genre }),
    ...(item.duration && { duration: item.duration }),
    ...(item.label && { recordLabel: { '@type': 'Organization', name: item.label } }),
    ...(item.productionNotes?.[locale] && { description: item.productionNotes[locale] }),
    ...(item.credits && {
      contributor: item.credits.engineer
        ? { '@type': 'Organization', name: item.credits.engineer }
        : undefined,
    }),
    ...(item.credits?.gear && item.credits.gear.length > 0 && {
      instrument: item.credits.gear.map((name) => ({
        '@type': 'MusicalInstrument' as const,
        name,
      })),
    }),
    ...(workExample && { workExample }),
    ...(performer && { performer }),
  };
};

/**
 * ⚠️ 의도적으로 호출부가 없다. "완성된 생성기를 안 쓰고 있다"는 지적이 반복돼 여기 남긴다.
 *
 * VideoObject는 **그 영상이 해당 페이지에서 실제로 재생될 때만** 발행해야 한다
 * (Google 동영상 구조화 데이터 요건: 페이지의 주요 콘텐츠로 embed/재생 가능해야 함).
 * 2026-08 기준 사이트 현황:
 *   - /cover-video 는 커버영상 '패키지'를 파는 서비스 LP다. 영상 자산이 하나도 없다
 *     (iframe·mp4·유튜브 URL 전부 0건). 여기 붙이면 없는 영상을 주장하는 날조 마크업이 된다.
 *   - /portfolio 의 유튜브 링크 18건은 embed가 아니라 외부 '듣기' 아웃바운드 링크이고
 *     (프리렌더 iframe 0건), 대부분 아티스트·레이블 채널 소유라 우리가 마크업할 대상이 아니다.
 *
 * 배선 조건: 자체 제작 커버영상을 페이지에 embed하고 thumbnailUrl·uploadDate·duration을
 * 확보했을 때. 그전까지는 호출하지 말 것.
 */
export interface VideoInput {
  name: string;
  description: string;
  thumbnailUrl: string;
  contentUrl: string;
  uploadDate: string;
  duration?: string;
  embedUrl?: string;
}

export const generateVideoSchema = (video: VideoInput, locale: Locale = 'ko') => {
  const config = getSiteConfig(locale);
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.name,
    description: video.description,
    thumbnailUrl: video.thumbnailUrl,
    contentUrl: video.contentUrl,
    uploadDate: video.uploadDate,
    ...(video.embedUrl && { embedUrl: video.embedUrl }),
    ...(video.duration && { duration: video.duration }),
    publisher: {
      '@type': 'Organization',
      name: config.name,
      logo: {
        '@type': 'ImageObject',
        url: `${config.url}/logo512.png`,
      },
    },
  };
};


export interface ItemListInput {
  id: string;
  name: string;
  url: string;
  image?: string;
  description?: string;
}

export const generateItemListSchema = (
  items: ItemListInput[],
  siteUrl: string,
  locale: Locale = 'ko',
  listName?: string
) => {
  const resolvedListName = listName || ITEM_LIST_NAMES[locale];

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: resolvedListName,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: item.url.startsWith('http') ? item.url : `${siteUrl}${item.url}`,
      ...(item.image && { image: item.image.startsWith('http') ? item.image : `${siteUrl}${item.image}` }),
      ...(item.description && { description: item.description }),
    })),
  };
};

export interface AudioObjectInput {
  name: string;
  contentUrl: string;
  encodingFormat?: string;
  description?: string;
  artist?: string;
  genre?: string;
  duration?: string;
}

export const generateAudioObjectSchema = (
  tracks: AudioObjectInput[],
  siteUrl: string,
  locale: Locale = 'ko'
) => {
  const config = getSiteConfig(locale);

  return tracks.map((track) => ({
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    name: track.name,
    // 음원 파일은 MusicRecording 자신이 아니라 audio(AudioObject) 노드로 낸다.
    // 예전에는 url에 mp3 경로를, MusicRecording에 encodingFormat을 직접 붙였는데
    // encodingFormat은 MediaObject의 속성이라 MusicRecording에서는 무효였고,
    // url이 mp3를 가리켜 '녹음물' 엔티티와 '파일'이 한 노드로 뭉개졌다.
    // 이 트랙들은 우리 도메인(/audio/*.mp3)에서 실제로 재생되므로 마크업 근거가 있다
    // (재생 불가한 자산에 미디어 스키마를 붙이면 안 되는 이유는 위 VideoInput 주석 참고).
    audio: {
      '@type': 'AudioObject',
      name: track.name,
      contentUrl: track.contentUrl.startsWith('http') ? track.contentUrl : `${siteUrl}${track.contentUrl}`,
      encodingFormat: track.encodingFormat || 'audio/mpeg',
      ...(track.duration && { duration: track.duration }),
    },
    ...(track.description && { description: track.description }),
    ...(track.genre && { genre: track.genre }),
    ...(track.artist && {
      byArtist: {
        '@type': 'MusicGroup',
        name: track.artist,
      },
    }),
    recordingOf: {
      '@type': 'MusicComposition',
      name: track.name,
    },
    publisher: {
      '@type': 'Organization',
      name: config.name,
      url: siteUrl,
    },
    ...(track.duration && { duration: track.duration }),
  }));
};

export interface ServiceInput {
  name: string;
  description: string;
  url?: string;
}

export const generateServiceListSchema = (
  services: ServiceInput[],
  siteUrl: string,
  locale: Locale = 'ko'
) => {
  const config = getSiteConfig(locale);
  const organizationId = `${siteUrl}/#organization`;

  const SERVICE_LIST_NAMES: Record<Locale, string> = {
    ko: '서비스 목록', en: 'Service List', zh: '服务列表',
    es: 'Lista de Servicios', vi: 'Danh sách dịch vụ', th: 'รายการบริการ', uz: 'Xizmatlar ro\'yxati',
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: SERVICE_LIST_NAMES[locale],
    itemListElement: services.map((service, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Service',
        name: service.name,
        description: service.description,
        ...(service.url && { url: service.url.startsWith('http') ? service.url : `${siteUrl}${service.url}` }),
        provider: {
          '@type': 'Organization',
          '@id': organizationId,
          name: config.name,
        },
      },
    })),
  };
};
