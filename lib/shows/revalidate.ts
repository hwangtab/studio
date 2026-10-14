import type { NextApiResponse } from 'next';
import { sql } from 'drizzle-orm';

/** 공개 페이지를 다시 만든다 — best-effort. 이 앱이 ISR이 아닌 경로에서 던지는 오류는 무시한다. */
export async function revalidateShow(res: NextApiResponse, slug: string) {
  for (const path of ['/ko/shows', `/ko/shows/${slug}`, `/en/shows/${slug}`]) {
    try {
      await res.revalidate(path);
    } catch {
      /* 재검증 실패가 운영 액션을 실패시키지 않는다 */
    }
  }
}

/** 공연 공개 상태 변경(취소된 공연은 건드리지 않는다) — 관리자 set_status와 주최자 공연 승인이 함께 쓴다. */
export const sqlUpdateStatus = (showId: string, status: 'draft' | 'published', now: Date) =>
  sql`UPDATE shows SET status = ${status}, updated_at = ${Math.floor(now.getTime() / 1000)} WHERE id = ${showId} AND status != 'cancelled'`;

/** 공개 전제 — 예정된 미래 회차·구역·티켓타입이 모두 있어야 한다. */
export const isPublishable = (
  show: { showtimes: Array<{ status: string; startsAt: number }>; zones: unknown[]; ticketTypes: unknown[] },
  now: Date,
): boolean =>
  show.showtimes.some((s) => s.status === 'scheduled' && s.startsAt * 1000 > now.getTime()) &&
  show.zones.length > 0 &&
  show.ticketTypes.length > 0;
