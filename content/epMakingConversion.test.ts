/** @jest-environment node */

import fs from 'fs';
import path from 'path';

describe('ep-making conversion copy', () => {
  it('connects EP production traffic to the release project offer', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'content/stories/ep-making1.md'), 'utf8');

    expect(content).toContain('3~6개월');
    expect(content).toContain('/release-project/ep');
    expect(content).toContain('%%booking:EP 제작·발매 일정 상담%%');
  });
});
