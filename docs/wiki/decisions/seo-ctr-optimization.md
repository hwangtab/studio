---
title: SEO CTR 최적화 · 카니벌라이제이션 정리 — 의사결정 타임라인
type: decision
sources:
  - ../diagnosis-2026-05-18.md
  - ../diagnosis-2026-05-21.md
  - ../diagnosis-2026-05-27.md
  - ../diagnosis-2026-05-31.md
updated: 2026-06-25
related:
  - "[[decisions/conversion-cta-system]]"
  - "[[decisions/contact-form-en]]"
---

# SEO CTR 최적화 · 카니벌라이제이션 정리

## 배경

2026-04-20 전후 색인 확산이 시작됐다. 페이지 88%가 이미 1페이지(순위 4~10위)에 올라와 있었고, 랭킹 올리기보다 **CTR 최적화가 핵심 레버**임이 첫 진단(2026-05-18)에서 확인됐다. 동시에 "녹음실" 쿼리에 11개 페이지가 동시 경쟁하는 카니벌라이제이션이 발견됐다.

---

## 타임라인

### 2026-05-18 — 기준선 진단

출처: [../diagnosis-2026-05-18.md](../diagnosis-2026-05-18.md)

**진단:**
- GSC 90일: 1,082페이지, 48,289 노출, 1,207 클릭, 평균 CTR 2.50%, 평균 순위 7.1위
- `practice-room-vocal-diction1`: 순위 7.3위, 437 노출, 클릭 **0건** — 가장 시급
- `songstructure1` vs `song-structure1`: 동일 주제 2페이지가 1,937 노출 분산
- 카니벌라이제이션 11건(녹음실·핑거피킹·보컬 컴프레서·성우 녹음 등)
- `city-ktx-visit` 143페이지, CTR 1.61% — 최악 ROI 클러스터

**결정:**
- P1: 제목·메타 리라이트 집중, `songstructure1` 308 redirect 통합, city-ktx-visit noindex 단계 처리
- `/ko/pricing` 메타 리라이트(CTR 1.21% → 목표 3%)
- 성우 녹음 카니벌라이제이션 의도 분리(서비스 페이지 우선)

---

### 2026-05-21 — 스프린트 후 첫 측정 (43개 커밋)

출처: [../diagnosis-2026-05-21.md](../diagnosis-2026-05-21.md)

**결과:**
- 90일 노출 +62%, 클릭 +70%, CTR 2.50% → 2.63%
- `practice-room-station` 클러스터 클릭 +100%, CTR 6.60% — 최고 ROI 클러스터 확인
- `/ko/pricing` CTR 1.21% → **1.68%** (+0.47pp): 메타 리라이트 효과 확인
- `diction1` 제목 수정됐지만 GSC 미반영, CTR 0% 지속(551 노출)
- `songstructure1` 308 redirect 추가됐지만 GSC 두 페이지 분리 집계 중(크롤 대기)
- 카니벌라이제이션 6쌍 추가 정리, city-ktx-visit 5건 noindex 처리

**결정:**
- `diction1` 스니펫 재최적화 — "딕션이란" + 정의형 구조로 수정 (의도: 단어 의미 검색)
- `noise-reduction1`(노출 876, 순위 15.5→16.4 역행) 내부 링크 추가
- `믹스보이스 내는법` 순위 9.9 → 10위 이내 push(CTR 19%)

---

### 2026-05-27 — 순위 역행 · 폼 오류 긴급 등장

출처: [../diagnosis-2026-05-27.md](../diagnosis-2026-05-27.md)

**결과:**
- 90일 클릭 +27.4%, 노출 +24.6%, CTR 2.69% — 성장 지속
- `noise-reduction1` 순위 **역행 가속**: pos 15.5 → 16.4 → **17.8**, 노출은 876 → 1,126으로 오히려 급증(역설)
- 11~20위 구간 +24페이지 급증 — quick-win 후보풀 확대
- `diction1` Window 2(~6/22) 대기 중, 효과 미측정

**보류 이유:**
- `noise-reduction1` 역행 원인 불명 — 콘텐츠 보강 후 일시 재순위화 or 경쟁 페이지 강화. 내부 링크 추가를 우선 대응으로 결정.

---

### 2026-05-31 — 기술 점검 + 의뢰 전환 집중 전환

출처: [../diagnosis-2026-05-31.md](../diagnosis-2026-05-31.md)

**진단:**
- ep-making1 프로덕션 실측: 렌더링 정상, 에러 없음 — 94.4% 이탈은 과거 데이터 스냅샷
- 영문 폼 submit_error 3건: 커밋 `e7c9e23a97`로 수정 완료, 코드 견고 확인
- StoryCTA 시스템(recording/lesson/practice/production 4타입) 이미 전체 적용 확인

**결정 — 전략 전환:**
- "신규 콘텐츠 대량 생성 비권장" 확정: 스토리 1,571개 포화, 추가는 doorway/duplicate 위험
- **실행 ROI = 이미 순위·CTR 좋은 의뢰 의도 페이지의 미세 SEO**
- `voice-acting` SEO title 재설계: "성우 녹음실 —"로 시작 + "연신내 성우 녹음실" description 명시(CTR 26.67%, pos 34 → 상위 목표)
- `vocal-diction1` title: 카니벌라이제이션 방지를 위해 practice-room-vocal-diction1("딕션" 전담)과 명확히 분리
- GA4 key event 설정(콘솔 작업) → 측정 정상화 1순위

---

## 현재 상태 (2026-05-31 기준)

| 항목 | 상태 | 결과 |
|---|---|---|
| `/ko/pricing` 메타 리라이트 | ✅ 완료 | CTR 1.21% → 1.68% |
| `songstructure1` 308 redirect | ✅ 완료 | GSC 통합 크롤 대기 |
| city-ktx-visit noindex | ✅ 5건 처리, 94건 잔여 | 단계 처리 계속 |
| 카니벌라이제이션 정리 | ✅ 11건 → ~7건 감소 | 핑거피킹 5개 미처리 |
| `noise-reduction1` 역행 | ⚠️ 원인 미확정 | 내부 링크 추가 후 모니터링 |
| `diction1` 제목 최적화 | ⏳ Window 2(~6/22) 대기 | 효과 미측정 |
| `성우 녹음실` title 재설계 | ✅ 완료 | pos 34 → 상위 목표 |
| GA4 key event 설정 | ❌ 콘솔 미설정 | 전환 집계 안 됨 |

---

## 핵심 시사점

1. **메타 리라이트 효과는 빠르다**: `/ko/pricing` 3일 만에 CTR +0.47pp 확인.
2. **카니벌라이제이션 정리 효과는 느리다**: 308 redirect 후 GSC 반영에 2~4주 소요.
3. **신규 콘텐츠보다 미세 SEO**: 포화된 pSEO 환경에서 ROI는 기존 의뢰 의도 페이지 최적화.
4. **`noise-reduction1` 역설**: 노출 급증 + 순위 역행은 검색량 증가로 경쟁이 커진 신호일 수 있음 — 콘텐츠 품질 심화 필요.
