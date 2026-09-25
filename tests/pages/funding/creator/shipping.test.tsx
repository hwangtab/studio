import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// 이 페이지 모듈은 최상위에서 `lib/funding/creatorAuth`를 import한다(getServerSideProps용) —
// 그 파일이 물고 있는 iron-session → uncrypto(ESM)가 jsdom 트랜스폼 밖이라 그대로 두면
// 파싱이 깨진다. `tests/pages/funding/creator/editSections.test.tsx`와 같은 이유·같은 처방.
jest.mock('../../../../lib/funding/creatorAuth', () => ({ authenticateCreatorRequest: jest.fn() }));
jest.mock('../../../../lib/funding/creatorProjectWrite', () => ({ loadProjectForCreator: jest.fn() }));
jest.mock('../../../../lib/funding/creatorShipping', () => ({ loadCreatorShipping: jest.fn() }));
// ShippingTable이 부르는 클라이언트 API. 리뷰 지적(I3): 저장 버튼이 실제로 이 함수를
// **올바른 projectId로** 부르는지 확인하는 테스트가 없었다 — GSSP의 `projectId: id`가
// 리팩터에서 빠지면(또는 다른 값으로 바뀌면) 요청 URL이 깨져 전 행의 저장이 실패하는데,
// 타입 검사도(선택적 prop이 되는 순간) 렌더 스냅샷도 이걸 못 잡는다.
jest.mock('../../../../components/funding/creator/api', () => ({ saveFulfillment: jest.fn() }));
jest.mock('../../../../lib/privacy/accessLog', () => ({
  ...jest.requireActual('../../../../lib/privacy/accessLog'),
  recordPrivacyAccess: jest.fn(),
}));

// eslint-disable-next-line import/first
import CreatorShippingPage, { getServerSideProps } from '../../../../pages/[locale]/funding/creator/[id]/shipping';
// eslint-disable-next-line import/first
import { authenticateCreatorRequest } from '../../../../lib/funding/creatorAuth';
// eslint-disable-next-line import/first
import { loadProjectForCreator, type CreatorProjectDetail } from '../../../../lib/funding/creatorProjectWrite';
// eslint-disable-next-line import/first
import { loadCreatorShipping, type CreatorShippingRow, type CreatorShippingSummary } from '../../../../lib/funding/creatorShipping';
// eslint-disable-next-line import/first
import { saveFulfillment } from '../../../../components/funding/creator/api';
// eslint-disable-next-line import/first
import { recordPrivacyAccess } from '../../../../lib/privacy/accessLog';

const resStub = () => ({ setHeader: jest.fn() }) as unknown as import('http').ServerResponse;

/** GSSP의 context.req — 접속기록이 IP를 뽑을 때 socket을 본다(lib/contracts/client-ip.ts). */
const reqStub = () => ({ headers: {}, cookies: {}, socket: { remoteAddress: '203.0.113.9' } });

const mockAuth = (creatorId: string) => {
  (authenticateCreatorRequest as jest.Mock).mockResolvedValue({ ok: true, creatorId });
};

const PROJECT = { id: 'proj-1', title: '강정피스앤뮤직캠프' } as unknown as CreatorProjectDetail;

const SUMMARY: CreatorShippingSummary = {
  backerCount: 12,
  shippingRequiredCount: 5,
  byReward: [{ rewardId: 'basic', rewardTitle: '기본 리워드', quantity: 12, requiresShipping: true }],
};

const ROW: CreatorShippingRow = {
  shipHold: '',
  pledgeId: 'pledge-1',
  rewardId: 'basic',
  rewardTitle: '기본 리워드',
  quantity: 1,
  shippingName: '홍길동',
  shippingPhone: '010-1111-2222',
  shippingPostcode: '03000',
  shippingAddress1: '서울시 은평구 어딘가로 1',
  shippingAddress2: '101동 202호',
  shippingMemo: null,
  fulfillmentStatus: 'none',
  trackingCompany: null,
  trackingNumber: null,
};

