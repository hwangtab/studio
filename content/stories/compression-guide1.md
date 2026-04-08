---
title: "컴프레서 완전 가이드 — 보컬·드럼·베이스 컴프레션 설정과 원리"
date: 2026-04-06
author: "스튜디오 놀"
category: "믹싱 가이드"
tags: ["컴프레서 가이드", "컴프레션 설정", "보컬 컴프레션", "드럼 컴프레션", "믹싱 컴프레서", "다이나믹 처리", "컴프레서 파라미터"]
thumbnail: "/images/recording4.webp"
summary: "컴프레서 완전 가이드입니다. 컴프레서 파라미터 설명·악기별 컴프레션 설정·병렬 컴프레션 (뉴욕 컴프레션)·컴프레서 타입별 특성까지 정리합니다."
faq:
  - q: "컴프레서는 왜 사용하나요?"
    a: "컴프레서는 오디오 신호의 다이나믹 범위(가장 조용한 소리와 가장 큰 소리의 차이)를 줄이는 도구입니다. 보컬에서는 볼륨이 들쭉날쭉한 문제를 해결하고, 드럼에서는 펀치감을 강조하며, 전체 믹스에서는 일관된 음압을 유지하는 데 사용됩니다."
  - q: "Attack과 Release 설정이 왜 중요한가요?"
    a: "Attack은 컴프레서가 작동하기까지의 시간입니다. Attack이 빠르면 트랜지언트(초기 충격)까지 압축되어 사운드가 뭉개집니다. Attack이 느리면 트랜지언트를 살려 펀치감이 증가합니다. Release는 압축 해제 속도로, 너무 빠르면 펌핑 느낌, 너무 느리면 다음 음에 영향을 줍니다."
  - q: "Ratio는 어떻게 설정하나요?"
    a: "Ratio는 압축 강도입니다. 2:1은 부드러운 압축(Threshold 초과 2dB마다 1dB 출력), 4:1은 중간, 8:1은 강한 압축, 20:1 이상은 리미팅에 가깝습니다. 보컬에는 2:1~4:1, 드럼에는 4:1~8:1, 리미팅에는 10:1 이상을 사용합니다."
  - q: "컴프레서를 너무 많이 쓰면 어떻게 되나요?"
    a: "과도한 컴프레션은 오디오의 생동감과 다이나믹을 죽입니다. 음악이 피로감을 주고, 펀치감이 사라지며, 모든 소리가 같은 레벨로 들려 지루해집니다. GR(Gain Reduction)을 3~6dB 이내로 제한하는 것이 일반적으로 권장됩니다."
---
![컴프레서 완전 가이드 — 스튜디오 놀](/images/recording4.webp)

## 컴프레서 — 다이나믹을 제어하는 믹싱의 핵심 도구

컴프레서는 믹싱에서 가장 많이 사용되는 동시에 가장 잘못 이해되는 도구입니다. 올바른 파라미터 이해와 설정이 자연스럽고 전문적인 사운드를 만듭니다.

---

## 컴프레서 파라미터 설명

플러그인을 추가하기 전에 게인 스테이징이 올바른지 먼저 확인합니다.

### 핵심 파라미터

**Threshold (쓰레스홀드)**
- 압축이 시작되는 레벨 기준점
- **-20dBFS**: 많은 신호가 압축됨 (강하게)
- **-6dBFS**: 가장 큰 피크만 압축 (부드럽게)
- 낮출수록 더 많이 압축

**Ratio (레이쇼)**
- 압축 강도
- **2**: 1 = 가볍게 (Threshold 초과 2dB → 1dB 출력)
- **4**: 1 = 중간
- **8**: 1+ = 강하게
- **∞**: 1 = 하드 리미팅

**Attack (어택)**
- 압축 시작까지 걸리는 시간 (ms)
- **빠른 Attack (1ms)**: 트랜지언트 압축 → 뭉개짐
- **느린 Attack (50ms)**: 트랜지언트 통과 → 펀치감 유지

**Release (릴리즈)**
- 압축 해제까지 걸리는 시간 (ms~s)
- **빠른 Release**: 펌핑 느낌 (의도적 효과 가능)
- **느린 Release**: 부드러운 해제

**Knee (니)**
- **Hard Knee**: Threshold에서 즉시 압축 시작
- **Soft Knee**: Threshold 전후로 점진적 압축
- Soft Knee가 더 자연스러운 사운드

