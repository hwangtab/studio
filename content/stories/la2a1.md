---
title: LA-2A·LA2A 컴프레서 완전 가이드 — Optical 컴프레서 원리와 보컬 믹싱 세팅
date: 2026-04-07
lastmod: 2026-07-19
author: 스튜디오 놀
category: 믹싱·마스터링
tags:
  - LA-2A 컴프레서
  - Optical 컴프레서
  - LA-2A 보컬
  - LA-2A 설정
  - 유니버설오디오 LA-2A
  - LA-2A 플러그인
  - 클래식 컴프레서
thumbnail: /images/recording4.webp
summary: >-
  LA-2A Optical 컴프레서 동작 원리·사용법과 플러그인 비교. Studio NOL 보컬 믹싱 세팅 기준.
faq:
  - q: LA-2A 컴프레서란 무엇인가요?
    a: >-
      Teletronix(現 Universal Audio)가 개발한 Optical(광학) 방식 컴프레서입니다. 광전지(T4B)를 이용한
      느리고 자연스러운 컴프레션으로 보컬·베이스·어쿠스틱 기타에 따뜻한 색감을 부여하는 클래식 스튜디오 장비입니다.
  - q: LA-2A의 Peak Reduction과 Gain은 무슨 역할인가요?
    a: >-
      Peak Reduction은 컴프레션 양을 결정하는 Threshold+Ratio 역할을 합니다. Gain은 출력 레벨(Makeup
      Gain)입니다. LA-2A는 Attack/Release 조절이 없어 광전지가 자동으로 시간 상수를 결정합니다.
  - q: LA-2A와 1176의 차이는 무엇인가요?
    a: >-
      1176은 FET 방식으로 빠른 반응(1ms 이하)과 공격적인 컬러가 특징입니다. LA-2A는 Optical 방식으로 느리고
      자연스러운 컴프레션과 따뜻한 음색이 특징입니다. 보컬 체인에서 1176 후단에 LA-2A를 사용하는 Dueling
      Compressors 방식이 널리 쓰입니다.
  - q: LA-2A 플러그인 에뮬레이션 중 어떤 것이 좋은가요?
    a: >-
      Universal Audio UAD LA-2A Classic Audio Leveler, Waves CLA-2A, UAD Manley
      Variable Mu가 대표적입니다. UAD 버전이 하드웨어에 가장 가깝지만 UA Apollo가 필요합니다. Waves CLA-2A는
      가성비가 뛰어나 네이티브 환경에서 널리 사용됩니다.
---
![LA-2A 컴프레서 완전 가이드 — 스튜디오 놀](/images/recording4.webp)

## LA-2A — 따뜻한 음색의 클래식 Optical 컴프레서

Teletronix LA-2A는 1960년대 출시 이후 수십 년간 보컬과 베이스에 독보적인 따뜻함을 부여하는 클래식 컴프레서입니다.

LA-2A의 탄생은 1965년 엔지니어 James F. Lawrence Jr.가 캘리포니아의 소규모 회사 Teletronix에서 개발한 Level-Loc 기반 Electro-Optical 컴프레서로 거슬러 올라갑니다. 광전지(T4B 셀 — 발광 다이오드와 광저항기 조합)를 이용해 신호 레벨에 따라 빛의 밝기가 변하고, 그 빛이 저항값을 바꿔 컴프레션 양을 제어하는 방식은 트랜지스터 기반 컴프레서와 근본적으로 다른 '물리적 지연'을 만들어냈고, 이것이 바로 LA-2A 특유의 느리고 자연스러운 컴프레션의 핵심입니다. 1969년 Teletronix는 Bill Putnam Sr.가 설립한 UREI(United Recording Electronics Industries)에 인수됐습니다. Bill Putnam은 Capitol Records, Western Recorders 등 LA 레코딩 스튜디오의 황금기를 이끈 인물로, Sam Cooke의 "You Send Me"(1957)와 Frank Sinatra 보컬 세션에 LA-2A를 사용한 것으로 알려져 있습니다. 이후 UREI는 Harman International을 거쳐 현재는 Universal Audio가 하드웨어 생산권을 보유하고 있습니다. 1990년대 이후 아날로그 하드웨어가 디지털로 전환되는 시기에도 LA-2A의 광학적 컴프레션 특성은 대체재가 없어 스튜디오에서 계속 사용됐고, 2000년대 Universal Audio UAD 플러그인 에뮬레이션이 출시되면서 홈 스튜디오와 소규모 믹싱 환경에도 LA-2A의 소리가 보급됐습니다. Bonnie Raitt, Led Zeppelin의 존 폴 존스 베이스, K-POP 발라드 보컬 믹싱에 이르기까지 장르와 시대를 초월해 사용되는 범용성이 LA-2A를 단종 없이 현재까지 생산되는 클래식으로 만든 핵심 이유입니다.

## LA-2A 파라미터 이해

