---
title: "마스터링 팁 완전 가이드 — 스트리밍 최적화·LUFS·리미터 실전 설정"
date: 2026-04-06
author: "스튜디오 놀"
category: "강좌"
tags: ["마스터링 팁", "스트리밍 마스터링", "LUFS 설정", "마스터 리미터", "마스터링 EQ", "마스터링 체인", "음반 마스터링"]
thumbnail: "/images/recording8.webp"
summary: "마스터링 팁 완전 가이드입니다. 스트리밍 플랫폼 LUFS 기준, 마스터 EQ·컴프레서·리미터 설정값, 레퍼런스 트랙 활용법, 최종 납품 파일 포맷을 정리합니다."
faq:
  - q: "스포티파이·멜론·유튜브 마스터링 LUFS 기준은?"
    a: "스포티파이는 -14 LUFS, 애플뮤직 -16 LUFS, 유튜브 -14 LUFS, 멜론·지니 등 한국 스트리밍은 -14 LUFS 전후가 표준입니다. 플랫폼들은 라우드니스 노멀라이제이션으로 기준보다 큰 음원은 자동으로 볼륨을 낮춥니다."
  - q: "마스터링 체인 순서는 어떻게 구성하나요?"
    a: "일반적인 마스터링 체인은 EQ → 컴프레서 → 새츄레이터(선택) → EQ → 스테레오 이미저(선택) → 리미터 순서입니다. EQ로 주파수를 정리하고, 컴프레서로 다이나믹을 조절한 후, 리미터로 최종 피크를 제어합니다."
  - q: "레퍼런스 트랙은 왜 필요한가요?"
    a: "레퍼런스 트랙은 마스터링 중 사운드 균형의 기준이 됩니다. 같은 장르의 잘 마스터링된 상업 음원을 레퍼런스로 활용해 EQ 밸런스, 다이나믹, 스테레오 폭을 비교하면 더 객관적인 판단이 가능합니다."
  - q: "마스터링 후 납품 파일 포맷은 무엇인가요?"
    a: "스트리밍용은 WAV 44.1kHz 16-bit 또는 24-bit, 스트리밍 업로드용 MP3 320kbps가 표준입니다. 음반 CD 제작은 Red Book 규격(44.1kHz 16-bit WAV)이 필요합니다."
---
![마스터링 팁 완전 가이드 — 스튜디오 놀](/images/recording8.webp)

## 마스터링 — 믹스를 완성하는 마지막 단계

마스터링은 믹싱이 완성된 음원을 스트리밍·음반 배포에 최적화된 최종 파일로 만드는 과정입니다. LUFS 기준, 리미터 설정, 레퍼런스 트랙 활용이 핵심입니다.

---

## 스트리밍 플랫폼 LUFS 기준

모노로 확인하면 스테레오에서 감춰진 문제를 더 빨리 발견할 수 있습니다.

### 주요 플랫폼 타깃 LUFS

- **스포티파이**: -14 LUFS
- **애플뮤직**: -16 LUFS
- **유튜브**: -14 LUFS
- **아마존 뮤직**: -14 LUFS
- **멜론·지니·네이버 뮤직**: -14 LUFS 전후
- **타이달**: -14 LUFS

### LUFS vs 피크 레벨

- **Integrated LUFS**: 전체 평균 라우드니스
- **True Peak**: 샘플간 피크 (최대 -1dBTP 권장)
- **Short-term LUFS**: 3초 평균

### 라우드니스 노멀라이제이션

- **기준보다 큰 음원**: 플랫폼에서 볼륨 다운
- **기준보다 작은 음원**: 볼륨 업 또는 유지
- 타깃보다 2~3dB 낮게 마스터링해도 무방

---

## 마스터링 체인 구성

같은 플러그인이라도 신호 체인의 어느 위치에 두느냐에 따라 결과가 크게 달라집니다.

### 표준 마스터링 체인

1. EQ (1차)
  - 5Hz 이하 하이패스 (DC 오프셋 제거)
  - 문제 주파수 서지컬 컷
  - 전체 밸런스 조정

2. 컴프레서
  - **Ratio**: 1.5:1~3:1 (부드럽게)
  - **Attack**: 느리게 (50~100ms)
  - **GR**: 1~3dB (자연스럽게)

3. 새츄레이터 (선택)
  - 아날로그 따뜻함 추가
  - 테이프 새츄레이터 미적용 시 건너뜀

4. EQ (2차)
  - 고역 에어 추가 (8~16kHz)
  - 저역 정리 (40~60Hz 이하)

