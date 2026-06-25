---
title: GSC 검색 성과
type: entity
sources:
  - ../gsc-raw/page-all.csv
  - ../gsc-raw/page-query.csv
  - ../gsc-raw/quick-win.csv
  - ../gsc-raw/trend.csv
updated: 2026-06-25
related:
  - "[[concepts/seo-strategy]]"
  - "[[concepts/keyword-clusters]]"
  - "[[entities/channel-ga4]]"
---

# GSC 검색 성과

Google Search Console 데이터 해석. 원본 수치는 raw 파일([page-all.csv](../gsc-raw/page-all.csv), [page-query.csv](../gsc-raw/page-query.csv), [quick-win.csv](../gsc-raw/quick-win.csv), [trend.csv](../gsc-raw/trend.csv))을 직접 참조.

---

## 1. 전체 추세

2026-05-22 ~ 06-17 기간([trend.csv](../gsc-raw/trend.csv)):

- 일일 클릭: 78~141건 범위. 5월 말~6월 중순 우상향 추세 명확.
- 노출: 2,865(5월22일) → 5,320(6월16일). 노출량이 약 85% 증가한 반면 CTR은 2.3~3.3%로 안정적. 평균 순위는 6.4~7.1 밴드 유지.
- 시사점: 노출 확대 = 새 콘텐츠 색인 증가 신호. CTR은 고정돼 있어 메타 최적화로 클릭 추가 확보 가능성.

---

## 2. 상위 페이지

상위 10개([page-all.csv](../gsc-raw/page-all.csv)):

| 페이지 slug | 클릭 | 노출 | CTR | 순위 |
|------------|------|------|-----|------|
| /ko/practice-room | 133 | 2,981 | 4.46% | 6.9 |
| daw-choice1 | 132 | 2,786 | 4.74% | 6.9 |
| practice-room-startup1 | 92 | 1,639 | 5.61% | 5.1 |
| copyright-cover1 | 88 | 6,780 | 1.30% | 5.1 |
| song-key1 | 88 | 2,330 | 3.78% | 6.4 |
| revenue1 | 77 | 2,623 | 2.94% | 5.7 |
| loudness1 | 76 | 2,310 | 3.29% | 6.1 |
| producer1 | 76 | 1,882 | 4.04% | 5.5 |
| plugins1 | 75 | 1,407 | 5.33% | 6.8 |
| vocal-microphone1 | 65 | 2,703 | 2.40% | 6.6 |

주목 포인트:
- `/ko/practice-room` GSC 클릭 1위(133). 연습실이 검색·GA4 양쪽에서 핵심 페이지 확인.
- `copyright-cover1` 노출 6,780으로 최다인데 CTR 1.30% — 메타 리라이트로 CTR 개선 여지가 크다. [[decisions/seo-ctr-optimization]] 참조.
- `songstructure1` 노출 6,270 CTR 0.99% — 마찬가지로 낮은 CTR 이상치.
- `practice-room-transfer1` CTR 10.13%(클릭 54/노출 533) — 의도 매칭 정확도 높은 틈새 페이지.

---

## 3. 상위 쿼리

상위 전환 쿼리([page-query.csv](../gsc-raw/page-query.csv)):

| 쿼리 | 클릭 | 순위 | 연결 페이지 |
|------|------|------|-----------|
| 음악 프로듀서 되는 법 | 15 | 1.9 | producer1 |
| 프로듀서 되는법 | 12 | 2.7 | producer1 |
| 음악연습실 월세 | 9 | 3.3 | /ko/practice-room |
| 음악작업실 월세 | 9 | 5.1 | /ko/practice-room |
| 베이스 eq | 9 | 5.3 | bass-mixing1 |
| 고음 내는법 | 14 | 6.9 | highnote1 |
| 팔세토 | 13 | 4.8 | practice-room-vocal-falsetto-technique1 |
| 드럼 믹싱 | 7 | 5.7 | drum-mixing1 |
| 보컬 플러그인 추천 | 7 | 5.3 | plugins1 |
| 성우 녹음실 | 4 | 34.8 | /ko/voice-acting |

시사점:
- `producer1`이 순위 1.9~2.7로 전체에서 가장 높은 순위. 프로듀서 클러스터 효과.
- `음악연습실 월세` / `음악작업실 월세` — practice-room 페이지 순위 3~5위권. 네이버 서치 최우선 티어와 일치.
- `성우 녹음실` 순위 34.8 — 현재 voice-acting 페이지가 SEO 미흡. 개선 여지 최대.

---

## 4. Quick Win 목록

순위 10~15위 구간([quick-win.csv](../gsc-raw/quick-win.csv)):

- `noise-reduction1`: 순위 14.7, 2,194 노출, 38 클릭. 상위 페이지 진입 시 클릭 대폭 증가 가능.
- `voice-acting` 페이지: 순위 12.7, 294 노출, 17 클릭. 성우 녹음 페이지 콘텐츠 보강 필요.
- `condenser-mic1`: 순위 10.2, 819 노출. CTR 1.83% — 콘덴서 마이크 클러스터 강화 여지.
- `karaoke-vs-studio1`: 순위 11.6, 225 노출, CTR 4.0%.
- `home-vs-studio1`: 순위 10.9, 80 노출, CTR 3.75%.

전반적으로 10~15위 구간에 의미 있는 노출량 페이지들이 집중. 타이틀 최적화 및 내부링크 강화로 7~9위권 진입 시 클릭 2~3배 확보 가능.
