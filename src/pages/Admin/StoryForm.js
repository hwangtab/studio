import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaArrowLeft, FaSave, FaUpload, FaTrash } from 'react-icons/fa';
import { getStoryById, addStory, updateStory, handleImageUpload, isAdminLoggedIn } from '../../utils/localDataUtils';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

// 스토리 작성/수정 폼을 위한 카테고리 선택 옵션
const CATEGORIES = [
  { value: 'work', label: '작업기' },
  { value: 'interview', label: '인터뷰' },
  { value: 'tips', label: '팁과 정보' }
];

// 에디터 설정
const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'align': [] }],
    ['link', 'image'],
    ['clean']
  ],
};

const quillFormats = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'list', 'bullet',
  'color', 'background',
  'align',
  'link', 'image'
];

const StoryForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const editId = queryParams.get('edit');
  const storyId = id || editId;
  const isEditMode = !!storyId;
  
  // 스토리 상태
  const [formData, setFormData] = useState({
    title: '',
    summary: '',
    content: '',
    category: 'work',
    imageUrl: '',
    author: '관리자'
  });
  
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // 관리자 로그인 확인
  useEffect(() => {
    if (!isAdminLoggedIn()) {
      navigate('/admin/login');
    }
  }, [navigate]);

  // 편집 모드일 경우 스토리 데이터 불러오기
  useEffect(() => {
    const fetchStory = async () => {
      if (isEditMode) {
        try {
          setLoading(true);
          console.log('스토리 ID 불러오기:', storyId);
          const storyData = await getStoryById(storyId);
          
          if (storyData) {
            setFormData({
              title: storyData.title || '',
              summary: storyData.summary || '',
              content: storyData.content || '',
              category: storyData.category || 'work',
              imageUrl: storyData.imageUrl || '',
              author: storyData.author || '관리자'
            });
            
            if (storyData.imageUrl) {
              setImagePreview(storyData.imageUrl);
            }
          } else {
            setError('스토리를 찾을 수 없습니다.');
          }
          
          setLoading(false);
        } catch (error) {
          console.error('스토리 불러오기 오류:', error);
          setError('스토리를 불러오는 중 오류가 발생했습니다.');
          setLoading(false);
        }
      }
    };
    
    fetchStory();
  }, [storyId, isEditMode]);

  // 입력 필드 변경 핸들러
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // 에디터 변경 핸들러
  const handleEditorChange = (content) => {
    setFormData(prev => ({ ...prev, content }));
  };

  // 이미지 업로드 핸들러
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // 이미지 삭제 핸들러
  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview('');
    setFormData(prev => ({ ...prev, imageUrl: '' }));
  };

  // 폼 제출 핸들러
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);
      
      // 필수 필드 검증
      if (!formData.title || !formData.content || !formData.category) {
        setError('제목, 내용, 카테고리는 필수 항목입니다.');
        setLoading(false);
        return;
      }
      
      // 이미지 처리
      let imageUrl = formData.imageUrl;
      if (imageFile) {
        imageUrl = await handleImageUpload(imageFile);
      }
      
      const storyData = {
        ...formData,
        imageUrl
      };
      
      if (isEditMode) {
        // 스토리 업데이트
        await updateStory(storyId, storyData);
      } else {
        // 새 스토리 추가
        await addStory(storyData);
      }
      
      setSuccess(true);
      
      // 2초 후 대시보드로 이동
      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 2000);
      
    } catch (error) {
      console.error('스토리 저장 오류:', error);
      setError('스토리 저장 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  // 로딩 중 표시
  if (loading && !success) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">{isEditMode ? '스토리 편집' : '새 스토리 작성'}</h1>
        <div className="flex justify-center items-center h-64">
          <p className="text-lg">{isEditMode ? '스토리 불러오는 중...' : '스토리 저장 중...'}</p>
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
            <div className="flex items-center">
              <button 
                onClick={() => navigate('/admin/dashboard')} 
                className="mr-4 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                <FaArrowLeft size={20} />
              </button>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
                {isEditMode ? '스토리 편집' : '새 스토리 작성'}
              </h1>
            </div>
          </div>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-6">
              {isEditMode ? '스토리가 성공적으로 업데이트되었습니다.' : '스토리가 성공적으로 저장되었습니다.'}
              <br />
              <span className="text-sm">대시보드로 이동합니다...</span>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                제목 *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                placeholder="스토리 제목을 입력하세요"
                required
              />
            </div>
            
            <div>
              <label htmlFor="summary" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                요약
              </label>
              <textarea
                id="summary"
                name="summary"
                value={formData.summary}
                onChange={handleChange}
                rows="2"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                placeholder="스토리의 간략한 요약을 입력하세요"
              />
            </div>
            
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                카테고리 *
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                required
              >
                {CATEGORIES.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                이미지
              </label>
              <div className="flex items-center space-x-4">
                <label className="flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer">
                  <FaUpload className="mr-2" />
                  이미지 업로드
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
                
                {imagePreview && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="flex items-center px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                  >
                    <FaTrash className="mr-2" />
                    이미지 삭제
                  </button>
                )}
              </div>
              
              {imagePreview && (
                <div className="mt-4 relative">
                  <img
                    src={imagePreview}
                    alt="미리보기"
                    className="w-full max-w-md h-auto rounded-lg border border-gray-300 dark:border-gray-700"
                  />
                </div>
              )}
            </div>
            
            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                내용 *
              </label>
              <ReactQuill
                theme="snow"
                value={formData.content}
                onChange={handleEditorChange}
                modules={quillModules}
                formats={quillFormats}
                className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg"
                placeholder="스토리 내용을 작성하세요"
              />
            </div>
            
            <div className="flex justify-end pt-6">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors duration-300"
              >
                <FaSave className="mr-2" />
                {isEditMode ? '업데이트' : '저장'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default StoryForm;
