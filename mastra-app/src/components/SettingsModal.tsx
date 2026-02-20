'use client';

import { useState, useEffect, useCallback, useRef, ReactNode } from 'react';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export type SettingsTab = 'general' | 'database' | 'appearance';

interface TabConfig {
  id: SettingsTab;
  label: string;
  icon: ReactNode;
}

const TABS: TabConfig[] = [
  {
    id: 'general',
    label: 'General',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'database',
    label: 'Database',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
  },
];

/**
 * SettingsModal component that displays application settings in a modal dialog.
 * Supports tabbed navigation for General, Database, and Appearance settings.
 * 
 * Validates: Requirements 9.1 - Settings panel accessible from header
 */
export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  // Handle Escape key to close
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="settings-modal-backdrop fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={handleBackdropClick}
      data-testid="settings-modal-backdrop"
    >
      <div
        className="settings-modal relative w-full max-w-2xl max-h-[80vh] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{ 
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
        }}
        data-testid="settings-modal"
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border-color)' }}
        >
          <h2 
            className="text-lg font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            Settings
          </h2>
          <button
            onClick={onClose}
            className="settings-close-btn p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            aria-label="Close settings"
            data-testid="settings-close-btn"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content with tabs */}
        <div className="flex flex-1 min-h-0">
          {/* Tab navigation sidebar */}
          <nav 
            className="w-48 flex-shrink-0 py-4"
            style={{ 
              background: 'var(--bg-secondary)',
              borderRight: '1px solid var(--border-color)',
            }}
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="w-full px-4 py-2.5 flex items-center gap-3 text-sm font-medium transition-colors"
                style={{
                  color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                  background: activeTab === tab.id ? 'var(--bg-primary)' : 'transparent',
                  borderLeft: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                }}
                data-testid={`settings-tab-${tab.id}`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'general' && <GeneralSettings />}
            {activeTab === 'database' && <DatabaseSettings />}
            {activeTab === 'appearance' && <AppearanceSettings />}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Storage key for default model setting
 */
export const DEFAULT_MODEL_STORAGE_KEY = 'settings.defaultModel';

/**
 * Model interface for the settings selector
 */
interface SettingsModel {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
}

/**
 * Model group interface for grouped display
 */
interface SettingsModelGroup {
  provider: string;
  icon: string;
  color: string;
  models: SettingsModel[];
}

/**
 * Extract provider from model ID (e.g., "google.gemini-2.5-flash" -> "google")
 */
function getProviderFromModelId(modelId: string): string {
  const parts = modelId.split('.');
  return parts[0] || 'unknown';
}

/**
 * Get provider display info
 */
function getProviderDisplayInfo(provider: string): { name: string; icon: string; color: string } {
  const providers: Record<string, { name: string; icon: string; color: string }> = {
    google: { name: 'Google', icon: '🔵', color: '#4285F4' },
    xai: { name: 'xAI', icon: '⚡', color: '#1DA1F2' },
    cohere: { name: 'Cohere', icon: '🟣', color: '#7C3AED' },
    meta: { name: 'Meta', icon: '🔷', color: '#0668E1' },
  };
  return providers[provider] || { name: provider, icon: '⚪', color: '#6B7280' };
}

/**
 * Group models by provider for display
 */
function groupModelsForSettings(models: SettingsModel[]): SettingsModelGroup[] {
  const groups: Record<string, SettingsModel[]> = {};
  
  for (const model of models) {
    const provider = getProviderFromModelId(model.id);
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
      const info = getProviderDisplayInfo(provider);
      return {
        provider: info.name,
        icon: info.icon,
        color: info.color,
        models: groups[provider],
      };
    });
}

/**
 * General settings tab content
 * Validates: Requirements 9.3 - Settings panel allows setting a default model preference
 */
