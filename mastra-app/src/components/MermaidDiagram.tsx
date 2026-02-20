'use client';

import { useEffect, useRef, useState, useId } from 'react';
import mermaid from 'mermaid';

export interface MermaidDiagramProps {
  code: string;
  className?: string;
}

// Initialize mermaid with default config
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
});

/**
 * Clean up mermaid code by removing markdown code block markers.
 */
function cleanMermaidCode(code: string): string {
  let cleaned = code.trim();
  
  // Remove markdown code block markers
  if (cleaned.startsWith('```mermaid')) {
    cleaned = cleaned.slice(10);
  }
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  
  return cleaned.trim();
}

/**
 * MermaidDiagram component that renders mermaid syntax as diagrams.
 * Supports flowcharts, sequence diagrams, class diagrams, state diagrams,
 * ER diagrams, Gantt charts, pie charts, and git graphs.
 */
export function MermaidDiagram({ code, className = '' }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string>('');
  // Use React's useId hook for stable, unique IDs
  const reactId = useId();
  // Mermaid requires IDs without special characters, so we sanitize it
  const mermaidId = `mermaid-${reactId.replace(/:/g, '-')}`;

  useEffect(() => {
    const renderDiagram = async () => {
      if (!code || !containerRef.current) {
        return;
      }

      const cleanedCode = cleanMermaidCode(code);
      
      if (!cleanedCode) {
        setError('No mermaid code provided');
        return;
      }

      try {
        // Validate the mermaid syntax first
        const isValid = await mermaid.parse(cleanedCode);
        
        if (!isValid) {
          setError('Invalid mermaid syntax');
          return;
        }

        // Render the diagram
        const { svg: renderedSvg } = await mermaid.render(mermaidId, cleanedCode);
        setSvg(renderedSvg);
        setError(null);
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
        setSvg('');
      }
    };

    renderDiagram();
  }, [code, mermaidId]);

  if (error) {
    return (
      <div className={`mermaid-error p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <div className="text-red-600 font-medium mb-2">Failed to render diagram</div>
        <div className="text-red-500 text-sm mb-4">{error}</div>
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
            Show raw code
          </summary>
          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
            {cleanMermaidCode(code)}
          </pre>
        </details>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className={`mermaid-loading p-4 text-gray-500 text-center ${className}`}>
        Loading diagram...
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`mermaid-diagram p-4 bg-white rounded-lg border overflow-x-auto ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
