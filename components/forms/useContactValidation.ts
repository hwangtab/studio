import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { contactErrorCopy, type ContactLocale } from '../../lib/contact/copy';
import {
  contactFieldProblem,
  contactProblems,
  type ContactField,
  type ContactReason,
  type ContactValues,
  type PhoneRule,
} from '../../lib/contact/rules';

export type ContactErrors = Partial<Record<ContactField, string>>;

/**
 * 결제 화면 주문자 칸(이름·휴대폰·이메일)의 검사 상태. 판정은 lib/contact/rules.ts(서버와 같은 정본)이다.
 *
 * - 제출 전에는 아무것도 띄우지 않는다. 제출(`validate`)에서 처음 판정하고, 그 뒤로는 입력할 때마다 그 칸만
 *   다시 판정한다(`recheck`) — 한 글자 쳤다고 오류가 사라졌다가 여전히 틀린 값으로 제출되는 일이 없게.
 * - 실패하면 렌더가 끝난 뒤(effect) 첫 오류 칸으로 포커스를 옮긴다. 그래야 그 칸의 aria-describedby(오류 문구)가
 *   이미 DOM에 있다. 칸을 id가 아니라 `[aria-invalid="true"]`로 찾는다.
 */
export function useContactValidation({ rule = 'kr-mobile', locale = 'ko' }: { rule?: PhoneRule; locale?: ContactLocale } = {}) {
  const [problems, setProblems] = useState<Partial<Record<ContactField, ContactReason>>>({});
  const [attempt, setAttempt] = useState(0);
  const submittedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const errors = useMemo<ContactErrors>(() => {
    const out: ContactErrors = {};
    for (const [field, reason] of Object.entries(problems) as [ContactField, ContactReason][]) {
      out[field] = contactErrorCopy(field, reason, locale, rule);
    }
    return out;
  }, [problems, locale, rule]);
  const errorCount = Object.keys(errors).length;

  /** 제출 때 부른다. 통과면 true. */
  const validate = useCallback((values: ContactValues): boolean => {
    submittedRef.current = true;
    const list = contactProblems(values, rule);
    setProblems(Object.fromEntries(list.map((p) => [p.field, p.reason])));
    if (list.length > 0) setAttempt((n) => n + 1);
    return list.length === 0;
  }, [rule]);

  /** 입력할 때 부른다 — 한 번 제출한 뒤에만 그 칸을 다시 판정한다. */
  const recheck = useCallback((field: ContactField, value: string) => {
    if (!submittedRef.current) return;
    const reason = contactFieldProblem(field, value, rule);
    setProblems((prev) => {
      if ((prev[field] ?? null) === reason) return prev;
      const { [field]: _removed, ...rest } = prev;
      return reason ? { ...rest, [field]: reason } : rest;
    });
  }, [rule]);

  useEffect(() => {
    if (attempt === 0) return;
    containerRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [attempt]);

  return { errors, errorCount, attempt, validate, recheck, containerRef, locale };
}

export type ContactValidation = ReturnType<typeof useContactValidation>;
