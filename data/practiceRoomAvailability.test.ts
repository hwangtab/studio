/**
 * 연습실 공실 상태 신선도 가드.
 *
 * PRACTICE_ROOM_AVAILABILITY_UPDATED_ON은 사람이 "지금 확인했다"고 손으로 남기는
 * 날짜다. 형식이 깨지거나, 미래 날짜이거나, 오래 방치돼 있으면 "지금 입주 가능"
 * 같은 문구가 거짓 광고가 될 수 있으므로 CI에서 잡는다.
 */
import fs from 'fs';
import path from 'path';

import {
  PRACTICE_ROOM_AVAILABILITY_UPDATED_ON,
  PRACTICE_ROOM_HAS_VACANCY,
  PRACTICE_ROOM_VACANT_ROOMS,
} from './practiceRoomAvailability';

const MAX_AGE_DAYS = 120;

describe('practiceRoomAvailability', () => {
  it('PRACTICE_ROOM_HAS_VACANCY는 boolean이다', () => {
    expect(typeof PRACTICE_ROOM_HAS_VACANCY).toBe('boolean');
  });

  it('updatedOn은 YYYY-MM-DD 형식이다', () => {
    expect(PRACTICE_ROOM_AVAILABILITY_UPDATED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('updatedOn은 유효한 날짜이고 미래가 아니다', () => {
    const updatedOn = new Date(`${PRACTICE_ROOM_AVAILABILITY_UPDATED_ON}T00:00:00Z`);
    expect(Number.isNaN(updatedOn.getTime())).toBe(false);
    expect(updatedOn.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it(`updatedOn이 ${MAX_AGE_DAYS}일을 넘기면 실패한다 — 상태를 재확인하고 날짜를 갱신하라`, () => {
    const updatedOn = new Date(`${PRACTICE_ROOM_AVAILABILITY_UPDATED_ON}T00:00:00Z`);
    const ageDays = (Date.now() - updatedOn.getTime()) / (1000 * 60 * 60 * 24);
    expect(ageDays).toBeLessThanOrEqual(MAX_AGE_DAYS);
  });
});

describe('남은 방 수 — 카피와 상수가 같은 값을 말한다', () => {
  const locales = ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'] as const;
  const load = (l: string): Record<string, unknown> =>
    JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'locales', l, 'common.json'), 'utf8'));
  const KO_KEYS: Array<[string, string[]]> = [
    ['pricing.practiceRoom.subtitleVacant', ['pricing', 'practiceRoom', 'subtitleVacant']],
    ['practiceRoom.pricing.noteVacant', ['practiceRoom', 'pricing', 'noteVacant']],
    ['practiceRoom.midCta.noteVacant', ['practiceRoom', 'midCta', 'noteVacant']],
    // 2026-09-23에 추가한 사실 표의 공실 칸. 목록에 넣지 않았더니 비-ko 여섯 언어가
    // "{{rooms}} room(s) open"·"空{{rooms}}间"으로 수량을 말하는데도 초록이었다 —
    // 가드가 경로를 열거하는 구조라, 공실을 말하는 키를 새로 만들면 여기에 함께 넣어야 한다.
    ['practiceRoom.factsTable.vacancyValue', ['practiceRoom', 'factsTable', 'vacancyValue']],
  ];
  const at = (o: unknown, keys: string[]): string =>
    keys.reduce<unknown>((a, k) => (a as Record<string, unknown> | undefined)?.[k], o) as string;

  it('PRACTICE_ROOM_VACANT_ROOMS는 1 이상이다 (0이면 HAS_VACANCY를 false로)', () => {
    expect(PRACTICE_ROOM_VACANT_ROOMS).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(PRACTICE_ROOM_VACANT_ROOMS)).toBe(true);
  });

  it.each(KO_KEYS)('ko %s는 {{rooms}} 보간을 쓴다 (숫자를 직접 박지 않는다)', (_label, path) => {
    const v = at(load('ko'), path);
    expect(v).toContain('{{rooms}}');
    // 상수 밖 숫자를 하드코딩하면 자리 수가 바뀔 때 거짓말이 된다
    expect(v).not.toMatch(/\d\s*자리/);
  });

  /**
   * 비-ko는 수량을 말하지 않는다 — 로케일마다 단복수·양사 규칙이 달라
   * 숫자를 넣으면 자리 수가 바뀔 때 여섯 언어가 한꺼번에 틀린다.
   */
  it.each(locales.filter((l) => l !== 'ko'))('%s 공실 카피는 수량을 말하지 않는다', (loc) => {
    const c = load(loc);
    for (const [, path] of KO_KEYS) {
      const v = at(c, path);
      expect(typeof v).toBe('string');
      expect(v).not.toContain('{{rooms}}');
      expect(v).not.toMatch(/\b\d+\s*(room|salas?|phòng|xona|间|ห้อง)/i);
    }
  });
});
