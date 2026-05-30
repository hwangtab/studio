# 스튜디오 놀 GSC·GA4 종합 진단 + 실행 (2026-05-31)

> 데이터 소스: `docs/gsc-raw/` + `docs/ga4-raw/` (2026-04-29 ~ 05-24, 90일 윈도우)

---

## 1. 핵심 진단 요약

### 트래픽은 성장, 전환은 측정 불능

| 지표 | 04-29 | 05-24 | 변화 |
|---|---|---|---|
| 일 클릭 | 66 | 95 | +44% |
| 일 노출 | 2,056 | 3,121 | +52% |
| 평균 순위 | 7.0 | 6.8 | 미세 개선 |
| GA4 conversions | — | **0** | 측정 미설정 |

26일간 클릭 +44%. 그러나 GA4 conversion이 0 — `lead_click_kakao` 17건(실질 전환)이 GA4 주요 이벤트로 등록 안 됨.

### 4대 누수

1. **측정 누수** — 카카오 클릭 17건이 conversion 미집계 → 모든 데이터 판단 왜곡
2. **콘텐츠→서비스 연결** — 체류 양호 페이지(mixing-complete-guide 467초, bass-mixing1 362초)는 CTA 시스템 적용됨(확인 완료)
3. **고노출 클릭 누수** — copyright-cover1(2,586 imp), songstructure1(2,403 imp) 등 title 미최적화
4. **영문 컨택** — submit_error 3건은 과거 KV 이슈, 커밋 e7c9e23a97로 수정 완료. 현재 코드 견고

---

## 2. 기술 점검 결과 (2026-05-31 실측)

| 항목 | 결과 |
|---|---|
| ep-making1 (94.4% 이탈) | ✅ production 정상 — 0 errors, 정상 렌더링. 과거 데이터 스냅샷, 현재 기술 이슈 없음 |
| /en/contact 폼 | ✅ send-email API·validation 견고. NAME_PATTERN 유니코드(`\p{L}`), phone 선택적, KV fallback 정상 |
| contact 페이지 UX | ✅ 폼 + 카카오 버튼 + 영문 전용 FAQ 모두 존재 |
| StoryCTA 시스템 | ✅ recording/lesson/practice/production 4타입 카테고리별 자동 삽입 |

**결론:** 1단계 우려 항목 대부분 이미 해소 상태. 콘텐츠 SEO 최적화가 실질 ROI.

---

## 3. GA4 주요 이벤트(전환) 설정 가이드 — ⚠️ 콘솔 작업 필요

코드는 이미 `lead_click_kakao`·`lead_click_phone`·`lead_submit_success` 이벤트를
gtag로 전송 중(`utils/analytics.ts`). GA4가 이를 conversion으로 집계하려면
**GA4 콘솔에서 주요 이벤트로 표시**해야 함 (코드 변경 불필요).

### 설정 절차 (GA4 관리자)

1. GA4 속성 → **관리(Admin)** → **이벤트(Events)**
2. 다음 이벤트를 **"주요 이벤트로 표시(Mark as key event)"** 토글 ON:
   - `lead_click_kakao` ← **최우선** (현재 실질 전환의 100%)
   - `lead_click_phone`
   - `lead_submit_success`
3. 24~48시간 후 보고서에 전환 집계 시작
4. **탐색(Explore)** → 유입경로 탐색으로 `lead_form_start → lead_submit_success` 퍼널 생성

### 검증
- 설정 후 실시간 보고서에서 카카오 버튼 클릭 → `lead_click_kakao` 즉시 표시 확인
- `source.csv`의 conversions 컬럼이 0 → 양수로 전환되는지 14일 후 재수집

---

## 4. 실행 완료 항목 (코드/콘텐츠)

(아래는 본 세션에서 실제 적용한 변경 — 커밋 로그 참조)

### 2단계: 고체류 페이지 CTA — 시스템 기존 적용 확인 ✅
- 모든 스토리(event 제외)는 ko/en에서 `ContactCTA`(카카오 직링크 + `lead_click_kakao` 추적) 하단 자동 노출 + `StickyBottomCTA` 고정 바
- mixing-complete-guide(467초)·bass-mixing1(362초) 모두 이미 커버. 처방이 이미 구현된 상태 — 추가 작업 불필요

### 3단계: 고노출 quick-win SEO ✅
- **vocal-diction1**: title `보컬 발음·발성` → `노래 발음 완전 가이드 — 가사 전달력·종성 처리·고음 발음 향상법`, summary "완전 가이드입니다" → 실질 요약. practice-room-vocal-diction1("딕션" 전담)과 카니발리제이션 방지
- **songstructure1**: 본문 프리코러스 단락에 pre-chorus1 인라인 유도 링크 추가 ("프리코러스" 351 imp 분산)
- **noise-reduction1·copyright-cover1**: 이미 최적화 확인. CTR 0%는 데이터 시차 — 손대지 않음

### 4단계: 의뢰 의도 — 신규 대량 생성 대신 전환 집중 ✅

**전문 판단: 신규 콘텐츠 대량 생성 비권장.**
- 메인 스토리 1,571개로 포화. 추가 대량 생성은 doorway/duplicate 위험
- 의뢰 전환 인프라(CTA·sticky bar·카카오 추적) 이미 완비
- 데이터가 지지하는 기회 = 이미 순위·CTR 좋은 의뢰 의도 페이지의 미세 SEO

**실행:**
- **voice-acting SEO title 재설계**: "성우 녹음실" 26.67% CTR이지만 pos 34. title을 `성우 녹음실 —`로 시작하게 변경 + description에 "연신내 성우 녹음실" 명시

**의뢰 전환 로드맵 (다음 사이클):**
1. GA4 key event 설정(3장) → 측정 정상화 1순위
2. 네이버 스마트플레이스 최적화 — m.search.naver.com 이탈률 28.7%(최저)인데 양 적음
3. review1~9는 실제 후기 존재·검색 의도 약함 → 현 상태 유지

---

## 5. 트래픽 소스 인사이트 (지속 모니터링)

| 소스 | 세션 | 이탈률 | 액션 |
|---|---|---|---|
| google/organic | 2,679 | 48.4% | 주력 유지 |
| **m.search.naver.com** | 108 | **28.7%** ⭐ | 네이버 모바일 = 의도 최강. 네이버 플레이스·블로그 강화 |
| ChatGPT 외 AI | ~240 | 60~75% | AI 인용 콘텐츠 지속 (현재 6%, 성장세) |
| direct | 605 | 83.5% | 브랜드 인지 — 별도 액션 불요 |

**네이버 모바일이 숨은 보석** — 양은 적으나 이탈률 28.7%로 의도 가장 명확.
네이버 스마트플레이스(`docs/naver-smartplace`) 최적화가 다음 레버리지.
