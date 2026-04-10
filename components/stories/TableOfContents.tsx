import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Locale } from '../../lib/i18n';

interface TOCItem {
  level: 2 | 3;
  text: string;
  id: string;
}

interface TableOfContentsProps {
  content: string; // raw markdown
  locale: Locale;
}

// Mirrors MarkdownRenderer.tsx's toHeadingId for plain strings
const toHeadingId = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'section';
};

const TableOfContents = ({ content, locale }: TableOfContentsProps) => {
  const { t } = useTranslation('common', { lng: locale });

  const items: TOCItem[] = [];
  for (const line of content.split('\n')) {
    const h2 = line.match(/^##\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);
    if (h2) {
      const text = h2[1].trim();
      items.push({ level: 2, text, id: toHeadingId(text) });
    } else if (h3) {
      const text = h3[1].trim();
      items.push({ level: 3, text, id: toHeadingId(text) });
    }
  }

  if (items.length < 3) return null;

  return (
    <nav aria-label={t('stories.detail.toc.title')} className="text-sm">
      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 text-sm">
        {t('stories.detail.toc.title')}
      </h4>
      <ul className="space-y-1.5 border-l-2 border-gray-200 dark:border-gray-700">
        {items.map((item) => (
          <li key={`${item.id}-${item.level}`} className={item.level === 3 ? 'pl-6' : 'pl-3'}>
            <a
              href={`#${item.id}`}
              className="block py-0.5 text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors leading-snug"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default TableOfContents;
