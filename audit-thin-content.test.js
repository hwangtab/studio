/** @jest-environment node */

const { execFileSync } = require('child_process');

describe('thin content audit', () => {
  it('does not fail for pages protected by runtime noindex policy', () => {
    const output = execFileSync(process.execPath, ['scripts/audit-thin-content.js', '--fail'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    expect(output).toContain('actionable (indexable & thin): 0');
    expect(output).not.toContain('"stories": [');
  });
});
