---
title: "기타 믹싱 완전 가이드 — 일렉·어쿠스틱 기타 EQ·컴프레서 실전 설정"
date: 2026-04-07
author: "스튜디오 놀"
category: "음반 제작 가이드"
tags: ["기타 믹싱", "일렉기타 EQ", "어쿠스틱기타 EQ", "기타 컴프레서", "기타 레이어링", "기타 스테레오", "기타 리버브"]
thumbnail: "/images/portfolio4.webp"
summary: "기타 믹싱 완전 가이드입니다. 일렉기타·어쿠스틱기타 EQ 포인트, 컴프레서 설정, 스테레오 더블 트래킹, 리버브·딜레이 처리, 보컬과의 주파수 관계를 정리합니다."
faq:
  - q: "일렉기타 믹싱에서 가장 중요한 EQ 포인트는?"
    a: "100~200Hz의 탁한 공명 컷, 2~4kHz의 어택·존재감, 3~6kHz의 크런치·하모닉스입니다. 앰프 사운드가 탁하면 300~500Hz를 컷하고, 너무 날카로우면 4~6kHz를 약간 줄입니다."
  - q: "어쿠스틱 기타 믹싱에서 보컬과 주파수가 충돌하면?"
    a: "어쿠스틱 기타는 100~500Hz의 바디감이 보컬 중역과 겹칩니다. 보컬이 들어오는 구간에서 기타의 중역(300~800Hz)을 약간 EQ 컷하거나, FabFilter Pro-Q3 Collision Detection으로 자동 카빙합니다."
  - q: "일렉기타를 스테레오로 배치하는 방법은?"
    a: "더블 트래킹(같은 파트를 두 번 연주)이 가장 자연스러운 스테레오를 만듭니다. 두 테이크를 L/R에 100% 패닝합니다. 또는 앰프 시뮬레이터에서 두 개의 다른 마이크 포지션을 L/R에 배치합니다."
  - q: "기타 리버브는 어느 정도 사용해야 하나요?"
    a: "장르에 따라 다릅니다. 록·얼터너티브는 리버브 최소화(짧은 Room), 클린 팝·재즈는 Short Plate, 발라드는 Hall 1~2초 정도가 일반적입니다. 기타 리버브가 너무 많으면 보컬 공간을 가립니다."
---
![기타 믹싱 완전 가이드 — 스튜디오 놀](/images/portfolio4.webp)

## 기타 믹싱 — 일렉과 어쿠스틱의 핵심

기타는 믹스에서 보컬 다음으로 중요한 악기로, 장르와 연주 스타일에 따라 전혀 다른 믹싱 접근이 필요합니다.

---

## 일렉기타 EQ

| 주파수 | 처리 | 효과 |
|--------|------|------|
| 80Hz 이하 | HPF 컷 | 저역 허밍 제거 |
| 100~200Hz | -2~-4dB 컷 | 탁함·뭉침 제거 |
| 300~500Hz | 취향에 따라 | 따뜻함 vs 선명함 |
| 2~3kHz | +1~2dB 부스트 | 존재감·어택 |
| 4~6kHz | 취향에 따라 | 크런치·하모닉스 |
| 8kHz~ | +1dB (클린) | 에어감 |

---

## 어쿠스틱기타 EQ

| 주파수 | 처리 | 효과 |
|--------|------|------|
| 80~100Hz | HPF 컷 | 저역 노이즈 제거 |
| 100~200Hz | -2~-3dB 컷 | 탁한 공명 제거 |
| 200~400Hz | 유지 | 바디감·따뜻함 |
| 1~3kHz | 약간 부스트 | 선명도·스트러밍 어택 |
| 8~12kHz | +1~2dB 부스트 | 공기감·밝기 |

---

## 기타 컴프레서 설정

작은 조정이 전체 믹스 밸런스에 예상보다 큰 영향을 줄 수 있으니 단계적으로 적용하세요.

### 어쿠스틱 기타 (자연스러운 컴프레션)

- Ratio: 3:1~4:1
- Attack: 30~50ms (어택 통과)
- Release: 200~400ms
- GR: -3~-6dB
- 목적: 다이나믹 안정화, 서스테인 강화

### 일렉기타 클린 (레벨 평탄화)

- Ratio: 4:1
- Attack: 10~20ms
- Release: 150~300ms
- GR: -4~-6dB

### 일렉기타 리듬 (타이트한 컴프레션)

- Ratio: 6:1~8:1
- Attack: 5~10ms (빠름)
- GR: -6~-8dB

---

## 스테레오 더블 트래킹

아래 수치는 가이드라인이며, 최종 판단은 항상 귀로 합니다.

### 더블 트래킹 방법

1. 동일한 기타 파트를 두 번 연주·녹음
2. 두 테이크를 각각 L100% / R100% 패닝
3. EQ: 각 테이크의 공명 주파수 약간 다르게 처리

