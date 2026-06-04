/** @jest-environment node */

import fs from 'fs';
import path from 'path';

describe('regionRedirectMap', () => {
  it('does not contain duplicate root keys that JSON parsing would silently overwrite', () => {
    const filePath = path.join(process.cwd(), 'lib/regionRedirectMap.json');
    const source = fs.readFileSync(filePath, 'utf8');
    const rootKeyPattern = /^\s*"([^"]+)"\s*:/gm;
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const match of source.matchAll(rootKeyPattern)) {
      const key = match[1];
      if (seen.has(key)) duplicates.add(key);
      seen.add(key);
    }

    expect([...duplicates].sort()).toEqual([]);
  });
});
