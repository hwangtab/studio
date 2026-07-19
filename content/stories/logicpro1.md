---
title: Logic Pro 보컬 녹음 완전 가이드 — Mac 전용 DAW로 프로급 녹음
date: 2026-04-07
author: 스튜디오 놀
category: 녹음 가이드
tags:
  - Logic Pro 보컬
  - 로직 프로 녹음
  - Logic Pro 설정
  - 맥 DAW 녹음
  - Logic Pro 믹싱
  - Logic Pro EQ
  - Logic Pro 컴프레서
thumbnail: /images/room8.webp
summary: >-
  Logic Pro 보컬 녹음 준비 기준을 녹음 전 준비물, 세션 진행, 결과물 확인 포인트에 맞춰 정리합니다. 연신내 Studio NOL의 장비와 엔지니어링 관점도 함께 확인하세요.
faq:
  - q: Logic Pro로 고퀄리티 보컬 녹음이 가능한가요?
    a: >-
      가능합니다. Logic Pro는 전문 스튜디오에서도 사용하는 Mac 전용 DAW로, 고급 EQ·컴프레서·Flex Pitch 피치
      교정·Space Designer 리버브 등 전문 녹음에 필요한 모든 기능을 갖추고 있습니다.
  - q: Logic Pro에서 오디오 인터페이스를 연결하는 방법은?
    a: >-
      오디오 인터페이스를 USB/Thunderbolt로 Mac에 연결 후, Logic Pro → 환경설정(Preferences) →
      Audio 탭에서 입력·출력 장치를 오디오 인터페이스로 설정합니다.
  - q: Logic Pro Flex Pitch는 무엇인가요?
    a: >-
      Logic Pro에 내장된 피치 교정 도구입니다. Melodyne과 유사하게 각 음표의 피치를 시각적으로 편집할 수 있으며, 별도
      구매 없이 Logic Pro에 포함되어 있습니다.
  - q: Logic Pro 보컬 파일을 믹싱 의뢰용으로 어떻게 내보내나요?
    a: >-
      File → Bounce → Project or Section → Format: WAV → Bit Depth: 24 → Sample
      Rate: 44.1kHz 또는 48kHz로 설정 후 Bounce 클릭. 믹싱 의뢰 시 플러그인 없는 드라이(Dry) 보컬 WAV
      파일로 내보내세요.
---
![Logic Pro 보컬 녹음 완전 가이드 — 스튜디오 놀](/images/room8.webp)

## Logic Pro — Mac 전용 프로급 DAW

Logic Pro는 Apple 생태계에 최적화된 Mac 전용 유료 DAW로, 전문 스튜디오와 홈 레코딩 모두에서 널리 사용됩니다.

Logic Pro의 역사는 1993년 독일 Emagic이 Logic Audio로 출시하면서 시작됩니다. 당초 Atari ST·Macintosh용 MIDI 시퀀서로 출발했고, 1999년 오디오 멀티트랙 기능이 강화되면서 유럽 음악 프로덕션 씬에서 Pro Tools의 대안으로 자리잡았습니다. 2002년 Apple이 Emagic을 인수해 Logic을 Mac 전용으로 전환하고 Windows 버전을 단종했으며, 2004년 Logic Pro 7에서 Space Designer 리버브와 Sculpture 신시사이저를 내장해 스튜디오 품질의 플러그인 번들을 제공했습니다. 2013년 Logic Pro X 출시로 드럼머신 Drummer·악보 편집·Flex Pitch 피치 교정이 통합됐고, 현재 한국의 K-POP 제작사·인디 아티스트·영상 음악 작업자들이 Final Cut Pro와의 통합 워크플로우로 Logic Pro를 사용합니다.

---

## Logic Pro 기본 설정

### 오디오 인터페이스 설정

1. 오디오 인터페이스 USB/Thunderbolt 연결
2. Logic Pro → 환경설정(Preferences) → Audio
3. 입력 장치: 오디오 인터페이스 선택
   출력 장치: 오디오 인터페이스 또는 헤드폰

### 샘플레이트·버퍼 설정

- 샘플레이트: 48kHz (또는 44.1kHz)
- 버퍼 사이즈 (I/O Buffer Size)
  - 녹음 시: 64~128 samples (레이턴시 최소화)
  - 믹싱 시: 256~512 samples (CPU 효율화)

### 프로젝트 생성

File → New Project → 샘플레이트 설정 후 생성

---

## 오디오 트랙 생성 및 녹음

### 트랙 생성

1. Track → New Track (Option+Cmd+A)
2. Audio 선택 → 입력 채널 확인
3. 레코드 Arm 버튼 클릭 (빨간 원)

### 게인 설정

- Input Monitoring ON → 보컬 레벨 확인
- 보컬 피크: -12dBFS ~ -6dBFS
- 클리핑(빨간 불) 발생 시 즉시 게인 감소

### 다이렉트 모니터링

- 오디오 인터페이스 Direct Monitoring ON
- Logic Pro 소프트웨어 모니터링 OFF (레이턴시 방지)

### 녹음 시작

1. R 키 또는 녹음 버튼 클릭
2. 1~2소절 Count-in 후 노래 시작
3. Space 키로 녹음 정지

---

## Logic Pro Channel EQ 설정

### Channel EQ 삽입

1. 트랙 선택 → Smart Controls (B키)
2. EQ 썸네일 클릭 → Channel EQ 창 열기

### 기본 보컬 EQ

