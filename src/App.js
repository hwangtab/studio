import React, { useEffect, Suspense, lazy } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import initEmailJS from './emailjs';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
const Home = lazy(() => import('./pages/Home'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const Studio = lazy(() => import('./pages/Studio'));
const PracticeRoom = lazy(() => import('./pages/PracticeRoom'));
const Contact = lazy(() => import('./pages/Contact'));
const About = lazy(() => import('./pages/About'));
const Stories = lazy(() => import('./pages/Stories'));
const StoryDetail = lazy(() => import('./pages/StoryDetail'));
const NotFound = lazy(() => import('./pages/NotFound'));

function App() {
  useEffect(() => {
    // EmailJS 초기화
    initEmailJS();
    
    // 404 리다이렉트 처리
    const redirect = sessionStorage.redirect;
    delete sessionStorage.redirect;
    if (redirect && redirect !== window.location.href) {
      window.history.replaceState(null, null, redirect);
    }
  }, []);

  // GitHub Pages를 위한 basename 설정
  const basename = process.env.PUBLIC_URL;

  return (
    <HelmetProvider>
      <Router basename={basename}>
        <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center text-gray-500">페이지를 불러오는 중입니다...</div>}>
          <Routes>
            <Route path="/" element={<Layout><Home /></Layout>} />
            <Route path="/portfolio" element={<Layout><Portfolio /></Layout>} />
            <Route path="/studio-info" element={<Layout><Studio /></Layout>} />
            <Route path="/practice-room" element={<Layout><PracticeRoom /></Layout>} />
            <Route path="/contact" element={<Layout><Contact /></Layout>} />
            <Route path="/about" element={<Layout><About /></Layout>} />
            <Route path="/stories" element={<Layout><Stories /></Layout>} />
            <Route path="/stories/:id" element={<Layout><StoryDetail /></Layout>} />

            <Route path="*" element={<Layout><NotFound /></Layout>} />
          </Routes>
        </Suspense>
      </Router>
    </HelmetProvider>
  );
}

export default App;
