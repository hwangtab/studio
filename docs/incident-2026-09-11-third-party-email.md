# 사고 기록 — 제3자 Gmail 계정에서 온 판정 리마인드 메일 (2026-09-11)

## 무슨 일이 있었나

2026-09-11 오전, 운영자(hwangtab@gmail.com) 앞으로 **seodoll@gmail.com** 발신의 메일이 도착했다.
내용은 Studio NOL SEO 실험의 9/11 판정일 안내로, 저장소 내부 정보가 담겨 있었다:

- 실험 슬러그 6개(`album-cost1`, `chest-voice1`, `producer1`, `songstructure1`,
  `vocal-doubling1`, `practice-room-vocal-diction1`)
- 실행 명령 원문(`node --env-file=.env.local scripts/ctr-verdict.mjs --from-log` 등)
- CI 트립와이어 동작 조건(`ctr-surgery-log.test.js`, 리뷰일 +7일)

운영자는 이 계정을 자기 것이 아니라고 확인했다.

## 원인 — 이 저장소를 작업하는 Claude Code 세션이 제3자 계정으로 로그인돼 있다

`~/.claude.json`의 `oauthAccount`:

| 필드 | 값 |
|---|---|
| emailAddress | **seodoll@gmail.com** |
| displayName | 인형 |
| accountUuid | `206f062d-fba2-4c85-8314-fed1df326ea0` |
| organizationName | seodoll@gmail.com's Organization |
| organizationRole | admin |
| organizationType | claude_max (20x) |
| accountCreatedAt | 2024-03-19 |

즉 **studio 저장소를 작업해 온 Claude Code 세션 자체가 seodoll 계정이다.** 8/19 세션이
그 계정에 claude.ai 루틴을 만들었고(`a47ce847517`), 오늘 그 루틴이 **그 계정의 Gmail
커넥터**로 메일을 보냈다. 발신자가 seodoll인 이유가 이것이다.

브라우저는 무관했다 — 브라우저의 claude.ai는 `smartcoopkor@gmail.com`으로 로그인돼 있고,
그 계정의 Gmail·Drive·캘린더 커넥터는 전부 운영자 본인(`hwangtab@gmail.com`)에 물려 있으며
예약 작업은 개인·팀 워크스페이스 양쪽 0건이다. 처음에 브라우저부터 뒤진 것이 헛수고였다.

### 그 루틴이 실제로 한 일 (실행 로그 `cse_0168XsRZVDM2MWG8DbeR9yms`)

```
env[info]: No sources configured      ← 저장소 접근 없음
tool_use ToolSearch: gmail send email
tool_use mcp__Gmail__send_message     ← 유일한 도구 호출
result: success turns=3 duration=13s
```

저장소를 클론하지 않았고 파일을 읽지도 쓰지도 않았다. 13초 동안 메일 한 통을 보낸 것이 전부다.
**다만 메일에 담긴 내용(실험 슬러그·실행 명령·CI 조건)은 8/19에 루틴 프롬프트로 저장될 때부터
그 계정에 남아 있었다.** 유출된 것은 메일이 아니라 그 프롬프트다.

### seodoll 계정의 루틴 (2026-09-11 기준 2건)

| 이름 | id | 상태 | 스케줄 | 커넥터 |
|---|---|---|---|---|
| SEO 판정 리마인드 2026-09-11 (1회) | `trig_0119w8mA3kQky5x2A5ZhGBAp` | `enabled: false`, `run_once_fired` | 1회 (발화 완료) | Gmail |
| 예단 주간 공고 생태계 스캔 | `trig_01VayvModDLbvSDR3MnuqyNt` | 활성 | 매주 토 20:00 KST | Gmail·캘린더·드라이브·MS365 외 |

첫 번째는 발화 후 비활성이라 재발화하지 않는다(`next_run_at`이 내일로 찍혀 있으나
`enabled: false` + `ended_reason: run_once_fired`라 무의미한 잔여 필드다). 그래도 목록에서
치우기 위해 삭제했다. **두 번째는 Studio NOL과 무관한 별개 작업이라 손대지 않았다.**

## 실측 (2026-09-11, 읽기 전용 확인)

### 메일 자체
| 항목 | 값 |
|---|---|
| From | seodoll@gmail.com |
| To | **hwangtab@gmail.com 단독** (Cc 없음, 헤더상 Bcc 표시 없음) |
| 발송 경로 | `gmailapi.google.com with HTTPREST` — 웹 UI가 아니라 **Gmail API 호출** |
| 발신 프로젝트 | Google Cloud 프로젝트 번호 `101988054943` |
| SPF / DKIM / DMARC | 전부 PASS (정상적으로 Google 인프라를 거침) |
| seodoll 발신 이력 | 전체 기간 **2건** — 오늘 1건 + 2020-05-21 1건(보도자료.hwp 드라이브 액세스 요청, 무관) |
| 브라우저 claude.ai 계정 | `smartcoopkor@gmail.com` — 예약 0건, 커넥터는 전부 hwangtab. **이번 건과 무관** |
| Claude Code 세션 계정 | **`seodoll@gmail.com`** — 여기가 발신 주체였다 |

