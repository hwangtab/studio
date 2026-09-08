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
