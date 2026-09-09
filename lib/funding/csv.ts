const cell = (v: string | number | null): string => {
  if (v === null || v === undefined) return '';
  // 수식 인젝션 방어: 문자열이 =,+,-,@,탭,CR로 시작하면 엑셀이 수식으로 해석하지 않도록 '를 붙인다.
  // number 타입은 그대로 둔다(음수 금액은 없으나 -1 같은 값은 수식이 아니다).
  const s = typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** BOM + CRLF CSV — 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM을 앞에 붙인다. */
export const toCsv = (rows: Array<Record<string, string | number | null>>, columns: string[]): string =>
  '﻿' + [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c] ?? null)).join(','))].join('\r\n') + '\r\n';
