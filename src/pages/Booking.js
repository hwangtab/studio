import React, { useState } from 'react';
import emailjs from '@emailjs/browser';
import { FaUser, FaPhone, FaCalendarAlt, FaCogs, FaComments } from 'react-icons/fa';
import { motion } from 'framer-motion';
import { FaCheckCircle } from 'react-icons/fa';

const InputField = ({ icon: Icon, ...props }) => (
  <div className="relative mb-4">
    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
      <Icon className="w-5 h-5 text-gray-500" />
    </div>
    <input className="w-full pl-10 pr-3 py-2 border rounded-md" {...props} />
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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
    }
  };

  return (
    <div className="container mx-auto px-4 py-12">
  <motion.h1 
    className="text-5xl pt-2 font-title mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent"
    initial={{ opacity: 0, y: -50 }}
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
    {submitMessage && (
      <div className="mb-4 p-2 bg-green-100 text-green-700 rounded">
        {submitMessage}
      </div>
    )}
    <motion.form 
      onSubmit={handleSubmit} 
      className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-lg"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    > 
      {submitMessage && (
        <div className="mb-4 p-2 bg-green-100 text-green-700 rounded">
          {submitMessage}
        </div>
      )}
      <form onSubmit={handleSubmit} className="max-w-md mx-auto">
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
            <FaCalendarAlt className="w-5 h-5 text-gray-500" />
          </div>
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            className="w-full pl-10 pr-3 py-2 border rounded-md"
            required
          />
        </div>
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <FaCogs className="w-5 h-5 text-gray-500" />
          </div>
          <select
            name="service"
            value={formData.service}
            onChange={handleChange}
            className="w-full pl-10 pr-3 py-2 border rounded-md"
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
            <FaComments className="w-5 h-5 text-gray-500" />
          </div>
          <textarea
            name="message"
            value={formData.message}
            onChange={handleChange}
            placeholder="추가 메시지"
            className="w-full pl-10 pr-3 py-2 border rounded-md"
            rows="4"
          ></textarea>
        </div>
        <motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  type="submit"
  className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-primary to-secondary hover:from-primary-dark hover:to-secondary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition duration-300"
>
  <FaCheckCircle className="mr-2" />
  예약 요청
</motion.button>
      </form>
      </motion.form>
  </motion.div>
</div>

  );
};

export default Booking;