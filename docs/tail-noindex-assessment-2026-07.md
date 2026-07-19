# 꼬리 noindex 재평가 — "688편"은 stale 감사 착시 (2026-07-19)

> [story-content-strategy-2026-07.md](story-content-strategy-2026-07.md) P1 "꼬리 688편 noindex" 항목의 실사 결과.
> **결론: 대량 noindex는 불필요·위험하다. 실제 꼬리는 미미하며, 필요한 조치는 감사 데이터 갱신이다.**
> ⚠️ 이 문서는 실행하지 않았다. noindex는 검색 노출에 영향을 주는 조치이므로 사람 승인 후에만.

## 무엇이 문제였나 — 감사 CSV가 2개월 stale

전략 P0에서 "NOINDEX_CANDIDATE 688편(44%)"의 근거였던 `docs/gsc-audit-output.csv`는
**2026-05-21 스냅샷**이다(git 확인). 최신 GSC 원천 `docs/gsc-raw/page-all.csv`는 **2026-07-14**.
두 달 사이 색인이 확산되며 많은 페이지가 노출을 얻었는데, stale 감사는 이를 반영하지 못한다.

**증거 — 688편에 실제 가치 페이지가 섞여 있다:**

| slug | stale 감사(05-21) | 최신 GSC(07-14) | 판정 |
|---|---|---|---|
| `album-artwork1` | 0/0 NOINDEX_CANDIDATE | **146 노출 / 3 클릭 / pos 6.3** | 308 통합의 canonical — noindex하면 재앙 |
| `audiobook-narration-recording-cost-time` | 0/0 NOINDEX_CANDIDATE | 118 노출 / 2 클릭 | buyer-intent 페이지 |

→ **stale 감사의 tier를 noindex 실행 리스트로 쓰면 가치 페이지를 죽인다.** 대량 자율 실행을 하지 않은 것이 옳았다.

## 최신 GSC로 재도출한 진짜 꼬리

방법: 색인 대상 ko 스토리(리다이렉트·robots noindex 제외) 1,081편 중 **최신 GSC(page-all + page-query, 2026-07-14)에 노출이 전혀 없는** 것 = 진짜 꼬리.

| 단계 | 필터 | 남은 수 |
|---|---|---|
| stale 감사 NOINDEX_CANDIDATE | — | 688 (**신뢰 불가**) |
| 최신 GSC 노출 0 | 실제 데이터 | **55** |
| − 최근 발행(2026-05+, 노출 얻을 시간 부족) | 신규 2편(성우)·재발매·웨딩견적 등 5편 | 50 |
| − buyer-intent 롱슬러그 | bulgwang-mixing-club-2nd | 49 |
| − **인바운드 내부링크 보유**(noindex 시 링크 끊김) | 43편 | **6** |

**진짜 깔끔한 프룬 후보: 6편** (인바운드 0 · 저노출 · 2026-04 이전 발행):
`review1`(1,269자)·`review4`(1,581)·`hip1`(1,741)·`practice-room-housewife1`(1,823)·`direction1`(1,848)·`practice-room-recital1`(2,083).
※ 일부(`review1` 등)는 공백제외 글자수가 thin 게이트(1,500자)에 근접/미만이라 이미 자동 noindex 대상일 수 있음 — 별도 확인.

## 43편은 noindex 대상이 아니라 탈템플릿 대상

노출 0이지만 **인바운드 내부링크가 있는 43편**(예: `mixing-chain1` inbound 30, `beatmaking1` 17,
`voice1` 2 — 성우 신규글·producer1에서 링크)은 noindex하면 그 링크들이 noindexed 페이지를 가리키게
되어 링크 자산이 낭비된다. 이들은 **탈템플릿화·본문 차별화로 노출을 얻게 만드는 것**이 맞다(꼬리정리 아님).

## 권고

1. **대량 noindex 하지 말 것.** "688 꼬리"는 stale 데이터 착시. 실제 프룬 가치가 있는 건 6편뿐이고 그 upside도 미미.
2. **감사 데이터 갱신이 진짜 액션.** `docs/gsc-audit-output.csv`(2026-05-21)를 최신 GSC로 재생성해야 tier가
   신뢰 가능해진다. `pages/api/cron/gsc-audit.ts` 크론이 최신 데이터로 재실행되는지 점검 필요.
3. **6편 프룬은 선택.** 승인 시 `robots: noindex, follow` 프론트매터 추가(사이트맵 자동 제외, 링크 보존, 가역).
   단 upside가 작아 우선순위 낮음. thin 게이트로 이미 처리되는지 먼저 확인.
4. **43편은 탈템플릿 백로그로.** [near-duplicate-consolidation-2026-07.md](near-duplicate-consolidation-2026-07.md)의
   탈템플릿 트랙과 통합.

## 재현

- `scripts/`에 커밋하지 않은 1회성 분석. 방법: page-all+page-query에서 노출>0 slug 집합을 만들고,
  색인 대상 스토리에서 차집합 → 발행일·buyer-slug·인바운드링크 가드. (분석 스크립트는 세션 스크래치패드.)
