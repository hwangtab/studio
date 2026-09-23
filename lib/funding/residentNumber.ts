import { eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { decryptField } from '../crypto/fieldCrypto';
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
