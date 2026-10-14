# 라이선스 연동 안내 — 플러그인·앱 쪽에서 할 일

대상: 스튜디오 놀 소프트웨어(JUCE 플러그인, 그 밖의 C++ 플러그인, 데스크톱 앱)에 정식판 잠금을 붙이는 개발자.
서버 쪽 정본은 `lib/software/`, 상품은 `data/software/catalog.ts`, 계획은 `docs/software-sales-plan-2026-10.md`.

## 1. 흐름

```
[구매/수동 발급] → 라이선스 키 NOL-XXXXX-XXXXX-XXXXX-XXXXX
      │
      ▼  (처음 한 번, 인터넷 필요)
플러그인에 키 입력 → POST /api/software/activate → 서명된 라이선스 파일
      │
      ▼  (이후 매번, 오프라인)
라이선스 파일을 디스크에 저장 → 실행할 때마다 내장 공개키로 서명 검증 + 기기·상품 대조 → 정식판
```

- 체험판과 정식판은 **같은 바이너리**다. 유효한 라이선스 파일이 있으면 정식, 없으면 체험 모드.
- 실행 중에 서버를 부르지 않는다. 서버가 죽어도, 인터넷이 없어도 이미 활성화한 기기는 계속 돈다.

## 2. 기기 식별값(machineId)

- 기기마다 고정이고 재설치해도 같은 값. 원값을 그대로 보내지 말고 **해시해서** 보낸다: `hex(sha256("<상품 slug>:" + 원값))` (64자).
- 허용 형식: **소문자 hex 64자**(sha256 결과 그대로). 원래 값(UUID 등)을 보내면 400 — 처리방침이 "원래 값이 아니라 변환한 값"을 약속한다.
- JUCE: `juce::SystemStats::getUniqueDeviceID()`(JUCE 7+)를 원값으로 쓴다. 비JUCE: macOS `IOPlatformUUID`, Windows `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid`, Python은 `py-machineid` 같은 라이브러리.
- 하드웨어 교체로 값이 바뀌면 그 기기는 새 기기로 센다 — 고객은 구매자 화면(또는 운영자)에서 옛 기기를 해제한다.

## 3. API

모든 요청은 JSON(`Content-Type: application/json`), 응답은 JSON. 기본 주소 `https://studionol.co.kr`. 헤더를 빠뜨려도 서버가 본문을 JSON으로 다시 읽지만, 헤더를 붙이는 것이 정석이다.

### POST `/api/software/activate`

```json
{ "key": "NOL-7K2QD-M9XAP-4RTVB-HC3WN", "product": "<상품 slug>", "machineId": "<64자 hex>", "label": "Studio iMac", "appVersion": "1.0.0" }
```

키는 대소문자·하이픈·공백을 무시한다. `label`은 고객이 기기 목록에서 알아볼 이름(80자까지, 보통 컴퓨터 이름).

| 상태 | `error` | 화면에 할 말 |
|---|---|---|
| 200 | — | `licenseFile`을 저장하고 정식판으로 전환 |
| 400 | `bad_request` | 입력 형식 오류 |
| 404 | `invalid_key` | "키가 맞지 않습니다" — 없는 키와 다른 상품의 키를 구분하지 않는다 |
| 403 | `revoked` | "사용할 수 없는 라이선스입니다(환불·취소)" |
| 409 | `activation_limit` | "활성화 가능한 기기 수를 넘었습니다. 쓰지 않는 기기에서 해제하거나(소프트웨어 안·구매 내역 화면) 문의해 주세요" |
| 429 | `rate_limited` | 잠시 뒤 다시 |
| 503 | `unavailable` | 서버 점검 — 잠시 뒤 다시 |

같은 기기에서 다시 부르면 기기 수를 늘리지 않고 새 파일을 준다(재설치 때 그대로 다시 활성화하면 된다).

### POST `/api/software/deactivate`

```json
{ "key": "…", "product": "…", "machineId": "…" }
```

플러그인 안의 "이 기기에서 해제" 버튼용. 성공하면 로컬 라이선스 파일도 지운다. 이미 해제된 기기면 200 `deactivated: false`.

**해제 한도**: 라이선스당 30일에 5번(`SOFTWARE_DEACTIVATIONS_PER_30_DAYS`, 구매 내역 화면의 해제와 합산). 넘으면 429 `deactivation_limit` — "이번 달 해제 횟수를 다 썼습니다. 문의해 주세요". 서명 파일은 오프라인이라, 한도가 없으면 활성화→해제를 되풀이해 기기 수 한도를 무력화할 수 있다. 운영자는 관리자 화면에서 한도 없이 해제한다.

### GET `/api/software/latest?product=<slug>`

`{ "version": "1.1.0", "date": "2026-11-01", "notes": [...], "notesEn": [...] }` — 하루 한 번까지만 묻는다. 개인정보를 보내지 않는다.

## 4. 라이선스 파일

```json
{ "v": 1, "kid": "k1", "payload": "<base64url>", "sig": "<base64url>" }
```

- `payload`를 base64url로 풀면 JSON 바이트다: `{ "lic": "<라이선스 id>", "product": "<slug>", "machine": "<machineId>", "edition": "full", "issuedAt": "…", "keyHint": "<키 끝 5자>" }`.
- `sig`는 **payload를 푼 원래 바이트**에 대한 Ed25519 서명(64바이트)이다. JSON을 다시 직렬화해서 검증하지 말 것 — 공백·순서가 달라지면 깨진다.
- 공개키는 `data/software/publicKeys.ts`의 `{ kid: base64(32바이트) }`. 바이너리에 **모든 kid**를 박아 두고 파일의 `kid`로 고른다(키 회전 대비).

