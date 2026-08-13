import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';

import ContractForm, {
  toContractPayload,
  type ContractFormValues,
} from '../../../../components/admin/ContractForm';
import { getDb } from '../../../../db/client';
import { authenticateAdminRequest } from '../../../../lib/contracts/admin-auth';
import { contractToFormValues } from '../../../../lib/contracts/form-values';
import { getEffectiveStatus, isActionAllowed } from '../../../../lib/contracts/status';
import type { ValidationError } from '../../../../lib/contracts/validation';

interface EditContractPageProps {
  contractId: string;
  initialValues: ContractFormValues;
  /** 저장된 특약사항을 읽지 못했다. 그대로 저장하면 특약이 사라진다. */
  specialTermsUnreadable: boolean;
}

/** ISO 문자열을 <input type="date">가 받는 YYYY-MM-DD로 자른다. */
/**
 * 특약사항을 폼에 되살린다.
 *
 * 읽지 못한 값을 조용히 빈 배열로 넘기면, 관리자가 눈치채지 못한 채 저장해 특약이
 * 사라진다. 읽기에 실패했다는 사실을 그대로 돌려 화면에서 경고하게 한다.
 */
export const getServerSideProps: GetServerSideProps<EditContractPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }

  const { id } = context.query;
  if (typeof id !== 'string') {
    return { notFound: true };
  }

  const contract = await getDb().query.contracts
    .findFirst({ where: (contracts, { eq }) => eq(contracts.id, id) })
    .catch(() => null);

  if (!contract) {
    return { notFound: true };
  }

  // 발송된 계약의 본문을 바꾸면 고객이 이미 본 문서와 달라진다. 상세 화면으로 돌려보낸다.
  if (!isActionAllowed(getEffectiveStatus(contract), 'update')) {
    return { redirect: { destination: `/admin/contracts/${id}`, permanent: false } };
  }

  const { values, specialTermsUnreadable } = contractToFormValues(contract);

  return {
    props: {
      contractId: contract.id,
      initialValues: values,
      specialTermsUnreadable,
    },
  };
};

export default function EditContractPage({
  contractId,
  initialValues,
  specialTermsUnreadable,
}: EditContractPageProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleSubmit = async (values: ContractFormValues) => {
    setSubmitting(true);
    setErrors([]);
    setGeneralError(null);

    try {
      const response = await fetch(`/api/contracts/${contractId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'update', ...toContractPayload(values) }),
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
          setGeneralError(result.message || '계약 수정에 실패했습니다.');
        }
        return;
      }

      await router.replace(`/admin/contracts/${contractId}`);
    } catch {
      setGeneralError('네트워크 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>계약 수정 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <main className="min-h-screen bg-gray-50 py-8 md:py-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-primary p-6 md:p-8">
              <h1 className="text-2xl md:text-3xl font-bold text-white">계약 수정</h1>
              <p className="text-white/80 mt-2">
                저장하면 계약 본문이 새로 작성됩니다. 발송 전에만 수정할 수 있습니다.
              </p>
            </div>

            <div className="p-6 md:p-8">
              {specialTermsUnreadable && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
                  <strong className="block mb-1">저장된 특약사항을 읽지 못했습니다</strong>
                  이대로 저장하면 기존 특약이 사라집니다. 필요한 내용을 다시 입력해 주세요.
                </div>
              )}

              <ContractForm
                initialValues={initialValues}
                submitLabel="수정 내용 저장"
                submitting={submitting}
                errors={errors}
                generalError={generalError}
                onSubmit={handleSubmit}
                onCancel={() => router.push(`/admin/contracts/${contractId}`)}
              />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