| 파라미터 | 설명 | 주의사항 |
|---------|------|---------|
| Peak Reduction | 컴프레션 양 (Threshold+Ratio 통합) | 높을수록 더 강한 컴프레션 |
| Gain | 출력 레벨 (Makeup Gain) | Peak Reduction 증가에 따라 조정 |
| Limit / Compress | 동작 모드 선택 | Limit: 강한 제한, Compress: 자연스러운 컴프레션 |
| VU | 게인 리덕션 또는 출력 확인 | GR 모드로 컴프레션 양 모니터링 |

---

%%service:recording%%

## LA-2A 특성 — 자동 시간 상수

### Optical 컴프레서의 특징

- Attack: 약 10ms (빠름, 자동 조절)
- Release: 40~60ms (초기) + 수초 (지연)
  - 이중 시간 상수(Dual Release)로 자연스러운 컴프레션
- Ratio: 3:1~6:1 (Compress), 최대 40:1+ (Limit 모드)

### 왜 보컬에 자연스러운가?

광전지(Electroluminescent Panel + Photoresistor)가
실제 빛의 밝기로 반응 → 아날로그 특유의 비선형 감쇠

---

## 기본 보컬 설정

### 팝·발라드 보컬 (따뜻한 컴프레션)

- Mode: Compress
- Peak Reduction: 중간 (GR -3~-6dB 목표)
- Gain: Peak Reduction에 맞게 보상

### R&B / 소울 보컬 (두꺼운 사운드)

- Mode: Compress
- Peak Reduction: 높게 (GR -6~-10dB)
- Gain: 충분히 보상

### 리미팅 (클리핑 방지)

- Mode: Limit
- Peak Reduction: 적당히 (GR -2~-4dB)
- 보컬 피크만 잡아주는 역할

---

## 베이스·어쿠스틱 기타 설정

### 베이스 기타

- Mode: Compress
- Peak Reduction: 중간~높게
- GR: -4~-8dB
- 부드러운 어택으로 베이스 펀치감 유지

### 어쿠스틱 기타

- Mode: Compress
- Peak Reduction: 낮게~중간
- GR: -2~-4dB
- 자연스러운 어택 보존, 바디감 강화

---

## 1176 + LA-2A 체인 (Dueling Compressors)

### 보컬 컴프레서 체인

1. 1176 (FET — 빠른 반응, 트랜지언트 제어)
   Mode: Compress
   Ratio: 4:1 또는 8:1
   Attack: 5~7 (빠름)
   GR: -3~-6dB

2. LA-2A (Optical — 느린 스무싱, 레벨 평탄화)
   Mode: Compress
   Peak Reduction: 중간
   GR: -2~-4dB

### 결합 효과

- 1176: 빠른 다이나믹 피크 제어
- LA-2A: 전체 레벨 부드럽게 안정화
- 두 캐릭터 결합으로 생동감 있는 보컬 컴프레션

---

## LA-2A 플러그인 에뮬레이션 비교

### 주요 LA-2A 플러그인

**Universal Audio UAD LA-2A**
- 가장 하드웨어에 충실한 모델링
- Silver (LA-2A Classic) / Gray (LA-2) 버전 제공
- UA Apollo 또는 UAD DSP 카드 필요

**Waves CLA-2A**
- 가성비 최고, 네이티브 처리
- 보컬·베이스 믹싱 작업에 충분
- 하드웨어 대비 99% 재현

**Native Instruments VC 2A**
- Guitar Rig 내 포함, 가성비 우수
- 직관적인 인터페이스

**IK Multimedia T-RackS White 2A**
- LA-2A 클래식 에뮬레이션
- 다양한 빈티지 컴프레서 번들 제공

---

## Studio NOL에서 LA-2A를 사용하는 방식 — 보컬 세션 케이스 3가지

스튜디오 놀 보컬 믹싱에서 LA-2A를 적용하는 실제 케이스입니다.

**케이스 1: 발라드 보컬 — 1176 후단 배치**

팝 발라드 세션에서 1176 FET를 GR -3~-4dB로 앞에 세팅하고, LA-2A Optical을 뒤에 배치해 GR -2~-3dB로 가볍게 처리합니다. 두 컴프레서의 합산 GR이 -5~-7dB 범위에서 보컬의 다이나믹을 살리면서 레벨을 안정시킵니다. 1176만 단독으로 GR -7dB를 걸었을 때 나타나는 '눌린 느낌' 없이 같은 레벨 안정 효과를 얻을 수 있습니다.

**케이스 2: R&B 보컬 — LA-2A 단독 Limit 모드**

두껍고 강한 R&B·소울 보컬에서는 LA-2A를 Limit 모드로 단독 사용합니다. Peak Reduction을 높게 세팅해 GR -6~-10dB까지 걸고, Gain으로 충분히 보상합니다. Limit 모드의 40:1+ 비율이 강한 발성의 피크를 억누르면서 Optical 방식 특유의 따뜻한 음색이 더해져 R&B 보컬 특유의 밀도감이 만들어집니다.

**케이스 3: 어쿠스틱 기타 — Compress 모드 낮은 GR**

