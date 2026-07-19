# 위키 활동 로그

> append-only. 형식: `## YYYY-MM-DD · <ingest|query|lint> · <대상>` + 영향받은 페이지 불릿.

## 2026-06-25 · setup · 위키 골격 생성
- WIKI.md / index.md / log.md / entities,concepts,decisions 디렉토리 생성

## 2026-06-25 · ingest · 가이드/전략 문서
- 신설: concepts/seo-strategy.md — SEO 전략 (Pillar-Cluster·색인 품질 4개 Phase·백링크·기술 SEO)
- 신설: concepts/keyword-clusters.md — 6개 서비스 클러스터 키워드 맵, A~D 그룹 12개 갭 완료 현황
- 신설: concepts/content-guidelines.md — 스토리 작성 가이드라인 (톤·구조·이미지·기술 아키텍처)
- 신설: concepts/pricing-offers.md — 공식 가격 구조 (레코딩·믹싱·마스터링·연습실·레슨 등)
- 신설: concepts/marketing-channels.md — 마케팅 채널 전략 (네이버 플레이스·숏폼·당근·추천 유도)
- 신설: concepts/revenue-growth.md — 매출 성장 전략 (교육 다각화·영상·B2B·멤버십)
- 신설: entities/services.md — Studio NOL 공식 서비스 목록 전체 (가격·장비·운영 정보)
- 신설: entities/naver-place.md — 네이버 스마트플레이스 운영 현황·최적화 가이드
- 갱신: index.md Entities 2개·Concepts 6개 등록
- 소스: studio-nol-complete-guide.md, content-guidelines.md, seo-keyword-cluster-map.md, seo-backlink-strategy.md, seo-content-calendar.md, seo-indexing-remediation.md, marketing_strategies.md, revenue_growth_strategies.md, naver-place-optimization.md
- 확인 필요 플래그 2건: (1) seo-content-calendar.md 내 "성우 녹음 시간당 3만원" vs 공식 100,000원 — pricing-offers.md 주석 참조. (2) marketing_strategies.md "보컬 원데이 클래스" — 보컬 레슨 미제공, marketing-channels.md 주석 참조.

## 2026-06-25 · ingest · 채널 raw 데이터
- 신설: entities/channel-ga4.md — GA4 소스·디바이스·랜딩·이벤트 해석 (google organic 지배, 네이버 referral 최고 전환, /en/contact 폼 오류 주목)
- 신설: entities/channel-gsc.md — GSC 5/22~6/17 추세 (노출 85% 상승), 상위 10페이지, 상위 쿼리, quick-win 15건 정리
- 신설: entities/channel-llm-referrers.md — ChatGPT 332세션(135+110+86+1, 이탈률 10.4%), Perplexity·NotebookLM·Gemini 포함 GEO 분석, 전략 시사점 5개
- 신설: entities/channel-naver-blog.md — 16편 초안 주제별 목록, 발행 순서, GSC 연계 키워드, 내부링크 전략
- 갱신: entities/naver-place.md — naver-smartplace 카드뉴스 5개 시리즈 현황 및 디자인 원칙 보강 (섹션 11 추가), frontmatter sources/related 갱신
- 갱신: index.md Entities 섹션 4개 신규 등록, naver-place 설명 갱신
- 소스: ga4-raw/{device,events,landing,llm_referrers,source}.csv, gsc-raw/{page-all,page-query,quick-win,trend}.csv, naver-smartplace/01~06.md, naver-blog/ 전체

## 2026-06-25 · ingest · 발매 프로젝트
- 신설: entities/project-release-flagship.md — Path B 플래그십 목적·포지셔닝·진짜 상품 정의(프로듀서+네트워크)·3티어 상품 형태·실행 방향·증거 자산·Open Items
- 갱신: index.md Entities 섹션 최상단에 등록
- 소스: 2026-05-28-발매프로젝트-재포지셔닝-기획.md
- 고객 vs 프로듀서 이력 구분: 기획안 내 sickbaby 페르소나 정보(두루두루AMC 매니저 경력 등)를 황경하 이력으로 오기하지 않도록 별도 섹션으로 명시. 확인 필요 플래그 없음(기획안 §4에 이미 명시).

