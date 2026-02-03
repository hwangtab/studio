import { motion } from 'framer-motion';
import React from 'react';

export interface EquipmentSectionProps {
    title: string;
    items: string[] | readonly string[];
    icon: React.ElementType;
}

const EquipmentSection = ({ title, items, icon: Icon }: EquipmentSectionProps) => (
    <motion.div
        className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg mb-6 hover:shadow-xl transition-shadow duration-300 border border-gray-100 dark:border-gray-700"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        whileHover={{ y: -5 }}
    >
        <h3 className="typo-card-title mb-4 flex items-center">
            <Icon className="mr-2 text-primary dark:text-primary-light" size={20} />
            {title}
        </h3>
        <ul className="grid gap-2">
            {items.map((item, index) => (
                <li key={index} className="flex items-center typo-card-body">
                    <span className="w-2 h-2 bg-primary dark:bg-primary-light rounded-full mr-2"></span>
                    {item}
                </li>
            ))}
        </ul>
    </motion.div>
);

export default EquipmentSection;
