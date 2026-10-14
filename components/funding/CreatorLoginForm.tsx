import Link from 'next/link';
import { useState, type FormEvent } from 'react';

import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { Notice } from '../ui/Notice';

interface CreatorLoginFormProps {
  /** 계정을 만드는 조건을 담은 약관 — 펀딩은 개설자 약관, 공연은 주최자 약관. */
  terms: { href: string; label: string; purpose: string; condition: string };
  className?: string;
}

/**
 * 개설자·주최자 공용 이메일 로그인 폼. 같은 계정(funding_creators)에 같은 매직링크
 * API(/api/funding/creator/login)로 들어온다 — 펀딩 신청과 공연 안내 페이지가 함께 쓴다.
 */
export default function CreatorLoginForm({ terms, className = 'mt-10' }: CreatorLoginFormProps) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/funding/creator/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) setError(data?.message ?? '잠시 후 다시 시도해 주세요.');
      else setSent(true);
    } catch {
      setError('연결에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={`${className} space-y-3`}>
      <Field id="email" label="이메일 주소" required>
        <TextInput
          type="email" required value={email} autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </Field>
      <Button type="submit" size="lg" fullWidth disabled={busy}>
        {busy ? '보내는 중…' : '로그인 링크 받기'}
      </Button>
      {sent && <Notice tone="success">로그인 링크를 보냈어요. 메일함을 확인해 주세요.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <p className="text-sm text-gray-500 dark:text-gray-400">비밀번호는 없어요. 메일로 받은 링크로 들어와요.</p>
      {/*
        이 버튼 한 번에 개설자 계정(funding_creators 행)이 만들어진다 — lib/funding/creatorToken.ts가
        이메일을 받는 즉시 행을 넣는다. 그래서 "로그인 링크를 받는다"가 곧 수집 시점이고, 그 사실과
        처리방침을 누르기 전에 보여야 한다(2026-09-21 문서·코드 대조에서 링크가 0건이었다).
      */}
      <p className="text-sm text-gray-500 dark:text-gray-400">
        이 버튼을 누르면 입력하신 이메일로 {terms.purpose} 계정이 만들어집니다. 수집·이용·보관은{' '}
        <Link href="/ko/privacy-policy" className="underline">개인정보 처리방침</Link>을, {terms.condition}은{' '}
        <Link href={terms.href} className="underline">{terms.label}</Link>을 확인해 주세요.
      </p>
    </form>
  );
}
