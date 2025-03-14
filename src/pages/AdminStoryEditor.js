import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, addDoc, collection, Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { FaSave, FaArrowLeft, FaImage, FaPlus, FaTrash } from 'react-icons/fa';

const AdminStoryEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = id !== 'new';
  
  // uc2a4ud1a0ub9ac uc0c1ud0dc
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('uc791uc5c5uae30');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [images, setImages] = useState([{ url: '', caption: '' }]);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // uc778uc99d uc0c1ud0dc ud655uc778
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        navigate('/admin/login');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // ud3b8uc9d1 ubaa8ub4dc uc2dc uc2a4ud1a0ub9ac ub370uc774ud130 uac00uc838uc624uae30
  useEffect(() => {
    if (isEditMode) {
      const fetchStory = async () => {
        setLoading(true);
        try {
          // uc2e4uc81c Firebase uc5f0uacb0 uc2dc uc0acuc6a9
          // const storyDoc = await getDoc(doc(db, 'stories', id));
          // if (storyDoc.exists()) {
          //   const storyData = storyDoc.data();
          //   setTitle(storyData.title || '');
          //   setCategory(storyData.category || 'uc791uc5c5uae30');
          //   setSummary(storyData.summary || '');
          //   setContent(storyData.content || '');
          //   setThumbnail(storyData.thumbnail || '');
          //   setCoverImage(storyData.coverImage || '');
          //   setTags(storyData.tags || []);
          //   setImages(storyData.images || [{ url: '', caption: '' }]);
          // }
          
          // ud14cuc2a4ud2b8uc6a9 uc0d8ud50c ub370uc774ud130
          if (id === 'story-1') {
            setTitle('uc790uc774 <Golden Hour> uc568ubc94 uc81cuc791uae30');
            setCategory('uc791uc5c5uae30');
            setSummary('uc790uc774uc758 uc2e0ubcf4 Golden Hour uc81cuc791 uacfcuc815uc744 uc18cuac1cud569ub2c8ub2e4. ub179uc74cubd80ud130 ubbf9uc2f1, ub9c8uc2a4ud130ub9c1uae4cuc9c0uc758 uc804 uacfcuc815uc744 ub2f4uc558uc2b5ub2c8ub2e4.');
            setContent('# uc790uc774 <Golden Hour> uc568ubc94 uc81cuc791uae30\n\n## uc18cuac1c\n\nuc790uc774uc758 uc2e0ubcf4 <Golden Hour>ub294 uc544ud2f0uc2a4ud2b8uc758 uc131uc7a5uacfc uc0c8ub85cuace0ub2e4uc6b4 uc2dcub3c4ub97c ubcf4uc5ec uc8fcub294 uc568ubc94uc785ub2c8ub2e4. uc774ubc88 ud3ecuc2a4ud2b8uc5d0uc11cub294 uc774 uc568ubc94uc758 uc81cuc791 uacfcuc815uc744 uc18cuac1cud558uace0uc790 ud569ub2c8ub2e4.\n\n## uc81cuc791 ubc30uacbd\n\n<Golden Hour>ub294 uc790uc774uac00 uadf8ub3d9uc548 uc791uc5c5ud574uc628 ub178ub798ub4e4 uc911 uac00uc7a5 uc644uc131ub3c4 ub192uc740 uace1ub4e4uc744 uc120ubcc4ud558uc5ec uc644uc131ud55c uc568ubc94uc785ub2c8ub2e4.');
            setThumbnail('https://image.bugsm.co.kr/album/images/1000/373556/37355636.jpg');
            setCoverImage('https://image.bugsm.co.kr/album/images/1000/373556/37355636.jpg');
            setTags(['uc568ubc94 uc81cuc791', 'ub179uc74c', 'ubbf9uc2f1']);
            setImages([
              { url: 'https://i.ibb.co/TLMnbkF/jai-golden-hour.jpg', caption: 'ub179uc74c uc138uc158 uc911' },
              { url: 'https://image.bugsm.co.kr/album/images/1000/373556/37355636.jpg', caption: 'ubbf9uc2f1 uc791uc5c5' }
            ]);
          }
        } catch (error) {
          console.error('Error fetching story:', error);
          setError('uc2a4ud1a0ub9ac ub370uc774ud130ub97c uac00uc838uc624ub294 uc911 uc624ub958uac00 ubc1cuc0ddud588uc2b5ub2c8ub2e4.');
        } finally {
          setLoading(false);
        }
      };

      fetchStory();
    }
  }, [id, isEditMode, navigate]);

  // ud0dc uadf8 ucd94uac00 ucc98ub9ac
  const handleAddTag = (e) => {
    e.preventDefault();
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  // ud0dc uadf8 uc0aduc81c ucc98ub9ac
  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  // uc774ubbf8uc9c0 ucd94uac00 ucc98ub9ac
  const handleAddImage = () => {
    setImages([...images, { url: '', caption: '' }]);
  };

  // uc774ubbf8uc9c0 uc0aduc81c ucc98ub9ac
  const handleRemoveImage = (index) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages.length > 0 ? newImages : [{ url: '', caption: '' }]);
  };

  // uc774ubbf8uc9c0 uc815ubcf4 ubcc0uacbd ucc98ub9ac
  const handleImageChange = (index, field, value) => {
    const newImages = [...images];
    newImages[index][field] = value;
    setImages(newImages);
  };

  // uc2a4ud1a0ub9ac uc800uc7a5 ucc98ub9ac
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);

    // uc720ud6a8uc131 uac80uc0ac
    if (!title.trim()) {
      setError('uc81cubaa9uc744 uc785ub825ud574uc8fc uc138uc694.');
      setSaving(false);
      return;
    }

    if (!summary.trim()) {
      setError('uc694uc57duc744 uc785ub825ud574uc8fc uc138uc694.');
      setSaving(false);
      return;
    }

    if (!content.trim()) {
      setError('ubcf8ubb38uc744 uc785ub825ud574uc8fc uc138uc694.');
      setSaving(false);
      return;
    }

    if (!thumbnail.trim()) {
      setError('uc378ub124uc77c uc774ubbf8uc9c0 URLuc744 uc785ub825ud574uc8fc uc138uc694.');
      setSaving(false);
      return;
    }

    if (!coverImage.trim()) {
      setError('ucee4ubc84 uc774ubbf8uc9c0 URLuc744 uc785ub825ud574uc8fc uc138uc694.');
      setSaving(false);
      return;
    }

    // uc720ud6a8ud55c uc774ubbf8uc9c0 URLub9cc uc720uc9c0
    const validImages = images.filter(img => img.url.trim() !== '');

    try {
      const storyData = {
        title,
        category,
        summary,
        content,
        thumbnail,
        coverImage,
        tags,
        images: validImages,
        author: 'uc2a4ud29cub514uc624 uc6b4uc601uc790',
        date: new Date().toISOString().split('T')[0], // YYYY-MM-DD ud615uc2dd
        updatedAt: Timestamp.now()
      };

      // uc2e4uc81c Firebase uc5f0uacb0 uc2dc uc0acuc6a9
      // if (isEditMode) {
      //   await setDoc(doc(db, 'stories', id), storyData, { merge: true });
      // } else {
      //   await addDoc(collection(db, 'stories'), storyData);
      // }

      // ud14cuc2a4ud2b8uc6a9 uc800uc7a5 ub85cuc9c1
      console.log('Story saved:', storyData);
      
      setSuccess(true);
      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 1500);
    } catch (error) {
      console.error('Error saving story:', error);
      setError('uc2a4ud1a0ub9ac uc800uc7a5 uc911 uc624ub958uac00 ubc1cuc0ddud588uc2b5ub2c8ub2e4.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex justify-center items-center">
        <p className="text-gray-600 dark:text-gray-300">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEditMode ? 'uc2a4ud1a0ub9ac uc218uc815' : 'uc0c8 uc2a4ud1a0ub9ac uc791uc131'}
          </h1>
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="flex items-center text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary transition-colors duration-300"
          >
            <FaArrowLeft className="mr-2" />
            ub300uc2dcubcf4ub4dcub85c ub3cc uc544uac00uae30
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 md:p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg">
              uc2a4ud1a0ub9acuac00 uc131uacf5uc801uc73cub85c uc800uc7a5ub418uc5c8uc2b5ub2c8ub2e4. ub300uc2dcubcf4ub4dcub85c uc774ub3d9ud569ub2c8ub2e4...
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label htmlFor="title" className="block text-gray-700 dark:text-gray-300 mb-2">uc81cubaa9 *</label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="category" className="block text-gray-700 dark:text-gray-300 mb-2">uce74ud14cuace0ub9ac *</label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="uc791uc5c5uae30">uc791uc5c5uae30</option>
                  <option value="uc778ud130ubdf0">uc778ud130ubdf0</option>
                  <option value="ud301&uac00uc774ub4dc">ud301&uac00uc774ub4dc</option>
                </select>
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="summary" className="block text-gray-700 dark:text-gray-300 mb-2">uc694uc57d *</label>
              <textarea
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                rows="2"
                required
              ></textarea>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label htmlFor="thumbnail" className="block text-gray-700 dark:text-gray-300 mb-2">uc378ub124uc77c uc774ubbf8uc9c0 URL *</label>
                <input
                  type="text"
                  id="thumbnail"
                  value={thumbnail}
                  onChange={(e) => setThumbnail(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
                {thumbnail && (
                  <div className="mt-2 relative w-full h-40">
                    <img src={thumbnail} alt="Thumbnail preview" className="w-full h-full object-cover rounded-lg" />
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="coverImage" className="block text-gray-700 dark:text-gray-300 mb-2">ucee4ubc84 uc774ubbf8uc9c0 URL *</label>
                <input
                  type="text"
                  id="coverImage"
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  placeholder="https://example.com/cover.jpg"
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
                {coverImage && (
                  <div className="mt-2 relative w-full h-40">
                    <img src={coverImage} alt="Cover preview" className="w-full h-full object-cover rounded-lg" />
                  </div>
                )}
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="content" className="block text-gray-700 dark:text-gray-300 mb-2">ubcf8ubb38 (Markdown) *</label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono"
                rows="12"
                required
              ></textarea>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Markdown ud615uc2dduc744 uc9c0uc6d0ud569ub2c8ub2e4. (# uc81cubaa9, ## uc911uc81cubaa9, **uad75uc740 uae00uc528**, *uae30uc6b8uc784 uae00uc528*, [ub9c1ud06c](URL) ub4f1)
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 dark:text-gray-300 mb-2">ud0dc uadf8</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag, index) => (
                  <div key={index} className="flex items-center bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                    <span className="text-gray-800 dark:text-gray-200 text-sm mr-2">{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
                    >
                      <FaTrash size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="ud0dc uadf8 uc785ub825 ud6c4 Enter"
                  className="flex-grow px-4 py-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag(e)}
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="bg-primary text-white px-4 py-2 rounded-r-lg hover:bg-primary-dark transition-colors duration-300"
                >
                  <FaPlus />
                </button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 dark:text-gray-300 mb-2">ucd94uac00 uc774ubbf8uc9c0</label>
              {images.map((image, index) => (
                <div key={index} className="flex flex-col md:flex-row gap-4 mb-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex-grow">
                    <label className="block text-gray-600 dark:text-gray-400 text-sm mb-1">uc774ubbf8uc9c0 URL</label>
                    <input
                      type="text"
                      value={image.url}
                      onChange={(e) => handleImageChange(index, 'url', e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                  <div className="flex-grow">
                    <label className="block text-gray-600 dark:text-gray-400 text-sm mb-1">uc774ubbf8uc9c0 uc124uba85</label>
                    <input
                      type="text"
                      value={image.caption}
                      onChange={(e) => handleImageChange(index, 'caption', e.target.value)}
                      placeholder="uc774ubbf8uc9c0 uc124uba85"
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800 transition-colors duration-300"
                    >
                      <FaTrash />
                    </button>
                  </div>
                  {image.url && (
                    <div className="w-full md:w-24 h-24 flex-shrink-0">
                      <img src={image.url} alt={image.caption || `Image ${index + 1}`} className="w-full h-full object-cover rounded-lg" />
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddImage}
                className="flex items-center text-primary hover:text-primary-dark transition-colors duration-300"
              >
                <FaPlus className="mr-2" />
                uc774ubbf8uc9c0 ucd94uac00
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-primary text-white px-6 py-2 rounded-lg flex items-center hover:bg-primary-dark transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaSave className="mr-2" />
                {saving ? 'uc800uc7a5 uc911...' : 'uc800uc7a5ud558uae30'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminStoryEditor;
