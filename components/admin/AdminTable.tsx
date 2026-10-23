import React from 'react';

import { cn } from '../../lib/utils';
import { buttonVariants } from '../ui/Button';
import { DANGER_GHOST_CLASS } from './adminDanger';

/**
 * 관리자 표의 공용 조각 — 행 끝 동작 칸·상태 배지·표 머리.
 *
 * 2026-10-23 운영자 지적("표에 열이 하나도 안 맞고 버튼은 줄바꿈되어 개판"): 화면마다 손으로 짠 표가
 * ① 열 너비를 정하지 않아 같은 화면의 두 표가 서로 다른 열 위치를 갖고, ② 행 끝 버튼이 `flex-wrap`이라 폭이 모자라면
 * 두 줄로 접히고, ③ 상태 배지(연체·자동 갱신 중)가 버튼 칸에 섞여 행마다 버튼 위치가 달랐다.
 *
 * 규칙: 표는 `table-fixed` + `<colgroup>`으로 열 너비를 정한다(같은 화면의 표끼리 같은 너비). 상태는 자기 열에 둔다.
 * 행 끝 버튼은 `RowActions`로 — 줄바꿈하지 않고 오른쪽 정렬, 위험 동작은 구분선 뒤. 표 안 버튼은 `ROW_BTN`(h-9)이다:
 * 표는 lg 이상에서만 그리고(좁은 화면은 카드 목록) 그 폭에서 44px 버튼은 행을 두 배로 키운다.
 */

/** 표 안 보조 버튼 — 공용 Button 모양에서 높이만 줄였다. */
export const ROW_BTN = cn(buttonVariants({ variant: 'secondary', size: 'sm', light: true }), 'h-9 whitespace-nowrap px-2.5');
/** 표 안 위험 버튼(퇴실·삭제). */
export const ROW_BTN_DANGER = cn(ROW_BTN, DANGER_GHOST_CLASS, 'border-red-200');

/**
 * 표 안 보조 동작(계좌 보기·조정 추가처럼 자주 안 누르는 것) — 버튼 줄 아래 작은 글자 링크로. 버튼을 다섯 개씩 늘어놓으면
 * 동작 칸이 표의 절반을 먹고 가로 스크롤이 생긴다. 주 동작·위험 동작만 버튼으로 둔다.
 */
export const ROW_LINK = 'text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50';
export const RowLinks = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-1.5 flex flex-wrap justify-end gap-x-3 gap-y-1">{children}</div>
);

/** 행 끝 동작 칸 — 줄바꿈 없이 오른쪽 정렬. `danger`는 구분선 뒤 끝에 둔다. */
export const RowActions = ({ children, danger, className }: { children?: React.ReactNode; danger?: React.ReactNode; className?: string }) => (
  // 좁은 화면(.admin-table이 행을 카드로 쌓는 1023px 이하)에서는 줄바꿈을 허용한다 — 카드 폭에 버튼 넷이 안 들어간다.
  <div className={cn('flex flex-wrap items-center justify-start gap-1.5 lg:flex-nowrap lg:justify-end', className)}>
    {children}
    {danger && <div className="flex flex-wrap items-center gap-1.5 lg:ml-1 lg:flex-nowrap lg:border-l lg:border-gray-200 lg:pl-2">{danger}</div>}
  </div>
);

/** 상태 배지 — 줄바꿈하지 않는 작은 칩. 여러 개면 세로로 쌓는다(`StatusStack`). */
export const StatusChip = ({ className, children, title }: { className: string; children: React.ReactNode; title?: string }) => (
  <span title={title} className={cn('inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium', className)}>
    {children}
  </span>
);

export const StatusStack = ({ children }: { children: React.ReactNode }) => <div className="flex flex-col items-start gap-1">{children}</div>;

/** 표 머리 칸 — 왼쪽 정렬·회색 작은 글씨. 숫자 열은 `align="right"`. */
export const Th = ({ children, align = 'left', className }: { children?: React.ReactNode; align?: 'left' | 'right'; className?: string }) => (
  <th scope="col" className={cn('py-2 pr-3 text-xs font-medium text-gray-500', align === 'right' && 'text-right', className)}>
    {children}
  </th>
);