### 검증 순서 (실행할 때마다)

1. 파일 읽기 → JSON 파싱 → `v == 1`
2. `kid`로 공개키 고르기(모르면 실패)
3. `payload`·`sig` base64url 디코드(`-`→`+`, `_`→`/`, `=` 패딩 보충 후 일반 base64로 풀어도 된다)
4. Ed25519 검증(payload 바이트, sig, 공개키)
5. payload JSON 파싱 → `product == 내 slug` 그리고 `machine == 지금 계산한 machineId` 그리고 `edition == "full"`
6. 하나라도 틀리면 체험 모드. 검증 실패를 사용자에게 자세히 설명하지 않는다("라이선스를 다시 활성화해 주세요" 정도).

저장 위치: macOS `~/Library/Application Support/Studio NOL/<slug>/license.json`, Windows `%APPDATA%\Studio NOL\<slug>\license.json`. 플러그인 여러 인스턴스가 같은 파일을 읽는다.

## 5. 언어별 검증 코드

### C++ (JUCE 포함) — Monocypher

[Monocypher](https://monocypher.org) 4.x의 **`optional/monocypher-ed25519.c`**를 쓴다. 기본 `crypto_eddsa_check`는 BLAKE2b 방식이라 **Ed25519가 아니다** — 반드시 ed25519 확장의 함수를 쓸 것.
소스 파일 4개(`monocypher.c/.h`, `optional/monocypher-ed25519.c/.h`)를 프로젝트에 넣으면 끝이다(공개 도메인/CC0·BSD).

```cpp
#include "monocypher-ed25519.h"

// pub: 32바이트, sig: 64바이트, msg: payload 바이트
bool verifyEd25519 (const uint8_t pub[32], const uint8_t sig[64], const uint8_t* msg, size_t len)
{
    return crypto_ed25519_check (sig, pub, msg, len) == 0;
}
```

JUCE에서 base64url 풀기: 문자열의 `-`/`_`를 `+`/`/`로 바꾸고 길이가 4의 배수가 되게 `=`를 붙인 뒤 `juce::Base64::convertFromBase64 (outputStream, string)`.
machineId 해시는 `juce::SHA256 (("<slug>:" + juce::SystemStats::getUniqueDeviceID()).toUTF8()).toHexString()`.
네트워크 요청은 `juce::URL(...).withPOSTData(json)`에 **`.withExtraHeaders("Content-Type: application/json")`를 꼭 붙여**(JUCE는 Content-Type이 없으면 폼 인코딩으로 보낸다) `createInputStream(...)`, 응답 JSON은 `juce::JSON::parse`.

### Python — `cryptography`

```python
import base64, json
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

def b64url(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))

def verify(license_text: str, public_keys: dict[str, str], product: str, machine_id: str) -> bool:
    try:
        f = json.loads(license_text)
        if f.get("v") != 1 or f.get("kid") not in public_keys:
            return False
        payload = b64url(f["payload"])
        Ed25519PublicKey.from_public_bytes(base64.b64decode(public_keys[f["kid"]])).verify(b64url(f["sig"]), payload)
        p = json.loads(payload)
        return p.get("product") == product and p.get("machine") == machine_id and p.get("edition") == "full"
    except Exception:  # 깨진 파일(배열·null·타입 오류 포함)은 전부 체험 모드로 — 플러그인이 죽지 않게
        return False
```

### Node·Electron

```js
const crypto = require('node:crypto');
const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex'); // Ed25519 공개키 DER 머리

function verify(licenseText, publicKeys, product, machineId) {
  try {
    const f = JSON.parse(licenseText);
    if (f.v !== 1 || !publicKeys[f.kid]) return false;
    const key = crypto.createPublicKey({ key: Buffer.concat([SPKI_PREFIX, Buffer.from(publicKeys[f.kid], 'base64')]), format: 'der', type: 'spki' });
    const payload = Buffer.from(f.payload, 'base64url');
    if (!crypto.verify(null, payload, key, Buffer.from(f.sig, 'base64url'))) return false;
    const p = JSON.parse(payload.toString('utf8'));
    return p.product === product && p.machine === machineId && p.edition === 'full';
  } catch { return false; }
}
```

## 6. 체험 모드

- 기간은 상품 정본의 `trialDays`(기본 30일). 첫 실행 날짜를 로컬에 기록해 센다 — 서버는 체험판을 추적하지 않는다.
- 체험 중에는 **전 기능**이 돈다. 기간이 끝나면 처리를 멈추거나(바이패스) 일정 간격으로 무음을 넣는 등 상품마다 정한다.
- 체험 기록을 지우면 다시 30일이 되는 것은 감수한다(정직한 사람을 정직하게 두는 수준까지만).

## 7. 시험 방법

1. 운영자가 `/admin/software`에서 수동 발급 → 키를 받는다.
2. 플러그인에 키 입력 → 활성화 → 인터넷을 끄고 DAW 재시작 → 정식판 유지되는지.
3. 라이선스 파일의 한 글자를 바꿔 → 체험 모드로 떨어지는지.
4. 같은 키로 `maxActivations`(기본 3)대를 넘게 활성화 → 409가 나오는지. 관리자에서 기기 해제 → 다시 되는지.
5. 관리자에서 라이선스 취소 → 새 기기 활성화가 403인지(이미 활성화한 기기는 오프라인 파일이라 계속 돈다 — 의도한 동작이다).
