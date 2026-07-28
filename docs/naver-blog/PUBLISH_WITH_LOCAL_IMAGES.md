# 네이버 블로그 발행 + 로컬 이미지 매칭

AI 이미지는 사용하지 않는다. `docs/naver-blog/upload-images/` 아래 JPG는 모두 저장소의 실제 로컬 이미지에서 복사/변환한 발행용 파일이다.

## 발행 순서

1. `01-음악연습실-월세-입주.md`
2. `02-연신내-녹음실-보컬녹음.md`
3. `03-성우-오디오북-녹음.md`
4. `07-yeonsinnae-recording-studio.md`
5. `02-vocal-mic-recommendation.md`
6. `01-why-high-notes-fail.md`
7. `03-wav-vs-mp3.md`
8. `04-vocal-major-audition-song.md`
9. `05-indie-first-release.md`
10. `06-cover-song-copyright.md`

전환 의도가 강한 월세 연습실, 보컬 녹음, 성우 녹음을 먼저 올리고, 기존 정보성 글은 주 1편 간격으로 이어간다.

## 공통 발행 규칙

- 첫 이미지는 글 썸네일이 되므로, 가장 실제감이 강한 사진을 1번으로 사용한다.
- 본문 `[사진]` 안내 문구는 발행 시 삭제하고, 해당 위치에 이미지를 넣는다.
- 글 끝에는 네이버 플레이스 `스튜디오 놀`을 장소 첨부한다.
- 가능하면 사진 사이에 짧은 실제 설명을 한 줄씩 넣는다. 예: `스튜디오 놀 메인 컨트롤룸입니다.`
- 네이버 태그 입력란에는 글 하단의 태그를 복사하되, `#`는 네이버가 자동 처리하면 제거해도 된다.

## 글별 이미지 폴더

| 글 파일 | 이미지 폴더 | 첫 이미지 |
|---|---|---|
| `01-음악연습실-월세-입주.md` | `upload-images/01-music-practice-room-monthly/` | `01-room1.jpg` |
| `02-연신내-녹음실-보컬녹음.md` | `upload-images/02-yeonsinnae-vocal-recording/` | `01-studio3.jpg` |
| `03-성우-오디오북-녹음.md` | `upload-images/03-voice-audiobook-recording/` | `01-hardware3.jpg` |
| `07-yeonsinnae-recording-studio.md` | `upload-images/10-yeonsinnae-recording-studio/` | `01-studio1.jpg` |
| `02-vocal-mic-recommendation.md` | `upload-images/05-vocal-mic-recommendation/` | `01-hardware3.jpg` |
| `01-why-high-notes-fail.md` | `upload-images/04-why-high-notes-fail/` | `01-recording1.jpg` |
| `03-wav-vs-mp3.md` | `upload-images/06-wav-vs-mp3/` | `01-studio3.jpg` |
| `04-vocal-major-audition-song.md` | `upload-images/07-vocal-major-audition-song/` | `01-recording15.jpg` |
| `05-indie-first-release.md` | `upload-images/08-indie-first-release/` | `01-studio4.jpg` |
| `06-cover-song-copyright.md` | `upload-images/09-cover-song-copyright/` | `01-recording1.jpg` |

## 이미지 원본

발행용 JPG는 아래 원본에서 만들었다.

- 스튜디오/녹음/장비 사진: `public/images/recording*.webp`, `public/images/studio*.webp`, `public/images/hardware*.webp`, `public/images/console.webp`
- 연습실 사진: `public/images/room*.webp`
- 포트폴리오/앨범 이미지: `public/images/album*.webp`, `public/images/portfolio*.webp`
- 가격표: `docs/naver-blog/스튜디오놀_가격표.png`

원본 파일은 수정하지 않았고, 네이버 업로드용으로만 JPG 사본을 만들었다.