### 다른 예약이 더 있는지 — 전수 확인 결과 **없다**
| 위치 | 결과 |
|---|---|
| 이 Claude Code 세션의 예약 작업 | 0건 |
| `~/Library/LaunchAgents` | studionol·seo 관련 plist 없음 (8/19에 삭제 완료된 그대로) |
| `launchctl list` | 등록 없음 |
| 사용자 `crontab` | 없음 |
| GitHub Actions `schedule:` | 없음 (CI는 push·PR 트리거만) |
| Vercel 크론 6개 | 전부 저장소 코드. 메일을 보내는 것은 `health-check` 하나뿐이고 수신자는 `lib/operatorContact.ts`의 `hwangtab@gmail.com` |
| 저장소 전체 `seodoll` 문자열 | **0건** |

### Gmail 설정 오염 여부 — **없다**
- 전달(Forwarding): "전달하지 않음". seodoll·Claude·Anthropic 관련 전달 주소 없음.
- 필터 3개: facebook·Twitter·"started following you" — 전부 무관.
- "다른 주소에서 메일 보내기": `hwangtab@gmail.com`, `Studio NOL <hello@studionol.co.kr>`(Resend SMTP) 둘뿐.
- 계정 사용권한 위임: 없음.

## 메일을 지울 수 있는가

**회수는 불가능하다.**

- 운영자의 받은편지함에서 지우는 것은 가능하지만, 그건 **내 쪽 사본만** 사라진다.
- 발신자(seodoll) 계정의 보낸편지함과 Google 서버 기록은 우리가 손댈 수 없다.
- Gmail의 발송 취소(Undo Send)는 발송 후 최대 30초 안에만 가능하며, 이미 전달된 메일의
  회수 기능은 개인 Gmail에 없다(Workspace에도 없다 — 그건 Outlook/Exchange 기능이다).

**받은 메일은 지우지 않고 두는 편을 권한다.** 헤더가 유일한 증거이고, 계정 관계를 정리할 때
발송 경로·시각·Cloud 프로젝트 번호가 근거가 된다. 지우려면 아카이브가 아니라 원본 보기로
헤더를 먼저 저장할 것.

## 남은 위험과 해야 할 일 (운영자)

메일 한 통은 작은 부분이다. **본체는 이 저장소를 작업하는 Claude Code 세션이 제3자 계정으로
돌고 있다는 것**이다. 그 계정에는 다음이 쌓여 있다:

- 이 저장소의 코드·문서·커밋 전문(세션 대화 기록으로)
- GSC·GA4 실측 데이터와 분석 결과
- 세션 중 읽은 `.env.local` 관련 맥락, 운영 판단, 사업 수치
- 8/19 루틴 프롬프트(실험 슬러그·명령)

해야 할 일:

1. **`/login`으로 본인 계정으로 다시 로그인한다.** 가장 우선. 그전까지 이 저장소에서
   민감한 작업을 하지 않는 편이 낫다.
2. seodoll 계정의 **대화 기록**을 확인하고 필요하면 지운다(claude.ai > 설정 > 데이터).
   Claude Code 세션 기록도 그 계정에 남는다.
3. seodoll 계정의 **커넥터**(Gmail 등)를 점검한다. 이번 루틴이 쓴 Gmail 커넥터가 어느 구글
   계정인지에 따라, 그 계정이 운영자 메일함에 접근할 수 있는 상태일 수 있다.
4. "예단 주간 공고 생태계 스캔" 루틴은 매주 토요일에 돈다. 의도한 것이면 그대로 두고,
   아니면 같은 화면에서 지운다.

## 재발 방지 (Claude 쪽 규칙)

- **claude.ai 예약 루틴·크론을 만들지 않는다.** 판정 리마인드는 이미 저장소 안에 있다 —
  `content/ctr-surgery-log.test.js`가 리뷰일 +7일이 지나면 CI를 실패시킨다. 메일이 없어도
  놓치지 않는다.
- 저장소 밖으로 나가는 알림 경로는 **수신자가 코드에 박혀 있고 저장소가 소유한 것**만 쓴다
  (`health-check` 크론 → Resend → `OPERATOR_EMAIL`).
- 세션 밖에서 스스로 깨어나는 장치를 만들기 전에 **어느 계정의 자격증명으로 도는지** 먼저 적는다.
  8/19 커밋은 "claude.ai 루틴"이라고만 적고 계정을 적지 않았다 — 그래서 오늘까지 아무도 몰랐다.
- **계정 귀속을 추적할 때는 `~/.claude.json`의 `oauthAccount`를 가장 먼저 본다.** 이번에
  브라우저 로그인부터 뒤지느라 두 번 헛짚었다. 브라우저 세션과 Claude Code 세션은 서로
  다른 계정일 수 있고, 실제로 달랐다.
