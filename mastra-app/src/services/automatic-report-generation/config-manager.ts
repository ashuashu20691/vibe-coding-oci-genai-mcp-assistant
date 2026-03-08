/**
 * Configuration Manager for Automatic Report Generation
 * 
 * Manages configuration for automatic report generation including:
 * - Default configuration
 * - User preference loading and persistence
 * - Per-query configuration overrides
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import type { 
  AutoReportConfig, 
  ReportConfiguration, 
  ReportTriggerConfig 
} from './types';

/**
 * Storage key for persisting user preferences
 */
const PREFERENCES_STORAGE_KEY = 'automatic-report-generation-preferences';

/**
 * Per-query configuration override options
 */
export interface QueryConfigOverride {
  /** Override automatic generation enabled/disabled */
  enabled?: boolean;
  
  /** Override minimum rows threshold */
  minRows?: number;
  
  /** Override maximum rows threshold */
  maxRows?: number;
  
  /** Override preferred chart types */
  preferredChartTypes?: string[];
  
  /** Override color scheme */
  colorScheme?: 'light' | 'dark' | 'auto';
  
  /** Override layout type */
  layoutType?: 'grid' | 'list';
}

/**
 * Default configuration for automatic report generation
 * Requirement 10.1: Default configuration
 */
const DEFAULT_CONFIG: AutoReportConfig = {
  enabled: true,
  triggerConfig: {
    minRows: 1,
    maxRows: 10000,
    enabledByDefault: true,
    userPreferences: {
      autoGenerate: true,
      preferredChartTypes: ['bar', 'line', 'pie'],
      preferredLayout: 'grid',
    },
  },
  performanceConfig: {
    maxGenerationTimeMs: 5000,
    enableProgressiveRendering: true,
    cacheEnabled: true,
  },
};

/**
 * Default report configuration
 * Requirement 10.1: Default report settings
 */
const DEFAULT_REPORT_CONFIG: ReportConfiguration = {
  automatic: {
    enabled: true,
    minRows: 1,
    maxRows: 10000,
  },
  visualization: {
    preferredChartTypes: ['bar', 'line', 'pie'],
    colorScheme: 'auto',
    showLegends: true,
    showGridLines: true,
  },
  layout: {
    type: 'grid',
    columnsPerRow: 2,
    spacing: 'normal',
  },
  export: {
    includeRawData: true,
    embedImages: true,
    format: 'html',
  },
};

/**
 * Storage interface for preference persistence
 * Allows for dependency injection and testing
 */
export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Browser localStorage implementation
 */
class BrowserStorage implements PreferenceStorage {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(key);
  }

  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, value);
  }

  removeItem(key: string): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  }
}

/**
 * Configuration Manager
 * 
 * Manages configuration for automatic report generation with support for:
 * - Default configuration
 * - User preferences (loaded from storage)
 * - Per-query overrides
 * - Preference persistence
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */
export class ConfigManager {
  private config: AutoReportConfig;
  private reportConfig: ReportConfiguration;
  private userPreferencesLoaded: boolean = false;
  private storage: PreferenceStorage;

  constructor(
    initialConfig?: Partial<AutoReportConfig>,
    storage?: PreferenceStorage
  ) {
    // Start with default config and merge any initial overrides
    this.config = this.mergeConfig(DEFAULT_CONFIG, initialConfig);
    this.reportConfig = { ...DEFAULT_REPORT_CONFIG };
    this.storage = storage || new BrowserStorage();
    
    // Automatically load persisted preferences on initialization
    // Requirement 10.5: Load preferences on initialization
    this.loadPersistedPreferences();
  }

  /**
   * Get current configuration
   * Requirement 10.1: Configuration access
   */
  getConfig(): AutoReportConfig {
    return { ...this.config };
  }

  /**
   * Get current report configuration
   * Requirement 10.1: Report configuration access
   */
  getReportConfig(): ReportConfiguration {
    return { ...this.reportConfig };
  }

