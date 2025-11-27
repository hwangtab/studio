// 포트폴리오 데이터 정규화 및 필터링 유틸리티

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

export {
  filterPortfolioItems,
  searchPortfolioItems,
  getPortfolioStats,
};
