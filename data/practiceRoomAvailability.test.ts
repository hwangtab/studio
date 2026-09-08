/**
 * 연습실 공실 상태 신선도 가드.
 *
 * PRACTICE_ROOM_AVAILABILITY_UPDATED_ON은 사람이 "지금 확인했다"고 손으로 남기는
 * 날짜다. 형식이 깨지거나, 미래 날짜이거나, 오래 방치돼 있으면 "지금 입주 가능"
 * 같은 문구가 거짓 광고가 될 수 있으므로 CI에서 잡는다.
 */
import {
  PRACTICE_ROOM_AVAILABILITY_UPDATED_ON,
  PRACTICE_ROOM_HAS_VACANCY,
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
