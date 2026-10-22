# 영상 제작(유튜브 촬영·뮤직비디오) 서비스 페이지 설계 — 2026-10

상태: **구현(2026-10-22)**. 운영자 결정: 뮤직비디오·라이브(유튜브 포함) 모두 50만원부터, 카메라 대수·촬영 시간은 협의,
촬영은 해방필름 치치 감독, 음악 라이브 클립과 유튜브 채널 콘텐츠(토크·인터뷰) 모두 가능, 아티스트 이름 노출 가능, 문의는 대부분 카톡.

구현과 설계안이 다른 점:
- 상품은 둘이다 — `package-music-video`(MUSIC_VIDEO_FROM_PRICE)와 `package-live-video`(LIVE_VIDEO_FROM_PRICE, 라이브 클립 + 유튜브 콘텐츠).
  "라이브세션도 마찬가지"라 유튜브 콘텐츠를 따로 떼지 않았다.
- VideoObject 구조화 데이터는 붙이지 않았다 — 영상이 아티스트·레이블·해방필름 채널 소유라 publisher를 우리로 적을 수 없다.
- 히어로·장면 그림은 〈남산타워〉 MV 프레임(가사 자막이 없는 0:06, 0:08 장면을 잘라 냄)이다.
- 카드 문구 중 "장소 대관·출연·스타일링 실비 별도", "출장 실비", "수정 횟수·납기는 견적 때"는 운영자가 "적당히" 맡긴 부분이다 — 바뀌면 data/pricing.ts·common.json `musicVideo.faq`를 같이 고친다.

아래는 처음 설계안이다.

## 1. 지금 있는 것

| 자산 | 위치 | 내용 |
|---|---|---|
| 커버 영상 페이지 | `pages/[locale]/cover-video.tsx` | 스튜디오 안 1곡 커버 촬영, 35만원(`COVER_VIDEO_PACKAGE_PRICE`), 3시간·4K 카메라 1대·기본 믹싱·편집. 온라인 예약 있음(`/ko/booking/cover-video`) |
| 촬영 대관 | `data/pricing.ts` `package-rental` | 유튜브·방송 촬영 대관 10만원/시간(조명 무료, 메인 부스). 촬영 인력 없음 |
| 커버 영상 허브 | `data/buyerIntentHubs.ts` `cover-video-production` | 가이드 허브 |
| 유튜브 임베드 | `components/funding/FundingVideo.tsx` | 누르기 전엔 썸네일만, 누르면 youtube-nocookie iframe. CSP `frame-src`에 이미 열려 있음 |

빠진 것: **뮤직비디오(기획·로케이션·연출)** 상품과, 우리가 찍은 **영상 포트폴리오**. 지금 사이트의 포트폴리오(`data/portfolio/`)는 음반만 다룬다.

## 2. 페이지 구조 결정

**새 페이지 `/[locale]/music-video` 하나를 영상 서비스의 정본으로 두고, `/cover-video`는 그대로 둔다.**

- 커버 영상 페이지는 "커버 영상 촬영" 검색 의도에 맞춰 이미 색인·예약이 붙어 있다. 합치면 URL·리디렉션·예약 링크가 같이 움직이고 측정이 교락된다.
- 새 페이지는 "뮤직비디오 제작 / 뮤비 제작 비용 / 유튜브 영상 촬영 / 라이브 클립 촬영" 의도를 받는다. 커버 영상은 이 페이지의 가격표에 **한 줄(가장 싼 선택지)로 다시 소개하고 `/cover-video`로 보낸다** — 가격은 같은 상수에서 읽는다.
- slug는 `music-video`(영문 검색어와 같고, 소문자·짧음). "유튜브 촬영"은 제목·h2로 받는다.

## 3. 상품 사다리(안)

| 단계 | 이름(안) | 장소 | 누가 | 가격 |
|---|---|---|---|---|
| 0 | 촬영 대관 | 스튜디오 | 고객 팀 | 기존 10만원/시간(그대로) |
| 1 | 커버 영상 | 스튜디오 | 스튜디오 | 기존 35만원(그대로, `/cover-video`로) |
| 2 | 라이브 세션 영상(유튜브용) | 스튜디오 | 스튜디오 | **미정** — 멀티캠 대수·곡 수·라이브 녹음 믹싱 포함 여부 |
| 3 | 뮤직비디오 | 스튜디오 + 로케이션 | 스튜디오(+외부 감독?) | **미정** — 하한가 "~부터" + 견적 |

- 2·3단계 가격은 `data/pricing.ts`에 상수(`LIVE_SESSION_VIDEO_PRICE`, `MUSIC_VIDEO_FROM_PRICE`)와 오퍼 id(`package-live-session-video`, `package-music-video`)로 넣는다. 카피에 금액 리터럴 금지(가격 드리프트 가드). 표기가는 부가세 포함.
- 뮤직비디오는 범위 변동이 커서 **온라인 결제·예약을 붙이지 않는다**. 카카오 상담 → 견적 → 필요하면 맞춤 결제 링크(`/admin/payment-links`). 계약이 필요해지면 제작 계약 엔진(`lib/contracts/production/`)에 `kind`를 더하는 건 별도 설계.
- 발매 번들(싱글·EP·정규)에 MV를 끼우는 결합 상품은 1차에 하지 않는다 — "발매 티어 하한 = 번들가" 규칙이 걸려 있다.

## 4. 페이지 섹션 순서

