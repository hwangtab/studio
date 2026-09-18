import { CUSTOMER_REPLY_TO } from '../operatorContact';

import { PHONE, PHONE_NUMBER, SITE_URL, send } from './email';

import type { AdminProjectDetail } from './adminProjects';

/** 관리자 심사 화면이 실제로 보낼 수 있는 판정 세 가지(`AdminReviewAction`과 동일하게 유지). */
export type ReviewDecisionAction = 'approve' | 'request_changes' | 'reject';

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
export const sendReviewDecisionEmail = (
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

  return send([
    { key: 'creator', params: {
      to: project.creatorEmail,
      replyTo: CUSTOMER_REPLY_TO,
      subject,
      text: [`${project.creatorName}님,`, '', ...bodyByAction[action], '', PHONE].join('\n'),
    } },
  ]);
};