1. HPF(고역 통과 필터): 80~100Hz에 걸기
2. 200~300Hz: 탁한 공명 좁은 Q로 -2~-3dB
3. 1~3kHz: 명료도 +1~2dB
4. 10kHz Shelf: +1dB (공기감)

### EQ 팁

- Analyzer ON → 실시간 주파수 시각화 확인
- '빼기' 우선: 부스트보다 문제 주파수 컷
- Q값 좁게 → 서지컬, Q값 넓게 → 음색 조형

---

## Logic Pro 컴프레서 설정

### Compressor 삽입

1. Smart Controls → 플러그인 탭
2. Dynamics → Compressor 추가

### 기본 보컬 컴프레서 값

- Threshold: -18dBFS
- Ratio: 3:1
- Attack: 15ms
- Release: 100ms
- Knee: Soft (2~4)
- Makeup Gain: +3~5dB

### 확인

- GR 미터에서 -3~-6dB 눌리면 적당
- Platinum Digital → Vintage VCA (선택 가능)

---

## Flex Pitch — 내장 피치 교정

### Flex Pitch 활성화

1. 트랙 선택 → Track → Show Flex Pitch/Time (Cmd+F)
2. 리전(Region) 더블클릭 → 피치 편집 뷰 열기

### 피치 교정

- 각 음표 블록 표시 → 드래그로 피치 교정
- Pitch Correction 슬라이더: 50~70 (자연스러운 교정)
- 100으로 올리면 Auto-Tune 효과

### 주의사항

- 드라이 보컬에만 적용 (리버브 전 단계)
- 과도 교정 시 로봇 소리 방지 위해 50~80 유지

---

## 파일 내보내기 (Bounce)

### 믹싱 의뢰용 내보내기

File → Bounce → Project or Section

- **Format**: WAV
- **Bit Depth**: 24
- **Sample Rate**: 44.1kHz 또는 48kHz
- **Dithering**: UV22HR
- Bounce 클릭

### 드라이 보컬 내보내기

- 플러그인 Bypass 후 Bounce (Dry 상태)
- 또는 트랙 Solo → Bounce in Place

### 믹싱 의뢰 전달

- WAV 파일 + MR 파일 함께 전달
- 구글 드라이브 또는 WeTransfer 업로드
- 파일명: [아티스트명]_[곡명]_vocal.wav

---

## 마치며

Logic Pro는 Flex Pitch·Space Designer·Channel EQ 등 전문 플러그인을 기본 내장해 홈 레코딩에서 프로급 품질을 실현할 수 있습니다. 녹음 시 버퍼 사이즈를 64~128 samples로 설정해 레이턴시를 최소화하고, 믹싱 단계에서는 256~512 samples로 높여 CPU 부하를 줄이는 것이 표준 워크플로우입니다. 오디오 인터페이스의 Direct Monitoring을 켜고 Logic Pro 소프트웨어 모니터링은 끄면 레이턴시 없이 실시간 모니터링이 가능합니다.

Flex Pitch로 피치를 교정할 때는 Pitch Correction 슬라이더를 50~70 수준으로 유지하면 자연스러운 교정이 됩니다. 100으로 올리면 Auto-Tune 이펙트가 발생합니다. 믹싱 의뢰용 드라이 보컬 파일은 플러그인을 Bypass한 뒤 File → Bounce → WAV/24bit/48kHz로 내보내고, 파일명은 [아티스트명]_[곡명]_vocal.wav 형식으로 저장해 MR 파일과 함께 전달합니다.

## 잘 녹음된 드라이 보컬 하나가 플러그인 열 개를 이깁니다

집에서 로직으로 녹음한 파일을 받아 열어보면, 결과를 가르는 건 대부분 이미 '녹음 단계'에서 끝나 있습니다. 아무리 좋은 EQ와 컴프레서가 있어도 들어온 소스가 클리핑됐거나 너무 작게 녹음돼 있으면 되살릴 방법이 없습니다. 그래서 로직 세팅 이야기가 나오면 저는 플러그인보다 게인부터 봅니다.

본문에 적은 대로 보컬 피크는 -12dBFS에서 -6dBFS 사이에 두는 게 안전합니다. 여기서 핵심은 '크게 녹음하려 애쓰지 말 것'입니다. 24비트로 녹음하면 조금 작게 들어와도 나중에 올릴 헤드룸이 충분한데, 욕심내서 게인을 올렸다가 빨간 불이 한 번 뜨면 그 테이크는 버려야 합니다. 인터페이스 다이렉트 모니터링을 켜고 로직 소프트웨어 모니터링을 끄라는 것도 같은 맥락입니다. 레이턴시 때문에 발성이 흔들리면 게인보다 더 근본적인 문제가 생깁니다.

믹싱을 남에게 맡길 생각이라면 파일 상태가 곧 예의입니다. 플러그인을 전부 바이패스한 드라이 보컬을 WAV 24비트로 바운스하고, 파일명은 본문처럼 아티스트_곡명_vocal 형식으로 정리해 MR과 함께 보내면 받는 사람이 헤매지 않습니다. 반대로 집에서 아무리 게인을 맞춰도 소스가 자꾸 흔들린다면, 방음과 마이크가 갖춰진 환경에서 한 번 제대로 잡는 게 결국 빠릅니다. 그 기준은 [녹음 안내](/pricing)에 정리해 뒀습니다.

---

[Ableton Live 보컬 녹음 완전 가이드](/stories/ableton1) | [GarageBand 보컬 녹음 완전 가이드](/stories/garageband1) | [홈 레코딩 완전 가이드](/stories/home-recording1) | [음원 파일 형식 완전 가이드](/stories/audioformat1)