**Make-up Gain**
- 압축으로 줄어든 음량 보상
- 압축 후 출력 레벨 복구

---

## 악기별 컴프레션 설정

바이패스로 전후 비교하는 습관이 과처리를 막는 가장 효과적인 방법입니다.

### 보컬 컴프레션

**팝 보컬**
- **Ratio**: 2:1~3:1
- **Attack**: 10~30ms (자음 살리기)
- **Release**: 60~120ms
- **Threshold**: GR 3~5dB
- **Knee**: Soft

**R&B·소울 보컬**
- **Ratio**: 4:1~6:1 (더 강하게)
- **Attack**: 5~15ms
- **Release**: 40~80ms
- 강한 압축으로 일관된 레벨

### 드럼 컴프레션

**스네어**
- **Ratio**: 4:1~6:1
- **Attack**: 10~30ms (크랙 살리기)
- **Release**: 50~100ms

**킥**
- **Ratio**: 4:1~8:1
- **Attack**: 5~20ms
- **Release**: 50~100ms
- 펀치감 강조

**버스 드럼 (드럼 총합)**
- **Ratio**: 2:1~4:1
- **Attack**: 30~50ms (전체 앙상블 펀치)
- 전체적 일체감 강화

### 베이스 컴프레션

**베이스 기타**
- **Ratio**: 4:1~6:1
- **Attack**: 30~50ms
- **Release**: 80~150ms
- 일관된 레벨·저역 단단하게

---

## 병렬 컴프레션 (뉴욕 컴프레션)

각 파라미터가 사운드에 미치는 영향을 이해하면 설정값을 외우지 않아도 귀로 판단할 수 있습니다.

### 병렬 컴프레션이란

**방법**
1. 원본 트랙 → 드라이로 유지
2. 컴프레션 버스: 강하게 압축 (ratio 8:1+)
3. 두 채널 블렌딩 (50:50 또는 드라이 많게)

**효과**
- 트랜지언트 (원본) + 서스테인 (압축) 동시 확보
- 드럼에 특히 효과적 (펀치 + 두께)
- 보컬에도 활용 가능

**보컬 병렬 컴프레션**
- 원본 보컬 70% + 압축 보컬 30% 블렌딩
- 자연스러운 원음 + 일관된 레벨 효과

---

## 컴프레서 타입별 특성

모노로 확인하면 스테레오에서 감춰진 문제를 더 빨리 발견할 수 있습니다.

### 하드웨어 에뮬레이션 타입

**VCA 컴프레서 (SSL G-Bus, API 2500)**
- 빠른 Attack·Release 가능
- 정확하고 투명한 압축
- 드럼·버스에 적합

**FET 컴프레서 (UA 1176)**
- 매우 빠른 Attack
- 공격적이고 존재감 있는 사운드
- 보컬·기타에 많이 사용

**Opto 컴프레서 (LA-2A)**
- 느린 Attack (자동 조절)
- 자연스럽고 음악적인 압축
- 보컬·베이스에 적합

**VG (Tube) 컴프레서 (Fairchild 670)**
- 따뜻하고 빈티지한 사운드
- 마스터링·버스 처리에 사용

---

## 마치며

컴프레서는 믹싱의 핵심이지만 절제가 미덕입니다.

---

