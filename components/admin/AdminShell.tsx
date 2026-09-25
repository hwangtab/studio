import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

import { logoutAdmin } from './contractActions';
import { Button } from '../ui/Button';

/**
 * 관리자 화면의 공통 껍데기 — 상단 바(구역 이동 + 로그아웃)와 페이지 머리말.
 *
 * 예전에는 페이지마다 자기 머리말을 직접 그렸고, 그래서 **들어가면 나올 수 없는 화면이
 * 여럿 있었다.** 전수 확인 결과: 상세 화면 네 곳(예약·계약·펀딩·구독)은 '목록으로' 하나뿐이라
 * 다른 구역으로도 대시보드로도 못 갔고, 계약 작성·수정 화면은 링크가 아예 없어 브라우저
 * 뒤로가기 말고는 빠져나갈 길이 없었다. 목록 화면끼리도 제각각이어서 예약 목록에는 계약으로
 * 가는 버튼만 있고, 계약 목록에는 대시보드로 가는 길이 없었다.
 *
 * 머리말 양식도 세 가지였다(보라 배경에 흰 제목 / 회색 배경에 검은 제목 + 목록으로 /
 * 대시보드의 자체 내비게이션). 같은 관리자 화면인데 페이지마다 다른 제품처럼 보였다.
 *
 * 그래서 **나가는 길은 페이지가 아니라 이 컴포넌트가 책임진다.** 어느 관리자 화면에서든
 * 상단 바의 다섯 구역과 로그아웃에 항상 닿는다. 로그인 화면만 예외다 — 세션이 없어
 * 이동할 곳도 로그아웃할 것도 없다.
 */

export interface AdminNavItem {
  href: string;
  label: string;
}

/**
 * 상단 바의 구역. 순서는 쓰는 빈도가 아니라 업무 흐름을 따른다 —
 * 계약을 맺고(계약) → 일을 받고(예약·믹싱) → 모으고(펀딩) → 매달 청구한다(구독) → 아티스트에게 지급한다(아티스트).
 * 접속기록은 업무가 아니라 그 업무를 되돌아보는 자리라 맨 뒤다.
 */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { href: '/admin', label: '대시보드' },
  { href: '/admin/contracts', label: '계약' },
  { href: '/admin/bookings', label: '예약·믹싱' },
  { href: '/admin/funding', label: '펀딩' },
  { href: '/admin/subscriptions', label: '구독' },
  { href: '/admin/artists', label: '아티스트' },
  { href: '/admin/privacy-logs', label: '접속기록' },
] as const;

/**
 * 지금 어느 구역에 있는지. 가장 긴 접두사가 이긴다 — `/admin`은 모든 관리자 경로의
 * 접두사라 먼저 맞히면 상세 화면에서도 '대시보드'가 켜진다.
 *
 * 경계(`/admin/contracts` vs `/admin/contractsX`)를 위해 정확히 같거나 `/`가 뒤따를 때만
 * 맞는 것으로 본다. 라우트 패턴(`router.pathname`)을 받으므로 쿼리·해시는 들어오지 않는다.
 */
export const activeAdminNavHref = (pathname: string): string | null => {
  const matches = ADMIN_NAV.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return matches.length === 0
    ? null
    : matches.reduce((longest, item) => (item.href.length > longest.href.length ? item : longest)).href;
};

const WIDTH_CLASS = {
  narrow: 'max-w-3xl',
  default: 'max-w-4xl',
  wide: 'max-w-6xl',
} as const;

export interface AdminShellProps {
  title: string;
  description?: React.ReactNode;
  /** 한 단계 위로 — 상세·작성 화면이 자기 목록으로 돌아가는 길. 상단 바와 별개다. */
  backHref?: string;
  backLabel?: string;
  /** 제목 오른쪽에 붙는 페이지 고유 동작(예: 새 계약 작성). */
  actions?: React.ReactNode;
  width?: keyof typeof WIDTH_CLASS;
  children: React.ReactNode;
}

export const AdminShell = ({
  title,
  description,
  backHref,
  backLabel,
  actions,
  width = 'default',
  children,
}: AdminShellProps) => {
  const router = useRouter();
  const activeHref = activeAdminNavHref(router.pathname);

  const handleLogout = async () => {
    await logoutAdmin();
    await router.replace('/admin/login');
  };

  /**
   * 지금 누구로 들어와 있는가.
   *
   * 비밀번호가 사람마다 달라졌으니(`lib/contracts/admin-accounts.ts`) 내가 누구로 보이는지가
   * 화면에 있어야 한다 — 개인정보 조회가 내 이름으로 기록된다는 것을 보는 자리이기도 하다.
   * 관리자 페이지 15곳의 GSSP에 prop을 하나씩 내리는 대신 껍데기가 한 번 물어본다.
   * 실패하면 아무것도 띄우지 않는다(이 값 때문에 화면이 깨질 이유가 없다).
   */
  const [adminName, setAdminName] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/admin/auth', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (alive && body?.ok && typeof body.name === 'string') setAdminName(body.name);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:text-gray-900">
      {/*
        상단 바는 sticky다 — 관리자 목록은 200건까지 길어서, 스크롤을 내린 뒤 다른 구역으로
        가려면 맨 위까지 되돌아가야 했다.
      */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/admin" className="shrink-0 font-bold text-gray-900 dark:text-gray-900 hover:text-primary">
            스튜디오 놀 관리자
          </Link>

          {/* 좁은 화면에서는 줄바꿈 대신 가로 스크롤 — 상단 바 높이가 들쭉날쭉하면 sticky 아래 여백이 흔들린다. */}
          <nav aria-label="관리자 구역" className="flex-1 min-w-0 overflow-x-auto">
            <ul className="flex items-center gap-1 whitespace-nowrap">
              {ADMIN_NAV.map((item) => {
                const isActive = item.href === activeHref;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm transition-colors ${
                        isActive
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {adminName && (
            <span className="shrink-0 text-sm text-gray-600 hidden sm:inline" data-testid="admin-current-user">
              {adminName}
            </span>
          )}

          <Button light variant="ghost" size="sm" className="shrink-0" onClick={handleLogout}>
            로그아웃
          </Button>
        </div>
      </header>

      <main className={`${WIDTH_CLASS[width]} mx-auto px-4 py-8 md:py-10`}>
        <div className="mb-6">
          {backHref && (
            <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary mb-2">
              <span aria-hidden="true">←</span>
              {backLabel ?? '목록으로'}
            </Link>
          )}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-900">{title}</h1>
              {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </div>
        </div>

        {children}
      </main>
    </div>
  );
};

export default AdminShell;
