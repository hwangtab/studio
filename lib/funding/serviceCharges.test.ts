import { chargesAfterKindChange, chargesFromService } from './serviceCharges';

const base = { kind: 'design' as const, designFee: 500000, designFeePaidAt: null, productionFee: 1200000 };

describe('스튜디오 서비스 공제액', () => {
  it('지정된 서비스는 설계비 + 제작비를 뺀다', () => {
    expect(chargesFromService(base)).toEqual({ designFee: 500000, productionFee: 1200000 });
  });
  it('설계비를 정산 밖에서 받았으면 설계비는 빼지 않는다', () => {
    expect(chargesFromService({ ...base, designFeePaidAt: '2026-10-01T00:00:00.000Z' })).toEqual({ designFee: 0, productionFee: 1200000 });
  });
  it('직접 개설(none)·서비스 없음은 0', () => {
    expect(chargesFromService({ ...base, kind: 'none' })).toEqual({ designFee: 0, productionFee: 0 });
    expect(chargesFromService(null)).toEqual({ designFee: 0, productionFee: 0 });
  });
  it('처음 지정하면 지금 정가 설계비, 제작비 0', () => {
    expect(chargesAfterKindChange(null, 'design', 500000)).toEqual({ designFee: 500000, productionFee: 0 });
  });
  it('되돌렸다 다시 지정하면 보존된 약정가로 돌아간다', () => {
    expect(chargesAfterKindChange({ ...base, kind: 'none' }, 'release', 600000)).toEqual({ designFee: 500000, productionFee: 1200000 });
  });
  it('직접 개설로 되돌리면 0', () => {
    expect(chargesAfterKindChange(base, 'none', 500000)).toEqual({ designFee: 0, productionFee: 0 });
  });
});
