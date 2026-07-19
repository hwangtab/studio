# 스토리 근접중복 전수 스캔 — 2026-07

> **분석 전용 산출물.** 이 스캔은 콘텐츠 파일·리다이렉트 맵을 일절 수정하지 않았다.
> 배경·정책: [p1-followups-2026-07.md](p1-followups-2026-07.md) §1-5 (통합 시 GSC 강자를 canonical로, 약자를 308).
> 전체 페어 데이터(지역·noindex 포함 603건): [near-duplicate-scan-2026-07.csv](near-duplicate-scan-2026-07.csv)

## 방법론

ko 원본 스토리 1572편 중 `lib/regionRedirectMap.json`에 이미 등재된(=308 처리 완료) 479편을 제외한 **1093편**을 전수 비교했다. 본문에서 프론트매터, AUTO-EXPAND-V1 보일러플레이트 블록(`lib/storyContentPolicy.ts`와 동일 마커), 저자 박스 템플릿("## Studio NOL이 …" 섹션 전체), 하단 관련글 링크 목록, 마크다운 문법(이미지·링크 URL·헤딩 기호·표 구분선·강조 기호)을 제거하고 공백을 정규화한 뒤, **문자 5-gram shingle 집합의 정확 Jaccard 유사도**를 계산했다(크기 비율 하드 바운드 + bottom-128 스케치 프리필터(추정 J ≥ 0.25, 0.45 기준 대비 ≈4.5σ 여유) 후 후보만 정렬 병합으로 정확 계산 — 등재 페어의 값은 전부 정확값). 타이틀 유사도는 정규화 후 토큰 Jaccard. 색인 가능성은 `robots` noindex 프론트매터 + thin-content 게이트(`lib/storyContentPolicy.ts` `computeThinContentStatus` 재현: AUTO-EXPAND 분리 후 1,500자 임계·쇼트코드 보너스·광역 허브 예외)로 판정했고 — `pages/[locale]/stories/[id].tsx`의 ko noindex 조건과 동일 — 지역 카테고리·허브 여부는 `lib/stories.ts` `isListableStory`·`regionHubSlugs.json`과 동일 기준이다. GSC 성과는 `docs/gsc-audit-output.csv`(90일 창) slug 매칭. canonical 권고는 impressions → clicks → content_len 순 우위.

## 규모·소요 시간

- 비교 페어: 596,778건 → 크기 필터 통과 565,989건 → 스케치 통과 3,117건 → **J ≥ 0.45 등재 603건**
- GSC 매칭: 대상 1093편 중 1083편이 CSV에 존재
- 소요 시간: **6.8s** (전처리 4.2s + 페어 스캔 2.3s)

## 임계값별 페어 수 (본문 Jaccard, 누적)

| 임계 | 전체 페어 | 양측 색인 가능 | 그중 비지역(본 표 대상) |
|---|---|---|---|
| ≥ 0.45 | 603 | 591 | 501 |
| ≥ 0.50 | 503 | 494 | 427 |
| ≥ 0.55 | 428 | 419 | 366 |
| ≥ 0.60 | 358 | 351 | 318 |
| ≥ 0.65 | 168 | 166 | 147 |
| ≥ 0.70 | 6 | 6 | 1 |
| ≥ 0.75 | 2 | 2 | 0 |
| ≥ 0.80 | 1 | 1 | 0 |
| ≥ 0.85 | 0 | 0 | 0 |
| ≥ 0.90 | 0 | 0 | 0 |
| ≥ 0.95 | 0 | 0 | 0 |

## 실행 대상 — 양측 모두 색인 가능한 페어 (591건)

양측 모두 robots noindex가 아니고 thin-content 게이트에도 걸리지 않는, 즉 **둘 다 실제로 색인되는** 페어. 이 중 지역 카테고리 페어 90건은 지역 정책 트랙(§1-6·역세권 pSEO)에서 다룰 사안이라 아래 "지역·noindex" 절에 건수·요약으로 분리했고, **비지역 501건**이 페어 단위 통합(강자 canonical + 약자 308) 검토의 실질 대상이다.

### 클러스터 요약 (연결 요소 기준 39개)

페어 수가 많은 것은 개별 사건이 아니라 템플릿 계열 내 조합 폭발(C(n,2)) 때문이다 — 의사결정 단위는 페어가 아니라 클러스터로 보는 것이 맞다.

| 클러스터 | 문서 수 | 페어 수 | J 범위 | 구성원 |
|---|---|---|---|---|
| `practice-room-*` | 17 | 136 | 0.51–0.69 | `practice-room-electric-guitar1`, `practice-room-guitar-arpeggio1`, `practice-room-guitar-fingering1`, `practice-room-guitar-hammer-pull1`, `practice-room-guitar-left-hand1`, `practice-room-guitar-memory1`, `practice-room-guitar-mute1`, `practice-room-guitar-pentatonic-modes1` 외 9편 |
| `practice-room-*` | 15 | 46 | 0.45–0.49 | `practice-room-certification1`, `practice-room-church1`, `practice-room-classical1`, `practice-room-content-creator1`, `practice-room-ear-training1`, `practice-room-genre-switch1`, `practice-room-housewife1`, `practice-room-journal1` 외 7편 |
| `practice-room-piano-*` | 13 | 78 | 0.58–0.69 | `practice-room-piano-beginner-adult1`, `practice-room-piano-chromatic1`, `practice-room-piano-concerto1`, `practice-room-piano-duet1`, `practice-room-piano-four-hands1`, `practice-room-piano-impressionism1`, `practice-room-piano-interval1`, `practice-room-piano-key-signature1` 외 5편 |
| `practice-room-vocal-*` | 10 | 42 | 0.45–0.63 | `practice-room-vocal-accent1`, `practice-room-vocal-classical1`, `practice-room-vocal-consonant1`, `practice-room-vocal-emotion1`, `practice-room-vocal-live1`, `practice-room-vocal-range1`, `practice-room-vocal-rasp1`, `practice-room-vocal-rhythm1` 외 2편 |
| `practice-room-piano-*` | 7 | 21 | 0.63–0.69 | `practice-room-piano-baroque1`, `practice-room-piano-polyphony1`, `practice-room-piano-romantic1`, `practice-room-piano-sight-adv1`, `practice-room-piano-sight-play1`, `practice-room-piano-sonata1`, `practice-room-piano-tremolo1` |
| `practice-room-*` | 7 | 20 | 0.50–0.69 | `practice-room-bass-detuning1`, `practice-room-bass-fingering1`, `practice-room-bass-octave1`, `practice-room-bass-root-adv1`, `practice-room-bass-root-fifth1`, `practice-room-bass-sustain1`, `practice-room-electric-bass1` |
| `practice-room-guitar-chord*` | 7 | 21 | 0.50–0.67 | `practice-room-guitar-chord-adv1`, `practice-room-guitar-chord-arpeggio1`, `practice-room-guitar-chord-change1`, `practice-room-guitar-chord-melody1`, `practice-room-guitar-chord-prog1`, `practice-room-guitar-chord1`, `practice-room-guitar-chord21` |
| `practice-room-piano-*` | 7 | 21 | 0.62–0.66 | `practice-room-piano-pedal1`, `practice-room-piano-scale-adv1`, `practice-room-piano-technique-adv1`, `practice-room-piano-technique21`, `practice-room-piano-technique31`, `practice-room-piano-touch1`, `practice-room-piano-trills1` |
| `practice-room-*` | 7 | 21 | 0.52–0.60 | `practice-room-arts-high1`, `practice-room-couple1`, `practice-room-family1`, `practice-room-indie1`, `practice-room-kids1`, `practice-room-music-portfolio1`, `practice-room-rappers1` |
| `practice-room-piano-*` | 6 | 15 | 0.61–0.65 | `practice-room-piano-chord-adv1`, `practice-room-piano-dynamics1`, `practice-room-piano-inner-voice1`, `practice-room-piano-leaps1`, `practice-room-piano-parallel1`, `practice-room-piano-rubato1` |
| `practice-room-drum-*` | 5 | 10 | 0.64–0.70 | `practice-room-drum-count1`, `practice-room-drum-metronome1`, `practice-room-drum-offbeat1`, `practice-room-drum-tempo1`, `practice-room-drum-timing1` |
| `practice-room-guitar-*` | 5 | 10 | 0.63–0.68 | `practice-room-guitar-acoustic-fingerpick1`, `practice-room-guitar-fingerpick-adv1`, `practice-room-guitar-fingerpick-pattern1`, `practice-room-guitar-fingerstyle-adv1`, `practice-room-guitar-fingerstyle21` |
| `practice-room-drum-*` | 5 | 10 | 0.50–0.64 | `practice-room-drum-accent1`, `practice-room-drum-cymbal1`, `practice-room-drum-snare-tuning1`, `practice-room-drum-snare1`, `practice-room-drum-speed1` |
| `practice-room-vocal-*` | 4 | 6 | 0.52–0.72 | `practice-room-vocal-mic1`, `practice-room-vocal-recording1`, `practice-room-vocal-warm-up1`, `practice-room-vocal-warmup1` |
| `practice-room-guitar-*` | 4 | 6 | 0.63–0.68 | `practice-room-guitar-picking-adv1`, `practice-room-guitar-picking1`, `practice-room-guitar-sweep-picking1`, `practice-room-guitar-sweep1` |
| `practice-room-piano-jazz*` | 4 | 6 | 0.51–0.67 | `practice-room-piano-jazz-chord1`, `practice-room-piano-jazz-improv1`, `practice-room-piano-jazz-standard1`, `practice-room-piano-jazz1` |
| `practice-room-drum-jazz*` | 3 | 3 | 0.64–0.66 | `practice-room-drum-jazz-adv1`, `practice-room-drum-jazz-ride1`, `practice-room-drum-jazz1` |
| `practice-room-drum-*` | 3 | 3 | 0.61–0.66 | `practice-room-drum-electronic1`, `practice-room-drum-rimshot-adv1`, `practice-room-drum-rimshot1` |
| `practice-room-vocal-*` | 3 | 3 | 0.48–0.60 | `practice-room-vocal-color-adv1`, `practice-room-vocal-intonation1`, `practice-room-vocal-solfege1` |
| `practice-room-vocal-*` | 3 | 3 | 0.47–0.53 | `practice-room-vocal-crooning1`, `practice-room-vocal-gospel1`, `practice-room-vocal-style1` |
| `practice-room-*` | 3 | 2 | 0.45–0.45 | `practice-room-chord-melody1`, `practice-room-composition1`, `practice-room-harmony1` |
| `practice-room-drum-*` | 2 | 1 | 0.68–0.68 | `practice-room-drum-funk1`, `practice-room-drum-hiphop1` |
| `practice-room-guitar-*` | 2 | 1 | 0.67–0.67 | `practice-room-guitar-finger-vibrato1`, `practice-room-guitar-vibrato1` |
| `practice-room-bass-*` | 2 | 1 | 0.67–0.67 | `practice-room-bass-country1`, `practice-room-bass-rock-groove1` |
| `practice-room-guitar-jazz-*` | 2 | 1 | 0.67–0.67 | `practice-room-guitar-jazz-chord1`, `practice-room-guitar-jazz-voicing1` |
| `practice-room-guitar-blues*` | 2 | 1 | 0.66–0.66 | `practice-room-guitar-blues-scale1`, `practice-room-guitar-blues1` |
| `practice-room-piano-*` | 2 | 1 | 0.64–0.64 | `practice-room-piano-chord-voicing1`, `practice-room-piano-voicing1` |
| `practice-room-guitar-*` | 2 | 1 | 0.62–0.62 | `practice-room-guitar-hybrid1`, `practice-room-guitar-legato1` |
| `practice-room-drum-*` | 2 | 1 | 0.62–0.62 | `practice-room-drum-country1`, `practice-room-drum-reggae1` |
| `practice-room-*` | 2 | 1 | 0.59–0.59 | `practice-room-oboe1`, `practice-room-wind1` |
| `practice-room-*` | 2 | 1 | 0.59–0.59 | `practice-room-pop-vocal1`, `practice-room-vocal-cover1` |
| `practice-room-guitar-*` | 2 | 1 | 0.56–0.56 | `practice-room-guitar-barre1`, `practice-room-guitar-capo1` |
| `practice-room-*` | 2 | 1 | 0.56–0.56 | `practice-room-competition1`, `practice-room-repertoire1` |
| `practice-room-vocal-musical*` | 2 | 1 | 0.53–0.53 | `practice-room-vocal-musical-style1`, `practice-room-vocal-musical1` |
| `practice-room-*` | 2 | 1 | 0.51–0.51 | `practice-room-cajon1`, `practice-room-percussion1` |
| `practice-room-vocal-breath*` | 2 | 1 | 0.50–0.50 | `practice-room-vocal-breath1`, `practice-room-vocal-breath21` |
| `practice-room-*` | 2 | 1 | 0.47–0.47 | `practice-room-demo1`, `practice-room-session1` |
| `practice-room-vocal-*` | 2 | 1 | 0.46–0.46 | `practice-room-vocal-mix1`, `practice-room-vocal-register1` |
| `practice-room-*` | 2 | 1 | 0.46–0.46 | `practice-room-habit1`, `practice-room-physical1` |

### 전체 페어 표 (501건, 유사도 내림차순)

GSC 컬럼은 `클릭 / 노출 / tier`.

