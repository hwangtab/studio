---
title: "파라메트릭 EQ 완전 가이드 — Q값·주파수·게인 설정과 보컬·악기 활용법"
date: 2026-04-07
author: "스튜디오 놀"
category: "음반 제작 가이드"
tags: ["파라메트릭 EQ", "EQ Q값", "EQ 주파수", "EQ 게인", "서지컬 EQ", "부스트 컷", "다이나믹 EQ", "FabFilter Pro-Q"]
thumbnail: "/images/recording17.webp"
summary: "파라메트릭 EQ 완전 가이드입니다. Q값·주파수·게인 설정의 관계, 서지컬 EQ vs 음색 EQ, 부스트보다 컷이 먼저인 이유, 다이나믹 EQ 활용법을 정리합니다."
faq:
  - q: "파라메트릭 EQ란 무엇인가요?"
    a: "파라메트릭 EQ는 주파수(Frequency), 게인(Gain), 대역폭(Q/Bandwidth) 3가지 파라미터를 자유롭게 조정할 수 있는 이퀄라이저입니다. 그래픽 EQ보다 정밀한 주파수 처리가 가능해 전문 믹싱의 표준입니다."
  - q: "Q값이란 무엇인가요?"
    a: "Q값은 이퀄라이저가 영향을 미치는 주파수 대역폭입니다. Q가 높을수록(좁은 Q) 특정 주파수에만 정밀하게 작용하고, Q가 낮을수록(넓은 Q) 넓은 대역에 걸쳐 부드럽게 작용합니다. 문제 주파수 제거에는 좁은 Q, 음색 조정에는 넓은 Q를 사용합니다."
  - q: "부스트보다 컷을 먼저 해야 하는 이유는?"
    a: "컷(감소)은 불필요한 주파수 에너지를 제거해 믹스 공간을 확보합니다. 부스트(증가)는 클리핑 위험을 높이고 다른 악기와의 주파수 충돌을 만들 수 있습니다. 먼저 컷으로 문제를 해결한 후, 필요한 부분만 최소한으로 부스트하는 것이 전문 믹싱의 원칙입니다."
  - q: "다이나믹 EQ란 무엇인가요?"
    a: "다이나믹 EQ는 신호 레벨에 따라 EQ 작동량이 자동으로 변하는 이퀄라이저입니다. 특정 주파수가 너무 클 때만 컷이 작동하고, 조용할 때는 작동하지 않습니다. 보컬 시빌런스 처리, 저역 공명 제어에 특히 유용합니다."
---
![파라메트릭 EQ 완전 가이드 — 스튜디오 놀](/images/recording17.webp)

## 파라메트릭 EQ — 정밀한 주파수 조각

파라메트릭 EQ는 믹싱에서 가장 중요한 도구 중 하나입니다. Q·주파수·게인을 이해하면 어떤 소리도 조각할 수 있습니다.

---

## 파라메트릭 EQ 주요 파라미터

| 파라미터 | 설명 | 실용 범위 |
|---------|------|---------|
| Frequency | 처리할 중심 주파수 | 20Hz~20kHz |
| Gain | 부스트(+) 또는 컷(-)량 | ±12~18dB |
| Q (Bandwidth) | 대역폭 (좁을수록 정밀) | 0.1~10+ |
| Filter Type | 밸(Bell)/High Shelf/Low Shelf/HPF/LPF | 목적에 따라 |

---

## Q값에 따른 활용

플러그인을 추가하기 전에 게인 스테이징이 올바른지 먼저 확인합니다.

### 좁은 Q (5~10 이상)

- **서지컬 EQ**: 특정 문제 주파수 정밀 제거
- 공명(Resonance) 제거
- 특정 음에서 발생하는 컬러드 노이즈 제거
- **예**: 1.2kHz에서 Q 8.0으로 -6dB 컷

### 중간 Q (1~4)

- 일반 음색 조정
- 존재감 부스트, 탁함 컷
- **예**: 3kHz Q 2.5로 +2dB 부스트

### 넓은 Q (0.3~1)

- 셸빙(Shelving) 느낌의 넓은 음색 변화
- 저역 두께, 고역 에어 추가
- **예**: 200Hz Q 0.7로 -3dB (저역 정리)

---

## 보컬 파라메트릭 EQ 실전 설정

아래 설정값은 출발점이며, 곡의 장르와 보컬 특성에 따라 조정이 필요합니다.

