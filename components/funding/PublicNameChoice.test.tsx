import { render, screen } from '@testing-library/react';
import PublicNameChoice from './PublicNameChoice';

describe('PublicNameChoice — 미리보기 자리표시', () => {
  it('이름을 아직 안 썼을 때 실명·가린 이름은 값처럼 보이는 "이름"이 아니라 안내 문구를 보인다', () => {
    render(
      <PublicNameChoice customerName="" style="real" nickname="" onStyleChange={() => {}} onNicknameChange={() => {}} />
    );
    expect(screen.queryByText('이름')).toBeNull();
    expect(screen.getByText('이름을 입력해 주세요')).toBeTruthy();
  });

  it('닉네임 방식에서 아직 안 썼을 때도 값처럼 보이지 않는다', () => {
    render(
      <PublicNameChoice customerName="" style="nickname" nickname="" onStyleChange={() => {}} onNicknameChange={() => {}} />
    );
    expect(screen.getByText('닉네임을 입력해 주세요')).toBeTruthy();
  });

  it('이름을 쓰면 실제 값이 굵게 보인다', () => {
    render(
      <PublicNameChoice customerName="홍길동" style="real" nickname="" onStyleChange={() => {}} onNicknameChange={() => {}} />
    );
    expect(screen.getByText('홍길동')).toBeTruthy();
    expect(screen.queryByText('이름을 입력해 주세요')).toBeNull();
  });
});
