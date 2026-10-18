import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CAL_API = 'https://www.googleapis.com/calendar/v3';
const SCOPE = 'https://www.googleapis.com/auth/calendar';
const REQUEST_TIMEOUT_MS = 8000;

const b64url = (input: string | Buffer): string => Buffer.from(input).toString('base64url');

export const buildServiceAccountJwt = (now: Date): string => {
  const email = process.env.GOOGLE_SA_EMAIL;
  const key = process.env.GOOGLE_SA_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY가 설정되지 않았습니다.');
  const iat = Math.floor(now.getTime() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }));
  const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(key);
  return `${header}.${payload}.${b64url(signature)}`;
};

/** 인스턴스 수명 동안의 토큰 캐시 — 만료 60초 전 갱신. */
let cachedToken: { value: string; expiresAt: number } | null = null;

const getAccessToken = async (): Promise<string> => {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.value;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: buildServiceAccountJwt(new Date(now)),
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`구글 토큰 발급 실패: ${res.status}`);
  const json = await res.json();
  cachedToken = { value: json.access_token, expiresAt: now + json.expires_in * 1000 };
  return cachedToken.value;
};

/**
 * 자원마다 캘린더 하나. 녹음실은 BOOKING_GCAL_ID, 연습실은 PRACTICE_ROOM_GCAL_ID.
 * 두 자원은 **같은 기준**으로 돈다 — 자기 캘린더의 바쁨을 읽어 슬롯을 막고(slots.ts),
 * 확정 예약을 자기 캘린더에 쓴다(confirm.ts). 그래서 캘린더에 손으로 넣은 일정도
 * 웹 예약을 막는다. 두 캘린더는 반드시 달라야 한다 — 같으면 녹음 슬롯 조회가 연습실
 * 예약을 바쁨으로 읽어 녹음을 막고 그 반대도 마찬가지다.
 * 연습실 캘린더는 env가 없으면 읽지도 쓰지도 않는다(운영은 넣어 둔 상태).
 */
export type BookingCalendar = 'studio' | 'practice-room';

/** 방별 캘린더 env 키. `R05` → `PRACTICE_ROOM_GCAL_ID_R05`. */
export const roomCalendarEnvKey = (room: string): string =>
  `PRACTICE_ROOM_GCAL_ID_${room.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;

/**
 * 어느 캘린더 id인가. 연습실은 **방별 캘린더가 있으면 그것**, 없으면 공용
 * PRACTICE_ROOM_GCAL_ID. 방이 하나뿐이면 공용 하나로 충분하다. 방이 둘 이상인데 공용만
 * 있으면 공용 캘린더의 일정은 **그 방 전부**에 걸린다(방을 구분할 정보가 없다) — 방마다
 * 따로 막으려면 방을 늘리기 **전에** 그 방의 env를 추가한다. 방별 캘린더가 있는 방은
 * 공용을 보지 않는다(자원 하나 = 캘린더 하나). 방별 env를 나중에 추가해도 이전에 공용에
 * 만든 이벤트는 삭제 시 후보 캘린더를 차례로 찾아 지운다(deleteBookingEvent).
 */
export const calendarIdFor = (which: BookingCalendar, room?: string | null): string | null => {
  if (which === 'practice-room') {
    const own = room ? process.env[roomCalendarEnvKey(room)] : undefined;
    return own || process.env.PRACTICE_ROOM_GCAL_ID || null;
  }
  return process.env.BOOKING_GCAL_ID || null;
};

/** 예약 행의 serviceType이 어느 캘린더에 속하는가. 호출처마다 삼항을 되풀이하지 않는다. */
export const calendarForService = (serviceType: string): BookingCalendar =>
  serviceType === 'practice-room' ? 'practice-room' : 'studio';

/**
 * 이 캘린더를 읽고 써야 하는가. 녹음실은 항상(env가 없으면 호출이 throw해 fail-closed).
 * 연습실은 env가 있을 때만 — 읽기(slots·생성 가드)와 쓰기(confirm)가 같은 조건이어야
 * 한쪽만 동작하는 어긋남이 없다.
 */
export const isCalendarActive = (which: BookingCalendar, room?: string | null): boolean =>
  which === 'studio' || calendarIdFor('practice-room', room) !== null;

const calendarId = (which: BookingCalendar, room?: string | null): string => {
  const id = calendarIdFor(which, room);
  if (!id) throw new Error(`${which === 'practice-room' ? 'PRACTICE_ROOM_GCAL_ID' : 'BOOKING_GCAL_ID'}가 설정되지 않았습니다.`);
  return id;
};

export interface BusyRange { start: Date; end: Date }

/** 실패는 throw — 호출부는 해당 시간대를 예약 불가로 처리한다(fail-closed, 스펙 §6). */
export const fetchBusyRanges = async (
  timeMin: Date, timeMax: Date, calendar: BookingCalendar, room?: string | null,
): Promise<BusyRange[]> => {
  const id = calendarId(calendar, room);
  const token = await getAccessToken();
  const res = await fetch(`${CAL_API}/freeBusy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), items: [{ id }] }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`freeBusy 조회 실패: ${res.status}`);
  const json = await res.json();
  const entry = json.calendars?.[id];
  if (!entry || (Array.isArray(entry.errors) && entry.errors.length > 0) || !Array.isArray(entry.busy)) {
    throw new Error(`freeBusy 캘린더 응답 오류: ${JSON.stringify(entry?.errors ?? 'no entry')}`);
  }
  const busy: Array<{ start: string; end: string }> = entry.busy;
  return busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
};

