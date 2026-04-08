---
title: "믹싱 강좌 - 제8부: 플러그인을 위한 밥상 차리기 (Gain Staging)"
date: 2025-11-19
author: "스튜디오 놀"
category: "강좌"
tags: ["믹싱", "강좌", "게인스테이징", "GainStaging", "Headroom"]
summary: "믹싱에서 가장 중요한 기초, 게인 스테이징. 각 플러그인 입력 레벨을 올바르게 설정해 클리핑과 노이즈 없이 최적의 처리 환경을 만드는 방법입니다."
thumbnail: "/images/recording3.webp"
faq:
  - q: "게인 스테이징(Gain Staging)이란 무엇인가요?"
    a: "각 플러그인 체인에서 신호 레벨을 최적의 범위(-18dBFS 내외)로 유지하는 작업입니다. 신호가 너무 낮으면 노이즈가 증가하고, 너무 높으면 플러그인이 왜곡됩니다."
  - q: "게인 스테이징을 하지 않으면 어떤 문제가 생기나요?"
    a: "플러그인 입력 레벨이 너무 높으면 내부 클리핑이 발생하고, 너무 낮으면 플러그인의 성능이 제대로 발휘되지 않습니다. 결과적으로 믹스가 탁하거나 뻣뻣하게 들릴 수 있습니다."
---
![아날로그 VU 미터기](/images/hardware5.webp)

"플러그인을 걸었는데 소리가 이상하게 찌그러져요."
"컴프레서가 작동을 안 해요." (으응? 왜 이러지?)

여러분의 플러그인이 고장 난 게 아닙니다.
여러분이 플러그인에게 **'너무 많은 밥(입력 신호)'**을 억지로 먹이고 있기 때문입니다. (컥-! 배불러요!)

## 1. 게인 스테이징(Gain Staging)이란?

쉽게 말해 **"다음 단계로 넘어갈 때 적절한 볼륨을 맞춰주는 것"**입니다.
오디오 신호는 여러 단계를 거칩니다. (차례차례-!)
`마이크 프라임프` -> `EQ` -> `컴프레서` -> `마스터 버스`

각 단계마다 소리가 너무 커지거나 작아지지 않도록 '문지기 역할'을 하는 것이 게인 스테이징입니다.

## 2. -18dBFS의 비밀 (왜 중요할까?)

디지털에서는 0dBFS가 천장이라고 했죠? (머리 조심!)
그런데 왜 수많은 프로 엔지니어들은 **-18dBFS**를 강조할까요?

그 이유는 우리가 사랑하는 **'아날로그 모델링 플러그인'** 때문입니다.
전설적인 컴프레서(LA-2A, 1176)나 EQ(Pultec)를 복각한 플러그인들은 옛날 아날로그 장비의 특성을 그대로 닮았습니다.
아날로그 장비들의 기준 레벨(0VU)은 디지털로 환산하면 대략 **-18dBFS**입니다.

*   **-18dBFS 들어올 때**: 플러그인이 가장 예쁘고, 따뜻하고, 음악적인 소리를 냅니다. (이걸 **Sweet Spot**이라고 합니다. 캬-!)
*   **0dBFS 가까이 들어올 때**: 플러그인이 과부하가 걸려서 듣기 싫게 찌그러지거나, 컴프레서가 너무 과하게 반응합니다. (버럭-!)

## 3. 실전 게인 스테이징 방법

믹싱을 시작하기 전(또는 녹음할 때), 모든 트랙의 레벨을 점검하세요. (꼼꼼하게!)

1.  **미터기 확인**: 트랙의 평균 레벨(RMS)이 대략 -18dBFS 근처에서 노는지 봅니다. (피크는 -10dB ~ -6dB 정도 튀어도 괜찮습니다.)
2.  **Clip Gain 조절**: 페이더를 건드리지 말고! 오디오 파형 자체의 크기(**Clip Gain** 또는 **Input Gain**)를 조절하세요. (슥슥- 줄이거나 키우세요.)
    *   너무 큰 파형은 줄여주고, 너무 작은 파형은 키워줍니다.
