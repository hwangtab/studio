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
 *
 * ## 색을 직접 못박는 이유
 *
 * 이 문서는 다크 모드를 따라가면 안 된다. 발급되는 PDF가 흰 종이이므로, 화면에서 읽은 것과
 * 손에 쥐는 문서가 같아야 한다. 게다가 사이트 전역 스타일(globals.css)은 본문에
 * `dark:text-gray-200`, 조문 제목에 `dark:text-white`를 걸어 두는데 계약 카드는 흰색이라,
 * 그대로 두면 흰 바탕에 흰 글씨가 된다 — 화면이 깨져 보이지도 않아서 고객은 본문이 원래
 * 없는 줄 알고 서명한다. 읽을 수 없는 문서에 받은 서명은 나중에 설명할 수가 없다.
 *
 * ## 스타일을 여기 두는 이유
 *
 * @tailwindcss/typography를 쓰지 않으므로 `prose-*` 변형은 CSS를 만들지 않는다. 표 테두리와
 * 각 호 번호가 화면에서만 사라져 PDF와 다른 문서처럼 보이던 것을, 아래 규칙으로 맞춘다.
 * 값은 lib/contracts/pdf-html.ts의 인쇄용 CSS와 같은 것을 쓴다 — 한쪽을 고치면 다른 쪽도
 * 같이 고쳐야 화면과 문서가 어긋나지 않는다.
 */
export default function ContractContent({ content, size = 'base' }: ContractContentProps) {
  return (
    <div className={`contract-body ${size === 'sm' ? 'contract-body--sm' : ''}`}>
      <Markdown>{content}</Markdown>

      <style jsx global>{`
        /*
         * 계약 본문은 라이트 고정. 색을 여기서 전부 못박아 전역 다크 규칙이 닿지 않게 한다.
         * (.contract-body 로 시작하는 셀렉터는 유틸리티 클래스보다 우선순위가 높다.)
         */
        .contract-body {
          color: #1f2937;
          font-size: 0.95rem;
          line-height: 1.75;
          /* 한국어는 어절 단위로 끊어야 읽힌다 — 글자 단위로 잘리면 금액·조문이 뭉개진다. */
          word-break: keep-all;
        }
        .contract-body--sm {
          font-size: 0.875rem;
        }

        /*
         * 조문 제목은 :is()로 우선순위를 올려야 한다.
         *
         * globals.css는 h1~h6에 dark:text-white을 걸어 두는데, 다크 모드에서 그것이
         * ".dark h1"이 되어 제목에 색을 직접 지정한다. ".contract-body h1"과 점수가
         * 같아서(0,1,1) 어느 쪽이 이길지는 두 스타일이 문서에 실리는 순서에 달리는데,
         * styled-jsx는 런타임 주입이라 그 순서를 믿을 수 없다.
         * :is(.contract-body, .dark .contract-body) 는 인자 중 가장 높은 점수를 따르므로
         * 0,2,1이 되어 확실히 이긴다.
         *
         * 본문 문단·표 칸은 globals가 body에만 색을 걸어 상속으로 내려오는 것이라,
         * 여기서 직접 지정하는 것만으로 이미 이긴다.
         */
        :is(.contract-body, .dark .contract-body) h1,
        :is(.contract-body, .dark .contract-body) h2,
        :is(.contract-body, .dark .contract-body) h3,
        :is(.contract-body, .dark .contract-body) h4,
        :is(.contract-body, .dark .contract-body) h5,
        :is(.contract-body, .dark .contract-body) h6,
        :is(.contract-body, .dark .contract-body) strong,
        :is(.contract-body, .dark .contract-body) th {
          color: #111827;
        }
        :is(.contract-body, .dark .contract-body) p,
        :is(.contract-body, .dark .contract-body) li,
        :is(.contract-body, .dark .contract-body) td,
        :is(.contract-body, .dark .contract-body) blockquote {
          color: #1f2937;
        }

        .contract-body h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0 0 0.75rem;
          line-height: 1.35;
        }
        .contract-body h2 {
          font-size: 1.15rem;
          font-weight: 700;
          margin: 1.5rem 0 0.5rem;
          line-height: 1.4;
        }
        .contract-body h3 {
          font-size: 1rem;
          font-weight: 700;
          margin: 1.25rem 0 0.4rem;
        }
        .contract-body p {
          margin: 0.6rem 0;
        }

        /* 아래 표·목록·인용 값은 pdf-html.ts의 인쇄 CSS와 같은 것이다. */
        .contract-body table {
          width: 100%;
          border-collapse: collapse;
          margin: 0.75rem 0;
        }
        .contract-body th,
        .contract-body td {
          border: 1px solid #d4d4d4;
          padding: 7px 9px;
          text-align: left;
          vertical-align: top;
        }
        .contract-body th {
          background: #f5f5f5;
        }

        /* 각 호의 번호가 없으면 "제6조 제3호"를 짚을 수 없다 — 조문 인용이 불가능해진다. */
        .contract-body ol {
          list-style-type: decimal;
          margin: 0.4rem 0;
          padding-left: 20px;
        }
        .contract-body ul {
          list-style-type: disc;
          margin: 0.4rem 0;
          padding-left: 20px;
        }
        .contract-body li {
          margin: 3px 0;
        }

        .contract-body blockquote {
          margin: 0.65rem 0;
          padding: 10px 14px;
          background: #f6f8fa;
          border-left: 3px solid #d4d4d4;
        }
        .contract-body hr {
          border: none;
          border-top: 1px solid #e5e5e5;
          margin: 1.15rem 0;
        }

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
            padding: 6px 3px;
            /* 금액은 한 줄로 읽혀야 한다. "금 300,000 원"이 쪼개지면 계약의 핵심 숫자를
               잘못 읽기 쉽다. 표는 auto 레이아웃이라 필요한 열이 폭을 더 가져간다. */
            word-break: keep-all;
            overflow-wrap: normal;
          }
          /* 조문 제목이 본문만큼 커서 문서가 두 배로 길어 보이던 것을 조인다. */
          .contract-body h1 {
            font-size: 1.35rem;
          }
          .contract-body h2 {
            font-size: 1.05rem;
          }
          .contract-body h3 {
            font-size: 0.95rem;
          }
        }
      `}</style>
    </div>
  );
}
