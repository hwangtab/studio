# 보도자료 메일 수신거부 — 설계

작성 2026-09-14 · 대상 저장소 `studio`(엔드포인트)와 `music-promo`(발송·반영)

## 왜 하는가

보도자료 메일은 지금 본문과 `List-Unsubscribe` 헤더 모두 **"회신으로 알려 주세요"** 한 가지만
안내한다. 그런데 그 회신을 받아 처리하는 코드가 두 저장소 어디에도 없다. 실제 동선은 이렇다.

```
수신자가 회신 → 사람이 메일함에서 읽음 → 사람이 log --opt-out 을 직접 타이핑
```

가운데를 잇는 것이 사람의 기억뿐이다. 지금 물량에서는 돌아가지만, 유료 대행으로 고객이 늘면
여기가 가장 먼저 무너진다. 이 저장소에는 같은 실패가 이미 한 번 있었다 — README가 "배치마다
`bounces`를 돌려라"라고 적어 두었지만 《남산타워》는 반송률 9.1%까지 갔다. **안내가 문서에만
있으면 급할 때 지켜지지 않는다.**

법에서도 정보통신망법 제50조 제4항이 수신거부 의사를 **쉽게 표시할 수 있는 조치**를 요구하고,
같은 조 제2항이 그 의사에 반한 전송을 금지한다.

`List-Unsubscribe-Post`(RFC 8058 원클릭)를 안 붙인 이유도 결국 같은 갭의 다른 표현이다 —
코드 주석에 "POST를 받을 주소가 있어야 하는데 우리는 회신으로만 받는다"라고 적혀 있다.

## 범위

- **포함**: 서명된 수신거부 링크, 원클릭 POST, 확인 화면, 클라우드 저장, 로컬 registry로
  당겨오기, 당겨오지 않으면 발송을 막는 가드.
- **제외**: 보도자료가 정보통신망법상 광고성 정보에 해당하는지에 대한 판단과 그에 따른
  `(광고)` 제목·사업자 정보 표기. 이건 변호사 확인 사항이고 별도 과제다. 이 설계는 "쉬운 거부
  수단"만 충족한다.
- **제외**: 회신으로 오는 수신거부의 자동 처리. 회신 경로는 안내에 남기지만 사람이 읽는다.
  받은 편지함을 파싱하는 기계를 들이는 것은 이 문제에 비해 과하다.

## 전체 흐름

```
발송     renderEmail이 수신자마다 서명 링크를 넣는다
         https://press.studionol.co.kr/u/<token>
              │
클릭     ├── Gmail·Outlook의 수신거부 버튼 → POST(원클릭) → 즉시 반영
         └── 본문 링크 클릭 → GET → 확인 화면 → 버튼 → POST
              │
저장     Turso `press_optouts`에 한 줄 (주소가 아니라 해시)
              │
당김     music-promo optouts --pull → registry.json에 optedOut 반영
              │
가드     당긴 지 오래되었으면 send가 멈춘다
```

마지막 줄이 이 설계의 중심이다. 웹 엔드포인트는 운영자 맥의 `~/.music-promo/registry.json`에
쓸 수 없으므로 **반드시 당겨오는 단계가 생기고, 사람은 그 단계를 잊는다.** 잊었을 때 조용히
발송이 나가면 이 기능 전체가 장식이 된다. 반송 조회 가드(`bounce-check.json` + `send`의
"조회 없이 N통" 검사)와 같은 형태로 막는다.

## 1. 토큰

### 형식

```
<payload-b64url>.<hmac-b64url>

payload = {"v":1,"h":"<주소해시 32자>","c":"<캠페인 슬러그>","l":"<로케일>","t":<발급 epoch>}
hmac    = HMAC-SHA256(payload-b64url, PRESS_UNSUB_SECRET)
```

### 왜 HMAC인가 — 이 저장소의 선례와 다르다

