/** @jest-environment node */
/**
 * 개인정보가 **한 번에 목록으로** 빠져나가는 경로는 전부 접속기록(`privacy_access_logs`)에
 * 남는가. 파일 내려받기가 대부분이지만 파일만은 아니다 — 개설자 배송 화면은 CSV와 같은
 * 행·같은 항목을 `__NEXT_DATA__`에 실어 보내므로 같은 종류로 남아야 한다.
 *
 * 라우트마다 흩어 놓지 않고 한 파일에 모은 이유는, 이 검사의 요점이 "어느 라우트가
 * 기록하는가"가 아니라 **"기록하는 라우트가 빠짐없는가"**이기 때문이다. 새 CSV·PDF
 * 다운로드를 만드는 사람이 이 목록을 보고 자기 라우트가 여기 없다는 것을 알아채야 한다.
 *
 * 공통으로 보는 것:
 * 1) 내보내면 기록이 남고 **건수가 맞는다**
 * 2) **내보낸 값이 기록 인자에 담기지 않는다**(직렬화해서 확인한다 — 인자 구조가 바뀌어도
 *    값이 새면 걸린다)
 * 3) **인증이 없으면 기록도 다운로드도 없다**(스키마의 result 주석: 401은 남기지 않는다)
 * 4) **기록이 실패해도 다운로드는 정상이다**(lib/privacy/accessLog.ts의 규약)
 */
jest.mock('../../../lib/privacy/accessLog', () => ({
  ...jest.requireActual('../../../lib/privacy/accessLog'),
  recordAdminPrivacyAccess: jest.fn(),
  recordPrivacyAccess: jest.fn(),
}));
jest.mock('../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn() }));
jest.mock('../../../lib/funding/admin-list', () => ({ listFundingOrdersForExport: jest.fn() }));
jest.mock('../../../lib/ops/salesLedger', () => ({
  ...jest.requireActual('../../../lib/ops/salesLedger'),
  listSalesLedgerRows: jest.fn(),
}));
jest.mock('../../../lib/artistSupport/supporters', () => ({ listSupporterContacts: jest.fn() }));
jest.mock('../../../data/artists', () => ({ getSupportedArtist: jest.fn() }));
jest.mock('../../../lib/funding/creatorAuth', () => ({ authenticateCreatorApi: jest.fn(), authenticateCreatorRequest: jest.fn() }));
jest.mock('../../../lib/funding/creatorProjectWrite', () => ({ loadProjectForCreator: jest.fn() }));
jest.mock('../../../lib/funding/creatorShipping', () => ({ loadCreatorShipping: jest.fn() }));
jest.mock('../../../lib/contact/origin', () => ({ isAllowedContactRequestOrigin: jest.fn().mockReturnValue(true) }));
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../db/client', () => ({ getDb: jest.fn() }));
jest.mock('../../../lib/contracts/pdf-storage', () => ({ loadOrRenderContractPdf: jest.fn() }));

import type { NextApiRequest, NextApiResponse } from 'next';

import { getSupportedArtist } from '../../../data/artists';
import { getDb } from '../../../db/client';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { listSupporterContacts } from '../../../lib/artistSupport/supporters';
import { authenticateAdminApi } from '../../../lib/contracts/admin-auth';
import { loadOrRenderContractPdf } from '../../../lib/contracts/pdf-storage';
import { listFundingOrdersForExport } from '../../../lib/funding/admin-list';
import { authenticateCreatorApi, authenticateCreatorRequest } from '../../../lib/funding/creatorAuth';
import { loadProjectForCreator } from '../../../lib/funding/creatorProjectWrite';
import { loadCreatorShipping } from '../../../lib/funding/creatorShipping';
import { listSalesLedgerRows } from '../../../lib/ops/salesLedger';
import { recordAdminPrivacyAccess, recordPrivacyAccess } from '../../../lib/privacy/accessLog';
import fundingExport from '../../../pages/api/admin/funding/export';
import supportersExport from '../../../pages/api/admin/artists/[slug]/supporters-export';
import salesLedgerExport from '../../../pages/api/admin/orders/export';
import contractPdf from '../../../pages/api/contracts/[id]/pdf';
import creatorShippingCsv from '../../../pages/api/funding/creator/projects/[id]/shipping.csv';
import { getServerSideProps as creatorShippingPage } from '../../../pages/[locale]/funding/creator/[id]/shipping';

type Handler = (req: NextApiRequest, res: NextApiResponse) => Promise<unknown>;

const call = async (handler: Handler, query: Record<string, string>) => {
  const send = jest.fn();
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ send, json });
  const res = { setHeader: jest.fn(), status } as unknown as NextApiResponse;
  await handler({ method: 'GET', query, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, send, json };
};

