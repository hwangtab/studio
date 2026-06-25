---
name: wiki-query
description: "Studio NOL 운영 지식 위키(docs/wiki/)에 질문해 출처 인용 답변을 받고, 가치 있는 발견을 위키로 환류할 때 사용. 사용자가 '위키에 물어봐', 'wiki query', '위키에서 찾아줘', '운영 지식 위키 기준으로 답해줘'를 언급하면 사용."
metadata:
  version: 1.0.0
---

# wiki-query — 운영 지식 위키 질의 + 환류

Karpathy LLM Wiki 패턴의 query 동작. 위키에서 답을 합성하고, 새 발견을 위키로 되돌린다.

## 시작 전 필수
1. `docs/wiki/WIKI.md`를 읽는다.
2. `docs/wiki/index.md`를 읽어 어떤 페이지가 있는지 파악한다.

## 절차
1. **검색**: index.md → 관련 페이지를 읽는다. 위키로 부족하면 페이지의 `sources` raw까지 추적한다.
2. **답변 합성**: 결론을 먼저, 그 뒤 근거. 사용한 **wiki 페이지와 raw를 모두 인용**한다.
   위키에 근거가 없으면 "위키 미수록"이라고 명시하고 추정과 사실을 구분한다.
3. **환류 판단**: 답변 과정에서 나온, 재사용 가치가 있는 새 사실/결론이 있으면
   적절한 페이지에 반영(WIKI.md organization·포맷 준수)하거나 신설한다.
   - 민감 사실은 `~/.claude` 메모리·`CLAUDE.md` 우선, 충돌 시 표시.
4. **index/log 갱신**: 환류가 있었으면 `index.md` 갱신, `log.md`에
   `## YYYY-MM-DD · query · <질문 요지>` + 환류한 페이지 불릿 추가. 환류 없으면 log만 선택적.

## 하지 말 것
- 출처 없는 단정, raw 수정, 위키에 없는 내용을 위키 근거인 것처럼 제시.
