/** @jest-environment node */

/**
 * 카카오 전환 급락 감시가 실제로 급락을 잡는지, 그리고 잡지 말아야 할 때 조용한지 검증한다.
 *
 * GA4 클라이언트는 팩토리로 주입해 실제 네트워크 호출 없이 가짜 응답을 돌린다.
 */
import type { Ga4Client, LeadRateEnv } from './leadRateCheck';
import { runLeadRateCheck } from './leadRateCheck';

const FULL_ENV: LeadRateEnv = {
  GA4_PROPERTY_ID: '123456',
  GA4_OAUTH_REFRESH_TOKEN: 'refresh-token',
  GSC_OAUTH_CLIENT_ID: 'client-id',
  GSC_OAUTH_CLIENT_SECRET: 'client-secret',
};

type RunReportBody = Parameters<Ga4Client['runReport']>[1];

/**
 * 요청이 lead_click_kakao eventName 필터를 포함하면 "클릭" 요청, 아니면 "조회" 요청으로
 * 판단해 각각 다른 값을 돌려주는 가짜 클라이언트를 만든다.
 */
const fakeClient = (values: {
  practiceRoom: { views: number; clicks: number };
  pricing: { views: number; clicks: number };
}): Ga4Client => {
  const isClickRequest = (body: RunReportBody): boolean =>
    JSON.stringify(body).includes('lead_click_kakao');

  return {
    async runReport(_propertyId, body) {
      const clickReq = isClickRequest(body);
      return {
        rows: [
          {
            dimensionValues: [{ value: '/ko/practice-room' }],
            metricValues: [{ value: String(clickReq ? values.practiceRoom.clicks : values.practiceRoom.views) }],
          },
          {
            dimensionValues: [{ value: '/ko/pricing' }],
            metricValues: [{ value: String(clickReq ? values.pricing.clicks : values.pricing.views) }],
          },
        ],
      };
    },
  };
};

type Sample = { views: number; clicks: number };

/**
 * 최근 창과 기준선 창에 서로 다른 값을 돌려주는 가짜 클라이언트.
 *
 * 두 기간 요청이 `Promise.all`로 동시에 나가 호출 순서로는 구분할 수 없으므로,
 * `dateRanges[0].startDate`가 오늘에서 얼마나 떨어져 있는지로 판단한다.
 * 최근 창은 8일 전 시작, 기준선은 36일 전 시작이라 20일을 경계로 갈린다.
 */
const periodAwareClient = (values: {
  recent: { practiceRoom: Sample; pricing: Sample };
  baseline: { practiceRoom: Sample; pricing: Sample };
}): Ga4Client => ({
  async runReport(_propertyId, body) {
    const isClick = JSON.stringify(body).includes('lead_click_kakao');
    const startDate = (body.dateRanges?.[0] as { startDate?: string } | undefined)?.startDate ?? '';
    const today = new Date().toISOString().slice(0, 10);
    const daysFromToday = Math.round(
      (new Date(today).getTime() - new Date(startDate).getTime()) / (24 * 60 * 60 * 1000),
    );
    const period = daysFromToday <= 20 ? values.recent : values.baseline;
    const pick = (s: Sample) => String(isClick ? s.clicks : s.views);
    return {
      rows: [
        { dimensionValues: [{ value: '/ko/practice-room' }], metricValues: [{ value: pick(period.practiceRoom) }] },
        { dimensionValues: [{ value: '/ko/pricing' }], metricValues: [{ value: pick(period.pricing) }] },
      ],
    };
  },
});

/** 어느 기간에도 걸리지 않는 조용한 페이지 — pricing을 판정에서 빼고 싶을 때 쓴다. */
const QUIET: Sample = { views: 0, clicks: 0 };