3.  **플러그인 입출력 조절**: 플러그인을 걸고 나서 소리가 확 커졌다면? 플러그인의 **Output Gain**을 줄여서, 걸기 전(Bypass)과 볼륨이 똑같게 맞춰주세요.

**"Volume in = Volume out"**
이것만 지켜도 여러분의 믹스는 훨씬 깨끗하고 여유로워집니다.

## 4. 작은 소리의 미학

"소리가 작으면 힘이 없지 않나요?"
아닙니다. 믹싱 단계에서는 작고 깨끗하게 유지해야 합니다.
소리를 키우는 건 맨 마지막 단계인 **마스터링**에서 리미터로 하는 겁니다. (쿠쾅-!)

믹싱 도중에 소리를 꽉꽉 채워 넣으면, 나중에 마스터링 엔지니어는 할 수 있는 게 아무것도 없습니다. (울상-)
**여유 공간(Headroom)**을 남겨두세요. 그 빈 공간이 나중에 '펀치감'과 '압압'이 들어갈 자리입니다.

플러그인에게 맛있는 밥(-18dBFS)을 주세요.
그러면 플러그인은 최고의 소리로 보답할 겁니다. (냠냠-!)

---

### [초보자의 흔한 실수] 🍱
*   **"페이더로 밸런스 잡기"**: 파형 자체가 너무 큰데 페이더만 끝까지 내리고 믹싱합니다. 페이더의 해상도를 다 버리는 짓입니다. 0점 근처에서 놀 수 있게 클립 게인부터 잡으세요.
*   **"플러그인 걸고 소리 커지면 좋아진 줄 안다"**: 사람의 귀는 소리가 커지면 무조건 좋게 들립니다. "우와, 플러그인 걸었더니 소리가 빵빵해!" 아뇨, 그냥 커진 겁니다. 바이패스(Bypass)를 눌러서 볼륨이 같을 때도 소리가 좋아졌는지 냉정하게 판단하세요.
*   **"마이너스 게인 스테이징"**: 반대로 너무 작게 녹음해서 노이즈가 "화아아-" 하고 들리는데 거기다 플러그인을 겁니다. 이건 먼지 낀 렌즈로 사진 찍는 거랑 같습니다. 적당한 게 중요합니다!

---

