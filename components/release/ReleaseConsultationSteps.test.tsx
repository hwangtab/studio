import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReleaseConsultationSteps from './ReleaseConsultationSteps';

describe('ReleaseConsultationSteps', () => {
  it('renders ordered consultation steps for release inquiries', () => {
    render(
      <ReleaseConsultationSteps
        title="상담 흐름"
        subtitle="처음 문의부터 견적까지"
        steps={[
          { num: '1', title: '문의', desc: '현재 상황을 공유합니다.' },
          { num: '2', title: '견적', desc: '범위를 정리합니다.' },
        ]}
      />
    );

    expect(screen.getByRole('heading', { name: '상담 흐름' })).toBeInTheDocument();
    expect(screen.getByText('문의')).toBeInTheDocument();
    expect(screen.getByText('현재 상황을 공유합니다.')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders nothing when steps are empty', () => {
    const { container } = render(
      <ReleaseConsultationSteps title="상담 흐름" subtitle="없음" steps={[]} />
    );

    expect(container.firstChild).toBeNull();
  });
});
