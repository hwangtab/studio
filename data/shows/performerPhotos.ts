/**
 * 공연 출연자 사진 — `shows.performers`의 이름(lib/shows/content.ts parsePerformers의 name)을 키로 한다.
 * 사진은 DB 칸이 없어 코드에 둔다(OG 이미지 상수와 같은 이유). 이름이 안 맞으면 사진 없이 글만 나온다.
 * 이 파일은 클라이언트 번들에 들어가므로 공연 정의(data/shows/<slug>.ts, 긴 소개글 포함)와 분리해 둔다.
 *
 * 파일명에 날짜를 박는다 — /images/**는 immutable 1년 캐시라 같은 이름으로 갈아 끼우면 옛 그림이 남는다.
 */
export const SHOW_PERFORMER_PHOTOS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'bakkeoji-anneun-maeumdeul': {
    '자이(Jai)': '/images/shows/bakkeoji-jai-20261003.webp',
    '호와호(Howaho)': '/images/shows/bakkeoji-howaho-20261003.webp',
    '솔가(Solga)': '/images/shows/bakkeoji-solga-20261003.webp',
  },
};
