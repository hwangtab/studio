/**
 * 관리자 계정 — **비밀번호가 곧 신원이다.**
 *
 * 계정 테이블도 사용자명 칸도 없다. 로그인 화면은 비밀번호 한 칸이고, 사람마다 비밀번호가
 * 다르므로 맞은 비밀번호가 곧 누가 들어왔는지를 말해 준다. 이 방식을 고른 이유는 하나다 —
 * 접속기록(`privacy_access_logs.actor`)이 사람을 가리키게 하는 데 필요한 것은 "지금 이
 * 세션이 누구인가" 하나뿐이고, 그것을 위해 계정 저장소·초대·비밀번호 재설정을 들이면
 * 지켜야 할 것이 그만큼 늘어난다.
 *
 * 정본은 환경변수 `ADMIN_ACCOUNTS` 하나다(JSON 배열):
 *
 *   ADMIN_ACCOUNTS=[{"id":"kyungha","name":"황경하","password":"..."}]
 *
 * 없으면 `ADMIN_PASSWORD` 한 사람으로 떨어진다 — 그때 기록되는 actor는 예전과 똑같은
 * `admin`이다. 즉 env를 손대지 않은 배포는 지금 그대로 돌아간다.
 *
 * **이 모듈은 DB를 물지 않는다.** 관리자 화면(`pages/admin/*.tsx`)이 GSSP에서 인증 모듈을
 * 가져가므로, 여기서 `db/client`를 끌어오면 그 무게가 페이지 모듈 그래프에 붙는다.
 */

/** 기록에 남는 값이라 형식을 좁게 잡는다 — 사람 이름·이메일이 아니라 짧은 식별자다. */
export const ADMIN_ID_PATTERN = /^[a-z0-9_-]{2,32}$/;

/**
 * `ADMIN_ACCOUNTS`가 없을 때의 단일 계정 id.
 *
 * `lib/privacy/accessLog.ts`의 `PRIVACY_ACTOR_ADMIN`과 **같은 문자열이어야 한다** —
 * 배포 전후로 접속기록의 actor가 갈리면 예전 행과 새 행을 한 사람으로 못 읽는다.
 * 그 모듈은 DB를 물고 있어 여기서 가져오지 않고, 같은지는 테스트로 고정한다.
 */
export const ADMIN_FALLBACK_ID = 'admin';

/** `ADMIN_ACCOUNTS`가 없을 때 화면에 뜨는 이름. 누구인지 모르므로 역할만 적는다. */
export const ADMIN_FALLBACK_NAME = '관리자';

/**
 * 관리자 비밀번호의 최소 길이.
 *
 * 이 값 하나가 모든 계약의 개인정보를 지키는 유일한 자물쇠이므로 짧은 값을 허용하지 않는다.
 * 대소문자·숫자·기호를 섞은 13자는 조합이 10^23을 넘고, 로그인은 10분에 10회로 제한되므로
 * 무작위 대입으로는 사실상 뚫리지 않는다. 실제 위험은 길이가 아니라 짐작 가능한 값
 * (사이트명, 연도, 흔한 단어)이며 그것은 길이로 막을 수 없다.
 */
export const MIN_PASSWORD_LENGTH = 13;

export interface AdminAccount {
  /** 접속기록에 남는 값. 이름·이메일이 아니라 짧은 식별자다. */
  id: string;
  /** 관리자 화면 상단에 띄우는 표시 이름. 기록에는 담지 않는다. */
  name: string;
  password: string;
}

const fail = (message: string): never => {
  throw new Error(`[admin-accounts] ${message}`);
};

/**
 * `ADMIN_ACCOUNTS` JSON을 읽는다. 값이 비어 있으면 `null`(= 폴백 경로).
 *
 * **잘못된 값은 던진다.** 로그인만 조용히 실패하게 두면 운영자는 비밀번호를 의심하지
 * 설정을 의심하지 않는다. 특히 비밀번호가 겹치면 "맞은 비밀번호가 누구인지"라는 이
 * 설계의 전제가 무너지므로, 그 상태로 돌아가느니 서는 편이 낫다.
 */
export const parseAdminAccounts = (raw: string | undefined): AdminAccount[] | null => {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return fail('ADMIN_ACCOUNTS가 JSON이 아닙니다. [{"id":"...","name":"...","password":"..."}] 형식이어야 합니다.');
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return fail('ADMIN_ACCOUNTS는 계정이 하나 이상 든 JSON 배열이어야 합니다.');
  }

  const accounts: AdminAccount[] = parsed.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      return fail(`ADMIN_ACCOUNTS[${index}]가 객체가 아닙니다.`);
    }
    const { id, name, password } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || !ADMIN_ID_PATTERN.test(id)) {
      return fail(
        `ADMIN_ACCOUNTS[${index}].id는 소문자 영숫자·하이픈·밑줄 2~32자여야 합니다(접속기록에 남는 값입니다).`,
      );
    }
    if (typeof name !== 'string' || name.trim() === '') {
      return fail(`ADMIN_ACCOUNTS[${index}](id=${id})에 name이 없습니다.`);
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return fail(`ADMIN_ACCOUNTS[${index}](id=${id})의 password가 ${MIN_PASSWORD_LENGTH}자 미만입니다.`);
    }
    return { id, name: name.trim(), password };
  });

  const seenIds = new Set<string>();
  for (const account of accounts) {
    if (seenIds.has(account.id)) fail(`ADMIN_ACCOUNTS에 id '${account.id}'가 두 번 있습니다.`);
    seenIds.add(account.id);
  }

  /**
   * **비밀번호가 겹치면 선다.**
   *
   * 두 사람이 같은 비밀번호를 쓰면 맞은 비밀번호로 누구인지 가릴 수 없고, 접속기록은
   * 둘 중 먼저 적힌 사람을 가리킨다 — 틀린 이름이 기록되는 편이 `admin` 하나보다 나쁘다.
   * 오류 문구에는 비밀번호를 담지 않는다(설정 오류 메시지는 로그에 남는다).
   */
  const byPassword = new Map<string, string>();
  for (const account of accounts) {
    const owner = byPassword.get(account.password);
    if (owner) fail(`ADMIN_ACCOUNTS의 '${owner}'와 '${account.id}'가 같은 비밀번호를 씁니다.`);
    byPassword.set(account.password, account.id);
  }

  return accounts;
};

/**
 * 지금 배포가 인정하는 계정 목록.
 *
 * `ADMIN_ACCOUNTS`가 없으면 `ADMIN_PASSWORD` 한 사람, 둘 다 없거나 비밀번호가 짧으면
 * 빈 배열 — 그때는 로그인 자체가 불가능하다(예전과 같은 동작).
 */
export const resolveAdminAccounts = (
  env: Record<string, string | undefined> = process.env,
): AdminAccount[] => {
  const configured = parseAdminAccounts(env.ADMIN_ACCOUNTS);
  if (configured) return configured;

  const password = env.ADMIN_PASSWORD;
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    console.error(
      `[admin-accounts] ADMIN_ACCOUNTS도 ADMIN_PASSWORD도 없습니다(또는 비밀번호가 ${MIN_PASSWORD_LENGTH}자 미만). 관리자 로그인이 불가능합니다.`,
    );
    return [];
  }
  return [{ id: ADMIN_FALLBACK_ID, name: ADMIN_FALLBACK_NAME, password }];
};