### 보컬 파라메트릭 EQ 체계

1. HPF (High Pass Filter)
   주파수: 80~120Hz / 기울기: 12~24dB/octave
  - 저역 노이즈·마이크 진동 제거

2. 저역 컷 (문제 제거)
   주파수: 200~400Hz / Q: 1.5~3 / Gain: -2~-4dB
  - 탁함·상자 공명 제거

3. 중역 존재감 부스트
   주파수: 3~5kHz / Q: 1.5~2.5 / Gain: +1~3dB
  - 보컬 명료성·앞으로 나옴

4. 고역 에어 부스트 (선택)
   주파수: 10~16kHz / Q: 0.5~1 / Gain: +1~2dB
  - 보컬 밝음·공기감

5. 서지컬 컷 (필요 시)
   공명 주파수 / Q: 5~8 / Gain: -6~-12dB
  - 마이크 특유의 피크 제거

---

## 다이나믹 EQ 활용

고음역 컷이 전체 믹스에 투명감을 더해주는 경우가 많으므로 저역부터 정리하세요.

### 다이나믹 EQ 적용 예시

**보컬 저역 공명**
- 300~500Hz에 다이나믹 EQ 컷
- 파워 있는 구절에서만 작동
- 조용한 구절에서는 영향 없음

**보컬 시빌런스 제어 (디에서 대용)**
- 6~8kHz에 다이나믹 EQ 컷
- S·T·Ch 발음에서만 작동

**드럼 버스 저역 정리**
- 250~400Hz에 다이나믹 EQ 컷
- 드럼이 강하게 울릴 때만 작동

---

## 추천 파라메트릭 EQ 플러그인

| 플러그인 | 가격 | 특징 |
|---------|------|------|
| FabFilter Pro-Q 3 | 유료 | 업계 표준, 다이나믹 EQ 내장 |
| iZotope Neutron | 유료 | AI 어시스트 EQ |
| SSL Native X-EQ | 유료 | SSL 콘솔 EQ 에뮬레이션 |
| TDR Nova | 무료 | 다이나믹 EQ 포함 무료 플러그인 |
| Voxengo Marvel GEQ | 무료 | 선형 위상 그래픽 EQ |

---

## 마치며

파라메트릭 EQ는 귀로 들으며 조정하는 것이 가장 중요합니다.

---

