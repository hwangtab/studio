/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';

/**
 * 연습실 시간제는 2026-09-25부터 판다(R02, 1시간 4,400원 VAT 포함, 온라인 예약 —
 * lib/booking/products.ts `practice-room-hourly`). 그 전에 쓴 스토리 45편이 "시간 대여는
 * 운영하지 않는다(월세 입주 전용)"고 말하고 있었고, 2026-09-27 점검에서 한꺼번에 고쳤다.
 * 합주실이 없다는 말과 엔지니어 없는 녹음실 셀프 대여가 없다는 말은 여전히 사실이라 허용한다.
 */
const STALE = [
  /시간 ?대여[^.\n|]{0,20}(운영하지 않|운영 없|하지 않)/,
  /월세 (입주 )?전용/,
  /입주 전용/,
];
const ALLOWED_CONTEXT = /셀프 녹음|엔지니어 없는/;

describe('연습실 시간제 존재와 모순되는 스토리 문구', () => {
  it('어느 스토리도 시간 대여를 운영하지 않는다고 말하지 않는다', () => {
    const dir = path.join(process.cwd(), 'content/stories');
    const hits: string[] = [];
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      fs.readFileSync(path.join(dir, file), 'utf-8').split('\n').forEach((line, i) => {
        if (ALLOWED_CONTEXT.test(line)) return;
        if (STALE.some((re) => re.test(line))) hits.push(`${file}:${i + 1}: ${line.slice(0, 80)}`);
      });
    }
    expect(hits).toEqual([]);
  });
});
