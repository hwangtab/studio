# 스토리 근접중복 전수 스캔 — 2026-07

> **분석 전용 산출물.** 이 스캔은 콘텐츠 파일·리다이렉트 맵을 일절 수정하지 않았다.
> 배경·정책: [p1-followups-2026-07.md](p1-followups-2026-07.md) §1-5 (통합 시 GSC 강자를 canonical로, 약자를 308).
> 전체 페어 데이터(지역·noindex 포함 81건): [near-duplicate-scan-2026-07.csv](near-duplicate-scan-2026-07.csv)

## 방법론

ko 원본 스토리 1580편 중 `lib/regionRedirectMap.json`에 이미 등재된(=308 처리 완료) 489편을 제외한 **1091편**을 전수 비교했다. 본문에서 프론트매터, AUTO-EXPAND-V1 보일러플레이트 블록(`lib/storyContentPolicy.ts`와 동일 마커), 저자 박스 템플릿("## Studio NOL이 …" 섹션 전체), 하단 관련글 링크 목록, 마크다운 문법(이미지·링크 URL·헤딩 기호·표 구분선·강조 기호)을 제거하고 공백을 정규화한 뒤, **문자 5-gram shingle 집합의 정확 Jaccard 유사도**를 계산했다(크기 비율 하드 바운드 + bottom-128 스케치 프리필터(추정 J ≥ 0.25, 0.45 기준 대비 ≈4.5σ 여유) 후 후보만 정렬 병합으로 정확 계산 — 등재 페어의 값은 전부 정확값). 타이틀 유사도는 정규화 후 토큰 Jaccard. 색인 가능성은 `robots` noindex 프론트매터 + thin-content 게이트(`lib/storyContentPolicy.ts` `computeThinContentStatus` 재현: AUTO-EXPAND 분리 후 1,500자 임계·쇼트코드 보너스·광역 허브 예외)로 판정했고 — `pages/[locale]/stories/[id].tsx`의 ko noindex 조건과 동일 — 지역 카테고리·허브 여부는 `lib/stories.ts` `isListableStory`·`regionHubSlugs.json`과 동일 기준이다. GSC 성과는 `docs/gsc-audit-output.csv`(90일 창) slug 매칭. canonical 권고는 impressions → clicks → content_len 순 우위.

## 규모·소요 시간

- 비교 페어: 594,595건 → 크기 필터 통과 568,863건 → 스케치 통과 1,826건 → **J ≥ 0.45 등재 81건**
- GSC 매칭: 대상 1091편 중 1075편이 CSV에 존재
- 소요 시간: **1.8s** (전처리 1.1s + 페어 스캔 0.7s)

## 임계값별 페어 수 (본문 Jaccard, 누적)

| 임계 | 전체 페어 | 양측 색인 가능 | 그중 비지역(본 표 대상) |
|---|---|---|---|
| ≥ 0.45 | 81 | 75 | 41 |
| ≥ 0.50 | 13 | 12 | 1 |
| ≥ 0.55 | 5 | 4 | 1 |
| ≥ 0.60 | 2 | 2 | 0 |
| ≥ 0.65 | 0 | 0 | 0 |
| ≥ 0.70 | 0 | 0 | 0 |
| ≥ 0.75 | 0 | 0 | 0 |
| ≥ 0.80 | 0 | 0 | 0 |
| ≥ 0.85 | 0 | 0 | 0 |
| ≥ 0.90 | 0 | 0 | 0 |
| ≥ 0.95 | 0 | 0 | 0 |

## 실행 대상 — 양측 모두 색인 가능한 페어 (75건)

양측 모두 robots noindex가 아니고 thin-content 게이트에도 걸리지 않는, 즉 **둘 다 실제로 색인되는** 페어. 이 중 지역 카테고리 페어 34건은 지역 정책 트랙(§1-6·역세권 pSEO)에서 다룰 사안이라 아래 "지역·noindex" 절에 건수·요약으로 분리했고, **비지역 41건**이 페어 단위 통합(강자 canonical + 약자 308) 검토의 실질 대상이다.

