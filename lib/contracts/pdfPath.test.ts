import { contractPdfPathname } from './pdfPath';

describe('contractPdfPathname', () => {
  it('저장소 주소에서 경로만 꺼낸다 — 호스트(저장소 ID)는 버린다', () => {
    expect(contractPdfPathname('https://oj1vwcprnozxidvo.private.blob.vercel-storage.com/contracts/abc.pdf')).toBe('contracts/abc.pdf');
  });

  it('저장소가 달라도 같은 파일이면 같은 경로다', () => {
    const before = contractPdfPathname('https://aaaa.private.blob.vercel-storage.com/contracts/abc.pdf');
    const after = contractPdfPathname('https://bbbb.private.blob.vercel-storage.com/contracts/abc.pdf');
    expect(before).toBe(after);
  });

  it('쿼리는 버리고, 인코딩된 글자는 풀어 Blob이 돌려주는 pathname과 맞춘다', () => {
    expect(contractPdfPathname('https://x.private.blob.vercel-storage.com/contracts/a%20b.pdf?download=1')).toBe('contracts/a b.pdf');
  });

  it('이미 경로면 그대로 돌려준다', () => {
    expect(contractPdfPathname('contracts/abc.pdf')).toBe('contracts/abc.pdf');
    expect(contractPdfPathname('/contracts/abc.pdf')).toBe('contracts/abc.pdf');
  });
});
