# Wikidata 등록 초안 — 황경하 / 스튜디오 놀

> 2026-07-28 작성. GEO/AEO 감사 Phase 1 최우선 항목.
> **등록은 황경하 본인 계정으로 진행해야 합니다** — 자기 자신·자기 사업체 항목을 만들 때는
> Wikidata의 이해충돌(COI) 관례상 토론 페이지에 관계를 밝히는 편이 안전합니다.

## 왜 이걸 먼저 하나

ChatGPT가 답변에서 인용하는 출처의 상당수가 위키 계열입니다. 온사이트 신호(스키마·llms.txt·콘텐츠)는
이미 상위권인데 **오프사이트 엔티티가 하나도 없어서**, AI가 "황경하"를 물었을 때 동명이인과 구분할
근거가 없습니다. 실제로 검색하면 다른 황경하들과 뒤섞입니다.

Wikidata는 위키백과보다 저명성 기준이 느슨하고(구조화된 식별자만 있어도 등재 가능), 항목이 생기면
AI 엔티티 해석의 앵커가 됩니다. 나무위키는 삭제 리스크가 있어 뒤로 미룹니다.

---

## 항목 1 — 황경하 (Person)

### 기본 정보

| 필드 | 값 |
|---|---|
| 레이블 (ko) | 황경하 |
| 레이블 (en) | Hwang Kyung-ha |
| 설명 (ko) | 대한민국의 음악 프로듀서·오디오 엔지니어 |
| 설명 (en) | South Korean music producer and audio engineer |
| 별칭 | Hwang Gyeong-ha, 스튜디오 놀 대표 |

### 진술 (Statements)

| 속성 | 값 | 출처 |
|---|---|---|
| `P31` (instance of) | Q5 (human) | — |
| `P27` (country of citizenship) | Q884 (대한민국) | — |
| `P106` (occupation) | Q183945 (record producer), Q21925567 (audio engineer) | 본인 사이트·Bugs 프로필 |
| `P1416` / `P108` (employer/affiliation) | 스튜디오 놀 (항목 2 생성 후 연결) | studionol.co.kr |
| `P166` (award received) | 한국대중음악상 — 선정위원 특별상, `P585`(시점) 2017 | 한국대중음악상 시상 기록, 한겨레21 |
| `P856` (official website) | https://studionol.co.kr/ko/author | — |
| `P2003` (Instagram) | podopodopo | 계정 바이오에 studionol.co.kr 링크 |
| `P434` 계열 음악 식별자 | Bugs 아티스트 ID `20045652` 등 (아래 sameAs 표 참조) | — |

### 근거 자료 (출처로 붙일 것)

**✅ 검증 완료 (2026-07-28 직접 확인)**

- **노컷뉴스 (CBS)** — 김수정 기자, 「가난·페미니즘·강제철거 반대… 한대음을 빛낸 수상소감」,
  2017-03-01. https://www.nocutnews.co.kr/news/4741803
  - 제14회 한국대중음악상(2017-02-28) **선정위원회 특별상**을 음반 《젠트리피케이션》 참여
    음악인들과 민중가요 작곡가 윤민석이 수상했다고 명시.
  - 본문에 **"황경하 프로듀서"**로 직함과 함께 등장하며 수상 소감이 직접 인용됨
    (강제철거·우장창창 사태 언급).
  - → **Wikidata `P166`(award received)의 출처로 이 URL을 쓰면 됩니다.** 3자 언론 보도라
    저명성 근거로도 가장 강력합니다.

- Bugs 아티스트 페이지: https://music.bugs.co.kr/artist/20045652
- ggac.kr 아티스트 프로필: https://ggac.kr/artists/hwang-gyeong-ha

**미검증** — 한겨레21·ize 보도는 사이트 주석에만 언급돼 있고 실제 URL이 확인되지 않았습니다.
찾으면 출처로 추가하되, 못 찾아도 위 노컷뉴스 하나로 `P166` 근거는 충분합니다.

### 대표 작업 (P800 notable work 후보)

