import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';

import ContractForm, {
  toContractPayload,
  type ContractFormValues,
} from '../../../../components/admin/ContractForm';
import { db } from '../../../../db/client';
import { authenticateAdminRequest } from '../../../../lib/contracts/admin-auth';
import { getEffectiveStatus, isActionAllowed } from '../../../../lib/contracts/status';
import type { ValidationError } from '../../../../lib/contracts/validation';

interface EditContractPageProps {
  contractId: string;
  initialValues: ContractFormValues;
}

/** ISO 문자열을 <input type="date">가 받는 YYYY-MM-DD로 자른다. */
const toDateInputValue = (date: Date | null): string => {
  if (!date) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const parseSpecialTerms = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
};

export const getServerSideProps: GetServerSideProps<EditContractPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }

  const { id } = context.query;
  if (typeof id !== 'string') {
    return { notFound: true };
  }

  const contract = await db.query.contracts
    .findFirst({ where: (contracts, { eq }) => eq(contracts.id, id) })
    .catch(() => null);

  if (!contract) {
    return { notFound: true };
  }

  // 발송된 계약의 본문을 바꾸면 고객이 이미 본 문서와 달라진다. 상세 화면으로 돌려보낸다.
  if (!isActionAllowed(getEffectiveStatus(contract), 'update')) {
    return { redirect: { destination: `/admin/contracts/${id}`, permanent: false } };
  }

  return {
    props: {
      contractId: contract.id,
      initialValues: {
        title: contract.title,
        customerName: contract.customerName,
        customerBirthdate: contract.customerBirthdate ?? '',
        customerEmail: contract.customerEmail,
        customerPhone: contract.customerPhone,
        customerAddress: contract.customerAddress ?? '',
        roomNumber: contract.roomNumber,
        roomArea: contract.roomArea ?? '',
        startDate: toDateInputValue(contract.startDate),
        endDate: toDateInputValue(contract.endDate),
        monthlyRent: String(contract.monthlyRent),
        depositAmount: String(contract.depositAmount),
        paymentDay: String(contract.paymentDay),
        specialTerms: parseSpecialTerms(contract.specialTerms),
      },
    },
  };
};

export default function EditContractPage({ contractId, initialValues }: EditContractPageProps) {
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