## 2026-06-25 · ingest · diagnosis 시계열
- 신설: decisions/seo-ctr-optimization.md — 2026-05-18~05-31 CTR 최적화·카니벌라이제이션 정리 타임라인
- 신설: decisions/conversion-cta-system.md — 2026-05-18~05-31 전환율·CTA 시스템 타임라인
- 신설: decisions/contact-form-en.md — 2026-05-21~06-16 영문 컨택폼 오류 조사→정상 확인
- 갱신: index.md Decisions 섹션 3개 등록
- 소스: diagnosis-2026-05-18.md, -05-21.md, -05-27.md, -05-31.md, -06-16-contact-form.md

## 2026-06-25 · lint · 전체
- 고아 페이지: 0건 (16개 페이지 전부 index.md 등록 확인)
- 끊긴 wiki-link: 0건 (모든 [[...]] 링크 → 실제 파일 존재 확인; WIKI.md 내 예시 `[[entities/service-mixing]]`·`[[경로]]`는 schema 설명용이므로 무시)
- 끊긴 raw 경로: 0건 (55개 상대경로 전수 확인, 전부 정상)
- 포맷 위반: 0건 (전 페이지 title/type/sources/updated/related 키 보유 확인)
- 수정한 minor 오류 3건:
  - entities/channel-llm-referrers.md: "약 331세션" → "332세션 (135+110+86+1)" (source.csv 기준 정확값)
  - entities/channel-naver-blog.md: "총 16편" → "23편 초안 파일 (01~07 한/영 각 2파일)" (frontmatter 25개 sources와 정합)
  - log.md (2026-06-25 채널 raw 데이터 항목): "ChatGPT 331+" → "ChatGPT 332세션(135+110+86+1)"
  - index.md: channel-naver-blog 설명 "16편 초안" → "23편 초안 파일"
- 확인 필요 플래그: 이전 ingest에서 표시된 2건 잔존 (성우 시간당 3만원 vs 100,000원 / 보컬 원데이 클래스) — 사실 충돌 미해소, 사람 판단 대기
- 민감 사실 회귀: 금지 표현(0507·보컬레슨·악기레슨·영어엔지니어) 미발견. 전화번호 010-4255-7893 정상 표기 확인.

## 2026-06-25 · query · 서비스/가격 검증
- 질문: "Studio NOL의 공식 서비스 범위와 가격은?"
- entities/services.md에서 6개 서비스(보컬·악기 녹음/믹싱/마스터링/성우나레이션/연습실/프로듀싱레슨) + 부가서비스 전체 확인.
- concepts/pricing-offers.md에서 가격표 정합 확인(레코딩 100,000원/시간, 믹싱 200,000~500,000원/곡, 마스터링 80,000~100,000원 등).
- 보컬·악기 레슨 없음(entities/services.md 가드 박스 명시), 영어=예약응대+원격믹싱 한정(services.md §1 내 "영어 전담 엔지니어 없음" 명시).
- 전화번호 010-4255-7893 정상(services.md §9, pricing-offers.md 상단 가드).
- 검증 통과.

## 2026-06-25 · query · 확인필요 3건 황경하 결정 반영
- 성우/나레이션 녹음 공식가 100,000원/시간 확정 — pricing-offers.md §7 가격 가드 추가, "3만원" 오기 인용 금지
- "보컬 원데이 클래스" 미제공 확정(보컬 레슨류 없음) — marketing-channels.md §4 서비스 가드로 교체
- 보컬 녹음 1곡(25만) ≠ 축가/이벤트(35만)는 별개 상품 확정(축가는 행사용 믹싱 포함) — pricing-offers.md §4·§8 상품 구분 가드 추가
- 콘텐츠 페이지 미해결 확인필요 0건

## 2026-07-18 · ingest · story-content-strategy-2026-07.md (P0 실행 결과 포함)
- decisions/story-content-strategy.md 신설: 3축 전략(고도화·전문화·강화) 채택 기록 + 당일 P0 실행 4건
  (플래그십 F15+B5 확정, CTR 수술 3건+실험 장부 신설, 근접중복 전수 스캔 603페어, 실명 저자성 인프라 /author)
- decisions/seo-ctr-optimization.md 갱신: 2026-07-07~18 타임라인 추가(CTA 꼬리 원복 교훈, 콘텐츠 공략 패턴,
  ctr-surgery-log 실험 장부 체제 전환), updated 2026-07-18, sources·related 추가
- index.md: story-content-strategy 등록, seo-ctr-optimization 요약 기간 05-31 → 07-18 갱신
- 신규 raw 4건 생성됨(계층 1): story-content-strategy-2026-07.md, story-tier-flagship-2026-07.md,
  ctr-surgery-log.md, near-duplicate-scan-2026-07.md(+csv)
