---
title: 스토리 콘텐츠 고도화·전문화·강화 전략 — 채택과 P0 실행
type: decision
sources:
  - ../story-content-strategy-2026-07.md
  - ../story-tier-flagship-2026-07.md
  - ../ctr-surgery-log.md
  - ../near-duplicate-scan-2026-07.md
  - ../near-duplicate-consolidation-2026-07.md
  - ../tail-noindex-assessment-2026-07.md
  - ../gsc-raw/page-all.csv
  - ../gsc-audit-output.csv
  - ../p1-followups-2026-07.md
updated: 2026-07-19
related:
  - "[[decisions/seo-ctr-optimization]]"
  - "[[concepts/seo-strategy]]"
  - "[[concepts/content-guidelines]]"
  - "[[concepts/keyword-clusters]]"
  - "[[entities/channel-gsc]]"
  - "[[entities/project-release-flagship]]"
---

# 스토리 콘텐츠 고도화·전문화·강화 전략

## 무엇을 결정했나 (2026-07-18 채택)

**핵심 명제: "페이지 수의 시대는 끝났다 — 페이지당 권위에 투자한다."**
전문 문서: [../story-content-strategy-2026-07.md](../story-content-strategy-2026-07.md)

3축 구조:

1. **고도화 — 역피라미드 재배분**: 플래그십 15편 전문가 업그레이드 / 노출多·CTR低 페이지는
   타이틀·메타만 수술 / 중위 357편(WATCH)은 분기 감사로 자동 관리 / 꼬리 688편(NOINDEX_CANDIDATE)은
   단계적 noindex·308. 91% 공통 저자 박스 탈템플릿화 포함(구글 scaled content abuse 방어).
2. **전문화 — E-E-A-T 해자**: 익명("스튜디오 놀") pSEO에서 **황경하 실명 저자성**으로 전환.
   [[entities/project-release-flagship]]의 Path B("프로듀서+네트워크가 상품")와 같은 방향.
   신규 쿼터(월 2~4편)는 성우 클러스터 → 발매 연계 순 (기결정 우선순위 준용).
3. **강화 — 유통·전환·측정**: 네이버 채널 개통(전환율 구글의 4.7배, 사실상 미개통),
   카카오 우선 CTA, GSC 감사 크론 분기 티어 재배정 루프.

**전제(번복 아님)**: 대량 생성 금지·월 2~4편 수작업([../p1-followups-2026-07.md](../p1-followups-2026-07.md) §1-7),
근접중복 GSC 강자 canonical 원칙(§1-5), 잔여 지역 허브 유지(§1-6)를 모두 유지한 위에서의 전략.

## 왜

[../gsc-audit-output.csv](../gsc-audit-output.csv) (1,562행, 2026-07-14 갱신) 기준:

- 티어 분포 KEEP 517 / WATCH 266 / WATCH_LOW 91 / **NOINDEX_CANDIDATE 688(44%)** — 트래픽이
  소수 승자에 집중, 신규 양산의 한계 효용 소진.
- 스토리 95%가 2026-04-06~09 나흘간 생성(발행 지문), 91%(1,428편)가 동일 저자 박스 템플릿 —
  scaled content abuse 정책의 타깃 프로필이라 방어적 개선 시급.
- 성과 데이터([[entities/channel-gsc]]): daw-choice1 69클릭·practice-room-startup1 47클릭 등
  상위 집중, "성우 녹음실" pos 34.8이 최대 갭.

## P0 실행 결과 (2026-07-18, 채택 당일)

1. **플래그십 티어 확정** — F15(업그레이드 대상) + B5(바이라인 확장) = 20편.
   기준·업그레이드 각도·운영 규칙: [../story-tier-flagship-2026-07.md](../story-tier-flagship-2026-07.md).
   티어 재산정 2026-10.