5. 스테레오 이미저 (선택)
  - 스테레오 폭 조절
  - 저역은 모노, 고역은 넓게

6. 리미터
  - 최종 피크 제어
  - **True Peak**: -1.0dBTP
  - LUFS 타깃에 맞게 출력 조절

---

## 레퍼런스 트랙 활용

볼륨 자동화를 활용하면 이펙트에 의존하지 않고도 다이나믹을 자연스럽게 만들 수 있습니다.

### 레퍼런스 사용 방법

1. 같은 장르의 상업 음원 선택 (잘 마스터링된 곡)
2. 마스터링 중 볼륨 레벨 맞춰 A/B 비교
3. EQ 밸런스 비교 (저역·중역·고역)
4. 스테레오 폭 비교
5. 다이나믹 비교 (조용한 구간·큰 구간)

### 비교 포인트

- **저역**: 킥·베이스 밸런스
- **중역**: 보컬·기타 존재감
- **고역**: 에어감·밝기
- **전체 라우드니스**: LUFS 측정

### 주의

- 레퍼런스와 동일하게 만들지 않음
- 방향성과 기준으로 활용
- 자신의 음악적 특성 유지

---

## 납품 파일 포맷

레퍼런스 트랙과 A/B 비교하면서 조절하면 과보정을 방지할 수 있습니다.

### 스트리밍 납품

- WAV 44.1kHz 24-bit (원본 보존)
- MP3 320kbps (업로드용)
- FLAC 44.1kHz 24-bit (고음질 옵션)

### CD 마스터링

- WAV 44.1kHz 16-bit (Red Book 규격)
- DDP 이미지 파일 (CD 복제 전용)

### 영상 음악 납품

- WAV 48kHz 24-bit (영상 표준)
- 스테레오 또는 5.1 서라운드

---

## 마치며

좋은 마스터링은 믹스를 더 돋보이게 하지만, 나쁜 믹스를 마스터링으로 고치기는 어렵습니다.

---

