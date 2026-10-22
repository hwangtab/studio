import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ChevronDown, X } from 'lucide-react';

import { logoutAdmin } from './contractActions';
import { Button } from '../ui/Button';
import { parseBookingLine, type BookingLine } from '../../lib/booking/line';

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
 * 상단 바의 모든 구역과 로그아웃에 항상 닿는다(좁은 화면에서는 메뉴 버튼 안). 로그인 화면만 예외다 — 세션이 없어
 * 이동할 곳도 로그아웃할 것도 없다.
 */

export interface AdminNavItem {
  href: string;
  label: string;
  /** 같은 화면(`/admin/bookings`)을 라인별로 가르는 구역 — `?line=`과 짝이다. */
  line?: BookingLine;
}

/**
 * 상단 바 — 구역이 열둘로 늘어 한 줄에 다 펼치면 눈이 길을 잃어서, 사업 라인별로 묶어 드롭다운으로 접었다.
 * 스튜디오는 **연습실 / 녹음실 / 플랫폼** 세 갈래로 돌아간다. 대시보드만 늘 보이는 링크고 나머지는 묶음 이름을 눌러 연다.
 *
 * - 연습실: 시간제 예약 · 월 이용 구독 · 이용계약서(계약은 음악연습실 이용계약서다).
 * - 녹음실: 녹음·성우·축가·커버영상 예약 · 믹싱·마스터링 주문.
 * - 플랫폼: 펀딩 · 공연 · 상점 · 소프트웨어 · 아티스트(정산·지원).
 * - 공통: 어느 라인에도 속하지 않는 것 — 매출 · 결제 링크 · 접속기록.
 *
 * '예약'은 한 화면(`/admin/bookings`)을 `?line=`으로 갈라 연습실·녹음실·믹싱에 나눠 건다. 새 구역을 더할 때는
 * **묶음 하나에 넣는다**(ADMIN_NAV는 여기서 펼친 목록이라 따로 고칠 곳이 없다).
 */
export interface AdminNavGroup {
  label: string;
  items: readonly AdminNavItem[];
}

export type AdminNavEntry = AdminNavItem | AdminNavGroup;

export const isNavGroup = (entry: AdminNavEntry): entry is AdminNavGroup => 'items' in entry;

export const ADMIN_NAV_ENTRIES: readonly AdminNavEntry[] = [
  { href: '/admin', label: '대시보드' },
  {
    label: '연습실',
    items: [
      { href: '/admin/bookings?line=practice', label: '연습실 예약', line: 'practice' },
      { href: '/admin/subscriptions', label: '구독' },
      { href: '/admin/contracts', label: '계약' },
      { href: '/admin/tenancies', label: '입주 관리' },
    ],
  },
  {
    label: '녹음실',
    items: [
      { href: '/admin/bookings?line=studio', label: '녹음실 예약', line: 'studio' },
      { href: '/admin/bookings?line=mixing', label: '믹싱·마스터링', line: 'mixing' },
      { href: '/admin/contracts/production', label: '제작 계약' },
      { href: '/admin/lessons', label: '레슨' },
      { href: '/admin/session-musicians', label: '세션 연주자' },
    ],
  },
  {
    label: '플랫폼',
    items: [
      { href: '/admin/funding', label: '펀딩' },
      { href: '/admin/shows', label: '공연' },
      { href: '/admin/shop', label: '상점' },
      { href: '/admin/software', label: '소프트웨어' },
      { href: '/admin/artists', label: '아티스트' },
    ],
  },
  {
    // 매출·지출·장부는 재무 한 화면의 탭이다(components/admin/FinanceTabs.tsx). 결제 링크는 돈을 받는 도구라 여기 둔다.
    label: '재무',
    items: [
      { href: '/admin/finance', label: '매출·수익' },
      { href: '/admin/finance/expenses', label: '지출' },
      { href: '/admin/finance/export', label: '장부 내보내기' },
      { href: '/admin/payment-links', label: '결제 링크' },
    ],
  },
  {
    label: '공통',
    items: [
      { href: '/admin/privacy-logs', label: '접속기록' },
      { href: '/admin/contracts/history', label: '계약 변경 이력' },
    ],
  },
];

