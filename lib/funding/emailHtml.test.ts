/** @jest-environment node */
/**
 * 펀딩 메일의 HTML 본문 — 공용 레이아웃(lib/email/layout.ts)을 입혔는지, 핵심 값·딥링크가 들어가는지,
 * 사용자 입력(후원자 이름·닉네임·메시지·개설자 이름·프로젝트 제목)이 HTML로 해석되지 않는지 본다.
 * text 본문은 email.test.ts 등 기존 테스트가 단언한다.
 */
jest.mock('../email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('../booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));

import { sendEmail } from '../email/resend';

import { alertMissingDownloadObject } from './downloadAlert';
import {
  SITE_URL,
  sendCreatorLoginCapAlert,
  sendCreatorLoginMailFailureAlert,
  sendCreatorSessionFailureAlert,
  sendFundingCancelledEmails,
  sendFundingConfirmedEmails,
  sendFundingCreatorSubmissionEmail,
  sendFundingCreatorWithdrawalEmail,
  sendFundingDepositGuideEmails,
  sendFundingLineRefundEmails,
  sendFundingListingNicknameAlert,
  sendFundingRefundRequestClearedEmails,
} from './email';
import {
  sendCreatorAccountOperatorFallback,
  sendCreatorEmailChangedEmails,
  sendCreatorLoginEmail,
  sendCreatorNameChangedEmail,
} from './creatorEmail';
import { sendFundingPayoutOperatorFallback, sendFundingPayoutPaidEmail, sendFundingPayoutRecordedEmail } from './payoutEmail';
import {
  sendCreatorEditedNotice,
  sendPublicStatusEmail,
  sendPublicStatusOperatorFallback,
  sendReviewDecisionEmail,
  sendReviewDecisionOperatorFallback,
} from './reviewEmail';

import type { AdminProjectDetail } from './adminProjects';
import type { CreatorProjectDetail } from './creatorProjectWrite';

const mock = sendEmail as jest.Mock;
const sent = (i: number) => mock.mock.calls[i][0] as { to: string; subject: string; text?: string; html?: string };

const ATTACK = '<script>alert(1)</script>';
const ATTACK_IMG = '<img src=x onerror=alert(1)>';
const expectNoInjection = (html: string | undefined) => {
  expect(html).toBeDefined();
  expect(html).not.toContain('<script>alert');
  expect(html).not.toContain('<img src=x');
  expect(html).not.toContain('onerror=alert(1)>');
};

const order = {
  id: 'ord-1', orderNo: 'FND-20261015-ABCDEF12', type: 'funding', status: 'paid', manageToken: 'tok',
  customerName: '김후원', customerPhone: '010-1111-2222', customerEmail: 'a@b.com', itemAmount: 4545, vatAmount: 455, totalAmount: 5000,
  notificationError: null, createdAt: new Date(), updatedAt: new Date(), payments: [],
  fundingPledge: {
    id: 'p', orderId: 'ord-1', projectSlug: 'demo', rewardId: 'mail', rewardTitle: '감사 메일', unitAmount: 5000, quantity: 1, additionalAmount: 0,
    paymentMethod: 'toss', holdExpiresAt: new Date('2026-10-15T15:00:00Z'), paidAt: null, supporterMessage: '응원합니다', displayNamePublic: true, publicName: null,
    shippingName: null, shippingPhone: null, shippingPostcode: null, shippingAddress1: null, shippingAddress2: null, shippingMemo: null,
    fulfillmentStatus: 'none', trackingCompany: null, trackingNumber: null, entrySource: 'online', refundRequestedAt: null, adminMemo: null,
    createdAt: new Date(), updatedAt: new Date(),
  },
} as never;
const project = {
  title: '데모 앨범',
  rewards: [{ id: 'mail', estimatedDelivery: '2026-11', downloads: [{ label: 'MP3 음원', key: 'k' }] }],
} as never;

const withUserInput = {
  ...(order as object),
  customerName: ATTACK,
  fundingPledge: { ...(order as { fundingPledge: object }).fundingPledge, supporterMessage: ATTACK_IMG, publicName: ATTACK_IMG, rewardTitle: ATTACK },
} as never;
const evilProject = { title: ATTACK, rewards: [{ id: 'mail', estimatedDelivery: '2026-11', downloads: [{ label: ATTACK_IMG, key: 'k' }] }] } as never;

beforeEach(() => mock.mockClear());