/** 캘린더 일정 한 건(읽기용) — 사이트가 만들지 않은 일정도 포함한다. 종일 일정은 `allDay`(시각 없음). */
export interface CalendarEventInfo {
  id: string;
  summary: string;
  description: string;
  start: Date;
  end: Date;
  allDay: boolean;
  /** "바쁨 아님"으로 표시된 일정 — freeBusy는 이런 일정을 바쁨으로 읽지 않는다(월 입주 일정이 쓴다). */
  transparent: boolean;
  /** 반복 일정의 한 회차 — 회차마다 예약을 만들면 시리즈가 조각나므로 자동 등록하지 않는다. */
  recurring: boolean;
}

interface RawCalendarEvent {
  id?: string; status?: string; summary?: string; description?: string; transparency?: string; recurringEventId?: string;
  start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string };
}

const toEventInfo = (e: RawCalendarEvent): CalendarEventInfo | null => {
  if (!e.id || e.status === 'cancelled') return null;
  const allDay = !e.start?.dateTime;
  const start = new Date(e.start?.dateTime ?? (e.start?.date ? `${e.start.date}T00:00:00+09:00` : ''));
  const end = new Date(e.end?.dateTime ?? (e.end?.date ? `${e.end.date}T00:00:00+09:00` : ''));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { id: e.id, summary: e.summary ?? '', description: e.description ?? '', start, end, allDay, transparent: e.transparency === 'transparent', recurring: !!e.recurringEventId };
};

/**
 * [timeMin, timeMax) 안의 일정 목록(시작순, 반복 일정은 펼쳐서, 취소된 일정 제외). **읽기 전용** — 사이트가 만든 일정과 손으로 넣은 일정을 다 돌려준다.
 * 실패는 throw. 최대 250건(예약 캘린더라 충분하다).
 */