보컬 세션 후 어쿠스틱 기타를 추가 녹음할 때 LA-2A Compress 모드 GR -2~-3dB로 가볍게 처리합니다. 어택을 완전히 잡지 않고 일부 통과시켜 기타 피킹의 초반 어택감을 살리면서 서스테인 레벨을 균일하게 만듭니다. 보컬과 기타가 같은 믹스에 있을 때 음색적 일관성도 생깁니다.

---

## 마치며

LA-2A는 수십 년간 보컬 녹음의 표준으로 자리 잡은 클래식 Optical 컴프레서입니다.

Peak Reduction 노브를 돌릴 때 VU 미터를 GR(게인 리덕션) 모드로 전환해 바늘 움직임을 보면서 작업하는 것이 기본입니다. 보컬 컴프레션의 출발점은 GR -3~-6dB 범위로, 바늘이 이 구간을 오가도록 Peak Reduction을 세팅하면 보컬의 다이나믹이 살아있으면서도 레벨이 안정됩니다. GR이 -10dB 이상으로 깊게 들어가면 보컬의 감정 표현이 지나치게 눌려 평평한 소리가 되므로, 발라드·팝에서는 -6dB 이상 넘지 않도록 주의합니다.

LA-2A의 Dual Release(이중 시간 상수)는 이 컴프레서의 핵심 특성입니다. 빠른 릴리즈 회로(약 40~60ms)가 순간적인 다이나믹 피크를 처리한 직후, 느린 릴리즈 회로(수백ms~수초)가 전체 레벨을 서서히 원상 복구합니다. 이 이중 반응 덕분에 Attack/Release를 수동으로 조정하지 않아도 보컬의 자연스러운 뉘앙스가 유지되면서 전체 레벨이 균일하게 정리됩니다. 광전지 소자의 물리적 특성에서 비롯된 이 동작은 트랜지스터(FET) 방식의 1176이 재현할 수 없는 영역입니다.

1176과 LA-2A를 직렬로 연결하는 Dueling Compressors 체인은 각 컴프레서의 특성을 보완적으로 활용하는 방식입니다. 1176(FET)을 앞에 배치해 1ms 이하의 빠른 반응으로 보컬의 폭발적인 피크를 잡고, 뒤에 배치한 LA-2A(Optical)가 남은 레벨 변화를 느리게 매끄럽게 안정화합니다. 1176만 단독 사용하면 컴프레서 특유의 '펌핑'이 느껴지고, LA-2A만 사용하면 빠른 피크 처리가 부족해 클리핑이 발생할 수 있습니다. 두 컴프레서를 조합하면 각각 GR -3~-4dB 정도의 가벼운 설정으로도 합산 -6~-8dB의 자연스러운 컴프레션이 가능하며, 이것이 수십 년간 업계 표준 보컬 체인으로 자리 잡은 이유입니다.

## LA-2A를 다룰 때 제가 지키는 감각

LA-2A를 두고 상담할 때 저는 스펙 시트보다 '왜 이 소리가 유독 편안하게 들리는가'부터 이야기합니다. 노브가 두 개뿐인 이 단순함이 오히려 초보자를 헤매게 하는데, 제가 실제로 손을 얹을 때 붙잡는 기준은 세 가지입니다.

**노브가 아니라 바늘을 믿는다**

Peak Reduction 숫자는 참고용일 뿐입니다. 저는 VU 미터를 GR 모드로 두고 바늘이 어디까지 움직이는지를 봐요. 같은 노브 위치라도 들어오는 신호 레벨에 따라 걸리는 양이 완전히 달라지기 때문에, 결국 믿을 건 눈에 보이는 게인 리덕션 값입니다.

**깊게 걸수록 좋은 게 아니다**

Optical 특유의 따뜻함에 취해 자꾸 더 걸고 싶어지지만, GR이 깊어질수록 보컬의 감정 곡선이 눌려 평평해집니다. 발라드나 팝에서는 살짝 스치듯 걸어 레벨만 정돈하는 쪽이 곡의 숨결을 살리는 데 훨씬 유리해요.

**LA-2A는 마무리, 시작이 아니다**

빠르고 날카로운 피크는 LA-2A가 잘 못 잡습니다. 그래서 저는 급한 트랜지언트를 앞 단에서 먼저 정리한 뒤, 마지막에 전체 레벨을 부드럽게 눕히는 스무딩 용도로 LA-2A를 씁니다. 이 순서만 지켜도 보컬이 훨씬 정돈되게 들립니다. 이런 보컬 체인을 직접 맡겨보고 싶다면 [녹음·믹싱](/pricing) 안내를 참고하세요.

---

[SSL G-Bus 컴프레서 완전 가이드](/stories/ssl-bus1) | [1176 컴프레서 완전 가이드](/stories/comp1176) | [컴프레서 완전 가이드](/stories/compressor1) | [패러럴 컴프레션 완전 가이드](/stories/parallel-compression1) | [보컬 믹싱 플러그인 완전 가이드](/stories/plugins1)
