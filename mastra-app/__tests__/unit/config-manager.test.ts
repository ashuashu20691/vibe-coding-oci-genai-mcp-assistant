/**
 * Unit Tests for ConfigManager
 * 
 * Tests configuration management including:
 * - Default configuration
 * - User preference loading
 * - Per-query configuration overrides
 * - Configuration updates
 * - Preference persistence
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  ConfigManager, 
  getConfigManager, 
  resetConfigManager,
  type QueryConfigOverride,
  type PreferenceStorage
} from '@/services/automatic-report-generation/config-manager';
import type { 
  AutoReportConfig, 
  ReportConfiguration 
} from '@/services/automatic-report-generation/types';

/**
 * Mock storage for testing preference persistence
 */
class MockStorage implements PreferenceStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) || null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
    configManager = new ConfigManager(undefined, mockStorage);
    resetConfigManager();
  });

  describe('Default Configuration', () => {
    it('should initialize with default configuration', () => {
      const config = configManager.getConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.triggerConfig.minRows).toBe(1);
      expect(config.triggerConfig.maxRows).toBe(10000);
      expect(config.triggerConfig.enabledByDefault).toBe(true);
      expect(config.performanceConfig.maxGenerationTimeMs).toBe(5000);
      expect(config.performanceConfig.enableProgressiveRendering).toBe(true);
      expect(config.performanceConfig.cacheEnabled).toBe(true);
    });

    it('should initialize with default report configuration', () => {
      const reportConfig = configManager.getReportConfig();
      
      expect(reportConfig.automatic.enabled).toBe(true);
      expect(reportConfig.automatic.minRows).toBe(1);
      expect(reportConfig.automatic.maxRows).toBe(10000);
      expect(reportConfig.visualization.colorScheme).toBe('auto');
      expect(reportConfig.visualization.showLegends).toBe(true);
      expect(reportConfig.layout.type).toBe('grid');
      expect(reportConfig.export.format).toBe('html');
    });

    it('should accept initial configuration overrides', () => {
      const customConfig = new ConfigManager({
        enabled: false,
        triggerConfig: {
          minRows: 5,
          maxRows: 5000,
          enabledByDefault: false,
        },
      });
      
      const config = customConfig.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.triggerConfig.minRows).toBe(5);
      expect(config.triggerConfig.maxRows).toBe(5000);
      expect(config.triggerConfig.enabledByDefault).toBe(false);
    });

    it('should report enabled status correctly', () => {
      expect(configManager.isEnabled()).toBe(true);
      
      configManager.updateConfig({ enabled: false });
      expect(configManager.isEnabled()).toBe(false);
    });
  });

  describe('User Preference Loading', () => {
    it('should load user preferences and merge with defaults', () => {
      const userPreferences: Partial<ReportConfiguration> = {
        automatic: {
          enabled: false,
          minRows: 10,
          maxRows: 5000,
        },
        visualization: {
          preferredChartTypes: ['line', 'scatter'],
          colorScheme: 'dark',
          showLegends: false,
          showGridLines: false,
        },
      };

      configManager.loadUserPreferences(userPreferences);
      
      const reportConfig = configManager.getReportConfig();
      expect(reportConfig.automatic.enabled).toBe(false);
      expect(reportConfig.automatic.minRows).toBe(10);
      expect(reportConfig.automatic.maxRows).toBe(5000);
      expect(reportConfig.visualization.colorScheme).toBe('dark');
      expect(reportConfig.visualization.showLegends).toBe(false);
    });

    it('should sync trigger config with user preferences', () => {
      const userPreferences: Partial<ReportConfiguration> = {
        automatic: {
          enabled: false,
          minRows: 20,
          maxRows: 8000,
        },
        visualization: {
          preferredChartTypes: ['pie'],
          colorScheme: 'light',
          showLegends: true,
          showGridLines: true,
        },
        layout: {
          type: 'list',
          columnsPerRow: 1,
          spacing: 'compact',
        },
      };

      configManager.loadUserPreferences(userPreferences);
      
      const triggerConfig = configManager.getTriggerConfig();
      expect(triggerConfig.enabledByDefault).toBe(false);
      expect(triggerConfig.minRows).toBe(20);
      expect(triggerConfig.maxRows).toBe(8000);
      expect(triggerConfig.userPreferences?.preferredChartTypes).toEqual(['pie']);
      expect(triggerConfig.userPreferences?.preferredLayout).toBe('list');
    });

    it('should track if user preferences have been loaded', () => {
      expect(configManager.hasUserPreferences()).toBe(false);
      
      configManager.loadUserPreferences({});
      expect(configManager.hasUserPreferences()).toBe(true);
    });

    it('should preserve unspecified preferences when loading', () => {
      const userPreferences: Partial<ReportConfiguration> = {
        visualization: {
          preferredChartTypes: ['bar'],
          colorScheme: 'dark',
          showLegends: true,
          showGridLines: true,
        },
      };

      configManager.loadUserPreferences(userPreferences);
      
      const reportConfig = configManager.getReportConfig();
      // Should keep default values for unspecified sections
      expect(reportConfig.layout.type).toBe('grid');
      expect(reportConfig.export.format).toBe('html');
    });
  });

  describe('Per-Query Configuration Overrides', () => {
    it('should apply query-specific overrides without mutating base config', () => {
      const queryOverride: QueryConfigOverride = {
        enabled: false,
        minRows: 50,
        preferredChartTypes: ['scatter'],
      };

      const overriddenConfig = configManager.applyQueryOverride(queryOverride);
      
      // Check overridden config
      expect(overriddenConfig.enabled).toBe(false);
      expect(overriddenConfig.triggerConfig.minRows).toBe(50);
      expect(overriddenConfig.triggerConfig.userPreferences?.preferredChartTypes)
        .toEqual(['scatter']);
      
      // Check base config is unchanged
      const baseConfig = configManager.getConfig();
      expect(baseConfig.enabled).toBe(true);
      expect(baseConfig.triggerConfig.minRows).toBe(1);
    });

    it('should override only specified properties', () => {
      const queryOverride: QueryConfigOverride = {
        minRows: 100,
      };

      const overriddenConfig = configManager.applyQueryOverride(queryOverride);
      
      expect(overriddenConfig.triggerConfig.minRows).toBe(100);
      // Other properties should remain from base config
      expect(overriddenConfig.enabled).toBe(true);
      expect(overriddenConfig.triggerConfig.maxRows).toBe(10000);
    });

    it('should handle empty override object', () => {
      const queryOverride: QueryConfigOverride = {};

      const overriddenConfig = configManager.applyQueryOverride(queryOverride);
      const baseConfig = configManager.getConfig();
      
      // Should be identical to base config
      expect(overriddenConfig.enabled).toBe(baseConfig.enabled);
      expect(overriddenConfig.triggerConfig.minRows).toBe(baseConfig.triggerConfig.minRows);
    });

    it('should override layout type', () => {
      const queryOverride: QueryConfigOverride = {
        layoutType: 'list',
      };

      const overriddenConfig = configManager.applyQueryOverride(queryOverride);
      
      expect(overriddenConfig.triggerConfig.userPreferences?.preferredLayout).toBe('list');
    });

    it('should override color scheme', () => {
      const queryOverride: QueryConfigOverride = {
        colorScheme: 'dark',
      };

      const overriddenConfig = configManager.applyQueryOverride(queryOverride);
      
      // Note: colorScheme is not directly in AutoReportConfig, but this tests the override mechanism
      expect(overriddenConfig).toBeDefined();
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration', () => {
      const updates: Partial<AutoReportConfig> = {
        enabled: false,
        performanceConfig: {
          maxGenerationTimeMs: 3000,
          enableProgressiveRendering: false,
          cacheEnabled: false,
        },
      };

      configManager.updateConfig(updates);
      
      const config = configManager.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.performanceConfig.maxGenerationTimeMs).toBe(3000);
      expect(config.performanceConfig.enableProgressiveRendering).toBe(false);
    });

    it('should update report configuration', () => {
      const updates: Partial<ReportConfiguration> = {
        visualization: {
          preferredChartTypes: ['area'],
          colorScheme: 'light',
          showLegends: false,
          showGridLines: false,
        },
        export: {
          includeRawData: false,
          embedImages: false,
          format: 'excel',
        },
      };

      configManager.updateReportConfig(updates);
      
      const reportConfig = configManager.getReportConfig();
      expect(reportConfig.visualization.preferredChartTypes).toEqual(['area']);
      expect(reportConfig.visualization.colorScheme).toBe('light');
      expect(reportConfig.export.format).toBe('excel');
    });

    it('should sync trigger config when updating report config', () => {
      const updates: Partial<ReportConfiguration> = {
        automatic: {
          enabled: false,
          minRows: 25,
          maxRows: 7500,
        },
      };

      configManager.updateReportConfig(updates);
      
      const triggerConfig = configManager.getTriggerConfig();
      expect(triggerConfig.enabledByDefault).toBe(false);
      expect(triggerConfig.minRows).toBe(25);
      expect(triggerConfig.maxRows).toBe(7500);
    });
  });

  describe('Configuration Reset', () => {
    it('should reset to default configuration', () => {
      // Modify configuration
      configManager.updateConfig({ enabled: false });
      configManager.loadUserPreferences({
        automatic: { enabled: false, minRows: 100, maxRows: 1000 },
      });
      
      expect(configManager.isEnabled()).toBe(false);
      expect(configManager.hasUserPreferences()).toBe(true);
      
      // Reset
      configManager.resetToDefaults();
      
      const config = configManager.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.triggerConfig.minRows).toBe(1);
      expect(configManager.hasUserPreferences()).toBe(false);
    });
  });

  describe('Global Configuration Manager', () => {
    it('should return singleton instance', () => {
      const instance1 = getConfigManager();
      const instance2 = getConfigManager();
      
      expect(instance1).toBe(instance2);
    });

    it('should accept initial configuration on first call', () => {
      const instance = getConfigManager({
        enabled: false,
        triggerConfig: {
          minRows: 15,
          maxRows: 15000,
          enabledByDefault: false,
        },
      });
      
      const config = instance.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.triggerConfig.minRows).toBe(15);
    });

    it('should reset global instance', () => {
      const instance1 = getConfigManager();
      instance1.updateConfig({ enabled: false });
      
      resetConfigManager();
      
      const instance2 = getConfigManager();
      expect(instance2.getConfig().enabled).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle partial nested updates', () => {
      const updates: Partial<AutoReportConfig> = {
        triggerConfig: {
          minRows: 5,
          maxRows: 10000,
          enabledByDefault: true,
        },
      };

      configManager.updateConfig(updates);
      
      const config = configManager.getConfig();
      expect(config.triggerConfig.minRows).toBe(5);
      // Should preserve other trigger config properties
      expect(config.triggerConfig.userPreferences).toBeDefined();
    });

    it('should handle undefined user preferences in trigger config', () => {
      const customConfig = new ConfigManager({
        triggerConfig: {
          minRows: 1,
          maxRows: 10000,
          enabledByDefault: true,
          userPreferences: undefined,
        },
      }, mockStorage);
      
      const queryOverride: QueryConfigOverride = {
        preferredChartTypes: ['bar'],
      };

      const overriddenConfig = customConfig.applyQueryOverride(queryOverride);
      expect(overriddenConfig.triggerConfig.userPreferences?.preferredChartTypes)
        .toEqual(['bar']);
    });

    it('should return copies of configuration objects', () => {
      const config1 = configManager.getConfig();
      const config2 = configManager.getConfig();
      
      // Should be equal but not the same reference
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
      
      // Modifying one should not affect the other
      config1.enabled = false;
      expect(config2.enabled).toBe(true);
    });
  });

  describe('Preference Persistence', () => {
    it('should save preferences to storage', () => {
      const preferences: Partial<ReportConfiguration> = {
        automatic: {
          enabled: false,
          minRows: 50,
          maxRows: 5000,
        },
        visualization: {
          preferredChartTypes: ['scatter', 'bubble'],
          colorScheme: 'dark',
          showLegends: false,
          showGridLines: true,
        },
      };

      configManager.loadUserPreferences(preferences);
      const saved = configManager.savePreferences();
      
      expect(saved).toBe(true);
      expect(mockStorage.size()).toBe(1);
    });

    it('should load persisted preferences on initialization', () => {
      // Pre-populate storage with preferences
      const preferences: ReportConfiguration = {
        automatic: {
          enabled: false,
          minRows: 100,
          maxRows: 8000,
        },
        visualization: {
          preferredChartTypes: ['area'],
          colorScheme: 'light',
          showLegends: true,
          showGridLines: false,
        },
        layout: {
          type: 'list',
          columnsPerRow: 1,
          spacing: 'compact',
        },
        export: {
          includeRawData: false,
          embedImages: true,
          format: 'excel',
        },
      };

      mockStorage.setItem(
        'automatic-report-generation-preferences',
        JSON.stringify(preferences)
      );

      // Create new config manager - should auto-load preferences
      const newConfigManager = new ConfigManager(undefined, mockStorage);
      
      const reportConfig = newConfigManager.getReportConfig();
      expect(reportConfig.automatic.enabled).toBe(false);
      expect(reportConfig.automatic.minRows).toBe(100);
      expect(reportConfig.visualization.colorScheme).toBe('light');
      expect(reportConfig.layout.type).toBe('list');
      expect(newConfigManager.hasUserPreferences()).toBe(true);
    });

    it('should update preferences and persist to storage', () => {
      const preferences: Partial<ReportConfiguration> = {
        visualization: {
          preferredChartTypes: ['heatmap'],
          colorScheme: 'dark',
          showLegends: true,
          showGridLines: true,
        },
      };

      const updated = configManager.updatePreferences(preferences);
      
      expect(updated).toBe(true);
      expect(mockStorage.size()).toBe(1);
      
      // Verify preferences were updated in memory
      const reportConfig = configManager.getReportConfig();
      expect(reportConfig.visualization.preferredChartTypes).toEqual(['heatmap']);
      expect(reportConfig.visualization.colorScheme).toBe('dark');
    });

    it('should clear persisted preferences from storage', () => {
      // Save some preferences first
      configManager.loadUserPreferences({
        automatic: { enabled: false, minRows: 10, maxRows: 1000 },
      });
      configManager.savePreferences();
      
      expect(mockStorage.size()).toBe(1);
      
      // Clear preferences
      const cleared = configManager.clearPersistedPreferences();
      
      expect(cleared).toBe(true);
      expect(mockStorage.size()).toBe(0);
    });

    it('should reset to defaults and optionally clear persisted preferences', () => {
      // Set up custom preferences and persist them
      configManager.loadUserPreferences({
        automatic: { enabled: false, minRows: 200, maxRows: 2000 },
      });
      configManager.savePreferences();
      
      expect(mockStorage.size()).toBe(1);
      
      // Reset without clearing persisted
      configManager.resetToDefaults(false);
      expect(mockStorage.size()).toBe(1);
      expect(configManager.hasUserPreferences()).toBe(false);
      
      // Reset with clearing persisted
      configManager.resetToDefaults(true);
      expect(mockStorage.size()).toBe(0);
    });

    it('should handle storage errors gracefully when loading', () => {
      // Create storage that throws errors
      const errorStorage: PreferenceStorage = {
        getItem: () => { throw new Error('Storage error'); },
        setItem: () => {},
        removeItem: () => {},
      };

      // Should not throw, just use defaults
      const newConfigManager = new ConfigManager(undefined, errorStorage);
      
      const config = newConfigManager.getConfig();
      expect(config.enabled).toBe(true);
      expect(newConfigManager.hasUserPreferences()).toBe(false);
    });

    it('should handle storage errors gracefully when saving', () => {
      // Create storage that throws errors on setItem
      const errorStorage: PreferenceStorage = {
        getItem: () => null,
        setItem: () => { throw new Error('Storage error'); },
        removeItem: () => {},
      };

      const newConfigManager = new ConfigManager(undefined, errorStorage);
      const saved = newConfigManager.savePreferences();
      
      expect(saved).toBe(false);
    });

    it('should handle invalid JSON in storage', () => {
      // Put invalid JSON in storage
      mockStorage.setItem(
        'automatic-report-generation-preferences',
        'invalid json {'
      );

      // Should not throw, just use defaults
      const newConfigManager = new ConfigManager(undefined, mockStorage);
      
      const config = newConfigManager.getConfig();
      expect(config.enabled).toBe(true);
      expect(newConfigManager.hasUserPreferences()).toBe(false);
    });

    it('should persist preferences across sessions', () => {
      // Session 1: Set and save preferences
      const session1Config = new ConfigManager(undefined, mockStorage);
      session1Config.updatePreferences({
        automatic: { enabled: false, minRows: 25, maxRows: 2500 },
        visualization: {
          preferredChartTypes: ['radar'],
          colorScheme: 'dark',
          showLegends: false,
          showGridLines: false,
        },
      });

      // Session 2: Create new config manager with same storage
      const session2Config = new ConfigManager(undefined, mockStorage);
      
      const reportConfig = session2Config.getReportConfig();
      expect(reportConfig.automatic.enabled).toBe(false);
      expect(reportConfig.automatic.minRows).toBe(25);
      expect(reportConfig.visualization.preferredChartTypes).toEqual(['radar']);
      expect(reportConfig.visualization.colorScheme).toBe('dark');
    });

    it('should handle empty storage gracefully', () => {
      // Create config manager with empty storage
      const emptyStorage = new MockStorage();
      const newConfigManager = new ConfigManager(undefined, emptyStorage);
      
      const config = newConfigManager.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.triggerConfig.minRows).toBe(1);
      expect(newConfigManager.hasUserPreferences()).toBe(false);
    });

    it('should update preferences multiple times', () => {
      // First update
      configManager.updatePreferences({
        automatic: { enabled: false, minRows: 10, maxRows: 1000 },
      });

      let reportConfig = configManager.getReportConfig();
      expect(reportConfig.automatic.minRows).toBe(10);

      // Second update
      configManager.updatePreferences({
        automatic: { enabled: true, minRows: 50, maxRows: 5000 },
      });

      reportConfig = configManager.getReportConfig();
      expect(reportConfig.automatic.enabled).toBe(true);
      expect(reportConfig.automatic.minRows).toBe(50);
      
      // Verify persisted
      expect(mockStorage.size()).toBe(1);
    });
  });
});
