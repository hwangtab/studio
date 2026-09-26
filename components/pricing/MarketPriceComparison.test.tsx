import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MarketPriceComparison from './MarketPriceComparison';
import { formatPriceLabel, SINGLE_BUNDLE_PRICE } from '../../data/pricing';

describe('MarketPriceComparison', () => {
  it('업체 이름 없이 범위와 조사일만 싣고, 부가세 기준 차이를 밝힌다', () => {
    const { container } = render(<MarketPriceComparison />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/바르티|모래뮤직|톤스튜디오|에픽사운드|유일사운드|모트|믹싱아트|크몽|숨고/);
    expect(text).toContain('2026-09-26');
    expect(text).toContain('부가세 별도');
    expect(text).toContain(`싱글 번들은 ${formatPriceLabel(SINGLE_BUNDLE_PRICE, 'ko')}`);
    expect(text).toContain('트랙 10개 이하 기준');
    expect(screen.getAllByText('포함').length).toBeGreaterThan(0);
  });
});
