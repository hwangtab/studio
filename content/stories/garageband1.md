---
title: "GarageBand 보컬 녹음 완전 가이드 — 무료 DAW로 고퀄리티 녹음"
date: 2026-04-07
author: "스튜디오 놀"
category: "녹음 가이드"
tags: ["GarageBand 보컬", "가라지밴드 녹음", "GarageBand 설정", "맥 보컬 녹음", "무료 DAW 녹음", "GarageBand 믹싱", "iOS GarageBand"]
thumbnail: "/images/room6.webp"
summary: "GarageBand 보컬 녹음 완전 가이드입니다. Mac·iOS GarageBand 기본 설정, 오디오 인터페이스 연결, 트랙 생성, EQ·컴프레서 삽입, 파일 공유 방법을 정리합니다."
faq:
  - q: "GarageBand로 고퀄리티 보컬 녹음이 가능한가요?"
    a: "가능합니다. GarageBand는 전문 DAW 수준의 녹음·편집 기능을 무료로 제공합니다. 좋은 마이크와 오디오 인터페이스, 방음 처리가 갖춰지면 스튜디오 의뢰 수준의 드라이 보컬을 얻을 수 있습니다."
  - q: "GarageBand에서 오디오 인터페이스를 연결하는 방법은?"
    a: "오디오 인터페이스를 USB로 Mac에 연결 후, GarageBand 환경설정(Preferences) → Audio/MIDI 탭에서 입력·출력 장치를 오디오 인터페이스로 설정합니다. iOS는 Lightning/USB-C 어댑터를 통해 연결합니다."
  - q: "GarageBand에서 EQ와 컴프레서를 어떻게 사용하나요?"
    a: "트랙 헤더 영역에서 'Smart Controls' 또는 플러그인 메뉴(+)를 열고 EQ, Compressor를 추가합니다. Channel EQ(그래픽 EQ)와 Compressor는 GarageBand에 기본 내장되어 있습니다."
  - q: "GarageBand 녹음 파일을 믹싱 의뢰용으로 어떻게 내보내나요?"
    a: "Share → Export Song to Disk → Lossless(AIFF 또는 WAV)로 내보냅니다. 믹싱 의뢰 시에는 무손실 파일(WAV 또는 AIFF 24bit)로 내보내서 전달하세요."
---
![GarageBand 보컬 녹음 완전 가이드 — 스튜디오 놀](/images/room6.webp)

## GarageBand — Mac·iOS에서 무료로 전문 녹음

GarageBand는 Apple 기기에 기본 탑재된 무료 DAW로, 초보자부터 중급자까지 바로 사용할 수 있는 강력한 녹음 환경을 제공합니다.

---

## GarageBand 기본 설정 (Mac)

자동화(Automation) 레인을 활용하면 수동 조정 없이 정밀한 다이나믹 변화를 만들 수 있습니다.

### 오디오 인터페이스 설정

1. 오디오 인터페이스 USB 연결
2. GarageBand → 환경설정(Preferences)
3. Audio/MIDI 탭 열기
4. 입력 장치: 오디오 인터페이스 선택
   출력 장치: 오디오 인터페이스 또는 헤드폰

### 샘플레이트 설정

- 오디오 인터페이스 드라이버에서 48kHz 선택
- GarageBand 프로젝트 샘플레이트와 일치

### 버퍼 크기

- 녹음 시: 64~128 samples (레이턴시 최소화)
- 믹싱 시: 256~512 samples (CPU 효율화)

---

## 오디오 트랙 생성 및 녹음

같은 기능이라도 DAW에 내장된 도구가 서드파티 플러그인보다 안정적인 경우가 많습니다.

### 트랙 생성

1. File → New Track (Shift+Cmd+N)
2. Audio 선택 → 입력 장치 확인
3. 마이크 아이콘 활성화 (녹음 대기)

### 게인 설정

