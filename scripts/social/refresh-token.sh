#!/bin/bash
# Instagram·Threads 장기 토큰 주간 갱신 (launchd).
#
# 두 API 모두 영구 토큰이 없다. 장기 토큰 60일을 refresh로 무제한 연장할 수 있지만,
# 만료된 뒤에는 연장이 안 된다. CLI를 몇 달 안 쓰는 동안에도 토큰이 죽지 않게 하려고
# 이 스크립트를 주 1회 돌린다. CLI 실행 시 자동 갱신(meta.mjs ensureFreshToken)과 두 겹이다.
#
#   bash scripts/social/refresh-token.sh            # 1회 실행
#   bash scripts/social/refresh-token.sh --install  # launchd 주간 작업 등록 (매주 월 10:00)
#   bash scripts/social/refresh-token.sh --uninstall
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LABEL="co.kr.studionol.social-token-refresh"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/studionol-social-refresh.log"

case "${1:-}" in
  --install)
    NODE_BIN="$(command -v node)"
    mkdir -p "$HOME/Library/LaunchAgents" "$(dirname "$LOG")"
    cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$REPO/scripts/social/refresh-token.sh</string></array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$(dirname "$NODE_BIN"):/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>StartCalendarInterval</key>
  <dict><key>Weekday</key><integer>1</integer><key>Hour</key><integer>10</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict></plist>
PLIST_EOF
    launchctl bootout "gui/$UID/$LABEL" 2>/dev/null || true
    launchctl bootstrap "gui/$UID" "$PLIST"
    echo "등록됨: $PLIST (매주 월 10:00, 로그 $LOG)"
    exit 0
    ;;
  --uninstall)
    launchctl bootout "gui/$UID/$LABEL" 2>/dev/null || true
    rm -f "$PLIST"
    echo "해제됨: $LABEL"
    exit 0
    ;;
esac

cd "$REPO"
[ -f .env.local ] || { echo "$(date '+%F %T') .env.local 없음 — 중단"; exit 1; }
echo "$(date '+%F %T') 갱신 시작"
node --env-file=.env.local scripts/social/auth.mjs --refresh
node --env-file=.env.local scripts/social/auth.mjs --status
