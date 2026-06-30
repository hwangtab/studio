import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContactFormErrorFallback from './ContactFormErrorFallback';
import { trackLeadEvent } from '../../utils/analytics';

jest.mock('../../utils/analytics', () => ({
  trackLeadEvent: jest.fn(),
}));

const t = (key: string, options?: Record<string, unknown>) => {
  const values: Record<string, string> = {
    'actions.kakao': '카카오톡',
    'contact.form.failFallback': '전송이 안 되면 아래로 바로 연락 주세요.',
  };
  return values[key] || String(options?.defaultValue || key);
};

describe('ContactFormErrorFallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps direct Kakao, phone, and email paths available after submit failure', () => {
    render(
      <ContactFormErrorFallback
        locale="ko"
        kakaoUrl="https://open.kakao.com/me/nol"
        phone="010-4255-7893"
        email="hwangtab@gmail.com"
        t={t}
      />
    );

    const kakao = screen.getByRole('link', { name: /카카오톡/i });
    expect(kakao).toHaveAttribute('href', 'https://open.kakao.com/me/nol');
    expect(screen.getByRole('link', { name: /010-4255-7893/i })).toHaveAttribute(
      'href',
      'tel:010-4255-7893'
    );
    expect(screen.getByRole('link', { name: /hwangtab@gmail.com/i })).toHaveAttribute(
      'href',
      'mailto:hwangtab@gmail.com'
    );

    fireEvent.click(kakao);
    expect(trackLeadEvent).toHaveBeenCalledWith('lead_click_kakao', {
      locale: 'ko',
      component: 'ContactFormErrorFallback',
      cta_id: 'contact_form_error_kakao',
    });
  });
});