2. **CTR 수술 1차 + 실험 장부 신설** — [../ctr-surgery-log.md](../ctr-surgery-log.md).
   수술 3건(audioformat1 어순 병기 자연화 + ctrTargets 테스트 완화, seoul-metro-guide1
   "연신내에서 연신내" summary 버그 수정 + 타이틀 재조준, ktx-gyeongbu-guide1 당일 왕복 재조준).
   기변경 3건(copyright-cover1·songstructure1·falsetto1)은 **측정 중 동결**(리뷰 8/4·8/14).
   상세 타임라인: [[decisions/seo-ctr-optimization]].
3. **근접중복 전수 스캔 완료** (p1 §1-5 미해결 과제 해소) —
   [../near-duplicate-scan-2026-07.md](../near-duplicate-scan-2026-07.md).
   1,093편 전수 비교(59.7만 페어): J≥0.45 **603페어**, 양측 색인 가능 **591페어**.
   cover 계열은 본문 중복 무혐의(J≤0.134 — album-art 선례와 같은 쿼리 카니벌라이제이션 유형).
   최고 유사 비지역 페어 vocal-warm-up1/vocal-warmup1(J=0.715). **통합 실행은 P1**.
4. **실명 저자성 인프라 구축** —
   - `/[locale]/author` 프로필 페이지 신설(ProfilePage + mainEntity `#person-hwang`).
     콘텐츠 SSOT는 `data/authorProfile.ts`(검증 사실만: 70+ 발매작·15년 경력·2017 한국대중음악상
     선정위원 특별상·ggac/Bugs 프로필).
   - Person entity 통일: article·releaseProject 스키마의 Person.url을 `/author`로 일원화,
     운영자 sameAs·award를 releaseProject에도 병합, `knowsAbout` 단일 소스화(`utils/schema/person.ts`).
   - `author: 황경하` frontmatter가 외부 기고자로 다운그레이드되던 스키마 버그 수정.
   - 스토리 상세에 가시적 바이라인 렌더(운영자명은 /author 링크), 플래그십 20편 frontmatter 전환.
   - llms.txt에 프로필 페이지 등재.
   - 검증: type-check·lint·전체 jest 305개 통과, dev 렌더로 /ko/author 200 + 스키마·바이라인 확인.

## P1 실행 (2026-07-18 착수)

1. **근접중복 통합 실행 + 재프레이밍** — [../near-duplicate-consolidation-2026-07.md](../near-duplicate-consolidation-2026-07.md).
   핵심 판단: 스캔이 잡은 비지역 501페어의 대부분은 practice-room 악기 계열의 **템플릿 스핀**(같은 스캐폴딩·다른 주제)이지 중복 URL이 아니다 → 페어 단위 308이 아니라 **탈템플릿화·꼬리정리 트랙** 사안. 실제 308은 **명백한 동의어 슬러그 4쌍만** 실행(vocal-warmup1→warm-up1, guitar-scale-position1→scale-pos1, guitar-fingerpick-adv1→fingerstyle-adv1, guitar-jazz-chord1→jazz-voicing1). regionRedirectMap 4등재 + 본문링크 16곳 갱신 + practiceRoomRelatedGuides 약자 4줄 제거. storyLinks 테스트 통과(끊긴 링크 0).
2. **성우 클러스터 신규 2편(분기 쿼터 완료)** — 최대 buyer-intent 갭 공략. 기존 성우 콘텐츠는 전부 공급자 관점인데 이 둘은 **의뢰자(구매자) 관점**이라 카니벌라이제이션 없음. 둘 사이 Jaccard 0.068로 상호 차별화 + 상호링크. 황경하 저자, 가격 가드(성우 10만원/시간, "3만원" 미사용) 준수.
   - `voice-actor-hiring-quote-cost.md`(5,494자) — "성우 섭외 견적/비용/외주" 일반 원리(노출 90+·클릭 0). serviceRelatedStories voice-acting 편입.
   - `commercial-narration-cost-guide.md`(5,248자) — 광고 특화(톤 버전·매체별 라우드니스·납품 포맷).
