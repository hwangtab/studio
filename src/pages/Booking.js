import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FaCalendarAlt, FaUserAlt, FaEnvelope, FaMusic } from 'react-icons/fa';

const InputField = ({ icon: Icon, ...props }) => (
  <div className="relative mb-6">
    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
      <Icon className="w-5 h-5 text-gray-500" />
    </div>
    <input className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" {...props} />
  </div>
);

const Booking = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    date: '',
    service: ''
  });
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5000/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setMessage('예약이 성공적으로 완료되었습니다.');
        setFormData({ name: '', email: '', date: '', service: '' });
      } else {
        setMessage('예약 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      setMessage('서버 연결 중 오류가 발생했습니다.');
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
        className="max-w-md mx-auto bg-white shadow-lg rounded-lg overflow-hidden"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="px-6 py-8">
          {message && (
            <div className="mb-4 p-2 bg-green-100 text-green-700 rounded">
              {message}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <InputField
              icon={FaUserAlt}
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="이름"
              required
            />
            <InputField
              icon={FaEnvelope}
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="이메일"
              required
            />
            <InputField
              icon={FaCalendarAlt}
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
            />
            <div className="relative mb-6">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <FaMusic className="w-5 h-5 text-gray-500" />
              </div>
              <select
                name="service"
                value={formData.service}
                onChange={handleChange}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
                required
              >
                <option value="">서비스 선택</option>
                <option value="recording">녹음</option>
                <option value="mixing">믹싱</option>
                <option value="mastering">마스터링</option>
              </select>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-primary to-secondary hover:from-primary-dark hover:to-secondary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              예약하기
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default Booking;