import React, { useState } from 'react';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

const ImageUploader = ({ onImageUploaded, folder = 'images' }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // 파일 선택 핸들러
  const handleFileSelect = (event) => {
    setError(null);
    setSuccess(false);
    const file = event.target.files[0];
    
    if (!file) return;
    
    // 파일 타입 검증
    if (!file.type.match('image.*')) {
      setError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }
    
    // 파일 크기 검증 (10MB 제한)
    if (file.size > 10 * 1024 * 1024) {
      setError('파일 크기는 10MB 이하여야 합니다.');
      return;
    }
    
    setSelectedFile(file);
    
    // 미리보기 생성
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // 이미지 업로드 핸들러
  const handleUpload = async () => {
    if (!selectedFile) {
      setError('업로드할 파일을 선택해주세요.');
      return;
    }
    
    if (!navigator.onLine) {
      setError('오프라인 상태에서는 이미지를 업로드할 수 없습니다.');
      return;
    }
    
    setUploading(true);
    setProgress(0);
    setError(null);
    setSuccess(false);
    
    try {
      const storage = getStorage();
      const fileExtension = selectedFile.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExtension}`;
      const storageRef = ref(storage, `${folder}/${fileName}`);
      
      const uploadTask = uploadBytesResumable(storageRef, selectedFile, {
        contentType: selectedFile.type,
        customMetadata: {
          'Content-Type': selectedFile.type,
          'Content-Encoding': 'UTF-8',
        },
      });
      
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // 업로드 진행 상태 업데이트
          const uploadProgress = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          setProgress(uploadProgress);
        },
        (error) => {
          // 업로드 에러 처리
          console.error('이미지 업로드 에러:', error);
          setError('이미지 업로드 중 오류가 발생했습니다. 다시 시도해주세요.');
          setUploading(false);
        },
        async () => {
          // 업로드 완료 처리
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('이미지 업로드 완료:', downloadURL);
            onImageUploaded(downloadURL);
            setSuccess(true);
            setSelectedFile(null);
            setPreview(null);
          } catch (error) {
            console.error('다운로드 URL 가져오기 오류:', error);
            setError('이미지 URL을 가져오는 중 오류가 발생했습니다.');
          } finally {
            setUploading(false);
          }
        }
      );
    } catch (error) {
      console.error('업로드 시작 오류:', error);
      setError('이미지 업로드를 시작할 수 없습니다. 다시 시도해주세요.');
      setUploading(false);
    }
  };

  return (
    <div className="mb-6">
      <h3 className="text-lg font-medium mb-2">
        이미지 업로드
      </h3>
      
      <input
        accept="image/*"
        type="file"
        id="image-upload"
        className="hidden"
        onChange={handleFileSelect}
        disabled={uploading}
      />
      
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <label htmlFor="image-upload">
            <button
              type="button"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={uploading}
              onClick={() => document.getElementById('image-upload').click()}
            >
              파일 선택
            </button>
          </label>
          
          <button
            type="button"
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
          >
            {uploading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                업로드 중...
              </>
            ) : '업로드'}
          </button>
        </div>
        
        {selectedFile && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            선택된 파일: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        )}
        
        {uploading && (
          <div className="w-full mt-2">
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-center mt-1 text-gray-600 dark:text-gray-400">
              {progress}% 업로드 중
            </p>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 mt-2">
            <p className="text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          </div>
        )}
        
        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 p-4 mt-2">
            <p className="text-sm text-green-700 dark:text-green-400">
              이미지 업로드 성공!
            </p>
          </div>
        )}
        
        {preview && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">
              미리보기
            </h4>
            <img
              src={preview}
              alt="미리보기"
              className="max-w-full max-h-48 object-contain border border-gray-300 dark:border-gray-700 rounded-md"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageUploader;