export const listCalendarEvents = async (
  timeMin: Date, timeMax: Date, calendar: BookingCalendar, room?: string | null,
): Promise<CalendarEventInfo[]> => {
  const id = calendarId(calendar, room);
  const token = await getAccessToken();
  const items: RawCalendarEvent[] = [];
  // 250건을 넘으면 다음 쪽을 이어 읽는다(최대 4쪽 = 1,000건) — 한 쪽만 읽으면 뒤쪽 일정이 목록·충돌 검사에서 조용히 빠진다.
  let pageToken: string | undefined;
  for (let page = 0; page < 4; page += 1) {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250',
      ...(pageToken ? { pageToken } : {}),
    });
    const res = await fetch(`${CAL_API}/calendars/${encodeURIComponent(id)}/events?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`캘린더 일정 목록 조회 실패: ${res.status}`);
    const json = (await res.json()) as { items?: RawCalendarEvent[]; nextPageToken?: string };
    items.push(...(json.items ?? []));
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }
  return items.map(toEventInfo).filter((e): e is CalendarEventInfo => e !== null);
};

/** 일정 한 건. 없거나(404·410) 취소된 일정이면 null. 그 밖의 실패는 throw. */
export const getCalendarEvent = async (
  eventId: string, calendar: BookingCalendar, room?: string | null,
): Promise<CalendarEventInfo | null> => {
  const id = calendarId(calendar, room);
  const token = await getAccessToken();
  const res = await fetch(`${CAL_API}/calendars/${encodeURIComponent(id)}/events/${encodeURIComponent(eventId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`캘린더 일정 조회 실패: ${res.status}`);
  return toEventInfo((await res.json()) as RawCalendarEvent);
};

export const createBookingEvent = async (input: {
  summary: string; description: string; start: Date; end: Date; calendar: BookingCalendar; room?: string | null;
}): Promise<string> => {
  const id = calendarId(input.calendar, input.room);
  const token = await getAccessToken();
  const res = await fetch(`${CAL_API}/calendars/${encodeURIComponent(id)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.start.toISOString() },
      end: { dateTime: input.end.toISOString() },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`캘린더 이벤트 생성 실패: ${res.status}`);
  return (await res.json()).id as string;
};

/**
 * 이벤트를 만들었을 수 있는 캘린더 id들 — 지금 해석되는 것 먼저, 그다음 같은 자원의 나머지.
 * bookings는 이벤트 id만 저장하고 캘린더 id는 저장하지 않으므로, 확정 뒤 env가 바뀌면
 * (방별 캘린더 추가 등) 옛 이벤트가 어디 있는지 재계산으로는 모른다. 삭제는 후보를 차례로
 * 시도해 404가 아닌 곳에서 지운다.
 */
const candidateCalendarIds = (which: BookingCalendar, room?: string | null): string[] => {
  const ids = [calendarIdFor(which, room)];
  if (which === 'practice-room') ids.push(process.env.PRACTICE_ROOM_GCAL_ID || null);
  return [...new Set(ids.filter((id): id is string => !!id))];
};

export const deleteBookingEvent = async (
  eventId: string, calendar: BookingCalendar, room?: string | null,
): Promise<void> => {
  const ids = candidateCalendarIds(calendar, room);
  if (ids.length === 0) calendarId(calendar, room); // throw — env 없음
  const token = await getAccessToken();
  for (const id of ids) {
    const res = await fetch(
      `${CAL_API}/calendars/${encodeURIComponent(id)}/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
    );
    if (res.ok || res.status === 410) return;
    if (res.status !== 404) throw new Error(`캘린더 이벤트 삭제 실패: ${res.status}`);
  }
  // 모든 후보에서 404 — 이미 지워졌거나 처음부터 없던 이벤트. 멱등하게 성공으로 본다.
};

/**
 * 이벤트 제목만 바꾼다 — 계좌 입금 대기 예약이 확정될 때 `[입금 대기]` 일정을 `[예약]`으로 바꾼다
 * (lib/booking/bankDeposit.ts). 새로 만들고 옛것을 지우는 방식은 삭제가 실패하면 옛 일정 id가 갈 곳이 없어져
 * 남은 일정이 웹 예약을 계속 막고, 그 실패를 확정 예약의 오류로 적으면 관리자 "재등록"이 유효한 일정을 지운다.
 * 후보 캘린더를 차례로 시도한다(삭제와 같은 이유). 실패는 throw.
 */
