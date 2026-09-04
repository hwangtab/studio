# 운영 로그 — 세어본 적 없는 것은 세어낼 수 없다

스튜디오를 돌리면서 실제로 일어난 일을 숫자로 남기는 곳이다.

## 왜 하는가

2026-07-29~30 운영자 인터뷰에서 배운 게 있다. 글에 넣을 사실을 물었더니 더할 것보다
뺄 것이 많았다(`docs/story-quality-pilot/retrospective.md` 부록). 기억으로 답하면
"대체로 그렇습니다" 이상이 안 나오기 때문이다.

한편 AI 검색엔진이 인용하는 건 어디서나 볼 수 있는 일반론이 아니라 **우리만 가진 숫자**다.
"보컬 세션은 보통 90~120분 걸립니다"는 아무나 쓸 수 있지만, "실측 47세션 평균 103분,
MR을 미리 보낸 쪽이 34분 짧았다"는 우리만 쓸 수 있다.

그 숫자는 지금부터 세어야 8주 뒤에 존재한다. 그래서 오늘 시작한다.

## 프라이버시 — 먼저 읽을 것

**이 저장소는 공개(public)다.** 그래서 원시 로그는 커밋하지 않는다.

- `docs/oplog/*.csv`는 이 디렉토리의 `.gitignore`가 제외한다. 로컬에만 남는다.
- 커밋되는 건 이 README와 `scripts/oplog.mjs`(기록 도구)뿐이다. 방법론은 공개해도
  문제가 없지만 견적 성사율·단가 협상 이력은 경쟁자가 볼 이유가 없다.
- **고객을 식별할 수 있는 것은 어떤 필드에도 적지 않는다.** 이름·팀명·곡명·연락처 모두
  금지다. 은평구 기반 소규모 시장이라 "2026-08-19 / 축가" 조합만으로도 특정될 수 있다.
  `notes`에는 작업 성격만 남긴다.
- 나중에 글로 나가는 건 **집계값**이다(평균·중앙값·건수·비율). 개별 행은 나가지 않는다.
  표본이 5건 미만인 구간은 집계도 내지 않는다 — 한 건이 특정되기 때문이다.

## 무엇을 기록하는가

세 가지다. 전부 "지금 확인하고 싶은 주장"과 짝이 맞는다.

| 파일 | 세는 것 | 이걸로 확인하려는 주장 |
|---|---|---|
| `sessions.csv` | 세션 소요 시간과 준비 정도 | "준비해 온 의뢰인의 세션이 30~50분 짧다" (`recording-price1`가 이미 주장 중인데 근거가 경험뿐) |
| `mixing-revisions.csv` | 믹싱 수정 라운드 수와 총 소요일 | 패키지 과금이 실제로 몇 라운드를 흡수하는지. 견적 산정의 근거 |
| `quotes.csv` | 견적에서 성사까지, 유입 채널별 | "카톡 리드 성사율이 높다"는 기존 판단의 실측. **네이버 유입은 GA4에 안 잡히므로 여기서만 보인다** |

## 어떻게 적는가

한 줄이면 된다. 세션 끝나고 바로가 제일 정확하다.

```bash
node scripts/oplog.mjs session --service vocal --minutes 95 --prep high
node scripts/oplog.mjs mixing --type single --rounds 2 --days 6
node scripts/oplog.mjs quote --channel kakao --service recording --outcome won --days 3
```

`--notes "축가, MR 키 안 맞아 현장 조정"` 처럼 메모를 붙여도 된다(고객 식별 정보 금지).
파일이 없으면 헤더와 함께 자동으로 만든다.

Claude Code를 쓰는 중이라면 그냥 말해도 된다. "오늘 보컬 세션 95분 걸렸고 준비는 잘
돼 있었어"라고 하면 위 명령으로 옮겨 적는다.

기록을 빠뜨린 날은 비워둔다. 나중에 기억으로 채우면 그 숫자는 처음 문제로 돌아간다.

## 필드 정의

**sessions.csv** — `date, service, duration_min, prep_level, notes`
- `service`: `vocal`(보컬 녹음) · `voiceover`(성우·내레이션) · `instrument`(악기) · `mixing`(입회 믹싱)
- `duration_min`: 준비 시간 포함, 실제 스튜디오 점유 분
- `prep_level`: `high`(MR·가사 숙지 완료) · `mid` · `low`(현장에서 MR 조정·가사 확인)

**mixing-revisions.csv** — `date, project_type, rounds, days_total, notes`
- `project_type`: `single` · `ep` · `album` · `voiceover`
- `rounds`: 의뢰인 피드백을 받아 다시 만진 횟수. 초벌 납품은 0
- `days_total`: 첫 납품부터 최종 확정까지 달력 일수

**quotes.csv** — `date, channel, service, outcome, days_to_close, notes`
- `channel`: **어떻게 알고 왔는가**(2026-09-04 확장). 첫 응대에서 "어떻게 알고 오셨어요?"를 고정으로 묻는다.
  - 경로: `chatgpt` · `other_ai`(Gemini·Perplexity 등) · `naver_place` · `naver_search` · `naver_blog` · `google_map` · `google_search` · `instagram` · `marketplace`(크몽·탈잉·숨고) · `referral`(지인)
  - 수단(경로를 못 들었을 때만): `kakao` · `email` · `naver`(톡톡) · `phone`
  - 왜: 믹싱 문의는 ChatGPT 추천, 녹음·연습실은 플레이스 경유가 주 경로인데 둘 다 GA4가 못 본다. 채널별 성사율은 여기서만 나온다.
- `outcome`: `won` · `lost` · `pending`
- `days_to_close`: 첫 문의부터 결제·확정까지. `pending`이면 비움

## 8주 뒤에 무엇이 되는가

2026-10-14쯤 표본이 쌓이면 아래를 판단한다.

1. 구간별 표본이 5건 이상인가. 아니면 더 모은다.
2. 기존 글이 경험으로만 주장하던 문장을 실측 숫자로 교체한다
   (`recording-price1`의 세션 소요·준비 효과, `mr-guide1`의 사전 전송 권고).
3. 남는 게 있으면 원본 데이터 한 편을 새로 쓴다. 신규 발행 게이트
   (`docs/story-strategy-panel-2026-08-19.md` §4-⑦)의 "기존 1,764편이 못 가진 것"
   조건을 유일하게 통과할 수 있는 종류의 글이다.

관련: [스토리 발행 전략 패널 회의록](../story-strategy-panel-2026-08-19.md) ⑥번 항목.
