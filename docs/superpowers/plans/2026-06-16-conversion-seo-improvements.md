# 전환·SEO 개선 1차 구현 명세 (2026-06-16)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (권장) 또는 superpowers:executing-plans 로 task 단위 실행. 각 step은 체크박스(`- [ ]`)로 추적.

**Goal:** GSC·GA4 분석에서 확인된 "유입은 느는데 클릭·전환이 새는" 3대 누수(영어 컨택폼 실패, copyright-cover 메타 CTR 이상, noise-reduction 키워드 미랭킹)를 데이터 근거로 막는다.

**Architecture:** 진단 우선(measure-first) 원칙. 근본원인이 불확실한 컨택폼은 ① GA4 차원 등록 + 실측 → ② 확정된 원인에만 수정 적용. SEO는 메타/콘텐츠를 수정한 뒤 2~3주 후 GSC 재측정으로 검증.

**Tech Stack:** Next.js 15 Pages Router, react-i18next(7개 언어), Jest, GA4 Data API(`scripts/ga4-fetch.mjs`), GSC(`scripts/gsc-fetch-detail.mjs`), 마크다운 스토리(`content/stories/`).

---

## 분석 근거 (이 명세가 푸는 사실)

| 항목 | 데이터 | 출처 |
|---|---|---|
| 영어 컨택폼 실패 | `/en/contact`: field_error 12, submit_error 3, success 1 / ChatGPT→/en/contact 33세션 bounce 75.8% | [ga4-raw/events.csv](../../ga4-raw/events.csv), [llm_referrers.csv](../../ga4-raw/llm_referrers.csv) |
| copyright-cover1 CTR 이상 | 노출 6,037 · 평균순위 5.1인데 CTR 1.31% (pos5에선 5~7% 기대) | [gsc-raw/page-all.csv](../../gsc-raw/page-all.csv) |
| noise-reduction1 미랭킹 | "배경 잡음 제거" 501노출 **pos30** clk0, "잡음 제거" 136노출 pos40 | [gsc-raw/page-query.csv](../../gsc-raw/page-query.csv) |
| 전체 CTR 침식 | 한 달간 노출 +40%(3,400→4,700), 클릭 정체, CTR 3.2%→2.0% | [gsc-raw/trend.csv](../../gsc-raw/trend.csv) |

**진단 정정(중요):** `/ko/pricing` 의 CTR 0.67%는 메타 문제가 **아님**. 상위 노출 쿼리가 브랜드명 "스튜디오 놀"(27노출 pos1.1, 클릭은 홈으로 감)이고, 상업 가격 쿼리("녹음실 대여 비용" 등)는 pos22~49로 사실상 미랭킹. → 메타 재작성이 아니라 내부링크·랭킹 작업 대상. 이 명세 Phase C에서 다룸.

**스코프 제외(별도 추적):** 네이버 블로그 원고 게시(콘텐츠 운영), 군소 다국어(zh/uz/th/vi/es) 페이지 정리, AI/GEO 구조화는 코드 작업이 아니므로 본 명세에서 제외하고 로드맵으로 별도 관리.

---

## File Structure

| 파일 | 책임 | Phase |
|---|---|---|
| `public/locales/{en,zh,es,vi,th,uz}/common.json` | 컨택폼 placeholder 국제화 | A |
| `pages/api/contact/send-email.ts` | CSRF origin allowlist (원인 확정 시) | A |
| `tests/api/contact/send-email.test.ts` | origin 허용/차단 회귀 테스트 | A |
| `docs/diagnosis-2026-06-16-contact-form.md` | GA4 실측 진단 기록(신규) | A |
| `content/stories/copyright-cover1.md` | frontmatter title/summary 재작성 | B |
| `content/stories/noise-reduction1.md` | "배경 잡음 제거" 인텐트 섹션 + 내부링크 | B |
| `content/stories/recording-price1.md`, `practice-room` 관련 | 가격 페이지 내부링크 보강 | C |

