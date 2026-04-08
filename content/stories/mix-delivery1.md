---
title: "믹스 납품 준비 완전 가이드 — 최종 믹스·마스터링 파일 납품 기준"
date: 2026-04-06
author: "스튜디오 놀"
category: "음반 제작 가이드"
tags: ["믹스 납품", "마스터링 납품", "오디오 파일 규격", "음원 납품", "WAV 납품", "음원 발매 파일", "스트리밍 규격"]
thumbnail: "/images/studio1.webp"
summary: "믹스·마스터링 납품 준비 완전 가이드입니다. WAV 규격, 루돈 기준, ISRC 코드, 유통사 제출 형식, 최종 체크리스트까지 음원 발매 전 모든 것을 정리합니다."
faq:
  - q: "믹스 납품 표준 규격은 무엇인가요?"
    a: "스트리밍 플랫폼 납품 기준은 WAV 44.1kHz 24bit (또는 16bit)입니다. 마스터링 완료 파일은 최대 -0.3~-1dBFS로 피크를 제한합니다. 루돈(LUFS) 기준은 스포티파이 -14 LUFS, 멜론 -14 LUFS, 유튜브 -13~-14 LUFS가 표준입니다."
  - q: "루돈(LUFS)이란 무엇인가요?"
    a: "LUFS(Loudness Units relative to Full Scale)는 지각 음량을 측정하는 단위입니다. 스트리밍 플랫폼은 루돈 기준으로 볼륨을 자동 노멀라이즈합니다. 마스터링 시 타겟 LUFS를 맞추면 플랫폼에서 볼륨이 조정되지 않고 그대로 재생됩니다."
  - q: "ISRC 코드가 무엇이고 어떻게 발급받나요?"
    a: "ISRC(International Standard Recording Code)는 음원 트랙의 고유 식별 코드입니다. 한국음악저작권협회(KMCA)나 디지털 유통사(DistroKid, 카카오엔터 등)를 통해 발급받을 수 있습니다. 스트리밍 플랫폼에서 저작권 추적과 수익 배분에 사용됩니다."
  - q: "스포티파이와 멜론의 음량 기준이 다른가요?"
    a: "세계 대부분의 스트리밍 플랫폼이 -14 LUFS 기준으로 노멀라이즈합니다. 스포티파이 -14 LUFS, 애플뮤직 -16 LUFS, 유튜브 -14 LUFS가 기준이며, 멜론·지니도 비슷한 기준입니다. 마스터링 시 -14 LUFS 내외를 타겟으로 하면 주요 플랫폼에서 안정적입니다."
---
![믹스 납품 준비 완전 가이드 — 스튜디오 놀](/images/studio1.webp)

## 믹스 납품 — 음원 발매 전 마지막 관문

아무리 좋은 믹싱·마스터링도 파일 규격이 잘못되면 플랫폼에서 의도한 대로 재생되지 않습니다. 납품 전 체크리스트를 반드시 확인하세요.

---

## 파일 납품 표준 규격

| 항목 | 권장 사양 | 최소 사양 |
|------|---------|---------|
| 포맷 | WAV | WAV 또는 AIFF |
| 샘플레이트 | 44.1kHz | 44.1kHz |
| 비트뎁스 | 24bit | 16bit |
| 채널 | 스테레오 (2ch) | 스테레오 |
| 최대 피크 | -0.3~-1dBFS | -0.3dBFS |
| 타겟 루돈 | -14 LUFS (Integrated) | - |

---

## 루돈 (LUFS) 기준

스트리밍 데이터를 분석하면 마케팅 전략을 더욱 정밀하게 조정할 수 있습니다.

### 스트리밍 플랫폼별 루돈 기준

- **스포티파이**: -14 LUFS (Integrated)
- **애플뮤직**: -16 LUFS
- **유튜브/유튜브뮤직**: -13~-14 LUFS
- **멜론·지니·벅스**: -14 LUFS 내외
- **틱톡**: -14 LUFS

### 루돈 측정 툴

