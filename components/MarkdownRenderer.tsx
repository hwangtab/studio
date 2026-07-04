import React from 'react';
import Markdown from 'markdown-to-jsx';
import NextLink from 'next/link';
import dynamic from 'next/dynamic';
import { locales, type Locale } from '../lib/i18n';
import OnlineFallback from './story/OnlineFallback';
import SessionChecklist from './story/SessionChecklist';
import { isInlineDirectiveName, MAX_AUTHOR_BOXES } from '../lib/inlineDirectives';
import { isAllowedLinkHref } from './markdown/safeLinks';
import { autoLinkKeywords } from './markdown/autoLinks';
import { splitContentByShortcodes, type ContentSegment } from './markdown/contentSegments';
import { toHeadingId } from './markdown/headings';
import { MarkdownImage } from './markdown/MarkdownImage';

const InlinePriceCallout = dynamic(() => import('./inline/InlinePriceCallout'));
const InlineReviewCallout = dynamic(() => import('./inline/InlineReviewCallout'));
const InlineBookingCallout = dynamic(() => import('./inline/InlineBookingCallout'));
const InlineServiceCallout = dynamic(() => import('./inline/InlineServiceCallout'));

let prismLoaderPromise: Promise<typeof import('prismjs')> | null = null;
const PRISM_THEME_STYLESHEET_ID = 'prism-theme-stylesheet';

const loadPrism = async () => {
  if (typeof window === 'undefined') {
    return null;
  }
  if (!prismLoaderPromise) {
    prismLoaderPromise = (async () => {
      const prismModule = await import('prismjs');
      await Promise.all([
        import('prismjs/components/prism-javascript'),
        import('prismjs/components/prism-typescript'),
        import('prismjs/components/prism-jsx'),
        import('prismjs/components/prism-css'),
        import('prismjs/components/prism-bash'),
      ]);
      return prismModule.default || prismModule;
    })();
  }
  return prismLoaderPromise;
};

interface CodeBlockProps {
  children: React.ReactNode;
  className?: string;
}

const CodeBlock = ({ children, className }: CodeBlockProps) => {
  const language = className?.replace('lang-', '') || 'text';
  const codeRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    let isMounted = true;
    loadPrism()
      .then((PrismLib) => {
        if (PrismLib && isMounted && codeRef.current) {
          PrismLib.highlightElement(codeRef.current);
        }
      })
      .catch(() => { });

    return () => {
      isMounted = false;
    };
  }, [children, className]);

  return (
    <pre className={`rounded-lg overflow-hidden my-4 language-${language}`}>
      <code ref={codeRef} className={`language-${language}`}>
        {children}
      </code>
    </pre>
  );
};

const mergeClassNames = (base: string, extra?: string) => (extra ? `${base} ${extra}` : base);

// Block dangerous HTML tags to prevent XSS from markdown content
const DangerousTagBlock = () => null;

