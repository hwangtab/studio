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
      setMessage('GitHub 토큰이 이미 저장되어 있습니다.');
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
        console.log('GitHub 토큰 저장됨:', githubToken.substring(0, 5) + '...');
        setMessage('GitHub 토큰 저장 완료.');
      } else {
        setError('GitHub 토큰을 입력해주세요.');
        setLoading(false);
        return;
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
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-md"
      >
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">관리자 로그인</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            스튜디오 놀 관리자 페이지에 접속하세요
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="username" className="sr-only">사용자 이름</label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="사용자 이름"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">비밀번호</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="github-token" className="sr-only">GitHub 토큰</label>
              <input
                id="github-token"
                name="github-token"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="GitHub 토큰"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm">
              {error}
            </div>
          )}

          {message && (
            <div className="text-green-500 text-sm">
              {message}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${loading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default Login;
