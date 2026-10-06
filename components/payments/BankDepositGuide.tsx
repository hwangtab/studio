import { Notice } from '../ui/Notice';
import { useState } from 'react';

import { Button } from '../ui/Button';
import { formatPriceAmount } from '../../data/pricing';
import { BANK_ACCOUNT, BANK_ACCOUNT_EN, formatKstDeadline } from '../../lib/payments/bankAccount';

const EN_DEADLINE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

/**
 * 계좌 입금 안내 — 결제 공용. 지금은 펀딩 확인 페이지(`pages/[locale]/funding/manage/[orderNo].tsx`)가
 * 입금 대기 중인 계좌 입금 신청에 그리고, 다음 단계에서 공연·예약·믹싱 주문도 같은 컴포넌트를 쓴다.
 * 금액·기한·이름과 "신청하신 분"/"예약하신 분" 같은 호칭은 호출부가 props로 넘긴다.
 *
 * **노년층이 은행 창구·ATM 앞에서 이 화면을 보고 옮겨 적는다**는 것이 설계의 전부다. SAF2026의
 * `BankDepositGuideView`가 쓰는 시각 위계를 그대로 옮겼다 — 계좌번호와 금액은 화면에서 가장 큰
 * 글자(text-3xl → sm:text-4xl, 굵게), 은행·예금주는 그다음(text-xl 굵게), 보내는 분 이름 안내는
 * 2px 강조 테두리 상자(text-lg → sm:text-xl 굵게), 설명 문장도 text-lg. 본문 크기(16px 가는 글씨)로
 * 낮추면 "하나도 안 읽힌다"가 된다(2026-09-21 전광판 사고 — 로직만 옮기고 크기를 놓쳤다).
 *
 * **기한이 지나도 계좌를 숨기지 않는다.** SAF는 카운트다운이 끝나면 계좌를 감췄는데, 거기는 자동
 * 취소가 없는데도 그렇게 해서 늦게 입금하려는 사람이 계좌를 잃었다. 여기는 기한이 안내일 뿐이고
 * 늦은 입금도 운영자가 확인하면 확정되므로(lib/funding/bankAccount.ts) 계좌는 언제나 보인다.
 * 카운트다운도 두지 않는다 — 재촉하는 장치가 된다.
 *
 * 금액은 URL이 아니라 서버가 다시 읽은 값이다(호출부 SSR).
 */
