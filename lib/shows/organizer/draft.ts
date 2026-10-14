// lib/shows/organizer/draft.ts
import { isFundingMediaUrl, FUNDING_MEDIA_URL_PREFIX } from '../../funding/mediaPath';
import { descriptionBlocks } from '../structured';
import type { ShowDefinition } from '../seed';

/**
 * 주최자 공연 초안 — `show_submissions.draft_json`의 형식. 이 파일이 저장 형식의 유일한 주인이다.
 * 소규모 공연 전제라 구역은 하나(전석)뿐이고 정원만 받는다.
 */
export interface ShowSubmissionDraft {
  title: string;
  subtitle: string;
  presenterName: string;
  description: string;
  posterUrl: string | null;
  ageRating: string;
  runningMinutes: number | null;
  venueName: string;
  venueAddress: string;
  scheduleNote: string;
  notices: string[];
  /** KST 벽시계 'YYYY-MM-DDTHH:mm' */
  showtimes: string[];
  capacity: number | null;
  ticketTypes: Array<{ name: string; price: number | null }>;
  performers: Array<{ name: string; bio: string; photoUrl: string | null }>;
}

export const MIN_LEAD_DAYS = 7;
export const MIN_TICKET_PRICE = 1000;
export const SHOW_DRAFT_LIMITS = {
  title: 60, subtitle: 80, presenterName: 40, description: 5000, ageRating: 20, venueName: 60, venueAddress: 120,
  scheduleNote: 80, notice: 120, notices: 8, showtimes: 10, ticketTypes: 3, ticketName: 20, performers: 12,
  performerName: 40, performerBio: 400, capacity: 2000, runningMinutes: 600, price: 1_000_000,
} as const;

export const emptyDraft = (): ShowSubmissionDraft => ({
  title: '', subtitle: '', presenterName: '', description: '', posterUrl: null, ageRating: '', runningMinutes: null,
  venueName: '', venueAddress: '', scheduleNote: '', notices: [], showtimes: [], capacity: null,
  ticketTypes: [{ name: '일반', price: null }], performers: [],
});

export const parseDraft = (json: string | null): ShowSubmissionDraft => {
  if (!json) return emptyDraft();
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return emptyDraft();
    return { ...emptyDraft(), ...(parsed as Partial<ShowSubmissionDraft>) };
  } catch {
    return emptyDraft();
  }
};

