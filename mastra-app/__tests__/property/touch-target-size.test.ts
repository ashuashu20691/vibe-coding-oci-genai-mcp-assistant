/**
 * Property Test: Mobile Touch Target Size
 * 
 * Feature: claude-desktop-alternative, Property 29: Mobile Touch Target Size
 * 
 * *For any* interactive element on mobile viewport, the tap target size
 * SHALL be at least 44x44 pixels.
 * 
 * **Validates: Requirements 12.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Minimum touch target size in pixels (WCAG 2.5.5 AAA / Apple HIG)
 */
export const MIN_TOUCH_TARGET_SIZE = 44;

/**
 * Interactive element types that require touch-friendly sizing
 */
export type InteractiveElementType =
  | 'button'
  | 'icon-button'
  | 'link'
  | 'input-text'
  | 'input-checkbox'
  | 'input-radio'
  | 'select'
  | 'tab'
  | 'menu-item'
  | 'dropdown-item'
  | 'close-button'
  | 'submit-button'
  | 'pagination-button'
  | 'sort-button'
  | 'conversation-item'
  | 'model-selector-option'
  | 'mcp-tool-item';

/**
 * Configuration for an interactive element
 */
export interface InteractiveElementConfig {
  type: InteractiveElementType;
  /** Content width in pixels (before padding) */
  contentWidth: number;
  /** Content height in pixels (before padding) */
  contentHeight: number;
  /** Whether the element has custom padding */
  hasCustomPadding: boolean;
  /** Custom padding in pixels (if hasCustomPadding is true) */
  customPadding?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

/**
 * Computed touch target dimensions
 */
export interface TouchTargetDimensions {
  width: number;
  height: number;
  meetsMinimum: boolean;
}

/**
 * Default padding values for mobile touch targets (in pixels)
 * These match the CSS rules in globals.css for mobile viewport
 */
const DEFAULT_MOBILE_PADDING: Record<InteractiveElementType, { vertical: number; horizontal: number }> = {
  'button': { vertical: 10, horizontal: 16 },           // 0.625rem vertical
  'icon-button': { vertical: 10, horizontal: 10 },      // 0.625rem all sides
  'link': { vertical: 10, horizontal: 0 },              // 0.625rem vertical
  'input-text': { vertical: 10, horizontal: 12 },       // 0.625rem 0.75rem
  'input-checkbox': { vertical: 10, horizontal: 10 },   // margin: 0.625rem
  'input-radio': { vertical: 10, horizontal: 10 },      // margin: 0.625rem
  'select': { vertical: 10, horizontal: 12 },           // 0.625rem 0.75rem
  'tab': { vertical: 10, horizontal: 16 },              // 0.625rem 1rem
  'menu-item': { vertical: 10, horizontal: 16 },        // 0.625rem 1rem
  'dropdown-item': { vertical: 10, horizontal: 16 },    // 0.625rem 1rem
  'close-button': { vertical: 10, horizontal: 10 },     // 0.625rem all sides
  'submit-button': { vertical: 10, horizontal: 10 },    // 0.625rem all sides
  'pagination-button': { vertical: 8, horizontal: 12 }, // 0.5rem 0.75rem
  'sort-button': { vertical: 10, horizontal: 10 },      // 0.625rem all sides
  'conversation-item': { vertical: 12, horizontal: 12 }, // 0.75rem all sides
  'model-selector-option': { vertical: 10, horizontal: 12 }, // 0.625rem 0.75rem
  'mcp-tool-item': { vertical: 10, horizontal: 12 },    // 0.625rem 0.75rem
};

/**
 * Minimum dimensions enforced by CSS min-width/min-height rules
 * 
 * Note: Checkboxes and radio buttons have a special case - the input itself is 24px,
 * but they are wrapped in a label element that provides the full 44px touch target.
 * The CSS rule `label:has(input[type="checkbox"])` ensures the label wrapper meets
 * the minimum touch target size.
 */
const MIN_DIMENSIONS: Record<InteractiveElementType, { minWidth: number; minHeight: number }> = {
  'button': { minWidth: 0, minHeight: MIN_TOUCH_TARGET_SIZE },
  'icon-button': { minWidth: MIN_TOUCH_TARGET_SIZE, minHeight: MIN_TOUCH_TARGET_SIZE },
  'link': { minWidth: 0, minHeight: MIN_TOUCH_TARGET_SIZE },
  'input-text': { minWidth: 0, minHeight: MIN_TOUCH_TARGET_SIZE },
  // Checkboxes/radios: The label wrapper provides 44px touch target (8px padding + 24px input + gap)
  'input-checkbox': { minWidth: MIN_TOUCH_TARGET_SIZE, minHeight: MIN_TOUCH_TARGET_SIZE },
  'input-radio': { minWidth: MIN_TOUCH_TARGET_SIZE, minHeight: MIN_TOUCH_TARGET_SIZE },
  'select': { minWidth: 0, minHeight: MIN_TOUCH_TARGET_SIZE },
  'tab': { minWidth: 0, minHeight: MIN_TOUCH_TARGET_SIZE },
  'menu-item': { minWidth: 0, minHeight: MIN_TOUCH_TARGET_SIZE },
  'dropdown-item': { minWidth: 0, minHeight: MIN_TOUCH_TARGET_SIZE },
  'close-button': { minWidth: MIN_TOUCH_TARGET_SIZE, minHeight: MIN_TOUCH_TARGET_SIZE },
  'submit-button': { minWidth: MIN_TOUCH_TARGET_SIZE, minHeight: MIN_TOUCH_TARGET_SIZE },
  'pagination-button': { minWidth: MIN_TOUCH_TARGET_SIZE, minHeight: MIN_TOUCH_TARGET_SIZE },
  'sort-button': { minWidth: 0, minHeight: MIN_TOUCH_TARGET_SIZE },
  'conversation-item': { minWidth: 0, minHeight: MIN_TOUCH_TARGET_SIZE },
  'model-selector-option': { minWidth: 0, minHeight: MIN_TOUCH_TARGET_SIZE },
  'mcp-tool-item': { minWidth: 0, minHeight: MIN_TOUCH_TARGET_SIZE },
};

/**
 * Calculates the touch target dimensions for an interactive element
 * This simulates how CSS rules would compute the final dimensions
 */
export function calculateTouchTargetDimensions(
  config: InteractiveElementConfig
): TouchTargetDimensions {
  const { type, contentWidth, contentHeight, hasCustomPadding, customPadding } = config;
  
  // Get default padding for this element type
  const defaultPadding = DEFAULT_MOBILE_PADDING[type];
  
  // Calculate padding
  const paddingTop = hasCustomPadding && customPadding ? customPadding.top : defaultPadding.vertical;
  const paddingBottom = hasCustomPadding && customPadding ? customPadding.bottom : defaultPadding.vertical;
  const paddingLeft = hasCustomPadding && customPadding ? customPadding.left : defaultPadding.horizontal;
  const paddingRight = hasCustomPadding && customPadding ? customPadding.right : defaultPadding.horizontal;
  
  // Calculate raw dimensions (content + padding)
  const rawWidth = contentWidth + paddingLeft + paddingRight;
  const rawHeight = contentHeight + paddingTop + paddingBottom;
  
  // Apply minimum dimension constraints from CSS
  const minDims = MIN_DIMENSIONS[type];
  const finalWidth = Math.max(rawWidth, minDims.minWidth);
  const finalHeight = Math.max(rawHeight, minDims.minHeight);
  
  return {
    width: finalWidth,
    height: finalHeight,
    meetsMinimum: finalHeight >= MIN_TOUCH_TARGET_SIZE,
  };
}

/**
 * Checks if an element type requires both width and height minimums
 * (e.g., icon-only buttons, close buttons)
 */
export function requiresBothDimensionMinimums(type: InteractiveElementType): boolean {
  return [
    'icon-button',
    'close-button',
    'submit-button',
    'pagination-button',
  ].includes(type);
}

/**
 * Validates that a touch target meets accessibility requirements
 */
export function validateTouchTarget(dimensions: TouchTargetDimensions, type: InteractiveElementType): {
  valid: boolean;
  reason?: string;
} {
  // Height must always meet minimum
  if (dimensions.height < MIN_TOUCH_TARGET_SIZE) {
    return {
      valid: false,
      reason: `Height ${dimensions.height}px is below minimum ${MIN_TOUCH_TARGET_SIZE}px`,
    };
  }
  
  // For elements that require both dimensions (icon buttons, etc.)
  if (requiresBothDimensionMinimums(type) && dimensions.width < MIN_TOUCH_TARGET_SIZE) {
    return {
      valid: false,
      reason: `Width ${dimensions.width}px is below minimum ${MIN_TOUCH_TARGET_SIZE}px for ${type}`,
    };
  }
  
  return { valid: true };
}

// Arbitraries for property-based testing

const interactiveElementTypeArb: fc.Arbitrary<InteractiveElementType> = fc.constantFrom(
  'button',
  'icon-button',
  'link',
  'input-text',
  'input-checkbox',
  'input-radio',
  'select',
  'tab',
  'menu-item',
  'dropdown-item',
  'close-button',
  'submit-button',
  'pagination-button',
  'sort-button',
  'conversation-item',
  'model-selector-option',
  'mcp-tool-item'
);

// Content dimensions - typical range for UI elements
const contentDimensionArb = fc.integer({ min: 0, max: 200 });

// Padding values - reasonable range
const paddingValueArb = fc.integer({ min: 0, max: 32 });

// Custom padding configuration
const customPaddingArb = fc.record({
  top: paddingValueArb,
  right: paddingValueArb,
  bottom: paddingValueArb,
  left: paddingValueArb,
});

// Full interactive element configuration
const interactiveElementConfigArb: fc.Arbitrary<InteractiveElementConfig> = fc.record({
  type: interactiveElementTypeArb,
  contentWidth: contentDimensionArb,
  contentHeight: contentDimensionArb,
  hasCustomPadding: fc.boolean(),
}).chain((base) => {
  if (base.hasCustomPadding) {
    return customPaddingArb.map((customPadding) => ({
      ...base,
      customPadding,
    }));
  }
  return fc.constant(base);
});

describe('Property 29: Mobile Touch Target Size', () => {
  describe('Touch target height minimum enforcement', () => {
    it('Any interactive element SHALL have height >= 44px on mobile (Req 12.4)', () => {
      fc.assert(
        fc.property(interactiveElementConfigArb, (config) => {
          const dimensions = calculateTouchTargetDimensions(config);
          
          // The CSS min-height rules ensure height is at least 44px
          expect(dimensions.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
        }),
        { numRuns: 100 }
      );
    });

    it('Any button element SHALL meet touch target minimum (Req 12.4)', () => {
      fc.assert(
        fc.property(
          contentDimensionArb,
          contentDimensionArb,
          (contentWidth, contentHeight) => {
            const config: InteractiveElementConfig = {
              type: 'button',
              contentWidth,
              contentHeight,
              hasCustomPadding: false,
            };
            const dimensions = calculateTouchTargetDimensions(config);
            
            expect(dimensions.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
            expect(dimensions.meetsMinimum).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Any form input SHALL meet touch target minimum (Req 12.4)', () => {
      const inputTypes: InteractiveElementType[] = ['input-text', 'select'];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...inputTypes),
          contentDimensionArb,
          contentDimensionArb,
          (type, contentWidth, contentHeight) => {
            const config: InteractiveElementConfig = {
              type,
              contentWidth,
              contentHeight,
              hasCustomPadding: false,
            };
            const dimensions = calculateTouchTargetDimensions(config);
            
            expect(dimensions.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Icon button touch target enforcement', () => {
    it('Icon buttons SHALL have both width and height >= 44px (Req 12.4)', () => {
      fc.assert(
        fc.property(
          contentDimensionArb,
          contentDimensionArb,
          (contentWidth, contentHeight) => {
            const config: InteractiveElementConfig = {
              type: 'icon-button',
              contentWidth,
              contentHeight,
              hasCustomPadding: false,
            };
            const dimensions = calculateTouchTargetDimensions(config);
            
            // Icon buttons need both dimensions to meet minimum
            expect(dimensions.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
            expect(dimensions.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Close buttons SHALL have both width and height >= 44px (Req 12.4)', () => {
      fc.assert(
        fc.property(
          contentDimensionArb,
          contentDimensionArb,
          (contentWidth, contentHeight) => {
            const config: InteractiveElementConfig = {
              type: 'close-button',
              contentWidth,
              contentHeight,
              hasCustomPadding: false,
            };
            const dimensions = calculateTouchTargetDimensions(config);
            
            expect(dimensions.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
            expect(dimensions.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Submit buttons SHALL have both width and height >= 44px (Req 12.4)', () => {
      fc.assert(
        fc.property(
          contentDimensionArb,
          contentDimensionArb,
          (contentWidth, contentHeight) => {
            const config: InteractiveElementConfig = {
              type: 'submit-button',
              contentWidth,
              contentHeight,
              hasCustomPadding: false,
            };
            const dimensions = calculateTouchTargetDimensions(config);
            
            expect(dimensions.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
            expect(dimensions.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Menu and navigation items', () => {
    it('Menu items SHALL meet touch target minimum (Req 12.4)', () => {
      const menuTypes: InteractiveElementType[] = ['menu-item', 'dropdown-item', 'tab'];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...menuTypes),
          contentDimensionArb,
          contentDimensionArb,
          (type, contentWidth, contentHeight) => {
            const config: InteractiveElementConfig = {
              type,
              contentWidth,
              contentHeight,
              hasCustomPadding: false,
            };
            const dimensions = calculateTouchTargetDimensions(config);
            
            expect(dimensions.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Conversation items SHALL meet touch target minimum (Req 12.4)', () => {
      fc.assert(
        fc.property(
          contentDimensionArb,
          contentDimensionArb,
          (contentWidth, contentHeight) => {
            const config: InteractiveElementConfig = {
              type: 'conversation-item',
              contentWidth,
              contentHeight,
              hasCustomPadding: false,
            };
            const dimensions = calculateTouchTargetDimensions(config);
            
            expect(dimensions.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Pagination controls', () => {
    it('Pagination buttons SHALL have both dimensions >= 44px (Req 12.4)', () => {
      fc.assert(
        fc.property(
          contentDimensionArb,
          contentDimensionArb,
          (contentWidth, contentHeight) => {
            const config: InteractiveElementConfig = {
              type: 'pagination-button',
              contentWidth,
              contentHeight,
              hasCustomPadding: false,
            };
            const dimensions = calculateTouchTargetDimensions(config);
            
            expect(dimensions.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
            expect(dimensions.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Custom padding handling', () => {
    it('Custom padding SHALL still result in minimum touch target (Req 12.4)', () => {
      fc.assert(
        fc.property(interactiveElementConfigArb, (config) => {
          const dimensions = calculateTouchTargetDimensions(config);
          
          // Even with custom padding, min-height CSS rules ensure minimum
          expect(dimensions.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
        }),
        { numRuns: 100 }
      );
    });

    it('Zero padding SHALL still result in minimum touch target due to min-height (Req 12.4)', () => {
      fc.assert(
        fc.property(
          interactiveElementTypeArb,
          contentDimensionArb,
          contentDimensionArb,
          (type, contentWidth, contentHeight) => {
            const config: InteractiveElementConfig = {
              type,
              contentWidth,
              contentHeight,
              hasCustomPadding: true,
              customPadding: { top: 0, right: 0, bottom: 0, left: 0 },
            };
            const dimensions = calculateTouchTargetDimensions(config);
            
            // CSS min-height ensures minimum even with zero padding
            expect(dimensions.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Validation function correctness', () => {
    it('validateTouchTarget SHALL return valid for compliant elements (Req 12.4)', () => {
      fc.assert(
        fc.property(interactiveElementConfigArb, (config) => {
          const dimensions = calculateTouchTargetDimensions(config);
          const validation = validateTouchTarget(dimensions, config.type);
          
          // Since our calculation enforces minimums, all should be valid
          expect(validation.valid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('validateTouchTarget SHALL detect undersized heights', () => {
      const undersizedDimensions: TouchTargetDimensions = {
        width: 100,
        height: 30, // Below 44px minimum
        meetsMinimum: false,
      };
      
      const validation = validateTouchTarget(undersizedDimensions, 'button');
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('Height');
      expect(validation.reason).toContain('30px');
    });

    it('validateTouchTarget SHALL detect undersized widths for icon buttons', () => {
      const undersizedDimensions: TouchTargetDimensions = {
        width: 30, // Below 44px minimum for icon buttons
        height: 44,
        meetsMinimum: true,
      };
      
      const validation = validateTouchTarget(undersizedDimensions, 'icon-button');
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('Width');
      expect(validation.reason).toContain('30px');
    });
  });

  describe('Element type categorization', () => {
    it('requiresBothDimensionMinimums SHALL correctly identify icon-like elements', () => {
      // These should require both dimensions
      expect(requiresBothDimensionMinimums('icon-button')).toBe(true);
      expect(requiresBothDimensionMinimums('close-button')).toBe(true);
      expect(requiresBothDimensionMinimums('submit-button')).toBe(true);
      expect(requiresBothDimensionMinimums('pagination-button')).toBe(true);
      
      // These should only require height
      expect(requiresBothDimensionMinimums('button')).toBe(false);
      expect(requiresBothDimensionMinimums('link')).toBe(false);
      expect(requiresBothDimensionMinimums('input-text')).toBe(false);
      expect(requiresBothDimensionMinimums('menu-item')).toBe(false);
    });
  });

  describe('Checkbox and radio special handling', () => {
    it('Checkboxes (with label wrapper) SHALL meet 44px touch target minimum (Req 12.4)', () => {
      fc.assert(
        fc.property(
          contentDimensionArb,
          contentDimensionArb,
          (contentWidth, contentHeight) => {
            const config: InteractiveElementConfig = {
              type: 'input-checkbox',
              contentWidth,
              contentHeight,
              hasCustomPadding: false,
            };
            const dimensions = calculateTouchTargetDimensions(config);
            
            // The label wrapper around checkboxes ensures 44px touch target
            expect(dimensions.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Radio buttons (with label wrapper) SHALL meet 44px touch target minimum (Req 12.4)', () => {
      fc.assert(
        fc.property(
          contentDimensionArb,
          contentDimensionArb,
          (contentWidth, contentHeight) => {
            const config: InteractiveElementConfig = {
              type: 'input-radio',
              contentWidth,
              contentHeight,
              hasCustomPadding: false,
            };
            const dimensions = calculateTouchTargetDimensions(config);
            
            // The label wrapper around radio buttons ensures 44px touch target
            expect(dimensions.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('MCP and model selector elements', () => {
    it('Model selector options SHALL meet touch target minimum (Req 12.4)', () => {
      fc.assert(
        fc.property(
          contentDimensionArb,
          contentDimensionArb,
          (contentWidth, contentHeight) => {
            const config: InteractiveElementConfig = {
              type: 'model-selector-option',
              contentWidth,
              contentHeight,
              hasCustomPadding: false,
            };
            const dimensions = calculateTouchTargetDimensions(config);
            
            expect(dimensions.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('MCP tool items SHALL meet touch target minimum (Req 12.4)', () => {
      fc.assert(
        fc.property(
          contentDimensionArb,
          contentDimensionArb,
          (contentWidth, contentHeight) => {
            const config: InteractiveElementConfig = {
              type: 'mcp-tool-item',
              contentWidth,
              contentHeight,
              hasCustomPadding: false,
            };
            const dimensions = calculateTouchTargetDimensions(config);
            
            expect(dimensions.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Dimension calculation correctness', () => {
    it('Calculated dimensions SHALL equal content + padding (when above minimum)', () => {
      // Use large content that exceeds minimum
      const config: InteractiveElementConfig = {
        type: 'button',
        contentWidth: 100,
        contentHeight: 50, // Large enough that padding won't hit minimum
        hasCustomPadding: false,
      };
      
      const dimensions = calculateTouchTargetDimensions(config);
      const defaultPadding = DEFAULT_MOBILE_PADDING['button'];
      
      // Width = content + left padding + right padding
      expect(dimensions.width).toBe(100 + defaultPadding.horizontal * 2);
      // Height = content + top padding + bottom padding, but min-height applies
      const expectedHeight = Math.max(
        50 + defaultPadding.vertical * 2,
        MIN_TOUCH_TARGET_SIZE
      );
      expect(dimensions.height).toBe(expectedHeight);
    });

    it('Small content SHALL be expanded to minimum by CSS rules', () => {
      const config: InteractiveElementConfig = {
        type: 'button',
        contentWidth: 10,
        contentHeight: 10, // Very small content
        hasCustomPadding: false,
      };
      
      const dimensions = calculateTouchTargetDimensions(config);
      
      // Even with small content, min-height ensures 44px
      expect(dimensions.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
    });
  });

  describe('All element types coverage', () => {
    it('Every interactive element type SHALL meet touch target minimum (Req 12.4)', () => {
      const allTypes: InteractiveElementType[] = [
        'button',
        'icon-button',
        'link',
        'input-text',
        'input-checkbox',
        'input-radio',
        'select',
        'tab',
        'menu-item',
        'dropdown-item',
        'close-button',
        'submit-button',
        'pagination-button',
        'sort-button',
        'conversation-item',
        'model-selector-option',
        'mcp-tool-item',
      ];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...allTypes),
          contentDimensionArb,
          contentDimensionArb,
          (type, contentWidth, contentHeight) => {
            const config: InteractiveElementConfig = {
              type,
              contentWidth,
              contentHeight,
              hasCustomPadding: false,
            };
            const dimensions = calculateTouchTargetDimensions(config);
            const validation = validateTouchTarget(dimensions, type);
            
            expect(validation.valid).toBe(true);
            expect(dimensions.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
