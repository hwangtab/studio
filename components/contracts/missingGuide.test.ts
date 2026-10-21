import { focusFirstMissing, scrollToElementId } from './missingGuide';

describe('서명 화면 빠진 항목 안내', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input id="clientName" />
      <label id="clause-key-terms"><input type="checkbox" id="cb" /> 중요 조항</label>
      <div id="signature-pad" tabindex="-1"><canvas></canvas></div>`;
    Element.prototype.scrollIntoView = jest.fn();
  });

  it('첫 빠진 입력 칸으로 옮기고 커서를 둔다', () => {
    focusFirstMissing([{ id: 'clientName', label: '성명' }, { id: 'signature-pad', label: '서명' }]);
    expect(document.activeElement?.id).toBe('clientName');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'center' }));
  });

  it('체크박스 항목이면 그 안의 체크박스에 포커스를 둔다', () => {
    focusFirstMissing([{ id: 'clause-key-terms', label: '중요 조항 확인 체크' }]);
    expect(document.activeElement?.id).toBe('cb');
  });

  it('서명 칸은 캔버스가 아니라 tabindex를 가진 래퍼에 포커스를 둔다', () => {
    focusFirstMissing([{ id: 'signature-pad', label: '서명' }]);
    expect(document.activeElement?.id).toBe('signature-pad');
  });

  it('id로 화면을 옮기고, 없는 id는 false를 돌려준다', () => {
    expect(scrollToElementId('signature-pad')).toBe(true);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'start' }));
    expect(scrollToElementId('nope')).toBe(false);
  });

  it('빠진 게 없거나 요소가 없으면 아무 일도 하지 않는다', () => {
    expect(() => focusFirstMissing([])).not.toThrow();
    expect(() => focusFirstMissing([{ id: 'nope', label: 'x' }])).not.toThrow();
  });
});
