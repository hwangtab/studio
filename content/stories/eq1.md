---
title: "보컬 EQ 완전 가이드 — 주파수별 역할과 보컬 믹싱에서의 EQ 설정법"
date: 2026-04-06
author: "스튜디오 놀"
category: "강좌"
tags: ["보컬 EQ", "EQ 설정", "보컬 믹싱", "이퀄라이저", "주파수 보컬", "믹싱 강좌", "보컬 주파수"]
thumbnail: "/images/hardware2.webp"
summary: "보컬 믹싱에서 EQ(이퀄라이저)를 어떻게 사용하는지 주파수 대역별로 설명합니다. 보컬 머디니스 제거, 존재감 강조, 공기감 추가까지 실전 EQ 설정 가이드입니다."
faq:
  - q: "보컬 EQ에서 가장 먼저 해야 하는 것은 무엇인가요?"
    a: "하이패스 필터(HPF)를 80~100Hz에 설정해 불필요한 저음을 먼저 제거하세요. 보컬에는 필요 없는 초저음이 믹스의 저음역을 혼탁하게 만드는 경우가 많습니다. 그 다음 200~400Hz 머디니스 제거, 2~5kHz 존재감 강조 순으로 진행합니다."
  - q: "보컬이 MR에 묻혀 잘 안 들리면 어떤 주파수를 올려야 하나요?"
    a: "보컬 존재감은 2kHz~5kHz 영역입니다. 이 영역을 1~3dB 부스트하면 MR 위로 보컬이 더 잘 들립니다. 단, 과도하게 올리면 귀에 거슬리는 소리가 되므로 A/B 비교하며 조금씩 조정하세요."
  - q: "보컬이 너무 밝거나 날카롭게 들리면 어떻게 하나요?"
    a: "8~12kHz 고음역을 1~2dB 줄이거나, 5~8kHz의 날카로운 부분을 좁은 Q값으로 찾아서 줄이세요. 치찰음(S, ㅅ, ㅊ 소리)이 문제라면 De-esser 플러그인을 사용하는 것이 더 효과적입니다."
  - q: "남성 보컬과 여성 보컬의 EQ 처리가 다른가요?"
    a: "기본 접근법은 같지만 주파수 위치가 다릅니다. 남성 보컬은 100~200Hz 영역의 두툼함 처리가 중요하고, 여성 보컬은 250~400Hz 머디니스와 6~10kHz 날카로움 처리가 더 자주 필요합니다. 항상 귀로 판단하는 것이 우선입니다."
---
![EQ 하드웨어 — 스튜디오 놀](/images/hardware2.webp)

## 보컬 EQ란 무엇인가

EQ(이퀄라이저)는 소리의 특정 주파수를 올리거나 내려서 보컬 톤을 조정하는 도구입니다. 좋은 EQ 처리는 티가 나지 않아야 합니다. "EQ 처리한 것 같다"는 느낌이 들면 과하게 적용된 것입니다.

---

## 보컬 주파수 대역별 역할

| 주파수 | 역할 | 과하면? |
|--------|------|--------|
| 20~80Hz | 룸 노이즈, 공조 소음 | 불필요한 저음 누적 |
| 80~250Hz | 보컬 몸통감, 따뜻함 | 뭉개지고 탁한 소리 |
| 250~500Hz | 머디니스(탁함) 구간 | 중간이 막힌 답답한 소리 |
| 500Hz~2kHz | 보컬 몸체, 자연스러움 | 코맹맹이 소리 |
| 2~5kHz | 존재감, 명료도 | 귀에 거슬리는 소리 |
| 5~8kHz | 치찰음, 디테일 | 날카롭고 피곤한 소리 |
| 8~16kHz | 공기감, 밝기 | 쉬이 소리, 인공적인 느낌 |

---

## 보컬 EQ 순서

### Step 1: 하이패스 필터 (HPF)

가장 먼저 합니다. 80~100Hz 이하를 잘라냅니다. 보컬에 필요 없는 초저음이 믹스 전체의 저음역을 혼탁하게 만듭니다.

귀가 피로해지기 전에 중요한 판단을 먼저 내리는 것이 좋습니다.

- **HPF 설정**: 80~100Hz, -24dB/oct

### Step 2: 머디니스 제거 (250~500Hz)

보컬이 탁하거나 답답하게 들리는 원인. 2~4dB 정도 줄여보며 귀로 확인합니다.

- **250~400Hz**: -2 ~ -3dB (좁은 Q값으로 문제 지점 찾기)

