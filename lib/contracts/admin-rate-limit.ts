import { createHash } from 'crypto';
import { eq, inArray, lte, sql } from 'drizzle-orm';
import type { NextApiRequest } from 'next';

import { getDb } from '../../db/client';
import { getClientIp } from './client-ip';
import { rateLimits } from '../../db/schema';

/** 관리자 비밀번호는 하나뿐이라 무차별 대입에 특히 취약하다. 창을 좁게 잡는다. */
const LIMIT = 10;
const WINDOW_SECONDS = 10 * 60;

/**
 * 출처와 무관한 전역 상한.
 *
 * 주체별 제한만 두면 프록시 풀로 IP를 돌리는 순간 사실상 사라진다. IP당 10회여도
 * 주소를 100개 쓰면 1,000회고, 그 뒤에 있는 것은 계약 전건의 이름·생년월일·연락처·
 * 주소·서명 이미지다(로그인 성공 시 /api/contracts GET 한 번이면 끝난다).
 *
 * 이 사이트의 관리자는 한 사람이다. 한 시간에 100번 로그인할 일이 없으므로 상한이
 * 정당한 사용을 방해하지 않는다. 반대로 대입 공격은 IP를 아무리 늘려도 이 벽을
 * 넘지 못한다.
 *
 * 상한에 걸려도 비밀번호라는 방어선은 그대로다 — 여기서 막는 것은 "시도 횟수"지
 * "정당한 로그인"이 아니다. 창이 지나면 자동으로 풀린다.
 */
const GLOBAL_KEY = 'admin_login:global';
const GLOBAL_LIMIT = 100;
const GLOBAL_WINDOW_SECONDS = 60 * 60;

interface MemoryEntry {
  count: number;
  expiresAt: number;
}

const memoryStore = new Map<string, MemoryEntry>();

const getSubjectKey = (req: NextApiRequest): string => {
  // 위조 가능한 헤더를 기준으로 세면 제한이 무의미하다 — 판정은 client-ip 한 곳에 둔다.
  const ip = getClientIp(req);

  if (ip) return `admin_login:ip:${ip}`;

  // IP를 못 얻으면 요청 지문으로 대체한다 — 없는 것보다는 낫다.
  const fingerprint = createHash('sha256')
    .update(String(req.headers['user-agent'] || ''))
    .update(String(req.headers['accept-language'] || ''))
    .digest('hex')
    .slice(0, 24);
  return `admin_login:fp:${fingerprint}`;
};

/** DB에 닿지 못할 때만 쓰는 인스턴스 로컬 폴백. */
const checkInMemory = (
  key: string,
  nowSeconds: number,
  limit: number = LIMIT,
  windowSeconds: number = WINDOW_SECONDS,
): boolean => {
  for (const [storedKey, entry] of memoryStore.entries()) {
    if (entry.expiresAt <= nowSeconds) memoryStore.delete(storedKey);
  }

  const existing = memoryStore.get(key);
  if (!existing || existing.expiresAt <= nowSeconds) {
    memoryStore.set(key, { count: 1, expiresAt: nowSeconds + windowSeconds });
    return true;
  }

  existing.count += 1;
  return existing.count <= limit;
};

const bumpCounter = async (
  key: string,
  windowSeconds: number,
  nowSeconds: number,
): Promise<number> => {
  const [row] = await getDb()
    .insert(rateLimits)
    .values({ key, count: 1, expiresAt: nowSeconds + windowSeconds })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning();

  return row?.count ?? 1;
};

