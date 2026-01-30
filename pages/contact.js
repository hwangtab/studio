import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Phone, Mail, User, Send, CheckCircle, MessageCircle } from 'lucide-react';
import { PAGE_TITLE_ANIMATION } from '../utils/animationUtils';
import SEO from '../components/SEO';
import ImageHero from '../components/common/ImageHero';

import { SITE_CONFIG } from '../data/siteConfig';

const InputField = ({ icon: Icon, label, id, ...props }) => (
  <div className="relative mb-4">
    <label htmlFor={id} className="sr-only">{label}</label>
    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
      <Icon className="w-5 h-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
    </div>
    <input id={id} className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:border-transparent" {...props} />
  </div>
);

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    message: '',
    company: '',
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
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || '메시지 전송에 실패했습니다.');
      }

      setSubmitMessage('메시지가 성공적으로 전송되었습니다.');
      setFormData({ name: '', phone: '', message: '', company: '' });
    } catch (error) {
      console.error('Contact form error:', error);
      setSubmitMessage('메시지 전송에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <SEO
        title="연신내 녹음실 · 연습실 예약 문의 | 스튜디오 놀"
        description="스튜디오 놀 녹음실/연습실 예약, 견적 상담은 전화 02-764-3114 또는 카카오톡 @nol로 연락주세요. 위치: 서울 은평구 대조동 84-3 3층."
        keywords="녹음실 예약 문의, 연습실 예약, 스튜디오 놀 연락처, 연신내 녹음실 상담"
        canonical="https://studionol.co.kr/contact"
      />
      <ImageHero
        title="연락하기"
        subtitle="프로젝트에 대한 문의나 예약 상담을 편하게 해주세요."
        backgroundImage="/images/studio3.jpg"
        imageAlt="스튜디오 놀 연락"
        minHeight="min-h-[60vh]"
      />
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            <motion.div
              className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <h2 className="typo-card-title mb-4 text-gray-600 dark:text-gray-200">연락처 정보</h2>
              <div className="space-y-4">
                <a href={SITE_CONFIG.contact.naverMapUrl} target="_blank" rel="noopener noreferrer" className="flex items-center typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors">
                  <MapPin className="w-5 h-5 mr-2 text-primary dark:text-primary-light" />
                  <span className="leading-relaxed">{SITE_CONFIG.contact.address} {SITE_CONFIG.name}</span>
                </a>
                <a href={`tel:${SITE_CONFIG.contact.phone}`} className="flex items-center typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors">
                  <Phone className="w-5 h-5 mr-2 text-primary dark:text-primary-light" />
                  <span className="leading-relaxed">{SITE_CONFIG.contact.phone}</span>
                </a>
                <a href={`mailto:${SITE_CONFIG.contact.email}`} className="flex items-center typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors">
                  <Mail className="w-5 h-5 mr-2 text-primary dark:text-primary-light" />
                  <span className="leading-relaxed">{SITE_CONFIG.contact.email}</span>
                </a>
                <a href={SITE_CONFIG.contact.kakaoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors">
                  <MessageCircle className="w-5 h-5 mr-2 text-primary dark:text-primary-light" />
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
                  {submitMessage.includes('성공') && <CheckCircle className="mr-2" size={18} />}
                  {submitMessage}
                </div>
              )}
              <form onSubmit={handleSubmit}>
                <input
                  id="company"
                  name="company"
                  type="text"
                  className="hidden"
                  autoComplete="off"
                  tabIndex="-1"
                  value={formData.company}
                  onChange={handleChange}
                  aria-hidden="true"
                  spellCheck="false"
                />
                <InputField
                  icon={User}
                  id="name"
                  label="이름"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="이름"
                  required
                  autoComplete="name"
                />
                <InputField
                  icon={Phone}
                  id="phone"
                  label="연락처"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="연락처"
                  required
                  autoComplete="tel"
                />
                <div className="relative mb-4">
                  <label htmlFor="message" className="sr-only">메시지</label>
                  <div className="absolute top-3 left-3 pointer-events-none">
                    <Send className="w-5 h-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                  </div>
                  <textarea
                    id="message"
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
                        <Send className="mr-2" size={18} />
                        이메일로 문의하기
                      </>
                    )}
                  </motion.button>

                  <motion.a
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    href={SITE_CONFIG.contact.kakaoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-body-1 text-gray-900 dark:text-gray-900 bg-yellow-400 hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 transition-colors duration-200 font-title"
                  >
                    <MessageCircle className="mr-2" size={18} />
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
    </>
  );
};

export default Contact;

Contact.hasHero = true;

export const getStaticProps = () => ({
  props: {},
});
