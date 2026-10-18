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
import { Button } from '../../../../components/ui/Button';
import { parseQuoteSummary, titleWithQuoteCode } from '../../../../lib/contracts/production/quote-prefill';
import { buildDefaultProductionTerms, type ProductionKind } from '../../../../lib/contracts/production/terms';
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
      .query.productionContracts.findFirst({ where: (t, { eq }) => eq(t.id, from), with: { signers: true } })
      .catch((error: unknown) => {
        console.error('[admin/contracts/production/new] Failed to load source contract:', error);
        return null;
      });
    // 파기된 계약은 이름 자리에 표식이 들어 있다 — 복제할 값이 없다.
    if (source && !source.purgedAt) {
      // 같은 의뢰인의 다음 곡이면 법정대리인도 그대로다 — 함께 옮긴다.
      const copied = productionContractToFormValues(source, source.signers.find((signer) => signer.role === 'guardian') ?? null);
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

/**
 * 견적 요약 붙여 넣기 — 카톡으로 받은 견적 요청서 요약에서 견적 번호를 제목에 남기고, 계약과 어긋나는 답을
 * 경고한다(lib/contracts/production/quote-prefill.ts). 금액은 건드리지 않는다.
 */
function QuotePaste({
  onApply,
}: {
  onApply: (code: string | null, kind: ProductionKind | null, warnings: string[]) => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <details className="mb-6 rounded-lg border border-gray-200 p-4 text-sm">
      <summary className="cursor-pointer font-medium text-gray-900">견적 요청서 요약 붙여 넣기 (선택)</summary>
      <p className="mt-2 text-gray-500">카톡으로 받은 “[스튜디오 놀 견적 요청 NOL-…]” 글을 붙여 넣으면 견적 번호를 계약 제목에 남겨요. 폼을 새로 채우므로 다른 칸보다 먼저 쓰세요.</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        className="mt-3 w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900"
      />
      <div className="mt-2 flex items-center gap-3">
        <Button
          light
          type="button"
          variant="weak"
          onClick={() => {
            const parsed = parseQuoteSummary(text);
            if (!parsed) {
              setError('견적 요청서 요약 형식이 아니에요.');
              return;
            }
            setError(null);
            onApply(parsed.code, parsed.kind, parsed.warnings);
          }}
        >
          채우기
        </Button>
        {error && <span className="text-red-600">{error}</span>}
      </div>
    </details>
  );
}

export default function NewProductionContractPage({ initialValues, copiedFrom }: NewProductionContractPageProps) {
  const router = useRouter();
  // 견적을 붙여 넣으면 폼을 새 초기값으로 다시 그린다(key) — 폼은 처음 받은 값만 상태로 들고 있다.
  const [seed, setSeed] = useState({ version: 0, values: initialValues });
  const [quoteWarnings, setQuoteWarnings] = useState<string[]>([]);
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
            <QuotePaste
              onApply={(code, kind, warnings) => {
                setSeed((prev) => {
                  // 발매 규모가 정해지면 그 종류의 기본 조건으로 시작한다(EP 4곡·정규 8곡 — 곡 수는 폼에서 고친다).
                  const nextKind = kind ?? prev.values.kind;
                  const terms =
                    nextKind === prev.values.kind ? prev.values.terms : buildDefaultProductionTerms(nextKind, nextKind === 'ep' ? 4 : 8);
                  return {
                    version: prev.version + 1,
                    values: {
                      ...prev.values,
                      kind: nextKind,
                      terms,
                      title: titleWithQuoteCode(prev.values.title, prev.values.clientName, code),
                    },
                  };
                });
                setQuoteWarnings(warnings);
              }}
            />
            {quoteWarnings.length > 0 && (
              <ul className="mb-6 space-y-2">
                {quoteWarnings.map((warning) => (
                  <li key={warning} className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
                    {warning}
                  </li>
                ))}
              </ul>
            )}
            <ProductionContractForm
              key={`${copiedFrom ?? 'new'}-${seed.version}`}
              initialValues={seed.values}
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
