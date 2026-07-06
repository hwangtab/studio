#!/usr/bin/env python3
"""
코드블록(```) 아웃라인 형식의 스토리 파일을 산문 마크다운으로 변환합니다.

변환 규칙:
- [Title] 또는 [Title: sub] → ### Title
- → text           → - text
- → key: value     → - **key**: value (짧은 키에 한함)
- →   text (들여쓰기) → \t- text (2칸 들여쓴 서브 리스트)
- ①②③ text       → 1. 2. 3. text
- □ text           → - text
- ✅/❌/⚠️ text  → - ✅/❌/⚠️ text
- × text           → - text
- Label:           → **Label**  (콜론으로 끝나는 단독 줄)

각 ## 섹션의 첫 코드블록 앞에 1~2문장 산문 도입부 삽입.
"""
import os
import re
import hashlib
import sys

STORIES_DIR = os.path.join(os.path.dirname(__file__), '..', 'content', 'stories')

# ─── 산문 풀 ───────────────────────────────────────────────────────────────────

PROSE_POOL = {
    'mixing': [
        "각 파라미터가 사운드에 미치는 영향을 이해하면 설정값을 외우지 않아도 귀로 판단할 수 있습니다.",
        "기본값에서 출발해 한 번에 하나씩 조절하면 각 파라미터의 역할이 명확하게 들립니다.",
        "아래 설정값은 출발점이며, 곡의 장르와 보컬 특성에 따라 조정이 필요합니다.",
        "레퍼런스 트랙과 A/B 비교하면서 조절하면 과보정을 방지할 수 있습니다.",
        "귀가 피로해지기 전에 중요한 판단을 먼저 내리는 것이 좋습니다.",
        "모노로 확인하면 스테레오에서 감춰진 문제를 더 빨리 발견할 수 있습니다.",
        "작은 조정이 전체 믹스 밸런스에 예상보다 큰 영향을 줄 수 있으니 단계적으로 적용하세요.",
        "이펙트를 추가하기 전에 원음의 문제를 먼저 해결하는 것이 올바른 순서입니다.",
        "볼륨 자동화를 활용하면 이펙트에 의존하지 않고도 다이나믹을 자연스럽게 만들 수 있습니다.",
        "버스로 묶어 처리하면 개별 트랙 조정 없이도 전체 밸런스를 효율적으로 잡을 수 있습니다.",
        "고음역 컷이 전체 믹스에 투명감을 더해주는 경우가 많으므로 저역부터 정리하세요.",
        "플러그인을 추가하기 전에 게인 스테이징이 올바른지 먼저 확인합니다.",
        "같은 플러그인이라도 신호 체인의 어느 위치에 두느냐에 따라 결과가 크게 달라집니다.",
        "바이패스로 전후 비교하는 습관이 과처리를 막는 가장 효과적인 방법입니다.",
        "아래 수치는 가이드라인이며, 최종 판단은 항상 귀로 합니다.",
    ],
    'vocal_technique': [
        "올바른 자세와 호흡이 선행되지 않으면 아무리 연습해도 효과가 제한됩니다.",
        "처음에는 과장된 동작으로 감각을 익힌 뒤, 점차 자연스럽게 줄여가는 방식이 효과적입니다.",
        "아래 연습 순서는 성대 부담이 적은 것부터 배열했으므로 순서대로 진행하세요.",
        "거울 앞에서 연습하면 자신도 모르는 긴장 패턴을 발견하고 교정하는 데 도움이 됩니다.",
        "느린 속도에서 정확하게 익힌 기술은 빠른 템포에서도 안정적으로 작동합니다.",
        "녹음을 들어보면 연습 중에는 인식하지 못했던 발성 습관이 드러납니다.",
        "성대 피로가 느껴지면 즉시 멈추고 충분히 쉬는 것이 장기 보컬 건강에 중요합니다.",
        "통증이 있을 때 억지로 연습하면 작은 문제가 큰 부상으로 악화될 수 있습니다.",
        "기술적 완성도보다 감정 전달이 청중에게 더 큰 영향을 준다는 점을 기억하세요.",
        "호흡 훈련은 발성 연습과 함께 병행할 때 훨씬 빠른 효과를 볼 수 있습니다.",
        "각 기술의 목적을 이해하고 연습하면 기계적인 반복보다 훨씬 빠르게 체득됩니다.",
        "워밍업 없이 고음역을 바로 시도하면 성대에 불필요한 부담을 줄 수 있습니다.",
        "연습 일지를 기록하면 자신의 성장 패턴과 반복되는 문제점을 파악하는 데 유용합니다.",
        "전문 보컬 코치의 정기적인 피드백이 독학의 한계를 극복하는 가장 확실한 방법입니다.",
        "아래 내용은 일반적인 가이드이며, 개인 발성 특성에 따라 조정이 필요할 수 있습니다.",
    ],
    'recording': [
        "장비 자체보다 세팅 방법이 결과물 품질에 더 큰 영향을 줍니다.",
        "녹음 전 게인과 마이크 위치를 정확히 잡아두면 후반 작업이 크게 줄어듭니다.",
        "반사음 문제는 후반 작업에서 제거하기 매우 어려우므로 녹음 환경 정비가 먼저입니다.",
        "헤드룸을 충분히 확보해두면 이후 믹싱 단계에서 선택의 폭이 넓어집니다.",
        "테스트 녹음으로 먼저 소리를 확인한 뒤 본 녹음을 진행하는 것이 기본 워크플로우입니다.",
        "마이크 위치를 조금만 바꿔도 음색이 크게 달라지므로 충분한 테스트가 필요합니다.",
        "클리핑은 후반에서 복구가 불가능하므로 게인을 보수적으로 설정하는 것이 안전합니다.",
        "모니터링 레벨과 녹음 레벨은 독립적으로 조절해야 판단 오류를 방지할 수 있습니다.",
        "동일한 장비라도 공간 처리에 따라 전문 스튜디오 수준의 음질을 얻을 수 있습니다.",
        "레이턴시 설정은 녹음과 믹싱 단계에서 각각 다르게 최적화하는 것이 좋습니다.",
        "불필요한 배경 소음을 차단하는 것이 노이즈 제거 플러그인보다 효과적입니다.",
        "팝 필터 하나로 파열음 문제의 상당 부분을 해결할 수 있습니다.",
        "아래 설정은 일반적인 권장 사항이며 장비 특성과 공간에 따라 조정이 필요합니다.",
        "신호 경로 전체를 점검해두면 녹음 중 예상치 못한 문제를 방지할 수 있습니다.",
        "세션 시작 전 파일 정리와 프로젝트 백업 습관이 데이터 손실을 막아줍니다.",
    ],
    'business': [
        "절차를 미리 파악해두면 발매 일정이 밀리는 사고를 방지할 수 있습니다.",
        "아래 항목은 법적 효력에 관한 일반 정보이며, 구체적 사안은 전문가 상담을 권장합니다.",
        "플랫폼마다 정책이 다르므로 각 플랫폼의 최신 가이드라인을 직접 확인하세요.",
        "수익 창출 이전에 저작권 등록을 완료해두면 불필요한 분쟁을 예방할 수 있습니다.",
        "계약서의 세부 조항을 꼼꼼히 확인하는 습관이 장기적으로 큰 손실을 막아줍니다.",
        "초기 단계에서 구조를 올바르게 설정하면 규모가 커져도 관리가 훨씬 수월해집니다.",
        "유통사 선택은 수수료뿐만 아니라 지원 서비스와 플랫폼 커버리지도 함께 고려하세요.",
        "발매 전 마케팅 준비가 음원 초기 성과에 결정적인 영향을 줄 수 있습니다.",
        "협업 시 권리 분배를 문서로 명확히 해두면 이후 갈등을 예방할 수 있습니다.",
        "소셜 미디어 전략은 릴리즈 최소 4주 전부터 준비하는 것이 효과적입니다.",
        "스트리밍 데이터를 분석하면 마케팅 전략을 더욱 정밀하게 조정할 수 있습니다.",
        "인디 아티스트에게도 퍼블리싱 권리 관리는 장기 수입의 중요한 기반입니다.",
        "아래 내용은 한국 기준이며, 해외 유통 시에는 각국 저작권 기관 정책을 별도 확인하세요.",
        "세금 신고와 수익 정산 주기를 미리 파악해두면 현금 흐름 관리에 도움이 됩니다.",
        "NFT·Web3 음악 플랫폼은 빠르게 변화하므로 최신 정보를 지속적으로 확인해야 합니다.",
    ],
    'daw': [
        "DAW마다 용어와 메뉴 위치가 다르지만 기본 원리는 동일합니다.",
        "아래 워크플로우는 기본 설정 기준이며, 자신의 작업 스타일에 맞게 커스텀하세요.",
        "단축키를 익혀두면 마우스 조작에 비해 작업 속도가 두 배 이상 빨라집니다.",
        "프로젝트 파일은 작업 중에도 주기적으로 저장하는 습관을 들이세요.",
        "CPU 사용률을 모니터링하면서 작업하면 갑작스러운 오디오 끊김을 예방할 수 있습니다.",
        "트랙 색상과 명칭을 체계적으로 관리하면 복잡한 세션도 빠르게 파악할 수 있습니다.",
        "같은 기능이라도 DAW에 내장된 도구가 서드파티 플러그인보다 안정적인 경우가 많습니다.",
        "버퍼 사이즈는 녹음 시 작게, 믹싱 시 크게 설정하면 레이턴시와 성능을 최적화할 수 있습니다.",
        "레퍼런스 트랙을 프로젝트에 함께 임포트하면 사운드 방향을 일관되게 유지할 수 있습니다.",
        "자동화(Automation) 레인을 활용하면 수동 조정 없이 정밀한 다이나믹 변화를 만들 수 있습니다.",
        "DAW 업데이트 전에는 현재 프로젝트 파일을 백업해두는 것이 안전합니다.",
        "아래 내용은 특정 버전 기준이며, 업데이트 이후 인터페이스가 달라질 수 있습니다.",
        "MIDI 편집에서 벨로시티 변화를 주면 기계적인 느낌을 줄이고 자연스러운 연주감을 만들 수 있습니다.",
        "프리셋은 출발점으로 활용하되, 곡의 특성에 맞게 반드시 조정해야 합니다.",
        "세션 관리를 체계화하면 협업 시 다른 엔지니어나 아티스트가 빠르게 작업을 이어받을 수 있습니다.",
    ],
    'composition': [
        "이론을 알면 작곡 속도가 빨라지고, 막힐 때 돌파구를 찾기 쉬워집니다.",
        "아래 진행은 자주 쓰이는 패턴이지만, 곡의 감정에 맞게 변형하는 것이 핵심입니다.",
        "레퍼런스 곡을 분석하면 이론보다 실전에서 쓰이는 기법을 더 빠르게 익힐 수 있습니다.",
        "멜로디와 코드의 관계를 이해하면 더 풍부한 색감의 편곡이 가능해집니다.",
        "한 가지 아이디어에서 변형을 만들어가는 연습이 곡의 통일성을 높여줍니다.",
        "구조(Form)를 먼저 설계하면 작곡 중 방향을 잃는 경우가 줄어듭니다.",
        "불협화음은 해결될 때 더 강한 감정적 효과를 만들어냅니다.",
        "장르의 전통적인 코드 진행을 이해하면 기대를 충족하거나 의도적으로 배신할 수 있습니다.",
        "간결한 모티프 하나를 반복·변형하는 방식이 복잡한 작곡보다 인상 깊은 경우가 많습니다.",
        "가사와 멜로디의 자연스러운 강세 일치가 곡의 완성도를 크게 높입니다.",
        "완성에 집착하기보다 초안을 빠르게 완성하고 이후에 수정하는 방식이 효율적입니다.",
        "다양한 장르의 악보와 리드 시트를 분석하면 자신만의 어휘가 풍부해집니다.",
        "피아노 하나만으로 편곡의 핵심 구조가 성립하는지 먼저 확인하세요.",
        "리듬 패턴의 변화만으로도 곡의 에너지와 분위기를 효과적으로 바꿀 수 있습니다.",
        "아래 예시는 특정 스타일 기준이며, 다른 장르에 적용할 때는 맥락 조정이 필요합니다.",
    ],
    'genre': [
        "장르의 정체성을 결정하는 핵심 요소를 먼저 파악한 뒤 세부 사운드를 쌓아가세요.",
        "아래 설정은 해당 장르의 전형적인 출발점이며, 곡의 개성에 맞게 변형이 필요합니다.",
        "레퍼런스 트랙을 스펙트럼 분석하면 장르 특유의 주파수 밸런스를 파악하는 데 도움이 됩니다.",
        "장르 규범을 이해한 뒤 의도적으로 어기는 것이 새로운 사운드를 만드는 방법입니다.",
        "핵심 요소 두세 가지가 조합되면 청중이 해당 장르를 즉각 인식하게 됩니다.",
        "장르별 믹싱 관행은 해당 음악을 가장 많이 듣는 청중의 기대치를 반영합니다.",
        "드럼 패턴이 장르 정체성의 절반 이상을 결정한다고 볼 수 있습니다.",
        "샘플과 합성 사운드를 레이어하면 독창적이면서도 장르에 충실한 사운드를 만들 수 있습니다.",
        "보컬 처리 방식도 장르마다 뚜렷한 관습이 있으므로 레퍼런스 분석이 필요합니다.",
        "아래 BPM 범위와 조성 경향은 데이터 기반 분석이지만 엄격한 규칙은 아닙니다.",
        "서브장르 간 크로스오버가 최근 음악 트렌드의 주요 흐름이므로 유연하게 접근하세요.",
        "장르 학습의 최선은 해당 장르의 고전 앨범을 반복 청취하며 구조를 분석하는 것입니다.",
    ],
    'health': [
        "성대는 한 번 손상되면 회복에 수주가 걸리므로 예방이 최선입니다.",
        "아래 습관을 일상에 적용하면 장기적으로 보컬 수명을 크게 연장할 수 있습니다.",
        "불편함의 초기 신호를 무시하지 않는 것이 심각한 성대 손상을 막는 핵심입니다.",
        "공연·녹음 일정이 촉박할수록 성대 관리에 더 신경을 써야 합니다.",
        "수분 섭취는 성대 건강 유지에서 어떤 보충제보다 효과적입니다.",
        "스트레스와 수면 부족도 성대 컨디션에 직접적인 영향을 줍니다.",
        "목에 이상이 느껴지면 전문의 진단을 늦추지 않는 것이 장기적으로 이득입니다.",
        "성대 건강 루틴을 일상에 통합하면 특별히 신경 쓰지 않아도 자연스럽게 관리됩니다.",
        "환경적 요인(건조함, 알레르기, 냉방)도 성대 컨디션에 큰 영향을 줍니다.",
        "건강한 생활 습관 전반이 보컬 건강의 가장 든든한 기반입니다.",
        "아래 정보는 일반적인 교육 목적이며, 증상이 지속되면 이비인후과 전문의를 방문하세요.",
        "보컬 건강은 기술 향상만큼 중요한 장기 투자임을 기억하세요.",
    ],
    'location': [
        "사전에 이동 경로를 확인해두면 첫 방문 시 헤매는 시간을 줄일 수 있습니다.",
        "아래 소요 시간은 평균 기준이며 혼잡 시간대에는 10~15분 추가를 권장합니다.",
        "대중교통 이용이 주차 걱정 없이 편리하게 방문할 수 있는 가장 좋은 방법입니다.",
        "스튜디오 방문 전 예약을 완료하면 불필요한 대기 없이 바로 이용할 수 있습니다.",
        "아래 정보는 작성 시점 기준이며, 교통 상황이나 노선 변경으로 달라질 수 있습니다.",
        "처음 방문하는 분은 예약 시간 10분 전에 도착하면 여유롭게 시작할 수 있습니다.",
        "주차 공간은 제한적이므로 대중교통 이용을 권장합니다.",
        "네이버 지도 또는 카카오맵에서 '스튜디오 놀'을 검색하면 실시간 길 안내를 받을 수 있습니다.",
        "입구 위치나 주차 정보가 필요한 경우 예약 전 문의해주시면 안내드립니다.",
        "야간 녹음 세션 이용 시 막차 시간을 미리 확인해두시기 바랍니다.",
    ],
    'general': [
        "아래 내용은 실제 현장 경험을 바탕으로 정리한 실용 가이드입니다.",
        "이론보다 실전 적용이 중요하므로 읽은 후 바로 시도해보는 것을 권장합니다.",
        "단계별로 접근하면 복잡해 보이는 작업도 체계적으로 진행할 수 있습니다.",
        "아래 내용은 일반적인 기준이며, 상황에 따라 다른 접근이 더 효과적일 수 있습니다.",
        "핵심 원칙을 이해하면 구체적인 방법이 달라져도 유연하게 대응할 수 있습니다.",
        "처음에는 기본에 충실하고, 익숙해진 후에 응용하는 것이 효과적인 학습 순서입니다.",
        "작은 부분부터 적용해보면 전체 과정이 부담 없이 느껴집니다.",
        "질문이 생기면 정확한 답을 찾기 전에 직접 실험해보는 것도 좋은 방법입니다.",
        "아래 순서는 권장 흐름이지만, 상황에 따라 유연하게 조정해도 됩니다.",
        "반복적인 실천이 지식을 기술로 바꾸는 유일한 방법입니다.",
        "전문가의 피드백을 정기적으로 받으면 혼자서는 인식하기 어려운 맹점을 발견할 수 있습니다.",
        "아래 항목들은 상호 연관되어 있으므로 전체적인 맥락에서 이해하면 더욱 효과적입니다.",
    ],
}

