import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import { FaPlus, FaEdit, FaTrash, FaSignOutAlt, FaEye } from 'react-icons/fa';

const AdminDashboard = () => {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const navigate = useNavigate();

  // uc778uc99d uc0c1ud0dc ud655uc778
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        navigate('/admin/login');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // uc2a4ud1a0ub9ac ub370uc774ud130 uac00uc838uc624uae30
  useEffect(() => {
    const fetchStories = async () => {
      try {
        // uc2e4uc81c Firebase uc5f0uacb0 uc2dc uc0acuc6a9
        // const storiesSnapshot = await getDocs(collection(db, 'stories'));
        // const storiesData = storiesSnapshot.docs.map(doc => ({
        //   id: doc.id,
        //   ...doc.data()
        // }));
        // setStories(storiesData);

        // ud14cuc2a4ud2b8uc6a9 uc0d8ud50c ub370uc774ud130
        const sampleStories = [
          {
            id: 'story-1',
            title: 'uc790uc774 <Golden Hour> uc568ubc94 uc81cuc791uae30',
            category: 'uc791uc5c5uae30',
            date: '2025-02-15',
            thumbnail: 'https://image.bugsm.co.kr/album/images/1000/373556/37355636.jpg'
          },
          {
            id: 'story-2',
            title: 'uc2e0uc608 uc544ud2f0uc2a4ud2b8 uc778ud130ubdf0 - ud76cuc6b0',
            category: 'uc778ud130ubdf0',
            date: '2025-01-20',
            thumbnail: 'https://i.ibb.co/TLMnbkF/jai-golden-hour.jpg'
          },
          {
            id: 'story-3',
            title: 'uc74cuc545 uc81cuc791uc790ub97c uc704ud55c ud648 ub808ucf54ub529 ud301',
            category: 'ud301&uac00uc774ub4dc',
            date: '2025-01-05',
            thumbnail: 'https://i.ibb.co/TLMnbkF/jai-golden-hour.jpg'
          }
        ];
        
        setStories(sampleStories);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching stories:', error);
        setLoading(false);
      }
    };

    fetchStories();
  }, []);

  // ub85cuadf8uc544uc6c3 ucc98ub9ac
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/admin/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // uc2a4ud1a0ub9ac uc0aduc81c ucc98ub9ac
  const handleDelete = async (id) => {
    try {
      // uc2e4uc81c Firebase uc5f0uacb0 uc2dc uc0acuc6a9
      // await deleteDoc(doc(db, 'stories', id));
      
      // ud14cuc2a4ud2b8uc6a9 uc0aduc81c ub85cuc9c1
      setStories(stories.filter(story => story.id !== id));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting story:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">uad00ub9acuc790 ub300uc2dcubcf4ub4dc</h1>
          <button
            onClick={handleLogout}
            className="flex items-center text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary transition-colors duration-300"
          >
            <FaSignOutAlt className="mr-2" />
            ub85cuadf8uc544uc6c3
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">uc2a4ud1a0ub9ac uad00ub9ac</h2>
          <Link
            to="/admin/stories/new"
            className="bg-primary text-white px-4 py-2 rounded-lg flex items-center hover:bg-primary-dark transition-colors duration-300"
          >
            <FaPlus className="mr-2" />
            uc0c8 uc2a4ud1a0ub9ac uc791uc131
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-gray-600 dark:text-gray-300">Loading...</p>
          </div>
        ) : stories.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 text-center">
            <p className="text-gray-600 dark:text-gray-300 mb-4">uc791uc131ub41c uc2a4ud1a0ub9acuac00 uc5c6uc2b5ub2c8ub2e4.</p>
            <Link
              to="/admin/stories/new"
              className="inline-flex items-center text-primary hover:underline"
            >
              <FaPlus className="mr-2" />
              uccab ubc88uc9f8 uc2a4ud1a0ub9ac uc791uc131ud558uae30
            </Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">uc81cubaa9</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">uce74ud14cuace0ub9ac</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ub0a0uc9dc</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">uad00ub9ac</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {stories.map((story) => (
                  <tr key={story.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <img className="h-10 w-10 rounded-md object-cover" src={story.thumbnail} alt="" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{story.title}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                        {story.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {story.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <Link
                          to={`/stories/${story.id}`}
                          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                          title="ubcf4uae30"
                        >
                          <FaEye />
                        </Link>
                        <Link
                          to={`/admin/stories/edit/${story.id}`}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                          title="uc218uc815"
                        >
                          <FaEdit />
                        </Link>
                        {deleteConfirm === story.id ? (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleDelete(story.id)}
                              className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                            >
                              ud655uc778
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300"
                            >
                              ucde8uc18c
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(story.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                            title="uc0aduc81c"
                          >
                            <FaTrash />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