| # | slug A | slug B | body J | title sim | GSC A | GSC B | 권고 canonical |
|---|---|---|---|---|---|---|---|
| 1 | `practice-room-vocal-warm-up1` | `practice-room-vocal-warmup1` | 0.715 | 0.25 | 0 / 62 / WATCH | 0 / 39 / WATCH | `practice-room-vocal-warm-up1` |
| 2 | `practice-room-drum-metronome1` | `practice-room-drum-timing1` | 0.697 | 0.38 | 0 / 29 / WATCH | 1 / 9 / KEEP | `practice-room-drum-metronome1` |
| 3 | `practice-room-piano-key-signature1` | `practice-room-piano-left-hand1` | 0.695 | 0.08 | 0 / 29 / WATCH | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-key-signature1` |
| 4 | `practice-room-piano-leadsheet1` | `practice-room-piano-left-hand1` | 0.694 | 0.33 | 1 / 19 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-leadsheet1` |
| 5 | `practice-room-piano-key-signature1` | `practice-room-piano-leadsheet1` | 0.693 | 0.08 | 0 / 29 / WATCH | 1 / 19 / KEEP | `practice-room-piano-key-signature1` |
| 6 | `practice-room-piano-sonata1` | `practice-room-piano-tremolo1` | 0.692 | 0.38 | 1 / 10 / KEEP | 4 / 127 / KEEP | `practice-room-piano-tremolo1` |
| 7 | `practice-room-guitar-fingering1` | `practice-room-guitar-memory1` | 0.688 | 0.23 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 16 / KEEP | `practice-room-guitar-memory1` |
| 8 | `practice-room-piano-interval1` | `practice-room-piano-key-signature1` | 0.686 | 0.06 | 1 / 36 / KEEP | 0 / 29 / WATCH | `practice-room-piano-interval1` |
| 9 | `practice-room-guitar-memory1` | `practice-room-guitar-strumming1` | 0.686 | 0.23 | 1 / 16 / KEEP | 1 / 33 / KEEP | `practice-room-guitar-strumming1` |
| 10 | `practice-room-piano-concerto1` | `practice-room-piano-left-hand1` | 0.685 | 0.30 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-concerto1` |
| 11 | `practice-room-piano-concerto1` | `practice-room-piano-key-signature1` | 0.685 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 29 / WATCH | `practice-room-piano-key-signature1` |
| 12 | `practice-room-piano-key-signature1` | `practice-room-piano-rhythm1` | 0.685 | 0.07 | 0 / 29 / WATCH | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-key-signature1` |
| 13 | `practice-room-bass-root-fifth1` | `practice-room-bass-sustain1` | 0.685 | 0.13 | 0 / 19 / WATCH | 0 / 26 / WATCH | `practice-room-bass-sustain1` |
| 14 | `practice-room-piano-concerto1` | `practice-room-piano-leadsheet1` | 0.685 | 0.44 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 19 / KEEP | `practice-room-piano-leadsheet1` |
| 15 | `practice-room-guitar-memory1` | `practice-room-guitar-pinch-harmonic1` | 0.684 | 0.23 | 1 / 16 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-memory1` |
| 16 | `practice-room-piano-romantic1` | `practice-room-piano-tremolo1` | 0.684 | 0.38 | 0 / 0 / NOINDEX_CANDIDATE | 4 / 127 / KEEP | `practice-room-piano-tremolo1` |
| 17 | `practice-room-drum-metronome1` | `practice-room-drum-tempo1` | 0.683 | 0.13 | 0 / 29 / WATCH | 0 / 14 / WATCH | `practice-room-drum-metronome1` |
| 18 | `practice-room-piano-left-hand1` | `practice-room-piano-rhythm1` | 0.682 | 0.30 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-left-hand1` |
| 19 | `practice-room-guitar-picking-adv1` | `practice-room-guitar-sweep-picking1` | 0.682 | 0.40 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 53 / KEEP | `practice-room-guitar-sweep-picking1` |
| 20 | `practice-room-piano-polyphony1` | `practice-room-piano-tremolo1` | 0.682 | 0.30 | 0 / 13 / WATCH | 4 / 127 / KEEP | `practice-room-piano-tremolo1` |
| 21 | `practice-room-piano-interval1` | `practice-room-piano-left-hand1` | 0.681 | 0.07 | 1 / 36 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-interval1` |
| 22 | `practice-room-bass-root-adv1` | `practice-room-bass-root-fifth1` | 0.679 | 0.12 | 0 / 33 / WATCH | 0 / 19 / WATCH | `practice-room-bass-root-adv1` |
| 23 | `practice-room-piano-baroque1` | `practice-room-piano-tremolo1` | 0.679 | 0.38 | 0 / 11 / WATCH | 4 / 127 / KEEP | `practice-room-piano-tremolo1` |
| 24 | `practice-room-drum-funk1` | `practice-room-drum-hiphop1` | 0.679 | 0.13 | 0 / 18 / WATCH | 2 / 47 / KEEP | `practice-room-drum-hiphop1` |
| 25 | `practice-room-piano-four-hands1` | `practice-room-piano-left-hand1` | 0.678 | 0.33 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-left-hand1` |
| 26 | `practice-room-guitar-fingerpick-pattern1` | `practice-room-guitar-fingerstyle-adv1` | 0.678 | 0.33 | 0 / 8 / WATCH_LOW | 1 / 18 / KEEP | `practice-room-guitar-fingerstyle-adv1` |
| 27 | `practice-room-piano-leadsheet1` | `practice-room-piano-rhythm1` | 0.678 | 0.30 | 1 / 19 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-leadsheet1` |
| 28 | `practice-room-piano-interval1` | `practice-room-piano-leadsheet1` | 0.677 | 0.07 | 1 / 36 / KEEP | 1 / 19 / KEEP | `practice-room-piano-interval1` |
| 29 | `practice-room-piano-four-hands1` | `practice-room-piano-key-signature1` | 0.677 | 0.08 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 29 / WATCH | `practice-room-piano-key-signature1` |
| 30 | `practice-room-piano-chromatic1` | `practice-room-piano-key-signature1` | 0.677 | 0.07 | 1 / 28 / KEEP | 0 / 29 / WATCH | `practice-room-piano-key-signature1` |
| 31 | `practice-room-piano-concerto1` | `practice-room-piano-four-hands1` | 0.677 | 0.30 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-concerto1` |
| 32 | `practice-room-piano-four-hands1` | `practice-room-piano-leadsheet1` | 0.675 | 0.33 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 19 / KEEP | `practice-room-piano-leadsheet1` |
| 33 | `practice-room-piano-baroque1` | `practice-room-piano-sonata1` | 0.675 | 0.33 | 0 / 11 / WATCH | 1 / 10 / KEEP | `practice-room-piano-baroque1` |
| 34 | `practice-room-guitar-memory1` | `practice-room-guitar-scale-position1` | 0.674 | 0.06 | 1 / 16 / KEEP | 0 / 20 / WATCH | `practice-room-guitar-scale-position1` |
| 35 | `practice-room-piano-chromatic1` | `practice-room-piano-left-hand1` | 0.674 | 0.30 | 1 / 28 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-chromatic1` |
| 36 | `practice-room-piano-impressionism1` | `practice-room-piano-key-signature1` | 0.674 | 0.08 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 29 / WATCH | `practice-room-piano-key-signature1` |
| 37 | `practice-room-bass-fingering1` | `practice-room-bass-sustain1` | 0.674 | 0.07 | 4 / 127 / KEEP | 0 / 26 / WATCH | `practice-room-bass-fingering1` |
| 38 | `practice-room-piano-key-signature1` | `practice-room-piano-modulation1` | 0.674 | 0.13 | 0 / 29 / WATCH | 1 / 30 / KEEP | `practice-room-piano-modulation1` |
| 39 | `practice-room-piano-impressionism1` | `practice-room-piano-left-hand1` | 0.674 | 0.33 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-impressionism1` |
| 40 | `practice-room-piano-impressionism1` | `practice-room-piano-leadsheet1` | 0.673 | 0.33 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 19 / KEEP | `practice-room-piano-leadsheet1` |
| 41 | `practice-room-guitar-memory1` | `practice-room-guitar-riff1` | 0.672 | 0.23 | 1 / 16 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-memory1` |
| 42 | `practice-room-piano-romantic1` | `practice-room-piano-sonata1` | 0.672 | 0.33 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 10 / KEEP | `practice-room-piano-sonata1` |
| 43 | `practice-room-guitar-finger-vibrato1` | `practice-room-guitar-vibrato1` | 0.672 | 0.15 | 1 / 54 / KEEP | 1 / 37 / KEEP | `practice-room-guitar-finger-vibrato1` |
| 44 | `practice-room-guitar-memory1` | `practice-room-guitar-stretch1` | 0.672 | 0.06 | 1 / 16 / KEEP | 2 / 60 / KEEP | `practice-room-guitar-stretch1` |
| 45 | `practice-room-guitar-arpeggio1` | `practice-room-guitar-memory1` | 0.671 | 0.23 | 1 / 86 / KEEP | 1 / 16 / KEEP | `practice-room-guitar-arpeggio1` |
| 46 | `practice-room-guitar-left-hand1` | `practice-room-guitar-memory1` | 0.671 | 0.06 | 1 / 18 / KEEP | 1 / 16 / KEEP | `practice-room-guitar-left-hand1` |
| 47 | `practice-room-guitar-memory1` | `practice-room-guitar-whammy1` | 0.671 | 0.06 | 1 / 16 / KEEP | 0 / 38 / WATCH | `practice-room-guitar-whammy1` |
| 48 | `practice-room-piano-concerto1` | `practice-room-piano-interval1` | 0.671 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 36 / KEEP | `practice-room-piano-interval1` |
| 49 | `practice-room-guitar-fingering1` | `practice-room-guitar-strumming1` | 0.671 | 0.27 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 33 / KEEP | `practice-room-guitar-strumming1` |
| 50 | `practice-room-piano-sight-adv1` | `practice-room-piano-tremolo1` | 0.671 | 0.07 | 0 / 44 / WATCH | 4 / 127 / KEEP | `practice-room-piano-tremolo1` |
| 51 | `practice-room-bass-fingering1` | `practice-room-bass-root-fifth1` | 0.671 | 0.07 | 4 / 127 / KEEP | 0 / 19 / WATCH | `practice-room-bass-fingering1` |
| 52 | `practice-room-piano-chromatic1` | `practice-room-piano-leadsheet1` | 0.670 | 0.30 | 1 / 28 / KEEP | 1 / 19 / KEEP | `practice-room-piano-chromatic1` |
| 53 | `practice-room-piano-concerto1` | `practice-room-piano-rhythm1` | 0.670 | 0.27 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-concerto1` |
| 54 | `practice-room-piano-interval1` | `practice-room-piano-rhythm1` | 0.670 | 0.14 | 1 / 36 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-interval1` |
| 55 | `practice-room-guitar-pinch-harmonic1` | `practice-room-guitar-strumming1` | 0.670 | 0.27 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 33 / KEEP | `practice-room-guitar-strumming1` |
| 56 | `practice-room-bass-country1` | `practice-room-bass-rock-groove1` | 0.670 | 0.33 | 0 / 3 / WATCH_LOW | 0 / 5 / WATCH_LOW | `practice-room-bass-rock-groove1` |
| 57 | `practice-room-guitar-memory1` | `practice-room-guitar-scale-pos1` | 0.669 | 0.07 | 1 / 16 / KEEP | 1 / 22 / KEEP | `practice-room-guitar-scale-pos1` |
| 58 | `practice-room-bass-detuning1` | `practice-room-bass-root-fifth1` | 0.669 | 0.08 | 5 / 102 / KEEP | 0 / 19 / WATCH | `practice-room-bass-detuning1` |
| 59 | `practice-room-guitar-memory1` | `practice-room-guitar-mute1` | 0.669 | 0.06 | 1 / 16 / KEEP | 0 / 32 / WATCH | `practice-room-guitar-mute1` |
| 60 | `practice-room-guitar-fingering1` | `practice-room-guitar-left-hand1` | 0.669 | 0.31 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 18 / KEEP | `practice-room-guitar-left-hand1` |
| 61 | `practice-room-guitar-hammer-pull1` | `practice-room-guitar-memory1` | 0.669 | 0.23 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 16 / KEEP | `practice-room-guitar-memory1` |
| 62 | `practice-room-piano-polyphony1` | `practice-room-piano-sonata1` | 0.668 | 0.27 | 0 / 13 / WATCH | 1 / 10 / KEEP | `practice-room-piano-polyphony1` |
| 63 | `practice-room-piano-jazz-improv1` | `practice-room-piano-jazz1` | 0.667 | 0.63 | 1 / 20 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-jazz-improv1` |
| 64 | `practice-room-guitar-fingering1` | `practice-room-guitar-stretch1` | 0.666 | 0.23 | 0 / 0 / NOINDEX_CANDIDATE | 2 / 60 / KEEP | `practice-room-guitar-stretch1` |
| 65 | `practice-room-piano-chromatic1` | `practice-room-piano-concerto1` | 0.666 | 0.27 | 1 / 28 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-chromatic1` |
| 66 | `practice-room-guitar-fingering1` | `practice-room-guitar-pinch-harmonic1` | 0.666 | 0.27 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-pinch-harmonic1` |
| 67 | `practice-room-piano-left-hand1` | `practice-room-piano-modulation1` | 0.666 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 30 / KEEP | `practice-room-piano-modulation1` |
| 68 | `practice-room-guitar-chord-arpeggio1` | `practice-room-guitar-chord-change1` | 0.666 | 0.36 | 2 / 58 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-chord-arpeggio1` |
| 69 | `practice-room-guitar-jazz-chord1` | `practice-room-guitar-jazz-voicing1` | 0.665 | 0.86 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 24 / KEEP | `practice-room-guitar-jazz-voicing1` |
| 70 | `practice-room-piano-baroque1` | `practice-room-piano-polyphony1` | 0.665 | 0.27 | 0 / 11 / WATCH | 0 / 13 / WATCH | `practice-room-piano-polyphony1` |
| 71 | `practice-room-piano-concerto1` | `practice-room-piano-impressionism1` | 0.665 | 0.30 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-impressionism1` |
| 72 | `practice-room-piano-four-hands1` | `practice-room-piano-rhythm1` | 0.664 | 0.30 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-rhythm1` |
| 73 | `practice-room-drum-tempo1` | `practice-room-drum-timing1` | 0.664 | 0.40 | 0 / 14 / WATCH | 1 / 9 / KEEP | `practice-room-drum-tempo1` |
| 74 | `practice-room-piano-four-hands1` | `practice-room-piano-interval1` | 0.663 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 36 / KEEP | `practice-room-piano-interval1` |
| 75 | `practice-room-piano-leadsheet1` | `practice-room-piano-modulation1` | 0.663 | 0.07 | 1 / 19 / KEEP | 1 / 30 / KEEP | `practice-room-piano-modulation1` |
| 76 | `practice-room-piano-beginner-adult1` | `practice-room-piano-left-hand1` | 0.662 | 0.27 | 1 / 20 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-beginner-adult1` |
| 77 | `practice-room-guitar-fingerstyle-adv1` | `practice-room-guitar-fingerstyle21` | 0.662 | 0.23 | 1 / 18 / KEEP | 0 / 19 / WATCH | `practice-room-guitar-fingerstyle21` |
| 78 | `practice-room-guitar-chord-adv1` | `practice-room-guitar-chord-change1` | 0.662 | 0.36 | 0 / 7 / WATCH_LOW | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-chord-adv1` |
| 79 | `practice-room-piano-beginner-adult1` | `practice-room-piano-key-signature1` | 0.662 | 0.07 | 1 / 20 / KEEP | 0 / 29 / WATCH | `practice-room-piano-key-signature1` |
| 80 | `practice-room-bass-detuning1` | `practice-room-bass-sustain1` | 0.662 | 0.08 | 5 / 102 / KEEP | 0 / 26 / WATCH | `practice-room-bass-detuning1` |
| 81 | `practice-room-piano-chromatic1` | `practice-room-piano-four-hands1` | 0.662 | 0.30 | 1 / 28 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-chromatic1` |
| 82 | `practice-room-piano-beginner-adult1` | `practice-room-piano-leadsheet1` | 0.662 | 0.27 | 1 / 20 / KEEP | 1 / 19 / KEEP | `practice-room-piano-beginner-adult1` |
| 83 | `practice-room-piano-chromatic1` | `practice-room-piano-interval1` | 0.662 | 0.07 | 1 / 28 / KEEP | 1 / 36 / KEEP | `practice-room-piano-interval1` |
| 84 | `practice-room-piano-pedal1` | `practice-room-piano-touch1` | 0.661 | 0.08 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 15 / WATCH | `practice-room-piano-touch1` |
| 85 | `practice-room-piano-chromatic1` | `practice-room-piano-rhythm1` | 0.661 | 0.27 | 1 / 28 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-chromatic1` |
| 86 | `practice-room-drum-offbeat1` | `practice-room-drum-timing1` | 0.661 | 0.14 | 1 / 90 / KEEP | 1 / 9 / KEEP | `practice-room-drum-offbeat1` |
| 87 | `practice-room-drum-jazz-adv1` | `practice-room-drum-jazz-ride1` | 0.660 | 0.50 | 3 / 30 / KEEP | 1 / 21 / KEEP | `practice-room-drum-jazz-adv1` |
| 88 | `practice-room-guitar-acoustic-fingerpick1` | `practice-room-guitar-fingerpick-pattern1` | 0.660 | 0.33 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 8 / WATCH_LOW | `practice-room-guitar-fingerpick-pattern1` |
| 89 | `practice-room-piano-impressionism1` | `practice-room-piano-rhythm1` | 0.660 | 0.30 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-impressionism1` |
| 90 | `practice-room-piano-impressionism1` | `practice-room-piano-interval1` | 0.660 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 36 / KEEP | `practice-room-piano-interval1` |
| 91 | `practice-room-guitar-left-hand1` | `practice-room-guitar-stretch1` | 0.660 | 0.27 | 1 / 18 / KEEP | 2 / 60 / KEEP | `practice-room-guitar-stretch1` |
| 92 | `practice-room-piano-polyphony1` | `practice-room-piano-romantic1` | 0.660 | 0.27 | 0 / 13 / WATCH | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-polyphony1` |
| 93 | `practice-room-bass-root-adv1` | `practice-room-bass-sustain1` | 0.660 | 0.12 | 0 / 33 / WATCH | 0 / 26 / WATCH | `practice-room-bass-root-adv1` |
| 94 | `practice-room-guitar-chord-change1` | `practice-room-guitar-chord-melody1` | 0.660 | 0.36 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 32 / KEEP | `practice-room-guitar-chord-melody1` |
| 95 | `practice-room-piano-pedal1` | `practice-room-piano-technique-adv1` | 0.660 | 0.40 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-technique-adv1` |
| 96 | `practice-room-guitar-scale-pos1` | `practice-room-guitar-scale-position1` | 0.659 | 0.23 | 1 / 22 / KEEP | 0 / 20 / WATCH | `practice-room-guitar-scale-pos1` |
| 97 | `practice-room-drum-rimshot-adv1` | `practice-room-drum-rimshot1` | 0.659 | 0.15 | 1 / 58 / KEEP | 0 / 47 / WATCH | `practice-room-drum-rimshot-adv1` |
| 98 | `practice-room-guitar-scale-position1` | `practice-room-guitar-strumming1` | 0.658 | 0.07 | 0 / 20 / WATCH | 1 / 33 / KEEP | `practice-room-guitar-strumming1` |
| 99 | `practice-room-guitar-fingerpick-adv1` | `practice-room-guitar-fingerstyle-adv1` | 0.658 | 0.63 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 18 / KEEP | `practice-room-guitar-fingerstyle-adv1` |
| 100 | `practice-room-guitar-blues-scale1` | `practice-room-guitar-blues1` | 0.658 | 0.31 | 2 / 100 / KEEP | 0 / 28 / WATCH | `practice-room-guitar-blues-scale1` |
| 101 | `practice-room-piano-four-hands1` | `practice-room-piano-impressionism1` | 0.658 | 0.33 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-impressionism1` |
| 102 | `practice-room-piano-baroque1` | `practice-room-piano-romantic1` | 0.658 | 0.33 | 0 / 11 / WATCH | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-baroque1` |
| 103 | `practice-room-piano-sight-play1` | `practice-room-piano-tremolo1` | 0.658 | 0.38 | 1 / 66 / KEEP | 4 / 127 / KEEP | `practice-room-piano-tremolo1` |
| 104 | `practice-room-piano-concerto1` | `practice-room-piano-modulation1` | 0.658 | 0.14 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 30 / KEEP | `practice-room-piano-modulation1` |
| 105 | `practice-room-guitar-sweep-picking1` | `practice-room-guitar-sweep1` | 0.657 | 0.45 | 1 / 53 / KEEP | 1 / 51 / KEEP | `practice-room-guitar-sweep-picking1` |
| 106 | `practice-room-guitar-fingering1` | `practice-room-guitar-hammer-pull1` | 0.657 | 0.40 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-hammer-pull1` |
| 107 | `practice-room-guitar-riff1` | `practice-room-guitar-strumming1` | 0.657 | 0.40 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 33 / KEEP | `practice-room-guitar-strumming1` |
| 108 | `practice-room-piano-scale-adv1` | `practice-room-piano-technique-adv1` | 0.657 | 0.36 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-technique-adv1` |
| 109 | `practice-room-piano-technique-adv1` | `practice-room-piano-touch1` | 0.657 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 15 / WATCH | `practice-room-piano-touch1` |
| 110 | `practice-room-piano-interval1` | `practice-room-piano-modulation1` | 0.657 | 0.13 | 1 / 36 / KEEP | 1 / 30 / KEEP | `practice-room-piano-interval1` |
| 111 | `practice-room-guitar-fingering1` | `practice-room-guitar-scale-position1` | 0.656 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 20 / WATCH | `practice-room-guitar-scale-position1` |
| 112 | `practice-room-piano-sight-adv1` | `practice-room-piano-sonata1` | 0.656 | 0.06 | 0 / 44 / WATCH | 1 / 10 / KEEP | `practice-room-piano-sight-adv1` |
| 113 | `practice-room-piano-chromatic1` | `practice-room-piano-impressionism1` | 0.656 | 0.30 | 1 / 28 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-chromatic1` |
| 114 | `practice-room-guitar-pinch-harmonic1` | `practice-room-guitar-scale-position1` | 0.656 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 20 / WATCH | `practice-room-guitar-scale-position1` |
| 115 | `practice-room-guitar-mute1` | `practice-room-guitar-strumming1` | 0.656 | 0.07 | 0 / 32 / WATCH | 1 / 33 / KEEP | `practice-room-guitar-strumming1` |
| 116 | `practice-room-guitar-arpeggio1` | `practice-room-guitar-strumming1` | 0.655 | 0.27 | 1 / 86 / KEEP | 1 / 33 / KEEP | `practice-room-guitar-arpeggio1` |
| 117 | `practice-room-piano-pedal1` | `practice-room-piano-scale-adv1` | 0.655 | 0.30 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-pedal1` |
| 118 | `practice-room-guitar-chord-adv1` | `practice-room-guitar-chord-arpeggio1` | 0.655 | 0.56 | 0 / 7 / WATCH_LOW | 2 / 58 / KEEP | `practice-room-guitar-chord-arpeggio1` |
| 119 | `practice-room-guitar-memory1` | `practice-room-guitar-theory1` | 0.655 | 0.25 | 1 / 16 / KEEP | 0 / 8 / WATCH_LOW | `practice-room-guitar-memory1` |
| 120 | `practice-room-piano-chromatic1` | `practice-room-piano-modulation1` | 0.655 | 0.14 | 1 / 28 / KEEP | 1 / 30 / KEEP | `practice-room-piano-modulation1` |
| 121 | `practice-room-guitar-fingering1` | `practice-room-guitar-riff1` | 0.654 | 0.27 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-riff1` |
| 122 | `practice-room-piano-four-hands1` | `practice-room-piano-modulation1` | 0.654 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 30 / KEEP | `practice-room-piano-modulation1` |
| 123 | `practice-room-piano-modulation1` | `practice-room-piano-rhythm1` | 0.654 | 0.14 | 1 / 30 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-modulation1` |
| 124 | `practice-room-guitar-pinch-harmonic1` | `practice-room-guitar-whammy1` | 0.654 | 0.13 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 38 / WATCH | `practice-room-guitar-whammy1` |
| 125 | `practice-room-guitar-hammer-pull1` | `practice-room-guitar-pinch-harmonic1` | 0.654 | 0.27 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-pinch-harmonic1` |
| 126 | `practice-room-guitar-hammer-pull1` | `practice-room-guitar-strumming1` | 0.654 | 0.27 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 33 / KEEP | `practice-room-guitar-strumming1` |
| 127 | `practice-room-guitar-left-hand1` | `practice-room-guitar-strumming1` | 0.653 | 0.06 | 1 / 18 / KEEP | 1 / 33 / KEEP | `practice-room-guitar-strumming1` |
| 128 | `practice-room-piano-beginner-adult1` | `practice-room-piano-concerto1` | 0.653 | 0.25 | 1 / 20 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-beginner-adult1` |
| 129 | `practice-room-drum-metronome1` | `practice-room-drum-offbeat1` | 0.653 | 0.11 | 0 / 29 / WATCH | 1 / 90 / KEEP | `practice-room-drum-offbeat1` |
| 130 | `practice-room-drum-offbeat1` | `practice-room-drum-tempo1` | 0.653 | 0.07 | 1 / 90 / KEEP | 0 / 14 / WATCH | `practice-room-drum-offbeat1` |
| 131 | `practice-room-guitar-stretch1` | `practice-room-guitar-strumming1` | 0.653 | 0.07 | 2 / 60 / KEEP | 1 / 33 / KEEP | `practice-room-guitar-stretch1` |
| 132 | `practice-room-piano-beginner-adult1` | `practice-room-piano-interval1` | 0.653 | 0.06 | 1 / 20 / KEEP | 1 / 36 / KEEP | `practice-room-piano-interval1` |
| 133 | `practice-room-guitar-acoustic-fingerpick1` | `practice-room-guitar-fingerstyle-adv1` | 0.653 | 0.33 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 18 / KEEP | `practice-room-guitar-fingerstyle-adv1` |
| 134 | `practice-room-drum-jazz-ride1` | `practice-room-drum-jazz1` | 0.653 | 0.44 | 1 / 21 / KEEP | 2 / 45 / KEEP | `practice-room-drum-jazz1` |
| 135 | `practice-room-guitar-mute1` | `practice-room-guitar-pinch-harmonic1` | 0.652 | 0.07 | 0 / 32 / WATCH | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-mute1` |
| 136 | `practice-room-guitar-picking-adv1` | `practice-room-guitar-sweep1` | 0.652 | 0.45 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 51 / KEEP | `practice-room-guitar-sweep1` |
| 137 | `practice-room-guitar-pinch-harmonic1` | `practice-room-guitar-riff1` | 0.652 | 0.27 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-pinch-harmonic1` |
| 138 | `practice-room-guitar-arpeggio1` | `practice-room-guitar-fingering1` | 0.652 | 0.27 | 1 / 86 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-arpeggio1` |
| 139 | `practice-room-guitar-hammer-pull1` | `practice-room-guitar-stretch1` | 0.651 | 0.14 | 0 / 0 / NOINDEX_CANDIDATE | 2 / 60 / KEEP | `practice-room-guitar-stretch1` |
| 140 | `practice-room-piano-leaps1` | `practice-room-piano-parallel1` | 0.651 | 0.11 | 1 / 42 / KEEP | 0 / 4 / WATCH_LOW | `practice-room-piano-leaps1` |
| 141 | `practice-room-piano-polyphony1` | `practice-room-piano-sight-adv1` | 0.651 | 0.06 | 0 / 13 / WATCH | 0 / 44 / WATCH | `practice-room-piano-sight-adv1` |
| 142 | `practice-room-guitar-strumming1` | `practice-room-guitar-whammy1` | 0.651 | 0.06 | 1 / 33 / KEEP | 0 / 38 / WATCH | `practice-room-guitar-whammy1` |
| 143 | `practice-room-guitar-scale-pos1` | `practice-room-guitar-strumming1` | 0.651 | 0.08 | 1 / 22 / KEEP | 1 / 33 / KEEP | `practice-room-guitar-strumming1` |
| 144 | `practice-room-piano-romantic1` | `practice-room-piano-sight-adv1` | 0.651 | 0.06 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 44 / WATCH | `practice-room-piano-sight-adv1` |
| 145 | `practice-room-bass-fingering1` | `practice-room-bass-root-adv1` | 0.650 | 0.07 | 4 / 127 / KEEP | 0 / 33 / WATCH | `practice-room-bass-fingering1` |
| 146 | `practice-room-guitar-fingering1` | `practice-room-guitar-mute1` | 0.650 | 0.23 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 32 / WATCH | `practice-room-guitar-mute1` |
| 147 | `practice-room-guitar-arpeggio1` | `practice-room-guitar-pinch-harmonic1` | 0.650 | 0.27 | 1 / 86 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-arpeggio1` |
| 148 | `practice-room-guitar-left-hand1` | `practice-room-guitar-pinch-harmonic1` | 0.650 | 0.06 | 1 / 18 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-left-hand1` |
| 149 | `practice-room-piano-beginner-adult1` | `practice-room-piano-four-hands1` | 0.650 | 0.27 | 1 / 20 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-beginner-adult1` |
| 150 | `practice-room-guitar-pinch-harmonic1` | `practice-room-guitar-stretch1` | 0.650 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 2 / 60 / KEEP | `practice-room-guitar-stretch1` |
| 151 | `practice-room-guitar-fingering1` | `practice-room-guitar-whammy1` | 0.649 | 0.06 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 38 / WATCH | `practice-room-guitar-whammy1` |
| 152 | `practice-room-bass-detuning1` | `practice-room-bass-fingering1` | 0.649 | 0.38 | 5 / 102 / KEEP | 4 / 127 / KEEP | `practice-room-bass-fingering1` |
| 153 | `practice-room-drum-count1` | `practice-room-drum-timing1` | 0.649 | 0.33 | 2 / 57 / KEEP | 1 / 9 / KEEP | `practice-room-drum-count1` |
| 154 | `practice-room-piano-beginner-adult1` | `practice-room-piano-rhythm1` | 0.649 | 0.25 | 1 / 20 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-beginner-adult1` |
| 155 | `practice-room-piano-inner-voice1` | `practice-room-piano-parallel1` | 0.649 | 0.06 | 0 / 29 / WATCH | 0 / 4 / WATCH_LOW | `practice-room-piano-inner-voice1` |
| 156 | `practice-room-piano-beginner-adult1` | `practice-room-piano-chromatic1` | 0.649 | 0.25 | 1 / 20 / KEEP | 1 / 28 / KEEP | `practice-room-piano-chromatic1` |
| 157 | `practice-room-piano-scale-adv1` | `practice-room-piano-touch1` | 0.648 | 0.15 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 15 / WATCH | `practice-room-piano-touch1` |
| 158 | `practice-room-piano-sight-play1` | `practice-room-piano-sonata1` | 0.648 | 0.33 | 1 / 66 / KEEP | 1 / 10 / KEEP | `practice-room-piano-sight-play1` |
| 159 | `practice-room-guitar-hammer-pull1` | `practice-room-guitar-left-hand1` | 0.647 | 0.13 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 18 / KEEP | `practice-room-guitar-left-hand1` |
| 160 | `practice-room-piano-impressionism1` | `practice-room-piano-modulation1` | 0.647 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 30 / KEEP | `practice-room-piano-modulation1` |
| 161 | `practice-room-guitar-fingering1` | `practice-room-guitar-scale-pos1` | 0.647 | 0.08 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 22 / KEEP | `practice-room-guitar-scale-pos1` |
| 162 | `practice-room-guitar-chord-adv1` | `practice-room-guitar-chord-melody1` | 0.647 | 0.40 | 0 / 7 / WATCH_LOW | 1 / 32 / KEEP | `practice-room-guitar-chord-melody1` |
| 163 | `practice-room-guitar-chord-change1` | `practice-room-guitar-chord-prog1` | 0.646 | 0.11 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 35 / KEEP | `practice-room-guitar-chord-prog1` |
| 164 | `practice-room-piano-baroque1` | `practice-room-piano-sight-adv1` | 0.646 | 0.06 | 0 / 11 / WATCH | 0 / 44 / WATCH | `practice-room-piano-sight-adv1` |
| 165 | `practice-room-guitar-pinch-harmonic1` | `practice-room-guitar-scale-pos1` | 0.646 | 0.08 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 22 / KEEP | `practice-room-guitar-scale-pos1` |
| 166 | `practice-room-guitar-acoustic-fingerpick1` | `practice-room-guitar-fingerpick-adv1` | 0.645 | 0.30 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-fingerpick-adv1` |
| 167 | `practice-room-guitar-chord-arpeggio1` | `practice-room-guitar-chord-melody1` | 0.645 | 0.40 | 2 / 58 / KEEP | 1 / 32 / KEEP | `practice-room-guitar-chord-arpeggio1` |
| 168 | `practice-room-guitar-arpeggio1` | `practice-room-guitar-whammy1` | 0.645 | 0.06 | 1 / 86 / KEEP | 0 / 38 / WATCH | `practice-room-guitar-arpeggio1` |
| 169 | `practice-room-drum-accent1` | `practice-room-drum-cymbal1` | 0.645 | 0.27 | 0 / 16 / WATCH | 3 / 126 / KEEP | `practice-room-drum-cymbal1` |
| 170 | `practice-room-piano-beginner-adult1` | `practice-room-piano-impressionism1` | 0.645 | 0.27 | 1 / 20 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-beginner-adult1` |
| 171 | `practice-room-guitar-arpeggio1` | `practice-room-guitar-mute1` | 0.644 | 0.07 | 1 / 86 / KEEP | 0 / 32 / WATCH | `practice-room-guitar-arpeggio1` |
| 172 | `practice-room-drum-count1` | `practice-room-drum-metronome1` | 0.643 | 0.18 | 2 / 57 / KEEP | 0 / 29 / WATCH | `practice-room-drum-count1` |
| 173 | `practice-room-bass-detuning1` | `practice-room-bass-root-adv1` | 0.643 | 0.07 | 5 / 102 / KEEP | 0 / 33 / WATCH | `practice-room-bass-detuning1` |
| 174 | `practice-room-guitar-memory1` | `practice-room-guitar-string1` | 0.643 | 0.21 | 1 / 16 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-memory1` |
| 175 | `practice-room-piano-chord-voicing1` | `practice-room-piano-voicing1` | 0.643 | 0.86 | 2 / 32 / KEEP | 2 / 42 / KEEP | `practice-room-piano-voicing1` |
| 176 | `practice-room-drum-count1` | `practice-room-drum-offbeat1` | 0.643 | 0.06 | 2 / 57 / KEEP | 1 / 90 / KEEP | `practice-room-drum-offbeat1` |
| 177 | `practice-room-guitar-picking1` | `practice-room-guitar-sweep-picking1` | 0.643 | 0.36 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 53 / KEEP | `practice-room-guitar-sweep-picking1` |
| 178 | `practice-room-drum-count1` | `practice-room-drum-tempo1` | 0.643 | 0.33 | 2 / 57 / KEEP | 0 / 14 / WATCH | `practice-room-drum-count1` |
| 179 | `practice-room-guitar-arpeggio1` | `practice-room-guitar-scale-position1` | 0.642 | 0.07 | 1 / 86 / KEEP | 0 / 20 / WATCH | `practice-room-guitar-arpeggio1` |
| 180 | `practice-room-guitar-left-hand1` | `practice-room-guitar-scale-position1` | 0.642 | 0.06 | 1 / 18 / KEEP | 0 / 20 / WATCH | `practice-room-guitar-scale-position1` |
| 181 | `practice-room-guitar-hammer-pull1` | `practice-room-guitar-riff1` | 0.642 | 0.27 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-hammer-pull1` |
| 182 | `practice-room-guitar-arpeggio1` | `practice-room-guitar-left-hand1` | 0.642 | 0.06 | 1 / 86 / KEEP | 1 / 18 / KEEP | `practice-room-guitar-arpeggio1` |
| 183 | `practice-room-piano-dynamics1` | `practice-room-piano-parallel1` | 0.642 | 0.27 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 4 / WATCH_LOW | `practice-room-piano-parallel1` |
| 184 | `practice-room-piano-scale-adv1` | `practice-room-piano-technique21` | 0.642 | 0.56 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-technique21` |
| 185 | `practice-room-guitar-picking-adv1` | `practice-room-guitar-picking1` | 0.642 | 0.36 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-picking1` |
| 186 | `practice-room-guitar-fingerpick-adv1` | `practice-room-guitar-fingerstyle21` | 0.642 | 0.21 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 19 / WATCH | `practice-room-guitar-fingerstyle21` |
| 187 | `practice-room-guitar-left-hand1` | `practice-room-guitar-mute1` | 0.642 | 0.19 | 1 / 18 / KEEP | 0 / 32 / WATCH | `practice-room-guitar-mute1` |
| 188 | `practice-room-piano-polyphony1` | `practice-room-piano-sight-play1` | 0.641 | 0.27 | 0 / 13 / WATCH | 1 / 66 / KEEP | `practice-room-piano-sight-play1` |
| 189 | `practice-room-guitar-riff1` | `practice-room-guitar-scale-position1` | 0.641 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 20 / WATCH | `practice-room-guitar-scale-position1` |
| 190 | `practice-room-guitar-fingerpick-adv1` | `practice-room-guitar-fingerpick-pattern1` | 0.640 | 0.30 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 8 / WATCH_LOW | `practice-room-guitar-fingerpick-pattern1` |
| 191 | `practice-room-piano-beginner-adult1` | `practice-room-piano-modulation1` | 0.640 | 0.06 | 1 / 20 / KEEP | 1 / 30 / KEEP | `practice-room-piano-modulation1` |
| 192 | `practice-room-guitar-mute1` | `practice-room-guitar-whammy1` | 0.640 | 0.06 | 0 / 32 / WATCH | 0 / 38 / WATCH | `practice-room-guitar-whammy1` |
| 193 | `practice-room-guitar-mute1` | `practice-room-guitar-riff1` | 0.640 | 0.07 | 0 / 32 / WATCH | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-mute1` |
| 194 | `practice-room-guitar-hammer-pull1` | `practice-room-guitar-whammy1` | 0.640 | 0.06 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 38 / WATCH | `practice-room-guitar-whammy1` |
| 195 | `practice-room-piano-inner-voice1` | `practice-room-piano-leaps1` | 0.640 | 0.10 | 0 / 29 / WATCH | 1 / 42 / KEEP | `practice-room-piano-leaps1` |
| 196 | `practice-room-guitar-arpeggio1` | `practice-room-guitar-riff1` | 0.639 | 0.27 | 1 / 86 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-arpeggio1` |
| 197 | `practice-room-guitar-left-hand1` | `practice-room-guitar-riff1` | 0.639 | 0.06 | 1 / 18 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-left-hand1` |
| 198 | `practice-room-guitar-scale-position1` | `practice-room-guitar-whammy1` | 0.639 | 0.06 | 0 / 20 / WATCH | 0 / 38 / WATCH | `practice-room-guitar-whammy1` |
| 199 | `practice-room-piano-baroque1` | `practice-room-piano-sight-play1` | 0.639 | 0.33 | 0 / 11 / WATCH | 1 / 66 / KEEP | `practice-room-piano-sight-play1` |
| 200 | `practice-room-guitar-mute1` | `practice-room-guitar-scale-pos1` | 0.639 | 0.07 | 0 / 32 / WATCH | 1 / 22 / KEEP | `practice-room-guitar-mute1` |
| 201 | `practice-room-guitar-hammer-pull1` | `practice-room-guitar-scale-position1` | 0.639 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 20 / WATCH | `practice-room-guitar-scale-position1` |
| 202 | `practice-room-guitar-arpeggio1` | `practice-room-guitar-hammer-pull1` | 0.639 | 0.27 | 1 / 86 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-arpeggio1` |
| 203 | `practice-room-guitar-riff1` | `practice-room-guitar-whammy1` | 0.639 | 0.06 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 38 / WATCH | `practice-room-guitar-whammy1` |
| 204 | `practice-room-guitar-arpeggio1` | `practice-room-guitar-scale-pos1` | 0.639 | 0.17 | 1 / 86 / KEEP | 1 / 22 / KEEP | `practice-room-guitar-arpeggio1` |
| 205 | `practice-room-guitar-arpeggio1` | `practice-room-guitar-stretch1` | 0.638 | 0.07 | 1 / 86 / KEEP | 2 / 60 / KEEP | `practice-room-guitar-arpeggio1` |
| 206 | `practice-room-guitar-mute1` | `practice-room-guitar-stretch1` | 0.638 | 0.13 | 0 / 32 / WATCH | 2 / 60 / KEEP | `practice-room-guitar-stretch1` |
| 207 | `practice-room-guitar-scale-position1` | `practice-room-guitar-stretch1` | 0.638 | 0.06 | 0 / 20 / WATCH | 2 / 60 / KEEP | `practice-room-guitar-stretch1` |
| 208 | `practice-room-guitar-fingerpick-pattern1` | `practice-room-guitar-fingerstyle21` | 0.638 | 0.07 | 0 / 8 / WATCH_LOW | 0 / 19 / WATCH | `practice-room-guitar-fingerstyle21` |
| 209 | `practice-room-guitar-mute1` | `practice-room-guitar-scale-position1` | 0.638 | 0.06 | 0 / 32 / WATCH | 0 / 20 / WATCH | `practice-room-guitar-mute1` |
| 210 | `practice-room-piano-romantic1` | `practice-room-piano-sight-play1` | 0.637 | 0.33 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 66 / KEEP | `practice-room-piano-sight-play1` |
| 211 | `practice-room-piano-key-signature1` | `practice-room-piano-memorization1` | 0.637 | 0.08 | 0 / 29 / WATCH | 0 / 6 / WATCH_LOW | `practice-room-piano-key-signature1` |
| 212 | `practice-room-guitar-hammer-pull1` | `practice-room-guitar-mute1` | 0.637 | 0.14 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 32 / WATCH | `practice-room-guitar-mute1` |
| 213 | `practice-room-guitar-riff1` | `practice-room-guitar-stretch1` | 0.637 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 2 / 60 / KEEP | `practice-room-guitar-stretch1` |
| 214 | `practice-room-guitar-scale-pos1` | `practice-room-guitar-whammy1` | 0.637 | 0.06 | 1 / 22 / KEEP | 0 / 38 / WATCH | `practice-room-guitar-whammy1` |
| 215 | `practice-room-guitar-left-hand1` | `practice-room-guitar-whammy1` | 0.637 | 0.05 | 1 / 18 / KEEP | 0 / 38 / WATCH | `practice-room-guitar-whammy1` |
| 216 | `practice-room-guitar-scale-pos1` | `practice-room-guitar-stretch1` | 0.637 | 0.07 | 1 / 22 / KEEP | 2 / 60 / KEEP | `practice-room-guitar-stretch1` |
| 217 | `practice-room-drum-accent1` | `practice-room-drum-snare-tuning1` | 0.636 | 0.14 | 0 / 16 / WATCH | 1 / 95 / KEEP | `practice-room-drum-snare-tuning1` |
| 218 | `practice-room-piano-parallel1` | `practice-room-piano-rubato1` | 0.636 | 0.06 | 0 / 4 / WATCH_LOW | 0 / 49 / WATCH | `practice-room-piano-rubato1` |
| 219 | `practice-room-drum-jazz-adv1` | `practice-room-drum-jazz1` | 0.636 | 0.40 | 3 / 30 / KEEP | 2 / 45 / KEEP | `practice-room-drum-jazz1` |
| 220 | `practice-room-piano-left-hand1` | `practice-room-piano-memorization1` | 0.635 | 0.33 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 6 / WATCH_LOW | `practice-room-piano-memorization1` |
| 221 | `practice-room-guitar-chord-adv1` | `practice-room-guitar-chord-prog1` | 0.635 | 0.12 | 0 / 7 / WATCH_LOW | 1 / 35 / KEEP | `practice-room-guitar-chord-prog1` |
| 222 | `practice-room-guitar-stretch1` | `practice-room-guitar-whammy1` | 0.635 | 0.06 | 2 / 60 / KEEP | 0 / 38 / WATCH | `practice-room-guitar-stretch1` |
| 223 | `practice-room-piano-concerto1` | `practice-room-piano-memorization1` | 0.635 | 0.30 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 6 / WATCH_LOW | `practice-room-piano-memorization1` |
| 224 | `practice-room-guitar-hammer-pull1` | `practice-room-guitar-scale-pos1` | 0.634 | 0.08 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 22 / KEEP | `practice-room-guitar-scale-pos1` |
| 225 | `practice-room-guitar-riff1` | `practice-room-guitar-scale-pos1` | 0.634 | 0.08 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 22 / KEEP | `practice-room-guitar-scale-pos1` |
| 226 | `practice-room-vocal-live1` | `practice-room-vocal-rhythm1` | 0.634 | 0.27 | 1 / 9 / KEEP | 1 / 12 / KEEP | `practice-room-vocal-rhythm1` |
| 227 | `practice-room-piano-four-hands1` | `practice-room-piano-memorization1` | 0.634 | 0.33 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 6 / WATCH_LOW | `practice-room-piano-memorization1` |
| 228 | `practice-room-guitar-theory1` | `practice-room-guitar-whammy1` | 0.633 | 0.07 | 0 / 8 / WATCH_LOW | 0 / 38 / WATCH | `practice-room-guitar-whammy1` |
| 229 | `practice-room-piano-scale-adv1` | `practice-room-piano-trills1` | 0.633 | 0.30 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-trills1` |
| 230 | `practice-room-piano-chord-adv1` | `practice-room-piano-parallel1` | 0.633 | 0.25 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 4 / WATCH_LOW | `practice-room-piano-parallel1` |
| 231 | `practice-room-guitar-chord-arpeggio1` | `practice-room-guitar-chord-prog1` | 0.633 | 0.12 | 2 / 58 / KEEP | 1 / 35 / KEEP | `practice-room-guitar-chord-arpeggio1` |
| 232 | `practice-room-guitar-left-hand1` | `practice-room-guitar-scale-pos1` | 0.633 | 0.06 | 1 / 18 / KEEP | 1 / 22 / KEEP | `practice-room-guitar-scale-pos1` |
| 233 | `practice-room-piano-leadsheet1` | `practice-room-piano-memorization1` | 0.632 | 0.33 | 1 / 19 / KEEP | 0 / 6 / WATCH_LOW | `practice-room-piano-leadsheet1` |
| 234 | `practice-room-piano-dynamics1` | `practice-room-piano-inner-voice1` | 0.632 | 0.13 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 29 / WATCH | `practice-room-piano-inner-voice1` |
| 235 | `practice-room-guitar-fingering1` | `practice-room-guitar-theory1` | 0.631 | 0.30 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 8 / WATCH_LOW | `practice-room-guitar-theory1` |
| 236 | `practice-room-guitar-strumming1` | `practice-room-guitar-theory1` | 0.631 | 0.30 | 1 / 33 / KEEP | 0 / 8 / WATCH_LOW | `practice-room-guitar-strumming1` |
| 237 | `practice-room-guitar-acoustic-fingerpick1` | `practice-room-guitar-fingerstyle21` | 0.631 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 19 / WATCH | `practice-room-guitar-fingerstyle21` |
| 238 | `practice-room-drum-cymbal1` | `practice-room-drum-snare-tuning1` | 0.631 | 0.14 | 3 / 126 / KEEP | 1 / 95 / KEEP | `practice-room-drum-cymbal1` |
| 239 | `practice-room-piano-sight-adv1` | `practice-room-piano-sight-play1` | 0.631 | 0.06 | 0 / 44 / WATCH | 1 / 66 / KEEP | `practice-room-piano-sight-play1` |
| 240 | `practice-room-guitar-chord-change1` | `practice-room-guitar-chord1` | 0.630 | 0.50 | 0 / 0 / NOINDEX_CANDIDATE | 2 / 37 / KEEP | `practice-room-guitar-chord1` |
| 241 | `practice-room-piano-dynamics1` | `practice-room-piano-leaps1` | 0.629 | 0.06 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 42 / KEEP | `practice-room-piano-leaps1` |
| 242 | `practice-room-guitar-pinch-harmonic1` | `practice-room-guitar-theory1` | 0.629 | 0.30 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 8 / WATCH_LOW | `practice-room-guitar-theory1` |
| 243 | `practice-room-drum-accent1` | `practice-room-drum-speed1` | 0.629 | 0.06 | 0 / 16 / WATCH | 0 / 35 / WATCH | `practice-room-drum-speed1` |
| 244 | `practice-room-guitar-picking1` | `practice-room-guitar-sweep1` | 0.629 | 0.42 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 51 / KEEP | `practice-room-guitar-sweep1` |
| 245 | `practice-room-guitar-string1` | `practice-room-guitar-whammy1` | 0.629 | 0.06 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 38 / WATCH | `practice-room-guitar-whammy1` |
| 246 | `practice-room-guitar-scale-position1` | `practice-room-guitar-theory1` | 0.628 | 0.07 | 0 / 20 / WATCH | 0 / 8 / WATCH_LOW | `practice-room-guitar-scale-position1` |
| 247 | `practice-room-guitar-chord-melody1` | `practice-room-guitar-chord-prog1` | 0.627 | 0.12 | 1 / 32 / KEEP | 1 / 35 / KEEP | `practice-room-guitar-chord-prog1` |
| 248 | `practice-room-piano-technique-adv1` | `practice-room-piano-trills1` | 0.626 | 0.40 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-technique-adv1` |
| 249 | `practice-room-drum-cymbal1` | `practice-room-drum-speed1` | 0.626 | 0.06 | 3 / 126 / KEEP | 0 / 35 / WATCH | `practice-room-drum-cymbal1` |
| 250 | `practice-room-piano-chord-adv1` | `practice-room-piano-leaps1` | 0.626 | 0.06 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 42 / KEEP | `practice-room-piano-leaps1` |
| 251 | `practice-room-piano-interval1` | `practice-room-piano-memorization1` | 0.625 | 0.07 | 1 / 36 / KEEP | 0 / 6 / WATCH_LOW | `practice-room-piano-interval1` |
| 252 | `practice-room-piano-leaps1` | `practice-room-piano-rubato1` | 0.625 | 0.05 | 1 / 42 / KEEP | 0 / 49 / WATCH | `practice-room-piano-rubato1` |
| 253 | `practice-room-piano-pedal1` | `practice-room-piano-trills1` | 0.625 | 0.33 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-pedal1` |
| 254 | `practice-room-guitar-string1` | `practice-room-guitar-strumming1` | 0.625 | 0.25 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 33 / KEEP | `practice-room-guitar-strumming1` |
| 255 | `practice-room-drum-electronic1` | `practice-room-drum-rimshot1` | 0.624 | 0.06 | 1 / 128 / KEEP | 0 / 47 / WATCH | `practice-room-drum-electronic1` |
| 256 | `practice-room-piano-pedal1` | `practice-room-piano-technique21` | 0.624 | 0.44 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-technique21` |
| 257 | `practice-room-piano-inner-voice1` | `practice-room-piano-rubato1` | 0.624 | 0.05 | 0 / 29 / WATCH | 0 / 49 / WATCH | `practice-room-piano-rubato1` |
| 258 | `practice-room-piano-memorization1` | `practice-room-piano-rhythm1` | 0.623 | 0.30 | 0 / 6 / WATCH_LOW | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-memorization1` |
| 259 | `practice-room-guitar-fingering1` | `practice-room-guitar-string1` | 0.623 | 0.25 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-string1` |
| 260 | `practice-room-piano-scale-adv1` | `practice-room-piano-technique31` | 0.623 | 0.13 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 104 / KEEP | `practice-room-piano-technique31` |
| 261 | `practice-room-piano-technique-adv1` | `practice-room-piano-technique21` | 0.623 | 0.36 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-technique21` |
| 262 | `practice-room-guitar-pinch-harmonic1` | `practice-room-guitar-string1` | 0.622 | 0.25 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-pinch-harmonic1` |
| 263 | `practice-room-drum-snare-tuning1` | `practice-room-drum-speed1` | 0.622 | 0.06 | 1 / 95 / KEEP | 0 / 35 / WATCH | `practice-room-drum-snare-tuning1` |
| 264 | `practice-room-piano-pedal1` | `practice-room-piano-technique31` | 0.622 | 0.14 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 104 / KEEP | `practice-room-piano-technique31` |
| 265 | `practice-room-piano-chromatic1` | `practice-room-piano-memorization1` | 0.622 | 0.30 | 1 / 28 / KEEP | 0 / 6 / WATCH_LOW | `practice-room-piano-chromatic1` |
| 266 | `practice-room-piano-chord-adv1` | `practice-room-piano-inner-voice1` | 0.622 | 0.06 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 29 / WATCH | `practice-room-piano-inner-voice1` |
| 267 | `practice-room-piano-duet1` | `practice-room-piano-four-hands1` | 0.622 | 0.30 | 0 / 4 / WATCH_LOW | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-duet1` |
| 268 | `practice-room-piano-technique21` | `practice-room-piano-technique31` | 0.622 | 0.13 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 104 / KEEP | `practice-room-piano-technique31` |
| 269 | `practice-room-guitar-memory1` | `practice-room-guitar-pentatonic-modes1` | 0.622 | 0.23 | 1 / 16 / KEEP | 1 / 24 / KEEP | `practice-room-guitar-pentatonic-modes1` |
| 270 | `practice-room-guitar-arpeggio1` | `practice-room-guitar-theory1` | 0.621 | 0.30 | 1 / 86 / KEEP | 0 / 8 / WATCH_LOW | `practice-room-guitar-arpeggio1` |
| 271 | `practice-room-piano-technique21` | `practice-room-piano-trills1` | 0.620 | 0.30 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-technique21` |
| 272 | `practice-room-piano-technique-adv1` | `practice-room-piano-technique31` | 0.620 | 0.13 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 104 / KEEP | `practice-room-piano-technique31` |
| 273 | `practice-room-guitar-mute1` | `practice-room-guitar-theory1` | 0.620 | 0.07 | 0 / 32 / WATCH | 0 / 8 / WATCH_LOW | `practice-room-guitar-mute1` |
| 274 | `practice-room-piano-impressionism1` | `practice-room-piano-memorization1` | 0.619 | 0.33 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 6 / WATCH_LOW | `practice-room-piano-memorization1` |
| 275 | `practice-room-piano-touch1` | `practice-room-piano-trills1` | 0.619 | 0.08 | 0 / 15 / WATCH | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-touch1` |
| 276 | `practice-room-guitar-scale-pos1` | `practice-room-guitar-theory1` | 0.619 | 0.08 | 1 / 22 / KEEP | 0 / 8 / WATCH_LOW | `practice-room-guitar-scale-pos1` |
| 277 | `practice-room-piano-dynamics1` | `practice-room-piano-rubato1` | 0.618 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 49 / WATCH | `practice-room-piano-rubato1` |
| 278 | `practice-room-piano-technique31` | `practice-room-piano-trills1` | 0.618 | 0.14 | 1 / 104 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-technique31` |
| 279 | `practice-room-guitar-riff1` | `practice-room-guitar-theory1` | 0.618 | 0.30 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 8 / WATCH_LOW | `practice-room-guitar-theory1` |
| 280 | `practice-room-piano-memorization1` | `practice-room-piano-modulation1` | 0.617 | 0.07 | 0 / 6 / WATCH_LOW | 1 / 30 / KEEP | `practice-room-piano-modulation1` |
| 281 | `practice-room-piano-technique21` | `practice-room-piano-touch1` | 0.617 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 15 / WATCH | `practice-room-piano-touch1` |
| 282 | `practice-room-guitar-hammer-pull1` | `practice-room-guitar-theory1` | 0.617 | 0.30 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 8 / WATCH_LOW | `practice-room-guitar-theory1` |
| 283 | `practice-room-guitar-hybrid1` | `practice-room-guitar-legato1` | 0.617 | 0.30 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 69 / KEEP | `practice-room-guitar-legato1` |
| 284 | `practice-room-guitar-left-hand1` | `practice-room-guitar-theory1` | 0.617 | 0.07 | 1 / 18 / KEEP | 0 / 8 / WATCH_LOW | `practice-room-guitar-left-hand1` |
| 285 | `practice-room-vocal-accent1` | `practice-room-vocal-rhythm1` | 0.617 | 0.25 | 1 / 29 / KEEP | 1 / 12 / KEEP | `practice-room-vocal-accent1` |
| 286 | `practice-room-drum-country1` | `practice-room-drum-reggae1` | 0.617 | 0.50 | 0 / 8 / WATCH_LOW | 0 / 10 / WATCH | `practice-room-drum-reggae1` |
| 287 | `practice-room-guitar-stretch1` | `practice-room-guitar-theory1` | 0.616 | 0.07 | 2 / 60 / KEEP | 0 / 8 / WATCH_LOW | `practice-room-guitar-stretch1` |
| 288 | `practice-room-guitar-mute1` | `practice-room-guitar-string1` | 0.616 | 0.06 | 0 / 32 / WATCH | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-mute1` |
| 289 | `practice-room-piano-technique31` | `practice-room-piano-touch1` | 0.615 | 0.06 | 1 / 104 / KEEP | 0 / 15 / WATCH | `practice-room-piano-technique31` |
| 290 | `practice-room-piano-beginner-adult1` | `practice-room-piano-memorization1` | 0.615 | 0.27 | 1 / 20 / KEEP | 0 / 6 / WATCH_LOW | `practice-room-piano-beginner-adult1` |
| 291 | `practice-room-guitar-arpeggio1` | `practice-room-guitar-string1` | 0.613 | 0.25 | 1 / 86 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-arpeggio1` |
| 292 | `practice-room-drum-electronic1` | `practice-room-drum-rimshot-adv1` | 0.613 | 0.20 | 1 / 128 / KEEP | 1 / 58 / KEEP | `practice-room-drum-electronic1` |
| 293 | `practice-room-vocal-rhythm1` | `practice-room-vocal-technique21` | 0.613 | 0.13 | 1 / 12 / KEEP | 0 / 21 / WATCH | `practice-room-vocal-technique21` |
| 294 | `practice-room-guitar-chord-prog1` | `practice-room-guitar-chord1` | 0.613 | 0.12 | 1 / 35 / KEEP | 2 / 37 / KEEP | `practice-room-guitar-chord1` |
| 295 | `practice-room-piano-chord-adv1` | `practice-room-piano-dynamics1` | 0.612 | 0.30 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-chord-adv1` |
| 296 | `practice-room-guitar-stretch1` | `practice-room-guitar-string1` | 0.611 | 0.06 | 2 / 60 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-stretch1` |
| 297 | `practice-room-guitar-chord-arpeggio1` | `practice-room-guitar-chord1` | 0.611 | 0.40 | 2 / 58 / KEEP | 2 / 37 / KEEP | `practice-room-guitar-chord-arpeggio1` |
| 298 | `practice-room-guitar-scale-position1` | `practice-room-guitar-string1` | 0.611 | 0.06 | 0 / 20 / WATCH | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-scale-position1` |
| 299 | `practice-room-piano-concerto1` | `practice-room-piano-duet1` | 0.611 | 0.40 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 4 / WATCH_LOW | `practice-room-piano-duet1` |
| 300 | `practice-room-guitar-chord-adv1` | `practice-room-guitar-chord1` | 0.611 | 0.40 | 0 / 7 / WATCH_LOW | 2 / 37 / KEEP | `practice-room-guitar-chord1` |
| 301 | `practice-room-guitar-left-hand1` | `practice-room-guitar-string1` | 0.611 | 0.06 | 1 / 18 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-left-hand1` |
| 302 | `practice-room-guitar-riff1` | `practice-room-guitar-string1` | 0.611 | 0.25 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-string1` |
| 303 | `practice-room-piano-duet1` | `practice-room-piano-left-hand1` | 0.611 | 0.30 | 0 / 4 / WATCH_LOW | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-duet1` |
| 304 | `practice-room-guitar-hammer-pull1` | `practice-room-guitar-string1` | 0.610 | 0.25 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-hammer-pull1` |
| 305 | `practice-room-guitar-scale-pos1` | `practice-room-guitar-string1` | 0.610 | 0.07 | 1 / 22 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-scale-pos1` |
| 306 | `practice-room-piano-duet1` | `practice-room-piano-key-signature1` | 0.610 | 0.07 | 0 / 4 / WATCH_LOW | 0 / 29 / WATCH | `practice-room-piano-key-signature1` |
| 307 | `practice-room-vocal-accent1` | `practice-room-vocal-live1` | 0.609 | 0.21 | 1 / 29 / KEEP | 1 / 9 / KEEP | `practice-room-vocal-accent1` |
| 308 | `practice-room-guitar-string1` | `practice-room-guitar-theory1` | 0.607 | 0.27 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 8 / WATCH_LOW | `practice-room-guitar-theory1` |
| 309 | `practice-room-piano-duet1` | `practice-room-piano-leadsheet1` | 0.607 | 0.30 | 0 / 4 / WATCH_LOW | 1 / 19 / KEEP | `practice-room-piano-leadsheet1` |
| 310 | `practice-room-guitar-chord-melody1` | `practice-room-guitar-chord1` | 0.607 | 0.40 | 1 / 32 / KEEP | 2 / 37 / KEEP | `practice-room-guitar-chord1` |
| 311 | `practice-room-piano-chord-adv1` | `practice-room-piano-rubato1` | 0.606 | 0.06 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 49 / WATCH | `practice-room-piano-rubato1` |
| 312 | `practice-room-guitar-pentatonic-modes1` | `practice-room-guitar-strumming1` | 0.605 | 0.40 | 1 / 24 / KEEP | 1 / 33 / KEEP | `practice-room-guitar-strumming1` |
| 313 | `practice-room-vocal-live1` | `practice-room-vocal-technique21` | 0.605 | 0.06 | 1 / 9 / KEEP | 0 / 21 / WATCH | `practice-room-vocal-technique21` |
| 314 | `practice-room-guitar-pentatonic-modes1` | `practice-room-guitar-whammy1` | 0.604 | 0.06 | 1 / 24 / KEEP | 0 / 38 / WATCH | `practice-room-guitar-whammy1` |
| 315 | `practice-room-vocal-color-adv1` | `practice-room-vocal-solfege1` | 0.604 | 0.06 | 0 / 14 / WATCH | 1 / 16 / KEEP | `practice-room-vocal-solfege1` |
| 316 | `practice-room-vocal-mic1` | `practice-room-vocal-recording1` | 0.604 | 0.07 | 0 / 19 / WATCH | 1 / 30 / KEEP | `practice-room-vocal-recording1` |
| 317 | `practice-room-guitar-pentatonic-modes1` | `practice-room-guitar-pinch-harmonic1` | 0.603 | 0.27 | 1 / 24 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-pentatonic-modes1` |
| 318 | `practice-room-guitar-fingering1` | `practice-room-guitar-pentatonic-modes1` | 0.601 | 0.27 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 24 / KEEP | `practice-room-guitar-pentatonic-modes1` |
| 319 | `practice-room-piano-duet1` | `practice-room-piano-interval1` | 0.599 | 0.07 | 0 / 4 / WATCH_LOW | 1 / 36 / KEEP | `practice-room-piano-interval1` |
| 320 | `practice-room-piano-duet1` | `practice-room-piano-impressionism1` | 0.598 | 0.30 | 0 / 4 / WATCH_LOW | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-duet1` |
| 321 | `practice-room-piano-duet1` | `practice-room-piano-rhythm1` | 0.597 | 0.27 | 0 / 4 / WATCH_LOW | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-duet1` |
| 322 | `practice-room-arts-high1` | `practice-room-music-portfolio1` | 0.597 | 0.13 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-music-portfolio1` |
| 323 | `practice-room-vocal-accent1` | `practice-room-vocal-technique21` | 0.597 | 0.11 | 1 / 29 / KEEP | 0 / 21 / WATCH | `practice-room-vocal-accent1` |
| 324 | `practice-room-piano-chromatic1` | `practice-room-piano-duet1` | 0.597 | 0.27 | 1 / 28 / KEEP | 0 / 4 / WATCH_LOW | `practice-room-piano-chromatic1` |
| 325 | `practice-room-guitar-pentatonic-modes1` | `practice-room-guitar-theory1` | 0.597 | 0.30 | 1 / 24 / KEEP | 0 / 8 / WATCH_LOW | `practice-room-guitar-pentatonic-modes1` |
| 326 | `practice-room-arts-high1` | `practice-room-indie1` | 0.596 | 0.06 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 3 / WATCH_LOW | `practice-room-indie1` |
| 327 | `practice-room-guitar-arpeggio1` | `practice-room-guitar-pentatonic-modes1` | 0.595 | 0.27 | 1 / 86 / KEEP | 1 / 24 / KEEP | `practice-room-guitar-arpeggio1` |
| 328 | `practice-room-oboe1` | `practice-room-wind1` | 0.594 | 0.13 | 1 / 81 / KEEP | 3 / 34 / KEEP | `practice-room-oboe1` |
| 329 | `practice-room-pop-vocal1` | `practice-room-vocal-cover1` | 0.594 | 0.27 | 0 / 16 / WATCH | 0 / 6 / WATCH_LOW | `practice-room-pop-vocal1` |
| 330 | `practice-room-guitar-mute1` | `practice-room-guitar-pentatonic-modes1` | 0.593 | 0.07 | 0 / 32 / WATCH | 1 / 24 / KEEP | `practice-room-guitar-mute1` |
| 331 | `practice-room-guitar-pentatonic-modes1` | `practice-room-guitar-scale-position1` | 0.593 | 0.14 | 1 / 24 / KEEP | 0 / 20 / WATCH | `practice-room-guitar-pentatonic-modes1` |
| 332 | `practice-room-guitar-pentatonic-modes1` | `practice-room-guitar-scale-pos1` | 0.593 | 0.17 | 1 / 24 / KEEP | 1 / 22 / KEEP | `practice-room-guitar-pentatonic-modes1` |
| 333 | `practice-room-guitar-pentatonic-modes1` | `practice-room-guitar-riff1` | 0.592 | 0.27 | 1 / 24 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-pentatonic-modes1` |
| 334 | `practice-room-piano-duet1` | `practice-room-piano-modulation1` | 0.591 | 0.14 | 0 / 4 / WATCH_LOW | 1 / 30 / KEEP | `practice-room-piano-modulation1` |
| 335 | `practice-room-guitar-left-hand1` | `practice-room-guitar-pentatonic-modes1` | 0.590 | 0.06 | 1 / 18 / KEEP | 1 / 24 / KEEP | `practice-room-guitar-pentatonic-modes1` |
| 336 | `practice-room-guitar-hammer-pull1` | `practice-room-guitar-pentatonic-modes1` | 0.589 | 0.27 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 24 / KEEP | `practice-room-guitar-pentatonic-modes1` |
| 337 | `practice-room-indie1` | `practice-room-music-portfolio1` | 0.589 | 0.06 | 0 / 3 / WATCH_LOW | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-indie1` |
| 338 | `practice-room-guitar-pentatonic-modes1` | `practice-room-guitar-stretch1` | 0.588 | 0.07 | 1 / 24 / KEEP | 2 / 60 / KEEP | `practice-room-guitar-stretch1` |
| 339 | `practice-room-piano-beginner-adult1` | `practice-room-piano-duet1` | 0.587 | 0.25 | 1 / 20 / KEEP | 0 / 4 / WATCH_LOW | `practice-room-piano-beginner-adult1` |
| 340 | `practice-room-piano-duet1` | `practice-room-piano-memorization1` | 0.584 | 0.30 | 0 / 4 / WATCH_LOW | 0 / 6 / WATCH_LOW | `practice-room-piano-memorization1` |
| 341 | `practice-room-piano-jazz-chord1` | `practice-room-piano-jazz-standard1` | 0.583 | 0.40 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 8 / WATCH_LOW | `practice-room-piano-jazz-standard1` |
| 342 | `practice-room-guitar-pentatonic-modes1` | `practice-room-guitar-string1` | 0.583 | 0.25 | 1 / 24 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-pentatonic-modes1` |
| 343 | `practice-room-indie1` | `practice-room-rappers1` | 0.582 | 0.00 | 0 / 3 / WATCH_LOW | 0 / 22 / WATCH | `practice-room-rappers1` |
| 344 | `practice-room-vocal-rasp1` | `practice-room-vocal-rhythm1` | 0.582 | 0.36 | 1 / 7 / KEEP | 1 / 12 / KEEP | `practice-room-vocal-rhythm1` |
| 345 | `practice-room-vocal-live1` | `practice-room-vocal-stage1` | 0.580 | 0.14 | 1 / 9 / KEEP | 0 / 13 / WATCH | `practice-room-vocal-stage1` |
| 346 | `practice-room-arts-high1` | `practice-room-rappers1` | 0.579 | 0.00 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 22 / WATCH | `practice-room-rappers1` |
| 347 | `practice-room-vocal-rhythm1` | `practice-room-vocal-stage1` | 0.576 | 0.17 | 1 / 12 / KEEP | 0 / 13 / WATCH | `practice-room-vocal-stage1` |
| 348 | `practice-room-vocal-live1` | `practice-room-vocal-rasp1` | 0.574 | 0.21 | 1 / 9 / KEEP | 1 / 7 / KEEP | `practice-room-vocal-live1` |
| 349 | `practice-room-vocal-mic1` | `practice-room-vocal-warmup1` | 0.574 | 0.11 | 0 / 19 / WATCH | 0 / 39 / WATCH | `practice-room-vocal-warmup1` |
| 350 | `practice-room-music-portfolio1` | `practice-room-rappers1` | 0.572 | 0.00 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 22 / WATCH | `practice-room-rappers1` |
| 351 | `practice-room-family1` | `practice-room-indie1` | 0.571 | 0.06 | 0 / 6 / WATCH_LOW | 0 / 3 / WATCH_LOW | `practice-room-family1` |
| 352 | `practice-room-couple1` | `practice-room-indie1` | 0.570 | 0.06 | 1 / 15 / KEEP | 0 / 3 / WATCH_LOW | `practice-room-couple1` |
| 353 | `practice-room-arts-high1` | `practice-room-family1` | 0.569 | 0.00 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 6 / WATCH_LOW | `practice-room-family1` |
| 354 | `practice-room-couple1` | `practice-room-family1` | 0.568 | 0.20 | 1 / 15 / KEEP | 0 / 6 / WATCH_LOW | `practice-room-couple1` |
| 355 | `practice-room-arts-high1` | `practice-room-couple1` | 0.567 | 0.00 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 15 / KEEP | `practice-room-couple1` |
| 356 | `practice-room-vocal-accent1` | `practice-room-vocal-rasp1` | 0.564 | 0.20 | 1 / 29 / KEEP | 1 / 7 / KEEP | `practice-room-vocal-accent1` |
| 357 | `practice-room-vocal-stage1` | `practice-room-vocal-technique21` | 0.564 | 0.12 | 0 / 13 / WATCH | 0 / 21 / WATCH | `practice-room-vocal-technique21` |
| 358 | `practice-room-vocal-accent1` | `practice-room-vocal-stage1` | 0.563 | 0.06 | 1 / 29 / KEEP | 0 / 13 / WATCH | `practice-room-vocal-accent1` |
| 359 | `practice-room-family1` | `practice-room-music-portfolio1` | 0.562 | 0.07 | 0 / 6 / WATCH_LOW | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-family1` |
| 360 | `practice-room-family1` | `practice-room-rappers1` | 0.561 | 0.00 | 0 / 6 / WATCH_LOW | 0 / 22 / WATCH | `practice-room-rappers1` |
| 361 | `practice-room-couple1` | `practice-room-music-portfolio1` | 0.559 | 0.06 | 1 / 15 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-couple1` |
| 362 | `practice-room-guitar-barre1` | `practice-room-guitar-capo1` | 0.559 | 0.06 | 0 / 37 / WATCH | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-guitar-barre1` |
| 363 | `practice-room-competition1` | `practice-room-repertoire1` | 0.558 | 0.06 | 0 / 1 / WATCH_LOW | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-competition1` |
| 364 | `practice-room-vocal-rasp1` | `practice-room-vocal-technique21` | 0.558 | 0.11 | 1 / 7 / KEEP | 0 / 21 / WATCH | `practice-room-vocal-technique21` |
| 365 | `practice-room-electric-guitar1` | `practice-room-guitar-memory1` | 0.558 | 0.06 | 5 / 89 / KEEP | 1 / 16 / KEEP | `practice-room-electric-guitar1` |
| 366 | `practice-room-couple1` | `practice-room-rappers1` | 0.557 | 0.00 | 1 / 15 / KEEP | 0 / 22 / WATCH | `practice-room-rappers1` |
| 367 | `practice-room-electric-guitar1` | `practice-room-guitar-whammy1` | 0.546 | 0.00 | 5 / 89 / KEEP | 0 / 38 / WATCH | `practice-room-electric-guitar1` |
| 368 | `practice-room-indie1` | `practice-room-kids1` | 0.545 | 0.21 | 0 / 3 / WATCH_LOW | 0 / 6 / WATCH_LOW | `practice-room-kids1` |
| 369 | `practice-room-vocal-mic1` | `practice-room-vocal-warm-up1` | 0.545 | 0.05 | 0 / 19 / WATCH | 0 / 62 / WATCH | `practice-room-vocal-warm-up1` |
| 370 | `practice-room-electric-guitar1` | `practice-room-guitar-strumming1` | 0.543 | 0.07 | 5 / 89 / KEEP | 1 / 33 / KEEP | `practice-room-electric-guitar1` |
| 371 | `practice-room-arts-high1` | `practice-room-kids1` | 0.543 | 0.06 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 6 / WATCH_LOW | `practice-room-kids1` |
| 372 | `practice-room-electric-guitar1` | `practice-room-guitar-fingering1` | 0.542 | 0.07 | 5 / 89 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-electric-guitar1` |
| 373 | `practice-room-kids1` | `practice-room-music-portfolio1` | 0.542 | 0.07 | 0 / 6 / WATCH_LOW | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-kids1` |
| 374 | `practice-room-electric-guitar1` | `practice-room-guitar-pinch-harmonic1` | 0.542 | 0.07 | 5 / 89 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-electric-guitar1` |
| 375 | `practice-room-piano-jazz-standard1` | `practice-room-piano-jazz1` | 0.537 | 0.50 | 0 / 8 / WATCH_LOW | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-jazz-standard1` |
| 376 | `practice-room-electric-guitar1` | `practice-room-guitar-mute1` | 0.535 | 0.00 | 5 / 89 / KEEP | 0 / 32 / WATCH | `practice-room-electric-guitar1` |
| 377 | `practice-room-electric-guitar1` | `practice-room-guitar-arpeggio1` | 0.535 | 0.15 | 5 / 89 / KEEP | 1 / 86 / KEEP | `practice-room-electric-guitar1` |
| 378 | `practice-room-bass-octave1` | `practice-room-bass-root-fifth1` | 0.534 | 0.06 | 2 / 200 / KEEP | 0 / 19 / WATCH | `practice-room-bass-octave1` |
| 379 | `practice-room-electric-guitar1` | `practice-room-guitar-scale-position1` | 0.533 | 0.00 | 5 / 89 / KEEP | 0 / 20 / WATCH | `practice-room-electric-guitar1` |
| 380 | `practice-room-electric-guitar1` | `practice-room-guitar-left-hand1` | 0.533 | 0.00 | 5 / 89 / KEEP | 1 / 18 / KEEP | `practice-room-electric-guitar1` |
| 381 | `practice-room-electric-guitar1` | `practice-room-guitar-riff1` | 0.533 | 0.07 | 5 / 89 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-electric-guitar1` |
| 382 | `practice-room-electric-guitar1` | `practice-room-guitar-hammer-pull1` | 0.532 | 0.07 | 5 / 89 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-electric-guitar1` |
| 383 | `practice-room-kids1` | `practice-room-rappers1` | 0.532 | 0.06 | 0 / 6 / WATCH_LOW | 0 / 22 / WATCH | `practice-room-rappers1` |
| 384 | `practice-room-electric-guitar1` | `practice-room-guitar-stretch1` | 0.532 | 0.00 | 5 / 89 / KEEP | 2 / 60 / KEEP | `practice-room-electric-guitar1` |
| 385 | `practice-room-electric-guitar1` | `practice-room-guitar-string1` | 0.531 | 0.07 | 5 / 89 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-electric-guitar1` |
| 386 | `practice-room-electric-guitar1` | `practice-room-guitar-scale-pos1` | 0.531 | 0.07 | 5 / 89 / KEEP | 1 / 22 / KEEP | `practice-room-electric-guitar1` |
| 387 | `practice-room-vocal-emotion1` | `practice-room-vocal-rhythm1` | 0.530 | 0.08 | 1 / 41 / KEEP | 1 / 12 / KEEP | `practice-room-vocal-emotion1` |
| 388 | `practice-room-vocal-rasp1` | `practice-room-vocal-stage1` | 0.530 | 0.13 | 1 / 7 / KEEP | 0 / 13 / WATCH | `practice-room-vocal-stage1` |
| 389 | `practice-room-electric-guitar1` | `practice-room-guitar-theory1` | 0.529 | 0.08 | 5 / 89 / KEEP | 0 / 8 / WATCH_LOW | `practice-room-electric-guitar1` |
| 390 | `practice-room-vocal-recording1` | `practice-room-vocal-warmup1` | 0.528 | 0.07 | 1 / 30 / KEEP | 0 / 39 / WATCH | `practice-room-vocal-warmup1` |
| 391 | `practice-room-vocal-gospel1` | `practice-room-vocal-style1` | 0.527 | 0.50 | 0 / 10 / WATCH | 1 / 46 / KEEP | `practice-room-vocal-style1` |
| 392 | `practice-room-bass-octave1` | `practice-room-bass-sustain1` | 0.527 | 0.06 | 2 / 200 / KEEP | 0 / 26 / WATCH | `practice-room-bass-octave1` |
| 393 | `practice-room-vocal-musical-style1` | `practice-room-vocal-musical1` | 0.525 | 0.14 | 0 / 34 / WATCH | 1 / 15 / KEEP | `practice-room-vocal-musical-style1` |
| 394 | `practice-room-family1` | `practice-room-kids1` | 0.524 | 0.07 | 0 / 6 / WATCH_LOW | 0 / 6 / WATCH_LOW | `practice-room-kids1` |
| 395 | `practice-room-vocal-consonant1` | `practice-room-vocal-rhythm1` | 0.524 | 0.23 | 0 / 24 / WATCH | 1 / 12 / KEEP | `practice-room-vocal-consonant1` |
| 396 | `practice-room-piano-jazz-improv1` | `practice-room-piano-jazz-standard1` | 0.523 | 0.44 | 1 / 20 / KEEP | 0 / 8 / WATCH_LOW | `practice-room-piano-jazz-improv1` |
| 397 | `practice-room-vocal-emotion1` | `practice-room-vocal-live1` | 0.521 | 0.07 | 1 / 41 / KEEP | 1 / 9 / KEEP | `practice-room-vocal-emotion1` |
| 398 | `practice-room-couple1` | `practice-room-kids1` | 0.521 | 0.06 | 1 / 15 / KEEP | 0 / 6 / WATCH_LOW | `practice-room-couple1` |
| 399 | `practice-room-vocal-consonant1` | `practice-room-vocal-technique21` | 0.521 | 0.40 | 0 / 24 / WATCH | 0 / 21 / WATCH | `practice-room-vocal-consonant1` |
| 400 | `practice-room-piano-jazz-chord1` | `practice-room-piano-jazz1` | 0.519 | 0.40 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-piano-jazz1` |
| 401 | `practice-room-bass-fingering1` | `practice-room-bass-octave1` | 0.518 | 0.15 | 4 / 127 / KEEP | 2 / 200 / KEEP | `practice-room-bass-octave1` |
| 402 | `practice-room-vocal-recording1` | `practice-room-vocal-warm-up1` | 0.517 | 0.14 | 1 / 30 / KEEP | 0 / 62 / WATCH | `practice-room-vocal-warm-up1` |
| 403 | `practice-room-vocal-consonant1` | `practice-room-vocal-live1` | 0.516 | 0.13 | 0 / 24 / WATCH | 1 / 9 / KEEP | `practice-room-vocal-consonant1` |
| 404 | `practice-room-guitar-chord-change1` | `practice-room-guitar-chord21` | 0.516 | 0.22 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 128 / KEEP | `practice-room-guitar-chord21` |
| 405 | `practice-room-bass-detuning1` | `practice-room-bass-octave1` | 0.516 | 0.17 | 5 / 102 / KEEP | 2 / 200 / KEEP | `practice-room-bass-octave1` |
| 406 | `practice-room-bass-octave1` | `practice-room-bass-root-adv1` | 0.516 | 0.06 | 2 / 200 / KEEP | 0 / 33 / WATCH | `practice-room-bass-octave1` |
| 407 | `practice-room-bass-root-fifth1` | `practice-room-electric-bass1` | 0.515 | 0.13 | 0 / 19 / WATCH | 3 / 148 / KEEP | `practice-room-electric-bass1` |
| 408 | `practice-room-piano-jazz-chord1` | `practice-room-piano-jazz-improv1` | 0.510 | 0.36 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 20 / KEEP | `practice-room-piano-jazz-improv1` |
| 409 | `practice-room-bass-sustain1` | `practice-room-electric-bass1` | 0.510 | 0.06 | 0 / 26 / WATCH | 3 / 148 / KEEP | `practice-room-electric-bass1` |
| 410 | `practice-room-vocal-accent1` | `practice-room-vocal-emotion1` | 0.510 | 0.13 | 1 / 29 / KEEP | 1 / 41 / KEEP | `practice-room-vocal-emotion1` |
| 411 | `practice-room-electric-guitar1` | `practice-room-guitar-pentatonic-modes1` | 0.510 | 0.07 | 5 / 89 / KEEP | 1 / 24 / KEEP | `practice-room-electric-guitar1` |
| 412 | `practice-room-guitar-chord1` | `practice-room-guitar-chord21` | 0.510 | 0.24 | 2 / 37 / KEEP | 1 / 128 / KEEP | `practice-room-guitar-chord21` |
| 413 | `practice-room-cajon1` | `practice-room-percussion1` | 0.509 | 0.50 | 4 / 74 / KEEP | 1 / 62 / KEEP | `practice-room-cajon1` |
| 414 | `practice-room-guitar-chord-prog1` | `practice-room-guitar-chord21` | 0.508 | 0.08 | 1 / 35 / KEEP | 1 / 128 / KEEP | `practice-room-guitar-chord21` |
| 415 | `practice-room-vocal-emotion1` | `practice-room-vocal-technique21` | 0.508 | 0.12 | 1 / 41 / KEEP | 0 / 21 / WATCH | `practice-room-vocal-emotion1` |
| 416 | `practice-room-guitar-chord-adv1` | `practice-room-guitar-chord21` | 0.506 | 0.17 | 0 / 7 / WATCH_LOW | 1 / 128 / KEEP | `practice-room-guitar-chord21` |
| 417 | `practice-room-bass-fingering1` | `practice-room-electric-bass1` | 0.505 | 0.27 | 4 / 127 / KEEP | 3 / 148 / KEEP | `practice-room-electric-bass1` |
| 418 | `practice-room-guitar-chord-arpeggio1` | `practice-room-guitar-chord21` | 0.505 | 0.17 | 2 / 58 / KEEP | 1 / 128 / KEEP | `practice-room-guitar-chord21` |
| 419 | `practice-room-vocal-range1` | `practice-room-vocal-rhythm1` | 0.505 | 0.07 | 1 / 124 / KEEP | 1 / 12 / KEEP | `practice-room-vocal-range1` |
| 420 | `practice-room-vocal-breath1` | `practice-room-vocal-breath21` | 0.504 | 0.07 | 0 / 42 / WATCH | 0 / 11 / WATCH | `practice-room-vocal-breath1` |
| 421 | `practice-room-guitar-chord-melody1` | `practice-room-guitar-chord21` | 0.503 | 0.17 | 1 / 32 / KEEP | 1 / 128 / KEEP | `practice-room-guitar-chord21` |
| 422 | `practice-room-vocal-crooning1` | `practice-room-vocal-gospel1` | 0.502 | 0.07 | 0 / 39 / WATCH | 0 / 10 / WATCH | `practice-room-vocal-crooning1` |
| 423 | `practice-room-vocal-accent1` | `practice-room-vocal-consonant1` | 0.502 | 0.19 | 1 / 29 / KEEP | 0 / 24 / WATCH | `practice-room-vocal-accent1` |
| 424 | `practice-room-bass-root-adv1` | `practice-room-electric-bass1` | 0.502 | 0.06 | 0 / 33 / WATCH | 3 / 148 / KEEP | `practice-room-electric-bass1` |
| 425 | `practice-room-drum-accent1` | `practice-room-drum-snare1` | 0.501 | 0.07 | 0 / 16 / WATCH | 7 / 328 / KEEP | `practice-room-drum-snare1` |
| 426 | `practice-room-vocal-classical1` | `practice-room-vocal-rhythm1` | 0.501 | 0.07 | 0 / 112 / WATCH | 1 / 12 / KEEP | `practice-room-vocal-classical1` |
| 427 | `practice-room-drum-cymbal1` | `practice-room-drum-snare1` | 0.500 | 0.07 | 3 / 126 / KEEP | 7 / 328 / KEEP | `practice-room-drum-snare1` |
| 428 | `practice-room-vocal-color-adv1` | `practice-room-vocal-intonation1` | 0.500 | 0.05 | 0 / 14 / WATCH | 1 / 41 / KEEP | `practice-room-vocal-intonation1` |
| 429 | `practice-room-bass-detuning1` | `practice-room-electric-bass1` | 0.499 | 0.30 | 5 / 102 / KEEP | 3 / 148 / KEEP | `practice-room-electric-bass1` |
| 430 | `practice-room-vocal-live1` | `practice-room-vocal-range1` | 0.499 | 0.06 | 1 / 9 / KEEP | 1 / 124 / KEEP | `practice-room-vocal-range1` |
| 431 | `practice-room-drum-snare1` | `practice-room-drum-speed1` | 0.498 | 0.06 | 7 / 328 / KEEP | 0 / 35 / WATCH | `practice-room-drum-snare1` |
| 432 | `practice-room-drum-snare-tuning1` | `practice-room-drum-snare1` | 0.498 | 0.20 | 1 / 95 / KEEP | 7 / 328 / KEEP | `practice-room-drum-snare1` |
| 433 | `practice-room-vocal-accent1` | `practice-room-vocal-range1` | 0.493 | 0.06 | 1 / 29 / KEEP | 1 / 124 / KEEP | `practice-room-vocal-range1` |
| 434 | `practice-room-vocal-classical1` | `practice-room-vocal-live1` | 0.491 | 0.06 | 0 / 112 / WATCH | 1 / 9 / KEEP | `practice-room-vocal-classical1` |
| 435 | `practice-room-latin-music1` | `practice-room-opera1` | 0.490 | 0.25 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-latin-music1` |
| 436 | `practice-room-vocal-range1` | `practice-room-vocal-technique21` | 0.490 | 0.00 | 1 / 124 / KEEP | 0 / 21 / WATCH | `practice-room-vocal-range1` |
| 437 | `practice-room-vocal-intonation1` | `practice-room-vocal-solfege1` | 0.485 | 0.06 | 1 / 41 / KEEP | 1 / 16 / KEEP | `practice-room-vocal-intonation1` |
| 438 | `practice-room-vocal-emotion1` | `practice-room-vocal-rasp1` | 0.482 | 0.06 | 1 / 41 / KEEP | 1 / 7 / KEEP | `practice-room-vocal-emotion1` |
| 439 | `practice-room-vocal-consonant1` | `practice-room-vocal-emotion1` | 0.481 | 0.13 | 0 / 24 / WATCH | 1 / 41 / KEEP | `practice-room-vocal-emotion1` |
| 440 | `practice-room-vocal-accent1` | `practice-room-vocal-classical1` | 0.480 | 0.06 | 1 / 29 / KEEP | 0 / 112 / WATCH | `practice-room-vocal-classical1` |
| 441 | `practice-room-vocal-emotion1` | `practice-room-vocal-stage1` | 0.479 | 0.07 | 1 / 41 / KEEP | 0 / 13 / WATCH | `practice-room-vocal-emotion1` |
| 442 | `practice-room-vocal-classical1` | `practice-room-vocal-technique21` | 0.478 | 0.00 | 0 / 112 / WATCH | 0 / 21 / WATCH | `practice-room-vocal-classical1` |
| 443 | `practice-room-vocal-consonant1` | `practice-room-vocal-rasp1` | 0.477 | 0.19 | 0 / 24 / WATCH | 1 / 7 / KEEP | `practice-room-vocal-consonant1` |
| 444 | `practice-room-vocal-consonant1` | `practice-room-vocal-stage1` | 0.477 | 0.13 | 0 / 24 / WATCH | 0 / 13 / WATCH | `practice-room-vocal-consonant1` |
| 445 | `practice-room-certification1` | `practice-room-opera1` | 0.475 | 0.00 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-certification1` |
| 446 | `practice-room-opera1` | `practice-room-warm-up1` | 0.474 | 0.00 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 7 / WATCH_LOW | `practice-room-warm-up1` |
| 447 | `practice-room-demo1` | `practice-room-session1` | 0.472 | 0.00 | 0 / 17 / WATCH | 0 / 25 / WATCH | `practice-room-session1` |
| 448 | `practice-room-vocal-range1` | `practice-room-vocal-rasp1` | 0.471 | 0.12 | 1 / 124 / KEEP | 1 / 7 / KEEP | `practice-room-vocal-range1` |
| 449 | `practice-room-vocal-crooning1` | `practice-room-vocal-style1` | 0.469 | 0.15 | 0 / 39 / WATCH | 1 / 46 / KEEP | `practice-room-vocal-style1` |
| 450 | `practice-room-certification1` | `practice-room-church1` | 0.469 | 0.00 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-certification1` |
| 451 | `practice-room-church1` | `practice-room-warm-up1` | 0.468 | 0.06 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 7 / WATCH_LOW | `practice-room-warm-up1` |
| 452 | `practice-room-certification1` | `practice-room-warm-up1` | 0.467 | 0.00 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 7 / WATCH_LOW | `practice-room-warm-up1` |
| 453 | `practice-room-vocal-range1` | `practice-room-vocal-stage1` | 0.466 | 0.00 | 1 / 124 / KEEP | 0 / 13 / WATCH | `practice-room-vocal-range1` |
| 454 | `practice-room-housewife1` | `practice-room-opera1` | 0.466 | 0.00 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-housewife1` |
| 455 | `practice-room-church1` | `practice-room-opera1` | 0.466 | 0.14 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-opera1` |
| 456 | `practice-room-church1` | `practice-room-housewife1` | 0.465 | 0.00 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-housewife1` |
| 457 | `practice-room-certification1` | `practice-room-theory1` | 0.465 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 17 / WATCH | `practice-room-theory1` |
| 458 | `practice-room-livestream1` | `practice-room-stage-manner1` | 0.462 | 0.11 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 19 / KEEP | `practice-room-stage-manner1` |
| 459 | `practice-room-opera1` | `practice-room-theory1` | 0.462 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 17 / WATCH | `practice-room-theory1` |
| 460 | `practice-room-certification1` | `practice-room-housewife1` | 0.462 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-certification1` |
| 461 | `practice-room-certification1` | `practice-room-latin-music1` | 0.461 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-latin-music1` |
| 462 | `practice-room-opera1` | `practice-room-self-study1` | 0.460 | 0.00 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 15 / WATCH | `practice-room-self-study1` |
| 463 | `practice-room-vocal-classical1` | `practice-room-vocal-rasp1` | 0.460 | 0.06 | 0 / 112 / WATCH | 1 / 7 / KEEP | `practice-room-vocal-classical1` |
| 464 | `practice-room-church1` | `practice-room-theory1` | 0.460 | 0.06 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 17 / WATCH | `practice-room-theory1` |
| 465 | `practice-room-church1` | `practice-room-latin-music1` | 0.459 | 0.13 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-latin-music1` |
| 466 | `practice-room-certification1` | `practice-room-journal1` | 0.459 | 0.06 | 0 / 0 / NOINDEX_CANDIDATE | 2 / 41 / KEEP | `practice-room-journal1` |
| 467 | `practice-room-vocal-mix1` | `practice-room-vocal-register1` | 0.459 | 0.25 | 0 / 4 / WATCH_LOW | 2 / 82 / KEEP | `practice-room-vocal-register1` |
| 468 | `practice-room-housewife1` | `practice-room-warm-up1` | 0.458 | 0.00 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 7 / WATCH_LOW | `practice-room-warm-up1` |
| 469 | `practice-room-theory1` | `practice-room-warm-up1` | 0.458 | 0.00 | 0 / 17 / WATCH | 0 / 7 / WATCH_LOW | `practice-room-theory1` |
| 470 | `practice-room-journal1` | `practice-room-opera1` | 0.458 | 0.06 | 2 / 41 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-journal1` |
| 471 | `practice-room-opera1` | `practice-room-stage-manner1` | 0.458 | 0.06 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 19 / KEEP | `practice-room-stage-manner1` |
| 472 | `practice-room-certification1` | `practice-room-self-study1` | 0.457 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 15 / WATCH | `practice-room-self-study1` |
| 473 | `practice-room-church1` | `practice-room-classical1` | 0.457 | 0.00 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 16 / WATCH | `practice-room-classical1` |
| 474 | `practice-room-habit1` | `practice-room-physical1` | 0.456 | 0.00 | 0 / 6 / WATCH_LOW | 0 / 33 / WATCH | `practice-room-physical1` |
| 475 | `practice-room-latin-music1` | `practice-room-warm-up1` | 0.456 | 0.00 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 7 / WATCH_LOW | `practice-room-warm-up1` |
| 476 | `practice-room-genre-switch1` | `practice-room-opera1` | 0.456 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-genre-switch1` |
| 477 | `practice-room-certification1` | `practice-room-classical1` | 0.455 | 0.06 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 16 / WATCH | `practice-room-classical1` |
| 478 | `practice-room-latin-music1` | `practice-room-theory1` | 0.455 | 0.14 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 17 / WATCH | `practice-room-theory1` |
| 479 | `practice-room-church1` | `practice-room-self-study1` | 0.455 | 0.00 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 15 / WATCH | `practice-room-self-study1` |
| 480 | `practice-room-ear-training1` | `practice-room-theory1` | 0.454 | 0.00 | 0 / 30 / WATCH | 0 / 17 / WATCH | `practice-room-ear-training1` |
| 481 | `practice-room-certification1` | `practice-room-ear-training1` | 0.454 | 0.00 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 30 / WATCH | `practice-room-ear-training1` |
| 482 | `practice-room-vocal-classical1` | `practice-room-vocal-stage1` | 0.454 | 0.00 | 0 / 112 / WATCH | 0 / 13 / WATCH | `practice-room-vocal-classical1` |
| 483 | `practice-room-classical1` | `practice-room-opera1` | 0.454 | 0.06 | 0 / 16 / WATCH | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-classical1` |
| 484 | `practice-room-vocal-consonant1` | `practice-room-vocal-range1` | 0.454 | 0.00 | 0 / 24 / WATCH | 1 / 124 / KEEP | `practice-room-vocal-range1` |
| 485 | `practice-room-certification1` | `practice-room-genre-switch1` | 0.453 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-genre-switch1` |
| 486 | `practice-room-housewife1` | `practice-room-theory1` | 0.453 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 17 / WATCH | `practice-room-theory1` |
| 487 | `practice-room-self-study1` | `practice-room-warm-up1` | 0.453 | 0.00 | 0 / 15 / WATCH | 0 / 7 / WATCH_LOW | `practice-room-self-study1` |
| 488 | `practice-room-genre-switch1` | `practice-room-theory1` | 0.453 | 0.06 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 17 / WATCH | `practice-room-theory1` |
| 489 | `practice-room-content-creator1` | `practice-room-opera1` | 0.453 | 0.07 | 1 / 9 / KEEP | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-content-creator1` |
| 490 | `practice-room-housewife1` | `practice-room-latin-music1` | 0.453 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-latin-music1` |
| 491 | `practice-room-ear-training1` | `practice-room-opera1` | 0.453 | 0.00 | 0 / 30 / WATCH | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-ear-training1` |
| 492 | `practice-room-vocal-emotion1` | `practice-room-vocal-range1` | 0.453 | 0.00 | 1 / 41 / KEEP | 1 / 124 / KEEP | `practice-room-vocal-range1` |
| 493 | `practice-room-livestream1` | `practice-room-opera1` | 0.452 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-livestream1` |
| 494 | `practice-room-journal1` | `practice-room-warm-up1` | 0.452 | 0.00 | 2 / 41 / KEEP | 0 / 7 / WATCH_LOW | `practice-room-journal1` |
| 495 | `practice-room-self-study1` | `practice-room-theory1` | 0.452 | 0.06 | 0 / 15 / WATCH | 0 / 17 / WATCH | `practice-room-theory1` |
| 496 | `practice-room-church1` | `practice-room-journal1` | 0.451 | 0.06 | 0 / 0 / NOINDEX_CANDIDATE | 2 / 41 / KEEP | `practice-room-journal1` |
| 497 | `practice-room-content-creator1` | `practice-room-self-study1` | 0.451 | 0.06 | 1 / 9 / KEEP | 0 / 15 / WATCH | `practice-room-self-study1` |
| 498 | `practice-room-chord-melody1` | `practice-room-composition1` | 0.451 | 0.21 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-composition1` |
| 499 | `practice-room-latin-music1` | `practice-room-stage-manner1` | 0.451 | 0.06 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 19 / KEEP | `practice-room-stage-manner1` |
| 500 | `practice-room-certification1` | `practice-room-content-creator1` | 0.451 | 0.07 | 0 / 0 / NOINDEX_CANDIDATE | 1 / 9 / KEEP | `practice-room-content-creator1` |
| 501 | `practice-room-chord-melody1` | `practice-room-harmony1` | 0.450 | 0.23 | 0 / 0 / NOINDEX_CANDIDATE | 0 / 0 / NOINDEX_CANDIDATE | `practice-room-harmony1` |

