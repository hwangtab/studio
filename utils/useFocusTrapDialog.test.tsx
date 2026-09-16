/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';

/**
 * 결제위젯은 모달 안에 **iframe**으로 뜬다. 포커스 대상 목록에 `iframe`이 없으면 마지막
 * 요소에서 Tab이 첫 요소로 되감기며 그 iframe을 영영 건너뛴다 — 키보드만 쓰는 사람은
 * 카드번호를 입력할 방법이 없다. 예전에는 그 화면에서 트랩을 통째로 껐고, 그러면 Tab이
 * 모달 뒤 배경으로 새어 나갔다.
 *
 * **왜 DOM이 아니라 소스를 보는가:** 이 훅은 포커스 대상을
 * `offsetParent !== null || getClientRects().length > 0`으로 거르는데 jsdom에서는 둘 다
 * 거짓이라 목록이 **항상 빈다**. 되감기 분기에 들어갈 수가 없어 동작으로는 이 규칙을
 * 고정할 방법이 없다. 그래서 선택자 자체를 본다.
 */
describe('포커스 트랩의 대상 선택자', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'utils/useFocusTrapDialog.ts'), 'utf-8');
  const selector = source.match(/const FOCUSABLE_SELECTOR =\s*\n?\s*'([^']+)'/)?.[1];
  const parts = (selector ?? '').split(',').map((s) => s.trim());

  it('iframe이 들어 있다 — 모달 안 결제위젯을 Tab으로 밟을 수 있어야 한다', () => {
    expect(selector).toBeDefined();
    expect(parts).toContain('iframe');
  });

  it('기존 대상도 그대로다', () => {
    for (const expected of ['button', 'a[href]', 'input', 'textarea', 'select']) {
      expect(parts).toContain(expected);
    }
  });
});
