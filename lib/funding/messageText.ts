/**
 * 응원 메시지 표시용 정리. 한글 자판의 아래아 점(ㆍㆍ)이 옛 한글 자모 U+11A2(ᆢ)로 입력되는데,
 * 본문 폰트 서브셋에 이 글자가 없어 앞 음절("지" 등)과 합쳐진 채 시스템 폰트로 떨어져 그 글자만
 * 다르게 보인다. 말줄임표·가운뎃점으로 바꿔 서브셋 안의 글자만 남긴다.
 */
export function cleanSupporterMessage(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[ᆢᆞㆎ]+/g, (m) => (m.length > 1 || m === 'ᆢ' ? '…' : '·'))
    .replace(/ㆍ/g, '·');
}
