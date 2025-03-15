import React, { useEffect } from 'react';
import initEmailJS from './emailjs';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Portfolio from './pages/Portfolio';
import Studio from './pages/Studio';
import PracticeRoom from './pages/PracticeRoom';
import Booking from './pages/Booking';
import Contact from './pages/Contact';
import About from './pages/About';
import Stories from './pages/Stories';
import StoryDetail from './pages/StoryDetail';
import Login from './pages/Admin/Login';
import Dashboard from './pages/Admin/Dashboard';
import StoryForm from './pages/Admin/StoryForm';

function App() {
  useEffect(() => {
    // EmailJS ucd08uae30ud654
    initEmailJS();
    
    // 404 ub9acub2e4uc774ub809uc158 ucc98ub9ac
    const redirect = sessionStorage.redirect;
    delete sessionStorage.redirect;
    if (redirect && redirect !== window.location.href) {
      window.history.replaceState(null, null, redirect);
    }
  }, []);

  // GitHub Pagesuc640 ucee4uc2a4ud140 ub3c4uba54uc778uc744 uc704ud55c basename uc124uc815
  const basename = process.env.PUBLIC_URL || '/';

  return (
    <Router basename={basename}>
      <Routes>
        {/* uc77cubc18 uc0acuc6a9uc790 ud398uc774uc9c0 - Layout ud3ecud568 */}
        <Route path="/" element={<Layout><Home /></Layout>} />
        <Route path="/portfolio" element={<Layout><Portfolio /></Layout>} />
        <Route path="/studio-info" element={<Layout><Studio /></Layout>} />
        <Route path="/practice-room" element={<Layout><PracticeRoom /></Layout>} />
        <Route path="/booking" element={<Layout><Booking /></Layout>} />
        <Route path="/contact" element={<Layout><Contact /></Layout>} />
        <Route path="/about" element={<Layout><About /></Layout>} />
        <Route path="/stories" element={<Layout><Stories /></Layout>} />
        <Route path="/stories/:id" element={<Layout><StoryDetail /></Layout>} />
        
        {/* uad00ub9acuc790 ud398uc774uc9c0 - Layout uc5c6uc74c */}
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin/dashboard" element={<Dashboard />} />
        <Route path="/admin/story/new" element={<StoryForm />} />
        <Route path="/admin/story/edit/:id" element={<StoryForm />} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;