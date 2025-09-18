import React, { useState } from 'react';
import emailjs from '@emailjs/browser';
import { motion } from 'framer-motion';
import { FaMapMarkerAlt, FaPhone, FaEnvelope, FaUser, FaPaperPlane, FaCheckCircle, FaCommentDots } from 'react-icons/fa';
import { PAGE_TITLE_ANIMATION } from '../utils/animationUtils';

const InputField = ({ icon: Icon, ...props }) => (
  <div className="relative mb-4">
    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
      <Icon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
    </div>
    <input className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:border-transparent" {...props} />
  </div>
);

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    message: ''
  });
  const [submitMessage, setSubmitMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const result = await emailjs.send(
        "service_lop4659",
        "template_wxwj093",
        formData,
        "E5wHxyFgSkrjQhYVG"
      );
      console.log('Success:', result.text);
      setSubmitMessage('메시지가 성공적으로 전송되었습니다.');
      setFormData({ name: '', phone: '', message: '' });
    } catch (error) {
      console.error('EmailJS error:', error.text);
      setSubmitMessage('메시지 전송에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <motion.h1 
        className="text-heading-1 font-title mb-12 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent py-4"
        {...PAGE_TITLE_ANIMATION}
      >
        연락하기
      </motion.h1>
      <div className="max-w-6xl mx-auto min-h-[50vh]">
        <div className="grid md:grid-cols-2 gap-6">
          <motion.div 
            className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h2 className="typo-card-title mb-4 text-gray-600 dark:text-gray-200">연락처 정보</h2>
            <div className="space-y-4">
              <a href="https://naver.me/5gFZhS3X" target="_blank" rel="noopener noreferrer" className="flex items-center typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors">
                <FaMapMarkerAlt className="w-5 h-5 mr-2 text-primary dark:text-primary-light" />
                <span className="leading-relaxed">서울시 은평구 대조동 84-3 3층 스튜디오 놀</span>
              </a>
              <a href="tel:02-764-3114" className="flex items-center typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors">
                <FaPhone className="w-5 h-5 mr-2 text-primary dark:text-primary-light" />
                <span className="leading-relaxed">02-764-3114</span>
              </a>
              <a href="mailto:contact@kosmart.org" className="flex items-center typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors">
                <FaEnvelope className="w-5 h-5 mr-2 text-primary dark:text-primary-light" />
                <span className="leading-relaxed">contact@kosmart.org</span>
              </a>
              <a href="https://open.kakao.com/me/nol" target="_blank" rel="noopener noreferrer" className="flex items-center typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors">
                <FaCommentDots className="w-5 h-5 mr-2 text-primary dark:text-primary-light" />
                <span className="leading-relaxed">카카오톡 오픈채팅</span>
              </a>
            </div>
            <div className="mt-6">
              <h3 className="typo-card-title mb-4 text-gray-600 dark:text-gray-200">찾아오시는 길</h3>
              <div className="mb-6">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3160.8635287891844!2d126.92362527640926!3d37.61435329999999!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x357c977d6c9b9b61%3A0x4ba77c752231fd06!2z7Iqk7Yqc65SU7Jik64W4!5e0!3m2!1sko!2skr!4v1704364800000!5m2!1sko!2skr"
                  width="100%"
                  height="200"
                  style={{ border: 0, borderRadius: '8px' }}
                  allowFullScreen=""
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="스튜디오 놀 위치"
                ></iframe>
              </div>
            </div>
            <div className="mt-6">
            <h3 className="typo-card-title mb-4 text-gray-600 dark:text-gray-200">상담 가능 시간</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="dark:text-gray-300 typo-card-body">월요일 - 금요일</span>
                  <span className="dark:text-gray-300">10:00 AM - 6:00 PM</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="dark:text-gray-300 typo-card-body">토요일</span>
                  <span className="dark:text-gray-300">12:00 PM - 6:00 PM</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="dark:text-gray-300 typo-card-body">일요일</span>
                  <span className="text-red-500 dark:text-red-400">상담 업무 미제공</span>
                </div>
              </div>
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                <p className="typo-card-body text-blue-800 dark:text-blue-300">
                  <span className="typo-card-body text-blue-900 dark:text-blue-200">주차 안내:</span> 인근 KT은평빌딩 주차장 유료 이용 가능
                </p>
                <p className="typo-card-body text-blue-800 dark:text-blue-300 mt-1">
                  <span className="typo-card-body text-blue-900 dark:text-blue-200">대중교통:</span> 지하철 6호선 불광역 7번 출구 도보 5분
                </p>
              </div>
            </div>
          </motion.div>
          <motion.div 
            className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <h2 className="typo-card-title mb-4 text-gray-600 dark:text-gray-200">문의하기</h2>
            {submitMessage && (
              <div className={`mb-4 p-4 rounded-md flex items-center ${submitMessage.includes('성공') ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
                {submitMessage.includes('성공') && <FaCheckCircle className="mr-2" />}
                {submitMessage}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <InputField 
                icon={FaUser}
                type="text" 
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="이름" 
                required 
              />
              <InputField 
                icon={FaPhone}
                type="tel" 
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="연락처" 
                required 
              />
              <div className="relative mb-4">
                <div className="absolute top-3 left-3 pointer-events-none">
                  <FaPaperPlane className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                </div>
                <textarea 
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="메시지" 
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:border-transparent" 
                  rows="8" 
                  required
                ></textarea>
              </div>
              <div className="space-y-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-body-1 text-white bg-gradient-to-r from-primary to-secondary hover:from-primary-dark hover:to-secondary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      처리 중...
                    </>
                  ) : (
                    <>
                      <FaPaperPlane className="mr-2" />
                      이메일로 문의하기
                    </>
                  )}
                </motion.button>
                
                <motion.a
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  href="https://open.kakao.com/me/nol"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-body-2 text-gray-800 bg-yellow-400 hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 transition-colors duration-200"
                >
                  <FaCommentDots className="mr-2" />
                  카카오톡으로 문의하기
                </motion.a>
              </div>
            </form>
            
            <div className="mt-6 space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                <h4 className="typo-card-subtitle text-blue-800 dark:text-blue-300 mb-2">문의 전 확인사항</h4>
                <ul className="typo-card-body text-blue-700 dark:text-blue-400 space-y-1">
                  <li>• 24시간 내 답변 드립니다</li>
                  <li>• 구체적인 프로젝트 내용을 적어주시면 정확한 상담 가능</li>
                  <li>• 급한 문의는 카카오톡을 이용해주세요</li>
                </ul>
              </div>
              
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                <h4 className="typo-card-subtitle text-gray-800 dark:text-gray-300 mb-2">개인정보 처리방침</h4>
                <p className="typo-card-body text-gray-600 dark:text-gray-400">
                  수집된 개인정보는 문의 응답 목적으로만 사용되며, 상담 완료 후 즉시 삭제됩니다.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
