import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';

import { AdminShell } from '../../../../../components/admin/AdminShell';
import ProductionContractForm, {
  productionContractToFormValues,
  toProductionPayload,
  type ProductionContractFormValues,
} from '../../../../../components/admin/ProductionContractForm';
import { mutateProductionContract } from '../../../../../components/admin/productionContractActions';
import { getDb } from '../../../../../db/client';
import { authenticateAdminRequest } from '../../../../../lib/contracts/admin-auth';
import type { ValidationError } from '../../../../../lib/contracts/validation';

interface EditProductionContractPageProps {
  id: string;
  initialValues: ProductionContractFormValues;
}

/** 초안만 고칠 수 있다. 발송 뒤에는 상세로 돌려보낸다 — 고치려면 취소하고 복제한다. */
export const getServerSideProps: GetServerSideProps<EditProductionContractPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }

  const { id } = context.query;
  if (typeof id !== 'string') return { notFound: true };

  const contract = await getDb().query.productionContracts.findFirst({ where: (t, { eq }) => eq(t.id, id) });
  if (!contract) return { notFound: true };
  if (contract.status !== 'draft') {
    return { redirect: { destination: `/admin/contracts/production/${id}`, permanent: false } };
  }

  return { props: { id, initialValues: productionContractToFormValues(contract) } };
};

export default function EditProductionContractPage({ id, initialValues }: EditProductionContractPageProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleSubmit = async (values: ProductionContractFormValues) => {
    setSubmitting(true);
    setErrors([]);
    setGeneralError(null);

    const result = await mutateProductionContract(id, 'update', toProductionPayload(values));
    setSubmitting(false);

    if (!result.ok) {
      if (result.errors) {
        setErrors(result.errors);
        setGeneralError('입력 내용을 확인해 주세요.');
      } else {
        setGeneralError(result.message ?? '저장하지 못했습니다.');
      }
      return;
    }
    await router.replace(`/admin/contracts/production/${id}`);
  };

  return (
    <>
      <Head>
        <title>제작 계약 수정 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <AdminShell
        title="제작 계약 수정"
        description="작성중인 계약만 고칠 수 있습니다."
        width="narrow"
        backHref={`/admin/contracts/production/${id}`}
        backLabel="계약 상세"
      >
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 md:p-8">
            <ProductionContractForm
              initialValues={initialValues}
              submitLabel="저장"
              submitting={submitting}
              errors={errors}
              generalError={generalError}
              onSubmit={handleSubmit}
              onCancel={() => router.push(`/admin/contracts/production/${id}`)}
            />
          </div>
        </div>
      </AdminShell>
    </>
  );
}
