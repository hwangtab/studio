---
title: "믹싱 강좌 - 제16부: 소리의 조각가, 이퀄라이저(EQ)"
date: 2025-11-26
author: "스튜디오 놀"
category: "강좌"
tags: ["믹싱", "강좌", "EQ", "Equalizer", "Frequency"]
summary: "이퀄라이저(EQ)의 기본 원리부터 서브트랙티브·애디티브 EQ 활용법까지. 보컬과 악기 믹싱에서 EQ를 어떻게 사용해야 하는지 실전 위주로 설명합니다."
thumbnail: "/images/recording16.webp"
faq:
  - q: "EQ(이퀄라이저)란 무엇인가요?"
    a: "EQ는 소리의 특정 주파수 대역을 깎거나 키워주는 도구입니다. 믹싱에서 악기 간 주파수 충돌을 정리하고, 보컬을 선명하게 만드는 데 가장 많이 사용됩니다."
  - q: "보컬 EQ는 어떻게 설정하나요?"
    a: "일반적으로 200Hz 이하 불필요한 저역을 하이패스 필터로 제거하고, 1~3kHz 구간을 약간 올려 선명도를 높입니다. 과도한 부스트보다 커트(감쇄) 위주로 작업하는 것이 자연스러운 결과를 만듭니다."
  - q: "서브트랙티브 EQ와 애디티브 EQ의 차이는 무엇인가요?"
    a: "서브트랙티브 EQ는 불필요한 주파수를 깎는 방식이고, 애디티브 EQ는 원하는 주파수를 올리는 방식입니다. 믹싱에서는 먼저 서브트랙티브로 문제를 해결하고, 필요한 경우에만 애디티브를 사용하는 순서를 권장합니다."
---
![화려한 컬러의 EQ 그래프 이미지](/images/pcw.webp)

"소리가 너무 답답해요." (킁킁-)
"보컬 목소리가 날카로워서 귀가 아파요." (아야-!)
이 모든 고민을 해결해줄 믹싱의 마법 지팡이, 바로 **이퀄라이저(EQ)**입니다.
EQ는 소리의 특정 주파수 대역을 깎거나 키워주는 도구입니다. 마치 찰흙을 깎아 조각상을 만들듯, 우리는 EQ로 소리를 다듬습니다. (슥삭슥삭-!)

## 1. EQ의 첫 번째 임무: 청소 (Subtractive EQ)

초보자들이 가장 많이 하는 실수는 EQ로 자꾸 뭔가를 **'키우려고(Boost)'** 하는 것입니다. 하지만 진짜 고수들은 **'깎는(Cut)'** 것부터 시작합니다. (비우기!)

*   **Low Cut (High Pass Filter)**: 믹싱의 필살기입니다. 킥 드럼과 베이스를 제외한 거의 모든 트랙(보컬, 기타, 건반 등)에서 저음역대(대략 80~100Hz 이하)를 과감하게 자르세요. (삭-!)
    *   왜요? 우리 귀에는 안 들려도 웅웅거리는 불필요한 저음 에너지가 믹스를 지저분하게 만들거든요. 이것만 잘해도 믹스가 10배는 깨끗해집니다. (반짝-!)

## 2. 주파수 대역별 느낌 (이것만 외우세요!)

*   **저음 (20~200Hz)**: 묵직함, 펀치감, 무게감. (둥둥-!) 너무 많으면 믹스가 머디(Muddy)해집니다.
*   **중저음 (200~600Hz)**: 따뜻함, 바디감. 하지만 여기가 뭉치면 '통통'거리거나 답답하게 들립니다. (텁텁-)
*   **중음 (600~3kHz)**: 악기의 정체성, 가사 전달력. 사람 귀가 가장 예민한 곳입니다. (쫑긋!) 너무 키우면 깡통 소리가 납니다. (앵앵-!)
*   **고음 (3~8kHz)**: 선명도, 존재감. (선명-!) 너무 많으면 귀가 아픕니다. (찌릿!)
*   **초고음 (10kHz 이상)**: 공기감(Air), 화려함. (샤아악-!)

## 3. [Studio Episode] 깎기만 했는데 소리가 좋아진다고?

