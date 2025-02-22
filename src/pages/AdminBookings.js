import React, { useState, useEffect } from 'react';

const AdminBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [bookingsResponse, contactsResponse] = await Promise.all([
        fetch('http://localhost:5000/api/bookings'),
        fetch('http://localhost:5000/api/contacts')
      ]);
  
      if (!bookingsResponse.ok || !contactsResponse.ok) {
        throw new Error('서버 응답이 실패했습니다');
      }
  
      const bookingsData = await bookingsResponse.json();
      const contactsData = await contactsResponse.json();
  
      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
      setContacts(Array.isArray(contactsData) ? contactsData : []);
      setLoading(false);
    } catch (err) {
      console.error('Data fetching error:', err);
      setError(err.message);
      setLoading(false);
    }
  };
  if (loading) return <div>로딩 중...</div>;
  if (error) return <div>에러: {error}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">관리자 페이지</h1>
      
      <h2 className="text-2xl font-bold mb-4">예약 목록</h2>
      <table className="w-full border-collapse mb-8">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">이름</th>
            <th className="border p-2">이메일</th>
            <th className="border p-2">날짜</th>
            <th className="border p-2">서비스</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking, index) => (
            <tr key={index} className="hover:bg-gray-100">
              <td className="border p-2">{booking.name}</td>
              <td className="border p-2">{booking.email}</td>
              <td className="border p-2">{booking.date}</td>
              <td className="border p-2">{booking.service}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="text-2xl font-bold mb-4">연락처 메시지</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">이름</th>
            <th className="border p-2">이메일</th>
            <th className="border p-2">메시지</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact, index) => (
            <tr key={index} className="hover:bg-gray-100">
              <td className="border p-2">{contact.name}</td>
              <td className="border p-2">{contact.email}</td>
              <td className="border p-2">{contact.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AdminBookings;