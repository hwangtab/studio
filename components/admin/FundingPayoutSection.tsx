import React, { useState } from 'react';

import { Button } from '../ui/Button';
import {
  FUNDING_PAYMENT_FEE_PERCENT,
  FUNDING_PLATFORM_FEE_PERCENT,
  FUNDING_WITHHOLDING_PERCENT,
  formatPriceAmount,
} from '../../data/pricing';
import { FUNDING_PAYOUT_BUSINESS_DAYS } from '../../lib/funding/policy';

/**
 * 기록된 정산. `funding_project_payouts` 한 행을 직렬화한 판 — Date 두 개가 ISO 문자열로
 * 바뀐 것 말고는 같다.
 */
export interface AdminPayoutRecordView {
  id: string;
  grossAmount: number;
  refundAmount: number;
  supplyAmount: number;
  feeAmount: number;
  platformFeeAmount: number;
  paymentFeeAmount: number;
  shareAmount: number;
  withholdingAmount: number;
  netAmount: number;
  backerCount: number;
  status: 'pending' | 'paid';
  paidAt: string | null;
  memo: string | null;
  createdAt: string;
}

/**
 * 화면이 받는 정산 미리보기.
 *
 * **계좌 정보(`payoutBankName`·`payoutAccount`·`payoutHolder`)와 세금 처리 구분(`taxType`)은
 * 여기 없다.** 이 값은 `getServerSideProps` props로 나가고 Pages Router는 props를
 * `__NEXT_DATA__` JSON으로 페이지 HTML에 그대로 싣는다 — 심사 화면을 여는 것만으로
 * 계좌번호가 소스에 박힌다. 계좌는 운영자가 버튼을 눌렀을 때만 별도 라우트
 * (`/api/admin/funding/projects/[id]/payout-account`)로 가져와 이 컴포넌트의 state에만 둔다.
 */
export interface AdminPayoutView {
  grossAmount: number;
  refundAmount: number;
  manualGrossAmount: number;
  supplyAmount: number;
  platformFeeAmount: number;
  paymentFeeAmount: number;
  feeAmount: number;
  shareAmount: number;
  withholdingAmount: number;
  netAmount: number;
  backerCount: number;
  closed: boolean;
  hasPayoutAccount: boolean;
  recorded: AdminPayoutRecordView | null;
}

interface RevealedAccount {
  bankName: string;
  account: string;
  holder: string;
  taxType: 'withholding' | 'invoice' | null;
}

const TAX_TYPE_LABEL: Record<string, string> = {
  withholding: `개인 — 원천징수 ${FUNDING_WITHHOLDING_PERCENT}%`,
  invoice: '사업자 — 세금계산서(원천징수 없음)',
};

