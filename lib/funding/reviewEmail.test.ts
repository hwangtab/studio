jest.mock('../email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));
import { sendEmail } from '../email/resend';
import { CUSTOMER_REPLY_TO, OPERATOR_EMAIL } from '../operatorContact';

import {
  sendCreatorEditedNotice,
  sendReviewDecisionEmail,
  sendReviewDecisionOperatorFallback,
  sendPublicStatusEmail,
  sendPublicStatusOperatorFallback,
} from './reviewEmail';

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
  internalNote: null,
  creatorTermsVersion: 'funding-creator-terms-2026-09-18',
  creatorEditedAt: null,
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
  expect(call.text).toContain('통째로 잠깁니다');
  expect(call.text).toContain('제목·설명·이미지·금액·수량 제한 여부·배송 필요 여부·예상 전달 시기');
  // 승인 뒤에는 개설자도 관리자 API도 리워드를 추가할 경로가 없다(creatorProjectWrite.ts의
  // guard가 upsertReward를 맨 앞에서 거부, 관리자 쪽엔 애초에 리워드 라우트가 없다).
  // "기존 리워드는 두고 새 리워드를 추가하라"는 존재하지 않는 경로를 안내하면 안 된다.
  expect(call.text).not.toContain('새 리워드를 추가');
  expect(call.text).toContain('새 프로젝트로 다시 신청');
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

it('보관 메일 — 제목이 반려와 다르고("심사에서 게재가 어렵다"가 아니다), 운영자 메모·재개설 안내가 들어간다', async () => {
  await sendReviewDecisionEmail(project, 'archive', '오래 방치되어 정리합니다.', 'old-slug');
  const call = (sendEmail as jest.Mock).mock.calls[0][0];
  expect(call.subject).toBe('[스튜디오 놀] 펀딩 프로젝트가 보관 처리되었습니다 — 강정피스앤뮤직캠프');
  expect(call.text).toContain('오래 방치되어 정리합니다.');
  expect(call.text).not.toContain('이번 심사에서는 게재가 어렵습니다');
  expect(call.text).toContain('새 프로젝트를 만들어 주세요');
  expect(call.text).not.toContain('/ko/funding/creator/proj-1');
  expect(call.text).not.toContain('/ko/funding/old-slug');
});

it('메일 발송 실패는 실패 사유 문자열을 돌려준다', async () => {
  (sendEmail as jest.Mock).mockResolvedValueOnce({ ok: false, errorCode: 'API_ERROR' });
  expect(await sendReviewDecisionEmail(project, 'approve', null, 'new-slug')).toBe('creator:API_ERROR');
});

describe('sendCreatorEditedNotice', () => {
  it('수정 알림은 관리자 심사 화면으로 링크한다', async () => {
    await sendCreatorEditedNotice(project);
    const text = (sendEmail as jest.Mock).mock.calls[0][0].text as string;
    expect(text).toContain('/admin/funding/projects/proj-1');
    expect(text).not.toContain('/ko/funding/creator/proj-1');
  });

  it('수신자는 운영자이고, 제목·본문에 프로젝트·개설자·공개 주소가 들어간다', async () => {
    expect(await sendCreatorEditedNotice(project)).toBeNull();
    const call = (sendEmail as jest.Mock).mock.calls[0][0];
    expect(call.to).toBe(OPERATOR_EMAIL);
    expect(call.subject).toContain('강정피스앤뮤직캠프');
    expect(call.text).toContain('creator@example.com');
    expect(call.text).toContain('/ko/funding/old-slug');
  });

  it('메일 발송 실패는 실패 사유 문자열을 돌려준다', async () => {
    (sendEmail as jest.Mock).mockResolvedValueOnce({ ok: false, errorCode: 'API_ERROR' });
    expect(await sendCreatorEditedNotice(project)).toBe('operator:API_ERROR');
  });
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

describe('sendPublicStatusEmail', () => {
  it('종료 메일 — 제목·페이지가 남는다는 안내·운영자 메모, 승인 메일과 제목이 다르다', async () => {
    expect(await sendPublicStatusEmail(project, 'close', '가격 표기 오류 발견', 'old-slug')).toBeNull();
    const call = (sendEmail as jest.Mock).mock.calls[0][0];
    expect(call.to).toBe('creator@example.com');
    expect(call.subject).toBe('[스튜디오 놀] 펀딩 프로젝트가 종료되었습니다 — 강정피스앤뮤직캠프');
    expect(call.subject).not.toBe('[스튜디오 놀] 펀딩 프로젝트가 승인되었습니다 — 강정피스앤뮤직캠프');
    expect(call.text).toContain('/ko/funding/old-slug');
    expect(call.text).toContain('가격 표기 오류 발견');
    expect(call.text).toContain('더 이상 후원을 받지 않습니다');
  });

  it('다시 열기 메일 — 제목·공개 주소, 메모가 없으면 [운영자 메모] 섹션이 없다', async () => {
    await sendPublicStatusEmail(project, 'reopen', null, 'old-slug');
    const call = (sendEmail as jest.Mock).mock.calls[0][0];
    expect(call.subject).toBe('[스튜디오 놀] 펀딩 프로젝트가 다시 공개되었습니다 — 강정피스앤뮤직캠프');
    expect(call.text).toContain('/ko/funding/old-slug');
    expect(call.text).not.toContain('[운영자 메모]');
  });

  it('숨김 메일 — 목록·사이트맵에서 빠진다는 것과 주소를 아는 사람은 여전히 볼 수 있다는 것을 함께 말한다', async () => {
    await sendPublicStatusEmail(project, 'hide', null, 'old-slug');
    const call = (sendEmail as jest.Mock).mock.calls[0][0];
    expect(call.subject).toBe('[스튜디오 놀] 펀딩 프로젝트가 목록에서 숨겨졌습니다 — 강정피스앤뮤직캠프');
    expect(call.text).toContain('목록·사이트맵에서 숨겨졌습니다');
    expect(call.text).toContain('여전히 페이지를 볼 수 있습니다');
  });

  it('노출 메일 — 제목·공개 주소', async () => {
    await sendPublicStatusEmail(project, 'unhide', null, 'old-slug');
    const call = (sendEmail as jest.Mock).mock.calls[0][0];
    expect(call.subject).toBe('[스튜디오 놀] 펀딩 프로젝트가 다시 목록에 노출됩니다 — 강정피스앤뮤직캠프');
    expect(call.text).toContain('/ko/funding/old-slug');
  });

  it('메일 발송 실패는 실패 사유 문자열을 돌려준다', async () => {
    (sendEmail as jest.Mock).mockResolvedValueOnce({ ok: false, errorCode: 'API_ERROR' });
    expect(await sendPublicStatusEmail(project, 'close', '사유', 'old-slug')).toBe('creator:API_ERROR');
  });
});

describe('sendPublicStatusOperatorFallback', () => {
  it('수신자는 운영자이고, 본문에 개설자 이메일·변경 종류·실패 사유·관리자 심사 링크가 들어간다', async () => {
    expect(
      await sendPublicStatusOperatorFallback(project, 'close', 'old-slug', 'creator:API_ERROR'),
    ).toBeNull();
    const call = (sendEmail as jest.Mock).mock.calls[0][0];
    expect(call.to).toBe(OPERATOR_EMAIL);
    expect(call.text).toContain('creator@example.com');
    expect(call.text).toContain('펀딩 프로젝트가 종료되었습니다');
    expect(call.text).toContain('creator:API_ERROR');
    expect(call.text).toContain(`/admin/funding/projects/${project.id}`);
  });

  it('폴백 메일 발송도 실패하면 operator: 접두 실패 사유 문자열을 돌려준다', async () => {
    (sendEmail as jest.Mock).mockResolvedValueOnce({ ok: false, errorCode: 'TIMEOUT' });
    expect(
      await sendPublicStatusOperatorFallback(project, 'hide', 'old-slug', 'creator:API_ERROR'),
    ).toBe('operator:TIMEOUT');
  });
});
