import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { CONTRACT_ADMIN_ACTION_LABELS, type ContractAdminAction } from '../../../../lib/contracts/admin-event-labels';
import { parseContractEventFilter, searchContractAdminEvents } from '../../../../lib/contracts/admin-events';
import { getStatusLabel } from '../../../../lib/contracts/status';
import { toCsv } from '../../../../lib/funding/csv';

/** 한 번에 내려받는 최대 건수. 계약 변경은 하루 몇 건 수준이라 사실상 전량이다. */
const EXPORT_LIMIT = 20000;

const COLUMNS = ['일시(KST)', '계약 ID', '호실', '행위', '수행자', '이전 상태', '이후 상태'];

const kst = (iso: string): string => new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);

/**
 * 계약 변경 이력 CSV — 화면(/admin/contracts/history)과 같은 필터.
 *
 * 개인정보가 없다(계약 id·호실·행위·수행자·상태·시각). 그래서 개인정보 내려받기에 남기는 접속기록(`privacy_access_logs`)은
 * 남기지 않는다 — 그 표는 이름·연락처 같은 값이 나가는 행위의 기록이고 이 파일에는 그런 값이 한 칸도 없다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false });
  }

  try {
    const rows = await searchContractAdminEvents(parseContractEventFilter(req.query, EXPORT_LIMIT));
    const csv = toCsv(
      rows.map((row) => ({
        '일시(KST)': kst(row.at),
        '계약 ID': row.contractId,
        '호실': row.roomNumber,
        '행위': CONTRACT_ADMIN_ACTION_LABELS[row.action as ContractAdminAction] ?? row.action,
        '수행자': row.actor,
        '이전 상태': row.fromStatus ? getStatusLabel(row.fromStatus as never) : null,
        '이후 상태': row.toStatus ? getStatusLabel(row.toStatus as never) : null,
      })),
      COLUMNS,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="contract-admin-events.csv"');
    return res.status(200).send(csv);
  } catch (error: unknown) {
    console.error('[API/admin/contracts/history-export] 이력 조회 실패:', error);
    return res.status(500).json({ ok: false, message: '이력을 불러오지 못했습니다. 마이그레이션 0075이 적용됐는지 확인해 주세요.' });
  }
}
