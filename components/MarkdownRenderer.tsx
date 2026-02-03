import React from 'react';
import Markdown from 'markdown-to-jsx';

let prismLoaderPromise: Promise<any> | null = null;

const loadPrism = async () => {
  if (typeof window === 'undefined') {
    return null;
  }
  if (!prismLoaderPromise) {
    prismLoaderPromise = import('prismjs').then(async (module) => {
      await Promise.all([
        import('prismjs/components/prism-javascript' as any),
        import('prismjs/components/prism-typescript' as any),
        import('prismjs/components/prism-jsx' as any),
        import('prismjs/components/prism-css' as any),
        import('prismjs/components/prism-bash' as any),
      ]);
      return module.default || module;
    });
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
    <pre className={`rounded-lg overflow-hidden my-4 ${language}`}>
      <code ref={codeRef} className={`language-${language}`}>
        {children}
      </code>
    </pre>
  );
};

const mergeClassNames = (base: string, extra?: string) => (extra ? `${base} ${extra}` : base);

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer = ({ content }: MarkdownRendererProps) => {
  return (
    <div className="markdown-content">
      <Markdown
        options={{
          overrides: {
            h1: {
              component: ({ children, className, ...rest }: any) => (
                <h1
                  {...rest}
                  className={mergeClassNames(
                    'font-title text-3xl md:text-4xl font-bold leading-tight mt-12 mb-6',
                    className
                  )}
                >
                  {children}
                </h1>
              ),
            },
            h2: {
              component: ({ children, className, ...rest }: any) => (
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
              component: ({ children, className, ...rest }: any) => (
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
              component: ({ children, className, ...rest }: any) => (
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
              component: ({ children, ...props }: any) => (
                <p
                  className="text-body-1 leading-relaxed mb-6 mt-4 text-gray-800 dark:text-gray-200"
                  {...props}
                >
                  {children}
                </p>
              ),
            },
            strong: {
              component: ({ children, ...props }: any) => (
                <strong className="font-bold text-primary-dark dark:text-primary-light" {...props}>
                  {children}
                </strong>
              ),
            },
            em: {
              component: ({ children, ...props }: any) => (
                <em className="italic" {...props}>
                  {children}
                </em>
              ),
            },

            ul: {
              component: ({ children, ...props }: any) => (
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
              component: ({ children, ...props }: any) => (
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
              component: ({ children, ...props }: any) => (
                <li
                  className="text-body-1 leading-relaxed mb-4 pl-2 list-item text-gray-800 dark:text-gray-200"
                  {...props}
                >
                  {children}
                </li>
              ),
            },

            blockquote: {
              component: ({ children, ...props }: any) => (
                <blockquote className="border-l-4 border-primary-light dark:border-primary-dark pl-4 py-2 my-4 bg-gray-50 dark:bg-gray-800 italic" {...props}>
                  {children}
                </blockquote>
              ),
            },

            a: {
              component: ({ children, ...props }: any) => (
                <a className="text-primary hover:underline underline-offset-4" {...props}>
                  {children}
                </a>
              ),
            },

            img: {
              component: ({ alt, src, ...rest }: any) => (
                <div className="my-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={alt || '이미지'}
                    className="w-full h-auto rounded-lg shadow-md"
                    loading="lazy"
                    {...rest}
                  />
                  {/* {alt && <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">{alt}</p>} */}
                </div>
              ),
            },

            hr: {
              component: ({ className, ...props }: any) => (
                <hr
                  className={mergeClassNames('my-12 border-t border-gray-200 dark:border-gray-700', className)}
                  {...props}
                />
              ),
            },

            code: {
              component: ({ children, className, ...props }: any) => {
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
              component: ({ children, ...props }: any) => (
                <div className="overflow-x-auto my-6">
                  <table className="w-full border-collapse" {...props}>
                    {children}
                  </table>
                </div>
              ),
            },
            th: {
              component: ({ children, ...props }: any) => (
                <th className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-left bg-gray-50 dark:bg-gray-800" {...props}>
                  {children}
                </th>
              ),
            },
            td: {
              component: ({ children, ...props }: any) => (
                <td className="border border-gray-200 dark:border-gray-700 px-4 py-2" {...props}>
                  {children}
                </td>
              ),
            },
          },
          forceBlock: true,
          forceWrapper: true,
          wrapper: ({ children }: any) => (
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
