'use client';

import React from 'react';
import { ThemedMessage, ThemedToolDisplay, ThemedInput } from './index';

/**
 * Test component to verify themed AI Elements components render correctly
 * This can be used during development to test theme integration
 */
export function ThemedComponentsTest() {
  const [inputValue, setInputValue] = React.useState('');

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">
        AI Elements Theme Integration Test
      </h1>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Message Components
        </h2>
        
        <ThemedMessage role="user" content="This is a user message" />
        
        <ThemedMessage 
          role="assistant" 
          content="This is an assistant message with streaming indicator" 
          isStreaming={true}
        />
        
        <ThemedMessage 
          role="system" 
          content="This is a system message" 
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Tool Display Components
        </h2>
        
        <ThemedToolDisplay 
          toolName="query_database" 
          status="executing"
        >
          Executing database query...
        </ThemedToolDisplay>
        
        <ThemedToolDisplay 
          toolName="generate_chart" 
          status="completed"
        >
          Chart generated successfully
        </ThemedToolDisplay>
        
        <ThemedToolDisplay 
          toolName="analyze_data" 
          status="failed"
        >
          Failed to analyze data: Connection timeout
        </ThemedToolDisplay>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Input Component
        </h2>
        
        <ThemedInput
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type a message... (Press Enter to submit)"
          onSubmit={() => {
            console.log('Submitted:', inputValue);
            setInputValue('');
          }}
          rows={3}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Theme Variables Test
        </h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="p-2 bg-[var(--bg-primary)] border border-[var(--border-color)]">
            Primary Background
          </div>
          <div className="p-2 bg-[var(--bg-secondary)] border border-[var(--border-color)]">
            Secondary Background
          </div>
          <div className="p-2 bg-[var(--accent)] text-white">
            Accent Color
          </div>
          <div className="p-2 bg-[var(--accent-hover)] text-white">
            Accent Hover
          </div>
        </div>
      </section>
    </div>
  );
}

export default ThemedComponentsTest;
