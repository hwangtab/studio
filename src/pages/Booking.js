import React, { useState } from 'react';
import emailjs from '@emailjs/browser';
import { FaUser, FaPhone, FaCalendarAlt, FaCogs, FaComments, FaCheckCircle } from 'react-icons/fa';
import { motion } from 'framer-motion';

const InputField = ({ icon: Icon, ...props }) => (
  <div className="relative mb-4">
    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
      <Icon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
    </div>
    <input className="w-full pl-10 pr-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" {...props} />
  </div>
);

const Booking = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    date: '',
    service: '',
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
        "service_lop4659",  // 서비스 ID
        "template_wxwj093", // 템플릿 ID
        formData,
        "E5wHxyFgSkrjQhYVG" // 퍼블릭 키
      );
      console.log('Success:', result.text);
      setSubmitMessage('예약 요청이 성공적으로 전송되었습니다.');
      setFormData({ name: '', phone: '', date: '', service: '', message: '' });
    } catch (error) {
      console.error('EmailJS error:', error.text);
      setSubmitMessage('예약 요청 전송에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <motion.h1 
        className="text-heading-1 font-title mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent py-4"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        예약하기
      </motion.h1>
      
      <motion.div
        className="max-w-5xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <motion.form 
          onSubmit={handleSubmit} 
          className="max-w-md mx-auto bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        > 
          {submitMessage && (
            <div className={`mb-4 p-4 rounded-md flex items-center ${submitMessage.includes('성공') ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
              {submitMessage.includes('성공') && <FaCheckCircle className="mr-2" />}
              {submitMessage}
            </div>
          )}
          
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
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <FaCalendarAlt className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="w-full pl-10 pr-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              required
            />
          </div>
          <div className="relative mb-4">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <FaCogs className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            <select
              name="service"
              value={formData.service}
              onChange={handleChange}
              className="w-full pl-10 pr-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              required
            >
              <option value="">서비스 선택</option>
              <option value="recording">녹음</option>
              <option value="mixing">믹싱</option>
              <option value="mastering">마스터링</option>
            </select>
          </div>
          <div className="relative mb-4">
            <div className="absolute top-3 left-3 pointer-events-none">
              <FaComments className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            <textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              placeholder="추가 메시지"
              className="w-full pl-10 pr-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              rows="4"
            ></textarea>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-primary to-secondary hover:from-primary-dark hover:to-secondary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <FaCheckCircle className="mr-2" />
                예약 요청
              </>
            )}
          </motion.button>
        </motion.form>
      </motion.div>
    </div>
  );
};

export default Booking;