describe('카카오 전환 급락 감시', () => {
  it('GA4 env가 하나라도 없으면 건너뛴다 (실패 아님)', async () => {
    const result = await runLeadRateCheck({ GA4_PROPERTY_ID: '123' }, jest.fn());
    expect(result.skipped).toBe('GA4 env 없음');
    expect(result.issues).toEqual([]);
  });

  it('클릭률이 기준선과 비슷하면 정상 — 아무것도 보고하지 않는다', async () => {
    // 기준선 28일 대비 최근 3일 클릭률 계산 시, 요청 순서상 첫 호출이 최근/기준선 구분에
    // 쓰이지 않으므로 같은 값을 양쪽 기간에 동일하게 돌려주는 팩토리로 정상 케이스를 만든다.
    const client = fakeClient({
      practiceRoom: { views: 100, clicks: 7 }, // 7% both periods
      pricing: { views: 100, clicks: 20 },
    });
    const result = await runLeadRateCheck(FULL_ENV, () => client);
    expect(result.issues).toEqual([]);
  });

  it('클릭률이 기준선의 40% 미만이고 표본도 충분하면 급락으로 잡는다', async () => {
    // 2026-08의 실제 사고 모양: 기준선 7.5%가 최근 1%로 무너졌고 조회는 정상이었다.
    const client = periodAwareClient({
      recent: {
        practiceRoom: { views: 100, clicks: 1 }, // 1% — 급락
        pricing: { views: 100, clicks: 20 }, // 20% — 정상
      },
      baseline: {
        practiceRoom: { views: 1000, clicks: 75 }, // 7.5%
        pricing: { views: 1000, clicks: 200 }, // 20%
      },
    });

    const result = await runLeadRateCheck(FULL_ENV, () => client);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].title).toContain('/ko/practice-room');
    expect(result.issues[0].severity).toBe('high');
    expect(result.issues[0].detail).toContain('practice-room');
  });

  /**
   * 2026-09-16 오탐의 실제 수치. 기준선 4.39%(410뷰 18클릭)에서 42뷰에 클릭 0이 나왔는데,
   * 그건 우연히도 15.2% 확률로 일어나는 일이다 — 사고가 아니라 잡음이다. 옛 기준(조회 30건)은
   * 이걸 [긴급]으로 올렸고, 해소될 수 없는 조건이라 매일 아침 같은 메일을 보냈다.
   */
  it('클릭이 0이어도 우연으로 설명되는 표본이면 알리지 않는다 (2026-09-16 오탐 회귀)', async () => {
    const client = periodAwareClient({
      recent: { practiceRoom: { views: 42, clicks: 0 }, pricing: QUIET },
      baseline: { practiceRoom: { views: 410, clicks: 18 }, pricing: QUIET },
    });
    const result = await runLeadRateCheck(FULL_ENV, () => client);
    expect(result.issues).toEqual([]);
  });

  it('같은 0%라도 조회가 충분히 쌓이면 급락으로 잡는다', async () => {
    // 같은 기준선(4.39%)에서 조회 200건에 클릭 0이면 우연일 확률이 0.01% 미만이다.
    const client = periodAwareClient({
      recent: { practiceRoom: { views: 200, clicks: 0 }, pricing: QUIET },
      baseline: { practiceRoom: { views: 410, clicks: 18 }, pricing: QUIET },
    });
    const result = await runLeadRateCheck(FULL_ENV, () => client);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].title).toContain('/ko/practice-room');
  });

  it('클릭이 아주 드문 페이지는 기준선이 얕아 판정을 유보한다', async () => {
    // 28일에 클릭 4건뿐인 페이지(=pricing 실제 모양). 최근 0건은 늘 일어나므로 알리면 안 된다.
    const client = periodAwareClient({
      recent: { practiceRoom: QUIET, pricing: { views: 80, clicks: 0 } },
      baseline: { practiceRoom: QUIET, pricing: { views: 400, clicks: 4 } },
    });
    const result = await runLeadRateCheck(FULL_ENV, () => client);
    expect(result.issues).toEqual([]);
  });

  it('조회가 거의 없으면 판정을 유보한다 (알리지 않음)', async () => {
    const client = fakeClient({
      practiceRoom: { views: 10, clicks: 0 },
      pricing: { views: 10, clicks: 0 },
    });
    const result = await runLeadRateCheck(FULL_ENV, () => client);
    expect(result.issues).toEqual([]);
  });

  it('GA4 API 호출이 실패하면 조용히 삼키지 않고 던진다', async () => {
    const client: Ga4Client = {
      runReport: jest.fn().mockRejectedValue(new Error('invalid_grant')),
    };
    await expect(runLeadRateCheck(FULL_ENV, () => client)).rejects.toThrow('invalid_grant');
  });
});