어느 날, 보컬 소리가 너무 안 들린다며 한 학생이 믹스본을 가져왔습니다. 보컬 트랙을 보니 고음역대를 무려 10dB나 올렸더군요. (세상에-!) 소리는 화살처럼 날카로웠지만 신기하게도 반주 속에 묻혀 여전히 답답했습니다.

저는 보컬 EQ는 그대로 두고, 보컬을 방해하고 있던 **기타와 피아노 트랙**을 열었습니다. (슥- 슥-)
그리고 보컬의 핵심 주파수인 1kHz~3kHz 대역을 기타와 피아노에서 3dB 정도만 깎아주었습니다. (살짝-!)

결과는 마법 같았습니다. 찌르던 보컬 고음을 다시 내렸는데도, 보컬이 반주 위로 선명하게 떠올랐습니다. 보컬을 키우는 대신, 보컬이 들어갈 '구멍'을 악기들 사이에서 파준 것이죠. 

**[깨달음]**: EQ는 뭔가를 더하는 도구가 아니라, 서로 양보하게 만드는 **'교통 정리'** 도구입니다.

## 4. Q값: 현미경 혹은 돋보기

EQ에서 **Q(Bandwidth)**는 조절할 범위를 결정합니다.
*   **좁은 Q (높은 숫자)**: 특정한 '나쁜 소리'를 핀셋으로 집어내서 깎을 때 씁니다. (콕-!)
*   **넓은 Q (낮은 숫자)**: 전체적인 톤을 부드럽게 보정하거나 좋은 소리를 살릴 때 씁니다. (둥글-!)

---

### 실전 팁: 스위핑(Sweeping) 테크닉
1.  EQ 노브 하나를 10dB 정도 크게 키웁니다.
2.  주파수를 왼쪽에서 오른쪽으로 천천히 움직입니다. (슥-- 슥--)
3.  갑자기 "으악, 이 소리 진짜 듣기 싫다!" 하는 지점이 나올 겁니다. (웩-!)
4.  거기서 멈추고, 그대로 아래로 깎아버리세요. (숙-!)
5.  여러분의 소리가 한결 편안해진 걸 느낄 수 있습니다. (휴우-!)

---

### [초보자의 흔한 실수] ✂️
*   **"부스트 중독"**: 아쉬운 소리가 들릴 때마다 자꾸 EQ로 키웁니다. 결국 모든 트랙이 볼륨 전쟁을 하게 되고, 믹스는 찌그러며 헤드룸은 바닥납니다. 깎는 게 먼저입니다! (단호!)
*   **"눈으로 하는 EQ"**: 플러그인의 화려한 그래프를 보며 "이 모양이 예쁘네" 하며 소리를 만집니다. 눈을 감으세요. 소리만 들으세요. 예쁜 모양이 예쁜 소리를 보장하지 않습니다. (띠링-!)
*   **"쏠로 EQ질"**: 다른 악기는 다 끄고 보컬만 켜놓은 채 1시간 동안 EQ를 만집니다. 단독으론 국영수 1등급인데, 합치면 꼴찌가 되는 기적을 보게 될 겁니다. 믹싱은 항상 '함께' 들으며 하세요! (다 같이-!)

---

**믹싱 강좌 시리즈**: [← 제15부: 좌우의 미학, 패닝(Panning)](/stories/mixing15) | [제17부: 음악의 생동감, 컴프레서 →](/stories/mixing17)

---

