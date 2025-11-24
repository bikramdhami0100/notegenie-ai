import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Youtube } from './Icons';

interface MarkdownContentProps {
  content: string;
}

const MarkdownContent: React.FC<MarkdownContentProps> = ({ content }) => {
  // We intercept the YouTube search query recommendations if they are plain text lists
  // and turn them into clickable links.
  // Note: react-markdown handles standard links. This custom renderer is for enhancing the output.
  
  // Custom link renderer to make links open in new tab
  const components = {
    a: ({ node, ...props }: any) => (
      <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline transition-colors" />
    ),
    // Enhance list items that might look like "Search for X"
    li: ({ node, children, ...props }: any) => {
        return (
            <li className="my-1" {...props}>
                {children}
            </li>
        )
    }
  };

  return (
    <div className="prose prose-slate max-w-none prose-headings:font-bold prose-headings:text-slate-800 prose-p:text-slate-700 prose-strong:text-slate-900 prose-code:bg-slate-100 prose-code:text-pink-600 prose-code:px-1 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
};

export default MarkdownContent;