- 모순/확인필요: 없음. 민감 사실 가드 준수(성우 10만원/시간, 전화 010-4255-7893, 레슨 범위) 확인.

## 2026-07-18 · ingest · P1 실행(근접중복 통합 + 성우 신규)
- decisions/story-content-strategy.md 갱신: "P1 실행" 섹션 추가(근접중복 재프레이밍+4쌍 308, 성우 신규 1편), "다음 단계"→"남은 P1"로 재구성
- 신규 raw: near-duplicate-consolidation-2026-07.md(통합 실행 기록 + 501페어=템플릿 재프레이밍)
- 근접중복: 명백한 동의어 4쌍만 308(regionRedirectMap +4), 본문링크 16곳·practiceRoomRelatedGuides 약자 4줄 정리. 대량 practice-room 유사도는 탈템플릿/꼬리 트랙으로 재분류(중복 URL 아님)
- 신규 스토리: voice-actor-hiring-quote-cost.md(구매자 관점 성우 견적, 황경하 저자, 본문 5,494자) — 가격가드 준수, serviceRelatedStories 편입
- 검증: factGuards·ctrTargets·storyLinks·practiceRoomRelatedGuides 통과. 모순/확인필요 0건

## 2026-07-19 · ingest · P1 실행 2차(성우 2편째 + 플래그십 업그레이드)
- decisions/story-content-strategy.md 갱신: 성우 2편 쿼터 완료(commercial-narration 추가), producer1 플래그십 업그레이드 기록, "남은 P1" 갱신(나머지 14편)
- story-tier-flagship-2026-07.md: producer1 업그레이드 완료 표시(2,511→4,832자)
- 신규 스토리: commercial-narration-cost-guide.md(광고 나레이션 비용, 황경하, 5,248자) — voice-actor-hiring-quote-cost와 Jaccard 0.068 차별화
- producer1: #1 페이지 랭킹 보존 + 1인칭 심화 + 얕은 템플릿 저자박스 교체
- 검증: factGuards·storyLinks·ctrTargets·content-check 통과. 가격가드(성우 10만원/시간) 준수. 모순/확인필요 0건

## 2026-07-19 · ingest · P1 실행 3차(탈템플릿 2편 + 꼬리 noindex 재평가)
- 신규 raw: tail-noindex-assessment-2026-07.md — "688편 꼬리"는 stale 감사(2026-05-21) 착시임을 최신 GSC(07-14)로 규명
- 핵심 발견: 감사 CSV의 NOINDEX_CANDIDATE 688에 실제 가치 페이지(album-artwork1 146노출, audiobook-narration 118노출) 혼입 → 대량 noindex 위험. 진짜 꼬리는 55→가드 후 프룬후보 6편뿐, 43편은 인바운드링크 보유(탈템플릿 대상)
- decisions/story-content-strategy.md 갱신: 탈템플릿 2편(recording-price1·transfer1) 기록, 꼬리 재평가 반영, 남은 P1에 "감사 데이터 갱신" 추가. sources 병합(중복 sources 키 수정), updated 2026-07-19
- story-content-strategy-2026-07.md: 티어 수치에 stale 교정 주석
- 권고: 대량 noindex 하지 말 것. gsc-audit-output.csv 최신화(cron 재실행 점검)가 진짜 액션
- 검증: factGuards·storyLinks·content-check 통과. 모순/확인필요 0건(오히려 stale 데이터 착시 1건 규명)

## 2026-07-19 · ingest · P1 실행 4차(플래그십 탈템플릿 F15/B5 전편 완료)
- 플래그십 7편 추가 탈템플릿(startup1·plugins1·song-key1·music-marketing1·loudness1·bass-mixing1·soundproof) → 누계 10편, F15/B5 전편 완료
- 각 편 얕은 "자주 권하는 3가지" 박스 → 주제별 황경하 1인칭 실질 섹션(재템플릿 방지 차별화)
- 서비스 가드 준수: soundproof "합주실 미운영" 보존, music-marketing 검증된 15년 발매PR 사실만
- decisions/story-content-strategy.md·story-tier-flagship-2026-07.md 완료 표기, 남은 P1을 "개별 심화 + 탈템플릿 백로그(~1,417편)"로 갱신
- 검증: factGuards(합주실 미운영·가격가드)·storyLinks·content-check 통과. 모순/확인필요 0건