### 단 하나의 테이크로 스테레오 효과

1. 모노 테이크에 짧은 딜레이(10~20ms) 적용
2. Wet 신호를 R 채널에 배치
3. Dry 신호는 L 채널 유지
- Haas 효과로 스테레오감 생성

---

## 기타 & 보컬 주파수 관계

이펙트를 추가하기 전에 원음의 문제를 먼저 해결하는 것이 올바른 순서입니다.

### 보컬과 기타 충돌 주파수

- **어쿠스틱 기타**: 200~800Hz (바디감) vs 보컬 중역
- **일렉기타**: 2~4kHz (존재감) vs 보컬 명료도

### 해결책

1. 보컬이 있는 구간에서 기타 중역 -2~-3dB EQ 컷
2. FabFilter Pro-Q3 Collision Detection 활용
3. 기타 패닝으로 보컬 중심 공간 확보
   (리듬 기타 L/R, 솔로 기타 중앙)

---

## 기타 리버브 & 딜레이

귀가 피로해지기 전에 중요한 판단을 먼저 내리는 것이 좋습니다.

### 일렉기타 리버브

- 록: Short Room (Decay 0.5~1초)
- 클린 팝: Plate (Decay 1~1.5초)
- 슈게이징·앰비언트: Hall (Decay 3초+)

### 어쿠스틱 기타 리버브

- 팝·발라드: Short Plate (Decay 1~1.5초)
- 어쿠스틱 재즈: Small Room (Decay 0.5초)
- Mix: 10~20% (기타 공간감 최소화)

### 딜레이 (리듬 기타)

- 점8분음표 딜레이로 리듬감 강화
- Feedback 15~25% (은은한 에코)

---

## 마치며

기타 믹싱은 장르와 연주 스타일에 따라 접근이 달라지며, 보컬과의 주파수 관계 관리가 핵심입니다.

---

[드럼 믹싱 완전 가이드](/stories/drum-mixing1) | [베이스 믹싱 완전 가이드](/stories/bass-mixing1) | [보컬 믹싱 완전 가이드](/stories/vocal-mixing1) | [FabFilter Pro-Q3 완전 가이드](/stories/fabfilter1) | [온라인 믹싱 의뢰 방법](/stories/onlinemix1) | [피아노 리듬감·리듬 훈련 음악연습실](/stories/practice-room-piano-rhythm1) | [기타 트레몰로·웜바 암 테크닉 음악연습실](/stories/practice-room-guitar-whammy1) | [보컬 다이나믹스·크레셴도 데크레셴도 음악연습실](/stories/practice-room-vocal-dynamics1) | [기타 줄 교체·스트링 선택 음악연습실](/stories/practice-room-guitar-string1) | [드럼 브러쉬·와이어 브러쉬 연주 음악연습실](/stories/practice-room-drum-brush1) | [피아노 즉흥 반주·코드 반주 음악연습실](/stories/practice-room-piano-sight-play1) | [베이스 코드·화음 연주 음악연습실](/stories/practice-room-bass-chord1) | [보컬 팔세토·가성 발성 음악연습실](/stories/practice-room-vocal-falsetto1) | [기타 탭핑·투핸드 태핑 음악연습실](/stories/practice-room-guitar-tapping1) | [피아노 듀엣·앙상블 개인 연습 음악연습실](/stories/practice-room-piano-duet1) | [드럼 폴리리듬·복잡박자 연습 음악연습실](/stories/practice-room-drum-polyrhythm1) | [보컬 어질리티·빠른 음계 훈련 음악연습실](/stories/practice-room-vocal-agility1) | [재즈 피아노 즉흥 솔로·임프로비제이션 음악연습실](/stories/practice-room-piano-jazz-improv1) | [기타 레가토·해머온 풀오프 연습 음악연습실](/stories/practice-room-guitar-legato1) | [베이스 펑크·R&B 그루브 음악연습실](/stories/practice-room-bass-funk1) | [보컬 프로젝션·소리 울림 훈련 음악연습실](/stories/practice-room-vocal-projection1) | [피아노 옥타브·넓은 음정 도약 연습 음악연습실](/stories/practice-room-piano-technique31) | [기타 슬라이드·슬라이드 기타 연습 음악연습실](/stories/practice-room-guitar-slide1) | [보컬 스타일 개발·장르별 창법 음악연습실](/stories/practice-room-vocal-style1) | [통기타 핑거피킹·핑거스타일 입문 음악연습실](/stories/practice-room-guitar-acoustic-fingerpick1) | [드럼 하이햇·심벌 컨트롤 음악연습실](/stories/practice-room-drum-hihat1) | [피아노 트릴·장식음 기법 음악연습실](/stories/practice-room-piano-trills1) | [연신내 음악연습실 안내](/stories/practice-room-yeonsinnae1) | [스튜디오 놀 이용 요금](/pricing)
