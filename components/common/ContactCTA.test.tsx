import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContactCTA from './ContactCTA';
import { trackLeadEvent, trackMicroEvent } from '../../utils/analytics';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const dict: Record<string, string> = {
        'actions.kakao': '카카오톡',
        'actions.location': '위치',
        'actions.contact': '문의하기',
      };
      return dict[key] ?? options?.defaultValue ?? key;
    },
  }),
}));

jest.mock('../../utils/analytics', () => ({
  trackLeadEvent: jest.fn(),
  trackMicroEvent: jest.fn(),
}));

jest.mock('framer-motion', () => ({
  m: { div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div> },
}));

const baseProps = {
  title: '문의',
  subtitle: '부담 없이 연락 주세요',
  imageSrc: '/images/hardware5.webp',
  imageAlt: 'Studio NOL',
};

describe('ContactCTA 리드 계측', () => {
  beforeEach(() => jest.clearAllMocks());

  it('한국어: primary 버튼은 카카오톡으로 가고 lead_click_kakao를 발화한다', () => {
    render(<ContactCTA locale="ko" {...baseProps} />);

    fireEvent.click(screen.getByRole('link', { name: /카카오톡/ }));

    expect(trackLeadEvent).toHaveBeenCalledWith('lead_click_kakao', {
      locale: 'ko',
      component: 'ContactCTA',
      cta_id: 'contact_cta_primary_kakao',
    });
  });

  it('한국어: /contact 버튼은 micro_click_contact를 발화한다 (라벨·목적지는 그대로)', () => {
    render(<ContactCTA locale="ko" {...baseProps} />);

    const link = screen.getByRole('link', { name: '위치' });
    expect(link).toHaveAttribute('href', '/ko/contact');

    fireEvent.click(link);

    expect(trackMicroEvent).toHaveBeenCalledWith('micro_click_contact', {
      locale: 'ko',
      component: 'ContactCTA',
      cta_id: 'contact_cta_secondary_contact',
    });
  });

  it('영어: /contact 버튼이 lead_click_kakao가 아니라 micro_click_contact를 발화한다', () => {
    render(<ContactCTA locale="en" {...baseProps} />);

    fireEvent.click(screen.getByRole('link', { name: /문의하기/ }));

    expect(trackMicroEvent).toHaveBeenCalledWith('micro_click_contact', {
      locale: 'en',
      component: 'ContactCTA',
      cta_id: 'contact_cta_primary_contact',
    });
    expect(trackLeadEvent).not.toHaveBeenCalledWith('lead_click_kakao', expect.anything());
  });

  it('영어: 카카오톡 라벨 버튼을 렌더하지 않는다 (영어권은 카톡을 쓰지 않는다)', () => {
    render(<ContactCTA locale="en" {...baseProps} />);

    expect(screen.queryByRole('link', { name: /카카오톡/ })).toBeNull();
  });

  it('영어: /contact로 가는 버튼이 버튼 행에 하나뿐이다 (중복 제거)', () => {
    const { container } = render(<ContactCTA locale="en" {...baseProps} />);

    const buttonRow = container.querySelector('.flex.flex-col.sm\\:flex-row');
    const contactLinks = buttonRow?.querySelectorAll('a[href="/en/contact"]') ?? [];
    expect(contactLinks).toHaveLength(1);
  });
});
