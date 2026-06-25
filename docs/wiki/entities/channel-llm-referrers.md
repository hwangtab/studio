---
title: LLM 유입 채널 (GEO)
type: entity
sources:
  - ../ga4-raw/llm_referrers.csv
  - ../ga4-raw/source.csv
updated: 2026-06-25
related:
  - "[[concepts/seo-strategy]]"
  - "[[entities/channel-ga4]]"
  - "[[entities/channel-gsc]]"
---

# LLM 유입 채널 (GEO)

LLM(대형 언어 모델) 기반 서비스에서 studionol.co.kr로 유입된 트래픽 분석. 원본: [llm_referrers.csv](../ga4-raw/llm_referrers.csv), [source.csv](../ga4-raw/source.csv). GEO(Generative Engine Optimization) 전략과 직결하므로 [[concepts/seo-strategy]]와 상호참조.

---

## 1. LLM 소스별 세션 규모

source.csv 기준 LLM 소스 합산:

| 소스 | 미디엄 | 세션 | 이탈률 | 비고 |
|------|--------|------|--------|------|
| chatgpt.com | ai-assistant | 135 | 10.4% | **가장 낮은 이탈률** |
| chatgpt.com | (not set) | 110 | 71.8% | 다이렉트 유사 패턴 |
| chatgpt.com | referral | 86 | 57.0% | |
| perplexity | (not set) | 31 | 48.4% | |
| perplexity.ai | ai-assistant | 18 | 16.7% | |
| perplexity.ai | referral | 14 | 21.4% | |
| notebooklm.google.com | referral | 13 | 15.4% | |
| copilot.com | ai-assistant | 9 | 33.3% | |
| gemini.google.com | ai-assistant | 7 | 0.0% | |
| gemini.google.com | referral | 6 | 100.0% | |
| claude.ai | ai-assistant | 2 | 0.0% | |
| claude.ai | referral | 1 | 0.0% | |
| manus.im | referral | 1 | 0.0% | |
| gpt.k-university.ai | referral | 1 | 0.0% | |

**총계**: ChatGPT 계열 332세션 (135+110+86+1), Perplexity 계열 63세션, 기타 LLM 39세션 — 합산 약 434세션.

---

## 2. 상위 랜딩 페이지 분석 (llm_referrers.csv)

ChatGPT 유입 상위 랜딩:

| 랜딩 페이지 | 세션 | 이탈률 | 평균 체류(초) | 해석 |
|------------|------|--------|--------------|------|
| /en/contact | 39 | 64.1% | 32.9 | 영어 문의 의향자. 이탈률 높아 폼 마찰 문제 |
| /ko/stories/distribution1 | 10 | 10.0% | 97.3 | 음원 유통 정보 수요 |
| /ko/pricing | 9 | 88.9% | 10.3 | 가격 확인 후 이탈 — 가격 페이지 설득력 부족 |
| /ko/stories/revenue1 | 9 | 77.8% | 24.5 | |
| /ko/stories/songstructure1 | 8 | 25.0% | 169.2 | 높은 체류 — 콘텐츠 소비형 |
| /ko/stories/falsetto1 | 7 | 0.0% | 235.7 | 이탈 0%, 체류 최장 — 우수 매칭 |
| /ko/stories/copyright-cover1 | 8 | 37.5% | 204.3 | |
| /ko/practice-room | 8 | 50.0% | 44.9 | 연습실 확인 후 이탈 비중 |
| /en | 5 | 60.0% | 144.1 | 영문 홈 방문자 |

ChatGPT에서 `/en/contact`로 39세션이 유입된다는 점은 주목할 만하다. AI가 해외 사용자에게 Studio NOL 영문 문의처를 추천하고 있다는 의미로, GEO 효과가 실제 리드 경로에서 나타나는 것.

---

## 3. LLM별 품질 비교

- **ChatGPT ai-assistant (135세션, 이탈률 10.4%)**: 단일 소스 중 이탈률이 가장 낮다. ChatGPT가 명시적으로 사이트를 추천한 경우 사용자 의도가 강하게 매칭됨.
- **Perplexity ai-assistant (18세션, 이탈률 16.7%)**: 소수지만 품질 양호.
- **NotebookLM (13세션, 이탈률 15.4%)**: 콘텐츠 리서치 목적 유입으로 추정. 전문 정보 수요.
- **Gemini ai-assistant (7세션, 이탈률 0%)**: 세션 수 적지만 이탈 0%는 주목.
- **chatgpt.com (not set) / referral**: 이탈률 57~72% — ai-assistant 미디엄과 달리 방문 목적이 명확하지 않음. URL 직접 공유 또는 앱 브라우저 패턴.

---

## 4. GEO 전략 시사점

1. **이미 LLM 인용 확인됨**: ChatGPT, Perplexity, NotebookLM, Gemini, Claude 전부에서 유입. 특히 ChatGPT ai-assistant 이탈률 10.4%는 유의미한 신호. [[concepts/seo-strategy]] GEO 섹션과 연계.
2. **영어 콘텐츠 GEO 효과**: `/en/contact` 39세션은 영문 LLM 추천 결과. 영어 서비스 범위(예약 응대 + 원격 믹싱)를 영문 콘텐츠에 명확히 기술할수록 인용 품질 향상 기대.
3. **가격 페이지 이탈 88.9%**: LLM에서 가격 확인 의향으로 유입됐지만 거의 이탈. 가격 페이지 콘텐츠 보강 또는 LLM용 구조화 데이터(priceRange, FAQ) 추가 검토.
4. **Perplexity 확장 여지**: 총 63세션으로 ChatGPT 대비 적음. Perplexity는 출처 인용 방식이 다르므로 FAQ·정의형 콘텐츠 구조 강화로 인용 확대 가능.
5. **인용 최적화 콘텐츠 우선순위**: `falsetto1`(ChatGPT 7세션, 이탈 0%), `distribution1`(10세션, 이탈 10%), `songstructure1`(8세션, 이탈 25%) — 이 페이지들이 LLM 인용 후 만족도가 높은 콘텐츠. 유사 구조의 신규 콘텐츠 확대 참고.