# ─── 클러스터 키워드 ────────────────────────────────────────────────────────────

CLUSTER_KEYWORDS = {
    'mixing': [
        'eq', '이큐', '컴프레서', '리버브', '딜레이', '마스터링', 'lufs', '사이드체인',
        '패닝', '자동화', '노이즈게이트', '게이트', '새추레이션', '주파수', '다이나믹',
        '스테레오', '버스', '믹싱', '이펙트', '플러그인', '채널', '믹스버스',
        '컴프레션', '리미터', '익스팬더', '피치', '하모니', '보컬 처리', '드럼 믹스',
        'reverb', 'compressor', 'equalizer', 'mixing', 'mastering', 'delay',
    ],
    'vocal_technique': [
        '발성', '호흡', '두성', '흉성', '믹스보이스', '워밍업', '딕션', '비브라토',
        '음역', '고음', '저음', '창법', '성구', '레가토', '스타카토', '벨칸토',
        '복식호흡', '흉식호흡', '지지', '아포지오', '포지션', '공명', '보컬 훈련',
        '발음', '모음', '자음', '표현력', '보컬 테크닉', '노래 연습', '발성법',
    ],
    'recording': [
        '마이크', '프리앰프', '오디오인터페이스', '인터페이스', '방음', '흡음',
        '보컬부스', '부스', '모니터', '헤드폰', '게인', '헤드룸', '클리핑',
        '녹음', '레코딩', '입력', '캡처', '마이킹', '팝필터', '쇼크마운트',
        '어쿠스틱', '룸', '리플렉션', '다이나믹마이크', '콘덴서', '리본',
    ],
    'business': [
        '저작권', '유통', 'komca', '발매', '마케팅', '수익', '크라우드펀딩',
        '계약', 'sns', '스트리밍', '퍼블리싱', '인디', '레이블', '배급',
        '수수료', '정산', '음원', '플랫폼', '홍보', '팬', '멤버십',
        '저작인접권', '실연자', '음반', '배분', '라이선스', '싱크',
    ],
    'daw': [
        'logic', 'ableton', 'fl studio', 'pro tools', 'cubase', 'reaper',
        'garageband', 'studio one', 'vst', 'au', 'midi', '미디', 'daw',
        '플러그인', '프리셋', '오토메이션', '시퀀서', '루프', '클립',
        '트랙', '버퍼', '레이턴시', 'bpm', '템포', '박자', '미디 편집',
    ],
    'composition': [
        '코드진행', '코드 진행', '멜로디', '가사', '편곡', '화성', '구조',
        '오케스트레이션', '모티프', '주제', '발전', '형식', '소나타',
        '팝 구조', '브릿지', '코러스', '벌스', '인트로', '아웃트로',
        '전조', '조성', '스케일', '음계', '모드', '텐션', '해결',
        '작곡법', '편곡법', '화성학', '대위법', '리하모나이제이션',
    ],
    'genre': [
        '트랩', 'edm', '로파이', 'r&b', '808', '힙합', '네오소울', 'k-pop', 'kpop',
        '발라드', '록', '재즈', '팝', '어쿠스틱', '인디팝', '드림팝', '슈게이징',
        '시티팝', '보사노바', '살사', '레게', '소울', '펑크', '디스코',
        '덥스텝', '하우스', '테크노', '앰비언트', '뉴에이지', '클래식',
    ],
    'health': [
        '성대', '결절', '폴립', '수분', '컨디션', '발성피로', '회복',
        '이비인후과', '염증', '부종', '쉰목소리', '위산역류', '흡연',
        '음주', '수면', '보컬건강', '목 관리', '성대 보호', '보컬수명',
    ],
    'location': [
        '지하철', 'ktx', '이동경로', '소요시간', '역', '버스', '교통',
        '출구', '도보', '분거리', '분 소요', '정거장', '환승', '노선',
        '강남', '홍대', '서울', '인천', '수원', '부산', '대구', '대전',
        '서초', '마포', '종로', '신촌', '이태원', '압구정',
    ],
}

