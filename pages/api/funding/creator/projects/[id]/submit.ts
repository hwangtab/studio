import { and, eq } from 'drizzle-orm';
import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../../../db/client';
import { fundingProjects } from '../../../../../../db/schema';
import { consumeRateLimit } from '../../../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../../../lib/contact/origin';
import { authenticateCreatorApi } from '../../../../../../lib/funding/creatorAuth';
import { loadProjectForCreator, type CreatorProjectDetail } from '../../../../../../lib/funding/creatorProjectWrite';
import { CREATOR_LIMITS, findMissingRequiredSections } from '../../../../../../lib/funding/creatorValidation';
import { sendFundingCreatorSubmissionEmail } from '../../../../../../lib/funding/email';
import { FUNDING_CREATOR_TERMS_VERSION } from '../../../../../../lib/funding/policy';
import { nextReviewStatus, type FundingReviewStatus } from '../../../../../../lib/funding/reviewTransition';

/**
 * "다 채워졌는가"를 처음으로 묻는 자리 — 구획별 저장(basic·story·creator)은 각자 빈 값을
 * 허용하므로 여기서 모아서 본다.
 *
 * 실제 판정은 `findMissingRequiredSections`(creatorValidation.ts)가 정본이다 — 운영자
 * 승인(reviewDecision.ts)도 같은 함수를 쓴다. 여기서는 그 함수가 보지 않는 slug·개설자
 * 이름까지 함께 넘긴다.
 *
 * goalAmount까지 다시 검증하지 않는 이유: title·summary·slug·coverUrl 중 하나라도
 * 채워지지 않았다는 것은 곧 기본정보 구획을 한 번도 저장한 적이 없다는 뜻이다
 * (createDraftProject의 초안 기본값은 coverUrl=''이고, saveBasicSection은 저 네 필드를
 * 항상 non-empty로 검증한 뒤에만 통과시켜 목표금액까지 함께 유효한 값으로 만들어 둔다) —
 * 즉 이 네 필드가 채워져 있다는 것은 saveBasicSection이 최소 한 번 성공했다는 뜻이고,
 * 그러면 goalAmount도 이미 유효하다.
 *
 * **날짜(startAt)는 예외다** — 아래 별도 재검사 참조. 저장 순간엔 유효했어도 시간이
 * 지나면 저절로 무효가 되는 값이라, "저장이 성공했으면 계속 유효하다"는 이 함수의 전제가
 * 통하지 않는다.
 */
