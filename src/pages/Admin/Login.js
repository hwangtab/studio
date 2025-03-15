import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { loginAdmin, isAdminLoggedIn } from '../../utils/localDataUtils';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  // 이미 로그인 되어 있는지 확인
  useEffect(() => {
    if (isAdminLoggedIn()) {
      navigate('/admin/dashboard');
    }
    
    // GitHub 토큰 저장
    const savedToken = localStorage.getItem('github_token');
    if (savedToken) {
      setGithubToken(savedToken);
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // GitHub 토큰 저장
      if (githubToken) {
        localStorage.setItem('github_token', githubToken);
        setMessage('GitHub 토큰 저장 완료.');
      }
      
      // 로컬 스토리지를 이용한 로그인 처리
      const success = loginAdmin(username, password);
      
      if (success) {
        navigate('/admin/dashboard');
      } else {
        setError('사용자 이름 또는 비밀번호가 올바르지 않습니다.');
      }
    } catch (error) {
      console.error('로그인 오류:', error);
      setError('로그인 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <motion.div 
        className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">관리자 로그인</h1>
          <p className="text-gray-600 dark:text-gray-300">스튜디오 관리자 페이지에 접속하기 위해 로그인하세요.</p>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}
        
        {message && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-6">
            {message}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="username" className="block text-gray-700 dark:text-gray-300 mb-2">사용자 이름</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              required
            />
          </div>
          
          <div className="mb-6">
            <label htmlFor="password" className="block text-gray-700 dark:text-gray-300 mb-2">비밀번호</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              required
            />
          </div>
          
          <div className="mb-6">
            <label htmlFor="githubToken" className="block text-gray-700 dark:text-gray-300 mb-2">GitHub 토큰</label>
            <input
              type="password"
              id="githubToken"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="GitHub Personal Access Token"
            />
            <p className="text-sm text-gray-500 mt-1">GitHub API 사용을 위해 토큰을 입력하세요.</p>
          </div>
          
          <button
            type="submit"
            className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-primary-dark transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                로그인 중...
              </>
            ) : '로그인'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            * 관리자 계정이 필요하시면 시스템 관리자에게 문의하세요.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
