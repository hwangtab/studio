/** @jest-environment node */

import fs from 'fs';
import path from 'path';

const walk = (dir: string): string[] => {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return [fullPath];
  });
};

describe('Next pages routes', () => {
  it('does not keep test files under pages where Next exposes them as routes', () => {
    const pagesDir = path.join(process.cwd(), 'pages');
    const testFiles = walk(pagesDir)
      .filter((filePath) => /\.(test|spec)\.[jt]sx?$/.test(filePath))
      .map((filePath) => path.relative(process.cwd(), filePath));

    expect(testFiles).toEqual([]);
  });
});
