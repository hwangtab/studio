---
name: wiki-lint
description: "Studio NOL 운영 지식 위키(docs/wiki/)의 일관성을 점검(lint)할 때 사용. 사용자가 '위키 점검', 'wiki lint', '위키 건강검진', '위키 모순/끊긴 링크 확인', '고아 페이지 찾아줘'를 언급하면 사용."
metadata:
  version: 1.0.0
---

# wiki-lint — 운영 지식 위키 건강검진

Karpathy LLM Wiki 패턴의 lint 동작. **변경 없이 리포트만** 생성한다(수정은 사람 승인 후).

## 시작 전 필수
1. `docs/wiki/WIKI.md`를 읽는다.
2. `docs/wiki/` 전체(index.md, log.md, entities/concepts/decisions/*)를 훑는다.

## 점검 항목
1. **모순**: 서로 다른 페이지가 같은 사실을 다르게 주장.
2. **낡음(stale)**: `updated`가 오래됐거나, 더 최신 raw가 있는데 반영 안 됨.
3. **고아 페이지**: index.md에 미등록이거나, 어떤 페이지에서도 `[[...]]`로 링크되지 않음.
4. **끊긴 링크**: `[[wiki-link]]` 대상 페이지 부재, 또는 raw 상대경로가 실제 파일과 불일치.
5. **누락 상호참조**: 명백히 관련된 두 페이지가 서로 `related`/`[[...]]`로 연결 안 됨.
6. **포맷 위반**: frontmatter 필수 키 누락, organization 규칙 위반 배치.
7. **민감 사실 충돌**: 서비스 범위·전화번호·엔티티 관계가 메모리/CLAUDE.md와 불일치.

## 출력
- 항목별로 우선순위(높음/보통/낮음)와 위치(파일·페이지), 권장 조치를 표 또는 불릿으로 보고.
- `docs/wiki/log.md`에 `## YYYY-MM-DD · lint · 전체` + 발견 요약 불릿 추가.
- 사용자가 승인하면 그때 수정한다(승인 전 위키 변경 금지).
