# 영어 컨택폼 진단 (Task A1) — 2026-06-16

## 결론: 영어 컨택폼은 정상 작동한다. 초기 가설("사실상 고장") 반증됨.

Playwright로 프로덕션 `https://studionol.co.kr/en/contact` 에 실제 테스트 문의를 제출해 확인.

### 재현 절차
1. `/en/contact` 접속 → 폼 렌더링 정상(placeholder도 A2 수정본 `e.g., +82 10-1234-5678…` 반영 확인 = 배포 완료)
2. Name=`Diagnostic Test`, Email=`hwangtab@gmail.com`, Message=진단용 영문(10자 이상), Phone 비움(선택)
3. 페이지 로드 후 충분히 대기(>3초, 봇 판정 회피) 후 "Send Email Inquiry" 클릭

### 관측 결과
- `POST https://studionol.co.kr/api/contact/send-email` → **200 OK**
- 제출 직후 폼 4개 필드 전부 초기화됨 → 코드상 `response.ok && result.success` 경로에서만 `setFormData(EMPTY_FORM_DATA)` 실행([utils/useContactForm.ts:242-250](../../utils/useContactForm.ts#L242-L250)) → `lead_submit_success` 발사 조건 충족
- 콘솔 에러 0
- CSRF origin 검증 통과(studionol.co.kr는 allowlist 기본값에 포함) → **403 아님**

## 후속 판단

| 항목 | 판정 |
|---|---|
| **Task A3 (CSRF origin allowlist 수정)** | **불필요 — 취소.** origin 검증 정상 통과(200). 추측으로 코드 고치지 않은 measure-first 원칙이 적중. |
| **GA4 field_error 12 / submit_error 3** | 시스템적 차단이 아니라 **실사용자 마찰**(이름에 숫자 입력 시 거부, 메시지 10자 미만, 전화 형식, 일시적 rate limit/네트워크 등)로 추정. error_type 차원 미등록이라 분해 불가. |
| **진짜 레버** | ChatGPT→`/en/contact` 33세션 **bounce 75.8%** = 폼 버그가 아니라 **AI 유입 방문자가 폼을 시작하지도 않고 이탈**하는 랜딩/의도 문제. |

## 권장 후속(우선순위)

1. **GA4 맞춤측정기준 등록**(이벤트 범위): `error_type`, `status_code`, `first_error_field`. 코드는 이미 전송 중([useContactForm.ts:266-309](../../utils/useContactForm.ts#L266-L309)). 등록만 하면 이후 12건 field_error의 실제 사유가 GA4에 분해되어 보임 → 그때 진짜 마찰 지점만 핀포인트 수정.
2. **이름 검증 완화 검토**: NAME_PATTERN(`/^[\p{L}\p{M}\s'.,-]+$/u`)이 숫자를 거부. 외국인이 이름/닉네임에 숫자를 넣으면 field_error. 닉네임 허용이 필요하면 패턴에 `\d` 추가 검토([utils/contactValidation.ts:38](../../utils/contactValidation.ts#L38)). (실측 데이터로 확인 후 결정 권장)
3. **`/en/contact` 랜딩 전환 개선**: AI 유입 75.8% 이탈 대응 — 폼보다 카카오톡 CTA가 이미 상단이나, AI 방문자가 원하는 정보(가격·영어 응대·원격 가능 여부)를 폼 위에 더 명확히. (page-cro 영역)

## 교차검증 (확정)
- 테스트 문의가 hwangtab@gmail.com 수신함에 **실제 도착 확인됨**(이름 "Diagnostic Test", 본문 "Please ignore"). → POST 200이 봇 quiet-pass가 아니라 **Resend 실제 발송**이었음이 확정. 폼 → API → 검증 → Resend → 메일 수신까지 **전체 파이프라인 정상**. 영어 컨택폼은 발송까지 완전 작동.
