import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const NavLink = ({ to, children }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link
      to={to}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-300 ${
        isActive
          ? 'bg-white text-primary-dark'
          : 'text-white hover:bg-white/20'
      }`}
    >
      {children}
    </Link>
  );
};

const Layout = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-gradient-to-r from-primary via-secondary to-accent shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-center">
          <Link 
  to="/" 
  className="text-white text-6xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl pt-4 font-title tracking-wider shadow-sm hover:text-white/90 transition-colors duration-300 whitespace-normal break-words"
>
  스튜디오 놀
</Link>
          </div>
        </div>
        <nav className="bg-black/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-center space-x-4 py-3">
              <NavLink to="/">홈</NavLink>
              <NavLink to="/services">서비스</NavLink>
              <NavLink to="/portfolio">포트폴리오</NavLink>
              <NavLink to="/studio-info">스튜디오</NavLink>
              <NavLink to="/booking">예약</NavLink>
              <NavLink to="/contact">연락처</NavLink>
            </div>
          </div>
        </nav>
      </header>
      <main className="flex-grow">
        {children}
      </main>
      <footer className="bg-gray-800 text-white p-4 text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          © 2024 스튜디오 놀. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Layout;