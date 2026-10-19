import { isValidDate, type TenancyInput } from './rules';

/**
 * 예전 시트(연습실대여현황 — 현황.csv)를 입주 기록으로 바꾸는 **일회성** 파서. 순수 함수 — DB·암호화를 모른다.
 *
 * 시트 규칙(2026-10 확인): 방 행은 첫 칸이 `R01`…, 비상주 행은 첫 칸이 `비대면`. 그 밖의 행(합계·지출·계좌)은 건너뛴다.
 * 비상주 행은 열 의미가 다르다 — `비상연락` 칸에 이메일, `특약` 칸에 사업자등록번호가 들어 있다.
 * `연체여부`·`종료일확인`의 "8일전" 같은 값은 상태가 아니라 시트가 계산한 남은 일수라 읽지 않는다.
 * 계약 종료일이 지났어도 입금이 이어지면 자동 연장이다(운영자 확정) — 전원 입주 중(active)으로 가져온다.
 */

export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
};

/**
 * 금액 칸 — `₩`·쉼표·공백만 걷고 **숫자만 남을 때만** 읽는다. 모든 비숫자를 걷으면 "360,000.50"이 36,000,050이 되고 "-360000"의 부호가 사라진다(감사).
 * 소수·음수·지수 표기·숫자가 아닌 글자가 섞이면 null(그 행은 빠진 값으로 건너뛴다).
 */
const won = (v: string | undefined): number | null => {
  const cleaned = (v ?? '').replace(/[₩,\s]/g, '');
  if (cleaned === '') return null;
  if (!/^\d{1,12}$/.test(cleaned)) return null;
  return Number(cleaned);
};
/** 전화번호에는 보이지 않는 방향 문자(U+202C 등)가 섞여 들어온다. */
const phoneOf = (v: string | undefined): string | undefined => {
  const t = (v ?? '').replace(/[^\d-]/g, '');
  return t === '' ? undefined : t;
};
const text = (v: string | undefined): string | null => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

/** 이름·상호는 100자, 메모는 300자로 자른다(등록 화면과 같은 한도). 글자 수는 서로게이트 쌍을 쪼개지 않게 센다. */
const clip = (v: string | null, max: number): string | null => (v === null ? null : Array.from(v).slice(0, max).join(''));
const dateOf = (v: string | undefined): string | null => (isValidDate((v ?? '').trim()) ? (v as string).trim() : null);

/** 시트의 "가격" 칸은 방 정가를 만원 단위로 적은 것(40 = 40만원). 큰 수면 원 단위로 본다. */
const listPriceOf = (v: string | undefined): number | null => {
  const n = won(v);
  return n === null || n === 0 ? null : n < 10_000 ? n * 10_000 : n;
};

export interface ImportRow {
  input: TenancyInput;
  lastPaid: { paidOn: string; amount: number } | null;
  /** 시트에 전화번호가 없으면 전자계약에서 이름으로 찾아 채운다. */
  needsPhoneLookup: boolean;
}

export type ImportResult = { rows: ImportRow[]; skipped: Array<{ line: number; reason: string }> };

export const parseTenancySheet = (csv: string): ImportResult => {
  const table = parseCsv(csv);
  const headerAt = table.findIndex((r) => r[0]?.trim() === '방' && r.some((c) => c.trim() === '이름'));
  if (headerAt < 0) return { rows: [], skipped: [{ line: 0, reason: '머리글 행(방, 이름…)을 찾지 못했어요.' }] };
  const col: Record<string, number> = {};
  table[headerAt].forEach((name, i) => { if (name.trim() !== '' && col[name.trim()] === undefined) col[name.trim()] = i; });
  const get = (r: string[], name: string) => r[col[name]];

  const rows: ImportRow[] = [];
  const skipped: ImportResult['skipped'] = [];
  table.slice(headerAt + 1).forEach((r, idx) => {
    const line = headerAt + idx + 2;
    const first = (r[0] ?? '').trim();
    const isRoom = /^R\d{2}$/.test(first);
    const isVirtual = first === '비대면';
    if (!isRoom && !isVirtual) return;
    const name = text(get(r, '이름'));
    const startDate = dateOf(get(r, '대여시작일'));
    const nextDueOn = dateOf(get(r, '입금예정일'));
    const monthly = won(get(r, '계약액'));
    if (!name || !startDate || !nextDueOn || monthly === null) {
      skipped.push({ line, reason: `${first} ${name ?? ''}: 이름·시작일·입금예정일·계약액 중 빠진 값이 있어요.` });
      return;
    }
    const hasWindowRaw = text(get(r, '창'));
    const paidOn = dateOf(get(r, '최종입금일'));
    const paidAmount = won(get(r, '최종입금액'));
    const special = text(get(r, '특약'));
    const emergency = text(get(r, '비상연락'));
    const phone = phoneOf(get(r, '전화번호'));
    const input: TenancyInput = {
      kind: isVirtual ? 'virtual' : 'room',
      roomNumber: isVirtual ? null : first,
      tenantName: clip(name, 100) ?? name,
      monthlyAmount: monthly,
      depositAmount: won(get(r, '보증금')),
      startDate,
      endDate: dateOf(get(r, '계약종료일')),
      billingDay: Number(nextDueOn.slice(8)),
      nextDueOn,
      hasWindow: isVirtual || hasWindowRaw === null ? null : hasWindowRaw === '창',
      furnishings: isVirtual ? null : clip(text(get(r, '피아노')), 200),
      roomListPrice: isVirtual ? null : listPriceOf(get(r, '가격')),
      note: isVirtual ? null : clip(special, 300),
      contractId: null,
      private: isVirtual
        ? { phone, email: emergency ?? undefined, businessNumber: special ?? undefined }
        : { phone, emergencyContact: emergency ?? undefined, gender: text(get(r, '성별')) ?? undefined },
    };
    rows.push({ input, lastPaid: paidOn && paidAmount !== null ? { paidOn, amount: paidAmount } : null, needsPhoneLookup: !phone });
  });
  return { rows, skipped };
};
