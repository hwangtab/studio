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
/**
 * 운영자용 심사 상세 화면. `editUrl`(개설자 인증 페이지, `/ko/funding/creator/{id}`)과는
 * 완전히 다른 경로다 — 개설자에게 보내는 메일에서만 `editUrl`을 쓰고, 운영자에게 보내는
 * 메일은 전부 이 링크를 쓴다. `lib/funding/email.ts`의 `sendFundingCreatorSubmissionEmail`이
 * 이미 같은 경로(`/admin/funding/projects/{id}`)로 심사 요청 알림을 보낸다 — 두 메일이
 * 같은 프로젝트를 가리키는 주소가 갈라지면 운영자가 헷갈린다.
 */
const adminReviewUrl = (projectId: string): string => `${SITE_URL}/admin/funding/projects/${projectId}`;

const REVIEW_SUBJECT: Record<ReviewDecisionAction, string> = {
  approve: '펀딩 프로젝트가 승인되었습니다',
  request_changes: '펀딩 프로젝트 보완 요청',
  reject: '펀딩 프로젝트 심사 결과',
  // DB상 reject와 완전히 같은 처리(reviewStatus: rejected)이지만, 개설자가 받는 메일
  // 제목·본문은 "반려"가 아니라 "보관"이라고 정직하게 말한다 — 심사에서 떨어진 것이
  // 아니라 방치를 정리한 것이라는 사실이 사유(reviewNote)와 함께 그대로 전달돼야 한다.
  archive: '펀딩 프로젝트가 보관 처리되었습니다',
};

/**
 * 승인된 프로젝트의 리워드는 `lockedAt`이 찍혀 바꿀 수 없는 필드가 생긴다
 * (`creatorProjectWrite.ts`의 `lockedViolation`이 그 규칙의 정본). 개설자가 승인 뒤에
 * 금액을 고치려다 409를 받으면 이유를 모르므로, 승인 메일에서 미리 알려 준다.
 */
const APPROVAL_LOCK_NOTICE = [
  '[승인 뒤에는 바꿀 수 없는 항목]',
  '· 리워드는 제목·설명·이미지·금액·수량 제한 여부·배송 필요 여부·예상 전달 시기를 포함해 통째로 잠깁니다.',
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
    // archive는 심사에서 떨어진 것이 아니라 오래 방치된 프로젝트를 운영자가 정리한
    // 것이다 — reject와 같은 문구를 쓰면 "심사에 떨어졌다"로 오해한다. 새 프로젝트를
    // 다시 만들 수 있다는 것도 함께 알린다(보관 처리는 미심사 상한에서 빠지므로).
    archive: [
      '작성 중이던 펀딩 프로젝트가 운영자에 의해 보관 처리되었습니다.',
      '',
      '[운영자 메모]',
      note ?? '',
      '',
      '이 프로젝트는 더 이상 편집·재제출할 수 없습니다. 다시 개설하고 싶으시면 새 프로젝트를 만들어 주세요.',
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
 *
 * 링크는 `editUrl`이 아니라 `adminReviewUrl`이다 — 수신자가 운영자이기 때문이다. `editUrl`은
 * 개설자 인증 페이지(`/ko/funding/creator/{id}`)라 `authenticateCreatorRequest`가 실패하면
 * `/ko/funding/apply`로 돌려보낸다. 리뷰에서 처음엔 이 함수도 `editUrl`을 "심사 화면"이라는
 * 라벨로 썼는데, 개설자 메일(`sendReviewDecisionEmail`)에서 같은 함수를 쓰는 것은 맞지만(수신자가
 * 개설자니까) 이 함수의 수신자는 운영자라 라벨과 대상이 둘 다 틀려 있었다.
 */
/**
 * 승인된 프로젝트를 개설자가 고쳤을 때의 운영자 알림.
 *
 * 승인 뒤 본문 편집은 심사를 거치지 않는다(재심사 대기열을 만들지 않기로 했다) — 그래서
 * 운영자가 "무엇이 바뀌었는지"를 알 유일한 경로가 이 메일과 심사 화면의 표시
 * (`AdminProjectDetail.creatorEditedAt`)다.
 *
 * 마지막 안내는 "심사 화면의 개설자에게 보이는 메모로 연락"까지만 적는다 — 관리자
 * 화면에는 공개된 프로젝트를 종료(status: closed)로 바꾸는 버튼이 아직 없다
 * (`pages/admin/funding/projects/[id].tsx`, 보관은 미심사 상태에서만 가능하다). 없는
 * 경로를 안내하면 운영자가 화면에서 찾아 헤매게 된다.
 */
export const sendCreatorEditedNotice = async (project: AdminProjectDetail): Promise<string | null> => {
  const result = await sendEmail({
    to: OPERATOR_EMAIL,
    subject: `[펀딩] 공개된 프로젝트가 수정되었습니다 — ${project.title}`,
    text: [
      '개설자가 공개된 프로젝트의 내용을 고쳤습니다. 심사를 거치지 않는 경로입니다.',
      '',
      `프로젝트: ${project.title} (id: ${project.id})`,
      `개설자: ${project.creatorName} <${project.creatorEmail}>`,
      `공개 주소: ${publicUrl(project.slug)}`,
      '',
      `관리자 심사 화면: ${adminReviewUrl(project.id)}`,
      '',
      '고친 내용이 문제가 되면 심사 화면의 "개설자에게 보이는 메모"로 연락해 주세요.',
    ].join('\n'),
  });
  return result.ok ? null : `operator:${result.errorCode}`;
};

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
    `관리자 심사 화면: ${adminReviewUrl(project.id)}`,
  ].join('\n');

  const result = await sendEmail({ to: OPERATOR_EMAIL, subject, text });
  return result.ok ? null : `operator:${result.errorCode}`;
};
