---
slug: mok-jareugi
title: 목자르기 — 10·10 풍천리 잣나무 숲 앞 공연 펀딩
summary: 10월 10일 풍천리 마을회관 앞에서 음악가 7팀이 공연합니다. 펀딩해 주시면 앨범 〈이름을 모르는 먼 곳의 그대에게〉 13곡, 또는 〈물고기는 물이 없으면 죽어요〉 8곡을 보내 드립니다.
# 원본은 pine-nut(풍천리를 지켜주세요) 저장소의 공연 이미지. 그림을 바꾸면 **파일명도** 바꿀 것 —
# /images/**는 immutable 캐시라 같은 이름에 그림만 갈면 옛 그림이 남는다.
# cover = 대표 포스터(붉은 목) 전체를 16:9에 앉힌 것(목록 카드). 바탕은 같은 포스터를 흐리고 어둡게.
# ogImage = pine-nut 저장소의 가로 공유 카드 그대로.
# heroImage = pine-nut before-cut 페이지의 실사 현지 사진(real-canopy.jpg, "산림청이 꼽은
#   100대 명품숲 · 국내 최대 잣나무 숲 (풍천리 현지 사진)" 캡션이 달려 있던 그 사진)을 1920x1080에
#   맞추고 modulate로 조금 어둡게·덜 채도있게 뺀 것(운영자 요청 2026-09-30 — "아무 풍천리
#   사진 어울리는거 넣어줘"). 일러스트 대신 실사를 쓴다. 펀딩 히어로는 HERO_SCRIM_STRONG을
#   쓰므로(ProjectDetailView.tsx) 별도 조정 없이도 흰 글씨 대비가 나온다 — 배경을 다시
#   바꾸면 그 컴포넌트 주석대로 대비를 재측정할 것.
# 제목은 木 대신 '목'으로 쓴다 — 히어로 제목 폰트(Pretendard 서브셋)에 한자가 없다.
# "출연" 절은 `%%funding-lineup:<id>%%` 숏코드로 사람마다 카드(원형 사진+이름+소개)를
# 낸다(components/funding/FundingLineupPerson.tsx). 한 장의 그리드 이미지 + 아래 이름
# 목록으로 분리했던 시도, 마크다운 title 폭 힌트로 사진만 작게 낸 시도를 차례로 거쳐
# 되돌렸다 — raw HTML을 못 쓰는 마크다운 본문(MarkdownRenderer.tsx의
# disableParsingRawHTML)으로는 pine-nut처럼 사진·이름·소개를 한 카드에 담을 수 없어서다
# (운영자 지적 2026-09-30, 세 차례 반려 끝에 숏코드로 정착). 프로필 사진(DJ스탑원·DJ괄
# 포함, 각자 한 장씩)은 그 컴포넌트가 직접 참조하며, 여기 마크다운에서는 더 이상
# 이미지 경로를 적지 않는다.
cover: /images/funding/mok-jareugi/cover-20260929.webp
ogImage: /images/funding/mok-jareugi/og-20260929.webp
heroImage: /images/funding/mok-jareugi/hero-20260930.webp
goalAmount: 1000000
# 마감은 공연(10/10) 2주 뒤 — saf-2026 풍천리 펀딩(8/1 공연 → 8/15 마감)과 같은 간격.
startAt: 2026-09-29T00:00:00+09:00
endAt: 2026-10-24T23:59:59+09:00
# 결제가 들어오기 시작하면 리워드 id·금액·한정 여부는 바꾸지 않는다(CLAUDE.md 펀딩 절).
status: auto
hidden: false
lastmod: 2026-10-01
# 리워드는 강정 펀딩(keep-singing-for-palestine)과 같은 앨범, 같은 R2 객체다(운영자 확인,
# 2026-09-29). 박치치 시/노래집은 강정 쪽 상품이라 싣지 않는다.
# 리워드 배열 기준은 강정 펀딩과 같다(그 파일 맨 위 주석): 음원은 앨범 단위로 묶어 〈이름을 모르는…〉 → 〈물고기는…〉(`fish-` 접두사)
# 순, 앨범 안에서는 금액 오름차순. content/funding.test.ts가 순서를 검사한다.
rewards:
  - id: mp3
    title: 음원 펀딩 — MP3
    description: 앨범 13곡 전체를 MP3 320kbps로 보내 드립니다. 내려받기 주소는 결제 확정 메일과 펀딩 확인 페이지에 함께 보내 드립니다.
    amount: 10000
    requiresShipping: false
    estimatedDelivery: 결제 확정 즉시
    image: /images/funding/keep-singing-for-palestine/album.webp
    downloads:
      - label: MP3 320kbps
        key: kspf-2026/41ea2fc69b54b29e438d3e3f3aa0fca9/album-mp3-320.zip
  - id: wav-cd
    title: 음원 펀딩 — MP3 + CD 음질, 두 가지 모두
    description: 앨범 13곡 전체를 MP3 320kbps와 CD 음질 16bit 44.1kHz WAV, 두 가지로 모두 보내 드립니다.
    amount: 30000
    requiresShipping: false
    estimatedDelivery: 결제 확정 즉시
    image: /images/funding/keep-singing-for-palestine/album.webp
    downloads:
      - label: MP3 320kbps
        key: kspf-2026/41ea2fc69b54b29e438d3e3f3aa0fca9/album-mp3-320.zip
      - label: WAV 16bit 44.1kHz (CD 음질)
        key: kspf-2026/41ea2fc69b54b29e438d3e3f3aa0fca9/album-wav-16-44.zip
  - id: wav-hires
    title: 음원 펀딩 — 24bit 96kHz까지 세 가지 모두
    description: 앨범 13곡 전체를 세 가지 음질로 모두 보내 드립니다. MP3 320kbps, CD 음질 16bit 44.1kHz WAV, 그리고 스튜디오 마스터와 같은 24bit 96kHz WAV 원본(약 1.8GB)입니다.
    amount: 50000
    requiresShipping: false
    estimatedDelivery: 결제 확정 즉시
    image: /images/funding/keep-singing-for-palestine/album.webp
    downloads:
      - label: MP3 320kbps
        key: kspf-2026/41ea2fc69b54b29e438d3e3f3aa0fca9/album-mp3-320.zip
      - label: WAV 16bit 44.1kHz (CD 음질)
        key: kspf-2026/41ea2fc69b54b29e438d3e3f3aa0fca9/album-wav-16-44.zip
      - label: WAV 24bit 96kHz (스튜디오 마스터)
        key: kspf-2026/41ea2fc69b54b29e438d3e3f3aa0fca9/album-wav-24-96.zip
  - id: wav-hires-plus
    title: 가장 든든한 음원 펀딩
    description: 앨범 13곡 전체를 MP3 320kbps, CD 음질 16bit 44.1kHz WAV, 그리고 스튜디오 마스터와 같은 24bit 96kHz WAV 원본(약 1.8GB)으로 보내 드립니다.
    amount: 100000
    requiresShipping: false
    estimatedDelivery: 결제 확정 즉시
    image: /images/funding/keep-singing-for-palestine/album.webp
    downloads:
      - label: MP3 320kbps
        key: kspf-2026/41ea2fc69b54b29e438d3e3f3aa0fca9/album-mp3-320.zip
      - label: WAV 16bit 44.1kHz (CD 음질)
        key: kspf-2026/41ea2fc69b54b29e438d3e3f3aa0fca9/album-wav-16-44.zip
      - label: WAV 24bit 96kHz (스튜디오 마스터)
        key: kspf-2026/41ea2fc69b54b29e438d3e3f3aa0fca9/album-wav-24-96.zip
  # 옴니버스 〈물고기는 물이 없으면 죽어요〉(2022, 노량진수산시장 예술해방전선). 강정 펀딩과 같은 앨범, 같은 R2 객체다
  # (운영자 확인·참여 뮤지션 동의, 2026-10-01). 8곡, WAV는 16bit 44.1kHz까지만 있다(24bit 마스터 없음).
  # 오픈 뒤라 id·금액은 바꾸지 않는다.
  - id: fish-mp3
    title: 음원 펀딩 — 〈물고기는 물이 없으면 죽어요〉 MP3
    description: 옴니버스 앨범 〈물고기는 물이 없으면 죽어요〉 8곡 전체를 MP3 320kbps로 보내 드립니다. 내려받기 주소는 결제 확정 메일과 펀딩 확인 페이지에 함께 보내 드립니다.
    amount: 10000
    requiresShipping: false
    estimatedDelivery: 결제 확정 즉시
    image: /images/funding/keep-singing-for-palestine/fish-album-20260930.webp
    downloads:
      - label: 〈물고기는 물이 없으면 죽어요〉 MP3 320kbps
        key: kspf-2026/389164c8ee6ab6724da5bc8902d1984f/fish-mp3-320.zip
  - id: fish-wav
    title: 음원 펀딩 — 〈물고기는 물이 없으면 죽어요〉 MP3 + CD 음질
    description: 〈물고기는 물이 없으면 죽어요〉 8곡 전체를 MP3 320kbps와 CD 음질 16bit 44.1kHz WAV, 두 가지로 모두 보내 드립니다.
    amount: 30000
    requiresShipping: false
    estimatedDelivery: 결제 확정 즉시
    image: /images/funding/keep-singing-for-palestine/fish-album-20260930.webp
    downloads:
      - label: 〈물고기는 물이 없으면 죽어요〉 MP3 320kbps
        key: kspf-2026/389164c8ee6ab6724da5bc8902d1984f/fish-mp3-320.zip
      - label: 〈물고기는 물이 없으면 죽어요〉 WAV 16bit 44.1kHz (CD 음질)
        key: kspf-2026/389164c8ee6ab6724da5bc8902d1984f/fish-wav-16-44.zip
