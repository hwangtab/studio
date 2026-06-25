---
title: 전환율 · CTA 시스템 — 의사결정 타임라인
type: decision
sources:
  - ../diagnosis-2026-05-18.md
  - ../diagnosis-2026-05-21.md
  - ../diagnosis-2026-05-27.md
  - ../diagnosis-2026-05-31.md
updated: 2026-06-25
related:
  - "[[decisions/seo-ctr-optimization]]"
  - "[[decisions/contact-form-en]]"
---

# 전환율 · CTA 시스템

## 배경

2026-05-18 진단에서 90일 세션 2,640회에 리드 이벤트 **10건(전환율 0.38%)**이 확인됐다. CTA가 작동하는 페이지는 `/ko/practice-room`과 `/ko` 두 곳뿐이었고, 세션 상위 스토리 페이지들은 트래픽을 받으면서 전환 0건이었다. 이후 CTA 삽입 → 이벤트 추적 강화 → GA4 측정 정상화 순으로 작업이 진행됐다.

---

## 타임라인

### 2026-05-18 — 전환 붕괴 진단

출처: [../diagnosis-2026-05-18.md](../diagnosis-2026-05-18.md)

**진단:**
- 리드 이벤트 10건: 카카오톡 7건, 전화 1건, 폼 2건
- CTA 작동 페이지: `/ko/practice-room`(3건), `/ko`(2건) 사실상 2개뿐
- 세션 상위 스토리 (`daw-choice1` 81세션, `practice-room-startup1` 47세션 등) 리드 0건
- `ep-making1`: 52세션, 이탈률 96.2%, 체류 5.3초 — 콘텐츠 불일치 또는 로드 오류 의심

**결정:**
- P1-1: 스토리 상위 페이지 하단 CTA 삽입 (카카오 링크 박스)
- 목표: 전환율 0.4% → 2%+, 월 리드 10건 → 50건+

---

### 2026-05-21 — CTA 삽입 후 첫 효과 + 신규 이슈

출처: [../diagnosis-2026-05-21.md](../diagnosis-2026-05-21.md)

**결과:**
- CTA 삽입(커밋 `61d4802f65`) → 리드 이벤트 10 → **18건** (+80%)
- `/ko/lesson`, `/en/lesson`, `/en/contact`에서 신규 리드 발생 — CTA 삽입 효과 확인
- 전환율 0.38% → **0.59%** (+0.21pp 개선). 목표 2%까지 3.4배 필요
- GA4 봇 필터링 완료(커밋 `8a6a308807`) → GSC 클릭 대비 GA4 세션 갭 65.8% → 97.3%로 정상화
- `form_field_error` 3건 신규 감지 — 전화번호 형식 오류 의심

**문제:**
- 스토리 CTA 위치/문구가 실제 전환을 만들지 못함(daw-choice1 89세션 0리드 등)
- `ep-making1` bounce 96.2% 지속

---

### 2026-05-27 — 폼 오류 급증 + 전환율 하락

출처: [../diagnosis-2026-05-27.md](../diagnosis-2026-05-27.md)

**결과:**
- 리드 이벤트 21건, 전환율 **0.54%** (직전 0.59%에서 하락) — 세션 +26.4% 대비 리드 +16.7%만 증가
- `/en/contact` 위기: `form_field_error` 10건 + `submit_error` 3건, 성공 0건
- ChatGPT → `/en/contact` 23세션 bounce 95.7% + 폼 오류 = 영어권 잠재 고객 전부 이탈

**결정:**
- P1-1: `/en/contact` 폼 오류 수정 최우선
- P1-4: ChatGPT 유입 `/ko/pricing` bounce 100% — 가격 정보 상단 인라인 배치
- 스토리 CTA 위치·문구 A/B 개선 검토

---

### 2026-05-31 — 폼 정상 확인 + 전략 재정비

출처: [../diagnosis-2026-05-31.md](../diagnosis-2026-05-31.md)

**기술 점검 결과:**
- `/en/contact` 폼: `send-email` API·validation 견고 확인, 커밋 `e7c9e23a97`로 submit_error 수정 완료
- StoryCTA 시스템(recording/lesson/practice/production 4타입 카테고리별 자동 삽입) 이미 전체 적용 확인
- `ep-making1` 이탈률: 프로덕션 실측 정상 렌더링 → 과거 데이터 스냅샷으로 확정, 현재 기술 이슈 없음

**GA4 측정 누수 확인:**
- 코드는 `lead_click_kakao`·`lead_click_phone`·`lead_submit_success` 이벤트를 gtag로 전송 중(`utils/analytics.ts`)
- GA4 콘솔에서 **주요 이벤트 미표시** → conversions 컬럼 0
- `lead_click_kakao` 17건이 실질 전환임에도 GA4 conversion 미집계 → 모든 전환 데이터 왜곡

**결정 — GA4 측정 정상화를 1순위로 격상:**
1. GA4 콘솔 → 관리 → 이벤트 → `lead_click_kakao`, `lead_click_phone`, `lead_submit_success` 주요 이벤트 표시
2. 24~48시간 후 보고서에 전환 집계 시작
3. 탐색 → 유입경로 탐색으로 `lead_form_start → lead_submit_success` 퍼널 생성

**트래픽 소스 인사이트:**
- `m.search.naver.com` 108세션, 이탈률 **28.7%** — 전체 소스 중 의도 품질 최강
- 네이버 스마트플레이스 최적화가 다음 레버리지로 확인

---

## 현재 상태 (2026-05-31 기준)

| 항목 | 상태 | 수치 |
|---|---|---|
| 리드 이벤트 | 21건/90일 | 전환율 0.54% |
| StoryCTA 시스템 | ✅ 전체 적용 | 4타입 카테고리별 자동 삽입 |
| GA4 봇 필터링 | ✅ 완료 | 측정 신뢰도 정상화 |
| GA4 key event 설정 | ❌ 콘솔 미설정 | **즉시 필요** |
| `/en/contact` 폼 | ✅ 정상 확인 | 전체 파이프라인 작동 |
| `ep-making1` 이탈률 | ✅ 기술 이슈 없음 | 과거 데이터 스냅샷 |
| 네이버 스마트플레이스 | ❌ 미최적화 | 다음 레버리지 |

---

## 핵심 시사점

1. **CTA 삽입 = 즉각 리드 증가**: 10건 → 18건(+80%)은 시스템이 작동한다는 증거.
2. **측정 없으면 판단 없다**: `lead_click_kakao` 17건이 conversion 미집계 상태로 3주 이상 운영됨. GA4 key event 설정이 모든 최적화 판단의 전제.
3. **스토리 CTA 전환 0 = 위치·문구 문제**: 시스템은 있지만 daw-choice1(89세션 0리드) 등 실제 전환 미발생. CTA 위치 및 문구 A/B 개선 필요.
4. **네이버 모바일이 숨은 보석**: 이탈률 28.7% = 의도 가장 명확한 트래픽. 네이버 플레이스 최적화가 다음 전환 레버.
