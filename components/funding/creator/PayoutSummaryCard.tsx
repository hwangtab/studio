import Link from 'next/link';
import type { ReactNode } from 'react';

import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Panel } from '../../ui/Panel';
import { formatBusinessNumber } from '../../../lib/funding/businessStatus';
import { businessStatusBadge, isBusinessView } from './businessStatusBadge';
import type { EditorPayoutSummary } from './types';

const NONE = '아직 없어요';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
      <dt className="text-gray-600 dark:text-gray-400">{label}</dt>
      <dd className="flex flex-wrap items-center gap-2 text-gray-900 dark:text-white">{children}</dd>
    </div>
  );
}

/**
 * 펀딩 편집기의 정산 탭 — 등록 상태 요약과 계정 화면 링크뿐이다.
 *
 * 정산 정보는 계정에 한 벌이고 저장 경로도 하나(`/ko/funding/creator/payout`)다. 같은 폼을 여기에도 그리면
 * 저장은 한 곳이어도 화면 상태(이탈 가드·국세청 경고)가 두 벌이 된다. 그래서 여기는 입력 칸을 두지 않는다.
 * 계좌·주민등록번호는 요약(`EditorPayoutSummary`)에도 값이 없다 — 등록 여부와 계좌 뒤 4자리뿐이다.
 */
export function PayoutSummaryCard({ summary }: { summary: EditorPayoutSummary }) {
  const business = isBusinessView(summary.business) ? summary.business : null;
  const badge = business ? businessStatusBadge(business) : null;
  return (
    <Panel as="section" padding="default" className="text-sm">
      <dl className="divide-y divide-gray-200 dark:divide-gray-700">
        <Row label="정산 계좌">
          {summary.registered ? `등록됨${summary.accountLast4 ? ` (뒤 4자리 ${summary.accountLast4})` : ''}` : NONE}
        </Row>
        <Row label="세금 유형">
          {summary.taxType === 'invoice' ? '사업자 — 세금계산서' : summary.taxType === 'withholding' ? '개인 — 원천징수' : NONE}
        </Row>
        {summary.taxType === 'withholding' && (
          <Row label="주민등록번호">{summary.residentNumberRegistered ? '등록됨' : NONE}</Row>
        )}
        {summary.taxType === 'invoice' && (
          business ? (
            <>
              <Row label="사업자등록번호">{formatBusinessNumber(business.businessNumber)}</Row>
              <Row label="상호">{business.businessName}</Row>
              {badge && <Row label="국세청 조회"><Badge tone={badge.tone}>{badge.label}</Badge></Row>}
              <Row label="사업자등록증">{business.hasCertificate ? '등록됨' : NONE}</Row>
            </>
          ) : (
            <Row label="사업자 정보">{summary.business === 'unavailable' ? '지금은 불러오지 못했어요' : NONE}</Row>
          )
        )}
      </dl>
      <p className="mt-4 text-gray-600 dark:text-gray-400">
        정산 정보는 계정에 한 벌이라 펀딩·공연·상점 정산에 함께 쓰여요. 고치는 곳도 한 곳이에요.
      </p>
      <Button asChild variant="weak" className="mt-4">
        <Link href="/ko/funding/creator/payout">정산 정보 고치기</Link>
      </Button>
    </Panel>
  );
}