- 〈젠트리피케이션〉 (Various Artists, 2016) — 프로듀스·녹음·믹스
- 〈눈녹듯〉 (황경하, 2025-01-15, Studio NOL) — 작곡·편곡·연주·녹음·믹싱·마스터링 전 과정
- 티어라이너 〈Bite Me〉 (2026-02-22) — 보컬 녹음·믹싱

---

## 항목 2 — 스튜디오 놀 (Organization)

**항목 1을 먼저 만들고, 승인·정착된 뒤에 만드는 편이 안전합니다.** 개인보다 사업체가 저명성 시비에
걸리기 쉽습니다.

| 필드 | 값 |
|---|---|
| 레이블 (ko) | 스튜디오 놀 |
| 레이블 (en) | Studio NOL |
| 설명 (ko) | 서울 은평구의 음악 녹음·제작 스튜디오 |
| 설명 (en) | Music recording and production studio in Eunpyeong-gu, Seoul |

| 속성 | 값 |
|---|---|
| `P31` (instance of) | Q1852944 (recording studio) |
| `P17` (country) | Q884 (대한민국) |
| `P131` (위치) | 서울특별시 은평구 |
| `P625` (좌표) | 37.614353, 126.925887 |
| `P856` (공식 웹사이트) | https://studionol.co.kr |
| `P169` / `P1037` (대표·운영자) | 황경하 (항목 1) |
| `P571` (설립) | 2024 |

### ⚠️ 표기 주의

**한국스마트협동조합(kosmart)을 모조직(parent organization)으로 적지 마세요.** kosmart가 설립에
관여했으나 황경하가 인수해 독립 운영 중이며, 현재 모조직 관계가 아닙니다. 협력 관계로만 표현합니다.

일부 오래된 포트폴리오 크레딧에 "Studio NOL(한국스마트협동조합)" 표기가 남아 있는데, 이는 인수
이전 작업의 당시 크레딧입니다. Wikidata에는 현재 상태를 적습니다.

---

## 등록 후 할 일

1. 생성된 Q-ID를 `data/siteConfig.ts`의 `studioOperator.sameAs`에 추가
   (`https://www.wikidata.org/wiki/Q…`). 그러면 사이트의 모든 Article·Person 스키마가
   Wikidata 엔티티를 가리키게 됩니다.
2. `utils/schema/business.ts`의 `EntertainmentBusiness`에도 `sameAs`로 항목 2 연결.
3. 4~8주 뒤 ChatGPT·Perplexity에 "스튜디오 놀", "황경하 프로듀서"를 물어 엔티티 해석이
   개선됐는지 확인.

## 확인 필요

- [x] ~~수상 사실을 확인해 줄 3자 언론 보도~~ → **노컷뉴스 2017-03-01 확인 완료** (위 참조)
- [ ] 한국대중음악상 공식 사이트(koreanmusicawards.com)의 2017 수상 기록 페이지 URL —
      있으면 노컷뉴스와 함께 이중 출처로 붙이면 더 좋습니다
- [ ] Studio NOL 설립 연도 2024가 **인수 시점인지 최초 설립 시점인지** — Wikidata `P571`은
      최초 설립을 뜻하므로 구분이 필요합니다. 황경하 본인만 아는 사실입니다.
- [ ] 한겨레21·ize 보도 URL (선택 — 없어도 등록에 지장 없음)

---

## 부록 — 사이트에 바로 반영할 것

노컷뉴스 기사는 Wikidata와 별개로 **지금 당장 사이트 자산**이 됩니다. 감사에서 "황경하 프로듀서"
검색 시 제3자 검증 소스가 없는 것이 약점으로 잡혔는데, 이 기사가 그 공백을 메웁니다.

- `/author` 페이지에 "언론 보도" 섹션을 만들어 이 기사를 링크
- `Person` 스키마에 `subjectOf` 또는 `citation`으로 기사 URL 추가
- `studioOperator.sameAs`와는 성격이 다르므로 (sameAs = 본인 프로필, citation = 3자 보도)
  구분해서 넣을 것
