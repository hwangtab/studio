import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import FundingMobileCta from './FundingMobileCta';

// 하단 바 "펀딩하기"는 스크롤이 아니라 결제 화면을 연다(2026-09-29 통일). 링크는 /pledge로
// 남겨 자바스크립트가 없을 때도 결제 페이지로 간다.
describe('FundingMobileCta', () => {
  it('누르면 결제 화면을 열고, 링크는 /pledge다', () => {
    const onOpen = jest.fn();
    render(<FundingMobileCta visible href="/ko/funding/demo/pledge" onOpen={onOpen} />);
    const link = screen.getByRole('link', { name: '펀딩하기' });
    expect(link).toHaveAttribute('href', '/ko/funding/demo/pledge');
    fireEvent.click(link);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
  it('새 탭 열기(⌘ 클릭)는 가로채지 않는다', () => {
    const onOpen = jest.fn();
    render(<FundingMobileCta visible href="/ko/funding/demo/pledge" onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('link', { name: '펀딩하기' }), { metaKey: true });
    expect(onOpen).not.toHaveBeenCalled();
  });
});
