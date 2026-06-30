import React from 'react';

const extractTextContent = (children: React.ReactNode): string => {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(extractTextContent).join('');
  if (React.isValidElement(children)) {
    const { children: subChildren } = children.props as { children?: React.ReactNode };
    return extractTextContent(subChildren);
  }
  return '';
};

export const toHeadingId = (children: React.ReactNode): string => {
  const text = extractTextContent(children);
  return text
    .toLowerCase()
    .replace(/[\s]+/g, '-')
    .replace(/[^\w\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'section';
};
