# Studio NOL — GSC 진단 리포트 (2026-05-18)

> 데이터 기준: GSC 90일 (2026-02-19 ~ 2026-05-17) + 28일 추세  
> 데이터 소스: `docs/gsc-raw/` (3개 파일), `docs/gsc-audit-output.csv`  
> GA4 섹션: 서비스 계정 미설정 → [설정 가이드 §7] 후 `scripts/ga4-fetch.mjs`로 보완 가능

---

## 0. 요약 (한눈에)

| 지표 | 값 | 평가 |
|---|---|---|
| 총 색인 페이지 (90d 내 1회 이상 노출) | **1,082** / 1,569 | 31% 미노출 |
| 총 노출 (90d) | 48,289 | — |
| 총 클릭 (90d) | 1,207 | — |
| 평균 CTR | **2.50%** | 3% 목표 미달 |
| 평균 순위 | **7.1위** | 1페이지 안착 |
| 일평균 클릭 (최근 28d) | **63.6회** | 4월 초 대비 9배 성장 중 |
| 서비스 직결 페이지 CTR | `/pricing` **1.21%** | 전환 페이지 치고 낮음 |
| 최고 ROI 클러스터 | `practice-room-station` **CTR 7.56%** | — |
| 최악 ROI 클러스터 | `city-ktx-visit` **CTR 1.61%** / 143페이지 | — |

### ⚠️ TOP 3 긴급 이슈
1. **카니벌라이제이션 11건** — "녹음실" 쿼리에 11개 페이지가 동시 경쟁 중
2. **`pricing` 페이지 CTR 1.21%** — 가장 중요한 전환 페이지인데 제목이 클릭을 못 유인
3. **`practice-room-vocal-diction1`** — 4~10위(pos 7.3)에 437회 노출되는데 클릭 0회 → 제목·설명 즉시 수정 필요

---

## 1. 현재 인프라 상태

### 1-A. GSC 수집 파이프라인
| 항목 | 현황 | 이슈 |
|---|---|---|
| Cron 실행 | `0 19 * * *` (매일 04:00 KST) | 코드 주석은 "주1회 cron" — **불일치** |
| 저장소 | Vercel Blob `gsc/latest.json` + `gsc/history/` | 로컬 CSV는 수동 갱신만 |
| 이메일 리포트 | `hwangtab@gmail.com` 매일 발송 중 | 스팸성 잡음 — 주1회로 정정 권고 |
| 데이터 차원 | page × clicks/impressions 집계만 | query/CTR/position 차원 없음 → `scripts/gsc-fetch-detail.mjs`로 보완 완료 |

**즉시 수정 권고**: `vercel.json` cron을 `0 19 * * 1` (주1회 월요일)로 변경

### 1-B. GA4 수집 파이프라인
| 항목 | 현황 | 이슈 |
|---|---|---|
| 측정 ID | `G-KYGP18G36J` | — |
| 로딩 전략 | interaction-deferred (PSI 최적화) | 봇/빠른 이탈 미측정 |
| 이벤트 | `lead_click_kakao/phone`, `lead_submit_success`, `lead_form_start/abandon` | 구현 완료 |
| 서버 수집 | **없음** | GA4 데이터를 코드에서 조회·분석 불가 |
| 서비스 계정 | **미설정** | `scripts/ga4-fetch.mjs` 실행 불가 |

---

## 2. 성장 추세 (28일)

```
4/20   7클릭 / 357노출  ← 4월 초 사이트 색인 시작
4/22  25클릭 / 1,082노출
4/24  74클릭 / 2,317노출
4/30  87클릭 / 3,035노출
5/05  88클릭 / 3,208노출
5/12  99클릭 / 3,424노출  ← 최근 7일 평균 85클릭/3,158노출
5/15  89클릭 / 2,960노출
```

- **28일간 클릭 1,653회** (일평균 63.6)
- 4/20 대비 5/15는 클릭 **12.7배**, 노출 **8.3배** 성장 — 신규 색인 확산 국면
- 평균 순위는 6.5~7.2 사이에서 안정적 → 랭킹은 나쁘지 않음, CTR 개선이 다음 레버