3. **플래그십 탈템플릿 — F15/B5 전편 완료(10편)** — 91% 공통 "자주 권하는 3가지" 얕은 템플릿 저자박스를
   각 주제별 황경하 1인칭 실질 섹션으로 교체(재템플릿 방지 위해 편마다 구조·내용 차별화), 랭킹 콘텐츠 보존.
   - producer1(pos 1.9 #1, 2,511→4,832)·recording-price1(견적 읽는 법)·practice-room-transfer1(CTR 9.81%, 운영자 1인칭)
   - practice-room-startup1·plugins1·song-key1·music-marketing1·loudness1·bass-mixing1·soundproof-rehearsal-seoul1
   - 서비스 가드 준수: soundproof는 "합주실 미운영" 정본 보존, music-marketing은 검증된 15년 발매PR 사실만.
   - 남은 shallow-box 스토리 ~1,417편(전체 91% 중 F15 제외)은 탈템플릿 백로그.
4. **꼬리 noindex 재평가 — "688편"은 stale 감사 착시** — [../tail-noindex-assessment-2026-07.md](../tail-noindex-assessment-2026-07.md).
   `gsc-audit-output.csv`가 **2026-05-21 스냅샷(2개월 stale)**이라 NOINDEX_CANDIDATE 688편에 실제 가치 페이지
   (album-artwork1 146노출, audiobook-narration... 118노출)가 섞여 있었다. 최신 GSC(07-14)로 재도출한 진짜 꼬리는
   **55편 → 가드(최근발행·buyer-intent·인바운드링크) 후 깔끔한 프룬 후보 6편뿐**. → **대량 noindex 불필요·위험**,
   진짜 액션은 **감사 데이터 갱신**. 대량 자율 실행을 하지 않은 판단이 옳았음을 데이터로 확인.

## 탈템플릿 백로그 진행 (2026-07-19, 고트래픽 bespoke 방식 채택)

사용자 결정: 대량 렌더처리·삭제가 아니라 **고트래픽 페이지부터 수작업 1인칭 bespoke 교체**(플래그십과 동일 playbook, 무위험·순증분).

- **누계 31편 탈템플릿 완료** = 플래그십 10편 + 고트래픽 비플래그십 21편(3배치).
- 비플래그십 13편(클릭순): coverrecording1(54)·vst-guide1(43)·bass-5string1·streaming-platforms1·melodyne1·
  fabfilter1·flstudio1(박스2개)·breath-support1·pitch-correction1·recording-environment1·bass-recording1·
  mastering-tips1·condenser-mic1.
- 재템플릿 방지: 유사 주제 페어도 상호 Jaccard 0.03~0.06으로 차별화 확인. 매 편 factGuards·storyLinks 통과.
- 3차 배치 추가: practice-room-vs-karaoke1·ep-making1·headphone-mixing1·sound-engineer1·music-video1·mid-side1·vocal-nutrition1·ableton1.
- **남은 백로그: 약 1,396편**(트래픽순 계속). 클릭 <18 구간으로 진입 — ROI 점감, 배치별 판단.

## 남은 P1 (2026-Q3)

- 탈템플릿 백로그 이어가기(고트래픽순) + 플래그십 개별 **심화**(실사례·원본데이터).
- 노출0·인바운드링크 보유 43편 본문 차별화([../near-duplicate-consolidation-2026-07.md](../near-duplicate-consolidation-2026-07.md) 트랙과 통합).
- **감사 데이터 갱신**(gsc-audit-output.csv 최신화 — cron 재실행 점검). 꼬리 프룬 6편은 선택·저우선.
- 발매 연계 신규(indie-release-guide 허브 스포크).
- 네이버 플레이스 등록·블로그 발행 개시([../p3-external-channels-runbook.md](../p3-external-channels-runbook.md)) — **사람 실행 필요**.
- CTR 리뷰일: 8/4(songstructure1·falsetto1), 8/14(copyright-cover1), 8/15(7/18 수술 3건).