describe('후원 확정', () => {
  it('고객: html을 text와 함께 보내고 프로젝트·리워드·금액·결제수단·확인 링크·안내를 싣는다', async () => {
    await sendFundingConfirmedEmails(order, project);
    const customer = sent(0);
    expect(customer.text).toContain('감사 메일');
    expect(customer.html).toContain('<!DOCTYPE html>');
    for (const expected of ['데모 앨범', '감사 메일', '5,000원', '토스', '/ko/funding/manage/FND-20261015-ABCDEF12?token=tok', 'MP3 음원', '청약철회', '/ko/funding/terms']) {
      expect(customer.html).toContain(expected);
    }
    expect(customer.html).not.toContain('운영 알림');
  });

  it('운영자: 후원자·금액이 표 위쪽, 건별 딥링크 버튼', async () => {
    await sendFundingConfirmedEmails(order, project);
    const operator = sent(1);
    expect(operator.to).not.toBe('a@b.com');
    expect(operator.html).toContain('운영 알림');
    for (const expected of ['김후원', '5,000원', '토스', '응원합니다', '010-1111-2222', 'a@b.com']) {
      expect(operator.html).toContain(expected);
    }
    expect(operator.html).toContain(`href="${SITE_URL}/admin/funding/ord-1"`);
    expect((operator.html as string).indexOf('후원자')).toBeLessThan((operator.html as string).indexOf('연락처'));
  });

  it('사용자 입력(이름·리워드·닉네임·메시지·프로젝트 제목·파일명)이 HTML로 해석되지 않는다', async () => {
    await sendFundingConfirmedEmails(withUserInput, evilProject);
    expectNoInjection(sent(0).html);
    expectNoInjection(sent(1).html);
    expect(sent(0).html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});

describe('계좌 입금 안내', () => {
  const bank = {
    ...(order as object),
    fundingPledge: { ...(order as { fundingPledge: object }).fundingPledge, paymentMethod: 'bank_transfer' },
  } as never;

  it('고객: 계좌·금액·보내는 분 이름·확인 링크', async () => {
    await sendFundingDepositGuideEmails(bank, project);
    const customer = sent(0);
    expect(customer.html).toContain('계좌 입금 안내');
    for (const expected of ['5,000원', '김후원', '/ko/funding/manage/FND-20261015-ABCDEF12?token=tok']) {
      expect(customer.html).toContain(expected);
    }
  });

  it('운영자: 입금 확인 행동을 긴급 안내로, 건별 딥링크', async () => {
    await sendFundingDepositGuideEmails(bank, project);
    const operator = sent(1);
    expect(operator.html).toContain('운영 알림 · 긴급');
    expect(operator.html).toContain('입금 확인');
    expect(operator.html).toContain(`href="${SITE_URL}/admin/funding/ord-1"`);
    expect(operator.html).toContain('자동 취소 없음');
  });

  it('입력은 escape된다', async () => {
    await sendFundingDepositGuideEmails(withUserInput, evilProject);
    expectNoInjection(sent(0).html);
    expectNoInjection(sent(1).html);
  });
});

describe('취소·환불·철회', () => {
  it('취소: 고객 html에 환불 금액, 운영자는 목록이 아니라 건별 링크', async () => {
    await sendFundingCancelledEmails(order, project, 'refunded', 3000);
    expect(sent(0).html).toContain('3,000원');
    expect(sent(1).html).toContain(`href="${SITE_URL}/admin/funding/ord-1"`);
    expect(sent(1).html).not.toContain(`href="${SITE_URL}/admin/funding"`);
  });

  it('일부 환불: 환불 리워드·금액·사유, 운영자 건별 링크, escape', async () => {
    const refund = { rewardTitle: '감사 메일', quantity: 1, amount: 5000, reason: ATTACK };
    await sendFundingLineRefundEmails(order, project, refund);
    expect(sent(0).html).toContain('나머지 리워드는 그대로 진행됩니다');
    expect(sent(0).html).toContain('5,000원');
    expect(sent(1).html).toContain(`href="${SITE_URL}/admin/funding/ord-1"`);
    expectNoInjection(sent(0).html);
    expectNoInjection(sent(1).html);
  });

  it('취소 요청 철회: 다시 요청하는 링크, 운영자 건별 링크, escape', async () => {
    await sendFundingRefundRequestClearedEmails(order, project, ATTACK);
    expect(sent(0).html).toContain('/ko/funding/manage/FND-20261015-ABCDEF12?token=tok');
    expect(sent(1).html).toContain(`href="${SITE_URL}/admin/funding/ord-1"`);
    expectNoInjection(sent(0).html);
    expectNoInjection(sent(1).html);
  });
});

describe('운영자 알림', () => {
  const creatorProject = { id: 'proj-9', title: ATTACK, creator: { name: ATTACK_IMG, contactName: '담당', phone: '010' } } as unknown as CreatorProjectDetail;

  it('심사 요청·철회: 프로젝트별 심사 화면 딥링크, escape', async () => {
    await sendFundingCreatorSubmissionEmail(creatorProject);
    await sendFundingCreatorWithdrawalEmail(creatorProject);
    for (const i of [0, 1]) {
      expect(sent(i).html).toContain('운영 알림');
      expect(sent(i).html).toContain(`href="${SITE_URL}/admin/funding/projects/proj-9"`);
      expectNoInjection(sent(i).html);
    }
  });

  it('로그인 한도·메일 실패·세션 실패: 긴급 톤, 개설자 목록 링크', async () => {
    await sendCreatorLoginCapAlert(50);
    await sendCreatorLoginMailFailureAlert('x@y.com', ATTACK);
    await sendCreatorSessionFailureAlert();
    for (const i of [0, 1, 2]) {
      expect(sent(i).html).toContain('운영 알림 · 긴급');
      expect(sent(i).html).toContain(`href="${SITE_URL}/admin/funding/projects"`);
      expectNoInjection(sent(i).html);
    }
    expect(sent(0).html).toContain('50통');
    expect(sent(1).html).toContain('x@y.com');
  });

  it('서포터 명단 닉네임: 닉네임·메시지 escape, 건별 링크', async () => {
    await sendFundingListingNicknameAlert(order, ATTACK, ATTACK_IMG);
    expectNoInjection(sent(0).html);
    expect(sent(0).html).toContain(`href="${SITE_URL}/admin/funding/ord-1"`);
    expect(sent(0).html).toContain('서포터 명단에서 내리기');
  });

  it('내려받기 파일 없음: 해야 할 일 안내, 주문 id가 있으면 건별 링크', async () => {
    await alertMissingDownloadObject({ key: 'funding/x.mp3', orderNo: 'FND-1', orderId: 'ord-1' });
    expect(sent(0).html).toContain('funding/x.mp3');
    expect(sent(0).html).toContain('R2 버킷');
    expect(sent(0).html).toContain(`href="${SITE_URL}/admin/funding/ord-1"`);
    expect(sent(0).text).toContain('무엇을 해야 하나');
  });
});

describe('개설자 메일', () => {
  it('로그인 링크: 버튼과 유효기간 안내, 주소 평문 복사 안내', async () => {
    const url = 'https://studionol.co.kr/ko/funding/creator/auth?token=abc';
    await sendCreatorLoginEmail('c@d.com', url);
    expect(sent(0).text).toContain(url);
    expect(sent(0).html).toContain(`href="${url}"`);
    expect(sent(0).html).toContain('15분');
    expect(sent(0).html).toContain('버튼이 눌리지 않으면');
  });

  it('이름·이메일 변경: 이전·새 값·사유를 표로, escape, 양쪽 주소에 html', async () => {
    await sendCreatorNameChangedEmail('c@d.com', ATTACK, ATTACK_IMG, ATTACK);
    expect(sent(0).html).toContain('이전 이름');
    expectNoInjection(sent(0).html);

    mock.mockClear();
    await sendCreatorEmailChangedEmails('old@d.com', 'new@d.com', ATTACK);
    expect(mock).toHaveBeenCalledTimes(2);
    for (const i of [0, 1]) {
      expect(sent(i).html).toContain('old@d.com');
      expect(sent(i).html).toContain('new@d.com');
      expectNoInjection(sent(i).html);
    }
  });

  it('계정 변경 알림 실패 폴백: 운영자에게 대상 주소와 목록 링크', async () => {
    await sendCreatorAccountOperatorFallback('이름', 'c@d.com', ATTACK, ATTACK_IMG, ATTACK, ATTACK);
    expect(sent(0).html).toContain('c@d.com');
    expect(sent(0).html).toContain(`href="${SITE_URL}/admin/funding/projects"`);
    expectNoInjection(sent(0).html);
  });
});

describe('심사·공개 상태 메일', () => {
  const adminProject = {
    id: 'proj-1', slug: 'old-slug', title: ATTACK, status: 'auto', startAt: '2026-09-22T00:00:00.000Z', endAt: '2099-10-22T00:00:00.000Z',
    creatorName: ATTACK_IMG, creatorEmail: 'creator@example.com',
  } as unknown as AdminProjectDetail;

  it.each(['approve', 'request_changes', 'reject', 'archive'] as const)('심사 결과(%s): html 동봉, 운영자 메모 escape', async (action) => {
    await sendReviewDecisionEmail(adminProject, action, ATTACK, 'new-slug');
    expect(sent(0).html).toContain('<!DOCTYPE html>');
    expect(sent(0).html).not.toContain('운영 알림');
    expectNoInjection(sent(0).html);
  });

  it('승인: 공개 주소·편집 버튼·잠금 안내', async () => {
    await sendReviewDecisionEmail(adminProject, 'approve', null, 'new-slug');
    expect(sent(0).html).toContain(`${SITE_URL}/ko/funding/new-slug`);
    expect(sent(0).html).toContain(`${SITE_URL}/ko/funding/creator/proj-1`);
    expect(sent(0).html).toContain('바꿀 수 없는 항목');
  });

  it.each(['close', 'reopen', 'hide', 'unhide'] as const)('공개 상태(%s): html 동봉, escape', async (action) => {
    await sendPublicStatusEmail(adminProject, action, ATTACK, 'new-slug', new Date('2026-10-01T00:00:00Z'));
    expect(sent(0).html).toContain(`${SITE_URL}/ko/funding/new-slug`);
    expectNoInjection(sent(0).html);
  });

  it('운영자 폴백·수정 알림: 심사 화면 딥링크, escape', async () => {
    await sendReviewDecisionOperatorFallback(adminProject, 'approve', 'new-slug', ATTACK);
    await sendPublicStatusOperatorFallback(adminProject, 'close', 'new-slug', ATTACK);
    await sendCreatorEditedNotice({ ...adminProject, slug: 'new-slug' });
    for (const i of [0, 1, 2]) {
      expect(sent(i).html).toContain('운영 알림');
      expect(sent(i).html).toContain(`href="${SITE_URL}/admin/funding/projects/proj-1"`);
      expectNoInjection(sent(i).html);
    }
  });
});

describe('정산 메일', () => {
  const payout = {
    id: 'pay-1', projectId: 'proj-1', grossAmount: 1_000_000, refundAmount: 50_000, supplyAmount: 863_636, feeAmount: 84_550,
    platformFeeAmount: 52_250, paymentFeeAmount: 32_300, shareAmount: 786_773, designFeeOffsetAmount: 0, productionFeeOffsetAmount: 0,
    shortfallAmount: 0, withholdingAmount: 25_964, netAmount: 760_809, backerCount: 12, status: 'paid', paidAt: null, memo: ATTACK,
    createdAt: new Date(), updatedAt: new Date(),
  } as never;
  const account = { bankName: '국민은행', holder: '개설자', accountLast4: '9012', taxType: 'withholding' as const };

  it('확정·송금 완료: 금액 분해를 표로, 실지급액·계좌 뒤 4자리, 전체 계좌번호 없음, 메모 escape', async () => {
    await sendFundingPayoutRecordedEmail('c@d.com', ATTACK, payout, account);
    await sendFundingPayoutPaidEmail('c@d.com', '데모', payout, account);
    for (const i of [0, 1]) {
      for (const expected of ['1,000,000원', '−50,000원', '−52,250원', '−32,300원', '−25,964원', '760,809원', '12건', '9012', '국민은행']) {
        expect(sent(i).html).toContain(expected);
      }
      expectNoInjection(sent(i).html);
    }
  });

  it('html 표가 text와 같은 줄을 갖는다 — 같은 원천에서 만든다', async () => {
    await sendFundingPayoutPaidEmail('c@d.com', '데모', payout, account);
    expect(sent(0).text).toContain('실지급액: 760,809원');
    expect(sent(0).html).toContain('실지급액');
  });

  it('운영자 폴백: 심사 화면 딥링크', async () => {
    await sendFundingPayoutOperatorFallback('proj-1', ATTACK, '정산 기록', 'c@d.com', ATTACK);
    expect(sent(0).html).toContain(`href="${SITE_URL}/admin/funding/projects/proj-1"`);
    expectNoInjection(sent(0).html);
  });
});
