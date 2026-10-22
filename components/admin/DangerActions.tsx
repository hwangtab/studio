import React from 'react';

import { cn } from '../../lib/utils';
import { DANGER_GROUP_CLASS } from './adminDanger';

/** 동작 줄 끝의 위험 동작 묶음(adminDanger.ts DANGER_GROUP_CLASS). 보일 버튼이 하나도 없으면 아무것도 그리지 않는다(빈 구분선 방지). */
export const DangerActions = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const visible = React.Children.toArray(children).filter(Boolean);
  if (visible.length === 0) return null;
  return <div className={cn(DANGER_GROUP_CLASS, className)}>{visible}</div>;
};

export default DangerActions;

/** 상황에 따라 위험 동작일 때만 끝 묶음으로 가른다(예: 공연 '회차 취소' ↔ 취소 뒤 '환불 이어서 처리'). */
export const DangerSlot = ({ danger, children }: { danger: boolean; children: React.ReactNode }) =>
  danger ? <DangerActions>{children}</DangerActions> : <>{children}</>;
