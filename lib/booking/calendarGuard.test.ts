/** @jest-environment node */
import { hasCalendarConflict, occupancyCalendars } from './calendarGuard';
import { isCalendarActive, listCalendarEvents } from './gcal';
import { occupancyConflictKeys, PRACTICE_ROOM_HOURLY_ROOMS, STUDIO_SHARED_ROOMS } from './products';

jest.mock('./gcal', () => ({ fetchBusyRanges: jest.fn(), isCalendarActive: jest.fn(), listCalendarEvents: jest.fn() }));

/**
 * R02는 레코딩룸이다(2026-09-28 운영자). 녹음과 R02 시간제는 예약·캘린더 모두에서 서로를 막아야
 * 한다. 이 표가 어긋나면 생성 가드·슬롯 화면·결제 직전 재확인 중 한 경로로 같은 방이 두 번 팔린다.
 */
describe('녹음실과 같은 방(R02)의 겹침 기준', () => {
  it('R02는 녹음실 공유 방 목록에 있다', () => {
    expect(STUDIO_SHARED_ROOMS).toContain('R02');
    expect(PRACTICE_ROOM_HOURLY_ROOMS).toContain('R02');
  });

  it('예약 겹침 키 — 녹음실은 R02와, R02는 녹음실과 서로 막는다', () => {
    expect(occupancyConflictKeys(null)).toEqual([null, 'R02']);
    expect(occupancyConflictKeys('R02')).toEqual(['R02', null]);
    expect(occupancyConflictKeys('R05')).toEqual(['R05']); // 녹음실과 무관한 방
  });

  it('캘린더 — 녹음실은 R02 연습실 캘린더까지, R02는 녹음실 캘린더까지 본다', () => {
    expect(occupancyCalendars(null)).toEqual([['studio', null], ['practice-room', 'R02']]);
    expect(occupancyCalendars('R02')).toEqual([['practice-room', 'R02'], ['studio', null]]);
    expect(occupancyCalendars('R05')).toEqual([['practice-room', 'R05']]);
  });
});

describe('일정 목록으로 보는 충돌(가져오기·일정 변경)', () => {
  const at = (h: number) => new Date(`2026-11-14T${String(h).padStart(2, '0')}:00:00+09:00`);
  const ev = (id: string, transparent: boolean) => ({ id, summary: '', description: '', start: at(0), end: new Date(at(0).getTime() + 86_400_000), allDay: true, transparent });

  it('"바쁨 아님"(월 입주 입금 예정 등) 일정과 자기 일정은 충돌이 아니고, 불투명한 다른 일정은 충돌이다', async () => {
    (isCalendarActive as jest.Mock).mockReturnValue(true);
    (listCalendarEvents as jest.Mock).mockResolvedValue([ev('tenancy', true), ev('self', false)]);
    expect(await hasCalendarConflict('practice-room', at(10), at(12), 'R02', 'self')).toBe(false);
    (listCalendarEvents as jest.Mock).mockResolvedValue([ev('other', false)]);
    expect(await hasCalendarConflict('practice-room', at(10), at(12), 'R02', 'self')).toBe(true);
  });
});
