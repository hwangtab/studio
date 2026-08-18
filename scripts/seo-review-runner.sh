#!/bin/zsh
# 9/11 판정 라운드 자동 실행 러너 — launchd(com.studionol.seo-review-20260911)가 호출한다.
#
# 하는 일:
#   1. seo-preflight 실행 (열린 실험·관측창 현황 + 프리플라이트 스탬프 갱신)
#   2. ctr-verdict --from-log 실행 (album-cost1 등 측정 중 실험 일괄 판정)
#   3. 둘의 출력을 docs/ctr-review/<날짜>-report.txt 에 저장
#   4. macOS 알림 발송
#   5. 자기 자신의 launchd 등록 해제 (1회성 실행)
#
# 커밋·로그 반영은 하지 않는다 — 무인 git push는 위험하고, 판정의 로그 반영은
# 사람이(또는 세션에서) 리포트를 보고 한다. 리포트만 준비해 두는 게 이 러너의 역할.
#
# launchd 재설치(필요 시):
#   launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.studionol.seo-review-20260911.plist

set -u
REPO="/Users/hwang-gyeongha/studio"
NODE="/opt/homebrew/bin/node"
LABEL="com.studionol.seo-review-20260911"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
TODAY=$(date +%Y-%m-%d)
OUT_DIR="$REPO/docs/ctr-review"
REPORT="$OUT_DIR/$TODAY-report.txt"

mkdir -p "$OUT_DIR"
cd "$REPO" || exit 1

{
  echo "════ SEO 판정 라운드 자동 리포트 · $TODAY $(date +%H:%M)"
  echo "════ 이 리포트를 Claude 세션에 보여주고 '판정 반영해'라고 하면 로그 갱신·커밋까지 이어진다."
  echo
  echo "──────── 1. seo-preflight (열린 실험·관측창·최근 커밋)"
  "$NODE" scripts/seo-preflight.mjs 2>&1
  echo
  echo "──────── 2. ctr-verdict --from-log (측정 중 실험 일괄 판정)"
  "$NODE" --env-file=.env.local scripts/ctr-verdict.mjs --from-log 2>&1
  echo
  echo "──────── 3. 308 통합 5쌍 관측창 판정 (2026-08-14 통합, 승자 페이지)"
  "$NODE" --env-file=.env.local scripts/ctr-verdict.mjs \
    --surgery 2026-08-14 --days 25 \
    --slugs chest-voice1,producer1,songstructure1,vocal-doubling1,practice-room-vocal-diction1 \
    --control daw-choice1,practice-room-monthly1,copyright-cover1 2>&1
} > "$REPORT"

STATUS=$?

if [ -s "$REPORT" ]; then
  osascript -e "display notification \"docs/ctr-review/$TODAY-report.txt 준비됨 — Claude에 '판정 반영해'\" with title \"SEO 판정 리포트\" sound name \"Glass\"" 2>/dev/null
else
  osascript -e "display notification \"리포트 생성 실패 — scripts/seo-review-runner.sh 수동 실행 필요\" with title \"SEO 판정 실패\" sound name \"Basso\"" 2>/dev/null
fi

# 1회성 — 실행 후 launchd 등록 해제. (실패했어도 해제한다: CI 트립와이어가
# 리뷰일+7일부터 jest를 깨뜨리는 백업 안전망이라 이중 실행보다 정리가 낫다.)
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null
rm -f "$PLIST"

exit $STATUS