Youlean Loudness Meter (무료)
iZotope Insight 2 (유료)
Waves WLM (유료)
- **DAW 내장 메터 (Ableton**: Loudness 분석)

### 마스터링 목표

- **Integrated LUFS**: -14 LUFS ± 1
- **True Peak**: -1dBTP 이하 (스포티파이 기준)
Short-term LUFS: 타겟보다 2~4 LUFS 높을 수 있음

---

## ISRC 코드와 메타데이터

절차를 미리 파악해두면 발매 일정이 밀리는 사고를 방지할 수 있습니다.

### ISRC 코드 발급

- 유통사 통해 자동 발급 (DistroKid, 카카오엔터, FLUXUS)
- 직접 발급: KMCA (한국음악저작권협회) 또는 RIAA (해외)
- 형식: CC-XXX-YY-NNNNN (국가코드-등록자-연도-번호)

### 메타데이터 필수 항목

트랙명, 아티스트명, 앨범명, 발매일
작곡가, 작사가, 편곡자 (ISWC 코드)
ISRC 코드
장르, 언어
앨범 아트 (3000×3000px JPG)

### 한국어 메타데이터 주의

- 한글·영문 모두 입력 (글로벌 유통 시)
- 아티스트명 영문 표기 통일
- 타이틀 트랙·수록곡 순서 확인

---

## 납품 전 최종 체크리스트

인디 아티스트에게도 퍼블리싱 권리 관리는 장기 수입의 중요한 기반입니다.

### 오디오 파일 체크

- WAV 44.1kHz 24bit 확인
- 파일 재생 처음부터 끝까지 확인 (크리핑 없음)
- 루돈 측정: -14 LUFS Integrated 근처
- True Peak: -0.5dBTP 이하
- 파일명: 아티스트명_곡명_Master.wav 형식

### 메타데이터 체크

- 트랙명 오타 없음
- 아티스트명 통일
- 작곡·작사·편곡자 모두 입력
- ISRC 코드 유효 확인
- 앨범 아트 3000×3000px JPG 준비

### 유통 신청 체크

- 유통사 계정 확인
- 발매일 설정 (여유 있게 2주 전 제출)
- 수익 분배 비율 설정 (공동 아티스트 시)
- 배타 조항 확인 (독점 유통 vs 비독점)
- 각 플랫폼 미리보기 URL 신청 여부

---

## 유통사별 납품 방법

소셜 미디어 전략은 릴리즈 최소 4주 전부터 준비하는 것이 효과적입니다.

### 주요 유통사 비교

- **DistroKid**: 월정액 ($23~/년), 무제한 음원, 빠른 등록
- **카카오엔터 (FLUXUS)**: 한국 플랫폼 최적화, 신청제
- **뮤직카우**: 조각 저작권 판매 연계 가능
- **TuneCore**: 트랙당 유통비, 저렴한 초기 비용

### 납품 형식

1. WAV 파일 업로드
2. 메타데이터 입력
3. 앨범 아트 업로드
4. 발매일 설정
5. 검토 및 승인 (1~5 영업일)
6. 스트리밍 플랫폼 등록 완료

---

## 마치며

완성된 믹스·마스터링 파일을 올바른 규격으로 납품해야 음악이 의도한 품질로 재생됩니다.

---

