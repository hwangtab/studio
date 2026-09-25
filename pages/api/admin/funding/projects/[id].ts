import type { NextApiRequest, NextApiResponse } from 'next';
import { eq } from 'drizzle-orm';

import { getDb } from '../../../../../db/client';
import { formatPriceAmount } from '../../../../../data/pricing';
import { fundingProjects, type FundingProjectPayout } from '../../../../../db/schema';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { getClientIp } from '../../../../../lib/contracts/client-ip';
import { loadProjectForAdmin } from '../../../../../lib/funding/adminProjects';
import { setDesignFeePaid, setProjectService, type ServiceWriteResult } from '../../../../../lib/funding/projectServices';
import { decideProject, type AdminReviewAction, type DecisionResult } from '../../../../../lib/funding/reviewDecision';
import { decidePublicStatus, type PublicStatusAction, type PublicStatusResult } from '../../../../../lib/funding/publicStatusDecision';
import {
  decideCreatorAccount,
  type CreatorAccountAction,
  type CreatorAccountResult,
} from '../../../../../lib/funding/creatorAccountDecision';
import {
  sendCreatorAccountOperatorFallback,
  sendCreatorEmailChangedEmails,
  sendCreatorNameChangedEmail,
} from '../../../../../lib/funding/creatorEmail';
import {
  buildFundingPayoutPreview,
  markFundingPayoutPaid,
  recordFundingPayout,
  type RecordFundingPayoutResult,
} from '../../../../../lib/funding/payout';
import { loadFundingPayoutAccountMasked } from '../../../../../lib/funding/payoutAccount';
import { recordAdminPrivacyAccess } from '../../../../../lib/privacy/accessLog';
import {
  sendFundingPayoutOperatorFallback,
  sendFundingPayoutPaidEmail,
  sendFundingPayoutRecordedEmail,
} from '../../../../../lib/funding/payoutEmail';
import { revalidateFundingPaths } from '../../../../../lib/funding/revalidate';
import {
  sendReviewDecisionEmail,
  sendReviewDecisionOperatorFallback,
  sendPublicStatusEmail,
  sendPublicStatusOperatorFallback,
} from '../../../../../lib/funding/reviewEmail';

/** DecisionResult의 실패 code → HTTP 상태. Step 1 규약 그대로. */
const DECISION_STATUS: Record<Exclude<DecisionResult, { ok: true }>['code'], number> = {
  not_found: 404,
  conflict: 409,
  invalid_slug: 400,
  duplicate_slug: 400,
  incomplete: 400,
  expired: 400,
  terms_not_agreed: 400,
};

const REVIEW_ACTIONS: readonly AdminReviewAction[] = ['approve', 'request_changes', 'reject', 'archive'];
const isReviewAction = (value: unknown): value is AdminReviewAction =>
  typeof value === 'string' && (REVIEW_ACTIONS as readonly string[]).includes(value);

/** `publicStatusDecision.ts`의 실패 code → HTTP 상태. */
const PUBLIC_STATUS_HTTP: Record<Exclude<PublicStatusResult, { ok: true }>['code'], number> = {
  not_found: 404,
  conflict: 409,
  incomplete: 400,
};

const PUBLIC_STATUS_ACTIONS: readonly PublicStatusAction[] = ['close', 'reopen', 'hide', 'unhide'];
const isPublicStatusAction = (value: unknown): value is PublicStatusAction =>
  typeof value === 'string' && (PUBLIC_STATUS_ACTIONS as readonly string[]).includes(value);

/** `creatorAccountDecision.ts`의 실패 code → HTTP 상태. duplicate_email은 duplicate_slug와 같은 400이다 —
 * 입력값 자체를 고쳐야 하는 상황이라 낙관적 잠금 실패(409)와 성격이 다르다. */
const CREATOR_ACCOUNT_HTTP: Record<Exclude<CreatorAccountResult, { ok: true }>['code'], number> = {
  not_found: 404,
  invalid: 400,
  incomplete: 400,
  conflict: 409,
  duplicate_email: 400,
};

const CREATOR_ACCOUNT_ACTIONS: readonly CreatorAccountAction[] = ['set_creator_name', 'set_creator_email'];
const isCreatorAccountAction = (value: unknown): value is CreatorAccountAction =>
  typeof value === 'string' && (CREATOR_ACCOUNT_ACTIONS as readonly string[]).includes(value);

