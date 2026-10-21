import { LESSON_MONTHLY_PRICE } from '../../data/pricing';

/**
 * 프로듀싱 레슨 운영의 순수 규칙 — 입력 검증·회차 날짜·시각 계산. DB를 import하지 않는다(클라이언트도 쓴다).
 * 날짜는 KST 달력 날짜 'YYYY-MM-DD', 시각은 KST 'HH:MM'. 설계: docs/lesson-management-design-2026-10.md.
 */

export const LESSON_COURSE_WEEKS = [12, 24] as const;
export const LESSON_DEFAULT_DURATION_MIN = 60;

export const PAY_METHOD_LABELS: Record<string, string> = { card: '카드 정기결제', bank: '계좌 선불', cash: '현금 선불' };
export const ENROLLMENT_STATUS_LABELS: Record<string, string> = { active: '수강 중', completed: '수료', ended: '중도 종료' };
export const SESSION_STATUS_LABELS: Record<string, string> = {
  scheduled: '예정', done: '완료', absent: '결석', studio_cancelled: '스튜디오 휴강', dropped: '중도 종료로 취소',
};
export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;
export const PAYMENT_METHODS = ['계좌 입금', '현금'] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const isRealDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

export const addDays = (date: string, days: number): string => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

export const weekdayOf = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();

/** 첫 수업일부터 매주 같은 요일로 `weeks`개의 날짜. */
export const sessionDates = (startDate: string, weeks: number): string[] => Array.from({ length: weeks }, (_, i) => addDays(startDate, i * 7));

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 날짜·시각 → 그 순간의 UTC Date. */
export const kstMoment = (date: string, time: string): Date => {
  const [h, m] = time.split(':').map(Number);
  return new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), h, m) - KST_OFFSET_MS);
};

export const slotRange = (date: string, time: string, durationMin: number): { start: Date; end: Date } => {
  const start = kstMoment(date, time);
  return { start, end: new Date(start.getTime() + durationMin * 60_000) };
};

export const overlaps = (a: { start: Date; end: Date }, b: { start: Date; end: Date }): boolean => a.start < b.end && a.end > b.start;

