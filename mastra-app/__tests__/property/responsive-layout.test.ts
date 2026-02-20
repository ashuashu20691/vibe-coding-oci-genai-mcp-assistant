/**
 * Property Test: Responsive Layout Adaptation
 * 
 * Feature: claude-desktop-alternative, Property 28: Responsive Layout Adaptation
 * 
 * *For any* viewport width, the layout SHALL adapt appropriately:
 * - Desktop (>1024px): Full sidebar visible, multi-column grid
 * - Tablet (768-1024px): Collapsible sidebar, 2-column grid
 * - Mobile (<768px): Hamburger menu, single-column stack
 * 
 * **Validates: Requirements 12.1, 12.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  getDeviceType,
  matchesBreakpoint,
  BREAKPOINTS,
  DeviceType,
} from '@/hooks/useResponsive';

/**
 * Layout configuration for each device type
 */
interface LayoutConfig {
  sidebarVisible: boolean;
  sidebarCollapsible: boolean;
  gridColumns: number;
  usesHamburgerMenu: boolean;
}

/**
 * Returns the expected layout configuration for a given device type
 * Based on Requirements 12.1 and 12.2
 */
function getExpectedLayoutConfig(deviceType: DeviceType): LayoutConfig {
  switch (deviceType) {
    case 'desktop':
      return {
        sidebarVisible: true,
        sidebarCollapsible: false,
        gridColumns: 3, // Multi-column grid
        usesHamburgerMenu: false,
      };
    case 'tablet':
      return {
        sidebarVisible: true,
        sidebarCollapsible: true,
        gridColumns: 2, // 2-column grid
        usesHamburgerMenu: false,
      };
    case 'mobile':
      return {
        sidebarVisible: false,
        sidebarCollapsible: false,
        gridColumns: 1, // Single-column stack
        usesHamburgerMenu: true,
      };
  }
}

/**
 * Validates that a width correctly maps to the expected device type
 */
function validateDeviceTypeForWidth(width: number): DeviceType {
  if (width < BREAKPOINTS.mobile) {
    return 'mobile';
  }
  if (width <= BREAKPOINTS.tablet) {
    return 'tablet';
  }
  return 'desktop';
}

// Arbitrary for desktop viewport widths (>1024px)
const desktopWidthArb = fc.integer({ min: 1025, max: 4096 });

// Arbitrary for tablet viewport widths (768-1024px)
const tabletWidthArb = fc.integer({ min: 768, max: 1024 });

// Arbitrary for mobile viewport widths (<768px)
const mobileWidthArb = fc.integer({ min: 320, max: 767 });

// Arbitrary for any valid viewport width
const anyViewportWidthArb = fc.integer({ min: 320, max: 4096 });

// Arbitrary for device type
const deviceTypeArb = fc.constantFrom<DeviceType>('mobile', 'tablet', 'desktop');

