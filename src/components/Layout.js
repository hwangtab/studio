import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Moon, Sun } from 'lucide-react';

const NavLink = ({ to, children, isScrolled }) => {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
  
  return (
    <Link
      to={to}
      className={`px-3 py-2 rounded-md typo-nav-link transition-all duration-300 ${
        isActive
          ? 'bg-white/90 text-primary-dark shadow-sm'
          : `${isScrolled ? 'text-gray-800 dark:text-white' : 'text-white'} hover:bg-white/20`
      }`}
    >
      {children}
    </Link>
  );
};

const Layout = ({ children }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const location = useLocation();

  // 페이지 전환 시 스크롤 최상단으로 이동
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // 윈도우 크기 변경 감지
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // 다크모드 설정
  useEffect(() => {
    // 1. 로컬 스토리지에 저장된 사용자 설정 우선 적용
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
      setIsDarkMode(savedDarkMode === 'true');
      return;
    }
    
    // 2. 시스템 설정 확인
    const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // 3. 시간대에 따른 자동 설정 (6:00~18:00 라이트, 그 외 다크)
    const currentHour = new Date().getHours();
    const isNightTime = currentHour < 6 || currentHour >= 18;
    
    setIsDarkMode(prefersDarkMode || isNightTime);
  }, []);
  
  // 다크모드 토글 함수
  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem('darkMode', newDarkMode.toString());
    
    // HTML 요소에 다크모드 클래스 추가/제거
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };
  
  // 스크롤 이벤트 감지
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // 다크모드 클래스 적용
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300 break-keep overflow-x-hidden w-full">
      <header className={`fixed w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-md' : 'bg-gradient-to-r from-primary via-secondary to-accent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className={`${isScrolled ? 'text-primary dark:text-white' : 'text-white'} flex items-center text-4xl sm:text-5xl font-logo tracking-wider hover:opacity-90 transition-all duration-300 whitespace-nowrap -translate-y-1`}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              스튜디오 놀
            </Link>
            
            <div className="flex items-center space-x-4">
              <nav className={`hidden ${windowWidth >= 1024 ? 'lg:flex' : 'md:hidden'} space-x-1`}>
                <NavLink to="/" isScrolled={isScrolled}>홈</NavLink>
                <NavLink to="/about" isScrolled={isScrolled}>소개</NavLink>
                <NavLink to="/portfolio" isScrolled={isScrolled}>포트폴리오</NavLink>
                <NavLink to="/studio-info" isScrolled={isScrolled}>스튜디오</NavLink>
                <NavLink to="/practice-room" isScrolled={isScrolled}>연습실</NavLink>
                <NavLink to="/stories" isScrolled={isScrolled}>스토리</NavLink>
                <NavLink to="/contact" isScrolled={isScrolled}>연락처</NavLink>
              </nav>
              
              <button
                className={`p-2 rounded-full ${isScrolled ? 'text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800' : 'text-white hover:bg-white/20'} transition-colors duration-300`}
                onClick={toggleDarkMode}
                aria-label="Toggle dark mode"
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              
              <button
                className={`${windowWidth >= 1024 ? 'lg:hidden' : 'md:block'} p-2 rounded-full ${isScrolled ? 'text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800' : 'text-white hover:bg-white/20'} transition-colors duration-300`}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
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
              <Link to="/" onClick={() => setIsMenuOpen(false)} className="block px-3 py-2 rounded-md typo-nav-link text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300">홈</Link>
              <Link to="/about" onClick={() => setIsMenuOpen(false)} className="block px-3 py-2 rounded-md typo-nav-link text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors.duration-300">소개</Link>
              <Link to="/portfolio" onClick={() => setIsMenuOpen(false)} className="block px-3 py-2 rounded-md typo-nav-link text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300">포트폴리오</Link>
              <Link to="/studio-info" onClick={() => setIsMenuOpen(false)} className="block px-3 py-2 rounded-md typo-nav-link text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300">스튜디오</Link>
              <Link to="/practice-room" onClick={() => setIsMenuOpen(false)} className="block px-3 py-2 rounded-md typo-nav-link text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300">연습실</Link>
              <Link to="/stories" onClick={() => setIsMenuOpen(false)} className="block px-3 py-2 rounded-md typo-nav-link text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300">스토리</Link>
              <Link to="/contact" onClick={() => setIsMenuOpen(false)} className="block px-3 py-2 rounded-md typo-nav-link text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300">연락처</Link>
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
                <li><Link to="/" className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300">홈</Link></li>
                <li><Link to="/about" className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300">소개</Link></li>
                <li><Link to="/portfolio" className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300">포트폴리오</Link></li>
                <li><Link to="/stories" className="typo-footer-body text-gray-200/80 hover:text-white transition-colors.duration-300">스토리</Link></li>
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
