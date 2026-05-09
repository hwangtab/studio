import React from 'react';
import Markdown from 'markdown-to-jsx';
import Image from 'next/image';
import NextLink from 'next/link';
import dynamic from 'next/dynamic';
import { locales, type Locale } from '../lib/i18n';
import imageMetadata from '../utils/imageMetadata.json';
import OnlineFallback from './story/OnlineFallback';
import SessionChecklist from './story/SessionChecklist';
import { topicLinks, MAX_AUTO_LINKS } from '../data/internalLinks';
import { isInlineDirectiveName, MAX_AUTHOR_BOXES } from '../lib/inlineDirectives';

const InlinePriceCallout = dynamic(() => import('./inline/InlinePriceCallout'));
const InlineReviewCallout = dynamic(() => import('./inline/InlineReviewCallout'));
const InlineBookingCallout = dynamic(() => import('./inline/InlineBookingCallout'));
const InlineServiceCallout = dynamic(() => import('./inline/InlineServiceCallout'));

type ShortcodeSegment = { type: 'shortcode'; name: string; arg?: string };
type MarkdownSegment = { type: 'markdown'; value: string };
type ContentSegment = ShortcodeSegment | MarkdownSegment;

function splitContentByShortcodes(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  // %%name%% 또는 %%name:arg%% 자체 라인 매칭
  // 캡처 1: name, 캡처 2: arg (optional)
  const parts = content.split(/\n%%([\w-]+)(?::([^%\n]+))?%%(?=\n|$)/);
  // parts[0], parts[3], parts[6]... = markdown
  // parts[1], parts[4], parts[7]... = shortcode name
  // parts[2], parts[5], parts[8]... = arg (or undefined)
  for (let i = 0; i < parts.length; i += 3) {
    if (parts[i] && parts[i].trim()) {
      segments.push({ type: 'markdown', value: parts[i] });
    }
    if (i + 1 < parts.length) {
      const name = parts[i + 1];
      const arg = parts[i + 2];
      segments.push({ type: 'shortcode', name, ...(arg !== undefined && { arg }) });
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

      // markdown-to-jsx가 <img>를 <p> 내부에 배치하므로 래퍼가 <div>면 HTML 무효 →
      // 브라우저가 <p>를 자동 닫음 → SSR/하이드레이션 DOM 불일치(React #418 HTML mismatch).
      // <span> + display:block 으로 같은 레이아웃 유지하되 <p> 내부에서도 유효한 태그 구조 보장.
      if (hasDimensions) {
        return (
          <span className="block my-6">
            <Image
              src={src}
              alt={altText}
              width={Number(metadata.width)}
              height={Number(metadata.height)}
              sizes="(max-width: 768px) 100vw, 768px"
              className="w-full h-auto rounded-lg shadow-md"
            />
          </span>
        );
      }

      return (
        <span className="block my-6">
          <span className="relative w-full overflow-hidden rounded-lg shadow-md block" style={{ aspectRatio: '16 / 9' }}>
            <Image
              src={src}
              alt={altText}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-contain"
            />
          </span>
        </span>
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

const REGEX_META_CHARS = /[.*+?^${}()|[\]\\]/g;
const escapeRegexLiteral = (raw: string): string => raw.replace(REGEX_META_CHARS, '\\$&');

// 자동 링크 삽입에서 제외할 본문 영역(이미 링크인 곳, 코드 펜스, 인라인 코드).
// 키워드 매치 offset이 이 범위에 들어가면 다음 유효 매치로 폴백한다.
const EXCLUSION_PATTERNS: RegExp[] = [
  /!?\[[^\]\n]*\]\([^)\n]*\)/g, // 마크다운 링크/이미지 [text](url) 또는 ![alt](src)
  /```[\s\S]*?```/g,             // 코드 펜스 ``` ```
  /`[^`\n]+`/g,                  // 인라인 코드 `code`
];

const collectExclusionRanges = (text: string): Array<[number, number]> => {
  const ranges: Array<[number, number]> = [];
  for (const pattern of EXCLUSION_PATTERNS) {
    for (const m of text.matchAll(pattern)) {
      if (typeof m.index === 'number') {
        ranges.push([m.index, m.index + m[0].length]);
      }
    }
  }
  return ranges;
};

const isOffsetExcluded = (offset: number, ranges: Array<[number, number]>): boolean => {
  for (const [start, end] of ranges) {
    if (offset >= start && offset < end) return true;
  }
  return false;
};

/**
 * 본문에서 topicLinks 키워드의 *첫 유효 등장*을 자동으로 내부 링크로 변환합니다.
 * - 기사당 최대 MAX_AUTO_LINKS개
 * - 마크다운 링크/이미지/코드 펜스/인라인 코드 안의 매치는 건너뜀 (정확한 offset 기반)
 * - 한 키워드가 여러 번 등장할 때 첫 매치가 제외 영역 안이면 다음 유효 매치를 시도
 * - 자기 자신 slug으로의 링크는 제외
 */
function autoLinkKeywords(text: string, currentSlug?: string): string {
  let result = text;
  let count = 0;
  const linkedSlugs = new Set<string>();

  // 긴 키워드 먼저 매칭해 짧은 키워드가 부분 매치로 가로채는 경우 방지
  const sortedKeywords = Object.keys(topicLinks).sort((a, b) => b.length - a.length);

  for (const keyword of sortedKeywords) {
    if (count >= MAX_AUTO_LINKS) break;
    const { slug, anchorText } = topicLinks[keyword];
    if (slug === currentSlug || linkedSlugs.has(slug)) continue;

    // result는 매 변환마다 mutating되므로 exclusion ranges도 매번 재계산
    const exclusionRanges = collectExclusionRanges(result);
    const re = new RegExp(escapeRegexLiteral(keyword), 'g');

    for (const m of result.matchAll(re)) {
      if (typeof m.index !== 'number') continue;
      if (isOffsetExcluded(m.index, exclusionRanges)) continue;

      result = result.slice(0, m.index) +
        `[${anchorText}](/stories/${slug})` +
        result.slice(m.index + keyword.length);
      linkedSlugs.add(slug);
      count++;
      break;
    }
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

  // locale이 바뀔 때만 a 컴포넌트 override를 새로 만들고, static overrides와는 합치기만 한다.
  // 이전에는 STATIC_OVERRIDES 전체를 spread해 overrides 객체 자체가 매 locale 변경마다 통째로
  // 재생성됐다 — markdown-to-jsx options 식별이 깨지면서 자식 트리 재마운트로 이어졌다.
  const localeAwareOverrides = React.useMemo(() => ({
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

  const overrides = React.useMemo(
    () => ({ ...STATIC_OVERRIDES, ...localeAwareOverrides }),
    [localeAwareOverrides]
  );

  const processedContent = React.useMemo(() => autoLinkKeywords(content, currentSlug), [content, currentSlug]);
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