---

## 3. 페이지 순위 분포

| 순위 구간 | 페이지 수 | 비율 | 액션 |
|---|---:|---:|---|
| **1~3위** | 27 | 2.5% | 스니펫 최적화 |
| **4~10위** | 948 | **87.6%** | ← 대부분 여기에 밀집 — CTR이 수익 |
| **11~20위** | 98 | 9.1% | quick-win 대상 |
| **21~50위** | 8 | 0.7% | — |
| **50위 초과** | 1 | 0.1% | — |

**핵심 시사점**: 페이지 88%가 이미 1페이지 안에 있음. 이 사이트의 클릭 성장 레버는 랭킹 올리기가 아니라 **CTR 최적화(제목·설명 리라이트)**다.

---

## 4. 클러스터별 KPI

| 클러스터 | 페이지 | 클릭 | 노출 | CTR | 판단 |
|---|---:|---:|---:|---:|---|
| `practice-room-station` | 21 | 13 | 172 | **7.56%** | 최고 ROI — 확장 우선 |
| `other` (정보형 가이드) | 1,356 | 1,175 | 47,083 | 2.50% | 대부분 여기 |
| `seoul-district-studio` | 49 | 8 | 351 | 2.28% | 보통 |
| `city-ktx-visit` | 143 | 11 | 683 | **1.61%** | 최악 ROI — 143페이지에 클릭 11개 |

### city-ktx-visit 클러스터 진단
- "OO에서 서울 녹음실 방문 가이드" 143페이지 — 67%가 NOINDEX_CANDIDATE
- 검색 수요 자체가 얕은 long-tail ("당진에서 서울 녹음실") — 이 클러스터에 콘텐츠 추가 투자 **중단** 권고
- 성과 있는 일부(KEEP/WATCH 47개)만 유지하고 나머지 96개는 단계적 noindex 처리 검토

---

## 5. 서비스 페이지 성과

| 페이지 | 클릭 | 노출 | CTR | 순위 | 진단 |
|---|---:|---:|---:|---:|---|
| `/ko/practice-room` | **49** | 1,141 | **4.29%** | 6.7 | 사이트 최고 서비스 페이지 |
| `/ko` (홈) | 24 | 369 | 6.50% | 5.9 | 브랜드 검색 유도 잘 됨 |
| `/ko/pricing` | 3 | 248 | **1.21%** | 5.4 | ⚠️ 전환 페이지인데 CTR 매우 낮음 |
| `/ko/voice-acting` | 9 | 139 | **6.47%** | **13.1** | quick-win: 순위 10위 이내로 진입 시 30+ 클릭 예상 |
| `/ko/about` | 2 | 137 | 1.46% | 4.9 | 낮은 CTR — 설명 리라이트 필요 |
| `/ko/contact` | 2 | 68 | 2.94% | 4.7 | — |
| `/ko/wedding-song` | 1 | 30 | 3.33% | 7.9 | 노출 적음 |
| `/ko/portfolio` | 1 | 25 | 4.00% | 8.0 | 노출 적음 |
| `/ko/lesson` | 0 | 12 | 0% | 9.6 | 노출·클릭 모두 없음 — 콘텐츠 보강 필요 |

### `/ko/pricing` 즉시 개선 필요
- 순위 5.4위, 노출 248회이지만 CTR 1.21% — 제목/설명이 클릭 유인을 못 함
- 현재 meta description이 가격표 나열보다 가치 제안을 앞세워야 함
- 비교: `/ko/practice-room` 동순위(6.7위)에서 CTR 4.29% 달성 중

---

## 6. Quick-Win 페이지 (position 10~20, 노출 ≥ 50)