function GeneralSettings() {
  const [models, setModels] = useState<SettingsModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(DEFAULT_MODEL_STORAGE_KEY) || '';
    }
    return '';
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch available models
  useEffect(() => {
    async function fetchModels() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/models');
        if (!response.ok) throw new Error('Failed to fetch models');
        const data = await response.json();
        setModels(data);
        
        // If no model is selected yet, don't auto-select
        // User should explicitly choose a default
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load models');
      } finally {
        setIsLoading(false);
      }
    }
    fetchModels();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle model selection
  const handleModelSelect = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    setIsDropdownOpen(false);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(DEFAULT_MODEL_STORAGE_KEY, modelId);
    }
  }, []);

  // Clear default model selection
  const handleClearDefault = useCallback(() => {
    setSelectedModel('');
    if (typeof window !== 'undefined') {
      localStorage.removeItem(DEFAULT_MODEL_STORAGE_KEY);
    }
  }, []);

  const modelGroups = groupModelsForSettings(models);
  const selectedModelData = models.find(m => m.id === selectedModel);
  const selectedProviderInfo = selectedModelData 
    ? getProviderDisplayInfo(getProviderFromModelId(selectedModelData.id)) 
    : null;

  return (
    <div className="space-y-6" data-testid="settings-general-content">
      <div>
        <h3 
          className="text-base font-medium mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          General Settings
        </h3>
        <p 
          className="text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          Configure default model preferences and general application behavior.
        </p>
      </div>
      
      {/* Default Model Selector */}
      <div 
        className="p-4 rounded-lg"
        style={{ 
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
        }}
      >
        <label 
          className="block text-sm font-medium mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          Default Model
        </label>
        <p 
          className="text-xs mb-3"
          style={{ color: 'var(--text-muted)' }}
        >
          Select the model to use by default when starting new conversations.
        </p>
        
        {isLoading ? (
          <div 
            className="h-10 rounded-lg animate-pulse"
            style={{ background: 'var(--bg-primary)' }}
            data-testid="default-model-loading"
          />
        ) : error ? (
          <div 
            className="text-sm p-2 rounded"
            style={{ color: 'var(--error, #ef4444)' }}
            data-testid="default-model-error"
          >
            {error}
          </div>
        ) : (
          <div className="relative" ref={dropdownRef}>
            {/* Selected model button with clear button */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex-1 h-10 px-3 rounded-lg text-sm cursor-pointer outline-none flex items-center gap-2 transition-colors"
                style={{ 
                  background: 'var(--bg-primary)', 
                  color: 'var(--text-primary)', 
                  border: '1px solid var(--border-color)',
                  borderRadius: selectedModel ? '0.5rem 0 0 0.5rem' : '0.5rem',
                }}
                data-testid="default-model-selector"
              >
                {selectedProviderInfo && (
                  <span className="text-base" title={selectedProviderInfo.name}>
                    {selectedProviderInfo.icon}
                  </span>
                )}
                <span className="truncate flex-1 text-left">
                  {selectedModelData?.name || 'Select a default model...'}
                </span>
                <svg 
                  className="w-4 h-4 flex-shrink-0 transition-transform" 
                  style={{ 
                    color: 'var(--text-muted)',
                    transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                  }} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {selectedModel && (
                <button
                  type="button"
                  onClick={handleClearDefault}
                  className="h-10 px-2 rounded-r-lg transition-colors flex items-center justify-center"
                  style={{ 
                    background: 'var(--bg-primary)', 
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border-color)',
                    borderLeft: 'none',
                  }}
                  title="Clear default model"
                  data-testid="clear-default-model"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Dropdown menu */}
            {isDropdownOpen && (
              <div 
                className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-50 overflow-hidden"
                style={{ 
                  background: 'var(--bg-primary)', 
                  border: '1px solid var(--border-color)' 
                }}
                data-testid="default-model-dropdown"
              >
                <div className="max-h-64 overflow-y-auto">
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
                      </div>
                      
                      {/* Models in group */}
                      {group.models.map((model) => (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => handleModelSelect(model.id)}
                          className="w-full px-3 py-2 text-left text-sm cursor-pointer flex items-start gap-2 transition-colors"
                          style={{ 
                            background: model.id === selectedModel ? 'var(--bg-secondary)' : 'transparent',
                            color: 'var(--text-primary)',
                          }}
                          onMouseEnter={(e) => {
                            if (model.id !== selectedModel) {
                              e.currentTarget.style.background = 'var(--bg-secondary)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (model.id !== selectedModel) {
                              e.currentTarget.style.background = 'transparent';
                            }
                          }}
                          data-testid={`default-model-option-${model.id}`}
                        >
                          {/* Selection indicator */}
                          <span className="w-4 flex-shrink-0 mt-0.5">
                            {model.id === selectedModel && (
                              <svg className="w-4 h-4" style={{ color: group.color }} fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="truncate font-medium">{model.name}</span>
                            {model.description && (
                              <p 
                                className="text-xs mt-0.5 line-clamp-1"
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
        )}
      </div>
    </div>
  );
}

/**
 * Storage key for SQLcl path setting
 */
const SQLCL_PATH_STORAGE_KEY = 'settings.sqlclPath';

/**
 * Validates the SQLcl path format
 * @param path - The path to validate
 * @returns Error message if invalid, null if valid
 */
export function validateSqlclPath(path: string): string | null {
  // Empty path is invalid
  if (!path || path.trim() === '') {
    return 'SQLcl path is required';
  }

  const trimmedPath = path.trim();

  // Check for invalid characters (basic validation)
  // Allow alphanumeric, slashes, backslashes, dots, dashes, underscores, colons (for Windows drives), spaces, and tildes
  const invalidCharsPattern = /[<>"|?*\x00-\x1F]/;
  if (invalidCharsPattern.test(trimmedPath)) {
    return 'Path contains invalid characters';
  }

  // Path should not be just whitespace
  if (trimmedPath.length === 0) {
    return 'SQLcl path is required';
  }

  // Basic path structure validation
  // Should look like a file path (contains at least one separator or is a simple filename)
  const hasPathStructure = /^(\/|\\|~|[a-zA-Z]:|\w)/.test(trimmedPath);
  if (!hasPathStructure) {
    return 'Invalid path format';
  }

  return null;
}

/**
 * Database settings tab content
 * Validates: Requirements 9.2 - Settings panel allows configuring SQLcl executable path
 */
function DatabaseSettings() {
  const [sqlclPath, setSqlclPath] = useState<string>(() => {
    // Load initial value from localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SQLCL_PATH_STORAGE_KEY) || '';
    }
    return '';
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isTouched, setIsTouched] = useState(false);

  // Handle path change
  const handlePathChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newPath = e.target.value;
    setSqlclPath(newPath);
    
    // Validate on change if field has been touched
    if (isTouched) {
      const error = validateSqlclPath(newPath);
      setValidationError(error);
    }
  }, [isTouched]);

  // Handle blur - validate and save
  const handleBlur = useCallback(() => {
    setIsTouched(true);
    const error = validateSqlclPath(sqlclPath);
    setValidationError(error);
    
    // Save to localStorage if valid
    if (!error && typeof window !== 'undefined') {
      localStorage.setItem(SQLCL_PATH_STORAGE_KEY, sqlclPath.trim());
    }
  }, [sqlclPath]);

  // Determine if we should show error styling
  const showError = isTouched && validationError !== null;

  return (
    <div className="space-y-6" data-testid="settings-database-content">
      <div>
        <h3 
          className="text-base font-medium mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          Database Configuration
        </h3>
        <p 
          className="text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          Configure SQLcl path and database connection settings.
        </p>
      </div>
      
      {/* SQLcl Path Configuration */}
      <div 
        className="p-4 rounded-lg"
        style={{ 
          background: 'var(--bg-secondary)',
          border: `1px solid ${showError ? 'var(--error, #ef4444)' : 'var(--border-color)'}`,
        }}
      >
        <label 
          htmlFor="sqlcl-path-input"
          className="block text-sm font-medium mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          SQLcl Path
        </label>
        <p 
          className="text-xs mb-3"
          style={{ color: 'var(--text-muted)' }}
        >
          Path to the SQLcl executable (e.g., /usr/local/bin/sql or C:\sqlcl\bin\sql.exe)
        </p>
        <input
          id="sqlcl-path-input"
          type="text"
          value={sqlclPath}
          onChange={handlePathChange}
          onBlur={handleBlur}
          placeholder="/path/to/sqlcl/bin/sql"
          className="w-full px-3 py-2 rounded-md text-sm transition-colors"
          style={{
            background: 'var(--bg-primary)',
            border: `1px solid ${showError ? 'var(--error, #ef4444)' : 'var(--border-color)'}`,
            color: 'var(--text-primary)',
            outline: 'none',
          }}
          data-testid="sqlcl-path-input"
          aria-invalid={showError}
          aria-describedby={showError ? 'sqlcl-path-error' : undefined}
        />
        {showError && (
          <p 
            id="sqlcl-path-error"
            className="mt-2 text-xs"
            style={{ color: 'var(--error, #ef4444)' }}
            data-testid="sqlcl-path-error"
            role="alert"
          >
            {validationError}
          </p>
        )}
      </div>

      {/* OCI Configuration Status placeholder - will be implemented in task 11.7 */}
      <div 
        className="p-4 rounded-lg"
        style={{ 
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
        }}
      >
        <label 
          className="block text-sm font-medium mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          OCI Configuration Status
        </label>
        <div className="flex items-center gap-2">
          <span 
            className="w-2 h-2 rounded-full"
            style={{ background: 'var(--text-muted)' }}
          />
          <span 
            className="text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            Status check will be available in a future update.
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Storage key for theme setting
 */
export const THEME_STORAGE_KEY = 'settings.theme';

/**
 * Theme type definition
 */
export type Theme = 'light' | 'dark' | 'system';

/**
 * Theme option configuration
 */
interface ThemeOption {
  id: Theme;
  label: string;
  description: string;
  icon: ReactNode;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'light',
    label: 'Light',
    description: 'Always use light theme',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    id: 'dark',
    label: 'Dark',
    description: 'Always use dark theme',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ),
  },
  {
    id: 'system',
    label: 'System',
    description: 'Follow your system preference',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
];

/**
 * Apply theme to the document root element
 * @param theme - The theme to apply ('light', 'dark', or 'system')
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  
  // Remove existing theme classes
  root.classList.remove('light', 'dark');
  
  if (theme === 'light') {
    root.classList.add('light');
  } else if (theme === 'dark') {
    root.classList.add('dark');
  }
  // For 'system', we don't add any class - CSS media query handles it
}

/**
 * Get the stored theme from localStorage
 * @returns The stored theme or 'system' as default
 */
export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

/**
 * Save theme to localStorage
 * @param theme - The theme to save
 */
export function saveTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

/**
 * Initialize theme on app load
 * Should be called early in the app lifecycle
 */
export function initializeTheme(): void {
  const theme = getStoredTheme();
  applyTheme(theme);
}

/**
 * Appearance settings tab content
 * Validates: Requirements 9.4 - Settings panel provides theme toggle (light/dark/system)
 */
function AppearanceSettings() {
  const [selectedTheme, setSelectedTheme] = useState<Theme>(() => getStoredTheme());

  // Handle theme change
  const handleThemeChange = useCallback((theme: Theme) => {
    setSelectedTheme(theme);
    saveTheme(theme);
    applyTheme(theme);
  }, []);

  return (
    <div className="space-y-6" data-testid="settings-appearance-content">
      <div>
        <h3 
          className="text-base font-medium mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          Appearance
        </h3>
        <p 
          className="text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          Customize the look and feel of the application.
        </p>
      </div>
      
      {/* Theme Toggle */}
      <div 
        className="p-4 rounded-lg"
        style={{ 
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
        }}
      >
        <label 
          className="block text-sm font-medium mb-3"
          style={{ color: 'var(--text-primary)' }}
        >
          Theme
        </label>
        
        <div className="space-y-2" role="radiogroup" aria-label="Theme selection">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selectedTheme === option.id}
              onClick={() => handleThemeChange(option.id)}
              className="w-full p-3 rounded-lg flex items-center gap-3 transition-all"
              style={{
                background: selectedTheme === option.id ? 'var(--bg-primary)' : 'transparent',
                border: selectedTheme === option.id 
                  ? '2px solid var(--accent)' 
                  : '2px solid transparent',
                color: 'var(--text-primary)',
              }}
              onMouseEnter={(e) => {
                if (selectedTheme !== option.id) {
                  e.currentTarget.style.background = 'var(--bg-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedTheme !== option.id) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
              data-testid={`theme-option-${option.id}`}
            >
              {/* Icon */}
              <span 
                className="flex-shrink-0"
                style={{ 
                  color: selectedTheme === option.id ? 'var(--accent)' : 'var(--text-secondary)' 
                }}
              >
                {option.icon}
              </span>
              
              {/* Label and description */}
              <div className="flex-1 text-left">
                <span className="block text-sm font-medium">
                  {option.label}
                </span>
                <span 
                  className="block text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {option.description}
                </span>
              </div>
              
              {/* Selection indicator */}
              {selectedTheme === option.id && (
                <span style={{ color: 'var(--accent)' }}>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * SettingsButton component - a reusable button to open settings modal.
 * Should be placed in the header.
 */
export interface SettingsButtonProps {
  onClick: () => void;
  className?: string;
}

export function SettingsButton({ onClick, className = '' }: SettingsButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`settings-btn p-2 rounded-lg transition-colors ${className}`}
      style={{ 
        color: 'var(--text-secondary)',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      aria-label="Open settings"
      title="Settings"
      data-testid="settings-btn"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" 
        />
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
        />
      </svg>
    </button>
  );
}