/** `recordFundingPayout`의 실패 code → HTTP. 사유마다 운영자가 할 일이 다르므로 문구도 가른다. */
const PAYOUT_RECORD_ERROR: Record<
  Exclude<
    Exclude<RecordFundingPayoutResult, { ok: true }>['code'],
    'amount_changed' | 'payout_account_unreadable' | 'resident_number_unreadable'
  >,
  { status: number; message: string }
> = {
  not_found: { status: 404, message: '프로젝트를 찾을 수 없습니다.' },
  already_recorded: { status: 409, message: '이미 기록된 정산입니다. 정산은 프로젝트당 한 번만 기록합니다.' },
  // 판정이 실이체액(netAmount)이므로 "결제된 후원이 없다"는 한 가지 경우일 뿐이다 —
  // 후원은 있었고 환불이 모금액을 다 먹은 경우도 여기로 온다(lib/funding/payout.ts).
  nothing_to_pay: { status: 409, message: '정산할 금액이 없습니다 — 결제된 후원이 없거나 환불이 모금액에 닿았습니다.' },
  not_closed: { status: 409, message: '모금이 아직 끝나지 않았습니다. 지금 기록하면 이후 들어온 후원이 정산에서 빠집니다.' },
  no_payout_account: { status: 409, message: '개설자의 정산 계좌가 등록되지 않았습니다. 개설자에게 등록을 요청해 주세요.' },
  no_tax_type: {
    status: 409,
    message:
      '개설자의 세금 처리 구분(개인 원천징수 / 사업자 세금계산서)이 등록되지 않았습니다. 추측해서 기록하면 실이체액이 틀리고 되돌릴 수 없으니, 개설자에게 정산 정보 저장을 요청해 주세요.',
  },
  no_resident_number: {
    status: 409,
    message:
      '개설자가 원천징수 대상인데 주민등록번호가 등록되지 않았습니다. 지금 기록하면 세액만 떼고 지급명세서를 낼 수 없습니다 — 개설자에게 정산 정보 구획에서 주민등록번호 등록을 요청해 주세요.',
  },
};

/**
 * 암호문을 열지 못한 사유별 안내. **둘로 갈린다.**
 *
 * - 키 문제(`missing_key`·`invalid_key`·`key_mismatch`·`auth_failed`·`unsupported_version`)면
 *   저장된 값은 멀쩡하다. 키를 되찾거나 회전을 끝내면 그대로 열리므로, 재등록을 요청하면
 *   멀쩡한 값을 덮어쓰게 된다.
 * - `malformed`이면 저장된 값이 암호화 형식이 아니거나 그 안의 내용이 형식과 다른 것이라
 *   **어떤 키로도 열리지 않는다.** 이때는 재등록이 유일한 복구 경로다 — 조회 라우트 둘의
 *   `CRYPTO_ERROR_MESSAGE.malformed`가 같은 말을 한다.
 *
 * 두 경우에 같은 문구를 쓰면 절반은 정반대 지시가 된다.
 *
 * **계좌와 주민등록번호가 한 함수를 쓴다.** 갈리는 것은 무엇이 안 열렸는지와 기록했을 때
 * 무엇이 어긋나는지뿐이고, 갈라 말해야 하는 판단은 같다 — 따로 두면 한쪽만 고쳐진다
 * (실제로 계좌 쪽을 먼저 고쳤을 때 주민등록번호 쪽 문구가 정반대로 남아 있었다).
 */
const unreadableFieldMessage = (
  field: { what: string; consequence: string; reregister: string },
  cryptoCode: string,
): string => {
  const prefix = `개설자의 ${field.what}이 저장돼 있지만 지금 이 서버에서는 열리지 않습니다`;
  if (cryptoCode === 'malformed') {
    return `${prefix}(code=malformed — 저장된 값이 암호화 형식이 아니거나 내용이 형식과 다릅니다). ${field.consequence} 이 값은 키를 되찾아도 열리지 않으니, 개설자에게 ${field.reregister}을 다시 등록해 달라고 요청해 주세요.`;
  }
  return `${prefix}(code=${cryptoCode} — 암호화 키 문제). ${field.consequence} FUNDING_FIELD_KEY 설정을 확인한 뒤 다시 시도해 주세요. **키 회전을 돌리는 중이라면 아직 옛 키로 잠긴 값입니다** — 값은 멀쩡하니 회전을 끝낸 뒤 다시 시도하시고, 이 경우에는 값을 지우거나 개설자에게 재등록을 요청하지 마세요.`;
};

