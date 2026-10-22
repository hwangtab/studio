import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { POLICY_COPY_BY_LOCALE } from '../../data/privacyPolicy';
import { SESSION_CONSENT_SUMMARY, SESSION_RETENTION_YEARS } from '../../data/sessionMusicians';
import SessionMusicianForm, { EMPTY_SESSION_FORM, parseOtherInstruments } from './SessionMusicianForm';

afterEach(cleanup);

describe('SessionMusicianForm — 등록', () => {
  it('만 19세 확인·동의 전에는 제출할 수 없고, 제출 버튼은 파랑 solid다(카카오 노랑 금지)', () => {
    render(<SessionMusicianForm mode="register" submitLabel="등록하기" onSubmit={jest.fn()} />);
    const button = screen.getByRole('button', { name: '등록하기' });
    expect(button).toBeDisabled();
    expect(button.className).toMatch(/bg-primary/);
    expect(button.className).not.toMatch(/kakao/);
  });

  it('채워서 제출하면 서버 검증이 읽는 모양으로 보내고 봇 트랩 값을 싣는다', async () => {
    const onSubmit = jest.fn().mockResolvedValue({ ok: true });
    render(<SessionMusicianForm mode="register" submitLabel="등록하기" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/활동명/), { target: { value: '김베이스' } });
    fireEvent.change(screen.getByLabelText(/실명/), { target: { value: '김하늘' } });
    fireEvent.change(screen.getByLabelText(/주 악기/), { target: { value: 'bass' } });
    fireEvent.change(screen.getByLabelText(/목록에 없는 악기/), { target: { value: '우쿨렐레, 가야금' } });
    fireEvent.change(screen.getByLabelText(/링크 1/), { target: { value: 'https://youtu.be/abc' } });
    fireEvent.change(screen.getByLabelText(/휴대전화/), { target: { value: '010-1234-5678' } });
    fireEvent.change(screen.getByLabelText(/^이메일/), { target: { value: 'a@example.com' } });
    fireEvent.click(screen.getByLabelText(/만 19세 이상이에요/));
    fireEvent.click(screen.getByLabelText(/위 내용에 동의해요/));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '등록하기' }));
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0];
    expect(payload).toMatchObject({
      stageName: '김베이스',
      realName: '김하늘',
      primaryInstrument: 'bass',
      instruments: [{ other: '우쿨렐레' }, { other: '가야금' }],
      sampleLinks: [{ url: 'https://youtu.be/abc', label: '' }],
      email: 'a@example.com',
      adultConfirmed: true,
      consent: true,
      company: '',
    });
    expect(typeof payload._formFillMs).toBe('number');
  });

  it('서버가 거절하면 메시지를 보여 준다', async () => {
    const onSubmit = jest.fn().mockResolvedValue({ ok: false, message: '이메일 주소를 다시 확인해 주세요.', field: 'email' });
    render(<SessionMusicianForm mode="register" submitLabel="등록하기" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/활동명/), { target: { value: 'a' } });
    fireEvent.change(screen.getByLabelText(/실명/), { target: { value: 'bb' } });
    fireEvent.change(screen.getByLabelText(/주 악기/), { target: { value: 'bass' } });
    fireEvent.click(screen.getByLabelText(/만 19세 이상이에요/));
    fireEvent.click(screen.getByLabelText(/위 내용에 동의해요/));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '등록하기' }));
    });
    expect((await screen.findAllByText('이메일 주소를 다시 확인해 주세요.')).length).toBeGreaterThan(0);
  });
});

describe('SessionMusicianForm — 본인 관리', () => {
  it('이메일은 바꿀 수 없고 동의·확인 칸이 없다', () => {
    render(<SessionMusicianForm mode="manage" initial={{ ...EMPTY_SESSION_FORM, email: 'a@example.com' }} submitLabel="저장하기" onSubmit={jest.fn()} />);
    expect(screen.getByLabelText(/^이메일/)).toBeDisabled();
    expect(screen.queryByLabelText(/위 내용에 동의해요/)).toBeNull();
    expect(screen.queryByLabelText(/만 19세 이상이에요/)).toBeNull();
  });
});

describe('parseOtherInstruments', () => {
  it('쉼표·줄바꿈으로 나누고 한도보다 하나 더 남겨 서버가 거절하게 한다', () => {
    expect(parseOtherInstruments('우쿨렐레, 가야금\n 해금 ,, ')).toEqual(['우쿨렐레', '가야금', '해금']);
    expect(parseOtherInstruments('우쿨렐레·가야금')).toEqual(['우쿨렐레', '가야금']);
    expect(parseOtherInstruments('a,b,c,d,e,f,g')).toHaveLength(6);
  });
});

describe('동의 요약 ↔ 처리방침 약속', () => {
  const section = (heading: string) => POLICY_COPY_BY_LOCALE.ko.sections.find((s) => s.heading.startsWith(heading))!;

  it('보유 기간 2년이 동의 요약·처리방침 3항·18항에서 같다', () => {
    expect(SESSION_RETENTION_YEARS).toBe(2);
    const retention = SESSION_CONSENT_SUMMARY.find((row) => row.label === '보유 기간')!.text;
    expect(retention).toContain(`${SESSION_RETENTION_YEARS}년`);
    expect(section('3.').body).toMatch(/세션 연주자 등록 정보는[^.]*2년 동안 보관/);
    expect(section('3.').body).toContain('1년 9개월째');
    expect(section('18.').items!.join('\n')).toMatch(/세션 연주자 등록 정보[^\n]*2년이 지난 등록은 행 전체를 지웁니다/);
  });

  it('동의 요약 네 줄이 항목·목적·보유 기간·거부 권리를 모두 다룬다', () => {
    expect(SESSION_CONSENT_SUMMARY.map((row) => row.label)).toEqual(['수집 항목', '이용 목적', '보유 기간', '동의 거부']);
    expect(SESSION_CONSENT_SUMMARY[3].text).toContain('등록할 수 없');
  });
});
