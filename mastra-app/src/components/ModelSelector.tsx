'use client';

import { useState, useEffect, useRef } from 'react';
import { Model } from '@/types';

const STORAGE_KEY = 'oci-genai-selected-model';

interface Props {
  value?: string;
  onChange: (modelId: string) => void;
  defaultModel?: string;
}

interface ModelGroup {
  provider: string;
  icon: string;
  color: string;
  models: Model[];
}

/**
 * Extract provider from model ID (e.g., "google.gemini-2.5-flash" -> "google")
 */
function getProviderFromId(modelId: string): string {
  const parts = modelId.split('.');
  return parts[0] || 'unknown';
}

/**
 * Get provider display info
 */
function getProviderInfo(provider: string): { name: string; icon: string; color: string } {
  const providers: Record<string, { name: string; icon: string; color: string }> = {
    google: { name: 'Google', icon: '🔵', color: '#4285F4' },
    xai: { name: 'xAI', icon: '⚡', color: '#1DA1F2' },
    cohere: { name: 'Cohere', icon: '🟣', color: '#7C3AED' },
    meta: { name: 'Meta', icon: '🔷', color: '#0668E1' },
  };
  return providers[provider] || { name: provider, icon: '⚪', color: '#6B7280' };
}

/**
 * Group models by provider
 */
function groupModelsByProvider(models: Model[]): ModelGroup[] {
  const groups: Record<string, Model[]> = {};
  
  for (const model of models) {
    const provider = getProviderFromId(model.id);
    if (!groups[provider]) {
      groups[provider] = [];
    }
    groups[provider].push(model);
  }
  
  // Define provider order: Cohere, Meta, Google, xAI (as per requirements)
  const providerOrder = ['cohere', 'meta', 'google', 'xai'];
  
  return providerOrder
    .filter(provider => groups[provider])
    .map(provider => {
      const info = getProviderInfo(provider);
      return {
        provider: info.name,
        icon: info.icon,
        color: info.color,
        models: groups[provider],
      };
    });
}

export function ModelSelector({ value, onChange, defaultModel }: Props) {
  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchModels() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/models');
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();
        setModels(data);
        
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && data.some((m: Model) => m.id === saved)) onChange(saved);
        else if (defaultModel && data.some((m: Model) => m.id === defaultModel)) onChange(defaultModel);
        else if (data.length > 0 && !value) onChange(data[0].id);
      } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
      finally { setIsLoading(false); }
    }
    fetchModels();
  }, [defaultModel]); // eslint-disable-line

  useEffect(() => { if (value) localStorage.setItem(STORAGE_KEY, value); }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading) return <div className="h-9 w-48 rounded-lg animate-pulse" style={{ background: 'var(--bg-secondary)' }} />;
  if (error) return <span className="text-sm text-red-500">{error}</span>;

  const modelGroups = groupModelsByProvider(models);
  const selectedModel = models.find(m => m.id === value);
  const selectedProvider = selectedModel ? getProviderInfo(getProviderFromId(selectedModel.id)) : null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected model button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-9 pl-3 pr-8 rounded-lg text-sm font-medium cursor-pointer outline-none flex items-center gap-2 min-w-[200px]"
        style={{ 
          background: 'var(--bg-secondary)', 
          color: 'var(--text-primary)', 
          border: '1px solid var(--border-color)' 
        }}
      >
        {selectedProvider && (
          <span className="text-base" title={selectedProvider.name}>{selectedProvider.icon}</span>
        )}
        <span className="truncate">{selectedModel?.name || 'Select model'}</span>
      </button>
      
      {/* Dropdown arrow */}
      <svg 
        className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none transition-transform" 
        style={{ 
          color: 'var(--text-muted)',
          transform: isOpen ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)'
        }} 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>

      {/* Dropdown menu */}
      {isOpen && (
        <div 
          className="absolute top-full left-0 mt-1 w-72 rounded-lg shadow-lg z-50 overflow-hidden"
          style={{ 
            background: 'var(--bg-primary)', 
            border: '1px solid var(--border-color)' 
          }}
        >
          <div className="max-h-80 overflow-y-auto">
            {modelGroups.map((group, groupIndex) => (
              <div key={group.provider}>
                {/* Provider header */}
                <div 
                  className="px-3 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 sticky top-0"
                  style={{ 
                    background: 'var(--bg-secondary)',
                    color: group.color,
                    borderBottom: '1px solid var(--border-color)'
                  }}
                >
                  <span>{group.icon}</span>
                  <span>{group.provider}</span>
                  <span className="ml-auto text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                    {group.models.length} model{group.models.length !== 1 ? 's' : ''}
                  </span>
                </div>
                
                {/* Models in group */}
                {group.models.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      onChange(model.id);
                      setIsOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm cursor-pointer flex items-start gap-2 transition-colors"
                    style={{ 
                      background: model.id === value ? 'var(--bg-secondary)' : 'transparent',
                      color: 'var(--text-primary)',
                    }}
                    onMouseEnter={(e) => {
                      if (model.id !== value) {
                        e.currentTarget.style.background = 'var(--bg-secondary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (model.id !== value) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    {/* Selection indicator */}
                    <span className="w-4 flex-shrink-0 mt-0.5">
                      {model.id === value && (
                        <svg className="w-4 h-4" style={{ color: group.color }} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{model.name}</span>
                        {model.contextLength && (
                          <span 
                            className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ 
                              background: 'var(--bg-primary)', 
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border-color)'
                            }}
                          >
                            {model.contextLength >= 1000 
                              ? `${Math.round(model.contextLength / 1000)}K context` 
                              : `${model.contextLength} context`}
                          </span>
                        )}
                      </div>
                      {model.description && (
                        <p 
                          className="text-xs mt-0.5 line-clamp-2"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {model.description}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
                
                {/* Separator between groups (except last) */}
                {groupIndex < modelGroups.length - 1 && (
                  <div style={{ borderBottom: '1px solid var(--border-color)' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