## 2026-07-19 · ingest · 탈템플릿 백로그 착수(고트래픽 bespoke 13편)
- 사용자 결정: 대량 렌더처리/삭제 아니라 고트래픽 페이지부터 수작업 1인칭 bespoke(무위험·순증분)
- 비플래그십 13편 탈템플릿(2배치): coverrecording1·vst-guide1·bass-5string1·streaming-platforms1·melodyne1·fabfilter1·flstudio1(박스2개)·breath-support1·pitch-correction1·recording-environment1·bass-recording1·mastering-tips1·condenser-mic1
- 누계 23편(플래그십 10 + 비플래그십 13). 남은 백로그 ~1,404편(고트래픽순 계속)
- 재템플릿 방지: 유사주제 페어도 상호 Jaccard 0.03~0.06 차별화. factGuards·storyLinks·content-check 통과
- decisions/story-content-strategy.md에 백로그 진행 섹션 추가

## 2026-07-19 · ingest · 탈템플릿 백로그 3차 배치(비플래그십 8편)
- 추가 8편: practice-room-vs-karaoke1·ep-making1·headphone-mixing1·sound-engineer1·music-video1·mid-side1·vocal-nutrition1·ableton1
- sound-engineer1 박스 2개 중복 정리(상세 박스 1인칭화 + 중복 신규섹션 제거)
- 누계 31편(플래그십 10 + 비플래그십 21). 남은 ~1,396편, 클릭 <18 구간 진입(ROI 점감)
- 재템플릿 방지: 유사주제 상호 Jaccard 0.02~0.11. factGuards·storyLinks·content-check 통과

## 2026-07-19 · ingest · 탈템플릿 백로그 4~5차(비플래그십 16편)
- 4차 8편: cover1·bass-pentatonic1·piano-sight-play1·saxophone1·solo-album1·glossary1·music-publishing1·practice-room-wedding1
- 5차 8편: placement1·piano-technique1·music-analytics1·busking1·contract1·guitar-double-stop1·daw-performance1·practice-room-guide1
- 누계 47편(플래그십 10 + 비플래그십 37). 남은 ~1,380편(클릭<18, ROI 점감)
- near-dup·인트로 재템플릿 방지 검증(상호 Jaccard 0.01~0.06). factGuards·storyLinks·content-check 통과
- 가격/서비스 가드 준수(축가 35만원 보존, contract·publishing은 전문영역 주의)

## 2026-07-19 · ingest · 백로그 대규모 품질 심화 파이프라인 착수
- 사용자 결정: 효과 무관 전 백로그 품질 향상, 깊이="박스 교체 + 얕은 본문 심화", 병렬 서브에이전트 + 검증
- 대상: "자주 권하는 3가지" 템플릿 박스 보유 스토리(리다이렉트 제외 비지역 849 + 지역 47). 재개는 이 박스 유무로 남은 대상 재탐색
- 방식: 배치당 5서브에이전트 × 8편 = 40편. 각 파일 박스→주제특화 황경하 1인칭 + 얇은 본문 보수적 심화
- 품질 가드(프롬프트): 사실 위조 금지(기존 값만 부연)·서비스가드(드럼/합주실/보컬레슨/성우가)·재템플릿 금지(인트로·구조 차별)·near-dup 클러스터 분리·과한 장비 모델명 제거
- 검증(내가 전수): 박스 0·깨진문자 0·상호 Jaccard<0.45·factGuards·storyLinks·content-check. 배치 몇 개마다 스쿼시 푸시(빌드 최소화)
- 진행: 1차 58편(a~c) 완료·푸시(76e2f7f756). 품질 검증 통과, 위조 무혐의(원문 수치만 재사용)

## 2026-07-19 · ingest · 품질 심화 진행 마일스톤(178편, 21%)
- 파이프라인 5배치 완료: 배치당 5서브에이전트×8편. 누적 비지역 178/849(약 21%)
- 푸시 체크포인트 3회: 58편(76e2f7f7)·98편(1dedd709)·178편(db110f3f6). Vercel 빌드 총 3회
- 전 배치 검증 통과: 박스 0·깨진문자 0·상호 Jaccard ≤0.15·factGuards·storyLinks·content-check·전체 jest 305
- 부수 개선: 깨진 CJK/단어 수정, 과한 장비 모델명 제거, 모순 수치 정리, 서비스가드 강화(보컬레슨 미제공 명시 등)
- **재개 방법**: 남은 대상 = "자주 권하는 3가지" 박스 보유 스토리(비지역 ~671 + 지역 47). worklist 재생성은 content/stories 스캔으로. 배치당 40편(5에이전트×8) + 클러스터 near-dup 주의 프롬프트 + 전수 검증
