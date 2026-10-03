/**
 * `shows`의 구조화 JSON 칸(0047)을 읽고 쓰는 순수 모듈. DB·fs를 물지 않아 클라이언트 컴포넌트도
 * 가져다 쓴다. 저장 형식은 한 곳(여기)만 안다 — 시드(lib/shows/seed.ts)가 `serialize*`로 쓰고
 * 조회(lib/shows/queries.ts)가 `parse*`로 읽는다.
 *
 * 잘못된 JSON은 던지지 않고 빈 값으로 읽는다 — 공연 상세가 출연진 한 칸 때문에 500이 되면 안 된다.
 */

export interface ShowPerformer {
  name: string;
  bio?: string | null;
  /** 원형 프로필 사진 경로(/images/shows/…). 없으면 글만 보인다. */
  photo?: string | null;
  /** 있으면 출연진 카드 전체가 이 링크(새 탭)가 된다. */
  sns?: string | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const optStr = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

export function parsePerformersJson(text: string | null | undefined): ShowPerformer[] {
  if (!text) return [];
  try {
    const raw: unknown = JSON.parse(text);
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item): ShowPerformer[] => {
      if (!isRecord(item) || typeof item.name !== 'string' || item.name.trim() === '') return [];
      return [{ name: item.name, bio: optStr(item.bio), photo: optStr(item.photo), sns: optStr(item.sns) }];
    });
  } catch {
    return [];
  }
}

export function serializePerformers(performers: ShowPerformer[]): string {
  return JSON.stringify(
    performers.map((p) => ({
      name: p.name,
      ...(p.bio ? { bio: p.bio } : {}),
      ...(p.photo ? { photo: p.photo } : {}),
      ...(p.sns ? { sns: p.sns } : {}),
    })),
  );
}

/** 이름만 쉼표로 이은 한 줄 — `shows.performers`(NOT NULL)에 넣는 값. 메일·관리자·검색이 읽는다. */
export const performerNames = (performers: ShowPerformer[]): string => performers.map((p) => p.name).join(', ');

export function parseNoticesJson(text: string | null | undefined): string[] {
  if (!text) return [];
  try {
    const raw: unknown = JSON.parse(text);
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];
  } catch {
    return [];
  }
}

export const serializeNotices = (notices: string[]): string => JSON.stringify(notices);

/** 본문 문단 — 빈 줄로 가른다. 긴 소개글을 한 칸에 두고 화면이 문단으로 그린다. */
export const descriptionParagraphs = (description: string): string[] =>
  description.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

/** 지도 링크 — 등록된 값이 없으면 장소명+주소로 네이버 지도 검색. */
export const showMapUrl = (show: { mapUrl: string | null; venueName: string; venueAddress: string }): string =>
  show.mapUrl ?? `https://map.naver.com/p/search/${encodeURIComponent(`${show.venueName} ${show.venueAddress}`)}`;
