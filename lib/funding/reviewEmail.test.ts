jest.mock('../email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));
import { sendEmail } from '../email/resend';
import { CUSTOMER_REPLY_TO, OPERATOR_EMAIL } from '../operatorContact';

import { sendReviewDecisionEmail, sendReviewDecisionOperatorFallback } from './reviewEmail';

import type { AdminProjectDetail } from './adminProjects';

const project = {
  id: 'proj-1',
  slug: 'old-slug',
  title: '강정피스앤뮤직캠프',
  reviewStatus: 'submitted',
  status: 'draft',
  hidden: false,
  submittedAt: '2026-09-15T00:00:00.000Z',
  approvedAt: null,
  creatorName: '김개설',
  creatorEmail: 'creator@example.com',
  goalAmount: 1000000,
  startAt: '2026-09-22T00:00:00.000Z',
  endAt: '2026-10-22T00:00:00.000Z',
  summary: '요약',
  content: '본문',
  coverUrl: '/cover.webp',
  reviewNote: null,
  creator: { contactName: '김개설', phone: '010', bio: null, links: null },
  rewards: [],
} as AdminProjectDetail;

beforeEach(() => (sendEmail as jest.Mock).mockClear());

it('승인 메일 — 제목·공개 주소·잠금 안내·편집 링크', async () => {
  expect(await sendReviewDecisionEmail(project, 'approve', null, 'new-slug')).toBeNull();
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const call = (sendEmail as jest.Mock).mock.calls[0][0];
  expect(call.to).toBe('creator@example.com');
  expect(call.replyTo).toBe(CUSTOMER_REPLY_TO);
  expect(call.subject).toBe('[스튜디오 놀] 펀딩 프로젝트가 승인되었습니다 — 강정피스앤뮤직캠프');
  expect(call.text).toContain('/ko/funding/new-slug');
  expect(call.text).not.toContain('/ko/funding/old-slug');
  expect(call.text).toContain('/ko/funding/creator/proj-1');
  expect(call.text).toContain('리워드 주소(id)');
  expect(call.text).toContain('리워드 금액');
  expect(call.text).toContain('리워드 수량 제한 여부');
  expect(call.text).toContain('리워드 배송 필요 여부');
});

it('보완 요청 메일 — 제목·운영자 메모 전문·편집 링크, 공개 주소는 없다', async () => {
  await sendReviewDecisionEmail(project, 'request_changes', '커버 이미지 해상도가 낮습니다. 다시 올려 주세요.', 'old-slug');
  const call = (sendEmail as jest.Mock).mock.calls[0][0];
  expect(call.subject).toBe('[스튜디오 놀] 펀딩 프로젝트 보완 요청 — 강정피스앤뮤직캠프');
  expect(call.text).toContain('커버 이미지 해상도가 낮습니다. 다시 올려 주세요.');
  expect(call.text).toContain('/ko/funding/creator/proj-1');
  expect(call.text).not.toContain('/ko/funding/old-slug');
});

it('반려 메일 — 제목·운영자 메모 전문·문의 경로, 공개 주소·편집 링크는 없다', async () => {
  await sendReviewDecisionEmail(project, 'reject', '서비스 범위 밖의 프로젝트입니다.', 'old-slug');
  const call = (sendEmail as jest.Mock).mock.calls[0][0];
  expect(call.subject).toBe('[스튜디오 놀] 펀딩 프로젝트 심사 결과 — 강정피스앤뮤직캠프');
  expect(call.text).toContain('서비스 범위 밖의 프로젝트입니다.');
  expect(call.text).toContain(CUSTOMER_REPLY_TO);
  expect(call.text).not.toContain('/ko/funding/creator/proj-1');
  expect(call.text).not.toContain('/ko/funding/old-slug');
});

it('메일 발송 실패는 실패 사유 문자열을 돌려준다', async () => {
  (sendEmail as jest.Mock).mockResolvedValueOnce({ ok: false, errorCode: 'API_ERROR' });
  expect(await sendReviewDecisionEmail(project, 'approve', null, 'new-slug')).toBe('creator:API_ERROR');
});

describe('sendReviewDecisionOperatorFallback', () => {
  it('수신자는 OPERATOR_EMAIL이고, 본문에 개설자 이메일·판정 종류·실패 사유·관리자 심사 링크가 들어간다', async () => {
    expect(
      await sendReviewDecisionOperatorFallback(project, 'approve', 'new-slug', 'creator:API_ERROR'),
    ).toBeNull();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = (sendEmail as jest.Mock).mock.calls[0][0];
    expect(call.to).toBe(OPERATOR_EMAIL);
    expect(call.subject).toContain('강정피스앤뮤직캠프');
    expect(call.text).toContain('creator@example.com');
    expect(call.text).toContain('펀딩 프로젝트가 승인되었습니다');
    expect(call.text).toContain('creator:API_ERROR');
    // 링크는 개설자 인증 페이지(/ko/funding/creator/{id})가 아니라 관리자 심사 화면이어야
    // 한다 — 수신자가 운영자이기 때문이다. 개설자용 editUrl을 잘못 넣으면 운영자가 링크를
    // 눌러도 authenticateCreatorRequest가 실패해 /ko/funding/apply로 되돌아간다.
    expect(call.text).toContain(`/admin/funding/projects/${project.id}`);
    expect(call.text).not.toContain(`/ko/funding/creator/${project.id}`);
  });

  it('폴백 메일 발송도 실패하면 operator: 접두 실패 사유 문자열을 돌려준다', async () => {
    (sendEmail as jest.Mock).mockResolvedValueOnce({ ok: false, errorCode: 'TIMEOUT' });
    expect(
      await sendReviewDecisionOperatorFallback(project, 'reject', 'old-slug', 'creator:API_ERROR'),
    ).toBe('operator:TIMEOUT');
  });
});
