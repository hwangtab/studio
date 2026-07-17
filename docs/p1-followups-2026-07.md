# P1 후속 정리 — 발행 리듬 · 근접중복 · 잔여 지역 판단 (2026-07)

> 근접중복 통합(1-5), 잔여 지역 페이지 판단(1-6), 발행 리듬(1-7)의 결정 기록.
> 상위 전략은 [wiki/concepts/seo-strategy.md](wiki/concepts/seo-strategy.md)·[seo-content-calendar.md](seo-content-calendar.md) 참조.

---

## 1-5. 주제 근접중복 통합 (완료)

`album-art1` → `album-artwork1` **308 통합**.

| 슬러그 | 노출 | pos | 글자수 | 판정 |
|---|---|---|---|---|
| album-artwork1 | 146 | 6.3 | 6,478 | **canonical (유지)** |
| album-art1 | 18 | 6.6 | 6,017 | 약자 → 308 통합 |

- `lib/regionRedirectMap.json`에 `album-art1: album-artwork1` 추가 (middleware 308 + 사이트맵 REDIRECTED_SLUGS 자동 제외)
- `internalLinks.ts` "커버 아트" → album-artwork1로 갱신
- 본문 링크 3곳(distribution1·mix-delivery1·track-order1) → album-artwork1로 갱신 (308 홉 방지)

### 향후: 전수 근접중복 스캔 (미실행)

주제 변형 페어가 더 있을 수 있음(예: cover1/coverrecording1/커버 계열). 전수 유사도 스캔은
별도 작업으로 권고. 통합 시 항상 **GSC 강자(노출·순위·글자수)를 canonical로**, 약자를 308.

---

## 1-6. 잔여 지역 4편 판단 → **전부 유지** (도어웨이 아님)

1차 감사에서 "잔여 도어웨이 판단 필요"로 표시됐으나, 데이터 확인 결과 **정상 허브 페이지**임:

| 슬러그 | 노출 | pos | 인바운드 본문링크 | 판정 |
|---|---|---|---|---|
| seoul-metro-guide1 | 218 | 7.4 | **174** | 구조적 허브 — 유지 |
| ktx-honam-guide1 | 123 | 7.3 | 39 | 유지 |
| ktx-gyeongbu-guide1 | 75 | 5.4 | 30 | 유지 |
| dongjak1 | 70 | 6.6 | 14 | 유지 |

- 전부 노출 70~218·1페이지(pos 5.4~7.4)·인바운드 링크 다수 → 리다이렉트하면 최대 174개
  링크가 홉이 되어 **오히려 손해**. 도어웨이(고아·색인만·저품질)의 반대 특성.
- seoul-metro-guide1·ktx-gyeongbu-guide1은 pos 좋은데 CTR 0% → 별개의 **타이틀 CTR 이슈**
  (도어웨이 문제 아님). 여력 시 메타 리라이트 대상.

---

## 1-7. 발행 리듬

**대량 생성 금지 확정** (2026-05-31 결정 유지). 1,757편 포화 상태에서 추가는 doorway/중복 위험.

- **속도**: 월 2~4편 수작업 품질. 96%가 2026-04 단일월 집중된 발행 지문을 시간에 걸쳐 희석.
- **우선순위**: 신규 대량 < 기존 의뢰-의도 페이지 미세 SEO(메타·내부링크) < 클러스터 갭 채우는 소수 신규.
- **신규 발행 시 필수**: 5,000자+, H2·표·FAQ 3개+, 서비스 Pillar 링크 1개+, 관련 스토리 2~3개.
- **네이버 블로그 23편**(별개 자산)은 [p3-external-channels-runbook.md](p3-external-channels-runbook.md)
  순서대로 주 1편 발행 — 사이트 스토리 대량 생성과 혼동 금지.

### 분기 주제 후보 (클러스터 갭 우선)

- 성우 클러스터 심화(성우 섭외 견적·오디오북 단가 등 — /voice-acting 상업 쿼리 보강)
- 발매 프로젝트 연계(첫 EP 발매 비용, 세션 연주자 섭외 등 — indie-release-guide 허브 스포크)
- 연습실 월세 롱테일(신규 지역보다 기존 21개 dedicated LP 강화)
