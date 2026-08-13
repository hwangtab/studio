import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';

import ContractForm, {
  toContractPayload,
  type ContractFormValues,
} from '../../../components/admin/ContractForm';
import { getDb } from '../../../db/client';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { contractToFormValues } from '../../../lib/contracts/form-values';
import type { ValidationError } from '../../../lib/contracts/validation';

interface NewContractPageProps {
  /** 복제해서 시작하는 경우 채워 둘 값. 없으면 빈 폼이다. */
  initialValues?: ContractFormValues;
  /** 복제 원본의 고객 이름 — 무엇을 복제했는지 화면에 알린다. */
  copiedFrom?: string;
}

export const getServerSideProps: GetServerSideProps<NewContractPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }

  /**
   * ?from=<계약id> 로 들어오면 그 계약의 값을 채워 준다.
   *
   * 같은 고객의 재계약이나 갱신을 만들 때 이름·연락처·주소·호실·금액을 다시 타이핑하는
   * 것은 그 자체로 오타가 생기는 자리다. 기간만 새로 정하면 되도록 나머지를 옮겨 온다.
   */
  const { from } = context.query;
  if (typeof from === 'string' && from.trim() !== '') {
    const source = await getDb()
      .query.contracts.findFirst({ where: (contracts, { eq }) => eq(contracts.id, from) })
      .catch((error: unknown) => {
        console.error('[admin/contracts/new] Failed to load source contract:', error);
        return null;
      });

    if (source) {
      const { values } = contractToFormValues(source, { clearPeriod: true });
      return { props: { initialValues: values, copiedFrom: source.customerName } };
    }
  }

  return { props: {} };
};

export default function NewContractPage({ initialValues, copiedFrom }: NewContractPageProps) {
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
        // 401은 세션이 끊긴 것이다. 서버가 주는 'Unauthorized'를 그대로 보여 주면
        // 무엇을 해야 하는지 알 수 없다. 입력값은 화면에 그대로 남아 있으므로,
        // 다른 탭에서 로그인한 뒤 다시 저장하면 된다.
        if (response.status === 401) {
          setGeneralError(
            '로그인이 만료되었습니다. 새 탭에서 /admin/login 으로 다시 로그인한 뒤 이 화면에서 저장을 다시 눌러 주세요. 입력하신 내용은 그대로 있습니다.',
          );
          return;
        }
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
              {copiedFrom && (
                <div className="mb-6 p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg text-sm">
                  {copiedFrom}님의 계약을 복제했습니다. <strong>이용 기간을 새로 정해 주세요.</strong>{' '}
                  나머지 항목은 필요하면 고치면 됩니다.
                </div>
              )}

              <ContractForm
                initialValues={initialValues}
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
