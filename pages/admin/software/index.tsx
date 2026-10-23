import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useState } from 'react';

import { AdminShell } from '../../../components/admin/AdminShell';
import { ROW_BTN, ROW_BTN_DANGER, RowActions } from '../../../components/admin/AdminTable';
import { Notice } from '../../../components/ui/Notice';
import { SOFTWARE_PRODUCTS } from '../../../data/software/catalog';
import { SOFTWARE_SALES_OPEN } from '../../../data/software/policy';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { recordAdminPrivacyAccess } from '../../../lib/privacy/accessLog';
import { listAdminLicenses, type AdminLicenseRow } from '../../../lib/software/service';
import { buttonVariants } from '../../../components/ui/Button';
import { formatAdminDateTime } from '../../../lib/admin/displayDate';

const LICENSE_LIST_LIMIT = 100;

interface Props {
  licenses: AdminLicenseRow[];
  /** 최근 100건에서 잘렸는가 — 오래된 라이선스는 검색으로 찾는다. */
  truncated?: boolean;
  products: { slug: string; title: string; published: boolean }[];
  q: string;
  salesOpen: boolean;
  error?: string;
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };
  const q = typeof context.query.q === 'string' ? context.query.q.slice(0, 100) : '';
  const products = SOFTWARE_PRODUCTS.map((p) => ({ slug: p.slug, title: p.title, published: p.published }));
  try {
    const fetched = await listAdminLicenses(q, LICENSE_LIST_LIMIT + 1);
    // 열람 기록 — 라이선스 받은 사람의 이메일이 실린다. 검색 화면이라 행마다가 아니라 화면을 연 한 번에 한 줄,
    // 건수만 적는다(검색어는 이메일일 수 있어 적지 않는다). 기록 실패가 화면을 막지 않는다.
    await recordAdminPrivacyAccess(context.req, auth.actor, 'software_license_list_view', 'licenses', 'success', Math.min(fetched.length, LICENSE_LIST_LIMIT)).catch(
      (error: unknown) => console.error('[privacy] 접속기록 호출 실패 — 화면은 계속됩니다', error),
    );
    return { props: { licenses: fetched.slice(0, LICENSE_LIST_LIMIT), truncated: fetched.length > LICENSE_LIST_LIMIT, products, q, salesOpen: SOFTWARE_SALES_OPEN } };
  } catch (error: unknown) {
    console.error('[admin/software] 조회 실패:', error);
    await recordAdminPrivacyAccess(context.req, auth.actor, 'software_license_list_view', 'licenses', 'error').catch(
      (e: unknown) => console.error('[privacy] 접속기록 호출 실패 — 화면은 계속됩니다', e),
    );
    return { props: { licenses: [], products, q, salesOpen: SOFTWARE_SALES_OPEN, error: '라이선스를 불러오지 못했습니다. 운영 DB에 마이그레이션 0054가 적용됐는지 확인해 주세요.' } };
  }
};

const SOURCE_LABEL: Record<string, string> = { manual: '수동 발급', toss: '국내 결제', overseas: '해외 결제' };
const STATUS_LABEL: Record<string, string> = { active: '사용 중', revoked: '취소', refunded: '환불' };
const kst = (iso: string) => formatAdminDateTime(iso);

const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70';
const buttonClass = buttonVariants({ variant: 'solid', size: 'sm', light: true });
const linkButtonClass = 'text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70';

const post = async (url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> | null }> => {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: res.ok && data?.ok === true, data };
};

