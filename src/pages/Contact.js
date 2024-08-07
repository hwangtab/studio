import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FaMapMarkerAlt, FaPhone, FaEnvelope, FaUser, FaPaperPlane } from 'react-icons/fa';

const InputField = ({ icon: Icon, ...props }) => (
  <div className="relative mb-4">
    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
      <Icon className="w-5 h-5 text-gray-400" />
    </div>
    <input className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" {...props} />
  </div>
);

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [submitMessage, setSubmitMessage] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5000/api/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setSubmitMessage('메시지가 성공적으로 전송되었습니다.');
        setFormData({ name: '', email: '', message: '' });
      } else {
        setSubmitMessage('메시지 전송에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      setSubmitMessage('서버 연결 중 오류가 발생했습니다.');
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
        연락하기
      </motion.h1>
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-8">
          <motion.div 
            className="bg-white p-6 rounded-lg shadow-lg"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h2 className="text-xl font-bold mb-4">연락처 정보</h2>
            <div className="space-y-4">
              <p className="flex items-center">
                <FaMapMarkerAlt className="w-5 h-5 mr-2 text-primary" />
                서울특별시 은평구 통일로71길 2-1 3층 스튜디오 놀
              </p>
              <p className="flex items-center">
                <FaPhone className="w-5 h-5 mr-2 text-primary" />
                02-764-3114
              </p>
              <p className="flex items-center">
                <FaEnvelope className="w-5 h-5 mr-2 text-primary" />
                contact@kosmart.org
              </p>
            </div>
            <div className="mt-6">
              <h3 className="text-xl font-bold mb-2">상담 가능 시간</h3>
              <p>월요일 - 금요일: 10:00 AM - 6:00 PM</p>
              <p>토요일: 11:00 AM - 4:00 PM</p>
              <p>일요일: 휴무</p>
            </div>
          </motion.div>
          <motion.div 
            className="bg-white p-6 rounded-lg shadow-lg"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <h2 className="text-xl font-bold mb-4">문의하기</h2>
            {submitMessage && (
              <div className="mb-4 p-2 bg-green-100 text-green-700 rounded">
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
                icon={FaEnvelope}
                type="email" 
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="이메일" 
                required 
              />
              <div className="relative mb-4">
                <div className="absolute top-3 left-3 pointer-events-none">
                  <FaPaperPlane className="w-5 h-5 text-gray-400" />
                </div>
                <textarea 
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="메시지" 
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" 
                  rows="4" 
                  required
                ></textarea>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-primary to-secondary hover:from-primary-dark hover:to-secondary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                보내기
              </motion.button>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Contact;