const Row = ({
  label,
  value,
  hint,
  strong,
  negative,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
  negative?: boolean;
}) => (
  <div className="flex justify-between gap-4 py-1.5">
    <dt className={`shrink-0 ${strong ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
      {label}
      {hint && <span className="block text-xs font-normal text-gray-400">{hint}</span>}
    </dt>
    <dd
      className={`text-right tabular-nums ${
        strong ? 'text-base font-bold text-gray-900' : negative ? 'text-gray-500' : 'font-medium text-gray-900'
      }`}
    >
      {value}
    </dd>
  </div>
);

const won = (amount: number): string => `${formatPriceAmount(amount)}원`;
const minus = (amount: number): string => (amount > 0 ? `−${won(amount)}` : '-');

/** 미리보기와 기록값이 갈리는 항목만 뽑는다 — 기록 뒤 환불이 들어오면 여기에 드러난다. */
const DRIFT_FIELDS: Array<{ key: keyof AdminPayoutRecordView & keyof AdminPayoutView; label: string }> = [
  { key: 'grossAmount', label: '모금액' },
  { key: 'refundAmount', label: '환불' },
  { key: 'platformFeeAmount', label: '플랫폼 수수료' },
  { key: 'paymentFeeAmount', label: '결제 수수료' },
  { key: 'withholdingAmount', label: '원천징수' },
  { key: 'netAmount', label: '실이체액' },
  { key: 'backerCount', label: '후원 건수' },
];

export function FundingPayoutSection({
  projectId,
  payout,
  busy,
  onRecord,
  onMarkPaid,
}: {
  projectId: string;
  payout: AdminPayoutView | null;
  busy: boolean;
  onRecord: () => void;
  onMarkPaid: () => void;
}) {
  const [account, setAccount] = useState<RevealedAccount | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(false);

  const revealAccount = async () => {
    setLoadingAccount(true);
    setAccountError(null);
    try {
      const r = await fetch(`/api/admin/funding/projects/${projectId}/payout-account`, {
        credentials: 'same-origin',
      });
      const body = (await r.json()) as { ok: boolean; message?: string; account?: RevealedAccount };
      if (!r.ok || !body.ok || !body.account) {
        setAccountError(body.message ?? '계좌 정보를 읽지 못했습니다.');
      } else {
        setAccount(body.account);
      }
    } catch {
      setAccountError('네트워크 오류');
    }
    setLoadingAccount(false);
  };

  if (!payout) {
    return (
      <div>
        <h2 className="mb-3 text-lg font-bold text-gray-900">정산</h2>
        <p className="text-sm text-gray-500">
          정산 현황을 불러오지 못했습니다. 승인된 프로젝트에서만 정산을 계산합니다.
        </p>
      </div>
    );
  }

  const recorded = payout.recorded;
  // 기록 버튼이 막히는 이유를 전부 적는다 — 버튼만 비활성으로 두면 운영자는 왜 안 되는지
  // 모른 채 새로고침만 반복한다. 서버(`recordFundingPayout`)의 거부 조건과 같은 순서다.
  const blockers: string[] = [];
  if (recorded) blockers.push('이미 기록된 정산입니다. 정산은 프로젝트당 한 번만 기록합니다.');
  if (!payout.closed) {
    blockers.push('모금이 아직 끝나지 않았습니다. 지금 기록하면 이후 들어온 후원이 정산에서 통째로 빠집니다.');
  }
  if (!payout.hasPayoutAccount) {
    blockers.push('개설자의 정산 계좌가 등록되지 않았습니다. 개설자 편집 화면의 정산 정보 구획에서 등록을 요청해 주세요.');
  }
  if (payout.grossAmount <= 0) blockers.push('결제된 후원이 없어 정산할 것이 없습니다.');

  const drift = recorded
    ? DRIFT_FIELDS.filter(({ key }) => recorded[key] !== payout[key])
    : [];

  return (
    <div>
      <h2 className="mb-1 text-lg font-bold text-gray-900">정산</h2>
      <p className="mb-4 text-sm text-gray-500">
        모금이 끝나고 영업일 {FUNDING_PAYOUT_BUSINESS_DAYS}일 뒤에 개설자에게 보냅니다. 플랫폼 수수료{' '}
        {FUNDING_PLATFORM_FEE_PERCENT}%(부가세 포함)와 결제 수수료 {FUNDING_PAYMENT_FEE_PERCENT}%를 결제액(모금액 −
        환불) 기준으로 각각 떼고, 둘 다 개설자가 부담합니다.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-gray-300 bg-white p-4">
          <h3 className="mb-2 text-base font-bold text-gray-900">지금 계산한 값</h3>
          <dl className="divide-y divide-gray-100 text-sm">
            <Row label="모금액" value={won(payout.grossAmount)} />
            <Row label="환불" value={minus(payout.refundAmount)} negative />
            <Row
              label="수기 등록 몫"
              hint="결제 수수료 대상에서 빠집니다"
              value={payout.manualGrossAmount > 0 ? won(payout.manualGrossAmount) : '없음'}
            />
            <Row
              label={`플랫폼 수수료 (${FUNDING_PLATFORM_FEE_PERCENT}%)`}
              value={minus(payout.platformFeeAmount)}
              negative
            />
            <Row
              label={`결제 수수료 (${FUNDING_PAYMENT_FEE_PERCENT}%)`}
              value={minus(payout.paymentFeeAmount)}
              negative
            />
            <Row label={`원천징수 (${FUNDING_WITHHOLDING_PERCENT}%)`} value={minus(payout.withholdingAmount)} negative />
            <Row label="실이체액" value={won(payout.netAmount)} strong />
            <Row label="확정 후원" value={`${payout.backerCount}건`} />
          </dl>
        </div>

        <div className="rounded-lg border border-gray-300 bg-gray-50 p-4">
          <h3 className="mb-2 text-base font-bold text-gray-900">기록된 값</h3>
          {recorded ? (
            <>
              <dl className="divide-y divide-gray-100 text-sm">
                <Row label="모금액" value={won(recorded.grossAmount)} />
                <Row label="환불" value={minus(recorded.refundAmount)} negative />
                <Row
                  label={`플랫폼 수수료 (${FUNDING_PLATFORM_FEE_PERCENT}%)`}
                  value={minus(recorded.platformFeeAmount)}
                  negative
                />
                <Row
                  label={`결제 수수료 (${FUNDING_PAYMENT_FEE_PERCENT}%)`}
                  value={minus(recorded.paymentFeeAmount)}
                  negative
                />
                <Row
                  label={`원천징수 (${FUNDING_WITHHOLDING_PERCENT}%)`}
                  value={minus(recorded.withholdingAmount)}
                  negative
                />
                <Row label="실이체액" value={won(recorded.netAmount)} strong />
                <Row label="확정 후원" value={`${recorded.backerCount}건`} />
              </dl>
              <p className="mt-3 text-sm">
                상태:{' '}
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                    recorded.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {recorded.status === 'paid' ? '지급 완료' : '이체 대기'}
                </span>
                {recorded.paidAt && <span className="ml-2 text-gray-500">{recorded.paidAt.slice(0, 10)}</span>}
              </p>
              {recorded.memo && <p className="mt-1 text-xs text-gray-500">메모: {recorded.memo}</p>}
              {drift.length > 0 && (
                <div role="alert" className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-900">
                  <strong className="block">기록 뒤 숫자가 달라졌습니다 — 대개 뒤늦게 들어온 환불입니다.</strong>
                  <ul className="mt-1 list-inside list-disc">
                    {drift.map(({ key, label }) => (
                      <li key={key}>
                        {label}: 기록 {recorded[key].toLocaleString('ko-KR')} → 지금{' '}
                        {payout[key].toLocaleString('ko-KR')}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1">
                    보낼 금액은 <strong>기록값</strong>입니다. 차액은 따로 정리해야 합니다.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-600">아직 기록하지 않았습니다.</p>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-gray-300 bg-white p-4">
        <h3 className="mb-2 text-base font-bold text-gray-900">입금 계좌</h3>
        <p className="mb-3 text-xs text-gray-500">
          계좌는 이 화면의 데이터에 담겨 있지 않습니다 — 누르면 그때 서버에서 가져오고, 조회 사실이 서버 로그에
          남습니다.
        </p>
        {account ? (
          <dl className="text-sm">
            <Row label="은행" value={account.bankName} />
            <Row label="예금주" value={account.holder} />
            <Row label="계좌번호" value={account.account} />
            <Row
              label="세금 처리"
              value={account.taxType ? TAX_TYPE_LABEL[account.taxType] ?? account.taxType : '미등록'}
            />
          </dl>
        ) : (
          <Button light variant="outline" size="sm" disabled={loadingAccount} onClick={revealAccount}>
            {loadingAccount ? '불러오는 중…' : '계좌 보기'}
          </Button>
        )}
        {accountError && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {accountError}
          </p>
        )}
      </div>

      <div className="mt-4">
        {blockers.length > 0 && !recorded && (
          <ul role="status" className="mb-3 list-inside list-disc rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            {blockers.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {!recorded && (
            <Button light disabled={busy || blockers.length > 0} onClick={onRecord}>
              정산 기록
            </Button>
          )}
          {recorded?.status === 'pending' && (
            <Button light disabled={busy} onClick={onMarkPaid}>
              지급 완료로 표시
            </Button>
          )}
          {recorded?.status === 'paid' && <p className="text-sm text-gray-600">지급 완료로 기록됐습니다. 되돌릴 수 없습니다.</p>}
        </div>
        {!recorded && (
          <p className="mt-2 text-xs text-amber-700">
            결제 수수료율 {FUNDING_PAYMENT_FEE_PERCENT}%는 운영자가 토스 계약서와 대조해 확정해야 하는 가안입니다.
            기록하면 그 시점의 값이 영구히 고정되고, 나중에 요율을 바꿔도 이 기록은 바뀌지 않습니다.
          </p>
        )}
      </div>
    </div>
  );
}
