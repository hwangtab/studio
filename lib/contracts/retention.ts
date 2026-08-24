import { del } from '@vercel/blob';
import { and, eq, inArray, isNotNull, isNull, lt, or } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { contracts, signatures } from '../../db/schema';
import type { ContractStatus } from './status';

/**
 * 계약서 제12조가 약속한 보관 기간. 계약 종료일로부터 이 기간이 지나면 개인정보를
 * 파기한다. 문구를 고칠 때는 lib/contracts/contract-template.md의 제12조도 함께 고쳐야
 * 한다 — 약속과 구현이 갈리면 어느 쪽도 지켜지지 않는다.
 */
export const RETENTION_YEARS = 3;

/** 파기 후 자리를 채우는 표시. 빈 값으로 두면 "누락"과 "파기"를 구분할 수 없다. */
const PURGED_MARK = '(개인정보 파기됨)';

export interface PurgeResult {
  purged: number;
  failed: number;
}

export const getRetentionBoundary = (now: Date = new Date()): Date => {
  const boundary = new Date(now);
  boundary.setFullYear(boundary.getFullYear() - RETENTION_YEARS);
  return boundary;
};

/**
 * 보관 기간이 지난 계약의 개인정보를 파기한다.
 *
 * 계약 행 자체는 남긴다. 기간·금액·호실처럼 개인을 식별하지 않는 항목은 운영 기록으로
 * 쓸 수 있고, 행을 통째로 지우면 "이런 계약이 있었다"는 사실까지 사라져 분쟁 시 정황을
 * 설명할 수 없다. 지우는 것은 이름·생년월일·연락처·주소, 이 정보가 그대로 박혀 있는
 * 계약 본문, 그리고 서명 이미지·IP·단말 정보다. 보관된 PDF에도 같은 내용이 있으므로
 * 함께 지운다.
 *
 * 계약 제목(title)도 지운다. 관리자가 자유롭게 적는 칸이라 무엇이 들어 있는지 알 수 없고,
 * 목록에서 계약을 구분하려면 "홍길동 302호"처럼 이름을 넣는 것이 가장 자연스럽다.
 * 여기를 남겨 두면 다른 곳을 다 지워도 이름이 그대로 남는다. 호실·기간·금액은 컬럼에
 * 따로 있으므로 제목을 지워도 운영 기록으로서의 식별은 유지된다.
 */
export const purgeExpiredPersonalData = async (now: Date = new Date()): Promise<PurgeResult> => {
  const boundary = getRetentionBoundary(now);

  const targets = await getDb()
    .select({ id: contracts.id, pdfUrl: contracts.pdfUrl })
    .from(contracts)
    .where(
      and(
        /**
         * 보관 기간은 "이용이 끝난 날"로부터 센다. 계약서 제12조 ④의 "계약 종료 후 3년"이다.
         *
         * 종료일(endDate)만 보면 안 되는 이유: 제3조의 자동 갱신 때문에 종료일이 지나도
         * 계약이 살아 있을 수 있다. 실제로 이 저장소는 호실 점유를 endDate가 아니라
         * terminatedAt으로 판정한다(service.ts findRoomConflict, db/schema.ts 주석).
         * 개인정보 파기만 endDate를 쓰면 "실제 종료 3개월 만에 파기"(=12조 위반)가 된다.
         *
         * 그래서 기산점을 COALESCE(terminatedAt, endDate)로 맞춘다 — 종료 처리된 계약은
         * 실제 종료일부터, 그렇지 않은 계약은 계약상 종료일부터. SQL COALESCE로 감싸면
         * drizzle이 좌변 타입을 몰라 boundary(Date)를 unix timestamp로 변환하지 못하므로,
         * 타입이 있는 컬럼을 각각 직접 비교해 같은 논리를 편다.
         */
        or(
          and(isNotNull(contracts.terminatedAt), lt(contracts.terminatedAt, boundary)),
          and(isNull(contracts.terminatedAt), lt(contracts.endDate, boundary)),
        ),
        /**
         * 종결된 계약만 파기한다 — signed는 제외한다.
         *
         * draft는 아직 계약이 아니고 sent는 서명 대기라 애초에 대상이 아니다. 여기서 signed도
         * 뺀 것이 이번 수정의 핵심이다: 서명됐는데 종료 처리가 없는 계약은 자동 갱신(제3조)으로
         * 계약상 종료일이 몇 년 전이어도 지금 이용 중일 수 있다. 이용이 실제로 끝나면 상태가
         * terminated로 바뀌므로(status.ts 전이도), 파기 대상은 terminated·expired·cancelled면
         * 충분하다. signed를 그대로 두면 파기가 아니라 종료 처리를 요구하는 배너가 뜬다
         * (needsTermination). 파기해 버리면 이용료 청구도 제13조가 전제하는 통지도 불가능해진다.
         */
        inArray(
          contracts.status,
          ['expired', 'cancelled', 'terminated'] satisfies ContractStatus[],
        ),
        /**
         * 기록을 만든 지도 그만큼 지났어야 한다.
         *
         * 종료일만 보면, 지난 계약을 뒤늦게 문서화하거나 연도를 잘못 적어 만든 계약이
         * 만들자마자 파기 대상이 된다. 보관 기간은 "우리가 이 정보를 가지고 있던 기간"이지
         * 계약서에 적힌 날짜가 아니다.
         */
        lt(contracts.createdAt, boundary),
        isNull(contracts.purgedAt),
      ),
    );

  let purged = 0;
  let failed = 0;

  for (const target of targets) {
    try {
      // PDF를 먼저 지운다. 여기서 실패하면 파기 표식을 남기지 않아 다음 회차에 다시 시도한다
      // — 표식만 찍고 파일이 남으면 파기됐다고 착각하게 된다.
      if (target.pdfUrl) {
        await del(target.pdfUrl);
      }

      await getDb().batch([
        getDb()
          .update(contracts)
          .set({
            title: PURGED_MARK,
            customerName: PURGED_MARK,
            customerBirthdate: null,
            customerEmail: PURGED_MARK,
            customerPhone: PURGED_MARK,
            customerAddress: null,
            content: PURGED_MARK,
            // 관리자가 자유 서술하는 칸이라 이름·연락처 조각이 들어갈 수 있다(title과 같은 이유).
            // 종료 사유는 감사 기록으로 필요하니 통째로 null이 아니라 파기 표식으로 대체한다.
            terminationReason: PURGED_MARK,
            // 스키마에만 있고 현재 쓰이지 않지만, 자유 입력 칸이라 방어적으로 함께 비운다.
            description: null,
            pdfUrl: null,
            purgedAt: now,
            updatedAt: now,
          })
          .where(eq(contracts.id, target.id)),
        getDb()
          .update(signatures)
          .set({
            signerName: PURGED_MARK,
            signerEmail: PURGED_MARK,
            signatureData: null,
            ipAddress: null,
            userAgent: null,
            updatedAt: now,
          })
          .where(eq(signatures.contractId, target.id)),
      ]);

      purged += 1;
    } catch (error: unknown) {
      console.error(`[contracts/retention] Failed to purge ${target.id}:`, error);
      failed += 1;
    }
  }

  return { purged, failed };
};
