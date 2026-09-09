const cell = (v: string | number | null): string => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** BOM + CRLF CSV — 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM을 앞에 붙인다. */
export const toCsv = (rows: Array<Record<string, string | number | null>>, columns: string[]): string =>
  '﻿' + [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c] ?? null)).join(','))].join('\r\n') + '\r\n';
