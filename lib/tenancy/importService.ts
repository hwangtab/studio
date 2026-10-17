import { and, desc, eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { contracts, roomTenancies } from '../../db/schema';
import { parseTenancySheet } from './importCsv';
import { NON_TENANCY_ROOMS } from './rules';
import { createTenancy } from './service';

/**
 * 시트 가져오기(일회성, 관리자 API 전용) — 멱등이다: 같은 (방 또는 비상주 이름, 이름, 시작일)이 이미 있으면 건너뛴다.
 * 시트에 전화번호가 없는 사람은 **전자계약에서 같은 이름으로** 찾아 채우고 계약 id를 연결한다(여러 건이면 가장 최근 것).
 */
export interface ImportSummary {
  created: number;
  skippedExisting: number;
  phoneFilledFromContract: string[];
  problems: string[];
}

export const importTenancySheet = async (csv: string): Promise<ImportSummary> => {
  const { rows, skipped } = parseTenancySheet(csv);
  const db = getDb();
  const summary: ImportSummary = { created: 0, skippedExisting: 0, phoneFilledFromContract: [], problems: skipped.map((s) => `${s.line}행: ${s.reason}`) };
  const existing = await db.select({ room: roomTenancies.roomNumber, name: roomTenancies.tenantName, start: roomTenancies.startDate }).from(roomTenancies);
  const seen = new Set(existing.map((e) => `${e.room ?? 'V'}|${e.name}|${e.start}`));

  for (const row of rows) {
    const key = `${row.input.roomNumber ?? 'V'}|${row.input.tenantName}|${row.input.startDate}`;
    if (seen.has(key)) { summary.skippedExisting += 1; continue; }
    const input = { ...row.input };
    // 시간제 방(R02)·컨트롤룸(R03)은 월 입주로 받지 않는다 — 등록 화면과 같은 규칙이다(가져오기가 검증을 건너뛰면 시간제 예약과 겹친다).
    if (input.roomNumber && NON_TENANCY_ROOMS[input.roomNumber]) {
      summary.problems.push(`${input.roomNumber} ${input.tenantName}: ${NON_TENANCY_ROOMS[input.roomNumber]}`);
      continue;
    }
    if (row.needsPhoneLookup) {
      const found = await db.select({ id: contracts.id, phone: contracts.customerPhone }).from(contracts)
        // 이름만으로 찾으면 동명이인(다른 종류의 계약)의 연락처가 들어온다 — 같은 방의 계약만 쓴다.
        .where(and(eq(contracts.customerName, input.tenantName), eq(contracts.roomNumber, input.roomNumber ?? ''))).orderBy(desc(contracts.createdAt)).limit(1);
      if (found[0]) {
        input.private = { ...input.private, phone: found[0].phone };
        input.contractId = found[0].id;
        // 계약서의 deposit_amount는 받은 돈이 아니다 — 제5조: 보증금은 면제이고 중도 퇴실 때 내는 위약금(월 이용료 1개월분)의 기준액일 뿐이다.
        summary.phoneFilledFromContract.push(input.tenantName);
      }
    }
    const result = await createTenancy(input, { lastPaid: row.lastPaid ?? undefined });
    if (result.ok) { summary.created += 1; seen.add(key); } else summary.problems.push(`${input.roomNumber ?? '비상주'} ${input.tenantName}: ${result.message}`);
  }
  return summary;
};
