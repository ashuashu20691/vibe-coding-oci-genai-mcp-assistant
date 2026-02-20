/**
 * Unit tests for SettingsModal component
 * Task 11.1: Create SettingsModal component
 * Task 11.2: Implement SQLcl path configuration
 * Validates: Requirements 9.1 - Settings panel accessible from header
 * Validates: Requirements 9.2 - Settings panel allows configuring SQLcl executable path
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { 
  SettingsModal, 
  SettingsButton, 
  validateSqlclPath,
  applyTheme,
  getStoredTheme,
  saveTheme,
  initializeTheme,
  THEME_STORAGE_KEY,
  type Theme
} from '@/components/SettingsModal';

describe('Task 11.1: SettingsModal Component', () => {
  beforeEach(() => {
    // Reset body overflow style before each test
    document.body.style.overflow = '';
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
  });

  describe('SettingsModal Component', () => {
    describe('rendering', () => {
      it('should not render when isOpen is false', () => {
        const { container } = render(
          <SettingsModal isOpen={false} onClose={() => {}} />
        );

        expect(container.querySelector('.settings-modal')).toBeFalsy();
      });

      it('should render when isOpen is true', () => {
        const { container } = render(
          <SettingsModal isOpen={true} onClose={() => {}} />
        );

        expect(container.querySelector('.settings-modal')).toBeTruthy();
      });

      it('should display Settings title', () => {
        render(<SettingsModal isOpen={true} onClose={() => {}} />);

        expect(screen.getByText('Settings')).toBeTruthy();
      });

      it('should render all three tabs', () => {
        render(<SettingsModal isOpen={true} onClose={() => {}} />);

        expect(screen.getByText('General')).toBeTruthy();
        expect(screen.getByText('Database')).toBeTruthy();
        expect(screen.getByText('Appearance')).toBeTruthy();
      });

      it('should show General tab content by default', () => {
        render(<SettingsModal isOpen={true} onClose={() => {}} />);

        expect(screen.getByText('General Settings')).toBeTruthy();
      });
    });

    describe('tab navigation', () => {
      it('should switch to Database tab when clicked', () => {
        render(<SettingsModal isOpen={true} onClose={() => {}} />);

        fireEvent.click(screen.getByText('Database'));

        expect(screen.getByText('Database Configuration')).toBeTruthy();
        expect(screen.queryByText('General Settings')).toBeFalsy();
      });

      it('should switch to Appearance tab when clicked', () => {
        render(<SettingsModal isOpen={true} onClose={() => {}} />);

        fireEvent.click(screen.getByText('Appearance'));

        // Check for the Appearance heading (not the tab label)
        const headings = screen.getAllByText('Appearance');
        expect(headings.length).toBeGreaterThan(1); // Tab + heading
        expect(screen.queryByText('General Settings')).toBeFalsy();
      });

      it('should switch back to General tab when clicked', () => {
        render(<SettingsModal isOpen={true} onClose={() => {}} />);

        // Switch to Database first
        fireEvent.click(screen.getByText('Database'));
        expect(screen.getByText('Database Configuration')).toBeTruthy();

        // Switch back to General
        fireEvent.click(screen.getByText('General'));
        expect(screen.getByText('General Settings')).toBeTruthy();
      });
    });

    describe('closing behavior', () => {
      it('should call onClose when close button is clicked', () => {
        const onClose = vi.fn();
        const { container } = render(
          <SettingsModal isOpen={true} onClose={onClose} />
        );

        const closeBtn = container.querySelector('.settings-close-btn');
        expect(closeBtn).toBeTruthy();
        fireEvent.click(closeBtn!);
        expect(onClose).toHaveBeenCalledTimes(1);
      });

      it('should call onClose when backdrop is clicked', () => {
        const onClose = vi.fn();
        const { container } = render(
          <SettingsModal isOpen={true} onClose={onClose} />
        );

        const backdrop = container.querySelector('.settings-modal-backdrop');
        expect(backdrop).toBeTruthy();
        fireEvent.click(backdrop!);
        expect(onClose).toHaveBeenCalledTimes(1);
      });

      it('should not call onClose when modal content is clicked', () => {
        const onClose = vi.fn();
        const { container } = render(
          <SettingsModal isOpen={true} onClose={onClose} />
        );

        const modal = container.querySelector('.settings-modal');
        expect(modal).toBeTruthy();
        fireEvent.click(modal!);
        expect(onClose).not.toHaveBeenCalled();
      });

      it('should call onClose when Escape key is pressed', () => {
        const onClose = vi.fn();
        render(<SettingsModal isOpen={true} onClose={onClose} />);

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
      });

      it('should not call onClose for other keys', () => {
        const onClose = vi.fn();
        render(<SettingsModal isOpen={true} onClose={onClose} />);

        fireEvent.keyDown(document, { key: 'Enter' });
        fireEvent.keyDown(document, { key: 'a' });
        expect(onClose).not.toHaveBeenCalled();
      });
    });

    describe('body scroll prevention', () => {
      it('should prevent body scroll when modal is open', () => {
        render(<SettingsModal isOpen={true} onClose={() => {}} />);

        expect(document.body.style.overflow).toBe('hidden');
      });

      it('should restore body scroll when modal is closed', () => {
        const { rerender } = render(
          <SettingsModal isOpen={true} onClose={() => {}} />
        );

        expect(document.body.style.overflow).toBe('hidden');

        rerender(<SettingsModal isOpen={false} onClose={() => {}} />);

        expect(document.body.style.overflow).toBe('');
      });
    });

    describe('tab content placeholders', () => {
      it('should show default model placeholder in General tab', () => {
        render(<SettingsModal isOpen={true} onClose={() => {}} />);

        expect(screen.getByText('Default Model')).toBeTruthy();
      });

      it('should show SQLcl path placeholder in Database tab', () => {
        render(<SettingsModal isOpen={true} onClose={() => {}} />);

        fireEvent.click(screen.getByText('Database'));

        expect(screen.getByText('SQLcl Path')).toBeTruthy();
        expect(screen.getByText('OCI Configuration Status')).toBeTruthy();
      });

      it('should show theme placeholder in Appearance tab', () => {
        render(<SettingsModal isOpen={true} onClose={() => {}} />);

        fireEvent.click(screen.getByText('Appearance'));

        expect(screen.getByText('Theme')).toBeTruthy();
      });
    });
  });

  describe('SettingsButton Component', () => {
    it('should render the settings button', () => {
      const { container } = render(<SettingsButton onClick={() => {}} />);

      expect(container.querySelector('.settings-btn')).toBeTruthy();
    });

    it('should call onClick when clicked', () => {
      const onClick = vi.fn();
      const { container } = render(<SettingsButton onClick={onClick} />);

      const button = container.querySelector('.settings-btn');
      expect(button).toBeTruthy();
      fireEvent.click(button!);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should have accessible label', () => {
      const { container } = render(<SettingsButton onClick={() => {}} />);

      const button = container.querySelector('.settings-btn');
      expect(button).toBeTruthy();
      expect(button?.getAttribute('aria-label')).toBe('Open settings');
      expect(button?.getAttribute('title')).toBe('Settings');
    });

    it('should apply custom className', () => {
      const { container } = render(
        <SettingsButton onClick={() => {}} className="custom-class" />
      );

      const button = container.querySelector('.settings-btn');
      expect(button).toBeTruthy();
      expect(button?.classList.contains('custom-class')).toBe(true);
    });
  });
});


describe('Task 11.2: SQLcl Path Configuration', () => {
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
      get store() {
        return store;
      },
      reset: () => {
        store = {};
      }
    };
  })();

  beforeEach(() => {
    localStorageMock.reset();
    vi.clearAllMocks();
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('validateSqlclPath function', () => {
    it('should return error for empty string', () => {
      expect(validateSqlclPath('')).toBe('SQLcl path is required');
    });

    it('should return error for whitespace-only string', () => {
      expect(validateSqlclPath('   ')).toBe('SQLcl path is required');
    });

    it('should return null for valid Unix path', () => {
      expect(validateSqlclPath('/usr/local/bin/sql')).toBeNull();
    });

    it('should return null for valid Windows path', () => {
      expect(validateSqlclPath('C:\\sqlcl\\bin\\sql.exe')).toBeNull();
    });

    it('should return null for path with tilde', () => {
      expect(validateSqlclPath('~/sqlcl/bin/sql')).toBeNull();
    });

    it('should return null for relative path', () => {
      expect(validateSqlclPath('sqlcl/bin/sql')).toBeNull();
    });

    it('should return null for simple filename', () => {
      expect(validateSqlclPath('sql')).toBeNull();
    });

    it('should return error for path with invalid characters', () => {
      expect(validateSqlclPath('/path/to/<invalid>')).toBe('Path contains invalid characters');
      expect(validateSqlclPath('/path/to/file?name')).toBe('Path contains invalid characters');
      expect(validateSqlclPath('/path/to/file*')).toBe('Path contains invalid characters');
    });

    it('should return null for path with spaces', () => {
      expect(validateSqlclPath('/path/to/my folder/sql')).toBeNull();
    });

    it('should return null for path with dots', () => {
      expect(validateSqlclPath('/path/to/../sql')).toBeNull();
    });
  });

  describe('SQLcl Path Input Field', () => {
    it('should render SQLcl path input in Database tab', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Database'));
      
      const input = screen.getByTestId('sqlcl-path-input');
      expect(input).toBeTruthy();
      expect(input.getAttribute('type')).toBe('text');
    });

    it('should have proper label and description', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Database'));
      
      expect(screen.getByText('SQLcl Path')).toBeTruthy();
      expect(screen.getByText(/Path to the SQLcl executable/)).toBeTruthy();
    });

    it('should have placeholder text', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Database'));
      
      const input = screen.getByTestId('sqlcl-path-input') as HTMLInputElement;
      expect(input.placeholder).toBe('/path/to/sqlcl/bin/sql');
    });

    it('should update value when typing', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Database'));
      
      const input = screen.getByTestId('sqlcl-path-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '/usr/local/bin/sql' } });
      
      expect(input.value).toBe('/usr/local/bin/sql');
    });

    it('should load initial value from localStorage', () => {
      localStorageMock.store['settings.sqlclPath'] = '/saved/path/to/sql';
      
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Database'));
      
      const input = screen.getByTestId('sqlcl-path-input') as HTMLInputElement;
      expect(input.value).toBe('/saved/path/to/sql');
    });
  });

  describe('SQLcl Path Validation', () => {
    it('should not show error before field is touched', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Database'));
      
      expect(screen.queryByTestId('sqlcl-path-error')).toBeFalsy();
    });

    it('should show error after blur with empty value', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Database'));
      
      const input = screen.getByTestId('sqlcl-path-input');
      fireEvent.blur(input);
      
      expect(screen.getByTestId('sqlcl-path-error')).toBeTruthy();
      expect(screen.getByText('SQLcl path is required')).toBeTruthy();
    });

    it('should show error for invalid path characters', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Database'));
      
      const input = screen.getByTestId('sqlcl-path-input');
      fireEvent.change(input, { target: { value: '/path/<invalid>' } });
      fireEvent.blur(input);
      
      expect(screen.getByText('Path contains invalid characters')).toBeTruthy();
    });

    it('should clear error when valid path is entered', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Database'));
      
      const input = screen.getByTestId('sqlcl-path-input');
      
      // First trigger error
      fireEvent.blur(input);
      expect(screen.getByTestId('sqlcl-path-error')).toBeTruthy();
      
      // Then enter valid path
      fireEvent.change(input, { target: { value: '/usr/local/bin/sql' } });
      fireEvent.blur(input);
      
      expect(screen.queryByTestId('sqlcl-path-error')).toBeFalsy();
    });

    it('should have aria-invalid attribute when error is shown', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Database'));
      
      const input = screen.getByTestId('sqlcl-path-input');
      fireEvent.blur(input);
      
      expect(input.getAttribute('aria-invalid')).toBe('true');
    });

    it('should have aria-describedby pointing to error message', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Database'));
      
      const input = screen.getByTestId('sqlcl-path-input');
      fireEvent.blur(input);
      
      expect(input.getAttribute('aria-describedby')).toBe('sqlcl-path-error');
    });
  });

  describe('SQLcl Path Persistence', () => {
    it('should save valid path to localStorage on blur', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Database'));
      
      const input = screen.getByTestId('sqlcl-path-input');
      fireEvent.change(input, { target: { value: '/usr/local/bin/sql' } });
      fireEvent.blur(input);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'settings.sqlclPath',
        '/usr/local/bin/sql'
      );
    });

    it('should not save invalid path to localStorage', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Database'));
      
      const input = screen.getByTestId('sqlcl-path-input');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);
      
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('should trim whitespace before saving', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Database'));
      
      const input = screen.getByTestId('sqlcl-path-input');
      fireEvent.change(input, { target: { value: '  /usr/local/bin/sql  ' } });
      fireEvent.blur(input);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'settings.sqlclPath',
        '/usr/local/bin/sql'
      );
    });
  });
});


describe('Task 11.3: Default Model Configuration', () => {
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
      get store() {
        return store;
      },
      reset: () => {
        store = {};
      }
    };
  })();

  const mockModels = [
    { id: 'cohere.command-r-plus', name: 'Command R+', description: 'Cohere flagship model' },
    { id: 'cohere.command-r', name: 'Command R', description: 'Cohere standard model' },
    { id: 'meta.llama-3.1-70b', name: 'Llama 3.1 70B', description: 'Meta large model' },
    { id: 'google.gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Google fast model' },
    { id: 'xai.grok-3', name: 'Grok 3', description: 'xAI model' },
  ];

  beforeEach(() => {
    localStorageMock.reset();
    vi.clearAllMocks();
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    
    // Mock fetch for models API
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockModels),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('Default Model Selector Rendering', () => {
    it('should render default model selector in General tab', async () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      // Wait for models to load
      await screen.findByTestId('default-model-selector');
      
      expect(screen.getByText('Default Model')).toBeTruthy();
      expect(screen.getByTestId('default-model-selector')).toBeTruthy();
    });

    it('should show loading state while fetching models', () => {
      // Make fetch hang
      global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));
      
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      expect(screen.getByTestId('default-model-loading')).toBeTruthy();
    });

    it('should show error state when fetch fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      await screen.findByTestId('default-model-error');
      
      // The error message shows the actual error from the fetch
      expect(screen.getByText(/Network error/)).toBeTruthy();
    });

    it('should show placeholder text when no model is selected', async () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      await screen.findByTestId('default-model-selector');
      
      expect(screen.getByText('Select a default model...')).toBeTruthy();
    });
  });

  describe('Default Model Dropdown', () => {
    it('should open dropdown when selector is clicked', async () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      const selector = await screen.findByTestId('default-model-selector');
      fireEvent.click(selector);
      
      expect(screen.getByTestId('default-model-dropdown')).toBeTruthy();
    });

    it('should display models grouped by provider', async () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      const selector = await screen.findByTestId('default-model-selector');
      fireEvent.click(selector);
      
      // Check provider headers
      expect(screen.getByText('Cohere')).toBeTruthy();
      expect(screen.getByText('Meta')).toBeTruthy();
      expect(screen.getByText('Google')).toBeTruthy();
      expect(screen.getByText('xAI')).toBeTruthy();
    });

    it('should display model names in dropdown', async () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      const selector = await screen.findByTestId('default-model-selector');
      fireEvent.click(selector);
      
      expect(screen.getByText('Command R+')).toBeTruthy();
      expect(screen.getByText('Llama 3.1 70B')).toBeTruthy();
      expect(screen.getByText('Gemini 2.5 Flash')).toBeTruthy();
      expect(screen.getByText('Grok 3')).toBeTruthy();
    });

    it('should close dropdown when clicking outside', async () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      const selector = await screen.findByTestId('default-model-selector');
      fireEvent.click(selector);
      
      expect(screen.getByTestId('default-model-dropdown')).toBeTruthy();
      
      // Click outside (on the modal backdrop area)
      fireEvent.mouseDown(document.body);
      
      expect(screen.queryByTestId('default-model-dropdown')).toBeFalsy();
    });
  });

  describe('Default Model Selection', () => {
    it('should select model when clicked in dropdown', async () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      const selector = await screen.findByTestId('default-model-selector');
      fireEvent.click(selector);
      
      const modelOption = screen.getByTestId('default-model-option-google.gemini-2.5-flash');
      fireEvent.click(modelOption);
      
      // Dropdown should close and show selected model
      expect(screen.queryByTestId('default-model-dropdown')).toBeFalsy();
      expect(screen.getByText('Gemini 2.5 Flash')).toBeTruthy();
    });

    it('should save selected model to localStorage', async () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      const selector = await screen.findByTestId('default-model-selector');
      fireEvent.click(selector);
      
      const modelOption = screen.getByTestId('default-model-option-cohere.command-r-plus');
      fireEvent.click(modelOption);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'settings.defaultModel',
        'cohere.command-r-plus'
      );
    });

    it('should load saved model from localStorage on mount', async () => {
      localStorageMock.store['settings.defaultModel'] = 'meta.llama-3.1-70b';
      
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      await screen.findByTestId('default-model-selector');
      
      expect(screen.getByText('Llama 3.1 70B')).toBeTruthy();
    });

    it('should show checkmark for selected model in dropdown', async () => {
      localStorageMock.store['settings.defaultModel'] = 'xai.grok-3';
      
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      const selector = await screen.findByTestId('default-model-selector');
      fireEvent.click(selector);
      
      const selectedOption = screen.getByTestId('default-model-option-xai.grok-3');
      // Check that the option has the checkmark SVG
      expect(selectedOption.querySelector('svg')).toBeTruthy();
    });
  });

  describe('Clear Default Model', () => {
    it('should show clear button when model is selected', async () => {
      localStorageMock.store['settings.defaultModel'] = 'google.gemini-2.5-flash';
      
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      await screen.findByTestId('default-model-selector');
      
      expect(screen.getByTestId('clear-default-model')).toBeTruthy();
    });

    it('should not show clear button when no model is selected', async () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      await screen.findByTestId('default-model-selector');
      
      expect(screen.queryByTestId('clear-default-model')).toBeFalsy();
    });

    it('should clear selection when clear button is clicked', async () => {
      localStorageMock.store['settings.defaultModel'] = 'google.gemini-2.5-flash';
      
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      await screen.findByTestId('default-model-selector');
      
      const clearButton = screen.getByTestId('clear-default-model');
      fireEvent.click(clearButton);
      
      expect(screen.getByText('Select a default model...')).toBeTruthy();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('settings.defaultModel');
    });

    it('should not open dropdown when clear button is clicked', async () => {
      localStorageMock.store['settings.defaultModel'] = 'google.gemini-2.5-flash';
      
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      await screen.findByTestId('default-model-selector');
      
      const clearButton = screen.getByTestId('clear-default-model');
      fireEvent.click(clearButton);
      
      expect(screen.queryByTestId('default-model-dropdown')).toBeFalsy();
    });
  });

  describe('Provider Icons', () => {
    it('should show provider icon for selected model', async () => {
      localStorageMock.store['settings.defaultModel'] = 'google.gemini-2.5-flash';
      
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      const selector = await screen.findByTestId('default-model-selector');
      
      // Google icon is 🔵
      expect(selector.textContent).toContain('🔵');
    });
  });
});


describe('Task 11.4: Theme Toggle', () => {
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
      get store() {
        return store;
      },
      reset: () => {
        store = {};
      }
    };
  })();

  beforeEach(() => {
    localStorageMock.reset();
    vi.clearAllMocks();
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    
    // Reset document root classes
    document.documentElement.classList.remove('light', 'dark');
    
    // Mock fetch for models API (needed for General tab)
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });

  afterEach(() => {
    cleanup();
    document.documentElement.classList.remove('light', 'dark');
    vi.restoreAllMocks();
  });

  describe('Theme Options Rendering', () => {
    it('should render theme options in Appearance tab', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Appearance'));
      
      expect(screen.getByTestId('theme-option-light')).toBeTruthy();
      expect(screen.getByTestId('theme-option-dark')).toBeTruthy();
      expect(screen.getByTestId('theme-option-system')).toBeTruthy();
    });

    it('should display Light theme option with correct label and description', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Appearance'));
      
      expect(screen.getByText('Light')).toBeTruthy();
      expect(screen.getByText('Always use light theme')).toBeTruthy();
    });

    it('should display Dark theme option with correct label and description', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Appearance'));
      
      expect(screen.getByText('Dark')).toBeTruthy();
      expect(screen.getByText('Always use dark theme')).toBeTruthy();
    });

    it('should display System theme option with correct label and description', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Appearance'));
      
      expect(screen.getByText('System')).toBeTruthy();
      expect(screen.getByText('Follow your system preference')).toBeTruthy();
    });

    it('should have proper ARIA attributes for radiogroup', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Appearance'));
      
      const radiogroup = screen.getByRole('radiogroup');
      expect(radiogroup).toBeTruthy();
      expect(radiogroup.getAttribute('aria-label')).toBe('Theme selection');
    });

    it('should have proper ARIA attributes for radio buttons', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Appearance'));
      
      const lightOption = screen.getByTestId('theme-option-light');
      expect(lightOption.getAttribute('role')).toBe('radio');
    });
  });

  describe('Theme Selection', () => {
    it('should default to system theme when no preference is stored', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Appearance'));
      
      const systemOption = screen.getByTestId('theme-option-system');
      expect(systemOption.getAttribute('aria-checked')).toBe('true');
    });

    it('should select light theme when clicked', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Appearance'));
      
      const lightOption = screen.getByTestId('theme-option-light');
      fireEvent.click(lightOption);
      
      expect(lightOption.getAttribute('aria-checked')).toBe('true');
    });

    it('should select dark theme when clicked', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Appearance'));
      
      const darkOption = screen.getByTestId('theme-option-dark');
      fireEvent.click(darkOption);
      
      expect(darkOption.getAttribute('aria-checked')).toBe('true');
    });

    it('should select system theme when clicked', () => {
      localStorageMock.store['settings.theme'] = 'dark';
      
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Appearance'));
      
      const systemOption = screen.getByTestId('theme-option-system');
      fireEvent.click(systemOption);
      
      expect(systemOption.getAttribute('aria-checked')).toBe('true');
    });

    it('should load saved theme from localStorage', () => {
      localStorageMock.store['settings.theme'] = 'dark';
      
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Appearance'));
      
      const darkOption = screen.getByTestId('theme-option-dark');
      expect(darkOption.getAttribute('aria-checked')).toBe('true');
    });
  });

  describe('Theme Persistence', () => {
    it('should save light theme to localStorage when selected', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Appearance'));
      
      const lightOption = screen.getByTestId('theme-option-light');
      fireEvent.click(lightOption);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('settings.theme', 'light');
    });

    it('should save dark theme to localStorage when selected', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Appearance'));
      
      const darkOption = screen.getByTestId('theme-option-dark');
      fireEvent.click(darkOption);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('settings.theme', 'dark');
    });

    it('should save system theme to localStorage when selected', () => {
      localStorageMock.store['settings.theme'] = 'dark';
      
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Appearance'));
      
      const systemOption = screen.getByTestId('theme-option-system');
      fireEvent.click(systemOption);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('settings.theme', 'system');
    });
  });

  describe('Theme Application to Document', () => {
    it('should add light class to document root when light theme is selected', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Appearance'));
      
      const lightOption = screen.getByTestId('theme-option-light');
      fireEvent.click(lightOption);
      
      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('should add dark class to document root when dark theme is selected', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Appearance'));
      
      const darkOption = screen.getByTestId('theme-option-dark');
      fireEvent.click(darkOption);
      
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('light')).toBe(false);
    });

    it('should remove theme classes when system theme is selected', () => {
      document.documentElement.classList.add('dark');
      
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Appearance'));
      
      const systemOption = screen.getByTestId('theme-option-system');
      fireEvent.click(systemOption);
      
      expect(document.documentElement.classList.contains('light')).toBe(false);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('should switch from light to dark theme correctly', () => {
      render(<SettingsModal isOpen={true} onClose={() => {}} />);
      
      fireEvent.click(screen.getByText('Appearance'));
      
      // Select light first
      const lightOption = screen.getByTestId('theme-option-light');
      fireEvent.click(lightOption);
      expect(document.documentElement.classList.contains('light')).toBe(true);
      
      // Then switch to dark
      const darkOption = screen.getByTestId('theme-option-dark');
      fireEvent.click(darkOption);
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('light')).toBe(false);
    });
  });
});


describe('Theme Utility Functions', () => {
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
      get store() {
        return store;
      },
      reset: () => {
        store = {};
      }
    };
  })();

  beforeEach(() => {
    localStorageMock.reset();
    vi.clearAllMocks();
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    
    // Reset document root classes
    document.documentElement.classList.remove('light', 'dark');
  });

  afterEach(() => {
    document.documentElement.classList.remove('light', 'dark');
  });

  describe('applyTheme', () => {
    it('should add light class for light theme', () => {
      applyTheme('light');
      
      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('should add dark class for dark theme', () => {
      applyTheme('dark');
      
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('light')).toBe(false);
    });

    it('should remove all theme classes for system theme', () => {
      document.documentElement.classList.add('dark');
      
      applyTheme('system');
      
      expect(document.documentElement.classList.contains('light')).toBe(false);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('should remove existing theme class before applying new one', () => {
      document.documentElement.classList.add('light');
      
      applyTheme('dark');
      
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('light')).toBe(false);
    });
  });

  describe('getStoredTheme', () => {
    it('should return system as default when no theme is stored', () => {
      expect(getStoredTheme()).toBe('system');
    });

    it('should return light when light is stored', () => {
      localStorageMock.store[THEME_STORAGE_KEY] = 'light';
      
      expect(getStoredTheme()).toBe('light');
    });

    it('should return dark when dark is stored', () => {
      localStorageMock.store[THEME_STORAGE_KEY] = 'dark';
      
      expect(getStoredTheme()).toBe('dark');
    });

    it('should return system when system is stored', () => {
      localStorageMock.store[THEME_STORAGE_KEY] = 'system';
      
      expect(getStoredTheme()).toBe('system');
    });

    it('should return system for invalid stored value', () => {
      localStorageMock.store[THEME_STORAGE_KEY] = 'invalid';
      
      expect(getStoredTheme()).toBe('system');
    });
  });

  describe('saveTheme', () => {
    it('should save light theme to localStorage', () => {
      saveTheme('light');
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'light');
    });

    it('should save dark theme to localStorage', () => {
      saveTheme('dark');
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'dark');
    });

    it('should save system theme to localStorage', () => {
      saveTheme('system');
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'system');
    });
  });

  describe('initializeTheme', () => {
    it('should apply stored light theme on initialization', () => {
      localStorageMock.store[THEME_STORAGE_KEY] = 'light';
      
      initializeTheme();
      
      expect(document.documentElement.classList.contains('light')).toBe(true);
    });

    it('should apply stored dark theme on initialization', () => {
      localStorageMock.store[THEME_STORAGE_KEY] = 'dark';
      
      initializeTheme();
      
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should not add any class for system theme on initialization', () => {
      localStorageMock.store[THEME_STORAGE_KEY] = 'system';
      
      initializeTheme();
      
      expect(document.documentElement.classList.contains('light')).toBe(false);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('should default to system theme when nothing is stored', () => {
      initializeTheme();
      
      expect(document.documentElement.classList.contains('light')).toBe(false);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });
});
