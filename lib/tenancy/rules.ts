/**
 * 월 입주 관리의 순수 규칙 — 날짜 계산·검증·상태 판정. DB·캘린더·암호화를 import하지 않는다(클라이언트에서도 쓴다).
 * 날짜는 전부 KST 달력 날짜 `YYYY-MM-DD` 문자열이다.
 */

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KST_OFFSET_MS = 9 * 3600 * 1000;

export const isValidDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

export const kstToday = (now: Date = new Date()): string => new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);

const daysInMonth = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** `date`의 n개월 뒤 같은 달의 `billingDay`일 — 그 달에 없는 날(31일 등)은 말일로 보정한다. */
export const addMonthsOnBillingDay = (date: string, months: number, billingDay: number): string => {
  const [y, m] = date.split('-').map(Number);
  const idx = y * 12 + (m - 1) + months;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  const day = Math.min(billingDay, daysInMonth(ny, nm));
  return `${ny}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const addDays = (date: string, days: number): string => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

export const daysBetween = (from: string, to: string): number => {
  const f = from.split('-').map(Number);
  const t = to.split('-').map(Number);
  return Math.round((Date.UTC(t[0], t[1] - 1, t[2]) - Date.UTC(f[0], f[1] - 1, f[2])) / 86_400_000);
};

/** 입금 예정일이 오늘보다 앞이면 연체 일수(1~), 아니면 0. */
export const overdueDays = (nextDueOn: string, today: string): number => Math.max(0, daysBetween(nextDueOn, today));

export type TenancyFlag = 'overdue' | 'due_soon' | 'contract_passed' | 'contract_soon';

export const DUE_SOON_DAYS = 7;
export const CONTRACT_SOON_DAYS = 30;

/** 목록에 띄울 주의 표시. 종료일이 지났는데 계속 입금 중이면 자동 연장이라 `contract_passed`(정보)로만 알린다. */
export const flagsOf = (t: { status: string; nextDueOn: string; endDate: string | null }, today: string): TenancyFlag[] => {
  if (t.status !== 'active') return [];
  const flags: TenancyFlag[] = [];
  const late = overdueDays(t.nextDueOn, today);
  if (late > 0) flags.push('overdue');
  else if (daysBetween(today, t.nextDueOn) <= DUE_SOON_DAYS) flags.push('due_soon');
  if (t.endDate) {
    const left = daysBetween(today, t.endDate);
    if (left < 0) flags.push('contract_passed');
    else if (left <= CONTRACT_SOON_DAYS) flags.push('contract_soon');
  }
  return flags;
};

export interface TenancyPrivate {
  phone?: string;
  emergencyContact?: string;
  email?: string;
  businessNumber?: string;
  gender?: string;
}

export interface TenancyInput {
  kind: 'room' | 'virtual';
  roomNumber: string | null;
  tenantName: string;
  monthlyAmount: number;
  depositAmount: number | null;
  startDate: string;
  endDate: string | null;
  billingDay: number;
  nextDueOn: string;
  hasWindow: boolean | null;
  furnishings: string | null;
  roomListPrice: number | null;
  note: string | null;
  contractId: string | null;
  private: TenancyPrivate;
}

type Parsed = { ok: true; value: TenancyInput } | { ok: false; message: string };

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t.slice(0, max);
};

export const ROOM_RE = /^R\d{2}$/;

/**
 * 월 입주로 받을 수 없는 방. R02는 시간제 연습실로 팔리고(녹음실과 공유), R03은 녹음실 컨트롤룸이다(운영자 확인 2026-10-16).
 * 입주 기록은 시간제 예약을 막지 않으므로, 이 방을 월 입주로 등록하면 같은 시간에 시간제 예약이 들어온다.
 * 정말 월 입주로 돌릴 때는 이 목록에서 빼고, 그 방의 기간 블록을 함께 건다(lib/booking/products.ts PRACTICE_ROOM_HOURLY_ROOMS).
 */
export const NON_TENANCY_ROOMS: Readonly<Record<string, string>> = {
  R02: 'R02는 시간제 연습실(녹음실과 공유)이라 월 입주로 받을 수 없어요.',
  R03: 'R03은 녹음실 컨트롤룸이라 월 입주로 받을 수 없어요.',
};

export const parseTenancyInput = (raw: unknown): Parsed => {
  const b = (raw ?? {}) as Record<string, unknown>;
  const kind = b.kind;
  if (kind !== 'room' && kind !== 'virtual') return { ok: false, message: '입주 유형(방 / 비상주)을 골라 주세요.' };
  const tenantName = str(b.tenantName, 100);
  if (!tenantName) return { ok: false, message: '이름(상호)을 적어 주세요.' };
  let roomNumber: string | null = null;
  if (kind === 'room') {
    roomNumber = str(b.roomNumber, 10)?.toUpperCase() ?? null;
    if (!roomNumber || !ROOM_RE.test(roomNumber)) return { ok: false, message: '방 번호는 R01 형식으로 적어 주세요.' };
    if (NON_TENANCY_ROOMS[roomNumber]) return { ok: false, message: NON_TENANCY_ROOMS[roomNumber] };
  }
  const monthlyAmount = Number(b.monthlyAmount);
  if (!Number.isInteger(monthlyAmount) || monthlyAmount < 0 || monthlyAmount > 100_000_000) return { ok: false, message: '월 이용료를 확인해 주세요.' };
  let depositAmount: number | null = null;
  if (b.depositAmount !== null && b.depositAmount !== undefined && b.depositAmount !== '') {
    depositAmount = Number(b.depositAmount);
    if (!Number.isInteger(depositAmount) || depositAmount < 0 || depositAmount > 1_000_000_000) return { ok: false, message: '보증금을 확인해 주세요.' };
  }
  if (!isValidDate(b.startDate)) return { ok: false, message: '입주 시작일을 확인해 주세요.' };
  const endDate = b.endDate === null || b.endDate === undefined || b.endDate === '' ? null : b.endDate;
  if (endDate !== null && !isValidDate(endDate)) return { ok: false, message: '계약 종료일을 확인해 주세요.' };
  if (!isValidDate(b.nextDueOn)) return { ok: false, message: '다음 입금 예정일을 확인해 주세요.' };
  const billingDay = b.billingDay === undefined || b.billingDay === null || b.billingDay === '' ? Number(b.nextDueOn.slice(8)) : Number(b.billingDay);
  if (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31) return { ok: false, message: '납부일은 1~31이에요.' };
  let roomListPrice: number | null = null;
  if (b.roomListPrice !== null && b.roomListPrice !== undefined && b.roomListPrice !== '') {
    roomListPrice = Number(b.roomListPrice);
    if (!Number.isInteger(roomListPrice) || roomListPrice < 0 || roomListPrice > 100_000_000) return { ok: false, message: '방 정가를 확인해 주세요.' };
  }
  const p = (b.private ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    value: {
      kind, roomNumber, tenantName, monthlyAmount, depositAmount,
      startDate: b.startDate, endDate, billingDay, nextDueOn: b.nextDueOn,
      hasWindow: typeof b.hasWindow === 'boolean' ? b.hasWindow : null,
      furnishings: str(b.furnishings, 200), roomListPrice, note: str(b.note, 300),
      contractId: str(b.contractId, 64),
      private: {
        phone: str(p.phone, 30) ?? undefined, emergencyContact: str(p.emergencyContact, 60) ?? undefined,
        email: str(p.email, 254) ?? undefined, businessNumber: str(p.businessNumber, 20) ?? undefined, gender: str(p.gender, 10) ?? undefined,
      },
    },
  };
};
