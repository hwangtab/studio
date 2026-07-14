---
title: GA4 트래픽 채널
type: entity
sources:
  - ../ga4-raw/device.csv
  - ../ga4-raw/events.csv
  - ../ga4-raw/landing.csv
  - ../ga4-raw/source.csv
updated: 2026-07-14
related:
  - "[[concepts/seo-strategy]]"
  - "[[concepts/keyword-clusters]]"
  - "[[entities/channel-gsc]]"
  - "[[entities/channel-llm-referrers]]"
  - "[[decisions/conversion-cta-system]]"
---

# GA4 트래픽 채널

Studio NOL GA4 세션/이벤트 데이터 해석. 원본 수치는 raw 파일([source.csv](../ga4-raw/source.csv), [device.csv](../ga4-raw/device.csv), [landing.csv](../ga4-raw/landing.csv), [events.csv](../ga4-raw/events.csv))을 직접 참조.

---

## 1. 소스/미디엄 구조

### 지배적 채널
Google Organic이 전체 세션의 압도적 다수를 차지 (5,585세션, 이탈률 27.8%). 전환 지표 측면에서도 가장 많은 lead_events(55건)와 qualified_leads(31건)를 만들어 낸다. [source.csv](../ga4-raw/source.csv)

### 채널별 특징 요약
| 채널 | 주목 포인트 |
|------|------------|
| google/organic | 세션 최다, 전환 최다. 핵심 성장 채널 |
| (direct) | 1,200세션. 이탈률 49% — 브랜드 인지 방문이지만 이탈 높음 |
| m.search.naver.com/referral | 394세션, 이탈률 15.7%. 세션 대비 전환 효율 가장 높음(10건 전환, 전환율 2.5%) |
| chatgpt.com (합산) | 331세션 — LLM 유입 섹션 별도 참조 ([[entities/channel-llm-referrers]]) |
| naver/organic | 152세션. 네이버 플레이스와 달리 유기 검색 유입은 적음 — 네이버 색인 상승 여지 |

### 시사점
- 네이버 referral 이탈률이 15.7%로 전체 소스 중 가장 낮다. 연습실·월세 등 네이버 강세 키워드 수요가 사이트와 잘 매칭되고 있다는 신호.
- Direct 이탈률 49%는 브랜드 인지 방문자 중 절반이 목적 없이 이탈 중. 홈 페이지 도달 전 전환 유도 강화 필요.
- 유료 Google CPC(3세션)는 사실상 미활용 상태.

---

## 2. 디바이스 / 지역

- 국내 세션: 데스크톱 3,589 + 모바일 3,156 + 태블릿 133 (합계 6,878). 데스크톱 비중이 약간 우위지만 모바일도 거의 동등. [device.csv](../ga4-raw/device.csv)
- 한국 외 유의미 국가: 중국(mobile 149), 싱가포르(desktop 83), 미국(desktop 72 + mobile 46). 중국·싱가포르 방문자 일부는 LLM 또는 영문 콘텐츠 경유로 추정.
- 중국 desktop 이탈률 63% — 중국어(/zh/) 랜딩 페이지 품질 개선 여지 있음.

---

## 3. 상위 랜딩 페이지 추세

상위 랜딩 5개([landing.csv](../ga4-raw/landing.csv)):

| 페이지 | 세션 | 이탈률 | 평균 체류(초) |
|--------|------|--------|--------------|
| /ko/practice-room | 217 | 21.7% | 131 |
| /ko/stories/daw-choice1 | 160 | 30.6% | 157 |
| /ko/stories/copyright-cover1 | 114 | 24.6% | 111 |
| /ko/stories/practice-room-startup1 | 109 | 22.0% | 159 |
| /ko/stories/songstructure1 | 108 | 31.5% | 82 |

- `/ko/practice-room` 이탈률 21.7%는 서비스 페이지 중 가장 낮고 체류시간도 양호. 연습실 월세 의향 방문자 품질 높음.
- `/ko/stories/vst-guide1`(104세션, 이탈률 4.8%)은 낮은 이탈률 이상치 — 콘텐츠 체류 최강 페이지.
- `/en/contact`(41세션, 이탈률 63.4%) — 영문 컨택 폼 이탈 높음. [[decisions/contact-form-en]] 참조.

---

## 4. 이벤트 추세

상위 이벤트([events.csv](../ga4-raw/events.csv)):

- `lead_click_kakao` — /ko/practice-room 16건으로 압도적 1위. 연습실 문의가 주요 전환 경로.
- `/en/contact` 경로에서 `lead_form_field_error` 12건, `lead_submit_error` 3건 발생. 영문 폼 오류 비율 높음.
- `lead_submit_success` 2건 (모두 /en/contact) — 영문 성공 전환 절대수 부족.
- 전반적으로 KakaoCh 카카오채널 클릭이 폼 제출보다 훨씬 많음. 한국 방문자는 폼보다 카카오 선호.

### 시사점
- 연습실 페이지 CTA는 카카오 중심으로 최적화되어 있어 효과적.
- 영문 폼 오류 문제는 별도 tracked. 실제 폼 고장보다 사용자 마찰 가능성 높음(→ [[decisions/contact-form-en]]).

### 마이크로 전환 이벤트 (`micro_*`)

2026-07-14 계측 정확성 배포에서 `lead_` 접두사를 쓰던 두 이벤트를 `micro_` 접두사로
개명·정리했다. `scripts/ga4-fetch.mjs`의 `MICRO_EVENT_NAMES`로 관측은 하되,
`QUALIFIED_LEAD_EVENT_NAMES`(정확히 5개: `lead_click_kakao`·`lead_click_phone`·
`lead_click_email`·`lead_click_naver_map`·`lead_submit_success`)에는 절대 포함하지 않는다.

- `micro_click_service` — 서비스 소개 페이지 인라인 클릭. 관심 신호일 뿐 문의가 아니다.
- `micro_click_contact` — `/contact` 폼 페이지로의 "이동". 예전엔 `lead_click_contact`라는
  이름이었는데, 비한국어 `ContactCTA`가 `/contact`로 가면서 `lead_click_kakao`를 잘못
  발화해 유일하게 신뢰 가능한 지표(카톡 리드)를 오염시킨 버그의 근본 원인이었다(수정
  커밋 참조). 재발 방지를 위해 이름 자체에 "리드 아님"을 새겼다.

> **경고**: `micro_click_service`·`micro_click_contact`는 리드가 아니다. GA4 콘솔에서
> `lead_*` 패밀리를 훑으며 주요 이벤트(key event)를 지정할 때 이 두 이벤트를 절대
> 함께 체크하지 말 것. 체크하는 순간 카톡 리드 오염이 사람 손으로 재발한다.