[보컬 EQ 완전 가이드 (실전 주파수별 설정법)](/stories/eq1) | [믹싱 체인 가이드](/stories/mixing-chain1) | [온라인 믹싱 의뢰](/stories/onlinemix1) | [레슨 안내](/lesson) | [피아노 리듬감·리듬 훈련 음악연습실](/stories/practice-room-piano-rhythm1) | [기타 트레몰로·웜바 암 테크닉 음악연습실](/stories/practice-room-guitar-whammy1) | [보컬 다이나믹스·크레셴도 데크레셴도 음악연습실](/stories/practice-room-vocal-dynamics1) | [기타 줄 교체·스트링 선택 음악연습실](/stories/practice-room-guitar-string1) | [드럼 브러쉬·와이어 브러쉬 연주 음악연습실](/stories/practice-room-drum-brush1) | [피아노 즉흥 반주·코드 반주 음악연습실](/stories/practice-room-piano-sight-play1) | [베이스 코드·화음 연주 음악연습실](/stories/practice-room-bass-chord1) | [보컬 팔세토·가성 발성 음악연습실](/stories/practice-room-vocal-falsetto1) | [기타 탭핑·투핸드 태핑 음악연습실](/stories/practice-room-guitar-tapping1) | [피아노 듀엣·앙상블 개인 연습 음악연습실](/stories/practice-room-piano-duet1) | [드럼 폴리리듬·복잡박자 연습 음악연습실](/stories/practice-room-drum-polyrhythm1) | [보컬 어질리티·빠른 음계 훈련 음악연습실](/stories/practice-room-vocal-agility1) | [재즈 피아노 즉흥 솔로·임프로비제이션 음악연습실](/stories/practice-room-piano-jazz-improv1) | [기타 레가토·해머온 풀오프 연습 음악연습실](/stories/practice-room-guitar-legato1) | [베이스 펑크·R&B 그루브 음악연습실](/stories/practice-room-bass-funk1) | [보컬 프로젝션·소리 울림 훈련 음악연습실](/stories/practice-room-vocal-projection1) | [피아노 옥타브·넓은 음정 도약 연습 음악연습실](/stories/practice-room-piano-technique31) | [기타 슬라이드·슬라이드 기타 연습 음악연습실](/stories/practice-room-guitar-slide1) | [보컬 스타일 개발·장르별 창법 음악연습실](/stories/practice-room-vocal-style1) | [통기타 핑거피킹·핑거스타일 입문 음악연습실](/stories/practice-room-guitar-acoustic-fingerpick1) | [드럼 하이햇·심벌 컨트롤 음악연습실](/stories/practice-room-drum-hihat1) | [피아노 트릴·장식음 기법 음악연습실](/stories/practice-room-piano-trills1) | [기타 코드 진행·화성 이해 음악연습실](/stories/practice-room-guitar-chord-prog1) | [장르별 보컬 특성·크로스오버 보컬 음악연습실](/stories/practice-room-vocal-genre1) | [베이스 썸피킹·핑거스타일 혼합 음악연습실](/stories/practice-room-bass-thumb1) | [피아노 발라드 반주·감성 피아노 음악연습실](/stories/practice-room-piano-ballad21) | [기타 아르페지오·분산 화음 연습 음악연습실](/stories/practice-room-guitar-arpeggio1) | [보컬 녹음 준비·레코딩 보컬 음악연습실](/stories/practice-room-vocal-recording1) | [가스펠·CCM 피아노 반주 음악연습실](/stories/practice-room-piano-gospel1) | [기타 핑거스타일 고급·솔로 기타 편곡 음악연습실](/stories/practice-room-guitar-fingerpick-adv1) | [드럼 킥·베이스 드럼 테크닉 음악연습실](/stories/practice-room-drum-kick1) | [보컬 벨팅·파워 벨팅 음악연습실](/stories/practice-room-vocal-belting1) | [피아노 컴핑·재즈 반주 패턴 음악연습실](/stories/practice-room-piano-comping1) | [기타 피치카토·뮤트 주법 음악연습실](/stories/practice-room-guitar-mute1) | [베이스 핑거링·오른손 테크닉 음악연습실](/stories/practice-room-bass-fingering1) | [보컬 스타카토·단음 발성 훈련 음악연습실](/stories/practice-room-vocal-staccato1) | [드럼 심벌·크래쉬·라이드 테크닉 음악연습실](/stories/practice-room-drum-cymbal1) | [피아노 크로스 핸드·교차 손 훈련 음악연습실](/stories/practice-room-piano-crosshand1) | [기타 스케일 연습·포지션 이동 음악연습실](/stories/practice-room-guitar-scale-pos1) | [보컬 레가토·이어 부르기 훈련 음악연습실](/stories/practice-room-vocal-legato1) | [피아노 연탄·네 손 피아노 음악연습실](/stories/practice-room-piano-four-hands1) | [기타 핑거링·왼손 독립 훈련 음악연습실](/stories/practice-room-guitar-left-hand1) | [보컬 오버톤·배음 발성 훈련 음악연습실](/stories/practice-room-vocal-overtone1) | [드럼 스네어·림샷 테크닉 음악연습실](/stories/practice-room-drum-snare1) | [연신내 음악연습실 안내](/stories/practice-room-yeonsinnae1) | [요금 안내](/pricing)
