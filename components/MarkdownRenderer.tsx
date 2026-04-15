import React from 'react';
import Markdown from 'markdown-to-jsx';
import Image from 'next/image';
import NextLink from 'next/link';
import { locales, type Locale } from '../lib/i18n';
import imageMetadata from '../utils/imageMetadata.json';
import OnlineFallback from './story/OnlineFallback';
import SessionChecklist from './story/SessionChecklist';
import { topicLinks, MAX_AUTO_LINKS } from '../data/internalLinks';

type ShortcodeSegment = { type: 'shortcode'; name: string };
type MarkdownSegment = { type: 'markdown'; value: string };
type ContentSegment = ShortcodeSegment | MarkdownSegment;

function splitContentByShortcodes(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  // Split on %%shortcode-name%% markers that appear on their own line
  const parts = content.split(/\n%%([\w-]+)%%(?:\n|$)/);
  // parts[0], parts[2], parts[4]... are markdown; parts[1], parts[3]... are shortcode names
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (parts[i].trim()) segments.push({ type: 'markdown', value: parts[i] });
    } else {
      segments.push({ type: 'shortcode', name: parts[i] });
    }
  }
  return segments;
}

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

const toHeadingId = (children: React.ReactNode): string => {
  const text = extractTextContent(children);
  return text
    .toLowerCase()
    .replace(/[\s]+/g, '-')
    .replace(/[^\w\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'section';
};

let prismLoaderPromise: Promise<typeof import('prismjs')> | null = null;
const PRISM_THEME_STYLESHEET_ID = 'prism-theme-stylesheet';

const imageMetadataMap = imageMetadata as Record<string, { width: number; height: number }>;

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

const CONTROL_AND_SPACE_CHARS = /[\u0000-\u001F\u007F\s]+/g;
const EXPLICIT_PROTOCOL = /^([a-z][a-z0-9+.-]*):/;

const isAllowedProtocol = (href: string | undefined): boolean => {
  if (!href) {
    return false;
  }

  const trimmed = href.trim();
  if (!trimmed) {
    return false;
  }

  const normalized = trimmed.toLowerCase();
  const compact = normalized.replace(CONTROL_AND_SPACE_CHARS, '');

  if (
    compact.startsWith('/') ||
    compact.startsWith('./') ||
    compact.startsWith('../') ||
    compact.startsWith('#') ||
    compact.startsWith('?')
  ) {
    return !compact.startsWith('//');
  }

  if (/^(https?|mailto|tel):/.test(compact)) {
    return true;
  }

  if (EXPLICIT_PROTOCOL.test(compact)) {
    return false;
  }

  return true;
};

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
          'font-title text-3xl md:text-4xl font-bold leading-tight mt-12 mb-6',
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
          'font-title text-2xl md:text-3xl font-semibold leading-snug mt-10 mb-5 text-gray-900 dark:text-white',
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
          'text-xl md:text-2xl font-semibold leading-relaxed mt-8 mb-4 text-gray-900 dark:text-white',
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
          'text-xl font-medium mt-6 mb-3 text-gray-900 dark:text-white',
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
    component: ({ alt, src }: { alt?: string; src?: string } & React.ImgHTMLAttributes<HTMLImageElement>) => {
      if (!src) return null;
      const metadata = (imageMetadataMap as Record<string, { width: number; height: number }>)[src];
      const hasDimensions = metadata?.width && metadata?.height;
      const altText = typeof alt === 'string' && alt.trim().length > 0
        ? alt
        : src ? src.split('/').pop()?.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || ''
        : '';

      if (hasDimensions) {
        return (
          <div className="my-6">
            <Image
              src={src}
              alt={altText}
              width={Number(metadata.width)}
              height={Number(metadata.height)}
              sizes="(max-width: 768px) 100vw, 768px"
              className="w-full h-auto rounded-lg shadow-md"
            />
          </div>
        );
      }

      return (
        <div className="my-6">
          <div className="relative w-full overflow-hidden rounded-lg shadow-md" style={{ aspectRatio: '16 / 9' }}>
            <Image
              src={src}
              alt={altText}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-contain"
            />
          </div>
        </div>
      );
    },
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
      <div className="overflow-x-auto my-6">
        <table className="w-full border-collapse" {...props}>
          {children}
        </table>
      </div>
    ),
  },
  th: {
    component: ({ children, ...props }: { children: React.ReactNode } & React.ThHTMLAttributes<HTMLTableCellElement>) => (
      <th className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-left bg-gray-50 dark:bg-gray-800" {...props}>
        {children}
      </th>
    ),
  },
  td: {
    component: ({ children, ...props }: { children: React.ReactNode } & React.TdHTMLAttributes<HTMLTableCellElement>) => (
      <td className="border border-gray-200 dark:border-gray-700 px-4 py-2" {...props}>
        {children}
      </td>
    ),
  },
};

