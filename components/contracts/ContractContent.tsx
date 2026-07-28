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

        /*
         * 좁은 화면에서 계약서 표는 열이 3개까지 늘어난다. 기본 크기 그대로면 셀 폭이
         * 90px 남짓으로 줄어, 정작 가장 중요한 "금 300,000 원"이 세 줄로 쪼개진다.
         * 글자와 여백을 줄여 한 줄에 담기게 한다.
         */
        @media (max-width: 640px) {
          .contract-body table {
            font-size: 11.5px;
            line-height: 1.5;
          }
          .contract-body th,
          .contract-body td {
            padding: 6px 3px !important;
          }
          /* 금액은 한 줄로 읽혀야 한다. "금 300,000 원"이 쪼개지면 계약의 핵심 숫자를
             잘못 읽기 쉽다. 표는 auto 레이아웃이라 필요한 열이 폭을 더 가져간다. */
          .contract-body td,
          .contract-body th {
            word-break: keep-all;
            overflow-wrap: normal;
          }
          /* 조문 제목이 본문만큼 커서 문서가 두 배로 길어 보이던 것을 조인다. */
          .contract-body h1 {
            font-size: 1.35rem;
            line-height: 1.35;
          }
          .contract-body h2 {
            font-size: 1.05rem;
            line-height: 1.4;
          }
          .contract-body h3 {
            font-size: 0.95rem;
          }
        }

        /* 한국어는 어절 단위로 끊어야 읽힌다 — 글자 단위로 잘리면 금액·조문이 뭉개진다. */
        .contract-body {
          word-break: keep-all;
        }
      `}</style>
    </div>
  );
}