# ─── 섹션 스킵 패턴 ─────────────────────────────────────────────────────────────

SKIP_SECTION_PATTERNS = [
    r'^마치며', r'^마무리', r'^결론', r'^소결', r'^정리',
    r'^지역별\s*이동', r'^이동\s*경로', r'^소요\s*시간', r'^교통\s*안내',
    r'^오시는\s*길', r'^약도', r'^지도',
]

# ─── 원형 번호 ─────────────────────────────────────────────────────────────────

CIRCLED = {
    '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5,
    '⑥': 6, '⑦': 7, '⑧': 8, '⑨': 9, '⑩': 10,
    '⑪': 11, '⑫': 12, '⑬': 13, '⑭': 14, '⑮': 15,
}

# ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

def detect_cluster(filename, category, section_title, tags):
    """파일명·카테고리·섹션제목·태그에서 클러스터 감지."""
    text = ' '.join([
        filename.lower(),
        (category or '').lower(),
        (section_title or '').lower(),
        ' '.join(t.lower() for t in (tags or [])),
    ])

    scores = {cluster: 0 for cluster in CLUSTER_KEYWORDS}
    for cluster, keywords in CLUSTER_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                scores[cluster] += 1

    best = max(scores, key=scores.get)
    if scores[best] == 0:
        return 'general'
    return best


