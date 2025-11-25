import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Menu, Moon, Sun, X } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: '홈' },
  { href: '/about', label: '소개' },
  { href: '/portfolio', label: '포트폴리오' },
  { href: '/studio-info', label: '스튜디오' },
  { href: '/practice-room', label: '연습실' },
  { href: '/pricing', label: '가격' },
  { href: '/stories', label: '스토리' },
  { href: '/contact', label: '연락처' },
];

const NavLink = ({ href, children, isScrolled, currentPath, onNavigate }) => {
  const isActive = href === '/' ? currentPath === '/' : currentPath.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`px-3 py-2 rounded-md typo-nav-link transition-all duration-300 ${isActive
          ? 'bg-white/90 text-primary-dark shadow-sm'
          : `${isScrolled ? 'text-gray-800 dark:text-white' : 'text-white'} hover:bg-white/20`
        }`}
    >
      {children}
    </Link>
  );
};

const Layout = ({ children }) => {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [hasThemeLoaded, setHasThemeLoaded] = useState(false);

  const currentPath = useMemo(() => router.asPath || '/', [router.asPath]);

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToTop();
  }, [currentPath]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedDarkMode = localStorage.getItem('darkMode');
      const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
      const initialDarkMode = savedDarkMode !== null ? savedDarkMode === 'true' : Boolean(prefersDark);
      setIsDarkMode(initialDarkMode);
      setHasThemeLoaded(true);
      document.documentElement.classList.toggle('dark', initialDarkMode);
    } catch (error) {
      console.warn('Failed to read dark mode preference', error);
      setHasThemeLoaded(true);
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!hasThemeLoaded || typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', isDarkMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('darkMode', isDarkMode.toString());
    }
  }, [isDarkMode, hasThemeLoaded]);

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300 break-keep overflow-x-hidden w-full">
      <header className={`fixed w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-md' : 'bg-gradient-to-r from-primary via-secondary to-accent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className={`${isScrolled ? 'text-primary dark:text-white' : 'text-white'} flex items-center text-4xl sm:text-5xl font-logo tracking-wider hover:opacity-90 transition-all duration-300 whitespace-nowrap -translate-y-1`}
              onClick={(event) => {
                event.preventDefault();
                setIsMenuOpen(false);
                router.push('/').then(scrollToTop);
              }}
            >
              스튜디오 놀
            </Link>

            <div className="flex items-center space-x-4">
              <nav className="hidden lg:flex space-x-1">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    isScrolled={isScrolled}
                    currentPath={currentPath}
                    onNavigate={() => setIsMenuOpen(false)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <button
                className={`p-2 rounded-full ${isScrolled ? 'text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800' : 'text-white hover:bg-white/20'} transition-colors duration-300`}
                onClick={toggleDarkMode}
                aria-label="Toggle dark mode"
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              <button
                className={`lg:hidden p-2 rounded-full ${isScrolled ? 'text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800' : 'text-white hover:bg-white/20'} transition-colors duration-300`}
                onClick={() => setIsMenuOpen((prev) => !prev)}
                aria-label="Toggle menu"
              >
                {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <nav className="md:hidden bg-white/95 dark:bg-gray-800/95 backdrop-blur-md shadow-lg">
            <div className="px-4 py-3 space-y-2">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-3 py-2 rounded-md typo-nav-link text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="page-main flex-grow pt-24 pb-12">
        {children}
      </main>

      <footer className="bg-gradient-to-r from-primary via-secondary to-accent text-white p-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="typo-footer-heading mb-4">스튜디오 놀</h3>
              <p className="typo-footer-body text-gray-200/90 mb-4 leading-relaxed">아티스트의 비전을 실현하는 음악 제작 스튜디오</p>
              <p className="typo-footer-meta">2024 스튜디오 놀. All rights reserved.</p>
            </div>

            <div>
              <h3 className="typo-footer-heading mb-4">바로가기</h3>
              <ul className="space-y-2">
                <li><Link href="/" className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300">홈</Link></li>
                <li><Link href="/about" className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300">소개</Link></li>
                <li><Link href="/portfolio" className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300">포트폴리오</Link></li>
                <li><Link href="/pricing" className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300">가격</Link></li>
                <li><Link href="/stories" className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300">스토리</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="typo-footer-heading mb-4">연락처</h3>
              <a
                href="https://naver.me/5gFZhS3X"
                target="_blank"
                rel="noopener noreferrer"
                className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300 flex items-center mb-2"
              >
                <span className="inline-block w-4 mr-2">📍</span>
                <span className="leading-relaxed">서울특별시 은평구 대조동 84-3 3층</span>
              </a>
              <a
                href="mailto:contact@kosmart.org"
                className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300 flex items-center mb-2"
              >
                <span className="inline-block w-4 mr-2">📧</span>
                <span className="leading-relaxed">문의: contact@kosmart.org</span>
              </a>
              <a
                href="tel:02-764-3114"
                className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300 flex items-center"
              >
                <span className="inline-block w-4 mr-2">📞</span>
                <span className="leading-relaxed">전화: 02-764-3114</span>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
