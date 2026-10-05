import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ChoiceCard, ChoiceGroup } from './Choice';
import { Checkbox, Radio } from './Checkbox';
import { Notice } from './Notice';
import { Panel } from './Panel';
import { Badge } from './Badge';
import { PageHeader, PageShell } from './PageHeader';
import { Stepper } from './Stepper';
import { PriceSummary } from './PriceSummary';
import { ResultCard } from './ResultCard';
import { Modal } from './Modal';
import { EmptyState } from './EmptyState';
import { Disclosure } from './Disclosure';
import { FOCUS_RING, FOCUS_RING_WITHIN } from './focusRing';

/**
 * 중간 계층 프리미티브의 **규칙**을 렌더 className으로 고정한다(docs/design-system.md §4·§5,
 * docs/design-ui-refinement-plan-2026-10.md §2). 토큰을 "정리"하다 반경·포커스 링·다크 짝이
 * 조용히 빠지는 것을 막는 것이 목적이지, 픽셀을 재는 것이 아니다.
 */
const classesOf = (el: Element | null): string[] => (el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

const expectFocusRing = (classes: string[]) => {
  for (const c of FOCUS_RING.split(' ')) expect(classes).toContain(c);
};

describe('focusRing 상수', () => {
  it('알파 /70 · 다크 밝은 짝 · 오프셋 표면색을 모두 담는다(§5)', () => {
    expect(FOCUS_RING).toContain('focus-visible:ring-primary/70');
    expect(FOCUS_RING).toContain('dark:focus-visible:ring-primary-lighter/70');
    expect(FOCUS_RING).toContain('focus-visible:ring-offset-white');
    expect(FOCUS_RING).toContain('dark:focus-visible:ring-offset-gray-900');
    expect(FOCUS_RING_WITHIN).toContain('has-[:focus-visible]:ring-primary/70');
    expect(FOCUS_RING_WITHIN).toContain('dark:has-[:focus-visible]:ring-primary-lighter/70');
  });
});

describe('ChoiceCard / ChoiceGroup', () => {
  const Group = ({ variant }: { variant?: 'card' | 'pill' }) => {
    const [v, setV] = useState('a');
    return (
      <ChoiceGroup label="상품 선택" variant={variant}>
        <ChoiceCard variant={variant} name="p" value="a" checked={v === 'a'} onChange={() => setV('a')} title="A" trailing="200,000원" description="설명" />
        <ChoiceCard variant={variant} name="p" value="b" checked={v === 'b'} onChange={() => setV('b')} title="B" />
      </ChoiceGroup>
    );
  };

  it('fieldset/legend로 묶이고 라디오가 그룹 이름을 갖는다', () => {
    render(<Group />);
    expect(screen.getByRole('group', { name: '상품 선택' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: /^A/ })).toBeChecked();
  });

  it('레이블 어디를 눌러도 선택된다', () => {
    render(<Group />);
    fireEvent.click(screen.getByText('B'));
    expect(screen.getByRole('radio', { name: /^B/ })).toBeChecked();
  });

  it('카드 규칙: rounded-xl p-4, 선택은 has-[:checked] 틴트, 입력은 accent-primary, 링은 카드에', () => {
    render(<Group />);
    const label = screen.getByText('A').closest('label');
    const classes = classesOf(label);
    expect(classes).toContain('rounded-xl');
    expect(classes).toContain('p-4');
    expect(classes).toContain('has-[:checked]:border-primary');
    expect(classes).toContain('has-[:checked]:bg-primary/5');
    expect(classes).toContain('dark:has-[:checked]:bg-primary-lighter/10');
    expect(classes).toContain('has-[:focus-visible]:ring-2');
    expect(classes).not.toContain('rounded-md');
    const input = screen.getByRole('radio', { name: /^A/ });
    expect(classesOf(input)).toContain('accent-primary');
    expect(classesOf(input)).not.toContain('text-primary');
  });

  it('알약 규칙: rounded-full, 입력은 sr-only, 포커스 링은 알약에', () => {
    render(<Group variant="pill" />);
    const label = screen.getByText('A').closest('label');
    const classes = classesOf(label);
    expect(classes).toContain('rounded-full');
    expect(classes).toContain('min-h-[44px]');
    expect(classes).toContain('has-[:focus-visible]:ring-2');
    expect(classesOf(screen.getByRole('radio', { name: 'A' }))).toContain('sr-only');
  });

  it('체크박스형도 같은 카드를 쓴다', () => {
    render(
      <ChoiceGroup label="추가 옵션">
        <ChoiceCard type="checkbox" name="o" value="x" title="옵션" />
      </ChoiceGroup>,
    );
    expect(screen.getByRole('checkbox', { name: /옵션/ })).toBeInTheDocument();
  });

  it('error는 role=alert로 읽히고 fieldset에 연결된다', () => {
    render(
      <ChoiceGroup label="상품" error="하나를 고르세요">
        <ChoiceCard name="p" value="a" title="A" />
      </ChoiceGroup>,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('하나를 고르세요');
    expect(screen.getByRole('group').getAttribute('aria-describedby')).toBe(alert.id);
  });
});

describe('Checkbox / Radio', () => {
  it('accent-primary · 20px · focus-visible 링 · 44px 레이블', () => {
    render(<Checkbox label="환불 규정에 동의합니다" hint="필수" />);
    const box = screen.getByRole('checkbox', { name: /환불 규정/ });
    const classes = classesOf(box);
    expect(classes).toContain('accent-primary');
    expect(classes).toContain('h-5');
    expectFocusRing(classes);
    expect(classesOf(box.closest('label'))).toContain('min-h-[44px]');
    expect(box.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText('필수').id).toBe(box.getAttribute('aria-describedby'));
  });

  it('Radio는 type=radio 외에 같다', () => {
    render(<Radio name="r" label="실명" />);
    expect(classesOf(screen.getByRole('radio', { name: '실명' }))).toContain('accent-primary');
  });
});

describe('Notice', () => {
  it('rounded-xl border p-4 + tone 다크 짝', () => {
    const { container } = render(<Notice tone="warning" title="주의">본문</Notice>);
    const classes = classesOf(container.firstElementChild);
    for (const c of ['rounded-xl', 'border', 'p-4', 'border-amber-200', 'bg-amber-50', 'dark:bg-amber-950/40', 'dark:text-amber-200']) {
      expect(classes).toContain(c);
    }
    expect(classes).not.toContain('rounded-md');
  });

  it('error는 alert, success는 status, 나머지는 role 없음', () => {
    render(<Notice tone="error">오류</Notice>);
    expect(screen.getByRole('alert')).toHaveTextContent('오류');
    render(<Notice tone="success">완료</Notice>);
    expect(screen.getByRole('status')).toHaveTextContent('완료');
    const { container } = render(<Notice tone="info">안내</Notice>);
    expect(container.firstElementChild?.getAttribute('role')).toBeNull();
  });

  it('아이콘은 기본 표시, icon={false}면 없음', () => {
    const { container, rerender } = render(<Notice>a</Notice>);
    expect(container.querySelector('svg')).not.toBeNull();
    rerender(<Notice icon={false}>a</Notice>);
    expect(container.querySelector('svg')).toBeNull();
  });
});

describe('Panel', () => {
  it('rounded-xl, 패딩 세 단, 다크 짝', () => {
    const { container, rerender } = render(<Panel title="환불 규정">본문</Panel>);
    const el = container.firstElementChild;
    for (const c of ['rounded-xl', 'p-4', 'bg-gray-50', 'dark:bg-gray-800/50', 'border-gray-200', 'dark:border-gray-700']) {
      expect(classesOf(el)).toContain(c);
    }
    rerender(<Panel padding="roomy">본문</Panel>);
    expect(classesOf(container.firstElementChild)).toContain('sm:p-8');
    rerender(<Panel variant="inset">본문</Panel>);
    expect(classesOf(container.firstElementChild)).not.toContain('border');
  });
});

describe('Badge', () => {
  it('rounded-full · text-xs 600 · 크기 두 단', () => {
    const { container, rerender } = render(<Badge tone="brand">진행 중</Badge>);
    const classes = classesOf(container.firstElementChild);
    for (const c of ['rounded-full', 'text-xs', 'font-semibold', 'px-2', 'py-0.5', 'bg-primary/10', 'dark:text-primary-lighter']) {
      expect(classes).toContain(c);
    }
    rerender(<Badge size="md">마감</Badge>);
    expect(classesOf(container.firstElementChild)).toContain('px-2.5');
  });
});

describe('PageShell / PageHeader', () => {
  it('폭 세 단, 세로 여백 하나, main을 만들지 않는다', () => {
    const { container, rerender } = render(<PageShell>x</PageShell>);
    expect(classesOf(container.firstElementChild)).toEqual(expect.arrayContaining(['max-w-2xl', 'py-12', 'sm:py-16', 'px-4']));
    expect(container.querySelector('main')).toBeNull();
    rerender(<PageShell width="result">x</PageShell>);
    expect(classesOf(container.firstElementChild)).toContain('max-w-lg');
  });

  it('h1은 typo-page-title, 뒤로 링크는 포커스 링과 44px, 브랜드 줄 기본 문구', () => {
    render(<PageHeader brand backHref="/ko/mixing-mastering" backLabel="서비스 소개로" title="온라인 주문" lead="두 단계면 끝납니다" meta={<Badge>STEP</Badge>} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('typo-page-title');
    const back = screen.getByRole('link', { name: /서비스 소개로/ });
    expectFocusRing(classesOf(back));
    expect(classesOf(back)).toContain('min-h-[44px]');
    expect(screen.getByText('스튜디오 놀')).toBeInTheDocument();
    expect(screen.getByText('두 단계면 끝납니다')).toBeInTheDocument();
  });
});

describe('Stepper', () => {
  it('현재 단계에 aria-current=step, sr-only 요약, 완료는 체크', () => {
    const { container } = render(<Stepper steps={['상품', '주문자', '결제']} current={2} />);
    const items = screen.getAllByRole('listitem');
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[0]).not.toHaveAttribute('aria-current');
    expect(screen.getByText('3단계 중 2단계: 주문자')).toHaveClass('sr-only');
    expect(items[0].querySelector('svg')).not.toBeNull();
    expect(container.querySelector('nav')).toHaveAttribute('aria-label', '진행 단계');
  });
});

describe('PriceSummary', () => {
  it('항목·부가세·합계를 dl로, 숫자는 천 단위 구분', () => {
    render(<PriceSummary items={[{ label: '믹싱 · 10트랙 이하', amount: 400000, quantity: 2, unit: '곡' }]} vat={40000} total={440000} />);
    expect(screen.getByText('400,000원')).toBeInTheDocument();
    expect(screen.getByText('40,000원')).toBeInTheDocument();
    expect(screen.getByText('440,000원')).toBeInTheDocument();
    expect(screen.getByText(/× 2곡/)).toBeInTheDocument();
    expect(screen.getByLabelText('금액 요약').querySelector('dl')).not.toBeNull();
  });

  it('음수는 할인으로 표시한다', () => {
    render(<PriceSummary items={[{ label: '4곡 할인', amount: -20000 }]} total={0} />);
    expect(screen.getByText('−20,000원')).toBeInTheDocument();
  });
});

describe('ResultCard', () => {
  it('glass-card rounded-2xl, tone 아이콘 원, 제목 typo-page-title', () => {
    const { container } = render(
      <ResultCard tone="success" title="결제가 완료되었습니다" description="메일을 확인하세요" actions={<button type="button">홈으로</button>} />,
    );
    expect(classesOf(container.firstElementChild)).toEqual(expect.arrayContaining(['glass-card', 'rounded-2xl', 'p-6', 'sm:p-8', 'text-center']));
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('typo-page-title');
    expect(container.querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('button', { name: '홈으로' })).toBeInTheDocument();
  });
});

describe('Modal', () => {
  const Host = ({ onClose = () => {} }: { onClose?: () => void }) => (
    <Modal open onClose={onClose} title="리워드" footer={<button type="button">결제하기</button>}>
      <p>본문</p>
    </Modal>
  );

  it('role=dialog · aria-modal · 제목 연결 · 닫기 버튼에 처음 포커스', () => {
    render(<Host />);
    const dialog = screen.getByRole('dialog', { name: '리워드' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '닫기' }));
  });

  it('ESC와 닫기 버튼이 onClose를 부른다', () => {
    const onClose = jest.fn();
    render(<Host onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('열려 있는 동안 body 스크롤을 잠근다', () => {
    const { unmount } = render(<Host />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('닫혀 있으면 아무것도 그리지 않는다', () => {
    const { container } = render(
      <Modal open={false} onClose={() => {}} title="x">
        y
      </Modal>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('EmptyState', () => {
  it('점선 rounded-2xl, lucide 아이콘(이모지 아님)', () => {
    const { container } = render(<EmptyState title="아직 글이 없습니다" description="곧 올라옵니다" />);
    expect(classesOf(container.firstElementChild)).toEqual(expect.arrayContaining(['rounded-2xl', 'border-dashed']));
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });
});

describe('Disclosure', () => {
  it('details/summary, 마커 숨김, summary에 포커스 링과 44px, onToggle 전달', () => {
    const onToggle = jest.fn();
    const { container } = render(
      <Disclosure summary="먼저 들어 보기" onToggle={onToggle}>
        내용
      </Disclosure>,
    );
    const details = container.querySelector('details')!;
    const summary = container.querySelector('summary')!;
    expect(classesOf(details)).toContain('rounded-xl');
    expect(classesOf(summary)).toContain('list-none');
    expect(classesOf(summary)).toContain('min-h-[44px]');
    expectFocusRing(classesOf(summary));
    fireEvent(details, new Event('toggle'));
    expect(onToggle).toHaveBeenCalled();
  });
});