### 클러스터 요약 (연결 요소 기준 13개)

페어 수가 많은 것은 개별 사건이 아니라 템플릿 계열 내 조합 폭발(C(n,2)) 때문이다 — 의사결정 단위는 페어가 아니라 클러스터로 보는 것이 맞다.

| 클러스터 | 문서 수 | 페어 수 | J 범위 | 구성원 |
|---|---|---|---|---|
| `practice-room-guitar-*` | 9 | 15 | 0.45–0.47 | `practice-room-guitar-fingering1`, `practice-room-guitar-left-hand1`, `practice-room-guitar-memory1`, `practice-room-guitar-mute1`, `practice-room-guitar-pinch-harmonic1`, `practice-room-guitar-riff1`, `practice-room-guitar-scale-pos1`, `practice-room-guitar-stretch1` 외 1편 |
| `practice-room-piano-*` | 5 | 5 | 0.45–0.48 | `practice-room-piano-beginner-adult1`, `practice-room-piano-chromatic1`, `practice-room-piano-concerto1`, `practice-room-piano-duet1`, `practice-room-piano-four-hands1` |
| `practice-room-guitar-*` | 4 | 5 | 0.47–0.49 | `practice-room-guitar-acoustic-fingerpick1`, `practice-room-guitar-fingerpick-pattern1`, `practice-room-guitar-fingerstyle-adv1`, `practice-room-guitar-fingerstyle21` |
| `practice-room-guitar-*` | 4 | 5 | 0.45–0.48 | `practice-room-guitar-picking-adv1`, `practice-room-guitar-picking1`, `practice-room-guitar-sweep-picking1`, `practice-room-guitar-sweep1` |
| `practice-room-drum-*` | 3 | 3 | 0.46–0.47 | `practice-room-drum-metronome1`, `practice-room-drum-tempo1`, `practice-room-drum-timing1` |
| `practice-room-guitar-*` | 2 | 1 | 0.59–0.59 | `practice-room-guitar-finger-vibrato1`, `practice-room-guitar-vibrato1` |
| `practice-room-drum-*` | 2 | 1 | 0.46–0.46 | `practice-room-drum-funk1`, `practice-room-drum-hiphop1` |
| `practice-room-piano-*` | 2 | 1 | 0.46–0.46 | `practice-room-piano-baroque1`, `practice-room-piano-sight-play1` |
| `practice-room-piano-jazz*` | 2 | 1 | 0.45–0.45 | `practice-room-piano-jazz-improv1`, `practice-room-piano-jazz1` |
| `practice-room-drum-jazz*` | 2 | 1 | 0.45–0.45 | `practice-room-drum-jazz-ride1`, `practice-room-drum-jazz1` |
| `practice-room-drum-rimshot*` | 2 | 1 | 0.45–0.45 | `practice-room-drum-rimshot-adv1`, `practice-room-drum-rimshot1` |
| `practice-room-guitar-blues*` | 2 | 1 | 0.45–0.45 | `practice-room-guitar-blues-scale1`, `practice-room-guitar-blues1` |
| `practice-room-vocal-*` | 2 | 1 | 0.45–0.45 | `practice-room-vocal-emotion1`, `practice-room-vocal-range1` |

### 전체 페어 표 (41건, 유사도 내림차순)

GSC 컬럼은 `클릭 / 노출 / tier`.

