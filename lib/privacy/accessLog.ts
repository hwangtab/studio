import { lt } from 'drizzle-orm';

import { getDb } from '../../db/client';
import {
  privacyAccessLogs,
  type privacyAccessActionEnum,
  type privacyAccessResultEnum,
} from '../../db/schema';
import { getClientIp, type IpBearingRequest } from '../contracts/client-ip';

export type PrivacyAccessAction = (typeof privacyAccessActionEnum)[number];
export type PrivacyAccessResult = (typeof privacyAccessResultEnum)[number];

/**
 * 관리자 경로의 **폴백** 수행자 값 — 누구인지 모를 때만 쓴다.
 *
 * 관리자 계정은 이제 사람별로 갈린다(`lib/contracts/admin-accounts.ts`). 가드
 * (`authenticateAdminApi`·`authenticateAdminRequest`)가 성공에 `actor`를 실어 주고,
 * 호출부가 그 값을 그대로 이 표에 적는다. 이 고정값이 남는 자리는 둘뿐이다:
 *
 * 1. `ADMIN_ACCOUNTS`를 설정하지 않은 배포 — 그때는 `ADMIN_PASSWORD` 한 사람이고 id가 `admin`이다.
 * 2. 계정을 나누기 전에 발급된 옛 세션 쿠키(TTL 24시간) — 누구인지 모르는 것이 사실이다.
 *
 * 즉 **`ADMIN_ACCOUNTS`를 쓰지 않으면 여전히 `admin` 하나다.** 판정은
 * `lib/contracts/admin-session.ts`의 `adminSessionIdentity` 한 곳에 있다.
 */
export const PRIVACY_ACTOR_ADMIN = 'admin';

/**
 * 개설자 경로의 수행자 값.
 *
 * 관리자와 달리 개설자는 계정이 사람별로 갈려 있어(`funding_creators`) 누가 받아 갔는지
 * 실제로 특정된다. 기록에 담는 것은 id뿐이다 — 이름·이메일을 여기 적으면 접속기록이
 * 개인정보 사본이 된다.
 */
export const privacyCreatorActor = (creatorId: string): string => `creator:${creatorId}`;

/**
 * 「개인정보의 안전성 확보조치 기준」 제8조① 단서 — 고유식별정보를 처리하는
 * 개인정보처리시스템의 접속기록은 **2년 이상.** 일반 접속기록의 1년과 다른 값이며,
 * 이 표에는 주민등록번호 조회 기록이 섞여 있으므로 표 전체가 긴 쪽을 따른다.
 *
 * 펀딩 개인정보 파기(`lib/funding/retention.ts`, 1년·5년 기준)와 **섞지 마라.**
 * 기준이 다르고, 그쪽 함수가 이 표를 건드리면 법이 요구하는 기간보다 먼저 지워진다.
 */
export const PRIVACY_ACCESS_LOG_RETENTION_YEARS = 2;

export interface PrivacyAccessEntry {
  actor: string;
  action: PrivacyAccessAction;
  targetId: string;
  result: PrivacyAccessResult;
  ip: string | null;
  /**
   * 목록 다운로드가 내보낸 건수. 한 건을 여는 조회에는 없다.
   * **숫자 하나다** — 내보낸 값을 담을 자리는 여기에도 없다.
   */
  rowCount?: number | null;
  at?: Date;
}

/**
 * 접속기록 한 줄을 남긴다.
 *
 * **절대 던지지 않는다.** 기록이 실패했다고 운영자의 조회 자체가 500으로 끊기면, 법을
 * 지키려고 넣은 장치가 업무를 멈추는 장치가 된다. 대신 **조용히 넘어가지도 않는다** —
 * 실패는 서버 로그(console.error)에 남겨 운영자가 알아챌 수 있게 한다. 기록이 안 남고
 * 있는 상태가 곧 법 위반이므로 침묵이 가장 나쁜 선택이다.
 *
 * 인자에 열람한 **값**을 담을 자리는 없다. 그것이 이 함수 시그니처의 요점이다.
 */
export const recordPrivacyAccess = async (entry: PrivacyAccessEntry): Promise<void> => {
  try {
    await getDb()
      .insert(privacyAccessLogs)
      .values({
        actor: entry.actor,
        action: entry.action,
        targetId: entry.targetId,
        result: entry.result,
        rowCount: entry.rowCount ?? null,
        ip: entry.ip,
        at: entry.at ?? new Date(),
      });
  } catch (error: unknown) {
    console.error('[privacy] 접속기록 저장 실패 — 조회는 계속됩니다', {
      action: entry.action,
      targetId: entry.targetId,
      result: entry.result,
      rowCount: entry.rowCount ?? null,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * 관리자 API 라우트에서 쓰는 축약판 — 요청에서 IP를 뽑아 준다.
 *
 * **수행자는 인자로 받는다.** 예전엔 여기서 고정값을 채웠는데, 그러면 라우트가 누구를
 * 인증했는지와 무관하게 전부 `admin`으로 적힌다. 넘길 값은 가드가 돌려준 `auth.actor`다 —
 * 세션에서 온 값이라 라우트가 지어낼 여지가 없다.
 */
export const recordAdminPrivacyAccess = async (
  req: IpBearingRequest,
  actor: string,
  action: PrivacyAccessAction,
  targetId: string,
  result: PrivacyAccessResult,
  rowCount?: number,
): Promise<void> =>
  recordPrivacyAccess({
    actor,
    action,
    targetId,
    result,
    rowCount: rowCount ?? null,
    ip: getClientIp(req),
  });

export interface PrivacyAccessPurgeResult {
  purged: number;
}

/**
 * 보관 기간(2년)이 지난 접속기록을 지운다.
 *
 * 법이 정한 것은 **하한**이라 더 오래 두어도 위법은 아니지만, 접속기록도 개인정보(IP)를
 * 담고 있어 목적을 다한 뒤 남겨 둘 이유가 없다(제21조①). 그래서 하한에 맞춰 지운다.
 */
export const purgeExpiredPrivacyAccessLogs = async (
  now: Date = new Date(),
): Promise<PrivacyAccessPurgeResult> => {
  const boundary = new Date(now);
  boundary.setFullYear(boundary.getFullYear() - PRIVACY_ACCESS_LOG_RETENTION_YEARS);

  const result = await getDb().delete(privacyAccessLogs).where(lt(privacyAccessLogs.at, boundary));
  return { purged: Number(result.rowsAffected ?? 0) };
};