/** 묶음을 펼친 평면 목록 — 현재 위치 판정과 테스트가 쓴다. */
export const ADMIN_NAV: readonly AdminNavItem[] = ADMIN_NAV_ENTRIES.flatMap((entry) => (isNavGroup(entry) ? entry.items : [entry]));

const pathOf = (href: string): string => href.split('?')[0];

/**
 * 지금 어느 구역에 있는지. 가장 긴 접두사가 이긴다 — `/admin`은 모든 관리자 경로의
 * 접두사라 먼저 맞히면 상세 화면에서도 '대시보드'가 켜진다.
 *
 * 경계(`/admin/contracts` vs `/admin/contractsX`)를 위해 정확히 같거나 `/`가 뒤따를 때만
 * 맞는 것으로 본다. 라우트 패턴(`router.pathname`)을 받으므로 쿼리·해시는 들어오지 않는다.
 *
 * 같은 경로를 여럿이 거는 구역(예약 — 연습실·녹음실·믹싱)은 `line`이 가른다. 라인을 모르면(`line` 없음 —
 * 대시보드 링크로 연 전체 목록) **어느 쪽도 켜지 않는다**: 임의로 하나를 켜면 다른 라인의 화면에서 틀린 곳이 켜진다.
 */
export const activeAdminNavHref = (pathname: string, line?: BookingLine | null): string | null => {
  const matches = ADMIN_NAV.filter((item) => pathname === pathOf(item.href) || pathname.startsWith(`${pathOf(item.href)}/`));
  if (matches.length === 0) return null;
  const longest = matches.reduce((best, item) => (pathOf(item.href).length > best ? pathOf(item.href).length : best), 0);
  const candidates = matches.filter((item) => pathOf(item.href).length === longest);
  if (candidates.length === 1) return candidates[0].href;
  return candidates.find((item) => item.line && item.line === line)?.href ?? null;
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
  /**
   * 예약 상세처럼 `?line=`이 주소에 없는 화면이 자기 라인을 알려 줄 때 쓴다 — 없으면 주소의 `line`을 읽는다.
   */
  navLine?: BookingLine | null;
  children: React.ReactNode;
}