커버 영상 페이지와 같은 뼈대(`ImageHero` · `QuickAnswers` · `Section` · `PricingCard` · `KakaoSectionBar` · `RuleList` · `FAQSection`)를 쓴다. 새 프리미티브를 만들지 않는다.

1. **히어로** — 배경은 우리가 찍은 MV의 한 장면(스틸 webp, 파일명에 날짜). CTA 1차 카카오(옐로, ko) / 2차 "포트폴리오 보기"(`#video-portfolio`, inverse). 비-ko는 1차 `/contact`.
2. **QuickAnswers 3개** — 비용 하한 · 기간 · 무엇을 받는가(해상도·컷 수·원본 제공 여부).
3. **영상 포트폴리오** ← 이 페이지의 핵심. 아래 5절.
4. **무엇을 찍나** — 뮤직비디오 / 라이브 세션 / 커버 / 인터뷰·티저(카드 4).
5. **가격** — 3절 사다리를 카드로. 카카오 CTA는 행 아래 `KakaoSectionBar` 하나.
6. **진행 절차** — 상담 → 기획·콘티 → 촬영 → 편집·색보정 → 수정 → 납품(`RuleList numbered`). HowTo 스키마.
7. **음원도 같이** — 녹음·믹싱·발매 프로젝트로 가는 링크(우리만의 강점: 음원과 영상을 한 곳에서).
8. FAQ · 후기 · 관련 스토리 · ServiceQuickLinks · ContactCTA.

## 5. 영상 포트폴리오

**데이터** `data/videoPortfolio.ts`(코드 정본, DB 아님 — 배포로 추가):

```ts
interface VideoWork {
  id: string;            // 'kim-dongsan-wave-mv'
  youtubeId: string;     // 11자, 받은 링크에서 추출
  kind: 'music-video' | 'live-session' | 'cover' | 'other';
  title: string;         // 곡명
  artist: string;
  year: number;
  role: Array<'direction' | 'filming' | 'editing' | 'color' | 'audio'>; // 우리가 한 일
  featured?: boolean;    // 히어로 아래 큰 칸
  caption?: { ko: string; en?: string };
}
```

- `role`이 중요하다: 우리가 실제로 맡은 일만 적는다(촬영만 했는지, 편집·음원까지 했는지). 받은 링크마다 운영자에게 확인한다 — 스토리의 "날조 후보" 규칙과 같은 이유.
- `youtubeId`는 11자 정규식 테스트로 고정, 중복 금지 테스트.

**컴포넌트** — `FundingVideo`의 파사드 로직을 `components/media/YouTubeFacade.tsx`로 떼어 내고 `FundingVideo`도 그걸 쓰게 한다(같은 코드 두 벌 금지). 그 위에 `VideoPortfolioGrid`:

- featured 1편은 큰 16:9, 나머지는 2열(모바일 1열) 그리드, `kind` 필터 칩(전체·뮤직비디오·라이브·커버).
- 썸네일은 `i.ytimg.com/vi/<id>/hqdefault.jpg`(maxres는 없는 영상이 있어 404 회색 그림이 뜬다 → hq 기본, featured만 maxres + onError 폴백). `loading="lazy"`.
- 재생 전에는 유튜브 요청 0건(파사드) — LCP·TBT 보호. 한 번에 하나만 재생.
- 페이지 성능 확인: 로컬 lighthouse(devtools 스로틀) 모바일, 기존 서비스 페이지 수준(90+).

**스키마** — 각 영상 `VideoObject`(name·thumbnailUrl·embedUrl·uploadDate). uploadDate는 oEmbed에 없어 YouTube Data API로 한 번 받아 데이터 파일에 적는다(없으면 VideoObject를 빼고 Service 스키마만).

## 6. 등록해야 하는 곳(빠뜨리면 CI가 잡거나 조용히 빠진다)

- `lib/sitemap/routes.js` pageRouteMap + `npm run generate:page-lastmod`(이번 라우트만 남기기)
- `components/layout/Header.tsx`(커버 영상 옆) · `Footer.tsx`
- `pages/api/llms.ts`, `utils/schema/business.ts`(서비스 목록)
- `public/locales/*/common.json` `musicVideo.*` 7개 로케일(ko 정본, 나머지 번역)
- `data/serviceRelatedStories.ts`(관련 스토리), 필요하면 `buyerIntentHubs` 카드
- `/pricing` 요약표에 두 오퍼 추가, `data/pricing.test.ts` 매핑
- 배포 뒤 GSC 색인 요청(`/ko/music-video`) — 상업 LP 규칙

## 7. 운영자가 정할 것

1. 라이브 세션·뮤직비디오 **가격**(또는 하한)과 각각 포함 범위 — 카메라 대수, 촬영 시간, 로케이션 이동·대관비, 조명·배우·스타일링, 컷 수·길이, 색보정, 수정 횟수, 납기, 원본(raw) 제공.
2. **촬영 주체** — 스튜디오가 직접 찍나, 외부 감독·촬영팀과 협업인가(화면에 "직접"이라고 써도 되는가).
3. "유튜브 영상 촬영"의 뜻 — 음악 라이브 클립만인가, 유튜버 채널 콘텐츠(토크·인터뷰·브이로그)까지인가. 후자면 상품 한 줄이 더 생긴다.
4. 포트폴리오 링크 + 영상마다 **우리가 한 일**(연출·촬영·편집·음원) · 아티스트 이름 노출 허락 여부.
5. 히어로에 쓸 스틸 이미지(원본 프레임 또는 촬영 현장 사진).
