---
title: "Cubase 보컬 녹음 완전 가이드 — Steinberg DAW로 스튜디오급 보컬"
date: 2026-04-07
author: "스튜디오 놀"
category: "녹음 가이드"
tags: ["Cubase 보컬", "큐베이스 녹음", "Cubase 설정", "Steinberg DAW", "Cubase 믹싱", "Cubase EQ", "Cubase 컴프레서"]
thumbnail: "/images/portfolio2.webp"
summary: "Cubase 보컬 녹음 완전 가이드입니다. Cubase 기본 설정·오디오 트랙 생성 및 녹음·Channel EQ 설정·Compressor 설정·VariAudio — 내장 피치 교정·파일 내보내기 (Export)까지 정리합니다."
faq:
  - q: "Cubase로 보컬 녹음이 가능한가요?"
    a: "가능합니다. Cubase는 Steinberg가 개발한 업계 표준 DAW로 전문 스튜디오에서도 널리 사용됩니다. 강력한 내장 EQ·컴프레서와 VariAudio 피치 교정 기능으로 보컬 녹음·편집을 전문적으로 처리할 수 있습니다."
  - q: "Cubase에서 오디오 인터페이스를 설정하는 방법은?"
    a: "Studio Setup (F4 또는 Studio → Studio Setup) → Audio System → ASIO Driver(Windows) 또는 Core Audio(Mac)를 오디오 인터페이스로 설정합니다. Studio → Studio Setup → VST Audio System에서도 확인합니다."
  - q: "Cubase VariAudio란 무엇인가요?"
    a: "Cubase에 내장된 피치 교정 도구입니다. Sample Editor에서 활성화하면 보컬 음표를 시각적으로 편집할 수 있으며, Melodyne과 유사한 기능을 Cubase 내에서 별도 구매 없이 사용할 수 있습니다."
  - q: "Cubase 보컬 파일을 어떻게 내보내나요?"
    a: "File → Export → Audio Mixdown (Ctrl+Shift+E) → Format: WAV → Bit Depth: 24 bit → Sample Rate: 44100/48000 → Export Audio를 클릭합니다. 드라이 보컬은 플러그인 Bypass 후 트랙 Solo → Export합니다."
---
![Cubase 보컬 녹음 완전 가이드 — 스튜디오 놀](/images/portfolio2.webp)

## Cubase — 30년 역사의 전문 DAW

Steinberg Cubase는 1989년부터 업계를 이끌어온 DAW로, 유럽 스튜디오와 클래식 음악 프로덕션에서 특히 많이 사용됩니다.

---

## Cubase 기본 설정

이펙트를 추가하기 전에 원음의 문제를 먼저 해결하는 것이 올바른 순서입니다.

### 오디오 인터페이스 설정

1. 오디오 인터페이스 연결
2. Studio → Studio Setup (F4)
3. VST Audio System → ASIO Driver(Win) 또는 CoreAudio(Mac) 선택
4. 오디오 인터페이스 선택

### 버퍼·샘플레이트 설정

Studio Setup → Control Panel (Windows)
- Buffer Size: 녹음 시 64~256 samples
           믹싱 시 512~1024 samples
- Sample Rate: 44100Hz 또는 48000Hz

### 프로젝트 생성

File → New Project → Sample Rate 설정 → Create

---

## 오디오 트랙 생성 및 녹음

모노로 확인하면 스테레오에서 감춰진 문제를 더 빨리 발견할 수 있습니다.

### 트랙 생성

1. Project → Add Track → Audio
2. Configuration: Mono (보컬 단일 채널)
3. Input Routing: 오디오 인터페이스 입력 채널
4. Record Enable 버튼 클릭 (빨간 원)

### 게인 설정

- Input Level 미터: -12dBFS ~ -6dBFS 피크
- 클리핑 방지

### 다이렉트 모니터링

- 오디오 인터페이스 Direct Monitoring ON
- Cubase 소프트웨어 모니터링: OFF (레이턴시 방지)

### 녹음 시작

Numpad * 또는 Transport 녹음 버튼
Space 키로 정지

---

## Channel EQ 설정

바이패스로 전후 비교하는 습관이 과처리를 막는 가장 효과적인 방법입니다.

### Channel EQ 열기

트랙 헤더 → E(Edit Channel Settings) 클릭
- EQ 탭 활성화