**믹싱 강좌 시리즈**: [← 제7부: 믹스는 '정리 정돈'에서 시작된다](/stories/mixing7) | [제9부: 투명 인간 같은 적, 위상(Phase) →](/stories/mixing9) | [믹싱 체인 가이드](/stories/mixing-chain1) | [믹싱 워크플로우 가이드](/stories/mixing-workflow1) | [온라인 믹싱 의뢰](/stories/onlinemix1) | [레슨 안내](/lesson) | [피아노 리듬감·리듬 훈련 음악연습실](/stories/practice-room-piano-rhythm1) | [기타 트레몰로·웜바 암 테크닉 음악연습실](/stories/practice-room-guitar-whammy1) | [보컬 다이나믹스·크레셴도 데크레셴도 음악연습실](/stories/practice-room-vocal-dynamics1) | [기타 줄 교체·스트링 선택 음악연습실](/stories/practice-room-guitar-string1) | [드럼 브러쉬·와이어 브러쉬 연주 음악연습실](/stories/practice-room-drum-brush1) | [피아노 즉흥 반주·코드 반주 음악연습실](/stories/practice-room-piano-sight-play1) | [베이스 코드·화음 연주 음악연습실](/stories/practice-room-bass-chord1) | [보컬 팔세토·가성 발성 음악연습실](/stories/practice-room-vocal-falsetto1) | [기타 탭핑·투핸드 태핑 음악연습실](/stories/practice-room-guitar-tapping1) | [피아노 듀엣·앙상블 개인 연습 음악연습실](/stories/practice-room-piano-duet1) | [드럼 폴리리듬·복잡박자 연습 음악연습실](/stories/practice-room-drum-polyrhythm1) | [보컬 어질리티·빠른 음계 훈련 음악연습실](/stories/practice-room-vocal-agility1) | [재즈 피아노 즉흥 솔로·임프로비제이션 음악연습실](/stories/practice-room-piano-jazz-improv1) | [기타 레가토·해머온 풀오프 연습 음악연습실](/stories/practice-room-guitar-legato1) | [베이스 펑크·R&B 그루브 음악연습실](/stories/practice-room-bass-funk1) | [보컬 프로젝션·소리 울림 훈련 음악연습실](/stories/practice-room-vocal-projection1) | [피아노 옥타브·넓은 음정 도약 연습 음악연습실](/stories/practice-room-piano-technique31) | [기타 슬라이드·슬라이드 기타 연습 음악연습실](/stories/practice-room-guitar-slide1) | [보컬 스타일 개발·장르별 창법 음악연습실](/stories/practice-room-vocal-style1) | [통기타 핑거피킹·핑거스타일 입문 음악연습실](/stories/practice-room-guitar-acoustic-fingerpick1) | [드럼 하이햇·심벌 컨트롤 음악연습실](/stories/practice-room-drum-hihat1) | [피아노 트릴·장식음 기법 음악연습실](/stories/practice-room-piano-trills1) | [기타 코드 진행·화성 이해 음악연습실](/stories/practice-room-guitar-chord-prog1) | [장르별 보컬 특성·크로스오버 보컬 음악연습실](/stories/practice-room-vocal-genre1) | [베이스 썸피킹·핑거스타일 혼합 음악연습실](/stories/practice-room-bass-thumb1) | [피아노 발라드 반주·감성 피아노 음악연습실](/stories/practice-room-piano-ballad21) | [기타 아르페지오·분산 화음 연습 음악연습실](/stories/practice-room-guitar-arpeggio1) | [보컬 녹음 준비·레코딩 보컬 음악연습실](/stories/practice-room-vocal-recording1) | [가스펠·CCM 피아노 반주 음악연습실](/stories/practice-room-piano-gospel1) | [기타 핑거스타일 고급·솔로 기타 편곡 음악연습실](/stories/practice-room-guitar-fingerpick-adv1) | [드럼 킥·베이스 드럼 테크닉 음악연습실](/stories/practice-room-drum-kick1) | [보컬 벨팅·파워 벨팅 음악연습실](/stories/practice-room-vocal-belting1) | [피아노 컴핑·재즈 반주 패턴 음악연습실](/stories/practice-room-piano-comping1) | [기타 피치카토·뮤트 주법 음악연습실](/stories/practice-room-guitar-mute1) | [베이스 핑거링·오른손 테크닉 음악연습실](/stories/practice-room-bass-fingering1) | [보컬 스타카토·단음 발성 훈련 음악연습실](/stories/practice-room-vocal-staccato1) | [드럼 심벌·크래쉬·라이드 테크닉 음악연습실](/stories/practice-room-drum-cymbal1) | [피아노 크로스 핸드·교차 손 훈련 음악연습실](/stories/practice-room-piano-crosshand1) | [기타 스케일 연습·포지션 이동 음악연습실](/stories/practice-room-guitar-scale-pos1) | [보컬 레가토·이어 부르기 훈련 음악연습실](/stories/practice-room-vocal-legato1) | [피아노 연탄·네 손 피아노 음악연습실](/stories/practice-room-piano-four-hands1) | [기타 핑거링·왼손 독립 훈련 음악연습실](/stories/practice-room-guitar-left-hand1) | [보컬 오버톤·배음 발성 훈련 음악연습실](/stories/practice-room-vocal-overtone1) | [드럼 스네어·림샷 테크닉 음악연습실](/stories/practice-room-drum-snare1) | [기타 왼손 비브라토·핑거 비브라토 음악연습실](/stories/practice-room-guitar-finger-vibrato1) | [피아노 루바토·음악적 템포 표현 음악연습실](/stories/practice-room-piano-rubato1) | [베이스 이펙터·페달 보드 활용 음악연습실](/stories/practice-room-bass-effects1) | [보컬 크루닝·저음 보컬 테크닉 음악연습실](/stories/practice-room-vocal-crooning1) | [피아노 소나타·클래식 소나타 형식 연습 음악연습실](/stories/practice-room-piano-sonata1) | [기타 재즈 코드·재즈 보이싱 음악연습실](/stories/practice-room-guitar-jazz-chord1) | [드럼 빠른 템포·스피드 훈련 음악연습실](/stories/practice-room-drum-speed1) | [보컬 중음역 강화·미들 보이스 음악연습실](/stories/practice-room-vocal-middle1) | [피아노 에튀드·기법 연습곡 음악연습실](/stories/practice-room-piano-etude1) | [기타 오픈 튜닝·슬라이드 오픈 튜닝 음악연습실](/stories/practice-room-guitar-open-tuning1) | [보컬 앙상블·코러스 개인 파트 훈련 음악연습실](/stories/practice-room-vocal-ensemble1) | [베이스 픽 주법·픽 베이스 연습 음악연습실](/stories/practice-room-bass-pick1) | [드럼 카운트·리듬 카운팅 훈련 음악연습실](/stories/practice-room-drum-count1) | [피아노 반음계·크로매틱 스케일 음악연습실](/stories/practice-room-piano-chromatic1) | [기타 핑거링 스트레칭·손가락 유연성 음악연습실](/stories/practice-room-guitar-stretch1) | [보컬 피치 컨트롤·음정 정확도 고급 훈련 음악연습실](/stories/practice-room-vocal-pitch1) | [베이스 슬라이드·포르타멘토 베이스 음악연습실](/stories/practice-room-bass-slide1) | [피아노 다이나믹·강약 표현 음악연습실](/stories/practice-room-piano-dynamics1) | [드럼 고스트 노트·유령음 훈련 음악연습실](/stories/practice-room-drum-ghost1) | [기타 코드 아르페지오·코드 분산 연주 음악연습실](/stories/practice-room-guitar-chord-arpeggio1) | [보컬 구음·솔페지오 훈련 음악연습실](/stories/practice-room-vocal-solfege1) | [피아노 폴리포니·독립 성부 연주 음악연습실](/stories/practice-room-piano-polyphony1) | [기타 리프·반복 패턴 작성 음악연습실](/stories/practice-room-guitar-riff1) | [드럼 오프비트·엇박 리듬 훈련 음악연습실](/stories/practice-room-drum-offbeat1) | [보컬 호흡 발음·자음 명료도 훈련 음악연습실](/stories/practice-room-vocal-consonant1) | [피아노 전조·조바꿈 연습 음악연습실](/stories/practice-room-piano-modulation1) | [기타 핑거피킹 패턴 다양화 음악연습실](/stories/practice-room-guitar-fingerpick-pattern1) | [베이스 뮤팅·노이즈 컨트롤 음악연습실](/stories/practice-room-bass-muting1) | [드럼 더블킥·더블 베이스 드럼 훈련 음악연습실](/stories/practice-room-drum-doublekick1) | [피아노 재즈 스탠다드·재즈 레퍼토리 음악연습실](/stories/practice-room-piano-jazz-standard1) | [보컬 라이브 퍼포먼스·공연 전 루틴 음악연습실](/stories/practice-room-vocal-live1) | [기타 뮤직 메모리·악보 없이 연주하기 음악연습실](/stories/practice-room-guitar-memory1) | [피아노 연속 도약·넓은 음정 점프 음악연습실](/stories/practice-room-piano-leaps1) | [드럼 크레셴도·다이나믹 빌드업 음악연습실](/stories/practice-room-drum-buildup1) | [연신내 음악연습실 안내](/stories/practice-room-yeonsinnae1) | [요금 안내](/pricing)