export const renameBookingEvent = async (
  eventId: string, calendar: BookingCalendar, room: string | null | undefined, summary: string, description?: string,
): Promise<void> => {
  const ids = candidateCalendarIds(calendar, room);
  if (ids.length === 0) calendarId(calendar, room); // throw — env 없음
  const token = await getAccessToken();
  for (const id of ids) {
    const res = await fetch(
      `${CAL_API}/calendars/${encodeURIComponent(id)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(description === undefined ? { summary } : { summary, description }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (res.ok) return;
    if (res.status !== 404) throw new Error(`캘린더 이벤트 제목 변경 실패: ${res.status}`);
  }
  throw new Error('캘린더 이벤트 제목 변경 실패: 이벤트를 찾지 못했습니다(404)');
};

/**
 * 이벤트의 시작·종료만 바꾼다 — 관리자 "일정 변경"(lib/booking/reschedule.ts). 삭제 후 재생성이 아니라 PATCH라
 * 중간에 실패해도 옛 일정이 남아 있다. 후보 캘린더를 차례로 시도한다(rename과 같은 이유). 실패는 throw.
 */
export const rescheduleBookingEvent = async (
  eventId: string, calendar: BookingCalendar, room: string | null | undefined, start: Date, end: Date,
): Promise<void> => {
  const ids = candidateCalendarIds(calendar, room);
  if (ids.length === 0) calendarId(calendar, room); // throw — env 없음
  const token = await getAccessToken();
  for (const id of ids) {
    const res = await fetch(
      `${CAL_API}/calendars/${encodeURIComponent(id)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() } }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (res.ok) return;
    if (res.status !== 404) throw new Error(`캘린더 이벤트 시간 변경 실패: ${res.status}`);
  }
  throw new Error('캘린더 이벤트 시간 변경 실패: 이벤트를 찾지 못했습니다(404)');
};

/**
 * 캘린더 id를 **직접 받는** 일정 쓰기 — 예약 캘린더(env로 해석되는 자원 캘린더)가 아닌 별도 캘린더(월 입주 관리,
 * lib/tenancy/calendar.ts)가 쓴다. 예약 캘린더와 달리 이 일정들은 웹 예약 가능 시간에 영향을 주지 않는다.
 */
export interface RawEventBody {
  summary: string;
  description?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  transparency?: 'transparent' | 'opaque';
}

export const createEventOnCalendar = async (calendarIdValue: string, body: RawEventBody): Promise<string> => {
  const token = await getAccessToken();
  const res = await fetch(`${CAL_API}/calendars/${encodeURIComponent(calendarIdValue)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`캘린더 일정 생성 실패: ${res.status}`);
  return (await res.json()).id as string;
};

/** 일정을 고친다. 일정이 없으면(404·410) false — 호출부가 새로 만든다. 그 밖의 실패는 throw. */
export const patchEventOnCalendar = async (calendarIdValue: string, eventId: string, body: RawEventBody): Promise<boolean> => {
  const token = await getAccessToken();
  const res = await fetch(`${CAL_API}/calendars/${encodeURIComponent(calendarIdValue)}/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (res.status === 404 || res.status === 410) return false;
  if (!res.ok) throw new Error(`캘린더 일정 수정 실패: ${res.status}`);
  const json = (await res.json()) as { status?: string };
  return json.status !== 'cancelled';
};

/** 일정을 지운다. 이미 없으면 성공으로 본다. */
export const deleteEventOnCalendar = async (calendarIdValue: string, eventId: string): Promise<void> => {
  const token = await getAccessToken();
  const res = await fetch(`${CAL_API}/calendars/${encodeURIComponent(calendarIdValue)}/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (res.ok || res.status === 404 || res.status === 410) return;
  throw new Error(`캘린더 일정 삭제 실패: ${res.status}`);
};
