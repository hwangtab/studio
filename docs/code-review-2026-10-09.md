# 전방위 코드리뷰 — 2026-10-09

대상: `main` `401a9ddcf2`. 17개 축을 나눠 각 축마다 탐색 → 지적별 적대적 검증(코드를 직접 읽어 반박 시도, 이미 처리된 것·운영자 결정과 충돌하는 제안 제외) → P0와 확신이 덜한 P1은 재현 단계 검증을 거쳤다. 검증을 통과한 지적만 본문에 실었고, 반박된 지적은 부록에 이유와 함께 남겼다. 형식은 `docs/code-review-2026-08-24-round2.md`를 따른다.

항목 번호는 절 코드 + 일련번호(`PAY-3`)다. 심각도: **P0** 지금 돈·데이터·보안·법적 약속이 깨짐 / **P1** 현실 조건에서 터지는 버그·운영 사고 위험 / **P2** 하면 분명히 나아지는 개선 / **P3** 정리. 공수 S/M/L. "(미검증)"은 검증 단계가 한도로 끊겨 탐색자 주장만 있는 항목이다.

---

## 요약

**한눈에**

심각도별 건수(절에 실린 항목 503건 기준. 교차 절 중복 89건은 하나로 합쳤고, 발견 원본 531건 중 25건은 반박되어 실리지 않았다).

| 심각도 | 건수 |
|---|---|
| P0 | 1 |
| P1 | 23 |
| P2 | 144 |
| P3 | 335 |
| 미검증 | 0 |
| 합계 | 503 |

절별 건수.

| 코드 | 절 | P0 | P1 | P2 | P3 | 계 |
|---|---|---|---|---|---|---|
| PAY | 결제·주문·예약 | 0 | 0 | 8 | 31 | 39 |
| SHW | 공연 예매 | 1 | 7 | 10 | 27 | 45 |
| FND | 펀딩 — 후원·결제·명단·보존 | 0 | 0 | 8 | 27 | 35 |
| FNC | 펀딩 — 개설자·심사·배송·정산·관리자 | 0 | 2 | 8 | 27 | 37 |
| BIL | 정기결제·구독·아티스트 후원 | 0 | 7 | 10 | 9 | 26 |
| CON | 전자계약 | 0 | 1 | 10 | 19 | 30 |
| SEC | 인증·권한·입력 검증·헤더 | 0 | 0 | 6 | 16 | 22 |
| DB | 스키마·마이그레이션·쿼리 | 0 | 1 | 6 | 17 | 24 |
| PRV | 개인정보·처리방침·로그 | 0 | 0 | 9 | 19 | 28 |
| OPS | 메일·크론·운영 알림 | 0 | 0 | 10 | 19 | 29 |
| SCR | 운영 스크립트·도구 | 0 | 2 | 6 | 21 | 29 |
| TST | 테스트·CI·빌드 | 0 | 0 | 14 | 16 | 30 |
| FE | 프론트엔드·디자인 시스템·접근성 | 0 | 1 | 13 | 15 | 29 |
| SEO | 페이지·라우팅·SEO·i18n | 0 | 0 | 9 | 15 | 24 |
| PERF | 성능·번들·서버 비용 | 0 | 0 | 4 | 17 | 21 |
| CQ | 코드 품질·구조·중복·타입 | 0 | 1 | 3 | 24 | 28 |
| CNT | 콘텐츠 파이프라인·마크다운 | 0 | 1 | 10 | 16 | 27 |
| 합계 | | 1 | 23 | 144 | 335 | 503 |

돈이 걸린 다섯 절(PAY·SHW·FND·FNC·BIL)에 P0·P1 24건 중 17건이 몰려 있다. 공연(SHW)과 정기결제(BIL)가 각 8·7건으로 가장 두텁다 — 둘 다 최근에 만들어졌고 예약·펀딩이 이미 고친 결함을 가드 없이 이식했다.

**먼저 할 일 10가지**

1. **SHW-1** (P0) — 주문번호만 알면 `/shows/success`가 남의 관리 토큰을 HTML에 실어 준다. 티켓 QR 열람·타인 환불·환불 계좌 바꿔치기가 로그인 없이 된다. booking의 `provesOwnership` 여덟 줄 이식으로 끝나고 SHW-5·SHW-41도 함께 닫힌다.
2. **SCR-1 + SCR-2** — 만료 없는 운영 Turso rw 토큰이 `.env.local`과 백업 4개에 평문으로 있고, `npm run db:migrate`가 그 토큰으로 브랜치 상태 그대로 운영 DB에 적용된다. 문서는 둘 다 "안 된다"고 적어 아무 가드가 없다. 키 회전은 전체 교체라 저트래픽 시간에 한 번에 한다.
3. **CNT-1** — 감상실 운영 비밀번호 평문이 공개 저장소 테스트 파일에 커밋돼 있다(해시와 일치 확인). 발매 전 음원이 열린다. 비밀번호를 바꾸고 해시를 갈아 끼우는 것이 순서다 — 파일 수정만으로는 이력에 남는다.
4. **BIL-5 + BIL-16** — 관리자 구독 화면 props·API가 평문 빌링키·발급 응답 원본·고객 상시 토큰을 `__NEXT_DATA__`로 싣는다. 화이트리스트 직렬화 한 함수로 끝난다.
5. **BIL-1 + BIL-4** — 토스에 닿지 못한 pending 회차가 청구를 영구 보류시키고 고객에게 매일 실패 메일이 가며(BIL-1), 5xx·미지 코드를 거절로 낙인해 재시도 승인 시 같은 달 이중 청구가 된다(BIL-4). 둘 다 `chargeCycle`의 응답 분류 한 곳이다.
6. **BIL-2 + BIL-3 + BIL-7** — 정지된 구독은 카드를 재등록해도 재개되지 않고 화면은 재개된다고 말한다. 셀프 해지가 운영자에게 가지 않아 환불 약속을 지킬 트리거가 없고, 청구가 밀린 구독을 세는 점검이 없어 cron이 멈추면 아무도 모른다. 구독 오픈 전에 셋을 묶어 닫는다.
7. **SHW-8 + SHW-7** — 환불율은 24시간 단위로 계산하는데 고객이 동의한 표·FAQ·메일은 달력 날짜로 말해 전날 저녁 취소가 '당일' 10%로 깎인다(항상 고객 불리). 회차 취소 메일은 부분·0원 환불에도 '전액 환불'이라 보낸다. 고객에게 실제로 틀린 돈·문구가 나가는 결함이다.
8. **SHW-2 + SHW-3 + SHW-4 + SHW-6** — 공연 환불의 운영 복구 경로가 비어 있다: 5장 이상 일괄 환불이 토스 길이 한도에 거절되고, 토스 응답 유실 뒤 refunding 티켓을 되돌릴 길이 없고, 회차 취소가 DB 오류 하나로 중단되면 남은 주문이 환불 없이 남고, 매진 경합 자동 취소가 pending_retry로 끝나면 재시도가 없다. 첫 공연이 끝나기 전에 닫아야 하는 묶음이다.
9. **DB-1** — 주문·결제·환불·후원·구독 원장의 백업이 없고 Turso 무료 PITR은 1일이다. 하루 넘겨 발견한 사고는 복구 불가인데 법정 보존은 5년이다. 계약 백업(`backupContracts`)과 같은 크론을 원장에도 둔다.
10. **CQ-1 + OPS-3** — 일일 점검이 GA4 호출을 DB 점검보다 먼저 직렬로 돌리고 격리가 없어, 점검 하나가 던지면 그날 전체 결과와 관리자 첫 화면 이슈가 사라진다. 위 1~9의 상당수가 "헬스체크가 잡아 준다"를 전제하므로 그 전제를 먼저 튼튼하게 한다. BIL-6(아티스트 정산 '닫힌 달' 게이트 부재, 되돌릴 수 없음)·FNC-2(이체 뒤 수기 등록·환불 무알림)·FNC-1(draft 보관 400)·CON-1(종료 계약 서명본 다운로드 409)·FE-1(앵커 클릭이 뒤로가기를 깨뜨림)은 각각 작은 수정이라 같은 주에 끼운다.

**가로지르는 주제**

1. **같은 로직의 도메인별 복제가 가드 누락으로 이어진다** — 예약·펀딩이 고친 결함을 공연·예약금 링크·구독이 가드 없이 다시 만들었다. SHW-1/SHW-5(소유 증명), FE-11(약관 null 가드), PAY-8(환불 고지), PAY-17·PAY-19·PAY-20·CQ-2·CQ-15·FE-17(토스 상수·실패 코드표·오류 분기 4~5벌), CQ-3(환불 잔액 공식 2벌), CQ-10·PAY-26·FND-21(rowsAffected 7벌), CQ-16(KST 변환 20곳), CQ-8·PAY-36(SITE_URL 9벌), CQ-9·OPS-25(전화번호 87줄), SHW-14·FND-23(환불 규정 문구 수동 동기화). 방향: 토스 승인·환불·결제 폼 공용 모듈 하나로 모으고, `tests/payments/sharedCheckout.guard.test.ts`를 문자열 grep이 아닌 렌더 테스트로 바꿔(TST-11) 새 도메인이 공용 경로를 벗어나면 CI가 서게 한다.
2. **외부 호출 뒤 기록 실패·응답 유실의 복구 경로가 없다** — 토스는 끝났는데 DB 기록·메일·캘린더가 빠지는 경로가 도메인마다 남아 있다. PAY-4·PAY-11·PAY-15·PAY-21·PAY-32, SHW-3·SHW-6·SHW-15·SHW-21·SHW-37·SHW-24, FND-15·FND-28, BIL-1·BIL-4·BIL-18, CON-5·CON-13, DB-17·DB-22, CQ-25. 방향: "토스 성공 뒤 batch 실패"를 하나의 상태(`recording_failed`/`auto_cancel_pending`/`refunding`)로 보고, 웹훅 대사가 그 상태를 반드시 끝까지 닫게 하며, 닫히지 않은 건을 헬스체크 한 항목으로 센다.
3. **크론·점검의 부분 실패가 알려지지 않는다** — 점검 하나가 던지면 그날 전부가 사라지고(CQ-1·OPS-3·OPS-22), 메일 실패 결과를 버리고(OPS-1·OPS-11·OPS-17·BIL-25·PRV-23·OPS-24), 크론이 아예 안 돈 경우를 잡을 장치가 없다(OPS-4·PRV-14·BIL-7·FNC-8·CON-15·CON-29·OPS-7·OPS-10·SCR-10·TST-28). 방향: 점검 항목마다 try/catch 격리 + `sendEmail` 결과를 반드시 보는 공용 헬퍼 + 외부 데드맨 스위치 하나.
4. **배치 쓰기의 비원자성** — 주문과 하위 행, 선점과 전이, revoke와 insert가 별 문장으로 돌아 중간 실패 시 고아·이중 상태가 남는다. PAY-21·PAY-32·CQ-25, SHW-24·SHW-42, FND-34, FNC-16·FNC-19·FNC-23, BIL-18·BIL-22·BIL-23, DB-4·DB-7·DB-17·DB-22. 특히 DB-4(연습실 구독 유일 제약 부재→월세 이중 청구)와 DB-7·FNC-23·PAY-3(drizzle 0.45가 UNIQUE 위반을 감싸 `String(error).includes('UNIQUE')`가 절대 맞지 않음)은 같은 뿌리다. 방향: `db.batch`로 묶을 수 있는 것은 묶고, UNIQUE 판정은 `cause` 사슬을 보는 `isUniqueConflictError` 하나로 통일하고, 유일 제약은 DB에 둔다.
5. **개인정보 파기·고지가 새 표를 따라가지 않는다** — 공연 `show_orders.buyer_*`가 5년 파기에서 빠졌고(SHW-9·DB-2·PRV-4·PRV-8), 결제 미성립 주문의 PII가 5년 남고(PAY-6·FND-1·PRV-5·FND-30), 관리자 목록·상세가 접속기록 밖에서 전 컬럼을 싣고(CON-7·SEC-2·PRV-2·PRV-6·BIL-5·BIL-16), 단건 drizzle 실패 로그에 바인딩 값이 실린다(SEC-1·PRV-1·CQ-5·PRV-28). 처리방침 문구도 코드와 어긋난 곳이 아홉(PRV-9·13·15·16·21·22·27, FNC-10, CON-3). 방향: 스키마의 PII 컬럼과 파기 함수를 대조하는 테스트 하나(PRV-8), 직렬화는 화이트리스트, 단건 쿼리 오류는 `safeDbErrorSummary`로 통일.
6. **레이트리밋·방어가 역방향으로 작동한다** — 정상 사용자를 막거나 공격자를 막지 못한다. IPv6 /64 미정규화(SEC-5), 로그인 한도 초과가 거짓 200(FNC-12), 슬롯 조회만 제한 없음(SEC-4·DB-3·PAY-12·CQ-17), 감상실 대입 방어 DB 예외 시 fail-open(CQ-6), Redis 실패 시 문의만 fail-closed(SEC-22), 가입 API 이메일 단위 제한 없음(BIL-12), 웹훅 한도 근거 없음(PAY-29). 방향: `consumeRateLimit` 하나에 /64 정규화·fail 정책·키 설계를 넣고 호출부는 정책 이름만 고른다.
7. **기준선·게이트의 `--update`가 위험한 변경도 승인한다** — 펀딩 불변식(SCR-4·TST-7·FND-18), 검증 후보(CNT-13·TST-19), 약관 판본(TST-18), storyListing check가 CI에서 자기 자신과 비교(SCR-11·CNT-5), 공용 체크아웃 가드가 grep(TST-11), 사실 가드가 JSON-LD·llms·사이트맵 밖(SEO-4·SEO-2·SEO-3·CNT-10). 방향: `--update`는 기존 기준선과 diff해 삭제·금액·한정 변경은 거부하고, 가드의 스캔 범위를 "사용자에게 나가는 모든 출력"으로 넓힌다.

**권장 순서**

- **1주 안(보안·돈 직결, 모두 작은 수정)**: SHW-1, SCR-1+SCR-2, CNT-1, BIL-5+BIL-16, BIL-6, FNC-1, CON-1+SEC-6, FE-1, SHW-8+SHW-7, PAY-5(결제 링크 slug 평문), DB-1(원장 백업 크론), CQ-1+OPS-3(점검 격리). 끝나면 공연·구독 성공 페이지와 관리자 화면에 소유 증명·화이트리스트 회귀 테스트가 남아야 한다.
- **이번 달(공연 첫 회차·구독 오픈 전)**: SHW-2·3·4·5·6·15·16·17·18, BIL-1·2·3·4·7·8·9·10·11·12·13·15·17, FNC-2·6·8·9, PAY-3·4·7·8, DB-4·DB-7(+FNC-23·PAY-3 UNIQUE 판정 통일), OPS-1·2·4·7·8, CON-2·4·5·6·8·11, FE-11·FE-12, SHW-9+DB-2+PRV-4+PRV-8(공연 PII 파기), PAY-6+FND-1+PRV-5(미성립 주문 1년 파기, 판본 올림 포함).
- **다음 분기(구조 통합·게이트 보강)**: 주제 1의 공용 모듈화(CQ-2·3·8·9·10·15·16, PAY-17·19·20·26·36, FE-17), 주제 4의 batch 묶기(PAY-21·32, SHW-24·42, BIL-18·22·23, DB-17·22), 주제 6의 레이트리밋 통일(SEC-4·5·22, FNC-12, CQ-6·17, BIL-12), 주제 7의 게이트 보강(SCR-4·11, TST-7·11·18·19, CNT-5·13, SEO-2·3·4), 테스트 공백(TST-2·3·4·5·9·10·12·13, CON-10, OPS-21), 처리방침 정합(PRV-9·13·15·16·21·22·27, FNC-10, CON-3), CI 분할·캐시(TST-6·8·14), PERF-1(함수 리전 icn1)·PERF-2·4.
- **관찰·정리(여유 있을 때)**: 인덱스 묶음(PAY-13·DB-8·9·10·FND-11·BIL-26·PERF-8·SEC-7 — 다음 마이그레이션에 한 번에), 죽은 코드·주석 정합(PAY-25·33, SHW-30·43·44, CQ-22·24, FND-5, FNC-26·31, PERF-18, SEO-16), 콘텐츠 파이프라인(CNT-2·3·4·6·7·8·11, SEO-1·7, FE-16·CNT-17), 접근성(FE-2·3·4·5·14·20·23·24·25).

**이번 리뷰가 보지 못한 것**

2라운드 탐색은 PAY·SHW·FND·FNC 네 절만 돌았다. 나머지 열세 절은 1라운드 탐색 + 검증만 거쳤으므로 그 절의 P2·P3 밀도는 네 절보다 낮게 잡혔을 수 있다. 공통으로 운영 Turso·Vercel 로그·토스 콘솔·GitHub Secrets·Resend 설정은 읽기 금지라 조회하지 않았고, 토스 공식 사양(멱등키 실패 응답 재사용, cancelReason·Idempotency-Key 길이, 웹훅 재전송 간격)은 저장소 주석에 의존했다.

- PAY — 토스 실호출 없음(위젯 시크릿으로 API 키 결제를 승인할 때의 코드가 KEY_MISMATCH 안인지 미확인), Pages Router gSSP의 maxDuration 적용 방식 미확인, BookingWizard·MixingOrderWizard의 단계별 UI JSX·관리자 예약 화면 전체·orderRetention 후반 함수 미정독, 메일 HTML 렌더 결과 미열람.
- SHW — jest 미실행(1라운드), 브라우저 실동작 미확인, 토스 길이 한도는 주석 의존, ShowFacts·VenueMap·RefundPolicyList·ShowTicketManage 앞부분·영어 문구표·관리자 화면 후반(환불 계좌 패널) 미정독, 운영 DB의 refunding·held 잔존 건 미확인.
- FND — 개설자·관리자 영역은 PII 접점만 읽음, FundingGallery·LineupPerson·faq.ts·mediaAccess·media 라우트 미정독, 통합 테스트 미실행(3개 스위트만), 인덱스·status API 성능은 실측 없음, content/funding 본문 사실성 미점검.
- FNC — 후원자 결제 경로(service·confirm·cancel·lineRefund·bankTransfer) 미정독으로 정산 gross 입력 정합성은 미확인, 개설자 클라이언트 폼·관리자 후원 목록/상세(654+647줄) 부분만, 통합 테스트는 2~3개 스위트만 실행, 배포 산출물·운영 마이그레이션 상태 미확인.
- BIL — 토스 실응답 미확인(BIL-1·4는 문서·관례 기반 추정), webhook 구독 분기·cancel.ts settleRefund 미정독, healthCheck·orderRetention은 구독 구간만, 마이그레이션 0012·0016과 운영 스키마 미대조, CSP의 빌링 SDK 허용 여부·Cron 지터 미확인.
- CON — 관리자 인증 모듈은 호출 관계만, 계약 조항의 법적 타당성 미검토(코드 정합만), ContractForm 앞 140줄·관리자 화면 후반 부분 읽기, 운영 Blob·0046 적용 여부 미확인, Chromium 실렌더·실기기 서명 미실행.
- SEC — 정적 읽기만(jest·빌드·동적 요청 없음), KV·Calendar 쿼터·ADMIN_ACCOUNTS 강도 등 운영값 미확인, 결제·펀딩·계약·빌링·공연 내부 로직과 클라이언트 XSS·scripts·워크플로는 범위 밖.
- DB — 운영 DB 미접속(행 수·EXPLAIN·PRAGMA·PITR·__drizzle_migrations 미확인, 인덱스 심각도는 추정), db 호출 118파일 중 상당수 grep·발췌만, jest 미실행(schema 정합은 스크래치 복사본 generate로 확인).
- PRV — 운영 DB·Vercel 로그·Resend·Google 보존 설정 미확인, raw error 로깅 호출부는 대표 경로만, 관리자 화면 props 직렬화 일부만, zh·es·vi·th·uz 처리방침 번역 미검토, 테스트 본문·jest 미실행, content/data에 실제 PII 박힘 여부 미조사.
- OPS — 고객 메일 약 70종 본문의 문구·계산 정확성 미전수, chargeCycle·expireStaleShowOrders·파기 함수 내부 미정독, gscAudit·gscDiff 로직 미정독, Vercel 크론 재시도·Resend 한도·계정 maxDuration·GA4 env 실등록 여부는 외부 확인 필요.
- SCR — scan-near-duplicates 본문·audit-thin·content-quality 후반·visual/screenshots·structureIntegrity 등 부분만, archive/* 미정독, jest·CI 미실행, GitHub Secrets·Turso 토큰 권한·Vercel Node 버전 미확인.
- TST — 기준 HEAD가 origin/main보다 67커밋 뒤(#600까지의 새 테스트 미반영), npm audit 미실행(네트워크 차단), 단위 테스트 약 320개 중 샘플만 정독, e2e·visual·archive 테스트 미정독, 플레이키 판정은 단일 실행.
- FE — 브라우저 실측 없음(대비·겹침·포커스는 Tailwind 컴파일 결과로 추론), jest 미실행, 개설자 폼 약 1,500줄·MixingOrderWizard 대부분·shows/funding/inline 컴포넌트 다수 미정독, iOS Safari 스크롤 잠금 한계 미판단.
- SEO — 서비스 LP 13개의 본문 JSX는 SEO props만 읽고 라이브 메타 실측으로 대체, TierPage·BuyerIntentHubPage·LanguageSwitcher 내부 미정독, llms.ts 가격 문장 정합 미검증, 비-ko 로케일 HTML은 vi 한 페이지만 실측, 경로 이탈로 읽을 수 있는 .md의 번들 내 실제 범위 미확인.
- PERF — .next 산출물 미열람(번들 수치는 esbuild 근사), Vercel 함수 호출·ISR 쓰기·콜드스타트·Turso 사용량 미확인, Lighthouse/PSI 미실측, EXPLAIN 미확인, 헤더·메뉴·globals.css 세부 미정독, prebuild 캐시 동작 미확인.
- CQ — billing/service·funding/service·email·creator*·contracts 대부분·orderRetention 본문 미정독(AST/grep 측정만), cancel.ts·refund.ts·showtimeOps 후반 미정독, tsc·eslint·jest 미실행, 순환·미사용 export는 자작 스크립트라 동적 import·문자열 참조 누락 가능, i18n 싱글턴(확신도 0.4)은 재현 안 함.
- CNT — 프로덕션 경로 이탈 요청 미시험(라우트 매처 함수 호출로만 확인), 번들 크기 미실측, 번역 스토리 184편은 구조·숫자·숏코드만, inline/story 컴포넌트 카피 정합 미검토, data/*.ts는 가격 리터럴 스캔만, generate-story-catalog·portfolio-meta·scan-near-duplicates·press 스크립트 미정독, jest 전체·build 미실행.

**검증 통계**

| 항목 | 값 |
|---|---|
| 돌린 절 | 17 |
| 빠진 절 | 0 |
| 2라운드 탐색 절 | PAY · SHW · FND · FNC |
| 발견 원본 | 531 |
| 확정(confirmed) | 79 |
| 조정(adjusted) | 427 |
| 반박(refuted) | 25 |
| 미검증 | 0 |
| 재현 테스트 작성·실행 | 1 (SHW-1) |
| 교차 절 중복 | 89 |
| 절에 싣지 않은 overflow | 104 |

---

## 1부 — 돈이 움직이는 영역: 결제·주문·예약·공연·펀딩·정기결제

### PAY. 결제·주문·예약 (토스·계좌 입금·주문 상태)

P0 0 · P1 0 · P2 8 · P3 31, 미검증 0 (원 지적 41건 중 같은 결함을 두 번 적은 2건을 합쳤다 — PAY-3, PAY-22)

#### PAY-1. 토스 거래 목록과 payments를 대조하는 장치가 없어 'SSR 기록 실패 + 웹훅 유실' 이중 장애의 승인 결제는 어느 점검에도 안 걸린다 [P2 · M]

**위치** `lib/ops/healthCheck.ts:689-712` · `lib/booking/confirm.ts:680-685` · `lib/booking/confirmDeposit.ts:267` · `lib/shows/confirm.ts:294` · `lib/funding/confirm.ts:363` · `lib/booking/webhook.ts:187-194` · `lib/booking/toss.ts`(request, REQUEST_TIMEOUT_MS=12000) · `vercel.json`(crons)

**지금 코드** 건강검진의 결제 불일치 판정은 이것뿐이다.

```ts
const paymentMismatch = await db.select({ orderNo: orders.orderNo }).from(orders)
  .where(and(sql`${orders.status} in ('pending', 'failed', 'expired')`,
             sql`exists (select 1 from payments where payments.order_id = ${orders.id})`));
```

즉 payments 행이 **있는** 주문만 본다. 네 confirm(booking·deposit·shows·funding)은 batch가 실패하면 `console.error('결제 승인됨, DB 기록 실패 — 웹훅 복구 대기')`만 남기고 `recording_failed`를 돌려준다 — 운영자 메일(`lib/email/operatorAlert`)은 어느 confirm 경로에서도 부르지 않는다. 저장소 전체에 토스 `GET /v1/transactions` 호출이 0건이고(grep·`git log -S` 모두 0), vercel.json 크론 10개 중 대사 크론은 없다.

**왜 문제인가** 결제 안전망은 ① success SSR 확정 ② 토스 DONE 웹훅(최대 7회·3일 19시간 재전송) 둘뿐이다. 웹훅 쪽은 `webhook.ts:187-194` 주석대로 멱등 키 회수(`releaseEventKey`)까지 실패하면 다음 재시도가 unique 위반으로 200 처리돼 그 이벤트는 영영 재시도되지 않는다. 두 실패가 겹치면 토스에는 DONE 거래가 있는데 payments 행이 없어 관리자 화면·건강검진 어디에도 나타나지 않는다. (홀드 경과 후 자동환불 실패는 payments 행이 먼저 들어가므로 기존 mismatch가 이미 잡는다 — 이 건의 범위가 아니다.)

**조건과 결과** SSR 기록 실패(또는 승인 직후 함수 종료) + 웹훅 완전 유실이 동시에 일어나면 → 고객은 결제됐는데 주문은 만료로 사라지고, 운영자는 고객 문의나 토스 콘솔을 손으로 볼 때까지 모른다. 환불·확정이 지연되고 매출장부와 토스 정산이 어긋난다.

**수정**
1. 즉시 되는 1차 망: `lib/booking/confirm.ts:680`·`confirmDeposit.ts:267`·`lib/shows/confirm.ts:294`·`lib/funding/confirm.ts:363`의 `recording_failed` 분기에서 `lib/email/operatorAlert`의 `buildOperatorAlertHtml` + `sendEmail`로 운영자 메일(주문번호·paymentKey·금액)을 보낸다. DB가 죽어도 Resend는 살아 있어 SSR 기록 실패는 그날 보인다.
2. 2차 망(함수 종료·웹훅 유실까지 덮는 것): `lib/booking/toss.ts`에 `listTransactions({startDate,endDate,startingAfter,limit})`를 추가하되 기존 `request()`의 12초 타임아웃을 쓰지 말고 **전용 60초 타임아웃**을 둔다(토스 문서: 거래 조회 최대 60초). 호출은 health-check 크론 안이 아니라 별도 `/api/cron/reconcile-toss`(maxDuration 60, 하루 1회)로 — health-check는 이미 60초 한도에 gcal·수십 쿼리를 직렬로 돌려 여기에 60초짜리 외부 호출을 얹으면 점검 전체가 죽는다. 조회 창은 48시간 겹침, `transactionAt`이 최근 60분 이내인 건은 제외(토스 재전송 1·4·16·64분이 진행 중 복구를 덮는다), `status=DONE` 행만 대상(취소는 별도 거래 행). 판정: paymentKey가 payments에 없거나, 있어도 orders가 paid 계열이 아닌 건 → operatorAlert 메일(기존 mismatch와 중복 보고는 감수). 구독 결제는 `TOSS_BILLING_SECRET_KEY`가 따로라(`lib/billing/toss-billing.ts:27`) 위젯 시크릿의 거래 목록에 빌링 거래가 실리는지 토스 콘솔로 먼저 확인하고, 안 실리면 빌링 시크릿으로도 한 번 더 조회하거나 `type=subscription`을 제외한다. 조회 실패는 삼키지 말고 '대사 조회 실패' 경보로 보낸다.
3. 자동 환불·자동 확정은 하지 않는다(읽기 전용, 사람이 판단) — 저장소의 기존 결과 같다.

**비고** 검증자 조정: P1→P2(이중 장애에서만 생기고 토스 콘솔에 거래가 남아 사후 복구 가능). 원 지적의 'DB 장애 중 홀드 경과 자동환불 실패' 사례는 기존 mismatch가 이미 잡으므로 뺐다. 원 수정안의 '기존 request() 재사용'·'health-check 안에 넣기'·'어제~오늘 창'은 위와 같이 바로잡았다.

#### PAY-2. 자동 전액 취소가 끝난 주문이 건강검진·관리자 목록에서 '결제 기록과 주문 상태 어긋남(high)'으로 영구히 남는다 [P2 · S]

**위치** `lib/ops/healthCheck.ts:693-712` · `lib/booking/confirm.ts:147-150, 626-641` · `lib/booking/confirmDeposit.ts`(동명 `autoCancelStaleApproval`) · `lib/booking/admin-serialize.ts:172, 267` · `lib/booking/webhook.ts:56-70, 157-164`

**지금 코드** `autoCancelStaleApproval`은 batch에서 payments 행을 먼저 넣고(orders 전이는 0행) 토스 전액 취소에 성공해 refunds(done)까지 남기지만 orders.status는 expired/pending/failed 그대로 둔다. `confirm.ts:147`의 주석이 그 이유를 적는다: "orders는 건드리지 않는다 — ①이면 이미 expired/failed이고, ②면 pending인 채로 홀드가 지났을 뿐". 한편 healthCheck는 `status in ('pending','failed','expired') AND exists(payments)` → high 경보, `admin-serialize.ts:172`는 `UNPAID_ORDER_STATUSES.has(order.status) && order.payments.length > 0`을 mismatch로 표시한다. 둘 다 환불 합계를 보지 않는다.

**왜 문제인가** 환불 실패 건을 잡으려는 mismatch가 **성공 건까지** 잡는다. 이어 오는 CANCELED 웹훅은 `syncCancelledFromToss` → 예약이 confirmed가 아니라 선점 실패 → `reconcileRefunds`에서 취소합계 = 기록합계라 즉시 return하므로 주문 상태를 환불로 못 옮긴다. 관리자 환불도 `LIVE_ORDER_STATUSES_FOR_REFUND`(paid/partially_refunded)만 열려 있어 해소 수단이 없고, 주문 행은 5년 보존이라 경보가 매일 08:00 KST 크론마다 반복된다.

**조건과 결과** 홀드 15분이 지난 뒤 승인이 들어와 자동 취소가 성공하면 → 그 주문 번호로 매일 아침 high 경보 메일이 영구 반복되고, 진짜 '돈 들어왔는데 미확정' 건이 그 소음에 묻힌다.

**수정** 가장 단순한 쪽: `lib/booking/confirm.ts` `autoCancelStaleApproval`(와 `confirmDeposit.ts`의 동명 함수)에서 `cancelled.ok`**이고 refunds done 행이 실제로 기록된 경우에만** `UPDATE orders SET status='refunded', updated_at=unixepoch() WHERE id=? AND status IN ('pending','expired','failed')`를 추가한다(원인은 `refunds.reason`의 `AUTO_CANCEL_REASON`이 이미 기록. 기록 실패 시엔 웹훅 대사가 refunded로 맞춘다). `confirm.ts:147-150` 주석을 함께 고친다. `lib/shows/confirm.ts:545-549`가 자동 취소 뒤 orders를 refunded로 올리는 선례다. 대안: healthCheck 쿼리와 admin-serialize mismatch에 '완료 환불 합계 ≥ total_amount면 제외' 조건 추가(admin 목록은 `payments:{with:{refunds:true}}`로 읽어야 함). 회귀 테스트: `lib/ops/healthCheck.integration.test.ts`에 '자동취소 성공 건은 경보 제외' 케이스. 전이 뒤 같은 DONE 웹훅이 재도착하면 invalid_state + '수동 대사 필요' console.error가 한 번 더 찍히는 것은 감수한다. 매출장부(`salesLedger.ts`)는 payments 기준이라 숫자가 안 바뀐다.

**비고** 검증자 확인(confirmed).

#### PAY-3. 웹훅 중복 판정(isUniqueViolation)이 drizzle이 감싼 DrizzleQueryError의 cause를 보지 않아 중복 이벤트가 200이 아니라 500으로 끝난다 [P2 · S]

**위치** `lib/booking/webhook.ts:234-240`(isUniqueViolation) · `:274-282`(멱등 INSERT와 catch) · `:392-397`(releaseEventKey) · `lib/booking/webhook.test.ts:106-110` · `lib/booking/webhook.integration.test.ts:201-210` · 참고 `lib/funding/slugOccupancy.ts:60-80`

**지금 코드**

```ts
await db.insert(webhookEvents).values({ eventKey, payload: JSON.stringify(payload) });
...
if (isUniqueViolation(error)) return { status: 200 }; // 중복 이벤트
// isUniqueViolation:
return /unique|sqlite_constraint/i.test(message) || /unique|sqlite_constraint/i.test(code);
```

`message`와 `code`는 error 자신의 것만 본다.

**왜 문제인가** drizzle-orm 0.45.2 + @libsql/client 0.17.4에서 단일 문장 `db.insert(...).values(...)`의 UNIQUE 위반은 `DrizzleQueryError`로 던져진다 — message는 `'Failed query: insert into "webhook_events" ... params: ...'`, `.code`는 없고, `SQLITE_CONSTRAINT`·`UNIQUE constraint failed: webhook_events.event_key`는 `.cause`(LibsqlError)에만 있다. 그래서 `isUniqueViolation`은 항상 false이고 중복 이벤트가 '멱등 기록 실패 — 재시도 유도' 500 경로로 간다. 검증자가 인메모리 libsql로 재현했고, 프로덕션 런타임 로그(7일)에도 `[booking-webhook] 멱등 기록 실패 — 재시도 유도`가 eventKey `studk20260930154140cwHE4:DONE`로 찍혀 있었다(cause: `UNIQUE constraint failed: webhook_events.event_key`). 단위 테스트는 평범한 `Error('UNIQUE constraint failed...')`를 던지는 목이라 이 차이를 가리고, 통합 테스트는 두 번째 호출의 반환 상태를 단언하지 않는다. 이 저장소는 이 함정을 이미 안다 — `lib/funding/slugOccupancy.ts`의 `isUniqueConflictError`가 "cause까지 따라간다"를 주석으로 못 박아 두었다.

**조건과 결과** 토스가 같은 이벤트를 다시 보내면(동시 전달, 느린 첫 응답 뒤 재전송) → 500을 받고 최대 재시도 횟수까지 반복한다. 매번 `fetchPayment` 호출과 IP 한도 카운터(PAY-29)를 소모하고 토스 웹훅 실패 기록이 쌓이며 진짜 DB 장애 알림과 구분되지 않는다. 이중 처리·유실은 없다(멱등 키가 이미 있어 처리 전에 끝난다). 처리 중 프로세스 사망으로 남은 키도 200이 아니라 500이 반복될 뿐 복구되지 않는다는 점은 그대로다.

**수정** 둘 중 하나.
- (권장) INSERT를 `db.insert(webhookEvents).values(...).onConflictDoNothing().returning({ k: webhookEvents.eventKey })`로 바꾸고 반환 행이 없으면 중복(200)으로 본다 — 오류 문자열 파싱이 필요 없다.
- 대안: `isUniqueConflictError(error, 'webhook_events.event_key')`(`lib/funding/slugOccupancy.ts`)를 재사용하거나 같은 방식으로 cause 체인(최대 5단)을 따라가며 `/UNIQUE constraint failed: webhook_events\.event_key/i`를 검사한다. 그 컬럼의 위반만 중복으로 취급하고 NOT NULL 등은 500으로 둔다. **코드를 `SQLITE_CONSTRAINT_PRIMARYKEY`로 한정하면 안 된다** — 이 스택의 code는 `'SQLITE_CONSTRAINT'`라 중복 판정을 영영 못 하게 된다.

어느 쪽이든 `webhook.integration.test.ts:201` 테스트에 두 번째 호출 반환값 `toEqual({ status: 200 })` 단언을 추가하고, `webhook.test.ts`의 모의 오류를 실제 DrizzleQueryError 모양(`message='Failed query...'`, `cause=Error('SQLITE_CONSTRAINT: UNIQUE constraint failed: webhook_events.event_key')`)으로 바꿔 200을 기대한다. 원 지적의 `completed_at`/lease 컬럼·하트비트는 도입하지 않는다(웹훅 maxDuration 60초, 처리 사슬 수 초, 고객이 success를 새로고침하면 confirm이 멱등으로 다시 돈다 — 마이그레이션 + when 순서 함정 대비 이득이 작다).

**비고** 같은 결함을 적은 두 지적(1라운드 '처리 중 사망 시 키 잔존'과 'isUniqueViolation cause 미검사')을 합쳤다. 검증자 조정: 전자는 P3 수준이라 하트비트 수정안을 철회, 후자는 원 수정안(code를 `SQLITE_CONSTRAINT_PRIMARYKEY/UNIQUE`로 한정)이 실제와 반대라 바로잡았다.

#### PAY-4. 취소 환불 기록 실패(recording_failed)와 외부 취소 웹훅 동기화 경로가 캘린더 일정 삭제·취소 메일을 건너뛴다 [P2 · M]

**위치** `lib/booking/cancel.ts:494-527` · `lib/booking/webhook.ts:166-182`(syncCancelledFromToss) · `lib/ops/healthCheck.ts:393-405, 795-797` · `pages/api/bookings/slots.ts:120-136` · `lib/booking/admin-serialize.ts:273-284`

**지금 코드**

```ts
const failure = await settleRefund({...});
if (failure) return failure;          // L494-499 — recording_failed도 여기서 반환
... // 후처리 — 환불은 끝났으므로
if (booking.gcalEventId) { await deleteBookingEvent(...) }   // L509-519
sendBookingCancelledEmails(...)                              // L527
```

`webhook.ts:166` `syncCancelledFromToss`는 선점 성공 분기에서 refunds INSERT + orders UPDATE batch만 하고 끝난다. 펀딩 쪽 `syncFundingCancelledFromToss`는 `sendFundingCancelledEmails`로 통지하는데 예약 쪽만 빠진 비대칭이다.

**왜 문제인가** `settleRefund`가 `recording_failed`(토스 환불은 끝났고 DB 기록만 실패)를 돌려주면 예약은 이미 cancelled로 선점된 상태인데 함수가 즉시 반환해 gcal 삭제와 고객·운영자 메일이 실행되지 않는다. 이후 CANCELED 웹훅의 `reconcileRefunds`는 refunds만 채운다. 토스 콘솔에서 직접 취소한 건(`syncCancelledFromToss`)도 같다. 결과적으로 `gcalEventId`가 남은 채 예약만 cancelled가 된다. 슬롯 조회는 시스템이 쓰는 같은 구글 캘린더의 FreeBusy를 읽고(`slots.ts:120-136` 주석 "캘린더에 손으로 넣은 일정도 웹 예약을 막는다"), healthCheck의 gcalGap은 `status='confirmed'`만 보며, `waiting_delete:` 점검은 입금 대기 취소 전용이라 취소된 예약에 남은 일정은 어떤 점검도 못 잡는다.

**조건과 결과** 현실적인 트리거는 토스 콘솔 수기 취소다(운영자가 우회로로 쓴다고 `admin-serialize.ts:273-284` 주석에 명시). 그러면 → 취소된 예약의 [예약] 일정이 캘린더에 남아 freeBusy가 그 시간을 '바쁨'으로 읽어 웹 예약이 계속 막히고(매출 손실) 전화 예약도 오인한다. 고객은 취소 확인 메일을 못 받는다.

**수정** `cancel.ts` 후처리(L509-527)를 `afterBookingCancelled(order, booking, refundAmount, refundVia)` 함수로 추출한다. ① `cancelSessionBooking`/`cancelMixingOrder`에서 `settleRefund`가 `recording_failed`여도(revert 되지 않은 경우) 이 함수를 호출. ② `webhook.ts` `syncCancelledFromToss`의 claimed 성공 분기에서 best-effort로 호출 — gcal 삭제와 운영자 알림이 핵심이고, 고객 취소 메일은 펀딩 선례를 따르되 각 단계를 try/catch로 감싸 동기화(refunds/orders 기록)를 뒤집지 않게 하고 실패는 `gcal_error`/`notification_error`에 기록. ③ `lib/booking/webhook.integration.test.ts`에 '콘솔 취소 후 gcal 삭제 호출' 케이스 추가.

**비고** 검증자 확인(confirmed). PAY-9(부분 환불 통지)는 이 수정으로 함께 해소된다.

#### PAY-5. 비공개 예약금 결제 링크의 slug가 공개 저장소에 평문으로 커밋돼 있다 [P2 · M]

**위치** `data/paymentLinks.ts:3-26` · `pages/api/payment-links/order.ts` · `pages/[locale]/pay/[slug].tsx` · `pages/[locale]/pay/fail.tsx`(slug 되돌아가기 링크) · `data/paymentLinks.test.ts` · `tests/api/payment-links/order.test.ts` · `lib/payments/depositGuideThrottle.ts`

**지금 코드**

```ts
 * 운영자가 만든 비공개 예약금 결제 링크. ... slug는 추측할 수 없는 무작위 값이다 ... 링크를 아는 사람만 결제할 수 있다.
export const PAYMENT_LINKS = { '46fee6d8ffa1a69be20324a2': { itemName: '싱글 음원 제작 예약금', totalAmount: 400000 } }
```

저장소는 PUBLIC이다(`gh repo view` 실측). `expiresOn`도 없다.

**왜 문제인가** slug가 곧 결제 권한인데 공개 저장소에 평문으로 있어 저장소를 읽는 누구나 `/ko/pay/<slug>`로 주문을 만들 수 있다. 주석의 '링크를 아는 사람만'이 성립하지 않는다. 주문 API의 방어는 IP당 10건/시간뿐이고, `bank_transfer`를 고르면 `awaiting_deposit` 주문이 자동 취소 없이 쌓이고 운영자 안내 메일도 나간다(고객 메일만 주소당 3통/시간 제한). 같은 프로젝트의 비공개 감상실(`lib/press/listeningRoom.ts`)은 공개 저장소를 이유로 scrypt 해시만 커밋하므로 관례에도 어긋난다.

**조건과 결과** 누군가 저장소에서 slug를 읽어 반복 제출하면 → 스팸 pending 주문, 자동 취소 없는 awaiting_deposit 주문 누적, 건마다 운영자 안내 메일(IP를 바꾸면 한도 우회). 돈이나 고객 개인정보가 새지는 않는다(금액은 서버가 정한다).

**수정** `PAYMENT_LINKS`의 키를 slug 원문이 아니라 `sha256(slug)` hex로 바꾼다. `getPaymentLink`는 형식 검사 뒤 `createHash('sha256').update(slug).digest('hex')`로 조회한다. slug는 24 hex(96비트)라 해시에서 역산할 수 없고, 새 인프라·마이그레이션·재배포 외 절차가 없다. 새 링크는 `node -e`로 slug를 만들어 고객에게 주고 해시만 커밋한다. 현재 slug는 git 이력에 영구히 남았으므로 폐기하고 새로 발급한다(주문 행은 slug를 저장하지 않고 success/fail은 `getPaymentLink`를 안 쓰므로 진행 중인 결제는 영향 없음, `fail.tsx`의 slug 되돌아가기 링크만 확인). 폐기 전에 이 slug를 이미 고객에게 보냈는지 확인한다. `expiresOn`은 링크마다 지정한다. `data/paymentLinks.test.ts`와 `tests/api/payment-links/order.test.ts`는 `Object.keys(PAYMENT_LINKS)`로 slug를 얻으므로 테스트용 고정 slug와 그 해시 픽스처로 바꾼다.

**비고** 검증자 조정: 원 수정안의 DB 표·관리자 화면·env 방식은 과하다(해시 키가 더 단순). '상품명에서 고객 계약 정황이 읽힌다'는 주장은 근거가 약해 뺐다.

#### PAY-6. 결제가 성립하지 않은 주문(만료·실패)의 고객 이름·연락처·이메일이 법정 5년 기준으로 남는다 [P2 · M]

**위치** `lib/privacy/orderRetention.ts:136-164`(purgeExpiredOrderCustomerData) · 같은 파일 `:55-63` · `pages/api/cron/purge-orders.ts` · `tests/api/cron/purgeOrders.test.ts` · `lib/funding/service.ts:315-324` · `lib/funding/CLAUDE.md:229-248`

**지금 코드**

```ts
.where(and(lt(orders.createdAt, boundary), lt(orders.updatedAt, boundary),
           or(ne(orders.customerName, PURGED_MARK), ...)))   // status 조건 없음
```

같은 파일 L55-63은 결제 실패 사유를 "계약이 성립하지 않은 사건이라 5년 보존 대상이 아니다"라며 1년으로 단축하고, `closeDormantSubscriptions`는 결제 이력 없는 구독의 고객 정보를 같은 논리로 3년 방치 뒤 파기한다.

**왜 문제인가** 주문에만 같은 판정이 빠져 있다. payments 행이 없는 expired·failed 주문도 생성일과 갱신일이 모두 5년 지나야 이름·연락처·이메일이 파기된다. 처리방침 문구는 '예약·결제 기록은 5년'이라 명시적 약속 위반은 아니고 데이터 최소화 미비다.

**조건과 결과** 결제창을 열다 만 이탈 주문(전체 주문에서 비중이 크다)이 → 5년간 실명·연락처를 보유한다. 유출 시 피해 범위가 그만큼 넓어진다.

**수정** 별도 함수 `purgeExpiredUnpaidOrderCustomerData`를 추가하고 purge-orders의 run 목록에 등록한다. 기존 함수는 건드리지 않는다(healthCheck.ts 주석의 이유). 대상은 `status IN ('expired','failed') AND NOT EXISTS(payments) AND updated_at < 1년 전`. **`pending`을 넣으려면 펀딩 계좌 입금 pledge(`funding_pledges.payment_method='bank_transfer'`)를 반드시 제외한다** — 펀딩 계좌 입금 주문은 status가 awaiting_deposit이 아니라 pending이고 payments 행이 입금 확인 전까지 없으며 자동 취소도 없어, 조건을 그대로 넣으면 1년 넘게 입금을 기다리는 살아 있는 주문의 이름·연락처(입금자명 대조에 필요)를 지운다. `awaiting_deposit`와 `deposit_cancelled`는 늦은 입금 대조에 이름이 필요하므로 제외한다. set은 `customer_*`를 `PURGED_MARK`로 하고 `updated_at`은 갱신하지 않는다. 같은 크론의 `purgeFundingPersonalDataOfPurgedOrders`와 `purgeRefundAccountsOfPurgedOrders`는 PURGED_MARK를 따라가므로 순서를 그 앞에 둔다. bookings·work_orders의 `customer_note`는 이미 3년 파기가 맡으므로 별도 처리하지 않는다. 기간은 결제 실패 사유와 같은 1년이 일관되지만 구독 선례는 3년이니 운영자가 정한다. 1년 파기는 기존 5년 약속을 줄이는 쪽이라 처리방침 문구를 바꿀 필요가 없다 — 문구를 고치면 `FUNDING_TERMS_VERSION` 게이트가 걸린다. `orderRetention.test.ts`와 `purgeOrders.test.ts`(모의 목록)를 확장한다.

**비고** 검증자 조정: 원 수정안의 `pending` 포함 조건은 그대로 넣으면 펀딩 계좌 입금 주문을 파기하는 사고가 난다. 같은 자리를 다른 축도 지적: (SHW 공연 예매) "show_orders의 구매자 이름·연락처가 5년 파기 대상에서 빠져 있다(2031-10부터 효력)" · (PRV 개인정보·처리방침 정합·로그) "결제가 성립하지 않은 주문(만료·실패·입금 전 취소)의 이름·연락처는 1년 뒤 파기 — 운영자 확인과 판본 올림이 전제".

#### PAY-7. 관리자가 기록한 계좌 입금 환불을 예약·믹싱 메일은 '고객이 적은 계좌로 앞으로 송금'으로 쓴다 — 공연에는 있는 bank_account_sent 구분이 없다 [P2 · M]

**위치** `lib/booking/cancel.ts:136-139(planBankRefund), 463, 596, 501-503, 507-527, 640` · `lib/booking/email.ts:276-290(refundLine/refundHtmlParts), 326, 352-355, 476-478` · `pages/api/admin/bookings/[id].ts:176`(재발송) · `pages/admin/bookings/[id].tsx:346, 474-510` · `lib/payments/refundAccount.ts:110-116` · 선례 `lib/shows/emailHtml.ts:80-97`, `lib/shows/email.ts:433` · `lib/booking/bankDeposit.integration.test.ts:237-243`

**지금 코드**

```ts
const planBankRefund = (input, payment, refundAmount) => {
  if (!isBankDepositPayment(payment)) return { kind: 'none' };
  if (input.requestedBy === 'admin') return { kind: 'admin_record' };   // 환불 계좌를 받지 않는다
…
const refundVia = isBankDepositPayment(payment) ? 'bank_account' : 'payment';  // L463, L596 — admin_record도 bank_account
await recordNotificationError(order.id, order.orderNo,
  await sendBookingCancelledEmails(order, booking, refundAmount, refundVia));  // L527
```

`email.ts` `refundLine`은 `bank_account`에서 "적어 주신 환불 계좌로 접수일부터 3영업일 이내에 보내 드립니다. 계좌를 잘못 적으셨다면 이 메일에 회신해 주세요."를, 운영자 메일은 제목 '계좌 송금 필요'와 "고객이 적은 환불 계좌로 3영업일 이내에 송금하고 관리자 화면에서 '송금 완료'를 눌러 주세요."를 쓴다.

**왜 문제인가** 관리자 환불은 설계상 '운영자가 이미 송금하고 기록'하는 것이다(관리자 화면 확인창 "송금을 마친 뒤 기록하세요", `cancel.ts:501-503` 주석, 통합 테스트 제목). 그래서 환불 계좌 행이 없고 헬스체크가 추적하지 않는 것은 의도다. 그런데 refundVia는 결제 행이 계좌 입금이면 무조건 `bank_account`라, 고객은 적은 적 없는 계좌에 대한 '앞으로 보낸다'는 메일을 받고, 운영자는 눌러야 할 버튼이 없는 지시('접수된 환불 계좌가 없습니다'만 보이고 송금 완료 버튼은 렌더되지 않음)를 받는다. `mark_refund_sent`를 눌러도 0행 갱신으로 조용히 끝난다. 관리자 첫 취소는 `isAdditionalRefund`가 아니므로 메일이 실제로 나가고, 재발송(`[id].ts:176`)도 결제 행만 보고 같은 값을 만든다. 공연 쪽은 이미 `bank_account_sent`("환불 금액을 계좌로 보내 드렸습니다", "3영업일 이내라고 쓰면 안 된다")로 구분하고 운영자 메일도 `refundVia === 'bank_account'`일 때만 송금 필요로 본다 — 예약·믹싱만 그 구분을 안 받았다.

**조건과 결과** 관리자가 계좌 입금 예약·믹싱을 환불 처리하면 → 고객 혼동 메일 + 운영자에게 할 일 없는 '송금 필요' 알림. 돈·데이터 영향은 없다.

**수정** `lib/shows`와 같은 방식으로 맞춘다. ① `CancelOutcome.refundVia`와 `email.ts`의 refundVia 유니온에 `'bank_account_sent'`를 더하고, `cancelSessionBooking`(L463)·`cancelMixingOrder`(L596)에서 `bankPlan.kind === 'admin_record'`이면 `'bank_account_sent'`, `customer_account`이면 `'bank_account'`로 넘긴다. ② `email.ts`의 `refundLine`/`refundHtmlParts`는 `bank_account_sent`에서 "환불 금액을 계좌로 보내 드렸습니다. 받지 못하셨다면 이 메일에 회신해 주세요"(shows `showRefundViaSentence`와 같은 말)로 쓰고, `operatorCancelHtml`/`sendBookingCancelledEmails`/`sendMixingOrderCancelledEmails`의 `needsTransfer`·'계좌 송금 필요' 제목·`BANK_REFUND_NOTICE`는 `bank_account`일 때만 켠다. ③ `pages/api/admin/bookings/[id].ts:176` 재발송은 `payment.refunds` 중 `requestedBy === 'customer'`인 행이 있으면 `bank_account`, 없으면 `bank_account_sent`로 고른다. ④ `bankDeposit.integration.test.ts:237-243`에 `sendBookingCancelledEmails` 4번째 인자가 `'bank_account_sent'`임을 단언하고, `email.test.ts`에 문구 케이스를 더한다. 관리자 환불 폼에서 환불 계좌를 입력받는 안은 채택하지 않는다 — 설계와 어긋나고 송금 대기 원장(`refund_accounts`)을 이미 보낸 건으로 오염시킨다.

**비고** 검증자 조정: 원 지적의 '헬스체크 추적 공백' 주장과 환불 계좌 입력 수정안은 철회. 문구·버튼 지시 불일치만 남겨 P2 유지.

#### PAY-8. 예약금 결제 링크 화면에만 환불·청약철회 조건 고지가 없다 — 다른 네 결제 화면은 규정을 펼치고 서버가 동의를 확인한다 [P2 · S]

**위치** `pages/[locale]/pay/[slug].tsx:65-74` · `components/payments/PaymentLinkCheckout.tsx` · `pages/api/payment-links/order.ts:36` · `lib/booking/validation.ts:98, 119` · `data/paymentLinks.ts` · `lib/booking/email.ts:22-45`(예약금 입금 확인 메일) · `components/Layout.tsx:167-170`(isPrivatePaymentPage) · 대조 `components/booking/BookingWizard.tsx:682-702`, `ShowBookingForm.tsx`, `FundingTrustNotice.tsx:31`

**지금 코드**

```tsx
<p className="mt-8 text-center typo-card-meta">
  환불은 카카오톡 또는 전화로 문의해 주세요.{' '}
  <a href={kakaoUrl} …>카카오톡 문의</a>{' · '}<a href="tel:01042557893" …>010-4255-7893</a>
</p>
```

대조 — BookingWizard는 `<Panel title="환불 규정">{refundPolicyFor(selectedProduct).lines.map(…)}</Panel>` 아래 "결제하기를 누르면 위 환불 규정에 동의하는 것으로 봅니다."를 두고, 서버가 `refundPolicyAgreed`를 검증한다. 주문 API는 `validateCustomerContact`만 쓰고, 그 함수의 주석(`validation.ts:98`)과 최초 커밋(9b71198181)이 "환불 규정 동의가 없는 흐름"을 처음부터 의도한 설계로 적고 있다.

**왜 문제인가** `/ko/pay/<slug>`는 40만원을 받으면서 환불 조건을 한 줄도 보이지 않는다. `isPrivatePaymentPage`라 Layout이 푸터를 두르지 않아 이용약관 링크도 없고, 완료 메일도 "환불 등 문의는 카카오톡 또는 전화로"뿐이다. 예약·믹싱·공연은 규정 노출 + `refundPolicyAgreed` 검증, 펀딩은 약관·청약철회·환불 링크를 갖는다. 예약금 환불 조건의 정본(문안)은 저장소에 없다(docs·terms.tsx는 예약·믹싱 규정만 다룸).

**조건과 결과** 환불 요구가 있을 때 → 결제 전 고지를 입증할 근거가 화면에 없고, 결제 종류별 고지 수준이 어긋난다. 링크 하나를 특정 고객에게 보내는 일대일 경로라 노출 건수는 적다.

**수정** ① 운영자에게 예약금 환불 조건 문안을 받는다(계약서·견적서에 이미 있는 조건과 같아야 한다). **조건을 코드가 짓지 않는다.** ② `data/paymentLinks.ts`의 `PaymentLink`에 `refundLines: readonly string[]`을 링크별로 두고(이미 발급한 slug의 문안은 바꾸지 말 것), `pay/[slug].tsx`가 `PaymentLinkCheckout` 위에 `Panel title="환불 규정"`으로 펼친 뒤 BookingWizard와 같은 "결제하기/계좌 안내 받기를 누르면 위 환불 규정에 동의하는 것으로 봅니다" 한 줄을 둔다. 푸터가 없으므로 이용약관 링크도 함께 둔다. ③ `pages/api/payment-links/order.ts`에서 `refundPolicyAgreed === true`를 검증하고 `order.test.ts`에 거절 케이스와 클라이언트 전송을 추가한다. ④ 예약금 입금 확인 메일(`email.ts:22-45`)에도 같은 규정 요약을 넣는다. ⑤ 루트 CLAUDE.md 새 결제 종류 체크리스트에 '환불 규정 고지'를 더하고, `sharedCheckout.guard.test.ts`가 각 결제 화면의 환불 규정 노출(또는 면제 사유)을 짝짓게 한다. 법조문 번호는 문안·테스트·주석에 확정 인용하기 전에 확인한다(코드에서 확인되는 것은 BookingWizard 주석의 제13조 고지 의무까지).

**비고** 검증자 조정: 원 수정안의 환불 조건 예시 문안은 지어낸 사업 조건이라 뺐고, 제17조 제6항 인용은 미확인이라 뺐다. 2026-10-06 결제수단 누락 사고와 같은 영역이라 P2 유지.

#### PAY-9. 토스 콘솔의 부분 환불도 예약을 취소로 동기화하는데 운영자·고객 통지가 없다(의미 자체는 설계) [P3 · S]

**위치** `lib/booking/webhook.ts:136-151, 360-390` · `lib/booking/cancel.ts:484-495` · `docs/superpowers/plans/2026-08-25-toss-booking-phase1.md:1586`

**지금 코드**

```ts
if (booking && booking.status === 'confirmed') {
  const claim = await db.run(sql`UPDATE bookings SET status = 'cancelled', ... WHERE id = ${booking.id} AND status = 'confirmed'`);
  claimed = ...
}
// 호출부: } else { await syncCancelledFromToss(payment); }   // CANCELED와 PARTIAL_CANCELED 공통
```

**왜 문제인가** 선점 UPDATE는 `payment.status`를 보지 않고 합계가 0보다 크면 예약을 cancelled로 선점한다. 그러나 이것은 문서화된 설계다 — 설계 계획이 "CANCELED·PARTIAL_CANCELED → booking이 아직 confirmed면 DB 상태만 동기화"라고 못 박았고, 앱의 관리자 '임의 환불'도 confirmed 예약에 부분 금액을 환불하면 예약을 cancelled로 선점한다(`isAdditionalRefund`가 아닌 경우). '일부만 환불하고 예약은 유지'하는 경로는 앱에도 없다. 실제 공백은 동기화 후 통지(운영자 알림·고객 취소 메일)와 캘린더 정리가 없다는 점이다.

**조건과 결과** 운영자가 콘솔에서 부분 환불을 하고 예약이 취소되는 줄 모르면 → 고객이 그대로 방문해 현장 혼선. 발생 가능성은 낮고 운영자가 직접 한 조작이다.

**수정** 의미는 바꾸지 않는다. PAY-4의 수정으로 `syncCancelledFromToss`의 선점 성공 분기에 운영자 알림(`adminUrl` 딥링크, '콘솔 취소로 예약이 취소됨 — 부분 환불 N원' 표기) + gcal 삭제 + 고객 취소 메일을 best-effort로 추가한다. 부분 환불 후 예약 유지를 원한다면 그것은 앱 내 환불 UI까지 포함한 별도 제품 결정이다.

**비고** 검증자 조정: P2→P3. 원 지적의 'PARTIAL_CANCELED만 예외로' 수정안은 설계와 앱 경로를 어긋나게 하므로 철회.

#### PAY-10. 웹훅 대사와 앱 취소 batch가 아주 좁은 창에서 겹치면 refunds가 이중 기록될 수 있다(잔여 경합, 영향 제한적) [P3 · M]

**위치** `lib/booking/webhook.ts:56-88`(reconcileRefunds), `:157-164` · `lib/booking/cancel.ts:295-358`(settleRefund) · 선례 `lib/shows/confirm.ts:540-548`

**지금 코드**

```ts
const delta = cancelledTotal - refundedSum;
... db.insert(refunds).values({ ... amount: delta, requestedBy: 'webhook',
      tossTransactionKey: payment.cancels?.[...]?.transactionKey ?? null ...})
// 주석 L157-160: "같은 금액을 한 번 더 기록할 수 있다 ... 감수한다"
```

`cancel.ts:358` settleRefund의 기록 batch는 토스 응답 뒤에 실행된다. `toss_transaction_key`에는 DB 제약이 없다.

**왜 문제인가** 고객·관리자 취소는 예약 선점 → 토스 취소 → refunds/orders batch 순이고, 토스 취소 직후의 CANCELED/PARTIAL_CANCELED 웹훅이 batch 커밋 전에 `reconcileRefunds`에 도달해 done 합계 0을 읽으면 같은 금액을 한 번 더 insert한다. 다만 창이 매우 좁다 — 웹훅 쪽은 rate limit(DB 쓰기 2~3회) → fetchPayment(HTTP) → 멱등 INSERT → findOrderByOrderNo → 선점 → reconcile 읽기까지 직렬 왕복 5회 이상이고, 앱 쪽은 토스 응답 직후 batch 1회뿐이라 앱이 거의 항상 먼저 커밋한다(앱 인스턴스가 정지되는 경우에만 역전). 프로덕션 refunds가 4행이라 현재 영향도 없다.

**조건과 결과** 겹치면 → refunds 합계가 실제 환불의 2배가 되어 `remainingRefundable`이 0으로 눌려 잔액 환불이 막히고 매출장부 `refundedAmount`가 2배가 된다. 돈은 두 번 나가지 않는다(토스 취소 API를 다시 부르지 않음).

**수정** 마이그레이션 없이: 두 기록 지점 모두 `lib/shows/confirm.ts:540-548`과 같은 `INSERT ... WHERE NOT EXISTS (SELECT 1 FROM refunds WHERE payment_id=? AND toss_transaction_key=?)` 한 문장으로 바꿔 같은 거래키가 있으면 건너뛴다(앱 쪽은 이미 웹훅이 넣은 행이면 `requestedBy`/`reason`만 UPDATE). 부분 UNIQUE 인덱스는 환불이 늘어 실제 중복이 관찰된 뒤에 검토한다.

**비고** 검증자 조정: P2→P3. 원 수정안(부분 UNIQUE 인덱스 + 키별 대사 재작성 + 경합 테스트)은 마이그레이션 순서·when 함정이 따라와 이득 대비 무겁다.

#### PAY-11. 24시간을 넘긴 믹싱 주문이 늦은 웹훅으로 복구되면 order=paid인데 work_order=cancelled로 남는다(드문 경로) [P3 · S]

**위치** `lib/booking/confirm.ts:448-450, 475-479, 613, 626-634, 690-706` · `lib/booking/service.ts:267-290`(expireStaleOrders) · `lib/booking/validation.ts:30-43` · `lib/booking/admin-serialize.ts:288-303` · `lib/booking/webhook.integration.test.ts:542`

**지금 코드**

```ts
const acceptableStatuses = options.trustedByWebhook ? ['pending','expired','failed'] : ['pending'];
... db.update(workOrders).set({ status: 'received' })
     .where(and(eq(workOrders.orderId, order.id), eq(workOrders.status, 'pending'), EXISTS(orders paid)))
// service.ts:279 expireStaleOrders: UPDATE work_orders SET status='cancelled' WHERE status='pending' AND created_at < mixingCutoff
```

**왜 문제인가** expireStaleOrders는 24시간이 지나면 믹싱 orders를 expired로, work_orders를 cancelled로 함께 바꾼다. 신뢰 웹훅은 expired를 받으므로 batch의 orders UPDATE는 1행으로 paid가 되지만 work_orders UPDATE는 `eq(status,'pending')`에 걸려 0행이 되고, 그 0행은 console.error만 남기고 성공 처리돼 `deliverPostConfirmation`이 접수 메일을 보낸다. `confirm.ts:475-479`와 `:613`의 "늦은 승인은 orders 전이가 0행이 되고 autoCancel이 되돌린다"는 주석은 이 경로에선 틀렸다(orders는 1행이다). 기존 테스트는 1시간 15분 경과 건만 본다.

**조건과 결과** 첫 승인 기록 실패 + 24시간 이상의 복구 지연(또는 운영자의 수동 재전송)이 겹쳐 DONE 웹훅이 처음 처리되면 → 고객은 접수 메일을 받았는데 work_order가 cancelled라 관리자가 작업 시작(received 필요)을 못 누른다. `canAdminRefund`는 열려 있어(`ADMIN_REFUNDABLE_ENTITY_STATUSES.mixing`에 cancelled 포함) 잔액 환불이나 고객 연락으로 해소할 수 있다.

**수정** 신뢰 웹훅(`options.trustedByWebhook`)일 때만 믹싱 하위 UPDATE 조건을 `status IN ('pending','cancelled')`로 넓히고 `cancelled_at=NULL`로 되살린다(미결제 주문의 cancelled는 expireStaleOrders만 만들 수 있다). 주석 475-479, 613을 사실대로 고치고 'created_at 25시간 전 + expireStaleOrders 실행 + DONE 웹훅 → work_order received' 통합 테스트를 추가한다.

**비고** 검증자 조정: P2→P3(믹싱 pending TTL 24시간이 토스 재시도 창을 덮도록 정한 값이라 트리거가 설계 범위 밖). 토스 웹훅 재시도 전체 기간이 24시간 안인지는 외부 사양이라 미확인.

#### PAY-12. 슬롯 조회 API에 IP 제한이 없고 매 요청 불필요한 만료 정리 쓰기가 붙는다(규모상 비용은 미미) [P3 · S]

**위치** `pages/api/bookings/slots.ts:41-49, 83-92` · `lib/booking/service.ts:23-31, 250-255` · `lib/booking/rate-limit.ts` · `lib/booking/gcal.ts`

**지금 코드**

```ts
export default async function handler(req, res) { ... const now = new Date(); await expireStaleOrders(now);
// consumeRateLimit 호출 없음. service.ts:250 "이 정리는 표시용 상태 정합일 뿐이다"
```

**왜 문제인가** 무인증 GET이 요청마다 UPDATE 3문장 batch와 FreeBusy를 호출한다. 슬롯 정확성은 `occupiedBookingSql`의 created_at 창이 이미 보장하므로 이 정리는 슬롯에 필요 없다. 예약 생성에는 IP 제한이 있고 이 API만 없다. 다만 FreeBusy 캐시 키는 캘린더 id + 날짜(MAX_BOOK_DAYS=60) + 영업시간 창(상품 몇 종)이라 키 공간이 수백 개로 유한하고, 테이블이 작아(orders 142·bookings 21·work_orders 4행) 스캔 비용이 사실상 0이다.

**조건과 결과** 의도적 공격이 아니면 영향이 없다. 공격 시 → 구글 쿼터(분당 사용자 600 수준) 소진으로 503 fail-closed가 되어 예약 퍼널이 막힐 수 있다.

**수정** `expireStaleOrders`를 slots 핸들러에서 모듈 변수로 30~60초 스로틀하거나 제거한다(관리자 목록 호출은 유지 — 빼면 만료 상태 반영이 관리자 목록을 열 때까지 미뤄진다). IP 제한이 필요하면 Vercel 방화벽 규칙으로 두는 편이 DB 쓰기를 늘리지 않는다. `consumeRateLimit`을 쓴다면 그 자체가 요청당 쓰기 2~3회(만료 DELETE + UPSERT)를 더하므로 expireStaleOrders를 먼저 걷어내 쓰기 총량이 늘지 않게 한다.

**비고** 검증자 조정: P2→P3(위험 과장). 같은 자리를 다른 축도 지적: (SEC 인증·권한·입력 검증·헤더) "공개 GET /api/bookings/slots에만 요청 제한이 없고, 검증 전에 DB 정리와 요청당 FreeBusy 2회를 돌린다" · (DB 스키마·마이그레이션·쿼리) "공개 GET /api/bookings/slots가 검증 전에 쓰기 batch(expireStaleOrders)를 돌린다 — 정합성은 이 호출에 기대지 않으므로 뺄 수 있다".

#### PAY-13. 결제 핵심 테이블에 FK·상태 보조 인덱스가 없다(현재 행 수에선 영향 없음, 규모 증가 대비) [P3 · M]

**위치** `db/schema.ts:361-393` · `drizzle/migrations/*`

**지금 코드** bookings/work_orders/payments/refunds/orders/webhook_events/rate_limits는 `sqliteTable` 3번째 인자(index)가 없다. 마이그레이션 전체에서 orders(order_no, manage_token)·payments(payment_key)의 UNIQUE 외에 이 테이블들의 비-UNIQUE `CREATE INDEX`는 0건(show_*·privacy_access_logs 등만 존재).

**왜 문제인가** `bookings.order_id`, `work_orders.order_id`, `payments.order_id`, `refunds.payment_id` 등 FK 조회(findOrderByOrderNo의 관계 로딩)가 전체 스캔이다. 운영 DB 실측(읽기 전용): orders 142, bookings 21, work_orders 4, payments 67, refunds 4, webhook_events 105, rate_limits 6행 — 스캔 비용이 마이크로초 단위이고 Turso rows-read 과금도 무시할 수준이다.

**조건과 결과** 이력이 수천 건 이상 쌓이면 → success·webhook·관리자 목록 지연이 선형으로 는다. 지금은 없다.

**수정** 지금은 보류한다. 주문이 수천 건을 넘길 때(또는 공연·펀딩 몰림이 관찰될 때) FK 4개(`bookings.order_id`, `work_orders.order_id`, `payments.order_id`, `refunds.payment_id`)만 먼저 `index()`로 추가하고 main 병합본에서 Turso CLI로 적용한다(CLAUDE.md의 when 최댓값 확인 절차 준수 — 수동 마이그레이션 1건의 운영 부담이 작지 않다).

**비고** 검증자 조정: 예방적 개선이라 P3. 같은 자리를 다른 축도 지적: (DB 스키마·마이그레이션·쿼리) "예약·주문 테이블에 보조 인덱스가 없다 — 현재 수백 행이라 체감 0, 다음 마이그레이션에 묶어 넣을 정리 항목".

#### PAY-14. webhook_events 정리가 레이트리밋 함수 안에 숨어 있다(구조 정리) [P3 · S]

**위치** `lib/booking/rate-limit.ts:39-70` · `pages/api/payments/webhook.ts` · `lib/payments/methodAlert.ts:48-58` · `db/schema.ts`

**지금 코드**

```ts
await getDb().delete(rateLimits).where(lte(rateLimits.expiresAt, nowSeconds));
... if (key.startsWith('webhook:')) { await cleanupExpiredWebhookEvents(now); }
... .insert(rateLimits)...onConflictDoUpdate(...).returning()
```

**왜 문제인가** 웹훅 요청마다 `consumeRateLimit`이 키 접두사를 보고 webhook_events 90일 정리를 직렬로 실행한다. 낡은 주석('다른 에이전트 동시 수정')이 이 결합의 근거로 남아 있다. 단, 만료 DELETE는 정리가 아니라 **창 리셋의 정확성에 필요하다** — `onConflictDoUpdate`가 count만 +1하고 `expires_at`을 갱신하지 않으므로 만료 행을 지우지 않으면 카운터가 영원히 쌓여 한도가 풀리지 않는다. 이 함수는 81곳(관리자 로그인 잠금 포함)이 쓰는 공용이다. 테이블이 작아(rate_limits 6행, webhook_events 105행) 비용은 없다.

**조건과 결과** 성능 영향 없음. 유지보수자가 정리 로직을 찾기 어렵다.

**수정** webhook_events 90일 정리를 하루 한 번 도는 기존 health-check 크론으로 옮기고 `consumeRateLimit`에서는 제거한다. rate_limits 만료 DELETE는 유지하되, 쓰기를 줄이고 싶으면 모듈 변수로 60초에 한 번만 실행한다(UPSERT 의미는 건드리지 않는다). CASE로 count·expires_at을 함께 리셋하는 재작성은 리스크 대비 이득이 작아 하지 않는다.

**비고** 검증자 조정: 성능 문제가 아니라 구조 정리(P3). 같은 자리를 다른 축도 지적: (DB 스키마·마이그레이션·쿼리) "rate_limits 호출마다 선행 DELETE 왕복 1회 추가 (소규모에서는 영향 미미)" · (CQ 코드 품질·구조·중복·타입 안전) "consumeRateLimit이 요청마다 만료 행 DELETE와 UPSERT를 따로 보내고 webhook_events 청소를 겸한다".

#### PAY-15. 예약금 카드 결제의 운영자 알림 메일이 실패하거나 프로세스가 중단되면 재시도·기록 없이 유실된다 [P3 · M]

**위치** `lib/booking/confirmDeposit.ts:275-285, 166-168` · `lib/booking/email.ts`(sendDepositLinkPaidEmail) · `pages/api/admin/bookings/[id].ts:152` · `lib/ops/healthCheck.ts:440-447` · `components/payments/BankDepositGuide.tsx:115`

**지금 코드**

```ts
if (rowsAffectedOf(batchResults[1]) === 0) return autoCancelStaleApproval(order, approved);
await notifyOperator(order, approved);   // 실패는 console.error만
return { ok: true, ... }
// 파일 머리: 'notificationError는 건드리지 않는다(헬스체크가 영구 경고를 내지 않게)' — #526의 의도적 결정
```

**왜 문제인가** `notifyOperator`는 batch 커밋 뒤 한 번만 시도하고 실패는 로그로만 남긴다. 웹훅 재도착은 `status==='paid' && trustedByWebhook`이면 `replay()`만 반환하므로 보충 경로가 없다. 중복 발송은 payments INSERT가 batch 맨 앞이라 `payment_key` UNIQUE로 이미 막혀 있다(이긴 쪽 한 통뿐). 고객 확인 메일 부재는 결함이 아니다 — `sendDepositLinkPaidEmail`은 계좌 입금 안내가 "입금이 확인되면 메일로 알려 드립니다"라고 약속해서 있는 것이고, 카드 결제는 success 페이지가 영수증 링크를 바로 보여 준다.

**조건과 결과** Resend 실패나 프로세스 종료가 notifyOperator 전에 나면 → 운영자가 카드로 들어온 예약금을 메일로 못 받는다. 결제 기록·영수증·매출장부는 정상이고 토스 콘솔에도 남는다.

**수정** 세션식 `send_pending` 이식은 하지 않는다 — `resend-notification`이 booking 없는 deposit 주문을 409로 거절해 healthCheck의 '확인 메일이 나가지 않은 주문' 경고를 지울 방법이 없다(계좌 입금 확인 경로가 이미 같은 약점). 비용 대비 효과 순: (a) 아무것도 바꾸지 않고 머리 주석에 '운영자 알림 유실 가능, 토스 콘솔이 정본'을 명시. (b) notifyOperator 실패 시 1회 재시도. (c) 센티널을 쓰려면 먼저 admin resend-notification이 `type='deposit'`(booking 없음)에서 notifyOperator나 sendDepositLinkPaidEmail을 다시 보내도록 확장해 경고를 지울 수 있게 하고, 그 뒤에 notification_error 기록을 추가한다. 고객 메일은 카드에는 넣지 않는다.

**비고** 검증자 조정: P2→P3. '중복 호출 방어 없음'·'고객 메일 부재' 주장은 틀려 뺐고, 원 수정안은 #526 설계 결정과 충돌한다.

#### PAY-16. 계좌 입금 결제 행이 토스 API에 닿지 않는다는 불변식이 호출자별 가드에만 의존한다(현재 호출자는 모두 정상) [P3 · S]

**위치** `lib/booking/toss.ts:160(confirmPayment), 205-255(cancelPayment, fetchPayment)` · 호출자 가드: `lib/booking/cancel.ts:309`, `lib/shows/refund.ts`, `lib/shows/showtimeOps.ts:123`, `lib/funding/cancel.ts:155-257`, `lib/funding/lineRefund.ts:51` · `lib/payments/bankDeposit.ts`(isBankDepositPayment)

**지금 코드**

```ts
export const cancelPayment = (input: { paymentKey; ...; paymentMethod?: string | null }) => {
  if (isVirtualAccountMethod(input.paymentMethod)) { ...가상계좌만 차단... }
  return request(`/payments/${encodeURIComponent(input.paymentKey)}/cancel`, ...)
}
// 계좌 입금 가드는 호출자 쪽 if (isBankDepositPayment(payment))
```

**왜 문제인가** `cancelPayment`·`fetchPayment`는 `bank-deposit:` 키를 거르지 않는다. 현재 호출자 전부(위 목록)는 앞에서 막고, `confirm.ts:160`·`confirmDeposit.ts:61`·`shows/confirm.ts:511`은 방금 토스가 승인한 실제 키를 취소하며, `shows/confirm.ts:474`가 쓰는 pending·expired·failed 주문의 payments 행에는 bank-deposit 행이 생기지 않는다(paid 확정 뒤에만 생김). 즉 오늘의 버그는 없다.

**조건과 결과** 향후 새 호출자가 가드를 빠뜨리면 → 토스 404가 나고 환불이 실패한다. 오늘 사용자 영향은 없다.

**수정** `toss.ts`의 `cancelPayment`와 `fetchPayment` 맨 앞에서 `isBankDepositPayment({ paymentKey })`이면 토스를 부르지 않고 `{ ok:false, code:'BANK_DEPOSIT_PAYMENT', message }`를 돌려준다(가상계좌 가드와 같은 모양, import 순환 없음 — `lib/payments/bankDeposit.ts`는 import가 없고 toss.ts는 methodAlert만 import). `confirmPayment`는 실익이 없어 생략해도 된다. `toss.test.ts`에 두 케이스를 추가한다. 호출자 가드는 문구와 DB 기록용으로 남긴다. 웹훅의 위조 키 처리는 지금도 500이고 가드를 넣어도 그대로이므로 바꾸지 않는다. 대안: 'cancelPayment( 호출 파일은 isBankDepositPayment 또는 paymentMethod 인자를 쓴다'는 소스 스캔 테스트(`tests/payments/sharedCheckout.guard.test.ts` 방식).

**비고** 검증자 조정: 현재 버그가 아닌 방어 심층 강화라 P3.

#### PAY-17. 결제 요청 오류 분기가 네 결제 폼에 복제돼 있다(현재 동작 차이는 결함이 아님) [P3 · M]

**위치** `components/booking/BookingWizard.tsx:446-477, 772` · `components/booking/MixingOrderWizard.tsx:284-316` · `components/payments/PaymentLinkCheckout.tsx:93-107` · `components/funding/PledgeWizard.tsx:528-560` · `utils/reportPaymentFailure.ts`

**지금 코드**

```ts
catch (err) {
  reportPaymentFailure(createdOrderNo, err);
  const code = ...;
  if (code === 'USER_CANCEL' || code === 'PAY_PROCESS_CANCELED') return;
  if (agreedRequiredTerms !== true) { ...TOSS_TERMS_REQUIRED_MESSAGE }
  else if (code === 'NEED_CARD_PAYMENT_DETAIL') { ... } else { ... }
}
```

같은 블록이 네 폼에 거의 같은 문구로 있고 ShowBookingForm은 자체 i18n 분기다.

**왜 문제인가** 새 오류 코드나 문구 정책이 생기면 네 곳을 고쳐야 한다(NEED_AGREEMENT 오진 주석이 여러 곳에 남은 것이 과거에 그랬다는 증거). `submitting` 가드 유무 차이는 결함이 아니다 — 제출 버튼이 `disabled={submitting||...}`이고 `setSubmitting(true)`이 첫 await 앞에서 동기 호출되어 두 번째 클릭이나 Enter 암묵 제출이 막힌다(PledgeWizard는 ref 가드까지 있어 더 방어적일 뿐). '예약'/'주문' 문구 차이도 의도된 것이다.

**조건과 결과** 현재 사용자 영향 없음. 한 곳만 고치는 실수 위험.

**수정** 제출 훅(`useCheckoutSubmit`)은 만들지 않는다 — 금전 흐름 네 폼의 제출 구조를 바꾸는 큰 리팩터라 위험 대비 이득이 작다. `components/payments/`에 순수 함수 하나만 둔다: `describePaymentRequestError(err, { agreedRequiredTerms, fallback }): string | null`(취소 코드면 null, 약관 미동의면 `TOSS_TERMS_REQUIRED_MESSAGE`, `NEED_CARD_PAYMENT_DETAIL`이면 카드사 안내, 아니면 폼이 넘긴 fallback). 각 폼은 `reportPaymentFailure` 호출과 주문 생성 fetch를 그대로 두고 catch 본문만 이 함수로 바꾼다. 문구 차이는 fallback 인자로 보존한다. 함수 단위 테스트를 달고, `sharedCheckout.guard.test.ts`에 'catch 안에서 NEED_CARD_PAYMENT_DETAIL을 직접 비교하지 않는다' 검사를 더하는 것은 선택이다. 우선순위는 낮다.

**비고** 검증자 조정: '이미 갈라지고 있다'는 근거가 약해 P3.

#### PAY-18. 예약금(deposit) 주문은 pending이 영원히 만료되지 않고, 계좌 입금으로 낸 예약금은 환불을 시스템에 기록할 수 없다 [P3 · M]

**위치** `lib/booking/service.ts:284-289` · `lib/booking/cancel.ts:134-138, 651` · `lib/booking/admin-serialize.ts`(canAdminRefund) · `lib/booking/confirmDeposit.ts:160` · `pages/api/payment-links/order.ts:36-52` · `pages/admin/bookings/index.tsx:72-86` · `pages/admin/bookings/[id].tsx` · `lib/ops/salesLedger.ts` · `lib/booking/webhook.ts:370-377`

**지금 코드**

```sql
UPDATE orders SET status = 'expired' WHERE status = 'pending'
  AND ((type = 'session' AND created_at < ${sessionCutoff}) OR (type = 'mixing' AND created_at < ${mixingCutoff}))
```

```ts
// cancel.ts:651
if (order.type === 'deposit') { return { ok: false, code: 'invalid_state', message: '예약금 주문은 여기서 환불할 수 없습니다. 토스 콘솔 또는 계좌 송금으로 처리해 주세요.' }; }
```

**왜 문제인가** ① expireStaleOrders는 session·mixing만 만료시키고(함수 주석도 '예약·믹싱 주문만 책임') deposit이 없다 — 예약금 링크(#529) 추가 때 빠진 것으로 보인다. `payment-links/order.ts`는 제출마다 새 pending 주문을 만들고, 관리자 목록은 pending deposit을 일부러 숨긴다. cron·healthCheck 어디서도 정리하지 않는다. ② `cancel.ts:651`이 deposit을 막고, `canAdminRefund`는 deposit의 entityStatus가 null이라 항상 false다. 세션·믹싱에만 있는 `admin_record` 경로(`cancel.ts:134-138`)가 deposit에는 없어 계좌 입금으로 확정된 예약금은 환불을 기록할 방법이 없다(토스 결제분은 `reconcileRefunds`로 대사된다).

**조건과 결과** ① 결제창을 열다 만 deposit 주문이 → pending으로 쌓이고 존재조차 안 보인다(개인정보 5년 보관은 만료 주문 전체와 같은 취급이라 별도 문제는 아님). ② 계좌 입금 예약금을 수기 송금으로 되돌려 주면 → refunds를 남길 방법이 없어 매출장부 `netAmount`·순부가세가 과대 계상된다(부가세 신고 영향).

**수정** ① `expireStaleOrders`의 orders UPDATE에 `OR (type='deposit' AND created_at < mixingCutoff)`(24시간)를 추가한다 — 웹훅 신뢰 경로가 expired도 받고(`confirmDeposit.ts:160`), 비웹훅 success는 pending만 받아 24시간 뒤 늦은 결제는 승인 호출 전에 거절되어 과금이 일어나지 않는다. ② `cancelBookingWithRefund`에서 deposit + bank-deposit 결제는 admin 요청에 한해 `admin_record`(토스 호출 없이 refunds done + orders 상태 갱신)를 허용하고, `canAdminRefund`를 entityStatus null 가드 포함해 함께 확장한 뒤 관리자 상세에 '수기 환불 기록' 버튼을 연다.

**비고** 검증자 확인(confirmed). 링크가 비공개이고 환불 건이 드물어 P3.

#### PAY-19. 결제창 실패 코드표가 네 화면에 복제되어 있고 pay/fail에만 할부 불가 문구가 없다 [P3 · S]

**위치** `pages/[locale]/pay/fail.tsx:16-29` · `pages/[locale]/booking/fail.tsx:20` · `pages/[locale]/funding/fail.tsx:19` · `lib/shows/failMessages.ts:8` · `lib/payments/recordFailure.ts:35`

**지금 코드** `pay/fail.tsx` `FAIL_MESSAGES`(10개 코드) vs `booking/fail.tsx` `FAIL_MESSAGES`(`NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT` 포함 11개). `lib/shows/failMessages.ts:8`은 주석에 '모듈 내부 상수라 복제한다'고 적혀 있다. `subscribe/[id]/fail.tsx`는 카드 등록용이라 내용이 달라 대상이 아니다.

**왜 문제인가** 같은 토스 결제창 실패 코드표를 네 곳이 각자 갖고 있고, pay/fail.tsx만 할부 불가 코드가 빠졌다. 주문번호 정규식(`pay/fail` `SNB-` 전용, `booking/fail` `(SNB|FND)-(M-)?`, recordFailure의 `PAYMENT_ORDER_NO_PATTERN`)이 화면별로 다른 것은 드리프트가 아니다 — 예약금 주문번호는 `generateOrderNo`의 `SNB-YYYYMMDD-XXXXXXXX`라 pay/fail의 정규식이 정확하고, `PAYMENT_ORDER_NO_PATTERN`으로 통일하면 TKT·FND까지 받아 오히려 느슨해진다.

**조건과 결과** 예약금 결제에서 할부 불가 카드를 고른 고객이 → 원인 대신 일반 문구와 코드만 본다. 새 거절 코드를 한 화면에만 추가할 위험.

**수정** 코드 → 문구 표만 `lib/payments/failMessages.ts`(순수 모듈)로 추출해 booking·pay·funding·shows(한국어)가 import한다. 주문번호 정규식은 화면별로 두고 통일하지 않는다. 당장은 `pay/fail.tsx`에 누락된 한 줄만 추가해도 사용자에게 보이는 문제는 사라진다.

**비고** 검증자 조정: 복제본은 세 곳이 아니라 네 곳. 같은 자리를 다른 축도 지적: (CQ 코드 품질·구조·중복·타입 안전) "토스 실패 코드 표가 복제되어 pay/fail만 할부 불가 코드가 빠졌다".

#### PAY-20. 카드 거절 코드 allowlist(DECLINE_CODE_PATTERN)가 네 곳에 복사되어 있다 — 의존성 없는 순수 상수인데 '결합 회피'를 이유로 복제 [P3 · S]

**위치** `lib/booking/confirm.ts:40, 43-52, 57-61` · `lib/booking/confirmDeposit.ts:37, 39` · `lib/funding/confirm.ts:19, 36` · `lib/shows/tossCodes.ts:5` · `lib/shows/confirm.ts:40` · `lib/booking/toss.ts`(KEY_MISMATCH_CODES)

**지금 코드**

```ts
const DECLINE_CODE_PATTERN = /^(REJECT_|INVALID_REJECT_CARD|EXCEED_MAX_|...|PAY_PROCESS_(CANCELED|ABORTED)$)/;
```

글자 하나 다르지 않게 네 곳에 있고, `ALREADY_PROCESSED_CODE`도 네 곳(confirm.ts:40·confirmDeposit.ts:37·funding/confirm.ts:19·shows/confirm.ts:40)에 있다.

**왜 문제인가** 'import 그래프를 섞지 않으려고 복제'라는 주석은 import가 전혀 없는 leaf 상수 모듈에는 성립하지 않는다 — shows가 이미 `tossCodes.ts`로 뺐다는 점이 이를 보여 준다. 이 패턴은 '남의 주문을 failed로 낙인하지 않는' allowlist 경계(`confirm.ts:43-52` 주석)라 한쪽만 넓어지면 위험하다. 패리티를 고정하는 테스트도 없다(`tossCodes.test.ts`는 shows 쪽만).

**조건과 결과** 새 거절 코드나 오탐 수정이 → 일부 도메인에만 반영된다. 현재 네 정의는 동일하므로 지금 터지는 버그는 아니다.

**수정** `lib/payments/tossCodes.ts`를 만들어 `DECLINE_CODE_PATTERN`, `isCustomerDecline`, `ALREADY_PROCESSED_CODE`, `KEY_MISMATCH_CODES`를 export하고 네 모듈이 import한다. 기존 테스트가 패턴을 직접 검사하면 새 위치로 옮긴다.

**비고** 검증자 확인(confirmed).

#### PAY-21. 주문과 하위 행(bookings/work_orders)을 비원자적으로 두 번 쓴다 — 중간 실패 시 고아 주문, 특히 계좌 입금은 영구 [P3 · S]

**위치** `lib/booking/service.ts:112-124(createBookingOrder), 207-224(createMixingOrder), 284-289` · `pages/api/bookings/index.ts:57` · `pages/api/orders/mixing.ts:30` · `db/schema.ts:293` · `lib/booking/service.integration.test.ts`

**지금 코드**

```ts
const [order] = await db.insert(orders).values({... status: options.paymentMethod === 'bank_transfer' ? AWAITING_DEPOSIT : 'pending' }).returning({ id: orders.id });
... await db.run(sql`INSERT INTO work_orders (...) VALUES (...)`);
```

**왜 문제인가** createMixingOrder는 orders INSERT와 work_orders INSERT가 별개 왕복이고, createBookingOrder도 orders INSERT 뒤 bookings INSERT 루프에서 DB 오류가 던져지면 orders만 남는다(slot_taken만 failed로 정리). 두 호출부에 예외 정리 코드가 없다. 토스 pending은 expireStaleOrders가 만료시켜 자가 치유되지만 awaiting_deposit은 만료 대상이 아니다(주석 '자동 취소 없음').

**조건과 결과** 두 문장 사이에 DB 오류가 끼면(드묾) → 하위 행 없는 입금 대기 주문이 영구히 남고, 예외가 `deliverBookingDepositGuide` 앞에서 나므로 입금 안내 메일도 나가지 않아 고객이 알아채지도 못한다. 관리자 입금 확인 목록에 상품 없는 행으로 보인다.

**수정** 믹싱: `orders.id`가 앱에서 만드는 text이므로 id를 미리 만들어 `db.batch([db.insert(orders)..., db.run(INSERT work_orders ...)])`로 원자화. 세션: bookings INSERT 루프를 try/catch로 감싸 예외 시 `UPDATE orders SET status='failed' WHERE id=? AND status IN ('pending', 'awaiting_deposit')` 후 재던짐. `service.integration.test.ts`에 INSERT 실패 주입 케이스 추가.

**비고** 검증자 확인(confirmed).

#### PAY-22. 입금 대기 예약의 [입금 대기] 캘린더 일정 등록 실패가 경보 없이 지나간다 — 입금 대기 중 수동 일정과 겹쳐도 알 길이 없다 [P3 · M]

**위치** `lib/booking/bankDeposit.ts:129-144(holdBookingOnCalendar), 135-142, 238-297(confirmBookingBankDeposit)` · `lib/booking/confirm.ts:300-303, 361-367, 497-517` · `lib/ops/healthCheck.ts:395-410` · `pages/api/bookings/index.ts:46-52` · `pages/api/admin/bookings/[id].ts` · `lib/booking/calendarGuard.ts`

**지금 코드**

```ts
await ensureBookingEvent(order, booking, { label: '[입금 대기]', recordError: false });
// confirm.ts:300
if (opts.recordError === false) { console.error('[booking-confirm] 캘린더 등록 실패(기록 생략)' ...); return null; }
```

`confirmBookingBankDeposit`에는 토스 SSR 확정(`confirm.ts:497-517`)이 하는 `hasOccupancyCalendarConflict` 재확인이 없고, 확정 뒤 warnings는 '이용 시작 시각이 이미 지난 예약' 하나뿐이다.

**왜 문제인가** 웹 예약은 생성 시점 캘린더 가드(`calendarBlockedRooms`, fail-closed 503)와 DB 점유로 막히지만, 입금 대기 중(자동 취소 없음)에 운영자가 캘린더에 손으로 넣는 일정은 [입금 대기] 일정이 있어야 보인다. 그 등록은 실패를 삼키고(`recordError:false`) healthCheck의 gcalGap은 `status='confirmed'`만 본다. 신청 직전 읽기가 fail-closed라 구글 장애 중에는 주문이 생기지 않으므로, 실제로 남는 경우는 읽기는 되고 일정 생성만 실패하는 권한·쿼터 문제다. 확정 때는 `deliverPostConfirmation`이 gcalEventId·gcalError가 둘 다 null이면 [예약] 일정을 새로 만들고, 겹침은 캘린더에 수동 일정과 나란히 뜬다 — 토스 웹훅 확정도 "이미 승인된 돈은 거절하지 않고 확정, 겹침은 운영자가 본다"는 같은 정책이라 차단이 아니라 경고가 맞다. 공백은 입금 대기 기간에 한정된다.

**조건과 결과** 대기 일정 등록 실패 + 입금 대기 중 운영자가 전화 예약을 그 시간에 손으로 넣음(두 조건의 곱) → 확정 후 [예약] 일정이 수동 일정과 나란히 보이고, 놓치면 오프라인 이중예약. 운영자는 신청 순간 입금 안내 운영자 메일로 해당 시간을 이미 알고 있다.

**수정** `gcal_error` 의미는 건드리지 않는다(gcalError를 '시도했다' 표지로 읽는 `deliverPostConfirmation` 조건·관리자 배너·healthCheck 조건이 모두 걸린다). 확정 때 freeBusy를 더 부르는 대신 원인을 드러낸다: healthCheck에 읽기 전용 항목 하나 — session 주문이 `awaiting_deposit`이고 `booking.gcal_event_id`가 NULL이며 `isCalendarActive`가 참이고 신청 후 10분~1시간 이상 지난 건을 '입금 대기 일정 없음'으로 보고. 또는 관리자 입금 안내 재발송 때 `holdBookingOnCalendar`를 한 번 더 시도한다(이미 id가 있으면 건너뛰는 가드가 있다). 확정 시점 경고를 꼭 넣겠다면 waitingEventId가 없을 때만 `hasOccupancyCalendarConflict`를 try/catch로 돌려 겹치면 warnings에 추가(차단·실패 무시).

**비고** 같은 자리를 적은 1·2라운드 지적 둘을 합쳤다. 검증자 조정: '구글 장애 중 생성' 전제와 '토스 확정과 달리 차단 없음' 서술은 과장이라 바로잡았고, gcal_error 접두사 방식 수정안은 위험이 커 철회.

#### PAY-23. 관리자 캘린더 재시도가 정식 등록과 다른 일정 제목·설명을 만든다 [P3 · S]

**위치** `pages/api/admin/bookings/[id].ts:207-241(222-231)` · `lib/booking/confirm.ts:282-292` · `lib/booking/admin-serialize.ts:169` · `tests/api/admin/bookings-retry-gcal.test.ts`

**지금 코드**

```ts
// retry-gcal
summary: `[예약] ${booking.serviceType}${...} — ${order.customerName}`,
description: [`상품: ${booking.productId} (${booking.durationHours}시간)`, ...]
// confirm.ts:286 ensureBookingEvent
summary: `${label} ${getProduct(booking.productId)?.nameKo ?? booking.serviceType}...`
```

가드는 `booking.status === 'cancelled'`만 제외한다.

**왜 문제인가** retry-gcal이 일정 제목과 설명에 상품 한글명 대신 서비스 코드·상품 id를 써서 재시도로 만든 일정에 'recording' 같은 코드가 보인다. '입금 대기(pending) 예약에도 [예약]을 올린다'는 UI에서는 도달하지 못한다 — `canRetryGcal`은 gcalError가 있거나 `gcalMissing`(confirmed에서만 참)일 때만 버튼을 열고, pending 예약은 gcalError가 쓰이지 않는다. API 직접 호출로만 닿는다.

**조건과 결과** 운영자가 캘린더 재시도를 누르면 → 그 일정이 운영자 캘린더에서 다른 모양으로 보인다.

**수정** 제목·설명 문자열 생성만 `buildBookingEventPayload(order, booking, label)`로 추출해 `ensureBookingEvent`와 retry-gcal이 공유한다. 재시도의 '새로 만들고 옛것 삭제' 순서와 gcalError 초기화는 유지한다(`ensureBookingEvent`를 그대로 재사용하면 그 순서·초기화가 빠진다). API 가드를 `booking.status === 'confirmed'`로 좁히는 것은 선택 사항. `bookings-retry-gcal.test.ts`는 summary에 R02가 포함되는지만 보므로 상품명 기대값을 추가한다.

**비고** 검증자 조정: 'ensureBookingEvent 재사용' 수정안은 그대로 되지 않아 제목·설명 공용 함수로 바꿨다.

#### PAY-24. 관리자 환불 사유 상한(500자)이 토스 cancelReason 상한(200자)보다 커서 201~500자는 토스 오류로 환불이 막힌다 [P3 · S]

**위치** `pages/api/admin/bookings/[id].ts:116-122` · `pages/admin/bookings/[id].tsx:840-847` · `lib/booking/cancel.ts:309-346`

**지금 코드**

```ts
if (reasonText.length > 500) { return res.status(400).json({ ok: false, message: '환불 사유가 너무 깁니다.' }); }
// → cancel.ts:312 cancelPayment({ cancelReason: input.reason, ... })   // 토스 문서: cancelReason 최대 200자
```

UI 입력에는 maxLength가 없다.

**왜 문제인가** 사유가 그대로 토스 cancelReason으로 넘어간다(계좌 입금 건만 토스를 부르지 않음). 201~500자에서 토스가 거절하면 `cancel.ts:316-346`이 선점을 되돌리고 `toss_failed`(502)를 돌려준다. 돈은 나가지 않고 운영자는 토스 원문 메시지(`tossFailureMessage`가 관리자에게는 message를 그대로 돌려준다)를 보지만 원인(길이)을 알기 어렵다. 200자 상한은 저장소에 근거가 없어 외부 문서 기준이다.

**조건과 결과** 운영자가 201자 이상 사유를 쓰면 → 환불이 이유 없이 실패하고, 줄여서 재시도해야 한다.

**수정** 계좌 입금 건에는 200자 제한이 필요 없으므로 API 상한을 내리기보다 `settleRefund`에서 토스 호출 때만 `reason.slice(0,200)`을 보내고 `refunds.reason`에는 전문을 저장한다. 단위 테스트 추가.

**비고** 검증자 확인(confirmed).

#### PAY-25. 죽은 라우트 GET /api/admin/bookings가 예전의 유형 필터 없는 목록 로직을 그대로 갖고 있다 [P3 · S]

**위치** `pages/api/admin/bookings/index.ts:18-34` · `pages/admin/bookings/index.tsx:55-100`

**지금 코드**

```ts
await expireStaleOrders(new Date());
const allOrders = await getDb().query.orders.findMany({ orderBy: ..., limit: LIST_LIMIT, with: {...} }); // where 없음
```

**왜 문제인가** SSR 목록은 후원·구독 주문이 200건 상한을 잠식하는 문제를 `where(type IN session/mixing/deposit)`로 고쳤는데, 이 API는 고쳐지지 않은 채 인증(`authenticateAdminApi`)만 걸려 남아 있다. 호출처가 없다 — 본 트리의 fetch는 `/api/admin/bookings/${id}` 하위(`components/admin/bookingActions.ts`, `pages/admin/bookings/[id].tsx`)뿐이고 tests·scripts·docs에도 목록 엔드포인트 참조가 없으며, 라우트 열거형 가드 테스트도 없다.

**조건과 결과** 누군가 다시 쓰면 → 후원 주문이 '세션'으로 직렬화되고 매 호출 expireStaleOrders 쓰기가 실행되는 같은 버그가 재발한다.

**수정** 파일을 삭제한다. tests/pages/admin 쪽 참조가 있으면 함께 정리(현재 없음, 삭제해도 CI가 깨지지 않는다).

**비고** 검증자 확인(confirmed). 같은 자리를 다른 축도 지적: (DB 스키마·마이그레이션·쿼리) "호출처 없는 GET /api/admin/bookings가 SSR 목록과 다른 모집단을 돌려준다(+ 차단 시간 전량 적재)".

#### PAY-26. rowsAffected 해석 헬퍼가 사본 넷으로 갈라져 있다 (정리 수준) [P3 · S]

**위치** `lib/payments/bankDepositOrders.ts:332-336(rowsOf)` · `lib/booking/confirm.ts:108-111, 120(rowsAffectedOf)` · `lib/shows/service.ts:16` · `lib/funding/service.ts:29`

**지금 코드** `rowsOf`: `Number(result?.rowsAffected ?? 0)` → 읽을 수 없으면 0(실패로 해석). `confirm.ts:120` `rowsAffectedOf`: 읽을 수 없으면 undefined('정상으로 흘려보낸다' 주석). shows 사본은 0, funding 사본은 undefined.

**왜 문제인가** 기본값이 사본마다 엇갈린다. 다만 운영 영향은 없다 — drizzle 0.45 + @libsql/client에서 `db.run`과 `db.batch` 항목은 항상 ResultSet이고 rowsAffected가 있다. 달라지는 것은 목(mock)이 형태를 안 지킬 때뿐이다. 각 기본값도 목적에 맞다: 입금 확인·취소(rowsOf)는 판정 불가를 '이미 처리됨'으로 거절하는 fail-safe, 토스 확정(rowsAffectedOf)은 없는 실패를 지어내 결제를 취소하는 것을 피한다.

**조건과 결과** 테스트 목에서만 사본마다 다르게 동작한다.

**수정** 한 파일(`lib/db/rowsAffected.ts`)에 `rowsAffectedOf(): number | undefined` 하나만 두고, 호출부가 미판정(undefined)을 어느 쪽으로 읽을지 각자 적게 한다. strict 같은 옵션은 두지 않는다(CLAUDE.md '추상화·설정 금지'). 우선순위는 낮다.

**비고** 검증자 조정: '운영 오판정' 주장은 틀려 뺐다.

#### PAY-27. 매출장부 CSV에 공연(ticket) 구분 라벨이 없어 원문 'ticket'이 구분·설명 칸에 그대로 나간다 [P3 · S]

**위치** `lib/ops/salesLedger.ts:17-27, 60-66, 95-110, 172-178` · `pages/api/admin/orders/export.ts` · `db/schema.ts:443`(ordersRelations.showOrder) · `lib/ops/salesLedger.integration.test.ts`

**지금 코드**

```ts
const TYPE_LABELS = { session: '세션 예약', mixing: '믹싱·마스터링', funding: '펀딩', subscription: '구독', deposit: '예약금' };
// describeOrder: default: return order.type;
```

`orderTypeEnum`에는 `'ticket'`이 있다. 쿼리는 approvedAt이 있는 모든 payments 행을 읽는다.

**왜 문제인가** 토스로 확정된 공연 티켓과 계좌 입금 확인이 남기는 결제 행(method '계좌 입금', 2026-10-04부터) 모두 장부에 들어오는데, 구분·설명 칸에 'ticket' 문자열이 그대로 찍힌다. CLAUDE.md '새 결제 종류 체크리스트'의 '매출장부 라벨' 항목을 공연이 놓쳤다. 헤더 주석의 '토스 결제 장부'·'승인 기록 없는 무통장은 없다'도 낡았다(PAY-38).

**조건과 결과** 세무사에게 넘기는 CSV에서 → 공연 매출을 구분하기 어렵다. 금액은 맞다.

**수정** `TYPE_LABELS`에 `ticket: '공연 티켓'` 추가, `describeOrder`에 `case 'ticket'`(with에 `showOrder`를 더해 공연명·회차) 추가. 파일 머리 주석 정정. `salesLedger.integration.test.ts`에 ticket 행 케이스 추가.

**비고** 검증자 확인(confirmed; '설명 칸이 비어 보인다'는 'ticket'이 찍히는 것으로 정정). 같은 자리를 다른 축도 지적: (DB 스키마·마이그레이션·쿼리) "매출장부 CSV가 공연 티켓(orders.type='ticket')을 'ticket' 영문 원문으로 내보낸다 — 라벨과 설명 추가".

#### PAY-28. emailSent가 운영자 메일 실패와 입장 안내 누락까지 합산한다 [P3 · S]

**위치** `lib/booking/confirm.ts:369-376` · `lib/booking/email.ts:123-139, 214, 265, 267, 349, 425, 473` · `pages/[locale]/booking/success.tsx:76`

**지금 코드**

```ts
const notifyError = await deliverConfirmedEmails(() => ...sendBookingConfirmedEmails(...));
await recordNotification(...);
return !notifyError;   // email.ts: customer/operator 실패와 guide_missing 모두 failures에 합산
```

**왜 문제인가** `deliverPostConfirmation`이 notifyError 전체가 비었는지로 emailSent를 정해, 고객 메일이 나갔어도 운영자 메일 실패나 입장 안내 환경변수 누락으로 false가 된다. 입장 안내 자체는 고객에게 전달된다 — 값이 비면 `buildPracticeRoomGuide`가 "입장 안내 — 비밀번호는 이용 전에 별도로 보내드립니다. 받지 못하셨으면 010-4255-7893"을 본문에 싣는다.

**조건과 결과** 운영자 메일 실패 또는 입장 비밀번호 환경변수 누락(드묾) → 고객 메일이 나갔는데 완료 화면이 '확인 메일을 보내지 못했습니다'라고 말한다. '아래 링크를 저장해 주세요' 안내가 같이 나와 해는 작다.

**수정** 반환 타입은 바꾸지 않고(웹훅 복구·관리자 재발송·테스트 여러 곳에 퍼져 있다) `deliverPostConfirmation`에서 emailSent를 `!(notifyError ?? '').split(', ').some((f) => f.startsWith('customer:'))`로 계산한다. 믹싱의 `email.ts:349·425·473` 계열도 같은 `customer:` 접두 형식을 쓴다. `notificationError` 저장값은 그대로 두어 healthCheck가 운영자·안내 누락을 계속 잡는다.

**비고** 검증자 조정: '입장 안내 누락이 고객에게 전달되지 않는다'는 틀려 뺐고, 반환 구조화 수정안은 영향이 커 철회.

#### PAY-29. 웹훅 IP당 120회/시간 한도가 전 도메인 이벤트를 합산한다 (용량 근거 부족) [P3 · S]

**위치** `pages/api/payments/webhook.ts:19-24` · `lib/booking/rate-limit.ts` · `tests/api/payments/webhook.test.ts`

**지금 코드**

```ts
const ip = getClientIp(req) ?? 'unknown';
if (!(await consumeRateLimit(`webhook:ip:${ip}`, 120, 3600))) return res.status(429).json({ ok: false });
```

429도 카운터를 올린다(consumeRateLimit이 증가 후 판정).

**왜 문제인가** 한도가 정상 볼륨보다 충분히 크다는 주석의 가정을 뒷받침하는 수치가 없다. 토스 송신 IP가 소수라는 점과 한 시간에 수백 건이 몰릴 수 있다는 점 모두 저장소에 근거(트래픽 수치·로그)가 없다. 확정의 주 경로는 success SSR이고 웹훅은 복구·콘솔 취소 대사용 안전망이라, 429를 받은 건은 토스가 재전송하고 고정 창 1시간이면 풀린다. PAY-3의 결함 때문에 중복 도착이 500으로 나가 이 카운터를 추가로 소모하고 있다.

**조건과 결과** 몰림 구간(펀딩 마감, 공연 오픈)에서 429가 나면 → 복구 웹훅이 늦어진다. 데이터 유실은 없다.

**수정** 한도를 바꾸기 전에 429 발생 횟수를 로그로 남겨(`console.error('[webhook] rate limited', { ip })`) 실제 몰림이 있는지 먼저 본다. 값을 올리려면 그 수치를 근거로 한다. 허용 IP 면제는 하지 않는다(토스가 IP를 바꾸면 조용히 깨진다). PAY-3을 먼저 고쳐 중복 500이 카운터를 먹지 않게 한다.

**비고** 검증자 조정: 원 수정안(2,000회로 상향·허용 IP 면제)은 근거 없는 튜닝이라 철회.

#### PAY-30. send_pending 안내문이 '토스 웹훅이 곧 대신 보낸다'고 말하지만 계좌 입금 확정에는 그 웹훅이 없다 [P3 · S]

**위치** `lib/ops/notificationSentinel.ts:54-62` · `lib/booking/bankDeposit.ts:251` · `lib/booking/confirm.ts:413-427` · `pages/admin/bookings/[id].tsx:365, 381, 541-563` · `pages/api/admin/bookings/[id].ts:299-302` · `pages/admin/funding/[id].tsx:116` · `lib/ops/healthCheck.ts:423-443` · `lib/ops/notificationSentinel.test.ts`

**지금 코드**

```ts
if (value === SEND_PENDING) {
  return { kind: 'sentinel', title: '확인 메일이 아직 발송되지 않았습니다',
    detail: '주문은 정상 확정됐고 발송이 시작되기 전 단계입니다. 토스 웹훅이 곧 대신 보내므로 대개 몇 분 안에 사라집니다. 한참 지나도 그대로면 아래에서 다시 보내 주세요.',
// bankDeposit.ts:251
UPDATE orders SET status = 'paid', notification_error = ${SEND_PENDING}, updated_at = unixepoch() WHERE id = ${order.id} AND status = ${AWAITING_DEPOSIT}
// confirm.ts:413-427 — send_pending 복구는 trustedByWebhook 경로에서만
```

**왜 문제인가** `confirmBookingBankDeposit`는 토스 확정과 같은 센티널을 심지만 토스 결제가 없어 DONE 웹훅이 오지 않는다. SEND_PENDING을 소비하는 곳은 `confirmBookingPayment`의 trustedByWebhook 분기와 `deliverPostConfirmation`의 CAS뿐이다. 계좌 입금 건의 자동 복구는 없고 헬스체크 보고(다음 날)와 관리자 재발송만 남는다. 믹싱 주문은 재발송 버튼 자체가 없다(`canResend = !isMixing && …`). 센티널이 남는 구간은 batch 커밋과 CAS 사이(rename ≤8초, findById, CAS UPDATE)의 예외·함수 종료라 드물고, 이 구간의 예외는 API catch로 가서 관리자가 "처리하지 못했습니다" 오류를 직접 본다.

**조건과 결과** 그 드문 중간 사망 때 → 운영자가 '곧 사라진다'는 문구를 믿고 기다릴 수 있다. 같은 배너에 '한참 지나도 그대로면 재발송'이라는 올바른 지시가 있고 믹싱은 "재발송 버튼이 없습니다 — 고객에게 직접 연락해 주세요"로 이어지므로, 확정 메일(입장 비밀번호) 지연 위험은 낮다.

**수정** ① `describeNotificationError`에 두 번째 인자(예: `{ webhookRecovers: boolean }`)를 받아, 계좌 입금으로 확정된 주문(admin 쪽에서는 `booking.bankDeposit === 'paid'`)이면 "토스 웹훅" 문장을 빼고 "계좌 입금 확정은 자동 재발송이 없습니다. 아래에서 다시 보내 주세요"로 쓴다. 호출부는 `pages/admin/bookings/[id].tsx:381`, `admin/funding/[id].tsx:116`(펀딩 계좌 이체 여부 기준)이고 index.tsx 배지는 영향 없다. `notificationSentinel.test.ts`에 두 분기 단언. ② 선택: `confirmBookingBankDeposit`에서 batch 커밋 뒤의 findById·deliverPostConfirmation을 try/catch로 감싸 예외를 `{ ok: true, emailSent: false, warnings: ['확정은 됐지만 후처리가 중단됐습니다 — 알림 재발송을 눌러 주세요'] }`로 돌려주면 현재 500 + 재시도 409로 갈리는 흐름이 사라진다(warnings는 `postDepositAction`이 이미 화면에 올린다). ③ maxDuration은 프로젝트의 실제 함수 시간 기본값을 확인한 뒤 필요할 때만 `pages/api/admin/bookings/[id].ts`에 `export const config = { maxDuration: 60 }`(contracts `download.ts:32` 선례)로 둔다. 확인 전에는 근거로 삼지 않는다.

**비고** 검증자 조정: P2→P3(문구 결함). 원 수정안 '응답 emailSent로 버튼 띄우기'는 불필요(메일 실패 시 notification_error에 실제 사유가 기록되어 새로고침 뒤 재발송 버튼이 뜬다). 인용된 '1라운드 #8'은 저장소에서 찾지 못했고, 관리자 펀딩 상세는 이번에 읽지 않았다.

#### PAY-31. 계좌 입금 생성 API가 manageToken을 DB에서 다시 읽는다 — 생성 함수가 이미 가진 값을 버리고 재조회한다 [P3 · S]

**위치** `pages/api/bookings/index.ts:67-73` · `pages/api/orders/mixing.ts:33-36` · `lib/booking/service.ts:68, 97-111, 234 부근` · `lib/booking/bankDeposit.ts`(deliverBookingDepositGuide) · `db/client.ts`

**지금 코드**

```ts
await deliverBookingDepositGuide(result.orderNo, { throttleCustomer: true });
await holdBookingOnCalendar(result.orderNo);
const created = await getDb().query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, result.orderNo) });
return res.status(201).json({ ok: true, orderNo: result.orderNo, paymentMethod: 'bank_transfer', totalAmount: result.totalAmount,
  manageUrl: `/ko/booking/manage/${result.orderNo}?token=${created?.manageToken ?? ''}` });
// service.ts:68 const manageToken = generateManageToken();  — 만들지만 돌려주지 않는다
```

**왜 문제인가** 두 API가 같은 주문을 다시 SELECT한다. `db/client.ts`가 원격 libsql 클라이언트 하나라(임베디드 복제본 없음) 재조회는 일관되고 `?? ''` 분기는 사실상 죽은 코드다. 실제 노출 경로는 DB 읽기 예외·함수 시간 초과로 응답이 500/504가 되는 경우뿐이다(`deliverBookingDepositGuide`의 `findOrderByOrderNo`는 try 밖이라 읽기 실패가 그대로 던져진다). 그때 주문은 awaiting_deposit으로 성립한 채(자동 취소 없음 — `lib/payments/bankDeposit.ts` 머리 주석의 의도된 결정) 고객에게는 실패로 보이고, 자가 선점 해제가 `status='pending'`만 보므로 같은 시간대 재신청은 slot_taken(자기 신청)으로 막힌다.

**조건과 결과** DB 읽기 장애·시간 초과 같은 드문 조건에서만 → '성공했는데 실패로 보임', 운영자가 미입금 취소하기 전까지 시간대 점유. 평상시는 정상이다.

**수정** `service.ts`의 두 생성 함수 ok 반환에 `manageToken`을 추가하고, `bookings/index.ts`·`orders/mixing.ts`에서 `getDb().query.orders.findFirst`와 `getDb` import를 지워 `result.manageToken`으로 URL을 만든다. deliver/hold의 시그니처는 건드리지 않는다(`tests/api/payment-links/order.test.ts` 등이 orderNo 시그니처를 모킹하고 있고 이득이 작다).

**비고** 검증자 조정: '주문 객체를 받는 오버로드' 수정안은 과해 철회.

#### PAY-32. 자가 선점 해제의 두 UPDATE(bookings/work_orders→cancelled, orders→expired)가 batch 밖에서 따로 돈다 — 사이 실패 때 pending 주문 + 취소된 하위 행이 남는다 [P3 · S]

**위치** `lib/booking/service.ts:84-85, 97-111, 191-205` · `lib/booking/confirm.ts:333-366, 682-690`

**지금 코드**

```ts
if (releaseOrderNo) {
  await db.run(sql`UPDATE bookings SET status = 'cancelled', cancelled_at = unixepoch(), updated_at = unixepoch()
    WHERE status = 'pending' AND order_id IN (SELECT id FROM orders WHERE status = 'pending' AND type = 'session' AND order_no = ${releaseOrderNo} …)`);
  await db.run(sql`UPDATE orders SET status = 'expired', updated_at = unixepoch()
    WHERE status = 'pending' AND type = 'session' AND order_no = ${releaseOrderNo} …`);
}
// 주석 L84-85: "순서 주의: bookings를 먼저 cancelled로 바꾼다" — 순서를 await 순서로만 보장
```

`createMixingOrder`(L191-205)도 같은 구조. 같은 파일의 `expireStaleOrders`는 batch다.

**왜 문제인가** 첫 UPDATE 뒤 두 번째가 실패하면 옛 주문은 pending인데 하위 행은 cancelled다. 고객이 재시도하면 해제 구문이 다시 돌아 두 번째 UPDATE가 주문을 expired로 만들어 자가 치유되고, 아니어도 900초 뒤 expireStaleOrders가 정리한다. 그 틈에 다른 탭이 옛 주문을 결제하면 orders는 paid, 하위 전이는 0행이다. 그 경우에도 '캘린더·슬롯에 없는 예약'은 아니다 — `deliverPostConfirmation`은 취소된 booking 행을 그대로 집어 gcalEventId·gcalError가 둘 다 null이라 캘린더 일정을 만들고 확정 메일도 보낸다. 빠지는 것은 DB 점유(`occupiedBookingSql`)뿐이고 캘린더 가드가 웹 예약을 막는다. 믹싱은 work_orders가 cancelled로 남아 start_work(received 필요)가 안 열리는 쪽이 실제 피해다.

**조건과 결과** DB 부분 실패 × 같은 주문의 동시 결제라는 두 드문 조건이 겹치면 → 수동 대사가 필요한 불일치 주문 1건.

**수정** 두 UPDATE를 `await db.batch([db.run(bookings…), db.run(orders…)])`로 묶는다(batch 안에서도 앞 문장이 먼저 실행되어 주석의 순서 의존이 유지된다). `createMixingOrder`(L191-205)도 같이. 원인을 batch로 없애면 confirm 로그 승격 같은 추가 방어는 불필요하다.

**비고** 검증자 조정: 영향 서술 과장분을 바로잡았다. 같은 자리를 다른 축도 지적: (CQ 코드 품질·구조·중복·타입 안전) "예약·믹싱 주문 생성이 orders와 하위 행을 별 문장으로 넣어, 두 문장 사이 예외 시 awaiting_deposit 고아 주문이 남을 수 있다"(PAY-21과 같은 자리).

#### PAY-33. recordFailure.ts 주석과 테스트가 '믹싱은 SNB-M-' 형태를 전제하지만 generateOrderNo는 그런 번호를 만들지 않는다 — 테스트가 존재하지 않는 형식을 통과시킨다 [P3 · S]

**위치** `lib/payments/recordFailure.ts:32-35` · `lib/payments/recordFailure.test.ts:16-17` · `lib/booking/token.ts:15-18` · `lib/booking/service.ts:181` · `pages/[locale]/booking/fail.tsx:41` · `pages/[locale]/funding/fail.tsx:40` · `pages/[locale]/pay/fail.tsx:29` · `lib/funding/service.ts:96` · `lib/shows/shape.ts:30`

**지금 코드**

```ts
 * 주문번호 형태 — 예약(SNB)·펀딩(FND)·티켓(TKT), 믹싱은 SNB-M-, 펀딩 수기는 FND-M-, 티켓 초대권은 TKT-C-.
export const PAYMENT_ORDER_NO_PATTERN = /^(SNB|FND|TKT)-(M-|C-)?\d{8}-[0-9A-F]{8}$/;
// 테스트: it('주문번호는 예약(SNB)·믹싱(SNB-M-)·펀딩(FND) 형태만 받는다', … 'SNB-M-20260901-ABCDEF01' …)
// token.ts: export const generateOrderNo = (now) => `SNB-${ymd}-${randomBytes(4).toString('hex').toUpperCase()}`;
```

**왜 문제인가** 믹싱 주문은 `createMixingOrder`가 `generateOrderNo`를 그대로 써서 `SNB-YYYYMMDD-XXXXXXXX`다. 'SNB-M-'은 저장소 전체에서 주석·테스트 두 곳뿐이고(`git log -S`도 #213 한 커밋), 실제 접두 변형은 `FND-M-`과 `TKT-C-`뿐이다. 패턴은 `SNB-M-`/`FND-C-` 같은 존재하지 않는 조합도 통과시키고 테스트가 그 오해를 고정한다. 주문번호 정규식도 booking/fail·funding/fail `(SNB|FND)-(M-)?`, pay/fail `SNB-` 전용, shows는 별도 `SHOW_ORDER_NO_PATTERN`으로 제각각이다.

**조건과 결과** 기능 결함은 없다(믹싱 SNB- 번호는 정상 통과). 다음 사람이 '믹싱은 SNB-M-'을 믿고 분기(관리자 필터·장부 구분)를 짜면 → 믹싱 주문이 전부 빠진다.

**수정** ① 주석을 '예약·믹싱·예약금은 SNB-, 펀딩 FND-(수기 FND-M-), 티켓 TKT-(초대권 TKT-C-)'로 고치고 테스트의 `SNB-M-…` 케이스를 지운다(필요하면 '받지 않는다'로 뒤집는다). ② 선택: 주문번호 패턴을 `lib/booking/token.ts`에 `ORDER_NO_PATTERN`들로 모아 `recordFailure.ts`·`booking/fail.tsx`·`pay/fail.tsx`·`token.ts readPreviousOrderNo`가 같은 상수를 import하게 한다.

**비고** 검증자 확인(confirmed). 같은 자리를 다른 축도 지적: (CQ 코드 품질·구조·중복·타입 안전) "믹싱 주문번호 'SNB-M-' 허구 서술, 겹친 JSDoc 3곳, 작업 과정 주석 정리".

#### PAY-34. 예약 확인 페이지에서 '입금 전 신청 취소' 직후 상단 배지·믹싱 진행 상태가 '입금 대기'/'결제 대기'로 남는다(새로고침 전까지) [P3 · S]

**위치** `pages/[locale]/booking/manage/[orderNo].tsx:230-241, 344-346, 441-446, 463`

**지금 코드**

```tsx
<Badge size="md" tone={depositGuide ? 'warning' : BOOKING_STATUS_TONES[status]} className="shrink-0">
  {depositGuide ? '입금 대기' : STATUS_LABELS[status]}
</Badge>
// DepositWaitingSection: const [closed, setClosed] = useState(false);
// if (closed) return <Notice …>신청을 취소했습니다. 받은 돈이 없어 환불할 금액은 없습니다.</Notice>;
```

**왜 문제인가** 취소 성공은 `DepositWaitingSection` 지역 state `closed`에만 있고 배지는 SSR props `depositGuide`로 그려진다. 믹싱 '진행 상태' dd도 pending '결제 대기' 그대로다. closed가 되면 섹션은 Notice만 반환해 취소 버튼이 사라지므로 '다시 눌러 409'는 일어날 수 없다.

**조건과 결과** 취소 직후 → 배지 '입금 대기'와 본문 '신청을 취소했습니다'가 나란히 보인다. 새로고침하면 SSR이 deposit_cancelled로 그린다. 돈·데이터 영향 없음.

**수정** `DepositWaitingSection`에 `onClosed` 콜백을 받아 부모(세션·믹싱 뷰, 이미 `setStatus`가 있다)가 `depositClosed` state를 두고 배지를 `depositGuide && !depositClosed ? '입금 대기' : depositClosed ? '취소됨' : STATUS_LABELS[status]`(믹싱 진행 상태 dd도 같은 분기)로 그린다. 가장 단순한 대안은 취소 성공 시 `router.replace(router.asPath)`로 SSR을 다시 받는 것(단 SSR 취소 문구가 `DEPOSIT_CLOSED_NOTICE`로 바뀌는 점을 확인).

**비고** 검증자 조정: '재클릭 409' 영향 서술은 틀려 뺐다.

#### PAY-35. 관리자 mark_refund_sent가 환불 계좌 기록 실패·0행에도 200 ok를 돌려준다(admin 예약·공연 두 라우트) [P3 · S]

**위치** `pages/api/admin/bookings/[id].ts:310-317` · `pages/api/admin/shows/[id].ts:214` · `lib/payments/refundAccount.ts:110-116` · `lib/payments/bankDeposit.ts:100-104`(refundAccountKindOf) · `pages/admin/bookings/[id].tsx:80-83, 474-512` · `lib/funding/cancel.ts:215` · `tests/api/bookings/bankDepositRoutes.test.ts`

**지금 코드**

```ts
if (body.action === 'mark_refund_sent') {
  if (bankDepositStateOf(order) !== 'paid') return res.status(409).json({ ok: false, message: '계좌 입금 주문이 아닙니다.' });
  await markRefundAccountRefunded({ kind: isMixing ? 'mixing' : 'session', orderNo: order.orderNo }, new Date());
  return res.status(200).json({ ok: true });
}
// refundAccount.ts:110-116 — 실패·0행 모두 삼키고 void
```

**왜 문제인가** 운영자가 직접 누른 '송금 완료' 기록이 DB 예외·0행으로 실패해도 API는 ok:true다. deposit 주문이 session으로 분류되는 문제는 UI로 닿지 않는다 — 관리자 SSR이 deposit 주문은 환불 계좌 조회를 건너뛰어 송금 완료 버튼 블록이 렌더되지 않고, orderNo가 유일해 다른 행을 건드리지도 않는다. `funding/cancel.ts:215`는 취소 흐름의 best-effort 호출이라 삼키는 것이 의도다.

**조건과 결과** 기록이 안 됐는데 모르고 넘어가면 → 새로고침 시 버튼이 그대로 남고 헬스체크 '송금 대기' 알람이 계속 울린다. 관리자 전용 경로.

**수정** `refundAccount.ts`에 명시 동작용 `setRefundAccountRefunded(key, at): Promise<boolean>`(rowsAffected>0, 예외는 던지거나 false)를 추가하고 bookings·shows 두 admin 라우트만 이걸 써서 false면 409 '접수된 환불 계좌가 없습니다'/500으로 답한다. kind는 `refundAccountKindOf(order.type)`로 정하고 null이면 409. `funding/cancel.ts`의 best-effort 호출은 기존 함수를 그대로 둔다(함수 반환을 바꾸면 호출처가 갈린다). `bankDepositRoutes.test`에 '행 없음→409' 케이스 추가.

**비고** 검증자 조정: 'deposit 주문 kind 오분류' 피해 주장은 UI 도달 불가라 뺐다.

#### PAY-36. 고객 관리 URL(/ko/booking/manage/<orderNo>?token=)이 5곳에서 문자열로 조립되고 SITE_URL 폴백이 여러 파일에 복제돼 있다 — lib/email/layout.ts가 이미 SITE_URL을 export한다 [P3 · S]

**위치** 관리 URL: `lib/booking/bankDeposit.ts:48-49` · `lib/booking/email.ts:52-53` · `pages/api/bookings/index.ts:72` · `pages/api/orders/mixing.ts:36` · `pages/[locale]/booking/success.tsx:158`. SITE_URL 지역 정의: `lib/booking/bankDeposit.ts:33` · `lib/booking/email.ts:14` · `lib/shows/bankDeposit.ts:31` · `lib/shows/email.ts:27` · `lib/billing/email.ts:16` · `lib/funding/email.ts:17` · `lib/contracts/token.ts:3` · `lib/contracts/email.ts:158` · `lib/contracts/finalize.ts:41` · sitemap-funding/shows · funding/creator/login 등. 정본: `lib/email/layout.ts:19`.

**지금 코드**

```ts
const manageUrlOf = (order) => `${SITE_URL}/ko/booking/manage/${order.orderNo}?token=${order.manageToken}`;   // bankDeposit.ts
const manageUrl = (order: Order): string => `${SITE_URL}/ko/booking/manage/${order.orderNo}?token=${order.manageToken}`;   // email.ts
manageUrl: `/ko/booking/manage/${result.orderNo}?token=${created?.manageToken ?? ''}`,   // 두 API
manageUrl: `/ko/booking/manage/${result.orderNo}?token=${result.manageToken}`,   // success.tsx
// lib/email/layout.ts:19  export const SITE_URL = … (끝 슬래시 제거 포함)
```

**왜 문제인가** 관리 페이지 경로·쿼리 이름(`token`)이 바뀌거나 토큰을 URL 인코딩해야 하게 되면(지금은 base64url이라 안전) 다섯 곳을 찾아 고쳐야 한다. SITE_URL 정의는 같은 식이 여러 벌이고 그중 `lib/contracts/token.ts`·`contracts/email.ts`·`finalize.ts`는 끝 슬래시 제거(`.replace(/\/+$/, '')`)가 없다(현재 운영 env 값은 미확인). `booking/email.ts`는 이미 layout.ts에서 import 중이라 전환 비용이 거의 없다.

**조건과 결과** env `SITE_URL`에 끝 슬래시가 붙으면 → 계약 링크가 `//ko/...`가 된다. 그 외는 기능 결함이 아니라 수정 누락으로 메일 링크와 화면 링크가 갈리는 사고의 씨앗이다.

**수정** 새 모듈은 만들지 말고 `lib/booking/token.ts`에 `manageUrlPath(orderNo, token)`·`manageUrlAbsolute(order)` 한 쌍을 두고 5곳이 import한다. `SITE_URL`은 `lib/email/layout.ts`의 export 하나를 쓰도록 나머지 파일의 지역 상수를 지운다(contracts 3곳은 슬래시 제거까지 함께 통일).

**비고** 검증자 확인(confirmed; SITE_URL 지역 정의는 지적한 9개보다 많다).

#### PAY-37. 가상계좌 거절 문구가 수단을 열거한다 — 위젯에 계좌이체가 개통돼 있지 않으면 틀린 안내가 된다 [P3 · S]

**위치** `lib/booking/toss.ts:145-146` · `lib/payments/paymentChoices.ts:16-17` · `lib/payments/knownMethods.ts`(머리 주석) · `lib/booking/confirm.ts:539-541` · `lib/funding/confirm.ts:241` · `lib/booking/confirm.test.ts:185` · `lib/funding/confirm.integration.test.ts:266`

**지금 코드**

```ts
export const VIRTUAL_ACCOUNT_CONFIRM_MESSAGE =
  '가상계좌는 이용하실 수 없는 결제수단입니다. 카드·계좌이체·간편결제로 다시 결제해 주세요.';
// paymentChoices.ts:16-17  **토스 계좌이체(TRANSFER)는 넣지 않는다**(운영자 결정 2026-10-04)
```

**왜 문제인가** 2026-10-04 결정은 우리가 그리는 결제수단 목록(PaymentMethodPicker)에만 걸린다. 이 문구가 나가는 경로(가상계좌 승인 응답)는 가상계좌를 고를 수 있는 **위젯** 경로뿐이고(목록 화면은 `method:'CARD'`만 열어 가상계좌가 나올 수 없다), 위젯에 무엇이 뜨는지는 토스 콘솔 개통 상태가 정한다("위젯은 콘솔에서 개통된 수단을 그대로 그린다"). 계좌이체 개통 여부는 코드로 확정되지 않아 '존재하지 않는 수단을 권한다'고 단정할 수 없지만, 꺼져 있으면 틀린 안내다.

**조건과 결과** 가상계좌를 골랐다가 거절된 드문 고객에게만 닿고, 결제 자체는 막지 않는다.

**수정** 토스 콘솔의 위젯 개통 수단을 먼저 확인한다. 계좌이체가 꺼져 있거나 확인이 번거로우면 열거를 없앤다: '가상계좌는 이용하실 수 없는 결제수단입니다. 카드·간편결제 등 다른 결제수단으로 다시 결제해 주세요.' 이 상수는 펀딩 confirm도 쓰므로 `booking/confirm.test.ts:185`와 `funding/confirm.integration.test.ts:266`의 `toContain` 문자열을 함께 바꾼다.

**비고** 검증자 조정: '존재하지 않는 수단을 권한다' 단정과 '계좌 입금 안내 누락'은 전제가 과해 뺐다.

#### PAY-38. 매출장부 머리 주석·CSV 설명이 '토스·카드' 기준으로 남아 있다 — 계좌 입금 확인 행도 장부에 실린다 [P3 · S]

**위치** `lib/ops/salesLedger.ts:20-22, 28, 96` · `pages/api/admin/orders/export.ts:9` · `lib/booking/bankDeposit.ts:255-257` · `lib/shows/bankDeposit.ts:142`

**지금 코드**

```ts
 * 기준은 **결제 승인 시각**(payments.approvedAt)이다. …        // 20행 '토스 결제 장부', 22행 '카드로 들어온 돈'
 * 승인 기록이 없는 돈(무통장 후원·수기 등록)은 여기 없다. 그건 펀딩 CSV가 싣는다.   // 28행 — 지금도 맞다
// bankDeposit.ts:255-257 — 계좌 입금 확인은 approved_at을 채운 결제 행을 남긴다
INSERT INTO payments (id, order_id, payment_key, method, approved_at, receipt_url, raw_response)
SELECT …, ${paymentKey}, ${BANK_DEPOSIT_PAYMENT_METHOD}, ${approvedAt}, NULL, NULL
// export.ts:9  * 토스 결제 장부 CSV
```

**왜 문제인가** 세션·믹싱·공연·예약금의 계좌 입금 확인은 payments 행을 `approved_at`과 `method='계좌 입금'`으로 남기고 장부 쿼리는 `isNotNull(approvedAt)`만 보므로 장부에 실린다 — 부가세 신고 관점에서 올바른 동작이고 method 열로 구분된다. 낡은 것은 20·22행과 export.ts:9의 '토스·카드' 서술이다. 28행의 펀딩 무통장 예외는 펀딩이 결제 행 없이 `funding_pledges.payment_method`로 가르므로 지금도 맞다.

**조건과 결과** 주석 정확도 문제이며 동작은 정상이다.

**수정** `salesLedger.ts` 20-22행을 '승인된 결제와 계좌 입금 확인(bank-deposit: 행)을 승인·확인 시각 기준으로 한 표에 싣는다'로, `export.ts:9`를 '결제 장부 CSV'로 고친다. 28행은 그대로 둔다. ticket 라벨은 PAY-27에서 함께 처리한다.

**비고** 검증자 조정: 원 지적이 인용한 28행은 틀리지 않았고 낡은 것은 20·22행이다. 같은 자리를 다른 축도 지적: (FND 펀딩 — 후원·결제·명단·보존) "결제 장부(salesLedger)에 펀딩 계좌 입금이 없고, 입금 뒤 환불 기록된 건은 장부·발송 CSV 어디에도 나오지 않는다".

#### PAY-39. deliverBookingDepositGuide가 '대기 상태 아님'을 실패 사유 문자열 채널로 돌려주고, 관리자 재발송 라우트가 이를 200 ok로 감싼다(경합 때만, 화면은 실패 알림 표시) [P3 · S]

**위치** `pages/api/admin/bookings/[id].ts:281-283, 296-297` · `lib/booking/bankDeposit.ts:87-92` · `pages/admin/bookings/[id].tsx:262-264, 285` · `lib/shows/bankDeposit.ts:72` · `lib/booking/bankDeposit.integration.test.ts:204` · `pages/api/bookings/index.ts` · `pages/api/orders/mixing.ts`

**지금 코드**

```ts
export const deliverBookingDepositGuide = async (orderNo, opts = {}): Promise<string | null> => {
  const order = await findOrderByOrderNo(orderNo);
  if (!order || order.status !== AWAITING_DEPOSIT) return 'invalid_state';
  … await recordDepositGuideResult(order.id, failure); return failure;
// 관리자 라우트
const failure = await deliverBookingDepositGuide(order.orderNo);
return res.status(200).json({ ok: true, notificationError: failure });
```

**왜 문제인가** `'invalid_state'` 상태 코드가 notificationError 자리에 섞여 응답이 `ok:true + notificationError:'invalid_state'`가 된다. 관리자 라우트가 먼저 `bankDepositStateOf(order)==='awaiting'`을 검사하므로 함수가 다시 읽는 사이 상태가 바뀌어야 닿는 ms 단위 경합이고, 닿아도 UI(`postDepositAction`)는 notificationError가 truthy면 '입금 안내 메일 발송에 실패했습니다. 고객에게 직접 연락해 주세요.' 알림을 띄우고 새로고침해 바뀐 상태를 보여준다. 같은 sentinel 계약이 공연 `deliverShowDepositGuide`에도 있고 통합 테스트가 고정한다. 생성 API 두 곳은 반환값을 버린다.

**조건과 결과** 데이터·돈 영향 없고 운영자 오독도 없다. 정리 수준.

**수정** 공용 반환 타입은 건드리지 않는다(한쪽만 구조체로 바꾸면 공연 모듈과 갈린다). 관리자 라우트에서만 `if (failure === 'invalid_state') return res.status(409).json({ ok:false, message:'입금 대기 중인 계좌 입금 신청이 아닙니다. 새로고침해 주세요.' })`를 추가한다.

**비고** 검증자 조정: 영향이 거의 없어 P3 정리거리.

**클린 판정**
- lib/booking/toss.ts의 키 쌍 선택·재시도 규칙: tossSecretsInOrder 순서, KEY_MISMATCH_CODES 5종, NETWORK_ERROR·5xx 재시도 금지, 멱등키 전달이 루트 CLAUDE.md 표와 일치(토스 문서도 '에러 뒤 멱등키를 바꿔 재시도하면 위험'이라 명시해 현행 설계가 맞음)
- 금액 검증: 생성 API(validation.ts·computeAmounts·computeMixingAmounts)와 confirm(input.amount !== order.totalAmount, 토스 호출 전)·ALREADY_PROCESSED 재조회(orderId/status/totalAmount 3중 대조)·결제 링크(data/paymentLinks.ts 서버 금액만)에서 클라이언트 금액을 신뢰하는 곳 없음
- confirm.ts의 멱등성·경합 처리: payments.payment_key UNIQUE를 batch 첫 문장에 둔 설계, send_pending→send_inflight CAS, sessionHoldGuard, 소유 증명(paymentKey+amount) 없는 paid 재생 차단, allowlist 기반 failed 낙인
- 취소·환불 선점: cancel.ts의 UPDATE ... WHERE status 원자 선점, remainingRefundable 상한, remainder 선점 키(refunds.id=멱등키) 정합, 가상계좌·계좌 입금 분기, 환불 계좌 암호화·safeDbErrorSummary 로그 위생
- 계좌 입금 전이: confirmBookingBankDeposit·cancelAwaitingBookingDeposit·confirmDepositLinkBankDeposit의 낙관적 단일 UPDATE+batch, deposit_cancelled 확정 거부, occupiedBookingSql이 생성 가드·슬롯 조회에서 같은 정의 사용, 토스 만료 경로가 pending만 보는 규칙
- 웹훅 신뢰 모델: 페이로드가 아니라 fetchPayment 재조회 상태로 이벤트 키를 만들어 위조 선점 차단, 취소 키에 누적 합계 포함
- 관리자 API: SameSite=strict 세션 쿠키로 CSRF 방어, PATCH/POST 낙관적 전이, 정산 CSV의 수식 인젝션 방어(lib/funding/csv.ts), 접속기록 남김
- 고객 화면: manage 페이지 토큰 상수시간 비교와 404 일원화, 실패 화면이 message를 버리고 code 표만 사용, 결제 링크 slug 형식 검증, 캐시 헤더 no-store
- 이번 범위 jest(lib/booking, lib/payments, tests/payments) 37 스위트 456 테스트 모두 통과(읽기 전용 실행)
- lib/booking/toss.ts 키 쌍 선택·재시도(tossSecretsInOrder·KEY_MISMATCH_CODES 5종·NETWORK_ERROR/5xx 비재시도·Idempotency-Key 전달)와 가상계좌 차단 — 1라운드 판정 재확인, CLAUDE.md 표와 일치
- lib/booking/validation.ts(리드타임 0·60일·영업시간·전화 정규화·refundPolicyAgreed), amounts.ts(VAT 반올림·포함액 분할), kst.ts·slots.ts(KST 고정 오프셋·경계 접촉 비겹침), refund-policy.ts(상품별 티어·floor) — 경계값·시간대 문제 없음
- lib/booking/service.ts의 occupiedBookingSql(confirmed·15분 홀드·awaiting_deposit 기한 없음)과 createBookingOrder의 INSERT…SELECT WHERE NOT EXISTS 단일 문장 점유 가드, 방 순차 배정, expireStaleOrders의 awaiting 제외·타입별 TTL
- lib/booking/confirm.ts 멱등·경합 처리 전반(payments UNIQUE 선두, 소유 증명 없는 paid 재생 차단, sessionHoldGuard SQL 조건, ALREADY_PROCESSED 재조회 3중 대조, allowlist 낙인, send_pending CAS) — 토스 경로 한정으로 문제 없음
- lib/booking/confirmDeposit.ts 금액 검증·멱등·autoCancel — 토스 경로 동작 정상(복제 자체는 overflow에 적음)
- lib/booking/cancel.ts 선점·잔액 상한·remainder 선점 키=멱등키 일치·계좌 입금 고객 셀프 취소(계좌 검증·암호화·선점 뒤 저장·배치 실패 전면 롤백)·토스 미호출 가드 — 고객 경로는 문제 없음(관리자 경로 문구만 지적)
- lib/booking/bankDeposit.ts 상태 전이: awaiting→paid·awaiting→deposit_cancelled가 낙관적 단일 UPDATE + batch, deposit_cancelled 확정 거부, [입금 대기] 일정 rename 방식, 대기 일정 삭제 실패 표식 — 동시 클릭·경합에 안전
- lib/payments/bankDeposit.ts(순수 판정·2시간 차단·기한 계산)·bankAccount.ts·bankDepositOrders.ts(메일 escape·운영자 알림·결과 기록이 awaiting일 때만)·depositGuideThrottle.ts(주소 정규화 해시) — 문제 없음
- lib/payments/refundAccount.ts·refundAccountView.ts — 계좌번호만 암호화, 로그에 바인딩 값 미노출(safeDbErrorSummary), 접속기록, 복호화 오류 코드별 안내
- lib/payments/recordFailure.ts·windowOpen.ts·pages/api/payments/failed.ts·opened.ts — Origin 검사·IP 제한·상태 사전 읽기로 updated_at 미갱신·pending/failed/expired에만 기록
- lib/payments/methodAlert.ts·knownMethods.ts — 결제를 막지 않음·하루 1통·3초 예산·응답 본문 미싣기
- lib/payments/paymentChoices.ts·paymentPickerFlag.ts·components/payments/usePaymentCheckout.ts·PaymentMethodPicker.tsx·PaymentMethodChoice.tsx·BankDepositGuide.tsx·RefundAccountFields.tsx — 서버 금액으로 결제창 열기, tosskey=api 표식, 한국어 easyPay, 애플페이 환경 판정, 계좌번호 줄바꿈 금지
- components/booking/BookingWizard.tsx·MixingOrderWizard.tsx·PaymentLinkCheckout.tsx 제출 흐름 — 금액은 서버 응답값, 약관 사전 검사, USER_CANCEL 우선 분기, previousOrderNo 소유 증명, 계좌 입금은 bankBlocked 때 toss로 되돌림
- pages/api/bookings/index.ts·orders/mixing.ts·payment-links/order.ts 금액 신뢰 지점 없음(서버 SSOT), 결제수단 값 검증, 2시간 차단 서버 재판정, 캘린더 가드 fail-closed 503
- pages/api/bookings/cancel.ts·pages/[locale]/booking/manage/[orderNo].tsx — 토큰 상수시간 비교·주문 부재/불일치 404 일원화·awaiting이면 환불 아닌 신청 취소 분기·no-store
- pages/[locale]/booking/success.tsx·fail.tsx·pay/success.tsx·fail.tsx — code 표만 사용·orderNo 형태 검증·채널 전달·noreferrer 이탈 링크
- pages/api/admin/bookings/[id].ts PATCH/POST 낙관적 전이(completed·no_show·start_work·deliver), 계좌 입금 액션 사전 상태 검사, 환불 코드별 HTTP 매핑
- pages/api/admin/orders/export.ts·[id]/refund-account.ts — 관리자 인증·접속기록·no-store
- pages/api/cron/purge-orders.ts·lib/privacy/orderRetention.ts(L1-260) — 파기 단위 분리·멱등 표식·updated_at 미갱신·실패 알림
- lib/booking/gcal.ts(rename·delete 후보 캘린더 폴백·410 멱등)·calendarGuard.ts(R02-녹음실 상호 점유)·admin-serialize.ts(latestPaymentOf·refundableAmount 전 payments 합산·canAdminRefund 화면/API 공용)
- lib/booking/hub.ts·products.ts·mixing-products.ts — 가격·시간·곡 수가 전부 정본에서 오고 hub.test가 링크를 고정

**읽지 못한 범위**
- 실제 토스 샌드박스·운영 호출을 하지 않았다: 멱등키 실패 응답 재사용 여부, 웹훅 재전송 간격·송신 IP 목록, Pages Router SSR의 maxDuration 적용 방식(vercel.json functions 글롭)은 문서·코드 추정이며 미검증
- 운영 Vercel 계정의 함수 기본 실행 시간(Fluid 여부)과 Turso 실제 지연·플랜 한도는 확인하지 못했다
- components/payments/PaymentMethodPicker.tsx, components/booking/BookingEntryButton.tsx·PriceBreakdown.tsx, pages/[locale]/booking/index.tsx 본문, lib/booking/hub.ts 후반은 시각·접근성 관점으로 읽지 않았다
- BookingWizard.tsx(782줄)·MixingOrderWizard.tsx(561줄)는 결제 제출·약관·홀드 증명 로직만 읽고 단계별 UI·슬롯 선택 JSX는 읽지 않았다
- lib/privacy/orderRetention.ts는 purgeExpiredOrderCustomerData 이후 함수들과 lib/email/*, lib/shows·lib/funding·lib/billing의 확정/환불 모듈은 범위 밖이라 호출부 가드(isBankDepositPayment)만 확인했다
- *.test.ts 본문은 개별 케이스까지 읽지 않았다(통과 여부와 일부 케이스 존재 여부만 확인)
- docs/code-review-2026-08-24*.md에는 결제·예약 관련 항목이 없어 '이전 리뷰 미처리'로 올릴 건이 없었다
- 이번 라운드는 jest를 재실행하지 않았다(1라운드가 37 스위트 통과를 확인) — 테스트는 이름·본문 일부만 읽어 (f) 관점을 적용했고, confirm.test.ts·webhook.integration.test.ts·cancel.test.ts의 개별 단언은 전부 읽지 않았다
- lib/privacy/orderRetention.ts L260 이후(결제 응답 원본·환불 사유·요청사항 파기 함수)와 pages/api/cron/purge-orders.ts가 부르는 나머지 함수 본문은 읽지 않았다
- pages/admin/bookings/[id].tsx·index.tsx는 환불 폼·센티널 표시 부분만 발췌해 읽었다(화면 전체 상태 분기·접근성은 미검토)
- Vercel 운영 플랜의 함수 기본 실행 시간(Fluid 여부)과 Pages Router getServerSideProps에 vercel.json functions 글롭이 적용되는지는 1라운드와 같이 확인하지 못했다 — 2번 지적의 '중간 사망' 빈도 추정은 그 전제에 달려 있다
- 토스 API 실제 호출은 하지 않았다 — 위젯 시크릿으로 API 개별 키 결제의 /payments/confirm을 부를 때 돌아오는 코드가 KEY_MISMATCH_CODES 안에 있는지(없으면 재시도가 일어나지 않는다)는 문서·코드 추정이다
- lib/shows·lib/funding·lib/billing의 확정/환불 모듈은 범위 밖이라 webhook.ts의 분기 대상으로만 보았고 본문은 읽지 않았다
- docs/code-review-2026-08-24*.md·2026-09-08 문서는 grep으로 결제·예약 항목이 없음을 다시 확인했다(이전 리뷰 미처리로 올릴 건 없음)
- lib/booking/email.ts의 HTML 레이아웃 렌더 결과(scripts/preview-emails.ts)는 눈으로 보지 않았다 — 문구 지적은 text/HTML 소스 기준이다

**미검증 후보(overflow)**
- [P3] lib/booking/confirmDeposit.ts L55-97·L137-285와 lib/booking/confirm.ts L151-224·L378-716의 autoCancelStaleApproval·ALREADY_PROCESSED 재조회·DECLINE 낙인·batch 멱등 판정이 거의 그대로 복제돼 있다(1라운드 #19는 정규식만 지적) — 공통 `approveWithToss(order, input, options)` 헬퍼로 승인 단계를 뽑고 두 모듈은 batch 내용만 넘기게 하면 다음 키 쌍·거절 코드 변경이 한 곳에서 끝난다
- [P3] lib/booking/bankDeposit.ts L39-42 kstHourLabel이 lib/booking/email.ts L46-49 kstTimeLabel과 같은 함수의 복제다 — lib/booking/format.ts formatKstDateTime으로 통일
- [P3] pages/api/bookings/index.ts L67-69 계좌 입금 생성 응답 전에 고객 메일·운영자 메일·캘린더 생성을 직렬로 await한다(최대 12s+12s+8s) — 응답 뒤 처리로 미루거나 Promise.all로 묶으면 리다이렉트가 빨라진다(maxDuration 없는 라우트)
- [P3] components/booking/BookingWizard.tsx L36·L261 — 계좌 입금 신청으로 떠날 때 sessionStorage의 HOLD_PROOF_KEY(직전 토스 주문번호)를 지우지 않는다. 무해하지만 다음 세션 예약 제출에 옛 주문번호가 따라간다 — clearStoredDraft 옆에서 removeItem
- [P3] lib/booking/toss.ts L87 `await res.json()`이 비JSON 응답(게이트웨이 502 HTML)에서 던져 NETWORK_ERROR로 떨어진다 — 의도된 보수적 처리지만 로그에 status 코드가 남지 않아 토스 장애와 우리 네트워크 장애를 구분할 수 없다. catch에서 res.status를 함께 남길 것
- [P3] pages/api/admin/bookings/[id].ts L169 resend-notification의 `order.payments[0]`은 admin-serialize의 latestPaymentOf와 다른 행을 고를 수 있다(payments 2건 이상인 주문) — latestPaymentOf를 export해 같이 쓴다
- [P3] components/booking/TossPaymentWidget.tsx는 PaymentLinkCheckout이 usePaymentCheckout으로 바뀐 뒤 어떤 화면에서도 import되지 않는다(사용처 0, 테스트만) — sharedCheckout.guard가 금지하는 '카드 전용 위젯'이라 지우는 편이 가드의 의도에 맞다

### SHW. 공연 예매 (shows)
P0 1 · P1 7 · P2 10 · P3 27, 미검증 0 (총 45건. 1라운드 27건 + 2라운드 18건. 2라운드가 1라운드 항목을 "1라운드 #n"으로 부르는 자리는 이 절의 번호로 바꿔 적었다 — #1→SHW-1, #2→SHW-2, #4→SHW-9, #5→SHW-10, #6→SHW-11, #8→SHW-19, #23→SHW-30.)

#### SHW-1. 주문번호만으로 남의 주문 관리 토큰이 발급된다 (success 페이지 인증 우회) [P0 · S]

① `lib/shows/confirm.ts:92-96`(재생 분기), `:109-111`(금액 검사 — 재생 분기 뒤라 도달 안 함) · `pages/[locale]/shows/success.tsx:162-169`(입력 검사), `:171-178`(confirm 호출·already_confirmed 통과), `:198-205`(manageUrl props) · 토큰을 받는 쪽: `lib/shows/queries.ts:211`(getShowOrderForManage, isTokenMatch), `pages/api/shows/refund.ts:64`.

② 지금 코드:
```ts
// confirm.ts:94-96
if (CONCLUDED_STATUSES.includes(order.status)) {
  return { status: 'already_confirmed' };
}
// success.tsx:205 — already_confirmed를 그대로 통과시킨 뒤
manageUrl: `/${locale}/shows/manage/${orderId}?token=${order.manageToken}`,
```
주문이 paid·partially_refunded·refunded면 paymentKey·amount를 보기 **전에** already_confirmed를 돌려주고(payments 표는 조회조차 안 한다), success 페이지는 그 결과를 받아 `order.manageToken`이 든 manageUrl을 props(HTML)에 싣는다.

③ 왜 문제인가: 이 토큰이 내 티켓 화면(구매자 이름·전 티켓 QR)과 고객 환불 API가 받는 **유일한 인증**이다. booking·funding·deposit은 PR #56(f490899f75, "주문번호만으로 manage 토큰이 발급되던 인증 우회")에서 `provesOwnership`(`lib/booking/confirm.ts:429-436`: `input.amount === order.totalAmount && payments.some(p => p.paymentKey === input.paymentKey)`, `lib/funding/confirm.ts:177-179`)로 같은 구멍을 막았는데, shows confirm.ts는 그 뒤 #408(0d9b9c047e)에서 새로 만들어지며 가드 없이 이식됐다 — `git log -S'provesOwnership' -- lib/shows/confirm.ts`에 커밋이 없다. 다른 층도 없다: success 페이지는 getServerSideProps라 rate limit이 없고, `tests/pages/shows/success.test.ts`는 channel 전달만 보며, `confirm.integration.test.ts:63-65`의 재생 테스트는 같은 pk1을 넘겨 소유 증명 없는 경우를 다루지 않는다. 주문번호(TKT-YYYYMMDD-XXXXXXXX)는 토스 영수증·확인 메일·fail 화면·운영자 문의 대화에 평문으로 나온다.

④ 재현(검증자 실행, 스크래치 테스트 PASS):
전제: 토스로 확정된 공연 주문(orders.status = 'paid', type='ticket') 하나. 공격자는 주문번호만 안다.
1. GET `/ko/shows/success?paymentKey=x&orderId=TKT-…&amount=1` — success.tsx:162-169 입력 검사는 paymentKey 길이 1~200, orderId 패턴(`/^TKT-\d{8}-[0-9A-F]{8}$/`), amount 정수만 본다 → 통과.
2. 171행 `confirmShowOrder({orderNo, paymentKey:'x', amount:1}, {trustedByWebhook:false})` → confirm.ts:90 주문 조회 → 94행 CONCLUDED_STATUSES에 걸려 paymentKey·amount를 한 번도 보지 않고 95행 already_confirmed 반환.
3. success.tsx:177 already_confirmed 통과, 184행 paid이므로 통과, 205행 `manageUrl: /ko/shows/manage/<orderNo>?token=${order.manageToken}`을 props에 실어 HTML로 응답(196행 메일 재발송 시도는 부수효과).
4. 그 token으로 `/ko/shows/manage/<orderNo>` → queries.ts:211 isTokenMatch만 검사 → 구매자 이름·티켓 QR 전부 열람. `POST /api/shows/refund`(refund.ts:64 같은 토큰 검사) → 타인 티켓 환불.
결과: (1) 입장권 가로채기 (2) 타인 티켓 취소로 취소환불표 수수료 물리기 (3) 계좌 입금으로 결제된 주문이면 자기 환불 계좌(refundAccount)를 넣어 운영자 송금 유도. 로그인 불필요.
재현 테스트: `/private/tmp/claude-501/-Users-hwang-gyeongha-studio/a4120291-f6c1-4b58-874e-f846618cd625/scratchpad/review/repro/showsConfirmBypass.test.ts` — pk1/10000으로 확정한 주문에 paymentKey 'x', amount 1로 confirmShowOrder 호출 → already_confirmed. (`--roots`에 스크래치 경로를 더해 실행.)

⑤ **수정**:
- `lib/shows/confirm.ts`: findFirst에 `with: { payments: true }`를 더하고(관리자 라우트가 이미 같은 관계로 조회하므로 마이그레이션·배포 순서 문제 없음), 재생 분기를 booking과 같게 바꾼다.
  ```ts
  if (CONCLUDED_STATUSES.includes(order.status)) {
    if (opts.trustedByWebhook) return { status: 'already_confirmed' };
    const proves = input.amount === order.totalAmount
      && order.payments.some((p) => p.paymentKey === input.paymentKey);
    return proves ? { status: 'already_confirmed' } : { status: 'error', code: 'invalid_status' };
  }
  ```
  (`lib/booking/confirm.ts:429-436` 이식.) 웹훅 경로는 fetchPayment로 재검증하고 오므로 그대로 둔다. invalid_status 문구는 `failMessages.ts:43·79`에 이미 있다.
- `pages/[locale]/shows/success.tsx`: 소유 증명이 통과한 결과에서만 manageUrl을 만들고, 실패 문구는 invalid_status 계열로 보낸다.
- 회귀 테스트: `confirm.integration.test.ts`에 '확정된 주문 + 틀린 paymentKey → already_confirmed 아님', `tests/pages/shows/success.test.ts`에 '틀린 paymentKey로는 props에 manageUrl/token이 없다'(`lib/booking/confirm.test.ts:147` 대응).
- 부작용 없음: 계좌 입금으로 paid된 주문은 payments 키가 `bank-deposit:`이라 소유 증명에 걸리지만 그 고객은 success 페이지를 거치지 않는다(orders API 응답·메일로 manageUrl을 받는다).

⑥ 비고: 검증자 confirmed, P0 적정. 같은 뿌리를 SHW-5(테스트 공백 축)와 SHW-41(로케일 덮어쓰기)이 다시 가리킨다 — 이 항목을 고치면 둘 다 뿌리가 막힌다.

#### SHW-2. 티켓 5장 이상 일괄 환불이 토스 cancelReason 200자·Idempotency-Key 300자 한도를 넘어 거절된다(관리자 '환불' 버튼 포함) [P1 · M]

① `lib/shows/refund.ts:75-76`(멱등 키 생성), `:246-250`(cancelReason) · `lib/booking/toss.ts:234`(자르지 않고 전송), `:79-81`(Idempotency-Key 300자 주석) · `lib/shows/service.ts:120`(티켓 id = `lower(hex(randomblob(16)))` 32자) · 화면: `components/shows/ShowTicketManage.tsx:157-180`(다중 선택), `pages/admin/shows/[id].tsx:471`(관리자 '환불'은 refundable 전부 일괄).

② 지금 코드:
```ts
// refund.ts:75-76
const ticketRefundIdempotencyKey = (orderNo: string, ticketIds: string[]): string =>
  `tkt-refund:${orderNo}:${[...ticketIds].sort().join(',')}`;
// refund.ts:246-250
const idempotencyKey = ticketRefundIdempotencyKey(input.orderNo, input.ticketIds);
const cancelResult = await toss.cancelPayment({
  paymentKey: payment.paymentKey,
  cancelReason: `[#${idempotencyKey}] 공연 티켓 환불`,
```
멱등 키와 cancelReason 태그에 32자 티켓 id 전부를 싣는다.

③ 왜 문제인가: 검증자 node 실측 — cancelReason은 n=4 176자, n=5 209자, n=10 374자. 토스 공식 레퍼런스(docs.tosspayments.com/reference)가 cancelReason '최대 길이는 200자'를 명시한다(WebFetch 확인). Idempotency-Key 헤더도 300자 한도인데 키 자체가 n=9 329자, n=10 362자라 두 한도가 다 걸린다. 거절은 NETWORK_ERROR가 아니므로 `refund.ts:266-287`의 revertClaim + failed 행 + toss_failed로 끝난다. 테스트는 id가 짧고 1장씩이라(`refund.integration.test.ts:45-268`) 못 잡는다.

④ 조건·결과: 한 주문에서 5장 이상을 한 번에 환불하면(고객 다중 선택이든 관리자 '환불' 버튼이든) 토스가 거절하고 고객·운영자 모두 toss_failed만 본다. 일행 예매(최대 10매, `limits.ts:10`)의 일괄 환불과 운영자의 주문 단위 환불이 전부 막힌다.

⑤ **수정**: 키와 태그에 각 id의 앞 8자(정렬)만 싣는다.
```ts
`tkt-refund:${orderNo}:${sortedIds.map((id) => id.slice(0, 8)).join(',')}`
```
n=10에서 키 122자·cancelReason 133자로 두 한도 안이다. `syncShowCancelsFromToss`(`refund.ts:393-407`)는 태그의 접두어 목록을 그 주문의 refunding 티켓과 `substr(id,1,8)` 일치로 복원한다(주문당 ≤10장이라 8자 접두어 충돌은 무시 수준; 한 접두어가 둘 이상에 맞으면 종전처럼 주문의 refunding 전부로 폴백). 부분집합 열거가 필요 없고 태그만 보고도 사람이 어떤 티켓인지 읽을 수 있다. 연쇄: sync 파싱(`:393-407`, `:433-447`)을 같은 커밋에서 바꿔야 한다 — 절단으로 때우면 `]`가 잘려 태그가 null이 되고 sync가 주문 전체 refunding을 쓸어 담는 광역 sweep으로 회귀한다(SHW-35). 회귀 테스트: 실제 길이 id(32자 hex) 10장으로 `cancelReason.length <= 200`·`idempotencyKey.length <= 300`, FakeToss.cancelPayment에 길이 검증 추가, 같은 주문의 두 환불이 동시에 refunding일 때 sync가 태그 범위만 확정하는 기존 테스트를 접두어 태그로 다시 통과시킨다.

⑥ 비고: adjusted — 원 지적은 cancelReason만 들었는데 검증자가 Idempotency-Key 300자 한도와 관리자 버튼까지 범위를 넓혔고, 원 수정안의 sha256 태그 + sync에서 부분집합 2^10 복원은 과하다고 보아 접두어 안으로 바꿨다. 같은 자리를 SHW-35(2라운드 연쇄 수정 지점)가 가리킨다.

#### SHW-3. toss_unknown 뒤 refunding 티켓을 되돌리거나 확정할 경로가 없다 — 재시도는 재취소가 아니라 fetchPayment 대사로 [P1 · M]

① `lib/shows/refund.ts:181-191`(선점, `status = 'issued'`만), `:117-119`(refunding 섞이면 not_issued 거절), `:256-264`(NETWORK_ERROR 분기), `:353`(syncShowCancelsFromToss) · `pages/api/shows/refund.ts:84-90`(202만, 운영자 알림 없음) · `pages/api/admin/shows/[id].ts:191-193`(504 '토스 콘솔에서 확인') · `lib/ops/healthCheck.ts`(refunding 점검 없음 — auto_cancel_pending 475행, issued 769행만) · `lib/booking/toss.ts:93`(NETWORK_ERROR = fetch 실패·12초 타임아웃) · `lib/shows/refundMessages.ts:11`.

② 지금 코드:
```ts
// refund.ts:256-264
if (cancelResult.code === 'NETWORK_ERROR') {
  // 응답을 못 받았다 — 취소가 됐을 수 있다. 선점(티켓 'refunding')을 유지하고 운영자 확인/웹훅 대사를 기다린다
  console.error('[shows-refund] 토스 응답 없음 — 선점 유지, 확인 필요', {...});
  return { status: 'toss_unknown' };
```

③ 왜 문제인가: 선점 유지 자체는 맞다. 그러나 토스가 실제로 취소하지 않았을 때 그 티켓을 issued로 되돌릴 코드·화면·점검이 없고, 고객 셀프 환불 경로는 운영자에게 알리지도 않는다. 웹훅 대사는 토스에 취소가 실제로 걸렸을 때만 오므로, 요청이 토스에 닿기 전에 끊긴 경우엔 영구히 refunding이고 좌석도 점유로 남는다 — 복구는 DB 직접 수정뿐이다.

④ 조건·결과: 고객 환불 요청 중 토스 타임아웃 한 번 → 티켓 refunding 고착 → 고객 화면은 '이미 환불되었거나 환불할 수 없는 상태'(refundMessages.ts:11), 관리자도 not_issued로 막힘, 좌석은 잡힌 채 환불 불가. 운영자는 로그를 보지 않으면 모른다.

⑤ **수정**(선점 조건은 `status = 'issued'` 그대로 둔다):
1. `reconcileShowRefund(orderNo)` 추가: 결제 행의 paymentKey로 fetchPayment → 응답을 기존 `syncShowCancelsFromToss(orderNo, payment)`에 그대로 넘겨 토스에 취소가 있으면 확정(태그 범위만), 토스 cancels 합이 우리 done 합과 같으면(=취소가 걸리지 않았음) 그 주문의 refunding 티켓을 issued로 되돌린다. 재취소를 부르지 않으므로 부분 겹침의 이중 환불이 없다.
2. 관리자 공연 상세: refunding 티켓이 있는 주문에 '환불 재확인' 버튼 → (1).
3. `pages/api/shows/refund.ts`의 toss_unknown 분기에서 운영자 알림 메일(audience operator, noticeTone alert, 주문·티켓·금액·관리자 딥링크).
4. healthCheck에 `show_tickets.status = 'refunding'` 존재 여부 항목 — 새 컬럼·기산점 없이 '있으면 고착'으로 본다(refunding은 한 요청 안에서 초 단위로 끝나는 상태라 매일 08:00 점검에 걸리는 refunding은 전부 고착).

⑥ 비고: adjusted — 원 수정안의 "선점 조건을 `IN ('issued','refunding')`으로 넓혀 재취소"는 위험하다: 요청 A{1,2}가 refunding인 사이 요청 B{2,3}가 2번을 다시 잡아 다른 멱등 키로 토스를 불러 2번 티켓이 두 번 환불된다(remainingRefundable은 선점 전 DB 기준이라 못 막는다). 재시도는 '다시 취소'가 아니라 '토스에 묻기'여야 한다. refunding_at 컬럼도 불필요. SHW-37(기록 batch 던짐)의 healthCheck 항목과 같은 점검 하나로 덮인다.

#### SHW-4. 회차 취소가 DB 오류 한 건으로 중단되면 남은 주문은 환불·안내 없이 남고, 일괄 재실행 경로가 없다 [P1 · M]

① `lib/shows/showtimeOps.ts:51-54`(회차 먼저 cancelled), `:82-175`(주문 직렬 루프), `:84·90·101`(DB 조회, try 없음), `:172-174`(토스 취소 뒤 batch, try 없음) · `pages/api/admin/shows/[id].ts:128`(409 가드), `:130-134`(affected), `:135`(cancelShowtime 호출, try 없음), `:136-153`(안내 메일 루프), `:176-195`(refund_tickets) · `lib/shows/refund.ts:47·120-123·183-200` · `lib/booking/webhook.ts:369` → `refund.ts:353-452` · `lib/booking/toss.ts:92-93` · `showtimeOps.integration.test.ts`(it 4건 전부 정상 경로).

② 지금 코드:
```ts
// showtimeOps.ts:172-174 (토스 취소 성공 뒤 — try/catch 없음)
await db.batch(settleStatements as [typeof settleStatements[number], ...typeof settleStatements]);
refundedOrders++;
// pages/api/admin/shows/[id].ts:128
if (showtime.status !== 'scheduled') return res.status(409).json({ ok: false, message: '예정된 회차만 취소할 수 있습니다.' });
```

③ 왜 문제인가: 루프 안 DB 호출 하나가 던지면 남은 주문은 처리되지 않고 핸들러도 감싸지 않아 500으로 끝난다. 안내 메일은 그 뒤라 한 통도 안 나간다. 다시 누르면 128행이 409로 막는다. 토스 호출 자체는 던지지 않는다(toss.ts:92 catch → failedOrders). 주문별 수습 경로는 있다 — refund_tickets는 회차가 cancelled면 100%를 적용하고 그 주석이 '회차 취소 때 토스 환불이 실패해 남은 주문'을 용도로 적으며, 관리자 화면은 주문마다 상태(ORDER_STATUS_LABEL :75-76·:391)와 '입장 전 티켓 환불' 버튼을 보여 준다. 실제 공백은 (a) 일괄 재실행이 없어 N건을 N번 눌러야 하고, (b) 그 경로는 sendShowRefundEmail(일반 환불 메일)을 보내지 회차 취소 안내(sendShowtimeCancelledEmail)가 아니며, (c) 토스 취소는 됐는데 batch가 던진 그 한 건은 refund_tickets로 못 푼다 — 새 멱등키로 토스를 다시 불러 거절당하고 revertClaim된다. 그 건은 웹훅 syncShowCancelsFromToss가 맞추거나, 같은 멱등키(remaining 불변 → refundIdempotencyKey 동일)로 재실행하면 토스가 성공 응답을 replay해 기록된다. 이 route엔 maxDuration이 없다(다른 8개 route는 60) — 주문당 Turso 왕복 3회+토스 1회+batch가 직렬이라 주문이 수십 건이면 기본 제한에 걸릴 수 있다(실제 기본 제한은 미확인).

④ 조건·결과: 회차 취소 중 N번째 주문에서 DB 오류 → 1..N-1만 환불, N 이후는 환불도 회차 취소 안내도 없음, 운영자는 500만 봄. 토스에서만 취소된 N번째는 웹훅이 올 때까지 장부와 어긋남.

⑤ **수정**:
1. 루프 본문을 주문 단위 try/catch로 감싸 던진 주문을 failedOrders에 넣고 계속 간다(console.error에 orderNo·단계). 토스 뒤 batch 실패는 UI의 기존 '토스 콘솔 확인' 알림(:301)이 이미 가리키고, 아래 resume이 같은 멱등키로 되살린다.
2. 핸들러에 `resume_showtime_cancel` 액션(또는 cancel_showtime을 `showtime.status === 'cancelled'`일 때 허용)을 두고 cancelShowtime을 다시 돌린다 — showtimes UPDATE는 WHERE status='scheduled'라 no-op, 환불 대상 조회는 paid/partially_refunded 기반, 멱등키는 (orderNo, remaining, 'showtime-cancel')이라 토스가 replay해 안전하다. 화면엔 회차가 cancelled이고 paid/partially_refunded 주문이 남았을 때만 '환불 이어서 처리' 버튼. 128행 409는 그 밖의 상태에 그대로(#442 초기부터 있던 것으로 운영자 결정이 아니라 바꿔도 된다).
3. 메일: (1)이 되면 핸들러의 기존 루프가 정상 판정으로 나간다. resume 때는 affected가 아직 paid인 주문만 잡으므로 cancelShowtime이 이번 실행에서 환불한 주문번호 목록(refundedOrderNos)을 돌려주게 하고, 핸들러가 affected ∪ refundedOrderNos에 보낸다. 첫 실행이 500으로 끝난 경우 그때 환불된 주문은 어차피 메일을 못 받았으므로, resume 핸들러는 `refunds.reason='공연 회차 취소 환불'`인 이 회차 주문에도 안내를 보낸다(중복 발송 가능성은 미발송보다 낫다). 핸들러의 cancelShowtime 호출도 try/catch로 감싸 revalidate·응답이 끝까지 가게 한다.
4. 저장소 관례대로 `export const config = { maxDuration: 60 }`를 먼저 넣고, 한 호출당 처리 건수를 제한해 나머지를 resume으로 잇는다. 동시성 3~5는 선택.
- 테스트: `showtimeOps.integration.test.ts`에 `getDb().batch`를 spyOn해 두 번째 주문에서 reject시키고 (a) 첫·셋째 주문 환불, 둘째가 failedOrders (b) 같은 인자로 재실행 시 둘째 주문이 FakeToss replay로 기록되고 refunds 행이 한 줄인지 확인.

⑥ 비고: adjusted — '이어서 처리할 길이 없다'는 과장(주문별 수습 경로 있음)으로 바로잡고, 던지는 원인을 batch로 한정하지 않았으며, resume 때 첫 실행 환불 주문의 안내 누락(3)을 보완했다. P1 유지(일부 고객만 환불·안내 전무·운영자는 500만), P0 아님(돈은 고객 쪽으로만 움직였고 웹훅으로 자가 치유). SHW-42(회차 취소 중복 실행)·SHW-7(취소 메일 금액)이 같은 함수의 반환값을 바꾸므로 한 커밋에서 같이 손보는 것이 싸다.

#### SHW-5. 공연 confirmShowOrder가 확정된 주문을 소유 증명 없이 already_confirmed로 돌려주어 success 페이지가 관리 토큰을 발급한다 (테스트도 없음) [P1 · M]

① `lib/shows/confirm.ts:93-96` · `lib/shows/confirm.integration.test.ts:56-66` · `tests/pages/shows/success.test.ts` · 대응 테스트: `lib/booking/confirm.test.ts:147-170` · 부수: `lib/shows/refund.integration.test.ts`(id 길이·1장씩), `lib/shows/showtimeOps.integration.test.ts`(changeShowtime은 previous_starts_at만), `lib/shows/service.integration.test.ts`(failed 주문 만료 케이스 없음), `lib/privacy/orderRetention.test.ts`(공연 케이스 없음).

② 지금 코드: `confirm.integration.test.ts:56` `it('이미 확인된 주문을 다시 확인하면 replay로 처리된다(중복 확정 없음)')`는 같은 paymentKey만 시험한다. booking의 `describe('확정된 주문의 관리 토큰은 소유 증명 없이 나오지 않는다')`(`lib/booking/confirm.test.ts:147`)에 해당하는 공연 테스트가 없다. `tests/pages/shows/success.test.ts`는 channel 배선만 본다.

③ 왜 문제인가: 테스트 공백이 아니라 실제로 열려 있는 인증 우회를 테스트가 가리고 있다. CONCLUDED_STATUSES 분기가 paymentKey·amount를 보지 않아 유효한 주문번호만 알면 success 페이지가 `/shows/manage/<주문번호>?token=<manageToken>` 링크를 HTML에 싣는다(SHW-1과 같은 뿌리). booking·funding은 PR #56(f490899f75)에서 고쳤고 테스트(`lib/booking/confirm.test.ts:147-170`)를 갖고 있으나 shows 이식본에는 가드도 테스트도 없다. 부수 공백: (2) 5장 이상 환불의 cancelReason 길이는 FakeToss가 길이를 검증하지 않아 통과한다(SHW-2). (3) 스캔 링크 연장 테스트 없음(SHW-38). (4) cancelShowtime 중간 실패 테스트 없음(SHW-4). (6) awaiting_deposit이 만료 크론에 안 건드려지는 것은 `bankDeposit.integration.test.ts:95-100`이 이미 시험하지만 failed 주문 케이스는 없다(SHW-24). (7) show_orders PII 파기는 orderRetention.test.ts에 공연 케이스 없음(SHW-9).

④ 조건·결과: SHW-1 재현 그대로. 관리 토큰 탈취로 내 티켓(구매자 이름, QR) 열람과 환불 실행이 가능하고, 계좌 입금 확정 주문은 환불 계좌를 요청자가 적어 송금 오지급 위험이 있다.

⑤ **수정**: booking과 같은 소유 증명을 넣는다(코드는 SHW-1 ⑤). `confirmShowOrder`에서 `!opts.trustedByWebhook`이고 order.status가 CONCLUDED이면 `order.payments`(또는 `db.query.payments`)에 `payment_key = input.paymentKey`가 있고 `input.amount === order.totalAmount`일 때만 already_confirmed, 아니면 `{status:'error', code:'invalid_status'}`(토큰 없음). 웹훅(trustedByWebhook)은 재조회로 검증됐으므로 그대로 통과. success.tsx는 manageUrl을 이 증명을 통과한 결과에서만 만든다. 테스트: `confirm.integration.test.ts`에 '확정된 주문 + 틀린 paymentKey/amount 1원 → already_confirmed 아님', `tests/pages/shows/success.test.ts`에 '그 경우 props에 manageUrl/토큰이 없다'. 그다음 순서대로: 5장+ 환불 시 cancelReason·멱등키 길이 가드와 테스트(SHW-2), showtimeOps·만료 크론 테스트 보강(SHW-4·SHW-38·SHW-24).

⑥ 비고: adjusted — 검증자는 '단순 테스트 누락'이 아니라 열려 있는 우회라고 바로잡았다. 주문번호가 32비트 난수라 무작위 추측은 비현실적이라는 이유로 이 축에서는 P1로 두었으나, 주문번호가 영수증·메일·fail URL에 평문인 점은 SHW-1의 P0 판정과 같다 — 수정은 SHW-1 하나로 둘 다 닫힌다. '짧은 id 헬퍼'라는 원 서술은 틀렸다(refund.integration.test.ts는 createShowOrder로 32자 id를 만든다).

#### SHW-6. 매진 경합 뒤 자동 취소가 pending_retry로 끝나면 재시도 경로가 없고, 뒤이은 DONE 웹훅은 catch 분기에서 auto_cancel_conflict로 오분류돼 200으로 끝난다 — 고객 화면은 '자동으로 취소/환불됩니다'라고 말한다 [P1 · M]

① `lib/shows/confirm.ts:246-299`(payments UNIQUE 충돌 catch 분기, 284-289 auto_cancel_conflict), `:309-335`(sold_out 분기, 326 autoCancelShowApproval 한 번), `:499-502`(cancelPayment 실패 → revertClaim → pending_retry) · `lib/booking/webhook.ts:300-312`(DONE 웹훅 → confirmShowOrder, 끝에 `return { status: 200 }`) · `lib/ops/healthCheck.ts:466-490`(stuckShowCancel은 auto_cancel_pending만), `:694-711`(paymentMismatch, high, 하루 1회) · `lib/shows/failMessages.ts:35`(sold_out), `:40`(toss_unresolved), auto_cancel_conflict 문구 · `lib/shows/race.integration.test.ts`(pending_retry·injectFault 사례 없음).

② 지금 코드:
```ts
// confirm.ts:326-335
const reconciled = await autoCancelShowApproval(order.orderNo, toss, approved.paymentKey);
if (reconciled.status !== 'cancelled') {
  console.error('[shows-confirm] 확정 게이트 실패 후 자동 대사 미완료 — 수동 확인 필요(healthCheck 대상)', { … reconcileOutcome: reconciled.status });
}
return { status: 'sold_out' };
// catch 분기(284-289):
if (current && current.status !== 'paid' && current.status !== 'partially_refunded') {
  return { status: 'auto_cancel_conflict' };
}
```

③ 왜 문제인가: orders 전이 0행 뒤 `autoCancelShowApproval`이 pending_retry(토스 취소 NETWORK_ERROR·재조회 실패)로 끝나면 revertClaim으로 주문은 pending으로 돌아가고 payments 행만 남는다(앞선 batch는 성공했으므로 커밋돼 있다). 이후 DONE 웹훅(또는 success 페이지)의 confirmShowOrder는 실제 토스에서 ALREADY_PROCESSED_PAYMENT → 재조회 DONE → batch에서 payments UNIQUE 충돌 → catch 분기에서 current.status=pending이라 auto_cancel_conflict를 돌려주고, 웹훅은 transient가 아니라 200으로 끝나며 eventKey `pk:DONE`이 남아 토스 재전송도 '중복'으로 200이다. autoCancelShowApproval을 다시 부르는 코드는 confirm.ts뿐이고(크론 없음, expire-show-orders는 pending 만료만), healthCheck의 stuckShowCancel은 revert된 pending을 못 본다 — paymentMismatch(pending+payments 존재)만 하루 한 번 잡는다. 고객 문구는 sold_out '결제는 자동으로 취소됩니다', auto_cancel_conflict '자동으로 환불 처리되었습니다', toss_unresolved '확정되지 않으면 자동으로 취소됩니다' 셋 다 사실과 다를 수 있다. 웹훅이 먼저 와 sold_out 경로를 타고 success 페이지가 나중에 catch 분기를 타는 순서든 그 반대든, 두 순서 모두 재시도 없이 끝난다.

④ 조건·결과: 마지막 좌석 경합(또는 승인 왕복 중 회차 취소·만료 처리)에서 진 고객 × 토스 취소 일시 실패 → 결제는 캡처된 채 티켓도 환불도 없음. 자동 복구 없음, 다음 날 헬스체크 'high' 항목으로 운영자가 토스 콘솔에서 수동 취소. 그 사이 고객은 '자동 취소/환불됐다'는 화면을 본 상태다.

⑤ **수정**:
1. catch 분기(`confirm.ts:246-299`): existing 행이 있고 `current.status ∈ {pending, expired, failed}`이면 `autoCancelShowApproval(order.orderNo, toss, approved.paymentKey)`를 부르고 결과를 매핑한다 — `cancelled` → auto_cancel_conflict / `pending_retry` → `{ status:'error', code: TOSS_UNRESOLVED_CODE }`(웹훅 500·eventKey 회수·재시도) / `not_eligible` → 주문 상태를 다시 읽어 refunded면 auto_cancel_conflict, 그 외(다른 실행이 auto_cancel_pending으로 붙잡은 중)면 TOSS_UNRESOLVED_CODE / `ledger_write_failed` → auto_cancel_conflict(돈은 돌아갔고 주문은 auto_cancel_pending으로 남아 healthCheck stuckShowCancel이 1시간 뒤 잡는다). current.status가 refunded면 지금처럼 auto_cancel_conflict, auto_cancel_pending이면 TOSS_UNRESOLVED_CODE. 호출부에서 done 환불 유무를 따로 검사할 필요는 없다(함수가 remainingRefundable로 잔액 0이면 not_eligible).
2. sold_out 분기(`:309-335`): `reconciled.status === 'pending_retry'`면 `{ status:'error', code: TOSS_UNRESOLVED_CODE }`로 돌려 웹훅 재시도를 유도한다(1과 짝이어야 재시도가 실제로 취소를 다시 시도한다).
3. `failMessages.ts`(ko·en): sold_out·toss_unresolved 문구의 '자동으로 취소됩니다'를 '취소가 확인되지 않으면 운영자가 확인해 돌려드립니다'로 — auto_cancel_conflict는 refunded 확인 뒤에만 돌려주게 되므로 그대로 둔다.
4. healthCheck paymentMismatch에 `type='ticket'` 건은 '승인 캡처 뒤 자동 취소 실패 가능' 안내와 `/admin/shows` 링크를 붙인다. 토스 웹훅 재전송 횟수에는 한도가 있으므로 4는 1·2와 별개로 유지해야 할 최종 안전망이다.
5. `race.integration.test.ts`에 cancelPayment NETWORK_ERROR를 주입한 뒤 두 번째 confirm(trustedByWebhook)이 error/toss_unresolved를 거쳐 결국 refunded로 수렴하는 사례.

⑥ 비고: adjusted — 검증자가 catch 분기의 결과 매핑에 not_eligible·ledger_write_failed를 더하고, 호출부의 done 환불 선검사를 뺐으며, toss_unresolved 문구(failMessages.ts:40)도 같이 고쳐야 한다고 보탰다. P1 적절(돈이 잡힌 채 자동 복구 없음; 일일 헬스체크로 수동 복구 가능하고 발생 조건이 곱이라 P0는 아님). SHW-15(ledger_write_failed 뒤 웹훅 대사)·SHW-16(자동 취소 무통지)과 같은 함수 주변이다.

#### SHW-7. 회차 취소 메일이 실제 환불액과 무관하게 '결제하신 N원은 전액 환불 처리되었습니다'라고 보낸다 — 체크인 티켓이 있어 부분 환불된 주문, 전부 입장해 0원 환불된 주문에도 같은 문구 [P1 · M]

① `pages/api/admin/shows/[id].ts:128-146`(affected 수집·refundCompleted 판정·메일 루프) · `lib/shows/showtimeOps.ts:98-110`(checkedInValue 차감·0이면 continue), `:147`(finalOrderStatus), `:36-50`(반환 타입에 주문별 금액 없음) · `lib/shows/emailHtml.ts:108-109` · `lib/shows/emailEn.ts:178-179` · `lib/shows/email.test.ts:50` · `lib/shows/showtimeOps.integration.test.ts:78-126`(의도된 동작 고정).

② 지금 코드:
```ts
// pages/api/admin/shows/[id].ts:136-145
for (const { orderNo } of affected) {
  await sendShowtimeCancelledEmail(orderNo, {
    refundCompleted: !r.failedOrders.includes(orderNo) && !r.bankRefundOrders.includes(orderNo),
    …
// lib/shows/showtimeOps.ts:109-110
const remaining = Math.max(0, remainingRefundable(order, payments) - checkedInValue);
if (remaining <= 0) continue;
// lib/shows/emailHtml.ts:108-109
return d.refundCompleted
  ? `결제하신 ${formatPriceAmount(d.totalAmount)}원은 전액 환불 처리되었습니다. …`
```

③ 왜 문제인가: `cancelShowtime`은 체크인된 티켓 몫을 빼고 잔액만 돌려주며(`finalOrderStatus = checkedInValue > 0 ? 'partially_refunded' : 'refunded'`), 잔액 0이면 continue로 건너뛴다 — 이 주문은 failedOrders에도 bankRefundOrders에도 없고 orders 상태도 paid 그대로다. 호출부는 그 두 목록에 없으면 전부 `refundCompleted: true`로 보내고, 메일 본문은 `order.totalAmount` 전액을 환불했다고 쓴다. 실제 환불액(remaining)은 반환값에 실리지도 않는다. 영어 메일(`emailEn.ts:178-179` 'The full … has been refunded')도 같다. cancel_showtime 게이트는 `showtime.status==='scheduled'`뿐이라(API 127행) 시작 후에도 취소할 수 있고, `checkin.ts:23·35`는 scheduled 회차면 받으므로 입장 시작 뒤 취소가 막히지 않는다. email.test.ts:50은 refundCompleted=true면 '전액 환불 처리' 문구를 단언할 뿐 부분·0원 사례가 없다.

④ 조건·결과: 공연 중 사고로 회차를 취소하는 현실적 상황(입장이 시작된 뒤)에서 입장한 관객에게 '20,000원 전액 환불'이라는 거짓 안내가 나간다. 1장 입장·1장 미입장 주문은 10,000원만 돌아갔는데 20,000원 환불을 약속한 메일이 증거로 남아 분쟁 소재가 된다.

⑤ **수정**: `cancelShowtime`의 반환에 주문별 결과를 싣는다: `perOrder: Record<string, { refunded: number; skipped: 'checked_in_only' | 'already_refunded' | null; final: 'refunded' | 'partially_refunded' | 'unchanged' }>`. 호출부는 `refunded === 0`이면 메일을 보내지 않거나 '입장하신 티켓은 환불 대상이 아닙니다'로, 부분이면 `refundedAmount`를 넘겨 emailHtml `showtimeCancelledRefundSentence`가 `결제하신 ${total}원 중 ${refunded}원을 환불했습니다(입장하신 티켓 제외)`로 쓰게 한다. `buildShowtimeCancelledEmail` 입력에 `refundedAmount`를 추가하고 emailEn.ts의 같은 문장도 함께 고친다. email.test.ts에 부분·0원 사례를 더한다. 전부 입장한 주문에 어떤 말을 할지(안내 문구 또는 메일 생략)는 환불 정책 선언이므로 운영자가 정한다 — 공연 중 중단이라면 소비자분쟁해결기준상 별도 보상 논의가 생길 수 있어 코드가 단정 문구를 넣지 않는 편이 안전하다.

⑥ 비고: confirmed. 환불 로직('체크인 티켓은 건드리지 않는다', lib/shows/CLAUDE.md)은 그대로 두고 메일 문구·반환값만 고친다. SHW-4의 반환값 변경(refundedOrderNos)과 SHW-42(alreadyCancelled)와 같은 함수 서명을 건드리므로 한 커밋이 싸다.

#### SHW-8. 취소환불표 계산은 '공연 시작 시각 기준 24시간 단위'인데 고객이 동의한 표·FAQ·메일은 '공연 N일 전'·'공연 당일(시작 전)' 달력 표현이다 — 전날 저녁 취소가 '당일' 요율 10%로 계산되고, 어긋남은 항상 고객에게 불리한 방향이다 [P1 · S]

① `lib/shows/refundPolicy.ts:20-28`(계산), `:41-50`(refundTierLines 표 문구), `:8-14`(TIERS) · `lib/shows/faq.ts:35` · `lib/shows/email.ts:43-54`(buildRefundPolicyLines) · `components/shows/RefundPolicyList.tsx`(i18n refundLines) · `lib/shows/time.ts`(salesCloseAt — KST 자정 기준) · `lib/shows/refundPolicy.test.ts`(정확히 24h 경계만) · 호출부 `lib/shows/refund.ts:123`, `lib/shows/queries.ts:228`(refundPctNow) · 출처: `docs/superpowers/plans/2026-09-30-shows-phase1-core.md:546-556`.

② 지금 코드:
```ts
export function refundRateForNotice(showtimeStartsAt: Date, noticeAt: Date): number {
  const diffMs = showtimeStartsAt.getTime() - noticeAt.getTime();
  if (diffMs <= 0) return 0;
  const daysBefore = Math.floor(diffMs / DAY_MS);
  for (const tier of TIERS) { if (daysBefore >= tier.minDaysBefore) return tier.pct; }
// 44행
else if (tier.minDaysBefore === 0) when = '공연 당일(시작 전)';
```

③ 왜 문제인가: 토요일 18:30 공연을 금요일 20:00에 취소하면 22.5시간 → daysBefore 0 → 10%. 그러나 고객이 보는 표는 '공연 1~2일 전 — 70%', '공연 당일(시작 전) — 10%'이고, 같은 모듈의 판매마감(salesCloseAt)은 KST 자정 기준이다. 자정 경과 횟수가 c이면 diff < (c+1)·24h이므로 floor(diff/24h) ≤ 달력 일수 차가 항상 성립한다 — 코드는 표보다 적게 주거나 같을 뿐 더 주는 경우는 없다. 플랜 문서가 24h 공식과 달력 문구를 함께 적은 채 들어왔고 운영자 결정 기록은 없다. TIERS(10/7/3/1/당일 = 100/90/80/70/10)는 소비자분쟁해결기준 공연업 구간과 같고 그 기준은 '공연일 N일 전' 달력 표현이므로, 고객이 결제하기로 동의한 표(refundPolicyAgreed)가 이미 달력 기준을 약속한 셈이다. refundPolicy.test.ts의 '1일 전' 사례는 정확히 24h 전이라 23h 경계를 못 잡는다. 내 티켓 화면은 refundPctNow로 신청 시점 실제 요율을 보여 주므로 고객이 누르기 전에 10%를 보긴 하지만, 동의한 표와의 모순은 그대로다.

④ 조건·결과: 고객이 동의한 표를 보고 70%(25,000원 티켓이면 17,500원)를 기대했는데 10%(2,500원)만 돌아간다. 분쟁 시 우리가 보여 준 표가 그대로 불리하게 작용한다. 어긋남이 한 방향(과소 환불)이라 고객이 손해 보는 쪽으로만 난다.

⑤ **수정**: 달력(KST) 기준으로 계산을 표에 맞춘다(기본값).
```ts
const kstDay = (d: Date) => Math.floor((d.getTime() + 9 * 3600 * 1000) / DAY_MS);
if (diffMs <= 0) return 0;
const daysBefore = kstDay(showtimeStartsAt) - kstDay(noticeAt);
```
시작 이후 0은 그대로. 운영자에게는 '표가 약속한 대로 계산을 맞췄고, 기존 24h 방식은 고객에게만 불리했다'고 알린다(24h 단위를 고집하려면 ko·en 표·FAQ·메일을 전부 '공연 시작 N시간 전'으로 바꿔야 하고 기준과도 멀어진다). 함께 고칠 것: ① `email.ts:43-54` buildRefundPolicyLines는 (d+0.5)일 전 시각을 넣어 표를 만드는 방식이라 달력 기준에서 at(0)=전날 21:00 KST가 '1일 전'으로 잡혀 70%가 찍힌다 — 함수를 없애고 `refundTierLines()`(FAQ·화면이 쓰는 정본)로 교체(SHW-14와 같은 수정). ② `refundPolicy.test.ts`에 '전날 20:00 취소 → 70%', '당일 00:30 취소 → 10%', '10일 전 23:00 취소 → 100%' 경계 사례와 KST 자정 경계 사례. ③ refundTierLinesEn·REFUND_POLICY_FOOTNOTES는 문구가 이미 달력 표현이라 바꿀 것 없음 — '환불 금액은 신청 시점 기준' 각주와 queries.ts refundPctNow는 같은 함수를 쓰므로 자동으로 따라간다. ④ refund.ts:123·queries.ts:228의 호출부는 서명이 같아 수정 없음.

⑥ 비고: adjusted — 원 지적의 '거꾸로 유리하게 나오는 구간도 있다'는 틀렸고(한 방향 오류), '둘 중 하나를 운영자가 고른다'보다 '달력 기준으로 맞추고 알린다'가 기본값이어야 한다고 바로잡았다. P1 유지(흔한 조건에서 돈과 약속이 어긋나지만 건당 금액이 작고 환불 자체는 된다).

#### SHW-9. show_orders의 구매자 이름·연락처가 5년 파기 대상에서 빠져 있다(2031-10부터 효력) [P2 · S]

① `lib/privacy/orderRetention.ts:136-163`(5년 파기, 151-156 orders 세 칸만), `:238-245`(purgeRefundAccountsOfPurgedOrders), `:232`(show_orders 언급은 주석뿐) · `pages/api/cron/purge-orders.ts`(함수 등록 목록) · `db/schema.ts:1681-1682` · `lib/shows/service.ts:112-113`(createShowOrder가 orders와 같은 이름·전화 복사), `:228-229`(초대권은 buyer_name에 사유) · 파기 뒤 읽는 곳: `lib/shows/queries.ts:236`(getShowOrderForManage), `lib/shows/email.ts:223-228`(메일 로더).

② 지금 코드:
```ts
// orderRetention.ts:151-156 (파기는 orders 세 칸만)
.update(orders)
.set({ customerName: PURGED_MARK, customerPhone: PURGED_MARK, customerEmail: PURGED_MARK })
// db/schema.ts:1681-1682
buyerName: text('buyer_name').notNull(),
buyerContact: text('buyer_contact').notNull(),
```

③ 왜 문제인가: 5년 파기와 후속 파기가 orders·funding_pledges·refund_accounts만 다루고, orders와 같은 이름·전화를 복사해 둔 show_orders.buyer_name/buyer_contact는 어디서도 지우지 않는다(`git log -S'show_orders'`도 #475의 주석 추가 하나). 파기 뒤에도 getShowOrderForManage와 메일 로더가 그 값을 읽는다.

④ 조건·결과: 첫 공연 주문이 2026-10이라 2031-10까지는 대상 행이 없다. 그때 파기가 돌아도 이 표에는 실명·전화가 남아 처리방침의 5년 보존 약속이 공연 주문에서 깨진다. 지금 당장의 노출·장애는 없다.

⑤ **수정**: `purgeShowOrderBuyerDataOfPurgedOrders`를 별도 함수로 두고(표 없는 환경 대비, purgeRefundAccountsOfPurgedOrders와 같은 이유) purge-orders 크론에 등록한다.
```sql
UPDATE show_orders SET buyer_name = PURGED_MARK, buyer_contact = PURGED_MARK
WHERE order_no IN (SELECT order_no FROM orders WHERE customer_name = PURGED_MARK)
  AND (buyer_name <> PURGED_MARK OR buyer_contact <> PURGED_MARK)
```
초대권은 customer_name '초대권'이 5년 뒤 표식이 되므로 같은 WHERE로 따라온다. orderRetention 테스트에 공연 주문 케이스를 더한다. resolveShowRecipient는 이미 표식을 거르므로(email.ts:183-189 isPurgedValue + 이메일 정규식; buyer_contact는 normalizeShowContact를 거친 전화번호라 애초에 선택되지 않음) 손댈 것 없다.

⑥ 비고: adjusted — 원 지적의 'resolveShowRecipient가 buyer_contact를 메일 폴백으로 써 파기 후 엉뚱한 메일'은 사실과 달라 뺐고, 심각도는 P2(지금 터지는 사고도 노출도 없음). 아무도 2031년에 기억하지 못하므로 다음 보존 관련 변경에 같이 넣는다. 같은 자리를 다른 축(PAY 결제·주문·예약)도 지적: 결제가 성립하지 않은 주문(만료·실패)의 고객 이름·연락처·이메일이 법정 5년 기준으로 남는다 / (PRV 개인정보·처리방침 정합·로그): 결제가 성립하지 않은 주문(만료·실패·입금 전 취소)의 이름·연락처는 1년 뒤 파기 — 운영자 확인과 판본 올림이 전제.

#### SHW-10. 같은 회차·같은 연락처의 입금 대기 중복 신청을 막는 장치와 기한 초과 알림이 없다 [P2 · M]

① `lib/shows/service.ts:95-125`(createShowOrder 원자적 게이트), `:113`(계좌 입금은 hold_expires_at NULL) · `pages/api/shows/orders.ts:59-61`(IP당 시간당 10건이 유일한 제한) · `lib/shows/limits.ts:10`(1회 10매) · `lib/booking/rate-limit.ts:66-70`(DB 오류 때 허용) · `lib/contracts/client-ip.ts`(null이면 'unknown' 한 통) · `lib/ops/healthCheck.ts:789-811`(예약 캘린더만, 공연 입금 대기 기한 초과 없음) · `pages/admin/shows/[id].tsx:397`, `lib/shows/adminQueries.ts:112`(showDepositDeadline 계산·'자동 취소 없음' 표시) · 결정 근거: `lib/payments/bankDeposit.ts:9-15`, `lib/shows/CLAUDE.md` '계좌 입금' 절 · 정원: `data/shows/bakkeoji-anneun-maeumdeul.ts:97`(50석).

② 지금 코드:
```ts
// orders.ts:60-61
if (!(await consumeRateLimit(`show_order_create:ip:${ip}`, 10, 3600)))
  return res.status(429)...
// service.ts:113 (계좌 입금은 hold_expires_at NULL)
SELECT ${orderNo}, ${input.showtimeId}, ..., ${isBank ? null : Math.floor(now.getTime() / 1000) + HOLD_SECONDS}
```

③ 왜 문제인가: 계좌 입금 신청은 좌석을 기한 없이 잡는데(운영자 결정 — SAF2026에서 자동 만료가 입금한 사람에게 취소를 보냈다), 같은 사람이 실수로 두 번 신청해도 그대로 두 건이 잡히고, 안내 기한(신청+3일)을 넘긴 대기 건은 관리자 화면에서만 보인다. service.ts·conditions.ts에 연락처·이메일 기준 중복 차단이 없다. 실제로 겪은 사고 형태(SAF2026 중복 신청)를 막는 최소 장치가 없다.

④ 조건·결과: 실수 중복이 좌석을 겹쳐 잡고, 방치된 대기 건은 운영자가 관리자 화면을 열어야만 보인다. 고의 방해는 50석 지역 공연에서 동기가 희박하고 생겨도 관리자 '미입금 취소'로 푼다.

⑤ **수정**(자동 취소·정원 상한·Turnstile 없이 둘만):
1. createShowOrder의 원자적 게이트에 조건 하나: bank_transfer이고 같은 showtime_id에 `orders.status='awaiting_deposit'`이면서 customer_phone 또는 customer_email(소문자)이 같은 주문이 있으면 0행 → 새 코드 `duplicate_pending_deposit`('이미 입금 대기 중인 신청이 있습니다. 안내 메일의 내 티켓에서 확인하거나 문의…'). 게이트 안에 두어 경합에도 안전하고, 토스 결제 재시도에는 걸리지 않는다. (overflow의 '계좌 입금 신청은 pendingRef 재사용이 없어 재클릭마다 새 awaiting_deposit' 건도 이 게이트가 같이 막는다.)
2. healthCheck에 '공연 계좌 입금 대기 중 showDepositDeadline(adminQueries.ts가 이미 계산)이 지난 주문' 항목 — 건수·주문번호·관리자 딥링크를 운영자 메일로.
정원 비율 상한과 Turnstile은 운영자에게 선택지로만 보고한다.

⑥ 비고: adjusted — 원 수정안의 '정원 N% 상한'은 계좌 입금을 쓰는 바로 그 고객(카드 없는 관객)을 거절하는 상품 결정, 연락처별 rate limit은 연락처가 자유 입력이라 방해자는 못 막고, Turnstile은 '동의 최소화·UX 최우선' 결정과 부딪혀 셋 다 뺐다. rate limit의 fail-open·unknown은 저장소 전체 판단이라 공연 건이 아니다. P2.

#### SHW-11. 입장 스캔 링크를 관리자가 폐기할 길이 없다(revokeScanLink 미배선, 현황 링크와 비대칭) [P2 · S]

① `lib/shows/scanLink.ts:78-84`(revokeScanLink — 호출처 0) · `pages/api/admin/shows/[id].ts`(switch에 issue_scan_link 234-246·revoke_report_link 265-269만, revoke_scan_link 없음; 67행 주석) · `pages/admin/shows/[id].tsx:364`('폐기' 표시만), `:232-241`(현황 링크 폐기 버튼) · `lib/shows/reportLink.ts:61-67`(revokeReportLink 서명) · `lib/shows/checkin.ts:23·35`(scheduled 회차만 체크인), `:46-50`(undoCheckIn 120초·같은 라벨) · `lib/shows/showtimeOps.ts:205-208`(changeShowtime 연장) · `db/schema.ts:1761-1766`(showScanLinksRelations 없음) · 테스트 `tests/api/admin/shows/showsAdminApi.integration.test.ts:19`(jest.mock 목록).

② 지금 코드:
```ts
// scanLink.ts:78-84
export const revokeScanLink = async (id: string, now: Date = new Date()) => {...}
// pages/admin/shows/[id].tsx:364
{t.scanLinks.map((l) => <li key={l.id}>{l.label} · 만료 {kstTime(l.expiresAt)}{l.revokedAt ? ' · 폐기' : ''}</li>)}
```
`pages/api/admin/shows/[id].ts`의 switch(b.action)에 issue_scan_link만 있고 revoke_scan_link가 없다.

③ 왜 문제인가: revokeScanLink는 #442(9c7eedbadf)에서 들어온 뒤 한 번도 배선되지 않았고, 화면은 도달할 수 없는 '폐기' 상태만 그린다. 기획자 현황 링크에는 revoke_report_link와 버튼이 있어 같은 틀의 두 링크가 비대칭이다. 만료 전엔 Turso 셸로 행을 지우는 것 말고는 끊을 방법이 없다. CLAUDE.md에 '스캔 링크는 만료로만 끝낸다'는 운영자 결정은 없다. 단, 취소·종료 회차의 체크인은 checkin.ts가 이미 막고, 유출 링크로 되돌릴 수 있는 것은 같은 라벨이 120초 안에 찍은 것뿐이며, 관리자는 undo_checkin으로 언제든 되돌린다. 체크인 API는 이름·연락처를 내려보내지 않는다.

④ 조건·결과: 스태프 교체·링크 유출 시 그 회차에 한해 최대 72시간(회차 시각을 바꾸면 새 시각+24시간까지) 누군가 티켓을 미리 '입장' 처리해 실제 관객이 already_checked_in으로 막히는 현장 혼선. 개인정보·돈은 새지 않고 관리자가 되돌릴 수 있다.

⑤ **수정**:
- `lib/shows/scanLink.ts`: revokeReportLink와 같은 서명으로 `revokeScanLink(showtimeId, id, now)` — WHERE에 `showtime_id = ?`를 더해 소속 확인을 SQL 한 줄로 끝낸다(관계 선언이 없는 showScanLinks에 with를 쓰지 않는다 — drizzle이 추론하지 못한다, 핸들러 67행 주석).
- `pages/api/admin/shows/[id].ts`: `case 'revoke_scan_link'` — `showtimeOf(b.showtimeId)`로 회차 소속을 확인한 뒤 `revokeScanLink(showtime.id, b.linkId, now)`, false면 409('이미 폐기됐거나 이 회차의 링크가 아닙니다').
- `pages/admin/shows/[id].tsx`: t.scanLinks 항목(이미 회차별 목록이라 t.id를 안다)에 `revokedAt == null && expiresAt > now`일 때만 '폐기' 버튼(현황 링크 232-241과 같은 모양). 응답에 id를 더 실을 필요 없다(run()이 router.replace로 목록을 다시 읽어 adminQueries.ts:163-167이 id 포함 목록을 내려준다). verifyScanLink의 cancelled 검사는 넣지 않아도 된다(checkInTicket이 막는다).
- 테스트: `showsAdminApi.integration.test.ts:19`의 jest.mock에 revokeScanLink를 추가해야 import가 undefined가 되지 않는다; 다른 회차 linkId → 409; 폐기 뒤 `/api/shows/checkin` → 401(`scanLink.integration.test.ts`에 revoke→verify 'revoked' 케이스).

⑥ 비고: adjusted — 검증자가 네 가지를 바로잡았다: cancelled 회차는 checkin.ts가 이미 막음, undoCheckIn은 같은 라벨 120초만, 영향은 한 회차·72h·복구 가능이라 P1→P2, 제안 코드의 with는 관계 선언이 없어 동작하지 않음. 현장 혼선을 운영자가 더 무겁게 보면 P1도 변호 가능. 같은 자리를 다른 축(CQ 코드 품질·구조·중복·타입 안전)도 지적: 공연 입장 스캔 링크는 발급만 되고 폐기 수단이 없다 (revokeScanLink 호출처 0). 서명 변경은 SHW-36과 같은 수정이다.

#### SHW-12. 회차 시각 변경을 구매자에게 알리는 경로가 없고 환불은 일반 취소환불표를 따른다 [P2 · M]

① `pages/api/admin/shows/[id].ts:163-174`(change_showtime, 171-173 메일 없이 종료) · `pages/admin/shows/[id].tsx:341`(확인창 문구) · `lib/shows/email.ts`(발송 함수는 ticket·refund·cancelled 셋뿐) · `lib/shows/showtimeOps.ts`·`db/schema.ts`(previousStartsAt·changedAt 쓰기만, 읽는 곳 전 저장소 0건) · `lib/shows/refund.ts:123`, `lib/shows/queries.ts`(refundPctNow — cancelled일 때만 100%) · `lib/shows/refundPolicy.ts`.

② 지금 코드:
```ts
// [id].ts:171-173
await changeShowtime(showtime.id, next, now);
await revalidateShow(res, show.slug);
return res.status(200).json({ ok: true });
// pages/admin/shows/[id].tsx:341
confirm: '시각을 변경합니다. 구매자 안내는 별도로 해 주세요.'
// lib/shows/refund.ts:123
const pct = tickets[0].showtime.status === 'cancelled' ? 100 : refundRateForNotice(showtimeStartsAt, input.noticeAt);
```

③ 왜 문제인가: change_showtime은 메일 없이 끝나고 관리자 확인창이 운영자에게 떠넘긴다. 고객 화면은 변경 사실을 표시하지 않는다(previous_starts_at 읽는 곳 0). 환불율은 새 시각 기준 일반표라 주최 측 사유 변경에도 수수료가 붙을 수 있다.

④ 조건·결과: 고객이 옛 시각에 맞춰 오거나, 변경을 알아도 못 오는 사람이 수수료를 내고 환불해야 한다. 분쟁 소지.

⑤ **수정**(코드만으로 되는 부분 먼저):
(a) `lib/shows/email.ts`·`emailHtml.ts`·`emailEn.ts`에 `sendShowtimeChangedEmail`(옛/새 시각, 내 티켓 링크)을 만들어 paid·partially_refunded 주문(계좌 입금 확인 주문 포함)에 보낸다. 입금 대기 주문에는 안내만 한다.
(b) 내 티켓 화면에 previous_starts_at이 있으면 '시각이 변경되었습니다(이전 …)'를 표시한다.
(c) 환불 정책은 운영자(와 필요하면 변호사) 결정 사항이므로 구현 전에 질문으로 올린다: 변경 후 일정 기간 100% 환불 여부. 결정되면 refundShowTickets와 getShowOrderForManage가 같은 함수를 쓰게 한다.

⑥ 비고: adjusted — 원 수정안의 'N일 안 환불 100%'는 임의 숫자이고 약관·FAQ·REFUND_POLICY_FOOTNOTES에 걸린 약속이라 개발자가 정할 일이 아니어서 운영자 결정 대기로 분리했다. P2.

#### SHW-13. 환불 요청이 화면에 보인 금액을 확인하지 않고, 서버가 그 시점의 환불율로 다시 계산한다 [P2 · S]

① `pages/api/shows/refund.ts:73` · `components/shows/ShowTicketManage.tsx:180`(요청 본문), refundTotal 라벨 · `lib/shows/queries.ts`(refundAmountNow, SSR 시점 `refundRateForNotice(startsAt, now)`) · `lib/shows/refund.ts:123` · `lib/shows/refundMessages.ts`(SHOW_REFUND_REJECT_MESSAGES) · 결정 근거: ShowTicketManage.tsx 주석, `lib/shows/CLAUDE.md` '선택 → 버튼 한 번'(2026-10-03 '동의·단계 최소화').

② 지금 코드:
```ts
// pages/api/shows/refund.ts:73
const outcome = await refundShowTickets({ orderNo, ticketIds: ids, noticeAt: new Date(), actor: 'customer', refundAccount }, { cancelPayment });
// components/shows/ShowTicketManage.tsx:180
body: JSON.stringify({ orderNo: order.orderNo, token, ticketIds: selected, locale, ...(viaAccount ? { refundAccount } : {}) }),
```

③ 왜 문제인가: 내 티켓 화면은 SSR 시점 기준으로 '(지금 환불하면 25,000원)'을 보여 주고 버튼 라벨에 금액을 찍지만, 요청 본문에는 금액이 없다. 화면을 열어 둔 채 날짜 경계(10일/7일/3일/1일/당일, 100/90/80/70/10%)를 넘기면 서버가 더 낮은 환불율로 계산해 환불해 버린다. 최대 낙차는 1일 전 70% → 당일 10%. 서버가 신청 시점으로 계산한다는 것은 REFUND_POLICY_FOOTNOTES('신청 시점 기준')에 고지돼 있어 법적 노출은 완화되지만, 운영자가 확인 단계를 없애기로 한 결정은 버튼 라벨의 금액이 곧 약속이어야 성립한다.

④ 조건·결과: 고객이 본 금액보다 적게 환불되고 이의 제기가 생긴다. 계좌 입금 주문은 그 금액으로 운영자가 송금한다. 발생 확률은 낮고 건당 영향은 크다.

⑤ **수정**: 확인 단계를 늘리지 않고 클라이언트가 화면에 보인 총액 `expectedAmount`를 함께 보낸다. `refundShowTickets`에 `expectedAmount?: number`를 받아 계산 결과 totalAmount와 다르면 선점 전에 `{ status: 'rejected', reason: 'amount_changed' }`를 돌려주고(SHOW_REFUND_REJECT_MESSAGES에 '환불 금액이 바뀌었습니다. 새로고침해 확인해 주세요' ko/en 추가), 화면은 새로고침한다. 관리자 경로는 값을 보내지 않으면(optional) 영향이 없다.

⑥ 비고: confirmed, P2 유지. SHW-8(달력 기준)을 먼저 고치면 경계 자체가 KST 자정으로 바뀌므로 테스트 시각을 그 기준으로 잡는다.

#### SHW-14. 한국어 티켓 메일의 환불 규정 일수 구간 라벨이 하드코딩이라 TIERS 변경을 따라가지 않는다 [P2 · S]

① `lib/shows/email.ts:40-54`(buildRefundPolicyLines, 40-42 주석) · 정본 `lib/shows/refundPolicy.ts:8-14`(TIERS, export 안 됨), `:39-49`(refundTierLines) · `lib/shows/emailEn.ts:67`(이미 refundTierLinesEn 사용) · 출력: `email.ts:124`(텍스트), `emailHtml.ts:75`(HTML) · `lib/shows/email.test.ts:34-38` · 실제 환불: `lib/shows/refund.ts:123`.

② 지금 코드:
```ts
// email.ts:47-53
return [
  `공연 10일 전까지 ${rate(10)}%`,
  `9~7일 전 ${rate(7)}%`,
  `6~3일 전 ${rate(3)}%`,
  `2~1일 전 ${rate(1)}%`,
  `공연 당일 ${rate(0)}%, 공연 시작 후에는 환불할 수 없습니다`,
];
```

③ 왜 문제인가: 비율만 refundRateForNotice로 얻고 구간 라벨은 손으로 쓴 문자열이다. 주석은 '규정이 바뀌면 메일 문구도 따라간다'고 하지만 라벨은 따라가지 않고, TIERS의 minDaysBefore를 바꾸면 하드코딩된 rate(10)·rate(7)·rate(3)·rate(1) 조회가 엉뚱한 비율을 옛 라벨에 붙인다. 현재는 일치한다(rate(10)=100, rate(7)=90, rate(3)=80, rate(1)=70, rate(0)=10). 이 줄은 고객 메일로 나가고 실제 환불은 refund.ts:123으로 계산되므로 정책 변경 때 안내와 실제 환불이 갈리는 구조이고, 주석이 거짓 안심을 준다. email.test.ts:34-38은 lines[0]에 '100%', lines[4]에 '10%'만 보아 라벨 드리프트를 못 잡는다.

④ 조건·결과: 환불 규정을 바꾸는 날 한국어 티켓 메일의 환불 규정만 옛 구간·틀린 비율을 안내한다. 화면·FAQ·영어 메일은 정확하고 실제 환불은 새 규정으로 계산되어 안내와 실제가 어긋난다. (SHW-8의 달력 기준 수정을 넣으면 at(0)이 '1일 전'으로 잡혀 당일 줄에 70%가 찍히므로, 그 수정과 함께 터진다.)

⑤ **수정**: buildRefundPolicyLines를 `() => [...refundTierLines(), REFUND_POLICY_FOOTNOTES[0]]`로 바꾸고 불필요해진 refundRateForNotice import와 가짜 날짜 계산(start·at·rate)을 지운다. 메일 문구가 화면과 같은 형식('공연 10일 전까지 — 100%')으로 바뀌고, '공연 시작 후에는 환불할 수 없습니다'는 '공연 시작 이후, 그리고 입장 처리된 티켓은 환불할 수 없습니다.'로 바뀌는데 정책은 그대로다. email.test.ts의 해당 케이스는 TIERS를 건드리지 말고(export 안 된 모듈 상수) `expect(buildRefundPolicyLines().slice(0, 5)).toEqual(refundTierLines())`와 마지막 줄이 REFUND_POLICY_FOOTNOTES[0]인지로 바꾼다. emailEn은 변경 불필요.

⑥ 비고: adjusted — '영어 메일도 별도·문구 형식이 다르다'는 틀렸고(emailEn.ts:67이 이미 정본 사용), 'TIERS를 바꿔 보는 테스트'는 export가 없어 불가하다고 바로잡았다. P2 유지. SHW-8 ⑤①과 같은 수정이다.

#### SHW-15. 웹훅 취소 대사가 auto_cancel_pending 주문을 환불 완료로 바꾸지 못해 원장 기록 실패 건이 영구히 멈추고 헬스체크 high 알람이 매번 울린다 [P2 · S]

① `lib/shows/refund.ts:423-426`(sync의 orders UPDATE) · `lib/shows/confirm.ts:326`(autoCancelShowApproval 유일 호출), `:566-580`(ledger_write_failed — claim 유지) · `lib/booking/webhook.ts:365-369`(CANCELED → sync) · `lib/ops/healthCheck.ts:470-487`(auto_cancel_pending & updated_at<1시간 전, high) · 관리자 공연 화면에 주문 상태 변경 액션 없음(set_status는 공연 상태).

② 지금 코드:
```ts
await db.run(sql`
  UPDATE orders SET status = ${nextStatus}, updated_at = unixepoch()
  WHERE id = ${order.id} AND status IN ('paid', 'partially_refunded')
`);
// lib/shows/confirm.ts:568-579 — 토스 취소는 이미 끝났다(돈은 돌아갔다) … 영구 실패로 끝내고 사람이 보게 한다.
return { status: 'ledger_write_failed' };
```

③ 왜 문제인가: autoCancelShowApproval이 토스 취소 성공 뒤 원장 batch 실패(ledger_write_failed)로 auto_cancel_pending에 남으면, 이어지는 CANCELED 웹훅의 syncShowCancelsFromToss는 refunds 델타와 held→void는 맞추지만 orders UPDATE가 paid/partially_refunded만 받아 주문 상태와 show_orders.auto_cancelled_at이 그대로다. 확정 batch의 payments INSERT는 이미 커밋돼 있어 sync가 'payments 행 없음'으로 물러나지도 않는다. orders.updated_at이 안 바뀌어 healthCheck가 매 실행 high로 알리고, 해소 수단이 DB 직접 수정뿐이다.

④ 조건·결과: 토스 취소 성공+원장 기록 실패라는 이중 장애에서만 발생하므로 빈도는 낮다. 돈은 돌아갔고 티켓·환불 행은 웹훅으로 맞춰진다. 남는 것은 주문 상태 불일치와 지워지지 않는 high 알람.

⑤ **수정**: sync의 orders 전이에서 `nextStatus === 'refunded'`일 때만 WHERE를 `status IN ('paid','partially_refunded','auto_cancel_pending')`로 넓히고, 같은 호출에서 `UPDATE show_orders SET auto_cancelled_at = COALESCE(auto_cancelled_at, unixepoch()) WHERE order_no = ?`를 쓴다(auto_cancel_pending일 때만). pending/expired/failed는 넓히지 않는다 — NETWORK_ERROR 경로(revertClaim→pending_retry)는 웹훅이 refunds를 채우고 held→void가 되며 주문은 만료 크론이 expired로 넘겨 알람 없이 끝나고, 결제 진행 중일 수 있는 pending을 refunded로 바꾸는 쪽이 오히려 위험하다. autoCancel 진행 중에 웹훅이 먼저 와도 안전하다(refunds는 같은 transactionKey NOT EXISTS 가드, orders UPDATE는 0행). 테스트: `confirm.integration.test.ts` 또는 `refund.integration.test.ts`에 'autoCancel batch 실패 주입 → ledger_write_failed → CANCELED 대사 → 주문 refunded·auto_cancelled_at 기록'과 '웹훅이 autoCancel 진행 중에 먼저 와도 환불 행이 하나'.

⑥ 비고: adjusted — 원 수정안의 pending/expired/failed 확대는 불필요하고 위험하다고 보아 auto_cancel_pending 한 상태만 더하는 것으로 좁혔다. P2.

#### SHW-16. 자동 전액 취소(sold_out 경합)에 고객 안내 메일과 운영자 알림이 없고, sendShowRefundEmail 주석이 존재하지 않는 호출부를 적는다 [P2 · M]

① `lib/shows/email.ts:312-323`(sendShowRefundEmail 주석) · 실제 호출부: `pages/api/shows/refund.ts:77`, `pages/api/admin/shows/[id].ts:185`뿐 · 메일 없는 곳: `lib/shows/refund.ts:353-454`(syncShowCancelsFromToss), `lib/shows/confirm.ts:430-583`(autoCancelShowApproval), `lib/booking/webhook.ts:365-369`, `:312-322`(confirmed/already_confirmed에서만 티켓 메일) · `lib/shows/emailHtml.ts:110` · `lib/shows/failMessages.ts:34-37` · 재환불 경로: `pages/admin/shows/[id].tsx:385`, `refund.ts:124`.

② 지금 코드:
```ts
/** 환불 완료 안내. 호출부: refundShowTickets가 `refunded`를 돌려준 직후(API 라우트)·syncShowCancelsFromToss. */
export const sendShowRefundEmail = async (…
// lib/shows/emailHtml.ts:110
: '환불은 접수되어 처리 중입니다. 완료되면 다시 안내드립니다.';
```
grep 결과 sendEmail/notify 호출은 confirm.ts:347의 notifyShowPaymentToOperator와 webhook.ts:317의 sendShowTicketEmail뿐이다.

③ 왜 문제인가: 웹훅 신뢰 경로에서 확정이 매진으로 끝나 autoCancelShowApproval이 돈을 돌려줘도 고객 메일·운영자 알림이 전혀 없다(브라우저를 닫은 고객은 화면 문구도 못 본다). email.ts:312 주석은 syncShowCancelsFromToss를 호출부라 적지만 호출하지 않는다. 회차 취소 환불 실패 주문의 '완료되면 다시 안내' 약속은 운영자가 '입장 전 티켓 환불'을 다시 누르면 sendShowRefundEmail이 나가므로 코드가 이행한다 — 빈 곳은 cancelShowtime의 토스 호출이 NETWORK_ERROR인데 실제로는 취소된 좁은 경우뿐이다.

④ 조건·결과: 좌석 경합 매진 뒤 웹훅으로 확정되는 드문 경우에 고객은 결제 취소를 카드사 알림으로만 알게 되고 운영자는 로그를 보기 전까지 모른다. 돈은 정상적으로 돌아간다.

⑤ **수정**: ① confirmShowOrder가 autoCancelShowApproval에서 'cancelled'를 받은 뒤(`confirm.ts:326` 부근) 고객에게 '정원이 먼저 차 결제를 자동 취소했습니다' 메일(새 함수, 기존 환불 메일 레이아웃 재사용)과 `audience:'operator'` 알림(관리자 딥링크)을 보낸다. 실패는 삼킨다. ② `email.ts:312` 주석에서 syncShowCancelsFromToss를 지운다(SHW-30과 같은 수정). ③ sync에서의 고객 메일은 일반 환불과 중복 발송이 되므로 넣지 않는다 — 웹훅이 응답보다 먼저 와 델타를 넣는 경합 때 API도 메일을 보낸다(refund.ts API:77). 꼭 필요하면 sync가 refunding 티켓을 실제로 전이시켰을 때(rowsAffected>0)만, 중복 가능성을 감수하고 보낸다. 토스 콘솔 직접 취소는 알림 대상에서 뺀다(운영자가 알고 있고 카드사 알림도 간다).

⑥ 비고: adjusted — 원 지적의 '회차 취소 실패 주문의 약속 미이행'과 '콘솔 취소 무통지'는 과장이라 범위를 자동 취소 무통지로 좁혔고, sync에서 메일을 보내는 수정안은 중복 발송 위험으로 뺐다. P2 유지.

#### SHW-17. 티켓 메일 실패가 관리자 공연 화면에 보이지 않고 재발송 수단이 없다(force 옵션은 호출처 0, 입금 안내 실패도 같은 칸에 숨는다) [P2 · S]

① `lib/shows/adminQueries.ts:106-124`(AdminOrderRow — notificationError 없음), `:120-190`(loadAdminShowDetail) · `pages/admin/shows/[id].tsx`(표시 없음; 447-451 resend_deposit_guide 응답에서만 일시 표시) · `lib/shows/email.ts:257-258`(force 주석), `:261-267`(선점 조건 `!= send_inflight`) · sendShowTicketEmail 호출부: `success.tsx:196`, `webhook.ts:317`, `bankDeposit.ts:164`(force 넘기는 곳 0) · `pages/api/admin/shows/[id].ts`(재발송 액션 없음) · `pages/api/shows/orders.ts:86-87`(주석 — 계좌 입금 안내 메일 건) · `lib/ops/healthCheck.ts:439-458`(orderMailFailed, type 필터 없음, 안내문 455행) · `lib/ops/notificationSentinel.ts:61-70`('발송 중단?' 배지) · `lib/shows/faq.ts:45-48`.

② 지금 코드:
```ts
export interface AdminOrderRow {
  orderId: string; orderNo: string; bankDeposit: BankDepositState | null; depositDeadline: string | null;
  customerName: string; isComp: boolean; orderStatus: string; buyerName: string; buyerContact: string;
  totalAmount: number; createdAt: number; tickets: AdminTicketRow[];
}   // notificationError 없음
// lib/shows/email.ts:257-258
 * … `force`는 관리자 재발송용으로 inflight가 아닌 모든 상태에서 선점한다.
// pages/api/shows/orders.ts:86-87
// … 실패는 notification_error로 관리자 화면에 남는다.
// lib/ops/healthCheck.ts:~455  '관리자 > 예약·펀딩 상세에서 재발송할 수 있습니다.'
```

③ 왜 문제인가: orders.notification_error의 센티널·실패 사유가 AdminOrderRow에 실리지 않아 공연 관리 화면은 티켓·입금 안내 메일 실패를 보여 주지 못하고, `sendShowTicketEmail({force})`는 호출처가 없다. 헬스체크 안내문과 orders.ts 주석은 공연에 없는 화면·기능을 가리킨다. FAQ의 '주소를 잃었으면 전화' 경로에서 운영자가 보낼 수단이 없다. 또 force는 send_inflight를 선점하지 못해 '발송 중단?' 배지 상태(운영자에게 '다시 보내 주세요'라고 안내하는 바로 그 상태)는 재발송으로도 풀리지 않는다.

④ 조건·결과: Resend 장애·오타 주소로 티켓 메일이 실패하면 운영자는 헬스체크 메일의 주문번호만 받을 뿐 화면에서 상태를 못 보고 재발송도 못 한다(DB를 직접 만져야 함). 고객은 완료 화면의 '내 티켓' 링크로 티켓을 열 수 있어 입장 자체가 막히지는 않는다.

⑤ **수정**: ① AdminOrderRow에 `notificationError: string | null`을 더하고 loadAdminShowDetail에서 `o.order.notificationError`를 싣는다. 화면은 예약·펀딩 상세와 같이 `lib/ops/notificationSentinel.ts`의 describeNotificationError로 배지를 만든다(새 빨간 배지를 따로 만들지 않는다). ② `pages/api/admin/shows/[id].ts`에 `resend_ticket_email` 액션: 소속 확인 → order.status가 paid/partially_refunded일 때 `sendShowTicketEmail(orderNo, { force: true })` → `{ sent }`를 응답에 싣는다. ③ 관리자 재발송이 send_inflight도 되찾도록 선점 조건을 분리한다(예: `force:'admin'`이면 inflight도 허용 — 명시적 관리자 동작이라 중복 발송 위험 감수). 그렇지 않으면 UI가 sent:false를 '진행 중이라 보낼 수 없음'으로 알려 준다. ④ healthCheck.ts:455 안내문과 orders.ts:86-87 주석에 '공연은 공연 관리 상세'를 적는다(입금 안내 메일 쪽도 같은 이유로 거짓이므로 같이). ⑤ 테스트: 실패 주입 후 재발송 성공, inflight 상태 재발송 사례.

⑥ 비고: adjusted — orders.ts:86-87 주석은 티켓 메일이 아니라 계좌 입금 안내 메일 이야기이고, force 재발송은 inflight 선점 조건 때문에 그대로는 풀리지 않는다는 점을 검증자가 더했다. P2.

#### SHW-18. 환불 계좌 패널에 송금액·접수 시각이 없고, 환불 계좌 행 하나(refunded_at 플래그 하나)로는 '송금 대기 두 건'을 표현하지 못한다 [P2 · M]

① `pages/admin/shows/[id].tsx:491-552`(RefundAccountPanel) · `lib/payments/refundAccount.ts:100-106`(saveRefundAccount ON CONFLICT) · `pages/api/shows/refund.ts`(ticketIds 부분집합 허용) · `lib/shows/adminQueries.ts`(loadAdminShowDetail) · 금액이 있는 곳: buildShowRefundOperatorEmail 메일뿐.

② 지금 코드:
```tsx
function RefundAccountPanel({ order: o, info, busy, run, setNotice }: …) {
  …
  <p className="mt-0.5">{info.bankName} · 예금주 {info.accountHolder}</p>
  … <Button …>계좌 보기</Button> … <Button …>송금 완료</Button>
// lib/payments/refundAccount.ts:103-106
ON CONFLICT (order_kind, order_no) DO UPDATE SET … requested_at = excluded.requested_at, refunded_at = NULL, updated_at = unixepoch()
```

③ 왜 문제인가: 계좌 입금 주문을 나눠 환불하면 요청마다 계좌 행이 덮이고 refunded_at이 NULL로 돌아간다. 패널은 은행·예금주·송금 완료 버튼만 보여 주고(접수 시각 updatedAt은 SSR props로 내려오지만 그리지 않는다 — 예약 패널은 그린다) 이번에 보낼 금액을 알려주지 않는다. 환불액은 취소환불표(공연 임박도)에 따라 달라 티켓 표의 unitAmount로도 못 구한다. 첫 요청이 미송금인 채 둘째가 오면 패널 하나·버튼 하나로 두 금액을 합쳐 보내야 하는데 화면이 그 합을 모른다.

④ 조건·결과: 메일을 놓치거나 둘째 메일 금액만 보면 고객에게 덜 보내거나(첫 건 누락) 이미 보낸 첫 금액을 다시 보내는 사고. 사람이 하는 송금이라 금액 근거가 화면에 있어야 한다. 계좌 입금 주문의 부분 환불 빈도는 데이터를 못 봤다.

⑤ **수정**(마이그레이션 없이 먼저): loadAdminShowDetail에서 계좌 입금 결제(isBankDepositPayment)에 달린 `requested_by='customer', status='done'` 환불을 시각·금액 목록과 합계로 읽어 패널에 '고객 요청 환불 n건 · 합계 N원(건별 시각·금액)'과 접수 시각(updatedAt)을 표시한다. 관리자 기록(requested_by='admin')은 이미 송금한 것이라 제외한다. 'requested_at 이후 합'으로 미송금액을 계산하지 말 것(둘째 요청이 requested_at을 덮는다). 정확한 미송금액이 필요하면 refund_accounts에 누적 칸(예: pending_amount)을 더하되 마이그레이션이므로 CLAUDE.md의 배포 전 적용 순서·when 최댓값 규칙을 따른다.

⑥ 비고: adjusted — 원 수정안의 'requested_at 이후 done 합'은 첫 요청 금액이 빠져 틀렸다고 바로잡았고, 접수 시각도 안 보인다는 점을 더했다. P2(분명한 개선).

#### SHW-19. 회차 시각 변경이 만료·폐기 여부를 보지 않고 모든 스캔 링크를 연장한다 (폐기 수단도 없음) [P3 · S]

① `lib/shows/showtimeOps.ts:205-208`(changeShowtime의 두 번째 UPDATE, 함수 주석에 연장 의도) · `lib/shows/scanLink.ts:78`(revokeScanLink 호출처 0) · `pages/api/admin/shows/[id].ts` 약 165행(`showtime.status !== 'scheduled'`면 409), `:240`(발급 TTL 72h 검증) · `pages/api/shows/checkin.ts`(머리 주석·응답 본문 — PII 없음) · `lib/shows/showtimeOps.integration.test.ts`.

② 지금 코드:
```sql
UPDATE show_scan_links SET expires_at = MAX(expires_at, ${newStartsAtSec} + 86400)
WHERE showtime_id = ${showtimeId}
```

③ 왜 문제인가: revoked_at·만료 여부를 보지 않아 이미 만료된 옛 링크가 새 공연일까지 되살아난다. 연장 자체는 의도된 설계다(옛 시각 기준 만료로 새 공연일에 스캔이 막히는 것을 방지). 72시간 상한은 발급 TTL 검증이지 링크 수명 총량 상한이 아니다. 스캔 링크가 여는 것은 체크인과 되돌리기뿐이고, 작동하려면 80비트 티켓 코드(SNT1:+16자 base32)를 알아야 하며 응답에는 입장 번호·집계만 나가고 구매자 PII는 없다. 취소 회차에도 두 번째 UPDATE가 실행된다는 점은 함수 수준에서는 맞지만 API가 409로 막아 경합 창 외에는 닿지 않는다.

④ 조건·결과: 전 스태프가 가진 옛 링크가 새 공연일에 다시 체크인을 할 수 있다. 유효한 티켓 코드를 알아야 하고 PII가 나가지 않아 피해는 작다.

⑤ **수정**: 연장 대상을 아직 살아 있는 링크로 좁힌다: `WHERE showtime_id=? AND revoked_at IS NULL AND expires_at > ${nowSec}`. 첫 UPDATE의 rowsAffected가 0이면 두 번째를 건너뛴다. 72h 상한 캡(`MIN(...created_at+72h)`)은 연장 목적과 충돌하므로 넣지 않는다(오늘 만든 72h 링크를 한 달 뒤 공연에 쓸 수 없게 됨). 별도로 admin API에 revoke_scan_link 액션과 UI '폐기' 버튼을 붙여 이미 있는 revokeScanLink를 쓴다(SHW-11). 테스트는 SHW-38에서 같이 넣는다(이 수정이 들어간 뒤 '만료 링크는 연장되지 않는다'를 단언).

⑥ 비고: adjusted — 연장은 의도된 설계이고 피해가 작으며 제안된 72h 캡은 연장 목적을 없앤다는 이유로 P2→P3. 폐기 수단 쪽은 SHW-11이 본 항목이다.

#### SHW-20. 공연 승인 응답의 status를 DONE으로 확인하지 않는다 (booking과 비대칭, 방어 보강) [P3 · S]

① `lib/shows/confirm.ts:113-117`(result.ok → approved), 137행 부근(ALREADY_PROCESSED 분기만 DONE·orderId·금액 검증) · 비교 `lib/booking/confirm.ts:526-538` · 래퍼 `lib/booking/toss.ts` confirmPayment(`status !== 'DONE' && isVirtualAccountPayment` → VIRTUAL_ACCOUNT_UNSUPPORTED) · 호출: `success.tsx:13`, `lib/booking/webhook.ts`.

② 지금 코드:
```ts
let approved: TossPayment;
if (result.ok) {
  approved = result.payment;
```
(비교: booking은 `if (toss.payment.status !== 'DONE') { ... return { ok: false, code: 'toss_rejected', message } }`.)

③ 왜 문제인가: 정상 승인 응답을 status 검증 없이 확정 경로로 넘긴다. 가상계좌는 래퍼가 이미 막으므로(shows에서는 final else의 toss_unresolved로 처리) 비DONE+비가상계좌 응답만 남는데, 토스 승인 API가 카드·간편결제에서 그런 응답을 내는 경우는 문서·코드 어디에도 없다. 현재 결제수단(카드, 카카오·네이버·토스·페이코·애플페이, 계좌 직접 입금=토스 비경유)은 전부 즉시 DONE이다.

④ 조건·결과: 현재 결제수단에서는 사실상 도달하지 않는다. 토스가 새 비동기 결제수단을 열면 입금 전 주문이 발권될 수 있는 잠재 위험.

⑤ **수정**: `if (result.payment.status !== 'DONE') { console.error(...); return { status: 'error', code: TOSS_UNRESOLVED_CODE }; }`를 넣고, ALREADY_PROCESSED 분기의 DONE·orderId·금액 검증과 하나의 헬퍼로 합쳐 두 경로가 갈라지지 않게 한다. `confirm.integration.test.ts`에 FakeToss가 WAITING_FOR_DEPOSIT/IN_PROGRESS를 돌려주는 케이스를 더한다.

⑥ 비고: adjusted — '입금 0원 주문이 발권된다'는 서술은 과장이고 방어적 패리티 수준이라 P3. 수정 자체는 올바르고 값싸다.

#### SHW-21. 정리번호 배정이 확정 batch 뒤에 보호 없이 있어, 실패하면 500이 나고 재생 경로에서 복구되지 않는다 [P3 · S]

① `lib/shows/confirm.ts:344-348`(assignEntryNumbers·notifyShowPaymentToOperator), `:94-96`(재생은 assign을 부르지 않음), `:368-382`(assignEntryNumbers 본체 — 주문의 모든 티켓 대상) · `lib/shows/bankDeposit.ts:161`(계좌 입금 확정 — assign 뒤에 티켓 메일) · `lib/booking/webhook.ts` 약 392행(outer catch, 키 회수·500) · null 처리: `email.ts:118`, `emailHtml.ts:42`, ShowTicketManage.

② 지금 코드:
```ts
await assignEntryNumbers(input.orderNo);
// 신규 확정에서만 한 통 ...
await notifyShowPaymentToOperator(input.orderNo);
return { status: 'confirmed' };
```
재생(already_confirmed)은 assignEntryNumbers를 부르지 않고 바로 반환한다.

③ 왜 문제인가: assignEntryNumbers가 던지면 확정 결과가 예외로 바뀌고(success 500, 웹훅 500), 재시도는 already_confirmed로 끝나 번호도 운영자 결제 알림도 영영 안 나간다. 계좌 입금 확정은 티켓 메일까지 건너뛴다(센티널이 남아 헬스체크·관리자 재발송으로 복구 — 단 공연은 재발송 수단이 없다, SHW-17).

④ 조건·결과: '바로 앞 batch는 성공했는데 연달아 쓰는 UPDATE가 일시 장애로 실패'하는 낮은 확률. 티켓은 유효하고 입장 번호만 빈다(entryNumber null은 메일·화면·스캔이 정상 처리). 계좌 입금 건은 티켓 메일이 지연된다.

⑤ **수정**: (1) 두 호출을 try/catch로 감싸 확정을 뒤집지 않고 로그만 남긴다(bankDeposit.ts는 메일 발송 전에 처리). (2) 복구가 필요하면 assignEntryNumbers의 대상을 `status = 'issued'`로 좁힌 뒤(지금은 주문의 모든 티켓을 대상으로 해, 환불·무효로 바뀐 뒤 재생되면 죽은 티켓에 번호를 낭비한다), 재생 경로(already_confirmed 중 paid)와 sendShowTicketEmail 직전에도 호출한다. 이미 번호가 있는 티켓은 건드리지 않는 멱등 함수다.

⑥ 비고: adjusted — 돈·입장 자격에 영향이 없어 P2→P3. 재생 경로 호출 시 issued로 좁혀야 한다는 보완을 더했다.

#### SHW-22. 관리자 공연 액션(환불·취소·입금 확인·초대권)에 수행자 기록이 없다 [P3 · M]

① `pages/api/admin/shows/[id].ts:59-63`(auth 받고 auth.actor 미사용) · `lib/shows/refund.ts:88`(refunds.requested_by 'admin' 고정) · 비교 `pages/api/admin/funding/pledges/[id].ts:124` · `lib/privacy/accessLog.ts`(주석 — 열거값 변경 시 처리방침 19항) · `lib/shows/roster.ts:28`(show_roster_export는 이미 기록) · 예약·구독·주문 관리자 API도 auth.actor 미사용.

② 지금 코드:
```ts
const auth = await authenticateAdminApi(req, res);
if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
```
이후 auth.actor는 파일 어디에서도 쓰이지 않는다(비교: funding은 `actor: { kind: 'admin', actor: auth.actor }`).

③ 왜 문제인가: 환불·회차 취소·입금 확인·초대권 발급 등 돈과 명단에 영향을 주는 액션의 수행자가 남지 않는다. 다만 '공연 쪽만 빠졌다'는 틀리다 — 저장소에 범용 관리자 감사 로그가 없고 예약·구독·주문 관리자 API도 같다. refunds·orders·show_tickets에 시각은 남는다.

④ 조건·결과: 책임 소재를 시각은 알아도 사람은 알 수 없다. 관리자 계정이 소수라 실제 피해는 작다.

⑤ **수정**: privacy_access_logs에 끼우지 않는다(개인정보 접근 기록이며 열거값 변경은 처리방침 개정 = 펀딩 약관 판본 게이트를 부른다). 가장 값싼 수단: 도메인 함수가 이미 쓰는 칸에 수행자를 담는다. 환불은 refunds.requested_by를 `admin:${auth.actor}`로(refund.ts의 `requestedBy === 'customer'` 비교는 그대로 동작), 입장 취소는 undoCheckIn 호출을 `admin:${actor}`로. 그 밖의 액션은 `console.info('[admin-shows]', {actor, action, showId, targetId})` 구조 로그 한 줄. 범용 감사 표가 필요하면 shows가 아니라 관리자 API 전체의 별도 과제로 올린다.

⑥ 비고: adjusted — '공연만 빠졌다'·'되짚을 수 없다'는 과장, privacy_access_logs 재사용은 부적절. P2→P3. requested_by 값 변경은 SHW-45의 대사 기록과 같은 칸이다.

#### SHW-23. 초대권은 QR 링크를 줄 방법이 없고 판매 마감 이후(공연 당일)에는 발급되지 않는다 [P3 · M]

① `pages/api/admin/shows/[id].ts:97-109`(issue_comp — 응답 orderNo만) · `lib/shows/service.ts:194-220`(compGate·windowGate = showtimeSalesWindowCondition), `:217-218`(customer_email '') · `lib/shows/adminQueries.ts:184`(AdminTicketRow.code — 이미 실림), ROSTER_COLUMNS(CSV code 열) · `lib/shows/scanAccess.ts`(extractTicketCode — 코드 직접 입력) · `lib/shows/conditions.ts` · 설계 출처 `docs/superpowers/plans/2026-09-30-shows-phase1-core.md` Task 13, 스펙 §7.6.

② 지금 코드:
```ts
// [id].ts:103-104
const r = await issueCompTickets({ ... note: b.note.trim().slice(0, 100) }, now);
if (r.ok) return res.status(200).json({ ok: true, orderNo: r.orderNo });
// service.ts:220
WHERE ${windowGate} AND ${zoneGate} AND ${quotaGate} AND ${compGate}
```

③ 왜 문제인가: issue_comp 응답에 manageToken이 없어 받는 사람에게 QR 화면 링크를 줄 수 없다. 코드 문자열은 CSV와 AdminTicketRow에 있으나 화면이 안 그린다. 초대권도 판매창 게이트(sales_close_at = 공연 당일 00:00 KST)를 타서 당일 발급이 sales_closed로 막힌다 — 이는 도입 계획에 '세 게이트 모두 통과'로 명시된 설계이고 CLAUDE.md의 운영자 결정은 아니다.

④ 조건·결과: 초대권 전달이 CSV 복사에 의존하고, 출연자 게스트 같은 당일 추가는 DB 직접 수정이 필요하다. 입장 자체는 코드 직접 입력으로 가능하다.

⑤ **수정**: issue_comp 응답에 주문의 manageUrl을 담아 관리자 화면에서 복사 버튼으로 보여 준다(관리자 인증 응답이라 토큰 노출 위험 없음). 초대권 발급은 showtimeSalesWindowCondition 대신 liveShowtimeCondition(시작 전)을 쓰되, 스펙 §7.6을 바꾸는 일이므로 운영자 확인 후 한다. 이름·이메일 선택 입력 후 티켓 메일 발송은 기능 확장이라 별도 과제.

⑥ 비고: adjusted — '관리자 화면이 티켓 코드를 싣지 않는다'는 틀렸고(adminQueries.ts:184), 판매창 게이트는 설계 결정. 기능 격차이지 결함이 아니라 P2→P3.

#### SHW-24. 결제 거절(failed) 주문의 held 티켓이 영구 잔존하고 만료 처리가 두 문장이라 중간 실패 시 복구되지 않는다 [P3 · S]

① `lib/shows/service.ts:143-165`(expireStaleShowOrders, 156-161 두 문장) · `lib/shows/confirm.ts:122-126`(거절 → failed만), `:98-103`(웹훅이 failed를 되살리는 복구), 약 183행(extraGate '티켓이 모두 held') · `lib/shows/adminQueries.ts:67`(showtimeStats.held — hold_expires_at 미고려) · `lib/shows/seed.ts`(peakHeldSeats) · `lib/shows/report.ts` · `lib/shows/conditions.ts`·`queries.ts`(판매는 시각 조건).

② 지금 코드:
```ts
// service.ts:156-161
const result = await db.run(sql`
  UPDATE orders SET status = 'expired', updated_at = unixepoch() WHERE order_no = ${row.orderNo} AND status = 'pending'
`);
if (rowsAffectedOf(result) > 0) {
  await db.run(sql`UPDATE show_tickets SET status = 'void' WHERE order_no = ${row.orderNo} AND status = 'held'`);
```
confirm.ts:122-126 — 거절 코드면 `UPDATE orders SET status = 'failed'`만 하고 티켓은 건드리지 않는다.

③ 왜 문제인가: expire 크론은 pending만 정리하고 orders/tickets를 별도 문장으로 실행한다. 승인 단계 카드 거절로 failed가 된 주문의 held 티켓은 정리 경로가 없다(void 전이 경로 전수: bankDeposit, confirm autoCancel, refund, service expire/comp, showtimeOps — 모두 해당 없음). 판매 집계는 시각 조건이라 안전하지만 관리자 held 수·기획자 현황·정원 축소 가드가 부풀려진다. 둘째 문장이 실패하면 다음 크론이 pending만 보므로 자동 복구되지 않는다.

④ 조건·결과: 표시와 시드 가드 오염. 돈·판매 영향 없음.

⑤ **수정**: (1) 만료 정리를 `db.batch([UPDATE orders ... WHERE status='pending', UPDATE show_tickets SET status='void' ... WHERE EXISTS(orders expired)])`로 묶는다(cancelAwaitingShowDeposit 패턴). (2) failed 주문은 주문 상태를 바꾸지 말고(expired로 덮으면 거절 이력이 사라진다), 같은 유예(hold_expires_at + 30분)가 지난 뒤 크론이 그 티켓만 void로 정리하는 별도 문장을 더한다. confirm 거절 분기에서 즉시 void하지 않는다 — confirm.ts:98-103이 일부러 지원하는 웹훅 복구(failed를 받아 paid로 되살림)가 extraGate '티켓이 모두 held'에 걸려 막히면 자동취소·환불로 간다. (3) showtimeStats.held와 peakHeldSeats에 conditions.ts와 같은 '유효한 held'(`hold_expires_at IS NULL OR > now`) 기준을 쓴다.

⑥ 비고: adjusted — 원 수정안의 'failed를 크론이 expired로'와 '거절 분기에서 즉시 void'는 위험해 뺐다. P2→P3. overflow의 '만료 크론 하루 한 번이라 결제대기 과대 표시' 건은 (3)으로 함께 풀린다.

#### SHW-25. 공연 정의 검증이 en 번역 정합·SNS 링크 형식·등록부 누락을 보지 않는다 [P3 · S]

① `lib/shows/seed.ts:109-161`(validateShowDefinition) · `lib/shows/localize.ts:27-30`(en.performers 인덱스 맞붙임) · `data/shows/index.ts`(SHOW_DEFINITIONS), `data/shows/bakkeoji-anneun-maeumdeul.ts` · `scripts/seed-show.ts`('정의가 없는 slug' exit 2) · `lib/shows/seed.integration.test.ts:12-13` · `lib/shows/structured.ts`.

② 지금 코드: `validateShowDefinition(def)`는 def.en, performers[].sns, showtimes[].startsAt의 미래 여부, ticketTypes 가격 상한을 검사하지 않는다. localize.ts는 `en.performers[i]?.name ?? p.name`, `en.ticketTypeNames?.[t.name] ?? t.name`으로 폴백한다.

③ 왜 문제인가: def.en(performers 수, zoneLabels·ticketTypeNames 키), performers[].sns의 https, 가격 상한을 검사하지 않고, data/shows/*.ts 파일이 SHOW_DEFINITIONS에 모두 등록됐는지 강제하는 테스트가 없다. 현재 유일한 정의는 이상이 없다(실행 확인: performers 4 = en.performers 4, 모든 sns가 https://www.instagram.com/…, 키 일치). 번역 폴백은 lib/shows/CLAUDE.md가 명시한 설계이고, 등록부 누락은 시드 스크립트가 종료 코드 2를 내므로 조용하지 않다. 데이터 파일은 운영자·개발자가 커밋하는 정적 소스라 악의 입력 경로가 아니다.

④ 조건·결과: 새 공연을 올릴 때 영어 화면 오표기·번역 키 오타를 사람의 눈으로만 잡는다. 지금 노출되는 오류는 없다.

⑤ **수정**: validateShowDefinition에 추가: def.en이 있으면 `en.performers.length === performers.length`, zoneLabels 키 ⊂ zones.label, ticketTypeNames 키 ⊂ ticketTypes.name; `performers[].sns`는 `/^https:\/\//`; price 상한. 회차 과거 시각은 신규 생성(existing 없음)일 때만 seedShow에서 경고/오류로 처리한다(기존 공연 재시드가 깨지지 않게). `seed.integration.test.ts`에 data/shows/*.ts를 glob해 모두 SHOW_DEFINITIONS에 등록됐고 validate를 통과하는지 확인하는 케이스.

⑥ 비고: adjusted — 예방 개선이라 P2→P3. 과거 시각 검사는 신규 생성 때만.

#### SHW-26. show_tickets(showtime_id, entry_number)에 유일 인덱스가 없다 (심층 방어 부재) [P3 · M]

① `db/schema.ts:1706-1725`(show_tickets — entry_number UNIQUE 없음, issued_by CHECK 없음), `:1658`(showtimes(show_id, starts_at) 비유일), show_ticket_types(유일 제약 없음) · `lib/shows/confirm.ts:368-382`(배정 UPDATE) · `lib/shows/checkin.ts:19-21`(입장 판정은 code) · `lib/shows/seed.ts:238-245, 252-257`(선조회) · `drizzle/migrations/0045_shows_core.sql` · 선례 `0040_funding_project_services_kind_check.sql`(표 재작성).

② 지금 코드:
```ts
// schema.ts:1713-1724
status: text('status', { enum: showTicketStatusEnum }).notNull().default('held'),
issuedBy: text('issued_by', { enum: showIssuedByEnum }).notNull().default('customer'),
...
statusCheck: check('show_tickets_status_check', sql`${t.status} in (...)`),
showtimeTypeIdx: index('show_tickets_showtime_type_idx').on(t.showtimeId, t.ticketTypeId),
```

③ 왜 문제인가: 정리번호 정합성은 confirm.ts:368-382의 원자적 UPDATE(한 문장 안의 MAX+1 서브쿼리 + `AND entry_number IS NULL` 가드, SQLite 단일 쓰기 직렬화)에만 기댄다 — 요행이 아니라 보장된 성질이고, 처음 계획의 MAX 선읽기+JS 카운터 경합은 이미 고쳐져 confirm.integration.test.ts:261-295가 지킨다. entry_number를 쓰는 UPDATE는 이것 하나, 초대권은 번호 없이 발권, 환불·무효 티켓도 번호 유지로 재사용 없음. 중복이 생기는 길은 수동 DB 수정뿐이고, 생겨도 입장 판정은 유일한 code로 한다. showtimes·show_ticket_types 중복 방지는 시드 선조회뿐이다.

④ 조건·결과: 정리번호는 표시·정렬용이라 중복이 생겨도 잘못 입장시키지 않는다. 현장 안내가 헷갈리는 정도. 지금 터지는 버그는 없다.

⑤ **수정**: 새 마이그레이션에 표 재작성 없는 유일 인덱스만 추가한다. `CREATE UNIQUE INDEX show_tickets_showtime_entry_uq ON show_tickets(showtime_id, entry_number)`(NULL은 SQLite가 서로 다른 값으로 취급하므로 WHERE 불필요), 선택으로 `show_ticket_types(show_id, zone_id, name)` 유일 인덱스와 `showtimes_show_starts_idx`를 유일로 교체. db/schema.ts를 uniqueIndex로 맞추고 drizzle-kit generate가 만든 when을 그대로 쓴다(Date.now() 기반이라 저널 최댓값 1791359895051보다 크다; 유일 인덱스는 옛 코드를 깨지 않으므로 배포 순서 제약 없음). 적용 전에 `SELECT showtime_id, entry_number, count(*) FROM show_tickets WHERE entry_number IS NOT NULL GROUP BY 1,2 HAVING count(*)>1` 등 읽기 전용 중복 조회를 한다. issued_by CHECK와 show_orders↔show_tickets 회차 일치 강제는 표 재작성(PRAGMA foreign_keys=OFF → __new_ → INSERT → DROP → RENAME)이 필요하고 얻는 것이 없으니 하지 않는다.

⑥ 비고: adjusted — '현장에서 같은 번호를 두 사람에게 부른다'는 과장, 네 제안 중 CHECK·복합 FK는 거부, when 재발행·배포 선행 처방은 불필요. P2→P3.

#### SHW-27. revalidateShow는 getServerSideProps 페이지에서 실효가 없는 funding ISR 패턴의 잔재다 [P3 · S]

① `pages/api/admin/shows/[id].ts:48-57`(revalidateShow), 호출 5곳 `:93·154·172·221·227`(set_status·cancel_showtime·change_showtime·confirm_deposit·cancel_unpaid_deposit; issue_comp·refund_tickets에는 없음) · `pages/[locale]/shows/[slug].tsx:91`, `pages/[locale]/shows/index.tsx:87`(getServerSideProps + `Cache-Control: public, s-maxage=30, stale-while-revalidate=60`), `index.tsx:90` 주석 · Next 15.5.27 `api-resolver.js:243-252`.

② 지금 코드:
```ts
async function revalidateShow(res: NextApiResponse, slug: string) {
  for (const path of ['/ko/shows', `/ko/shows/${slug}`]) {
    try { await res.revalidate(path); } catch { /* 재검증 실패가 운영 액션을 실패시키지 않는다 */ }
```

③ 왜 문제인가: 공연 목록·상세는 SSR이라 res.revalidate가 겨냥하는 ISR 프리렌더 캐시가 없다. HEAD 응답이 200이면 오류 없이 지나가므로 조용한 no-op이다('오류를 삼킨다'는 draft 상세처럼 404일 때만). 운영 /ko/shows를 읽기 전용으로 세 번 요청하니 x-vercel-cache가 MISS→HIT으로 바뀌고 age가 늘었다(CDN이 SSR 응답을 캐시한다). Vercel CDN이 x-prerender-revalidate가 붙은 HEAD로 SSR 캐시 엔트리를 갱신하는지는 로컬·읽기 전용으로 확인할 수 없다 — '아무 효과 없음'은 강한 추정이지 실증이 아니다. 실제 비용은 액션마다 HEAD 두 번이 SSR 전체(목록은 1+5N 쿼리)를 직렬로 실행한다는 것.

④ 조건·결과: 기능 손해는 없고 액션당 불필요한 SSR 2회와, 공개 전환 직후 최대 90초(s-maxage 30 + SWR 60) 낡을 수 있다는 사실이 코드에 가려지는 정도.

⑤ **수정**: revalidateShow와 호출 5곳을 지운다. 테스트는 mock만 있어 수정이 필요 없다. 필요하면 관리자 공개 전환 성공 안내에 '공개 화면에는 최대 90초 안에 반영됩니다'를 한 줄 덧붙인다. /en을 추가하거나 새 우회·태그 무효화 장치를 만들지 않는다.

⑥ 비고: adjusted — 원 수정안의 ['/ko','/en'] 확대는 no-op의 대상만 늘리고 '태그 무효화 대안'은 실체가 없다. P3 유지.

#### SHW-28. 공연 단위 취소(shows.status='cancelled')에 도달하는 운영 경로가 없어, 전 회차 취소 공연은 '예정'에 '취소됨' 배지로 남는다 [P3 · S]

① `lib/shows/queries.ts:124-149`(sqlUpdateStatus — draft/published 전용), `:303`, L124 saleState · `pages/api/admin/shows/[id].ts:44·85`(set_status, cancelled 400) · `lib/shows/seed.ts:201`(draft로만) · `lib/shows/availability.ts:64`(nextShowtimeOf — status 미고려) · `components/shows/ShowCard.tsx:26`, `ShowDetailView.tsx`(cancelledNotice), `ShowBookingForm.tsx:238` · 테스트 `queries.integration.test.ts:71·76·137`, `showsAdminApi.integration.test.ts:85-86`.

② 지금 코드:
```ts
const sqlUpdateStatus = (showId: string, status: 'draft' | 'published', now: Date) =>
  sql`UPDATE shows SET status = ${status}, ... WHERE id = ${showId} AND status != 'cancelled'`;
```

③ 왜 문제인가: shows.status='cancelled'는 DB 수작업으로만 만들어진다('cancelled'를 쓰는 곳은 테스트의 직접 SQL뿐). 모든 회차를 취소하면 nextShowtimeOf가 앞날 회차를 돌려주므로 공연은 목록 '예정'에 남고 카드에 '취소됨' 배지만 붙는다. 상세의 cancelledNotice와 ShowBookingForm 분기는 뜨지 않는다. '죽은 코드'는 아니다 — 분기는 테스트가 검증하고 set_status가 cancelled를 거절하는 것도 고정된 의도다. 정확히는 '운영 UI가 없어 DB 수작업으로만 닿는 상태'.

④ 조건·결과: 전 회차 취소 공연이 '예정'에 취소됨 배지로 남고 공연 단위 안내 문구가 없다. 회차별 안내('이 회차는 취소되었습니다')와 환불은 정상.

⑤ **수정**: 쓰기 경로를 만들지 말고 getPublicShowBySlug에서 파생한다. `cancelled: show.status === 'cancelled' || (showtimeRows.length > 0 && showtimeRows.every((s) => s.status === 'cancelled'))`로 두고 saleState 판정(L124)도 같은 값을 쓴다. '모든 회차가 cancelled'일 때만 켜야 지난 회차가 있는 공연이 오표시되지 않는다. 회차를 다시 추가하면 자동으로 풀리므로 되돌림 문제도 없다. `queries.integration.test.ts`에 '전 회차 취소 → cancelled=true·past 분류' 케이스.

⑥ 비고: adjusted — 원 수정안(cancel_showtime에서 '예정 회차가 더 없으면' shows.status를 쓴다)은 지난 회차 둘+마지막 취소 하나인 공연까지 '이 공연은 취소되었습니다'로 뜨고 되돌릴 길도 없어 위험하다고 보아 파생으로 바꿨다.

#### SHW-29. 시드가 가격 0원 티켓타입을 허용하지만 예매 폼은 total>0이 아니면 열리지 않는다 [P3 · S]

① `lib/shows/seed.ts:156` · `db/schema.ts:1671`(CHECK price>=0) · `lib/shows/service.ts:90-106`(totalAmount=0이어도 pending 주문) · `components/shows/ShowBookingForm.tsx:101`.

② 지금 코드:
```ts
// seed.ts:156
if (!Number.isInteger(t.price) || t.price < 0) errors.push(`티켓타입 "${t.name}": 가격은 0 이상의 정수여야 합니다.`);
// ShowBookingForm.tsx:101
const canBook = isOpen && !!ticketType && total > 0;
```

③ 왜 문제인가: 가격 0원 타입은 시드·DB·주문 생성을 통과하지만 폼이 결제를 열지 않아, 설정 실수가 원인 불명의 '예매 버튼이 안 열림'이 된다. 무료 입장은 compQuota 초대권이 맡는 구조다. 현재 data/shows에 0원 타입은 없다.

④ 조건·결과: 운영자 설정 실수 한 번의 진단 비용. 돈·데이터 영향 없음.

⑤ **수정**: seed.ts:156 검증만 `t.price <= 0`(토스 최소액을 확인하면 그 값)이면 오류로 바꾸고 문구에 '무료는 초대권(compQuota)으로 발급하세요'를 적는다. DB CHECK 변경 마이그레이션(SQLite 표 재생성, show_tickets가 참조)과 API 쪽 방어는 하지 않는다.

⑥ 비고: adjusted — 'API 직접 호출 시 좌석을 잡았다 풀린다'는 가격 0만의 문제가 아니고 레이트리밋이 이미 있어 논거에서 뺐다. 토스 최소 결제 100원은 저장소에 근거가 없어 미확인.

#### SHW-30. 코드 주석·문서가 현재 동작과 어긋난다 (확정 센티널, 환불 메일 호출부, mapUrl 마이그레이션 번호) [P3 · S]

① `lib/shows/email.ts:254-258`(확정 센티널 주석), `:312`(sendShowRefundEmail 호출부 주석) · `lib/shows/confirm.ts:235`, `lib/shows/bankDeposit.ts:138`(SEND_PENDING을 같은 batch에서 씀) · `lib/shows/refund.ts:353-`(syncShowCancelsFromToss — 메일 호출 없음) · `db/schema.ts:1622`(mapUrl @deprecated 주석) · `drizzle/migrations/0049_shows_map_links.sql`(실제), 0048은 refund_accounts.

② 지금 코드:
```ts
// email.ts:255-257
 * **전제: 확정 batch(lib/shows/confirm.ts의 orders UPDATE)가 `notification_error`에
 * `send_pending`을 함께 써야 한다.** 지금은 쓰지 않아 이 함수가 0행을 선점하고 `sent:false`로
// db/schema.ts:1622
/** @deprecated 0048에서 `map_links_json`으로 대체. ... */
```

③ 왜 문제인가: confirm.ts:235는 이미 SEND_PENDING을 쓰는데 주석은 '지금은 쓰지 않는다'고 한다. sendShowRefundEmail 주석은 호출부로 syncShowCancelsFromToss를 적지만 실제 호출부는 pages/api/admin/shows/[id].ts:185와 pages/api/shows/refund.ts:77뿐이다(외부·웹훅 취소는 고객 메일이 없다). mapUrl 주석은 마이그레이션 번호가 틀렸다. 거짓 주석이 사고의 직접 원인이 된 전례가 있다(CLAUDE.md '정책 주석은 사업 사실을 뒤집을 수 없다').

④ 조건·결과: 다음 수정자가 '배선이 안 됐다'고 오해해 이중 발송 코드를 더할 수 있다. SEND_PENDING CAS가 이중 발송을 막으므로 실제 위험은 시간 낭비 수준.

⑤ **수정**: email.ts 255-258 주석을 현재 동작(확정 batch가 send_pending을 쓴다)으로 고치고, sendShowRefundEmail 호출부 서술을 실제(pages/api/shows/refund.ts, admin refund_tickets)로 맞추며, schema.ts mapUrl 주석을 0049로 바로잡는다.

⑥ 비고: confirmed. overflow의 마지막 항목(email.ts:255-258)은 이 항목의 구체 위치다. SHW-16 ⑤②와 겹친다.

#### SHW-31. 초대권 판별이 buyer_contact==='comp' 표식에 매달려 있다(조회 두 곳) [P3 · S]

① `lib/shows/adminQueries.ts:176`(isComp), `:247`(CSV 연락처 비움) · `lib/shows/service.ts:224-229`(발급 시 buyer_contact 'comp', buyer_name에 note — 자칭 '임시방편') · 믿을 신호: `lib/shows/queries.ts:256`(issuedBy==='organizer_comp'), adminQueries의 o.tickets.issuedBy · `lib/shows/validation.ts`(normalizeShowContact — 고객 입력으로 'comp' 불가) · `lib/shows/shape.ts`.

② 지금 코드:
```ts
// adminQueries.ts:176
isComp: o.buyerContact === 'comp',
// service.ts:224-229
// buyer_contact에 'comp'를 넣는 것은 ... buyer_name 칸에 note(발급 사유)를 대신 넣는다. ... 임시방편이다
```

③ 왜 문제인가: isComp와 CSV 연락처 비움이 연락처 칸의 특수 문자열에 의존한다. 같은 모듈이 이미 티켓 단위 issuedBy를 갖고 있는데 쓰지 않는다. 고객 입력으로 'comp'를 심을 수는 없고, 현재 파기 크론은 show_orders.buyer_contact를 건드리지 않는다(SHW-9가 들어가면 건드린다).

④ 조건·결과: 지금은 오동작이 없다. 이후 buyer_contact를 건드리는 변경(파기·정규화)이 생기면 초대권 표시와 환불 버튼 노출이 조용히 바뀐다.

⑤ **수정**: L176을 `o.tickets.some((t) => t.issuedBy === 'organizer_comp')`로, L247은 CSV 행의 issuedBy(이미 SELECT에 있음)로 바꾼다. 발급 시 buyer_contact='comp' 기록은 호환을 위해 둔다. 새 컬럼·마이그레이션(show_orders에 note 칸)은 배포 순서 위험 대비 이득이 없어 만들지 않는다.

⑥ 비고: adjusted — 영향 서술이 미래 시나리오라고 바로잡고, CSV 쪽 247행도 같이 고쳐야 반쪽이 아니라고 더했다. SHW-9의 파기 SQL이 들어가면 '초대권' 표식 행의 buyer_contact가 PURGED_MARK로 바뀌므로 그 전에 이 수정이 먼저여야 한다.

#### SHW-32. 회차 취소 직후 결제가 확정되면 환불은 되지만 안내가 '잔여석 소진'으로 나간다 [P3 · M]

① `lib/shows/failMessages.ts:33-35`(ko sold_out), `:70`(en) · `lib/shows/showtimeOps.ts:48-76`(cancelShowtime — 계좌 입금 대기와 paid만, 토스 pending 미처리) · `lib/shows/confirm.ts:203-205`(liveShowtimeCondition), `:334`(sold_out 반환) · `pages/[locale]/shows/fail.tsx` · `components/shows/ShowBookingForm.tsx:172-175`(pendingRef 재사용).

② 지금 코드:
```ts
// failMessages.ts:33-35
case 'sold_out': return '결제 직후 잔여석이 소진되어 티켓을 발권하지 못했습니다. 결제는 자동으로 취소됩니다...';
```
showtimeOps.ts:72-76 — 환불 대상은 paid/partially_refunded만; 결제 대기 pending 주문은 조회하지 않는다.

③ 왜 문제인가: confirmShowOrder가 확정 게이트 실패(회차 취소·시작 후·홀드 만료·정원 초과) 넷을 전부 sold_out으로 돌려주고 안내 문구가 잔여석 소진으로 고정돼 있다. cancelShowtime은 토스 pending 주문을 닫지 않는다. fail 페이지가 홀드를 풀지 않는 것은 사실이나 이 시나리오와 무관한 일반 홀드 특성이다(같은 입력 재시도는 pendingRef로 주문을 재사용하고, 홀드는 10분 뒤 자연히 세지 않는다 — 별도 지적감).

④ 조건·결과: 회차 취소 10분 안에 결제하던 고객이 결제 후 환불과 틀린 사유를 본다. 돈은 자동으로 환불된다(SHW-6의 pending_retry가 아닌 한). 드문 경합.

⑤ **수정**: 가장 싼 수정은 confirmFailureMessage(ko)와 confirmFailureMessageEn의 sold_out 문구를 '결제 직후 회차 상태나 잔여석이 바뀌어 티켓을 발권하지 못했습니다. 결제는 자동으로 취소됩니다'처럼 게이트 실패 전반을 가리키게 고치는 것(SHW-6 ⑤③의 문구 변경과 한 번에). 더 하려면 cancelShowtime이 같은 회차의 pending 주문을 expired로 닫는다(success 페이지 confirm이 invalid_status로 토스 승인 호출 전에 멈추므로 승인·환불 왕복이 사라진다). fail 페이지 홀드 해제는 별도 이슈로 분리한다.

⑥ 비고: adjusted — sold_out이 네 게이트를 뭉뚱그린다는 점과 fail 페이지 홀드 건의 분리를 검증자가 더했다. P3.

#### SHW-33. 회차 취소 환불이 이전 부분환불의 수수료까지 돌려주며, 계좌 입금 주문 경로와 금액이 다르다 [P3 · S]

① `lib/shows/showtimeOps.ts:103-110`(remaining 산식), `:11-25`(머리 주석 '잔액 기준 전액 환불') · `lib/shows/refund.ts:123`(계좌 경로: cancelled면 살아 있는 선택 티켓 unit_amount의 100%) · `lib/shows/showtimeOps.integration.test.ts:54-57`(10일 전 100%만) · `lib/shows/CLAUDE.md`.

② 지금 코드:
```ts
const remaining = Math.max(0, remainingRefundable(order, payments) - checkedInValue);
if (remaining <= 0) continue;
```

③ 왜 문제인가: 토스 경로의 회차 취소 환불은 '총액-기환불-체크인분'(수수료 포함)이고, 계좌 입금 경로는 살아 있는 티켓 unit_amount의 100%다. 이전에 70%로 17,500만 환불된 2장(각 25,000) 주문이면 토스는 32,500이 나가 이전 수수료 7,500도 돌아가고 주문은 refunded로 닫히는데, 계좌 입금 주문은 같은 시나리오에서 25,000만 나간다. 수수료가 있는 부분환불 뒤의 취소는 주석·테스트 어디에도 다뤄지지 않았다.

④ 조건·결과: 티켓 한 장의 수수료분만큼 토스 주문이 더 환불된다. 고객에게 유리한 방향이고 드문 경우. 정책이 정해져 있지 않다는 점이 문제다.

⑤ **수정**: 운영자가 결정하고 lib/shows/CLAUDE.md에 한 줄로 적는다. '수수료는 돌려주지 않는다'로 정하면 showtimeOps.ts:109를 `Math.min(remainingRefundable(order,payments) - checkedInValue, Σ(issued·미체크인 티켓 unit_amount))`로 제한해 두 경로를 맞춘다. '돌려준다'로 정하면 계좌 경로가 맞지 않으므로 그쪽을 고친다. 어느 쪽이든 `showtimeOps.integration.test.ts`에 noticeAt을 회차 1일 전(70%)으로 한 부분환불 뒤 회차 취소 케이스를 더해 결과를 고정한다.

⑥ 비고: adjusted — '문서에 없다'는 부정확(머리 주석이 설계를 적음), 결제수단별 불일치가 구체 근거. P3.

#### SHW-34. 공연 목록 조회가 공연 수에 비례해 쿼리를 늘린다(관찰 항목, 현 시점 조치 없음) [P3 · M]

① `lib/shows/queries.ts:294-299`(listPublicShows) · 호출처 `pages/[locale]/shows/index.tsx:94`, `pages/[locale]/booking/index.tsx:210` · `pages/api/shows/availability.ts`(getPublicShowBySlug 하나만 — 해당 없음).

② 지금 코드:
```ts
const rows = await getDb().query.shows.findMany({ where: (s, { ne }) => ne(s.status, 'draft') });
const loaded = await Promise.all(rows.map((r) => getPublicShowBySlug(r.slug, now)));
```
(주석: 공연 수가 한 자릿수라 N+1이 문제 되지 않는다)

③ 왜 문제인가: 공연마다 shows·zones·ticketTypes·showtimes·loadUsedBy 5쿼리를 병렬로 실행해 총 1+5N이고, 지난 공연도 past에 영구히 남는다. 원 지적의 '/api/shows/availability에도 걸린다'는 틀렸다.

④ 조건·결과: 현재 공연 1개라 영향이 없다. 공연이 수십 개가 되면 캐시 미스마다 수백 쿼리가 나간다.

⑤ **수정**: 지금은 바꾸지 않는다(루트 CLAUDE.md '한 번 쓰고 말 일에 추상화를 붙이지 말 것'). 공연이 5개를 넘길 때 shows·showtimes를 한 번씩, loadUsedBy를 공연 id 목록(IN)으로 한 번에 읽는 목록 전용 조회로 바꾸고, 지난 공연은 잔여석 계산을 생략한다.

⑥ 비고: adjusted — 관찰 항목으로만 남긴다.

#### SHW-35. 티켓 환불 태그에 전체 id를 싣는 설계는 5장 이상에서 토스 길이 한도를 넘는다 — SHW-2를 고칠 때 sync의 스코프 복원을 같은 수정으로 바꿔야 한다 [P3 · M]

① `lib/shows/refund.ts:75-76`(키 생성), `:249`(cancelReason), `:393-407`·`:433-447`(sync 파싱, else 분기 437-447) · `lib/shows/tossCodes.ts:11-15`(parseLeadingTag, 정규식 `^\[#([^\]]+)\]`) · `lib/booking/toss.ts:79`(Idempotency-Key 300자 주석) · `lib/shows/shape.ts:30`(orderNo 21자), `lib/shows/limits.ts:10` · `db/schema.ts:289`(refunds.status enum ['done','failed']) · 테스트 `refund.integration.test.ts:240-297`, `fakeToss.ts:82-111`(길이 미검증).

② 지금 코드:
```ts
const ticketRefundIdempotencyKey = (orderNo: string, ticketIds: string[]): string =>
  `tkt-refund:${orderNo}:${[...ticketIds].sort().join(',')}`;   // 75-76
…
cancelReason: `[#${idempotencyKey}] 공연 티켓 환불`,              // 249
…
if (tag && tag.startsWith(TICKET_REFUND_TAG_PREFIX)) {
  const rest = tag.slice(TICKET_REFUND_TAG_PREFIX.length);
  …
  if (tagOrderNo === orderNo && idsPart.length > 0) { scopedTicketIds = idsPart.split(','); }
```

③ 왜 문제인가: 웹훅 스코프 복원이 태그 안의 전체 티켓 id에 기대고 있다. 키는 33+33n-1자, cancelReason은 키+12자(4장 176자, 5장 209자, 9장 키 329자). 현재 코드는 태그에 전체 id를 싣고 sync가 그대로 복원하므로 이 연쇄로 지금 깨지는 것은 없다. 단순 절단으로 고치면 닫는 `]`가 먼저 잘려 parseLeadingTag가 null을 돌려주고 scopedTicketIds=null → '주문의 refunding 전부'를 쓸어 담는 else 분기로 떨어진다 — '0행으로 조용히 실패'가 아니라 티켓별 스코프 회귀(refund.integration.test.ts:240-297이 막는 사고)다. 0행이 되는 것은 id를 괄호 안에서 잘라 `]`를 다시 붙인 경우뿐.

④ 조건·결과: 현재 코드 기준 지금 깨진 것은 없다(잠복 설계 결합). 근본 결함은 SHW-2의 심각도로 다룬다. 이 항목은 그 수정이 sync를 함께 바꾸지 않을 때의 회귀 위험이다.

⑤ **수정**: 새 표나 refunds.status='pending'을 쓰지 말고(enum 위반, `status='done'` 합산이 곳곳에 있음, 수동 마이그레이션 부담) 태그에 티켓 id 앞 8hex만 싣는다: `tkt-refund:<orderNo>:<p1,p2,…>`(10장이어도 키 122자, cancelReason 134자). sync는 `^[0-9a-f]{8}$` 검증 뒤 `UPDATE show_tickets … WHERE order_no=? AND substr(id,1,8) IN (…) AND status='refunding'`로 스코프한다(order_no로 이미 좁혀져 8hex 충돌은 사실상 없다). FakeToss.cancelPayment에 cancelReason≤200·idempotencyKey≤300 검증을 넣고, refund.integration.test.ts에 6장 환불·NETWORK_ERROR·웹훅 대사 시나리오와 기존 테스트의 fault 키(`cancel:tkt-refund:…`) 갱신을 추가한다.

⑥ 비고: adjusted — 절단의 실제 동작(0행이 아니라 광역 sweep)을 바로잡고, refunds.status='pending'·별도 표 제안을 거부했다. 토스 cancelReason 200자는 SHW-2 검증에서 문서로 확인됐다. SHW-2의 ⑤가 이 수정을 이미 포함한다.

#### SHW-36. revokeScanLink에 회차 범위가 없다 — 사용처가 생길 때 revokeReportLink와 같은 시그니처로 맞춘다(현재 호출 0건) [P3 · S]

① `lib/shows/scanLink.ts:77-84` · 비교 `lib/shows/reportLink.ts:61-65` · `pages/api/admin/shows/[id].ts`(머리 주석 15-22 — 소속 확인 규칙; revoke_scan_link 액션 없음) · `pages/admin/shows/[id].tsx:232-237, 364` · `lib/shows/scanLink.integration.test.ts`, 참고 `report.integration.test.ts:50-53`.

② 지금 코드:
```ts
export const revokeScanLink = async (id: string, now: Date = new Date()): Promise<boolean> => {
  const result = await getDb()
    .update(showScanLinks)
    .set({ revokedAt: Math.floor(now.getTime() / 1000) })
    .where(and(eq(showScanLinks.id, id), sql`${showScanLinks.revokedAt} IS NULL`));
// 비교: lib/shows/reportLink.ts:61-65
export const revokeReportLink = async (showId: string, id: string, …) => … .where(and(eq(showReportLinks.id, id), eq(showReportLinks.showId, showId), …))
```

③ 왜 문제인가: 미사용 함수라 현재 영향은 없다. 관리자 액션으로 배선하면서 id만으로 폐기하면 'API는 본문의 회차·티켓·주문이 이 공연에 속하는지 매번 확인한다'는 규칙에서 revokeReportLink와 갈린다. 링크 id는 랜덤 32hex라 열거가 어렵고 호출자는 인증된 관리자다 — 소속 확인은 보안 경계가 아니라 잘못된 id를 걸러 주는 일관성 장치다.

④ 조건·결과: 배선 시점의 실수 방지용 일관성 문제. 보안 경계 이슈가 아니다.

⑤ **수정**: SHW-11에서 폐기 액션을 만들 때 시그니처를 `revokeScanLink(showtimeId, id, now?)`로 바꾸고 WHERE에 `eq(showScanLinks.showtimeId, showtimeId)`를 더한다. 액션은 `showtimeOf(b.showtimeId)`로 소속을 확인한 뒤 호출하고, `scanLink.integration.test.ts`에 '다른 회차 id로는 폐기되지 않는다'를 추가한다. 호출처가 생기기 전에 시그니처만 먼저 바꾸는 별도 작업은 하지 않는다.

⑥ 비고: adjusted — 지금 깨진 것은 없고 '나중에 배선할 때의 주의' 메모. 같은 자리를 다른 축(CQ 코드 품질·구조·중복·타입 안전)도 지적: 공연 입장 스캔 링크는 발급만 되고 폐기 수단이 없다 (revokeScanLink 호출처 0). SHW-11 ⑤에 이미 반영돼 있다.

#### SHW-37. 토스 환불 성공 뒤 기록 batch가 던지면 500으로 끝나고 환불 메일·운영자 알림이 빠진다(웹훅 대사로 상태는 맞춰진다) [P3 · S]

① `lib/shows/refund.ts:287-309`(recordStatements batch 306, settleOrderStatus — try 없음), `:229-238`(계좌 경로 try/catch), `:44-56`(머리 주석 — 설계 선택), `:101-103`(재시도는 not_issued), `:390-447`(웹훅 대사) · 호출부 `pages/api/shows/refund.ts:73`, `pages/api/admin/shows/[id].ts:182`(try 없음) · 모델 `lib/funding/lineRefund.ts` · `lib/ops/healthCheck.ts:466-487`(auto_cancel_pending 점검 모양).

② 지금 코드:
```ts
const recordStatements = [ db.run(sql`INSERT INTO refunds … SELECT … WHERE ${cancelledTotal} > …`), db.run(sql`UPDATE show_tickets SET status = 'refunded' …`) ];
await db.batch(recordStatements as [typeof recordStatements[number], ...typeof recordStatements]);

const orderStatus = await settleOrderStatus(order.id, input.orderNo);
return { status: 'refunded', amount: totalAmount, orderStatus, refundVia: 'payment' };
// 비교 229-238(계좌 경로): try { await db.batch(bankStatements…) } catch (error) { … revertClaim … return { status:'rejected', … } }
```

③ 왜 문제인가: batch(와 이어지는 settleOrderStatus)가 던지면 API가 500을 돌려주고 티켓은 refunding에 머문다. 계좌 경로의 catch는 '돈이 아직 안 움직였다'는 이유로 선점을 되돌리는 것이고 토스 경로에는 되돌림이 불가능하므로 대칭 비교는 성립하지 않는다 — 이 구조는 lib/funding/lineRefund.ts와 같고 머리 주석이 그 선택을 명시한다. 자기 치유: 이어서 오는 CANCELED 웹훅이 tkt-refund 태그로 refunds 델타·티켓 refunding→refunded·주문 상태를 맞춘다(NETWORK_ERROR 테스트 210-236이 같은 경로 검증). 고객이 재시도하면 not_issued로 거절된다. 그 경로는 메일을 보내지 않고, stuck refunding을 감시하는 헬스체크도 없다.

④ 조건·결과: 토스 성공 직후 DB 쓰기 오류라는 드문 조건. 고객은 잠깐 오류 화면을 보고, 웹훅이 오면 상태가 맞춰진다. 환불 메일·운영자 알림은 나가지 않는다.

⑤ **수정**: batch와 settleOrderStatus를 try/catch로 감싸 `console.error`에 orderNo·ticketIds·amount·transactionKey를 남기고 기존 `{ status: 'toss_unknown' }`을 돌려준다(두 호출부가 이미 202/504로 처리하고 문구도 '취소됐다면 기록은 곧 자동으로 맞춰집니다' 취지 — 새 결과 변종·API 변경 불필요). 별도로 healthCheck에 'refunding 상태가 지속된 티켓' 점검(healthCheck.ts:466-487과 같은 모양)을 더하면 이 경로와 NETWORK_ERROR 후 웹훅이 끝내 안 오는 경로(SHW-3)를 한 번에 덮는다. `refund.integration.test.ts`에 batch 실패 주입 사례.

⑥ 비고: adjusted — 원 수정안(새 RefundOutcome·202·운영자 메일 필드)은 필요 이상으로 크다. P3. healthCheck 항목은 SHW-3 ⑤④와 하나다.

#### SHW-38. 회차 시각 변경 테스트가 이름과 달리 sales_close_at·재변경 시 previous_starts_at·스캔 링크 만료 연장을 단언하지 않는다 [P3 · S]

① `lib/shows/showtimeOps.integration.test.ts:127-137` · `tests/api/admin/shows/showsAdminApi.integration.test.ts:138-147`(제목만 약속) · `lib/shows/showtimeOps.ts` 약 187-209(changeShowtime 세 동작) · `lib/shows/time.ts`(salesCloseAt, time.test.ts가 보호).

② 지금 코드:
```ts
it('회차 시각을 바꾸면 previous_starts_at이 보존되고 판매마감이 비례 재계산된다', async () => {
  …
  await changeShowtime(showtimeId, newStartsAt, new Date());
  const after = await db.query.showtimes.findFirst(…);
  expect(after?.previousStartsAt).toBe(before!.startsAt);
  expect(after?.startsAt).toBe(Math.floor(newStartsAt.getTime() / 1000));
});
```

③ 왜 문제인가: changeShowtime을 다루는 두 테스트가 모두 startsAt/previousStartsAt만 보고, 제목이 약속한 판매마감 재계산은 단언이 없다. 두 번째 변경에서 previous_starts_at 보존(COALESCE), 스캔 링크 만료 연장(`MAX(expires_at, new+86400)`)도 테스트되지 않는다. 해당 줄이 빠지거나 상수가 틀려도 CI가 초록이다. 현재 코드는 올바르다(newSalesCloseAtSec 계산·UPDATE 확인).

④ 조건·결과: 회귀를 못 잡는 테스트 공백.

⑤ **수정**: 같은 테스트에 `expect(after?.salesCloseAt).toBe(Math.floor(salesCloseAt(newStartsAt).getTime()/1000))`, 두 번째 changeShowtime 뒤 previousStartsAt이 최초값인지, show_scan_links 행을 하나 심어 `expires_at >= newStartsAtSec + 86400`인지를 단언한다. 폐기·만료 링크 처리(SHW-19)는 그 수정이 들어간 뒤 같은 테스트에 추가한다 — 현재 동작은 만료 링크도 되살아나고 폐기 링크는 revoked_at으로 계속 폐기라, '그대로' 단언은 수정 전엔 틀린다. admin API 테스트의 제목도 실제 단언에 맞춘다.

⑥ 비고: adjusted — '유일한 테스트'는 틀리고(admin API 테스트도 있음), 테스트 공백이라 P2→P3.

#### SHW-39. 취소된 회차의 refundDueAmount가 토스 환불 실패 주문까지 '계좌 입금 접수 대기'로 합산하고, 그 토스 실패분을 지속적으로 알리는 점검이 없다 [P3 · S]

① `lib/shows/adminQueries.ts:72`(refundDueAmount) · `pages/admin/shows/[id].tsx:287`(표시), `:301-303`(window.alert), `:469-478`('입장 전 티켓 환불' 확인창), `:491-545`(RefundAccountPanel '송금 완료' — 계좌 present일 때만) · `lib/ops/healthCheck.ts:758-783`(bank-deposit만), `:779-781·836` · `lib/shows/showtimeOps.ts:34-40`(주석), failedOrders continue · `lib/shows/refund.ts:185-239` · `lib/shows/CLAUDE.md` '계좌 입금' 절.

② 지금 코드:
```ts
// pages/admin/shows/[id].tsx:303
if (Array.isArray(bank) && bank.length > 0) window.alert(`계좌 입금 주문 ${bank.length}건은 토스로 돌려줄 수 없습니다. 고객 환불 계좌로 직접 송금한 뒤 "송금 완료"를 눌러 기록하세요: ${bank.join(', ')}`);
// lib/ops/healthCheck.ts:778-779  '… 고객에게 연락해 계좌를 받아 송금한 뒤 관리자 > 공연 상세에서 티켓을 "환불"로 기록해 주세요.'
// lib/shows/adminQueries.ts:72
CASE WHEN st.status = 'cancelled' THEN (SELECT COALESCE(SUM(t.unit_amount), 0) FROM show_tickets t WHERE t.showtime_id = st.id AND t.status = 'issued' AND t.issued_by = 'customer') ELSE 0 END as refundDueAmount
```

③ 왜 문제인가: (a) 계좌 입금 회차 취소 주문의 정당한 경로는 둘이다 — 고객이 내 티켓에서 환불 계좌를 적으면 운영자가 '송금 완료', 계좌 접수 전에 먼저 돌려주려면 계좌를 받아 송금하고 '입장 전 티켓 환불'로 기록. 알림창은 첫 번째만 말하고 '송금 완료'는 계좌 접수 뒤에만 보이는 점이 불완전하지만 행동 지점의 화면 문구는 서로 맞는다('세 갈래로 다르다'는 과장). (b) refundDueAmount는 결제수단 필터 없이 취소 회차의 issued 고객 티켓 합이라, cancelShowtime이 토스 환불에 실패한 주문(티켓 issued로 남음)도 '돌려줄 계좌 입금 … (환불 계좌 접수 대기)'로 합산된다. 카드 결제 고객은 환불 계좌를 적을 일이 없는데 운영자는 '접수 대기'로 읽는다. healthCheck는 bank-deposit 결제만 감시해, 회차 취소 때 토스 환불이 실패한 주문은 window.alert와 이 오표시된 숫자 말고는 지속 알림이 없다.

④ 조건·결과: 회차 취소 때 토스 환불이 거절된 카드 주문이 있을 때만 생긴다. 운영자가 그 금액을 계좌 고객의 접수 대기로 오해해 재환불을 놓칠 수 있다.

⑤ **수정**: ① refundDueAmount를 `EXISTS (SELECT 1 FROM payments p JOIN orders o ON o.id=p.order_id WHERE o.order_no=t.order_no AND p.payment_key LIKE 'bank-deposit:%')`로 계좌 입금분만 세고, 토스 주문분은 `tossRefundPendingAmount`로 따로 구해 '토스 환불 실패 — 다시 환불'(입장 전 티켓 환불 버튼)로 표시한다. ② healthCheck에 '취소된 회차 + 비계좌 결제 + issued 고객 티켓' 점검(758-783 쿼리의 NOT 판). ③ 알림창 문구를 '환불 계좌를 적은 주문은 "송금 완료"로, 계좌 접수 전에 먼저 돌려주려면 계좌를 받아 송금한 뒤 "입장 전 티켓 환불"로 기록하세요'로 고친다(healthCheck.ts:781 문구와 한 벌).

⑥ 비고: adjusted — '문구가 세 갈래'는 과장, 금액 오표시와 지속 알림 부재가 실체. P3. SHW-4의 resume이 들어가면 ①의 '다시 환불' 버튼은 그 일괄 경로로 대체된다.

#### SHW-40. `mark_refund_sent`는 환불 계좌 행이 없거나 DB 오류가 나도 ok를 돌려준다 — 화면은 '송금 완료로 기록했어요'라고 보이지만 기록은 없다 [P3 · S]

① `lib/payments/refundAccount.ts:109-116`(markRefundAccountRefunded — rowsAffected 무시, 예외 삼킴), `:100-106`(ON CONFLICT DO UPDATE) · `pages/api/admin/shows/[id].ts`(mark_refund_sent 분기) · `pages/admin/shows/[id].tsx`(status==='present'일 때만 버튼; run()이 router.replace) · `lib/funding/cancel.ts:215`(삼킴·0행에 의존).

② 지금 코드:
```ts
if (b.action === 'mark_refund_sent') {
  if (state !== 'paid') return res.status(409).json({ ok: false, message: '계좌 입금 주문이 아닙니다.' });
  await markRefundAccountRefunded({ kind: 'show', orderNo }, now);
  return res.status(200).json({ ok: true });
}
// lib/payments/refundAccount.ts:110-116 — update … 실패는 삼키고 로그만, 0행도 성공.
```

③ 왜 문제인가: 환불 계좌 행이 없을 때(보존기간 파기 뒤의 낡은 화면·API 직접 호출)와 update가 DB 오류로 실패했을 때 모두 핸들러가 200 ok를 돌려준다. 탭 둘 경합은 원인이 아니다 — 재접수는 ON CONFLICT DO UPDATE라 행이 계속 존재하므로 다른 탭의 mark_refund_sent는 1행을 갱신하고 refunded_at이 찍힌다. 실제 위험은 DB 오류 삼킴 쪽이 더 크다.

④ 조건·결과: 운영자에게 성공 알림이 뜨지만 refunded_at이 비어 있다. 성공 뒤 화면이 새로 읽혀 '송금 완료' 버튼이 그대로 보이므로 곧바로 드러나고, 다음 날 헬스체크가 같은 건을 다시 알리는 정도.

⑤ **수정**: funding 경로(삼킴·0행 무시 — '계좌 없는 수기 건이면 아무 일도 없다'는 전제)는 건드리지 않고, 관리자 핸들러용으로 rowsAffected를 돌려주고 DB 오류는 던지는 함수를 따로 둔다(예: `markRefundAccountRefundedStrict → Promise<boolean>`). 공연·예약·믹싱 세 핸들러는 false면 409 `접수된 환불 계좌가 없어서 기록하지 못했어요. 새로고침해 주세요.`(origin/main이 해요체로 바뀌는 중이므로 문구 톤을 맞춘다), 던지면 500으로 답한다.

⑥ 비고: adjusted — 경합 시나리오는 틀렸고, `Promise<boolean>` 일괄 변경은 funding과 충돌해 별도 함수로. P3.

#### SHW-41. 결제 완료 페이지(GET)가 확정된 주문의 번호만 알면(amount·paymentKey는 아무 값이어도) 주문 언어를 'en'으로 덮어쓴다 [P3 · S]

① `pages/[locale]/shows/success.tsx:187-189` · `lib/shows/orderLocale.ts`(saveShowOrderLocale — onConflictDoNothing) · `lib/shows/confirm.ts:94-96` · `pages/api/shows/orders.ts`(주문 생성 때 로케일 저장).

② 지금 코드:
```ts
// 주문 언어는 주문 생성 때 남기지만, 혹시 빠졌으면(표 적용 전 주문 등) 영어 결제 완료 화면에서 한 번 더 남긴다 —
// 메일보다 먼저(바로 아래 sendShowTicketEmail이 이 값을 읽는다). 이미 있으면 아무 일도 없다.
if (en) await saveShowOrderLocale(orderId, 'en');
```

③ 왜 문제인가: confirmShowOrder가 CONCLUDED_STATUSES면 paymentKey도 금액도 비교하기 전에 already_confirmed를 돌려주므로(SHW-1), `/en/shows/success?paymentKey=x&orderId=TKT-…&amount=0`만으로 한국어 주문에 show_order_locales 영어 행이 생기고(한국어 주문은 행이 없어 onConflictDoNothing으로 들어감) 이후 티켓·환불·회차 취소 메일이 영어가 된다. 같은 경로가 관리 토큰이 든 manageUrl도 내려보내는 것이 더 큰 문제다. '비콘 API로 분리한 payments/failed 규칙과 어긋난다'는 근거는 약하다 — 그 비콘은 booking·funding fail 화면 용이고 이 GET 자체가 결제 승인이라는 상태 변경 페이지다.

④ 조건·결과: 로케일 덮어쓰기 자체는 고객에게 영어 메일이 가는 정도.

⑤ **수정**: 우선순위는 뿌리 수정(SHW-1)이다: already_confirmed를 돌려주기 전에 요청의 paymentKey가 이 주문의 payments 행과 일치하는지 확인한 뒤에만 manageUrl과 로케일 보정을 처리한다. 그와 별개로 보정은 `result.status === 'confirmed'`일 때만 하도록 좁힌다(웹훅이 먼저 확정한 주문은 주문 생성 때 이미 저장된 값을 쓰므로 영향 없음 — 전환기용 보정이라 수용 가능).

⑥ 비고: adjusted — '주문번호·금액만 맞으면'이 아니라 존재하는 확정 주문번호면 통과한다고 바로잡았다. SHW-1의 파생물이라 P3.

#### SHW-42. 관리자 '회차 취소'는 상태 검사가 읽고-쓰기 분리라 두 요청이 동시에 통과하면 cancelShowtime이 두 번 돌고 고객에게 취소 메일이 두 통 간다 — showtimes UPDATE의 rowsAffected를 보지 않는다 [P3 · S]

① `lib/shows/showtimeOps.ts:51-54` · `pages/api/admin/shows/[id].ts` 약 125-130(affected 선수집), `:128`(409) · `lib/shows/email.ts:326-336`(중복 방지 없음) · 클라이언트 busy 가드(pages/admin/shows/[id].tsx).

② 지금 코드:
```ts
await db.run(sql`
  UPDATE showtimes SET status = 'cancelled', cancelled_at = ${nowSec}
  WHERE id = ${showtimeId} AND status = 'scheduled'
`);
// 결과(rowsAffected)를 쓰지 않고 계속 진행한다. 호출부 pages/api/admin/shows/[id].ts:128
if (showtime.status !== 'scheduled') return res.status(409).json(…)   // 요청 시작 시점의 값
```

③ 왜 문제인가: UPDATE가 조건부라 두 번째 실행은 0행이지만 함수는 그대로 주문 목록을 읽고 환불을 돈다(토스는 같은 멱등 키 (orderNo, remaining, 'showtime-cancel')라 replay, 델타 INSERT는 0행이라 원장은 안전). 호출부는 affected를 다시 읽어 sendShowtimeCancelledEmail을 또 보내고, closedDepositOrders는 비어 두 번째 응답의 집계가 첫 번째와 달라 운영자가 혼란스럽다. 겹치려면 두 요청이 첫 요청의 UPDATE 직전 수~수십 ms 안에 도착해야 한다(UPDATE가 환불 루프보다 먼저 상태를 뒤집는다). 클릭 중복은 busy 가드가 막고, 멀티 탭·멀티 운영자 동시 클릭 정도가 남는다.

④ 조건·결과: 중복 메일과 엇갈린 결과 집계. 돈은 안전하다.

⑤ **수정**: `cancelShowtime`에서 UPDATE 결과를 `rowsAffectedOf`로 확인해 0행이면 `{ alreadyCancelled: true, refundedOrders: 0, failedOrders: [], bankRefundOrders: [], closedDepositOrders: [] }`를 즉시 돌려주고, 호출부는 그 경우 메일을 보내지 않고 409로 답한다. 호출처가 핸들러뿐이고 핸들러가 이미 비-scheduled 회차를 409로 막으므로 0행 조기 반환이 복구 경로를 해치지 않는다 — 단 SHW-4의 resume 액션을 넣으면 그 경로는 alreadyCancelled를 '이어서 처리'로 해석해야 하므로 반환값 설계를 같이 잡는다.

⑥ 비고: confirmed, P3. SHW-4·SHW-7과 같은 함수 반환 타입.

#### SHW-43. 이메일 필수 검증과 어긋난 주석이 여러 곳에 남아 있다(service.ts 52, validation.ts 62) — 'hasEmail' 분기는 도달하지 않는다 [P3 · S]

① `lib/shows/service.ts:52-53` · `lib/shows/validation.ts:62`(JSDoc), `:86-87`(필수 검증 — #442 첫 커밋부터) · `pages/[locale]/shows/success.tsx:55-56`(ko), `:115-116`(en) · `lib/shows/service.integration.test.ts:53-70` · 빈 이메일 경로: issueCompTickets만.

② 지금 코드:
```ts
/** 티켓 메일 수신 주소(선택). 없으면 ''로 저장돼 메일은 나가지 않는다 — 관리 링크는 결제 완료 화면에 뜬다. */
buyerEmail?: string;
// lib/shows/validation.ts:86-87
// 티켓(QR)은 메일로 전달되므로 필수다.
if (email === '' || email.length > 254 || !isEmail(email)) return { ok: false, message: m.email };
// pages/[locale]/shows/success.tsx:56
{emailSent === false && !hasEmail && ' 이메일을 적지 않으셔서 메일은 보내지 않았습니다 — 아래 링크를 꼭 저장해 주세요.'}
```

③ 왜 문제인가: API 경계는 처음부터 이메일을 필수로 검증하는데 service.ts 주석('선택… 없으면 빈 문자열')과 validation.ts:62 JSDoc('이메일은 선택이지만…')이 반대로 말한다('선택 시절'이 있었던 게 아니라 주석이 처음부터 틀렸다). success 화면의 !hasEmail 안내는 결제 화면을 거치는 주문에는 생기지 않는다(빈 이메일은 초대권뿐).

④ 조건·결과: 유지보수 혼선. 주석을 믿고 이메일을 선택 입력으로 고치면 검증과 충돌한다.

⑤ **수정**: 주석만 고친다. service.ts:52는 '티켓 메일 수신 주소 — API 경계가 필수로 검증한다. 도메인 함수는 빈 값도 받는다(테스트·초대권)'로, validation.ts:62는 '이메일은 필수이고 형식이 맞아야 한다'로. buyerEmail을 필수 타입으로 바꾸지 않는다(호출 테스트 약 50곳·10개 파일이 깨진다). hasEmail 분기는 지우려면 해요체 변경이 들어오는 origin/main과 충돌하니 병합 뒤에 정리한다.

⑥ 비고: adjusted — 원 수정안(buyerEmail 필수화)은 과하다. P3.

#### SHW-44. 쓰이지 않는 enum·헬퍼가 남아 있고 판매 상태 라벨·원화 포맷이 copy.ts와 i18n.ts에 이중으로 있다 [P3 · S]

① `db/schema.ts:1674`(showOrderStatusEnum — 선언뿐, 실제 orderStatusEnum 249행과 다름), `:1716-1717`(compensated_*), shows.noticeKey · `lib/shows/time.ts:10-17`(isSalesOpen·isShowtimeLive — time.test.ts에서만) · `lib/shows/copy.ts:7-13`(SALE_STATE_LABELS·formatWon) ↔ `lib/shows/i18n.ts:29-32`(SALE_STATE.ko — export 안 됨, formatShowWon) · `pages/[locale]/booking/index.tsx`(copy.ts 유일 사용처) · 선례 `schema.ts:1622`(mapUrl @deprecated).

② 지금 코드:
```ts
export const showOrderStatusEnum = ['pending', 'paid', 'partially_refunded', 'refunded', 'expired', 'failed'] as const;
// 1716-1717
compensatedAmount: integer('compensated_amount').notNull().default(0),
compensatedAt: integer('compensated_at'),
```

③ 왜 문제인가: showOrderStatusEnum은 사용처가 없고 실제 주문 상태(awaiting_deposit·deposit_cancelled·auto_cancel_pending)와 달라 읽는 사람을 틀리게 안내한다. time.ts의 두 함수는 테스트에서만 쓰인다. copy.ts의 두 값은 i18n.ts와 같은 표를 따로 갖고 booking 허브만 그쪽을 쓴다. compensated_*·notice_key는 쓰는 코드가 없다(showtimeOps.ts·seed.ts는 주석에서만 언급).

④ 조건·결과: 수정이 한쪽에만 들어가면 공연 화면과 예약 허브의 상태 라벨이 갈린다. 죽은 enum은 오해를 부른다. 죽은 컬럼은 SELECT 폭을 조금 넓힐 뿐 실해는 없다.

⑤ **수정**: 코드만 정리한다: showOrderStatusEnum 삭제, time.ts의 두 함수와 해당 테스트 삭제, copy.ts의 SALE_STATE_LABELS·formatWon을 `showCopy('ko').saleState`·`formatShowWon(n)`로 대체하고 booking/index.tsx import를 맞춘다(SALE_STATE는 export되지 않으므로 showCopy 경유). compensated_*·notice_key는 마이그레이션으로 지우지 말고 schema.ts에 mapUrl과 같은 `@deprecated … 컬럼은 남아 있지만 아무도 읽거나 쓰지 않는다` 주석만 단다(수동 마이그레이션·전체 컬럼 SELECT 구조에서 컬럼 삭제는 순서가 어긋나면 공연 전체가 깨진다).

⑥ 비고: adjusted — 컬럼 삭제 제안 거부, SALE_STATE 재export는 그대로 안 됨. P3.

#### SHW-45. 토스 응답 유실 뒤 웹훅 대사가 기록하는 환불은 고객이 시작한 것이어도 requested_by가 'admin'이다 — 주체를 알려 주는 정보가 없다 [P3 · S]

① `lib/shows/refund.ts:409-416`(sync INSERT, 413 requested_by), 주석('태그 유무로 admin/webhook 출처') · `lib/booking/confirm.ts:191`(자동 취소도 'admin') · requested_by를 읽는 곳: booking admin-serialize뿐(shows 없음) · `lib/shows/confirm.ts`, `lib/shows/showtimeOps.ts`.

② 지금 코드:
```sql
INSERT INTO refunds (id, payment_id, amount, reason, requested_by, toss_transaction_key, status)
SELECT lower(hex(randomblob(16))), ${paymentRow.id}, …,
       ${tag ? `토스 취소 대사(${tag})` : '토스 외부 취소 동기화'}, ${tag ? 'admin' : 'webhook'},
```

③ 왜 문제인가: `tkt-refund:` 태그는 고객 셀프 환불과 관리자 환불이 똑같이 쓰고, NETWORK_ERROR 경로는 환불 행도 actor도 남기지 않으므로 대사 시점에는 주체를 알 방법이 없다. 코드는 태그가 있으면 'admin'(=우리 쪽이 시작한 취소)으로 적도록 의도해 두었다. 원 지적이 제안한 'autocancel:·showtime-cancel:은 admin, 그 외는 customer' 매핑은 관리자 환불을 customer로 틀리게 적는다.

④ 조건·결과: 해당 환불 행의 requested_by가 실제 주체와 다를 수 있다. 이 값을 읽어 집계하는 shows 코드는 없어서 현재 실해는 없다.

⑤ **수정**: 낮은 가치의 건으로 두고, 주석에 '여기서 admin은 우리 쪽이 시작한 취소(고객 셀프 포함)'를 명시하는 것으로 종결해도 된다. 정확히 하려면 refundShowTickets가 취소 사유(cancelReason)에 주체를 싣고(예: `[#tkt-refund:…] 공연 티켓 환불 · customer`) 대사가 이를 읽어 복원한다 — SHW-2/35의 태그 형식 변경과 같은 자리라 그때 같이 넣으면 비용이 거의 없다. 'tkt-refund → customer' 임시 매핑은 쓰지 않는다.

⑥ 비고: adjusted — 의도된 설계이고 집계 영향 근거가 없으며 제안 매핑이 틀렸다. SHW-22에서 requested_by를 `admin:${actor}`로 바꾸면 이 칸의 의미가 한 번 더 바뀌므로 같은 커밋에서 정리한다.

**클린 판정**
- `lib/shows/service.ts` createShowOrder/issueCompTickets: 판매창·구역 정원·티켓타입 한도(+comp 한도) 세 게이트를 첫 INSERT의 WHERE에 걸고 하위 INSERT는 EXISTS로 잇는 단일 batch 구조라 마지막 1석 경합에서 초과 판매가 없다(`lib/shows/race.integration.test.ts`가 같은 시나리오를 시험). 티켓타입·회차 소속 검증과 회차별 격리도 맞다. 2라운드에서 lib/shows 전체 26스위트·188테스트가 실제로 통과했다(`npx jest lib/shows`).
- `lib/shows/conditions.ts` ↔ `queries.ts` loadUsedBy ↔ `availability.ts`: 점유 집합(issued·refunding·만료 전이 아닌 held, hold_expires_at IS NULL 포함)이 세 곳에서 일치해 화면 숫자와 판매 결과가 갈리지 않는다.
- expireStaleShowOrders: `o.status = 'pending'`만 보고 awaiting_deposit·deposit_cancelled·auto_cancel_pending을 건드리지 않는다(다른 크론·lazy 만료 경로에도 awaiting_deposit을 바꾸는 코드가 없음을 grep으로 확인, `lib/payments/bankDeposit.ts` 머리 주석대로).
- confirmShowOrder 확정 게이트: 회차 생존·티켓 held 유지·자동취소 미완료·나를 뺀 정원/한도 재측정을 UPDATE의 WHERE에 걸고, 게이트에 걸리면 autoCancelShowApproval로 즉시 환불하는 설계. payments INSERT를 맨 앞에 두어 payment_key UNIQUE로 중복 확정을 막고, auto_cancel_pending 소유권 CAS도 일관된다(healthCheck가 멈춘 건을 잡는다).
- `lib/shows/bankDeposit.ts` 세 전이(입금 안내·입금 확인·미입금 취소): 조건부 UPDATE + 같은 batch의 EXISTS/NOT EXISTS 가드, liveShowtimeCondition, payment_key `bank-deposit:` NOT EXISTS/UNIQUE. 두 번 눌러도 1행. recordDepositGuideResult가 awaiting일 때만 notification_error를 쓴다. 환불 경로는 isBankDepositPayment로 토스를 부르지 않는다.
- 소문자 308 대응: `middleware.ts:256-258`은 pathname만 소문자화하고 search는 건드리지 않아 `?token=`이 보존된다. manage 조회·환불 API·withdraw·payments/failed가 주문번호를 대문자로 정규화하고, 스캔·현황 토큰은 소문자 hex(randomBytes(24)), DB에는 SHA-256 해시만 둔다. 주문 부재와 토큰 불일치를 같은 404로 답한다.
- 스캔·현황 링크 검증(verifyScanLink·verifyReportLink): 토큰 길이 16~128, 해시 조회, 만료·폐기를 요청마다 확인, 실패 사유를 구분하지 않는 404/401. 현황 링크는 revokeReportLink가 공연 소속을 확인하며 집계만 싣고 개인정보·주문번호는 싣지 않는다. 체크인 API는 회차 불일치(wrong_showtime)를 거르고 입장 기록은 조건부 UPDATE다.
- 관리자 API(`pages/api/admin/shows/[id].ts`) 소속 검증: showtimeOf·ownTicket·showtimeIds 집합으로 다른 공연의 회차·티켓·주문 조작을 막고, 명단 CSV는 toCsv(수식 인젝션 방어, `lib/funding/csv.ts`)+접속기록+no-store. 관리자 세션 쿠키는 sameSite strict, 인증은 authenticateAdminApi.
- refundShowTickets: 티켓 id 집합 기반 멱등 키(과소 환불 방지), 티켓 선점 CAS(issued→refunding), 체크인·초대권·중복 id·소속 검증, 델타 INSERT로 웹훅 이중 기록 방지, 확정 거절 시 revertClaim, 계좌 입금 환불의 계좌 암호화 선행·저장 실패 시 롤백(cancelReason 길이와 기록 batch 예외 처리는 위 지적).
- `pages/api/shows/orders.ts`·`refund.ts`: 레이트리밋(IP당 10/시간), 형식 검증(validateCreateShowOrderPayload — 이메일 필수·해외 번호 허용·수량 상한), published 공연 확인, 초대권 환불 차단, withdraw 경로의 토큰 검증. consumeRateLimit은 DB 오류 시 허용으로 떨어져 주문 생성을 막지 않는다.
- 메일 HTML escape: rows·heading·cta는 buildEmailLayout이, paragraphs·notices는 호출부가 escapeHtml(buyerName, 티켓 종류, preheader, hero alt). `emailHtml.test.ts`가 태그 주입 사례를 검증한다. 운영자 알림(결제 완료·고객 환불·입금 신청·입금 전 취소)은 audience operator + 관리자 딥링크.
- 마이그레이션 0045·0047·0049·0050·0051: 새 표·nullable 컬럼 추가뿐이라 배포 순서에 안전하고, 0050(별도 표)·0051 읽기·쓰기는 try로 감싸 표 부재 시 한국어 동작/'적용 전' 표시로 떨어진다. `lib/analytics/privatePaths.ts`·`next.config.mjs`에 success/fail/manage/scan/report 비공개 경로 등록, RESERVED_SHOW_SLUGS가 리터럴 라우트를 덮는다. scan 페이지의 `<main>`·min-h-screen·v2 미설정은 `tests/pages/pageScaffold.test.ts:49-61`에 이유와 함께 예외 등록.
- `seed.ts`: 멱등 쓰기, 가격 변경 차단(팔린 티켓타입), 정원 축소 가드(peakHeldSeats), 기존 회차·구역·티켓타입 불삭제, 이미지 파일 존재·OG 1200×630 치수 검증, 부제 ' — ' 거부. `data/shows/bakkeoji-anneun-maeumdeul.ts`는 가격을 상수로 두고 ko/en 출연진 순서·수가 같다.
- `localize.ts`·`orderLocale.ts`·`i18n.ts`: 영어 화면은 DB를 바꾸지 않고 조회 직후 덮어쓰며, 번역 없는 칸은 한국어로 남는다. 메일 언어는 show_order_locales를 따르고 운영자 알림은 localize:false로 한국어 고정.

**읽지 못한 범위**
- 1라운드는 테스트를 실행하지 않았다(npx jest 미실행). P0·P1 판정은 코드 정독과 booking/funding 대응 코드·테스트 이름 대조에 근거하며, 재현 테스트는 fix 항목으로 제안했다(2라운드는 lib/shows 26스위트를 실행했다).
- 토스 Idempotency-Key 헤더 길이 제한은 공식 문서에서 확인하지 못했다(cancelReason 200자만 문서로 확인). 티켓 9장 이상 환불은 키 길이도 영향을 받을 수 있다. CANCELED 웹훅 발송 조건도 저장소 주석(`lib/booking/toss.ts:79-81`)에 의존했다.
- 읽지 못했거나 훑기만 한 파일: `components/shows/ShowFacts.tsx`, `ShowVenueMap.tsx`, `RefundPolicyList.tsx`, `ShowCard.tsx` 하단, `ShowBookingForm.tsx` 300행 이후, `ShowTicketManage.tsx` 1~100행(문구 표), `lib/shows/i18n.ts`의 영어 문구 표 전체, `lib/shows/emailEn.ts`, `lib/shows/failMessages.ts` 영어부, `pages/admin/shows/[id].tsx` 440행 이후(환불 계좌 패널), `pages/admin/shows/index.tsx` 하단.
- 공유 모듈은 공연이 부르는 부분만 읽었다: `lib/payments/bankDepositOrders.ts`, `refundAccount.ts`(saveRefundAccount·암호화, 1~140행), `lib/booking/toss.ts`(request·cancelPayment·fetchPayment), `lib/booking/webhook.ts`의 ticket 분기와 재조회 머리, `lib/booking/cancel.ts`의 remainingRefundable·refundIdempotencyKey, `lib/email/resend.ts`, `pages/api/cron/purge-orders.ts`의 파기 함수 등록 목록, `middleware.ts`의 308·CSP 규칙, `lib/ops/healthCheck.ts`의 공연 관련 절. `components/payments/*`(PaymentMethodPicker·BankDepositGuide·RefundAccountFields·usePaymentCheckout 본문), `lib/payments/refundAccountView.ts`, `lib/payments/depositGuideThrottle.ts`, `components/maps/KakaoMap.tsx`, `components/common/LineupCard`·`MobileStickyCta`는 읽지 않았다.
- 운영 DB(Turso)·Vercel·토스 콘솔을 조회하지 않았다 — refunding·held·auto_cancel_pending 잔존 건, 마이그레이션 실제 적용 상태, 실결제 흐름(`lib/shows/CLAUDE.md`가 '눌러 본 적 없다'고 적은 부분)은 검증하지 못했다.
- 브라우저에서 화면을 열어 보지 않았다 — ShowBookingForm·ShowTicketManage·관리자 화면의 실제 동작(위젯 숨김·환불 계좌 입력·알림창 순서)은 코드와 컴포넌트 테스트로만 판단했다.
- `tests/pages/privateLinkNavigation.test.ts`, `tests/payments/sharedCheckout.guard.test.ts`, `components/ui/SectionHeading.test.tsx`(V2_FILES)는 열지 않았다. `lib/privacy/orderRetention.ts`는 refund_accounts 파기(232-245)만 읽었다(SHW-9 범위).
- 이전 리뷰 문서 세 편(`docs/code-review-2026-08-24.md`·`-round2.md`·`2026-09-08-seo-aeo-geo.md`)을 grep한 결과 shows·ticket·공연 언급이 없어 '이전 리뷰 미처리' 항목은 없다.

**미검증 후보(overflow)**
- lib/shows/refund.ts:449-452 — 외부(토스 콘솔) 전액 취소 대사가 `status='issued'` 티켓을 전부 refunded로 넘겨 체크인된 티켓까지 환불 상태가 된다(cancelShowtime은 체크인 티켓을 제외하는데 대사는 제외하지 않음). `AND checked_in_at IS NULL`을 더하고 입장분은 주문 상태를 partially_refunded로 둘지 정책 확인.
- lib/shows/showtimeOps.ts:101-110 vs lib/shows/refund.ts:177-182 — 관리자 회차 취소와 고객 셀프 환불이 같은 순간 겹치면 `refunding` 티켓이 cancelShowtime의 void 대상에서는 빠지지만 `remaining`에는 포함돼 전액이 토스로 나가고, 뒤이은 고객 환불은 거절·revertClaim으로 티켓이 issued로 되살아난다(취소된 회차에 '사용 가능' 티켓, refundDueAmount 오집계). cancelShowtime이 refunding 티켓 단가를 remaining에서 빼거나, 선점이 풀릴 때까지 재시도하도록.
- components/shows/ShowTicketManage.tsx:30-36 — `T.notices`에 `auto_cancel_pending`이 없어 그 상태의 주문은 '결제 대기' 배지 티켓만 보인다. '결제 확인 중입니다 — 잠시 뒤 다시 열어 주세요' 문구를 추가.
- pages/api/admin/shows/[id].ts:234-246 — 스캔 링크 TTL 상한 72시간은 공연 며칠 전에 미리 발급해 스태프에게 보내는 운영을 막는다(발급 시점 기준 만료). '회차 시작 +24시간까지' 옵션(expires_at = max(now+ttl, starts_at+86400))을 두면 changeShowtime의 연장 로직과도 일관된다.
- lib/shows/adminQueries.ts:97 `AdminTicketRow.entryNumber: string | null`(포맷된 문자열) vs lib/shows/queries.ts:165 `ManageTicketView.entryNumber: number | null` — 같은 개념이 타입이 다르다. 숫자로 내리고 화면에서 formatEntryNumber를 부르도록 통일.
- pages/admin/shows/[id].tsx:340 — `startsAt: \`${newStart}:00+09:00\`` 문자열 조립은 datetime-local 값에 초가 붙는 브라우저(step 설정 시)에서 `…:00:00:00+09:00`이 되어 400. `new Date(\`${newStart}+09:00\`)`로 ISO를 만들어 보내고 서버가 파싱.
- pages/api/admin/shows/[id].ts:32-41 REFUND_REASON_MESSAGE에 zero_amount·no_payment·exceeds_remaining·concurrent_change·toss_failed·refund_account_invalid가 없어 '환불할 수 없습니다(reason)'로 떨어진다 — lib/shows/refundMessages.ts의 한국어 표를 재사용하면 두 표 유지가 사라진다.
- vercel.json:43 — 만료 크론이 하루 한 번(18:30 UTC)이라 pending 주문이 최대 24시간 '결제 대기'로 남는다(좌석은 시각 조건으로 풀림). 관리자 '결제대기' 숫자가 하루 종일 과대 표시된다. 시간당 실행으로 바꾸거나 adminQueries held 집계에 `hold_expires_at > now` 조건을 두어 화면 숫자만이라도 맞춘다.
- lib/shows/scanAccess.ts:22 `scanActorId(label)` — 같은 라벨로 두 링크를 발급하면 되돌리기 권한(2분 창)을 공유한다. 라벨 대신 링크 id를 actor에 넣으면 분리된다.
- components/shows/ShowBookingForm.tsx:144-169 — 계좌 입금 신청은 toss 경로의 pendingRef 재사용이 없어 서버가 201을 돌려준 뒤 네트워크 오류로 응답을 못 받으면 재클릭 때마다 새 awaiting_deposit 주문이 생겨 좌석을 기한 없이 겹쳐 잡는다(1라운드 #5의 상한과 함께, 같은 입력의 awaiting 주문이 있으면 그 manageUrl로 보내는 서버 측 중복 판정 필요).
- lib/shows/email.ts:255-258 주석 '지금은 쓰지 않아 이 함수가 0행을 선점하고 sent:false로 끝난다 — 호출부 배선 때 같이 고칠 것'은 confirm.ts:235가 SEND_PENDING을 쓰는 지금 사실과 다르다(1라운드 #23 '확정 센티널' 항목의 구체 위치).

### FND. 펀딩 — 후원·결제·명단·보존

P0 0 · P1 0 · P2 8 · P3 27, 미검증 0

#### FND-1. 결제 미완료(expired·failed) 주문의 이름·연락처·이메일(펀딩은 배송지·메시지까지)이 법정 보존 근거 없이 5년 남는다 [P2 · M]

**어디** — `lib/privacy/orderRetention.ts:146-171`(`purgeExpiredOrderCustomerData`), `lib/funding/retention.ts:137-138`, `lib/funding/service.ts:275-299`, `data/privacyPolicy.ts`(3항·8항), `pages/api/cron/purge-orders.ts`, `lib/funding/policy.ts`(`FUNDING_TERMS_VERSION`).

**지금 코드** — 펀딩 1년 파기는 전달 완료가 있어야만 시작한다:

```ts
// lib/funding/retention.ts:137-138
isNotNull(fundingPledges.deliveredAt),
lt(fundingPledges.deliveredAt, rewardBoundary),
```

유일한 다른 경로는 주문 생성·갱신 5년이고 상태를 보지 않는다:

```ts
// lib/privacy/orderRetention.ts:153-154
lt(orders.createdAt, boundary),
lt(orders.updatedAt, boundary),
```

그런데 배송지는 결제 전, 주문 생성 순간에 저장된다:

```ts
// lib/funding/service.ts:293
${s?.name ?? null}, ${s?.phone ?? null}, ${s?.postcode ?? null}, ${s?.address1 ?? null}, ${s?.address2 ?? null}, ${s?.memo ?? null},
```

**왜 문제인가** — '결제하기'를 누르는 순간 `orders`(이름·전화·이메일)와 `funding_pledges`(배송지 6칸·응원 메시지·`public_name`)가 INSERT된다. 그 뒤 `expireStalePledges`(service.ts:317-326, 홀드 900초)·`confirm.ts:264`(고객 거절→failed)·`bankTransfer.ts:155-158`(입금 전 취소→expired)로 닫히면, `retention.ts:137-138`의 `delivered_at` 조건에는 영영 안 걸리고 `orderRetention.ts:153-154`의 5년(상태 무관)만 남는다. 같은 파일 72-85행이 `payment_fail_message`에 대해 '계약 불성립 사건이라 전자상거래법 5년 대상이 아니다'라고 이미 판정해 두었는데, 그 주문의 신원 컬럼에는 같은 판정이 적용되지 않았다. 처리방침 3항(`privacyPolicy.ts:132`)이 '예약·결제 기록 5년'을 고지하므로 약속 위반은 아니고, 개인정보보호법 제21조①(목적 달성 시 파기)과 코드가 어긋난 설계 정합 문제다. 펀딩만의 문제가 아니다 — 세션·믹싱·공연 주문도 같은 expired/failed를 쓴다(`lib/booking/service.ts:107,201,285` · `lib/shows/service.ts:157`).

**어떤 조건에서 어떤 결과** — 결제창을 닫거나 카드가 거절된 모든 체크아웃의 개인정보(펀딩은 배송지·메시지 포함)가 결제 건수가 아니라 시도 건수만큼 5년 쌓인다. 펀딩이 2026년 시작이라 1년 기준이어도 첫 파기는 2027년, 5년이면 2031년 — 지금 터지는 사고가 아니라 제21조① 정합과 유출 시 피해 범위의 문제다.

**수정**
1. `lib/privacy/orderRetention.ts`에 `purgeUnpaidOrderCustomerData(now)` 추가 — `type` 무관하게 `orders.status IN ('expired','failed')`(공연·예약·믹싱의 `deposit_cancelled`도 포함 검토) `AND updated_at < now-1년 AND NOT EXISTS(payments WHERE order_id = orders.id) AND customer_name <> PURGED_MARK` → `customer_name/phone/email = PURGED_MARK`, `updated_at`은 건드리지 않음. 기간은 30일이 아니라 `PAYMENT_FAIL_MESSAGE_RETENTION_YEARS`(1년)와 같은 상수를 공유한다 — 실패 사유를 1년 두는 이유(뒤늦은 카드사 민원 대응)가 신원이 있어야 성립하고, 계좌 입금 늦은 입금(`confirmBankDeposit`이 expired를 받음)·웹훅 되살림(`confirm.ts:193`)도 같은 창 안에 들어온다.
2. 펀딩 배송지·메시지·표시 이름·숨김 스냅샷은 새 UPDATE를 쓰지 말 것 — 기존 `purgeFundingPersonalDataOfPurgedOrders`가 `customer_name = PURGED_MARK`를 조건으로 같은 항목을 지우므로, `pages/api/cron/purge-orders.ts`에서 새 `run('결제 미완료 주문의 고객 정보 파기')`을 `purgeExpiredOrderCustomerData` 뒤·`purgeFundingPersonalDataOfPurgedOrders` 앞에 끼우면 같은 회차에 자동으로 따라간다(pledge 없는 failed 주문, `admin-list.ts:17-20`도 자연히 포함).
3. `data/privacyPolicy.ts` 3항·8항 양쪽에 '결제가 완료되지 않은 채 만료·실패한 신청의 정보는 1년 뒤 파기' 문장 추가(8항은 펀딩 배송지·메시지까지 명시). ko 처리방침은 동의 해시 대상이므로 `FUNDING_TERMS_VERSION`을 `funding-terms-2026-10-10`(개정일 날짜 판본; `-rN`은 같은 날 2회차부터)으로 올린 뒤 `UPDATE_FUNDING_TERMS_BASELINE=1 npx jest content/fundingTerms.baseline.test.ts`, 커밋 메시지에 바뀐 조항 기록.
4. 테스트: `lib/privacy/orderRetention.test.ts`에 'expired/failed 1년 뒤 표식, paid·pending·1년 미만·payments 행 있는 주문은 그대로, 펀딩 배송지는 후속 파기가 같은 회차에 지움' 케이스, `tests/api/cron/purgeOrders.test.ts`의 파기 수·순서 단언 갱신.
5. 청약 기록이 '계약에 관한 기록'에 드는지는 법률 판단이므로 `retention.ts` 머리 주석과 같은 수준으로 '변호사 확인 필요' 전제를 함수 주석에 남긴다.
6. 연쇄 제약: 만료된 온라인 계좌 입금 신청은 늦은 입금 확정·이름 대조에 쓰이므로 토스 만료와 다른 보존 창이 필요하다 — FND-30 참조.

**비고** — 검증자가 P1→P2로 내림: 처리방침이 5년을 이미 고지해 약속 불일치가 아니고, 첫 파기 시점이 2027년 이후라 당장의 사고가 아니다. 원안의 30일 창은 같은 파일의 `PAYMENT_FAIL_MESSAGE_RETENTION_YEARS=1` 설계와 충돌하고, funding 전용 함수는 세션·믹싱·공연 주문에 같은 구멍을 남기므로 1년·전 주문 종류로 고쳤다. 테스트 경로는 `tests/api/cron/purgeOrders.test.ts`가 맞다. 판본 `-r4`는 같은 날 2회차 규칙이라 날짜 판본으로 바꿨다.

#### FND-2. md 프로젝트와 같은 slug의 승인된 DB 프로젝트가 있으면 개설자 경로로 타인 후원자 PII가 열린다(코드 가드 없음) [P2 · S]

**어디** — `lib/funding/creatorShipping.ts:147-148`(`loadCreatorShipping`), `:261-263`(`loadFulfillmentGate`), `lib/funding/fulfillment.ts:80-86`(`setFulfillment`의 creator 분기), `lib/funding/repository.ts`, `lib/funding/CLAUDE.md:326-334`.

**지금 코드**

```ts
// lib/funding/fulfillment.ts:80-86
if (actor.kind === 'creator') {
  const project = await db.query.fundingProjects.findFirst({
    where: (t, { and, eq }) => and(eq(t.slug, pledge.projectSlug), eq(t.reviewStatus, 'approved')),
  });
  if (!project || project.creatorId !== actor.creatorId) { return { ok: false, code: 'forbidden', ... } }
}
// lib/funding/creatorShipping.ts:147-148
const [project] = await db.select().from(fundingProjects)
  .where(and(eq(fundingProjects.id, projectId), eq(fundingProjects.creatorId, creatorId))).limit(1);
```

**왜 문제인가** — 개설자 배송 조회·CSV·발송 상태 쓰기 세 경로가 모두 'slug로 `funding_projects`(approved) 조회'만 하고 파일 프로젝트(`content/funding/<slug>.md`)의 존재를 보지 않는다. 파일이 DB보다 우선하므로, 같은 slug의 md가 나중에 추가되면 후원이 그 slug로 들어오고 DB 개설자에게 md 쪽 후원자의 배송지가 열린다. 에러·로그가 없다. 막혀 있는 쪽은 반대 방향뿐이다 — `reviewDecision.ts:174`와 `creatorProjectWrite.ts:205`는 개설자가 md가 쓰는 slug를 고르는 것만 막는다. `lib/funding/CLAUDE.md:326-334`도 '반대 방향은 아무 데도 막혀 있지 않다. 코드 가드는 없다'고 스스로 적는다.

**어떤 조건에서 어떤 결과** — 운영자가 승인된 DB 프로젝트와 같은 slug의 md를 추가하는 실수 하나로, 한 프로젝트 후원자 전원의 이름·연락처·주소가 다른 개설자에게 노출되고 발송 상태까지 쓸 수 있다. 발생 확률은 낮지만 감지는 하루 한 번 헬스체크뿐이다.

**수정** — `lib/funding/repository.ts`에 slug가 파일 프로젝트로 가려지는지 판정하는 이름 붙은 헬퍼(예: `isShadowedByFile(slug) = getFundingProject(slug) != null`)를 두고(`projects.ts`의 동기 함수를 직접 부르지 말라는 CLAUDE.md 규칙 때문에 repository.ts에 둔다), `loadCreatorShipping`(null 반환), `loadFulfillmentGate`(null 반환), `setFulfillment`의 creator 분기(forbidden) 세 곳에서 부른다. `creatorStats.ts:84`는 건드리지 않는다 — 의도적으로 `getFundingProjectAsync`(파일 우선)로 공개 페이지와 같은 프로젝트를 보게 한 집계 전용(개인정보 없음)이다. `fulfillment.integration.test.ts`·`creatorShipping.integration.test.ts`에 'md와 같은 slug의 DB 프로젝트 개설자는 forbidden/null' 케이스를 추가하고, `lib/funding/CLAUDE.md`의 '코드 가드는 없다' 문단을 갱신한다.

**비고** — 검증자가 P2 유지. 원안의 creatorStats 가드는 틀려서 뺐다. 같은 자리를 다른 축(FNC 펀딩 — 개설자·심사·배송·정산·관리자)도 지적: 승인된 DB 프로젝트와 같은 slug의 md가 나중에 생기면 개설자 배송·발송·정산·현황이 md 후원까지 모은다 — 런타임 가드가 없고 감지는 하루 한 번 헬스체크뿐.

#### FND-3. 펀딩 본문에도 스토리용 키워드 자동 링크가 적용되어 사바하 예산표 항목 이름이 바뀌어 보인다 [P2 · S]

**어디** — `components/funding/ProjectDetailView.tsx:215-217`, `components/MarkdownRenderer.tsx:339-341`, `components/markdown/autoLinks.ts`, `data/internalLinks.ts:169`, `content/funding/sabbaha-slung.md`, `lib/funding/creatorContent.ts`.

**지금 코드**

```tsx
// components/funding/ProjectDetailView.tsx:215-217
<article className="prose prose-lg max-w-none dark:prose-invert">
  <MarkdownRenderer content={project.content} locale="ko" />
</article>
// components/MarkdownRenderer.tsx:339-341
linkPhoneNumbers(autoLinkKeywords(content, currentSlug, currentLocale))
```

실측(`autoLinkKeywords`를 `sabbaha-slung.md` 본문에 실행):

```
| 사진·[뮤직비디오 제작 완전 가이드](/stories/music-video1) | 1,000,000원 |
```

**왜 문제인가** — `autoLinkKeywords`(스토리용 187개 키워드 → `/stories`·`/guides` 링크)가 펀딩 본문에도 적용된다. 라이브 사바하 예산표의 '사진·뮤직비디오'가 '사진·뮤직비디오 제작 완전 가이드'(스튜디오 가이드 링크)로 렌더되고, 라이브 HTML에도 `href="/ko/stories/music-video1"`이 실려 있다. 개설자가 쓴 글에 스튜디오 가이드 링크가 자동으로 끼어 보증처럼 읽힌다 — `creatorContent.ts`가 막는 것과 같은 이유다.

**어떤 조건에서 어떤 결과** — 후원자에게 보이는 비용 항목 이름이 바뀌고, 후원 페이지에서 스튜디오 가이드로 나가는 이탈 링크가 생긴다. 사바하는 지금 오픈 중이다. `linkPhoneNumbers`는 스튜디오의 `CANONICAL_FACTS` 번호만 링크하므로(강정 본문 212행의 010-2379-0760은 평문 그대로) tel/mailto 리드 오염은 개설자가 직접 그런 링크를 쓸 때만 생기는 잠재 사안이다.

**수정** — `MarkdownRenderer`에 `autoLink?: boolean`(기본 true) 같은 작은 옵션을 추가하고 `ProjectDetailView`에서 `false`를 넘겨 `autoLinkKeywords`를 건너뛴다(`linkPhoneNumbers`는 유지). tel/mailto 클릭 트래킹은 같은 옵션으로 끌 수 있지만 지금 내용에는 해당이 없어 필수는 아니다. 회귀 방지로 `content/funding/*.md` 본문 전체에 대해 렌더 전 문자열에 `](/stories/`·`](/guides/`가 생기지 않는다는 content 테스트를 추가한다(`ProjectDetailView.test.tsx`는 MarkdownRenderer를 목으로 가려 못 잡는다). 콘텐츠 줄을 바꾸는 우회('사진·`뮤직비디오`')는 임시 처방일 뿐이다.

**비고** — 검증자가 재현으로 확인. tel/mailto 트래킹 부분은 현재 발현하지 않는 잠재 사안으로 정정했다.

#### FND-4. 프로젝트 FAQ(화면 + FAQPage JSON-LD)가 되돌린 '여러 리워드 담기'를 안내하고 계좌 입금·환불 계좌를 빠뜨린다 [P2 · S]

**어디** — `lib/funding/faq.ts:28-42`, `content/funding/sabbaha-slung.md:151`, `pages/[locale]/funding/[slug]/index.tsx:189,220`(FAQ 렌더·`faqItems` 구조화 데이터), `pages/[locale]/funding/terms.tsx`(제8·10조).

**지금 코드**

```ts
// lib/funding/faq.ts:31
answer:
  '리워드를 담고(여러 리워드를 한 번에 담을 수 있습니다) 결제 정보를 입력하면 그 자리에서 바로 결제됩니다. 결제는 신청 후 15분 안에 완료해야 하며, ...',
// 환불 답: '환불은 접수일부터 3영업일 이내에 결제하신 수단으로 처리됩니다.'
```

```md
<!-- content/funding/sabbaha-slung.md:151 -->
결제는 카드나 간편결제로 하시면 되고, 회원 가입은 필요 없습니다.
```

**왜 문제인가** — 2026-10-04 `ae5c62a952`가 담기 방식을 되돌려 위저드는 `items:[{rewardId,quantity}]` 하나만 보낸다(`PledgeWizard.tsx:47-60` 주석, 429행). 계좌 입금은 `506f02c921`(10-04)로 재도입됐다. 그런데 첫 답은 '여러 리워드를 한 번에 담을 수 있습니다 … 그 자리에서 바로 결제', 환불 답은 '결제하신 수단으로', 취소 답은 '온라인 결제는 확인 페이지에서 바로 취소'다. 실제 흐름은 리워드 하나 선택, 카드·간편결제 또는 계좌 입금이며, 계좌 입금 취소·환불은 환불 계좌를 적어 요청한 뒤 송금이다(약관 제8·10조). 라이브 사바하 HTML의 FAQ 본문과 FAQPage JSON-LD 둘 다에 '여러 리워드를 한 번에 담을 수 있어요'가 있다.

**어떤 조건에서 어떤 결과** — 모든 프로젝트 상세 페이지의 화면과 구조화 데이터가 실제 결제 흐름·약관과 다르게 안내되고, 검색·AI 답변에 틀린 안내가 인용된다.

**수정** — `faq.ts` 첫 답을 '리워드를 고르고 후원자 정보를 입력한 뒤 카드·간편결제 또는 계좌 입금을 선택합니다. 카드·간편결제는 신청 후 15분 안에 결제를 마쳐야 하며 …'로, 취소 답의 '바로 취소'는 '카드·간편결제는 확인 페이지에서 바로 취소되고 계좌 입금은 환불 계좌를 적어 요청하면 …'으로, 환불 답은 '카드·간편결제는 결제하신 수단으로, 계좌 입금은 적어 주신 환불 계좌로 접수일부터 3영업일 이내'로 고친다. `sabbaha-slung.md:151`도 계좌 입금을 포함하도록 맞춘다. 재발 방지는 FAQ를 약관 해시에 넣지 말고 `lib/funding/faq.test.ts`에 '여러 리워드'가 없고 '계좌'가 있다는 단언을 둔다 — FAQ는 동의 문서가 아니라 `terms_version` 증거 의미를 흐리면 안 된다.

**비고** — 검증자가 P2 유지. 원안의 'FAQ를 `content/fundingTermsHash.ts` 직렬화에 넣는다'는 틀려서 뺐다(`faq.ts` 머리 주석의 '해시 대상이 아니다'는 의도). FND-5와 뿌리가 같다.

#### FND-5. 고객 FAQ와 lib/funding/CLAUDE.md가 되돌린 '여러 리워드 담기'를 현재형으로 말한다 + 죽은 필드·prop 잔재 [P2 · S]

**어디** — `lib/funding/faq.ts:31`, `lib/funding/CLAUDE.md:178-216`, `pages/api/funding/pledges.ts:89-92`(`serverNow`), `components/funding/RewardModal.tsx:23,49`(`checkout` prop), `lib/funding/shape.ts:33`(`addOn`), `tests/api/funding/pledges.test.ts:85-98`, `content/funding/keep-singing-for-palestine.md`.

**지금 코드**

```ts
// pages/api/funding/pledges.ts:89-92
// 홀드를 만든 서버 시각. 클라이언트는 (holdExpiresAt − serverNow)로 ... (components/funding/PledgeWizard.tsx holdDurationMs).
serverNow: now.toISOString(),
// components/funding/RewardModal.tsx:23,49 — 호출부는 checkout을 한 번도 넘기지 않는다
checkout?: boolean;
// lib/funding/shape.ts:33
addOn: boolean;   // 소비처 없음(md의 addOn: true만 남음)
```

`lib/funding/CLAUDE.md:178,206,216` — '### 한 주문에 여러 리워드 …', '결제 화면은 담은 것만 먼저', '말은 셋만 쓴다 — "담기" …'.

**왜 문제인가** — `faq.ts:31`(상세 페이지 FAQ·구조화 데이터)이 '여러 리워드를 한 번에 담을 수 있습니다'라고 안내하지만 화면은 한 리워드만 고른다(#470 되돌림). `lib/funding/CLAUDE.md` 178-216행은 되돌림(`ae5c62a952`)이 이 파일을 건드리지 않아 담기·함께 받기·버튼 규칙을 현재형으로 설명한다. 코드에는 소비처 없는 `serverNow` 응답 필드(소비처는 `PledgeWizard.test.tsx:113`의 목 응답뿐, `holdDurationMs`는 #144에서 사라짐), `RewardModal`의 `checkout` prop(`pages/[locale]/funding/[slug]/index.tsx:225`가 넘기지 않음), `shape.ts`·md·테스트에서만 읽히는 `addOn`이 남아 있다.

**어떤 조건에서 어떤 결과** — 고객에게 없는 기능을 안내하고, 다음 작업자가 CLAUDE.md를 믿고 없는 기능을 전제로 코드를 짠다.

**수정**
1. 1순위: `faq.ts:31`에서 괄호 문구를 지운다(약관 해시 게이트 대상이 아니다). FND-4의 문구 수정과 한 번에 한다.
2. 2순위: `lib/funding/CLAUDE.md` 0042·0043 절을 '서버·DB는 여러 줄을 지원하고 화면은 한 리워드만 고른다(2026-10-04 되돌림)'로 고쳐 쓰고 담기/함께 받기/버튼 규칙 문단을 정리한다. 줄 표(`funding_pledge_items`)는 남고 UI만 되돌렸다는 사실을 첫 문단에 적는다.
3. 3순위: `serverNow` 응답·단언(`tests/api/funding/pledges.test.ts:85-98`), `RewardModal` `checkout`, `addOn`을 함께 제거한다. `addOn`·`checkout` 제거는 `FundingReward` 타입 변경이라 `RewardCard.test`·`RewardModal.test`·`rewardThumbnail.test`·`PledgeWizard.test`의 `addOn` 리터럴, `projects.test.ts`의 `addOn` describe, `content/funding.test.ts:139`의 함께 받기 단언, `keep-singing-for-palestine.md`의 `addOn` 키·주석이 함께 바뀌어야 타입 검사가 통과한다.
4. 서버의 `items` 배열 수용은 '옛 클라이언트 호환'이 아니라 현재 정본이다(`PledgeWizard.tsx:430,480`이 1개짜리 배열을 보내고 관리자 수기 등록은 여러 줄을 받는다) — 유지한다.

**비고** — 검증자가 P3→P2로 올림: 고객에게 보이는 FAQ 문구가 지적에 빠져 있었다.

#### FND-6. 펀딩 본문의 오디오 미리듣기 둘과 영상이 서로를 멈추지 않아 소리가 겹친다 [P2 · S]

**어디** — `components/funding/FundingAudioPlayer.tsx:171`(`new Audio()`), `:239-252`(`togglePlay`), `components/funding/FundingVideo.tsx`, `content/funding/sabbaha-slung.md:93,101,105`.

**지금 코드**

```ts
// components/funding/FundingAudioPlayer.tsx:239-252
const togglePlay = async () => {
  const el = audioRef.current;
  if (!el) return;
  if (playing) { el.pause(); return; }
  ensureAnalyser();
  try { await ctxRef.current?.resume(); await el.play(); } ...
```

```md
<!-- content/funding/sabbaha-slung.md:93,101,105 -->
%%funding-video:sabbaha-debt-shroud-live%%  %%funding-audio:sabbaha-kalpa%%  %%funding-audio:sabbaha-debt-shroud%%
```

**왜 문제인가** — `FundingAudioPlayer`는 인스턴스마다 `new Audio()`를 만들고 자기 pause/playing 이벤트만 듣는다. 모듈 전역 협조나 window 이벤트가 전혀 없다(`components/funding`에서 `pause()`는 자기 el뿐). `FundingVideo`는 `setPlaying(true)`로 `autoplay=1` iframe을 연다. 사바하 상세에는 영상 1개와 오디오 2개가 나란히 있다.

**어떤 조건에서 어떤 결과** — 진행 중(2026-09-29~12-13)인 펀딩 페이지에서 한 곡을 재생한 채 다른 곡이나 영상을 누르면 동시에 나온다. 곡을 연달아 눌러 보는 가장 흔한 동선이다.

**수정** — 모듈 전역 소유자 한 칸(`claimMediaFocus(id, stop)`) 또는 window `CustomEvent` 한 종류로 재생 시작 때 이전 소유자의 stop을 부른다. 오디오는 `'playing'` 이벤트에서 `claim(() => el.pause())`, 영상은 `setPlaying(true)` 시점에 `claim(() => setPlaying(false))`(iframe을 내려 정지시키므로 추가 의존 없음). 더 작은 쪽을 택한다. `FundingAudioPlayer.test.tsx`·`FundingVideo.test.tsx`에 동시 재생 방지 케이스를 추가한다.

**비고** — 검증자가 P3→P2로 올림: 모든 방문자가 겪는 동작 버그다(돈·데이터 영향은 없음). 원안이 근거로 든 `MixComparePlayer`의 협조는 한 컴포넌트 안의 A/B 전환이라 비교 근거로는 정확하지 않다.

#### FND-7. 결제 장부(salesLedger)에 펀딩 계좌 입금이 없고, 입금 뒤 환불 기록된 건은 장부·발송 CSV 어디에도 나오지 않는다 [P2 · M]

**어디** — `lib/ops/salesLedger.ts:28-99`(`listSalesLedgerRows`), `lib/funding/admin-list.ts`(`listFundingOrdersForExport`), `pages/api/admin/funding/export.ts`, `lib/funding/cancel.ts:209-216`, `lib/funding/bankTransfer.ts`.

**지금 코드**

```ts
// lib/ops/salesLedger.ts:28
// 승인 기록이 없는 돈(무통장 후원·수기 등록)은 여기 없다. 그건 펀딩 CSV가 싣는다.
...
// :91-99
const rows = await getDb().query.payments.findMany({
    where: and(isNotNull(payments.approvedAt), gte(payments.approvedAt, from), lt(payments.approvedAt, toExclusive)),
```

**왜 문제인가** — 장부는 `payments.approvedAt`이 있는 행만 훑는다. 펀딩 계좌 입금은 설계상 결제 행이 없다(`lib/funding/CLAUDE.md`, `lib/payments/bankDeposit.ts` 머리 주석). 장부 주석은 '펀딩 CSV가 싣는다'고 미루지만 그 CSV는 발송 실무용으로 `paid`·`partially_refunded`만 싣고 환불액·환불일 칸이 없다. 입금 확인된 건은 CSV에 `paidAt`·`totalAmount`·`paymentMethod`로 남지만, 입금 뒤 '송금 완료(환불 기록)'(`cancel.ts:209-216`, refunds 행 없이 `orders.status='refunded'`)를 누른 건은 CSV에서 빠져 장부·CSV 양쪽에서 사라진다. 원본 값은 `orders` 행과 `refund_accounts.refunded_at`에 남아 있어 데이터 손실은 아니고 내보내기 공백이다. 예약·공연·믹싱 계좌 입금은 `bank-deposit:` 결제 행이 있어 장부에 들어가므로 펀딩만 빈다.

**어떤 조건에서 어떤 결과** — 부가세·정산용 장부에 계좌 입금 후원 매출이 없어 발송 CSV를 따로 합산해야 하고, 받았다가 돌려준 건은 입금·환불 모두 내보내기에 안 나온다. 환불이 다른 신고 기간에 걸리면 기간별 매출이 어긋난다. 계좌 입금 재도입이 2026-10-04라 현재 규모는 작다.

**수정** — funding에 `payments` 행을 만들지 않는다(펀딩은 결제 행 없이 `payment_method`로 가르는 설계이고, `order.payments.length>0`을 토스 판정으로 쓰는 `pages/api/admin/funding/pledges/[id].ts:356`·`admin-serialize.ts:233-237`·`cancel.ts:132-137`이 깨진다 — 계좌 입금 환불 재발송 메일이 토스 모드로 나가고 관리자 화면 mismatch 표시가 바뀐다). 발송 CSV에 `refunded`를 넣지도 않는다(개인정보 11열을 확정 건으로 좁힌 설계). 대신 `listSalesLedgerRows`에 두 번째 조회를 더한다: `orders JOIN funding_pledges WHERE payment_method='bank_transfer' AND paid_at이 기간 안 AND status IN ('paid','refunded')`. `method='계좌 입금'`, `approvedAt=paid_at`, 환불액은 `refunded`면 `totalAmount`(계좌 입금은 전액 취소만 — `lineRefund.ts` `offline_payment`), `lastRefundAt=refund_accounts.refunded_at`(없으면 `orders.updated_at`). `approvedAt`순으로 병합하고 `salesLedger.ts:28` 주석을 사실에 맞춘다. 마이그레이션 불필요. `salesLedger.integration.test.ts`에 계좌 입금 paid·refunded 케이스를 추가한다.

**비고** — 검증자 정정: '입금도 CSV에 안 남는다'는 틀리고 빠지는 것은 `refunded` 건이다. 원안의 두 수정(payments 행 생성, CSV에 refunded 추가)은 설계 결정과 충돌해 뺐다. 같은 자리를 다른 축(PAY 결제·주문·예약)도 지적: 매출장부 머리 주석·CSV 설명이 '토스·카드' 기준으로 남아 있다 — 계좌 입금 확인 행도 장부에 실린다.

#### FND-8. 관리자 '메일 재발송'이 취소 요청 접수 메일의 실패를 복구하지 못하고 '펀딩 확정' 메일을 보낸다 [P2 · S]

**어디** — `pages/api/admin/funding/pledges/[id].ts:324-382`(`resend_email`), `pages/admin/funding/[id].tsx:222`(확인창), `:376-382`(재발송 배너), `lib/funding/cancel.ts`(`notifyCancelled 'refund_requested'`), `lib/funding/email.ts`.

**지금 코드**

```ts
// pages/api/admin/funding/pledges/[id].ts
if (order.status === 'paid') {
        err = await sendFundingConfirmedEmails(order, project);
      } else if (isRefundedFundingOrderStatus(order.status)) {
```

**왜 문제인가** — 계좌 입금 후원자가 취소를 접수하면 주문은 `paid`를 유지한 채 `refund_requested_at`만 설정된다. 접수 안내 메일이 실패하면 `notification_error`에 사유가 남고 관리자 화면은 '아래 메일 재발송을 눌러 주세요'를 띄운다. 그러나 `resend_email`은 `status==='paid'`면 `refundRequestedAt`을 보지 않고 확정 메일(`sendFundingConfirmedEmails`)을 보내며, 확인창도 `isLiveFundingOrderStatus ? '펀딩 확정' : '환불'`이라 '펀딩 확정 안내'라고만 한다. 발송 뒤 `notification_error`가 null로 덮여 헬스체크 경보는 꺼진다. 테스트에도 refund_requested+resend 케이스가 없다(`tests/api/admin/funding/pledges/[id].test.ts:111-210`).

**어떤 조건에서 어떤 결과** — 취소를 요청한 후원자가 접수 메일을 못 받았을 때 운영자가 복구 버튼을 누르면 '펀딩이 확정되었습니다'가 나가 취소가 무시된 것으로 읽히고, 접수 안내(3영업일 환불 약속)는 영영 나가지 않으며, 같은 시도로 경보가 꺼진다. 운영자에게도 '펀딩 확정' 알림이 한 번 더 간다. 철회(`clear_refund_request`) 메일 실패 뒤 재발송은 현재 상태(정상 진행)와 모순되지 않는 확정 메일이 나가지만 철회 안내는 나가지 않는다.

**수정** — `resend_email` 분기에서 `status==='paid'`보다 먼저 `order.fundingPledge.refundRequestedAt && isRefundPendingStatus(order.status)`를 보고 `sendFundingCancelledEmails(order, project, 'refund_requested', remainingRefundable(order))`를 보낸다(셋 다 이미 import됨). 관리자 확인창(`pages/admin/funding/[id].tsx:222`)은 환불 요청 접수 건이면 '취소 요청 접수 안내'로 가른다. `clear_refund_request`의 메일 실패는 `notification_error` 기록을 유지한다(경보를 끄지 않는다) — 재발송 시 확정 메일이 나가는 것은 상태와 모순되지 않으니 확인창에 철회 건임을 알리는 정도로 둔다. `tests/api/admin/funding/pledges/[id].test.ts`에 'refund_requested 건의 재발송은 접수 메일을 보낸다' 케이스를 추가한다.

**비고** — 검증자가 P2 유지(Resend 실패 + 운영자 클릭이 겹쳐야 해 P1은 아님). 원안의 철회 쪽 수정(`notification_error` 대신 warnings)은 '메일 실패는 헬스체크가 읽는 `notification_error`로 드러낸다'는 저장소 원칙과 어긋나 뺐다.

#### FND-9. 동의 판본이 '누른 시점의 서버 판본'으로 남는다 — 설계 의도이며 폼을 열어 둔 사이 개정 배포가 끼는 좁은 창만 남는다 [P3 · S]

**어디** — `lib/funding/service.ts:276-296`(`:294`), `components/funding/PledgeWizard.tsx:433,486`, `lib/funding/validation.ts:128`, `pages/api/funding/pledges.ts`, `lib/funding/policy.ts`.

**지금 코드**

```ts
// lib/funding/service.ts:294
${toEpoch(now)}, ${FUNDING_TERMS_VERSION}
// components/funding/PledgeWizard.tsx:486 — 클라이언트는 판본 없이 불리언만 보낸다
termsAgreed: true,
// lib/funding/validation.ts:128
if (b.termsAgreed !== true) return { ok: false, message: '약관에 동의해 주세요.' };
```

**왜 문제인가** — `terms_version`은 요청 시점 서버 상수다. 위저드 주석(`PledgeWizard.tsx` 약 926~929행)과 `policy.ts`의 `FUNDING_TERMS_VERSION` 주석이 '동의는 결제하기를 누르는 행위로 받고, 누른 시점의 판본이 증거로 남는다'고 정한 의도된 설계다. 이 화면에는 약관 본문이 없고 새 탭으로 여는 링크 한 줄뿐이라, 클라이언트가 보냈을 판본도 사용자가 읽은 값이 아니라 번들 빌드 시점 값이다.

**어떤 조건에서 어떤 결과** — '약관을 올리는 배포가 폼을 열어 둔 사이에 끼고, 사용자가 배포 전에 옛 약관 탭을 보았으며, 그 뒤에 결제를 누른 경우'에만 어긋난다. `/pledge`는 getServerSideProps + no-store라 새로 열면 새 번들이고, 약관 개정은 드물다(-r3까지 올린 날이 10-04 하루). 현재 설계로 증거가 일관되고 분쟁 시 git 이력으로 대조 가능하다.

**수정** — 코드 변경을 보류하는 쪽을 권한다. 굳이 막으려면 `PledgeWizard`가 `termsVersion`을 실어 보내고 불일치일 때만 409(새로고침 안내)를 돌려주되, 판본 문자열이 없는 옛 번들은 거부하지 말고 서버 상수로 기록한다. `'unknown-client'` 같은 비표준 값은 쓰지 않는다 — `showsMessageAnonymously`(policy.ts:204)와 익명 메시지 SQL(`terms_version LIKE 'funding-terms-%'`)이 그 접두사를 전제해 익명 응원 메시지가 사라진다. 이 409는 진행 중 캠페인의 결제 직전 이탈을 늘리므로 약관 개정 배포 때만 의미가 있다.

**비고** — 검증자가 P2→P3로 내림: 의도된 설계이고 창이 매우 좁다.

#### FND-10. 공개 모금 현황 GET이 호출마다 정합성과 무관한 UPDATE를 실행하고 404는 캐시되지 않는다 [P3 · S]

**어디** — `pages/api/funding/[slug]/status.ts:8-24`(`:14`), `lib/funding/service.ts:372`(`aggregateProjectStatus`), `lib/funding/refundable.ts:72-73`, `pages/[locale]/funding/[slug]/pledge.tsx:48`.

**지금 코드**

```ts
await expireStalePledges(now);
...
const s = await buildPublicStatus(project, now);
...
res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60');
```

**왜 문제인가** — `expireStalePledges`는 이 응답의 정확성에 필요 없다. `aggregateProjectStatus`의 재고 집계는 `hold_expires_at > now`를 직접 보고, 모금액·명단은 `countedFundingPledgeSql()`이 pending 토스를 세지 않으며, 주문 INSERT의 `fundingStockCondition`도 같은 조건이다. 캐시 미스마다 일치 행이 거의 없는 UPDATE가 DB 쓰기 경로를 탄다. 존재하지 않는 slug의 404는 캐시 헤더가 없어 매번 DB 조회(총계·재고·명단·명단 수·익명 메시지 5개 + UPDATE 1)를 한다. 이 라우트에는 `consumeRateLimit`이 없다(같은 폴더의 pledges·cancel·display-name은 건다).

**어떤 조건에서 어떤 결과** — 응답이 `s-maxage=15`라 정상 트래픽에서는 리전당 15초에 한 번 원본에 닿고, 일치 행이 없는 UPDATE는 WAL을 쓰지 않는다. 쿼리스트링을 바꿔 캐시를 우회하는 의도적 트래픽에서만 DB 부하가 커진다. 현재 규모(후원 12~27건/프로젝트)에서는 실측할 수 있는 영향이 없다.

**수정** — `status.ts`에서 `expireStalePledges` 호출 한 줄만 제거해 읽기 전용으로 만든다. `pledge.tsx:48`·manage·admin의 호출은 두어도 된다(no-store SSR이라 빈도가 낮고, `expired` 상태 전이를 거기서 맡는다). 404에는 `Cache-Control: public, s-maxage=60`을 준다. 미허용 쿼리 키 400과 `?view=summary` 변형은 실제로 부하가 관측된 뒤에 한다.

**비고** — 검증자가 P2→P3로 내림. 같은 자리를 다른 축(DB 스키마·마이그레이션·쿼리)도 지적: 공개 status API와 펀딩 후원 SSR이 집계에 필요 없는 expireStalePledges(쓰기)를 실행한다.

#### FND-11. 집계·관계 조회용 인덱스가 없다(효과 있는 것은 셋뿐) [P3 · M]

**어디** — `db/schema.ts:477-586`(`fundingPledges`), `lib/funding/service.ts:384-385`, `lib/funding/refundable.ts`, `drizzle/migrations`.

**지금 코드**

```ts
export const fundingPledges = sqliteTable('funding_pledges', {
  ...
  projectSlug: text('project_slug').notNull(),
  ...
  holdExpiresAt: integer('hold_expires_at', { mode: 'timestamp' }).notNull(),
  ...
});   // 인덱스 콜백 없음. 마이그레이션도 funding_pledges_order_id_unique 하나뿐
// lib/funding/service.ts:384-385
FROM orders o JOIN funding_pledges fp ON fp.order_id = o.id
WHERE fp.project_slug = ${project.slug} AND ${countedFundingPledgeSql()}
```

**왜 문제인가** — `aggregateProjectStatus`·`fundingStockCondition`·`aggregateRewardSales`가 `funding_pledges`를 `project_slug`로 거르지만 인덱스가 없어 SCAN이고, 관계 조회 `with:{payments:{with:{refunds}}}`도 `payments.order_id`·`refunds.payment_id`에 인덱스가 없다(`service.ts` 주석도 스스로 적는다). 검증자가 마이그레이션 52개를 임시 SQLite에 적용하고 orders 2만 행·funding_pledges 3천 행을 채워 EXPLAIN QUERY PLAN을 돌린 결과: `project_slug` 인덱스는 총계 쿼리를 SCAN→SEARCH로 바꾸지만(유효), `hold_expires_at` 부분 인덱스는 `hold_expires_at < now`가 운영에서 거의 모든 행과 일치해 전범위 스캔이고 `orders(type,status)`는 플래너가 쓰지 않았다.

**어떤 조건에서 어떤 결과** — 행이 수만 건이 되기 전에는 체감되지 않는다(현재 규모에서는 ms 단위). 오픈 직후 폴링이 몰리는 대형 캠페인에서 rows-read 과금이 늘어난다.

**수정** — 셋만 넣는다:

```sql
CREATE INDEX funding_pledges_project_slug_idx ON funding_pledges(project_slug);
CREATE INDEX payments_order_id_idx ON payments(order_id);
CREATE INDEX refunds_payment_id_idx ON refunds(payment_id);
```

`hold_expires_at` 부분 인덱스와 `orders(type,status)`는 뺀다. 컬럼 추가가 아니므로 배포 순서 제약은 없다. 다만 저널 `when`이 현재 최댓값보다 커야 하고, 적용은 main 병합본에서 Turso CLI 절차(루트 CLAUDE.md '운영 DB 마이그레이션 적용 방법')로 한다. 적용 뒤 `EXPLAIN QUERY PLAN`으로 SEARCH 사용을 확인한다.

**비고** — 검증자가 P2→P3로 내리고 다섯 인덱스 중 효과 없는 둘을 뺐다. 같은 자리를 다른 축(DB 스키마·마이그레이션·쿼리)도 지적: funding_pledges.project_slug 인덱스 부재 — 집계 쿼리에만 효과, 재고 조건·만료 UPDATE에는 효과 없음.

#### FND-12. 공개 명단 후원자가 100명을 넘으면 초과분이 명단에도 익명 수에도 안 잡힌다(잠재) [P3 · S]

**어디** — `lib/funding/service.ts:430-473`, `lib/funding/bankTransfer.ts:118`, `lib/funding/service.integration.test.ts:482`, `components/funding/BackerWall.tsx`, `lib/funding/publicStatus.ts`.

**지금 코드**

```ts
ORDER BY fp.paid_at DESC, o.created_at DESC LIMIT 100
...
anonymousBackerCount: Math.max(0, Number(totals[0]?.backers ?? 0) - Number(listable[0]?.n ?? 0)),
```

**왜 문제인가** — 명단은 LIMIT 100인데 익명 수는 '전체 건수 − LIMIT 없는 listable 건수'라, 동의자가 100명을 넘으면 오래된 (listable−100)명이 명단에도 익명 수에도 안 잡힌다. `service.integration.test.ts:482`가 '익명 수 = backerCount − publicBackers.length' 불변식을 기대하는데 100명 이하에서만 성립한다. SQLite는 DESC 정렬에서 NULL을 맨 뒤로 보내므로 계좌 입금 대기분(`paid_at` NULL, `bankTransfer.ts:118`이 입금 확정 때 채움)이 먼저 잘리고, `stripInvisible` 뒤 빈 이름도 같은 식으로 사라진다.

**어떤 조건에서 어떤 결과** — 현재 backerCount는 사바하 12건, 다른 두 프로젝트 23·27건이고 명단 동의(`display_name_public` 기본 꺼짐)는 그중 일부라 발현하지 않는다. 동의 후원자 100명 초과 시 명단이 후원 수보다 적게 보인다.

**수정** — 가장 작은 수정은 `anonymousBackerCount`를 `backers − listed.length`(실제로 그려지는 이름 수)로 바꾸는 한 줄이다. 정렬은 `ORDER BY COALESCE(fp.paid_at, o.created_at) DESC`로 맞춘다. `service.integration.test.ts`에 동의자 101명 이상 시나리오로 `publicBackers.length + anonymousBackerCount === backerCount`를 단언한다. 상한을 올리거나 '더 보기'를 만드는 일은 실제로 100명에 가까워질 때 한다 — LIMIT을 걷어내면 status 응답이 후원 수에 비례해 커지므로 명단 분리 설계가 함께 필요하다(overflow 참조).

**비고** — 검증자가 P2→P3로 내림(잠재 버그). 원안 (b)(상한 500 + 더 보기)는 UI 변경이 커서 뺐다.

#### FND-13. 10만원 티어 카드가 명단 게재를 무조건 약속하지만 실제로는 이름 표시 동의가 있어야 한다 [P3 · M]

**어디** — `content/funding/sabbaha-slung.md:47-52`(`:50`), `:148`, `:151`, `components/funding/PledgeWizard.tsx:161`, `:789-791`.

**지금 코드**

```yaml
  - id: cd-live-credit
    title: CD + 부적 + 공연 초대 + 음반 속지에 이름
      CD 한 세트와 친필 부적, 발매 기념 공연 1인 초대에 더해 CD 속지의 Special Thanks와 웹 후원자 명단에 이름을 실어 드립니다.
```

```ts
// components/funding/PledgeWizard.tsx:161
customerName: '', ..., displayNamePublic: false,
```

**왜 문제인가** — 카드(50행)는 '웹 후원자 명단에 이름을 실어 드립니다'로 무조건형인데, 명단 게재는 위저드의 선택 체크(`displayNamePublic` 기본 false, 789~791행 '후원자 명단에 이름 표시')에 달려 있다. 같은 문서의 본문 148행은 속지 Special Thanks만 말해 카드와 본문도 어긋난다.

**어떤 조건에서 어떤 결과** — 체크를 안 한 10만원 후원자가 명단에 없는 것을 약속 불이행으로 볼 수 있다. 다만 체크는 후원 이후에도 펀딩 확인 페이지(`SupporterListingEditor`, 151행 '공개 여부는 확인 페이지에서 언제든 바꾸실 수 있습니다')에서 켤 수 있고 속지 이름도 결제 뒤 메일로 받으므로 구제되지 않는 구조가 아니다. 현재 후원은 12건.

**수정** — 리워드 `description`만 고친다(id·금액·한정 여부는 그대로라 baseline에 걸리지 않는다). 예: '… CD 속지의 Special Thanks에 이름을 실어 드리고, 후원자 명단 표시에 동의하시면 웹 후원자 명단에도 실립니다.' 속지 이름을 메일로 받을 때 명단 표시 여부도 함께 묻는다. 코드 강제(`listsName` 플래그, 위저드 강제, 서버 강제)는 하지 않는다 — '선택 항목을 기본 체크로 받으면 적법한 동의로 보기 어렵다'는 위저드 주석(약 760~772행)과 운영자 결정(동의 최소화)에 어긋나고 shape·validation·위저드·명단 조회를 모두 건드린다. lastmod·GSC 색인 요청은 상업 LP 규칙 대상이 아니라 생략해도 된다.

**비고** — 검증자가 P2→P3로 내리고 수정을 문구로 좁혔다.

#### FND-14. frontmatter 시각 검증이 '2026-10-19T09:00:00+09:00'처럼 올바른 KST 오전 9시를 시간대 누락으로 오판해 거부한다 [P3 · S]

**어디** — `lib/funding/shape.ts:177-198`(`isoDate`, `:181`), `:307`(lastmod 기본값), `lib/funding/projects.ts`, `lib/funding/projects.test.ts`.

**지금 코드**

```ts
if (v instanceof Date) {
  ...
  if (v.toISOString().endsWith('T00:00:00.000Z')) {
    throw new Error(`funding frontmatter: ${name}에 시간대를 함께 적어야 합니다 — ...`);
```

실측: gray-matter로 `startAt: 2026-10-19T09:00:00+09:00` 파싱 → `Date 2026-10-19T00:00:00.000Z`.

**왜 문제인가** — YAML이 이미 Date로 파싱한 뒤라 원문을 볼 수 없어 'UTC 자정이면 따옴표 없는 날짜'로 추정한다. 그런데 KST 09:00 정각(+09:00 명시)도 정확히 UTC 자정이라 같은 에러가 난다. 오전 9시 시작은 흔한 오픈 시각이고, 에러 문구는 이미 시간대를 적은 사람에게 원인을 알려주지 못한다. 부수 사실: `startAt: 2026-10-01T00:00:00+09:00`은 통과하지만 lastmod 기본값 `startAt.slice(0,10)`(307행)이 UTC 날짜라 2026-09-30으로 하루 앞선다(현재 md 4개는 lastmod를 명시해 실피해 없음).

**어떤 조건에서 어떤 결과** — 검증자가 실제 파서(`parseFundingProject`)로 재현: `09:00:00+09:00`은 던지고 `10:00:00+09:00`은 통과. 빌드가 서서 알아채므로 데이터 손상은 아니지만, 09:00 시작 프로젝트를 추가할 때 원인을 헤매게 하는 함정이다.

**수정** — gray-matter 호출에 `engines.yaml`로 js-yaml `CORE_SCHEMA`(timestamp 타입 없음)를 주어 날짜가 문자열로 오게 하고 `isoDate`는 문자열 분기(`TZ_OFFSET` 정규식)만 쓴다. 그러면 따옴표 없는 `2026-10-19`도 문자열이 되어 정규식이 '시간대 없음'을 정확히 보고 Date 분기의 UTC 자정 추정이 사라진다. 설치된 gray-matter의 js-yaml이 3.15.2이므로 `safeLoad`+`schema` 옵션으로 쓴다. lastmod 기본값은 `kstDateString(new Date(startAt))`로 바꾼다. lastmod 처리(`projects.ts`·`lib/sitemap/fundingMeta.js`)는 문자열도 받으므로 충돌이 없다. `projects.test.ts`에 `09:00+09:00` 케이스를 추가한다.

**비고** — 검증자 confirmed.

#### FND-15. 외부 취소 동기화의 recordEmailResult가 확정 메일 센티널까지 지운다(같은 가드가 두 곳에만 있음) [P3 · S]

**어디** — `lib/funding/confirm.ts:91-98`(`recordEmailResult`), `:470`(`syncFundingCancelledFromToss` 마무리), `lib/funding/cancel.ts:55-67`, `pages/api/admin/funding/pledges/[id].ts:171-181`, `lib/funding/cancel.ts:296`·`lib/funding/lineRefund.ts:137`(failed refunds INSERT).

**지금 코드**

```ts
// lib/funding/confirm.ts:91-98
const recordEmailResult = async (orderId, orderNo, emailError) => {
  try {
    await getDb().update(orders).set({ notificationError: emailError }).where(eq(orders.id, orderId));
// confirm.ts:470 — syncFundingCancelledFromToss 끝
await recordEmailResult(order.id, order.orderNo, emailError);
// cancel.ts:62-66 — 같은 컬럼을 쓰는 다른 경로는 센티널을 보존한다
emailError === null ? sql`UPDATE orders SET notification_error = NULL WHERE id = ${order.id}
  AND (notification_error IS NULL OR notification_error NOT IN (${SEND_PENDING}, ${SEND_INFLIGHT}))`
```

**왜 문제인가** — `notification_error` 한 칸의 센티널 보존 가드가 `cancel.ts`와 admin `pledges/[id].ts`에는 있는데 `confirm.ts`의 `recordEmailResult`에는 없다. 같은 컬럼을 쓰는 세 번째 경로만 어긋나 있다. 별개로 failed refunds INSERT 두 곳은 try 밖이라 DB 흔들림 때 JSON 대신 500이 나간다(`pages/api/funding/cancel.ts`에 try/catch 없음).

**어떤 조건에서 어떤 결과** — 확정 메일 단계에서 프로세스가 죽어 `send_pending`/`send_inflight`가 남은 주문을 운영자가 토스 콘솔에서 직접 취소하고 통지 메일이 성공하면 null로 덮여 healthCheck(`isNotNull`)가 침묵한다 — '확정 메일 0통인데 경보 없음'. 해당 주문은 이미 환불돼 피해는 작다.

**수정** — 센티널 보존 UPDATE를 공용 함수 하나(`lib/ops/notificationSentinel.ts` 근처)로 빼서 `confirm.ts`·`cancel.ts`·admin `pledges/[id].ts` 세 곳이 쓰게 한다. `bankTransfer.ts:186`은 `WHERE status='pending'`이라 센티널이 존재할 수 없는 상태만 쓰므로 제외한다. `confirm.integration.test.ts`에 `send_pending` 상태에서 외부 취소 동기화 후 센티널이 남는 케이스를 추가한다(현재는 `cancel.integration.test.ts:599`만 있음). failed refunds INSERT 두 곳은 try/catch로 감싸 로그만 남긴다.

**비고** — 검증자 정정: '이전 실패 사유를 지운다'는 `cancel.ts`도 같은 동작이라 결함이 아니라 기존 규약이다.

#### FND-16. 정적 생성용 현황 조립이 런타임 ISR 재생성 실패까지 로그 없이 null로 삼킨다 [P3 · S]

**어디** — `lib/funding/publicStatus.ts:74-86`(`buildPublicStatusOrNull`, catch는 `:82-84`), `lib/funding/repository.ts:27-50`(`safeDb`/`strictDb`), `lib/funding/publicStatus.test.ts:91-94`.

**지금 코드**

```ts
try {
  const s = await buildPublicStatus(project, now);
  return { ...s, publicBackers: [], anonymousBackerCount: 0, publicMessages: [] };
} catch {
  return null;
}
```

**왜 문제인가** — catch가 빌드·DB 미설정과 운영 ISR 재생성 실패를 구분하지 않고 로그 없이 null을 돌려, 직전의 정상 정적 페이지가 `initialStatus` 없는 페이지로 교체된다. `repository.ts:27-50`이 이미 같은 위험('삼켜서 null로 돌려주면 정상 페이지가 60초마다 굳는다')을 문서화하고 런타임 ISR에서는 던져 직전 정적 페이지를 유지하는 `strictDb` 패턴을 두었는데, `aggregateProjectStatus`만 실패하고 프로젝트 조회는 성공하는 경우(마이그레이션 전 배포된 쿼리 등) 이 catch가 그 설계를 우회한다.

**어떤 조건에서 어떤 결과** — 운영 DB 오류가 정적 경로에서는 로그 없이 지나가고 첫 화면이 '집계 중…'으로 굳는다. 전면 장애라면 `/api/funding/[slug]/status`도 같은 집계를 불러 실패하므로 증상이 가려지지는 않고, 정적 경로의 로그만 없다.

**수정** — `repository.ts`의 `shouldSwallowDbErrors`(TURSO_* 없음 또는 `NEXT_PHASE==='phase-production-build'`)를 export해 재사용한다. 삼켜도 되는 환경이면 null, 아니면 `console.error`로 남기고 rethrow해 ISR이 직전 페이지를 유지하게 한다. `publicStatus.test.ts:91-94`의 'DB 없는 환경에서 null' 기대는 TURSO_* 미설정이면 삼키는 쪽에서 그대로 유지된다. 최소안은 `console.error`만 추가하는 것이다.

**비고** — 검증자 adjusted: 로그만 추가하는 원안은 약해 `strictDb` 패턴에 맞췄다.

#### FND-17. 이름 공개 편집 가능 상태 목록이 화면과 API에 따로 복제돼 있다 [P3 · S]

**어디** — `pages/[locale]/funding/manage/[orderNo].tsx:336`, `pages/api/funding/display-name.ts:29`, `lib/funding/policy.ts`.

**지금 코드**

```ts
// pages/[locale]/funding/manage/[orderNo].tsx:336
canEditDisplayName: ['pending', 'paid', 'partially_refunded'].includes(order.status),
// pages/api/funding/display-name.ts:29
const EDITABLE_STATUSES = new Set(['pending', 'paid', 'partially_refunded']);
```

**왜 문제인가** — 두 목록이 주석('같은 판정')으로만 묶여 있다.

**어떤 조건에서 어떤 결과** — 한쪽만 고치면 화면은 편집 UI를 보이는데 API가 409를 내는 불일치가 생긴다(장래 위험).

**수정** — `lib/funding/policy.ts`에 `DISPLAY_NAME_EDITABLE_ORDER_STATUSES` 상수 하나를 내보내 화면과 API가 함께 쓴다. `expireStalePledges` 순서 변경과 `expireOnePledge` 신설은 하지 않는다 — `expireStalePledges`는 `pledge.tsx:48`·status API·`pledges.ts:53`도 똑같이 호출하는 표준 lazy 만료이고 매칭 행이 없으면 0행 UPDATE라 토큰 검증을 앞세워 얻는 것이 없고, manage 페이지가 만료를 먼저 반영하는 것은 stale pending을 보이지 않게 하려는 목적이다.

**비고** — 검증자 adjusted: 원안의 '쓰기 증폭' 절반은 과장이라 뺐다.

#### FND-18. 펀딩 불변식 기준선이 downloads 키·requiresShipping·수량 감소를 보지 않는다(DB 경로 lockedViolation과 불일치) [P3 · S]

**어디** — `scripts/funding-baseline.ts:43-60`, `content/funding.baseline.json`, `content/funding.baseline.test.ts`, `lib/funding/shape.ts:92-105`(`pledgeDownloads`), `:108-111`(`isDigitalOrder`), `pages/api/funding/download.ts:89`, `lib/funding/creatorProjectWrite.ts:588-609`.

**지금 코드**

```ts
export type ProjectEntry = { rewards: Record<string, { amount: number; limited: boolean }> };
...
rewards[r.id] = { amount: r.amount, limited: r.totalQuantity !== null };
// 39행 주석: `limited`는 totalQuantity 유무만 본다 — 수량 자체는 늘릴 수 있다.
```

**왜 문제인가** — 기준선은 id·금액·한정 여부만 고정한다. `downloads[].key`는 `pledgeDownloads`가 현재 md의 키로 후원자 내려받기를 판정하고 `download.ts:89`가 그 목록에 있는 키에만 서명하므로, 오픈 뒤 키를 바꾸거나 빼면 기존 후원자의 약속 파일이 조용히 사라진다. `requiresShipping`도 md 프로젝트에서는 현재 파일을 읽어 판정한다(`manage/[orderNo].tsx:328`). DB 경로(`creatorProjectWrite.ts` `lockedViolation`)는 금액·한정 여부·requiresShipping 변경 금지와 '수량은 늘릴 수만'을 이미 강제하는데 md 기준선은 requiresShipping과 수량 감소를 빠뜨려 두 경로의 불변식이 어긋난다. `content/funding.test.ts:54`는 티어 간 포함 관계만 본다.

**어떤 조건에서 어떤 결과** — 기존 후원자가 약속받은 파일을 잃거나 배송 이행 조건이 사후에 바뀌는 변경이 CI 없이 들어올 수 있다. md 편집은 운영자만 하므로 확률은 낮다.

**수정** — 기준선 엔트리에 `downloads`(키 정렬 배열)·`requiresShipping`·`totalQuantity`를 추가하고 규칙을 '키는 추가만, requiresShipping 변경 금지, 수량은 증가만'으로 한다(감소는 경고가 아니라 DB 경로와 같이 위반). `assertBaselineFormat`이 구 포맷을 알아보게 하고 `funding.baseline.test.ts`의 base 픽스처와 `content/funding.baseline.json`을 `--update`로 함께 갱신한다.

**비고** — 검증자 adjusted: 수량 감소는 경고가 아니라 위반으로 통일.

#### FND-19. 익명 메시지 판본 판정의 TS/SQL 이중 구현에 일치 테스트가 없고 설명 블록이 엉뚱한 상수 위에 있다 [P3 · S]

**어디** — `lib/funding/policy.ts:189-205`(설명 블록 `:189-198`, `ANONYMOUS_LABEL` `:199`, `ANONYMOUS_MESSAGE_TERMS_FROM` `:201`, `showsMessageAnonymously` `:204-205`), `lib/funding/service.ts:459`, `lib/funding/policy.test.ts`, `lib/funding/service.integration.test.ts:454`.

**지금 코드**

```ts
// lib/funding/policy.ts:204-205
export const showsMessageAnonymously = (termsVersion) =>
  typeof termsVersion === 'string' && termsVersion.startsWith('funding-terms-') && termsVersion >= ANONYMOUS_MESSAGE_TERMS_FROM;
// lib/funding/service.ts:459
AND fp.terms_version LIKE 'funding-terms-%' AND fp.terms_version >= ${ANONYMOUS_MESSAGE_TERMS_FROM}
```

**왜 문제인가** — 같은 사전순 규칙이 TS와 SQL로 따로 구현되어 있고 두 판정이 일치하는지 보는 테스트가 없다(`:454`는 SQL만 본다). 189-198행 설명이 `ANONYMOUS_MESSAGE_TERMS_FROM`이 아니라 `ANONYMOUS_LABEL` JSDoc 위에 떠 있다.

**어떤 조건에서 어떤 결과** — 기준 판본 `funding-terms-2026-09-28`은 '옛 판본 후원은 소급하지 않는다'는 약속에 묶인 고정 과거 시점이고 접미사가 없어 `-r2`·`-r10` 등 모든 후속 판본에서 사전순이 올바르다. 현재 실해는 없다. 장래 한쪽만 고치면 화면 안내와 실제 공개가 갈릴 수 있다.

**수정** — 설명 블록을 `ANONYMOUS_MESSAGE_TERMS_FROM` 바로 위로 옮긴다. `policy.test.ts`에 TS 판정 표본(09-27, 09-28, 09-28-r2, 10-04-r3, r10)을 단언하고 `service.integration.test.ts`에 같은 표본의 SQL 결과를 대조하는 케이스를 하나 더한다. `compareTermsVersion` 헬퍼나 CASE 순번 계산은 과설계라 하지 않는다.

**비고** — 검증자 adjusted: 위험 시나리오는 사실상 성립하지 않아 헬퍼 신설을 뺐다.

#### FND-20. BackerWall 날짜가 시청자 시간대로 그려진다 [P3 · S]

**어디** — `components/funding/BackerWall.tsx:14-18`, `:63`.

**지금 코드**

```ts
const formatDate = (at: number): string => {
  const d = new Date(at * 1000);
  ...
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
// :63
<p ...>{roster.join(' · ')}
```

**왜 문제인가** — 로컬 `getFullYear/getMonth/getDate`를 써서 KST 밖 시청자에게 같은 메시지의 날짜가 하루 어긋난다. 같은 저장소의 다른 날짜는 KST로 쓴다. 정적 HTML에는 메시지가 비어 있어(`publicStatus`의 OrNull) 하이드레이션 불일치는 없다.

**어떤 조건에서 어떤 결과** — 해외 시간대에서만 드러나는 미미한 표시 차이. 펀딩은 ko 전용이라 매우 작다.

**수정** — 모듈 상수 `Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'})`로 바꾼다. `bdi` 감싸기는 하지 않는다 — `stripInvisible`이 `\p{Cf}`(방향 제어·격리 문자 포함)를 걷어 방향 조작은 막혀 있고, RTL 이름 후원자가 실제로 나타나면 그때 처리한다.

**비고** — 검증자 adjusted: bdi 지적은 투기적이라 뺐다.

#### FND-21. rowsAffectedOf가 여섯 곳에 복제돼 있고 두 갈래 의미가 이름으로 구분되지 않는다 [P3 · S]

**어디** — `lib/booking/confirm.ts:120`(export, undefined), `lib/funding/confirm.ts:75`·`lib/funding/service.ts:29`(undefined), `lib/funding/bankTransfer.ts:22-25`·`lib/shows/service.ts:16`·`pages/api/admin/funding/pledges/[id].ts:33`(0), `tests/helpers/showsDb.ts:38`.

**지금 코드**

```ts
// lib/funding/bankTransfer.ts:22 — 판정 불가를 0으로
const rowsAffectedOf = (result: unknown): number => {
  const n = Number((result as { rowsAffected?: unknown } | undefined)?.rowsAffected ?? 0);
  return Number.isFinite(n) ? n : 0;
// service.ts:29, confirm.ts:75, booking/confirm.ts:120 — 판정 불가를 undefined(정상)로
```

**왜 문제인가** — 결제 확정 경로 3곳은 판정 불가를 undefined(정상)로, 운영자 선점 UPDATE 경로 3곳은 0행으로 읽는다. 갈림은 의도다 — 결제 확정은 '없는 실패를 지어내 결제를 취소하는 쪽이 더 위험'하므로 정상으로 흘리고(`booking/confirm.ts:110-119` 주석), 선점 UPDATE는 0행이면 이미 처리됨으로 읽는다. 복제는 booking·funding·shows 세 파일 주석에 '의도적 복제'로 적혀 있다. 다만 같은 이름이라 읽는 쪽이 정의를 열어야 의미를 안다.

**어떤 조건에서 어떤 결과** — 운영 드라이버(libSQL)는 항상 `rowsAffected`를 주므로 런타임 차이는 없고 목 환경에서만 갈린다. 가독성·유지보수 문제다.

**수정** — 선택 사항: `lib/db/rowsAffected.ts`에 lenient(undefined 가능)와 strict(없으면 0) 두 함수를 두고 호출부를 옮긴다. CLAUDE.md의 '단순하게' 기준으로 우선순위가 낮아 하지 않아도 무방하다.

**비고** — 검증자 정정: 정의는 네 곳이 아니라 여섯 곳이고 '한 곳만 반대'가 아니라 3대3이다.

#### FND-22. 유튜브 썸네일 maxresdefault에 폴백이 없다(현재 영상은 200, 장래 영상 추가 시 위험) [P3 · S]

**어디** — `components/funding/FundingVideo.tsx:57-66`, 같은 패턴 `data/portfolio/items.ts:699`.

**지금 코드**

```tsx
<img
  src={`https://i.ytimg.com/vi/${video.youtubeId}/maxresdefault.jpg`}
  alt=""
  loading="lazy"
```

**왜 문제인가** — `onError` 폴백이 없어 maxresdefault가 없는 영상을 등록하면 회색 120x90 플레이스홀더가 늘어난다.

**어떤 조건에서 어떤 결과** — 등록된 영상은 한 개(F8JH5d9pOt8)이고 HEAD 요청으로 maxresdefault.jpg가 200임을 확인했다. `VIDEOS`는 코드 안 허용 목록이라 영상을 추가하는 개발 시점에 썸네일을 직접 보게 된다. 현재는 결함이 아니다.

**수정** — 선택 사항: `onError`에서 `hqdefault.jpg`로 한 번만 교체한다(`onerror=null` 처리 포함). CSP(`img-src https:`)와 `next.config` remotePatterns는 이미 i.ytimg.com을 허용한다.

**비고** — 검증자 adjusted: 필수가 아닌 방어적 보강.

#### FND-23. 청약철회·환불 기한 문구의 약관/메일/FAQ 수동 동기화를 어떤 게이트도 보지 않는다 [P3 · M]

**어디** — `lib/funding/email.ts:103-116`(`:106-107` text, `:113-114` html), `:378`(환불 요청 메일), `:97-101`(주석), `pages/[locale]/funding/terms.tsx:49`(제8조)·`:51`(제10조), `lib/funding/faq.ts:39`, `lib/funding/email.test.ts:88-91`.

**지금 코드**

```ts
// lib/funding/email.ts:106 (text)
'· 기한: 프로젝트 마감 전이고 리워드 발송 준비가 시작되기 전이면 언제든 취소하고 전액 환불받을 수 있습니다. 리워드를 받은 뒤에는 받은 날부터 7일 이내에 청약철회할 수 있습니다(...3개월 이내, ... 30일 이내).',
// email.ts:113 (html) — 같은 문장 반복
'청약철회 기한: 프로젝트 마감 전이고 리워드 발송 준비가 시작되기 전이면 ...'
```

**왜 문제인가** — 약관 제8·10조(해시 게이트 대상)와 확정 메일 text/HTML, 환불 요청 메일, FAQ가 같은 기한 문구를 각자 들고 있고 `email.test.ts`는 '받은 날부터 7일 이내'·'3개월 이내'·'3영업일 이내'를 리터럴로 단언할 뿐 약관과 대조하지 않는다. 게이트는 terms+처리방침만 해시하므로 약관 개정 때 메일이 옛 값으로 남을 수 있고, `email.ts:97-101` 주석도 수동 동기화를 인정한다.

**어떤 조건에서 어떤 결과** — 약관과 메일의 철회·환불 안내가 갈리면 계약내용 서면 교부 문서가 약관과 달라진다. 7일·3개월·30일은 법정 기한이라 자주 바뀌지 않고 실제로 운영자가 바꿀 만한 값은 제10조의 3영업일 정도라 가능성은 낮다.

**수정** — `email.test.ts`(또는 content 쪽)에 `FUNDING_TERMS_SECTIONS`(`terms.tsx:41`에서 이미 export) 제8·10조에서 7일·3개월·30일·3영업일을 추출해 확정 메일 text·HTML과 `refund_requested` 문구에 같은 값이 있는지 대조하는 드리프트 테스트를 더한다. `terms.tsx` 본문의 상수 보간 리팩터링은 하지 않는다 — 해시 대상 본문이 우연히 바뀌어 판본 상승이 필요해질 위험이 있고, 섹션이 보간 후 문자열로 해시되므로 '상수를 해시 목록에 넣기'는 불필요하다.

**비고** — 검증자 adjusted: 원안의 약관 리팩터링은 과해 드리프트 테스트로 좁혔다.

#### FND-24. 프로젝트 조회가 실패하면 디지털 후원의 delivered_at이 발송 상태 저장 한 번에 지워진다 (파기 시점에는 영향 거의 없음) [P3 · S]

**어디** — `lib/funding/fulfillment.ts:143-148`(`setFulfillment`), `lib/funding/repository.ts:17-24,69-73`(`getFundingProjectAsync`/`safeDb`), `lib/funding/shape.ts:108-111`(`isDigitalOrder`), `scripts/backfill-digital-delivered.mjs`, `lib/funding/fulfillment.integration.test.ts:278-282`.

**지금 코드**

```ts
const project = await getFundingProjectAsync(pledge.projectSlug);
  const deliveredAt = isDigitalOrder(project, activePledgeLines(pledgeLines(pledge)).map((l) => l.rewardId))
    ? sql`delivered_at`
    : status === 'delivered'
      ? sql`COALESCE(delivered_at, ${Math.floor(now.getTime() / 1000)})`
      : sql`NULL`;
```

**왜 문제인가** — `getFundingProjectAsync`는 DB 조회 실패를 삼켜 null을 주고 `isDigitalOrder(null, …)=false`라, DB(개설자) 프로젝트 조회가 한 번 흔들린 사이 디지털 전용 후원의 상태를 preparing·shipped 등으로 저장하면 `delivered_at`이 NULL로 덮인다. 코드 주석('프로젝트를 못 읽으면 배송 리워드로 다룬다 — 더 안전')이 이 fail-safe 선택을 명시한다.

**어떤 조건에서 어떤 결과** — 1년 파기 경로(`retention.ts`)에서 빠지지만 그 경로도 `paid_at` 5년 전(`legalBoundary`)을 함께 요구해 결제 후 5년이 하한이고, `delivered_at`이 없는 행은 같은 크론의 `purgeFundingPersonalDataOfPurgedOrders`(`orderRetention.ts:171-`)가 5년 시점에 같은 항목을 지운다 — 파기 시점은 사실상 같다. `scripts/backfill-digital-delivered.mjs`(멱등)로 복구할 수 있다. 헬스체크 '아직 발송하지 않은 채 고객 정보 파기가 다가온 펀딩'이 4년 9개월 시점에 오경보를 낼 수 있는 정도. 전제 사건(단일 조회 실패 + 운영자가 디지털 후원의 발송 상태를 만짐)이 드물다.

**수정** — `getFundingProjectOrFailure`로 바꿔 `lookupFailed`이면 `delivered_at`을 추정하지 말고 일시 오류로 거절한다(`conflict` 계열 메시지: '프로젝트 정보를 읽지 못했습니다. 잠시 후 다시 시도'). 디지털 판정은 지금처럼 `activePledgeLines`를 유지한다 — `pledgeLines`로 바꾸면 물리 줄만 환불된 혼합 주문을 배송 주문으로 오판해 디지털 기산점을 지운다. 테스트: `getDbFundingProject`를 throw하게 mock하고 디지털 후원에 preparing 저장 → 거절되고 `delivered_at` 불변을 단언.

**비고** — 검증자가 영향을 크게 낮췄다: '1년 파기 미준수'·'되살리는 코드 없음'은 틀리고, `pledgeLines` 제안은 오판을 낳는다.

#### FND-25. 배송지 입력의 카카오 우편번호 서비스가 처리방침에 없다 — 고지 필요 여부는 법적 분류에 달렸다 [P3 · S]

**어디** — `lib/funding/policy.ts:274-297`(`FUNDING_DATA_PROCESSORS`), `data/privacyPolicy.ts`, `components/funding/kakaoPostcode.ts`, `components/funding/PledgeWizard.tsx:24,359`, `middleware.ts`(CSP `script-src t1.kakaocdn.net`·`frame-src postcode.map.kakao.com`), `content/fundingTermsHash.ts`.

**지금 코드**

```ts
// 후원자의 브라우저가 Cloudflare에 직접 붙는다(lib/funding/r2.ts). 파일 자체에 개인정보는
  // 없지만 그 요청의 접속 정보가 Cloudflare를 지난다 — 그래서 수탁자 표에 싣는다.
  { name: 'Cloudflare', country: '미국', purpose: '디지털 리워드 파일 보관 및 내려받기 제공', items: '내려받기 요청 시 전송되는 접속 정보(IP 주소, 브라우저 정보)' },
```

**왜 문제인가** — 후원 폼은 배송 리워드에서 카카오(다음) 우편번호 위젯을 열고 후원자가 입력한 주소 검색어가 카카오로 직접 전송된다. 수탁자 표와 처리방침에 이를 다룬 문구가 없다. 다만 이 표는 처리위탁(제26조) 현황이고 Cloudflare 행은 R2 보관을 맡겼기 때문에 실린 것이다. 카카오 우편번호는 스튜디오가 개인정보를 넘기지 않는 브라우저 직접 이용 제3자 위젯이라 위탁인지 단순 제3자 서비스 이용인지, 고지 의무가 있는지는 코드로 단정할 수 없다. 카카오맵 SDK(dapi.kakao.com)·유튜브 nocookie 임베드도 현재 같은 취급이라 정책의 현행 구분과 일관된다.

**어떤 조건에서 어떤 결과** — 고지 의무가 있다면 2026-09-29(`900a40e0f2`) 이후 받은 배송 리워드 후원이 고지에 없는 외부 서비스를 거쳤다. 없다면 영향 없음.

**수정** — 먼저 변호사에게 '브라우저에서 이용자가 직접 입력하는 외부 주소검색 위젯이 처리방침 고지 대상인가'를 확인한다. 필요하다는 결론이면 수탁자 표(`FUNDING_DATA_PROCESSORS`)에 넣지 말고(위탁 관계를 단정하게 되어 실제와 다른 고지가 된다) 9항 본문이나 6항 수집 항목 근처에 '배송지 입력 시 카카오(다음) 우편번호 서비스 화면이 열리며 입력한 검색어는 카카오로 직접 전송됩니다' 한 문장을 둔다. 본문을 바꾸면 해시 대상이 바뀌므로 `FUNDING_TERMS_VERSION`을 올리고(같은 날 두 번째면 `-r2`) `UPDATE_FUNDING_TERMS_BASELINE=1 npx jest content/fundingTerms.baseline.test.ts`를 돌려 같은 커밋에 변경 내용을 적는다. 카카오맵·유튜브 등 같은 성격의 서비스도 같은 판단을 적용한다. FND-1의 처리방침 개정과 묶으면 판본 인상이 한 번으로 끝난다.

**비고** — 검증자 정정: 원안의 '수탁자 표에 추가'는 해롭고, '2026-10-04 이후'는 틀리다(9-29 커밋).

#### FND-26. success.tsx의 CONFIRM_ERROR_MESSAGES가 confirm.ts의 실패 message를 쓰지 않는다 — 카드 거절 사유 소실과 문구 두 벌 [P3 · M]

**어디** — `pages/[locale]/funding/success.tsx:148-156`, `:391`(`?e=` 리다이렉트), `:346`(오류 카드 연락처), `lib/funding/confirm.ts`(`FundingConfirmOutcome`, `VIRTUAL_ACCOUNT_CONFIRM_MESSAGE`), `pages/[locale]/funding/fail.tsx`(`FAIL_MESSAGES`), `lib/booking/toss.ts`.

**지금 코드**

```ts
const CONFIRM_ERROR_MESSAGES: Record<string, string> = {
  not_found: '펀딩 내역을 찾을 수 없습니다. 주문번호를 확인해 주세요.',
  ...
  toss_rejected: '결제 승인이 거절되었습니다. 다시 시도하시거나 다른 결제수단을 이용해 주세요.',
  recording_failed: '결제는 완료되었으나 펀딩 확정 처리가 지연되고 있습니다. 몇 분 내 자동 확정됩니다.',
```

**왜 문제인가** — `confirmFundingPledge`가 돌려주는 `message`(가상계좌 안내·카드사 거절 원문·일반 문구)는 success.tsx에서 버려지고 코드별 고정 문구가 쓰인다. 코드만 넘기는 것은 승인 URL의 paymentKey가 GA4 `page_location`에 적재되는 사고를 막으려는 의도된 설계다(#66 `5b0d73dbe9`). 따라서 문제는 설계 자체가 아니라 (a) 카드 승인 단계 거절 사유가 사라지는 것, (b) 같은 문구가 confirm.ts와 success.tsx에 두 벌이라 한쪽만 고쳐질 수 있다는 것이다.

**어떤 조건에서 어떤 결과** — 카드 한도초과·잔액부족으로 승인이 거절된 후원자가 사유 없이 '결제 승인이 거절되었습니다'만 본다(재시도·다른 수단 안내는 있다). 가상계좌는 제공하지 않는 수단이라 현실 영향이 거의 없고, `recording_failed`의 연락처는 카드 하단(346행)에 이미 있다. 이중 결제 위험은 근거가 없다.

**수정** — `FundingConfirmOutcome` 실패에 짧은 식별자(`reason?: 'virtual_account' | 'declined'`)를 더하고 `?e=toss_rejected&r=<식별자>`로 넘겨 success.tsx가 reason별 고정 문구를 고른다. 카드사 거절 사유는 자유 텍스트를 URL에 싣지 말고 토스 에러 코드를 `fail.tsx`의 `FAIL_MESSAGES` 같은 코드→문구 표로 옮긴다. 문구 표는 confirm.ts에서 export해 두 곳이 공유한다. 급하지 않은 정리다.

**비고** — 검증자 adjusted: 영향이 과장되어 있었다.

#### FND-27. 약관 직렬화가 조항 전체를 담는지 전수 단언이 없고 변조 테스트 제목이 실제 검증보다 크다 [P3 · S]

**어디** — `content/fundingTerms.baseline.test.ts:148-153`(변조 테스트), `:141-146`(포함 테스트), `:100-122`(기준선 게이트), `content/fundingTermsHash.ts`, `pages/[locale]/funding/terms.tsx`, `data/privacyPolicy.ts`.

**지금 코드**

```ts
it('조항 본문이 한 글자만 바뀌어도 해시가 달라진다', () => {
    const tampered = serialized.replace('접수일부터 3영업일 이내에 합니다', '접수일부터 5영업일 이내에 합니다');
    expect(tampered).not.toBe(serialized);
    expect(sha256(tampered)).not.toBe(hash);
```

**왜 문제인가** — 변조 테스트는 sha256 성질 위에 '제10조 문장이 직렬화에 있다'를 확인한다(`expect(tampered).not.toBe(serialized)`). 조항이 빠지는 직렬화기 변경은 첫 두 게이트가 판본 올림을 요구하며 잡고, 제8조가 빠지면 `:141-146`의 heading 단언이 실패한다 — '조항이 빠지는데 초록'인 시나리오는 성립하지 않는다. 남는 것은 테스트 제목이 실제 검증보다 크게 말한다는 점과, 직렬화기를 바꾸면서 판본을 올리고 기준선을 다시 쓰는 변경은 통과한다는 점(그 뒤 빠진 조항은 해시 밖)이다. 포함 단언은 현재 조항 3개의 heading만 본다.

**어떤 조건에서 어떤 결과** — 직렬화기 변경과 판본 올림·기준선 갱신이 한 번에 이뤄지면 빠진 조항의 이후 수정이 판본 없이 통과할 수 있다. 가능성은 낮다.

**수정** — 포함 테스트(`:141`)를 `FUNDING_TERMS_SECTIONS` 전체의 heading과 body 문장, `ko.sections` 전체의 heading·body·items·processors 값이 `serialized`에 포함되는지 for 루프로 전수 확인하게 넓힌다. 변조 테스트는 '제10조 환불 기한 문장이 직렬화 대상이다'로 개명한다. 둘 다 선택 사항이다.

**비고** — 검증자 정정: 원안의 핵심 전제('sha256 성질만 본다')가 틀렸다.

#### FND-28. deliverDepositGuide의 첫 재조회가 try 밖이라 신청 생성 뒤 DB 일시 오류가 500이 되고 후원자가 중복 신청한다 [P3 · S]

**어디** — `lib/funding/bankTransfer.ts:171-191`(`:175`), `pages/api/funding/pledges.ts:75`, `components/funding/PledgeWizard.tsx:439`(`clearStoredDraft`).

**지금 코드**

```ts
export const deliverDepositGuide = async (
  orderNo: string,
  opts: { throttleCustomer?: boolean } = {},
): Promise<string | null> => {
  const order = await findFundingOrderByOrderNo(orderNo);
  if (!order?.fundingPledge) return 'not_found';
  let emailError: string | null;
  try {
```

**왜 문제인가** — 머리주석은 예외를 삼킨다고 하지만 `findFundingOrderByOrderNo`가 try 밖이다. 호출부 `pledges.ts:75`도 try가 없어 500(text/plain)이 나가며, 위저드는 JSON이 아니면 '서버 오류가 발생했습니다'를 띄운다. 이때 임시저장이 남아(`clearStoredDraft`는 성공 뒤에만) 후원자가 다시 누르면 중복 신청이 생기고, 계좌 입금에는 열린 건수 상한과 자동 취소가 없다(운영자 결정).

**어떤 조건에서 어떤 결과** — 방금 커밋이 성공한 DB에서 바로 이어진 읽기 한 번이 실패하는 경우라 드물다. 발생하면 안내 메일 없는 pending 건과 중복 신청이 생겨 공개 모금액·명단이 중복으로 잡히고, 운영자는 입금 한 건을 두 신청 중 하나에 대조해야 한다.

**수정** — `deliverDepositGuide` 전체(재조회 포함)를 try로 감싸 실패 시 문자열(예: `'lookup_failed'`)을 돌려준다. `pledges.ts`는 그 결과와 무관하게 201과 `manageUrl`을 돌려준다. 메일 실패는 `notification_error`가 이미 맡는다. 서버 쪽 중복 신청 멱등 처리는 하지 않는다(합법적인 복수 신청과 충돌). `pledges.test.ts`에 `findFundingOrderByOrderNo`가 던지는 경우 201을 돌려주는지 추가한다.

**비고** — 검증자 adjusted: 원안의 서버 멱등 절은 뺐다.

#### FND-29. 디지털 리워드 설명·내려받기 안내가 메일에 내려받기 주소가 온다고 적지만 메일에는 확인 페이지 링크만 있다 [P3 · S]

**어디** — `content/funding/mok-jareugi.md:42,95,238`, `content/funding/keep-singing-for-palestine.md:23,75,366`, `lib/funding/email.ts:160-187`, `content/funding.test.ts`.

**지금 코드**

```yaml
# content/funding/mok-jareugi.md:42
description: 앨범 13곡 전체를 MP3 320kbps로 보내 드립니다. 내려받기 주소는 결제 확정 메일과 펀딩 확인 페이지에 함께 보내 드립니다.
```

**왜 문제인가** — 리워드 description 네 곳과 '## 내려받기 안내' 본문 두 곳(`mok-jareugi.md:238` '결제가 확정되면 내려받기 주소를 메일로 보내 드립니다', `keep-singing-for-palestine.md:366`)이 메일로 내려받기 주소를 보낸다고 적는다. `email.ts:160-187`은 파일 이름과 펀딩 확인 페이지 링크만 싣는다. 이 방식은 2026-09-15 #137에서 바뀌었고 리워드 설명은 그 뒤(#367·#399·#431)에 쓰였으니 처음부터 맞지 않았다.

**어떤 조건에서 어떤 결과** — 메일의 확인 페이지 링크를 따라가면 내려받기 버튼에 닿으므로 후원자가 막히지는 않는다. 메일에서 링크를 찾는 후원자가 '안 왔다'고 문의할 수 있고, 표시·광고와 이행이 다르다는 주장의 근거가 될 수 있다.

**수정** — 여섯 곳을 현재 동작대로 쓴다. 예: description은 '내려받기는 결제 확정 메일의 링크로 여는 펀딩 확인 페이지에서 하실 수 있습니다.', 본문은 '결제가 확정되면 메일로 펀딩 확인 페이지 링크를 보내 드립니다. 내려받기는 그 페이지에서 시작합니다.'. 이전 방식 언급이나 정정 표현 없이 맞는 내용만 쓴다. description은 funding.baseline의 id·금액 불변식과 무관해 기준선이 서지 않고 약관 해시 대상도 아니다. `content/funding.test.ts`에 '디지털 리워드 문구는 메일로 내려받기 주소를 보낸다고 적지 않는다' 정규식 가드를 하나 둔다.

**비고** — 검증자 정정: 네 곳이 아니라 여섯 곳.

#### FND-30. [FND-1 수정 제약] 만료된 온라인 계좌 입금 신청은 늦은 입금 확정·이름 대조에 쓰이므로 미결제 PII 파기에서 토스 만료와 달리 다뤄야 한다 [P3 · M]

**어디** — `lib/funding/bankTransfer.ts:203-221`(`findSameNameBankDeposits`), `:110-111`(`confirmBankDeposit`), `pages/[locale]/funding/manage/[orderNo].tsx:143-147`, `pages/admin/funding/[id].tsx:71`, `pages/api/admin/funding/pledges/index.ts:101`, `lib/funding/retention.ts`, `lib/privacy/orderRetention.ts`.

**지금 코드**

```ts
* 같은 이름으로 들어온 **다른** 계좌 입금 신청 중 아직 입금 확인 전(pending)이거나 닫힌(expired) 것.
...
      WHERE o.type = 'funding' AND o.id != ${order.id}
        AND TRIM(o.customer_name) = TRIM(${order.customerName})
        AND fp.payment_method = 'bank_transfer' AND fp.entry_source = 'online'
        AND o.status IN ('pending', 'expired')
```

**왜 문제인가** — 현재 코드의 결함이 아니라 FND-1을 구현할 때 지켜야 할 제약이다. expired 온라인 계좌 입금은 (a) 같은 이름 후보 조회(관리자 상세·수기 등록 409 후보) (b) 늦은 입금 확정(expired→paid) (c) 확인 페이지의 '이미 입금하셨다면 … 확인한 뒤 펀딩을 확정해 드립니다' 안내에 쓰인다. 계좌 입금은 자동 취소가 없다는 운영자 결정과 일치한다. pending 계좌 입금은 기한이 지나도 닫히지 않으므로 이 제약은 expired에만 걸린다.

**어떤 조건에서 어떤 결과** — FND-1을 만료 상태 전반에 일괄 적용하면 늦은 입금(계좌 입금의 가장 흔한 예외)이 '돈은 받았는데 누구 것인지 모르는' 입금이 되고, SAF2026에서 났던 수기 이중 등록 사고가 되살아난다.

**수정** — 별도 이슈로 세우지 말고 FND-1 수정안에 제약으로 합친다: 토스 expired/failed는 FND-1의 창으로 파기하되, `payment_method='bank_transfer' AND entry_source='online' AND status='expired'`는 별도(더 긴) 보존 창을 두고(처리방침 8항에 명시) 창이 지난 뒤에만 표식으로 덮는다. `findSameNameBankDeposits`와 manage 안내는 파기된 행(`customer_name=PURGED_MARK`)을 제외하도록 함께 고치고, 통합 테스트에 '창 안의 만료 계좌 입금은 파기되지 않는다'를 추가한다. 창 길이는 늦은 입금 실태를 보고 정할 운영 판단이며, 처리방침 문구가 바뀌면 펀딩 약관 판본 게이트를 탄다.

**비고** — 검증자가 P2→P3로 내림: 단독 이슈로는 실행할 변경이 없는 설계 메모.

#### FND-31. 취소를 요청한 계좌 입금 후원이 송금 기록 전까지 공개 명단·익명 메시지에 남는다 [P3 · S]

**어디** — `lib/funding/service.ts:430-461`(names·listable·anonymousMessageRows), `lib/funding/refundable.ts:72-73`, `lib/funding/cancel.ts:176-207`, `pages/api/funding/cancel.ts`, `lib/funding/CLAUDE.md:252-258`.

**지금 코드**

```sql
WHERE fp.project_slug = ${project.slug} AND ${countedFundingPledgeSql()} AND fp.display_name_public = 1
      AND o.customer_name <> ${PURGED_MARK}
      AND (fp.public_name IS NULL OR fp.public_name <> ${PURGED_MARK})
      AND fp.listing_hidden_at IS NULL
```

**왜 문제인가** — 세 쿼리가 모두 `countedFundingPledgeSql()`만 거르고 `refund_requested_at`을 보지 않는다. 계좌 입금 셀프 취소는 주문을 `paid`로 둔 채 표식만 찍으므로, 운영자가 송금 완료를 기록할 때까지 이름·메시지가 계속 뜬다. 후원자는 확인 페이지의 `SupporterListingEditor`(`manage/[orderNo].tsx:176`, `display-name.ts:32-38`이 paid 허용)로 직접 끌 수 있어 완화되어 있다. 운영자 결정으로 문서화된 바는 없다(CLAUDE.md는 입금 대기만 말한다).

**어떤 조건에서 어떤 결과** — 취소를 요청하고도 공개를 끄지 않은 후원자의 이름·메시지가 송금 기록 때까지 며칠 더 공개된다. 모금액은 돌려줄 돈을 포함해 잠시 과대 표시된다.

**수정** — 세 쿼리의 WHERE에 `AND fp.refund_requested_at IS NULL`을 같이 더한다. listable도 같은 조건이어야 `anonymousBackerCount`가 어긋나지 않는다. 모금액·건수는 그대로 둔다. 환불 요청 철회(`clear_refund_request`)는 상태 기반 조건이라 명단이 자동 복귀한다. 재검증(`res.revalidate`) 추가는 뺀다 — 첫 폴링이 `initialStatus`를 덮고 상태 API는 CDN `s-maxage=15+swr=60`이라 비워지지 않는다. `service.integration.test.ts`에 환불 요청 건 케이스를 넣고, `lib/funding/CLAUDE.md` 계좌 입금 절에 '환불 요청 접수 건은 명단·메시지에서 빠지고 모금액·건수는 송금 기록까지 센다'를 적는다.

**비고** — 검증자 adjusted: 영향이 과장되어 있었다(후원자가 즉시 끌 수 있음).

#### FND-32. 보이지 않는 문자만으로 된 결제자 이름이 검증을 통과해 명단·익명 수·메시지에서 조용히 사라진다 [P3 · S]

**어디** — `lib/funding/validation.ts:37-38`(`text()`), `lib/funding/service.ts:464-466`, `pages/api/admin/funding/pledges/index.ts:78-80`, `lib/funding/publicName.ts`, `lib/funding/validation.test.ts:173`, `lib/funding/service.integration.test.ts:518-526`.

**지금 코드**

```ts
const listed = names
    .map((n) => ({ ...n, display_name: stripInvisible(n.display_name).trim() }))
    .filter((n) => n.display_name !== '');
  ...
    anonymousBackerCount: Math.max(0, Number(totals[0]?.backers ?? 0) - Number(listable[0]?.n ?? 0)),
```

**왜 문제인가** — `customerName` 검증이 `trim()`만 해서 U+200B·U+3164 등만 있는 이름이 통과한다. 명단 SQL은 그 행을 세고(listable) TS 단계에서 `stripInvisible` 뒤 빈 이름을 버리므로, 명단에도 `anonymousBackerCount`에도 안 잡히고 메시지도 사라진다. '빈 이름은 뺀다'는 의도된 동작이고 두 테스트가 고정해 두었다. 이름이 비면 입금자명 대조·배송 표기에도 쓸 수 없다. 수기 등록 라우트는 `validateCreatePledgePayload`를 쓰지 않고 자체 검사(trim도 안 함)라 따로 고쳐야 한다.

**어떤 조건에서 어떤 결과** — 보이지 않는 문자만으로 이름을 쓰는 것은 의도적 입력이 아니면 거의 없다. 발생하면 명단 인원과 건수가 어긋나고, 공개에 동의한 후원자의 메시지가 오류 없이 사라지며, 이름을 식별할 수 없는 후원이 운영자 화면에 쌓인다.

**수정** — `validateCreatePledgePayload`에서 `customerName`에 `stripInvisible(v).trim() !== ''`를 요구하고 실패 시 '이름을 확인해 주세요.'를 돌려준다. 수기 등록 라우트(`index.ts:78-80`)에도 같은 검사를 넣는다. `validation.test.ts:173`의 '알려진 동작' 테스트는 거부 기대로 바꾼다. `service.integration.test.ts:518`의 빈 이름 제외 테스트는 이미 저장된 옛 행 대비로 남긴다. 집계 쪽 `anonymousBackerCount` 보정은 하지 않는다. 우선순위는 낮다.

**비고** — 검증자 adjusted: 입구 차단으로 충분.

#### FND-33. 일부 환불(partially_refunded) 후원자의 확인 페이지에는 취소 버튼도, 막힌 이유도, 발송 상태도 없다 [P3 · S]

**어디** — `pages/[locale]/funding/manage/[orderNo].tsx:224-265`(`:226` 취소 분기), `:161`(리워드 발송 줄), `:136`(배지 톤), `lib/funding/cancel.ts:110-113`, `lib/funding/policy.ts:115`(`assessSelfCancel`, `CANCEL_BLOCK_MESSAGES`), `tests/pages/funding/manage/[orderNo].test.ts`.

**지금 코드**

```tsx
) : status === 'paid' && !refundRequested && (p.canCancel
            ? (
            ...
            : (
              <Panel variant="outline" className="mt-6">
                <p className="typo-card-meta">{p.cancelBlockedReason} 문의: 010-4255-7893 · hello@studionol.co.kr</p>
```

**왜 문제인가** — 서버(`cancel.ts:111-113`)는 부분환불 건의 셀프 취소를 '일부 환불된 펀딩은 문의해 주세요'로 거절하지만, 화면은 `status === 'paid'`일 때만 취소 버튼이나 `cancelBlockedReason` 패널을 그린다. 161행의 '리워드 발송' 줄, 136행의 배지 톤도 `paid`만 본다. 같은 페이지의 명단 편집기와 내려받기는 `isLive`(paid·partially_refunded)를 쓰는데 이 셋만 빠졌다. 줄 단위 환불(0044) 뒤의 후원은 `partially_refunded`로 살아 있는 정상 상태다(CLAUDE.md '드문 예외가 아니라 정상 상태'). `assessSelfCancel`은 이 상태에 `not_paid`를 돌려주므로 `cancelBlockedReason`이 '결제가 확정된 펀딩만 취소할 수 있습니다'가 되는데, 이 문구는 그 상태에 틀린 말이라 화면에 그대로 쓸 수 없다.

**어떤 조건에서 어떤 결과** — 책만 환불받은 사바하 후원자가 CD 발송 상태를 확인하거나 나머지 취소를 문의할 길이 화면에 없다. 부분환불은 운영자가 줄 단위 환불을 한 뒤에만 생기고 후원자에게 사유 메일이 가서 영향 범위는 좁다.

**수정** — `isLiveFundingOrderStatus(status)` 기준으로 발송 줄·배지를 그리고, `partially_refunded`면 `cancel.ts`의 문구를 `CANCEL_BLOCK_MESSAGES`에 `partially_refunded: '일부 환불된 펀딩은 문의해 주세요.'`로 옮겨 `assessSelfCancel`이 그 코드를 돌려주게 한다(서버 111-113행도 같은 상수를 쓴다). `CancelEligibility` 유니온과 `cancelBlockedMessage` 구조에 그대로 들어맞는다. `tests/pages/funding/manage/[orderNo].test.ts`에 partially_refunded 케이스 추가.

**비고** — 검증자 confirmed.

#### FND-34. 관리자 수기 등록은 orders INSERT에 재고 조건이 없어 사후 failed 마킹에 기대고, 주석은 이미 바뀐 온라인 경로를 가리킨다 [P3 · S]

**어디** — `pages/api/admin/funding/pledges/index.ts:216-233`(orders INSERT, `:219`), `:259-290`(주석·사후 failed 마킹 `:274-281`), `lib/funding/service.ts:199-206,215-232,268-274`, `lib/funding/admin-list.ts:18-25`, `tests/api/admin/funding/pledges/index.integration.test.ts:194-200`.

**지금 코드**

```ts
* 그래서 진 쪽의 주문을 **온라인 경로와 같은 모양으로** 정리한다 — `status='failed'`
     * (lib/funding/service.ts createFundingPledge의 품절 처리와 같다).
...
    if (rowsAffectedOf(result[1]) === 0) {
      ...
        await db.update(orders).set({ status: 'failed', notificationError: null, updatedAt: now })
```

**왜 문제인가** — 온라인 경로는 #248(`797f8c3fe9`)에서 `orders` INSERT에도 `stockCondition`을 실어 '품절이면 세 문장이 전부 0행이라 사후 정리가 아예 필요 없다'로 바뀌었다. 수기 등록은 아직 `db.insert(orders).values(...)`로 무조건 넣고 pledge·items만 조건부라, 품절 경합에서 `paid` 고아 주문이 생긴 뒤 UPDATE로 `failed`를 찍는다. 되돌림 UPDATE가 던지면 pledge 없는 `paid` 주문과 `SEND_PENDING` 센티널이 남는다(주석이 스스로 인정). 수기 쪽 주석은 '온라인과 같다'고 하는데 이미 사실이 아니고, `admin-list.ts:18-25`도 옛 동작을 근거로 적고 있다.

**어떤 조건에서 어떤 결과** — 같은 상황을 두 경로가 다른 모양으로 남겨 세는 사람이 헷갈리고(수기만 failed 고아가 생긴다), 되돌림 실패 시 헬스체크가 영구 경보를 낸다. 수기 등록은 운영자 수동 작업이라 품절 경합 자체가 드물다.

**수정** — 수기 등록의 `orders` INSERT를 온라인과 같은 `INSERT … SELECT … WHERE ${stockCondition}`(sql 템플릿)로 바꿔 세 문장이 함께 0행이 되게 하고, 274-290행의 사후 failed 마킹을 지운다. 이 동작을 고정하는 `index.integration.test.ts:194-200`을 같이 바꾼다. `admin-list.ts:18-25` 주석은 'pledge 없는 주문은 과거 데이터에만 남아 있다'로 고친다.

**비고** — 검증자 confirmed.

#### FND-35. 결제 뒤 명단 공개 재동의에 시각이 남지 않는다 [P3 · M]

**어디** — `pages/api/funding/display-name.ts:99-125`(`:99-106` UPDATE, `:111-118` 닉네임 알림), `lib/funding/service.ts:276-294`, `db/schema.ts:515,535`, `components/funding/SupporterListingEditor.tsx`.

**지금 코드**

```ts
const saved = await getDb()
    .update(fundingPledges)
    .set({ displayNamePublic, ...(publicName !== undefined ? { publicName } : {}), updatedAt: new Date() })
```

**왜 문제인가** — 폼에서의 공개 동의는 `terms_agreed_at`·`terms_version`과 함께 생성 때 기록되지만, 결제 뒤 켜는 경로는 `display_name_public`·`public_name`·`updated_at`만 쓴다. `updated_at`은 발송 상태 등 다른 쓰기도 갱신하므로 동의 시점의 증거가 못 된다. `db/schema.ts:515`가 이 칸을 '후원자의 동의 기록'이라 부르는 것과도 어긋난다. 닉네임으로 새로 오를 때만 운영자 메일이 가서 실명·가린 이름 공개는 기록이 없다.

**어떤 조건에서 어떤 결과** — 후원자가 공개에 동의한 적 없다고 다투면 생성 시점 값과 켜진 시점 사이를 보일 기록이 없다. 분쟁 가능성은 낮고 후원자가 직접 끌 수 있다.

**수정** — 가장 단순한 안은 운영자 알림(`sendFundingListingNicknameAlert`와 같은 형식)을 공개가 새로 켜질 때마다 보내는 것이다. 메일 시각이 곧 기록이 된다. 구조화된 기록이 필요하면 `funding_listing_consents`(pledge_id, 켠/끈 구분, 표시 방식 style, terms_version, at) 표를 0037 방식으로 따로 두되 이름 사본은 넣지 않는다 — 이름을 넣으면 1년(`retention.ts`)·5년(`orderRetention.ts`) 파기 경로에 편입해야 하고(`listing_hidden_name` 때도 두 경로 모두 지우도록 했다, `schema.ts:535`) 배포 순서(마이그레이션 먼저)도 따라온다. 우선순위는 낮다.

**비고** — 검증자 adjusted: 원안의 새 표는 무겁고 파기 편입이 빠져 있었다.

**클린 판정**
- lib/funding/confirm.ts 승인 경로 — 서버 저장 금액 대조(위변조 차단), 홀드 만료 처리, ALREADY_PROCESSED 재조회 검증, DECLINE allowlist, paid 재진입 소유 증명(paymentKey+금액), 센티널 CAS로 확정 메일 1회, 웹훅 신뢰 경로의 expired·failed 되살림과 흔적 메모 batch, payments unique 멱등 판정
- lib/funding/cancel.ts 토스 취소 — 선점→토스→델타 INSERT 순서, 선점 WHERE의 발송·내려받기 가드, 실패 시 done 환불 합계로 되돌림 판정(전액 환불된 건 부활 방지), 웹훅 동기화와의 이중 기록 차단, 계좌 입금 환불 계좌 선점·롤백
- lib/funding/lineRefund.ts 줄 단위 환불 — refunded_quantity 선점 + RETURNING 기반 멱등 키, NETWORK_ERROR 시 선점 유지
- lib/funding/bankTransfer.ts 입금 확인·미입금 취소 전이, 한정 재고 재검증(fail-closed), 센티널 규약, countedFundingPledgeSql 한 곳으로 집계 집합 통일 (lib/funding/refundable.ts)
- lib/funding/service.ts 재고 조건을 INSERT에 싣는 원자적 생성, 자기 홀드 해제의 소유 증명(previousOrderNo), 인원 신원 키 정규화, 명단 4중 필터(동의·PURGED_MARK·운영자 숨김·stripInvisible)와 익명 메시지 판본 게이트 — 공개 명단의 유일한 조회 경로가 aggregateProjectStatus임을 grep으로 확인
- lib/funding/publicName.ts + validation.ts — 가린 이름·닉네임·보이지 않는 문자·결합 부호만의 닉네임 거부, customerName === PURGED_MARK 거부, 상한 초과 거부(조용한 잘림 없음)
- pages/api/funding/display-name.ts — 토큰 대조 404 통일, 운영자 숨김 후 켜기만 409(철회는 허용), WHERE로 조회-UPDATE 창 차단
- pages/api/funding/download.ts — POST 전용, 담은 리워드의 키만 서명, 서명→HEAD→기록 순서, 환불 요청·주문 상태를 UPDATE WHERE에서 재검사, 0행 판정 문구
- pages/api/funding/cancel.ts, pledges.ts — 레이트리밋 위치(검증 후), IP는 x-vercel-forwarded-for 사용
- pages/[locale]/funding/success.tsx — 확정 쿠키(HttpOnly·Path 한정·30분), 비밀값 없는 리다이렉트, 승인 URL 훑기 오라클 레이트리밋, not_live 분기 / manage/[orderNo].tsx — 토큰 상수시간 대조, 조회 실패와 부재 구분, 취소 판정 화면·서버 동일 함수 / fail.tsx — code만 받아 표로 옮김
- MarkdownRenderer 보안 — disableParsingRawHTML, isAllowedLinkHref(프로토콜·백슬래시), 외부 링크 rel, 등록되지 않은 외부 이미지는 <img>가 아니라 링크로 강등(MarkdownImage.tsx 94-110행), 신뢰 숏코드 저장 시점 제거(creatorContent.ts)와 렌더러 정규식 일치
- lib/analytics/privatePaths.ts, next.config.mjs, middleware.ts의 funding 경로 — manage·success·fail 비공개 등록과 no-store, /pledge를 일부러 측정에 둔 사유 확인, CSP frame-src youtube-nocookie
- content/fundingTerms.baseline.test.ts + content/fundingTermsHash.ts — 해시 대상(약관 16조·ko 처리방침·공유 상수·수탁자 표), 갱신 경로 자물쇠(assertBaselineUpdateAllowed); 3개 스위트 실행 통과(fundingTerms.baseline, retention, publicStatus)
- lib/funding/retention.ts + orderRetention.ts — PURGED_MARK 덮어쓰기 규칙(public_name NULL 보존, 표식 처리), fulfillment_updated_by 보존 근거, 멱등 WHERE, 서로의 실패에 걸리지 않는 purge-funding 크론 구조
- lib/funding/csv.ts 수식 주입 방어, r2.ts 서명 만료 10분·키 형식 검사, goal.ts·amounts.ts 계산(정수 분해에 반올림 모호성 없음), projectState.ts·useFundingStatus.ts의 KST 오프셋 기반 마감 판정과 단방향 상태 병합
- docs/code-review-2026-08-24*.md, 2026-09-08-seo-aeo-geo.md 3건 — 펀딩·결제 관련 지적이 없어 '이전 리뷰 미처리'로 다시 올릴 항목 없음
- lib/funding/confirm.ts 승인 batch(payments INSERT 선행·되살림 흔적·전이 0행 처리)와 ALREADY_PROCESSED 재조회·DECLINE allowlist — 1라운드 판정과 같이 문제 없음(단, 실패 message가 success.tsx에서 버려지는 것은 별도 지적)
- lib/funding/cancel.ts 토스 선점→취소→되돌림 판정(done 합계 기준)과 계좌 입금 환불 계좌 선점·롤백 순서, safeDbErrorSummary 로그
- pages/api/funding/download.ts — POST 전용·토큰 404 통일·서명→HEAD→기록 순서·0행 뒤 환불 판정 문구
- pages/api/funding/display-name.ts — 운영자 숨김 뒤 켜기 409·WHERE로 창 닫기·닉네임 알림(끄기 허용)
- lib/funding/publicName.ts·validation.ts — stripInvisible·maskName 코드포인트 계산·PURGED_MARK 이름 거부·상한 초과 거부
- lib/funding/retention.ts·lib/privacy/orderRetention.ts — PURGED_MARK 덮기 규칙, listing_hidden_name 삭제, fulfillment_updated_by 보존, refund_accounts 5년 삭제, 1년 경계 테스트
- lib/email/layout.ts escape(strong·preheader·rows) 사용 — email.ts의 사용자 입력 보간은 escapeHtml/strong을 지난다
- middleware.ts CSP — 토스·카카오 우편번호·youtube-nocookie 출처가 script/frame/connect-src에 맞게 들어 있다
- lib/analytics/privatePaths.ts·next.config.mjs — manage·success·fail·pledge의 no-store·측정 제외, success 측정 예외의 SECRET_QUERY_PATTERN 안전장치
- lib/payments/refundAccount.ts·refundAccountView.ts — 계좌번호만 암호화, 복호화는 관리자 GET 응답에만, 접속기록 refund_account_view
- lib/booking/webhook.ts 펀딩 분기 — DONE은 trustedByWebhook 확정, CANCELED는 syncFundingCancelledFromToss, recording_failed·toss_rejected만 재시도
- lib/ops/healthCheck.ts 펀딩 점검 — 환불 대기 48h 경보, 전액 환불됐는데 살아 있는 주문, 파일/DB slug 충돌, 미발송 파기 임박
- pages/api/admin/funding/pledges/[id].ts 메모 CAS(memoUnchanged)·보호 기록 삭제 차단·센티널 보존 규칙
- pages/api/admin/funding/export.ts — 접속기록(성공·실패 모두)·수식 주입 방어·LIVE 상태만 내보내기
- lib/funding/bankTransfer.ts 입금 확인·미입금 취소 전이와 통합 테스트(두 번 눌러도 한 번, 늦은 입금, 재고 재검증)
- content/fundingTerms.baseline.test.ts·policy.test.ts·publicName.test.ts 3개 스위트 실행 통과(67 tests)
- components/funding/PledgeWizard.tsx — ref 재진입 가드, sessionStorage 홀드 증명·선택 복원, 계좌 입금 시 한정 리워드 차단이 서버와 같은 함수
- content/funding/*.md frontmatter 시각이 전부 +09:00 명시, computeProjectState/isPastFundingEnd 경계(live는 endAt 미만) 일관

**읽지 못한 범위**
- 개설자 영역(범위 제외): lib/funding/creator*.ts, payout*.ts, reviewDecision/reviewTransition/reviewEmail, projectServices.ts, residentNumber.ts, mediaRetention.ts, pages/api/funding/creator/**, pages/[locale]/funding/creator/**, apply.tsx, creator-terms.tsx — 후원자 PII가 닿는 접점(creatorShipping 소유 확인, fulfillment creator 분기)만 읽음
- 관리자 영역: pages/admin/funding/**, pages/api/admin/funding/**, lib/funding/admin-list.ts·admin-serialize.ts·adminProjects.ts는 읽지 않음 — 관리자 화면의 PII 노출·CSV 내보내기·입금 확인 UI는 미검증
- components/funding/FundingGallery.tsx, FundingLineupPerson.tsx(숏코드 레지스트리 컴포넌트)는 훑지 않음
- lib/payments/bankAccount.ts·refundAccount.ts·depositGuideThrottle.ts, lib/booking/toss.ts(키 쌍 선택·재시도), lib/booking/webhook.ts 전체, lib/email/resend.ts는 호출부와 인용 부분만 읽음
- 운영 DB(Turso)·Vercel 로그·Resend 설정은 읽기 금지라 실제 보존 상태·로그 보존 기간·인덱스 실존(마이그레이션 SQL grep으로만 확인)은 미확인
- 인덱스·상태 API 지적의 성능 영향은 실측하지 않음(EXPLAIN QUERY PLAN·부하 시험 없음) — 스키마·쿼리 읽기 기반 추정
- content/funding/*.md 본문의 사실 정확성(수치·인용)과 check:claims·check:facts는 점검하지 않음
- 테스트는 3개 스위트만 실행(fundingTerms.baseline, retention, publicStatus). 전체 jest·build·type-check는 돌리지 않음
- 카카오 우편번호 스크립트 같은 서드파티가 PII 입력 폼과 같은 문서에서 실행되는 점, consumeRateLimit이 호출마다 만료 행 DELETE를 쓰는 점(lib/booking/rate-limit.ts:55), 이동통신 CGNAT 환경에서 IP당 20회/시간·한정 리워드 5회/15분 한도가 정상 후원자를 막을 가능성은 overflow로 적고 정독하지 않음
- pages/admin/funding/index.tsx·projects/**, pages/api/admin/funding/projects/** — 목록 화면·프로젝트 심사·정산 API는 읽지 않음(관리자 상세 [id].tsx는 PII 표시·재발송 분기만 읽음)
- 개설자 영역 전반(lib/funding/creator*.ts, payout*.ts, reviewDecision/reviewTransition, pages/api/funding/creator/**, pages/[locale]/funding/creator/**, apply.tsx, creator-terms.tsx) — creatorShipping.ts만 읽음
- components/funding/FundingAudioPlayer.tsx·FundingVideo.tsx·RewardCard.tsx·FundingGallery.tsx(머리만)·FundingLineupPerson.tsx(머리만)·PledgeWizard.test.tsx·RewardModal.test.tsx — 1라운드가 읽은 범위에 기대고 정독하지 않음
- lib/funding/faq.ts·mediaAccess.ts·mediaRetention.ts·payout.ts(195-260행만)·pages/api/funding/media/[...path].ts — 읽지 않음
- drizzle/migrations SQL 원문·인덱스 실존, 운영 DB(Turso)·Vercel 로그·Resend 설정 — 읽기 금지라 미확인
- 통합 테스트(*.integration.test.ts)는 실행하지 않음(libsql 환경 필요) — 테스트 이름과 단언만 대조
- lib/email/resend.ts의 제목 개행 처리, Toss 멱등키의 실패 응답 캐시 동작 — 외부 사양이라 확인하지 못해 overflow에만 적음
- content/funding/*.md 본문의 사실 정확성과 check:claims·check:facts — 범위 밖으로 두고 점검하지 않음

**미검증 후보(overflow)**
- 카카오 우편번호 스크립트(t1.kakaocdn.net, 버전 고정·SRI 없음)가 이름·전화·이메일을 입력하는 같은 문서에서 실행된다 — components/funding/kakaoPostcode.ts:6. 클릭 시에만 로드하지만 공급망 위험 한 줄 기록(P3, confidence 0.3).
- consumeRateLimit이 호출마다 `DELETE FROM rate_limits WHERE expires_at <= now`를 실행한 뒤 UPSERT한다 — lib/booking/rate-limit.ts:55. 만료 행이 없어도 쓰기 문장 2개가 나간다(펀딩 cancel·display-name·download·confirm 실패 경로가 모두 이를 쓴다). 만료 정리를 확률적(1/20)이나 크론으로 옮기면 된다(P3, 0.5).
- IP당 후원 생성 20회/시간(pledges.ts FUNDING_CREATE_LIMIT)·한정 리워드 5회/15분(MAX_LIMITED_TOSS_ATTEMPTS_PER_IP)은 국내 이동통신 CGNAT에서 많은 사용자가 같은 IP를 공유하므로 집회·SNS 확산 순간에 정상 후원자를 429로 막을 수 있다. 키에 이메일 해시를 섞거나 한도를 올리는 것을 검토(P3, 0.35). 계좌 입금 남용 상한은 운영자 결정이라 건드리지 않는다.
- pages/api/funding/media/[...path].ts는 이미지 요청마다 funding_projects 전 행에 대해 instr()로 본문(content) 전체를 스캔한다(mediaAccess.ts isApprovedFundingMedia). 공개 이미지는 immutable 캐시라 첫 요청만 비싸지만 개설자 프로젝트가 늘면 이미지 한 장당 본문 N개 스캔 — 승인 시점에 참조 키 표(media_refs)를 만들어 조회를 인덱스로 바꿀 수 있다(P3, 0.4).
- 미결제 신청(만료)의 응원 메시지·닉네임은 공개 집계에 안 들어가지만, 계좌 입금 online 대기분은 입금 확인 전에도 이름·메시지를 공개 명단에 올린다(운영자 결정 2026-10-04). 결정 자체는 존중하되 타인 실명으로 신청해 명단에 올리는 사칭 위험은 운영자 알림 메일의 '명단' 줄 확인에 의존한다는 점을 기록한다.
- lib/funding/service.ts가 514줄에 인원 신원 키·재고 조건·생성·만료·공개 집계를 한 파일에 담고 있다. 명단/집계(aggregateProjectStatus 계열)를 service.public.ts로 나누면 위 명단 상한·정렬 수정이 리뷰하기 쉬워진다(P3).
- allowedRemoteImageHosts.ts 머리 주석과 MarkdownImage.tsx의 isSafeForNextImage 주석은 등록 안 된 외부 이미지를 '평범한 <img>로 강등'한다고 적지만 실제 구현은 링크로 내린다(94-110행) — 주석 정정(P3).
- lib/funding/confirm.ts:219 홀드 만료 판정이 `Date.now()`를 쓰고 그 아래 272행에서 `now`를 새로 만든다 — 한 함수 안에 시계가 둘이라 테스트에서 시간을 고정하기 어렵다. `now`를 함수 머리에서 한 번 만들어 둘 다 쓰기.
- lib/funding/service.ts:479·485 명단·메시지의 `at: paid_at ?? created_at` — 계좌 입금 대기 때는 신청 시각, 입금 확인 뒤에는 확인 시각으로 바뀌어 BackerWall 날짜·정렬이 한 번 점프한다. 공개용 시각은 `created_at`으로 고정하거나 둘 중 하나로 결정해 적을 것.
- [1라운드 #5·#6 연쇄] 명단 LIMIT 100을 걷어내면 `/api/funding/[slug]/status` 응답이 후원 수에 비례해 커지고(메시지 500자×N) CDN 캐시·preload 크기에 영향 — 명단은 별도 페이지네이션 엔드포인트로 분리하거나 상태 API에서 이름·메시지를 떼어내는 설계가 함께 필요하다(service.ts:430-490, useFundingStatus.ts:106).
- lib/funding/lineRefund.ts:153-158 토스 성공 뒤 재조회(`after`)가 실패하면 전액이 돌아갔어도 `partially_refunded`로 기록되고, refunds INSERT와 상태 UPDATE가 한 batch가 아니라 그 사이 공개 모금액에 환불액이 남는 창이 있다 — 둘을 batch로 묶고 상태는 SQL CASE(`doneSum >= total_amount`)로 정하기.
- pages/api/admin/funding/pledges/index.ts:224 수기 등록은 `customerName: b.customerName`을 trim 없이 저장하면서 90행의 PURGED_MARK 검사는 trim한 값으로 한다 — 앞뒤 공백이 붙은 이름이 저장돼 `backerIdentitySql`·메일 제목에 그대로 나간다. 온라인 경로처럼 trim한 값을 저장할 것.
- lib/funding/bankTransfer.ts:99-102 `resolved`가 프로젝트에 없는 리워드 줄을 조용히 버려 그 줄은 재고 재검증에서 빠지고, 105행 `isDigitalOrder`는 버리기 전 줄로 판정한다 — 리워드를 못 찾으면 `project_unavailable`처럼 확정을 거부하는 쪽이 안전하다.
- pages/api/funding/download.ts:52-54 IP 레이트리밋(60/h)이 토큰 대조보다 앞에 있어, 같은 NAT(사무실·이동통신 CGNAT)에서 제3자가 임의 요청으로 한도를 소진하면 정당한 후원자의 내려받기가 429로 막힌다 — 토큰이 맞는 요청은 주문번호 단위 한도로 가르고 IP 한도는 실패 요청에만 소비하기.
- pages/[locale]/funding/terms.tsx:54 제13조는 "익명"을 문자열로 적고 lib/funding/policy.ts:199 `ANONYMOUS_LABEL`은 해시 대상이 아니다 — 라벨을 바꾸면 화면과 약관이 갈리는데 게이트가 잡지 못한다. 조항에 `${ANONYMOUS_LABEL}`을 보간하거나 상수를 해시 대상에 넣을 것.
- lib/funding/email.ts:233·316·351 메일 제목에 `order.customerName`이 그대로 들어간다. validation.ts `text()`는 길이만 보고 개행·제어 문자를 거르지 않는다 — Resend가 JSON 제목의 CR/LF를 어떻게 다루는지 확인하지 못했으므로, 제목에 넣기 전 `stripInvisible`+개행 제거를 적용하는 편이 안전하다.
- content/fundingTerms.baseline.test.ts:59-60 기준선 `covers`가 'pages/[locale]/privacy-policy.tsx — POLICY_COPY_BY_LOCALE.ko'라고 적지만 실제 정본은 `data/privacyPolicy.ts`다 — 사람이 읽는 안내 문자열이라 판정에는 영향 없음, 경로만 고칠 것.
- pages/[locale]/funding/success.tsx:429·443 `manageUrl`에 `order.manageToken`을 encodeURIComponent 없이 넣고 pages/api/funding/pledges.ts:81은 인코딩한다 — 토큰이 base64url이라 지금은 같지만 생성기가 바뀌면 갈린다. 한 헬퍼(`manageUrlFor(order)`)로 통일(lib/funding/email.ts:18에도 같은 식이 있다).
- data/privacyPolicy.ts:327 16항 "요청 제한 창(길어도 한 시간)" — pages/api/funding/creator/login.ts:107·114는 이메일 해시·전역 키를 24시간 창으로 센다(IP 키는 전부 1시간 이내). 개설자 로그인 절(13~15항)에 하루 창을 적거나 16항 문구를 "IP 식별자는 길어도 한 시간, 이메일 해시는 하루"로 고칠 것.
- lib/funding/CLAUDE.md:178-205 '한 주문에 여러 리워드 — 담는다' 절은 2026-10-04 되돌림(ae5c62a952) 뒤에도 '담기' UI를 현재형으로 설명한다(1라운드 #12와 같은 뿌리) — 줄 표(`funding_pledge_items`)는 남고 UI만 되돌렸다는 사실을 첫 문단에 적을 것.
- pages/[locale]/funding/[slug]/index.tsx:145 `priceValidUntil: project.endAt.slice(0, 10)` — frontmatter가 문자열(+09:00)이면 맞지만 DB 프로젝트는 `toISOString()`(UTC)이라 KST 자정 전 마감은 하루 앞 날짜가 된다. `toKstDateString`(creatorDateInput.ts)으로 바꿀 것.

### FNC. 펀딩 — 개설자·심사·배송·정산·관리자
P0 0 · P1 2 · P2 8 · P3 27, 미검증 0

#### FNC-1. 작성중·철회된 프로젝트는 관리자 화면에서 보관(archive)할 수 없다 — submittedAt이 null이면 빈 문자열이 가서 400 [P1 · S]
① `pages/api/admin/funding/projects/[id].ts:324-328`, `pages/admin/funding/projects/[id].tsx:467` · `:598-601`, `lib/funding/reviewDecision.ts:63-70`, `pages/api/funding/creator/projects/[id]/withdraw.ts:64`
② 화면은 보관 버튼이 draft·submitted·changes_requested에서 켜지고(`canArchive`, :598-601) 요청 본문에 `expectedSubmittedAt: project.submittedAt ?? ''`를 싣는다(:467). 라우트는
```ts
const expectedSubmittedAt = typeof b.expectedSubmittedAt === 'string' ? b.expectedSubmittedAt : undefined;
if (!expectedSubmittedAt) {
  return res.status(400).json({ ok: false, message: '화면을 새로고침한 뒤 다시 시도해 주세요. (판본 정보 없음)' });
```
로 빈 문자열을 '판본 정보 없음'으로 거른다. 라우트를 통과시켜도 `decideProject`는 `new Date(input.expectedSubmittedAt).getTime()`이 NaN이면 conflict를 돌려준다(reviewDecision.ts:63-70).
③ 낙관적 잠금(expectedSubmittedAt)이 submittedAt이 존재하는 상태만 전제로 설계됐다. submittedAt이 null인 행은 둘이다 — 한 번도 제출하지 않은 draft, 그리고 withdraw로 돌아간 draft(withdraw.ts:64 `submittedAt: null`). request_changes는 submittedAt을 지우지 않으므로(reviewDecision.ts:124-131) changes_requested 보관은 정상이다. 전이표 `draft: { archive: 'rejected' }`(reviewTransition.ts:21-22)와 주석(:13-14 "보관은 마이그레이션 없이 미심사 상한(draftsMax=10)을 푸는 수단")이 draft 보관을 명시적으로 의도했는데 UI에서 막혀 있다. 테스트가 못 잡는다 — `lib/funding/reviewDecision.integration.test.ts:524-538`의 draft 보관 케이스는 expectedSubmittedAt 없이 `decideProject`를 직접 부르고, `tests/api/admin/funding/projects.test.ts:547`은 approve·reject·request_changes만 돌려 archive도 `''`도 없다. `?? ''`는 65c5544a9b(#435)에서 들어왔고 그 뒤 수정 커밋이 없다.
④ 운영자가 draft 프로젝트에서 보관을 누르면 매번 "화면을 새로고침한 뒤 다시 시도해 주세요"를 받고, 새로고침해도 같다. 개설자가 미심사 프로젝트 10개(`CREATOR_LIMITS.draftsMax`)에 닿으면 새 프로젝트를 못 만들고(`pages/api/funding/creator/projects.ts:60`의 메시지는 운영자 심사로 풀린다고 안내), 운영자가 풀 수단은 개설자에게 제출시켜 반려하는 것뿐이다. 스팸·방치 초안이 관리자 목록에 계속 쌓인다.
⑤ **수정**
1. 라우트(`pages/api/admin/funding/projects/[id].ts:324`): `const raw = b.expectedSubmittedAt; if (raw !== null && typeof raw !== 'string') → 400;` 로 받고 `const expectedSubmittedAt: string | null = raw === '' ? null : raw`로 빈 문자열을 null로 정규화한다.
2. `lib/funding/reviewDecision.ts`: input 타입을 `expectedSubmittedAt?: string | null`로 넓히고, null이면 `currentMs === null`일 때만 통과시키며 versionCondition을 `isNull(fundingProjects.submittedAt)`으로 둔다. draft가 그 사이 제출되면 isNull 조건이 0행이라 409로 떨어져 낙관적 잠금 의미가 유지된다.
3. 화면(`[id].tsx:467`)은 `project.submittedAt`(null 가능)을 그대로 보내고, `components/admin/fundingProjectActions.ts`의 `FundingProjectPatchBody`에서 해당 필드를 `string | null`로.
4. 회귀 테스트: `tests/api/admin/funding/projects.test.ts`에 draft(submittedAt=null) archive 200, 그 사이 재제출된 경우 409 케이스를 추가한다.
⑥ 검증자 확정. overflow 항목 "decideProject.versionCondition이 eq(submittedAt, Date)라 NULL 판본을 표현하지 못한다"가 같은 수정의 2번에 해당한다.

#### FNC-2. 이체 뒤 수기 등록·환불은 어느 층도 그 시점에 알리지 않는다 — 입금 확인만 payoutWarningOf를 달고, 이체 뒤 수기 등록은 헬스체크도 놓친다 [P1 · M]
① `pages/api/admin/funding/pledges/index.ts:48-306`, `lib/funding/cancel.ts:73-`, `lib/funding/lineRefund.ts:42-`, `lib/funding/bankTransfer.ts:137-138`, `pages/admin/funding/[id].tsx:79-81` · `:159-166`, `pages/api/admin/funding/projects/[id].ts:605-616`, `lib/ops/healthCheck.ts:971-976` · `:978-1007` · `:1024`
② 모금액을 바꾸는 운영자 쓰기는 네 갈래다 — 입금 확인·수기 등록·전액 환불·줄 환불. 그중 입금 확인만 정산 기록 경고를 돌려준다:
```ts
// bankTransfer.ts:137-138
const payoutWarning = payoutWarningOf(await loadProjectPayoutState(order.fundingPledge.projectSlug));
return { ok: true, emailSent, ...(payoutWarning ? { warnings: [payoutWarning] } : {}) };
```
관리자 후원 상세 GSSP도 `depositPayoutWarning = isBank && (pending||expired) ? payoutWarningOf(...) : null`로 입금 확인 확인창에만 싣는다(:79-81). 수기 등록 POST(pledges/index.ts:48-306)에는 `funding_project_payouts` 조회가 한 줄도 없고 201 응답은 `{ ok, orderNo }`뿐이다. `cancel.ts`·`lineRefund.ts`에는 'payout' 문자열이 0건이다. `handleRefund`(159-166) 확인창은 `${formatPriceAmount(refundableAmount)}원을 환불할까요? 되돌릴 수 없습니다.`뿐이다. `mark_payout_paid`(projects/[id].ts:605-616)는 기록값과 현재값을 다시 비교하지 않고 paid로 넘긴다. 헬스체크의 '이체 뒤 늦은 확정' 점검(:1024)은 `AND fp.entry_source = 'online'`만 본다.
③ 정산이 `pending`인 동안의 변동(수기 등록·환불)은 헬스체크 M10(:978-1007)이 `buildFundingPayoutPreview`로 매일 다시 계산해 high로 보고하므로 하루 안에 잡힌다. 그러나 (a) 기록 뒤 같은 날 변동이 생기고 그날 `mark_payout_paid`를 누르면 다음 헬스체크 전에 어긋난 금액으로 이체가 나간다. (b) 정산이 `paid`가 된 뒤의 수기 등록은 응답·폼·헬스체크(online 필터) 어디에도 뜨지 않는다 — 어떤 층도 알리지 않는 유일한 조합이다. (c) `paid` 뒤의 환불(청약철회의 정상 흐름)은 크론 경보가 의도적으로 꺼져 있고(:971-976 "이체 뒤 환불은 끌 수 없는 경보라 크론에 올리지 않는다") 행동 시점 경고도 없다. 환불액은 refunds 행과 FundingPayoutSection drift 패널(260행, DRIFT_FIELDS에 refundAmount)에 남지만 '개설자에게 청구할 차액' 장부는 없고 운영자가 그 패널을 열어야만 보인다. reopen에는 하드 가드가 있는 것(`publicStatusDecision.ts:63-69`)과 비대칭이다.
④ 이체 뒤 현장 후원을 수기 등록하면 그 돈이 정산에서 빠진 채 아무 알림이 없다(개설자 약관의 정산 약속 미이행). 이체 뒤 관리자 환불·줄 환불은 후원자에게 돈과 메일이 나가지만 개설자에게 청구할 차액을 아무도 프롬프트받지 않는다. 기록 뒤 같은 날 이체하면 다음 헬스체크 전에 어긋난 금액이 나간다.
⑤ **수정**
1. `lib/funding/cancel.ts`(requestedBy==='admin' 경로)와 `lib/funding/lineRefund.ts`의 ok 결과에 `warnings: [payoutWarningOf(await loadProjectPayoutState(slug))]`를 싣는다. cancel.ts는 이미 `'./bankTransfer'`를 import하고 `FundingCancelOutcome`에 `warnings?: string[]`(22행, 227행 사용)가 있으며 라우트 `pledges/[id].ts:62`와 UI `run`(134-143)이 그대로 notice로 띄우므로 배관이 다 있다 — `payoutWarningOf`를 payout.ts로 옮기지 말 것(순환 import 위험만 는다). lineRefund는 `LineRefundOutcome`에 warnings를 더하고 라우트 104행 부근에서 같은 모양으로 응답한다.
2. `pages/admin/funding/[id].tsx` GSSP의 `depositPayoutWarning`을 상태와 무관하게 계산해 `handleRefund`·`handleRefundLine` 확인창에도 붙인다. 수기 등록은 폼(`pages/admin/funding/index.tsx:197-262`)이 201 본문을 보지 않고 닫히므로 응답 경고 대신 `existing_deposit_candidates`와 같은 409 + `acknowledgePayoutRecorded: true` 게이트를 POST에 둔다.
3. `lib/ops/healthCheck.ts:1024`의 `AND fp.entry_source = 'online'`을 빼서 이체 뒤 수기 등록도 30일 보고에 넣는다(한 줄). 기존 테스트에 manual 케이스를 추가한다.
4. `mark_payout_paid`(projects/[id].ts:605-616)에서 `preview.netAmount !== preview.recorded.netAmount`면 `recordFundingPayout`의 `amount_changed`처럼 409로 거부하고 확인 플래그로만 통과시킨다 — 돈이 실제로 움직이는 지점의 가드가 확인창보다 확실하다.
5. 장기: 기록 뒤 델타를 적는 조정 표(healthCheck.ts 주석이 말하는 '회수 진행 상태를 담는 자리')는 마이그레이션이 필요하므로 `lib/funding/CLAUDE.md`의 배포 순서(마이그레이션 먼저) 규칙을 따른다.
⑥ 검증자 조정: pending 단계는 헬스체크가 매일 잡으므로 "drift 표를 열어 보지 않는 한 모른다"는 paid 뒤에만 맞고, 환불액 자체는 refunds 행에 남는다. 반대로 지적이 놓친 두 구멍(online 필터, mark_payout_paid 무비교)을 보탰다. 사후 재구성이 가능하므로 P0이 아니라 P1.

#### FNC-3. 정산 계좌·세금 구분 변경에 이력·알림이 없다 — 변경 전 뒤 4자리와 시각을 남기고 운영자·개설자에게 알릴 것 [P2 · M]
① `lib/funding/creatorProjectWrite.ts:571-580`, `pages/api/funding/creator/projects/[id].ts:162`, `lib/funding/creatorEmail.ts:95` · `:143`, `lib/funding/payoutEmail.ts:84-99`, `lib/funding/creatorAccountDecision.ts:166-176`, `db/schema.ts`
② `savePayoutSection`은 세션 하나로 바로 덮어쓴다:
```ts
await getDb().update(fundingCreators).set({
  taxType: value.taxType, payoutAccountEnc, payoutAccountLast4: payoutAccountLast4(value.account),
  ...(residentNumberEnc === undefined ? {} : { residentNumberEnc }), updatedAt: new Date(),
}).where(eq(fundingCreators.id, creatorId));
```
라우트는 `respondWriteResult(res, await savePayoutSection(auth.creatorId, validatedPayout.value))`로 그대로 통과시킨다(:162). creatorEmail.ts의 `send*`는 login·이름 변경·이메일 변경 셋뿐이고 정산 정보 변경 메일은 없다. 이 파일에 `recordPrivacyAccess` 호출도 없다. db/schema.ts에 변경 이력 표도 없다(audit/history 성격은 webhook_events뿐).
③ 7일 세션 하나로 taxType·payoutAccountEnc·last4가 즉시 덮어써지고 이전 값(뒤 4자리·세금 구분)을 남기는 표·접속기록·알림이 없다. 운영자는 이체 직전 '계좌 보기'로 현재 값만 열어 바뀐 사실을 알 수 없다. 개설자 이메일 변경(creatorAccountDecision.ts:166-176)은 session_version을 올리고 양쪽에 알리는데 같은 무게의 정산 계좌 변경에는 그 보호가 없다. 완화는 하나뿐 — 정산 기록 시 개설자에게 가는 '정산 금액 확정' 메일(payoutEmail.ts:84-99)이 뒤 4자리와 "금액이나 계좌가 다르면 이체 전에 알려 주세요"를 싣는다. 쿠키 유출에는 유효하지만 메일함 탈취에는 무력하다(다만 매직링크 단일 인증 설계에서 메일함 탈취는 계정 전체 탈취와 같다).
④ 계정 탈취(메일함·쿠키) 시 공격자가 계좌만 바꿔 두면 정산금이 다른 계좌로 나가고 이체 후 회수가 어렵다. 현재는 DB 개설자 프로젝트의 정산이 아직 없어(fulfillment.ts:72-77·lib/funding/CLAUDE.md:318-321 "지금 운영 DB의 후원은 전부 md 프로젝트 것") 노출 0이고, 정산이 시작되는 시점에 보강되어 있어야 한다.
⑤ **수정**
1. 별도 표 `funding_creator_payout_changes`(id, creator_id, changed_at, ip, prev_last4, next_last4, prev_tax_type, next_tax_type) — 0037 패턴. fundingCreators에 컬럼을 더하면 `payout.ts:283`의 관계 조회가 마이그레이션 전 배포에서 깨지므로 별도 표로 둔다. `savePayoutSection(creatorId, value, { ip })`가 변경 전 행을 읽어 last4·taxType이 실제로 바뀌었을 때만 INSERT하고, 표가 없으면 로그만 남기고 저장은 계속한다.
2. 같은 조건에서 `creatorEmail.ts`에 `sendCreatorPayoutChangedEmails`(개설자 이메일 + OPERATOR_EMAIL, `buildEmailLayout`, 뒤 4자리만). 실패는 `sendCreatorAccountOperatorFallback` 패턴.
3. 관리자 정산 패널(`FundingPayoutSection`) '계좌 보기' 옆에 마지막 변경 시각·이전 뒤 4자리를 표시하고, 정산 기록 응답 warnings에 '최근 7일 내 계좌 변경'을 싣는다. 거부 게이트·72시간 유예는 두지 않는다 — 운영자 한 사람이 수동 이체하는 규모에서 마찰만 는다.
4. 선택: `section==='payout'` 저장은 세션 발급 30분 이내만 허용(세션에 authenticatedAt).
⑥ 검증자 조정: 확정 메일 완화와 현재 노출 0을 들어 P1→P2. 같은 자리를 다른 축(SEC 인증·권한·입력 검증·헤더)도 지적: "단건 drizzle 쿼리 실패 로그에 바인딩 값(정산 암호문·예약/믹싱 고객 PII·서명 토큰)이 실린다 — 환불 계좌 경로만 요약 로그를 쓴다".

#### FNC-4. 승인된 DB 프로젝트와 같은 slug의 md가 나중에 생기면 개설자 배송·발송·정산·현황이 md 후원까지 모은다 — 런타임 가드가 없고 감지는 하루 한 번 헬스체크뿐 [P2 · M]
① `lib/funding/creatorShipping.ts:143-158` · `:118` · `:160` · `:181`, `lib/funding/fulfillment.ts:80-89`, `lib/funding/payout.ts:283`, `lib/funding/creatorStats.ts:82-87`, `lib/funding/repository.ts:10-13`, `pages/api/funding/pledges.ts:37-38`, `lib/funding/CLAUDE.md:326-336`, `lib/ops/healthCheck.ts:881-913`
② `loadCreatorShipping`은 `if (!project || project.reviewStatus !== 'approved') return null;` 뒤에 `WHERE fp.project_slug = ${project.slug}`로 후원을 모은다(loadSummary 118행, 행 조회 181행). `setFulfillment` 개설자 분기는 `where: and(eq(t.slug, pledge.projectSlug), eq(t.reviewStatus, 'approved')) ... project.creatorId !== actor.creatorId`(fulfillment.ts:80-89), `buildFundingPayoutPreview`는 `WHERE fp.project_slug = ${project.slug} AND o.status IN (...)`(payout.ts:283), `loadCreatorProjectStats`는 `getFundingProjectAsync(row.slug)`(파일 우선)이다. 후원 생성(pledges.ts:37-38)은 `getFundingProjectAsync`(파일 우선, repository.ts:10-13)로 프로젝트를 찾고 project_slug 문자열로 묶는다. lib/funding/CLAUDE.md:335는 '코드 가드는 없다'고 적는다.
③ 읽는 입구는 파일이 이기고 후원은 project_slug 문자열로만 묶이는데, 개설자 전용 입구들은 'DB 승인 행의 slug'로만 후원을 모으고 그 slug에 md가 생겼는지 보지 않는다. 가드는 DB→파일 방향(승인 `reviewDecision.ts:174-177`·저장 `creatorProjectWrite.ts:205`)뿐이다. 트리거는 운영자가 CLAUDE.md의 명시된 금지를 어기고 md를 커밋하는 것뿐이고, healthCheck.ts:881-913이 매일 승인 DB slug × 파일 slug 교집합을 'high'로 보고하며(`healthCheck.integration.test.ts:771-800`이 실제 smoke-test slug로 고정), 배송지는 DB 프로젝트가 endAt을 지나야 열린다(creatorShipping.ts:160 `isPastFundingEnd`).
④ 운영자 실수로 slug가 겹친 날부터 다음 헬스체크까지 ① 그 DB 개설자가 md 후원자의 이름·연락처·주소를 배송 화면·CSV로 받고 발송 상태를 쓸 수 있고(마감 뒤에 한함) ② 정산 gross에 md 후원이 합산되며 ③ 개설자 현황이 md 숫자를 보여 준다. 외부 입력으로는 발생하지 않는다.
⑤ **수정**: `lib/funding/slugOccupancy.ts`에 `hasFileProject = (slug) => getFundingProject(slug) !== null`(동기 파일 조회, DB 불필요)을 두고 개설자 전용 입구에서 거른다 — `loadCreatorShipping`(156행 뒤)·`loadFulfillmentGate` → null, `setFulfillment` 개설자 분기(fulfillment.ts:86) → forbidden. `buildFundingPayoutPreview`에 `slugCollision: boolean`을 실어 `recordFundingPayout`이 `slug_collision`으로 거부하고 관리자 정산 패널이 그 사유를 보여 준다. `creatorStats`는 주석(creatorStats.ts:82-83 '파일이 이기는 것과 같은 프로젝트를 본다')이 의도를 적었으니 null 대신 `fileCollision: true` 플래그로 화면에 경고. 각 integration 테스트에 healthCheck 테스트처럼 실제 존재하는 'smoke-test' slug로 승인 행을 심은 케이스를 추가하고, lib/funding/CLAUDE.md:326-336의 '코드 가드는 없다' 문단을 '빌드 가드는 없고 런타임 가드는 개설자 입구에서 거른다'로 갱신한다.
⑥ 검증자 조정: 외부 입력으로 발생하지 않고 감지·마감 조건이 창을 좁혀 P1→P2. CLAUDE.md의 '코드 가드 없음'은 빌드 시점(DB 없는 CI) 이야기라 런타임 가드는 금지된 제안이 아니다. 같은 자리를 다른 축(FND 펀딩 — 후원·결제·명단·보존)도 지적: "md 프로젝트와 같은 slug의 승인된 DB 프로젝트가 있으면 개설자 경로로 타인 후원자 PII가 열린다(코드 가드 없음)". FNC-30이 같은 결함의 2라운드 보고다.

#### FNC-5. 승인 뒤 본문·제목·요약·표지 편집의 이전 판본이 남지 않는다 — 결제 시점 표시 내용을 복원할 수 없다(리워드 약속 자체는 잠금·후원 줄 스냅샷으로 보존됨) [P2 · M]
① `lib/funding/creatorProjectWrite.ts:220-224` · `:237-263`, `lib/funding/reviewEmail.ts:200-232`, `pages/admin/funding/projects/[id].tsx:643-645`, `db/schema.ts`, `lib/funding/pledgeLines.ts:6` · `:19-44`
② `saveStorySection`:
```ts
const result = await getDb().update(fundingProjects)
  .set({ content, updatedAt: now, ...editedAt })   // editedAt = { creatorEditedAt: now, lastmod: ... }
  .where(and(eq(fundingProjects.id, row!.id), eq(fundingProjects.reviewStatus, row!.reviewStatus)));
```
`saveBasicSection`(220-224)도 같은 UPDATE 덮어쓰기다. 운영자 알림 `sendCreatorEditedNotice` 본문은 '개설자가 공개된 프로젝트의 내용을 고쳤습니다' 한 줄과 링크뿐이고, 관리자 화면(:643-645)도 마지막 수정 시각만 보여 준다. db/schema.ts에 revision·snapshot 표는 `contractTemplateSnapshots`뿐이다.
③ approved 상태에서도 UPDATE로 덮어쓰고 `creatorEditedAt`(마지막 한 번)과 `lastmod`만 찍는다. 이전 판본·변경 내용은 어디에도 남지 않고 알림 메일·관리자 화면에 diff가 없다. 후원자가 결제한 약속(리워드)은 승인 뒤 설명글까지 잠기고(`reviewTransition.ts` EDITABLE_SECTIONS approved=['basic','story','payout']) 후원 줄이 reward_title·unit_amount·quantity를 스냅샷하므로(pledgeLines.ts) 보존되지만, 그 약속을 풀어 쓴 본문·제목·요약·표지는 보존되지 않는다. 통신판매업자의 표시·광고 기록 6개월 보존(전자상거래법 시행령 제6조) 해당 여부는 법률 확인이 필요하다 — 판매자가 스튜디오(약관 제8조·CLAUDE.md:107-108)이므로 해당하면 P1로 올린다.
④ 모금 중 본문의 구성·일정 서술이나 표지를 바꿔도 운영자는 무엇이 바뀌었는지 모르고 원복 근거가 없으며, 분쟁에서 결제 당시 본문을 제시하지 못한다. 지금 터지는 버그는 아니다.
⑤ **수정**: 별도 표(0037 패턴) `funding_project_revisions`(id, project_id, kind 'approval'|'basic'|'story', title, summary, cover_url, content, edited_at, editor).
1. `decideProject` 승인 배치에 승인 시점 스냅샷 INSERT. 이 배치는 표가 있어야 하므로 마이그레이션을 배포보다 먼저 적용하거나, 승인 스냅샷은 배치 뒤 별도 문장으로 둔다.
2. `saveBasicSection`·`saveStorySection`이 approved이고 **현재 값과 실제로 다를 때만** UPDATE 앞에 별도 INSERT로 현재 값을 남긴다. 같은 `db.batch`에 넣지 않는다 — 표가 없으면 배치 전체가 실패해 저장까지 막힌다. missing_table은 `projectServices.ts` 패턴으로 로그만 남기고 저장은 계속. `saveStorySection`은 내용이 안 바뀐 저장에도 불리므로(본문 최대 100,000자, creatorValidation.ts:61) 같으면 스냅샷을 건너뛴다.
3. `sendCreatorEditedNotice`에 바뀐 필드명·본문 길이 증감·새로 추가된 외부 링크 수를 싣고, 관리자 심사 화면에 판본 목록(시각·필드)과 본문 보기를 둔다.
4. 보존기간은 법률 확인 뒤 정해 retention 크론에 넣는다(최소 6개월, 분쟁 시효까지).
⑥ 검증자 조정: 리워드 약속은 이미 보존되므로 P1→P2. 원 수정안의 '같은 db.batch로 INSERT하되 표가 없으면 저장은 계속'은 성립하지 않아 별도 문장으로 바로잡았다. overflow의 "재제출 시 이전 제출본과의 diff가 없다"는 이 표가 생기면 같이 풀린다.

#### FNC-6. 정산 기록의 마감 판정이 운영자 조기 종료까지 마감으로 봐, 마감일 전에 정산이 굳으면 이후 셀프 취소가 이미 나간 몫의 환불 재원이 된다 [P2 · S]
① `lib/funding/payout.ts:341-345` · `:596`, `lib/funding/projectState.ts:21-28` · `:28-41`, `lib/funding/policy.ts:122`, `lib/funding/cancel.ts:121`, `lib/funding/creatorShipping.ts:160`, `components/admin/FundingPayoutSection.tsx:237`, `pages/api/admin/funding/projects/[id].ts:97`
② 정산 미리보기는 `closed: computeProjectState({ status: project.status, startAt, endAt }, new Date()) === 'closed'`이고(`computeProjectState`는 status==='closed'면 closed) 596행 게이트 `if (!preview.closed) return { ok: false, code: 'not_closed' };`가 그 값만 본다. 반면 셀프 취소는 `if (input.fundingEnded) return { ok: false, code: 'project_not_live' }`(policy.ts:122, cancel.ts:121)로 날짜 마감(`isPastFundingEnd`) 기준이고 배송지 공개(creatorShipping.ts:160)도 같다. projectState.ts:28-41 주석은 "isPastFundingEnd는 운영자가 누른 status: closed를 보지 않는다 … 두 종류의 마감을 한 값으로 합치면 … 셀프 취소가 함께 끊긴다"고 적는다.
③ 11413be680(M1)이 배송 목록을 이 이유로 날짜 판정으로 통일했는데 정산 게이트만 남았다. 운영자가 조기 종료한 뒤 마감일 전에 record_payout을 누를 수 있고(blockers도 `!payout.closed`만 본다, FundingPayoutSection.tsx:237), 그 사이 후원자는 원래 마감일까지 셀프 취소가 된다. M8 테스트(`publicStatusDecision.integration.test.ts:181-203`)는 close→record→reopen만 막았을 뿐 조기 종료 직후 기록의 환불 창은 다루지 않았다.
④ 운영자 조기 종료 → 마감일 전 기록·이체 → 후원자 셀프 취소. paid 이후의 환불은 헬스체크 드리프트(pending만 봄)에도 안 잡히고 회수 추적 수단이 없어, 스튜디오가 개설자에게 이미 보낸 돈을 환불 재원으로 떠안는다. 발생 조건이 좁아 빈도는 낮지만 돈이 걸린 정합성이다.
⑤ **수정**: M1 선례대로 override 없이 날짜 단일 판정으로 맞춘다. `buildFundingPayoutPreview`의 closed를 `project.status !== 'draft' && isPastFundingEnd({ endAt: project.endAt.toISOString() }, new Date())`로 바꾼다(`isPastFundingEnd`는 `lib/funding/projectState.ts`에서 직접 import, projects.ts 재수출 경유 금지). 함께 고칠 곳: ① `pages/api/admin/funding/projects/[id].ts:97` not_closed 메시지와 `FundingPayoutSection.tsx:237` blocker 문구를 '모금 마감일이 아직 지나지 않았습니다(운영자 종료와 무관)'로, ② `pages/admin/funding/projects/[id].tsx` handleClose 확인창에 '마감일 전에 종료하면 정산도 마감일 뒤에야 기록할 수 있습니다' 한 문장, ③ `payout.integration.test.ts`에 status:'closed'+미래 endAt → not_closed 케이스, 날짜 지난 status:'closed' → 기록 성공 케이스. 조기 지급이 꼭 필요해지면 그때 명시적 override를 별도로 설계한다. FNC-36(now 주입)을 먼저 하면 경계 테스트를 쓸 수 있다.
⑥ 검증자 조정: 원 제안의 acknowledgeEarlyClose 체크박스는 API 계약·UI·테스트를 늘리므로 선례(M1)대로 날짜 단일 판정으로 바꿨다.

#### FNC-7. 승인된 프로젝트를 내리는(비공개 전환) 관리자 수단이 없고, 이미지는 status를 보지 않아 내려도 계속 공개된다 [P2 · M]
① `lib/funding/publicStatusDecision.ts:18`, `lib/funding/reviewTransition.ts:35`, `pages/[locale]/funding/creator-terms.tsx:68`, `lib/funding/reviewEmail.ts:373`, `pages/[locale]/funding/[slug]/index.tsx:195` · `:258`, `lib/funding/mediaAccess.ts:36-58`, `pages/api/funding/media/[...path].ts:57` · `:68-75` · `:80-83`
② `export type PublicStatusAction = 'close' | 'reopen' | 'hide' | 'unhide';` — reviewTransition의 approved는 빈 전이표(:35)라 approved를 draft로 돌릴 UI·API가 없다. 약관 제5조 2항은 "스튜디오는 금지 콘텐츠가 확인되면 심사에서 반려하거나 공개 뒤에도 프로젝트를 비공개로 전환할 수 있습니다"라고 약속한다. hide 안내 메일은 "주소를 아는 사람은 여전히 페이지를 볼 수 있습니다"(reviewEmail.ts:373)이고, 공개 페이지는 `robots={project.hidden ? 'noindex, nofollow' : undefined}`(:195), `if (!project || project.status === 'draft') return { notFound: true, revalidate: 60 }`(:258)다. `isApprovedFundingMedia`는 review_status='approved'만 보고, media 핸들러는 그 경우 public immutable 1년 캐시로 내보낸다.
③ 금지 콘텐츠 신고를 받아도 운영자는 close/hide만 쓸 수 있고 둘 다 페이지·이미지를 그대로 둔다. 내리려면 Turso에서 `funding_projects.status`를 직접 UPDATE해야 하고(md 프로젝트는 코드 배포), FUNDING_STATUSES에 draft가 이미 있어 인프라는 준비돼 있으니 관리자 액션만 없는 상태다. 그렇게 내려도 `isApprovedFundingMedia`가 review_status만 보므로 이미지는 계속 공개된다.
④ 임시조치 요청에 신속히 대응할 UI 경로가 없다(DB 직접 수정으로는 60초 안에 내려간다). DB로 내려도 본문 이미지·커버는 공개 URL로 남고, CDN·브라우저에 이미 캐시된 사본은 핸들러 주석(:68-75)이 인정하듯 파일명 변경 외에 회수 수단이 없다.
⑤ **수정**: `PublicStatusAction`에 `'unpublish'`(auto/closed → draft, 사유 필수, close와 같은 낙관적 잠금 UPDATE)와 `'republish'`(draft → auto)를 추가한다. 반드시 같이 고칠 것: ① `mediaAccess.ts` `isApprovedFundingMedia`의 WHERE에 `and p.status <> 'draft'`를 더해 내린 프로젝트의 그림을 즉시 비공개(개설자 본인·관리자 분기는 그대로) ② `revalidateFundingPaths`로 목록+상세 재생성 ③ reviewEmail의 `PUBLIC_STATUS_SUBJECT`/본문과 관리자 화면 버튼(`projects/[id].tsx` '공개 상태' 블록, 확인창에 '이미 캐시된 이미지는 남을 수 있다' 명시). 후원자 쪽은 `getDbFundingProject`가 status를 거르지 않고 셀프 취소가 날짜 판정이라 영향 없음을 확인했으나 download·manage 경로 통합 테스트로 고정한다. md 프로젝트(content/funding)는 이 액션 대상이 아니므로 화면에서 막고 안내한다.
⑥ 검증자 조정: DB 직접 수정으로 내릴 수 있어 P1→P2. 원 수정안에 빠졌던 이미지(status 무시)와 md 프로젝트 예외를 보탰다.

#### FNC-8. 약관이 약속한 정산 기한(마감 후 영업일 14일)을 감시하는 점검이 없고, 승인 메일도 정산 정보 등록을 안내하지 않는다 [P2 · M]
① `lib/ops/healthCheck.ts:962-1040` · `:717-723`, `lib/funding/policy.ts:44-50` · `:316`, `pages/[locale]/funding/creator-terms.tsx:87`, `lib/ops/adminDashboard.ts:113`, `lib/funding/reviewEmail.ts:50-54` · `:126-138`
② policy.ts: `* 코드가 이 시점을 강제하지는 않는다(운영자가 관리자 화면에서 기록·지급을 누른다). … export const FUNDING_PAYOUT_BUSINESS_DAYS = 14;` 약관: `정산금은 … 모금이 끝난 날부터 영업일 ${FUNDING_PAYOUT_BUSINESS_DAYS}일 이내에 보내는 것을 원칙으로 합니다.` 상수는 카피에만 쓰인다(creator-terms.tsx:87, apply.tsx:70, PayoutSectionForm.tsx:129, FundingPayoutSection.tsx:268, creatorTermsHash.ts). 헬스체크의 정산 항목은 드리프트(:962)와 늦은 계좌 입금(:1010)뿐이고, 대시보드 `countPendingFundingPayouts()`는 이미 기록된 pending 건수만 센다. 관리자 프로젝트 목록(adminProjects.ts·projects/index.tsx)에 payout 언급 0. 승인 메일(text·html)의 안내는 APPROVAL_LOCK_NOTICE(리워드 잠금)뿐이다.
③ 정산은 운영자가 기록·지급을 눌러야 시작되는데, 날짜상 마감된 승인 프로젝트에 정산 행이 없는 채 시간이 흘러도 헬스체크·대시보드·프로젝트 목록 어디에도 뜨지 않는다. 정산 정보는 승인 뒤에야 열리는데(reviewTransition.ts EDITABLE_SECTIONS) 개설자에게 그 사실을 능동적으로 알려 주는 곳은 편집 화면 구획 안내뿐이다.
④ 기한(원칙 14영업일)이 조용히 넘어가며, 정산 정보 미등록 사유로 막힌 건은 운영자가 record_payout을 눌러 `no_payout_account`를 맞고서야 드러난다.
⑤ **수정**
1. `collectDbIssues`에 점검 추가: reviewStatus='approved' DB 프로젝트 중 endAt이 N일 전보다 과거(`isPastFundingEnd` 기준)이고 `funding_project_payouts` 행이 없으며 확정 후원(gross>0)이 있는 건을 medium(마감 후 14일)/high(21일)로 올린다. 저장소에 영업일·공휴일 계산이 없으므로(healthCheck.ts:717-723이 환불 3영업일 경보를 48시간 근사로 구현) 같은 달력일 근사를 쓰고 주석에 근사임을 적는다. detail에 미등록 사유(계좌·세금 구분·주민번호 — `buildFundingPayoutPreview`의 hasPayoutAccount/taxType/needsResidentNumber)를 싣는다. md 전용 프로젝트는 개설자·정산 행이 없으므로 대상은 DB 프로젝트(funding_projects)뿐이다.
2. 승인 메일(text·html)에 '모금이 끝나기 전에 편집 화면의 정산 정보를 등록해 주세요(등록이 끝나야 영업일 14일 이내 정산)' 한 줄(`FUNDING_PAYOUT_BUSINESS_DAYS` 보간).
3. 개설자 리마인더 메일/신규 크론은 1·2로 부족하다고 확인된 뒤에 별도 과제로 — 하더라도 처리방침 수집·이용 목적 '정산 안내 메일 발송'(policy.ts:316) 범위 안에서만.
⑥ 검증자 조정: 원 제안의 '기존 한국 공휴일 유틸'은 없고, 신규 크론+리마인더는 '단순하게 만들 것'에 비추어 뒤로 미뤘다.

#### FNC-9. 정산할 돈이 없는 승인 프로젝트가 있으면 개설자 주민등록번호가 영구 보관된다 [P2 · M]
① `lib/funding/retention.ts:298-334`, `lib/funding/payout.ts:621-622`, `lib/funding/reviewTransition.ts`(approved: {}), `lib/funding/residentNumberRetention.test.ts:214-254`, `pages/api/cron/purge-funding.ts`
② 파기 판정의 liveProjects:
```ts
const liveProjects = db.select(...).from(fundingProjects).where(and(
  eq(creatorId, fundingCreators.id),
  inArray(reviewStatus, ['submitted','changes_requested','approved']),
  notExists(payouts where paid_at IS NOT NULL)))
```
파기 WHERE는 `notExists(liveProjects)`(326)를 요구한다. 그런데 정산 기록은 `if (preview.netAmount <= 0 && offsetTotal <= 0) return { ok: false, code: 'nothing_to_pay' };`(payout.ts:621-622)로 받은 돈이 없는 프로젝트의 기록 자체를 거부한다.
③ approved는 되감을 수 없는 종결 상태이고 archive도 막혀 있어 승인된 프로젝트가 liveProjects에서 빠져나갈 길은 '지급 완료(paid_at) 정산 행'뿐이다. 후원 0건이거나 환불로 실이체액이 0이면 nothing_to_pay로 그 행이 영원히 생길 수 없다. 그 프로젝트가 하나라도 있으면 (A)·(B) 두 갈래 모두 `notExists(liveProjects)`에서 막힌다. 정산 정보 구획은 승인 뒤에 열리고 계정 단위로 저장되므로(savePayoutSection은 승인된 프로젝트가 하나라도 있으면 허용) 번호가 이미 저장된 상태에서 모금이 0원으로 끝나는 경로는 실재한다. 파일 머리주석 스스로 '계정이 남아 있는 동안은 제21조① 단서의 예외가 아니다'라고 적은 상태다. 테스트(214-254)는 정산 대기 프로젝트만 검증한다.
④ 모금이 0원으로 끝난 개설자가 등록한 주민등록번호가 계정이 존재하는 한 파기되지 않는다. 개인정보 보호법 제21조①에 어긋나는 상태이고 이 파일이 막으려던 바로 그 상태다. 대상(펀딩 실패 개설자)은 소수다.
⑤ **수정**: approved 항은 '모금이 아직 끝나지 않았거나 정산할 살아 있는 후원이 있다'일 때만 live로 센다 — `and(eq(reviewStatus,'approved'), or(and(ne(status,'closed'), gte(endAt, now)), exists(후원: orders.status IN LIVE 또는 pending·bank_transfer·online AND fp.project_slug = p.slug)), notExists(paid 정산))`. submitted·changes_requested 항은 그대로 둔다. 설계 시 셋을 고려한다: (1) 현재 테스트 픽스처가 모두 endAt 2021-02-01이고 후원이 없는 approved를 '보관해야 한다'로 단언하므로 그 케이스는 endAt을 미래로 주거나 후원 행을 시딩하도록 고치고 의도를 다시 쓴다, (2) 운영자 조기 종료(status closed, endAt 미래), (3) 입금 대기(pending 계좌 입금)가 후일 확정될 수 있는 경우. '마감 지난 후원 0건 approved는 파기를 막지 않는다'와 '마감 지났어도 살아 있는 후원이 있으면 보관한다'를 추가한다. 대안(nothing_to_pay 대신 0원 정산 행 기록)은 payout.ts 주석이 명시적으로 막은 영구 pending 행 문제를 되살리므로 쓰지 않는다.
⑥ 검증자 조정: 원 수정안이 기존 테스트 픽스처·조기 종료·입금 대기를 빠뜨려 보완했다.

#### FNC-10. 개설자 약관 제3조의 이름 잠금 조건이 코드(심사 신청부터 잠금)와 다르다 [P2 · S]
① `pages/[locale]/funding/creator-terms.tsx:54`, `lib/funding/creatorProjectWrite.ts:308-310` · `:315-322` · `:333-349`, `pages/[locale]/funding/creator/[id].tsx:255`, `components/funding/creator/CreatorSectionForm.tsx:112`, `content/creatorTerms.baseline.test.ts`
② 약관: `다만 이름은 예외입니다 — 승인된 프로젝트가 하나라도 있고 지금 이름이 가입 시 자동으로 채워진 값(이메일 주소의 @ 앞부분)과 다르면, 그 개설자의 이름은 더 이상 바꿀 수 없습니다.` 코드: `const hasReviewedProject = … inArray(fundingProjects.reviewStatus, ['submitted', 'approved'])`를 `isCreatorNameLocked`(333-339)·`saveCreatorSection`(341-349)이 쓰고, 주석 308-310은 'approved만 보던 시절에는 … submitted부터 잠근다'고 적는다. 화면도 심사 신청 성공 직후 `setNameLocked(true)`를 켠다(:255).
③ 코드는 2026-09-25(#256)에 들어왔고 약관 판본 funding-creator-terms-2026-10-04는 그 뒤인데도 문구가 갱신되지 않았다. submitted 프로젝트에서는 구획이 전부 닫히는 구조라(reviewTransition.ts EDITABLE_SECTIONS submitted: []) 심사 중 이름 변경은 `saveCreatorSection`에서 조용히 무시된다. 약관 판본 게이트는 약관 텍스트 해시만 보므로 이 불일치를 구조적으로 못 잡는다. CreatorSectionForm.tsx:112는 심사 중에도 '승인된 프로젝트가 있어 이름은 바꿀 수 없습니다'라고 안내한다.
④ 개설자가 동의한 문서가 실제 동작을 보증하지 못한다. 심사 중 이름을 고쳐 저장한 개설자는 저장됐다고 믿지만 값이 바뀌지 않는다.
⑤ **수정**: 코드 쪽 이유(심사한 이름과 공개되는 이름 일치)가 타당하므로 코드를 되돌리지 않고 약관을 고친다. `creator-terms.tsx:54`를 '심사를 신청했거나 승인된 프로젝트가 하나라도 있고 …'로 고치고 '승인 뒤 바뀌지 않는 것들과 같은 이유로'도 '심사한 이름과 공개되는 이름이 같아야 하므로'로 맞춘다. `FUNDING_CREATOR_TERMS_VERSION`을 올리고(같은 날이면 -r2) `UPDATE_CREATOR_TERMS_BASELINE=1 npx jest content/creatorTerms.baseline.test.ts`로 기준선을 갱신하며 커밋에 조항·사유를 적는다(기존 신청 행의 creator_terms_version은 옛 값 유지). `CreatorSectionForm.tsx:112` 문구도 '심사를 신청했거나 승인된 프로젝트가 있어 …'로. `creatorTerms.baseline.test.ts`에 3조가 '심사를 신청했거나'를 포함한다는 단언을 추가한다.
⑥ 검증자 조정: 원 수정안에 빠졌던 화면 문구(CreatorSectionForm.tsx:112)를 보탰다.

#### FNC-11. 이체 대기(pending) 정산이 있는 동안 개설자가 계좌·세금 구분을 바꿔도 운영자·개설자 누구에게도 즉시 알려지지 않는다 [P3 · S]
① `lib/funding/creatorProjectWrite.ts:479-486` · `:567-577`, `lib/ops/healthCheck.ts:962-1008`, `components/admin/FundingPayoutSection.tsx:131-143` · `:371-386`, `lib/funding/payoutEmail.ts:96`
② `savePayoutSection`의 유일한 선행 게이트: `if (!(await hasApprovedProject(creatorId))) { return deny('not_editable', '프로젝트가 승인된 뒤에 정산 정보를 넣을 수 있습니다.'); }` — pending 정산 유무를 보지 않고 UPDATE가 taxType·계좌를 그대로 덮는다. healthCheck.ts:1001-1003 주석: "원인을 단정하지 않는다 — 환불 말고 세금 유형 변경으로도 갈린다(savePayoutSection은 … invoice→withholding 전환을 막지 않는다)". 기록 표는 `net_amount`·`withholding_amount`를 고정한다.
③ 기록 행은 불변이고 이체액의 정본은 기록값이라 금액은 안전하다. 금액 어긋남은 정산 패널 DRIFT_FIELDS와 일일 헬스체크 high 경보 두 겹이 잡는다. 확정 메일이 '금액이나 계좌가 다르면 이체 전에 알려 주세요'로 계좌 정정 경로를 일부러 열어 둔다. 남는 틈은 계좌(뒤4자리·은행·예금주) 변경에 경보가 없다는 것 — 운영자는 이체 직전 '계좌 보기'를 눌러야만 알고, 개설자는 지급 메일(이체 뒤)에서야 새 계좌를 본다.
④ 매직링크 계정이 탈취된 경우 이체 전에 본인이 알 방법이 없어 계좌 교체가 이체 후에야 드러날 수 있다. 정상 개설자의 계좌 정정은 오히려 허용돼야 한다.
⑤ **수정**: 잠그지 않는다 — 기록된 정산을 취소하는 경로가 코드에 없고(DELETE funding_project_payouts 없음, `markFundingPayoutPaid`는 pending→paid 단방향, UI도 '되돌릴 수 없습니다') 잠그면 계좌 오류 시 DB 직접 수정만 남는 교착이 된다. 대신 `savePayoutSection`이 성공한 뒤 이 개설자의 프로젝트에 status='pending' 정산이 있고 taxType 또는 payoutAccountLast4가 바뀌었으면 (1) 개설자 이메일로 '정산 계좌/세금 구분이 변경되었습니다(뒤 4자리·구분만, 변경 시각)' 안내를 보내고 (2) 운영자에게 `operatorAlert` 계열로 '이체 대기 중 정산 정보 변경: <slug>'를 보낸다. 조회는 `hasWithheldPayout`와 같은 innerJoin 패턴(status='pending') 재사용. 마이그레이션·화면 변경 없음. FNC-3의 알림과 합치면 한 메일이다.
⑥ 검증자 조정: 원 제안의 잠금은 교착을 만들고 금액은 불변 기록이 지키므로 P3으로 낮췄다. 운영 DB에 pending 정산이 있는 개설자 수는 확인하지 않았다.

#### FNC-12. 주소별 로그인 한도 초과가 거짓 200이라 정상 개설자·표적이 이유를 모른 채 하루 막힐 수 있다 [P3 · M]
① `pages/api/funding/creator/login.ts:36-44` · `:87-89` · `:92-95` · `:106-109` · `:114`, `lib/funding/creatorToken.ts:44-50` · `:82-84`
② 
```ts
if (!(await consumeRateLimit(emailRateLimitKey(email), EMAIL_LIMIT, WINDOW_SECONDS))) { return res.status(200).json(OK); }        // 3/10분
if (!(await consumeRateLimit(emailDailyRateLimitKey(email), EMAIL_DAILY_LIMIT, DAY_SECONDS))) { return res.status(200).json(OK); } // 10/일
```
키는 요청자와 무관한 이메일 해시다. `issueCreatorLoginToken`은 발급마다 `db.delete(fundingCreatorTokens).where(or(lt(expiresAt, now), eq(creatorId, creator.id)))`로 그 개설자의 기존 토큰을 전부 지운다. IP 한도는 이미 429를 쓴다(:87-89).
③ 두 주소별 게이트는 `isRegisteredCreatorEmail` 조회(:114)보다 앞에서 모든 주소에 똑같이 적용되는데도 성공 응답을 내려, 정상 사용자는 메일이 안 오는 이유를 알 수 없다. 정상 개설자가 링크를 세 번 연달아 요청해 첫 메일을 누르면(앞선 것은 이미 폐기) 네 번째 요청이 조용히 버려진다. 표적 이메일을 아는 제3자가 하루 10회 요청으로 그 주소의 나머지 24시간 링크를 막을 수 있다. 다만 주소별 일일 상한은 '한 주소로 두드려 전역 캡 100통을 혼자 채우는' 공격을 막으려 일부러 넣은 것이고(:36-44), 토큰 전부 폐기도 '먼저 온 메일이 남의 손에 있을지도 모른다'는 의도된 결정(creatorToken.ts:44-50)이다. 가입 캡(SIGNUP_DAILY_CAP)이 차도 운영자 알림이 없다(console.error만). 운영자 링크 발급 도구도 없다.
④ 링크를 여러 번 요청한 개설자가 네 번째부터 조용히 무시돼 최대 24시간 로그인 불능이 될 수 있고, 표적 공격에도 같은 효과가 난다. 개설자는 두 자릿수이고 공격에 표적 이메일을 알아야 해 현실성은 낮다.
⑤ **수정**: (a) 주소별 두 게이트(:92-95, :106-109)만 `429 + '같은 주소로 요청이 너무 잦습니다. 10분 뒤(또는 내일) 다시 시도해 주세요'`로 바꾼다 — 가입 여부 조회 앞이라 존재 여부가 새지 않는다. 전역 캡·가입 캡·가입 IP 캡 분기는 가입 여부에 의존하므로 200 유지. (b) 일일 한도 구조와 토큰 일괄 폐기는 바꾸지 않는다. (c) 가입 캡 도달 시 `sendCreatorLoginCapAlert`와 같은 방식으로 하루 1회 운영자 알림(키 `funding_creator_signup:global_alert`, 기존 알림 키와 반드시 달라야 함). (d) 운영자 링크 발급 도구는 별도 과제.
⑥ 검증자 조정: 원 제안의 (email,IP) 쌍 키와 '최신 2개 유지'는 기존 방어 결정을 되돌리므로 뺐다. lib/funding/CLAUDE.md '응답은 언제나 같다'는 존재 여부 비노출이 목적이라 (a)와 충돌하지 않는다. overflow "getClientIp가 null이면 'unknown' 공용 버킷"이 같은 라우트다.

#### FNC-13. 심사 판정·공개 상태·수기 후원·관리자 환불·계정 변경의 수행자와 사유가 서버 로그 밖에 영속되지 않는다(관리자 1명인 현재는 구분 불필요) [P3 · M]
① `pages/api/admin/funding/projects/[id].ts:336` · `:426` · `:491` · `:613` · `:176-200`, `lib/funding/payout.ts:485-530` · `:664-671`, `pages/api/admin/funding/pledges/index.ts:216-257`, `pages/api/admin/funding/pledges/[id].ts:54-60`, `db/schema.ts:945`
② `result = await decideProject(id, action, { note, slug, expectedSubmittedAt }, now);`(actor 미전달), `decidePublicStatus(id, action, { note }, now)`(:426)도 같다. 계정 변경은 :491 console.warn에 사유만 있고 actor 없음. `markFundingPayoutPaid(preview.recorded.id, memo, now)`의 UPDATE(payout.ts:664-671)에 수행자 컬럼 없음. 수기 후원 INSERT(pledges/index.ts:216-257)에 `auth.actor` 사용 없음, 환불은 `requestedBy: 'admin'`. `fundingProjectPayouts`에 recorded_by·paid_by 컬럼 없음.
③ 라우트가 `auth.actor`를 받아 두고도 DB에 적지 않는다. 정산은 간접 흔적이 있다 — `recordFundingPayout`이 privacy_access_logs에 actor·IP·시각·targetId=projectId로 `funding_payout_account_decrypt_check`를 남기고(payout.ts:485-530), `notifyPayout`이 기록·지급 둘 다에서 `funding_payout_account_email`을 actor와 함께 남긴다(:176-200, 2년 보관). 발송 상태는 `fulfillment_updated_by`(0022)가 있고 서비스 지정·설계비·제작비는 actor를 console.warn에 남긴다(projectServices.ts:183,194,262,316). lib/funding/CLAUDE.md:394도 계정 변경은 '로그가 유일한 기록'이라 인정한다.
④ 현재 관리자 계정이 황경하 한 명이라(memory project_admin_accounts) '누가'는 자명하고 위험이 낮다. 두 번째 관리자를 추가하는 시점부터 승인·환불·수기 등록 분쟁의 수행자를 재구성할 수 없다. 서버 로그 보존 기간이 지나면 계정 변경 사유도 사라진다.
⑤ **수정**: 지금은 표를 만들지 않는다. 마이그레이션 없는 최소 조치로 `decideProject`·`decidePublicStatus` 호출부에 projectServices.ts와 같은 형식의 actor 포함 console.warn을 더하고(`[funding] 심사 판정 (projectId, action, actor)`), 수기 후원 등록·관리자 환불·입금 확인 호출부도 actor를 로그에 싣는다. ADMIN_ACCOUNTS에 두 번째 계정을 추가하기 전에 `funding_admin_actions`(0037 패턴: 별도 표, 표 없으면 읽기 degrade, 배포 전 마이그레이션 적용)를 도입하고 최소한 `funding_project_payouts`에 recorded_by/paid_by를 같은 방식으로 둔다.
⑥ 검증자 조정: 별도 표+7개 호출부 배선은 관리자 1명인 지금 과하다. 두 번째 관리자가 생기는 시점의 선행 과제로 둔다.

#### FNC-14. 관리자 심사 화면에 개설자 약관 동의 판본·시각이 안 보인다 (현행 판본과 달라도 알 길이 없다) [P3 · S]
① `pages/admin/funding/projects/[id].tsx:174-205`, `lib/funding/reviewDecision.ts:216`, `pages/api/funding/creator/projects/[id]/submit.ts:92` · `:114`, `lib/funding/adminProjects.ts:61`, `lib/funding/adminProjects.integration.test.ts:250`
② 승인 검사는 `if (!project.creatorTermsVersion) { return deny('terms_not_agreed', ...) }`로 비어 있는지만 본다. 제출은 `...(requiresTerms ? { creatorTermsVersion: FUNDING_CREATOR_TERMS_VERSION, creatorTermsAgreedAt: now } : {})`로 재제출마다 덮어쓴다(submit.ts:114) — 다만 :92가 현행 판본이 아니면 400으로 거절하므로 찍히는 값은 항상 현행 판본에 대한 최신 동의다. 심사 화면 GSSP(174-205)의 project props에 creatorTermsVersion이 없다(`AdminProjectDetail`에는 adminProjects.ts:61에 있다).
③ 운영자는 어느 판본에 동의했는지 볼 수 없다. 제출 뒤 약관이 개정되면(최근 09-18→09-29→10-04로 잦다) 이전 판본에 동의한 대기 프로젝트가 현행 판본 동의 없이 승인될 수 있다. 동의 기록 자체는 정확하고 재제출 덮어쓰기는 결함이 아니다.
④ 운영자가 옛 판본 동의 프로젝트를 모르고 승인할 수 있다. 정산 조항(제6조)이 개정된 뒤라면 개설자가 어느 판본에 동의했는지 화면으로 확인할 수 없다. 기록은 DB에 남아 분쟁 증거는 유지된다.
⑤ **수정**: `AdminProjectDetail`에 creatorTermsAgreedAt을 추가하고(adminProjects.integration.test.ts:250의 키 목록도 갱신), GSSP props와 화면에 '동의 판본·시각'을 싣는다. 현행 `FUNDING_CREATOR_TERMS_VERSION`과 다르면 경고 배지. 승인 거부(terms_outdated)는 두지 않는다 — 거부하면 개정 때마다 대기 건 전체를 보완 요청으로 돌려야 한다. 필요하면 approve 응답 warnings로만 알린다.
⑥ 검증자 조정: '재제출 때 이전 동의가 덮인다'는 결함이 아니고 '승인이 판본 불일치를 막는다'는 과해서 화면 표시로 좁혔다.

#### FNC-15. 개설자 발송 라우트의 404 두 개가 소유 확인보다 :id 불일치를 먼저 가른다 (게이트 위치는 의도된 설계) [P3 · S]
① `pages/api/funding/creator/projects/[id]/fulfillment.ts:63-83`, `lib/funding/fulfillment.ts:80-89`, `lib/funding/creatorShipping.ts:243-248`, `db/schema.ts:478`
② 
```ts
if (projectId && projectId !== gate.projectId) { return res.status(404).json({ ... '이 프로젝트에서 해당 후원을 찾을 수 없습니다.' }); }
…
if (gate.creatorId !== auth.creatorId) { return res.status(404).json({ ... '펀딩 내역을 찾을 수 없습니다.' }); }
if (!gate.pastFundingEnd) { return res.status(409) ... }
if (!gate.requiresShipping) { return res.status(409) ... }
```
`setFulfillment`의 개설자 분기(lib/funding/fulfillment.ts:80-89)는 소유만 확인한다.
③ 소유 확인이 URL :id 대 gate.projectId 비교 뒤에 있어, 남의 pledge id를 자기 프로젝트 :id와 함께 넣으면 '이 프로젝트에서…' 문구가 나와 없는 id('펀딩 내역을…')와 구분된다. 테스트 이름 '존재 여부를 알려 주지 않는다'와 어긋난다. 마감·배송 게이트가 라우트에만 있는 것은 단일 호출부에 문서화된 설계(creatorShipping.ts:243-248 '소유는 서비스가, 마감·배송은 게이트가 보탠다')이고 관리자는 마감 전에도 발송 상태를 바꿀 수 있어야 하므로 결함이 아니다.
④ pledge id가 randomblob(16)이라 알아야만 쓸 수 있는 정보이므로 현재 악용 경로 없음.
⑤ **수정**: 라우트에서 소유 확인을 :id 비교보다 먼저 두고 두 404를 같은 문구로 통일한다(2줄 이동). 선택: FULFILLMENT_STATUS 매핑 복제는 fulfillment.ts에서 export해 공유. 게이트를 `setFulfillment` 안으로 옮기는 일은 두 번째 개설자 진입점이 생길 때 한다.
⑥ 검증자 조정: 게이트 위치는 설계이고 남는 것은 404 정렬뿐이다.

#### FNC-16. 리워드 쓰기 경로가 reviewStatus를 UPDATE 조건에 걸지 않는다 — 실제 가치는 mode:'update'가 없는 리워드를 새로 만드는 것 하나 [P3 · S]
① `lib/funding/creatorProjectWrite.ts:224` · `:260` · `:651` · `:668-682` · `:687-694` · `:723`, `pages/api/funding/creator/projects/[id]/rewards.ts:84-91`
② `saveBasicSection`/`saveStorySection`은 `.where(and(eq(fundingProjects.id, row!.id), eq(fundingProjects.reviewStatus, row!.reviewStatus)))`인데 `upsertReward`의 UPDATE·INSERT·`deleteReward`는 `isNull(fundingRewards.lockedAt)` 조건뿐이다. 개수 한도는 `const [{ value: existingCount }] = await getDb().select({ value: count() })... if (existingCount >= CREATOR_LIMITS.rewardsMax) {` 뒤에 별도 INSERT다. 라우트 `mode === 'update'`에서 previousRewardId가 value.rewardId와 같고 그 리워드가 없으면 `upsertReward`가 새로 INSERT한다.
③ reviewStatus 미고정과 개수 한도 비원자성은 같은 개설자의 동시 요청에서만 나타나는 ms 단위 틈이다(submitted 상태에서는 EDITABLE_SECTIONS가 비어 guard가 막고, 심사 화면은 로드 시점의 최종 리워드를 읽으며, 승인 시 lockedAt이 막는다. 20개 초과도 분당 30회 제한 안). 반면 mode:'update'는 리워드 존재를 확인하지 않아 다른 탭에서 지운 리워드를 저장하면 404 대신 새 리워드가 생긴다 — 멀티탭만으로 재현된다.
④ 멀티탭에서 '수정'이 '신규 생성'이 되는 것이 유일한 사용자 체감 결함이다.
⑤ **수정**: 1순위 — `rewards.ts`의 update 모드에서 (projectId, previousRewardId) 리워드가 없으면 404로 돌려준다(`upsertReward`의 개명 분기와 같은 not_found). 2순위(선택) — INSERT/UPDATE/DELETE의 WHERE에 `EXISTS(SELECT 1 FROM funding_projects WHERE id=? AND review_status=?)`. 개수 한도의 INSERT…SELECT 원자화는 비용 대비 효과가 없어 보류.
⑥ 검증자 조정: EXISTS 조건부 문장·INSERT…SELECT는 '단순하게' 원칙에 비해 무거워 update 모드 404만 1순위로 남겼다.

#### FNC-17. 관리자 쓰기 입력의 길이 상한이 비어 있다 — 수기 후원 이름·전화, 심사·내부 메모, 정산 메모, 환불 사유 [P3 · S]
① `pages/api/admin/funding/pledges/index.ts:79-81` · `:248`, `pages/api/admin/funding/projects/[id].ts:247-271` · `:612`, `pages/api/admin/funding/pledges/[id].ts:58`, `pages/admin/funding/[id].tsx:201-209`, `lib/funding/lineRefund.ts:114`
② `customerName: b.customerName,`(typeof string·비어 있지 않음만 확인, trim 없음), `customerPhone: String(b.customerPhone ?? MANUAL_PLACEHOLDER_PHONE)`, `${typeof b.adminMemo === 'string' ? b.adminMemo : null}`. set_review_note·set_internal_note의 note, mark_payout_paid memo, refund reason 모두 길이 상한 없음.
③ 수기 등록 customerName은 trim·길이 상한 없이 저장되고(공백만 있는 이름 통과), customerPhone·adminMemo도 무제한이다. 메모류도 상한이 없다. 'refund' 액션 사유는 UI 고정 문구이고, 사람이 입력하는 쪽은 refund_line의 `window.prompt`([id].tsx:201-209)인데 그 값이 그대로 토스 cancelReason(lineRefund.ts:114, 문서상 최대 200자 — 저장소에서는 미확인)과 후원자 메일로 간다. 이름 공백이 같은 이름 입금 대조나 인원 집계를 어긋나게 하지는 않는다(`findSameNameBankDeposits`는 TRIM, `backerIdentitySql` 키는 이메일+전화).
④ 운영자 입력 실수로 비정상 값이 저장되거나 일부 환불이 토스 거절로 실패한다(안전한 실패, 돈은 움직이지 않는다). 관리자 전용이라 외부 악용 위험은 낮다.
⑤ **수정**: 수기 등록은 `customerName.trim()`을 쓰고 비어 있으면 거부, `PLEDGE_TEXT_LIMITS.customerName`(50)·`customerPhone`(30)을 그대로 재사용, adminMemo에 상한. 메모류는 한 줄 상수(예 2,000자)로 400. refund_line 사유는 토스 호출 전에 200자 이내로 검증하거나 400. 새 헬퍼·정책 모듈은 만들지 않는다.
⑥ 검증자 조정: 입금 대조·집계 피해 주장은 틀려 뺐고, clampAdminText 헬퍼 신설도 PLEDGE_TEXT_LIMITS가 있어 불필요.

#### FNC-18. 승인 뒤 수정 알림이 메일 실패와 무관하게 1시간 동안 억제된다 [P3 · S]
① `pages/api/funding/creator/projects/[id].ts:61-67` · `:80-91`, `lib/funding/reviewEmail.ts`(sendCreatorEditedNotice), `lib/booking/rate-limit.ts`, `pages/admin/funding/projects/[id].tsx:643`
② 
```ts
if (!(await consumeRateLimit(`funding_creator_edit:${projectId}`, 1, 3600))) return;
const detail = await loadProjectForAdmin(projectId);
if (!detail) return;
const error = await sendCreatorEditedNotice(detail);
if (error) console.error('[funding] 개설자 수정 알림 실패:', error);
```
③ 한도를 먼저 소비한 뒤 발송하므로 첫 메일이 실패(Resend 장애·타임아웃)하면 그 1시간 안의 나머지 수정에 알림이 가지 않는다. `consumeRateLimit`에 반환 함수가 없고 실패는 console.error만 남아 운영자 폴백도 없다. `loadProjectForAdmin` 실패도 같다. 완화책은 관리자 상세 화면의 creatorEditedAt 표시(:643)뿐이고 목록에는 표시가 없다. 주석(61-67)이 '알림 메일은 화면을 보러 가라는 신호일 뿐'이라 밝혀 둔 설계라 영향은 작다.
④ 승인 후 본문이 바뀌었는데 운영자가 메일로 못 받고, 이어진 수정도 억제돼 인지가 늦어진다.
⑤ **수정**: 발송 실패 시 `DELETE FROM rate_limits WHERE key = 'funding_creator_edit:<id>'`로 슬롯을 돌려주거나, creator_edited_at과 별도의 notified 시각을 두고 발송 성공 후에만 갱신한다. 실패 로그에 최소한 projectId를 포함한다(sendReviewDecisionOperatorFallback 수준의 운영자 폴백은 선택).
⑥ 검증자 확정.

#### FNC-19. 미심사 프로젝트 상한 검사와 INSERT가 분리돼 있어 버스트 한 번에 최대 약 30행까지 쌓일 수 있다 [P3 · S]
① `pages/api/funding/creator/projects.ts:46-52` · `:56-71`, `lib/funding/creatorProjectWrite.ts`(createDraftProject), `pages/api/funding/creator/login.ts:48-49`
② `const [{ value: existingCount }] = await getDb().select({ value: count() })... if (existingCount >= CREATOR_LIMITS.draftsMax) { return res.status(400)...} const { id } = await createDraftProject(auth.creatorId);`
③ count 조회와 INSERT 사이가 비원자적이다. 다만 IP·계정 분당 30회 제한(:46-52)이 한 번의 버스트를 최대 약 30행에서 멈추고 그 뒤에는 count>=10이라 전부 거부되므로 누적 스팸은 생기지 않는다. 계정 단위 상한은 애초에 계정 자동 생성으로 우회 가능하고 그 쪽은 IP당 5회·전체 일 20개 가입 캡(login.ts:48-49)이 실제 방어선이다.
④ 개설자 한 명이 미심사 초안을 10개 초과(버스트당 최대 약 30개)로 만들 수 있다. 데이터·돈 영향 없음.
⑤ **수정**: 고친다면 `createDraftProject`를 `INSERT … SELECT … WHERE (SELECT count(*) …) < 10` 단일 문장으로 바꾸고 rowsAffected 0이면 상한 메시지를 낸다. 필수는 아니며 우선순위는 낮다. FNC-1(archive)이 풀리면 정리 수단도 생긴다.
⑥ 검증자 조정: 영향이 과장돼 있었다(상한 이후 전부 거부).

#### FNC-20. 관리자 프로젝트 목록이 limit 없이 전체 컬럼(content·정산 암호화 컬럼 포함)을 읽는다 [P3 · S]
① `lib/funding/adminProjects.ts:96-110`, `pages/admin/funding/projects/index.tsx:57-58`
② `listProjectsForAdmin = async (filter?: { reviewStatus?: FundingReviewStatus })`은 `.orderBy(desc(fundingProjects.submittedAt))` 후 limit 없이 fundingProjects 전체 컬럼(content 포함)과 fundingCreators 전체 컬럼(암호화 정산 컬럼 포함)을 반환한다. index.tsx:57-58은 필터 없이 호출하고 서버(GSSP)에서 STATUS_PRIORITY로 정렬해 submitted(0)·changes_requested(1)를 맨 위에 올린다. `toSummary`가 일부만 골라 props로 내보낸다(content는 실리지 않음).
③ 목록 질의가 전체 컬럼을 limit 없이 읽고 메모리에서 일부만 쓴다. 심사 대기 건은 정렬로 항상 위에 오므로 묻히지 않는다. 개설자 가입이 일 20개로 묶여 있어 행이 수백 개를 넘어야 비용이 의미를 갖는다.
④ 현재 영향 없음. 장기적으로 SSR 질의 비용과 정산 암호화 컬럼의 불필요한 메모리 적재가 늘 수 있다.
⑤ **수정**: 지금은 목록에 필요한 컬럼만 select하도록 좁힌다(content·creator 정산 컬럼 제외). 행 수가 실제로 늘어 느려지면 그때 기본 필터(반려·보관 숨김)와 limit을 추가한다. overflow의 "adminProjects·loadProjectForCreator가 fundingCreators 전 컬럼을 select" 항목과 같은 수정이다.
⑥ 검증자 조정: '심사 대기 건이 묻힌다'·'클라이언트 정렬'은 틀렸다.

#### FNC-21. 개설자가 입력하는 소개(bio)·링크(links)는 어디에도 쓰이지 않고 심사 화면에도 안 보인다 [P3 · S]
① `pages/admin/funding/projects/[id].tsx:52-57`, `db/schema.ts:739`, `lib/funding/dbProjects.ts:75`, `lib/funding/creatorProjectWrite.ts:279-281` · `:355`, `components/funding/creator/CreatorSectionForm.tsx:132-145`
② 심사 화면 주석: `* 화면이 렌더하는 필드만 담는다 — creator.bio·creator.links는 이 화면 어디에도 그리지 않으므로 props에도 싣지 않는다`. db/schema.ts:739 bio: `/** 공개 소개. 개설자 구획(2차)이 채운다 */`. 공개 상세(dbProjects.ts:75)는 `fundingCreators.name` 한 컬럼만 select한다. creatorProjectWrite.ts:279-281은 'bio·연락처·links는 공개 화면에 실리지 않는다'고 적는다.
③ 폼은 소개(600자)와 링크(5개)를 받아 저장하지만 소비처는 개설자 본인 화면 재로드뿐이다. 스키마 주석 '공개 소개'는 사실과 다르다. 폼의 소개 칸 힌트('600자 이내')는 공개 여부를 말하지 않는 반면 연락처 칸은 '운영자만 볼 수 있습니다'라 적어, 개설자가 소개가 공개되거나 심사에 쓰인다고 오해하기 쉽다. 반대로 심사자는 신원·실적 확인에 쓸 외부 링크를 못 본다.
④ 심사 품질(개설자 신원·권리 확인)에 쓸 수 있는 정보를 수집하고도 버린다.
⑤ **수정**: 둘 중 하나를 고른다 — 심사 화면 props에 bio·links(http(s) 검증된 값)를 싣고 링크는 `rel="noopener noreferrer"`로 표시하거나, 쓰지 않을 거면 입력 칸·컬럼 수집을 중단한다. 어느 쪽이든 db/schema.ts:739의 '공개 소개' 주석을 사실에 맞게 고친다.
⑥ 검증자 확정('개인정보 보유 논란' 부분만 근거 약함).

#### FNC-22. 개설자 links JSON을 무방비로 JSON.parse한다 — 값이 깨지면 편집 화면과 관리자 심사 화면이 500 [P3 · S]
① `lib/funding/creatorProjectWrite.ts:149` · `:355`, `lib/funding/adminProjects.ts:152`, `lib/funding/dbProjects.ts:51` · `:85-90`, `lib/funding/creatorValidation.ts:170`
② `links: creator?.links ? (JSON.parse(creator.links) as string[]) : null,` — adminProjects.ts:152도 같다. 쓰는 곳은 `saveCreatorSection`의 JSON.stringify 하나뿐이다(:355).
③ 깨진 값은 수동 DB 수정이나 이전 오류 없이는 생기지 않아 발생 확률은 매우 낮다. 그러나 손상되면 `loadProjectForCreator`(편집·제출·업로드·withdraw·preview 경로)와 `loadProjectForAdmin`(심사 화면·판정·수정 알림 메일)이 함께 던진다. dbProjects.ts:51의 downloads 파싱은 바깥 try/catch(85-90)가 감싸 공개 페이지가 죽지 않게 한 것과 비대칭이고, 관리자 쪽은 심사 화면이 links를 쓰지도 않는데(FNC-21) 파싱 때문에 죽는다.
④ 한 행의 손상이 그 개설자의 모든 화면과 운영자 심사 화면을 막는다(복구가 DB 수정뿐).
⑤ **수정**: `parseLinks(raw: string | null): string[] | null` 헬퍼를 `lib/funding/creatorValidation.ts`에 두고 try/catch + Array.isArray + `isSafeCreatorLink`(:170, 이미 있음) 필터로 감싸 두 호출부에서 쓴다. 파싱 실패는 console.error만 남기고 null. 관리자 쪽은 links를 화면에 안 쓰면 파싱 자체를 빼는 것도 같은 효과다.
⑥ 검증자 확정.

#### FNC-23. 정산 기록의 중복 판정 String(error).includes('UNIQUE')가 drizzle 0.45.2에서 매치하지 않아 동시 기록의 패자가 409가 아니라 500을 받는다 [P3 · S]
① `lib/funding/payout.ts:656-660`, `pages/api/admin/funding/projects/[id].ts:561-563`, `lib/funding/payout.integration.test.ts:364-369`, `lib/funding/slugOccupancy.ts`(isUniqueConflictError), `lib/artistSupport/payout.ts:160`
② 
```ts
} catch (error) {
  // 유니크 위반 = 동시에 두 번 눌렀다. 다른 오류면 그대로 올린다.
  if (String(error).includes('UNIQUE')) return { ok: false, code: 'already_recorded' };
  throw error;
}
```
③ drizzle-orm 0.45.2에서 단일 INSERT…returning의 UNIQUE 위반은 'Failed query: insert into ...' 메시지로 감싸이고 sqlite 원문('SQLITE_CONSTRAINT: UNIQUE constraint failed: funding_project_payouts.project_id')은 cause에만 실린다. 검증자가 같은 모양의 인메모리 libsql 표로 격리 실험했을 때 `String(error).includes('UNIQUE')`는 false였다. 즉 이 분기는 지금도 죽은 코드이고 패자는 throw → 라우트 catch(:561-563)에서 500 '정산을 기록하지 못했습니다.'가 된다. 기존 테스트는 순차 호출이라 `preview.recorded` 사전 검사가 먼저 걸러 이 catch를 타지 않는다. 같은 패턴이 lib/artistSupport/payout.ts:160에도 있다.
④ 돈·데이터 손상은 없다(project_id UNIQUE 인덱스가 중복을 막고 승자는 정상 기록·메일 발송). 더블 클릭 경합에서 운영자가 500을 받아 기록이 안 된 줄 알고 혼동할 수 있다.
⑤ **수정**: `isUniqueConflictError(error, 'funding_project_payouts.project_id')`(slugOccupancy.ts, cause 사슬을 따라감)로 교체한다. `payout.integration.test.ts`에 `Promise.all`로 같은 프로젝트를 동시에 기록해 한쪽 ok·한쪽 already_recorded를 확인하는 케이스를 추가한다(순차 호출 테스트는 이 catch를 타지 않는다). lib/artistSupport/payout.ts:160도 같이 고친다.
⑥ 검증자 조정: 지적이 '현재는 동작'이라 쓴 부분이 틀렸고 실제는 이미 죽은 분기다. 같은 자리를 다른 축(DB 스키마·마이그레이션·쿼리)도 지적: "정산 기록 경합의 유니크 위반 판정(String(error).includes('UNIQUE'))이 drizzle 래핑 때문에 절대 맞지 않는다".

#### FNC-24. 정산 기록 확인창에 입금 대기 건수·금액이 빠져 있다 [P3 · S]
① `pages/admin/funding/projects/[id].tsx:546-555`, `components/admin/FundingPayoutSection.tsx:237-262` · `:276-280` · `:131-143` · `:371-384`, `lib/funding/payout.ts:593-630`, `lib/funding/bankTransfer.ts:58-63` · `:137`, `lib/funding/CLAUDE.md:252-258` · `:281-282`
② `recordFundingPayout`의 거부 조건은 already_recorded·not_closed·hasPayoutAccount·taxType·serviceChargesUnavailable·nothing_to_pay·amount_changed뿐이고 awaitingDepositCount는 보지 않는다. blockers 배열(237-262)에도 없고, 276-280은 `입금 대기 {n}건 {금액}은 입금 확인 전이라 정산에서 제외했습니다.` 안내 박스다. 확인창 문구(552-555)에 입금 대기 언급이 없다.
③ 입금 대기가 있는 채로 기록하면 이후 확정되는 입금은 기록 밖 차액이 된다. 그 처리는 설계돼 있다 — `confirmBankDeposit`이 정산 기록이 있으면 `payoutWarningOf` 경고를 응답 warnings로 돌려주고, 정산 패널 DRIFT_FIELDS가 차액을 role=alert로 띄우며, 헬스체크가 이체 전 netAmount 드리프트와 이체 뒤 늦은 입금 확정(30일)을 high로 알린다. lib/funding/CLAUDE.md:252-258·281-282가 '정산은 받은 돈만, 입금 대기는 미리보기가 따로 알린다'를 운영자 결정(2026-10-04)으로 적었다. 영구 제외가 아니라 추가 정산 대상으로 남는다. 남는 것은 같은 패널 위쪽 파란 박스에 이미 있는 건수·금액이 불변 기록을 굳히는 window.confirm에는 안 나온다는 UX 간극뿐이다.
④ 운영자가 입금 대기를 못 본 채 기록 버튼을 누를 수 있으나 돈이나 데이터가 사라지지는 않는다.
⑤ **수정**: `handleRecordPayout` 확인창 문구에 `(payout.awaitingDepositCount ?? 0) > 0`일 때 '입금 대기 N건 금액은 정산에서 빠진 채 기록됩니다. 이후 입금을 확인하면 추가로 보낼 몫이 생깁니다'를 덧붙인다. 서버 거부 조건(ExpectedPayoutAmounts에 awaitingDepositCount, acknowledge 플래그)은 만들지 않는다 — 계좌 입금은 자동 취소가 없어 입금 대기가 영구히 남을 수 있어 하드 게이트가 되면 정산이 막힌다.
⑥ 검증자 조정: '영구 제외' 주장은 틀렸고 제안한 blockers/체크박스는 운영자 결정과 부딪혀 확인창 문구로 좁혔다.

#### FNC-25. 이메일 변경 시 가입 기본 이름이 '설정한 이름'으로 오판된다 [P3 · S]
① `lib/funding/creatorAccountDecision.ts:172-178`, `lib/funding/creatorValidation.ts:149-150`, `lib/funding/creatorToken.ts:66`, `pages/api/funding/creator/projects/[id]/submit.ts:42-43`, `lib/funding/reviewDecision.ts:198-199`, `lib/funding/creatorProjectWrite.ts:333-349`
② 이메일 분기는 `db.update(fundingCreators).set({ email, sessionVersion: sql\`session_version + 1\`, updatedAt: now })`만 하고 name은 건드리지 않는다. 기본 이름 판정은 `export const isDefaultCreatorName = (name, email) => name.trim() === email.split('@')[0];`로 **현재 이메일**을 기준으로 한다. 가입 시 이름은 `name: normalized.split('@')[0]`.
③ 로컬파트가 바뀌면 미설정 계정이 설정 완료로 읽힌다. 그러면 `findMissingRequiredSections` 이름 검사(submit.ts:42-43·reviewDecision.ts:198-199)가 통과하고 `isCreatorNameLocked`/`saveCreatorSection`이 submitted 이후 그 이름을 잠근다. 발동 조건이 좁다 — (a) 이름을 한 번도 안 정한 계정이어야 하고(submitted/approved 프로젝트를 가진 계정은 이미 설정된 이름이 있다), (b) 운영자가 @ 앞부분까지 바꿔야 한다(도메인 오타 정정은 영향 없다).
④ 개설자가 옛 로그인 이메일 로컬파트 이름 그대로 제출·승인될 수 있다. 본인은 못 고치고 운영자 `set_creator_name` 경로로만 고칠 수 있다. 승인 때 운영자가 심사 화면에서 이름을 본다.
⑤ **수정**: 이메일 UPDATE의 set에서 name을 SQL CASE로 조건부 갱신한다: `name: sql\`CASE WHEN trim(name) = ${oldLocal} THEN ${newLocal} ELSE name END\``(oldLocal=creator.email.split('@')[0], newLocal=email.split('@')[0]). 앱 레벨 `isDefaultCreatorName` 분기 후 단순 대입은 읽기-쓰기 사이에 개설자가 저장한 진짜 이름을 덮어쓴다. 결과의 creatorName은 갱신 후 값으로 돌려주고, 승인된 프로젝트가 있는 레거시 계정을 위해 revalidateSlugs에 approved slug를 넣는다. `creatorAccountDecision.integration.test.ts`에 '기본 이름 계정은 이메일을 바꾸면 이름도 새 로컬파트', '설정된 이름은 그대로'를 추가한다. 근본 수정(name_set_at 컬럼)은 마이그레이션·배포 순서 부담에 비해 이득이 작아 권하지 않는다.
⑥ 검증자 조정: 발동 조건이 좁아 P2→P3. 원 수정안에 경합·재검증이 빠져 UPDATE 안 조건부 처리로 바로잡았다.

#### FNC-26. 관리자 화면·CLAUDE.md가 이메일 변경 시 세션이 안 끊긴다고 적지만 코드는 즉시 끊는다 [P3 · S]
① `pages/admin/funding/projects/[id].tsx:440` · `:447` · `:755-758`, `lib/funding/CLAUDE.md:391-392`, `lib/funding/creatorAccountDecision.ts:166-168` · `:176`, `lib/funding/creatorAuth.ts:25-50`, `lib/funding/creatorEmail.ts:128`
② 관리자 화면: `이미 로그인해 있는 브라우저 세션은 이메일을 바꿔도 끊기지 않습니다 — 쿠키 수명(최대 7일)이 지나거나 본인이 로그아웃해야 끝납니다.` CLAUDE.md: `이미 발급된 creator_session 쿠키는 서버가 끊을 수 없다(iron-session, 최대 7일). 이메일을 바꿔도 로그인된 브라우저는 그동안 그대로 들어온다.` 코드: `.set({ email, sessionVersion: sql\`session_version + 1\`, updatedAt: now })`와 주석 `판본이 오르면 authenticateCreator*의 대조가 어긋나 그 쿠키가 즉시 죽는다`. `authenticateCreatorApi/Request`가 요청마다 쿠키 판본과 DB 판본을 대조한다. 개설자 메일(creatorEmail.ts:128)은 '기존 로그인 상태가 모두 무효가 됐습니다'로 코드와 맞다.
③ 화면 문구는 #212(2026-09-23), 세션 판본은 #256(2026-09-25)에 들어왔고 문구가 갱신되지 않았다.
④ 탈취 대응 안내가 사실과 반대라 운영자가 불필요한 추가 조치를 하거나, 다음 사람이 이미 있는 세션 차단을 모르고 다시 만든다. 보안이 약해지는 방향의 오류는 아니다.
⑤ **수정**: `[id].tsx:755-758`을 '이메일을 바꾸면 그 계정의 로그인 링크와 이미 로그인해 있는 브라우저 세션이 모두 즉시 끊깁니다. 이름만 바꾸는 것은 세션을 끊지 않습니다.'로 고치고, 확인창(440행)과 성공 메시지(447행 — 틀린 게 아니라 불완전한 서술)에 '로그인 중인 세션도 끊깁니다'를 추가하며, `lib/funding/CLAUDE.md:391-392`를 같은 사실(session_version 대조, creatorAuth.ts)로 고친다.
⑥ 검증자 조정: 돈·데이터·보안이 깨지지 않는 문서 정정이라 P2→P3.

#### FNC-27. 개설자 화면이 공개 상태(종료·숨김·마감)를 보여주지 않는다 [P3 · M]
① `components/funding/creator/types.ts:30-62` · `:130-147`, `pages/[locale]/funding/creator/[id].tsx:87-117`, `pages/[locale]/funding/creator/index.tsx:94`, `lib/funding/creatorProjectList.ts:11`, `pages/api/admin/funding/projects/[id].ts:415-450`
② `EditorProject`에는 `reviewStatus: string`(49)만 있고 `status`·`hidden`이 없다. `toEditorProject`는 `CreatorProjectDetail.status`를 옮기지 않는다. `approved: '공개된 프로젝트입니다. … 정산 정보 구획이 열렸으니 모금이 끝나기 전에 채워 주세요.'`(types.ts:142)가 reviewStatus만으로 뜬다. 목록은 `REVIEW_STATUS_LABEL[p.reviewStatus]`(approved→'공개')만 배지로 그리고 `CreatorProjectSummary.status`는 읽어 놓고 쓰지 않는다.
③ 심사 상태와 공개 상태는 다른 축인데 개설자 목록·편집 화면은 reviewStatus만 그린다. 운영자 종료(status closed), 목록 숨김(hidden), 모금 마감 뒤에도 '공개' 배지와 '모금이 끝나기 전에 채워 주세요' 안내가 그대로다. 완화: 공개 상태 변경 시 개설자에게 알림 메일이 가고(`sendPublicStatusEmail`), 배송지 화면은 마감 전/후를 자체 안내하며(shipping.tsx:76), 마감 후에도 정산 구획은 열려 있다(EDITABLE_SECTIONS approved: payout).
④ 종료 사유 메일을 놓친 개설자는 화면에서 상태를 알 수 없다. 혼동과 문의가 늘어나는 수준이다.
⑤ **수정**: `listProjectsForCreator`·GSSP에서 status/hidden과 마감 여부를 props로 더해(DB 프로젝트는 `computeProjectState`가 요구하는 FundingProject 모양으로 변환하거나 `buildPublicStatus`가 쓰는 판정 재사용), 목록·편집 화면 배지 옆에 '모금 중 / 시작 전 / 마감 / 운영자 종료 / 목록 숨김' 보조 배지를 그린다. `REVIEW_STATUS_NOTICE.approved`는 마감 뒤에 '모금이 끝났습니다. 배송지 보기와 정산 정보를 확인해 주세요'로 갈라 쓴다. `tests/pages/funding/creator/index.test.ts`의 summary 픽스처에 closed 케이스를 추가한다.
⑥ 검증자 조정: '정산 정보를 못 채워 정산이 막힌다'는 과장이라 P2→P3.

#### FNC-28. 파일 slug가 DB 프로젝트 slug를 가리는 경우 개설자 대상 진입점에 런타임 가드가 없다 [P3 · L]
① `lib/funding/creatorShipping.ts:118` · `:127` · `:181`, `lib/funding/payout.ts:282-283` · `:298-299`, `lib/funding/fulfillment.ts:84` · `:157`, `lib/funding/creatorStats.ts:84`, `db/schema.ts:826-831`, `lib/funding/CLAUDE.md:318-339`, `lib/ops/healthCheck.ts:875-908`
② `FROM orders o JOIN funding_pledges fp ON fp.order_id = o.id WHERE fp.project_slug = ${project.slug} AND o.status IN (…)` 같은 slug 문자열 조인이 정산·배송·발송에 있고, 통계는 `getFundingProjectAsync(row.slug)`(파일이 이긴다)다. db/schema.ts 주석: '공개 주소이자 후원 행(funding_pledges.project_slug)이 문자열로 참조하는 키'.
③ 이 구조는 결함이 아니라 문서화된 설계 결정이다 — 마크다운 프로젝트는 funding_projects 행이 없어 project_id FK를 줄 수 없다. file→DB 방향 충돌은 CLAUDE.md가 위험·절차를 명시하고, 반대 방향은 reviewDecision.ts:174-177이 막으며, 헬스체크가 매일 high로 알린다. 코드 가드가 없는 이유는 '빌드가 TURSO 없이 성공해야 해서'이고 런타임 가드는 막혀 있지 않다. 충돌이 생기면 개설자 화면 경로는 slug 문자열 일치만으로 통과한다.
④ 운영자가 승인된 DB 프로젝트와 같은 slug의 md를 추가하는 실수를 했을 때, 헬스체크 알림(하루) 전까지 해당 개설자 화면에 md 쪽 후원자 배송지가 실릴 수 있다.
⑤ **수정**: FNC-4와 같은 작업이다. 공용 판정 하나(`getFundingProject(slug)`가 동기 파일 조회이므로 DB 없이 `isSlugShadowedByFile(slug)`)를 만들어 개설자 대상 진입점 세 곳(`loadCreatorShipping`, `setFulfillment`의 creator 분기, `loadCreatorProjectStats`)에서 참이면 null/forbidden으로 막는다. 관리자 전용인 payout·정산은 제외한다. `funding_pledges.project_id` 마이그레이션(전체 컬럼 SELECT 관계 조회 전부를 배포 순서에 묶고 md 후원은 NULL이라 단순화도 안 됨)과 CI 스냅샷(CI에 DB가 없고 곧 낡음)은 하지 않는다. `lib/funding/CLAUDE.md:331-339`의 '코드 가드는 없다' 단락도 갱신한다.
⑥ 검증자 조정: 설계 결정이고 완화가 있어 P3. FNC-4(1라운드)가 같은 결함을 P2로 다루며 수정 범위도 같으니 한 번에 고친다.

#### FNC-29. 정산 기록 전 검사 순서 — 복호화(접속기록을 남기는 점검)가 services_unavailable·nothing_to_pay·amount_changed보다 먼저 돈다 [P3 · S]
① `lib/funding/payout.ts:415-426` · `:490-499` · `:596-630`, `pages/api/admin/funding/projects/[id].ts:560`, `lib/funding/payout.integration.test.ts:395-500` · `:640-760`
② `const accountRead = await payoutAccountReadable(projectId, actor, ip);`(599) → `residentNumberReadable`(606) 뒤에야 `if (preview.serviceChargesUnavailable) return …;`(616), `if (preview.netAmount <= 0 && offsetTotal <= 0) return …nothing_to_pay;`(622), `if (preview.netAmount !== expected.netAmount …) return …amount_changed;`(623-630)가 온다. 두 점검은 각각 `recordPrivacyAccess(…'funding_*_decrypt_check')`를 남긴다.
③ 세 거부는 모두 미리보기 값만 보는 판정이라 복호화가 필요 없는데, 마이그레이션 0041 미적용·금액 변동·0원으로 거부될 요청에서도 계좌와 주민등록번호를 실제로 복호화하고 접속기록을 두 줄 남긴다. 주민등록번호 기록은 원천징수 개설자에게만 남고, 접속기록은 실제 복호화를 정확히 반영하므로 '기록이 부풀었다'기보다 '불필요한 복호화를 한다'는 최소화 문제다. 관리자 라우트는 `recordFundingPayout`을 그대로 부른다.
④ 운영자가 금액이 바뀐 화면에서 두세 번 다시 누르면 그만큼 고유식별정보 복호화 기록이 쌓이고, 처리방침 19항의 접속기록이 실제 열람 의도를 가리키지 못한다. 금액·데이터는 틀어지지 않는다.
⑤ **수정**: `recordFundingPayout`에서 값싼 판정(recorded→closed→hasPayoutAccount→taxType→hasResidentNumber→serviceChargesUnavailable→nothing_to_pay→amount_changed)을 모두 먼저 끝낸 뒤 `payoutAccountReadable`/`residentNumberReadable`을 INSERT 직전에 부른다. 현재 테스트는 모두 후원 1건을 심고 금액을 맞춰 부르므로 깨지지 않는다. `payout.integration.test.ts:649-746`의 접속기록 테스트에 'amount_changed로 거부되면 복호화 기록이 남지 않는다'를 추가.
⑥ 검증자 확정.

#### FNC-30. 배송 화면 '후원자 수'는 LIVE 주문 건수이고 현황 패널 'N건'은 입금 대기까지 센다 — 같은 개설자가 두 숫자를 다른 화면에서 본다 [P3 · S]
① `pages/[locale]/funding/creator/[id]/shipping.tsx:49-52`, `lib/funding/creatorShipping.ts:107-118`, `lib/funding/creatorStats.ts:46` · `:70-101`, `lib/funding/refundable.ts:72-73`, `components/funding/creator/ProjectStatsPanel.tsx:23`, `pages/[locale]/funding/creator/[id].tsx:300-314`
② 배송 화면 `<dt>후원자 수</dt><dd>{summary.backerCount}</dd>`의 값은 `COUNT(*) AS backers … WHERE … o.status IN (${liveFundingOrderStatusList()})`(건수, 입금 대기 제외)다. 현황 패널은 `buildPublicStatus` → `countedFundingPledgeSql`(입금 대기 포함)을 쓰고 ProjectStatsPanel.tsx:23 주석이 '후원자 수가 아니라 건수다'라고 못박았다. 편집 화면은 현황 패널과 '배송지 보기' 링크를 나란히 둔다.
③ 라벨은 '후원자 수'(인원)인데 값은 주문 건수이고, 같은 프로젝트의 현황 패널 '건'과 입금 대기만큼 다르다. 계좌 입금은 자동 해제가 없어 마감 뒤에도 대기가 남으므로 두 숫자가 실제로 갈린다. 어느 쪽도 차이를 설명하지 않는다.
④ 개설자가 '현황은 12건인데 배송지는 10명'을 보고 누락으로 오인해 문의한다.
⑤ **수정**: `shipping.tsx:50`의 라벨을 '확정 후원 건수(입금 확인 전 계좌 입금 제외)'로 바꾸고, `loadSummary`에 awaitingDepositCount를 더해 '입금 대기 N건은 확인 뒤 표에 들어옵니다' 한 줄을 붙인다(`payout.ts:296-301`과 같은 질의 재사용). 가장 싼 수정은 라벨만 '후원 건수'로 맞추는 것이다.
⑥ 검증자 확정.

#### FNC-31. fulfillment.ts 운송장 지우기 주석이 호출부와 다르다 [P3 · S]
① `lib/funding/fulfillment.ts:114-122`, `pages/api/funding/creator/projects/[id]/fulfillment.ts:85-86`, `pages/api/admin/funding/pledges/[id].ts:121-122`, `components/funding/creator/ShippingTable.tsx`, `tests/api/admin/funding/pledges/setFulfillment.integration.test.ts:122`
② 주석: `// 관리자 라우트는 지금 undefined만 넘기므로 … null을 실제로 보내는 것은 개설자 경로(다음 태스크)뿐이다.` 그러나 개설자 라우트는 `const trackingCompany = typeof req.body?.trackingCompany === 'string' ? req.body.trackingCompany : undefined;`로 관리자 라우트와 똑같이 null을 undefined로 접는다. ShippingTable.tsx는 항상 문자열(''·값)을 보내(`useState(row.trackingCompany ?? '')`, api.ts:65 타입은 string) `'' || null`로 지워진다.
③ 주석은 개설자 경로가 null을 보낸다고 하지만 두 호출부 모두 문자열이 아니면 undefined로 접어 null을 실제로 넘기는 곳은 없다. 지우기는 빈 문자열로만 표현된다.
④ 기능 영향 없음. 다음 사람이 null 전제로 라우트를 고치면 지우기가 조용히 안 될 수 있다.
⑤ **수정**: 주석만 고친다 — '두 라우트 모두 문자열이 아니면 undefined로 접는다. 지우기는 빈 문자열로 표현한다(setFulfillment.integration.test.ts:122가 고정)'. 개설자 라우트의 null 통과와 테스트 추가는 하지 않는다(테스트는 이미 있다).
⑥ 검증자 조정: 원 수정안의 null 통과·테스트 추가는 불필요.

#### FNC-32. 승인 뒤에도 보완 요청 사유가 개설자에게 경고로 남는다 [P3 · S]
① `pages/admin/funding/projects/[id].tsx:300-312`, `lib/funding/reviewDecision.ts:250` · `:270`, `pages/api/funding/creator/projects/[id]/submit.ts:110-115`, `pages/[locale]/funding/creator/[id].tsx:293-295`, `pages/[locale]/funding/creator/index.tsx:105-107`, `lib/funding/reviewDecision.integration.test.ts:166-176`, `lib/funding/publicStatusDecision.ts:83` · `:115`
② `const approveReviewNote = input.note !== undefined ? note : project.reviewNote;` — 관리자 `handleApprove`(:312)는 note를 보내지 않는다. 개설자 화면은 `{project.reviewNote && <Notice tone="warning" title="운영자 메모">…}`를 상태와 무관하게 그린다. 제출은 reviewNote를 건드리지 않는다. reviewDecision.integration.test.ts:175는 이 보존을 의도로 고정한다.
③ 보완 요청 → 재제출 → 승인 뒤에도 옛 사유가 남는다. 다만 보존은 의도다(운영자가 미리 적어 둔 메모가 승인과 함께 조용히 사라지던 문제를 일부러 고친 것)이고, 승인된 프로젝트의 reviewNote는 close/reopen/hide 사유로도 쓰여 승인 뒤에 의미가 있다. 한 칸을 여러 용도가 공유하는 것은 lib/funding/CLAUDE.md:94-96·357-362가 알려진 설계로 적었다.
④ 승인 직후 개설자 혼선과 문의. 데이터·금액 영향 없음.
⑤ **수정**: 승인 로직과 개설자 화면 톤은 건드리지 않는다. 관리자 `handleApprove` 확인창에 기존 reviewNote가 있으면 그 문장을 보여 주고 '승인 뒤에도 개설자에게 그대로 보입니다. 지우려면 취소하고 메모 칸을 비워 저장하세요'를 덧붙인다. 승인 상태의 set_review_note는 빈 값을 허용하므로 지우기 경로는 이미 있다.
⑥ 검증자 조정: 원 수정안 둘(승인 때 비우기, 톤 낮추기)은 기존 결정과 충돌해 확인창 안내로 바꿨다. funding_project_notes 표 분리는 과하다.

#### FNC-33. 정산 메일의 '결제 수수료' 라벨에 부가세 포함 표기가 빠졌다(플랫폼 수수료에는 있다) [P3 · S]
① `lib/funding/payoutEmail.ts:56-57`, `components/admin/FundingPayoutSection.tsx:268-269`, `pages/[locale]/funding/creator-terms.tsx:83`, `pages/[locale]/funding/apply.tsx:71`, `components/funding/creator/PayoutSectionForm.tsx:138`
② `{ label: '플랫폼 수수료(부가세 포함)', value: … }, { label: '결제 수수료', value: … }`. 약관 제6조는 '플랫폼 수수료는 5.5%, 결제 수수료는 3.3%이며 둘 다 부가가치세를 포함한 요율입니다'. apply.tsx:71·PayoutSectionForm.tsx:138은 '(둘 다 부가세 포함)'. FundingPayoutSection.tsx:268-269 설명문은 '플랫폼 수수료 {}%(부가세 포함)와 결제 수수료 {}%'로 같은 비대칭이다.
③ 같은 성격의 두 수수료를 한쪽만 '부가세 포함'으로 적으면 다른 쪽은 별도 과세로 읽힌다. 이 메일이 개설자에게 가는 유일한 계산 내역이다. 요율 숫자를 일부러 안 적는 결정(payoutEmail.ts:36-45)과는 충돌하지 않는다.
④ 개설자가 결제 수수료에 부가세가 더 붙는지 문의하거나 세금계산서 금액을 잘못 계산한다. 금액은 맞다.
⑤ **수정**: `payoutEmail.ts:57` 라벨을 '결제 수수료(부가세 포함)'로, `FundingPayoutSection.tsx:268-269` 설명문도 '둘 다 부가세 포함'으로 맞춘다. `payoutEmail.test.ts`에 두 라벨 단언 추가(현재 없음).
⑥ 검증자 확정. overflow "FundingPayoutSection.tsx:268-269 설명문도 '(부가세 포함)' 누락"이 같은 수정이다.

#### FNC-34. 신청 화면이 정산 시점을 단정하고 개인 개설자의 추가 공제를 말하지 않는다 [P3 · S]
① `pages/[locale]/funding/apply.tsx:69-73` · `:112`, `components/funding/creator/PayoutSectionForm.tsx:129` · `:137-141`, `pages/[locale]/funding/creator-terms.tsx:87`, `lib/funding/policy.ts:44-50`, `content/creatorTerms.baseline.test.ts:195-200`
② apply.tsx: `정산은 모금이 끝나고 영업일 {FUNDING_PAYOUT_BUSINESS_DAYS}일 이내에 보내 드립니다. 플랫폼 수수료 {}%와 결제 수수료 {}%(둘 다 부가세 포함)를 개설자가 부담합니다.` 약관 §6: `위 정산 정보가 모두 등록되어 있는 경우 … 보내는 것을 원칙으로 합니다. 등록되지 않은 항목이 있으면 … 등록이 끝난 뒤에 보냅니다.` 기준선 테스트('6조의 정산 시점이 정산 정보 등록을 전제로 걸려 있다')는 약관만 본다.
③ apply.tsx만 조건 없이 적고, 수수료 둘 외에 원천징수 개설자가 부가세 상당액(10/110)과 원천징수를 추가로 뺀다는 말이 없다. 완화: 같은 화면에 약관 링크(:112), 심사 신청 전 약관 동의 체크박스, 정산 정보 입력 폼(PayoutSectionForm.tsx:137-141)이 환불→수수료→부가세 상당액→원천징수 순서를 풀어 쓴다. PayoutSectionForm.tsx:129는 계좌를 등록하는 폼 안의 문장이라 결함이 아니다.
④ 신청 전 기대 수취액이 실제보다 높게 읽힐 수 있다. 분쟁 위험은 낮다.
⑤ **수정**: apply.tsx 문장만 고친다 — '정산 정보(계좌·세금 처리 구분)가 등록돼 있으면 모금이 끝난 날부터 영업일 N일 이내에 보내는 것을 원칙으로 합니다' + '개인(원천징수) 개설자는 수수료를 뺀 금액에서 부가세 상당액과 원천징수세액도 뺍니다(개설자 약관 제6조)'. `PayoutSectionForm.tsx:129`와 policy.ts 공유 문장 상수는 손대지 않는다 — creatorTerms.baseline.test.ts가 policy.ts 상수가 보간된 약관 본문을 해시하므로 카피를 고치려다 약관 판본 게이트를 건드리는 결합이 생긴다. 고친 뒤 `npx jest content/creatorTerms.baseline.test.ts`로 해시가 안 바뀌었는지 확인.
⑥ 검증자 조정: 범위를 apply.tsx 한 문장으로 좁혔다.

#### FNC-35. 관리자 발송 상태 저장에는 마감 전 경고가 없다 [P3 · S]
① `pages/api/admin/funding/pledges/[id].ts:114-131`, `pages/admin/funding/[id].tsx:586-622`, `pages/api/funding/creator/projects/[id]/fulfillment.ts:77-79`, `lib/funding/creatorShipping.ts:25-28`, `lib/funding/policy.ts:123`
② `case 'set_fulfillment': { const result = await setFulfillment({ pledgeId, status: b.fulfillmentStatus, …, actor: { kind: 'admin', actor: auth.actor }, now }); …}` — 마감 여부 검사가 없다. 개설자 라우트는 `if (!gate.pastFundingEnd) return 409 '모금이 끝난 뒤에만 발송 상태를 바꿀 수 있습니다.'`이고 이유는 creatorShipping.ts:25-28 '개설자가 preparing을 한 번 누르면 후원자는 원래 마감일 전에 취소권을 잃는다'. 셀프 취소는 `if (input.fulfillmentStatus !== 'none') return { ok: false, code: 'fulfilling' };`.
③ 마감 전 후원의 발송 상태를 none이 아닌 값으로 저장하면 그 후원자의 셀프 취소가 막힌다. 개설자 경로는 마감 게이트로 막지만 관리자 경로는 경고도 없다. 다시 '미발송(none)'으로 저장하면 되살아나므로(관리자 select가 none을 포함) 영구 잠금은 아니고, 관리자가 마감 전에 일부러 발송하는 정당한 경우(조기 발송, md 프로젝트 직접 운영)도 있다.
④ 마감 전 실수 저장 시 후원자가 스스로 취소하지 못한다. 되돌릴 수 있다.
⑤ **수정**: API 게이트나 ack 필드를 두지 않는다. 관리자 상세 getServerSideProps가 프로젝트 마감 여부(`isPastFundingEnd`)를 props로 주고, `handleSaveFulfillment`가 '마감 전이고 none이 아닌 값으로 저장'할 때만 `run()`의 확인창(`handleResendEmail`과 같은 패턴)으로 '아직 모금 중입니다. 저장하면 이 후원자는 스스로 취소할 수 없게 됩니다'를 띄운다.
⑥ 검증자 조정: 원 제안의 acknowledgeBeforeEnd 409는 되돌릴 수 있는 클릭 실수에 비해 과하다.

#### FNC-36. buildFundingPayoutPreview는 now를 받지 않고 new Date()를 쓴다 — recordFundingPayout(projectId, now)와 시계가 둘이다 [P3 · S]
① `lib/funding/payout.ts:341-345` · `:573-653`, `pages/admin/funding/projects/[id].tsx:85`, `lib/funding/payout.integration.test.ts:81` · `:372-380`
② `closed: computeProjectState({ status: project.status, startAt: …, endAt: … }, new Date()) === 'closed'`이고 호출부는 `recordFundingPayout = async (projectId, now, expected, ip, actor) => { const preview = await buildFundingPayoutPreview(projectId); …insert … createdAt: now, updatedAt: now`.
③ 기록 시각은 호출부의 now인데 마감 판정은 함수 안의 벽시계라 한 호출에 시계가 둘이다. 테스트가 마감 경계를 재현하려면 시스템 시계를 흔들어야 하고(:372는 endAt을 미래로 심어 우회), 같은 호출 안에서 두 시각이 다를 수 있다.
④ 기능 영향은 미미. 경계값(endAt=23:59:59 KST 직후) 테스트가 불가능하고, FNC-6(조기 종료 판정) 수정 시 now 주입이 없으면 테스트를 못 쓴다.
⑤ **수정**: `buildFundingPayoutPreview(projectId, now: Date = new Date())`로 시그니처를 넓히고 `recordFundingPayout`·GSSP(`[id].tsx:85`)·mark_payout_paid가 now를 넘긴다. 기본값 덕에 호출부가 안 깨지고, 기존 테스트는 now를 2026-02-20(기본 endAt 2026-02-01 뒤)이나 new Date()로 넘기므로 그대로 통과한다.
⑥ 검증자 확정. FNC-6보다 먼저 한다.

#### FNC-37. mark_payout_paid가 기록 행 하나를 위해 정산 미리보기를 다시 계산한다 [P3 · S]
① `pages/api/admin/funding/projects/[id].ts:605-621`, `lib/funding/payout.ts:263-352`, `lib/funding/projectServices.ts:103-113`, `lib/funding/publicStatusDecision.ts:63-66`
② `const preview = await buildFundingPayoutPreview(id); if (!preview) 404; if (!preview.recorded) 409; const done = await markFundingPayoutPaid(preview.recorded.id, memo, now);` — 미리보기는 orders⋈funding_pledges 집계 2회, fundingProjectPayouts, loadProjectService, 계산을 모두 수행한다.
③ 지급 표시는 funding_project_payouts의 한 행만 필요한데 전체를 돈다. 서비스 표 장애(0041 미적용)에는 영향받지 않는다 — `loadProjectService`는 try/catch로 `{available:false}`를 돌려주고 미리보기는 플래그만 세우며 mark_payout_paid는 그 플래그를 보지 않는다.
④ 정산 프로젝트당 한 번 누르는 관리자 클릭의 불필요한 질의 몇 개.
⑤ **수정**: 라우트에서 `fundingProjectPayouts.findFirst(where projectId)`로 기록 행을 바로 읽는다(publicStatusDecision.ts:63-66과 같은 인라인 형태, 새 공용 함수 없이). 행이 없으면 지금과 같은 409, 있으면 `markFundingPayoutPaid`와 `notifyPayout`에 그대로 넘긴다. FNC-2의 4번(기록값 대 현재값 비교)을 넣는다면 그때는 미리보기가 필요하므로 두 수정의 순서를 함께 정한다.
⑥ 검증자 조정: '0041 미적용 시 500'·'큰 캠페인에서 느려진다'는 틀렸다.

**클린 판정**
- 개설자 IDOR: pages/api/funding/creator/projects/[id].ts, [id]/rewards.ts, submit.ts, withdraw.ts, upload.ts, fulfillment.ts, shipping.csv.ts, GSSP(creator/[id].tsx, preview.tsx, shipping.tsx, index.tsx)와 creatorStats·loadCreatorShipping·loadFulfillmentGate가 모두 세션 creatorId를 SQL 소유 조건(creator_id=?)으로 대조하고 남의 것은 404로 통일한다. pledgeId→실제 프로젝트 되짚기(loadFulfillmentGate)로 URL id 우회도 막혀 있다.
- 매직링크·세션: 토큰은 sha256 해시로만 저장, 소진은 `used_at IS NULL` 조건의 원자적 UPDATE, 소진은 POST 전용(session.ts)이라 링크 검사기 GET에 안전, 발급 때 기존 토큰 폐기, sessionVersion 쿠키-DB 대조(조회 실패 시 닫힘), 로그아웃·이메일 변경 시 판본 증가, Origin(없으면 Referer) 검사와 SameSite=lax 조합, 응답이 가입 여부와 무관하게 동일.
- 심사 전이: reviewTransition.ts 표가 정본이고 approved·rejected는 종결, decideProject의 reviewStatus+submittedAt 낙관적 잠금, 승인 배치의 `p.updated_at = epoch` EXISTS(리워드 잠금 경합), 슬러그 3중 검사(예약어·md·DB)+부분 유니크 인덱스, 승인 시 필수값·날짜·약관 동의 재확인.
- 정산 산식(lib/funding/payout.ts, withholdingTax.ts): 환불 선차감→수수료→부가세 상당액→원천징수(소득세/지방세 각각 절사)→설계·제작비 공제 순서와 불변식이 약관 제6조와 일치. 수수료 반올림은 0~2천만 전수 비교에서 정수 연산(half-up)과 불일치 0건, withVat도 0~1억 전수 불일치 0건. 계좌 입금 몫 결제 수수료 제외, 입금 대기 제외, 기록 시 화면 금액 4개 대조(amount_changed), 계좌·주민번호 복호화 사전 점검과 접속기록.
- 암호화 필드: 정산 계좌·주민등록번호는 props/응답에 평문·암호문 모두 싣지 않고(뒤 4자리·불리언만), 관리자 조회는 별도 GET 라우트+no-store+접속기록(성공·실패), 승인된 프로젝트만 열림.
- 배송 격리: loadCreatorShipping은 날짜 마감 전 집계만, 필드 화이트리스트 CSV, 수식 인젝션 방어(csv.ts), 열람·내려받기 접속기록, setFulfillment의 라이브 주문 집합·환불 요청 차단·delivered_at COALESCE 규칙·UPDATE WHERE 이중 방어와 fulfillment_updated_by(파기 대상 제외).
- 개설자 콘텐츠: stripTrustedDirectives와 렌더러 분리 정규식이 줄 단위로 동일(\r 포함 검증), MarkdownImage가 미등록 외부 이미지를 링크로 강등, 업로드 키 접두사(creatorId)+mediaAccess fail-closed, 외부 호스트 coverUrl 차단, 숏코드·raw HTML 차단.
- 개설자·운영자 메일: 레이아웃 rows/escapeHtml 적용, 입력값 escape, 실패 시 운영자 폴백, 계좌 전체 비노출(뒤 4자리), 이름/이메일 변경은 옛 주소에도 통지.
- 개설자 약관 게이트: content/creatorTerms.baseline.test.ts의 해시·판본 형식·갱신 경로 자물쇠·6조 보간 단언 구조(실행 통과 확인), 약관 제3·6·8조의 서술이 EDITABLE_SECTIONS·basicLockedViolation·payout·CSV 열과 일치.
- 실행해 통과 확인: content/creatorTerms.baseline.test.ts, lib/funding/payout.test.ts, lib/funding/reviewTransition.test.ts (45 tests).
- 매직링크·세션 계층(lib/funding/creatorToken.ts·creatorAuth.ts·creatorSession.ts, pages/api/funding/creator/login.ts·session.ts·logout.ts, pages/[locale]/funding/creator/auth.tsx): 해시 저장·used_at 원자 소진·POST 전용 소진·replaceState로 토큰 URL 제거·sessionVersion 대조(조회 실패 시 닫힘)·가입/기존 캡 분리·응답 동일성 — 1라운드 판정과 같이 문제 없음(세션 라우트 레이트리밋만 위 P3).
- 심사 전이·승인 배치(lib/funding/reviewTransition.ts, reviewDecision.ts, slugOccupancy.ts, submit.ts, withdraw.ts): 전이표 단일 정본, submittedAt 낙관적 잠금, 리워드 잠금 EXISTS(updated_at=epoch), 부분 유니크 인덱스와 isUniqueConflictError(cause 사슬), withdraw의 submittedAt NULL, 리드타임 재검사. 통합 테스트 이름과 단언 일치 확인.
- 개설자 쓰기 서비스(lib/funding/creatorProjectWrite.ts)의 guard 소유 조건·raced() WHERE·basicLockedViolation·lockedViolation·stripTrustedDirectives·STORY_MIN_LENGTH 승인 뒤 가드, 리워드 라우트(previousRewardId 계약·create 중복 선조회·조인된 소유 조건).
- 정산 산식(lib/funding/payout.ts computeFundingPayout/ForProject/splitCreatorShare/applyServiceCharges, lib/withholdingTax.ts): 환불 선차감→수수료→부가세 상당액→원천징수(소득세·지방세 각각 절사)→설계·제작비 공제, 불변식, 계좌 입금 몫 결제 수수료 제외, recordedVatDeduction 역산, amount_changed 4개 값 대조, 복호화 점검의 접속기록(성공·실패·조회 오류).
- 계좌·주민등록번호 경로(lib/funding/payoutAccount.ts·payoutAccountCrypto.ts·residentNumber.ts, pages/api/admin/funding/projects/[id]/payout-account.ts·resident-number.ts, refund-account.ts): 승인 프로젝트 게이트, no-store, 접속기록 성공·실패, 코드별 운영자 안내, props에 평문·암호문 미탑재(loadPayoutSummary·AdminPayoutView·EditorPayoutSummary 모두 불리언/뒤 4자리).
- 발송·배송지(lib/funding/fulfillment.ts, creatorShipping.ts, pages/api/funding/creator/projects/[id]/fulfillment.ts·shipping.csv.ts, shipping.tsx, ShippingTable.tsx): pledge→slug→approved 프로젝트 되짚기, URL id 불일치 404, ownerCondition WHERE, delivered_at COALESCE/NULL/디지털 유지, refund_requested 차단, shipHold 판정 일치, CSV 화이트리스트·수식 인젝션 방어, 화면 열람도 접속기록.
- 관리자 후원 쓰기(pages/api/admin/funding/pledges/[id].ts·index.ts, export.ts, lib/funding/admin-list.ts·admin-serialize.ts): memoUnchanged 낙관적 잠금, 보호 메모 판정(줄 단위), 센티널 보존 규약, 수기 등록의 재고 조건 INSERT·failed 되돌림·플레이스홀더 메일 가드, 같은 이름 입금 신청 409, 201 상한과 KPI 분리, export 접속기록.
- 스튜디오 서비스(lib/funding/projectServices.ts): 테이블 부재/스키마 불일치/장애 3분기, 약정가 복사, none 보존, COALESCE 멱등 입금 확인, 제작비 상한·수행자 로그.
- 개설자·운영자 메일(lib/funding/reviewEmail.ts·creatorEmail.ts·payoutEmail.ts, email.ts의 submission/withdrawal/cap/failure 알림): 공용 레이아웃 사용, 사용자 입력 escape, 실패 시 운영자 폴백, 운영자 메일에 관리자 딥링크, 계좌는 뒤 4자리·은행·예금주만.
- 개설자 약관 판본 게이트(content/creatorTerms.baseline.test.ts): 해시·판본 형식·갱신 경로 자물쇠·6조 보간·조건부 문장 단언 구조 적절(실행하지는 않았으나 1라운드가 통과 확인). 파기 크론(pages/api/cron/purge-funding.ts)의 세 파기 격리와 mediaRetention의 접두사 이중 확인.
- 실행해 통과 확인: lib/funding/creatorAccountDecision.integration.test.ts, lib/funding/retention.test.ts (29 tests).

**읽지 못한 범위**
- 후원자 결제 경로(lib/funding/service.ts, confirm.ts, cancel.ts, bankTransfer.ts, lineRefund.ts, validation.ts)는 범위 밖이라 읽지 않았다 — 정산 gross의 입력 정합성은 이 경로에 달려 있다.
- pages/[locale]/funding/apply.tsx, components/funding/creator/*Form.tsx·ShippingTable.tsx·ProjectStatsPanel.tsx(클라이언트 폼)는 정독하지 않았다. 클라이언트 쪽 dirty 가드·접근성은 보지 않음.
- 배포 산출물과 운영 DB 상태는 확인할 수 없다: .next의 nft(파일 트레이싱) 결과, Turso 마이그레이션 적용 상태, Vercel 환경변수. 트레이싱 의심(항목 7)은 코드만으로 추정한 것이다.
- lib/contracts/admin-auth.ts(관리자 인증·ADMIN_ACCOUNTS), lib/privacy/accessLog.ts, lib/booking/rate-limit.ts의 fail-open 동작은 호출부 관점에서만 보았다.
- pages/api/cron/*(purge-funding, purge-orders)와 lib/funding/mediaRetention.ts의 크론 라우트 배선, 약관/처리방침 본문 전체(policy.ts 300행 이후)는 정독하지 않았다.
- 통합 테스트는 3개 스위트만 실행했고 lib/funding/*.integration.test.ts 전체, tests/api/funding/creator/*는 실행하지 않았다(읽기로만 확인).
- scripts/rotate-field-key.mjs, lib/crypto/*의 키 회전 절차와 소액부징수 등 세무 판단은 범위 밖이다.
- pages/admin/funding/index.tsx·[id].tsx(후원 관리자 목록·상세, 654+647줄)는 grep·부분 sed로만 보았다 — 수기 등록 폼 전체·환불 줄 UI·확인 문구 전수는 읽지 않았다.
- components/admin/FundingPayoutSection.tsx는 blockers·입금 대기 안내 부분(228-290)만 읽었다. RewardSectionForm.tsx·StorySectionForm.tsx·CreatorSectionForm.tsx·ImageUploadField.tsx는 업로드 kind·구조만 확인했고 dirty 가드·접근성은 보지 않았다.
- lib/funding/service.ts·confirm.ts·cancel.ts(78줄 이후)·lineRefund.ts·validation.ts·bankTransfer.ts(전체)는 정산 상호작용(payout 참조) grep과 머리 부분만 읽었다 — 정산 gross의 입력 정합성(환불 기록 경로·웹훅 대사)은 1라운드와 마찬가지로 범위 밖으로 남는다.
- tests/api/admin/funding/*.test.ts, tests/pages/funding/creator/* 는 파일 목록과 일부 grep만 했다. 통합 테스트 실행은 creatorAccountDecision·retention 두 스위트뿐이고 payout/reviewDecision/creatorShipping/fulfillment 스위트와 content/creatorTerms.baseline.test.ts는 실행하지 않았다(읽기만).
- lib/ops/healthCheck.ts(정산 대기·slug 충돌·입금 확정 경보)와 lib/ops/adminDashboard.ts는 grep으로 존재만 확인했다. drizzle/migrations 원문·운영 DB(Turso) 적용 상태·Vercel env·배포 산출물은 확인할 수 없다.
- db/schema.ts는 funding_creators·tokens·projects·rewards·payouts·services 구간만 읽었고 funding_pledges·funding_pledge_items·privacy_access_logs·refund_accounts 정의는 읽지 않았다.
- lib/contact/origin.ts·lib/booking/rate-limit.ts(fail-open)·lib/contracts/admin-auth.ts는 읽었으나 admin-session.ts·admin-accounts.ts(ADMIN_ACCOUNTS 해석)는 읽지 않았다.

**미검증 후보(overflow)**
- lib/withholdingTax.ts:15-19: 원천징수 소득세 1,000원 미만 소액부징수 규정을 반영하지 않는다(지급액 약 33,333원 미만 정산). 세무 확인 필요, 신뢰도 낮음.
- lib/funding/creatorProjectWrite.ts(727줄): 프로젝트 저장·개설자 프로필·정산 정보·리워드 쓰기가 한 파일에 섞여 있다. creatorProfileWrite.ts / creatorPayoutWrite.ts / creatorRewardWrite.ts로 분리하면 소유 guard 규칙이 파일 단위로 읽힌다.
- pages/[locale]/funding/creator/index.tsx:153-160: 승인 프로젝트마다 loadCreatorProjectStats를 직렬 await(프로젝트당 질의 3~4회). Promise.all로 병렬화하거나 slug 목록 한 번에 집계.
- pages/api/funding/creator/login.ts:88: getClientIp가 null이면 'unknown' 공용 버킷이 되어 IP 한도(5/10분)가 해당 요청 전체를 한 덩어리로 막는다. null이면 IP 한도를 건너뛰고 이메일 한도만 쓰는 편이 안전.
- lib/funding/creatorValidation.ts:202 / reviewEmail.ts:79: 제목(title)에 제어문자·개행 검증이 없고 메일 subject에 그대로 들어간다. str()에서 `/[\u0000-\u001F\u007F]/` 거부 권장.
- lib/funding/mediaAccess.ts:36-58: 공개 이미지 요청마다 승인 프로젝트 전체에 instr 풀스캔(content 최대 10만 자). immutable 캐시가 흡수하지만 캐시 미스 폭주 시 비용 — 파일명→프로젝트 참조 인덱스 표 또는 승인 시 참조 집합 캐시 고려.
- pages/api/funding/creator/projects/[id]/submit.ts: 재제출 시 이전 제출본과의 diff가 없어 보완 요청 후 운영자가 전체를 다시 읽어야 한다. 위 revisions 표가 생기면 '보완 요청 이후 변경분' 표시로 재사용.
- lib/booking/rate-limit.ts:56-80: consumeRateLimit이 호출마다 만료 행 DELETE를 선행(개설자 저장 한 번에 쓰기 2~4회) — 범위 밖이지만 개설자 쓰기 경로 지연의 일부.
- [P3] creator-terms §8(100행) '환불·취소된 후원은 목록에 나오지 않습니다'는 partially_refunded 후원이 배송 목록에 포함되는 것(creatorShipping.ts:181-182 LIVE 집합)과 어긋나게 읽힌다 — '전액 환불·취소된'으로 좁힐 것(약관 판본 갱신 필요).
- [P3] shipping.csv.ts GET의 isAllowedContactRequestOrigin이 Referer에 기대므로 주소창 직접 입력·북마크로 열면 설명 없는 403 'Forbidden'이 난다 — 안내 문구를 두거나 GET은 세션만으로 허용.
- [P3] adminProjects.listProjectsForAdmin(99-102)·loadProjectForAdmin(114-118)·creatorProjectWrite.loadProjectForCreator(121)가 fundingCreators 전 컬럼(payout_account_enc·resident_number_enc 포함)을 select해 메모리에 올린 뒤 일부만 고른다 — creatorProjectWrite.ts:370-372 주석('정산 컬럼을 일부러 빼고 있다')은 출력에만 해당하므로 select 자체를 좁힐 것.
- [P3] creator/index.tsx GSSP(152-160)가 승인 프로젝트마다 loadCreatorProjectStats(질의 3~4회)를 순차 실행한다 — 프로젝트 수에 비례해 느려지므로 Promise.all 또는 slug IN 집계로.
- [P3] createDraftProject가 startAt=endAt=new Date()를 심어 편집 폼 초기 날짜가 min(earliestStartDate) 아래로 보인다 — 초안은 null 허용 또는 earliestStartDate로 채울 것.
- [P3] creatorShipping.loadSummary byReward가 ORDER BY l.reward_id로 정렬돼 리워드 카드 순서(sort_order)와 다르다.
- [P3] 1라운드 #1(submittedAt null → 400) 수정 시 decideProject.versionCondition이 eq(submittedAt, Date)라 NULL 판본을 표현하지 못한다 — expectedSubmittedAt: null을 받아 isNull(submittedAt)로 분기해야 한다.
- [P3] FundingPayoutSection.tsx:268-269 설명문도 결제 수수료에 '(부가세 포함)'이 빠져 있다(payoutEmail 라벨 지적과 같은 축).
- [P3] pages/api/funding/creator/projects/[id].ts의 section==='creator' 저장은 승인된 프로젝트의 contactName·phone이 바뀌어도 운영자 알림·기록이 없다(이름은 잠그고 bio/links는 미사용인 것과 별개로 운영 연락처 변경이 조용하다).

### BIL. 정기결제·구독·아티스트 후원

P0 0 · P1 7 · P2 10 · P3 9, 미검증 0

전제: 운영 DB(studio-nol) 읽기 전용 조회 기준 `subscriptions` 0행, `subscription_payments` 0건. `SUPPORTED_ARTISTS`는 빈 배열(`data/artists/index.ts:58`), `NEXT_PUBLIC_ARTIST_SUPPORT_OPEN` 미설정이라 `/api/artists/support`는 503이다. 그래서 아래 "아티스트 후원" 항목은 전부 **오픈 전 수정**이고, 연습실·레슨 구독 항목은 운영 DB에 구독이 들어오는 순간 바로 발현한다.

#### BIL-1. 토스에 기록이 없는 pending 회차가 청구를 영구 보류시키고, 고객에게 매일 '결제 실패' 메일이 나간다 [P1 · M]

**위치** `lib/billing/service.ts:401-431` (unresolved 대사 블록), `lib/billing/service.ts:528-556` (NETWORK_ERROR·CONFIG_ERROR 처리), `lib/billing/toss-billing.ts:169`, `pages/api/cron/billing-charge.ts:105-122`, `lib/billing/email.ts:192`, `lib/billing/service.integration.test.ts:470-520`

**지금 코드.** chargeCycle은 NETWORK_ERROR·CONFIG_ERROR로 끝난 회차의 `orders`를 pending에 두고 `subscription_payments`만 failed로 적은 뒤 past_due + D+1 재시도를 건다. 다음 chargeCycle은 새 청구 전에 pending 주문을 `fetchPaymentByOrderId`(GET /payments/orders/{orderId})로 대사하는데, 조회가 `!ok`면 코드를 가리지 않고 돌아간다:

```ts
for (const row of unresolved) {
  const refetched = await fetchPaymentByOrderId(row.orderNo);
  if (!refetched.ok) {
    // 재조회조차 안 되면 청구를 보류한다 — 모르는 채로 돈을 또 걷는 쪽이 훨씬 나쁘다.
    ...
    return { ok: false, status: subscription.status, tossCode: refetched.code,
      message: '이전 결제 상태를 확인하지 못해 청구를 보류했습니다. 잠시 후 다시 시도해 주세요.' };
  }
```

`toss-billing.ts:169`는 non-2xx 응답의 `body.code`를 그대로 돌려준다(`if (!res.ok) { return { ok: false, code: String(json.code ?? 'UNKNOWN'), ... } }`).

**왜 문제인가.** 요청이 토스에 아예 닿지 못한 경우(연결·DNS 실패, 시크릿 키 누락으로 CONFIG_ERROR, 테스트 키로 낸 주문을 라이브 키로 조회)에는 토스에 그 orderId가 없다. 재조회는 404 `NOT_FOUND_PAYMENT`를 받고, 그것이 `!ok`로 처리되어 '보류'로 끝난다. 이 보류를 푸는 경로가 코드 어디에도 없다 — 관리자 API 액션(charge·cancel·pause·resume·card_change_link·resend_setup·refund_payment)에 해소 버튼이 없고, healthCheck는 pending 주문 정체를 보지 않으며, orderRetention의 pending 조건은 `subscription_payments.status`를 보는데 이 경우 그 값은 이미 failed라 걸리지 않는다. `lib/booking/toss.ts:51` 주석이 NOT_FOUND_PAYMENT를 '돈이 움직이지 않았다'는 코드로 분류하고 있어 failed 확정이 안전하다는 근거는 저장소 안에 있다. 테스트는 DONE(470)·NETWORK_ERROR(488)·EXPIRED(503)만 다루고 NOT_FOUND_PAYMENT 케이스가 없다.

**조건 → 결과.** 일시적 네트워크 오류 한 번으로 그 구독은 영영 청구되지 않는다. `nextBillingAt`은 `claimDueSubscription`이 +1초씩만 올리므로 매일 cron이 집고, `processOne`(billing-charge.ts:105-122)은 `result.ok=false`면 무조건 `sendSubscriptionChargeFailedEmail`을 보내며 `nextRetryAt`에 `refreshed.nextBillingAt`(과거 날짜)을 넣는다 → 카드가 멀쩡한 고객이 '결제에 실패했습니다 / (과거 날짜)에 다시 결제를 시도합니다'(email.ts:192) 메일을 **매일** 받는다. 상태가 바뀌지 않아 paused 운영자 알림도 안 가고 `summary.errors`에도 안 잡힌다. 첫 결제(reason 'first')에서 걸리면 고객이 카드를 다시 등록해도 같은 보류에 걸린다. 테스트 키로 심사한 뒤 라이브 키로 교체할 때(스펙 329행: 키 교체 후 redeploy) 남은 pending 건은 전부 이 상태가 된다.

**수정.**
1. `service.ts`의 unresolved 쿼리에 `subscriptionPayments.attemptedAt`을 함께 select한다.
2. `refetched.ok === false && refetched.code === 'NOT_FOUND_PAYMENT'`이고 `attemptedAt`이 30분 이상 지났으면(함수 maxDuration 60초 + 토스 타임아웃 12초 이후라 진행 중일 수 없다) `UPDATE orders SET status='failed', updated_at=unixepoch() WHERE id=? AND status='pending'`으로 확정하고 루프를 계속 진행해 새 청구를 낸다 — 기존 EXPIRED 분기와 같은 성격이다. NETWORK_ERROR·CONFIG_ERROR·5xx는 지금처럼 보류한다.
3. `ChargeCycleResult`에 `held: true`(또는 BIL-15의 `outcome` 필드)를 추가해, `billing-charge.ts`와 `pages/api/admin/subscriptions/[id].ts`의 charge 분기가 '시도하지 않음'일 때 고객 실패 메일 대신 운영자 알림(`sendSubscriptionOperatorAlert`, 신규 kind `'charge_held'`)만 보내게 한다. cron 설계 주석('cron은 그 결과만 보고 메일을 고른다')과 충돌하지 않는다.
4. 회귀 테스트: `service.integration.test.ts`에 `fetchPaymentByOrderId`가 `{ok:false, code:'NOT_FOUND_PAYMENT'}`를 돌려주는 케이스 둘 — attemptedAt 30분 이상 → failed 확정 후 새 청구 진행 / 방금 만든 것 → 보류.

**비고.** BIL-4(5xx도 pending으로 남기기)와 **같은 PR**이어야 한다 — 이 수정 없이 pending을 늘리면 그 구독들이 영구 보류된다. `git log -S'NOT_FOUND_PAYMENT' -- lib/billing/` 결과 없음(미수정).

#### BIL-2. 결제 실패로 정지(paused)된 구독은 고객이 안내대로 카드를 다시 등록해도 청구가 재개되지 않고, 화면은 '다음 결제일부터 청구'라고 거짓 안내한다 [P1 · M]

**위치** `lib/billing/service.ts:965-990` (issueCardChangeToken), `lib/billing/service.ts:290-349` (completeCardSetup), `lib/billing/service.ts:386-389`·`447-449` (주석), `lib/billing/service.ts:993-1003` (listDueSubscriptions), `pages/[locale]/subscribe/[id]/success.tsx:44-48`·`145-149`, `pages/[locale]/subscribe/manage/[id].tsx:214-217`, `pages/api/subscriptions/card-change.ts`, `pages/api/cron/billing-charge.ts:54`, `pages/api/admin/subscriptions/[id].ts:41`, `lib/billing/email.ts:80-85`·`211`, `lib/billing/service.integration.test.ts:650`

**지금 코드.**
```ts
const setupMode = subscription.status === 'pending_card' ? 'initial' : 'change';   // service.ts:979
if (wasChangeMode) return { ok: true, status: subscription.status, charged: false };   // service.ts:339
// success.tsx:47  description: () => '이번 결제는 없으며, 다음 결제일부터 새 카드로 청구됩니다.'
// billing-charge.ts:54  '정기결제가 정지되었습니다. 위 링크에서 카드를 다시 등록해야 이용이 계속됩니다.'
```

**왜 문제인가.** 재시도 한도(MAX_CHARGE_ATTEMPTS=3)를 소진해 `paused(payment_failed)`가 되면 실패 메일의 CTA '카드 변경하기'(email.ts:211)가 manage 페이지로 가고, manage 페이지의 '카드 변경' 버튼(214-217행)은 상태 가드 없이 항상 떠서 `/api/subscriptions/card-change` → `issueCardChangeToken` → `'change'`로 간다. `completeCardSetup`은 `wasChangeMode`면 chargeCycle 없이 `charged:false`로 끝나고, `listDueSubscriptions`는 active·past_due만 걷는다. 즉 payment_failed 정지 구독은 카드를 바꿔도 **영영 청구되지 않는다**. 그런데 완료 화면(success.tsx:47)은 '다음 결제일부터 새 카드로 청구됩니다'라고 말하고, card_changed에는 운영자 알림도 없다(145-149행). 세 문구가 서로 모순이다 — billing-charge.ts:54·admin [id].ts:41 '카드를 다시 등록해야 이용이 계속됩니다' / success.tsx:47 '다음 결제일부터 청구' / email.ts:80-85 '재개는 문의로 안내'(이것은 관리자 card_change_link 경로의 메일에만 나가고 고객 셀프 경로에는 아예 없다). 설계 의도는 스펙 `docs/superpowers/specs/2026-09-10-toss-billing-subscription-design.md:52` 'paused ──카드 재등록+미납 결제──▶ active'이고, chargeCycle 386-389 주석('카드 재등록 직후의 첫 결제만 통과')과 failedCycleOutstanding 주석(447-449 '수동 결제·카드 재등록 첫 결제가 걷는 것은 실패했던 달')도 같은 의도를 적어 두었는데, paused에 reason 'first'로 도달하는 호출부가 없다. 통합 테스트 650행은 제목이 '미납분 결제로 active가 된다'인데 본문은 manual 결제를 따로 눌러야 active가 된다. healthCheck의 방치 경보(641-655)는 pausedReason operator·NULL만 보므로 payment_failed 정지는 어떤 점검에도 안 잡힌다.

**조건 → 결과.** 실패 메일의 지시를 그대로 따른 고객이 서비스(연습실·레슨·아티스트 후원)를 잃은 채 청구가 이어진다고 믿는다. 운영자는 카드가 교체된 사실을 알 수 없어 정지 상태가 방치되고(3년 뒤 `closeDormantSubscriptions`가 ended로 닫는다), 후원이면 아티스트 몫도 끊긴다.

**수정.**
1. `issueCardChangeToken`(service.ts:979): `subscription.status === 'paused' && subscription.pausedReason === 'payment_failed'`이면 `setupMode = 'initial'`. 그러면 `completeCardSetup` → `chargeCycle(reason:'first')`가 paused 가드(386-389)를 통과하고, failedCycleOutstanding으로 연습실·레슨은 실패했던 달을, 후원은 이번 달을 걷으며, 성공 batch의 `REACTIVATABLE_STATUSES`(61행)에 paused가 있어 active로 복귀한다. 거절되면 reason 'first' 분기가 상태를 건드리지 않고 돌아가 success.tsx가 기존 `first_charge_failed` 운영자 알림을 보낸다.
2. 운영자 정지(`pausedReason === 'operator'`)는 지금처럼 `'change'`를 유지하되, `completeCardSetup` 끝에서 `sendSubscriptionOperatorAlert`로 '정지 구독의 카드 교체됨 — 재개 여부 판단'을 보낸다(keepsPause 설계와 일관).
3. `success.tsx`의 card_changed 문구, `sendSubscriptionSetupEmail`의 안내, 등록 페이지(`subscribe/[id].tsx:89-90`)의 '카드 등록과 동시에 첫 달치가 결제됩니다', activated 메일 문구를 setupMode·status별로 갈라 쓴다.
4. 통합 테스트 650행을 '재등록 직후 자동 결제로 active'를 기대하도록 바꾼다.

**비고.** `git log -S`로 동일 수정 흔적 없음.

#### BIL-3. 고객 셀프 해지가 운영자에게 가지 않아 '7일 이내 전액 환불'·'첫 수업 전 취소 전액 환불' 약속을 이행할 트리거가 없다 [P1 · M]

**위치** `pages/api/subscriptions/cancel.ts:28-42`, `lib/billing/email.ts:264-287` (sendSubscriptionCancelledEmail), `lib/billing/refund.ts:69`, `lib/booking/refund-policy.ts:79`, `pages/[locale]/subscribe/[id].tsx:96`, `pages/api/admin/subscriptions/[id].ts:145`, `lib/billing/service.ts:806`, `tests/api/subscriptions/cancel.test.ts`

**지금 코드.**
```ts
const result = await cancelSubscription(id, { requestedBy: 'customer', reason: '고객 셀프 해지' }, now);
...
const emailError = await sendSubscriptionCancelledEmail(result.subscription, { endsAt });
if (emailError) console.error('[subscriptions/cancel] 해지 확인 메일 발송 실패', { id, emailError });
return res.status(200).json({ ok: true, endsAt: endsAt.toISOString() });
// refund-policy.ts:79  '첫 결제 후 7일 이내에 해지하면 전액 환불됩니다. 그 이후 남은 기간의 환급은 문의 주시면 일할로 처리해 드립니다.'
```

**왜 문제인가.** `'cancelled'` 운영자 알림은 관리자 해지(admin [id].ts:145)와 계약 종료(service.ts:806)에서만 나가고 고객 셀프 해지 API에는 없다 — 스펙 §12(artist-support-design.md:304 '운영자: 신규·실패·해지') 위반. 환불은 관리자 화면의 회차 환불로만 되므로(`refund.ts:69`는 requestedBy 'admin' 고정), 알림이 없으면 아티스트 후원(스펙 §9 231-240행 '7일 이내 전액', 카드 등록 화면 `subscribe/[id].tsx:96`에 렌더)과 레슨('첫 수업 전 취소 전액 환불')의 약속이 고객이 따로 요구할 때까지 이행되지 않는다. 고객 해지 확인 메일(email.ts:264-287)에도 환불 안내가 없다. `cancel.test.ts`는 email 모듈을 `sendSubscriptionCancelledEmail`만 mock해 알림 부재를 잡지 못한다.

**조건 → 결과.** 지금 당장: 레슨·연습실 셀프 해지를 운영자가 모른다(스펙 §12 위반), 레슨의 첫 수업 전 전액 환불도 트리거가 없다. 오픈 뒤: 7일 내 셀프 해지한 후원자의 전액 환불이 고객 요구 전까지 이행되지 않아 청약철회 환불 지연이 된다.

**수정.**
(a) `cancel.ts`에서 해지 성공 직후 모든 kind에 `sendSubscriptionOperatorAlert(result.subscription, 'cancelled', detail)`를 보낸다. detail에 kind별 환불 판정 힌트 — artist-support: 첫 paid 회차 `paidAt`이 KST 기준 7일 이내면 '7일 이내 해지 — 전액 환불 대상'(ALERT_KINDS 톤), 아니면 '일할 환급은 문의 시'. lesson: '첫 수업 전이면 전액 환불 대상'. 알림 실패는 해지를 되돌리지 않고 `notificationError`에 남긴다(admin·contract 경로와 같은 원칙).
(b) `sendSubscriptionCancelledEmail`에 kind·7일 여부를 받아 환불 안내 한 줄을 넣는다(artist-support 7일 이내: '첫 결제 후 7일 이내 해지라 전액 환불해 드립니다', 그 외: 정책 문구 그대로).
(c) `cancel.test.ts`에 운영자 알림 호출과 7일 안/밖 detail 문구 케이스 추가.
자동 환불(해지 API에서 `refundSubscriptionPayment` 호출)은 넣지 않는다 — `refund-policy.ts` 주석이 환급을 '자동 실행이 아니라 요청 경로'로 못박은 설계 결정이고, `settleRefund`가 토스 취소를 동반해 해지 응답과 얽힌다. 넣는다면 운영자 결정 뒤 별도 PR로(requestedBy에 'system' 추가, 환불 실패 시에도 해지는 성공, 운영자 알림은 alert 톤).

**비고.** 검증자 조정: 7일 환불의 법적 노출은 오픈 시점의 일이지만 레슨·연습실 셀프 해지 미통지는 지금 터져 있고 오픈이 플래그 하나 거리라 P1 유지. 자동 환불은 수정안에서 제외.

#### BIL-4. 토스 5xx·알 수 없는 코드도 orders를 failed로 확정해 재조회 대사에서 빠지고, 재시도가 승인되면 같은 달 이중 청구가 된다 [P1 · S]

**위치** `lib/billing/service.ts:528-546`, `lib/billing/service.ts:478-484` (같은 달 paid 검사), `lib/billing/service.ts:1310-1320` (reconcileSubscriptionPaymentFromToss), `lib/billing/toss-billing.ts:59-62`, `lib/booking/webhook.ts:296`, `lib/booking/confirm.ts:43-61`·`581`, `lib/ops/healthCheck.ts`

**지금 코드.**
```ts
const isInternalError = toss.code === 'NETWORK_ERROR' || toss.code === 'CONFIG_ERROR';
if (isInternalError) {
  console.error('[billing] 빌링 결제 응답 없음 — orders는 pending 유지, 토스 재조회 필요', {...});
} else {
  await db.run(sql`UPDATE orders SET status = 'failed', updated_at = unixepoch() WHERE id = ${order.id} AND status = 'pending'`);
}
// booking/confirm.ts:581  const isDeclined = !isInternalError && isCustomerDecline(toss.code);
```

**왜 문제인가.** `isInternalError`가 NETWORK_ERROR·CONFIG_ERROR 둘만 보는 denylist라, `FAILED_INTERNAL_SYSTEM_PROCESSING`(500)·UNKNOWN 같은 '처리 여부 미상' 응답(toss-billing.ts:59-62가 non-2xx의 body.code를 그대로 돌려준다)도 거절로 낙인해 orders를 failed로 확정한다. 같은 저장소의 `booking/confirm.ts`는 이미 allowlist(`isCustomerDecline`)로 고쳐져 있고 빌링만 남았다. failed 주문은 다음 chargeCycle의 unresolved 쿼리(`orders.status='pending'`) 대상이 아니라 재조회되지 않고, 같은 달 paid 검사(478-484)도 failed 행은 못 막으므로 D+1 재시도가 새 orderNo·새 멱등키로 다시 승인될 수 있다. 그 뒤 옛 주문의 DONE 웹훅(webhook.ts:296 → reconcileSubscriptionPaymentFromToss)은 orders·subscription_payments를 pending·failed 모두에서 paid로 올리고(1310-1320) 같은 cycleYm에 이미 paid가 있는지는 보지 않는다. healthCheck에 중복 paid 점검도 없다.

**조건 → 결과.** 토스가 승인 후 5xx를 돌려준 회차는 재시도에서 다시 승인돼 같은 달 두 번 청구되고, 뒤늦은 웹훅이 옛 주문까지 paid로 되살려 정산(payout)에도 두 번 잡힌다.

**수정.**
1. `toss-billing.ts`의 `request()`/`fetchPaymentByOrderId`가 RawResult에 `httpStatus`를 실어 돌려주고, chargeCycle에서 `const unresolved = toss.code==='NETWORK_ERROR' || toss.code==='CONFIG_ERROR' || (toss.httpStatus ?? 0) >= 500`일 때만 orders를 pending으로 남긴다(4xx는 토스가 승인하지 않았다는 뜻이라 지금처럼 failed). booking의 DECLINE_CODE_PATTERN 복제는 쓰지 않는다 — 빌링 거절 코드 집합이 달라 목록 밖 코드가 늘어나고, booking의 allowlist는 '제3자가 주문번호만으로 남의 주문을 failed로 만든다'는 공격(confirm.ts:48-52)을 막는 장치인데 빌링은 서버 간 호출이라 그 위협이 없다.
2. **BIL-1(NOT_FOUND_PAYMENT 30분 경과 → failed 확정)과 같은 PR에 넣는다** — 그것 없이 pending을 늘리면 다음 날 NOT_FOUND_PAYMENT로 그 구독들이 영구 보류된다.
3. `reconcileSubscriptionPaymentFromToss`: 같은 subscriptionId·cycleYm에 다른 paid 회차가 이미 있으면 orders·subscription_payments는 paid로 적되 구독 기간은 전진시키지 않고 `sendSubscriptionOperatorAlert`(late_approval 계열, '같은 달 이중 승인 — 환불 필요')를 보낸다.
4. healthCheck에 `SELECT subscription_id, cycle_ym FROM subscription_payments WHERE status='paid' GROUP BY 1,2 HAVING count(*)>1`(high) 추가.
5. 테스트: `chargeBillingKey`가 `{ok:false, code:'FAILED_INTERNAL_SYSTEM_PROCESSING', httpStatus:500}`이면 orders가 pending으로 남고, 다음 chargeCycle에서 fetch가 DONE을 돌려주면 charge 호출 0회로 복구되는지.

**비고.** 검증자 조정: 판정 기준을 코드 allowlist가 아니라 HTTP status ≥500으로 바꿨고 BIL-1 의존성을 명시. 토스가 승인 후 5xx를 돌려주는 빈도는 확인할 수 없으나(confidence 0.55) 돈 문제이고 예약·펀딩에서 같은 전제로 이미 고친 유형이라 P1 유지.

#### BIL-5. 관리자 화면 props·API가 빌링키 원문과 발급 응답 원본(rawResponse)을 그대로 싣는다 — 스키마가 '서버 밖으로 나가지 않는다'고 못박은 값 [P1 · S]

**위치** `lib/billing/admin-serialize.ts:39-44`, `pages/admin/subscriptions/[id].tsx:72`·`417-421`, `pages/api/admin/subscriptions/[id].ts:58-62`, `lib/billing/service.ts:246`·`266` (getSubscriptionWithDetails), `db/schema.ts:1190`, `lib/crypto/CLAUDE.md`, `tests/pages/admin/subscriptions/detail.test.tsx`

**지금 코드.**
```ts
export const serializeBillingKey = (key: BillingKey): SerializedBillingKey => ({
  ...key,
  issuedAt: key.issuedAt.toISOString(),
  revokedAt: iso(key.revokedAt),
  createdAt: key.createdAt.toISOString(),
});
// db/schema.ts:1190  /** 토스 빌링키. 서버 밖으로 나가지 않는다(로그·메일 금지, 스펙 §9). */
// pages/api/admin/subscriptions/[id].ts:62  return res.status(200).json({ ok: true, ...details });
```

**왜 문제인가.** `...key`가 행 전체를 펼쳐 `billingKey`(결제수단 자격증명)와 `rawResponse`(스키마 주석대로 '빌링키 문자열 자체'가 든 JSON)를 포함한다. `pages/admin/subscriptions/[id].tsx:72`가 이를 getServerSideProps props로 넘기므로 Pages Router가 `__NEXT_DATA__`로 HTML에 박는다. 화면은 cardCompany·cardNumberMasked·issuedAt 셋만 쓴다(417-421). GET `/api/admin/subscriptions/[id]`도 `getSubscriptionWithDetails` 결과(billingKey 행 전체)를 `...details`로 통째로 응답한다(부르는 프론트 코드는 없지만 관리자 세션으로 열려 있다). `lib/crypto/CLAUDE.md`의 '평문을 로그·화면 props·메일에 넣지 않는다 — Pages Router는 props를 __NEXT_DATA__로 페이지 HTML에 싣는다. 암호문도 담지 않는다'가 정확히 이 상황을 금지하고, rawResponse를 자격증명으로 보고 비우는 `purgeUnusableBillingKeyRawResponses`(orderRetention.ts:866)가 있는 것도 이 값이 민감하다는 저장소 판단이다. `detail.test.tsx`는 `billingKey={null}`만 렌더해 회귀를 못 잡는다.

**조건 → 결과.** 관리자 세션이 열린 브라우저의 HTML·캐시·확장 프로그램·스크린샷·접속기록에 모든 구독의 빌링키가 남는다. 관리자 계정이 둘 이상이거나 관리자 페이지에 XSS가 생기면 customerKey와 함께 유출되고, 토스 시크릿 키가 함께 새는 순간 임의 청구가 가능해진다.

**수정.** `serializeBillingKey`를 화이트리스트로:
```ts
({ id: key.id, subscriptionId: key.subscriptionId, cardCompany: key.cardCompany,
   cardNumberMasked: key.cardNumberMasked, cardType: key.cardType,
   issuedAt: key.issuedAt.toISOString(), revokedAt: iso(key.revokedAt) })
```
타입 `SerializedBillingKey`도 `Pick`으로 좁힌다. `pages/api/admin/subscriptions/[id].ts` GET도 같은 직렬화를 거치게 하고 billingKey 필드를 제거한다. 회귀 테스트: `serializeBillingKey` 결과와 GET 응답의 `JSON.stringify`에 `'billingKey'`·`'rawResponse'`·실제 키 문자열이 없음을 단언. BIL-16(manageToken·setupToken·customerKey)과 같은 파일이라 같은 PR.

**비고.** `git log -S'serializeBillingKey'` 결과 최초 커밋(6056ab29d9)뿐. 빌링키만으로는 청구할 수 없고 관리자 인증 뒤에만 노출돼 P0은 아니다. `serializeSubscriptionPayment`는 그 테이블에 rawResponse가 없어 같은 문제가 없다.

#### BIL-6. 아티스트 정산 기록에 '닫힌 달' 게이트가 없다 — 이번 달을 기록하면 이후 결제분이 정산에서 영영 빠지고 되돌릴 수 없다 [P1 · S]

**위치** `lib/artistSupport/payout.ts:133-137`, `pages/api/admin/artists/payouts.ts:38`, `pages/admin/artists/index.tsx:240-246`·`301`, `db/schema.ts:1291`, `lib/funding/payout.ts:537-538`·`596` (선례), `lib/ops/healthCheck.ts:972-1003` (펀딩 payoutDrift 선례)

**지금 코드.**
```ts
export const recordArtistPayout = async (artistSlug: string, period: string, now: Date) => {
  const preview = await buildArtistPayoutPreview(artistSlug, period);
  if (!preview) return { ok: false, code: 'not_found' };
  if (preview.recorded) return { ok: false, code: 'already_recorded' };
  if (preview.grossAmount <= 0) return { ok: false, code: 'nothing_to_pay' };
  ... insert(artistPayouts)  // (artist_slug, period) UNIQUE
// admin/artists/index.tsx:301  {!p.recorded && p.grossAmount > 0 && ( <Button ...>정산 기록
```

**왜 문제인가.** period 형식(PERIOD_PATTERN)만 보고 그 달이 끝났는지 보지 않는다. 관리자 화면 `type=month` 입력으로 이번 달을 열면 '정산 기록' 버튼이 뜨고 API도 받는다. `artist_payouts`는 (artist_slug, period) UNIQUE이고 삭제 경로가 없으며 `markArtistPayoutPaid`는 한 방향이라 한 번 기록하면 고칠 수 없다. 같은 저장소의 펀딩 정산은 바로 이 이유로 `not_closed` 게이트를 둔다(lib/funding/payout.ts:596 — '진행 중에 기록하면 그 뒤 들어온 후원이 정산에서 통째로 빠진다'). `lib/billing/service.ts:66-68`·`455-457` 주석도 '정산이 cycleYm 단위로 닫힌다'를 전제한다. healthCheck.ts에는 'artist' 문자열이 한 번도 없어 펀딩 payoutDrift에 해당하는 점검이 없다.

**조건 → 결과.** 오픈 뒤 이번 달을 기록하면 그 뒤 들어온 후원금의 90% 몫이 어느 정산에도 잡히지 않는다(아티스트 과소 지급, 수동 DB 수정 외 복구 수단 없음). 기록 뒤 환불·뒤늦은 대사는 그 달을 관리자 화면에서 다시 열 때만 보인다.

**수정.**
① `recordArtistPayout`: `period >= cycleYmOf(now)`면 `{ ok:false, code:'period_open' }` — `payouts.ts` RECORD_ERROR에 409 문구 추가, 화면은 현재·미래 달에서 버튼을 숨긴다(보조).
② 같은 아티스트의 그 달 회차 중 `orders.status='pending'`(subscription_payments JOIN orders, cycle_ym=period)이 있으면 `'unreconciled'`로 거절 — `subscription_payments.status`는 NETWORK_ERROR 때 이미 'failed'로 찍히므로(service.ts:556-559) orders 쪽으로 판정해야 한다. 이 창은 보통 다음 날 재시도에서 닫히므로 ①이 주 방어, ②는 보조.
③ `lib/ops/healthCheck.ts`에 `artist_payouts.status='pending'`인 기록만 `buildArtistPayoutPreview`로 다시 계산해 netAmount가 다르면 high로 올린다(펀딩 976-1003행과 같은 범위·이유 — paid 뒤 환불은 끌 수단이 없어 영구 경보가 되므로 pending만).
④ `artistSupport.integration.test.ts`에 이번 달 기록 거절·pending 주문 있을 때 거절 케이스 추가.

**비고.** 검증자 조정: 미대사 판정을 orders.status로, 드리프트 점검을 pending 정산만으로 좁힘. 현재 노출 없음(아티스트 0명·오픈 전)이나 되돌릴 수 없는 기록이라 P1 유지. `git log -S'period_open'` 결과 없음.

#### BIL-7. 청구일이 지나도 안 걷힌 구독을 세는 점검이 없다 — 청구 cron이 멈추거나 chargeCycle이 보류로 돌아오면 운영자가 모른다 [P1 · M]

**위치** `lib/ops/healthCheck.ts:520-549` (lateApproval), `:574-598` (staleResumeNotices), `:640-665` (dormancyWarning), `pages/api/cron/billing-charge.ts:213-237`, `lib/cron/auth.ts:23-27`, `pages/api/cron/health-check.ts:23`, `lib/ops/adminDashboard.ts:99-101`, `lib/billing/service.ts:384-388`·`407-422`

**지금 코드.** healthCheck의 구독 점검은 lateApproval·staleResumeNotices·dormancyWarning뿐이고 `nextBillingAt`을 쓰는 곳은 577행 하나다:
```ts
const staleResumeNotices = await db.select({ id: subscriptions.id, nextBillingAt: subscriptions.nextBillingAt })
  .from(subscriptions).where(and(eq(subscriptions.status, 'active'), isNotNull(subscriptions.resumeNoticePendingAt), ...));
// lib/cron/auth.ts:25  console.error(`[${label}] CRON_SECRET is not set — 요청을 거부한다.`); return false;
```

**왜 문제인가.** `status IN ('active','past_due')`인데 `next_billing_at`이 한참 지난 구독을 세는 점검이 없다. `billing-charge.ts`는 `summary.errors`(예외)가 있을 때만 운영자 메일을 보내고(213-237) 성공·실패 건수는 어디에도 남기지 않는다. `adminDashboard.ts:99-101`은 pending_card·past_due·paused 건수만 센다. 카드 거절은 조용하지 않다(3회 뒤 paused 전이와 운영자 알림, billing-charge.ts:117-119). 조용한 것은 ① cron 자체가 안 도는 경우, ② chargeCycle이 `nextBillingAt`을 바꾸지 않고 일찍 돌아오는 경우(BIL-1의 pending 재조회 실패 보류, 407-422행)다.

**조건 → 결과.** 운영 DB의 연습실·레슨 구독 청구가 통째로 멈춰도 고객 문의 전까지 알 수 없다. 단, `CRON_SECRET` 소실은 health-check도 같은 `isCronAuthorized`를 타므로(health-check.ts:23) 헬스체크 안의 어떤 점검으로도 못 잡는다 — 그 경우는 Vercel 크론 대시보드 확인이 유일하다.

**수정.**
① `collectDbIssues`에 `status IN ('active','past_due') AND next_billing_at < now − 36h`인 구독 수와 id 샘플을 high로 추가(href `/admin/subscriptions`). 36h는 08:00 점검·09:00 청구 간격에서 두 번 연속 놓친 뒤 뜨는 값이고, 재시도는 nextBillingAt을 D+1·D+3으로 옮기므로 정상 past_due는 걸리지 않는다.
② 보조: subscription_payments JOIN orders에서 `orders.status='pending'`이 48h 넘은 건 — cancelled·ended·paused 구독은 unresolved 블록 전에 돌아와(384-388행) cron으로는 영영 대사되지 않고 lateApproval 점검은 payments 행이 있을 때만 잡으므로 그 좁은 경우에 가치가 있다.
③ 하트비트는 만들지 않거나, 만들더라도 CRON_SECRET 소실은 못 잡는다고 주석에 적는다.
테스트는 `healthCheck.integration.test.ts`의 subscriptions 픽스처(720행) 패턴.

**비고.** 검증자 조정: 하트비트로 CRON_SECRET 소실을 덮을 수 있다는 서술은 틀렸고, '등록된 카드가 없습니다' 매일 반복은 사실상 닿지 않는 경로(completeCardSetup이 새 키 발급 뒤에야 옛 키를 revoke, pending_card는 listDue 대상 아님)라 증거에서 제외.

#### BIL-8. 정산 미리보기가 코드 배열에만 의존해, 아티스트 항목을 지우거나 slug를 바꾸면 청구는 계속되는데 정산 표에서 사라진다 [P2 · M]

**위치** `lib/artistSupport/payout.ts:71-72`·`119-123`, `data/artists/index.ts:58`, `data/artists/artists.test.ts`, `lib/billing/service.ts:143-147`·`375-470`, `lib/billing/amounts.ts:72-76`, `pages/admin/artists/index.tsx:86-92`·`108`, `lib/artistSupport/supporters.ts`, `lib/ops/healthCheck.ts:904` (펀딩 선례)

**지금 코드.**
```ts
export const buildAllArtistPayoutPreviews = async (period: string) => {
  const previews = await Promise.all(SUPPORTED_ARTISTS.map((a) => buildArtistPayoutPreview(a.slug, period)));
// buildArtistPayoutPreview: const artist = getSupportedArtist(artistSlug); if (!artist) return null;
// data/artists/index.ts:58  export const SUPPORTED_ARTISTS: readonly SupportedArtist[] = [];
```

**왜 문제인가.** `subscriptions.artist_slug`는 문자열로 남는데 정산 미리보기·후원자 수는 `SUPPORTED_ARTISTS`만 순회한다. chargeCycle(375-470)은 아티스트 존재를 보지 않는다 — 검사는 createSubscription(143-147)에만 있다. `subscriptionOrderName`은 아티스트가 없으면 KIND_NAMES로 떨어진다. 관리자 화면 SSR은 후원자 수·미리보기를 SUPPORTED_ARTISTS 기준으로만 만들고(86-92), 정산 이력만 `nameOf.get(slug) ?? slug`로 남는다(108). `artists.test.ts`의 for 루프는 배열이 비어 0회 돈다. healthCheck·scripts·content baseline 어디에도 artist slug 가드가 없다.

**조건 → 결과.** 오픈 뒤 운영자가 오프보딩으로 항목을 지우거나 slug를 고치면 그 아티스트 후원금이 정산 표에 안 보이고 스튜디오가 조용히 100%를 보유한다. 설계상 오프보딩은 `supportActive=false`이지만 페이지를 내리려 항목을 지우는 것이 자연스러운 조작이고 아티스트별 일괄 해지 도구도 없다(`pages/admin/subscriptions`에 artistSlug 필터 없음).

**수정.**
① `lib/ops/healthCheck.ts`에 'SUPPORTED_ARTISTS에 없는 artist_slug로 `status IN (active, past_due, cancelled, paused, pending_card)`인 artist-support 구독' 점검 추가(high, href `/admin/subscriptions`) — 헬스체크 08:00 KST, 청구 09:00 KST라 그날 청구 전에 경보가 뜬다. 펀딩도 같은 유형을 healthCheck 904행('slug가 파일과 DB에 둘 다')으로 잡는다.
② `buildAllArtistPayoutPreviews`가 `SELECT DISTINCT artist_slug`(kind='artist-support') ∪ `artist_payouts.artist_slug`를 코드 목록과 합쳐 순회하고, 코드에 없는 slug는 이름을 slug로, taxType 미상으로 표시하며 '정산 기록' 버튼을 내린다.
③ `data/artists/artists.test.ts`는 검증 로직을 함수로 빼 샘플 픽스처로 단위 테스트한다. baseline json CI 가드는 만들지 않는다(CLAUDE.md '단순하게').

**비고.** 검증자 조정: 현실화 시점은 등재가 아니라 삭제·개명 때라 P1→P2.

#### BIL-9. 구독자 명단 공개 동의가 기본 체크이고 표시 이름을 비우면 실명이 올라간다 — 펀딩 명단의 기본 해제·가린 이름 규칙과 어긋난다 [P2 · S]

**위치** `components/artists/ArtistSupportCallout.tsx:67`, `lib/artistSupport/signup.ts:59`, `lib/artistSupport/supporters.ts:34`, `public/locales/ko/common.json:3344-3345`, `components/funding/PledgeWizard.tsx:161` (선례), `lib/funding/publicName.ts` (선례), `lib/artistSupport/artistSupport.test.ts:101-104`, `tests/api/artists/support.test.ts:74`

**지금 코드.**
```ts
const [displayConsent, setDisplayConsent] = useState(true);   // ArtistSupportCallout.tsx:67
const displayName = str(b.displayName) || customerName;       // signup.ts:59
return rows.map((r) => ({ displayName: r.displayName || r.customerName, ... }))   // supporters.ts:34
// ko common.json: "displayNameHint": "비우면 이름을 씁니다. 명단 공개에 동의한 경우에만 보입니다."
```

**왜 문제인가.** 초기값 true이고, 비운 표시명은 결제자 실명으로 채워진다. 카드 등록 화면(`subscribe/[id].tsx`)에는 동의 항목이 없어 이 폼이 유일한 동의 자리다. 같은 저장소의 펀딩 후원자 명단은 기본 해제(`PledgeWizard.tsx:161 displayNamePublic:false`)이고, '공개하면 실명이 그대로 올라가 공개를 누르지 않았다'는 실측 뒤 가린 이름·닉네임을 도입했다(`publicName.ts` 머리 주석). 아티스트 명단만 반대 기본값이다. 스펙 §8.1(178행)·§11.3(295행)은 '표시 동의'만 적고 기본값을 정하지 않았고 운영자 결정 기록도 없다(`git log -S'useState(true)'`는 구현 PR #172뿐).

**조건 → 결과.** 오픈 뒤 표시명 칸을 건드리지 않고 체크를 못 본 후원자의 실명이 아티스트 공개 페이지와 `/api/artists/[slug]/supporters`(s-maxage 60)에 실린다. 체크박스는 제출 버튼 바로 위에 보이므로 숨은 노출은 아니다.

**수정.**
① `useState(false)`.
② `signup.ts:59`를 `str(b.displayName) || maskName(customerName)`(`lib/funding/publicName.ts` 재사용, 클라이언트 안전 모듈)로, `supporters.ts:34` 폴백도 `maskName(customerName)`으로 — 실명은 직접 입력했을 때만 나간다.
③ `displayNameHint`를 '비우면 가운데를 가린 이름(홍*동)으로 올립니다. 명단 공개에 동의한 경우에만 보입니다.'로.
④ `artistSupport.test.ts:101-104`('표시명이 비면 이름으로 채운다')와 `tests/api/artists/support.test.ts:74`의 displayName 기대값을 가린 이름으로 갱신, 기본 해제 상태의 제출이 `displayConsent:false`로 가는 케이스 추가.

**비고.** 검증자 조정: 법 조문 근거 대신 저장소 내 펀딩 선례를 근거로. 같은 자리를 다른 축(PRV 개인정보·처리방침 정합·로그)도 지적: 아티스트 구독 신청의 명단 공개 동의가 기본 체크다. BIL-17과 수정 ①이 겹친다.

#### BIL-10. 재시도 시각이 '실행 시각 + N일'이라 cron 실행 지터만큼 밀려 재시도가 하루씩 건너뛴다 [P2 · S]

**위치** `lib/billing/schedule.ts:147-152`, `lib/billing/schedule.ts:136-137` (주석), `lib/billing/service.ts:584`·`610`·`1000`, `pages/api/cron/billing-charge.ts` (`const now = new Date()`), `vercel.json`, `lib/billing/schedule.test.ts:68-70`

**지금 코드.**
```ts
export const retryAtFor = (failedAt: Date, attempt: number): Date | null => {
  const offset = RETRY_OFFSETS_DAYS[attempt - 1];
  if (offset === undefined) return null; // 한도 소진 — 재시도하지 않는다(paused)
  return new Date(failedAt.getTime() + offset * DAY_MS);
};
// 같은 파일 136-137: 'now + 3일을 그대로 쓰면 cron이 09:00:0x에 돌며 남긴 몇 초 때문에 그날 cron(09:00:00)이 놓치고 하루가 더 밀린다.'
```

**왜 문제인가.** `scheduleForPaidCycle`은 같은 문제를 알고 청구 시각(09:00 KST)으로 정규화했지만 `retryAtFor`는 failedAt(핸들러의 실행 시각, 예 00:00:37Z)에 정확히 24h·72h를 더해 `nextBillingAt`에 저장한다(service.ts:584, 610). `listDueSubscriptions`는 `lte(nextBillingAt, now)`(1000행)라 다음 날 cron이 00:00:12Z에 시작하면 거짓이 되어 그날 건너뛰고 D+2에 처리된다. vercel.json의 `0 0 * * *`(UTC)는 Pro 플랜 분 단위 정밀도라 초 지터가 거의 확실하다. `schedule.test.ts:68-70`은 정각 00:00:00Z만 쓴다.

**조건 → 결과.** D+1·D+3 재시도가 실제로는 하루씩 늦게 일어나 한도 소진(paused)이 늦어지고, 실패 메일의 '(KST 날짜)에 다시 시도합니다' 안내와 어긋난다. 말일 근처에서는 재시도가 다음 달로 넘어가는 경우가 늘어난다.

**수정.** `retryAtFor`가 날짜를 KST 달력으로 자른 뒤 청구 시각으로 맞춘다:
```ts
const t = kstParts(new Date(failedAt.getTime() + offset * DAY_MS));
return fromKst(t.year, t.month, t.day);   // BILLING_HOUR_KST 09:00
```
관리자 수동 결제처럼 오전 9시가 아닌 시각에 실패한 건도 다음 cron에 잡히게 된다. `schedule.test.ts`에 failedAt=00:00:37Z → 다음 날 00:00:00Z, 그리고 cron이 00:00:00Z에 시작해도 due가 되는 케이스 추가.

**비고.** `git log -S` 결과 이미 고친 이력 없음.

#### BIL-11. 카드 등록 결과 페이지가 새로고침하면 실패 화면이 되고, 첫 결제 거절 뒤 고객이 스스로 다른 카드로 다시 시도할 길이 없다 [P2 · M]

**위치** `pages/[locale]/subscribe/[id]/success.tsx:54`·`113-143`, `lib/billing/service.ts:~120` (findSubscriptionForSetup), `:332-335`, `pages/[locale]/subscribe/[id]/fail.tsx`, `pages/[locale]/subscribe/manage/[id].tsx`, `tests/pages/subscribe/success.test.ts`

**지금 코드.**
```ts
export const getServerSideProps = withI18nServerProps<SuccessProps>(async ({ query, res, params }) => {
  ...
  const result = await completeCardSetup({ id, token, authKey, customerKey }, now);
  if (!result.ok) {
    if (result.code === 'first_charge_failed') {
      ... sendSubscriptionOperatorAlert(details.subscription, 'first_charge_failed', result.message);
      return { props: { outcome: 'first_charge_failed', message: result.message } };
// success.tsx:54  note: () => '다른 카드로 다시 등록해야 합니다 — 담당자에게 새 등록 링크를 요청해 주세요. 010-4255-7893'
```

**왜 문제인가.** GET 렌더 중 `completeCardSetup`이 성공하면 setupToken을 null로 만든다(332-335). 새로고침·뒤로가기는 `findSubscriptionForSetup`이 `used`를 돌려주고 페이지는 outcome 'error'(제목 '카드 등록을 완료하지 못했습니다', 메시지 '카드 등록 링크를 확인해 주세요.')로 그려진다 — 중복 결제는 안 나지만(used에서 issueBillingKey 전에 멈춤) 성공한 사람에게 실패 화면이 뜬다. `first_charge_failed` 뒤에는 setupToken이 이미 null이고 props에 manageUrl도 없으며 설정 메일에도 관리 링크가 없다(`sendSubscriptionSetupEmail`은 setupUrl만). 설정 페이지는 `used`('이미 등록된 링크입니다')라 전화로 새 링크를 받아야 한다(운영자 알림은 가고, 관리자 화면 card_change_link/resend_setup으로 복구는 가능).

**조건 → 결과.** 성공 직후 새로고침한 고객이 실패로 오인해 문의하거나 중복 가입할 수 있고, 공개 가입(아티스트 구독)의 첫 결제 거절 건은 전부 운영자 개입이 필요해 pending_card가 쌓인다.

**수정.** PRG 전체 개편 대신 두 가지만.
(1) `completeCardSetup` 결과가 code `'used'`이면 success.tsx에서 outcome 'error' 대신 '이미 등록이 완료된 링크입니다. 확인 메일의 구독 조회 링크를 이용해 주세요' 같은 중립 문구로(다시 새로고침해도 같은 문구).
(2) `first_charge_failed` 분기에서 `issueCardChangeToken(id, now)`을 try/catch로 부르고(pending_card라 setupMode는 initial) 반환된 setupToken으로 `/ko/subscribe/${id}?token=...` 재시도 주소를 props(`retryUrl`)로 내려 '다른 카드로 다시 등록' 버튼을 그린다. 토큰 발급이 실패하면 지금의 전화 안내로 되돌린다. 운영자 알림은 유지.
`tests/pages/subscribe/success.test.ts`에 두 케이스 추가. PRG(redirect)가 필요하면 manageUrl로 redirect만 하고 새 파라미터는 만들지 않는다.

**비고.** 검증자 조정: 원안의 PRG 개편·fail 페이지 이동은 과하다(welcome 배너 신설, 토스 거절 사유가 고정 문구표에 묻힘). authKey가 1회용이라 이중 등록은 없다.

#### BIL-12. 공개 가입 API에 이메일 단위 제한이 없어 제3자 주소로 안내 메일을 반복 발송시킬 수 있다(오픈 전 보완) [P2 · M]

**위치** `pages/api/artists/support.ts:37-82`, `lib/artistSupport/open.ts:16`, `lib/artistSupport/signup.ts`, `lib/booking/rate-limit.ts:69`, `components/artists/ArtistSupportCallout.tsx`, `tests/api/artists/support.test.ts`

**지금 코드.**
```ts
if (!isArtistSupportOpen()) { return res.status(503).json({ ok: false, code: 'closed', ... }); }
const ip = getClientIp(req) ?? 'unknown';
if (!(await consumeRateLimit(`artist_support_signup:ip:${ip}`, 10, 3600))) { return res.status(429)... }
...
const notificationError = await sendSubscriptionSetupEmail(subscription, setupUrl);
...
return res.status(201).json({ ok: true, setupUrl });
```

**왜 문제인가.** IP당 시간당 10건 제한뿐이고 이메일 소유 확인·이메일별 제한·허니팟이 없다(연락 폼 `contact/payload.ts`에는 허니팟이 있다). 입력 이메일 소유를 확인하지 않은 채 `createSubscription` → `sendSubscriptionSetupEmail`이 제3자 주소로 우리 도메인 메일을 보낸다(이름은 공격자 입력). `consumeRateLimit`은 DB 오류 시 true로 열린다(rate-limit.ts:69). `getClientIp`는 x-vercel-forwarded-for를 쓰므로 위조는 안 되지만 IP를 바꾸면 우회된다. 시도마다 pending_card 행이 쌓인다.

**조건 → 결과.** 발신 도메인 평판 저하와 피해자 스팸. 플래그가 닫혀 있는 동안은 노출이 없다. 카드 테스팅 위험은 토스 카드 등록창이 유효기간·비밀번호 앞 2자리·생년월일을 받으므로 크지 않다(토스 문서 미확인).

**수정.**
1. `consumeRateLimit(\`artist_support_signup:email:${sha256(소문자 이메일)}\`, 3, 86400)`을 IP 제한 옆에 추가.
2. 같은 이메일에 미완료 pending_card가 있으면 새 행 대신 그 구독의 setup 토큰을 재발급한다(createSubscription 앞에서 조회).
3. 허니팟 필드와 제출 소요시간 검사를 폼과 API에 최소로 추가(Turnstile은 외부 의존이라 필요해질 때).
4. 긴급 차단은 서버 env 킬스위치가 아니라 Vercel Firewall 규칙(경로 차단)을 운영 절차에 적어 둔다 — Vercel env는 NEXT_PUBLIC이든 서버 전용이든 새 배포에만 적용된다.
응답에서 setupUrl을 빼지 않는다(응답으로 바로 카드 등록 화면 이동하는 전환 설계). `tests/api/artists/support.test.ts`에 이메일 한도 케이스 추가.

**비고.** 검증자 조정: 카드 테스팅 과장과 '서버 전용 env 킬스위치' 오류를 바로잡음.

#### BIL-13. 토스 빌링 키 쌍(클라이언트·시크릿, 테스트/라이브)을 점검하는 헬스체크가 없고, 오픈 플래그가 키 상태와 무관하게 열린다 [P2 · S]

**위치** `lib/ops/healthCheck.ts:125-144` (checkTossApiKeyPair), `components/billing/BillingAuthButton.tsx:43-44`, `lib/billing/toss-billing.ts:27-28`, `lib/artistSupport/open.ts`, `pages/api/artists/support.ts`, `pages/admin/artists/index.tsx:175`

**지금 코드.**
```ts
export const checkTossApiKeyPair = (): HealthIssue | null => {
  const hasClient = Boolean(process.env.NEXT_PUBLIC_TOSS_API_CLIENT_KEY?.trim());
  const hasSecret = Boolean(process.env.TOSS_API_SECRET_KEY?.trim());
  ...
// BillingAuthButton.tsx:43-44  const clientKey = process.env.NEXT_PUBLIC_TOSS_BILLING_CLIENT_KEY; if (!clientKey) throw new Error('결제 설정이 없습니다.');
// toss-billing.ts:27-28  const secret = process.env.TOSS_BILLING_SECRET_KEY; if (!secret) throw new Error('TOSS_BILLING_SECRET_KEY가 설정되지 않았습니다.');
```

**왜 문제인가.** 위젯 키·API 개별 키 쌍은 점검이 있지만 빌링 전용 쌍(`NEXT_PUBLIC_TOSS_BILLING_CLIENT_KEY` / `TOSS_BILLING_SECRET_KEY`)은 없다. 클라이언트 키만 있고 시크릿이 빠지면 고객은 토스 카드 인증을 마친 뒤 `issue_failed`('카드 등록에 실패했습니다')를 보고, 테스트 키(test_ck_/test_sk_)가 라이브에 남아도 알 수 없다. 스펙 §9는 '테스트 키로 배포해 심사 제출, 통과 후 라이브 키로 교체 + redeploy'를 절차로 적는데, 관리자 오픈 안내(admin/artists/index.tsx:175)와 `open.ts`는 플래그만 언급한다. `isArtistSupportOpen()`은 키와 무관하다. 메모리의 샌드박스 결제가 운영 DB에 쌓인 사고(2026-09-10)의 재발 경로다.

**조건 → 결과.** 아티스트 구독을 열면서 라이브 키 교체를 빠뜨리면 공개 가입자의 결제가 샌드박스로 처리되어 돈은 안 걷히고 후원자 명단·정산에는 올라간다. 키 불일치(test 클라이언트 + live 시크릿)는 카드 등록이 전부 실패한다.

**수정.** healthCheck에 `checkTossBillingKeyPair` 추가: 클라이언트·시크릿 존재 여부, 접두사(test_/live_) 일치, `isArtistSupportOpen()`이 true인데 test 키이면 high. NEXT_PUBLIC 키는 서버 코드에서도 빌드 시점 인라인이라 헬스체크에서 읽을 수 있다. `api/artists/support.ts`는 요청 시점에 `process.env.TOSS_BILLING_SECRET_KEY`가 없으면 503을 준다.

**비고.** BIL-18(샌드박스 혼입)의 오픈 체크리스트와 함께.

#### BIL-14. 청구 cron 라우트(processOne 포함)에 테스트가 없고, 대상이 늘면 60초 예산을 넘을 수 있다 [P2 · M]

**위치** `pages/api/cron/billing-charge.ts:49`·`203-211`, `tests/api/cron/` (purgeFunding·purgeOrders만 있음), `tests/api/cron/purgeOrders.test.ts` (본보기)

**지금 코드.**
```ts
export const config = { maxDuration: 60 };   // :49
...
for (const sub of due) {
  try {
    await processOne(sub, now, summary);
  } catch (error) {
    ...
    summary.errors.push({ subscriptionId: sub.id, message });
  }
}
```

**왜 문제인가.** 돈이 움직이는 진입점인데 billing-charge 라우트를 import하는 테스트가 없다 — processOne의 메일 분기, paused 운영자 알림, 재개 안내 루프, claim 스킵이 CI에 없다. BIL-15의 오발송이 바로 이 파일에 있다. 규모는 추측성이다: 구독당 DB 왕복 약 10회 + 토스 1~3초 + 메일 1초 = 3~5초라 60초에 12~20건인데, 현재 대상은 그 아래이고 중간에 잘려도 설계가 안전하다(승인 후 기록 전 종료는 다음 chargeCycle의 pending 대사가 회수, 남은 구독은 `nextBillingAt<=now`라 다음 날 다시 잡힌다).

**조건 → 결과.** 테스트 부재로 메일 분기 회귀가 CI에서 안 잡힌다. 규모 이슈는 후원이 열려 같은 결제일 가입자가 모일 때 하루 지연으로 나타난다.

**수정.**
1. `tests/api/cron/billingCharge.test.ts` 추가: 인증 401, claim 실패 시 skipped, chargeCycle ok/실패(past_due·paused)별 메일·운영자 알림 호출, errors가 있을 때 요약 메일, 재개 안내 성공 시 `clearResumeNotice`.
2. `maxDuration`을 300으로(10개 크론이라 Pro 플랜).
3. 루프에 deadline(시작+250초)을 두고 넘으면 break, `summary.deferred`와 운영자 메일에 남은 수를 적는다. 병렬 풀은 도입하지 않는다(토스·Turso 부하와 오류 처리 복잡도, CLAUDE.md '단순하게').

**비고.** 검증자 조정: 테스트 추가가 P2, 규모 대응은 P3 수준.

#### BIL-15. chargeCycle 결과가 '새로 결제함/이미 결제됨/대사 복구/카드 거절/시도 안 함/응답 없음'을 구분하지 않아 호출부가 틀린 메일을 고른다 [P2 · M]

**위치** `lib/billing/service.ts:~365` (ChargeCycleResult), `:432-437`, `:482-483`, `:~533`, `:~917` (resumeSubscription 주석), `pages/api/cron/billing-charge.ts:92-122` (processOne), `pages/api/admin/subscriptions/[id].ts:93-104`, `lib/billing/email.ts`

**지금 코드.**
```ts
const result = await chargeCycle(sub.id, now, { reason: ... });
if (result.ok) { ... await sendSubscriptionChargedEmail(sub, { amount: sub.totalAmount, cycleYm: result.cycleYm ?? cycleYm, paymentKey: result.paymentKey, manageUrl }); return; }
summary.failed += 1;
...
const notificationError = await sendSubscriptionChargeFailedEmail(sub, { ..., nextRetryAt: paused ? null : (refreshed?.nextBillingAt ?? null), ...});
// service.ts:432-437  return { ok: true, status: 'active', cycleYm: cycleYmOf(now) };   // 대사로 복구한 회차가 지난달이어도 이번 달로 보고
// service.ts:482-483  if (paid) return { ok: true, ..., cycleYm, attempt: paid.attempt };   // 아무것도 안 하고 ok
```

**왜 문제인가.** `ChargeCycleResult`는 ok/status뿐이고 호출부(cron processOne, 관리자 charge)는 ok면 무조건 완료 메일, !ok면 무조건 실패 메일을 보낸다. (a) 대사 복구 뒤 `cycleYm: cycleYmOf(now)`로 복구한 회차의 달·paymentKey를 버린다. (b) 같은 달 이미 paid면 아무것도 안 하고 `ok:true` → 관리자가 같은 달 수동 결제를 한 번 더 누르면 새 청구 없이 '결제 완료' 메일이 한 번 더 나간다(resumeSubscription 주석이 같은 반복 메일 버그를 재개 경로에서만 막았음을 인정). (c) '이전 결제 상태를 확인하지 못해 청구를 보류했습니다'·'등록된 카드가 없습니다'(ok:false, 시도 안 함)에도 '결제 실패, 카드를 다시 등록해 주세요' 메일(nextRetryAt은 과거 날짜)이 가고 nextBillingAt이 그대로라 매일 반복된다. (d) 가장 큰 것: NETWORK_ERROR·CONFIG_ERROR는 isInternalError로 주문만 pending에 두고(~533) 이후 일반 실패와 똑같이 attempt를 소모해 past_due → 3회째 paused(payment_failed)로 가며 고객에게 '카드 정보가 오래되었거나 한도 초과' 메일이 간다.

**조건 → 결과.** 관리자 이중 클릭 시 완료 메일 중복, 보류·카드 없음 상태에서 매일 거짓 실패 메일, 말일 복구 건의 월 표기 오류. 토스 장애·시크릿 설정 오류가 며칠 가면 카드가 멀쩡한 정상 구독이 payment_failed로 정지되고 고객에게 재등록 안내가 나간다.

**수정.** `ChargeCycleResult`에 `outcome: 'charged'|'already_paid'|'recovered'|'declined'|'unknown'|'held'|'no_card'|'inactive'`를 추가해 반환 지점마다 채운다(recovered는 복구한 회차의 cycleYm·paymentKey를 반환). cron·관리자 라우트는 charged·recovered에서만 완료 메일, declined에서만 실패 메일, already_paid는 메일 없음, held·no_card·unknown은 운영자 알림만. unknown(NETWORK_ERROR·CONFIG_ERROR·5xx)은 attempt를 소모하지 않거나 실패 메일·paused 전이에서 빼는 정책을 운영자가 먼저 정한다. `service.integration.test.ts`에 outcome 단언, BIL-14의 라우트 테스트에 메일 분기 단언.

**비고.** 검증자 조정: 놓친 더 큰 사례(unknown이 attempt를 소모해 정지까지 감)를 추가. BIL-1의 `held`는 이 outcome 필드로 통합하는 것이 낫다.

#### BIL-16. 관리자 화면 props·목록 API에 고객 상시 토큰과 평문 빌링키·응답 원본이 실린다 [P2 · S]

**위치** `lib/billing/admin-serialize.ts:17-29`·`~40`, `pages/api/admin/subscriptions/index.ts:65`, `pages/admin/subscriptions/index.tsx:49-52`, `pages/admin/subscriptions/[id].tsx:71-72`, `components/admin/subscriptionActions.ts`

**지금 코드.**
```ts
export const serializeSubscription = (sub: Subscription): SerializedSubscription => ({
  ...sub,
  pausedUntil: iso(sub.pausedUntil), ...
});
// pages/api/admin/subscriptions/index.ts:65  subscriptions: rows.map((row) => ({ ...row, failedCount: ... }))
// pages/admin/subscriptions/index.tsx:49-52  subscriptions: visible.map((row) => ({ ...serializeSubscription(row), failedCount: ... }))
```

**왜 문제인가.** `...sub`로 행 전체를 펼쳐 `manageToken`·`setupToken`·`customerKey`가 목록·상세 페이지 props(`__NEXT_DATA__`)와 관리자 목록 API 응답(`...row`)에 실린다. admin UI에서 이 세 필드를 쓰는 곳은 없다(`subscriptionActions.ts`는 POST만). 같은 파일의 `serializeBillingKey`는 BIL-5.

**조건 → 결과.** 만료 없는 manageToken이 관리자 브라우저 HTML·캐시·확장 프로그램에 남아 관리자 비밀번호를 바꿔도 무효화되지 않는다. 관리자 세션 탈취 자체는 어차피 해지·카드 변경 링크 발급이 가능하므로 '새로 생기는 권한'은 크지 않다.

**수정.** `SerializedSubscription`을 `Omit<Subscription,'manageToken'|'setupToken'|'customerKey'>`로, `SerializedBillingKey`를 `Omit<BillingKey,'billingKey'|'rawResponse'>`로 좁히고 직렬화에서 해당 키를 제외한다(허용 목록 방식 권장 — 새 컬럼이 추가돼도 기본이 안전). `api/admin/subscriptions/index.ts`의 `...row`도 같은 직렬화를 거치게 한다. 직렬화 결과에 토큰·빌링키 필드가 없음을 단언하는 테스트. 관리 링크 복사가 필요해지면 그때 서버에서 따로 만든다. BIL-5와 같은 PR.

**비고.** 검증자 조정: 세션 탈취 시 권한 증가는 작고, 실질 위험은 상시 토큰의 무효화 불가.

#### BIL-17. 후원자 명단: 운영자가 내릴 방법이 없고, 동의 체크박스가 기본 체크 상태다 [P2 · M]

**위치** `components/artists/ArtistSupportCallout.tsx:67`, `lib/artistSupport/supporters.ts:12`·`20-35`, `pages/api/admin/subscriptions/[id].ts:31` (ACTIONS), `pages/admin/subscriptions/[id].tsx:384-385`, `pages/[locale]/subscribe/manage/[id].tsx:232`, `public/locales/ko/common.json:3317`, `lib/artistSupport/signup.ts`

**지금 코드.**
```ts
export const listPublicSupporters = async (artistSlug: string, limit = 100) => {
  const rows = await getDb().select({ displayName: ..., customerName: ..., createdAt: ... }).from(subscriptions)
    .where(and(eq(subscriptions.kind, 'artist-support'), eq(subscriptions.artistSlug, artistSlug),
      eq(subscriptions.displayConsent, true), inArray(subscriptions.status, SUPPORTING_STATUSES)))...
// SUPPORTING_STATUSES = ['active', 'past_due', 'cancelled']
```

**왜 문제인가.** 명단 노출을 끄는 수단이 운영자·후원자 어느 쪽에도 없다 — WHERE에 숨김 조건 없음, admin ACTIONS 7개(charge·cancel·pause·resume·card_change_link·resend_setup·refund_payment)에 unlist 없음, admin 상세는 '동의 · 이름'을 보여주기만, manage 페이지에는 토글이 없고 '문의: 010-4255-7893'이 유일한 경로. 펀딩은 같은 문제를 `listing_hidden_at`(c30ed81925, #261)으로 이미 풀었는데 구독에는 따라온 흔적이 없다. 게다가 동의 체크박스가 `useState(true)`라 FAQ(common.json:3317)의 '구독자 명단(원할 때만)' 약속과 어긋난다. 해지 후 월말까지 명단에 남는 것은 스펙 §9('이미 결제한 달의 혜택은 월말까지 유지')와 `artistSupport.integration.test.ts:94`가 고정한 의도라 결함이 아니다.

**조건 → 결과.** 오픈 후 욕설·사칭·광고 문구를 낸 후원자(월 5,000원 실결제 필요)나 철회를 원하는 후원자가 생기면 DB 직접 수정(turso 셸) 말고는 숨길 수단이 없다. 기본 체크 때문에 이름을 올릴 생각이 없던 사람이 명단에 오를 수 있다.

**수정.**
1. `ArtistSupportCallout.tsx:67`을 `useState(false)`로(BIL-9 ①과 동일).
2. admin [id].ts에 `'unlist'` 액션과 상세 화면 버튼 추가. 후원자가 스스로 켜는 UI가 아직 없으므로 기존 `display_consent`를 0으로 내리는 것으로 충분하고 마이그레이션이 필요 없다.
3. 후원자 셀프 토글(관리 페이지)을 만든다면 그때 별도 `listing_hidden_at`을 둔다 — 펀딩 0036 선례처럼 동의 끄기로 대신하면 후원자가 다시 켤 때 운영자가 내린 이름이 되살아난다. subscriptions에 컬럼을 더하면 청구 크론이 전체 컬럼을 SELECT하므로 '마이그레이션 먼저, 배포 나중'을 지킨다(0037·0046처럼 별도 표도 가능).
4. 금칙어·URL 검사와 '해지 즉시 제외'는 넣지 않는다(앞은 운영자 수동 확인 + unlist로 충분, 뒤는 스펙 §9와 충돌).

**비고.** 같은 자리를 다른 축(PRV 개인정보·처리방침 정합·로그)도 지적: 아티스트 구독 신청의 명단 공개 동의가 기본 체크다.

#### BIL-18. 카드 등록 완료 처리가 revoke→insert→update 3왕복이라 change 모드에서 중간 실패 시 유효 카드가 일시적으로 없어진다 [P3 · S]

**위치** `lib/billing/service.ts:309-336`, `lib/billing/service.integration.test.ts`

**지금 코드.**
```ts
await db.update(billingKeys).set({ revokedAt: now }).where(and(eq(billingKeys.subscriptionId, subscription.id), isNull(billingKeys.revokedAt)));
const [key] = await db.insert(billingKeys).values({ ... billingKey: issued.billingKey, ... rawResponse: JSON.stringify(issued.raw) }).returning({ id: billingKeys.id });
await db.update(subscriptions).set({ billingKeyId: key.id, setupToken: null, setupTokenExpiresAt: null, setupMode: 'initial', updatedAt: now }).where(eq(subscriptions.id, subscription.id));
```

**왜 문제인가.** 기존 키를 먼저 revoke한 뒤 새 키를 insert하므로 두 문장 사이에 실패하면 구독에 유효 키가 없다. 같은 파일의 다른 전이는 `db.batch`를 쓴다. 다만 이 시점에 setupToken은 아직 null이 아니라(null 처리는 세 번째 문장) 호출은 GSSP 예외로 500이 되고 고객이 설정 링크로 돌아가 다시 등록하면 복구된다(소진되는 것은 authKey뿐). initial 모드는 revoke 대상이 없어 영향이 거의 없고, 취약 구간은 change 모드의 revoke→insert 사이뿐이다. `subscriptions.billingKeyId`는 코드 어디서도 읽지 않아(chargeCycle·getSubscriptionWithDetails는 `revokedAt IS NULL + issuedAt desc`로 직접 조회) 세 번째 문장 실패는 무해하다.

**조건 → 결과.** 발생 빈도 매우 낮고 고객 재시도로 복구된다. 방치하면 다음 청구가 카드 없음으로 실패해 재등록 안내가 나간다.

**수정.** 순서만 바꾼다. (1) 새 키를 먼저 insert(`.returning` 그대로) → (2) `db.batch([기존 키 revoke(ne(billingKeys.id, key.id) 조건 추가), subscriptions update])` 한 번으로 묶는다. insert 뒤 batch가 실패해도 새 키가 이미 있고 chargeCycle이 issuedAt이 가장 늦은 키를 쓰므로 카드 없음 상태가 생기지 않는다. JS에서 id를 만드는 변경은 필요 없다. 다른 변경에 곁들인다.

**비고.** 검증자 조정: '같은 링크로 재시도할 수 없다'는 틀렸고 billingKeyId 불일치는 무해해 P2→P3.

#### BIL-19. 폐기·종료된 빌링키의 billing_key 컬럼이 평문으로 남아 raw_response 파기가 자격증명 최소화로는 실효가 없다 [P3 · L]

**위치** `lib/privacy/orderRetention.ts:866-886`, `db/schema.ts:1191`, `lib/billing/toss-billing.ts`, `lib/crypto/fieldCrypto.ts`

**지금 코드.**
```ts
export const purgeUnusableBillingKeyRawResponses = async (): Promise<OrderPurgeResult> => {
  ...
  const result = await db.update(billingKeys).set({ rawResponse: null })
    .where(and(isNotNull(billingKeys.rawResponse), or(isNotNull(billingKeys.revokedAt), inArray(billingKeys.subscriptionId, endedSubscriptions))));
// db/schema.ts:1191  billingKey: text('billing_key').notNull().unique(),
```

**왜 문제인가.** 파기 함수는 billing_key의 복사본인 raw_response만 비우고 원본 billing_key(평문, NOT NULL UNIQUE)는 폐기·종료 구독의 키에서도 남긴다. 함수 주석은 raw_response를 '빌링키를 복제한 값'이라 하며 지워야 하는 이유를 빌링키(결제수단 자격증명)로 대는데, 원본 컬럼이 그대로라 주석의 논리와 동작이 어긋난다. 이전 키를 토스에서 폐기하는 호출도 없다(toss-billing.ts는 issue·charge·조회만). 빌링키 단독으로는 청구할 수 없고 `TOSS_BILLING_SECRET_KEY`와 customerKey가 함께 있어야 한다.

**조건 → 결과.** DB 읽기 권한이 새면 과거·현재 빌링키 문자열이 드러난다. 시크릿 키가 따로 새지 않는 한 즉시 청구는 불가하다.

**수정.** 단기만 한다. `purgeUnusableBillingKeyRawResponses`와 같은 조건(revoked_at이 있거나 구독이 ended)의 행에서 `billing_key`를 `purged:<id>`로 덮는다(NOT NULL·UNIQUE 유지, 읽는 코드 없음 — 화면은 cardCompany·cardNumberMasked만 사용). 같은 UPDATE에 합치고 `orderRetention.test.ts`에 단언 추가. billing_key 암호화(중기: lib/crypto 등록·해시 컬럼·회전 스크립트·마이그레이션 선적용)는 필요가 확인되기 전까지 하지 않는다. 토스에 빌링키 삭제 API가 있는지는 문서로 확인 후 별도 판단. 현재 키가 admin props로 나가는 문제는 BIL-5에서 같이 고친다.

**비고.** 검증자 조정: P2→P3. '처리방침 설명이 과장된다'는 근거 없음(처리방침 문안에 빌링키 서술이 없다).

#### BIL-20. 정기결제 동의 시 어느 규정 문구를 봤는지 판본이 저장되지 않는다(증빙 강화 제안) [P3 · M]

**위치** `pages/[locale]/subscribe/[id].tsx` (동의 고지 문구), `lib/billing/service.ts:300-340` (completeCardSetup), `db/schema.ts:1089-1146` (subscriptions), `db/schema.ts:563-564` (funding_pledges 선례), `lib/booking/refund-policy.ts`, `content/fundingTerms.baseline.test.ts`

**지금 코드.**
```tsx
{/* 동의는 카드 등록하기를 누르는 행위 자체로 받는다. 체크박스를 두지 않는다 ... */}
<p className="mt-6 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
  카드 등록하기를 누르면 위 결제 조건과 해지·환불 규정에 동의하는 것으로 봅니다.
</p>
// subscriptions(1088~1146): termsAgreedAt/termsVersion 같은 컬럼이 없다. funding_pledges에는 terms_agreed_at·terms_version이 있다(564행).
```

**왜 문제인가.** 구독 행에 동의 시각·규정 판본이 없다. 펀딩(terms_version)·개설자(creatorTermsVersion:857)·계약에는 있다. 다만 동의를 '카드 등록하기' 버튼 고지로 받는 것은 운영자 결정(#162, #165 '결제 화면 네 곳이 같은 방식')이고 예약·믹싱·공연도 판본을 저장하지 않는다 — 구독만의 결함이 아니라 교차 사안이다. 규정은 코드(`subscriptionRefundPolicyLines`)에 있어 `billing_keys.issued_at`과 git 이력으로 복원된다(펀딩 옛 본문도 같은 방식).

**조건 → 결과.** 분쟁 시 증빙이 간접적이다. 즉시 터지는 결함이 아니다.

**수정.** 가볍게. subscriptions에 nullable `terms_version`·`terms_agreed_at`를 추가하고(마이그레이션 선적용 규칙 준수, 컬럼이 없는 DB에서도 읽기가 깨지지 않게 별도 표를 쓸지 먼저 판단), `completeCardSetup`의 setupMode 'initial' 성공 경로에서 `subscription-terms-YYYY-MM-DD` 상수와 now를 기록한다. 규정 문구 해시 baseline 테스트 게이트는 규정을 자주 고칠 때만. 결제 화면 네 곳 공통 사안이므로 구독만 먼저 하지 말고 운영자 결정과 함께 묶어 판단한다.

**비고.** 검증자 조정: 법적 필수 근거 미확인, '복원 불가'는 과장 → P3.

#### BIL-21. 샌드박스 결제가 실제 정산 기록에 섞여도 막는 장치가 없다 (오픈 전 검증 창에 한정) [P3 · M]

**위치** `lib/artistSupport/payout.ts:76-97`, `lib/billing/service.ts:630` (receipt_url 저장), `db/schema.ts:1088-1190`, `lib/ops/healthCheck.ts`, `lib/ops/adminDashboard.ts`

**지금 코드.**
```ts
.where(
  and(
    eq(subscriptions.kind, 'artist-support'),
    eq(subscriptions.artistSlug, artistSlug),
    eq(subscriptionPayments.cycleYm, period),
    eq(subscriptionPayments.status, 'paid'),
  ),
);
```

**왜 문제인가.** subscriptions·billing_keys·subscription_payments에 is_test/livemode 컬럼이 없어, 오픈 전 운영자 검증(테스트 키 + 운영 DB)에서 생긴 샌드박스 결제가 지워지지 않으면 같은 아티스트·같은 달 정산 미리보기에 합산된다. 메모리의 2026-09-10 사고(샌드박스 결제가 운영 Turso에 쌓여 5행 삭제)가 실제로 있었다. 완화 요소: SUPPORTED_ARTISTS 빈 배열, 플래그 닫힘, 라이브 키 교체 뒤에는 샌드박스 결제가 생길 수 없어 위험 창이 '오픈 전 검증 한 번'이며, 정산은 운영자가 미리보기를 보고 기록한 뒤 수동 송금한다.

**조건 → 결과.** 검증 뒤 테스트 행을 지우지 않으면 미리보기 총액·후원자 수가 부풀 수 있고 운영자가 눈치채지 못하면 그대로 기록할 수 있다.

**수정.** 스키마·마이그레이션 없이. `recordArtistPayout` 직전에 그 달 대상 결제 중 `payments.receipt_url`에 'sandbox'가 들어간 것이 있는지 검사하고, 있으면 기록을 거부(또는 정산 화면에 경고). 조용히 제외하지 말 것(숨기면 금액이 어긋난 이유를 못 찾는다). 오픈 체크리스트에 '검증 뒤 테스트 행 삭제(백업은 저장소 밖)'와 'Vercel 운영 env의 TOSS_BILLING_SECRET_KEY·CLIENT_KEY가 라이브인지 확인'(BIL-13). is_test 컬럼은 만들지 않는다.

**비고.** 검증자 조정: 컬럼 추가 + 쿼리 5곳 + 배지 수정안은 한 번의 검증 창을 위한 장치로 무거워 제외. Vercel 운영 env의 빌링 키가 테스트인지 라이브인지는 읽지 못했다(Sensitive).

#### BIL-22. 같은 이메일·같은 아티스트의 이중 구독을 카드 등록 단계에서 막는 검사가 없다 [P3 · S]

**위치** `lib/billing/service.ts:164-170` (createSubscription 중복 검사), `lib/billing/service.ts:290` (completeCardSetup), `pages/api/artists/support.ts`, `components/artists/ArtistSupportCallout.tsx:107-110`, `lib/artistSupport/supporters.ts:12`, `lib/artistSupport/artistSupport.integration.test.ts`

**지금 코드.**
```ts
if (input.contractId) {
  const existing = await db.query.subscriptions.findFirst({
    where: (t, { and: all, eq: is, inArray: within }) =>
      all(is(t.contractId, input.contractId!), within(t.status, OCCUPYING_STATUSES)),
  });
  if (existing) return { ok: false, code: 'already_exists' };
}
```

**왜 문제인가.** 중복 검사는 `if (input.contractId)` 안에만 있고 아티스트 구독은 contractId가 없어 통과한다. 스키마에는 customerKey·setupToken·manageToken 유니크뿐이다. 같은 (이메일, 아티스트)로 pending_card 행을 여러 개 만들 수 있고, 같은 사람이 두 링크 모두에서 카드 등록을 끝내면 두 구독이 active가 되어 매달 이중 청구된다. 다만 폼은 제출 뒤 `window.location.assign`으로 이동하고 busy를 풀지 않아 뒤로가기 재제출은 막히며, pending 행은 청구·명단(SUPPORTING_STATUSES)·정산에 잡히지 않고 토큰은 7일에 만료된다.

**조건 → 결과.** 고객이 두 번째 등록 직후 이중 첫 결제와 메일 두 통을 받아 즉시 눈에 띄고, 회차 환불로 정리한다. 공개 '명단 n명'(countSupporters)만 이중 구독을 두 명으로 센다. 정산 subscriberCount는 실제 이중 결제를 정확히 센다.

**수정.** 신청 API(`support.ts`)에서 `already_exists`를 돌려주지 않는다 — 공개 무인증 경로라 임의 이메일의 구독 여부를 알아내는 판별 수단이 된다. 대신 이메일 소유가 증명되는 `completeCardSetup`에서, 구독이 artist-support이고 setupMode가 'initial'일 때, 빌링키 발급 전에 `lower(customer_email)`과 `artist_slug`가 같고 status가 active·past_due·paused인 다른 구독이 있는지 본다. 있으면 `'already_subscribed'`로 거절하고 '이미 구독 중입니다. 메일의 관리 링크를 확인해 주세요'를 안내한다. 이메일 비교는 대소문자 무시(저장값이 정규화되지 않았다). 선택: 같은 (이메일, 아티스트)의 새 신청이 오면 이전 pending_card 행의 setupToken을 null로 만들어 최신 링크만 유효하게(응답이 달라지지 않아 정보 노출 없음). 부분 유니크 인덱스는 마이그레이션·when 함정이 따르므로 쓰지 않는다.

**비고.** 검증자 조정: 원안의 신청 API already_exists 응답·기존 토큰 재발급은 정보 노출·링크 탈취를 만들어 제외. 레슨 쪽은 관리자 경로라 중복 허용이 의도.

#### BIL-23. 해지·정지·재개 UPDATE가 읽은 시점의 상태 검사를 쓰기에 걸지 않아 겹친 조작이 서로 덮어쓴다 (이중 해지는 메일 중복) [P3 · S]

**위치** `lib/billing/service.ts:723-743` (cancelSubscription), `:911` (pauseSubscription), `:942` (resumeSubscription), `:663`·`:1162`·`:1339`·`:1356` (상태를 WHERE에 거는 선례), `pages/api/subscriptions/cancel.ts:29`, `pages/api/admin/subscriptions/[id].ts:136/203/217`, `pages/[locale]/subscribe/manage/[id].tsx:223`

**지금 코드.**
```ts
const [row] = await db.update(subscriptions).set({ status: 'cancelled', cancelledAt: now, ... endsAt, nextBillingAt: null, ... }).where(eq(subscriptions.id, id)).returning();   // cancelSubscription:740
// pauseSubscription:911  .where(eq(subscriptions.id, id))
// resumeSubscription:942  .where(eq(subscriptions.id, id))
```

**왜 문제인가.** 세 함수가 상태를 읽고 검사한 뒤 WHERE id만으로 쓴다. 같은 파일의 승인 batch·resumeExpiredPauses·정지 유지 분기는 상태를 WHERE에 다시 걸고 주석('읽은 뒤 이 순간 사이에 재개·해지가 들어왔다 — 그쪽이 맞다')으로 원칙을 밝혀 두었는데 이 셋만 빠져 있다. 호출부는 결과 코드만 쓰고 잠금·DB 제약이 없다. 고객 해지 버튼은 `cancelling`으로 같은 탭 중복만 막는다.

**조건 → 결과.** 한 번의 DB 왕복 안에 두 조작이 겹칠 때만(고객 해지 vs 관리자 재개/정지, 두 탭, `cancelSubscriptionsOfContract` 일괄 해지 vs 고객 해지). 해지 직후 겹친 재개는 status를 active로, nextBillingAt을 now로 되돌려 다음 cron이 해지한 고객을 청구한다. 겹친 정지는 해지 위에 paused를 덮고 `resumeExpiredPauses`(1162, 해지 여부는 보지 않음)가 active로 되살린다. 동시 이중 해지는 둘 다 ok를 받아 고객·운영자 메일이 두 통 나간다(같은 구독이면 endsAt·사유는 같아 덮어쓰기 자체는 무해).

**수정.** UPDATE의 WHERE를 앞의 읽기 검사와 같은 조건으로 만들고 `returning()`이 비면 `invalid_state`를 돌려준다.
- cancel: `and(eq(id), notInArray(status, ['cancelled','ended']))`
- resume: `and(eq(id), eq(status,'paused'))`
- pause: `and(eq(id), or(inArray(status, ['active','past_due']), and(eq(status,'paused'), eq(pausedReason,'operator'))))` — 읽기의 extendable 조건 그대로. `'paused'` 전체를 허용하면 읽은 뒤 chargeCycle이 세운 payment_failed 정지를 operator 정지로 덮어 사유가 바뀐다.
테스트: `Promise.all([cancel, cancel])`에서 하나는 ok, 하나는 invalid_state이고 메일 호출이 한 번인지.

**비고.** 검증자 조정: 이중 해지의 덮어쓰기는 과장(실제 부작용은 메일 두 통), pause WHERE를 좁힘. 통합 테스트로 경합을 결정적으로 재현할 수 있는지는 실행해 보지 않았다.

#### BIL-24. 정산 기록이 확인창의 금액이 아니라 클릭 시점에 다시 계산한 금액을 고정하고, 지급 완료 메모가 항상 빈 값이다 [P3 · S]

**위치** `pages/admin/artists/index.tsx:38`·`107`·`307-324`, `components/admin/artistActions.ts:25-26`, `lib/artistSupport/payout.ts:121-150`, `pages/api/admin/artists/payouts.ts`, `pages/api/admin/artists/payouts/[id].ts:25`

**지금 코드.**
```ts
run(key, () => recordPayout(p.artistSlug, p.period), `${p.artistName} ${p.period} 정산을 ${formatPriceAmount(p.netAmount)}원으로 기록할까요?`)
...
run(key, () => markPayoutPaid(p.recorded!.id, ''), `${p.artistName}에게 ${formatPriceAmount(p.recorded!.netAmount)}원을 이체했나요? 지급 완료로 기록합니다.`)
```

**왜 문제인가.** 정산 기록은 확인창에 SSR 시점의 `p.netAmount`를 보여주면서 요청에는 `{artistSlug, period}`만 싣고, 서버가 클릭 시점에 미리보기를 다시 계산해 고정한다 — 금액 일치 검사가 없다. 지급 완료는 항상 `memo ''`를 보내고 API가 빈 문자열을 null로 바꾸며, 메모가 있어도 `recorded.memo`는 props에 실리기만 하고 화면 어디에도 렌더되지 않는다(index.tsx:38, 107).

**조건 → 결과.** 로드~클릭 사이에 늦은 환불·늦게 성공한 재시도 결제가 끼면 운영자가 확인한 금액과 다른 값이 기록된다(드묾, 기록 이후 차이는 화면의 '기록과 다름' 표시가 맡는다). 이체 확인번호 같은 사후 대조 근거를 남길 길이 없다. 이체액 자체는 지급 완료 확인창이 기록 금액을 보여주므로 틀어질 위험이 작다.

**수정.** ① `recordPayout` 요청에 `expectedNetAmount`(=p.netAmount)를 싣고 `recordArtistPayout`이 `preview.netAmount`와 다르면 새 코드 `'amount_changed'`로 409 거절(`payouts.ts` RECORD_ERROR에 한 줄). ② 지급 완료 클릭 시 `window.prompt('이체 메모(선택)')`로 받아 `markPayoutPaid`에 넘기고, 표의 상태 칸 또는 history 표에 `recorded.memo`를 함께 보여준다. 별도 입력 칸·상태는 만들지 않는다(이 화면이 이미 쓰는 window.confirm과 같은 결).

**비고.** 검증자 조정: 메모를 받아도 렌더가 없으면 쓰기 전용 칸이 되므로 표시를 추가.

#### BIL-25. cron의 정지 운영자 알림 발송 실패가 버려지고, 자동 재개 알림의 .catch는 실패 문자열을 잡지 못한다 [P3 · S]

**위치** `pages/api/cron/billing-charge.ts:117-119`·`159`, `pages/api/admin/subscriptions/[id].ts:121`·`145`, `lib/billing/email.ts:341-384` (sendSubscriptionOperatorAlert), `lib/email/resend.ts:59`, `pages/admin/index.tsx:143`

**지금 코드.**
```ts
if (paused) {
  await sendSubscriptionOperatorAlert(sub, 'paused', `자동 재시도 한도 소진 — ${result.message ?? ''}`);
}
// admin [id].ts:121  await sendSubscriptionOperatorAlert(subscription, 'paused', ...)
// admin [id].ts:145  await sendSubscriptionOperatorAlert(result.subscription, 'cancelled', ...)
```

**왜 문제인가.** `sendSubscriptionOperatorAlert`는 실패해도 던지지 않고 `'operator:<코드>'` 문자열을 돌려주는데(sendEmail이 예외 대신 결과 객체를 돌려준다) cron:118과 admin [id].ts:121·145가 이를 버린다. cron:159의 pause_expired 알림은 `.catch(console.error)`만 붙어 있어, 던지지 않는 이 함수의 실패 문자열이 로그에도 남지 않아 그 `.catch`는 실질적으로 무효다. 실제로 영향이 있는 곳은 cron:118 하나다 — admin:121은 운영자가 직접 누른 수동 결제의 응답(409, status paused)을 바로 보고, :145는 운영자 본인 해지의 사본이다.

**조건 → 결과.** Resend 개별 실패(429·API 오류) 시기에 결제 실패로 정지된 구독의 운영자 푸시 알림이 말없이 빠진다. 대시보드 '정지된 구독' 큐 카드(admin/index.tsx:143)는 남으므로 상태는 보이고, 능동적으로 알려주는 경로만 사라진다.

**수정.** cron:118과 :159에서 반환값을 받아 실패하면 `console.error`와 함께 `summary.errors`에 '운영자 알림 실패: ...'로 넣는다(응답 ok:false와 기존 cron 요약 메일을 그대로 쓴다 — 같은 Resend 경로라 전면 장애에는 효과가 없지만 개별 실패와 Vercel 로그에는 남는다). :159의 무효한 `.catch`는 같은 방식으로. admin [id].ts:121·145는 success.tsx:137처럼 `console.error` 한 줄.

**비고.** 검증자 조정: 'alertLateApproval만 기록한다'는 틀렸다(service.ts:806·1387, success.tsx:137-138도 기록). 같은 자리를 다른 축(OPS 메일·크론·운영 알림)도 지적: billing-charge: 운영자 알림(정지·자동 재개)의 실패 반환값을 버리고, 그 뒤의 .catch는 실행되지 않는다.

#### BIL-26. 구독 조회 경로에 보조 인덱스가 없다 (현재 운영 DB 0행이라 영향 없음, 규모 대비용) [P3 · S]

**위치** `db/schema.ts:1088-1146`, `drizzle/migrations/0012_typical_johnny_storm.sql:65-67`, `lib/billing/service.ts:314`·`993-1003`, `lib/artistSupport/supporters.ts`, `pages/admin/subscriptions/index.tsx:39-43`, `pages/api/artists/[slug]/supporters.ts`

**지금 코드.**
```
// subscriptions에는 customer_key·setup_token·manage_token의 unique 인덱스만 있다(0012_typical_johnny_storm.sql:65-67).
// listDueSubscriptions: WHERE status IN ('active','past_due') AND next_billing_at <= ?
// listPublicSupporters/countSupporters: WHERE kind='artist-support' AND artist_slug=? AND status IN (...)
// billing_keys WHERE subscription_id=? AND revoked_at IS NULL
```

**왜 문제인가.** status+next_billing_at, kind+artist_slug+status 필터와 billing_keys(subscription_id) 조회가 전체 스캔이다. 다만 공개 명단 API는 s-maxage=60·SWR 300 캐시가 있고, 청구 cron은 하루 한 번에 결제일이 분산돼 대상이 수십 건이며, 수천 행 전체 스캔은 ms 단위다. 이 저장소의 마이그레이션은 수동 적용 + when 최댓값 함정 + drift 검사가 붙어 있어 가설 규모를 위한 전용 마이그레이션은 '사소한 이득을 위해 유지보수 부담이 큰 기계'에 가깝다. 관리자 목록 failedCounts는 status='failed' 행만 집계한다(39-43) — '전체 group by'는 아니다.

**조건 → 결과.** 운영 DB 구독 0행이라 지금 영향 없음. 수만 행 규모가 되기 전까지 지연·읽기 비용은 무시할 수준이다.

**수정.** 전용 마이그레이션을 지금 만들지 않는다. 아티스트 구독을 여는 시점이나 다음에 구독 표를 건드리는 마이그레이션에 `CREATE INDEX IF NOT EXISTS` subscriptions(kind, artist_slug, status), subscriptions(status, next_billing_at), billing_keys(subscription_id)를 함께 싣는다(적용은 main 병합본에서 Turso CLI로, when 최댓값 확인). 마이그레이션이 필요 없는 부분만 지금: 관리자 목록 failedCounts의 where에 visible 구독 id 집합(`inArray`)을 더한다.

**비고.** 검증자 조정: 운영 DB 0행 확인, 전용 마이그레이션 제외. 후원자 규모 전망은 코드로 확인할 수 없다.

---

**권장 묶음.** BIL-1 + BIL-4 + BIL-15(outcome)는 한 PR — 서로 의존한다. BIL-5 + BIL-16 + BIL-19 단기안은 `admin-serialize.ts`·`orderRetention.ts` 한 PR. BIL-9 ① = BIL-17 1). BIL-13·BIL-21은 아티스트 후원 오픈 체크리스트(라이브 키 확인 → 검증 → 테스트 행 삭제 → 플래그).

**클린 판정**
- `lib/billing/schedule.ts`의 말일 당김·KST 벽시계 계산(billingDateOf·computeNextBillingAt·scheduleForPaidCycle 월말 연속 청구 처리)과 schedule.test.ts — 단위·통합 테스트 170건 통과 확인(npx jest lib/billing lib/artistSupport)
- 토스 멱등키에 attempt 포함, subscription_payments (subscriptionId, cycleYm, attempt) 유니크 인덱스, claimDueSubscription CAS와 payments를 batch 맨 앞에 둔 승인 반영 순서 — 같은 회차 동시 청구는 토스 호출 전에 막힌다
- 승인 batch와 reconcileSubscriptionPaymentFromToss의 REACTIVATABLE_STATUSES·keepsPause 가드(해지·종료·운영자 정지를 뒤늦은 승인이 되살리지 않고 운영자 메일로 알림), 재조회 금액·orderId 검증
- setup·manage 토큰: timing-safe 비교, 부재와 불일치를 같은 404로 응답, setup 1회성 + 7일 만료, customerKey 불일치 거절, fail.tsx의 코드 화이트리스트(쿼리 message 미사용)
- 오픈 플래그 게이트: /api/artists/support은 플래그 없으면 503, 관리자 생성 API는 kind를 practice-room·lesson으로 제한, supporters API는 읽기 전용이며 아티스트 없으면 404 — 플래그 없이 열려 있는 쓰기 경로는 발견하지 못했다
- 관리자 API 전체에 authenticateAdminApi 적용, 후원자 CSV의 수식 인젝션 방어(toCsv)와 접속기록(privacy_access_logs, 실패 포함), cron 인증 fail-closed(CRON_SECRET 해시 비교)
- 정산 계산(computeArtistPayout): 환불 선차감·음수 방지·원천징수 절사, (artist, period) 유니크로 이중 기록 차단, pending→paid 단방향
- 빈 아티스트 허브의 noindex·사이트맵 제외·llms 문구(artistsMeta 거울과 테스트로 고정)
- `lib/billing/refund.ts`의 회차 환불(settleRefund 재사용, 부분 환불 잔액 검증), pages/api/subscriptions/cancel·card-change의 레이트리밋·본문 검증
- components/lesson/*(CurriculumCard·FormatCard·PhaseHeader)는 표현 전용 컴포넌트로 기능적 문제 없음

**읽지 못한 범위**
- 토스 실제 API 응답은 네트워크 없이 확인하지 못했다 — 'NOT_FOUND_PAYMENT 404 재조회'(BIL-1)와 '5xx 오류에도 승인이 났을 가능성'(BIL-4)은 토스 문서·이 저장소 booking/confirm.ts의 관례에 근거한 추정이다(confidence에 반영)
- lib/booking/webhook.ts의 구독 분기(291행·379행 근처)와 lib/booking/cancel.ts settleRefund 내부는 grep으로만 확인했고 정독하지 않았다
- lib/ops/healthCheck.ts(1,100줄)는 구독·빌링 관련 구간만 읽었다. lib/privacy/orderRetention.ts도 구독 파기 함수 주석과 일부 본문만 읽었다
- components/admin/subscriptionActions.ts·artistActions.ts, tests/pages/subscribe/*·tests/pages/admin/*의 상세 테스트 본문은 읽지 않았다
- drizzle 마이그레이션 0012·0016 SQL과 운영 Turso의 실제 스키마·인덱스는 대조하지 않았다(읽기 전용 규칙)
- middleware.ts CSP에서 토스 빌링 SDK(frame/script) 허용 여부, Vercel 플랜별 Cron 지터·maxDuration 한도는 확인하지 못했다
- 처리방침 18항(구독 정보 보유·파기)·약관 페이지 문구와 코드의 대조, docs/superpowers/specs/2026-09-10-toss-billing-subscription-design.md 전문은 읽지 않았다
- ko 외 로케일의 아티스트 카피, 연습실 구독의 계약서(contracts) 연동 상세(monthlyRent 공급가 가정)는 범위 밖으로 두었다

**미검증 후보(overflow)**
- 없음

---

## 2부 — 신뢰 영역: 전자계약·보안·DB·개인정보

### CON. 전자계약 — 서명·해시·PDF·보관

P0 0 · P1 1 · P2 10 · P3 19, 미검증 0

이 절의 지적 가운데 다섯 건(CON-5·CON-8·CON-10·CON-13·CON-15)은 뿌리가 하나다. 2026-10-03 23:21 커밋 `c5bd4ad154`(PR #458, 계약 점검 8건 수정)가 20분 뒤 공연 UI PR #460 스쿼시 `7868515e1f`에 의해 계약 관련 파일 38개가 통째로 되돌려졌고, 그 뒤 복구 커밋이 없다. `git apply --check`로 `c5bd4ad154` 패치를 HEAD에 대 보면 `lib/ops/healthCheck.ts` 한 파일만 충돌한다. 따라서 이 절의 첫 작업은 **별도 브랜치에서 `git cherry-pick c5bd4ad154`를 하고 healthCheck.ts만 수작업으로 합치는 것**이다. 그 다음에 CON-1부터 순서대로 간다.

#### CON-1. 이용 종료(terminated) 계약의 서명본이 고객·관리자 모두 내려받을 수 없다 — 완료 화면은 "내려받을 수 있다"고 안내 [P1 · S]

① `pages/api/contracts/[id]/download.ts:69-74`, `pages/api/contracts/[id]/pdf.ts:58`, `pages/[locale]/contracts/[id]/complete.tsx:244-248`, `pages/admin/contracts/[id]/index.tsx:574`·`:319`, `pages/admin/contracts/index.tsx:417`, `lib/contracts/status.ts`

② 고객 다운로드 API는 상태를 `signed` 하나로만 연다.

```ts
// download.ts:69
if (contract.status !== 'signed') {
  return res.status(409).json({ ok: false, message: '서명이 완료된 뒤에 계약서를 받으실 수 있습니다.' });
}
// pdf.ts:58 (관리자 PDF)
if (contract.status !== 'signed') {
  return res.status(409).json({ ok: false, message: '서명이 완료된 계약만 PDF로 받을 수 있습니다.' });
}
```

관리자 화면도 같은 조건으로 PDF 버튼을 그린다 — `[id]/index.tsx:574 {contract.status === 'signed' && !contract.purgedAt && (` , `index.tsx:417` 동일. 반면 `complete.tsx:244-248`은 `terminated`일 때 "서명본은 그대로 보관되며 아래에서 내려받을 수 있습니다"를 띄우고, 그 버튼의 `downloadUrl`(:114)은 위 download API를 가리킨다. `terminateContract`(`lib/contracts/service.ts:117-140`)는 `status`만 `terminated`로 바꾸고 `signedAt`·`content`·`pdfUrl`·서명행은 전부 남긴다.

③ 이전 리뷰(`docs/code-review-2026-08-24-round2.md` #9, 85-89행)가 `download.ts:67-72`·`pdf.ts:41-43`을 같은 이유로 지적했는데 `sign.tsx`와 `complete.tsx`만 고쳐지고 API 두 곳과 관리자 버튼은 그대로다. 그 뒤 download.ts를 만진 세 커밋(`bddae28198`·`a9fb2aa349`·`c72c685153`)과 pdf.ts 커밋 어디에도 `git log -S'terminated'` 결과가 없다. 우회로도 없다 — `pdf-storage.ts:14` Blob은 `access: 'private'`이고 `loadOrRenderContractPdf`에는 상태 게이트가 없어 막는 곳이 정확히 이 두 핸들러뿐이다. `retention.ts:65`는 `terminatedAt + 3년` 뒤에 파기하므로 "보관 중인데 아무도 못 받는" 창이 정확히 그 3년이다.

④ 종료 처리를 누르는 순간: 고객은 완료 메일 링크에서 "내려받을 수 있습니다" 문구 아래 버튼을 누르면 "서명이 완료된 뒤에 받으실 수 있습니다"라는 모순된 409를 받는다. 운영자는 관리자 상세·목록에서 PDF 버튼 자체가 사라진다. 제12조 ④가 3년 보관을 약속한 서명본을 위약금 청구(제5조 ③)·분쟁 시점에 꺼내지 못한다. `tests/api/contracts/download.test.ts:245`('sent')·`id-pdf.test.ts:118`('draft')·purged 케이스만 있고 terminated 케이스가 없어 CI가 못 잡는다.

⑤ **수정**:
- `lib/contracts/status.ts`에 추가:
  ```ts
  export const hasSignedDocument = (c: { status: ContractStatus; signedAt: Date | null }) =>
    c.signedAt !== null && (c.status === 'signed' || c.status === 'terminated');
  ```
  `contracts.signedAt`은 `sign-transaction.ts:81·119`에서 서명 트랜잭션이 항상 채우므로 `signedAt !== null` 조건은 안전하다.
- `download.ts:69`, `pdf.ts:58`의 `if (contract.status !== 'signed')`를 `if (!hasSignedDocument(contract))`로 교체. `purgedAt` 가드는 그대로 둔다.
- `pages/admin/contracts/[id]/index.tsx:574`, `pages/admin/contracts/index.tsx:417`의 조건을 `['signed','terminated'].includes(contract.status) && !contract.purgedAt`로. `[id]/index.tsx:319` "서명본 PDF가 보관되지 않았습니다" 경고도 terminated를 포함.
- 회귀 테스트: `tests/api/contracts/download.test.ts`·`id-pdf.test.ts`에 `status: 'terminated'` 200 케이스, `lib/contracts/status.test.ts`에 `hasSignedDocument` 표 테스트(signed/terminated/sent/draft × signedAt null 여부).

⑥ 같은 자리를 다른 축(SEC 인증·권한·입력 검증·헤더)도 지적: "종료(terminated)된 계약은 고객 다운로드·관리자 PDF가 409다 (완료 화면은 내려받을 수 있다고 안내)".

#### CON-2. 서명 화면 본문은 생년월일·주소가 빈 칸이고 계약일이 초안 작성일이다 — 서명일로 바뀐다는 고지가 없다 [P2 · M]

① `pages/[locale]/contracts/[id]/sign.tsx:612`·`:150`·`:643`·`:764`, `lib/contracts/template.ts:46·48`, `lib/contracts/service.ts:165`·`:274`·`:569`, `pages/api/contracts/[id]/sign.ts:189-194`, `lib/contracts/contract-template.md:26·28·259`

② 서명자가 읽는 본문은 `sign.tsx:612 <ContractContent content={contract.content} />`이고, 그 content는 props 150행 `maskIdentityDigitsInContent(contract.content, contract.customerPhone)` — 초안 때 굳은 `contracts.content`다. `createContract`(`service.ts:165`)와 `updateDraftContract`(`:274`)는 `contractDate: new Date().toISOString()`과 `customerBirthdate: undefined`로 본문을 만들고, `template.ts:46·48`은 undefined를 `''`로 치환하므로 템플릿 26행 `| 생년월일 | {{customerBirthdate}} |`·28행 주소 칸이 빈 셀로 보인다. 서명 때는 `sign.ts:189-194`가 서명자 입력값과 `contractDate: signedAt.toISOString()`(`service.ts:569`)으로 본문을 **다시 만들어** 그 본문을 해시·저장한다.

③ 화면 본문과 서명 본문의 차이는 정확히 세 값이다 — 서명자가 직접 친 생년월일·주소, 그리고 서명 순간의 날짜. 앞의 둘은 `sign.tsx:643` "아래 두 항목은 계약서에 그대로 기재됩니다"와 `:425` 제출 오류 문구가 고지한다. 계약일이 서명일로 바뀐다는 말만 어디에도 없다. 계약일은 템플릿 259행 서명란(`**계약일**: {{contractDate}}`) 한 곳에만 쓰이고, 제3조 갱신은 이용 기간(startDate/endDate), 납부일은 `paymentDay` 기준이라 의무·금전 조항에는 영향이 없다. 이 설계는 커밋 `1496259568`이 의도적으로 택했고("계약일은 초안 작성일이 아니라 서명한 날", 테스트로 고정) 2026-09-01 법적 감사도 유효 판정을 냈다.

④ 분쟁에서 "내가 읽은 것과 다르다"는 주장이 나오면, 반박이 "세 값은 본인이 적었거나 서명 순간의 날짜"라는 설명에 의존한다. 서명 직전에 완성본을 보여 줬다는 기록은 없다. 증거력 보강 사안이지 운영 사고나 약속 파기는 아니다.

⑤ **수정** (가벼운 쪽으로):
- (a) `lib/contracts/template.ts` `buildContractContent`에서 `customerBirthdate`/`customerAddress`가 undefined면 `''` 대신 `'(서명 시 본인 기재)'`를, `contractDate`가 undefined/`''`이면 `'(서명일에 기재)'`를 넣는다. `formatDate` 폴백 `'-'`를 피하도록 `contractDate` 분기만 따로 둔다. `createContract`/`updateDraftContract`는 `contractDate`를 넘기지 않게 바꾼다. `1496259568`이 넣은 "발송 시점 본문에는 두 칸이 비어 있다" 테스트와 `template.test.ts`를 새 문구로 갱신.
- (b) `sign.tsx` 이용자 정보 안내문(643행 부근)에 한 문장: "계약일은 서명하시는 날짜로 기재됩니다."
- (c) 선택: 본인확인 체크 문구(`sign.tsx:764`)에 "아래 입력한 정보와 서명일이 계약서에 기재되는 데 동의"를 붙여 동의 범위를 문서화.
- preview API·완성본 모달·KST 날짜 409 재확인은 만들지 않는다 — 실계약 수 건 규모에 비해 무겁다.

⑥ 검증자 조정: 원 지적의 "계약일이 월 이용료·자동 갱신 기산에 쓰인다"는 템플릿에 근거가 없고("계약일"은 259행 서명란뿐), "화면 어디에도 안내가 없다"는 두 칸에 대해서는 틀렸다. 고지가 빠진 것은 계약일 하나다.

#### CON-3. 제12조 ③이 약속한 '브라우저·기기 정보' 기재가 서명본·감사추적에 없다 — 조항 도입 때부터 [P2 · M]

① `lib/contracts/pdf-html.ts:128`·`:177-182`, `lib/contracts/contract-template.md:197-205`, `lib/contracts/audit-trail.ts:166-169`, `lib/contracts/integrity.ts`, `lib/contracts/sign-transaction.ts:84`, `lib/contracts/retention.ts:138`

② 템플릿 제12조 ②-2는 "서명 일시, 서명 시 접속한 IP 주소, 접속에 사용한 브라우저·기기 정보"를 수집 항목으로, ③은 "제2항의 정보는 서명본 계약서에 함께 기재되며"를 약속한다. 그런데 PDF 서명란은 네 줄뿐이다.

```ts
// pdf-html.ts:177-182
서명자: ${escapeHtml(signature.signerName)}<br />
이메일: ${escapeHtml(signature.signerEmail)}<br />
서명 일시: ${formatDateTime(signature.signedAt)}<br />
IP 주소: ${escapeHtml(signature.ipAddress || '-')}
```

매개변수 `signature: Signature | null`(128행)에 `userAgent`가 있는데 쓰지 않는다. `audit-trail.ts:166-169` '전자서명 완료' detail도 이름+IP뿐이고, `integrity.ts` canonical form에는 `signerIp`만 있다. UA는 `sign-transaction.ts:84`로 `signatures.user_agent`에 저장되고 `retention.ts:138`에서 파기될 뿐이다. 이 조항을 넣은 `f4a34a66c3`의 메시지는 "브라우저 정보까지 수집해 계약서에 인쇄"라고 적었지만 그 시점의 pdf-html.ts에도 userAgent가 없었다.

③ 서명본 문면과 제12조 ③이 어긋난다. ②(수집·보관)는 DB로 충족되므로 고객 권리·돈·데이터 영향은 없고, 분쟁 시 UA를 지문 밖 DB 값으로만 제시하게 되는 증거력 문제다. 이 저장소의 지문 원칙은 "계약서에 인쇄되는 것 전부"(`f4a34a66c3`)라 인쇄 안 되니 지문에도 없는 것이고, 인쇄하기로 하면 지문에도 같이 넣는 것이 그 원칙이다.

④ 모든 서명본 PDF에서 재현된다. 2026-08-25 실계약 1건부터 지금까지 발급된 PDF 전부 UA가 없다.

⑤ **수정**:
- (1) `pdf-html.ts` `signatureHtml`에 한 줄 추가: `브라우저·기기: ${escapeHtml((signature.userAgent ?? '-').slice(0, 200))}`. `audit-trail.ts` '전자서명 완료' detail에 UA 추가. `pdf-html.test.ts`에 인쇄·HTML 이스케이프 단언.
- (2) `integrity.ts`에 `'v5'`를 `CANONICAL_BUILDERS`에 더하고 canonical에 `sized('signerUserAgent', ...)`를 넣는다. `FingerprintSigner`에 `userAgent` 추가. v3/v4 빌더는 그대로(기존 계약 검증 유지). `sign.ts`와 `audit-trail.ts` `verifyFingerprint`의 signer 객체에 UA를 함께 넘긴다. **agreedAt은 넣지 않는다** — `integrity.ts:213-215`와 `buildFingerprintInput` 주석이 "서명과 같은 트랜잭션이라 signedAt이 덮는다"고 명시적으로 배제한 결정이다.
- (3) 템플릿 ③ 문구는 바꾸지 않는다 — 인쇄하면 조항이 참이 되고, CLAUDE.md의 "서명 대기 중 `contract-template.md` 수정 금지" 제약도 피한다. 이미 발급된 PDF는 `loadOrRenderContractPdf`가 보관본을 그대로 주므로 UA 없는 채로 남는다 — 건수가 적어 그대로 둔다.

⑥ 검증자 조정: 원 지적 P1을 P2로 — 어긋난 것은 ③의 "기재" 한 줄이고 UA는 운영자 측 증거지 고객이 받을 권리가 아니다.

#### CON-4. 서명자·관리자 입력의 `{{specialTerms}}` 등 플레이스홀더가 순차 치환에 걸려 서명 본문 구조를 바꾼다 [P2 · S]

① `lib/contracts/template.ts:61-71`, `lib/contracts/html-escape.ts:32-40`, `lib/contracts/validation.ts:119-135`·`:311-327`, `lib/contracts/template.test.ts`

② 치환은 두 단계다 — 일반 필드를 `Object.entries` 순서로 순차 `replaceAll`한 뒤 특약을 따로 치환한다.

```ts
// template.ts:61-63
for (const [placeholder, value] of Object.entries(replacements)) {
  content = content.replaceAll(placeholder, () => value);
}
// :71
content = content.replace('{{specialTerms}}', () => termsRows || '| 1 | |\n| 2 | |\n| 3 | |');
```

`escapeTableCell`(html-escape.ts:32-40)은 파이프·개행·꺾쇠만 막고 중괄호는 건드리지 않는다. `CONTROL_CHARS`(validation.ts:130, 322)도 마찬가지다. 주소(템플릿 28행)가 특약 자리(245행)보다 앞에 있어, 주소에 든 `{{specialTerms}}`가 먼저 치환된다.

③ 치환값이 다시 해석된다. 법적 문서의 조립 결과가 입력 문자열에 의존하고, 그 본문이 그대로 `contentHash`에 묶인다(`sign.ts:178`). `$'` 주입을 이미 보안 수정으로 다룬 같은 종류다(template.ts:56-60 주석). 기존 `template.test.ts`는 `$&`·파이프·태그만 다루고 `{{` 케이스가 없다.

④ 재현(읽기 전용 tsx 실행으로 확인): `customerAddress='서울 {{specialTerms}} 끝'`, `specialTerms=['특약 하나']`를 `buildContractContent`에 넣으면 주소 행이 `| 주소 | 서울 | 1 | 특약 하나 | 끝 |`(5칸)이 되고 제14조 자리에는 리터럴 `{{specialTerms}}`가 남는다. markdown-to-jsx 렌더에서 제14조는 `<p>| 번호 | 특약 내용 |</p><p>{{specialTerms}}</p>`로 표가 깨지고 특약은 주소 행의 여분 칸으로 옮겨 간다. 고객 이름에 `{{contractDate}} {{roomNumber}}`를 넣으면 `홍길동 2026년 10월 10일 101`로 재치환된다. 주소는 서명자 입력, 이름·특약은 관리자 입력이다.

⑤ **수정**: `template.ts`를 단일 패스 치환으로 바꾼다.

```ts
const values: Record<string, string> = {
  ...replacementsWithoutBraces, // '{{customerName}}' → 'customerName' 키로
  specialTerms: termsRows || '| 1 | |\n| 2 | |\n| 3 | |',
};
return template.replace(/\{\{(\w+)\}\}/g, (m, k) =>
  Object.prototype.hasOwnProperty.call(values, k) ? values[k] : m);
```

치환값 안의 `{{`는 다시 해석되지 않고, 알 수 없는 토큰은 그대로 남아 이전 동작과 같다. 선택(중복 방어): `validation.ts` `readString`(119-135)과 `validateSignerDetails`의 `read`(311-327)에서 `/\{\{|\}\}/` 포함 입력을 거부. 회귀 테스트: `template.test.ts`에 주소·이름·특약에 `{{specialTerms}}`·`{{contractDate}}`를 넣어도 출력에 `{{`가 남지 않고 표 칸 수가 유지되는 케이스 추가.

⑥ 검증자가 재현으로 확인(confirmed).

#### CON-5. 완료 메일 재발송이 서명 당시 보관 PDF를 새 렌더로 덮어쓴다 — PR #460 스쿼시가 `c5bd4ad154`의 수정을 되돌림 [P2 · S]

① `lib/contracts/finalize.ts:43-61`, `pages/api/contracts/[id].ts:148-149`, `lib/contracts/pdf-storage.ts:18`·`:31-33`, `lib/contracts/pdf-html.ts:71-76`

② resend-signed 분기는 `finalizeSignedContract`를 그대로 다시 돌린다.

```ts
// [id].ts:148-149
const { finalizeSignedContract } = await import('../../../lib/contracts/finalize');
waitUntil(finalizeSignedContract(id));
```

HEAD의 `finalize.ts:46-59`는 보관본 유무와 무관하게 항상 `generateContractPdf` → `uploadContractPdf`(`allowOverwrite: true`, pdf-storage.ts:18) → `pdfUrl`/`pdfGeneratedAt` 갱신을 한다. `pdf-storage.ts:31-33` 주석은 "서명 당시 발급한 문서를 그대로 주는 것이 원칙이다"라고 적는다. 날인 이미지는 렌더 시점의 `CONTRACT_SEAL_BASE64`로 만들어지며 환경변수가 없으면 날인 없이 발행하고 계속 진행한다(pdf-html.ts:71-76).

③ 이 덮어쓰기는 원래 고쳐져 있었다. `c5bd4ad154`(2026-10-03 23:21) 8번 항목이 "pdfUrl이 있으면 `readStoredContractPdf`로 보관본을 그대로 첨부하고 업로드하지 않는다"로 고쳤는데, 20분 뒤 `7868515e1f`(PR #460 스쿼시)가 그 커밋의 계약 관련 파일 38개를 되돌렸고 복구 커밋이 없다(`git log -S readStoredContractPdf`: `c5bd4ad154`, `c298417e05`, `7868515e1f`뿐). 같은 되돌림으로 함께 사라진 것: 서명 트랜잭션의 `notifiedAt` 초기화(헬스체크 '서명 후 후처리 기록 없음' 점검이 사실상 죽음 — CON-13), `notification-error.ts`의 운영자 전용 실패 구분, 호실 비교 키 `roomComparisonKey`('2호-1' 충돌 누락 복원), send 거절 사유 안내 `explainSendRejection`, `form-values.ts`의 생년월일·주소 제외(복제·수정 화면 `__NEXT_DATA__` 유출 재발 — CON-7 참조), 서명 이미지 한국어 문구와 캔버스 배율 제한, `backup.ts` 사본 표(CON-8), `finalize.test.ts`·`backup.test.ts`(CON-10).

④ 관리자가 "완료 메일 다시 보내기"를 한 번 누르면: 폰트·날인 환경변수·코드가 서명 때와 달라진 상태라면 보관 PDF가 다른 문서로 바뀐다. 날인이 빠진 PDF가 보관본이 될 수도 있다. (파기된 계약 관련 주장은 해당 없음 — 파기는 expired/cancelled/terminated만 대상이고 signed는 제외하며(retention.ts:69-92) resend-signed는 signed에서만 허용돼(status.ts:40) `purgedAt`이 있는 signed 계약은 정상 흐름에서 존재할 수 없다.)

⑤ **수정**: 새로 짜지 말고 `c5bd4ad154`를 되살린다. 별도 브랜치에서 `git cherry-pick c5bd4ad154` 후 충돌하는 `lib/ops/healthCheck.ts`만 수작업으로 합친다(그 사이 healthCheck에 들어온 토스 키 점검 등 변경 보존). `finalize.test.ts`·`notification-error.ts`·`sign-transaction`·`form-values`·`service`·`validation` 변경이 함께 돌아온다. 복구판은 `pdfUrl`이 있으면 `readStoredContractPdf`로 보관본을 첨부하고 업로드하지 않으며, 없을 때만 렌더·업로드한다. 재발 방지: 장기 브랜치(shows 같은)는 병합 전에 병합 결과의 diff가 자기 변경만 담는지 확인한다 — `git diff origin/main...branch`가 아니라 병합 커밋 자체의 `--stat`을 본다.

⑥ 검증자 조정: 원인이 지적이 짐작한 것보다 구조적(스쿼시 회귀)이고, 파기 계약 관련 둘째 주장은 틀렸다.

#### CON-6. 서버가 빈(전 픽셀 투명) 서명 PNG와 IDAT이 없는 깨진 PNG를 유효한 서명으로 받는다 [P2 · M]

① `lib/contracts/signature-validation.ts:47-112`, `lib/contracts/signature-validation.test.ts:26-30`, `pages/api/contracts/[id]/sign.ts:65-72`, `pages/[locale]/contracts/[id]/sign.tsx:31·399·440`

② 서버 검증은 접두사·base64·크기(`MIN_BYTES=100`)·PNG 매직·IHDR·IEND만 본다. 획이 있는지는 클라이언트만 본다 — `sign.tsx:31 const MIN_STROKE_POINTS = 12;`, `:399 if (pointCountRef.current >= MIN_STROKE_POINTS && !hasSigned)`, `:440 if (!hasSigned) { setSubmitError('서명을 완료해 주세요.')`. `sign.ts:65-72`는 `validateSignatureData` 통과만 요구한다. 캔버스에 배경 채우기(`fillRect`)가 없어 빈 서명은 전 픽셀 투명이다.

③ 파일 상단 주석이 스스로 막으려던 결과를 못 막는다. 기존 테스트의 "정상 PNG" 픽스처(test.ts:26-30)는 매직+IHDR+0x42 채움+IEND이고 IDAT이 없는데도 통과한다 — 즉 깨진 PNG도 받아 PDF에 깨진 이미지가 찍힐 수 있다.

④ 검증자가 재현: 600x200 완전 투명 RGBA PNG(545바이트, zlib으로 생성)를 `validateSignatureData`에 넣으면 `{ok:true}`. 악용에는 토큰·본인확인 뒷자리·동의 체크가 모두 필요하고 서명자 본인이 서버를 직접 호출해야 해서 확률은 낮지만, 그 경우 서명 그림이 없는 "서명 완료" 계약이 만들어진다.

⑤ **수정**: `validateSignatureData` 끝에서
- IHDR의 colorType 6·bitDepth 8·비인터레이스인지 확인(아니면 거부),
- IDAT 청크가 있는지 확인(없으면 거부),
- IDAT을 이어 붙여 `zlib.inflateSync(buf, { maxOutputLength: height * (width * 4 + 1) + 1024 })`로 푼 뒤, 행마다 맨 앞 필터 바이트 1개를 빼고 0이 아닌 바이트 개수를 센다. 모든 픽셀이 0인 이미지는 어떤 PNG 필터를 거쳐도 0이므로 언필터 없이 빈 이미지를 판별할 수 있다. 임계(예: 200) 미만이면 `'서명이 비어 있습니다. 다시 그려 주세요.'`로 거부.
- 기존 테스트 픽스처를 실제 zlib PNG로 바꾸고, 투명 PNG 거부·실제 획 PNG 통과·IDAT 없음 거부 케이스를 추가.

⑥ 검증자 조정: 원 수정안의 "알파 값을 직접 센다"는 IDAT이 필터링된 데이터라 불가능 — 위처럼 비영 바이트 수로 판별한다.

#### CON-7. 관리자 목록 응답·SSR props가 전 계약의 본문·생년월일·주소를 실어 보내 접속기록 정책을 우회하고 페이로드가 수 MB다 [P2 · S]

① `lib/contracts/serialize.ts:26-49`, `pages/admin/contracts/index.tsx:81-86`, `pages/api/contracts/index.ts:29-32`, `db/schema.ts:1427`

② `serializeContract`는 `signToken`만 빼고 `...rest`로 `content`·`customerBirthdate`·`customerAddress`·`firstViewedIp`·`specialTerms`·`notificationError`를 전부 직렬화한다. 관리자 목록 SSR은 `contracts: allContracts.slice(0, LIST_LIMIT).map((c) => serializeContractForAdmin(c))`(`LIST_LIMIT=200`), `GET /api/contracts`도 같은 직렬화다. 목록 화면이 실제로 쓰는 필드는 `id`·`status`·`customerName/Email/Phone`·`roomNumber`·기간·`monthlyRent`·`expiresAt`·`signedAt`·`signUrl`·`purgedAt`·`notificationError`뿐이다.

③ `db/schema.ts:1427`은 목록 화면이 접속기록을 남기지 않는 근거를 "상세를 열어야 전체 개인정보가 보인다"로 적었는데 페이로드는 그렇지 않다. `contract_view` 접속기록(처리방침 19항)은 상세에서만 남으므로, 세션 하나로 접속기록 없이 `__NEXT_DATA__` 또는 GET 한 번에 최대 200건의 완성 계약 본문(이름·생년월일·연락처·주소)을 읽을 수 있다. 저장소는 같은 종류를 이미 결함으로 취급했다 — `accessLog.ts`는 "배송 목록 화면은 표 전체를 props로 실어 보내므로 노출 범위가 CSV와 같다"고 적었고, 복제 폼의 생년월일·주소 `__NEXT_DATA__` 유출도 `c5bd4ad154` 6번에서 고쳤다(그 수정도 HEAD에서 되돌려져 있다, CON-5). `GET /api/contracts`는 호출하는 화면이 없다(`new.tsx`는 POST만). 계약당 본문 21,365바이트라 200건이면 약 4MB.

④ 관리자 계정 하나가 유출되면 로그인 직후 한 번의 요청으로 전체가 나간다 — 이전 리뷰 `docs/code-review-2026-08-24.md` #5가 지적한 시나리오 그대로다. 현재 3건이라 용량 문제는 작고 접속기록 우회가 실질 문제다.

⑤ **수정**: `serialize.ts`에 `serializeContractForAdminList`를 **허용 목록(Pick)**으로 추가한다 — 제외 목록이 아니라 Pick으로 만들어 새 컬럼이 기본적으로 새지 않게 한다. 위 목록 화면 사용 필드만 담는다. `pages/admin/contracts/index.tsx:81`과 `pages/api/contracts/index.ts:31`에서 사용. 쓰지 않는 `GET /api/contracts`는 삭제하거나, 남긴다면 `recordAdminPrivacyAccess`로 접속기록을 남긴다. 회귀 테스트: `tests/api/contracts/index.test.ts`에 응답 JSON에 `customerBirthdate`·`customerAddress`·`content` 키가 없다는 단언.

⑥ 검증자 확인(confirmed). 같은 자리를 다른 축(PRV 개인정보·처리방침 정합·로그)도 지적: "계약 목록 직렬화는 목록 UI가 쓰는 열만 — 생년월일·주소·본문은 상세(접속기록 대상)에서만 나간다".

#### CON-8. HEAD 백업이 템플릿 사본 표를 담지 않는다 — `c5bd4ad154`가 넣은 것을 `7868515e1f`(PR #460)가 되돌렸다 [P2 · M]

① `lib/contracts/backup.ts:35-84`, `vercel.json`(크론 `0 17 * * 0`), `lib/contracts/template-snapshot.ts`, `docs/연습실계약/전자계약-시스템-설계.md` §10

② `backup.ts:36-38 query.contracts.findMany({ with: { signatures, contractClauses, contractAttachments } })`에 `contractTemplateSnapshots`가 없고, 61행 `JSON.stringify({ exportedAt, contracts: sanitized }, null, 2)`로 끝난다. 크론은 주 1회, 보관 28일이라 시점 4개. `c5bd4ad154`(PR #458)는 `loadTemplateSnapshotsForBackup`으로 사본 표(원문은 해시별 1회)를 백업에 담고 `backup.test.ts`(80줄)로 고정했는데, 19분 뒤 `7868515e1f`가 `backup.ts`·`backup.test.ts`·`finalize.ts`·`finalize.test.ts`·`notification-error.ts`·`pdf-storage.ts` 등을 통계까지 정확히 반대로 되돌렸다(`git show --stat` 대조). HEAD에서 `collectContractHygieneIssues`·`readStoredContractPdf`·`NOTIFICATION_ERROR_SEPARATOR`·`roomComparisonKey`·`explainSendRejection` grep 결과 0건.

③ 사본 없이 DB를 복구하면 서명 대기 계약의 본문이 서명 순간 **현재 템플릿 파일**로 완성되어 0046이 막으려던 상태("읽은 조항 ≠ 서명 조항")로 돌아간다. 의도해서 넣은 보호와 그 테스트가 조용히 사라진 상태다.

④ 발현 조건은 좁다 — DB 전손 ∧ 서명 대기 계약 존재 ∧ 생성 뒤 템플릿 변경. 설계 문서 §10에 복구 절차는 있으나 사본 복원 단계가 없고 복원 스크립트·테스트도 없다.

⑤ **수정**: 새로 짜지 말고 `c5bd4ad154`의 `lib/contracts/backup.ts`·`backup.test.ts`를 복원한다(사본 표 읽기 실패는 백업 전체를 막지 않고 `null`로 기록, 서명 토큰 제외 단언 포함). CON-5의 cherry-pick과 한 묶음이다 — `git diff c5bd4ad154 HEAD -- lib/contracts lib/ops pages/api/contracts pages/admin/contracts`로 이후 정당한 변경(email 공용 레이아웃, healthCheck 토스 키 등)과의 충돌을 가린다. 설계 문서 §10 복구 절차에 "사본 복원" 단계를 추가. gzip·일 1회 크론·복원 dry-run 스크립트·크론 내 지문 검증은 하지 않는다 — RPO는 운영자 결정이고 과설계다.

⑥ 검증자 조정: 새 결함이 아니라 회귀. 같은 자리를 다른 축도 지적 — DB(DB 스키마·마이그레이션·쿼리): "원장(주문·결제·환불·후원·구독)의 백업이 없고 Turso 무료 플랜 PITR은 1일이다 — 하루 넘겨 발견한 사고는 복구 불가"; TST(테스트·CI·빌드 파이프라인): "계약 백업·고아 PDF 삭제(backup.ts)와 서명 후처리(finalize.ts)가 무테스트".

#### CON-9. `[id].ts`의 resend-signed가 Chromium 후처리를 `waitUntil`로 돌리는데 `maxDuration`이 없다 [P2 · S]

① `pages/api/contracts/[id].ts:148-149`, 비교 대상 `pages/api/contracts/[id]/sign.ts:21`, `pdf.ts:21`, `download.ts:32`, `lib/payments/methodAlert.ts:34`, `lib/ops/healthCheck.ts:278-333`

② `[id].ts`에는 `export const config = { maxDuration }`이 없다. 형제 라우트 `sign.ts:21`·`pdf.ts:21`·`download.ts:32`는 모두 `export const config = { maxDuration: 60 };`와 "콜드 스타트에서 Chromium 해제 시간" 주석을 갖는다. `methodAlert.ts:34`는 `vercel.json`에 functions 설정이 없어 계정 기본값으로 돈다고 적는다 — 저장소 전제는 기본값이 짧다는 쪽이다.

③ resend-signed 분기가 PDF 렌더(Chromium)·업로드·메일을 `waitUntil`로 처리하는데 이 라우트만 실행 시간 상한을 명시하지 않았다. 중단돼도 `notifiedAt`이 이미 있어 `healthCheck.ts:278-333`('notifiedAt IS NULL인 서명 건')이 못 잡는다. HEAD의 finalize는 보관본이 있어도 항상 Chromium으로 렌더한다(CON-5 회귀) — 복원되면 재발송은 Chromium을 안 띄워 위험이 줄지만 보관본을 못 읽는 경우는 여전히 렌더한다.

④ 관리자가 "완료 메일 다시 보내기"를 누르면 "다시 보내는 중입니다"가 뜨고 실제로는 안 나갈 수 있다. 중단은 로그 외에 흔적이 없다. 실제 중단 여부는 계정 기본값(Vercel 플랜·Fluid 여부)에 달려 코드에서는 확인할 수 없다.

⑤ **수정**: `pages/api/contracts/[id].ts`에 `export const config = { maxDuration: 60 };`를 `sign.ts`와 같은 취지의 주석과 함께 추가. `purge-contracts.ts`에는 넣지 않는다 — 월 1회, 대상 몇 건, 건당 del 1회+batch 1회, 멱등이라 다음 달에 이어진다.

⑥ 검증자 조정: purge-contracts 부분은 근거가 약해 제외.

#### CON-10. 서명 라우트 배선·backup·finalize에 테스트가 없다 — finalize·backup 테스트는 `7868515e1f`가 지웠다 [P2 · M]

① `pages/api/contracts/[id]/sign.ts`(전체), `lib/contracts/finalize.ts`, `lib/contracts/backup.ts`, `lib/contracts/pdf-storage.ts`, `pages/api/cron/backup-contracts.ts`, `pages/api/cron/purge-contracts.ts`, `tests/api/contracts/`, `tests/api/cron/`

② `tests/api/contracts`에는 `download.test.ts`·`id.test.ts`·`id-pdf.test.ts`·`index.test.ts`만 있고 `sign.test.ts`가 없다. `tests/api/cron`에는 `purgeFunding.test.ts`·`purgeOrders.test.ts`뿐이다. `grep (backupContracts|finalizeSignedContract|loadOrRenderContractPdf)`에서 테스트는 download/id-pdf의 mock뿐이다. `finalize.test.ts`(141줄)와 `backup.test.ts`(80줄)는 `c5bd4ad154`에 있었는데 `7868515e1f`가 지웠다.

③ 서명 흐름의 부품은 단위 테스트가 있다 — `identity-attempt.test.ts`(실제 SQLite로 창·누적 잠금), `sign-transaction.test.ts`(조건부 UPDATE·경합), `service.test.ts`(사본으로 본문 완성), `signature-validation`·`signer-details`·`integrity` 테스트, `retention.test.ts`(purge 삭제 본체). 비어 있는 것은 **라우트 배선**(본인확인 순서, 동의 서버 검증, 사본 템플릿 전달, 경합 409, `waitUntil` 1회)과 backup/finalize/pdf-storage다. 이전 리뷰 `docs/code-review-2026-08-24.md` #3이 같은 지적(라우트 5개·cron 3개 무테스트)이고 download/id/pdf/index만 해소됐다.

④ 서명 라우트 리팩터링이나 backup 삭제 로직 변경이 라우트 수준에서 걸리지 않는다. 부품 테스트가 있으므로 "사람 눈에만 의존"은 아니다.

⑤ **수정** (우선순위 순):
1. `c5bd4ad154`의 `backup.test.ts`·`finalize.test.ts` 복원 — CON-5 cherry-pick과 한 묶음.
2. `tests/api/contracts/sign.test.ts` 신규 — `id.test.ts`의 mock 패턴으로: 잠금/제한 429, 체크박스 누락 400, 사본 템플릿이 `buildSignedContractContent`에 전달되는지, `rowsAffected` 0일 때 상태별 409, 성공 시 `waitUntil(finalizeSignedContract)` 1회·`resetIdentityAttempts` 호출.
3. `pdf-storage` 폴백(get 실패 시 재렌더) 케이스.
크론 라우트 테스트는 backup 실패 메일 분기 정도만.

⑥ 검증자 조정: 원 지적의 "항목 1·4·5·6·15" 참조는 근거 없음, 크론 2개·pdf-storage 전부 쓰자는 목록은 과함.

#### CON-11. 계약서 본문은 월 이용료가 '부가세 별도'인데 PDF 요약표와 모든 계약 메일은 부가세 언급 없이 금액만 강조한다 [P2 · S]

① `lib/contracts/email.ts:15-22`·`:56`·`:109`·`:170`, `lib/contracts/pdf-html.ts:285`, `pages/[locale]/contracts/[id]/complete.tsx:261-264`, `lib/contracts/contract-template.md:43·59`, `lib/billing/amounts.ts:29`

② 템플릿 43행 `| 월 이용료 | 금 {{monthlyRent}} 원 (부가세 별도) |`, 59행 `① 을은 월 이용료(부가세 별도)를 ...`. 연습실 월 이용료는 공급가다 — `lib/billing/amounts.ts:29` "표기액이 VAT 별도, 청구는 포함액 360,000 -> 396,000"(2026-10-01 운영자 확정), `common.json` priceNote도 "부가세 별도". 그런데 요약 표시는 전부 금액만이다.

```ts
// email.ts:19 (서명 요청·완료·운영자 메일 공용 contractRows)
{ label: '월 이용료', value: `${formatCurrency(contract.monthlyRent)}원`, emphasis: true },
// pdf-html.ts:285 (서명본 PDF 계약 요약표)
<tr><th>월 이용료</th><td>${formatCurrency(contract.monthlyRent)}원 (매월 ${contract.paymentDay}일 선불)</td></tr>
```

text 본문 56·109·170행과 `complete.tsx:261-264`도 같다. "(부가세 별도)"는 9/9 빌링 도입 때 템플릿에만 들어갔고 요약 표시는 따라오지 않았다.

③ 서명 요청 메일은 "링크를 누르기 전에 확인할 수 있어야 한다"(email.ts:15)고 계약 조건을 요약하면서 가장 큰 조건을 빠뜨린다. 같은 서명본 PDF 안에서도 요약표(부가세 없음)와 본문(부가세 별도)이 다르게 말한다. `validation.ts`는 보증금=월 이용료 일치까지 강제하며 금액 불일치를 경계하는데 부가세 표기는 같은 기준에서 빠져 있다. 완화 요소: 서명 화면 본문에 "부가세 별도"가 두 번 있어 계약상 고지는 된다.

④ 고객이 메일·요약표의 "360,000원"을 총액으로 이해한 뒤 396,000원이 청구되면 "말과 다르다"는 분쟁이 된다 — 소비자 분쟁에서 요약 표시가 본문보다 우선 읽히는 경향.

⑤ **수정**: 다섯 곳에 `(부가세 별도)`를 붙인다 — `email.ts:19` contractRows, text 56·109행(운영자 알림 170행은 선택), `pdf-html.ts:285`, `complete.tsx` 월 이용료 dd. 헬퍼 함수까지는 필요 없다. 회귀 테스트: email/pdf-html 테스트에 '부가세 별도' 포함 단언.

⑥ 검증자 확인(confirmed). 원 수정안의 대안 분기("운영자 결정이 부가세 포함이라면 템플릿 정정")는 이미 '별도'로 확정돼 해당 없음.

#### CON-12. 템플릿 사본 저장·읽기 실패가 로그 한 줄로만 남는다 — 0046 적용 완료 후 best-effort 근거 소멸 [P3 · M]

① `lib/contracts/service.ts:234-235`·`:322-326`, `lib/contracts/template-snapshot.ts:29-32`·`:40-45`, `pages/api/contracts/[id]/sign.ts:179-184`, `lib/contracts/service.test.ts:385-391`

② `createContract`(235)와 `updateDraftContract`(326)는 본문 저장과 별도 호출로 `await saveTemplateSnapshot(contractId, template);`를 하고 반환값(실패 시 `false`)을 무시한다. `template-snapshot.ts:40-45` 읽기는 '행 없음'과 'DB 오류'를 둘 다 `null`로 돌려주고, `sign.ts:179-184 buildSignedContractContent(..., await loadTemplateSnapshot(contract.id))`는 `null`이면 현재 파일로 서명 본문을 만든다.

③ 수정 경로에서 사본 저장만 실패하면 `contracts.content`는 새 판본, 사본은 옛 판본인 채 남는다. 읽기가 DB 오류를 삼키면 서명이 조용히 현재 파일로 완성된다. 이 느슨함은 배포 순서 때문에 일부러 둔 설계이고(CLAUDE.md 0046 절), 0046은 이미 적용돼 있다(`__drizzle_migrations` 52행 = 저널 52).

④ 발현에는 두 번째 DB 호출만 실패하는 우연에 더해 서명 전에 템플릿 파일이 바뀌어야 한다. 운영 DB의 계약 3건은 모두 0046 이전 계약이라 사본이 0건이다. 가능성 매우 낮음.

⑤ **수정**:
1. `createContract`는 batch 배열에 사본 insert를 넣어 원자화한다(0046 적용돼 안전).
2. `updateDraftContract`는 사본 upsert를 batch에 넣되, 단순 `onConflictDoUpdate`는 비초안 계약의 사본을 덮고 계약 UPDATE가 0행이어도 batch는 롤백되지 않으므로, `INSERT ... SELECT ... WHERE EXISTS(SELECT 1 FROM contracts WHERE id=? AND status='draft')` 형태로 초안 조건을 SQL 안에 건다.
3. `loadTemplateSnapshot`은 'no such table'일 때만 `null`을 유지하고(`service.test.ts:385-391` "표가 없어도 던지지 않는다" 보존) 그 밖의 DB 오류는 던져 `sign.ts`의 catch가 재시도를 안내하게 한다.
4. CLAUDE.md "사본 저장이 실패해도 막지 않는다" 문구를 고치고, 복구판 `collectContractHygieneIssues`(CON-5 복원 뒤)에 "0046 이후 만든 draft/sent 계약인데 사본 없음" 경고를 더한다.

⑥ 검증자 조정: 심각도 하향. 원 제안의 단순 throw는 `service.test.ts:385`와 충돌, 단순 upsert는 초안 조건 함정.

#### CON-13. PDF 업로드·pdfUrl 기록 실패가 notificationError·헬스체크에 남지 않는다 [P3 · S]

① `lib/contracts/finalize.ts:43-67`, `lib/ops/healthCheck.ts:314-335`, `pages/admin/contracts/[id]/index.tsx:319-324`

② 렌더·업로드·DB 기록이 한 try 안에 있고, 실패 판정은 `pdfBuffer` 유무만 본다.

```ts
// finalize.ts:46-67
pdfBuffer = await generateContractPdf({...});
const pdfUrl = await uploadContractPdf(contract.id, pdfBuffer);
await getDb().update(contracts).set({ pdfUrl, pdfGeneratedAt: new Date(), ... });
} catch (error) {
  console.error('[contracts/finalize] Failed to generate or store PDF:', error);
}
...
if (!pdfBuffer) problems.push('PDF 생성 실패');
```

③ 렌더가 성공하면 `pdfBuffer`는 채워진 뒤이므로 `uploadContractPdf`나 `pdfUrl` UPDATE가 던져도 `problems`는 비고 `notificationError`는 `null`로 기록된다. 관리자 상세에는 amber 배너 "서명본 PDF가 보관되지 않았습니다"(index.tsx:319-324, `status=signed && !pdfUrl && !purgedAt`)가 있으나 목록과 일일 헬스체크에는 신호가 없다. 더 심한 것은 HEAD에서는 `sign-transaction`이 발송 때 찍힌 `notifiedAt`을 비우지 않아(`recordNotificationResult`가 세팅) `healthCheck.ts:314-335` "서명 후 후처리 기록 없음" 점검이 정상 흐름에서도 영영 울리지 않는다 — `c5bd4ad154` 1번 항목이 되돌려진 결과(CON-5).

④ 고객 메일에는 메모리의 `pdfBuffer`가 첨부되므로 고객은 PDF를 받고, 다운로드는 `loadOrRenderContractPdf`가 재렌더로 대체하며 resend-signed로 복구된다. 운영 DB의 서명·종료 계약 3건 모두 `pdf_url`이 있다. 운영자가 상세를 열기 전에는 PDF 미보관을 모른다는 것이 영향의 전부다.

⑤ **수정**: `c5bd4ad154` 복구 뒤 그 위에서. 복구판 `finalize.ts`는 '렌더'와 '업로드·기록'을 별도 try로 나누므로, 업로드·기록 실패 시 `problems.push('PDF 보관 실패')`를 더한다 — resend-signed가 `pdfUrl` 없는 계약을 다시 그려 올리므로 이 문구가 곧 복구 안내다. 복구판 `collectContractHygieneIssues`에 `status='signed' ∧ pdfUrl IS NULL ∧ purgedAt IS NULL ∧ signedAt < now - 유예 시간` 경고 추가. `finalize.test.ts`에 업로드 실패 케이스.

⑥ 검증자 조정: 영향은 지적보다 작고(상세 배너·메일 첨부·재렌더 존재), 헬스체크 무력화는 지적보다 심하다.

#### CON-14. 문서 지문이 조항·첨부 동의 시각과 단말 정보를 덮지 않는다 [P3 · M]

① `lib/contracts/integrity.ts:124-164`·`:213-215`, `lib/contracts/pdf-html.ts:149-155`, `pages/api/contracts/[id]/sign.ts:81-85`·`:134-139`, `lib/contracts/finalize.ts:18-21`, `lib/contracts/audit-trail.ts:99-102`, `db/schema.ts:177-186`

② canonical(124-164)에는 `clause[${index}].number/title`만 있고 `agreedAt`·`userAgent`가 없다. 주석 213-215: "조항·첨부의 동의 시각(agreedAt)은 따로 넣지 않는다. 서명과 같은 트랜잭션에서 같은 시각이 찍히므로 signedAt이 이미 그것을 덮는다." `pdf-html.ts:149-155`는 그 `agreed_at` 컬럼으로 '✓ 동의'/'미동의'를 인쇄한다. 세 호출처 모두 `with: { contractClauses: true, contractAttachments: true }`로 `orderBy` 없음. `sign.ts:134-139` `identityConfirmed`는 검사만 하고 저장하지 않는다.

③ 주석의 "signedAt이 덮는다"는 정합성 논리일 뿐 `clause.agreed_at` 컬럼 변조 탐지는 못 한다. 다만 지문은 `contentHash`와 같은 DB에 저장되므로 쓰기 권한이 있고 알고리즘을 아는 사람은 재계산할 수 있다 — 실제 방어 대상은 실수·단순 수정이다. "전자서명 방식 동의" 별도 시각은 정보가 늘지 않는다(같은 요청·같은 `now`, 동의 없으면 요청 거부). 조항 순서 비결정은 이론상이다 — 운영 DB의 clause 12행은 계약마다 rowid 순서가 제5·6·9·12조이고 현재 쿼리는 그 순서를 안정적으로 낸다.

④ DB 쓰기 권한자가 `agreed_at`·`user_agent` 컬럼만 바꿔도 대조가 일치한다. 현재 계약량(3건)과 위협 모델에서는 시급하지 않다.

⑤ **수정** (정말 필요할 때만): `integrity.ts`에 `v5`를 추가(`CANONICAL_BUILDERS`에 더하고 v3·v4는 그대로). v5 canonical에 signer UA(CON-3과 합침)와 각 clause/attachment의 `agreedAt`(`toSeconds`)을 넣는다. 순서는 v3·v4가 쓰는 삽입(rowid) 순서를 건드리지 말고, **v5만** `clauseNumber`를 숫자로 파싱(제5→5, 제12→12)해 정렬한다. **`orderBy(createdAt, id)`는 쓰지 않는다** — 같은 계약의 clause 4행은 `created_at`이 모두 같은 초이고 `id`는 `lower(hex(randomblob(16)))`라 무작위(schema.ts:177-186, 운영 DB 확인)여서 sign/finalize/audit-trail에 통일하면 순서가 무작위가 되어 이미 서명된 3개 계약이 변조 없이 mismatch로 뜬다. 별도 동의 시각 컬럼·마이그레이션은 만들지 않는다. `integrity.test.ts`에 v5 라운드트립과 `agreedAt` 변경 시 mismatch 케이스.

⑥ 검증자 조정: 심각도 하향, 원 수정안의 `createdAt+id` 정렬은 기존 계약을 깨뜨리는 위험한 제안이라 배제.

#### CON-15. 문서 지문 일괄 대조가 자동으로 돌지 않는다 — 수동 스크립트만 있음 [P3 · S]

① `lib/ops/healthCheck.ts:291-340`, `scripts/verify-contracts.ts`, `lib/contracts/audit-trail.ts`, `pages/admin/contracts/[id]/index.tsx:96`, `vercel.json`

② `verifyContractFingerprint`/`buildAuditTrail` 호출은 `audit-trail.ts`와 관리자 상세 `index.tsx:96`, 그리고 `scripts/verify-contracts.ts`(커밋 `779686f964`, `docs/design-2026-08-25-remaining-p2.md:30`)다. 이 스크립트는 전건을 세션 없이 대조하고 mismatch가 있으면 종료 코드 1을 낸다. `checkContractHygiene`(291-340)은 만료·오래된 초안·후처리 누락만 점검하고, `vercel.json` 크론에도 지문 대조가 없다. `download.ts`/`pdf.ts`는 보관 PDF를 지문 검증 없이 내려 준다.

③ 자동 경보가 없다. 변조·형식 어긋남은 운영자가 스크립트를 돌리거나 상세를 열기 전에는 드러나지 않는다. 운영 계약 3건(서명 1·종료 2)이라 실익은 작다.

④ 분기 점검은 스크립트로 가능하다. 일일 자동 점검만 없다.

⑤ **수정**: `c5bd4ad154` 복구 후(복구하면 `checkContractHygiene`가 `collectContractHygieneIssues`와 나뉘어 줄 번호·구조가 바뀐다), 복구판 `collectContractHygieneIssues`(조회 전용)에 `signed`·`terminated`이면서 `purgedAt` 없고 `contentHash`가 있는 계약을 relations와 함께 읽어 `buildAuditTrail(contract).fingerprint.kind === 'mismatch'`를 모으는 점검을 더한다 — `verify-contracts.ts` 로직 재사용, 쓰기 없음, 심각도 high. 도입 전에 `verify-contracts.ts --all`로 기존 3건이 match인지 먼저 확인. CON-14의 정렬 변경을 하게 되면 그 뒤에 넣는다. `healthCheck.integration.test.ts`에 지문을 어긋나게 한 픽스처 케이스.

⑥ 검증자 조정: 원 지적은 `scripts/verify-contracts.ts`를 grep에서 빠뜨려 "상세 화면을 열 때만 돈다"고 했으나 부정확 — 수동 도구는 있다.

#### CON-16. 발송·취소·종료 등 계약 변경 행위에 수행자(actor) 기록이 없다 [P3 · M]

① `pages/api/contracts/[id].ts:36`·`:67`·`:89-253`, `lib/contracts/service.ts:359-375`, `lib/contracts/audit-trail.ts:148-181`, `lib/privacy/accessLog.ts`, `db/schema.ts`

② `[id].ts:36 const auth = await authenticateAdminApi(req, res);`의 `auth.actor`는 67행 `contract_view` 접속기록에만 쓰이고 PATCH/DELETE 분기(89-253)에는 쓰이지 않는다. `markContractSent`(service.ts:359-375)는 `sentAt: now, signedAt: null, signTokenUsedAt: null, firstViewedAt: null, firstViewedIp: null, lastViewedAt: null, viewCount: 0`으로 직전 발송·열람 값을 비운다 — 주석대로 보안 스캐너가 옛 링크를 연 기록이 '최초 열람'으로 오인되지 않게 일부러 비우는 것이다. `audit-trail.ts:148-181` 이벤트는 컬럼 현재값만 나열한다.

③ 계약을 보낸·취소한·종료한 관리자가 어디에도 남지 않는다. 사슬 훼손·증거 소실은 없다 — 서명이 붙은 링크의 발송→열람→본인확인→서명 사슬은 그대로 남고, 삭제는 draft·cancelled만 가능하며, 종료는 `reason`과 `terminatedAt`이 남는다. 빠진 것은 '누가'뿐이다. 관리자 계정이 사람별로 갈려 `actor`는 이미 있다.

④ 분쟁 때 누가 처리했는지 알 수 없다. 서명 효력·증거 사슬에는 영향이 없다.

⑤ **수정**: `privacy_access_logs`·`privacyAccessActionEnum`은 건드리지 않는다 — 그 표는 개인정보 열람·복호화·내려받기의 접속기록(처리방침 19항, 2년 보관)이고 운영 행위 이력이 아니며, 열거를 늘리면 처리방침을 고쳐야 하고 처리방침은 펀딩 약관 판본 게이트를 탄다. 최소안: PATCH/DELETE 성공 시 `console.info('[contracts/admin]', { id, action, actor: auth.actor })` 구조화 로그. 관리자가 한 명이면 이걸로 충분하다. 필요해지면 append-only `contract_events(contract_id, kind, actor, at, meta)` 표를 새 마이그레이션으로 — 새 표이므로 0046처럼 코드가 먼저 배포돼도 읽기는 빈 목록 폴백, 쓰기는 실패해도 계약 처리를 막지 않게 한다.

⑥ 검증자 조정: "서명 부인 방어 사슬이 짧아진다"는 과장, `privacyAccessActionEnum` 확장 제안은 부적절해 배제.

#### CON-17. 이용 종료 처리가 실제 퇴실일을 받지 않고 처리 시각을 `terminatedAt`으로 찍는다 [P3 · S]

① `pages/api/contracts/[id].ts:157-172`, `lib/contracts/service.ts:117-130`, `pages/admin/contracts/[id]/index.tsx:179`, `db/schema.ts:119-127`, `lib/contracts/retention.ts:80-90`

② `[id].ts:164-172 const { reason } = req.body ...; const terminated = await terminateContract(id, { reason: reason.trim() });`. `service.ts:117-130`의 시그니처는 `options: { reason: string; terminatedAt?: Date }`, `terminatedAt: options.terminatedAt ?? now`인데 라우트도 화면(index.tsx:179)도 `terminatedAt`을 한 번도 넘기지 않는다. `schema.ts:119-127`은 `terminatedAt`을 "이용이 실제로 끝난 시각"으로 정의한다.

③ 스키마 정의와 구현이 다르다. 점유 판정은 `terminatedAt`의 null 여부만 보므로(service.ts:91, status.ts:86, billing/service.ts:159) 날짜 값은 점유에 쓰이지 않는다. 3년 파기 기산점은 처리일 기준이라 늦어지지만 안전한 방향이고, 거꾸로 과거 날짜를 받더라도 `createdAt < boundary` 조건이 함께 걸려(retention.ts:80-90) 최근 계약이 조기 파기되지 않는다.

④ 퇴실일이 컬럼에 남지 않아 위약금·반환금 정산 근거는 종료 사유 텍스트(필수, 화면 예시 "중도 퇴실(위약금 납부)")에 의존한다. 운영 DB의 종료 2건은 모두 `terminated_at`이 있다.

⑤ **수정**: terminate 분기에서 선택 입력 `terminatedOn`(YYYY-MM-DD, KST)을 받아 형식·`startDate` 이상·오늘+1일 이하를 검증하고 `new Date(`${terminatedOn}T00:00:00+09:00`)`를 `terminatedAt` 옵션으로 넘긴다(없으면 지금). 화면은 `window.prompt`로 두 값을 받기 어려우니 `components/ui/Modal`로 바꾼다. 표시 문구는 "종료 처리했습니다" 대신 실제 종료일과 처리 시각을 함께. 경계 케이스 테스트를 `tests/api/contracts/id.test.ts`에.

⑥ 검증자 조정: "호실 공실 시점이 밀린다"는 틀림, P2→P3.

#### CON-18. 고아 PDF 정리의 참조 판정이 URL 문자열에만 의존하고 list를 한 페이지만 본다 — 방어 강화, 실제 오삭제 경로는 가설 [P3 · S]

① `lib/contracts/backup.ts:88`·`:107-133`, `lib/funding/mediaRetention.ts:99`, `lib/contracts/pdf-storage.ts`

② `backup.ts:111-113 const referenced = new Set(contracts.map((c) => c.pdfUrl).filter(...));` → `:115 const { blobs } = await list({ prefix: PDF_PREFIX });` → `:118-124 !referenced.has(b.url) && new Date(b.uploadedAt) < grace` → `:126-130 await del(blob.url)`. 88행 `removeExpiredBackups`도 `list` 한 번. `cursor`/`hasMore`를 따라가지 않는다. 테스트 없음.

③ 참조 판정이 URL 문자열 일치뿐이다. 평상시에는 `uploadContractPdf`가 DB에 넣는 `put().url`과 `list().blobs[].url`이 같은 SDK 필드(@vercel/blob 2.4.0)라 일치한다. 불일치가 되려면 스토어를 바꾸고 DB `pdfUrl`을 고치지 않아야 하는데, 그 상태는 이미 `get(pdfUrl)`이 전부 실패해 재렌더 폴백으로 도는 장애 상태다. list 첫 페이지만 보는 쪽은 "덜 지우는" 안전한 방향이지만 `mediaRetention.ts:99`는 cursor를 순회하므로 일관성 정리 대상이다. `contracts/` 접두사는 계약 PDF와 백업만 쓴다.

④ 현재 조건에서 서명 PDF가 일괄 삭제될 경로는 확인하지 못했다. 비가역 삭제 코드에 테스트가 없다는 점이 남는 위험이다.

⑤ **수정**: 참조 판정을 pathname으로 — `contracts.filter(c => c.pdfUrl).map(c => `contracts/${c.id}.pdf`)`와 `blob.pathname` 대조(`put` 기본 `addRandomSuffix=false`, `uploadContractPdf`가 유일한 작성자). list는 `mediaRetention.ts`처럼 `cursor`/`hasMore`로 순회. 안전장치는 단순한 판정 하나만: DB에 `pdfUrl`이 있는 계약이 N>0인데 list에서 참조와 맞는 항목이 하나도 없으면 삭제를 건너뛰고 운영자 메일. 삭제 건수 20% 상한 같은 것은 두지 않는다. 테스트는 "참조된 PDF는 24시간이 지나도 남고 고아만 지워진다" 한 케이스.

⑥ 검증자 조정: 일괄 삭제 시나리오는 성립하기 어렵고, 원 지적의 "blob create-store 이력"은 로컬 `.env.local` 덮어쓰기 사고이지 계약 스토어 이전이 아니다. 같은 자리를 다른 축(PRV 개인정보·처리방침 정합·로그)도 지적: "고아 PDF 정리가 Blob list 페이지네이션을 처리하지 않는다(백업 정리는 해당 없음)".

#### CON-19. 필수 동의 조항 번호가 템플릿 조문과 대조되지 않는다 — 제목 불일치는 결함 아님 [P3 · S]

① `lib/contracts/service.ts:25-30`, `lib/contracts/template.test.ts`, `lib/contracts/contract-template.md:83·193`, `pages/[locale]/contracts/[id]/sign.tsx:704·760`

② `REQUIRED_CLAUSES`(service.ts:25-30)는 `{ clauseNumber: '제12조', title: '개인정보의 수집 및 이용' }` 등 4건의 독립 상수다. 템플릿은 `## 제12조 (전자계약의 성립과 개인정보의 처리)`(193행), `## 제5조 (보증금 및 그 납부 면제) — 핵심 조항`(83행). `sign.tsx:704`는 이 title을 "제12조 개인정보의 수집 및 이용 에 동의합니다"로 보여 주고 PDF도 같은 title을 인쇄한다. `REQUIRED_CLAUSES`는 service.ts 두 곳에서만 참조되고 `template.test.ts`에 대조가 없다.

③ 제목 불일치는 결함이 아니다 — 동의 항목 제목은 "무엇에 동의하는가"를 말하는 라벨이고, 템플릿 제12조 말미가 "개인정보 수집·이용 동의: 본 조에 대한 을의 동의 여부는 「동의 항목」란에 동의 일시와 함께 기록된다"고 같은 용어를 쓴다. ⑧ 3호의 수집·보관 동의는 이 항목이, ⑦의 전자서명 효력 동의는 `sign.tsx:760`의 별도 체크박스가 받는다. 유효한 부분은 템플릿을 재번호·삭제했을 때 조용히 어긋나는 것을 막는 가드 부재뿐이다.

④ 조문 번호를 바꾸면 동의 화면이 다른 조문에 동의를 받을 수 있다. 지금은 4개 번호가 모두 템플릿과 맞는다.

⑤ **수정**: `template.test.ts`에 `REQUIRED_CLAUSES` 각 `clauseNumber`에 대해 `new RegExp(`^## ${clauseNumber} \\(`, 'm')`이 `readContractTemplate()`에 매치되는지만 단언한다. 제목 문자열 포함 단언은 제12조가 의도적으로 다르므로 두지 않는다(두려면 5·6·9조만). 상수 title을 템플릿 괄호 제목과 같게 바꾸는 것은 고객이 동의하는 법적 문구를 넓히는 변경이라 운영자 판단이 먼저다(`contract_clauses.title`은 생성 시 복제되므로 기존 계약은 영향 없음).

⑥ 검증자 조정: 제목 불일치 자체는 결함에서 제외.

#### CON-20. 서명 완료 메일의 입금 계좌가 결제 정본(`BANK_ACCOUNT`)을 쓰지 않는다 [P3 · S]

① `lib/contracts/email.ts:97`·`:115`, `lib/payments/bankAccount.ts`, `db/schema.ts:47-49`, `lib/contracts/contract-template.md:47`

② `email.ts:97 '입금 계좌: 카카오뱅크 3333-12-5480849 (예금주: 황경하 / 스튜디오 놀)',` 115행 동일 문자열. 결제 공용 정본은 `lib/payments/bankAccount.ts`의 `BANK_ACCOUNT = { bankName, accountNumber, accountHolder }`이고 값이 같다(import 없는 모듈이라 가져다 쓰기 안전). `db/schema.ts:47-49` `paymentBank/paymentAccount/paymentAccountHolder` 컬럼은 읽는 코드가 없다(테스트 픽스처 `pdf-html.test.ts:28-30`, `complete-page.test.ts:42-44`에만 등장). 템플릿 47행에도 같은 계좌가 있다.

③ 이전 리뷰(08-24 #23, round2 #29)는 `bankAccount.ts`가 생기기 전 지적이라, 지금은 정본이 있는데 메일만 안 따라간 상태다. `BANK_ACCOUNT`만 바꾸면 계약 안내 메일에 옛 계좌가 남는다.

④ 계좌를 바꾸는 사건이 있을 때만 고객에게 틀린 입금처가 나간다. 연습실 월 이용료는 토스 빌링 자동결제 경로가 따로 있어 이 안내는 보조 경로다.

⑤ **수정**: `email.ts` 두 곳을 `` `입금 계좌: ${BANK_ACCOUNT.bankName} ${BANK_ACCOUNT.accountNumber} (예금주: ${BANK_ACCOUNT.accountHolder})` ``로. `template.test.ts`에 템플릿 47행의 입금 계좌가 `BANK_ACCOUNT`와 같은지 단언(템플릿은 서명 시점 사본에 굳으므로 값은 그대로 두고 가드만). **죽은 컬럼 3개는 삭제하지 않는다** — drizzle 관계 조회가 `contracts` 전체 컬럼을 SELECT하므로 컬럼 삭제는 코드 먼저·마이그레이션 나중이라는 평소와 반대 순서가 되고 어기면 계약 조회 전체가 `no such column`으로 깨진다(CLAUDE.md 0022 절). `schema.ts`에 "미사용" 주석만 단다.

⑥ 검증자 조정: 죽은 컬럼 제거 제안 배제. 같은 자리를 다른 축(OPS 메일·크론·운영 알림)도 지적: "계약 서명 완료 메일의 입금 계좌가 하드코딩이다 (템플릿·스키마 기본값과 함께 3중화된 이전 리뷰 #29의 잔존분)".

#### CON-21. 서버리스에서 한글 폰트를 못 읽어도 두부 PDF가 정상 서명본으로 저장·첨부된다 [P3 · S]

① `lib/contracts/pdf.ts:91-95`, `lib/contracts/pdf-html.ts:17-21`·`:40-46`·`:66-87`, `lib/contracts/finalize.ts:46-59`, `lib/contracts/pdf-storage.ts:45-50`

② `pdf-html.ts:40-46 } catch (error) { console.error('[contracts/pdf] Failed to embed Korean font:', error); cachedFontCss = ''; } return cachedFontCss;` — 폰트 실패를 `''`로 캐시. 68-87은 날인 환경변수가 없거나 형식이 틀리면 `cachedSealCss = ''`. 주석(17-21행)은 폰트가 없으면 "계약서 전체가 두부(□)로 렌더링된다"고 명시한다. `pdf.ts:91-95`는 빈 `fontFaceCss`로도 그대로 렌더하고 `finalize.ts:46-59`가 그 결과를 업로드해 `pdfUrl`로 굳힌다. 이후 `pdf-storage.ts:45-50`은 보관본을 우선 반환한다.

③ 로컬 개발용 시스템 폰트 폴백이 서버리스에서도 조용히 적용된다. 폰트는 번들된 2MB 정적 파일을 `readFileSync`로 읽으므로 현실적인 오류는 일시 오류가 아니라 번들 누락 같은 영구 오류다 — 실패 캐시 제거는 효과가 없다. 날인 없는 발행은 `pdf-html.ts:66-67`의 명시된 설계 결정("도장이 없다고 계약서 생성을 막을 이유는 없고 서명과 문서 지문이 진정성을 뒷받침")이라 막지 않는다.

④ 번들 설정 회귀 같은 상황에서 새 서명본 PDF가 전부 두부로 만들어져 보관·첨부된다. HEAD의 resend-signed가 PDF를 다시 만들어 덮으므로 복구 경로는 있다(CON-5 복원 뒤에는 보관본을 못 읽을 때만 재렌더하므로 그때 재검토). 날인 누락은 로그 한 줄뿐이고 `notificationError`에 남지 않는다.

⑤ **수정**: `pdf.ts` `generateContractPdf` 시작부에 `if (isServerless() && !fontFaceCss) throw new Error('PDF 폰트를 읽지 못했습니다');` 한 줄 — finalize가 'PDF 생성 실패'를 `notificationError`에 기록하고 일일 점검 메일이 뜬다. 날인은 막지 않고 복구판 finalize의 `problems`에 '날인 없이 발행'만 기록한다.

⑥ 검증자 조정: "3년간 보관본으로 남는다"·실패 캐시 제거·날인 production throw는 배제.

#### CON-22. 죽은 `recordDownloadIdentityFailure`와 서명 완료 계약에서 성립하지 않는 '재발송 해제' 안내 [P3 · M]

① `lib/contracts/admin-rate-limit.ts:375-460`(380·390-391·435·466행), `pages/api/contracts/[id]/download.ts:11-15`·`:90-124`·`:136`, `pages/api/contracts/[id]/sign.ts:109-116`, `pages/api/contracts/[id].ts`, `lib/contracts/status.ts:30`

② `admin-rate-limit.ts:390-391 DOWNLOAD_IDENTITY_TOTAL_LIMIT = 100; DOWNLOAD_IDENTITY_TOTAL_WINDOW_SECONDS = 24 * 60 * 60;` — 일 100회, 4자리 1만 조합이면 평균 약 50일. 435행 `export const recordDownloadIdentityFailure`는 호출처가 없는 죽은 코드(`reserveDownloadIdentityAttempt`로 대체)인데 380·466행 주석이 아직 그 흐름을 설명한다. `resetIdentityAttempts` 주석이 말하는 "재발송이 해제 수단"은 서명 완료 계약에서는 성립하지 않는다 — resend는 sent/expired/cancelled만 허용(status.ts:30)하고 resend-signed는 카운터를 지우지 않는다. `download.ts:90-124`·`sign.ts:109-116`의 locked는 429만 돌려주고 알림이 없다. 서명 후 `signToken`은 만료되지 않는다(download.ts:11-15 주석).

③ 다운로드 잠금은 영구가 아니다 — 총량 창이 24시간이라 자동으로 풀린다(2026-10-02 리뷰가 "30일은 사실상 영구였다"며 일부러 줄였다). 정당한 고객이 한 번 성공하면 두 카운터가 모두 지워진다(download.ts:136). 일 100회 한도와 잠금 무알림은 설계 trade-off다. 남는 것은 죽은 코드·stale 주석과, 주석이 약속한 해제 수단이 signed 계약에 없다는 불일치다.

④ 정당한 고객이 다운로드 잠금(최대 24시간)에 걸렸을 때 운영자가 주석을 읽고 "재발송하면 풀린다"고 믿어도 풀리지 않는다. 대입 위험은 영구 링크 유출이 전제인 평균 50일 저속 공격이다.

⑤ **수정**: (1) `recordDownloadIdentityFailure`와 380·466행 stale 주석 삭제. (2) `pages/api/contracts/[id].ts` resend-signed 분기에서 `resetIdentityAttempts(id)`를 부르거나, `resetIdentityAttempts` 주석에서 "재발송이 다운로드 잠금의 해제 수단"이라는 문장을 뺀다. (3) 선택: `DOWNLOAD_IDENTITY_TOTAL_LIMIT`을 30으로 — 정당한 사용자에게 영향이 없다. 평생 누적 영구 잠금·`expiresAt=2099` 행은 하지 않는다. 잠금 최초 전환 시 운영자 메일은 신규 기능이라 필요하면 별도로.

⑥ 검증자 조정: 심각도·수정안 하향(영구 잠금 제안은 기존 설계 결정과 충돌).

#### CON-23. 계약 날짜 입력이 YYYY-MM-DD로 정규화되지 않고 종료일 상한이 없다 [P3 · S]

① `lib/contracts/validation.ts:161-162`·`:179-185`·`:277-278`, `lib/contracts/service.ts:198`, `lib/contracts/form-values.ts:12-18`, `pages/api/contracts/index.ts:17-20`

② `validation.ts:161-162 const startDate = startDateRaw ? parseDate(startDateRaw) : null;`에서 `parseDate`는 `new Date(value)`이고, 277-278은 `startDate: startDateRaw as string, endDate: endDateRaw as string`으로 원문 문자열을 그대로 돌려 `service.ts:198 new Date(data.startDate)`로 저장한다. 179-185는 최소 1개월만 검사한다.

③ ISO 시각·오프셋 문자열·`Nov 1 2026` 같은 값이 UTC 자정이 아닌 순간으로 저장된다. 검증자 실행 확인: TZ=UTC에서 `2026-11-01T10:00:00+09:00`는 `2026-11-01T01:00Z`로, `Nov 1 2026`과 40년 뒤 종료일(2066)은 그대로 통과, 종료일 `-10:00` 오프셋은 다음 날 09:59Z로 저장. `form-values.ts` `toDateInputValue`의 로컬 getter는 `getServerSideProps`(new.tsx:45, edit.tsx:55)에서만 불리고 TZ=UTC·Asia/Seoul에서는 정확해 현재 경로에서는 결함이 아니다(America/Los_Angeles에서만 하루 어긋남).

④ POST/PATCH는 관리자 인증 뒤(index.ts:17-20)이고 폼은 date input만 보내므로 현재 실현 위험은 낮다. 관리자가 API를 직접 호출하거나 자동화가 생기면 호실 충돌·종료 판정이 날짜 단위로 어긋날 수 있다.

⑤ **수정**: `validation.ts`에서 `startDate`/`endDate`를 `/^\d{4}-\d{2}-\d{2}$/` + `validator.isDate`로 강제하고 `${raw}T00:00:00.000Z`의 UTC 자정만 쓰며, 검증 통과한 정규화 문자열을 data에 담는다. 최대 기간(예: 36개월 — 운영 정책과 맞는지 확인) 검사 추가. `CreateContractPayload`의 "ISO 8601 또는 YYYY-MM-DD" 주석 수정. `validation.test.ts`에 ISO 시각·비표준 문자열·초장기 종료일 거부 케이스. `toDateInputValue`를 `toISOString().slice(0,10)`으로 바꾸는 것은 주석과의 정합 정리일 뿐이다.

⑥ 검증자 조정: `toDateInputValue` 부분은 현재 경로에서 실현되지 않아 설명 축소.

#### CON-24. 호실 키 정규화가 JS와 SQL 두 벌이고, 만료된 sent 계약이 최대 하루 호실을 막는다 [P3 · S]

① `lib/contracts/service.ts:52-54`·`:94-99`·`:388-397`, `lib/contracts/validation.ts:50-51`, `lib/ops/healthCheck.ts:291-296`, `pages/api/contracts/index.ts`, `pages/api/contracts/[id].ts`

② `service.ts:54 ROOM_KEY_SQL = sql`replace(replace(replace(upper(${contracts.roomNumber}), ' ', ''), '호실', ''), '호', '')``와 `markContractSent` 내부 NOT EXISTS 서브쿼리(391-392)에 같은 replace 체인이 복사돼 있다(self-join 별칭 `c2` 때문에 상수를 못 쓴다). JS `normalizeRoomNumber`(validation.ts:50-51)는 `value.replace(/\s+/g, '').replace(/호실?$/, '').toUpperCase()` — 끝의 호/호실만 뗀다. SQL은 중간의 '호'까지 지우는데 이는 52행 주석대로 '302호' 같은 옛 저장값과 비교하려는 의도다. `findRoomConflict`의 sent 분기(94-99)와 `markContractSent`는 `expiresAt`을 보지 않고, `expireOverdueContracts`는 목록(GET)·서명 화면·일 1회 헬스체크(295행)에서만 돈다.

③ 호출 시점 인자와 저장값은 이미 `normalizeRoomNumber`를 거치므로 두 판정이 갈리려면 옛 표기 행이나 이름 중간에 '호'가 든 호실이 필요하다 — 호실 이름이 숫자·알파벳뿐이라 현재 실현 가능성이 낮다. 만료 지연은 사실이다: DB에 sent로 남은 만료 계약이 `expireOverdueContracts`가 돌기 전까지 점유로 판정된다.

④ 이중 임대가 아니라 일시적 오거부(안전한 쪽)다. 관리자가 목록을 열거나 기존 계약을 취소하면 풀린다.

⑤ **수정**: 만료 지연은 `POST /api/contracts`와 PATCH(update·send·resend) 진입부에서 `await expireOverdueContracts()` 한 줄 — 가장 단순하고 `findRoomConflict`와 `markContractSent` SQL이 항상 같은 기준을 본다. SQL에 `expiresAt` 조건을 넣는 길을 택한다면 **두 곳에 함께** — `findRoomConflict`에만 넣으면 `markContractSent`의 NOT EXISTS가 여전히 막아 "방금 처리된 요청입니다"라는 엉뚱한 409가 난다. 호실 키는 `roomKeySql(col)` 헬퍼로 합치되(`c2` 별칭은 `sql.raw` 조각으로 받는다) '호/호실' 제거는 유지한다. SQL 단순화 안은 옛 행 비교를 깨뜨리므로 쓰지 않는다. JS 정규식과의 차이는 테스트로 고정.

⑥ 검증자 조정: SQL 단순화 제안 배제, `findRoomConflict` 단독 수정 함정 명시.

#### CON-25. Content-Disposition `filename*`가 RFC 8187 속성 문자 규칙을 지키지 않는다 [P3 · S]

① `pages/api/contracts/[id]/download.ts:149-155`, `pages/api/contracts/[id]/pdf.ts:82-84`, `lib/contracts/validation.ts`

② `download.ts:154`:

```ts
`attachment; filename="contract-${contract.id}.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`
```

`pdf.ts:83` 동일. `encodeURIComponent`는 `' ( ) * !`를 인코딩하지 않는다(실행 확인: `O'Brien (홍)*_...`가 그대로 나감). 이름 검증은 아포스트로피를 막지 않는다(O'Brien 사례를 `escapeTableCell` 주석이 직접 언급).

③ RFC 8187 attr-char에 `' ( ) *`가 없어 규격 위반이다. 같은 한 줄이 두 라우트에 복사돼 있다.

④ 이름에 아포스트로피·괄호가 있을 때만 해당. 주요 브라우저의 ext-value 파서는 둘째 작은따옴표 뒤를 그대로 퍼센트 디코딩하므로 실제 오표시는 드물고, ASCII 폴백 `filename="contract-<id>.pdf"`가 있어 다운로드 자체는 영향이 없다.

⑤ **수정**: 헬퍼 한 곳(`lib/contracts/serialize.ts` 또는 새 파일)에 `contentDispositionAttachment(asciiName, utf8Name)`을 두고 `encodeURIComponent(name).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())`로 처리한 뒤 `download.ts`·`pdf.ts`가 공유한다.

⑥ 검증자 조정: "일부 브라우저가 파일명을 잘라 읽는다"는 미확인이라 영향 서술 하향.

#### CON-26. 연락처 뒷자리 가림이 본문의 동일 문자열만 가리고, title·특약의 다른 표기는 가리지 않는다 [P3 · S]

① `pages/[locale]/contracts/[id]/sign.tsx:147-151`·`:589`, `lib/contracts/identity.ts:56-62`, `lib/contracts/validation.ts`

② `identity.ts:56-62 content.split(trimmed).join(masked)`는 `contract.customerPhone`과 문자열이 정확히 같은 곳만 치환한다. `contract.title`은 148행 props와 `:589 <title>{contract.title} — 서명 요청 | Studio NOL</title>`에만 쓰이고 마스킹을 거치지 않는다. 화면 h1은 고정 문구 "음악연습실 이용계약서"이고 템플릿에 `{{title}}` 자리가 없다. 특약(`specialTerms`)은 관리자 자유 입력으로 템플릿에 들어간다.

③ 실제 경로는 둘뿐이다 — (a) 관리자가 title에 번호를 적어 탭 제목과 `__NEXT_DATA__`로 나가는 경우, (b) 특약에 '010 1234 5678' 같은 다른 표기로 적는 경우. 둘 다 운영 실수 전제라 드물다.

④ 그 실수가 있으면 링크 소지자가 본인 확인(뒷자리 대조)을 우회한다.

⑤ **수정** (표시 단에서): (1) `sign.tsx` props의 `title`을 고정 문구로 바꾸거나 `maskIdentityDigitsInContent`를 통과시킨다 — `<title>` 외에 쓰이지 않는다. (2) `maskIdentityDigitsInContent`에 전화번호 숫자 사이 `[\s-]*`를 허용하는 정규식 치환을 더해 표기가 달라도 뒤 4자리를 가린다. 입력 거부(숫자 이어 붙여 포함 검사)는 연도·금액에 오탐이 많아 쓰지 않는다.

⑥ 검증자 조정: title은 방문자 화면에 보이지 않으므로 경로 축소, 입력 거부 제안 배제.

#### CON-27. 동의 목록을 체크 상태가 아닌 전체 id로 합성해 보내고, 접힌 이용수칙을 열지 않아도 '읽고 동의'가 가능하다 [P3 · S]

① `pages/[locale]/contracts/[id]/sign.tsx:269`·`:428`·`:456-459`·`:724`·`:811`, `pages/api/contracts/[id]/sign.ts:141-152`

② `sign.tsx:458 agreements: [...clauses.map((c) => c.id), ...attachments.map((a) => a.id)],` — `agreements` state가 아니라 전체 id 상수를 보낸다. 다만 같은 함수 428행이 `!allAgreed`면 fetch 전에 return하고 버튼도 811행에서 `!allAgreed`면 비활성이라, UI 흐름에서는 전부 체크됐을 때만 전송된다. 서버 재검증(sign.ts:141-152)은 API 직접 호출에 대한 방어로 정상 작동한다. 첨부는 `showRules` 기본 `false`(269행)로 접혀 있는데 체크박스 문구는 724행 `「{attachment.title}」을 읽고 동의합니다.`

③ 앞쪽은 코드 냄새 — UI 가드가 깨지면 서버 재검증이 이중 방어가 되지 못한다(현재 동작 차이 없음). 뒤쪽은 사실 — 이용수칙을 펼치지 않아도 "읽고 동의"를 체크할 수 있다.

④ 동의 증거의 질 문제다. "읽지 못했다"는 주장에 대한 방어가 약하지만, 이용수칙 본문은 첨부로 지문에 포함돼 서명 대상이다.

⑤ **수정**: `agreements: Object.entries(agreements).filter(([, v]) => v).map(([id]) => id)`로 실제 체크된 id만 보낸다(한 줄). 이용수칙은 기본 펼침으로 두거나, 체크박스를 한 번 펼친 뒤에만 활성화하거나, 문구를 "동의합니다"로 바꾼다. 서버 쪽 `rulesOpened` 필드는 클라이언트 자기 신고라 증거 가치가 없고 `signatures` 스키마 변경(마이그레이션 순서)을 부르므로 넣지 않는다.

⑥ 검증자 조정: "체크하지 않은 항목도 모두 동의로 전달"은 UI 흐름에서 성립하지 않음.

#### CON-28. 초안 수정은 템플릿만 새로고침하고 이용수칙 첨부는 갱신하지 않으며, 템플릿이 바뀐 묵은 초안을 발송할 때 알림이 없다 [P3 · S]

① `lib/contracts/service.ts:171`·`:256-329`·`:352-414`, `lib/contracts/template.ts:80-85`, `lib/contracts/template-snapshot.ts`, `pages/api/contracts/[id].ts`, `lib/contracts/status.ts`

② `createContract`만 `const rulesContent = buildRulesContent();`(171행)로 첨부 사본을 뜬다. `updateDraftContract`(256-329)는 `readContractTemplate()`로 본문·템플릿 사본을 현재 판본으로 다시 만들지만 `contract_attachments.content`는 건드리지 않는다. `markContractSent`(352-414)는 draft→sent에서 내용을 다시 만들지 않는다.

③ 무결성은 깨지지 않는다 — 고객이 보는 이용수칙은 `resolveRulesContent`(첨부 행)이고 지문도 같은 첨부 content를 덮어 "읽은 것 = 서명에 묶인 것"이 유지된다. 첨부를 계약 시점에 굳히는 것은 `template.ts:80-85` 주석상 의도다. 문제는 묵은 초안이 옛 판본 그대로 나간다는 운영 경고 부재뿐이다.

④ 조항 수정이 반영된 줄 알고 보낸 초안이 옛 이용수칙 판본일 수 있다.

⑤ **수정**: (1) `updateDraftContract`의 batch에 draft 조건을 건 `contract_attachments(type='rules')` content 갱신을 추가해 본문과 같은 시점 판본으로 맞춘다. (2) 템플릿 판본 경고는 **`action === 'send'`(draft)에만** — `hashTemplate(loadTemplateSnapshot) !== hashTemplate(readContractTemplate())`이면 관리자 상세에 "템플릿이 바뀌었으니 초안을 다시 저장하라" 안내(409를 쓰더라도 resend 경로는 제외). 발송 후(sent/expired)에는 update가 불가능(status.ts update: `['draft']`)해서 resend까지 막으면 템플릿이 한 번 바뀐 뒤 그 계약의 재발송이 영구히 막힌다. 사본이 없는 0046 이전 계약은 비교를 건너뛴다.

⑥ 검증자 조정: resend 적용 금지 조건 추가.

#### CON-29. 종료 처리를 잊은 서명 계약은 운영자가 목록을 열어야만 드러난다 [P3 · S]

① `lib/ops/healthCheck.ts:291-337`, `lib/contracts/status.ts:77`, `pages/admin/contracts/index.tsx:157·266-269·359`, `pages/admin/contracts/[id]/index.tsx:294`, `lib/contracts/conflict.ts:19-24`, `lib/contracts/retention.ts:56-80`

② `status.ts:77 needsTermination`의 사용처는 관리자 목록(157·359)과 상세(294)뿐이고 healthCheck에는 호출이 없다. `checkContractHygiene`은 초안 90일·후처리 미기록만 본다. 목록은 `LIST_LIMIT=200`으로 최근 200건만 보여 오래된 건은 배너에도 안 뜰 수 있다. `retention.ts:68-80`은 signed를 파기 대상에서 제외하고 `findRoomConflict`는 `terminatedAt` 없는 signed를 계속 점유로 본다.

③ 이 계약은 제3조에 따라 만료일이 지나도 1개월씩 자동 갱신되는 것이 정상 상태이고, 목록 배너(index.tsx:266-269)도 "갱신해서 계속 이용 중이면 그대로 두시라"고 안내한다. 종료일 경과만으로 일일 알림을 내면 정상 갱신 계약마다 매일 오경보가 된다 — 정상 갱신과 구분할 두 번째 신호가 필요하다.

④ 퇴실했는데 종료 처리를 잊은 호실은 점유로 남아 새 계약이 409로 거부되지만, `describeRoomConflict`(conflict.ts:19-24)가 "이용 종료 처리를 한 뒤 다시 시도"를 안내하므로 막다른 길은 아니다. 3년 파기 시계는 종료 처리 시점(`terminatedAt=now`)부터 시작되어 늦어진다 — 실제 퇴실일을 시스템이 알 수 없는 구조적 한계다.

⑤ **수정**: 알림 조건에 "갱신 중이 아님"을 가르는 두 번째 신호를 넣는다 — `status='signed' AND terminated_at IS NULL AND end_date < 오늘`인 계약 중 연결된 구독(`subscriptions.contractId`, `OCCUPYING_STATUSES`)이 없는 건만 모아 medium 이슈로 한 번에 요약. 구독 없이 운영되는 계약은 별도 처리가 필요하다. 같은 쿼리를 관리자 대시보드에 쓰면 목록 200건 제한도 해소된다. `end_date < 오늘-30일` 단독 조건은 쓰지 않는다.

⑥ 검증자 조정: 원 수정안(종료일 경과 기준 일일 메일)은 오경보, 영향 서술 하향, 200건 제한은 보강 사실.

#### CON-30. 보관 PDF를 못 읽어도(get null·빈 stream) 로그 없이 재렌더한다 [P3 · M]

① `lib/contracts/pdf-storage.ts:45-55`, `lib/contracts/pdf-html.ts:196`, `lib/contracts/finalize.ts`, `db/schema.ts`

② 
```ts
// pdf-storage.ts:45-55
if (contract.pdfUrl) {
  try {
    const stored = await get(contract.pdfUrl, { access: 'private' });
    if (stored?.stream) { ... if (buffer.length > 0) return buffer; }
  } catch (error) {
    console.error('[contracts/pdf-storage] Stored PDF unavailable, re-rendering:', error);
  }
}
// 57-66 generateContractPdf
```

`get()`이 `null`(@vercel/blob: 찾지 못하면 null)이거나 stream이 없거나 길이 0이면 로그 없이 재렌더로 넘어간다. catch 경로에만 로그가 있다. `contracts`에 PDF sha256 컬럼은 없다(`pdfUrl`·`pdfGeneratedAt`뿐).

③ Blob에서 지워진 보관본을 아무도 모른다. 문서 동일성의 기준은 이미 있다 — `signatures`의 v4 SHA-256 지문(`contentHash`)이 PDF에 인쇄되고(pdf-html.ts:196) 재렌더본도 같은 지문을 싣는다. PDF 바이트 sha256 표는 과하다: resend-signed가 같은 경로에 덮어쓰는 설계라 첫 재발송에서 바로 어긋나 이력 표가 필요해지고, 새 표는 마이그레이션 순서 규칙을 부르며, 일일 Blob head 점검은 계약 수만큼 네트워크 호출이 든다.

④ 고객 다운로드는 정상이라 보관본 유실이 숨는다. 재렌더본은 내용·지문이 같지만 PDF 바이트와 생성 시각 메타데이터는 다를 수 있다(Chromium `page.pdf`가 호출마다 바이트가 달라지는지는 직접 재현하지 않음; 바이트 동일성이 분쟁에서 실제로 요구되는지는 법무 판단).

⑤ **수정**: `get()`이 `null`이거나 stream/길이가 비면 `console.error('[contracts/pdf-storage] Stored PDF missing for', contract.id)`를 남긴다. 필요하면 재렌더 뒤 `uploadContractPdf`로 되채워 자가 복구. 그 이상(sha256 표·일일 head 점검)은 하지 않는다.

⑥ 검증자 조정: sha256 기록·Blob 점검 제안 배제.

**클린 판정**

- `lib/contracts/sign-transaction.ts` — 조건부 UPDATE 4문장이 모두 stillSignable(status=sent, signToken 일치, expiresAt 미경과)에 걸리고 계약 UPDATE가 맨 뒤에 있어 토큰 회전·취소·만료 경합에서 서명행만 확정되는 일이 없다
- `pages/api/contracts/[id]/sign.ts` 경합 처리 — rowsAffected 0일 때 실제 상태를 다시 읽어 409와 status를 돌려주고 sign.tsx가 409+signed를 완료 화면으로 보내는 재시도 흐름이 맞다
- `lib/contracts/format.ts`, `status.ts` needsTermination — 서명 시각·계약일·종료일 판정이 Asia/Seoul로 고정되고 kstDateKey로 날짜 비교한다. 지문의 toSeconds와 DB 초 단위 저장도 일치
- `lib/contracts/retention.ts` — COALESCE(terminatedAt, endDate) 기산점, signed 제외, createdAt 하한, PDF 선삭제 후 표식 순서, terminationReason·specialTerms·firstViewedIp 파기가 제12조 ④와 맞다
- `pages/api/cron/purge-contracts.ts`, `backup-contracts.ts` — 인증(isCronAuthorized timingSafeEqual)·실패 메일·백업 실패 시에도 정리 계속하는 구조 확인
- `lib/contracts/html-escape.ts` escapeTableCell/CONTRACT_MARKDOWN_OPTIONS, `pdf.ts` blockExternalRequests, `pdf-html.ts` 서명 이미지 sink 이스케이프 — 표 구조·태그·외부 요청 방어(플레이스홀더 주입 제외)
- `pages/api/contracts/[id]/download.ts` 본인확인 순서 — 읽기 전용 잠금 확인 → 형식이 맞는 시도만 원자적 예약 → 성공 시 카운터 리셋 순서와 응답 위생(no-store)
- `lib/contracts/service.ts` markContractSent·deleteContract·cancelContract — 허용 상태·쿨다운·원자적 호실 점유·purgedAt 가드·삭제 순서(계약 행 조건부 삭제 후 자식 정리)
- `lib/contracts/page-cache.ts`와 `next.config.mjs` contracts no-store 규칙, sign/complete 페이지의 referrer·noindex 처리
- `lib/contracts/identity.ts` 뒷자리 대조·마스킹 로직 자체, `client-ip.ts`(x-vercel-forwarded-for 우선), `view-log.ts`(토큰 조건·COALESCE)
- `lib/contracts/serialize.ts`의 signToken 제거와 signUrl의 상태별 노출 범위, 백업의 signToken 제외
- jest `lib/contracts`·`tests/api/contracts`·`components/contracts` 27 suites 498 tests 통과 확인

**읽지 못한 범위**

- `lib/contracts/admin-accounts.ts`, `admin-auth.ts`, `admin-session.ts`, `admin-rate-limit.ts`의 로그인 제한 부분 — 보안 축 담당이라 호출 관계와 계약 본인확인 카운터 구간만 읽음
- `lib/contracts/house-rules.md` 및 `contract-template.md` 본문의 법률 내용 자체(조항의 법적 타당성)는 검토하지 않음 — 코드와의 정합(제12조·부가세·계좌)만 대조
- `components/admin/ContractForm.tsx` 481줄 중 앞 140줄, `pages/admin/contracts/new.tsx`·`[id]/index.tsx` 후반부 UI 로직은 부분만 읽음
- `lib/email/layout.ts`(공용 메일 레이아웃)와 `lib/privacy/accessLog.ts`, `lib/billing/service.ts` cancelSubscriptionsOfContract 내부는 읽지 않음
- 운영 DB·Vercel Blob의 실제 상태(0046 마이그레이션 적용 여부, pdfUrl과 list() url 문자열 일치, 사본 없는 진행 중 계약 수, CRON_SECRET 설정)는 읽기 전용 규칙상 확인하지 못해 항목 5·15는 코드 근거만으로 판단
- markdown-to-jsx 내부 동작은 기존 테스트와 재현 실행(buildContractContent)으로만 확인했고 라이브러리 소스는 읽지 않음
- 각 테스트 파일은 목록·일부 발췌만 확인했고 모든 케이스를 정독하지 않음
- 실제 Chromium PDF 렌더(폰트 임베드·페이지 분할)와 서명 화면의 실기기 동작은 실행하지 않음

**미검증 후보(overflow)**

- 없음

### SEC. 인증·권한·입력 검증·헤더 (보안)

P0 0 · P1 0 · P2 6 · P3 16, 미검증 0

#### SEC-1. 단건 drizzle 쿼리 실패 로그에 바인딩 값(정산 암호문·예약/믹싱 고객 PII·서명 토큰)이 실린다 — 환불 계좌 경로만 요약 로그를 쓴다 [P2 · M]

**위치**
- `lib/funding/creatorProjectWrite.ts:571-580` (savePayoutSection UPDATE), `:351` (saveCreatorSection UPDATE)
- `pages/api/funding/creator/projects/[id].ts:162`
- `pages/api/contracts/[id]/sign.ts:83`, `:259`
- `pages/api/bookings/index.ts:57` → `lib/booking/service.ts:114`, `pages/api/orders/mixing.ts` → `lib/booking/service.ts:208`
- 대조: `lib/payments/refundAccount.ts:71` `safeDbErrorSummary`
- 의존성: `node_modules/drizzle-orm/errors.js:10-13`, `node_modules/drizzle-orm/libsql/session.js:121·131·162·193`

**지금 코드.** drizzle-orm 0.45.2의 `DrizzleQueryError`는 `super(\`Failed query: ${query}\nparams: ${params}\`)`로 메시지를 만들고, libsql 세션의 run/all/get/values가 전부 `queryWithCache`를 거쳐 이 예외로 감싼다. `creatorProjectWrite.ts:571`은

```ts
await getDb().update(fundingCreators).set({
  taxType: value.taxType, payoutAccountEnc,
  payoutAccountLast4: payoutAccountLast4(value.account),
  ...(residentNumberEnc === undefined ? {} : { residentNumberEnc }),
  updatedAt: new Date(),
})
```

를 try/catch 없이 돌리고, 호출부 `[id].ts:162` `return respondWriteResult(res, await savePayoutSection(auth.creatorId, validatedPayout.value));`도 감싸지 않아 Next `api-resolver.js:378`의 `console.error(err)`로 흐른다. `sign.ts:259`는 `console.error('[API/contracts/[id]/sign] Failed to sign contract:', error);`로 error 객체를 통째로 찍는데, `:83`의 `signToken = token` 조건 select가 실패하면 그 메시지에 토큰이 들어 있다. 예약·믹싱 주문 생성의 `.insert(orders)`도 단건이라 같은 경로다. 환불·계좌입금 경로 7곳만 `safeDbErrorSummary`로 요지만 남긴다.

**왜 문제인가.** `lib/crypto/CLAUDE.md`는 '암호문도 로그에 담지 않는다'고 정했는데, DB 쿼리가 실패하는 순간 그 규칙이 drizzle 쪽에서 깨진다. 펀딩 후원 생성은 `db.batch`(`service.ts:306`)라 `LibsqlError`(바인딩 없음)만 던져 해당 없고, `backup-contracts.ts:30`의 detail은 바인딩 없는 전량 조회 메시지라 PII가 없다.

**조건과 결과.** Turso 장애 순간 Vercel 런타임 로그에 정산 계좌·주민번호 암호문(`v2:…`), 예약·믹싱 고객 이름·전화·이메일, 진행 중 계약의 서명 토큰이 남는다. 로그는 운영자만 보고 기본 보존이 짧아 단독으로 사고는 아니지만, 로그 드레인이 외부 SaaS로 붙어 있으면 유출 경로가 된다(그 경우 P1).

**수정.**
1. 새 helper를 만들지 않는다. `safeDbErrorSummary`(`lib/payments/refundAccount.ts:71`)를 `lib/db/safeError.ts` 같은 공용 위치로 옮기고 refundAccount.ts에서 재수출한다.
2. `creatorProjectWrite.ts` savePayoutSection(571)·saveCreatorSection(351)의 UPDATE를 try/catch로 감싸 `console.error('[funding] creator update failed', safeDbErrorSummary(e))` 후 cause 없는 `new Error('db_write_failed')`로 재던진다.
3. `sign.ts:259`를 `console.error('[API/contracts/[id]/sign] Failed to sign contract:', safeDbErrorSummary(error))`로.
4. `pages/api/bookings/index.ts`·`pages/api/orders/mixing.ts`의 createXxxOrder 호출을 try/catch로 감싸 같은 요약 로그 + 500 JSON을 돌려 Next 기본 로그를 타지 않게 한다.
5. 회귀 테스트: `new DrizzleQueryError('update x', ['v2:abc'], cause)`를 helper에 넣어 결과 문자열에 `v2:`가 없음을 확인하는 단위 테스트 하나.
6. eslint `no-restricted-syntax`와 backup-contracts 변경은 하지 않는다 — 전자는 과한 기계, 후자는 PII가 애초에 없다.

**비고.** 검증자가 바로잡은 요지: 펀딩 후원 생성(db.batch)과 backup-contracts는 해당 없음, 심각도는 발현 조건(DB 장애)과 도착지(운영자 전용 로그)를 감안해 P2. 같은 자리를 다른 축(FNC 펀딩 — 개설자·심사·배송·정산·관리자)도 지적: 정산 계좌·세금 구분 변경에 이력·알림이 없다 — 변경 전 뒤 4자리와 시각을 남기고 운영자·개설자에게 알릴 것.

#### SEC-2. 계약 목록(API·관리자 페이지)이 쓰지도 않는 생년월일·주소·본문 21KB를 전 컬럼으로 내보낸다 — 스키마 주석의 전제와 다르다 [P2 · S]

**위치**
- `pages/api/contracts/index.ts:20-31`
- `pages/admin/contracts/index.tsx:77-90` (`limit: LIST_LIMIT + 1`, LIST_LIMIT=200)
- `lib/contracts/serialize.ts:27-29`
- `db/schema.ts:1427`

**지금 코드.** `contracts/index.ts:24-31`은 `getDb().query.contracts.findMany({ orderBy: ..., limit: LIST_LIMIT })` 결과를 `allContracts.map((contract) => serializeContractForAdmin(contract))`로 돌려주고, 관리자 페이지도 같은 findMany를 props로 직렬화한다. 둘 다 `columns` 제한이 없다. `serialize.ts:27`은 `const { signToken: _signToken, ...rest } = contract;` 뒤 `...rest`를 전개하므로 signToken만 빠지고 content(템플릿 21,365바이트)·description·customerBirthdate·customerAddress·customerPhone·customerEmail·notificationError가 전부 응답과 `__NEXT_DATA__`에 실린다. 목록 UI가 실제로 쓰는 필드는 customerName/Email/Phone(검색·표시, `:130-132`·`:366-368`)뿐이다.

**왜 문제인가.** `db/schema.ts:1427`의 '목록 화면은 남기지 않는다 — 한 줄마다 기록하면 노이즈뿐이고, 상세를 열어야 전체 개인정보가 보인다'는 설계 결정이 데이터 층에서 성립하지 않는다. 처리방침 19항은 '개인정보가 담긴 목록을 … 화면으로 여는 일'을 기록한다고 적은 뒤 다음 항에서 대상을 네 파일+계약서 PDF로 좁혀 문장이 서로 긴장한다. 2026-10-03 커밋(335ca3fbdc)은 상세만 contract_view로 추가했다.

**조건과 결과.** 관리자 세션이 새면 GET 한 번으로 전 계약자의 생년월일·주소·본문 200건이 접속기록 없이 나간다. 4.5MB 응답 한도는 미파기 계약이 200건에 가까워져야 닿는 이론적 한계다(보존 정책 `lib/contracts/retention.ts:111-115`가 기한 뒤 content·주소·전화를 PURGED_MARK/NULL로 덮는다).

**수정.**
1. `lib/contracts/serialize.ts`에 `serializeContractForList`를 추가해 id·title·customerName·customerEmail·customerPhone·roomNumber·startDate/endDate·금액·status·각 시각·signUrl만 담는다. 전화 마스킹은 하지 않는다(검색이 전화번호를 포함한다).
2. `pages/api/contracts/index.ts`와 `pages/admin/contracts/index.tsx`의 findMany에 `columns: { content: false, description: false, customerBirthdate: false, customerAddress: false, notificationError: false, specialTerms: false }`를 둬 DB에서부터 빼고, 목록 직렬화에 새 함수를 쓴다.
3. `db/schema.ts:1427` 주석을 '목록은 이름·연락처만 싣고 생년월일·주소·본문은 상세에서만 나온다'로 사실에 맞춘다.
4. `tests/api/contracts/index.test.ts`에 '목록 직렬화 결과에 content·customerBirthdate·customerAddress 키가 없다' 한 건 추가.
5. contract_list_view 접속기록은 추가하지 않는다 — 목록을 최소화하면 기존 설계 결정(상세만 기록)이 그대로 성립하고, 관리자 후원·예약 목록도 같은 기준이다.

**비고.** 검증자가 바로잡은 요지: 4.5MB 500은 이론적 한계, 전제는 관리자 비밀번호 탈취라 상세 API로도 전량 열람이 되므로 증분 피해는 '한 번에·기록 없이'라는 포렌식 결손 → P2. 목록 접속기록 추가 제안은 뺐다.

#### SEC-3. 감상실 비밀번호의 scrypt 해시·솔트가 공개 저장소에 있어 비밀번호가 약하면 오프라인 대입이 된다 [P2 · S]

**위치**
- `lib/press/listeningRoom.ts:25-41`
- `pages/api/press/room/[room]/enter.ts:18`, `:41`
- `scripts/press/hash-password.mjs`
- `lib/booking/rate-limit.ts:71-75`

**지금 코드.** `listeningRoom.ts:25-31`에 `'sabbaha-slung': { id: 'sabbaha-slung', passwordSalt: 'JiaGL6y9GXmDt5eGvi2NlQ', passwordHash: 'zyOlm-D6sJhN72QE6gUeDuf6KG88IMDf4O0gGNmxHvU' }`, `:37`에 `const SCRYPT_PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }`가 그대로 있다. 저장소는 PUBLIC(`gh repo view`). 온라인 방어는 `enter.ts:41` IP당 15분 10회뿐이고 `:18` 주석이 그걸 스스로 적는다. `rate-limit.ts:71-75`는 DB 오류 시 true(fail-open)다. `hash-password.mjs`는 길이·강도 검사가 없다.

**왜 문제인가.** 해시·솔트·파라미터를 누구나 받아 로컬에서 속도 제한 없이 후보를 대입할 수 있다. 온라인 제한(IP 키라 IPv6 회전에도 약함, SEC-5)은 이 경로에 전혀 걸리지 않는다. 위험 크기는 운영자가 고른 비밀번호 엔트로피에 전적으로 달려 있고, 코드는 그 강도를 강제하지 않는다. 루트 CLAUDE.md는 '원문을 커밋하지 않는다'만 정하므로 pepper는 금지된 제안이 아니다.

**조건과 결과.** 비밀번호가 사전형이면 발매 전 음원이 추측으로 열려 엠바고가 깨진다. 강한 비밀번호면 scrypt(추측당 32MiB, GPU 병렬이 잘 안 먹음)가 실질적으로 막는다. 비밀번호 교체는 코드 커밋+배포를 거친다.

**수정.**
1. `PRESS_ROOM_PEPPER`(Vercel Sensitive env)를 둬 `hashRoomPassword`가 `scryptSync(createHmac('sha256', pepper).update(password.normalize('NFC')).digest(), salt, 32, params)`를 쓰게 한다 — 저장소의 해시만으로는 대입이 불가능해진다. `hash-password.mjs`도 같은 pepper를 env에서 읽고, 운영에서 pepper가 없으면 signingKey처럼 던진다.
2. `hash-password.mjs`에 길이 하한(공백 제외 16자 이상 또는 단어 4개 이상)만 검사해 거부한다 — 새 의존성(zxcvbn 등)은 넣지 않는다.
3. `enter.ts`에 `press_room:<id>:global`(시간당 수백 회) 한도를 IP 한도 옆에 추가해 IP 회전을 둔화시킨다.
4. fail-closed 전환은 admin-rate-limit(`:194·:363`)과 공유하는 fail-open 결정을 뒤집는 것이라 운영자가 정한다.
5. 해시를 env로 옮기는 안은 pepper와 택일이다. 어느 쪽이든 Vercel은 env 변경 뒤 재배포가 있어야 반영된다 — 이점은 '공개 커밋 없이 교체'다.

**비고.** 검증자가 바로잡은 요지: 실제 비밀번호 강도는 코드로 알 수 없고 가장 약한 고리는 기자 수십 명이 공유하는 비밀번호 자체라 P2. '재배포 대신 env 변경만'은 틀림, fail-closed는 운영자 결정, zxcvbn은 과함.

#### SEC-4. 공개 GET /api/bookings/slots에만 요청 제한이 없고, 검증 전에 DB 정리와 요청당 FreeBusy 2회를 돌린다 [P2 · M]

**위치**
- `pages/api/bookings/slots.ts:41-75` (`:48-49` expireStaleOrders, `:53-73` 파라미터 검증, `:17-24`·`:42` 캐시 주석, `:130`·`:143` 503)
- `lib/booking/service.ts:273-290` (expireStaleOrders, 3문장 UPDATE batch)
- `lib/booking/calendarGuard.ts:20-24` (occupancyCalendars, R02↔녹음실 교차)
- `lib/booking/gcal.ts:22-39` (인스턴스 토큰 캐시)
- `pages/api/bookings/index.ts:52-54` (생성 가드 fail-closed 503)

**지금 코드.** `slots.ts:48-49` `const now = new Date(); await expireStaleOrders(now);`가 파라미터 검증보다 앞에 있고, 핸들러에 `consumeRateLimit` 호출이 없으며 middleware.ts에도 제한이 없다. 캐시는 인스턴스 Map(`:24,32`) 60초('적중률은 낮지만'). 캐시 미적중마다 Google FreeBusy를 자원 캘린더+교차 캘린더 2회 부른다. 실패는 슬롯(`:130` `return res.status(503).json({ ok: false, code: 'calendar_unavailable' });`)과 생성(`bookings/index.ts:52-54`, 2026-09-25 감사 결정) 모두 fail-closed 503이다.

**왜 문제인가.** 저장소의 다른 공개 예약·펀딩·문의 경로는 전부 consumeRateLimit을 거치는데 이 GET만 빠져 있다(설계 스펙 103행은 '생성·승인·취소 API'만 제한 대상으로 적는다). 잘못된 파라미터 요청까지 3 UPDATE batch를 먼저 돌리고, 날짜 60일×상품 조합을 돌리는 익명 호출자가 외부 쿼터를 소모할 수 있다. 생성 가드가 같은 API에 fail-closed로 묶여 있다.

**조건과 결과.** 의도적 플러딩이 있을 때만 발현한다. 그 경우 연습실·녹음 예약 생성이 쿼터 회복까지 전면 거절되고 Turso 왕복도 요청 수만큼 는다. 평상시 트래픽에서는 문제가 없다.

**수정.**
1. `slots.ts`에서 expireStaleOrders를 파라미터 검증(60-73) 뒤로 옮기고, 그 앞에 `consumeRateLimit(\`slots:ip:${ip}\`, 60, 60)`(getClientIp 사용, 초과 시 429 JSON)을 둔다 — 위저드가 날짜·시간을 바꿀 때 분당 수십 회면 충분하다.
2. (선택) 정리 작업 빈도를 줄이려면 `consumeRateLimit('slots:expire_stale', 1, 30)`으로 30초에 한 번만 돌린다.
3. 공유 캐시 테이블·single-flight·CDN 캐시·생성 가드의 stale-if-error는 넣지 않는다 — 앞 둘은 요청 제한이 생기면 필요가 없고, 뒤 둘은 `slots.ts:42` '가용성은 캐시하면 안 된다'·'캘린더 조회 실패는 fail-closed'(2026-09-25)라는 기존 결정과 충돌한다.

**비고.** 검증자가 바로잡은 요지: 남용 시에만 가능한 위험이라 P2, 수정안은 1)만 남김. 같은 자리를 다른 축(PAY 결제·주문·예약)도 지적: 슬롯 조회 API에 IP 제한이 없고 매 요청 불필요한 만료 정리 쓰기가 붙는다(규모상 비용은 미미). 같은 자리를 다른 축(DB 스키마·마이그레이션·쿼리)도 지적: 공개 GET /api/bookings/slots가 검증 전에 쓰기 batch(expireStaleOrders)를 돌린다 — 정합성은 이 호출에 기대지 않으므로 뺄 수 있다.

#### SEC-5. IPv6 /64 정규화가 관리자 로그인에만 있고 나머지 21곳의 IP 제한은 주소 하나 단위라 /64 안에서 회전하면 무력화된다 [P2 · S]

**위치**
- `lib/contracts/client-ip.ts:25-34` (`getClientIp`, 원본 그대로 반환)
- `lib/contracts/admin-rate-limit.ts:59` (`normalizeIpForRateLimit` 정의), `:78` (유일한 사용처)
- `lib/contact/rateLimit.ts:76-82`, `:102-118` (별도 getClientIP, 정규화 없음)
- `getClientIp(req) ?? 'unknown'` 21곳: 문의·예약·믹싱·결제링크·펀딩 생성/취소/내려받기·공연 주문/환불·감상실(`pages/api/press/room/[room]/enter.ts:41`)·개설자 로그인/업로드(`pages/api/funding/creator/login.ts`) 등
- `pages/api/funding/pledges.ts:49`

**지금 코드.** `admin-rate-limit.ts` 주석(2026-10-02 코드리뷰, 커밋 d095e39c9a)이 '/64 하나를 통째로 받아 시도마다 새 주소를 쓸 수 있다'고 인정해 로그인에만 /64 접두사로 묶었다. 그 외 21곳은 `getClientIp(req) ?? 'unknown'`을 rate-limit 키로 그대로 쓰고, 그 파일들에서 `ip`는 키 외에 쓰이지 않는다. `lib/contact/rateLimit.ts`에는 별도 getClientIP가 있고 /64 정규화가 없다.

**왜 문제인가.** 문의 폼(IP당 15분 5회), 개설자 로그인 메일 IP 한도, 감상실 비밀번호 시도(15분 10회, 주석에 '대입을 막는 장치는 IP당 횟수 제한뿐'), 펀딩 후원 생성(시간당 20회·한정 리워드 5회, IP가 마지막 방어선), 예약 생성 등이 IPv6 클라이언트에게는 사실상 무제한이다. getClientIP 구현이 둘이라 판정이 갈리는 문제도 남아 있다.

**조건과 결과.** IPv6 /64를 가진 단일 호스트가 문의 메일 폭주, 감상실 비밀번호 대입, 한정 리워드 홀드 선점을 IP 제한 없이 반복할 수 있다. 개설자 로그인·가입은 전역 일일 캡(`login.ts:26,48`)이 있어 '메일 소진'이 아니라 '전역 캡을 대신 소진시켜 정당한 개설자를 막는' 영향이다. 감상실은 해시가 공개 저장소에 있어(SEC-3) 온라인 우회가 더하는 위험은 작다.

**수정.**
1. `lib/contracts/client-ip.ts`에 `getRateLimitSubjectIp(req)`(IPv4는 그대로, IPv6는 /64 접두사)를 추가하고, `normalizeIpForRateLimit`을 그쪽으로 옮겨 export한다. `admin-rate-limit.test.ts`가 admin-rate-limit에서 import하므로 `admin-rate-limit.ts`에서 재export를 남긴다.
2. 21개 `getClientIp(req) ?? 'unknown'`을 모두 `getRateLimitSubjectIp(req) ?? 'unknown'`으로 교체한다. 서명 IP 증거 기록용 `getClientIp`는 원본을 유지한다.
3. `lib/contact/rateLimit.ts`의 자체 getClientIP/normalizeIP를 제거하고 같은 함수를 쓴다.
4. 테스트: `2001:db8:1:2::1`과 `2001:db8:1:2:ffff::9`가 같은 키를 내는지.

**비고.** 검증 confirmed. SEC-7·SEC-8의 전제이므로 먼저 처리한다.

#### SEC-6. 종료(terminated)된 계약은 고객 다운로드·관리자 PDF가 409다 (완료 화면은 내려받을 수 있다고 안내) [P2 · S]

**위치**
- `pages/api/contracts/[id]/download.ts:69-74`
- `pages/api/contracts/[id]/pdf.ts:58`
- `pages/admin/contracts/[id]/index.tsx:574`
- `pages/[locale]/contracts/[id]/complete.tsx:94`, `:244-248`
- `lib/contracts/service.ts:126` (terminateContract), `db/schema.ts:60` (signedAt)

**지금 코드.** `download.ts:69` `if (contract.status !== 'signed') { return res.status(409).json({ ok: false, message: '서명이 완료된 뒤에 계약서를 받으실 수 있습니다.' }); }`, `pdf.ts:58` `if (contract.status !== 'signed') { … '서명이 완료된 계약만 PDF로 받을 수 있습니다.' }`. 반면 `complete.tsx:94`는 `if (status !== 'signed' && status !== 'terminated')`로 terminated도 열고, `:244-248`은 '이 계약은 이용이 종료되었습니다. 서명본은 그대로 보관되며 아래에서 내려받을 수 있습니다'라고 약속한다. 관리자 PDF 버튼(`index.tsx:574`)도 `contract.status === 'signed' && !contract.purgedAt`이다. `git log -S"terminated" -- download.ts pdf.ts`는 결과가 없다.

**왜 문제인가.** `docs/code-review-2026-08-24-round2.md` #9가 'terminated 상태가 서명본 접근 3곳에서 누락'을 지적했고 sign.tsx·complete.tsx만 고쳐졌다. terminated는 실제 상태다(`service.ts:126`이 status='terminated'로 UPDATE).

**조건과 결과.** 이용 종료 후 고객이 완료 화면의 안내대로 다운로드를 누르면 409를 받고, 운영자는 분쟁 때 관리자 화면에서 서명본을 다시 발급하지 못한다(버튼 자체가 없다). 메일에 PDF가 첨부돼 영구히 못 받는 것은 아니다.

**수정.**
1. `lib/contracts/status.ts`에 헬퍼 하나(예: `canAccessSignedCopy(contract)` = `contract.signedAt !== null && (status === 'signed' || status === 'terminated')`)를 두고, `download.ts:69`·`pdf.ts:58`의 게이트를 이것으로 바꾼다. purgedAt 게이트는 유지한다.
2. 관리자 버튼 조건(`pages/admin/contracts/[id]/index.tsx:574`)도 같은 헬퍼로 바꾼다 — API만 고치면 관리자 UI에서는 여전히 버튼이 없다.
3. sign.tsx·complete.tsx도 같은 헬퍼를 쓰게 통일한다.
4. terminated 계약으로 download/pdf가 200인 테스트를 추가한다. PDF 렌더(pdf-storage.ts)는 status에 의존하지 않아 게이트 변경으로 충분하다.

**비고.** 검증자가 바로잡은 요지: 관리자 버튼 조건 누락을 수정안에 추가. 같은 자리를 다른 축(CON 전자계약 — 서명·해시·PDF·보관)도 지적: 이용 종료(terminated) 계약의 서명본이 고객·관리자 모두 내려받을 수 없다 (이전 리뷰 미처리, 완료 화면은 받을 수 있다고 안내).

#### SEC-7. rate_limits.expires_at 인덱스가 없어 매 제한 호출의 만료 행 DELETE가 전체 스캔이다 (현재 6행이라 영향 없음, 예방) [P3 · M]

**위치**
- `db/schema.ts:1011-1017`
- `lib/booking/rate-limit.ts:48`
- `lib/contracts/admin-rate-limit.ts:171·228·288·351·439·476`
- `drizzle/migrations/` (rate_limits 인덱스 없음, 스냅샷 0051 `indexes: {}`)

**지금 코드.** `export const rateLimits = sqliteTable('rate_limits', { key: text('key').primaryKey(), count: integer('count').notNull(), expiresAt: integer('expires_at').notNull() });`에 인덱스 정의가 없다. `rate-limit.ts:48` `await getDb().delete(rateLimits).where(lte(rateLimits.expiresAt, nowSeconds));`와 admin-rate-limit의 6곳이 호출마다 같은 DELETE를 먼저 돌린다. 운영 DB에서 `EXPLAIN QUERY PLAN DELETE FROM rate_limits WHERE expires_at <= 1`은 `SCAN rate_limits`이고 인덱스는 `sqlite_autoindex_rate_limits_1`(key PK)뿐이다.

**왜 문제인가.** 테이블 전체를 읽는다. 지금은 6행이라 무해하고, 행 수는 공격 속도 × 창 길이(IP 키는 대개 1시간 이하)만큼만 늘 수 있다.

**조건과 결과.** 현재 영향 없음. IPv6 주소 회전 등으로 행이 수십만 개로 불어나는 경우에만 Turso rows-read 과금과 지연이 늘어난다. 느려지는 것만으로는 제한이 풀리지 않는다(consumeRateLimit이 true를 돌려주는 때는 예외가 났을 때뿐).

**수정.**
1. `db/schema.ts`의 rateLimits에 `(t) => [index('rate_limits_expires_idx').on(t.expiresAt)]`를 추가하고 새 마이그레이션 하나만 만든다. `when`이 현재 최댓값보다 커야 한다(루트 CLAUDE.md '마이그레이션은 when으로 걸러진다'). 적용은 Turso CLI로 운영자가.
2. 코드는 인덱스 유무와 무관하게 동작하므로 배포 순서 문제가 없다.
3. 별도 DELETE 제거와 CASE UPSERT 재작성은 하지 않는다 — bumpCounter·reserve·checkIdentityAttempt 등 7곳 이상이 '만료 행은 이미 지워졌다'는 전제로 창을 재시작하는 로직이라 돈·계약 경로의 제한 판정을 건드리게 된다.
4. SEC-5(IPv6 /64 묶기)를 하면 행 증가 경로도 함께 줄어든다.

**비고.** 검증자가 바로잡은 요지: 'fail-open 악순환'은 과장, DELETE 제거 제안은 과함, 인덱스 하나로 충분.

#### SEC-8. 문의 폼에 전역 일일 상한과 초과 알림이 없다 (개설자 로그인에는 있음) [P3 · M]

**위치**
- `pages/api/contact/send-email.ts:66-106` (`:69-70`, `:91`)
- `lib/contact/payload.ts:60-65`
- `lib/contact/origin.ts:35-39`
- `lib/contact/rateLimit.ts:8-9`
- 대조: `pages/api/funding/creator/login.ts:26` (`GLOBAL_DAILY_CAP = 100`), `:114-122` (알림)

**지금 코드.** `send-email.ts:69-70` `const honeypotTripped = isHoneypotSubmission(payload.company); const tooFast = isTooFast(payload._formFillMs);`. `payload.ts:60-65`는 `if (typeof formFillMs !== 'number' …) return false; … return formFillMs < MIN_FILL_MS;`라 타입이 안 맞으면 통과한다(이 한계는 주석에 적혀 있다). `origin.ts:35-39`는 Origin·Referer 헤더 문자열 비교. `rateLimit.ts:8-9` `const LIMIT = 5; const WINDOW = 15 * 60;`(IP별만). 개설자 로그인은 전역 일일 캡과 알림이 있다.

**왜 문제인가.** IP별 5회/15분 외에 문의 전체의 시간당·일일 상한이 없다. 허니팟과 fill-time은 클라이언트 신고값이라 스크립트가 우회한다.

**조건과 결과.** IP를 여러 개 쓰는 공격자(또는 IPv6 /64 회전)가 운영자 수신함과 공유 Resend 발송 한도를 채울 수 있다. 실제 피해 규모는 Resend 요금제를 확인해야 알 수 있다(저장소에서 확인되지 않음). 한국어 문의 폼은 90일간 0건(`docs/revenue-growth-strategy-2026-09.md:115`)이고 공격 사례도 없다.

**수정.**
1. SEC-5(IPv6 /64)를 먼저 처리한다 — 현실적 우회 경로의 대부분이 거기서 닫힌다.
2. IP rate limit 통과 뒤 `consumeRateLimit('contact:global:day', 150, 86400)` 하나를 추가하고, 초과하면 429를 돌려 기존 `ContactFormErrorFallback`(카카오톡 대체)이 뜨게 한다. 200으로 삼키지 않는다 — 시계 스큐 사고(7d3acdf835)로 정상 문의가 조용히 사라져 고친 이력과 반대 방향이다.
3. 하루 한 번만 `lib/email/operatorAlert.ts`로 운영자에게 알린다(`login.ts:114-122` 패턴).
4. 서명 토큰(폼 로드 시 발급)은 만들지 않는다 — 공격자가 토큰을 받아 3초 기다리면 끝이라 이득이 없고 엔드포인트·HMAC 키가 늘어난다.

**비고.** 검증자가 바로잡은 요지: 정상 유입이 거의 없고 Resend 한도는 추정이라 P3, '200으로 삼킴'·서명 토큰 제안은 뺌.

#### SEC-9. OG 이미지 엔드포인트가 임의 title을 로고 박힌 이미지로 렌더하고, Redis가 없으면 레이트리밋이 꺼진다 [P3 · M]

**위치**
- `pages/api/og/story.tsx:43-101` (`:48`, `:92`)
- `lib/contact/rateLimit.ts:160-165` (주석)
- `lib/storySeoData.ts:81-82`
- `scripts/social/compose.mjs:64`

**지금 코드.** `story.tsx:48` `if (!redisConfig) return true;` — `getRedisRestConfig()`가 null이면 레이트리밋이 항상 통과한다. `:92` `const title = (searchParams.get('title') || 'Studio NOL').substring(0, 100);`로 title·category·date를 쿼리에서 그대로 받아 Studio NOL 로고가 박힌 이미지로 렌더하며 서명·화이트리스트가 없다. `rateLimit.ts:160-165` 주석은 '프로덕션에는 KV_REST_API_*가 없어서(2026-09-04 전 환경 확인)'. 이번 `vercel env ls production` 재확인은 출력이 없어 확인하지 못했다.

**왜 문제인가.** 문구 위조 이미지를 공식 도메인 URL로 만들 수 있고, 고유 쿼리마다 edge 렌더가 일어난다. 둘 다 규모가 작다 — 이미지는 텍스트만 렌더(satori)하고 스크립트·링크가 없으며, 같은 문구는 아무 도구로나 만들 수 있다.

**조건과 결과.** 프로덕션에 KV 변수가 없다면 레이트리밋 없이 임의 문구 이미지가 `studionol.co.kr/api/og/story?title=…`로 생성된다. 렌더 비용은 edge 호출 비용으로 제한된다.

**수정.**
1. 가장 단순한 길: 코드 변경 없이 Vercel Firewall에 `/api/og/*` 레이트 리밋 규칙을 추가한다.
2. 코드로 하려면 Redis 의존 레이트리밋은 그대로 두고 title 길이 상한(100)을 줄이는 정도로 충분하다.
3. HMAC 서명은 하지 않는다 — `storySeoData.ts:81`과 `compose.mjs:64`(인스타 카드) 둘 다 비밀키를 알아야 하고, 모든 스토리의 og:image URL이 바뀌며(카카오가 URL 단위로 캐시), edge에서 crypto 검증과 새 env가 필요하다.

**비고.** 검증자가 바로잡은 요지: 심각도 낮음, HMAC 서명 제안은 과함.

#### SEC-10. 관리자 세션이 계정 비밀번호 변경으로 철회되지 않는다 (최대 24시간 잔존) [P3 · M]

**위치**
- `lib/contracts/admin-session.ts:91-105` (`:100`), `:14-27` (ttl)
- `lib/contracts/admin-auth.ts`, `lib/contracts/admin-accounts.ts`, `pages/api/admin/auth.ts`
- 대조: `lib/funding/creatorAuth.ts:28-41` (`verifyCreatorSessionVersion`)
- `docs/code-review-2026-08-24.md:72` (#5)

**지금 코드.** `admin-session.ts:100` `if (session.adminId && !resolveAdminAccounts().some((account) => account.id === session.adminId)) return null;` — adminId가 ADMIN_ACCOUNTS에 있는지만 본다. 세션에는 비밀번호와 묶인 값이 없다. 개설자 세션은 `session_version`으로 철회되고 logoutCreatorSession이 `session_version + 1`을 한다. TOTP/otp/allowlist는 코드베이스에 없다(grep 0건).

**왜 문제인가.** 같은 id의 password만 바꿔도 이미 발급된 쿠키가 ttl(24시간) 끝까지 유효하다. 2026-10-02(d095e39c9a)에 '낮은 위험 항목'으로 분류해 id 삭제 시 세션 철회까지만 넣었고, 이 틈은 그 연장선이다.

**조건과 결과.** 비밀번호 유출 대응 시 비밀번호만 바꾸면 공격자 세션이 최대 24시간 남는다. 현재 대응은 ADMIN_SESSION_SECRET 회전이나 계정 id 삭제다. 선행 조건이 이미 비밀번호가 유출된 상태라 P3.

**수정.**
1. 로그인 시 `loginAdminSession`이 세션에 `pv = HMAC-SHA256(ADMIN_SESSION_SECRET, id + ':' + password)`의 앞 16자를 저장한다.
2. `adminSessionIdentity`가 해당 계정으로 다시 계산해 다르면 null을 돌려준다.
3. 배포 시 기존 세션은 한 번 재로그인하게 된다(24시간 ttl이라 영향이 작다).
4. TOTP·Deployment Protection은 round1 문서가 '장기적으로'라고 붙인 별건이고, 비밀번호를 scrypt 해시로 env에 두는 안은 효과가 작다(Vercel env를 읽을 수 있으면 ADMIN_SESSION_SECRET·DB 토큰·FUNDING_FIELD_KEY도 함께 읽힌다). ADMIN_ACCOUNTS 형식이 복잡해질수록 '오타 하나면 공개 사이트 빌드가 선다'는 기존 위험이 커지므로 이 항목에서 제외한다.

**비고.** 검증자가 바로잡은 요지: P2 → P3, 세션 비밀번호 지문 저장만 가치가 있음.

#### SEC-11. AES-GCM에 AAD(행·컬럼 바인딩)가 없다 (DB 쓰기 권한자의 암호문 바꿔치기 방어 심화) [P3 · M]

**위치**
- `lib/crypto/fieldCrypto.ts:204-254` (`:209`, `:243-246`)
- `lib/crypto/fieldKeyRotation.ts:207`
- `lib/funding/payoutAccountCrypto.ts:48-50`
- 사용처: `funding_creators.payout_account_enc`, `resident_number_enc`, `refund_accounts.account_number_enc`

**지금 코드.** `:209` `const cipher = createCipheriv('aes-256-gcm', key, iv);` 뒤 `setAAD` 호출이 없고(lib/crypto 전체 grep), `:243-246` `const decipher = createDecipheriv('aes-256-gcm', key, iv); decipher.setAuthTag(tag); … decipher.update(ciphertext), decipher.final()`도 마찬가지다. 암호문이 어느 행·컬럼 것인지 인증 데이터에 묶여 있지 않다.

**왜 문제인가.** DB 쓰기만 가능한 쪽이 암호문을 행 사이에 옮겨도 복호화가 성공한다. 다만 위협 전제가 좁다 — FUNDING_FIELD_KEY와 Turso 토큰은 둘 다 Vercel env에 있어 환경 열람자는 둘을 함께 얻는다. 키 없이 DB만 쓰는 상황은 토큰만 유출된 경우뿐이고, 그때도 공격자는 자기 계좌의 암호문(정상 환불·정산 입력으로 만든 것)을 피해자 행에 복사해야 한다. payout 봉투에는 holder가 암호문 안에 있지만 개설자 실명과 대조하는 코드는 확인하지 못했다.

**조건과 결과.** Turso 토큰만 유출되고 필드 키는 안 새는 좁은 경우에, 환불·정산 송금처가 공격자가 정상 경로로 등록한 계좌로 바뀔 수 있다.

**수정.**
1. 지금 판본을 올리지 않는다. 다음에 이 모듈의 판본을 올릴 일이 생길 때 v3로 AAD(`테이블.컬럼:행키`)를 넣는다. 그때 `encryptField/decryptField` 서명 변경, `rotate-field-key`의 `encryptFieldWithKey(decryptFieldWithKey(...))` 경로(`fieldKeyRotation.ts:207`)가 행 키를 넘기도록 엔진 수정, 롤백 시 v3이 옛 코드에서 malformed로 읽히는 경고를 `lib/crypto/CLAUDE.md`에 추가하는 것까지 한 벌이다.
2. 당장은 정산·환불 송금 화면에서 예금주를 개설자·주문자 정보와 대조하는 쪽이 더 싸다.

**비고.** 검증자가 바로잡은 요지: 주민번호 암호화는 법적 의무 경로라 변경 위험이 이득보다 크다, 방어 심화로 기록. 같은 자리를 다른 축(PRV 개인정보·처리방침 정합·로그)도 지적: 필드 암호문이 행 문맥(AAD)에 묶이지 않아, DB 쓰기 권한만 가진 공격자가 환불 계좌 암호문을 다른 주문 행으로 옮길 수 있다(심층 방어 공백).

#### SEC-12. 수신 메일 포워딩이 외부 HTML을 hello@ 발신으로 재발송한다 (도메인 평판·사칭 방어 심화) [P3 · M]

**위치**
- `pages/api/inbound/resend.ts:186-206` (`:187-189`, `:197-205`)
- `lib/email/inboundWebhook.ts:80-92`
- `tests/api/inbound-webhook.test.ts`, `lib/operatorContact.ts`

**지금 코드.** `:187-189` `const html = email.html ? email.html + (skippedNotice ? \`<hr><p>${skippedNotice.trim()}</p>\` : '') : undefined;`, `:197-205` `from: \`${sender.displayName} <${INBOUND_ALIAS}>\`, to: [FORWARD_TO], reply_to: email.from, subject: email.subject || '(제목 없음)', … html, attachments`. displayName은 제어문자·꺾쇠·따옴표만 제거된다.

**왜 문제인가.** 외부 발신자의 표시 이름·HTML·첨부가 스튜디오 도메인(SPF/DKIM 정렬) 발신으로 운영자 Gmail에 간다. 이 주소는 공개된 대표 연락처이고 운영자는 이 경로로 외부 메일을 받는 것을 전제로 하므로, 가산되는 위험은 '자기 도메인 발신처럼 보이는 것'이다. 웹훅 재생은 svix HMAC 서명 검증에 비밀이 필요해 공격 경로가 없다.

**조건과 결과.** 스팸이 이 경로로 studionol.co.kr DKIM을 달고 Gmail로 가면, 운영자가 스팸 신고할 때 결제 확인 메일(noreply@studionol.co.kr)과 같은 도메인 평판이 깎일 수 있다. 운영자 오인 가능성은 낮다.

**수정.** 가장 싼 조치부터 한다.
1. text 본문 맨 앞에 `원 발신: <email.from>` 한 줄을 붙인다.
2. 실행 파일 확장자 첨부(.exe .scr .js .html 등)는 skipped로 돌린다.
3. 필요하면 From을 별도 주소로 바꾸되, 운영자 Gmail 필터·답장 별칭에 영향이 없는지 먼저 확인한다. 제목 접두사도 같은 이유로 확인 뒤에.
4. HTML 정화 라이브러리(sanitize-html)와 svix-id 멱등 표는 넣지 않는다.

**비고.** 검증자가 바로잡은 요지: 현실적 위험은 피싱 클릭보다 도메인 평판, 재생 주장은 공격 경로 없음.

#### SEC-13. [locale] GSSP 페이지가 no-store를 빠뜨려도 잡는 CI 가드가 없다 (현재 노출 없음) [P3 · S]

**위치**
- `next.config.mjs:251-256`
- `lib/contracts/page-cache.ts:10-14`
- `lib/analytics/privatePaths.ts:30`
- `tests/config/noStoreHeaders.test.ts`
- 개인 GSSP 예: `pages/[locale]/funding/creator/index.tsx:136`, `[id].tsx:467`, `[id]/shipping.tsx:92`, `[id]/preview.tsx:95`, `pages/[locale]/press/sabbaha-slung.tsx:516`

**지금 코드.** `next.config.mjs:252-255` `source: '/:locale(ko|en|zh|es|vi|th|uz)/:path*', headers: [{ key: 'Cache-Control', value: 'public, s-maxage=3600, stale-while-revalidate=86400' }]`. `page-cache.ts` 주석대로 GSSP가 Cache-Control을 안 붙이면 이 설정 헤더가 그대로 나간다. `privatePaths.ts:30`에는 `['funding/creator/auth', false]`만 있고 creator/[id]·shipping·preview·press는 설정 층 규칙이 없다 — 각 GSSP가 첫 줄에서 `context.res.setHeader('Cache-Control','no-store')`로만 방어한다. `noStoreHeaders.test.ts`는 PRIVATE_SOURCES(목록→config) 방향만 검사한다.

**왜 문제인가.** 회귀 방지 장치가 없다. pages/[locale] 아래 GSSP 34개 파일 전수 확인 결과 Cache-Control을 안 쓰는 것은 terms.tsx, booking/[service].tsx, booking/index.tsx 셋이고 모두 공개 페이지라 현재 노출은 없다.

**조건과 결과.** 앞으로 추가되는 개인정보 GSSP 페이지에서 한 줄을 빠뜨리면 개설자 배송지·정산 화면이 공유 캐시에 최대 1시간 + SWR 24시간 실린다. 지금은 해당 없음.

**수정.**
1. `tests/config/gsspCacheGuard.test.ts`를 추가한다. `pages/[locale]/**/*.tsx` 중 `getServerSideProps`가 있는 파일은 본문에 `Cache-Control` 또는 `denyContractPageCaching`이 있거나, 이유를 적은 허용 목록(terms, booking/index, booking/[service] 등 공개 페이지)에 있어야 통과한다(pageScaffold 가드와 같은 방식).
2. `privatePaths.ts`에 정규식 문법의 경로(`funding/creator/[^/]+`)를 넣지 않는다 — PRIVATE_ROUTE_BODIES는 같은 문자열이 정규식과 Next `source`(path-to-regexp) 양쪽에 쓰이는 한 벌 정의라 헤더 `source`가 깨지고, 분석 스크립트 mount 제외·Layout 껍데기 제거(PRIVATE_PAGE_ROUTES)에도 쓰여 부작용이 크다.

**비고.** 검증자가 바로잡은 요지: 현재 노출 없음을 34개 전수로 확인, privatePaths 변경 제안은 구조상 불가.

#### SEC-14. 관리자 쓰기 API에 Origin 검사가 없다 (SameSite=Strict는 형제 서브도메인을 막지 못한다) [P3 · S]

**위치**
- `lib/contracts/admin-auth.ts:66-73` (`authenticateAdminApi`)
- `lib/contracts/admin-session.ts:18`, `:31-37`
- `lib/contact/origin.ts` (`isAllowedContactRequestOrigin`)
- 대조: `pages/api/funding/creator/projects/[id].ts:29`

**지금 코드.** `admin-session.ts:31-37` `cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: SESSION_SECONDS }`. `pages/api/admin/**` 어디에도 `isAllowedContactRequestOrigin` 호출이 없고, 개설자 API는 14개 핸들러가 `if (!isAllowedContactRequestOrigin(req)) return res.status(403)…`을 한다.

**왜 문제인가.** SameSite=Strict는 같은 사이트(eTLD+1)인 press.studionol.co.kr(같은 Vercel 프로젝트가 서빙) 같은 형제 호스트의 요청에는 쿠키를 보낸다. 저장소에 Access-Control-* 헤더가 없어 JSON 본문의 PATCH/DELETE는 프리플라이트에서 막히지만, urlencoded 폼으로 보낼 수 있는 POST 핸들러(bookings/[id] POST, subscriptions POST, artists/payouts POST, shows/[id] POST, blocks POST, funding/pledges POST)는 형제 호스트에서 위조 요청이 닿는다. cookie tossing은 iron-session 봉인 쿠키라 위조는 불가능하고 로그인 방해 수준이다.

**조건과 결과.** 형제 서브도메인에서 공격자 콘텐츠가 실행되는 사고가 났을 때 관리자 POST(예약 확정·입금 확인·정산 처리 등)에 방어선이 하나 모자란다. 지금 그 경로는 코드로 확인되지 않는다.

**수정.**
1. `authenticateAdminApi` 안에서 `req.method !== 'GET'`이면 이미 있는 `isAllowedContactRequestOrigin(req)`을 재사용해 아니면 403을 돌려준다.
2. Sec-Fetch-Site 새 분기는 필요 없다. `__Host-` 쿠키 접두사는 효과가 작고 배포 때 전원이 재로그인하므로 선택 사항이다.

**비고.** 검증자가 바로잡은 요지: 'PATCH/POST/DELETE 전부'는 과장, 닿는 것은 urlencoded POST뿐.

#### SEC-15. 헤더로 전송되는 관리자 비밀번호가 전송 가능한 문자 범위를 검증하지 않는다 [P3 · S]

**위치**
- `lib/contracts/admin-accounts.ts:92-94`, `:46-53` (주석)
- `pages/admin/login.tsx:23`, `:38`
- `lib/contracts/admin-auth.ts:21`, `:77`
- `pages/api/admin/auth.ts`, `lib/contracts/admin-auth.identity.test.ts`

**지금 코드.** `admin-accounts.ts:92` `if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {` — 길이만 본다. `login.tsx:23` `headers: { 'x-admin-password': password }`, `admin-auth.ts:77` `matchAdminAccount(req.headers['x-admin-password'])`. Node에서 `new Headers({'x-admin-password':'비밀번호abcdefgh1234'})`가 TypeError(ByteString 255 초과)를 던지는 것을 실행해 확인했다.

**왜 문제인가.** 비밀번호가 헤더로만 가므로 ISO-8859-1(0x00-0xFF) 밖 문자는 브라우저 fetch 단계에서 TypeError가 나 로그인이 영구히 불가능하다. 앞뒤 공백도 헤더 처리에서 잘려 일치하지 않는다. 배포·빌드는 정상 통과한다. `login.tsx:38`이 err.message를 화면에 띄우지만 영어 브라우저 오류 문구라 운영자가 원인을 알아보기 어렵다.

**조건과 결과.** 비밀번호 교체 때 운영자가 한글·이모지·앞뒤 공백 비밀번호를 고르면 자기를 잠근다. 그 경우에만 발생한다.

**수정.**
1. `parseAdminAccounts`에서 전송 가능한 범위만 검사한다: 모든 문자 코드가 0x20-0xFF이고 `password === password.trim()`이면 통과, 아니면 `fail()`. `/^[\x21-\x7E]{13,128}$/` 같은 좁은 정규식은 쓰지 않는다 — 공백이나 Latin-1 문자가 든 지금 운영 비밀번호가 새 검사에 걸리면 `admin-auth.ts:21`이 모듈 로드 때 `resolveAdminAccounts()`를 부르므로 관리자 모듈이 통째로 터진다.
2. 지금 운영 값이 새 검사를 통과하는지 먼저 확인한 뒤 배포한다.
3. 더 근본적으로는 로그인을 POST JSON 본문으로 옮겨 헤더 제약을 없앤다(`auth.ts`·`login.tsx`·`identity.test.ts` 수정).
4. 반복 문자 같은 약한 값 차단은 하지 않는다(`admin-accounts.ts:46-53` 설계 주석대로).

**비고.** 검증자가 바로잡은 요지: '원인을 알리는 오류도 없다(401)'는 틀림(fetch TypeError가 화면에 뜸), 좁은 정규식 제안은 위험.

#### SEC-16. adminId 없는 옛 세션 호환 분기가 호환 기간(24시간)이 끝난 뒤에도 남아 있다 [P3 · S]

**위치**
- `lib/contracts/admin-session.ts:68-104` (`:84-87` 주석, `:100`, `:102`)
- `lib/contracts/admin-auth.ts`
- `lib/contracts/admin-auth.identity.test.ts` ('옛 세션 호환' describe)
- `lib/privacy/accessLog.ts`

**지금 코드.** `:100` `if (session.adminId && !resolveAdminAccounts().some((account) => account.id === session.adminId)) return null;`, `:102` `actor: session.adminId || ADMIN_FALLBACK_ID`. 주석 `:84-87` '하루가 지나면 이 갈래로 오는 세션은 사라진다'.

**왜 문제인가.** ttl 24시간은 894e3d2722(2026-08-04), 계정 분리(31d3bb5626)는 2026-09-25 배포라 adminId 없는 쿠키는 늦어도 2026-09-26에 전부 만료됐다. 로그인은 항상 adminId를 담는다(ADMIN_ACCOUNTS 미설정 시에도 폴백 계정 id 'admin'이 나온다). 코드는 발급될 수 없는 봉인을 로그인 상태로 인정하고 actor를 'admin'으로 기록하는 죽은 갈래다.

**조건과 결과.** 보안 영향은 없다 — ADMIN_SESSION_SECRET 보유자는 isLoggedIn만 봉인하는 것보다 유효한 adminId를 봉인하는 쪽이 더 낫고, 'admin'으로 남는 쪽이 오히려 덜 위장적이다. 읽는 사람을 헷갈리게 하는 정리 부채다.

**수정.**
1. `isAdminSessionValid`를 `Boolean(session.isLoggedIn && session.adminId)`로 바꾼다.
2. `adminSessionIdentity`의 `|| ADMIN_FALLBACK_ID` 갈래와 주석의 옛 세션 호환 문단을 지운다.
3. `admin-auth.identity.test.ts`의 '옛 세션 호환' describe(adminId 없는 세션이 유효하다는 케이스)는 '무효다'로 뒤집는다.

**비고.** 검증자가 바로잡은 요지: 보안 지적이 아니라 정리 항목, 수정안은 안전.

#### SEC-17. Instagram·Threads 토큰이 DB에 평문이다 (빌링키도 마찬가지) [P3 · M]

**위치**
- `db/schema.ts:1030-1037` (socialTokens), `:1191` (billing_keys.billing_key)
- `lib/social/tokens.ts:55-56`
- `pages/api/cron/social-refresh.ts`
- `lib/crypto/fieldCrypto.ts`, `lib/crypto/fieldKeyRotation.ts:67` (ENCRYPTED_FIELD_TARGETS), `fieldKeyRotation.integration.test.ts:108` (SEEDERS)
- `scripts/social/meta.mjs`, `scripts/social/auth.mjs`

**지금 코드.** `export const socialTokens = sqliteTable('social_tokens', { platform: text('platform').primaryKey(), accessToken: text('access_token').notNull(), …`. `tokens.ts:55-56` `const params = new URLSearchParams({ grant_type: grant, access_token: row.accessToken });`. 주민번호·계좌만 fieldCrypto로 암호화되고, 카드를 청구할 수 있는 토스 빌링키도 평문이다.

**왜 문제인가.** 이 저장소의 선례는 '법적 의무이거나 계좌류만 암호화'다. 소셜 토큰만 암호화하면 위협 모델이 일관되지 않고 이득이 작다(60일 토큰, Meta 앱 설정에서 즉시 폐기 가능).

**조건과 결과.** Turso 읽기 권한이 새면 스튜디오 IG/Threads 게시권이 넘어간다. 토큰은 Meta에서 폐기할 수 있어 피해 범위가 한정된다.

**수정.** 지금 하지 않아도 되는 항목으로 둔다.
1. 할 경우 소셜 토큰 하나가 아니라 비밀 컬럼 전반(빌링키 포함)을 같은 방식으로 정리한다.
2. 소셜 토큰만 할 때의 범위: `encryptField` 저장과 평문 폴백 읽기를 `tokens.ts`·`meta.mjs`·`auth.mjs` 세 곳에 넣고, `ENCRYPTED_FIELD_TARGETS`에 대상을 더하면 SEEDERS 짝 검사·헬스체크 회전 점검·`rotate-field-key`가 함께 움직이므로 같이 처리한다. 로컬 CLI는 순수 .mjs라 .ts인 fieldCrypto를 import하려면 tsx 실행으로 바꾸고 `.env.local`에 FUNDING_FIELD_KEY가 있어야 한다. 마이그레이션은 불필요하다. 키를 잃으면 토큰은 재승인으로 복구된다.

**비고.** 검증자가 바로잡은 요지: 수정 비용이 제안보다 크고 우선순위 낮음.

#### SEC-18. CSP script-src에 쓰이지 않는 google.com·gstatic.com 호스트가 남아 있다 [P3 · M]

**위치**
- `middleware.ts:93`
- `next.config.mjs`, `pages/_document.tsx`, `public/scripts/ga4-init.js`

**지금 코드.** `middleware.ts:93` `"script-src 'self' https://js.tosspayments.com https://www.google.com https://www.gstatic.com https://va.vercel-scripts.com https://www.googletagmanager.com https://t1.kakaocdn.net https://dapi.kakao.com"`. `public/scripts`에는 ga4-init.js·theme-init.js뿐이고 recaptcha 사용처는 없다(grep 0건). www.google.com은 지도 iframe(frame-src)에서만 쓰이며 iframe은 script-src와 무관하다. 2026-02 보안 커밋(dd29f3ef10)에서 들어온 잔재다. report-uri/report-to도 없다.

**왜 문제인가.** 호스트 허용 방식 CSP에서 이 두 호스트는 알려진 JSONP 우회 가젯이다. 다만 unsafe-inline이 없고 `script-src-attr 'none'`, `object-src 'none'`, `base-uri 'self'`가 있어 인라인·이벤트 핸들러 주입은 막히고, JSONP 가젯을 쓰려면 먼저 `<script src>` 주입이 가능해야 하는데 MarkdownRenderer는 raw HTML을 끈다.

**조건과 결과.** XSS 주입 지점이 생겼을 때 우회 표면이 되지만, 주입 지점 자체가 현재 막혀 있어 방어 심화 수준이다.

**수정.**
1. 같은 정책에 `Content-Security-Policy-Report-Only` 사본(script-src에서 www.google.com·www.gstatic.com 제외)을 report-to와 함께 2주 내보내 위반이 없는지 본 뒤 본 정책에서 두 호스트를 뺀다 — gtag가 www.google.com에서 스크립트를 따로 받는지 코드로 확인되지 않으므로 관측이 먼저다. GTM 호스트는 gtag.js 로드에 필요하니 그대로 둔다.
2. nonce+strict-dynamic은 도입하지 않는다 — SSG/ISR 중심(스토리 1,276장 프리렌더)이라 요청별 nonce는 정적 최적화를 깨고, 2026-02에 nonce를 도입했다가 외부 스크립트화로 걷어낸 이력이 있다.
3. X-Frame-Options와 frame-ancestors 정합은 영향이 없어 생략한다(frame-ancestors가 있으면 최신 브라우저는 XFO를 무시한다).

**비고.** 검증자가 바로잡은 요지: '방어선 역할을 못 한다'는 과장, nonce 제안은 비현실적.

#### SEC-19. manageToken(예약·구독 관리 링크)이 평문 저장·무기한 유효다 [P3 · L]

**위치**
- `db/schema.ts:305-306` (orders.manageToken), subscriptions.manageToken
- `lib/billing/service.ts:233`, `:239` (`isTokenMatch(subscription.manageToken, token)`)
- `lib/analytics/privatePaths.ts:37`, `:70`
- 평문으로 URL을 다시 조립하는 곳: `lib/booking/bankDeposit.ts:48`, `lib/booking/email.ts:53`, `lib/shows/email.ts:86-172`, `lib/billing/email.ts:21`
- 대조: `lib/shows/scanLink.ts:11`, `lib/funding/creatorToken.ts:109` (SHA-256 해시 저장)

**지금 코드.** orders.manageToken(예약·믹싱·공연·펀딩 공용)과 subscriptions.manageToken은 평문으로 저장되고 만료·회전이 없다. `privatePaths.ts:70` 주석: '(subscription) manageToken은 만료도 1회성도 없고 그 값 하나로 결제 이력 열람·해지·새 카드등록 토큰 발급까지 된다'. `billing/service.ts:233` 주석이 '상시 토큰, orders.manageToken과 같은 성질'로 의도를 밝힌다. 서버는 이후 메일(입금 안내, 취소·환불 안내, 공연 취소 안내 등)에서 이 평문으로 URL을 다시 조립한다. 계약 signToken은 해당 없다 — `contracts.expiresAt`이 링크 만료로 쓰이고(`sign-transaction.ts:69`), 서명 시 `signTokenUsedAt`으로 1회성이 되며(`:120`), 재발송하면 새로 발급돼 이전 링크가 무효화된다(`:60`).

**왜 문제인가.** 스캔·개설자 링크는 발급 응답에 한 번 주고 끝나는 구조라 해시 저장이 맞지만, manageToken은 용도가 다르다. 해시만 두면 이 메일들을 보낼 수 없거나 발송 때마다 토큰을 회전해야 한다.

**조건과 결과.** DB 읽기 유출 시 진행 중인 예약·구독의 셀프 취소·해지 링크가 쓰일 수 있다. 같은 DB에 고객 이름·연락처가 평문이라 증분 위험은 작다.

**수정.**
1. 해시 저장 전환은 하지 않는다.
2. 줄일 위험이 있다면 구독 manageToken을 해지 확정·카드 변경 요청 시 회전시키는 쪽이 비용이 작다.
3. 코드 주석이 이미 의도를 밝히고 있어 문서화 수준으로 두어도 된다.

**비고.** 검증자가 바로잡은 요지: 계약 signToken 부분은 사실과 다름(만료·1회성·회전 있음), 해시 저장 제안은 그대로는 불가. 같은 자리를 다른 축(DB 스키마·마이그레이션·쿼리)도 지적: raw SQL의 status/type 리터럴이 enum과 맞는지 검사하는 가드가 없다.

#### SEC-20. 관리자 펀딩 내보내기만 HTTP 메서드를 제한하지 않는다 [P3 · S]

**위치**
- `pages/api/admin/funding/export.ts:46-50`
- 대조: `pages/api/admin/orders/export.ts:21-26`
- 크론: `pages/api/cron/billing-charge.ts:128`, `gsc-audit.ts:91`만 메서드 검사; backup-contracts·purge-contracts·purge-funding·purge-orders·health-check·review-requests·social-refresh·expire-show-orders는 없음(`lib/cron/auth.ts` isCronAuthorized가 막음)

**지금 코드.** `export.ts:46-50` `export default async function handler(req, res) { res.setHeader('Cache-Control','no-store'); const auth = await authenticateAdminApi(req, res); if (!auth.ok) return res.status(401)…; const slug = …` — `req.method` 검사가 없다. `orders/export.ts:21-26`은 `if (req.method !== 'GET') { res.setHeader('Allow','GET'); return res.status(405)…`. 관리자 API 21개 파일 중 메서드 검사가 없는 것은 이 하나뿐이다(refund-account 두 파일은 공용 `handleRefundAccountView`가 GET만 허용, `refundAccountView.ts:42`).

**왜 문제인가.** POST/PUT/DELETE로도 CSV가 만들어지고 접속기록이 남는다. 읽기 전용이고 SameSite=Strict라 교차 사이트 호출이 어렵다. 크론 8개는 Bearer CRON_SECRET(SHA-256+timingSafeEqual, 시크릿 없으면 fail-closed)이 막아 메서드 제한이 보안과 무관하다.

**조건과 결과.** 보안 영향 없음. API 표면이 의도보다 약간 넓은 일관성 문제다.

**수정.**
1. `export.ts` 핸들러 맨 앞에 `orders/export.ts:21-26`과 같은 형태로 GET 아니면 Allow 헤더와 405를 돌려주는 3줄을 넣는다.
2. 크론 래퍼(withCron)·allowMethods·readJsonObject 공용화는 하지 않는다 — 해당 패턴은 pages/api 전체 15회(관리자 6파일 7회)라 추상화 비용이 더 크다.

**비고.** 검증자가 바로잡은 요지: 범위가 export.ts 하나로 줄고, '보일러플레이트 25번 복제'는 과장.

#### SEC-21. press 호스트 격리의 /api 쪽 불변식이 핸들러별 기억에 의존한다 [P3 · S]

**위치**
- `middleware.ts:361` (matcher), `:189` (press 호스트 분기)
- `pages/api/press/optouts.ts:23`, `pages/api/press/room/[room]/enter.ts:24`, `pages/api/press/room/[room]/audio.ts:17`
- `lib/press/host.ts`

**지금 코드.** `middleware.ts:361` `'/((?!api|_next|\\.well-known|favicon\\.ico|…).*)'`가 api를 제외하므로 `:189` `if (request.headers.get('host') === PRESS_HOST) { … return setSecurityHeaders(new NextResponse(null, { status: 404 })) }`는 /api/**에 걸리지 않는다. 호스트 재확인은 press 핸들러 3곳이 각자 `if (req.headers.host === PRESS_HOST) return res.status(404)`로 한다. `optouts.ts` 머리 주석이 이 구조와 이유를 밝혀 둔 의도된 설계이고, 이를 강제하는 테스트는 optouts 하나뿐이다.

**왜 문제인가.** press.studionol.co.kr에서도 /api/**가 응답한다. 다만 `/api/admin/auth`, `/api/contact/send-email`은 정본 호스트에서도 똑같이 열려 있고, 세션 쿠키는 호스트 한정이며 Origin 허용 목록에도 press 호스트가 없어 press 호스트로 호출해서 얻는 새 능력이 없다. 실제 위험은 장래 press 전용 API(명단류 경로)가 호스트 확인을 빠뜨리는 것이다.

**조건과 결과.** 현재 실해 없음. 미래 핸들러가 확인을 빠뜨릴 때만 조용히 열린다.

**수정.**
1. matcher·next.config는 건드리지 않는다 — matcher에 `/api/:path*`를 추가하면 모든 API 요청이 미들웨어(로케일·정규화·canonical 308)를 타고, next.config의 호스트 조건 rewrite는 middleware의 `/u/<token>` 내부 rewrite와 상호작용 가능성이 있어 검증 비용이 크다.
2. `pages/api/press/**` 핸들러가 `unsubscribe/[token].ts`를 제외하고 모두 PRESS_HOST 확인을 포함하는지 파일을 훑어 검사하는 테스트 하나를 추가한다(pageScaffold 가드와 같은 방식).

**비고.** 검증자가 바로잡은 요지: '불필요한 공격 표면 노출'은 과장, matcher/rewrite 변경 제안은 위험.

#### SEC-22. 문의 레이트리밋이 Redis 실패 시에만 fail-closed(503)이고 DB 단계는 fail-open이다 [P3 · S]

**위치**
- `lib/contact/rateLimit.ts:188-193`, `:150-173` (주석)
- `pages/api/contact/send-email.ts:47-49`
- `lib/rate-limit/redisRest.ts:67-70`
- `tests/api/contact/send-email.test.ts:204-213`
- 대조: `lib/booking/rate-limit.ts:66-69` (catch → return true)

**지금 코드.** `rateLimit.ts:188-193` `catch (error) { if (… exceeded) throw error; console.error('[Rate Limit] Redis REST failed:', error); throw new Error(CONTACT_RATE_LIMIT_ERROR.unavailable); }` → `send-email.ts:47-49`가 503을 돌려주며, `send-email.test.ts:204-213`이 이 동작을 고정한다. 같은 파일 `:170-173` 주석은 'DB를 못 읽으면 통과시킨다 … 문의는 검증된 유일한 전환 경로라 놓치는 쪽의 손실이 더 크다', `:150-173`은 '저장소는 세 단계: Redis → Turso → 메모리'. `redisRest.ts:67-70`의 `incrWithExpire`는 `EXPIRE ... NX` 결과(results[1])를 확인하지 않는다.

**왜 문제인가.** KV가 설정된 환경에서 Redis 호출이 실패하면 DB·메모리 단계로 떨어지지 않고 503이다. 문서화된 방침(문의는 놓치지 않는다)과 어긋난다. NX는 Redis 7.0 이상이고 Upstash류는 지원하므로 곁가지다.

**조건과 결과.** 프로덕션은 KV_REST_API_* 미설정(2026-09-04 주석)이라 현재 휴면 경로다. KV를 연결한 뒤 Redis 장애가 나면 문의 폼 전체가 503이 된다. KV를 켜는 것만으로 막히지는 않는다.

**수정.**
1. catch에서 exceeded만 다시 던지고, 그 외 오류는 console.error 후 아래 `isDurableStoreConfigured()`/메모리 단계로 이어지게 한다.
2. `send-email.test.ts:204`의 503 기대를 폴백 통과로 바꾼다.
3. `incrWithExpire`의 `results[1].error` 확인은 선택 사항이다.

**비고.** 검증자가 바로잡은 요지: 'KV를 켜는 순간 문의가 막힌다'는 틀림, 막히는 것은 Redis 호출 실패 때뿐.

**클린 판정**
- lib/cron/auth.ts와 pages/api/cron/* 10개 전부 isCronAuthorized(SHA-256 고정길이 + timingSafeEqual, CRON_SECRET 없으면 fail-closed)를 거친다. 이전 리뷰 #18 처리 확인
- pages/api/admin/** 21개 핸들러와 pages/admin/*.tsx 18개 GSSP(login 제외) 전수 확인: 모두 authenticateAdminApi/authenticateAdminRequest 가드가 있다. refund-account 2개 라우트는 공용 handleRefundAccountView 안에서 인증·no-store·접속기록(성공/실패)을 수행한다
- 관리자 로그인: sha256 후 timingSafeEqual을 계정 전체에 대해 일찍 빠지지 않고 수행, 예약(원자적 UPSERT)을 대조 앞에 두는 순서, 쿠키 속성(HttpOnly·Secure(prod)·SameSite=Strict·ttl=maxAge 24h), ADMIN_ACCOUNTS 중복 id/비밀번호 fail-fast, 응답 문구 이유 비노출
- middleware.ts: /admin CSP 조기 반환, press 호스트 격리, 소문자/슬래시 정규화 리다이렉트가 origin+path 문자열 구성이라 오픈 리다이렉트 없음, 라우트 패턴 URL 404, 정규화된 URL로 rewrite해 경로 우회 불가
- Toss 웹훅: 페이로드를 신뢰하지 않고 fetchPayment 재조회 상태로 멱등 키를 만들고, 일시 실패 시 키 회수 후 500, 중복은 unique 위반으로 200, IP 제한 적용
- Resend 수신 웹훅: 원문 바디 svix HMAC 검증(timingSafeEqual, 5분 허용, v1 다중 서명), 키/시크릿 없으면 500, displayName 제어문자·꺾쇠 제거
- 토큰 비교: isTokenMatch(sha256+timingSafeEqual), 스캔/현황/개설자 로그인 토큰은 192~256비트 + SHA-256 해시 저장 + 만료/폐기, 모든 manageToken 엔드포인트가 주문 부재와 토큰 불일치를 같은 404로 응답
- 개설자 세션: session_version 서버측 폐기, 로그아웃이 버전 증가, 쓰기/업로드는 Origin 검사 + `creatorId` WHERE 소유 가드, 남의 프로젝트는 404
- 개설자 업로드: 스트리밍 상한(8MB) 즉시 중단, sharp 재인코딩(EXIF 제거)·픽셀 4천만 상한, 프로젝트당 30장, creatorId 접두사 파일명, 승인 참조·소유자·관리자만 서빙하는 미디어 라우트와 경로 화이트리스트(FILENAME 정규식, 세그먼트 1개, .webp)
- 계약 PDF 렌더: puppeteer request interception으로 data:/about:만 허용, markdown 옵션 sanitizer가 URL을 비우고 escapeTableCell로 태그·파이프 차단; 서명 이미지/서명자 입력 검증
- CSV 내보내기 4종이 공통 toCsv의 수식 인젝션 방어(=,+,-,@,탭,CR 접두 `'`)를 사용하고 접속기록(rowCount)을 남긴다
- 예약·믹싱·펀딩의 releaseOrderNo 소유 증명(추측 불가 orderNo + 이메일·전화 방어 깊이), 다운로드 POST 전용 + 기록 UPDATE의 WHERE 재확인, 감상실 쿠키 HMAC 서명(도메인 분리, 만료 포함, HttpOnly)·음원 서명 URL 6시간
- 수신거부 토큰: HMAC 검증을 rate limit 앞에 두고 GET은 상태 변경 없음, PRESS_PULL_TOKEN 404 응답 + timing-safe
- NEXT_PUBLIC_* 변수는 사이트 URL/토스 클라이언트 키/플래그뿐 — 시크릿이 클라이언트 번들로 가는 경로 없음
- components/markdown/safeLinks.ts: round2 #10(백슬래시 우회) 수정 확인; MarkdownRenderer는 disableParsingRawHTML + 외부 링크 noopener noreferrer nofollow
- next.config.mjs headers 순서와 tests/config/noStoreHeaders.test.ts(목록→config 양방향 일치·순서 검사), 계약/펀딩/예약/공연/구독/결제링크 경로 no-store 규칙

**읽지 못한 범위**
- 운영 환경 값은 코드로 확인할 수 없어 일부 지적의 신뢰도에 영향: KV_REST_API_* 미설정(OG·문의 Redis 분기), Google Calendar API 쿼터 수치, Resend 플랜/쿼터, ADMIN_ACCOUNTS 실제 비밀번호 강도, Vercel Firewall/Deployment Protection 설정
- 정적 읽기만 수행: jest·빌드·로컬 서버 기동/동적 요청을 하지 않았다(IPv6 /64 정규화, DrizzleQueryError 메시지 노출, 계약 목록 페이로드 크기는 코드/의존성 소스 읽기로 판단)
- 읽지 못한 파일: lib/booking/gcal.ts(서비스 계정 키 처리), lib/email/resend.ts·layout.ts 내부, lib/booking/confirm*.ts·lib/funding/confirm.ts·cancel.ts·payout.ts 내부 로직, lib/contracts/service.ts·finalize.ts·sign-transaction.ts 상세, lib/crypto/fieldKeyRotation.ts·scripts/rotate-field-key.mjs, lib/billing/* 결제·빌링키 처리, lib/shows/* 환불·체크인 상세, lib/privacy/orderRetention.ts·retention 파기 로직
- 클라이언트 코드(components/**, pages/admin/*.tsx 본문)의 XSS·민감값 렌더링은 관점상 범위 밖으로 보고 읽지 않았다
- scripts/**(소셜 발행, 키 회전 CLI, 음원 빌드)와 .github 워크플로, drizzle 마이그레이션 SQL 전수는 제외
- pages/api/llms*.ts·rss.ts·manifest.ts·stories/catalog.ts는 공개 정적 콘텐츠로 입력 검증과 메서드 제한만 훑었다

**미검증 후보(overflow)**
- 없음

### DB. DB 스키마·마이그레이션·쿼리

P0 0 · P1 1 · P2 6 · P3 17, 미검증 0 (총 24건)

#### DB-1. 원장(주문·결제·환불·후원·구독)의 백업이 없고 Turso 무료 플랜 PITR은 1일이다 — 하루 넘겨 발견한 사고는 복구 불가 [P1 · M]

① `lib/contracts/backup.ts:28-37`, `vercel.json`(crons), `CLAUDE.md`('운영 DB 마이그레이션 적용 방법' 절), `pages/api/cron/backup-contracts.ts`

② 지금 코드가 하는 일. 저장소의 정기 백업은 계약 계열 하나뿐이다.

```ts
/**
 * 계약 데이터를 통째로 떠서 Blob에 보관하고...
 * Turso가 유일본이라 DB를 잃으면 어떤 계약이 있었는지조차 알 수 없다.
 */
export const backupContracts = async (now: Date = new Date()): Promise<BackupResult> => {
  const all = await getDb().query.contracts.findMany({
    with: { signatures: true, contractClauses: true, contractAttachments: true },
```

`vercel.json`의 crons는 gsc-audit, purge-*, backup-contracts, health-check, social-refresh, billing-charge, review-requests, expire-show-orders 뿐이고 DB 덤프 크론은 없다. `vercel.json`·`docs/`·`scripts/`·`CLAUDE.md`·`package.json` 어디에도 orders·payments·refunds·funding_pledges·subscription_payments 덤프나 PITR 복구 절차가 없다(grep 확인).

③ 왜 문제인가. `~/.turso/turso plan show` 결과 운영 조직의 플랜은 **starter(무료, 500M rows read·10M rows written·5GB)**이고, Turso 요금표의 Free 플랜 PITR 보존은 **1일**(Developer 10일·Scaler 30일·Pro 90일)이다. 전자상거래법이 5년 보존을 요구하는 orders·payments·refunds·funding_pledges·subscription_payments와 공연·구독 원장 전체가 1일짜리 PITR 하나에 걸려 있다. 복구 명령(`turso db create <새이름> --from-db studio-nol --timestamp <RFC3339>`)도 저장소 어디에도 적혀 있지 않다.

④ 조건과 결과. 잘못된 마이그레이션(이 저장소는 0040식 테이블 재작성과 when 순서 함정을 이미 문서화했다)·실수 삭제·토큰 유출을 **24시간 안에** 알아차리지 못하면 결제·환불·후원자 기록을 되살릴 근거가 사라진다 → 법정 보존 불이행과 정산 불능. 운영자가 운영 DB 행을 손으로 지운 전례도 있다(빌링 테스트 데이터 정리 — 그때 백업은 저장소 밖 수동 사본이었다). 실제 사고 기록은 없고, 사고가 났을 때 복구 수단이 없다는 구조적 위험이다.

⑤ **수정**:
1. `CLAUDE.md` 'Turso CLI' 절 옆에 적는다: 플랜 starter·PITR 1일, 복구는 `~/.turso/turso db create studio-nol-restore --from-db studio-nol --timestamp <RFC3339>` → 내용 확인 뒤 env의 `TURSO_DATABASE_URL` 교체. 플랜 상향(Developer 10일) 검토.
2. `pages/api/cron/backup-ledger.ts`를 `backup-contracts`와 같은 구조로 **일 1회**(PITR 1일과 공백이 없게 — 주 1회면 최대 6일 공백) 추가. 대상 표: orders·payments·refunds·refund_accounts·funding_pledges·funding_pledge_items·funding_payouts·subscriptions·subscription_payments·billing_keys·show_orders·show_tickets. 계약처럼 관계 조회로 JSON을 조립하지 말고 **표마다 `SELECT *`를 그대로 떠서** 한 JSON(gzip)에 담는다 — 코드가 가장 적다. private Blob `ledger/backup/`에 저장, 28일 보관(계약 백업과 같은 원칙 — 개인정보가 들어 있어 파기 뒤 사본에 구정보가 오래 남지 않게), 실패 시 운영자 메일(`lib/email/operatorAlert.ts`). `payments.raw_response`·암호화 필드는 그대로 떠도 되나 `billing_keys`의 키 원문은 토큰처럼 제외한다. `vercel.json` crons에 등록.
3. 분기 1회 `--from-dump`/PITR 복구 리허설을 운영 체크리스트(`docs/wiki`)에 추가. 외부 스케줄러(launchd·claude.ai 루틴)는 memory 규칙상 쓰지 않는다.

⑥ 검증자 정정: 지적은 PITR 보존 기간을 모른 채 쓴 추정이었는데 검증에서 플랜·보존일을 확인하니 위험이 추정보다 구체적이다. 수정안의 주기(주 1회→일 1회)와 표 범위(show_orders·show_tickets·subscriptions·billing_keys·funding_payouts 추가)를 고쳤다. 같은 자리를 다른 축(CON 전자계약 — 서명·해시·PDF·보관)도 지적: "HEAD 백업이 템플릿 사본 표를 담지 않는다 — c5bd4ad154가 넣은 것을 7868515e1f(PR #460)가 되돌렸다"; (TST 테스트·CI·빌드 파이프라인) "계약 백업·고아 PDF 삭제(backup.ts)와 서명 후처리(finalize.ts)가 무테스트".

#### DB-2. 공연 예매자 이름·연락처(show_orders.buyer_*)가 5년 파기에서 빠져 있다 — 2031년부터 처리방침 '남는 것' 문구가 거짓이 된다 [P2 · M]

① `lib/privacy/orderRetention.ts:228-245`, `db/schema.ts`(showOrders), `lib/shows/service.ts:105-112`·`:224-229`, `lib/shows/queries.ts:236`·`:265`, `lib/shows/adminQueries.ts:245-247`, `data/privacyPolicy.ts:381`·`:394`, `pages/api/cron/purge-orders.ts`

② 지금 코드가 하는 일.

```ts
export const showOrders = sqliteTable('show_orders', {
  orderNo: text('order_no').primaryKey().references(() => orders.orderNo),
  showtimeId: ...,
  buyerName: text('buyer_name').notNull(),
  buyerContact: text('buyer_contact').notNull(),
```

`lib/privacy/orderRetention.ts:232` 주석은 "공연 주문도 `orders` 행을 갖고(`show_orders.order_no`가 `orders.order_no`를 가리킨다) 그 행의 이름이 위 5년 파기로 표식이 되므로, 같은 기준으로 따라간다"고 적지만, 그 아래 함수 `purgeRefundAccountsOfPurgedOrders`가 하는 일은 `refund_accounts` DELETE 하나다. 파일 전체에 `show_orders`를 건드리는 문장이 없다. `data/privacyPolicy.ts:394`는 "위 자동 파기 ④~⑩을 거치고 나면 사람을 가리키는 항목은 남지 않습니다"라고 약속한다.

③ 왜 문제인가. 공연 주문은 이름·연락처가 `orders.customer_*`와 `show_orders.buyer_*`에 이중 저장된다(`lib/shows/service.ts:105-112`가 복사). `purgeExpiredOrderCustomerData`는 type 필터가 없어 `ticket` 주문의 `orders.customer_*`는 5년 뒤 표식으로 덮이지만 `show_orders.buyer_name/buyer_contact`(NOT NULL)는 그대로 남는다. 내 티켓 화면(`lib/shows/queries.ts:236·265`)은 파기된 orders 이름이 아니라 `buyerName`을 그대로 읽어 화면에 낸다. git log에 공연 파기 커밋 없음, `lib/shows/CLAUDE.md`에 파기 결정 없음.

④ 조건과 결과. 공연 기능은 2026-09-30 도입(운영 DB show_orders 1행)이라 첫 파기 대상은 2031-10 이후다. 처리방침 18항 ④(`data/privacyPolicy.ts:381`)는 '주문(예약·믹싱·펀딩·정기결제)'만 열거해 공연을 약속한 적이 없으므로 지금 깨진 법적 약속은 없다. 그러나 2031년부터는 공연 예매자의 실명·연락처(휴대폰/이메일)가 기한 없이 남아 개인정보 보호법 제21조①과 394줄의 '남는 것' 요약이 거짓이 된다. 지금은 위반 상태가 아니고 고치는 비용이 거의 0인 시점이다.

⑤ **수정**:
- `lib/privacy/orderRetention.ts`에 `purgeShowOrderBuyersOfPurgedOrders`를 **별도 함수**로 추가(표 없으면 이 하나만 실패하는 기존 원칙 그대로):
  ```sql
  UPDATE show_orders
  SET buyer_name = ${PURGED_MARK},
      buyer_contact = CASE WHEN buyer_contact = 'comp' THEN 'comp' ELSE ${PURGED_MARK} END
  WHERE order_no IN (SELECT order_no FROM orders WHERE customer_name = ${PURGED_MARK})
    AND (buyer_name <> ${PURGED_MARK}
         OR (buyer_contact <> ${PURGED_MARK} AND buyer_contact <> 'comp'))
  ```
  초대권은 `buyer_contact='comp'` 표식·`buyer_name=발급 사유`다(`lib/shows/service.ts:224-229`). `adminQueries.ts:245-247`이 `'comp'`를 보고 연락처 칸을 비우므로 **`'comp'` 표식은 보존**하고, 발급 사유(`buyer_name`)는 이름이 들어갈 수 있어 덮는다.
- `pages/api/cron/purge-orders.ts`의 run 목록에 `purgeExpiredOrderCustomerData` 바로 뒤로 등록하고 응답 body에 `purgedShowOrderBuyers` 추가.
- 232줄 주석의 '공연도 같은 기준으로 따라간다'는 새 함수를 가리키게 고친다.
- `data/privacyPolicy.ts` ④에 '공연 예매'를 열거. ko 처리방침은 FUNDING_TERMS 해시 대상이라 `FUNDING_TERMS_VERSION`을 올리고 `UPDATE_FUNDING_TERMS_BASELINE=1 npx jest content/fundingTerms.baseline.test.ts`로 기준선 갱신, 같은 커밋에 변경 조항 기록.
- `lib/shows/queries.ts:236·265`는 `isPurgedValue(showOrder.buyerName)`이면 대체 문구.
- `orderRetention.test.ts`에 일반 주문·초대권 두 케이스 추가(초대권은 `'comp'`가 남는지 단언).

⑥ 검증자 정정: 원 지적은 P1이었으나 첫 대상이 2031-10 이후이고 처리방침 ④가 공연을 열거하지 않아 지금 깨진 약속이 없어 P2로 낮췄다. 원 수정안 SQL은 초대권의 `'comp'` 표식까지 PURGED_MARK로 덮어 명부 화면에 '(개인정보 파기됨)'이 연락처로 찍히므로 CASE로 보존하게 고쳤다. 같은 자리를 다른 축(PRV 개인정보·처리방침 정합·로그)도 지적: "공연 구매자 이름·연락처(show_orders)를 주문 5년 파기에 따라 표식으로 덮는다", "새 표·컬럼이 PII인지 판정하지 않고 들어와도 CI가 모른다 — 공연 show_orders.buyer_name/buyer_contact가 5년 파기에서 빠진 채 처리방침 18항과 어긋나 있다".

#### DB-3. 공개 GET /api/bookings/slots가 검증 전에 쓰기 batch(expireStaleOrders)를 돌린다 — 정합성은 이 호출에 기대지 않으므로 뺄 수 있다 [P2 · S]

① `pages/api/bookings/slots.ts:48-49`(결정 주석은 `:42`), `lib/booking/service.ts:266-`(expireStaleOrders), `lib/booking/confirm.ts:465-470`, `pages/admin/bookings/index.tsx`, `pages/api/admin/bookings/index.ts`, `pages/api/cron/expire-show-orders.ts`, `middleware.ts`

② 지금 코드가 하는 일.

```ts
  res.setHeader('Cache-Control', 'no-store'); // 가용성은 캐시하면 안 된다 — no-store를 GET에도 명시.
  ...
  const now = new Date();
  await expireStaleOrders(now);

  const { productId, hours: hoursParam, date } = req.query;
```

`expireStaleOrders`는 `db.batch`로 UPDATE 세 문장(bookings cancelled, work_orders cancelled, orders expired)을 한 트랜잭션으로 보낸다. 이 호출이 `productId`·`date` 검증보다 앞에 있고, 이 라우트에는 인증·레이트리밋이 없다(`middleware.ts`에 rate/limit 없음, `consumeRateLimit` 사용처에 slots 없음).

③ 왜 문제인가. 잘못된 요청(없는 productId·날짜)도 Turso 쓰기 트랜잭션 1회를 일으킨다. 그런데 정합성은 이 호출에 기대지 않는다 — `confirm.ts:465-470`은 "expireStaleOrders는 lazy라 결제창을 900초 넘게 방치한 주문이 pending인 채일 수 있다"고 전제하고 스스로 홀드 만료를 판정하며, `occupiedBookingSql`(`service.ts:28`)도 900초 지난 pending을 점유로 세지 않는다. 즉 이 호출은 표시용 상태 정합일 뿐이다. `tests/api/bookings/slots.test.ts`는 이 호출을 단언하지 않아 제거해도 깨지지 않는다.

④ 조건과 결과. 스크립트 반복 호출 시 rows read가 읽기 경로의 약 2배로 늘고 쓰기 락을 짧게 반복 점유한다. 현재 규모(orders 142·bookings 21·work_orders 4행)에서는 세 UPDATE의 전표 스캔이 마이크로초 단위이고 0행 매치 UPDATE는 Turso rows written에 안 잡힌다(월 10M 중 <0.1M 사용) — 운영 사고 위험은 아니다. 제거하면 고객 주문 조회 화면(`manage/[orderNo]`)에서 방치된 세션 주문의 '결제 대기' 라벨이 관리자 목록이 열릴 때까지 남는 부작용이 생기나 정합성과 무관하다.

⑤ **수정**:
- `slots.ts:48-49`의 `expireStaleOrders` 호출을 제거한다. 남기려면 최소한 `productId`·`date` 검증 뒤로 옮기고 인스턴스 메모(`freeBusyCache`와 같은 60초 TTL)로 중복 실행을 막는다.
- 만료 정리는 관리자 목록 두 곳(`pages/admin/bookings/index.tsx`, `pages/api/admin/bookings/index.ts`)의 lazy 호출을 그대로 두고, 고객 화면 라벨이 신경 쓰이면 `expire-show-orders` 일일 크론에 `await expireStaleOrders(new Date())` 한 줄을 추가한다(`billing-charge`에 섞지 않는다).
- `confirm.ts:465` 주석('슬롯 조회·관리자 목록에서만')을 함께 고친다.
- 하지 말 것: `consumeRateLimit`은 호출마다 DELETE+UPSERT를 쓰므로 slots에 붙이면 제거하는 batch보다 쓰기가 는다(Google FreeBusy는 이미 60초 캐시). `s-maxage` CDN 캐시는 `slots.ts:42`의 명시 결정과 충돌하므로 넣지 않는다.

⑥ 검증자 정정: 원 지적의 '결제 경로 지연·타임아웃의 직접 원인'은 현재 규모에서 근거가 없고, 원 수정안의 레이트리밋·CDN 캐시는 기존 설계와 충돌해 뺐다. 같은 자리를 다른 축(PAY 결제·주문·예약)도 지적: "슬롯 조회 API에 IP 제한이 없고 매 요청 불필요한 만료 정리 쓰기가 붙는다(규모상 비용은 미미)"; (SEC 인증·권한·입력 검증·헤더) "공개 GET /api/bookings/slots에만 요청 제한이 없고, 검증 전에 DB 정리와 요청당 FreeBusy 2회를 돌린다".

#### DB-4. 연습실 구독 '한 계약에 구독 하나'가 읽고-쓰기 경쟁 — DB 유일 제약이 없어 월세 이중 청구 가능 [P2 · S]

① `lib/billing/service.ts:164-170`(검사)·`:185-`(INSERT), `db/schema.ts:1088-1100`(subscriptions), `pages/api/admin/subscriptions/index.ts`, `lib/privacy/orderRetention.ts`

② 지금 코드가 하는 일.

```ts
  if (input.contractId) {
    const existing = await db.query.subscriptions.findFirst({
      where: (t, { and: all, eq: is, inArray: within }) =>
        all(is(t.contractId, input.contractId!), within(t.status, OCCUPYING_STATUSES)),
    });
    if (existing) return { ok: false, code: 'already_exists' };
  }
  ...
  const [row] = await db.insert(subscriptions).values({ ... contractId: input.contractId ?? null, ... })
```

③ 왜 문제인가. 중복 검사와 INSERT 사이에 틈이 있고, 스키마와 모든 마이그레이션 SQL에 `subscriptions.contract_id` 인덱스·유일 제약이 없다(유일 인덱스는 `customer_key`·`setup_token`·`manage_token`뿐). 호출 이후에 같은 계약의 점유 구독을 막는 곳도 없다(`OCCUPYING_STATUSES`는 생성 검사와 계약 종료 시 해지에서만 쓴다). 이 저장소의 다른 곳(재고·점유·정산)은 모두 'INSERT ... WHERE' 또는 유일 인덱스로 DB가 최종 방어선인데 여기만 앱 검사에 의존한다.

④ 조건과 결과. 관리자 '구독 만들기'를 두 탭에서 제출하거나 두 호출이 동시에 들어오면(관리자 화면은 `confirm()`과 busy 비활성이 있어 단순 더블클릭은 아니다) 둘 다 검사를 통과해 같은 계약에 `pending_card` 구독이 둘 생긴다. 고객이 안내 메일 두 통의 링크로 각각 카드를 등록하면 둘 다 `active`가 되어 cron이 매월 이중 청구한다. 환불·정정은 운영 부담이다. 운영 DB 구독은 현재 0건.

⑤ **수정**:
- `db/schema.ts` subscriptions에 세 번째 인자로 부분 유니크 인덱스 추가(`funding_projects.slugLiveUnique`와 같은 방식):
  ```ts
  uniqueIndex('subscriptions_contract_live_unique')
    .on(t.contractId)
    .where(sql`contract_id IS NOT NULL AND status IN ('pending_card','active','past_due','paused')`)
  ```
  artist-support는 `contractId`가 NULL이라 영향 없다.
- 마이그레이션 적용 전 중복 확인: `SELECT contract_id, COUNT(*) FROM subscriptions WHERE contract_id IS NOT NULL AND status IN ('pending_card','active','past_due','paused') GROUP BY 1 HAVING COUNT(*) > 1` (현재 0건이라 통과).
- `createSubscription`의 insert를 try/catch로 감싸 `isUniqueConflictError(error, 'subscriptions.contract_id')`(DB-7의 공용 함수)일 때 `{ ok: false, code: 'already_exists' }`를 돌려준다. 기존 사전 검사는 빠른 실패용으로 유지.
- `OCCUPYING_STATUSES` 상수와 인덱스 WHERE 조건이 갈리지 않도록 테스트 한 줄 추가(상수 배열 → SQL 문자열 생성 비교).

⑥ 비고: 검증자가 코드를 읽어 confirmed. P1이 아닌 이유는 동시 두 호출 + 고객이 두 링크를 모두 쓰는 단계가 더 필요해서이고, P3로 낮출 사안도 아니다(돈이 걸린 전제를 앱 검사에만 맡긴 현재 코드의 실제 경합).

#### DB-5. schema.ts와 마이그레이션 동기를 검증하는 CI 게이트가 없다 (통합 테스트가 일부 표만 우연히 커버) [P2 · S]

① `.github/workflows/ci.yml:45-56`(check 잡), `package.json`(db:generate), `drizzle.config.ts`, `lib/ops/migrationJournal.test.ts`

② 지금 코드가 하는 일.

```json
    "db:generate": "node --env-file=.env.local node_modules/.bin/drizzle-kit generate",
    "db:migrate": "node --env-file=.env.local node_modules/.bin/drizzle-kit migrate",
```

`.github/workflows/ci.yml`에는 drizzle-kit 호출이 0건이다. `migrationJournal.test.ts`는 저널 구조만, migration-drift 잡은 운영 DB의 개수만 본다. 스크래치 복사본(`drizzle.config.ts`·`db`·`drizzle`·`node_modules` 링크)에서 `TURSO_DATABASE_URL=file:ci.db TURSO_AUTH_TOKEN=x npx drizzle-kit generate`를 돌리면 연결 없이 'No schema changes, nothing to migrate'로 끝난다 — 지금 켜도 빨갛지 않다.

③ 왜 문제인가. `db/schema.ts`를 고치고 `db:generate`를 빠뜨려도 CI가 일률적으로 잡지 못한다. lib 아래 10여 개 통합 테스트(confirm.integration, salesLedger.integration, service.integration, healthCheck.integration, orderRetention 등)가 실제 마이그레이션 SQL을 인메모리 SQLite에 적용한 뒤 schema.ts 기준 Drizzle 쿼리를 돌리므로, orders·payments·bookings·funding·subscriptions처럼 그 테스트가 닿는 표의 컬럼 누락은 이미 'no such column'으로 CI에서 빨개진다. 비어 있는 곳은 통합 테스트가 닿지 않는 표(shows·contracts 등)와 컬럼이 아닌 변경(인덱스·CHECK·유일 제약)이다.

④ 조건과 결과. 해당 표의 컬럼이 schema.ts에만 있고 마이그레이션이 없는 채 배포되면 전체 컬럼 SELECT가 런타임에 `no such column`으로 죽는다(CLAUDE.md의 0022·0035 절이 적은 바로 그 증상). 핵심 금전 표는 통합 테스트가 일부 막아 영향 범위는 지적보다 좁다.

⑤ **수정**: `.github/workflows/ci.yml` check 잡의 Test 앞에 단계 추가.
```yaml
      - name: Schema ↔ migration sync
        timeout-minutes: 3
        env:
          TURSO_DATABASE_URL: file:ci-schema.db
          TURSO_AUTH_TOKEN: x
        run: |
          npx drizzle-kit generate --name ci_schema_sync
          if [ -n "$(git status --porcelain drizzle)" ]; then
            echo '::error::스키마와 마이그레이션이 어긋남: npm run db:generate 후 커밋'
            git status --porcelain drizzle
            exit 1
          fi
```
컬럼 이름 변경이 모호하면 drizzle-kit이 대화형 질문으로 멈출 수 있으므로 `timeout-minutes`를 둔다(이 경우도 실패가 맞다).

⑥ 검증자 정정: '결제 전체가 CI에서 무방비'라는 원 서술은 과장이라 바로잡았다(통합 테스트가 닿는 표는 이미 잡힌다). 같은 자리를 다른 축(TST 테스트·CI·빌드 파이프라인)도 지적: "CI 테스트 단계의 --passWithNoTests는 초기 흔적이고, 콘솔 소음이 9,400줄이다".

#### DB-6. 매출장부 CSV가 공연 티켓(orders.type='ticket')을 'ticket' 영문 원문으로 내보낸다 — 라벨과 설명 추가 [P2 · M]

① `lib/ops/salesLedger.ts:60-108`(TYPE_LABELS·describeOrder·listSalesLedgerRows), `pages/api/admin/orders/export.ts`, `lib/ops/salesLedger.integration.test.ts`, `lib/shows/confirm.ts:223`, `db/schema.ts:287`(orderTypeEnum)·`:443`(orders.showOrder 관계)

② 지금 코드가 하는 일.

```ts
const TYPE_LABELS: Record<string, string> = {
  session: '세션 예약',
  mixing: '믹싱·마스터링',
  funding: '펀딩',
  subscription: '구독',
  deposit: '예약금',
};   // 'ticket' 없음
...
      type: TYPE_LABELS[order.type] ?? order.type,
      description: describeOrder(order),   // switch에 'ticket' case 없음 → default: return order.type
```

`listSalesLedgerRows`의 관계 조회는 `with: { refunds, order: { with: { bookings, workOrders, fundingPledge: { with: { items } }, subscriptionPayment: { with: { subscription } } } } }`로 `showOrder`를 싣지 않는다.

③ 왜 문제인가. `orderTypeEnum`에 `'ticket'`이 있고 공연 결제는 `lib/shows/confirm.ts:223`에서 `payments` 행을 `approved_at`과 함께 INSERT하므로 장부 모집단에 들어온다. 그런데 TYPE_LABELS에 ticket이 없어 type 열이 'ticket'으로 나가고 describeOrder도 default로 `order.type`을 돌려주므로 description도 'ticket'이다. 공연명·회차·매수를 알 수 없고 다른 종류와 구분이 약하다. 장부 파일과 통합 테스트에 ticket·show 언급이 전혀 없다(grep 0건). CLAUDE.md '새 결제 종류 체크리스트'의 '매출장부 라벨' 누락 사례다.

④ 조건과 결과. 공연 결제가 한 건이라도 있는 기간의 CSV를 내보내면 그 행의 구분·설명이 'ticket'이다. 부가세·정산 대사 때 공연 매출을 손으로 분류해야 한다. 금액 열(itemAmount·vatAmount·netVatAmount)은 정확하다.

⑤ **수정**:
- `TYPE_LABELS`에 `ticket: '공연 예매'` 추가.
- `listSalesLedgerRows`의 order 관계에 `showOrder: { with: { tickets: true, showtime: { with: { show: true } } } }` 추가(스키마 관계 `orders.showOrder`·`showOrders.tickets/showtime`·`showtimes.show`에 실재). `LedgerOrder` 타입에 `showOrder` 반영.
- `describeOrder`에 `case 'ticket':` — `${show.title} · ${회차 일시} · ${tickets.length}매` 형태.
- `salesLedger.integration.test.ts`에 ticket 케이스(라벨·설명·환불 합산) 추가.
- 366일 일괄 적재·인덱스 부분은 이 수정에 넣지 않는다(규모 근거 없음, `validateLedgerRange`가 366일 상한을 이미 건다).

⑥ 검증자 정정: 원 지적의 두 번째 주장(366일치 적재가 서버리스 한도에 걸린다, FK 인덱스 부재)은 근거가 없어 뺐고 라벨 누락만 P2로 인정. 같은 자리를 다른 축(PAY 결제·주문·예약)도 지적: "매출장부 CSV에 공연(ticket) 구분 라벨이 없어 원문 'ticket'이 구분·설명 칸에 그대로 나간다".

#### DB-7. 정산 기록 경합의 유니크 위반 판정(String(error).includes('UNIQUE'))이 drizzle 래핑 때문에 절대 맞지 않는다 [P2 · S]

① `lib/funding/payout.ts:656-660`, `lib/artistSupport/payout.ts:160`, `lib/funding/slugOccupancy.ts:71-73`(isUniqueConflictError), `pages/api/admin/funding/projects/[id].ts:331-332`, `db/schema.ts:947`

② 지금 코드가 하는 일.

```ts
  } catch (error) {
    // 유니크 위반 = 동시에 두 번 눌렀다. 다른 오류면 그대로 올린다.
    if (String(error).includes('UNIQUE')) return { ok: false, code: 'already_recorded' };
    throw error;
  }
```

`lib/artistSupport/payout.ts:160`에 같은 `String(error).includes('UNIQUE')`. 반면 `lib/funding/slugOccupancy.ts:71`의 `isUniqueConflictError(error, 'table.column')`는 cause 체인을 따라가며 `creatorAccountDecision.ts`·`creatorProjectWrite.ts`·`reviewDecision.ts`가 쓰고 `reviewDecision.integration.test.ts:316`이 실제 DB로 검증한다.

③ 왜 문제인가. drizzle-orm 0.45.2는 단일 문장 쿼리 실패를 `DrizzleQueryError`로 감싸고 message를 `Failed query: <sql>\nparams: …`로 만들며 원인(UNIQUE 문구)은 `cause`에만 둔다(`node_modules/drizzle-orm/errors.js`, `sqlite-core/session.js:42-100`). 검증자가 직접 재현: unique 칼럼에 `insert().returning()`을 두 번 하면 `String(error)`는 "Error: Failed query: insert into …"이고 `.includes('UNIQUE')`는 false, `cause.message`에만 "UNIQUE constraint failed: t.project_id"가 있다. 따라서 두 catch는 절대 `already_recorded`를 돌려주지 않고 예외를 다시 던진다 — 죽은 분기이고 주석("경합에서도 안전")과 동작이 어긋난다.

④ 조건과 결과. 운영자가 정산 기록을 동시에 두 번 누르면(경합) 두 번째 요청이 409 "이미 기록된 정산입니다"가 아니라 500 서버 오류다. 중복 행은 `project_id` UNIQUE(`db/schema.ts:947`)·`artist_payouts` 유니크 인덱스가 막으므로 정산 금액·행은 안전하다. 이 경합 경로는 테스트가 없다(`payout.integration.test.ts:364`는 `preview.recorded` 조기 반환 경로만 탄다).

⑤ **수정**:
- `lib/funding/payout.ts:658` → `if (isUniqueConflictError(error, 'funding_project_payouts.project_id')) return { ok: false, code: 'already_recorded' };`
- `lib/artistSupport/payout.ts:160` → `isUniqueConflictError(error, 'artist_payouts.artist_slug')`. unique index가 `artist_slug+period` 조합이라 SQLite 메시지는 `artist_payouts.artist_slug, artist_payouts.period` 형태 — 접두 정규식이 맞는지 통합 테스트로 확인.
- 새 파일(`lib/db/errors.ts`)은 만들지 않는다. 원한다면 `isUniqueConflictError`를 `lib/db/`로 옮기기만 한다.
- 같은 INSERT를 `Promise.all`로 두 번 쏘는 통합 테스트로 경합 경로를 고정.
- `pages/api/admin/funding/projects/[id].ts:331`의 지역 `isSlugConflictError`는 message만 보는 사본이라 같은 약점이지만, 안쪽 `decideProject`가 이미 cause 체인 판정으로 처리해 잔여 방어선이다 — 함께 공용 함수로 바꾸면 깔끔하다.

⑥ 검증자 정정: 원 지적은 "다른 유니크 위반을 already_recorded로 오분류"였는데 방향이 반대다 — 분기가 아예 맞지 않는다. 같은 자리를 다른 축(FNC 펀딩 — 개설자·심사·배송·정산·관리자)도 지적: "정산 기록의 중복 판정 String(error).includes('UNIQUE')가 drizzle 0.45.2에서 매치하지 않아 동시 기록의 패자가 409가 아니라 500을 받는다".

#### DB-8. 예약·주문 테이블에 보조 인덱스가 없다 — 현재 수백 행이라 체감 0, 다음 마이그레이션에 묶어 넣을 정리 항목 [P3 · S]

① `db/schema.ts:361-425`(bookings·work_orders·availability_blocks·orders), `lib/booking/service.ts:28`(occupiedBookingSql), `pages/api/bookings/slots.ts`, `pages/admin/bookings/index.tsx:55-90`, `drizzle/migrations/meta/_journal.json`

② 지금 코드가 하는 일. 스냅샷 0051 기준 인덱스: `bookings idx: []` / `work_orders idx: []` / `availability_blocks idx: []` / `orders idx: ['orders_order_no_unique','orders_manage_token_unique']`. `db/schema.ts:361-425`에 세 번째 인자 콜백이 없다(show_orders는 `showtime_idx`를 두고 있어 패턴은 있다).

```ts
export const occupiedBookingSql = ... status = 'confirmed' OR (status = 'pending' AND (created_at > unixepoch() - 900 OR order_id IN (SELECT id FROM orders WHERE status = 'awaiting_deposit')))
// 겹침 검사: WHERE (b.room_number IS NULL ...) AND b.start_at < ? AND b.end_at > ?
// 관리자 목록: orders ORDER BY created_at DESC LIMIT 201
```

③ 왜 문제인가. 겹침 검사·`expireStaleOrders`·관리자 목록이 전표 스캔이다.

④ 조건과 결과. 운영 DB는 orders 142·bookings 21·work_orders 4·availability_blocks 0행이고 Turso rows read는 월 한도의 1%(4.2M/500M)다. SQLite가 수백 행을 스캔하는 비용은 마이크로초라 인덱스를 넣어도 측정 가능한 차이가 없다. 행 수가 수천 단위로 늘면 슬롯 조회·예약 생성·만료 batch 지연이 선형으로 늘고 rows read 과금이 붙는다.

⑤ **수정**: `sqliteTable` 세 번째 인자로 선언 — bookings: `(room_number,start_at)`·`(order_id)`·`(status,created_at)` / orders: `(status,type,created_at)`·`(created_at)` / work_orders: `(order_id)`·`(status,created_at)` / availability_blocks: `(room_number,start_at)`. **인덱스만을 위한 단독 마이그레이션을 지금 발행하지 않는다** — 적용이 운영자 수동(Turso CLI)이라 다음 스키마 변경 마이그레이션(DB-4·DB-20 등)에 함께 싣는 쪽이 싸다. 발행 시 `drizzle-kit generate`로 when이 현재 최댓값(1791359895051)보다 크게, 적용은 CLAUDE.md 'Turso CLI로 한다' 절차대로. CREATE INDEX라 배포 순서 위험 없음.

⑥ 검증자 정정: 원 P1 → P3. 행 수가 없어 '현실 조건에서 터지는' 사고가 아니고, 수동 마이그레이션 비용이 분명하다. 같은 자리를 다른 축(PAY 결제·주문·예약)도 지적: "결제 핵심 테이블에 FK·상태 보조 인덱스가 없다(현재 행 수에선 영향 없음, 규모 증가 대비)".

#### DB-9. orders 자식 테이블 FK 컬럼에 인덱스가 없다 — 지금은 비용이 미미하나 매출장부·집계가 O(부모×자식)로 자란다 [P3 · S]

① `db/schema.ts:329-359`(payments·refunds) 및 subscriptionPayments·billingKeys·signatures·contractClauses·contractAttachments·showTicketTypes, `lib/ops/salesLedger.ts:95-108`, `lib/funding/service.ts:362-364`, `lib/ops/healthCheck.ts`, `db/schema.funding.test.ts`

② 지금 코드가 하는 일.

```ts
payments: orderId: text('order_id').notNull().references(() => orders.id),   // 인덱스 없음(paymentKey만 unique)
refunds: paymentId: text('payment_id').notNull().references(() => payments.id),   // 인덱스 없음
subscriptionPayments.orderId / billingKeys.subscriptionId / signatures.contractId / contractClauses.contractId / contractAttachments.contractId / showTicketTypes.showId  // 인덱스 없음
```

매출장부 조회는 `payments.findMany({ where: approved_at 범위, with: { refunds, order: { with: { bookings, workOrders, fundingPledge: { with: { items } }, subscriptionPayment: { with: { subscription } } } } } })`로 관계마다 상관 서브쿼리가 된다. 운영 DB EXPLAIN QUERY PLAN에서 refunds 상관 서브쿼리가 'CORRELATED SCALAR SUBQUERY → SCAN r'이다(자동 인덱스도 안 생긴다).

③ 왜 문제인가. `payments.order_id`, `refunds.payment_id`, `bookings.order_id`, `work_orders.order_id`, `subscription_payments.order_id`, `billing_keys.subscription_id`, `signatures/contract_clauses/contract_attachments.contract_id`, `show_ticket_types.show_id`, `payments.approved_at`에 인덱스가 없다. `aggregateProjectStatus` 주석(`service.ts:362-364`)이 이미 이 부재를 알고 CASE로 우회해 두었다.

④ 조건과 결과. 현재 규모(payments 67·orders 142·refunds 4·funding_pledges 112)에서 매출장부 한 번의 방문 행 수는 수천 단위라 체감 비용이 없다. 규모가 수십~수백 배로 커질 때 매출장부 CSV(최대 366일)·정산 미리보기·관리자 목록이 부모 행마다 자식 표를 훑어 비용이 곱으로 는다.

⑤ **수정**: 다음 마이그레이션 한 번에 추가 — `payments(order_id)`, `payments(approved_at)`, `refunds(payment_id)`, `bookings(order_id)`, `work_orders(order_id)`, `subscription_payments(order_id)`, `billing_keys(subscription_id)`, `signatures(contract_id)`, `contract_clauses(contract_id)`, `contract_attachments(contract_id)`, `show_ticket_types(show_id)`. 순수 추가라 배포 순서 제약이 없다. 새 엔트리의 when이 현재 최대(저널 52번째)보다 커야 한다. 'FK 컬럼은 어떤 인덱스의 선두여야 한다' 가드는 `getTableConfig` 순회로 만들되 의도적 제외는 이유와 함께 허용 목록에 둔다. DB-8과 같은 마이그레이션에 싣는다.

⑥ 검증자 정정: 원 P2 → P3(현재 증상 없는 성장 대비). 원 수정안이 언급한 `orders_status_type_created_idx`는 존재하지 않는 인덱스였다(DB-8의 제안 명칭).

#### DB-10. funding_pledges.project_slug 인덱스 부재 — 집계 쿼리에만 효과, 재고 조건·만료 UPDATE에는 효과 없음 [P3 · S]

① `db/schema.ts:477-492`, `lib/funding/service.ts:161-165`(재고 조건)·`:321`(expireStalePledges), `lib/funding/pledgeLinesSql.ts`, `lib/funding/payout.ts:283·299`, `lib/funding/admin-list.ts:40·79·157`, `lib/funding/creatorShipping.ts:118·127·181`

② 지금 코드가 하는 일.

```ts
  projectSlug: text('project_slug').notNull(),
  ...
  holdExpiresAt: integer('hold_expires_at', { mode: 'timestamp' }).notNull(),
// service.ts:161-165 (후원 생성마다 한정 리워드별로 실행)
SELECT COALESCE(SUM(l.quantity), 0) FROM ${fundingPledgeLinesSql()} l JOIN funding_pledges fp ON fp.id = l.pledge_id JOIN orders o ON o.id = fp.order_id WHERE fp.project_slug = ${projectSlug} AND l.reward_id = ${reward.id} ...
// service.ts:321
UPDATE orders ... AND id IN (SELECT order_id FROM funding_pledges WHERE hold_expires_at < ? AND payment_method != 'bank_transfer')
```

③ 왜 문제인가. `project_slug` 인덱스가 없어 `aggregateProjectStatus`·정산·관리자 목록의 `WHERE fp.project_slug=?`(사용처 15곳 안팎)가 funding_pledges를 훑는다. 그러나 (1) 재고 조건 쿼리의 EXPLAIN은 파생표 l을 CO-ROUTINE으로 만들고 `reward_id`를 왼쪽 가지에 밀어 넣어 `funding_pledge_items_reward_idx`를 쓰며, project_slug는 바깥 fp에 PK로 붙은 뒤 걸러지므로 **project_slug 인덱스를 만들어도 이 플랜은 바뀌지 않는다.** (2) `hold_expires_at` 인덱스는 쓸모가 없다 — 운영 DB에서 `hold_expires_at < now`인 행이 112/112라 선택도가 없고, expire UPDATE의 실제 선택적 조건은 `orders.status='pending'`(운영 2건)이다.

④ 조건과 결과. 운영 112행에서 비용은 사실상 0. 후원 수천 건 이상으로 커진 뒤에야 집계 쿼리가 눈에 띈다. 재고 게이트 지연·타임아웃 주장은 현재 플랜과 규모로는 성립하지 않는다.

⑤ **수정**: 원한다면 `funding_pledges(project_slug)` 인덱스 하나만 DB-8 마이그레이션에 같이 싣는다(집계·정산용). `hold_expires_at` 인덱스는 만들지 않는다. 재고 조건 쿼리를 개선하려면 인덱스가 아니라 레거시 가지(NOT EXISTS 스캔)를 줄이는 방향이다(DB-16). expire UPDATE는 주문 쪽 pending 필터를 앞세우는 EXISTS 형태로 다시 쓰고 `orders(status)` 인덱스를 두는 쪽이 선택도가 높다. 적용 전후는 `turso db shell`의 `EXPLAIN QUERY PLAN`으로 확인.

⑥ 검증자 정정: 원 수정안의 두 핵심('SEARCH ... USING INDEX로 바뀐다', hold_expires_at 인덱스)이 실측 플랜과 맞지 않아 고쳤다. 같은 자리를 다른 축(FND 펀딩 — 후원·결제·명단·보존)도 지적: "집계·관계 조회용 인덱스가 없다(효과 있는 것은 셋뿐)".

#### DB-11. rate_limits 호출마다 선행 DELETE 왕복 1회 추가 (소규모에서는 영향 미미) [P3 · S]

① `lib/booking/rate-limit.ts:44-66`, `lib/contracts/admin-rate-limit.ts:171·228·288·351·439·476`, `pages/api/payments/webhook.ts`, `pages/api/bookings/index.ts`

② 지금 코드가 하는 일.

```ts
    await getDb().delete(rateLimits).where(lte(rateLimits.expiresAt, nowSeconds));
    if (key.startsWith('webhook:')) {
      await cleanupExpiredWebhookEvents(now);   // DELETE FROM webhook_events WHERE processed_at < ?
    }
    const [row] = await getDb().insert(rateLimits).values({ key, count: 1, expiresAt: nowSeconds + windowSeconds })
      .onConflictDoUpdate({ target: rateLimits.key, set: { count: sql`${rateLimits.count} + 1` } }).returning();
```

`admin-rate-limit.ts`의 여섯 함수도 같은 선행 DELETE를 반복한다.

③ 왜 문제인가. 허용 판정 한 번이 DELETE→(웹훅이면 webhook_events DELETE)→UPSERT로 2~3회 Turso 왕복이다. 의도된 설계 주석(lazy cleanup)이 있고 `rate-limit.test.ts`가 창 리셋을 고정해 두었다.

④ 조건과 결과. 공개 POST마다 왕복 1~2회 지연이 더해지는 정도. 운영 DB는 rate_limits 6행·webhook_events 105행이라 인덱스 부재는 의미가 없고, 쓰기 락 경합이 결제 확정 경로로 번진다는 근거도 없다. 표가 수천 행 이상으로 자라는 공격 상황에서만 DELETE 풀스캔이 문제가 된다.

⑤ **수정**(바꾼다면): 창 리셋을 UPSERT 한 문장에 흡수 — `set: { count: sql\`CASE WHEN expires_at <= ${now} THEN 1 ELSE count + 1 END\`, expiresAt: sql\`CASE WHEN expires_at <= ${now} THEN ${now + window} ELSE expires_at END\` }`. **단, 만료된 고아 키와 webhook_events 90일 정리는 기존 purge 크론으로 옮긴다** — 둘을 함께 하지 않으면 다시 오지 않는 IP 키가 영원히 남아 표가 무한 증가한다(공격면). 같은 호출에서 DELETE를 유지하고 싶다면 `db.batch([delete, upsert returning])`로 왕복만 1회로 줄인다. `rate_limits.expires_at` 인덱스는 행이 수천 이상일 때만 의미가 있다.

⑥ 검증자 정정: 원 수정안(CASE UPSERT로 DELETE 제거)은 단독으로는 틀려 청소 경로 이전을 조건으로 붙였다. 같은 자리를 다른 축(PAY 결제·주문·예약)도 지적: "webhook_events 정리가 레이트리밋 함수 안에 숨어 있다(구조 정리)"; (CQ 코드 품질·구조·중복·타입 안전) "consumeRateLimit이 요청마다 만료 행 DELETE와 UPSERT를 따로 보내고 webhook_events 청소를 겸한다".

#### DB-12. 공개 status API와 펀딩 후원 SSR이 집계에 필요 없는 expireStalePledges(쓰기)를 실행한다 [P3 · S]

① `pages/api/funding/[slug]/status.ts:15`, `pages/[locale]/funding/[slug]/pledge.tsx:48`, `pages/[locale]/funding/manage/[orderNo].tsx:292`, `lib/funding/service.ts:321`(expireStalePledges)·`:410-416`(claimed), `pages/api/funding/pledges.ts:53`

② 지금 코드가 하는 일.

```ts
  await expireStalePledges(now);
// lib/funding/service.ts:321
  await getDb().run(sql`
    UPDATE orders SET status = 'expired', updated_at = unixepoch()
    WHERE type = 'funding' AND status = 'pending'
      AND id IN (SELECT order_id FROM funding_pledges WHERE hold_expires_at < ${toEpoch(now)} AND payment_method != 'bank_transfer')
  `);
```

③ 왜 문제인가. `aggregateProjectStatus`의 어떤 집계도 `orders.status`가 expired로 바뀌었는지에 의존하지 않는다 — 모금액·건수·명단은 `countedFundingPledgeSql`(live 상태 + 온라인 계좌 입금 pending)만 보고, remaining의 claimed는 'pending ∧ hold_expires_at > now'만 점유로 센다(`service.ts:410-416`). 만료 홀드는 어느 쪽이든 안 세어지므로 status.ts·pledge.tsx의 호출은 응답에 영향이 없다(최초 구현 5daaf71b06부터 있던 관성). `payout.ts:299`의 pending 집계는 bank_transfer라 expireStalePledges가 어차피 건너뛴다. 반대로 manage 페이지는 주문 상태 표시에 이 호출이 필요한데 토큰 검증 전에 실행한다.

④ 조건과 결과. status API는 `s-maxage=15` + SWR 뒤라 정상 트래픽에서 오리진 호출이 드물다. pledge.tsx는 no-store SSR이라 조회마다 UPDATE 1회(funding_pledges 전체 스캔 포함)가 나간다. manage는 잘못된 토큰 요청도 쓰기를 일으킨다. 현재 규모(112행)에서는 미미하다.

⑤ **수정**: `status.ts:15`와 `pledge.tsx:48`에서 `expireStalePledges` 호출 제거(집계 정확도 영향 없음). `manage/[orderNo].tsx:292`는 호출을 `isTokenMatch` 통과 뒤로 옮긴다. `createFundingPledge` 직전(`pledges.ts:53`), 관리자 목록, confirm 경로는 그대로 둔다. 제거 뒤 pending→expired 전이가 늦어지지만 이를 읽는 소비처는 없고 confirm이 만료를 스스로 적용한다.

⑥ 검증자 정정: 원 지적은 status.ts만 짚었는데 pledge.tsx(캐시 없음)를 더하고, manage는 지우면 안 되고 옮겨야 한다는 점을 보탰다. 같은 자리를 다른 축(FND 펀딩 — 후원·결제·명단·보존)도 지적: "공개 모금 현황 GET이 호출마다 정합성과 무관한 UPDATE를 실행하고 404는 캐시되지 않는다".

#### DB-13. 공연 입장 번호 유일성을 DB 제약이 아니라 단일 writer 직렬화에만 의존한다 (심층 방어 부재) [P3 · S]

① `lib/shows/confirm.ts:368-383`(assignEntryNumbers)·`:344`(호출부), `db/schema.ts:1721-1724`(show_tickets 인덱스), `lib/shows/checkin.ts`

② 지금 코드가 하는 일.

```ts
  for (const t of unassigned) {
    await db.run(sql`
      UPDATE show_tickets
      SET entry_number = (SELECT COALESCE(MAX(entry_number), 0) + 1 FROM show_tickets WHERE showtime_id = ${showtimeId})
      WHERE id = ${t.id} AND entry_number IS NULL
    `);
  }
```

show_tickets 인덱스는 `statusCheck`, `showtimeTypeIdx(showtime_id, ticket_type_id)`, `orderIdx(order_no)` — `(showtime_id, entry_number)` 유일 인덱스 없음.

③ 왜 문제인가. `entry_number`를 쓰는 곳은 이 함수 하나뿐이고(grep 전수) 함수 주석이 batch로 합치면 깨진다고 명시하며 SQLite 단일 writer가 개별 UPDATE를 직렬화하므로 현재 코드는 올바르다. 다만 유일 인덱스가 없어 향후 batch 합치기·수동 보정 같은 변경이 중복을 조용히 만들 수 있다. MAX 조회도 showtime_id 선두 인덱스로 회차 티켓 전부를 읽는다.

④ 조건과 결과. 현재 결함 없음(운영 show_tickets 1건). 회귀 시 입장 번호 중복이 현장 호명에서 드러나는 운영 사고가 된다.

⑤ **수정**: show_tickets에 `uniqueIndex('show_tickets_showtime_entry_unique').on(t.showtimeId, t.entryNumber)` 추가(NULL은 서로 다른 값 취급이라 미배정 행 영향 없음, DB-8 마이그레이션에 동승). 적용 전 `SELECT showtime_id, entry_number, COUNT(*) FROM show_tickets WHERE entry_number IS NOT NULL GROUP BY 1,2 HAVING COUNT(*)>1`로 중복 점검. 동시에 `assignEntryNumbers`를 UNIQUE 위반 시 1회 재시도하고, 그래도 실패하면 `confirm.ts:344` 호출부에서 try/catch로 로그만 남긴다 — 지금은 try/catch가 없어 예외가 던져지면 돈이 이미 기록된 뒤에 확정 응답과 운영자 알림(`notifyShowPaymentToOperator`)이 건너뛰어진다.

⑥ 검증자 정정: 원 P2 → P3(현재 결함이 아니라 의도된 설계에 대한 심층 방어). 호출부 try/catch 필요성을 보탰다.

#### DB-14. 마이그레이션 드리프트 판정이 개수 기반이라 밀린 항목의 이름이 부정확할 수 있다 [P3 · S]

① `scripts/check-migration-drift.mjs:36-53`, `lib/ops/migrationDrift.ts:124`, `lib/ops/migrationDrift.test.ts`, `.github/workflows/ci.yml`, `lib/ops/healthCheck.ts`

② 지금 코드가 하는 일.

```js
  const res = await client.execute('select count(*) as count from __drizzle_migrations');
  appliedCount = Number(res.rows[0].count ?? 0);
...
const pendingCount = Math.max(localTags.length - appliedCount, 0);
// lib/ops/migrationDrift.ts:124  const pendingCount = Math.max(localCount - appliedCount, 0);
```

파일 머리 주석: '이 스크립트가 실패해도 배포는 막히지 않는다'. TURSO_* 없으면 console.log 후 exit 0, 토큰이 만료됐으면 조회 실패로 exit 1.

③ 왜 문제인가. 개수 비교는 건너뛴 항목의 존재는 잡지만(건너뛴 만큼 적용 행이 모자란다) 이름은 저널 뒤쪽 것을 댄다(CLAUDE.md가 이미 인정한 한계). 놓치는 경우는 저널에 없는 적용 행이 섞여 개수가 상쇄될 때뿐이고 그 경로는 CLAUDE.md '브랜치 체크아웃에서 db:migrate 금지'가 따로 막는다. 같은 판정이 .mjs와 .ts에 복제돼 있다 — .mjs가 plain Node로 돌아야 한다는 이유로 주석에 명시한 의도된 선택이나 둘이 갈릴 수 있다.

④ 조건과 결과. 현재는 밀린 건수를 항상 알려 주고 어긋남 시 이름만 틀릴 수 있다. 운영 `__drizzle_migrations.created_at` 52개와 저널 when 52개는 정확히 일치한다(미적용 0, 저널에 없는 적용 0). 사고 방어의 구멍은 아니다.

⑤ **수정**(급하지 않다): 판정을 집합 비교로 — `SELECT created_at FROM __drizzle_migrations`를 저널 `entries[].when`과 대조해 when이 적용 집합에 없는 엔트리를 pending으로 보고한다(`created_at` = `folderMillis` = when임을 운영 DB 52/52로 확인). 계산을 순수 JS 모듈 하나(예: `lib/ops/migrationDriftCore.js`)로 모아 .mjs가 import하고 TS에서도 import한다. 시크릿 부재 시 `::warning::` 어노테이션을 남기는 정도면 충분하다.

⑥ 검증자 정정: '가운데가 건너뛰어지면 침묵한다'와 '시크릿이 만료돼도 exit 0'은 사실과 달라 바로잡았다.

#### DB-15. 드리프트 점검용 CI 시크릿이 읽기 전용 토큰인지 확인되지 않았다 [P3 · S]

① `.github/workflows/ci.yml:97-101`, `scripts/check-migration-drift.mjs`, `CLAUDE.md`

② 지금 코드가 하는 일.

```yaml
      - name: Check migration drift
        run: node scripts/check-migration-drift.mjs
        env:
          TURSO_DATABASE_URL: ${{ secrets.TURSO_DATABASE_URL }}
          TURSO_AUTH_TOKEN: ${{ secrets.TURSO_AUTH_TOKEN }}
```

스크립트가 하는 일은 `select count(*) from __drizzle_migrations` 한 줄이다.

③ 왜 문제인가. 점검은 select 한 줄뿐인데 토큰의 실제 권한을 저장소에서 확인할 수 없다(`gh secret list`는 이름과 등록 시각만 보인다). 쓰기 가능 토큰이면 이 step에서 import하는 `@libsql/client` 등 설치 모듈이 오염된 경우 운영 DB를 쓸 수 있다. 시크릿은 이 step의 env에만 주어져 `npm ci` 단계의 postinstall은 접근하지 못하고, 잡은 push(main)에서만 돌아 fork PR에는 시크릿이 없다.

④ 조건과 결과. 공급망 침해가 이 step에 닿는 좁은 경로에서만 운영 DB 접근으로 이어진다. 토큰 권한 미확인.

⑤ **수정**: 새 읽기 전용 토큰을 `~/.turso/turso db tokens create studio-nol --read-only -e <기한>`으로 발급해 GitHub Secret `TURSO_AUTH_TOKEN`만 교체한다(main push에서 드리프트 점검이 초록인지 확인). **`db tokens invalidate studio-nol`은 실행하지 않는다** — 그 DB의 모든 기존 토큰을 무효화해 운영 Vercel의 `TURSO_AUTH_TOKEN`도 즉시 죽고, Vercel의 TURSO_*는 Sensitive라 값을 되살릴 수도 없다. 옛 쓰기 토큰의 개별 폐기는 불가능하고 전체 회전만 있으므로, 회전이 필요하면 새 쓰기 토큰을 먼저 만들어 Vercel env를 교체·배포한 뒤 따로 한다. 이미 읽기 전용으로 발급했다면 할 일이 없다. CLAUDE.md 'Turso CLI' 절에 한 줄 기록.

⑥ 검증자 정정: 원 수정안의 `invalidate`는 운영 장애를 일으키는 명령이라 금지로 바꿨다.

#### DB-16. 옛 칸 폴백(UNION ALL + pledgeLines 폴백)은 의도된 설계 — 백필은 선택 정리이고, 폴백 제거 단계만 배포 순서에 매인다 [P3 · M]

① `lib/funding/pledgeLinesSql.ts:14-22`, `lib/funding/pledgeLines.ts`, `lib/funding/lineRefund.ts:79`, `lib/funding/service.ts:300`, `pages/api/admin/funding/pledges/index.ts:253`, `db/schema.ts:480-487`, `lib/funding/CLAUDE.md:178-195`

② 지금 코드가 하는 일.

```ts
export const fundingPledgeLinesSql = (): SQL => sql`(
  SELECT i.pledge_id AS pledge_id, ... i.quantity - i.refunded_quantity AS quantity, i.position AS position
  FROM funding_pledge_items i
  UNION ALL
  SELECT fp0.id, fp0.reward_id, fp0.reward_title, fp0.unit_amount, fp0.quantity, 0
  FROM funding_pledges fp0
  WHERE NOT EXISTS (SELECT 1 FROM funding_pledge_items i0 WHERE i0.pledge_id = fp0.id)
)`;
```

`funding_pledges.reward_id/reward_title/unit_amount/quantity`는 NOT NULL이라 새 후원도 첫 줄을 복사해 둔다. 새 후원·수기 등록은 전부 items에 쓴다(`service.ts:300`, `admin/funding/pledges/index.ts:253`). 옛 칸만 가진 것은 0042(2026-09-28) 이전 후원뿐.

③ 왜 문제인가. 재고·집계 SQL이 UNION ALL 폴백을 거치고 TS에는 `pledgeLines()` 폴백이 따로 있어 두 곳을 같이 유지해야 한다. 성능은 in-memory SQLite EXPLAIN으로 확인: NOT EXISTS는 `funding_pledge_items_pledge_reward_unique` 커버링 인덱스를, 첫 갈래는 `funding_pledge_items_reward_idx`를 타고 전체 스캔은 둘째 갈래 `SCAN fp0` 하나뿐(후원 1건=1행). 옛 칸 NOT NULL 중복 저장이 남는 한 `fp.reward_id` 직접 읽기 함정(조용히 첫 줄만 보임)도 남는다 — 현재 lib/funding 안에서 옛 칸을 직접 읽는 곳은 `lineRefund.ts:79`의 이관 INSERT뿐. 문서화된 의도적 설계다(`lib/funding/CLAUDE.md:178-195`, `pledgeLines.ts` 머리 주석).

④ 조건과 결과. 버그도 성능 사고도 아니다. 유지보수 비용이다. 단, **폴백 제거 코드가 백필 적용 전에 배포되면** 옛 후원이 에러 없이 재고·판매 수량·배송 목록에서 통째로 빠져 한정 리워드가 초과 판매된다(이 저장소는 마이그레이션 수동 적용, 2026-09-21에 3건 밀린 전례).

⑤ **수정**(급하지 않다, 하려면 두 단계):
1. 마이그레이션 **0052**(저널 마지막이 0051): 옛 후원 백필 `INSERT INTO funding_pledge_items (id, pledge_id, reward_id, reward_title, unit_amount, quantity, refunded_quantity, position, created_at) SELECT lower(hex(randomblob(16))), fp.id, fp.reward_id, fp.reward_title, fp.unit_amount, fp.quantity, 0, 0, fp.created_at FROM funding_pledges fp WHERE NOT EXISTS (SELECT 1 FROM funding_pledge_items i WHERE i.pledge_id = fp.id)`. 적용 후 운영 DB에서 줄 없는 후원이 0건임을 `SELECT COUNT(*)`로 확인.
2. 그 확인 뒤 **별도 배포**에서만 UNION ALL 폴백과 `pledgeLines` 폴백을 제거하고 테스트 픽스처(service·admin-list·healthCheck·salesLedger 통합 테스트의 옛 칸 INSERT)를 items 기준으로 고친다.
- 옛 칸 nullable 완화는 하지 않는다 — SQLite 테이블 재작성이고 `funding_pledge_items.pledge_id ON DELETE CASCADE` 때문에 DROP/재생성 시 줄이 연쇄 삭제될 수 있다.
- 함정 방지가 목적이면 `fp.reward_id`·`pledge.rewardId` 직접 읽기를 막는 소스 grep 테스트 한 개가 더 싸다.

⑥ 검증자 정정: 원 지적의 '모든 재고 판정이 전체 스캔'·'백필은 배포 순서 위험 없음'·마이그레이션 번호가 틀려 고쳤고, 원 수정이 핵심 함정(NOT NULL 중복)을 풀지 못한다는 점을 적었다.

#### DB-17. 구독 회차 청구의 orders/subscription_payments 두 INSERT가 비원자적 — 관리자 수동 결제가 겹치면 pending 고아 주문과 500이 남는다 (cron끼리는 CAS가 이미 막음) [P3 · M]

① `lib/billing/service.ts:487-519`(chargeCycle)·`:1225`(claimDueSubscription), `db/schema.ts:1235`(subscription_payments_cycle_attempt_unique), `pages/api/cron/billing-charge.ts:100-120`·`:~203`, `pages/api/admin/subscriptions/[id].ts:~100`·`:~281`, `lib/ops/healthCheck.ts:~694`

② 지금 코드가 하는 일.

```ts
  const attempt = prior.length + 1;
  const orderNo = generateOrderNo(now);
  ...
  const [order] = await db.insert(orders).values({ orderNo, type: 'subscription', ... }).returning({ id: orders.id });

  const [attemptRow] = await db.insert(subscriptionPayments).values({ subscriptionId, orderId: order.id, cycleYm, attempt, ... status: 'pending', attemptedAt: now }).returning({ id: subscriptionPayments.id });

  const toss = await chargeBillingKey({ ... idempotencyKey: chargeIdempotencyKey(subscriptionId, cycleYm, attempt) });
```

③ 왜 문제인가. `claimDueSubscription`의 CAS는 cron끼리의 겹침을 막고 그 주석이 '남는 구멍은 주인 없는 pending orders 행 하나'라고 명시한다. 관리자 수동 결제 경로(reason manual)에는 CAS가 걸리지 않는다. 겹치면 뒤진 쪽이 orders를 만든 뒤 subscription_payments 유니크 위반으로 던져 주인 없는 `type=subscription` pending 행이 남고 관리자에게 500(catch 후 500, `admin/subscriptions/[id].ts:~281`)이 나간다. 이중 청구는 유니크 인덱스와 토스 멱등키가 막는다.

④ 조건과 결과. cron과 관리자 수동 결제가 겹치거나 수동 결제를 동시에 두 번 누를 때, 또는 두 INSERT 사이의 일시 DB 오류 — 일 1회 cron과 단일 운영자 환경이라 드물다. 고아 행(고객 이름·연락처 포함)은 payments·subscription_payments가 없어 매출장부(payments 기준)·헬스체크 paymentMismatch(exists payments 필요)에 잡히지 않고 정리 경로도 없다. 돈·데이터 정합성 손상은 없다.

⑤ **수정**: order id를 미리 `randomUUID().replace(/-/g,'')`로 만들어 `db.batch([insert orders, insert subscription_payments])`로 한 트랜잭션에 넣는다(유니크 위반이면 둘 다 롤백 — funding/shows가 쓰는 패턴). 유니크 위반(`subscription_payments_cycle_attempt_unique`)만 `isUniqueConflictError`로 잡아 `ChargeCycleResult`에 **별도 신호**(예: `{ ok: false, code: 'in_progress' }`)를 돌려주고, cron은 그 신호를 `summary.skipped`로, 관리자 라우트는 409 '이미 진행 중'으로 처리한다. **일반 `ok:false`로 돌리면 안 된다** — cron은 `summary.failed` 처리 후 고객에게 결제 실패 메일을 보내고(`billing-charge.ts:100-120`) 관리자 라우트도 `sendSubscriptionChargeFailedEmail`을 보내므로, 다른 프로세스가 성공 중인데 거짓 실패 메일이 나간다. **attempt를 INSERT 안에서 MAX+1로 계산하는 안은 채택하지 않는다** — 유니크 위반이 이중 청구 방어선이라 동시 호출 둘이 attempt 1·2를 받으면 서로 다른 멱등키(`billing:…:1`, `:2`)로 둘 다 토스를 불러 이중 청구가 된다.

⑥ 검증자 정정: 원 P2 → P3(대부분 CAS가 막고 영향이 고아 행 몇 개). 원 수정안 중 MAX+1 계산과 ok:false 반환은 이중 청구·거짓 실패 메일을 만들어 제외했다.

#### DB-18. 접속기록 저장 실패가 console.error 한 줄뿐 — 운영자 알림이 없다 (fail-open 자체는 테스트로 고정된 설계) [P3 · M]

① `lib/privacy/accessLog.ts:81-100`(·`:74-80` 주석), `pages/api/admin/funding/projects/[id]/resident-number.ts:66·74`, `lib/email/operatorAlert.ts`, `lib/ops/healthCheck.ts`, `lib/booking/rate-limit.ts:39`, `lib/privacy/accessLog.integration.test.ts:174`

② 지금 코드가 하는 일.

```ts
export const recordPrivacyAccess = async (entry: PrivacyAccessEntry): Promise<void> => {
  try {
    await getDb().insert(privacyAccessLogs).values({...});
  } catch (error: unknown) {
    console.error('[privacy] 접속기록 저장 실패 — 조회는 계속됩니다', {...});
  }
};
```

같은 파일 주석: '기록이 안 남고 있는 상태가 곧 법 위반이므로 침묵이 가장 나쁜 선택이다'. `db/schema.ts:1338`: '런타임 로그는 며칠 뒤 사라지고 Log Drain도 없다'. `resident-number.ts`는 `loadFundingResidentNumber`(66행)로 값을 읽은 뒤 `log('success')`(74행)를 await하고 200으로 값을 싣는다. `healthCheck.ts`에 privacy_access_logs 항목 없음(grep 0건).

③ 왜 문제인가. INSERT 실패를 삼키고 휘발성 서버 로그만 남겨, 읽기는 되고 쓰기만 실패하는 부분 장애에서 고유식별정보 열람 기록이 빠져도 아무도 알지 못한다. fail-open은 구현 시점의 설계 판단(커밋 85ee743e79, 74-80행 주석)이고 통합 테스트가 고정한다 — 운영자 결정은 아니지만 의도적 설계다.

④ 조건과 결과. DB 전체 장애면 `loadFundingResidentNumber`도 실패해 값이 나가지 않는다. 쓰기 한도·일시 네트워크 오류 같은 부분 장애에서만 기록 1건이 빠진다. 안전성 확보조치 기준 제8조①은 접속기록의 보관·점검을 요구하며 단건 실패 시 접근 차단은 요구하지 않는다. 법적 노출은 있으나 낮은 확률이다.

⑤ **수정**: fail-open은 유지한다. catch 안에서 고유식별정보 계열 action(`funding_resident_number_view`·`funding_resident_number_decrypt_check` 등)에 한해 `consumeRateLimit('privacy_log_failure_alert', 1, 86400)`을 통과하면 `buildOperatorAlertHtml`로 운영자 메일을 보낸다(`pages/api/funding/creator/login.ts:142`와 같은 패턴). `consumeRateLimit`은 DB 실패 시 true를 돌려주므로 쓰기 장애 중에도 알림이 막히지 않는다. 알림 실패는 삼키고, 메일에는 action·targetId·result·시각만 싣는다(열람한 값은 싣지 않는다). `accessLog.integration.test.ts`에 알림 호출 케이스 추가. 하지 말 것: (A) 기록 선행 후 열람 거부 — 로그 테이블 장애가 개설자 원천징수 정산(`payout.ts:416·491`의 주민번호 복호화 점검) 전체를 막는다. '접속기록 0건 대 내보내기' 헬스체크 대조 — 내보내기·열람에 접속기록 외 독립된 흔적이 없어 구현 불가.

⑥ 검증자 정정: 원 P2 → P3. '운영자 결정'이라는 서술과 헬스체크 대조 제안을 바로잡았다.

#### DB-19. raw SQL의 status/type 리터럴이 enum과 맞는지 검사하는 가드가 없다 [P3 · M]

① `db/schema.ts:304`(orders.status)·`:377`·`:404`·`:1107`·`:542`·`:259-263`(주석), `lib/booking/service.ts`, `lib/payments/bankDeposit.ts`, `lib/funding/service.ts`

② 지금 코드가 하는 일.

```ts
  status: text('status', { enum: orderStatusEnum }).notNull().default('pending'),   // orders — CHECK 없음
```

bookings.status(377)·work_orders.status(404)·subscriptions.status(1107)·funding_pledges.fulfillment_status(542)도 같다. 새 표는 CHECK를 쓴다(`shows_status_check` 1631, `show_tickets_status_check` 1722, `refund_accounts_order_kind_check` 690). 주석(259-263): 'orders.status에는 DB CHECK 제약이 없으므로 값 추가에 마이그레이션이 필요 없다'.

③ 왜 문제인가. 상태 칼럼은 의도적으로 CHECK 없이 TS enum뿐이다. drizzle 쓰기(`.set/.values`)는 타입이 막지만 raw SQL의 `status = '…'` 리터럴은 오타가 나도 0행으로 조용히 넘어간다. 리터럴을 훑는 테스트는 없다.

④ 조건과 결과. 실측으로 lib·pages(테스트 제외)의 `status|type = '…'` 리터럴을 schema의 모든 *Enum 값 88개와 대조해 오타 0건 — 지금 깨진 곳은 없다. 새 상태값을 더하거나 raw SQL을 새로 쓸 때 오타가 에러 없이 "주문이 안 잡히는" 버그가 될 수 있다.

⑤ **수정**: jest 테스트 하나(예: `db/schema.sqlLiterals.test.ts`, layoutGuard·pageScaffold류 가드 관행)로 `lib/**`·`pages/**` 비테스트 .ts(x)에서 `(status|type|fulfillment_status)\s*(=|<>|!=|IN)\s*'([^']+)'`를 정규식으로 뽑아 schema의 *Enum 합집합에 속하는지 검사한다. status 칼럼 이름이 orders·bookings·work_orders·payments·refunds 등에서 공유돼 **합집합 대조로는 '다른 표의 유효값을 잘못 쓴 경우'는 못 잡는다**는 한계를 테스트 주석에 적는다. 기존 표 CHECK 추가(테이블 재작성)는 하지 않는다.

⑥ 검증자 정정: 원 impact의 "지금은 테스트가 막고 있을 뿐"은 사실이 아니다(그런 테스트가 없다). 같은 자리를 다른 축(SEC 인증·권한·입력 검증·헤더)도 지적: "manageToken(예약·구독 관리 링크)이 평문 저장·무기한 유효다".

#### DB-20. 이전 리뷰 미처리: contracts.payment_bank/payment_account/payment_account_holder 죽은 컬럼과 실계좌 기본값이 스키마에 남아 있다 [P3 · S]

① `db/schema.ts:47-49`, `lib/contracts/contract-template.md:47`, `lib/contracts/pdf-html.test.ts:28-30`, `lib/contracts/complete-page.test.ts:42-44`, `docs/code-review-2026-08-24-round2.md:120`, `drizzle/migrations/0028_funding_drop_plaintext_payout.sql`

② 지금 코드가 하는 일.

```ts
  paymentBank: text('payment_bank').default('카카오뱅크'),
  paymentAccount: text('payment_account').default('3333-12-5480849'),
  paymentAccountHolder: text('payment_account_holder').default('황경하 / 스튜디오 놀'),
```

비테스트 .ts/.tsx/.mjs/.js 전체 grep에서 참조는 `db/schema.ts`와 마이그레이션 0000뿐이고, 테스트 픽스처 두 곳(위)만 필드를 넣는다. 계좌는 계약 템플릿 47행과 이메일에 따로 있다.

③ 왜 문제인가. 2026-08-24 2차 리뷰 29번 항목('계좌 3중화(컬럼·템플릿·이메일)')이 그대로 미처리다(`git log -S`로 이후 변경 없음). 코드는 아무도 읽거나 쓰지 않는데 새 계약 행마다 같은 계좌번호 문자열이 저장된다.

④ 조건과 결과. 정본이 셋이라 계좌 변경 때 한 곳을 빠뜨릴 위험이 영구히 남고, 컬럼이 살아 있다는 이유로 누군가 다시 읽기 시작하면 옛 계약 행의 틀린 계좌를 안내한다.

⑤ **수정**: `db/schema.ts:47-49` 세 줄 삭제 + 테스트 픽스처 두 곳(`pdf-html.test.ts:28-30`, `complete-page.test.ts:42-44`)에서 세 필드 삭제(안 지우면 tsc 실패) → `db:generate`로 `ALTER TABLE contracts DROP COLUMN payment_bank/payment_account/payment_account_holder` 마이그레이션 발행(0028 방식, when이 기존 최댓값보다 크게). 적용 순서는 0028 머리 주석 그대로 **코드 배포가 먼저, 마이그레이션이 나중**(DB에서 먼저 지우면 옛 코드의 전체 컬럼 SELECT가 깨진다). DB-8·DB-9 인덱스와 같은 마이그레이션에 실어도 된다.

⑥ 비고: 검증자 confirmed.

#### DB-21. 호출처 없는 GET /api/admin/bookings가 SSR 목록과 다른 모집단을 돌려준다(+ 차단 시간 전량 적재) [P3 · S]

① `pages/api/admin/bookings/index.ts:13-42`(·`:24-29`), `pages/admin/bookings/index.tsx:91-93`·`:575-600`, `pages/api/admin/blocks/index.ts`, `components/admin/bookingActions.ts`, `lib/privacy/orderRetention.ts:1026`

② 지금 코드가 하는 일.

```ts
      getDb().query.availabilityBlocks.findMany({
        orderBy: (t, { asc }) => [asc(t.startAt)],
      }),
// pages/api/admin/bookings/index.ts:24-29
      const allOrders = await getDb().query.orders.findMany({ orderBy: desc(createdAt), limit: LIST_LIMIT, with: { bookings, payments, workOrders } });  // type 필터 없음
```

③ 왜 문제인가. `pages/api/admin/bookings/index.ts`는 GET 하나뿐이고 UI·테스트에서 부르지 않는다(`bookingActions.ts`는 `[id]` 경로만 호출). 응답은 type 필터가 없어 후원·구독 주문이 200건 상한을 잠식하던 옛 동작 그대로라 SSR(`pages/admin/bookings/index.tsx`)의 모집단과 다르다. SSR의 blocks 조회는 where·limit이 없고 UI는 지난 블록까지 전부 그리며, 지난 일정은 메모만 파기되고 행은 남는다.

④ 조건과 결과. 누군가 이 API를 붙이면 SSR과 다른 목록이 나온다. blocks는 운영자가 손으로 넣는 휴무·차단 행이라 수년 단위로 쌓여도 영향이 작다.

⑤ **수정**: `pages/api/admin/bookings/index.ts`를 삭제한다(docs의 옛 설계 문구 외 참조 없음). blocks는 필요해질 때 `gte(availabilityBlocks.endAt, 오늘-30일)`만 걸면 되고 지금 손댈 필요는 낮다. 모집단 함수(`lib/booking/adminList.ts`)를 새로 만들지 않는다 — 죽은 경로를 살리는 일이다.

⑥ 검증자 정정: 원 수정안의 공용 모집단 함수 신설은 과해 삭제로 바꿨다. 같은 자리를 다른 축(PAY 결제·주문·예약)도 지적: "죽은 라우트 GET /api/admin/bookings가 예전의 유형 필터 없는 목록 로직을 그대로 갖고 있다".

#### DB-22. billing_keys에 구독당 활성 키 1개 보장이 없다(signatures·contract_clauses는 구조상 안전) [P3 · S]

① `db/schema.ts:1187-1209`(billing_keys), `lib/billing/service.ts:310-327`(completeCardSetup), `lib/contracts/service.ts:210-224`(createContract), `drizzle/migrations/0012_*.sql:15`

② 지금 코드가 하는 일. 스냅샷에서 signatures·contract_clauses·contract_attachments 인덱스는 `[]`, billing_keys는 `billing_key` 칼럼만 unique. `revokedAt IS NULL`인 활성 키가 구독당 하나라는 규칙은 코드 주석('현재 유효한 카드(revoke되지 않은 것)')에만 있다. `completeCardSetup`은 revoke UPDATE와 INSERT를 별개 문장으로 보내고 catch가 없다.

③ 왜 문제인가. signatures·contract_clauses는 삽입 경로가 `createContract` 배치 한 곳뿐(원자적, 고객 서명 1행 + 고정 REQUIRED_CLAUSES)이고 재삽입·갱신 경로가 없어 구조상 중복이 생길 수 없다 — 제약을 더해도 막을 사고가 없다. billing_keys는 동시 카드 등록 경합에서 이론상 활성 키가 둘이 될 수 있다.

④ 조건과 결과. 발현 근거 없음. 같은 authKey는 토스가 한 번만 발급하고 setupToken도 1회성이라 실제 동시 발급은 서로 다른 두 카드를 동시에 등록할 때뿐이다.

⑤ **수정**(원하면 billing_keys만): `uniqueIndex('billing_keys_active_unique').on(t.subscriptionId).where(sql\`revoked_at IS NULL\`)`. **반드시 `completeCardSetup`의 INSERT에 유니크 예외 처리를 같이 넣는다** — 없으면 경합 시 두 번째 INSERT가 UNIQUE 예외로 터져 "토스는 발급 완료, 우리는 500"이 된다(이미 활성 키가 있으면 안전하게 중단·로그·운영자 알림). 적용 전 `SELECT subscription_id, count(*) FROM billing_keys WHERE revoked_at IS NULL GROUP BY 1 HAVING count(*)>1`로 기존 중복 확인. signatures·contract_clauses는 하지 않는다.

⑥ 검증자 정정: 원 지적의 세 건 중 두 건(signatures·contract_clauses)은 구조상 안전해 제외했고, 인덱스만 넣으면 500이 생기는 점을 보탰다.

#### DB-23. 계약 보존 기간 계산·파기 표식이 privacy/orderRetention의 것과 따로 복제돼 있다 [P3 · S]

① `lib/contracts/retention.ts:16-27`, `lib/privacy/orderRetention.ts:48`·`:95-99`, `lib/funding/retention.ts:5`·`:41-45`, `lib/privacy/accessLog.ts:143`

② 지금 코드가 하는 일.

```ts
// lib/contracts/retention.ts
const PURGED_MARK = '(개인정보 파기됨)';
export const getRetentionBoundary = (now = new Date()) => { const boundary = new Date(now); boundary.setFullYear(boundary.getFullYear() - RETENTION_YEARS); return boundary; };
// lib/privacy/orderRetention.ts:48 export const PURGED_MARK = ..., :95 const yearsAgo = ... (동일)
```

`lib/funding/retention.ts:5`는 이미 `import { PURGED_MARK } from '../privacy/orderRetention'`로 공용을 쓴다.

③ 왜 문제인가. PURGED_MARK 사본은 `contracts/retention.ts:16`의 비-export 상수 한 곳(주석으로 "같은 문자열" 동기화). 연수 차감 `setFullYear` 헬퍼는 contracts·funding·orderRetention·accessLog 네 곳이며 2/29 기준일은 JS가 3/1로 넘긴다.

④ 조건과 결과. 표식 문자열이 한쪽만 바뀌면 `isPurgedValue`가 계약 쪽 표식을 못 알아본다. 윤년 하루 오차는 4년에 한 번 하루 이른 파기라 무시할 수준.

⑤ **수정**: 새 파일 없이 — `lib/privacy/orderRetention.ts`는 db/client·db/schema·drizzle만 import하고 contracts를 import하지 않아 순환이 없으므로, `contracts/retention.ts`가 그 파일의 `PURGED_MARK`를 import하고, `yearsAgo`를 export해 funding·contracts·accessLog가 쓰게 한다. 2/29 클램프가 필요하면 그 한 함수에만 넣고 2028-02-29 단위 테스트를 추가.

⑥ 검증자 정정: 원 지적의 'PURGED_MARK 세 파일'·'헬퍼 3곳'·새 파일(`retentionConstants.ts`) 제안을 바로잡았다. 같은 자리를 다른 축(PRV 개인정보·처리방침 정합·로그)도 지적: "PURGED_MARK 상수가 두 곳에 따로 있다".

#### DB-24. 관리자 첫 화면이 열릴 때마다 collectDbIssues의 순차 쿼리 약 20여 개를 다시 돈다(실측 없음) [P3 · S]

① `lib/ops/adminDashboard.ts:76-80`(·`:79`), `lib/ops/healthCheck.ts:340-1063`(collectDbIssues), `pages/admin/index.tsx`

② 지금 코드가 하는 일.

```ts
  const [issues, sessions, mixingCounts, ...] = await Promise.all([
    collectDbIssues(now),   // healthCheck.ts의 DB 판정 전부 (refunds⨝payments⨝orders⨝funding_pledges, 암호화 컬럼 카운트 등)
    db.select(...)...
```

`collectDbIssues`(약 720줄) 안에서 약 21개의 DB 호출이 순차 await다(Promise.all 없음).

③ 왜 문제인가. 대시보드 로드마다 반복되지만 지연·비용을 잰 자료는 없다. 관리자 한 명이 보는 SSR 첫 화면이라 호출 빈도가 낮다.

④ 조건과 결과. 관리자 1인 화면의 응답 지연 가능성. 비용 영향은 확인된 바 없다.

⑤ **수정**: 캐시는 넣지 않는다 — 이 화면의 목적("고치고 돌아와 사라졌는지 본다", 메일과 화면이 같은 판정식, `adminDashboard.ts` 머리 주석)과 충돌하고 서버리스 인스턴스마다 캐시가 달라 더 헷갈린다. 먼저 `loadAdminDashboard` 소요 시간을 로그로 한 번 재고, 느리면 서로 독립인 점검을 `Promise.all`로 묶는다.

⑥ 검증자 정정: 원 수정안의 60~120초 메모리 캐시를 제외했다. 원 지적이 언급한 "앞 지적의 인덱스"는 목록에 없어 확인하지 못했다.

**클린 판정**
- drizzle 저널(`drizzle/migrations/meta/_journal.json`): 52개 엔트리 when 엄격 증가, idx 중복 없음, 엔트리마다 SQL 파일과 스냅샷 존재, 스냅샷 prevId 사슬 0000→0051 끊김 없음(스크립트로 전수 확인).
- `db/schema.ts` ↔ 스냅샷 0051 정합: 스크래치 복사본에 drizzle-kit generate를 돌려 'No schema changes, nothing to migrate' 확인(저장소 파일은 건드리지 않음).
- 최근 마이그레이션 SQL 0042~0051과 위험했던 0028(DROP COLUMN)·0033·0034(부분 유니크 인덱스)·0040(테이블 재작성): 추가형이거나 순서 주석이 명확하고, 새 표는 CHECK·FK·인덱스를 갖췄다.
- 원자성: 재고·점유·정산 핵심 경로가 모두 'INSERT ... SELECT ... WHERE (게이트)' + db.batch(트랜잭션)로 구성됨 — createFundingPledge, createBookingOrder 겹침 검사, createShowOrder(판매창·구역·티켓타입 3중 게이트), booking/funding confirm의 payments→orders→하위 전이 batch, lineRefund의 선점 UPDATE, closeDormantSubscriptions(파기+종료 batch). 경쟁 조건의 근거 주석과 코드가 일치.
- 멱등·선점 패턴: review_requests 기록 먼저 넣고 발송, webhook_events 키 선기록+실패 시 회수, refund_accounts (order_kind,order_no) 유니크, funding_projects 부분 유니크(slug, rejected 제외), subscription_payments (subscription,cycle,attempt) 유니크.
- 보존·파기 구현 완전성(공연 예매자 정보 제외): funding/retention.ts, contracts/retention.ts(PDF 먼저 삭제 후 표식), orderRetention.ts의 14개 함수(주문·구독·결제 원본·빌링키 원본·환불 사유·요청사항·차단 메모·환불 계좌), 접속기록 2년, webhook_events 90일, 백업 28일 정리가 처리방침 18항 ①~⑬ 열거와 대응. 주 파기 기산점이 updated_at이라 상태 전이 UPDATE가 updated_at을 올리는지 grep으로 확인했고 notification_error 갱신만 의도적으로 제외돼 있다.
- 필드 암호화 회전 대상(ENCRYPTED_FIELD_TARGETS 3개)과 헬스체크의 회전 대기 집계, 접속기록 조회 쿼리(at/target/actor 인덱스)와 selectDistinct 수행자 목록.
- 요금/금액 컬럼은 전부 integer(원 단위), 불리언은 integer mode boolean, 시각은 초 단위 정수로 일관(상세 불일치는 P3로 별도 기재).
- 관리자 목록 쿼리 대부분이 limit(LIST_LIMIT+1)로 잘림 여부를 판별하고 서버 집계 SQL로 KPI를 분리(admin-list.ts) — 상한 없는 것은 availability_blocks 하나뿐.
- 이전 리뷰(2026-08-24, round2) 중 DB 관련 항목: identity rate limit DB 장애 시 무제한 대입(#24)은 인스턴스 로컬 폴백으로 수정됨, 계약 파기 기산점·terminationReason/description 파기는 반영됨.

**읽지 못한 범위**
- 운영 Turso에 접속하지 못했다(규칙상 금지): 실제 행 수, EXPLAIN QUERY PLAN, PRAGMA foreign_keys 값, PITR 보존 기간·플랜, __drizzle_migrations 현재 상태는 확인하지 못했다. 인덱스 지적의 심각도는 행 수 추정에 기대고 있다. (검증 단계에서 행 수·플랜·PITR·마이그레이션 상태는 실측으로 보완됐고 각 항목에 반영했다.)
- db 호출 118개 파일 중 전수 정독은 아님: lib/artistSupport/*, lib/billing/refund.ts·webhook 복구 경로, lib/funding/{adminProjects,reviewDecision,creatorProjectWrite,creatorAccountDecision,fulfillment,cancel,confirm}.ts, lib/shows/{refund,checkin,confirm 환불 구간,showtimeOps 후반}.ts, lib/payments/*, pages/api/** 대부분은 grep과 발췌로만 봤다.
- scripts/rotate-field-key.mjs, scripts/seed-show.ts, lib/shows/seed.ts의 배치 쓰기, scripts/ 내 DB 직접 접근 스크립트는 읽지 않았다.
- docs/code-review-2026-08-24.md 본문 전체와 2026-09-08-seo-aeo-geo.md는 DB 관점 키워드 검색만 했다(SEO 문서는 DB 항목이 없다고 판단).
- jest는 실행하지 않았다(읽기 전용 범위에서 구조·정적 근거 위주). schema 정합은 drizzle-kit generate를 스크래치 복사본에서 돌려 확인했다.
- Turso/libsql 서버 쪽 동작(WebSocket 유휴 만료, FK 기본값, RETURNING의 rowsAffected)은 코드 주석과 클라이언트 소스로만 판단했다.

**미검증 후보(overflow)**
- lib/booking/webhook.ts reconcileRefunds: refunds 중복 방지가 앱 합계 대사에만 있고(주석이 '좁은 경합에서 같은 금액을 한 번 더 기록할 수 있다'고 인정), tossTransactionKey 부분 유니크가 없다 — 델타 행에 마지막 cancel의 키를 재사용하므로 인덱스를 넣으려면 델타 행 키를 NULL로 바꿔야 한다.
- lib/funding/payout.ts recordFundingPayout: buildFundingPayoutPreview 계산과 INSERT 사이에 환불·입금확정이 끼면 '불변' 정산 행이 그 순간 값으로 굳는다(expected 비교는 화면에 보인 값과의 일치만 본다). INSERT ... SELECT 집계로 한 문장에 묶는 방안.
- lib/shows/service.ts expireStaleShowOrders: 주문별 루프(N+1)에서 orders UPDATE와 show_tickets void UPDATE가 별도 문장이라 중간 실패 시 expired 주문에 held 티켓이 남는다(좌석 집계는 hold 만료로 무시하므로 영향은 표시 수준). db.batch로 묶기.
- 운영 마이그레이션 적용이 3단계 수동 절차(CLAUDE.md)다 — scripts/db-migrate-prod.sh로 확인→적용(-e 1d 토큰)→검증을 묶으면 실수 여지가 준다(단순함 원칙과 충돌하면 보류).
- lib/funding/mediaRetention.ts: funding_rewards.description의 마크다운 이미지 참조는 referencedFilenames에서 보지 않는다 — 리워드 설명에 업로드 이미지를 넣을 수 있게 되면 살아 있는 그림이 고아로 삭제된다.
- pages/api/funding/[slug]/status.ts 등 공개 GET이 getFundingProjectAsync로 DB를 조회하는데 slug 형식 검증이 없다(임의 문자열마다 DB 조회) — SLUG_PATTERN 선검증 추가(shows/availability.ts는 이미 함).
- lib/booking/service.ts:158 UPDATE orders SET status = 'failed' 가 updated_at을 올리지 않는다(5년 파기 기산점에 쓰이는 컬럼; 즉시 실패 주문이라 영향은 없음).

### PRV. 개인정보·처리방침 정합·로그
P0 0 · P1 0 · P2 9 · P3 19, 미검증 0

#### PRV-1. 단일 쿼리로 개인정보를 쓰는 경로의 drizzle 오류를 요지만 남긴다 — batch 경로는 이미 안전하다 [P2 · M]
`pages/api/funding/creator/projects/[id].ts:156-168` (핸들러, try/catch 없음) · `lib/funding/creatorProjectWrite.ts:571-578` (정산 저장) · 같은 파일 `:351-358` (개설자 프로필 저장) · `lib/booking/service.ts:98-110` (예약 주문 `db.run(INSERT INTO orders …)`) · `lib/billing/service.ts:178-185` (구독 `insert(subscriptions)`) · `lib/payments/refundAccount.ts:67-69` (`safeDbErrorSummary` 원본)

지금 코드:
```ts
// pages/api/funding/creator/projects/[id].ts:162 — try/catch 없음
return respondWriteResult(res, await savePayoutSection(auth.creatorId, validatedPayout.value));
// lib/funding/creatorProjectWrite.ts:571-577
await getDb().update(fundingCreators).set({ taxType: value.taxType, payoutAccountEnc, payoutAccountLast4: ..., ...(residentNumberEnc === undefined ? {} : { residentNumberEnc }), ...
// node_modules/drizzle-orm/errors.js
super(`Failed query: ${query}\nparams: ${params}`);
// node_modules/drizzle-orm/sqlite-core/session.js:43
throw new DrizzleQueryError(queryString, params, e);
```

왜 문제인가: drizzle-orm 0.45.2의 `DrizzleQueryError`는 `Failed query: …\nparams: …`로 바인딩 값 전부를 `message`에 넣고 `query`·`params`를 own property로도 단다. Next Pages API는 핸들러 밖으로 던진 오류를 `console.error(err)`로 찍는다(api-resolver.js:376). 이 래핑은 `run/all/get/values` 단일 쿼리 경로에서만 일어나고 `db.batch()`는 `this.client.batch()`를 직접 불러 래핑하지 않는다(libsql/session.js:36-47). 그래서 계약 서명(`sign.ts:209` batch)·펀딩 주문 INSERT·공연 주문 INSERT·payments INSERT(`funding/confirm.ts:298`, `booking/confirm.ts:623`, 모두 batch)는 해당 없음. 실제로 새는 곳은 단일 쿼리로 개인정보를 바인딩하는 네 경로다: 정산 저장(정산 계좌·주민번호 **암호문**과 뒤4자리 — `lib/crypto/CLAUDE.md` '암호문도 담지 않는다'와 직접 충돌), 개설자 프로필 저장(이름·연락처·전화·소개 평문), 예약 주문 생성(customer_email/phone), 구독 생성. 저장소는 이 함정을 이미 알고 `safeDbErrorSummary`를 계좌 입금·환불 계좌 경로 9곳(bankDepositOrders.ts·refundAccountView.ts·booking/bankDeposit.ts)에 쓰고 있다 — 일반화가 안 된 것이지 모르는 것이 아니다.

조건과 결과: Turso 일시 장애(SQLITE_BUSY 등) 중에 개설자가 정산 정보를 저장하거나 고객이 예약·구독을 만들면, 정산 계좌·주민번호 암호문과 개설자·예약자 연락처 평문이 Vercel 런타임 로그에 남는다. 노출처는 런타임 로그뿐이고 운영자 메일·DB로 가는 경로는 확인되지 않았다.

**수정**:
1. `safeDbErrorSummary`를 `lib/payments/refundAccount.ts`에서 `lib/logging/safeError.ts`로 옮겨 일반화한다(기존 import는 re-export로 유지). 요지는 지금처럼 name+code만 — `message.split('\nparams:')[0]`를 덧붙이려면 `cause`(LibsqlError)의 message까지만 허용하고 `params`·`query` 속성은 절대 전개하지 않는다.
2. 우선 적용 대상은 개인정보를 바인딩하는 **단일 쿼리** 호출부와 그 핸들러: `pages/api/funding/creator/projects/[id].ts`의 creator·payout 분기를 try/catch로 감싸 500 JSON(코드만) + `safeErrorSummary` 로그, 예약 주문 생성 API·구독 생성 API의 catch, `pages/api/cron/billing-charge.ts`의 `summary.errors.message`. 계약 서명·펀딩/공연 주문·payments INSERT(batch)는 대상에서 빼되, 방어 차원에서 catch의 `console.error(..., error)`를 요지 로깅으로 바꾸는 것은 무해하다.
3. 회귀 방지는 ESLint 전면 금지(현재 raw 로깅 200곳)보다 jest 하나가 현실적: `new DrizzleQueryError('UPDATE … ?', ['v2:…'], new Error('SQLITE_BUSY'))`를 요지 함수에 넣어 결과 `JSON.stringify`에 `'params'`·`'v2:'`가 없음을 검사.
4. 운영자 알림 reason·`notification_error`는 drizzle이 아니라 메일 오류(Resend)가 주 원천이므로 이 지적의 수정 범위에서 분리한다.

비고: 검증자가 바로잡음 — 원 지적이 가장 무겁게 든 계약 서명(생년월일·주소·본문·서명 이미지)·펀딩/공연 주문·payments INSERT는 전부 batch라 메시지에 실리지 않는다. purge-contracts의 params는 파기 표식·날짜뿐이고 review-requests insert는 kind/refId/orderId/sentAt만 바인딩한다(reviewRequests.ts:220-223). 19항 '값 자체는 기록하지 않습니다'는 접속기록 서술이라 서버 로그를 약속한 것이 아니므로 P1이 아니라 P2.

#### PRV-2. 계약 목록 직렬화는 목록 UI가 쓰는 열만 — 생년월일·주소·본문은 상세(접속기록 대상)에서만 나간다 [P2 · S]
`lib/contracts/serialize.ts:23-29` · `pages/api/contracts/index.ts:22-31` · `pages/admin/contracts/index.tsx:84` · `db/schema.ts:30-81` (contracts 컬럼), `:1427` (contract_view 주석)

지금 코드:
```ts
// pages/api/contracts/index.ts:22-30
const allContracts = await getDb().query.contracts.findMany({ orderBy: ..., limit: LIST_LIMIT });
return res.status(200).json({ ok: true, contracts: allContracts.map((contract) => serializeContractForAdmin(contract)) });
// pages/admin/contracts/index.tsx:84
contracts: allContracts.slice(0, LIST_LIMIT).map((c) => serializeContractForAdmin(c)),
// lib/contracts/serialize.ts:23-29 — signToken만 빼고 전 컬럼 전개
const { signToken: _signToken, ...rest } = contract; return { ...rest, ...
// db/schema.ts:1427
* 목록 화면은 남기지 않는다 — 한 줄마다 기록하면 노이즈뿐이고, 상세를 열어야 전체 개인정보가 보인다.
```

왜 문제인가: 목록 API와 SSR props가 200건씩 `customerBirthdate`·`customerAddress`·`content`(NOT NULL, 생성 시 템플릿으로 채워져 서명 전에도 이름이 박힌다)·`specialTerms`·`firstViewedIp`를 `__NEXT_DATA__`와 JSON에 싣는다. 접속기록은 상세(`pages/api/contracts/[id].ts:67`, `pages/admin/contracts/[id]/index.tsx:72`)만 `contract_view`로 남기고 그 근거가 '상세를 열어야 전체 개인정보가 보인다'인데, 목록이 같은 값을 싣고 있어 그 전제가 거짓이다. 단 `paymentAccount*`는 스튜디오 자기 계좌(schema.ts:48-49 default `'3333-12-5480849'`·`'황경하 / 스튜디오 놀'`)라 고객 개인정보가 아니다.

조건과 결과: 관리자가 `/admin/contracts`를 열 때마다 200명분 생년월일·주소·계약 본문이 브라우저로 간다. 관리자 세션을 가진 쪽에는 기록 없는 우회로 하나가 생긴다(상세·PDF는 기록된다).

**수정**:
- `lib/contracts/serialize.ts`에 `serializeContractSummary(contract, now)`를 추가해 `id`·`title`·`roomNumber`·`status`(`getEffectiveStatus`)·`startDate`·`endDate`·금액 필드·`customerName`·**`customerEmail`·`customerPhone`**(목록 화면의 검색 `index.tsx:130-132`와 재발송 확인 `index.tsx:189`가 쓴다)·`sentAt`/`signedAt`/`expiresAt`/`purgedAt`/`terminatedAt`·`notificationError`·`signUrl`만 돌려준다.
- `pages/api/contracts/index.ts` GET과 `pages/admin/contracts/index.tsx`가 이것을 쓰게 한다. 상세 라우트는 지금처럼 `serializeContractForAdmin` + `contract_view` 기록.
- 테스트: 목록 직렬화 결과에 `customerBirthdate`·`customerAddress`·`content`·`specialTerms`·`firstViewedIp` 키가 없음을 검사.
- 처리방침·접속기록 enum은 손대지 않는다(목록에 개인정보가 안 실리면 19항 서술이 그대로 참이 된다).

비고: 검증자가 바로잡음 — 19항(privacyPolicy.ts:418)은 '상세 화면을 열어 보는 일'만 기록한다고 적어 법적 약속이 깨진 것은 아니고, `paymentAccount`는 고객 정보가 아니며, 원안의 `contract_list_view` 추가·처리방침 개정은 불필요하다. 같은 자리를 다른 축(CON 전자계약 — 서명·해시·PDF·보관)도 지적: 관리자 목록 응답·SSR props가 전 계약의 본문·생년월일·주소를 실어 보내 접속기록 정책을 우회하고 페이로드가 수 MB다.

#### PRV-3. 예약 캘린더 이벤트 본문은 요청사항 파기와 같은 시점에 비운다 — 발생원 축소는 운영자 결정 [P2 · M]
`lib/booking/confirm.ts:286-292` · `pages/api/admin/bookings/[id].ts:233-238` · `lib/booking/gcal.ts` · `lib/privacy/orderRetention.ts:1-40` · `pages/api/cron/purge-orders.ts` · `data/privacyPolicy.ts:73` (4항 수탁자 표), `:367-375` (18항)

지금 코드:
```ts
// lib/booking/confirm.ts:286-292
summary: `${opts.label ?? '[예약]'} ... — ${order.customerName}`,
description: [
  `상품: ...`,
  `고객: ${order.customerName} / ${order.customerPhone} / ${order.customerEmail}`,
  `주문번호: ${order.orderNo}`,
  `요청사항: ${booking.customerNote ?? '없음'}`,
].join('\n'),
// pages/api/admin/bookings/[id].ts:233-238 도 동일
// deleteBookingEvent 호출처: lib/booking/cancel.ts:512, lib/booking/bankDeposit.ts:156, pages/api/admin/bookings/[id].ts:250 — 취소·교체 때만
```

왜 문제인가: 확정 예약마다 운영자 구글 캘린더 이벤트 본문에 이름·전화·이메일·요청사항이 복사된다. 삭제는 취소·교체·입금 대기 전환 때뿐이고, `lib/privacy/`와 `purge-orders.ts`에는 gcal·캘린더 참조가 전혀 없다. `purgeExpiredBookingCustomerNotes`(요청사항 3년)·고객정보 5년 파기가 돌아도 캘린더 사본은 그대로다. 4항 수탁자 표는 Google LLC에 '이름, 연락처, 이메일 주소, 예약 일시·상품·요청사항, 주문번호'가 간다고 고지하고 파기 시점은 적지 않는다. 18항은 파기 방법을 '데이터베이스에 저장된 해당 값을 지우는 것'이라고 DB 대상으로 서술하므로 약속 위반은 아니지만 수탁자 보관 사본의 파기 공백이다.

조건과 결과: 이용일로부터 3년·5년이 지나 DB가 표식으로 덮인 뒤에도 운영자 캘린더에는 그 고객의 이름·전화·이메일·요청사항이 영구히 남는다.

**수정**:
1. `lib/booking/gcal.ts`에 `redactBookingEvent(eventId, calendar, room)` — `renameBookingEvent`와 같은 후보 캘린더 순회로 `events.patch({ summary: '[예약] <상품명>', description: '주문번호: …' })`.
2. `lib/privacy/orderRetention.ts`에 `redactExpiredBookingCalendarEvents(now)`: `bookings.gcal_event_id IS NOT NULL AND end_at < now - DISPUTE_RETENTION_YEARS`(요청사항 파기 ⑧과 같은 3년·같은 기산점) 건을 건별 try/catch로 patch. 성공 건은 `gcal_event_id`를 유지하되 멱등 판정은 `gcal_error`에 표식을 쓰지 말고 별도 표(또는 description 비교)로 처리. 외부 API라 `{done, failed}`를 돌려 `purge-orders.ts`에서 `failed > 0`이면 purge-contracts처럼 운영자 알림.
3. 처리방침 18항 ⑧ 끝에 '운영자 캘린더에 복사된 같은 항목도 그때 지웁니다' 한 문장 + `FUNDING_TERMS_VERSION` 올리고 `UPDATE_FUNDING_TERMS_BASELINE=1`로 기준선 갱신.
4. 이벤트 본문에서 전화·이메일을 빼는 것(발생원 축소)은 운영자에게 묻는다 — 당일 현장 연락용으로 넣은 값(feeb196bde)이라 일방 변경 금지.

비고: 검증자가 바로잡음 — '법적 약속이 거짓이 된다'는 과장(같은 논리면 Resend·Gmail의 확정 메일 사본도 약속 대상이 된다). 원안의 '1년'은 근거 없는 새 기간이라 요청사항 파기와 같은 `DISPUTE_RETENTION_YEARS`(3년)로 맞춘다.

#### PRV-4. 공연 구매자 이름·연락처(show_orders)를 주문 5년 파기에 따라 표식으로 덮는다 [P2 · S]
`lib/privacy/orderRetention.ts:232-245` · `db/schema.ts:1678-1683` · `lib/shows/service.ts:103-113` · `pages/api/cron/purge-orders.ts` · `data/privacyPolicy.ts:383` (18항 ④), `:394`

지금 코드:
```ts
// db/schema.ts:1678-1683
export const showOrders = sqliteTable('show_orders', {
  orderNo: text('order_no').primaryKey().references(() => orders.orderNo),
  showtimeId: ...,
  buyerName: text('buyer_name').notNull(),
  buyerContact: text('buyer_contact').notNull(),
// lib/privacy/orderRetention.ts:232-233
공연 주문도 `orders` 행을 갖고(`show_orders.order_no`가 `orders.order_no`를 가리킨다) 그 행의 이름이 위 5년 파기로 표식이 되므로, 같은 기준으로 따라간다.
// data/privacyPolicy.ts:394
위 자동 파기 ④~⑩을 거치고 나면 사람을 가리키는 항목은 남지 않습니다.
```

왜 문제인가: `createShowOrder`는 같은 값을 `orders.customer_name/phone`과 `show_orders.buyer_name/buyer_contact`에 두 번 쓴다. `show_orders`를 고치는 코드는 `auto_cancelled_at` 하나뿐이고(`lib/shows/confirm.ts:560`) `lib/privacy/`에는 showOrders 참조가 없다. orderRetention.ts는 공연을 `refund_accounts`(kind 'show')에서만 따라간다. 18항 ④는 '주문(예약·믹싱·펀딩·정기결제)'만 열거해 공연이 빠져 있다.

조건과 결과: 2031년부터 `orders`는 표식인데 `show_orders`에 실명·연락처가 평문으로 남아 18항 '사람을 가리키는 항목은 남지 않습니다'가 공연 구매자에게만 거짓이 된다.

**수정**:
- `lib/privacy/orderRetention.ts`에 `purgeShowOrderBuyerDataOfPurgedOrders`:
  ```sql
  UPDATE show_orders SET buyer_name = ${PURGED_MARK}, buyer_contact = ${PURGED_MARK}
  WHERE order_no IN (SELECT order_no FROM orders WHERE customer_name = ${PURGED_MARK})
    AND (buyer_name <> ${PURGED_MARK} OR buyer_contact <> ${PURGED_MARK})
  ```
  `purgeRefundAccountsOfPurgedOrders`와 같은 모양·같은 `run()` 자리(`purge-orders.ts`에서 orderCustomers 바로 뒤).
- 18항 ④ 괄호에 '공연 예매'를 넣고 `FUNDING_TERMS_VERSION` 올림 + 기준선 갱신.
- `orderRetention.test.ts`에 공연 주문 1건을 세팅해 5년 뒤 두 컬럼이 표식이 되는지 검사.
- 메일·입금 경로의 buyerName 가드는 추가하지 않는다 — 5년 지난 주문에 메일이 갈 경로가 없고 수신처는 `resolveShowRecipient`가 이미 `isPurgedValue`로 거른다(`lib/shows/email.ts:180-186`). 초대권은 `buyer_name`에 발급 사유가 들어 있는데(service.ts:225-228) 같이 표식으로 덮여도 무해하다.

비고: 검증자가 바로잡음 — 첫 대상이 2031년이라 P1이 아니라 P2. 같은 자리를 다른 축(DB 스키마·마이그레이션·쿼리)도 지적: 공연 예매자 이름·연락처(show_orders.buyer_*)가 5년 파기에서 빠져 있다 — 2031년부터 처리방침 '남는 것' 문구가 거짓이 된다. PRV-8과 짝이다.

#### PRV-5. 결제가 성립하지 않은 주문(만료·실패·입금 전 취소)의 이름·연락처는 1년 뒤 파기 — 운영자 확인과 판본 올림이 전제 [P2 · M]
`lib/privacy/orderRetention.ts:136-164` (`:76-83` 자체 판단, `:583-615` 구독) · `lib/funding/service.ts:263-297`, `:310-322` · `lib/funding/bankTransfer.ts:110`, `:156` · `lib/funding/confirm.ts:343` · `lib/ops/healthCheck.ts:692-704` · `pages/api/cron/purge-orders.ts` · `data/privacyPolicy.ts:383`

지금 코드:
```ts
// lib/privacy/orderRetention.ts:151-160 — status 조건이 없다
.where(and(lt(orders.createdAt, boundary), lt(orders.updatedAt, boundary), or(ne(orders.customerName, PURGED_MARK), ...)))
// 같은 파일 :76-83 — 스스로 내린 판단
결제 실패는 계약이 성립하지 않은 사건이라 전자상거래법이 5년 보존을 요구하는 ... 기록도 ... 아니다
// lib/funding/service.ts:263-297 — 결제 전 pending 단계에서 이미 INSERT
INSERT INTO orders (... customer_name, customer_phone, customer_email ...) ... INSERT INTO funding_pledges (... shipping_name, shipping_phone, shipping_postcode, shipping_address1, shipping_address2, shipping_memo ...)
```

왜 문제인가: `purgeExpiredOrderCustomerData`는 생성·갱신일 5년과 표식 여부만 보고 status를 보지 않는다. orders는 결제 전 pending 단계에서 이름·전화·이메일을 넣고(funding service.ts:269-273, booking service.ts, shows service.ts:103) 펀딩은 배송지 여섯 칸까지 같은 batch에서 쓴다. 홀드 만료(`expireStalePledges` 322, booking service 107·201·285, shows 157)·승인 실패(failed)·입금 전 취소(deposit_cancelled, 펀딩은 bankTransfer.ts:156이 'expired')는 전부 행을 남기고, orders를 DELETE하는 운영 코드는 없다. 같은 파일이 결제 실패 사유(76-83)·결제 이력 없는 구독(583-615)을 '계약도 대금결제도 없어 법정 기록이 아니다'라고 판정해 짧게 지우는 것과 비대칭이다. PR #224·#228에 미결제 주문을 5년으로 두기로 한 운영자 결정은 없다. 18항 ④는 '주문으로 받은 세 항목은 5년'이라고 성립 여부를 가리지 않고 고지해 지금 깨진 약속은 아니다.

조건과 결과: 결제창을 열기 전 이탈한 사람의 실명·전화·이메일(펀딩은 집 주소까지)이 법정 보존 근거 없이 5년 남는다. 첫 파기는 어느 쪽이든 2031년.

**수정**:
- `lib/privacy/orderRetention.ts`에 `purgeAbandonedOrderCustomerData(now)`: `status IN ('expired','failed','deposit_cancelled') AND NOT EXISTS (SELECT 1 FROM payments WHERE order_id = orders.id) AND updated_at < now - ABANDONED_ORDER_RETENTION_YEARS(1)`에 세 컬럼 표식. `NOT EXISTS`는 `healthCheck.ts:692-704`가 pending/failed/expired + payments 조합을 결제 불일치 경보로 쓰므로 뺄 수 없다. 1년은 되살리기 창(`funding/confirm.ts:343`, `bankTransfer.ts:110`)보다 충분히 길다.
- `purge-orders.ts`의 orderCustomers `run()` 바로 뒤에 넣어 같은 회차에 `purgeFundingPersonalDataOfPurgedOrders`·`purgeRefundAccountsOfPurgedOrders`가 배송지·환불 계좌를 따라 지우게 한다(추가 코드 불필요).
- 펀딩 계좌 입금 신청은 자동 만료가 없어 운영자·후원자가 닫기 전까지 `pending`에 머무르므로(service.ts:310-322) 위 status 집합 밖에 남는다 — `pending AND hold_expires_at < now-1y AND payment_method = bank_transfer`도 넣을지는 운영자에게 묻는다.
- 처리방침 18항에 '결제가 이루어지지 않은 주문은 1년' 항을 더하고 `FUNDING_TERMS_VERSION` 올림 + 기준선 갱신(ko 처리방침이 후원 동의 해시에 들어간다).
- `orderRetention.test.ts`에 expired+payments 있음(건너뜀)·expired+payments 없음(파기) 두 사례.

비고: 검증자가 바로잡음 — 깨진 약속이 없고 현재 사고가 아니라 제21조① 과보관 정리로 P1→P2. 같은 자리를 다른 축도 지적: (PAY 결제·주문·예약) 결제가 성립하지 않은 주문(만료·실패)의 고객 이름·연락처·이메일이 법정 5년 기준으로 남는다 / (SHW 공연 예매) show_orders의 구매자 이름·연락처가 5년 파기 대상에서 빠져 있다(2031-10부터 효력).

#### PRV-6. 관리자 상세 화면(예약·믹싱·구독·후원·공연 주문)이 접속기록 밖이다 — 공연은 같은 명단 CSV만 기록된다 [P2 · M]
`pages/admin/shows/[id].tsx:57-75` (`:69`) · `pages/admin/bookings/[id].tsx:63` · `pages/admin/funding/[id].tsx:57` · `pages/admin/subscriptions/[id].tsx:55` · `db/schema.ts:1344-1436` (privacyAccessActionEnum) · `pages/admin/privacy-logs.tsx` · `data/privacyPolicy.ts:418`

지금 코드:
```ts
// privacyAccessActionEnum: funding_resident_number_view, funding_payout_account_*, refund_account_view, funding_pledge_export, sales_ledger_export, artist_supporter_export, funding_creator_shipping_export, contract_pdf_download, contract_view, show_roster_export — 이게 전부
// 기록 없이 PII를 SSR props로 싣는 관리자 GSSP: pages/admin/bookings/[id].tsx:63, pages/admin/bookings/index.tsx:111, pages/admin/funding/[id].tsx:57, pages/admin/funding/index.tsx:109, pages/admin/subscriptions/[id].tsx:55, pages/admin/subscriptions/index.tsx, pages/admin/shows/[id].tsx:69
// data/privacyPolicy.ts:418 — 고지 범위도 위 열거와 같다
```

왜 문제인가: 관리자 화면 열람 중 기록되는 것은 `contract_view` 하나뿐이다. 고객 이름·연락처·이메일·배송지를 한 건 단위로 여는 상세 SSR 화면 4곳(bookings/[id], funding/[id], subscriptions/[id], shows/[id])이 `recordAdminPrivacyAccess` 호출 없이 props로 싣는다. 특히 shows/[id]는 구매자 이름·연락처 전체(`AdminOrderRow.buyerName/buyerContact`)를 싣는데 같은 데이터의 CSV(roster.ts)는 `show_roster_export`로 남는다. 개설자 배송 화면은 '화면도 파일과 같은 양이라 같은 action으로 남긴다'(accessLog.ts:45-53)고 하면서 관리자 쪽은 맞지 않는다. 또 19항 첫 문장 '개인정보가 담긴 목록을 파일로 내려받거나 화면으로 여는 일'은 읽기에 따라 관리자 목록 화면까지 기록하는 것처럼 읽힌다.

조건과 결과: 관리자 계정 오남용·탈취 때 어느 고객 정보가 열렸는지 재구성할 수 없다. 공유 비밀번호 환경이면 수행자도 'admin'뿐이다.

**수정**:
- 상세 화면 4곳만 대상으로 한다(목록 화면은 `contract_view` 도입 때의 결정 — 한 줄마다 기록하면 노이즈 — 과 같은 이유로 제외).
- `db/schema.ts` enum에 `order_detail_view`(주문 id)·`subscription_detail_view`·`funding_pledge_view`·`show_orders_view`(회차 id)를 더한다(DB CHECK 없음, 마이그레이션 불필요).
- 각 `getServerSideProps`에서 인증 직후 `contract_view`와 같은 모양으로 `recordAdminPrivacyAccess(...).catch(...)`.
- `pages/admin/privacy-logs.tsx`의 라벨·필터와 처리방침 19항 열거를 같은 커밋에서 맞추고, 목록 화면은 기록하지 않는다는 사실이 19항에 명확하도록 '목록을 화면으로 여는 일' 문구도 바로잡는다. ko 처리방침이 바뀌므로 `FUNDING_TERMS_VERSION` 올림 + `UPDATE_FUNDING_TERMS_BASELINE=1`.
- 5분 중복 억제는 두지 않는다(운영자 한 명이 상세를 여는 빈도에서 불필요).

비고: 검증자가 바로잡음 — 원안의 '목록 화면은 rowCount와 함께 기록'은 contract_view 결정과 충돌해 뺐다. 고시 제8조의 적용 범위는 처리자 유형에 따라 달라 의무 여부는 불확실하며, 19항이 현재 범위를 정직하게 고지하므로 위반이라기보다 고지와 자체 기준의 정합 문제다.

#### PRV-7. 아티스트 구독 신청의 명단 공개 동의가 기본 체크다 [P2 · S]
`components/artists/ArtistSupportCallout.tsx:67`, `:179` · `lib/artistSupport/signup.ts:58-59` · `lib/artistSupport/supporters.ts:41` · `components/artists/ArtistSupportCallout.test.tsx:87`

지금 코드:
```ts
// components/artists/ArtistSupportCallout.tsx:67
const [displayConsent, setDisplayConsent] = useState(true);
// :179 <Checkbox checked={displayConsent} ... />
// lib/artistSupport/signup.ts:58-59
const displayConsent = b.displayConsent === true;
const displayName = str(b.displayName) || customerName;
// lib/artistSupport/supporters.ts:41
displayName: r.displayName || r.customerName,
```

왜 문제인가: 선택 항목인 명단 공개 동의가 `useState(true)`로 미리 체크돼 있다. 같은 성격의 펀딩 `PledgeWizard.tsx:161`은 `displayNamePublic: false`가 기본이다. 서버는 표시 이름이 비면 `customerName`으로 대체한다. 선택 동의를 미리 체크해 두면 능동적 동의로 보기 어렵다.

조건과 결과: `NEXT_PUBLIC_ARTIST_SUPPORT_OPEN`을 켜는 날부터, 체크를 풀지 않고 표시 이름을 비운 후원자의 실명이 아티스트 페이지 명단에 올라간다(안내 문구는 있다). 지금은 플래그 미설정(`open.ts` 기본 닫힘)이라 잠복 — 운영 env 값은 확인하지 못했다.

**수정**:
1. `useState(false)`로 바꾼다.
2. 서버의 '비어 있으면 customerName 대체'와 400 추가는 하지 않는다 — 폼이 이미 '비우면 이름을 씁니다. 명단 공개에 동의한 경우에만 보입니다.'(common.json:3344)라고 알리고 `support.test.ts:74`가 그 대체를 기대한다. 기본 해제만 하면 사용자가 직접 체크하고 이름을 비웠을 때의 실명 표시는 안내받은 선택의 결과다.
3. `ArtistSupportCallout.test.tsx:87`의 기본 제출 단언을 `displayConsent: false`로 고치고 '체크해야 true' 케이스를 추가한다(안 고치면 깨진다).
4. 선택: `displayConsent`가 false면 `displayName`을 null로 저장해 불필요한 이름 보관을 없앤다(필수는 아님 — 구독 종료 때 18항 ⑥이 이미 지운다).

비고: 한 줄 수정이며 플래그를 켜기 전에 반드시 필요하다. 같은 자리를 다른 축(BIL 정기결제·구독·아티스트 후원)도 지적: 구독자 명단 공개 동의가 기본 체크이고 표시 이름을 비우면 실명이 올라간다 — 펀딩 명단의 기본 해제·가린 이름 규칙과 어긋난다 / 후원자 명단: 운영자가 내릴 방법이 없고, 동의 체크박스가 기본 체크 상태다.

#### PRV-8. 새 표·컬럼이 PII인지 판정하지 않고 들어와도 CI가 모른다 — 공연 show_orders.buyer_name/buyer_contact가 5년 파기에서 빠진 채 처리방침 18항과 어긋나 있다 [P2 · M]
`lib/privacy/orderRetention.ts:232-242` · `db/schema.ts:1681-1682` · `lib/shows/service.ts:112` · `lib/funding/retention.ts` · `lib/contracts/retention.ts` · `lib/funding/payoutPlaintextColumns.test.ts`

지금 코드:
```
// 현재 가드: hero-font, price-drift, funding-terms 해시, uiPatterns 기준선 등은 있으나
// db/schema.ts 컬럼 ↔ 파기 함수 대조 테스트는 없다 (tests/·lib/privacy/*.test.ts grep 결과)
// 실제로 빠진 예: show_orders.buyer_name/buyer_contact(PRV-4), Google Calendar 사본(DB 밖, PRV-3)
```

왜 문제인가: 파기 정책의 컬럼별 판단이 주석에만 있고 스키마와 파기 경로를 대조하는 테스트가 없다. `getTableColumns`/`getTableConfig`를 쓰는 테스트가 저장소 전체에 0건이고, 유일한 컬럼 가드 `payoutPlaintextColumns.test.ts`는 옛 평문 정산 컬럼 3개만 본다. `package.json` check:* 스크립트와 ci.yml에도 PII 컬럼 검사가 없다. 그래서 공연 표가 추가될 때 buyer_name/buyer_contact가 빠졌다(origin/main에도 수정 없음).

조건과 결과: 새 기능마다 같은 누락이 반복되고 18항 고지가 조용히 낡는다. 현재 공연 주문자의 이름·연락처가 법정 보존 5년 뒤에도 남는다.

**수정** (순서대로):
1. 먼저 실제 누락을 막는다 — PRV-4의 `purgeShowOrderBuyerDataOfPurgedOrders`(NOT NULL이라 삭제가 아니라 표식)와 `orderRetention.test.ts`의 공연 주문 시드→파기→사본까지 덮였는지 검증. 처리방침 18항 문구는 이미 맞게 쓰여 있으므로 코드를 맞춘다.
2. 가드는 이름 정규식이 아니라 **전 컬럼 기준선**으로 만든다. `tests/privacy/piiColumnCoverage.test.ts`가 `getTableColumns`로 모든 표·컬럼을 훑어 `content/pii-columns.baseline.json`의 `'table.column' → { class: 'pii' | 'non-pii', purge: '<함수명>' | 'exempt', reason }` 목록과 대조한다. 목록에 없는 새 컬럼·새 표는 분류 없이는 실패하고, pii인데 purge도 exempt 이유도 없으면 실패한다. 기존 기준선 규칙(올리는 갱신은 이유를 요구)을 따른다.
3. `purge: 함수명` 주장은 `orderRetention.test.ts`의 실DB 통합 테스트가 시드한 값이 실제로 덮이는지로 검증해 선언과 구현이 갈라지지 않게 한다(파기는 drizzle `.set`과 원시 SQL이 섞여 있어 손으로 export하는 `PURGED_COLUMNS` 방식은 갈라질 수 있다).

비고: 검증자가 바로잡음 — 원안의 이름 정규식을 `db/schema.ts`에 실제로 돌려 보니 40개 표·468개 컬럼 중 69개가 걸리는데 'ip'가 subscription_id·description·receipt_url·shipping_*에 오탐하고, 정작 `funding_creators.resident_number_enc`·`contracts.content`·`payments.raw_response`·`billing_keys.raw_response`·`signatures.signature_data`·`privacy_access_logs.actor`를 놓친다. 이름 휴리스틱은 가드가 아니라 거짓 안심을 준다. 같은 자리를 다른 축(DB 스키마·마이그레이션·쿼리)도 지적: 공연 예매자 이름·연락처(show_orders.buyer_*)가 5년 파기에서 빠져 있다.

#### PRV-9. 문의 메일 파기는 사람이 하는 일인데 처리방침 18항은 파기 전체를 '자동'이라 고지하고, 3항의 '지체 없이 파기'를 지킬 기한·절차가 정해져 있지 않다 [P2 · S]
`data/privacyPolicy.ts:133` (3항), `:366-376` (18항 도입부), `:73` (4항 Google LLC 행) · `pages/api/contact/send-email.ts:99-107` · `pages/api/inbound/resend.ts:191-205` · `tests/pages/privacy-policy.test.tsx`

지금 코드:
```ts
// pages/api/contact/send-email.ts:99-107
const emailBody = buildContactEmailBody(sanitized);
const result = await sendEmail({ to: CONTACT_TO, subject: `[Studio NOL] 새 문의 — ${sanitized.name}`, html: ..., text: emailBody, replyTo: sanitized.email });
// data/privacyPolicy.ts:133
문의·상담으로 수집한 개인정보는 상담 완료 후 지체 없이 파기합니다.
// pages/api/inbound/resend.ts:191-205 — hello@ 수신 메일을 FORWARD_TO(운영자 Gmail)로 전달
```

왜 문제인가: 문의 폼 데이터(이름·연락처·이메일·내용)는 DB에 저장되지 않고 `CONTACT_TO`(OPERATOR_EMAIL)로만 가며, hello@ 수신 메일은 `FORWARD_TO`(OPERATOR_INBOX)로 재발송된다. 운영자 받은편지함의 문의 메일을 지우는 코드·크론이 없다(purge-orders/purge-funding/purge-contracts 어디에도 문의 없음). 18항 도입부는 '파기는 사람이 기억해서 하는 것이 아니라 월 1회 자동으로 도는 정리 작업이 수행합니다'라고 일반론으로 고지하는데, 자동 파기 ④가 '문의가 아니라 주문'이라고 범위를 가르면서도 도입부의 '자동' 문장은 문의를 가르지 않아 어긋난다. 4항 수탁자 표에서 Google LLC의 목적은 캘린더 일정 관리뿐이라 메일 수신·보관이 빠져 있다.

조건과 결과: 3항의 파기 약속이 운영 습관에만 걸려 있고, 지켜졌는지 확인하거나 증명할 수 없다. 운영자가 실제로 문의 메일을 지우고 있는지는 코드에 안 보여 판정 불가.

**수정** (약속을 사실에 맞추는 쪽이 단순하다):
1. 운영자가 실제로 지킬 수 있는 기한을 정한다(예: 상담 종료 후 N개월 — 운영자 결정 사항). 정한 기한을 3항에 쓰고 '운영자가 직접 삭제합니다'라고 수단을 밝힌다.
2. 18항 도입부를 '시스템에 저장된 개인정보의 파기는 자동 정리 작업이 수행하며, 문의 메일은 운영자가 직접 삭제합니다'로 범위를 좁힌다.
3. 4항 표 Google LLC의 purpose·items에 메일 수신·보관(문의 폼 알림·hello@ 전달 메일)을 더한다.
4. `FUNDING_TERMS_VERSION`을 올리고(-r4) `UPDATE_FUNDING_TERMS_BASELINE=1`로 기준선을 갱신하며, 3항·18항은 7개 로케일에 걸쳐 있어 각 로케일 해당 항과 `tests/pages/privacy-policy.test.tsx`의 로케일 모순 검사를 함께 맞춘다.
5. 문의 메일 삭제 절차(Gmail에서 '문의' 라벨 검색→수동 삭제, 주기)를 `docs/wiki` 운영 지식에 적는다. Gmail 필터는 도착 시점에만 적용되고 Workspace 보관 규칙은 개인 Gmail(hwangtab@gmail.com)에서 쓸 수 없으며, 자동 삭제 스크립트는 만들지 않는다(외부 스케줄러 금지).

비고: 검증자가 바로잡음 — 원안의 'Resend 발송 로그에 무기한'은 코드로 확인되지 않아 뺐고, Gmail 자동 삭제 수단은 실행 불가다.

#### PRV-10. 접속기록 저장 실패가 서버 로그 한 줄로만 남고 운영자에게 알리는 경로가 없다 (fail-open 자체는 설계 결정) [P3 · S]
`lib/privacy/accessLog.ts:94-103` (`:70-79` 설계 주석) · `pages/api/admin/funding/projects/[id]/resident-number.ts:66-77` · `pages/api/admin/funding/projects/[id]/payout-account.ts:61-70` · `lib/payments/refundAccountView.ts` · `lib/privacy/accessLog.integration.test.ts:11`, `:174-188`

지금 코드:
```ts
// lib/privacy/accessLog.ts:81-102
export const recordPrivacyAccess = async (entry): Promise<void> => {
  try { await getDb().insert(privacyAccessLogs).values({...}); } catch (error) {
    console.error('[privacy] 접속기록 저장 실패 — 조회는 계속됩니다', {...});
// pages/api/admin/funding/projects/[id]/resident-number.ts:66-77
const residentNumber = await loadFundingResidentNumber(id);
...
await log('success');
console.warn(`[funding] 주민등록번호 조회 (projectId=${id}, ...`);
return res.status(200).json({ ok: true, residentNumber });
// accessLog.ts:77-78 주석: 기록이 안 남고 있는 상태가 곧 법 위반이므로 침묵이 가장 나쁜 선택
```

왜 문제인가: fail-open은 accessLog.ts 주석('절대 던지지 않는다, 업무를 멈추는 장치가 되면 안 된다')과 통합 테스트·resident-number.ts:50-54 주석으로 고정된 결정이라 유지한다. 남은 문제는 insert 실패가 console.error 한 줄(Vercel 런타임 로그)에만 남고 운영자 알림이 없다는 점이다. 처리방침 19항은 '성공·실패를 가리지 않고 기록한다'고 고지한다. healthCheck에도 접속기록 쓰기 점검이 없다(표 미적용은 `checkMigrationDrift`가 잡고 0024는 이미 적용됨).

조건과 결과: 읽기는 되고 쓰기만 실패하는 날(Turso 쓰기 한도·락 — DB가 죽으면 `loadFundingResidentNumber`가 먼저 던진다)에 고유식별정보 조회가 무기록으로 나가고 아무도 모른다. 발생 조건이 좁다.

**수정**:
1. 값 반환 경로를 fail-closed(503)로 바꾸지 않는다 — 결정 번복이고 정산·원천징수 신고 때 번호 조회를 막는다.
2. catch에서 `buildOperatorAlertHtml({ cron: 'privacy-access-log', … })`로 운영자에게 메일을 보내되, 중복 억제는 DB 기반 `consumeRateLimit`이 아니라 모듈 변수의 마지막 발송 시각(예: 1시간)으로 한다 — 같은 장애로 `rate_limits`도 못 쓴다. 메일 발송 실패는 삼킨다.
3. 테스트: `accessLog.integration.test.ts`의 'DB 장애' 케이스에 `sendEmail` 호출 단언 추가.

비고: 검증자가 바로잡음 — 원안의 fail-closed와 rate-limit 키 기반 억제는 채택하지 않는다.

#### PRV-11. 예약·믹싱 동의 줄에 처리방침 링크가 없고, '서버 검증과 기록은 그대로다' 주석이 없는 기록을 말한다 [P3 · M]
`components/booking/BookingWizard.tsx:686-703` (`:349`, `:403`) · `components/booking/MixingOrderWizard.tsx:201`, `:248` · `components/shows/ShowBookingForm.tsx:154`, `:195`, `:387` · `lib/shows/CLAUDE.md:48` · `lib/booking/validation.ts:119` · `lib/shows/validation.ts:89` · `lib/shows/i18n.ts:108-109` · `db/schema.ts:292-322`

지금 코드:
```ts
// lib/booking/validation.ts:119
if (b.refundPolicyAgreed !== true) return { ok: false, message: '환불 규정에 동의해 주세요.' };
// components/booking/BookingWizard.tsx:349 (그리고 :403), MixingOrderWizard.tsx:201/248, components/shows/ShowBookingForm.tsx:195
refundPolicyAgreed: true,
// lib/shows/validation.ts:89
if (b.refundPolicyAgreed !== true) return { ok: false, message: m.agree };
// db/schema.ts:292-322 orders — terms_version/terms_agreed_at 류 컬럼 없음(펀딩 funding_pledges.terms_version만 있음)
```

왜 문제인가: `refundPolicyAgreed`는 클라이언트가 항상 리터럴 true로 보내므로 서버 검증은 증거가 아니고, orders에 판본·시각 기록도 없다. 동의를 버튼 클릭으로 받는 것은 운영자 결정이고('동의 최소화, UX 최우선' 2026-10-03, BookingWizard.tsx:689-701 주석) 환불 조건은 전자상거래법 제13조의 고지 의무이지 동의 증거 의무가 아니다. 거래기록 5년 보존은 orders 행과 createdAt이 이미 충족한다. 실제로 정리할 것은 둘이다: BookingWizard·MixingOrderWizard는 동의 줄에 처리방침 링크가 없고(ShowBookingForm은 `lib/shows/i18n.ts:108-109`로 링크한다), `lib/shows/CLAUDE.md:48`과 `ShowBookingForm.tsx:387`의 '서버 검증과 기록은 그대로다'가 저장되는 기록이 없는데 있는 것처럼 읽힌다.

조건과 결과: 증거 부재가 실제 분쟁에서 문제가 된 사례는 없다. 고지 위치의 불일치와 오해를 부르는 주석이 남는다.

**수정**:
1. BookingWizard·MixingOrderWizard의 동의 줄을 ShowBookingForm과 같은 형태('결제하기를 누르면 취소·환불 규정과 개인정보 처리방침…', 링크 `/ko/privacy-policy`)로 맞춘다. 체크박스는 늘리지 않는다.
2. `lib/shows/CLAUDE.md`와 ShowBookingForm 주석의 '기록은 그대로다'를 '서버는 true인지만 확인하고 동의 판본·시각은 저장하지 않는다'로 바로잡는다.
3. `order_agreements` 표는 분쟁 방어 요구가 실제로 생길 때까지 보류한다. 만들게 되면 별도 표 방식은 그대로 맞다(orders에 컬럼을 더하지 않는다).

비고: 검증자가 바로잡음 — 원안의 order_agreements 표 + 판본 해시 게이트 + 서버 3경로 배선은 증거에 비해 비용이 크고 '이미 있는 것으로는 왜 안 되는가'에 걸린다.

#### PRV-12. 후기 요청 메일에 거부 의사를 남기는 수단이 없다 [P3 · M]
`lib/reviews/reviewRequests.ts:165-178` (`:25`, `:94`) · `pages/api/cron/review-requests.ts`

지금 코드:
```ts
// lib/reviews/reviewRequests.ts:25
export const REVIEW_REQUEST_ELIGIBLE_FROM = new Date('2026-09-27T00:00:00+09:00');
// :94 (대상 쿼리)
gte(orders.createdAt, REVIEW_REQUEST_ELIGIBLE_FROM),
// :165-178 본문 — 답장 안내만 있고 '더 이상 받지 않기' 링크·기록 없음
'이 안내는 이번 예약·주문에 대해 한 번만 보내드립니다.'
// components/booking/BookingWizard.tsx, MixingOrderWizard.tsx — '후기'·'처리방침' 문자열 0건
```

왜 문제인가: 메일에 '더 받지 않기' 수단이 없고 답장으로 거부해도 기록되지 않는다. 날짜 게이트는 CLAUDE.md '후기 요청 메일' 절의 운영자 설계('이 날짜를 앞당기지 말 것')라 바꾸지 않는다. 운영자가 광고성 정보가 아니라고 판단했으므로(2026-09-27) 정보통신망법상 수신 거부 수단 의무가 걸리지 않고 링크가 필수가 아니다. 주문 1건당 1통, 같은 이메일은 180일 쿨다운(`REVIEW_REQUEST_PER_EMAIL_COOLDOWN_MS`)이다. 개인정보보호법상 목적 외 이용 시비는 법률 검토 영역이라 불확실.

조건과 결과: 답장으로 거부한 사람에게 180일 뒤 새 주문이 있으면 다시 간다. 낮음.

**수정**: 가장 작은 수단부터 — 거부 요청이 오면 운영자가 그 이메일을 제외 목록에 넣는 경로(`review_requests`에 sentinel 행 또는 소형 `review_optouts` 표)를 만들고 `findReviewCandidates`가 제외하게 한다. 서명 링크 방식(`lib/press/token.ts` 류)은 거부가 실제로 반복될 때 추가한다. 날짜 조건을 `order_agreements`로 바꾸는 안은 채택하지 않는다(PRV-11에서 그 표가 보류됐다).

비고: 검증자가 바로잡음 — 서명 토큰 수신 거부와 review_optouts 표는 이 규모에 비해 크다는 판단과 함께 가장 작은 수단만 남겼다.

#### PRV-13. 계약 백업 JSON이 파기 뒤 최대 28일 남는데 처리방침 18항에 언급이 없다 [P3 · S]
`data/privacyPolicy.ts:366-380` · `lib/contracts/backup.ts:11`, `:36-38`, `:59-63`, `:111-120` · `vercel.json` (backup 일요일 17:00 UTC, purge-contracts 매월 1일 18:00 UTC) · `pages/api/cron/purge-contracts.ts` · `lib/contracts/retention.ts`

지금 코드:
```ts
// lib/contracts/backup.ts:11
const BACKUP_RETENTION_DAYS = 28;
// :36-38
const all = await getDb().query.contracts.findMany({ with: { signatures: true, contractClauses: true, contractAttachments: true } });
// :59-63
await put(`${BACKUP_PREFIX}${stamp}.json`, JSON.stringify({ exportedAt: now.toISOString(), contracts: sanitized }, null, 2), { access: 'private', ... })
// :48-51 주석: 그 파일들에는 이름·연락처·주소·계약 본문이 평문으로 들어 있어
// data/privacyPolicy.ts — '백업' 문자열 0건
```

왜 문제인가: 매주 모든 계약을 signatures·clauses·attachments까지 평문 JSON으로 private Blob에 올리고 28일 뒤 지운다. purge-contracts가 매월 1일이므로 파기 직전 백업이 파기 뒤 최대 28일 남는다. 18항은 '요건을 갖춘 날로부터 늦어도 한 달 안에 지워집니다'이고 백업 존재와 보관 기간이 어디에도 고지돼 있지 않다. backup.ts:6-9 주석이 위험을 스스로 인정한다.

조건과 결과: 고지한 파기 기한과 실제 사이에 28일 차이. private Blob이라 즉시 유출 위험은 낮다.

**수정**: 백업 JSON 재작성 기능은 만들지 않는다(쓰기 실패 시 백업 자체를 망가뜨릴 위험, 이득은 28일 창 하나). 18항 '그 밖의 파기' 항목에 '계약 데이터는 매주 백업해 28일 뒤 지우며, 그 사이에는 파기한 계약의 정보가 백업에 남을 수 있습니다'를 추가하고 본문의 '한 달 안에'를 사실에 맞게 조정한다. `FUNDING_TERMS_VERSION` 올림 + 기준선 갱신. 여력이 있으면 `BACKUP_RETENTION_DAYS`를 14로 줄여 창을 절반으로 한다. 계약 기한 문구는 두 곳(18항 ⑫, `contract-template.md` 제12조 ④ '계약 종료 후 3년간 보관한 뒤 파기')인데 제12조는 이미 서명된 계약에 소급할 수 없으므로 처리방침 쪽만 고친다.

비고: Turso 자체 복구(PITR) 보존기간은 확인하지 못한 불확실 항목이다.

#### PRV-14. 파기 크론이 아예 실행되지 않은 경우를 잡는 장치가 없다 (실패 경로는 이미 메일이 간다) [P3 · M]
`pages/api/cron/purge-orders.ts:48-52` (`:143-162`, `:154-176`) · `pages/api/cron/purge-funding.ts:110-115` · `pages/api/cron/purge-contracts.ts` · `lib/cron/auth.ts:25-28` · `lib/ops/healthCheck.ts:291-330` · `vercel.json`

지금 코드:
```ts
// pages/api/cron/purge-orders.ts:51-53
if (!isCronAuthorized(req, 'cron/purge-orders')) { return res.status(401).json({ ok: false, message: 'Unauthorized' }); }
// lib/cron/auth.ts:25-28
if (!secret) { console.error(`[${label}] CRON_SECRET is not set — 요청을 거부한다.`); return false; }
// 성공 응답은 건수를 body로만 돌려줄 뿐 DB에 남기지 않는다 (purge-orders.ts:143-162, purge-funding.ts:110-115)
// lib/ops/healthCheck.ts — 'purge'·'retention' 관련 점검은 방치 구독 경보와 계약 위생(:291-330) 외에 '기한 지난 행 잔존' 점검이 없다
```

왜 문제인가: 파기 실패는 세 크론 모두 failures를 모아 운영자에게 메일을 보내므로 알림이 있다. 없는 것은 vercel.json에서 크론이 빠지거나 경로가 바뀌어 실행 자체가 안 되는 경우를 잡는 장치와, 성공한 실행의 증적(응답 body뿐)이다. health-check 크론도 같은 `CRON_SECRET`을 쓰므로(health-check.ts:23) 비밀 누락 점검은 순환이고, 같은 비밀을 쓰는 billing-charge(매일 고객 청구)가 함께 멈춰 사업상 바로 드러난다.

조건과 결과: 낮음. 첫 파기 대상 시점이 멀다(주문 5년, 계약 종료 후 3년, 접속기록 2년 — 대부분 2028년 이후, 1년 기준 항목은 더 가깝다).

**수정**:
1. 표 없이 CI 테스트 하나로 시작한다 — `vercel.json`의 crons 경로가 `pages/api/cron/*.ts` 파일과 1:1이고 purge-contracts·purge-funding·purge-orders가 모두 있는지 단언.
2. 증적이 필요해지면 `purge_runs`(별도 표, 건수만)를 더한다 — 지금은 과설계.
3. `CRON_SECRET` env 점검은 넣지 않는다.

비고: 검증자가 바로잡음 — 원안의 '파기 실패도 알림 없음'은 틀렸고 '크론이 아예 안 돈 경우'로 좁혔다. 표준 개인정보 보호지침의 파기 결과 확인은 권고이고 처리방침이 약속한 것은 월 1회 자동 파기이지 증적 표가 아니다.

#### PRV-15. en 처리방침 3·4항의 '예약·결제는 한국어 페이지에서만'이 /en/shows 영어 예매와 어긋난다 [P3 · M]
`data/privacyPolicy.ts:473-480` (`:462`, `:466`, `:478`) · `tests/pages/privacy-policy.test.tsx:65-67` · `components/shows/ShowBookingForm.tsx:392-393` · `lib/shows/i18n.ts:20`

지금 코드:
```ts
// data/privacyPolicy.ts:462 (en)
lastUpdatedValue: 'September 26, 2026',   // ko는 '2026년 10월 4일'
// :466
body: 'Through the inquiry form, we may collect your name, phone number, email address, and message content.',
// :478
'... Bookings and payments (offered on our Korean pages only) additionally involve Turso ..., Google LLC ... and Toss Payments ...'
// lib/shows/CLAUDE.md — 공연은 2026-10-07부터 /en/shows에서 결제까지 연다; ShowBookingForm.tsx:393 은 처리방침을 /ko 로 링크
```

왜 문제인가: en 처리방침은 11개 항·2026-09-26판이고 ko는 20개 항·2026-10-04판이다. 비-ko 방침을 축약판으로 둔 것은 의도(privacy-policy.test.tsx:65-67 '펀딩은 ko 전용이라 절 전체를 번역하지 않는다')이고, 틀어진 것은 전제 하나 — 2026-10-07부터 `/en/shows`에서 이름·연락처·이메일과 계좌 입금 환불 계좌를 받는다. 영향 로케일은 en뿐이다(zh·es·vi·th·uz는 `fallbackShowLocale`로 /en/shows로 보내진다). 영어 폼은 한국어 처리방침을 '(Korean)'으로 연결하고 정본이 한국어라고 주석한다.

조건과 결과: 영어 이용자가 읽는 방침의 수집·위탁 설명이 부정확하다. 한국어 정본 링크는 있어 영향은 작다.

**수정**: en 1·3·4항만 고친다. (a) 1항에 공연 예매의 수집 항목(이름, 연락처, 이메일, 계좌 입금 시 환불 계좌)을 더하고, (b) 3·4항의 'offered on our Korean pages only'를 '세션·믹싱 예약은 한국어 페이지, 공연 예매는 한국어·영어 페이지'로 바로잡는다. (c) 테스트: `tests/pages/privacy-policy.test.tsx`에 en 1·4항이 'ticket' 계열 단어를 포함하는지 단언. 비-ko 날짜 동기화 테스트와 zh·es·vi·th·uz 수정은 하지 않는다. en은 ko 해시(`FUNDING_TERMS_VERSION`) 대상이 아니다.

비고: 검증자가 바로잡음 — '다섯 로케일도 같은 구판' 부분은 이 사안과 무관하고, '모든 로케일 날짜가 ko와 같거나 허용 목록' 테스트는 매 ko 개정마다 7개 날짜를 맞추게 해 유지 부담이 크다.

#### PRV-16. ko 처리방침 1·2·4항에 정기결제의 수집 항목·목적·토스 위탁 업무가 열거돼 있지 않다 [P3 · M]
`data/privacyPolicy.ts:104-143` (1·2항), `:70-78` (SERVICE_DATA_PROCESSORS 토스 행), `:372-390` (18항) · `lib/artistSupport/supporters.ts:60-66` · `pages/api/admin/artists/[slug]/supporters-export.ts:12` · `content/fundingTerms.baseline.test.ts`

지금 코드:
```
// grep '정기결제|구독|빌링' data/privacyPolicy.ts → 18항(파기)·20항(측정 제외)에만 등장, 1·2·4항 0건
// SERVICE_DATA_PROCESSORS 토스페이먼츠: purpose '예약 결제 승인·취소·환불 처리'
// lib/artistSupport/supporters.ts:60-66
* 소식 메일 발송용 — 관리자가 CSV로 내려받아 운영자가 직접 보낸다
// pages/api/admin/artists/[slug]/supporters-export.ts:12
* 아티스트별 후원자 연락처 CSV — 월 소식 메일을 운영자가 직접 보낼 때 쓴다
```

왜 문제인가: 정기결제(연습실·레슨·아티스트 후원) 구독은 라이브다(billing-charge 크론 vercel.json:31, `pages/[locale]/subscribe`, billing_keys 표). 저장 항목(빌링키, 카드사, 마스킹 카드번호, 해지 사유, 명단 표시 이름)과 목적(매월 자동 청구·실패 안내, 아티스트 구독의 월 소식 메일), 토스의 빌링 업무가 1·2·4항에 없다. 18항 ⑤~⑨⑬이 그 존재와 파기를 이미 밝히므로 '완전 미고지'가 아니라 열거 누락이다. 아티스트 소식 메일은 후원 혜택 그 자체(docs/superpowers/specs/2026-09-08-artist-support-design.md:76)라 계약 이행이고, `NEXT_PUBLIC_ARTIST_SUPPORT_OPEN` 미설정이라 잠복이다(운영 env 값은 확인하지 못했다).

조건과 결과: 제30조①1·2호 항목·목적 열거 누락. 18항이 사실상 보충하므로 정보 은닉은 아니다.

**수정**: ko 1항에 정기결제 수집 항목, 2항에 '정기 청구·실패 안내와 아티스트 구독 혜택인 월 소식 메일'을, 4항 토스 행(`SERVICE_DATA_PROCESSORS`)의 업무를 '예약·구독 결제 승인·정기결제 카드 등록·청구·취소·환불'로 고친다. 소식 메일에 선택 동의·수신 거부 링크는 붙이지 않는다. `FUNDING_TERMS_VERSION` 올림 + 기준선 갱신 + 변경 조항을 커밋에 기록.

비고: 검증자가 바로잡음 — 원안의 '동의 근거 없음, 선택 체크·수신 거부 링크 추가'는 맞지 않고, P2→P3.

#### PRV-17. 로그인 링크만 요청하고 한 번도 로그인하지 않은 개설자 계정이 영구히 남는다 [P3 · S]
`lib/funding/creatorToken.ts:62-76` (`:43-44` 주석) · `pages/api/funding/creator/login.ts:55-66`, `:122-129` · `pages/api/cron/purge-funding.ts` · `lib/funding/retention.ts` · `db/schema.ts:730-800`, `:813`, `:833` · `data/privacyPolicy.ts` 13·14항

지금 코드:
```ts
// lib/funding/creatorToken.ts:65-67
await db.insert(fundingCreators)
  .values({ email: normalized, name: normalized.split('@')[0] })
  .onConflictDoNothing({ target: fundingCreators.email });
// 주석 :43-44 (아무나 행을 만들 수 있지만 행 하나가 전부이고 ...)
// data/privacyPolicy.ts:14항 — '기간이 지나면 자동으로 지우는 절차는 두고 있지 않습니다'
// 저장소 전체: fundingCreators를 DELETE 하는 비테스트 코드 0건
```

왜 문제인가: 메일 소유 확인 전에 타인 이메일로 개설자 행이 만들어지고, 링크를 열지 않으면 `last_login_at`이 NULL인 채 남는다. 비테스트 코드에 `delete(fundingCreators)`는 없고 파기 크론 어디에도 대상이 아니다. 처리방침 13항이 '링크를 한 번 요청한 것만으로 계정이 생긴다', 14항이 '자동으로 지우는 절차는 두고 있지 않다'고 이미 고지하므로 결정된 설계이고 은닉은 아니다. 미가입 주소는 전역 20건/일·IP당 5건/시간으로 누적 속도가 제한된다.

조건과 결과: 낮음. 이메일과 이메일 앞부분 이름만 쌓인다.

**수정**: `purge-funding` 크론에 독립 `run()` 항목으로 `purgeUnclaimedCreators(now)`를 더한다:
```sql
DELETE FROM funding_creators
WHERE last_login_at IS NULL AND created_at < now-30d
  AND NOT EXISTS (SELECT 1 FROM funding_projects p WHERE p.creator_id = funding_creators.id)
```
(`funding_creator_tokens`는 onDelete cascade, `funding_projects.creator_id`는 FK — 스키마와 맞다.) 같은 커밋에서 처리방침 13·14항에 '로그인하지 않은 계정은 30일 뒤 삭제'를 적고 `FUNDING_TERMS_VERSION`을 올려 기준선을 갱신한다(14항의 '자동 삭제 절차 없음'이 틀리게 되므로 필수). 계정 생성 시점을 링크 클릭으로 옮기는 설계 변경은 하지 않는다 — 토큰 행이 creator FK를 요구하고 가입 캡 설계가 행 생성에 걸려 있다.

비고: 검증자가 바로잡음 — P2→P3.

#### PRV-18. 필드 암호문이 행 문맥(AAD)에 묶이지 않아, DB 쓰기 권한만 가진 공격자가 환불 계좌 암호문을 다른 주문 행으로 옮길 수 있다(심층 방어 공백) [P3 · M]
`lib/crypto/fieldCrypto.ts:204-244` (`:209-211`, `:243-244`) · `lib/payments/refundAccount.ts:56`, `:95-107`, `:143` · `lib/funding/payoutAccountCrypto.ts:50`, `:56` · `lib/funding/residentNumber.ts:31` · `lib/funding/creatorProjectWrite.ts:554` · `lib/funding/payout.ts:454` · `lib/ops/healthCheck.ts:148` · `lib/crypto/fieldKeyRotation.ts:207` · `scripts/rotate-field-key.mjs` · `db/schema.ts:813`

지금 코드:
```ts
// lib/crypto/fieldCrypto.ts:209-211
const cipher = createCipheriv('aes-256-gcm', key, iv);
const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
const tag = cipher.getAuthTag();
// decrypt: decipher.setAuthTag(tag) 만 있고 setAAD 없음 (:253-256)
```

왜 문제인가: GCM에 AAD가 없어 같은 키로 잠긴 암호문은 어느 행·컬럼에 붙여도 열린다(저장소 전체에서 AAD 언급 0건). 실제로 이득이 되는 경로는 `refund_accounts`뿐이다 — 후원자가 계좌를 적은 뒤 공격자가 Turso 쓰기 권한으로 자기 계좌 암호문 + 평문 `bank_name`/`account_holder`를 그 행에 덮어쓰면 운영자가 공격자에게 송금한다. 개설자 정산 계좌는 `funding_projects.creator_id`(평범한 FK) 재지정만으로 같은 결과가 나므로 AAD가 막지 못한다(운영자는 payout-account 화면에서 복호화한 계좌로 수동 이체). 컬럼 간 교체(주민번호↔정산 계좌)는 `decryptPayoutAccount`의 JSON 봉투 검증이 malformed로 거부해 서비스 거부에 그친다.

조건과 결과: Turso 쓰기 토큰만 유출되고 `FUNDING_FIELD_KEY`는 안 유출된 경우에 한해 환불 송금처를 공격자 계좌로 돌릴 수 있다. 둘 다 Vercel env/운영자 도구에서 나오므로 같은 신뢰 영역일 가능성이 크다(두 비밀의 실제 분리 여부는 코드로 확인 불가).

**수정**: 지금은 코드 변경 없이 `lib/crypto/CLAUDE.md`에 위협모델 한 문단을 적는다('DB 쓰기만 가진 공격자는 같은 키의 암호문을 행 사이에 옮길 수 있고, 정산 계좌는 creator_id FK 재지정으로도 우회되므로 AAD 대상이 아니다'). 도입한다면 다음 키 회전과 묶어 한 번에 하고 범위를 환불 계좌로 좁힌다. 문맥은 행 id가 아니라 자연키 `refund_accounts.account_number_enc:${kind}:${orderNo}`를 쓴다 — `saveRefundAccount`는 행 id를 INSERT SQL 안의 randomblob으로 만들고 암호화는 그 전에 호출부(cancel.ts:145, refund.ts:164)에서 끝나므로 행 id는 쓸 수 없다. `encryptRefundAccountNumber`에 (kind, orderNo)를 받게 하고 `loadRefundAccount`가 같은 키로 복호화하며, 회전 엔진은 refund_accounts 타깃에 order_kind·order_no 컬럼을 함께 읽게 한다. 정산 계좌·주민번호에는 AAD를 넣지 않는다. v1·v2 읽기는 유지한다.

비고: 검증자가 바로잡음 — 호출부는 '5곳'이 아니라 암호화 4 + 복호화 5 이상 + 회전 엔진이고, 판본 v3 + 전면 변경 + 전 행 재암호화는 돈·PII 경로의 고위험 작업이라 P2→P3. 같은 자리를 다른 축(SEC 인증·권한·입력 검증·헤더)도 지적: AES-GCM에 AAD(행·컬럼 바인딩)가 없다.

#### PRV-19. 접속기록 월 1회 점검(고시 제8조②)을 돕는 장치가 없고 화면은 최신 200건뿐이다 [P3 · S]
`pages/admin/privacy-logs.tsx:91-99` · `lib/privacy/accessLogQuery.ts` · `lib/ops/healthCheck.ts` · `pages/api/cron/health-check.ts` · `pages/api/cron/purge-funding.ts` · `lib/email/operatorAlert.ts:39`

지금 코드:
```ts
// pages/admin/privacy-logs.tsx:95-97
const [rows, actors] = await Promise.all([ listPrivacyAccessLogs({ actor: actorFilter, action: actionFilter }), listPrivacyAccessActors() ]);
// lib/ops/healthCheck.ts — privacy_access_logs를 읽는 점검 없음
```

왜 문제인가: 화면은 최신 200건 조회와 수행자·행위 필터만 있고 기간 필터·페이지 이동이 없다. healthCheck·health-check 크론에 privacy_access_logs를 읽는 점검이 없다. 처리방침과 코드 어디에도 월 1회 점검을 약속한 문장은 없다(accessLog.ts는 제8조① 보관 2년만 인용) — 법적 약속이 깨진 것이 아니라 고시 제8조② 이행 보조 장치가 없는 것이다. 메일 수신은 열람을 증명하지 못하고, health-check 크론은 '이상 없으면 메일을 보내지 않는다'는 원칙을 명시한다(`HealthIssue.severity`는 high|medium뿐, `tone:'info'`는 `buildOperatorAlertHtml`에 있다).

조건과 결과: 점검을 사람이 기억에 의존해 하게 되고, 월 기록이 200건을 넘으면 화면만으로는 점검이 불가능하다. 현재 규모에서는 발현 가능성이 낮다.

**수정**: 이미 매월 2일에 도는 `purge-funding` 크론(접속기록 파기도 거기서 한다)에 지난 30일 요약 메일을 덧붙인다 — 행위별 건수, decrypt_failed·error 건수, rowCount 상위 3건. 메일에 '점검 후 docs/oplog에 한 줄 기록' 안내와 접속기록 화면 딥링크를 싣는다. 증적은 메일 수신이 아니라 운영자의 점검 기록이다. 일일 health-check에는 이상 신호(decrypt_failed 연속 등)만 medium으로 얹어 '이상 없으면 무음' 원칙을 지킨다. `pages/admin/privacy-logs.tsx`에 from/to 기간 필터를 더한다. 새 테이블·마이그레이션은 만들지 않는다.

비고: 검증자가 바로잡음 — '메일을 받으면 점검 증적'이라는 원안의 근거는 약하다.

#### PRV-20. 새 암호화 컬럼이 회전 대상 목록에서 빠져도 알 수 없다 — *_enc 전수 가드 테스트가 없다 [P3 · S]
`lib/crypto/fieldKeyRotation.ts:67-87` · `db/schema.ts:681`, `:762`, `:788` · `lib/crypto/fieldKeyRotation.integration.test.ts:108` · `lib/crypto/CLAUDE.md`

지금 코드:
```ts
// lib/crypto/fieldKeyRotation.ts:67-87
export const ENCRYPTED_FIELD_TARGETS = [ defineTarget({ label: 'funding_creators.resident_number_enc', ...}), defineTarget({ label: 'funding_creators.payout_account_enc', ...}), defineTarget({ label: 'refund_accounts.account_number_enc', ...}) ];
// lib/crypto/CLAUDE.md: 목록에 없는 컬럼은 회전되지 않고, 그 사실은 옛 키를 지운 뒤에야 드러난다.
```

왜 문제인가: '컬럼을 늘리면 목록에 한 줄 더한다'는 규칙이 문서에만 있다. 기존 테스트 가드는 전부 이 목록을 기준으로 한다 — `fieldKeyRotation.integration.test.ts:108`은 targets 라벨과 SEEDERS 키를 맞대 보고(둘 다 목록 쪽에서 파생), `healthCheck.rotation.test.ts`는 목록을 돈다. `db/schema.ts`를 훑어 *_enc 컬럼과 대조하는 테스트는 없다. 현재 `text('..._enc')` 컬럼은 세 개로 목록과 정확히 일치한다.

조건과 결과: 미래에 암호화 컬럼을 추가하면서 목록을 빠뜨리면 회전·health-check 모두 못 보고, 옛 키를 지운 뒤에야 복구 불가능한 손실로 드러난다.

**수정**: `lib/crypto/fieldKeyRotation.test.ts`(또는 collision 테스트 옆)에 `getTableColumns`로 `db/schema.ts`의 모든 SQLiteTable export를 돌아 이름이 `/_enc$/`인 컬럼 집합이 `ENCRYPTED_FIELD_TARGETS`의 (table, column) 집합과 정확히 같음을 단언한다. 라벨은 `'<테이블>.<DB 컬럼명>'` 형식으로 맞춘다. 이름 규약 기반 가드이므로 `_enc` 접미사를 쓰지 않는 컬럼은 못 잡는다는 점만 주석에 적는다.

비고: 검증자 확인(confirmed). 제안 테스트는 지금 통과한다.

#### PRV-21. 방침의 '요청 제한 창 길어도 한 시간'이 개설자 로그인 이메일 해시 키(24시간)와 어긋난다 [P3 · S]
`data/privacyPolicy.ts:331` (16항), `:391` (18항) · `pages/api/funding/creator/login.ts:27`, `:66-70`, `:107` · `lib/booking/rate-limit.ts` · `lib/payments/depositGuideThrottle.ts`

지금 코드:
```ts
// pages/api/funding/creator/login.ts:66-70
const emailRateLimitKey = (email: string): string => `creator_login:email:${createHash('sha256').update(email).digest('hex').slice(0, 16)}`;
const emailDailyRateLimitKey = ... `creator_login:email_daily:${...}`   // DAY_SECONDS = 86_400 (:27, :107)
// data/privacyPolicy.ts:330-332 — '요청 제한 창(길어도 한 시간)이 지난 기록은 다음 요청이 들어올 때 함께 지웁니다'
```

왜 문제인가: `creator_login:email_daily` 키는 86,400초 창이고 `consumeRateLimit`은 만료 행을 다음 호출 때 lazy 삭제한다. PII가 든 키 중 1시간을 넘는 것은 이 키뿐이다(다른 24시간 키는 `creator_login:global` 등 PII 없는 전역 키, IP 키는 모두 3600초 이하). 같은 '길어도 한 시간' 문구가 16항 331줄과 18항 391줄 두 곳에 있다.

조건과 결과: 방침 고지의 보관 시간이 실제(최대 24시간 + lazy 삭제 지연)와 다르다.

**수정**: 16항과 18항 391줄의 문구를 '길어도 하루'로 같이 고친다. 같은 커밋에서 `FUNDING_TERMS_VERSION`을 올리고 `UPDATE_FUNDING_TERMS_BASELINE=1`로 기준선을 갱신하며 어느 조항이 바뀌었는지 적는다. HMAC 전환은 별건의 선택 사항 — 같은 이메일이 `funding_creators.email`에 평문으로 있고 행 수명이 최대 24시간이라 이득이 작다. 해시를 바꾼다면 `login.ts`와 `depositGuideThrottle.ts`(같은 무염 sha256, 고객 이메일)를 함께 다룬다.

비고: 검증자가 바로잡음 — 원안이 16항만 가리켜 반쪽이었다.

#### PRV-22. 19항 '네 가지 파일' 열거가 공연 명단 CSV를 빠뜨렸고 20항 제외 화면 열거가 공연·예약금 화면을 빠뜨렸다 [P3 · S]
`data/privacyPolicy.ts:419` (19항), 20항 본문 · `db/schema.ts:1435` · `pages/api/admin/shows/[id]/roster.ts:28` · `lib/analytics/privatePaths.ts:35-36`, `:49` · `tests/pages/privacy-policy.test.tsx`

지금 코드:
```ts
// data/privacyPolicy.ts:419 — 파일 네 가지 + 계약서 PDF만 열거
'... 펀딩 주문 목록, 매출장부, 아티스트 후원자 연락처, 개설자가 받아 가는 배송 목록의 네 가지 파일과 계약서 PDF입니다.'
// db/schema.ts:1435 — 코드는 다섯 번째를 이미 기록한다
'show_roster_export',
// lib/analytics/privatePaths.ts:35-36,49 — shows/(success|fail|manage|scan|report), pay 도 측정 제외
// data/privacyPolicy.ts:20항 본문의 제외 화면 목록에는 공연·예약금 링크가 없다
```

왜 문제인가: 내려받기 행위는 `funding_pledge_export`·`sales_ledger_export`·`artist_supporter_export`·`funding_creator_shipping_export`·`show_roster_export` 다섯 개다. `show_roster_export`는 공연 예매 커밋 9c7eedbadf에서 schema에만 들어가고 privacyPolicy.ts는 건드리지 않았다. 418줄의 포괄 문장이 공연 명단도 실질적으로 고지하므로 틀린 것은 '네 가지'라는 개수와 열거뿐이다. 20항은 '안 싣는다'고 적은 화면에 실제로 싣는 곳이 없어 거짓 진술은 아니고 열거가 덜 포괄적일 뿐이다.

조건과 결과: 고지가 코드보다 약간 적게 말한다(방침 감사 시 지적 대상). 이용자에게 불리한 방향은 아니다.

**수정**: 419줄을 '펀딩 주문 목록, 매출장부, 아티스트 후원자 연락처, 공연 회차 명단, 개설자가 받아 가는 배송 목록의 다섯 가지 파일과 계약서 PDF'로 고친다. 20항 본문에 '공연 결제·내 티켓·입장 확인 화면, 예약금 결제 링크 화면'을 추가한다. 같은 커밋에서 `FUNDING_TERMS_VERSION`을 올리고 기준선을 갱신한다. 재발 방지는 `privacy-policy.test.tsx`에서 `*_export` 행위 개수와 419줄의 파일 개수 표기를 맞대는 정도로 한다.

비고: 검증자가 바로잡음 — 원안의 '라우트 접두사 ↔ 방침 단어 매핑 표' 테스트는 산문 문구에 묶인 취약한 테스트라 뺐다.

#### PRV-23. purge-contracts는 알림 메일 실패를 흔적 없이 삼키고 purge-orders 주석 개수가 낡았다 [P3 · S]
`pages/api/cron/purge-contracts.ts:59`, `:83` · `pages/api/cron/purge-orders.ts:59`, `:184-186` · `pages/api/cron/purge-funding.ts:157-159`

지금 코드:
```ts
// pages/api/cron/purge-contracts.ts:59, :83
}).catch(() => {});
// purge-funding.ts:157-159 / purge-orders.ts:184-186 은 실패를 console.error로 남긴다
// pages/api/cron/purge-orders.ts:59 — '열세 가지는 대상도 ...' (실제 await run( 호출 15개)
// purge-*.ts 어디에도 export const config = { maxDuration } 없음 (backup-contracts.ts:17은 60초)
```

왜 문제인가: purge-contracts의 두 알림 호출이 `.catch(() => {})`로 실패를 삼킨다. purge-funding·purge-orders는 `alert.ok`를 보고 console.error로 남긴다. purge-orders.ts:59 주석의 '열세 가지'는 실제 15개와 다르다. maxDuration은 플랫폼 설정(Fluid 여부)에 달려 코드에서 확정할 수 없고, 계약 파기 첫 대상은 2029년 이후라 현재 백로그는 0이다.

조건과 결과: 알림 채널(Resend)이 죽은 달에 파기 실패 사실이 로그로도 남지 않는다. 파기 자체는 console.error와 500 응답이 남고 멱등이라 다음 달 재시도된다.

**수정**: purge-contracts.ts 59·83줄을 purge-funding과 같은 3줄 패턴으로 바꾼다 — `.catch((e) => ({ ok: false, errorCode: String(e) }))`로 받고 `!alert.ok`면 console.error. 헬퍼는 만들지 않는다. purge-orders.ts:59 주석은 '여러 가지는'으로 고친다. maxDuration은 첫 파기 대상이 생기는 시점 전에 purge-contracts에만 검토한다.

비고: 검증자가 바로잡음 — 원안의 `notifyOperatorOrLog` 헬퍼는 2줄 반복을 위한 새 추상화라 '단순하게 만들 것'과 어긋난다.

#### PRV-24. PURGED_MARK 상수가 두 곳에 따로 있다 [P3 · S]
`lib/contracts/retention.ts:16` · `lib/privacy/orderRetention.ts:48`, `:63` · `lib/email/resend.ts:55` · `lib/contracts/retention.test.ts` · `lib/funding/retention.ts:5`

지금 코드:
```ts
// lib/contracts/retention.ts:16
const PURGED_MARK = '(개인정보 파기됨)';
// lib/privacy/orderRetention.ts:48
export const PURGED_MARK = '(개인정보 파기됨)';
// isPurgedValue(orderRetention.ts:63)는 계약 이메일 판정에도 쓰인다 (lib/email/resend.ts:55)
```

왜 문제인가: 계약 파기가 쓰는 리터럴과 `isPurgedValue`가 비교하는 리터럴이 서로 다른 선언이다. 일치를 강제하는 테스트도 없다 — `contracts/retention.test.ts`는 리터럴을 직접 비교하고 `orderRetention.test.ts`는 import한 상수를 비교하므로, orderRetention 쪽을 바꾸면 두 테스트가 모두 통과하는 채로 어긋난다.

조건과 결과: 한쪽 문자열만 바뀌면 계약 파기 행이 '파기된 값'으로 인식되지 않아 Resend 422 → `notification_error`가 영구히 남는 사고가 재현된다. 현재 값은 같아 잠복 회귀 위험이다.

**수정**: `lib/contracts/retention.ts`에서 `import { PURGED_MARK } from '../privacy/orderRetention'`로 바꾸고 로컬 선언을 지운다. 순환 import 없음(orderRetention은 contracts를 import하지 않고, contracts/retention.ts는 이미 db/client를 import하며 `funding/retention.ts:5`에 같은 방식 선례가 있다).

비고: 검증자 확인(confirmed). 같은 자리를 다른 축(DB 스키마·마이그레이션·쿼리)도 지적: 계약 보존 기간 계산·파기 표식이 privacy/orderRetention의 것과 따로 복제돼 있다.

#### PRV-25. 고아 PDF 정리가 Blob list 페이지네이션을 처리하지 않는다(백업 정리는 해당 없음) [P3 · S]
`lib/contracts/backup.ts:115` (`:88`) · `lib/funding/mediaRetention.ts:73-100` · `lib/funding/mediaRetention.test.ts`

지금 코드:
```ts
// lib/contracts/backup.ts:88
const { blobs } = await list({ prefix: BACKUP_PREFIX });
// :115
const { blobs } = await list({ prefix: PDF_PREFIX });   // contracts/ 아래 PDF + backup 전부
```

왜 문제인가: `removeOrphanPdfs`의 `list({ prefix: 'contracts/' })`는 cursor/hasMore를 무시한다. @vercel/blob list는 limit 기본 1000이고, 같은 저장소의 `mediaRetention.ts`는 cursor 루프로 처리한다. `removeExpiredBackups`는 주 1회 백업을 28일 뒤 지우므로 항상 5개 안팎이라 1000개에 닿지 않는다.

조건과 결과: 서명 PDF가 1000개를 넘는 먼 미래(연습실 계약 규모에서 수십 년)에 1000번째 뒤의 고아 PDF(개인정보 포함)가 정리되지 않는다. 잘못 삭제하는 경우는 없다.

**수정**: `removeOrphanPdfs`에만 `mediaRetention.ts`와 같은 cursor/hasMore 루프를 인라인한다. 공용 `listAll` 헬퍼는 만들지 않는다(사용처 하나). 테스트는 `mediaRetention.test.ts`의 `hasMore: true` 두 페이지 모의를 본뜬다.

비고: 검증자가 바로잡음 — 원안이 든 두 경우 중 백업 정리는 발현할 수 없다. 같은 자리를 다른 축(CON 전자계약)도 지적: 고아 PDF 정리의 참조 판정이 URL 문자열에만 의존하고 list를 한 페이지만 본다.

#### PRV-26. GA4 광고 신호 사용 여부가 코드에서 고정되지 않아 방침 '광고를 위해 이용하지 않습니다'가 콘솔 설정에 달려 있다 [P3 · S]
`public/scripts/ga4-init.js:8-10` · `components/common/DeferredAnalytics.tsx` · `data/privacyPolicy.ts:451`

지금 코드:
```js
// public/scripts/ga4-init.js:9-10
gtag('js', new Date());
gtag('config', 'G-KYGP18G36J', isBot ? { traffic_type: 'internal' } : {});
// data/privacyPolicy.ts:451 — 'Google Analytics 4는 ... 식별자 쿠키를 저장합니다. 이용 목적은 방문 통계와 화면 개선이며, 광고를 위해 이용하지 않습니다'
```

왜 문제인가: config에 `allow_google_signals`·`allow_ad_personalization_signals`가 없다(저장소 전체 0건). GA4의 Google 신호는 속성 관리 설정에서 켜야 작동하고 기본값은 꺼짐이므로 거짓 고지인지는 저장소에서 판정할 수 없다 — docs에도 기록이 없다. '문제'가 아니라 '확인할 일'이다.

조건과 결과: 콘솔 설정이 바뀌면 코드 변경 없이 방침 문장이 거짓이 될 수 있다. 켜져 있다면 P2로 올릴 일.

**수정**: 1) GA 콘솔(관리 > 데이터 수집 및 수정 > 데이터 수집의 Google 신호)에서 상태를 읽기 전용으로 확인해 docs에 기록한다(라이브 콘솔 쓰기 위임 금지 규칙). 2) 켜져 있으면 끄고, 코드는 config 인자에 `{ allow_google_signals: false, allow_ad_personalization_signals: false }`를 봇 분기와 객체 병합해 방어선으로 둔다. 꺼져 있으면 코드 변경은 선택 사항이다.

비고: 검증자가 바로잡음 — 원 지적의 확신도 0.4, 확인이 먼저다.

#### PRV-27. 20항이 지도 표시를 위해 접속되는 카카오맵(ko)·구글 지도(그 외 로케일)를 언급하지 않는다 [P3 · S]
`data/privacyPolicy.ts:436-456` (20항) · `lib/maps/kakaoMap.ts:19` · `components/maps/KakaoMap.tsx` · `components/contact/ContactInfoCard.tsx:56-64`, `:140-151` · `components/shows/ShowVenueMap.tsx` · `middleware.ts:93`, `:101`

지금 코드:
```ts
// lib/maps/kakaoMap.ts:19
const SDK_URL = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_MAP_JS_KEY}&autoload=false&libraries=services`;
// middleware.ts:93,101 CSP — script-src에 dapi.kakao.com·t1.kakaocdn.net, frame-src에 www.google.com
// data/privacyPolicy.ts:436-456 (20항) — GA4와 Vercel만 서술
// 사용처: components/contact/ContactInfoCard.tsx, components/shows/ShowVenueMap.tsx
```

왜 문제인가: ko는 카카오맵(실패하면 구글 폴백), 그 밖의 로케일은 구글 지도 iframe이라 방문자 브라우저가 지도 로드를 위해 카카오·구글 서버에 접속하고 IP·브라우저 정보가 전달되는데 20항은 GA4와 Vercel만 서술한다(우편번호·토스 위젯은 입력 단계의 별개 흐름). 구글 임베드는 2024년부터, 카카오맵은 2026-10-07(da4f53667c) 도입. 카카오맵 SDK는 IntersectionObserver로 화면 가까이 올 때에야 받으므로 접속하자마자 전달되는 것은 아니다.

조건과 결과: 자동수집장치 고지(제30조①7호)의 소소한 누락. 구글 지도 쪽은 2024년부터 계속된 누락이다.

**수정**: 20항 '수집하는 정보' 또는 별도 항목에 로케일별로 서술을 추가한다 — ko는 '문의 페이지·공연 상세에서 카카오맵을 불러오며 접속 정보가 카카오에 전달됩니다(불러오지 못하면 구글 지도)', en/zh/es/vi/th/uz는 '문의 페이지의 구글 지도'. ko 20항에만 넣으면 구글 지도를 실제로 쓰는 여섯 로케일이 빠진다. 같은 커밋에서 `FUNDING_TERMS_VERSION`을 올리고 기준선을 갱신한다(20항은 동의 해시에 들어간다). 지도 facade(클릭 뒤 로드)는 운영자가 정한 UX를 바꾸는 것이라 선택 사항이다.

비고: 검증자가 바로잡음 — 로케일별 서술 필요, facade는 필수→선택.

#### PRV-28. 개설자 이메일 원문을 서버 로그에 남긴다 [P3 · S]
`lib/funding/creatorToken.ts:73` · `pages/api/funding/creator/login.ts`

지금 코드:
```ts
// lib/funding/creatorToken.ts:73
console.error('[funding] issueCreatorLoginToken: insert 직후 개설자 행을 찾지 못함', { email: normalized });
```

왜 문제인가: 저장소 전체에서 이메일을 로그에 싣는 곳은 이 줄과 `lib/email/resend.ts:61`(불가 주소 건너뛰기 경고, 대개 example.com 계열이라 실 PII 아님) 둘뿐이다. 이 줄이 id·orderNo만 찍는 규약에서 벗어난 유일한 실 PII 로그다. insert 직후 같은 이메일 select가 행을 못 찾는 상황이라 사실상 도달하기 어려운 분기다.

조건과 결과: 그 분기에 들어가면 로그인 이메일이 런타임 로그에 수일 잔존한다.

**수정**: 이메일을 빼고 `{ creatorLookup: 'missing_after_insert' }` 같은 태그만 남긴다 — 로그만으로 원인 파악이 가능하다. 해시 8자(`sha256(normalized).slice(0, 8)`)는 식별 가치도 없고 코드만 늘어난다. 상위 `login.ts`는 이미 이메일을 갖고 있으나 로그에 쓰지 않는다.

비고: 검증자 확인(confirmed).

**클린 판정**
- lib/privacy/orderRetention.ts의 파기 기산점·멱등·updated_at 비갱신 설계(주문·구독·방치 구독·결제 응답 원본·환불 사유·예약/믹싱 요청사항·차단 메모) — 처리방침 18항 ④~⑬와 일치하고, orders.updated_at은 상태 전이에서만 갱신돼 5년 기산점이 알림 기록으로 밀리지 않음(UPDATE orders 전수 확인)
- lib/funding/retention.ts(배송지 1년+법정 5년, 주민등록번호 (A)/(B) 규칙)와 lib/contracts/retention.ts(종결 계약만, PDF 선삭제 후 DB batch, 실패 시 재시도)의 로직과 멱등성
- lib/crypto/fieldCrypto.ts 구현 자체(랜덤 IV 12바이트, GCM 태그 검증, keyId 판별, 에러 메시지에 평문·암호문 없음)와 ENCRYPTED_FIELD_TARGETS의 현재 3개 컬럼 커버리지, 암호문이 props/직렬화로 새지 않는 화이트리스트 반환(creatorProjectWrite.loadProjectForCreator)
- lib/privacy/accessLog.ts의 시그니처(열람한 값을 담을 자리 없음)와 CSV 5종·계약 PDF·정산 계좌·주민번호·환불 계좌의 기록 호출 연결
- lib/analytics/privatePaths.ts + _app.tsx 게이팅 + next.config.mjs no-store 규칙 순서(로케일 public 규칙 뒤), 개설자 GSSP의 명시적 no-store, 토큰 페이지로의 이동이 window.location.assign인 점
- utils/analytics.ts·DeferredAnalytics·ga4-init.js의 이벤트 payload(이름·연락처·주문 식별자 없음, path는 쿼리 제거)
- lib/email/resend.ts·layout.ts(escape 규약)·operatorAlert.ts·inboundWebhook.ts(svix 서명+timingSafeEqual)
- pages/api/contracts/[id]/download.ts의 본인 확인(이전 리뷰 2026-08-24 지적 처리됨), 계약 파기가 terminationReason·specialTerms·firstViewedIp까지 비움(이전 리뷰 round2 #11 처리됨)
- lib/funding/service.ts 공개 후원자 명단 쿼리(파기 표식·운영자 숨김·동의·익명 처리 필터)와 PledgeWizard 공개 동의 기본값(false)
- 요청 제한 키 정리(rate_limits 만료 스윕)와 IP 포함 키의 창 길이(모두 1시간 이하) — 처리방침 16항과 일치
- lib/formDraft.ts(sessionStorage, 동의 체크 미저장), 문의 폼 허니팟/시간 트랩 로그에 PII 없음
- lib/press/ 수신거부(솔트 해시) 및 감상실 쿠키 서명 구조

**읽지 못한 범위**
- 운영 DB의 실제 행·마이그레이션 적용 상태, Turso PITR 보존기간, Vercel 런타임 로그 보존기간, Resend/Google 워크스페이스 보존 설정 — 읽기 전용 규칙과 코드 밖이라 확인 불가
- raw error 로깅 호출부(수백 곳)는 grep과 대표 경로(정산 저장·계약 서명·확정·빌링 크론) 위주로 확인했고, 각 호출부 쿼리의 실제 params 내용을 전수 대조하지는 않음
- pages/admin/** 화면 각각의 props 직렬화 범위(예약·구독·후원·공연 주문)는 일부만 열어 봄 — 접속기록 누락 목록은 enum/호출부 대조 기준
- zh·es·vi·th·uz 처리방침 번역 정확성은 미검토(구조·시행일만 확인), en은 전문 확인
- lib/booking/, lib/billing/, lib/shows/의 비즈니스 로직 중 PII 로그·메일 본문 전수는 미정독
- press 감상실(lib/press, pages/api/press) 전체, middleware.ts CSP·보안 헤더, 약관 해시 게이트 테스트 본문
- lib/privacy/orderRetention.test.ts(1356줄) 등 기존 테스트 본문과 jest 실행은 하지 않음
- content/·data/의 공개 저장소 콘텐츠에 실제 개인정보가 박혀 있는지(스토리·펀딩 md)는 범위 밖으로 조사하지 않음

**미검증 후보(overflow)**
- 국외이전 고지 요건: 처리방침 수탁자 표의 '사업자 소재 국가'만 있고 이전 시기·방법·받는 자 연락처·거부 방법(시행령 제29조의10)이 없다 — lib/funding/policy.ts:258 주석이 스스로 미확인이라 적음, 변호사 확인 필요(P2, 확신 0.45)
- webhook_events.payload에 토스 웹훅 요청 본문(검증 전 외부 입력 JSON 전체)을 90일 보관하고, 정리는 웹훅 트래픽이 올 때만 일어난다(lib/booking/webhook.ts:273, lib/booking/rate-limit.ts:16-27) — 저장 필드를 paymentKey/status/orderId로 줄일 것(P3)
- 컬럼 지정 없는 `db.select().from(fundingCreators)`가 암호문 컬럼까지 메모리로 읽는다(lib/funding/creatorToken.ts:68, creatorProjectWrite.ts:121) — 직렬화 사고 방지를 위해 필요한 컬럼만 선택하는 린트 규칙 검토(P3)
- contracts.paymentBank/paymentAccount/paymentAccountHolder 죽은 컬럼이 아직 남아 직렬화·백업에 실린다 — 이전 리뷰(code-review-2026-08-24-round2 #29) 미처리, 사업자 계좌지만 목록 응답 최소화 항목과 함께 정리(db/schema.ts:47-49)
- lib/privacy/accessLog.ts:100 접속기록 저장 실패 로그의 detail에 DrizzleQueryError 메시지(IP 포함 params)가 그대로 실린다 — 첫 번째 항목의 safeErrorSummary로 함께 치환
- 운영자 알림 메일(공연 결제·환불, 예약 확정 등)에 고객 이름·연락처가 평문으로 가는 것은 처리방침 4항 Resend 행에 고지돼 있으나, 알림 메일 본문은 관리자 딥링크만 두고 연락처는 링크 뒤로 옮기는 편이 사본 수를 줄인다(P3)

---

## 3부 — 운영 영역: 메일·크론·스크립트·테스트·CI

### OPS. 메일·크론·운영 알림
P0 0 · P1 0 · P2 10 · P3 19, 미검증 0

#### OPS-1. health-check 정상 경로가 점검 메일의 발송 결과를 버린다 — 같은 파일의 실패 경로와 비대칭 [P2 · S]
`pages/api/cron/health-check.ts:37-44`, `lib/email/resend.ts:59-118`. 같은 패턴: `pages/api/cron/backup-contracts.ts:34`, `pages/api/cron/purge-contracts.ts:43·70`, `pages/api/cron/social-refresh.ts:34·56`.

점검이 issue를 찾으면 이렇게 보내고 끝난다.
```ts
await sendEmail({
  to: OPERATOR_EMAIL,
  subject: `[Studio NOL] 운영 점검 — 처리 필요 ${report.issues.length}건...`,
  text: formatHealthReport(report),
  html: buildHealthReportHtml(report),
});
return res.status(200).json({ ok: true, issues: report.issues.length });
```
`sendEmail`은 어떤 경우에도 던지지 않고 `{ ok: false, errorCode }`를 돌려준다(`resend.ts:59-118`). 37행은 그 값을 버리고 200 `{ ok: true }`를 준다. 같은 파일의 실패 경로(53-69행)는 `alert.ok`를 보므로 한 파일 안에서 기준이 다르다. 반대로 `expire-show-orders:52`, `purge-funding:159`, `purge-orders:186`, `review-requests:54·83`은 결과를 본다.

RESEND_API_KEY 누락·도메인 정지·Resend 장애일에 점검이 문제를 찾고도 메일이 안 나가며 응답과 크론 기록은 성공으로 남는다. 점검 리포트가 안 나간 날은 "이상 없음"과 구분되지 않는다. DB 기반 항목은 관리자 첫 화면(`lib/ops/adminDashboard.ts:79` → `pages/admin/index.tsx:47`)에도 뜨므로 전부가 묻히지는 않는다. 메일로만 오는 것은 `checkCalendar`·`runLeadRateCheck`·`checkContractHygiene` 셋이다.

**수정**: `health-check.ts:37`을 `const sent = await sendEmail({...})`로 받고
```ts
if (!sent.ok) {
  console.error('[cron/health-check] 점검 메일 발송 실패', {
    code: sent.errorCode, status: sent.status, detail: sent.errorDetail?.slice(0, 200),
  });
  return res.status(500).json({ ok: false, issues: report.issues.length, mail: sent.errorCode });
}
```
502/500 구분은 의미 없다(Vercel 크론은 재시도하지 않는다). `tests/api/cron/healthCheck.test.ts`를 `purgeFunding.test.ts`와 같은 모킹 틀(`isCronAuthorized`·`sendEmail` jest.mock)로 추가해 `{ok:false}` → 비2xx를 고정한다. 같은 커밋에서 `backup-contracts`·`purge-contracts`·`social-refresh`의 `sendEmail` 결과도 같은 방식으로 본다. Resend 자체가 죽은 경우의 통지는 이 수정 범위 밖이며, 그건 OPS-4의 외부 데드맨 스위치가 답이다.

비고: 검증자가 바로잡은 요지 — 이 수정이 주는 것은 Vercel 크론 대시보드의 실패 표시와 1일 보존 런타임 로그 한 줄이다. Vercel은 크론 실패를 자동 통지하지 않으므로 수정 뒤에도 운영자가 "알게 되는" 경로는 생기지 않는다(단일 채널 경보의 본질적 한계). "조용한 실패를 읽는 유일한 경로"는 과장이며, 저장소 전반의 일관성 문제라 P2.

#### OPS-2. 청구 전 정리 3단계가 청구 루프와 같은 try에 있어, 정리 쿼리 하나가 던지면 그날 청구를 건너뛴다 [P2 · M]
`pages/api/cron/billing-charge.ts:140-200`, `lib/billing/service.ts:1006-1012`(endExpiredSubscriptions)·`1124-1177`(resumeExpiredPauses)·`1189-1194`(listPendingResumeNotices)·`993-1003`(listDueSubscriptions). 선례: `pages/api/cron/purge-funding.ts:53-77`.

```ts
try {
  summary.ended = await endExpiredSubscriptions(now);
  ...
  const pauseExpiry = await resumeExpiredPauses(now);
  ...
  for (const subscription of await listPendingResumeNotices()) {
    ... await sendSubscriptionResumedEmail(...)
  }
  const due = await listDueSubscriptions(now);
```
`endExpiredSubscriptions`(단일 UPDATE), `resumeExpiredPauses`의 후보 SELECT, `listPendingResumeNotices` SELECT가 청구 루프 앞에 한 try 안에 직렬로 있다. 셋 중 하나가 던지면 바깥 catch(246-260행)로 가 `listDueSubscriptions`(200행)에 닿지 못한다. 143-150행 주석의 "재개가 실패해도 그날 청구는 정상"은 행별 catch가 있는 UPDATE(1152-1177행)에만 참이고 SELECT에는 참이 아니다.

정리 단계의 일시 DB 오류나 (미래의) 미적용 마이그레이션 하루가 그날 청구 전체를 다음 날로 미룬다. "전체 실패" 메일과 500이 남으므로 조용하지는 않고, 다음 날 `listDueSubscriptions(nextBillingAt <= now)`가 그대로 집는다. 청구일은 `computeNextBillingAt`(schedule.ts:54-60)이 billingDay에 고정이라 밀리지 않는다 — 돈이 하루 늦게 걷힐 뿐이다. `retryAtFor`(148-152)만 failedAt 기준이라 하루 늦어진다. 현재 운영 DB에 구독이 0건이라 당장 터지는 사고는 아니다.

**수정**: `purge-funding.ts`의 `run()` 패턴을 그대로 가져와 세 정리 호출을 각각 감싸고, 실패는 `summary.errors.push({ subscriptionId: '-', message: '<단계>: <사유>' })`로 넣은 뒤 계속 진행한다. `endExpiredSubscriptions`가 실패해도 `listDueSubscriptions`는 status `active`/`past_due`만 보므로 해지 고객이 청구되지 않아 안전하다. 자동 재개 안내 루프를 due 청구 루프 뒤로 옮기는 것은 무해하다(재개 구독은 최소 3일 뒤 청구라 같은 날 겹치지 않고, 안내가 3일째 밀리면 `healthCheck.ts:577-595`가 D+2 08:00에 먼저 띄운다). 45초 예산 가드는 넣지 않는다 — 구독 0건 규모에 맞지 않는다. 회귀 테스트: 세 정리 중 하나가 reject해도 `chargeCycle`이 불리는 것을 고정(`tests/api/cron/billingCharge.test.ts` 신설, OPS-19와 겹침).

비고: 검증자가 바로잡은 요지 — "밀린 안내가 많은 날 60초 소진"은 구독 0건에서 성립하지 않고, 마이그레이션은 저널 52 = 적용 52로 드리프트가 없으며, "청구일이 밀리고 재시도 간격이 어긋난다"는 틀렸다. 하루 지연·메일 알림·0건 규모를 합쳐 P1이 아니라 P2.

#### OPS-3. runHealthCheck·collectDbIssues가 격리 없이 직렬이라 한 항목의 예외가 그날 점검 결과 전부를 버린다 [P2 · M]
`lib/ops/healthCheck.ts:1069-1095`(runHealthCheck), `:357`(드리프트 issue push), `:393`(gcalGap)·`:439`(orderMailFailed) 등 맨몸 쿼리, `:762·794·820`(try/catch가 있는 세 블록), `:210-211`(주석). `lib/ops/leadRateCheck.ts`(설계상 throw), `lib/ops/adminDashboard.ts:79`, `pages/admin/index.tsx:47-56`, `pages/api/cron/health-check.ts:53-66`.

```ts
const leadRate = await runLeadRateCheck();
issues.push(...leadRate.issues);

issues.push(...(await collectDbIssues(now)));
...
issues.push(...(await checkContractHygiene(now)));
```
`runLeadRateCheck`(GA4 호출 실패 시 일부러 throw)·`collectDbIssues`(20여 쿼리 중 3곳만 try/catch)·`checkContractHygiene`이 서로 격리돼 있지 않다. 하나가 던지면 그때까지 모은 `issues`가 버려지고 핸들러 catch가 "운영 점검 실패 + 사유" 한 통만 보낸다. 357행에서 이미 push한 마이그레이션 드리프트 issue도 뒤 쿼리가 던지면 함께 사라져, 210-211행 주석("표가 없다는 사실은 드리프트 점검이 보고한다")의 전제가 실제로는 깨져 있다. 같은 `collectDbIssues`를 `adminDashboard.ts:79`가 `Promise.all`에 맨몸으로 넣어 관리자 첫 화면도 "현황을 불러오지 못했습니다"로 함께 죽는다.

GA4 토큰 만료(env가 등록돼 있을 때)나 미적용 마이그레이션 하루 동안 매일 "점검 실패" 메일만 오고 결제 불일치·환불 기한·캘린더 누락 점검이 돌지 않으며 관리자 첫 화면도 오류로 뜬다. 핸들러 catch가 `사유: <에러 메시지>`를 실어 보내므로 원인을 운영자가 모르는 상태는 아니다.

**수정**: `safe(label, fn)` 래퍼를 두고 `runLeadRateCheck`·`collectDbIssues`·`checkContractHygiene` 세 호출을 감싼다(`checkCalendar`는 88-108행에 캘린더별 try/catch가 이미 있어 제외). 실패는 `{ severity: 'high', title: '점검 항목 실행 실패 — <label>', detail: message }`로 `issues`에 넣어 "운영자에게 알린다"는 설계를 유지한다. `collectDbIssues` 안은 `Promise.allSettled`로 전면 재구성하지 말고(700줄 함수, 체크 간 순서 의존 미검증), 맨몸 쿼리 블록을 762·794·820행과 같은 try/catch로 감싸되 `console.error`만 하지 말고 medium issue를 push한다 — 그래야 드리프트 보고가 뒤 쿼리 실패에 묻히지 않는다. `checkContractHygiene`는 `collectDbIssues` 뒤라는 문서화된 순서를 유지한다. GA4 15초 타임아웃은 선택(OPS-22). `adminDashboard.ts:79`도 같은 `safe`로 감싼다. `healthCheck.integration.test.ts`에 "한 항목이 reject해도 나머지 issue가 남는다" 케이스 추가.

비고: 검증자가 바로잡은 요지 — "조용하지 않다"(실패 메일에 원인이 적힌다), `checkCalendar`는 이미 격리돼 있다, GA4 시나리오는 env 등록 상태에 달려 있다(OPS-22에서 등록 확인됨). 관리자 첫 화면 2차 피해는 지적이 놓친 것으로 같은 수정이 함께 고친다.

#### OPS-4. 크론이 호출되지 않거나 401로 거절되는 경우를 알리는 장치가 없다 — DB 하트비트로는 못 잡고 외부 데드맨 스위치가 답이다 [P2 · M]
`lib/cron/auth.ts:25-35`, `lib/ops/healthCheck.ts:556-600`(미청구 구독 점검이 없는 자리), `vercel.json`, `pages/api/cron/billing-charge.ts`, `lib/billing/schedule.ts:32`. 이력: `docs/code-review-2026-08-24.md:139` "확인 필요 #2".

```ts
const header = req.headers.authorization;
if (typeof header !== 'string' || header === '') {
  return false;
}
const digest = ...
return timingSafeEqual(digest(`Bearer ${secret}`), digest(header));
```
헤더 불일치 시 로그 없이 false다(시크릿 없음만 25행에서 로그). 모든 크론 알림은 크론이 실행된 뒤에만 나간다. Vercel 크론이 안 돌거나(설정·플랜·시크릿 교체 뒤 미재배포) 401이면 어디에도 신호가 없고, health-check 자신도 같은 인프라·같은 CRON_SECRET에 있어 자기 정지를 보고할 수 없다. `healthCheck.ts`에는 "청구 시각이 지난 미청구 구독" 점검도 없다(577행은 재개 안내 지연 점검).

청구·백업·파기 크론이 멈춰도 운영자가 알 방법이 Vercel 대시보드 육안 확인뿐이다(통지 없음, 런타임 로그 1일). 현재 구독 0건이라 청구 누락 피해는 없고, 파기·백업은 월 1회라 발견이 늦어도 한 달 단위다.

**수정**:
(a) `healthCheck.ts` `collectDbIssues`에 `status in ('active','past_due') AND next_billing_at < now - 20h` → high 항목 추가. 시각 계산: nextBillingAt은 09:00 KST 고정(`schedule.ts:32`, BILLING_HOUR_KST=9), 청구 크론 00:00 UTC = 09:00 KST, 점검 23:00 UTC = 08:00 KST이므로 20시간 기준이면 전날 누락은 잡고 `retryAtFor`(+1일 09:00)는 안 잡는다. 마이그레이션 없음.
(b) "아예 안 도는 경우"는 DB 하트비트 표로 풀리지 않는다 — health-check가 같이 죽는다. 각 크론 성공 끝에 외부 데드맨 스위치 URL(예: healthchecks.io, env `CRON_PING_<NAME>`)을 GET 한 줄로 치고, 핑이 빠지면 그 서비스가 메일을 보내게 한다. 마이그레이션 없음, 401·미호출·타임아웃 전부 잡힘, Resend 장애(OPS-1)와도 독립. 새 외부 의존이므로 운영자가 결정한다(memory `feedback_no_external_schedulers`는 claude.ai 루틴·launchd 금지이지 외부 모니터 금지가 아니다).
(c) `auth.ts`의 불일치 warn은 값 없이 한 줄이면 해롭지 않으나 스캐너 노이즈와 1일 로그 보존 때문에 실효가 작다 — 넣어도 되고 빼도 된다. CRON_SECRET 설정 여부 자체는 Vercel 대시보드 Cron Jobs 탭에서 최근 실행 상태(200/401)를 한 번 보면 끝난다(2026-08-24 "확인 필요 #2" 종결).

비고: 검증자가 바로잡은 요지 — 버그가 아니라 감시 공백이며, DB 하트비트 제안은 마이그레이션이 필요하고 제목이 말하는 경우를 잡지 못해 외부 데드맨으로 바꿨다. Vercel 측 실제 호출 여부는 확인 못 함(정상 종료 크론은 콘솔 출력이 없어 로그에 안 남는다).

#### OPS-5. gsc-audit: 실패 알림 없음, dry-run이 스냅샷을 덮어씀, 메일 실패에도 ok:true로 응답, 이전 스냅샷 fetch 실패 시 기준선 소실 [P2 · S]
`pages/api/cron/gsc-audit.ts:33-36`(loadLatestSnapshot), `:114-117`(saveSnapshot), `:124`(shouldEmail), `:126`(dryRun), `:139-140`(주석), `:144`(sendCronEmail), `:164-173`(catch). 관련 `lib/seo/gscAudit.ts`, `lib/seo/gscDiff.ts`.

```ts
await saveSnapshot(currentSnapshot);
...
const dryRun = req.query.dry === '1';
...
    emailResult = await sendCronEmail(report.subject, report.body);
...
return res.status(200).json({ ok: true, ...emailResult ... });
} catch (err) {
  console.error('[cron/gsc-audit] failed:', err);
  return res.status(500).json({ ok: false, error: 'Internal server error', ...
```
네 가지. (1) catch는 `console.error`와 500뿐이고 다른 크론처럼 `buildOperatorAlertHtml` 실패 메일을 보내지 않는다. (2) `saveSnapshot`(117)이 `sendCronEmail`(144)보다 앞이고 메일이 실패해도 응답은 `ok:true`다. `emailSent: shouldEmail && !dryRun`도 실패와 무관하게 true라 응답이 거짓말을 한다. (3) `saveSnapshot`이 dryRun 판정(126)보다 앞이라 `?dry=1`이 latest와 history를 덮는다. 주석(139-140)과 AGENTS.md는 dry-run을 "미리보기만"이라 적는다. (4) `loadLatestSnapshot`의 fetch `!res.ok`(33-36)가 null을 돌려줘 새 기준선으로 덮는다. `shouldEmail = true`(124)는 죽은 변수.

OAuth 만료·Blob 장애가 SEO 주간 리포트를 멈춰도 알림이 없다. 테스트용 dry-run이 다음 정식 실행의 diff 기준을 소모한다. 메일 실패 주의 변화는 다음 주 diff에서 빠진다.

**수정**: (a) catch에서 `buildOperatorAlertHtml` 실패 메일을 보내고 결과 `.ok`를 확인한다. (b) `if (!dryRun) await saveSnapshot(currentSnapshot)` — 가장 확실하고 설계와도 충돌하지 않는다. (c) 메일 실패 시: history만 저장하고 latest는 덮지 않은 채 502를 돌려주거나, 현재의 write-then-notify(114-117행, "통지는 나갔는데 저장이 실패해 다음 주 같은 diff가 재통지되는 불일치"를 막으려는 명시된 설계)를 유지하고 `emailResult.ok === false`면 502로 크론 실패를 남기고 주석에 이 한계를 적는다. 어느 쪽이든 `emailSent`는 실제 결과를 따른다. (d) `loadLatestSnapshot`의 `!res.ok`는 null이 아니라 throw한다. `if (!token) return null` 분기는 `@vercel/blob`의 `list()`가 토큰 없으면 먼저 던지므로 도달 불가 — 지워도 무방하다. (e) 죽은 변수 `shouldEmail` 삭제.

비고: 검증자가 바로잡은 요지 — "메일 → 성공 시 저장" 순서 뒤집기는 명시된 설계를 뒤집는 판단 문제라 두 선택지로 적었고, 토큰 분기는 도달 불가. SEO 모니터링 한정이라 P2 유지.

#### OPS-6. 고객 메일 공용 푸터가 '회신하지 마세요'라고 하는데 본문과 replyTo는 '이 메일에 회신해 주세요'다 [P2 · S]
`lib/email/layout.ts:195`(en)·`:203`(ko) customer 푸터. replyTo 설정: `lib/booking/email.ts:24·177·340·382·464`, `lib/funding/email.ts:219·275·385·422·489`, `lib/shows/email.ts:304·320·333`, `lib/billing/email.ts` 7곳, `lib/reviews/reviewRequests.ts:230`, `lib/payments/bankDepositOrders.ts:174·178`. 회신 안내 본문: `lib/booking/email.ts:279·289·390·411`, `lib/funding/email.ts:107·114·378·496·509`, `lib/shows/emailHtml.ts:94·96·106`, `lib/reviews/reviewRequests.ts:175·194`. replyTo가 없는 유일한 곳: `lib/contracts/email.ts`. 테스트: `lib/email/layout.test.ts:39`.

```
본 메일은 발송 전용입니다. 회신 대신 위 번호로 연락해 주세요.   // layout.ts:203
'아쉬웠던 점이 있다면 이 메일에 답장으로 알려 주세요. 직접 읽고 답드립니다.',   // reviewRequests.ts:194
...계좌를 잘못 적으셨다면 이 메일에 회신해 주세요.   // booking/email.ts:279·289
```
`buildEmailLayout`의 customer 푸터(ko/en)는 모든 고객 메일에 "발송 전용, 회신 대신 전화"를 붙인다. 그런데 예약·펀딩·공연·구독·후기 요청·지급·후원 후기·개설자 메일은 전부 `replyTo: CUSTOMER_REPLY_TO`(hello@)를 설정하고 본문은 "이 메일에 회신해 주세요"라고 안내한다. 한 메일 안에서 두 문장이 서로 반대다. 계약 메일만 replyTo가 없어 푸터가 맞다 — 메일 종류마다 사실이 다른데 푸터가 하나다.

환불 계좌를 잘못 적은 고객, 청약철회를 메일로 하려는 고객이 푸터를 믿고 전화만 시도하거나 회신을 망설인다. 청약철회 방법 안내(`funding/email.ts:107`)가 법정 서면 교부 문구라 모순이 더 크게 읽힌다. 푸터에 전화번호가 있고 본문 청약철회 안내가 hello@·전화를 함께 적어 서비스가 막히지는 않는다.

**수정**: `EmailLayoutInput`에 `replyable?: boolean`(기본 true)을 추가해 푸터를 분기한다. replyable이면 ko "이 메일에 회신하시면 hello@studionol.co.kr로 전달됩니다. 전화 문의: …", en "You can reply to this email or call …"; false면 지금 문구. `lib/contracts/email.ts`의 `buildContractEmailHtml` 호출만 `replyable: false`로 둔다. `lib/email/layout.test.ts`에 두 푸터 단언을 추가하고, 39행의 기존 푸터 문구 단언을 함께 고친다.

비고: 검증자 confirmed. 수정안은 고객 audience 호출부 전부가 replyTo를 두고 계약 메일만 안 둔다는 사실과 맞는다.

#### OPS-7. 구독 메일 실패(subscriptions.notification_error)가 건강 점검·운영자 알림에 안 잡히고, 성공해도 지워지지 않는다 [P2 · S]
`lib/ops/healthCheck.ts:439-463`(orders만 읽음)·`:676`(contracts), `db/schema.ts:1182`. 쓰는 곳 열두 곳 안팎: `pages/api/cron/billing-charge.ts:99·120·187`, `pages/api/admin/subscriptions/[id].ts:101·124·147·189·243·275`, `pages/api/admin/subscriptions/index.ts:121`, `lib/billing/service.ts:98·799·1400`. 읽는 곳: `pages/admin/subscriptions/[id].tsx:323` 하나.

```ts
const orderMailFailed = await db
  .select({ orderNo: orders.orderNo, notificationError: orders.notificationError })
  .from(orders)
  .where(isNotNull(orders.notificationError));   // 구독 표는 없다

// billing-charge.ts:99-101
if (notificationError) {
  await getDb().update(subscriptions).set({ notificationError }).where(eq(subscriptions.id, sub.id));
}
```
`subscriptions.notificationError`는 실패 때만 채워지고 어디서도 비워지지 않는다(`notificationError: null`은 `funding/pledges/index.ts:279`의 orders 한 곳뿐). 스키마 주석도 contracts("성공하면 비운다")와 달리 비움 규칙을 적지 않았다. 건강 점검은 orders·contracts의 notificationError만 읽는다. 결제 실패 안내 메일 실패는 billing-charge의 `summary.errors`에도 들어가지 않는다.

카드 결제 실패 안내를 못 받은 고객은 재시도 소진 뒤 정지될 때까지 모를 수 있다. 운영자도 구독 상세를 열어 보기 전엔 모른다.

**수정**: 1단계(저비용): `billing-charge.ts`의 `processOne`에서 결제 실패 안내·결제 완료 안내 메일 실패를 `summary.errors`에 넣어 기존 "정기결제 cron 일부 실패" 운영자 메일로 보낸다(188행 resume 안내와 같은 방식). 비움 경로 없이도 즉시 보고된다. 2단계: 메일 결과를 기록하는 helper 하나(`recordSubscriptionMail(id, err)`: 실패면 set, 성공(null)이면 null로 비움)를 만들어 위 열두 곳을 전부 교체한다 — 한 곳이라도 빠지면 "성공해도 안 꺼지는 매일 경보"가 새로 생긴다. 그 뒤에 `healthCheck.collectDbIssues`에 `subscriptions.notificationError IS NOT NULL` 점검(medium, `/admin/subscriptions` 링크)을 추가한다. 점검을 켜기 전에 운영 DB의 기존 값(빌링 샌드박스 테스트 데이터, memory `project_billing_test_data_in_prod_db`)을 확인·정리한다. `healthCheck.integration.test.ts`에 "실패 기록 → 보고, 비움 → 사라짐" 케이스 추가.

비고: 검증자가 바로잡은 요지 — 쓰는 곳이 3+1곳이 아니라 열두 곳 안팎이고, 운영 DB 옛 값 정리가 선행돼야 하며, summary.errors 경유가 더 싼 선행책이다. P2 유지. 운영자 알림 쪽 반환값 폐기는 OPS-17.

#### OPS-8. '구글 캘린더에 등록되지 않은 확정 예약'이 지난 예약까지 세어, 끌 수 없는 high 경보가 매일 울릴 수 있다 [P2 · S]
`lib/ops/healthCheck.ts:372-388`(주석)·`:393-428`(gcalGapRows), `pages/api/admin/bookings/[id].ts:15`(STATUS_TRANSITIONS), `lib/ops/healthCheck.integration.test.ts:294`.

```ts
const gcalGapRows = await db
  .select({ id: bookings.id, gcalError: bookings.gcalError, gcalEventId: bookings.gcalEventId, ... })
  .from(bookings)
  .where(
    and(
      eq(bookings.status, 'confirmed'),
      or(isNotNull(bookings.gcalError), isNull(bookings.gcalEventId)),
    ),
  );
```
시작·종료 시각 조건이 없다. 이 경보의 목적은 주석대로 "같은 시간에 전화 예약을 받아 이중예약"을 막는 것이라 이미 끝난 예약은 의미가 없다. 그런데 confirmed → completed 전이는 관리자가 손으로 눌러야만 일어나고(lib/booking·lib/ops·크론 어디에도 자동 완료가 없다), 안 누른 지난 예약은 전부 confirmed로 남는다. 테스트도 취소 예약 제외만 확인한다.

캘린더 연동이 불안정했던 시기의 예약 한 건만 있어도 "구글 캘린더에 등록되지 않은 확정 예약 N건"이 high로 매일 온다. 끄려면 지난 예약을 완료 처리하거나 캘린더 재시도를 눌러야 하는데 지난 예약에는 그럴 동기가 약하다. 이 저장소가 반복해서 막아 온 경보 피로(정산 드리프트 주석 972-976행, 30일 창 설계)와 같은 형태이고, 운영자가 high 메일에 익숙해지면 실제 이중예약 위험 메일이 묻힌다.

**수정**: `healthCheck.ts:399-404` where에 `gte(bookings.endAt, now)`를 추가한다(앞으로 올 예약만). `collectDbIssues`는 이미 `now`를 받는다. drizzle import에 `gte`를 추가한다. 기존 통합 테스트의 기본 예약(end 2026-09-20)이 NOW(2026-09-10)보다 뒤라 깨지지 않는다. "이미 끝난 예약의 캘린더 구멍은 세지 않는다" 케이스를 통합 테스트에 추가.

비고: 검증자 confirmed. "끌 수 없는"은 과장(예약 상세에서 완료 처리·재시도로 끌 수 있다).

#### OPS-9. inbound 웹훅: 영구적인 전달 실패(4xx)를 운영자가 알 수 없다 [P2 · S]
`pages/api/inbound/resend.ts:22`(MAX_TOTAL_ATTACHMENT_BYTES)·`:199-213`(forward 실패 처리), `lib/email/inboundWebhook.ts`, `lib/operatorContact.ts:36-52`, `tests/api/inbound-webhook.test.ts`.

```ts
const MAX_TOTAL_ATTACHMENT_BYTES = 30 * 1024 * 1024;   // 22행, 주석: 'Resend 발송 요청 한도(40MB)를 넘지 않도록'
...
if (!forwardResponse.ok) {
    const detail = await forwardResponse.text().catch(() => '');
    console.error(`[Inbound] Forward failed: ${forwardResponse.status} ${detail}`);
    return res.status(502).json({ message: 'Forward failed' });
}
```
전달 실패는 `console.error` + 502뿐이다. 4xx처럼 영구 실패하면 svix 재시도(약 하루)가 끝난 뒤 그 메일은 Resend 대시보드에만 남는다. hello@는 `CUSTOMER_REPLY_TO`로 고객 문서에 인쇄되는 접수 주소이고 수신 웹훅이 운영자에게 닿는 유일한 경로다. 첨부 상한 30MB는 base64 확대(약 1.37배)로 Resend 40MB 한도에 맞지 않지만(약 41MB) 29MB 이상 첨부가 도착하는 일은 드물다(Gmail 25MB, 국내 메일 10~20MB).

고객이 hello@로 보낸 답장·문의가 전달되지 않아도 운영자가 모른다. 발생 확률은 낮다.

**수정**: 전달이 4xx로 거절되면 첨부 없이 본문만("첨부 N건은 Resend 대시보드에서 확인" 안내) 한 번 더 전달하고, 그것도 실패하면 `sendEmail`로 OPERATOR_EMAIL(Gmail 직송, 웹훅과 독립)에 "수신함 전달 실패 — 발신자·제목·email_id"를 보낸 뒤 200으로 끝내 svix의 반복 재시도를 막는다. 5xx와 네트워크 오류만 502로 돌려 재시도에 맡긴다 — 매 시도마다 알리면 중복 메일이 나간다. 상한은 약 27~28MB(40MB ÷ 1.37 − 본문 여유)로 두어 Gmail 25MB 첨부(MIME 약 34MB)가 첨부 채로 계속 전달되게 한다. `tests/api/inbound-webhook.test.ts`에 4xx → 운영자 알림 + 200, 5xx → 502 케이스 추가.

비고: 검증자가 바로잡은 요지 — 원 제안의 24MB 상한은 Gmail 최대 첨부를 첨부 없이 건너뛰게 만드는 퇴보라 27~28MB로 고쳤다. Resend 40MB 한도는 공식 문서로 재확인하지 못했다.

#### OPS-10. 마이그레이션 드리프트 판정이 건수 비교라 'when이 작아 영구히 건너뛰어진' 마이그레이션의 이름을 못 짚는다 [P2 · M]
`lib/ops/migrationDrift.ts:97-134`, `scripts/check-migration-drift.mjs`(같은 판정 복제), `lib/ops/healthCheck.ts:358-370`(경보 본문), `lib/ops/migrationDrift.test.ts`, `lib/ops/migrationJournal.test.ts`, `node_modules/drizzle-orm/libsql/migrator.js:15-26`, CLAUDE.md "마이그레이션은 배열 순서가 아니라 when으로 걸러진다".

```ts
const pendingCount = Math.max(localCount - appliedCount, 0);
const pendingTags = pendingCount > 0 ? localTags.slice(localCount - pendingCount) : [];
```
pendingTags를 저널 뒤쪽 pendingCount개로 추정한다. drizzle libsql 마이그레이터는 `created_at` 최대값보다 큰 `when`만 실행하고 저장 값은 저널 `when` 그대로다(`migrator.js:22` folderMillis = journalEntry.when). 적용된 최대 created_at보다 작은 when이 병합되면 건수는 맞아도 이름이 뒤쪽 것으로 틀리게 나오고, `db:migrate`는 초록으로 끝나 그 마이그레이션은 영영 적용되지 않으며, 경보는 매일 같은 오답을 반복한다. 현재 저널 52개 when은 단조 증가라 지금은 문제 없지만 병렬 워크트리/세션이 많은 이 저장소에서 재발 가능성이 있다. CI 스크립트가 같은 건수 판정을 복제하고 있고, 그 헤더는 "어긋나면 화면·메일·CI가 서로 다른 답을 말한다"고 경고한다.

운영자가 엉뚱한 마이그레이션을 확인하다가 실제로 건너뛰어진 것을 못 찾는다. 경보는 계속 뜨므로 조용히 놓치지는 않는다.

**수정**: 저널 `{ tag, when }`과 `select created_at from __drizzle_migrations`를 집합 비교해 `pending = entries.filter(e => !applied.has(e.when))`로 이름을 정확히 구한다. when이 `max(created_at)`보다 작은 미적용 항목은 "재발행 필요(db:migrate로 안 풀림)"로 따로 표시한다 — 이 문구가 없으면 경보가 틀린 처방을 안내한다. `lib/ops/migrationDrift.ts`, `scripts/check-migration-drift.mjs`, `healthCheck.ts:358-370`의 경보 본문("~개 앞서 있습니다")과 이름 목록, `migrationDrift.test.ts`의 `queryAppliedCount` 주입(건수 → created_at 목록)을 한 변경에서 같이 바꾼다.

비고: 검증자가 바로잡은 요지 — 집합 비교는 drizzle 저장 방식상 성립하며, 수정안에 빠져 있던 CI 스크립트·경보 문구·테스트 주입 변경을 추가했다. 감지 자체는 건수로도 되기에 P2.

#### OPS-11. sendEmail이 실패를 어디에도 기록하지 않아, 크론 운영자 알림 7곳의 죽은 .catch와 health-check 정상 경로의 결과 무시가 전부 무흔적이다 [P3 · S]
`lib/email/resend.ts:59-118`. 죽은 `.catch`: `pages/api/cron/backup-contracts.ts:47`, `pages/api/cron/purge-contracts.ts:59·83`, `pages/api/cron/social-refresh.ts:49·66`, `pages/api/cron/billing-charge.ts:236·258`. `pages/api/cron/health-check.ts:37-42`. `lib/email/operatorAlert.ts`.

```ts
await sendEmail({ to: OPERATOR_EMAIL, subject: '[Studio NOL] 계약 데이터 백업 실패', ... }).catch(() => {});
```
`sendEmail`은 fetch를 try/catch로 감싸 TIMEOUT/NETWORK_ERROR/API_ERROR를 값으로 돌려주고 reject하지 않는다. 위 7곳의 `.catch`는 실행될 수 없고, 반환값을 보는 곳도 없다. `sendEmail` 안에는 undeliverable warn 외에 실패 로그가 없다.

크론 자체의 실패는 이미 `console.error`와 500으로 남는다. 사라지는 것은 "알림 메일마저 안 나갔다"는 사실이다. health-check 정상 경로(OPS-1)는 점검 리포트 자체가 사라지는 자리라 더 크다.

**수정**: 새 helper·10개 파일 수정·소스 스캔 가드 대신, `sendEmail`의 `!response.ok`·TIMEOUT·NETWORK_ERROR 분기에서 `console.error('[Email] 발송 실패', { code, status, toDomain, detail: errorDetail?.slice(0, 200) })` 한 줄을 남긴다. 수신자 전체 주소와 제목은 개인정보라 싣지 않는다. 죽은 `.catch(() => {})`는 지운다. health-check 정상 경로는 OPS-1대로 500, 다른 5곳은 purge-orders처럼 `.ok`만 확인하는 정도로 맞춘다.

비고: 검증자가 바로잡은 요지 — "로그 한 줄 남지 않는다"는 틀렸다(원래 실패는 이미 로그·500에 남는다). 새 helper와 가드 테스트는 CLAUDE.md "이미 있는 경로로 되는 일에 새 코드를 짜지 않는다"에 어긋나 한 줄 로그로 줄였다. P3.

#### OPS-12. sendEmail에 실패 로그가 없다 (재시도·멱등 키는 필요가 입증되지 않음) [P3 · M]
`lib/email/resend.ts:98-118`. 호출부: `lib/reviews/reviewRequests.ts`, `lib/funding/email.ts`, `lib/payments/bankDepositOrders.ts`.

```ts
const response = await fetch(RESEND_API_ENDPOINT, { method: 'POST', headers: {...}, body: JSON.stringify(body), cache: 'no-store', signal: controller.signal });
if (response.ok) { return { ok: true, status: response.status }; }
const errorDetail = await response.text().catch(() => '');
return { ok: false, status: response.status, errorCode: 'API_ERROR', errorDetail };
```
`sendEmail` 내부에 실패 로그가 없어 호출부가 빠뜨리면 흔적이 없다. 대표적으로 `reviewRequests`는 status·errorDetail을 버린다(OPS-13). 원 지적의 429 재시도와 Idempotency-Key 제안은 근거가 틀렸다: Resend 공식 문서는 기본 한도를 팀당 10 req/s로 적고(초당 2건이 아님), 후기 요청 루프(DB insert + sendEmail 직렬, 최대 20건)와 funding `send()`(2~3통 직렬)는 한도에 닿지 않으며, 저장소에 429 실패 사례가 없다. Idempotency-Key는 지원되지만(24시간 만료) 후기 요청 크론이 정확히 24시간 간격이라 만료 경계에 걸려 불안정하고, 얻는 것은 드문 TIMEOUT 한 통이다.

실패 원인(상태 코드·detail)이 호출부마다 버려진다.

**수정**: OPS-11의 한 줄 `console.error`만 도입한다. 재시도·멱등 키는 실제 429 실패가 `notificationError`에 쌓이는 것이 관측된 뒤에 검토한다. 그때 키를 쓰려면 후기 요청의 24시간 크론 간격이 키 만료와 같다는 점을 먼저 본다. 5xx 재시도는 키 없이는 중복 위험이 있다.

비고: 검증자가 바로잡은 요지 — 세 갈래 중 "실패 로그 없음"만 서 있다. CLAUDE.md "한 번 쓰고 말 일에 추상화를 붙이지 않는다". P3.

#### OPS-13. 후기 요청 실패 알림에 상태·이유·식별자가 없고, 루프 중 DB 예외가 '한 통도 못 보냈다'는 문구를 만든다 [P3 · M]
`lib/reviews/reviewRequests.ts:46`(FINAL_FAILURES)·`:205-244`(루프), `pages/api/cron/review-requests.ts:38·47`(메일 rows)·`:62-76`(catch), `lib/reviews/reviewRequests.integration.test.ts:199-202`.

```ts
} else {
  await db
    .delete(reviewRequests)
    .where(and(eq(reviewRequests.kind, c.kind), eq(reviewRequests.refId, c.refId)));
  result.failed.push({ refId: c.refId, code: r.errorCode ?? 'API_ERROR' });
}
```
`FINAL_FAILURES`는 UNDELIVERABLE_ADDRESS·TIMEOUT뿐이라 모든 API_ERROR가 기록을 지우고 다음 날 재시도한다(통합 테스트가 고정). `failed`에는 code만 싣고 status·errorDetail은 버린다. 운영자 메일은 `${f.refId}: ${f.code}`라 내부 uuid만 보이고 관리자 링크가 없다. 루프에 건별 try/catch가 없어 DB 오류 한 번이 루프를 끊고, 크론 catch는 이미 나간 건수를 모른 채 "한 통도 보내지 못했습니다"라고 쓴다.

원인을 메일만으로 알 수 없고 누구 건인지 찾기 어렵다. 부분 발송 뒤 예외가 나면 문구가 사실과 다르다. 재실행은 기록을 먼저 넣는 선점 구조 덕에 중복을 만들지 않는다("다시 돌려도 두 번 가지 않는다" 테스트). 401/403 같은 전역 설정 오류는 모든 건이 같이 실패하므로 일일 알림이 오히려 맞고, 크론 머리말("같은 실패가 며칠 이어지면 Resend 설정을 본다")이 그 설계를 적어 두었다.

**수정**: (1) `failed`에 status와 errorDetail 앞부분, orderNo(candidate에 추가)를 싣고 메일 rows에 관리자 링크 `adminUrl('/admin/bookings/' + orderId)`(관리자 상세 키가 orders.id)를 단다. (2) 영구 오류 분류를 넓히려면 status 400·422만 FINAL로 본다. 401·403·429·5xx는 전역·일시 오류이므로 제외 — `400~499 && !== 429`로 잡으면 키·도메인 문제 날 그날 후보 전부에 "보냈음" 기록이 남아 7일 창 재시도가 막히고 후기 요청이 통째로 영구 누락된다. (3) 루프 본문을 건별 try/catch로 감싸 예외는 `failed`(code 'INTERNAL')로 모으고, 크론 catch 문구에서 "한 통도 못 보냈다" 단정을 뺀다. (4) 통합 테스트에 422 케이스와 delete 실패 케이스를 더한다.

비고: 검증자가 바로잡은 요지 — 원 제안의 4xx 전체 영구 처리는 해롭다(400·422만). "재실행·수동 발송으로 중복"은 틀렸다. P3.

#### OPS-14. review-requests 크론에 maxDuration이 없다 (다른 세 크론은 외부 호출이 없거나 단일 호출) [P3 · S]
`pages/api/cron/review-requests.ts:21`. 없는 곳: `purge-orders.ts`, `purge-contracts.ts`, `expire-show-orders.ts`; `vercel.json`에도 functions 설정 없음. 있는 곳: gsc-audit·billing-charge(60)·health-check·social-refresh·backup-contracts.

```ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  ...
    const result = await runReviewRequests(new Date());   // 건당 sendEmail 최대 12초, 최대 20건 직렬
```
선점 후 발송하는 직렬 루프가 maxDuration 없이 돈다. 기본 한도가 짧다면 중간에 잘려 선점(claim)만 남고 그 건이 누락된다. 기본 한도는 미확인 — 프로젝트 생성이 2025-05-28(Fluid compute 기본 이후)이라 300초일 가능성이 높고, 그러면 최악 240초(20건 × 12초 타임아웃)도 넘지 못한다. purge-orders는 외부 호출 없는 UPDATE 16개 월 1회, purge-contracts는 월 1회 Blob 삭제, expire-show-orders는 단일 호출이라 현실적 위험은 review-requests 하나다.

발생 조건이 특수하다. 실제 후기 요청은 하루 몇 건이다.

**수정**: `review-requests.ts`에 `export const config = { maxDuration: 60 };` 한 줄만 추가한다. 나머지 세 크론, deadline 가드, billing-charge 메일 분리는 하지 않는다(billing-charge는 maxDuration 60이 이미 있다). 기본 한도는 Vercel 대시보드 Functions 설정에서 확인한 뒤 필요하면 다른 크론에도 맞춘다.

비고: 검증자가 바로잡은 요지 — "billing-charge도"는 전제가 틀렸고, deadline 가드·메일 분리 리팩터링은 ≤20건 규모에 과하다.

#### OPS-15. 점검 메일이 신규와 지속 중인 항목을 구분하지 않는다 (설계 선택, 개선 여지) [P3 · M]
`pages/api/cron/health-check.ts:30-44`, `lib/ops/healthCheck.ts`(HealthIssue에 first-seen 없음, sortBySeverity).

```ts
if (report.issues.length === 0) {
  return res.status(200).json({ ok: true, issues: 0 });
}
...
  subject: `[Studio NOL] 운영 점검 — 처리 필요 ${report.issues.length}건${highCount > 0 ? ` (긴급 ${highCount})` : ''}`,
```
이상이 있으면 해소될 때까지 전 항목이 매일 같은 모양으로 온다. 제목은 건수·긴급 수만 바뀐다. 매일 재보고는 모듈 머리말과 정산 점검 주석("이미 한 달 내내 보고됐으므로 영구 경보를 막는다")에 드러난 의도된 모델이고, 이 저장소는 "항목마다 끌 수 있게 만드는 것"으로 경보 피로를 다뤄 왔다(OPS-7·OPS-8이 그 사례). 메일은 이상이 있을 때만 가고 긴급은 붉은 블록으로 앞에 정렬된다.

운영자가 이를 피로하게 느끼는지는 확인되지 않았다. 지금은 신규 high를 찾으려면 본문을 읽어야 한다.

**수정**: 상태 표(`ops_alert_state`, 마이그레이션 한 건 + 수동 적용 부담)나 요일 분기("medium은 월요일에만" — 확인 메일 미발송 주문·서명 기한 지난 계약 같은 고객 영향 medium을 최대 6일 늦춘다)는 두지 않는다. 항목마다 끌 수 있게 만드는 쪽(OPS-7·OPS-8)이 먼저다. 그래도 신규 구분이 필요하면 DB 컬럼으로 판정할 수 있는 항목에 한해 본문에 "오늘 새로 생김"을 붙이는 정도로 작게 시작한다.

비고: 검증자가 바로잡은 요지 — 결함이 아니라 설계 선택이고 해악의 근거가 없다. 원 수정안 두 단계는 둘 다 위험하다. P3.

#### OPS-16. 관리자 첫 화면이 계약 후처리 누락·오래된 초안 경보를 보여주지 않는다 (메일과 판정이 어긋남) [P3 · M]
`lib/ops/healthCheck.ts:270`(주석)·`:275-281`(외부 호출 금지 원칙)·`:289`(함수 주석)·`:1056-1100`(runHealthCheck), `lib/ops/adminDashboard.ts:72-74`, `pages/admin/index.tsx:46-55`, `lib/ops/adminDashboard.integration.test.ts`.

```ts
const [issues, sessions, ...] = await Promise.all([
  collectDbIssues(now),
  ...
// healthCheck.ts:270 주석: 'DB에 흔적이 남는 점검 전부 — 크론 메일과 관리자 첫 화면이 같은 판정식을 쓴다.'
// healthCheck.ts:1092
issues.push(...(await checkContractHygiene(now)));   // 대시보드는 이 함수를 부르지 않는다
```
`checkContractHygiene`의 읽기 전용 두 점검(서명 후 후처리 기록 없음 high, 90일 초안 medium)이 크론에만 있고 대시보드의 `collectDbIssues`에는 없다. 270행 주석은 "같은 판정식"이라고 적었다. 후처리 누락 계약은 관리자 화면 어디에도 경고가 안 뜬다고 289행 주석이 밝히므로 대시보드 공백이 의미 있다.

후처리가 죽은 서명 계약이 08시 메일에는 있고 첫 화면에는 안 보인다. 건수가 메일과 화면에서 다르게 나온다. 점검 하나의 오류는 500이 아니라 `pages/admin/index.tsx:46-55`의 try/catch가 "현황을 불러오지 못했습니다" 안내로 처리하고 다른 관리 화면 링크는 살린다.

**수정**: `checkContractHygiene`에서 읽기 전용 두 점검을 `collectDbIssues`로 옮기고, 상태를 바꾸는 `expireOverdueContracts`만 크론에 남긴다. 순서 제약(서명 기한 지난 계약 점검이 expire보다 먼저)은 `runHealthCheck`의 호출 순서로 유지된다. 쿼리 병렬화(`Promise.allSettled`)는 단일 관리자 화면에 과하므로 하지 않는다. 270행 주석을 실제 범위에 맞게 고친다. `adminDashboard.integration.test.ts`에 두 점검이 대시보드 issues에 나오는 케이스 추가.

비고: 검증자가 바로잡은 요지 — "하나가 던지면 /admin 첫 화면 전체가 500"은 사실이 아니고, 원 수정안이 기댄 `safe()`는 저장소에 없다(OPS-3이 도입하면 그때 쓴다). P3.

#### OPS-17. billing-charge: 운영자 알림(정지·자동 재개)의 실패 반환값을 버리고, 그 뒤의 .catch는 실행되지 않는다 [P3 · S]
`pages/api/cron/billing-charge.ts:117-123`·`:159-163`, `pages/api/admin/subscriptions/[id].ts:121·145`, `lib/billing/email.ts`(sendSubscriptionOperatorAlert), `lib/billing/service.ts:806-815`(문자열을 받아 기록하는 올바른 호출부), `pages/admin/subscriptions/[id].tsx:323`.

```ts
if (paused) {
  await sendSubscriptionOperatorAlert(sub, 'paused', `자동 재시도 한도 소진 — ${result.message ?? ''}`);
}
...
    await sendSubscriptionOperatorAlert(
      subscription, 'pause_expired', `...`,
    ).catch((error: unknown) => console.error('[cron/billing-charge] 자동 재개 운영자 알림 실패', error));
```
`sendSubscriptionOperatorAlert`는 reject하지 않고 실패 시 `operator:${errorCode}` 문자열을 resolve한다. 118행은 이를 버리고 159-163행 `.catch`는 닿지 않는다. 같은 패턴이 `admin/subscriptions/[id].ts:121·145`에도 있다(운영자가 화면 앞에 있는 경로라 영향은 작다).

고객 정지 메일과 운영자 알림이 둘 다 같은 Resend 장애로 실패하면, 고객 쪽 오류만 `notificationError`에 남고 운영자는 정지 사건을 알 길이 없다(헬스체크가 구독 notificationError를 보지 않는다, OPS-7). 고객 메일 실패는 이미 관리자 상세에 뜨므로 운영자 알림만 조용히 사라지려면 그 한 통만 실패해야 한다. 발생 조건이 Resend 장애 구간에 한정돼 확률이 낮다.

**수정**: 118행에서 `const operatorError = await sendSubscriptionOperatorAlert(...)`로 받고, 고객 메일 오류와 `[customerError, operatorError && `운영자 알림: ${operatorError}`].filter(Boolean).join(' / ')`로 합쳐 기존의 단일 update(121-123행)에 한 번에 쓴다. 따로 update하면 한쪽이 덮어써진다. 159행은 `.catch`를 지우고 반환 문자열이 있으면 `console.error`로 남긴다. `admin/subscriptions/[id].ts`의 두 호출도 같은 방식으로 맞춘다. `summary.errors.push`는 같은 Resend 경로의 메일이라 보조 수단일 뿐이다.

비고: 검증자가 바로잡은 요지 — "크론만 다르다"는 틀렸고(admin 경로도 같다), summary.errors 경유 알림은 같은 Resend 장애에 같이 죽으므로 notificationError 기록이 본질이다. 같은 자리를 다른 축(BIL 정기결제·구독·아티스트 후원)도 지적: "cron의 정지 운영자 알림 발송 실패가 버려지고, 자동 재개 알림의 .catch는 실패 문자열을 잡지 못한다".

#### OPS-18. billing-charge 부분 실패 시 200 응답의 근거 주석('500이면 Vercel이 곧바로 재시도')이 확인되지 않은 주장이다 [P3 · S]
`pages/api/cron/billing-charge.ts:239-245`. 관행 비교: `pages/api/cron/purge-contracts.ts:62`(failed>0이면 500), `pages/api/cron/social-refresh.ts:52`(200 + ok:false).

```ts
// 예외가 있어도 200을 준다 — 재시도는 다음 cron이 자연히 한다...
// 여기서 500을 주면 Vercel Cron이 곧바로 재시도하는데, 이 라우트는 매번 listDueSubscriptions
// **전체**를 다시 순회하므로...
return res.status(200).json({ ok: summary.errors.length === 0, ...summary });
```
주석은 Vercel Cron이 500을 즉시 재시도한다고 단정하지만 공식 문서로 확인되지 않았다(`search_vercel_documentation` 두 번 검색에 직접 밝힌 문단 없음). 이 근거로 200을 고정해 둬서 대시보드 상태 코드에는 예외가 있던 날이 성공으로 보인다. 예외가 있으면 233행 부근에서 운영자 메일이 나가고 각 예외는 `console.error`로 남으며 JSON 본문에 `ok:false`가 실린다.

Vercel 크론 대시보드 상태 코드에서만 예외 발생일이 구분되지 않는다. 알림은 메일이 담당하므로 운영 사고 위험은 낮다.

**수정**: 먼저 Vercel 문서/대시보드로 재시도 정책을 확인한다. 재시도가 없으면 `purge-contracts.ts:62`처럼 `summary.errors.length > 0`일 때 500을 주고 주석을 사실에 맞게 고친다(청구는 `claimDueSubscription`으로 멱등이라 500으로 바꿔도 중복 청구는 없다). 재시도가 있으면 현재 200이 맞고 주석만 그 근거를 문서 링크와 함께 남긴다. 어느 쪽이든 확인 없이 단정을 유지하지 않는다.

비고: 검증자가 바로잡은 요지 — "예외 알림이 안 나간 날 Vercel 기록에 흔적이 없다"는 과장(흔적이 없는 것은 상태 코드뿐). 재시도 정책은 미확정. P3.

#### OPS-19. 계약 백업 정리: 삭제 실패를 성공 건수에 합산하고 Blob 목록을 첫 페이지만 읽는다 [P3 · S]
`lib/contracts/backup.ts:56-69`(put 실패 → backupError)·`:86-133`(removeExpiredBackups/removeOrphanPdfs), `pages/api/cron/backup-contracts.ts:30-49`, 선례 `lib/funding/mediaRetention.ts:73-100`(cursor 루프).

```ts
const { blobs } = await list({ prefix: BACKUP_PREFIX });
const expired = blobs.filter((b) => new Date(b.uploadedAt) < boundary);
for (const blob of expired) {
  await del(blob.url).catch((error: unknown) => {
    console.error(`[contracts/backup] Failed to delete old backup ${blob.pathname}:`, error);
  });
}
return expired.length;
```
`del` 실패를 `console.error`로만 삼키고 시도 건수(`expired.length`, `orphans.length`)를 `removedBackups`/`removedOrphanPdfs`로 반환해 응답이 실제와 다를 수 있다. `list()`는 cursor 없이 첫 1000건만 읽는다(`@vercel/blob` 기본 limit, hasMore/cursor 존재) — 덜 지울 뿐 잘못 지우지는 않는다(고아 판정은 DB pdfUrl 집합과의 대조라 못 본 blob은 후보가 아니다).

같은 크론이 같은 BLOB 토큰으로 put을 먼저 하고 put 실패는 운영자 메일이 나가므로, "권한·토큰 문제로 삭제가 계속 실패해도 성공"은 성립하기 어렵다. 개별 blob 오류로 28일 보관 약속(계약서 12조와 연결, backup.ts 주석)을 넘긴 백업이 남아도 크론이 성공으로 보이는 것이 실제 범위다. 백업 접두사는 주 1회 파일이라 28일이면 5개 안팎이고 contracts/ PDF가 1000개를 넘으려면 한참 걸린다.

**수정**: 두 함수가 `{ deleted, failed }`를 돌려주게 하고 `BackupResult`에 `failedDeletes`를 추가한다. 크론은 `failedDeletes > 0`이면 운영자 메일을 보내고 500을 준다(`purge-contracts.ts:50-65` 방식). list는 `mediaRetention.ts`처럼 `do { page = await list({ prefix, cursor }); ... cursor = page.hasMore ? page.cursor : undefined } while (cursor)`로 바꾼다.

비고: 검증자가 바로잡은 요지 — 영향 시나리오 과장, 페이지 미처리는 안전 방향 실패. P3으로 낮춤.

#### OPS-20. 계약 서명 완료 메일의 입금 계좌가 하드코딩이다 (템플릿·스키마 기본값과 함께 3중화된 이전 리뷰 #29의 잔존분) [P3 · S]
`lib/contracts/email.ts:97·115`, `lib/contracts/contract-template.md:47`, `db/schema.ts:47-49`(paymentBank/paymentAccount/paymentAccountHolder — 코드가 읽지 않는 컬럼), `lib/payments/bankAccount.ts:15-19`(BANK_ACCOUNT 정본). 이력: `docs/code-review-2026-08-24-round2.md` #29.

```ts
'입금 계좌: 카카오뱅크 3333-12-5480849 (예금주: 황경하 / 스튜디오 놀)',   // 97행(html notices)
'입금 계좌: 카카오뱅크 3333-12-5480849 (예금주: 황경하 / 스튜디오 놀)',   // 115행(text)
```
계약 메일, 계약서 본문 템플릿(서명에 묶이는 법적 본문), contracts 테이블 기본값이 같은 계좌 리터럴을 따로 갖고 BANK_ACCOUNT를 읽지 않는다.

계좌를 바꿀 때 메일·템플릿·기본값을 한꺼번에 고쳐야 하는데 정본이 이를 알려주지 않는다. 메일만 BANK_ACCOUNT를 읽게 하면 이미 서명한 계약서(옛 계좌가 박힘)와 메일(새 계좌)이 어긋난다. 템플릿 변경은 CLAUDE.md가 경고한 "서명 대기 계약이 있을 때 템플릿 수정 금지" 영역이다. 계좌가 바뀔 일이 거의 없어 현재 피해는 없다.

**수정**: 메일은 정본이 아니라 그 계약에 기록된 값(`contract.paymentBank/paymentAccount/paymentAccountHolder`, 비어 있으면 BANK_ACCOUNT)을 읽게 하고, 계약 생성 시 이 컬럼을 BANK_ACCOUNT로 채운다. 템플릿 본문은 서명 대기 계약이 없을 때만 플레이스홀더로 바꾼다. 가드는 소스 스캔(drizzle 스냅샷 50여 개·docs·schema에 같은 리터럴이 있어 예외 목록이 커진다)이 아니라 "계약 템플릿과 메일 출력에 `BANK_ACCOUNT.accountNumber`가 들어 있다"는 단위 테스트 하나로 충분하다.

비고: 검증자가 바로잡은 요지 — "메일만 옛 계좌를 안내한다"는 틀렸다(3중화). 같은 자리를 다른 축(CON 전자계약 — 서명·해시·PDF·보관)도 지적: "서명 완료 메일의 입금 계좌가 결제 정본(BANK_ACCOUNT)을 쓰지 않는다".

#### OPS-21. 크론 핸들러 10개 중 8개는 접합부 테스트가 없다 (판정 로직은 lib에서 테스트됨) [P3 · M]
`tests/api/cron/`(purgeFunding.test.ts·purgeOrders.test.ts 두 개뿐), `pages/api/cron/`(10개 라우트), `lib/email/`(layout·operatorAlert·undeliverable 테스트만). 이력: `docs/code-review-2026-08-24.md` #3.

billing-charge, purge-contracts, backup-contracts, health-check, review-requests, gsc-audit, social-refresh, expire-show-orders 핸들러의 상태 코드와 알림 분기를 검증하는 테스트가 없다. `sendEmail`의 타임아웃·에러 코드 매핑은 직접 단위 테스트가 없다(`lib/booking/email.test.ts`·`lib/funding/email.test.ts`·`tests/api/contact/send-email.test.ts`가 global.fetch 모킹으로 간접 검증, `undeliverable.test.ts`는 isUndeliverableAddress만). 판정 로직은 lib 쪽에 테스트가 있다: `lib/ops/healthCheck.*.test.ts` 4종 + integration, `leadRateCheck.test.ts`, `migrationDrift.test.ts`, `lib/reviews/reviewRequests.integration.test.ts`, `lib/billing/service.integration.test.ts`(chargeCycle 다수), `lib/cron/auth.test.ts`.

핸들러 수준 회귀(부분 실패 시 상태 코드, 알림 메일 누락)가 CI에 드러나지 않는다. 결함이 아니라 커버리지 백로그다.

**수정**: `purgeOrders.test.ts`의 모킹 틀(`isCronAuthorized`·`sendEmail` 모킹)을 복사해 돈·삭제가 걸린 것부터: `billingCharge.test.ts`(정리 단계 throw에도 청구 진행 — OPS-2, 예외 시 알림 메일)와 `purgeContracts.test.ts`(failed>0이면 500+메일). 그다음 `healthCheck` 핸들러(OPS-1), `lib/email/resend.test.ts`(fetch 모킹으로 200/422/abort/네트워크 오류 매핑). 한 번에 전부 하지 않는다.

비고: 검증자가 바로잡은 요지 — "크론 대부분이 무테스트"는 핸들러 접합부에 한정된 말이고, 이전 리뷰 P0 중 일부(purge-funding·orders)는 해소됐다. P3.

#### OPS-22. 카카오 전환 감시: GA4 호출에 타임아웃이 없고, 실패가 같은 크론의 다른 점검까지 막으며, 'env 미등록' 주석이 낡았다 [P3 · S]
`lib/ops/leadRateCheck.ts:15`(낡은 주석)·`:95-118`(createGa4Client·dateRange)·`:195-197`(skipped), `lib/ops/healthCheck.ts:1085-1089`, `pages/api/cron/health-check.ts:17`(maxDuration 60), `lib/ops/leadRateCheck.test.ts`.

```ts
const analyticsdata = google.analyticsdata({ version: 'v1beta', auth: oauth2 });   // 98행: 타임아웃 설정 없음
...
const dateRange = (daysAgoStart: number, daysAgoEnd: number) => {
  const fmt = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
// 195-197행: return { skipped: 'GA4 env 없음', issues: [] };
```
googleapis 호출에 timeout이 없다(gaxios 기본 무제한), 크론 maxDuration은 60초. `runLeadRateCheck`가 DB 점검보다 먼저 직렬로 돌아 GA4가 멈추면 60초 제한으로, throw하면 catch로 빠져 다른 점검(마이그레이션 드리프트 포함) 결과가 그날 통째로 사라진다(OPS-3). 헤더 주석(15행)과 healthCheck 주석은 "2026-09-08 기준 env 미등록"이라 적지만 `vercel env ls production`에 GA4_PROPERTY_ID·GA4_OAUTH_REFRESH_TOKEN·GSC_OAUTH_CLIENT_ID·GSC_OAUTH_CLIENT_SECRET이 모두 등록돼 있어 감시는 켜져 있다. `dateRange`는 UTC 날짜라 KST 기준 하루 더 오래된 창이지만 최근(8~1)과 기준선(36~9) 두 창이 같은 오프셋으로 밀려 겹침·빈틈이 없고 GA4 지연 데이터를 더 피한다(무해, 주석의 "어제"만 부정확).

GA4 장애일에 다른 점검이 함께 누락된다. throw하면 "운영 점검 실패" 메일이 나가 침묵은 아니다.

**수정**: `google.options({ timeout: 15_000 })` 또는 `runReport`에 timeout을 주고, `healthCheck.ts`에서 `runLeadRateCheck`를 try/catch로 감싸 실패는 medium 이슈 한 줄로 바꿔 나머지 점검이 계속 돌게 한다(OPS-3의 `safe`와 동일). 낡은 "미등록" 주석을 현재 상태로 고친다. `skipped`를 이슈로 올리지 않는다(주석 "실패 취급 금지"는 설계 결정). `dateRange`를 상대 표기로 바꾸려면 기존 거동 유지를 위해 `'9daysAgo'/'2daysAgo'` 형태로 둔다 — `'1daysAgo'`는 창을 하루 당겨 주석이 피하려던 미완성 데이터 쪽으로 간다.

비고: 검증자가 바로잡은 요지 — "env가 없으면 영구히 꺼진 채"는 반박됨(등록돼 있음), 날짜 오프셋은 무해. 실질 결함은 타임아웃 부재뿐이라 P3.

#### OPS-23. 운영자 크론 알림 제목 접두사가 세 곳만 [스튜디오 놀]이다 (나머지 13곳은 [Studio NOL]) [P3 · S]
`pages/api/cron/review-requests.ts:32·64`, `pages/api/cron/expire-show-orders.ts:33`. 나머지 13곳: backup-contracts·purge-*·billing-charge·health-check·social-refresh. `lib/email/operatorAlert.ts`.

```ts
subject: `[스튜디오 놀] 후기 요청 메일 ${result.failed.length}건 발송 실패`,   // review-requests.ts:32,64
subject: '[스튜디오 놀] 공연 주문 만료 정리 크론 실패',   // expire-show-orders.ts:33
subject: '[Studio NOL] 계약 데이터 백업 실패',   // backup-contracts.ts:36 (다른 크론 8곳 동일)
```
세 줄만 [스튜디오 놀]이다. 메일 필터가 [Studio NOL]을 기대한다는 증거는 저장소에 없다 — CLAUDE.md의 "제목은 메일 필터가 기대는 형태"는 HTML을 입힐 때 제목을 바꾸지 말라는 말이지 접두사 규칙이 아니고, 운영자 알림은 [예약]·[펀딩]·[구독]·[Studio NOL] 등으로 원래 갈려 있다.

외관 불일치. 운영자가 실제로 Gmail 라벨·필터를 어느 접두사로 걸어 두었는지 확인해야 영향 여부를 알 수 있다 — [스튜디오 놀]로 걸었다면 바꾸는 쪽이 오히려 두 크론을 빠뜨린다.

**수정**: 운영자가 필터 기준을 확인한 뒤, [Studio NOL]이면 위 세 줄 문자열만 바꾼다. `OPERATOR_ALERT_SUBJECT_PREFIX` 상수나 `sendOperatorAlert` 래퍼는 만들지 않는다(후자는 저장소에 존재하지 않는다 — `operatorAlert.ts`의 export는 `buildOperatorAlertHtml`·`formatKst`·`escapeMultiline`·`VERCEL_PROJECT_URL`뿐). 제목 단언 테스트가 없으므로 테스트 수정은 없다.

비고: 검증자가 바로잡은 요지 — 필터 근거는 가정이고, 원 수정안이 없는 함수를 가리켰다.

#### OPS-24. purge-funding: 고아 이미지 삭제의 건별 실패(media.failed)가 알림·상태 코드에 반영되지 않는다 [P3 · S]
`pages/api/cron/purge-funding.ts:79-82`(주석)·`:104-117`·`:120~`(hints), `lib/funding/mediaRetention.ts:118-124`, `tests/api/cron/purgeFunding.test.ts`(MEDIA 고정값 failed:0).

```ts
// purge-contracts와 달리 result.failed 분기가 없다 — ... 외부 API 호출이 없고 부분 실패라는 상태가 없다
...
const media = await run('아무 프로젝트도 참조하지 않는 개설자 업로드 이미지 정리', () => purgeOrphanFundingMedia());
...
  orphanMedia: media,
if (failures.length > 0) {   // media.failed는 failures에 안 들어간다
```
`purgeOrphanFundingMedia`는 Blob del 실패를 건별로 try/catch로 삼키고 `result.failed`로 센다. 핸들러는 throw만 `failures`에 넣어 `failed > 0`이어도 200이고 메일이 없다. 79-82행 주석은 바로 아래 세 파기(UPDATE/DELETE 한 번씩)에 대한 설명이라 그 범위에서는 맞고, 네 번째 단계(이미지)가 부분 실패를 가진다는 사실만 빠져 있다.

Blob 토큰 문제 등으로 모든 삭제가 실패해도 매달 200으로 끝나 고아 이미지가 쌓인다. 개인정보가 아니라 저장소 청소라(파일 머리말·테스트 주석이 명시) 영향은 작다.

**수정**: run 직후 `if (media && media.failed > 0) failures.push({ label: '고아 이미지 일부 삭제 실패', detail: `${media.failed}건 (검사 ${media.scanned})` })`를 추가한다. 실패 메일의 hints가 "펀딩 약관 제13조·처리방침으로 약속한 파기이므로 확인이 필요합니다"를 모든 실패에 붙이므로, 이미지 청소만 실패한 경우에는 그 hint를 빼도록 분기한다 — 그러지 않으면 이미지 청소 실패를 개인정보 파기 실패로 읽게 된다. 79-82행 주석 끝에 "네 번째 단계(이미지)는 건별 Blob 삭제라 부분 실패가 있고 아래에서 따로 센다"를 덧붙이고, failed>0 케이스(500 + 메일)를 `purgeFunding.test.ts`에 추가한다.

비고: 검증자가 바로잡은 요지 — 주석은 "stale"이 아니라 범위 보충 대상이고, hints 분기 없이 push하면 메일이 오도한다.

#### OPS-25. 메일·화면 소스에 전화번호 리터럴이 흩어져 있고(메일 모듈 약 26곳) SITE_URL 정의도 lib에 7벌이다 [P3 · M]
전화번호 `010-4255-7893` 리터럴: `lib/booking/email.ts`(8), `lib/billing/email.ts`(7), `lib/shows/refundMessages.ts`(6), `lib/payments/bankDepositOrders.ts`(2), `lib/contracts/email.ts`(2), `lib/funding/email.ts`(1, 정의); pages/components 40여 파일. 정본: `lib/factTokens.js` CANONICAL_FACTS.phone → `data/siteConfig.ts:177` contact.phone; `lib/email/layout.ts` 푸터만 `getSiteConfig().contact.phone`을 쓴다. SITE_URL: `lib/email/layout.ts:19`(export) 외에 `lib/booking/email.ts`·`lib/booking/bankDeposit.ts`·`lib/shows/email.ts`·`lib/shows/bankDeposit.ts`·`lib/billing/email.ts:10`·`lib/funding/email.ts`가 같은 식을 다시 계산, pages 4곳. 가드: `content/factGuards.ts:10`의 'phone-hardcoded-in-content'는 surfaces가 markdown·locales뿐.

전화번호 정본이 이미 있는데 메일 모듈과 pages/components가 리터럴을 쓴다. factGuards는 lib 소스를 보지 않는다. 0507→010 전환에 180+ 파일 스윕이 든 이력이 factGuards.ts:10과 factTokens.js 머리말에 있다.

번호·도메인을 바꿀 때 한 곳을 빠뜨리면 그 메일만 옛 값을 안내한다. 지금은 값이 같아 증상이 없다.

**수정**: 새 상수를 만들지 않는다(`operatorContact.ts`에 `STUDIO_PHONE`을 두면 세 번째 별칭이 생긴다). 메일 모듈은 `CANONICAL_FACTS.phone` 또는 `getSiteConfig('ko').contact.phone`을 import하고, SITE_URL은 `layout.ts`의 export를 재사용한다. 일괄 치환 전에 먼저 `tests/pages/privacy-policy.test.tsx` 선례처럼 lib 메일 소스에서 `currentPhoneHardcodePattern`을 찾는 기준선 방식 테스트를 추가해 늘어나는 것만 막는다 — 기존 가드를 lib로 넓히면 기존 위반 수십 건으로 CI가 바로 선다. 26곳 치환은 번호 변경 계획이 생겼을 때 해도 늦지 않다.

비고: 검증자가 바로잡은 요지 — 원 제안의 정본 위치가 틀렸고(CANONICAL_FACTS.phone이 단일 소스), 범위가 과소 집계(pages/components 40여 파일, SITE_URL lib 7곳). CLAUDE.md "단순하게" 기준으로 재발 방지 가드가 먼저.

#### OPS-26. 운영 점검 메일 본문에 `**` 서식 문자가 그대로 찍히고, 파기 크론이 '매달 3일'(실제 KST 4일 03시)로 적혀 있다 [P3 · S]
`lib/ops/healthCheck.ts:171·252·264`(별표)·`:660`(날짜)·`:1098`(formatHealthReport)·`:1136`(buildHealthReportHtml), `vercel.json`(`0 18 3 * *`), 주석만 해당: `healthCheck.ts:624`, `pages/api/cron/purge-orders.ts:7`, `lib/privacy/orderRetention.ts:465`. 참고 `data/privacyPolicy.ts:359` 주석.

```ts
+ `(개인정보 파기 크론, 매달 3일). 종료된 구독은 재개도 수동 결제도 할 수 없습니다.`,   // 660행
'**이미 저장된 값이 있다면 키를 새로 만들지 마세요** — ...'   // 171행
`**건수가 0이 되기 전에 ${FIELD_CRYPTO_OLD_KEY_ENV}를 지우지 마세요.**`   // 252행
// vercel.json: { "path": "/api/cron/purge-orders", "schedule": "0 18 3 * *" }
```
detail에 든 `**…**`는 어느 렌더러도 변환하지 않는다 — HTML은 escapeHtml + 줄바꿈만, 텍스트는 그대로 이어붙여 양쪽에 별표가 글자 그대로 보인다(테스트에 `**` 단언이 없어 의도된 표기도 아니다). 660행은 UTC 크론 날짜(3일 18:00 UTC = KST 4일 03:00)를 KST 독자에게 시간대 없이 적었다. 운영자가 읽는 문장은 660행 하나이고 나머지는 코드 주석이다.

서식 결함 하나와 하루 어긋난 안내 한 문장. 경보가 SUBSCRIPTION_DORMANCY_WARNING_DAYS=30일 앞서 뜨므로 판단에는 영향이 없다.

**수정**: 171·252·264행 문자열에서 `**`를 지운다(마크다운 변환을 렌더러에 넣지 않는다 — 강조는 high 항목이 이미 붉은 블록이다). 660행은 "(개인정보 파기 크론, 매달 KST 4일 03시경)" 또는 날짜 없이 "한 달에 한 번 도는 개인정보 파기 크론"으로 고친다. 624행·purge-orders.ts·orderRetention.ts의 주석은 "(UTC)" 표기만 덧붙인다. 처리방침 18항은 날짜를 일부러 적지 않으니 건드리지 않는다(판본 게이트).

비고: 검증자가 바로잡은 요지 — 두 갈래 변환 렌더러 도입은 과하고 소스에서 별표를 지우는 편이 단순하다.

#### OPS-27. preview-emails가 레이아웃 일반 샘플 3개뿐이라 실제 운영자 알림·점검 리포트·후기 요청 메일을 눈으로 볼 수 없다 [P3 · S]
`scripts/preview-emails.ts:14-71`, `lib/email/operatorAlert.ts`(buildOperatorAlertHtml), `lib/ops/healthCheck.ts`(buildHealthReportHtml), `lib/reviews/reviewRequests.ts`(buildReviewRequestEmail), `lib/email/layout.test.ts:97-113`.

```ts
const samples: { name: string; input: EmailLayoutInput }[] = [
  { name: 'customer', input: { ... heading: '계약서 서명을 요청드립니다' ...} },
  { name: 'operator', ... },
  { name: 'urgent', ... },
];
```
스크립트는 `buildEmailLayout` 입력 샘플 3개만 직접 적어 두고 실제 빌더를 호출하지 않는다. 크론 실패 알림(긴 사유 블록)·점검 리포트(긴급+일반 혼합)·후기 요청 메일은 별도로 샘플을 적어야만 볼 수 있다. 영문 로케일·hero·blocks는 layout.test.ts가 단위 테스트로 덮는다 — 눈으로 본 적이 없다는 뜻이지 검증이 없다는 뜻이 아니다.

개발 도구 편의. 시각 확인 기회만 줄어든다.

**수정**: samples에 `buildOperatorAlertHtml`(긴 reason·preformatted 포함), `buildHealthReportHtml`(high+medium 혼합), `buildReviewRequestEmail`(샘플 후보)의 html과 locale 'en'·hero·blocks 샘플을 추가한다. 세 모듈은 tsx로 환경변수 없이 import됨을 확인했다(getDb는 지연 생성). 출력 경로는 그대로 둔다(os.tmpdir() 변경은 효과 없음).

비고: 검증자가 바로잡은 요지 — "규칙을 지킬 수 없다"는 과장. 도구 편의 수준이라 P3.

#### OPS-28. 소셜 토큰 갱신 fetch에 타임아웃이 없어 Meta 지연 시 실패 메일 없이 함수가 잘린다 [P3 · S]
`lib/social/tokens.ts:59`(fetch)·`:75`(catch)·`:80-83`(refreshAll 직렬), `pages/api/cron/social-refresh.ts:19`(maxDuration 30), `lib/social/tokens.integration.test.ts`. 선례: `lib/booking/gcal.ts`·`lib/booking/toss.ts`의 `AbortSignal.timeout`.

```ts
const res = await fetch(`${url}?${params}`);   // 59행: signal 없음
...
export const needsAttention = (o: RefreshOutcome): boolean =>
  o.status === 'missing' || o.status === 'expired' || o.status === 'failed';
```
`refreshPlatform`의 fetch에 AbortSignal이 없고 크론 maxDuration이 30초라, Meta가 응답하지 않으면 catch(75행)가 실행되기 전에 함수가 잘려 'failed' 알림이 나가지 않는다. 두 플랫폼이 직렬이라 ig가 멈추면 threads도 갱신되지 않는다.

Meta 장애가 여러 주 이어질 때만 알림 없이 만료에 다가간다. 만료 21일 전부터 주 1회 시도라 3~4번의 기회가 있어 현실적 가능성이 낮다.

**수정**: fetch 호출에 `signal: AbortSignal.timeout(8000)`을 추가한다(gcal.ts 방식). 타임아웃은 기존 catch가 status 'failed'로 바꿔 알림 메일로 이어진다. `missing` 경보(docs/social/README.md:53이 명시한 설계)와 `SOCIAL_PLATFORMS_DISABLED` 같은 새 env는 들이지 않는다 — Instagram·Threads 둘 다 발행하는 구성이라 한 플랫폼을 일부러 안 쓰는 상황이 없다.

비고: 검증자가 바로잡은 요지 — "missing → 매주 경보" 갈래는 근거 없어 버림. CLAUDE.md "단순하게".

#### OPS-29. 월 1회 파기 크론은 실패한 달에 다음 실행까지 한 달을 기다린다 (처리방침 '늦어도 한 달 안'을 넘길 수 있다) [P3 · S]
`vercel.json:6-17`, `pages/api/cron/purge-contracts.ts:45·72`, `pages/api/cron/purge-funding.ts:120`, `pages/api/cron/purge-orders.ts:167`(실패 메일), `data/privacyPolicy.ts:314`(15항)·`:368-376`(18항), `tests/pages/privacy-policy.test.tsx:180`, `docs/social/README.md:50`(curl 수동 실행 선례).

```json
{ "path": "/api/cron/purge-contracts", "schedule": "0 18 1 * *" },
{ "path": "/api/cron/purge-funding", "schedule": "0 18 2 * *" },
{ "path": "/api/cron/purge-orders", "schedule": "0 18 3 * *" },
```
세 파기 크론은 월 1회이고 한 번 실패하면 다음 실행은 한 달 뒤다. 월 1회 주기는 처리방침에 공개된 약속이다("월 1회 자동으로 도는 정리 작업", "파기 요건을 갖춘 날로부터 늦어도 한 달 안에 지워집니다" — 테스트가 문구를 단언). 그 문구는 정상 실행을 전제한다. 실패한 달에는 파기가 최대 두 달까지 밀린다. 세 크론 모두 실패 메일이 나가고 멱등이라 수동 재실행이 가능하지만, 실패 메일에 재실행 방법이 없다.

일시적 DB·Blob 오류가 난 달에 한해 고지한 기간을 넘겨 개인정보가 남는다. 운영자는 실패 메일을 받으므로 대응 가능한 경우에만 해당한다. 법정 기한과의 관계는 확인하지 못했다.

**수정**: 주기는 바꾸지 않는다 — 바꾸면 처리방침 문구 수정이 따르고, 처리방침 ko 전체가 FUNDING_TERMS_VERSION 해시 대상이라 판본 상향과 기준선 갱신이 따라온다. 대신 세 파기 크론의 실패 메일 hints와 CLAUDE.md에 `curl -H "Authorization: Bearer $CRON_SECRET" https://studionol.co.kr/api/cron/purge-<대상>` 수동 재실행 한 줄을 넣어, 실패한 달에 운영자가 바로 다시 돌리게 한다. 주기 단축은 법무 확인 후 처리방침·판본과 함께 별도 변경으로 다룬다.

비고: 검증자가 바로잡은 요지 — 원 수정안(주 1회)은 처리방침 약속과 판본 게이트를 건드리는데 이를 빠뜨렸다. 같은 자리를 다른 축(PERF 성능·번들·서버 비용)도 지적: "함수 리전 미지정(iad1 기본값) — 한국 사용자·토스·도쿄 Turso 모두에서 가장 먼 곳에서 돌아 동적 경로 TTFB가 2~10배 늘어난다".

**클린 판정**
- lib/cron/auth.ts — CRON_SECRET 미설정 fail-closed, SHA-256 고정 길이 + timingSafeEqual 비교는 맞다(2026-08-24 리뷰 #18 처리됨). 개선은 불일치 시 로그 한 줄뿐(OPS-4).
- lib/email/inboundWebhook.ts의 svix 서명 검증 — 원문 바디, 5분 허용오차, 다중 v1 서명, 길이 동일 확인 후 timingSafeEqual. 문제 없음.
- lib/email/layout.ts의 escape 구조 — heading·rows·cta는 레이아웃이 escape하고, 소스 스캔(paragraphs/notices/blocks 안 보간)에서 호출부 미escape 값은 찾지 못했다. pages/api/contact/send-email.ts·lib/contact/emailContent.ts의 사용자 입력(이름·메시지·UTM·referrer)도 모두 escape된다.
- lib/email/operatorAlert.ts — 사유·요약 escape, preformatted 블록, 딥링크 기본값. 구조 문제 없음(기본 CTA가 프로젝트 첫 화면이라는 점만 P3 성격).
- pages/api/cron/purge-funding.ts·purge-orders.ts의 파기 단계 격리(run() 패턴), 실패 시 500+메일+alert.ok 확인, 성공/null 구분 응답 — 의도대로이고 tests/api/cron 두 파일이 구조를 고정한다.
- lib/reviews/reviewRequests.ts의 기록 먼저 쓰기(onConflictDoNothing claim), KST 날짜 기준 '다음 날' 창, 7일 상한, 이메일 대소문자 무시 쿨다운, 운영자 주소·연습실·smoke-test 제외, REVIEW_REQUEST_ELIGIBLE_FROM 가드. 일시 오류 되돌림 설계도 문서와 일치(개선점은 OPS-13의 분류·예외 안전성).
- pages/api/cron/review-requests.ts·expire-show-orders.ts의 통째 실패 시 운영자 메일과 alert.ok 확인.
- lib/billing/service.ts의 claimDueSubscription(CAS로 1초 앞당김)과 chargeCycle의 INSERT-먼저 이중청구 방어 — billing-charge의 겹침 실행 방어는 타당하다.
- lib/contracts/backup.ts의 '백업 쓰기 실패 시 만료 백업을 지우지 않는다' 순서와 서명 토큰 제외 — 의도대로 구현돼 있다(개선점은 OPS-19의 삭제 실패 집계).
- lib/booking/gcal.ts fetchBusyRanges의 8초 타임아웃과 health-check의 캘린더별 개별 try/catch.
- lib/ops/notificationSentinel.ts — 센티널과 실패 사유의 구분, db·네트워크 미import(클라이언트 번들 안전).
- lib/ops/healthCheck.ts의 개별 점검 판정식 자체(필드 키 왕복 점검의 값 비노출, 회전 대기 접두사 비교, 정산 드리프트의 pending만 보기, 취소 회차 환불 계좌 미접수 등)는 주석이 말하는 대로 구현돼 있고 healthCheck.integration.test.ts가 촘촘히 고정한다. 문제는 점검 사이의 격리(OPS-3)·반복 경보(OPS-8·OPS-15)에 있다.
- lib/social/mediaPath.ts — 단일 세그먼트·문자 집합·.jpg·접두사 강제로 계약서 Blob 유출 경로 차단.
- lib/payments/methodAlert.ts·lib/funding/downloadAlert.ts — 하루 한 통 레이트리밋, 3초 예산, throw 금지, 응답 본문 비노출. 결제 경로를 막지 않는 설계가 일관된다.
- pages/api/contact/send-email.ts — 허니팟/너무 빠른 제출 로그, origin 검사, 레이트리밋, 오류 코드별 상태 매핑.
- jest 실행: lib/email, lib/cron, lib/reviews, lib/ops/healthCheck.html·migrationDrift·leadRateCheck, tests/api/cron, tests/email — 11 suites / 99 tests 통과.

**읽지 못한 범위**
- lib/shows/email.ts·emailHtml.ts·emailEn.ts·refundMessages.ts, lib/funding/email.ts·reviewEmail.ts·creatorEmail.ts·payoutEmail.ts, lib/booking/email.ts·confirmDeposit.ts, lib/billing/email.ts의 고객용 본문(약 70종 메일 템플릿)은 sendEmail 호출부·결과 처리·escape 소스 스캔·회신 문구 위주로만 읽었고 문구·계산 정확성은 전수 확인하지 않았다.
- lib/billing/service.ts chargeCycle 본문(NETWORK_ERROR 대사), lib/shows/service.ts expireStaleShowOrders, lib/contracts/retention.ts, lib/privacy/orderRetention.ts 각 파기 함수의 내부 쿼리는 크론이 부르는 계약만 보고 내부는 읽지 않았다.
- lib/seo/gscAudit.ts·gscDiff.ts(gsc-audit 크론의 실제 감사·diff 로직)는 읽지 않았다. 크론 핸들러 관점만 평가했다.
- lib/ops/salesLedger.ts는 읽었으나 메일·크론과 무관해 판단하지 않았다(결제 장부 정확성은 별도 관점).
- 외부 사실 확인 필요(문서·계정 설정 접근 불가): Vercel 크론의 non-2xx 재시도 여부(OPS-18), Resend의 초당 2건 한도·Idempotency-Key 지원·40MB(base64 후) 한도(OPS-12·OPS-9), 계정 기본 함수 maxDuration(OPS-14), 운영 Vercel에 GA4 env 4개와 CRON_SECRET이 실제로 등록돼 있는지(OPS-4·OPS-22). 운영 DB·Vercel은 읽기 전용 지시에 따라 조회하지 않았다.
- lib/ops/*.integration.test.ts와 reviewRequests.integration.test.ts는 목록·제목 위주로만 훑었고, 제안한 회귀 테스트가 기존 픽스처와 충돌하는지는 실행해 보지 않았다.

**미검증 후보(overflow)**
- lib/email/operatorAlert.ts:11 — VERCEL_PROJECT_URL이 팀 슬러그(hwang-khs-projects)를 하드코딩한 프로젝트 첫 화면이라 '로그 보기' 버튼이 로그로 직행하지 않고, 팀명이 바뀌면 깨진다(P3).
- lib/ops/healthCheck.ts:673-687·1045-1059 — 계약 알림 실패/서명 기한 초과 항목이 고객 이름을 메일에 싣는다. 같은 파일의 정지 구독 경보(628행)는 '이름·연락처는 싣지 않는다'는 원칙을 적어 둬 기준이 갈린다(P3, 운영자 본인 수신함이라 영향은 작음).
- lib/ops/healthCheck.ts:978-991 — payout 드리프트 점검이 프로젝트마다 buildFundingPayoutPreview를 순차 호출(N+1). 주석이 인정한 부채이며 정산 기록이 수백 건이 되면 60초 예산을 먹는다(P3).
- lib/email/inboundWebhook.ts:80-93·pages/api/inbound/resend.ts:198 — 표시 이름이 없는 발신자(`hong@example.com`)는 displayName이 주소 자체가 되어 `from: "hong@example.com <hello@studionol.co.kr>"`로 나간다. 따옴표 없는 '@' 포함 phrase를 Resend가 거부하면 전달이 502로 반복 실패한다(확인 필요, 따옴표로 감싸고 "를 제거하는 한 줄 수정 권장, P3).
- pages/api/contact/send-email.ts:99-125 — 문의 폼은 메일이 실패하면 메시지가 어디에도 저장되지 않는다(502 후 사용자 재시도 의존). 상업 리드 채널이라 DB 기록 후 발송이 안전하다(P3, 범위 밖 설계 제안).
- pages/api/cron/billing-charge.ts:174-198 — 자동 재개 안내 루프에 claim이 없어 크론이 겹쳐 돌면 같은 고객에게 재개 안내가 두 통 갈 수 있다(P3, 청구 자체는 멱등).
- pages/api/cron/gsc-audit.ts:124 — shouldEmail이 상수 true인 죽은 변수. 삭제 대상(OPS-5에 포함).

### SCR. 운영 스크립트·도구

P0 0 · P1 2 · P2 6 · P3 21, 미검증 0 (중복 1건 병합 — optimizeAudio.js 지적 두 건을 SCR-5 하나로)

#### SCR-1. 만료 없는 운영 Turso rw 토큰이 .env.local과 백업 4개에 평문으로 있다 — CLAUDE.md는 '값이 없다'고 적혀 있어 가드가 없다 [P1 · M]

① `.env.local:23-24`, `.env.backup-2026-09-09.local`, `.env.local.bak-20260915-102349`, `.env.local.bak-20260923-181600`, `.env.local.bak-20260925-104501`, `CLAUDE.md:307`·`:322-323`, `drizzle.config.ts`, `lib/crypto/CLAUDE.md:71-99`

② `.env.local:23`의 `TURSO_DATABASE_URL`은 `libsql://studio-nol-…turso.io`(운영 DB)이고, `:24`의 `TURSO_AUTH_TOKEN` JWT 페이로드는 `{a:'rw', iat:2026-09-09T02:22Z, id, kid, rid}` — **exp 클레임이 없다.** 같은 토큰(sha 앞 8자 c5cf20b5)이 위 백업 4개에 그대로 있고 5개 파일 모두 `-rw-r--r--`다. `FUNDING_FIELD_KEY`(sha8 638841c3)도 `.env.local`과 `.bak-20260925`에 함께 있다. `node --env-file=.env.local`로 두 값이 실제로 로드된다. 한편 CLAUDE.md:307은 "`.env.local`에 TURSO_* 값이 없어 `url: undefined`로 멈춘다"고 적고, :322-323은 "토큰 기본값이 만료 없음이라 `-e 1d`를 반드시 붙인다"고 적는다.

③ 운영 DB(studio-nol) 읽기·쓰기 토큰이 영구 유효한 채로 5벌 흩어져 있고, 그 옆에 PII 복호화 키까지 있다. 이 사용자로 도는 모든 프로세스(서브에이전트·`npm postinstall`·동기화 도구)가 운영 DB를 영구히 읽고 쓰고 PII를 복호화할 수 있다. CLAUDE.md:307(2026-09-26 커밋 335174ffd5)은 쓰일 당시부터 거짓이었다 — `.bak-20260925`에 이미 값이 있다. 문서가 "안전하다"고 보증하는 상태가 실제로는 가장 위험한 상태다.

④ 토큰은 폐기 전까지 영구 유효하고 백업 파일은 누구도 관리하지 않는다. 운영 DB 전체(후원·결제·계약·고객 정보)의 기밀성·무결성이 이 사용자 계정의 모든 프로세스에 열려 있다. '같은 맥의 다른 사용자' 위협은 없다(홈 디렉터리 750, 사람 계정은 hwang-gyeongha 하나). 0644는 부차적이고 핵심은 '만료 없는 rw 토큰이 5벌'이다.

⑤ **수정**:
1. **회전은 전체 교체다.** `~/.turso/turso db tokens invalidate studio-nol`은 키를 돌려 **기존 토큰 전부**(Vercel 운영 env·GitHub Secret·로컬)를 무효화한다 — 토큰 단위 폐기가 없다. 그러므로 "새 토큰으로 배포 확인 뒤 옛 토큰만 폐기"는 불가능하다. 저트래픽 시간에 다음 순서로 한다: `invalidate` → 운영용 rw 토큰 새로 발급(Vercel env) → CI용 `--read-only -e 90d` 토큰(GitHub Secret) → 로컬용 `-e 30d` 토큰(`.env.local`) → Vercel env 교체 후 재배포(장애 수리 예외로 빌드 1회) → GitHub Secret 교체. 그 사이 몇 분은 운영 DB 접근이 끊긴다는 것을 알고 한다. CI 토큰은 90일마다 재발급해야 하며 만료되면 `check-migration-drift`가 main push마다 exit 1 한다(배포는 안 막힘).
2. 백업 4개(`.env.backup-2026-09-09.local`·`.env.local.bak-*`)를 지우고 `chmod 600 .env.local`.
3. `.env.local`의 TURSO_*는 **지우지 말고 만료 있는 토큰으로 바꾼다.** `lib/crypto/CLAUDE.md:71·78·85·98`의 키 회전 절차와 `scripts/backfill-digital-delivered.mjs:24-40`·`scripts/social/meta.mjs:2` 등이 `--env-file=.env.local`의 TURSO_*를 전제한다. 지우려면 그 문서·스크립트를 전부 같이 고쳐야 하고 wrapper 스크립트가 하나 더 생긴다('단순하게 만들 것').
4. CLAUDE.md:307을 실제 상태로 고친다: "`.env.local`의 TURSO_*는 로컬 작업용 단기 토큰이고, 운영 적용은 아래 절차로만 한다".

⑥ 검증자 정정: 원안의 "옛 토큰만 폐기" 순서는 Turso CLI에 그 기능이 없어 성립하지 않는다(위 1번이 정정된 절차). `.env.local`에서 TURSO_*를 지우는 안은 키 회전 문서·스크립트와 충돌해 철회. SCR-2와 같은 자리를 다른 각도에서 본다.

#### SCR-2. `npm run db:migrate`가 .env.local의 운영 토큰으로 가드 없이 운영 DB에 적용된다 — 문서는 '안 된다'고 적혀 있다 [P1 · M]

① `package.json:55`, `drizzle.config.ts`, `CLAUDE.md:296`·`:307`·'운영 DB 마이그레이션 적용 방법' 2단계, `lib/ops/migrationJournal.test.ts`, `scripts/check-migration-drift.mjs`

② `package.json:55`:
```json
"db:migrate": "node --env-file=.env.local node_modules/.bin/drizzle-kit migrate",
```
`drizzle.config.ts`는 env의 URL·토큰을 그대로 쓴다. `.env.local`에는 운영 studio-nol rw 토큰이 있으므로(SCR-1) 이 한 줄이 운영 DB에 적용된다. 브랜치 확인·대상 호스트 출력·적용 예정/건너뜀 목록 어느 것도 없다. `lib/ops/migrationJournal.test.ts`는 저널 파일의 when 단조성·idx 중복·SQL 존재·prevId 사슬만 보고, `check-migration-drift.mjs`·`lib/ops/migrationDrift.ts`는 사후 개수 비교다. CLAUDE.md:296은 "브랜치 체크아웃에서 `db:migrate`를 돌리지 마라"고 경고하지만 :307은 그 명령이 "이 맥에서 안 된다"고 단정한다.

③ 동작하는 위험한 명령을 무해하다고 적어 둔 상태다. 노출면은 `/Users/hwang-gyeongha/studio` 메인 체크아웃이 기능 브랜치에 가 있을 때다(체크아웃 공유, 2026-09-25 사고가 그 모양). 워크트리 4곳(studio-humanize·studio-wt-cardmsg·studio-wt-navshows·.claude/worktrees/agent-a048…)에는 `.env.local`이 없어 거기서는 `node --env-file`이 실패한다. 문서화된 적용 경로(`TURSO_*=$(turso …) npx drizzle-kit migrate`)도 브랜치 검사가 없다.

④ 메인 체크아웃이 브랜치에 가 있는 상태에서 `npm run db:migrate` 한 줄 → 브랜치의 큰 `when`이 운영 `max(created_at)`이 된다 → 뒤에 main으로 들어오는 더 작은 `when`은 영영 건너뛰어지고 `db:migrate`는 초록 → 관계 조회가 전체 컬럼을 SELECT하는 결제 확인 경로가 `no such column`으로 깨진다(0022·0035 절의 사고 모양, 0020에서 이미 한 번 났다).

⑤ **수정**: `scripts/db-migrate.mjs`를 만들어 `package.json`의 `db:migrate`를 그걸로 바꾸고, CLAUDE.md '운영 DB 마이그레이션 적용 방법' 2단계도 `npm run db:migrate`로 바꿔 **유일한 적용 경로**로 만든다. 스크립트 내용:
1. `git rev-parse --show-toplevel`이 메인 저장소이고, `git fetch origin main` 뒤 `HEAD == origin/main`이며 현재 브랜치가 main이 아니면 exit 1. 우회 플래그 없음.
2. 토큰은 env에서 읽지 않고 그 자리에서 만든다: `~/.turso/turso db show studio-nol --url`·`~/.turso/turso db tokens create studio-nol -e 1d`. `.env.local`의 TURSO_*를 쓰지 않으므로 exp 검사도 필요 없고, SCR-1의 "로컬엔 운영 토큰이 필요 없다"와 맞물린다.
3. `select created_at from __drizzle_migrations`와 저널 `when`을 대조해 **적용 예정 목록**과 **`when <= max(created_at)`라 조용히 건너뛰어질 목록**을 대상 호스트와 함께 출력한다. 건너뛰어질 항목이 있으면 exit 1, 없으면 `--yes` 없이는 멈춘다.
4. 통과하면 `drizzle-kit migrate`를 spawn.

최소안: `db:migrate`를 "CLAUDE.md 절차 참조"를 찍고 exit 1 하는 한 줄로 바꾸는 것만으로도 한 줄 사고는 막힌다.

⑥ 검증자 정정: '아무 브랜치·워크트리에서'는 과장 — 워크트리에는 `.env.local`이 없다. 원안이 문서화된 수동 경로(인라인 토큰 + `npx drizzle-kit migrate`)를 가드하지 못하던 것을 위 2번(스크립트가 1일 토큰을 직접 발급)으로 메웠다.

#### SCR-3. ctr-verdict·lead-verdict가 '수술 전 비율'을 오차 없는 상수로 두어 소표본에서 p값을 10~100배 과소 계산한다 [P2 · M]

① `scripts/ctr-verdict.mjs:152-158`·`:198-201`·`:93-98`, `scripts/lead-verdict.mjs:74`·`:80`·`:42-45`, `docs/ctr-surgery-log.md:237-238`·`:735-743`

② `ctr-verdict.mjs:152-158`:
```js
const expected = (beforeCtr / 100) * a.impressions;
...
const p = poissonTailP(expected, a.clicks);
const sig = p < 0.05;
if (deviation >= THRESHOLD && sig) label = `✅ 성공 (p=${p.toExponential(1)})`;
```
`lead-verdict.mjs:74`도 같은 구조: `const expected = a.sessions ? (a.leads / a.sessions) * b.sessions : 0; const v = verdict(b.leads, expected);`(양측 포아송). 대조군은 `ctr-verdict.mjs:198-201`에서 출력만 하고 판정에 쓰지 않는다.

③ 기대값 λ = 전 비율 × 후 노출(세션)을 고정하고 후 관측만 포아송으로 검정한다. 전 기간 클릭·리드가 한 자릿수면 그 추정치의 분산이 통째로 빠져 p가 크게 작아진다. 재계산: 전 3/600→후 12/900은 스크립트 p=2.4e-3인데 조건부 이항(N=15, p0=0.6) 1측 0.091·2측 0.186; 전 2/400→후 8/800은 0.051 vs 1측 0.299.

④ 장부의 실제 판정에 같은 검정을 대면 — vocal-doubling1 ❌(`:237`, 14/1465→7/1633, p=1.3e-2)는 조건부 이항 1측 0.059·2측 0.083으로 **유의하지 않아 판정이 뒤집힌다**. headvoice1 ✅(`:737`, p=5.0e-3)는 0.039/0.073, 8월 vocal-doubling1 ✅(`:736`, p=4.2e-4)는 0.036/0.057로 경계선. mixing15(`:735`)·practice-room-vocal-diction1(`:238`)은 어느 검정으로도 유의하다. lead-verdict 전후 모드도 같은 구조라 **10/13 예정 판정(recording-price1, 전 창 리드 2건/세션 207)이 같은 과신을 안고 돈다.** 지금까지의 실제 피해는 운영자가 대조군과 편차 임계를 함께 읽고 되돌리기를 보류해 왔으므로(`:256`) 판정 1건 뒤집힘·2건 경계선 수준이다.

⑤ **수정**:
- 두 스크립트의 포아송 함수를 **조건부 이항 검정**으로 바꾼다: 전 (k1,n1)·후 (k2,n2)에 대해 N=k1+k2, p0=n2/(n1+n2)로 k2~Binomial(N,p0)의 p를 lgamma 기반 pmf 합산으로 계산. 방향은 기존 ±20% 편차 임계와 같은 쪽 1측으로 두면 현 규칙과 일관(2측은 더 보수적), 어느 쪽인지 머리 주석에 적는다. λ>50 분기의 A&S 근사는 함께 없앤다.
- 대조군은 자동 '측정 무효'가 아니라 RR_t/RR_c(로그 정규근사 CI)와 "대조군 편차 ±20% 초과 — 보정해 읽을 것" 경고로 출력한다(장부 2026-09-15 운용과 일치).
- 검정 함수는 `scripts/lib/rateTest.mjs`로 뺀다 — 두 스크립트가 import 시점에 GSC/GA4 인증을 만들어(`ctr-verdict:93-98`, `lead-verdict:42-45`) 그대로는 테스트가 안 된다. `scripts/__tests__/rateTest.test.js`에 3/600→12/900(유의 아님)·2/400→8/800(유의 아님)·2/883→13/889(유의)를 넣는다.
- 장부 `:735-743`·`:237-238` 행의 p를 새 검정값으로 갱신하고 vocal-doubling1 ❌는 '➖ 변화없음'으로 정정한다.

⑥ 검증자 정정: P1→P2(되돌릴 수 있는 SEO 판정이고 운영자가 이미 대조군을 손으로 보정). 원안의 "대조군 편차 ±20% 넘으면 자동 무효"는 장부의 실제 운용과 충돌해 경고 출력으로 바꿨다. 10/13 판정 전에 고치는 것이 맞다.

#### SCR-4. funding-baseline --update가 이미 시작된 프로젝트의 리워드 id 삭제·금액 변경도 그대로 기준선에 반영한다 [P2 · M]

① `scripts/funding-baseline.ts:134-142`·`:64-71`, `content/funding.baseline.test.ts`, 비교 대상 `content/fundingImages.baseline.test.ts`·`content/fundingTerms.baseline.test.ts`

② `funding-baseline.ts:134-142`:
```ts
if (args.includes('--update')) {
  const payload: Baseline = { note: ..., entries: now };
  fs.writeFileSync(baselinePath, `${JSON.stringify(payload, null, 1)}\n`);
  ...
  return;
}
```
diff를 보지 않고 현재 파일 상태를 기준선으로 덮어쓴다. 같은 파일의 WHY 표(`:64-71`)가 'reward-removed'=재고 리셋, 'reward-amount-changed'=단가·환불 불일치라고 위험을 설명하고 있다. 같은 저장소의 fundingImages·fundingTerms 기준선은 갱신 경로 자체가 위반을 거부한다 — 이 기준선만 그렇지 않다.

③ 결제가 시작된 프로젝트에서 reward-removed·reward-amount-changed·reward-limit-changed·project-removed가 있어도 `--update` 한 명령으로 CI가 초록이 된다. 이 게이트가 막는 것(리워드 id 삭제로 재고 리셋, 금액 변경으로 후원 기록과 화면 불일치)은 돈과 직결된다.

④ 시작된 펀딩에서 이 갱신을 쓰면 한정 리워드 재고 집계가 리셋되거나(100개가 200개 판매) 후원 기록 단가와 화면이 어긋난다. 오용하려면 CI 실패 메시지의 '왜 위험한가'와 CLAUDE.md·`lib/funding/CLAUDE.md` 금지를 모두 무시해야 하므로 확률은 낮다. 반대로 합법적 사용례가 있다: 3482545852(2026-09-29)가 결제 시작(9/30) **전에** 사바하 펀딩의 리워드 id 삭제·금액 변경을 `--update`로 반영했고 커밋 메시지에 '결제 시작 전·운영 DB 후원 0건 확인'을 적었다.

⑤ **수정**: `--update` 때 diff를 계산해, 위 네 종류 위반이 있는데 해당 프로젝트 frontmatter의 `startAt`이 현재 시각 이전이면 거부한다. project-added·reward-added와 **시작 전 프로젝트의 편집은 허용**(3482545852 같은 사전 오픈 재구성 유지). 불가피한 예외만 `--allow-live <slug>` 명시 플래그로 연다. `content/funding.baseline.test.ts`에 '시작된 프로젝트의 reward-removed는 --update가 거부한다' 케이스를 넣는다. 나머지 세 기준선(cta-routing·dup-sections·unverified-claims)은 CLAUDE.md에 "의도한 변경이면 --update, 같은 커밋에 이유"로 문서화된 설계이고 돈 사고 경로가 아니므로 바꾸지 않는다.

⑥ 검증자 정정: 원안의 항목별 `--allow` 플래그 대신 `startAt` 경과 여부로 가르는 쪽이 CI에서 기계적으로 판정되고 사전 오픈 편집 사례를 그대로 허용한다. origin/main 기준선과 대조하는 안은 jest에 git 의존을 들이는 과한 기계라 철회.

#### SCR-5. scripts/optimizeAudio.js: 어디서도 호출되지 않는 파괴적 스크립트가 public/audio 전체를 원본째 128k로 재인코딩한다 (nodemon.json 잔재 포함) [P2 · S]

① `scripts/optimizeAudio.js:19-33`(전체 1-45), `nodemon.json`, CLAUDE.md '믹싱 전·후 비교 음원' 절, `scripts/build-mix-compare.mjs`

② `optimizeAudio.js:19-33`:
```js
execSync(`ffmpeg -i "${filePath}" -b:a 128k -map_metadata 0 -y "${tempPath}"`);
fs.renameSync(tempPath, filePath);
```
`../public/audio`를 재귀로 돌며 모든 `.mp3`에 적용한다. dry-run·백업·확인 없음. 저장소 전체 grep 참조 0건 — `package.json`·CI·hook·문서 어디에도 연결돼 있지 않고 최초 커밋 960b5514b9 이후 쓰이지 않았다. `nodemon.json`은 `{"ignore": ["db.json"]}` 하나인데 루트에 `db.json`이 없고 `package.json`·`package-lock.json`에 nodemon이 0건이다(initial commit 이후 무변경).

③ CLAUDE.md는 "믹싱 후는 포트폴리오 원본 음량 그대로", "발췌는 256k(0.01dB 안쪽)", "128k로 다시 인코딩하면 원본이 0.5dB 작아지므로"라고 못 박았다. ffprobe 실측: 30초 발췌 4개(`mix-compare-*-excerpt`, `excerpt-*-20261006`)는 256k라 128k로 낮아져 그 결정이 깨지고, `funding/*.mp3` 2개는 192k→128k, 나머지(`wave.mp3`·`mix-compare-*-20261001c`·`sample`·`jai-fever`)는 이미 128k라 재실행마다 세대 손실과 미세한 음량 변화가 생긴다.

④ 누군가(특히 `scripts/`를 훑는 에이전트) '오디오 최적화'를 하려고 이 파일을 실행하면 믹싱 전·후 비교 음원과 포트폴리오 음원이 조용히 열화되고 A/B 음량 일치(0.03dB)가 깨진 채 커밋된다. 복구는 `git checkout -- public/audio`로 가능하고 지금까지 실행된 흔적은 없다.

⑤ **수정**: `scripts/optimizeAudio.js`와 `nodemon.json`을 삭제한다(둘 다 참조 0건, git 이력에 남는다). 정말 필요해지면 `execFileSync` 인자 배열·`--dry-run` 기본·`--apply`·이미 128k 이하인 파일 건너뛰기·`*-excerpt*`·`mix-compare-*` 제외를 갖춘 버전으로 새로 쓴다. `audit-full.js`(접근성·모범사례·SEO — `pagespeed-audit.js`의 하위 집합이 아니라 보완 도구)·`wait-and-measure.sh`(SCR-22)·`test-turso.mjs`는 쓰는지 운영자 확인 전까지 남긴다. `scripts/README.md` 색인 표와 archive 파일 개조(throw 삽입)는 만들지 않는다 — 머리 주석·CLAUDE.md·`archive/README.md`가 이미 그 역할을 하고, archive 36개 중 `.py` 12개는 throw로 못 덮는다. lint 범위에서 archive를 빼는 것(`.eslintrc.json` `ignorePatterns: ['scripts/archive/**']`)은 실측 1.9초·경고 6건이라 필수가 아니다.

⑥ 두 지적을 병합했다(같은 파일, 하나는 P2 confirmed·하나는 P3 adjusted — 높은 쪽으로). 셸 주입 언급은 대상 파일명이 저장소 내부 파일이라 비현실적. "audit-full.js 삭제" 원안은 하위 집합이라는 전제가 틀려(`pagespeed-audit.js:118,128`은 performance만 요청) 철회.

#### SCR-6. GA4 원시 수집이 행 상한(landing 500·llm_referrers 100·device 50)에서 조용히 잘린다 [P2 · M]

① `scripts/ga4-fetch.mjs:139-148`(runReport)·`:171`·`:239`·`:266`·`:326`, `docs/ga4-raw/landing.csv`·`llm_referrers.csv`·`device.csv`

② `ga4-fetch.mjs:171` `limit: 500,`(landing), `:239`·`:266` `limit: 100,`, `:326` `limit: 50,`. runReport(`:140-148`)는 `return res.data.rows || [];`만 돌려주고 `rowCount` 확인·페이지네이션이 없다. `wc -l` 결과: `landing.csv` 500, `llm_referrers.csv` 100, `device.csv` 50 — writecsv가 끝 개행을 안 붙여 헤더 + 정확히 상한 행이다. `landing.csv` 마지막 행은 세션 6의 롱테일이라 실제로 잘렸다.

③ 조회 결과가 limit에서 잘려도 아무 표시가 없다. 합계·비중·롱테일을 이 CSV로 내면 과소집계된다.

④ LLM 유입(GEO) 분석은 100행 상한에서 꼬리가 사라지고, 랜딩 기준 합계·비중은 세션 6 이하 롱테일이 통째로 빠진다.

⑤ **수정**: `runReport`에서 `res.data.rowCount`와 반환 행 수를 비교해 잘리면 경고를 찍고, `offset` 페이지네이션으로 `rowCount`까지 모은다. `_meta.json`(조회 창 기록)과 locale 열은 선택 사항 — `seo-preflight.mjs:200`이 '90일 롤링 창 스냅샷'을 경고하고 갱신 커밋 메시지가 날짜를 싣고 있어 이미 완화돼 있다.

⑥ 검증자 정정: 조회 창 메타 부재·GSC slug 열·`dateRange(90)`이 91일인 점은 분석에 영향이 없어 제외. 가치 있는 수정은 rowCount 대조 경고 + 페이지네이션 한 가지다.

#### SCR-7. hash-password.mjs: 공개 저장소에 박히는 scrypt 해시인데 비밀번호 강도를 검사하지 않고 argv로 받는다 [P2 · S]

① `scripts/press/hash-password.mjs:9-18`, `lib/press/listeningRoom.ts:28-29`(`SCRYPT_PARAMS`), `pages/api/press/.../enter.ts:41`

② `hash-password.mjs:11-17`:
```js
const password = process.argv[2];
if (!password) { ...usage...; process.exit(1); }
const salt = randomBytes(16).toString('base64url');
const hash = scryptSync(password.trim().normalize('NFC'), salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('base64url');
```
길이·엔트로피 검사 없이 아무 문자열이나 받는다. 해시·솔트는 공개 저장소의 `lib/press/listeningRoom.ts:28-29`에 커밋된다(머리 주석: "저장소가 공개라 원문은 어디에도 커밋하지 않는다").

③ 해시와 솔트가 공개되어 누구나 오프라인으로 추측 공격을 한다. 앱의 요청 제한(`enter.ts:41`, IP당 15분 10회)과 쿠키 서명은 온라인 시도만 막는다. 이 맥에서 해시 1회가 약 68ms(CPU)라 사람이 고른 짧은 문구에는 충분히 빠르다. 매체·평론가에게 전달해야 하니 기억하기 쉬운 문구를 고를 유인이 있는데, 도구가 아무것도 막지 않는다.

④ 발매 전 음원이 든 감상실의 방어선이 비밀번호 추측 난이도 하나뿐이다. 약한 비밀번호가 선택되면 공개 저장소에서 해시를 긁어 오프라인으로 깬 뒤 정상 입장한다.

⑤ **수정**: `--generate`를 기본 경로로 만든다 — `randomBytes(15).toString('base64url')`(20자, 120비트)로 비밀번호를 만들어 한 번만 stderr로 보여 주고 해시를 stdout에 출력. 직접 입력을 허용한다면 argv 대신 stdin/프롬프트에서 읽고 16자 미만이면 거부. N을 2^17로 올리는 건 `lib/press/listeningRoom.ts`의 `SCRYPT_PARAMS`·`maxmem`과 함께만(2^17은 128MB라 64MB 상한을 같이 올려야 하고 서버리스 메모리 한도 확인 필요). 한 파일 안에서 끝나는 변경이다.

⑥ 현재 배포된 해시의 원 비밀번호 강도는 일부러 검증(크래킹)하지 않았다. 약한 문구였다면 도구 수정과 별개로 새 비밀번호로 해시를 교체할 것(교체하면 기존 입장 쿠키도 풀리도록 이미 설계돼 있다). argv가 셸 히스토리·`ps`에 남는 문제는 단일 사용자 맥에서는 부차적.

#### SCR-8. snapshot --out이 빈 문자열·`.`·`..`이면 저장소 루트를 rmSync(recursive)로 통째로 지운다 [P2 · S]

① `scripts/visual/golden-html.mjs:78-82`·`:154-159`, 참고 `scripts/visual/screenshots.mjs`

② `golden-html.mjs:154-159`:
```js
const opt = (name) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : undefined; };
if (cmd === 'snapshot') {
  snapshot(path.resolve(opt('out') ?? '.visual/golden/current'));
```
`:81` `fs.rmSync(outDir, { recursive: true, force: true });`. `??`는 undefined만 걸러 낸다. `--out ""`(빈 셸 변수, 예: `--out "$DIR"`에서 $DIR이 비었을 때)·`--out .`·`--out ..`는 `path.resolve` 결과가 ROOT 또는 그 상위다. `:78`의 `.next/server/pages` 존재 검사는 rmSync 앞에 있지만 빌드 산출물만 있으면 통과한다.

③ 검증자가 스크래치패드 모형(`.env.local`과 하위 디렉터리가 있는 폴더)에서 같은 코드를 돌려 cwd 전체가 사라지는 것을 재현했다. 빠지는 것은 작업 트리만이 아니다 — `.git`, gitignore된 `.env.local`(Vercel Sensitive 값은 `vercel env pull`로 못 되살린다), 동시 세션의 미커밋 변경이 함께 사라진다. 어느 층도 막지 않는다.

④ 정상 사용례(`visual:golden` 인자 없이, 문서의 `.visual/golden/...`)에서는 발생하지 않고 사람·에이전트의 수동 인자 실수에서만 발생한다. 확률은 낮지만 피해가 복구 불가라 P3보다 한 단계 올렸다.

⑤ **수정**: `snapshot()` 맨 앞, rmSync 전에:
```js
const rel = path.relative(path.join(ROOT, '.visual'), outDir);
if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
  console.error('--out은 .visual/ 하위 디렉터리여야 한다');
  process.exit(2);
}
```
빈 문자열은 `opt('out') || default`로 처리하거나 위 검사가 막게 둔다. '.visual/ 하위만 허용'은 CLAUDE.md의 `.visual/` gitignore 규약과 맞는다. manifest.json 검사를 넣는다면 첫 실행(디렉터리 없음)과 충돌하지 않게 '존재하면'으로 한정한다. `screenshots.mjs`는 mkdir만 하고 삭제하지 않아 영향권이 아니다.

⑥ 이미 고쳐진 흔적 없음(`golden-html.mjs` 이력은 8b553b756a 한 건).

#### SCR-9. publish 직후 permalink 조회가 실패하면 올라간 글이 원장에 남지 않아 재실행 시 중복 발행된다 [P3 · S]

① `scripts/social/post.mjs:134-180`(핵심 `:135-137`·`:178-179`), `docs/social/README.md`, `docs/social/posted.json`(untracked)

② `post.mjs:135-137`:
```js
const { id } = await graph('ig', 'POST', `/${userId}/media_publish`, ...);
const { permalink } = await graph('ig', 'GET', `/${id}`, { fields: 'permalink' });
return { id, permalink };
```
`:178-179` `ledger[item.key] = {...}; writeLedger(ledger);`는 성공 반환 뒤에만 기록한다. `publishThreads`도 같은 구조. 원장 `docs/social/posted.json`은 git status에 `??`로 뜨고 `git log --all`에 없다 — 설계상 로컬 상태(spec `2026-09-08-social-api-design.md:28`·README 모두 커밋을 요구하지 않음).

③ `media_publish`/`threads_publish`가 id를 돌려준 뒤 permalink GET 한 번이 네트워크 오류·rate limit으로 던지면, 게시물은 이미 공개됐는데 catch로 빠져 원장에 아무것도 안 남는다. 같은 슬러그를 다시 실행하면 한 번 더 올라간다.

④ 확률 낮음(원장의 유일한 기록은 둘 다 성공). 발생하면 인스타·스레드에 같은 글이 두 번 올라가 운영자가 수동 삭제한다. 돈·데이터 손상 없음.

⑤ **수정**: publish 응답에서 id를 받는 즉시 원장에 `{id, at}`을 기록하고, permalink 조회는 별도 try/catch로 감싸 실패하면 permalink 없이 성공으로 처리한다(몇 줄). 원장 커밋·Turso 이전은 하지 않는다 — main이 PR 경유라 발행마다 PR이 필요해지고, Turso 표는 수동 마이그레이션 부채를 새로 만든다. README에 '원장은 로컬 파일, `git clean` 하지 말 것' 한 줄.

⑥ 검증자 정정: '원장 untracked'는 결함이 아니라 설계이고, '다른 워크트리·다른 맥에서 중복' 시나리오는 발행 CLI가 `.env.local`이 있는 메인 체크아웃에서만 돌아 현실성이 낮다.

#### SCR-10. CI 드리프트 탐지가 시크릿이 없을 때 초록으로 통과하고, 안내문이 안 되는 절차를 가리킨다 [P3 · M]

① `scripts/check-migration-drift.mjs:24-30`·`:63`·`:68`, `lib/ops/healthCheck.ts:367`, `.github/workflows/ci.yml:63-66`·`:79-80`, CLAUDE.md '운영 DB 마이그레이션 적용 방법'

② `check-migration-drift.mjs:24-30`:
```js
if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
  console.log('... 건너뜁니다 (GitHub Secrets에 등록되기 전까지는 정상 skip입니다).');
  process.exit(0);
}
```
`:68` 실패 메시지 `` `npm run db:migrate`로 지금 바로 적용해 주세요. ``, `healthCheck.ts:367` 메일 문구도 같다. `ci.yml:79-80`은 "두 값이 사라지면 스크립트가 unknown으로 끝난다"고만 쓴다.

③ 시크릿은 2026-09-23에 등록됐으므로 '등록 전 정상 skip'은 옛 전제다 — 이제 skip이면 이상 상태인데 초록이다. 안내문의 `npm run db:migrate`는 CLAUDE.md의 적용 절차(Turso CLI, 1일 토큰, main 병합본)와 어긋난다(SCR-2가 그 명령을 유일 경로로 바꾸면 다시 맞게 된다).

④ 시크릿이 삭제·이름 변경되면 CI 탐지기는 조용히 초록이 된다. 다만 이 잡은 스스로 '탐지기일 뿐, 진짜 방어선은 `lib/ops/healthCheck.ts`의 매일 크론'이라고 밝히고(`:11-14`, `ci.yml:63-66`) 그 크론은 운영 env로 실제 판정한다(`healthCheck.ts:357-369`). 안내문을 그대로 따르면 막힌다.

⑤ **수정**: ① `process.env.GITHUB_ACTIONS === 'true'`일 때 시크릿이 없으면 exit 1(스킵 문구와 `ci.yml` 주석도 정리). ② 스크립트 `:68`과 `healthCheck.ts:367`의 안내 문구를 CLAUDE.md 절차(또는 SCR-2 이후의 가드된 `npm run db:migrate`)로 바꾼다. CJS 코어 추출·읽기 전용 토큰 발급·when 집합 대조는 하지 않는다 — when 함정은 `migrationJournal.test.ts`(저널 when 엄격 증가)와 개수 비교가 이미 덮고, 틀리는 것은 이름뿐이며 CLAUDE.md가 '개수가 어긋나면 when과 created_at을 직접 대조하라'고 안내한다.

⑥ 같은 자리를 다른 축(TST 테스트·CI·빌드 파이프라인)도 지적: "migration-drift 잡: CI main push에서 시크릿이 없으면 초록으로 skip한다 (ci.yml 주석과 불일치)". 검증자 정정: 'when 함정 미방어'·'판정 로직 두 벌' 지적은 기존 층이 덮고 있어 조치 대상에서 제외.

#### SCR-11. CI가 generate:manifests로 storyListing을 먼저 덮어써 storyListing.check 가드가 CI에서 항상 통과한다 [P3 · S]

① `.github/workflows/ci.yml:32-33`·`:53-54`, `package.json:48`(`generate:manifests`), `lib/storyListing.check.test.js`, `scripts/generate-story-listing.js:327-334`

② `ci.yml:32-33` `- name: Generate build manifests / run: npm run generate:manifests` → `package.json:48` `"generate:manifests": "node scripts/generate-portfolio-meta.js && node scripts/generate-story-catalog.js && node scripts/generate-story-listing.js"`가 `lib/storyListing/*.json`을 덮어쓴다(`generate-story-listing.js:327-334` writeOutput) → `:53-54` `npm test` 안의 `storyListing.check.test.js`가 `execFileSync(process.execPath, ['scripts/generate-story-listing.js', '--check'])`로 방금 쓴 파일과 현재 콘텐츠를 비교한다.

③ `--check`가 자기 자신과 비교하므로 항상 통과한다. '재생성 커밋 누락을 잡는다'는 테스트 주석의 보증이 CI에는 없다. story-listing이 `generate:manifests`에 들어간 c12ca28d82(2026-08-24)부터 이 상태다.

④ 낡은 `lib/storyListing`이 main에 들어가도 CI는 초록. 다만 Vercel 빌드는 prebuild에서 재생성하므로 프로덕션은 낡은 목록을 서빙하지 않고, `.githooks/pre-commit`(30fc49a4ff, #515)이 1차 방어다. 지금 커밋본은 최신(`--check` 'story-listing OK'). 실피해는 로컬 `next dev`·리뷰 diff 가독성에 한정.

⑤ **수정**: `ci.yml`에서 'Generate build manifests' 스텝 **바로 앞**에 `node scripts/generate-story-listing.js --check` 한 스텝을 추가한다. 이 모드는 portfolio-meta·story-catalog 산출물이 필요 없고 의존은 `content/stories`·lib JSON뿐이다. `utils/imageMetadata.json` 대조는 별개 문제(Build 스텝의 prebuild optimizeImages가 쓴다)라 같이 묶지 않는다.

⑥ 검증자 정정: 원안의 'generate:manifests 뒤 `git diff --exit-code`'는 imageMetadata.json을 못 잡아 철회. SCR-25(pre-commit 훅)와 함께 읽을 것.

#### SCR-12. --from-log가 장부가 부적격으로 지정한 대조군 3개를 기본 대조군 행으로 출력한다 [P3 · S]

① `scripts/ctr-verdict.mjs:45`·`:225`·`:195-198`·머리 주석 `:8-9`, `scripts/seo-preflight.mjs:194-197`, `docs/ctr-surgery-log.md:259-260`·`:945-958`

② `ctr-verdict.mjs:45`:
```js
const DEFAULT_CONTROL = ['producer1', 'daw-choice1', 'practice-room-monthly1'];
```
`:225` `await judgeGroup(g, control.length ? control : DEFAULT_CONTROL);`. 프리플라이트 `:194-197`는 "장부가 2026-09-11에 부적격으로 지정한 셋이다(practice-room-monthly1은 9/15부터 자기도 실험 중). 그대로 읽으면 판정이 뒤집힌다 — 2026-09-24 highnote1이 실제로 그랬다"고 경고하는데 스크립트는 그대로다. 머리 주석 `:8-9`의 수동 예시도 `producer1,daw-choice1`을 `--control`로 쓴다.

③ 판정 라벨은 `judge()`가 처치군 전후 노출·클릭만으로 계산하고 대조군은 쓰지 않는다. 대조군은 `:195-198`에서 '측정 유효성 확인' 행으로 출력될 뿐이다 — 그래서 문제는 '보정이 틀린다'가 아니라 **사람이 부적격 대조군 행을 읽고 오판한다**이다(highnote1 사례가 그것).

④ 판정 라벨은 정확하고 해석 단계의 오독 위험만 있다. highnote1에서 한 번 뒤집혀 보였으나 계열 대조군으로 다시 읽어 바로잡혔다.

⑤ **수정**: `DEFAULT_CONTROL`을 빈 배열로 바꾸고, `--control`이 없으면 대조군 행 대신 "대조군 미지정 — 처치군과 같은 주제 계열을 --control로 지정해야 사이트 전체 변동을 뺄 수 있다" 한 줄을 출력한다(exit 1은 쓰지 않는다 — `--from-log`는 장부가 '기본 동선'이라 부르고 그룹마다 주제 계열이 달라 단일 `--control`은 어차피 부적절). 머리 주석 예시의 `--control` 값도 계열 슬러그로 바꾼다. 장부 표 열 추가는 하지 않는다(`cells[인덱스]` 파싱을 건드린다).

⑥ 검증자 정정: '대조군 보정이 틀린 채 성공/무효가 출력된다'는 틀림 — 대조군은 판정에 쓰이지 않는다. SCR-3이 대조군 출력을 RR 비율비로 바꾸면 이 항목도 함께 손본다.

#### SCR-13. --match-to-after on을 빼면 운영 기준이 아닌(폐기된) 음량 맞춤 경로로 조용히 진행한다 [P3 · S]

① `scripts/build-mix-compare.mjs:79`·`:107-113`·머리 주석 `:20-25`·`:30`, `data/mixCompare.ts`, CLAUDE.md '믹싱 전·후 비교 음원' 절

② `:79` `const matchToAfter = args['match-to-after'] === 'on';` → `:107-113`:
```js
} else {
  const target = Math.min(lb, la);
  gainAfter = target - la;
  ...
```
머리 주석 `:23-25`: "옵션 없이 돌리면 큰 쪽을 작은 쪽에 맞춰 내리는 옛 방식이 되는데, 운영에는 쓰지 않는다." CLAUDE.md도 "`--match-to-after on` 필수".

③ 운영 기준은 '믹싱 후는 원본 음량 그대로, 믹싱 전만 올린다'(2026-10-01 운영자 결정)인데 코드 기본값은 폐기된 경로이고 경고가 없다.

④ 플래그를 빼먹고 돌리면 믹싱 후 음원이 내려간 채 만들어져 의도와 다른 비교 음원이 생긴다. 산출물은 git 추적 대상이라 커밋·리뷰 전에는 공개되지 않는다.

⑤ **수정**: `match-to-after`를 기본 on으로 두고, 옛 방식은 `--legacy-lower-after` 같은 명시 플래그가 있을 때만 허용한다(없으면 현재 else 분기를 die). 태그 중복 차단·tmp finally·루트 경로 변경은 하지 않는다. 스크립트 머리 주석(`:30`)·`data/mixCompare.ts`·CLAUDE.md의 "/audio도 오래 캐시되므로 태그를 바꿔라"는 문구는 실제 헤더에 맞게 고친다 — `curl -I https://studionol.co.kr/audio/mix-compare-after-20261001c.mp3`는 `cache-control: public, max-age=0, must-revalidate` + ETag를 돌려주고 `next.config.mjs`에는 `/audio` immutable 규칙이 없다(`/images`·`/fonts`만 `:218-231`).

⑥ 검증자 정정: '같은 태그 덮어쓰기가 위험'이라는 전제는 실제 응답 헤더와 달라 철회. 임시 WAV 잔존(`:53` mkdtemp, `:152` rmSync가 finally 밖)은 os.tmpdir이라 OS가 정리.

#### SCR-14. 테스트 실행이 프리플라이트 스탬프를 갱신하고, 워크트리에서는 스탬프가 기록되지 않는다 [P3 · S]

① `scripts/seo-preflight.mjs:219-225`(`:222`), `scripts/seo-preflight.test.ts:22-27`, `.claude/settings.json`(PostToolUse 훅)

② `:222` `fs.writeFileSync(path.join(ROOT, '.git/seo-preflight-stamp'), `${TODAY}\n`);` — `--today` 여부와 무관. `seo-preflight.test.ts:22-27`가 `execFileSync('node', [SCRIPT, '--today', today])`로 실행한다. 훅은 `find "$STAMP" -mmin -360`으로 6시간 이내 mtime만 본다. 워크트리의 `.git`은 76바이트 파일(`gitdir: /Users/hwang-gyeongha/studio/.git/worktrees/agent-...`)이다.

③ jest만 돌려도 '프리플라이트를 읽었다'는 기록이 된다(거짓 음성 6시간). 워크트리에서는 `.git`이 파일이라 쓰기가 ENOTDIR로 삼켜지고 훅도 `${CLAUDE_PROJECT_DIR}/.git/...`만 봐서 프리플라이트를 실행해도 경고가 계속 뜬다(거짓 양성). 워크트리에도 `docs/gsc-raw`가 있어 그 경로가 실제로 탄다.

④ 이 훅은 PostToolUse additionalContext 한 줄을 붙이는 권고이지 강제 장치가 아니다. 거짓 음성이 되려면 로컬에서 jest를 돌린 6시간 안에 원시 데이터를 프리플라이트 없이 읽어야 하고, CLAUDE.md SEO 절이 같은 지시를 따로 준다. 데이터·돈 영향 없음.

⑤ **수정**: ① `--today`가 주어졌거나 `process.env.JEST_WORKER_ID`가 있으면 스탬프를 쓰지 않는다. ② 스탬프 경로를 `git rev-parse --git-path seo-preflight-stamp`로 구해 스크립트와 훅 양쪽에 적용한다(워크트리별 gitdir에 기록됨). JSON 스탬프는 필요 없다.

⑥ 검증자 정정: '강제 장치 우회'는 표현 과장 — 권고 훅이다.

#### SCR-15. 회전 스크립트가 대상 DB 호스트를 출력하지 않는다 [P3 · S]

① `scripts/rotate-field-key.mjs:111-115`, 참고 `lib/crypto/fieldKeyRotation.ts:207`·`:215`, `lib/crypto/CLAUDE.md`

② `:111-115` `console.log(apply ? '[rotate-field-key] --apply — 실제로 씁니다.' : '[rotate-field-key] dry-run — ...')` — DB 호스트 출력 없음.

③ 시작 배너가 dry-run/--apply 여부만 알리고 연결된 DB를 알려 주지 않는다. 같은 계정에 `ggac-prod`가 있어 CLAUDE.md가 이름을 혼동하지 말라고 경고한다. TURSO_* 값은 운영자가 Turso CLI로 직접 주입하는 경로라 어느 DB인지 눈으로 확인할 자리가 필요하다.

④ 잘못된 DB를 가리켜도 대개 'no such table'로 멈추므로 실제 위험은 낮다. 확인용 가시성만 부족하다.

⑤ **수정**: 배너에 `new URL(process.env.TURSO_DATABASE_URL).host` 한 줄을 더 출력한다(dry-run·--apply 공통). `--db-host` 입력 요구, 사전 스냅샷, 공용 dbTarget 헬퍼(backfill-digital-delivered·seed-show·social/meta 포함 4개 스크립트)는 하지 않는다.

⑥ 검증자 정정: '검증 없이 UPDATE'는 `encryptFieldWithKey`가 순수 함수이고 `fieldKeyRotation.integration.test.ts:128,163,188,219`가 NEW_KEY 복호화 결과를 대조하므로 제외. '되돌릴 사본이 없다'는 틀림 — 회전은 두 키가 모두 있는 구간에서만 하고 옛 키로 반대 방향 재실행이 가능(낙관적 잠금·멱등). Turso 스냅샷 단계는 암호문 PII 복제본을 하나 더 만드는 새 부담이라 제외. 본체는 클린 판정.

#### SCR-16. --prune이 업로드와 같은 실행에서 라이브 배포가 참조하는 옛 음원을 배포 전에 지운다 [P3 · M]

① `scripts/press/build-sabbaha-slung.mjs:164-170`·`:98-131`·`:121`·`:161`·머리 주석 `:18`, `lib/press/audio.ts:21-33`, `data/press/sabbahaSlungAudio.ts`, CLAUDE.md '비공개 감상실' 절

② `:122` `put(pathname, ..., { access: 'private', ... addRandomSuffix: true })`(곡별 루프) → `:161` `writeFileSync(.../'data/press/sabbahaSlungAudio.ts', body)` → `:164-168`:
```js
if (PRUNE) {
  const keep = new Set(out.map((t) => t.pathname));
  const { blobs } = await list({ prefix: PREFIX });
  const stale = blobs.filter((b) => !keep.has(b.pathname));
  if (stale.length) await del(stale.map((b) => b.url));
}
```
머리 주석 `:18`과 CLAUDE.md가 "`--prune`으로 지운다"를 업로드와 같은 명령으로 안내한다. 라이브는 배포된 `sabbahaSlungAudio.ts`의 pathname으로 서명 주소를 발급한다(`lib/press/audio.ts:21-33`).

③ 새 pathname으로 데이터 파일을 쓴 직후 같은 실행에서 옛 pathname 13곡을 전부 삭제한다. 이 파일이 배포되기 전까지 라이브 감상실은 옛 pathname으로 서명 주소를 발급하므로 재생이 404가 되고, 이미 발급된 6시간 서명 주소도 끊긴다.

④ 음원 교체 때 새 배포가 READY가 되기까지 수 분 동안 비밀번호를 통과한 평론가·매체의 재생 실패. 영구 손실은 없다(원본 mp3는 `--src`에 있음). 곡 단위 고아 업로드(검증·인코딩과 put이 섞여 있음)도 사실이나 다음 `--prune`이 함께 지운다.

⑤ **수정**: `--prune`은 업로드 실행에서 빼고, 배포가 READY가 된 뒤 별도 실행하도록 CLAUDE.md·머리 주석의 안내를 바꾼다. 필요하면 `--prune`만 줄 때 업로드 없이 `data/press/sabbahaSlungAudio.ts`의 pathname을 keep으로 읽어 stale만 지우게 한다. 곡 단위 검증-업로드 분리는 기존 `--dry-run`(`:121` `if (!DRY_RUN)` — 길이 검증·인코딩까지 업로드 없이 수행)으로 충분하므로 문서에 '교체 전 dry-run 먼저'만 적는다.

⑥ 검증자 정정: process.cwd() 문제는 `node --env-file=.env.local`(상대 경로)이라 루트가 아니면 그 전에 멈춰 성립하지 않음. '--apply 기본 뒤집기'는 `--dry-run`이 이미 있어 철회.

#### SCR-17. ga4-set-key-events의 '읽기 토큰은 쓰기 불가' 설명이 setup 스크립트의 edit 범위와 어긋난다 [P3 · S]

① `scripts/ga4-set-key-events.mjs:13-18`, `scripts/ga4-oauth-setup.mjs:20-23`·`:77`, `scripts/ga4-custom-dims.mjs:10`·`:50`, `scripts/ga4-fetch.mjs`, `scripts/lead-verdict.mjs`

② `ga4-oauth-setup.mjs:20-23` `const SCOPE = ['https://www.googleapis.com/auth/analytics.readonly', 'https://www.googleapis.com/auth/analytics.edit'];` → `:77` `GA4_OAUTH_REFRESH_TOKEN="${tokens.refresh_token}"`. `ga4-custom-dims.mjs:10`이 그 토큰으로 `:50` `admin.properties.customDimensions.create(...)`를 호출한다. 반면 `ga4-set-key-events.mjs:13-18`: "GA4 Admin API write는 analytics.edit scope가 필요 (ga4-fetch의 readonly 토큰으로는 불가). 이 스크립트는 별도 GA4_OAUTH_EDIT_REFRESH_TOKEN을 사용...기존 readonly 토큰(GA4_OAUTH_REFRESH_TOKEN)은 건드리지 않는다."

③ set-key-events 주석은 5/31에 쓰였고, 6/19 커밋 66702f50ec가 custom dims 등록을 위해 setup에 edit를 더했다. 조회 스크립트(ga4-fetch·lead-verdict)가 쓰는 토큰이 쓰기 권한을 가질 수 있음을 문서가 숨긴다.

④ 조회용 토큰을 읽기 전용이라고 믿고 다루게 된다. 토큰은 `.gitignore`된 `.env.local`에만 있고, 같은 맥에 Turso·Vercel 등 훨씬 큰 권한이 이미 있어 유출 시 한계 피해는 GA4 설정 변경이다.

⑤ **수정**: 주석을 현재 사실로 고친다 — setup 토큰은 readonly+edit이고, set-key-events의 별도 edit 토큰은 선택 사항. 최소권한을 정말 원하면 setup SCOPE를 `analytics.readonly`로 줄여 재인증하고 custom-dims `--create`만 set-key-events의 edit 토큰 흐름을 쓰게 한다(공용 OAuth 모듈 추출은 하지 않는다).

⑥ 현재 저장된 토큰이 실제로 edit 범위를 갖는지는 구글에 던져 봐야 알 수 있어 확인하지 않았다(custom dims `--create`가 이 토큰으로 성공한 이력이 있다면 보유).

#### SCR-18. .env.local 쓰기 코드 4곳 복제 — 쓰기 전 백업과 경로 고정이 없다 [P3 · S]

① `scripts/social/meta.mjs:62-72`(`:71`), `scripts/ga4-oauth-setup.mjs:82`, `scripts/gsc-oauth-bootstrap.mjs:17`·`:48`, `scripts/ga4-set-key-events.mjs:122`

② `meta.mjs:71` `fs.writeFileSync(ENV_PATH, text);` / `ga4-oauth-setup.mjs:82` `fs.writeFileSync(envPath, next, 'utf-8');` / `gsc-oauth-bootstrap.mjs:48` `fs.writeFileSync(file, body, 'utf-8');`(ENV_LOCAL은 `:17` `path.join(process.cwd(), '.env.local')`) / `ga4-set-key-events.mjs:122` `fs.appendFileSync(envPath, `\nGA4_OAUTH_EDIT_REFRESH_TOKEN="${refreshToken}"\n`, 'utf-8');`

③ 같은 upsert가 4곳에 있고 쓰기 전 `.env.local` 백업이 없다. gsc-oauth-bootstrap은 `process.cwd()` 기준이라 루트가 아닌 곳에서 실행하면 그곳에 비밀이 든 `.env.local`을 새로 만든다. ga4-set-key-events는 append라 같은 키가 중복 줄로 쌓일 수 있다(대신 truncate 위험은 없다).

④ OAuth 부트스트랩을 드물게 돌릴 때(`saveEnv` 호출부는 `social/auth.mjs:66` 하나, 네 곳 모두 수동 일회성) 잘못된 값이 쓰이거나 cwd가 다르면 엉뚱한 곳에 비밀 파일이 생긴다. 수 KB 파일을 writeFileSync 한 번으로 쓰는 창은 마이크로초라 데이터 소실 확률은 매우 낮다. `$&` 치환 문제는 대상 값(Google 리프레시 토큰·Meta 토큰·GOCSPX 시크릿)에 `$`가 들어갈 수 없어 현실에서 발생하지 않는다.

⑤ **수정**: 원자적 rename·0600 헬퍼까지는 필요 없다(tmp+rename은 기존 파일 모드도 바꿀 수 있다). 세 writeFileSync 직전에 `fs.copyFileSync(f, `${f}.bak-${ts}`)` 한 줄(`.gitignore`가 이미 `.env*.bak*`를 제외 — 단 SCR-1의 백업 정리와 충돌하지 않게 회전 뒤 지우는 습관을 둘 것)을 넣고, gsc-oauth-bootstrap의 ENV_LOCAL을 `import.meta.url` 기준 ROOT로 바꾼다. 헬퍼 통합은 이 파일들을 다시 만질 때 같이 한다.

⑥ 검증자 정정: 공용 헬퍼 + tmp 후 rename + 0600 원안은 '한 번 쓰고 말 일에 추상화를 붙이지 않는다'에 비해 과함. `FUNDING_FIELD_KEY`가 Vercel에서 Sensitive 값이라 로컬이 유일한 사본인지는 확인하지 못했다(그렇다면 백업의 가치가 올라간다).

#### SCR-19. apply-portfolio-metadata.js와 CSV·howto는 낡은 일회성 도구다 — 경로를 고치면 오히려 교정된 발매일을 덮어쓴다 [P3 · S]

① `scripts/apply-portfolio-metadata.js:19`·`:63-64`, `docs/portfolio-metadata-template.csv`, `docs/portfolio-metadata-howto.md`, 참고 `scripts/generate-portfolio-meta.js:11-15`, `data/portfolio/items.ts`

② `:19` `const TS_FILE = path.join(ROOT, 'data/portfolio.ts');`, `:63-64` `source.indexOf('const items: PortfolioItem[] = [')` / `source.indexOf('export const getAudioTracks')`. 실제 실행 `node scripts/apply-portfolio-metadata.js --dry-run`: `SKIP kang-ho-jung-self-titled: not found / SKIP balkwaehan-cm-song: not found / ... 0 items updated (dry run).` exit 0. `generate-portfolio-meta.js:11-15`는 분할 후 `data/portfolio/items.ts`를 가리키도록 이미 고쳐졌다.

③ TS_FILE이 분할 전 `data/portfolio.ts`를 가리켜 모든 레코드가 SKIP되고 조용히 성공한다. 그런데 경로를 `items.ts`로 고친 사본을 스크래치에서 돌리면 24건이 UPDATE 대상이 되고 현재 `items.ts`와 diff가 167줄 난다 — CSV는 2026-04 템플릿이고 2026-08-14 커밋 294b875c56이 `items.ts`의 releaseDate 27건을 본문과 전수 대조해 교정했다(최대 605일 오차). CSV에는 교정 전 값(예: the-projectors 2024-03-15, 정답 2025-11-10)과 `items.ts`에 없는 gear 목록이 그대로 있다.

④ 현재는 무해한 no-op. 문서대로 CSV를 채워 실행하는 사람은 반영된 줄 안다. 누군가 경로만 고쳐 쓰면 검증된 발매일이 틀린 값으로 되돌아가고 출처 불명의 장비 목록이 주입되어 포트폴리오 정렬·상세 표시가 틀어진다. 지금의 '아무 일도 안 함'이 우연히 데이터를 지키고 있다.

⑤ **수정**: TS_FILE을 고치지 말고 `scripts/apply-portfolio-metadata.js`, `docs/portfolio-metadata-template.csv`, `docs/portfolio-metadata-howto.md`를 함께 삭제한다(git 이력에 남는다). 값을 일괄 반영할 일이 다시 생기면 그때 `items.ts`를 정본으로 CSV를 새로 뽑는다.

⑥ 검증자 정정: 원안의 'TS_FILE repoint'는 데이터를 되돌리는 위험한 수정이라 삭제로 바꿨다.

#### SCR-20. gsc-pseo-audit.mjs는 lib 로직의 낡은 복사본이고 주석 두 곳이 사실과 다르다 [P3 · M]

① `scripts/gsc-pseo-audit.mjs:1-38`(`:2`·`:21`·`:35-38`·`:40-55`·`:112-125`), `lib/seo/gscAudit.ts:103-109`, `scripts/generate-story-catalog.js:7-8`·`:22`, `scripts/scan-near-duplicates.mjs:38`·`:359`, `AGENTS.md:16`, `docs/gsc-audit-output.csv`

② `gsc-pseo-audit.mjs:2` `// 로컬 수동 실행용 — lib/seo/gscAudit.ts의 runAudit과 동일 로직을 mjs에서 호출.` 그러나 lib를 import하지 않고 `:35-38` `function urlToSlug(url) { const m = url.match(/\/[a-z]{2}\/stories\/([^/?#]+)/); ... }`를 갖는다 — lib `:103-109`는 끝 앵커 `\/?(?:[?#]|$)`를 넣어 `/ko/stories/category/vocal`에서 'category'를 오캡처하던 구버전을 고쳤다. `generate-story-catalog.js:7-8` "gsc-pseo-audit.mjs — 로컬 수동 audit도 동일 manifest 사용"도 거짓(스크립트는 `:40-55`에서 `content/stories`를 직접 읽는다). `classifyCluster`가 `generate-story-catalog.js:22`와 `gsc-pseo-audit.mjs:21`에 중복.

③ 두 주석이 사실과 다르고 urlToSlug가 구버전이다. 이 스크립트가 만드는 `docs/gsc-audit-output.csv`는 2026-05-21 이후 갱신되지 않았는데 `scan-near-duplicates.mjs:38,359`가 canonical 권고에 읽는다(진단 문서들은 이미 '이 CSV의 tier를 실행 근거로 쓰지 말라'고 적어 두었다).

④ 스토리 행의 tier 값에는 영향이 없다 — 'category' 유령 슬러그가 생겨도 카탈로그와 join해 CSV를 쓰므로(`:112-125`) 스토리 행은 달라지지 않는다. 다시 돌리는 사람이 주석을 믿고 lib와 같은 결과라고 오해하는 정도다.

⑤ **수정**: `lib/seo/gscAudit.ts`의 urlToSlug는 건드리지 않는다 — 주간 크론(gscDiff)이 Blob의 이전 스냅샷과 tier를 비교하므로 집계 규칙을 바꾸면 변경 한 번에 대량 가짜 diff 메일이 나간다. 스크립트의 정규식에 lib와 같은 끝 앵커를 넣고 두 주석(`:2`, `generate-story-catalog.js:7-8`)을 사실대로 고친다. 삭제하려면 `scan-near-duplicates.mjs`의 CSV 입력 경로와 `AGENTS.md:16`을 먼저 바꾼다.

⑥ 검증자 정정: 원안의 'lib urlToSlug를 # 행 버리고 /ko/만으로' 변경은 크론 diff를 흔들어 철회. 로케일·앵커 합산은 스크립트와 lib가 똑같이 하고 tier(clicks>=1 KEEP)에는 영향이 작다.

#### SCR-21. IndexNow 제출 결과(상태 코드)가 exit code와 CI 요약에 반영되지 않는다 [P3 · S]

① `scripts/indexnow-submit.mjs:28-50`(`:38-45`·`:44`), `scripts/indexnow-changed.mjs:179`, `.github/workflows/ci.yml:103-111`

② `indexnow-submit.mjs:38-45` `const res = await fetch(endpoint, {...}); console.log(`  ${endpoint} → ${res.status}...`); results.push({ endpoint, status: res.status });` — `submitUrls`가 results를 돌려주지만 `indexnow-changed.mjs:179` `await submitUrls(urls);`와 `indexnow-submit.mjs`의 main이 반환값을 버린다. `ci.yml`의 indexnow job은 `continue-on-error: true`.

③ 모든 엔드포인트가 403·422·5xx여도 exit 0이다. 상태 코드는 로그(`:44`)에만 남고 요약·종료 코드에는 안 남는다.

④ 키 파일 불일치·엔드포인트 장애가 로그를 열어 보기 전에는 드러나지 않는다. 배포에는 영향 없음(continue-on-error 별도 job). 키 파일(`public/9f2c…txt`)은 존재하고 KEY와 일치한다.

⑤ **수정**: `submitUrls` 끝에서 200/202가 하나도 없으면 `console.log('::warning::IndexNow 제출 실패')`를 찍고 `process.exitCode = 1`로 끝낸다(job은 continue-on-error 유지). 타임아웃은 선택 — Node 22 fetch 기본(headers·body 300초)과 job `timeout-minutes: 5`가 이미 상한이고, 필요하면 `AbortSignal.timeout(15000)`.

⑥ 검증자 정정: continue-on-error job이 exit 1일 때 GitHub UI에 얼마나 눈에 띄는지는 확인하지 못해 `::warning::`을 같이 찍는 쪽이 안전. main-guard 경로 문제는 SCR-27.

#### SCR-22. wait-and-measure.sh: Ready가 안 돼도 측정으로 넘어가 옛 프로덕션 점수를 기록한다 [P3 · S]

① `scripts/wait-and-measure.sh:25`·`:59-71`·`:77`, `scripts/pagespeed-audit.js`

② `:25` `vercel ls --prod 2>/dev/null | awk '/hwang-khs-projects\/studio/ {print $4; exit}'` / `:59-71`:
```sh
for i in $(seq 1 20); do
  status=...
  if [[ "$status" == "Ready" ]]; then ... break; fi
  if [[ ... "Error" ...]]; then exit 1; fi
  sleep 30
done
```
이후 `:77` `node scripts/pagespeed-audit.js $MEASURE_ARGS`. `pagespeed-audit.js`는 특정 배포가 아니라 프로덕션 도메인(`SITE=https://studionol.co.kr`)을 PSI로 잰다.

③ 20회 폴링이 끝나도 status가 Ready가 아니면 루프를 그냥 빠져나가 측정을 계속한다. 새 배포 식별도 `vercel ls --prod` 첫 줄 + 고정 팀 슬러그에 의존한다(전역 CLAUDE.md "`vercel ls`는 브랜치를 안 보여줘서 나이만 보고 고르면 엉뚱한 것을 집는다"와 같은 계열).

④ 잘못된(이전) 배포의 PSI 점수를 이번 변경의 성능으로 기록할 수 있다. 저장소 어디에서도 호출되지 않고 2026-04-21 이후 손대지 않은 도구라 현재 피해는 없다.

⑤ **수정**: 가장 단순한 것은 파일 삭제 — 현재 규칙은 Vercel MCP `list_deployments`로 `githubCommitSha`가 HEAD인 배포의 READY를 확인하는 방식이다. 남길 거면 루프 뒤에 `[[ "$status" == Ready ]] || { echo "Ready 대기 시간 초과" >&2; exit 1; }`를 추가한다.

⑥ 검증자 정정: '푸시 후 실행' 지적은 사용 오류(헤더가 푸시 전 실행을 안내), 'vercel CLI 전역 설치' 지적은 의도된 설정(CLAUDE.md devDependency 금지)이라 제외.

#### SCR-23. Node 22 / npm 10 전제가 코드로 강제되지 않는다 (문서에만 있음) [P3 · S]

① `package.json:1-8`(engines 없음), `.nvmrc`·`.node-version`·`.npmrc` 부재, `.github/workflows/ci.yml:26`·`:91`·`:124`, `.githooks/pre-commit`, CLAUDE.md '의존성 버전 고정 정책'

② 로컬 `node --version` v24.16.0 / `npm --version` 11.13.0, CI `node-version: '22'`(세 잡), Vercel 프로젝트 nodeVersion 22.x. CLAUDE.md: "락파일은 CI와 같은 npm 10으로 만든다 ... 로컬 npm 11로 만든 락은 puppeteer-core 중첩 proxy-agent를 걷어내 CI의 npm ci가 'Missing: proxy-agent@…'로 실패한다." `.githooks/pre-commit`은 스토리 매니페스트만 본다.

③ 로컬과 CI·Vercel이 어긋나 있는데 engines·.nvmrc가 없고 락 재생성 절차는 문서에만 있다.

④ npm 11로 락을 재생성한 PR이 CI `npm ci`에서 실패한다(2026-09-04 선례, 8커밋 연속). 배포 사고로 번지는 경로는 CI가 차단한다.

⑤ **수정**: `.nvmrc`에 `22`, `package.json`에 비강제 `engines`(`{"node": ">=22 <23", "npm": ">=10 <11"}`)를 추가한다. **`engine-strict=true`는 넣지 않는다** — 로컬 Node 24/npm 11에서 `npm install`·`npm ci`가 EBADENGINE으로 실패하고, 문서화된 복구 절차 `npx -y npm@10 install --package-lock-only`도 Node 24 아래에서는 막힌다. 락 사고 방지는 `.githooks/pre-commit`에서 `package-lock.json`이 staged인데 `npm -v`의 major가 10이 아니면 거부하는 쪽이 가장 단순하다. engines.node가 있으면 Vercel도 그 범위로 Node를 고르므로 배포 동작을 바꾸는 변경임을 알고 한다.

⑥ 검증자 정정: 원안의 `engine-strict=true`는 문서화된 복구 절차와 충돌해 철회. 같은 자리를 다른 축(TST)도 지적: "락·package.json 불일치와 npm 11 락이 CI npm ci에서만 드러난다 (방어가 문서뿐)".

#### SCR-24. prebuild가 매 빌드 고정되지 않은 main 브랜치의 Paperlogy 소스로 display.woff2를 재생성한다 [P3 · S]

① `scripts/generate-hero-font.mjs:41`·`:76`·`:84-89`·`:105-116`·`:339-376`·`:351-362`, `package.json` prebuild, `lib/fonts/display.woff2`·`display.chars.json`, `hero-font-subset.test.js`

② `:76` `url: 'https://raw.githubusercontent.com/Freesentation/paperlogy/main/woff2/Paperlogy-7Bold.woff2'`(`:41`의 Hahmlet도 `google/fonts/main`), `:110` `const res = await fetch(SOURCE.url, { redirect: 'follow' });`, `:113` `if (buf.length < SOURCE.minBytes) throw ...` — 크기 하한만 검사. prebuild `... && node scripts/generate-hero-font.mjs && ...`가 매 빌드 실행한다.

③ 소스 URL이 커밋 sha가 아닌 main 브랜치이고 내용 검증이 minBytes뿐이라, Vercel 빌드가 커밋된 `display.woff2`와 다른 바이트를 만들 수 있다. 커밋된 사이드카가 이미 현재 제목 글자를 덮는 경우에도 매번 네트워크를 탄다. CI의 `--check`·`check:display-font`는 이 경로를 잡지 않는다.

④ 업스트림이 파일을 바꾸면 LCP 경로 제목 서체 모양이 사용자 모르게 바뀐다(글자 집합은 저장소 내용에서 결정되므로 같다). CDN 장애는 `:351-362` 폴백(커밋본 유지)이 있어 빌드를 막지 않는다 — Node 22 fetch 기본 타임아웃(connect 10초, headers·body 300초)으로 최대 5분 뒤 예외가 되고 폴백이 발동한다.

⑤ **수정**: `main()` 앞부분에서 `runCheck`와 같은 판정(사이드카 글자 집합이 현재 집합을 덮고 woff2 sha 일치)이 참이면 재생성·fetch를 건너뛴다. 그러면 프로덕션이 커밋된 바이트를 그대로 싣고 외부 CDN 의존이 사라진다. 덮지 못할 때만 재생성하되 `SOURCES.url`을 커밋 sha로 고정한다. fetch 타임아웃 추가는 선택.

⑥ 같은 자리를 다른 축(TST)도 지적: "제목 서체 소스가 main 브랜치·해시 없이 매 빌드 내려받힌다 (재생성 구조는 유지하되 소스를 고정)". 검증자 정정: '빌드가 매달린다'는 과장, `:83-85` 주석은 현재도 유효한 이유(Vercel prebuild가 DISPLAY_FONT 없이 돈다). Vercel 캐시 보존 여부는 확인하지 못했다.

#### SCR-25. pre-commit 훅이 작업 트리 전체로 storyListing을 재생성해 git add — 공유 체크아웃에서 남의 미커밋 스토리 변경이 이번 커밋에 섞여 PR CI가 빨개진다 [P3 · M]

① `.githooks/pre-commit:4-6`, `scripts/generate-story-listing.js:13`(`:39`·`:183`·`:245`·`:280`)

② `.githooks/pre-commit:4-6`:
```sh
git diff --cached --name-only | grep -q '^content/stories/' || exit 0
node scripts/generate-story-listing.js >/dev/null || { echo "story-listing 재생성 실패" >&2; exit 1; }
git add lib/storyListing
```
`generate-story-listing.js:13` `const STORIES_DIR = path.join(process.cwd(), 'content/stories');` — 작업 트리에서 `fs.readdirSync/readFileSync`로 읽는다.

③ 훅은 스테이징된 스토리가 아니라 작업 트리 `content/stories` 전체로 `lib/storyListing/*.json`을 만들고 디렉터리째 `git add` 한다. 같은 체크아웃에 미커밋·미추적 스토리 편집이 있으면(다른 세션이든 같은 세션의 부분 스테이징이든) 이번 커밋에 없는 제목·요약이 목록에 실린다. 메모리 `feedback_git_push.md`가 공유 체크아웃 사고 2건을 기록해 전제는 현실적이다.

④ 공유 체크아웃에서 동시 스토리 편집이 있을 때만 발생. 오염된 커밋은 필수 체크(`ci.yml:11` 'Type-check, Lint, Build' 안의 `npm test` → `storyListing.check.test.js` → `--check`로 커밋된 JSON과 커밋된 스토리 대조)에서 PR 단계에 걸러져 main에는 들어가지 않는다. 비용은 깨끗한 worktree에서 재생성·재푸시 한 번. 훅이 없었어도 본문만 고친 커밋은 어차피 CI가 빨갰으므로(#515 도입 사유) 훅은 순이익이다.

⑤ **수정**: 5행 앞에 한 줄 방어:
```sh
if ! git diff --quiet -- content/stories || [ -n "$(git ls-files --others --exclude-standard -- content/stories)" ]; then
  echo "스테이징되지 않은 스토리 변경이 있어 목록에 섞입니다. 깨끗한 worktree에서 커밋하거나 --no-verify 후 직접 재생성하세요." >&2
  exit 1
fi
```
**미추적 파일 검사(`git ls-files --others`)를 빼먹지 말 것** — `git diff --name-only`만으로는 신규 스토리(`??`)를 못 잡는다. 인덱스 스냅샷 방식은 생성기가 `STORIES_DIR` 주입을 받지 않고(`:39` 고정) lib 의존 모듈(factTokens·thinContent)도 작업 트리에서 require 하므로 변경이 더 크다.

⑥ 검증자 정정: '유령 항목이 main 이력에 남는다'는 일어나지 않는다(PR CI가 막음). 훅을 실제로 돌려 재현하지는 않았고 코드 경로만 따라 확인. 같은 자리를 다른 축(TST)도 지적: "락·package.json 불일치와 npm 11 락이 CI npm ci에서만 드러난다 (방어가 문서뿐)".

#### SCR-26. ga4-set-key-events·ga4-custom-dims는 일부 항목이 실패해도 '완료'를 찍고 exit 0으로 끝난다 [P3 · S]

① `scripts/ga4-set-key-events.mjs:173-210`(`:179-182`·`:208`), `scripts/ga4-custom-dims.mjs:49-55`·`:6-12`

② `ga4-set-key-events.mjs:179-182` `} catch (e) { const msg = ...; console.error(`✗ ${ke.eventName} — 등록 실패: ${msg}`); }` … `:208` `console.log('\n완료. GA4 보고서에 반영되기까지 24~48시간 걸립니다.');`(종료 코드 0). 해제 루프도 같다. `ga4-custom-dims.mjs:52-54` `console.log(`✗ 생성 실패 ${dim.parameterName}: ...`)`. custom-dims는 `:6-12`에서 env 검증 없이 OAuth2를 만든다(set-key-events는 `:49-55` requireEnv로 `:117-119`에서 검증한다).

③ per-item catch가 로그만 남기고 종료 코드에 반영하지 않는다.

④ 둘 다 CI·package.json·크론이 부르지 않는 수동 1회성 스크립트이고 실패마다 '✗' 줄이 출력되므로 사람은 알아챈다. 멱등이라 다시 돌리면 누락분만 만든다. custom-dims의 env 누락은 `list()`의 top-level await가 던져 exit 1이 된다. 다만 에이전트가 Bash로 실행하면 exit 0과 '완료' 문구를 성공으로 읽어 일부 전환 미등록을 놓칠 수 있다.

⑤ **수정**: 두 스크립트에 `failed` 카운터를 두고 실패 시 요약에 실패 항목을 나열하며 `process.exitCode = 1`로 끝낸다. '완료' 문구는 실패 0일 때만 출력. custom-dims 상단에 env 3종(`GSC_OAUTH_CLIENT_ID`·`GSC_OAUTH_CLIENT_SECRET`, `GA4_OAUTH_REFRESH_TOKEN`, `GA4_PROPERTY_ID`)을 확인하는 5줄짜리 검사를 인라인으로 넣는다. 공용 모듈은 만들지 않는다.

⑥ 검증자 정정: 원안 제목의 'env 미검증'은 set-key-events에는 해당하지 않는다(custom-dims만).

#### SCR-27. URL.pathname으로 ROOT를 구하는 4개 스크립트는 조상 경로에 공백·비ASCII가 있으면 틀린 디렉터리를 가리킨다 [P3 · S]

① `scripts/funding-baseline.ts:32`, `scripts/cta-routing-baseline.ts:26`, `scripts/indexnow-submit.mjs:97`, `scripts/indexnow-changed.mjs:182`

② `funding-baseline.ts:32` / `cta-routing-baseline.ts:26` `const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');` / `indexnow-submit.mjs:97`·`indexnow-changed.mjs:182` `if (import.meta.url === `file://${process.argv[1]}`)`. `generate-page-lastmod.mjs:33`·`build-mix-compare.mjs:52`·`press/build-sabbaha-slung.mjs:161`·`gsc-oauth-bootstrap.mjs:17`은 `process.cwd()`.

③ `new URL(import.meta.url).pathname`은 퍼센트 인코딩된 문자열이다. 조상 경로에 공백·한글이 있으면 ROOT가 `.../%EB%82%B4%20…` 같은 틀린 경로가 되고(두 baseline 게이트는 ENOENT로 시끄럽게 실패), `file://${process.argv[1]}` 비교는 false가 되어 두 IndexNow 스크립트의 main이 조용히 건너뛰어진 채 exit 0이다(검증자 실측). 마지막 경로 조각의 인코딩은 `..`가 상쇄하므로 조상 디렉터리에만 영향.

④ 현재 로컬(`/Users/hwang-gyeongha/studio`)과 CI(`/home/runner/work/studio/studio`)에서는 발생하지 않는다. 공백·한글이 든 경로로 클론했을 때만 발생하는 잠복 문제이고 IndexNow job은 continue-on-error다.

⑤ **수정**: 4개 파일만 고친다. ROOT는 `path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')`, main 가드는 `import.meta.url === pathToFileURL(process.argv[1]).href`. 같은 저장소의 `ga4-oauth-setup.mjs`·`social/meta.mjs`가 이미 `fileURLToPath`를 쓰는 선례다. 공용 `scripts/lib/root.mjs`는 만들지 않는다. `process.cwd()` 기반 스크립트는 npm scripts가 루트에서 실행하므로 건드리지 않는다.

⑥ 검증자 정정: process.cwd() 쪽은 사실상 해당 없음(문서화된 호출이 전부 루트 기준).

#### SCR-28. OAuth 루프백 서버가 state를 검증하지 않고 error·예외 메시지를 이스케이프 없이 반사하며, 두 스크립트는 모든 인터페이스에 바인딩한다 [P3 · S]

① `scripts/ga4-oauth-setup.mjs:36-40`·`:57`·`:90`·`:96`, `scripts/ga4-set-key-events.mjs:82`·`:105`·`:111`, `scripts/gsc-oauth-bootstrap.mjs:84`

② `ga4-oauth-setup.mjs:57` `res.end(`<h1>오류: ${error}</h1><p>터미널을 확인하세요.</p>`);`, `:90` `res.end(`<h1>토큰 교환 실패</h1><p>${e.message}</p>`);`, `:36-40` `generateAuthUrl({ access_type: 'offline', scope: SCOPE, prompt: 'consent' })`(state·PKCE 없음). `ga4-set-key-events.mjs:82,105`, `gsc-oauth-bootstrap.mjs:84`도 같다. `ga4-oauth-setup.mjs:96`·`ga4-set-key-events.mjs:111`은 host 없이 `server.listen(PORT)`라 모든 인터페이스에 바인딩(gsc-oauth-bootstrap은 127.0.0.1).

③ state·PKCE 없음, 응답 HTML에 error·e.message 그대로 삽입, 두 스크립트는 같은 네트워크의 다른 기기도 콜백 포트에 닿는다.

④ 실질적 공격 경로는 없다. 위조 code는 이 OAuth 클라이언트(client_id, 터미널에만 출력)용으로 발급돼야 하고, 성립해도 `.env.local`에 공격자의 refresh token이 저장되어 운영자의 GA4 호출이 403으로 실패할 뿐 데이터·권한이 넘어가지 않는다. 반사 XSS는 `http://localhost:43821` 오리진에서만 실행되는데 그 오리진에는 쿠키·저장소가 없고, 서버는 동의 직후 닫히는 수 분짜리 1회성 흐름이다. 위생 수준의 개선.

⑤ **수정**: 굳이 고치려면 가장 작은 수정만 — 응답에 들어가는 두 값에 `String(x).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)` 인라인 이스케이프, `listen(PORT, '127.0.0.1')`(리디렉션 URI가 `http://localhost`라 브라우저가 `::1`을 먼저 시도해도 폴백으로 붙는지 한 번 확인). state는 `randomBytes` 한 줄이면 되나 필수는 아니다. 공용 모듈은 만들지 않는다.

⑥ 검증자 정정: 악용 가능성·영향은 원안보다 크게 낮다. 실제로 짚을 만한 사실은 '모든 인터페이스 바인딩' 하나.

#### SCR-29. post.mjs·inbox.mjs·auth.mjs의 flag()는 다음 토큰이 또 다른 플래그여도 값으로 삼아 `--text --image x.png`가 '--image'라는 글로 실제 발행된다 [P3 · S]

① `scripts/social/post.mjs:35-45`(`:35-38`·`:55-66`), `scripts/social/auth.mjs:21-24`·`:68-70`, `scripts/social/inbox.mjs:18-21`·`:24`, `scripts/social/meta.mjs`

② `post.mjs:35-38`:
```js
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
```
`auth.mjs:21-24`·`inbox.mjs:18-21`도 동일. 검증자 실측: `--text --image foo.png` → `{ text: '--image', image: 'foo.png' }`. `post.mjs:55-66` 이후 확인 단계가 없고 dry-run은 옵트인이다. `inbox.mjs:24` `const me = { ig: process.env.INSTAGRAM_USER_ID, threads: process.env.THREADS_USER_ID };`(requireEnv 아님).

③ 값을 빠뜨린 `--text`(post.mjs)가 뒤따르는 플래그 문자열을 캡션으로 실제 발행한다. inbox.mjs에서는 `--reply ig:<id> --text --dm`이 공개 답글 '--dm'을 단다(reply 분기가 `--dm`보다 먼저). `--slug`·`--to`·`--text-file`·`--image`가 플래그를 삼키는 경우는 스토리 없음·알 수 없는 플랫폼·ENOENT로 안전하게 멈춘다 — 위험한 경로는 값 없는 `--text`뿐. inbox.mjs는 `INSTAGRAM_USER_ID`가 비면 `c.from?.id === me.ig`와 answered 판정이 어긋나 이미 답한 댓글이 미답으로 나온다.

④ 공개 Instagram·Threads 계정에 의미 없는 글이나 답글이 올라간다(삭제 가능). inbox 쪽 중복 답글 위험은 ID가 `auth.mjs:68-70`에서 토큰과 함께 saveEnv로 쓰이므로 정상 환경에서는 비는 일이 없고(로컬 `.env.local`에 두 키 모두 존재), `vercel env pull`만 한 새 머신 정도에서만 가능.

⑤ **수정**: `meta.mjs`에 `flag(args, name)` 헬퍼를 **새로 만들고**(현재 `parseArgs`는 없다 — export 목록·grep·`git log -S parseArgs` 모두 빈 결과) 세 파일의 동일한 4줄 복사본을 교체한다. 값이 `--`로 시작하면 throw. `--`로 시작하는 본문은 `--text-file`로 넘긴다. inbox.mjs는 ig를 쓰는 경로(`used`에 'ig'가 있을 때)에서만 `INSTAGRAM_USER_ID`를 requireEnv로 검증한다 — `me.threads`는 선언만 하고 어디서도 쓰지 않아 `THREADS_USER_ID` 검증은 불필요.

⑥ 검증자 정정: 원안의 '기존 공용 parseArgs로 교체'는 그 함수가 존재하지 않아 '새로 만든다'로 바꿨다.

**클린 판정**

- `scripts/seed-show.ts` + `lib/shows/seed.ts`: dry-run 기본, `--apply`는 TURSO_* 없으면 시작 전에 실패, 쓰기는 `db.batch` 원자 실행, 종료 코드 정상
- `scripts/backfill-digital-delivered.mjs`: 멱등(`delivered_at IS NULL`), dry-run 기본, 배송 리워드 id를 NOT IN으로 안전하게 처리
- `scripts/rotate-field-key.mjs` 본체: dry-run 기본, 두 키가 같으면 exit 2, 한 바퀴도 못 돈 경우(2)와 행 실패(1) 구분, 출력에 평문·키·암호문 없음 / `lib/crypto/fieldKeyRotation.ts` 낙관적 잠금·keyId 건너뛰기·접속기록
- `scripts/normalize-sitemap-hreflang.js`: 사이트맵·robots.txt 부재 시 시끄럽게 exit 1
- `scripts/check-display-font-coverage.mjs`, `scripts/generate-hero-font.mjs`의 `--check`(sha 사이드카 대조), `generate-page-lastmod.mjs`의 `--check`(커버리지·죽은 항목), `backfill-story-lastmod.mjs`(얕은 클론 감지 시 exit 1)
- `scripts/generate-story-listing.js`: 정렬 타이브레이크로 플랫폼 간 결정적 출력(`--check` 자체는 정상)
- `scripts/check-fact-consistency.mjs`, `check-duplicate-sections.mjs`, `check-unverified-claims.mjs`의 판정 로직(기준선 대비, 소스에서 정본을 읽음)
- `scripts/verify-contracts.ts`: PII 미출력, mismatch=1/오류=2 종료 코드
- `scripts/oplog.mjs`: 스키마·enum 검증, 원시 CSV는 `docs/oplog/.gitignore`로 제외
- `scripts/social/compose.mjs`(순수 함수+테스트), `insights.mjs`, `inbox.mjs`의 자동 답글 없음 설계, `lib/social/tokens.ts` 갱신 로직
- `lib/ops/migrationJournal.test.ts`: when 엄격 증가·idx·prevId 사슬 검증(저널 현재 52개, 단조 확인)
- `scripts/*`, `.github`, `.githooks`, `vercel.json`, `lib/press`, `lib/crypto`에 커밋된 시크릿 없음(scrypt 해시와 IndexNow 공개 키 제외), `.gitignore`의 `.env*.local`·`.env*.bak*`·`.secrets` 처리
- `scripts/archive/README.md`의 경고 문구와 파일 수(35개) 일치

**읽지 못한 범위**

- `scripts/scan-near-duplicates.mjs`(752줄)는 머리 주석·출력 경로·인자 처리만 읽고 유사도 계산 본문은 읽지 못했다
- `scripts/audit-thin-content.js`, `content-quality-check.js`, `generate-portfolio-meta.js`, `pagespeed-audit.js` 후반부, `visual/screenshots.mjs` 본문은 일부만 읽었다
- `scripts/structureIntegrity.js`, `styleDistribution.js`, `proseSegments.js`, `soundtherapy-extract/check.mjs`, `scripts/__tests__/*`는 머리 주석 수준만 확인했다
- `scripts/archive/*`의 개별 코드는 README 경고와 파일 수만 확인하고 읽지 않았다
- jest·CI를 실제로 돌려 보지 않았다(정적 읽기와 `apply-portfolio-metadata --dry-run`, 로컬 토큰 클레임 디코딩만 실행)
- GitHub Secrets의 실제 값·Turso 토큰 권한·Vercel 프로젝트 Node 버전·Vercel env 값은 확인할 수 없었다(운영 DB·Vercel은 읽지 않음)
- `lib/ops/migrationDrift.ts`, `lib/seo/gscAudit.ts`, `lib/press/audio.ts`, `pages/api/cron/*` 등 스크립트 호출부는 관련 부분만 읽었다

**미검증 후보(overflow)**

- 없음

### TST. 테스트·CI·빌드 파이프라인

P0 0 · P1 0 · P2 14 · P3 16, 미검증 0

기준: HEAD 401a9ddcf2. 전체 스위트 510 suites / 5,734 tests 로컬 통과(92초), main CI #600 Test 단계 성공. 이 절의 항목은 전부 "지금 깨진 것"이 아니라 "회귀가 CI 초록으로 통과하는 구멍"과 "CI 시간·설정 위생"이다. 돈이 걸린 lib/billing(91.8%)·booking(94.0%)·payments(88.8%)·funding(92.7%)은 커버리지가 이미 높다. 비어 있는 곳은 pages/api 핸들러 층(82파일 중 24개가 0%)과 기준선 가드의 `--update` 경로다.

#### TST-1. 날짜 게이트 2개가 UTC로 판정하고 사전 경고 없이 절벽 당일에 CI를 세운다 (게이트 자체는 운영자 설계) [P2 · S]

① `data/pricing.test.ts:303-306`, `data/pricing.ts:142-149`, `data/practiceRoomAvailability.test.ts:17`·`:29-37`, `data/practiceRoomAvailability.ts`(`PRACTICE_ROOM_AVAILABILITY_UPDATED_ON='2026-09-18'`), `.github/workflows/ci.yml:48-49`, `lib/ops/healthCheck.ts`

② 지금 코드. 도입가 만료 게이트:

```ts
// data/pricing.test.ts:304-305
const today = new Date().toISOString().slice(0, 10);
expect(today <= RELEASE_PRESS_INTRO_ENDS_ON).toBe(true);   // RELEASE_PRESS_INTRO_ENDS_ON = '2026-12-31'
```

공실 신선도 게이트(`practiceRoomAvailability.test.ts:17`·`:35-37`)는 `const MAX_AGE_DAYS = 120;`에 `T00:00:00Z` 기준으로 "미래 아님"과 `ageDays <= MAX_AGE_DAYS`를 판정한다(UPDATED_ON 2026-09-18 → 2027-01-16 만료). 두 테스트 모두 `npm test`로 필수 체크 잡 'Type-check, Lint, Build' 안에서 돌고, 브랜치 보호는 `enforce_admins=true`·`required_status_checks.contexts=["Type-check, Lint, Build"]`다.

③ 게이트는 버그가 아니다. `data/pricing.ts:142-148` 주석("날짜를 상수로 박고 pricing.test.ts가 만료를 CI에서 잡는다. 연장하려면 날짜를 옮기는 게 아니라 정가로 얼마간 팔았는가를 먼저 볼 것")과 루트 CLAUDE.md 연습실 절("오래되면 practiceRoomAvailability.test.ts가 CI에서 실패한다")이 하드 스톱을 의도로 적어 두었다. 결함은 구현 두 가지다.
- (a) `new Date().toISOString()`과 `T00:00:00Z` 비교는 UTC 날짜다. KST 00:00~09:00 사이에 `UPDATED_ON`을 '오늘'로 적으면 UTC로는 아직 전날이라 "미래 날짜"로 판정돼 거짓 실패한다. 그날 09:00까지 CI를 다시 돌려야 한다.
- (b) D-day 전에 아무 경고가 없다. 2027-01-01 09:00 KST(도입가)·2027-01-16(공실)부터 상수를 고치는 커밋을 싣지 않은 PR은 전부 빨개지고, 그때서야 '정가로 돌릴지'를 결정하게 된다. 핫픽스에 가격 결정을 끼워 넣어야 하는 압박에서 가장 쉬운 선택이 주석이 금지한 '날짜만 옮기기'다.

④ 조건과 결과. 2027-01-01 이후 아무 PR이나 열면 `data/pricing.test.ts`가 실패하고 `enforce_admins`라 우회가 없다. 머지 불가가 아니라 '그 PR에 `RELEASE_PRESS_INTRO_ENDS_ON` 처리를 같이 실어야 하는' 상태다. 공실 상수를 KST 새벽에 갱신하면 그날 오전 CI가 거짓으로 빨갛다.

⑤ **수정**. 게이트는 그대로 둔다(필수 체크에서 빼거나 크론 전용으로 옮기지 않는다 — pricing.ts 주석이 그 완화를 명시적으로 막고 있다).
1. 두 테스트의 '오늘'을 KST로 통일한다.
   ```ts
   const todayKst = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }); // 'YYYY-MM-DD'
   ```
   `practiceRoomAvailability.test.ts`의 "미래 아님" 판정에는 하루 여유를 둔다(`updatedOn <= todayKst + 1일`).
2. `lib/ops/healthCheck.ts`(매일 08:00 KST 운영자 메일)에 항목 둘을 더한다. `RELEASE_PRESS_INTRO_ENDS_ON` D-14부터 medium("정가 전환 또는 기간 재결정 필요 — data/pricing.ts:149"), `PRACTICE_ROOM_AVAILABILITY_UPDATED_ON` 100일 경과부터 medium("data/practiceRoomAvailability.ts 갱신 필요"). 결정이 절벽 전에 내려진다.
3. 두 테스트의 실패 메시지에 상수 위치와 "날짜만 옮기지 말고 정가 판매 이력을 먼저 확인할 것"을 적는다.
회귀 테스트: healthCheck 테스트에 `setSystemTime(2026-12-20)` → press-intro 경고 1건, `setSystemTime(2026-12-01)` → 0건.

⑥ 비고: 검증자가 바로잡음 — 원 지적은 게이트를 크론 메일·비필수 워크플로로 옮기자고 했으나 그것은 표시광고법 때문에 일부러 만든 강제 정지를 무시 가능한 알림으로 바꾸는 것이라 기각. "머지할 수 없다"도 "결정을 같이 해야 한다"로 정정. P1→P2.

#### TST-2. 전자서명 API 라우트 테스트가 없다 — 08-24 리뷰 라우트 5개 중 유일하게 남은 공백 [P2 · M]

① `pages/api/contracts/[id]/sign.ts:26-257`, `lib/contracts/admin-rate-limit.ts:284-313`, `lib/contracts/sign-transaction.ts`, `lib/contracts/finalize.ts`, `tests/api/contracts/`(id·index·download·id-pdf만 있음), `docs/code-review-2026-08-24.md:47-52`

② 지금 코드. `sign.ts`를 import하는 테스트는 0개다(`lib/contracts/sign-draft.test.ts`·`sign-page.test.ts`는 `pages/[locale]/contracts/[id]/sign` 페이지를 import한다). 핸들러 순서는 다음과 같다.

405 → 400(body/signerDetails/token/signature/agreements 형식) → 404(token 불일치) → 409(`getEffectiveStatus`가 signed/cancelled/expired) → `checkIdentityAttempt` 429 → `verifyIdentityDigits` 400 → `identityConfirmed` 확인 → 동의 누락 400 → `pendingSignature` 없으면 409 → `buildSignedContractContent`(+`loadTemplateSnapshot`, :179-184) → `computeContractFingerprint` → `db.batch(buildSignStatements)` → `rowsAffected === 0`이면 상태 재조회 후 status별 409(:225-242) → `resetIdentityAttempts` → `waitUntil(finalizeSignedContract)`

③ 부품(sign-transaction·identity-attempt·integrity·validation·template-snapshot)은 각각 lib 단위 테스트가 있지만, 라우트가 그것을 엮는 **순서**는 아무도 고정하지 않는다. 특히:
- `checkIdentityAttempt`(admin-rate-limit.ts:284-313)는 대조 **전에** 카운터를 올리는 구조다. 대조를 앞으로 옮기면 오답이 카운터에 잡히지 않아 뒷자리 4자리 대입이 무제한이 된다. 같은 파일 146-151 주석이 관리자 로그인에 대해 같은 함정을 적어 두었고, round2 #2(H1)가 바로 그 유형의 사고였다.
- 서명 본문을 템플릿 사본으로 완성하는 배선(sign.ts:179-184)은 `lib/contracts/service.test.ts:360-392`가 `buildSignedContractContent` 단위로만 본다. 배선이 현재 파일로 돌아가도 CI는 모른다(CLAUDE.md 0046 절의 "고객이 읽은 조항 ≠ 서명에 묶이는 조항").
- batch 패배 시 재조회해 `status`를 돌려주는 분기(:225-242)와, 성공 시에만 `resetIdentityAttempts`·`waitUntil(finalize)`이 불리는 약속은 `sign-transaction.test.ts:154-170`이 lib 단위로 TOCTOU 핵심만 막고 라우트 분기는 비어 있다.

④ 조건과 결과. 리팩터링으로 순서가 바뀌면 (a) 링크를 가진 제3자가 4자리 대입을 무제한 시도, (b) 고객이 읽은 조항과 서명 해시에 묶이는 본문이 불일치, (c) 이중 제출이 완료 화면 대신 오류 화면으로 가는 회귀 — 셋 다 CI 초록으로 배포된다. 현재 코드는 전부 올바르다.

⑤ **수정**. `tests/api/contracts/sign.test.ts` 신설(`@jest-environment node`).
- DB: `lib/contracts/sign-transaction.test.ts:30`·`tests/api/bookings/createBankDeposit.test.ts:41-45`의 인라인 마이그레이션 루프를 복사해 in-memory libsql을 만든다(`tests/helpers`에는 `showsDb.ts`만 있고 계약용 헬퍼는 없다). `db/client`·`@vercel/functions`(waitUntil)·`lib/contracts/finalize`만 mock. `admin-rate-limit`은 **실제 모듈**을 쓴다 — 순서 검증의 핵심이다.
- 표 구동 케이스: 405 / body 형식 400 / 토큰 불일치 404 / expired 409 / 뒷자리 오답 400 **뒤에** `rate_limits` 행 count 증가(대조보다 앞에서 세는지) / locked·throttled 429 / `identityConfirmed` 누락 400 / 동의 누락 400 / pending 서명 없음 409 / 성공 200 + `contracts.status='signed'` + `content_hash`가 `contract_template_snapshots` 사본 기준(사본과 현재 `contract-template.md`를 다르게 심어 구별) + `resetIdentityAttempts`로 `rate_limits` 비워짐 + `waitUntil` 1회 / 같은 요청 재제출 → 409 `status:'signed'` / 성공 직전 관리자 취소를 끼워 넣어 409 `status:'cancelled'`.
- '동시 요청' 케이스는 적지 않는다. `:memory:` libsql 단일 연결은 순차 실행이라 동시성을 검증하지 못한다.
- `jest.config.js` `collectCoverageFrom`에 `pages/api/**`를 넣을지는 TST-16에서 다룬다.

⑥ 비고: 검증자가 바로잡음 — "지금 깨진 것 없음, 부품은 전부 lib 테스트 있음"이라 P1→P2. 원 수정안의 'applyMigrations 헬퍼 재사용'·'병렬 두 요청'은 존재하지 않거나 검증되지 않아 위와 같이 바꿨다.

#### TST-3. 헤더가 약속한 /api/orders/mixing·/api/shows/orders 계좌 입금 라우트 테스트가 둘 다 없다 (mixingHandler는 import만) [P2 · S]

① `tests/api/bookings/createBankDeposit.test.ts:3-4`·`:29`, `pages/api/orders/mixing.ts:12-46`, `tests/api/shows/orders-refund.test.ts:56-98`, `lib/booking/bankDeposit.integration.test.ts:287`, `package.json:46`

② 지금 코드.

```ts
// tests/api/bookings/createBankDeposit.test.ts:3
 * POST /api/bookings·/api/orders/mixing·/api/shows/orders의 **계좌 입금** 분기 — 결제수단 검사, 남용 상한, 안내 메일 ...
// :29
import mixingHandler from '../../../pages/api/orders/mixing';
```

`mixingHandler`의 사용처는 29행 하나뿐이다(`git log -S'mixingHandler'`는 도입 커밋 d07ecf19e1 하나 — 처음부터 쓰이지 않았다). 실제 `describe`는 `/api/bookings` 하나다. `/api/shows/orders`는 import조차 없고, `tests/api/shows/orders-refund.test.ts:56-98`이 POST `/api/shows/orders`를 보지만 `bank_transfer` 케이스는 0건이다. `pages/api/orders/mixing.ts:12-46`의 분기(429 → `paymentMethod` 400 → `bank_transfer`면 `deliverBookingDepositGuide` + `manageToken`이 든 `manageUrl` → 아니면 토스용 금액)는 어느 테스트도 호출하지 않는다.

③ DB 전이는 `lib/booking/bankDeposit.integration.test.ts:287`이 `createMixingOrder(bank_transfer)`로 검증하므로 서버 계약이 전혀 없는 것은 아니다. 비어 있는 것은 **라우트 층**이다 — `paymentMethod` 검증 400, IP 상한 429, 405, `bank_transfer` 응답의 `manageUrl`에 DB `manage_token`이 실리는지, 안내 메일 호출. 화면 테스트(`MixingOrderWizard.test.tsx:50`)는 fetch를 mock하므로 라우트 계약은 라우트 테스트만이 고정할 수 있다. 미사용 import 경고가 CI에 안 뜬 이유는 `package.json:46` lint 대상(`pages components lib data utils hooks types scripts middleware.ts next.config.mjs`)에 `tests/`가 없어서다(TST-27).

④ 조건과 결과. 믹싱 계좌 입금 응답의 `manageUrl` 토큰이나 400/429 분기가 깨져도 테스트가 모른다. 현재 깨진 곳은 없다.

⑤ **수정**. 같은 파일에 `describe('POST /api/orders/mixing — 계좌 입금')`을 추가하고 기존 `call(handler, body)`·DB 셋업·`sendDepositGuideEmails` mock을 재사용한다.
1. `paymentMethod` 미지정 → 201 + `itemAmount/vatAmount/totalAmount`
2. `'bank_transfer'` → 201, `orders.status='awaiting_deposit'`, `sendDepositGuideEmails` 1회, `manageUrl === \`/ko/booking/manage/${orderNo}?token=${DB manage_token}\``
3. `'cash'` → 400
4. `consumeRateLimit`이 false → 429
5. GET → 405
`/api/shows/orders`의 `bank_transfer` 케이스는 `tests/api/shows/orders-refund.test.ts`(createTestDb 헬퍼)에 넣고, 이 파일 헤더에서 shows 언급을 지운다. 미사용 import는 `package.json:46` lint 대상에 `tests`를 더해야 잡힌다(TST-27) — `no-unused-vars`는 warn이라 그래도 CI를 세우진 못한다.

⑥ 비고: 검증자가 바로잡음 — "CI 로그에도 찍힘"은 사실이 아니다(tests/는 lint 자체가 안 돈다). 헤더가 약속한 두 라우트 모두 비어 있어 불일치 범위를 둘로 넓혔다.

#### TST-4. 정기결제 청구 크론 핸들러의 오케스트레이션(건별 격리·메일 실패 기록·재개 안내 재시도)이 무테스트 [P2 · M]

① `pages/api/cron/billing-charge.ts:74-261`, `lib/billing/service.ts:1022-1032`, `lib/billing/service.integration.test.ts`, `tests/api/cron/purgeOrders.test.ts`(양식 선례), `vercel.json:35-36`

② 지금 코드. 핸들러(:125-261)의 순서: `endExpiredSubscriptions` → `resumeExpiredPauses` → `listPendingResumeNotices` 루프 → `listDueSubscriptions` → 건별 `processOne`(`claimDueSubscription` → `chargeCycle` → 성공/실패 메일, paused면 운영자 알림). 약속은 코드 주석에만 있다.
- 각 구독 독립 try/catch(:203-211)
- 성공·실패 메일의 `notificationError`를 `subscriptions`에 기록(:99-101, :120-122, :186-189)
- paused면 `sendSubscriptionOperatorAlert('paused')`(:117-119)
- 재개 안내 메일 실패 시 `clearResumeNotice`를 부르지 않아 다음 날 재시도(:186-191)
- 건별 예외가 있어도 200(:239-245), 최상위 throw는 500 + 운영자 메일(:246-260)

이 핸들러를 import하는 테스트는 없다(`lib/email/operatorAlert.test.ts`는 문자열 `'cron/billing-charge'`만 검사). `service.integration.test.ts`는 `chargeCycle`·`claimDueSubscription`·`resumeExpiredPauses` 등 부품만 본다.

③ 이 크론은 돈이 나가는 유일한 자동 경로다(매일 00:00 UTC). 부품은 검증되지만 엮는 방식이 바뀌어도 CI는 모른다. 중복 청구는 이 공백과 무관하다 — `subscription_payments (subscriptionId, cycleYm, attempt)` 유니크 인덱스 + `claimDueSubscription`이 막고(파일 머리 :15-19, `service.integration.test.ts:779`·`:339`), `resumeExpiredPauses`가 첫 청구일을 `MIN_RESUME_NOTICE_DAYS`(3일) 뒤로 잡아 같은 실행에서 청구되지 않는다(:143-149).

④ 조건과 결과. try/catch 위치가 바뀌면 한 구독의 예외가 뒤 구독 전원의 청구를 막는다. 재개 안내 실패에도 `clearResumeNotice`가 불리면 고객이 예고 없이 청구를 맞는다(재시도가 사라지는 회귀에서만). 메일 실패 기록이 빠지면 헬스체크가 모른다. 전부 CI 초록으로 배포된다. 현재 코드는 올바르고, 구독은 관리자 생성만 가능하며 토스 빌링 심사 대기 상태라 지금 사고가 난 것은 아니다.

⑤ **수정**. `tests/api/cron/billingCharge.test.ts` 신설 — `purgeOrders.test.ts` 양식. `lib/cron/auth`·`lib/billing/service`·`lib/billing/email`·`lib/email/resend`·`db/client`를 `jest.mock`하고 핸들러만 검증.
- 401 / 405
- due 3건 중 2번째 `processOne`이 throw해도 1·3번째 `chargeCycle` 호출 + `summary.errors` 1건 + 운영자 메일 1통 + 200
- `chargeCycle` → `{ok:false, status:'paused'}` → failed·paused 카운트 + `sendSubscriptionOperatorAlert('paused')`
- 성공 메일이 `notificationError`를 돌려주면 `subscriptions` update 호출
- 재개 안내 메일 실패 시 `clearResumeNotice` 미호출 + errors 기록 / 성공 시 호출 + notified 증가
- `resumeExpiredPauses`가 `listDueSubscriptions`보다 먼저(`invocationCallOrder` — "재개 실패해도 그날 청구는 돈다"의 근거로만)
- 최상위 throw → 500 + '전체 실패' 메일
중복 청구 방지는 이 테스트의 목적이 아니다 — `service.integration.test.ts:779`가 이미 고정한다.

⑥ 비고: 검증자가 바로잡음 — "재개 순서가 바뀌어 중복 청구"는 핸들러 순서와 무관하게 불가능하므로 영향에서 뺐다.

#### TST-5. 크론 핸들러 8개 무테스트 — 파기 부분 실패 알림·백업 실패 알림·후기메일 실패 분기가 고정되지 않음 [P2 · M]

① `pages/api/cron/purge-contracts.ts:36-65`, `pages/api/cron/backup-contracts.ts`, `pages/api/cron/review-requests.ts`, `pages/api/cron/expire-show-orders.ts`, `pages/api/cron/health-check.ts`, `pages/api/cron/gsc-audit.ts`, `pages/api/cron/social-refresh.ts`, `pages/api/cron/billing-charge.ts`(TST-4), `tests/api/cron/`(purgeFunding·purgeOrders만), `lib/cron/auth.ts`, `vercel.json`

② 지금 코드. 크론 10개 중 테스트가 있는 것은 purgeFunding·purgeOrders 둘뿐이고 나머지 8개는 커버리지 0%다. `purge-contracts.ts:36-65`:

```ts
if (result.failed > 0) { ... sendEmail(...) ... return res.status(500)... }
```

'계약서 제12조로 약속한 파기'의 부분 실패 알림 분기다. 코드 주석대로 예전에는 로그만 남기고 200을 돌려줘서 약속이 깨졌던 바로 그 자리다. `docs/code-review-2026-08-24.md:53`이 "`cron/*` 3개 무테스트 — `purge-contracts`는 데이터 삭제 로직"으로 적었던 항목이 그대로 남았다.

③ purge-contracts의 '일부 실패면 운영자 메일 + 500', backup-contracts의 '실패면 메일 + 500', review-requests의 '부분 실패면 메일, 통째 실패면 500'은 과거에 조용히 깨졌던 약속이라 회귀 테스트 가치가 크다. 크론마다 응답 규약이 다르다(purge-contracts는 부분 실패 시 500, review-requests는 부분 실패여도 200+메일, expire-show-orders는 재시도 안내문이 다름) — 공통 래퍼로 합칠 대상이 아니다.

④ 조건과 결과. 새 크론에서 `isCronAuthorized` 호출을 빠뜨리거나, 파기/백업 실패 알림이 다시 로그 전용으로 돌아가도 CI가 모른다. 계약 3년 파기와 백업은 안 돌아도 아무도 모르는 유형이다.

⑤ **수정**. `withCron` 래퍼는 만들지 않는다. `tests/api/cron/purgeFunding.test.ts` 패턴(`isCronAuthorized`·`sendEmail`·lib 함수를 mock)으로 purge-contracts, backup-contracts, review-requests, expire-show-orders를 우선 각각 세 케이스(401 / 정상 200 / 실패 시 `sendEmail` 호출 + 500)로 덮고, purge-contracts는 `failed > 0` 분기(메일 + 500)를 하나 더 둔다. 추가로 가드 테스트 하나(코드 5줄): `pages/api/cron/*.ts` 전부가 `isCronAuthorized`를 import하고, `vercel.json` `crons[].path`와 1:1인지 본다. health-check·gsc-audit·social-refresh는 후순위.

⑥ 비고: 검증자가 바로잡음 — "크론 10개가 같은 30줄을 복사했다"는 진단과 `withCron` 추출안은 응답 규약이 달라 기각. 405 검사 유무는 Vercel Cron이 GET만 보내고 Bearer 인증이 막아 실제 변종 위험이 아니다.

#### TST-6. 테스트에서 스토리 캐시가 꺼져 llms-contact 한 파일이 CI Test 단계의 70%를 먹는다 [P2 · S]

① `lib/stories.ts:44`, `tests/api/llms-contact.test.ts`, `pages/api/llms.ts`, `pages/api/llms-full.ts`

② 지금 코드.

```ts
// lib/stories.ts:44
const enableCache = process.env.NODE_ENV === 'production'
```

jest는 `NODE_ENV=test`라 `getAllStories`가 호출마다 `content/stories` 1,090편을 다시 파싱한다(tsx 실측 ko 2,690ms, 캐시 시 0ms). llms-full은 7개 로케일 × 이를 호출하고, `llms-contact.test.ts`는 파일 안에서 6번 부른다. 실측: 'mobile number in llms-full.txt' 25.8s, 'H1 llms-full' 19.0s, 'HEAD llms-full' 18.4s, llms.txt 호출당 2.7~4.2s. 로컬 78~88초, 최신 main CI(run 37959966859)에서는 133.6초로 Test 단계 194초의 약 70%다.

③ 동기 블로킹이라 jest의 5초 타임아웃도 작동하지 않는다 — 느려져도 실패하지 않고 CI 시간만 늘어난다. `NODE_ENV=production`으로 같은 파일을 돌리면 78초가 1.4초로 줄고 16/16이 통과한다. stories·serviceRelatedStories·stories-category-static-props·llmsPriority 테스트 37개도 같은 조건에서 통과한다(fs mock·cwd 변경 테스트가 없어 캐시가 오염될 경로가 없다).

④ 조건과 결과. PR마다 CI에서 약 2분을 쓴다. HEAD에서 실패하는 것은 없으므로 결함은 '느림' 하나다.

⑤ **수정**. `lib/stories.ts:44`를 바꾼다.

```ts
const enableCache = process.env.NODE_ENV !== 'development'
```

jest는 파일마다 모듈 레지스트리가 격리돼 캐시가 파일 간에 새지 않는다. 바꾼 뒤 전체 스위트를 한 번 돌려 확인한다. `toHaveLength(16)`은 라이브 콘텐츠가 아니라 코드 상수 `CURATED_GUIDES`를 잠그는 의도된 단언이므로 건드리지 않는다. `beforeAll`에서 llms/llms-full 본문을 한 번만 만들어 단언들이 재사용하는 것은 선택 사항이다. 이 한 줄이 TST-8(CI 병렬화)보다 큰 단일 단축이다.

⑥ 비고: 검증자가 바로잡음 — 원 지적의 '운영 DB 조회 위험'(TST-17과 중복)·'동시 세션 불일치'는 근거 없어 제외. 같은 자리를 다른 축(SEO 페이지·라우팅·SEO·i18n)도 지적: "next.config·middleware 단독 리다이렉트 슬러그(practice-room-drum1)가 스토리 목록·llms에 남는다".

#### TST-7. 펀딩 콘텐츠 기준선 --update가 위험한 변경(리워드 삭제·금액·한정 변경, 프로젝트 삭제)도 그대로 승인한다 [P2 · M]

① `scripts/funding-baseline.ts:125-141`, `content/funding.baseline.test.ts:16-20`, `content/funding.baseline.json`, `content/fundingTermsHash.ts:96-135`(비교 대상 패턴)

② 지금 코드.

```ts
// scripts/funding-baseline.ts:134-141
if (args.includes('--update')) {
  const payload = { ... entries: now };
  fs.writeFileSync(baselinePath, ...);
  return;
}
```

기존 기준선과 비교하지 않고 덮어쓴다. 반면 `content/fundingTermsHash.ts` `assertBaselineUpdateAllowed`와 `fundingImages`·`uiPatterns` 기준선 테스트는 '위험한 방향의 갱신'을 거부한다. `content/funding.baseline.test.ts:16-20`은 diff가 있으면 *추가*(project-added/reward-added)까지 실패시키므로 `--update`가 일상 절차가 된다(`content/funding.baseline.json` 이력이 대부분 리워드·프로젝트 추가 커밋이다).

③ 추가도 실패로 보는 설계라 `--update`가 반사적으로 쓰이고, 같은 명령이 project-removed·reward-removed·reward-amount-changed·reward-limit-changed까지 통과시킨다. 가드 대상은 `content/funding/` 4개 파일(smoke-test 제외 3개)이지만 mok-jareugi(10/24 마감)와 sabbaha-slung은 후원이 쌓이는 중이다. 개설자 DB 프로젝트는 `creatorProjectWrite.lockedViolation`이 따로 막으므로 범위는 이 파일들이다.

④ 조건과 결과. 진행 중인 펀딩 파일에서 리워드 id나 금액이 바뀌고 `--update`로 CI를 통과하면 한정 재고 리셋(100개 한정이 200개 판매)·단가 불일치가 배포된다 — 실제 돈으로 간다.

⑤ **수정**. 추가(project-added·reward-added)는 지금처럼 실패시켜 기준선 갱신을 강제한다(새 리워드가 기준선에 들어가는 시점이 있어야 그 뒤 변경을 잡는다). `--update`는 기존 기준선과 diff해서 removed/amount-changed/limit-changed가 하나라도 있으면 `ALLOW_FUNDING_BASELINE_BREAK='<slug>.<rewardId>: 이유'` 환경변수 없이는 거부한다(`fundingTermsHash`의 `allowCreate`와 같은 패턴). 추가만 있는 갱신은 그대로 통과. origin/main 기준선과의 대조는 하지 않는다. 회귀 테스트: `scripts/funding-baseline.test.ts`에 '금액 변경 + 환경변수 없음 → 거부', '추가만 → 통과' 두 케이스.

⑥ 비고: 검증자가 바로잡음 — 원 제안 ①('추가는 통과')은 보호를 약화시키므로 기각, ③(origin/main 대조)은 CI 구조 변경이 커서 기각.

#### TST-8. CI가 단일 직렬 잡(약 7.5분)이고 PR 동시성 취소가 없다 [P2 · M]

① `.github/workflows/ci.yml:1-64`, `package.json`

② 지금 코드. 최신 main 실행(37959966859)은 단일 잡 446초: checkout 36 → npm ci 23 → type-check 31 → lint 15 → 게이트 3개 ~3 → Test 194 → Build 130 → font check 2, 전부 직렬. `ci.yml`에 `concurrency:`가 없다. 브랜치 보호는 `strict=false`, 필수 체크는 'Type-check, Lint, Build' 하나.

③ type-check/lint, jest, build가 한 잡에서 순차 실행되고 PR 연속 푸시 때 이전 실행이 취소되지 않는다. 병렬화하면 PR 피드백이 약 7.5분에서 4.5분 안팎으로 준다(잡마다 npm ci·manifests 약 30초 중복).

④ 조건과 결과. PR 피드백 지연. 병합 후 불일치(`strict=false`)는 main CI가 사후에 잡는다.

⑤ **수정**. 순서가 중요하다.
1. 먼저 TST-6(캐시 켜기)으로 Test 단계를 약 130초 줄인다.
2. 병렬화는 static / test / build 세 잡으로 나누되, `needs`로 모은 최종 집계 잡의 **이름을 현재 필수 체크 이름 'Type-check, Lint, Build'로 유지**한다. 이름을 갈면 브랜치 보호와 맞지 않는 동안 모든 PR이 병합 불가가 된다.
3. concurrency는 PR 이벤트에만 건다.
   ```yaml
   concurrency:
     group: ci-${{ github.event_name == 'pull_request' && github.ref || github.run_id }}
     cancel-in-progress: ${{ github.event_name == 'pull_request' }}
   ```
   main 푸시에는 걸지 않는다 — 같은 그룹의 **대기 중인** 실행은 `cancel-in-progress=false`여도 새 실행이 오면 취소되므로, 연달아 머지하면 중간 커밋의 indexnow 잡이 사라지고 `github.event.before..sha` diff의 변경 URL이 제출에서 영영 빠진다.
4. `strict=true`는 도입하지 않는다. 하루 PR 약 15개가 자동 병합되는 빈도에서 매 병합마다 나머지 PR이 재기반·재실행되어 정체를 만든다. 병합 큐 없이는 권하지 않는다.

⑥ 비고: 검증자가 바로잡음 — 원 제안의 `group: ci-${{ github.ref }}`는 main 푸시에도 걸려 indexnow 누락 사고를 만든다. 잡 이름 분리·strict=true도 기각.

#### TST-9. db/schema.ts ↔ 마이그레이션 SQL의 컬럼 단위 드리프트 가드가 없다 (funding_pledges·shows 일부만 확인) [P2 · M]

① `db/schema.funding.test.ts:14-27`, `db/schema.shows.test.ts`, `db/schema.ts`(sqliteTable 40개), `.github/workflows/ci.yml`, `scripts/check-migration-drift.mjs`, `drizzle.config.ts`, `lib/ops/migrationJournal.test.ts`

② 지금 코드. `db/schema.funding.test.ts:14-27`은 `funding_pledges` 컬럼 5개 이름만 `arrayContaining`으로 보고, `db/schema.shows.test.ts`는 shows 테이블 9개 생성만 본다. CI에 `drizzle-kit generate/check` 단계가 없다(`grep drizzle-kit` — package.json·drizzle.config.ts뿐). `scripts/check-migration-drift.mjs`는 저널 엔트리 수와 운영 `__drizzle_migrations` 행 수만 비교하며 TURSO 시크릿이 없으면 exit 0이다(TST-28).

③ CLAUDE.md가 가장 크게 경고하는 사고(관계 조회가 전 컬럼을 SELECT → `no such column`으로 결제 확인 전체 실패)는 'schema.ts에 컬럼을 넣고 `db:generate`를 빠뜨린' 경우에도 똑같이 난다. 이를 막는 것은 우연히 그 컬럼을 건드리는 통합 테스트뿐이다. 반대로 마이그레이션에만 있고 schema.ts에 없는 컬럼도 검출되지 않는다.

④ 조건과 결과. schema.ts만 수정하고 `db:generate`를 빠뜨리면 테스트(해당 컬럼 미사용 시)·타입체크·빌드가 모두 초록이고 배포 후 런타임에서 `no such column`. 지금 드리프트는 없다 — 마이그레이션 52개를 `:memory:`에 적용해 `getTableConfig`로 뽑은 40개 테이블의 컬럼·notNull을 양방향 비교하면 차이 0건이고, scratchpad 복사본에서 `drizzle-kit generate`가 'No schema changes'를 낸다. 예방 가드다.

⑤ **수정**. 스냅샷 기반 generate 검사가 더 싸고 정확하다. CI(main과 PR 모두)에 단계 추가:

```yaml
- name: Schema ↔ migration drift
  run: |
    npx drizzle-kit generate --name ci_drift
    test -z "$(git status --porcelain drizzle)" || { echo '::error::db/schema.ts가 마이그레이션과 다릅니다 — npm run db:generate 누락'; git status --porcelain drizzle; exit 1; }
```

`git diff --exit-code`로는 부족하다 — 새로 생긴 `0052_ci_drift.sql`은 untracked라 잡히지 않는다. scratchpad 복사본에서 schema.ts에 컬럼을 추가하면 generate가 Turso 환경변수 없이도 파일을 만들어 내는 것을 확인했다. `db/schema.drift.test.ts`(getTableConfig vs `PRAGMA table_info` 양방향 비교)는 선택.

⑥ 비고: 검증자 확인(confirmed). 같은 자리를 다른 축(DB 스키마·마이그레이션·쿼리)도 지적: "schema.ts와 마이그레이션 동기를 검증하는 CI 게이트가 없다 (통합 테스트가 일부 표만 우연히 커버)".

#### TST-10. 관리자 API 전수 인증 가드가 없다 (현재 21개 모두 인증함, 신규 라우트의 누락을 CI가 못 잡음) [P2 · S]

① `pages/api/admin/**`(21개 라우트), `lib/contracts/admin-auth.ts`, `lib/payments/refundAccountView.ts:39`, `middleware.ts:226`, `pages/api/admin/artists/payouts.ts`·`payouts/[id].ts`, `pages/api/admin/blocks/index.ts`·`[id].ts`, `pages/api/admin/bookings/index.ts`, `tests/payments/sharedCheckout.guard.test.ts`(양식 선례)

② 지금 코드. 21개 중 19개가 `authenticateAdminApi`를 직접 호출하고(`auth.ts`는 GET 분기에서 호출, POST는 로그인), 2개(`orders/[id]/refund-account.ts`, `funding/pledges/[id]/refund-account.ts`)는 `handleRefundAccountView`에 위임하며 그 안(`refundAccountView.ts:39`)에서 인증한다. 인증은 각 핸들러 첫 줄의 수작업 호출이고 `middleware.ts`는 `/admin` 페이지만 다룬다(:226) — `/api/admin`은 보호하지 않는다. 열거 검증 테스트는 없고, artists/payouts(+[id])·blocks(+[id])·bookings/index 5개는 라우트 테스트 자체가 0이다.

③ 환불 계좌·정산 PII를 다루는 영역에서 인증이 수작업 한 줄에 달려 있다. 새 라우트에서 빠뜨려도 CI가 서지 않는다.

④ 조건과 결과. 새 관리자 API에서 `authenticateAdminApi` 호출을 빠뜨리면 무인증 노출이 CI 초록으로 배포된다. 현재 누락은 없다.

⑤ **수정**. 동적 테스트(모든 default export를 mock 인증으로 호출)는 만들지 않는다 — 핸들러마다 method 분기·import 시점 의존(`admin-auth`는 import 때 `ADMIN_ACCOUNTS`를 읽고 틀리면 던진다)·db 클라이언트가 달라 mock이 라우트별로 늘어난다. 대신 `sharedCheckout.guard.test.ts`와 같은 정적 가드: `tests/api/admin/allRoutesRequireAuth.test.ts`가 `pages/api/admin`을 재귀 열거해 각 파일 소스가 `authenticateAdminApi(` 또는 `handleRefundAccountView(` 호출을 담는지, 그 호출이 첫 `await getDb()`/`req.body` 사용보다 **앞**에 있는지(문자열 인덱스 비교) 검사한다. 예외 목록은 비워 두거나 이유와 함께 둔다. 동작 검증은 라우트별 401 테스트(payouts·payouts/[id]·blocks·blocks/[id]·bookings/index 5개)로 보강한다.

⑥ 비고: 검증자가 바로잡음 — 원 수정안의 동적 전수 호출은 무겁고 깨지기 쉬워 정적 가드로 대체.

#### TST-11. 예약금 결제 링크 화면(PaymentLinkCheckout)은 커버리지 0%이고 '공용 체크아웃 가드'는 소스 문자열 grep이다 — 10/06 사고(계좌 입금 누락)와 같은 모양의 구멍 [P2 · M]

① `tests/payments/sharedCheckout.guard.test.ts:52-60`, `components/payments/PaymentLinkCheckout.tsx`, `components/payments/usePaymentCheckout.ts`, `components/payments/PaymentMethodChoice.tsx`, `components/booking/BookingWizard.test.tsx`, `components/booking/MixingOrderWizard.test.tsx`, `tests/api/payment-links/order.test.ts:76`

② 지금 코드.

```ts
// tests/payments/sharedCheckout.guard.test.ts:55-58
const source = read(file);
expect(source).toMatch(/usePaymentCheckout/);
if (!ownMethodChoice) expect(source).toMatch(/PaymentMethodChoice/);
```

파일 텍스트 정규식이다. `PaymentLinkCheckout.tsx`는 어떤 테스트도 import하지 않는다(참조는 가드 테스트의 문자열과 `pages/[locale]/pay/[slug].tsx`뿐). 현재 기본값인 위젯 모드에서 '계좌로 직접 입금' 선택 UI를 실제로 마운트하는 테스트는 `ShowBookingForm.test.tsx:94-132`와 `PledgeWizard.test.tsx`뿐이다. `BookingWizard.test.tsx`·`MixingOrderWizard.test.tsx`에는 '계좌' 언급이 0건, `paymentPickerForms.test.tsx`는 `?pay=v2` 목록 모드만 본다. 서버 쪽(`order.test.ts:76`의 `bank_transfer`)은 있지만 화면은 없다.

③ 가드가 '문자열이 파일에 있는가'만 본다. 주석에 이름을 언급하거나 import만 하고 렌더하지 않아도 통과한다. ESLint `no-unused-vars`가 warn이라 린트도 막지 못한다. 같은 파일의 마지막 테스트(공용 체크아웃 밖에서 `TossPaymentWidget`·SDK 직접 import 금지)가 10/06 사고의 직접 원인(카드 전용 위젯 선택)은 막는다 — 남은 구멍은 '공용 컴포넌트를 import하고 렌더/분기를 지운' 부류다.

④ 조건과 결과. `PaymentLinkCheckout`에서 `PaymentMethodChoice` 렌더를 지우고 import만 남기거나, 계좌 입금 분기를 제거해도 가드와 CI가 통과한다. 운영자가 화면에서야 발견하는 10/06과 같은 형태다.

⑤ **수정**. `tests/payments/`에 공용 `describe.each`를 추가해 각 CHECKOUT_FORM 화면(PaymentLinkCheckout, BookingWizard, MixingOrderWizard, ShowBookingForm)을 RTL로 마운트하고 기본(위젯) 모드에서 `screen.getByRole('radio' | 'button', { name: /계좌로 직접 입금/ })`와 '카드·간편결제' 두 선택지가 모두 보이는지 확인한다. `PaymentLinkCheckout`은 계좌 선택 → 제출 시 `bank_transfer` 경로(fetch body의 `paymentMethod`)까지 1케이스. 소스 grep 가드는 보조로 남긴다. 우선순위: PaymentLinkCheckout > BookingWizard·MixingOrderWizard 기본 모드.

⑥ 비고: 검증자 확인(confirmed). "사고와 같은 모양"은 다소 강한 표현이며 정확히는 사고의 변종(import만 남긴 회귀)이다.

#### TST-12. 토스 빌링 HTTP 클라이언트(chargeBillingKey/issueBillingKey)의 요청·오류 매핑이 무테스트 [P2 · S]

① `lib/billing/toss-billing.ts:35-46`(CONFIG_ERROR), `:54`(Idempotency-Key), `:60-68`(오류 매핑·NETWORK_ERROR), `:76-86`(issueBillingKey), `:154-179`(fetchPaymentByOrderId), `lib/billing/toss-billing.methodAlert.test.ts`, `lib/billing/service.ts:529-532`, `lib/booking/toss.test.ts`(패턴)

② 지금 코드. 이 모듈의 유일한 테스트는 `toss-billing.methodAlert.test.ts`(chargeBillingKey 성공 경로 3건, fetch를 mock해 카드/미지 수단 알림만 확인)다. 재측정: 문장 46.15% · 분기 7.5% · 라인 50%, 미커버 `:42, 61, 67, 76-86, 154-179`. 즉 다음이 전부 무검증이다.
- `request()`의 CONFIG_ERROR(시크릿 없음)
- `Authorization: Basic base64(secret:)` 인코딩
- `Idempotency-Key` 헤더 조건부 포함(chargeBillingKey만)
- `res.ok=false` → `{ok:false, code, message}` 매핑
- 타임아웃·JSON 파싱 실패 → NETWORK_ERROR
- `issueBillingKey` 응답에 billingKey 없음 → INVALID_RESPONSE, `card.number`/`cardNumber` 폴백
- `fetchPaymentByOrderId`(:154-179) 전체 — `chargeCycle`의 pending 회차 대사 경로(service.ts 약 404행)가 쓴다

`service.integration.test.ts`·artistSupport·admin subscriptions 테스트는 이 모듈을 통째로 mock한다.

③ 이 모듈은 'NETWORK_ERROR = 물어보지도 못했다 → 재조회로 대사'라는 이중 청구 방지 전제의 출발점이다. `service.ts:529-532`가 NETWORK_ERROR·CONFIG_ERROR를 "물어보지도 못했다"로 보고 orders를 pending에 두는 판단이 이 파일의 오류 분류에서 나온다.

④ 조건과 결과. 헤더명·인코딩·오류 분류를 잘못 고쳐도(예: fetch reject를 거절 코드로 반환, 멱등키 헤더 이름 오타) 대사 로직 전체가 잘못된 전제로 돌아가 이중 청구 또는 영구 미청구가 생긴다. CI는 초록.

⑤ **수정**. `lib/billing/toss-billing.test.ts` 신설 — `@jest-environment node`(파일 전체가 `AbortSignal.timeout`을 쓴다, `lib/booking/toss.test.ts` 머리 주석 참조). 기존 methodAlert 테스트의 `global.fetch` mock 설정을 재사용.
1. Authorization 값이 `base64(\`${TOSS_BILLING_SECRET_KEY}:\`)`
2. `chargeBillingKey`는 `Idempotency-Key` 포함, `issueBillingKey`는 미포함
3. 4xx JSON → `{ok:false, code, message}`
4. fetch reject(AbortError)·HTML 502(json 파싱 실패) → NETWORK_ERROR
5. 시크릿 미설정 → CONFIG_ERROR
6. billingKey 누락 → INVALID_RESPONSE
7. card 필드 폴백
8. `fetchPaymentByOrderId`: 200 목록/빈 목록/네트워크 오류 세 경우

⑥ 비고: 검증자 확인(confirmed). 원 지적이 빠뜨린 `fetchPaymentByOrderId`를 같은 우선순위로 더했다.

#### TST-13. 계약 백업·고아 PDF 삭제(backup.ts)와 서명 후처리(finalize.ts)가 무테스트 [P2 · M]

① `lib/contracts/backup.ts:35-131`(removeExpiredBackups·removeOrphanPdfs), `lib/contracts/finalize.ts:49-98`, `lib/contracts/pdf.ts`(blockExternalRequests), `lib/contracts/pdf-storage.ts`(loadOrRenderContractPdf), `pages/api/contracts/[id]/sign.ts`

② 지금 코드. `finalize.ts`·`pdf.ts`·`backup.ts`를 import하는 테스트가 없다(grep 0건; 기존 coverage-final.json도 finalize 0/37, backup 0/45, pdf 0/30). `finalize.ts:10-14` 주석 "각 단계를 독립적으로 감싸, PDF가 실패해도 확인 메일은 나가도록 한다" — PDF try(:49-62) / 메일 try(:70-86) / 결과 기록 try(:88-98) 3블록과 `problems` 누적 후 `notificationError` 기록이 주석 약속뿐이다. `backup.ts`에는 만료 백업 삭제(`removeExpiredBackups`), 어느 계약도 가리키지 않는 PDF 삭제(`removeOrphanPdfs`: `pdfUrl` 집합 비교·24시간 유예·`contracts/backup/` 제외 — 계약 PDF를 **실제로 지운다**), put 실패 시 만료 백업을 지우지 않는 규칙(2026-10-02 리뷰에서 추가), 백업 JSON의 `signToken` 제거가 있다.

③ 위험이 큰 쪽은 backup.ts다. finalize의 실패는 완충돼 있다 — 문제는 `notificationError`로 기록되고 PDF는 `loadOrRenderContractPdf`가 보관본이 없으면 다시 만든다. 서명 자체의 무결성은 sign-transaction 테스트가 본다.

④ 조건과 결과. `removeOrphanPdfs`의 집합 비교나 24시간 유예가 잘못 바뀌면 보관 중인 서명 PDF가 지워진다. put 실패 시 정리 규칙이 뒤집히면 백업이 하나도 안 남는다. 둘 다 CI 초록이고, 계약 PDF 삭제는 되돌릴 수 없다.

⑤ **수정**. 우선순위 순.
1. `lib/contracts/backup.test.ts` — `@vercel/blob`(put/list/del)과 `getDb`를 mock. ① 백업 put 실패 시 `removeExpiredBackups`를 부르지 않고 고아 정리는 수행한 뒤 throw ② 고아 삭제는 `pdfUrl`로 참조된 PDF·24시간 이내 파일·`contracts/backup/` 아래 파일을 지우지 않음(각각 `del` 미호출 단언) ③ 28일 경과 백업만 삭제 ④ 백업 JSON에 `signToken`이 없음.
2. `lib/contracts/finalize.test.ts` — PDF throw여도 `sendContractSignedEmail` 호출·`notificationError`에 'PDF 생성 실패' 포함 / 고객 메일 `{ok:false}`면 문구 기록 / 모두 성공이면 null.
3. `pdf.ts`는 chromium 래퍼라 `blockExternalRequests`만 가짜 Page로 `data:` 허용·그 외 abort를 검증. 실제 chromium은 띄우지 않는다.

⑥ 비고: 검증자가 바로잡음 — 원 수정안은 backup을 '실패 시 throw'만 검증하라고 해서 핵심(고아 삭제 규칙)을 빠뜨렸다. 같은 자리를 다른 축도 지적: CON 전자계약 "HEAD 백업이 템플릿 사본 표를 담지 않는다 — c5bd4ad154가 넣은 것을 7868515e1f(PR #460)가 되돌렸다", DB 스키마 "원장(주문·결제·환불·후원·구독)의 백업이 없고 Turso 무료 플랜 PITR은 1일이다".

#### TST-14. 락·package.json 불일치와 npm 11 락이 CI npm ci에서만 드러난다 (방어가 문서뿐) [P2 · S]

① `.githooks/pre-commit:1-6`, `.github/workflows/ci.yml:26`, `package.json`(engines·packageManager 없음), 루트(.nvmrc/.node-version/.npmrc 없음)

② 지금 코드. 로컬 node v24.16.0 / npm 11.13.0, CI `node-version: '22'` → node v22.23.3 / npm 10.9.9. 락파일을 `npx -y npm@10 install --package-lock-only`로 만들라는 규칙은 CLAUDE.md 문서뿐이다. CI 실패 100건을 단계별로 집계하면 61건이 Install dependencies 단계였다(2026-08-29~09-04 집중, 2026-10-01에 2건). 로그 원인: `Missing: proxy-agent@8.0.2 from lock file`(npm 11이 만든 락을 npm 10이 거부, 09-01·10-01), `lock file's undici@6.28.0 does not satisfy undici@6.28.1`(09-04, package.json·락 불일치).

③ 그동안 type-check·lint·test·build가 전혀 돌지 않았다. 10-01 이후 9일간 0건이라 절차는 지금 통하고 있지만, 지키는 장치가 없다. 원인이 npm 버전만이 아니라 락과 package.json의 불일치까지 포함하므로 버전 핀으로는 반을 놓친다.

④ 조건과 결과. package.json이나 package-lock.json을 npm 11로 만지고 커밋하면 푸시 후 CI `npm ci`가 실패하고 그 PR의 검증이 통째로 멈춘다. Vercel 배포는 GitHub Actions와 독립이라 프로덕션은 검증 없이 나간다.

⑤ **수정**. `.githooks/pre-commit` 맨 앞(현재 4행 `|| exit 0` 앞)에 블록 추가(약 5초).

```sh
if git diff --cached --name-only | grep -qE '^(package\.json|package-lock\.json)$'; then
  npx -y npm@10 ci --dry-run --ignore-scripts >/dev/null 2>&1 || {
    echo 'package-lock.json이 npm 10 기준으로 package.json과 맞지 않습니다 — npx -y npm@10 install --package-lock-only' >&2
    exit 1
  }
fi
```

scratchpad 복사본에서 현재 락은 통과하고, package.json의 next 버전을 바꾸면 EUSAGE로 정확히 실패한다. `engines`·`engine-strict`·Node 핀은 넣지 않는다 — 로컬 `npm install`이 전부 막혀 툴체인을 22/10으로 내려야 하고, Node 메이저 차이로 테스트가 갈린 사례는 없다. `.nvmrc`(22)를 정보용으로 두는 것은 선택.

⑥ 비고: 검증자가 바로잡음 — 문제는 지적보다 컸고(61건) 수정안은 작아졌다(engines/engine-strict 기각). P1→P2(프로덕션 영향 없음). 같은 자리를 다른 축(SCR 운영 스크립트·도구)도 지적: "pre-commit 훅이 작업 트리 전체로 storyListing을 재생성해 git add — 공유 체크아웃에서 남의 미커밋 스토리 변경이 이번 커밋에 섞여 PR CI가 빨개진다".

#### TST-15. jest가 TZ를 고정하지 않아 UTC 이전 시간대에서 6개 테스트가 실패한다 (프로덕션 영향 없음, 잠재 결함) [P3 · S]

① `jest.config.js`, `jest.setup.js`, `lib/contracts/validation.ts:38-41`·`:74-92`, `components/admin/ContractForm.tsx:70-89`, `lib/contracts/validation.test.ts:141`·`:164`, `scripts/seo-preflight.test.ts:62`, `scripts/seo-preflight.mjs`

② 지금 코드. `TZ=America/Los_Angeles npx jest`(llms-contact 제외) → `Tests: 6 failed, 5712 passed`. validation.test.ts 5건(141행 말일 1개월, 164행 기간 버튼 4종) + seo-preflight.test.ts 1건(62행). `validation.ts:38-41`의 `parseDate = new Date(value)`는 `YYYY-MM-DD`를 UTC 자정으로 파싱하는데 `:74-92`의 `dayAfter`/`addMonths`는 `getDate()/setDate()/setMonth()`(로컬 시간)를 쓴다. 테스트가 부르는 `addMonths`는 `ContractForm.tsx:70-89`의 같은 패턴이다. `jest.config.js`·`jest.setup.js`·`package.json`에 TZ 설정이 없다(`git log -S"TZ"` 결과 없음). round2 #3이 "jest `TZ=UTC` 고정"을 요구했으나 template.ts 쪽만 고쳐졌다.

③ 음수 오프셋 시간대에서만 하루가 밀린다. 스위트 결과가 호스트 TZ에 따라 달라지는데 고정 장치가 없다.

④ 조건과 결과. CI(UTC)·운영자 맥(KST)·Vercel(UTC)에서는 발현하지 않는다. 클라우드 샌드박스나 다른 시간대 호스트에서 돌리면 6건이 실패해 원인 파악에 시간을 쓴다.

⑤ **수정**. `jest.config.js`에 `globalSetup: '<rootDir>/jest.globalSetup.js'`를 추가하고 그 파일에 `module.exports = () => { process.env.TZ = 'UTC'; };`. 코드는 선택으로 `ContractForm.addMonths`·`validation.ts`를 `getUTC*`/`Date.UTC` 기반으로 바꾸고, `seo-preflight.mjs`의 `--since`에 오프셋을 명시한다. 회귀 테스트: 위 6건이 `TZ=America/Los_Angeles`에서 통과.

⑥ 비고: 검증자가 바로잡음 — "서버를 다른 리전으로 옮기면 발현"은 가정이고, 원인 지점에 `ContractForm.tsx`를 추가했다.

#### TST-16. 커버리지 임계값이 실측보다 30pt 낮고 분모에 pages/api·middleware·db가 없다 [P3 · S]

① `jest.config.js:29-35`(collectCoverageFrom), `:41-44`(coverageThreshold), `.github/workflows/ci.yml:54`

② 지금 코드. `collectCoverageFrom`은 components/lib/utils만. 임계값 lines 45 / branches 33 / functions 35 / statements 47. 2026-10-09 실측(HEAD): lines 78.06 / branches 65.98 / functions 71.59 / statements 76.31. 주석의 "실측보다 7~8pt 낮게"는 2026-09-03 기준(round2 #25 당시 52.8)이다. pages/api를 넣고 다시 재면 82개 파일 3,767줄 중 69.2%, 라인 0% 핸들러 24개(contracts/[id]/sign.ts, orders/mixing.ts, inbound/resend.ts, press/room/[room]/enter.ts, admin/orders/[id]/refund-account.ts, 크론 8개 등).

③ 간격이 30pt라 테스트 3분의 1을 지워야 CI가 선다. `pages/api`·`middleware.ts`·`db`가 분모에 없어 핸들러 무테스트(TST-2·3·4·5·10·25)가 지표에 안 보인다.

④ 조건과 결과. 테스트 삭제·미작성이 크게 쌓여도 CI는 초록. 돈이 걸린 lib 디렉터리는 88~94%라 즉시 위험은 낮다.

⑤ **수정**. `collectCoverageFrom`에 `pages/api/**/*.ts`, `middleware.ts`, `db/client.ts`를 더하고 전역 임계값은 새 실측(포함 시 lines 76.5 / branches 65.0 / functions 71.4 / statements 75.0)에서 4~5pt 낮게 잡는다(예: 72/60/66/70). 디렉터리별 임계값은 실측 아래로 시작한다 — `lib/billing`·`lib/booking`·`lib/payments`·`lib/funding` 85, `pages/api` 65. **70은 쓰지 않는다** — 실측 69.2%라 바로 실패한다. 이후 올리기만 한다.

⑥ 비고: 검증자가 바로잡음 — 원 수정안의 `'./pages/api/': {lines: 70}`은 적용 즉시 CI가 빨개진다.

#### TST-17. 테스트가 비밀 env를 비우지 않아, 셸 export나 .env.test가 생기면 운영 자격 증명이 테스트에 들어온다 (현재 노출 없음) [P3 · S]

① `jest.setup.js:1-15`, `db/client.ts:25-36`, `tests/api/llms-contact.test.ts`, `.env.local`(TURSO_DATABASE_URL·TURSO_AUTH_TOKEN·RESEND_API_KEY·CRON_SECRET 실제 값)

② 지금 코드.

```ts
// db/client.ts:25-36
const databaseUrl = process.env.TURSO_DATABASE_URL; ...
if (!databaseUrl || !authToken) throw ...;
instance = drizzle(createClient({ url: databaseUrl, authToken }), { schema })
```

NODE_ENV 검사가 없다. `jest.setup.js`는 jest-dom import와 fetch 스텁뿐이다. `llms-contact.test.ts`는 DB를 mock하지 않고 'DB 조회 실패 → 파일 폴백' 경로를 정상으로 의존한다.

③ 지금 안전한 이유는 Next의 규칙이다 — `@next/env`는 `NODE_ENV=test`에서 `.env.local`을 읽지 않는다(실측: `loadedEnvFiles=[]`, 셸 env에도 없음). `.env`·`.env.test`도 저장소에 없다. 그러나 이 안전은 환경 조건(셸 export 없음, .env.test 없음)에 의존하고, mock을 빠뜨린 테스트가 운영 DB·메일에 닿는 것을 막는 코드는 없다.

④ 조건과 결과. 셸에 `TURSO_*`를 export한 채 jest를 돌리거나 `.env.test`를 만들면, llms-contact처럼 DB를 mock하지 않는 테스트가 운영 DB를 조회한다. mock을 빠뜨린 쓰기 테스트라면 쓰기까지 간다. 현재 스위트에서 실제 외부 호출은 0건(fetch 스파이로 확인).

⑤ **수정**. `jest.setup.js` 맨 위:

```js
for (const k of ['TURSO_DATABASE_URL','TURSO_AUTH_TOKEN','RESEND_API_KEY','CRON_SECRET','TOSS_SECRET_KEY','TOSS_API_SECRET_KEY','TOSS_BILLING_SECRET_KEY','FUNDING_FIELD_KEY','BLOB_READ_WRITE_TOKEN','ADMIN_ACCOUNTS','ADMIN_PASSWORD']) delete process.env[k];
```

jest는 파일마다 `process.env` 사본을 쓰므로 다른 파일로 새지 않고, 값이 필요한 테스트는 이미 자기 `beforeEach`에서 세팅한다. `db/client.ts`에 테스트 감지 분기는 넣지 않는다 — 프로덕션 코드가 테스트 환경을 아는 구조다.

⑥ 비고: 검증자가 바로잡음 — "우연히 안전"이 아니라 Next 규칙에 의한 안전이며, 방어 심층화로 P3.

#### TST-18. 약관 판본 게이트가 '직전과 다른 문자열'만 요구해 이미 쓴 옛 판본으로 되돌려도 통과한다 [P3 · S]

① `content/fundingTermsHash.ts:96-135`(assertBaselineUpdateAllowed, :118-119), `content/funding-terms.baseline.json`, `content/fundingTerms.baseline.test.ts`, `content/creatorTerms.baseline.test.ts`, `lib/funding/policy.ts`

② 지금 코드.

```ts
// content/fundingTermsHash.ts:118-119
if (existing.hash === next.hash) return;
if (existing.version !== next.version) return; // 내용이 바뀌었고 판본도 올렸다 — 정상.
```

비교 대상은 직전 기준선 하나뿐이다. `TERMS_VERSION_PATTERN`은 형식(`funding-terms-YYYY-MM-DD[-rN]`)만 검사하고 단조 증가·미사용 여부는 안 본다. 기준선 JSON에는 `{version, hash}` 하나만 있고 이력이 없다. 테스트는 "정렬 가능해야 옛 판본을 찾을 수 있다"고 말하면서 정렬 순서를 검증하지 않는다.

③ 이미 후원 행에 기록된 옛 판본 문자열을 다른 내용에 재사용해도 막지 못한다. 병렬 브랜치가 같은 `-r2`로 올리는 현실적 충돌은 git이 막는다(baseline JSON의 hash 줄 병합 충돌 → 재생성 시 '내용 변경 + 같은 판본' 거부).

④ 조건과 결과. 개정자가 이미 쓰인 판본 문자열을 착각으로 다시 고르면, 서로 다른 약관에 동의한 후원 행이 같은 `terms_version`을 갖게 되어 동의 증거가 약해진다. 확률은 낮다.

⑤ **수정**. `funding-terms.baseline.json`(및 creator-terms)에 append-only `history: [{version, hash}]`를 두고, 갱신 시 `next.version`이 history에 있는데 hash가 다르면 거부한다. 순서 검사를 넣으려면 문자열 사전순이 아니라 `(날짜, 리비전 숫자)`로 파싱해 비교한다 — `-r10`이 `-r2`보다 뒤여야 한다. 두 baseline 테스트에 '과거 판본 재사용 거부' 케이스 추가.

⑥ 비고: 검증자가 바로잡음 — 원 제안의 '사전순으로 작거나 같으면 거부'는 `-r10 < -r2`로 정당한 개정을 막아 기각.

#### TST-19. 검증 필요 후보 게이트가 개수만 비교해 줄인 만큼의 여유 칸이 새 후보로 채워질 수 있다 [P3 · M]

① `scripts/check-unverified-claims.mjs:122-126`(--update), `:133-134`(판정), `scripts/check-duplicate-sections.mjs:77-87`, `content/unverified-claims.baseline.json`, `content/duplicate-sections.baseline.json`, `scripts/check-unverified-claims.test.ts`

② 지금 코드.

```js
// check-unverified-claims.mjs:122-126
if (update) { fs.writeFileSync(BASELINE, JSON.stringify({ files: now }) ... }   // 비교·제한 없음
// :133-134
const was = base[slug]?.[id] ?? 0; if (n > was) problems.push(...)              // 파일×규칙 개수만
```

`check-duplicate-sections.mjs:77-87`의 `--update`도 같은 구조, 그룹 식별은 `md5(normalize(chunk))` 12자(정확 일치)뿐.

③ 후보가 기준선보다 줄어도 통과하고 기준선은 그대로라, `--update`를 빼먹으면 줄어든 만큼의 여유 칸에 새 후보가 들어와도 개수가 같아 통과한다. 기존 글에서 후보를 다른 후보로 교체해도 같다. 새 글의 후보는 기준선 0이라 완전히 막히고, 현재 기준선과 실측은 일치한다(48건, 46편) — 여유 칸이 지금은 없다. 중복 섹션 게이트가 md5 정확 일치만 보는 것은 의도된 범위다(바이트 동일 패딩 섹션 차단; 의미 유사는 `scan-near-duplicates` 몫).

④ 조건과 결과. 기준선을 갱신하지 않은 채 후보가 남은 기존 글(46편)을 고치는 경우에 한해, 날조 후보가 개수만 유지하며 들어올 수 있다.

⑤ **수정**. 래칫: 현재 후보 수가 기준선보다 **적을 때도** 실패시키고 "`--update`로 기준선을 낮추라"고 안내한다. 그러면 여유 칸이 생기지 않는다. `check-duplicate-sections.mjs`에도 같은 처리. 문장 지문 기준선과 5-gram 근사 해시는 도입하지 않는다. 회귀 테스트: `check-unverified-claims.test.ts`에 '기준선 2 · 실측 1 → 실패(안내 문구)' 케이스.

⑥ 비고: 검증자가 바로잡음 — 교체 시나리오·md5 한계·--update 무제한 세 지적 모두 과장이라 판단, 현실적 구멍은 '줄이고 --update 안 돌린 여유 칸'. 같은 자리를 다른 축(CNT 콘텐츠 파이프라인·마크다운·데이터 정합)도 지적: "기준선 --update가 증가분도 그대로 받아들인다".

#### TST-20. CI checkout의 전체 이력 사유 주석이 사실과 다르다 / 빌드 단계의 lint·type 중복(약 41초) [P3 · M]

① `.github/workflows/ci.yml:16-21`, `scripts/seo-preflight.test.ts`, `scripts/seo-preflight.mjs`, `scripts/check-duplicate-sections.mjs`, `scripts/generate-page-lastmod.mjs`, `next.config.mjs:110-120`

② 지금 코드. `ci.yml:17-21` `fetch-depth: 0` 주석: "... check-duplicate-sections·generate-page-lastmod도 이력을 본다." 실제: `check-duplicate-sections.mjs`에 git 호출이 없고, `generate-page-lastmod`는 CI에서 실행되지 않으며 그 커버리지 검증(`routes.test.js`의 `--check`)은 git 없이 돈다. 깊은 이력을 읽는 테스트는 `scripts/seo-preflight.test.ts`뿐(커밋 1e26671388·8edb2dfbf1 고정; `payoutPlaintextColumns.test.ts`의 git grep은 이력 불필요). 최신 실행에서 전체 이력 checkout 36초, 이력 없는 migration-drift 잡 checkout 7초 — 약 29초 차이. `next build`의 'Linting and checking validity of types'가 로그상 16:38:53.9 → 16:39:34.6, 약 41초로 앞 단계 lint + type-check와 중복이다. `.next/cache` 캐시는 효과 없다 — `next.config.mjs:113-120`이 프로덕션 webpack 캐시를 의도적으로 끈다(`config.cache=false`, 'clean CI/Vercel builds do not benefit enough'). 'No build cache found' 경고는 그 설정의 결과다.

③ 주석이 거짓이라 다음 사람이 `fetch-depth`를 줄이지 못한다. 빌드 안 lint·type 중복은 `next.config.mjs:110-112` `ignoreDuringBuilds:false`가 Vercel 빌드에서도 같은 검사를 하려는 선택일 수 있다.

④ 조건과 결과. PR당 약 30초(checkout) + 약 40초(빌드 내 중복 검사)의 낭비. 정확성 영향 없음.

⑤ **수정**. 주석을 사실대로 고친다("seo-preflight.test.ts가 실제 저장소 이력에 --today를 고정해 검증하므로 전체 이력이 필요하다"). 그 테스트는 '과거 이력은 변하지 않는다'는 명시적 설계라 fixture로 바꾸지 않는다. 이력을 줄이려면 `actions/checkout`에 `filter: blob:none`(부분 클론)을 먼저 시험한다. `.next/cache` 캐시 제안은 철회. 빌드 내 lint·type 건너뛰기는 Vercel 빌드와의 일관성을 확인한 뒤에만 CI 환경변수 한정으로 검토한다.

⑥ 비고: 검증자가 바로잡음 — `.next/cache` 캐시 제안은 틀림(webpack 캐시 의도적 비활성), 중복 검사 시간은 15초가 아니라 41초.

#### TST-21. 제목 서체 소스가 main 브랜치·해시 없이 매 빌드 내려받힌다 (재생성 구조는 유지하되 소스를 고정) [P3 · S]

① `scripts/generate-hero-font.mjs:76`(url), `:80`·`:112`(minBytes), `:103-107`(캐시 분기), `:351-366`(폴백), `package.json:50`(prebuild), `hero-font-subset.test.js`, `scripts/check-display-font-coverage.mjs`

② 지금 코드.

```js
// scripts/generate-hero-font.mjs:76
url: 'https://raw.githubusercontent.com/Freesentation/paperlogy/main/woff2/Paperlogy-7Bold.woff2'
```

브랜치 main, 커밋·해시 고정 없음. 검증은 `minBytes: 300_000` 크기뿐이고 캐시 분기(:103-107)도 크기만 본다. `prebuild`가 매 빌드 이 스크립트를 돌려 `lib/fonts/display.woff2`를 재생성한다(CI 로그 'written: lib/fonts/display.woff2 (40.6 KB)').

③ 업스트림이 바뀌면 CI 테스트가 검사한 커밋본과 배포본의 글리프 윤곽이 달라질 수 있고, 오래된 `node_modules/.cache` 파일도 해시 검증 없이 쓰인다. 지금은 드리프트가 없다 — 업스트림 main 파일을 받아 `display.chars.json` 글자 집합으로 다시 서브셋하면 sha256 744839a1…으로 커밋본과 바이트 동일(결정적), 업스트림 마지막 커밋은 2025-11-12 한 건. 서브셋이 harfbuzz로 새 woff2를 만들므로 "임의 바이너리가 그대로 실린다"는 아니다. prebuild 재생성은 CLAUDE.md에 문서화된 흐름이고, Vercel 빌드가 테스트를 돌리지 않으므로 '제목 글자를 늘렸는데 woff2 재생성 커밋을 빠뜨린' 경우를 빌드에서 메워 주는 안전망이기도 하다.

④ 조건과 결과. 업스트림이 파일을 바꾸거나 CI 캐시에 오래된 소스가 남으면 조용히 서체가 달라진다. 현재 영향 없음.

⑤ **수정**. prebuild 재생성은 그대로 두고 소스를 고정한다. URL을 커밋 SHA로:
`https://raw.githubusercontent.com/Freesentation/paperlogy/432bb0c08e79104ece0f9c844d59e0db12c9abc9/woff2/Paperlogy-7Bold.woff2`
`SOURCES.paperlogy`에 `sourceSha256: '39daa190bc0ccaa7dfe8bb55716953fc56acdad812da6701a6e31a4a051173af'`를 넣고 `ensureSourceFont`가 캐시 읽기와 다운로드 직후 모두 대조하게 한다 — 불일치면 캐시 삭제 후 재다운로드, 그래도 불일치면 기존 폴백(커밋본 사용) 경고. `generate-body-font.mjs`에 같은 구조가 있으면 함께. `--check`만 돌리는 방식으로 바꾸지 않는다.

⑥ 비고: 검증자가 바로잡음 — 원 제안 'prebuild는 --check만'은 문서화된 흐름과 안전망을 뒤집어 기각. 같은 자리를 다른 축(SCR 운영 스크립트·도구)도 지적: "prebuild가 매 빌드 고정되지 않은 main 브랜치의 Paperlogy 소스로 display.woff2를 재생성한다".

#### TST-22. lib/shows가 테스트 더블 타입(FakeToss)에 컴파일 의존한다 [P3 · S]

① `lib/shows/confirm.ts:9`·`:87`·`:432`, `lib/shows/refund.ts:6`·`:85`, `lib/shows/showtimeOps.ts:5`·`:34`, `tests/fakes/fakeToss.ts`, `lib/booking/toss.ts`

② 지금 코드.

```ts
// lib/shows/confirm.ts:9
import type { FakeToss } from '../../tests/fakes/fakeToss';
// :87
toss: Pick<FakeToss, 'confirmPayment' | 'fetchPayment' | 'cancelPayment'>,
```

refund.ts·showtimeOps.ts도 `Pick<FakeToss, 'cancelPayment'>` 등으로 같다. 프로덕션(lib·pages·components) 중 `tests/`를 import하는 곳은 이 셋뿐이다. `fakeToss.ts`는 `lib/booking/toss`의 타입을 import하므로 의존 방향이 역전돼 있다.

③ 토스 클라이언트의 계약이 `lib/booking/toss.ts`가 아니라 가짜에 정의돼 있다. 전부 `import type`이라 런타임·번들 영향은 없다. 호출부(`pages/api/admin/shows/[id].ts:135,182`, `pages/api/shows/refund.ts:73`, `pages/[locale]/shows/success.tsx:171`, `lib/booking/webhook.ts:300`)가 실제 함수를 넘기므로 실제 시그니처가 비호환으로 바뀌면 type-check가 호출부에서 실패한다 — 놓치는 것은 호환되는 확장(선택 인자 추가)뿐.

④ 조건과 결과. fake를 옮기거나 고치면 lib/shows 시그니처가 따라 바뀐다. 구조 부채.

⑤ **수정**. `lib/booking/toss.ts`에

```ts
export type TossClient = {
  confirmPayment: typeof confirmPayment;
  cancelPayment: typeof cancelPayment;
  fetchPayment: typeof fetchPayment;
};
```

를 두고 `lib/shows/{confirm,refund,showtimeOps}.ts`는 `Pick<TossClient, …>`를 쓴다. `FakeToss`는 `TossClient`를 만족하도록 선언(`satisfies` 또는 `implements`). ESLint `no-restricted-imports`(lib/**·components/**·pages/**에서 `tests/` 금지)는 선택.

⑥ 비고: 검증자가 바로잡음 — "실제 토스 시그니처가 변해도 타입 검사를 통과할 수 있다"는 과장. 같은 자리를 다른 축(CQ 코드 품질·구조·중복·타입 안전)도 지적: "토스 승인 상수·재조회 검증이 4벌 복제돼 있고 '모듈 그래프' 복제 근거는 코드가 스스로 부정한다".

#### TST-23. 테스트 DB 헬퍼 applyMigrations가 await 없이 실행해 마이그레이션 실패가 unhandledRejection으로만 드러난다 [P3 · M]

① `tests/helpers/showsDb.ts:9-18`, `db/schema.shows.test.ts:15`, 인라인 복사 약 80곳(예: `lib/booking/confirm.integration.test.ts:44-51`, `tests/api/bookings/createBankDeposit.test.ts:42-48`)

② 지금 코드.

```ts
// tests/helpers/showsDb.ts:9-18
export function applyMigrations(client) {
  const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  ... for (const stmt of statements) { client.execute(stmt); }   // await 없음
}
```

같은 `split('--> statement-breakpoint')` 루프가 81개 파일(헬퍼 1 + 인라인 약 80)에 있고 헬퍼를 쓰는 파일은 20개다. 실험: await 없이 부른 `execute`는 동기적으로 순서대로 실행되어(뒤따른 INSERT가 앞의 CREATE TABLE을 본다) 결과는 정확하지만, 중복 CREATE를 던지면 `UNHANDLED: SQLITE_ERROR`로만 드러난다.

③ 실행 순서는 안전하고 오류 보고만 나쁘다. 파일명 정렬 순서와 저널 엔트리 순서는 52개 전부 일치하고 `when` 엄격 증가는 `lib/ops/migrationJournal.test.ts`가 강제하므로, drizzle migrator로 바꿔도 얻는 검증이 없다(작은 `when` 건너뜀은 운영 `__drizzle_migrations` 상태에서만 생기고 빈 `:memory:`에는 재현되지 않는다).

④ 조건과 결과. 마이그레이션 SQL이 깨지면 원인 위치와 다른 테스트에서 엉뚱한 메시지로 터진다. 현재 실패하는 마이그레이션은 없다.

⑤ **수정**. `applyMigrations`를 `async`로 바꿔 `for` 루프에서 `await client.execute(stmt)`로 실행하고, 호출부 두 곳(`createTestDb`, `db/schema.shows.test.ts:15`)에 `await`. 새 테스트는 헬퍼를 쓰게 한다. 기존 80여 파일 일괄 치환과 drizzle migrator·`_journal` 읽기 도입은 하지 않는다(마이그레이션 형식은 52개 동안 불변).

⑥ 비고: 검증자가 바로잡음 — '저널의 when을 반영 못 한다'는 지적과 80개 파일 codemod는 기각.

#### TST-24. CANCELED 동기화 테스트의 batch 구성 단언이 toHaveBeenCalled뿐이다 [P3 · L]

① `lib/booking/webhook.test.ts:21-35`(db mock), `:60-67`, `:190-196`, `lib/booking/webhook.ts:100-170`, `lib/booking/webhook.integration.test.ts`

② 지금 코드. db mock은 `insert: jest.fn().mockReturnValue({ values: insertValues })`, `update ... { set: updateSet }` 한 세트를 모든 테이블이 공유한다(:60 주석 "insert 체인은 테이블과 무관하게 같은 values mock을 공유한다").

```ts
// :194
expect(db.batch).toHaveBeenCalled(); // batch는 refunds insert + orders update 2문장만
```

주석이 약속한 '2문장'은 단언되지 않는다. 같은 방식의 mock 테스트: `confirm.test.ts`(682줄), `cancel.test.ts`(579), `confirmDeposit.test.ts`(198), `tests/api/funding/display-name.test.ts`(235).

③ 단언 대부분은 내용 기반(`insertValuesCallsOf(...).find(c => c.reason === '토스 외부 취소 동기화')`, `setCallsOf(...).find(c => c.status === 'refunded')`)이라 쿼리 작성 방식이 바뀌어도 내용이 같으면 통과한다 — 구현 베끼기는 아니다. 그러나 `webhook.integration.test.ts`의 CANCELED·PARTIAL_CANCELED 케이스는 펀딩 주문(pk_f)이고, 예약·믹싱의 booking/work_order 선점 후 CANCELED 동기화(webhook.ts:100-170)는 이 mock 테스트가 **유일한** 커버리지다.

④ 조건과 결과. batch에 문장이 빠지거나 늘어도 이 테스트는 통과한다.

⑤ **수정**. 최소 조치: `:194`를 `expect(db.batch.mock.calls[0][0]).toHaveLength(2)`로 구체화한다(mock 체인이 문장마다 `{}`를 돌려주므로 길이 단언 가능). 시간이 날 때 `webhook.integration.test.ts`에 예약 CANCELED 동기화 케이스(bookings가 cancelled, refunds 1행, orders refunded)를 추가한다. mock 파일 4개를 통합으로 옮기는 일은 하지 않는다 — 비용이 이득보다 크다.

⑥ 비고: 검증자가 바로잡음 — "짝인 통합 테스트가 같은 시나리오를 검증한다"는 webhook에는 맞지 않아, 통합 케이스는 '옮기기'가 아니라 '새로 쓰기'다.

#### TST-25. 수신 웹훅·감상실 입장/음원·주문 환불계좌 보기 핸들러 접착부가 무테스트 [P3 · M]

① `pages/api/inbound/resend.ts`(84줄), `pages/api/press/room/[room]/enter.ts`·`audio.ts`, `pages/api/admin/orders/[id]/refund-account.ts`, `pages/api/admin/artists/payouts.ts`(+[id]), `pages/api/admin/blocks/index.ts`·`[id].ts`, `pages/api/admin/bookings/index.ts`, `tests/api/inbound-webhook.test.ts`, `lib/press/listeningRoom.test.ts:19-20`·`:30`, `lib/email/inboundWebhook.ts`, `lib/payments/refundAccountView.ts`

② 지금 코드. 위 핸들러들은 커버리지 0%다. `tests/api/inbound-webhook.test.ts`는 이름과 달리 `lib/email/inboundWebhook` 헬퍼(`verifySvixSignature`·`includesAlias`·`parseEmailAddress`)만 import하고 핸들러를 호출하지 않는다. `admin/orders/[id]/refund-account`는 UI 테스트가 fetch URL만 단언하고(`detailBankDeposit.test.tsx:85`), 공용 `handleRefundAccountView`는 `tests/api/admin/funding/refundAccount.test.ts`가 펀딩 라우트로만 검증한다. 감상실의 암호학적 게이트(비밀번호 비교·토큰 서명·만료·변조·쿠키 속성)는 `lib/press/listeningRoom.test.ts`가 검증하고, 빠진 것은 접착부(IP 10회/15분 제한 → `?e=limit`, 303 목적지, PRESS_HOST 404, 쿠키 없으면 401, presign 실패 503)다.

③ lib 단위 테스트는 있으나 핸들러 배선이 바뀌어도 CI가 모른다. `artists/[slug]/supporters.ts`·`shows/availability.ts`는 개인정보 없는 공개 GET이라 제외.

**별도 발견 — 이 건과 무관하게 즉시 조치.** `lib/press/listeningRoom.test.ts:19,20,30`에 감상실 비밀번호 **원문이 평문**으로 들어 있다(`hashRoomPassword`가 저장된 해시를 재현하므로 실사용 비밀번호다). 저장소 hwangtab/studio는 PUBLIC이고 커밋 99694c8720부터 있다. CLAUDE.md "비밀번호 원문을 커밋하지 않는다"에 어긋나며, 발매 전 음원의 유일한 출입문이 공개 저장소에서 읽힌다.

④ 조건과 결과. inbound/resend의 루프 차단(`sender === INBOUND_ALIAS`)이 빠지면 hello@가 자기에게 보낸 메일이 무한 전달된다. refund-account 핸들러의 주문 유형 매핑이 깨지면 PII 복호화·접속기록 경로가 조용히 바뀐다. 감상실 비밀번호는 지금 공개돼 있다.

⑤ **수정**.
0. (즉시) `node scripts/press/hash-password.mjs '<새 비밀번호>'`로 해시를 교체하고 — 기존 입장 쿠키는 전부 풀린다 — `listeningRoom.test.ts`는 임의의 임시 비밀번호로 `hashRoomPassword` 왕복만 확인하게 바꾼다. git 이력에는 남으므로 교체가 유일한 조치다.
1. `tests/api/inbound/resend.test.ts`: 서명 없음/틀림 401, 유효 서명 + alias 불일치 200 ignored, `sender === hello@` 200 ignored, 유효 시 전달 fetch 호출, 첨부 한도.
2. `tests/api/admin/orders/refundAccount.test.ts`: 인증 없음 401, ticket/booking/mixing 매핑, funding 타입 null → 404, `recordAdminPrivacyAccess` 호출(`refundAccount.test.ts` 패턴 재사용).
3. press enter/audio 접착부 5케이스.
4. `tests/api/inbound-webhook.test.ts` → `inboundWebhook.lib.test.ts`로 개명.

⑥ 비고: 검증자가 바로잡음 — 한 묶음 P2에서 P3로 낮추고 항목별로 쪼갬. 평문 비밀번호는 검증 과정에서 나온 별도 발견이다.

#### TST-26. 사실 정합 검사가 번역본을 읽는 척만 한다 — 보고 건수 부풀림 + 한국어 원문 정정의 번역본 전파 점검 수단 없음 [P3 · L]

① `scripts/check-fact-consistency.mjs:65`, `scripts/check-unverified-claims.mjs:60`(`koStories()`), `content/stories/*.{en,zh,es,vi,th,uz}.md`(184개, 고유 slug 44), `lib/factGuards.ts`, `content/factGuards.test.ts`

② 지금 코드. `check-fact-consistency.mjs:65` `files = fs.readdirSync(STORIES).filter(f => f.endsWith('.md'))`는 번역본까지 읽지만 정규식은 전부 한글(`영업일`, `믹싱`, `납품|완성`, `수정`)이라 번역본에는 아무것도 걸리지 않는다. 출력은 '스토리 1766편'으로 번역본까지 센다. `check-unverified-claims.mjs`는 `koStories()`로 번역본을 명시 제외한다.

③ 이 스크립트가 보는 축(납기·수정 횟수·레슨/연습실 월정액·믹싱 가격)에 걸리는 번역본은 지금 0건이다 — 번역 slug 44개의 ko 원문 중 해당 문구가 있는 것은 0편이고, 번역본 전체를 grep해도 서비스 납기·수정 횟수 주장은 없으며 가격(연습실 월 ₩360,000 등)은 정본과 같다. 서비스 범위 사실(구 전화번호, 보컬·악기 레슨, 영어 엔지니어 등)은 `lib/factGuards.ts`가 다국어 패턴을 갖고 `content/factGuards.test.ts`가 번역본 포함 전체에 돌린다. 별개로 한국어 원문의 사실 정정이 번역본에 전파되지 않는 문제(#549 104파일 점검, #598)는 실재하지만 unverified-claims 계열·번역 동기화 절차의 문제이지 이 게이트의 축이 아니다.

④ 조건과 결과. 현재 틀린 약속이 번역본에 나가 있지는 않다. 위험은 번역 범위가 서비스 약속 글로 넓어질 때와, 한국어 정정이 번역본에 늦게 반영될 때다.

⑤ **수정**.
1. `check-fact-consistency.mjs`의 `files`를 ko 원문(`.(en|zh|es|vi|th|uz).md` 제외)으로 한정하고 헤더 주석에 "번역본은 대상이 아니다. 번역 slug가 서비스 약속 문단을 갖게 되면 그때 정본 대조를 추가한다"를 적는다. 출력 건수가 실제 범위를 말하게 된다.
2. 동기화는 CI 실패가 아니라 읽기 전용 점검 스크립트로 둔다: 번역 파일마다 ko 원문의 마지막 변경 커밋(`git log -1 --format=%ct`) 이후 번역본이 바뀌지 않은 쌍만 나열한다. 44 slug라 목록이 짧고, `sourceHash` 필드나 숫자 토큰 대조 같은 새 기계는 들이지 않는다(ko 일괄 윤문마다 거짓 경보를 쏟는다).
3. 번역 slug 중 하나라도 납기·수정 횟수·월정액을 말하게 되면 그때 factGuards 방식의 다국어 룰을 한 줄 추가한다.

⑥ 비고: 검증자가 바로잡음 — "사실상 무방비"·P2는 과장, #549·#598은 이 스크립트의 축과 무관. 원 수정안(숫자 토큰 동등성·sourceHash)은 기각.

#### TST-27. lint 대상에서 db/·tests/·test/·test-utils/·루트 *.test.* 가 빠져 있어 error 12건이 숨어 있다 [P3 · S]

① `package.json:46`, `.eslintrc.json`, `db/schema.shows.test.ts:23,29,38`, `hero-font-subset.test.js:14`, `audit-thin-content.test.js:3`, `ctr-surgery-log.test.js:13-14`, `middleware.test.ts:188`, `test/mocks/*.js`, `tests/api/llms-artists.test.ts`·`llms-funding.test.ts`

② 지금 코드.

```json
"lint": "eslint pages components lib data utils hooks types scripts middleware.ts next.config.mjs --ext ..."
```

`db`(schema.ts·client.ts 프로덕션 코드 포함), `tests`(125개), `test/mocks`, `test-utils`, 루트 `*.test.*`가 대상 밖이다. 빠진 디렉터리를 같은 설정으로 돌리면(4.8초) error 12건: `no-explicit-any` 3건(db/schema.shows.test.ts), `no-require-imports` 9건(hero-font-subset·audit-thin-content·ctr-surgery-log·middleware.test.ts, test/mocks 2건, llms-artists·llms-funding). 경고는 현재 대상 21건, 저장소 전체 22건이고 `--max-warnings`가 없다.

③ 테스트 코드와 db 파일에는 lint가 적용되지 않는다. TST-3의 미사용 import가 그 예다 — 다만 `no-unused-vars`는 warn이라 대상에 넣어도 `--max-warnings` 없이는 CI를 세우지 못한다. `eslint .`로 넓히면 error가 25건(루트 `jest.config.js:1`, `next-sitemap.config.js` 11건, `next-env.d.ts:3` triple-slash)이라 바로 빨개진다.

④ 조건과 결과. 런타임을 깨뜨리는 것은 없다. 규칙 위반이 테스트·db에 쌓인다.

⑤ **수정**. 한 PR에서:
1. 스크립트 대상에 `db tests test test-utils content`와 루트 `*.test.*`를 추가한다(`eslint .`는 next-env.d.ts 제외와 루트 `*.config.js` override가 먼저 필요하므로 쓰지 않는다). 08-24 c12ca28d82가 hooks/types/scripts를 같은 방식으로 넣은 선례가 있다.
2. `.eslintrc.json`에 `tests/**`, `test/mocks/**`, `**/*.test.js` override로 `no-require-imports`를 끄거나 해당 `require`를 import로 바꾸고, `db/schema.shows.test.ts:23,29,38`의 `any`를 구체 타입으로 바꾼다.
3. error 0을 만든 뒤 `--max-warnings`를 대상을 넓힌 뒤의 측정값 그대로(약 22) 둔다. 30처럼 여유를 두면 래칫이 아니다.
4. `.eslintignore`는 불필요하다(ESLint 8은 점 디렉터리를 기본 제외).

⑥ 비고: 검증자가 바로잡음 — `eslint .` 전환 비용(25건), "mixingHandler는 lint가 잡았을 것"(warn이라 아님), 경고 수(24→22).

#### TST-28. migration-drift 잡: CI main push에서 시크릿이 없으면 초록으로 skip한다 (ci.yml 주석과 불일치) [P3 · S]

① `scripts/check-migration-drift.mjs:24-29`·`:47`, `.github/workflows/ci.yml:62-65`·`:80`, `lib/ops/migrationDrift.ts`, `lib/ops/migrationDrift.test.ts`, `lib/ops/healthCheck.ts:357`

② 지금 코드. `ci.yml:80` 주석 "이 잡은 실제로 판정한다. 두 값이 사라지면 스크립트가 unknown으로 끝난다." vs

```js
// scripts/check-migration-drift.mjs:24-29
if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) { console.log('... 건너뜁니다 ...'); process.exit(0); }
```

단계는 초록이다. 파일 머리말(:6-9)은 `lib/ops/migrationDrift.ts`와 "반드시 같은 판정을 유지할 것"이라 적지만 둘을 대조하는 테스트가 없다.

③ 시크릿 등록(2026-09-23)이 끝난 지금 이 skip을 정상으로 볼 근거가 없다. 토큰이 **만료**되면 조회가 던져 `:47`의 exit 1로 빨개지므로, 초록 skip은 시크릿이 삭제·개명된 경우에만 난다(gh api로 두 시크릿이 현재 등록돼 있음을 확인). 이 잡의 빨간불은 설계된 탐지기 동작이다 — 최근 main 100회 중 실패 3회(10-07 09:53~09:57, 사유 0051_show_report_links 미적용)이고 10:25 실행이 52/52 초록, 약 30분이었다.

④ 조건과 결과. 시크릿이 삭제·개명되는 드문 경우에 CI 탐지기가 조용히 꺼진다. 매일 크론(`healthCheck.ts:357`)이 두 번째 방어선이라 사고 위험은 낮다.

⑤ **수정**. 스크립트에서 `process.env.GITHUB_ACTIONS === 'true'`일 때(main push 전용 잡) 시크릿 부재를 `::error::TURSO 시크릿이 없어 드리프트를 판정하지 못했습니다`와 함께 exit 1로 끝내고, 로컬 실행에서만 skip을 유지한다. `ci.yml:80` 주석을 실제 동작에 맞춘다. 빨간불 약화(neutral·N일 승격)는 하지 않는다 — exit 78 neutral은 일반 `run` 단계에서 지원되지 않아 실패로 처리된다. 판정 중복 정리는 선택: `migrationDrift.test.ts`의 네 경우(drift·ok·운영 앞섬·unknown)를 스크립트의 순수 함수로 뽑아 같은 표로 검증하는 정도.

⑥ 비고: 검증자가 바로잡음 — "만료돼도 초록", "이후 모든 push가 며칠씩 빨갛다"는 데이터와 다름. 같은 자리를 다른 축(SCR 운영 스크립트·도구)도 지적: "CI 드리프트 탐지가 시크릿이 없을 때 초록으로 통과하고, 안내문이 안 되는 절차를 가리킨다".

#### TST-29. 소스 스캔 가드 11곳이 walk 헬퍼를 각자 복사한다 [P3 · M]

① `components/layout/heroHeader.test.ts`, `components/ui/uiPatterns.baseline.test.ts`, `data/pricing.test.ts`, `lib/getStatic.test.ts`, `lib/koOnlyRoutes.test.ts`, `pages-routes.test.ts`, `tailwind.config.test.ts`(932줄, 14 it), `tests/email/layoutGuard.test.ts`, `tests/pages/pageScaffold.test.ts:27-35`, `tests/payments/sharedCheckout.guard.test.ts`, `utils/schema/openingHours.test.ts`

② 지금 코드. `const walk`/`function walk` 정의가 11개 테스트 파일에 있고 `readdirSync`를 쓰는 테스트는 106개다. 사본들은 같지 않다 — 확장자(.tsx만 / .ts+.tsx), 테스트 파일 제외 여부, 점 디렉터리·node_modules 건너뛰기, 절대·상대 경로 반환이 제각각이다. 10-08에 추가된 `pageScaffold.test.ts`도 또 복사했다.

③ 복붙 증가와 규칙 차이 혼동. 실행 시간은 11개 가드 스위트 246개 테스트가 합계 1.5초라 성능 영향은 없다. 가드 상당수가 파일별 기준선 래칫이거나 `tailwind.config.ts`와 사용처를 교차 검증하는 구조라 ESLint 규칙으로 표현되지 않고, 로컬 플러그인은 CLAUDE.md '유지보수 부담이 큰 기계' 금지에 어긋난다.

④ 조건과 결과. 새 가드마다 복붙이 반복되고 옵션 차이를 혼동한다.

⑤ **수정**. 하려면 `tests/helpers/sourceFiles.ts`에 `listSourceFiles(dirs, { exts, skipTests, skipDot })` 하나만 만들어 새 가드부터 쓰고, 기존 사본은 손볼 때 옮긴다. ESLint 로컬 플러그인 이전과 모듈 캐시는 하지 않는다. 안 해도 무방.

⑥ 비고: 검증자가 바로잡음 — 'I/O 중복' 영향은 실측 1.5초로 무시할 수준.

#### TST-30. CI 테스트 단계의 --passWithNoTests는 초기 흔적이고, 콘솔 소음이 9,400줄이다 [P3 · S]

① `.github/workflows/ci.yml:53-54`, `jest.config.js`, `tests/api/llms-contact.test.ts`

② 지금 코드. `ci.yml:54` `run: npm test -- --coverage --passWithNoTests`. 이 플래그는 최초 CI(701233f0ac, 2026-05-17, 테스트가 적던 시기)의 흔적이다. 지금 515 스위트·5,789 테스트에서 유일한 효과는 '테스트 0개 발견'을 초록으로 만드는 것이다 — `--testPathIgnorePatterns '.*'` 실험: 플래그 없으면 exit 1('No tests found'), 있으면 coverage 0%인데도 exit 0. main #599 Test 단계 로그는 9,414줄, `console.error` 268건 + `console.warn` 23건(블록 291개). llms-contact가 funding 저장소의 'DB 조회 실패(list)' 스택을 반복 출력한다(로그 8634행 이후).

③ 0개 발견은 설정이 통째로 깨져야 나는 상황이라 가능성이 낮고, 부분 유실은 이 플래그와 무관하다. 소음이 실패를 가리진 않는다 — jest는 FAIL 줄과 최종 요약을 따로 출력한다.

④ 조건과 결과. `testPathIgnorePatterns` 오타 등으로 0개를 찾아도 CI가 초록(가능성 낮음). 로그 분석 시 스크롤이 길다.

⑤ **수정**.
1. `--passWithNoTests`를 지운다. 이것으로 충분하며 스위트 수 하한 스크립트(매직 넘버 유지보수)는 만들지 않는다.
2. 소음은 CI 명령에 `--silent`를 붙이는 한 토큰이 가장 단순하다. 실패한 테스트의 assertion 출력은 그대로 나온다. `jest-fail-on-console`은 도입하지 않는다 — 의도된 `console.error`가 수백 건이다(`tests/api/funding/creator/projects.test.ts` 한 파일에 44줄 등).
3. llms-contact의 소요 시간은 TST-6에서 해결한다.

⑥ 비고: 검증자가 바로잡음 — 심각도와 수정안 축소. 같은 자리를 다른 축(DB 스키마·마이그레이션·쿼리)도 지적: "schema.ts와 마이그레이션 동기를 검증하는 CI 게이트가 없다 (통합 테스트가 일부 표만 우연히 커버)".

**클린 판정**

- 전체 스위트 로컬 실측(HEAD 401a9ddcf2): 510 suites / 5,734 tests 모두 통과(92s), CI main #600도 Test 단계 성공 — 실제 네트워크 호출 0건(fetch 스파이로 전 스위트 확인), jest.setup.js의 fetch 스텁 외 숨은 실호출 없음
- tests/api/llms-contact.test.ts: 단독 16/16 통과, TZ=UTC·TZ=Pacific/Kiritimati+가짜 TURSO env에서도 통과 (HEAD에서 실패 재현 안 됨)
- jest.config.js의 .claude/worktrees 제외(testPathIgnorePatterns·modulePathIgnorePatterns)는 정상 동작, tsc는 dot 디렉터리를 스캔하지 않음(--listFilesOnly로 확인)
- 크론 10개 모두 isCronAuthorized 적용, lib/cron/auth.ts는 SHA-256 고정 길이 + timingSafeEqual + CRON_SECRET 없으면 fail-closed (08-24 리뷰 #18 해소)
- 관리자 API 21개 중 19개가 authenticateAdminApi 직접 호출, 2개는 공용 handleRefundAccountView(인증·no-store·접속기록 포함)에 위임
- lib/ops/migrationJournal.test.ts(when 엄격 증가·idx 중복·SQL 존재·prevId 사슬)와 fundingTerms/creatorTerms/paymentMethods/fundingImages/uiPatterns 기준선의 갱신 경로 자물쇠 설계는 양호 (우회 케이스가 테스트로 고정됨)
- 통합 테스트 DB 격리: 64개 *.integration.test.ts가 파일마다 별도 :memory: libsql을 만들고 beforeEach에서 정리 — 파일 간 공유 상태 없음
- tests/fakes/fakeToss.ts: 멱등키 재생·장애 주입·끼어들기 훅을 갖춘 결정적 토스 더블, 실제 토스 동작(orderId 조회 불가 등)을 반영
- 실시간 sleep/랜덤 의존이 거의 없음(setTimeout 대기 3곳, 난수는 ID 생성뿐); 64개 파일이 fake timers/setSystemTime 사용
- scripts/audit:thin:ci는 audit-thin-content.test.js가 jest에서 수행(08-24 '확인 필요 #3' 해소), generate-story-listing의 readdir 순서 의존은 slug 타이브레이커로 수정됨(round2 #21)
- hero-font-subset.test.js·lib/storyListing.check.test.js·payoutPlaintextColumns.test.ts는 네트워크 없는 --check/git grep 방식으로 결정적
- ci.yml 권한/비밀: GITHUB_TOKEN 기본 read-only(로그 확인), TURSO 시크릿은 main push의 migration-drift 마지막 step env에만 노출
- middleware.ts 라인 커버리지 96%, 결제 웹훅/확정/환불 도메인(lib/booking, lib/funding, lib/shows)은 통합 테스트가 두텁다(권한·멱등·경합 시나리오)

**읽지 못한 범위**

- 검토 기준은 로컬 HEAD 401a9ddcf2이며 origin/main보다 67커밋 뒤다. origin/main의 새 테스트·CI 변경(#600까지)은 읽지 않았다(CI 실행 기록과 로그만 gh로 조회)
- npm audit은 실행 환경에서 출력이 없어(네트워크 차단 추정) 현재 취약점 수를 확인하지 못했다. CLAUDE.md의 '0건 유지'가 CI에서 강제되는지는 코드상 강제 장치가 없다는 점만 확인했다
- components/**·lib/** 색인된 단위 테스트 약 320개 중 샘플(booking/webhook, payments/webhook, admin shows 페이지, PledgeWizard 계열은 이름만)만 정독했다. 컴포넌트 접근성/스냅샷 테스트의 품질은 평가하지 못했다
- e2e/브라우저 테스트(playwright, scripts/visual/*), scripts/archive·scripts/social·scripts/press 하위 테스트는 읽지 않았다
- 플레이키 판정은 단일 실행 기준이다(동일 설정 반복 실행·순서 셔플·--runInBand 비교는 하지 않음). TZ는 America/Los_Angeles(전체)와 UTC/Kiritimati(llms-contact만)만 시험
- GitHub Secrets에 등록된 Turso 토큰의 권한 범위(읽기 전용 여부), Vercel 빌드 명령/캐시 설정, 브랜치 보호의 PR 승인 규칙은 API로 읽을 수 없거나 읽지 않았다
- 운영 DB(Turso)와 Vercel에는 쓰기/조회를 하지 않았다. 마이그레이션 적용 상태와 코드의 실제 일치는 확인하지 못했다

**미검증 후보(overflow)**

- 없음

---

## 4부 — 제품 영역: 프론트엔드·페이지·SEO·성능·코드 품질·콘텐츠

### FE. 프론트엔드 컴포넌트·디자인 시스템·접근성

P0 0 · P1 1 · P2 13 · P3 15, 미검증 0

#### FE-1. 목차·앵커 클릭의 replaceState(null)이 Next 히스토리 상태를 지워 뒤로가기가 화면을 안 바꾼다 (실측 재현) [P1 · S]

- 위치: `components/markdown/TableOfContents.tsx:35-37`, `components/ui/SectionAnchorNav.tsx:69` (같은 패턴이지만 수정 대상에서 빼는 곳: `pages/[locale]/funding/creator/auth.tsx:52`). 관련 `lib/routeScroll.ts`, `pages/[locale]/stories/[id].tsx`.
- 지금 코드: `TableOfContents.tsx:36` `history.replaceState(null, '', \`#${id}\`);` — `SectionAnchorNav.tsx:69`도 동일. Next 15.5.27 `router.js:1630-1647`의 onPopState는 `const state = e.state; if (!state) { ... this.changeState('replaceState', formatWithValidation({pathname: addBasePath(pathname), query}), getURL()); return; }` — state가 null이면 "해시만 바뀐 것"으로 보고 URL만 되돌린 뒤 라우트 전환 없이 return한다.
- 왜 문제인가: Next는 히스토리 항목마다 `{url, as, options, __N, key}`를 넣어 두고 뒤로가기 때 그 값으로 페이지를 복원한다. `replaceState(null, …)`은 현재 항목의 그 상태를 통째로 지운다. 이후 클라이언트 이동을 한 번 거친 뒤 뒤로가기를 누르면 onPopState가 `!state` 분기로 빠져 beforePopState·routeChangeComplete가 호출되지 않는다. 그래서 `_app`의 스크롤 복원·GA page_view도 없다. SectionAnchorNav의 주석("딥링크·뒤로가기 보존")이 의도한 것과 정반대 동작이다.
- 재현(로컬 dev 3100, Chrome): /ko/pricing에서 앵커 pill 클릭 → `history.state`가 `{url:'/[locale]/pricing?locale=ko', as:'/ko/pricing', __N:true, key:…}`에서 `null`로 바뀜 → 헤더 링크로 /ko/recording 클라이언트 이동 → `history.back()` → 주소는 `/ko/pricing#special-packages`인데 h1·title·DOM은 녹음실 페이지 그대로, state는 `{url:'/[locale]/recording?locale=ko', as:'/ko/pricing#special-packages'}`로 오염. 대조군(앵커 클릭 없음)은 정상 복귀. 새로고침 전까지 그 항목은 오염된 채 남는다. 대상은 content/stories 1,766편 중 h2/h3 3개 이상인 1,759편(TOC 렌더 조건 `MIN_HEADINGS=3`) + /ko/pricing — 검색 유입 대부분이 스토리 상세로 들어와 목차를 누르고 CTA·관련 글로 이동한 뒤 뒤로가기(특히 모바일 물리 뒤로가기)를 쓰는 경로다. auth.tsx는 출구가 전부 문서 이동(`location.href`·plain `<a>`)이라 실질 영향이 거의 없다.
- **수정**:
  1. `TableOfContents.tsx:36`·`SectionAnchorNav.tsx:69`를 `window.history.replaceState(window.history.state, '', \`#${id}\`)`로 바꾼다. 실측: 뒤로가기 정상 복귀, key 보존으로 `_app` 스크롤 복원 유지. 뒤로가기 뒤 URL에서 해시만 빠지는데 이는 Next가 `state.as`로 URL을 되돌리기 때문이며, `as`에 해시를 넣으면 routeChangeComplete 뒤 scrollToHash(`router.js:1060-1066`)가 `_app`의 위치 복원을 덮으므로 넣지 않는 쪽이 낫다.
  2. `router.replace({hash}, undefined, {shallow:true})` 대안은 쓰지 않는다 — onlyAHashChange 경로(`router.js:681-702`)가 클릭마다 `router.set` 재렌더를 돌리고 `as`에 해시가 남아 복원 위치가 어긋난다.
  3. `funding/creator/auth.tsx:52`는 일괄 치환에서 제외한다 — state.url/as가 `?token=`을 물고 있어 보존하면 뒤로가기 때 토큰이 주소창에 재노출된다(그 줄 주석이 막으려는 바로 그것). 굳이 고치려면 `{...state, url:'/[locale]/funding/creator/auth?locale=ko', as:'/ko/funding/creator/auth'}`처럼 url·as까지 지운 state로 바꾸고 `authLogin.test.tsx`(replaceState 모킹)를 확인한다.
  4. 재발 방지: 두 컴포넌트에 jest 케이스(사전 `history.replaceState({__N:true,key:'k'}, '', '/ko/x')` → 앵커 클릭 → `history.state.__N === true`·`key` 유지 단언; scrollIntoView·matchMedia 모킹 필요)와 eslint `no-restricted-syntax`(`history.replaceState(null`·`pushState(null`)를 둔다. 펀딩 모달(406aae82ef)의 `{...window.history.state, …}` 보존 방식과 같은 규칙이다.
- 비고(검증자 조정): 2026-07-03 281a3ae7bd에서 들어온 뒤 수정 이력 없음. 원 지적의 "스크롤 복원도 historyKey()가 null이라 꺼진다"는 기전은 부정확 — arrived()는 TOC 클릭 전 routeChangeComplete에서 이미 key를 잡았고, 문제는 `!state` 분기에서 beforePopState·routeChangeComplete 자체가 안 불리는 것이다(결과는 같다). auth.tsx 제외와 router.replace 대안 기각은 검증자가 바로잡은 요지다.

#### FE-2. 포커스 트랩이 disabled·tabindex=-1·비선택 라디오를 경계로 잡아 Tab이 모달 밖으로 샌다 (동작 테스트도 없음) [P2 · M]

- 위치: `utils/useFocusTrapDialog.ts:9-10, 28-35, 96-107`; 소비처 `components/funding/RewardModal.tsx:196-215`, `components/funding/PledgeWizard.tsx:934-939`, `components/ui/Modal.tsx`; 테스트 `utils/useFocusTrapDialog.test.tsx`.
- 지금 코드: L9-10 선택자 `'button, a[href], input, textarea, select, iframe, [tabindex]:not([tabindex="-1"])'` — disabled·hidden input·tabindex=-1인 button/a를 거르지 않는다. L28-35 필터는 offsetParent/getClientRects만 본다. L96 `const lastElement = focusableElements[focusableElements.length - 1];` L107 `if (activeElement === lastElement) { firstElement.focus(); event.preventDefault(); }`.
- 왜 문제인가: 경계(first/last) 판정이 "실제로 Tab 가능한가"를 보지 않는다. disabled 버튼은 레이아웃 박스가 있어 실제 브라우저에서 목록에 들어가 lastElement가 된다. `PledgeWizard.tsx:939` submit은 `disabled={submitting || allSoldOut || (!usingBank && !paymentReady)}`이고 DOM상 개인정보 처리방침 Link(L934) 뒤 마지막 요소다.
- 조건→결과: 위젯 로딩 중(!paymentReady, 수 초)·처리 중·품절이면 방침 링크에서 Tab을 눌러도 `activeElement !== lastElement`라 되감기가 안 걸리고 포커스가 모달 뒤 페이지로 나간다. Shift+Tab은 L100-102에서 첫 요소에서 disabled 버튼에 `.focus()`를 부르는데 무효이고 preventDefault만 해 제자리에 갇힌다. RewardModal 상세 단계(L196-215)는 품절이면 푸터 버튼이 disabled이고 포커스 대상이 닫기 버튼과 이 버튼뿐이라 지속적으로 샌다. tabindex=-1인 button/a와 선택되지 않은 라디오도 같은 이유로 경계가 될 수 있다. aria-modal 계약이 깨진다. 테스트는 소스를 정규식으로 읽어 selector 토큰만 검사하고(jsdom에서 offsetParent/getClientRects가 항상 비어 목록이 늘 빈 배열), RewardModal.test는 훅 자체를 mock한다 — 되감기 분기는 어느 테스트도 실행하지 않는다.
- **수정**: getFocusableElements를 순수 함수 `getTabbables(container, isVisible = isElementVisible)`로 export하고 필터를 `el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[inert],[aria-hidden="true"]')`로 강화한다. `.closest(...)`는 컨테이너 안쪽까지만 보게 범위를 제한한다(MobileNav는 컨테이너 자신에 `aria-hidden={!isOpen}`이 걸림). 같은 name의 라디오는 checked 하나(없으면 첫 번째)만 남긴다. 선택자 문자열(`button` 등)은 기존 정규식 테스트가 토큰 단위로 보므로 그대로 두고 필터에서 `:disabled`·tabIndex<0을 거른다. 테스트는 isVisible을 주입(또는 `HTMLElement.prototype.getClientRects` 스텁)해 "마지막이 disabled일 때 되감기", "Shift+Tab 되감기", "Escape"를 동작으로 검증한다.
- 비고: 전 결제 차단은 아니고 일시적 구간+품절 상태라 P2.

#### FE-3. DropdownMenu 항목은 키보드 포커스가 사실상 보이지 않는다 (outline 제거 + 5% 틴트) [P2 · S]

- 위치: `components/layout/DropdownMenu.tsx:150-166`(항목 Link L160-161); 가드 `tailwind.config.test.ts:690`; 토큰 `components/ui/focusRing.ts`.
- 지금 코드: L160 `className={\`flex items-center min-h-[44px] px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:bg-primary/5 focus-visible:text-primary dark:focus-visible:text-primary-lighter ${isItemActive ? 'bg-primary/5 text-primary dark:text-primary-lighter font-medium' : 'text-gray-700 …'}\`}`.
- 왜 문제인가: `focus-visible:outline-none`으로 브라우저 기본 링을 지우고 대체 표시를 `bg-primary/5`와 `text-primary`로만 한다. 메뉴 바탕은 glass-menu(흰 0.88)라 5% 틴트는 사실상 1.0:1이고, 글자색 변화 gray-700(#374151)→primary(#065f46)는 휘도 비 약 1.33:1이다. 현재 페이지 항목(L161)은 이미 같은 bg/text라 포커스를 받아도 아무것도 바뀌지 않는다. design-system §5(3:1 링)와 WCAG 2.4.7/1.4.11 위반이며, 같은 파일의 트리거 버튼(L112)·DesktopNav·LanguageSwitcher는 모두 FOCUS 링이 있어 이 메뉴만 빠졌다.
- 조건→결과: 데스크톱에서 드롭다운을 키보드로 여는 사용자가 방향키로 어느 항목에 있는지 알 수 없다. `tailwind.config.test.ts:690`의 FOCUS_RING_COLOR_RE는 `focus-visible:ring-*`가 있는 줄만 매치하므로 "링이 아예 없는 요소"는 가드가 놓친다.
- **수정**: 항목 Link에 `focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70`를 추가한다(컨테이너가 overflow-hidden이라 offset 링은 잘리므로 inset; 기존 가드의 알파≥50·다크 짝 조건도 통과한다). 가드는 "focus-visible:outline-none이 있는데 ring이 없는 className"을 실패시키도록 확장하되, 기존 위반이 있을 수 있으니 기준선 방식으로 넣는다.
- 비고: gray-700은 #1f2937이 아니라 #374151(결론 불변). git log -S로 이후 수정 없음.

#### FE-4. DropdownMenu: hover로 열린 메뉴를 트리거 클릭이 닫아 버리고, ARIA menu 선언이 실제 키보드 모델과 어긋난다 [P2 · M]

- 위치: `components/layout/DropdownMenu.tsx:43-46, 71-81, 104-156`; 비교 대상 `components/LanguageSwitcher.tsx:201-206`, `components/layout/DesktopNav.tsx`.
- 지금 코드: L106 `onMouseEnter={handleMouseEnter}`(컨테이너에서 열기, L43-46) / L121 `aria-haspopup="menu"` / L123 `onClick={() => setIsOpen((prev) => !prev)}` / L145 `<div className="py-2" role="menu" …>` / L153 `role="menuitem"`(사이트 이동 링크). LanguageSwitcher.tsx L201-206 주석: "aria-haspopup="menu"는 SR에 menu/menuitem을 약속하는 거짓 계약이었다. 제거하고 aria-expanded만으로".
- 왜 문제인가: 마우스가 트리거에 닿으면 hover로 열리고, 그 상태에서 클릭하면 토글이 닫는다(포인터는 여전히 컨테이너 안이라 mouseenter가 다시 안 뜸). 또 role=menu/menuitem/aria-haspopup=menu를 선언하면서 Enter/Space로 열어도 포커스는 트리거에 남고(L71-81) Home/End·타입어헤드가 없어 같은 헤더의 LanguageSwitcher(disclosure)와 계약이 반대다.
- 조건→결과: 데스크톱 마우스 사용자가 트리거를 클릭하면 메뉴가 닫혀 포인터를 뺐다 다시 넣어야 한다(코드로 확정). SR 사용자에게 사이트 이동 링크가 menuitem으로 읽힌다. 터치/펜 동작과 SR forms 모드 진입은 미검증.
- **수정**: (1) hover 열림은 `onPointerEnter`에서 `pointerType === 'mouse'`일 때만 걸고, 클릭은 "열려 있으면 닫기"가 아니라 hover로 열린 상태를 고정(pin)하는 쪽으로 처리한다(타이머 휴리스틱 사용 안 함). (2) role=menu/menuitem/aria-haspopup을 제거하고 aria-expanded+aria-controls만 둔 링크 목록(`<ul>`)으로 LanguageSwitcher와 맞춘다. ArrowDown/Escape는 유지. 공통 훅 추출은 하지 않는다.
- 비고(검증자 조정): ArrowDown으로 첫 항목에 들어가고 항목 간 ArrowUp/Down·Escape가 되므로 "아무것도 없다로 읽힌다"는 NVDA/JAWS 서술은 검증하지 못한 추정. 원 지적의 "300ms 안의 click 무시"는 타이밍 휴리스틱이라 기각, useDisclosureMenu 훅 통합은 CLAUDE.md의 "한 번 쓰고 말 일에 추상화 금지"와 맞지 않아 기각. ARIA 정리는 P3 성격이고 hover+click 충돌이 P2를 지탱한다. LanguageSwitcher 주석은 인용한 166-171줄이 아니라 L201-206에 있다.

#### FE-5. FAQ 접힌 답변이 aria-hidden인데 안의 전화 링크는 Tab으로 들어간다 [P2 · S]

- 위치: `components/ui/FAQSection.tsx:83-103`; `components/ui/PhoneAwareText.tsx`; 데이터 `data/faq.ts:69,148,211,257,303,349,395`.
- 지금 코드: L83-95 `<m.div id={\`faq-panel-${index}\`} role="region" aria-labelledby=… animate={activeIndex === index ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }} className="overflow-hidden" aria-hidden={activeIndex !== index}> … <PhoneAwareText text={item.answer} source="faq" />`.
- 왜 문제인가: 접힘을 height:0+opacity:0으로만 구현하고 aria-hidden을 건다. overflow-hidden은 포커스를 막지 않으므로 PhoneAwareText가 만든 `<a href="tel:…">`가 접힌 상태에서도 Tab 순서에 남는다(axe `aria-hidden-focus`, serious). 모든 답변 패널에 role=region을 붙여 항목이 많은 페이지에서는 landmark 소음도 된다.
- 조건→결과: `data/faq.ts`의 예약 문의 답변(7개 로케일)에 `CANONICAL_FACTS.phone`이 들어 있어 링크가 생긴다. 전화번호가 든 FAQ가 있는 모든 LP/공연 상세에서 키보드 사용자가 보이지 않는 링크를 거쳐 가고, 그 링크에서 Enter를 누르면 전화가 걸린다. 스크린리더는 포커스가 aria-hidden 안에 있다고 판단해 읽기를 멈추거나 무시한다. 범위는 페이지당 항목 하나 안팎.
- **수정**: aria-hidden을 지우고 패널에 `inert={activeIndex !== index}`(React 19.2.4·@types/react 19.2.13 boolean 지원, 저장소에 inert 사용처는 아직 없음)를 준다. framer height 애니메이션은 유지하되 닫힘 상태에서 `transitionEnd: { visibility: 'hidden' }`도 둔다. role=region은 제거(버튼 aria-controls/aria-expanded로 충분; 선택 사항). FAQSection 전용 테스트는 없으니 접힌 패널 안 링크가 tabbable이 아님을 단언하는 케이스를 하나 둔다.
- 비고: 검증자 확인(confirmed).

#### FE-6. StickyBottomCTA의 다크 불투명 배경 덮어쓰기가 CSS emit 순서 때문에 무효 [P2 · S]

- 위치: `components/inline/StickyBottomCTA.tsx:101-103`; 토큰 `components/ui/Notice.tsx:28`; `lib/utils.ts`(cn).
- 지금 코드: L103 `${NOTICE_TONE_CLASS.warning} dark:bg-amber-950` — warning 값에 이미 `dark:bg-amber-950/40`이 있다. 이 저장소 tailwind 설정으로 두 클래스를 컴파일하면(나열 순서를 바꿔도 동일) `.dark\:bg-amber-950:is(.dark *){…}` 다음에 `.dark\:bg-amber-950\/40:is(.dark *){background-color: rgb(69 26 3 / 0.4)}`가 emit된다.
- 왜 문제인가: 템플릿 문자열로 이어 붙인 두 클래스는 명시도가 같고 /40이 나중에 emit되어 이긴다. 주석(L101-102)이 약속한 불투명 덮어쓰기가 적용되지 않아 다크 모드 바 배경이 40% 투명이다.
- 조건→결과: 스토리 상세 전 페이지 다크 모드에서 하단 고정 바 뒤로 본문 글자가 60% 비쳐 대비가 흔들린다(blur도 없음).
- **수정**: className을 `cn('fixed inset-x-4 bottom-4 sm:bottom-8 z-50 max-w-2xl sm:mx-auto rounded-xl border shadow-lg p-4 flex items-center gap-3', NOTICE_TONE_CLASS.warning, 'dark:bg-amber-950')`로 바꾼다(`lib/utils`의 cn=twMerge가 `dark:bg-amber-950`만 남기는 것을 node로 확인). 다른 Callout과 새 가드는 건드리지 않는다.
- 비고(검증자 조정): 같은 문자열 결합을 쓰는 `InlinePriceCallout.tsx:95`·`InlineServiceCallout.tsx:263`·`InlineBookingCallout.tsx:46`·`HubLinkCallout.tsx:34`는 NOTICE_TONE_CLASS 뒤에 같은 속성을 덮어쓰는 클래스가 없어 해당 없음(HubLinkCallout의 hover:/dark:hover:는 다른 variant). 수정 범위는 StickyBottomCTA 한 곳이고 새 uiPatterns 가드는 과하다.

#### FE-7. Layout이 첫 방문에 시스템 테마를 사용자 선택값으로 localStorage에 고정한다 [P2 · S]

- 위치: `components/Layout.tsx:41-64`(L44-45, L60); `public/scripts/theme-init.js:22-25`; `pages/_app.tsx`; 테스트 `Layout.test.tsx`.
- 지금 코드: L44 `setIsDarkMode(document.documentElement.classList.contains('dark'));` L45 `setHasThemeLoaded(true);` → L49-63 효과가 `localStorage.setItem('darkMode', String(isDarkMode));`를 무조건 호출. theme-init.js: `var shouldUseDark = storedPreference === 'true' || (storedPreference === null && prefersDark);`.
- 왜 문제인가: theme-init.js는 저장값이 없으면 OS 설정(prefers-color-scheme)을 따르도록 설계했는데, Layout의 둘째 effect가 마운트 직후 현재 클래스 상태를 'true'/'false'로 저장한다. 토글을 누른 적 없는 사용자도 첫 방문 순간의 OS 테마가 "명시적 선택"으로 굳는다. 저장 코드가 있는 곳은 L60 하나뿐이고 이를 의도로 기록한 문서·주석은 없다(최초 도입 101e3e4b43부터 무조건 저장).
- 조건→결과: 낮에 방문한 라이트 OS 사용자는 밤에 OS가 다크로 바뀌어도 사이트가 라이트 고정이다(반대도 동일). `storedPreference === null` 분기는 사실상 죽은 코드가 된다. 토글로 복구 가능하고 데이터 손실이 없어 P2.
- **수정**: 저장은 사용자 동작에서만 한다. effect의 `localStorage.setItem`을 제거하고 toggleDarkMode 안에서 `const next = !isDarkMode; setIsDarkMode(next); try { localStorage.setItem('darkMode', String(next)); } catch {}`로 옮긴다(토글이 updater 함수를 쓰므로 next를 명시적으로 계산). 클래스 적용/theme-color 갱신 effect는 그대로 둔다. `Layout.test`에 "토글 전에는 darkMode 키가 없다" 케이스를 추가한다(현재는 setItem이 막혀도 렌더되는지만 본다).
- 비고: 검증자 확인(confirmed).

#### FE-8. MediaGallery 점·현재 위치 계산이 w-[85%] 한 가지 폭만 가정해 sm·lg(홈 데스크톱)에서 어긋난다 [P2 · M]

- 위치: `components/ui/MediaGallery.tsx:28-75`(L34, L73), L80-100(화살표), L110(status), L123(카드 폭); 유일 사용처 `pages/[locale]/index.tsx:227`; 데이터 `data/home.ts` ko studioImages 5장.
- 지금 코드: L34 `const index = Math.round(scrollLeft / (clientWidth * 0.85)); // 0.85 is based on w-[85%]` / L73 `const scrollAmount = index * clientWidth * 0.85;` / L123 `className="flex-none w-[85%] sm:w-[45%] lg:w-[31%] snap-center"`.
- 왜 문제인가: 카드 폭이 모바일 85%, sm 45%, lg 31%(+gap-4)로 바뀌는데 현재 인덱스와 점 클릭 이동은 항상 `0.85*clientWidth`를 한 장의 피치로 쓴다. sr-only role=status 위치 안내('N/M', L110)와 점 개수(images.length)도 그 값에 묶여 있다. git log상 w-[85%] 이후 sm/lg 폭이 추가되며(d835fd05df/7b91c0a6cb) 계산이 갱신되지 않았다.
- 조건→결과: lg(clientWidth≈1216): 카드 377px+gap 16=피치 393, scrollWidth=5×377+4×16=1949, 최대 scrollLeft=733인데 activeIndex=round(733/1034)=1이라 끝까지 가도 2번째 점에 머문다. 점 클릭 이동은 i×1034이므로 2~5번째 점은 모두 최대값 733으로 클램프되어 같은 곳으로 간다. sm(≈736): 피치 347 대 코드 626으로 activeIndex가 0~2에서 멈추고 4·5번째 점은 같은 끝으로 간다. 모바일(85%)은 피치 차이가 gap 16px뿐이라 round가 흡수한다. 화면낭독기 사용자에게 잘못된 위치가 읽힌다.
- **수정**: 피치를 DOM에서 읽는다: `const items = el.children; const pitch = items.length > 1 ? (items[1] as HTMLElement).offsetLeft - (items[0] as HTMLElement).offsetLeft : el.clientWidth;`로 `index = round(scrollLeft / pitch)`, 이동은 `items[i].scrollIntoView({ inline: 'start', block: 'nearest', behavior })`(또는 offsetLeft 기반 scrollTo). 스크롤 컨테이너가 positioned가 아니어서 offsetLeft는 차이값으로 쓴다. 점 개수는 maxScrollLeft/pitch 기준 페이지 수로 줄인다. 화살표는 끝에서 언마운트하지 말고 disabled+aria-disabled로 두어 포커스가 사라지지 않게 한다(별건이지만 같이 고친다).
- 비고: 검증자 확인(confirmed). 치수는 클래스에서 계산한 값이고 렌더 실측은 하지 않았다.

#### FE-9. 모바일에서 글로벌 플레이어 도크가 카카오 FAB·맨 위로 행을 통째로 덮는다 [P2 · M]

- 위치: `components/audio/GlobalPlayerDock.tsx:21-22, 77-83`; `components/Layout.tsx:255-259`; `components/audio/GlobalPlayerProvider.tsx:165-167`; `components/common/KakaoFab.tsx:120-125`; `components/ui/ScrollToTop.tsx`; 진입점 `pages/[locale]/recording`(ServiceExcerpt L304)·`release-project`(L327)·홈·포트폴리오; `data/audioExcerpts.ts`.
- 지금 코드: GlobalPlayerDock.tsx:79-80 `className={\`fixed z-40 bg-gray-950 … inset-x-0 bottom-0 rounded-none … px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] … ${mobileHidden ? 'hidden lg:block' : ''}\`}` / Layout.tsx:256-257 `style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }} className="fixed right-6 z-40 flex items-center gap-2"` — 도크는 GlobalPlayerProvider에서 `{children}` 뒤에 렌더.
- 왜 문제인가: <lg의 도크는 높이 약 86px 전폭 바(pt-2 8+제목 17.5+부제 15+mt-0.5+파형 mt-1.5 6+h-7 28+pb-2 8+border)이고 FAB 행은 bottom 24px·KakaoFab 버튼 52px이라 화면 바닥 24~76px 구간, 완전히 도크 안쪽이다. 둘 다 z-40이고 DOM 순서상 도크가 뒤라 위에 칠해지며, 불투명 gray-950이라 FAB(전화+카카오)·맨 위로가 보이지도 눌리지도 않는다. MOBILE_HIDDEN_ROUTES(스토리·펀딩·공연·예약 마법사)는 자체 하단 바가 있어 처리했지만 재생 진입점이 있는 홈·LP·포트폴리오는 처리하지 않았다. 설계 문서 §3-6은 모바일 시트를 z-[45]로 적었으나 FAB 회피는 문서에도 코드에도 없고 `mobileCtaFabCollision.test`도 이 조합을 다루지 않는다.
- 조건→결과: 모바일에서 발췌를 한 번만 재생해도 사이트의 유일한 검증된 전환 진입점(카카오 FAB·전화 버튼)이 도크를 닫을 때까지 보이지도 눌리지도 않는다. 도크의 X를 누르면 복구되므로 P1은 아니지만 상업 LP의 전환 진입점이 가려지는 점에서 P2 상단.
- **수정**: Layout이 `useGlobalPlayer().track`을 읽어 <lg에서만 FAB 행 bottom을 올린다(Provider 밖에서는 NOOP 반환이라 테스트 안전). 이때 도크의 mobileHidden 판정(MOBILE_HIDDEN_ROUTES)을 공유 상수로 빼 두 곳이 어긋나지 않게 하고, FAB 행의 inline style(bottom)은 Tailwind 클래스+`lg:` 복원으로 바꿔야 미디어 쿼리를 쓸 수 있다(예: 도크 열림이면 `bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-[max(1.5rem,env(safe-area-inset-bottom))]`). 대안은 GlobalPlayerDock이 mount 시 `document.documentElement.dataset.player = 'open'`을 달고(unmount 시 제거) globals.css에서 `[data-player=open]` + <lg 조건으로 올리는 방식이지만 Layout 분기가 더 단순하다. `mobileCtaFabCollision.test`와 같은 방식의 회귀 테스트를 추가한다.
- 비고: 검증자 확인(confirmed). 렌더 실측은 하지 않았고 위 치수는 클래스에서 계산한 값이다.

#### FE-10. FundingAudioPlayer와 press AlbumPlayerContext가 '소리는 한 번에 하나' 버스를 건너뛴다 [P2 · S]

- 위치: `components/funding/FundingAudioPlayer.tsx:168-252`(L171, L239-249); `components/press/AlbumPlayerContext.tsx:250`; `lib/audio/audioBus.ts`; 참여 중인 곳 `components/audio/GlobalPlayerProvider.tsx`·`components/audio/MixComparePlayer.tsx`; `components/audio/GlobalPlayerDock.tsx:21-22`; 콘텐츠 `content/funding/sabbaha-slung.md:101,105`.
- 지금 코드: FundingAudioPlayer.tsx:171 `const el = new Audio();` … L239-249 togglePlay → `await el.play();` (announcePlay/onOtherPlay 호출 없음). `lib/audio/audioBus.ts` `export type AudioSource = 'global' | 'mix-compare' | 'portfolio-player';` / design-system.md §4 "사이트의 소리는 한 번에 하나만 난다(audioBus …)".
- 왜 문제인가: grep 결과 announcePlay/onOtherPlay는 GlobalPlayerProvider와 MixComparePlayer에만 있다. 펀딩 미리듣기와 비공개 감상실(AlbumPlayerContext.tsx:250도 `new Audio()`)은 자기 Audio를 만들면서 버스에 알리지도 구독하지도 않는다. GlobalPlayerProvider는 `_app`에서 Layout 바깥을 감싸 라우트가 바뀌어도 재생이 이어진다. `'portfolio-player'`는 타입과 audioBus.test.ts에만 있고 실제 소비처가 없다.
- 조건→결과: 홈/LP에서 발췌를 틀어 둔 채 사바하 펀딩 상세(`%%funding-audio%%` 사용, status auto·hidden false)로 가서 미리듣기를 누르면 두 소리가 겹친다. 더 나쁜 것은 GlobalPlayerDock이 funding/[slug]에서 모바일 도크를 숨기므로(hidden lg:block) 모바일에서는 먼저 울리던 소리가 안 보이는 채로 계속 울리고 그 위에 미리듣기가 겹치며 끌 UI가 없다.
- **수정**: `AudioSource`에 `'funding-audio'`와 `'press-album'`을 추가한다. `FundingAudioPlayer.togglePlay`에서 ensureAnalyser 다음, `el.play()` 직전에 `announcePlay('funding-audio')`를 부르고, clip이 있을 때 effect에서 `onOtherPlay('funding-audio', () => audioRef.current?.pause())`를 구독한다(기존 pause 리스너가 아이콘/루프를 정리한다). AlbumPlayerContext도 같은 방식으로 맞춘다. 그 뒤에 "`new Audio()`를 만드는 파일은 audioBus를 import해야 한다"는 소스 스캔 테스트를 둔다 — AlbumPlayerContext도 걸리므로 같이 고친 뒤에 넣는다. 미사용 `'portfolio-player'`는 정리 여부를 같이 결정한다.
- 비고(검증자 조정): 원 지적의 "버스를 쓰는 곳은 GlobalPlayerProvider·MixComparePlayer·press/AlbumPlayerContext"는 틀렸다 — AlbumPlayerContext도 미참여다.

#### FE-11. ShowBookingForm만 위젯 약관 미확인(null)을 막지 않고, 다른 폼·훅 주석은 반대 계약을 적고 있다 [P2 · S]

- 위치: `components/shows/ShowBookingForm.tsx:174-178`(L176), L228-230(catch), L363(agreement div); 비교 `components/payments/PaymentLinkCheckout.tsx:44`, `components/funding/PledgeWizard.tsx:461-463`, `components/booking/BookingWizard.tsx:381-383`, `components/booking/MixingOrderWizard.tsx:227-229`; 훅 `components/booking/useTossPaymentWidgets.ts:78-80`, `components/payments/usePaymentCheckout.ts`; 테스트 `ShowBookingForm.test.tsx:7`.
- 지금 코드: ShowBookingForm.tsx:176 `if (widget.agreedRequiredTerms === false) return setError(t.errTerms);` vs 다른 네 폼 `if (agreedRequiredTerms !== true) {`. 커밋 0f65e6fbd2(#159, 2026-09-16): "위젯은 체크를 한 번이라도 건드릴 때만 이벤트를 보낸다. 약관을 빼먹는 가장 흔한 경로가 정확히 null … !== true로 좁혔다". 그런데 useTossPaymentWidgets.ts:78-80은 "`null`을 false로 취급하지 않는 이유 … 모를 때는 종전대로 보내고", PledgeWizard.tsx:461-462·BookingWizard.tsx:381·MixingOrderWizard.tsx:227은 "(null)는 막지 않는다"라고 적혀 있다.
- 왜 문제인가: #159는 세 위저드만 고쳤고 공연 예매 폼은 그 뒤인 2026-10-03(9c7eedbadf, #442)에 생기며 옛 조건을 가져갔다. 위젯 모드의 폼에는 `<div id={widget.agreementId}/>`(L363)가 있어 null 경로가 실제로 열려 있다. 게다가 훅 설명 주석과 세 폼의 인라인 주석이 코드와 정반대라 다음 사람이 `!== true`를 "고쳐서" 회귀시킬 위험이 크다.
- 조건→결과: 약관 체크를 한 번도 건드리지 않은 구매자는 null이라 공연 폼 가드를 통과해 주문이 생성되고(좌석 10분 홀드) requestPayment가 실패한 뒤 catch(L228-230)가 NEED_CARD_PAYMENT_DETAIL이 아니면 `t.errClosed`("결제창이 닫혔습니다…")를 띄워 원인이 가려진다. 공연 티켓 구매의 가장 흔한 실패 경로가 좌석 홀드만 남기고 원인 불명 오류로 끝난다. 돈은 새지 않으므로 P2.
- **수정**: ShowBookingForm L176을 `widget.agreedRequiredTerms !== true`로 바꾸고(picker 모드는 훅이 true를 돌려준다) 영어 문구가 있는 `t.errTerms`를 쓴다. `useTossPaymentWidgets.ts`의 agreedRequiredTerms 설명과 세 위저드의 "(null)는 막지 않는다" 주석을 #159 결정("null도 막는다")으로 고친다. 더 낫게는 `usePaymentCheckout`이 `termsBlocked: agreedRequiredTerms !== true`를 돌려줘 다섯 폼이 한 판정을 쓰게 한다. `ShowBookingForm.test`에 null/false 케이스를 세 위저드처럼 추가한다(모의 기본값이 null이지만 toss 제출 경로를 타는 기존 테스트가 없어 깨지지 않으니 모의를 바꿔 추가). FE-17의 가드(`agreedRequiredTerms === false` 소스 스캔 금지)도 같이 넣으면 재발이 막힌다.
- 비고: 검증자 확인(confirmed).

#### FE-12. 계좌 입금 제출 성공 직후 finally가 submitting을 풀어 이동 중 재클릭으로 중복 신청이 생긴다 (계좌 경로 4개 폼) [P2 · S]

- 위치: `components/funding/PledgeWizard.tsx:440-452`(L446, L449-452, 버튼 L939); `components/booking/BookingWizard.tsx:358-370`(버튼 L772); `components/booking/MixingOrderWizard.tsx:210-216`(버튼 L551); `components/shows/ShowBookingForm.tsx:160-166`(버튼 L402); `components/payments/PaymentLinkCheckout.tsx`.
- 지금 코드: PledgeWizard.tsx:446 `window.location.assign(json.manageUrl);` … L449-452 `} finally { submittingRef.current = false; setSubmitting(false); }`. 나머지 세 폼도 `window.location.assign(...); return;` 뒤 `finally { setSubmitting(false) }`.
- 왜 문제인가: assign 직후 return하지만 finally가 submitting(펀딩은 submittingRef까지)을 곧바로 풀어 이동이 끝나기 전에 버튼(`disabled={submitting}`)이 다시 켜진다. 서버에는 멱등/중복 방어가 없다(레이트 리밋은 IP당 횟수뿐). PledgeWizard의 ref 가드는 "연타로 pending 두 건" 사고를 막으려고 둔 것인데 이 경로에서 풀려 버린다.
- 조건→결과: 이동 지연 구간(회선 의존, 길이 미실측)에 재클릭하면 두 번째 POST가 별도 신청을 만든다. 펀딩은 awaiting_deposit 후원이 2건 생겨 한정 리워드 재고를 이중으로 잡고(자동 취소 없음), 믹싱은 같은 주문이 2건(잡는 시간대가 없어 409가 아니다), 공연은 좌석 홀드가 2건. 예약은 두 번째가 409 slot_taken을 받아도 이미 시작된 이동은 계속되므로 첫 신청의 manageUrl에 도착하고 화면이 잠깐 깜빡이는 정도다. 모두 운영자 수동 취소로 정리된다. 발생 확률은 낮다.
- **수정**: 성공 경로에서는 상태를 풀지 않는다. 폼마다 `let navigating = false`를 두고 assign 직전에 true로 세운 뒤 `finally { if (!navigating) { submittingRef.current = false; setSubmitting(false); } }`. 단 브라우저 뒤로가기의 bfcache 복원(페이지 상태가 그대로 살아난다)에서 버튼이 영구 "처리 중…"+disabled로 남지 않게 `pageshow`(`event.persisted`)에서 submitting을 푸는 리스너를 함께 둔다. 테스트는 "assign 호출 뒤 버튼이 disabled로 남는다"와 "pageshow persisted에서 풀린다" 두 개.
- 비고(검증자 조정): 원 지적의 "토스 결제창 열기도 같은 finally"는 requestPayment가 리다이렉트 중 끝나지 않는 promise라 같은 방식으로 나지 않는다(미검증 추정). bfcache 함정은 검증자가 더한 것.

#### FE-13. ErrorBoundary가 렌더 오류를 보고하지 않고 라우트가 바뀌어도 풀리지 않는다 [P2 · M]

- 위치: `components/ErrorBoundary.tsx:15-56`(L25-27); `pages/_app.tsx:372`; 참고 패턴 `utils/reportPaymentFailure.ts`, `pages/api/payments/failed.ts`.
- 지금 코드: L25-27 `componentDidCatch(error: Error, errorInfo: React.ErrorInfo) { console.error('ErrorBoundary caught an error:', error, errorInfo); }` — state는 hasError만 있고 reset 경로가 없다. 저장소에서 클라이언트 오류 수집은 reportPaymentFailure(결제 한정)뿐이고 Sentry/window.onerror/unhandledrejection 리스너는 없다(reportWebVitals는 개발 로그만).
- 왜 문제인가: 클라이언트 렌더 예외는 사용자 콘솔에만 남는다. `_app.tsx:372`가 Layout 바깥에서 감싸므로 한 번 걸리면 폴백이 Layout까지 대체해(헤더·링크·`<main>` 없음) 클라이언트 라우트가 바뀌어도(뒤로가기 포함) 폴백이 남는다.
- 조건→결과: 특정 로케일·브라우저 조합의 렌더 오류가 발견되지 않고, 걸린 방문자는 새로고침 말고 빠져나갈 길이 없다. 실제 발생 빈도 데이터는 없어 P1로 올리지 않는다.
- **수정**: (1) 보고: componentDidCatch에서 `navigator.sendBeacon`으로 얇은 API에 보낸다. 새 엔드포인트는 `pages/api/payments/failed.ts` 패턴을 그대로 쓴다(`isAllowedContactRequestOrigin`, `consumeRateLimit`, 항상 204, 메시지/스택 길이 제한). 서버는 console.error 한 줄(Vercel 런타임 로그)로 남기고 오류마다 메일은 보내지 않는다. 같은 메시지는 클라이언트에서 세션당 1회로 중복 제거. (2) 복구: `_app`의 경계에 key를 걸지 않는다 — 이 경계가 GlobalPlayerProvider와 Layout을 감싸므로 라우트마다 key가 바뀌면 둘이 재마운트돼 "페이지를 옮겨도 소리가 끊기지 않는다"는 글로벌 플레이어 설계(GlobalPlayerProvider.tsx 머리 주석)와 헤더 상태가 깨진다(`_app`의 routeTransitionKey는 일부러 안쪽 Component에만 건다). 대신 ErrorBoundary에 `resetKey` prop(`routeTransitionKey(router.asPath)`)을 넘기고 `componentDidUpdate`에서 hasError이면서 resetKey가 바뀌면 state를 초기화한다. (3) 폴백에 홈 링크 하나를 둔다.
- 비고(검증자 조정): 원 지적의 `<ErrorBoundary key={router.asPath}>`는 해로운 수정이라 기각. 새 `/api/client-error`는 인증이 없어 남용·로그 홍수를 막아야 한다.

#### FE-14. 계약 안내·완료 화면의 문의 전화와 브랜드 줄이 흰 바탕 text-gray-400(2.54:1)이다 [P2 · S]

- 위치: `components/contracts/ContractNotice.tsx:17-21`(L19); `pages/[locale]/contracts/[id]/complete.tsx:227`; `pages/[locale]/contracts/[id]/sign.tsx:624`; 토큰 `tailwind.config.ts:55`; 가드 `tailwind.config.test.ts`(LIGHT_FIXED 면제). 건드리면 안 되는 곳: `components/funding/PublicNameChoice.tsx:90`.
- 지금 코드: ContractNotice.tsx:19 `<p className="text-sm text-gray-400 dark:text-gray-400 mt-6">문의: 스튜디오 놀 010-4255-7893</p>` / complete.tsx:227 `<p className="text-gray-400 dark:text-gray-400 text-sm font-medium mb-2">스튜디오 놀</p>`. 이 사이트 gray-400은 스톡 #9ca3af, 흰색 위 약 2.54:1.
- 왜 문제인가: AA(4.5:1)에 못 미친다. ContractNotice의 전화번호는 계약 링크가 무효일 때 고객이 볼 유일한 연락 수단이고, complete의 브랜드 줄은 헤더를 붙이지 않는 완료 화면의 유일한 출처 표시다. 두 화면은 light 고정이라 dark: 짝도 같은 값이고, 대비 가드는 브랜드색 텍스트만 보고 계약 화면은 LIGHT_FIXED로 면제한다. design-system §1 메타·캡션 정본은 gray-500(#4b5563, 7.5:1).
- 조건→결과: 저시력·고령 계약 당사자가 연락처와 발신처 표시를 읽기 어렵다. 법적 문서 흐름의 복구 경로가 걸려 있어 P2.
- **수정**: 두 줄을 `text-gray-500`으로 올리고 light 고정 화면이라 `dark:text-gray-500`로 짝을 맞춘다. 가드 확장은 하지 않는다(공개 화면의 text-gray-300/400이 15곳, 짝 없는 gray-400이 5곳뿐이라 두 줄을 직접 고치면 끝). `sign.tsx:624`의 '+/−' 글리프는 버튼 글자가 이름을 들고 있으니 `aria-hidden`만 붙인다. `PublicNameChoice.tsx:90`의 옅은 색은 "아직 안 채워졌다"를 알리려는 의도된 처리(2026-09-30)라 같이 고치면 안 된다.
- 비고(검증자 조정): 정본 메타·캡션 값은 gray-600이 아니라 gray-500.

#### FE-15. 모바일 글래스 솔리드 폴백이 폐기된 1차 베이지 값(#faf7f2)에 남아 있다 [P3 · S]

- 위치: `styles/globals.css:32-37`(L32, L37), 폴백 블록 L62-90; 정본 `lib/brandColor.ts`; `tailwind.config.ts`.
- 지금 코드: L32 `--glass-solid: rgba(250, 247, 242, 0.95); /* 종이(paper)와 같은 값 — 모바일 헤더가 본문과 이어진다 */` / L37 `--glass-shadow: 0 8px 32px rgba(27, 22, 48, 0.12);` vs `lib/brandColor.ts` `paper: '#ffffff', paper2: '#f2f5f3'`(2026-10-07 2차 개정).
- 왜 문제인가: ce3654e4a5(1차 베이지)에서 들어간 값인데 0f2dc3ad3e(10/07 2차 개정)가 이 파일에서는 `--primary-rgb`만 바꾸고 이 줄을 남겼다. 저장소에서 faf7f2가 코드에 남은 곳은 이 줄뿐(나머지는 docs). 폴백 블록에서 모바일(hover:none+pointer:coarse 또는 max-width:768px)의 `--glass-tint`·`--glass-tint-menu`·`--glass-tint-clear`가 전부 이 값을 쓴다. CLAUDE.md는 "솔리드 폴백 값은 기존 bg-white/95와 동일"이라고 적는다.
- 조건→결과: 모바일 헤더·글래스 카드 표면이 순백이 아니라 미세한 크림색(0.95 알파의 #faf7f2가 흰 바탕 위에서 실효색 #fbf8f4 안팎). 차이가 아주 작아 "텁텁함 재발"로 단정할 수준은 아니다(화면 실측 없음). 그림자 색(27,22,48)도 12% 알파라 거의 보이지 않는다.
- **수정**: `--glass-solid`를 `rgba(255, 255, 255, 0.95)`로 바꾸고 주석을 `BRAND_COLOR.paper` 기준으로 고친다. `--glass-shadow`의 보라 시절 RGB는 선택 사항. 파싱 테스트는 필요하면 한 케이스만.
- 비고(검증자 조정): 한 줄 수정으로 끝나는 정합 정리이므로 P3.

#### FE-16. toHeadingId가 태국 문자를 지워 번역 스토리 11편에서 헤딩 id가 'section'으로 겹친다 [P3 · M]

- 위치: `components/markdown/headings.ts:14-22`(L19, L22); 같은 함수를 쓰는 `components/markdown/extractHeadings.ts`, `components/MarkdownRenderer.tsx`, `components/markdown/TableOfContents.tsx`; 테스트 `headings.test`.
- 지금 코드: L19 `.replace(/[^\w぀-ヿ㐀-䶿一-鿿가-힯-]/g, '')` … L22 `|| 'section'`. 실행 결과: `toHeadingId('ทำไมต้องมิกซ์') === 'section'`, `'ขั้นตอนการทำงาน' === 'section'`, `'Tại sao cần mixing' → 'ti-sao-cn-mixing'`.
- 왜 문제인가: 허용 문자가 `\w`+CJK+한글이라 태국 문자가 모두 제거된다. 번호 없는 태국어 헤딩은 전부 'section'이 된다.
- 조건→결과: 전 번역 스토리 실측 — 중복 id가 생기는 파일은 태국어 28편 중 11편(167개 헤딩 중 50개가 'section')뿐이다. 그 글에서 목차 점프·딥링크가 첫 'section'으로 가고 id가 중복된다. 번호가 붙은 헤딩('## 1. มิกซ์…')은 숫자가 남아 '1','2'로 서로 달라 동작한다. 베트남어·스페인어·우즈벡어·중국어·영어는 중복 0이고 베트남어는 읽기 어려운 슬러그일 뿐 충돌하지 않는다.
- **수정**: 정규식을 `.replace(/[^\p{L}\p{M}\p{N}_-]/gu, '')`로 바꾼다 — `\p{M}` 필수(태국어 성조·모음 부호 보존; `[^\p{L}\p{N}_-]`는 'มกซคออะไร'처럼 단어를 훼손한다). MarkdownRenderer와 extractHeadings가 같은 함수를 쓰므로 한 곳만 고치면 된다. 정규식만 바꿔도 태국어 중복은 11편→0, 한국어 결과는 동일(실측). 문서 단위 중복 카운터는 넣지 않는다(extractHeadings.ts 주석의 "허용 가능한 degrade" 결정, MarkdownRenderer가 헤딩마다 독립 호출하는 slugify라 상태 관리가 취약 — strict mode 이중 렌더 등). `headings.test`에 태국어·베트남어 케이스를 추가한다.
- 비고(검증자 조정): 원 지적의 "th/vi/es/uz 28편 안팎 전부 목차가 틀린 곳으로 간다"·"태국어 헤딩 id가 전부 section"은 과장. 한국어에도 중복 헤딩 파일이 18편 있고 이는 기존 결정대로 둔다. 같은 자리를 다른 축(CNT 콘텐츠 파이프라인·마크다운·데이터 정합)도 지적: "중복 텍스트 헤딩이 같은 id를 가져 목차 항목이 첫 헤딩으로 이동한다 (ko 18편 27그룹, th 11편은 전부 id=section)".

#### FE-17. 토스 오류 해석과 결제수단 3갈래 JSX가 다섯 폼에 복사되어 있다 [P3 · L]

- 위치: `components/funding/PledgeWizard.tsx:548-563`(문구 L558, 3갈래 L822); `components/booking/BookingWizard.tsx:473, 710`; `components/booking/MixingOrderWizard.tsx:311, 501`; `components/payments/PaymentLinkCheckout.tsx:102, 156`; `components/shows/ShowBookingForm.tsx:331`(문구는 `lib/shows/i18n.ts:121`); `components/payments/usePaymentCheckout.ts`; 가드 `tests/payments/sharedCheckout.guard.test.ts`.
- 지금 코드: 동일 문구 "카드 결제는 카드사를 먼저 골라 주세요. 결제 방법 아래에서 카드사를 선택한 뒤 다시 눌러 주세요."가 4개 파일에 복붙, 공연 폼은 i18n에 따로. `USER_CANCEL`/`PAY_PROCESS_CANCELED` 걸러내기는 4개 파일, `reportPaymentFailure`는 4개 파일(공연 폼은 `reportPaymentWindowOpen`만 import하고 reportPaymentFailure를 아예 안 부른다). `picker === null ? <PaymentMethodSkeleton/> : picker ? <PaymentMethodPicker…/> : <PaymentMethodChoice…/>` 블록이 5개 파일에 각 40~60줄.
- 왜 문제인가: 결제 버그 수정이 다섯 곳으로 퍼져 한두 곳이 빠진다. 이미 어긋난 증거가 FE-11(약관 가드 `=== false`, reportPaymentFailure 없음)이다. 다만 주문 생성부는 폼마다 도메인 규칙이 다르다 — 펀딩은 previousOrderNo 홀드 해제·배송지 검증·ownMethodChoice, 공연은 pendingRef 주문 재사용(홀드 만료 1분 전)과 i18n, 예약은 slot_taken 분기.
- 조건→결과: 유지보수 위험. 실제 결함은 FE-11·FE-12에서 따로 고친다.
- **수정**: 1단계, 순수 함수 하나만 추출한다: `resolveTossRequestError(err, agreedRequiredTerms) → 'cancel' | 'terms' | 'needCard' | 'generic'`(문구 포함, 영어는 호출부가 매핑). 단위 테스트로 USER_CANCEL/PAY_PROCESS_CANCELED/null 약관을 고정한다. 2단계, 주문 생성 코드는 건드리지 않고 `PaymentMethodSection`(picker/widget/skeleton 3갈래+계좌 hidden)만 PaymentLinkCheckout·BookingWizard·MixingOrderWizard·ShowBookingForm에서 공용화한다(펀딩은 ownMethodChoice라 제외). 가드는 `sharedCheckout.guard.test.ts`에 "components에서 `agreedRequiredTerms === false` 금지" 소스 스캔 한 줄을 더한다. `usePaymentSubmit` 전면 통합은 하지 않는다.
- 비고(검증자 조정): 원 제안 `usePaymentSubmit({amount, createOrder, bankFlow})`는 돈이 오가는 경로 전체를 한 번에 갈아엎는 리팩터라 위험이 크고 CLAUDE.md의 "유지보수 부담이 큰 기계를 들이지 않는다"와 긴장 — 정리 성격이므로 P3.

#### FE-18. 계약 서명·완료·입장 스캔·감상실 페이지가 Layout의 <main> 안에 <main>을 또 만든다 [P3 · S]

- 위치: `pages/[locale]/contracts/[id]/sign.tsx:596`; `pages/[locale]/contracts/[id]/complete.tsx:218`; `pages/[locale]/shows/scan/[token].tsx:171`; `pages/[locale]/press/sabbaha-slung.tsx:145, 299`; `components/Layout.tsx:227-237`; 가드 `tests/pages/pageScaffold.test.ts:53-58`.
- 지금 코드: sign.tsx:596 `<main className="min-h-screen bg-gray-50 dark:bg-gray-50 py-8 md:py-12">` / complete.tsx:218 `<main className="min-h-screen bg-gray-50 dark:bg-gray-50 flex items-center justify-center px-4 py-12">` / scan/[token].tsx:171 `<main className="min-h-screen bg-gray-100 …">`; Layout.tsx:227-237은 isBareLayout(계약·관리자·비공개·감상실)에서도 항상 `<main id="main-content" tabIndex={-1} …>{children}</main>`를 그린다. MAIN_EXEMPT가 네 파일을 "라이트 고정 법적 문서" 사유로 면제.
- 왜 문제인가: main 랜드마크 중복(HTML 유효성·axe moderate, landmark-no-duplicate-main 계열). sabbaha-slung은 한 페이지에 둘. 면제 사유 문구가 바탕색이지 랜드마크가 아니라 가드가 못 잡는다.
- 조건→결과: 기능 장애는 아니다. skip 링크·route 전환 포커스(`_app.tsx:136`, `getElementById('main-content')`)는 바깥 main을 정상 대상으로 한다.
- **수정**: 다섯 곳의 `<main>`을 `<div>`로 바꾸고(라이트 고정 바탕 클래스는 그대로) `pageScaffold.test.ts`의 MAIN_EXEMPT 네 항목을 지운다. 면제가 필요한 유일한 이유였던 "자기 껍데기를 그린다"는 `<div>`로도 충족된다.
- 비고(검증자 조정): 심각도는 P2가 아니라 P3 — 태그 5개 교체와 면제 삭제로 끝나는 정리.

#### FE-19. 사용처 없는 TossPaymentWidget(카드 전용 결제) 파일과 테스트가 남아 있다 [P3 · S]

- 위치: `components/booking/TossPaymentWidget.tsx:1-61`(L35-37, L47); `components/booking/TossPaymentWidget.test.tsx`; `tests/payments/sharedCheckout.guard.test.ts:9, 43, 75`; 이 파일을 근거로 인용하는 주석 `lib/privacy/orderRetention.ts:786`, `lib/funding/policy.ts:271`, `tests/pages/privacy-policy.test.tsx:99`, `components/billing/BillingAuthButton.tsx:20`.
- 지금 코드: L35-37 `} catch { /* 사용자가 결제창을 닫은 경우 — 위젯이 자체 안내 */ }` / L47 `<p role="alert" className="text-red-600">{error}</p>`(dark 짝 없음). 저장소 전체에서 import하는 비테스트 파일은 없다(grep: TossPaymentWidget.test.tsx만). `DIRECT_TOSS_ALLOWED`(L43)에 이 파일이 등재.
- 왜 문제인가: 사용처 0인 채 모든 오류를 삼키는 catch·다크 짝 없는 에러 문구·계좌 입금·reportPaymentFailure 부재를 가진 컴포넌트가 남아 있다. 재채택은 `importsCardOnlyWidget` 정규식(L75, 2026-10-06 사고 뒤 e727cd3f2d)이 이미 막고 있으므로 남은 것은 죽은 파일과 그 테스트 유지 비용이다.
- 조건→결과: 기능 영향 없음. 주석 근거가 죽은 파일을 가리킨다.
- **수정**: `TossPaymentWidget.tsx`와 `.test.tsx`를 삭제하고 `DIRECT_TOSS_ALLOWED`에서 지운다(importsCardOnlyWidget 정규식은 유지). 인용 주석을 실제 경로로 고친다 — `orderRetention.ts:786`은 개인정보 처리방침의 "토스에 보내는 값" 근거이므로 실제 호출부(`useTossPaymentWidgets.requestPayment` / 각 폼)를 가리키게, `privacy-policy.test.tsx:99`("토스페이먼츠 components/booking/TossPaymentWidget.tsx · lib/booking/toss.ts")·`BillingAuthButton.tsx:20`·`lib/funding/policy.ts:271`·`sharedCheckout.guard.test.ts:9`의 설명도 같이.
- 비고(검증자 조정): "함정"이라는 평가는 과장 — 가드가 이미 막고 있어 정리 수준(P3). 삭제 시 고쳐야 할 주석 목록은 검증자가 보탰다.

#### FE-20. MobileNav가 <nav>에 role=dialog+aria-modal을 얹었으나 닫기 컨트롤은 다이얼로그 밖에 있고 주석의 '외부 클릭' 닫기는 없다 [P3 · M]

- 위치: `components/layout/MobileNav.tsx:63-66(주석), 110-120`; `components/layout/HeaderActions.tsx:113-122`; `components/layout/Header.tsx`; `Header.test.tsx:64-66`; `utils/useFocusTrapDialog.ts`.
- 지금 코드: L114-117 `role="dialog" aria-modal="true" aria-label={t('nav.mobileMenu')} aria-hidden={!isOpen}`(요소는 `<nav id={navId} …>`). L63-66 주석 "메뉴 닫기는 X 버튼·외부 클릭·focus trap의 esc로만" — 파일에 외부 클릭/백드롭 핸들러는 없다(MobileNav·Header에 click/pointerdown 핸들러 grep 결과 없음, useFocusTrapDialog는 Escape와 Tab 트랩만). 햄버거 X 버튼은 HeaderActions.tsx:113-122(헤더, 다이얼로그 밖)에 있고 `aria-haspopup="dialog"`.
- 왜 문제인가: ARIA in HTML상 nav에 dialog는 허용 역할이 아니다. 안에 닫기 컨트롤이 없고(L121-210), 주석이 말하는 외부 클릭 닫기는 구현되어 있지 않다.
- 조건→결과: 모바일 보조기기 사용자가 메뉴를 닫는 경로가 Esc/제스처에 치우치고, 메뉴 아래 빈 영역을 눌러도 닫히지 않는다. 닫혀 있을 때는 aria-hidden이라 랜드마크 목록에서 어차피 빠지고, 열렸을 때는 모달 메뉴라 dialog 의미가 완전히 틀리지는 않다. 메뉴 안 링크를 누르면 routeChangeStart로 닫히고 Esc도 닫는다. 영영 갇히는 경우는 확인되지 않았다.
- **수정**: 햄버거가 이미 aria-expanded+aria-controls로 열림 상태를 알리는 disclosure 패턴이므로 `<nav>`에서 `role="dialog"`와 `aria-modal`을 뺀다(nav 랜드마크 복원, 헤더 X가 가려지지 않음). `HeaderActions.tsx:122`의 `aria-haspopup="dialog"`도 뺀다. `Header.test.tsx:66`의 `[role="dialog"]` 조회는 `nav#id` 조회로 바꾼다. MobileNav 주석의 "외부 클릭" 문구는 사실대로 고친다. 외부 탭으로 닫기가 필요하면 그때 nav 아래 투명 백드롭 버튼(`fixed inset-0 top-16`, aria-hidden, tabIndex=-1, onClick=onClose)을 더한다. 안에 닫기 버튼을 새로 만들지 않는다.
- 비고(검증자 조정): "스크린리더가 헤더 X를 숨긴다"는 iOS VoiceOver/TalkBack이 aria-modal을 지키는 것에 기댄 추정이며 기기로 확인하지 못했다. 원 제안(div dialog+nav+닫기 버튼+백드롭)은 구조를 키워 기각, P3.

#### FE-21. 로고 '스튜디오' 반쪽의 다크 모드 반전이 하이드레이션 후 state로만 적용되어 첫 페인트에 어두운 글자가 어두운 헤더에 놓인다 [P3 · S]

- 위치: `components/layout/HeaderBrand.tsx:60-70`(L65-67); `components/layout/PaymentBrandBar.tsx:41-44`; `components/layout/HeaderActions.tsx:70`; `components/Layout.tsx:35, 41-46`.
- 지금 코드: HeaderBrand.tsx:65-67 `filter: (isTransparent || isDarkMode) ? 'brightness(0) invert(1) brightness(1.2)' : 'none'` — isDarkMode는 Layout.tsx:35 `useState(false)`로 시작해 L44 effect에서야 `classList.contains('dark')`로 갱신. PaymentBrandBar.tsx:41-44 동일. HeaderActions.tsx:70은 SSR이 항상 Moon을 그린다.
- 왜 문제인가: theme-init.js가 페인트 전에 `<html class="dark">`를 붙여 헤더 배경은 CSS dark: 토큰으로 이미 어두운데, 로고 필터는 React state에 의존한다. logo.png는 'studio' 반쪽이 어두운 녹색(#103c28 계열)이고 NOL만 노란색이다. SSR HTML과 하이드레이션 전에는 filter:none이라 어두운 녹색 글자가 어두운 헤더 위에 놓이고, `transition-[filter] duration-300` 때문에 하이드레이션 뒤 0.3초 페이드로 흰색이 된다.
- 조건→결과: 다크 모드 사용자는 저사양 모바일에서 수백 ms~수 초 동안 로고가 반만 보이는 번쩍임을 겪는다. 같은 원인으로 테마 토글 아이콘(Sun/Moon)도 첫 페인트에 틀린 상태다.
- **수정**: state 대신 CSS로 푼다. 필터를 `dark:[filter:brightness(0)_invert(1)_brightness(1.2)]` 클래스(tailwindcss 3.4 임의 속성 variant)로 옮기고 isTransparent일 때만 인라인/클래스로 추가한다 — 인라인 style의 filter가 클래스를 이기므로 isTransparent가 아닐 때는 인라인 filter를 아예 뺀다. PaymentBrandBar도 동일. 토글 아이콘은 `dark:hidden`/`hidden dark:block` 두 아이콘 병기로 JS 의존을 없앤다.
- 비고: 검증자 확인(confirmed).

#### FE-22. Button이 type 기본값 없이 <button>을 렌더해 form 안에서 type을 빼먹으면 제출 버튼이 된다 [P3 · S]

- 위치: `components/ui/Button.tsx:126-152`(L148); `components/ui/Button.test.tsx`; `.eslintrc.json`(react/button-has-type 없음).
- 지금 코드: L148 `<button className={classes} ref={ref} {...props}>` — type 미지정. TypeScript AST로 저장소 전체 스캔(.claude·테스트 제외): asChild 아닌 Button 181개 중 type 없는 것이 110개이고, 같은 파일의 `<form>` 안에 있는 것은 0개. type도 onClick도 없는 9곳은 전부 `<Link><Button>`(링크 래퍼)라 암묵적 제출에 기대는 곳이 없다.
- 왜 문제인가: HTML 기본값은 submit이다. 이 저장소 폼은 결제 직전 폼이 대부분이라 Button 하나에 type을 빼먹으면 Enter/클릭이 결제 제출을 일으킨다. 공용 프리미티브가 안전한 기본값을 주지 않는다.
- 조건→결과: 현재 발현 0. 결제 폼에서 "이전/다시 시도" 보조 버튼이 새로 추가될 때 한 번 틀리면 이중 주문 시도가 된다.
- **수정**: 구조분해에 `type,`를 받고 `<button>` 분기에만 `type={type ?? 'button'}`을 둔다(asChild 분기에는 넣지 않음; 제출 버튼은 이미 `type="submit"`을 명시하므로 현재 동작이 바뀌지 않는다). `Button.test`에 기본 type 케이스 추가.
- 비고: 검증자 확인(confirmed).

#### FE-23. Pagination이 §5 포커스 링·type·svg aria-hidden을 따르지 않고, 현재 페이지 버튼이 키보드로 재실행된다 [P3 · S]

- 위치: `components/ui/Pagination.tsx:55-110`(L55, L59, L65-70, L75-83); 사용처 `pages/[locale]/stories/index.tsx`, `pages/[locale]/stories/category/[key].tsx`.
- 지금 코드: L59 `<button onClick=… disabled=… className={\`flex items-center justify-center min-h-[44px] px-3 py-2 rounded-full text-sm font-medium transition-colors …\`}`(type 없음, FOCUS_RING 없음) / L75-83 페이지 버튼 `bg-primary text-white pointer-events-none` / L65-70 인라인 `<svg>` aria-hidden 없음 / L55 `<nav … onKeyDown={handleNavKeyDown}>`.
- 왜 문제인가: 세 종류의 `<button>`에 FOCUS_RING(`components/ui/focusRing`)이 없어 브라우저 기본 링에만 기댄다(globals.css에 글로벌 :focus 규칙 없음; design-system §5는 모든 인터랙티브 요소에 focus-visible 링을 요구). `type="button"`과 svg aria-hidden도 없다. 현재 페이지 버튼은 pointer-events-none이지만 Tab+Enter로 활성화돼 handlePageChange가 같은 URL로 shallow push와 스크롤을 다시 돈다.
- 조건→결과: 스토리 목록·카테고리 두 화면의 키보드 포커스 표시가 사이트 나머지와 다르다. 기능 결함은 아니다.
- **수정**: 세 버튼에 FOCUS_RING과 `type="button"`을 붙이고 svg에 `aria-hidden="true"`를 준다. 번호 버튼 onClick은 `page === currentPage`면 아무것도 하지 않게 한다(disabled로 만들지 말 것 — 포커스를 못 받아 스크린리더가 aria-current를 못 읽는다; aria-current 유지). 화살표 키 핸들러는 그대로 둔다(701233f0ac에서 키보드 편의로 의도해 넣은 것; SR browse 모드는 방향키를 페이지에 넘기지 않아 "탐색과 충돌" 근거가 약함). Button 프리미티브로의 전면 재작성과 번호 버튼 aria-label 추가는 하지 않는다(aria-current로 상태 전달). 5줄 수정으로 풀린다.
- 비고(검증자 조정): "다크 짝 없음"은 `bg-primary text-white`가 흰 글씨 7.68:1이라 문제 아님.

#### FE-24. ScrollToTop·KakaoFab이 포커스를 가진 채 aria-hidden으로 바뀔 수 있다(Chrome은 콘솔 경고, Firefox·Safari는 AT에서 누락) [P3 · S]

- 위치: `components/ui/ScrollToTop.tsx:48-72`(L54-56, L67); `components/common/KakaoFab.tsx:109-112, 130`; `components/Layout.tsx`; 테스트 `components/common/kakaoFabReveal.test.tsx:58-75`.
- 지금 코드: ScrollToTop.tsx:54-56 `<div className={…isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} aria-hidden={!isVisible}> … <Button … tabIndex={isVisible ? 0 : -1}>` / KakaoFab.tsx:109-112 `aria-hidden={!revealed}` + 링크 `tabIndex={revealed ? 0 : -1}`.
- 왜 문제인가: 가시 상태가 꺼질 때 래퍼에 aria-hidden=true, 링크에 tabIndex=-1만 주고 포커스는 해제하지 않는다. 포커스된 후손이 aria-hidden 안에 남는다. tabIndex 수동 토글은 inert가 하는 일의 재구현이다.
- 조건→결과: 키보드로 맨위로 버튼을 Enter하거나, Chrome에서 클릭한 뒤(클릭 시 버튼에 포커스가 남는다), 또는 KakaoFab 링크에 포커스를 둔 채 Home 키·휠로 맨 위로 가면 재현된다. Chrome은 이런 aria-hidden 적용을 막고('Blocked aria-hidden') 콘솔 경고만 남기므로 AT 트리가 깨지지 않는다. Firefox·Safari에서는 적용돼 포커스된 컨트롤이 AT에서 빠진다. 포커스는 숨은 버튼에 남고 다음 Tab은 그 위치부터 진행한다. 해당 컨트롤에 포커스를 둔 사용자에게 한정된다.
- **수정**: ScrollToTop 래퍼와 KakaoFab 래퍼의 aria-hidden과 링크·버튼의 tabIndex 토글을 `inert={!isVisible}`(KakaoFab은 `!revealed`) 하나로 바꾼다(React 19.2.4·Next 15에서 boolean 지원). opacity·pointer-events 클래스는 시각용으로 유지. `kakaoFabReveal.test.tsx:58-75`의 aria-hidden·tabindex 단언을 inert 단언으로 같이 바꾼다.
- 비고(검증자 조정): 원 지적의 "모든 방문자 콘솔에 경고"·"다음 Tab이 문서 처음부터"는 부정확.

#### FE-25. Checkbox는 hint 연결을 호출부 aria-describedby가 덮고, Field는 자식의 aria 속성을 덮어쓴다 [P3 · S]

- 위치: `components/ui/Checkbox.tsx:38-48`(L43-45); `components/ui/Field.tsx:108-115`; 테스트 `components/ui/Field.test.tsx`, `components/ui/primitives.test.tsx`; 호출부 `components/ContactFormCard.tsx:268`.
- 지금 코드: Checkbox.tsx:43-45 `className={…} aria-describedby={hint ? hintId : input['aria-describedby']} {...input}` — `{...input}`이 뒤에 펼쳐져 호출부가 aria-describedby를 넘기면 hint 연결이 사라진다(값이 undefined여도 키가 있으면 덮는다). Field.tsx:108-115 `React.cloneElement(children, { id, 'aria-required': required || undefined, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, … })` — cloneElement는 undefined 값도 자식의 기존 prop을 덮는다.
- 왜 문제인가: 두 프리미티브가 aria 연결을 "자동 배선"한다고 약속하지만 합성 순서 때문에 호출부가 직접 준 aria-describedby(예: 별도 안내문 id)를 지우거나(Field) 자기 hint 연결을 잃는다(Checkbox). hint와 호출부 id를 합치는 로직이 없다.
- 조건→결과: 현재 호출부 영향은 0 — Checkbox에 aria-describedby를 넘기는 곳은 ContactFormCard.tsx:268 하나뿐이고 hint가 없다. Field 133곳 중 자식이 자체 aria-describedby·aria-required를 주는 곳은 없다(complete.tsx:298은 Field 밖). 잠재 API 함정이다.
- **수정**: Checkbox: `{...input}` 뒤에 `aria-describedby={[hint ? hintId : null, input['aria-describedby']].filter(Boolean).join(' ') || undefined}`를 둔다. Field: `children.props`의 aria-describedby/aria-required를 읽어 합치고(`[child, hintId, errorId].filter(Boolean).join(' ')`), 정의된 값만 cloneElement에 넘긴다. 각각 단위 테스트 추가.
- 비고: 검증자 확인(confirmed).

#### FE-26. 계좌 입금 안내 금액이 응답 값이 아니라 props다(주석과 불일치, 실제 위험은 없음) [P3 · S]

- 위치: `components/payments/PaymentLinkCheckout.tsx:72-116`(L72, L77, L114); `components/payments/BankDepositGuide.tsx` 머리 주석; 금액 정본 `data/paymentLinks.ts`.
- 지금 코드: L77 `setBankGuide({ deadline: data.deposit.deadline, customerName: customerName.trim() });`(응답 `data.totalAmount`는 쓰지 않음) … L114 `<BankDepositGuide amount={totalAmount} deadline={bankGuide.deadline} customerName={bankGuide.customerName} />` / L72 주석 "금액·기한은 서버가 돌려준 값" / BankDepositGuide.tsx 머리 주석 "금액은 URL이 아니라 서버가 다시 읽은 값이다".
- 왜 문제인가: 토스 경로는 `data.totalAmount`로 결제창을 열지만 계좌 경로는 props totalAmount를 BankDepositGuide에 넘긴다. 코드와 주석이 어긋난다.
- 조건→결과: 고객이 다른 금액을 보게 될 현실 경로가 없다 — 금액 정본은 정적 상수이고 "이미 발급한 slug의 금액을 바꾸지 말 것"이 운영 규칙, 결제 페이지는 getServerSideProps에서 `Cache-Control: private, no-store`라 캐시된 페이지가 없고, 입금 안내 메일은 주문 행(DB)의 금액으로 나간다(`deliverBookingDepositGuide`).
- **수정**: bankGuide state에 `amount: data.totalAmount`를 담아 BankDepositGuide에 넘긴다(한 줄). failUrl의 encodeURIComponent 변경은 하지 않는다(slug는 서버·SSR 모두 `/^[0-9a-f]{24}$/`로 검증돼 인코딩할 문자가 없다).
- 비고(검증자 조정): 원 지적의 "틀린 금액 입금·매칭 실패" 위험 서술은 성립하지 않아 정리 수준으로 내렸다.

#### FE-27. Breadcrumb의 aria-label이 영어 고정이고 PriceSummary의 aria-label은 div에 붙어 무시된다 [P3 · S]

- 위치: `components/ui/Breadcrumb.tsx:13-17`(L15); `components/ui/PriceSummary.tsx:38`; 참고 `components/ui/Stepper.tsx:23-26`, `components/ui/PageHeader.tsx:55`; `public/locales/*/common.json`(7개 로케일); `content/i18nKeys.test.ts`.
- 지금 코드: Breadcrumb.tsx:15 `<nav aria-label="breadcrumb" …>`(영어 고정, ImageHero 등 7개 로케일 모든 히어로 페이지 상단) / PriceSummary.tsx:38 `aria-label="금액 요약"`(Panel 기본 `as='div'`, role 없는 div) / Stepper.tsx:23-26 `<nav aria-label="진행 단계"> <p className="sr-only">{steps.length}단계 중 {current}단계: …` / PageHeader.tsx:55 `backLabel = '뒤로'`.
- 왜 문제인가: Breadcrumb는 ko·zh·es·vi·th·uz 페이지에서도 'breadcrumb'로 읽히고 common.json 7개 로케일에 키가 없다. PriceSummary의 aria-label은 role 없는 div라 보조기기가 무시한다. Stepper·PageHeader·PriceSummary의 한국어 고정은 호출부가 전부 /ko 전용(booking, funding, subscribe, pay, shows/report 등)이라 현재 결함이 아니다.
- 조건→결과: 비영어 로케일 스크린리더 사용자가 이동 랜드마크 이름을 영어로 듣는다. 금액 요약 이름은 전달되지 않는다.
- **수정**: Breadcrumb에 locale(또는 label) prop을 받아 `t('nav.breadcrumb')`를 쓰고 common.json 7개 로케일에 키를 추가한다(i18nKeys.test로 패리티 확인). PriceSummary는 Panel에 `role="group"`을 주거나 aria-label을 지운다. Stepper·PageHeader는 비ko 화면이 생길 때 손댄다.
- 비고(검증자 조정): 원 분류 "[이전 리뷰 미처리]"는 부정확 — `docs/code-review-2026-08-24.md` #15가 가리킨 파일은 DesktopNav.tsx와 Pagination.tsx뿐이고 둘 다 i18n으로 고쳐졌다(Pagination은 `t('pagination.label')`). Breadcrumb는 다른 파일의 같은 유형이다.

#### FE-28. UI 패턴 가드가 프리미티브를 일괄 면제해 PageHeader·Disclosure의 rounded-md 두 곳이 통과한다 [P3 · S]

- 위치: `components/ui/uiPatterns.baseline.test.ts:26-52`(PRIMITIVE_FILES L27-45); `components/ui/PageHeader.tsx:76`; `components/ui/Disclosure.tsx:32`; 참고 `tests/pages/pageScaffold.test.ts`.
- 지금 코드: PRIMITIVE_FILES(… 'components/ui/PageHeader.tsx', 'components/ui/Disclosure.tsx', 'components/ui/Button.tsx', 'components/ui/BaseCard.tsx' …)는 isScanned에서 제외. PageHeader.tsx:76 `… items-center gap-1 rounded-md py-2 typo-card-meta text-primary …` / Disclosure.tsx:32 `variant === 'card' ? 'rounded-xl px-4 py-3' : 'rounded-md py-2'`. design-system §3: "`rounded-md`는 어느 역할에도 없다".
- 왜 문제인가: PRIMITIVE_FILES 면제가 모든 규칙에 일괄 적용돼 두 곳의 rounded-md가 기준선 0을 유지한 채 남아 있다. components/ui/*.tsx 전체에서 주석을 뺀 rounded-md는 이 두 곳뿐이다. 면제의 근거는 "이 규칙들의 정본 구현"인데 rounded-md는 어느 프리미티브가 정본인 규칙이 아니다.
- 조건→결과: 두 곳 모두 포커스 링 둘레의 반경이라 시각 영향은 거의 없다. 프리미티브를 본뜨는 새 화면이 rounded-md를 복사할 수 있는 작은 통로다.
- **수정**: PageHeader.tsx:76과 Disclosure.tsx:32를 `rounded-lg`로 바꾸고, rounded-md 규칙만 PRIMITIVE_FILES를 면제하지 않고 모든 파일에 적용한다(다른 프리미티브에는 코드상 rounded-md가 없어 기준선 변경 없음). 규칙별 allow 맵은 만들지 않는다.
- 비고(검증자 조정): 원 지적의 pageScaffold 공백 주장은 근거 없음 — `ContractNotice.tsx`의 `min-h-screen bg-gray-50`은 sign.tsx·complete.tsx와 같은 "종이처럼 보이는 라이트 고정 계약 화면"(design-system §1)이라 의도된 것.

#### FE-29. StoryCTA의 보라 계열 카테고리 그라디언트와 무한 막대 애니메이션 — 10/13 판정 뒤 대조군을 정해 처리 [P3 · M]

- 위치: `components/StoryCTA.tsx:26-310`(L28, L152, L186 등 21줄; 막대 L294-304); `tailwind.config.test.ts`; `pages/[locale]/stories/[id].tsx`; 계획 문서 `docs/design-ui-refinement-plan-2026-10.md:140-145, 178-180`, `docs/design-liner-notes-plan-2026-10.md:301`, 장부 `docs/ctr-surgery-log.md`.
- 지금 코드: L28 `gradient: 'from-indigo-900 to-purple-900'`, L152 `'from-red-900 to-purple-900'`, L186 `'from-fuchsia-900 to-violet-900'` 등 purple/indigo/violet/fuchsia 클래스 21줄(공개 components·pages에서 이 파일뿐, admin 제외). L300-304 `repeat: Infinity, repeatType: "reverse", duration: 1.5` — animate는 `height`(레이아웃 속성), isVisualInView인 동안, `hidden md:block`이라 md 이상 화면만. design-system §1 "브랜드색은 primary 하나 … v2는 고채도는 카카오 옐로만".
- 왜 문제인가: 21줄이 브랜드 팔레트 밖이고, 데스크톱에서 막대 높이가 보이는 동안 무한 반복된다. 후자는 reduced-motion 사용자에게는 즉시 처리된다(motion-dom positionalKeys에 height가 있고 shouldReduceMotion이면 type:false). 전자는 리드 계측 지점의 모양 변경이라 측정 계획과 걸린다.
- 조건→결과: 스토리 하단 패널 톤이 새 브랜드 톤과 다르다. 성능 영향은 작다(데스크톱 한정, 고정 높이 h-32 상자 안의 막대 8개).
- **수정**: 색 정리는 지금 하지 않는다. `design-ui-refinement-plan-2026-10.md`는 StoryCTA를 recording-price1 리뷰(10/13)까지 수정 0으로 두고, 바꿀 때는 "StoryCTA 계열은 리드 계측 지점이라 lead-verdict 대조군을 미리 정하고" 2단계(11/11 이후)에 하도록 명시한다. 그 뒤 `scripts/lead-verdict.mjs` 대조군을 먼저 정하고 ctr-surgery-log에 교락으로 기록하며 진행한다. 보라 계열을 바꿔도 되는지는 운영자 확인이 먼저다("StoryCTA amber는 유지" 결정의 범위에 보라가 포함되는지 문서에 없음). 막대 애니메이션은 별건으로, 반복을 멈추거나 transform scaleY 기반 motion-safe로 바꾸는 작은 수정이며 이것도 StoryCTA 파일 수정이라 장부에 적는다.
- 비고(검증자 조정): 지금 색을 바꾸면 recording-price1 판정(CTA 클릭이 지표)이 교락된다. CLAUDE.md는 10/05에 동결이 해제됐다고 하지만 측정 중 변경은 장부에 교락으로 적게 돼 있다.

**클린 판정**

- `lib/formDraft.ts` — 동의·선택값 비저장 계약을 허용 목록 필터로 구현, 모든 sessionStorage 접근 try/catch, 렌더 중 읽기 없음(복원은 effect, draftRestored 게이트로 빈 폼 덮어쓰기 방지)
- `lib/routeScroll.ts` — scrollMemory 상태기계·pinHashTarget 타이머/옵저버/리스너 정리·MAX_FRAMES 상한 이상 없음(restoreScroll만 사용자 입력 취소 없음, 영향 미미)
- `utils/scrollLock.ts` — 참조 카운트와 이전 overflow 복원 정상, html scrollbar-gutter: stable로 레이아웃 점프 방지
- `components/ui/Choice.tsx` — has-[:checked] 링과 has-[:focus-visible] 링을 실제 Tailwind 컴파일로 확인: 포커스 링(ring-2, /70)이 선택 링(ring-1, /30)보다 뒤에 emit되어 선택된 카드에서도 포커스가 보인다
- `components/ui/Notice·Badge·Panel·EmptyState·ResultCard·PriceSummary·Section·SectionHeading` — tone별 라이트/다크 쌍, role 매핑(error=alert, success=status) 이상 없음
- `components/ui/Modal.tsx`·`RewardModal.tsx` — Escape 단일 처리, 스크롤 잠금 정리, 포커스 복원 시점 소유 정상(트랩 경계 문제는 훅 쪽 지적 FE-2)
- `components/audio/MixComparePlayer.tsx` — 오디오 실제 상태 추종, 빠른 A→B→A 경쟁 처리, 언마운트 정리, rAF DOM 직접 갱신 모두 문서와 일치
- `components/funding/useFundingStatus.ts`·`SupporterTicker.tsx` — 타이머/리스너 정리, reduced-motion 시 순환 중지, 일시정지 버튼, 하이드레이션 안전한 초기값
- `components/booking/useTossPaymentWidgets.ts` — 마운트/금액 갱신 분리, useId 기반 고유 셀렉터, cleanup에서 iframe 컨테이너 비움, 재시도 경로 정상
- `components/common/DeferredAnalytics.tsx` — 이벤트 리스너·타이머 정리 정상
- 클라이언트 번들 서버 전용 모듈 유입 — components/ 전체(298개 모듈) 비타입 import 폐포를 정규식 추적기로 확인: node:*, db/, drizzle, @libsql, sharp 등 서버 전용 모듈 0건(ProjectDetailView가 lib/funding/shape를 직접 쓰는 우회도 유효)
- 이미지 alt — ImageHero 28개 호출 전부 imageAlt 지정, 장식 이미지는 alt=""+aria-hidden으로 일관
- 타이머/인터벌 정리 — components 전체 setTimeout/setInterval 점검: 정리 누락은 PledgeWizard 포커스 이동(0ms)과 ShowTicketManage 새로고침(페이지 이탈)뿐이라 무해
- Footer 연도 — suppressHydrationWarning으로 연말 경계 불일치 처리, ISR 계약과 일치
- `pages/_app.tsx` — 서비스워커 해제 플래그를 성공 후에 세움, routeChangeComplete 리스너/핀 해제 정리, ensureLocaleReady isCancelled 가드 정상

**읽지 못한 범위**

- 브라우저 실측 없음 — 모든 대비값·겹침(도크 vs FAB, 글래스 베이지)·포커스 표시는 코드와 Tailwind 컴파일 결과로 추론했고 스크린샷·Tab 순회·스크린리더로 확인하지 않았다(FE-1만 실기기 재현)
- jest 실행 없음 — 기존 테스트가 위 지적(특히 ShowBookingForm 약관, 포커스 트랩)을 이미 덮는지 실행해서 확인하지 않았다
- `components/funding/creator/*`(약 1,500줄: BasicSectionForm·PayoutSectionForm·RewardSectionForm·ShippingTable 등) 개설자 폼은 읽지 않았다
- `components/booking/MixingOrderWizard.tsx`는 앞 140줄과 제출부 grep만 읽었다(BookingWizard 전체와 구조가 같다고 보고 중복 지적에 포함)
- `components/shows/{ShowFacts,ShowCard,ShowPoster,ShowLineup,RefundPolicyList}`, `components/funding/{ProjectDetailView 본문 후반,FundingTrustNotice,FundingPipelinePromo,FundingLineupPerson}`, `components/inline/{InlinePriceCallout,InlineReviewCallout,InlineBookingCallout}` 본문, `components/contracts/AuditTrail.tsx`, `components/common/LineupCard.tsx`는 훑지 못했다
- `components/ui/{FeatureCard,HubLocaleContentSection,RelatedStoriesSection,RelatedPortfolioInline,PortfolioMiniCard,WaveRule,adminFieldClass}`와 `components/SEO.tsx`(범위 밖 성격)는 읽지 않았다
- `components/home`·`practice-room`·`pricing` 등 도메인 하위 디렉터리와 `pages/` 전체는 범위 밖이라 호출부 확인에 필요한 부분만 봤다
- iOS Safari의 body overflow:hidden 스크롤 잠금 한계(Modal/RewardModal은 MobileNav와 달리 touchmove 차단이 없음)는 실기기 없이 판단하지 못했다
- DropdownMenu의 Space 키 keydown+click 이중 토글 가능성(브라우저별 click 발화 차이)은 브라우저 검증 없이 지적에서 제외했다

**미검증 후보(overflow)**

- `pages/_app.tsx:149` effect cleanup의 `Router.beforePopState(() => true)`는 `lib/routeScroll.ts` 머리말이 금지한 형태다(앱 언마운트 때만 실행되어 현재 무해, beforePopStateForScroll로 통일 권장)
- `components/ui/ProjectRowCard.tsx:34-116` `<button>` 안에 h3/p/div를 넣어 콘텐츠 모델 위반이며 heading 의미가 평탄화된다(카드 전체를 article+링크/버튼 오버레이 패턴으로)
- `components/LanguageSwitcher.tsx:157·205` `▾` 글리프를 aria-hidden 없이 텍스트로 사용(inline 변형은 aria-label도 없어 SR이 '▾'를 읽음, design-system §4가 글리프 아이콘 금지)
- `components/MarkdownRenderer.tsx:7-12` FundingGallery·FundingAudioPlayer·FundingVideo·FundingLineupPerson을 정적 import해 모든 스토리 페이지 번들에 실린다(Inline* 콜아웃처럼 next/dynamic 권장)
- `components/funding/FundingVideo.tsx:49-70` 재생 버튼이 iframe으로 교체되며 포커스가 body로 사라진다(iframe에 ref로 포커스 이동 필요)
- `components/layout/Footer.tsx` 열 제목이 h3인데 앞에 h2가 없어 헤딩 단계가 h1→h3로 건너뛴다(푸터 제목은 h2 또는 role=heading aria-level)
- `components/funding/PublicNameChoice.tsx:90` '이름을 입력해 주세요' 안내가 text-gray-400(라이트 2.5:1)/dark:text-gray-500(다크 2.45:1)로 AA 미달이며 aria-live 영역 안에 있다
- `components/ui/RuleList.tsx:56` 제목이 같은 항목은 key 중복(문자열 heading을 key로 사용); QuickAnswers는 numbered만 넘겨 `<ol>`이 되는데 문서는 FAQ 요약을 as="ul"로 정의
- `components/funding/SupporterTicker.tsx` 일시정지 버튼이 h-8 w-8(32px, 문서 기준 44px 미만)이고 aria-live를 순환 중 'off'→멈춤 'polite'로 동적 전환(라이브 리전 속성 동적 변경은 SR이 불안정하게 처리)
- `components/audio/GlobalPlayerProvider.tsx:131-150` 트랙 빠른 전환 시 이전 el.play()의 AbortError가 setStatus('error')를 호출해 도크에 role=alert 오류가 순간 노출될 수 있다(error.name === 'AbortError'는 무시)
- `components/audio/GlobalPlayerDock.tsx:116-123` role="slider"를 `<button>`에 부여(ARIA 허용 역할 아님) — Home/End/PageUp·aria-valuetext 없음, 드래그 시크 없음
- `components/ui/MediaGallery.tsx:80-100` 좌우 화살표가 끝에서 언마운트되어 포커스가 사라진다(disabled+aria-disabled로 유지)
- `lib/routeScroll.ts` restoreScroll은 최대 30프레임 동안 사용자 스크롤을 감지하지 못하고 저장 위치로 덮을 수 있다(pinHashTarget처럼 입력 이벤트로 중단)
- `components/ui/PricingCard.tsx:80` `ctaHref.includes('kakao')` 문자열 포함으로 카카오 목적지를 판정(URL 일부에 'kakao'가 든 다른 링크가 옐로 규칙에 오분류)
- `components/layout/Header.tsx` PRIMARY_ROUTES/DesktopNav/MobileNav 라벨 키 이중 관리와 data/navFlags 분기 — 테스트 없이 ko 전용 그룹 조건이 두 곳에 있다

### SEO. 페이지·라우팅·SEO·i18n

P0 0 · P1 0 · P2 9 · P3 15, 미검증 0

#### SEO-1. 스토리 slug 무검증 — `..%2f` 경로 이탈로 content/funding(hidden 포함) md가 스토리로 렌더되고, `<slug>.en` 별칭이 /ko/ 아래 index·self-canonical로 200 [P2 · S]

**위치** `lib/stories.ts:109-160`(resolveStoryFile), `lib/stories.ts:76-106`(getStoryAvailableLocales), `lib/stories.ts:268-293`(getParsedStoryFile), `pages/[locale]/stories/[id].tsx:388-427`(getStaticProps, `fallback: 'blocking'`), `middleware.ts:246-258, 289-300`

**지금 코드**
```ts
// lib/stories.ts:118,155
const localeFilePath = path.join(storiesDirectory, `${slug}.${locale}.md`);
...
resolved = { filePath: path.join(storiesDirectory, `${slug}.md`), sourceLocale: defaultLocale };
// pages/[locale]/stories/[id].tsx:391 (fallback:'blocking' 라 임의 id가 들어온다)
const story = await getStoryDetail(params?.id as string, locale);
```

**왜 문제인가** resolveStoryFile·getStoryAvailableLocales·getParsedStoryFile이 `params.id`를 검증 없이 `path.join`에 넣고, 미들웨어는 trailing slash·소문자·지역 308만 처리할 뿐 `..`·`%2f`·로케일 접미사를 거르지 않는다. 같은 저장소의 funding은 `^[a-z0-9-]+$`(lib/funding/projects.ts:26)로 이미 막아 두었고 스토리 슬러그 1,768개 전부 그 문자 집합 안이라, 검증 한 줄이 없을 이유가 없다. git log -S로 슬러그 정규식 도입 이력 없음, lib/stories.test.ts에 탈출·별칭 케이스 없음.

**재현(프로덕션 실측 2026-10-10)**
1. `/ko/stories/..%2fstories%2feq1` → 200, `index,follow`. canonical은 문자열 그대로 `…/ko/stories/../stories/eq1`이라 URL 해석 시 정본으로 모여 이 변형의 중복 색인 위험은 작다.
2. `/ko/stories/bulgwang-mixing-club-2nd.en` → 200, `index,follow`, canonical 자기 자신. 정본 `/ko/stories/bulgwang-mixing-club-2nd`는 thin이라 noindex인데 **영어 파일 별칭은 색인 가능**하다. 번역 파일 184개 전부 같은 별칭을 갖는다.
3. `/ko/stories/..%2ffunding%2fsmoke-test` → 200, h1 '결제 스모크 테스트 프로젝트' 렌더. `status: draft`·`hidden: true`인 펀딩 md가 스토리 라우트로 새어 나온다(content/funding/*.md가 서버리스 번들에 있다). docs/·lib/contracts/는 번들에 없어 404.

**영향** 외부 링크가 생기면 /ko/ 아래 영어 본문 중복 URL이 색인된다(자기 canonical + index). 펀딩 hidden/draft 가드가 스토리 라우트에서 우회된다 — 지금은 스모크 테스트 글뿐이지만 공개 전 프로젝트 초안을 올려 두는 순간 같은 경로로 노출된다. 저장소가 공개라 기밀 유출은 아니고, 함수 실행·ISR 증식은 404 경로와 같은 비용이라 추가 증폭은 아니다.

**수정**
- `lib/stories.ts`에 `const STORY_SLUG_RE = /^[a-z0-9-]+$/`를 두고 `resolveStoryFile` 첫 줄에서
  ```ts
  if (!STORY_SLUG_RE.test(slug)) throw new Error(`Story file not found: ${slug}`);
  ```
  모든 읽기가 이 함수를 지나므로 한 곳이면 된다. `getStoryAvailableLocales`는 같은 검사로 `[]`를 돌려준다. 기존 catch가 'Story file not found'를 조용히 notFound로 돌리므로 페이지 쪽 추가 검사는 선택.
- 회귀 테스트(`lib/stories.test.ts`): `getStoryDetail('../stories/eq1')`·`getStoryDetail('bulgwang-mixing-club-2nd.en')`·`getStoryDetail('../funding/smoke-test')` reject 케이스, `getAllStorySlugs()` 전부가 `STORY_SLUG_RE`를 통과한다는 케이스.

**비고** 검증자가 바로잡은 요지: 심각도는 P1이 아니라 P2(공개 저장소라 기밀 없음, 별칭 URL은 사이트맵·내부 링크에 없어 외부 링크가 있어야 색인), '배포 번들 안 docs·contracts' 서술은 사실과 다름(404), 수정은 세 함수가 아니라 resolveStoryFile 한 곳이면 충분. 같은 자리를 다른 축(CNT 콘텐츠 파이프라인·마크다운·데이터 정합)도 지적: 스토리 slug를 검증 없이 path.join에 넣어 `..%2F` 경로로 번들 안 다른 .md가 스토리로 렌더된다 — 프로덕션 도달 확인.

#### SEO-2. 사이트맵 이미지 메타가 `/ko/lesson`을 '보컬 레슨'으로, /about을 '10-Year'로 적는다 — factGuards 스캔 범위 밖 [P2 · S]

**위치** `next-sitemap.config.js:57`('/about'), `next-sitemap.config.js:65`('/lesson'); 가드 쪽 `content/factGuards.test.ts:50-70`, `lib/factGuards.ts:209-216`

**지금 코드**
```js
'/about': { url: '/images/og-recording15.webp', title: 'Studio NOL - 10-Year Music Production Experience', ... },
'/lesson': { url: '/images/og-lesson1.webp', title: 'Studio NOL Music Lessons - Vocal & Production', caption: 'One-on-one vocal, mixing, and music production lessons at Studio NOL.' },
```

**왜 문제인가** pageImageMap의 두 문자열이 라이브 sitemap-0.xml에 그대로 나간다. 레슨은 프로듀싱 레슨(미디·작곡·믹싱·마스터링) 하나뿐이고(ko lesson.seo '미디·믹싱·작곡 1:1 음악 레슨', en 'MIDI · Mixing · Composition 1:1 Lessons', CLAUDE.md '보컬·악기 레슨은 없다', docs/wiki/entities/services.md:19), 같은 파일의 /author·/release-project 캡션은 '15-year producer', ko/en about.seo.title은 '15년차'/'15+ years'라 /about만 어긋난다. content/factGuards.test.ts는 content/stories·public/locales·data·pages·components만 훑어 이 파일은 범위 밖이고, 훑더라도 vocal-lesson-claim-en 패턴 `/(?:vocal|singing)\s+lessons?/i`는 쉼표로 떨어진 'vocal, mixing, and music production lessons'를 못 잡는다. 금액은 data/pricing.test.ts:359-397이 이미 이 파일을 상수와 대조하고 있어 가드 밖이 아니다.

**영향** 구글 이미지 검색 메타에 없는 서비스(보컬 레슨)와 틀린 연차가 나간다. 노출 면은 작지만 '보컬 레슨' 광고는 이 저장소가 CI 세 겹으로 막는 범주다.

**수정**
1. `next-sitemap.config.js`: '/lesson' title → `'Studio NOL Producing Lessons - MIDI, Composition & Mixing'`, caption → `'One-on-one MIDI, composition, mixing and mastering lessons with producer Hwang Kyungha at Studio NOL.'`(로마자 정본은 SEO-22 참조), '/about' title의 '10-Year' → '15-Year'.
2. `content/factGuards.test.ts`의 코드 표면 스캔에 `next-sitemap.config.js`(.js)를 추가하고, `lib/factGuards.ts` vocal-lesson-claim-en 패턴을 `/(?:vocal|singing)(?:,|\s+and)?[^\n]{0,30}\blessons?\b/i`처럼 쉼표 나열까지 잡도록 넓힌다(마커·allow는 그대로). 가드 확장의 구체 설계는 SEO-4.
3. 가격 생성 로직·CJS 미러는 만들지 않는다 — pricing.test가 이미 대조한다.

**비고** 검증자가 바로잡은 요지: '가격이 드리프트 가드 밖'이라는 원 서술은 틀렸다(data/pricing.test.ts:359-397이 6개 라우트 title과 /pricing 캡션 금액을 상수와 대조), 심각도는 P2(이미지 사이트맵 메타는 노출이 작고 레슨 페이지 자체 메타·본문은 정확).

#### SEO-3. JSON-LD ContactPoint.availableLanguage·knowsLanguage와 llms FAQ가 7개 언어 응대를 주장 — 같은 llms.ts:414는 '영어 예약·문의 + 원격 믹싱'으로 적는다 [P2 · S]

**위치** `utils/schema/business.ts:164`(ContactPoint reservations.availableLanguage), `utils/schema/business.ts:187`(Organization.knowsLanguage), `pages/api/llms.ts:129`(연락처 블록 'Supported Languages'), `pages/api/llms.ts:217-218`(FAQ), `pages/api/llms.ts:596-597`, `pages/api/llms-full.ts:64`

**지금 코드**
```ts
// utils/schema/business.ts:164, 187
availableLanguage: ['ko-KR', 'en-US', 'zh-CN', 'es-ES', 'vi-VN', 'th-TH', 'uz-UZ'],
...
knowsLanguage: ['ko-KR', 'en-US', 'zh-CN', 'es-ES', 'vi-VN', 'th-TH', 'uz-UZ'],
// pages/api/llms.ts:217-218
### What languages does Studio NOL support?
Korean (primary), English, Chinese Simplified, Spanish, Vietnamese, Thai, Uzbek.
```

**왜 문제인가** 응대 언어로 읽히는 자리에 번역 로케일 목록을 싣는다. 운영자 확인 범위(memory feedback_english_capability_scope, docs/wiki/entities/services.md:19)는 한국어 + 영어 예약·문의 응대 + 원격 믹싱뿐이고, 2026-07-28 정비(53b0567c63)에서 es/vi/th '스튜디오 응대' 광고를 걷어냈다. 같은 llms.ts:414 English Quick Facts는 이미 정확한 범위('English-language booking and inquiry support (email / KakaoTalk). Recording sessions are run in Korean; mixing and mastering can be ordered fully remotely in English')를 적고 있어 한 파일 안에서 두 주장이 충돌한다. 이 문자열들은 2026-04-17(d9d00dfe6d)·05-07(9e07bf4a92)에 들어와 07-28 정비가 건드리지 않았고, availableLanguage/knowsLanguage/'Supported Languages'를 보는 테스트는 0건이다(factGuards non-english-staff-claim은 인력 명사만 본다). 비-ko 로케일은 site-wide noindex라 번역 UI는 색인 면도 아니다.

**영향** AI 엔진이 llms FAQ를 그대로 인용해(memory project_geo_citation_pattern: AI가 옮기는 건 표·FAQ) '태국어·우즈베크어 상담 가능'으로 답하면 응대 불가한 문의가 온다. 없는 상품을 만든 지난 사고보다는 약하지만 같은 계열의 사실 불일치다.

**수정**
- `data/siteConfig.ts`(또는 `lib/i18n.ts`)에 `export const SERVICE_LANGUAGES = ['ko', 'en'] as const;`를 두고 `business.ts:164·187`을 `SERVICE_LANGUAGES.map(getSchemaLanguage)`로 줄인다.
- `llms.ts:129`를 `Customer service and bookings: Korean, English (KakaoTalk / email). Website available in ko, en, zh, es, vi, th, uz.`로, FAQ `217-218`은 같은 문장으로 :414와 맞춘다.
- `llms.ts:596-597`·`llms-full.ts:64`는 사이트맵·RSS 옆의 웹사이트 언어 맥락이라 제목만 'Website Languages'로 바꾼다.
- 회귀 테스트: `tests/api/llms-contact.test.ts`에 FAQ 답변이 `Spanish|Vietnamese|Thai|Uzbek`를 포함하지 않는 케이스, `utils/schema/index.test.ts`에 availableLanguage·knowsLanguage가 `['ko-KR','en-US']`인 케이스. factGuards 정규식 룰(`(?:Spanish|…)[^\n]{0,40}(?:support|…)`)은 'Supported Languages: … Uzbek'처럼 support가 앞에 오는 형태를 못 잡으니 테스트 고정이 더 확실하다.

**비고** 검증자가 바로잡은 요지: 심각도 P2(비-ko 페이지는 noindex, 돈·법적 약속 없음, '번역돼 있다'는 반쯤 사실을 응대 언어 자리에 둔 문제), llms-full.ts:64·llms.ts:596-597은 이름만 바꾸면 됨.

#### SEO-4. 사실 가드가 JSON-LD·llms 생성부·사이트맵 설정을 스캔하지 않고, 보컬 레슨 룰은 '보컬, 믹싱 … 레슨' 나열형을 놓친다 [P2 · S]

**위치** `content/factGuards.test.ts:62-71`, `lib/factGuards.ts:209-216`

**지금 코드**
```ts
const codeFiles = [
  ...listFilesRecursive(path.join(ROOT, 'data'), ['.ts']),
  ...listFilesRecursive(path.join(ROOT, 'pages'), ['.ts', '.tsx']),
  ...listFilesRecursive(path.join(ROOT, 'components'), ['.ts', '.tsx']),
]
// lib/factGuards.ts:209-216
id: 'vocal-lesson-claim-en', pattern: /(?:vocal|singing)\s+lessons?/i,
```

**왜 문제인가** 스캔 대상이 data·pages·components뿐이라 `utils/schema/**`, `lib/*Schema.ts`, `lib/llms/**`, `next-sitemap.config.js`, `lib/sitemap/**`가 가드 밖이다(utils/schema/basics.ts:187 주석이 이미 'factGuards는 JSON-LD를 보지 않는다'고 적어 두었다). 또 `vocal-lesson-claim-en`은 `vocal lessons`라는 붙은 구만 잡아서 next-sitemap.config.js:65의 'vocal, mixing, and music production lessons'를 통과시킨다. 이 갭 때문에 SEO-2의 '보컬 레슨' 문자열이 CI를 통과해 라이브에 있다. 이 표면들에 findFactViolations를 돌려도 해당 줄은 위반으로 안 나온다.

**영향** 같은 계열 오류가 기계 가독 표면(JSON-LD·llms·사이트맵)에서 계속 재발한다.

**수정**
1. `content/factGuards.test.ts`의 code 스캔 목록에 `utils/schema`, `lib/llms`, `lib/sitemap`, `lib/*Schema.ts`, `next-sitemap.config.js`를 추가한다. **lib 전체를 넣으면 안 된다** — `lib/factGuards.ts` 자체의 주석·룰 텍스트가 13건 자기 적중한다. 하위 디렉터리만 지정하거나 factGuards.ts를 제외한다.
2. `lib/factGuards.ts`에 룰 추가: `id: 'vocal-lesson-enumerated-en'`, pattern `/\bvocal\b[^.\n]{0,40}\blessons?\b/i`, marker·allow는 vocal-lesson-claim-en과 같게. 이 정규식을 content/stories·locales·data·pages·components·next-sitemap.config.js 2,194개 파일에 돌린 결과 적중은 next-sitemap.config.js:65 한 건, 오탐 0.
3. next-sitemap.config.js:65 원문을 회귀 픽스처로 등재한다. 스캔을 넓혀도 현재 위반은 0건이라 안전하다(SEO-2를 먼저 고친 뒤).

**비고** 검증 confirmed. 가드 확장으로 잡히는 것은 보컬 레슨 한 건뿐이고, 직원 수(SEO-9)·언어 응대(SEO-3)는 대응 룰이 없어 테스트 고정으로 막는다.

#### SEO-5. MusicRecording producer가 본문 크레딧과 무관하게 전 작품에 운영자 Person으로 박힌다 [P2 · M]

**위치** `utils/schema/media.ts:64-110`; 데이터 `data/portfolio/items.ts`(예: :57 마리코&유키에 productionNotes), `types/data.ts`(PortfolioItem.credits), `pages/[locale]/portfolio/[id].tsx`

**지금 코드**
```ts
producer: [
  { '@type': 'Organization' as const, name: config.name, url: siteUrl },
  { '@type': 'Person' as const, '@id': getOperatorPersonId(siteUrl), name: studioOperator.name },
],
...
contributor: item.credits.engineer ? { '@type': 'Organization', name: item.credits.engineer } : undefined,
```

**왜 문제인가** 모든 포트폴리오(35건)에 producer=[스튜디오 놀, 황경하(#person-hwang)]가 고정 출력된다. 라이브 /ko/portfolio/mariko-yukie-namsan-tower JSON-LD도 그렇게 나오는데, 같은 작품의 productionNotes(items.ts:57)는 '프로듀스는 사토 유키에다'라고 적는다. 서비스에 기획이 없는 작품은 35건 중 11건(31%)이고 그중 tierliner-bite-me·young-in-red-dot(믹싱·마스터링만)은 본문에도 프로듀서 서술이 없다. 또 performer.hasMember에 '마리코 (Vocal)'이 역할 괄호째 Person.name으로, contributor에 'Studio NOL (황경하)'가 Organization.name으로 나간다(라이브 확인).

**영향** AI 엔진이 고객이 프로듀스한 작품까지 '황경하 프로듀스'로 인용할 수 있고, 같은 페이지 본문과 구조화 데이터가 어긋난다.

**수정**
- `types/data.ts` PortfolioItem.credits에 선택 필드 `producer?: string`을 추가한다. 본문 크레딧이 운영자를 프로듀서로 밝힌 작품에만 `data/portfolio/items.ts`에서 값을 넣는다. **서비스 목록의 '기획' 여부를 판별식으로 쓰지 않는다** — hee-woo-ijeum은 기획이 없는데 본문이 '프로듀싱은 Studio NOL의 황경하가 맡았다'고 명시한다.
- `utils/schema/media.ts`: `credits.producer`가 운영자인 작품만 Person(#person-hwang)을 producer에 넣고, 나머지는 엔티티 연결을 유지하되 `contributor`(Person @id #person-hwang, `roleName`은 Mixing/Recording Engineer)로 내린다. 스튜디오 Organization을 producer에 두는 것은 유지해도 된다(6f587a5e69의 GEO 결정 — '황경하가 만든 앨범'을 엔티티 그래프로 묶기 — 를 통째 제거하지 않고 역할을 좁힌다).
- musicians의 `\s*\(.*\)$`를 name에서 떼고 괄호 안 값은 `roleName`으로 옮긴다.
- 테스트: 'credits.producer가 없으면 producer에 Person이 없다'.
- 어느 작품이 운영자 프로듀싱인지는 **운영자가 정본을 확인**해야 한다.

**비고** 검증자가 바로잡은 요지: 통째 제거가 아니라 역할 축소, '기획 포함' 판별식은 틀림, MusicAlbum+track 지적은 별도 스타일 문제, '아티스트 분쟁 소재'는 추정.

#### SEO-6. article:author·twitter:creator·twitter:data1이 여전히 조직 명의 글을 '황경하'로 내보낸다 (JSON-LD는 조직) [P2 · S]

**위치** `components/SEO.tsx:169-175`(effectiveArticleAuthor), `components/SEO.tsx:431`(article:author), `:448`(twitter:creator), `:454`(twitter:data1); 관련 `lib/stories.ts:256`(author 기본값 '스튜디오 놀'), `utils/schema/article.ts`, `utils/schema/articleAuthor.test.ts`

**지금 코드**
```tsx
const effectiveArticleAuthor =
  !articleAuthor || articleAuthor === siteConfig.name ? studioOperator.name : articleAuthor;
...
<meta property="article:author" content={effectiveArticleAuthor} />   // :431
<meta name="twitter:creator" content={effectiveArticleAuthor} />       // :448
<meta name="twitter:data1" content={effectiveArticleAuthor} />        // :454
```

**왜 문제인가** 2026-09-08 감사 #4의 2026-09-09 결정은 'author를 화면과 JSON-LD 모두 스튜디오 놀(Organization)로 맞춘다'였고 52e4bdb4e7(#38)은 utils/schema/article.ts만 고쳤다. SEO.tsx의 OG/Twitter 매핑은 ae04caaa6f 이후 그대로이고 주석(172-173행)은 옛 결정('JSON-LD와 동일 entity')을 그대로 둔 채 낡았다. lib/stories.ts:256이 author 기본값을 '스튜디오 놀'로 채우므로 frontmatter에 author가 없는 글(대다수)은 전부 이 분기를 타 운영자 이름이 된다. twitter:creator는 @핸들 자리인데 사람 이름이 들어가 무효값이고(siteConfig socialProfiles.twitter는 빈 문자열), OGP article:author는 프로필 URL이 정석이다.

**재현** `curl https://studionol.co.kr/ko/stories/audiobook-guide1` → `<meta name="author" content="스튜디오 놀">`, JSON-LD author=Organization인데 article:author·twitter:creator·twitter:data1="황경하".

**영향** 카카오·트위터·Perplexity 카드의 작성자 표기가 화면·스키마와 갈리고, 결정 문서가 막으려던 '사실이 아닌 쪽으로 맞추기'가 메타 층에서 계속된다. twitter:data1은 Slack 등 언퍼얼에 '작성자'로 보일 수 있다. articleAuthor.test.ts는 JSON-LD만 고정한다.

**수정**
- `components/SEO.tsx:174-175` → `const effectiveArticleAuthor = articleAuthor || siteConfig.name;` (frontmatter에 황경하를 명시한 48편은 운영자가 유지돼 JSON-LD와 맞는다). 낡은 주석(172-173)도 지운다.
- `article:author`는 운영자 명시 글일 때만 `${siteUrl}/${currentLocale}/author` URL, 아니면 siteUrl(조직).
- `twitter:creator`는 `socialProfiles.twitter` 핸들이 있을 때만 출력(지금은 빈 문자열이라 출력 안 됨).
- `twitter:data1`은 effectiveArticleAuthor 그대로.
- `components/SEO.test.tsx`에 '조직 명의 글 → 메타에 황경하 없음' 케이스 추가(현재 이 메타를 고정하는 단언이 없어 충돌하지 않는다).

**비고** 검증 confirmed(라이브·코드 모두).

#### SEO-7. 쇼트코드 글자 수 표가 세 벌이라 practice-room-repertoire1이 색인 가능한데 사이트맵·목록에서 빠진다 [P2 · S]

**위치** `lib/sitemap/thinContent.js:11-16`(CJS 표), `lib/storyContentPolicy.ts:39-47`(TS 실측 표), `scripts/scan-near-duplicates.mjs:59-67`(세 번째 사본); 소비처 `lib/sitemap/routes.js`, `scripts/generate-story-listing.js:32,221`, `scripts/audit-thin-content.js:19`, `lib/storyListing/ko.json`

**지금 코드**
```js
// lib/sitemap/thinContent.js:13-16
const SHORTCODE_CHAR_ESTIMATES = {
  'online-fallback': 120,
  'session-checklist': 420,
};
// lib/storyContentPolicy.ts:39-47
'session-checklist': 160, 'studio-more': 232, 'studio-services': 135, 'online-request': 124, 'vocal-mix-bridge': 224, 'practice-room-terms': 117,
```

**왜 문제인가** thinContent.js(CJS)는 쇼트코드 2종만 갖고(session-checklist는 420으로 과대) 나머지는 기본값 80이다. storyContentPolicy.ts는 실측 7종, scan-near-duplicates.mjs는 studio-more 204로 낡은 세 번째 사본이다. 사이트맵(routes.js)·스토리 목록 생성기·thin 감사가 CJS 표를 쓰므로 페이지 판정(TS)과 사이트맵·목록 판정(CJS)이 갈린다. `generate-story-listing.js --check`는 자기 미러와만 비교해서 통과한다.

**재현** 전 스토리 1,274개 파일(리다이렉트 제외)에 CJS isStoryThin과 TS 규칙을 둘 다 돌리면 불일치는 practice-room-repertoire1 한 건: 본문 1,349자 + studio-more 232 = 1,581(TS, thin 아님) 대 1,349 + 80 = 1,429(CJS, thin). 라이브에서 이 페이지는 `index, follow`인데 sitemap-0.xml에 없고 lib/storyListing/ko.json에서 browsable=false다. 사이트맵 '등재 ⇔ 색인 가능' 불변식이 실제로 깨진 사례다. 420 과대 쪽은 현재 데이터에서 불일치 0건(이론상 위험).

**영향** 색인 가능한 페이지 1건이 사이트맵·IndexNow·스토리 목록에서 빠진다. 쇼트코드 추가·수정 때 CJS 쪽 누락으로 반복된다(CLAUDE.md의 "숏코드 세 곳" 규칙에 CJS 표가 빠져 있다).

**수정**
1. 표를 `lib/storyShortcodeEstimates.json` 한 파일로 옮기고 `lib/storyContentPolicy.ts`, `lib/sitemap/thinContent.js`, `scripts/scan-near-duplicates.mjs`가 모두 JSON을 읽게 한다(regionHubSlugs.json 방식). **세 사본 모두** 대상.
2. `lib/sitemap/thinContent.test.js`에 '전 스토리에서 isStoryThin과 computeThinContentStatus가 리다이렉트 제외 전부 일치' 테스트 추가.
3. `node scripts/generate-story-listing.js`로 목록 재생성 → lib/storyListing/*.json 갱신, 사이트맵에 practice-room-repertoire1이 들어오는지 확인. IndexNow는 변경 URL diff로 자동 제출된다.
4. CLAUDE.md "새 숏코드를 만들면 세 곳" 문장에 JSON 표를 추가한다.

**비고** 검증자가 바로잡은 요지: 표는 두 벌이 아니라 세 벌, 소비처는 사이트맵만이 아니라 목록 생성기·thin 감사까지. 같은 자리를 다른 축(CNT 콘텐츠 파이프라인·마크다운·데이터 정합)도 지적: 숏코드 글자수 추정 표가 TS·JS·스크립트 세 곳에 따로 있어 thin 판정이 갈린다 / 숏코드 글자수 추정표 사본이 어긋나 사이트맵 thin 판정과 페이지 판정이 갈린다 (thinContent.js 2항목 vs storyContentPolicy.ts 7항목). SEO-13이 같은 원인의 선행 조건을 다룬다.

#### SEO-8. Organization JSON-LD의 numberOfEmployees=5는 근거 없는 수치이고 본문('한 사람이 끝까지')과 충돌한다 [P2 · S]

**위치** `utils/schema/business.ts:184`; 참고 `pages/api/llms.ts:73,118`(foundingDate), `utils/schema/business.ts:283`(paymentAccepted)

**지금 코드**
```ts
foundingDate: '2024-01-01',
...
numberOfEmployees: { '@type': 'QuantitativeValue', value: 5 },
...
paymentAccepted: 'Cash, Credit Card, Bank Transfer, KakaoPay',   // :283
```

**왜 문제인가** `numberOfEmployees: 5`는 이 한 곳에만 있고 저장소 어디에도(data·docs/wiki·locales·llms) 근거가 없다. 같은 사이트 카피는 '대표 황경하가 직접 진행… 한 사람이 끝까지 맡습니다'(ko common.json:3358, :184)라고 적는다. 70df2e66ce(2026-04-14)부터 전 페이지 @graph에 실려 온 지어낸 수치다(memory feedback_no_invented_detail 유형).

**영향** AI 답변이 '직원 5명 규모'로 소개할 수 있다. 사이트 본문과 구조화 데이터가 어긋난다.

**수정**
- `utils/schema/business.ts:184`의 `numberOfEmployees` 삭제. 근거 상수가 생길 때까지 두지 않는다.
- (선택, P3) foundingDate는 `STUDIO_FOUNDING_YEAR`를 `data/siteConfig.ts`로 올려 llms.ts와 공유하고 필요하면 'YYYY' 형식으로 낸다. 지금은 llms.ts:73,118이 같은 2024에서 `${YEAR}-01-01`을 만들어 두 표면이 일치하므로 급하지 않다.
- `paymentAccepted`의 'Cash'는 건드리지 않는다. LocalBusiness(실제 방문 스튜디오)이고 content/stories 354편이 '현금, 카드, 카카오페이, 계좌이체 모두 가능'을 적고 있다. lib/payments/paymentChoices.ts는 온라인 결제수단 목록일 뿐 현장 결제의 정본이 아니다. 현금 불가라는 증거가 없다.

**비고** 검증자가 바로잡은 요지: 원 지적의 세 항목 중 지어낸 수치는 numberOfEmployees뿐. foundingDate는 P3 정리, 'Cash' 제거 제안은 근거 부족으로 기각.

#### SEO-9. GSC 감사가 #앵커 행을 슬러그·라우트 합계에 합산한다 (CLAUDE.md 4번 규칙 위반) [P2 · S]

**위치** `lib/seo/gscAudit.ts:106-110`(urlToSlug), `lib/seo/gscAudit.ts:177-189`(집계 루프), `lib/seo/gscDiff.ts:165-185`(CTR 누수 목록), `pages/api/cron/gsc-audit.ts`, `lib/seo/gscAudit.test.ts`; 대조 `scripts/ctr-verdict.mjs:112`

**지금 코드**
```ts
export function urlToSlug(url: string): string | null {
  const m = url.match(/\/[a-z]{2}\/stories\/([^/?#]+)\/?(?:[?#]|$)/);   // '#'로 끝나는 URL도 슬러그로 인정
...
const u = new URL(url);  ...  let p = u.pathname;      // urlToRoutePath: hash가 사라져 base 페이지에 합쳐진다
...
const slug = urlToSlug(url);
if (slug) { cur.clicks += row.clicks || 0; cur.impressions += row.impressions || 0; ...
```

**왜 문제인가** fetchGscPageMetrics가 '#섹션' 행을 버리지 않고 base 슬러그·라우트 합계에 더한다. CLAUDE.md 규칙 4는 "`#`가 있는 행은 버린다 — 합치면 같은 노출을 두 번 센다"이고, scripts/ctr-verdict.mjs:112는 이미 `url.includes('#')`를 건너뛴다. 같은 저장소 안에서 규칙이 한쪽만 적용돼 있다. gscAudit.test.ts에 앵커 케이스가 없다.

**재현** `dimensions: ['page']` 한 가지로 받은 docs/gsc-raw/page-all.csv(감사와 같은 호출 모양)로 계산: 앵커 행 816/2,008행, 노출의 19.0%, 클릭 13/16,274. 1,078슬러그 중 235개의 노출이 부풀고 songstructure1은 21,774 → 50,013으로 2.3배. 같은 데이터로 티어(KEEP/WATCH/WATCH_LOW/NOINDEX) 변화는 0건(임계 10·1에 비해 값이 커서 뒤집히지 않음).

**영향** 티어 판정은 영향이 없다. 실제 피해는 노출 파생 지표다 — gscDiff.ts:165-185의 CTR 누수 목록(노출≥300, 3% 기대 클릭 격차)은 상위 10 중 2개가 바뀌고(chord-progression1·copyright-cover1이 부당 진입, practice-room-vocal-diction1·condenser-mic1 누락), 클러스터 노출 합계가 19% 부풀며 CTR이 낮게 나와 CTR 수술 대상 선정이 어긋난다.

**수정**
1. `lib/seo/gscAudit.ts` 집계 루프(177행 부근) 맨 앞에 `if (url.includes('#')) continue;` — **이 줄이 필수**다. 정규식만 바꾸면 urlToRoutePath가 해시를 떼어 라우트 합계에 합친다.
2. urlToSlug 정규식의 `[?#]`를 `\?`로 줄인다.
3. `gscAudit.test.ts`: `…/ko/stories/eq1#toc`는 집계 제외(및 urlToSlug null), `…/ko/pricing#faq`도 라우트 집계 제외 케이스.
4. gscDiff 비교: 규칙 변경 첫 주에는 모든 페이지 노출이 약 19% 떨어져 diff 알림이 가짜 하락을 보고한다. 스냅샷에 기준 변경 표시(날짜·사유)를 기록하고 docs/ctr-surgery-log.md에도 적는다.

**비고** 검증자가 바로잡은 요지: '티어 경계·noindex 해제 후보 판정이 어긋난다'는 원 서술은 실측상 사실이 아니고, 피해는 CTR 누수 목록·클러스터 노출 합계·CTR이다.

#### SEO-10. next.config·middleware 단독 리다이렉트 슬러그(practice-room-drum1)가 스토리 목록·llms에 남는다 [P3 · M]

**위치** `lib/stories.ts:40-41`, `scripts/generate-story-listing.js:36`, `lib/sitemap/routes.js:61-69`, `lib/seo/gscAudit.ts:20-29`, `middleware.ts`(PAGE_REDIRECT_SLUGS), `next.config.mjs`(redirects), `data/practiceRoomRelatedGuides.test.ts`(정규식 파싱), `lib/storyListing/ko.json`

**지금 코드**
```ts
// lib/stories.ts:40-41
// next.config.mjs의 redirects()로 308 처리되는 슬러그. 빌드·listing에서 모두 제외.
const REDIRECTED_SLUGS = new Set<string>(Object.keys(regionRedirectMap));
// scripts/generate-story-listing.js:36
const REDIRECTED_SLUGS = new Set(Object.keys(require('../lib/regionRedirectMap.json')));
// lib/sitemap/routes.js:61-69 / lib/seo/gscAudit.ts:20-29 는 next.config 슬러그 3~4개를 별도로 더한다
```

**왜 문제인가** 스토리 열거(lib/stories.ts, generate-story-listing.js)는 regionRedirectMap 키만 제외하고, 사이트맵(routes.js)·GSC 감사(gscAudit.ts)는 next.config 슬러그를 따로 더한다. 주석은 "빌드·listing에서 모두 제외"라고 하지만 next.config 슬러그는 제외되지 않는다. 파일이 있는 슬러그는 practice-room-drum1 하나(english-speaking-music-lessons-seoul·chinese-music-lessons-seoul은 content/stories에 파일이 없다). 복제본은 네 곳이 아니라 middleware.ts PAGE_REDIRECT_SLUGS, next.config.mjs redirects, practiceRoomRelatedGuides.test.ts의 정규식 파싱까지 더 있다.

**재현** 라이브 /llms-full-ko.txt 766행에 practice-room-drum1 링크가 있고, `curl -I /ko/stories/practice-room-drum1` → 308 /ko/practice-room. lib/storyListing/ko.json에서 browsable=true.

**영향** 목록 카드 1개와 llms 링크 1줄이 308을 가리킨다. 클릭해도 연습실 페이지로 가서 사용자 피해는 사실상 없다. 슬러그가 늘 때 같은 누락이 재발할 수 있다.

**수정**
1. 리다이렉트 슬러그를 JSON 한 곳(예 `lib/redirectedSlugs.json`)으로 모으고 lib/stories.ts·generate-story-listing.js·routes.js·gscAudit.ts가 읽게 한다.
2. middleware PAGE_REDIRECT_SLUGS와 next.config redirects 슬러그를 이 목록과 대조하는 테스트를 둔다(practiceRoomRelatedGuides.test.ts의 정규식 파싱 방식 재사용).
3. 적용 뒤 `node scripts/generate-story-listing.js`로 storyListing 재생성, lib/story-catalog.json·content/cta-routing.baseline.json에 해당 슬러그가 들어 있으므로 `npx tsx scripts/cta-routing-baseline.ts --update`로 기준선 갱신(사유를 커밋 메시지에 기록). 이걸 빼먹으면 check:cta-routing이 CI에서 선다.

**비고** 검증자가 바로잡은 요지: 심각도 P3(영향은 카드 1개·링크 1줄), 복제본이 더 많고 기준선 갱신이 함께 필요. 같은 자리를 다른 축(TST 테스트·CI·빌드 파이프라인)도 지적: 테스트에서 스토리 캐시가 꺼져 llms-contact 한 파일이 CI Test 단계의 70%를 먹는다.

#### SEO-11. 동적 OG 이미지 URL에 템플릿 버전 키가 없다 [P3 · M]

**위치** `pages/api/og/story.tsx:61-98`, `lib/storySeoData.ts:82`(buildStoryDynamicOgImage), `lib/storySeoData.test.ts:88`, `scripts/social/compose.mjs:64`

**지금 코드**
```ts
const slug = searchParams.get('slug');
if (slug && !VALID_SLUG_RE.test(slug)) { return new Response(null, { status: 400 }); }   // slug는 검증만 하고 쓰지 않는다
const title = (searchParams.get('title') || 'Studio NOL').substring(0, 100);
const category = (searchParams.get('category') || '').substring(0, 40);
const date = (searchParams.get('date') || '').substring(0, 20);
// storySeoData.ts:82
`/api/og/story?title=${encodeURIComponent(title)}&category=...&date=...&locale=${locale}`
```

**왜 문제인가** URL이 title·category·date·locale로만 정해져 카드 디자인을 바꿔도 URL이 같다. 카카오는 og:image를 URL 단위로 캐시하고(CLAUDE.md "OG 이미지를 바꾸면 파일명도 바꾼다"), 응답 자체도 s-maxage=86400 + SWR 7일이다. 임의 문구 렌더는 @vercel/og 엔드포인트의 통상 설계이고 코드 주석('마케팅 OG 재사용 허용')에 의도가 적혀 있어 위험이 낮다. 레이트리밋은 Redis 미설정·장애 시 fail-open(주석에 best-effort로 명시).

**영향** 디자인 변경 시 카카오톡·브라우저에 옛 카드가 남을 수 있다. 사칭·비용 증폭은 현재 증거가 없는 이론상 위험이다(2026-09 보안 감사에서도 8점 이상 아님). 현재 템플릿 변경 계획이 없어 선제적 개선이다.

**수정**
- `lib/storySeoData.ts` buildStoryDynamicOgImage에 `&v=<템플릿판>` 한 줄 추가(예 `&v=1`), `lib/storySeoData.test.ts:88`의 기대 URL을 맞춘다. 템플릿을 바꿀 때만 v를 올린다.
- 서명(HMAC)·slug 조회는 도입하지 않는다 — lib/story-catalog.json은 ko 제목 1,582건·370KB뿐이라 번역 제목(th·en, 1ea095d111이 태국어 카드를 고친 이력)을 못 그리고, buildStoryDynamicOgImage에는 slug 인자가 없으며, 소셜 발행(compose.mjs:64)도 slug+title로 이 엔드포인트를 쓴다.
- 남용이 실제로 보이면 Vercel Firewall에서 /api/og/story의 비정상 요청률을 제한하는 쪽이 코드 변경보다 싸다.

**비고** 검증자가 바로잡은 요지: 원 지적의 '사칭·비용 증폭' 심각도와 'slug로 카탈로그 조회·HMAC 서명' 수정안은 성립하지 않고, 남는 것은 버전 키 부재. 같은 자리를 다른 축(CQ 코드 품질·구조·중복·타입 안전)도 지적: og/story.tsx의 위조 가능한 IP 헤더 폴백 두 줄 제거.

#### SEO-12. en 색인 LP의 SEO 문구가 SERP 길이를 넘고, music-promotion 영문 설명이 종료일 없는 도입가를 하드코딩한다 [P3 · S]

**위치** `public/locales/en/common.json:1833-1834`(musicPromotion.seo), 같은 파일의 mixing-mastering·release-project·recording·pricing seo 키; 정본 `data/pricing.ts:149`(RELEASE_PRESS_INTRO_ENDS_ON='2026-12-31'), `lib/enIndexablePaths.json`

**지금 코드**
```json
"title": "Music Release PR — We Find the Outlets That Would Cover It | Studio NOL",   // 71자
"description": "We find the Korean music outlets and the media, radio stations and record shops across 60 countries that would cover your music, and write to each in the language it reads. Press release in 5 languages, press kit and send-out report included. 1,200,000 KRW → 300,000 KRW.",   // 271자
```

**왜 문제인가** 색인이 열린 en 페이지의 길이(라이브 실측): /en/music-promotion title 71·desc 271, mixing-mastering desc 252, release-project desc 266, recording title 65·desc 198, pricing desc 188. 모두 `index, follow`이고 enIndexablePaths.json의 6개 경로에 속한다. title 60자·description 155자는 SERP의 소프트 한도(픽셀 기준)라 넘으면 잘릴 뿐 불이익은 아니다. 의미 있는 부분은 하나다 — en musicPromotion.seo.description이 '1,200,000 KRW → 300,000 KRW'를 하드코딩하고 종료일이 없다. ko 문구는 '(2026년 12월 31일까지)'를 포함한다.

**영향** 영어 검색 노출 문구가 잘리고, 2026-12-31 이후(82일 뒤) en 메타가 종료된 도입가를 그대로 광고한다. 열린 실험(voice-acting LP, recording-price1)·관측창과 en LP는 겹치지 않아 수정 가능하다.

**수정**
1. (먼저) en music-promotion description에 도입가 종료일을 넣거나 가격 문장을 뺀다 — '300,000 KRW intro price until 2026-12-31' 형태, 가능하면 `RELEASE_PRESS_INTRO_*` 상수에서 보간.
2. 나머지 en seo.title ≤ 60자, description ≤ 155자로 줄인다. 예: 'Music Release PR — Outlets That Would Cover It | Studio NOL'(59자).
3. 테스트는 en 색인 경로(lib/enIndexablePaths.json)만 대상으로 한다. **ko 상한을 'title ≤ 40·desc ≤ 110'으로 두면 오늘 바로 3건(ko music-promotion desc 125, mixing-mastering 124, release-project 150)이 실패한다** — ko는 현재 값(title ≤ 40, desc ≤ 150)에 맞추거나 두지 않는다.

**비고** 검증자가 바로잡은 요지: 심각도 P3, 원 제안 테스트의 ko 상한은 결함. '/ko/funding description 39자' 지적은 키 위치를 못 찾아 미확인.

#### SEO-13. 스토리 목록·허브 ISR 페이지의 getAllStories 사용 — listing 전환 전에 thin 상수 불일치부터 맞춰야 한다 [P3 · S]

**위치** `pages/[locale]/stories/index.tsx:377`, `pages/[locale]/stories/category/[key].tsx:311`, `pages/[locale]/guides/[slug].tsx:90`, `pages/api/stories/catalog.ts`, `lib/sitemap/thinContent.js:13-16`, `lib/storyContentPolicy.ts`, `scripts/generate-story-listing.js`

**지금 코드**
```ts
// stories/index.tsx:377
const fullStories = getAllStories(locale).filter((story) =>
  isBrowsableStoryForLocale(story, locale)
// stories/category/[key].tsx:311  const allStories = getAllStories(locale);
// guides/[slug].tsx:90           const allStories = getAllStories(locale);
```

**왜 문제인가** 세 페이지가 전체 스토리를 읽어 browsable 필터를 거는데, 이를 getStoryListing(listing JSON)으로 바꾸는 성능 개선 제안이 있었다. 그러나 '현재는 같은 결과'가 아니다 — 실측(npx tsx) ko: getAllStories+isBrowsableStoryForLocale 1037편, getStoryListing browsable 1036편. 차이는 practice-room-repertoire1 한 편(SEO-7의 CJS/TS 표 불일치가 원인; en/zh/es/vi/th/uz는 일치). 즉 이미 /stories SSG의 totalStories(1037)와 /api/stories/catalog totalItems(1036)가 갈려 있고, 그대로 listing으로 바꾸면 페이지 출력이 한 편 줄어든다. 성능 이득도 작다 — allStoriesCache/storyAvailableLocalesCache가 람다별로 있고 ISR 재생성은 백그라운드라 사용자 지연이 없으며, getAllStories 콜드 ko 2.6s/en 2.0s 뒤 browsable 필터는 약 0.17s다.

**영향** 선행 조건을 건너뛰면 목록에서 글이 한 편 사라지고 SSG 총계와 API 총계가 계속 갈린다.

**수정(순서대로)**
1. SEO-7을 먼저 적용한다 — thinContent.js 상수를 storyContentPolicy.ts와 같은 값으로(단일 JSON) 맞추고 TS·JS 값이 같은지 대조하는 테스트.
2. `generate-story-listing.js`를 다시 돌려 listing을 갱신하고, 로케일 7개에서 'getAllStories 기반 browsable 슬러그 목록 == listing 기반 목록'을 대조하는 가드를 `lib/stories.test.ts`에 둔다.
3. 그다음에야 세 페이지를 `getStoryListing(locale).filter(s => s.browsable)`로 전환한다. 우선순위는 낮다.

**비고** 검증자가 바로잡은 요지: '현재는 같은 결과'는 거짓(1편 차이), '두 번 읽는다'는 성능 주장은 과장. 같은 자리를 다른 축(CNT 콘텐츠 파이프라인·마크다운·데이터 정합)도 지적: 숏코드 글자수 추정 표가 TS·JS·스크립트 세 곳에 따로 있어 thin 판정이 갈린다 / 숏코드 글자수 추정표 사본이 어긋나 사이트맵 thin 판정과 페이지 판정이 갈린다 (thinContent.js 2항목 vs storyContentPolicy.ts 7항목).

#### SEO-14. SiteNavigationElement JSON-LD가 noindex로 내린 /ko/artists를 계속 싣는다 [P3 · S]

**위치** `pages/_app.tsx:295-297`; `data/navFlags.ts`(ARTISTS_NAV_LISTED=false), `components/layout/Header.tsx:126`, `lib/navLabels.ts`, `lib/navLabels.test.ts`

**지금 코드**
```ts
...(locale === 'ko'
  ? [{ '@type': 'SiteNavigationElement', name: labels.artists, url: `${base}/artists` }]
  : []),
```

**왜 문제인가** ARTISTS_NAV_LISTED=false로 메뉴에서 내린 /ko/artists(라이브 `noindex, follow`)를 JSON-LD는 ko 전 페이지에 싣는다(라이브 /ko/pricing의 SiteNavigationElement 1,623바이트에 포함). 정적 라벨 맵이 Header의 게이트를 따르지 않는다. 다만 이 JSON-LD는 Header를 거울처럼 따라가는 구조가 아니다 — Header는 발매 티어 single/ep/album을 의도적으로 메뉴에서 뺐는데 JSON-LD는 싣고 있다. 따라서 '펀딩·공연이 없다'는 결함이 아니고, 고칠 것은 noindex로 내린 아티스트 항목이다.

**영향** noindex URL을 홍보하는 구조화 데이터 한 줄. 페이지당 약 1.6KB. Google은 SiteNavigationElement를 쓰지 않고, AI 크롤러 소비 여부는 미확인.

**수정**
- 최소: 아티스트 항목의 조건을 `locale === 'ko' && ARTISTS_NAV_LISTED`로(한 줄, `data/navFlags.ts` import).
- 블록 전체를 삭제하려면 `_app.tsx`의 siteNavSchema와 `<script>`, `lib/navLabels.ts`, `lib/navLabels.test.ts`(common.json 동기화 가드), NavKey 'artists'를 함께 정리한다.
- Header와 1:1 일치는 목표로 삼지 않는다.

**비고** 검증자가 바로잡은 요지: 수정 대상은 아티스트 항목 한 줄이고, 전체 삭제 시 navLabels 테스트까지 연쇄.

#### SEO-15. 번역 없는 폴백 스토리·포트폴리오 본문에 lang 표기가 없어 html lang(요청 로케일)과 본문 언어가 어긋난다 [P3 · S]

**위치** `pages/[locale]/stories/[id].tsx:132-165`, `pages/[locale]/portfolio/[id].tsx:77-86`(폴백 체인 `locale -> en -> ko`), `pages/_document.tsx`(`<Html lang={locale}>`), `components/Layout.tsx:73`

**지금 코드**
```ts
const locale = (ctx.query?.locale as string) || defaultLocale;
...
<Html lang={locale} ...
```

**왜 문제인가** 폴백 렌더에서 본문은 sourceLocale(ko 또는 en)인데 문서 lang은 요청 로케일이다. 2026-09-08 리뷰 7번(우선순위 낮음)이 미처리다. _document만 고쳐서는 안 된다 — components/Layout.tsx:73이 하이드레이션 뒤 useEffect에서 `document.documentElement.lang = locale`을 무조건 다시 써서 라이브 DOM의 lang은 곧 요청 로케일로 되돌아간다. 같은 이유로 404/500의 lang=ko는 JS가 도는 클라이언트에서 이미 보정된다.

**재현** /vi/stories/eq1 → `<html lang="vi">`에 ko 본문, `noindex, follow`. /en/nonexistent-xyz(404) → `<html lang="ko">`.

**영향** 스크린리더 발음 언어·브라우저 번역 제안이 어긋난다. 폴백 페이지는 noindex라 색인 손실은 없다.

**수정**
- html lang은 둔다(헤더·푸터·UI는 요청 로케일로 그려지므로 바꾸면 그쪽이 오표시된다). 폴백일 때 본문 컨테이너에 `lang={story.sourceLocale}`을 건다(WCAG 3.1.2).
- 포트폴리오는 productionNotes 폴백 출처(en, 없으면 ko)에 맞춰 같은 방식으로 건다 — '폴백이면 ko'가 아니다.
- 문서 lang을 꼭 바꿔야 한다면 _document와 Layout.tsx:73 양쪽을 함께 고친다.
- 404/500은 대상에서 뺀다.

**비고** 검증자가 바로잡은 요지: 원 수정안(_document만)은 Layout.tsx:73 때문에 효과 없음, 포트폴리오 폴백은 ko 고정이 아님.

#### SEO-16. serializeJsonLd 주석은 `<!--` 이스케이프를 말하지만 코드는 하지 않는다 [P3 · S]

**위치** `components/seo/schemaData.ts:67-76`, `components/seo/schemaData.test.ts`; 외부 입력 경로 `pages/[locale]/funding/[slug]/index.tsx:129-148`

**지금 코드**
```ts
JSON.stringify(data)
  // </script>가 파서를 벗어나지 못하게 이스케이프.
  .replace(/<\//g, '<\\/')
  // <!--가 들어가면 <script> 파서가 "script data escaped" 상태로 진입해 ... U+2028/U+2029 ... 함께 이스케이프.
  .replace(/ /g, '\\u2028')
  .replace(/ /g, '\\u2029')
```

**왜 문제인가** 2026-09-08 #15의 수정이 U+2028/9만 넣고 `<!--` 처리는 빠졌는데 주석은 처리한 것처럼 적혀 있다. schemaData.test.ts에는 `</script>` 케이스 하나뿐이고 `<!--` 케이스가 없다. parse5 재현: JSON 문자열에 `<!-- ... <script`가 함께 들어가면 `<script type=ld+json>` 뒤의 `<p>`가 사라진다(스크립트 데이터가 double-escaped 상태에 들어가 닫는 태그를 삼킴). `</`가 이미 이스케이프되어 있어 XSS는 아니고 페이지 깨짐이다.

**영향** 본문에 `<!--`와 `<script`가 함께 든 FAQ/summary가 생기면 JSON-LD 블록이 깨진다. content/stories·data에 `<script` 문자열은 0건이라 정적 콘텐츠로는 미발현. 다만 펀딩 페이지 JSON-LD는 개설자 입력인 project.title·summary를 serializeJsonLd로 싣는 외부 입력 경로다(관리자 승인 뒤라 위험 낮음).

**수정**
- `.replace(/<!--/g, '<\\u0021--')` 한 줄 추가(JSON.parse 왕복 동일, `<p>` 유지 확인됨).
- `schemaData.test.ts`에 `<!--`·`</script>` 포함 문자열의 직렬화 결과를 JSON.parse로 왕복 검증하는 케이스 추가.
- 대안(모든 `<`를 `<`로)은 `<script`까지 막지만 기존 테스트 기대 문자열이 바뀐다.

**비고** 검증 confirmed.

#### SEO-17. releaseProject 스키마의 Service에 유효하지 않은 `duration`·`performer` [P3 · S]

**위치** `utils/schema/releaseProject.ts:123`(Offer.itemOffered Service), `utils/schema/releaseProject.ts:136`(Service 본체); 기존 테스트 `data/pricing.test.ts:326-337`(가격 수치만)

**지금 코드**
```ts
const RELEASE_TIER_DURATIONS = { single: 'P12W', ep: 'P6M', album: 'P12M' };
...
itemOffered: { '@type': 'Service', ... performer: { '@id': personId }, duration: RELEASE_TIER_DURATIONS[t] },
...
performer: { '@id': personId },   // service 본체 :136
```

**왜 문제인가** schema.org/Service에는 `duration`·`performer`가 없다(상속 속성 포함, 직접 조회). 대체안으로 흔히 드는 `additionalProperty`는 MerchantReturnPolicy·Offer·Place·Product·QualitativeValue·QuantitativeValue에만, `employee`·`founder`는 Organization에만 쓰여 Service에는 역시 붙일 수 없다.

**영향** 스키마 검증기 경고와 무시되는 속성. Google은 Service 리치 결과를 만들지 않으므로 순위·노출 영향은 없다.

**수정**
- `performer` 삭제(Person–Organization 연결은 Person 노드의 worksFor가 이미 맡는다). Service와 Person을 꼭 이어야 하면 `Service.provider`를 `[{Organization ref}, {'@id': personId}]` 배열로(provider는 Person 허용).
- `duration`은 Offer 노드의 `additionalProperty`(PropertyValue)로 옮기거나, 소비처가 없으므로 삭제.
- 가드: release 그래프의 Service 노드에 duration/performer가 없음을 검사하는 테스트를 새로 추가(기존 pricing.test는 가격만 본다).

**비고** 검증자가 바로잡은 요지: 원 지적의 대체안(Service.additionalProperty·employee·founder)도 무효. P3 유지.

#### SEO-18. 시간제 연습실 Offer.url이 robots 차단·noindex인 예약 퍼널을 가리킨다 [P3 · S]

**위치** `utils/schema/commerce.ts:164`(시간제 Offer.url), `utils/schema/commerce.ts:185`(ReserveAction urlTemplate); `next-sitemap.config.js`(robots `Disallow: /ko/booking/`), `data/pricing.test.ts:212`(ReserveAction 고정)

**지금 코드**
```ts
url: `${config.url}/ko/booking/practice-room`,   // :164 (시간제 Offer.url)
urlTemplate: `${config.url}/ko/booking/practice-room`,   // :185 (ReserveAction)
// next-sitemap.config.js robots disallow: '/ko/booking/'
```

**왜 문제인가** 라이브 /ko/practice-room JSON-LD의 시간제 Offer.url이 /ko/booking/practice-room(robots Disallow, `noindex, nofollow`)이라 이 오퍼의 정본 LP(/ko/practice-room)와 다르다. 월세 Offer.url은 LP(pageUrl)다.

**영향** Service/LocalBusiness 그래프의 offers라 Google이 가격·재고를 검증해 리치 결과로 만드는 대상(Product/Merchant)이 아니다. 오퍼 URL과 정본 LP의 불일치를 정리하는 수준.

**수정**
- `commerce.ts:164` Offer.url을 월세 오퍼와 같은 `pageUrl`로. `#practice-room-hourly` 조각은 붙이지 않는다 — DOM에 해당 id가 없다(그 문자열은 JSON-LD @id로만 쓰인다).
- ReserveAction target(:185)·llms.txt 예약 안내는 그대로 둔다(예약 진입점으로 맞고 pricing.test.ts:212가 고정).

**비고** 검증자가 바로잡은 요지: 리치 결과 불이익 서술은 과장, 앵커 조각 제안은 DOM id 부재로 기각.

#### SEO-19. RSS의 media:content url이 XML 이스케이프 없이 속성에 들어간다 [P3 · S]

**위치** `pages/api/rss.ts:66-71`

**지금 코드**
```ts
const mediaTag = thumbnailUrl
  ? `\n      <media:content url="${thumbnailUrl}" medium="image" />`
  : '';
```

**왜 문제인가** title·author·category는 escapeXml을 거치는데 media:content url만 날것이다. 썸네일은 frontmatter thumbnail 또는 본문 첫 이미지 URL(`extractFirstImageUrl`)이라 외부 URL의 `&`가 들어갈 수 있고, 들어가면 XML이 깨져 피드 전체가 파싱에 실패한다. 현재 미발현 확인: 라이브 /api/rss?locale=ko가 minidom으로 파싱되고, 7개 로케일 listing의 썸네일 7,678건 중 `& < > "`를 포함한 것이 0건.

**영향** 글 한 편의 이미지 URL 때문에 RSS 구독자·네이버 서치어드바이저 전체가 피드를 못 읽게 될 수 있다(잠복).

**수정** `url="${escapeXml(thumbnailUrl)}"`(속성 따옴표까지 처리된다). 테스트에 `&` 포함 썸네일 케이스 추가.

**비고** 검증 confirmed.

#### SEO-20. 웹 매니페스트 start_url이 슬래시로 끝나 실행마다 308을 탄다 [P3 · S]

**위치** `pages/api/manifest.ts:35`; `middleware.ts:242-250`(슬래시 정규화)

**지금 코드**
```ts
id: `/${locale}/`,
start_url: `/${locale}/`,
```

**왜 문제인가** 라이브 `curl /api/manifest?locale=ko`가 id와 start_url 모두 `/ko/`를 돌려주고, `/ko/`는 미들웨어가 308로 `/ko`로 보낸다. 이 manifest를 검사하는 테스트는 없다.

**영향** 설치형 앱을 열 때 308 한 번. 사용자 체감은 거의 없다.

**수정** `start_url`만 `/${locale}`로. **`id`는 그대로 둔다** — manifest id는 설치된 PWA의 정체성이고 요청되는 URL이 아니라 리다이렉트를 타지 않으며, 바꾸면 이미 설치한 사용자의 앱 정체성이 바뀐다.

**비고** 검증자가 바로잡은 요지: 원 수정안의 id 변경은 기각. 'Lighthouse start_url 200 검사' 주장은 미확인.

#### SEO-21. 앱 셸 로딩 문구: vi는 성조 누락, th는 비정형 조합 문자 [P3 · S]

**위치** `pages/_app.tsx:34-35`(localeLoadingMessage, 모듈 비공개 상수)

**지금 코드**
```ts
vi: 'Dang tai noi dung...',
th: 'กําลังโหลดเนื้อหา...',
```

**왜 문제인가** vi 'Dang tai noi dung...'은 성조·đ가 모두 빠진 눈에 보이는 오표기다(같은 로케일 common.json에는 'Đang tải'가 있다). th 'กําลัง'은 코드포인트 0E01 0E4D 0E32로 정형 'กำลัง'(U+0E33)과 NFKC상 같은 문자열이라 시각적으로 똑같이 그려진다 — 정규화 수준의 정리. 이 문구는 `!hasServerResourceForLocale && !isLocaleReady && !hasResourceBundle`일 때만 보이는 드문 화면이다.

**영향** vi 사용자에게 번들 지연 시 잠깐 보이는 오표기. th는 시각 영향 없음.

**수정** vi: `'Đang tải nội dung...'`, th: `'กำลังโหลดเนื้อหา...'`로 교체. 테스트가 필요하면 localeLoadingMessage를 export해 비ASCII 여부를 확인하되 필수는 아니다(errorPagesI18n.test.ts는 404/500 getStaticProps만 보므로 그 파일에는 못 넣는다).

**비고** 검증자가 바로잡은 요지: '오탈자로 보임'은 vi에만 해당.

#### SEO-22. 운영자 로마자 표기 잔존 이표기(Gyeongha 6곳·Gyeong-ha 10곳)가 정본(Kyungha)과 다르다 [P3 · S]

**위치** `next-sitemap.config.js:53-62`(이미지 사이트맵 title/caption, 'Hwang Gyeongha' 6건), `utils/schema/releaseProject.ts`('Hwang Gyeong-ha' 5건), `data/portfolio/items.ts`(4건), `docs/proposals`(1건); 정본 `data/siteConfig.ts:75`

**지금 코드**
```ts
// data/siteConfig.ts:75 — 정본
alternateName: ['Hwang Kyungha', 'Kyungha Hwang'],
```

**왜 문제인가** siteConfig.ts:75 바로 위 주석이 '철자 정본은 Kyungha(authorProfile·llms.txt 동일)'라고 정했고 a977c105b9(2026-09-04 '인명을 통일한다')가 Kyung-ha를 Kyungha로 맞췄는데, Gyeong-ha·Gyeongha 15곳이 남았다. 기계가 읽는 표면(이미지 사이트맵, Release Project 스키마 설명, 포트폴리오 영문 노트)에서 같은 사람이 세 철자로 나온다.

**영향** GEO 엔티티 분리 가능성 — 추정이고 근거 데이터 없음.

**수정**
- alternateName은 두 어순이 이미 있으므로 늘리지 않는다. 남은 이표기를 정본 'Hwang Kyungha'로 치환한다(a977c105b9와 같은 방식). SEO-2의 /lesson 캡션을 고칠 때 같은 철자를 쓴다.
- 사이트맵 title/caption 변경은 IndexNow·lastmod에 영향이 있으니 커밋 메시지에 `[skip-indexnow]` 여부를 판단해 적는다(문구만 바뀌면 붙인다).

**비고** 검증자가 바로잡은 요지: 실측 건수 6+10(원 지적 8·10), 'alternateName에 첫 철자만 있다'는 부정확, 수정은 alternateName 확장이 아니라 치환.

#### SEO-23. 정적 OG 이미지(public/images/og-*)에는 '그림을 바꾸면 파일명도 바꾼다' 가드가 없다 [P3 · M]

**위치** `utils/schema/shared.ts:96-100`(DEFAULT_SCHEMA_IMAGE), `components/SEO.tsx:87`(기본 og:image og-default.webp), `public/images/og-*`(17개), `next.config.mjs:218`(/images/:path* immutable 1년); 선례 `content/fundingImages.baseline.test.ts`

**지금 코드**
```ts
export const DEFAULT_SCHEMA_IMAGE = {
  url: '/images/og-default.jpg',
  width: 1200,
  height: 630,
} as const;
```

**왜 문제인가** 펀딩 cover/ogImage/heroImage만 이름 × sha256 기준선으로 고정되고, 사이트 공용 og-default.*·og-*.webp는 같은 경로 덮어쓰기를 CI가 못 잡는다(SEO 스냅샷·articleAuthor 테스트는 경로 문자열만 본다). 과거 d51e9e2113·85178f14ad는 커밋/되돌림 쌍이라 og-default.jpg 바이트가 158527 → 147076 → 158527로 돌아와 현재 불일치는 없고, 2026-09-15 이후 정적 og-* 파일은 바뀐 적이 없다(music-promotion 한 건). DEFAULT_SCHEMA_IMAGE는 JSON-LD 이미지라 카카오 스크래퍼가 URL 단위로 캐시하는 og:image 메타와는 위험이 다르다.

**영향** og 이미지를 같은 이름으로 갈아 끼우는 실수를 막는 보험. 현재 피해는 없다.

**수정** 선택 사항. 하려면 SEO.tsx 기본값과 페이지 ogImage props가 실제로 쓰는 og-* 파일에 한정해 fundingImages.baseline.test.ts의 assertUpdateAllowed 패턴을 재사용한다(이름을 먼저 바꿔야 갱신이 허용되는 구조). DEFAULT_SCHEMA_IMAGE는 우선순위에서 뺀다. 전역 지침 '이득이 작은 기계를 들이지 않는다'와 저울질할 사안이다.

**비고** 검증자가 바로잡은 요지: 과거 두 커밋은 현재 어긋남의 근거가 아니고, JSON-LD 이미지와 og:image 메타는 캐시 위험이 다르다.

#### SEO-24. content/stories에 추적되는 잡파일 2개 — 773KB image.png와 sed 백업 mixing-complete-guide.md-E [P3 · S]

**위치** `content/stories/image.png`(773,685바이트, 45d37062fb 2025-08-11), `content/stories/mixing-complete-guide.md-E`(1ea67e1d2b #550, 2026-10-07)

**지금 상태**
```
git ls-files content/stories | grep -v '\.md$'
content/stories/image.png
content/stories/mixing-complete-guide.md-E
```

**왜 문제인가** .md-E는 BSD `sed -i -E` 백업이 #550(857편 일괄 정리)에 딸려 커밋된 것으로, 정리 전 본문을 담고 있다(locale 접두사 없는 `[5부](/stories/mixing5)`·`[7부](/stories/mixing7)` 링크가 남아 있고 현재 .md는 제거됨). image.png는 어떤 스토리·코드도 참조하지 않는 잔재다. 코드는 `.md`로 끝나는 파일만 스토리로 읽으므로 사이트 동작에는 영향이 없다.

**영향** 옛 본문이 검색·에이전트 작업에 섞인다. 번들 +0.8MB 주장은 next.config.mjs에 content/stories 추적 규칙이 없어 미확인(해가 없는 수준).

**수정** `git rm content/stories/image.png content/stories/mixing-complete-guide.md-E`. `lib/stories.test.ts`에 content 폴더 위생 테스트(확장자가 .md가 아닌 파일 금지) 추가.

**비고** 검증 confirmed. 같은 자리를 다른 축(CNT 콘텐츠 파이프라인·마크다운·데이터 정합)도 지적: content/stories에 커밋된 잔재 파일 2개 (image.png, mixing-complete-guide.md-E).

**클린 판정**
- middleware.ts 로케일 프리픽스·대소문자·트레일링 슬래시·지역 308 병합: 라이브에서 /ko/pricing/, /KO/Pricing, /pricing, /ko/stories/EQ1, /ko//pricing 모두 1홉, /zz/pricing 404, /ko/guides·/ko/index 404로 설계와 일치. 봇 308 / 비봇 307+Vary+no-store 분기와 redirectStatus 우선순위도 정상
- BOT_PATTERN: 2026-09-08 #2(Claude-User 등) 해결 확인([a-z]+-user), 라이브 UA 분류와 테스트 통과
- components/SEO.tsx + components/seo/metadataUrls.ts: canonical 쿼리 제거, 폴백 스토리 → 원문 canonical·noindex·hreflang 생략, 비-ko noindex와 enIndexablePaths 예외의 hreflang 상호 참조 정합(라이브 /en/pricing 등 6개 ko↔en 쌍 확인)
- 라이브 사이트맵 sitemap-0.xml: 비-스토리 70 URL의 title/description/canonical/h1 개수/robots 실측, JSON-LD 전부 파싱 가능, @id 중복은 의도한 #person-hwang 참조 병합뿐, JSON-LD 내부 URL 144개 전부 200(루트는 /ko로 307)
- next.config.mjs 헤더: 개인 경로 no-store 규칙이 로케일 public 규칙 뒤에 있고 tests/config/noStoreHeaders.test.ts가 privatePaths와 대조. GSSP 페이지 라이브 응답은 Next 기본 no-store(booking·terms)이거나 핸들러 지정(shows 30초) — 예약 허브가 1시간 캐시된다는 의심은 실측으로 기각
- lib/analytics/privatePaths.ts ↔ 비공개 페이지: 토큰·결제 키가 URL에 실리는 모든 페이지가 목록에 있고, pages/[locale] 아래 비공개/트랜잭션 페이지 26개 전부 noindex를 가짐(grep 확인)
- lib/koOnlyRoutes.ts ↔ 페이지 getStaticPaths: 테스트가 대조, Header/Footer가 ko 전용 링크를 locale === 'ko'로 게이트(라이브 /en/funding·/en/artists 404와 링크 노출이 일치), LanguageSwitcher가 같은 규칙 사용
- lib/getStatic.ts·lib/i18n.ts·lib/i18n.server.ts: i18nSections 누락은 content/i18nKeys.test.ts가 페이지 import closure까지 검증, 404/500 번들 사전 주입 정상
- scripts/normalize-sitemap-hreflang.js: 사이트맵·robots.txt 부재 시 exit 1로 빌드를 세우는 게이트 정상. robots.txt: /api/og/ Allow가 /api/ Disallow보다 길어 우선, /_next/data/ 차단 반영
- pages/api/llms.ts·llms-full.ts·rss.ts·sitemap-*.xml.ts: HEAD 허용, 5MB UTF-8 바이트 상한+줄 경계 절단, RSS 제목·저자 이스케이프, 런타임 사이트맵 DB 실패 시 빈 사이트맵(500 회피), 라이브 llms-full-ko.txt 200·포트폴리오 32건 포함
- funding/[slug]는 `^[a-z0-9-]+$` 검증 + 비-ko notFound 가드, shows는 SHOW_SLUG_PATTERN, 결제 링크 slug는 24자 hex 패턴 — 스토리와 달리 경로 이탈 없음
- 2026-09-08 리뷰 항목 중 해결 확인: 스키마 대표 이미지(thumbnail.jpg → og-default.jpg), author Person 완전 노드 중복(참조+description으로 축소), 연습실 RelatedGuides prefetch/props 왕복 제거, 트레일링 슬래시 1홉 통합
- npx jest(lib/sitemap, lib/stories, middleware, components/seo, utils/schema, koOnlyRoutes, getStatic, storySeoData, lib/seo, og-story) 21 suites / 285 tests 통과

**읽지 못한 범위**
- pages/[locale]/{about,composition-arrangement,cover-video,crowdfunding-design,lesson,mixing-mastering,music-promotion,practice-room,pricing,recording,studio-info,voice-acting,wedding-song}.tsx와 release-project/index.tsx, portfolio.tsx 본문 JSX는 SEO props·getStaticPaths·getStaticProps만 읽고 라이브 메타/JSON-LD 실측으로 대체했다(전체 줄 정독 아님)
- components/release/TierPage.tsx, components/guides/BuyerIntentHubPage.tsx, components/LanguageSwitcher.tsx 내부 동작, Layout.tsx의 press/계약 셸 분기는 읽지 않았다
- lib/seo/gscDiff.ts 120~351줄, lib/llms/priceFacts.ts, pages/api/llms.ts 140~205·330~440줄은 훑기만 했다(가격 문장 정합 미검증)
- scripts/generate-story-listing.js 전체와 IndexNow 스크립트(scripts/indexnow-*.mjs), 사이트맵 lastmod 생성기는 범위 밖으로 두고 읽지 않았다
- 비-ko 로케일(es·vi·th·uz·zh) 실제 HTML은 /vi/stories/eq1만 실측했고 나머지는 코드로만 판단했다
- Vercel 방화벽·Edge 설정, GSC 크롤 통계, Turso 데이터는 읽기 전용 규칙상 조회하지 않았다. 경로 이탈이 프로덕션 번들에서 읽을 수 있는 .md의 실제 범위(번들에 어떤 디렉터리가 들어갔는지)는 확인하지 못했다

**미검증 후보(overflow)**
- lib/bot-detection.ts:22-23 — `bot` 부분 일치가 CUBOT 등 `bot`이 든 기기 UA의 실사용자를 봇으로 분류해 언어 협상 없이 /ko 308과 __bt 쿠키를 준다(P3, 영향 극소)
- pages/[locale]/terms.tsx:181 — 정적 약관을 리다이렉트 때문에 GSSP로 서빙해 매 요청 함수 실행+no-store; quote·funding/apply처럼 getStaticPaths ko 단일 + fallback:false로 바꾸면 CDN 캐시 가능(P3)
- lib/sitemap/routes.js:73,119 — KO_ONLY_PATH_PREFIXES를 `void`로만 참조하는 죽은 변수(P3)
- scripts/normalize-sitemap-hreflang.js:16-17 — hreflang.json의 uz가 이제 'uz'라 `uz_Latn_UZ` 치환 패턴은 죽은 로직이고 헤더 주석도 낡았다. 게이트(파일 존재 검사)만 남기면 된다(P3)
- middleware.ts:174-176 — matcher의 `llms-full.*\.txt`가 이미 제외하므로 llms-full-{ko,en,zh} 조기 반환은 도달 불가이고 주석('정확히 매칭하지 못해')은 사실과 다르다(P3)
- public/thumbnail.jpg — 로케일 매처에 안 걸려 /thumbnail.jpg가 307→/ko/thumbnail.jpg→404인 죽은 루트 파일. 스키마는 이미 og-default.jpg로 옮겼으니 삭제하거나 매처에 추가(P3)

### PERF. 성능·번들·서버 비용

P0 0 · P1 0 · P2 4 · P3 17, 미검증 0

이 축에서 터지는 것은 없다 — 7일 런타임 오류에 타임아웃 0건, PSI 모바일 92~96. 네 개의 P2는 전부 "같은 돈으로 더 빠르게"이고, 그중 PERF-1(함수 리전)이 나머지 셋의 지연 대부분을 설명한다. PERF-1을 먼저 하면 PERF-2·4의 숫자가 달라지므로 그 뒤에 재측정하고 손댄다.

#### PERF-1. 함수 리전 미지정(iad1 기본값) — 한국 사용자·토스·도쿄 Turso 모두에서 가장 먼 곳에서 돌아 동적 경로 TTFB가 2~10배 늘어난다 [P2 · S]

- **파일**: `vercel.json:1-4`
- **지금 코드**: `{ "github": { "silent": true }, "crons": [ ...` — 파일 47줄 어디에도 `regions` 키가 없다(HEAD·origin/main 모두, 과거 커밋에도 없음 — `git log -S regions`). Vercel `get_deployment`(최신 production `dpl_GUDMhJjs…`) 응답은 `"regions": ["iad1"]`. `turso db show studio-nol`은 `Locations: aws-ap-northeast-1`(도쿄), primary 단일 인스턴스. `TURSO_DATABASE_URL`은 `libsql://` 스킴이고 @libsql/client 0.17.4의 `@libsql/core/config.js:73-81`이 이를 `wss`(WebSocket)로 푼다.
- **왜 문제인가**: 모든 서버리스 함수(API·SSR·ISR 재생성·크론)가 기본 리전 iad1(버지니아)에서 돈다(프로덕션 `x-vercel-id: icn1::iad1::…` 실측). 한국 방문자는 서울 엣지(icn1)에 닿은 뒤 **요청 자체가** iad1까지 태평양을 건너갔다 오고(약 180ms RTT), 그 함수가 다시 도쿄 Turso에 **쿼리마다** 태평양 왕복을 한다. 콜드 스타트의 TLS+WS 핸드셰이크도 같은 거리를 건넌다. 이 저장소는 요청 안에서 쿼리를 직렬로 던지는 경로가 많다 — 펀딩 현황 6회(expireStalePledges 1 + aggregateProjectStatus 직렬 `db.all` 5), 예약 슬롯 2회+Google FreeBusy, 결제 확정 경로의 db await는 funding 7·booking 8·shows 18.
- **조건과 결과**: 실측(서울, 2026-10-10) — 정적 `/ko` HIT 65~70ms 대 DB 1왕복 API(`/api/bookings/slots` 400, batch 1회만 실행) 374~390ms → 요청 1건+DB 1왕복에 약 300ms가 붙는다. 슬롯 200은 0.56~0.85s(콜드 1.49s), 펀딩 현황 폴링 MISS는 세 번 모두 1.15s. 고객 퍼널(날짜 선택·모금 현황·결제 확정 success 페이지·공연 상세)이 전부 이 지연을 진다. 다만 깨지는 것은 없다 — 7일 런타임 오류 집계(`get_runtime_errors`)에 FUNCTION_INVOCATION_TIMEOUT 0건, 결제 웹훅·계약 서명·크론은 이미 `maxDuration: 60`. getServerSideProps 페이지만 maxDuration을 못 정하는데(`lib/payments/methodAlert.ts:34`) 실측 최악 1.2s는 어떤 기본 한도에도 멀다.
- **수정**:
  1. `vercel.json` 최상위에 `"regions": ["hnd1"]`을 추가한다. Vercel hnd1 = AWS ap-northeast-1 = Turso와 같은 리전이라 DB 왕복이 ~170ms→수 ms가 된다. icn1(서울)은 요청당 DB 왕복이 1회 이하일 때만 유리한데 이 저장소는 2~18회라 hnd1이 맞다. 코드 변경은 없다(iad1/hnd1/icn1 리터럴 의존 0건, CLAUDE.md 네 파일에 리전 결정·금지 없음).
  2. 배포 뒤 확인: `curl -sI 'https://studionol.co.kr/api/bookings/slots?date=2026-10-20' | grep x-vercel-id`가 `icn1::hnd1::…`이어야 한다. 위 세 실측(슬롯 400·슬롯 200·펀딩 현황 MISS)을 다시 재서 장부에 적는다.
  3. 이 변경은 빌드 한 번을 부르므로 CLAUDE.md 푸시 규칙대로 다음 사이클 푸시에 실어 보내고, 콘텐츠가 아니니 커밋 메시지에 `[skip-indexnow]`를 붙인다.
  4. `libsql://`→`https://` 전환(HTTP 전송)은 별개 실험이다 — 같은 리전이 되면 핸드셰이크 비용이 작아져 효과가 희미해지니 리전 이전 뒤에 재볼 것.
- **비고**: 검증자가 P1→P2로 내렸다 — 돈·데이터·법적 약속이 걸리거나 운영 사고가 나는 결함이 아니라 '분명한 개선'이다. 오히려 원 지적은 DB 왕복만 셌는데 요청 자체의 엣지→함수 왕복이 별도로 매번 붙으므로 hnd1 이전은 두 몫을 동시에 줄인다. 같은 자리를 다른 축(OPS 메일·크론·운영 알림)도 지적: 월 1회 파기 크론은 실패한 달에 다음 실행까지 한 달을 기다린다 (처리방침 '늦어도 한 달 안'을 넘길 수 있다).

#### PERF-2. 펀딩 현황 집계가 독립 쿼리 5개를 직렬 await한다 (후원 입력 페이지 SSR·상태 API 캐시 미스 경로). 상태 GET은 집계에 영향 없는 만료 UPDATE를 먼저 돌린다 [P2 · S]

- **파일**: `lib/funding/service.ts:374-455`(aggregateProjectStatus), `pages/api/funding/[slug]/status.ts:15`, `pages/[locale]/funding/[slug]/pledge.tsx:48-49`. 관련: `lib/funding/publicStatus.ts`, `pages/[locale]/funding/index.tsx`, `lib/funding/refundable.ts:72`, `lib/funding/admin-list.ts:128`, `pages/api/funding/pledges.ts:53`.
- **지금 코드**: `const totals = await db.all<...>(sql\`SELECT SUM(o.total_amount ...\`` (374) → `const claimed = await db.all<...>` (387) → `const names = await db.all<...>` (430) → `const listable = await db.all<...>` (442) → `const anonymousMessageRows = await db.all<...>` (455). 다섯 쿼리 모두 입력이 `project.slug`뿐이고 서로의 결과를 쓰지 않는다. 호출부 `status.ts:15`는 `await expireStalePledges(now);` 뒤에 `buildPublicStatus`를 부르고, `pledge.tsx:48-49`도 `await expireStalePledges(now); const status = await aggregateProjectStatus(project, now);`를 직렬로 돈다(이 GSSP는 `res.setHeader('Cache-Control', 'no-store')`).
- **왜 문제인가**: 왕복 1회가 약 0.16초(함수 iad1 ↔ Turso 도쿄 — `/ko/booking` 허브 순차 왕복 4회 0.9초 vs DB 없는 `/ko/booking/recording` 0.27초로 역산)라 5+1 = 6왕복 ≈ 1초다. 이 합이 결제 퍼널 입구인 후원 입력 페이지(`pledge.tsx`, no-store)의 TTFB에 그대로 얹힌다. 상태 API는 `s-maxage=15, stale-while-revalidate=60`이라 대부분 stale을 즉시 받지만 캐시 미스마다 같은 비용을 낸다. 직렬이라 `backers`(totals)와 `listable`이 서로 다른 시점의 스냅샷이기도 하다(`anonymousBackerCount = backers - listable`). 부하 문제는 아니다 — `funding_pledges` 112행, DB 1.1MB. 지연은 거의 전부 대양 횡단 왕복이다. EXPLAIN QUERY PLAN상 expireStalePledges UPDATE는 `SCAN funding_pledges`지만 이 규모에선 무관하다.
- **조건과 결과**: 라이브 펀딩의 `/ko/funding/<slug>/pledge`를 열 때마다 약 1초 이상 대기. 상태 API 캐시 미스(15초 지나고 첫 요청)와 목록 ISR 재생성도 같은 비용.
- **수정**:
  1. `aggregateProjectStatus`의 쿼리 5개를 `await db.batch([db.all(sql\`...\`), db.all(sql\`...\`), ...])` 한 번으로 묶는다. 1왕복에 단일 스냅샷이라 `Promise.all`보다 낫다(backers/listable 시점 불일치도 사라진다). drizzle libsql batch는 SQLiteRaw를 받고 선례가 `lib/booking/service.ts:273`(expireStaleOrders)에 있다. 결과 배열 순서대로 `[totals, claimed, names, listable, anonymousMessageRows]`를 꺼내 나머지 로직은 그대로 둔다.
  2. `pages/api/funding/[slug]/status.ts:15`의 `await expireStalePledges(now)`를 뺀다. 집계는 `countedFundingPledgeSql()`(`refundable.ts:72`, status 기반)이고 `claimed`는 `hold_expires_at > now`를 직접 비교하므로 만료 UPDATE가 돌지 않아도 응답(`remaining` 포함)은 같다. **`service.ts`의 공용 `expireStalePledges`에 모듈 스코프 throttle을 넣지 말 것** — `pledges.ts:53`과 `admin-list.ts:128` 주석이 "호출 직후 최신 상태"를 전제한다. 별도 크론도 필요 없다(`expire-show-orders`는 공연 전용, 하루 1회).
  3. `pledge.tsx:48`의 `expireStalePledges` 호출도 같은 이유로 뺄 수 있는지 확인한다 — 이 페이지는 `status.remaining`만 쓰므로(pledgeable 판정) 2와 같은 근거로 제거 가능하다. 확인 뒤 제거.
  4. 회귀 테스트: 기존 `aggregateProjectStatus` 테스트가 있으면 batch 결과 순서 바뀜을 잡도록 `backers`·`listable`·`anonymousBackerCount`를 함께 단언한다. status API 테스트에서 `expireStalePledges` mock 호출 기대를 지운다.
  5. 근본 완화는 PERF-1(hnd1 이전)이다. DB를 쓰는 모든 SSR/API에 같은 이득이 있으므로 PERF-1을 먼저 하고 이 항목은 그 뒤 재측정해 1·2만 해도 된다.
- **비고**: 검증자 조정 — 상태 API 영향은 SWR 덕에 과장이고 실제 사용자가 기다리는 경로는 지적이 빠뜨린 `pledge.tsx:48-49`다. 만료 UPDATE는 집계에 영향 없음을 코드로 확인. 공용 함수에 throttle을 넣으라는 원 제안은 위험해서 뺐다.

#### PERF-3. 연습실 LP 클라이언트 번들에 7개 로케일 가격 사전 전체(91KB min, 약 30KB gz)가 실린다 [P2 · S]

- **파일**: `pages/[locale]/practice-room.tsx:26, 72-74`. 관련: `components/practice-room/RelatedGuidesSection.tsx:6`, `data/practiceRoomRelatedGuides.ts:2`, `data/pricing.ts`.
- **지금 코드**: `practice-room.tsx:26` `import { formatPriceAmount, getPricingData, PRACTICE_ROOM_HOURLY_PRICE_INCL } from '../../data/pricing';` → `72-74` 컴포넌트 본문에서 `const practiceRoomOffer = React.useMemo(() => getPricingData(locale).practiceRoomOffers[0], [locale]);`. `RelatedGuidesSection.tsx:6` `import { PRACTICE_ROOM_RELATED_GUIDES } from '../../data/practiceRoomRelatedGuides';`. esbuild 실측(charset utf8, minify, splitting): practice-room 페이지 청크 218KB 중 `data/pricing.ts` 91.5KB(gzip 29.8KB), `data/practiceRoomRelatedGuides.ts` 56.7KB(gzip 12.1KB).
- **왜 문제인가**: recording·voice-acting·wedding-song 등 다른 서비스 페이지는 `getStaticProps`에서 `getPricingData`를 호출해 props로 넘기는데, practice-room만 컴포넌트 본문에서 호출한다. 그래서 `data/pricing.ts`의 7개 로케일 인라인 사전(`t(locale, {ko, en, ...})` 구조)이 통째로 클라이언트 JS가 된다. 실제로 쓰는 값은 `practiceRoomOffers[0]` 하나다. 상수만 임포트하는 형태로 바꾸면 pricing 기여는 315B로 준다(tree-shake 확인). 이 페이지는 최대 전환 페이지다(`lib/ops/leadRateCheck.ts` 머리 주석 WATCHED_PAGES, CLAUDE.md).
- **조건과 결과**: 모든 로케일의 `/practice-room` 방문에서 JS 약 30KB gz(다운로드·파싱·실행·하이드레이션)가 불필요하게 늘어난다. 현재 PSI 모바일 95라 긴급하지는 않다.
- **수정**:
  1. `practice-room.tsx`의 `getStaticProps`에서 `const practiceRoomOffer = getPricingData(locale).practiceRoomOffers[0];`을 계산해 props에 싣는다(`PracticeRoomProps`에 `practiceRoomOffer` 추가). 컴포넌트는 props에서 받고 26행 import에서 `getPricingData`를 지운다 — `formatPriceAmount`·`PRACTICE_ROOM_HOURLY_PRICE_INCL` 상수만 남긴다.
  2. `data/practiceRoomRelatedGuides.ts:2` 주석 "서버사이드에서만 렌더되어 HTML 문자열로 주입되므로 React 하이드레이션 비용이 0"을 사실에 맞게 고친다 — `RelatedGuidesSection`이 일반 React 컴포넌트로 직접 import해 클라이언트에서 하이드레이션한다(PERF-18과 같은 건).
  3. **guides는 props로 되돌리지 않는다.** `2563a910fb`가 "relatedGuides는 더 이상 props로 왕복하지 않는다. 같은 데이터가 이미 SSR된 `<a>` 태그로 HTML에 있어 `__NEXT_DATA__` 재전송이 불필요했다"며 직접 임포트로 확정했고, ko에서는 JS 12KB gz 대신 `__NEXT_DATA__` 12KB로 자리만 바뀌어 이득이 없다. `dynamic(..., {ssr:true})` 분리도 쓰지 않는다 — Next가 하이드레이션 전에 preload하므로 여전히 크리티컬 경로이고, `ssr:false`는 SEO 링크를 HTML에서 없앤다. 비-ko 로케일에서 guides를 빼고 싶다면 ko일 때만 gSP가 dynamic import한 데이터를 props로 싣는 방식이 있지만 ko 트래픽에는 변화가 없어 우선순위가 낮다.
  4. 확인: `npm run build` 뒤 `.next/static/chunks/pages/[locale]/practice-room-*.js` 크기가 약 90KB(min) 줄었는지 본다. `data/pricing.test.ts`(가격 드리프트 가드)는 건드리지 않는다.
- **비고**: 검증자 조정 — pricing 부분은 확실하고 기존 패턴과 일치하나, 원 지적의 guides props 복귀·dynamic ssr:true 제안은 기존 결정과 충돌하거나 성립하지 않아 뺐다.

#### PERF-4. 예약 허브·예약 마법사 gSSP가 Cache-Control 없이 방문마다 함수(+DB)를 실행한다 (허브 TTFB 0.9초 vs CDN 0.06초) [P2 · S]

- **파일**: `pages/[locale]/booking/index.tsx:196-199`(+ `loadHubShows` 201~), `pages/[locale]/booking/[service].tsx:37`. 비교 선례: `pages/[locale]/shows/index.tsx:91`. 관련: `lib/shows/queries.ts:294`(listPublicShows).
- **지금 코드**: `booking/index.tsx:196` `export const getServerSideProps = withI18nServerProps<BookingHubProps>(async ({ params }) => { if (params?.locale !== 'ko') return { redirect: ... }; return { props: { groups: buildBookingHub(), shows: await loadHubShows() } }; });` — `res`를 받지도 않고 `setHeader`도 없다. `loadHubShows`는 `try { ... listPublicShows(now) ... } catch`에서 실패 시 빈 배열로 삼킨다. `booking/[service].tsx:37` `getServerSideProps = withI18nServerProps<BookingPageProps>(async ({ params, query }) => ...)` — DB 없이 상수(`productsForService`, `getMixingProduct`)와 쿼리스트링만 읽는다. 반면 `shows/index.tsx:91`은 `res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');`를 두고 catch에서 `no-store`로 되돌린다.
- **왜 문제인가**: gSSP 기본 응답은 `private, no-cache, no-store`라 `/ko/booking`(listPublicShows: shows 조회 → getPublicShowBySlug findFirst → Promise.all 3개 → loadUsedBy, 순차 왕복 약 4회)과 `/ko/booking/[service]`가 요청마다 람다로 돈다. 함수 iad1·DB 도쿄라 왕복당 약 0.16초.
- **조건과 결과**: 실측 `/ko/booking` TTFB 0.90초(3회 0.897·0.900·0.908, `x-vercel-cache: MISS`), `/ko/booking/recording` 0.27초. `shows/index`와 `practice-room`은 HIT에 0.06초. 예약 퍼널 진입 화면 두 개가 CDN보다 4~15배 느리다. 이 경로를 막는 규칙은 없다 — `PRIVATE_ROUTE_BODIES`·noStoreHeaders 테스트에 booking 루트·[service]는 없고(booking/(success|fail)·booking/manage만), 캐시를 의도적으로 뺀 기록도 없다(`git log -S Cache-Control` 두 파일 0건).
- **수정**:
  1. `booking/index.tsx`: gSSP 시그니처에 `res`를 추가하고 ko 리다이렉트 검사 뒤에 `res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');`를 둔다. **`loadHubShows`가 실패했을 때는 빈 목록이 30~90초 캐시되지 않게 `no-store`로 되돌려야 한다** — `loadHubShows`가 `{ shows, ok }`를 반환하게 바꾸거나 catch에서 `res.setHeader('Cache-Control', 'no-store')`를 호출할 수 있도록 `res`를 넘긴다(`shows/index.tsx`의 catch 패턴 그대로).
  2. `booking/[service].tsx`: 서비스가 유효해 props를 돌려주는 분기에서만 `res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')`를 추가한다. CDN 키에 `?product=` 쿼리가 포함되므로 `initialProductId` 분기는 안전하다. `notFound`·리다이렉트 응답에는 붙이지 않는다.
  3. `getStaticPaths+getStaticProps` 전환은 하지 않는다 — `router.query` 기반 `initialProductId`가 첫 렌더에서 비어 하이드레이션·깜빡임 위험이 있다.
  4. 배포 뒤 `curl -D - -o /dev/null https://studionol.co.kr/ko/booking`과 `/ko/booking/recording`의 `x-vercel-cache`가 두 번째 요청부터 HIT인지 확인한다.
  5. 회귀 테스트: `tests/`의 noStoreHeaders 계열에 "booking 루트·[service]는 공개 캐시 허용"이 아니라, 반대로 `booking/manage`·`success`·`fail`이 여전히 no-store인지 보는 기존 테스트가 통과하는지만 확인한다.
- **비고**: 검증자 조정 — 원 지적의 출처 `lib/shows/queries.ts:93-196`은 getPublicShowBySlug이고 목록은 294행 listPublicShows다. DB 장애 시 빈 목록 캐시 가드(1번)는 원 지적에 없던 필수 연쇄 지점이다. 근본 완화는 PERF-1.

#### PERF-5. 스토리 전수 파싱(getAllStories)이 ISR/RSS/llms 경로에 남아 있다 (콜드 인스턴스당 약 0.35초, 사용자 대기 없음) [P3 · M]

- **파일**: `pages/[locale]/stories/index.tsx:377-379`, `pages/[locale]/stories/category/[key].tsx:311`, `pages/[locale]/guides/[slug].tsx:90`, `lib/portfolioRelatedStories.ts:34`, `pages/api/rss.ts:55-56`, `pages/api/llms.ts:565·582`, `pages/api/llms-full.ts:115`. 선행 작업 대상: `lib/sitemap/thinContent.js`(SHORTCODE_CHAR_ESTIMATES), `lib/storyContentPolicy.ts`, `lib/stories.ts`.
- **지금 코드**: `const fullStories = getAllStories(locale).filter((story) => isBrowsableStoryForLocale(story, locale));`(stories/index). `lib/portfolioRelatedStories.ts:34` `const all = getAllStories(targetLocale);`. `rss.ts:55-56` `getAllStories(locale).filter(... getStoryAvailableLocales(story.slug) ...).slice(0, 50)`.
- **왜 문제인가**: 실측(NODE_ENV=production tsx) `getAllStories('ko')` 175.6ms + `isBrowsableStoryForLocale` 필터 167.5ms ≈ 340ms인데, 같은 정보를 담은 빌드 산출물 `getStoryListing('ko')`은 6.2ms다. 다만 남은 호출부는 사용자가 기다리는 경로가 아니다 — stories/index(revalidate 1800)·category(3600)·guides(86400)·portfolio는 getStaticProps라 재생성 중에도 stale이 즉시 나가고, rss/llms는 CDN 캐시 응답이다. `allStoriesCache`가 인스턴스에 남아 웜일 때 0.02ms. 번들 크기에도 영향 없다 — content/stories가 함수 번들에 묶이는 원인은 `stories/[id]`의 `getStoryDetail`이 .md를 직접 읽기 때문이지 getAllStories 호출 때문이 아니다.
- **조건과 결과**: 콜드 람다당 한 번 약 0.35초의 백그라운드 CPU. 사용자 체감 거의 없음. **단, 지금 그대로 교체하면 결과가 달라진다** — ko에서 runtime(getAllStories+isBrowsable) 1037건, listing browsable 1036건. 차이는 `practice-room-repertoire1` 하나로, `lib/sitemap/thinContent.js`의 `SHORTCODE_CHAR_ESTIMATES`가 낡아(session-checklist 420인데 TS는 160, studio-more·studio-services 등 5종 누락) 생성기가 studio-more 232자를 못 세서 listing/사이트맵에서는 thin, 런타임에서는 색인 대상으로 갈린다.
- **수정**:
  1. 선행 ①: `lib/sitemap/thinContent.js`의 `SHORTCODE_CHAR_ESTIMATES`를 `lib/storyContentPolicy.ts`와 같게 맞추고(이상적으로는 한 JSON 정본을 두 곳이 읽게) 사이트맵·listing 생성기를 재실행한다. `practice-room-repertoire1`의 thin 판정이 양쪽에서 같아지는지 확인한다.
  2. 선행 ②: "listing browsable == getAllStories+isBrowsableStoryForLocale"을 7로케일 전수로 비교하는 테스트를 `lib/stories.test.ts` 옆에 추가한다(지금은 없다 — 있는 것은 산출물 최신 여부만 보는 `lib/storyListing.check.test.js`뿐).
  3. 그다음 교체: `rss.ts`·`llms.ts`·`llms-full.ts`는 `getStoryListing(locale).filter(s => s.browsable).slice(0, 50)`로, stories 목록·카테고리·`portfolioRelatedStories`는 같은 방식으로. `guides/[slug].tsx`는 `hub.relatedStorySlugs` 6개만 필요하므로 listing에서 slug→항목 Map을 만들어 조회한다.
  4. 우선순위는 낮다. PERF-13(revalidate 연장)을 하면 재생성 자체가 드물어져 이 비용도 함께 준다.
- **비고**: 검증자 조정 — 원 지적의 "[이전 리뷰 미처리]"는 사실이 아니다. `docs/code-review-2026-08-24.md` 7번은 런타임 경로 2곳(catalog.ts, getRelatedStories)만 지적했고 둘 다 `90fc72e449`에서 옮겨졌다. "번들 19MB 원인"·"lib/stories.test.ts가 정확성을 지킨다"도 틀렸다.

#### PERF-6. /admin 첫 화면(콜드)과 크론이 쓰지도 않는 googleapis 전체를 최상위 임포트로 로드한다 (약 0.6초, +110MB) [P3 · S]

- **파일**: `lib/ops/leadRateCheck.ts:19, 95-109`, `lib/seo/gscAudit.ts:9`, `lib/ops/healthCheck.ts:21, 1085`, `lib/ops/adminDashboard.ts:6`, `pages/admin/index.tsx:19`, `package.json:116`.
- **지금 코드**: `leadRateCheck.ts:19` `import { google, analyticsdata_v1beta } from 'googleapis';` → `95` `const createGa4Client = (env) => { const oauth2 = new google.auth.OAuth2(...); ... const analyticsdata = google.analyticsdata({ version: 'v1beta', auth: oauth2 }); return { async runReport(...) {...} }; }`. `gscAudit.ts:9` `import { google } from 'googleapis';`. 체인: `pages/admin/index.tsx:19` `import { loadAdminDashboard }` → `adminDashboard.ts:6` `import { collectDbIssues, type HealthIssue } from './healthCheck'`(값 임포트) → `healthCheck.ts:21` `import { runLeadRateCheck } from './leadRateCheck'` → googleapis. `package.json:116` `"googleapis": "^171.4.0"`은 devDependencies.
- **왜 문제인가**: `runLeadRateCheck`는 `healthCheck.ts:1085`의 `runHealthCheck`(크론)에서만 호출되고 `/admin`이 쓰는 `collectDbIssues`는 부르지 않는다. 그런데도 모듈 로드 시점에 googleapis 전체가 올라온다. 실측 `require('googleapis')` 617ms·RSS +110MB, 필요한 두 API만 서브패스로 부르면 52ms·+16MB. 런타임 코드가 쓰는 패키지가 devDependencies에 있는 점도 어긋난다(Vercel이 devDeps를 설치해 지금은 동작).
- **조건과 결과**: 운영자 1명이 콜드 상태에서 `/admin`을 열 때 약 0.6초와 100MB 이상 메모리가 더 든다. health-check 크론(하루 1회 23:00)·gsc-audit 크론(주 1회)은 어차피 쓰므로 영향 없음. 함수 크기 한도(250MB)에는 근접하지 않는다 — node_modules/googleapis 194MB 중 163MB가 .d.ts이고 .js는 35MB, nft가 추적하는 실제 추가분은 수십 MB 추정(실제 함수 크기 미확인).
- **수정**:
  1. `leadRateCheck.ts:19`를 `import type { analyticsdata_v1beta } from 'googleapis';`로 바꾼다. `createGa4Client`는 클라이언트 생성을 `runReport` 첫 호출로 미룬다:
     ```ts
     const createGa4Client = (env: LeadRateEnv): Ga4Client => {
       let analyticsdata: analyticsdata_v1beta.Analyticsdata | null = null;
       const getClient = async () => {
         if (analyticsdata) return analyticsdata;
         const { google } = await import('googleapis');
         const oauth2 = new google.auth.OAuth2(env.GSC_OAUTH_CLIENT_ID, env.GSC_OAUTH_CLIENT_SECRET);
         oauth2.setCredentials({ refresh_token: env.GA4_OAUTH_REFRESH_TOKEN });
         analyticsdata = google.analyticsdata({ version: 'v1beta', auth: oauth2 });
         return analyticsdata;
       };
       return { async runReport(propertyId, requestBody) { const c = await getClient(); const res = await c.properties.runReport({ property: `properties/${propertyId}`, requestBody }); return res.data; } };
     };
     ```
  2. `gscAudit.ts`의 `fetchGscPageMetrics`(이미 async)도 함수 안에서 `const { google } = await import('googleapis')`로 바꾸고 9행 import를 type-only로 줄인다.
  3. `leadRateCheck.test.ts`·`gscAudit.test.ts`가 `googleapis`를 `jest.mock`으로 잡고 있는지 확인한다 — 동적 import도 같은 mock을 탄다. `clientFactory` 주입(192행)으로 테스트가 실제 googleapis를 안 건드린다면 변경 없음.
  4. @googleapis/* 단독 패키지 교체는 이득 대비 작업이 커서 하지 않는다(지연 임포트만으로 /admin 비용은 0). googleapis를 dependencies로 옮기는 것은 별개 정리이며 락파일은 `npx -y npm@10 install --package-lock-only` → `npx -y npm@10 ci --dry-run`(CLAUDE.md 규칙).
- **비고**: 검증자 조정 — 원 지적의 "함수 번들 +194MB, 250MB 한도 근접"은 근거가 약해 뺐다. `adminDashboard.ts` 머리 주석 '외부 호출 없음'은 호출만 안 한다는 뜻이라 어긋나지 않는다.

#### PERF-7. 스토리 본문 가격 카드(InlinePriceCallout) 청크가 7개 로케일 가격 사전과 허브 사전(약 38KB gz)을 끌어온다 [P3 · M]

- **파일**: `components/inline/InlinePriceCallout.tsx:6, 8, 37`, `components/MarkdownRenderer.tsx:26`, `pages/[locale]/stories/[id].tsx`(getStaticProps), `data/pricing.ts`, `data/buyerIntentHubs.ts`.
- **지금 코드**: `import { getPricingData } from '../../data/pricing';`(6), `import { buyerIntentHubs } from '../../data/buyerIntentHubs';`(8), `const pricingData = React.useMemo(() => getPricingData(locale), [locale]);`(37). `MarkdownRenderer.tsx:26` `const InlinePriceCallout = dynamic(() => import('./inline/InlinePriceCallout'));`. esbuild 실측: 이 청크 164.9KB min·53.3KB gz, 그중 `data/pricing.ts` 91.5KB(30.5KB gz)·`buyerIntentHubs.ts` 21.7KB(7.7KB gz). 같은 스토리 페이지의 다른 가격 소비자(StoryCTA·VocalMixBridge·PracticeRoomTerms·InlineServiceCallout)는 상수만 임포트해 tree-shake되므로 이 청크가 유일한 `getPricingData` 소비자다.
- **왜 문제인가**: 카드는 id 하나의 패키지만 쓰는데 7개 로케일 사전 전량과 허브 사전을 받는다. `content/cta-routing.baseline.json` 1,582건 중 가격 카드 id가 있는 글은 708건(약 45%, 그중 recording-pro 618).
- **조건과 결과**: 해당 스토리 페이지에서 하이드레이션 전에 약 38KB gz를 추가로 받는다. SSR 본문에 카드는 이미 있어 첫 렌더는 막지 않고 하이드레이션만 청크 도착을 기다린다. PSI 스토리 94라 긴급하지 않다.
- **수정**:
  1. `stories/[id].tsx`의 `getStaticProps`에서 `story.content`의 `%%price:ID%%` 마커를 정규식으로 읽어 해당 패키지(와 `hubFallback`)만 `props.inlinePrice`로 싣는다.
  2. `MarkdownRenderer`가 React context(또는 prop)로 `InlinePriceCallout`에 그 데이터를 내리고, 컴포넌트는 `data/pricing`·`buyerIntentHubs`를 임포트하지 않는다.
  3. 로케일별 모듈 분할은 하지 않는다 — `data/pricing.ts`가 `t(locale, {ko, en, ...})` 인라인 사전 구조라 전면 재작성이고 `data/pricing.test.ts` 가격 드리프트 가드와 충돌한다.
  4. 순서: PERF-3(practice-room, 단일 호출 지점)을 먼저 처리하고 이 건은 다음 번들 작업에 묶는다. PERF-14(autoLinks)와 같은 `buyerIntentHubs` 모듈을 건드리므로 함께 하면 좋다.
- **비고**: 검증자가 P2→P3로 내렸다 — "대부분의 글"은 과장(45%)이고 lazy 청크라 첫 렌더를 막지 않으며 수정 비용이 이득에 비해 크다. 방향은 맞다.

#### PERF-8. 주문·예약·펀딩 표에 보조 인덱스가 없다 (현재 행 수 100~150 수준이라 영향 없음, 성장 대비 항목) [P3 · M]

- **파일**: `db/schema.ts:292-327`(orders)·`329-348`(payments)·`350-359`(refunds)·`361~`(bookings)·`477~`(funding_pledges). 사용처: `lib/booking/service.ts`(expireStaleOrders), `lib/funding/service.ts:320`(expireStalePledges), `pages/api/bookings/slots.ts:49`.
- **지금 코드**: 위 테이블 정의에 index 콜백이 없다. 마이그레이션에 있는 보조 인덱스는 privacy_access_logs·review_requests·funding_pledge_items·show_* 뿐. 운영 DB `sqlite_master` 조회: orders(order_no·manage_token unique), payments(payment_key unique), funding_pledges(order_id unique) 외 없음. `lib/funding/service.ts` 주석도 "`refunds.payment_id`·`payments.order_id`에는 인덱스가 없어서"라 적어 두었다. `slots.ts:49`는 요청마다 `expireStaleOrders`(`UPDATE orders ... WHERE status = 'pending' AND ((type = 'session' AND created_at < ?) ...`, 이미 db.batch 1왕복)를 부른다. EXPLAIN QUERY PLAN: expireStalePledges UPDATE는 `SCAN funding_pledges`.
- **왜 문제인가**: status·created_at·project_slug·hold_expires_at 조건의 만료 정리·집계가 전체 스캔이다. 행이 수만 단위가 되면 선형으로 늘어난다.
- **조건과 결과**: 지금은 무시할 수준 — 운영 DB 행 수 orders 142, bookings 21, payments 67, refunds 4, funding_pledges 112, work_orders 4, DB 1.1MB. 이 규모의 전체 스캔은 마이크로~밀리초이고 행 읽기 과금도 요청당 수백 행.
- **수정**:
  1. 지금 마이그레이션을 만들지 않는다. 이 저장소에서 인덱스 추가 비용은 작지 않다 — CI가 적용하지 않고 운영자가 Turso CLI로 수동 적용하며 `when` 최댓값 함정(CLAUDE.md)이 있다.
  2. 트리거: 주문·후원 행 수가 1만 단위에 가까워지거나 슬롯·상태 API 응답이 느려지는 시점. health-check에 표 행 수 감시(예: orders·funding_pledges > 5,000이면 안내)를 얹어도 된다.
  3. 그때 `orders(status, type, created_at)`, `funding_pledges(project_slug)`, `bookings(status, created_at)` 정도로 좁혀 `EXPLAIN QUERY PLAN`으로 SCAN→SEARCH를 확인한 뒤 추가한다. work_orders·refunds는 행이 4개라 당분간 불필요.
  4. 펀딩 만료 UPDATE는 인덱스보다 PERF-2의 "GET 경로 호출 자체를 줄이기"가 먼저다.
- **비고**: 검증자 조정 — 원 지적의 6~7개 선제 인덱스 제안을 "데이터가 쌓이는 시점에 좁혀서"로 바꿨다.

#### PERF-9. _app의 reducedMotion state가 데스크톱에서 하이드레이션 직후 페이지 전체를 한 번 더 렌더한다 [P3 · S]

- **파일**: `pages/_app.tsx:73-87, 374-399`.
- **지금 코드**: `79` `const [reducedMotion, setReducedMotion] = useState<'user' | 'always'>('always');` → `80-87` `useEffect(() => { const mq = window.matchMedia('(hover: none) and (pointer: coarse)'); const update = () => setReducedMotion(mq.matches ? 'always' : 'user'); update(); mq.addEventListener('change', update); ... }, []);`. 이 state가 `StudioNoriApp` 본문에 있고, `374-399`에서 `<MotionConfig reducedMotion={reducedMotion}>` → `<GlobalPlayerProvider>` → `<Layout>` → `<div key=…><Component {...pageProps} /></div>`가 모두 같은 함수 본문에서 만들어진다. 73-78행 주석이 SSR 초기값 'always'의 이유(모바일 첫 paint 깜빡임 방지)를 적어 두었다.
- **왜 문제인가**: hover 가능한 데스크톱에서는 마운트 직후 'always'→'user'로 바뀌어 `_app`이 다시 렌더되고, 매 렌더마다 `<Component {...pageProps} />`가 새 엘리먼트라 페이지 전체 트리가 재조정된다 — MotionConfig 값만 바뀌는 비용이 아니다. `_app`의 다른 setState(`setIsLocaleReady`, 233·257행)는 마운트 시 같은 값이라 바뀌지 않으므로 이 전환이 데스크톱의 유일한 추가 렌더다. 터치 기기는 값이 안 바뀌어 재렌더가 없다.
- **조건과 결과**: 데스크톱 모든 페이지에서 하이드레이션 + 전체 재렌더 1회분의 메인스레드 시간(긴 스토리 페이지일수록 큼). CLAUDE.md 실측 데스크톱 홈 TBT 0ms라 체감은 작다.
- **수정**: state와 effect를 작은 컴포넌트로 분리한다.
  ```tsx
  const MotionGate = ({ children }: { children: React.ReactNode }) => {
    const [rm, setRm] = useState<'user' | 'always'>('always');
    useEffect(() => { /* 80-87행 그대로 */ }, []);
    return <MotionConfig reducedMotion={rm}>{children}</MotionConfig>;
  };
  ```
  `_app`에서는 79-87행을 지우고 `<MotionConfig reducedMotion={reducedMotion}>` 자리를 `<MotionGate>`로 바꾼다. children 엘리먼트 정체성이 유지되므로 MotionGate가 다시 렌더돼도 페이지 트리는 건너뛴다. 73-78행 주석은 MotionGate 위로 옮긴다. SSR 초기값 'always' 설계는 그대로 보존된다.
- **비고**: 검증 확인(confirmed). origin/main에서도 이 부분은 바뀌지 않았다.

#### PERF-10. 포트폴리오 상세가 245장 전부 프리렌더인데 네이티브 본문은 64장뿐이다(스토리에서 이미 고친 곱집합 패턴) [P3 · S]

- **파일**: `pages/[locale]/portfolio/[id].tsx:244-253`(getStaticPaths), `92-98`(shouldNoindex). 참고: `next-sitemap.config.js:337-338`, `lib/stories.ts`(getStoryPaths), `lib/stories.test.ts`.
- **지금 코드**: `const items = getPortfolioItems(defaultLocale); items.forEach((item) => { locales.forEach((locale) => { paths.push({ params: { locale, id: item.id } }); }); }); return { paths, fallback: 'blocking' };`. 실측(npx tsx `getPortfolioItems('ko')`): 항목 35개, `productionNotes` 키는 ko 32·en 32뿐(zh·es·vi·th·uz는 0). 나머지는 `shouldNoindex = isThinPortfolio || isFallbackTranslation`으로 noindex.
- **왜 문제인가**: CLAUDE.md "스토리 프리렌더는 번역이 있는 로케일만" 규칙과 같은 구조다. 245장 중 네이티브 본문이 있는 조합은 64장이고 181장은 색인되지 않는 폴백인데 빌드 때마다 만들고 revalidate 3600으로 재생성된다. 각 페이지가 `getPortfolioRelatedStories`→`getAllStories`(PERF-5)도 부른다. `next-sitemap.config.js:337-338`이 이미 같은 조합을 제외하므로 색인 정책과 충돌하지 않는다.
- **조건과 결과**: 빌드 시간 약 1~2초(Vercel 로그에서 1763장 생성이 약 16초)와 ISR 캐시 항목 약 180개. `fallback: 'blocking'`이라 빼도 첫 요청에 생성돼 사용자 결과는 같다.
- **수정**:
  1. `getStaticPaths`에서 `item.productionNotes?.[locale]`가 있는 조합만 `paths`에 넣는다(`getStoryPaths`와 같은 규칙). 폴백 조합은 `fallback: 'blocking'`이 처리한다.
  2. `lib/stories.test.ts`의 "원문 없는 조합이 목록에 없다"와 같은 테스트를 portfolio `getStaticPaths`에 하나 둔다(지금은 없다).
- **비고**: 검증 확인(confirmed). 이득은 작지만 위험도 낮다.

#### PERF-11. 카드 이미지에 sizes가 없어 데스크톱 1~3열 카드가 100vw 기준(1536~1920w)을 받는다 [P3 · S]

- **파일**: `components/shows/ShowCard.tsx:34-40`, `components/funding/FundingProjectCard.tsx:61`, `components/funding/RewardCard.tsx:41`, `components/funding/RewardModal.tsx:153`, 기본값 `components/ResponsiveImage.tsx:44`. 그리드 폭 근거: `pages/[locale]/shows/index.tsx:27`, `pages/[locale]/funding/index.tsx:41`(gridColumns), `components/funding/ProjectDetailView.tsx:162`.
- **지금 코드**: `ShowCard.tsx:34` `<ResponsiveImage src={show.coverImage} alt="" containerClassName="relative block aspect-[3/4] w-full overflow-hidden" className="object-cover" loading="lazy" />` — `sizes` 없음. 나머지 세 곳도 같다. `ResponsiveImage.tsx:44` fill 모드 기본값 `sizes = '100vw'`.
- **왜 문제인가**: 폭 약 384px 카드가 뷰포트 폭 후보를 고른다. 운영 `/ko/funding`에서 카드가 `sizes="100vw"`, `w=1920`(94KB)으로 나가는 것을 확인했고 같은 커버를 `/_next/image`로 받으면 1536w 58KB·1024w 29KB·768w 17KB다. 개설자 업로드(`isFundingMediaUrl`)는 unoptimized라 영향 없음.
- **조건과 결과**: 공연·펀딩 목록 데스크톱에서 카드당 약 40~77KB, 카드 3~4장이면 0.15~0.3MB 낭비. 모바일은 100vw가 맞아 영향 없음.
- **수정**:
  - `ShowCard`·`FundingProjectCard`: `sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"`.
  - `RewardCard`: 3열 그리드가 아니라 `ProjectDetailView.tsx:162`의 `lg:grid-cols-[minmax(0,1fr)_22rem]` 오른쪽 패널(lg 이상 352px, lg 미만은 단일 열 컨테이너 전체 폭)이므로 `sizes="(min-width: 1024px) 352px, 100vw"`. `(max-width: 1024px) 50vw`를 쓰면 태블릿에서 2배 늘려 그려져 흐려진다.
  - `RewardModal`(max-w-2xl, 본문 패딩 포함 약 624px): `sizes="(max-width: 640px) 100vw, 640px"`.
  - `ResponsiveImage` 기본값은 바꾸지 않는다(개발 모드 경고 추가도 과잉).
  - 배포 뒤 `/ko/funding`·`/ko/shows` 데스크톱에서 `<img srcset>`의 선택 폭이 400~768w로 떨어지는지 DevTools로 확인한다.
- **비고**: 검증자 조정 — 원 지적의 RewardCard sizes 값이 틀려 바로잡았다.

#### PERF-12. 모든 페이지의 dns-prefetch 11개 중 이미지 CDN 5개는 브라우저가 연결하지 않는 호스트다 [P3 · S]

- **파일**: `pages/_document.tsx:51-57`(+ 58-59행 주석).
- **지금 코드**: `{/* Portfolio image CDN prefetch */}` 아래 `<link rel="dns-prefetch" href="https://image.bugsm.co.kr" />`(52) · `i.ytimg.com`(53) · `is1-ssl.mzstatic.com`(54) · `img.tumblbug.com`(55) · `thumb.mt.co.kr`(56) · `cdn.imweb.me`(57).
- **왜 문제인가**: bugsm·mzstatic·tumblbug·mt.co.kr·imweb의 이미지는 `data/portfolio/items.ts`·`tracks.ts`·`audioExcerpts.ts`에서 오지만 전부 `ResponsiveImage`/`next/image`를 거쳐 `/_next/image`가 **서버에서** 받아 온다(`next.config.mjs images.remotePatterns`). 브라우저는 그 도메인에 접속하지 않는다. `<img` 직접 사용처 전수: FundingVideo(`i.ytimg.com`), PaymentMethodPicker(로컬), ImageUploadField(업로드), 관리자 2곳 — 5개 호스트를 직접 쓰는 곳은 없다. `PortfolioSampleTracks`의 albumArt도 `<Image>`.
- **조건과 결과**: 모든 페이지에서 쓸모없는 DNS 쿼리 5건(모바일 유휴 시간). 작다.
- **수정**:
  1. 52·54-57행 삭제(`image.bugsm.co.kr`·`is1-ssl.mzstatic.com`·`img.tumblbug.com`·`thumb.mt.co.kr`·`cdn.imweb.me`). 51행 주석도 함께 지운다.
  2. `i.ytimg.com`(53)은 펀딩 상세에서만 쓰이나 FundingVideo가 숏코드 안이라 Head로 옮기기 번거롭다 — 한 줄 그대로 두거나 같이 지우는 쪽이 단순하다.
  3. 58-59행 폰트 주석은 PERF-18에서 고친다.
- **비고**: 검증 확인(confirmed). ytimg 이동 부분만 "유지 또는 삭제"로 단순화했다.

#### PERF-13. 입력이 빌드 산출물뿐인 페이지에 revalidate 1800~3600이 걸려 있다 [P3 · S]

- **파일**: `pages/[locale]/stories/[id].tsx:415, 425`, `pages/[locale]/stories/index.tsx:407`, `pages/[locale]/stories/category/[key].tsx:344`, `pages/[locale]/index.tsx:453`, `pages/[locale]/portfolio.tsx:358`, `pages/[locale]/portfolio/[id].tsx:267, 279`. 참고: `lib/getStatic.ts:59-72`, `lib/stories.ts:200·205`.
- **지금 코드**: `stories/[id].tsx:415` `{ revalidate: 3600, i18nSections: ['stories'] }`, `425` `revalidate: 3600,`; `stories/index.tsx:407` `revalidate: 1800`; 나머지 `revalidate: 3600`. 이 페이지들의 getStaticProps는 `getStoryDetail`·`getRelatedStories`·`getPortfolioItems`와 `buildPageStaticProps`(i18n 번들 파일 읽기)뿐 — DB·네트워크·현재 시각이 없다. `lib/stories.ts`의 `new Date()`는 frontmatter date 누락 폴백(200·205행)뿐이다.
- **왜 문제인가**: 입력(content/stories md·lib/storyListing/*.json·data/*.ts)이 모두 배포와 함께 고정되는데 시간당 재생성이 돈다. 매 재생성은 같은 HTML을 만들고 ISR 쓰기·람다 호출(콜드면 PERF-5의 getAllStories 비용 포함)을 쓴다. 배포가 곧 ISR 캐시 초기화이므로 신선도 손실이 없다. voice-acting·pricing·recording 등 다수가 이미 86400을 쓴다.
- **조건과 결과**: 봇이 긴 꼬리 페이지(스토리 1,000+편)를 훑는 만큼 불필요한 람다 호출·ISR 쓰기·콜드 스타트가 반복된다. 금액은 월 $1~2 규모(CLAUDE.md).
- **수정**:
  1. 위 7곳의 `revalidate`를 `86400`으로 올리거나 제거한다. 제거하면 `stories/[id]`의 `notFound`(없는 slug)가 배포 수명 동안 캐시되는데 콘텐츠가 배포와 함께만 바뀌므로 문제없다.
  2. 결과가 시간에 따라 달라지는 release-project(`asOf`)는 그대로 둔다.
  3. date 누락 폴백(`lib/stories.ts:200`)이 있는 글은 revalidate가 날짜를 매시간 바꾸고 있었으므로 연장이 오히려 맞다.
- **비고**: 검증 확인(confirmed).

#### PERF-14. autoLinks가 buyerIntentHubs 전체를 정적 import해 스토리 초기 번들에 싣는다(가격 카드 청크와 중복 지연 효과) [P3 · S]

- **파일**: `components/markdown/autoLinks.ts:1-6`, `data/buyerIntentHubs.ts:555`, `components/inline/InlinePriceCallout.tsx:8`, `lib/stories.ts:369-420`.
- **지금 코드**: `import { MAX_AUTO_LINKS, topicLinks } from '../../data/internalLinks'; import { buyerIntentHubSlugs } from '../../data/buyerIntentHubs'; const HUB_SLUGS = new Set<string>(buyerIntentHubSlugs);`. `buyerIntentHubs.ts:555` `export const buyerIntentHubSlugs = Object.keys(buyerIntentHubs) as BuyerIntentHubSlug[];`. esbuild 실측 gzip: autoLinks 엔트리 12.0KB(buyerIntentHubs 7.7KB·internalLinks 4.4KB). `autoLinkKeywords` 실행 비용은 평균 1.6ms(최대 7.9ms)라 문제없다.
- **왜 문제인가**: 허브 슬러그 목록만 필요한데 허브 콘텐츠 전체가 MarkdownRenderer 정적 경로에 들어간다. 단, 같은 모듈을 `InlinePriceCallout` 지연 청크(`InlinePriceCallout.tsx:8`)가 값으로 import하고 `lib/stories.ts:369-420`의 자동 fallback이 ko 스토리 대부분에 가격 카드 마커를 주입하므로, 대부분의 ko 스토리에서 그 청크가 어차피 내려온다.
- **조건과 결과**: 총 전송량 절감은 비-ko 스토리·펀딩 페이지에 한정. ko 스토리는 약 8KB gz가 초기/공유 번들에서 지연 청크로 옮겨가는 효과(하이드레이션 전 파싱량 감소, TBT 소폭).
- **수정**:
  1. 슬러그 유니온 타입과 `as const` 튜플만 담은 `data/buyerIntentHubSlugs.ts`를 만든다. `buyerIntentHubs.ts`는 `Record<BuyerIntentHubSlug, ...>`를 그 타입으로 받게 해 키 불일치를 컴파일 단계에서 막는다(현재는 `Object.keys(buyerIntentHubs)`로 도출하므로 별도 목록이 어긋날 위험이 있어 타입 강제가 필수).
  2. `autoLinks.ts`는 새 파일만 import.
  3. 이득이 작으니 PERF-7과 묶어서 한다.
- **비고**: 검증자 조정 — "스토리 페이지 JS 8KB 추가"는 과장이고 실효는 번들 간 이동이다.

#### PERF-15. /audio/* mp3(36MB)에 Cache-Control 규칙이 없다(날짜 태그 파일은 immutable 가능) [P3 · S]

- **파일**: `next.config.mjs:224-232`(headers). 주석 정합: `components/audio/FundingAudioPlayer.tsx:25`, `data/mixCompare.ts:22`, `data/audioExcerpts.ts`.
- **지금 코드**: `headers()`에 `/images/:path*`·`/fonts/:path*`(immutable 1년)·`/scripts/:path*`·`/locales/:path*` 규칙만 있고 `/audio` 규칙이 없다. 마지막 `/:path*` 규칙은 Cache-Control을 건드리지 않는다. `public/audio`에는 `wave.mp3`·`sample1~3.mp3`(각 3~5MB)와 날짜 태그가 붙은 `mix-compare-*-20261001c*.mp3`·`excerpt-*-20261006.mp3`·`funding/*.mp3`가 있다. 운영 HEAD 실측: `wave.mp3`와 `mix-compare-after-20261001c.mp3` 모두 `cache-control: public, max-age=0, must-revalidate`, `x-vercel-cache: HIT, age: 761`.
- **왜 문제인가**: 날짜 태그 파일은 이미 "바꾸면 파일명도 바꾼다" 규칙(CLAUDE.md)을 따르는데 브라우저 캐시는 0초다. 반면 `FundingAudioPlayer.tsx:25`·`data/mixCompare.ts:22`·`data/audioExcerpts.ts` 주석은 "/audio도 오래 캐시된다"고 전제한다 — 규칙을 추가하면 주석이 사실이 된다.
- **조건과 결과**: 재방문·재생 때마다 엣지 조건부 요청(HIT 상태의 304). 원점 부하는 없고 대역폭 영향도 작다.
- **수정**:
  1. `headers()`의 `/images` 규칙 근처에 추가:
     ```js
     {
       source: '/audio/:file(.*-20\\d{6}[a-z]?.*\\.mp3)',
       headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
     },
     ```
     이 패턴은 next의 path-to-regexp를 통과하고 `/audio/funding/...-20261006.mp3`도 매칭된다. **`'/audio/(.*)-20[0-9]{6}[a-z]?(.*).mp3'` 형태는 `Unexpected MODIFIER at 27`로 파싱이 실패해 빌드가 깨지니 쓰지 말 것.**
  2. 날짜 없는 `wave`·`sample1~3`·`jai-fever`는 그대로 두거나 날짜를 붙여 옮긴 뒤 참조를 수정한다.
  3. 배포 후 `curl -I https://studionol.co.kr/audio/mix-compare-after-20261001c.mp3`로 `immutable`을 확인하고 `wave.mp3`는 그대로인지 본다.
- **비고**: 검증자 조정 — 원 제안의 source 패턴이 파싱 실패해 바로잡았고, "원점 검증 왕복"은 엣지 왕복으로 정정했다.

#### PERF-16. 참조 없는 추적 AVIF 58개(5.1MB)가 저장소에 남아 있다 [P3 · S]

- **파일**: `public/images/**/*.avif`(git 추적 58개), `.gitignore:31-32`, `docs/design-liner-notes-plan-2026-10.md:286`. 생성 스크립트의 `const GENERATE_AVIF = false; // true로 변경시 AVIF 생성`(10행).
- **지금 코드**: `git ls-files public/images` 기준 .avif 58개 5,170,656B, jpg/png 52개 14,253,697B, webp 132개. 코드 어디서도 `.avif`를 참조하지 않는다(next.config의 formats와 SEO.tsx MIME 분기뿐). `.gitignore:32`에 `public/images/**/*.avif`가 이미 있으나 과거 커밋(`e829171b80`)으로 추적 중이다.
- **왜 문제인가**: 렌더는 webp를 `next/image`가 변환하므로 AVIF 파일은 쓰이지 않는다. jpg/png는 prebuild의 webp 원본이라 삭제 대상이 **아니다** — `.webp`도 `.gitignore:31`에 걸려 있고(og-*만 예외), jpg/png 52개 중 14개(`mariko-yukie-*.jpg` 등)는 추적되는 .webp가 없어 prebuild가 jpg로 webp를 만든다. 지우면 404. `service6.jpg`는 추적되는 `service6.webp`(스토리 다수가 참조)의 원본이라 미참조가 아니다.
- **조건과 결과**: 저장소 클론 용량 약 5MB. 배포 업로드는 Vercel이 동일 해시 파일을 재업로드하지 않아 영향 거의 없음.
- **수정**:
  1. `git rm public/images/**/*.avif`(58개만, `--cached`가 아니라 실제 삭제). `.gitignore` 변경 없음.
  2. jpg/png는 유지.
  3. `docs/design-liner-notes-plan-2026-10.md:286`의 'AVIF + WebP 쌍' 규격 문구를 'WebP 단독(next/image가 변환)'으로 바로잡는다.
  4. 커밋 메시지에 `[skip-indexnow]`.
- **비고**: 검증자 조정 — 원 지적의 .gitignore 추가·jpg/png 정리 제안은 각각 불필요·위험해서 뺐다.

#### PERF-17. 프로덕션 webpack 캐시 비활성은 의도된 결정이며 이득 상한이 컴파일 22.6초(총 약 120초)로 작다 [P3 · S]

- **파일**: `next.config.mjs:114-120`.
- **지금 코드**: `webpack(config, { dev }) { if (!dev) { // The production filesystem cache serializes large generated server chunks and emits PackFileCacheStrategy warnings; clean CI/Vercel builds do not benefit enough ... config.cache = false;`. `ec5a6c5a44`(2026-06-10)에서 '경고 소음·직렬화 비용' 이유로 넣었다.
- **왜 문제인가**: 문제가 아니라 확인된 결정이다. 켜도 줄어드는 부분은 webpack 컴파일 단계뿐이다 — 최근 프로덕션 빌드 총 약 2분 중 'Compiled successfully in 22.6s'가 그 전부(린트·타입 17초, 정적 페이지 1763장 약 16초는 캐시 무관). 반대로 Vercel이 이미 297MB 빌드 캐시를 복원·업로드(업로드 5.8초)하는데 webpack 캐시를 켜면 그 크기와 복원 시간이 늘어난다.
- **조건과 결과**: 켜면 최대 수 초~10초대 절감 추정, 순이득 불확실.
- **수정**: 조치하지 않는다. 궁금하면 프리뷰 빌드 1회로 'Compiled successfully in'과 'Created build cache' 시간을 함께 비교한 뒤 결정한다.
- **비고**: 검증자 조정 — 원 지적이 "측정하지 못했다"고 한 상한을 Vercel 빌드 로그로 쟀다.

#### PERF-18. 문서와 코드가 어긋난 성능 설정 설명 3곳 [P3 · S]

- **파일**: `pages/_document.tsx:58-59`, `CLAUDE.md`(Next.js Experimental Flags 표), `data/practiceRoomRelatedGuides.ts:2`. 정본: `lib/fonts.ts`, `next.config.mjs:95-101`, `components/practice-room/RelatedGuidesSection.tsx:6·20`.
- **지금 코드**: ① `_document.tsx:58-59` `{/* 폰트 preload 제거: Slow 4G에서 1MB 폰트가 preload로 … font-display: swap 으로 시스템 폰트 즉시 렌더 → 폰트 도착 후 swap. FCP 대폭 단축. */}` — 실제 `lib/fonts.ts`는 pretendard `display: 'optional', preload: false`, displayFont `display: 'optional', preload: true`. ② CLAUDE.md는 `optimizePackageImports` '활성 (7개 라이브러리) … lucide-react'라 적지만 `next.config.mjs:95-101`은 5개(framer-motion·markdown-to-jsx·clsx·tailwind-merge·class-variance-authority) — lucide-react·react-i18next는 `ec5a6c5a44`에서 빠졌고 아이콘은 `@/lib/lucide-icons` 래퍼가 맡는다. ③ `practiceRoomRelatedGuides.ts:2` "서버사이드에서만 렌더되어 HTML 문자열로 주입되므로 React 하이드레이션 비용이 0" — `RelatedGuidesSection.tsx:6·20`이 일반 React 컴포넌트로 직접 import해 클라이언트에서 하이드레이션한다.
- **왜 문제인가**: CLAUDE.md가 "제목·본문 서체 모두 font-display: optional — swap으로 되돌리지 말 것"을 못 박았는데 `_document`의 주석은 swap이라고 말한다. 다음 사람이 주석을 믿고 swap으로 되돌릴 수 있다.
- **조건과 결과**: 설정 오해로 인한 회귀 위험. 코드 동작에는 영향 없음.
- **수정**:
  1. `_document.tsx:58-59` 주석을 "본문(Pretendard)은 preload 없음·`display: optional`, 제목(displayFont)만 preload·`display: optional`. swap으로 되돌리지 말 것(lib/fonts.ts·CLAUDE.md)"으로 고친다.
  2. CLAUDE.md의 개수를 5개로 맞추고 lucide-react는 래퍼(`lib/lucide-icons.ts`)가 대신한다고 적는다.
  3. `practiceRoomRelatedGuides.ts:2` 주석을 "RelatedGuidesSection이 직접 import하므로 클라이언트 번들·하이드레이션에 포함된다(2563a910fb 결정)"로 고친다(PERF-3의 2번과 같은 작업).
- **비고**: 검증 확인(confirmed).

#### PERF-19. 푸터 약관 링크 3개만 prefetch가 켜져 있다 [P3 · S]

- **파일**: `components/layout/Footer.tsx:73, 80, 88`(참고 18-22행).
- **지금 코드**: `FooterLink`(22행)는 `<Link href={href} prefetch={false} className={LINK_CLASS}>`인데, 하단의 `<Link href={`/${locale}/privacy-policy`} className=...>`(73)·`<Link href="/ko/terms" ...>`(80)·`<Link href="/ko/terms#refund" ...>`(88)에는 `prefetch` 속성이 없다. 파일 전체 `<Link`는 이 4개뿐이다.
- **왜 문제인가**: 18-20행 주석과 `fba9f4db6e` 커밋이 말하는 '푸터 링크 prefetch 비활성' 원칙에서 이 셋만 빠졌다. Pages Router 기본값은 프로덕션에서 뷰포트 진입 시 prefetch다.
- **조건과 결과**: 푸터는 전 페이지에 있고 짧은 페이지는 첫 화면에 들어오므로 개인정보처리방침·약관 페이지의 JS 청크와 `/_next/data` JSON을 불필요하게 받는다. 작다.
- **수정**: 세 `<Link>`에 `prefetch={false}`를 추가한다.
- **비고**: 검증 확인(confirmed). origin/main에서도 이 줄들은 바뀌지 않았다(bottomBarSpace 변경만).

#### PERF-20. GlobalPlayer 컨텍스트에 currentTime이 섞여 있어 재생 중 소비자가 초당 4번 리렌더된다 [P3 · S]

- **파일**: `components/audio/GlobalPlayerProvider.tsx:74, 170-173`. 소비자: `GlobalPlayerDock`, `CoverPlayButton`, `ServiceExcerpt`, `PortfolioSampleTracks`. 데이터: `data/audioExcerpts.ts`.
- **지금 코드**: `74` `el.addEventListener('timeupdate', () => setCurrentTime(el.currentTime));`. `170-173` `const value = React.useMemo<GlobalPlayerContextValue>(() => ({ track, status, currentTime, duration, play, pause, toggle, seek, close, isPlaying }), [track, status, currentTime, duration, play, pause, toggle, seek, close, isPlaying]);`.
- **왜 문제인가**: `CoverPlayButton`·`ServiceExcerpt`는 play/pause/isPlaying만 쓰는데 `currentTime`이 바뀔 때마다 컨텍스트 값이 새로 만들어져 같이 리렌더된다. children은 `_app`에서 만든 같은 엘리먼트라 Provider 재렌더가 트리 전체로 번지지는 않고 컨텍스트 소비자만 다시 그려진다.
- **조건과 결과**: 재생 중 초당 약 4회 소비자 리렌더. 지금은 `AUDIO_EXCERPTS`가 2곡(portfolioId 있는 것 1곡)이라 비용이 거의 0. 발췌가 늘면 홈·포트폴리오 그리드의 소비자 수만큼 늘어난다.
- **수정**: 시간 상태(`currentTime`·`duration`)를 별도 컨텍스트(`GlobalPlayerTimeContext`)로 분리하고 `GlobalPlayerDock`만 구독하게 한다. 제어 컨텍스트 `value`의 useMemo 의존성은 `[track, status, play, pause, toggle, seek, close, isPlaying]`만 남긴다(`isPlaying`은 이미 `[track, status]` 의존). 발췌가 늘어날 때 처리해도 된다.
- **비고**: 검증 확인(confirmed).

#### PERF-21. @types/qrcode가 dependencies에 있다(validator 클라이언트 번들 주장은 해당 없음) [P3 · S]

- **파일**: `package.json:10`(참고 104-110행 devDependencies). 확인 경로: `lib/contracts/validation.ts:1`, `components/admin/ContractForm.tsx:6`, `pages/admin/contracts/new.tsx:14`, `pages/admin/contracts/[id]/edit.tsx:15`, `lib/contact/payload.ts`, `lib/contact/rateLimit.ts`.
- **지금 코드**: `package.json:10` `"@types/qrcode": "^1.5.6"`이 dependencies에 있다(다른 @types는 104-110행 devDependencies). `lib/contracts/validation.ts:1` `import validator from 'validator';`는 전체 import이지만 클라이언트 쪽 세 파일은 모두 `import type { ValidationError }`라 컴파일 때 지워진다. validation.ts를 값으로 import하는 곳은 `pages/api/contracts/*` 서버 라우트뿐이고 `lib/contact/payload.ts`·`rateLimit.ts`도 API 라우트 전용이다.
- **왜 문제인가**: 타입 패키지 하나가 런타임 의존성으로 분류돼 있다. 2026-10-03 공연 예매 PR(`9c7eedbadf`)에서 들어간 사소한 실수. validator가 클라이언트 번들에 들어간다는 원 주장은 사실이 아니고, 서버리스 함수 크기 영향도 무시 가능(validator.min.js gzip 약 35KB).
- **조건과 결과**: 기능 영향 없음. 의존성 분류 정리.
- **수정**: `@types/qrcode`를 devDependencies로 옮기고, 락파일은 CLAUDE.md 규칙대로 `npx -y npm@10 install --package-lock-only`로 재생성한 뒤 `npx -y npm@10 ci --dry-run`으로 확인한다. validator 개별 import(`validator/lib/isEmail`) 전환은 불필요.
- **비고**: 검증자 조정 — 핵심 주장(validator 클라이언트 번들)이 반박돼 제목·내용을 @types/qrcode 건으로 좁혔다.

**클린 판정**
- getStaticProps 직렬화 크기: 홈 13KB·가격 20KB·녹음 22KB·믹싱 24KB·포트폴리오 목록 47KB·스토리 상세 13~37KB(본문 포함)·스토리 목록 18KB를 tsx로 실측 — i18nSections 분할이 전 페이지에 적용돼 있고 과대 props 없음
- next.config.mjs의 캐시 헤더 구조(/images·/fonts immutable, 개인 경로 no-store를 로케일 규칙 뒤에 배치, /_next/static은 헤더를 주지 않음)와 images 설정(qualities·deviceSizes·minimumCacheTTL)
- ImageHero: 28개 사용처 전부 priority 지정, LCP 이미지에 framer-motion 래퍼 없음, 레이아웃별 sizes 지정. HomeReleaseStrip·PortfolioCoverGrid·ProjectRowCard의 sizes도 정확함
- framer-motion은 `m`+LazyMotion(domAnimation)만 사용하고 lodash·import * 패턴 없음. lucide-react는 개별 esm 경로 래퍼(lib/lucide-icons.ts)로 트리셰이킹됨
- middleware.ts: CSP를 모듈 로드 시 한 번만 조립, 봇 정규식·대소문자·슬래시 정규화가 O(1)~O(n) 단일 패스, 가져오는 JSON은 regionRedirectMap 18KB뿐
- Layout·Header·MobileNav·Footer: 스크롤은 rAF 스로틀+경계 변화에만 setState, MobileNav·FAB은 mount 유지+CSS 토글, 대부분의 Link가 prefetch={false}, ScrollToTop·KakaoFab·AdminRouteProgress·GlobalPlayerDock은 dynamic ssr:false로 분리
- DeferredAnalytics(상호작용·5초 후 로드), lib/fonts.ts의 폰트 전략(본문 preload 없음·display optional·제목 서체 41KB preload)
- API 라우트 번들(esbuild 측정): first-party 40~200KB 수준이고 무거운 외부 패키지(chromium·puppeteer·sharp·qrcode)는 해당 라우트에만 들어감. 계약 PDF의 finalize는 동적 import
- DB 클라이언트(db/client.ts)는 지연 생성·모듈 싱글턴이라 최상위 비용 없음. @vercel/og 라우트는 edge+폰트 모듈 스코프 캐시+IP 제한
- autoLinkKeywords 실행 비용 실측: 평균 1.6ms·최대 7.9ms(21KB 본문) — 문제 없음. tailwind 산출 CSS는 126KB min/21.5KB gzip
- getStoryDetail·getStoryPaths의 캐시(production 한정)와 프리렌더 대상 축소(번역 있는 로케일만), getStoryListing 기반 관련글·/api/stories/catalog 경로

**읽지 못한 범위**
- 프로덕션 빌드 산출물(.next)을 열지 않았다 — 클라이언트 번들 수치는 esbuild 근사(Next의 청크 분할·SWC 압축과 다름)이고 gzip은 모듈 단위 측정이다
- Vercel 런타임 로그·함수 호출 수·ISR 쓰기 횟수·콜드 스타트 시간·Turso 사용량은 읽지 못했다 — 리전 지연(150~200ms)·ISR 재생성 비용은 구조에서 추정한 값
- Lighthouse/PSI와 Web Vitals 실측은 하지 않았다(LCP·CLS·TBT 판단은 코드 구조 기준)
- Turso 쿼리 플랜(EXPLAIN)을 확인하지 않았다 — 인덱스 부재 지적은 스키마·SQL 기준
- pages/api 81개 중 핸들러 본문의 쿼리 수는 funding status·bookings slots·shows availability·manifest·rss·llms·catalog 위주로만 확인했다
- HeaderActions·DropdownMenu·LanguageSwitcher·HomeServiceTracklist·HomeStudioSpec·MixComparePlayer·styles/globals.css·theme-init.js는 구조만 훑고 세부 렌더/CSS를 정독하지 않았다
- prebuild 스크립트(generate-hero-font/body-font/story-listing)의 Vercel 빌드 캐시 동작(CACHE_DIR 위치)과 실제 빌드 소요 시간은 확인하지 못했다
- TURSO_DATABASE_URL 스킴(libsql:// vs https://)은 환경변수가 Sensitive라 확인하지 못했다

**미검증 후보(overflow)**
- 없음

### CQ. 코드 품질·구조·중복·타입 안전

P0 0 · P1 1 · P2 3 · P3 24, 미검증 0 (총 28건)

리팩터 순서 안내(여러 항목이 참조한다): ① 값싼 중복 제거(SITE_URL·전화번호·KST·rowsAffected·실패 코드 표) → ② 폴더 의존 방향 → ③ API 표기 통일 → ④ 환불 잔액·대상 행 선택 공용화 → ⑤ 계좌 입금 INSERT → ⑥ 토스 승인 상수·재조회 검증 공용화(맨 마지막).

---

#### CQ-1. 일일 운영 점검: GA4 점검이 DB 점검보다 먼저 돌고(Production에 GA4 env 있음) 점검 하나가 던지면 그날의 다른 이슈와 관리자 첫 화면 이슈가 함께 사라진다 [P1 · M]

① `lib/ops/healthCheck.ts:340-1063`(collectDbIssues), `lib/ops/healthCheck.ts:1069-1095`(runHealthCheck, 특히 1085·1088), `lib/ops/leadRateCheck.ts:188`·`:201`, `pages/api/cron/health-check.ts:46`, `lib/ops/adminDashboard.ts:79`, `pages/admin/index.tsx:46-49`

② 지금 코드:

```ts
// lib/ops/healthCheck.ts:1085-1092 (runHealthCheck)
  const leadRate = await runLeadRateCheck();
  issues.push(...leadRate.issues);

  issues.push(...(await collectDbIssues(now)));
  ...
  issues.push(...(await checkContractHygiene(now)));
```

collectDbIssues(340-1063, 723줄) 안의 try/catch는 762·794·820행 세 곳뿐이고, 그 안에서 `issues.push`가 20회, `await db`가 18회 돈다. runHealthCheck는 GA4 Data API를 부르는 `runLeadRateCheck()`를 1085에서 collectDbIssues(1088)보다 **먼저** await하는데, leadRateCheck.ts:201의 `Promise.all`에는 try/catch가 없고 190-199는 env 4개가 없을 때만 skip한다. `pages/api/cron/health-check.ts:46`의 catch는 예외가 새면 이미 push한 issues를 버리고 '운영 점검 실패' 메일 한 통만 보낸다.

③ 왜 문제인가: Vercel Production에 `GA4_PROPERTY_ID`·`GA4_OAUTH_REFRESH_TOKEN`·`GSC_OAUTH_CLIENT_ID`·`GSC_OAUTH_CLIENT_SECRET`이 전부 있다(`vercel env ls production`으로 확인, 리프레시 토큰은 113일 전 값). 즉 GA4 경로는 실제로 돌고, leadRateCheck.ts:188의 "2026-09-08 기준 Production에 env 없음" 주석은 낡았다. GA4가 던지면 그 뒤의 DB 점검은 한 번도 돌지 않는다. 또 collectDbIssues 안에서 쿼리 하나가 던지면(Turso 순간 오류, 미적용 마이그레이션의 `no such column`) 함수 전체가 reject되어 그날 나머지 17개 점검 결과를 전부 잃는다. 762·794·820의 기존 catch는 console.error만 하고 이슈를 남기지 않는다. `adminDashboard.ts:79`가 같은 collectDbIssues를 Promise.all 안에서 부르므로(pages/admin/index.tsx:46-49 try/catch) 점검 하나가 죽으면 관리자 첫 화면의 이슈 목록도 함께 빈다.

④ 어떤 조건에서 어떤 결과: GA4 리프레시 토큰 폐기처럼 **지속되는** 실패가 생기면, '결제됐는데 주문 pending', '캘린더 미등록 확정 예약', 'drift' 같은 high 이슈가 매일 운영자에게 가지 않고 "점검 실패: <GA4 오류>"만 가서 마케팅 지표 문제로 읽힌다. DB 쪽 예외도 같은 모양이다 — 실패 메일의 `사유:`에 SQL 오류 원문은 실리지만(drift 점검은 collectDbIssues 맨 앞 357행이라 먼저 push됨) 나머지 점검 결과는 그날 없다. 운영 사고 위험이지 돈·데이터가 직접 깨지는 건 아니다.

⑤ **수정**:
- 표 구동으로 바꾼다. `type HealthCheck = { id: string; run(now: Date): Promise<HealthIssue[]> }`와 `runIsolated(check, now)`를 두고, runIsolated는 `try { return await check.run(now) } catch (e) { console.error(...); return [{ severity: 'high', title: '점검 자체가 실패: <id>', detail: '<safeDbErrorSummary(e)> — 이 항목은 오늘 확인되지 않았습니다.' }] }`로 한다. `safeDbErrorSummary`는 `lib/payments/refundAccount.ts`에 이미 있다. runHealthCheck는 `CHECKS`를 순서대로 돈다. 죽은 점검은 'medium'이 아니라 **'high'**로 넣는다 — medium으로 두면 다른 medium 사이에 묻힌다.
- `runLeadRateCheck`도 같은 래퍼로 감싸고 collectDbIssues **뒤**로 옮긴다(최소한 격리한다). 코드 주석 3곳(healthCheck.ts:1080-1083, leadRateCheck.ts:188, migrationDrift.ts:71-72)의 'throw해서 알린다' 의도는 '메일에 high로 표시'가 대신한다.
- 762·794·820의 기존 catch(console.error만)도 같은 래퍼로 통일한다.
- 순서 제약 유지: `checkContractHygiene`는 반드시 계약 만료 점검 뒤(1090 주석).
- collectDbIssues의 점검을 `lib/ops/checks/{bookings,funding,shows,contracts,system}.ts`로 쪼개 HealthCheck로 export하고, `adminDashboard.ts`도 같은 목록(외부 호출 제외)을 돌게 해 메일과 화면의 판정식을 하나로 유지한다.
- leadRateCheck.ts:188 주석의 'Production에 env 없음'을 지운다.
- 회귀 테스트: `lib/ops/healthCheck.integration.test.ts`에 "한 점검이 throw해도 나머지 이슈와 실패 항목이 함께 보고된다", "GA4 실패가 DB 점검을 막지 않는다"를 추가한다(현재 201행의 throw 케이스는 캘린더 케이스라 격리 테스트가 아니다).

⑥ 비고: 검증자가 바로잡은 요지 — drift 점검은 먼저 push되므로 증거가 '폐기'되는 게 아니라 형태가 바뀌는 것이고 잃는 것은 나머지 17개 점검 결과다; 관리자 첫 화면 영향이 원래 지적에 빠져 있었다; 죽은 점검은 high로 둘 것. 미수정 상태(격리 커밋 없음)이며 throw 방침은 CLAUDE.md가 아니라 코드 주석이라 금지된 제안이 아니다.

---

#### CQ-2. 토스 승인 상수·재조회 검증이 4벌 복제돼 있고 '모듈 그래프' 복제 근거는 코드가 스스로 부정한다 (설계 부채, 현재 동작 차이 없음) [P2 · L]

① `lib/shows/confirm.ts:7-9`·`:37-40`·`:127-154`·`:430`, `lib/booking/confirm.ts:40`·`:42-45`·`:57`·`:151`·`:545-572`, `lib/booking/confirmDeposit.ts:37`·`:39`·`:55`·`:199-216`, `lib/funding/confirm.ts:5`·`:19`·`:33-34`·`:36`·`:72-73`·`:245-253`, `lib/shows/tossCodes.ts:1-5`, `lib/shows/refund.ts:6`, `lib/shows/showtimeOps.ts:5`, `tests/fakes/fakeToss.ts`, 주입 호출부 `pages/[locale]/shows/success.tsx:175`, `lib/booking/webhook.ts:303`, `pages/api/admin/shows/[id].ts:135·182`, `pages/api/shows/refund.ts:73`

② 지금 코드:

```ts
// lib/shows/confirm.ts:7-9 (같은 파일이 이미 booking 모듈을 import한다)
import { refundIdempotencyKey, remainingRefundable } from '../booking/cancel';
import type { TossKeyChannel, TossPayment } from '../booking/toss';
import type { FakeToss } from '../../tests/fakes/fakeToss';
// lib/shows/confirm.ts:37-40
/** ... lib/booking/confirm.ts·lib/funding/confirm.ts와 같은 이유로 의도적으로 복제해 둔다(두 모듈의
 * import 그래프를 shows와 섞지 않기 위해). */
const ALREADY_PROCESSED_CODE = 'ALREADY_PROCESSED_PAYMENT';
// 같은 정규식이 4곳: booking/confirm.ts:57, booking/confirmDeposit.ts:39, funding/confirm.ts:36, shows/tossCodes.ts:5
const DECLINE_CODE_PATTERN = /^(REJECT_|INVALID_REJECT_CARD|EXCEED_MAX_|INVALID_CARD|INVALID_STOPPED_CARD$|...)/;
```

`DECLINE_CODE_PATTERN` 4벌은 md5가 동일한 바이트 단위 복제다. `ALREADY_PROCESSED_CODE`도 4곳(booking/confirm.ts:40, confirmDeposit.ts:37, funding/confirm.ts:19, shows/confirm.ts:40), ALREADY_PROCESSED 재조회 검증 블록도 4곳(booking/confirm.ts:545-572, confirmDeposit.ts:199-216, funding/confirm.ts:245-253, shows/confirm.ts:127-154), `rowsAffectedOf`는 6곳(lib 5 + pages/api/admin/funding/pledges/[id].ts:33)이다. '승인 후 전이 0행 자동 취소'(settleLateApproval)는 booking/confirm.ts:151과 confirmDeposit.ts:55 두 벌이 사실상 같다.

③ 왜 문제인가: 복제 사유로 적힌 "import 그래프를 섞지 않기 위해"는 사실이 아니다 — shows/confirm.ts:7이 booking/cancel을 **값으로** import하고(cancel.ts는 다시 booking/toss·gcal·email을 끌어온다), funding/confirm.ts:5가 booking/toss를, billing/service.ts:24가 booking/confirm을, 심지어 booking/confirmDeposit.ts가 './confirm'에서 rowsAffectedOf를 import한다. shows 3파일(confirm.ts:9, refund.ts:6, showtimeOps.ts:5)은 프로덕션 시그니처를 `tests/fakes/fakeToss.ts`의 `FakeToss` 타입에 묶고 있고, 호출부 4곳이 실제 구현을 손으로 주입한다. 4번째 복제(confirmDeposit)는 2026-10-06 #526에서 추가됐다 — 복제가 늘어나는 중이다.

④ 어떤 조건에서 어떤 결과: 새 거절 코드나 토스 응답 규격 변화가 오면 4곳에 들어가야 하고 한 곳을 빠뜨리면 그 도메인만 allowlist가 어긋난다. 과소 낙인(거절 코드를 못 알아봄)은 치유되지만, 과대 낙인은 제3자가 남의 주문을 failed로 만드는 구멍이 된다. 지금은 4벌이 동일해 동작 차이가 없다 — 미래 드리프트 위험이다.

⑤ **수정** (리팩터 순서 ⑥, 맨 마지막):
1. `lib/payments/tossErrors.ts`에 `DECLINE_CODE_PATTERN`·`ALREADY_PROCESSED_CODE`·`isCustomerDecline`을 한 번만 정의하고 4곳의 로컬 정의와 '의도적 복제' 주석(booking/confirm.ts:42-45, funding/confirm.ts:33-34·72-73, shows/confirm.ts:38-39, tossCodes.ts:1-4)을 지운다. `tossCodes.ts`에는 `parseLeadingTag`만 남기고 `tossCodes.test.ts`의 DECLINE 케이스를 새 파일로 옮긴다.
2. `lib/payments/tossConfirm.ts`에 `reverifyAlreadyProcessed(order, paymentKey, fetch)`를 추출하고 4곳은 reason→각자 코드(`toss_rejected` / `TOSS_UNRESOLVED_CODE`)로 매핑만 한다. funding은 두 실패를 한 로그로 묶는 현재 동작을 유지해도 된다.
3. `TossGateway` 인터페이스는 `TossResult`·`TossPayment`가 사는 `lib/booking/toss.ts`에 export하고 기본값을 실제 구현으로 두며, `fakeToss.ts`가 그 타입을 `satisfies`하게 한다. shows 3파일의 `Pick<FakeToss,…>`와 `tests/` import를 제거하고 주입 호출부 4곳은 인자를 생략한다.
4. `settleLateApproval`은 booking/confirm.ts:151과 confirmDeposit.ts:55 **두 벌만** 합친다. `shows/confirm.ts:430 autoCancelShowApproval`은 CAS 선점→토스 재조회 검증→remainingRefundable 잔액→실패 시 revert→show_tickets void·auto_cancelled_at을 한 batch로 묶는 별개 알고리즘이라 그대로 둔다.
- 각 단계마다 `lib/booking/confirm.integration.test.ts`, `lib/shows/confirm.integration.test.ts`, `lib/shows/race.integration.test.ts`, `lib/funding/confirm.integration.test.ts` 초록 확인.

⑥ 비고: 검증자가 바로잡은 요지 — 심각도는 P1이 아니라 P2(지금 동작 차이 없음, 리뷰어 스스로 '맨 마지막'), 주입 호출부는 2곳이 아니라 4곳, autoCancelShowApproval은 합치면 안 된다. lib/shows/CLAUDE.md의 '합치지 않기로 했다'는 success/fail UI 페이지 얘기, webhook.ts:209-212의 '합치지 않는 이유'는 isTransientConfirmFailure의 outcome 모양 얘기라 이 제안과 무관하다. 같은 자리를 다른 축(TST 테스트·CI·빌드 파이프라인)도 지적: "lib/shows가 테스트 더블 타입(FakeToss)에 컴파일 의존한다".

---

#### CQ-3. 환불 잔액 공식 2벌과 대상 결제 행 선택 4벌 복제 (계좌 접수는 검증·암호화 구간만 공통) [P2 · M]

① `lib/booking/cancel.ts:60-66`·`:77`·`:133`·`:136-166`, `lib/funding/refundable.ts:15`, `lib/funding/cancel.ts:133-136`·`:157-205`, `lib/funding/lineRefund.ts:67-69`, `lib/shows/refund.ts:140-142`·`:159-190`, `lib/shows/showtimeOps.ts:112-114`, `lib/payments/refundAccount.ts`

② 지금 코드:

```ts
// lib/booking/cancel.ts:77  /  lib/funding/refundable.ts:15 — 같은 공식, 시그니처만 다른 동명 함수
export const remainingRefundable = (order: Order, payments: PaymentWithRefunds[]): number => { ... }
export const remainingRefundable = (order: FundingOrder): number => { ... }
// 대상 결제 행 고르기 4벌: funding/cancel.ts:133-136, funding/lineRefund.ts:67-69, shows/refund.ts:140-142, shows/showtimeOps.ts:112-114
const doneRefundedOn = (p: PaymentWithRefunds): number =>
  p.refunds.filter((r) => r.status === 'done').reduce((sum, r) => sum + r.amount, 0);
const payment = payments.find((p) => doneRefundedOn(p) < order.totalAmount) ?? payments[payments.length - 1];
```

'잔액을 덮지 않은 결제 행 고르기' 3줄이 네 곳에 그대로 복사돼 있고 주석에도 "cancel.ts와 같은 규칙"이라 적혀 있다. 환불 계좌 '검증→암호화→접수→실패 시 되돌림'도 booking/cancel.ts:136-166(planBankRefund·saveCustomerRefundAccount), shows/refund.ts:159-190, funding/cancel.ts:157-205 세 벌이다.

③ 왜 문제인가: 환불은 돈이 나가는 경로이고, 결제 행 선택 규칙은 `payments[0]`만 보면 이중 환불이 되는 사고에서 나온 규칙이다(cancel.ts:133 주석). 한 곳만 고치면 다른 도메인이 옛 규칙으로 남는다.

④ 어떤 조건에서 어떤 결과: 선택 규칙·잔액 공식을 한 도메인에서만 고치는 순간 나머지 도메인은 사고 전 규칙으로 되돌아갈 수 있다. 현재 네 벌은 같다.

⑤ **수정** (리팩터 순서 ④):
- `lib/payments/refundLedger.ts`(순수 함수)에 `doneRefundedTotal(payment)`, `remainingRefundable(orderTotal, payments)`, `pickRefundTarget(payments, orderTotal)`을 둔다. booking의 `refunds`를 타입상 **필수**로 둔 결정(cancel.ts:60-66 "조용한 과다 환불이라 컴파일 에러가 낫다")을 그대로 유지한다 — funding 쪽의 `p.refunds ?? []`는 픽스처 방어이므로 공용 함수에서 optional로 약화시키지 말고 funding 테스트 픽스처에 refunds를 채운다.
- 호출부 4곳과 `funding/refundable.ts`의 중복을 교체한다.
- 계좌 접수는 `validateRefundAccount→encryptRefundAccountNumber→(키 없음)→같은 오류 로그`까지만 `prepareCustomerRefundAccount`로 모은다. 선점·되돌림 순서는 도메인마다 다르므로(펀딩은 `refund_requested_at` 표식을 먼저 선점한 뒤 계좌를 쓰고 실패 시 표식만 되돌림, 예약·공연은 선점 UPDATE 뒤 계좌를 쓰고 선점·계좌 행을 되돌림) `saveRefundAccountOrRevert` 같은 통합은 하지 않고 도메인 파일에 둔다.
- 기존 각 도메인 cancel/refund 통합 테스트로 회귀 확인.

⑥ 비고: 검증자가 바로잡은 요지 — '계좌 접수 3벌의 순서·가드가 같다'는 부정확(공통은 검증·암호화 구간뿐); booking의 필수 refunds 타입을 합치면서 약화시키면 안 된다.

---

#### CQ-4. 공연 입장 스캔 링크는 발급만 되고 폐기 수단이 없다 (revokeScanLink 호출처 0) [P2 · S]

① `lib/shows/scanLink.ts:77-84`, `pages/api/admin/shows/[id].ts`(case 목록 234·248·265), `pages/admin/shows/[id].tsx:364`·`:237-244`, `lib/shows/adminQueries.ts`, `lib/shows/scanAccess.ts`

② 지금 코드:

```ts
// lib/shows/scanLink.ts:77-84 — 정의만 있고 repo 전체에서 호출 0 (rg 확인)
/** 폐기 — 이미 폐기된 링크의 시각을 덮어쓰지 않는다. 처음 폐기됐으면 true. */
export const revokeScanLink = async (id: string, now: Date = new Date()): Promise<boolean> => { ... };
// pages/api/admin/shows/[id].ts — 액션: issue_scan_link(234), issue_report_link(248), revoke_report_link(265) … revoke_scan_link 없음
// pages/admin/shows/[id].tsx:364 — 스캔 링크 목록은 폐기 상태만 표시, 버튼 없음
{t.scanLinks.map((l) => <li key={l.id}>{l.label} · 만료 {kstTime(l.expiresAt)}{l.revokedAt ? ' · 폐기' : ''}</li>)}
// 같은 화면의 현황(report) 링크는 :237-244에 '폐기' 버튼이 있다
```

③ 왜 문제인가: `revokeScanLink`는 정의뿐이고 전 저장소 호출처가 0이다. 관리자 API에 `revoke_scan_link` 액션이 없고 화면에도 버튼이 없어 '폐기' 표시는 절대 일어날 수 없는 상태를 그리고 있다. 현황 링크는 `revoke_report_link`와 버튼이 있어 비대칭이다.

④ 어떤 조건에서 어떤 결과: 스캔 링크가 유출되거나 잘못 전달돼도 만료(최대 72시간)까지 끊을 수 없다. 단 링크만으로는 아무나 체크인을 찍을 수 없다 — `/api/shows/checkin`은 티켓 코드(`SNT1:` + 80비트 랜덤)를 알아야 하고, 링크가 여는 것은 한 회차 한정, 응답은 입장 번호·집계뿐이며 PII가 없다. undo도 같은 라벨 actor가 창 안에서 되돌리는 구조다(undoCheckIn:46-49). 입장 현장에서 잘못된 링크를 조기에 차단하지 못하는 운영 위생 문제다.

⑤ **수정**:
- `pages/api/admin/shows/[id].ts`에 `case 'revoke_scan_link'`를 추가한다. `showtimeOf`와 같은 방식으로 **이 공연의 회차에 속하는 linkId인지 먼저 확인**한 뒤(revokeScanLink에 showtimeId 조건을 넣거나 `show.showtimes`의 id 목록으로 필터) `revokeScanLink`를 호출한다. 이미 폐기됐거나 이 공연 소속이 아니면 409. `revokeScanLink(id)` 자체는 공연 소속을 확인하지 않으므로 이 단계가 빠지면 다른 공연의 링크를 폐기할 수 있다.
- `pages/admin/shows/[id].tsx:364` 목록에 현황 링크(237-244)와 같은 폐기 버튼을 둔다(만료 안 된 링크만, confirm 문구 포함).
- 회귀 테스트: `tests/api/admin/shows/showsAdminApi.integration.test.ts`에 폐기 후 `verifyScanLink`가 revoked를 돌려주고 `/api/shows/checkin`이 401을 주는 케이스.

⑥ 비고: 검증자가 바로잡은 요지 — 영향은 과장돼 있었고(아무나 체크인 불가) 위생 문제이나, 한 번 만든 베어러 자격을 조기에 끊을 수단이 없는 것은 액션 하나 + 버튼 하나로 풀리므로 P2 유지. 같은 자리를 다른 축(SHW 공연 예매)도 지적: "입장 스캔 링크를 관리자가 폐기할 길이 없다(revokeScanLink 미배선, 현황 링크와 비대칭)", "revokeScanLink에 회차 범위가 없다 — 사용처가 생길 때 revokeReportLink와 같은 시그니처로 맞춘다(현재 호출 0건)".

---

#### CQ-5. PII를 바인딩하는 단건 INSERT 실패가 미포획 경로로 서버 로그에 평문 노출될 수 있다 (계약 경로는 batch라 해당 없음) [P3 · M]

① `lib/booking/service.ts:112-122`(orders INSERT), `pages/api/bookings/index.ts:57`, `lib/billing/service.ts:179`(createSubscription INSERT), `pages/api/admin/subscriptions/index.ts:126`, 규칙 정본 `lib/payments/refundAccount.ts:65-70`

② 지금 코드:

```ts
// node_modules/drizzle-orm/errors.js:11-14
    super(`Failed query: ${query}\nparams: ${params}`);
// node_modules/drizzle-orm/libsql/session.js:121,131 → queryWithCache가 단건 run/all/get 실패를 DrizzleQueryError로 감싼다
// lib/payments/refundAccount.ts:65-70 — 저장소 스스로 정한 규칙
 * DB 오류를 로그에 남길 **요지만** — 이름과 코드. 오류 객체를 통째로 찍지 않는다: drizzle의
 * `Failed query: … params: …` 메시지와 `cause`에 바인딩 값이 실려 ...
```

drizzle 0.45 단건 쿼리 실패는 'Failed query: SQL / params: 값 전부' 메시지의 `DrizzleQueryError`가 된다. `batch`는 감싸지 않는다(libsql session.batch:36-47이 client.batch를 그대로 호출). 계약 생성(service.ts:187)·수정(service.ts:281)·서명(sign.ts:208)은 전부 batch라 안전하다. PII를 바인딩하는 단건 쓰기는 `createBookingOrder`의 orders INSERT(customerName/Phone/Email)와 `createSubscription` INSERT 둘이다.

③ 왜 문제인가: `pages/api/bookings/index.ts:57`이 try/catch 없이 호출해 Next가 `api-resolver.js:378`에서 `console.error(err)`로 통째로 찍는다. `admin/subscriptions/index.ts:126`도 원문을 로그한다. 저장소가 스스로 정한 규칙(요지만 로그)과 어긋난다.

④ 어떤 조건에서 어떤 결과: DB 쓰기가 실패한 순간에 한해 고객 이름·전화·이메일이 Vercel 런타임 로그에 남는다. 접근자는 운영자 팀으로 한정되고 DB 장애가 선행 조건이다.

⑤ **수정**:
1. 위 두 INSERT만 try/catch로 감싸 `safeDbErrorSummary`로 요지만 로그하고, 원문 대신 PII 없는 `new Error('order_insert_failed')`를 던진다. 미포획 경로는 **던지는 오류 자체를 정화**해야 Next 로그도 안전하다 — catch의 console.error를 치환하는 방식으로는 못 덮는다.
2. `admin/subscriptions/index.ts:126`도 같은 요지 로그로 바꾼다.
3. safeDbErrorSummary 이동·`logDbError` 신설·225줄 일괄 치환·기준선 가드는 하지 않는다. 대부분 PII를 바인딩하지 않아 노이즈다. 필요하면 PII를 바인딩하는 단건 쓰기 목록만 CLAUDE.md에 한 줄 남긴다.

⑥ 비고: 검증자가 바로잡은 요지 — 원래 대표 사례였던 `pages/api/contracts/index.ts:63`은 batch라 해당 없고, 나열됐던 notification_error UPDATE들도 같은 값을 이미 로그에 싣고 있어 새로 새는 것이 없다. 실제 노출처는 예약 주문 INSERT와 구독 INSERT 둘이며, 조건이 좁아 P3.

---

#### CQ-6. press 감상실 비밀번호 대입 방어가 DB 예외 시 fail-open (관리자 로그인·계약 본인확인은 메모리 폴백) [P3 · M]

① `pages/api/press/room/[room]/enter.ts:15-16`·`:38-43`, `lib/booking/rate-limit.ts:66-69`, `lib/contracts/admin-rate-limit.ts:90-124`(checkInMemory), `lib/press/listeningRoom.ts`(SCRYPT_PARAMS)

② 지금 코드:

```ts
// lib/booking/rate-limit.ts:66-69
  } catch (error: unknown) {
    console.error('[booking-rate-limit] Rate limit check unavailable, allowing:', error);
    // 셀 수 없다는 이유로 정당한 예약 시도를 막지 않는다(admin-rate-limit과 동일 판단).
    return true;
// pages/api/press/room/[room]/enter.ts:15-16, 41  — 주석: "비밀번호 하나를 여러 매체가 함께 쓰므로 대입을 막는 장치는 IP당 횟수 제한뿐이다."
  if (!(await consumeRateLimit(`press_room:${room.id}:ip:${ip}`, 10, 15 * 60))) {
```

③ 왜 문제인가: 비밀번호 대입 방어가 `consumeRateLimit`(DB 예외 시 true)에 걸려 있어 Turso 예외 동안 IP당 10회/15분 제한이 사라진다. 같은 부류인 관리자 로그인·계약 본인확인은 admin-rate-limit.ts에서 DB 예외 시 인스턴스 메모리 카운터로 폴백하도록 고쳐 둔 것(d095e39c9a, 2026-10-03)인데 press(99694c8720, 2026-10-07)가 그 교훈을 놓쳤다. 저장소 기준은 이미 있다 — 예약·문의·결제 비콘은 놓치는 손실이 커서 허용(contact/rateLimit.ts 주석), 비밀 대입 방어는 메모리 폴백. press만 분류에서 빠졌다.

④ 어떤 조건에서 어떤 결과: Turso 장애/예외 + 방 URL을 아는 공격자가 겹칠 때 감상실 비밀번호를 제한 없이 대입할 수 있다. 매 시도가 scrypt N=2^15 비용이라 장애 구간에 시도할 수 있는 수가 제한적이고, 지키는 대상은 발매 전 음원(돈·PII 아님)이다.

⑤ **수정**: `enter.ts`에서만 DB 예외 시 메모리 카운터로 떨어지게 한다. `admin-rate-limit.ts`의 `checkInMemory`를 export해 쓰거나, `consumeRateLimit`에 `onStoreError: 'allow' | 'memory'` 옵션 하나를 더하고 press enter만 `'memory'`로 부른다. 회귀 테스트: DB가 던지는 mock에서 11번째 시도가 차단되는 케이스를 enter 라우트 테스트(CQ-24 참조)에 추가한다. 4벌 통합·`lib/rate-limit/limiter.ts` 신설·contact/og 정리는 별건으로 미룬다(contact의 Redis 거부 분기는 KV 미설정이라 죽은 분기, og/story.tsx는 edge 런타임).

⑥ 비고: 검증자가 바로잡은 요지 — P2는 과하다(조건이 좁고 scrypt 비용·보호 대상이 음원), 제안됐던 limiter 통합은 이 한 건에 비해 과하다.

---

#### CQ-7. 공용 인프라가 booking/contracts/contact 폴더에 있어 의존 방향과 이름이 어긋난다 (정리 성격) [P3 · M]

① `lib/booking/webhook.ts:1-13`, `lib/booking/toss.ts`, `lib/booking/rate-limit.ts`, `lib/booking/token.ts`, `lib/booking/kst.ts`, `lib/contracts/admin-auth.ts`, `lib/contracts/client-ip.ts`, `lib/contact/origin.ts`, 소비처 `lib/payments/depositGuideThrottle.ts:3`, `lib/funding/downloadAlert.ts`, `pages/api/payments/failed.ts:4`·`opened.ts`, `pages/api/funding/creator/*`(14개 라우트)

② 지금 코드:

```ts
// lib/booking/webhook.ts:5-9 — booking 폴더의 웹훅이 4개 도메인 확정 로직을 모두 import
import { reconcileSubscriptionPaymentFromToss } from '../billing/service';
import { confirmFundingPledge, syncFundingCancelledFromToss, type FundingConfirmOutcome } from '../funding/confirm';
import { confirmShowOrder, type ConfirmOutcome as ShowConfirmOutcome } from '../shows/confirm';
import { sendShowTicketEmail } from '../shows/email';
import { syncShowCancelsFromToss } from '../shows/refund';
// lib/payments/depositGuideThrottle.ts:3 / lib/funding/downloadAlert.ts: import { consumeRateLimit } from '../booking/rate-limit';
// pages/api/payments/failed.ts:4 : import { isAllowedContactRequestOrigin } from '../../../lib/contact/origin';
```

③ 왜 문제인가: 토스 웹훅 진입점과 rate-limit·toss·token·client-ip·origin이 도메인 폴더에 있다. 타 도메인 import가 많고 `isAllowedContactRequestOrigin` 같은 이름이 결제 비콘·개설자 API에서 contact 규칙으로 오해된다. 이동 대상 모듈을 `jest.mock`하는 테스트가 73파일·90곳이다. 파일 수준 import 순환은 없어(클린 판정 참조) 기계적 이동은 가능하다.

④ 어떤 조건에서 어떤 결과: booking 수정의 영향 범위가 숨고 새 도메인이 booking에서 가져오는 관행을 복제한다. 동작 오류는 아니다.

⑤ **수정** (리팩터 순서 ②):
1. 먼저 `.eslintrc.json`에 `no-restricted-imports`로 'lib/shows·funding·billing에서 lib/booking 신규 import 금지'를 기준선 방식으로 건다.
2. 이름이 오도하는 것부터 이동한다: `contact/origin`→`lib/http/origin`(`isAllowedRequestOrigin`), 순수 함수인 `client-ip`·`kst`·`token`.
3. 모듈 하나당 한 커밋으로 `git mv` + 소스 import + 테스트의 `jest.mock` 경로를 한 번에 sed한다. 옛 경로에 re-export shim을 두는 방식은 쓰지 않는다 — 소비 코드가 새 경로를 import하면 옛 경로 mock이 조용히 무효가 된다.
4. `toss`·`webhook`·`rate-limit`의 이동은 맨 뒤로 미룬다. 이 저장소는 여러 세션이 워킹트리를 공유하므로 100개 안팎 파일을 건드리는 이동은 다른 세션이 해당 파일을 만지지 않을 때 하고, push는 묶어서 한 번.

⑥ 비고: 검증자가 바로잡은 요지 — 동작 결함이 아닌 폴더 정리라 P3; shim 단계의 mock 무효화 비용과 공유 워킹트리 충돌 위험이 원래 제안에 빠져 있었다.

---

#### CQ-8. SITE_URL 표현식이 10곳에 복제, 변형 3곳 (정리 성격 — canonical 하드코딩 2곳은 의도된 값) [P3 · S]

① 정본 `lib/email/layout.ts:19`; 복제 `lib/booking/bankDeposit.ts:33`, `lib/booking/email.ts:14`, `lib/shows/bankDeposit.ts:31`, `lib/shows/email.ts:27`, `lib/billing/email.ts:16`, `lib/funding/email.ts:17`, `pages/api/funding/creator/login.ts:12`, `pages/sitemap-funding.xml.ts:7`, `pages/sitemap-shows.xml.ts:5`; 변형 `lib/contracts/token.ts:3`, `lib/contracts/email.ts:158`, `lib/contracts/finalize.ts:41`; 대상 아님 `pages/[locale]/shows/[slug].tsx:16`, `pages/[locale]/funding/[slug]/index.tsx:18`; 참고 `data/siteConfig.ts:165`

② 지금 코드:

```ts
// lib/email/layout.ts:19 — 이미 export된 정본이 있다
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');
// 같은 표현식을 서버 모듈 9곳이 각자 재정의
// 변형: lib/contracts/token.ts:3 (끝 슬래시 미제거), lib/contracts/email.ts:158, lib/contracts/finalize.ts:41 (인라인)
```

③ 왜 문제인가: 기본값·정규화를 바꿀 때 여러 곳을 같이 고쳐야 한다. 15곳이 모두 같은 기본값이라 '다른 호스트로 나간다'는 시나리오는 성립하지 않고, 실질 위험은 `contracts/token.ts`에서 env 값 끝에 슬래시가 있을 때 `//ko/...` 이중 슬래시 링크가 되는 정도다. `shows/[slug].tsx`·`funding/[slug]/index.tsx`의 `'https://studionol.co.kr'` 하드코딩은 canonical·OG·JSON-LD용 절대 URL이라 프리뷰에서도 운영 canonical을 가리키는 것이 맞는 의도된 값이다.

④ 어떤 조건에서 어떤 결과: `NEXT_PUBLIC_SITE_URL`이 끝 슬래시를 달고 설정되면 계약 토큰 링크만 이중 슬래시가 된다.

⑤ **수정** (리팩터 순서 ①): 이미 export된 `lib/email/layout.ts`의 `SITE_URL`(또는 `data/siteConfig.ts:165`의 정규화된 `url`)을 import해 로컬 const 9개와 contracts 3곳을 교체한다. 새 `lib/env.ts`·`describeMissingEnv`는 만들지 않는다. 하드코딩된 canonical 두 페이지와 `lib/sitemap/routes.js`(CJS, next-sitemap용)·middleware는 손대지 않는다.

⑥ 비고: 검증자가 바로잡은 요지 — canonical 하드코딩 2곳은 결함이 아니고, 제안됐던 env 설정층 신설은 사고 사례 없이 추상화를 들이는 것이라 뺐다.

---

#### CQ-9. 코드·메일·오류 문구의 전화번호 리터럴 87줄 — 정본 한 줄 수정으로 안 끝난다 (코드 쪽 가드 없음) [P3 · M]

① `lib/factTokens.js:1-26`(특히 3-5), `lib/factGuards.ts:72`, 별도 상수 `lib/funding/email.ts:19`, `lib/shows/copy.ts:3`, `pages/[locale]/funding/success.tsx:116`; 리터럴 다수 `lib/booking/email.ts`(8), `lib/billing/email.ts`(7), `lib/shows/refundMessages.ts`(6), `lib/booking/cancel.ts`·`confirm.ts`·`toss.ts` 오류 문구 등 43파일 87줄; 참고 `lib/operatorContact.ts`

② 지금 코드:

```js
// lib/factTokens.js:3-5
// 배경: 전화번호 0507→010 전환(2026-06-10)에 4회 스윕·180+파일 수정이 들었다.
// 본문 마크다운에는 %%phone%% 토큰만 쓰고, 실제 값은 여기서만 관리한다 —
// 다음 번호 변경은 이 파일 한 줄 수정으로 끝난다.
// 그러나 lib/pages/components/data(비테스트)에 '010-4255-7893' 리터럴 87줄. 별도 상수도 3벌:
// lib/funding/email.ts:19  export const PHONE_NUMBER = '010-4255-7893';
// lib/shows/copy.ts:3      export const SHOW_CONTACT_PHONE = '010-4255-7893';
// pages/[locale]/funding/success.tsx:116  const PHONE = '010-4255-7893';
```

③ 왜 문제인가: `CANONICAL_FACTS.phone`은 스토리 마크다운과 일부 데이터만 지킨다. factGuards의 `phone-hardcoded-in-content` 규칙은 스토리 마크다운·로케일 JSON만 대상이라 코드는 가드가 없다. 서버 메일·결제 오류 문구·화면은 리터럴이고 별도 상수가 3벌이다 — 주석의 약속("한 줄 수정으로 끝난다")과 코드가 다르다.

④ 어떤 조건에서 어떤 결과: 번호가 바뀌면 누락된 메일·오류 문구가 옛 번호를 안내한다. 이 번호는 운영자 개인 휴대폰이라 바뀔 이유가 사실상 없고 2026-06의 전환은 번호 체계 자체가 사라진 예외 사건이었다 — 발생 가능성은 낮다.

⑤ **수정** (리팩터 순서 ①):
1. 먼저 가드만: `data/pricing.test.ts`의 리터럴 스캔처럼 lib/pages/components/data의 .ts/.tsx에서 `'010-4255-7893'`을 세는 기준선 테스트(늘면 실패, 줄면 통과)를 추가한다. .md 계약 템플릿·테스트·factTokens는 제외.
2. 별도 상수 3벌(`PHONE_NUMBER`, `SHOW_CONTACT_PHONE`, success.tsx `PHONE`)을 `CANONICAL_FACTS.phone` 참조로 바꾼다.
3. 오류 문구 리터럴은 파일을 건드릴 때 점진 치환한다. 87곳 일괄 치환·.md 계약 문서 수정은 하지 않는다 — `lib/contracts/contract-template.md`·`house-rules.md`는 서명 시점에 본문이 굳는 문서라 템플릿을 함부로 건드리면 안 되고(CLAUDE.md '계약 본문은 템플릿으로 서명 때 완성한다'), 테스트 쪽(`tests/pages/*/fail.test.tsx` 등)도 리터럴을 직접 기대한다.

⑥ 비고: 이전 리뷰(2026-08-24 #23) 일부 미처리. 검증자가 바로잡은 요지 — 심각도 하향(번호가 바뀔 이유가 없음), 일괄 치환은 계약 문서를 건드리게 되어 쓸 수 없음.

---

#### CQ-10. rowsAffected 헬퍼가 7벌이고 주석이 서로를 '같다'고 하지만 규약이 둘이다 (프로덕션 동작 불일치는 아님) [P3 · S]

① `lib/shows/service.ts:11-19`; `number | undefined` 규약 `lib/booking/confirm.ts:120`·`:338-344`, `lib/funding/confirm.ts:75`, `lib/funding/service.ts:29`; `0` 규약 `lib/funding/bankTransfer.ts:22`, `lib/payments/bankDepositOrders.ts:333`(rowsOf), `pages/api/admin/funding/pledges/[id].ts:33`; 인라인 `lib/shows/showtimeOps.ts:69`, `lib/shows/email.ts:272`; 함정 기록 `lib/funding/lineRefund.ts:93`; 사본 `tests/helpers/showsDb.ts`

② 지금 코드:

```ts
// lib/shows/service.ts:11-19 — 주석은 'funding/service.ts와 같은 이름의 로컬 헬퍼'라 하지만 반환 규약이 다르다
export function rowsAffectedOf(result: unknown): number {
  const r = result as { rowsAffected?: number } | undefined;
  return r?.rowsAffected ?? 0;
}
// lib/booking/confirm.ts:120 / lib/funding/confirm.ts:75 / lib/funding/service.ts:29 → `number | undefined` ('판정 불가는 undefined로 돌려 정상으로 흘려보낸다')
// lib/funding/bankTransfer.ts:22, lib/payments/bankDepositOrders.ts:333(rowsOf), pages/api/admin/funding/pledges/[id].ts:33 → 없으면 0
```

③ 왜 문제인가: 두 규약은 의도된 비대칭이다 — 토스 승인이 끝난 돈은 읽기 실패 한 번으로 자동 취소하지 않으려고 undefined를 통과시키고(confirm.ts:338-344 주석), 운영자 수동 전이는 읽기 실패 시 실패 쪽으로 닫는다. 그런데 같은 이름 `rowsAffectedOf`로 흩어져 있고 shows/service.ts:12 주석은 '같다'고 말한다. RETURNING 문장은 rowsAffected가 0이라는 함정이 lineRefund.ts:93에만 적혀 있다. 실제 `@libsql/client` 0.17.4 결과에는 rowsAffected가 항상 숫자로 있어 undefined 분기는 목·픽스처에서만 나온다.

④ 어떤 조건에서 어떤 결과: 현재 프로덕션 오작동은 없다. 새 호출부가 이름만 보고 잘못된 규약을 import할 위험과 주석 오기만 있다.

⑤ **수정** (리팩터 순서 ①): 의존성 없는 `lib/db/rowsAffected.ts`에 **이름을 달리해 둘 다** 둔다 — `rowsAffectedOrUndefined`(토스 승인 후 확정 경로용, 판정 불가는 통과)와 `rowsAffectedOrZero`(수동 전이용, 판정 불가는 실패). JSDoc에 쓰임새와 'RETURNING 문장은 `.rows.length`로 판정'을 적고 7곳과 shows/service.ts:12 주석을 맞춘다. 한 규약으로 통일하지 않는다. `tests/helpers/showsDb.ts` 사본도 같은 모듈을 쓴다.

⑥ 비고: 검증자가 바로잡은 요지 — 원래 대표 사례(confirmDeposit.ts:275 vs bankDeposit.ts:210)는 성격이 다른 경로를 비교한 것이고, 한 규약으로 통일하자는 원안은 의도된 비대칭을 지우므로 부적절. 이름 분리만 한다.

---

#### CQ-11. 계좌 입금 결제 행 INSERT SQL이 3곳에 복제 (키·방법·판정은 이미 공용) [P3 · M]

① `lib/booking/bankDeposit.ts:199-209`(예약금 링크)·`:249-258`(예약·믹싱), `lib/shows/bankDeposit.ts:136-145`(공연), 공용 정본 `lib/payments/bankDeposit.ts`, `lib/payments/bankDepositOrders.ts`; 참고 `lib/funding/bankTransfer.ts:28`, `lib/funding/CLAUDE.md:237`

② 지금 코드:

```ts
// 같은 두 문장(orders paid 전이 + bank-deposit 결제 행 INSERT … WHERE isPaidNow AND NOT EXISTS)
    db.run(sql`
      INSERT INTO payments (id, order_id, payment_key, method, approved_at, receipt_url, raw_response)
      SELECT ${randomUUID().replace(/-/g, '')}, ${order.id}, ${paymentKey}, ${BANK_DEPOSIT_PAYMENT_METHOD}, ${approvedAt}, NULL, NULL
      WHERE ${isPaidNow} AND NOT EXISTS (SELECT 1 FROM payments WHERE payment_key = ${paymentKey})
    `),
```

③ 왜 문제인가: payments INSERT 5줄이 booking 2곳·shows 1곳에 같은 모양으로 있다. 불변식의 핵심인 키 형식(`bankDepositPaymentKey`)·결제수단 표기(`BANK_DEPOSIT_PAYMENT_METHOD`)·판정 함수(`isBankDepositPayment`)는 이미 `lib/payments/bankDeposit.ts` 한 곳이라 환불 불변식은 안전하다. 세 문장 쌍은 실제로 다르다(notification_error NULL vs SEND_PENDING, 공연만 liveShowtimeCondition, 하위 행 UPDATE가 도메인마다 다름). 결과 타입 셋(`BookingDepositOutcome` code 2종, `ShowDepositOutcome` +showtime_closed, `BankDepositOutcome` +not_bank_transfer·sold_out·project_unavailable·warnings)은 코드 집합이 달라 통합 대상이 아니다. 펀딩은 결제 행이 없다(lib/funding/CLAUDE.md:237).

④ 어떤 조건에서 어떤 결과: payments 컬럼이 늘 때 3곳을 같이 고쳐야 한다.

⑤ **수정** (리팩터 순서 ⑤): `lib/payments/bankDepositOrders.ts`에 `bankDepositPaymentInsert(db, { orderId, orderNo, approvedAtSec, isPaidNow })` 하나만 추가한다(payments INSERT 한 문장). orders UPDATE와 하위 행 UPDATE는 도메인 파일에 둔다. 결과 타입 통합·취소 batch 통합은 하지 않는다. 기존 세 통합 테스트(booking/shows/funding의 bankDeposit·bankTransfer.integration.test.ts)로 검증한다. 우선순위는 낮다.

⑥ 비고: 검증자가 바로잡은 요지 — '불변식이 3곳에 따로 있다'는 과장(핵심은 이미 공용), 결과 타입 '동일 구조'는 사실이 아님.

---

#### CQ-12. pages/api 405·본문 가드 표기가 라우트마다 다르다 (Allow 미설정 21파일, 객체 가드 변형 약 23곳 — 동작 결함은 아님) [P3 · M]

① `pages/api/bookings/cancel.ts:13-22`(동일 가드 15곳), `pages/api/funding/cancel.ts:16`(변형 8곳), `pages/api/bookings/index.ts:17`·`pages/api/payments/webhook.ts:17`(Allow 없는 405, 총 21파일), 죽은 catch `pages/api/payments/failed.ts:42`·`opened.ts:24`, 봉투 예외 `pages/api/contact/send-email.ts:15`, `pages/api/stories/catalog.ts:42,52`, `pages/api/cron/gsc-audit.ts:93`

② 지금 코드:

```ts
// pages/api/bookings/cancel.ts:19-22 (동일 가드 15곳)
  if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body))
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });
  const { orderNo, token, refundAccount } = req.body as Record<string, unknown>;
// pages/api/funding/cancel.ts:16 (다른 변형 8곳)
  const { orderNo, token, refundAccount } = (typeof req.body === 'object' && req.body) || {};
// pages/api/bookings/index.ts:17, pages/api/payments/webhook.ts:17 (405에 Allow 헤더 없음)
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
// 봉투: {ok,message} 607곳 / {message} 25곳 / {error} 2곳 / {success} 1곳
```

③ 왜 문제인가: pages/api 82파일 중 status(405)는 70파일에 있고 그중 Allow 헤더가 파일 어디에도 없는 라우트가 21파일이다. 본문 객체 가드는 두 변형 약 23곳. `consumeRateLimit(...).catch(() => true)`는 consumeRateLimit이 내부에서 이미 삼키므로 죽은 catch다. 소비자는 자기 프런트뿐인 POST 전용 JSON API라 Allow 부재의 실제 피해는 없고, 메서드·본문 가드는 모든 라우트에서 동작한다(누락이 아닌 표기 변형). `{success}`는 contact/send-email.ts(SUCCESS_RESPONSE, 프런트 `utils/contactSubmitPolicy`와 맞물림), `{error}`는 catalog/gsc-audit 둘이라 사실상 외부 계약이다.

④ 어떤 조건에서 어떤 결과: 신규 라우트가 이웃 변형을 임의로 따라 할 수 있는 정도다.

⑤ **수정** (리팩터 순서 ③): 헬퍼 모듈은 만들지 않는다. 필요하면 `rg "status\(405\)" pages/api`에서 Allow 없는 라우트만 한 번에 보정하고(`res.setHeader('Allow', 'POST')`), 죽은 `.catch(() => true)` 3곳은 지운다. contact/send-email.ts의 `{success}` 봉투는 프런트 계약이라 건드리지 않는다.

⑥ 비고: 검증자가 바로잡은 요지 — Allow 없는 곳은 42곳이 아니라 21파일, 위험은 없음; `lib/http/api.ts` 4개 헬퍼로 82개 라우트를 점진 치환하는 원안은 '단순하게' 원칙에 비해 이득이 작아 뺐다.

---

#### CQ-13. 관리자 API 인증 호출 누락을 막는 가드 테스트가 없다 (현재 누락 0건) [P3 · S]

① `pages/api/admin/bookings/[id].ts:31-36`(pages/api 23개 파일에 같은 패턴), `pages/api/admin/orders/[id]/refund-account.ts`(인증은 `lib/payments/refundAccountView.ts:35-39`의 `handleRefundAccountView` 안), `lib/contracts/admin-auth.ts:20`, `tests/api/admin/auth.test.ts`

② 지금 코드:

```ts
// pages/api/admin/bookings/[id].ts:33-36
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }
```

pages/api/admin 21파일 중 19개가 `authenticateAdminApi`를 직접 부르고, refund-account 2개는 `handleRefundAccountView`가 첫 줄에서 인증하며, `pages/api/contracts/{index,[id],[id]/pdf}.ts`와 funding/media도 호출한다(grep으로 확인).

③ 왜 문제인가: 모든 admin 라우트가 인증하지만 이를 강제하는 테스트가 없다. `/api/admin`을 보호하는 미들웨어도 없어 코드 리뷰만이 방어선이다. 개별 라우트의 401 테스트는 이미 상당수 있다(tests/api/admin/auth·funding/*·shows/*, contracts/id·index·id-pdf).

④ 어떤 조건에서 어떤 결과: 신규 admin 라우트가 인증을 빠뜨리면 그대로 배포될 수 있다. 현재 상태는 안전하다.

⑤ **수정**: 정적 스윕 테스트 하나만 추가한다. `pages/api/admin/**`와 contracts 라우트를 `readdirSync`로 훑어 소스에 `authenticateAdminApi(` 또는 `handleRefundAccountView(`가 있고, DB·외부 호출보다 앞서는지(첫 `await`)를 정규식으로 확인한다. 허용 목록은 `admin/auth.ts`(로그인)뿐. `content/*.baseline.test.ts`와 같은 스타일. 런타임 스윕(모든 default export를 세션 없는 mock으로 호출)은 쓰지 않는다 — 라우트 모듈들은 import 시점에 getDb/`ADMIN_ACCOUNTS`(admin-auth.ts:20, 기동 시 `resolveAdminAccounts`가 던짐)·외부 SDK를 읽어 mock 구성이 라우트마다 필요하고 쉽게 깨진다. `withAdminApi` HOF로 25개 라우트를 바꾸는 것도 지금 문제가 없는 곳을 흔드는 변경이라 하지 않는다.

⑥ 비고: 예방 가드 제안. 검증자가 런타임 스윕·HOF 원안을 정적 스윕으로 교체했다.

---

#### CQ-14. 크론 10개의 실패 알림 메일 골격이 복제되어 있다 (응답 문구 2곳만 다르고 라우트 배선 테스트는 5개에 없다) [P3 · M]

① `pages/api/cron/expire-show-orders.ts:18-55`(특히 :53), `pages/api/cron/review-requests.ts:84`, `pages/api/cron/health-check.ts:20-72`, `pages/api/cron/purge-*.ts`, `pages/api/cron/social-refresh.ts`, `pages/api/cron/backup-contracts.ts`, `lib/email/operatorAlert.ts`, `lib/cron/auth.ts`

② 지금 코드:

```ts
// pages/api/cron/expire-show-orders.ts:20-54 — 다른 9개 크론도 같은 형태
  if (!isCronAuthorized(req, 'cron/expire-show-orders')) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }
  try { ... } catch (error: unknown) {
    console.error('[cron/expire-show-orders] 실패:', error);
    const message = error instanceof Error ? error.message : String(error);
    const alert = await sendEmail({ to: OPERATOR_EMAIL, subject: ..., html: buildOperatorAlertHtml({ ... }) }).catch(() => ({ ok: false }));
    if (!alert.ok) console.error('[cron/expire-show-orders] 운영자 알림도 실패');
    return res.status(500).json({ ok: false, message });
```

③ 왜 문제인가: 10개 크론 모두 `isCronAuthorized`, try/catch, `sendEmail`+`buildOperatorAlertHtml` 실패 메일을 복제한다. 실패 응답에 `error.message` 원문을 싣는 곳은 expire-show-orders.ts:53과 review-requests.ts:84 두 곳뿐이고 나머지 8개는 고정 문구다. 메서드 무검사는 결함이 아니다 — Vercel Cron은 GET에 Bearer CRON_SECRET을 붙여 부르고 인증은 lib/cron/auth.ts(SHA-256 + timingSafeEqual, lib/cron/auth.test.ts가 검증)가 한다. 라우트 배선 테스트는 backup-contracts, expire-show-orders, health-check, review-requests, social-refresh 5개에 없다(업무 로직은 lib 쪽 테스트가 두껍다).

④ 어떤 조건에서 어떤 결과: 알림 문구 규칙을 바꿀 때 여러 곳을 고쳐야 하고, 신규 크론이 실패 알림 없이 조용히 끝나는 변형을 만들 수 있다. 실제 노출 위험은 낮다(인증된 Vercel Cron 호출뿐).

⑤ **수정**: 프레임워크(`defineCron`) 대신 작은 헬퍼 하나. `lib/email/operatorAlert.ts` 옆에 `notifyCronFailure({ cron, subject, title, summary, error, hints })`를 두어 sendEmail·html 조립·`.catch`·console.error를 맡긴다. 새 크론이나 손볼 때 옮긴다. expire-show-orders와 review-requests의 응답은 고정 문구로 맞춘다. 라우트 테스트는 `tests/api/cron/purgeOrders.test.ts` 패턴으로 401·성공·실패 시 알림 1통만 크론마다 얕게 둔다. 성공 경로는 크론마다 달라(social-refresh·health-check는 이상 있을 때만 메일, purge 계열은 건수 리포트) 공통화하지 않는다.

⑥ 비고: 검증자가 바로잡은 요지 — 크론은 9개가 아니라 10개, 메서드 무검사는 문제 아님, 원문 응답은 2곳뿐, 프레임워크 제안은 CLAUDE.md '한 번 쓰고 말 일에 추상화를 붙이지 않는다'와 충돌.

---

#### CQ-15. 토스 실패 코드 표가 복제되어 pay/fail만 할부 불가 코드가 빠졌다 [P3 · S]

① `pages/[locale]/pay/fail.tsx:16-29`, `pages/[locale]/booking/fail.tsx:20`·`:41`, `pages/[locale]/funding/fail.tsx:19`·`:40`, `lib/shows/failMessages.ts:5`·`:8`·`:25`·`:49`, `lib/payments/recordFailure.ts:32`·`:35`; 참고 `pages/[locale]/subscribe/[id]/fail.tsx`, `lib/booking/token.ts:17`·`:26`, `pages/api/funding/pledges.ts:60`, `lib/shows/shape.ts:30`·`:33`

② 지금 코드:

```ts
// 키 11개: pages/[locale]/booking/fail.tsx:20, funding/fail.tsx:19 (md5 동일) ; lib/shows/failMessages.ts:8(+영문 :49)
  NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT: '이 카드로는 선택하신 할부 개월 수를 쓸 수 없습니다.',
// 키 10개: pages/[locale]/pay/fail.tsx:16 — 위 키가 없다
const FAIL_MESSAGES: Record<string, string> = {
  PAY_PROCESS_CANCELED: '결제를 취소하셨습니다.', ...
// 주문번호 정규식 8가지:
// pay/fail.tsx:29 /^SNB-\d{8}-[0-9A-F]{8}$/ ; booking/fail.tsx:41·funding/fail.tsx:40 /^(SNB|FND)-(M-)?\d{8}-[0-9A-F]{8}$/ ;
// recordFailure.ts:35 /^(SNB|FND|TKT)-(M-|C-)?.../ ; shows/shape.ts:33 /^TKT-(C-)?.../ ; shows/failMessages.ts:25 /^TKT-.../ ;
// booking/token.ts:26 /^SNB-.../i ; funding/pledges.ts:60 /^FND-(?:M-)?.../ ; funding/success.tsx:91 /^[A-Za-z0-9_-]{6,64}$/
```

③ 왜 문제인가: booking/funding/pay fail 페이지와 lib/shows/failMessages.ts가 같은 토스 실패 코드 표를 각자 들고 있고 pay/fail.tsx만 한 키가 빠졌다 — 표 드리프트가 이미 일어났다. `lib/shows/failMessages.ts:5`의 '모듈 내부 상수라 복제한다'는 페이지 파일이 비페이지 값을 export할 수 없어서였고, lib로 옮기면 풀린다. 주문번호 정규식 8가지는 대부분 범위가 의도적으로 다르다(pay/fail은 예약금 링크라 SNB만, `SHOW_PAYMENT_ORDER_NO_PATTERN`은 결제가 없는 초대권 TKT-C-를 일부러 제외, `readPreviousOrderNo`는 /i와 toUpperCase) — 통합 대상이 아니다. 다만 `SNB-M-`은 어떤 생성기도 만들지 않는다(생성기는 SNB-, FND-/FND-M-, TKT-/TKT-C-뿐).

④ 어떤 조건에서 어떤 결과: 예약금 결제 링크(`/ko/pay/<slug>`)에서 `NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT`가 오면 일반 문구로 안내된다. 드문 코드 한 건의 문구 차이다.

⑤ **수정** (리팩터 순서 ①): `lib/payments/failMessages.ts`에 한국어 표 `TOSS_FAIL_MESSAGES_KO`를 두고 booking·funding·pay fail 페이지와 `lib/shows/failMessages.ts`의 `SHOW_FAIL_MESSAGES`가 import한다. 영어 표와 subscribe의 카드 등록 문구 표는 그대로 둔다. 페이지 JSX는 합치지 않는다(lib/shows/CLAUDE.md의 TransactionResult 공용화 보류 결정; `privateLinkNavigation.test.ts`가 요구하는 것은 페이지 파일 안의 브랜드 줄과 a 링크라 메시지 표 공용화와 충돌하지 않는다). 주문번호 정규식은 통합하지 않고 recordFailure.ts:32 주석만 정정한다(CQ-23과 같은 자리). 테스트는 각 페이지가 공용 표를 쓰는지(키 집합 동일)만 한 개 둔다.

⑥ 비고: 검증자가 바로잡은 요지 — P2→P3(영향은 드문 코드 한 줄), 정규식 통합(`generateOrderNo(kind)/isOrderNo(kind)`)은 서로 다른 허용 범위를 흐리므로 하지 않음. 같은 자리를 다른 축(PAY 결제·주문·예약)도 지적: "결제창 실패 코드표가 네 화면에 복제되어 있고 pay/fail에만 할부 불가 문구가 없다".

---

#### CQ-16. KST 변환이 20곳 이상에 재구현되어 있다 (선언 9곳 이상 + 인라인 +9h) [P3 · S]

① 정본 `lib/booking/kst.ts:2-5`; 로컬 재구현 `lib/shows/shape.ts:4`·`:19-24`; `KST_OFFSET_MS` 재선언 `lib/shows/time.ts:1`, `lib/shows/format.ts`, `lib/ops/salesLedger.ts:68`, `lib/ops/adminDashboard.ts:62`, `lib/artistSupport/signup.ts:22`, `lib/billing/schedule.ts`, `creatorDateInput.ts`; `KST_OFFSET_SEC` `lib/shows/email.ts:28`, `lib/shows/emailEn.ts:14`; 인라인 `lib/booking/bankDeposit.ts:39-40`, `lib/booking/email.ts:46-47`, `lib/booking/format.ts:12`, `pages/[locale]/booking/manage/[orderNo].tsx:145`, subscribe/manage 페이지, shows/report 페이지, admin/privacy-logs, admin/shows, admin/subscriptions

② 지금 코드:

```ts
// lib/booking/kst.ts:2-5 가 정본
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const kstDateString = (d: Date): string => new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
// lib/shows/shape.ts:4,19-24 — 같은 이름·다른 반환 형식(YYYYMMDD)의 로컬 재구현
function kstDateString(now: Date): string { const kst = new Date(now.getTime() + KST_OFFSET_MS); ... return `${yyyy}${mm}${dd}`; }
```

③ 왜 문제인가: shows/shape.ts의 로컬 `kstDateString`은 booking/kst.ts의 같은 이름 함수와 반환 형식(YYYYMMDD 대 YYYY-MM-DD)이 다르다. bankDeposit.ts:39 `kstHourLabel`과 email.ts:46 `kstTimeLabel`은 본문이 동일하다. 한국은 DST가 없어 상수 자체는 안전하고 현재 틀린 값을 내는 사본은 없다. 주문번호 UTC 하루 어긋남은 token.ts:15가 `kstDateString`으로 이미 고쳤다(token.ts:5-13 주석).

④ 어떤 조건에서 어떤 결과: 새 코드가 사본을 임의로 고르고, 시간대 버그를 고칠 때 한 곳만 고쳐질 수 있다. 정리 항목이며 현재 동작 결함은 아니다.

⑤ **수정** (리팩터 순서 ①): `lib/booking/kst.ts`를 정본으로 두고 `kstCompactDate`(YYYYMMDD)와 `kstHourLabel`을 더한 뒤, 이름이 겹치는 shape.ts의 로컬 함수와 동일 본문 두 개를 먼저 옮긴다. 나머지 인라인은 손볼 때 기회에 맞춰 교체한다. 일괄 교체 PR은 불필요하다. kst.ts는 순수 함수라 클라이언트 페이지도 import할 수 있다. 테스트는 UTC 15:00 경계 케이스를 `kst.test.ts`에 둔다.

⑥ 비고: 검증자 확인 — 중복은 지적보다 많고(20곳 이상) 결함은 없음.

---

#### CQ-17. 공개 GET /api/bookings/slots는 요청 제한 없이 호출마다 DB 쓰기 batch와 캐시 미스 시 구글 조회를 한다 [P3 · S]

① `pages/api/bookings/slots.ts:22-50`(특히 :24·:48-49·:68-73), `lib/booking/service.ts:266-290`(expireStaleOrders, :271-273 주석), `lib/booking/gcal.ts`, `lib/booking/calendarGuard.ts`, `lib/booking/confirm.ts:465`

② 지금 코드:

```ts
// pages/api/bookings/slots.ts:48-49
  const now = new Date();
  await expireStaleOrders(now);
// :24 per-instance 60초 캐시 (키: 캘린더×날짜×창), 상한·축출 없음
const freeBusyCache = new Map<string, { at: number; ranges: BusyRange[] }>();
// lib/booking/service.ts:266-290 expireStaleOrders — bookings/work_orders/orders 3개 UPDATE batch
// consumeRateLimit 호출 없음 (같은 폴더의 bookings/index.ts·cancel.ts는 IP당 10회/시간)
```

③ 왜 문제인가: 무인증 GET이 `expireStaleOrders`의 쓰기 batch를 매번 실행하고 캐시 미스마다 freeBusy를 호출하며 요청 제한이 없다. 캐시 키 공간은 캘린더 id × 날짜(0..60일로 검증됨, slots.ts:68-73) × 상품 영업창으로 유한해 항목 수 상한 문제는 없다. expireStaleOrders가 슬롯 조회·관리자 목록이 열릴 때마다 도는 것은 설계 의도다(service.ts:271-273 주석) — 크론으로 옮기면 pending의 status 전이 시점이 바뀌고 confirm.ts:465의 구조를 건드린다. `consumeRateLimit`은 호출마다 Turso 쓰기 2회(DELETE+UPSERT)에 fail-open이라 읽기 경로의 쓰기를 같은 쓰기 두 번으로 바꾸는 셈이 된다.

④ 어떤 조건에서 어떤 결과: 의도적 스크래핑이 구글 캘린더 쿼터를 소진하면 슬롯 조회와 예약 생성 가드가 fail-closed 503이 될 수 있다. 쿼터 수치와 실제 트래픽은 미확인이라 추정 위험이다. shows availability 등 다른 공개 GET에도 요청 제한이 없는 것이 이 저장소의 관례다.

⑤ **수정**: DB를 거치지 않는 Vercel Firewall 요청 제한 규칙(예: IP당 분당 N회)을 `/api/bookings/slots`에 건다. 앱 코드 변경은 필요 없고 `consumeRateLimit`은 쓰지 않는다. 실제 쿼터 소진이나 Turso 쓰기 비용이 관측될 때에만 expireStaleOrders 호출 빈도를 낮추는 변경(분 단위 throttle 또는 전용 크론)을 검토한다. 맵 크기 상한은 두지 않는다.

⑥ 비고: 검증자가 바로잡은 요지 — 캐시 상한·크론 이동·consumeRateLimit 원안은 각각 불필요·비용 증가·역효과라 Vercel Firewall 규칙으로 교체.

---

#### CQ-18. 관리자 API 핸들러와 결제 핵심 함수가 300~410줄이다 (구조 관찰, 결함 아님) [P3 · L]

① `pages/api/admin/funding/projects/[id].ts:215-624`(handler 410줄), `pages/api/admin/funding/pledges/[id].ts:41-387`(347), `lib/booking/confirm.ts:378-716`(confirmBookingPayment 339), `pages/api/admin/bookings/[id].ts:30-357`(328, 환불 합계는 :170-174), `lib/billing/service.ts:375-700`(chargeCycle 326), `pages/api/admin/funding/pledges/index.ts:32-308`(277)

② 지금 코드: TypeScript AST로 측정한 비UI 장대 함수가 위와 같다. pages/api에서 getDb를 쓰는 파일은 33개다. confirmBookingPayment는 339줄 중 주석이 122줄로, 순서 불변식(승인 후 기록, 만료 경합, 멱등 재생)을 적어 둔 선형 흐름이다.

③ 왜 문제인가: action 분기를 한 핸들러에 모은 관리자 라우트가 277~410줄이다. 길이 자체의 결함이 아니라 스타일 관찰이다. 이 핸들러들은 적대적 감사를 여러 번 거친 돈·개인정보 경로이며 테스트가 두껍다(tests/api/admin/funding/*, confirm.integration.test.ts 등). admin/bookings/[id].ts:170-174의 환불 합계는 취소 메일용 done 환불 합계라 `remainingRefundable`의 중복이 아니다.

④ 어떤 조건에서 어떤 결과: 액션 하나를 고칠 때 긴 파일을 읽어야 한다. 현재 동작 결함은 없다.

⑤ **수정**: 돈 경로(confirmBookingPayment, chargeCycle)는 길이만으로는 손대지 않는다 — 4개 내부 함수로 쪼개는 리팩터는 회귀 위험이 이득보다 크다. 라우트 핸들러는 해당 액션을 고칠 일이 생길 때 그 액션만 lib로 빼 단위 테스트를 붙이는 방식으로 줄인다. 테이블 디스패처나 일괄 이동 작업은 만들지 않는다(CLAUDE.md '이미 있는 것으로는 왜 안 되는가'; admin/shows/[id].ts의 switch 구조가 이미 같은 모양이라 새 규칙도 필요 없다).

⑥ 비고: 검증자가 바로잡은 요지 — 원안의 '환불 합계 중복(140-150)' 증거는 위치·용도 모두 틀렸고 가리킨 `doneRefundedTotal`은 저장소에 없다.

---

#### CQ-19. 예외 메시지 변환이 34곳에 인라인되어 있다 (메일 실패 처리 방식이 셋인 것은 요구가 달라서다) [P3 · M]

① `lib/booking/confirm.ts:222`·`:231-240`, `lib/shows/bankDeposit.ts:163-168`, `pages/[locale]/shows/success.tsx:195-199`, `lib/shows/email.ts:470-482`, `lib/payments/bankDepositOrders.ts:311-318`, `lib/booking/bankDeposit.ts:114-127`(4회), `lib/booking/webhook.ts:317`, `lib/funding/confirm.ts` 등 프로덕션 코드 34곳

② 지금 코드:

```ts
// lib/booking/confirm.ts:231-240 — 예약: 문자열|null 반환 + 예외 삼킴
const deliverConfirmedEmails = async (send: () => Promise<string | null>): Promise<string | null> => {
  try { return await send(); } catch (error) { ...; return error instanceof Error ? error.message : String(error); }
// lib/shows/bankDeposit.ts:163-168 — 공연: {sent: boolean} 반환 + 호출부 try/catch
  try { emailSent = (await sendShowTicketEmail(order.orderNo)).sent; } catch (error) { console.error(...); }
// lib/shows/email.ts:470-482, lib/payments/bankDepositOrders.ts:311-318 — notify*/send*Alert: void 반환 + 내부에서 삼킴
// `error instanceof Error ? error.message : String(error)` 34회
```

③ 왜 문제인가: 같은 변환식이 34곳에 인라인되어 있다. 메일 실패 계약이 string|null, {sent}, void 세 가지인 것은 서로 다른 요구 때문이다 — booking은 `orders.notification_error` 문자열 컬럼에 사유를 남기고, shows는 send_pending/inflight 센티널을 CAS로 선점하는 구조라 sent 불리언과 호출부 처리가 맞물려 있고, notify는 fire-and-forget이다. 확인한 호출처(webhook.ts:317, shows/bankDeposit.ts:163, shows/success.tsx:195)는 모두 try/catch로 감싸져 있다. `notifyBookingDepositWithdrawn`(booking/bankDeposit.ts:114-127)의 바깥 try는 주문 조회와 summaryOf까지 감싸므로 안쪽 try와 역할이 다르다(이중 try 아님).

④ 어떤 조건에서 어떤 결과: 문구·로깅 규칙을 바꿀 때 34곳을 찾아야 한다. 결제 후 메일 예외가 500으로 번질 호출처는 현재 없다.

⑤ **수정**: `toErrorMessage(e: unknown): string` 한 함수를 만들어(예: `lib/errorMessage.ts`) 34곳을 치환한다. `deliverSafely` 통합 래퍼는 만들지 않는다 — 반환 의미가 달라 억지 통합이 된다. 새 메일 호출을 추가할 때의 규칙은 lib/booking/confirm.ts:222 주석처럼 "가장 가까운 기존 흐름의 계약을 따른다" 정도로 CLAUDE.md의 결제 체크리스트에 한 줄 더하면 충분하다.

⑥ 비고: 검증자가 바로잡은 요지 — '하나를 빠뜨리면 SSR 500' 위험은 현재 코드에 없고, 통합 래퍼 원안은 교체.

---

#### CQ-20. 얇은 라우트 배선에 테스트가 없다: press 감상실 입장, admin/blocks, 크론 5종 [P3 · M]

① `pages/api/press/room/[room]/enter.ts:22-57`, `pages/api/admin/blocks/index.ts`, `pages/api/admin/blocks/[id].ts`, `pages/api/cron/{backup-contracts,expire-show-orders,health-check,review-requests,social-refresh}.ts`; 기존 테스트 `lib/press/listeningRoom.test.ts`, `tests/api/press/{optouts,unsubscribe}`, `lib/cron/auth.test.ts`, `tests/api/admin/auth.test.ts`

② 지금 코드:

```ts
// 비밀번호 대입 방어가 'IP당 횟수 제한뿐'인 라우트 — 라우트 테스트 없음
  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`press_room:${room.id}:ip:${ip}`, 10, 15 * 60))) {
    return res.redirect(303, `${back}?e=limit`);
  }
  const password = typeof body.password === 'string' ? body.password : '';
  if (!isRoomPasswordMatch(room, password)) return res.redirect(303, `${back}?e=1`);
```

rg로 테스트 참조 0: admin/blocks 2파일, 크론 5종, press enter.

③ 왜 문제인가: 각 라우트는 40~70줄의 얇은 배선이다. 해시 비교·토큰(lib/press/listeningRoom.test.ts, token.test.ts), 크론 인증(lib/cron/auth.test.ts), 크론 업무 로직(healthCheck.*.test.ts, reviewRequests.integration.test.ts, social/tokens.integration.test.ts), admin 인증(tests/api/admin/auth.test.ts)은 lib 쪽 테스트가 이미 있다. 빠진 것은 메서드·응답 코드·쿠키 배선이다. enter.ts가 fail-open 요청 제한과 맞물리는 것은 CQ-6에서 다룬다.

④ 어떤 조건에서 어떤 결과: 배선 회귀(메서드, 응답 코드, 쿠키 속성)가 CI를 통과할 수 있다. 데이터나 돈을 직접 깨는 종류는 아니다.

⑤ **수정**: 우선순위는 enter.ts 하나다. `tests/api/press/enter.test.ts`에 PRESS_HOST 404, GET 405, 없는 방 404, 틀린 비밀번호 303 `?e=1`, 한도 초과 `?e=limit`, 맞으면 Set-Cookie와 303을 둔다(consumeRateLimit은 mock). admin/blocks는 401·검증·삭제 404만 얕게. 크론은 CQ-14의 `notifyCronFailure` 헬퍼를 도입할 때 함께 얕은 스모크를 붙이고 지금 따로 쓰지 않는다.

⑥ 비고: 검증자가 바로잡은 요지 — 심각도 하향(얇은 배선, 업무 로직은 테스트 있음).

---

#### CQ-21. consumeRateLimit이 요청마다 만료 행 DELETE와 UPSERT를 따로 보내고 webhook_events 청소를 겸한다 [P3 · S]

① `lib/booking/rate-limit.ts:43-63`(특히 :48·:54-57·:59-63), `lib/contracts/admin-rate-limit.ts:171`·`:228`·`:288`(같은 패턴 3곳), `pages/api/cron/purge-orders.ts`, `pages/api/payments/webhook.ts`, `db/schema.ts`, `lib/booking/rate-limit.test.ts:96-124`

② 지금 코드:

```ts
// lib/booking/rate-limit.ts:48, 54-57, 59-63
    await getDb().delete(rateLimits).where(lte(rateLimits.expiresAt, nowSeconds));
    // ... webhook.ts는 이번 작업 범위 밖이라(다른 에이전트 동시 수정 대상) 건드리지 않는다.
    if (key.startsWith('webhook:')) {
      await cleanupExpiredWebhookEvents(now);
    }
    const [row] = await getDb().insert(rateLimits).values({ key, count: 1, expiresAt: nowSeconds + windowSeconds })
      .onConflictDoUpdate({ target: rateLimits.key, set: { count: sql`${rateLimits.count} + 1` } }).returning();
```

③ 왜 문제인가: 제한이 걸린 요청마다 Turso 왕복이 2회(webhook:* 키는 3회)다. 만료 리셋은 UPSERT 한 문장으로 처리할 수 있다. webhook_events 90일 청소가 범용 카운터 안에 있는데, 이는 fb632a2191에서 '새 크론을 두지 않으려고' 일부러 넣은 설계이고 rate-limit.test.ts:96-124가 그 동작을 고정한다. '다른 에이전트 동시 수정 대상' 주석은 작업 과정 흔적이다. DELETE→UPSERT 사이 틈은 실해가 없다 — 각 요청이 자기 nowSeconds로 DELETE하므로 과증가 폭은 ms 단위이고 다음 요청의 DELETE가 지운다.

④ 어떤 조건에서 어떤 결과: 요청당 왕복 1회 낭비와 책임 혼합. 데이터·보안 영향은 없다.

⑤ **수정**:
- drizzle `onConflictDoUpdate`의 `set`에 CASE를 써서 한 문장으로 만든다(생 SQL 불필요): `count: sql\`CASE WHEN ${rateLimits.expiresAt} <= ${nowSeconds} THEN 1 ELSE ${rateLimits.count} + 1 END\``, `expiresAt: sql\`CASE WHEN ${rateLimits.expiresAt} <= ${nowSeconds} THEN ${nowSeconds + windowSeconds} ELSE ${rateLimits.expiresAt} END\``. SQLite UPDATE의 우변은 모두 갱신 전 값을 본다.
- DELETE를 뺀다면 만료 행 청소를 대신 맡길 곳이 **먼저** 필요하다. `purge-orders`는 일일이 아니라 월 1회(vercel.json `0 18 3 * *`)이고 헤더가 개인정보 보관기간 파기 전용이라 다른 청소를 섞지 말라고 적혀 있으니 쓰지 않는다. 일일 크론(health-check 23:00 또는 expire-show-orders 18:30)에 rate_limits·webhook_events 청소를 넣거나, 요청의 약 2%에서만 DELETE를 하는 표본 청소를 둔다.
- admin-rate-limit.ts의 같은 패턴 3곳도 함께 본다 — consumeRateLimit만 고치면 반쪽이다.
- 주석에서 '다른 에이전트' 문장만 지우는 것은 즉시 가능하다.

⑥ 비고: 검증자가 바로잡은 요지 — 틈 위험 없음, purge-orders는 이전처로 부적합, webhook 청소는 의도된 설계. 같은 자리를 다른 축도 지적: PAY "webhook_events 정리가 레이트리밋 함수 안에 숨어 있다(구조 정리)", DB "rate_limits 호출마다 선행 DELETE 왕복 1회 추가 (소규모에서는 영향 미미)".

---

#### CQ-22. 호출처 없는 export 6개와 SQL 짝을 검증하지 않는 테스트 전용 TS 판정 정리 [P3 · S]

① 호출 0: `lib/shows/service.ts:266-273`(findShowOrderByOrderNo), `lib/funding/creatorAuth.ts:88`(loginCreatorSessionFromContext), `lib/funding/pledgeLines.ts:60`(pledgeLinesAmount), `lib/payments/paymentChoices.ts:76`(isTossPaymentChoice), `lib/shows/i18n.ts:218`(showPath), `utils/schema/media.ts:137`(generateVideoSchema); 테스트 전용: `lib/shows/time.ts`(isSalesOpen/isShowtimeLive), `lib/funding/refundable.ts:76`(isCountedFundingPledge); 유지: `lib/factGuards.ts:271`(findFactViolations), `lib/crypto/fieldCrypto.ts:282`(isEncryptedField); 대체 함수 `lib/shows/queries.ts:209`(getShowOrderForManage)

② 지금 코드:

```ts
// lib/shows/service.ts:266-273 — 호출 0, 그런데 주석은 '공통 진입점'
/** 주문번호로 티켓 주문을 조회한다(확인·환불·관리자 화면 공통 진입점). */
export async function findShowOrderByOrderNo(orderNo: string) {
  return db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo), ... });
// booking/service.ts:244 와 funding/service.ts:112 는 `orderNo.toUpperCase()`로 정규화한다 (lib/shows/CLAUDE.md의 308 규칙)
```

③ 왜 문제인가: 비테스트 호출 0인 export 6개가 남아 있다. 매직링크 착지는 POST `pages/api/funding/creator/session.ts`의 `loginCreatorSession`을 쓰므로 GSSP용 변형은 정말 죽은 코드다. `findShowOrderByOrderNo`는 toUpperCase 정규화가 없는데 '공통 진입점'이라 적혀 있고, 실제 진입점 `getShowOrderForManage`는 정규화한다. `isCountedFundingPledge`는 SQL `countedFundingPledgeSql`과 쌍인데 테스트가 TS 쪽만 검증해 둘의 드리프트를 못 잡는다. `findFactViolations`는 CI 'Test' 단계의 `content/factGuards.test.ts` 엔진이고 `isEncryptedField`는 암호화 테스트의 단언 도구라 정당한 export다.

④ 어떤 조건에서 어떤 결과: 신규 코드가 죽은 함수를 정식 진입점으로 오인할 수 있다. 특히 findShowOrderByOrderNo는 소문자로 도착한 주문번호에서 404를 재현한다. 런타임 영향은 없다.

⑤ **수정**: 호출 0 export 6개를 삭제한다. `isSalesOpen`/`isShowtimeLive`는 `lib/shows/time.test.ts`의 해당 케이스와 함께 삭제한다(판정은 SQL `showtimeSalesWindowCondition`이 한다). `isCountedFundingPledge`는 TS 쌍둥이와 그 테스트를 지우거나, 같은 케이스 표를 SQL로 돌려 보는 통합 테스트로 바꾼다. `findFactViolations`·`isEncryptedField`는 건드리지 않는다(삭제·`__testing` 격리 금지). 일괄 정리가 필요하면 `npx knip`을 일회성으로 돌려 목록을 만들되 'CI 테스트가 쓰는 엔진'은 걸러서 본다.

⑥ 비고: 검증자가 바로잡은 요지 — findFactViolations·isEncryptedField를 죽은 코드로 본 원안은 틀렸다. 원안의 179/162/8/5 수치는 knip 미설치로 재현하지 못했다.

---

#### CQ-23. 검증기가 보장한다는 이유의 non-null 단언 `!`이 반복된다 (guard()의 row!, getProduct()!, project!) [P3 · S]

① `lib/funding/creatorProjectWrite.ts:86-94`(guard)·`:199-201`·`:217`·`:224`·`:242`·`:251`·`:260`, `lib/booking/service.ts:62-63`·`:179`, `lib/booking/validation.ts`, `pages/api/bookings/index.ts:38-39`, `pages/api/funding/pledges.ts:63`·`:78`, `pages/api/orders/mixing.ts`

② 지금 코드:

```ts
// lib/funding/creatorProjectWrite.ts:199-201 — guard()가 {row, denial}을 둘 다 optional로 돌려줘 매번 row!
  const { row, denial } = await guard(creatorId, projectId, 'basic');
  if (denial) return denial;
  const locked = basicLockedViolation(row!, value);
// lib/booking/service.ts:62-63 / pages/api/bookings/index.ts:38-39 — 'validation이 보장'
  const product = getProduct(payload.productId)!; // validation이 보장
  const hours = payload.hours!;
// pages/api/funding/pledges.ts:63,78 — createFundingPledge(validated.value, project!, ...), project!.slug
```

③ 왜 문제인가: 비테스트 `!`는 46곳이고 다수가 '앞의 검증이 보장한다'는 암묵 계약에 기댄다. `guard()`는 `{ row: null, denial } | { row, denial }` 유니온을 돌려주지만 `if (denial) return denial` 뒤에도 row가 좁혀지지 않아 호출부마다 `row!`가 필요하다. 상품 조회는 검증기가 한 번 조회하고 서비스가 다시 조회한다(getProduct는 메모리 배열 find라 비용은 0). 검증기를 고치다가 보장이 깨지면 컴파일러가 알려주지 않는다. 보장은 현재 성립한다(validateCreateBookingPayload는 알 수 없는 상품이면 ok:false, resolveHours null이면 ok:false).

④ 어떤 조건에서 어떤 결과: 검증 로직 변경으로 보장이 깨지면 `Cannot read properties of undefined`로 런타임에 터진다. 결과는 DB 쓰기 전 TypeError(500)이지 결제 오염이 아니다.

⑤ **수정**: `guard()`를 `Promise<{ ok: true; row: FundingProjectRow } | { ok: false; denial: WriteResult }>`로 바꿔 `!`를 제거한다. `validateCreateBookingPayload`/`validateCreateMixingOrderPayload`/`validateCreatePledgePayload`는 이미 조회한 엔티티를 `validated.value`에 담아 반환(`{ product, hours, ... }`)하고 서비스는 재조회하지 않는다. 작고 안전한 변경이며 CLAUDE.md 규칙과 충돌하지 않는다.

⑥ 비고: 검증자 confirmed. '결제 직전 경로 포함'은 약간 과장.

---

#### CQ-24. 믹싱 주문번호 'SNB-M-' 허구 서술, 겹친 JSDoc 3곳, 작업 과정 주석 정리 [P3 · S]

① `lib/payments/recordFailure.ts:31-35`, `lib/payments/recordFailure.test.ts:16-17`, `lib/booking/token.ts:15-18`, `lib/booking/service.ts:181`; 겹친 JSDoc `lib/booking/toss.ts:131-144`(148행 상수와 분리), `pages/[locale]/funding/success.tsx:414-421`(링크 생성은 약 430행), `pages/[locale]/funding/fail.tsx:33-40`; 과정 흔적 `lib/shows/confirm.ts`(8줄) 등 lib+pages 35줄(비테스트 22줄), `lib/booking/rate-limit.ts:54`; 미확정 `lib/booking/toss.ts:145-146`

② 지금 코드:

```ts
// lib/payments/recordFailure.ts:31-35 — 'SNB-M-' 주문번호는 어떤 생성기도 만들지 않는다
 * 주문번호 형태 — 예약(SNB)·펀딩(FND)·티켓(TKT), 믹싱은 SNB-M-, 펀딩 수기는 FND-M-, ...
// lib/booking/token.ts:15-18 generateOrderNo → 믹싱도 `SNB-${ymd}-...` (createMixingOrder가 같은 함수 사용)
// lib/booking/toss.ts:145-146 — 계좌이체를 대안으로 안내
  '가상계좌는 이용하실 수 없는 결제수단입니다. 카드·계좌이체·간편결제로 다시 결제해 주세요.'
```

③ 왜 문제인가: `SNB-M-`은 주석과 테스트에만 있다 — 믹싱은 `createMixingOrder`(service.ts:181)가 `generateOrderNo`(token.ts:15-18, `SNB-...`)를 쓰고, `git log -S 'SNB-M-'`은 #213 한 커밋뿐이라 과거에도 생성된 적이 없다. 정규식은 상위집합이라 동작 영향은 없다. toss.ts:131(취소 문구 설명)과 139(승인 문구), success.tsx:415(내려받기 링크)와 419, fail.tsx:33과 35에서 JSDoc이 연달아 놓여 첫 블록이 엉뚱한 선언에 붙는다. 'finding #N'·'Task 15'·'재현 시나리오' 같은 리뷰 과정 참조가 lib+pages에 35줄 있다. toss.ts:146의 '계좌이체' 안내는 가상계좌 결제가 가능했던 위젯 경로에서만 뜨고 위젯이 계좌이체를 여는지는 토스 콘솔 설정에 달려 코드만으로 틀렸다고 못 한다(confirm.test.ts:185, lib/funding/confirm.integration.test.ts:266이 문구를 못박고 있다).

④ 어떤 조건에서 어떤 결과: 다음 사람이 존재하지 않는 형식을 전제하거나 설명 블록을 잘못된 선언의 설명으로 읽는다. 런타임 영향은 없다.

⑤ **수정**: recordFailure.ts 주석과 테스트 케이스에서 SNB-M-을 지운다(정규식은 건드리지 않아도 된다 — 좁히면 얻는 것이 없고 FND-M-/TKT-C- 짝만 맞추면 충분하다). 겹친 JSDoc 3곳은 설명을 각자의 선언 위로 옮긴다. 과정 흔적은 `rg 'finding #|Task [0-9]|브리프|다른 에이전트|재현 시나리오' lib pages` 결과에서 의미 있는 설명만 남기고 지운다. toss.ts:146 문구는 토스 콘솔에서 위젯 결제수단 구성을 운영자가 확인한 뒤에만 고친다(테스트 두 곳 동반).

⑥ 비고: 검증자가 바로잡은 요지 — 과정 흔적은 76곳이 아니라 35줄, 계좌이체 문구는 미확정. 같은 자리를 다른 축(PAY 결제·주문·예약)도 지적: "recordFailure.ts 주석과 테스트가 '믹싱은 SNB-M-' 형태를 전제하지만 generateOrderNo는 그런 번호를 만들지 않는다 — 테스트가 존재하지 않는 형식을 통과시킨다".

---

#### CQ-25. 예약·믹싱 주문 생성이 orders와 하위 행을 별 문장으로 넣어, 두 문장 사이 예외 시 awaiting_deposit 고아 주문이 남을 수 있다 [P3 · S]

① `lib/booking/service.ts:105-115`·`:134-154`(createBookingOrder), `:205-224`(createMixingOrder); 참고 `lib/shows/service.ts:97-129`(createShowOrder, batch), `pages/api/bookings/index.ts:20-24`·`:69`, `pages/api/shows/orders.ts:60-63`·`:83`, `pages/api/orders/mixing.ts:18-22`, `pages/api/funding/pledges.ts:33-42`, `pages/admin/bookings/index.tsx:76`·`:97`

② 지금 코드:

```ts
// pages/api/bookings/index.ts:20-24, shows/orders.ts:60-63, orders/mixing.ts:18-22 — 제한 먼저, 검증 나중
  if (!(await consumeRateLimit(`booking_create:ip:${ip}`, 10, 3600))) return res.status(429)...
  const validated = validateCreateBookingPayload(req.body, now);
// pages/api/funding/pledges.ts:33-42 — 정반대 결론이 주석으로 남아 있다
  // 검증을 먼저 한다 — 예전엔 rate limit을 먼저 소비해서, 폼 유효성 오류(400)만 반복해도
  // 시간당 한도가 닳아 정작 제대로 채운 제출이 429로 막혔다.
// bookings/index.ts:69, shows/orders.ts:83 — createXOrder가 이미 알던 값을 DB에서 다시 읽는다
    const created = await getDb().query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, result.orderNo) });
// lib/booking/service.ts:105-115,134-154 — orders INSERT 후 별도 문장으로 bookings INSERT
```

③ 왜 문제인가: createBookingOrder(105 orders INSERT, 134~ bookings INSERT 루프)와 createMixingOrder(205~224)는 두 문장이 한 트랜잭션이 아니다. 두 번째가 예외로 끝나면 orders만 남는다. 공연 createShowOrder는 orders+show_orders+tickets를 한 `db.batch`로 넣어 원자적이다. 제한→검증 순서는 funding이 겪은 문제의 재현이지만 예약 위저드는 클라이언트에서 먼저 검증해 400이 정상 사용자에게 거의 안 가고, slot_taken 409도 한도를 쓰는데 순서를 바꿔도 그건 안 풀린다. 재조회는 계좌 입금 응답에서만 일어나고 공연 쪽은 '서버가 저장한 값이 유일한 진실'이라는 의도를 주석으로 밝혔다.

④ 어떤 조건에서 어떤 결과: Turso 일시 오류 등 예외 한 번이 두 INSERT 사이에 나면, 고객은 500을 받아 계좌 안내를 받지 못하고 입금하지 않는다. pending 고아는 expireStaleOrders로 만료되고, awaiting_deposit 고아는 자동 만료가 없어 `pages/admin/bookings/index.tsx:76,97`에 '계좌 입금 대기'로 노출된다 — 운영자가 미입금 취소하면 된다. 정리가 수동일 뿐 돈·데이터 손실은 없다. 크래시 시점의 실제 Turso 동작은 읽기로 검증하지 못했다(확신 낮음).

⑤ **수정**: 가장 작은 수정 — createBookingOrder에서 bookings INSERT 루프를 try/catch로 감싸 예외 시 slot_taken 분기와 같은 `UPDATE orders SET status='failed'`(pending·awaiting_deposit 대상)를 시도한 뒤 다시 던진다. 믹싱은 order id를 미리 `randomUUID`로 만들어 `db.batch([orders INSERT, work_orders INSERT])`로 묶는다. 건강 점검 신설과 검증→제한 순서 변경은 얻는 것이 작아 권하지 않는다. 재조회 제거는 선택: create* 함수가 manageToken을 반환하게 하면 한 줄씩 줄 뿐이다.

⑥ 비고: 검증자가 바로잡은 요지 — '3종 모두 비원자'는 틀렸고(공연은 batch), '입금 확인 시 예약 없이 paid'는 비현실적 가정. 같은 자리를 다른 축(PAY 결제·주문·예약)도 지적: "자가 선점 해제의 두 UPDATE(bookings/work_orders→cancelled, orders→expired)가 batch 밖에서 따로 돈다 — 사이 실패 때 pending 주문 + 취소된 하위 행이 남는다".

---

#### CQ-26. og/story.tsx의 위조 가능한 IP 헤더 폴백 두 줄 제거 [P3 · S]

① `pages/api/og/story.tsx:69-75`; 비교 `lib/contracts/client-ip.ts:25-33`, `lib/contact/rateLimit.ts:41-80`

② 지금 코드:

```ts
// pages/api/og/story.tsx:69-75
  // x-vercel-forwarded-for는 Vercel 프록시가 설정해 클라이언트가 위조할 수 없다.
  const ip =
    req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
```

③ 왜 문제인가: `x-vercel-forwarded-for`가 없을 때 `x-real-ip`, `x-forwarded-for`로 폴백한다. contracts/contact 두 모듈이 같은 이유로 이미 걷어낸 폴백이다. Vercel에서는 x-vercel-forwarded-for가 항상 덮어써져 있어 도달하지 않고, 이 제한은 Redis REST 미설정·장애 시 fail-open인 best-effort다(checkOgRateLimit). 모듈마다 키 접두사가 다른 것(booking_create:ip:, og:rl:, contact ip:)은 의도이고 같은 모듈 안의 키는 항상 같은 함수가 만든다. Vercel은 ::ffff: 매핑 형식을 보내지 않는다.

④ 어떤 조건에서 어떤 결과: 프로덕션 영향 없음. 로컬·직접 호출에서만 제한 키를 위조할 수 있다.

⑤ **수정**: `x-real-ip`와 `x-forwarded-for` 두 줄을 지우고 `x-vercel-forwarded-for` → `'unknown'`만 남긴다. 공용 헬퍼(`lib/http/clientIp.ts`)·정규화 통합은 하지 않는다 — 3줄 삭제로 풀릴 일에 새 추상화를 들이는 것이고, edge 런타임의 NextRequest는 socket이 없어 contracts의 getClientIp를 그대로 못 쓴다.

⑥ 비고: 이전 리뷰(2026-08-24 #22) 일부 미처리. 검증자가 바로잡은 요지 — '모듈마다 다른 키로 한도가 느슨해진다'는 거짓. 같은 자리를 다른 축(SEO 페이지·라우팅·SEO·i18n)도 지적: "동적 OG 이미지 URL에 템플릿 버전 키가 없다".

---

#### CQ-27. getAllStories가 파싱 실패를 로그 없이 삼킨다(번역본·목록 산출물 경로) [P3 · S]

① `lib/stories.ts:304-311`, `:554-557`(loadStoryListingFile), `:256`·`:569`(기본 작성자 리터럴), `:321-450`(getStoryDetail, 약 130줄), `scripts/generate-story-listing.js:251`·`:285`; 참고 `pages/[locale]/stories/[id].tsx:419-421`, `content/ctaRouting.baseline.test.ts`, `scripts/cta-routing-baseline.ts`

② 지금 코드:

```ts
// lib/stories.ts:304-311 — 파싱 실패한 스토리가 목록에서 조용히 사라진다
    .map((slug: string) => {
      try { ... return mapStoryFrontmatter(slug, data, content, normalizedLocale); }
      catch { return null; }
    })
// lib/stories.ts:554-557 — loadStoryListingFile: catch { console.error(`[stories] lib/storyListing/${locale}.json을 읽지 못했다.`) } (원인 미기록)
// `if (enableCache) { cache.set(...) }` 20회, 기본 작성자 '스튜디오 놀' 리터럴 256·569행 두 곳
```

③ 왜 문제인가: 파일이 존재하는데 `matter()` 파싱이 던진 경우가 로그 없이 목록에서 빠진다. ko 원문은 CI에서 잡힌다 — `content/ctaRouting.baseline.test.ts`가 부르는 `computeRouting`이 모든 ko 원문에 try 없이 matter()를 호출해 YAML이 깨지면 Test 단계에서 실패한다. 잡히지 않는 것은 번역본(.en.md 등)과 `scripts/generate-story-listing.js:251,285`의 `catch { continue }`다. 이 catch는 '원문 파일 없음'(번역만 있는 slug에서 정상적으로 던져진다)도 삼키므로 catch마다 무조건 로그하면 정상 사례에서 로그가 넘친다. 스토리 페이지(`[id].tsx:419-421`)는 'Story file not found'를 걸러 내는 방식을 이미 쓴다.

④ 어떤 조건에서 어떤 결과: 번역본 한 편의 frontmatter 문법 오류가 소리 없이 해당 로케일의 목록·RSS·llms 누락으로 나타난다.

⑤ **수정**: getAllStories의 catch에서 `error.message`가 'Story file not found'로 시작하면 조용히 건너뛰고(정상), 그 외에만 `console.warn('[stories] 파싱 실패 건너뜀', { slug, locale, message })`를 남긴다. throw는 하지 않는다 — 번역본 한 편의 오류로 전체 빌드를 세우는 것은 과하다. `loadStoryListingFile`의 catch에는 error를 로그에 포함한다. 기본 작성자는 상수 하나로 묶는다. 캐시 헬퍼와 getStoryDetail 분할은 선택 사항이며 하려면 cta-routing 기준선 테스트가 보호막으로 있다.

⑥ 비고: 검증자가 바로잡은 요지 — ko는 CI가 잡는다, 무조건 warn은 로그 폭주, getStoryDetail은 150줄이 아니라 약 130줄, 빌드 throw는 과함.

---

#### CQ-28. 토스 응답 모양을 검증하지 않고 TossPayment로 단언한다(영향은 fail-closed로 제한됨) [P3 · S]

① `lib/booking/toss.ts:3-4`·`:70-92`(특히 :91), `lib/billing/toss-billing.ts:1-6`·`:11-12`·`:134`·`:172`; 소비처 `lib/booking/confirm.ts:529`·`:563`·`:577`, `lib/booking/confirmDeposit.ts:218`, `lib/booking/cancel.ts:200`, `lib/shows/refund.ts:256`, `lib/privacy/orderRetention.ts:766`

② 지금 코드:

```ts
// lib/booking/toss.ts:91
    return { ok: true, payment: json as TossPayment };
// lib/billing/toss-billing.ts:134, 172
  const payment = result.json as unknown as TossPayment;
    const payment = json as unknown as TossPayment;
// lib/billing/toss-billing.ts:11-12 — toss.ts:3-4와 같은 상수
const TOSS_API = 'https://api.tosspayments.com/v1';
const REQUEST_TIMEOUT_MS = 12000; // booking/toss.ts와 같은 기준
```

③ 왜 문제인가: 200 응답 본문의 필드를 확인하지 않고 타입만 단언한다. 현재 호출부가 `status === 'DONE'` 허용목록(confirm.ts:529)과 재조회 분기(:563)에서 status·orderId·totalAmount를 모두 대조하므로 모양이 어긋나면 거절 쪽으로 떨어진다 — 우연이 아니라 의도된 fail-closed다. 프록시의 200 오류 페이지는 HTML이라 `res.json()`이 던져 이미 NETWORK_ERROR로 처리된다. 응답 본문은 통째로 `payments.raw_response`에 저장되므로(orderRetention.ts:766 주석) 필드를 골라 담는 검증기는 쓸 수 없다. 빌링 클라이언트 중복은 toss-billing.ts 헤더(1-6행)가 밝힌 대로 시크릿(`TOSS_BILLING_SECRET_KEY`) 분리를 위한 의도된 구조다.

④ 어떤 조건에서 어떤 결과: 토스 규격 변경 시 원인 불명의 거절로 보일 뿐, 돈·데이터가 잘못 기록되는 경로는 읽은 범위에서 찾지 못했다.

⑤ **수정**: 200인데 paymentKey/orderId/status가 string이 아니거나 totalAmount가 number가 아니면 **ok:true를 유지한 채** `console.error('[toss] 예상 밖 응답 모양', { path, keys })`만 남긴다(경고용 타입 가드, 반환 객체와 raw_response 저장 내용은 그대로). 실패 코드(`INVALID_RESPONSE`)로 바꾸는 것은 권하지 않는다 — HTTP 200은 토스가 요청을 수행했다는 뜻인데 호출부는 그것을 확정 거절로 읽는다. `lib/shows/refund.ts:256`은 NETWORK_ERROR만 '응답 모른다'로 보고 그 외 실패는 `revertClaim()`으로 티켓 선점을 되돌리므로, 취소가 실제로 성사됐다면 환불된 티켓이 되살아나 재판매될 수 있다. confirm.ts:577·confirmDeposit.ts:218·cancel.ts:200도 `isInternalError`를 CONFIG_ERROR/NETWORK_ERROR로만 판정해 새 코드는 고객에게 원문이 새거나 거절로 처리된다. 바꾸려면 위 8개 파일의 분기를 전부 고쳐야 한다. billing 중복은 `TOSS_API`·`REQUEST_TIMEOUT_MS` 상수 두 줄만 export해 공유하고 요청 함수는 합치지 않는다(원안의 `requestWith`는 export되어 있지 않아 결제 핵심 모듈을 열어야 한다).

⑥ 비고: 검증자가 수정안을 교체 — 원안(INVALID_RESPONSE 실패 코드)은 돈이 움직이는 경로에서 이중 환불·티켓 재판매 위험을 만든다.

---

**클린 판정**

- 파일 수준 import 순환: lib·db·utils·data·components·hooks·types 540개 파일을 정적 분석(type-only import 제외)한 결과 lib 안의 순환 없음. 순환은 UI 2개(components/audio/GlobalPlayerDock.tsx ↔ GlobalPlayerProvider.tsx)뿐이다. 따라서 F 'infra 이동'은 기계적으로 가능하다.
- 타입 안전성 집계(비테스트): `: any`/`as any`/`@ts-ignore` 0건, `@ts-expect-error`는 테스트에만 6건. `as unknown as` 10건 중 7건은 브라우저 기능 탐지(BarcodeDetector·webkitAudioContext·ApplePaySession)와 쿠키/CSV 캐스팅으로 위험이 낮다(토스 응답 단언 3건은 별도 지적). tsconfig strict: true.
- lib/payments/bankDeposit.ts: import 0인 순수 모듈로 결제 폼(클라)과 서버가 같은 판정을 쓰고, bankDepositStateOf 인자를 필수화해 화면/서버 불일치를 막는 설계가 적절하다.
- 관리자 인증: pages/api/admin/** 전 라우트가 authenticateAdminApi를 직접 호출하거나 handleRefundAccountView(lib/payments/refundAccountView.ts)로 위임하는 것을 확인했고, 크론 10개 모두 isCronAuthorized를 호출한다. admin_session 쿠키는 sameSite strict·ttl 24h, 개설자 세션은 lax + Origin 검사로 짝이 맞는다.
- 계좌 입금 결제 행(`bank-deposit:`)의 토스 API 누수: cancelPayment/fetchPayment 호출 13곳을 모두 확인했다. 환불 경로(booking/cancel, shows/refund, shows/showtimeOps, admin bookings)는 isBankDepositPayment로, 펀딩은 pledge.paymentMethod로 분기하고 confirm 계열의 호출은 방금 토스가 승인한 결제에만 쓴다.
- 읽고 문제를 찾지 못한 파일: lib/cron/auth.ts(상수시간 비교·fail-closed), lib/email/resend.ts(html 필수·undeliverable 차단), lib/formDraft.ts, lib/rate-limit/redisRest.ts(INCR+EXPIRE NX 원자 파이프라인), lib/operatorContact.ts, lib/payments/depositGuideThrottle.ts, lib/payments/methodAlert.ts, utils/contactSubmitPolicy.ts, utils/reportPaymentFailure.ts, hooks/usePortfolioModalLazy.ts.
- 이전 리뷰(2026-08-24 1·2차)의 lib/utils 범위 지적 중 해결 확인: lint 대상에 hooks/types 포함, 크론 상수시간 비교(lib/cron/auth.ts), contact rate-limit IP 판정(x-vercel-forwarded-for), getStoryListing 로케일 검증(lib/stories.ts:595대), identity 본인확인 DB 장애 시 메모리 폴백, jest 커버리지 임계값 상향(45/33/35/47), 죽은 컴포넌트(LocalizedLink·ScrollProgress) 제거, 미사용 의존성 제거, 운영자 메일 주소 중앙화(lib/operatorContact.ts).
- webhook(lib/booking/webhook.ts): 재조회 후 멱등 키 생성, 처리 실패 시 키 회수 후 500, 취소 합계를 키에 포함 등 멱등/재시도 설계는 주석과 코드가 일치한다(구조 개선은 F 'infra 이동'·'AUTO' 항목에서만 지적).
- lib/getStatic.ts·lib/i18n.server.ts·lib/i18n.ts: 지연 로드·섹션 분할 설계는 적절하다(전역 싱글턴 문제만 별도 지적).

**읽지 못한 범위**

- lib/billing/service.ts(1,400줄대, chargeCycle 326줄)와 lib/funding/service.ts·email.ts(758줄)·creator*.ts, lib/contracts/* 대부분, lib/privacy/orderRetention.ts는 본문을 정독하지 않았다(함수 길이·중복 패턴만 AST/grep으로 측정).
- lib/booking/cancel.ts 215행 이후, lib/shows/refund.ts 280행 이후, lib/shows/showtimeOps.ts·queries.ts·email.ts 본문, lib/funding/cancel.ts 262행 이후는 읽지 않았다.
- pages/api: admin/funding/projects/[id].ts(624줄)·pledges/*, inbound/resend.ts, press/*, artists/*, subscriptions/*, cron/billing-charge.ts, llms*.ts, rss.ts는 패턴 grep과 일부 정독에 그쳤다.
- lib 최상위 40개 중 factGuards.ts·storyAutoFallback.ts·inlineDirectives.ts·routeScroll.ts·pricingSchema.ts·navLabels.ts·studioServiceSchema.ts 등은 크기와 export 사용만 확인했고 로직은 읽지 않았다. utils/의 schemaGenerator·schema/*·animationUtils·scrollUtils·shareUtils·localDataUtils·useContactForm 하단도 미정독이다.
- tsc·eslint·jest를 실행하지 않았다. 순환 import·미사용 export·함수 길이는 직접 작성한 TypeScript AST/정규식 스크립트로 분석했으며, 동적 import·문자열 참조·components 쪽 소비처는 놓쳤을 수 있다(미사용 export는 lib/utils/hooks 대상, 8건은 rg로 전체 저장소에서 재확인).
- process.env 집계와 console 로깅 집계는 grep 기반이라 destructuring·alias·템플릿 문자열 접근을 일부 놓친다. 'error 원문 로깅 225줄'에는 DB 외 오류도 섞여 있다.
- F 'i18n 싱글턴' 항목은 코드 읽기만으로 추정했으며 동시 요청 재현은 하지 못했다(확신도 0.4).

**미검증 후보(overflow)**

- 상수시간 문자열 비교가 lib/cron/auth.ts, lib/contracts/admin-auth.ts, lib/booking/token.ts(isTokenMatch), lib/press/token.ts·listeningRoom.ts, lib/email/inboundWebhook.ts 등 5곳에서 각자 SHA-256 + timingSafeEqual로 구현됨 — lib/security/safeEqual.ts 하나로 통합 (P3, S)
- 로케일 목록 하드코딩: lib/i18n.server.ts:49 allLocales 배열 리터럴(lib/i18n-config.ts의 locales와 동일), middleware.ts:14, pages/api/press/room/[room]/enter.ts:20 LOCALE_RE, lib/analytics/privatePaths.ts:52 — locales에서 파생하도록 정리 (P3, S)
- utils/useContactForm.ts의 `const trackSubmitEvent = trackFormEvent;` 호환용 별칭이 남아 있음, 312줄 훅을 입력/검증/추적으로 분리 가능 (P3, S)
- lib/i18n.server.ts loadCommonResourceServer의 readLocaleFile이 JSON 파싱 실패를 로그 없이 null로 삼켜 깨진 로케일 파일이 조용히 한국어로 대체됨 (P3, S)
- pages/api/cron/*와 pages/api/admin/* 오류 응답이 error.message 원문을 JSON으로 반환(인증된 호출이라 위험 낮음) — 일반 문구로 통일 권장 (P3, S)
- components/audio/GlobalPlayerDock.tsx ↔ GlobalPlayerProvider.tsx 순환 import (UI, 동작 문제 없음) (P3, S)
- lib/booking/webhook.ts의 isUniqueViolation이 정규식 /unique|sqlite_constraint/i로 모든 제약 위반을 '중복 이벤트'로 보고 200 처리 — NOT NULL 등 다른 제약 오류도 이벤트 유실로 이어질 수 있어 SQLITE_CONSTRAINT_PRIMARYKEY 코드로 좁히기 (P3, S)

### CNT. 콘텐츠 파이프라인·마크다운·데이터 정합

P0 0 · P1 1 · P2 10 · P3 16, 미검증 0

#### CNT-1. 감상실 운영 비밀번호 평문이 공개 저장소의 테스트 파일에 커밋돼 있다 [P1 · M]

- **위치**: `lib/press/listeningRoom.test.ts:15,19,20,24,30` · `lib/press/listeningRoom.ts`(LISTENING_ROOMS, SCRYPT_PARAMS :38) · `pages/api/press/room/[room]/enter.ts:41` · `scripts/press/hash-password.mjs` · `CLAUDE.md` 비공개 감상실 절
- **지금 코드**: `listeningRoom.ts`는 설계대로 scrypt salt+hash만 든다.
  ```ts
  export const LISTENING_ROOMS = {
    'sabbaha-slung': {
      id: 'sabbaha-slung',
      passwordSalt: 'JiaGL6y9GXmDt5eGvi2NlQ',
      passwordHash: 'zyOlm-D6sJhN72QE6gUeDuf6KG88IMDf4O0gGNmxHvU',
    },
  } as const satisfies Record<string, ListeningRoom>;
  ```
  그런데 `listeningRoom.test.ts` 15·19·20·24·30행에 실제 비밀번호 평문이 있고, 30행은 `hashRoomPassword('<평문>', room.passwordSalt)`가 저장된 `passwordHash`와 같다고 단언한다. node로 scrypt를 직접 돌려 보니 저장된 해시와 일치했다 — 곧 운영 비밀번호다. 이 파일은 감상실 도입 커밋 `99694c8720`(2026-10-07)부터 추적돼 origin/main에 있고, 저장소는 `gh repo view` 기준 PUBLIC이다.
- **왜 문제인가**: CLAUDE.md "비밀번호 원문을 커밋하지 않는다(공개 저장소)" 규칙의 직접 위반이다. 15행의 `not.toMatch` 가드는 `LISTENING_ROOMS` 객체만 검사해, 같은 파일 안의 평문과 모순된다. `enter.ts:41`의 IP당 15분 10회 제한은 온라인 대입만 막을 뿐 평문을 읽은 사람에게는 무의미하다. 참고로 이 Mac에서 scrypt 1회가 약 68ms라 짧은 단어형 비밀번호는 평문이 없었더라도 salt+hash 공개만으로 대입 가능한 수준이었다.
- **조건과 결과**: `/press/sabbaha-slung` URL을 아는 누구나 저장소에서 평문을 읽고 입장 → 곡별 6시간 서명 URL(`lib/press/audio.ts`)로 발매 전 음원(발매 2027년 초, `data/press/sabbahaSlung.ts:81`)을 받는다. 같은 앨범이 펀딩 진행 중이라 엠바고 위반 유출은 아티스트·후원자 신뢰 문제가 된다. git 이력에 남아 있어 파일만 고쳐서는 닫히지 않는다. 돈·개인정보는 아니고 noindex·robots 미기재 URL을 알아야 하므로 P0 아님.
- **수정**:
  1. 비밀번호를 지금 교체한다. `node scripts/press/hash-password.mjs '<무작위 16자 이상>'` 출력으로 `lib/press/listeningRoom.ts`의 `passwordSalt`·`passwordHash`를 갈아 끼운다. 기존 입장 쿠키가 전부 풀리는 것은 의도된 동작이다. 새 비밀번호는 초대한 매체에 다시 전달한다.
  2. `listeningRoom.test.ts`에서 실제 방을 쓰지 않는다. 테스트 전용 픽스처(예: `id: 'test'`, `salt: 'test-salt'`, hash는 `hashRoomPassword('test-pw', 'test-salt')`로 테스트 안에서 계산)로 바꿔 평문이 다시 저장소에 들어올 길을 없앤다. 15행의 `not.toMatch`는 새 비밀번호의 일부를 쓰지 말고 지우거나 "`LISTENING_ROOMS` 값은 전부 scrypt 해시 형태(base64url 길이)"라는 형식 검사로 바꾼다.
  3. 선택: `hash-password.mjs`에 14자 미만이면 경고를 출력한다.
  4. 하지 않을 것: 해시를 env로 옮기기, `ADMIN_SESSION_SECRET`에서 HMAC 후추를 갈라 섞기. 이미 공개된 평문·해시를 되돌리지 못하고, 후추 방식은 관리자 세션 비밀 회전이 곧 감상실 비밀번호 무효화가 되는 결합을 만든다.
- **비고**: 검증자가 바로잡음 — 원 지적은 "salt+hash가 공개돼 오프라인 대입이 가능하다"였으나 실제로는 평문 자체가 테스트 파일에 있어 대입조차 필요 없다. 원 제안(env 이동·HMAC 후추)은 과설계이면서 핵심(비밀번호 교체)을 못 푼다.

#### CNT-2. 펀딩 본문에 스토리용 자동 링크가 적용돼 라이브 사바하 용처 표 한 칸의 문구가 바뀐다 [P2 · S]

- **위치**: `components/MarkdownRenderer.tsx:339-342` · `components/funding/ProjectDetailView.tsx:216` · `components/markdown/autoLinks.ts` · `components/markdown/phoneLinks.ts` · `content/funding/sabbaha-slung.md:162` · `pages/[locale]/stories/[id].tsx:288,317` · `pages/[locale]/funding/[slug]/index.tsx:202` · `pages/[locale]/funding/creator/[id]/preview.tsx:76`
- **지금 코드**:
  ```ts
  const processedContent = React.useMemo(
    () => linkPhoneNumbers(autoLinkKeywords(content, currentSlug, currentLocale)),
    [content, currentSlug, currentLocale]
  );
  ```
  조건 없이 모든 본문에 자동 키워드 링크와 전화번호 링크를 건다. `ProjectDetailView.tsx:216`이 `<MarkdownRenderer content={project.content} locale="ko" />`로 같은 컴포넌트를 쓰고, 공개 펀딩 상세와 개설자 미리보기 둘 다 이 뷰를 지난다.
- **왜 문제인가**: 자동 링크(`55cbaf6348`, 스토리 품질 작업)는 스튜디오 가이드로 보내려고 만든 장치다. 펀딩 본문은 개설자(또는 캠페인 주체)의 문장이라 스튜디오 가이드 링크가 끼면 판매자/개설자 구분(펀딩 약관 제4조)이 흐려진다. git 이력에 autoLinks를 게이트한 적이 없고(`git log -S'autoLinks?:'` 빈 결과) CLAUDE.md·`lib/funding/CLAUDE.md`에 이 수정을 막는 결정도 없다.
- **조건과 결과**: `content/funding` 4편에 `autoLinkKeywords`를 돌리면 삽입되는 링크는 정확히 1개 — sabbaha-slung 용처 표의 `| 사진·뮤직비디오 | 1,000,000원 |`이 `사진·[뮤직비디오 제작 완전 가이드](/stories/music-video1)`로 바뀐다. 프로덕션 HTML(`curl https://studionol.co.kr/ko/funding/sabbaha-slung`)에서 `사진·<a href="/ko/stories/music-video1">뮤직비디오 제작 완전 가이드</a>`가 그대로 나간다(라이브 캠페인, 2026-09-29 ~ 2026-12-13). 금액·품목은 여전히 읽혀 허위고지 수준은 아니다. 운영 DB `funding_projects`는 0행이라 개설자 본문 변조는 아직 가상이지만, 첫 승인 프로젝트부터 `autoLinkKeywords('저는 홈레코딩으로 …')` → `저는 [홈레코딩 vs 스튜디오 비교](/stories/home-vs-studio1)으로 …`처럼 최대 5개 링크가 개설자 문장에 박힌다.
- **수정**: `MarkdownRenderer`에 `autoLinks?: boolean`(기본 `false`) prop을 두고 false면 `processedContent = content`. 켜는 곳은 `pages/[locale]/stories/[id].tsx` 288·317행 두 호출뿐이다(`ProjectDetailView.tsx:216`은 손대지 않음 — 기본값으로 꺼진다). 사용처가 이 세 곳뿐이라 다른 소비처 영향이 없다. 회귀 테스트는 `components/MarkdownRenderer.test.tsx`에 라이브 md를 읽지 않고 최소 문자열로: (a) `autoLinks` 없이 `'| 사진·뮤직비디오 | 1,000,000원 |'`·`'저는 홈레코딩으로'`를 렌더하면 `<a>`가 없음, (b) `autoLinks`를 켜면 `/ko/stories/music-video1` 링크가 생김.
- **비고**: 검증자가 심각도를 P1→P2로 내림(한 페이지 표 한 칸의 앵커 문구가 바뀌는 것이고 돈·데이터·법적 약속은 안 깨진다). CNT-9(lead_click)·CNT-27(대소문자 스킴)과 같은 `ProjectDetailView` 경로다.

#### CNT-3. 스토리 slug를 검증 없이 path.join에 넣어 `..%2F` 경로로 번들 안 다른 .md가 스토리로 렌더된다 — 프로덕션 도달 확인 [P2 · S]

- **위치**: `lib/stories.ts:109-122`(resolveStoryFile, 118행 path.join) · `lib/stories.ts:71-99`(getStoryAvailableLocales) · `lib/stories.ts:268-291`(getParsedStoryFile) · `lib/stories.ts:321-329`(getStoryDetail) · `pages/[locale]/stories/[id].tsx:384,391,401` · `middleware.ts:256-258` · 비교 대상 `lib/funding/projects.ts:26`
- **지금 코드**:
  ```ts
  const localeFilePath = path.join(storiesDirectory, `${slug}.${locale}.md`);   // lib/stories.ts:118
  // pages/[locale]/stories/[id].tsx:384 fallback: 'blocking' / :391 getStoryDetail(params?.id as string, locale)
  ```
  `resolveStoryFile`·`getStoryAvailableLocales` 어디에도 slug 형식 검사가 없다. Next 15.5.27 route-matcher는 `/ko/stories/..%2F..%2FCLAUDE`를 `{ locale:'ko', id:'../../CLAUDE' }`로 디코드하고, 미들웨어 256-258행은 대문자를 소문자로 308할 뿐(`%2F`→`%2f`) 막지 않는다. 펀딩 로더 `lib/funding/projects.ts:26`에는 같은 가드가 있다.
- **조건과 결과**: 로컬 재현 — `getStoryDetail('../../CLAUDE','ko')` → OK(title `'../../CLAUDE'`, 46,413자), `'../funding/sabbaha-slung'` → 펀딩 md가 스토리로, `'../../node_modules/next/README'` → OK. 프로덕션 프로브 — `GET /ko/stories/..%2Fstories%2Fvocal-mixing1` → 308(소문자) → 200, canonical `…/ko/stories/../stories/vocal-mixing1`, robots `index, follow`; `..%2Ffunding%2Fsabbaha-slung` → 200(펀딩 md가 같은 람다 번들에 있음); `..%2F..%2FREADME` → 404(루트 파일은 번들에 없음). 저장소가 공개이고 람다에는 추적된 .md만 실리므로 기밀 유출은 없다. 피해는 공격자가 고른 URL마다 기존 페이지 복제본이 index,follow + 점 세그먼트 canonical로 ISR에 1시간 캐시되는 SEO 잡음과 캐시·람다 소모다. 로컬·자체 호스팅이면 디스크의 임의 .md(`62b4262944`로 git에서 뺀 대외비 문서 포함)가 열리지만 현재 배포 형태에선 해당 없다.
- **수정**: `lib/stories.ts`에 `const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/`를 두고, `resolveStoryFile` 진입부(`getParsedStoryFile`·`getStoryDetail`·`getAllStories`가 전부 여기를 지난다)와 별도 path.join을 하는 `getStoryAvailableLocales` 진입부 두 곳에서 불일치면 `throw new Error(\`Story file not found: invalid slug ${slug}\`)`. 메시지가 `'Story file not found'`로 시작해야 `[id].tsx:401`의 catch가 로그 없이 notFound로 보낸다. `getRelatedStories`(607-615)는 path.join을 하지 않아 손댈 필요 없다. `lib/stories.test.ts`에 `getStoryDetail('../../CLAUDE','ko')`·`('../funding/sabbaha-slung','ko')`가 reject되고 `getStoryAvailableLocales('../../CLAUDE')`가 빈 배열(또는 throw)인 케이스를 추가한다. 정규식은 `content/stories`의 고유 slug 1,592개를 전부 통과한다.
- **비고**: 검증자가 P1→P2로 내리고(기밀 유출 없음) 수정 범위를 네 함수→두 진입부로 좁혔다. 리뷰어의 '1,766개'는 로케일 파일 수이고 고유 slug는 1,592개다. 같은 자리를 다른 축(SEO 페이지·라우팅·SEO·i18n)도 지적: "스토리 slug 무검증 — `..%2f` 경로 이탈로 content/funding(hidden 포함) md가 스토리로 렌더되고, `<slug>.en` 별칭이 /ko/ 아래 index·self-canonical로 200".

#### CNT-4. 숏코드 글자수 추정 표가 TS·JS·스크립트 세 곳에 따로 있어 thin 판정이 갈린다 [P2 · S]

- **위치**: `lib/sitemap/thinContent.js:13-16` · `lib/storyContentPolicy.ts:39-47` · `scripts/scan-near-duplicates.mjs:59` · `scripts/generate-story-listing.js`(thinContent의 SHORTCODE_CHAR_ESTIMATES를 import) · `lib/sitemap/routes.js`(getIndexableStoryLocales) · `content/stories/practice-room-repertoire1.md`
- **지금 코드**:
  ```js
  // lib/sitemap/thinContent.js
  const SHORTCODE_CHAR_ESTIMATES = {
    'online-fallback': 120,
    'session-checklist': 420,
  };
  ```
  `lib/storyContentPolicy.ts:39-47`은 7종(session-checklist 160, studio-more 232, studio-services 135, online-request 124, vocal-mix-bridge 224, practice-room-terms 117 …)이고, `scan-near-duplicates.mjs:59`는 studio-more 204다. 사이트맵·listing·audit-thin-content는 JS 표를, 페이지 noindex·hreflang은 TS 표를 쓴다.
- **왜 문제인가**: `lib/stories.ts`의 핵심 불변식 "사이트맵 제외 ↔ noindex 일치"가 이 사본 하나 때문에 깨져 있다. `c766feebdb`가 session-checklist를 160으로 교정할 때 TS만 고쳤다.
- **조건과 결과**: 전 스토리 1,623개에서 TS `computeThinContentStatus`와 JS `isStoryThin`을 비교하면 리다이렉트 제외 1건 불일치 — `practice-room-repertoire1.md`. 본문의 `%%studio-more%%`가 JS에선 기본값 80, TS에선 232로 계산돼 1349+80=1429<1500(thin), 1349+232=1581≥1500(색인 가능)으로 갈린다. `getStoryListing` 7,678행 vs `isBrowsableStoryForLocale` 전수 비교도 같은 1건(`ko/practice-room-repertoire1` listing=false, ts=true). 결과: 페이지는 index·hreflang 포함인데 사이트맵(`getIndexableStoryLocales('practice-room-repertoire1')` → `[]`)과 목록에서 빠진다. 반대 방향도 열려 있다 — JS 표의 session-checklist는 420, TS는 160이라 session-checklist를 쓰는 신규 얇은 글은 noindex인데 사이트맵에 실릴 수 있다(현재 어긋나는 38편은 전부 리다이렉트 slug라 `REDIRECTED_SLUGS`로 빠져 무해).
- **수정**: 숏코드 글자수를 `lib/shortcodeEstimates.json` 한 곳에 두고 `storyContentPolicy.ts`, `lib/sitemap/thinContent.js`, `scripts/scan-near-duplicates.mjs`(createRequire로 JSON 읽기) 세 사본이 전부 그것을 읽게 한다(`regionHubSlugs.json`과 같은 방식). `audit-thin-content.js`·`generate-story-listing.js`는 thinContent.js를 거쳐 자동으로 따라온다. 회귀 테스트: 전 스토리에서 `isStoryThin(JS) === computeThinContentStatus(TS)`이고, `getStoryListing(locale)`의 browsable이 `isBrowsableStoryForLocale`과 같음(리다이렉트 slug 제외). CLAUDE.md 숏코드 절에 "글자수 표는 JSON 한 곳"을 적는다.
- **비고**: 검증자가 "세 곳"의 뜻을 바로잡음 — CLAUDE.md의 세 곳(MarkdownRenderer 배선·storyContentPolicy 추정치·factGuards 화이트리스트)은 서로 다른 일이고, 글자수 표 사본은 TS + thinContent.js + scan-near-duplicates.mjs 셋이다. 원 수정안은 세 번째 사본을 빠뜨렸다. CNT-19가 같은 사안을 렌더 실측 쪽에서 적었다. 같은 자리를 다른 축(SEO 페이지·라우팅·SEO·i18n)도 지적: "쇼트코드 글자 수 표가 세 벌이라 practice-room-repertoire1이 색인 가능한데 사이트맵·목록에서 빠진다", "스토리 목록·허브 ISR 페이지의 getAllStories 사용 — listing 전환 전에 thin 상수 불일치부터 맞춰야 한다".

#### CNT-5. story listing 생성기가 TS 판정을 손으로 베낀 사본이고 TS와 대조하는 전수 테스트가 없다 [P2 · M]

- **위치**: `scripts/generate-story-listing.js:82-175` · `lib/storyListing.check.test.js:22-25` · `.github/workflows/ci.yml:32-33` · `lib/stories.ts` · `utils/textUtils.ts:11` · `lib/storyCategories.ts` · `lib/storyCategoryKeys.json`
- **지금 코드**: 생성기가 `utils/textUtils.ts`의 `stripMarkdown`/`summarizeText`, `storyCategories.ts`의 `STORY_CATEGORY_KEY_SET`·`STORY_CATEGORY_NORMALIZATION_MAP`(:119-161, 하드코딩 — `lib/storyCategoryKeys.json`이 있는데 쓰지 않음), thin 판정, 가용 로케일, `resolveStoryFile`을 CJS로 복제한다. `stripMarkdown` 사본에는 `utils/textUtils.ts:11`의 `.replace(/\\_/g, '\u0001')` 보호가 없다. CI는 `generate:manifests`(ci.yml:32-33)를 Test 단계보다 먼저 돌리므로 `storyListing.check.test.js`의 `--check`는 재생성 직후라 항상 통과한다.
- **왜 문제인가**: TS 정책을 고쳐도 listing만 옛 규칙으로 남는다. CNT-4의 practice-room-repertoire1이 바로 그 사례인데, 대조 테스트는 `stories.test.ts`의 seoul1 관련글 하나뿐이다. 생성기 머리 주석 "실제 콘텐츠로 대조해 CI에서 잡힌다"는 지금은 과장이다.
- **조건과 결과**: 현재 확인된 어긋남은 practice-room-repertoire1 1건(CNT-4). `stripMarkdown` 사본 차이는 summary가 없는 글에서만 쓰이는데 ko 1,582편·번역 포함 1,766편 전부 summary가 있어 영향 0.
- **수정**: (1) jest 테스트 추가 — 모든 로케일의 `getStoryListing` 행이 `isBrowsableStoryForLocale`·`getStoryAvailableLocales`와 일치하고 `categoryKey`가 `mapStoryFrontmatter` 결과와 같음을 전수 검증한다(7,678행이 수 초 안에 돈다). (2) 카테고리 정규화 맵을 `lib/storyCategoryKeys.json` 옆 `lib/storyCategoryMap.json`으로 빼 `storyCategories.ts`와 생성기가 함께 읽는다. (3) CI 순서 변경·산출물 gitignore는 하지 않는다 — `package.json` prebuild가 `generate:manifests`를 돌리고 `vercel.json`에 buildCommand 오버라이드가 없어 배포 산출물은 항상 재생성본이고, 4.5MB JSON의 커밋 충돌만 키운다. (1) 뒤에 생성기 머리 주석이 사실이 된다.
- **비고**: 검증자가 바로잡음 — "CI가 커밋본 최신 여부를 못 지킨다"는 운영 위험이 아니고(prebuild가 재생성), `stripMarkdown` 차이는 영향 0, 원 수정안 3(--check 순서 이동·gitignore)은 드리프트를 못 잡는 우회다. 뿌리는 CNT-4와 같다.

#### CNT-6. autoLinkKeywords가 `%%booking:…%%` 숏코드 인자 안에 마크다운 링크를 심어 화면에 문법이 그대로 보인다 [P2 · S]

- **위치**: `components/markdown/autoLinks.ts:14-19` · `components/markdown/phoneLinks.ts:20-25` · `components/MarkdownRenderer.tsx:340` · `components/markdown/contentSegments.ts:10` · `components/inline/InlineBookingCallout.tsx:60-62` · `content/stories/mariko-yukie-namsan-tower-release.md:109`
- **지금 코드**:
  ```ts
  const EXCLUSION_PATTERNS: RegExp[] = [
    /!?\[[^\]\n]*\]\([^)\n]*\)/g,
    /```[\s\S]*?```/g,
    /`[^`\n]+`/g,
    /^#{1,6}[^\n]*/gm,
  ];
  ```
  `%%…%%` 숏코드 줄이 제외 영역에 없다. `MarkdownRenderer.tsx:340`은 `linkPhoneNumbers(autoLinkKeywords(content,…))`를 원문 전체에 먼저 적용한 뒤 `splitContentByShortcodes`로 쪼갠다. `contentSegments.ts:10`은 인자를 `[^%\n]+`로 받아 링크 문법이 인자에 그대로 들어오고, `InlineBookingCallout.tsx:60-62`는 `<h4>{headline}</h4>`로 문자열 그대로 렌더해 마크다운이 해석되지 않는다. `phoneLinks.ts:20-25`는 같은 제외 목록을 복제해 같은 구멍이 있다.
- **조건과 결과**: 전 ko 스토리 1,582편에 `autoLinkKeywords+linkPhoneNumbers`를 돌려 숏코드 줄에 링크 문법이 생기는 경우는 정확히 1건 — `mariko-yukie-namsan-tower-release.md:109`의 `%%booking:음반 발매 프로젝트 상담%%` → `%%booking:[정규앨범 발매 가이드](/stories/album-release1) 프로젝트 상담%%`. 그 글의 예약(카톡 상담) 박스 제목에 `[정규앨범 발매 가이드](/stories/album-release1) 프로젝트 상담` 원문이 노출된다. 본문 다른 곳에 그 키워드가 없어 링크도 쓰이지 않는다. booking 메시지가 늘면 반복된다.
- **수정**: `autoLinks.ts`와 `phoneLinks.ts`의 `EXCLUSION_PATTERNS`에 `/^%%[\w-]+(?::[^%\n]*)?%%$/gm`을 추가한다. 두 파일이 같은 목록을 공유하도록 `components/markdown/exclusions.ts`로 뽑는 것은 선택. 회귀 테스트: `%%booking:밴드 녹음 문의%%`가 `autoLinkKeywords`·`linkPhoneNumbers`를 지나도 변하지 않음.
- **비고**: 검증자 확인(confirmed). 전환 박스 제목의 눈에 띄는 결함이라 P2.

#### CNT-7. 자동 링크가 작성자 문구를 더 긴 anchorText로 바꿔 뒤따르는 조사가 어긋난다 [P2 · S]

- **위치**: `components/markdown/autoLinks.ts:68-70` · `data/internalLinks.ts`(anchorText 정의) · `components/MarkdownRenderer.tsx`
- **지금 코드**:
  ```ts
  result = result.slice(0, match.index) +
    `[${anchorText}](${basePath}${slug})` +
    result.slice(match.index + keyword.length);
  ```
  매칭된 키워드 글자를 지우고 `[anchorText](…)`를 끼운다. `data/internalLinks.ts`는 "anchorText는 키워드와 다를 수 있음"을 명시하고, `16c9b9124e`가 "anchor 다양화"를 SEO 작업으로 넣었다.
- **조건과 결과**: 전 ko 스토리(리다이렉트 제외)에 돌리면 삽입 링크 약 2,096건이 전부 anchorText ≠ 키워드다. 바로 뒤가 은/는/이/가/을/를/과/와인 경우 355건, 그중 받침이 맞지 않아 비문이 되는 경우 191건. 예: audition1 `보컬 디렉팅`→`보컬 디렉팅 완전 가이드을`, backing-vocal1 `백보컬`→`백 보컬·코러스 녹음 가이드이`, bass-recording1 `주파수 대역`→`EQ 주파수 대역 완전 가이드을`, `홈레코딩 vs 스튜디오 비교과`. 받침이 맞는 경우도 문장 의미가 바뀐다. 소스 마크다운에는 보이지 않아(렌더 시점 치환) 글 고치는 사람이 원인을 찾기 어렵다.
- **수정**: 최소 수정 — `autoLinks.ts`에서 매칭 직후 문자가 한글(`[가-힣]`)이면 조사·어미가 붙은 자리이므로 anchorText 대신 매칭된 원문(`keyword`)을 앵커로 쓴다. 뒤가 공백·문장부호·줄끝일 때만 anchorText를 허용해 기존 anchor 다양화를 최대한 유지한다. 테스트는 "키워드+조사" 문장이 한글 뒤에서 보존되는지와 anchorText 사용 조건을 고정한다. 앵커를 전부 원문으로 바꾸는 안은 약 2,000곳의 SEO 앵커 신호가 바뀌는 결정이라 운영자 확인 뒤에만 한다.
- **비고**: 검증자가 바로잡음 — 원 수정안("항상 matchedText")은 의도된 SEO 설계(`16c9b9124e`)를 뒤집으므로 운영자 판단 사항이고, 위 조건부 안이 설계와 양립한다. 수치는 지적(198건)과 같은 규모(191건)로 재현됐다.

#### CNT-8. 검증 후보 검사가 frontmatter(title·summary·faq)를 통째로 건너뛰어 FAQ·구조화 데이터 속 날조 후보를 못 본다 [P2 · S]

- **위치**: `scripts/check-unverified-claims.mjs:63-69` · `content/unverified-claims.baseline.json` · `content/stories/mariko-yukie-namsan-tower.md`(FAQ, 본문 83행) · `content/stories/practice-room-instrument-change1.md`(FAQ) · `pages/[locale]/stories/[id].tsx:22,98-102`
- **지금 코드**:
  ```js
  const bodyOf = (file) => {
    const raw = fs.readFileSync(path.join(DIR, file), 'utf8');
    return raw
      .replace(/^---\n[\s\S]*?\n---\n/, '')
      …
  ```
  frontmatter를 통째로 지우고 `RULES`는 본문만 본다.
- **왜 문제인가**: frontmatter의 `faq`는 FAQPage JSON-LD와 가시 FAQ 섹션(`[id].tsx:22, 98-102`)으로, `summary`는 요약 박스와 메타 description으로 그대로 나간다. 메모리(GEO 인용 패턴)대로 AI 인용이 FAQ·표 숫자에 몰리므로 게이트가 가장 필요한 자리다. 번역 파일 184개와 도달 불가 리다이렉트 글도 별개로 검사 대상이 아니다.
- **조건과 결과**: export된 `scan()`에 같은 RULES를 후기 제외 ko 스토리 1,568편의 title+summary+faq(q,a)에 적용하면 2편이 걸린다 — `mariko-yukie-namsan-tower.md` FAQ "1999년 한국 최초의 일본인 록 그룹으로 데뷔했고"(본문 83행에 같은 문장이 있어 본문 기준으론 이미 기준선에 있는 후보의 중복), `practice-room-instrument-change1.md` FAQ "새 악기를 2~3배 빠르게 익힐 수 있습니다"(출처 없는 배율 단정, 실제 신규 후보). 신규 글이 FAQ 답변에 '최초' 주장을 넣어도 CI가 서지 않는다.
- **수정**: `bodyOf`가 gray-matter로 파싱해 `title`, `summary`, `faq[].q`/`faq[].a`를 본문 뒤에 이어 붙여 scan에 넘기게 바꾼다. 기준선은 위 2편의 근거를 먼저 확인·정리한 뒤 `--update`로 다시 만든다. 번역 파일은 한국어 패턴이므로 대상에서 빼되 그 사실을 스크립트 머리 주석에 적는다.
- **비고**: 검증자 확인(confirmed). 기존 구조와 충돌 없음.

#### CNT-9. 개설자 본문의 tel:·mailto: 링크가 스튜디오의 lead_click 이벤트를 발화한다 [P2 · S]

- **위치**: `components/MarkdownRenderer.tsx:287-300` · `components/funding/ProjectDetailView.tsx:216` · `utils/analytics.ts`(trackLeadEvent) · `lib/funding/creatorValidation.ts:259-269` · `scripts/ga4-fetch.mjs`(QUALIFIED_LEAD_EVENT_NAMES) · `lib/factTokens.js`
- **지금 코드**:
  ```tsx
  if (href?.startsWith('tel:') || href?.startsWith('mailto:')) {
    const isPhone = href.startsWith('tel:');
    …
    onClick={() =>
      trackLeadEvent(isPhone ? 'lead_click_phone' : 'lead_click_email', {
        locale: currentLocale,
        component: 'StoryBody',
        cta_id: isPhone ? 'story_body_phone' : 'story_body_email',
  ```
  href가 누구 것인지 보지 않는다. `ProjectDetailView.tsx:216`이 같은 컴포넌트로 개설자 DB 본문(`project.content`)을 그리고, `creatorValidation.ts:259-269`는 본문 길이(100,000자)만 검사하고 링크 스킴은 보지 않는다(`isSafeCreatorLink`는 별도 `links` 필드 전용).
- **왜 문제인가**: `lead_click_phone`/`lead_click_email`은 GA4 key event이자 `ga4-fetch.mjs`의 `QUALIFIED_LEAD_EVENT_NAMES` 5종에 들어 있어 "유일하게 신뢰 가능한 지표"(메모리 리드 지표 무결성)를 직접 올린다.
- **조건과 결과**: 실제 렌더로 `<creator@example.com>`이 mailto 앵커로, `[전화](tel:01012345678)`이 tel 앵커로 바뀌는 것을 확인했다. 펀딩 방문자가 개설자에게 전화·메일하려고 누를 때마다 스튜디오 리드로 집계된다. 지금 배포된 `content/funding/*.md`에는 tel:/mailto: 링크가 0건이고 `keep-singing-for-palestine.md:212`의 주최측 번호(010-2379-0760)는 평문이며 `linkPhoneNumbers`는 스튜디오 번호만 링크화하므로 오늘 즉시 오염되지는 않는다. 개설자가 연락처 링크를 넣는 순간 발생하는 잠복 결함이다.
- **수정**: `MarkdownRenderer`에 `trackLeads?: boolean`(기본 false) prop을 두고 스토리 페이지 두 호출(`pages/[locale]/stories/[id].tsx:288,317`)에서만 켠다. CNT-2의 `autoLinks` prop과 같은 자리·같은 두 호출이라 한 PR로 묶는다. "`CANONICAL_FACTS.phone`과 일치할 때만"으로 좁히는 대안은 href 형태가 `tel:01042557893` / `tel:010-4255-7893` / `tel:+821042557893` 등 여러 가지라 숫자만 남기는 정규화가 필요해 prop 쪽이 더 단순하다. 테스트: `trackLeads` 없이 렌더한 `tel:` 앵커 클릭에 `trackLeadEvent`가 호출되지 않음.
- **비고**: 검증자 확인(confirmed). 같은 지점의 대소문자 문제는 CNT-27로 별건이다.

#### CNT-10. 영어 연락 화면의 가격이 상수가 아니라 리터럴이고 가격 가드가 이 파일과 ₩ 표기를 보지 않는다 [P2 · M]

- **위치**: `components/contact/EnglishFastContactActions.tsx:84` · `data/pricing.test.ts:400-512`(리터럴 스캔, :473 정규식, :489 대상 목록, :215 studio-info 가드) · `data/pricing.ts` · `components/contact/EnglishFastContactActions.test.tsx` · 참고 `data/home.ts`(₩ 카피 24곳) · `data/authorProfile.ts`(`₩300M`)
- **지금 코드**:
  ```
  Recording ₩100,000/hr · 1-song vocal package ₩250,000 · Mixing from ₩200,000/song
  ```
  바로 위 주석은 "수치는 pricing.ts SSOT / llms.txt English Quick Facts와 일치"라고 주장한다. `data/pricing.test.ts:473`의 `const AMOUNT = /(\d[\d,]{2,})\s*원|(\d+)\s*만원/g;`는 `₩` 접두 표기를 읽지 않고, :489의 스캔 대상은 `data/**`·`components/inline`·`components/funding`뿐이다. `EnglishFastContactActions.test.tsx`는 링크·이벤트만 본다.
- **왜 문제인가**: 오늘 값은 SSOT와 일치한다(RECORDING_HOURLY_PRICE=100000, VOCAL_PACKAGE_PRICE=250000, MIXING_LEVEL1_PRICE=200000). 즉 터진 버그가 아니라 드리프트 잠복인데, 같은 부류 사고가 이미 두 번 있었고(2026-09-25 InlineServiceCallout, 2026-09-02 buyerIntentHubs) CLAUDE.md가 "카피에 새 가격을 넣을 땐 formatPriceLabel로 상수에서 끌어온다"고 못박았다. `components/` 아래에서 ₩ 가격 리터럴이 가드 밖에 있는 파일은 이것 하나다(pages 0건, lib는 `lib/shows/i18n.ts:24` 주석 1건).
- **조건과 결과**: 세 상수 중 하나를 바꾸면 영어 연락 화면만 옛 값으로 남는다. 이 칸은 LLM 유입 영어 방문자에게 클릭 없이 가격을 보여주려고 만든 자리라 오표시가 곧 고객 안내 불일치다.
- **수정**: (1) 84행을 상수에서 끌어온다 — `${formatPriceLabel(RECORDING_HOURLY_PRICE,'en')}/hr`, `${formatPriceLabel(VOCAL_PACKAGE_PRICE,'en')}`, `${formatPriceLabel(MIXING_LEVEL1_PRICE,'en')}/song`(출력이 현재와 글자 그대로 같다). (2) 회귀 방지는 좁게: `EnglishFastContactActions.test.tsx`에 렌더 텍스트가 위 상수 파생 문자열을 포함함을 단언하거나, `data/pricing.test.ts:215` studio-info 가드와 같은 방식으로 이 파일이 상수를 import하고 `₩\d` 리터럴이 없음을 단언한다. (3) `data/` 스캔에 ₩를 넣는 것은 별도 작업으로 분리한다 — `data/home.ts`의 `₩100K/hr`·`₩360K`(K 접미사라 100/360으로 파싱돼 오탐, 일곱 로케일), `data/authorProfile.ts`의 `₩300M`(외부 시세) 때문에 K/M/万 접미사 파서와 허용목록이 먼저 필요하다. `pages/**`·`lib/llms/**`는 이미 상수 보간이라 넓혀도 얻는 것이 없다.
- **비고**: 검증자가 바로잡음 — 원 수정안의 스캔 확대(`components/**`·`pages/**`·`lib/llms/**` + `₩\s?\d`)는 그대로 넣으면 오탐이 난다. 집합 포함 판정의 값 겹침(100000이 RECORDING_HOURLY·MASTERING_SINGLE·VOICEOVER_HOURLY에 걸침)은 사실이지만 이 파일은 애초에 스캔 대상이 아니라 직접 원인이 아니다. `data/home.ts`의 ₩ 카피 현재 값(₩100K, ₩360K, ₩200,000, ₩500,000)은 SSOT와 일치한다.

#### CNT-11. 무언어 코드 펜스가 인라인 칩 스타일로 그려지고 pre에 가로 스크롤이 없어 모바일에서 긴 줄이 잘린다 (라이브 146편) [P2 · S]

- **위치**: `components/MarkdownRenderer.tsx:194-208`(prism 링크 주입 effect)와 `code` override · `styles/globals.css`(`.markdown-content pre` 규칙 없음, :244-245 `overflow-x: clip`) · `components/Layout.tsx:191`(`overflow-x-hidden`) · `public/styles/prism-theme.css`
- **지금 코드**: `code` override가 className 없는 코드를 인라인 칩(`bg-gray-100 px-1.5 py-0.5 rounded text-sm`)으로 그리는데 펜스 코드도 같은 경로를 탄다. `renderToStaticMarkup` 결과 — 무언어 펜스 → `<pre><code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm">`; 언어 지정 펜스(```js) → `<pre><pre class="… language-js"><code …>` 중첩. `.markdown-content pre` 규칙이 없어 pre는 `overflow: visible`이고, `Layout.tsx:191`의 `overflow-x-hidden`(globals.css에서 `clip`)이 페이지 가로 스크롤을 막아 넘친 글자가 스크롤도 못 하고 잘린다.
- **조건과 결과**: `content/stories`·`funding`에 언어 지정 펜스 0개, 무언어 여는 펜스 2,469개(264편). 폭 40칸(한글 2칸) 넘는 펜스 줄이 있는 라이브 글 146편(342줄) — 신호 흐름도·도표 등. 프로덕션 `/ko/stories/practice-room-drum-paradiddle1`을 375px 모바일로 열면 `pre.scrollWidth` 531 > `clientWidth` 343이고 요소 스크린샷에서 "PAS(Percussive Arts Society)가 1984년 정리한…" 줄이 오른쪽에서 잘려 읽을 수 없다. prism 스타일시트 상시 주입(1,787바이트, 마운트당 1회)과 언어 펜스 중첩 pre는 현재 내용에서 영향이 거의 없다.
- **수정**: markdown-to-jsx에 `pre` override(또는 CSS)를 두어 `.markdown-content pre { overflow-x: auto; max-width: 100% }`를 주고, pre 안의 code는 칩 스타일을 빼고 블록 스타일(`p-4 bg-gray-100 rounded-lg`, `white-space: pre`)로 그린다(`code` override에서 부모가 pre인지 또는 className 유무가 아니라 블록 여부로 분기). prism 링크 주입을 CodeBlock effect로 옮기고 CodeBlock이 `<code>`만 반환하게 하는 정리는 선택. 수정 뒤 375px 모바일 실화면(CLAUDE.md 로컬 프로덕션 빌드 절, `VERCEL_ENV=preview npx next start`)으로 확인한다.
- **비고**: 검증자가 바로잡음 — 원 지적의 제목 사안(prism CSS 주입·중첩 pre)은 사소하고, '미확인'으로 적혀 있던 잘림 쪽이 실재해 P2로 올렸다. 숫자 정정: 무언어 펜스는 4,938개(``` 줄 수)가 아니라 여는 펜스 2,469개다.

#### CNT-12. 미등록 category 값이 조용히 recording으로 떨어진다 (현재 lesson1 1건) [P3 · S]

- **위치**: `content/stories/lesson1.md:6` · `lib/storyCategories.ts:82-91`(normalizeStoryCategoryKey) · `content/cta-routing.baseline.json`(lesson1 항목) · `scripts/generate-story-listing.js` · `scripts/content-quality-check.js`
- **지금 코드**:
  ```ts
  export const normalizeStoryCategoryKey = (category?: string): StoryCategoryKey => {
    if (!category) return 'recording';
    …
    return 'recording';
  };
  ```
  `lesson1.md:6`의 `category: 레슨 가이드`는 `STORY_CATEGORY_NORMALIZATION_MAP`에 없어 recording이 되고, 기준선에 `lesson1: {"category":"recording","cta":"lesson","price":"lesson-monthly"}`로 굳어 있다. 전 스토리(번역 포함)에서 맵에 없는 값은 '레슨 가이드' 1건과 `foreign-musicians` 8파일(4 slug × en/zh, 번역 전용)뿐이다.
- **조건과 결과**: lesson1이 녹음 가이드 목록과 관련글 순위에 섞인다. CTA와 가격 카드는 frontmatter `inlineFallback.price: lesson-monthly`와 slug 패턴이 이미 lesson이라 영향 없다. foreign-musicians는 외국인 녹음·연습실 안내라 recording 버킷이 의미상 틀렸다고 보기 어렵다. 새 글에서 category 오타가 나도 조용히 recording이 되는 가드 부재는 남는다.
- **수정**: `lesson1.md`의 category를 `강좌`(= lesson 키)로 고치고 `cta-routing.baseline.json`의 lesson1 category만 갱신한다(`npm run check:cta-routing` → `--update`; diff에서 cta·price가 안 바뀌었는지 확인). 재발 방지로 content 테스트 하나를 추가해 ko 스토리의 category가 맵에 명시돼 있어야 하고 기본값 분기에 의존하지 않음을 검사하되, 번역 전용 `foreign-musicians`는 이유와 함께 허용 목록에 둔다. 맵 JSON 공유는 CNT-5 (2)와 함께 처리한다.
- **비고**: 검증자가 바로잡음 — "자동 폴백이 recording 규칙으로 분기한다"는 사실이 아니며, 실제로 틀어지는 것은 목록 소속과 관련글 순위뿐이다. 맵 변경 없이 category 한 줄 수정이 최소 처방이다.

#### CNT-13. 기준선 --update가 증가분도 그대로 받아들인다 [P3 · M]

- **위치**: `scripts/check-unverified-claims.mjs:122-126` · `scripts/check-duplicate-sections.mjs:77-88` · `scripts/cta-routing-baseline.ts:71-79` · 비교 대상 `content/fundingTermsHash.ts:96`(assertBaselineUpdateAllowed)
- **지금 코드**:
  ```js
  if (update) {
    fs.writeFileSync(BASELINE, JSON.stringify({ files: now }, null, 2) + '\n');
    console.log(`기준선 갱신: …`);
    return;
  }
  ```
  후보가 늘어난 상태도 그대로 새 기준선이 된다. 근거 확인은 "커밋 메시지에 이유"라는 사람의 규칙(스크립트 머리 주석·실패 메시지·CLAUDE.md)에만 의존한다.
- **조건과 결과**: 새 글의 날조 후보 문장이 `--update`와 함께 들어가면 CI가 초록이 된다. 다만 JSON diff에 증가가 그대로 보이고, 실제 갱신 이력(`e960e73231` 등 8개 커밋)은 전부 후보를 줄이는 사실 점검 PR이라 남용 사례는 없다.
- **수정**: claims·dup-sections 두 스크립트에서만 `--update`가 (파일,규칙) 개수 증가를 감지하면 증가분을 출력하고 `--allow-increase` 없이는 exit 1 하게 한다(각 10줄 안팎, `fundingTermsHash` 방식의 가벼운 판). history/`--reason` 필드, 공통 모듈, CI의 PR JSON 검사는 만들지 않는다 — 검증할 수 없는 문자열은 형식적 절차가 되고 CLAUDE.md "단순하게" 원칙에 어긋난다. cta-routing은 '증가'라는 단조 지표가 없어(any change) 현행 커밋 메시지 규칙을 유지한다.
- **비고**: 검증자가 바로잡음 — 이는 설계된 탈출구이고 문서화돼 있으며, `fundingTermsHash`의 게이트와 성격이 다르다(약관은 기계 판정 규칙이 있지만 후보 증가의 정당성은 사람 판단). 같은 자리를 다른 축(TST 테스트·CI·빌드 파이프라인)도 지적: "검증 필요 후보 게이트가 개수만 비교해 줄인 만큼의 여유 칸이 새 후보로 채워질 수 있다".

#### CNT-14. first-claim 규칙의 `다\b`는 한글 뒤에서 절대 매치하지 않는다 (현재 노출 0건) [P3 · S]

- **위치**: `scripts/check-unverified-claims.mjs:43` · `scripts/check-unverified-claims.test.ts`
- **지금 코드**:
  ```js
  pattern: /최초(?:로|의|\s|였|입니다|다\b|는)|처음으로\s*(?:사용|도입|구현|개발|만들|적용|상용화)|(?:을|를)\s*발명했/g,
  ```
  JS `\b`는 ASCII 단어 문자 경계라 한글 '다' 뒤 공백·마침표·줄끝에서는 경계가 아니다. 실행 확인: '이것이 최초다.', '최초다 그래서', '최초다', '최초다\n' 전부 null('최초다a'만 매치), '최초입니다'는 매치.
- **조건과 결과**: 신규 글에 '최초다' 단정문이 들어와도 CI가 서지 않는다. 현재 ko 스토리 본문에 '최초다'(비한글 앞) 출현 0건, '최초' 뒤에 나열된 연결 외 글자가 오는 경우도 0건이라 기준선·CI 결과는 바뀌지 않는다. '최초이다·최초이며·최초라고' 같은 다른 종결도 패턴에 없다는 점이 더 넓은 누락이다.
- **수정**: `다\b`를 `다(?![가-힣])`로 바꾸고 `check-unverified-claims.test.ts`에 '최초다.', '최초다\n' 픽스처를 추가한다. 이어서 `이다|이며|라고` 종결을 같은 규칙에 넣을지는 `node scripts/check-unverified-claims.mjs --show`로 코퍼스 오탐을 먼저 본다.
- **비고**: 검증자가 P2→P3로 내림(현재 노출 0, 한 줄 수정).

#### CNT-15. CTA 라우팅 기준선이 글별 최종 본문 중간 박스(service·review·booking)를 스냅샷하지 않는다 [P3 · M]

- **위치**: `scripts/cta-routing-baseline.ts:33-50` · `lib/stories.ts:371-413`(matchServiceForStory·matchReviewForCategory·decideAutoFallback 인라인) · `lib/storyAutoFallback.ts` · `lib/inlineDirectives.ts` · `content/ctaRouting.baseline.test.ts`
- **지금 코드**:
  ```ts
  const cta = resolveStoryCTAType({ slug, categoryKey, override: d.cta as never });
  const price = resolveFallbackPriceId({ categoryKey, slug, frontmatterFallback: d.inlineFallback as { price?: string } | undefined });
  out[slug] = { category: categoryKey, cta, price };
  ```
  기준선은 하단 CTA와 가격 카드 id만 담는다. 본문 중간 박스의 실제 주입 결정은 `lib/stories.ts:371-413`에 있다.
- **조건과 결과**: `storyAutoFallback.test.ts`(PRICING/SERVICE/REVIEW_BY_CATEGORY 전 카테고리 매핑과 지역 분기), `serviceBridge.test.ts`(고트래픽 글의 명시 `%%service:%%`), `vocalCategoryNoLesson.test.ts`(보컬 글의 lesson 가격·CTA)가 표 단위로 지키고 있어 게이트가 없는 것은 아니다. 남는 틈은 카테고리 표·우선순위 조합이 만든 글별 최종 박스를 전수 스냅샷하지 않는 것 — 표를 바꾸고 표 테스트를 함께 고치면 통과하며 1,000여 편에 미치는 순효과가 diff로 안 보인다. frontmatter `inlineFallback` 타입은 price/review/booking뿐이라 service는 표에서만 나온다. 보컬 글 본문 `%%service:lesson%%`·`%%price:lesson%%` 출현 0건. 확인된 위반 없음.
- **수정**: `getStoryDetail(ko)`가 반환하는 content에서 삽입된 자동 마커(`%%price:`|`service:`|`review:`|`booking:`)를 읽어 기준선 entry에 `inline` 필드를 추가한다. 결정 로직 추출·리팩터는 하지 않는다(hot path인 `getStoryDetail`을 건드리는 큰 리팩터라 이득 대비 위험이 큼). 변경 후 최초 `--update`는 inline 필드 추가만 담아야 하고 기존 cta/price는 diff가 없어야 한다.
- **비고**: 검증자가 바로잡음 — "게이트가 서지 않는다"는 과장이고, 원 수정안의 `resolveAutoFallback` 추출 대신 이미 있는 `getStoryDetail` 결과를 읽는 쪽이 단순하다.

#### CNT-16. 본문 내부 링크만 기본 prefetch라 다른 스토리 링크와 정책이 어긋난다 [P3 · S]

- **위치**: `components/MarkdownRenderer.tsx:323-327` · 비교 `components/StoryCard.tsx:49-52` · `components/StoryCTA.tsx:266-281` · `components/story/*.tsx` · `components/LanguageSwitcher.tsx`
- **지금 코드**:
  ```tsx
  <NextLink href={finalHref ?? '/'} className={mergeClassNames('text-primary dark:text-primary-lighter hover:underline underline-offset-4', className)} {...props}>
    {children}
  </NextLink>
  ```
  `prefetch` 미지정(기본 true). 카드·CTA·언어 전환은 전부 `prefetch={false}`다(CLAUDE.md 스토리 프리렌더 절의 이유).
- **조건과 결과**: ko 스토리 평균 내부 링크 5.2개, 최대 32개(`mixing-complete-guide.md`) + 자동 링크 최대 5개. 긴 글을 읽으면 viewport에 든 링크마다 `_next/data` JSON을 받는다. ko 대상은 `getStoryPaths`가 전부 프리렌더하므로 CDN 정적 응답이고 ko 스토리 평균 약 9KB라 gzip 후 링크당 수 KB, 평균 5개면 읽는 동안 수십 KB가 idle 시점에 나간다 — LCP·TBT에 영향 없음. 번역 글 본문의 `/en/…` 링크가 대상 로케일 원문이 없는 글로 향할 때만 ISR 생성을 일으키는데 그 규모는 확인하지 못했다. 본문에는 `/pricing`·`/recording` 같은 상업 LP 링크도 있어 prefetch를 끄면 클릭 후 전환 구간이 느려질 수 있다.
- **수정**: href가 `/{locale}/stories/`로 시작할 때만 `prefetch={false}`를 주고 LP 링크는 기본값을 유지하는 안을 먼저 검토한다. 전체 적용을 원하면 StoryCTA와 같은 정책이라 한 줄 변경이다. Next 15.5.27 `link.js`에서 `prefetchEnabled = prefetchProp !== false`이고 viewport prefetch만 꺼지며 onMouseEnter·onTouchStart prefetch는 남으므로 기존 정책과 일치한다. 네트워크 탭 요청 수 실측이 없으니 우선순위는 낮다.
- **비고**: 검증자가 P2→P3로 내림(측정 없이 올릴 근거 부족).

#### CNT-17. 중복 텍스트 헤딩이 같은 id를 가져 목차 항목이 첫 헤딩으로 이동한다 (ko 18편 27그룹, th 11편은 전부 id=section) [P3 · M]

- **위치**: `components/markdown/headings.ts:14-23`(toHeadingId) · `components/markdown/extractHeadings.ts:108-111` · `components/MarkdownRenderer.tsx` · `components/markdown/TableOfContents.tsx` · `next.config.mjs`(reactStrictMode true)
- **지금 코드**:
  ```ts
  export const toHeadingId = (children: React.ReactNode): string => {
    const text = extractTextContent(children);
    return text.toLowerCase()….replace(/^-|-$/g, '') || 'section';
  };
  ```
  텍스트만으로 id를 만든다. `extractHeadings.ts:108-111` 주석은 "중복 텍스트 헤딩은 getElementById가 첫 요소로 이동한다(허용 가능한 degrade)"로 이전 리뷰(docs/code-review-2026-09-08 #10)의 의도된 트레이드오프다.
- **조건과 결과**: `renderToStaticMarkup`으로 `## 장점`을 3번 렌더하면 `<h2 id="장점">`이 3번 나오고 `extractMarkdownHeadings`도 같은 id를 3번 낸다. ko 라이브 18편 27그룹 — daw-choice1 '장점'×3 '단점'×3 '이런-분에게-추천'×3, drum-recording1 '킥-드럼'×2 '스네어'×2 등. 목차의 같은 이름 항목이 모두 첫 섹션으로 점프하고 HTML id가 중복된다. 더 큰 사례: th 로케일 글 11개는 태국어 글자가 `toHeadingId`에서 전부 지워져 모든 헤딩이 `id="section"`이다(bulgwang-mixing-club-2nd.th 6개 등).
- **수정**: 두 길 중 하나.
  - (단순) 18편의 중복 소제목에 맥락어를 붙이고 content 테스트로 "글당 중복 헤딩 id 0"을 강제. th 11편은 `toHeadingId`가 비ASCII 유니코드 문자(태국 문자 포함)를 지우지 않게 정규식을 넓힌다.
  - (구조) 할당기(allocator)를 markdown-to-jsx의 `slugify` 옵션으로 쓴다(override의 `id={toHeadingId(children)}`는 `{...rest}`가 덮어쓰므로 slugify 결과가 최종 id). 할당기는 렌더 중 상태가 아니라 `MarkdownRenderer`의 `useMemo` 콜백 안에서 새로 만든다 — `reactStrictMode`가 true라 자식(Markdown) 렌더 중 호출되는 상태성 카운터는 개발 모드 이중 호출로 번호가 밀린다. 그러려면 세그먼트별 `<Markdown>` 대신 `compiler()`를 그 useMemo에서 한 번 돌리거나, 문서 전체 헤딩 id 배열을 순수 함수로 미리 계산해 순번으로 꺼낸다. `extractMarkdownHeadings`는 level 필터 전에 모든 ATX 헤딩(1~6)에 할당기를 적용한 뒤 2~3만 반환해야 DOM과 번호가 같다(렌더러는 h1~h4를 할당하고 h5·h6은 slugify 옵션이므로, 사이에 h4가 낀 중복에서 TOC와 DOM 접미사가 갈린다).
- **비고**: 검증자가 바로잡음 — 원 수정안은 그대로 구현하면 level 필터와 StrictMode 때문에 어긋난다. 같은 자리를 다른 축(FE 프론트엔드 컴포넌트·디자인 시스템·접근성)도 지적: "toHeadingId가 태국 문자를 지워 번역 스토리 11편에서 헤딩 id가 'section'으로 겹친다".

#### CNT-18. 인라인 박스 상한 규칙이 파서·렌더러에서 다르게 구현돼 있고 MAX_TOTAL_BOXES는 죽은 코드다 [P3 · S]

- **위치**: `lib/inlineDirectives.ts:32-46,73,90` · `components/markdown/contentSegments.ts:10` · `components/MarkdownRenderer.tsx:380-381` · `lib/storyAutoFallback.ts`(decideAutoFallback, injectAutoFallbackMarker) · `content/stories/audiobook-guide1.md:49,217,248` · `content/storyPriceIds.test.ts`
- **지금 코드**:
  ```ts
  const DIRECTIVE_LINE_RE = /\n%%([\w-]+)(?::([^%\n]+))?%%(?=\n|$)/g;   // 본문 첫 줄 지시문은 매치 안 됨
  …if (authorBoxes >= MAX_AUTHOR_BOXES) continue;   // 파서는 2개에서 멈춤
  export const MAX_TOTAL_BOXES = 3;  …  if (input.authorBoxes >= MAX_TOTAL_BOXES) return null;   // authorBoxes가 최대 2라 도달 불가
  ```
  `contentSegments.ts:10`은 `(?:^|\n)`로 첫 줄도 매치하고, `MarkdownRenderer.tsx:380-381`은 arg가 없거나 모르는 id여도 `inlineBoxCountRef` 슬롯을 소모한다. `parseInlineDirectives('%%price:a%%\nfoo').authorBoxes === 0`(렌더는 처리).
- **조건과 결과**: 라이브에서 드러난 것은 `audiobook-guide1.md`가 service(49행)·price(217행)·review(248행) 3개라 3번째 review-1이 렌더되지 않는 1건(전수 비교: over2=1, mismatch=0). 본문 첫 줄이 지시문인 글은 1,582편 중 0편이라 파서 불일치는 잠재. 폴백 마커는 마지막 H2 앞에 삽입돼 문서 순서 상한에서 폴백이 먼저 잘리므로 "작가 박스가 밀려난다"는 현재 내용에선 없다.
- **수정**: 정규식을 `contentSegments`와 같은 상수(`SHORTCODE_LINE_SPLIT`)로 공유한다. `MAX_TOTAL_BOXES`는 삭제하거나, 의도가 "폴백 포함 합계 상한"이면 `MAX_AUTHOR_BOXES`(2)와 같게 두고 개수 판정을 한 함수로 모은다 — 먼저 의도를 정할 것. `audiobook-guide1.md`의 3번째 지시문을 정리한다. content 테스트로 "스토리당 inline 지시문 ≤ MAX_AUTHOR_BOXES"와 service·review id 유효성(현재 `storyPriceIds.test.ts`는 price만 검증)을 추가한다.
- **비고**: 검증자가 영향 서술을 바로잡음(잠재 불일치 + 글 1편 조용한 누락 + 죽은 상수). 이전 리뷰 2026-08-24 round2 #26(contentSegments 첫 줄 shortcode)과 같은 뿌리.

#### CNT-19. topicLinks '음감 훈련'이 308로 리다이렉트되는 slug를 가리키는데 레지스트리 테스트는 이를 보지 않는다 [P3 · S]

- **위치**: `data/internalLinks.ts:66` · `lib/regionRedirectMap.json:79` · `content/storyLinks.test.ts:57-85`(본문 링크 리다이렉트 검사), `:93`(레지스트리 describe)
- **지금 코드**:
  ```ts
  '음감 훈련': { slug: 'ear-training1', anchorText: '음감 훈련 가이드' },
  ```
  `regionRedirectMap.json`은 `"ear-training1" → "eartraining1"`이다. `ear-training1.md`·`eartraining1.md` 두 파일이 모두 존재해 레지스트리 describe(존재·라우트만 검사)를 통과한다. topicLinks 전수를 redirectMap과 대조하면 이 1건뿐이다.
- **조건과 결과**: 자동 삽입된 내부 링크가 308을 한 번 거친다(크롤 예산·링크 에쿼티 손실, 사용자에겐 한 번 더 이동).
- **수정**: slug를 `'eartraining1'`로 바꾼다(앵커 '음감 훈련 가이드'는 그 글 주제인 귀 훈련·청음과 맞는다). `storyLinks.test.ts`의 레지스트리 describe에 `expect(redirectMap[slug]).toBeUndefined()` 검사를 추가한다.
- **비고**: 검증자 확인(confirmed).

#### CNT-20. 숏코드 글자수 추정표 사본이 어긋나 사이트맵 thin 판정과 페이지 판정이 갈린다 (thinContent.js 2항목 vs storyContentPolicy.ts 7항목) [P3 · M]

- **위치**: `lib/sitemap/thinContent.js:11-15` · `lib/storyContentPolicy.ts` · 숏코드 이름 사본 `scripts/content-quality-check.js:130`(SHORTCODE_WORD_ESTIMATES) · `content/factGuards.test.ts:77`(BLOCK_SHORTCODE_NAMES) · `lib/funding/creatorContent.ts:17`(TRUSTED_SHORTCODE_NAMES) · `components/MarkdownRenderer.tsx` renderSegment
- **지금 코드**: `storyContentPolicy.ts`의 `SHORTCODE_CHAR_ESTIMATES`는 7항목(online-fallback 120, session-checklist 160, …), `thinContent.js`는 online-fallback 120·session-checklist 420 둘뿐이다. 렌더 실측(renderToStaticMarkup 후 공백 제외 글자): online-fallback 59(추정 120), session-checklist 160, studio-more 232, studio-services 135, online-request 124, vocal-mix-bridge 227(추정 224), practice-room-terms 117. 표를 실측과 일치시키는 테스트가 없다. online-fallback 라이브 사용은 0건.
- **조건과 결과**: CNT-4와 같은 1편(practice-room-repertoire1, 비공백 1349 + studio-more 사이트맵 80/페이지 232)이 "색인 가능인데 사이트맵 제외"로 어긋나고 나머지 36편은 리다이렉트라 무해. 영향은 안전한 방향(사이트맵 누락)이다. 새 숏코드를 추가할 때마다 반복된다.
- **수정**: CNT-4의 JSON 단일화에 더해 jest 테스트 하나로 "각 블록 숏코드를 ko로 렌더한 공백 제외 글자 수 ≈ 표 값(±3)"과 "표 키가 렌더러의 블록 숏코드 이름과 일치"를 검사한다. 이 테스트가 있으면 online-fallback 120→59, vocal-mix-bridge 224→227도 함께 맞춘다. 숏코드 이름 5곳 전체를 레지스트리로 합치는 것은 CLAUDE.md "단순하게"에 비해 과해 하지 않는다.
- **비고**: 검증자가 바로잡음 — 원 지적은 사본 나열이었고 실제 어긋난 사본은 thinContent.js 하나라는 점을 구체화했다. CNT-4와 한 PR로 처리한다. 같은 자리를 다른 축(SEO 페이지·라우팅·SEO·i18n)도 지적: "쇼트코드 글자 수 표가 세 벌이라 practice-room-repertoire1이 색인 가능한데 사이트맵·목록에서 빠진다", "스토리 목록·허브 ISR 페이지의 getAllStories 사용 — listing 전환 전에 thin 상수 불일치부터 맞춰야 한다".

#### CNT-21. 코드가 읽지 않는 frontmatter 필드 80건(description 36·slug 27·keywords 17) — 증가는 없다 [P3 · S]

- **위치**: `lib/stories.ts:236-262`(mapStoryFrontmatter) · `content/stories/*.md` 80파일(예: `content/stories/commercial-narration-cost-guide.md`의 `description:`)
- **지금 코드**: `mapStoryFrontmatter`는 title/date/author/category/tags/summary/thumbnail/images/cta/robots/faq/howTo/inlineFallback/lastmod만 읽는다. `description` 36파일·`slug` 27파일·`keywords` 17파일은 grep으로도 소비처가 없다. 예: `commercial-narration-cost-guide.md`의 `description: "광고·기업 영상 나레이션 녹음 비용 … 성우/나레이션 녹음 시간당 100,000원."`은 meta description으로 쓰이지 않는다.
- **조건과 결과**: 기능 영향 없음 — description이 있는 36편 전부 summary도 있어 메타는 summary에서 나가고, slug 값은 파일명과 동일하다. `check-fact-consistency.mjs`와 factGuards는 raw 파일 전체를 읽어 이 필드도 게이트 안에 있다. 개수는 2026-09-08 리뷰 시점(`21bc361a7b`) 트리와 똑같다(이전 리뷰의 '9편'은 과소 집계). 작성자가 meta 필드로 오해할 혼선 정도.
- **수정**: 일회성 스크립트로 세 키를 삭제한다(description은 summary와 다른 내용이 있는지 먼저 훑는다). 허용 키 화이트리스트 테스트는 새 하위 필드를 쓸 때 CI를 세우는 비용이 생기니 지금은 넣지 않고, 되살아나면 그때 추가한다.
- **비고**: 검증자가 제목·영향 전제를 바로잡음("늘고 있다"·"게이트 밖" 둘 다 사실 아님). 이전 리뷰(2026-09-08 #12) 미처리 항목.

#### CNT-22. 도달 불가능한 리다이렉트 글 492편을 모든 게이트와 기준선이 계속 스캔한다 [P3 · S]

- **위치**: `scripts/check-unverified-claims.mjs:57-61` · `scripts/check-duplicate-sections.mjs:42` · `scripts/check-fact-consistency.mjs:65` · `scripts/content-quality-check.js:223` · `scripts/cta-routing-baseline.ts:35` · `lib/regionRedirectMap.json` · 비교 `content/storyLinks.test.ts:70-76`
- **지금 코드**:
  ```js
  const koStories = () => fs.readdirSync(DIR).filter((f) => f.endsWith('.md') && !/\.(en|zh|es|vi|th|uz)\.md$/.test(f)).sort();
  ```
  다섯 스크립트가 전부 디렉터리 전체를 읽는다. `storyLinks.test.ts:70-76`은 이미 "독자 도달 불가"라며 리다이렉트 slug를 제외한다.
- **조건과 결과**: ko .md 1,582개 중 `regionRedirectMap.json` 키 492개(31%)는 middleware가 308로 보내 독자가 도달 못 한다. `unverified-claims.baseline.json` 46편 중 14편, `cta-routing.baseline.json` 1,582편 중 492편이 그 글이다. 기준선 숫자가 실제 위험을 부풀리고, "기준선을 줄이는 작업"의 약 3분의 1이 효과 없는 글에 들어간다. 스캔 비용도 31% 낭비.
- **수정**: `scripts/lib/liveStories.js`(CJS — `content-quality-check.js`가 CJS라 `.mjs`로 두면 Node 22에서 `require(esm)`가 필요하다)에 `listLiveKoStories()`(.md에서 regionRedirectMap 키 제외)를 만들어 위 스크립트들과 `cta-routing-baseline`이 공유한다. 적용 커밋에서 claims·dup-sections·cta-routing 기준선을 같이 `--update`한다(`storyPriceIds.test.ts`의 entries>1000 단언은 1,090으로 통과). PR 절차에 "리다이렉트 해제 시 기준선 재계산"을 적어 둔다 — 되살아나는 글은 그 시점에야 게이트에 처음 걸린다. 리다이렉트 원문 삭제 여부는 별도 결정.
- **비고**: 검증자 확인(confirmed). 수정 시 주의 세 가지(기준선 동시 갱신·리다이렉트 해제 절차·CJS 헬퍼)는 검증자가 덧붙였다.

#### CNT-23. content-quality-check가 YAML을 정규식으로 직접 파싱하고 머리 주석과 실제 기준이 다르다 [P3 · S]

- **위치**: `scripts/content-quality-check.js:8,43-,130,137` · `.github/workflows/ci.yml:42`(content-check:ci) · 비교 `lib/storyFrontmatter.ts`
- **지금 코드**:
  ```js
  * 1. 고유 단어 수 ≥ 300 (숏코드 제외)      // :8
  if (effectiveWordCount < 200) { violations.push(`단어 수 부족: …(최소 200개 …`);   // :137
  function parseFrontmatter(content) { const match = content.match(/^---\n([\s\S]*?)\n---\n/); … yaml.match(/^  - q:/gm) …
  ```
  주석은 300, 코드는 200이고 숏코드는 `SHORTCODE_WORD_ESTIMATES`(:130)로 더한다. faq 개수를 2칸 들여쓰기 항목으로만 센다.
- **조건과 결과**: 현재는 gray-matter와 비교해 1,582편 전부 faq·tags·summary 판독이 같고(불일치 0) 위반 0이라 잠재 위험이다. 들여쓰기·CRLF·따옴표 변형이 들어오면 앱(gray-matter)과 다르게 읽어 거짓 위반·거짓 통과가 난다. 기준(300 vs 200) 중 어느 쪽이 정책인지 불분명.
- **수정**: `parseFrontmatter`를 `require('gray-matter')`로 교체한다(CJS라 그대로 가능). 임계값을 상수 하나(`MIN_EFFECTIVE_WORDS = 200`)로 두고 주석이 상수를 가리키게 한다 — 200이 `55cbaf6348` 이후 CI 기준이므로 주석을 200으로 맞추는 것이 안전하다.
- **비고**: 검증자 확인(confirmed).

#### CNT-24. check-fact-consistency의 CANON 중 recordingHourly·masteringSingle이 쓰이지 않는데 출력은 검사 중인 것처럼 보인다 [P3 · S]

- **위치**: `scripts/check-fact-consistency.mjs:41-48,141,172-176,193` · `data/pricing.ts` · `content/practiceRoomHourly.test.ts` · `.github/workflows/ci.yml:48`(check:facts)
- **지금 코드**:
  ```js
  const CANON = {
    lessonMonthly: constOf('LESSON_MONTHLY_PRICE'),
    practiceMonthly: constOf('PRACTICE_ROOM_MONTHLY_PRICE'),
    recordingHourly: constOf('RECORDING_HOURLY_PRICE'),
    mixMin: …, mixMax: …,
    masteringSingle: constOf('MASTERING_SINGLE_PRICE'),
  };
  ```
  `priceChecks`(:172-176)는 레슨 월·연습실 월 2종뿐이고(:141은 주석), :193 `console.log`는 '녹음 시간당 100,000원'을 정본으로 찍어 검사 중인 것처럼 보인다.
- **조건과 결과**: 녹음 시간당 가격이 바뀌어도 스토리의 옛 금액은 CI를 세우지 않는다. 현재 코퍼스에서 녹음 시간당 가격을 말하는 글은 10곳(전부 100,000원, 정본과 일치)이고 연습실 시간제 6,600원은 `practiceRoomHourly.test.ts`가 지킨다. 제안됐던 정규식 `/(?:녹음|보컬)[^.\n]{0,20}?(?:시간당|1시간)\s*([\d,]+)원/`은 `practice-room-vs-rehearsal1.md:125`("녹음실이 다 비슷해… 시간제 1시간 6,600원")에서 오탐한다.
- **수정**: 우선 쓰지 않는 CANON 두 줄과 :193 출력의 '녹음 시간당' 표기를 지워 검사 범위를 있는 그대로 보이게 한다. 녹음 시간당 검사를 넣으려면 '녹음실' 문맥을 배제한 정규식(예: `녹음(?!실)`)으로 만들고 `--show` 류 출력으로 코퍼스 오탐 0을 확인한 뒤 추가한다. 마스터링 단가 정규식은 제시된 적이 없으니 별도.
- **비고**: 검증자가 바로잡음 — 원 수정안의 정규식은 확인하면 바로 오탐이 걸린다.

#### CNT-25. stripCodeFenceWrapper가 일부 읽기 경로에만 적용된다 [P3 · S]

- **위치**: `lib/stories.ts:86-89`(getStoryAvailableLocales) · `lib/stories.ts:286-288`(getParsedStoryFile) · `lib/sitemap/storyMeta.js:27-31` · `scripts/generate-story-listing.js:58,244-247,281` · `lib/storyFrontmatter.ts`
- **지금 코드**:
  ```ts
  const raw = applyFactTokens(fs.readFileSync(filePath, 'utf8'));
  const fm = matter(raw);          // getStoryAvailableLocales: stripCodeFenceWrapper 없음
  ```
  `getParsedStoryFile`(:287)과 `generate-story-listing.js`(:58·281 미러)만 `stripCodeFenceWrapper` 후 matter를 부르고, `getStoryAvailableLocales`·`lib/sitemap/storyMeta.js`는 전처리 없이 matter를 쓴다. 이 함수는 2025-11 AI 생성 글 대비로 들어간 것으로 보인다(`a51dd55931`).
- **조건과 결과**: 코드 펜스로 시작하는 파일은 현재 0개라 영향 없음(잠재). 그런 파일이 생기면 렌더 경로는 frontmatter를 읽는데 hreflang·사이트맵·listing 경로는 못 읽어 `robots: noindex`·thin 판정이 서로 달라진다.
- **수정**: CLAUDE.md "단순하게" 기준으로 함수·테스트·미러 사본을 걷어 내고 "펜스로 시작하는 .md 금지"를 content 테스트 한 줄로 둔다. 기능을 유지하려면 읽기 경로를 `readStoryFile(filePath)` 하나로 모아 모두 같은 전처리를 쓰게 한다.
- **비고**: 검증자 확인(confirmed).

#### CNT-26. content/stories에 커밋된 잔재 파일 2개 (image.png, mixing-complete-guide.md-E) [P3 · S]

- **위치**: `content/stories/image.png`(773,685B, `45d37062fb`) · `content/stories/mixing-complete-guide.md-E`(23,793B, #550 `1ea67e1d2b`의 macOS `sed -i -E` 백업 부산물)
- **지금 코드**: `git ls-files content/stories | grep -v '\.md$'` → 두 파일. `-E` 파일은 링크 `[5부](/stories/mixing5)`가 살아 있는 옛 본문이라 현재 `mixing-complete-guide.md`(23,670B)와 다르다(diff로 확인). 둘 다 어디서도 참조되지 않고(grep 0) 스캔 스크립트는 `.md` 필터로 우연히 건너뛴다. 저장소 전체에서 같은 유형의 `-E`·`.orig`·`.bak` 추적 파일은 이것뿐이다.
- **조건과 결과**: 어느 파일이 정본인지 혼선, 옛 문구가 grep·검색에 걸림. 기능 영향 없음.
- **수정**: `git rm content/stories/image.png content/stories/mixing-complete-guide.md-E`. "content/stories에는 .md 외 파일 금지" content 테스트는 파일 두 개를 위한 장치라 선택 사항.
- **비고**: 검증자 확인(confirmed). 같은 자리를 다른 축(SEO 페이지·라우팅·SEO·i18n)도 지적: "content/stories에 추적되는 잡파일 2개 — 773KB image.png와 sed 백업 mixing-complete-guide.md-E".

#### CNT-27. 링크 스킴 분기가 대소문자를 구분해 HTTPS://·Tel:·MAILTO: 링크는 nofollow·계측 없이 같은 탭 링크로 나간다 [P3 · S]

- **위치**: `components/MarkdownRenderer.tsx:287-316`(287·296 분기) · `components/markdown/safeLinks.ts` · `components/markdown/safeLinks.test.ts` · `components/funding/ProjectDetailView.tsx:216`
- **지금 코드**:
  ```ts
  if (href?.startsWith('tel:') || href?.startsWith('mailto:')) { …
  const isExternal = href?.startsWith('http://') || href?.startsWith('https://');
  ```
  `safeLinks.isAllowedLinkHref`는 compact를 소문자화해 판정하므로 `HTTPS://example.com`·`Tel:…`·`MAILTO:…`를 허용하지만, 분기는 원문 대소문자로 검사해 놓친다. `renderToStaticMarkup` 결과: `HTTPS://example.com` → `<a href="HTTPS://example.com">`(target·rel 없음), `Tel:01012345678` → `lead_click_phone` 계측 없는 일반 앵커. `javascript:`·`//`는 텍스트로 차단(정상).
- **조건과 결과**: 개설자(외부 입력) 본문의 대문자 스킴 외부 링크가 `target=_blank`·`rel=nofollow` 없이 나가 같은 탭 이동과 nofollow 누락이 생기고(대문자 스킴으로 nofollow 우회 가능), `Tel:`/`MAILTO:` 링크는 전환 계측을 건너뛴다. `target=_blank`가 없으므로 noopener는 이 건과 무관하다.
- **수정**: 링크 컴포넌트 안에서 `const lowerHref = href?.trim().toLowerCase()`를 만들어 tel:/mailto:/http(s):// 분기에 쓰고 href 값은 그대로 렌더한다. 대문자 스킴 케이스를 `MarkdownRenderer` 또는 `safeLinks` 테스트에 추가한다. `classifyHref` 분리와 `ugc` rel 추가(개설자 여부 prop이 필요한 설계 변경)는 하지 않는다.
- **비고**: 검증자가 바로잡음 — 영향 서술의 'noopener'는 무관하고, 원 수정안은 과하다. CNT-9와 같은 분기이므로 한 PR로 묶는다.

**클린 판정**
- `lib/storyFrontmatter.ts` (normalizeStoryCTAOverride·Faq·HowTo): 잘못된 형태는 버리거나 undefined로 정규화, 실측 frontmatter 전수에서 faq/howTo/tags/robots/cta/date 형식 오류 0건(날짜 파싱 불가·미래 날짜·lastmod<date 없음)
- `lib/funding/shape.ts` + `lib/funding/projects.ts` + `lib/sitemap/fundingMeta.js`: status·hidden·startAt/endAt 엄격 검증이 md와 DB에서 한 함수를 타고, 사이트맵 판정도 gray-matter 동일 규칙(오타·따옴표 값은 던짐)
- `lib/funding/creatorContent.ts` stripTrustedDirectives와 contentSegments 분리 정규식의 줄 판정 일치(CRLF·앞뒤 공백 모두 양쪽 동일하게 숏코드로 보지 않음), TRUSTED 목록과 렌더러 숏코드 이름 일치, 쓰기 경로는 saveStorySection 하나뿐
- `components/markdown/safeLinks.ts` + MarkdownRenderer 보안 렌더: 실제 렌더로 확인 — `<script>`·`<b>` 원문은 이스케이프, javascript: 링크는 텍스트로 강등, 미등록 외부 이미지는 `<img>` 대신 nofollow 링크로 강등, 등록 호스트·로컬 이미지만 next/image
- `components/markdown/MarkdownImage.tsx` + `lib/markdown/allowedRemoteImageHosts.ts`: https 한정·호스트 목록 대조·치수 힌트 상한, next.config 대조 일관성 테스트 존재
- `lib/press/token.ts`·`listeningRoom.ts`(쿠키 서명 도메인 분리, HttpOnly/SameSite/Secure, 운영에서 비밀 없으면 문 닫음)·`audio.ts`(곡별 서명 URL)·`page.ts`(esc 처리)·`enter.ts`(IP당 15분 10회, 303 리다이렉트)
- `public/locales` 7개 common.json: 키 패리티 테스트 존재, 직접 대조한 URL·이메일·시각 집합이 7개 로케일에서 동일, 4자리 이상 숫자(가격) 비교는 표기 차이만 있고 사실 불일치 0건, lib·data·utils·hooks의 리터럴 t() 키 누락 0건, 카테고리 라벨 10종 전 로케일 존재, 휴리스틱 미참조 키는 1,151개 중 18개(1.6%)
- `data/internalLinks.ts` topicLinks: 187개 키워드 모두 존재하는 slug나 허브를 가리킴(단 1건 리다이렉트 slug는 CNT-19), 허브는 /guides/ ko 전용 분기와 테스트 존재
- content 숏코드 위생: 모든 `%%…%%`가 독립 줄, 들여쓰기·후행 공백 0건, 미등록 토큰 0건, 번역본에 숏코드 0건, 가격 id 유효성 테스트 존재
- `lib/factGuards.ts` 규칙 집합과 `content/factGuards.test.ts` 회귀 픽스처: 정본 파생 전화번호 패턴, allow 면제 36건을 표본 확인한 결과 정당한 문맥이었음
- `lib/stories.ts` 로케일 폴백 체인(요청 로케일 → en → 기타 native → ko)과 getStoryPaths 곱집합 방지, native-only 판정, canonical·noindex 처리 (`pages/[locale]/stories/[id].tsx`와 일치)
- `lib/storySeoData.ts` 메타 description 절단, `lib/storyRelatedScoring.ts`·`storyRelatedPortfolio.ts`(결정적 시드), getStoryListing 로케일 검증 — 이전 리뷰 지적(1.·2. 문장 종결 오인, 로케일 미검증)은 수정되어 있음
- `lib/storyCtaPolicy.ts` + `storyAutoFallback.ts`의 보컬 레슨 가드와 vocalCategoryNoLesson 테스트, 라우팅 기준선 테스트 통과
- 관련 기존 jest 4종(`lib/stories.test.ts`, `lib/sitemap/thinContent.test.js`, `content/storyLinks.test.ts`, `lib/storyListing.check.test.js`) 실행 결과 전부 통과 — 위 지적들은 이 테스트들이 못 보는 사각임

**읽지 못한 범위**
- Vercel 프로덕션에서 `/ko/stories/..%2F..%2FCLAUDE` 요청이 실제로 [id] 라우트까지 가는지는 직접 시험하지 않았다(프로덕션 접근 금지로 라우트 매처 함수와 getStoryDetail 직접 호출로만 확인) — 검증 단계에서 `..%2Fstories%2Fvocal-mixing1`·`..%2Ffunding%2Fsabbaha-slung` 프로브로 도달은 확인됨(CNT-3)
- 번들 크기·성능은 .next를 보지 않아 실측하지 못했다(autoLinks가 data/buyerIntentHubs 30KB를 클라이언트 번들에 끌고 오는지는 미확인)
- 번역 스토리 184개 본문은 구조·숫자·숏코드만 점검했고 문장 단위 사실 비교는 하지 않았다(en 4개 native-only 가이드는 가격 숫자가 없음을 확인)
- components/inline/* 콜아웃 5종과 components/story/* 숏코드 컴포넌트는 링크·계측·prefetch 위주로만 읽었고 카피 정합은 보지 않았다
- lib/sitemap/routes.js·next-sitemap.config.js·pages/api/llms*.ts·rss.ts·lib/llms/*는 thin 게이트와 호출 관계만 확인했고 전체 흐름은 읽지 않았다
- data/home.ts, data/faq.ts, data/buyerIntentHubs.ts, data/practiceRoomRelatedGuides.ts, data/privacyPolicy.ts는 가격 리터럴 스캔 결과로만 점검했고 줄 단위 리뷰는 하지 않았다
- scripts/generate-story-catalog.js, generate-portfolio-meta.js, scan-near-duplicates.mjs, scripts/press/*는 읽지 않았다
- jest 전체 스위트와 npm run build는 실행하지 않았다(지정 4개 스위트만 실행)

**미검증 후보(overflow)**
- 없음

---

## 부록

### A. 반박되어 제외한 지적 (25건)

탐색자가 냈지만 검증자가 코드를 읽고 사실과 다르거나, 이미 처리됐거나, 운영자 결정과 충돌한다고 판정한 것이다. 같은 자리를 다시 들여다볼 때 참고용으로 남긴다.

**BIL**

- 원천징수 소액부징수(소득세 1,000원 미만 비징수) 처리가 없어 소규모 정산에서 과징수할 수 있다 — 세무 확인 필요 — `lib/artistSupport/payout.ts:41`  
  → 코드 사실은 맞다(payout.ts:41은 지급액 크기와 무관하게 3%+0.3%를 뗀다). 그러나 지적의 전제인 '소액부징수가 이 지급에 적용된다'가 현행법과 어긋나는 것으로 보인다. 웹 검색 두 번과 bznav 해설 페이지(WebFetch 인용: '인적용역 사업소득으로서 계속적·반복적 활동을 통해 얻는 소득이 추가되어, 2024년 7월 1일 이후 지급하는 소득부터 적용')가 모두 소득세법상 소액부징수(제86조) 적용 제외에 2024-07-01 지급분부터 인적용역 사업소득이 추가됐다고 말한다. 오늘(2026-10-10) 기준으로 월 단위로 반복 지급하는 아티스트 정산은 1천원 미만이어도 징수하는 쪽이 맞을 가능성이 높고, 지적이 제안한 incomeTax < 1000이면 0으로 하는 수정은 오히려 과소징수와 가산세를 낳을 수 있다. 저장소 정본인 withholding-tax 스킬도 소액부징수를 두지 않고 간이지급명세서(2024년 개편과 같은 흐름)를 전제로 쓴다. 불확실한 점: 법령 원문(law.go.kr)은 렌더되지 않아 직접 읽지 못했고 위 근거는 2차 자료다. 아티스트 지급이 '계속적·반복적 인적용역'으로 분류되는지는 세무사 판단이다. 이 판단은 스펙 §5-3(a)의 '세무 확인 2건 — 아티스트 지급의 비용·원천징수 처리' 게이트(확인 전 2차 배포 금지)가 이미 맡고 있다. 그러므로 코드 변경 없이 그 게이트에서 확인하면 된다.

**CQ**

- 서버 렌더가 전역 i18n 싱글턴의 언어를 바꿔 쓴다 — 동시 요청에서 로케일이 섞일 수 있다 — `lib/getStatic.ts:6`  
  → 지적이 가정한 경로가 성립하지 않는다. 지적은 렌더가 전역 i18n.language를 읽는다고 보지만, 프로덕션 렌더 경로의 번역 호출 62곳이 모두 useTranslation('common', { lng: locale }) 형태로 로케일을 명시한다(grep -h로 형태별 집계: lng 없는 호출은 테스트 모킹뿐). 명시 lng는 getFixedT(lng)로 동작해 i18n.language와 무관하다. 그 밖에 i18n.t, i18next.t, i18n.language를 읽는 프로덕션 코드는 없다(ErrorBoundary는 i18n.getFixedT(locale), _app.tsx:260과 getStatic.ts:14는 쓰기/비교만). 번들 저장은 addResourceBundle(lng, ns, data, deep, overwrite)로 로케일 키별 누적이라 동시 요청이 서로의 언어 번들을 덮어쓰지 못한다(같은 로케일은 같은 내용의 합집합일 뿐). 따라서 동시 요청에서 ko 요청에 en 문구가 섞이는 경로가 없다. getStatic.ts:105-109의 2026-09-26 사례는 404/500 페이지가 번들 자체를 서버 i18n에 못 넣어 키 문자열이 나온 문제였고 getErrorPageStaticProps로 이미 고쳐졌다. 언어 섞임이 아니다. 요청별 인스턴스 createInstance로 바꾸자는 수정안은 불필요한 위험이다(_app 전체 i18n 배선을 건드리고 번들 선로딩 우회 로직과 얽힌다). 남는 것은 i18n.changeLanguage 호출이 서버에서 사실상 쓰이지 않는 잔재라는 점뿐이며 영향이 없다.

**DB**

- 결제 확정 경로의 relational query가 전부 전체 컬럼 SELECT — 배포 순서 위험을 '별도 표 파편화'로 우회하는 비용이 계속 쌓인다 — `lib/funding/service.ts:107`  
  → 결함이 아니라 문서화된 설계 선택에 대한 대안 제안이고, 수정안 둘이 이 저장소의 결정과 충돌한다. (1) 전체 컬럼 SELECT가 컬럼 추가 마이그레이션의 배포 순서를 강제한다는 사실은 맞고 CLAUDE.md 0022 절이 이미 정확히 같은 내용을 서술한다. 이 저장소의 답은 '컬럼을 안 더하고 별도 표를 판다'와 '마이그레이션 먼저 적용'이다. 이는 의도된 비용 교환이다. (2) 수정안 2(추가형 마이그레이션을 GitHub Actions가 자동 적용)는 CLAUDE.md가 명시한 결정과 반대다: '이 저장소는 마이그레이션을 CI/CD에서 자동 실행하지 않는다(db:migrate는 운영자가 수동 실행)', '적용은 main 병합본에서만 한다'. 게다가 ci.yml 주석대로 Vercel은 GitHub Actions와 무관하게 push에 반응해 배포하므로 Actions 잡은 배포보다 먼저 끝난다고 보장할 수 없어 순서 문제를 풀지도 못한다. 또 쓰기 토큰을 CI에 두는 것은 같은 목록의 idx 8(읽기 전용 토큰)과 정반대다. (3) 수정안 1(결제 경로 관계 조회에 columns 허용 목록)은 db.query 호출이 약 134곳이고 FundingOrder = Order & {...} 같은 전체 행 타입을 여러 모듈이 공유해, 타입이 좁아지며 대규모 리팩터링이 된다. 얻는 이득은 이미 문서·일일 드리프트 크론(healthCheck)·CI 탐지기가 맡는 순서 위반 한 가지다. CLAUDE.md '단순하게 만들 것'(사소한 이득을 위해 유지보수 부담이 큰 기계를 들이지 말 것)에 반한다. (4) 마이그레이션 0037·0039·0041~0044·0048 같은 순서 의존 항목은 루트 CLAUDE.md에 이미 목록으로 있다. 남는 아이디어(정적 스캔 기준선 테스트)도 호출 수가 많고 거짓 양성이 커서 투자 대비 개선이 아니다.
- db/schema.shows.test.ts의 applyMigrations가 비동기 execute를 기다리지 않는다 — 마이그레이션 SQL이 깨져도 테스트가 통과한다 — `db/schema.shows.test.ts:9`  
  → 핵심 주장 "마이그레이션 SQL이 깨져도 테스트가 통과한다"가 사실과 다르다. @libsql/client 0.17.4의 sqlite3 클라이언트는 execute가 async지만 본문에 await가 없어 호출 시점에 동기 실행된다(node_modules/@libsql/client/lib-esm/sqlite3.js:71-84). 그래서 순서는 보장된다. 실패한 문장은 거부된 Promise가 되는데, 직접 재현했다. scratchpad에서 같은 패턴(await 없이 execute, 중간에 `ALTER TABLE nope ADD x`)으로 jest를 돌리니 unhandled rejection으로 jest 프로세스가 Node 에러로 죽고 exit code 1이었다(--runInBand도 동일). 즉 SQL이 깨지면 테스트가 초록이 아니라 CI가 빨개진다. 또 "CI에서 마이그레이션 SQL이 실행되는 것은 이 테스트들뿐"도 틀리다. 같은 await 없는 applyMigrations가 tests/helpers/showsDb.ts:9-18에 있고 tests/api 아래 20여 개 통합 테스트가 이를 쓴다. 남는 것은 applyMigrations 복사본이 여러 벌(schema.shows.test.ts, showsDb.ts, schema.funding.test.ts, sign-transaction.test.ts)이라는 사소한 중복뿐이며 이는 결함이 아니다.
- orders.customer_email/phone NOT NULL 칸에 공연 주문이 빈 문자열('')을 저장한다 — null 설계와 코드 가정이 갈린다 — `lib/shows/service.ts:89`  
  → 전제가 현재 코드와 다르다. 온라인 공연 주문은 이메일을 필수로 받는다. lib/shows/validation.ts:85-89가 "티켓(QR)은 메일로 전달되므로 필수"로 빈 값·형식 오류를 거절하고, createShowOrder(service.ts:89,105)는 그 검증된 값을 orders.customer_email에 넣는다. 빈 문자열이 들어가는 것은 운영자 발급 초대권(service.ts:218, 'paid','초대권','','')뿐이며 고객이 없는 행이다. 지적한 소비자 문제도 실현되지 않는다. lib/reviews/reviewRequests.ts:81-83의 `lower(o2.customer_email) = lower(…)`는 review_requests 행(kind가 session·mixing뿐)과 조인된 주문끼리만 비교하므로 공연 주문의 ''가 한 사람으로 묶일 일이 없다. 공연 메일 경로는 resolveShowRecipient가 빈 값·파기 표식·비이메일을 모두 거르고(lib/shows/email.ts:183-189), sendEmail도 파기 표식을 막는다. 수정안(contactOf 헬퍼, NOT NULL 완화를 위한 orders 테이블 재작성)은 근거 없는 큰 변경이라 이 저장소의 "사소한 이득에 무거운 기계" 금지에 걸린다. 남는 것은 lib/shows/email.ts:179-181의 주석("티켓 주문은 customer_email을 빈 문자열로 만들고")이 이메일 필수화 이후 낡았다는 점뿐이다.
- ID·시각 표현이 표마다 다르다 (UUID 형식 3종, timestamp 모드/원시 정수 혼재) — `db/schema.ts:1593`  
  → 발현 근거가 없고 사실 서술도 과장이다. ID 형식은 "3종"이 아니다. 기본값은 32자 hex이고 booking·work_order·payment 쪽은 `randomUUID().replace(/-/g,'')`로 같은 32자 hex라 하이픈 있는 36자는 contracts/service.ts:184 한 곳뿐이다(계약 ID를 배치 안에서 먼저 정해야 해서 직접 만든다). ID 형식을 가정하는 검증은 확인되지 않았다(shows는 ID_PATTERN=/^[A-Za-z0-9_-]{1,64}$/). 시각은 shows 계열·rate_limits·social_tokens가 초 단위 number, 나머지가 Date인 것은 맞지만, shows는 전부 raw SQL(unixepoch())로 동작하고 그 변환 코드가 공연 모듈 전체에 퍼져 있다(startsAt·*1000 참조 100곳 이상). `mode:'timestamp'`로 바꾸면 타입이 Date로 바뀌어 호출부가 대규모로 깨지고, 저장값이 같아 얻는 안전성도 없다. 신규 표용 idColumn()/tsColumn() 헬퍼는 신규 표 계획이 없는 상태의 추상화라 이 저장소 지침에 어긋난다. 지적 자신도 "현재 발현 증거 없음"이라 적었다.
- DB 클라이언트에 재시도·타임아웃·FK PRAGMA 확인이 없다 (일시 오류가 SSR/ISR 읽기에서 그대로 터진다) — `db/client.ts:22`  
  → 핵심 전제가 틀렸다. 지적은 "libsql:// URL은 Node에서 WebSocket(Hrana)으로 붙는다"고 했지만, @libsql/client node 빌드는 `expandConfig(config, true)`(preferHttp)로 libsql:// 을 https로 바꾼다(node_modules/@libsql/client/lib-esm/node.js:11-13, @libsql/core/lib-esm/config.js:66-78). 즉 문장마다 stateless HTTP 요청이라 유휴 WebSocket 스트림 만료 시나리오가 해당되지 않는다. wss:// 를 명시했더라도 ws.js는 닫힌 연결을 "seamlessly reconnect"한다(ws.js:232-233). FK 우려도 확인으로 해소됐다. 운영 DB에 읽기 전용으로 `PRAGMA foreign_keys;`를 실행해 1(켜짐)을 확인했고, 로컬 :memory:도 1이다. 마이그레이션 0040이 OFF 뒤 ON으로 되돌리는 것도 기본값이 ON이라는 전제다. 지난 23시간 프로덕션 런타임 로그에서 LibsqlError는 0건이었다(보존 기간이 Pro 1일이라 장기 증거는 못 봄). 발생 증거가 없고 지적 자신도 확신 0.35라 했으므로 withDbRetry 래퍼 추가는 근거 없는 추상화다. 참고로 ON DELETE CASCADE는 5곳이 아니라 8곳이다.

**FE**

- GlobalPlayerProvider 컨텍스트 값에 currentTime이 들어 있어 재생 중 모든 소비자가 초당 수 회 재렌더된다 — `components/audio/GlobalPlayerProvider.tsx:80`  
  → 전제가 사실과 다르다. 코드 자체는 지적대로다. GlobalPlayerProvider.tsx:81이 timeupdate마다 setCurrentTime하고, L170-172의 컨텍스트 value에 currentTime이 들어 있어 useGlobalPlayer() 소비자는 전부 재렌더된다. 그러나 '홈·포트폴리오 그리드에 수십 개'는 틀렸다. CoverPlayButton은 오디오 발췌가 있는 커버에만 붙는데(HomeReleaseStrip.tsx:71-75, PortfolioCoverGrid.tsx:27-28, 57-59), data/audioExcerpts.ts의 AUDIO_EXCERPTS는 2개뿐이고 portfolioId가 있는 것은 jai-golden-hour 하나다. 한 화면의 소비자는 많아야 CoverPlayButton 1~2개 + ServiceExcerpt 1개 + PortfolioSampleTracks 1개(트랙 3개)다. 컨텍스트 소비자가 아닌 children은 Provider 재렌더로 다시 그려지지 않는다. 4Hz에 작은 버튼 몇 개를 다시 그리는 비용은 측정 가능한 수준이 아니다. 컨텍스트를 둘로 나누면 코드와 유지 부담이 느는데 이득이 없다(CLAUDE.md '사소한 이득을 위한 기계 금지'). 발췌가 수십 개로 늘어나면 그때 다시 볼 일이다.

**FNC**

- 헬스체크의 파일↔DB slug 충돌 감지가 서버리스 번들에서 조용히 꺼져 있을 가능성 — tracing 설정에 크론·/admin·사이트맵이 없다 — `next.config.mjs:43`  
  → 전제('md가 서버리스 번들에서 빠져 충돌 점검이 조용히 꺼진다')가 실측으로 반증된다. (1) 운영 https://studionol.co.kr/llms.txt는 /api/llms로 rewrite되고, 이 라우트는 next.config.mjs outputFileTracingIncludes 어느 키에도 안 걸리는데(32-44행은 /api/funding/**, /[locale]/funding/**, /admin/funding/**, /api/admin/funding/**, creator 2종, 크론·/admin의 journal뿐), 응답에 content/funding md로만 존재하는 세 프로젝트(mok-jareugi, sabbaha-slung, keep-singing-for-palestine)가 진행 중으로 나열된다. 즉 같은 FUNDING_DIR 상수를 쓰는 getAllFundingProjects가 포함 설정 없는 라우트의 운영 람다에서 md를 읽는다. (2) @vercel/nft(next 번들판)로 projects.ts와 같은 패턴(path.join(process.cwd(),'content','funding') + existsSync + readdirSync + readFileSync)의 파일을 추적하면 content/funding/*.md 4개가 자동으로 잡힌다. 정적으로 해석되는 모듈 상수라 nft가 디렉터리를 자산으로 방출하며, includes가 필요한 것은 계약서 md처럼 경로가 정말 동적인 경우다. healthCheck.ts의 getAllFundingProjects도 같은 모듈이라 같은 추적을 받는다고 보는 게 합리적이다(크론 람다 자체는 직접 보지 못했다). 남는 것은 P3 강화뿐이다: tracing 테스트가 4그룹만 단언하고(tests/config/fundingFileTracing.test.ts:24-30), 디렉터리가 없으면 healthCheck.ts:893의 `fileSlugs.size > 0` 가드가 이슈 없이 건너뛰므로(projects.ts가 console.error만 남김) 실제로 번들에서 빠지는 날이 오면 조용하다. 다만 배포 최적화로 '/api/llms'를 includes에 넣는 일은 불필요하다.
- 이미지 업로드가 입력 포맷을 제한하지 않는다 — sharp가 해석하는 모든 형식(SVG 포함)을 받는다 — `lib/funding/creatorUpload.ts:51`  
  → '포맷 allowlist 없음'은 사실이나 지적한 공격면이 실제로는 성립하지 않는다. 이 저장소의 sharp 0.35.5(librsvg 2.63.2)로 격리 스크립트를 돌려 확인했다. (1) SVG 안의 http://127.0.0.1 이미지 참조, file:///etc/hosts, 상대 경로 /etc/hosts를 넣어 처리했을 때 로컬 리스너에 요청이 0건 도착했고 외부 파일도 읽지 않았다(SSRF·파일 참조 없음). (2) limitInputPixels가 SVG에도 적용돼 60000x60000 SVG는 'Input image exceeds pixel limit'으로 거부됐다. (3) PDF 입력은 'unsupported image format'으로 거부됐다(buffer 입력 가능 포맷은 jpeg,png,webp,tiff,gif,svg,heif,raw뿐). 출력은 webp 재인코딩이고 EXIF도 떨군다(creatorUpload.ts:44-55). 본문 8MB 제한·IP/계정 시간당 제한·40MP 상한도 이미 있다. 남는 것은 SVG·TIFF가 래스터로 변환되어 저장된다는 사실뿐이며 해로운 결과가 없다. 지적 자체가 confidence 0.4이고 allowlist 코드를 더하는 것은 이 저장소의 '단순하게' 원칙에 맞지 않는다.
- 세션 생성 라우트(POST /api/funding/creator/session)에 요청 제한이 없다 — `pages/api/funding/creator/session.ts:28`  
  → 제시한 영향의 전제가 사실과 다르고, 수정안은 오히려 DB 쓰기를 늘린다. (1) token_hash는 PK(db/schema.ts:812)다. 존재하지 않는 토큰으로 consumeCreatorLoginToken을 부르면 UPDATE ... WHERE token_hash=? AND used_at IS NULL이 PK 점조회에서 0행에 그쳐 쓰는 행이 없다. 16자 미만 토큰은 DB에 가기 전에 null을 돌려준다(creatorToken.ts:93). 32바이트 난수라 추측으로 쓰기를 일으킬 수도 없다. 'DB 쓰기 과금 남용'은 성립하지 않는다. (2) 제안한 consumeRateLimit은 호출마다 DELETE(만료 정리)와 INSERT ... ON CONFLICT DO UPDATE를 실행한다(lib/booking/rate-limit.ts:40-56). 즉 요청마다 쓰기 두 번이 생기고, 새 IP마다 rate_limits 행이 늘며, 장애 시에는 fail-open이다. 지금의 PK 점조회보다 비싸다. (3) Origin 검사는 비브라우저 클라이언트가 위조할 수 있으니 방어선이 아니라는 지적은 맞다. 그러나 이 라우트의 실제 비용은 PK 점조회 한 번이라 IP 제한으로 얻는 것이 없다. download.ts에 IP 제한이 있는 것은 그쪽이 서명 URL·메일 같은 실제 자원을 쓰기 때문이다. '관례 일관성'만으로 쓰기 비용을 들일 근거가 못 된다.
- 로그인 메일 발급이 null로 끝나면(개설자 행 조회 실패) 200만 주고 운영자 알림이 없다 — `pages/api/funding/creator/login.ts:133`  
  → 지적한 갈래는 사실상 도달하지 않고 그 응답은 의도된 설계다. (1) login.ts:133의 issued가 null이 되는 길은 둘뿐이다. normalizeCreatorEmail 실패는 login.ts에서 이미 400으로 걸러진 뒤라 불가능하고, 남는 insert 직후 select 공백은 creatorToken.ts:70-75가 스스로 '있어서는 안 되는 상태'라 부르는 불변식 위반이다. (2) db/client.ts는 임베디드 복제본이 아니라 원격 libsql 클라이언트라 '복제 지연'은 없다. (3) 실제 DB 장애는 null이 아니라 예외다. insert/select/트랜잭션이 던지므로 조용한 200이 아니라 500과 Vercel 로그가 남는다. 조용히 200이 되는 DB 이상 시나리오가 없다. (4) null일 때 200과 같은 문구를 주는 것은 tests/api/funding/creator/login.test.ts:80-89가 명시적으로 고정한 열거 방지 설계다. (5) session.ts의 sendCreatorSessionFailureAlert는 비대칭이 아니라 성격이 다른 경우다. 거기는 토큰이 이미 소진된 뒤라 되돌릴 수 없는 실제 도달 가능한 실패인 반면, 여기는 재시도가 가능하고 도달하지 않는다. 없는 상태에 알림 함수와 레이트리밋 키를 새로 만드는 것은 개선이 아니다.
- 테스트 공백: 이메일 변경이 기존 세션을 끊는지(session_version 증가)를 decideCreatorAccount 통합 테스트가 보지 않는다 — `lib/funding/creatorAccountDecision.integration.test.ts:140`  
  → 지적의 전제가 틀렸다. 이 보증은 같은 디렉터리의 전용 테스트가 이미 고정한다. lib/funding/creatorSessionVersion.integration.test.ts:92는 '이메일 변경은 판본을 올리고, 변경 전에 받은 쿠키는 더 이상 통하지 않는다'(set_creator_email 실행 후 readVersion===2, authenticateCreatorApi가 {ok:false})이고, :113은 '이름 변경은 판본을 올리지 않아 세션이 유지된다'(판본 1 유지)이며, :104는 변경 뒤 새 로그인이 통과한다. 지적은 creatorSessionVersion 테스트가 '로그인·옛 쿠키 무효·로그아웃만 다룬다'고 했지만 실제로는 제안한 세 테스트 중 (1)과 (3)이 이미 거기 있다. creatorAccountDecision.integration.test.ts에 sessionVersion 문자열이 없는 것은 사실이나 테스트 파일이 둘로 나뉘어 있을 뿐이다. 누가 .set({ email, updatedAt })로 되돌리면 creatorSessionVersion 테스트의 판본 2 단언이 CI에서 실패한다. 남는 (2) '경합으로 0행이면 판본이 그대로'는 UPDATE가 한 문장(creatorAccountDecision.ts:174-177)이라 판본 증가가 같은 문장에 묶여 있어 구조상 따로 어긋날 수 없다. 보안 보증의 회귀 탐지가 불가능하다는 결론은 성립하지 않는다. 참고로 lib/funding/CLAUDE.md:391 '이미 발급된 creator_session 쿠키는 서버가 끊을 수 없다'는 session_version 도입 뒤의 코드와 어긋나는 낡은 문장이다. 이것은 별도 문서 정정 대상이다.

**FND**

- 파기 대상 밖에 남는 값: 운송장 번호, 운영자 수신함의 후원자 PII 메일 사본, 로그 — `lib/funding/retention.ts:98`  
  → 세 항목 모두 근거가 무너진다. (1) 운송장 번호는 의도적으로 남기는 값이고 처리방침에 공개돼 있다. data/privacyPolicy.ts:393은 보존 항목에 '리워드 발송 상태·택배사·운송장번호'를 적고, 394는 '보존 기간이 지난 뒤 남는 것'에 '이름·연락처·이메일은 (개인정보 파기됨)으로 덮이고 … 리워드 발송 상태·택배사·운송장번호처럼 거래가 있었다는 사실을 설명하는 기록'이 남는다고 명시한다(자동 파기 ①~⑬ 목록에도 운송장은 없다). retention.ts가 fulfillment_updated_by를 남기는 이유를 장문으로 적은 것과 같은 판단 층이며, 운송장 파기를 넣으면 처리방침 문구와 FUNDING_TERMS_VERSION 게이트까지 걸린 문서 변경이 된다. 운송장 자체는 이름이 파기된 뒤에는 사람을 가리키지 못한다. (2) 운영자 메일의 전화·이메일 행 제거는 루트 CLAUDE.md의 'audience: operator' 규칙(핵심 값 고객·연락처·상품·금액·일시를 rows 위쪽에)과 정면으로 충돌한다. 운영자 수신함은 수탁자가 아니라 운영자 본인의 것이며, 입금 확인·환불 송금 같은 실무가 그 연락처에 기댄다. (3) 수탁자 표(data/privacyPolicy.ts:70-71)에는 어떤 수탁자에도 보관 기간 칸이 없고 위탁 고지의 필수 항목도 아니다. Resend·Vercel 보관 설정은 처리방침 문제가 아니라 운영 점검 사항이다. 이미 결정·공개된 사항이라 개선이 아니다.
- 토스 셀프 취소·관리자 환불 뒤에는 공개 페이지를 재검증하지 않는다 — 신청 취소·입금 확인만 한다 — `pages/api/funding/cancel.ts:30`  
  → 비대칭은 맞지만 버그가 아니고, 제안한 수정도 문제를 풀지 못한다. (1) 카드 후원 확정 경로도 재검증이 없다. confirm.ts·lineRefund.ts·success.tsx에는 revalidate 호출이 없고, 호출처는 계좌 입금 생성·입금 확인·미입금 취소·입금 전 신청 취소, 프로젝트 승인·공개 변경뿐이다. 이 호출들은 2026-10-04 '입금 대기도 공개 집계에 센다' 결정에 따라 붙었다. 환불의 60초 지연은 카드 후원이 모금액에 오르는 60초 지연과 같은 수준이다. (2) 화면 숫자의 실제 출처는 정적 HTML이 아니다. useFundingStatus가 마운트 직후 첫 폴링으로 initialStatus를 덮는데(주석에도 명시), 그 응답은 CDN s-maxage=15 + swr=60이고 res.revalidate는 이 API 캐시를 비우지 않는다. 그래서 revalidate를 더해도 취소 직후 최대 15~75초 동안의 낡은 숫자는 그대로다. 기존 withdrawn 재검증도 같은 한계가 있고, 이미 감수된 지연이다. (3) 호출처 목록을 환불까지 넓히면 환불마다 목록·상세 두 경로 ISR 재생성이 붙는다. 얻는 것은 HTML 첫 페인트의 짧은 깜빡임뿐이다.

**OPS**

- sendEmail이 빈 html을 조용히 통과시키고, 필수 인자를 소스 정규식 테스트로만 지킨다 — `lib/email/resend.ts:78`  
  → 관찰 자체(빈 문자열 html이 타입을 통과하고 79행 `if (params.html)`에서 빠진다)는 사실이나 조치할 가치가 없고 제안한 수정은 해롭다. (1) 위반 호출이 없다. grep으로 `html: ''`·삼항 빈 문자열 패턴 0건, html을 변수로 넘기는 호출은 contracts/email.ts 3곳이 모두 buildContractEmailHtml 결과이며, pages/api/inbound/resend.ts의 html은 sendEmail이 아니라 Resend API 직접 fetch라 해당되지 않는다. npx tsc --noEmit도 무오류다. 지적 자신도 '현재 위반 호출은 확인하지 못했다(예방 차원)'고 적는다. (2) 이미 이중으로 막혀 있다. html은 필수 인자(resend.ts:24)라 누락은 컴파일에서 서고, tests/email/layoutGuard.test.ts가 그 선언이 느슨해지는 것을 막으며, 같은 테스트가 <!DOCTYPE 골격이 layout.ts에만 있게 막는다. (3) 제안한 fail-closed(`ok:false` 반환)는 결제 확인·입금 안내 같은 거래 메일이 서식 위반 하나로 아예 안 나가게 한다. 호출부들은 !ok를 notificationError 기록·재시도 대상으로 취급하므로, 서식 없는 글자 메일이 나가는 쪽이 아예 안 나가는 쪽보다 훨씬 낫다. 또 errorCode 'API_ERROR'는 Resend 응답이 아닌 실패에 잘못 쓰인다. 로그 한 줄만 추가하는 대안도 아무도 읽지 않는 로그라 가치가 거의 없다.

**PAY**

- 결제 승인 진입점(success SSR)에 maxDuration 설정이 없다 — 승인 후 후처리가 길어지면 504가 나는 자리 — `pages/[locale]/booking/success.tsx:141`  
  → 전제가 사실과 다르다. 지적은 success SSR이 '계정 기본값'으로 돌아 504 위험이 있다고 보지만, 이 프로젝트의 실제 설정은 Fluid compute 활성이고 함수 기본 타임아웃이 300초다. `vercel api /v9/projects/prj_6JQV...`의 defaultResourceConfig가 fluid:true, functionDefaultTimeout:300(resourceConfig도 fluid:true)로 확인됐다(프로젝트 생성 2025-05-28). 지적이 든 최악 합 50초는 300초 기본값 안이고, 웹훅 라우트의 maxDuration 60은 오히려 기본값보다 낮은 상한이다. 최근 7일 Vercel 런타임 오류(get_runtime_errors)에도 FUNCTION_INVOCATION_TIMEOUT류 오류가 없다. methodAlert.ts 33~38 주석과 웹훅 라우트 주석의 '기본 10초' 전제가 낡은 것이다. 또한 주석의 'getServerSideProps에는 maxDuration을 못 둔다'도 틀렸다(Next 15.5.27의 get-page-static-info.js:487이 pages의 config.maxDuration을 읽는다). 따라서 제안한 vercel.json 글롭(대괄호가 문자 클래스가 되는 문제 포함)은 불필요하다. 나중에 상한이 필요해지면 페이지에 `export const config = { maxDuration: 60 }`를 두면 된다. 코드 변경은 필요 없고, 낡은 주석 정정 정도의 정리(P3)뿐이다.
- 토스 클라이언트와 전 도메인 웹훅 디스패처가 lib/booking에 있어 역의존이 생긴다 — `lib/booking/webhook.ts:1`  
  → 주장한 순환·역의존이 파일 수준에서는 없다. lib/booking/toss.ts는 payments/methodAlert 하나만 import하고(toss.ts:1) funding·shows·billing을 가져오지 않는다. lib/booking/webhook.ts는 다른 도메인을 가져오는 lib/booking 안의 유일한 파일이며, 이 파일을 쓰는 곳은 pages/api/payments/webhook.ts 한 곳뿐이라 순환 import도 번들 결합도 없다. 'cancel.ts는 admin-serialize→toss'도 순환이 아니다(admin-serialize는 isVirtualAccountMethod만 가져온다). 남는 것은 이름이 booking이라 위치 판단이 어렵다는 취향 문제다. 수정안은 30여 파일의 import 이동과, 분기 6개짜리 단일 호출 지점에 핸들러 레지스트리를 도입하는 것이다. 얻는 이득이 이름 정리뿐이라 이 저장소의 '단순하게 만들 것'(한 번 쓰고 말 일에 추상화 금지) 원칙에 어긋난다. CLAUDE.md도 토스 키 규칙에서 lib/booking/toss.ts 경로를 정본으로 가리키고 있어 이동하면 문서도 함께 고쳐야 한다.

**PERF**

- optimizeImages가 mtime 비교로 WebP 재생성 여부를 정해 새 클론(Vercel)에서는 비결정적이다 — `scripts/optimizeImages.js:42`  
  → mtime 동률로 재변환이 일어난다는 관측 자체는 맞다. Vercel 빌드 로그(dpl_4bip1Sxr…)에 prebuild 시작 직후 'Converting …to WebP' 약 45줄이 찍히고 약 5.5초(618.2→623.5) 걸리며, 새 클론 시뮬레이션에서도 쌍 38개 중 32개가 재변환 대상이었다. 그러나 지적의 핵심 피해는 사실이 아니다. 재변환 32개를 같은 sharp로 다시 인코딩해 커밋된 .webp와 바이트 비교하니 32/32가 완전히 동일했다. 따라서 '커밋본↔배포본 불일치'와 immutable URL 바이트 변경 우려는 현실에서 발생하지 않는다. 비용은 빌드당 약 2.5~5초로 총 빌드 약 2분의 몇 %다. 게다가 제안한 수정이 더 해롭다: '존재 여부만 보기'는 jpg를 고쳐도 webp가 갱신되지 않는 낡은 산출물을 만들고, sha256 장부는 CLAUDE.md의 '사소한 이득을 위해 빌드 기계를 들이지 말 것'에 어긋난다. 조치 불필요.
- 홈(LCP 핵심 페이지)이 below-fold MixComparePlayer를 정적 import한다 — `pages/[locale]/index.tsx:32`  
  → 홈의 below-fold 정적 import는 pages/[locale]/index.tsx:11-22에 근거가 적힌 기존 설계 결정이다(과거 next/dynamic ssr:true 분리가 하이드레이션 첫 패스에서 null을 렌더해 뒤따르는 형제 섹션이 밀리는 mismatch를 냈고 prod에서도 TBT 이득이 사실상 없었다). 제안한 `dynamic(..., {ssr:false})` + 같은 높이 placeholder는 그 불일치는 피하지만 02번 절의 문구(copy)가 서버 HTML에서 사라지고 placeholder 높이가 어긋나면 CLS가 생긴다. 이득도 부풀려졌다: MixComparePlayer.tsx 13.9KB(소스 gzip 5.3KB)+data/mixCompare.ts 8KB(gzip 3.4KB)+peaks 0.9KB이고 '14.7KB gzip'은 확인되지 않는다. Vercel 빌드 로그상 홈 페이지 전용 JS는 22.3kB(First Load 261kB)로, 이 컴포넌트가 차지하는 몫은 그 안의 일부다. 모바일 Lighthouse 96점(CLAUDE.md 실측)이라 투자 가치가 없다. 지적문도 신뢰도 0.4로 '현상 유지' 선택지를 열어 두었다.

**PRV**

- 세 종류의 암호화 대상 모두 같은 키 하나를 쓴다 — 용도별 키 분리가 없다 — `lib/crypto/fieldCrypto.ts:139`  
  → 사실 서술(세 컬럼이 FUNDING_FIELD_KEY 하나를 쓴다)은 맞다. 문서 lib/crypto/CLAUDE.md와 처리방침 19항도 '같은 키'라고 고지한다. 그러나 제안한 수정이 문제를 풀지 못한다. (1) 한 마스터 키(env 하나)에서 HKDF로 용도별 서브키를 유도하면 마스터가 유출될 때 세 용도가 모두 열린다. 서브키는 어디에도 따로 저장되지 않으므로 블라스트 반경이 줄지 않는다. 반경을 줄이려면 env 키를 용도별로 따로 두는 수밖에 없다. 그러면 CLAUDE.md가 가장 크게 경고하는 '키를 잃으면 값도 잃는다' 위험면과 회전 절차(OLD 키 쌍, health-check 점검, rotate 스크립트)가 용도 수만큼 늘어난다. (2) 제안이 의존하는 'v3 + AAD 항목'은 이 저장소에 없다. fieldCrypto.ts에는 판본 v1·v2만 있고 AAD 사용도 없다. 운영 DB 암호문 전체를 새 판본으로 옮기는 일이 필요하고 이는 CLAUDE.md가 '순서가 틀리면 데이터를 잃는다'고 한 회전이다. (3) 글쓴이도 '당장의 취약점이 아닌 설계 부채'라고 적었다. 이득이 거의 없는 변경에 위험이 큰 기계를 들이는 것은 루트 CLAUDE.md의 '단순하게 만들 것'과 충돌한다. 줄 번호는 139가 아니라 137이다. 컬럼 간 암호문 바꿔치기를 막고 싶다면 서브키가 아니라 AAD(컬럼 라벨 결합)가 맞는 도구이지만, 이는 별건이고 위협 근거가 필요하다.
- 송금이 끝난 환불 계좌번호 암호문을 5년 더 들고 있다 — `lib/payments/refundAccount.ts:108`  
  → 문제 사실(송금 뒤에도 암호문을 5년 보관)은 맞지만 운영상 의도된 결정이고 수정안이 설계를 깨뜨린다. (1) lib/privacy/orderRetention.ts 225~229 주석이 '환불 계좌는 환불을 실행한 기록이라 전자상거래법상 대금 결제 기록과 같이 5년'이라고 법적 근거를 적었고, 처리방침 3항(133줄)·8항(175줄)이 '환불 기록으로서 대금 결제 기록과 같은 기간 보관한 뒤 파기'라고 고지한다. 글쓴이도 '법적 위반은 아님, 고지와도 일치'라고 인정했다. (2) 제안한 'account_number_enc를 고정 표식으로 덮기'는 실제로 다른 장치를 깨뜨린다. lib/ops/healthCheck.ts:197~230의 checkFieldKeyRotationPending은 isNotNull이면서 v2:<keyId> 접두사가 다른 행을 모두 '지금 키로 열리지 않는 값'으로 센다. 표식 행은 영구히 센다. 옛 키가 없으면 high 긴급 메일이 매일 나간다. 회전 스크립트도 그 행을 code=malformed 실패로 남겨 '실패 0' 조건(CLAUDE.md 6번)이 성립하지 않는다. (3) 송금 후 수신 계좌는 환불 분쟁(미수령 주장)에서 증빙이 되므로 30일 뒤 삭제는 방침 문구와 법적 판단을 새로 해야 한다. 처리방침 개정과 판본 상승, 운영자 결정이 필요한 제품 결정이다. 데이터 최소화 여지는 있지만 현재 제안은 개선이 아니라 회귀를 만든다.

**SEC**

- 서명 API가 형식이 틀린·빈 본인확인 입력까지 시도 횟수로 세어, 링크 소지자가 20회로 서명을 60일간 잠글 수 있다 — `pages/api/contracts/[id]/sign.ts:102`  
  → 사실 서술은 맞다. sign.ts:109의 checkIdentityAttempt가 verifyIdentityDigits(:124)보다 먼저 카운터를 올린다. 그러나 지적한 피해가 제안한 수정으로 풀리지 않는다. 링크 소지자(signToken+id를 알아야 이 줄에 닿는다)는 형식이 맞는 오답 4자리를 20번 보내도 똑같이 잠글 수 있다. 다운로드 쪽 수정(round2 H1)도 '형식이 맞는 시도는 센다'로 설계돼 있어 잠금 가능성 자체는 그대로다. 잠금 설계는 admin-rate-limit.ts:255-270 주석에 '상한에 걸리면 관리자가 재발송, 정말 당사자라면 연락이 올 것'이라고 의도적으로 적혀 있다. 정상 서명자는 sign.tsx:278,434가 4자리와 본인확인 체크를 클라이언트에서 강제해 형식 오류 요청을 보내지 않고, 서명 PNG·동의 항목 검증을 통과한 요청만 이 줄에 닿으므로 우발적 소진 경로도 없다. 성공하면 sign.ts:246이 카운터를 리셋한다. 즉 수정해도 보안 결과가 달라지지 않고 download와 형태를 맞추는 정도의 정리일 뿐이다. 굳이 맞추려면 download.ts:112-124의 wellFormed 분기를 복사하면 되지만 우선순위는 낮다.
- 결제 실패/결제창 열림 비콘이 Origin 헤더(위조 가능)만 방어선으로 쓰고 주문번호가 사실상 능력(capability)이다 — `pages/api/payments/failed.ts:30`  
  → Origin만이 입구 방어라는 서술은 사실이지만 코드가 이미 그 한계를 알고 피해를 끊어 놓았고, 남은 영향은 실질이 없다. recordFailure.ts:77-81 주석이 'Origin 헤더 하나뿐'임을 명시하며, 그래서 상태를 먼저 읽어 pending·failed·expired가 아니면 쓰지 않고(paid·환불 주문은 불변), updated_at을 건드리지 않아 파기 연기도 불가능하게 만들었다. 공격 전제는 유효한 pending 주문번호(SNB/FND/TKT-날짜-무작위 32비트)를 아는 것인데 이는 구매자 본인과 그가 공유한 사람만 안다. 추측은 IP당 분당 20회 제한에 못 미치고 빗나간 시도는 SELECT 한 번으로 끝난다. 구매자가 자기 주문의 실패 사유를 덮는 것은 해가 없다. payment_fail_*의 소비처는 관리자 상세 화면(pages/admin/funding/[id].tsx:420-423의 React 텍스트 렌더, XSS 없음)과 파기 배치뿐이라 기능이 이 값에 달려 있지 않다. opened.ts의 payment_window_opens도 pending 주문에만 적고 브라우저 종류는 서버가 UA에서 정한다. 제안한 HMAC beaconToken은 진단용 비콘에 새 비밀과 응답 필드를 들이는 과잉 설계이고 '단순하게 만들 것' 원칙에 어긋난다. 수용된 잔여 위험이다.

**SEO**

- koOnlyRoutes 테스트가 funding/apply.tsx와 creator-terms.tsx 형제를 대조하지 않는다 — `lib/koOnlyRoutes.test.ts:20`  
  → 지적과 달리 규칙과 페이지가 갈리면 테스트가 잡는다. 하드코딩 목록(KO_ONLY_STATIC_PAGE_FILES)에 apply.tsx가 없는 것은 맞지만, 같은 파일의 두 번째 describe('isKoOnlyRoutePath <-> pages/[locale] 실태 전수 대조')가 pages/[locale] 트리를 직접 walk해 모든 페이지를 소스에서 분류(ko-only-fallback-false / multi-locale-static / ssr)하고 isKoOnlyRoutePath 판정과 파일 단위로 대조한다. `npx jest lib/koOnlyRoutes.test.ts --verbose`를 실행하니 87건 통과했고 'pages/[locale]/funding/apply.tsx'와 'pages/[locale]/funding/creator-terms.tsx'가 각각 개별 케이스로 돈다. apply.tsx는 getStaticPaths ko 단일+fallback:false라 ko-only로 분류되어 `isKoOnlyRoutePath('/funding/apply')`가 true여야 하고(별도 명시 테스트 'funding/apply는 ko 전용 정적 페이지다'도 있음), creator-terms.tsx는 getServerSideProps라 ssr로 분류되어 false여야 한다(literalSiblings에 포함). 누가 apply를 다국어로 열거나 creator-terms를 ko 전용 정적으로 바꾸면 이 대조가 실패한다. 파일 상단 주석도 하드코딩 목록의 한계를 알고 walk로 보완했다고 적고 있다. 제안한 두 줄 추가는 중복이다.

### B. 검증 통계

| 항목 | 값 |
|---|---|
| dimensions_run | 17 |
| dimensions_dropped |  |
| round2_dimensions | payments, shows, funding-core, funding-creator |
| findings_total | 531 |
| confirmed | 79 |
| adjusted | 427 |
| refuted | 25 |
| unverified | 0 |
| repro_checked | 1 |
| cross_dim_overlaps | 89 |
| overflow | 104 |

