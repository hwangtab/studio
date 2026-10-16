import { decryptField, encryptField } from '../crypto/fieldCrypto';
import type { TenancyPrivate } from './rules';

/** 월 입주자 개인정보 JSON ↔ 암호문. 비어 있으면 null(암호화할 것이 없다). 평문을 로그에 남기지 않는다. */
export const sealPrivate = (data: TenancyPrivate): string | null => {
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => typeof v === 'string' && v !== ''));
  return Object.keys(clean).length === 0 ? null : encryptField(JSON.stringify(clean));
};

export const openPrivate = (enc: string | null): TenancyPrivate => {
  if (!enc) return {};
  const parsed: unknown = JSON.parse(decryptField(enc));
  return parsed && typeof parsed === 'object' ? (parsed as TenancyPrivate) : {};
};
