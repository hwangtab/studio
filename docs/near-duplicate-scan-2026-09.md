# 스토리 근접중복 전수 스캔 — 2026-09

> **분석 전용 산출물.** 이 스캔은 콘텐츠 파일·리다이렉트 맵을 일절 수정하지 않았다.
> 배경·정책: [p1-followups-2026-07.md](p1-followups-2026-07.md) §1-5 (통합 시 GSC 강자를 canonical로, 약자를 308).
> 전체 페어 데이터(지역·noindex 포함 31건): [near-duplicate-scan-2026-09.csv](near-duplicate-scan-2026-09.csv)

## 방법론

ko 원본 스토리 1581편 중 `lib/regionRedirectMap.json`에 이미 등재된(=308 처리 완료) 489편을 제외한 **1092편**을 전수 비교했다. 본문에서 프론트매터, AUTO-EXPAND-V1 보일러플레이트 블록(`lib/storyContentPolicy.ts`와 동일 마커), 저자 박스 템플릿("## Studio NOL이 …" 섹션 전체), 하단 관련글 링크 목록, 마크다운 문법(이미지·링크 URL·헤딩 기호·표 구분선·강조 기호)을 제거하고 공백을 정규화한 뒤, **문자 5-gram shingle 집합의 정확 Jaccard 유사도**를 계산했다(크기 비율 하드 바운드 + bottom-128 스케치 프리필터(추정 J ≥ 0.25, 0.45 기준 대비 ≈4.5σ 여유) 후 후보만 정렬 병합으로 정확 계산 — 등재 페어의 값은 전부 정확값). 타이틀 유사도는 정규화 후 토큰 Jaccard. 색인 가능성은 `robots` noindex 프론트매터 + thin-content 게이트(`lib/storyContentPolicy.ts` `computeThinContentStatus` 재현: AUTO-EXPAND 분리 후 1,500자 임계·쇼트코드 보너스·광역 허브 예외)로 판정했고 — `pages/[locale]/stories/[id].tsx`의 ko noindex 조건과 동일 — 지역 카테고리·허브 여부는 `lib/stories.ts` `isListableStory`·`regionHubSlugs.json`과 동일 기준이다. GSC 성과는 `docs/gsc-audit-output.csv`(90일 창) slug 매칭. canonical 권고는 impressions → clicks → content_len 순 우위.

## 규모·소요 시간

- 비교 페어: 595,686건 → 크기 필터 통과 521,911건 → 스케치 통과 247건 → **J ≥ 0.45 등재 31건**
- GSC 매칭: 대상 1092편 중 1075편이 CSV에 존재
- 소요 시간: **1.3s** (전처리 0.9s + 페어 스캔 0.4s)

## 임계값별 페어 수 (본문 Jaccard, 누적)

| 임계 | 전체 페어 | 양측 색인 가능 | 그중 비지역(본 표 대상) |
|---|---|---|---|
| ≥ 0.45 | 31 | 25 | 0 |
| ≥ 0.50 | 10 | 9 | 0 |
| ≥ 0.55 | 4 | 3 | 0 |
| ≥ 0.60 | 1 | 1 | 0 |
| ≥ 0.65 | 0 | 0 | 0 |
| ≥ 0.70 | 0 | 0 | 0 |
| ≥ 0.75 | 0 | 0 | 0 |
| ≥ 0.80 | 0 | 0 | 0 |
| ≥ 0.85 | 0 | 0 | 0 |
| ≥ 0.90 | 0 | 0 | 0 |
| ≥ 0.95 | 0 | 0 | 0 |

## 실행 대상 — 양측 모두 색인 가능한 페어 (25건)

양측 모두 robots noindex가 아니고 thin-content 게이트에도 걸리지 않는, 즉 **둘 다 실제로 색인되는** 페어. 이 중 지역 카테고리 페어 25건은 지역 정책 트랙(§1-6·역세권 pSEO)에서 다룰 사안이라 아래 "지역·noindex" 절에 건수·요약으로 분리했고, **비지역 0건**이 페어 단위 통합(강자 canonical + 약자 308) 검토의 실질 대상이다.

### 클러스터 요약 (연결 요소 기준 0개)

페어 수가 많은 것은 개별 사건이 아니라 템플릿 계열 내 조합 폭발(C(n,2)) 때문이다 — 의사결정 단위는 페어가 아니라 클러스터로 보는 것이 맞다.

| 클러스터 | 문서 수 | 페어 수 | J 범위 | 구성원 |
|---|---|---|---|---|
| (없음) | | | | |

### 전체 페어 표 (0건, 유사도 내림차순)

GSC 컬럼은 `클릭 / 노출 / tier`.

| # | slug A | slug B | body J | title sim | GSC A | GSC B | 권고 canonical |
|---|---|---|---|---|---|---|---|
| — | (해당 없음) | | | | | | |

