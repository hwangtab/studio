import React, { useEffect, useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { defaultLocale, type Locale } from '../../lib/i18n';

interface ScrollToTopProps {
  locale?: Locale;
}

export const ScrollToTop = ({ locale = defaultLocale }: ScrollToTopProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <m.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          className="fixed bottom-6 right-6 z-40"
        >
          <Button
            variant="primary"
            size="icon"
            onClick={scrollToTop}
            className="shadow-deep"
            aria-label={t('actions.scrollToTop')}
          >
            <ArrowUp size={20} />
          </Button>
        </m.div>
      )}
    </AnimatePresence>
  );
};