export default function BankDepositGuide({ amount, deadline, customerName, applicantLabel = '신청하신 분', locale = 'ko' }: {
  amount: number;
  /** 안내한 입금 기한(ISO) — 펀딩은 `funding_pledges.hold_expires_at`. */
  deadline: string;
  /** 보내는 분 이름으로 써 달라고 안내할 이름(주문자). */
  customerName: string;
  /** 주문자를 부르는 말 — 펀딩 "신청하신 분", 예약 "예약하신 분", 공연 "예매하신 분" 등. */
  applicantLabel?: string;
  /** 영어 화면(공연 /en)이면 'en'. 화면 구성·크기는 같고 말만 바뀐다. */
  locale?: 'ko' | 'en';
}) {
  const en = locale === 'en';
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(BANK_ACCOUNT.accountNumber);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      // 권한이 없거나(인앱 브라우저) 클립보드 API가 없다 — 숫자를 보고 적으면 된다는 것을 알린다.
      setCopied(false);
      setCopyFailed(true);
    }
  };

  return (
    <section aria-labelledby="deposit-guide-title" className="mt-6">
      <h2 id="deposit-guide-title" className="text-center text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
        {en ? 'Please transfer to the account below' : '아래 계좌로 입금해 주세요'}
      </h2>

      {/* 계좌 — 가장 크게 */}
      <div className="mt-6 rounded-xl bg-gray-100 px-3 py-6 text-center sm:p-6 dark:bg-gray-800">
        <p className="text-lg text-gray-700 dark:text-gray-300">{en ? 'Bank · account holder' : '은행 · 예금주'}</p>
        <p className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
          {en ? `${BANK_ACCOUNT_EN.bankName} (${BANK_ACCOUNT.bankName}) · ${BANK_ACCOUNT_EN.accountHolder}` : `${BANK_ACCOUNT.bankName} · ${BANK_ACCOUNT.accountHolder}`}
        </p>
        <p className="text-lg text-gray-700 dark:text-gray-300">{en ? 'Account number' : '계좌번호'}</p>
        {/*
          계좌번호는 **절대 줄바꿈하지 않는다** — 은행 창구·ATM 앞에서 옮겨 적는 숫자라 "3333-12-" / "5480849"로
          쪼개지면 두 줄을 이어 읽다 틀린다(2026-10-04 예약 확인 카드 안 390px에서 실제로 쪼개졌다). 대신 글자 크기를
          화면 폭에 맞춰 줄인다: 320px 폭의 가장 좁은 자리(예약 카드 안 — 페이지·카드·상자 패딩을 뺀 약 210px)에서도
          한 줄에 들어가는 7vw, 위로는 4xl(36px)에서 멈춘다. 숫자 폭은 tabular-nums로 고정한다.
        */}
        <p data-account-number className="mb-4 whitespace-nowrap font-bold tabular-nums text-gray-900 text-[clamp(1.25rem,7vw,2.25rem)] dark:text-white">
          {BANK_ACCOUNT.accountNumber}
        </p>
        <Button type="button" size="lg" onClick={copy}>
          {en ? (copied ? 'Copied' : 'Copy account number') : copied ? '복사했습니다' : '계좌번호 복사하기'}
        </Button>
        <output aria-live="polite" className="sr-only">{copied ? (en ? 'Account number copied' : '계좌번호를 복사했습니다') : ''}</output>
        {copyFailed && (
          <p role="alert" className="mt-3 text-base text-red-700 dark:text-red-300">
            {en ? 'Could not copy. Please copy the account number above by hand.' : '복사하지 못했습니다. 위 계좌번호를 보고 직접 적어 주세요.'}
          </p>
        )}
      </div>

      {/* 금액 */}
      <div className="mt-6 text-center">
        <p className="text-lg text-gray-700 dark:text-gray-300">{en ? 'Amount to send' : '입금하실 금액'}</p>
        <p className="text-3xl font-bold text-gray-900 sm:text-4xl dark:text-white">{en ? `₩${formatPriceAmount(amount)}` : `${formatPriceAmount(amount)}원`}</p>
      </div>

      {/* 보내는 분 이름 — 가장 눈에 띄게(2px 강조 테두리) */}
      <Notice tone="brand" icon={false} className="mt-6 block text-center">
        <p className="text-lg font-bold text-primary sm:text-xl dark:text-primary-lighter">
          {en ? `Please send the transfer under the name of the ${applicantLabel}.` : `입금하실 때 보내는 분 이름은 ${applicantLabel} 성함으로 해 주세요.`}
        </p>
        <p className="mt-1 text-base text-gray-700 dark:text-gray-300">
          {en ? `We match the transfer by the name “${customerName}” and the amount.` : `${customerName}님 성함과 금액으로 입금을 확인합니다.`}
        </p>
      </Notice>

      {/* 기한 — 안내일 뿐이다(자동 취소 없음). 카운트다운으로 재촉하지 않는다. */}
      <div className="mt-6 text-center">
        <p className="text-lg text-gray-700 dark:text-gray-300">{en ? 'Transfer by' : '입금 기한'}</p>
        <p className="text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
          {en ? `${EN_DEADLINE.format(new Date(deadline))} (KST)` : `${formatKstDeadline(new Date(deadline))}까지(한국시간)`}
        </p>
      </div>

      <p className="mt-6 text-center text-lg text-gray-700 dark:text-gray-300">
        {en ? 'We email you once the transfer is confirmed (within 1 business day).' : '입금이 확인되면 메일로 알려 드립니다(영업일 1일 이내).'}
      </p>
    </section>
  );
}