/**
 * 관리자 로그인 시도 제한.
 *
 * ## 왜 "확인→(실패 시)기록" 두 단계인가
 *
 * 예전에는 비밀번호를 대조하기 전에 subject·global 카운터를 무조건 올리고, global이 상한을
 * 넘으면 거부했다. 그러면 비밀번호를 모르는 공격자가 아무 요청이나 101번 보내는 것만으로
 * global을 채워, **정확한 비밀번호를 가진 운영자까지 한 시간 봉쇄**할 수 있었다. 전역 상한이
 * 정당한 사용을 지키려던 것이 공격 상황에서 정확히 그 반대가 됐다.
 *
 * 그래서 전역 상한은 **비밀번호가 틀렸을 때만** 오른다(recordAdminLoginFailure). 라우트는
 *   1) isAdminLoginThrottled(req)로 이 IP가 이미 한도를 넘겼는지만 읽고(전역은 안 본다),
 *   2) 비밀번호를 대조해서
 *   3) 맞으면 resetAdminLoginRateLimit로 subject·global을 모두 지운다,
 *   4) 틀리면 recordAdminLoginFailure로 둘 다 올린다.
 * 이 순서라서 **올바른 비밀번호는 전역 상한과 무관하게 항상 통과**한다 — 운영자는 공격
 * 중에도 잠기지 않는다. IP 회전 공격은 각 IP가 subject 창에 막히고, 그래도 새는 시도는
 * 전역 실패 카운터가 세어 상한을 넘긴 뒤의 오답에 429를 준다.
 *
 * 카운터는 Turso에 두어 인스턴스 간 공유하고, DB 장애 시에만 인스턴스 로컬로 폴백한다.
 */

/** 이 IP(subject)가 이미 창 한도를 넘겼는지 읽기만 한다 — 카운터를 올리지 않는다. */
export const isAdminLoginThrottled = async (req: NextApiRequest): Promise<boolean> => {
  const key = getSubjectKey(req);
  const nowSeconds = Math.floor(Date.now() / 1000);

  try {
    const [row] = await getDb()
      .select({ count: rateLimits.count, expiresAt: rateLimits.expiresAt })
      .from(rateLimits)
      .where(eq(rateLimits.key, key));

    if (!row || row.expiresAt <= nowSeconds) return false;
    return row.count >= LIMIT;
  } catch (error: unknown) {
    console.error('[admin-rate-limit] Throttle check unavailable, allowing:', error);
    // 셀 수 없다는 이유로 정당한 로그인을 막지 않는다(비밀번호가 방어선으로 남는다).
    return false;
  }
};

/**
 * 비밀번호가 틀렸을 때만 부른다. subject·global 카운터를 올리고, 전역 상한 초과 여부를 반환한다.
 * 반환된 globalExceeded가 true면 라우트는 오답에 401 대신 429를 준다(회전 공격 신호).
 */
export const recordAdminLoginFailure = async (
  req: NextApiRequest,
): Promise<{ globalExceeded: boolean }> => {
  const key = getSubjectKey(req);
  const nowSeconds = Math.floor(Date.now() / 1000);

  try {
    await getDb().delete(rateLimits).where(lte(rateLimits.expiresAt, nowSeconds));
    await bumpCounter(key, WINDOW_SECONDS, nowSeconds);
    const globalCount = await bumpCounter(GLOBAL_KEY, GLOBAL_WINDOW_SECONDS, nowSeconds);

    if (globalCount > GLOBAL_LIMIT) {
      console.error(
        `[admin-rate-limit] 전역 실패 상한 초과 (${globalCount}/${GLOBAL_LIMIT}, ` +
          `${GLOBAL_WINDOW_SECONDS / 60}분 창). IP 회전 대입일 수 있다.`,
      );
      return { globalExceeded: true };
    }
    return { globalExceeded: false };
  } catch (error: unknown) {
    console.error('[admin-rate-limit] Falling back to in-memory counter:', error);
    checkInMemory(key, nowSeconds);
    const globalOk = checkInMemory(GLOBAL_KEY, nowSeconds, GLOBAL_LIMIT, GLOBAL_WINDOW_SECONDS);
    return { globalExceeded: !globalOk };
  }
};

/**
 * 서명 본인 확인 시도 제한.
 *
 * 뒷자리는 네 자리뿐이라 제한이 없으면 링크를 아는 사람이 전부 대입해 볼 수 있다. 다만
 * 오타로 정당한 고객이 막히면 계약이 멈추므로, 창을 짧게 두고 횟수는 넉넉히 잡는다.
 */
const IDENTITY_LIMIT = 10;
const IDENTITY_WINDOW_SECONDS = 15 * 60;