| slug | 순위 | 노출 | CT릭 | CTR | 예상 개선 |
|---|---:|---:|---:|---:|---|
| `noise-reduction1` | **15.5** | 756 | 16 | 2.12% | 1페이지 진입 시 클릭 3~4배 |
| `phase1` | 11.0 | 308 | 10 | 3.25% | 20+ 클릭 예상 |
| `karaoke-vs-studio1` | 11.7 | 113 | 2 | 1.77% | CTR도 낮음 — 제목 수정 병행 |
| `voice-acting` 페이지 | **13.1** | 139 | 9 | **6.47%** | ⭐ 전환 페이지 — 1페이지 진입 우선 |
| `practice-room-yeonsinnae1` | 10.7 | 85 | 3 | 3.53% | 로컬 키워드 강화 |
| `kpop-production1` | 10.4 | 96 | 3 | 3.13% | — |

**`noise-reduction1`이 가장 큰 기회**: 756 노출 × 현재 CTR 2.12% = 16클릭. 순위 5위로 올리면 예상 CTR 8% → 60+클릭/월

---

## 7. CTR 개선 대상 (순위 4~10위인데 CTR 0~1%, 노출 100+)

이 페이지들은 **1페이지에 이미 올라와 있으면서 클릭을 못 받는** 것 — 제목·메타 설명 리라이트만으로 즉시 클릭 증가 가능.

| slug | 순위 | 노출 | CTR | 진단 |
|---|---:|---:|---:|---|
| `practice-room-vocal-diction1` | 7.3 | 437 | **0%** | 437번 보여줬는데 0클릭 — 제목이 검색 의도에 안 맞음 |
| `vocal-doubling1` | 6.5 | 192 | **0%** | — |
| `practice-room-vocal-resonance-chest1` | 5.9 | 187 | **0%** | — |
| `daechi1` | 7.6 | 376 | **0%** | 지역 LP — 검색 의도 미스매치 |
| `song-structure1` | ~7 | 887 | **0.79%** | 1,050 imp의 `songstructure1`과 카니벌라이즈 중 |
| `falsetto1` | ~7 | 809 | **0.87%** | 팔세토 쿼리 565 노출 — CTR 낮은 이유 확인 필요 |
| `mastering1` | ~7 | 368 | **0.27%** | — |

---

## 8. 카니벌라이제이션 매트릭스

동일 쿼리에 여러 페이지가 경쟁하여 서로의 순위를 깎는 구조:

| 쿼리 | 경쟁 페이지 수 | 핵심 페이지 | 중복 페이지 |
|---|---:|---|---|
| **녹음실** | **11** | `karaoke-vs-studio1` | jongno1, incheon1, suseong1 등 8개 |
| **핑거피킹** | 5 | `practice-room-fingerstyle1` | `guitar-fingerpick-pattern1` 등 4개 |
| **보컬 컴프레서** | 4 | `vocal-compression1` | `compress1`, `compressor1` 등 |
| **성우 녹음** | 4 | `/ko/voice-acting` (서비스 페이지) | `narration1`, `voiceactor1` |
| **음악 스튜디오 월세** | 4 | `practice-room-monthly1` | `practice-room-nodeposit1` 등 |
| **팔세토** | 3 | `practice-room-vocal-falsetto-technique1` | `falsetto1` |
| **음원 발매 방법** | 3 | — | `debut1`, `indie-label1`, `single-release1` |
| **연습실 월세** | 3 | `practice-room-monthly1` | `practice-room-nodeposit1` |

### 주요 카니벌라이제이션 케이스 상세

**`songstructure1` vs `song-structure1`** (직접 중복):
- `songstructure1`: 노출 1,050 / 클릭 13 / CTR 1.2%
- `song-structure1`: 노출 887 / 클릭 7 / CTR 0.79%
- 동일 주제 2페이지가 합산 1,937 노출 분산. 하나로 통합하면 CTR·순위 모두 개선 예상.

**성우 녹음 쿼리**:
- `/ko/voice-acting` (서비스 페이지)가 "성우 녹음실" 쿼리에서 CTR 30.77%로 매우 높음
- 그러나 `narration1`, `voiceactor1` 같은 스토리 페이지가 같은 쿼리에서 경쟁 → 서비스 페이지 순위 희석

---

## 9. 검색어 분석

### 노출 TOP 10 (정보형 dominant)