### Step 3: 존재감 강조 (2~5kHz)

보컬이 MR에 묻힐 때 사용합니다. 2kHz에서 5kHz 사이를 조금씩 올립니다.

- **2~3kHz**: +1 ~ +2dB (넓은 Q값)

### Step 4: 공기감 추가 (10~16kHz)

보컬을 밝고 맑게 만들고 싶을 때. 쉘빙 필터로 10kHz 이상을 부드럽게 올립니다.

- **10kHz 쉘빙**: +1 ~ +2dB

---

## EQ 적용 시 주의사항

**1. 항상 A/B 비교하세요**
EQ 처리 전·후를 번갈아 들으며 더 좋은지 확인합니다. EQ 없는 상태가 더 좋을 수도 있습니다.

**2. 줄이는 것이 올리는 것보다 낫습니다**
문제가 되는 주파수를 찾아 줄이는 것이 먼저입니다. 무작정 올리면 소리가 인공적이 됩니다.

**3. 모니터 볼륨을 낮추고 작업하세요**
큰 볼륨에서는 고음이 과하게 들려 잘못된 판단을 하기 쉽습니다.

**4. 다양한 기기에서 체크하세요**
이어폰, 블루투스 스피커, 차량 오디오 등 다양한 환경에서 들어보며 확인합니다.

---

## 고급 팁: 다이나믹 EQ

특정 순간에만 문제가 되는 주파수(예: 고음에서만 치찰음이 강해지는 경우)는 **다이나믹 EQ**로 처리합니다. 정적 EQ는 항상 적용되지만, 다이나믹 EQ는 설정 기준을 넘을 때만 작동합니다.

---

## 마치며

보컬 EQ는 귀가 가이드입니다. 수치보다 귀로 판단하는 습관을 들이세요. 더 많은 믹싱 기법을 배우고 싶다면 믹싱 강좌 시리즈를 참고하세요.

---

