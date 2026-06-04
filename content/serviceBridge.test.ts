/** @jest-environment node */

import fs from 'fs';
import path from 'path';

const EXPECTED_SERVICE_BRIDGES: Record<string, string> = {
  'daw-choice1.md': '%%service:lesson%%',
  'practice-room-startup1.md': '%%service:practice%%',
  'copyright-cover1.md': '%%service:recording%%',
  'distribution1.md': '%%service:recording%%',
  'plugins1.md': '%%service:lesson%%',
};

describe('high-traffic story service bridges', () => {
  it('keeps inline service callouts on high-traffic low-lead stories', () => {
    const missing = Object.entries(EXPECTED_SERVICE_BRIDGES)
      .filter(([file, shortcode]) => {
        const content = fs.readFileSync(path.join(process.cwd(), 'content/stories', file), 'utf8');
        return !content.includes(shortcode);
      })
      .map(([file, shortcode]) => `${file}:${shortcode}`);

    expect(missing).toEqual([]);
  });
});