def get_prose_intro(cluster, file_seed, section_idx, used_intros):
    """결정론적 해시 기반으로 산문 풀에서 문장을 선택."""
    pool = PROSE_POOL.get(cluster, PROSE_POOL['general'])
    available = [s for s in pool if s not in used_intros]
    if not available:
        available = pool  # 전부 사용했으면 풀 전체에서 선택

    key = f"{file_seed}-{section_idx}".encode()
    idx = int(hashlib.md5(key).hexdigest(), 16) % len(available)
    chosen = available[idx]
    used_intros.add(chosen)
    return chosen


def should_skip_section(section_title):
    """이 섹션에 산문 도입부를 추가하지 않는 경우."""
    if not section_title:
        return True
    for pattern in SKIP_SECTION_PATTERNS:
        if re.search(pattern, section_title.strip()):
            return True
    return False


def is_outline_block(block_lines):
    """코드블록이 변환 대상 아웃라인인지 확인."""
    content = '\n'.join(block_lines)
    if not content.strip():
        return False
    has_arrow = '→' in content
    has_circled = any(c in content for c in CIRCLED)
    has_bracket_title = bool(re.search(r'^\[.+\]', content, re.MULTILINE))
    has_checkbox = '□' in content
    has_emoji_marker = bool(re.search(r'^[✅❌⚠️×✓]', content, re.MULTILINE))
    has_dash_list = bool(re.search(r'^- \S', content, re.MULTILINE))
    has_numbered_list = bool(re.search(r'^\d+[\.。]\s+\S', content, re.MULTILINE))
    has_korean_numbered = bool(re.search(r'^\d+[단순위위]\s*[:：]', content, re.MULTILINE))
    has_label_content = bool(re.search(r'^[\w가-힣][가-힣\w\s()·\/()]{0,25}[:：]\s+\S', content, re.MULTILINE))
    return (has_arrow or has_circled or has_bracket_title or has_checkbox
            or has_emoji_marker or has_dash_list or has_numbered_list
            or has_korean_numbered or has_label_content)