function IssueForm({ products }: { products: Props['products'] }) {
  const [mode, setMode] = useState<'manual' | 'order'>('manual');
  const [form, setForm] = useState({ productSlug: products[0]?.slug ?? '', email: '', customerName: '', note: '', maxActivations: '', orderNo: '' });
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ key: string; emailed: boolean; mailError: string | null } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const body = mode === 'order'
      ? { orderNo: form.orderNo, note: form.note }
      : { productSlug: form.productSlug, email: form.email, customerName: form.customerName, note: form.note, maxActivations: form.maxActivations, sendEmail };
    const r = await post('/api/admin/software/licenses', body);
    setBusy(false);
    if (r.ok) setIssued({ key: String(r.data?.licenseKey ?? ''), emailed: r.data?.emailed === true, mailError: (r.data?.mailError as string | null) ?? null });
    else setMessage(String(r.data?.message ?? '발급하지 못했습니다.'));
  };

  if (issued) {
    return (
      <div className="space-y-3">
        <Notice tone={issued.mailError ? 'warning' : 'success'} light title="발급했습니다">
          <p className="font-mono text-base tracking-wide">{issued.key}</p>
          <p className="mt-1">
            {issued.emailed ? '받는 분에게 키 메일을 보냈습니다.' : issued.mailError ? `키 메일을 보내지 못했습니다(${issued.mailError}) — 목록의 "키 메일 보내기"로 다시 보내 주세요.` : '이 키를 받는 분께 전해 주세요.'}
            {' '}아래 목록에서도 다시 볼 수 있습니다.
          </p>
        </Notice>
        <button type="button" className={buttonVariants({ variant: 'weak', size: 'sm', light: true })} onClick={() => window.location.reload()}>목록 새로고침</button>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
      <label className="block md:col-span-2">
        <span className="mb-1 block text-xs text-gray-600">발급 종류</span>
        <select value={mode} onChange={(e) => setMode(e.target.value as 'manual' | 'order')} className={inputClass}>
          <option value="manual">결제 없이 발급 — 플러그인 시험·리뷰어·증정</option>
          <option value="order">결제됐는데 라이선스가 없는 주문에 발급</option>
        </select>
      </label>
      {mode === 'order' ? (
        <label className="block md:col-span-2">
          <span className="mb-1 block text-xs text-gray-600">주문번호(SWR-…) — 그 주문의 상품·구매자 이메일로 발급하고 고객에게 키 메일을 보냅니다</span>
          <input required value={form.orderNo} onChange={set('orderNo')} maxLength={40} className={inputClass} />
        </label>
      ) : products.length === 0 ? (
        <p className="text-gray-600 md:col-span-2">data/software/catalog.ts에 상품이 없습니다. 상품을 먼저 올리면 여기서 시험·증정 키를 발급할 수 있습니다.</p>
      ) : (
        <>
          <label className="block">
            <span className="mb-1 block text-xs text-gray-600">상품</span>
            <select value={form.productSlug} onChange={set('productSlug')} className={inputClass}>
              {products.map((p) => <option key={p.slug} value={p.slug}>{p.title}{p.published ? '' : ' (비공개)'}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-gray-600">받는 분 이메일</span>
            <input type="email" required value={form.email} onChange={set('email')} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-gray-600">이름(선택)</span>
            <input value={form.customerName} onChange={set('customerName')} maxLength={80} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-gray-600">기기 수(비우면 상품 기본값)</span>
            <input type="number" min={1} max={50} inputMode="numeric" value={form.maxActivations} onChange={set('maxActivations')} className={inputClass} />
          </label>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="h-4 w-4 accent-primary" />
            받는 분에게 키와 사용법을 메일로 보내기
          </label>
        </>
      )}
      <label className="block md:col-span-2">
        <span className="mb-1 block text-xs text-gray-600">메모(선택)</span>
        <input value={form.note} onChange={set('note')} maxLength={200} className={inputClass} />
      </label>
      <div className="flex items-center gap-3 md:col-span-2">
        <button type="submit" disabled={busy || (mode === 'manual' && products.length === 0)} className={buttonClass}>{busy ? '발급 중…' : '키 발급'}</button>
        {message && <span role="alert" className="text-sm text-red-700">{message}</span>}
      </div>
    </form>
  );
}

function LicenseRow({ row }: { row: AdminLicenseRow }) {
  const [state, setState] = useState<string | null>(null);
  const act = async (body: Record<string, unknown>, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    setState('처리 중…');
    const r = await post(`/api/admin/software/licenses/${row.id}`, body);
    if (r.ok) window.location.reload();
    else setState(String(r.data?.message ?? '처리하지 못했습니다.'));
  };
  const refund = async (orderNo: string) => {
    const warn = row.firstActivatedAt ? '\n\n이 라이선스는 이미 활성화됐습니다(하자·분쟁 대응일 때만).' : '';
    if (!window.confirm(`주문 ${orderNo}을 전액 환불할까요? 라이선스는 환불 상태가 되어 새 기기를 받지 않습니다.${warn}`)) return;
    setState('환불 중…');
    const r = await post(`/api/admin/software/orders/${orderNo}`, { action: 'refund' });
    if (r.ok) window.location.reload();
    else setState(String(r.data?.message ?? '환불하지 못했습니다.'));
  };
  return (
    <tr className="border-t border-gray-100 align-top">
      <td className="py-2 pr-3">
        <span className="font-mono">{row.licenseKey}</span>
        <span className="block text-xs text-gray-500">{row.productSlug} · {SOURCE_LABEL[row.source] ?? row.source}{row.orderNo ? ` · ${row.orderNo}` : ''}</span>
        {row.note && <span className="block text-xs text-gray-500">{row.note}</span>}
      </td>
      <td data-label="받는 분" className="py-2 pr-3">{row.email}{row.customerName && <span className="block text-xs text-gray-500">{row.customerName}</span>}</td>
      <td data-label="발급" className="py-2 pr-3 text-xs">{kst(row.issuedAt)}{row.firstActivatedAt && <span className="block text-gray-500">첫 활성화 {kst(row.firstActivatedAt)}</span>}</td>
      <td data-label="기기" className="py-2 pr-3">
        <span className="tabular-nums">{row.activations.length} / {row.maxActivations}</span>
        <ul className="mt-1 space-y-1 text-xs text-gray-600">
          {row.activations.map((a) => (
            <li key={a.id}>
              {a.label ?? a.machineId.slice(0, 10)}{a.appVersion ? ` · v${a.appVersion}` : ''}
              <span className="block text-gray-500">{kst(a.activatedAt)}</span>
              <button type="button" className={linkButtonClass} onClick={() => act({ action: 'deactivate', activationId: a.id }, '이 기기를 해제할까요? 그 기기는 다시 활성화해야 합니다.')}>이 기기 해제</button>
            </li>
          ))}
        </ul>
      </td>
      <td data-label="상태" className="py-2 pr-3 whitespace-nowrap">{STATUS_LABEL[row.status] ?? row.status}</td>
      <td data-label="관리" className="py-2">
        <RowActions
          danger={
            (row.orderNo && row.status !== 'refunded') || row.status === 'active' ? (
              <>
                {row.orderNo && row.status !== 'refunded' && (
                  <button type="button" className={ROW_BTN_DANGER} title="주문 전액 환불" aria-label={`주문 ${row.orderNo} 전액 환불`} onClick={() => refund(row.orderNo as string)}>환불</button>
                )}
                {row.status === 'active' && (
                  <button type="button" className={ROW_BTN_DANGER} title="라이선스 취소" aria-label={`${row.email} 라이선스 취소`} onClick={() => act({ action: 'revoke' }, '이 라이선스를 취소할까요? 새 기기 활성화가 막힙니다(이미 활성화한 기기는 계속 돕니다).')}>취소</button>
                )}
              </>
            ) : undefined
          }
        >
          {row.activations.length > 0 && (
            <button type="button" className={ROW_BTN} title="활성 기기 전부 해제" aria-label={`${row.email} 활성 기기 전부 해제`} onClick={() => act({ action: 'deactivate' }, '활성 기기를 전부 해제할까요?')}>기기 해제</button>
          )}
          {row.status === 'active' && (
            <button type="button" className={ROW_BTN} title="키 메일 다시 보내기" aria-label={`${row.email}로 키 메일 다시 보내기`} onClick={() => act({ action: 'email_key' }, `${row.email}로 키 메일을 다시 보낼까요?`)}>키 재발송</button>
          )}
        </RowActions>
        {state && <p className="mt-1 text-right text-xs text-gray-600">{state}</p>}
      </td>
    </tr>
  );
}

export default function AdminSoftwarePage({ licenses, truncated = false, products, q, salesOpen, error }: Props) {
  return (
    <>
      <Head>
        <title>소프트웨어 관리 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <AdminShell title="소프트웨어 관리" description="플러그인·툴 라이선스입니다. 상품 정의(이름·가격·릴리스)는 data/software/catalog.ts에서 바꿉니다." width="wide">
        {error && <Notice tone="error" light className="mb-4">{error}</Notice>}
        {!salesOpen && (
          <Notice tone="warning" light className="mb-4">
            판매가 닫혀 있습니다(data/software/policy.ts의 SOFTWARE_SALES_OPEN) — 지금은 수동 발급만 됩니다. 여는 순서는 lib/software/CLAUDE.md의 체크리스트를 보세요.
          </Notice>
        )}

        <section className="mb-6 rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6">
          <h2 className="mb-1 text-lg font-bold text-gray-900 dark:text-gray-900">수동 발급</h2>
          <p className="mb-3 text-gray-600">결제 없이 키를 만들거나(플러그인 시험·리뷰어·증정, 비공개 상품도 됨), 결제됐는데 라이선스가 없는 주문을 메웁니다.</p>
          <IssueForm products={products} />
        </section>

        <section className="rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900">라이선스</h2>
            <form method="get" className="flex gap-2">
              <input name="q" defaultValue={q} placeholder="이메일·키·주문번호" aria-label="라이선스 검색" className={inputClass} />
              <button type="submit" className={buttonClass}>찾기</button>
            </form>
          </div>
          {truncated && (
            <p className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              최근 {LICENSE_LIST_LIMIT}건만 표시합니다. 더 오래된 라이선스는 위 검색(이메일·키·주문번호)으로 찾을 수 있습니다.
            </p>
          )}
          {licenses.length === 0 ? (
            <p className="text-gray-600">{q ? '찾는 라이선스가 없습니다.' : '아직 발급한 라이선스가 없습니다.'}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table w-full text-left lg:min-w-[64rem] lg:table-fixed">
                <colgroup>
                  <col className="w-56" />
                  <col />
                  <col className="w-32" />
                  <col className="w-44" />
                  <col className="w-20" />
                  <col className="w-[19rem]" />
                </colgroup>
                <thead className="text-xs text-gray-500">
                  <tr><th className="py-2 pr-3">키</th><th className="py-2 pr-3">받는 분</th><th className="py-2 pr-3">발급</th><th className="py-2 pr-3">기기</th><th className="py-2 pr-3">상태</th><th className="py-2 text-right">관리</th></tr>
                </thead>
                <tbody>{licenses.map((row) => <LicenseRow key={row.id} row={row} />)}</tbody>
              </table>
            </div>
          )}
        </section>
      </AdminShell>
    </>
  );
}