[공간 음향·바이노럴·돌비 애트모스 완전 가이드](/stories/spatial-audio1) | [마스터링 완전 가이드](/stories/mastering1) | [마스터링 전 믹스 준비 완전 가이드](/stories/mix-prep1) | [LUFS 완전 가이드](/stories/lufs-guide1) | [온라인 믹싱 의뢰 방법](/stories/onlinemix1) | [피아노 리듬감·리듬 훈련 음악연습실](/stories/practice-room-piano-rhythm1) | [기타 트레몰로·웜바 암 테크닉 음악연습실](/stories/practice-room-guitar-whammy1) | [보컬 다이나믹스·크레셴도 데크레셴도 음악연습실](/stories/practice-room-vocal-dynamics1) | [기타 줄 교체·스트링 선택 음악연습실](/stories/practice-room-guitar-string1) | [드럼 브러쉬·와이어 브러쉬 연주 음악연습실](/stories/practice-room-drum-brush1) | [피아노 즉흥 반주·코드 반주 음악연습실](/stories/practice-room-piano-sight-play1) | [베이스 코드·화음 연주 음악연습실](/stories/practice-room-bass-chord1) | [보컬 팔세토·가성 발성 음악연습실](/stories/practice-room-vocal-falsetto1) | [기타 탭핑·투핸드 태핑 음악연습실](/stories/practice-room-guitar-tapping1) | [피아노 듀엣·앙상블 개인 연습 음악연습실](/stories/practice-room-piano-duet1) | [드럼 폴리리듬·복잡박자 연습 음악연습실](/stories/practice-room-drum-polyrhythm1) | [보컬 어질리티·빠른 음계 훈련 음악연습실](/stories/practice-room-vocal-agility1) | [재즈 피아노 즉흥 솔로·임프로비제이션 음악연습실](/stories/practice-room-piano-jazz-improv1) | [기타 레가토·해머온 풀오프 연습 음악연습실](/stories/practice-room-guitar-legato1) | [베이스 펑크·R&B 그루브 음악연습실](/stories/practice-room-bass-funk1) | [보컬 프로젝션·소리 울림 훈련 음악연습실](/stories/practice-room-vocal-projection1) | [피아노 옥타브·넓은 음정 도약 연습 음악연습실](/stories/practice-room-piano-technique31) | [기타 슬라이드·슬라이드 기타 연습 음악연습실](/stories/practice-room-guitar-slide1) | [보컬 스타일 개발·장르별 창법 음악연습실](/stories/practice-room-vocal-style1) | [통기타 핑거피킹·핑거스타일 입문 음악연습실](/stories/practice-room-guitar-acoustic-fingerpick1) | [드럼 하이햇·심벌 컨트롤 음악연습실](/stories/practice-room-drum-hihat1) | [피아노 트릴·장식음 기법 음악연습실](/stories/practice-room-piano-trills1) | [기타 코드 진행·화성 이해 음악연습실](/stories/practice-room-guitar-chord-prog1) | [장르별 보컬 특성·크로스오버 보컬 음악연습실](/stories/practice-room-vocal-genre1) | [베이스 썸피킹·핑거스타일 혼합 음악연습실](/stories/practice-room-bass-thumb1) | [피아노 발라드 반주·감성 피아노 음악연습실](/stories/practice-room-piano-ballad21) | [기타 아르페지오·분산 화음 연습 음악연습실](/stories/practice-room-guitar-arpeggio1) | [보컬 녹음 준비·레코딩 보컬 음악연습실](/stories/practice-room-vocal-recording1) | [가스펠·CCM 피아노 반주 음악연습실](/stories/practice-room-piano-gospel1) | [기타 핑거스타일 고급·솔로 기타 편곡 음악연습실](/stories/practice-room-guitar-fingerpick-adv1) | [드럼 킥·베이스 드럼 테크닉 음악연습실](/stories/practice-room-drum-kick1) | [보컬 벨팅·파워 벨팅 음악연습실](/stories/practice-room-vocal-belting1) | [피아노 컴핑·재즈 반주 패턴 음악연습실](/stories/practice-room-piano-comping1) | [기타 피치카토·뮤트 주법 음악연습실](/stories/practice-room-guitar-mute1) | [베이스 핑거링·오른손 테크닉 음악연습실](/stories/practice-room-bass-fingering1) | [보컬 스타카토·단음 발성 훈련 음악연습실](/stories/practice-room-vocal-staccato1) | [드럼 심벌·크래쉬·라이드 테크닉 음악연습실](/stories/practice-room-drum-cymbal1) | [피아노 크로스 핸드·교차 손 훈련 음악연습실](/stories/practice-room-piano-crosshand1) | [기타 스케일 연습·포지션 이동 음악연습실](/stories/practice-room-guitar-scale-pos1) | [보컬 레가토·이어 부르기 훈련 음악연습실](/stories/practice-room-vocal-legato1) | [피아노 연탄·네 손 피아노 음악연습실](/stories/practice-room-piano-four-hands1) | [기타 핑거링·왼손 독립 훈련 음악연습실](/stories/practice-room-guitar-left-hand1) | [보컬 오버톤·배음 발성 훈련 음악연습실](/stories/practice-room-vocal-overtone1) | [드럼 스네어·림샷 테크닉 음악연습실](/stories/practice-room-drum-snare1) | [기타 왼손 비브라토·핑거 비브라토 음악연습실](/stories/practice-room-guitar-finger-vibrato1) | [피아노 루바토·음악적 템포 표현 음악연습실](/stories/practice-room-piano-rubato1) | [베이스 이펙터·페달 보드 활용 음악연습실](/stories/practice-room-bass-effects1) | [보컬 크루닝·저음 보컬 테크닉 음악연습실](/stories/practice-room-vocal-crooning1) | [피아노 소나타·클래식 소나타 형식 연습 음악연습실](/stories/practice-room-piano-sonata1) | [기타 재즈 코드·재즈 보이싱 음악연습실](/stories/practice-room-guitar-jazz-chord1) | [드럼 빠른 템포·스피드 훈련 음악연습실](/stories/practice-room-drum-speed1) | [보컬 중음역 강화·미들 보이스 음악연습실](/stories/practice-room-vocal-middle1) | [피아노 에튀드·기법 연습곡 음악연습실](/stories/practice-room-piano-etude1) | [기타 오픈 튜닝·슬라이드 오픈 튜닝 음악연습실](/stories/practice-room-guitar-open-tuning1) | [보컬 앙상블·코러스 개인 파트 훈련 음악연습실](/stories/practice-room-vocal-ensemble1) | [베이스 픽 주법·픽 베이스 연습 음악연습실](/stories/practice-room-bass-pick1) | [드럼 카운트·리듬 카운팅 훈련 음악연습실](/stories/practice-room-drum-count1) | [피아노 반음계·크로매틱 스케일 음악연습실](/stories/practice-room-piano-chromatic1) | [기타 핑거링 스트레칭·손가락 유연성 음악연습실](/stories/practice-room-guitar-stretch1) | [보컬 피치 컨트롤·음정 정확도 고급 훈련 음악연습실](/stories/practice-room-vocal-pitch1) | [베이스 슬라이드·포르타멘토 베이스 음악연습실](/stories/practice-room-bass-slide1) | [피아노 다이나믹·강약 표현 음악연습실](/stories/practice-room-piano-dynamics1) | [드럼 고스트 노트·유령음 훈련 음악연습실](/stories/practice-room-drum-ghost1) | [기타 코드 아르페지오·코드 분산 연주 음악연습실](/stories/practice-room-guitar-chord-arpeggio1) | [보컬 구음·솔페지오 훈련 음악연습실](/stories/practice-room-vocal-solfege1) | [피아노 폴리포니·독립 성부 연주 음악연습실](/stories/practice-room-piano-polyphony1) | [기타 리프·반복 패턴 작성 음악연습실](/stories/practice-room-guitar-riff1) | [드럼 오프비트·엇박 리듬 훈련 음악연습실](/stories/practice-room-drum-offbeat1) | [보컬 호흡 발음·자음 명료도 훈련 음악연습실](/stories/practice-room-vocal-consonant1) | [피아노 전조·조바꿈 연습 음악연습실](/stories/practice-room-piano-modulation1) | [기타 핑거피킹 패턴 다양화 음악연습실](/stories/practice-room-guitar-fingerpick-pattern1) | [베이스 뮤팅·노이즈 컨트롤 음악연습실](/stories/practice-room-bass-muting1) | [드럼 더블킥·더블 베이스 드럼 훈련 음악연습실](/stories/practice-room-drum-doublekick1) | [피아노 재즈 스탠다드·재즈 레퍼토리 음악연습실](/stories/practice-room-piano-jazz-standard1) | [보컬 라이브 퍼포먼스·공연 전 루틴 음악연습실](/stories/practice-room-vocal-live1) | [기타 뮤직 메모리·악보 없이 연주하기 음악연습실](/stories/practice-room-guitar-memory1) | [피아노 연속 도약·넓은 음정 점프 음악연습실](/stories/practice-room-piano-leaps1) | [드럼 크레셴도·다이나믹 빌드업 음악연습실](/stories/practice-room-drum-buildup1) | [베이스 펜타토닉·베이스 스케일 활용 음악연습실](/stories/practice-room-bass-pentatonic1) | [보컬 감정 표현·가사 해석 훈련 음악연습실](/stories/practice-room-vocal-emotion1) | [기타 해머온·풀오프 연속 훈련 음악연습실](/stories/practice-room-guitar-hammer-pull1) | [피아노 내성부·보조 선율 연습 음악연습실](/stories/practice-room-piano-inner-voice1) | [드럼 림샷·크로스스틱 고급 훈련 음악연습실](/stories/practice-room-drum-rimshot-adv1) | [보컬 뮤지컬 스타일·역할 보컬 훈련 음악연습실](/stories/practice-room-vocal-musical-style1) | [베이스 슬랩·팝핑 고급 테크닉 음악연습실](/stories/practice-room-bass-slap-adv1) | [피아노 초견 고급·빠른 악보 읽기 음악연습실](/stories/practice-room-piano-sight-adv1) | [드럼 타이밍·포켓 그루브 훈련 음악연습실](/stories/practice-room-drum-timing1) | [보컬 호흡·성대 컨트롤 고급 훈련 음악연습실](/stories/practice-room-vocal-breath-adv1) | [기타 비브라토·피치 컨트롤 음악연습실](/stories/practice-room-guitar-vibrato1) | [피아노 화성·코드 고급 이론 음악연습실](/stories/practice-room-piano-chord-adv1) | [재즈 베이스·워킹 베이스 고급 음악연습실](/stories/practice-room-bass-jazz1) | [보컬 음색 개발·개성 있는 목소리 훈련 음악연습실](/stories/practice-room-vocal-color-adv1) | [드럼 선형 리듬·리니어 드러밍 음악연습실](/stories/practice-room-drum-linear1) | [피아노 고급 테크닉·연주 기법 종합 음악연습실](/stories/practice-room-piano-technique-adv1) | [기타 코드 고급·확장 코드 연주 음악연습실](/stories/practice-room-guitar-chord-adv1) | [보컬 레지스터·성구 전환 훈련 음악연습실](/stories/practice-room-vocal-register1) | [베이스 루트 노트·코드 읽기 고급 음악연습실](/stories/practice-room-bass-root-adv1) | [피아노 터치·아티큘레이션 훈련 음악연습실](/stories/practice-room-piano-touch1) | [연신내 음악연습실 안내](/stories/practice-room-yeonsinnae1) | [스튜디오 놀 이용 요금](/pricing)