| 쿼리 | 노출 | 클릭 | CTR | 의도 |
|---|---:|---:|---:|---|
| 팔세토 | 565 | 6 | 1.06% | 정보형 |
| 딕션 | 323 | 0 | 0% | 정보형 |
| epk | 313 | 1 | 0.32% | 정보형 |
| 프리코러스 | 260 | 3 | 1.15% | 정보형 |
| wav mp3 차이 | 248 | 1 | 0.40% | 정보형 |
| 배경 잡음 제거 | 212 | 0 | 0% | 정보형 |
| 림샷 | 201 | 3 | 1.49% | 정보형 |
| 멜리즈마 | 189 | 2 | 1.06% | 정보형 |
| 에디팅 | 157 | 2 | 1.27% | 정보형 |
| 보컬 녹음용 마이크 추천 | 134 | 3 | 2.24% | 정보형+구매 |

**노출 상위 10개 쿼리 중 9개가 순수 정보형** — 직접 전환 기여 낮음.

### 거래형 키워드 성과 (진짜 매출 연결 가능)

| 쿼리 | 노출 | 클릭 | CTR | 순위 | 판단 |
|---|---:|---:|---:|---:|---|
| 연습실 월세 | 31 | 3 | **9.68%** | 3.2 | TOP3, 전환율 최강 |
| 음악연습실 월세 | 73 | 3 | **5.00%** | 3.7 | 강력한 구매 의도 |
| 음악작업실 월세 | 66 | 7 | **7.41%** | 6.5 | 월세 키워드 군 중 최다 클릭 |
| 방음 연습실 월세 | 49 | 1 | 2.04% | 3.8 | — |
| 성우 녹음실 | 13 | 4 | **30.77%** | 38.3 | ⚠️ CTR 엄청 높은데 순위 38위 — 콘텐츠·링크 빌딩으로 급상승 가능 |
| 보컬 eq | 48 | 4 | **8.33%** | 6.1 | — |
| 음악 프로듀서 되는 법 | 44 | 5 | **11.36%** | 2.5 | TOP3, 정보형이지만 팬 유입 |

**"성우 녹음실" 키워드가 숨겨진 보석**: CTR 30.77%로 검색자가 바로 전환하는데 현재 38위. 3-5위에 올리면 월 50+ 성우 문의 예상.

---

## 10. 브랜드 검색

GSC 결과에 "스튜디오놀", "studio nol", "studionol" 등 **브랜드 키워드 노출 0건** — 브랜드 인지도가 아직 없는 상태. 인스타그램(`@studio_nol_`) 운영 등 오프라인 브랜딩 연계 콘텐츠로 브랜드 검색 유도 필요.

---

## 11. 기술 이슈

| 이슈 | 설명 | 조치 |
|---|---|---|
| `http://studionol.co.kr/` 색인됨 | HTTP 비보안 버전이 GSC에 105 노출 | HTTPS 리디렉션 서버 레벨 확인 |
| `/en/pricing` 색인됨 (noindex 의도) | 88 노출 — sitemap에서 제외됐지만 아직 크롤됨 | Google Search Console에서 삭제 요청 |
| cron 매일 메일 발송 | `vercel.json` 매일 실행, 코드 주석은 "주1회" | `vercel.json` → `0 19 * * 1` 변경 |

---

## 12. GA4 데이터 (미수집 — 설정 가이드)

현재 `GA4_SERVICE_ACCOUNT_KEY` 미설정으로 Data API 조회 불가. 이 섹션이 채워지면 교차분석(GSC 클릭 ≠ GA4 세션 갭, CTA 전환율 등)이 가능해짐.