/**
 * 계약 하나에 대한 누적 상한.
 *
 * 창 단위 제한만으로는 부족하다. 15분에 10회라도 링크 유효기간이 7일이면 6,700번을
 * 시도할 수 있고, 그것은 네 자리 조합 1만 개의 3분의 2다. 기다릴 줄 아는 공격자에게는
 * 창 제한이 속도만 늦출 뿐 벽이 되지 못한다.
 *
 * 자기 연락처 뒷자리를 스무 번 넘게 틀리는 당사자는 사실상 없다. 상한에 걸리면 관리자가
 * 재발송해야 풀린다 — 잠긴 사람이 정말 당사자라면 연락이 올 것이고, 그때 사람이 판단하는
 * 편이 네 자리 대조보다 확실하다.
 *
 * 만료를 링크 유효기간보다 길게 잡는 이유: 만료가 짧으면 그만큼 기다렸다 다시 시작하는
 * 것으로 상한이 무력해진다.
 */
const IDENTITY_TOTAL_LIMIT = 20;
const IDENTITY_TOTAL_WINDOW_SECONDS = 60 * 24 * 60 * 60;

const identityWindowKey = (contractId: string) => `sign_identity:${contractId}`;
const identityTotalKey = (contractId: string) => `sign_identity_total:${contractId}`;

export type IdentityAttemptVerdict =
  /** 확인을 진행해도 된다 */
  | 'ok'
  /** 잠시 뒤 다시 시도하면 된다 */
  | 'throttled'
  /** 누적 상한을 넘었다 — 재발송해야 풀린다 */
  | 'locked';

export const checkIdentityAttempt = async (contractId: string): Promise<IdentityAttemptVerdict> => {
  const nowSeconds = Math.floor(Date.now() / 1000);

  try {
    await getDb().delete(rateLimits).where(lte(rateLimits.expiresAt, nowSeconds));

    const [windowRows, totalRows] = await getDb().batch([
      getDb()
        .insert(rateLimits)
        .values({
          key: identityWindowKey(contractId),
          count: 1,
          expiresAt: nowSeconds + IDENTITY_WINDOW_SECONDS,
        })
        .onConflictDoUpdate({ target: rateLimits.key, set: { count: sql`${rateLimits.count} + 1` } })
        .returning(),
      getDb()
        .insert(rateLimits)
        .values({
          key: identityTotalKey(contractId),
          count: 1,
          expiresAt: nowSeconds + IDENTITY_TOTAL_WINDOW_SECONDS,
        })
        .onConflictDoUpdate({ target: rateLimits.key, set: { count: sql`${rateLimits.count} + 1` } })
        .returning(),
    ]);

    if ((totalRows[0]?.count ?? 1) > IDENTITY_TOTAL_LIMIT) return 'locked';
    if ((windowRows[0]?.count ?? 1) > IDENTITY_LIMIT) return 'throttled';
    return 'ok';
  } catch (error: unknown) {
    console.error('[admin-rate-limit] Identity attempt limit unavailable:', error);
    // 셀 수 없다는 이유로 정당한 서명을 막지는 않는다. 뒷자리 대조 자체는 그대로 남는다.
    return 'ok';
  }
};

/**
 * 계약서 재발급 제한.
 *
 * 보관본이 없으면 Chromium을 띄워 다시 만들어야 해서, 토큰을 아는 쪽이 반복 요청하면
 * 부담이 된다. 정상적인 이용자가 몇 번 다시 받는 것은 막지 않을 만큼만 허용한다.
 */
const DOWNLOAD_LIMIT = 10;
const DOWNLOAD_WINDOW_SECONDS = 10 * 60;

export const checkDownloadRateLimit = async (contractId: string): Promise<boolean> => {
  const key = `contract_download:${contractId}`;
  const nowSeconds = Math.floor(Date.now() / 1000);

  try {
    await getDb().delete(rateLimits).where(lte(rateLimits.expiresAt, nowSeconds));

    const [row] = await getDb()
      .insert(rateLimits)
      .values({ key, count: 1, expiresAt: nowSeconds + DOWNLOAD_WINDOW_SECONDS })
      .onConflictDoUpdate({ target: rateLimits.key, set: { count: sql`${rateLimits.count} + 1` } })
      .returning();

    return (row?.count ?? 1) <= DOWNLOAD_LIMIT;
  } catch (error: unknown) {
    console.error('[admin-rate-limit] Download limit unavailable:', error);
    // 셀 수 없다는 이유로 계약 당사자가 자기 계약서를 못 받게 하지는 않는다.
    return true;
  }
};