펀딩·예약은 **랜덤 문자열을 DB에 저장해 두고 대조**한다(`lib/booking/token.ts`,
`orders.manage_token`). 여기서 같은 방식을 쓰면 발송 **전에** 수신자 1,742명분 토큰 행을 DB에
심어야 하고, 그건 기자·평론가 명단을 통째로 클라우드에 올리는 것이다. 개인정보 처리방침에
언론 홍보 연락처 처리를 공개하면서 계속 좁혀 온 노출 범위를 여기서 되돌리게 된다.

HMAC이면 링크는 오프라인에서 만들어지고, DB는 **클릭이 일어난 뒤에야** 한 줄을 갖는다.

### 주소를 토큰에 넣지 않는다

payload의 `h`는 주소가 아니라 `sha256(소문자주소 + PRESS_UNSUB_SALT)`의 앞 32자다.

- **솔트는 운영자 맥에만 있다.** 엔드포인트는 `h`를 검증하거나 되돌릴 필요가 없다 — 서명이
  "우리가 보낸 링크"임을 보장하고, 서버는 `h`를 그대로 저장하기만 한다.
- music-promo는 자기 명단의 주소를 같은 방식으로 해싱해 맞춘다. **주소는 맥을 떠나지 않는다.**
- 우리가 잃는 기능이 없다. `h`는 항상 우리가 보낸 주소에서 나왔으므로 대조가 실패할 일이 없다.

전달된 메일에서 제3자가 누른 경우는 그 사람의 주소가 아니라 **원래 수신자**가 거부된다.
이것이 옳다 — 우리가 보낸 상대는 그 사람이고, 거부 의사가 전달자를 거쳐 왔을 뿐이다.

### 만료

두지 않는다. 기자가 석 달 뒤에 누를 수 있고, 그때 "만료된 링크입니다"를 보여 주는 것은
거부 수단을 어렵게 만드는 것이다. `t`는 감사와 키 교체 때 경계를 긋기 위해서만 싣는다.

## 2. 엔드포인트 (`studio`)

### 라우트 하나가 GET·POST를 모두 받는다

RFC 8058 원클릭은 `List-Unsubscribe`의 **그 URL로 POST**가 온다. Pages Router의 페이지
컴포넌트는 POST를 받지 못하므로 이 경로는 API 라우트여야 한다. 그러면 GET 확인 화면도 같은
라우트가 HTML을 돌려주는 편이 낫다 — 로케일 페이지를 만들면 `pageRouteMap` 등록,
`pageLastmod` 생성, 사이트맵 제외, robots disallow, `privatePaths` 등록까지 다섯 겹이 따라오는데
그 전부가 불필요해진다. `next.config.mjs`가 이미 `/api/:path*`에 `X-Robots-Tag: noindex, nofollow`를
붙이고 `robots.txt`가 `/api/`를 막는다.

```
pages/api/press/unsubscribe/[token].ts
  GET  → 확인 화면 HTML (payload의 l로 언어 결정). 이 시점에는 아직 반영하지 않는다.
  POST → 즉시 반영, 204
  그 외 → 405
```

**GET이 거부를 반영하지 않는 것은 의도다.** 메일 본문의 링크는 스팸 필터·보안 게이트웨이가
미리 열어 보는 일이 흔하고, GET으로 반영하면 기자가 누른 적도 없는데 거부 처리된다. 원클릭
POST는 메일 클라이언트가 사람의 버튼 클릭에만 보내므로 이 문제가 없다.

확인 화면에는 **되돌리기를 두지 않는다.** registry에는 수신거부 해제 경로가 의도적으로 없고
(`src/commands/log.ts` 첫 주석), 화면에만 해제 버튼을 만들면 그 원칙이 무너진다. 대신 "실수로
누르셨다면 이 메일에 회신해 주세요"를 적는다 — 사람이 판단할 일로 남긴다.

`press.studionol.co.kr/u/<token>` → `/api/press/unsubscribe/<token>` 리라이트는 미들웨어가 한다.

### 호스트 격리

`press.studionol.co.kr`을 studio Vercel 프로젝트의 도메인으로 추가한다. 이때 **막지 않으면
사이트 전체가 두 주소로 답한다** — 같은 콘텐츠가 두 호스트에 살면서 색인이 갈리고, 지금까지
쌓은 canonical·hreflang 정리가 무너진다.

