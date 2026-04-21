#!/usr/bin/env bash
# 가장 최근 푸시된 커밋의 Vercel 프로덕션 배포가 Ready 될 때까지 대기 후
# PageSpeed 측정을 실행한다.
#
# 사용법:
#   ./scripts/wait-and-measure.sh                 # 모바일 측정
#   ./scripts/wait-and-measure.sh --desktop-only  # 데스크톱
#   ./scripts/wait-and-measure.sh --prev-url URL  # 비교 기준 URL (이전 배포 URL)

set -euo pipefail
cd "$(dirname "$0")/.."

PREV_URL=""
MEASURE_ARGS="--mobile-only"
while [[ $# -gt 0 ]]; do
  case $1 in
    --prev-url) PREV_URL="$2"; shift 2 ;;
    --desktop-only|--mobile-only) MEASURE_ARGS="$1"; shift ;;
    *) shift ;;
  esac
done

# 현재 가장 최근 프로덕션 배포 URL을 구한다 (push 전 상태).
get_latest_prod() {
  vercel ls --prod 2>/dev/null | awk '/hwang-khs-projects\/studio/ {print $4; exit}'
}

# 배포 상태 읽기 (Ready | Building | Error | Queued 등)
get_deployment_status() {
  local url="$1"
  vercel inspect "$url" 2>&1 | awk '/status[[:space:]]/ {for (i=2; i<=NF; i++) printf "%s ", $i; print ""; exit}' | sed 's/● //' | xargs
}

if [[ -z "$PREV_URL" ]]; then
  PREV_URL="$(get_latest_prod)"
  echo "[wait] 기준 이전 URL: $PREV_URL"
fi

echo "[wait] 새 프로덕션 배포가 나타날 때까지 대기..."
# 새 배포 URL이 기존과 달라질 때까지 대기
new_url=""
for i in $(seq 1 20); do
  cur="$(get_latest_prod)"
  if [[ -n "$cur" && "$cur" != "$PREV_URL" ]]; then
    new_url="$cur"
    break
  fi
  sleep 30
done

if [[ -z "$new_url" ]]; then
  echo "[wait] 10분 내 새 배포 감지 실패. 수동 확인 필요." >&2
  exit 1
fi

echo "[wait] 새 배포 발견: $new_url"
echo "[wait] Ready 상태까지 대기..."

for i in $(seq 1 20); do
  status="$(get_deployment_status "$new_url")"
  echo "  [$i] status=$status"
  if [[ "$status" == "Ready" ]]; then
    echo "[wait] 배포 Ready ✓"
    break
  fi
  if [[ "$status" == "Error" || "$status" == "Canceled" ]]; then
    echo "[wait] 배포 실패: $status" >&2
    exit 1
  fi
  sleep 30
done

# Cloudflare/엣지 캐시 안정화를 위해 10초 추가 대기
sleep 10

echo "[wait] PageSpeed 측정 시작..."
node scripts/pagespeed-audit.js $MEASURE_ARGS
