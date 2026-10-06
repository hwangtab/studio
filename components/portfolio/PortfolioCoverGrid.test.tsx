import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PortfolioCoverGrid from './PortfolioCoverGrid';
import type { PortfolioItem, PortfolioCategory } from '../../types/data';

jest.mock('next/image', () => ({ __esModule: true, default: (props: Record<string, unknown>) => React.createElement('img', { alt: String(props.alt ?? ''), src: String(props.src) }) }));

const categories: PortfolioCategory[] = [
  { id: 'all', name: '전체', description: '', color: '#000' },
  { id: 'ep', name: 'EP', description: '', color: '#000' },
  { id: 'single', name: '싱글', description: '', color: '#000' },
];
const item = (id: string, category: string): PortfolioItem => ({
  id, title: `${id} 제목`, description: '', image: `/images/${id}.webp`, link: '', category, services: [], featured: true, artist: '아티스트', releaseDate: '2025-05-01',
});

describe('PortfolioCoverGrid', () => {
  it('카드는 모달을 여는 버튼이고, 분류 배지·연도를 보인다', () => {
    const onSelect = jest.fn();
    render(<PortfolioCoverGrid locale="ko" items={[item('a', 'ep'), item('b', 'single')]} categories={categories} onSelect={onSelect} viewProjectLabel="프로젝트 보기" />);
    const cards = screen.getAllByRole('button', { name: /프로젝트 보기:/ });
    expect(cards).toHaveLength(2);
    fireEvent.click(cards[1]);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
    expect(screen.getByText('EP')).toBeInTheDocument();
    expect(screen.getAllByText(/2025/)).toHaveLength(2);
  });

  it('30초 발췌가 있는 작업(자이 Golden Hour)에만 재생 버튼이 붙고, 버튼은 카드 버튼 안에 중첩되지 않는다', () => {
    render(<PortfolioCoverGrid locale="ko" items={[item('jai-golden-hour', 'ep'), item('other', 'single')]} categories={categories} onSelect={jest.fn()} viewProjectLabel="프로젝트 보기" />);
    const play = screen.getAllByRole('button', { name: /30초 듣기/ });
    expect(play).toHaveLength(1);
    expect(play[0].closest('button[aria-label^="프로젝트 보기"]')).toBeNull();
  });
});
