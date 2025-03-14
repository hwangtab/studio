import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaPlus, FaEdit, FaTrash, FaSignOutAlt } from 'react-icons/fa';
import { getAllStories, deleteStory, isAdminLoggedIn, logoutAdmin } from '../../utils/localDataUtils';

const Dashboard = () => {
  const navigate = useNavigate();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  // 관리자 로그인 확인
  useEffect(() => {
    if (!isAdminLoggedIn()) {
      navigate('/admin/login');
    }
  }, [navigate]);

  // 스토리 데이터 불러오기
  useEffect(() => {
    const fetchStories = async () => {
      try {
        setLoading(true);
        const storiesData = await getAllStories();
        setStories(storiesData);
        setLoading(false);
      } catch (error) {
        console.error('스토리 불러오기 오류:', error);
        setError('스토리를 불러오는 중 오류가 발생했습니다.');
        setLoading(false);
      }
    };

    fetchStories();
  }, [deleteSuccess]);

  // 로그아웃 처리
  const handleLogout = () => {
    logoutAdmin();
    navigate('/admin/login');
  };

  // 스토리 삭제 확인
  const confirmDelete = (id) => {
    setDeleteConfirm(id);
  };

  // 스토리 삭제 취소
  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  // 스토리 삭제 처리
  const handleDelete = async (id) => {
    try {
      await deleteStory(id);
      setDeleteConfirm(null);
      setDeleteSuccess(true);
      
      // 3초 후 성공 메시지 숨기기
      setTimeout(() => {
        setDeleteSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('스토리 삭제 오류:', error);
      setError('스토리를 삭제하는 중 오류가 발생했습니다.');
    }
  };

  // 로딩 중 표시
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">관리자 대시보드</h1>
        <div className="flex justify-center items-center h-64">
          <p className="text-lg">스토리를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <div className="max-w-6xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">관리자 대시보드</h1>
            
            <div className="flex items-center space-x-4">
              <Link
                to="/admin/story/new"
                className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors duration-300"
              >
                <FaPlus className="mr-2" />
                새 스토리 작성
              </Link>
              
              <button
                onClick={handleLogout}
                className="flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-300"
              >
                <FaSignOutAlt className="mr-2" />
                로그아웃
              </button>
            </div>
          </div>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}
          
          {deleteSuccess && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-6">
              스토리가 성공적으로 삭제되었습니다.
            </div>
          )}
          
          {stories.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 text-lg">등록된 스토리가 없습니다.</p>
              <Link
                to="/admin/story/new"
                className="inline-block mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors duration-300"
              >
                새 스토리 작성하기
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      제목
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      카테고리
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      작성일
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      관리
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {stories.map((story) => (
                    <tr key={story.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{story.title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary/10 text-primary">
                          {story.category === 'work' ? '작업기' : 
                           story.category === 'interview' ? '인터뷰' : 
                           story.category === 'tips' ? '팁과 정보' : story.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(story.createdAt || Date.now()).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <Link
                            to={`/admin/story/new?edit=${story.id}`}
                            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                          >
                            <FaEdit size={18} />
                          </Link>
                          
                          <button
                            onClick={() => confirmDelete(story.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <FaTrash size={18} />
                          </button>
                          
                          {deleteConfirm === story.id && (
                            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm mx-auto">
                                <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">스토리 삭제 확인</h3>
                                <p className="text-gray-700 dark:text-gray-300 mb-6">정말로 이 스토리를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</p>
                                
                                <div className="flex justify-end space-x-2">
                                  <button
                                    onClick={cancelDelete}
                                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-300"
                                  >
                                    취소
                                  </button>
                                  <button
                                    onClick={() => handleDelete(story.id)}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-300"
                                  >
                                    삭제
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
