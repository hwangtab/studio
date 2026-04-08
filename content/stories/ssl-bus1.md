---
title: "SSL G-Bus 컴프레서 완전 가이드 — 믹스 버스 컴프레션의 표준"
date: 2026-04-07
author: "스튜디오 놀"
category: "음반 제작 가이드"
tags: ["SSL G-Bus 컴프레서", "믹스 버스 컴프레서", "SSL 버스 컴프레서", "SSL 4000 G", "버스 컴프레션", "SSL 플러그인", "마스터 버스"]
thumbnail: "/images/room6.webp"
summary: "SSL G-Bus 컴프레서 완전 가이드입니다. SSL G-Bus 파라미터 이해·마스터 버스 설정·드럼 버스 설정·보컬 버스 설정·SSL G-Bus 플러그인 에뮬레이션 비교까지 정리합니다."
faq:
  - q: "SSL G-Bus 컴프레서란 무엇인가요?"
    a: "Solid State Logic SSL 4000 G 콘솔에 내장된 VCA 방식 버스 컴프레서입니다. 마스터 버스와 드럼 버스에 사용해 여러 트랙을 하나로 '접착(Glue)'하는 효과로 유명합니다."
  - q: "SSL G-Bus 컴프레서의 Glue 효과란 무엇인가요?"
    a: "여러 트랙을 하나의 버스에 컴프레션하면 트랜지언트와 레벨이 통일되어 믹스 전체가 하나의 완성된 사운드처럼 들리게 됩니다. 이 효과를 'Glue(접착)'라고 부릅니다."
  - q: "SSL G-Bus 설정에서 Make-up Gain과 Threshold의 관계는?"
    a: "Threshold를 낮추면 더 많은 컴프레션이 발생합니다. GR 미터에서 -2~-4dB 게인 리덕션이 보이는 수준이 일반적인 버스 컴프레션입니다. Make-up Gain으로 컴프레션 후 레벨을 보상합니다."
  - q: "SSL G-Bus 플러그인 에뮬레이션 중 어떤 것이 좋은가요?"
    a: "Waves SSL G-Master Buss Compressor, UAD SSL 4000 G Bus Compressor, Solid State Logic Native Bus Compressor가 대표적입니다. Waves 버전은 가성비 최고이며 네이티브 환경에서 널리 사용됩니다."
---
![SSL G-Bus 컴프레서 완전 가이드 — 스튜디오 놀](/images/room6.webp)

## SSL G-Bus — 믹스 버스의 황금 표준

SSL 4000 G 콘솔의 버스 컴프레서는 수십 년간 히트 레코드의 믹스 버스를 담당한 클래식 VCA 컴프레서입니다.

---

## SSL G-Bus 파라미터 이해

| 파라미터 | 설명 | 주요 설정 |
|---------|------|---------|
| Threshold | 컴프레션 시작 레벨 | -5~-15dB (버스에 따라) |
| Ratio | 압축 비율 | 2:1 (Glue), 4:1 (일반), 10:1 (제한) |
| Attack | 반응 속도 | 1ms (빠름) ~ 30ms (느림) |
| Release | 복구 속도 | Auto (권장), 100~400ms |
| Make-up | 출력 게인 보상 | 컴프레션에 따라 조정 |
| Fade | 마스터 페이드 | 최종 출력 레벨 |

---

## 마스터 버스 설정

이펙트를 추가하기 전에 원음의 문제를 먼저 해결하는 것이 올바른 순서입니다.

### Glue 설정 (마스터 버스 표준)

- Ratio: 2:1
- Attack: 30ms (느림 — 트랜지언트 보존)
- Release: Auto
- Threshold: -10~-15dB (GR -2~-3dB 목표)
- Make-up: GR 양만큼 보상

### 적극적 버스 컴프레션

- Ratio: 4:1
- Attack: 10ms
- Release: 100~200ms
- GR: -4~-6dB

---

## 드럼 버스 설정

각 파라미터가 사운드에 미치는 영향을 이해하면 설정값을 외우지 않아도 귀로 판단할 수 있습니다.

### 드럼 Glue (타격감 + 통일감)

- Ratio: 4:1
- Attack: 3~10ms (빠름 — 스네어 어택 포착)
- Release: Auto
- GR: -4~-8dB
- 결과: 드럼 전체가 하나의 유닛처럼 동작

### 드럼 펌핑 효과 (트랩·EDM)

- Ratio: 10:1
- Attack: 1ms (최대 빠름)
- Release: 100ms (빠름 — 펌핑 리듬 발생)
- GR: -6~-10dB

---

## 보컬 버스 설정