미들웨어에서 `host === 'press.studionol.co.kr'`이면:

- `/u/:token` → `/api/press/unsubscribe/:token`으로 rewrite
- 그 밖의 모든 경로 → 404

DNS는 `press` A/CNAME을 Vercel로 추가한다. 같은 존의 메일 레코드(`send.press`, `rsend.press`,
`resend._domainkey.press`, `_dmarc.press`)는 건드리지 않는다 — 이름이 다르므로 충돌하지 않는다.

### 동작

1. `token`을 파싱하고 서명을 `timingSafeEqual`로 검증한다. 실패하면 **400이 아니라 확인 화면과
   같은 모양의 안내**를 보여 준다(POST는 400). 위조 토큰에 상세한 오류를 돌려줄 이유가 없다.
2. rate limit — 기존 `consumeRateLimit`(`lib/booking/rate-limit.ts`)을 IP 키로 쓴다. 검증을
   rate limit **앞**에 둔다(`pages/api/funding/pledges.ts:31-38`의 기록된 함정: 반대로 하면
   오류 반복만으로 한도가 소진된다).
3. `press_optouts`에 삽입하되 **`email_hash` 충돌이면 아무것도 하지 않고 성공으로 응답한다**
   (`ON CONFLICT DO NOTHING`). 두 번 눌렀다고 실패 화면을 보여 주면 거부가 안 된 줄 알게 된다.
   덮어쓰지 않는 이유: `campaign_slug`·`created_at`은 **처음 거부한 시점**이 기록으로서 의미가
   있다. 나중 캠페인 이름으로 갱신하면 "언제부터 거부했는가"를 잃는다.
4. 응답 헤더에 `Cache-Control: private, no-store`.

### 스키마 (추가 전용)

```ts
export const pressOptouts = sqliteTable('press_optouts', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  emailHash: text('email_hash').notNull().unique(),
  campaignSlug: text('campaign_slug').notNull(),
  source: text('source', { enum: pressOptoutSourceEnum }).notNull(),  // 'one-click' | 'page'
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
})
```

Drizzle 마이그레이션 SQL을 커밋하고, 프로덕션 적용(`db:migrate`)은 **운영자가 직접** 한다
(기존 규칙: `docs/superpowers/plans/2026-09-09-funding-phase1.md`).

### 당겨오기용 읽기 엔드포인트

```
GET /api/press/optouts?since=<epoch>
Authorization: Bearer <PRESS_PULL_TOKEN>
→ { ok: true, rows: [{ emailHash, campaignSlug, createdAt }], now: <epoch> }
```

토큰 불일치는 404(존재 여부를 알려 주지 않는다 — `pages/api/funding/display-name.ts:19-20`의
선례). 이 경로는 `press.studionol.co.kr`이 아니라 본진에서만 응답한다.

## 3. 메일 쪽 변경 (`music-promo`)

### 헤더

