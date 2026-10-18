import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';

import { AdminShell } from '../../../../components/admin/AdminShell';
import ProductionContractForm, {
  emptyProductionFormValues,
  productionContractToFormValues,
  toProductionPayload,
  type ProductionContractFormValues,
} from '../../../../components/admin/ProductionContractForm';
import { createProductionContractRequest } from '../../../../components/admin/productionContractActions';
import { getDb } from '../../../../db/client';
import { authenticateAdminRequest } from '../../../../lib/contracts/admin-auth';
import type { ValidationError } from '../../../../lib/contracts/validation';

interface NewProductionContractPageProps {
  initialValues: ProductionContractFormValues;
  /** 복제 원본의 의뢰인 이름 — 무엇을 복제했는지 화면에 알린다. */
  copiedFrom?: string;
}

/**
 * 새 제작 계약. ?from=<계약 id>면 그 계약의 의뢰인·조건을 채운다(같은 의뢰인의 다음 곡, 또는 취소 후 고쳐 다시
 * 보낼 때 — 발송 후에는 수정이 막히므로 복제가 고치는 길이다). 연습실 new.tsx와 같다.
 */
export const getServerSideProps: GetServerSideProps<NewProductionContractPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }

  const { from } = context.query;
  if (typeof from === 'string' && from.trim() !== '') {
    const source = await getDb()
      .query.productionContracts.findFirst({ where: (t, { eq }) => eq(t.id, from) })
      .catch((error: unknown) => {
        console.error('[admin/contracts/production/new] Failed to load source contract:', error);
        return null;
      });
    // 파기된 계약은 이름 자리에 표식이 들어 있다 — 복제할 값이 없다.
    if (source && !source.purgedAt) {
      const copied = productionContractToFormValues(source);
      return {
        props: {
          // 제목·곡 제목은 옮기지 않는다 — 다음 곡 계약에 옛 제목이 남으면 고치는 것을 잊기 쉽다.
          initialValues: { ...copied, title: '', terms: { ...copied.terms, songTitle: null } },
          copiedFrom: source.clientName,
        },
      };
    }
  }

  return { props: { initialValues: emptyProductionFormValues() } };
};

export default function NewProductionContractPage({ initialValues, copiedFrom }: NewProductionContractPageProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleSubmit = async (values: ProductionContractFormValues) => {
    setSubmitting(true);
    setErrors([]);
    setGeneralError(null);

    const result = await createProductionContractRequest(toProductionPayload(values));
    setSubmitting(false);

    if (!result.ok || !result.id) {
      if (result.errors) {
        setErrors(result.errors);
        setGeneralError('입력 내용을 확인해 주세요.');
      } else {
        setGeneralError(result.message ?? '계약 생성에 실패했습니다.');
      }
      return;
    }
    await router.replace(`/admin/contracts/production/${result.id}`);
  };

  return (
    <>
      <Head>
        <title>새 제작 계약 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <AdminShell
        title="새 제작 계약"
        description="저장하면 작성중 상태로 보관됩니다. 계약서를 확인한 뒤 서명하고 발송하세요."
        width="narrow"
        backHref="/admin/contracts/production"
        backLabel="제작 계약 목록"
      >
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 md:p-8">
            {copiedFrom && (
              <div className="mb-6 p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg text-sm">
                {copiedFrom}님의 계약을 복제했습니다. <strong>곡 제목과 금액을 확인해 주세요.</strong>
              </div>
            )}
            <ProductionContractForm
              key={copiedFrom ?? 'new'}
              initialValues={initialValues}
              submitLabel="작성중으로 저장"
              submitting={submitting}
              errors={errors}
              generalError={generalError}
              onSubmit={handleSubmit}
              onCancel={() => router.push('/admin/contracts/production')}
            />
          </div>
        </div>
      </AdminShell>
    </>
  );
}
