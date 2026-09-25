/**
 * jsdom(기본 testEnvironment)의 AbortSignal에는 .timeout()이 없다(jsdom 20.0.3 확인,
 * .abort()만 존재). fetchBusyRanges 테스트가 AbortSignal.timeout 경로를 타는 gcal.ts를
 * 실행하므로 이 파일 전체를 node 환경으로 돈다(Task 6 toss.test.ts와 동일 관례).
 * @jest-environment node
 */
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { buildServiceAccountJwt } from './gcal';

describe('buildServiceAccountJwt', () => {
  it('RS256 서명이 검증되고 클레임이 올바르다', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.GOOGLE_SA_EMAIL = 'bot@project.iam.gserviceaccount.com';
    process.env.GOOGLE_SA_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

    const jwt = buildServiceAccountJwt(new Date('2026-09-01T00:00:00Z'));
    const [h, p, s] = jwt.split('.');
    const verify = createVerify('RSA-SHA256').update(`${h}.${p}`);
    expect(verify.verify(publicKey, Buffer.from(s, 'base64url'))).toBe(true);

    const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
    expect(claims.iss).toBe('bot@project.iam.gserviceaccount.com');
    expect(claims.scope).toBe('https://www.googleapis.com/auth/calendar');
    expect(claims.aud).toBe('https://oauth2.googleapis.com/token');
    expect(claims.exp - claims.iat).toBe(3600);
  });
});

describe('fetchBusyRanges', () => {
  const realFetch = global.fetch;
  const CAL_ID = 'cal-primary@group.calendar.google.com';

  beforeEach(() => {
    jest.resetModules();
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.GOOGLE_SA_EMAIL = 'bot@project.iam.gserviceaccount.com';
    process.env.GOOGLE_SA_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    process.env.BOOKING_GCAL_ID = CAL_ID;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  const tokenResponse = { ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) };

  it('구글이 200과 함께 calendars[id].errors를 담아 응답하면 throw한다(fail-open 방지)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { fetchBusyRanges } = require('./gcal') as typeof import('./gcal');
    const freeBusyResponse = {
      ok: true,
      json: async () => ({
        calendars: { [CAL_ID]: { errors: [{ domain: 'global', reason: 'notFound' }] } },
      }),
    };
    const mock = jest.fn()
      .mockResolvedValueOnce(tokenResponse)
      .mockResolvedValueOnce(freeBusyResponse);
    global.fetch = mock as unknown as typeof fetch;

    await expect(
      fetchBusyRanges(new Date('2026-09-01T00:00:00Z'), new Date('2026-09-02T00:00:00Z'), 'studio'),
    ).rejects.toThrow('freeBusy 캘린더 응답 오류');
    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock.mock.calls[0][0]).toBe('https://oauth2.googleapis.com/token');
    expect(mock.mock.calls[1][0]).toBe('https://www.googleapis.com/calendar/v3/freeBusy');
  });

  it("calendar='practice-room'이면 PRACTICE_ROOM_GCAL_ID로 조회한다(녹음실과 같은 기준)", async () => {
    const ROOMS_ID = 'rooms@group.calendar.google.com';
    process.env.PRACTICE_ROOM_GCAL_ID = ROOMS_ID;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { fetchBusyRanges } = require('./gcal') as typeof import('./gcal');
    const freeBusyResponse = {
      ok: true,
      json: async () => ({ calendars: { [ROOMS_ID]: { busy: [{ start: '2026-09-01T11:00:00Z', end: '2026-09-01T12:00:00Z' }] } } }),
    };
    const mock = jest.fn().mockResolvedValueOnce(tokenResponse).mockResolvedValueOnce(freeBusyResponse);
    global.fetch = mock as unknown as typeof fetch;
    try {
      const result = await fetchBusyRanges(new Date('2026-09-01T00:00:00Z'), new Date('2026-09-02T00:00:00Z'), 'practice-room');
      expect(result).toEqual([{ start: new Date('2026-09-01T11:00:00Z'), end: new Date('2026-09-01T12:00:00Z') }]);
      const body = JSON.parse((mock.mock.calls[1][1] as RequestInit).body as string);
      expect(body.items).toEqual([{ id: ROOMS_ID }]);
    } finally {
      delete process.env.PRACTICE_ROOM_GCAL_ID;
    }
  });

  it('busy 배열이 정상이면 BusyRange[]를 반환한다', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { fetchBusyRanges } = require('./gcal') as typeof import('./gcal');
    const freeBusyResponse = {
      ok: true,
      json: async () => ({
        calendars: {
          [CAL_ID]: { busy: [{ start: '2026-09-01T09:00:00Z', end: '2026-09-01T10:00:00Z' }] },
        },
      }),
    };
    const mock = jest.fn()
      .mockResolvedValueOnce(tokenResponse)
      .mockResolvedValueOnce(freeBusyResponse);
    global.fetch = mock as unknown as typeof fetch;

    const result = await fetchBusyRanges(new Date('2026-09-01T00:00:00Z'), new Date('2026-09-02T00:00:00Z'), 'studio');
    expect(result).toEqual([
      { start: new Date('2026-09-01T09:00:00Z'), end: new Date('2026-09-01T10:00:00Z') },
    ]);
    expect(mock).toHaveBeenCalledTimes(2);
  });
});

describe('calendarIdFor — 방별 캘린더', () => {
  const saved = { shared: process.env.PRACTICE_ROOM_GCAL_ID, r05: process.env.PRACTICE_ROOM_GCAL_ID_R05 };
  afterEach(() => {
    if (saved.shared === undefined) delete process.env.PRACTICE_ROOM_GCAL_ID; else process.env.PRACTICE_ROOM_GCAL_ID = saved.shared;
    if (saved.r05 === undefined) delete process.env.PRACTICE_ROOM_GCAL_ID_R05; else process.env.PRACTICE_ROOM_GCAL_ID_R05 = saved.r05;
  });

  it('방별 env가 있으면 그것, 없는 방은 공용 캘린더', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { calendarIdFor, isCalendarActive, roomCalendarEnvKey } = require('./gcal') as typeof import('./gcal');
    process.env.PRACTICE_ROOM_GCAL_ID = 'shared';
    process.env.PRACTICE_ROOM_GCAL_ID_R05 = 'own-r05';
    expect(roomCalendarEnvKey('r05')).toBe('PRACTICE_ROOM_GCAL_ID_R05');
    expect(calendarIdFor('practice-room', 'R05')).toBe('own-r05');
    expect(calendarIdFor('practice-room', 'R02')).toBe('shared');
    expect(calendarIdFor('practice-room')).toBe('shared');
    expect(isCalendarActive('practice-room', 'R02')).toBe(true);
  });

  it('공용도 방별도 없으면 비활성', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { calendarIdFor, isCalendarActive } = require('./gcal') as typeof import('./gcal');
    delete process.env.PRACTICE_ROOM_GCAL_ID; delete process.env.PRACTICE_ROOM_GCAL_ID_R05;
    expect(calendarIdFor('practice-room', 'R05')).toBeNull();
    expect(isCalendarActive('practice-room', 'R05')).toBe(false);
    expect(isCalendarActive('studio')).toBe(true);
  });
});
