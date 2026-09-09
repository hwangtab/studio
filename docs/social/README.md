# 소셜 발행 (Instagram · Threads)

스토리 한 편을 Instagram 피드와 Threads에 CLI로 올린다. 설계는
`docs/superpowers/specs/2026-09-08-social-api-design.md`.

```bash
node --env-file=.env.local scripts/social/post.mjs --slug ableton1 --dry-run   # 캡션·이미지 확인
node --env-file=.env.local scripts/social/post.mjs --slug ableton1             # 실제 발행 (ig,threads)
node --env-file=.env.local scripts/social/post.mjs --slug ableton1 --to threads
node --env-file=.env.local scripts/social/auth.mjs --refresh                   # 60일 토큰 연장
```

- `posted.json`은 발행 원장이다. 같은 글은 `--force` 없이는 다시 올라가지 않는다.
- Instagram은 JPEG만 받으므로 OG 카드를 sharp로 변환해 Vercel Blob에 올린다.

## 토큰 — 영구 토큰은 없다

Instagram Login·Threads 어느 쪽도 만료 없는 토큰을 주지 않는다(2026-09-09 문서·실측 확인).
장기 토큰 60일을 `refresh_access_token`으로 **무제한** 연장할 수 있을 뿐이고, 한 번 만료되면
연장이 불가능해 브라우저 재승인 말고는 방법이 없다. 그래서 "영원히 쓰기"의 실제 구현은
**갱신을 빠뜨리지 않는 것**이고, 두 겹으로 막는다.

1. **CLI 실행 시 자동 갱신** — `post`·`inbox`·`insights` 중 무엇을 돌리든 만료가 21일 이내면
   먼저 갱신한다(`meta.mjs`의 `ensureFreshToken`). 실패해도 본 작업은 계속한다.
2. **주간 launchd 작업** — CLI를 몇 달 안 써도 살아 있게 한다.

```bash
bash scripts/social/refresh-token.sh --install     # 매주 월 10:00 등록 (설치 1회)
bash scripts/social/refresh-token.sh               # 지금 한 번 갱신
bash scripts/social/refresh-token.sh --uninstall
node --env-file=.env.local scripts/social/auth.mjs --status   # 남은 일수
tail ~/Library/Logs/studionol-social-refresh.log              # 주간 작업 로그
```

만료 시각은 `.env.local`의 `*_TOKEN_EXPIRES_AT`에 기록된다. 갱신은 발급 24시간 뒤부터 된다.

> 인터넷에 도는 "만료 없는 인스타 토큰"은 **페이스북 페이지 액세스 토큰** 이야기다.
> 페이스북 로그인 기반 Instagram Graph API에서 페이지를 연결했을 때만 해당하고, 지금 쓰는
> Instagram Login 방식에는 적용되지 않는다. Threads에는 그런 경로가 아예 없어서 어느 쪽이든
> 갱신 장치는 있어야 한다.

## 반응 확인·답하기 (`inbox.mjs`)

```bash
node --env-file=.env.local scripts/social/inbox.mjs                       # 미답 IG 댓글·Threads 답글
node --env-file=.env.local scripts/social/inbox.mjs --all                 # 답한 것 포함
node --env-file=.env.local scripts/social/inbox.mjs --reply threads:<id> --text "…"
node --env-file=.env.local scripts/social/inbox.mjs --dm                  # IG 대화 목록
node --env-file=.env.local scripts/social/inbox.mjs --dm-send <igsid> --text "…"
```

- 자동 답글은 없다. 전송은 `--reply`·`--dm-send`를 쓴 때만.
- Threads는 DM API가 없다. IG DM은 상대가 먼저 보낸 뒤 24시간 안에만 답할 수 있다.
- **IG DM이 "대화 없음"으로 나오면** 인스타 **모바일 앱**에서 프로필 → 메뉴 → 메시지 및 스토리
  답장 → 메시지 요청 → 연결된 도구 → "메시지 액세스 허용"을 켜야 한다. 웹에는 이 토글이 없다
  (2026-09-08 실측).
- Threads "답함" 판정은 내 답글 목록(`/me/replies`)의 `replied_to`로 한다. 답글 객체의
  `children`은 비어 온다.

## 성과 적재 (`insights.mjs`)

```bash
node --env-file=.env.local scripts/social/insights.mjs          # 최근 7일 → docs/social/insights.csv 한 줄
node --env-file=.env.local scripts/social/insights.mjs --print  # 출력만
```

집계 수치만 담으므로 커밋해도 된다. 주 1회 실행을 권한다.