const KST_WALL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
export const kstWallToDate = (wall: string): Date | null => {
  const m = KST_WALL.exec(wall);
  if (!m) return null;
  const d = new Date(`${wall}:00+09:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length <= max ? v.trim() : null);
const intOrNull = (v: unknown, max: number): number | null | undefined =>
  v === null || v === '' || v === undefined ? null : (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max ? (v as number) : undefined);

/** 업로드 이미지는 이 주최자 자신의 것만 받는다(남의 공개 표지 끼워 넣기 방지 — creatorValidation.ts와 같은 규칙). */
// isOwnFundingMedia(lib/funding/mediaAccess.ts)와 같은 판정 — 그 모듈은 db/client를 물어 순수 모듈에 들이지 않는다.
const isOwnMedia = (filename: string, creatorId: string): boolean => creatorId !== '' && filename.startsWith(`${creatorId}-`);

const ownImage = (v: unknown, creatorId: string): string | null | undefined => {
  if (v === null || v === '' || v === undefined) return null;
  if (typeof v !== 'string' || !isFundingMediaUrl(v)) return undefined;
  const filename = v.slice(FUNDING_MEDIA_URL_PREFIX.length).split('?')[0];
  return isOwnMedia(filename, creatorId) ? v : undefined;
};

export const normalizeDraftInput = (
  input: unknown,
  creatorId: string,
): { ok: true; draft: ShowSubmissionDraft } | { ok: false; message: string } => {
  const fail = (message: string) => ({ ok: false as const, message });
  if (!input || typeof input !== 'object') return fail('요청 형식이 올바르지 않아요.');
  const i = input as Record<string, unknown>;
  const L = SHOW_DRAFT_LIMITS;
  const title = str(i.title, L.title);
  const subtitle = str(i.subtitle ?? '', L.subtitle);
  const presenterName = str(i.presenterName, L.presenterName);
  const description = str(i.description, L.description);
  const ageRating = str(i.ageRating, L.ageRating);
  const venueName = str(i.venueName, L.venueName);
  const venueAddress = str(i.venueAddress, L.venueAddress);
  const scheduleNote = str(i.scheduleNote ?? '', L.scheduleNote);
  if ([title, subtitle, presenterName, description, ageRating, venueName, venueAddress, scheduleNote].some((v) => v === null)) {
    return fail('글자 수가 너무 많은 칸이 있어요.');
  }
  const posterUrl = ownImage(i.posterUrl, creatorId);
  if (posterUrl === undefined) return fail('포스터는 이 화면에서 올린 이미지만 쓸 수 있어요.');
  const runningMinutes = intOrNull(i.runningMinutes, L.runningMinutes);
  const capacity = intOrNull(i.capacity, L.capacity);
  if (runningMinutes === undefined || capacity === undefined) return fail('숫자 칸을 확인해 주세요.');

  const notices = Array.isArray(i.notices) ? i.notices.map((n) => str(n, L.notice)) : [];
  if (notices.length > L.notices || notices.some((n) => n === null)) return fail('안내 목록을 확인해 주세요.');
  const showtimes = Array.isArray(i.showtimes) ? i.showtimes : [];
  if (showtimes.length > L.showtimes || showtimes.some((s) => typeof s !== 'string' || !kstWallToDate(s))) return fail('회차 일시를 확인해 주세요.');

  const ticketTypesIn = Array.isArray(i.ticketTypes) ? i.ticketTypes : [];
  if (ticketTypesIn.length > L.ticketTypes) return fail(`티켓 종류는 ${L.ticketTypes}개까지예요.`);
  const ticketTypes: ShowSubmissionDraft['ticketTypes'] = [];
  for (const t of ticketTypesIn) {
    const name = str((t as Record<string, unknown>)?.name, L.ticketName);
    const price = intOrNull((t as Record<string, unknown>)?.price, L.price);
    if (name === null || price === undefined) return fail('티켓 종류를 확인해 주세요.');
    ticketTypes.push({ name, price });
  }

  const performersIn = Array.isArray(i.performers) ? i.performers : [];
  if (performersIn.length > L.performers) return fail(`출연진은 ${L.performers}명까지예요.`);
  const performers: ShowSubmissionDraft['performers'] = [];
  for (const p of performersIn) {
    const rec = (p ?? {}) as Record<string, unknown>;
    const name = str(rec.name, L.performerName);
    const bio = str(rec.bio ?? '', L.performerBio);
    const photoUrl = ownImage(rec.photoUrl, creatorId);
    if (name === null || bio === null) return fail('출연진 칸을 확인해 주세요.');
    if (photoUrl === undefined) return fail('출연진 사진은 이 화면에서 올린 이미지만 쓸 수 있어요.');
    performers.push({ name, bio, photoUrl });
  }

  return {
    ok: true,
    draft: {
      title: title!, subtitle: subtitle!, presenterName: presenterName!, description: description!, posterUrl,
      ageRating: ageRating!, runningMinutes, venueName: venueName!, venueAddress: venueAddress!, scheduleNote: scheduleNote!,
      notices: (notices as string[]).filter(Boolean), showtimes: showtimes as string[], capacity, ticketTypes, performers,
    },
  };
};

const DAY_MS = 86_400_000;

/** 제출·승인 때 보는 필수값. 문구는 주최자 화면에 그대로 나간다. */
export const findSubmitProblems = (d: ShowSubmissionDraft, now: Date): string[] => {
  const p: string[] = [];
  if (!d.title) p.push('공연 제목을 적어 주세요.');
  if (d.title.includes(' — ')) p.push('제목에 " — "를 넣지 말고 부제 칸을 써 주세요.');
  if (!d.presenterName) p.push('주최 이름을 적어 주세요.');
  if (!d.description) p.push('공연 소개를 적어 주세요.');
  else if (descriptionBlocks(d.description)[0]?.type !== 'p') p.push('소개는 일반 문단으로 시작해 주세요(첫 줄이 ## 이나 > 이면 안 돼요).');
  if (!d.posterUrl) p.push('포스터를 올려 주세요.');
  if (!d.ageRating) p.push('관람 등급을 적어 주세요.');
  if (!d.runningMinutes) p.push('공연 시간(분)을 적어 주세요.');
  if (!d.venueName || !d.venueAddress) p.push('공연장 이름과 주소를 적어 주세요.');
  if (d.showtimes.length === 0) p.push('회차를 하나 이상 넣어 주세요.');
  const times = d.showtimes.map(kstWallToDate);
  const first = Math.min(...times.map((t) => t?.getTime() ?? 0));
  if (d.showtimes.length > 0 && first < now.getTime() + MIN_LEAD_DAYS * DAY_MS) p.push(`첫 회차는 오늘로부터 ${MIN_LEAD_DAYS}일 뒤부터 잡을 수 있어요(심사와 판매 기간).`);
  if (new Set(d.showtimes).size !== d.showtimes.length) p.push('같은 일시의 회차가 두 번 들어 있어요.');
  if (!d.capacity) p.push('정원을 적어 주세요.');
  if (d.ticketTypes.length === 0) p.push('티켓 종류를 하나 이상 넣어 주세요.');
  if (d.ticketTypes.some((t) => !t.name)) p.push('티켓 종류 이름을 적어 주세요.');
  if (new Set(d.ticketTypes.map((t) => t.name)).size !== d.ticketTypes.length) p.push('티켓 종류 이름이 겹쳐요.');
  if (d.ticketTypes.some((t) => t.price === null || t.price < MIN_TICKET_PRICE)) p.push(`티켓 가격은 ${MIN_TICKET_PRICE.toLocaleString('ko-KR')}원 이상이어야 해요.`);
  if (d.performers.length === 0) p.push('출연진을 한 명(팀) 이상 넣어 주세요.');
  if (d.performers.some((x) => !x.name)) p.push('출연진 이름을 적어 주세요.');
  if (new Set(d.performers.map((x) => x.name)).size !== d.performers.length) p.push('출연진 이름이 겹쳐요.');
  return p;
};

/** 승인 때만 부른다 — findSubmitProblems가 비어 있다는 전제(널 칸이 없다). */
export const buildShowDefinition = (d: ShowSubmissionDraft, slug: string): ShowDefinition => ({
  slug,
  title: d.title,
  subtitle: d.subtitle || null,
  presenterName: d.presenterName,
  performers: d.performers.map((x) => ({ name: x.name, bio: x.bio || undefined, photo: x.photoUrl ?? undefined })),
  ageRating: d.ageRating,
  runningMinutes: d.runningMinutes!,
  venueName: d.venueName,
  venueAddress: d.venueAddress,
  description: d.description,
  coverImage: d.posterUrl,
  ogImage: null,
  scheduleNote: d.scheduleNote || null,
  notices: d.notices,
  zones: [{ code: 'GA', label: '전석', capacity: d.capacity! }],
  showtimes: d.showtimes.map((s) => ({ startsAt: kstWallToDate(s)! })),
  ticketTypes: d.ticketTypes.map((t) => ({ zoneCode: 'GA', name: t.name, price: t.price!, quota: null, compQuota: 0 })),
});

/** 승인 뒤 저장 — 판매 조건(일시·정원·가격·장소·시간·등급)은 승인본 값을 유지한다. */
export const mergeApprovedEdit = (approved: ShowSubmissionDraft, incoming: ShowSubmissionDraft): ShowSubmissionDraft => ({
  ...incoming,
  ageRating: approved.ageRating,
  runningMinutes: approved.runningMinutes,
  venueName: approved.venueName,
  venueAddress: approved.venueAddress,
  showtimes: approved.showtimes,
  capacity: approved.capacity,
  ticketTypes: approved.ticketTypes,
});
