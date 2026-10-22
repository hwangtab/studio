import React from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import { AdminShell } from '../../../components/admin/AdminShell';
import { FinanceTabs } from '../../../components/admin/FinanceTabs';
import { Button } from '../../../components/ui/Button';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { Notice } from '../../../components/ui/Notice';
import { lightOnlyField } from '../../../components/ui/adminFieldClass';
import { kstDateString } from '../../../lib/booking/kst';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';

/**
 * 장부 내보내기 — 세무용 CSV 입구를 한 곳에 모은다.
 *
 * 토스 결제 장부 폼은 예전에 대시보드 맨 아래에 있었다(2026-10-22 재무 통합으로 이리로). 이 화면은 DB를 읽지 않는다 —
 * 매출 집계나 현황 조회가 실패해도 CSV는 받을 수 있어야 한다는 대시보드 시절의 의도를 그대로 지킨다.
 */
interface Props {
  /** 이번 달 1일·오늘(KST) — 결제 장부 기본 기간. */
  ledgerFrom: string;
  ledgerTo: string;
  /** 이번 달(KST, YYYY-MM) — 정산 CSV 기본 기간. */
  month: string;
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };
  const today = kstDateString(new Date());
  return { props: { ledgerFrom: `${today.slice(0, 7)}-01`, ledgerTo: today, month: today.slice(0, 7) } };
};

const SECTION = 'rounded-2xl bg-white p-4 shadow-sm md:p-8';

export default function AdminFinanceExportPage({ ledgerFrom, ledgerTo, month }: Props) {
  return (
    <>
      <Head>
        <title>장부 내보내기 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <AdminShell title="재무" description="매출·지출·수익과 세무용 장부를 한 곳에서 봅니다." width="wide">
        <div className="space-y-6">
          <FinanceTabs active="/admin/finance/export" />

          <section className={SECTION}>
            <h2 className="mb-1 text-lg font-bold text-gray-900 dark:text-gray-900">토스 결제 장부</h2>
            <p className="mb-4 text-xs text-gray-500">
              기간 안에 승인된 카드 결제 전부를 한 CSV로 내려받습니다(예약·믹싱·펀딩·구독). 환불은 같은 행에 합산됩니다. 계좌 입금 펀딩과 수기 등록은 펀딩 CSV에,
              직접 받은 매출(수기 매출)은 이 장부에 들어가지 않습니다.
            </p>
            <form method="GET" action="/api/admin/orders/export" className="flex flex-wrap items-end gap-3">
              <Field id="ledger-from" label="시작일" className={lightOnlyField}>
                <TextInput type="date" name="from" defaultValue={ledgerFrom} required light className="text-sm" />
              </Field>
              <Field id="ledger-to" label="종료일" className={lightOnlyField}>
                <TextInput type="date" name="to" defaultValue={ledgerTo} required light className="text-sm" />
              </Field>
              <Button light type="submit" variant="weak">
                CSV 내려받기
              </Button>
            </form>
          </section>

          <section className={SECTION}>
            <h2 className="mb-1 text-lg font-bold text-gray-900 dark:text-gray-900">상점·공연 정산 내역</h2>
            <p className="mb-4 text-xs text-gray-500">
              세무사에게 넘기는 정산 내역입니다(수취인 이름·금액). 달 단위로 한 번에 24개월까지 받을 수 있고, 내려받은 사실은 접속기록에 남습니다.
            </p>
            <form method="GET" action="/api/admin/partner-payouts/export" className="flex flex-wrap items-end gap-3">
              <Field id="payout-kind" label="종류" className={lightOnlyField}>
                <Select name="kind" defaultValue="all" light className="text-sm">
                  <option value="all">상점·공연 전부</option>
                  <option value="shop">상점</option>
                  <option value="show">공연</option>
                </Select>
              </Field>
              <Field id="payout-from" label="시작 달" className={lightOnlyField}>
                <TextInput type="month" name="from" defaultValue={month} required pattern="\d{4}-\d{2}" placeholder="YYYY-MM" light className="text-sm" />
              </Field>
              <Field id="payout-to" label="끝 달" className={lightOnlyField}>
                <TextInput type="month" name="to" defaultValue={month} required pattern="\d{4}-\d{2}" placeholder="YYYY-MM" light className="text-sm" />
              </Field>
              <Button light type="submit" variant="weak">
                CSV 내려받기
              </Button>
            </form>
          </section>

          <Notice tone="neutral" light title="다른 장부">
            펀딩 후원 내역(계좌 입금·수기 등록 포함, 배송지가 실림)은{' '}
            <Link href="/admin/funding" className="font-medium text-primary hover:underline">
              펀딩 화면
            </Link>
            의 CSV로 받습니다. 매출 현황의 결제 내역 옆 링크는 그 화면에서 고른 기간 그대로 같은 장부를 받습니다.
          </Notice>
        </div>
      </AdminShell>
    </>
  );
}
