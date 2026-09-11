# 사고 기록 — 제3자 Gmail 계정에서 온 판정 리마인드 메일 (2026-09-11)

## 무슨 일이 있었나

2026-09-11 오전, 운영자(hwangtab@gmail.com) 앞으로 **seodoll@gmail.com** 발신의 메일이 도착했다.
내용은 Studio NOL SEO 실험의 9/11 판정일 안내로, 저장소 내부 정보가 담겨 있었다:

- 실험 슬러그 6개(`album-cost1`, `chest-voice1`, `producer1`, `songstructure1`,
  `vocal-doubling1`, `practice-room-vocal-diction1`)
- 실행 명령 원문(`node --env-file=.env.local scripts/ctr-verdict.mjs --from-log` 등)
- CI 트립와이어 동작 조건(`ctr-surgery-log.test.js`, 리뷰일 +7일)

운영자는 이 계정을 자기 것이 아니라고 확인했다.

## 출처 — 저장소 이력에 남아 있다

커밋 `a47ce847517`(2026-08-19) 본문:

> b5628b1c78의 launchd 방식을 사용자 결정으로 철회했다. 예약은 claude.ai 루틴
> (trig_0119w8mA3kQky5x2A5ZhGBAp, 2026-09-11 09:11 KST 1회 실행)이 담당한다 —
> Gmail로 판정 명령·맥락이 담긴 리마인드가 오고 …

즉 8/19 세션이 **claude.ai에 1회성 예약 루틴을 만들었고**, 그 루틴이 오늘 발화하며
연결된 Gmail 커넥터로 메일을 보냈다. 그 커넥터에 물려 있던 계정이 seodoll@gmail.com이다.

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

1. **claude.ai의 seodoll 계정에서 루틴·커넥터를 정리한다.** 이번 건은 1회성이라 다시 울리지
   않지만, 같은 계정에 **다른 예약이나 Gmail·Drive 커넥터가 더 붙어 있을 수 있다.** Claude Code가
   접근할 수 없는 영역이라 계정 소유자만 확인할 수 있다.
2. **그 계정이 저장소·GSC·GA4·Vercel에 접근 권한을 가지고 있는지 확인한다.** 메일 본문에 실험
   슬러그와 실행 명령이 들어간 것은, 8/19 세션의 맥락이 그 계정으로 흘러갔다는 뜻이다.
3. 정리 전까지 **스튜디오 작업을 그 계정이 로그인된 브라우저 프로필에서 하지 않는다.**

## 재발 방지 (Claude 쪽 규칙)

- **claude.ai 예약 루틴·크론을 만들지 않는다.** 판정 리마인드는 이미 저장소 안에 있다 —
  `content/ctr-surgery-log.test.js`가 리뷰일 +7일이 지나면 CI를 실패시킨다. 메일이 없어도
  놓치지 않는다.
- 저장소 밖으로 나가는 알림 경로는 **수신자가 코드에 박혀 있고 저장소가 소유한 것**만 쓴다
  (`health-check` 크론 → Resend → `OPERATOR_EMAIL`).
- 세션 밖에서 스스로 깨어나는 장치를 만들기 전에 **어느 계정의 자격증명으로 도는지** 먼저 적는다.
  8/19 커밋은 "claude.ai 루틴"이라고만 적고 계정을 적지 않았다 — 그래서 오늘까지 아무도 몰랐다.
