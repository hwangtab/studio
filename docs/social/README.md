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
- 토큰은 60일. 만료 전 `--refresh`. 만료됐으면 `auth.mjs --platform ig`가 출력하는 URL로
  승인 후 돌아온 `?code=`를 `--code`로 넘긴다(Meta는 HTTPS redirect만 받아 로컬 서버를 안 쓴다).
- Instagram은 JPEG만 받으므로 OG 카드를 sharp로 변환해 Vercel Blob에 올린다.

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
