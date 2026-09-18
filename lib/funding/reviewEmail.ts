import { sendEmail } from '../email/resend';
import { CUSTOMER_REPLY_TO, OPERATOR_EMAIL } from '../operatorContact';

import { PHONE, PHONE_NUMBER, SITE_URL } from './email';

import type { AdminProjectDetail } from './adminProjects';
import type { AdminReviewAction } from './reviewDecision';

/**
 * 판정 메일이 다루는 세 가지. 독립 정의하지 않고 `reviewDecision.ts`의 `AdminReviewAction`을
 * 그대로 쓴다 — 한 번 따로 적었다가(2026-09-18) 리뷰에서 지적받았다. "이 파일이 Task 5에서
 * `reviewDecision.ts`를 부르게 되면 순환 import가 생긴다"는 판단으로 독립 정의했는데 틀렸다.
 * 실제 계획(Task 5)은 API 라우트가 `reviewDecision.ts`와 `reviewEmail.ts`를 각각 따로
 * import해 순서대로 호출하는 구조라 의존 방향이 `reviewEmail → reviewDecision` 한쪽뿐이고,
 * 게다가 타입 전용 import는 컴파일 시 지워져 애초에 순환이 성립하지 않는다. 독립 정의를
 * 남겨 뒀다면 Task 11이 `AdminReviewAction`에 `'archive'`를 추가할 때 이 목록만 낡은 채
 * 남았을 것이다.
 */
export type ReviewDecisionAction = AdminReviewAction;

const editUrl = (projectId: string): string => `${SITE_URL}/ko/funding/creator/${projectId}`;
const publicUrl = (slug: string): string => `${SITE_URL}/ko/funding/${slug}`;

const REVIEW_SUBJECT: Record<ReviewDecisionAction, string> = {
  approve: '펀딩 프로젝트가 승인되었습니다',
  request_changes: '펀딩 프로젝트 보완 요청',
  reject: '펀딩 프로젝트 심사 결과',
};

/**
 * 승인된 프로젝트의 리워드는 `lockedAt`이 찍혀 바꿀 수 없는 필드가 생긴다
 * (`creatorProjectWrite.ts`의 `lockedViolation`이 그 규칙의 정본). 개설자가 승인 뒤에
 * 금액을 고치려다 409를 받으면 이유를 모르므로, 승인 메일에서 미리 알려 준다.
 */
const APPROVAL_LOCK_NOTICE = [
  '[승인 뒤에는 바꿀 수 없는 항목]',
  '· 리워드 주소(id)',
  '· 리워드 금액',
  '· 리워드 수량 제한 여부(한정 ↔ 무제한 전환 불가, 한정 수량은 늘리는 것만 가능)',
  '· 리워드 배송 필요 여부',
  '이 항목을 바꿔야 하면 기존 리워드는 그대로 두고 새 리워드를 추가해 주세요.',
];

/**
 * 심사 판정을 개설자에게 알린다. 수신자는 `fundingCreators.email` 하나뿐이다
 * (운영자는 심사를 직접 실행한 당사자라 결과를 이미 안다).
 *
 * `slug`를 `project.slug`와 별도 인자로 받는 이유: 승인 시 운영자가 슬러그를 새로
 * 확정할 수 있어(`decideProject`), 조회 시점의 `project.slug`와 실제로 공개되는 주소가
 * 다를 수 있다.
 *
 * **메일 실패는 판정을 실패시키지 않는다** — 실패 사유 문자열을 돌려줄 뿐이고, 호출부
 * (심사 API)가 그 값을 화면에 보여준다.
 */
export const sendReviewDecisionEmail = async (
  project: AdminProjectDetail,
  action: ReviewDecisionAction,
  note: string | null,
  slug: string,
): Promise<string | null> => {
  const subject = `[스튜디오 놀] ${REVIEW_SUBJECT[action]} — ${project.title}`;
  const startAtLabel = new Date(project.startAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });

  const bodyByAction: Record<ReviewDecisionAction, string[]> = {
    approve: [
      '펀딩 프로젝트가 승인되어 공개되었습니다.',
      '',
      `공개 주소: ${publicUrl(slug)}`,
      `모금 시작일: ${startAtLabel}`,
      '',
      ...APPROVAL_LOCK_NOTICE,
      '',
      `편집 화면: ${editUrl(project.id)}`,
    ],
    request_changes: [
      '제출하신 펀딩 프로젝트에 보완이 필요합니다.',
      '',
      '[운영자 메모]',
      note ?? '',
      '',
      `아래 편집 화면에서 내용을 고친 뒤 다시 제출해 주세요: ${editUrl(project.id)}`,
    ],
    reject: [
      '제출하신 펀딩 프로젝트 심사 결과를 안내드립니다. 이번 심사에서는 게재가 어렵습니다.',
      '',
      '[운영자 메모]',
      note ?? '',
      '',
      `문의: ${CUSTOMER_REPLY_TO} · ${PHONE_NUMBER}`,
    ],
  };

  const result = await sendEmail({
    to: project.creatorEmail,
    replyTo: CUSTOMER_REPLY_TO,
    subject,
    text: [`${project.creatorName}님,`, '', ...bodyByAction[action], '', PHONE].join('\n'),
  });
  return result.ok ? null : `creator:${result.errorCode}`;
};

/**
 * 개설자 알림 메일이 실패했을 때의 폴백 — 운영자에게 직접 연락하라고 알린다.
 *
 * 이 태스크가 막으려던 상태는 "판정은 됐는데 개설자는 통보를 못 받는데 아무도 모르는 것"이다.
 * `sendReviewDecisionEmail` 실패는 지금 심사 API 응답의 `warnings`에만 남고, 운영자가 그
 * 응답 화면을 닫거나 새로고침하면 사실 자체가 사라진다(판정은 프로젝트당 사실상 한 번이라
 * 다시 눌러도 `conflict`만 돌아온다). DB 컬럼을 추가해 영속 기록·재발송 액션을 만드는 것이
 * 정공법이지만 이 계획(Task 5)은 마이그레이션이 범위 밖이다 — 그래서 **마이그레이션 없이
 * 되는 것**만 한다: 운영자 개인 메일함으로 즉시 알린다. 영속 기록·재발송 UI는 4차로 넘긴다.
 *
 * 이 폴백 자체가 실패해도(Resend 장애 등) 판정을 실패시키지 않는다 — 호출부가 그 사유도
 * `warnings`에 추가로 쌓고 `console.error`로 남긴다.
 */
export const sendReviewDecisionOperatorFallback = async (
  project: AdminProjectDetail,
  action: ReviewDecisionAction,
  slug: string,
  failureReason: string,
): Promise<string | null> => {
  const subject = `[펀딩] 심사 알림 메일 실패 — ${project.title}`;
  const text = [
    '개설자에게 심사 결과 메일을 보내지 못했습니다. 아래 정보로 직접 연락해 주세요.',
    '',
    `프로젝트: ${project.title} (id: ${project.id})`,
    `판정: ${REVIEW_SUBJECT[action]}`,
    `개설자: ${project.creatorName} <${project.creatorEmail}>`,
    `공개 주소: ${publicUrl(slug)}`,
    `실패 사유: ${failureReason}`,
    '',
    `심사 화면: ${editUrl(project.id)}`,
  ].join('\n');

  const result = await sendEmail({ to: OPERATOR_EMAIL, subject, text });
  return result.ok ? null : `operator:${result.errorCode}`;
};
