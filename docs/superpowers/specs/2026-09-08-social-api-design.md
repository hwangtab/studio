# Instagram·Threads API 자동화 — 설계 (2026-09-08)

## 목적

스토리·포트폴리오 글을 Instagram 피드와 Threads에 CLI 한 줄로 발행한다. 댓글·DM 응대와
성과 수집은 같은 토큰 기반 위에 2·3차로 얹는다(이 문서는 1차만 다룬다).

## 전제 (실측·문서 확인)

- Meta 앱 `Studio NOL Social`(1612663780237986). Instagram use case는 **Instagram API with
  Instagram Login**(페이스북 페이지 불필요), Threads use case 별도. 둘 다 `@studio_nol_`이
  테스터로 수락됨. 인스타는 이미 비즈니스 계정.
- 앱 심사 없이도 앱 역할이 있는 본인 계정에는 전부 동작한다(Standard Access).
- 장기 토큰 60일. `refresh_access_token`으로 연장(24시간 이상 지난 토큰만).
- Instagram은 **공개 URL의 JPEG만** 받는다. `/api/og/story`는 PNG를 내므로 그대로 못 쓴다.
- Threads 텍스트 500자, `link_attachment`로 링크 카드. 컨테이너 생성 후 30초 대기 권장.
- 저장소는 **public**이다. 토큰·시크릿은 `.env.local`에만 둔다.

## 구성

| 파일 | 역할 |
|---|---|
| `scripts/social/meta.mjs` | env 로드, Graph 호출 헬퍼, 토큰 저장(`.env.local` 갱신), IG·Threads API 래퍼 |
| `scripts/social/auth.mjs` | 1회 OAuth. `localhost:3939/callback`로 코드 수신 → 단기→장기 토큰 → env 저장. `--refresh` |
| `scripts/social/compose.mjs` | 순수 함수: 캡션 조립(IG/Threads 각각), 스토리 URL, 이미지 소스 결정 |
| `scripts/social/compose.test.ts` | 위 순수 함수 jest 검사 |
| `scripts/social/post.mjs` | `--slug <s> --to ig,threads [--dry-run]`. 발행 + 원장 기록 |
| `docs/social/posted.json` | 발행 원장(slug → 플랫폼별 post id·시각). 중복 발행 차단 |

## 데이터 흐름 (post)

1. `content/stories/<slug>.md` frontmatter(title·summary·thumbnail·tags) 읽기.
2. 원장에 같은 slug+플랫폼이 있으면 `--force` 없이는 중단.
3. 이미지: `https://studionol.co.kr/api/og/story?slug=…&title=…` PNG를 받아 sharp로 JPEG(q85)
   변환 → Vercel Blob `social/<slug>.jpg`에 public 업로드 → 그 URL. OG 실패 시 썸네일 원본
   `.jpg`(`/images/service3.jpg` 등)로 폴백.
4. Instagram: `POST graph.instagram.com/v23.0/{ig_user_id}/media`(image_url, caption) →
   status_code 폴링 FINISHED → `media_publish`.
5. Threads: `POST graph.threads.net/v1.0/{user_id}/threads`(media_type IMAGE, image_url,
   text) → 30초 대기 → `threads_publish`. 텍스트에 URL을 넣어 링크가 걸리게 한다.
6. 원장에 기록.

캡션: 제목 + 요약 + 해시태그(태그를 `#` + 공백 제거, 최대 8개). IG는 링크를 못 걸므로
"링크는 프로필에" 문구, Threads는 URL을 본문 끝에 포함하고 500자 안에서 자른다.

## 오류 처리

- API 에러는 `{code, message, error_subcode}`를 그대로 출력하고 exit 1.
- IG 컨테이너 ERROR/EXPIRED면 발행하지 않는다.
- 한 플랫폼 실패가 다른 플랫폼 성공을 되돌리지 않는다. 성공한 쪽은 원장에 남긴다.
- 토큰 만료(190 계열)는 `auth.mjs --refresh` 안내를 낸다.

## 검사

- `compose.test.ts`: 해시태그 정규화, 500자 절단(URL 보존), 이미지 폴백 규칙.
- `--dry-run`: 캡션·이미지 URL·호출 계획을 출력만 한다.
- 첫 실제 발행은 운영자가 직접 실행한다.

## 2·3차 (같은 날 구현, 실측 기반으로 계획 수정)

- `inbox.mjs`: IG 댓글·Threads 답글 중 미답 항목 나열, `--reply`로 답글. IG DM은 웹훅 없이
  `/me/conversations` 폴링으로 되므로 별도 엔드포인트·앱 심사가 필요 없었다(계획 변경).
  단 `instagram_business_manage_messages` scope 재승인과 모바일 앱의 "메시지 액세스 허용"
  토글이 필요하다. Threads는 DM API 없음. 자동 답글은 하지 않는다.
- `insights.mjs`: 최근 7일 계정 지표를 `docs/social/insights.csv`에 적재.

## 토큰 수명 (2026-09-09 추가)

두 API 모두 영구 토큰이 없다. 60일 장기 토큰을 `refresh_access_token`으로 무제한 연장하되,
**만료 후에는 연장 불가**라 갱신 누락이 유일한 실패 모드다. 그래서 만료 시각을
`.env.local`(`*_TOKEN_EXPIRES_AT`)에 기록하고 두 겹으로 갱신한다 — CLI 실행 시
`ensureFreshToken`(잔여 21일 이내), 그리고 주간 launchd 작업. 임계 21일은 주간 실행을
두어 번 걸러도 60일 창을 못 넘기게 잡은 값이다.
