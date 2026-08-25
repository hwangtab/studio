import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../db/client';
import { availabilityBlocks } from '../../../../db/schema';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { serializeBlockForAdmin } from '../../../../lib/booking/admin-serialize';
import { kstDateTime } from '../../../../lib/booking/kst';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MEMO_MAX_LENGTH = 200;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const allBlocks = await getDb().query.availabilityBlocks.findMany({
        orderBy: (t, { asc }) => [asc(t.startAt)],
      });

      return res.status(200).json({ ok: true, blocks: allBlocks.map(serializeBlockForAdmin) });
    } catch (error: unknown) {
      console.error('[API/admin/blocks] Failed to list blocks:', error);
      return res.status(500).json({ ok: false, message: '블록 목록을 불러오지 못했습니다.' });
    }
  }

  if (req.method === 'POST') {
    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });
    }

    const { date, startHour, endHour, memo } = req.body as Record<string, unknown>;

    if (typeof date !== 'string' || !DATE_RE.test(date)) {
      return res.status(400).json({ ok: false, message: '날짜가 올바르지 않습니다.' });
    }
    if (typeof startHour !== 'number' || !Number.isInteger(startHour) || startHour < 0 || startHour > 23) {
      return res.status(400).json({ ok: false, message: '시작 시간이 올바르지 않습니다.' });
    }
    // endHour는 자정을 24시로 표현할 수 있게 상한을 24로 둔다 (kstDateTime('...', 24)는
    // 다음날 00:00 KST와 같아 하루 끝까지 막는 블록을 만들 수 있다).
    if (typeof endHour !== 'number' || !Number.isInteger(endHour) || endHour <= startHour || endHour > 24) {
      return res.status(400).json({ ok: false, message: '종료 시간이 올바르지 않습니다.' });
    }

    const startAtDate = kstDateTime(date, startHour);
    if (Number.isNaN(startAtDate.getTime())) {
      return res.status(400).json({ ok: false, message: '날짜가 올바르지 않습니다.' });
    }
    const endAtDate = kstDateTime(date, endHour);

    const memoText = typeof memo === 'string' ? memo.trim().slice(0, MEMO_MAX_LENGTH) : undefined;

    try {
      const [block] = await getDb()
        .insert(availabilityBlocks)
        .values({ startAt: startAtDate, endAt: endAtDate, memo: memoText || null })
        .returning();

      return res.status(201).json({ ok: true, block: serializeBlockForAdmin(block) });
    } catch (error: unknown) {
      console.error('[API/admin/blocks] Failed to create block:', error);
      return res.status(500).json({ ok: false, message: '블록 생성에 실패했습니다.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, message: 'Method not allowed' });
}