/**
 * 계약서 재발급 시 본인 확인 시도 제한.
 *
 * 서명용 카운터(checkIdentityAttempt)를 재사용하지 않는다. 그쪽은 20회 누적이면
 * 관리자가 재발송해야 풀리는 영구 잠금이라, 다운로드 시도가 서명 예산을 갉아먹으면
 * 정작 서명해야 할 때 잠겨 있게 된다.
 *
 * ## 카운트는 "실제로 틀린 뒷자리"에만 한다 (핵심)
 *
 * 예전에는 대조 전에 무조건 카운터를 올렸다. 그러면 링크를 얻은 제3자가 빈 본문으로
 * 101번만 찔러도 당사자가 잠긴다 — 뒷자리를 하나도 안 맞혀도 된다. 이건 이 함수가
 * 막으려던 것("제3자가 아무 숫자나 넣어 당사자를 막는다")을 오히려 열어 준 꼴이었다.
 *
 * 그래서 확인(getDownloadIdentityVerdict, 읽기 전용)과 기록(recordDownloadIdentityFailure,
 * 증가)을 나눈다. 라우트는 먼저 잠김 여부만 읽고, 뒷자리가 실제로 틀렸을 때만(malformed·
 * 빈 요청은 제외) 실패를 기록한다. 이제 상한에 도달하려면 형식이 맞는 네 자리 오답을
 * 실제로 그 횟수만큼 넣어야 한다 = 진짜 대입이다.
 *
 * 누적 창은 24시간으로 짧게 잡아 자동으로 풀리게 한다(예전 30일은 사실상 영구였다).
 * 그래도 안 풀리면 재발송이 해제 수단이다(resetIdentityAttempts가 이 키도 지운다).
 */
const DOWNLOAD_IDENTITY_LIMIT = 10;
const DOWNLOAD_IDENTITY_WINDOW_SECONDS = 15 * 60;
const DOWNLOAD_IDENTITY_TOTAL_LIMIT = 100;
const DOWNLOAD_IDENTITY_TOTAL_WINDOW_SECONDS = 24 * 60 * 60;

const downloadIdentityWindowKey = (contractId: string) => `download_identity:${contractId}`;
const downloadIdentityTotalKey = (contractId: string) => `download_identity_total:${contractId}`;

/**
 * 지금 잠겨 있는지 읽기만 한다 — 카운터를 올리지 않는다.
 *
 * 라우트는 대조 전에 이걸 먼저 불러 이미 상한을 넘긴 요청을 무거운 대조·렌더 전에 끊는다.
 */
export const getDownloadIdentityVerdict = async (
  contractId: string,
): Promise<IdentityAttemptVerdict> => {
  const nowSeconds = Math.floor(Date.now() / 1000);

  try {
    const rows = await getDb()
      .select({ key: rateLimits.key, count: rateLimits.count, expiresAt: rateLimits.expiresAt })
      .from(rateLimits)
      .where(
        inArray(rateLimits.key, [
          downloadIdentityWindowKey(contractId),
          downloadIdentityTotalKey(contractId),
        ]),
      );

    const live = (key: string) => {
      const row = rows.find((r) => r.key === key);
      return row && row.expiresAt > nowSeconds ? row.count : 0;
    };

    if (live(downloadIdentityTotalKey(contractId)) >= DOWNLOAD_IDENTITY_TOTAL_LIMIT) return 'locked';
    if (live(downloadIdentityWindowKey(contractId)) >= DOWNLOAD_IDENTITY_LIMIT) return 'throttled';
    return 'ok';
  } catch (error: unknown) {
    console.error('[admin-rate-limit] Download identity verdict unavailable:', error);
    // 셀 수 없다는 이유로 당사자의 재발급을 막지는 않는다. 뒷자리 대조는 그대로 남는다.
    return 'ok';
  }
};

/**
 * 뒷자리를 실제로 틀렸을 때만 부른다. 두 카운터를 올린다.
 */
