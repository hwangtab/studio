---
title: 영문 컨택폼 오류 조사 → 정상 확인
type: decision
sources:
  - ../diagnosis-2026-05-21.md
  - ../diagnosis-2026-05-27.md
  - ../diagnosis-2026-05-31.md
  - ../diagnosis-2026-06-16-contact-form.md
updated: 2026-06-25
related:
  - "[[decisions/conversion-cta-system]]"
---

# 영문 컨택폼 오류 조사 → 정상 확인

## 배경

2026-05-21 진단에서 `/en/contact`에 `form_field_error` 3건이 처음 감지됐다. 이후 2026-05-27에 10건으로 급증(+ `submit_error` 3건)하며 "영문 폼이 사실상 고장"이라는 가설이 제기됐다. 2026-06-16 Playwright 실측으로 **폼이 정상 작동한다**는 사실이 확인됐고, 오류의 실체는 시스템 버그가 아닌 실사용자 마찰임이 밝혀졌다.

---

## 타임라인

### 2026-05-21 — `form_field_error` 최초 감지

출처: [../diagnosis-2026-05-21.md](../diagnosis-2026-05-21.md)

- `lead_form_field_error` 2건(`/ko/contact`), 1건(`/en/contact`) — 신규 이벤트 첫 등장
- 전화번호 입력 형식 오류 가능성으로 추정
- 결정: 필드 placeholder/validation 개선 검토

---

### 2026-05-27 — 오류 급증, 긴급 이슈로 격상

출처: [../diagnosis-2026-05-27.md](../diagnosis-2026-05-27.md)

**관측:**
- `/en/contact` `form_field_error` **10건** (전체 리드 이벤트 중 최다)
- `/en/contact` `submit_error` **3건** — 신규
- `/en/contact` 폼 성공 0건
- ChatGPT → `/en/contact` 23세션 bounce 95.7%

**가설:** "영문 폼 자체가 작동 불능 상태일 가능성 높음"

**결정:** P1-1: 영문 폼 validation 긴급 수정

---

### 2026-05-31 — 기술 점검, submit_error 수정

출처: [../diagnosis-2026-05-31.md](../diagnosis-2026-05-31.md)

- `/en/contact` 폼: `send-email` API·validation 코드 검토 → 견고 확인
- `NAME_PATTERN` 유니코드(`\p{L}`), phone 선택적, KV fallback 정상
- `submit_error` 3건은 과거 KV 이슈 → 커밋 `e7c9e23a97`로 수정 완료
- 결론: "코드는 이미 견고. field_error는 사용자 입력 마찰로 추정"

---

### 2026-06-16 — Playwright 실측, 정상 확인 (최종)

출처: [../diagnosis-2026-06-16-contact-form.md](../diagnosis-2026-06-16-contact-form.md)

**실측 방법:** Playwright로 프로덕션 `https://studionol.co.kr/en/contact` 직접 제출

**결과:**
- `POST /api/contact/send-email` → **200 OK**
- 제출 후 폼 4개 필드 초기화 확인 → `lead_submit_success` 발사 조건 충족
- 콘솔 에러 0
- CSRF origin 검증 정상 통과(403 없음)
- 테스트 문의가 hwangtab@gmail.com 수신함에 **실제 도착** — Resend 실제 발송 확정

**결론: "사실상 고장" 가설 반증. 폼 → API → 검증 → Resend → 메일 수신까지 전체 파이프라인 정상.**

---

## 오류의 실체 (재해석)

| 항목 | 판정 |
|---|---|
| `form_field_error` 12건 | 시스템 차단이 아닌 **실사용자 마찰** — 이름에 숫자 입력 시 `NAME_PATTERN` 거부, 메시지 10자 미만, 전화 형식, 일시적 rate limit 등 |
| `submit_error` 3건 | 과거 KV 이슈 → 커밋 `e7c9e23a97` 수정 완료 |
| ChatGPT bounce 75.8% | 폼 버그가 아닌 **랜딩 의도 문제** — AI 유입 방문자가 폼을 시작하지도 않고 이탈 |
| Task A3 (CSRF allowlist 수정) | **불필요 — 취소** — origin 검증 정상 통과 확인 |

---

## 후속 결정 (2026-06-16)

1. **GA4 맞춤측정기준 등록**: `error_type`, `status_code`, `first_error_field` — 코드는 이미 전송 중(`utils/useContactForm.ts`), 콘솔 등록만 하면 field_error 12건 실사유 분해 가능
2. **`NAME_PATTERN` 완화 검토**: `\d` 추가로 숫자 포함 이름/닉네임 허용 — 실측 데이터로 확인 후 결정 권장 (`utils/contactValidation.ts:38`)
3. **`/en/contact` 랜딩 전환 개선**: AI 유입 75.8% 이탈 대응 — 폼 위에 가격·영어 응대 가능 여부·원격 서비스 범위를 더 명확히 (page-cro 영역)

---

## 교훈

**"measure-first, 추측으로 코드 고치지 않는다"** 원칙이 적중했다. 가설("폼 고장") 기반 코드 수정보다 Playwright 실측을 먼저 진행한 결과 불필요한 작업(Task A3)을 취소하고 진짜 문제(랜딩 의도 미스매치)를 발견했다.
