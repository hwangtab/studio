# GA4 주요 이벤트(전환) 설정 가이드

> **목적**: GA4 conversion이 0인 문제 해결 — `lead_click_kakao`(실질 전환)가 key event로 등록되지 않음.
> **대상**: GA4 관리자 권한이 있는 사용자
> **소요**: 5분 (콘솔 작업, 코드 변경 불필요)

---

## 현재 상태

- GA4 속성에 90일간 `lead_click_kakao` 17건이 전송 중 (`utils/analytics.ts` 코드 확인 완료)
- GA4 "주요 이벤트(Mark as key event)" 미설정으로 인해 conversion = 0
- `lead_form_start` → `lead_submit_success` 퍼널도 측정 불가

---

## 설정 절차 (GA4 콘솔)

### 1단계: GA4 속성 접속

Google Analytics → 관리(Admin, 톱니바퀴 아이콘) → 속성 컬럼 하단

### 2단계: 이벤트 목록 열기

**속성(Property)** 컬럼 → **이벤트(Events)** 클릭

### 3단계: 주요 이벤트로 표시

아래 3개 이벤트를 순서대로 찾아 **"주요 이벤트로 표시(Mark as key event)"** 토글 ON:

| 이벤트명 | 우선순위 | 설명 |
|---------|---------|------|
| `lead_click_kakao` | **최우선** | 카카오톡 채널 클릭 = 실질 전환의 100% |
| `lead_click_phone` | 차순위 | 전화번호 클릭 |
| `lead_submit_success` | 차순위 | 문의 폼 제출 성공 |

> ⚠️ **`micro_click_service/contact`는 key event로 설정하지 말 것**
> 이유: `micro_click_service` 이벤트는 스토리 본문 내 서비스 카드 클릭을 추적하는데, 이는 '관심'이지 '문의'가 아닙니다. 이 이벤트를 key event로 올리면 리드 데이터가 오염됩니다(p1-followups의 가드레일).

### 4단계: 확인

24~48시간 후 보고서에 전환 집계 시작. 실시간 보고서에서 카카오 버튼 클릭 → `lead_click_kakao` 즉시 표시 확인.

---

## 검증 방법

1. GA4 → **실시간(Realtime)** 보고서 열기
2. 사이트에서 카카오톡 상담 버튼 클릭
3. 실시간 보고서에 `lead_click_kakao` 이벤트가 표시되는지 확인
4. **탐색(Explore)** → 유입경로 탐색(Funnel exploration)으로 `lead_form_start → lead_submit_success` 퍼널 생성

---

## 영향

| 항목 | 설정 전 | 설정 후 (24~48h) |
|------|--------|----------------|
| conversions 컬럼 | 0 | 양수 표시 시작 |
| 전환율 보고 | 불가 | 전환율·ROI 계산 가능 |
| GSC·GA4 교차 분석 | 전환 경로 불명 | 어떤 페이지가 전환에 기여하는지 추적 가능 |

---

## 참조

- GA4 key event 문서: https://support.google.com/analytics/answer/9267571
- `utils/analytics.ts` — 이미 이벤트를 gtag로 전송 중 (코드 변경 불필요)
- `docs/diagnosis-2026-05-31.md` §3 — 동일 권고 (2026-05-31)