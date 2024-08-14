import React, { useEffect } from 'react';
import initEmailJS from './emailjs';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Services from './pages/Services';
import Portfolio from './pages/Portfolio';
import Studio from './pages/Studio';
import Booking from './pages/Booking';
import Contact from './pages/Contact';

function App() {
  useEffect(() => {
    initEmailJS();
  }, []);

  // GitHub Pages와 커스텀 도메인을 위한 basename 설정
  const basename = process.env.PUBLIC_URL;

  return (
    <Router basename={basename}>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/services" element={<Services />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/studio-info" element={<Studio />} />
          <Route path="/booking" element={<Booking />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}

// 404 리다이렉션 처리
(function(){
  var redirect = sessionStorage.redirect;
  delete sessionStorage.redirect;
  if (redirect && redirect !== window.location.href) {
    window.history.replaceState(null, null, redirect);
  }
})();

export default App;