const UNREADABLE_FIELD = {
  payout_account_unreadable: {
    what: '정산 계좌',
    consequence: '보낼 계좌를 읽지 못한 채 기록하면 되돌릴 수 없으므로 아무것도 기록하지 않았습니다 —',
    reregister: '정산 계좌',
  },
  resident_number_unreadable: {
    what: '주민등록번호',
    consequence: '기록하면 세액만 떼고 지급명세서를 낼 수 없으므로 아무것도 기록하지 않았습니다 —',
    reregister: '주민등록번호',
  },
} as const;

/**
 * 기록·지급 뒤 개설자에게 알린다. **메일 실패가 기록·지급을 실패시키지 않는다** — 이미
 * DB에는 반영됐고, 여기서 500을 내면 운영자가 같은 버튼을 다시 눌러 409만 받는다.
 * 같은 파일의 판정·공개 상태 블록과 같은 처리다(실패는 warnings로 올리고 운영자 폴백).
 */
const notifyPayout = async (
  req: NextApiRequest,
  actor: string,
  projectId: string,
  payout: FundingProjectPayout,
  what: '정산 기록' | '정산 지급',
): Promise<string[]> => {
  const warnings: string[] = [];
  try {
    const project = await loadProjectForAdmin(projectId);
    if (!project) {
      warnings.push('개설자 정보를 다시 읽지 못해 알림 메일을 보내지 못했습니다.');
      return warnings;
    }
    const account = await loadFundingPayoutAccountMasked(projectId);
    /**
     * **이 복호화만 값이 서버 밖으로 나간다** — 메일 본문에 은행명과 예금주가 실린다.
     * 그래서 조회 버튼·기록 직전 점검과 같은 무게로, 별도 행위 이름으로 남긴다. 결과는
     * 반환값에서 갈린다: 계좌가 아예 없으면 not_found, 있는데 은행명이 비어 있으면
     * 복호화가 실패해 뒤 4자리만 실린 것이다(payoutAccount.ts).
     */
    await recordAdminPrivacyAccess(
      req,
      actor,
      'funding_payout_account_email',
      projectId,
      account === null ? 'not_found' : account.bankName === null ? 'decrypt_failed' : 'success',
    ).catch((error: unknown) => {
      // 기록 실패가 알림을 막지 않는다 — 정산은 이미 DB에 반영됐다.
      console.error('[privacy] 접속기록 호출 실패 — 정산 알림은 계속됩니다', error);
    });
    const send = what === '정산 기록' ? sendFundingPayoutRecordedEmail : sendFundingPayoutPaidEmail;
    const mailError = await send(project.creatorEmail, project.title, payout, account);
    if (mailError) {
      warnings.push(mailError);
      const fallbackError = await sendFundingPayoutOperatorFallback(
        projectId,
        project.title,
        what,
        project.creatorEmail,
        mailError,
      );
      if (fallbackError) {
        console.error(`[funding] 운영자 폴백 알림도 실패 (id=${projectId}, ${what}):`, fallbackError);
        warnings.push(`운영자 폴백 알림도 실패했습니다: ${fallbackError}`);
      }
    }
  } catch (error: unknown) {
    console.error(`[funding] ${what} 후 알림 처리 실패 (id=${projectId}):`, error);
    warnings.push('처리는 끝났지만 알림 메일 단계에서 오류가 났습니다. 개설자에게 직접 알려 주세요.');
  }
  return warnings;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'PATCH') return res.status(405).json({ ok: false });

  const id = String(req.query.id ?? '');
  const b = (typeof req.body === 'object' && req.body) || {};
  const now = new Date();

  /**
   * 판정 없이 `reviewNote`만 고쳐 쓴다(상태 전이·메일 없음).
   *
   * 이름을 `set_note`가 아니라 `set_review_note`로 둔 이유: 이 컬럼은 "운영자 내부 메모"가
   * **아니다.** `reviewNote`는 개설자 화면 두 곳에 "운영자 메모: {내용}"으로 그대로
   * 렌더된다(`pages/[locale]/funding/creator/[id].tsx`, 같은 목록 페이지). 설계 문서도
   * 이 컬럼을 "운영자 → 개설자 메시지"로 정의한다 — 운영자가 내부 기록이라 믿고 적은
   * 문장이 개설자에게 즉시 노출된다.
   *
   * 그리고 이 액션은 `request_changes`가 쓴 보완 요청 사유를 **덮어쓸 수 있다**(같은
   * 컬럼이다). 운영자가 보완 요청 직후 이 액션으로 메모를 다듬는 것은 정당한 사용이지만,
   * 개설자가 아직 못 본 사유를 실수로 지우면 개설자는 무엇을 고쳐야 하는지 알 길이
   * 없어진다 — 그래서 여기서 막지는 않되(다듬기는 정당하다) 이름과 주석을 사실에 맞춘다.
   *
   * 단, `reviewStatus === 'rejected'`일 때는 빈 값을 거부한다. 보관(archive)과 반려(reject)는
   * DB에서 정확히 같은 값이고 `reviewNote`만이 그 둘을 가르는 유일한 증거다
   * (`lib/funding/reviewTransition.ts`) — 여기서 메모를 비우면 그 구분이 영영 사라지고,
   * 개설자 화면의 "사유는 아래 운영자 메모를 확인해 주세요" 안내도 없는 곳을 가리키게 된다.
   *
   * 판정과 무관한 "진짜" 운영자 전용 메모는 별도 컬럼(`internal_note`)에 담는다 —
   * 아래 `set_internal_note` 액션이 그 칸을 쓴다.
   */
  if (b.action === 'set_review_note') {
    const project = await loadProjectForAdmin(id);
    if (!project) return res.status(404).json({ ok: false, message: '프로젝트를 찾을 수 없습니다.' });
    const note = typeof b.note === 'string' ? b.note.trim() || null : null;
    if (project.reviewStatus === 'rejected' && !note) {
      return res.status(400).json({
        ok: false,
        message: '반려·보관 사유는 비울 수 없습니다. reviewNote가 둘을 가르는 유일한 근거입니다.',
      });
    }
    await getDb().update(fundingProjects).set({ reviewNote: note, updatedAt: now }).where(eq(fundingProjects.id, id));
    return res.status(200).json({ ok: true });
  }

  /**
   * 운영자 전용 메모. `set_review_note`와 달리 개설자에게 보이지 않으므로 빈 값을 막지
   * 않는다 — 여기 적힌 것은 증거가 아니라 운영 메모다.
   */
  if (b.action === 'set_internal_note') {
    const project = await loadProjectForAdmin(id);
    if (!project) return res.status(404).json({ ok: false, message: '프로젝트를 찾을 수 없습니다.' });
    const note = typeof b.note === 'string' ? b.note.trim() || null : null;
    await getDb().update(fundingProjects).set({ internalNote: note, updatedAt: now }).where(eq(fundingProjects.id, id));
    return res.status(200).json({ ok: true });
  }

  /**
   * 스튜디오 서비스(설계 대행·발매 프로젝트 연계) 지정 — 운영자 전용, 개설자에게 보이지 않는다.
   * 테이블은 마이그레이션 0036이다. 운영 DB에 아직 없으면 503으로 "미적용"을 알린다 — 다른
   * 쓰기(판정·메모·정산)는 이 테이블과 무관하게 계속 된다(lib/funding/projectServices.ts).
   */
  if (b.action === 'set_studio_service' || b.action === 'set_design_fee_paid') {
    let result: ServiceWriteResult;
    if (b.action === 'set_studio_service') {
      const kind = b.kind;
      if (kind !== 'none' && kind !== 'design' && kind !== 'release') {
        return res.status(400).json({ ok: false, message: 'kind는 none·design·release 중 하나여야 합니다.' });
      }
      result = await setProjectService(id, kind, now);
    } else {
      if (typeof b.paid !== 'boolean') {
        return res.status(400).json({ ok: false, message: 'paid는 true 또는 false여야 합니다.' });
      }
      result = await setDesignFeePaid(id, b.paid, now);
    }
    if (result.ok) return res.status(200).json({ ok: true, service: result.service });
    const failure: Record<typeof result.code, [number, string]> = {
      not_found: [404, '프로젝트를 찾을 수 없습니다.'],
      unavailable: [503, '운영 DB에 마이그레이션 0036(funding_project_services)이 아직 적용되지 않았습니다. npm run db:migrate 뒤 다시 시도해 주세요.'],
      no_service: [400, '먼저 서비스 종류(설계 대행·발매 프로젝트 연계)를 지정해 주세요.'],
    };
    const [status, message] = failure[result.code];
    return res.status(status).json({ ok: false, message });
  }

  if (isReviewAction(b.action)) {
    const action = b.action;
    const note = typeof b.note === 'string' ? b.note : undefined;
    const slug = typeof b.slug === 'string' ? b.slug : undefined;

    // libSQL/SQLite가 실제로 던지는 문구("UNIQUE constraint failed: <table>.<column>")를
    // 좁혀 잡는다 — 이 저장소의 다른 곳(lib/booking/confirm.test.ts 등)도 같은 문구를 쓴다.
    const isSlugConflictError = (error: unknown): boolean =>
      error instanceof Error && /UNIQUE constraint failed: funding_projects\.slug/i.test(error.message);

    let result: DecisionResult;
    try {
      result = await decideProject(id, action, { note, slug }, now);
    } catch (error: unknown) {
      if (!isSlugConflictError(error)) {
        // 이전 버전은 이 catch가 decideProject 전체(DB select 여러 번·파일 조회·db.batch)를
        // 감싸고 있어 **어떤 이유로 던지든** "주소 중복" 메시지가 나갔다 — Turso 연결 실패도,
        // JSON 파싱 실패도, boundary와 무관한 request_changes·reject 경로의 예외도 전부 같은
        // 문구를 받았다. 원인은 서버 로그에만 남고 운영자는 새로고침만 반복하게 된다.
        // 진짜 원인 불명 오류는 500으로 올리고 로그에 스택을 남긴다.
        console.error(`[funding] decideProject 예외 (id=${id}, action=${action}):`, error);
        return res.status(500).json({ ok: false, message: '판정 처리 중 오류가 났습니다. 잠시 후 다시 시도해 주세요.' });
      }
      /**
       * slug 중복 검사(`decideProject` 내부)와 실제 쓰기 사이에 다른 승인이 끼면
       * `funding_projects.slug`의 unique 제약이 예외를 던진다. 데이터는 안전하다
       * (`db.batch`가 전부 롤백한다) — 하지만 그대로 두면 500이 나간다.
       *
       * 409(conflict)를 골랐다: 이건 "그 사이 상태가 바뀌었다"는 낙관적 잠금 실패와 같은
       * 성격이다(다른 승인이 먼저 끝났다는 뜻) — 입력 자체가 처음부터 잘못된 400과는 다르다.
       * 새로고침하면 `decideProject`의 사전 중복 검사가 이번엔 그 슬러그를 잡아내
       * `duplicate_slug`(400)로 더 친절한 메시지를 준다.
       */
      console.error(`[funding] decideProject slug 경합 (id=${id}, action=${action}):`, error);
      return res.status(409).json({
        ok: false,
        message: '그 사이 다른 프로젝트가 같은 주소를 먼저 사용했습니다. 새로고침 후 다시 확인해 주세요.',
      });
    }

    if (!result.ok) {
      return res.status(DECISION_STATUS[result.code]).json({ ok: false, message: result.message });
    }

    // 판정(DB 쓰기) 자체는 여기서 끝났다. 아래 후속 작업(재검증·메일)은 실패해도 200을
    // 유지하고 경고만 싣는다 — 판정을 실패시키면 운영자가 같은 버튼을 다시 눌러야 하는데
    // 상태는 이미 바뀌어 있어 두 번째 시도는 409를 받는다. try로 통째로 감싸는 이유도
    // 같다: 재조회·메일이 예기치 않게 던져도(예: DB 순간 장애) 500이 아니라 200 + 경고로
    // 나가야 이 원칙과 일관된다.
    const warnings: string[] = [...(result.warnings ?? [])];

    try {
      if (action === 'approve') {
        const revalidateError = await revalidateFundingPaths(res, result.slug);
        if (revalidateError) warnings.push(revalidateError);
      }

      // 메일 본문에 필요한 프로젝트 정보(개설자 메일·제목·시작일)는 decideProject가 돌려주지
      // 않으므로 성공 뒤 다시 읽는다.
      const project = await loadProjectForAdmin(id);
      if (project) {
        const mailError = await sendReviewDecisionEmail(project, action, note?.trim() || null, result.slug);
        if (mailError) {
          warnings.push(mailError);
          // 개설자 메일이 실패하면 운영자에게 폴백 알림을 보낸다 — 그렇지 않으면 이 실패는
          // 이 HTTP 응답의 warnings에만 남고, 운영자가 탭을 닫거나 새로고침하면 사실 자체가
          // 사라진다. 판정은 프로젝트당 사실상 한 번이라(재승인 시도는 conflict) 개설자가
          // 승인 사실을 영영 모르는 상태가 될 수 있다. 영속 기록·재발송 UI는 컬럼 추가가
          // 필요해(마이그레이션, 이 계획 범위 밖) 4차로 넘긴다 — 지금은 운영자 메일함으로
          // 직접 알리는 것까지만 한다.
          const fallbackError = await sendReviewDecisionOperatorFallback(project, action, result.slug, mailError);
          if (fallbackError) {
            console.error(`[funding] 운영자 폴백 알림도 실패 (id=${id}, action=${action}):`, fallbackError);
            warnings.push(`운영자 폴백 알림도 실패했습니다: ${fallbackError}`);
          }
        }
      } else {
        // 판정은 성공했는데 프로젝트를 다시 읽지 못해 메일 발송 자체를 시도하지 못했다.
        // 조용히 넘어가면 이 태스크가 막으려던 바로 그 상태(운영자는 통보됐다고 착각)가
        // 재현된다 — 반드시 경고를 남긴다.
        warnings.push('개설자 정보를 다시 읽지 못해 알림 메일을 보내지 못했습니다.');
      }
    } catch (error: unknown) {
      console.error(`[funding] 판정 후속 처리(재검증·메일) 실패 (id=${id}, action=${action}):`, error);
      warnings.push('판정 후 재검증·메일 처리 중 오류가 발생했습니다. 상태를 직접 확인해 주세요.');
    }

    return res.status(200).json({ ok: true, ...(warnings.length > 0 ? { warnings } : {}) });
  }

  /**
   * 승인된 프로젝트의 공개 상태(status: closed/auto)·목록 노출(hidden)을 바꾼다.
   * `decideProject`와 다른 함수(`decidePublicStatus`)를 쓴다 — 심사 상태(reviewStatus)
   * 전이표와는 다른 축이고, approved는 그 표에서 되감을 수 없는 종결 상태이기 때문이다.
   * 후속 처리(재검증·메일) 구조는 위 판정 블록과 동일하게 맞춘다 — 실패해도 200 + warnings.
   */
  if (isPublicStatusAction(b.action)) {
    const action = b.action;
    const note = typeof b.note === 'string' ? b.note : undefined;

    let result: PublicStatusResult;
    try {
      result = await decidePublicStatus(id, action, { note }, now);
    } catch (error: unknown) {
      console.error(`[funding] decidePublicStatus 예외 (id=${id}, action=${action}):`, error);
      return res.status(500).json({ ok: false, message: '처리 중 오류가 났습니다. 잠시 후 다시 시도해 주세요.' });
    }

    if (!result.ok) {
      return res.status(PUBLIC_STATUS_HTTP[result.code]).json({ ok: false, message: result.message });
    }

    const warnings: string[] = [];
    try {
      // 넷 다 목록(hidden)·상세(status 배지) 어느 한쪽은 반드시 바꾸므로 매번 둘 다 재검증한다.
      const revalidateError = await revalidateFundingPaths(res, result.slug);
      if (revalidateError) warnings.push(revalidateError);

      const project = await loadProjectForAdmin(id);
      if (project) {
        const mailError = await sendPublicStatusEmail(project, action, note?.trim() || null, result.slug, now);
        if (mailError) {
          warnings.push(mailError);
          const fallbackError = await sendPublicStatusOperatorFallback(project, action, result.slug, mailError);
          if (fallbackError) {
            console.error(`[funding] 운영자 폴백 알림도 실패 (id=${id}, action=${action}):`, fallbackError);
            warnings.push(`운영자 폴백 알림도 실패했습니다: ${fallbackError}`);
          }
        }
      } else {
        warnings.push('개설자 정보를 다시 읽지 못해 알림 메일을 보내지 못했습니다.');
      }
    } catch (error: unknown) {
      console.error(`[funding] 공개 상태 변경 후속 처리(재검증·메일) 실패 (id=${id}, action=${action}):`, error);
      warnings.push('공개 상태 변경 후 재검증·메일 처리 중 오류가 발생했습니다. 상태를 직접 확인해 주세요.');
    }

    return res.status(200).json({ ok: true, ...(warnings.length > 0 ? { warnings } : {}) });
  }

  /**
   * 개설자 계정(이름·로그인 이메일) 수정. 프로젝트가 아니라 **개설자**를 고치는 유일한
   * 운영자 경로다 — 입구가 이 라우트인 이유는 운영자가 개설자를 찾는 화면이 심사 상세이기
   * 때문이고(`lib/funding/creatorAccountDecision.ts`), 판정은 그 순수 모듈이 전부 한다.
   *
   * 사유는 어느 컬럼에도 저장하지 않는다(새 컬럼 없이 하는 범위). 남는 곳은 개설자에게
   * 가는 메일 본문과 **아래 서버 로그** 둘뿐이라, 로그를 조건 없이 남긴다.
   */
  if (isCreatorAccountAction(b.action)) {
    const action = b.action;
    const value = typeof b.value === 'string' ? b.value : '';
    const reason = typeof b.reason === 'string' ? b.reason : '';

    let result: CreatorAccountResult;
    try {
      result = await decideCreatorAccount(id, action, { value, reason }, now);
    } catch (error: unknown) {
      console.error(`[funding] decideCreatorAccount 예외 (id=${id}, action=${action}):`, error);
      return res.status(500).json({ ok: false, message: '처리 중 오류가 났습니다. 잠시 후 다시 시도해 주세요.' });
    }

    if (!result.ok) {
      return res.status(CREATOR_ACCOUNT_HTTP[result.code]).json({ ok: false, message: result.message });
    }

    // 계정 변경의 유일한 영속 기록. 값을 바꾼 뒤에 남긴다 — 실패한 시도까지 기록으로
    // 보이면 "바뀐 적 없는 변경"이 로그에 남는다.
    console.warn(
      `[funding] 개설자 계정 변경 (creatorId=${result.creatorId}, action=${action}): ` +
        `"${result.previousValue}" → "${action === 'set_creator_name' ? result.creatorName : result.creatorEmail}" / 사유: ${reason.trim()}`,
    );

    const warnings: string[] = [];
    try {
      // 이름은 공개 상세에 박히므로 이 개설자의 **승인된 프로젝트 전부**를 다시 만든다.
      // 이메일 변경은 공개 화면에 드러나지 않아 revalidateSlugs가 빈 배열이다.
      for (const slug of result.revalidateSlugs) {
        const revalidateError = await revalidateFundingPaths(res, slug);
        if (revalidateError) warnings.push(revalidateError);
      }

      const mailError =
        action === 'set_creator_name'
          ? await sendCreatorNameChangedEmail(result.creatorEmail, result.previousValue, result.creatorName, reason.trim())
          : await sendCreatorEmailChangedEmails(result.previousValue, result.creatorEmail, reason.trim());
      if (mailError) {
        warnings.push(mailError);
        const fallbackError = await sendCreatorAccountOperatorFallback(
          action === 'set_creator_name' ? '이름' : '로그인 이메일',
          result.creatorEmail,
          result.previousValue,
          action === 'set_creator_name' ? result.creatorName : result.creatorEmail,
          reason.trim(),
          mailError,
        );
        if (fallbackError) {
          console.error(`[funding] 운영자 폴백 알림도 실패 (id=${id}, action=${action}):`, fallbackError);
          warnings.push(`운영자 폴백 알림도 실패했습니다: ${fallbackError}`);
        }
      }
    } catch (error: unknown) {
      console.error(`[funding] 개설자 계정 변경 후속 처리(재검증·메일) 실패 (id=${id}, action=${action}):`, error);
      warnings.push('계정 변경 후 재검증·메일 처리 중 오류가 발생했습니다. 상태를 직접 확인해 주세요.');
    }

    return res.status(200).json({ ok: true, ...(warnings.length > 0 ? { warnings } : {}) });
  }

  /**
   * 정산 기록 — 미리보기 숫자를 그 시점에 고정한다(`lib/funding/payout.ts`).
   * 프로젝트당 한 번이고, `project_id` UNIQUE가 동시 클릭도 막는다.
   */
  if (b.action === 'record_payout') {
    /**
     * 화면이 운영자에게 보여 준 실이체액을 함께 받는다 — 서버는 그 숫자를 기록하는 게 아니라
     * 다시 계산한 값과 대조만 한다. 안 실려 오면 거절한다: 이 라우트를 부르는 것은 관리자
     * 화면뿐이고, 기본값을 두면 낙관적 잠금을 우회하는 경로가 다시 생긴다.
     */
    if (typeof b.expectedNetAmount !== 'number' || !Number.isFinite(b.expectedNetAmount)) {
      return res.status(400).json({
        ok: false,
        message: '화면이 보여 준 실이체액이 요청에 실리지 않았습니다. 새로고침 후 다시 시도해 주세요.',
      });
    }
    let result: RecordFundingPayoutResult;
    try {
      // IP는 접속기록용이다 — 정산 기록은 주민등록번호를 한 번 복호화해 본다(payout.ts).
      result = await recordFundingPayout(id, now, b.expectedNetAmount, getClientIp(req), auth.actor);
    } catch (error: unknown) {
      console.error(`[funding] recordFundingPayout 예외 (id=${id}):`, error);
      return res.status(500).json({ ok: false, message: '정산을 기록하지 못했습니다.' });
    }
    if (!result.ok) {
      // 금액이 갈린 경우만 두 숫자를 문구에 넣는다 — 운영자가 무엇이 얼마로 바뀌었는지 보고
      // 새로고침 뒤 다시 검산할 수 있어야 한다.
      if (result.code === 'amount_changed') {
        return res.status(409).json({
          ok: false,
          code: result.code,
          message: `그 사이에 금액이 바뀌었습니다 — 화면은 실이체액 ${formatPriceAmount(
            result.expectedNetAmount,
          )}원을 보여 줬는데 지금 다시 계산하면 ${formatPriceAmount(
            result.netAmount,
          )}원입니다. 아무것도 기록하지 않았으니 새 금액을 다시 검산한 뒤 기록해 주세요.`,
        });
      }
      if (result.code === 'payout_account_unreadable' || result.code === 'resident_number_unreadable') {
        return res.status(503).json({
          ok: false,
          code: result.code,
          cryptoCode: result.cryptoCode,
          message: unreadableFieldMessage(UNREADABLE_FIELD[result.code], result.cryptoCode),
        });
      }
      const mapped = PAYOUT_RECORD_ERROR[result.code];
      return res.status(mapped.status).json({ ok: false, code: result.code, message: mapped.message });
    }
    const warnings = await notifyPayout(req, auth.actor, id, result.payout, '정산 기록');
    return res.status(201).json({ ok: true, ...(warnings.length > 0 ? { warnings } : {}) });
  }

  /**
   * 지급 표시 — pending → paid 한 방향. 되돌리지 않는다.
   *
   * 정산 id를 요청 본문으로 받지 않고 프로젝트에서 찾는다. 정산은 프로젝트당 하나뿐이라
   * 받을 이유가 없고, 받으면 "다른 프로젝트의 정산 id"를 이 라우트로 보낼 수 있는 경로가
   * 생긴다.
   */
  if (b.action === 'mark_payout_paid') {
    const memo = typeof b.memo === 'string' && b.memo.trim() ? b.memo.trim() : null;
    try {
      const preview = await buildFundingPayoutPreview(id);
      if (!preview) return res.status(404).json({ ok: false, message: '프로젝트를 찾을 수 없습니다.' });
      if (!preview.recorded) {
        return res.status(409).json({ ok: false, message: '아직 기록되지 않은 정산입니다. 먼저 정산을 기록해 주세요.' });
      }
      const done = await markFundingPayoutPaid(preview.recorded.id, memo, now);
      if (!done) return res.status(409).json({ ok: false, message: '이미 지급 완료로 기록된 정산입니다.' });
      const warnings = await notifyPayout(req, auth.actor, id, { ...preview.recorded, status: 'paid', paidAt: now, memo }, '정산 지급');
      return res.status(200).json({ ok: true, ...(warnings.length > 0 ? { warnings } : {}) });
    } catch (error: unknown) {
      console.error(`[funding] markFundingPayoutPaid 예외 (id=${id}):`, error);
      return res.status(500).json({ ok: false, message: '처리하지 못했습니다.' });
    }
  }

  return res.status(400).json({ ok: false, message: 'action이 올바르지 않습니다.' });
}