describe('개설자 배송 화면', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (recordPrivacyAccess as jest.Mock).mockResolvedValue(undefined);
  });

  it('모금 중에는 집계만 보이고 배송지 칸이 없다', () => {
    render(
      <CreatorShippingPage
        view={{ state: 'before_close', summary: SUMMARY }}
        projectTitle="제목"
        projectId="proj-1"
      />,
    );
    expect(screen.getByText(/마감 뒤에 열립니다/)).toBeInTheDocument();
    expect(screen.queryByText('배송지')).not.toBeInTheDocument();
    // 집계는 마감 전에도 보인다.
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('마감 뒤에는 배송지가 보인다', () => {
    render(
      <CreatorShippingPage
        view={{ state: 'open', summary: SUMMARY, rows: [ROW] }}
        projectTitle="제목"
        projectId="proj-1"
      />,
    );
    expect(screen.getByText('홍길동')).toBeInTheDocument();
    expect(screen.getByText(/서울시 은평구/)).toBeInTheDocument();
  });

  describe('발송 상태 저장', () => {
    it('저장 버튼을 누르면 올바른 인자로 API를 부른다', async () => {
      (saveFulfillment as jest.Mock).mockResolvedValue({ ok: true });
      render(
        <CreatorShippingPage
          view={{ state: 'open', summary: SUMMARY, rows: [ROW] }}
          projectTitle="제목"
          projectId="proj-1"
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: '저장' }));

      expect(saveFulfillment).toHaveBeenCalledTimes(1);
      // projectId는 GSSP가 내려준 값(props.projectId) 그대로여야 한다 — 이게 빠지거나
      // 다른 값으로 바뀌면 요청 URL이 깨져 저장이 조용히 실패한다.
      expect(saveFulfillment).toHaveBeenCalledWith('proj-1', {
        pledgeId: 'pledge-1',
        fulfillmentStatus: 'none',
        trackingCompany: '',
        trackingNumber: '',
      });
      expect(await screen.findByText('저장했습니다.')).toBeInTheDocument();
    });

    it('저장 실패 시 서버가 준 한국어 오류 메시지를 행 아래에 보여준다', async () => {
      (saveFulfillment as jest.Mock).mockResolvedValue({ ok: false, message: '모금이 끝난 뒤에만 발송 상태를 바꿀 수 있습니다.' });
      render(
        <CreatorShippingPage
          view={{ state: 'open', summary: SUMMARY, rows: [ROW] }}
          projectTitle="제목"
          projectId="proj-1"
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: '저장' }));

      expect(await screen.findByText('모금이 끝난 뒤에만 발송 상태를 바꿀 수 있습니다.')).toBeInTheDocument();
    });
  });

  describe('getServerSideProps', () => {
    it('비-ko 로케일은 ko로 보낸다', async () => {
      const res = resStub();
      const result = await getServerSideProps({
        params: { locale: 'en', id: 'proj-1' }, query: {}, req: reqStub(), res,
      } as never);
      expect(result).toMatchObject({ redirect: { destination: expect.stringContaining('/ko/') } });
      expect(authenticateCreatorRequest).not.toHaveBeenCalled();
    });

    it('GSSP 응답은 no-store다', async () => {
      mockAuth('creator-a');
      (loadProjectForCreator as jest.Mock).mockResolvedValue(PROJECT);
      (loadCreatorShipping as jest.Mock).mockResolvedValue({ state: 'before_close', summary: SUMMARY });
      const res = resStub();
      await getServerSideProps({
        params: { locale: 'ko', id: 'proj-1' }, query: {}, req: reqStub(), res,
      } as never);
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    });

    it('세션 없음 → /ko/funding/apply로 redirect', async () => {
      (authenticateCreatorRequest as jest.Mock).mockResolvedValue({ ok: false });
      const res = resStub();
      const result = await getServerSideProps({
        params: { locale: 'ko', id: 'proj-1' }, query: {}, req: reqStub(), res,
      } as never);
      expect(result).toEqual({ redirect: { destination: '/ko/funding/apply', permanent: false } });
      expect(loadCreatorShipping).not.toHaveBeenCalled();
    });

    it('GSSP는 남의 프로젝트에 404를 낸다', async () => {
      mockAuth('creator-b');
      (loadProjectForCreator as jest.Mock).mockResolvedValue(null);
      const res = resStub();
      const result = await getServerSideProps({
        params: { locale: 'ko', id: 'proj-of-a' }, query: {}, req: reqStub(), res,
      } as never);
      expect(result).toEqual({ notFound: true });
      expect(loadCreatorShipping).not.toHaveBeenCalled();
    });

    it('loadCreatorShipping이 null이면 404를 낸다(소유 재대조 실패)', async () => {
      mockAuth('creator-a');
      (loadProjectForCreator as jest.Mock).mockResolvedValue(PROJECT);
      (loadCreatorShipping as jest.Mock).mockResolvedValue(null);
      const res = resStub();
      const result = await getServerSideProps({
        params: { locale: 'ko', id: 'proj-1' }, query: {}, req: reqStub(), res,
      } as never);
      expect(result).toEqual({ notFound: true });
    });

    it('정상 조회 → props에 view·projectTitle이 실린다', async () => {
      mockAuth('creator-a');
      (loadProjectForCreator as jest.Mock).mockResolvedValue(PROJECT);
      const view = { state: 'open' as const, summary: SUMMARY, rows: [ROW] };
      (loadCreatorShipping as jest.Mock).mockResolvedValue(view);
      const res = resStub();
      const result = await getServerSideProps({
        params: { locale: 'ko', id: 'proj-1' }, query: {}, req: reqStub(), res,
      } as never);
      const props = (result as unknown as { props: { view: unknown; projectTitle: string } }).props;
      expect(props.projectTitle).toBe('강정피스앤뮤직캠프');
      expect(props.view).toEqual(view);
      expect(loadCreatorShipping).toHaveBeenCalledWith('creator-a', 'proj-1');
    });
  });

  /**
   * 화면도 CSV와 같은 행·같은 항목을 `__NEXT_DATA__`에 실어 보낸다 — 나가는 범위가 같으니
   * 같은 action으로 남아야 한다. 전 경로를 한자리에서 보는 계약 테스트는
   * `tests/api/privacy/exportAccessLog.test.ts`에 있다.
   */
  describe('접속기록', () => {
    it('마감 뒤 열람은 개설자·프로젝트·건수로 남는다', async () => {
      mockAuth('creator-a');
      (loadProjectForCreator as jest.Mock).mockResolvedValue(PROJECT);
      (loadCreatorShipping as jest.Mock).mockResolvedValue({ state: 'open', summary: SUMMARY, rows: [ROW, ROW] });
      await getServerSideProps({
        params: { locale: 'ko', id: 'proj-1' }, query: {}, req: reqStub(), res: resStub(),
      } as never);
      expect(recordPrivacyAccess).toHaveBeenCalledWith({
        actor: 'creator:creator-a',
        action: 'funding_creator_shipping_export',
        targetId: 'proj-1',
        result: 'success',
        rowCount: 2,
        ip: '203.0.113.9',
      });
    });

    it('배송지 값은 기록 인자에 담기지 않는다', async () => {
      mockAuth('creator-a');
      (loadProjectForCreator as jest.Mock).mockResolvedValue(PROJECT);
      (loadCreatorShipping as jest.Mock).mockResolvedValue({ state: 'open', summary: SUMMARY, rows: [ROW] });
      await getServerSideProps({
        params: { locale: 'ko', id: 'proj-1' }, query: {}, req: reqStub(), res: resStub(),
      } as never);
      const logged = JSON.stringify((recordPrivacyAccess as jest.Mock).mock.calls);
      for (const secret of ['홍길동', '010-1111-2222', '서울시 은평구 어딘가로 1', '101동 202호']) {
        expect(logged).not.toContain(secret);
      }
    });

    it('마감 전 열람은 남기지 않는다 — 개인정보가 한 줄도 나가지 않는다', async () => {
      mockAuth('creator-a');
      (loadProjectForCreator as jest.Mock).mockResolvedValue(PROJECT);
      (loadCreatorShipping as jest.Mock).mockResolvedValue({ state: 'before_close', summary: SUMMARY });
      await getServerSideProps({
        params: { locale: 'ko', id: 'proj-1' }, query: {}, req: reqStub(), res: resStub(),
      } as never);
      expect(recordPrivacyAccess).not.toHaveBeenCalled();
    });

    it('남의 프로젝트(404)는 남기지 않는다', async () => {
      mockAuth('creator-b');
      (loadProjectForCreator as jest.Mock).mockResolvedValue(null);
      const result = await getServerSideProps({
        params: { locale: 'ko', id: 'proj-of-a' }, query: {}, req: reqStub(), res: resStub(),
      } as never);
      expect(result).toEqual({ notFound: true });
      expect(recordPrivacyAccess).not.toHaveBeenCalled();
    });

    it('세션이 없으면 남기지 않는다', async () => {
      (authenticateCreatorRequest as jest.Mock).mockResolvedValue({ ok: false });
      await getServerSideProps({
        params: { locale: 'ko', id: 'proj-1' }, query: {}, req: reqStub(), res: resStub(),
      } as never);
      expect(recordPrivacyAccess).not.toHaveBeenCalled();
    });

    it('기록이 실패해도 화면은 정상으로 뜬다', async () => {
      mockAuth('creator-a');
      (loadProjectForCreator as jest.Mock).mockResolvedValue(PROJECT);
      const view = { state: 'open' as const, summary: SUMMARY, rows: [ROW] };
      (loadCreatorShipping as jest.Mock).mockResolvedValue(view);
      // 실제 recordPrivacyAccess는 절대 던지지 않지만(lib/privacy/accessLog.ts), 그 규약이
      // 깨져도 열람 화면이 500으로 죽지 않아야 한다.
      (recordPrivacyAccess as jest.Mock).mockRejectedValue(new Error('기록 실패'));
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const result = await getServerSideProps({
        params: { locale: 'ko', id: 'proj-1' }, query: {}, req: reqStub(), res: resStub(),
      } as never);
      expect((result as unknown as { props: { view: unknown } }).props.view).toEqual(view);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
