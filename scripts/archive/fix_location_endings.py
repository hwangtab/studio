#!/usr/bin/env python3
"""
지역 가이드 마치며 잔여 문제 수정:
1. "전문 보컬 녹음을 경험하세요." 잔여 텍스트 제거 (87개 파일)
2. "이므로./하므로." 등 접속형 어미 뒤 마침표 수정 (2개 파일)
"""
import re, os, hashlib

STORIES_DIR = "content/stories"

ENDINGS = {
    "seoul": [
        "방문 전 카카오톡으로 예약 시간을 먼저 잡아두시면 대기 없이 바로 세션에 들어갈 수 있습니다.",
        "가까운 거리인 만큼 부담 없이 들러보세요. 예약 문의는 카카오톡으로 주시면 됩니다.",
        "세션 일정은 카카오톡으로 미리 조율해주세요. 도착 전 워밍업 시간을 여유 있게 잡는 걸 권장합니다.",
    ],
    "gyeonggi": [
        "당일 세션을 마치고 저녁 전 귀가 가능한 거리입니다. 방문 전 카카오톡으로 예약해주세요.",
        "세션 일정은 카카오톡으로 미리 잡아두시면 대기 없이 바로 시작합니다.",
        "이동 전 카카오톡으로 원하는 사운드 방향을 미리 공유해주시면 세션 준비 시간이 줄어듭니다.",
    ],
    "ktx": [
        "먼 거리를 오시는 만큼 방문 전 카카오톡으로 사운드 방향과 자료를 미리 공유해주시면 세션 시간을 절약할 수 있습니다.",
        "KTX 이동 피로가 있을 수 있으므로 세션 전 워밍업 시간을 여유롭게 확보하시길 권장합니다.",
        "왕복 일정을 고려해 세션 시간을 넉넉하게 잡아두세요. 예약 문의는 카카오톡으로 주세요.",
    ],
    "remote": [
        "이동이 부담스럽다면 온라인 파일 의뢰를 추천합니다. 현지에서 드라이 보컬 WAV만 녹음해 보내주시면 믹싱·마스터링 후 납품합니다.",
        "방문보다 파일 의뢰가 현실적인 선택입니다. 현지 WAV 녹음 → 카카오톡 전송 → 완성 파일 납품까지 소통합니다.",
        "거리가 있는 만큼 카카오톡으로 미리 충분히 소통해두세요. 온라인 의뢰도 동일한 결과물로 납품합니다.",
    ],
}


def pick_variant(variants, filename):
    h = int(hashlib.md5(filename.encode()).hexdigest(), 16)
    return variants[h % len(variants)]


def detect_tier(body):
    if any(w in body for w in ["여객선", "도선", "울릉도"]):
        return "remote"
    time_match = re.search(r'총 소요시간[^\n]*약 (\d+)시간', body)
    if time_match:
        hours = int(time_match.group(1))
        if hours >= 3:
            return "remote"
        elif hours >= 1:
            return "ktx"
    bus_match = re.search(r'고속버스.*?약 (\d+)시간', body)
    if bus_match and int(bus_match.group(1)) >= 3:
        return "remote"
    if "KTX" in body:
        return "ktx"
    if "비행기" in body or "항공" in body:
        return "remote"
    min_match = re.search(r'총 소요시간[^\n]*약 (\d+)[~\-]?\d*분', body)
    if min_match:
        return "seoul" if int(min_match.group(1)) <= 40 else "gyeonggi"
    if "KTX" not in body and "고속버스" not in body and "기차" not in body:
        return "seoul"
    return "gyeonggi"


def fix_ending(text, tier, filename):
    """마치며 텍스트에서 잔여 홍보 문구 제거."""
    # 제거할 패턴 (연신내역 도보 5분의... 제거 후 남은 조각들)
    extra_removals = [
        # 홍보성 문구를 '.'으로 교체해 앞 문장이 깔끔하게 끝나도록
        (r' 전문 보컬 녹음을 경험하세요\.', '.'),
        (r' 전문 보컬 녹음을 경험할 수 있습니다\.', '.'),
        (r' 전문 보컬 녹음을 경험해보세요\.', '.'),
    ]
    cleaned = text
    for pat, repl in extra_removals:
        cleaned = re.sub(pat, repl, cleaned)

    # 접속형 어미로 끝나는 불완전 문장 처리 ("상당하므로." → "상당합니다.")
    cleaned = re.sub(r'([가-힣]+)하므로\.', r'\1합니다.', cleaned)
    cleaned = re.sub(r'([가-힣]+)이므로\.', r'\1입니다.', cleaned)

    # 시간/분 뒤에 마침표 없이 바로 다음 문장이 오는 경우 수정
    # 예: "2.5시간 방문보다" → "2.5시간. 방문보다"
    cleaned = re.sub(
        r'(\d+(?:\.\d+)?(?:분|시간)) (방문보다|이동이|파일|거리|온라인)',
        r'\1. \2',
        cleaned
    )

    cleaned = cleaned.strip()
    return cleaned


def main():
    files = sorted([f for f in os.listdir(STORIES_DIR)
                    if f.endswith('.md') and f.count('.') == 1])
    modified = 0
    for fname in files:
        fpath = os.path.join(STORIES_DIR, fname)
        with open(fpath) as f:
            raw = f.read()

        if 'category: "지역 가이드"' not in raw:
            continue

        parts = raw.split('---', 2)
        if len(parts) < 3:
            continue
        body = parts[2]

        tier = detect_tier(body)

        def replace(m):
            new = fix_ending(m.group(2), tier, fname)
            return m.group(1) + new + m.group(3)

        new_body = re.sub(
            r'(## 마치며\n\n)(.*?)(\n\n\[)',
            replace,
            body,
            flags=re.DOTALL
        )

        if new_body == body:
            continue

        result = f'---{parts[1]}---{new_body}'
        with open(fpath, 'w') as f:
            f.write(result)
        modified += 1

    print(f"수정: {modified}개")


if __name__ == '__main__':
    main()
