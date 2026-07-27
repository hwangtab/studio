import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

import { Button } from '../../components/ui/Button';

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'x-admin-password': password },
        credentials: 'same-origin',
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.message || '비밀번호가 올바르지 않습니다.');
      }

      await router.replace('/admin/contracts');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>관리자 로그인 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">관리자 로그인</h1>
          <p className="text-gray-600 mb-6">비밀번호를 입력하세요.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
            )}

            <Button type="submit" size="lg" fullWidth disabled={loading || !password}>
              {loading ? '로그인 중...' : '로그인'}
            </Button>
          </form>
        </div>
      </main>
    </>
  );
}
