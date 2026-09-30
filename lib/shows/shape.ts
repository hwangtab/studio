import { randomBytes } from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 정적·미서명 QR 페이로드. 온라인 조회 전용 시스템이라 서명이 불필요(스펙 §10). */
export function generateTicketCode(): string {
  const bytes = randomBytes(10); // 80 bits
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i < 16; i++) {
    const chunk = bits.slice(i * 5, i * 5 + 5).padEnd(5, '0');
    out += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return `SNT1:${out}`;
}

function kstDateString(now: Date): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

export function generateShowOrderNo(now: Date, isComp: boolean): string {
  const datePart = kstDateString(now);
  const randomPart = randomBytes(4).toString('hex').toUpperCase();
  return isComp ? `TKT-C-${datePart}-${randomPart}` : `TKT-${datePart}-${randomPart}`;
}

export const SHOW_ORDER_NO_PATTERN = /^TKT-(C-)?\d{8}-[0-9A-F]{8}$/;