---

# Phase A — 영어 컨택폼 전환 복구 (P0)

근본원인 미확정. **추측으로 코드를 고치지 않는다.** 먼저 실측한다.

## Task A1: GA4 실패 원인 실측 (진단)

`lead_submit_error` 이벤트는 이미 `error_type`(server_validation/forbidden/tooMany/timeout/network/unknown_status)와 `status_code` 파라미터를 전송 중([utils/useContactForm.ts:266-309](../../../utils/useContactForm.ts#L266-L309)). 그러나 GA4 export에 이 차원이 없어 원인 미상. 두 경로로 동시 확인한다.

**Files:**
- Create: `docs/diagnosis-2026-06-16-contact-form.md`

- [ ] **Step 1: 프로덕션에서 즉시 재현**

브라우저로 `https://studionol.co.kr/en/contact` 접속 → DevTools Network 열고 폼 정상 입력 후 제출. `POST /api/contact/send-email` 의 **응답 status와 body**를 기록.
- 200 → 정상(폼은 작동, 문제는 트래픽/랜딩 측)
- 403 `{message:"Forbidden"}` → origin 차단(Task A3로)
- 429 → rate limit
- 400 `{field,code}` → 서버 검증

- [ ] **Step 2: GA4 이벤트 파라미터 차원 등록**

GA4 관리 > 맞춤 정의 > 이벤트 범위 맞춤 측정기준 3개 등록: `error_type`, `status_code`, `first_error_field`. (이미 코드가 전송 중이므로 등록만 하면 이후 데이터부터 수집)

- [ ] **Step 3: 재현 결과를 진단 문서로 기록**

`docs/diagnosis-2026-06-16-contact-form.md` 에 Step 1 응답(status/body), Step 2 등록 완료 여부, 확정된 원인을 적는다. 이 문서가 A2/A3 분기를 결정.

- [ ] **Step 4: Commit**

```bash
git add docs/diagnosis-2026-06-16-contact-form.md
git commit -m "docs(contact): 영어 컨택폼 실패 원인 실측 진단 기록"
```

## Task A2: 전화번호 placeholder 국제화 (원인과 무관하게 옳은 개선)

현재 7개 언어 전부 placeholder가 한국 번호 형식 `010-1234-5678`. 외국어 사용자에게 부적절하며 field_error 유발 가능. PHONE_PATTERN(`/^[\d\s+\-\(\)\.]+$/`)은 국제번호를 허용하므로 예시만 중립화한다.

**Files:**
- Modify: `public/locales/en/common.json` (`contact.form.phonePlaceholder`)
- Modify: `public/locales/{zh,es,vi,th,uz}/common.json` (동일 키)

- [ ] **Step 1: en placeholder를 국제형으로 변경**

`public/locales/en/common.json` 의 `contact.form.phonePlaceholder` 를 아래로 교체:
```json
"phonePlaceholder": "e.g., +82 10-1234-5678…",
```

- [ ] **Step 2: 나머지 5개 언어도 국가코드 포함 형식으로 변경**

각 파일의 `contact.form.phonePlaceholder` 를 해당 언어 라벨 + `+82 10-1234-5678` 로 통일:
- `zh`: `"例如：+82 10-1234-5678…"`
- `es`: `"p. ej., +82 10-1234-5678…"`
- `vi`: `"VD: +82 10-1234-5678…"`
- `th`: `"เช่น +82 10-1234-5678…"`
- `uz`: `"Masalan: +82 10-1234-5678…"`

(ko는 국내 사용자 대상이므로 `010-1234-5678` 유지)

- [ ] **Step 3: JSON 유효성 검증**

Run: `node -e "['en','zh','es','vi','th','uz'].forEach(l=>{const v=require('./public/locales/'+l+'/common.json').contact.form.phonePlaceholder; if(!v.includes('+82')) throw new Error(l+' 미반영'); console.log(l, 'OK', v)})"`
Expected: 6개 언어 모두 `OK ... +82 ...` 출력, 에러 없음

- [ ] **Step 4: Commit**

```bash
git add public/locales/{en,zh,es,vi,th,uz}/common.json
git commit -m "fix(contact): 외국어 전화 placeholder 국제번호 형식으로 변경"
```

## Task A3: origin 차단이 원인일 때만 — CSRF allowlist 보강 + 회귀 테스트

**전제: Task A1 Step 1에서 403 Forbidden이 확인된 경우에만 실행.** 아니면 이 Task는 건너뛰고 A1 결과에 맞는 원인(429/400/네트워크)을 별도 처리.

`getAllowedOrigins()`([pages/api/contact/send-email.ts:128-146](../../../pages/api/contact/send-email.ts#L128-L146))는 `NEXT_PUBLIC_SITE_URL`, `PRODUCTION_ORIGIN`, `PRODUCTION_WWW_ORIGIN`, `ALLOWED_ORIGINS` 만 허용. 403이 난다면 실제 요청 origin이 이 목록 밖이라는 뜻(예: Vercel 프리뷰 도메인, 또는 `NEXT_PUBLIC_SITE_URL` 미설정).

**Files:**
- Modify: `pages/api/contact/send-email.ts` (필요 시)
- Test: `tests/api/contact/send-email.test.ts`

- [ ] **Step 1: 실패 origin을 재현하는 테스트 추가 (Red)**

`tests/api/contact/send-email.test.ts:165` 의 기존 `'returns 403 for disallowed origins before rate limiting'` 테스트 블록을 **그대로 복사**한 뒤, ① origin 헤더를 A1에서 기록한 실제 차단 origin으로 바꾸고 ② 단언을 `expect(getStatus()).not.toBe(403)` 로 뒤집어 "허용돼야 하는데 차단된" 케이스로 만든다. 그 파일의 mock 생성 헬퍼(line 13·168에서 쓰는 것)와 `getStatus()`/`getBody()` 접근자를 동일하게 재사용할 것 — 새 헬퍼를 만들지 말 것.

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `npx jest tests/api/contact/send-email.test.ts -t "allows the production origin"`
Expected: FAIL (403 반환)

- [ ] **Step 3: 환경변수 우선 수정 (코드 변경 전 점검)**

Vercel 대시보드에서 `NEXT_PUBLIC_SITE_URL=https://studionol.co.kr` 설정 여부 확인. 누락이면 추가 후 재배포로 해결되는지 우선 검증(코드 변경 불필요). 프리뷰 도메인이 원인이면 `ALLOWED_ORIGINS` 에 추가.

- [ ] **Step 4: 환경변수로 안 풀리면 기본 allowlist 보강**

`getAllowedOrigins()` 의 `defaults` 배열에 누락 origin을 명시 추가(예: apex/www 외 실제 사용 도메인). PRODUCTION_ORIGIN 상수 정의를 확인하고 동일 패턴으로 추가.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx jest tests/api/contact/send-email.test.ts`
Expected: 신규 테스트 PASS, 기존 403 차단 테스트(line 165)도 PASS 유지

- [ ] **Step 6: Commit**

```bash
git add pages/api/contact/send-email.ts tests/api/contact/send-email.test.ts
git commit -m "fix(contact): 영어 유입 origin 허용 누락 수정 + 회귀 테스트"
```

---

# Phase B — SEO CTR/랭킹 회복 (P0~P1)

> 메타·콘텐츠 변경은 **가설 검증**이다. 각 Task 적용 후 `node scripts/gsc-fetch-detail.mjs`(또는 동등 절차)로 2~3주 뒤 재측정해 효과 확인.

## Task B1: copyright-cover1 메타 CTR 이상 교정 (P0, 신뢰도 높음)

pos 5.1인데 CTR 1.31%는 명백한 이상치. title/summary가 검색 의도("커버곡 해도 되나/저작권 괜찮나")보다 절차 설명에 치우침. frontmatter만 수정(본문 불변).

**Files:**
- Modify: `content/stories/copyright-cover1.md:1-12` (frontmatter `title`, `summary`)

- [ ] **Step 1: 현재 frontmatter 확인**

Run: `sed -n '1,15p' content/stories/copyright-cover1.md`
Expected: `title: 커버곡 저작권 완전 가이드 — 유튜브 수익화 조건·Content ID 대처와 정식 발매 절차`, `summary: 커버곡 저작권·수익화 조건 완전 정리 …`

- [ ] **Step 2: 의도 매칭형으로 title/summary 교체**

상위 쿼리("커버곡 저작권" pos4.1, "유튜브 커버곡 저작권", "노래 커버 저작권")의 질문 의도를 앞세운다.
```yaml
title: 커버곡 저작권, 그냥 올려도 될까 — 유튜브·SNS 합법 업로드와 수익화 조건 총정리
summary: >-
  유튜브·인스타에 커버곡 올려도 되는지, 저작권료·Content ID·수익화 조건을 실제 사례로 정리했습니다. 합법 업로드 체크리스트와 정식 발매 절차까지 한 번에.
```
- title 60자 이내, summary 120자 이내(스니펫 잘림 방지) 준수. 글자수 확인:
Run: `node -e "const m=require('fs').readFileSync('content/stories/copyright-cover1.md','utf8'); const t=m.match(/title: (.*)/)[1]; console.log('title', t.length+'자')"`
Expected: title 60자 이하

- [ ] **Step 3: 빌드로 frontmatter 파싱 무결성 확인**

Run: `npm run build 2>&1 | grep -iE "copyright-cover1|error" | head`
Expected: copyright-cover1 관련 빌드 에러 없음(스토리 정상 생성)

- [ ] **Step 4: Commit**

```bash
git add content/stories/copyright-cover1.md
git commit -m "fix(seo): copyright-cover1 메타 의도 매칭 재작성 — CTR 1.3% 이상치 교정"
```

## Task B2: noise-reduction1 "배경 잡음 제거" 인텐트 갭 해소 (P1)

페이지는 303줄·키워드 풍부하나 "배경 잡음 제거"(501노출)에서 pos30. 이 쿼리 의도는 **편집툴(프리미어/캡컷/Audacity)로 이미 녹음된 영상·음성의 배경음 제거**에 가깝고, 현 본문은 "녹음 단계 예방" 중심이라 의도 불일치로 추정. 의도 매칭 섹션 추가 + 내부링크 보강으로 관련성↑.

**Files:**
- Modify: `content/stories/noise-reduction1.md` (H2 섹션 1개 추가, frontmatter는 유지)

- [ ] **Step 1: 현재 H2 구조 확인**

Run: `grep -n "^## " content/stories/noise-reduction1.md`
Expected: 14개 H2(예방·노이즈게이트·전기험 등). "이미 녹음된 영상/음성에서 배경 잡음만 제거" 전용 섹션 부재 확인.

- [ ] **Step 2: 의도 매칭 H2 섹션 추가**

"사후 노이즈 제거" 섹션 뒤에 아래 섹션 삽입(쿼리 문구를 H2/본문에 자연 노출):
```markdown
## 이미 녹음된 영상·음성에서 배경 잡음만 제거하는 법

녹음을 다시 할 수 없을 때, 완성된 파일에서 배경 잡음만 제거하는 가장 빠른 경로를 도구별로 정리합니다.

- **무료·원클릭:** Adobe Podcast Enhance, Audacity 노이즈 감소(잡음 프로파일 지정 → 적용)
- **영상 편집 중:** 프리미어 프로 DeNoise, 캡컷 음성 향상으로 배경음 제거
- **고품질:** iZotope RX의 Spectral De-noise / Voice De-noise

배경 잡음 제거는 사후 처리로 80%까지 줄일 수 있지만, 원본이 깨끗할수록 결과가 좋습니다. 처음부터 잡음 없이 녹음하려면 → [Studio NOL 보컬 녹음](/ko/practice-room) 환경을 참고하세요.
```

- [ ] **Step 3: 관련 스토리에서 내부링크 추가(권위 전달)**

`grep` 으로 잡음/녹음 관련 상위 트래픽 스토리(예: vocal-microphone1, recording-price1)에서 noise-reduction1로 향하는 본문 내부링크가 있는지 확인하고, 없으면 1~2곳에 자연스러운 앵커로 추가:
Run: `grep -rl "noise-reduction1" content/stories/ | grep -v noise-reduction1.md`
Expected: 링크하는 파일 목록. 비어 있으면 vocal-microphone1.md 등에 `[배경 잡음 제거 가이드](/ko/stories/noise-reduction1)` 추가.

- [ ] **Step 4: 빌드 확인**

Run: `npm run build 2>&1 | grep -iE "noise-reduction1|error" | head`
Expected: 에러 없음

- [ ] **Step 5: Commit**

```bash
git add content/stories/noise-reduction1.md content/stories/*.md
git commit -m "feat(seo): noise-reduction1 '배경 잡음 제거' 의도 매칭 섹션+내부링크 — pos30 개선"
```

---

# Phase C — 가격 페이지 상업 키워드 랭킹 (P1, 선택)

`/ko/pricing` 은 상업 가격 쿼리에서 pos22~49로 미랭킹. 이미 잘 랭크되는 `recording-price1`(pos5.9, 51클릭)·`practice-room`(음악연습실 월세 pos3.3)에서 pricing으로 내부링크를 모아 권위를 전달한다.

**Files:**
- Modify: `content/stories/recording-price1.md` (CTA/본문에서 /ko/pricing 링크)
- Modify: practice-room 관련 페이지 (가격 섹션 → /ko/pricing 링크)

- [ ] **Step 1: 현재 pricing 유입 내부링크 확인**

Run: `grep -rln "/ko/pricing\|/pricing\b" content/ pages/ | head`
Expected: pricing으로 향하는 링크 보유 파일 목록

- [ ] **Step 2: recording-price1에서 pricing으로 문맥 링크 추가**

`recording-price1.md` 본문 가격 언급 부근에 `[정식 요금표 보기](/ko/pricing)` 앵커 1곳 추가(앵커텍스트에 "요금/가격" 포함).

- [ ] **Step 3: 빌드 + 링크 유효성 확인**

Run: `npm run build 2>&1 | grep -iE "error" | head`
Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
git add content/stories/recording-price1.md
git commit -m "feat(seo): 가격 페이지로 내부링크 집중 — 상업 키워드 랭킹 보강"
```

---

# 측정·검증 체크포인트

- [ ] **컨택폼(즉시):** Task A 배포 후 `/en/contact` 실제 제출 1건 성공 확인(DevTools 200 + GA4 `lead_submit_success`). 1주 뒤 GA4에서 `/en/contact` submit_success 증가 확인.
- [ ] **SEO(2~3주 후):** `node scripts/gsc-fetch-detail.mjs` 재실행 →
  - copyright-cover1 CTR 1.3% → 3%+ 목표
  - noise-reduction1 "배경 잡음 제거" pos30 → pos15 이내 진입 목표
  - pricing 상업 쿼리 노출/순위 상승 여부
- [ ] 효과 없으면 본 명세의 가설을 기록 갱신하고 다음 변형 시도(meta A/B).

---

## 실행 순서 (임팩트 우선)

1. **Task A1 진단**(오늘, 즉시) — 컨택폼 실제 실패 코드 확인
2. **Task A2 placeholder + A3(403 확정 시)** — 매출 누수 차단
3. **Task B1 copyright-cover1 메타** — 반나절, 최고 신뢰도 즉효
4. **Task B2 noise-reduction1**, **Phase C pricing** — 콘텐츠 작업