## cover 계열 판정 (명시 확인)

p1-followups §1-5에서 미해결로 남긴 cover 계열(`cover*` slug 6편: `cover-monetize1`, `cover-song1`, `cover1`, `coverart1`, `coverrecording1`, `coverright1`)의 전 페어 정확 Jaccard:

| slug A | slug B | body J | title sim | J≥0.45 |
|---|---|---|---|---|
| `cover-song1` | `coverrecording1` | 0.113 | 0.29 | 미달 |
| `cover1` | `coverrecording1` | 0.090 | 0.20 | 미달 |
| `cover-song1` | `cover1` | 0.064 | 0.43 | 미달 |
| `cover-monetize1` | `coverrecording1` | 0.043 | 0.00 | 미달 |
| `cover-monetize1` | `coverright1` | 0.040 | 0.10 | 미달 |
| `cover-song1` | `coverright1` | 0.036 | 0.10 | 미달 |
| `coverrecording1` | `coverright1` | 0.036 | 0.05 | 미달 |
| `cover-monetize1` | `cover1` | 0.034 | 0.05 | 미달 |
| `cover-monetize1` | `cover-song1` | 0.034 | 0.05 | 미달 |
| `cover1` | `coverright1` | 0.031 | 0.16 | 미달 |
| `cover-song1` | `coverart1` | 0.023 | 0.17 | 미달 |
| `coverart1` | `coverrecording1` | 0.020 | 0.19 | 미달 |
| `cover1` | `coverart1` | 0.018 | 0.11 | 미달 |
| `cover-monetize1` | `coverart1` | 0.017 | 0.10 | 미달 |
| `coverart1` | `coverright1` | 0.015 | 0.10 | 미달 |

**판정: cover 계열에 본문 수준 근접중복 페어는 없다.** 최고가 `cover-song1`/`coverrecording1` J=0.113로 임계(0.45)에 크게 못 미친다. `cover1`/`coverrecording1`(J=0.090)은 기처리 선례 `album-art1`/`album-artwork1`(J=0.071)과 같은 유형 — **본문은 별개로 작성됐지만 같은 주제를 겨냥한 '주제 변형'**이다. 이런 유형은 본문 Jaccard가 아니라 타이틀·타깃 쿼리 수준(카니벌라이제이션) 분석 대상이며, 통합 여부는 GSC 쿼리 중복 확인 후 별도 판단해야 한다(본 스캔 범위 밖 — titleSim 컬럼이 1차 단서).

## 지역·noindex 관련 페어 — 건수만

- **양측 색인 가능한 지역 카테고리 페어: 25건** (클러스터 2개: 11편 — `practice-room-dokbawi1`, `practice-room-eungam1`, `practice-room-gupabal1`, `practice-room-gusan1` 외 7편 / 2편 — `practice-room-hapjeong1`, `practice-room-mangwon1`) — 역/동네 치환 템플릿으로 현재 색인되고 있어 지역 pSEO 정책 트랙에서 별도 검토 필요. 상세는 CSV 참조.
- 한쪽 이상 색인 불가(robots noindex 또는 thin)라 중복 콘텐츠 신호가 없는 페어: **지역 관련 6건 / 그 외 0건** — 통합 불요.

## Sanity check

| 페어 | body J | 판정 |
|---|---|---|
| `album-art1` / `album-artwork1` | 0.071 | redirect 맵 제외(album-art1) → 결과 부재 |
| `cover1` / `coverrecording1` | 0.090 | 스캔 대상, 임계 미달 |

- `album-art1`은 redirect 맵 등재로 스캔에서 제외되어 결과 CSV에 **없음** — 제외 로직 정상 (J는 진단용 out-of-band 계산값).
- `cover1`/`coverrecording1`은 스캔 대상에 포함되어 유사도가 계산됨(위 cover 절 판정 참조).

## 후속 — 통합 실행은 P1

**통합 실행은 P1 — 이 문서는 후보 목록일 뿐이다.** 실제 통합 시에는 페어별로 (1) 검색 의도가 정말 같은 주제 변형인지 수동 확인, (2) GSC 강자 canonical 유지 + 약자 `lib/regionRedirectMap.json` 308 등재, (3) 내부 링크(`internalLinks.ts`·본문 링크)를 canonical로 갱신해 308 홉을 방지한다(album-art1 선례 참조). 템플릿 클러스터(practice-room 계열)는 페어 단위 308이 아니라 클러스터 단위 전략(대표 페이지 통합 또는 본문 차별화) 판단이 선행돼야 한다.

---

*생성: `scripts/scan-near-duplicates.mjs` (2026-09-04, 분석 전용 — 콘텐츠 비수정)*
