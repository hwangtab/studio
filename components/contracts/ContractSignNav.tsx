import React from 'react';

import { extractContractHeadings } from '../../lib/contracts/headings';
import { Button } from '../ui/Button';
import { Disclosure } from '../ui/Disclosure';
import { scrollToElementId } from './missingGuide';

/** 서명 칸(전자서명 절)을 감싼 요소의 id — 두 서명 화면이 같은 값을 쓴다. */
export const SIGNATURE_SECTION_ID = 'signature-section';

interface ContractSignNavProps {
  /** 계약 본문(마크다운). 여기서 `## ` 제목을 뽑아 목차를 만든다. */
  content: string;
  /** 문구 말투 — 연습실 화면은 합니다체. */
  formal?: boolean;
}

/**
 * 서명 화면 위쪽의 길잡이 — "서명하러 가기"와 조문 목차.
 *
 * 계약서는 휴대폰에서 16화면이 넘는다. 이미 읽은 사람이 서명 칸까지 한참 내려가거나, 특정 조항으로 되돌아가려고
 * 처음부터 훑지 않게 한다. 둘 다 같은 화면 안에서 스크롤만 옮긴다(움직임 줄이기 설정을 따른다).
 */
export default function ContractSignNav({ content, formal = false }: ContractSignNavProps) {
  const headings = React.useMemo(() => extractContractHeadings(content), [content]);

  return (
    <div className="mb-6 space-y-3">
      <Button type="button" light variant="weak" fullWidth onClick={() => scrollToElementId(SIGNATURE_SECTION_ID)}>
        서명하러 가기 ↓
      </Button>
      <p className="text-center text-xs text-gray-500 dark:text-gray-500">
        {formal ? '계약서를 모두 읽으신 뒤에 서명해 주세요.' : '계약서를 끝까지 읽은 뒤에 서명해 주세요.'}
      </p>

      {headings.length > 1 && (
        <Disclosure
          summary="목차 — 조항으로 바로가기"
          className="dark:border-gray-200"
          summaryClassName="dark:text-gray-900"
          bodyClassName="dark:text-gray-700"
        >
          <nav aria-label="계약서 목차">
            <ol className="-mx-2 divide-y divide-gray-100 dark:divide-gray-100">
              {headings.map((heading) => (
                <li key={heading.id}>
                  <a
                    href={`#${heading.id}`}
                    onClick={(event) => {
                      // 주소의 해시를 바꾸지 않고 옮긴다 — 새로고침·공유 때 엉뚱한 자리로 열리지 않게.
                      if (scrollToElementId(heading.id)) event.preventDefault();
                    }}
                    className="flex min-h-[44px] items-center rounded-lg px-2 py-2 text-sm text-gray-800 hover:bg-gray-50 dark:text-gray-800 dark:hover:bg-gray-50"
                  >
                    {heading.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </Disclosure>
      )}
    </div>
  );
}