[음원 유통 완전 가이드](/stories/distribution1) | [마스터링 완전 가이드](/stories/mastering1) | [앨범 아트 제작 가이드](/stories/album-art1) | [스트리밍 발매 가이드](/stories/streaming-release1) | [온라인 믹싱 의뢰 방법](/stories/onlinemix1) | [피아노 리듬감·리듬 훈련 음악연습실](/stories/practice-room-piano-rhythm1) | [기타 트레몰로·웜바 암 테크닉 음악연습실](/stories/practice-room-guitar-whammy1) | [보컬 다이나믹스·크레셴도 데크레셴도 음악연습실](/stories/practice-room-vocal-dynamics1) | [기타 줄 교체·스트링 선택 음악연습실](/stories/practice-room-guitar-string1) | [드럼 브러쉬·와이어 브러쉬 연주 음악연습실](/stories/practice-room-drum-brush1) | [피아노 즉흥 반주·코드 반주 음악연습실](/stories/practice-room-piano-sight-play1) | [베이스 코드·화음 연주 음악연습실](/stories/practice-room-bass-chord1) | [보컬 팔세토·가성 발성 음악연습실](/stories/practice-room-vocal-falsetto1) | [기타 탭핑·투핸드 태핑 음악연습실](/stories/practice-room-guitar-tapping1) | [피아노 듀엣·앙상블 개인 연습 음악연습실](/stories/practice-room-piano-duet1) | [드럼 폴리리듬·복잡박자 연습 음악연습실](/stories/practice-room-drum-polyrhythm1) | [보컬 어질리티·빠른 음계 훈련 음악연습실](/stories/practice-room-vocal-agility1) | [재즈 피아노 즉흥 솔로·임프로비제이션 음악연습실](/stories/practice-room-piano-jazz-improv1) | [기타 레가토·해머온 풀오프 연습 음악연습실](/stories/practice-room-guitar-legato1) | [베이스 펑크·R&B 그루브 음악연습실](/stories/practice-room-bass-funk1) | [보컬 프로젝션·소리 울림 훈련 음악연습실](/stories/practice-room-vocal-projection1) | [피아노 옥타브·넓은 음정 도약 연습 음악연습실](/stories/practice-room-piano-technique31) | [기타 슬라이드·슬라이드 기타 연습 음악연습실](/stories/practice-room-guitar-slide1) | [보컬 스타일 개발·장르별 창법 음악연습실](/stories/practice-room-vocal-style1) | [통기타 핑거피킹·핑거스타일 입문 음악연습실](/stories/practice-room-guitar-acoustic-fingerpick1) | [드럼 하이햇·심벌 컨트롤 음악연습실](/stories/practice-room-drum-hihat1) | [피아노 트릴·장식음 기법 음악연습실](/stories/practice-room-piano-trills1) | [기타 코드 진행·화성 이해 음악연습실](/stories/practice-room-guitar-chord-prog1) | [장르별 보컬 특성·크로스오버 보컬 음악연습실](/stories/practice-room-vocal-genre1) | [베이스 썸피킹·핑거스타일 혼합 음악연습실](/stories/practice-room-bass-thumb1) | [피아노 발라드 반주·감성 피아노 음악연습실](/stories/practice-room-piano-ballad21) | [기타 아르페지오·분산 화음 연습 음악연습실](/stories/practice-room-guitar-arpeggio1) | [보컬 녹음 준비·레코딩 보컬 음악연습실](/stories/practice-room-vocal-recording1) | [가스펠·CCM 피아노 반주 음악연습실](/stories/practice-room-piano-gospel1) | [기타 핑거스타일 고급·솔로 기타 편곡 음악연습실](/stories/practice-room-guitar-fingerpick-adv1) | [드럼 킥·베이스 드럼 테크닉 음악연습실](/stories/practice-room-drum-kick1) | [보컬 벨팅·파워 벨팅 음악연습실](/stories/practice-room-vocal-belting1) | [피아노 컴핑·재즈 반주 패턴 음악연습실](/stories/practice-room-piano-comping1) | [기타 피치카토·뮤트 주법 음악연습실](/stories/practice-room-guitar-mute1) | [베이스 핑거링·오른손 테크닉 음악연습실](/stories/practice-room-bass-fingering1) | [보컬 스타카토·단음 발성 훈련 음악연습실](/stories/practice-room-vocal-staccato1) | [드럼 심벌·크래쉬·라이드 테크닉 음악연습실](/stories/practice-room-drum-cymbal1) | [피아노 크로스 핸드·교차 손 훈련 음악연습실](/stories/practice-room-piano-crosshand1) | [기타 스케일 연습·포지션 이동 음악연습실](/stories/practice-room-guitar-scale-pos1) | [보컬 레가토·이어 부르기 훈련 음악연습실](/stories/practice-room-vocal-legato1) | [피아노 연탄·네 손 피아노 음악연습실](/stories/practice-room-piano-four-hands1) | [기타 핑거링·왼손 독립 훈련 음악연습실](/stories/practice-room-guitar-left-hand1) | [보컬 오버톤·배음 발성 훈련 음악연습실](/stories/practice-room-vocal-overtone1) | [드럼 스네어·림샷 테크닉 음악연습실](/stories/practice-room-drum-snare1) | [기타 왼손 비브라토·핑거 비브라토 음악연습실](/stories/practice-room-guitar-finger-vibrato1) | [피아노 루바토·음악적 템포 표현 음악연습실](/stories/practice-room-piano-rubato1) | [베이스 이펙터·페달 보드 활용 음악연습실](/stories/practice-room-bass-effects1) | [보컬 크루닝·저음 보컬 테크닉 음악연습실](/stories/practice-room-vocal-crooning1) | [피아노 소나타·클래식 소나타 형식 연습 음악연습실](/stories/practice-room-piano-sonata1) | [기타 재즈 코드·재즈 보이싱 음악연습실](/stories/practice-room-guitar-jazz-chord1) | [드럼 빠른 템포·스피드 훈련 음악연습실](/stories/practice-room-drum-speed1) | [보컬 중음역 강화·미들 보이스 음악연습실](/stories/practice-room-vocal-middle1) | [피아노 에튀드·기법 연습곡 음악연습실](/stories/practice-room-piano-etude1) | [기타 오픈 튜닝·슬라이드 오픈 튜닝 음악연습실](/stories/practice-room-guitar-open-tuning1) | [보컬 앙상블·코러스 개인 파트 훈련 음악연습실](/stories/practice-room-vocal-ensemble1) | [베이스 픽 주법·픽 베이스 연습 음악연습실](/stories/practice-room-bass-pick1) | [드럼 카운트·리듬 카운팅 훈련 음악연습실](/stories/practice-room-drum-count1) | [피아노 반음계·크로매틱 스케일 음악연습실](/stories/practice-room-piano-chromatic1) | [기타 핑거링 스트레칭·손가락 유연성 음악연습실](/stories/practice-room-guitar-stretch1) | [보컬 피치 컨트롤·음정 정확도 고급 훈련 음악연습실](/stories/practice-room-vocal-pitch1) | [베이스 슬라이드·포르타멘토 베이스 음악연습실](/stories/practice-room-bass-slide1) | [피아노 다이나믹·강약 표현 음악연습실](/stories/practice-room-piano-dynamics1) | [드럼 고스트 노트·유령음 훈련 음악연습실](/stories/practice-room-drum-ghost1) | [기타 코드 아르페지오·코드 분산 연주 음악연습실](/stories/practice-room-guitar-chord-arpeggio1) | [보컬 구음·솔페지오 훈련 음악연습실](/stories/practice-room-vocal-solfege1) | [피아노 폴리포니·독립 성부 연주 음악연습실](/stories/practice-room-piano-polyphony1) | [기타 리프·반복 패턴 작성 음악연습실](/stories/practice-room-guitar-riff1) | [드럼 오프비트·엇박 리듬 훈련 음악연습실](/stories/practice-room-drum-offbeat1) | [보컬 호흡 발음·자음 명료도 훈련 음악연습실](/stories/practice-room-vocal-consonant1) | [피아노 전조·조바꿈 연습 음악연습실](/stories/practice-room-piano-modulation1) | [기타 핑거피킹 패턴 다양화 음악연습실](/stories/practice-room-guitar-fingerpick-pattern1) | [베이스 뮤팅·노이즈 컨트롤 음악연습실](/stories/practice-room-bass-muting1) | [드럼 더블킥·더블 베이스 드럼 훈련 음악연습실](/stories/practice-room-drum-doublekick1) | [피아노 재즈 스탠다드·재즈 레퍼토리 음악연습실](/stories/practice-room-piano-jazz-standard1) | [보컬 라이브 퍼포먼스·공연 전 루틴 음악연습실](/stories/practice-room-vocal-live1) | [기타 뮤직 메모리·악보 없이 연주하기 음악연습실](/stories/practice-room-guitar-memory1) | [피아노 연속 도약·넓은 음정 점프 음악연습실](/stories/practice-room-piano-leaps1) | [드럼 크레셴도·다이나믹 빌드업 음악연습실](/stories/practice-room-drum-buildup1) | [베이스 펜타토닉·베이스 스케일 활용 음악연습실](/stories/practice-room-bass-pentatonic1) | [보컬 감정 표현·가사 해석 훈련 음악연습실](/stories/practice-room-vocal-emotion1) | [기타 해머온·풀오프 연속 훈련 음악연습실](/stories/practice-room-guitar-hammer-pull1) | [피아노 내성부·보조 선율 연습 음악연습실](/stories/practice-room-piano-inner-voice1) | [드럼 림샷·크로스스틱 고급 훈련 음악연습실](/stories/practice-room-drum-rimshot-adv1) | [보컬 뮤지컬 스타일·역할 보컬 훈련 음악연습실](/stories/practice-room-vocal-musical-style1) | [베이스 슬랩·팝핑 고급 테크닉 음악연습실](/stories/practice-room-bass-slap-adv1) | [피아노 초견 고급·빠른 악보 읽기 음악연습실](/stories/practice-room-piano-sight-adv1) | [드럼 타이밍·포켓 그루브 훈련 음악연습실](/stories/practice-room-drum-timing1) | [보컬 호흡·성대 컨트롤 고급 훈련 음악연습실](/stories/practice-room-vocal-breath-adv1) | [기타 비브라토·피치 컨트롤 음악연습실](/stories/practice-room-guitar-vibrato1) | [피아노 화성·코드 고급 이론 음악연습실](/stories/practice-room-piano-chord-adv1) | [재즈 베이스·워킹 베이스 고급 음악연습실](/stories/practice-room-bass-jazz1) | [보컬 음색 개발·개성 있는 목소리 훈련 음악연습실](/stories/practice-room-vocal-color-adv1) | [드럼 선형 리듬·리니어 드러밍 음악연습실](/stories/practice-room-drum-linear1) | [피아노 고급 테크닉·연주 기법 종합 음악연습실](/stories/practice-room-piano-technique-adv1) | [기타 코드 고급·확장 코드 연주 음악연습실](/stories/practice-room-guitar-chord-adv1) | [보컬 레지스터·성구 전환 훈련 음악연습실](/stories/practice-room-vocal-register1) | [베이스 루트 노트·코드 읽기 고급 음악연습실](/stories/practice-room-bass-root-adv1) | [피아노 터치·아티큘레이션 훈련 음악연습실](/stories/practice-room-piano-touch1) | [재즈 드럼 고급·스윙 필 심화 음악연습실](/stories/practice-room-drum-jazz-adv1) | [보컬 무대 퍼포먼스 고급·스테이지 존재감 음악연습실](/stories/practice-room-vocal-stage-adv1) | [기타 즉흥 연주·임프로비제이션 음악연습실](/stories/practice-room-guitar-improv1) | [성인 피아노 입문·처음 시작하는 어른 음악연습실](/stories/practice-room-piano-beginner-adult1) | [드럼 악센트·강세 패턴 훈련 음악연습실](/stories/practice-room-drum-accent1) | [베이스 옥타브 주법·옥타브 그루브 음악연습실](/stories/practice-room-bass-octave1) | [피아노 음정·인터벌 훈련 음악연습실](/stories/practice-room-piano-interval1) | [보컬 오디션 준비·심사 기준 이해 음악연습실](/stories/practice-room-vocal-audition1) | [연신내 음악연습실 안내](/stories/practice-room-yeonsinnae1) | [스튜디오 놀 이용 요금](/pricing)