### 설정 방법 (10분)
1. [Google Cloud Console](https://console.cloud.google.com) → IAM → 서비스 계정 생성 → JSON key 다운로드
2. [GA4 Admin](https://analytics.google.com) → Property Access Management → 서비스 계정 이메일 Viewer 추가
3. `.env.local`에 추가:
   ```
   GA4_PROPERTY_ID=000000000
   GA4_SERVICE_ACCOUNT_KEY=/path/to/key.json
   ```
4. 실행: `node --env-file=.env.local scripts/ga4-fetch.mjs`
5. 생성 파일: `docs/ga4-raw/landing.csv`, `events.csv`, `source.csv`, `device.csv`

---

## 13. 액션 리스트 (우선순위별)

### 🔴 P1 — 즉시 (1~2주)

| # | 작업 | 예상 효과 |
|---|---|---|
| P1-1 | **`songstructure1` + `song-structure1` 통합** — 하나를 canonical로 301 redirect | 1,937 imp 통합 → CTR·순위 동시 개선 |
| P1-2 | **`practice-room-vocal-diction1` 제목·메타 수정** — pos 7.3에서 437 imp이지만 클릭 0 | 0% → 2%+ CTR 목표 = +8 클릭/월 |
| P1-3 | **`pricing` 페이지 메타 리라이트** — 현재 CTR 1.21%, 순위 5.4위 | CTR 3% 목표 = +5 클릭/월 |
| P1-4 | **`vercel.json` cron `0 19 * * 1`로 변경** — 매일 메일 발송 → 주1회 | 이메일 노이즈 제거 |
| P1-5 | **GA4 서비스 계정 설정 + `scripts/ga4-fetch.mjs` 실행** | 리드 전환 데이터 확보 |

### 🟡 P2 — 단기 (1~2개월)

| # | 작업 | 예상 효과 |
|---|---|---|
| P2-1 | **`noise-reduction1` 콘텐츠·내부 링크 강화** — pos 15.5 → 10 이내 목표 | 756 imp × CTR 3배 = +32 클릭/월 |
| P2-2 | **`/ko/voice-acting` 내부 링크 집중** — pos 13.1 → 10 이내 | 전환 페이지 노출 증가 |
| P2-3 | **CTR 0% 대기업(vocal-doubling, vocal-resonance-chest)** 제목 수정 | — |
| P2-4 | **"성우 녹음실" 키워드 콘텐츠 빌드** — 현재 38위 (CTR 30%!) | 10위 이내 진입 시 월 50+ 문의 |
| P2-5 | **보컬 컴프레서 카니벌라이제이션 해소** — 4개 페이지 정리 | — |
| P2-6 | **`/ko/lesson` 노출 0** — 레슨 관련 롱테일 콘텐츠 or 내부 링크 강화 | — |

### ⚪ P3 — 중장기 (3개월+)

| # | 작업 |
|---|---|
| P3-1 | `city-ktx-visit` 클러스터 96개 NOINDEX_CANDIDATE → 단계적 noindex 처리 |
| P3-2 | `practice-room-station` 클러스터 확장 (현재 21페이지, CTR 7.56%) |
| P3-3 | 브랜드 검색 활성화 — 인스타·카카오채널 운영 강화 + 브랜드 언급 콘텐츠 |
| P3-4 | GA4 × GSC cross-reference 정기 리포트 자동화 (월 1회 cron으로 통합) |
| P3-5 | `http://studionol.co.kr/` HTTP 노출 → HTTPS 리디렉션 서버 설정 확인 |

---

## 14. 파일 인벤토리

```
docs/
├── gsc-audit-output.csv        # 1,569 페이지 cluster×tier 집계 (수동 갱신)
├── gsc-raw/
│   ├── page-query.csv          # 1,461행 — page×query×CTR×position 90일
│   ├── page-all.csv            # 1,082행 — page×metrics 90일 (position 포함)
│   ├── quick-win.csv           # 10행 — pos 10-20, imp≥50 페이지
│   └── trend.csv               # 26행 — 일별 사이트 전체 추세 28일
└── ga4-raw/                    # ← GA4 서비스 계정 설정 후 채워짐
    ├── landing.csv
    ├── events.csv
    ├── source.csv
    └── device.csv

scripts/
├── gsc-pseo-audit.mjs          # 기존 — gsc-audit-output.csv 갱신용
├── gsc-fetch-detail.mjs        # 신규 — gsc-raw/ 갱신용 (이번 진단 생성)
└── ga4-fetch.mjs               # 신규 — ga4-raw/ 갱신용 (GA4 계정 설정 후 사용)
```
