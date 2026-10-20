import { decryptField, encryptField } from '../crypto/fieldCrypto';

/**
 * 세션 연주자 개인정보 JSON ↔ 암호문(`session_musicians.private_enc`).
 * 월 입주(`lib/tenancy/privateData.ts`)와 같은 방식이다. **평문을 로그·props·메일에 넣지 않는다.**
 */
export interface SessionMusicianPrivate {
  realName: string;
  phone: string;
  email: string;
  kakaoId?: string;
}

export const sealSessionPrivate = (data: SessionMusicianPrivate): string => {
  const clean: Record<string, string> = { realName: data.realName, phone: data.phone, email: data.email };
  if (data.kakaoId) clean.kakaoId = data.kakaoId;
  return encryptField(JSON.stringify(clean));
};

export const openSessionPrivate = (enc: string): SessionMusicianPrivate => {
  const parsed: unknown = JSON.parse(decryptField(enc));
  const o = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
  return {
    realName: typeof o.realName === 'string' ? o.realName : '',
    phone: typeof o.phone === 'string' ? o.phone : '',
    email: typeof o.email === 'string' ? o.email : '',
    ...(typeof o.kakaoId === 'string' && o.kakaoId ? { kakaoId: o.kakaoId } : {}),
  };
};
