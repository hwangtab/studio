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
- 신설: entities/channel-llm-referrers.md — ChatGPT 331+ 세션(이탈률 10.4%), Perplexity·NotebookLM·Gemini 포함 GEO 분석, 전략 시사점 5개
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
