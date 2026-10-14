/**
 * 라이선스 파일 서명 **공개키** — 플러그인·앱에 박히는 값이다. `{ 키id: base64(Ed25519 공개키 raw 32바이트) }`.
 *
 * 키 생성은 `node scripts/software/generate-license-key.mjs`(비밀키는 Vercel env `SOFTWARE_LICENSE_SIGNING_KEY`에,
 * 공개키는 여기에). 키를 회전하려면 새 kid를 **더하고**(옛 kid는 이미 배포된 플러그인이 쓰므로 지우지 않는다),
 * env의 `SOFTWARE_LICENSE_KEY_ID`를 새 kid로 바꾼다. 지금은 키가 없다 — 비어 있는 동안 활성화 API는 503으로 닫혀 있다.
 *
 * **이 모듈은 아무것도 import하지 않는다.**
 */
export const SOFTWARE_LICENSE_PUBLIC_KEYS: Readonly<Record<string, string>> = {};