const findMissingSections = (project: CreatorProjectDetail): string[] =>
  findMissingRequiredSections({
    title: project.title,
    summary: project.summary,
    slug: project.slug,
    coverUrl: project.coverUrl,
    content: project.content,
    rewardsCount: project.rewards.length,
    creatorName: project.creator.name,
    creatorEmail: project.creator.email,
  });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  if (!isAllowedContactRequestOrigin(req)) {
    return res.status(403).json({ ok: false, message: 'Forbidden' });
  }

  const auth = await authenticateCreatorApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: '로그인이 필요합니다.' });

  const projectId = typeof req.query.id === 'string' ? req.query.id : '';
  if (!projectId) return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });

  if (!(await consumeRateLimit(`creator_save:${auth.creatorId}`, 30, 60))) {
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });
  }

  const project = await loadProjectForCreator(auth.creatorId, projectId);
  if (!project) return res.status(404).json({ ok: false, message: '프로젝트를 찾을 수 없습니다.' });

  const next = nextReviewStatus(project.reviewStatus as FundingReviewStatus, 'submit');
  if (!next) return res.status(409).json({ ok: false, message: '지금 상태에서는 심사를 신청할 수 없습니다.' });

  const missing = findMissingSections(project);
  if (missing.length > 0) {
    return res.status(400).json({ ok: false, message: `다음 항목을 채워 주세요: ${missing.join(', ')}` });
  }

  // 날짜는 채워졌다고 끝이 아니다 — "시작일은 오늘 + leadDays일 뒤부터"는 저장 순간의
  // now로만 본 조건이라(validateBasicSection), 저장 뒤 며칠 묵혀 두면 저절로 무효가 된다.
  // 이걸 안 보면: 9/17에 startAt=9/20으로 저장 → 일주일 묵힘 → 9/27 제출(막지 않으면 통과)
  // → 9/28 승인 → computeProjectState가 startAt < now라 upcoming 없이 즉시 live로 판정한다.
  // 개설자가 고른 시작일도 심사 리드타임도 없던 일이 되고 모금 기간이 조용히 줄어든다.
  if (project.startAt.getTime() < Date.now() + CREATOR_LIMITS.leadDays * 86_400_000) {
    return res.status(400).json({
      ok: false,
      message: '시작일이 너무 가깝습니다. 기본정보에서 모금 기간을 다시 잡아 주세요.',
    });
  }

  // 약관 본문이 3차 범위라 판본이 빈 문자열인 동안은 동의를 요구하지 않는다 — 본문 없는
  // 동의는 증거가 아니다(lib/funding/policy.ts의 FUNDING_CREATOR_TERMS_VERSION 주석 참조).
  const requiresTerms = FUNDING_CREATOR_TERMS_VERSION !== '';
  if (requiresTerms) {
    const agreedTermsVersion = typeof req.body?.agreedTermsVersion === 'string' ? req.body.agreedTermsVersion : '';
    if (agreedTermsVersion !== FUNDING_CREATOR_TERMS_VERSION) {
      // 체크박스를 안 켠 것(빈 문자열)과 판본이 갱신된 것(값은 왔지만 지금 판본과 다름)은
      // 원인이 다르다 — 둘 다 같은 문구로 답하면 체크박스를 이미 켠 개설자는 이유를 알 길이
      // 없다(배포 직후 옛 번들을 들고 있거나, 화면을 오래 열어 둔 사이 약관이 개정된 경우).
      return res.status(400).json({
        ok: false,
        message: agreedTermsVersion
          ? '약관이 개정되었습니다. 새로고침 후 다시 신청해 주세요.'
          : '개설자 약관에 동의해 주세요.',
      });
    }
  }

  const now = new Date();
  // reviewStatus를 조건에 다시 건다 — 읽고 나서 쓰는 사이(loadProjectForCreator 이후) 운영자가
  // 승인·반려를 먼저 확정할 수 있다. 조건 없이 id만으로 UPDATE하면 이미 approved로 끝난 행을
  // submitted로 되돌려 reviewTransition.ts의 "승인은 끝이다" 규칙을 우회한다. 영향 행이
  // 0이면 그 사이 상태가 바뀐 것이므로 409로 되돌린다.
  const result = await getDb().update(fundingProjects).set({
    reviewStatus: next,
    submittedAt: now,
    updatedAt: now,
    ...(requiresTerms ? { creatorTermsVersion: FUNDING_CREATOR_TERMS_VERSION, creatorTermsAgreedAt: now } : {}),
  }).where(and(eq(fundingProjects.id, projectId), eq(fundingProjects.reviewStatus, project.reviewStatus as FundingReviewStatus)));

  if (Number(result.rowsAffected) === 0) {
    return res.status(409).json({ ok: false, message: '지금 상태에서는 심사를 신청할 수 없습니다.' });
  }

  try {
    const mailError = await sendFundingCreatorSubmissionEmail(project);
    if (mailError) {
      // 메일 실패는 삼키고 기록만 남긴다 — 제출(상태 전이)은 이미 커밋됐다. 여기서 실패를
      // 응답에 흘리면 "심사 요청은 접수됐는데 응답은 실패"라는 상태 불일치가 생긴다.
      console.error('[funding/creator/submit] 심사 요청 알림 메일 실패:', mailError);
    }
  } catch (error: unknown) {
    // sendEmail은 내부에서 네트워크·타임아웃을 전부 삼켜 항상 결과 객체를 돌려주지만,
    // 그 전제가 깨져도(향후 변경·목) 이미 커밋된 제출을 되돌리지 않는다.
    console.error('[funding/creator/submit] 심사 요청 알림 메일 처리 중 오류:', error);
  }

  return res.status(200).json({ ok: true });
}
