/** @jest-environment node */
import { buildHealthReportHtml, formatHealthReport, type HealthReport } from './healthCheck';

jest.mock('../../db/client', () => ({ getDb: () => ({}) }));

const report: HealthReport = {
  checkedAt: new Date('2026-10-07T00:00:00Z'),
  issues: [
    { severity: 'high', title: '서명 기한이 지난 계약 1건', detail: '고객이 링크를 놓쳤을 수 있습니다.\n연락해 주세요.', href: '/admin/contracts' },
    { severity: 'medium', title: '<img src=x> 확인', detail: 'a & b', href: '/admin/funding/projects' },
    { severity: 'medium', title: '링크 없는 항목', detail: '상세' },
  ],
};

describe('buildHealthReportHtml', () => {
  const html = buildHealthReportHtml(report);

  it('긴급은 붉은 블록, 일반은 앰버 블록으로 그린다', () => {
    expect(html).toContain('[긴급] 서명 기한이 지난 계약 1건');
    expect(html).toContain('background-color: #fef2f2');
    expect(html).toContain('background-color: #fffbeb');
    expect(html).toContain('운영 알림 · 긴급');
  });

  it('항목마다 관리자 절대 주소로 처리 링크를 단다', () => {
    expect(html).toContain('href="https://studionol.co.kr/admin/contracts"');
    expect(html).toContain('href="https://studionol.co.kr/admin/funding/projects"');
    // href가 없는 항목에는 링크가 없다: 항목 링크 2개 + 버튼 1개
    expect(html.match(/처리하러 가기/g)).toHaveLength(2);
  });

  it('제목·상세는 escape하고 줄바꿈은 살린다', () => {
    expect(html).not.toContain('<img src=x>');
    expect(html).toContain('&lt;img src=x&gt; 확인');
    expect(html).toContain('a &amp; b');
    expect(html).toContain('고객이 링크를 놓쳤을 수 있습니다.<br />연락해 주세요.');
  });

  it('점검 시각은 KST, 건수 요약이 있다', () => {
    expect(html).toContain('(KST)');
    expect(html).toContain('3건');
    expect(html).toContain('이 메일은 이상이 있을 때만 발송됩니다.');
  });

  it('긴급이 없으면 알림 칩이 긴급이 아니다', () => {
    const calm = buildHealthReportHtml({ ...report, issues: report.issues.slice(1) });
    expect(calm).not.toContain('운영 알림 · 긴급');
  });
});

describe('formatHealthReport', () => {
  it('href가 있는 항목 아래에 이동 주소를 한 줄 싣는다', () => {
    const text = formatHealthReport(report);
    expect(text).toContain('이동: https://studionol.co.kr/admin/contracts');
    expect(text).toContain('이동: https://studionol.co.kr/admin/funding/projects');
    expect(text.match(/이동:/g)).toHaveLength(2);
  });
});
