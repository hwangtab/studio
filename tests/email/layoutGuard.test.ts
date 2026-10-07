import fs from 'node:fs';
import path from 'node:path';

/**
 * 메일은 전부 공용 레이아웃(lib/email/layout.ts, 계약 메일 디자인 기준)으로 HTML을 입힌다.
 *
 * 2026-10-07 점검에서 메일 약 73종 중 HTML이 있는 것이 7종뿐이었고, 운영자가 받는 알림은 거의 전부
 * 서식 없는 글자였다. 새 메일이 글자만 보내거나 자기만의 HTML 골격을 들여오면 CI가 서게 한다.
 * 규칙·점검 목록은 CLAUDE.md "메일은 공용 레이아웃으로" 절.
 */

const ROOT = path.resolve(__dirname, '../..');

const walk = (dir: string): string[] =>
  fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(rel);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name) ? [rel] : [];
  });

/** 메일이 아닌 HTML 문서(PDF 원본·웹 페이지)를 만드는 파일. */
const NOT_EMAIL_HTML = new Set(['lib/contracts/pdf-html.ts', 'lib/press/page.ts']);

describe('메일 공용 레이아웃 가드', () => {
  it('sendEmail의 html은 필수 인자다 — 글자만 보내는 메일은 타입 검사에서 서고, 이 단언은 그 조건이 느슨해지는 것을 막는다', () => {
    const source = fs.readFileSync(path.join(ROOT, 'lib/email/resend.ts'), 'utf8');
    const params = source.match(/interface SendEmailParams \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(params).toMatch(/\n\s+html: string;/);
    expect(params).not.toMatch(/html\?:/);
  });

  it('HTML 문서 골격(<!DOCTYPE)은 lib/email/layout.ts 한 곳에만 있다', () => {
    const sources = [...walk('lib'), ...walk('pages'), ...walk('components')];
    const offenders = sources.filter((file) => {
      if (file === 'lib/email/layout.ts' || NOT_EMAIL_HTML.has(file)) return false;
      return /<!DOCTYPE\s+html/i.test(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    });
    expect(offenders).toEqual([]);
  });
});