[파라메트릭 EQ 완전 가이드](/stories/parametric-eq1) | [주파수 스펙트럼 완전 가이드](/stories/frequency-spectrum1) | [믹싱 체인 완전 가이드](/stories/mixing-chain1) | [보컬 컴프레서 사용법](/stories/compress1) | [온라인 믹싱 의뢰 방법](/stories/onlinemix1) | [피아노 리듬감·리듬 훈련 음악연습실](/stories/practice-room-piano-rhythm1) | [기타 트레몰로·웜바 암 테크닉 음악연습실](/stories/practice-room-guitar-whammy1) | [보컬 다이나믹스·크레셴도 데크레셴도 음악연습실](/stories/practice-room-vocal-dynamics1) | [기타 줄 교체·스트링 선택 음악연습실](/stories/practice-room-guitar-string1) | [드럼 브러쉬·와이어 브러쉬 연주 음악연습실](/stories/practice-room-drum-brush1) | [피아노 즉흥 반주·코드 반주 음악연습실](/stories/practice-room-piano-sight-play1) | [베이스 코드·화음 연주 음악연습실](/stories/practice-room-bass-chord1) | [보컬 팔세토·가성 발성 음악연습실](/stories/practice-room-vocal-falsetto1) | [기타 탭핑·투핸드 태핑 음악연습실](/stories/practice-room-guitar-tapping1) | [피아노 듀엣·앙상블 개인 연습 음악연습실](/stories/practice-room-piano-duet1) | [드럼 폴리리듬·복잡박자 연습 음악연습실](/stories/practice-room-drum-polyrhythm1) | [보컬 어질리티·빠른 음계 훈련 음악연습실](/stories/practice-room-vocal-agility1) | [재즈 피아노 즉흥 솔로·임프로비제이션 음악연습실](/stories/practice-room-piano-jazz-improv1) | [기타 레가토·해머온 풀오프 연습 음악연습실](/stories/practice-room-guitar-legato1) | [베이스 펑크·R&B 그루브 음악연습실](/stories/practice-room-bass-funk1) | [보컬 프로젝션·소리 울림 훈련 음악연습실](/stories/practice-room-vocal-projection1) | [피아노 옥타브·넓은 음정 도약 연습 음악연습실](/stories/practice-room-piano-technique31) | [기타 슬라이드·슬라이드 기타 연습 음악연습실](/stories/practice-room-guitar-slide1) | [보컬 스타일 개발·장르별 창법 음악연습실](/stories/practice-room-vocal-style1) | [통기타 핑거피킹·핑거스타일 입문 음악연습실](/stories/practice-room-guitar-acoustic-fingerpick1) | [드럼 하이햇·심벌 컨트롤 음악연습실](/stories/practice-room-drum-hihat1) | [피아노 트릴·장식음 기법 음악연습실](/stories/practice-room-piano-trills1) | [기타 코드 진행·화성 이해 음악연습실](/stories/practice-room-guitar-chord-prog1) | [장르별 보컬 특성·크로스오버 보컬 음악연습실](/stories/practice-room-vocal-genre1) | [베이스 썸피킹·핑거스타일 혼합 음악연습실](/stories/practice-room-bass-thumb1) | [피아노 발라드 반주·감성 피아노 음악연습실](/stories/practice-room-piano-ballad21) | [기타 아르페지오·분산 화음 연습 음악연습실](/stories/practice-room-guitar-arpeggio1) | [보컬 녹음 준비·레코딩 보컬 음악연습실](/stories/practice-room-vocal-recording1) | [가스펠·CCM 피아노 반주 음악연습실](/stories/practice-room-piano-gospel1) | [기타 핑거스타일 고급·솔로 기타 편곡 음악연습실](/stories/practice-room-guitar-fingerpick-adv1) | [드럼 킥·베이스 드럼 테크닉 음악연습실](/stories/practice-room-drum-kick1) | [보컬 벨팅·파워 벨팅 음악연습실](/stories/practice-room-vocal-belting1) | [피아노 컴핑·재즈 반주 패턴 음악연습실](/stories/practice-room-piano-comping1) | [기타 피치카토·뮤트 주법 음악연습실](/stories/practice-room-guitar-mute1) | [베이스 핑거링·오른손 테크닉 음악연습실](/stories/practice-room-bass-fingering1) | [보컬 스타카토·단음 발성 훈련 음악연습실](/stories/practice-room-vocal-staccato1) | [드럼 심벌·크래쉬·라이드 테크닉 음악연습실](/stories/practice-room-drum-cymbal1) | [피아노 크로스 핸드·교차 손 훈련 음악연습실](/stories/practice-room-piano-crosshand1) | [기타 스케일 연습·포지션 이동 음악연습실](/stories/practice-room-guitar-scale-pos1) | [보컬 레가토·이어 부르기 훈련 음악연습실](/stories/practice-room-vocal-legato1) | [피아노 연탄·네 손 피아노 음악연습실](/stories/practice-room-piano-four-hands1) | [기타 핑거링·왼손 독립 훈련 음악연습실](/stories/practice-room-guitar-left-hand1) | [보컬 오버톤·배음 발성 훈련 음악연습실](/stories/practice-room-vocal-overtone1) | [드럼 스네어·림샷 테크닉 음악연습실](/stories/practice-room-drum-snare1) | [기타 왼손 비브라토·핑거 비브라토 음악연습실](/stories/practice-room-guitar-finger-vibrato1) | [피아노 루바토·음악적 템포 표현 음악연습실](/stories/practice-room-piano-rubato1) | [베이스 이펙터·페달 보드 활용 음악연습실](/stories/practice-room-bass-effects1) | [보컬 크루닝·저음 보컬 테크닉 음악연습실](/stories/practice-room-vocal-crooning1) | [피아노 소나타·클래식 소나타 형식 연습 음악연습실](/stories/practice-room-piano-sonata1) | [기타 재즈 코드·재즈 보이싱 음악연습실](/stories/practice-room-guitar-jazz-chord1) | [드럼 빠른 템포·스피드 훈련 음악연습실](/stories/practice-room-drum-speed1) | [보컬 중음역 강화·미들 보이스 음악연습실](/stories/practice-room-vocal-middle1) | [피아노 에튀드·기법 연습곡 음악연습실](/stories/practice-room-piano-etude1) | [기타 오픈 튜닝·슬라이드 오픈 튜닝 음악연습실](/stories/practice-room-guitar-open-tuning1) | [보컬 앙상블·코러스 개인 파트 훈련 음악연습실](/stories/practice-room-vocal-ensemble1) | [베이스 픽 주법·픽 베이스 연습 음악연습실](/stories/practice-room-bass-pick1) | [드럼 카운트·리듬 카운팅 훈련 음악연습실](/stories/practice-room-drum-count1) | [피아노 반음계·크로매틱 스케일 음악연습실](/stories/practice-room-piano-chromatic1) | [연신내 음악연습실 안내](/stories/practice-room-yeonsinnae1) | [스튜디오 놀 이용 요금](/pricing)