export interface EnrollmentInput {
  studentName: string;
  payMethod: 'card' | 'bank' | 'cash';
  courseWeeks: 12 | 24;
  startDate: string;
  startTime: string;
  durationMin: number;
  monthlyAmount: number;
  note: string | null;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

export const parseEnrollmentInput = (raw: unknown, today: string): Parsed<EnrollmentInput> => {
  const b = (raw ?? {}) as Record<string, unknown>;
  const studentName = typeof b.studentName === 'string' ? b.studentName.trim() : '';
  if (studentName === '' || studentName.length > 50) return { ok: false, message: '수강생 이름을 1~50자로 적어 주세요.' };
  const payMethod = b.payMethod;
  if (payMethod !== 'card' && payMethod !== 'bank' && payMethod !== 'cash') return { ok: false, message: '결제 방식을 골라 주세요.' };
  const courseWeeks = Number(b.courseWeeks);
  if (courseWeeks !== 12 && courseWeeks !== 24) return { ok: false, message: '과정은 12주 또는 24주예요.' };
  const startDate = b.startDate;
  if (!isRealDate(startDate)) return { ok: false, message: '첫 수업 날짜를 YYYY-MM-DD로 적어 주세요.' };
  if (startDate < '2025-01-01' || startDate > addDays(today, 365)) return { ok: false, message: '첫 수업 날짜가 너무 오래됐거나 너무 멀어요.' };
  const startTime = typeof b.startTime === 'string' ? b.startTime.trim() : '';
  if (!TIME_RE.test(startTime)) return { ok: false, message: '수업 시작 시각을 HH:MM으로 적어 주세요.' };
  const durationRaw = b.durationMin === undefined || b.durationMin === '' || b.durationMin === null ? LESSON_DEFAULT_DURATION_MIN : Number(b.durationMin);
  if (!Number.isInteger(durationRaw) || durationRaw < 30 || durationRaw > 180) return { ok: false, message: '수업 시간은 30~180분이에요.' };
  const amountRaw = b.monthlyAmount === undefined || b.monthlyAmount === '' || b.monthlyAmount === null ? LESSON_MONTHLY_PRICE : Number(b.monthlyAmount);
  if (!Number.isInteger(amountRaw) || amountRaw < 1_000 || amountRaw > 10_000_000) return { ok: false, message: '월 수강료를 확인해 주세요(부가세 별도 공급가, 원 단위).' };
  const note = typeof b.note === 'string' && b.note.trim() !== '' ? b.note.trim().slice(0, 300) : null;
  return { ok: true, value: { studentName, payMethod, courseWeeks, startDate, startTime, durationMin: durationRaw, monthlyAmount: amountRaw, note } };
};

export interface PaymentInput {
  paidOn: string;
  amount: number;
  vatAmount: number;
  periodLabel: string;
  method: string;
  memo: string | null;
  receiptIssued: boolean;
}

export const parsePaymentInput = (raw: unknown, today: string): Parsed<PaymentInput> => {
  const b = (raw ?? {}) as Record<string, unknown>;
  const paidOn = b.paidOn;
  if (!isRealDate(paidOn)) return { ok: false, message: '받은 날짜를 YYYY-MM-DD로 적어 주세요.' };
  if (paidOn > today) return { ok: false, message: '받은 날짜가 오늘보다 뒤일 수 없어요.' };
  if (paidOn < '2025-01-01') return { ok: false, message: '받은 날짜가 너무 오래됐어요.' };
  const amount = Number(b.amount);
  if (b.amount === null || b.amount === '' || !Number.isInteger(amount) || amount < 1_000 || amount > 100_000_000) return { ok: false, message: '받은 금액을 확인해 주세요(원 단위, 1,000원 이상).' };
  const vatRaw = b.vatAmount === undefined || b.vatAmount === '' || b.vatAmount === null ? 0 : Number(b.vatAmount);
  if (!Number.isInteger(vatRaw) || vatRaw < 0 || vatRaw >= amount) return { ok: false, message: '부가세는 0원 이상, 받은 금액보다 작아야 해요(부가세를 받지 않았으면 0).' };
  const periodLabel = typeof b.periodLabel === 'string' ? b.periodLabel.trim() : '';
  if (periodLabel === '' || periodLabel.length > 30) return { ok: false, message: '어느 기간 치인지 적어 주세요(예: 10월, 1~4회, 12주 일괄).' };
  const method = typeof b.method === 'string' ? b.method : '';
  if (!(PAYMENT_METHODS as readonly string[]).includes(method)) return { ok: false, message: '받은 방법(계좌 입금·현금)을 골라 주세요.' };
  const memo = typeof b.memo === 'string' && b.memo.trim() !== '' ? b.memo.trim().slice(0, 200) : null;
  return { ok: true, value: { paidOn, amount, vatAmount: vatRaw, periodLabel, method, memo, receiptIssued: b.receiptIssued === true } };
};

/** 진행 현황 — 완료·결석은 소화한 회차(결석은 보강 없이 소멸), 스튜디오 휴강·중도 종료 취소는 세지 않는다. */
export const progressOf = (sessions: ReadonlyArray<{ status: string }>): { total: number; consumed: number; done: number; absent: number; scheduled: number } => {
  const live = sessions.filter((s) => s.status !== 'studio_cancelled' && s.status !== 'dropped');
  const done = live.filter((s) => s.status === 'done').length;
  const absent = live.filter((s) => s.status === 'absent').length;
  return { total: live.length, consumed: done + absent, done, absent, scheduled: live.filter((s) => s.status === 'scheduled').length };
};

export interface ArrearsInput {
  payMethod: string;
  monthlyAmount: number;
  sessions: ReadonlyArray<{ status: string; scheduledOn: string }>;
  payments: ReadonlyArray<{ amount: number; vatAmount: number }>;
  today: string;
}

/**
 * 계좌·현금 선불 수강의 **미수금** — 월 4회를 한 달 치로 보고, 이미 시작된(진행했거나 날짜가 도래한) 회차의 달 수만큼 수강료를 받았어야 한다.
 * 첫 회차 전에는 시작 3일 전부터 한 달 치를 받아야 한다. 받은 돈은 부가세를 뺀 값으로 센다(수강료는 공급가 기준). 카드는 구독이 청구하므로 0.
 * 과정 일괄 선불(12주치를 한 번에)은 받은 돈이 몇 달 치를 덮으므로 미수가 안 생긴다 — 기록의 "기간" 표기는 계산에 쓰지 않는다.
 */
export const arrearsOf = (input: ArrearsInput): { monthsDue: number; expected: number; paidNet: number; arrears: number } => {
  if (input.payMethod === 'card') return { monthsDue: 0, expected: 0, paidNet: 0, arrears: 0 };
  const live = input.sessions.filter((s) => s.status !== 'studio_cancelled' && s.status !== 'dropped');
  const started = live.filter((s) => s.status === 'done' || s.status === 'absent' || (s.status === 'scheduled' && s.scheduledOn <= input.today)).length;
  const firstOn = live.map((s) => s.scheduledOn).sort()[0];
  const maxMonths = Math.max(1, Math.ceil(live.length / 4));
  const monthsDue = started > 0
    ? Math.min(maxMonths, Math.ceil(started / 4))
    : firstOn && firstOn <= addDays(input.today, 3) ? 1 : 0;
  const expected = monthsDue * input.monthlyAmount;
  const paidNet = input.payments.reduce((sum, p) => sum + p.amount - p.vatAmount, 0);
  return { monthsDue, expected, paidNet, arrears: Math.max(0, expected - paidNet) };
};
