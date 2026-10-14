import { generateLicenseKey, licenseKeyHint, normalizeLicenseKey } from './key';

describe('라이선스 키', () => {
  it('NOL-XXXXX-XXXXX-XXXXX-XXXXX 형식이고 헷갈리는 글자(I·L·O·U)가 없다', () => {
    for (let i = 0; i < 200; i++) {
      const key = generateLicenseKey();
      expect(key).toMatch(/^NOL(-[0-9A-HJKMNP-TV-Z]{5}){4}$/);
    }
  });

  it('겹치지 않는다(1만 개)', () => {
    const keys = new Set(Array.from({ length: 10000 }, generateLicenseKey));
    expect(keys.size).toBe(10000);
  });

  it('고객 입력의 대소문자·하이픈·공백을 무시하고, O→0·I/L→1로 읽는다', () => {
    const key = 'NOL-7K2QD-M9XAP-4RTVB-HC3WN';
    expect(normalizeLicenseKey(key)).toBe(key);
    expect(normalizeLicenseKey(' nol 7k2qd m9xap 4rtvb hc3wn ')).toBe(key);
    expect(normalizeLicenseKey('7K2QDM9XAP4RTVBHC3WN')).toBe(key);
    expect(normalizeLicenseKey('NOL-7K2QD-M9XAP-4RTVB-HC3WO')).toBe('NOL-7K2QD-M9XAP-4RTVB-HC3W0');
    expect(normalizeLicenseKey('NOL-1K2QD-M9XAP-4RTVB-HC3WN')).toBe(normalizeLicenseKey('NOL-lK2QD-M9XAP-4RTVB-HC3WN'));
  });

  it('형식이 아니면 null', () => {
    for (const bad of [undefined, null, 123, '', 'NOL-7K2QD', 'NOL-7K2QD-M9XAP-4RTVB-HC3WNX', 'NOL-7K2QD-M9XAP-4RTVB-HC3W!', 'x'.repeat(100)]) {
      expect(normalizeLicenseKey(bad)).toBeNull();
    }
  });

  it('힌트는 마지막 묶음', () => {
    expect(licenseKeyHint('NOL-7K2QD-M9XAP-4RTVB-HC3WN')).toBe('HC3WN');
  });
});
