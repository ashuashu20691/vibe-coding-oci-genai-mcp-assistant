'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) {
    return null;
  }

  return (
    <div className="markdown-content prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Custom code block rendering
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;
            
            if (isInline) {
              return (
                <code 
                  className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm font-mono" 
                  {...props}
                >
                  {children}
                </code>
              );
            }
            
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          // Custom pre block for code blocks
          pre({ children, ...props }) {
            return (
              <pre 
                className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm" 
                {...props}
              >
                {children}
              </pre>
            );
          },
          // Custom table rendering
          table({ children, ...props }) {
            return (
              <div className="overflow-x-auto">
                <table 
                  className="min-w-full border-collapse border border-gray-300 dark:border-gray-600" 
                  {...props}
                >
                  {children}
                </table>
              </div>
            );
          },
          th({ children, ...props }) {
            return (
              <th 
                className="border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 px-3 py-2 text-left font-semibold" 
                {...props}
              >
                {children}
              </th>
            );
          },
          td({ children, ...props }) {
            return (
              <td 
                className="border border-gray-300 dark:border-gray-600 px-3 py-2" 
                {...props}
              >
                {children}
              </td>
            );
          },
          // Custom link rendering
          a({ href, children, ...props }) {
            return (
              <a 
                href={href} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
                {...props}
              >
                {children}
              </a>
            );
          },
          // Custom blockquote
          blockquote({ children, ...props }) {
            return (
              <blockquote 
                className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-400" 
                {...props}
              >
                {children}
              </blockquote>
            );
          },
          // Custom list items
          ul({ children, ...props }) {
            return (
              <ul className="list-disc list-inside space-y-1" {...props}>
                {children}
              </ul>
            );
          },
          ol({ children, ...props }) {
            return (
              <ol className="list-decimal list-inside space-y-1" {...props}>
                {children}
              </ol>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
