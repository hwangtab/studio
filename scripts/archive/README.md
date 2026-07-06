# scripts/archive — 실행 금지 (일회성 이력 보관)

**⛔ 이 디렉토리의 스크립트를 실행하지 마세요. AI 에이전트 포함.**

여기 있는 35개 스크립트는 과거 특정 시점의 콘텐츠 일괄 수정·생성 배치(코드모드)로,
실행이 완료된 뒤 이력 참조용으로만 보관 중입니다. 다음 이유로 재실행이 위험합니다:

1. **폐기된 사실이 하드코딩되어 있습니다.** 예: `fix-all-wordcount.js`에는 현재
   미제공 서비스인 '보컬 레슨' 보일러플레이트가 들어 있어, 재실행 시 2026-06에
   4개 배치 커밋으로 정리한 허위 콘텐츠가 재주입됩니다.
2. **dry-run 없이 `content/stories/` 원본을 즉시 덮어씁니다.**
3. **당시 콘텐츠 구조를 전제**하므로 현재 코퍼스에 돌리면 예측 불가한 변형이 생깁니다.

콘텐츠 품질·사실 검증이 필요하면 현행 도구를 쓰세요:

- `npm run content-check:ci` — 형식 품질 (scripts/content-quality-check.js)
- `npm run audit:thin:ci` — thin/색인 정합 (scripts/audit-thin-content.js)
- `npx jest content/factGuards.test.ts` — 정본 사실 가드 (lib/factGuards.ts)

새 일괄 수정이 필요하면 스크립트를 새로 작성하되, 정본 사실은
`docs/wiki/entities/services.md`와 `lib/factGuards.ts`를 따르고
실행 후 이 디렉토리로 옮기세요.
