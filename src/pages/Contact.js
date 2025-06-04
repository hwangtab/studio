import React, { useState } from 'react';
import emailjs from '@emailjs/browser';
import { motion } from 'framer-motion';
import { FaMapMarkerAlt, FaPhone, FaEnvelope, FaUser, FaPaperPlane, FaCheckCircle, FaCommentDots } from 'react-icons/fa';

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
        className="text-heading-1 font-title mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent py-4"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        연락하기
      </motion.h1>
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-8">
          <motion.div 
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h2 className="text-xl font-bold mb-4 dark:text-white">연락처 정보</h2>
            <div className="space-y-4">
              <a href="https://naver.me/5gFZhS3X" target="_blank" rel="noopener noreferrer" className="flex items-center text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-primary-light transition-colors">
                <FaMapMarkerAlt className="w-5 h-5 mr-2 text-primary dark:text-primary-light" />
                <span className="leading-relaxed">서울시 은평구 대조동 84-3 3층 스튜디오 놀</span>
              </a>
              <a href="tel:02-764-3114" className="flex items-center text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-primary-light transition-colors">
                <FaPhone className="w-5 h-5 mr-2 text-primary dark:text-primary-light" />
                <span className="leading-relaxed">02-764-3114</span>
              </a>
              <a href="mailto:contact@kosmart.org" className="flex items-center text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-primary-light transition-colors">
                <FaEnvelope className="w-5 h-5 mr-2 text-primary dark:text-primary-light" />
                <span className="leading-relaxed">contact@kosmart.org</span>
              </a>
              <a href="https://open.kakao.com/o/sgTfRiah" target="_blank" rel="noopener noreferrer" className="flex items-center text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-primary-light transition-colors">
                <FaCommentDots className="w-5 h-5 mr-2 text-primary dark:text-primary-light" />
                <span className="leading-relaxed">카카오톡 오픈채팅</span>
              </a>
            </div>
            <div className="mt-6">
              <h3 className="text-xl font-bold mb-2 dark:text-white">상담 가능 시간</h3>
              <p className="dark:text-gray-300 leading-relaxed">월요일 - 금요일: 10:00 AM - 6:00 PM</p>
              <p className="dark:text-gray-300 leading-relaxed">토요일: 12:00 PM - 6:00 PM</p>
              <p className="dark:text-gray-300 leading-relaxed">일요일: 상담 업무 미제공</p>
            </div>
          </motion.div>
          <motion.div 
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <h2 className="text-xl font-bold mb-4 dark:text-white">문의하기</h2>
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
                  rows="4" 
                  required
                ></textarea>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-primary to-secondary hover:from-primary-dark hover:to-secondary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
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
                    보내기
                  </>
                )}
              </motion.button>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Contact;