---
name: wiki-ingest
description: "Studio NOL 운영 지식 위키(docs/wiki/)에 새 raw 자료를 한 건씩 흡수(ingest)할 때 사용. 사용자가 'wiki에 흡수', '위키에 정리해줘', 'ingest', '이 자료 위키에 넣어줘', 'docs/wiki 갱신'을 언급하거나 docs/ 자료를 주며 위키화를 요청하면 사용."
metadata:
  version: 1.0.0
---

# wiki-ingest — 운영 지식 위키 흡수

Karpathy LLM Wiki 패턴의 ingest 동작. raw 자료에서 핵심을 추출해 `docs/wiki/` 위키로 합성한다.

## 시작 전 필수
1. `docs/wiki/WIKI.md`를 읽는다. 아래 절차는 그 schema를 따른다.
2. raw 자료(`docs/` 하위)는 **읽기 전용**. 절대 수정하지 않는다.

## 절차 (한 번에 raw 1건)
1. **대상 확정**: 사용자가 준 경로(또는 "다음 미흡수 자료")의 raw 1건을 읽는다.
2. **takeaway 확인**: 핵심 3~6줄을 사용자에게 제시하고 위키화 방향을 짧게 합의한다.
3. **배치 결정**: WIKI.md organization에 따라 entities/concepts/decisions 중 어디에,
   기존 페이지 갱신인지 신설인지 정한다. (diagnosis 류는 decisions/)
4. **작성**:
   - 신설 시 frontmatter(`title`/`type`/`sources`/`updated`/`related`) 포함.
   - raw는 상대경로 링크(`../파일`), wiki는 `[[경로]]`로 인용. 주장에 출처를 단다.
   - 기존 내용과 **모순**되면 덮어쓰지 말고 `<!-- 확인 필요: ... -->`로 표시하고 사용자에게 알린다.
   - 민감 사실(서비스 범위·전화번호·엔티티 관계)은 `~/.claude` 메모리·`CLAUDE.md` 우선. 충돌 시 표시.
5. **frontmatter 갱신**: 영향 페이지의 `updated`(오늘 날짜)·`sources`·`related` 갱신.
6. **index/log 갱신**: `docs/wiki/index.md`에 신설 페이지 등록, `docs/wiki/log.md`에
   `## YYYY-MM-DD · ingest · <대상>` 항목과 영향 페이지 불릿 추가.
7. **요약 보고**: 무엇을 어디에 어떻게 반영했는지, 모순/확인필요 항목이 있으면 함께 보고.

## 하지 말 것
- raw 수정, 여러 자료 동시 흡수(혼선), 출처 없는 단정, 모순 자동 덮어쓰기.