/**
 * 본문에서 topicLinks 키워드의 첫 등장을 자동으로 내부 링크로 변환합니다.
 * - 기사당 최대 MAX_AUTO_LINKS개
 * - 이미 마크다운 링크 안에 있는 키워드는 건너뜀
 * - 자기 자신 slug으로의 링크는 제외
 */
function autoLinkKeywords(text: string, currentSlug?: string): string {
  let result = text;
  let count = 0;
  const linkedSlugs = new Set<string>();

  // 키워드를 길이 역순으로 정렬 (긴 키워드 우선 매칭)
  const sortedKeywords = Object.keys(topicLinks).sort((a, b) => b.length - a.length);

  for (const keyword of sortedKeywords) {
    if (count >= MAX_AUTO_LINKS) break;
    const { slug, anchorText } = topicLinks[keyword];
    if (slug === currentSlug) continue;
    if (linkedSlugs.has(slug)) continue;

    // 이미 링크 안에 있는 키워드는 스킵: [text](url) 패턴 내부 제외
    // 간단한 휴리스틱: 키워드 앞에 [, ( 가 없고 뒤에 ], ) 가 없는 위치에서만 매칭
    const idx = result.indexOf(keyword);
    if (idx === -1) continue;

    // 키워드가 마크다운 링크 내부에 있는지 확인
    const before50 = result.slice(Math.max(0, idx - 50), idx);
    const after50 = result.slice(idx + keyword.length, idx + keyword.length + 50);
    const isInsideLink = (before50.includes('[') && !before50.includes(']')) ||
                         (after50.includes(')') && !after50.includes('('));
    if (isInsideLink) continue;

    // 첫 등장만 링크로 변환
    result = result.slice(0, idx) +
      `[${anchorText}](/stories/${slug})` +
      result.slice(idx + keyword.length);

    linkedSlugs.add(slug);
    count++;
  }

  return result;
}

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

  const overrides = React.useMemo(() => ({
    ...STATIC_OVERRIDES,
    a: {
      component: ({ children, href, ...props }: { children: React.ReactNode; href?: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
        if (!isAllowedProtocol(href)) {
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

  const processedContent = React.useMemo(() => autoLinkKeywords(content, currentSlug), [content, currentSlug]);
  const segments = React.useMemo(() => splitContentByShortcodes(processedContent), [processedContent]);

  const renderSegment = (segment: ContentSegment, index: number) => {
    if (segment.type === 'shortcode') {
      if (segment.name === 'online-fallback') return <OnlineFallback key={index} locale={currentLocale} />;
      if (segment.name === 'session-checklist') return <SessionChecklist key={index} locale={currentLocale} />;
      return null;
    }
    return (
      <Markdown
        key={index}
        options={{
          overrides,
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

  return (
    <div className="markdown-content">
      {segments.map(renderSegment)}
    </div>
  );
};

export default MarkdownRenderer;
