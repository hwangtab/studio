import { eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingCreators, fundingProjects, type fundingCreatorTaxTypeEnum } from '../../db/schema';
import { FieldCryptoError } from '../crypto/fieldCrypto';
import { decryptPayoutAccount } from './payoutAccountCrypto';

/**
 * 정산 계좌 조회 — **페이지 props가 아닌 별도 경로 전용.**
 *
 * `lib/funding/adminProjects.ts`가 `taxType`·`payoutAccountEnc`·`payoutAccountLast4`를
 * 일부러 빼고 있고 `adminProjects.integration.test.ts`가 그 사실을 고정한다. 이유는 Pages
 * Router가 `getServerSideProps`의 props를 `__NEXT_DATA__` JSON으로 페이지 HTML에 그대로
 * 싣기 때문이다 — 심사 화면을 여는 것만으로 계좌가 소스에 박힌다. **암호문도 담지 않는다:**
 * 담는 순간 키가 유일한 방어가 된다.
 *
 * 그래서 계좌는 이 모듈로만 읽고, 운영자가 **버튼을 눌렀을 때** API가 응답으로만 내보낸다
 * (`pages/api/admin/funding/projects/[id]/payout-account.ts`). 이 모듈을
 * `getServerSideProps`에서 부르지 마라 — 그 순간 위 보호가 전부 무효가 된다.
 *
 * DB에 있는 것은 세 값을 한 벌로 싼 암호문 하나(`payout_account_enc`)와 뒤 4자리 평문이다.
 * 여기서 여는 것이 그 암호문이고, 실패는 `FieldCryptoError`로 그대로 올린다 — 호출부가
 * `code`로 "키가 없다"와 "값이 안 열린다"를 갈라 운영자에게 할 일을 말해야 한다.
 */
export type FundingCreatorTaxTypeValue = (typeof fundingCreatorTaxTypeEnum)[number];

export interface FundingPayoutAccount {
  bankName: string;
  account: string;
  holder: string;
  /** 승인 전에는 개설자가 정산 구획을 열 수 없어 비어 있을 수 있다. */
  taxType: FundingCreatorTaxTypeValue | null;
}

/**
 * 메일·로그에 실어도 되는 판. 계좌번호는 뒤 4자리까지만 남는다.
 *
 * 은행명·예금주가 `null`일 수 있는 이유: 그 둘도 암호문 안에 있어 **키가 있어야 읽힌다.**
 * 키가 없거나 값이 안 열리면 메일을 못 보내는 것이 아니라 그 두 칸만 비운다 — 이 판을 쓰는
 * 곳은 이미 기록된 정산을 알리는 메일이라, 여기서 던지면 개설자가 아무 통지도 못 받는다.
 */
export interface FundingPayoutAccountMasked {
  bankName: string | null;
  holder: string | null;
  accountLast4: string | null;
  taxType: FundingCreatorTaxTypeValue | null;
}

interface PayoutAccountRow {
  taxType: FundingCreatorTaxTypeValue | null;
  enc: string;
  last4: string | null;
}

/**
 * 프로젝트의 개설자 행에서 정산 계좌 암호문을 읽는다. **복호화하지 않는다.**
 * 암호문이 없으면(등록 전) null — `buildFundingPayoutPreview`의 `hasPayoutAccount`,
 * 개설자 화면의 `loadPayoutSummary`와 같은 판정이어야 셋이 갈리지 않는다.
 */
const loadEncryptedRow = async (projectId: string): Promise<PayoutAccountRow | null> => {
  const [row] = await getDb()
    .select({
      taxType: fundingCreators.taxType,
      enc: fundingCreators.payoutAccountEnc,
      last4: fundingCreators.payoutAccountLast4,
    })
    .from(fundingProjects)
    .innerJoin(fundingCreators, eq(fundingProjects.creatorId, fundingCreators.id))
    .where(eq(fundingProjects.id, projectId))
    .limit(1);
  if (!row) return null;

  const enc = row.enc?.trim() ?? '';
  if (!enc) return null;
  return { taxType: row.taxType ?? null, enc, last4: row.last4?.trim() || null };
};

/**
 * 운영자가 이체하려고 버튼을 눌렀을 때만 부른다. 호출부가 조회 사실을 접속기록에 남긴다.
 * 복호화 실패는 `FieldCryptoError`로 던진다 — 등록이 없는 것(null)과 못 여는 것은 다른 일이고,
 * 운영자가 할 일도 다르다.
 */
export const loadFundingPayoutAccount = async (projectId: string): Promise<FundingPayoutAccount | null> => {
  const row = await loadEncryptedRow(projectId);
  if (!row) return null;
  const fields = decryptPayoutAccount(row.enc);
  return { ...fields, taxType: row.taxType };
};

/**
 * 메일에 넣을 판. 계좌번호 전체는 여기서 이미 잘려 나간다.
 *
 * 뒤 4자리는 평문 컬럼에서 오므로 키가 없어도 나온다. 은행명·예금주는 복호화가 필요한데,
 * 실패해도 **던지지 않고 null로 비운다** — 이 함수를 부르는 곳은 이미 기록된 정산을 알리는
 * 메일이고, 여기서 던지면 메일 자체가 나가지 않는다. 대신 사유 코드를 서버 로그에 남긴다.
 * (정산 기록 자체는 계좌를 열 수 있을 때만 되므로 이 갈래는 그 뒤에 키가 바뀐 경우다.)
 */
export const loadFundingPayoutAccountMasked = async (
  projectId: string,
): Promise<FundingPayoutAccountMasked | null> => {
  const row = await loadEncryptedRow(projectId);
  if (!row) return null;

  try {
    const fields = decryptPayoutAccount(row.enc);
    return { bankName: fields.bankName, holder: fields.holder, accountLast4: row.last4, taxType: row.taxType };
  } catch (error: unknown) {
    console.error('[funding] 정산 계좌 복호화 실패 — 메일에는 뒤 4자리만 적습니다', {
      projectId,
      code: error instanceof FieldCryptoError ? error.code : 'unknown',
    });
    return { bankName: null, holder: null, accountLast4: row.last4, taxType: row.taxType };
  }
};

/**
 * 이 프로젝트가 **승인된** 것인가 — 계좌·주민등록번호 조회 API가 열기 전에 보는 선.
 *
 * 승인 전에는 정산할 일이 없고, 그래서 개설자도 정산 구획을 열 수 없다(스펙 §6.2). 그런데
 * 조회 API는 프로젝트 id만 보고 개설자 행을 되짚었기 때문에, **초안 id로도** 그 개설자의
 * 계좌·주민등록번호가 열렸다 — 접속기록의 `targetId`도 초안 id로 남아 사후에 "무엇에 대한
 * 조회였는지"가 어긋난다. 여기서 막고 404로 답한다.
 *
 * 공유 로더(`loadFundingPayoutAccount`·`loadFundingResidentNumber`)에 조건을 넣지 않은 이유:
 * 정산 기록 직전의 복호화 점검과 정산 안내 메일도 그 로더를 지나는데, 그쪽은 이미
 * 다른 게이트(마감·기록 여부)를 통과한 자리라 여기서 코드가 바뀌면 오류 문구만 헷갈려진다.
 */
export const isApprovedFundingProject = async (projectId: string): Promise<boolean> => {
  const [row] = await getDb()
    .select({ reviewStatus: fundingProjects.reviewStatus })
    .from(fundingProjects)
    .where(eq(fundingProjects.id, projectId))
    .limit(1);
  return row?.reviewStatus === 'approved';
};
