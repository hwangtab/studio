import React from 'react';
import Markdown from 'markdown-to-jsx';

interface ContractContentProps {
  content: string;
  /** 서명 페이지는 본문을 크게, 관리자 상세는 작게 보여 준다. */
  size?: 'base' | 'sm';
}

/**
 * 계약 본문(마크다운)을 화면에 렌더링한다. 서명 페이지와 관리자 상세가 같은 모습을 쓰도록
 * 한곳에 모았다. 계약서 서명란의 `<span class="seal">`은 운영자 날인 자리라 이미지를 채운다
 * (PDF는 lib/contracts/pdf.ts가 같은 이미지를 base64로 인라인한다).
 */
export default function ContractContent({ content, size = 'base' }: ContractContentProps) {
  return (
    <div
      className={`contract-body prose max-w-none prose-headings:font-bold prose-th:border prose-td:border prose-th:p-2 prose-td:p-2 prose-table:border-collapse ${
        size === 'sm' ? 'prose-sm' : 'prose-sm md:prose-base'
      }`}
    >
      <Markdown>{content}</Markdown>

      <style jsx global>{`
        .contract-body .seal {
          display: inline-block;
          width: 56px;
          height: 56px;
          background-image: url('/images/contract-seal.png');
          background-size: contain;
          background-position: center;
          background-repeat: no-repeat;
          vertical-align: middle;
        }
      `}</style>
    </div>
  );
}
