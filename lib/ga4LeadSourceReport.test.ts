/** @jest-environment node */

import {
  QUALIFIED_LEAD_EVENT_NAMES,
  buildLeadSourceRows,
  type Ga4LeadEventRow,
  type Ga4SourceSessionRow,
} from './ga4LeadSourceReport';

describe('buildLeadSourceRows', () => {
  it('merges source sessions with only Studio NOL lead event counts', () => {
    const sessions: Ga4SourceSessionRow[] = [
      { source: 'google', medium: 'organic', sessions: 100, bounceRate: 0.42 },
      { source: 'm.search.naver.com', medium: 'referral', sessions: 20, bounceRate: 0.25 },
    ];
    const leadEvents: Ga4LeadEventRow[] = [
      { source: 'google', medium: 'organic', eventName: 'lead_click_kakao', eventCount: 3 },
      { source: 'google', medium: 'organic', eventName: 'lead_form_field_error', eventCount: 2 },
      { source: 'm.search.naver.com', medium: 'referral', eventName: 'lead_click_naver_map', eventCount: 4 },
    ];

    expect(QUALIFIED_LEAD_EVENT_NAMES).toContain('lead_click_naver_map');
    expect(buildLeadSourceRows(sessions, leadEvents)).toEqual([
      ['google', 'organic', 100, '0.420', 5, 3, 2],
      ['m.search.naver.com', 'referral', 20, '0.250', 4, 4, 0],
    ]);
  });
});