// Static overrides extracted outside to prevent re-creation
const STATIC_OVERRIDES = {
  script: { component: DangerousTagBlock },
  iframe: { component: DangerousTagBlock },
  object: { component: DangerousTagBlock },
  embed: { component: DangerousTagBlock },
  form: { component: DangerousTagBlock },
  input: { component: DangerousTagBlock },
  style: { component: DangerousTagBlock },
  h1: {
    component: ({ children, className, ...rest }: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) => (
      <h2
        id={toHeadingId(children)}
        {...rest}
        className={mergeClassNames(
          'scroll-mt-24 font-title text-3xl md:text-4xl font-bold leading-tight mt-12 mb-6',
          className
        )}
      >
        {children}
      </h2>
    ),
  },
  h2: {
    component: ({ children, className, ...rest }: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) => (
      <h2
        id={toHeadingId(children)}
        {...rest}
        className={mergeClassNames(
          'scroll-mt-24 font-title text-2xl md:text-3xl font-semibold leading-snug mt-10 mb-5 text-gray-900 dark:text-white',
          className
        )}
      >
        {children}
      </h2>
    ),
  },
  h3: {
    component: ({ children, className, ...rest }: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) => (
      <h3
        id={toHeadingId(children)}
        {...rest}
        className={mergeClassNames(
          'scroll-mt-24 text-xl md:text-2xl font-semibold leading-relaxed mt-8 mb-4 text-gray-900 dark:text-white',
          className
        )}
      >
        {children}
      </h3>
    ),
  },
  h4: {
    component: ({ children, className, ...rest }: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) => (
      <h4
        id={toHeadingId(children)}
        {...rest}
        className={mergeClassNames(
          'scroll-mt-24 text-xl font-medium mt-6 mb-3 text-gray-900 dark:text-white',
          className
        )}
      >
        {children}
      </h4>
    ),
  },
  p: {
    component: ({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLElement>) => (
      <p
        className="text-body-1 leading-relaxed mb-6 mt-4 text-gray-800 dark:text-gray-200"
        {...props}
      >
        {children}
      </p>
    ),
  },
  strong: {
    component: ({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLElement>) => (
      <strong className="font-bold text-primary-dark dark:text-primary-light" {...props}>
        {children}
      </strong>
    ),
  },
  em: {
    component: ({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLElement>) => (
      <em className="italic" {...props}>
        {children}
      </em>
    ),
  },
  ul: {
    component: ({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLElement>) => (
      <ul
        style={{
          listStyleType: 'disc',
          paddingLeft: '2rem',
          marginBottom: '1.5rem',
          marginTop: '1rem'
        }}
        {...props}
      >
        {children}
      </ul>
    ),
  },
  ol: {
    component: ({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLElement>) => (
      <ol
        style={{
          listStyleType: 'decimal',
          paddingLeft: '2rem',
          marginBottom: '1.5rem',
          marginTop: '1rem'
        }}
        {...props}
      >
        {children}
      </ol>
    ),
  },
  li: {
    component: ({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLElement>) => (
      <li
        className="text-body-1 leading-relaxed mb-4 pl-2 list-item text-gray-800 dark:text-gray-200"
        {...props}
      >
        {children}
      </li>
    ),
  },
  blockquote: {
    component: ({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLElement>) => (
      <blockquote className="border-l-4 border-primary-light dark:border-primary-dark pl-4 py-2 my-4 bg-gray-50 dark:bg-gray-800 italic" {...props}>
        {children}
      </blockquote>
    ),
  },
  img: {
    component: MarkdownImage,
  },
  hr: {
    component: ({ className, ...props }: { className?: string } & React.HTMLAttributes<HTMLHRElement>) => (
      <hr
        className={mergeClassNames('my-12 border-t border-gray-200 dark:border-gray-700', className)}
        {...props}
      />
    ),
  },
  code: {
    component: ({ children, className, ...props }: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) => {
      if (className) {
        return <CodeBlock className={className} {...props}>{children}</CodeBlock>;
      }
      return (
        <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-sm" {...props}>
          {children}
        </code>
      );
    },
  },
  table: {
    component: ({ children, ...props }: { children: React.ReactNode } & React.TableHTMLAttributes<HTMLTableElement>) => (
      <div className="overflow-x-auto my-6 rounded-lg border border-gray-300 dark:border-gray-600">
        <table {...props} className="w-full border-collapse text-sm">
          {children}
        </table>
      </div>
    ),
  },
  thead: {
    component: ({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLTableSectionElement>) => (
      <thead {...props} className="bg-gray-100 dark:bg-gray-800">
        {children}
      </thead>
    ),
  },
  tr: {
    component: ({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLTableRowElement>) => (
      <tr {...props} className="border-b border-gray-300 dark:border-gray-600 even:bg-gray-50 dark:even:bg-gray-800/50">
        {children}
      </tr>
    ),
  },
  th: {
    component: ({ children, ...props }: { children: React.ReactNode } & React.ThHTMLAttributes<HTMLTableCellElement>) => (
      <th {...props} className="px-4 py-2.5 text-left font-semibold text-gray-900 dark:text-gray-100 border-b-2 border-gray-300 dark:border-gray-600">
        {children}
      </th>
    ),
  },
  td: {
    component: ({ children, ...props }: { children: React.ReactNode } & React.TdHTMLAttributes<HTMLTableCellElement>) => (
      <td {...props} className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
        {children}
      </td>
    ),
  },
};

interface MarkdownRendererProps {
  content: string;
  locale?: Locale;
  /** 현재 스토리의 slug (자기 자신 링크 방지) */
  currentSlug?: string;
}

const MarkdownRenderer = ({ content, locale = 'ko', currentSlug }: MarkdownRendererProps) => {
  const currentLocale = locale;

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById(PRISM_THEME_STYLESHEET_ID)) return;

    const link = document.createElement('link');
    link.id = PRISM_THEME_STYLESHEET_ID;
    link.rel = 'stylesheet';
    link.href = '/styles/prism-theme.css';
    document.head.appendChild(link);
  }, []);

  // locale이 바뀔 때만 a 컴포넌트 override를 새로 만들고, static overrides와는 합치기만 한다.
  // 이전에는 STATIC_OVERRIDES 전체를 spread해 overrides 객체 자체가 매 locale 변경마다 통째로
  // 재생성됐다 — markdown-to-jsx options 식별이 깨지면서 자식 트리 재마운트로 이어졌다.
  const localeAwareOverrides = React.useMemo(() => ({
    a: {
      component: ({ children, href, ...props }: { children: React.ReactNode; href?: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
        if (!isAllowedLinkHref(href)) {
          return <span className="text-gray-500">{children}</span>;
        }

        // If it's an internal link starting with / and not already having a locale
        let finalHref = href;
        const isExternal = href?.startsWith('http://') || href?.startsWith('https://');
        if (!isExternal && href?.startsWith('/') && !href.startsWith('//')) {
          const pathSegments = href.split('/');
          if (!locales.includes(pathSegments[1] as Locale)) {
            finalHref = `/${currentLocale}${href === '/' ? '' : href}`;
          }
        }
        if (isExternal) {
          return (
            <a href={finalHref} className="text-primary hover:underline underline-offset-4" target="_blank" rel="noopener noreferrer nofollow" {...props}>
              {children}
            </a>
          );
        }
        return (
          <NextLink href={finalHref ?? '/'} className="text-primary hover:underline underline-offset-4" {...props}>
            {children}
          </NextLink>
        );
      },
    },
  }), [currentLocale]);

  const overrides = React.useMemo(
    () => ({ ...STATIC_OVERRIDES, ...localeAwareOverrides }),
    [localeAwareOverrides]
  );

  const processedContent = React.useMemo(() => autoLinkKeywords(content, currentSlug, currentLocale), [content, currentSlug, currentLocale]);
  const segments = React.useMemo(() => splitContentByShortcodes(processedContent), [processedContent]);

  const inlineBoxCountRef = React.useRef(0);

  const renderSegment = (segment: ContentSegment, index: number) => {
    if (segment.type === 'shortcode') {
      if (segment.name === 'online-fallback') return <OnlineFallback key={index} locale={currentLocale} />;
      if (segment.name === 'session-checklist') return <SessionChecklist key={index} locale={currentLocale} />;

      // 4종 inline directive — max 2 enforce (초과는 silent drop)
      if (isInlineDirectiveName(segment.name)) {
        // ko 외 locale에서는 inline directive를 silent skip — Phase 1 spec 9번 정책 (다국어 사용자에게
        // 한국어 박스 노출 방지). plain text로 떨어뜨리면 raw token이 보이므로 null 반환이 더 안전.
        if (currentLocale !== 'ko') return null;
        if (inlineBoxCountRef.current >= MAX_AUTHOR_BOXES) return null;
        inlineBoxCountRef.current += 1;
        const arg = segment.arg;
        switch (segment.name) {
          case 'price':
            return arg ? <InlinePriceCallout key={index} id={arg} locale={currentLocale} /> : null;
          case 'review':
            return arg ? <InlineReviewCallout key={index} id={arg} locale={currentLocale} /> : null;
          case 'booking':
            return <InlineBookingCallout key={index} message={arg} locale={currentLocale} />;
          case 'service':
            return arg ? <InlineServiceCallout key={index} type={arg} locale={currentLocale} /> : null;
        }
      }

      return null;
    }
    return (
      <Markdown
        key={index}
        options={{
          overrides,
          // markdown-to-jsx 기본 slugify는 한글을 버리고(예: "808 베이스 —" → "808----")
          // 하이픈도 정리하지 않아 헤딩 id가 깨지고 서로 충돌한다. TOC·딥링크가 참조하는
          // toHeadingId와 동일 규칙으로 맞춰 앵커가 실제 헤딩과 일치하게 한다.
          slugify: toHeadingId,
          disableParsingRawHTML: true,
          forceBlock: true,
          forceWrapper: true,
          wrapper: ({ children }: { children: React.ReactNode }) => (
            <div className="max-w-none">
              {children}
            </div>
          ),
        }}
      >
        {segment.value}
      </Markdown>
    );
  };

  // segments.map 직전 동기 reset — 페이지 전환 시 stale count로 callout silently drop 방지
  inlineBoxCountRef.current = 0;

  return (
    <div className="markdown-content">
      {segments.map(renderSegment)}
    </div>
  );
};

export default MarkdownRenderer;
