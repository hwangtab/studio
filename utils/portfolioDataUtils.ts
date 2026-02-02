import type { PortfolioItem } from '../types/data';

interface PortfolioStats {
  totalItems: number;
  totalTracks: number;
  totalCategories: number;
  featuredItems: number;
  categoryStats: Record<string, number>;
  serviceStats: Record<string, number>;
  lastUpdated: number;
}

const filterPortfolioItems = (items: readonly PortfolioItem[], categoryId: string = 'all'): PortfolioItem[] => {
  if (!Array.isArray(items)) return [];
  if (categoryId === 'all' || !categoryId) {
    return [...items];
  }
  return items.filter((item) => item.category === categoryId);
};

const searchPortfolioItems = (items: readonly PortfolioItem[], query: string = ''): PortfolioItem[] => {
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
      .map((value) => String(value).toLowerCase());

    return searchable.some((value) => value.includes(lowerQuery));
  });
};

const getPortfolioStats = (items: readonly PortfolioItem[] = [], tracks: ReadonlyArray<unknown> = [], categories: ReadonlyArray<unknown> = []): PortfolioStats => {
  const categoryStats: Record<string, number> = {};
  items.forEach((item) => {
    categoryStats[item.category] = (categoryStats[item.category] || 0) + 1;
  });

  const serviceStats: Record<string, number> = {};
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
  type PortfolioItem,
  type PortfolioStats,
};