### 기본 보컬 EQ

1. Low Cut (HPF): 80~100Hz
2. Low Mid: 300~500Hz, -2~-3dB (탁함)
3. High Mid: 2~4kHz, +1~2dB (명료도)
4. High (Shelf): 10kHz, +1dB (공기감)

### Spectrum Analyzer

EQ 창 내 Spectrum 버튼 ON → 실시간 확인
- **Q 값**: 높을수록 좁은 대역 (서지컬)

---

## Compressor 설정

같은 플러그인이라도 신호 체인의 어느 위치에 두느냐에 따라 결과가 크게 달라집니다.

### Compressor 삽입

Channel Insert 슬롯 → Dynamics → Compressor

### 기본 보컬 컴프레서 값

- Threshold: -18dB
- Ratio: 3:1
- Attack: 15ms
- Release: 100ms
- Make-up Gain: +3~5dB
- Soft Knee 활성화

### GR 미터 확인

- -3~-6dB 게인 리덕션: 적당
- Live 버튼으로 실시간 모니터링

---

## VariAudio — 내장 피치 교정

버스로 묶어 처리하면 개별 트랙 조정 없이도 전체 밸런스를 효율적으로 잡을 수 있습니다.

### VariAudio 활성화

1. 보컬 클립 더블클릭 → Sample Editor 열기
2. VariAudio 탭 클릭 → Analyze 클릭

### 피치 교정

- 각 음표 블록 표시 → 위아래 드래그로 교정
- Pitch & Warp 툴 선택
- Straighten Pitch: 0~100% 슬라이더 (100%=Auto-Tune 효과)
- 자연스러운 교정: 50~70% 권장

### 타이밍 교정

- VariAudio Warp 마커로 타이밍 교정 가능

---

## 파일 내보내기 (Export)

각 파라미터가 사운드에 미치는 영향을 이해하면 설정값을 외우지 않아도 귀로 판단할 수 있습니다.

### Audio Mixdown 내보내기

File → Export → Audio Mixdown (Ctrl+Shift+E)
- **File Format**: WAV
- **Bit Depth**: 24 Bit
- **Sample Rate**: 44100Hz 또는 48000Hz
- **Channel Selection**: 트랙 Solo 확인
- Export Audio 클릭

### 드라이 보컬 내보내기

1. 보컬 트랙 Solo
2. Channel Inserts 전체 Bypass
3. Audio Mixdown → WAV 24bit

### 파일 전달

- **파일명**: [아티스트명]_[곡명]_vocal.wav

---

## 마치며

Cubase는 VariAudio 피치 교정과 정밀한 오디오 편집 기능으로 전문적인 보컬 작업에 최적화된 DAW입니다.

---