/** 기록 인자 전체를 직렬화해 본다 — 어느 인자에 섞여도 걸리게. */
const loggedArgs = () =>
  JSON.stringify([
    ...(recordAdminPrivacyAccess as jest.Mock).mock.calls,
    ...(recordPrivacyAccess as jest.Mock).mock.calls,
  ]);

/** CSV·PDF에 실제로 실리는 값들. 이 중 하나라도 기록에 나타나면 접속기록이 사본이 된다. */
const SECRETS = ['김후원', '010-1111-2222', 'a@example.com', '서울시 어딘가 1', '응원합니다'];

const fundingOrder = (orderNo: string) => ({
  orderNo,
  status: 'paid',
  totalAmount: 30000,
  customerName: '김후원',
  customerPhone: '010-1111-2222',
  customerEmail: 'a@example.com',
  fundingPledge: {
    refundRequestedAt: null,
    adminMemo: null,
    paymentMethod: 'toss',
    rewardTitle: '감사 메일',
    quantity: 1,
    additionalAmount: 0,
    shippingName: '김후원',
    shippingPhone: '010-1111-2222',
    shippingPostcode: '12345',
    shippingAddress1: '서울시 어딘가 1',
    shippingAddress2: null,
    shippingMemo: null,
    fulfillmentStatus: 'pending',
    trackingCompany: null,
    trackingNumber: null,
    supporterMessage: '응원합니다',
    paidAt: new Date('2026-10-01T00:00:00Z'),
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true, actor: 'kyungha', name: '황경하' });
  (recordAdminPrivacyAccess as jest.Mock).mockResolvedValue(undefined);
  (recordPrivacyAccess as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('펀딩 주문 CSV (pages/api/admin/funding/export.ts)', () => {
  beforeEach(() => {
    (listFundingOrdersForExport as jest.Mock).mockResolvedValue([fundingOrder('F1'), fundingOrder('F2')]);
  });

  it('내보내면 기록이 남고 건수가 맞는다', async () => {
    const r = await call(fundingExport, { slug: 'demo' });
    expect(r.status).toBe(200);
    expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(
      expect.anything(),
      'kyungha',
      'funding_pledge_export',
      'demo',
      'success',
      2,
    );
  });


  /**
   * 기록의 수행자는 **지금 로그인한 사람**이어야 한다. 예전엔 `recordAdminPrivacyAccess`가
   * 고정값을 채워서, 어느 경로든 `admin` 한 값만 남았다.
   */
  it('지금 로그인한 사람이 기록된다 — 고정값이 아니다', async () => {
    (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true, actor: 'jina', name: '지나' });
    await call(fundingExport, { slug: 'demo' });
    expect((recordAdminPrivacyAccess as jest.Mock).mock.calls[0][1]).toBe('jina');
  });

  it('전체 내려받기의 대상은 all이다', async () => {
    await call(fundingExport, {});
    expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(expect.anything(), 'kyungha', 'funding_pledge_export', 'all', 'success', 2);
  });

  it('내보낸 값은 기록에 담기지 않는다', async () => {
    const r = await call(fundingExport, { slug: 'demo' });
    // CSV 본문에는 있다 — 그래서 기록에 없다는 것이 의미가 있다.
    expect(r.send.mock.calls[0][0]).toContain('김후원');
    for (const secret of SECRETS) expect(loggedArgs()).not.toContain(secret);
  });

  it('인증이 없으면 기록도 내보내기도 없다', async () => {
    (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
    const r = await call(fundingExport, { slug: 'demo' });
    expect(r.status).toBe(401);
    expect(listFundingOrdersForExport).not.toHaveBeenCalled();
    expect(recordAdminPrivacyAccess).not.toHaveBeenCalled();
  });

  it('slug 형식이 틀리면 조회도 기록도 없다', async () => {
    const r = await call(fundingExport, { slug: '../etc' });
    expect(r.status).toBe(400);
    expect(recordAdminPrivacyAccess).not.toHaveBeenCalled();
  });

  it('기록이 실패해도 다운로드는 정상이다', async () => {
    (recordAdminPrivacyAccess as jest.Mock).mockRejectedValue(new Error('기록 실패'));
    const r = await call(fundingExport, { slug: 'demo' });
    expect(r.status).toBe(200);
    expect(r.send.mock.calls[0][0]).toContain('F1');
  });
});

describe('매출장부 CSV (pages/api/admin/orders/export.ts)', () => {
  const RANGE = { from: '2026-09-01', to: '2026-09-30' };
  const ledgerRow = () => ({ orderNo: 'S1', customerName: '김후원', customerPhone: '010-1111-2222', customerEmail: 'a@example.com' });

  beforeEach(() => {
    (listSalesLedgerRows as jest.Mock).mockResolvedValue([ledgerRow(), ledgerRow(), ledgerRow()]);
  });

  it('내보내면 기간과 건수가 기록에 남는다', async () => {
    const r = await call(salesLedgerExport, RANGE);
    expect(r.status).toBe(200);
    expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(
      expect.anything(),
      'kyungha',
      'sales_ledger_export',
      '2026-09-01_2026-09-30',
      'success',
      3,
    );
  });


  /** 기록의 수행자는 **지금 로그인한 사람**이다 — 예전엔 어느 경로든 고정값 하나였다. */
  it('지금 로그인한 사람이 기록된다 — 고정값이 아니다', async () => {
    (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true, actor: 'jina', name: '지나' });
    await call(salesLedgerExport, RANGE);
    expect((recordAdminPrivacyAccess as jest.Mock).mock.calls[0][1]).toBe('jina');
  });

  it('내보낸 값은 기록에 담기지 않는다', async () => {
    await call(salesLedgerExport, RANGE);
    for (const secret of SECRETS) expect(loggedArgs()).not.toContain(secret);
  });

  it('인증이 없으면 기록도 내보내기도 없다', async () => {
    (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
    const r = await call(salesLedgerExport, RANGE);
    expect(r.status).toBe(401);
    expect(listSalesLedgerRows).not.toHaveBeenCalled();
    expect(recordAdminPrivacyAccess).not.toHaveBeenCalled();
  });

  it('기간 형식이 틀리면 조회도 기록도 없다', async () => {
    const r = await call(salesLedgerExport, { from: '어제', to: '오늘' });
    expect(r.status).toBe(400);
    expect(recordAdminPrivacyAccess).not.toHaveBeenCalled();
  });

  it('조회가 실패하면 실패한 시도로 남는다', async () => {
    (listSalesLedgerRows as jest.Mock).mockRejectedValue(new Error('DB 장애'));
    const r = await call(salesLedgerExport, RANGE);
    expect(r.status).toBe(500);
    expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(
      expect.anything(),
      'kyungha',
      'sales_ledger_export',
      '2026-09-01_2026-09-30',
      'error',
      undefined,
    );
  });

  it('기록이 실패해도 다운로드는 정상이다', async () => {
    (recordAdminPrivacyAccess as jest.Mock).mockRejectedValue(new Error('기록 실패'));
    expect((await call(salesLedgerExport, RANGE)).status).toBe(200);
  });
});

describe('아티스트 후원자 CSV (pages/api/admin/artists/[slug]/supporters-export.ts)', () => {
  beforeEach(() => {
    (getSupportedArtist as jest.Mock).mockReturnValue({ slug: 'someone' });
    (listSupporterContacts as jest.Mock).mockResolvedValue([
      { customerName: '김후원', customerEmail: 'a@example.com', displayName: '후원자', displayConsent: true, tierId: 'artist-support-basic', status: 'active', createdAt: new Date('2026-09-01T00:00:00Z') },
    ]);
  });

  it('내보내면 아티스트와 건수가 기록에 남는다', async () => {
    const r = await call(supportersExport, { slug: 'someone' });
    expect(r.status).toBe(200);
    expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(
      expect.anything(),
      'kyungha',
      'artist_supporter_export',
      'someone',
      'success',
      1,
    );
  });


  /** 기록의 수행자는 **지금 로그인한 사람**이다 — 예전엔 어느 경로든 고정값 하나였다. */
  it('지금 로그인한 사람이 기록된다 — 고정값이 아니다', async () => {
    (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true, actor: 'jina', name: '지나' });
    await call(supportersExport, { slug: 'someone' });
    expect((recordAdminPrivacyAccess as jest.Mock).mock.calls[0][1]).toBe('jina');
  });

  it('내보낸 값은 기록에 담기지 않는다', async () => {
    await call(supportersExport, { slug: 'someone' });
    for (const secret of SECRETS) expect(loggedArgs()).not.toContain(secret);
  });

  it('인증이 없으면 기록도 내보내기도 없다', async () => {
    (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
    const r = await call(supportersExport, { slug: 'someone' });
    expect(r.status).toBe(401);
    expect(listSupporterContacts).not.toHaveBeenCalled();
    expect(recordAdminPrivacyAccess).not.toHaveBeenCalled();
  });

  it('없는 아티스트는 조회도 기록도 없다', async () => {
    (getSupportedArtist as jest.Mock).mockReturnValue(null);
    const r = await call(supportersExport, { slug: 'nobody' });
    expect(r.status).toBe(404);
    expect(recordAdminPrivacyAccess).not.toHaveBeenCalled();
  });

  it('기록이 실패해도 다운로드는 정상이다', async () => {
    (recordAdminPrivacyAccess as jest.Mock).mockRejectedValue(new Error('기록 실패'));
    expect((await call(supportersExport, { slug: 'someone' })).status).toBe(200);
  });
});

describe('개설자 배송 목록 CSV (pages/api/funding/creator/projects/[id]/shipping.csv.ts)', () => {
  const shippingRow = () => ({
    pledgeId: 'p1', rewardId: 'mail', rewardTitle: '감사 메일', quantity: 1,
    shippingName: '김후원', shippingPhone: '010-1111-2222', shippingPostcode: '12345',
    shippingAddress1: '서울시 어딘가 1', shippingAddress2: null, shippingMemo: null,
    fulfillmentStatus: 'pending', trackingCompany: null, trackingNumber: null,
  });

  beforeEach(() => {
    (authenticateCreatorApi as jest.Mock).mockResolvedValue({ ok: true, creatorId: 'cr-1' });
    (loadCreatorShipping as jest.Mock).mockResolvedValue({ state: 'open', summary: {}, rows: [shippingRow(), shippingRow()] });
    (consumeRateLimit as jest.Mock).mockResolvedValue(true);
  });

  /** 관리자와 달리 수행자가 사람별로 특정된다 — 그 값이 실제로 들어가는지 본다. */
  it('내보내면 개설자·프로젝트·건수가 기록에 남는다', async () => {
    const r = await call(creatorShippingCsv, { id: 'proj-1' });
    expect(r.status).toBe(200);
    expect(recordPrivacyAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'creator:cr-1',
        action: 'funding_creator_shipping_export',
        targetId: 'proj-1',
        result: 'success',
        rowCount: 2,
      }),
    );
  });

  it('내보낸 값은 기록에 담기지 않는다', async () => {
    await call(creatorShippingCsv, { id: 'proj-1' });
    for (const secret of SECRETS) expect(loggedArgs()).not.toContain(secret);
  });

  it('로그인이 없으면 기록도 내보내기도 없다', async () => {
    (authenticateCreatorApi as jest.Mock).mockResolvedValue({ ok: false });
    const r = await call(creatorShippingCsv, { id: 'proj-1' });
    expect(r.status).toBe(401);
    expect(loadCreatorShipping).not.toHaveBeenCalled();
    expect(recordPrivacyAccess).not.toHaveBeenCalled();
  });

  it('마감 전에는 내보내지 않으니 기록도 없다', async () => {
    (loadCreatorShipping as jest.Mock).mockResolvedValue({ state: 'before_close', summary: {} });
    const r = await call(creatorShippingCsv, { id: 'proj-1' });
    expect(r.status).toBe(409);
    expect(recordPrivacyAccess).not.toHaveBeenCalled();
  });

  it('기록이 실패해도 다운로드는 정상이다', async () => {
    (recordPrivacyAccess as jest.Mock).mockRejectedValue(new Error('기록 실패'));
    expect((await call(creatorShippingCsv, { id: 'proj-1' })).status).toBe(200);
  });
});