export const recordDownloadIdentityFailure = async (contractId: string): Promise<void> => {
  const nowSeconds = Math.floor(Date.now() / 1000);

  try {
    await getDb().delete(rateLimits).where(lte(rateLimits.expiresAt, nowSeconds));
    await getDb().batch([
      getDb()
        .insert(rateLimits)
        .values({
          key: downloadIdentityWindowKey(contractId),
          count: 1,
          expiresAt: nowSeconds + DOWNLOAD_IDENTITY_WINDOW_SECONDS,
        })
        .onConflictDoUpdate({ target: rateLimits.key, set: { count: sql`${rateLimits.count} + 1` } }),
      getDb()
        .insert(rateLimits)
        .values({
          key: downloadIdentityTotalKey(contractId),
          count: 1,
          expiresAt: nowSeconds + DOWNLOAD_IDENTITY_TOTAL_WINDOW_SECONDS,
        })
        .onConflictDoUpdate({ target: rateLimits.key, set: { count: sql`${rateLimits.count} + 1` } }),
    ]);
  } catch (error: unknown) {
    console.error('[admin-rate-limit] Failed to record download identity failure:', error);
  }
};

/** 다운로드 본인 확인 성공 시 창 카운터를 지운다 — 정상 이용이 예산을 갉아먹지 않게. */
export const resetDownloadIdentityAttempts = async (contractId: string): Promise<void> => {
  try {
    await getDb()
      .delete(rateLimits)
      .where(
        inArray(rateLimits.key, [
          downloadIdentityWindowKey(contractId),
          downloadIdentityTotalKey(contractId),
        ]),
      );
  } catch (error: unknown) {
    console.error('[admin-rate-limit] Failed to reset download identity attempts:', error);
  }
};

/**
 * 시도 기록을 지운다. 본인 확인에 성공했을 때, 그리고 관리자가 계약서를 재발송할 때.
 *
 * 재발송에서 지우는 것이 누적 상한의 해제 수단이다. 상한에 걸린 사람이 정말 당사자라면
 * 운영자에게 연락할 것이고, 운영자가 다시 보내면 처음 상태로 돌아간다. 누적 카운터만
 * 두고 푸는 방법을 두지 않으면 오타를 반복한 고객이 영영 서명할 수 없게 된다.
 */
export const resetIdentityAttempts = async (contractId: string): Promise<void> => {
  try {
    await getDb()
      .delete(rateLimits)
      .where(
        inArray(rateLimits.key, [
          identityWindowKey(contractId),
          identityTotalKey(contractId),
          // 다운로드 본인확인 카운터도 함께 푼다. 재발송은 이 계약을 다시 신뢰한다는
          // 운영자의 행위이므로, 다운로드가 잠겨 있었다면 그 해제 수단이기도 하다.
          downloadIdentityWindowKey(contractId),
          downloadIdentityTotalKey(contractId),
        ]),
      );
  } catch (error: unknown) {
    console.error('[admin-rate-limit] Failed to reset identity attempts:', error);
  }
};

/**
 * 로그인에 성공하면 카운터를 지운다 — subject와 GLOBAL_KEY 둘 다.
 *
 * subject를 지우는 이유: 실패가 쌓인 창 안에서 정상 로그인도 한도를 채워 나가면 비밀번호를
 * 아는 관리자가 자기 시스템에서 잠긴다. 공유 IP(NAT)에서는 남이 흘린 실패까지 얹힌다.
 *
 * GLOBAL_KEY도 지우는 이유: 성공은 "지금 로그인한 사람이 진짜 관리자"라는 증거다. 진짜
 * 관리자가 들어온 이상 그 시점까지의 전역 실패 누적을 붙들고 있을 이유가 없다 — 그대로
 * 두면 성공 직후의 정당한 재로그인이 남은 전역 카운트에 걸린다. (예전엔 이 리셋이 없어
 * 전역 상한이 영구 봉쇄로 굳었다.)
 */
export const resetAdminLoginRateLimit = async (req: NextApiRequest): Promise<void> => {
  const key = getSubjectKey(req);
  memoryStore.delete(key);
  memoryStore.delete(GLOBAL_KEY);

  try {
    await getDb().delete(rateLimits).where(inArray(rateLimits.key, [key, GLOBAL_KEY]));
  } catch (error: unknown) {
    console.error('[admin-rate-limit] Failed to reset counter after login:', error);
  }
};
