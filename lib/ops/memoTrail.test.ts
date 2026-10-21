import { appendMemoLine, DUPLICATE_ACK_MARKER, MEMO_CONFLICT, MEMO_LIMIT, retryOnMemoConflict } from './memoTrail';

const trail = (n: number) => `[분야 변경 기타→연습실 · op${n} · 2026-10-${String(n).padStart(2, '0')}]`;

describe('appendMemoLine', () => {
  it('짧으면 그냥 줄을 붙인다', () => {
    expect(appendMemoLine(null, '[환불 0→1원 · a · d]')).toBe('[환불 0→1원 · a · d]');
    expect(appendMemoLine('메모', trail(1))).toBe(`메모\n${trail(1)}`);
  });

  it('넘치면 가장 오래된 기록 줄부터 버리고 머리 메모는 지킨다', () => {
    const head = '운영자 원본 메모 '.repeat(20).trim();
    let memo: string | null = head;
    for (let i = 1; i <= 40; i += 1) memo = appendMemoLine(memo, trail(i), 400);
    expect(memo!.length).toBeLessThanOrEqual(400);
    expect(memo!.startsWith(head)).toBe(true);
    expect(memo!.endsWith(trail(40))).toBe(true);
    expect(memo).not.toContain(trail(1));
  });

  it('[중복 아님] 줄은 오래돼도 버리지 않는다', () => {
    let memo: string | null = appendMemoLine('메모', `${DUPLICATE_ACK_MARKER} op · 2026-10-01`, 300);
    for (let i = 1; i <= 30; i += 1) memo = appendMemoLine(memo, trail(i), 300);
    expect(memo).toContain(DUPLICATE_ACK_MARKER);
    expect(memo!.length).toBeLessThanOrEqual(300);
    expect(memo!.endsWith(trail(30))).toBe(true);
  });

  it('머리가 상한에 가까우면 머리를 줄이되 새 줄(표시)은 반드시 남는다', () => {
    const long = '가'.repeat(MEMO_LIMIT);
    const out = appendMemoLine(long, DUPLICATE_ACK_MARKER);
    expect(out.length).toBeLessThanOrEqual(MEMO_LIMIT);
    expect(out.endsWith(`…\n${DUPLICATE_ACK_MARKER}`)).toBe(true);
  });

  it('손으로 적은 대괄호 메모는 기록 줄로 보지 않는다', () => {
    const out = appendMemoLine(`[급함] 입금 확인\n${trail(1)}`, trail(2), 60);
    expect(out).toBe(`[급함] 입금 확인\n${trail(2)}`);
  });
});

describe('retryOnMemoConflict', () => {
  it('밀리면 다시 시도하고 성공하면 결과를 돌려준다', async () => {
    const attempt = jest.fn().mockResolvedValueOnce(MEMO_CONFLICT).mockResolvedValueOnce('ok');
    await expect(retryOnMemoConflict(attempt)).resolves.toBe('ok');
    expect(attempt).toHaveBeenCalledTimes(2);
  });
  it('계속 밀리면 던진다', async () => {
    await expect(retryOnMemoConflict(async () => MEMO_CONFLICT)).rejects.toThrow('memo_conflict');
  });
});