## cover 계열 판정 (명시 확인)

p1-followups §1-5에서 미해결로 남긴 cover 계열(`cover*` slug 6편: `cover-monetize1`, `cover-song1`, `cover1`, `coverart1`, `coverrecording1`, `coverright1`)의 전 페어 정확 Jaccard:

| slug A | slug B | body J | title sim | J≥0.45 |
|---|---|---|---|---|
| `cover-song1` | `coverrecording1` | 0.134 | 0.29 | 미달 |
| `cover1` | `coverrecording1` | 0.091 | 0.20 | 미달 |
| `cover-song1` | `cover1` | 0.073 | 0.43 | 미달 |
| `cover-monetize1` | `coverrecording1` | 0.050 | 0.00 | 미달 |
| `cover-monetize1` | `cover-song1` | 0.038 | 0.05 | 미달 |
| `cover-monetize1` | `cover1` | 0.036 | 0.05 | 미달 |
| `coverrecording1` | `coverright1` | 0.033 | 0.05 | 미달 |
| `cover-monetize1` | `coverright1` | 0.032 | 0.10 | 미달 |
| `cover-song1` | `coverright1` | 0.032 | 0.10 | 미달 |
| `cover1` | `coverright1` | 0.028 | 0.16 | 미달 |
| `cover-song1` | `coverart1` | 0.025 | 0.17 | 미달 |
| `coverart1` | `coverrecording1` | 0.021 | 0.19 | 미달 |
| `cover1` | `coverart1` | 0.018 | 0.11 | 미달 |
| `cover-monetize1` | `coverart1` | 0.017 | 0.10 | 미달 |
| `coverart1` | `coverright1` | 0.014 | 0.10 | 미달 |

