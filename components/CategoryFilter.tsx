import React from 'react';
import { motion } from 'framer-motion';

interface CategoryBase {
  id: string;
  label: string;
  color?: string;
}

interface CategoryObject {
  id: string;
  name: string;
  color?: string;
}

type CategoryInput = string | CategoryObject | CategoryBase;

interface CategoryFilterProps {
  activeCategory: string;
  setActiveCategory: (category: string) => void;
  categories: readonly CategoryInput[];
  showTitle?: boolean;
  titleIcon?: React.ElementType<{ className?: string }> | null;
  titleText?: string;
  buttonSize?: 'sm' | 'md' | 'lg';
  useCustomColors?: boolean;
  gap?: string;
}

const CategoryFilter = ({
  activeCategory,
  setActiveCategory,
  categories: propCategories,
  showTitle = false,
  titleIcon: TitleIcon = null,
  titleText = "카테고리",
  buttonSize = "md",
  useCustomColors = false,
  gap = "gap-2"
}: CategoryFilterProps) => {
  const categories: CategoryBase[] = propCategories.map(category => {
    if (typeof category === 'object' && 'name' in category) {
      return {
        id: category.id,
        label: category.name,
        color: category.color
      };
    }
    if (typeof category === 'string') {
      return {
        id: category,
        label: category
      };
    }
    return category;
  });

  if (!categories.find(cat => cat.id === 'all')) {
    categories.unshift({ id: 'all', label: '전체' });
  }

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-body-2',
    md: 'px-4 py-2 text-body-1',
    lg: 'px-6 py-2 text-body-1'
  };

  return (
    <div className="mb-8">
      {showTitle && (
        <div className="flex items-center mb-6">
          {TitleIcon && React.createElement(TitleIcon, { className: "text-xl text-primary mr-3" })}
          <h3 className="typo-card-title text-gray-600 dark:text-gray-200">{titleText}</h3>
        </div>
      )}

      <div className="relative">
        <div className={`flex ${gap} overflow-x-auto md:flex-wrap md:overflow-x-visible scrollbar-hide pb-2 scroll-smooth`}>
          {categories.map((category) => {
            const isActive = activeCategory === category.id;
            const customStyle = useCustomColors && isActive && category.color
              ? { backgroundColor: category.color }
              : {};

            return (
              <motion.button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`${sizeClasses[buttonSize]} rounded-full transition-all duration-300 min-w-fit whitespace-nowrap flex-shrink-0 ${isActive
                    ? useCustomColors && category.color
                      ? 'text-white shadow-lg transform scale-105'
                      : 'bg-primary text-white shadow-lg transform scale-105'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                style={customStyle}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {category.label}
              </motion.button>
            );
          })}
        </div>

        <div className="md:hidden absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-white dark:from-gray-900 to-transparent pointer-events-none"></div>
      </div>
    </div>
  );
};

export default CategoryFilter;
