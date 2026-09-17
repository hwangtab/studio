import { computeEarliestStartDate, kstEndOfDayIso, kstStartOfDayIso, toKstDateString } from './creatorDateInput';

describe('toKstDateString', () => {
  it('UTC 자정은 그날 오전 9시(KST)이므로 같은 달력 날짜다', () => {
    expect(toKstDateString(new Date('2026-10-05T00:00:00.000Z'))).toBe('2026-10-05');
  });

  it('UTC 15시(=KST 자정)는 다음 날 KST 날짜다', () => {
    expect(toKstDateString(new Date('2026-10-04T15:00:00.000Z'))).toBe('2026-10-05');
  });

  it('UTC 14시59분(KST 자정 1분 전)은 아직 그날 KST 날짜다', () => {
    expect(toKstDateString(new Date('2026-10-04T14:59:00.000Z'))).toBe('2026-10-04');
  });
});

describe('왕복 — KST 날짜 문자열 → ISO → 다시 KST 날짜 문자열', () => {
  // 서버가 저장 시 `new Date(kstStartOfDayIso(v))`로 받고, 화면이 다시 읽을 때
  // `toKstDateString`으로 되돌린다. 이 왕복에서 값이 흔들리면(예전 버그처럼) 개설자가
  // 아무것도 바꾸지 않고 다시 저장하기만 해도 DB의 날짜가 밀린다.
  it.each(['2026-01-01', '2026-09-17', '2026-10-05', '2026-12-31'])('%s는 시작일 기준 왕복에서 그대로다', (v) => {
    const iso = kstStartOfDayIso(v);
    const roundTripped = toKstDateString(new Date(iso));
    expect(roundTripped).toBe(v);
  });

  it.each(['2026-01-01', '2026-09-17', '2026-10-19', '2026-12-31'])('%s는 종료일 기준 왕복에서도 그대로다', (v) => {
    const iso = kstEndOfDayIso(v);
    const roundTripped = toKstDateString(new Date(iso));
    expect(roundTripped).toBe(v);
  });

  it('종료일은 23:59:59로, 그날 마지막 순간을 가리킨다', () => {
    expect(kstEndOfDayIso('2026-10-19')).toBe('2026-10-19T23:59:59+09:00');
  });
});

describe('computeEarliestStartDate', () => {
  const leadDays = 3;

  it('오늘(KST) 00:00에 계산하면 정확히 leadDays 뒤 날짜다', () => {
    // 2026-09-17T00:00:00+09:00 = 2026-09-16T15:00:00Z
    const now = new Date('2026-09-16T15:00:00.000Z').getTime();
    expect(computeEarliestStartDate(now, leadDays)).toBe('2026-09-20');
  });

  it('그날 낮에 계산해도 leadDays 뒤 날짜의 00:00이 now+leadDays일 이상이 되도록 올림한다', () => {
    // 2026-09-17T14:00:00+09:00(KST 낮) — now+3일은 2026-09-20T14:00+09:00라
    // 2026-09-20 00:00+09:00보다 늦으므로 그 날짜는 아직 서버 조건(< now+3일)에 걸린다.
    // 하루 더 올려 2026-09-21이어야 한다.
    const now = new Date('2026-09-17T05:00:00.000Z').getTime(); // = 2026-09-17T14:00+09:00
    const earliest = computeEarliestStartDate(now, leadDays);
    expect(earliest).toBe('2026-09-21');

    // 계산한 날짜의 KST 자정이 실제로 서버 조건을 만족하는지 직접 확인한다 —
    // 이 단언이 이 함수의 존재 이유다.
    const startAtMs = new Date(kstStartOfDayIso(earliest)).getTime();
    expect(startAtMs).toBeGreaterThanOrEqual(now + leadDays * 86_400_000);
  });
});
