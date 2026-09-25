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
 * 어느 캘린더에 쓰는가. 기본은 녹음실(BOOKING_GCAL_ID). 연습실은 **다른 캘린더**여야 한다 —
 * 같은 캘린더에 올리면 녹음 슬롯 조회(freeBusy)가 연습실 예약을 바쁨으로 읽어 녹음을 막는다.
 * 연습실 캘린더(PRACTICE_ROOM_GCAL_ID)는 선택이다: 없으면 연습실 예약은 캘린더에 안 올리고
 * 관리자 화면·메일로만 알린다(confirm.ts).
 */
export type BookingCalendar = 'studio' | 'practice-room';

export const calendarIdFor = (which: BookingCalendar): string | null => {
  if (which === 'practice-room') return process.env.PRACTICE_ROOM_GCAL_ID || null;
  return process.env.BOOKING_GCAL_ID || null;
};

const calendarId = (which: BookingCalendar = 'studio'): string => {
  const id = calendarIdFor(which);
  if (!id) throw new Error(`${which === 'practice-room' ? 'PRACTICE_ROOM_GCAL_ID' : 'BOOKING_GCAL_ID'}가 설정되지 않았습니다.`);
  return id;
};

export interface BusyRange { start: Date; end: Date }

/** 실패는 throw — 호출부는 해당 시간대를 예약 불가로 처리한다(fail-closed, 스펙 §6). */
export const fetchBusyRanges = async (timeMin: Date, timeMax: Date): Promise<BusyRange[]> => {
  const id = calendarId();
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

export const createBookingEvent = async (input: {
  summary: string; description: string; start: Date; end: Date; calendar?: BookingCalendar;
}): Promise<string> => {
  const id = calendarId(input.calendar ?? 'studio');
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

export const deleteBookingEvent = async (eventId: string, calendar: BookingCalendar = 'studio'): Promise<void> => {
  const id = calendarId(calendar);
  const token = await getAccessToken();
  const res = await fetch(
    `${CAL_API}/calendars/${encodeURIComponent(id)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`캘린더 이벤트 삭제 실패: ${res.status}`);
};
