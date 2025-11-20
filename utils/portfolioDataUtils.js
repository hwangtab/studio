// 포트폴리오 데이터 정규화 및 필터링 유틸리티

const withPublicPath = (value = '') => {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith('/') ? value : `/${value.replace(/^\/+/, '')}`;
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const normalizePortfolioItems = (items = []) =>
  ensureArray(items).map((item) => ({
    ...item,
    image: withPublicPath(item.image),
  }));

const normalizeAudioTracks = (tracks = []) =>
  ensureArray(tracks).map((track) => ({
    ...track,
    src: withPublicPath(track.src),
    albumArt: withPublicPath(track.albumArt),
  }));

const normalizeCategories = (categories = []) => {
  const normalized = ensureArray(categories).map((category) => ({
    ...category,
    color: category.color || '#6d28d9',
  }));

  if (!normalized.some((category) => category.id === 'all')) {
    normalized.unshift({
      id: 'all',
      name: '전체',
      description: '모든 프로젝트',
      color: '#6d28d9',
    });
  }

  return normalized;
};

const filterPortfolioItems = (items, categoryId = 'all') => {
  if (!Array.isArray(items)) return [];
  if (categoryId === 'all' || !categoryId) {
    return items;
  }
  return items.filter((item) => item.category === categoryId);
};

const searchPortfolioItems = (items, query = '') => {
  if (!Array.isArray(items) || !query) return [];
  const lowerQuery = query.toLowerCase();
  return items.filter((item) => {
    const searchable = [
      item.title,
      item.description,
      item.artist,
      ...(item.services || []),
    ]
      .filter(Boolean)
      .map((value) => value.toLowerCase());

    return searchable.some((value) => value.includes(lowerQuery));
  });
};

const getPortfolioStats = (items = [], tracks = [], categories = []) => {
  const categoryStats = {};
  items.forEach((item) => {
    categoryStats[item.category] = (categoryStats[item.category] || 0) + 1;
  });

  const serviceStats = {};
  items.forEach((item) => {
    if (Array.isArray(item.services)) {
      item.services.forEach((service) => {
        serviceStats[service] = (serviceStats[service] || 0) + 1;
      });
    }
  });

  return {
    totalItems: items.length,
    totalTracks: tracks.length,
    totalCategories: Math.max(categories.length - 1, 0),
    featuredItems: items.filter((item) => item.featured).length,
    categoryStats,
    serviceStats,
    lastUpdated: Date.now(),
  };
};

const hydratePortfolioData = (rawData = {}) => {
  const metadata =
    rawData.metadata || {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      description: '스튜디오 놀 포트폴리오 데이터',
    };

  const portfolioItems = normalizePortfolioItems(rawData.portfolioItems);
  const audioTracks = normalizeAudioTracks(rawData.audioTracks);
  const categories = normalizeCategories(rawData.categories);

  return {
    metadata,
    portfolioItems,
    audioTracks,
    categories,
  };
};

export {
  hydratePortfolioData,
  filterPortfolioItems,
  searchPortfolioItems,
  getPortfolioStats,
  withPublicPath,
  normalizePortfolioItems,
  normalizeAudioTracks,
  normalizeCategories,
};
