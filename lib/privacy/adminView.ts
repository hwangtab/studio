import type { GetServerSidePropsContext } from 'next';

import { recordAdminPrivacyAccess, type PrivacyAccessResult } from './accessLog';
import type { PrivacyAccessAction } from './accessLog';

/**
 * 관리자 상세 화면(getServerSideProps)이 열렸다는 사실을 접속기록에 남긴다. 값(이름·연락처 등)은 적지 않고 대상 id와 결과만.
 * 기록이 실패해도 화면은 열려야 하므로 예외를 삼키고 로그만 남긴다(다른 열람 기록 경로와 같은 규약).
 * 인증을 통과한 시도만 부른다 — 없는 대상을 열려 한 것(`not_found`)도 남긴다.
 */
export const logAdminView = async (
  context: Pick<GetServerSidePropsContext, 'req'>,
  actor: string,
  action: PrivacyAccessAction,
  targetId: string,
  result: PrivacyAccessResult,
): Promise<void> => {
  await recordAdminPrivacyAccess(context.req, actor, action, targetId, result).catch((error: unknown) => {
    console.error('[privacy] 접속기록 호출 실패 — 화면은 계속됩니다', error);
  });
};