[헤드폰 믹싱 완전 가이드](/stories/headphone-mixing1) | [리버브 완전 가이드](/stories/reverb-guide1) | [병렬 컴프레션 완전 가이드](/stories/parallel-compression1) | [믹싱 체인 완전 가이드](/stories/mixing-chain1) | [온라인 믹싱 의뢰 방법](/stories/onlinemix1) | [피아노 리듬감·리듬 훈련 음악연습실](/stories/practice-room-piano-rhythm1) | [기타 트레몰로·웜바 암 테크닉 음악연습실](/stories/practice-room-guitar-whammy1) | [보컬 다이나믹스·크레셴도 데크레셴도 음악연습실](/stories/practice-room-vocal-dynamics1) | [기타 줄 교체·스트링 선택 음악연습실](/stories/practice-room-guitar-string1) | [드럼 브러쉬·와이어 브러쉬 연주 음악연습실](/stories/practice-room-drum-brush1) | [피아노 즉흥 반주·코드 반주 음악연습실](/stories/practice-room-piano-sight-play1) | [베이스 코드·화음 연주 음악연습실](/stories/practice-room-bass-chord1) | [보컬 팔세토·가성 발성 음악연습실](/stories/practice-room-vocal-falsetto1) | [기타 탭핑·투핸드 태핑 음악연습실](/stories/practice-room-guitar-tapping1) | [피아노 듀엣·앙상블 개인 연습 음악연습실](/stories/practice-room-piano-duet1) | [드럼 폴리리듬·복잡박자 연습 음악연습실](/stories/practice-room-drum-polyrhythm1) | [보컬 어질리티·빠른 음계 훈련 음악연습실](/stories/practice-room-vocal-agility1) | [재즈 피아노 즉흥 솔로·임프로비제이션 음악연습실](/stories/practice-room-piano-jazz-improv1) | [기타 레가토·해머온 풀오프 연습 음악연습실](/stories/practice-room-guitar-legato1) | [베이스 펑크·R&B 그루브 음악연습실](/stories/practice-room-bass-funk1) | [보컬 프로젝션·소리 울림 훈련 음악연습실](/stories/practice-room-vocal-projection1) | [피아노 옥타브·넓은 음정 도약 연습 음악연습실](/stories/practice-room-piano-technique31) | [기타 슬라이드·슬라이드 기타 연습 음악연습실](/stories/practice-room-guitar-slide1) | [보컬 스타일 개발·장르별 창법 음악연습실](/stories/practice-room-vocal-style1) | [통기타 핑거피킹·핑거스타일 입문 음악연습실](/stories/practice-room-guitar-acoustic-fingerpick1) | [드럼 하이햇·심벌 컨트롤 음악연습실](/stories/practice-room-drum-hihat1) | [피아노 트릴·장식음 기법 음악연습실](/stories/practice-room-piano-trills1) | [기타 코드 진행·화성 이해 음악연습실](/stories/practice-room-guitar-chord-prog1) | [장르별 보컬 특성·크로스오버 보컬 음악연습실](/stories/practice-room-vocal-genre1) | [베이스 썸피킹·핑거스타일 혼합 음악연습실](/stories/practice-room-bass-thumb1) | [피아노 발라드 반주·감성 피아노 음악연습실](/stories/practice-room-piano-ballad21) | [기타 아르페지오·분산 화음 연습 음악연습실](/stories/practice-room-guitar-arpeggio1) | [보컬 녹음 준비·레코딩 보컬 음악연습실](/stories/practice-room-vocal-recording1) | [가스펠·CCM 피아노 반주 음악연습실](/stories/practice-room-piano-gospel1) | [기타 핑거스타일 고급·솔로 기타 편곡 음악연습실](/stories/practice-room-guitar-fingerpick-adv1) | [드럼 킥·베이스 드럼 테크닉 음악연습실](/stories/practice-room-drum-kick1) | [보컬 벨팅·파워 벨팅 음악연습실](/stories/practice-room-vocal-belting1) | [피아노 컴핑·재즈 반주 패턴 음악연습실](/stories/practice-room-piano-comping1) | [기타 피치카토·뮤트 주법 음악연습실](/stories/practice-room-guitar-mute1) | [베이스 핑거링·오른손 테크닉 음악연습실](/stories/practice-room-bass-fingering1) | [보컬 스타카토·단음 발성 훈련 음악연습실](/stories/practice-room-vocal-staccato1) | [드럼 심벌·크래쉬·라이드 테크닉 음악연습실](/stories/practice-room-drum-cymbal1) | [피아노 크로스 핸드·교차 손 훈련 음악연습실](/stories/practice-room-piano-crosshand1) | [기타 스케일 연습·포지션 이동 음악연습실](/stories/practice-room-guitar-scale-pos1) | [보컬 레가토·이어 부르기 훈련 음악연습실](/stories/practice-room-vocal-legato1) | [피아노 연탄·네 손 피아노 음악연습실](/stories/practice-room-piano-four-hands1) | [기타 핑거링·왼손 독립 훈련 음악연습실](/stories/practice-room-guitar-left-hand1) | [보컬 오버톤·배음 발성 훈련 음악연습실](/stories/practice-room-vocal-overtone1) | [드럼 스네어·림샷 테크닉 음악연습실](/stories/practice-room-drum-snare1) | [기타 왼손 비브라토·핑거 비브라토 음악연습실](/stories/practice-room-guitar-finger-vibrato1) | [피아노 루바토·음악적 템포 표현 음악연습실](/stories/practice-room-piano-rubato1) | [베이스 이펙터·페달 보드 활용 음악연습실](/stories/practice-room-bass-effects1) | [보컬 크루닝·저음 보컬 테크닉 음악연습실](/stories/practice-room-vocal-crooning1) | [피아노 소나타·클래식 소나타 형식 연습 음악연습실](/stories/practice-room-piano-sonata1) | [기타 재즈 코드·재즈 보이싱 음악연습실](/stories/practice-room-guitar-jazz-chord1) | [드럼 빠른 템포·스피드 훈련 음악연습실](/stories/practice-room-drum-speed1) | [보컬 중음역 강화·미들 보이스 음악연습실](/stories/practice-room-vocal-middle1) | [피아노 에튀드·기법 연습곡 음악연습실](/stories/practice-room-piano-etude1) | [기타 오픈 튜닝·슬라이드 오픈 튜닝 음악연습실](/stories/practice-room-guitar-open-tuning1) | [보컬 앙상블·코러스 개인 파트 훈련 음악연습실](/stories/practice-room-vocal-ensemble1) | [베이스 픽 주법·픽 베이스 연습 음악연습실](/stories/practice-room-bass-pick1) | [드럼 카운트·리듬 카운팅 훈련 음악연습실](/stories/practice-room-drum-count1) | [피아노 반음계·크로매틱 스케일 음악연습실](/stories/practice-room-piano-chromatic1) | [기타 핑거링 스트레칭·손가락 유연성 음악연습실](/stories/practice-room-guitar-stretch1) | [보컬 피치 컨트롤·음정 정확도 고급 훈련 음악연습실](/stories/practice-room-vocal-pitch1) | [베이스 슬라이드·포르타멘토 베이스 음악연습실](/stories/practice-room-bass-slide1) | [피아노 다이나믹·강약 표현 음악연습실](/stories/practice-room-piano-dynamics1) | [드럼 고스트 노트·유령음 훈련 음악연습실](/stories/practice-room-drum-ghost1) | [기타 코드 아르페지오·코드 분산 연주 음악연습실](/stories/practice-room-guitar-chord-arpeggio1) | [보컬 구음·솔페지오 훈련 음악연습실](/stories/practice-room-vocal-solfege1) | [피아노 폴리포니·독립 성부 연주 음악연습실](/stories/practice-room-piano-polyphony1) | [기타 리프·반복 패턴 작성 음악연습실](/stories/practice-room-guitar-riff1) | [드럼 오프비트·엇박 리듬 훈련 음악연습실](/stories/practice-room-drum-offbeat1) | [보컬 호흡 발음·자음 명료도 훈련 음악연습실](/stories/practice-room-vocal-consonant1) | [피아노 전조·조바꿈 연습 음악연습실](/stories/practice-room-piano-modulation1) | [기타 핑거피킹 패턴 다양화 음악연습실](/stories/practice-room-guitar-fingerpick-pattern1) | [베이스 뮤팅·노이즈 컨트롤 음악연습실](/stories/practice-room-bass-muting1) | [드럼 더블킥·더블 베이스 드럼 훈련 음악연습실](/stories/practice-room-drum-doublekick1) | [피아노 재즈 스탠다드·재즈 레퍼토리 음악연습실](/stories/practice-room-piano-jazz-standard1) | [보컬 라이브 퍼포먼스·공연 전 루틴 음악연습실](/stories/practice-room-vocal-live1) | [기타 뮤직 메모리·악보 없이 연주하기 음악연습실](/stories/practice-room-guitar-memory1) | [피아노 연속 도약·넓은 음정 점프 음악연습실](/stories/practice-room-piano-leaps1) | [드럼 크레셴도·다이나믹 빌드업 음악연습실](/stories/practice-room-drum-buildup1) | [베이스 펜타토닉·베이스 스케일 활용 음악연습실](/stories/practice-room-bass-pentatonic1) | [보컬 감정 표현·가사 해석 훈련 음악연습실](/stories/practice-room-vocal-emotion1) | [기타 해머온·풀오프 연속 훈련 음악연습실](/stories/practice-room-guitar-hammer-pull1) | [피아노 내성부·보조 선율 연습 음악연습실](/stories/practice-room-piano-inner-voice1) | [드럼 림샷·크로스스틱 고급 훈련 음악연습실](/stories/practice-room-drum-rimshot-adv1) | [보컬 뮤지컬 스타일·역할 보컬 훈련 음악연습실](/stories/practice-room-vocal-musical-style1) | [베이스 슬랩·팝핑 고급 테크닉 음악연습실](/stories/practice-room-bass-slap-adv1) | [피아노 초견 고급·빠른 악보 읽기 음악연습실](/stories/practice-room-piano-sight-adv1) | [드럼 타이밍·포켓 그루브 훈련 음악연습실](/stories/practice-room-drum-timing1) | [보컬 호흡·성대 컨트롤 고급 훈련 음악연습실](/stories/practice-room-vocal-breath-adv1) | [기타 비브라토·피치 컨트롤 음악연습실](/stories/practice-room-guitar-vibrato1) | [피아노 화성·코드 고급 이론 음악연습실](/stories/practice-room-piano-chord-adv1) | [재즈 베이스·워킹 베이스 고급 음악연습실](/stories/practice-room-bass-jazz1) | [보컬 음색 개발·개성 있는 목소리 훈련 음악연습실](/stories/practice-room-vocal-color-adv1) | [드럼 선형 리듬·리니어 드러밍 음악연습실](/stories/practice-room-drum-linear1) | [피아노 고급 테크닉·연주 기법 종합 음악연습실](/stories/practice-room-piano-technique-adv1) | [기타 코드 고급·확장 코드 연주 음악연습실](/stories/practice-room-guitar-chord-adv1) | [보컬 레지스터·성구 전환 훈련 음악연습실](/stories/practice-room-vocal-register1) | [베이스 루트 노트·코드 읽기 고급 음악연습실](/stories/practice-room-bass-root-adv1) | [피아노 터치·아티큘레이션 훈련 음악연습실](/stories/practice-room-piano-touch1) | [재즈 드럼 고급·스윙 필 심화 음악연습실](/stories/practice-room-drum-jazz-adv1) | [보컬 무대 퍼포먼스 고급·스테이지 존재감 음악연습실](/stories/practice-room-vocal-stage-adv1) | [기타 즉흥 연주·임프로비제이션 음악연습실](/stories/practice-room-guitar-improv1) | [성인 피아노 입문·처음 시작하는 어른 음악연습실](/stories/practice-room-piano-beginner-adult1) | [드럼 악센트·강세 패턴 훈련 음악연습실](/stories/practice-room-drum-accent1) | [베이스 옥타브 주법·옥타브 그루브 음악연습실](/stories/practice-room-bass-octave1) | [피아노 음정·인터벌 훈련 음악연습실](/stories/practice-room-piano-interval1) | [보컬 오디션 준비·심사 기준 이해 음악연습실](/stories/practice-room-vocal-audition1) | [기타 핑거스타일 고급 테크닉 음악연습실](/stories/practice-room-guitar-fingerstyle-adv1) | [베이스 플래절렛·하모닉스 주법 음악연습실](/stories/practice-room-bass-harmonic1) | [피아노 페달 테크닉·소스텐우토 음악연습실](/stories/practice-room-piano-pedal1) | [피아노 스케일·아르페지오 고급 훈련 음악연습실](/stories/practice-room-piano-scale-adv1) | [베이스 타핑·투핸드 테크닉 음악연습실](/stories/practice-room-bass-tapping1) | [보컬 리듬·박자감 훈련 음악연습실](/stories/practice-room-vocal-rhythm1) | [기타 재즈 보이싱·코드 멜로디 음악연습실](/stories/practice-room-guitar-jazz-voicing1) | [피아노 즉흥 연주·재즈 피아노 음악연습실](/stories/practice-room-piano-jazz1) | [보컬 코러스·하모니 훈련 음악연습실](/stories/practice-room-vocal-harmony1) | [드럼 더블 킥·더블 페달 훈련 음악연습실](/stories/practice-room-drum-double-kick1) | [연신내 음악연습실 안내](/stories/practice-room-yeonsinnae1) | [스튜디오 놀 이용 요금](/pricing)