def convert_code_block_line(line):
    """코드블록 내 한 줄을 마크다운 형식으로 변환."""
    stripped = line.rstrip()

    # [Title] 또는 [Title: sub] — 단독 줄
    m = re.match(r'^\[([^\]]+)\]\s*:?\s*$', stripped)
    if m:
        title = m.group(1).strip().rstrip(':')
        return f"\n### {title}\n"

    # [Title]: 내용 — 소제목 + 내용 같이 있는 경우
    m = re.match(r'^\[([^\]]+)\]:\s*(.+)$', stripped)
    if m:
        title = m.group(1).strip()
        rest = m.group(2).strip()
        return f"\n### {title}\n\n{rest}"

    # 원형 번호 ①②③
    for ch, num in CIRCLED.items():
        if stripped.startswith(ch):
            rest = stripped[len(ch):].strip()
            return f"{num}. {rest}"

    # ❌ ✅ ⚠️ 이모지 마커 — 들여쓰기 있을 경우
    leading_spaces = len(stripped) - len(stripped.lstrip())
    lstripped = stripped.lstrip()

    for marker in ('❌', '✅', '⚠️', '×', '✓'):
        if lstripped.startswith(marker):
            rest = lstripped[len(marker):].strip()
            indent = '  ' * (leading_spaces // 2)
            if marker in ('×', '✓'):
                # 이 마커들은 내용만 (기호 제거)
                return f"{indent}- {rest}" if rest else ""
            return f"{indent}- {marker} {rest}" if rest else f"{indent}- {marker}"

    # □ 체크박스
    if lstripped.startswith('□'):
        rest = lstripped[1:].strip()
        indent = '  ' * (leading_spaces // 2)
        return f"{indent}- {rest}"

    # → 화살표 (들여쓰기 포함)
    if lstripped.startswith('→'):
        rest = lstripped[1:].strip()
        indent = '  ' * (leading_spaces // 2)

        # key: value 패턴 — 키가 짧을 경우 볼드 처리
        m = re.match(r'^([^:：]{1,20})[:：]\s*(.+)$', rest)
        if m:
            key = m.group(1).strip()
            val = m.group(2).strip()
            # 키에 공백이 두 단어 이내인 경우만 볼드 처리
            if len(key.split()) <= 3:
                return f"{indent}- **{key}**: {val}"

        return f"{indent}- {rest}" if rest else ""

    # Label: (콜론으로 끝나는 단독 줄, 화살표 없음)
    m = re.match(r'^([^:：→\[\]]{1,30})[:：]\s*$', stripped)
    if m:
        label = m.group(1).strip()
        return f"\n**{label}**"

    # 빈 줄
    if not stripped:
        return ""

    # Label: content 패턴 (→ 없이 시작하는 키:값 줄, 이미 마크다운 리스트 아닌 경우)
    if not lstripped.startswith('-') and not lstripped.startswith('#'):
        m = re.match(r'^([\w가-힣][가-힣\w\s()·\/]{0,25})[:：]\s+(.+)$', stripped)
        if m:
            key = m.group(1).strip()
            val = m.group(2).strip()
            # 키가 짧고 값이 있을 경우만 볼드 처리
            if len(key.split()) <= 4:
                indent = '  ' * (leading_spaces // 2)
                return f"{indent}- **{key}**: {val}"

    # 그 외 — 그대로 유지
    return stripped


def convert_code_block(block_lines):
    """코드블록 전체를 변환하여 줄 리스트로 반환."""
    result = []
    for line in block_lines:
        converted = convert_code_block_line(line)
        # 멀티라인 반환 처리 (예: "\n### Title\n")
        if '\n' in converted:
            for sub in converted.split('\n'):
                result.append(sub)
        else:
            result.append(converted)

    # 연속 빈 줄 정리 (2개 이상 → 1개)
    cleaned = []
    blank_count = 0
    for line in result:
        if line == "":
            blank_count += 1
            if blank_count <= 1:
                cleaned.append(line)
        else:
            blank_count = 0
            cleaned.append(line)

    # 앞뒤 빈 줄 제거
    while cleaned and cleaned[0] == "":
        cleaned.pop(0)
    while cleaned and cleaned[-1] == "":
        cleaned.pop()

    return cleaned


def process_file(filepath):
    """파일 처리: 코드블록 변환 + 산문 도입부 삽입."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    filename = os.path.basename(filepath)

    # Frontmatter 분리
    fm_match = re.match(r'^(---\n.*?\n---\n)', content, re.DOTALL)
    if fm_match:
        frontmatter = fm_match.group(1)
        body = content[len(frontmatter):]
    else:
        frontmatter = ''
        body = content

    # 코드블록이 있는지 먼저 확인 (bare ``` 만 대상)
    if '```' not in body:
        return False

    # 메타 추출 (카테고리, 태그)
    category_m = re.search(r'^category:\s*["\']?(.+?)["\']?\s*$', frontmatter, re.MULTILINE)
    tags_m = re.search(r'^tags:\s*\[([^\]]*)\]', frontmatter, re.MULTILINE | re.DOTALL)
    category = category_m.group(1).strip() if category_m else ''
    tags = re.findall(r'["\']([^"\']+)["\']', tags_m.group(1)) if tags_m else []

    file_seed = filename

    # ── 본문을 줄별로 처리 ──
    lines = body.split('\n')
    output_lines = []

    i = 0
    current_section_title = None
    section_idx = 0
    prose_inserted_for_section = False
    used_intros = set()

    while i < len(lines):
        line = lines[i]

        # ## 섹션 제목 감지
        h2_m = re.match(r'^## (.+)$', line)
        if h2_m:
            current_section_title = h2_m.group(1).strip()
            section_idx += 1
            prose_inserted_for_section = False
            output_lines.append(line)
            i += 1
            continue

        # 코드블록 시작 감지 (bare ``` 만, ```python 등 제외)
        if re.match(r'^```\s*$', line):
            # 코드블록 끝 찾기
            block_start = i + 1
            block_end = block_start
            while block_end < len(lines) and not re.match(r'^```\s*$', lines[block_end]):
                block_end += 1

            block_lines = lines[block_start:block_end]

            # 아웃라인 블록인지 확인
            if is_outline_block(block_lines):
                # 산문 도입부 삽입 (이 섹션 첫 번째 코드블록이고, 스킵 대상이 아닌 경우)
                if not prose_inserted_for_section and not should_skip_section(current_section_title):
                    cluster = detect_cluster(filename, category, current_section_title, tags)
                    prose = get_prose_intro(cluster, file_seed, section_idx, used_intros)
                    # 앞에 빈 줄 확인
                    if output_lines and output_lines[-1].strip() != '':
                        output_lines.append('')
                    output_lines.append(prose)
                    output_lines.append('')
                    prose_inserted_for_section = True

                # 코드블록 변환
                converted = convert_code_block(block_lines)
                output_lines.extend(converted)
            else:
                # 일반 코드블록 — 그대로 유지 (열기·내용·닫기 모두 포함)
                output_lines.append(line)  # opening ```
                output_lines.extend(block_lines)
                if block_end < len(lines):
                    output_lines.append(lines[block_end])  # closing ```

            # 코드블록 닫는 ``` 건너뛰기 (공통)
            i = block_end + 1
            continue

        output_lines.append(line)
        i += 1

    new_body = '\n'.join(output_lines)
    new_content = frontmatter + new_body

    # 변경 여부 확인
    if new_content == content:
        return False

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    return True


def main():
    if not os.path.isdir(STORIES_DIR):
        print(f"ERROR: {STORIES_DIR} not found")
        sys.exit(1)

    # 선택적으로 파일 목록 인자 처리
    if len(sys.argv) > 1:
        files = sys.argv[1:]
    else:
        files = [
            os.path.join(STORIES_DIR, f)
            for f in sorted(os.listdir(STORIES_DIR))
            if f.endswith('.md')
        ]

    modified = 0
    skipped = 0
    errors = []

    for filepath in files:
        try:
            result = process_file(filepath)
            if result:
                modified += 1
            else:
                skipped += 1
        except Exception as e:
            errors.append((filepath, str(e)))

    print(f"Modified: {modified}")
    print(f"Skipped (no code blocks or no change): {skipped}")
    if errors:
        print(f"Errors: {len(errors)}")
        for fp, err in errors[:10]:
            print(f"  {os.path.basename(fp)}: {err}")


if __name__ == '__main__':
    main()
