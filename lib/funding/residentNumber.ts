import { eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { decryptField, FieldCryptoError, FIELD_CRYPTO_KEY_ENV } from '../crypto/fieldCrypto';
import { fundingCreators, fundingProjects } from '../../db/schema';

/**
 * 개설자의 주민등록번호를 **복호화해 돌려준다.**
 *
 * `payoutAccount.ts`와 같은 자리이되 **경로를 따로 둔다.** 계좌는 이체할 때마다 열고,
 * 이 번호는 지급명세서를 낼 때만 연다 — 같은 버튼에 묶으면 계좌만 보려던 조회에서도
 * 번호가 함께 복호화돼 응답에 실린다. 열람 기록도 "무엇을 열었는지"로 갈려야 사후에
 * 의미가 있다 — 개인정보 보호법이 요구하는 접속기록이다.
 *
 * 값은 **응답으로만** 나간다. `getServerSideProps`에서 부르지 마라 — Pages Router가 props를
 * `__NEXT_DATA__` JSON으로 페이지 HTML에 싣는다. 평문은 물론 암호문도 담지 않는다
 * (암호문이 나가면 키가 유일한 방어가 된다).
 *
 * 복호화 실패는 `FieldCryptoError`로 그대로 올린다 — 호출부가 `code`로 운영자에게 할 일을
 * 가려 말해야 한다(키가 없는 것과 값이 안 풀리는 것은 대응이 다르다).
 */
export const loadFundingResidentNumber = async (projectId: string): Promise<string | null> => {
  const [row] = await getDb()
    .select({ enc: fundingCreators.residentNumberEnc })
    .from(fundingProjects)
    .innerJoin(fundingCreators, eq(fundingProjects.creatorId, fundingCreators.id))
    .where(eq(fundingProjects.id, projectId))
    .limit(1);
  const enc = row?.enc?.trim();
  if (!enc) return null;
  return decryptField(enc);
};

/**
 * 위 함수의 **개설자 단위판** — 펀딩 프로젝트 없이 공연·상점으로만 정산받는 개설자의 번호를 열 때 쓴다.
 * 규칙은 같다: 응답으로만 내보내고, 실패는 `FieldCryptoError`로 그대로 올린다.
 */
export const loadCreatorResidentNumber = async (creatorId: string): Promise<string | null> => {
  const [row] = await getDb()
    .select({ enc: fundingCreators.residentNumberEnc })
    .from(fundingCreators)
    .where(eq(fundingCreators.id, creatorId))
    .limit(1);
  const enc = row?.enc?.trim();
  if (!enc) return null;
  return decryptField(enc);
};

/** 번호가 저장돼 있는지만 — 복호화하지 않는다. 화면이 조회 버튼을 보일지 정하는 데 쓴다(값도 암호문도 내보내지 않는다). */
export const hasCreatorResidentNumber = async (creatorId: string): Promise<boolean> => {
  const [row] = await getDb()
    .select({ enc: fundingCreators.residentNumberEnc })
    .from(fundingCreators)
    .where(eq(fundingCreators.id, creatorId))
    .limit(1);
  return Boolean(row?.enc?.trim());
};

/** 복호화 실패 → 운영자가 해야 할 일. 사유마다 다르므로 문구를 가른다. */
export const RESIDENT_NUMBER_CRYPTO_ERROR_MESSAGE: Record<FieldCryptoError['code'], string> = {
  missing_key: `이 환경에 복호화 키(${FIELD_CRYPTO_KEY_ENV})가 없습니다. 값은 그대로 있습니다 — 배포 환경 변수에 키를 등록한 뒤 다시 시도해 주세요.`,
  invalid_key: `복호화 키(${FIELD_CRYPTO_KEY_ENV})의 형식이 맞지 않습니다(base64 32바이트여야 합니다). 값은 그대로 있습니다 — 환경 변수를 고친 뒤 다시 시도해 주세요.`,
  malformed: '저장된 값이 암호화 형식이 아닙니다. 개설자에게 주민등록번호를 다시 등록해 달라고 요청해 주세요.',
  unsupported_version: '저장된 값의 암호화 판본을 이 배포가 모릅니다. 배포 판본을 확인해 주세요 — 값을 지우거나 덮어쓰지 마세요.',
  key_mismatch: `이 값은 지금 이 배포의 키(${FIELD_CRYPTO_KEY_ENV})가 아니라 다른 키로 저장됐습니다. 값은 손상되지 않았습니다 — 저장 당시의 키를 되돌리거나, 키 회전이 중간에 멈춘 것이라면 scripts/rotate-field-key.mjs를 이어서 돌리면 열립니다. 값을 지우거나 덮어쓰지 마세요.`,
  auth_failed: `복호화에 실패했습니다. 키(${FIELD_CRYPTO_KEY_ENV})가 저장 당시와 다르거나 값이 손상됐습니다. 키가 다른 경우는 보통 위의 key_mismatch로 갈리므로(저장 형식 v2는 키 식별자를 함께 싣습니다), 이 코드는 **판본 v1로 저장된 옛 값**이거나 값 자체가 손상된 경우입니다. 다른 개설자의 번호가 정상적으로 열리면 값 손상, 전부 안 열리면 키가 바뀐 것입니다 — 키가 바뀐 경우 옛 키를 되돌려야 하고, 되돌릴 수 없으면 개설자에게 다시 등록을 요청해야 합니다.`,
};
