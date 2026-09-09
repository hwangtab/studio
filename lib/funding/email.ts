import type { FundingProject } from './projects';
import type { FundingOrder } from './service';

/** Task 7이 본문을 채운다 — 지금은 항상 성공(null)으로 스텁. */
export const sendFundingConfirmedEmails = async (_order: FundingOrder, _project: FundingProject | null): Promise<string | null> => null;
