---
title: SSL G-Bus 컴프레서 완전 가이드 — 믹스 버스 컴프레션의 표준
date: 2026-04-07
author: 스튜디오 놀
category: 믹싱·마스터링
tags:
  - SSL G-Bus 컴프레서
  - 믹스 버스 컴프레서
  - SSL 버스 컴프레서
  - SSL 4000 G
  - 버스 컴프레션
  - SSL 플러그인
  - 마스터 버스
thumbnail: /images/room6.webp
summary: >-
  SSL G-Bus 컴프레서 완전 가이드입니다. SSL G-Bus 파라미터 이해·마스터 버스 설정·드럼 버스 설정·보컬 버스 설정·SSL G-Bus 플러그인 에뮬레이션 비교까지 정리합니다. 스튜디오 놀 엔지니어의 실무 경험을 바탕으로 홈레코딩 환경에서 바로 적용할 수 있도록 정리했습니다.
faq:
  - q: SSL G-Bus 컴프레서란 무엇인가요?
    a: >-
      Solid State Logic SSL 4000 G 콘솔에 내장된 VCA 방식 버스 컴프레서입니다. 마스터 버스와 드럼 버스에 사용해
      여러 트랙을 하나로 '접착(Glue)'하는 효과로 유명합니다.
  - q: SSL G-Bus 컴프레서의 Glue 효과란 무엇인가요?
    a: >-
      여러 트랙을 하나의 버스에 컴프레션하면 트랜지언트와 레벨이 통일되어 믹스 전체가 하나의 완성된 사운드처럼 들리게 됩니다. 이 효과를
      'Glue(접착)'라고 부릅니다.
  - q: SSL G-Bus 설정에서 Make-up Gain과 Threshold의 관계는?
    a: >-
      Threshold를 낮추면 더 많은 컴프레션이 발생합니다. GR 미터에서 -2~-4dB 게인 리덕션이 보이는 수준이 일반적인 버스
      컴프레션입니다. Make-up Gain으로 컴프레션 후 레벨을 보상합니다.
  - q: SSL G-Bus 플러그인 에뮬레이션 중 어떤 것이 좋은가요?
    a: >-
      Waves SSL G-Master Buss Compressor, UAD SSL 4000 G Bus Compressor, Solid
      State Logic Native Bus Compressor가 대표적입니다. Waves 버전은 가성비 최고이며 네이티브 환경에서 널리
      사용됩니다.
---
![SSL G-Bus 컴프레서 완전 가이드 — 스튜디오 놀](/images/room6.webp)

## SSL G-Bus — 믹스 버스의 황금 표준

SSL 4000 G 콘솔의 버스 컴프레서는 수십 년간 히트 레코드의 믹스 버스를 담당한 클래식 VCA 컴프레서입니다.

SSL(Solid State Logic)은 1969년 영국 Oxford에서 Colin Sanders가 창립했습니다. 1976년 SSL 4000 B 콘솔 출시 후 1978년 E 시리즈, 1987년 G 시리즈로 발전했고, G 시리즈에 처음으로 마스터 버스 컴프레서가 독립 모듈로 내장됐습니다. SSL 4000 G의 버스 컴프레서는 VCA(Voltage Controlled Amplifier) 방식으로 빠른 어택과 투명한 음색을 구현했고, 이것이 'Glue 컴프레션'의 개념을 정의했습니다. 1980~90년대 Phil Collins('In the Air Tonight' 리마스터), Def Leppard('Hysteria'), Michael Jackson('Bad') 제작에 SSL 콘솔이 사용됐고, 이 시기 영국 차트 1위 곡의 약 70%가 SSL 콘솔을 거쳤다는 추산이 있습니다. 국내에서는 1990년대 후반 대형 방송사(MBC·KBS) 스튜디오와 SM엔터테인먼트 녹음실에 SSL 4000·6000 시리즈가 도입됐고, K-POP 사운드의 '가공된 선명함'에 기여했습니다. 2001년 Waves가 SSL G-Master Buss Compressor 플러그인을 출시하면서 이 사운드가 홈 스튜디오에 보급됐고, 2010년대 이후 대부분의 믹싱 DAW 세션에서 SSL G 플러그인이 마스터 버스 기본 삽입 옵션이 됐습니다.

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

### 보컬 버스 Glue

- Ratio: 2:1
- Attack: 10~20ms (중간)
- Release: Auto
- GR: -2~-4dB
- 복수 보컬 트랙(리드+백킹)을 하나로 통일

---

## SSL G-Bus 플러그인 에뮬레이션 비교

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

SSL G-Bus의 Attack 30ms 설정이 마스터 버스에서 권장되는 이유는 트랜지언트 보존입니다. Attack이 빠르면(1~3ms) 킥·스네어의 초기 어택 타격감이 압축돼 드럼이 뒤로 물러나고 믹스의 생동감이 사라집니다. 30ms Attack은 킥·스네어의 첫 번째 어택 파형을 컴프레서가 반응하기 전에 통과시켜 타격감을 유지하면서, 이후 서스테인 구간을 가볍게 잡아 전체 레벨을 안정화합니다. Release Auto 설정은 곡의 BPM에 맞게 리커버리 속도를 자동 조정해 펌핑 없는 자연스러운 Glue를 만듭니다.

드럼 버스에서 GR -6~-8dB의 공격적 컴프레션은 개별 드럼 트랙 처리가 충분히 된 이후에만 적용합니다. 개별 킥·스네어·하이햇이 각자의 공간을 확보한 상태에서 드럼 버스 컴프레서를 걸면 트랙들이 하나의 유기적 드럼 세트처럼 결합됩니다. 반대로 개별 트랙 밸런스가 잡히지 않은 상태에서 드럼 버스 컴프레서만 세게 걸면 특정 타악기가 과도하게 압축되거나 전체 레벨이 잡히지 않는 문제가 발생합니다.

SSL G-Bus 플러그인 선택에서 Waves 버전과 UAD 버전의 실제 차이는 매우 미세합니다. 전문 리스닝 테스트에서 두 버전을 A/B 비교하면 UAD가 약간 더 따뜻하고 미드가 풍부하게 느껴진다는 평가가 있지만, 최종 음원에서 청취자가 구별하기는 사실상 불가능합니다. UAD 하드웨어 없이 홈 스튜디오 환경이라면 Waves SSL G 또는 Cytomic The Glue로 충분히 전문적인 마스터 버스 컴프레션이 가능합니다.

[보컬 리버브 완전 가이드](/stories/vocal-reverb1) | [1176 컴프레서 완전 가이드](/stories/comp1176) | [LA-2A 컴프레서 완전 가이드](/stories/la2a1) | [믹스 버스 완전 가이드](/stories/mix-bus1) | [온라인 믹싱 의뢰 방법](/stories/onlinemix1)