  /**
   * Load user preferences from storage
   * Requirement 10.2: User preference loading
   * 
   * @param preferences User preferences object
   */
  loadUserPreferences(preferences: Partial<ReportConfiguration>): void {
    // Merge user preferences with default report config
    this.reportConfig = this.mergeReportConfig(
      DEFAULT_REPORT_CONFIG,
      preferences
    );

    // Update trigger config with user preferences (create new object to avoid mutation)
    this.config = {
      ...this.config,
      triggerConfig: {
        ...this.config.triggerConfig,
        enabledByDefault: preferences.automatic?.enabled ?? this.config.triggerConfig.enabledByDefault,
        minRows: preferences.automatic?.minRows ?? this.config.triggerConfig.minRows,
        maxRows: preferences.automatic?.maxRows ?? this.config.triggerConfig.maxRows,
        userPreferences: {
          autoGenerate: this.reportConfig.automatic.enabled,
          preferredChartTypes: preferences.visualization?.preferredChartTypes ?? 
            this.config.triggerConfig.userPreferences?.preferredChartTypes ?? ['bar', 'line', 'pie'],
          preferredLayout: this.reportConfig.layout.type,
        },
      },
    };

    this.userPreferencesLoaded = true;
  }

  /**
   * Load persisted preferences from storage
   * Requirement 10.5: Load preferences on initialization
   * 
   * @returns true if preferences were loaded, false otherwise
   */
  private loadPersistedPreferences(): boolean {
    try {
      const stored = this.storage.getItem(PREFERENCES_STORAGE_KEY);
      if (!stored) return false;

      const preferences = JSON.parse(stored) as Partial<ReportConfiguration>;
      this.loadUserPreferences(preferences);
      return true;
    } catch (error) {
      console.error('Failed to load persisted preferences:', error);
      return false;
    }
  }

  /**
   * Save current preferences to storage
   * Requirement 10.5: Store preferences in local storage
   * 
   * @returns true if preferences were saved, false otherwise
   */
  savePreferences(): boolean {
    try {
      const preferences = this.getReportConfig();
      this.storage.setItem(
        PREFERENCES_STORAGE_KEY,
        JSON.stringify(preferences)
      );
      return true;
    } catch (error) {
      console.error('Failed to save preferences:', error);
      return false;
    }
  }

  /**
   * Update preferences and persist to storage
   * Requirement 10.5: Provide API to update preferences
   * 
   * @param preferences Partial preferences to update
   * @returns true if preferences were updated and saved, false otherwise
   */
  updatePreferences(preferences: Partial<ReportConfiguration>): boolean {
    try {
      // Update in-memory configuration
      this.loadUserPreferences(preferences);
      
      // Persist to storage
      return this.savePreferences();
    } catch (error) {
      console.error('Failed to update preferences:', error);
      return false;
    }
  }

  /**
   * Clear persisted preferences from storage
   * Requirement 10.5: Preference management
   * 
   * @returns true if preferences were cleared, false otherwise
   */
  clearPersistedPreferences(): boolean {
    try {
      this.storage.removeItem(PREFERENCES_STORAGE_KEY);
      return true;
    } catch (error) {
      console.error('Failed to clear persisted preferences:', error);
      return false;
    }
  }

  /**
   * Apply per-query configuration overrides
   * Requirement 10.4: Per-query configuration overrides
   * 
   * @param queryOverride Query-specific configuration
   * @returns Merged configuration for this query
   */
  applyQueryOverride(queryOverride: QueryConfigOverride): AutoReportConfig {
    const baseConfig = this.getConfig();
    
    // Create a copy to avoid mutating the base config
    const overriddenConfig: AutoReportConfig = {
      ...baseConfig,
      enabled: queryOverride.enabled ?? baseConfig.enabled,
      triggerConfig: {
        ...baseConfig.triggerConfig,
        minRows: queryOverride.minRows ?? baseConfig.triggerConfig.minRows,
        maxRows: queryOverride.maxRows ?? baseConfig.triggerConfig.maxRows,
        userPreferences: {
          autoGenerate: baseConfig.triggerConfig.userPreferences?.autoGenerate ?? true,
          preferredChartTypes: queryOverride.preferredChartTypes ?? 
            baseConfig.triggerConfig.userPreferences?.preferredChartTypes ?? ['bar', 'line', 'pie'],
          preferredLayout: queryOverride.layoutType ?? 
            baseConfig.triggerConfig.userPreferences?.preferredLayout ?? 'grid',
        },
      },
      performanceConfig: { ...baseConfig.performanceConfig },
    };

    return overriddenConfig;
  }

  /**
   * Update configuration
   * Requirement 10.3: Custom preference respect
   * 
   * @param updates Partial configuration updates
   */
  updateConfig(updates: Partial<AutoReportConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
  }

