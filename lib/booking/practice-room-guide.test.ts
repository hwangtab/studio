/** @jest-environment node */
import { buildPracticeRoomGuide } from './email';

/**
 * 입장 안내는 비밀번호를 환경변수에서만 읽는다(공개 저장소). 값이 없을 때 조용히
 * 빈 문구가 나가면 손님이 문 앞에서 막힌다 — 그 경우를 `missing`으로 드러내는지 고정한다.
 */
describe('buildPracticeRoomGuide', () => {
  const KEYS = ['PRACTICE_ROOM_ENTRANCE_CODE','PRACTICE_ROOM_ROOM_CODE_R02','PRACTICE_ROOM_WIFI_SSID','PRACTICE_ROOM_WIFI_PASSWORD','PRACTICE_ROOM_RESTROOM_CODE'];
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => { for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; } });
  afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

  it('전부 있으면 문·방·와이파이·화장실 안내가 실린다', () => {
    process.env.PRACTICE_ROOM_ENTRANCE_CODE = '1111*';
    process.env.PRACTICE_ROOM_ROOM_CODE_R02 = '2222*';
    process.env.PRACTICE_ROOM_WIFI_SSID = 'ssid';
    process.env.PRACTICE_ROOM_WIFI_PASSWORD = 'pw';
    const g = buildPracticeRoomGuide('R02');
    expect(g.missing).toEqual([]);
    expect(g.text).toContain('<1111*>');
    expect(g.text).toContain('R02번 방');
    expect(g.text).toContain('<2222*>');
    expect(g.text).toContain('와이파이: ssid');
    expect(g.text).toContain('비밀번호: pw');
    // 화장실 코드가 따로 없으면 입구 코드를 쓴다
    expect(g.text).toContain('화장실');
    expect(g.text.split('<1111*>').length - 1).toBe(2);
  });

  it('화장실 코드가 따로 있으면 그걸 쓴다', () => {
    process.env.PRACTICE_ROOM_ENTRANCE_CODE = '1111*';
    process.env.PRACTICE_ROOM_ROOM_CODE_R02 = '2222*';
    process.env.PRACTICE_ROOM_WIFI_SSID = 'ssid';
    process.env.PRACTICE_ROOM_WIFI_PASSWORD = 'pw';
    process.env.PRACTICE_ROOM_RESTROOM_CODE = '3333*';
    expect(buildPracticeRoomGuide('R02').text).toContain('<3333*>');
  });

  it('하나라도 비면 비밀번호를 싣지 않고 missing에 이름을 남긴다', () => {
    process.env.PRACTICE_ROOM_ENTRANCE_CODE = '1111*';
    process.env.PRACTICE_ROOM_WIFI_SSID = 'ssid';
    process.env.PRACTICE_ROOM_WIFI_PASSWORD = 'pw';
    const g = buildPracticeRoomGuide('R02'); // 방 코드 없음
    expect(g.missing).toEqual(['PRACTICE_ROOM_ROOM_CODE_R02']);
    expect(g.text).not.toContain('<1111*>');
    expect(g.text).toContain('별도로 보내드립니다');
  });

  it('방이 배정되지 않았으면 roomNumber가 missing이다', () => {
    const g = buildPracticeRoomGuide(null);
    expect(g.missing).toContain('roomNumber');
  });

  it('방 번호는 환경변수 키로 정규화된다 (r-02 → R02)', () => {
    process.env.PRACTICE_ROOM_ENTRANCE_CODE = '1111*';
    process.env.PRACTICE_ROOM_ROOM_CODE_R02 = '2222*';
    process.env.PRACTICE_ROOM_WIFI_SSID = 'ssid';
    process.env.PRACTICE_ROOM_WIFI_PASSWORD = 'pw';
    expect(buildPracticeRoomGuide('r-02').missing).toEqual([]);
  });
});
