import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
const NavLink = ({ to, children }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link
      to={to}
      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-300 ${
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
const [isMenuOpen, setIsMenuOpen] = useState(false);
return (
<div className="flex flex-col min-h-screen">
<header className="bg-gradient-to-r from-primary via-secondary to-accent shadow-lg">
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
<div className="flex items-center justify-between">
<Link 
  to="/" 
  className="text-white pt-2 text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-title tracking-wider hover:text-white/90 transition-colors duration-300"
>
  스튜디오 놀
</Link>
<nav className="hidden md:flex space-x-1">
  <NavLink to="/">홈</NavLink>
  <NavLink to="/services">서비스</NavLink>
  <NavLink to="/portfolio">포트폴리오</NavLink>
  <NavLink to="/studio-info">스튜디오</NavLink>
  <NavLink to="/booking">예약</NavLink>
  <NavLink to="/contact">연락처</NavLink>
</nav>
<button
className="md:hidden text-white"
onClick={() => setIsMenuOpen(!isMenuOpen)}
>
<Menu size={24} />
</button>
</div>
</div>
{isMenuOpen && (
<nav className="md:hidden bg-black/30">
<div className="px-2 pt-2 pb-3 space-y-1">
<NavLink to="/">홈</NavLink>
<NavLink to="/services">서비스</NavLink>
<NavLink to="/portfolio">포트폴리오</NavLink>
<NavLink to="/studio-info">스튜디오</NavLink>
<NavLink to="/booking">예약</NavLink>
<NavLink to="/contact">연락처</NavLink>
</div>
</nav>
)}
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