| # | slug A | slug B | body J | title sim | GSC A | GSC B | 권고 canonical |
|---|---|---|---|---|---|---|---|
| 1 | `practice-room-guitar-finger-vibrato1` | `practice-room-guitar-vibrato1` | 0.594 | 0.15 | 1 / 54 / KEEP | 1 / 37 / KEEP | `practice-room-guitar-finger-vibrato1` |
| 2 | `practice-room-guitar-fingerstyle-adv1` | `practice-room-guitar-fingerstyle21` | 0.489 | 0.23 | 1 / 18 / KEEP | 0 / 19 / WATCH | `practice-room-guitar-fingerstyle21` |
| 3 | `practice-room-guitar-sweep-picking1` | `practice-room-guitar-sweep1` | 0.484 | 0.45 | 1 / 53 / KEEP | 1 / 51 / KEEP | `practice-room-guitar-sweep-picking1` |
| 4 | `practice-room-piano-duet1` | `practice-room-piano-four-hands1` | 0.483 | 0.30 | 0 / 4 / WATCH_LOW | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-duet1` |
| 5 | `practice-room-guitar-fingerpick-pattern1` | `practice-room-guitar-fingerstyle-adv1` | 0.481 | 0.33 | 0 / 8 / WATCH_LOW | 1 / 18 / KEEP | `practice-room-guitar-fingerstyle-adv1` |
| 6 | `practice-room-guitar-picking-adv1` | `practice-room-guitar-sweep1` | 0.476 | 0.45 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 51 / KEEP | `practice-room-guitar-sweep1` |
| 7 | `practice-room-guitar-picking-adv1` | `practice-room-guitar-sweep-picking1` | 0.474 | 0.40 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 53 / KEEP | `practice-room-guitar-sweep-picking1` |
| 8 | `practice-room-drum-tempo1` | `practice-room-drum-timing1` | 0.473 | 0.40 | 0 / 14 / WATCH | 1 / 9 / KEEP | `practice-room-drum-tempo1` |
| 9 | `practice-room-guitar-acoustic-fingerpick1` | `practice-room-guitar-fingerstyle21` | 0.469 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 19 / WATCH | `practice-room-guitar-fingerstyle21` |
| 10 | `practice-room-guitar-acoustic-fingerpick1` | `practice-room-guitar-fingerpick-pattern1` | 0.469 | 0.33 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 8 / WATCH_LOW | `practice-room-guitar-fingerpick-pattern1` |
| 11 | `practice-room-guitar-acoustic-fingerpick1` | `practice-room-guitar-fingerstyle-adv1` | 0.468 | 0.33 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 18 / KEEP | `practice-room-guitar-fingerstyle-adv1` |
| 12 | `practice-room-drum-metronome1` | `practice-room-drum-tempo1` | 0.468 | 0.13 | 0 / 29 / WATCH | 0 / 14 / WATCH | `practice-room-drum-metronome1` |
| 13 | `practice-room-guitar-fingering1` | `practice-room-guitar-left-hand1` | 0.467 | 0.31 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 18 / KEEP | `practice-room-guitar-left-hand1` |
| 14 | `practice-room-piano-concerto1` | `practice-room-piano-four-hands1` | 0.465 | 0.30 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-concerto1` |
| 15 | `practice-room-drum-metronome1` | `practice-room-drum-timing1` | 0.464 | 0.38 | 0 / 29 / WATCH | 1 / 9 / KEEP | `practice-room-drum-metronome1` |
| 16 | `practice-room-drum-funk1` | `practice-room-drum-hiphop1` | 0.463 | 0.13 | 0 / 18 / WATCH | 2 / 47 / KEEP | `practice-room-drum-hiphop1` |
| 17 | `practice-room-guitar-left-hand1` | `practice-room-guitar-stretch1` | 0.461 | 0.27 | 1 / 18 / KEEP | 2 / 60 / KEEP | `practice-room-guitar-stretch1` |
| 18 | `practice-room-guitar-picking-adv1` | `practice-room-guitar-picking1` | 0.460 | 0.36 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-picking1` |
| 19 | `practice-room-guitar-memory1` | `practice-room-guitar-strumming1` | 0.459 | 0.23 | 1 / 16 / KEEP | 1 / 33 / KEEP | `practice-room-guitar-strumming1` |
| 20 | `practice-room-piano-chromatic1` | `practice-room-piano-four-hands1` | 0.458 | 0.30 | 1 / 28 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-chromatic1` |
| 21 | `practice-room-guitar-fingering1` | `practice-room-guitar-strumming1` | 0.458 | 0.27 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 33 / KEEP | `practice-room-guitar-strumming1` |
| 22 | `practice-room-piano-baroque1` | `practice-room-piano-sight-play1` | 0.457 | 0.33 | 0 / 11 / WATCH | 1 / 66 / KEEP | `practice-room-piano-sight-play1` |
| 23 | `practice-room-guitar-pinch-harmonic1` | `practice-room-guitar-strumming1` | 0.456 | 0.27 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 33 / KEEP | `practice-room-guitar-strumming1` |
| 24 | `practice-room-guitar-memory1` | `practice-room-guitar-pinch-harmonic1` | 0.456 | 0.23 | 1 / 16 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-memory1` |
| 25 | `practice-room-guitar-fingering1` | `practice-room-guitar-memory1` | 0.455 | 0.23 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 16 / KEEP | `practice-room-guitar-memory1` |
| 26 | `practice-room-guitar-mute1` | `practice-room-guitar-pinch-harmonic1` | 0.455 | 0.07 | 0 / 32 / WATCH | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-mute1` |
| 27 | `practice-room-guitar-memory1` | `practice-room-guitar-riff1` | 0.455 | 0.23 | 1 / 16 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-memory1` |
| 28 | `practice-room-piano-jazz-improv1` | `practice-room-piano-jazz1` | 0.455 | 0.63 | 1 / 20 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-jazz-improv1` |
| 29 | `practice-room-drum-jazz-ride1` | `practice-room-drum-jazz1` | 0.454 | 0.44 | 1 / 21 / KEEP | 2 / 45 / KEEP | `practice-room-drum-jazz1` |
| 30 | `practice-room-piano-chromatic1` | `practice-room-piano-concerto1` | 0.454 | 0.27 | 1 / 28 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-chromatic1` |
| 31 | `practice-room-drum-rimshot-adv1` | `practice-room-drum-rimshot1` | 0.454 | 0.15 | 1 / 58 / KEEP | 0 / 47 / WATCH | `practice-room-drum-rimshot-adv1` |
| 32 | `practice-room-guitar-blues-scale1` | `practice-room-guitar-blues1` | 0.453 | 0.31 | 2 / 100 / KEEP | 0 / 28 / WATCH | `practice-room-guitar-blues-scale1` |
| 33 | `practice-room-vocal-emotion1` | `practice-room-vocal-range1` | 0.453 | 0.00 | 1 / 41 / KEEP | 1 / 124 / KEEP | `practice-room-vocal-range1` |
| 34 | `practice-room-piano-beginner-adult1` | `practice-room-piano-chromatic1` | 0.452 | 0.25 | 1 / 20 / KEEP | 1 / 28 / KEEP | `practice-room-piano-chromatic1` |
| 35 | `practice-room-guitar-riff1` | `practice-room-guitar-strumming1` | 0.452 | 0.40 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 33 / KEEP | `practice-room-guitar-strumming1` |
| 36 | `practice-room-guitar-memory1` | `practice-room-guitar-scale-pos1` | 0.451 | 0.07 | 1 / 16 / KEEP | 1 / 22 / KEEP | `practice-room-guitar-scale-pos1` |
| 37 | `practice-room-guitar-left-hand1` | `practice-room-guitar-memory1` | 0.451 | 0.06 | 1 / 18 / KEEP | 1 / 16 / KEEP | `practice-room-guitar-left-hand1` |
| 38 | `practice-room-guitar-pinch-harmonic1` | `practice-room-guitar-riff1` | 0.451 | 0.27 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-pinch-harmonic1` |
| 39 | `practice-room-guitar-picking1` | `practice-room-guitar-sweep1` | 0.451 | 0.42 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 51 / KEEP | `practice-room-guitar-sweep1` |
| 40 | `practice-room-guitar-fingering1` | `practice-room-guitar-stretch1` | 0.451 | 0.23 | 0 / 0 / NOINDEX_CANDIDATE | 2 / 60 / KEEP | `practice-room-guitar-stretch1` |
| 41 | `practice-room-guitar-fingering1` | `practice-room-guitar-pinch-harmonic1` | 0.450 | 0.27 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-pinch-harmonic1` |

## cover 계열 판정 (명시 확인)

p1-followups §1-5에서 미해결로 남긴 cover 계열(`cover*` slug 6편: `cover-monetize1`, `cover-song1`, `cover1`, `coverart1`, `coverrecording1`, `coverright1`)의 전 페어 정확 Jaccard:

| slug A | slug B | body J | title sim | J≥0.45 |
|---|---|---|---|---|
| `cover-song1` | `coverrecording1` | 0.113 | 0.29 | 미달 |
| `cover1` | `coverrecording1` | 0.090 | 0.20 | 미달 |
| `cover-song1` | `cover1` | 0.064 | 0.43 | 미달 |
| `cover-monetize1` | `coverrecording1` | 0.043 | 0.00 | 미달 |
| `cover-monetize1` | `coverright1` | 0.037 | 0.10 | 미달 |
| `coverrecording1` | `coverright1` | 0.034 | 0.05 | 미달 |
| `cover-monetize1` | `cover1` | 0.034 | 0.05 | 미달 |
| `cover-monetize1` | `cover-song1` | 0.034 | 0.05 | 미달 |
| `cover-song1` | `coverright1` | 0.033 | 0.10 | 미달 |
| `cover1` | `coverright1` | 0.030 | 0.16 | 미달 |
| `cover-song1` | `coverart1` | 0.023 | 0.17 | 미달 |
| `coverart1` | `coverrecording1` | 0.020 | 0.19 | 미달 |
| `cover1` | `coverart1` | 0.018 | 0.11 | 미달 |
| `cover-monetize1` | `coverart1` | 0.017 | 0.10 | 미달 |
| `coverart1` | `coverright1` | 0.014 | 0.10 | 미달 |

**판정: cover 계열에 본문 수준 근접중복 페어는 없다.** 최고가 `cover-song1`/`coverrecording1` J=0.113로 임계(0.45)에 크게 못 미친다. `cover1`/`coverrecording1`(J=0.090)은 기처리 선례 `album-art1`/`album-artwork1`(J=0.071)과 같은 유형 — **본문은 별개로 작성됐지만 같은 주제를 겨냥한 '주제 변형'**이다. 이런 유형은 본문 Jaccard가 아니라 타이틀·타깃 쿼리 수준(카니벌라이제이션) 분석 대상이며, 통합 여부는 GSC 쿼리 중복 확인 후 별도 판단해야 한다(본 스캔 범위 밖 — titleSim 컬럼이 1차 단서).

## 지역·noindex 관련 페어 — 건수만

- **양측 색인 가능한 지역 카테고리 페어: 34건** (클러스터 3개: 11편 — `practice-room-dokbawi1`, `practice-room-eungam1`, `practice-room-gupabal1`, `practice-room-gusan1` 외 7편 / 2편 — `practice-room-hapjeong1`, `practice-room-mangwon1` / 2편 — `jeonbuk1`, `jeonnam1`) — 역/동네 치환 템플릿으로 현재 색인되고 있어 지역 pSEO 정책 트랙에서 별도 검토 필요. 상세는 CSV 참조.
  - 그중 **광역 허브 관여 페어 1건** — 허브는 정보 구조상 유지 대상이라 308 통합 불가, 본문 차별화가 유일한 처방:

| slug A | slug B | body J | GSC A | GSC B |
|---|---|---|---|---|
| `jeonbuk1` | `jeonnam1` | 0.452 | 0 / 14 / WATCH | 1 / 5 / KEEP |
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

*생성: `scripts/scan-near-duplicates.mjs` (2026-08-25, 분석 전용 — 콘텐츠 비수정)*