/**
 * 파일이 아니라 **화면**이지만 나가는 것이 같다 — 여기 있는 이유가 그것이다. CSV 라우트만
 * 기록하던 시절에는 개설자가 배송지 전부를 몇 번을 들여다봐도 흔적이 남지 않았다.
 */
describe('개설자 배송 화면 (pages/[locale]/funding/creator/[id]/shipping.tsx)', () => {
  const shippingRow = () => ({
    pledgeId: 'p1', rewardId: 'mail', rewardTitle: '감사 메일', quantity: 1,
    shippingName: '김후원', shippingPhone: '010-1111-2222', shippingPostcode: '12345',
    shippingAddress1: '서울시 어딘가 1', shippingAddress2: null, shippingMemo: null,
    fulfillmentStatus: 'pending', trackingCompany: null, trackingNumber: null,
  });

  const open = async () =>
    (creatorShippingPage as unknown as (c: unknown) => Promise<unknown>)({
      params: { locale: 'ko', id: 'proj-1' },
      query: {},
      req: { headers: {}, cookies: {}, socket: {} },
      res: { setHeader: jest.fn() },
    });

  beforeEach(() => {
    (authenticateCreatorRequest as jest.Mock).mockResolvedValue({ ok: true, creatorId: 'cr-1' });
    (loadProjectForCreator as jest.Mock).mockResolvedValue({ id: 'proj-1', title: '프로젝트' });
    (loadCreatorShipping as jest.Mock).mockResolvedValue({ state: 'open', summary: {}, rows: [shippingRow(), shippingRow()] });
  });

  it('화면으로 열어도 CSV와 같은 action으로 남는다', async () => {
    await open();
    expect(recordPrivacyAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'creator:cr-1',
        action: 'funding_creator_shipping_export',
        targetId: 'proj-1',
        result: 'success',
        rowCount: 2,
      }),
    );
  });

  it('화면에 실린 값은 기록에 담기지 않는다', async () => {
    await open();
    for (const secret of SECRETS) expect(loggedArgs()).not.toContain(secret);
  });

  it('로그인이 없으면 기록도 조회도 없다', async () => {
    (authenticateCreatorRequest as jest.Mock).mockResolvedValue({ ok: false });
    await open();
    expect(loadCreatorShipping).not.toHaveBeenCalled();
    expect(recordPrivacyAccess).not.toHaveBeenCalled();
  });

  it('마감 전에는 집계만 나가므로 기록도 없다', async () => {
    (loadCreatorShipping as jest.Mock).mockResolvedValue({ state: 'before_close', summary: {} });
    await open();
    expect(recordPrivacyAccess).not.toHaveBeenCalled();
  });

  it('남의 프로젝트(404)는 남기지 않는다', async () => {
    (loadProjectForCreator as jest.Mock).mockResolvedValue(null);
    expect(await open()).toEqual({ notFound: true });
    expect(recordPrivacyAccess).not.toHaveBeenCalled();
  });

  it('기록이 실패해도 화면은 정상이다', async () => {
    (recordPrivacyAccess as jest.Mock).mockRejectedValue(new Error('기록 실패'));
    expect(await open()).toHaveProperty('props');
  });
});

