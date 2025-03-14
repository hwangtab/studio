import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Moon, Sun } from 'lucide-react';

const NavLink = ({ to, children }) => {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
  
  return (
    <Link
      to={to}
      className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
        isActive
          ? 'bg-white/90 text-primary-dark font-bold shadow-sm'
          : 'text-white hover:bg-white/20'
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
  
  // 다크모드 설정
  useEffect(() => {
    // 사용자 시스템 설정에 따른 초기 다크모드 설정
    const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(prefersDarkMode);
    
    // 로컬 스토리지에서 다크모드 설정 불러오기
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
      setIsDarkMode(savedDarkMode === 'true');
    }
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
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
      <header className={`fixed w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-md' : 'bg-gradient-to-r from-primary via-secondary to-accent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link 
              to="/" 
              className={`${isScrolled ? 'text-primary dark:text-white' : 'text-white'} pt-2 text-4xl sm:text-5xl font-title tracking-wider hover:opacity-90 transition-all duration-300`}
            >
              스튜디오 놀
            </Link>
            
            <div className="flex items-center space-x-4">
              <nav className="hidden md:flex space-x-1">
                <NavLink to="/">홈</NavLink>
                <NavLink to="/about">소개</NavLink>
                <NavLink to="/portfolio">포트폴리오</NavLink>
                <NavLink to="/studio-info">스튜디오</NavLink>
                <NavLink to="/practice-room">연습실</NavLink>
                <NavLink to="/stories">스토리</NavLink>
                <NavLink to="/booking">예약</NavLink>
                <NavLink to="/contact">연락처</NavLink>
              </nav>
              
              <button
                className={`p-2 rounded-full ${isScrolled ? 'text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800' : 'text-white hover:bg-white/20'} transition-colors duration-300`}
                onClick={toggleDarkMode}
                aria-label="Toggle dark mode"
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              
              <button
                className={`md:hidden p-2 rounded-full ${isScrolled ? 'text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800' : 'text-white hover:bg-white/20'} transition-colors duration-300`}
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
              <Link to="/" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300">홈</Link>
              <Link to="/about" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300">소개</Link>
              <Link to="/portfolio" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300">포트폴리오</Link>
              <Link to="/studio-info" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300">스튜디오</Link>
              <Link to="/practice-room" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300">연습실</Link>
              <Link to="/stories" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300">스토리</Link>
              <Link to="/booking" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300">예약</Link>
              <Link to="/contact" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300">연락처</Link>
            </div>
          </nav>
        )}
      </header>
      
      <main className="flex-grow pt-24">
        {children}
      </main>
      
      <footer className="bg-gray-800 dark:bg-gray-950 text-white p-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4">스튜디오 놀</h3>
              <p className="text-gray-300 mb-4">아티스트의 비전을 실현하는 음악 제작 스튜디오</p>
              <p className="text-gray-400"> 2024 스튜디오 놀. All rights reserved.</p>
            </div>
            
            <div>
              <h3 className="text-lg font-bold mb-4">바로가기</h3>
              <ul className="space-y-2">
                <li><Link to="/" className="text-gray-300 hover:text-white transition-colors duration-300">홈</Link></li>
                <li><Link to="/about" className="text-gray-300 hover:text-white transition-colors duration-300">소개</Link></li>
                <li><Link to="/portfolio" className="text-gray-300 hover:text-white transition-colors duration-300">포트폴리오</Link></li>
                <li><Link to="/stories" className="text-gray-300 hover:text-white transition-colors duration-300">스토리</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-bold mb-4">연락처</h3>
              <a 
                href="https://naver.me/5gFZhS3X" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white transition-colors duration-300 flex items-center mb-2"
              >
                <span className="inline-block w-4 mr-2">📍</span>
                <span className="leading-relaxed">서울특별시 은평구 대조동 84-3 3층</span>
              </a>
              <a 
                href="mailto:contact@kosmart.org" 
                className="text-gray-300 hover:text-white transition-colors duration-300 flex items-center mb-2"
              >
                <span className="inline-block w-4 mr-2">📧</span>
                <span className="leading-relaxed">문의: contact@kosmart.org</span>
              </a>
              <a 
                href="tel:02-764-3114" 
                className="text-gray-300 hover:text-white transition-colors duration-300 flex items-center"
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