- Smart Controls 하단 Input Level 확인
- 보컬 피크: -12dBFS ~ -6dBFS 범위
- 클리핑(빨간 불) = 즉시 게인 감소

### 다이렉트 모니터링

- 오디오 인터페이스 Direct Monitoring ON
- GarageBand 소프트웨어 모니터링 OFF (레이턴시 방지)
- 헤드폰 볼륨: 오디오 인터페이스에서 조절

### 녹음 시작

1. R 키 또는 녹음 버튼(빨간 원) 클릭
2. 1~2소절 Count-in 후 노래 시작
3. Space 키로 녹음 정지

---

## GarageBand EQ 설정

고음역 컷이 전체 믹스에 투명감을 더해주는 경우가 많으므로 저역부터 정리하세요.

### Channel EQ 삽입

1. 트랙 선택 → Smart Controls 표시
2. EQ 버튼 클릭 → Channel EQ 창 열기

### 기본 보컬 EQ

1. HPF(고역 통과 필터): 80~100Hz에 걸기
2. 300~500Hz: 탁한 공명 좁은 Q로 -2~-4dB
3. 2~5kHz: 명료도 +1~2dB
4. 10kHz 이상: Shelf +1dB (공기감)

### EQ 팁

- '빼기' 우선: 부스트보다 불필요 주파수 컷
- 변화를 들으며 귀로 판단
- 변화가 작아도 누적 효과 있음

---

## GarageBand 컴프레서 설정

이펙트를 추가하기 전에 원음의 문제를 먼저 해결하는 것이 올바른 순서입니다.

### Compressor 삽입

1. Smart Controls → 플러그인 추가(+)
2. Compressor 선택

### 기본 보컬 컴프레서 값

- Threshold: -18dBFS
- Ratio: 3:1
- Attack: 15ms
- Release: 100ms
- Gain (Makeup): +3~5dB

### 컴프레서 확인

- 게인 리덕션 미터에서 -3~-6dB 정도 눌리면 적당
- 너무 많이 눌리면 Threshold 높이거나 Ratio 낮추기

---

## 파일 내보내기 (Export)

아래 내용은 특정 버전 기준이며, 업데이트 이후 인터페이스가 달라질 수 있습니다.

### 믹싱 의뢰용 내보내기

Share → Export Song to Disk
- **Format**: AIFF (또는 WAV 호환 확인)
- **Quality**: Lossless
- 저장 위치 선택 → Export 클릭

### 공유용 MP3 내보내기

Share → Export Song to Disk
- **Format**: MP3
- **Quality**: Highest (320kbps)

### 믹싱 의뢰 전달

- AIFF/WAV 파일 + MR 파일 함께 전달
- 구글 드라이브 또는 WeTransfer 업로드
- 파일명: [아티스트명]_[곡명]_vocal.aiff

---

## iOS GarageBand 보컬 녹음

트랙 색상과 명칭을 체계적으로 관리하면 복잡한 세션도 빠르게 파악할 수 있습니다.

### iOS 설정

1. Lightning/USB-C → 오디오 인터페이스 어댑터 연결
2. GarageBand → 오디오 레코더 트랙 선택
3. 마이크 아이콘 → 외부 마이크 선택
4. 입력 레벨 확인 후 녹음

### iOS 파일 내보내기

공유 버튼 → 노래 → 오디오 → Lossless
- 파일 앱 또는 iCloud Drive로 저장

---

## 마치며

GarageBand는 무료이지만 스튜디오 의뢰 가능한 드라이 보컬 녹음에 충분합니다.

---