[보컬 EQ 완전 가이드](/stories/eq1) | [주파수 스펙트럼 완전 가이드](/stories/frequency-spectrum1) | [믹싱 체인 완전 가이드](/stories/mixing-chain1) | [다이나믹 컴프레서 완전 가이드](/stories/dynamics1) | [온라인 믹싱 의뢰 방법](/stories/onlinemix1) | [피아노 리듬감·리듬 훈련 음악연습실](/stories/practice-room-piano-rhythm1) | [기타 트레몰로·웜바 암 테크닉 음악연습실](/stories/practice-room-guitar-whammy1) | [보컬 다이나믹스·크레셴도 데크레셴도 음악연습실](/stories/practice-room-vocal-dynamics1) | [기타 줄 교체·스트링 선택 음악연습실](/stories/practice-room-guitar-string1) | [드럼 브러쉬·와이어 브러쉬 연주 음악연습실](/stories/practice-room-drum-brush1) | [피아노 즉흥 반주·코드 반주 음악연습실](/stories/practice-room-piano-sight-play1) | [베이스 코드·화음 연주 음악연습실](/stories/practice-room-bass-chord1) | [보컬 팔세토·가성 발성 음악연습실](/stories/practice-room-vocal-falsetto1) | [기타 탭핑·투핸드 태핑 음악연습실](/stories/practice-room-guitar-tapping1) | [피아노 듀엣·앙상블 개인 연습 음악연습실](/stories/practice-room-piano-duet1) | [드럼 폴리리듬·복잡박자 연습 음악연습실](/stories/practice-room-drum-polyrhythm1) | [보컬 어질리티·빠른 음계 훈련 음악연습실](/stories/practice-room-vocal-agility1) | [재즈 피아노 즉흥 솔로·임프로비제이션 음악연습실](/stories/practice-room-piano-jazz-improv1) | [기타 레가토·해머온 풀오프 연습 음악연습실](/stories/practice-room-guitar-legato1) | [베이스 펑크·R&B 그루브 음악연습실](/stories/practice-room-bass-funk1) | [보컬 프로젝션·소리 울림 훈련 음악연습실](/stories/practice-room-vocal-projection1) | [피아노 옥타브·넓은 음정 도약 연습 음악연습실](/stories/practice-room-piano-technique31) | [기타 슬라이드·슬라이드 기타 연습 음악연습실](/stories/practice-room-guitar-slide1) | [보컬 스타일 개발·장르별 창법 음악연습실](/stories/practice-room-vocal-style1) | [통기타 핑거피킹·핑거스타일 입문 음악연습실](/stories/practice-room-guitar-acoustic-fingerpick1) | [드럼 하이햇·심벌 컨트롤 음악연습실](/stories/practice-room-drum-hihat1) | [피아노 트릴·장식음 기법 음악연습실](/stories/practice-room-piano-trills1) | [기타 코드 진행·화성 이해 음악연습실](/stories/practice-room-guitar-chord-prog1) | [장르별 보컬 특성·크로스오버 보컬 음악연습실](/stories/practice-room-vocal-genre1) | [베이스 썸피킹·핑거스타일 혼합 음악연습실](/stories/practice-room-bass-thumb1) | [피아노 발라드 반주·감성 피아노 음악연습실](/stories/practice-room-piano-ballad21) | [기타 아르페지오·분산 화음 연습 음악연습실](/stories/practice-room-guitar-arpeggio1) | [보컬 녹음 준비·레코딩 보컬 음악연습실](/stories/practice-room-vocal-recording1) | [가스펠·CCM 피아노 반주 음악연습실](/stories/practice-room-piano-gospel1) | [기타 핑거스타일 고급·솔로 기타 편곡 음악연습실](/stories/practice-room-guitar-fingerpick-adv1) | [드럼 킥·베이스 드럼 테크닉 음악연습실](/stories/practice-room-drum-kick1) | [보컬 벨팅·파워 벨팅 음악연습실](/stories/practice-room-vocal-belting1) | [피아노 컴핑·재즈 반주 패턴 음악연습실](/stories/practice-room-piano-comping1) | [기타 피치카토·뮤트 주법 음악연습실](/stories/practice-room-guitar-mute1) | [베이스 핑거링·오른손 테크닉 음악연습실](/stories/practice-room-bass-fingering1) | [보컬 스타카토·단음 발성 훈련 음악연습실](/stories/practice-room-vocal-staccato1) | [드럼 심벌·크래쉬·라이드 테크닉 음악연습실](/stories/practice-room-drum-cymbal1) | [피아노 크로스 핸드·교차 손 훈련 음악연습실](/stories/practice-room-piano-crosshand1) | [기타 스케일 연습·포지션 이동 음악연습실](/stories/practice-room-guitar-scale-pos1) | [보컬 레가토·이어 부르기 훈련 음악연습실](/stories/practice-room-vocal-legato1) | [피아노 연탄·네 손 피아노 음악연습실](/stories/practice-room-piano-four-hands1) | [기타 핑거링·왼손 독립 훈련 음악연습실](/stories/practice-room-guitar-left-hand1) | [보컬 오버톤·배음 발성 훈련 음악연습실](/stories/practice-room-vocal-overtone1) | [드럼 스네어·림샷 테크닉 음악연습실](/stories/practice-room-drum-snare1) | [기타 왼손 비브라토·핑거 비브라토 음악연습실](/stories/practice-room-guitar-finger-vibrato1) | [피아노 루바토·음악적 템포 표현 음악연습실](/stories/practice-room-piano-rubato1) | [베이스 이펙터·페달 보드 활용 음악연습실](/stories/practice-room-bass-effects1) | [보컬 크루닝·저음 보컬 테크닉 음악연습실](/stories/practice-room-vocal-crooning1) | [피아노 소나타·클래식 소나타 형식 연습 음악연습실](/stories/practice-room-piano-sonata1) | [기타 재즈 코드·재즈 보이싱 음악연습실](/stories/practice-room-guitar-jazz-chord1) | [드럼 빠른 템포·스피드 훈련 음악연습실](/stories/practice-room-drum-speed1) | [보컬 중음역 강화·미들 보이스 음악연습실](/stories/practice-room-vocal-middle1) | [연신내 음악연습실 안내](/stories/practice-room-yeonsinnae1) | [스튜디오 놀 이용 요금](/pricing)
