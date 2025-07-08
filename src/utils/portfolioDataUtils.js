// 포트폴리오 데이터 관리 유틸리티

// 포트폴리오 데이터 가져오기
const getPortfolioData = async () => {
  try {
    const response = await fetch('/data/portfolio.json');
    if (!response.ok) throw new Error('포트폴리오 데이터 불러오기 실패');
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('포트폴리오 데이터 로딩 오류:', error);
    // fallback 데이터 반환
    return {
      metadata: {
        version: "1.0",
        lastUpdated: new Date().toISOString(),
        description: "포트폴리오 데이터 로딩 실패 - fallback 데이터"
      },
      categories: [],
      portfolioItems: [],
      audioTracks: []
    };
  }
};

// 모든 포트폴리오 항목 가져오기
const getAllPortfolioItems = async () => {
  try {
    const data = await getPortfolioData();
    // 배열 순서 그대로 유지 (별도 정렬 없음)
    return data.portfolioItems.map(item => ({
      ...item,
      image: item.image.startsWith('/') ? `${process.env.PUBLIC_URL}${item.image}` : item.image
    }));
  } catch (error) {
    console.error('포트폴리오 항목 로딩 오류:', error);
    return [];
  }
};

// 카테고리별 포트폴리오 항목 가져오기
const getPortfolioItemsByCategory = async (categoryId) => {
  try {
    const items = await getAllPortfolioItems();
    if (categoryId === 'all' || !categoryId) {
      return items;
    }
    return items.filter(item => item.category === categoryId);
  } catch (error) {
    console.error('카테고리별 포트폴리오 항목 로딩 오류:', error);
    return [];
  }
};

// 추천 포트폴리오 항목 가져오기
const getFeaturedPortfolioItems = async () => {
  try {
    const items = await getAllPortfolioItems();
    return items.filter(item => item.featured);
  } catch (error) {
    console.error('추천 포트폴리오 항목 로딩 오류:', error);
    return [];
  }
};

// 특정 포트폴리오 항목 가져오기
const getPortfolioItemById = async (id) => {
  try {
    const items = await getAllPortfolioItems();
    const item = items.find(item => item.id === id);
    if (!item) return null;
    
    return {
      ...item,
      image: item.image.startsWith('/') ? `${process.env.PUBLIC_URL}${item.image}` : item.image
    };
  } catch (error) {
    console.error('특정 포트폴리오 항목 로딩 오류:', error);
    return null;
  }
};

// 모든 카테고리 가져오기
const getAllCategories = async () => {
  try {
    const data = await getPortfolioData();
    return data.categories;
  } catch (error) {
    console.error('카테고리 로딩 오류:', error);
    return [
      {
        id: "all",
        name: "전체",
        description: "모든 프로젝트",
        color: "#6d28d9"
      }
    ];
  }
};

// 모든 오디오 트랙 가져오기
const getAllAudioTracks = async () => {
  try {
    const data = await getPortfolioData();
    // 배열 순서 그대로 유지 (별도 정렬 없음)
    return data.audioTracks.map(track => ({
      ...track,
      src: track.src.startsWith('/') ? `${process.env.PUBLIC_URL}${track.src}` : track.src,
      albumArt: track.albumArt.startsWith('/') ? `${process.env.PUBLIC_URL}${track.albumArt}` : track.albumArt
    }));
  } catch (error) {
    console.error('오디오 트랙 로딩 오류:', error);
    return [];
  }
};

// 추천 오디오 트랙 가져오기
const getFeaturedAudioTracks = async () => {
  try {
    const tracks = await getAllAudioTracks();
    return tracks.filter(track => track.featured);
  } catch (error) {
    console.error('추천 오디오 트랙 로딩 오류:', error);
    return [];
  }
};

// 서비스별 포트폴리오 항목 가져오기
const getPortfolioItemsByService = async (service) => {
  try {
    const items = await getAllPortfolioItems();
    return items.filter(item => 
      item.services && item.services.includes(service)
    );
  } catch (error) {
    console.error('서비스별 포트폴리오 항목 로딩 오류:', error);
    return [];
  }
};

// 아티스트별 포트폴리오 항목 가져오기
const getPortfolioItemsByArtist = async (artist) => {
  try {
    const items = await getAllPortfolioItems();
    return items.filter(item => 
      item.artist && item.artist.toLowerCase().includes(artist.toLowerCase())
    );
  } catch (error) {
    console.error('아티스트별 포트폴리오 항목 로딩 오류:', error);
    return [];
  }
};

// 검색 기능
const searchPortfolioItems = async (query) => {
  try {
    const items = await getAllPortfolioItems();
    const lowercaseQuery = query.toLowerCase();
    
    return items.filter(item => 
      item.title.toLowerCase().includes(lowercaseQuery) ||
      item.description.toLowerCase().includes(lowercaseQuery) ||
      (item.artist && item.artist.toLowerCase().includes(lowercaseQuery)) ||
      (item.services && item.services.some(service => 
        service.toLowerCase().includes(lowercaseQuery)
      ))
    );
  } catch (error) {
    console.error('포트폴리오 검색 오류:', error);
    return [];
  }
};

// 배열 순서 변경 (필요시 사용)
const reorderPortfolioItems = (items, fromIndex, toIndex) => {
  const result = [...items];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
};

// 메타데이터 가져오기
const getPortfolioMetadata = async () => {
  try {
    const data = await getPortfolioData();
    return data.metadata;
  } catch (error) {
    console.error('메타데이터 로딩 오류:', error);
    return {
      version: "1.0",
      lastUpdated: new Date().toISOString(),
      description: "스튜디오 놀 포트폴리오 데이터"
    };
  }
};

// 통계 정보 가져오기
const getPortfolioStats = async () => {
  try {
    const items = await getAllPortfolioItems();
    const tracks = await getAllAudioTracks();
    const categories = await getAllCategories();
    
    const categoryStats = {};
    items.forEach(item => {
      categoryStats[item.category] = (categoryStats[item.category] || 0) + 1;
    });
    
    const serviceStats = {};
    items.forEach(item => {
      if (item.services) {
        item.services.forEach(service => {
          serviceStats[service] = (serviceStats[service] || 0) + 1;
        });
      }
    });
    
    return {
      totalItems: items.length,
      totalTracks: tracks.length,
      totalCategories: categories.length - 1, // 'all' 카테고리 제외
      featuredItems: items.filter(item => item.featured).length,
      categoryStats,
      serviceStats,
      lastUpdated: new Date().getTime() // date 필드 제거로 현재 시간 사용
    };
  } catch (error) {
    console.error('포트폴리오 통계 로딩 오류:', error);
    return {
      totalItems: 0,
      totalTracks: 0,
      totalCategories: 0,
      featuredItems: 0,
      categoryStats: {},
      serviceStats: {},
      lastUpdated: new Date().getTime()
    };
  }
};

export {
  getPortfolioData,
  getAllPortfolioItems,
  getPortfolioItemsByCategory,
  getFeaturedPortfolioItems,
  getPortfolioItemById,
  getAllCategories,
  getAllAudioTracks,
  getFeaturedAudioTracks,
  getPortfolioItemsByService,
  getPortfolioItemsByArtist,
  searchPortfolioItems,
  reorderPortfolioItems,
  getPortfolioMetadata,
  getPortfolioStats
};