---

## 10월 10일, 아직 서 있는 나무 앞에서

![「목자르기」 공연 포스터 — 초록 잣나무 숲 위에 붉게 물든 사람의 목이 겹쳐 있고, 붉은 띠 위에 '木자르기'가 세 번 적혀 있다. 위쪽에 출연 7팀의 이름, 아래쪽에 2026년 10월 10일(토) 오후 2시 무료관람, 장소 풍천리 마을회관 앞이 적혀 있다](/images/funding/mok-jareugi/poster-20260929.webp)

야호야호단이 기획해, 10월 10일 풍천리 마을회관 앞에서 공연 「목자르기」를 엽니다. 음악가 7팀이 벌목을 앞둔 잣나무 숲 앞에서 노래합니다. 풍천리 양수발전소 건설을 반대해 온 주민들 곁에 서기 위한 자리로, 8월 1일 청와대 앞 「베어지기 전에 풍천리」, 9월 5일 풍천리 잣나무 마을 잔치에 이은 공연입니다.

- 일시: 2026년 10월 10일(토) 오후 2시부터 6시경까지
- 장소: 강원도 홍천군 화촌면 풍천리 마을회관 앞
- 입장: 무료, 예매나 사전 신청 없이 오시면 됩니다
- 기획: 야호야호단

