import { issueScanLink, verifyScanLink } from './scanLink';

/** lib/shows/scanLink.ts(스캔 링크 발급·검증)의 얇은 어댑터 — 관리자 화면·스캔 페이지·체크인 API가 쓴다. */

export interface ScanAccess {
  showtimeId: string;
  label: string;
}

export async function resolveScanAccess(token: unknown): Promise<ScanAccess | null> {
  if (typeof token !== 'string') return null;
  const r = await verifyScanLink(token);
  if (!r.ok) return null;
  return { showtimeId: r.link.showtimeId, label: r.link.label };
}

export async function createScanLinkToken(showtimeId: string, label: string, ttlHours: number): Promise<string> {
  return (await issueScanLink(showtimeId, label, ttlHours)).token;
}

/** 입장 확인자 표식(show_tickets.checked_in_by) — 같은 링크·라벨의 사람이 직전 스캔을 되돌릴 수 있게 라벨을 담는다. */
export const scanActorId = (label: string): string => `scan:${label || 'link'}`;

/**
 * QR·직접 입력에서 티켓 코드를 뽑는다. QR 페이로드는 `SNT1:XXXX…` 평문이거나, 코드를 담은 URL일 수 있다
 * (lib/shows/qr.ts의 형식에 의존하지 않도록 둘 다 받는다). 못 찾으면 null.
 */
export function extractTicketCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!text || text.length > 500) return null;
  const m = /SNT1:[A-Z2-7]{16}/i.exec(decodeSafe(text));
  return m ? m[0].toUpperCase() : null;
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