  /**
   * Update report configuration
   * Requirement 10.3: Custom preference respect
   * 
   * @param updates Partial report configuration updates
   */
  updateReportConfig(updates: Partial<ReportConfiguration>): void {
    this.reportConfig = this.mergeReportConfig(this.reportConfig, updates);
    
    // Sync with trigger config (create new object to avoid mutation)
    if (updates.automatic) {
      this.config = {
        ...this.config,
        triggerConfig: {
          ...this.config.triggerConfig,
          enabledByDefault: updates.automatic.enabled ?? this.config.triggerConfig.enabledByDefault,
          minRows: updates.automatic.minRows ?? this.config.triggerConfig.minRows,
          maxRows: updates.automatic.maxRows ?? this.config.triggerConfig.maxRows,
        },
      };
    }
  }

  /**
   * Check if automatic report generation is enabled
   * Requirements: 10.1, 10.2
   */
  isEnabled(): boolean {
    return this.config.enabled && this.config.triggerConfig.enabledByDefault;
  }

  /**
   * Get trigger configuration
   * Requirement 10.1: Trigger configuration access
   */
  getTriggerConfig(): ReportTriggerConfig {
    return { ...this.config.triggerConfig };
  }

  /**
   * Reset to default configuration
   * Requirement 10.1: Configuration reset
   * 
   * @param clearPersisted Whether to also clear persisted preferences (default: false)
   */
  resetToDefaults(clearPersisted: boolean = false): void {
    this.config = { ...DEFAULT_CONFIG };
    this.reportConfig = { ...DEFAULT_REPORT_CONFIG };
    this.userPreferencesLoaded = false;
    
    if (clearPersisted) {
      this.clearPersistedPreferences();
    }
  }

  /**
   * Check if user preferences have been loaded
   */
  hasUserPreferences(): boolean {
    return this.userPreferencesLoaded;
  }

  /**
   * Merge two AutoReportConfig objects
   * Deep merge with preference for override values
   */
  private mergeConfig(
    base: AutoReportConfig,
    override?: Partial<AutoReportConfig>
  ): AutoReportConfig {
    if (!override) return { ...base };

    return {
      enabled: override.enabled ?? base.enabled,
      triggerConfig: {
        minRows: override.triggerConfig?.minRows ?? base.triggerConfig.minRows,
        maxRows: override.triggerConfig?.maxRows ?? base.triggerConfig.maxRows,
        enabledByDefault: override.triggerConfig?.enabledByDefault ?? base.triggerConfig.enabledByDefault,
        userPreferences: {
          autoGenerate: override.triggerConfig?.userPreferences?.autoGenerate ?? 
            base.triggerConfig.userPreferences?.autoGenerate ?? true,
          preferredChartTypes: override.triggerConfig?.userPreferences?.preferredChartTypes ?? 
            base.triggerConfig.userPreferences?.preferredChartTypes,
          preferredLayout: override.triggerConfig?.userPreferences?.preferredLayout ?? 
            base.triggerConfig.userPreferences?.preferredLayout,
        },
      },
      performanceConfig: {
        maxGenerationTimeMs: override.performanceConfig?.maxGenerationTimeMs ?? 
          base.performanceConfig.maxGenerationTimeMs,
        enableProgressiveRendering: override.performanceConfig?.enableProgressiveRendering ?? 
          base.performanceConfig.enableProgressiveRendering,
        cacheEnabled: override.performanceConfig?.cacheEnabled ?? 
          base.performanceConfig.cacheEnabled,
      },
    };
  }

  /**
   * Merge two ReportConfiguration objects
   * Deep merge with preference for override values
   */
  private mergeReportConfig(
    base: ReportConfiguration,
    override?: Partial<ReportConfiguration>
  ): ReportConfiguration {
    if (!override) return { ...base };

    return {
      automatic: {
        ...base.automatic,
        ...(override.automatic || {}),
      },
      visualization: {
        ...base.visualization,
        ...(override.visualization || {}),
      },
      layout: {
        ...base.layout,
        ...(override.layout || {}),
      },
      export: {
        ...base.export,
        ...(override.export || {}),
      },
    };
  }
}

/**
 * Singleton instance for global configuration management
 */
let globalConfigManager: ConfigManager | null = null;

/**
 * Get or create the global configuration manager instance
 * 
 * @param initialConfig Optional initial configuration
 * @param storage Optional storage implementation (defaults to browser localStorage)
 * @returns Global ConfigManager instance
 */
export function getConfigManager(
  initialConfig?: Partial<AutoReportConfig>,
  storage?: PreferenceStorage
): ConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigManager(initialConfig, storage);
  }
  return globalConfigManager;
}

/**
 * Reset the global configuration manager
 * Useful for testing
 */
export function resetConfigManager(): void {
  globalConfigManager = null;
}