**판정: cover 계열에 본문 수준 근접중복 페어는 없다.** 최고가 `cover-song1`/`coverrecording1` J=0.134로 임계(0.45)에 크게 못 미친다. `cover1`/`coverrecording1`(J=0.091)은 기처리 선례 `album-art1`/`album-artwork1`(J=0.080)과 같은 유형 — **본문은 별개로 작성됐지만 같은 주제를 겨냥한 '주제 변형'**이다. 이런 유형은 본문 Jaccard가 아니라 타이틀·타깃 쿼리 수준(카니벌라이제이션) 분석 대상이며, 통합 여부는 GSC 쿼리 중복 확인 후 별도 판단해야 한다(본 스캔 범위 밖 — titleSim 컬럼이 1차 단서).

## 지역·noindex 관련 페어 — 건수만

- **양측 색인 가능한 지역 카테고리 페어: 90건** (클러스터 3개: 16편 — `practice-room-deogyang1`, `practice-room-dokbawi1`, `practice-room-eungam1`, `practice-room-gupabal1` 외 12편 / 3편 — `practice-room-hapjeong1`, `practice-room-mangwon1`, `practice-room-yeonsinnae1` / 2편 — `jeonbuk1`, `jeonnam1`) — 역/동네 치환 템플릿으로 현재 색인되고 있어 지역 pSEO 정책 트랙에서 별도 검토 필요. 상세는 CSV 참조.
  - 그중 **광역 허브 관여 페어 1건** — 허브는 정보 구조상 유지 대상이라 308 통합 불가, 본문 차별화가 유일한 처방:

