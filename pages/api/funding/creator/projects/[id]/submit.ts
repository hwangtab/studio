import { eq } from 'drizzle-orm';
import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../../../db/client';
import { fundingProjects } from '../../../../../../db/schema';
import { consumeRateLimit } from '../../../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../../../lib/contact/origin';
import { sendEmail } from '../../../../../../lib/email/resend';
import { authenticateCreatorApi } from '../../../../../../lib/funding/creatorAuth';
import { loadProjectForCreator, type CreatorProjectDetail } from '../../../../../../lib/funding/creatorProjectWrite';
import { FUNDING_CREATOR_TERMS_VERSION } from '../../../../../../lib/funding/policy';
import { nextReviewStatus, type FundingReviewStatus } from '../../../../../../lib/funding/reviewTransition';
import { OPERATOR_EMAIL } from '../../../../../../lib/operatorContact';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');

const STORY_MIN_LENGTH = 200;

/**
 * "다 채워졌는가"를 처음으로 묻는 자리 — 구획별 저장(basic·story·creator)은 각자 빈 값을
 * 허용하므로 여기서 모아서 본다.
 *
 * 기본정보는 네 필드(title·summary·slug·coverUrl)만 truthy 검사한다. goalAmount·startAt·
 * endAt까지 다시 검증하지 않는 이유: 저 넷 중 하나라도 채워지지 않았다는 것은 곧
 * 기본정보 구획을 한 번도 저장한 적이 없다는 뜻이다(createDraftProject의 초안 기본값은
 * coverUrl=''이고, saveBasicSection은 저 네 필드를 항상 non-empty로 검증한 뒤에만 통과시켜
 * 날짜·목표금액까지 함께 유효한 값으로 만들어 둔다) — 즉 이 네 필드가 채워져 있다는 것은
 * saveBasicSection이 최소 한 번 성공했다는 뜻이고, 그러면 나머지 필드도 이미 유효하다.
 */
const findMissingSections = (project: CreatorProjectDetail): string[] => {
  const missing: string[] = [];
  if (!project.title || !project.summary || !project.slug || !project.coverUrl) missing.push('기본정보');
  if (project.content.trim().length < STORY_MIN_LENGTH) missing.push(`스토리(본문 ${STORY_MIN_LENGTH}자 이상)`);
  if (project.rewards.length < 1) missing.push('리워드(최소 1개)');
  if (!project.creator.name) missing.push('개설자 정보(이름)');
  return missing;
};

/**
 * 운영자 알림 메일. 성공 여부는 응답에 영향을 주지 않는다 — 실패해도 로그만 남긴다.
 * 제출 자체(프로젝트 상태 전이)는 이미 커밋됐으므로, 여기서 던지면 "심사 요청은 접수됐는데
 * 응답은 실패"라는 클라이언트-서버 상태 불일치가 생긴다.
 */
const notifyOperator = async (project: CreatorProjectDetail): Promise<void> => {
  const contact = [project.creator.contactName, project.creator.phone].filter(Boolean).join(' / ') || '연락처 미기재';
  try {
    const result = await sendEmail({
      to: OPERATOR_EMAIL,
      subject: `[펀딩] 심사 요청 — ${project.title}`,
      text: [
        `개설자: ${project.creator.name} (${contact})`,
        `프로젝트: ${project.title}`,
        `주소: ${SITE_URL}/ko/funding/${project.slug}`,
        `관리자: ${SITE_URL}/admin/funding`,
      ].join('\n'),
    });
    if (!result.ok) {
      console.error('[funding/creator/submit] 심사 요청 알림 메일 실패:', result.errorDetail ?? result.errorCode);
    }
  } catch (error: unknown) {
    // sendEmail은 내부에서 네트워크·타임아웃을 전부 삼켜 항상 SendEmailResult를 돌려주지만,
    // 테스트 목이나 향후 변경이 그 전제를 깰 수 있다. 제출 자체는 이미 커밋된 뒤이므로
    // 여기서 무엇이 올라와도 응답에 흘리지 않는다.
    console.error('[funding/creator/submit] 심사 요청 알림 메일 처리 중 오류:', error);
  }
};

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

  // 약관 본문이 3차 범위라 판본이 빈 문자열인 동안은 동의를 요구하지 않는다 — 본문 없는
  // 동의는 증거가 아니다(lib/funding/policy.ts의 FUNDING_CREATOR_TERMS_VERSION 주석 참조).
  const requiresTerms = FUNDING_CREATOR_TERMS_VERSION !== '';
  if (requiresTerms) {
    const agreedTermsVersion = typeof req.body?.agreedTermsVersion === 'string' ? req.body.agreedTermsVersion : '';
    if (agreedTermsVersion !== FUNDING_CREATOR_TERMS_VERSION) {
      return res.status(400).json({ ok: false, message: '개설자 약관에 동의해 주세요.' });
    }
  }

  const now = new Date();
  await getDb().update(fundingProjects).set({
    reviewStatus: next,
    submittedAt: now,
    updatedAt: now,
    ...(requiresTerms ? { creatorTermsVersion: FUNDING_CREATOR_TERMS_VERSION, creatorTermsAgreedAt: now } : {}),
  }).where(eq(fundingProjects.id, projectId));

  await notifyOperator(project);

  return res.status(200).json({ ok: true });
}
