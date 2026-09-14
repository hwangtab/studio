import { pressOptoutSourceEnum, pressOptouts } from '../../db/schema';

/**
 * DB에 붙는 부분은 단위 테스트로 검증하지 않는다 — 이 저장소에는 Turso를 띄우는
 * 테스트 하네스가 없고, 그걸 이 기능 하나를 위해 들이는 것은 과하다.
 *
 * 대신 스키마의 약속만 고정한다. 아래 두 가지가 깨지면 수신거부가 조용히
 * 덮어써지거나(UNIQUE 상실) 값이 안 맞는다.
 */
describe('press_optouts 스키마', () => {
  it('주소가 아니라 해시 컬럼을 갖는다', () => {
    const columns = Object.keys(pressOptouts);
    expect(columns).toContain('emailHash');
    expect(columns).not.toContain('email');
  });

  it('source는 두 값만 받는다', () => {
    expect([...pressOptoutSourceEnum]).toEqual(['one-click', 'page']);
  });
});
