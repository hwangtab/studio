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
 * **계좌 정보(`payout_account_enc`의 은행명·계좌번호·예금주)와 세금 처리 구분(`taxType`)은
 * 여기 없다 — 암호문도 넣지 않는다.** 이 값은 `getServerSideProps` props로 나가고 Pages
 * Router는 props를 `__NEXT_DATA__` JSON으로 페이지 HTML에 그대로 싣는다 — 심사 화면을 여는
 * 것만으로 계좌가 소스에 박히고, 암호문이 박히면 키가 유일한 방어가 된다. 계좌는 운영자가 버튼을 눌렀을 때만 별도 라우트
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
  /** 세금 처리 구분이 등록돼 있는가. 구분 자체(개인/사업자)는 계좌와 함께 별도 라우트로만 나간다. */
  hasTaxType: boolean;
  /**
   * 원천징수 대상인데 주민등록번호가 등록되지 않았는가. 값도 등록 여부도 아니고 **게이트
   * 판정 하나**다 — 서버의 `no_resident_number`와 같은 식이다. 번호 자체는 운영자가 버튼을
   * 눌렀을 때만 별도 라우트로 가져와 이 컴포넌트의 state에만 둔다.
   */
  needsResidentNumber: boolean;
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
  const [residentNumber, setResidentNumber] = useState<string | null>(null);
  const [residentNumberError, setResidentNumberError] = useState<string | null>(null);
  const [loadingResidentNumber, setLoadingResidentNumber] = useState(false);

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

  /**
   * 주민등록번호는 **계좌와 다른 버튼**이다. 계좌는 이체할 때마다, 이 번호는 지급명세서를
   * 낼 때만 연다 — 한 버튼에 묶으면 계좌만 보려던 조회에서도 번호가 복호화돼 응답에 실린다.
   * 서버가 조회 사실을 따로 기록한다.
   */
  const revealResidentNumber = async () => {
    setLoadingResidentNumber(true);
    setResidentNumberError(null);
    try {
      const r = await fetch(`/api/admin/funding/projects/${projectId}/resident-number`, {
        credentials: 'same-origin',
      });
      const body = (await r.json()) as { ok: boolean; message?: string; residentNumber?: string };
      if (!r.ok || !body.ok || !body.residentNumber) {
        setResidentNumberError(body.message ?? '주민등록번호를 읽지 못했습니다.');
      } else {
        setResidentNumber(body.residentNumber);
      }
    } catch {
      setResidentNumberError('네트워크 오류');
    }
    setLoadingResidentNumber(false);
  };

  if (!payout) {
    return (
      <div>
        <h2 className="mb-3 text-lg font-bold text-gray-900">정산</h2>
        {/*
          이 구획은 승인된 프로젝트에서만 렌더된다(`pages/admin/funding/projects/[id].tsx`).
          그래서 payout이 null인 경우는 하나뿐이다 — 집계 질의가 실패했다. 승인 여부를
          이유로 대면 운영자는 멀쩡한 프로젝트를 의심하며 심사 상태만 다시 들여다본다.

          실패 이유 중 하나는 영구적이다: 정산 컬럼을 넣는 마이그레이션(0021)이 운영 DB에
          아직 적용되지 않았으면 `buildFundingPayoutPreview`가 매번 같은 자리에서 던진다.
          "잠시 뒤 새로고침"만 적으면 운영자는 영원히 새로고침만 한다.
        */}
        <p className="text-sm text-gray-500">
          정산 현황을 불러오지 못했습니다. 잠시 뒤 새로고침해 주세요 — 계속 같다면 서버 로그에 집계
          실패 이유가 남아 있습니다. 정산 마이그레이션(0021)이 운영 DB에 아직 적용되지 않았을 수도
          있습니다. 다른 조작(판정·메모·공개 상태)은 그대로 쓸 수 있습니다.
        </p>
      </div>
    );
  }

  const recorded = payout.recorded;
  // 기록 버튼이 막히는 이유를 전부 적는다 — 버튼만 비활성으로 두면 운영자는 왜 안 되는지
  // 모른 채 새로고침만 반복한다. 서버(`recordFundingPayout`)의 거부 조건과 같은 순서다.
  //
  // 목록 자체가 `!recorded`일 때만 뜨므로 "이미 기록됐다"는 항목은 두지 않는다 — 기록 뒤에는
  // 기록 버튼이 사라지고 지급 버튼이 대신 뜬다.
  const blockers: string[] = [];
  if (!payout.closed) {
    blockers.push('모금이 아직 끝나지 않았습니다. 지금 기록하면 이후 들어온 후원이 정산에서 통째로 빠집니다.');
  }
  if (!payout.hasPayoutAccount) {
    blockers.push('개설자의 정산 계좌가 등록되지 않았습니다. 개설자 편집 화면의 정산 정보 구획에서 등록을 요청해 주세요.');
  }
  if (!payout.hasTaxType) {
    blockers.push(
      '개설자의 세금 처리 구분(개인 원천징수 / 사업자 세금계산서)이 등록되지 않았습니다. 추측해서 기록하면 실이체액이 틀리고 기록은 되돌릴 수 없습니다 — 개설자에게 정산 정보 저장을 요청해 주세요.',
    );
  }
  if (payout.needsResidentNumber) {
    blockers.push(
      '개설자가 원천징수 대상인데 주민등록번호가 등록되지 않았습니다. 지금 기록하면 세액만 떼고 지급명세서를 낼 수 없습니다 — 개설자에게 정산 정보 구획에서 등록을 요청해 주세요.',
    );
  }
  if (payout.grossAmount <= 0) blockers.push('결제된 후원이 없어 정산할 것이 없습니다.');

  const drift = recorded
    ? DRIFT_FIELDS.filter(({ key }) => recorded[key] !== payout[key])
    : [];

  return (
    <div>
      <h2 className="mb-1 text-lg font-bold text-gray-900">정산</h2>
      <p className="mb-4 text-sm text-gray-500">
        모금이 끝나고 영업일 {FUNDING_PAYOUT_BUSINESS_DAYS}일 이내에 개설자에게 보냅니다. 플랫폼 수수료{' '}
        {FUNDING_PLATFORM_FEE_PERCENT}%(부가세 포함)와 결제 수수료 {FUNDING_PAYMENT_FEE_PERCENT}%를 결제액(모금액 −
        환불) 기준으로 각각 떼고, 둘 다 개설자가 부담합니다. 다만 수기 등록분은 결제를 지나지 않았으므로
        결제 수수료 대상에서 빠집니다 — 그만큼 아래 결제 수수료가 {FUNDING_PAYMENT_FEE_PERCENT}%보다 적게 나옵니다.
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
            {/*
              결제 수수료 라벨에는 요율을 적지 않는다. 수기 등록분은 토스를 지나지 않아
              과세표준에서 빠지므로(`computeFundingPayoutForProject`), 요율을 적어 두면
              모금 100만 중 수기 20만일 때 라벨은 3.3%인데 값은 26,400원이라 눈으로 계산한
              33,000원과 어긋난다. 요율은 구획 상단 안내문이 예외와 함께 적는다.
            */}
            <Row label="결제 수수료" value={minus(payout.paymentFeeAmount)} negative />
            <Row
              label={`원천징수 (${FUNDING_WITHHOLDING_PERCENT}%)`}
              hint={payout.hasTaxType ? undefined : '세금 처리 구분이 없어 원천징수로 가정한 값입니다'}
              value={minus(payout.withholdingAmount)}
              negative
            />
            <Row label="실이체액" value={won(payout.netAmount)} strong />
            <Row label="확정 후원" value={`${payout.backerCount}건`} />
          </dl>
        </div>

        <div className="rounded-lg border border-gray-300 bg-gray-50 p-4">
          <h3 className="mb-2 text-base font-bold text-gray-900">기록된 값</h3>
          {recorded ? (
            <>
              {/*
                기록 행에는 요율 컬럼이 없다 — `funding_project_payouts`는 금액만 고정한다.
                그래서 여기 라벨에 현재 상수(`FUNDING_*_PERCENT`)를 붙이면, 운영자가 토스
                계약서로 결제 수수료율을 확정해 상수를 바꾸는 순간 옛 기록이 "결제 수수료
                (2.9%) −34,000원"처럼 서로 안 맞는 두 숫자를 나란히 띄운다. 검산하라고 만든
                패널이 검산을 못 하게 되므로, 기록 쪽 라벨에는 요율을 적지 않는다.
              */}
              <dl className="divide-y divide-gray-100 text-sm">
                <Row label="모금액" value={won(recorded.grossAmount)} />
                <Row label="환불" value={minus(recorded.refundAmount)} negative />
                <Row label="플랫폼 수수료" value={minus(recorded.platformFeeAmount)} negative />
                <Row label="결제 수수료" value={minus(recorded.paymentFeeAmount)} negative />
                <Row label="원천징수" value={minus(recorded.withholdingAmount)} negative />
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

      {/*
        주민등록번호 — 원천징수 신고(지급명세서)에 쓴다. 계좌와 한 버튼으로 묶지 않는다:
        여는 목적과 빈도가 다르고, 열람 기록도 무엇을 열었는지로 갈려야 사후에 의미가 있다.
      */}
      <div className="mt-4 rounded-lg border border-gray-300 bg-white p-4">
        <h3 className="mb-2 text-base font-bold text-gray-900">주민등록번호 (원천징수 신고용)</h3>
        <p className="mb-3 text-xs text-gray-500">
          암호화해 저장돼 있습니다. 이 화면의 데이터에는 담겨 있지 않고, 누르면 그때 복호화해 가져오며 조회
          사실이 서버 로그에 남습니다. 지급명세서를 낼 때만 열어 주세요.
        </p>
        {residentNumber ? (
          /*
            한 번 연 번호를 **다시 가릴 수 있어야 한다.** 심사 상세는 운영자가 탭을 띄워 둔 채
            다른 일을 하는 화면이라, 되돌릴 경로가 없으면 새로고침·이탈 전까지 13자리가 DOM에
            남아 화면 공유·스크린샷·자리 비움이 그대로 노출이 된다. 가리는 것은 이 컴포넌트의
            state뿐이고 라우트·열람 기록은 그대로다 — 다시 누르면 다시 조회하고 그 사실이 또
            기록된다. 계좌는 손대지 않는다(고유식별정보만 이 규칙을 받는다).
          */
          <div className="flex flex-wrap items-center gap-3">
            <dl className="text-sm">
              <Row label="주민등록번호" value={residentNumber} />
            </dl>
            <Button light variant="outline" size="sm" onClick={() => setResidentNumber(null)}>
              가리기
            </Button>
          </div>
        ) : (
          <Button light variant="outline" size="sm" disabled={loadingResidentNumber} onClick={revealResidentNumber}>
            {loadingResidentNumber ? '불러오는 중…' : '주민등록번호 보기'}
          </Button>
        )}
        {residentNumberError && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {residentNumberError}
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
            기록하면 지금 요율(플랫폼 {FUNDING_PLATFORM_FEE_PERCENT}% · 결제 {FUNDING_PAYMENT_FEE_PERCENT}%)로 계산한
            금액이 영구히 고정됩니다. 나중에 요율을 바꿔도 이 기록은 바뀌지 않고, 되돌릴 경로도 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}
