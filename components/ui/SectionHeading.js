import { motion } from 'framer-motion';

const SectionHeading = ({ icon: Icon, title, subtitle, align = 'center' }) => {
  const alignmentClasses = {
    center: 'text-center',
    left: 'text-left',
  };

  return (
    <motion.div
      className={`${alignmentClasses[align] ?? alignmentClasses.center} mb-12`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      {Icon && (
        <div className={`inline-flex items-center justify-center p-3 bg-primary/10 dark:bg-primary/20 rounded-full mb-4`}>
          <Icon className="text-2xl text-primary dark:text-primary-light" />
        </div>
      )}
      <h2 className="typo-section-title text-gray-800 dark:text-white mb-3">{title}</h2>
      {subtitle && <p className="typo-section-lead text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">{subtitle}</p>}
    </motion.div>
  );
};

export default SectionHeading;