| slug A | slug B | body J | GSC A | GSC B |
|---|---|---|---|---|
| `jeonbuk1` | `jeonnam1` | 0.452 | 0 / 14 / WATCH | 1 / 5 / KEEP |
- 한쪽 이상 색인 불가(robots noindex 또는 thin)라 중복 콘텐츠 신호가 없는 페어: **지역 관련 12건 / 그 외 0건** — 통합 불요.

## Sanity check

| 페어 | body J | 판정 |
|---|---|---|
| `album-art1` / `album-artwork1` | 0.080 | redirect 맵 제외(album-art1) → 결과 부재 |
| `cover1` / `coverrecording1` | 0.091 | 스캔 대상, 임계 미달 |

- `album-art1`은 redirect 맵 등재로 스캔에서 제외되어 결과 CSV에 **없음** — 제외 로직 정상 (J는 진단용 out-of-band 계산값).
- `cover1`/`coverrecording1`은 스캔 대상에 포함되어 유사도가 계산됨(위 cover 절 판정 참조).

## 후속 — 통합 실행은 P1

**통합 실행은 P1 — 이 문서는 후보 목록일 뿐이다.** 실제 통합 시에는 페어별로 (1) 검색 의도가 정말 같은 주제 변형인지 수동 확인, (2) GSC 강자 canonical 유지 + 약자 `lib/regionRedirectMap.json` 308 등재, (3) 내부 링크(`internalLinks.ts`·본문 링크)를 canonical로 갱신해 308 홉을 방지한다(album-art1 선례 참조). 템플릿 클러스터(practice-room 계열)는 페어 단위 308이 아니라 클러스터 단위 전략(대표 페이지 통합 또는 본문 차별화) 판단이 선행돼야 한다.

---

*생성: `scripts/scan-near-duplicates.mjs` (2026-07-17, 분석 전용 — 콘텐츠 비수정)*
