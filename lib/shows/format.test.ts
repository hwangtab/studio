import { formatEntryNumber, formatShowtimeLabel } from './format';

test('formatEntryNumber는 3자리로 0패딩한다', () => {
  expect(formatEntryNumber(7)).toBe('007');
  expect(formatEntryNumber(123)).toBe('123');
});

test('formatShowtimeLabel은 KST 기준 MM.DD(요일) HH:mm', () => {
  const startsAt = Math.floor(new Date('2026-10-10T10:00:00Z').getTime() / 1000); // 19:00 KST 토요일
  expect(formatShowtimeLabel(startsAt)).toBe('10.10(토) 19:00');
});

test('formatShowtimeLabel en은 요일·월 약칭에 KST를 붙인다', () => {
  const startsAt = Math.floor(new Date('2026-10-24T09:30:00Z').getTime() / 1000); // 18:30 KST 토요일
  expect(formatShowtimeLabel(startsAt, 'en')).toBe('Sat, Oct 24, 18:30 KST');
});
