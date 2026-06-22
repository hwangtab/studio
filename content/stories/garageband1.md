---
title: GarageBand 보컬 녹음 완전 가이드 — 무료 DAW로 고퀄리티 녹음
date: 2026-04-07
author: 스튜디오 놀
category: 녹음 가이드
tags:
  - GarageBand 보컬
  - 가라지밴드 녹음
  - GarageBand 설정
  - 맥 보컬 녹음
  - 무료 DAW 녹음
  - GarageBand 믹싱
  - iOS GarageBand
thumbnail: /images/room6.webp
summary: >-
  GarageBand 보컬 녹음 준비 기준을 녹음 전 준비물, 세션 진행, 결과물 확인 포인트에 맞춰 정리합니다. 연신내 Studio NOL의 장비와 엔지니어링 관점도 함께 확인하세요.
faq:
  - q: GarageBand로 고퀄리티 보컬 녹음이 가능한가요?
    a: >-
      가능합니다. GarageBand는 전문 DAW 수준의 녹음·편집 기능을 무료로 제공합니다. 좋은 마이크와 오디오 인터페이스, 방음
      처리가 갖춰지면 스튜디오 의뢰 수준의 드라이 보컬을 얻을 수 있습니다.
  - q: GarageBand에서 오디오 인터페이스를 연결하는 방법은?
    a: >-
      오디오 인터페이스를 USB로 Mac에 연결 후, GarageBand 환경설정(Preferences) → Audio/MIDI 탭에서
      입력·출력 장치를 오디오 인터페이스로 설정합니다. iOS는 Lightning/USB-C 어댑터를 통해 연결합니다.
  - q: GarageBand에서 EQ와 컴프레서를 어떻게 사용하나요?
    a: >-
      트랙 헤더 영역에서 'Smart Controls' 또는 플러그인 메뉴(+)를 열고 EQ, Compressor를 추가합니다.
      Channel EQ(그래픽 EQ)와 Compressor는 GarageBand에 기본 내장되어 있습니다.
  - q: GarageBand 녹음 파일을 믹싱 의뢰용으로 어떻게 내보내나요?
    a: >-
      Share → Export Song to Disk → Lossless(AIFF 또는 WAV)로 내보냅니다. 믹싱 의뢰 시에는 무손실
      파일(WAV 또는 AIFF 24bit)로 내보내서 전달하세요.
---
![GarageBand 보컬 녹음 완전 가이드 — 스튜디오 놀](/images/room6.webp)

## GarageBand — Mac·iOS에서 무료로 전문 녹음

GarageBand는 Apple 기기에 기본 탑재된 무료 DAW로, 초보자부터 중급자까지 바로 사용할 수 있는 탄탄한 녹음 환경을 제공합니다.

GarageBand의 역사는 2004년 Apple이 Mac용 iLife 번들 소프트웨어로 처음 출시하면서 시작됩니다. Steve Jobs가 Macworld Expo에서 직접 시연했으며, 기존 프로 DAW에 비해 직관적인 인터페이스로 비전문가가 바로 음악 제작을 시작할 수 있게 했습니다. 2011년 iOS용 GarageBand가 출시되면서 스마트폰으로 음악 제작이 가능해졌고, 2012년부터 Mac App Store에서 무료로 배포되기 시작했습니다. Billie Eilish·Tones and I 등 글로벌 아티스트들이 GarageBand를 제작 도구로 사용했다고 밝히면서 무료 DAW의 가능성이 재평가됐으며, 현재 GarageBand로 녹음한 드라이 보컬 파일이 전문 스튜디오 믹싱 의뢰 납품 파일로 활용되는 사례도 많습니다.

## GarageBand 기본 설정 (Mac)

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

GarageBand는 무료이지만 스튜디오 의뢰용 드라이 보컬 녹음에 충분한 기능을 갖추고 있습니다. 녹음 시 버퍼 크기를 64~128 samples로 설정해 레이턴시를 최소화하고, 믹싱 단계에서는 256~512 samples로 높여 CPU 부하를 줄이는 것이 표준 워크플로우입니다. 오디오 인터페이스의 Direct Monitoring을 켜고 GarageBand 소프트웨어 모니터링은 끄면 레이턴시 없이 실시간 모니터링이 가능합니다.

EQ 설정에서는 HPF를 80~100Hz에 걸어 불필요한 저역을 정리한 뒤, 2~5kHz 대역을 +1~2dB 부스트해 명료도를 높이고 10kHz 이상 Shelf를 +1dB 올려 공기감을 더하는 것이 기본입니다. 컴프레서는 Threshold -18dBFS·Ratio 3:1·Attack 15ms·Release 100ms로 설정하면 게인 리덕션 미터에서 -3~-6dB 수준으로 눌려 자연스러운 다이나믹이 유지됩니다. 믹싱 의뢰용 드라이 보컬 파일은 Share → Export Song to Disk → AIFF/WAV Lossless로 내보내어 전달하고, iOS에서는 Lightning 또는 USB-C 어댑터로 오디오 인터페이스를 연결한 뒤 '공유 → 노래 → 오디오 → Lossless' 경로로 무손실 파일을 저장할 수 있습니다.

## Studio NOL이 개러지밴드 사용자에게 자주 권하는 3가지

스튜디오 놀(연신내, 서울 은평구)에서 GarageBand 보컬 녹음 상담 때 자주 드리는 조언입니다.

**1. HPF 80~100Hz — 보컬 저역 정리**

보컬 트랙에 HPF 80~100Hz 적용. 불필요한 저역 정리.

**2. 컴프레서 — Ratio 3:1, Attack 15ms**

GarageBand 컴프 표준 설정: Threshold -18dBFS, Ratio 3:1, Attack 15ms, Release 100ms.

**3. 믹싱 의뢰 — AIFF/WAV Lossless 내보내기**

Share → Export Song to Disk → AIFF/WAV Lossless로 무손실 파일 전달.

---

[Logic Pro 보컬 녹음 완전 가이드](/stories/logicpro1) | [셀프 보컬 녹음 완전 가이드](/stories/self-recording1) | [홈 레코딩 완전 가이드](/stories/home-recording1) | [음원 파일 형식 완전 가이드](/stories/audioformat1)
