import { eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingCreators, fundingProjects, type fundingCreatorTaxTypeEnum } from '../../db/schema';

/**
 * 정산 계좌 조회 — **페이지 props가 아닌 별도 경로 전용.**
 *
 * `lib/funding/adminProjects.ts`가 `taxType`·`payoutBankName`·`payoutAccount`·`payoutHolder`를
 * 일부러 빼고 있고 `adminProjects.integration.test.ts`가 그 사실을 고정한다. 이유는 Pages
 * Router가 `getServerSideProps`의 props를 `__NEXT_DATA__` JSON으로 페이지 HTML에 그대로
 * 싣기 때문이다 — 심사 화면을 여는 것만으로 계좌번호가 소스에 평문으로 박힌다.
 *
 * 그래서 계좌는 이 모듈로만 읽고, 운영자가 **버튼을 눌렀을 때** API가 응답으로만 내보낸다
 * (`pages/api/admin/funding/projects/[id]/payout-account.ts`). 이 모듈을
 * `getServerSideProps`에서 부르지 마라 — 그 순간 위 보호가 전부 무효가 된다.
 */
export type FundingCreatorTaxTypeValue = (typeof fundingCreatorTaxTypeEnum)[number];

export interface FundingPayoutAccount {
  bankName: string;
  account: string;
  holder: string;
  /** 승인 전에는 개설자가 정산 구획을 열 수 없어 비어 있을 수 있다. */
  taxType: FundingCreatorTaxTypeValue | null;
}

/** 메일·로그에 실어도 되는 판. 계좌번호는 뒤 4자리까지만 남는다. */
export interface FundingPayoutAccountMasked {
  bankName: string;
  holder: string;
  accountLast4: string | null;
  taxType: FundingCreatorTaxTypeValue | null;
}

/**
 * 계좌번호에서 숫자만 남겨 뒤 4자리. 하이픈 위치가 은행마다 달라 자릿수부터 맞춘다.
 * 개설자 편집 화면 쪽 같은 계산이 `creatorProjectWrite.ts`의 `accountLast4`에 있다 —
 * 그 파일은 개설자 세션 경로, 이 파일은 운영자 경로라 의존을 섞지 않고 각자 둔다.
 */
export const fundingAccountLast4 = (account: string): string | null => {
  const digits = account.replace(/[^0-9]/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
};

const loadRow = async (projectId: string): Promise<FundingPayoutAccount | null> => {
  const [row] = await getDb()
    .select({
      taxType: fundingCreators.taxType,
      bankName: fundingCreators.payoutBankName,
      account: fundingCreators.payoutAccount,
      holder: fundingCreators.payoutHolder,
    })
    .from(fundingProjects)
    .innerJoin(fundingCreators, eq(fundingProjects.creatorId, fundingCreators.id))
    .where(eq(fundingProjects.id, projectId))
    .limit(1);
  if (!row) return null;

  const bankName = row.bankName?.trim() ?? '';
  const account = row.account?.trim() ?? '';
  const holder = row.holder?.trim() ?? '';
  // 셋 중 하나라도 비면 "등록 안 됨"이다 — `buildFundingPayoutPreview`의 `hasPayoutAccount`와
  // 같은 판정이어야 화면의 "등록됨"과 기록 거부(no_payout_account)가 갈리지 않는다.
  if (!bankName || !account || !holder) return null;
  return { bankName, account, holder, taxType: row.taxType ?? null };
};

/** 운영자가 이체하려고 버튼을 눌렀을 때만 부른다. 호출부가 조회 사실을 서버 로그에 남긴다. */
export const loadFundingPayoutAccount = loadRow;

/** 메일에 넣을 판. 계좌번호 전체는 여기서 이미 잘려 나간다. */
export const loadFundingPayoutAccountMasked = async (
  projectId: string,
): Promise<FundingPayoutAccountMasked | null> => {
  const row = await loadRow(projectId);
  if (!row) return null;
  return {
    bankName: row.bankName,
    holder: row.holder,
    accountLast4: fundingAccountLast4(row.account),
    taxType: row.taxType,
  };
};
