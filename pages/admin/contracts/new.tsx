import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';

import ContractForm, {
  toContractPayload,
  type ContractFormValues,
} from '../../../components/admin/ContractForm';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import type { ValidationError } from '../../../lib/contracts/validation';

export const getServerSideProps: GetServerSideProps = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }
  return { props: {} };
};

export default function NewContractPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleSubmit = async (values: ContractFormValues) => {
    setSubmitting(true);
    setErrors([]);
    setGeneralError(null);

    try {
      const response = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(toContractPayload(values)),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        if (Array.isArray(result.errors)) {
          setErrors(result.errors);
          setGeneralError('입력 내용을 확인해 주세요.');
        } else {
          setGeneralError(result.message || '계약 생성에 실패했습니다.');
        }
        return;
      }

      await router.replace(`/admin/contracts/${result.contract.id}`);
    } catch {
      setGeneralError('네트워크 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>새 계약 작성 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <main className="min-h-screen bg-gray-50 py-8 md:py-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-primary p-6 md:p-8">
              <h1 className="text-2xl md:text-3xl font-bold text-white">새 계약 작성</h1>
              <p className="text-white/80 mt-2">
                저장하면 작성중 상태로 보관됩니다. 내용을 확인한 뒤 발송하세요.
              </p>
            </div>

            <div className="p-6 md:p-8">
              <ContractForm
                submitLabel="작성중으로 저장"
                submitting={submitting}
                errors={errors}
                generalError={generalError}
                onSubmit={handleSubmit}
                onCancel={() => router.push('/admin/contracts')}
              />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
