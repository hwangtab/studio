import { AnimatePresence as AnimatePresenceOrig } from 'framer-motion';
import React from 'react';

/**
 * framer-motion의 AnimatePresence 타입 호환성 문제를 해결하기 위한 래퍼 컴포넌트입니다.
 * PropsWithChildren을 사용하여 children 타입을 명시적으로 포함합니다.
 */
const AnimatePresence = AnimatePresenceOrig as unknown as React.FC<
    React.PropsWithChildren<import('framer-motion').AnimatePresenceProps>
>;

export default AnimatePresence;
export { motion } from 'framer-motion';
