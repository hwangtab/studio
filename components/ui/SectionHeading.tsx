import React from 'react';
import { motion } from 'framer-motion';

interface SectionHeadingProps {
  icon?: React.ElementType<{ className?: string }>;
  title: string;
  subtitle?: string;
  align?: 'center' | 'left';
}

const SectionHeading = ({ icon: Icon, title, subtitle, align = 'center' }: SectionHeadingProps) => {
  const alignmentClasses = {
    center: 'text-center',
    left: 'text-left',
  };

  return (
    <motion.div
      className={`${alignmentClasses[align] ?? alignmentClasses.center} mb-12 will-change-transform [transform:translateZ(0)] [-webkit-transform:translateZ(0)]`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      {Icon && (
        <div className={`inline-flex items-center justify-center p-3 bg-primary/10 dark:bg-primary/20 rounded-full mb-4`}>
          {React.createElement(Icon, { className: "text-2xl text-primary dark:text-primary-light" })}
        </div>
      )}
      <h2 className="typo-section-title text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent mb-3">{title}</h2>
      {subtitle && <p className="typo-section-lead text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">{subtitle}</p>}
    </motion.div>
  );
};

export default SectionHeading;
