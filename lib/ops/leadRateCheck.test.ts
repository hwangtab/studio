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

  it('최근 3일 클릭률이 기준선의 40% 미만이면 급락으로 잡는다', async () => {
    // Promise.all로 두 기간 요청이 동시에 나가므로 호출 순서로 기간을 구분할 수 없다.
    // dateRanges.startDate로 "최근 3일"(오늘에 가까움)인지 "기준선"(더 과거)인지 판단한다.
    const today = new Date().toISOString().slice(0, 10);
    const client: Ga4Client = {
      async runReport(_propertyId, body) {
        const isClick = JSON.stringify(body).includes('lead_click_kakao');
        const startDate = (body.dateRanges?.[0] as { startDate?: string } | undefined)?.startDate ?? '';
        // 최근 3일 창의 startDate는 오늘로부터 3일 전 — 기준선(31일 전)보다 today에 훨씬 가깝다.
        const daysFromToday = Math.round(
          (new Date(today).getTime() - new Date(startDate).getTime()) / (24 * 60 * 60 * 1000),
        );
        const isRecentPeriod = daysFromToday <= 7;
        if (isRecentPeriod) {
          return {
            rows: [
              {
                dimensionValues: [{ value: '/ko/practice-room' }],
                metricValues: [{ value: isClick ? '1' : '100' }], // 1% — 급락
              },
              {
                dimensionValues: [{ value: '/ko/pricing' }],
                metricValues: [{ value: isClick ? '20' : '100' }], // 20% — 정상
              },
            ],
          };
        }
        return {
          rows: [
            {
              dimensionValues: [{ value: '/ko/practice-room' }],
              metricValues: [{ value: isClick ? '75' : '1000' }], // 7.5% 기준선
            },
            {
              dimensionValues: [{ value: '/ko/pricing' }],
              metricValues: [{ value: isClick ? '200' : '1000' }], // 20% 기준선
            },
          ],
        };
      },
    };

    const result = await runLeadRateCheck(FULL_ENV, () => client);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].title).toContain('/ko/practice-room');
    expect(result.issues[0].severity).toBe('high');
    expect(result.issues[0].detail).toContain('practice-room');
  });

  it('최근 3일 조회수가 30 미만이면 표본 부족으로 판정을 유보한다 (알리지 않음)', async () => {
    const client = fakeClient({
      practiceRoom: { views: 10, clicks: 0 }, // 0%지만 표본 부족
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