귀가 피로해지기 전에 중요한 판단을 먼저 내리는 것이 좋습니다.

### 보컬 버스 Glue

- Ratio: 2:1
- Attack: 10~20ms (중간)
- Release: Auto
- GR: -2~-4dB
- 복수 보컬 트랙(리드+백킹)을 하나로 통일

---

## SSL G-Bus 플러그인 에뮬레이션 비교

버스로 묶어 처리하면 개별 트랙 조정 없이도 전체 밸런스를 효율적으로 잡을 수 있습니다.

### 주요 G-Bus 플러그인

Waves SSL G-Master Buss Compressor:
- 가장 널리 사용되는 에뮬레이션
- 네이티브 처리, 가성비 최고
- 드럼·마스터 버스 믹싱 작업에 충분

**UAD SSL 4000 G Bus Compressor**
- 하드웨어에 가장 충실한 모델링
- UA Apollo 필요
- 고급 스튜디오 마스터 버스 표준

Solid State Logic Native Bus Compressor:
- SSL 공식 플러그인
- 하드웨어 회사가 직접 제작한 정확한 에뮬레이션

**Cytomic The Glue**
- 독립 개발사의 높은 평가 에뮬레이션
- 다양한 타입 선택 가능

---

## 마치며

SSL G-Bus 컴프레서는 믹스 버스 컴프레션의 황금 표준으로, Glue 효과로 믹스 전체에 통일감을 부여합니다.

---

[보컬 리버브 완전 가이드](/stories/vocal-reverb1) | [1176 컴프레서 완전 가이드](/stories/comp1176) | [LA-2A 컴프레서 완전 가이드](/stories/la2a1) | [믹스 버스 완전 가이드](/stories/mix-bus1) | [온라인 믹싱 의뢰 방법](/stories/onlinemix1) | [피아노 리듬감·리듬 훈련 음악연습실](/stories/practice-room-piano-rhythm1) | [기타 트레몰로·웜바 암 테크닉 음악연습실](/stories/practice-room-guitar-whammy1) | [보컬 다이나믹스·크레셴도 데크레셴도 음악연습실](/stories/practice-room-vocal-dynamics1) | [기타 줄 교체·스트링 선택 음악연습실](/stories/practice-room-guitar-string1) | [드럼 브러쉬·와이어 브러쉬 연주 음악연습실](/stories/practice-room-drum-brush1) | [피아노 즉흥 반주·코드 반주 음악연습실](/stories/practice-room-piano-sight-play1) | [베이스 코드·화음 연주 음악연습실](/stories/practice-room-bass-chord1) | [보컬 팔세토·가성 발성 음악연습실](/stories/practice-room-vocal-falsetto1) | [기타 탭핑·투핸드 태핑 음악연습실](/stories/practice-room-guitar-tapping1) | [피아노 듀엣·앙상블 개인 연습 음악연습실](/stories/practice-room-piano-duet1) | [드럼 폴리리듬·복잡박자 연습 음악연습실](/stories/practice-room-drum-polyrhythm1) | [보컬 어질리티·빠른 음계 훈련 음악연습실](/stories/practice-room-vocal-agility1) | [재즈 피아노 즉흥 솔로·임프로비제이션 음악연습실](/stories/practice-room-piano-jazz-improv1) | [기타 레가토·해머온 풀오프 연습 음악연습실](/stories/practice-room-guitar-legato1) | [베이스 펑크·R&B 그루브 음악연습실](/stories/practice-room-bass-funk1) | [보컬 프로젝션·소리 울림 훈련 음악연습실](/stories/practice-room-vocal-projection1) | [피아노 옥타브·넓은 음정 도약 연습 음악연습실](/stories/practice-room-piano-technique31) | [기타 슬라이드·슬라이드 기타 연습 음악연습실](/stories/practice-room-guitar-slide1) | [보컬 스타일 개발·장르별 창법 음악연습실](/stories/practice-room-vocal-style1) | [통기타 핑거피킹·핑거스타일 입문 음악연습실](/stories/practice-room-guitar-acoustic-fingerpick1) | [드럼 하이햇·심벌 컨트롤 음악연습실](/stories/practice-room-drum-hihat1) | [피아노 트릴·장식음 기법 음악연습실](/stories/practice-room-piano-trills1) | [기타 코드 진행·화성 이해 음악연습실](/stories/practice-room-guitar-chord-prog1) | [장르별 보컬 특성·크로스오버 보컬 음악연습실](/stories/practice-room-vocal-genre1) | [연신내 음악연습실 안내](/stories/practice-room-yeonsinnae1) | [스튜디오 놀 이용 요금](/pricing)