[Reaper 보컬 녹음 완전 가이드](/stories/reaper1) | [Studio One 보컬 녹음 완전 가이드](/stories/studioone1) | [Pro Tools 보컬 녹음 완전 가이드](/stories/protools1) | [음원 파일 형식 완전 가이드](/stories/audio-format1) | [온라인 믹싱 의뢰 방법](/stories/onlinemix1) | [피아노 리듬감·리듬 훈련 음악연습실](/stories/practice-room-piano-rhythm1) | [기타 트레몰로·웜바 암 테크닉 음악연습실](/stories/practice-room-guitar-whammy1) | [보컬 다이나믹스·크레셴도 데크레셴도 음악연습실](/stories/practice-room-vocal-dynamics1) | [기타 줄 교체·스트링 선택 음악연습실](/stories/practice-room-guitar-string1) | [드럼 브러쉬·와이어 브러쉬 연주 음악연습실](/stories/practice-room-drum-brush1) | [피아노 즉흥 반주·코드 반주 음악연습실](/stories/practice-room-piano-sight-play1) | [베이스 코드·화음 연주 음악연습실](/stories/practice-room-bass-chord1) | [보컬 팔세토·가성 발성 음악연습실](/stories/practice-room-vocal-falsetto1) | [기타 탭핑·투핸드 태핑 음악연습실](/stories/practice-room-guitar-tapping1) | [피아노 듀엣·앙상블 개인 연습 음악연습실](/stories/practice-room-piano-duet1) | [드럼 폴리리듬·복잡박자 연습 음악연습실](/stories/practice-room-drum-polyrhythm1) | [보컬 어질리티·빠른 음계 훈련 음악연습실](/stories/practice-room-vocal-agility1) | [재즈 피아노 즉흥 솔로·임프로비제이션 음악연습실](/stories/practice-room-piano-jazz-improv1) | [기타 레가토·해머온 풀오프 연습 음악연습실](/stories/practice-room-guitar-legato1) | [베이스 펑크·R&B 그루브 음악연습실](/stories/practice-room-bass-funk1) | [보컬 프로젝션·소리 울림 훈련 음악연습실](/stories/practice-room-vocal-projection1) | [피아노 옥타브·넓은 음정 도약 연습 음악연습실](/stories/practice-room-piano-technique31) | [기타 슬라이드·슬라이드 기타 연습 음악연습실](/stories/practice-room-guitar-slide1) | [보컬 스타일 개발·장르별 창법 음악연습실](/stories/practice-room-vocal-style1) | [통기타 핑거피킹·핑거스타일 입문 음악연습실](/stories/practice-room-guitar-acoustic-fingerpick1) | [드럼 하이햇·심벌 컨트롤 음악연습실](/stories/practice-room-drum-hihat1) | [피아노 트릴·장식음 기법 음악연습실](/stories/practice-room-piano-trills1) | [기타 코드 진행·화성 이해 음악연습실](/stories/practice-room-guitar-chord-prog1) | [장르별 보컬 특성·크로스오버 보컬 음악연습실](/stories/practice-room-vocal-genre1) | [베이스 썸피킹·핑거스타일 혼합 음악연습실](/stories/practice-room-bass-thumb1) | [피아노 발라드 반주·감성 피아노 음악연습실](/stories/practice-room-piano-ballad21) | [기타 아르페지오·분산 화음 연습 음악연습실](/stories/practice-room-guitar-arpeggio1) | [보컬 녹음 준비·레코딩 보컬 음악연습실](/stories/practice-room-vocal-recording1) | [가스펠·CCM 피아노 반주 음악연습실](/stories/practice-room-piano-gospel1) | [기타 핑거스타일 고급·솔로 기타 편곡 음악연습실](/stories/practice-room-guitar-fingerpick-adv1) | [드럼 킥·베이스 드럼 테크닉 음악연습실](/stories/practice-room-drum-kick1) | [보컬 벨팅·파워 벨팅 음악연습실](/stories/practice-room-vocal-belting1) | [피아노 컴핑·재즈 반주 패턴 음악연습실](/stories/practice-room-piano-comping1) | [기타 피치카토·뮤트 주법 음악연습실](/stories/practice-room-guitar-mute1) | [베이스 핑거링·오른손 테크닉 음악연습실](/stories/practice-room-bass-fingering1) | [보컬 스타카토·단음 발성 훈련 음악연습실](/stories/practice-room-vocal-staccato1) | [드럼 심벌·크래쉬·라이드 테크닉 음악연습실](/stories/practice-room-drum-cymbal1) | [피아노 크로스 핸드·교차 손 훈련 음악연습실](/stories/practice-room-piano-crosshand1) | [기타 스케일 연습·포지션 이동 음악연습실](/stories/practice-room-guitar-scale-pos1) | [보컬 레가토·이어 부르기 훈련 음악연습실](/stories/practice-room-vocal-legato1) | [피아노 연탄·네 손 피아노 음악연습실](/stories/practice-room-piano-four-hands1) | [기타 핑거링·왼손 독립 훈련 음악연습실](/stories/practice-room-guitar-left-hand1) | [보컬 오버톤·배음 발성 훈련 음악연습실](/stories/practice-room-vocal-overtone1) | [드럼 스네어·림샷 테크닉 음악연습실](/stories/practice-room-drum-snare1) | [기타 왼손 비브라토·핑거 비브라토 음악연습실](/stories/practice-room-guitar-finger-vibrato1) | [피아노 루바토·음악적 템포 표현 음악연습실](/stories/practice-room-piano-rubato1) | [베이스 이펙터·페달 보드 활용 음악연습실](/stories/practice-room-bass-effects1) | [보컬 크루닝·저음 보컬 테크닉 음악연습실](/stories/practice-room-vocal-crooning1) | [피아노 소나타·클래식 소나타 형식 연습 음악연습실](/stories/practice-room-piano-sonata1) | [기타 재즈 코드·재즈 보이싱 음악연습실](/stories/practice-room-guitar-jazz-chord1) | [드럼 빠른 템포·스피드 훈련 음악연습실](/stories/practice-room-drum-speed1) | [보컬 중음역 강화·미들 보이스 음악연습실](/stories/practice-room-vocal-middle1) | [피아노 에튀드·기법 연습곡 음악연습실](/stories/practice-room-piano-etude1) | [기타 오픈 튜닝·슬라이드 오픈 튜닝 음악연습실](/stories/practice-room-guitar-open-tuning1) | [보컬 앙상블·코러스 개인 파트 훈련 음악연습실](/stories/practice-room-vocal-ensemble1) | [베이스 픽 주법·픽 베이스 연습 음악연습실](/stories/practice-room-bass-pick1) | [드럼 카운트·리듬 카운팅 훈련 음악연습실](/stories/practice-room-drum-count1) | [피아노 반음계·크로매틱 스케일 음악연습실](/stories/practice-room-piano-chromatic1) | [기타 핑거링 스트레칭·손가락 유연성 음악연습실](/stories/practice-room-guitar-stretch1) | [보컬 피치 컨트롤·음정 정확도 고급 훈련 음악연습실](/stories/practice-room-vocal-pitch1) | [베이스 슬라이드·포르타멘토 베이스 음악연습실](/stories/practice-room-bass-slide1) | [피아노 다이나믹·강약 표현 음악연습실](/stories/practice-room-piano-dynamics1) | [드럼 고스트 노트·유령음 훈련 음악연습실](/stories/practice-room-drum-ghost1) | [기타 코드 아르페지오·코드 분산 연주 음악연습실](/stories/practice-room-guitar-chord-arpeggio1) | [보컬 구음·솔페지오 훈련 음악연습실](/stories/practice-room-vocal-solfege1) | [피아노 폴리포니·독립 성부 연주 음악연습실](/stories/practice-room-piano-polyphony1) | [기타 리프·반복 패턴 작성 음악연습실](/stories/practice-room-guitar-riff1) | [드럼 오프비트·엇박 리듬 훈련 음악연습실](/stories/practice-room-drum-offbeat1) | [보컬 호흡 발음·자음 명료도 훈련 음악연습실](/stories/practice-room-vocal-consonant1) | [피아노 전조·조바꿈 연습 음악연습실](/stories/practice-room-piano-modulation1) | [기타 핑거피킹 패턴 다양화 음악연습실](/stories/practice-room-guitar-fingerpick-pattern1) | [베이스 뮤팅·노이즈 컨트롤 음악연습실](/stories/practice-room-bass-muting1) | [드럼 더블킥·더블 베이스 드럼 훈련 음악연습실](/stories/practice-room-drum-doublekick1) | [피아노 재즈 스탠다드·재즈 레퍼토리 음악연습실](/stories/practice-room-piano-jazz-standard1) | [보컬 라이브 퍼포먼스·공연 전 루틴 음악연습실](/stories/practice-room-vocal-live1) | [기타 뮤직 메모리·악보 없이 연주하기 음악연습실](/stories/practice-room-guitar-memory1) | [피아노 연속 도약·넓은 음정 점프 음악연습실](/stories/practice-room-piano-leaps1) | [드럼 크레셴도·다이나믹 빌드업 음악연습실](/stories/practice-room-drum-buildup1) | [베이스 펜타토닉·베이스 스케일 활용 음악연습실](/stories/practice-room-bass-pentatonic1) | [보컬 감정 표현·가사 해석 훈련 음악연습실](/stories/practice-room-vocal-emotion1) | [기타 해머온·풀오프 연속 훈련 음악연습실](/stories/practice-room-guitar-hammer-pull1) | [피아노 내성부·보조 선율 연습 음악연습실](/stories/practice-room-piano-inner-voice1) | [드럼 림샷·크로스스틱 고급 훈련 음악연습실](/stories/practice-room-drum-rimshot-adv1) | [보컬 뮤지컬 스타일·역할 보컬 훈련 음악연습실](/stories/practice-room-vocal-musical-style1) | [베이스 슬랩·팝핑 고급 테크닉 음악연습실](/stories/practice-room-bass-slap-adv1) | [피아노 초견 고급·빠른 악보 읽기 음악연습실](/stories/practice-room-piano-sight-adv1) | [드럼 타이밍·포켓 그루브 훈련 음악연습실](/stories/practice-room-drum-timing1) | [보컬 호흡·성대 컨트롤 고급 훈련 음악연습실](/stories/practice-room-vocal-breath-adv1) | [기타 비브라토·피치 컨트롤 음악연습실](/stories/practice-room-guitar-vibrato1) | [피아노 화성·코드 고급 이론 음악연습실](/stories/practice-room-piano-chord-adv1) | [재즈 베이스·워킹 베이스 고급 음악연습실](/stories/practice-room-bass-jazz1) | [보컬 음색 개발·개성 있는 목소리 훈련 음악연습실](/stories/practice-room-vocal-color-adv1) | [드럼 선형 리듬·리니어 드러밍 음악연습실](/stories/practice-room-drum-linear1) | [피아노 고급 테크닉·연주 기법 종합 음악연습실](/stories/practice-room-piano-technique-adv1) | [기타 코드 고급·확장 코드 연주 음악연습실](/stories/practice-room-guitar-chord-adv1) | [보컬 레지스터·성구 전환 훈련 음악연습실](/stories/practice-room-vocal-register1) | [베이스 루트 노트·코드 읽기 고급 음악연습실](/stories/practice-room-bass-root-adv1) | [피아노 터치·아티큘레이션 훈련 음악연습실](/stories/practice-room-piano-touch1) | [재즈 드럼 고급·스윙 필 심화 음악연습실](/stories/practice-room-drum-jazz-adv1) | [보컬 무대 퍼포먼스 고급·스테이지 존재감 음악연습실](/stories/practice-room-vocal-stage-adv1) | [기타 즉흥 연주·임프로비제이션 음악연습실](/stories/practice-room-guitar-improv1) | [성인 피아노 입문·처음 시작하는 어른 음악연습실](/stories/practice-room-piano-beginner-adult1) | [드럼 악센트·강세 패턴 훈련 음악연습실](/stories/practice-room-drum-accent1) | [베이스 옥타브 주법·옥타브 그루브 음악연습실](/stories/practice-room-bass-octave1) | [피아노 음정·인터벌 훈련 음악연습실](/stories/practice-room-piano-interval1) | [보컬 오디션 준비·심사 기준 이해 음악연습실](/stories/practice-room-vocal-audition1) | [기타 핑거스타일 고급 테크닉 음악연습실](/stories/practice-room-guitar-fingerstyle-adv1) | [베이스 플래절렛·하모닉스 주법 음악연습실](/stories/practice-room-bass-harmonic1) | [피아노 페달 테크닉·소스텐우토 음악연습실](/stories/practice-room-piano-pedal1) | [피아노 스케일·아르페지오 고급 훈련 음악연습실](/stories/practice-room-piano-scale-adv1) | [베이스 타핑·투핸드 테크닉 음악연습실](/stories/practice-room-bass-tapping1) | [보컬 리듬·박자감 훈련 음악연습실](/stories/practice-room-vocal-rhythm1) | [기타 재즈 보이싱·코드 멜로디 음악연습실](/stories/practice-room-guitar-jazz-voicing1) | [피아노 즉흥 연주·재즈 피아노 음악연습실](/stories/practice-room-piano-jazz1) | [보컬 코러스·하모니 훈련 음악연습실](/stories/practice-room-vocal-harmony1) | [드럼 더블 킥·더블 페달 훈련 음악연습실](/stories/practice-room-drum-double-kick1) | [보컬 마이크 테크닉·PA 활용 음악연습실](/stories/practice-room-vocal-mic1) | [피아노 협주곡·오케스트라 반주 연습 음악연습실](/stories/practice-room-piano-concerto1) | [드럼 필인·트랜지션 고급 훈련 음악연습실](/stories/practice-room-drum-fill-adv1) | [베이스 컨트리·록어빌리 주법 음악연습실](/stories/practice-room-bass-country1) | [기타 피킹 테크닉 고급 훈련 음악연습실](/stories/practice-room-guitar-picking-adv1) | [연신내 음악연습실 안내](/stories/practice-room-yeonsinnae1) | [스튜디오 놀 이용 요금](/pricing)
