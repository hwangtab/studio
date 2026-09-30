const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 회차 시작 전날 24:00(KST) = 회차 당일 00:00(KST). */
export function salesCloseAt(startsAt: Date): Date {
  const kst = new Date(startsAt.getTime() + KST_OFFSET_MS);
  const kstMidnight = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), 0, 0, 0));
  return new Date(kstMidnight.getTime() - KST_OFFSET_MS);
}

export function isSalesOpen(showtime: { salesCloseAt: number }, now: Date): boolean {
  return Math.floor(now.getTime() / 1000) < showtime.salesCloseAt;
}

export function isShowtimeLive(showtime: { status: string; startsAt: number }, now: Date): boolean {
  if (showtime.status !== 'scheduled') return false;
  return Math.floor(now.getTime() / 1000) < showtime.startsAt;
}
