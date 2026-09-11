import React, { useMemo, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

import { createManualPledge } from '../../../components/admin/fundingActions';
import { logoutAdmin } from '../../../components/admin/contractActions';
import { Button } from '../../../components/ui/Button';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { lightOnlyField } from '../../../components/ui/adminFieldClass';
import { formatPriceAmount } from '../../../data/pricing';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { duplicateKey, serializePledgeForAdmin, type AdminPledgeItem } from '../../../lib/funding/admin-serialize';
import { listFundingOrders } from '../../../lib/funding/admin-list';
import { formatKstDateTime } from '../../../lib/booking/format';
import { getAllFundingProjects } from '../../../lib/funding/projects';
import { expireStalePledges } from '../../../lib/funding/service';

const LIST_LIMIT = 200;

interface ProjectRewardOption {
  id: string;
  title: string;
  amount: number;
}

interface ProjectOption {
  slug: string;
  title: string;
  rewards: ProjectRewardOption[];
}

interface AdminFundingPageProps {
  items: AdminPledgeItem[];
  truncated: boolean;
  projects: ProjectOption[];
  slug: string | null;
  /** 부수적 실패(프로젝트 md 파싱 등) — 배너로만 알리고 표는 그대로 보여준다. */
  error?: string;
  /** 후원 목록 조회 자체가 실패했을 때만 — 이때는 보여줄 표가 없으므로 전체 화면 오류. */
  pledgesError?: string;
}

export const getServerSideProps: GetServerSideProps<AdminFundingPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }

  const slugParam = context.query.slug;
  const slug = typeof slugParam === 'string' && slugParam ? slugParam : null;

  // md 한 편이 깨져도(frontmatter 파싱 예외) 관리자 화면 전체가 500이 되면 안 된다 —
  // 후원 목록은 md와 무관하게 DB에서 온다.
  let projects: ProjectOption[] = [];
  let projectsError: string | undefined;
  try {
    projects = getAllFundingProjects().map((p) => ({
      slug: p.slug,
      title: p.title,
      rewards: p.rewards.map((r) => ({ id: r.id, title: r.title, amount: r.amount })),
    }));
  } catch (error: unknown) {
    console.error('[admin/funding] Failed to load funding projects:', error);
    projectsError = '펀딩 프로젝트 파일을 읽지 못했습니다. 수기 등록은 사용할 수 없습니다.';
  }

  try {
    await expireStalePledges(new Date());
    const orders = await listFundingOrders(slug);
    const counts = new Map<string, number>();
    for (const o of orders) {
      if (o.status === 'pending' && o.fundingPledge?.paymentMethod === 'bank_transfer') {
        const key = duplicateKey(o);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    const dups = new Set([...counts].filter(([, n]) => n > 1).map(([k]) => k));

    return {
      props: {
        items: orders.slice(0, LIST_LIMIT).map((o) => serializePledgeForAdmin(o, dups)),
        truncated: orders.length > LIST_LIMIT,
        projects,
        slug,
        ...(projectsError ? { error: projectsError } : {}),
      },
    };
  } catch (error: unknown) {
    console.error('[admin/funding] Failed to load pledges:', error);
    return {
      props: {
        items: [],
        truncated: false,
        projects,
        slug,
        ...(projectsError ? { error: projectsError } : {}),
        pledgesError: '후원 목록을 불러오는 중 오류가 발생했습니다.',
      },
    };
  }
};

const STATUS_LABELS: Record<string, string> = {
  pending: '결제대기',
  paid: '확정',
  partially_refunded: '부분환불',
  refunded: '환불완료',
  failed: '결제실패',
  expired: '만료',
};

const PAYMENT_LABELS: Record<string, string> = { toss: '카드', bank_transfer: '무통장' };
const FULFILLMENT_LABELS: Record<string, string> = { none: '미발송', preparing: '준비중', shipped: '발송완료', delivered: '수령완료' };

export default function AdminFundingPage({ items, truncated, projects, slug, error, pledgesError }: AdminFundingPageProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [formProjectSlug, setFormProjectSlug] = useState(projects[0]?.slug ?? '');
  const [formRewardId, setFormRewardId] = useState('');
  const [formQuantity, setFormQuantity] = useState(1);
  const [formAdditionalAmount, setFormAdditionalAmount] = useState(0);
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formCustomerEmail, setFormCustomerEmail] = useState('');
  const [formMemo, setFormMemo] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // 확정 집계는 aggregateProjectStatus와 같은 상태 집합을 쓴다 — 부분환불 건도 후원 자체는
  // 살아 있고 리워드도 나간다. 한쪽만 빼면 관리자 화면과 공개 현황판의 숫자가 어긋난다.
  const paidItems = useMemo(() => items.filter((i) => i.status === 'paid' || i.status === 'partially_refunded'), [items]);
  const pendingBankItems = useMemo(() => items.filter((i) => i.status === 'pending' && i.paymentMethod === 'bank_transfer'), [items]);
  const mismatched = useMemo(() => items.filter((i) => i.mismatch), [items]);

  const totals = useMemo(() => ({
    confirmedAmount: paidItems.reduce((sum, i) => sum + i.totalAmount, 0),
    backerCount: paidItems.length,
    pendingAmount: pendingBankItems.reduce((sum, i) => sum + i.totalAmount, 0),
    pendingCount: pendingBankItems.length,
  }), [paidItems, pendingBankItems]);

  const refresh = async () => {
    await router.replace(router.asPath, undefined, { scroll: false });
  };

  const handleLogout = async () => {
    await logoutAdmin();
    await router.replace('/admin/login');
  };

  const selectedProject = projects.find((p) => p.slug === formProjectSlug);

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formProjectSlug || !formRewardId) {
      setFormError('프로젝트와 리워드를 선택해 주세요.');
      return;
    }
    if (!Number.isInteger(formQuantity) || formQuantity < 1 || formQuantity > 10) {
      setFormError('수량은 1~10 사이의 정수여야 합니다.');
      return;
    }
    if (!Number.isInteger(formAdditionalAmount) || formAdditionalAmount < 0 || formAdditionalAmount > 5_000_000) {
      setFormError('추가 후원금은 0~5,000,000원 사이여야 합니다.');
      return;
    }
    if (!formCustomerName.trim()) {
      setFormError('이름을 입력해 주세요.');
      return;
    }

    setBusy(true);
    const result = await createManualPledge({
      projectSlug: formProjectSlug,
      rewardId: formRewardId,
      quantity: formQuantity,
      additionalAmount: formAdditionalAmount,
      customerName: formCustomerName.trim(),
      customerPhone: formCustomerPhone.trim() || undefined,
      customerEmail: formCustomerEmail.trim() || undefined,
      displayNamePublic: false,
      adminMemo: formMemo.trim() || undefined,
    });
    setBusy(false);

    if (!result.ok) {
      setFormError(result.message ?? '등록에 실패했습니다.');
      return;
    }
    setShowForm(false);
    setFormRewardId('');
    setFormQuantity(1);
    setFormAdditionalAmount(0);
    setFormCustomerName('');
    setFormCustomerPhone('');
    setFormCustomerEmail('');
    setFormMemo('');
    setNotice('수기 등록이 완료되었습니다.');
    await refresh();
  };

  // 전체 화면 오류는 후원 목록 자체를 못 읽었을 때만이다. 프로젝트 md 파싱 실패처럼 표와
  // 무관한 사고까지 여기서 막으면, 멀쩡히 조회된 후원 목록을 관리자가 못 보게 된다.
  if (pledgesError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">오류</h1>
          <p className="text-gray-600">{[pledgesError, error].filter(Boolean).join(' ')}</p>
        </div>
      </div>
    );
  }

  const exportHref = slug ? `/api/admin/funding/export?slug=${encodeURIComponent(slug)}` : '/api/admin/funding/export';

  return (
    <>
      <Head>
        <title>펀딩 관리 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <main className="min-h-screen bg-gray-50 py-8 md:py-12">
        <div className="max-w-6xl mx-auto px-4 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-primary p-6 md:p-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">펀딩 관리</h1>
                <p className="text-white/80 mt-2">후원 현황을 확인하고 관리합니다.</p>
              </div>
              <div className="flex gap-2">
                <Link href="/admin" passHref>
                  <Button variant="secondary">관리자 홈</Button>
                </Link>
                <Button
                  variant="outline"
                  className="border-white/40 text-white hover:bg-white/10 dark:border-white/40 dark:text-white dark:hover:border-white/40"
                  onClick={handleLogout}
                >
                  로그아웃
                </Button>
              </div>
            </div>

            <div className="p-6 md:p-8">
              {notice && <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm">{notice}</div>}

              {error && (
                <div role="alert" className="mb-4 p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {mismatched.length > 0 && (
                <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-900 rounded-lg text-sm">
                  <strong>결제 기록과 주문 상태가 어긋난 후원이 {mismatched.length}건 있습니다</strong> (
                  {mismatched.map((m) => m.orderNo).join(', ')}). 토스 콘솔에서 확인해 주세요.
                </div>
              )}

              {truncated && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
                  최근 {LIST_LIMIT}건만 표시합니다.
                </div>
              )}

              <div className="flex flex-wrap gap-2 mb-6">
                <Link href="/admin/funding" passHref>
                  <button
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!slug ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    전체
                  </button>
                </Link>
                {projects.map((p) => (
                  <Link key={p.slug} href={`/admin/funding?slug=${encodeURIComponent(p.slug)}`} passHref>
                    <button
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${slug === p.slug ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {p.title}
                    </button>
                  </Link>
                ))}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="text-xs text-gray-500">확정 금액</div>
                  <div className="text-lg font-bold text-gray-900">{formatPriceAmount(totals.confirmedAmount)}원</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="text-xs text-gray-500">후원자 수</div>
                  <div className="text-lg font-bold text-gray-900">{totals.backerCount}명</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="text-xs text-gray-500">입금 대기 금액</div>
                  <div className="text-lg font-bold text-gray-900">{formatPriceAmount(totals.pendingAmount)}원</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="text-xs text-gray-500">입금 대기 건수</div>
                  <div className="text-lg font-bold text-gray-900">{totals.pendingCount}건</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                <a href={exportHref}>
                  <Button variant="secondary">CSV 내보내기</Button>
                </a>
                <Button variant="outline" onClick={() => setShowForm((v) => !v)}>
                  {showForm ? '수기 등록 닫기' : '수기 등록'}
                </Button>
              </div>

              {showForm && (
                <form onSubmit={handleCreateManual} className="mb-6 p-4 bg-gray-50 rounded-xl space-y-3">
                  {formError && <div className="p-2 bg-red-50 text-red-700 rounded text-sm">{formError}</div>}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field id="form-project-slug" label="프로젝트" className={lightOnlyField}>
                      <Select
                        value={formProjectSlug}
                        onChange={(e) => { setFormProjectSlug(e.target.value); setFormRewardId(''); }}
                        light className="text-sm"
                      >
                        <option value="">선택</option>
                        {projects.map((p) => (
                          <option key={p.slug} value={p.slug}>{p.title}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field id="form-reward-id" label="리워드" className={lightOnlyField}>
                      <Select
                        value={formRewardId}
                        onChange={(e) => setFormRewardId(e.target.value)}
                        light className="text-sm"
                        disabled={!selectedProject}
                      >
                        <option value="">선택</option>
                        {(selectedProject?.rewards ?? []).map((r) => (
                          <option key={r.id} value={r.id}>{r.title} ({formatPriceAmount(r.amount)}원)</option>
                        ))}
                      </Select>
                    </Field>
                    <Field id="form-quantity" label="수량" className={lightOnlyField}>
                      <TextInput
                        type="number"
                        min={1}
                        max={10}
                        value={formQuantity}
                        onChange={(e) => setFormQuantity(Number(e.target.value))}
                        light className="text-sm"
                      />
                    </Field>
                    <Field id="form-additional-amount" label="추가 후원금(원)" className={lightOnlyField}>
                      <TextInput
                        type="number"
                        min={0}
                        max={5_000_000}
                        step={1000}
                        value={formAdditionalAmount}
                        onChange={(e) => setFormAdditionalAmount(Number(e.target.value))}
                        light className="text-sm"
                      />
                    </Field>
                    <Field id="form-customer-name" label="이름" className={lightOnlyField}>
                      <TextInput
                        type="text"
                        value={formCustomerName}
                        onChange={(e) => setFormCustomerName(e.target.value)}
                        light className="text-sm"
                      />
                    </Field>
                    <Field id="form-customer-phone" label="연락처" className={lightOnlyField}>
                      <TextInput
                        type="text"
                        value={formCustomerPhone}
                        onChange={(e) => setFormCustomerPhone(e.target.value)}
                        light className="text-sm"
                      />
                    </Field>
                    <Field id="form-customer-email" label="이메일" className={lightOnlyField}>
                      <TextInput
                        type="email"
                        value={formCustomerEmail}
                        onChange={(e) => setFormCustomerEmail(e.target.value)}
                        light className="text-sm"
                      />
                    </Field>
                    <Field id="form-memo" label="메모" className={lightOnlyField}>
                      <TextInput
                        type="text"
                        value={formMemo}
                        onChange={(e) => setFormMemo(e.target.value)}
                        light className="text-sm"
                      />
                    </Field>
                  </div>
                  <Button type="submit" disabled={busy}>등록</Button>
                </form>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3 rounded-l-lg">주문번호</th>
                      <th className="px-4 py-3">상태</th>
                      <th className="px-4 py-3">결제수단</th>
                      <th className="px-4 py-3">고객</th>
                      <th className="px-4 py-3">리워드</th>
                      <th className="px-4 py-3">금액</th>
                      <th className="px-4 py-3 rounded-r-lg">발송</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Link href={`/admin/funding/${item.id}`} className="text-primary font-medium hover:underline">
                            {item.orderNo}
                          </Link>
                          <div className="text-xs text-gray-500">{formatKstDateTime(item.createdAt)}</div>
                        </td>
                        <td className="px-4 py-3">
                          {STATUS_LABELS[item.status] ?? item.status}
                          {item.duplicateWarning && <span className="ml-1 text-amber-600" title="동명·동액 대기 건 존재">⚠</span>}
                          {item.mismatch && (
                            <div className="mt-1">
                              <span className="inline-flex px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">미정합</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">{PAYMENT_LABELS[item.paymentMethod] ?? item.paymentMethod}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {item.customerName}
                          <div className="text-xs text-gray-500 font-normal">{item.customerPhone}</div>
                        </td>
                        <td className="px-4 py-3">{item.rewardTitle} × {item.quantity}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatPriceAmount(item.totalAmount)}원</td>
                        <td className="px-4 py-3">{FULFILLMENT_LABELS[item.fulfillmentStatus] ?? item.fulfillmentStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {items.length === 0 && (
                <div className="text-center py-12 text-gray-500">아직 접수된 후원이 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