```
List-Unsubscribe: <https://press.studionol.co.kr/u/TOKEN>, <mailto:REPLY?subject=Unsubscribe>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

https를 앞에 둔다. 메일 클라이언트는 대체로 첫 번째를 쓴다.

### 본문

푸터의 수신거부 문구가 지금은 "회신으로 알려 주시면 됩니다"인데, 원클릭 링크 옆에 그대로 두면
서로 어긋나는 안내가 된다. 그래서 **문구를 바꾸고 링크를 함께 싣는다.**

문구는 `SOURCE_NOTE`와 같은 자리에 **공유 상수 `UNSUB_NOTE`**(9개 로케일)로 둔다. 이유도 같다 —
수신거부 방법은 사실 진술이라 앨범이 바뀐다고 달라지지 않는다. 반면 캠페인 데이터의
`locales[*].labels.optout`은 회신 안내 전용 문구라 **쓰이지 않게 되므로 타입과 캠페인 5개
파일에서 제거한다.** 남겨 두면 죽은 데이터가 되고, 다음 사람이 그걸 보고 문구를 고친다.

ko 분기의 `CLOSING.optout`도 같이 정리한다.

### 서명

`renderEmail`은 순수 함수를 유지한다. 토큰 생성은 호출부(`send.ts`)에서 하고
`unsubscribeUrl: string`을 인자로 넘긴다. 비밀키를 렌더러가 알 필요가 없다.

env: `PRESS_UNSUB_SECRET`(양쪽 공유), `PRESS_UNSUB_SALT`(맥 전용), `PRESS_PULL_TOKEN`(양쪽 공유).

## 4. 당겨오기와 가드 (`music-promo`)

### `optouts --pull`

1. `~/.music-promo/optout-pull.json`의 마지막 `since`를 읽는다(없으면 0).
2. 읽기 엔드포인트를 호출한다.
3. 각 행의 `emailHash`를 registry의 주소 해시와 맞춰 `optedOut: true`로 바꾼다.
   **`updateRegistry`를 거친다** — 잠금과 손상 검사를 우회하면 안 된다(2026-09-14에 고친 사고).
4. 맞는 주소가 없는 행은 건너뛰되 **건수를 화면에 내보낸다.** 조용히 버리면 솔트가 바뀌었거나
   명단이 갈렸을 때 아무도 모른다.
5. 성공했을 때만 `since`를 갱신한다. 실패한 채로 갱신하면 그 구간의 거부가 영영 반영되지 않는다.

### 가드

`send`가 실제 발송(`--send`) 전에 검사한다.

- 한 번도 당긴 적이 없으면 → 중단
- 마지막 당김이 **24시간보다 오래되었으면** → 중단

메시지는 무엇을 하라는 것인지 한 줄로 말한다(`optouts --pull`). 우회 플래그는 두지 않는다 —
하루에 한 번 명령 하나면 되는 일이고, 여기에 `--over-` 플래그를 만들면 반송 가드와 달리
"거부 의사에 반한 전송"이라 법이 걸린 자리다.

**사이트가 죽어 당길 수 없을 때도 발송이 막힌다.** 이것도 의도다. 거부 목록을 확인할 수 없는
상태에서 보내는 것은 거부한 사람에게 보낼 수 있다는 뜻이고, 그 위험이 "오늘 못 보냄"보다 크다.
반송 가드가 `--over-cap`을 허용한 것과 갈리는 지점이며, 그쪽은 평판 문제지만 이쪽은 의사에
반한 전송이다.

## 5. 검증

전부 "고친 곳을 되돌려 실패를 확인"하는 방식까지 포함한다.

| 대상 | 확인할 것 |
|---|---|
| 토큰 | 위조 서명 거부 · payload 변조 거부 · 정상 왕복 · 키가 다르면 거부 |
| 해시 | 대소문자·공백이 달라도 같은 `h` · 솔트가 다르면 다른 `h` |
| 엔드포인트 | POST 즉시 반영 · 같은 토큰 두 번이 성공 · GET이 HTML · 잘못된 메서드 405 |
| 호스트 격리 | `press.studionol.co.kr/`와 임의 경로가 404 · `/u/<token>`만 통과 |
| 헤더 | `List-Unsubscribe`에 https와 mailto가 모두 · `List-Unsubscribe-Post` 존재 |
| 당겨오기 | 해시 매칭 · 못 맞춘 행의 건수 보고 · 실패 시 `since` 미갱신 |
| **가드** | 당긴 적 없으면 중단 · 24시간 초과면 중단 · 당긴 직후면 통과 |

마지막 행이 가장 중요하다. 앞선 라운드에서 반송 가드가 "있는데 무력한 상태"였던 것이 실제
사고였다 — 가드는 그것이 막는 상황을 재현해서 확인한다.

## 열어 둔 것

- **`press` A 레코드 추가와 Vercel 도메인 연결은 사람이 한다.** hosting.kr 콘솔과 Vercel
  대시보드 작업이고, 2026-09-14 DMARC 작업에서 확인했듯 이 존의 전파는 즉시가 아니다.
- **DMARC `rua` 전파가 아직 섞여 나온다**(약 60:40). 이 설계와 직접 관계는 없지만, 같은 존을
  건드리므로 `press` 레코드를 넣을 때 함께 확인한다.