[Logic Pro 보컬 녹음 완전 가이드](/stories/logicpro1) | [셀프 보컬 녹음 완전 가이드](/stories/self-recording1) | [홈 레코딩 완전 가이드](/stories/home-recording1) | [음원 파일 형식 완전 가이드](/stories/audio-format1) | [온라인 믹싱 의뢰 방법](/stories/onlinemix1) | [피아노 리듬감·리듬 훈련 음악연습실](/stories/practice-room-piano-rhythm1) | [기타 트레몰로·웜바 암 테크닉 음악연습실](/stories/practice-room-guitar-whammy1) | [보컬 다이나믹스·크레셴도 데크레셴도 음악연습실](/stories/practice-room-vocal-dynamics1) | [기타 줄 교체·스트링 선택 음악연습실](/stories/practice-room-guitar-string1) | [드럼 브러쉬·와이어 브러쉬 연주 음악연습실](/stories/practice-room-drum-brush1) | [피아노 즉흥 반주·코드 반주 음악연습실](/stories/practice-room-piano-sight-play1) | [베이스 코드·화음 연주 음악연습실](/stories/practice-room-bass-chord1) | [보컬 팔세토·가성 발성 음악연습실](/stories/practice-room-vocal-falsetto1) | [기타 탭핑·투핸드 태핑 음악연습실](/stories/practice-room-guitar-tapping1) | [피아노 듀엣·앙상블 개인 연습 음악연습실](/stories/practice-room-piano-duet1) | [드럼 폴리리듬·복잡박자 연습 음악연습실](/stories/practice-room-drum-polyrhythm1) | [보컬 어질리티·빠른 음계 훈련 음악연습실](/stories/practice-room-vocal-agility1) | [재즈 피아노 즉흥 솔로·임프로비제이션 음악연습실](/stories/practice-room-piano-jazz-improv1) | [기타 레가토·해머온 풀오프 연습 음악연습실](/stories/practice-room-guitar-legato1) | [베이스 펑크·R&B 그루브 음악연습실](/stories/practice-room-bass-funk1) | [보컬 프로젝션·소리 울림 훈련 음악연습실](/stories/practice-room-vocal-projection1) | [피아노 옥타브·넓은 음정 도약 연습 음악연습실](/stories/practice-room-piano-technique31) | [기타 슬라이드·슬라이드 기타 연습 음악연습실](/stories/practice-room-guitar-slide1) | [보컬 스타일 개발·장르별 창법 음악연습실](/stories/practice-room-vocal-style1) | [통기타 핑거피킹·핑거스타일 입문 음악연습실](/stories/practice-room-guitar-acoustic-fingerpick1) | [드럼 하이햇·심벌 컨트롤 음악연습실](/stories/practice-room-drum-hihat1) | [피아노 트릴·장식음 기법 음악연습실](/stories/practice-room-piano-trills1) | [기타 코드 진행·화성 이해 음악연습실](/stories/practice-room-guitar-chord-prog1) | [장르별 보컬 특성·크로스오버 보컬 음악연습실](/stories/practice-room-vocal-genre1) | [베이스 썸피킹·핑거스타일 혼합 음악연습실](/stories/practice-room-bass-thumb1) | [피아노 발라드 반주·감성 피아노 음악연습실](/stories/practice-room-piano-ballad21) | [기타 아르페지오·분산 화음 연습 음악연습실](/stories/practice-room-guitar-arpeggio1) | [보컬 녹음 준비·레코딩 보컬 음악연습실](/stories/practice-room-vocal-recording1) | [가스펠·CCM 피아노 반주 음악연습실](/stories/practice-room-piano-gospel1) | [기타 핑거스타일 고급·솔로 기타 편곡 음악연습실](/stories/practice-room-guitar-fingerpick-adv1) | [드럼 킥·베이스 드럼 테크닉 음악연습실](/stories/practice-room-drum-kick1) | [보컬 벨팅·파워 벨팅 음악연습실](/stories/practice-room-vocal-belting1) | [피아노 컴핑·재즈 반주 패턴 음악연습실](/stories/practice-room-piano-comping1) | [기타 피치카토·뮤트 주법 음악연습실](/stories/practice-room-guitar-mute1) | [연신내 음악연습실 안내](/stories/practice-room-yeonsinnae1) | [스튜디오 놀 이용 요금](/pricing)