export const AdminShell = ({
  title,
  description,
  backHref,
  backLabel,
  actions,
  width = 'default',
  navLine,
  children,
}: AdminShellProps) => {
  const router = useRouter();
  const activeHref = activeAdminNavHref(router.pathname, navLine ?? parseBookingLine(router.query?.line));

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

  /**
   * 좁은 화면의 구역 메뉴. 예전에는 상단 바 한 줄에 여덟 구역을 가로 스크롤로 넣었는데,
   * 폰에서는 제목·로그아웃 사이에 남는 폭이 136px이라 두 구역만 보였고 지금 있는 구역이
   * 화면 밖으로 밀려 있었다. 그래서 lg 아래에서는 현재 구역을 단 버튼 하나로 접고,
   * 누르면 여덟 구역을 한꺼번에 펼친다.
   */
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    setMenuOpen(false);
  }, [router.pathname]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  /**
   * 데스크톱 드롭다운. 한 번에 하나만 열린다. 바깥을 누르거나 Esc를 누르거나 다른 화면으로 가면 닫힌다
   * (Esc는 좁은 화면 메뉴와 같은 키 — 아래 effect가 둘을 함께 닫는다).
   */
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    setOpenGroup(null);
  }, [router.pathname]);
  useEffect(() => {
    if (openGroup === null) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenGroup(null);
    };
    const onPointer = (event: MouseEvent | TouchEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) setOpenGroup(null);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
    };
  }, [openGroup]);

  const activeLabel = ADMIN_NAV.find((item) => item.href === activeHref)?.label ?? '메뉴';

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

          <nav aria-label="관리자 구역" className="hidden lg:block flex-1 min-w-0">
            <ul ref={navRef} className="flex items-center gap-1 whitespace-nowrap">
              {ADMIN_NAV_ENTRIES.map((entry) => {
                if (!isNavGroup(entry)) {
                  const isActive = entry.href === activeHref;
                  return (
                    <li key={entry.href}>
                      <Link
                        href={entry.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm transition-colors ${
                          isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        {entry.label}
                      </Link>
                    </li>
                  );
                }
                const groupActive = entry.items.some((item) => item.href === activeHref);
                const isOpen = openGroup === entry.label;
                return (
                  <li key={entry.label} className="relative">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-haspopup="true"
                      data-active={groupActive ? 'true' : undefined}
                      onClick={() => setOpenGroup(isOpen ? null : entry.label)}
                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                        groupActive ? 'bg-primary/10 text-primary font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      } ${isOpen && !groupActive ? 'bg-gray-100 text-gray-900' : ''}`}
                    >
                      {entry.label}
                      <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                    {isOpen && (
                      <ul className="absolute left-0 top-full z-50 mt-1 min-w-[10rem] rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg">
                        {entry.items.map((item) => {
                          const isActive = item.href === activeHref;
                          return (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                aria-current={isActive ? 'page' : undefined}
                                onClick={() => setOpenGroup(null)}
                                className={`flex items-center rounded-lg px-3 py-2 text-sm ${
                                  isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                {item.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          {adminName && (
            <span className="hidden lg:inline shrink-0 text-sm text-gray-600" data-testid="admin-current-user">
              {adminName}
            </span>
          )}

          <Button light variant="ghost" size="sm" className="hidden lg:inline-flex shrink-0" onClick={handleLogout}>
            로그아웃
          </Button>

          <button
            type="button"
            className="lg:hidden ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            aria-expanded={menuOpen}
            aria-controls="admin-mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {activeLabel}
            {menuOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>

        {/* 상단 바가 sticky라 메뉴가 화면보다 길면(가로 모드·작은 폰) 아래쪽 구역과 로그아웃에 닿지 못한다 — 메뉴 안에서 스크롤한다. */}
        {menuOpen && (
          <div id="admin-mobile-menu" className="lg:hidden max-h-[calc(100dvh-3.5rem)] overflow-y-auto overscroll-contain border-t border-gray-200 bg-white px-4 pb-4 pt-3">
            <nav aria-label="관리자 구역 메뉴">
              <ul className="space-y-4">
                {ADMIN_NAV_ENTRIES.map((entry) => {
                  const items = isNavGroup(entry) ? entry.items : [entry];
                  return (
                    <li key={isNavGroup(entry) ? entry.label : entry.href}>
                      {isNavGroup(entry) && <p className="mb-1.5 px-1 text-xs font-semibold text-gray-500">{entry.label}</p>}
                      <ul className="grid grid-cols-2 gap-2">
                        {items.map((item) => {
                          const isActive = item.href === activeHref;
                          return (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                aria-current={isActive ? 'page' : undefined}
                                onClick={() => setMenuOpen(false)}
                                className={`flex min-h-[44px] items-center rounded-lg px-3 text-[15px] ${
                                  isActive ? 'bg-primary/10 text-primary font-semibold' : 'bg-gray-50 text-gray-800'
                                }`}
                              >
                                {item.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
              <span className="text-sm text-gray-600">{adminName ?? ''}</span>
              <Button light variant="weak" size="sm" onClick={handleLogout}>
                로그아웃
              </Button>
            </div>
          </div>
        )}
      </header>

      <main className={`${WIDTH_CLASS[width]} mx-auto break-keep break-words px-4 py-6 md:py-10`}>
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