describe('관리자 계약서 PDF (pages/api/contracts/[id]/pdf.ts)', () => {
  const mockContract = (value: unknown) => {
    (getDb as jest.Mock).mockReturnValue({ query: { contracts: { findFirst: jest.fn().mockResolvedValue(value) } } });
  };

  beforeEach(() => {
    mockContract({ id: 'c1', customerName: '김후원', status: 'signed', purgedAt: null });
    (loadOrRenderContractPdf as jest.Mock).mockResolvedValue(Buffer.from('%PDF-'));
  });

  /** 한 건짜리 다운로드라 건수는 남기지 않는다 — 없는 숫자를 지어내지 않는다. */
  it('내려받으면 계약 id가 기록에 남는다', async () => {
    const r = await call(contractPdf, { id: 'c1' });
    expect(r.status).toBe(200);
    expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(expect.anything(), 'kyungha', 'contract_pdf_download', 'c1', 'success');
  });


  /** 기록의 수행자는 **지금 로그인한 사람**이다 — 예전엔 어느 경로든 고정값 하나였다. */
  it('지금 로그인한 사람이 기록된다 — 고정값이 아니다', async () => {
    (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true, actor: 'jina', name: '지나' });
    await call(contractPdf, { id: 'c1' });
    expect((recordAdminPrivacyAccess as jest.Mock).mock.calls[0][1]).toBe('jina');
  });

  it('이름은 기록에 담기지 않는다', async () => {
    await call(contractPdf, { id: 'c1' });
    for (const secret of SECRETS) expect(loggedArgs()).not.toContain(secret);
  });

  it('인증이 없으면 기록도 내보내기도 없다', async () => {
    (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
    const r = await call(contractPdf, { id: 'c1' });
    expect(r.status).toBe(401);
    expect(loadOrRenderContractPdf).not.toHaveBeenCalled();
    expect(recordAdminPrivacyAccess).not.toHaveBeenCalled();
  });

  it('없는 계약도 시도로 남는다', async () => {
    mockContract(undefined);
    const r = await call(contractPdf, { id: 'c1' });
    expect(r.status).toBe(404);
    expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(expect.anything(), 'kyungha', 'contract_pdf_download', 'c1', 'not_found');
  });

  it('PDF 생성이 실패하면 실패한 시도로 남는다', async () => {
    (loadOrRenderContractPdf as jest.Mock).mockRejectedValue(new Error('Chromium 실패'));
    const r = await call(contractPdf, { id: 'c1' });
    expect(r.status).toBe(500);
    expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(expect.anything(), 'kyungha', 'contract_pdf_download', 'c1', 'error');
  });

  it('기록이 실패해도 다운로드는 정상이다', async () => {
    (recordAdminPrivacyAccess as jest.Mock).mockRejectedValue(new Error('기록 실패'));
    expect((await call(contractPdf, { id: 'c1' })).status).toBe(200);
  });
});
