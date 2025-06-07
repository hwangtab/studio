import React from 'react';
import Markdown from 'markdown-to-jsx';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-bash';

// 코드 블록 하이라이팅 컴포넌트
const CodeBlock = ({ children, className }) => {
  const language = className?.replace('lang-', '') || 'text';
  const codeRef = React.useRef(null);

  React.useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [children]);

  return (
    <pre className={`rounded-lg overflow-hidden my-4 ${language}`}>
      <code ref={codeRef} className={`language-${language}`}>
        {children}
      </code>
    </pre>
  );
};

// 마크다운 렌더링 컴포넌트
const MarkdownRenderer = ({ content }) => {
  return (
    <div className="markdown-content">
      <Markdown
        options={{
          overrides: {
            // 제목 스타일링
            h1: {
              component: ({ children, ...props }) => (
                <h1
                  style={{
                    fontSize: '3rem',
                    fontFamily: 'GmarketSans, sans-serif',
                    fontWeight: 700,
                    marginBottom: '1.5rem',
                    marginTop: '3rem',
                    lineHeight: 1.2
                  }}
                  {...props}
                >
                  {children}
                </h1>
              ),
            },
            h2: {
              component: ({ children, ...props }) => (
                <h2
                  style={{
                    fontSize: '2.5rem',
                    fontFamily: 'GmarketSans, sans-serif',
                    fontWeight: 700,
                    marginBottom: '1.25rem',
                    marginTop: '2.5rem',
                    lineHeight: 1.25
                  }}
                  {...props}
                >
                  {children}
                </h2>
              ),
            },
            h3: {
              component: ({ children, ...props }) => (
                <h3
                  style={{
                    fontSize: '2rem',
                    fontFamily: 'Pretendard, sans-serif',
                    fontWeight: 600,
                    marginBottom: '1rem',
                    marginTop: '2rem',
                    lineHeight: 1.3
                  }}
                  {...props}
                >
                  {children}
                </h3>
              ),
            },
            h4: {
              component: ({ children, ...props }) => (
                <h4 className="text-heading-3 font-sans mb-3 mt-6" {...props}>
                  {children}
                </h4>
              ),
            },
            
            // 문단 및 텍스트 스타일링
            p: {
              component: ({ children, ...props }) => (
                <p
                  className="text-lg font-sans leading-relaxed mb-6 mt-4 text-gray-800 dark:text-gray-200"
                  {...props}
                >
                  {children}
                </p>
              ),
            },
            strong: {
              component: ({ children, ...props }) => (
                <strong className="font-semibold text-primary-dark dark:text-primary-light" {...props}>
                  {children}
                </strong>
              ),
            },
            em: {
              component: ({ children, ...props }) => (
                <em className="italic" {...props}>
                  {children}
                </em>
              ),
            },
            
            // 목록 스타일링
            ul: {
              component: ({ children, ...props }) => (
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
              component: ({ children, ...props }) => (
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
              component: ({ children, ...props }) => (
                <li
                  className="text-lg font-sans leading-relaxed mb-4 pl-2 list-item text-gray-800 dark:text-gray-200"
                  {...props}
                >
                  {children}
                </li>
              ),
            },
            
            // 인용문 스타일링
            blockquote: {
              component: ({ children, ...props }) => (
                <blockquote className="border-l-4 border-primary-light dark:border-primary-dark pl-4 py-2 my-4 bg-gray-50 dark:bg-gray-800 italic" {...props}>
                  {children}
                </blockquote>
              ),
            },
            
            // 링크 스타일링
            a: {
              component: ({ children, ...props }) => (
                <a className="text-primary hover:underline underline-offset-4" {...props}>
                  {children}
                </a>
              ),
            },
            
            // 이미지 스타일링
            img: {
              component: ({ alt, ...props }) => (
                <div className="my-6">
                  <img
                    {...props}
                    className="w-full h-auto rounded-lg shadow-md"
                    alt={alt || '이미지'}
                  />
                  {alt && <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">{alt}</p>}
                </div>
              ),
            },
            
            // 코드 블록 스타일링
            code: {
              component: ({ children, className, ...props }) => {
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
            
            // 테이블 스타일링
            table: {
              component: ({ children, ...props }) => (
                <div className="overflow-x-auto my-6">
                  <table className="w-full border-collapse" {...props}>
                    {children}
                  </table>
                </div>
              ),
            },
            th: {
              component: ({ children, ...props }) => (
                <th className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-left bg-gray-50 dark:bg-gray-800" {...props}>
                  {children}
                </th>
              ),
            },
            td: {
              component: ({ children, ...props }) => (
                <td className="border border-gray-200 dark:border-gray-700 px-4 py-2" {...props}>
                  {children}
                </td>
              ),
            },
          },
          forceBlock: true,
          forceWrapper: true,
          wrapper: ({ children }) => (
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