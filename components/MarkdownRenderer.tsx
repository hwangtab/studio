import React from 'react';
import Markdown from 'markdown-to-jsx';
import Image from 'next/image';
import { locales, type Locale } from '../lib/i18n';
import imageMetadata from '../utils/imageMetadata.json';

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
      const altText = typeof alt === 'string' && alt.trim().length > 0 ? alt : '';

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

interface MarkdownRendererProps {
  content: string;
  locale?: Locale;
}

const MarkdownRenderer = ({ content, locale = 'ko' }: MarkdownRendererProps) => {
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
        if (href?.startsWith('/') && !href.startsWith('//')) {
          const pathSegments = href.split('/');
          if (!locales.includes(pathSegments[1] as Locale)) {
            finalHref = `/${currentLocale}${href === '/' ? '' : href}`;
          }
        }
        return (
          <a href={finalHref} className="text-primary hover:underline underline-offset-4" {...props}>
            {children}
          </a>
        );
      },
    },
  }), [currentLocale]);

  return (
    <div className="markdown-content">
      <Markdown
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
        {content}
      </Markdown>
    </div>
  );
};

export default MarkdownRenderer;