공연 안내는 [풍천리를 지켜주세요 — 목자르기](https://pungcheonri.vercel.app/concert/mok-jareugi)에서도 보실 수 있습니다.

## 왜 '목'인가

포스터에 적힌 제목은 木자르기입니다. 나무를 자른다는 뜻이고, 동시에 목을 자른다는 뜻입니다. 말장난처럼 보이지만 풍천리에서는 말장난이 아닙니다.

> **우리의 나무를 자르는 건**
>
> **우리의 목을 자르는 거야**

잣나무가 이 마을의 수입입니다. 숲이 물을 머금어 논밭으로 내려보내고, 그 아래 51가구가 삽니다. 나무를 베는 일은 풍경을 바꾸는 일이 아니라 사람이 여기서 계속 살 수 있는지를 결정하는 일입니다. 주민들이 8년을 버틴 이유가 그것입니다.

그리고 지금, 베는 일이 시작됐습니다. 이설도로 공사로 잣나무 2,256그루가 먼저 쓰러졌고 본공사는 착공됐습니다. 톱날은 이미 숲의 가장자리를 지났습니다.

## 풍천리에서 일어나고 있는 일

강원도 홍천군 화촌면 풍천리에 600MW 규모의 홍천 양수발전소 1·2호기가 들어섭니다. 한국수력원자력이 추진하는 사업으로, 2025년 8월 29일 실시계획이 승인·고시됐고 2026년 1월 본공사가 착공됐습니다.

이 공사로 산림청이 '100대 명품숲'으로 지정한 1,800ha 잣나무 숲이 훼손됩니다. 한국수력원자력이 베겠다는 잣나무는 111,999그루이고, 51가구가 살던 터는 물에 잠깁니다. 주민들은 이 숲에서 산양을 봤다고 증언합니다. 베어지는 나무만 잃는 것이 아닙니다 — 발전소가 들어서면 살아남은 잣나무들도 온전히 자라기 어려운 환경이 되고, 한 번 지으면 이 생태계는 돌이킬 수 없는 피해를 입습니다. 국내산 잣의 62%가 이 숲에서 납니다.

8년째입니다. 주민들이 양수발전소에 반대하며 거리에 선 시간이. 2019년 3월 첫 집회 이후 705번 넘게 거리에 섰고, 평균 연령은 약 70세입니다. 예순에서 여든의 손들이 팻말을 들었고, 그 가운데 일곱 분은 지금도 재판을 받고 있습니다. 2024년 7월 홍천군청 농성에서 주민들이 퇴거불응 혐의로 연행됐고(보도에 따라 7~8명), 같은 해 12월 총 1,800만 원의 벌금 약식명령이 내려져 반대위가 정식재판을 요구했습니다.

싸움이 길어질수록 마을에서 사라지는 것은 나무만이 아닙니다. 웃음이 먼저 사라집니다.

> **"사람답게 산 것 같다. 몇 년 만에 웃어봤는지 모르겠다."**
>
> — 허순이 주민, 2025년 7월 「잣나무골 여름잔치」에서

## 출연

%%funding-lineup:mok-jareugi-yangchaae%%

%%funding-lineup:mok-jareugi-dj-duo%%

%%funding-lineup:mok-jareugi-sabbaha%%

%%funding-lineup:mok-jareugi-collins%%

%%funding-lineup:mok-jareugi-parkjihwi%%

%%funding-lineup:mok-jareugi-next%%

%%funding-lineup:mok-jareugi-van-kiden%%

## 펀딩해 주시면 보내 드리는 것 — 〈이름을 모르는 먼 곳의 그대에게〉

![〈이름을 모르는 먼 곳의 그대에게〉 앨범 커버](/images/funding/keep-singing-for-palestine/album.webp "320")

강정피스앤뮤직캠프는 제주 강정마을의 해군기지 반대운동 속에서 2023년 처음 열린 음악 축제입니다. 2024년에는 캠프를 열지 못했고, 대신 12팀의 뮤지션이 모여 앨범 한 장을 만들었습니다. 록과 포크와 재즈와 일렉트로닉이 한 장에 들어갔고, 히든 트랙을 포함해 모두 13곡입니다.

### 수록곡

| | 곡 | 아티스트 |
|---|---|---|
| 1 | When I look at the Horizon | Project Around Surround |
| 2 | 이 땅이 니 땅이가 | 정진석 |
| 3 | 물결 | 김동산과 블루이웃 |
| 4 | 안녕 (먼 곳의 그대에게) | 남수 |
| 5 | TRANSITION | 까르 |
| 6 | 별을 보러 간 사람 | 김인 |
| 7 | We will sail for your freedom | 모레도토요일 |
| 8 | 눈 앞의 마음 | 나뭇잎들 |
| 9 | 서울의 밤 (feat. 정수민) | 여유 |
| 10 | If this can be tolerated, what can't be? | 모모 |
| 11 | 분홍색 패딩 소녀 | 자이(Jai) x HANASH |
| 12 | 우리 | 이서영 |
| 13 | 모르는 (Hidden Track) | 모레도토요일 |

앨범은 두 장이고, 이 절은 첫 번째 앨범의 티어입니다. 펀딩해 주신 금액에 따라 받으시는 음질이 달라집니다. 1만 원은 MP3 320kbps, 3만 원은 MP3와 CD 음질 WAV 두 가지, 5만 원과 10만 원은 여기에 24bit 96kHz 스튜디오 마스터까지 세 가지를 모두 보내 드립니다. 어느 쪽이든 13곡 전체입니다.

원하시면 결제 화면에서 응원 메시지를 남기고, 이름과 함께 후원자 명단에 공개할 수 있습니다. 공개 여부는 펀딩 확인 페이지에서 언제든 다시 바꾸실 수 있습니다.

## 또 하나의 앨범 — 〈물고기는 물이 없으면 죽어요〉

![〈물고기는 물이 없으면 죽어요〉 앨범 커버 — 어두운 보랏빛 바탕 위에 물고기 한 마리가 그려져 있고, 오른쪽 아래에 앨범 제목이 손글씨로 적혀 있다](/images/funding/keep-singing-for-palestine/fish-album-20260930.webp "320")

2022년, 노량진수산시장 예술해방전선이 낸 옴니버스 앨범입니다. 옛 노량진수산시장에서 쫓겨난 상인들과 연대하는 뮤지션 8팀이 상인들의 이야기에서 영향을 받아 쓰거나, 상인들에게 들려주고 싶어서 만든 8곡을 담았습니다. 서울레코드페어에서 CD 100장만 만들었고 추가 제작은 하지 않았으며, 판매 수익금은 전액 상인들에게 후원됐습니다.

수협이 새 시장으로 이전을 요구하자 높은 임대료와 줄어든 판매 면적을 감당하기 어려운 고령 여성 상인들이 옛 시장에 남았습니다. 2017년부터 이어진 명도집행을 상인과 시민들이 몸으로 막아섰고, 2019년 8월 상가 대부분이 철거된 뒤 상인들은 노량진역 육교 위에 천막을 치고 농성했습니다. 예술해방전선의 음악가들은 같은 해 10월부터 그 곁에서 연주하고 노래를 만들어 왔습니다. 제목은 상인들의 마음입니다. 물고기가 물이 없으면 죽듯, 삶의 터전인 시장을 없애면 살아가기 어렵다는 뜻입니다.

이 앨범도 음원으로 받으실 수 있습니다. 1만 원은 MP3 320kbps, 3만 원은 MP3와 CD 음질 16bit 44.1kHz WAV 두 가지입니다. 24bit 마스터 원본은 없습니다. 두 앨범을 모두 받으시려면 결제 화면에서 리워드를 함께 담으시면 됩니다.

### 수록곡

| | 곡 | 아티스트 |
|---|---|---|
| 1 | 물고기는 물이 없으면 죽어요 | 맑은 |
| 2 | 종이 위의 숫자 | Jinu Konda |
| 3 | 노량진 육교 위에 | 고효경 |
| 4 | 소명 | 경하와 세민 |
| 5 | 반추 | 유동혁 |
| 6 | 마지막 인사 | 박치치 |
| 7 | 지지마요 | 길가는 밴드 |
| 8 | 자명 | 초륜 |

## 펀딩 금액은 이렇게 쓰입니다

10월 10일 공연에 드는 실비에 씁니다. 뮤지션과 스태프의 식비, 그 밖의 공연 진행 비용입니다. 목표를 넘는 금액은 풍천리 양수발전소 건설 반대 대책위원회의 후속 활동에 보탭니다.

이 펀딩은 기부가 아니라 리워드가 있는 선주문 형태의 통신판매입니다. 기부금영수증은 발급되지 않습니다.

공연과 펀딩, 리워드 문의는 모두 스튜디오 놀이 받습니다.

## 일정

- 10월 10일(토) 오후 2시 — 「목자르기」 공연, 풍천리 마을회관 앞
- 10월 24일(토) — 펀딩 마감

## 내려받기 안내

결제가 확정되면 내려받기 주소를 메일로 보내 드립니다. 펀딩 확인 페이지에서도 언제든 다시 보실 수 있습니다.

내려받는 형태의 리워드라 내려받기가 시작된 뒤에는 청약철회가 제한됩니다. 내려받기 전이고 모금이 진행 중이며 아직 발송 준비가 시작되지 않았다면, 펀딩 확인 페이지에서 취소하고 전액 환불받으실 수 있습니다.