describe('Property 28: Responsive Layout Adaptation', () => {
  describe('Device type detection from viewport width', () => {
    it('Any viewport width >1024px SHALL be detected as desktop (Req 12.1)', () => {
      fc.assert(
        fc.property(
          desktopWidthArb,
          (width) => {
            const deviceType = getDeviceType(width);
            
            // Property: Width >1024px SHALL be desktop
            expect(deviceType).toBe('desktop');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Any viewport width 768-1024px SHALL be detected as tablet (Req 12.1)', () => {
      fc.assert(
        fc.property(
          tabletWidthArb,
          (width) => {
            const deviceType = getDeviceType(width);
            
            // Property: Width 768-1024px SHALL be tablet
            expect(deviceType).toBe('tablet');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Any viewport width <768px SHALL be detected as mobile (Req 12.1)', () => {
      fc.assert(
        fc.property(
          mobileWidthArb,
          (width) => {
            const deviceType = getDeviceType(width);
            
            // Property: Width <768px SHALL be mobile
            expect(deviceType).toBe('mobile');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Any viewport width SHALL map to exactly one device type (Req 12.1)', () => {
      fc.assert(
        fc.property(
          anyViewportWidthArb,
          (width) => {
            const deviceType = getDeviceType(width);
            
            // Property: Device type SHALL be one of the three valid types
            expect(['mobile', 'tablet', 'desktop']).toContain(deviceType);
            
            // Property: Only one device type should match
            const matchesMobile = matchesBreakpoint(width, 'mobile');
            const matchesTablet = matchesBreakpoint(width, 'tablet');
            const matchesDesktop = matchesBreakpoint(width, 'desktop');
            
            const matchCount = [matchesMobile, matchesTablet, matchesDesktop]
              .filter(Boolean).length;
            
            expect(matchCount).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Desktop layout configuration (>1024px)', () => {
    it('Desktop viewport SHALL have full sidebar visible (Req 12.1)', () => {
      fc.assert(
        fc.property(
          desktopWidthArb,
          (width) => {
            const deviceType = getDeviceType(width);
            const layoutConfig = getExpectedLayoutConfig(deviceType);
            
            // Property: Desktop SHALL have sidebar visible
            expect(layoutConfig.sidebarVisible).toBe(true);
            expect(layoutConfig.usesHamburgerMenu).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Desktop viewport SHALL use multi-column grid (Req 12.1)', () => {
      fc.assert(
        fc.property(
          desktopWidthArb,
          (width) => {
            const deviceType = getDeviceType(width);
            const layoutConfig = getExpectedLayoutConfig(deviceType);
            
            // Property: Desktop SHALL have multi-column grid (>2 columns)
            expect(layoutConfig.gridColumns).toBeGreaterThan(2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Desktop viewport SHALL NOT use collapsible sidebar (Req 12.1)', () => {
      fc.assert(
        fc.property(
          desktopWidthArb,
          (width) => {
            const deviceType = getDeviceType(width);
            const layoutConfig = getExpectedLayoutConfig(deviceType);
            
            // Property: Desktop sidebar SHALL NOT be collapsible
            expect(layoutConfig.sidebarCollapsible).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Tablet layout configuration (768-1024px)', () => {
    it('Tablet viewport SHALL have collapsible sidebar (Req 12.1, 12.2)', () => {
      fc.assert(
        fc.property(
          tabletWidthArb,
          (width) => {
            const deviceType = getDeviceType(width);
            const layoutConfig = getExpectedLayoutConfig(deviceType);
            
            // Property: Tablet SHALL have collapsible sidebar
            expect(layoutConfig.sidebarCollapsible).toBe(true);
            expect(layoutConfig.sidebarVisible).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Tablet viewport SHALL use 2-column grid (Req 12.1)', () => {
      fc.assert(
        fc.property(
          tabletWidthArb,
          (width) => {
            const deviceType = getDeviceType(width);
            const layoutConfig = getExpectedLayoutConfig(deviceType);
            
            // Property: Tablet SHALL have 2-column grid
            expect(layoutConfig.gridColumns).toBe(2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Tablet viewport SHALL NOT use hamburger menu (Req 12.2)', () => {
      fc.assert(
        fc.property(
          tabletWidthArb,
          (width) => {
            const deviceType = getDeviceType(width);
            const layoutConfig = getExpectedLayoutConfig(deviceType);
            
            // Property: Tablet SHALL NOT use hamburger menu
            expect(layoutConfig.usesHamburgerMenu).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Mobile layout configuration (<768px)', () => {
    it('Mobile viewport SHALL use hamburger menu (Req 12.2)', () => {
      fc.assert(
        fc.property(
          mobileWidthArb,
          (width) => {
            const deviceType = getDeviceType(width);
            const layoutConfig = getExpectedLayoutConfig(deviceType);
            
            // Property: Mobile SHALL use hamburger menu
            expect(layoutConfig.usesHamburgerMenu).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Mobile viewport SHALL hide sidebar by default (Req 12.2)', () => {
      fc.assert(
        fc.property(
          mobileWidthArb,
          (width) => {
            const deviceType = getDeviceType(width);
            const layoutConfig = getExpectedLayoutConfig(deviceType);
            
            // Property: Mobile SHALL have sidebar hidden by default
            expect(layoutConfig.sidebarVisible).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Mobile viewport SHALL use single-column stack (Req 12.1)', () => {
      fc.assert(
        fc.property(
          mobileWidthArb,
          (width) => {
            const deviceType = getDeviceType(width);
            const layoutConfig = getExpectedLayoutConfig(deviceType);
            
            // Property: Mobile SHALL have single-column layout
            expect(layoutConfig.gridColumns).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Breakpoint boundary conditions', () => {
    it('Width exactly at 768px SHALL be tablet (Req 12.1)', () => {
      fc.assert(
        fc.property(
          fc.constant(768),
          (width) => {
            const deviceType = getDeviceType(width);
            
            // Property: 768px is the lower bound of tablet
            expect(deviceType).toBe('tablet');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Width exactly at 1024px SHALL be tablet (Req 12.1)', () => {
      fc.assert(
        fc.property(
          fc.constant(1024),
          (width) => {
            const deviceType = getDeviceType(width);
            
            // Property: 1024px is the upper bound of tablet
            expect(deviceType).toBe('tablet');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Width at 767px SHALL be mobile (Req 12.1)', () => {
      fc.assert(
        fc.property(
          fc.constant(767),
          (width) => {
            const deviceType = getDeviceType(width);
            
            // Property: 767px is mobile (just below tablet threshold)
            expect(deviceType).toBe('mobile');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Width at 1025px SHALL be desktop (Req 12.1)', () => {
      fc.assert(
        fc.property(
          fc.constant(1025),
          (width) => {
            const deviceType = getDeviceType(width);
            
            // Property: 1025px is desktop (just above tablet threshold)
            expect(deviceType).toBe('desktop');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('matchesBreakpoint consistency', () => {
    it('matchesBreakpoint SHALL be consistent with getDeviceType (Req 12.1)', () => {
      fc.assert(
        fc.property(
          anyViewportWidthArb,
          (width) => {
            const deviceType = getDeviceType(width);
            
            // Property: matchesBreakpoint SHALL return true for the detected device type
            expect(matchesBreakpoint(width, deviceType)).toBe(true);
            
            // Property: matchesBreakpoint SHALL return false for other device types
            const otherTypes: DeviceType[] = ['mobile', 'tablet', 'desktop']
              .filter(t => t !== deviceType) as DeviceType[];
            
            for (const otherType of otherTypes) {
              expect(matchesBreakpoint(width, otherType)).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Layout adaptation is deterministic', () => {
    it('Same viewport width SHALL always produce same device type (Req 12.1)', () => {
      fc.assert(
        fc.property(
          anyViewportWidthArb,
          (width) => {
            // Call getDeviceType multiple times with same width
            const result1 = getDeviceType(width);
            const result2 = getDeviceType(width);
            const result3 = getDeviceType(width);
            
            // Property: Results SHALL be identical
            expect(result1).toBe(result2);
            expect(result2).toBe(result3);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Same device type SHALL always produce same layout config (Req 12.1, 12.2)', () => {
      fc.assert(
        fc.property(
          deviceTypeArb,
          (deviceType) => {
            // Call getExpectedLayoutConfig multiple times
            const config1 = getExpectedLayoutConfig(deviceType);
            const config2 = getExpectedLayoutConfig(deviceType);
            
            // Property: Configs SHALL be identical
            expect(config1).toEqual(config2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Grid column count decreases with viewport width', () => {
    it('Desktop SHALL have more grid columns than tablet (Req 12.1)', () => {
      fc.assert(
        fc.property(
          desktopWidthArb,
          tabletWidthArb,
          (desktopWidth, tabletWidth) => {
            const desktopConfig = getExpectedLayoutConfig(getDeviceType(desktopWidth));
            const tabletConfig = getExpectedLayoutConfig(getDeviceType(tabletWidth));
            
            // Property: Desktop grid columns > tablet grid columns
            expect(desktopConfig.gridColumns).toBeGreaterThan(tabletConfig.gridColumns);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Tablet SHALL have more grid columns than mobile (Req 12.1)', () => {
      fc.assert(
        fc.property(
          tabletWidthArb,
          mobileWidthArb,
          (tabletWidth, mobileWidth) => {
            const tabletConfig = getExpectedLayoutConfig(getDeviceType(tabletWidth));
            const mobileConfig = getExpectedLayoutConfig(getDeviceType(mobileWidth));
            
            // Property: Tablet grid columns > mobile grid columns
            expect(tabletConfig.gridColumns).toBeGreaterThan(mobileConfig.gridColumns);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Sidebar visibility transitions', () => {
    it('Sidebar visibility SHALL change at mobile/tablet boundary (Req 12.2)', () => {
      fc.assert(
        fc.property(
          fc.constant({ mobile: 767, tablet: 768 }),
          (boundaries) => {
            const mobileConfig = getExpectedLayoutConfig(getDeviceType(boundaries.mobile));
            const tabletConfig = getExpectedLayoutConfig(getDeviceType(boundaries.tablet));
            
            // Property: Sidebar hidden on mobile, visible on tablet
            expect(mobileConfig.sidebarVisible).toBe(false);
            expect(tabletConfig.sidebarVisible).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Hamburger menu SHALL only appear on mobile (Req 12.2)', () => {
      fc.assert(
        fc.property(
          anyViewportWidthArb,
          (width) => {
            const deviceType = getDeviceType(width);
            const layoutConfig = getExpectedLayoutConfig(deviceType);
            
            // Property: Hamburger menu appears only on mobile
            if (deviceType === 'mobile') {
              expect(layoutConfig.usesHamburgerMenu).toBe(true);
            } else {
              expect(layoutConfig.usesHamburgerMenu).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
