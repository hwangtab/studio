import * as schema from './index';

describe('utils/schema modular entrypoint', () => {
  it('exposes schema generators from a dedicated schema module', () => {
    expect(typeof schema.generateDefaultSchema).toBe('function');
    expect(typeof schema.generateArticleSchema).toBe('function');
    expect(typeof schema.generateReleaseProjectSchema).toBe('function');
  });
});
