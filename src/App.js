import React, { useEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import initEmailJS from './emailjs';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Portfolio from './pages/Portfolio';
import Studio from './pages/Studio';
import PracticeRoom from './pages/PracticeRoom';
import Contact from './pages/Contact';
import About from './pages/About';
import Stories from './pages/Stories';
import StoryDetail from './pages/StoryDetail';

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
        <Routes>
          <Route path="/" element={<Layout><Home /></Layout>} />
          <Route path="/portfolio" element={<Layout><Portfolio /></Layout>} />
          <Route path="/studio-info" element={<Layout><Studio /></Layout>} />
          <Route path="/practice-room" element={<Layout><PracticeRoom /></Layout>} />
          <Route path="/contact" element={<Layout><Contact /></Layout>} />
          <Route path="/about" element={<Layout><About /></Layout>} />
          <Route path="/stories" element={<Layout><Stories /></Layout>} />
          <Route path="/stories/:id" element={<Layout><StoryDetail /></Layout>} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </HelmetProvider>
  );
}

export default App;