/**
 * Property Test: Conversation List Ordering
 * 
 * Feature: claude-desktop-alternative, Property 16: Conversation List Ordering
 * 
 * *For any* set of conversations, the displayed list SHALL be ordered by updatedAt
 * timestamp in descending order (most recent first).
 * 
 * **Validates: Requirements 6.1**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Types
// ============================================================================

interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

type DateCategory = 'Today' | 'Yesterday' | 'This Week' | 'This Month' | 'Older';

// ============================================================================
// Functions under test (extracted from ConversationSidebar)
// ============================================================================

/**
 * Get the date category for a given date
 */
function getDateCategory(date: Date, now: Date = new Date()): DateCategory {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(thisWeekStart.getDate() - today.getDay());
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dateOnly >= today) return 'Today';
  if (dateOnly >= yesterday) return 'Yesterday';
  if (dateOnly >= thisWeekStart) return 'This Week';
  if (dateOnly >= thisMonthStart) return 'This Month';
  return 'Older';
}

/**
 * Sort conversations by updatedAt descending (most recent first)
 */
function sortConversations(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  );
}

/**
 * Group conversations by date category while preserving sort order
 */
function groupConversations(
  conversations: Conversation[],
  now: Date = new Date()
): { category: DateCategory; conversations: Conversation[] }[] {
  const categoryOrder: DateCategory[] = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];
  
  const grouped = conversations.reduce((acc, c) => {
    const category = getDateCategory(c.updatedAt, now);
    if (!acc[category]) acc[category] = [];
    acc[category].push(c);
    return acc;
  }, {} as Record<DateCategory, Conversation[]>);

  return categoryOrder
    .filter(cat => grouped[cat]?.length > 0)
    .map(cat => ({ category: cat, conversations: grouped[cat] }));
}

/**
 * Get ordered list of conversations (sorted and grouped)
 */
function getOrderedConversations(
  conversations: Conversation[],
  now: Date = new Date()
): Conversation[] {
  const sorted = sortConversations(conversations);
  const groups = groupConversations(sorted, now);
  return groups.flatMap(g => g.conversations);
}

// ============================================================================
// Arbitraries for generating test data
// ============================================================================

/**
 * Arbitrary for generating a valid conversation ID
 */
const conversationIdArb = fc.uuid();

/**
 * Arbitrary for generating a conversation title
 */
const conversationTitleArb = fc.string({ minLength: 1, maxLength: 100 });

/**
 * Arbitrary for generating a date within a reasonable range
 */
const dateArb = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2030-12-31'),
}).filter(d => !isNaN(d.getTime()));

/**
 * Arbitrary for generating a conversation with valid timestamps
 */
const conversationArb = fc.record({
  id: conversationIdArb,
  title: conversationTitleArb,
  createdAt: dateArb,
  updatedAt: dateArb,
}).map(conv => ({
  ...conv,
  // Ensure updatedAt is >= createdAt
  updatedAt: conv.updatedAt >= conv.createdAt ? conv.updatedAt : conv.createdAt,
})).filter(conv => !isNaN(conv.createdAt.getTime()) && !isNaN(conv.updatedAt.getTime()));

/**
 * Arbitrary for generating a list of conversations with unique IDs
 */
const conversationListArb = fc.array(conversationArb, { minLength: 0, maxLength: 50 })
  .map(convs => {
    // Ensure unique IDs
    const seen = new Set<string>();
    return convs.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  });

/**
 * Arbitrary for generating conversations with specific date categories
 */
function conversationWithDateArb(targetDate: Date): fc.Arbitrary<Conversation> {
  return fc.record({
    id: conversationIdArb,
    title: conversationTitleArb,
    createdAt: fc.constant(targetDate),
    updatedAt: fc.constant(targetDate),
  });
}

// ============================================================================
// Property Tests
// ============================================================================

describe('Property 16: Conversation List Ordering', () => {
  describe('Descending Order by updatedAt', () => {
    it('should order conversations by updatedAt descending (most recent first) (Req 6.1)', () => {
      fc.assert(
        fc.property(
          conversationListArb,
          (conversations) => {
            const sorted = sortConversations(conversations);
            
            // Property: Each conversation's updatedAt should be >= the next one's
            for (let i = 0; i < sorted.length - 1; i++) {
              expect(sorted[i].updatedAt.getTime()).toBeGreaterThanOrEqual(
                sorted[i + 1].updatedAt.getTime()
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all conversations when sorting (no data loss) (Req 6.1)', () => {
      fc.assert(
        fc.property(
          conversationListArb,
          (conversations) => {
            const sorted = sortConversations(conversations);
            
            // Property: Same number of conversations
            expect(sorted.length).toBe(conversations.length);
            
            // Property: All original IDs should be present
            const originalIds = new Set(conversations.map(c => c.id));
            const sortedIds = new Set(sorted.map(c => c.id));
            expect(sortedIds).toEqual(originalIds);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not mutate the original array (Req 6.1)', () => {
      fc.assert(
        fc.property(
          conversationListArb,
          (conversations) => {
            const originalOrder = conversations.map(c => c.id);
            sortConversations(conversations);
            const currentOrder = conversations.map(c => c.id);
            
            // Property: Original array should not be mutated
            expect(currentOrder).toEqual(originalOrder);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be idempotent (sorting twice produces same result) (Req 6.1)', () => {
      fc.assert(
        fc.property(
          conversationListArb,
          (conversations) => {
            const sorted1 = sortConversations(conversations);
            const sorted2 = sortConversations(sorted1);
            
            // Property: Sorting an already sorted list should produce same order
            expect(sorted1.map(c => c.id)).toEqual(sorted2.map(c => c.id));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Date Category Assignment', () => {
    it('should assign "Today" category for dates on the current day (Req 6.1)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 23 }),
          fc.integer({ min: 0, max: 59 }),
          (hour, minute) => {
            const now = new Date(2024, 5, 15, 12, 0, 0); // June 15, 2024, noon
            const testDate = new Date(2024, 5, 15, hour, minute, 0);
            
            const category = getDateCategory(testDate, now);
            expect(category).toBe('Today');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should assign "Yesterday" category for dates on the previous day (Req 6.1)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 23 }),
          fc.integer({ min: 0, max: 59 }),
          (hour, minute) => {
            const now = new Date(2024, 5, 15, 12, 0, 0); // June 15, 2024, noon
            const testDate = new Date(2024, 5, 14, hour, minute, 0); // June 14
            
            const category = getDateCategory(testDate, now);
            expect(category).toBe('Yesterday');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should assign "This Week" category for dates within the current week (Req 6.1)', () => {
      // June 15, 2024 is a Saturday (day 6), so week starts on Sunday June 9
      const now = new Date(2024, 5, 15, 12, 0, 0);
      
      // Test dates within the week (Sunday June 9 to Thursday June 13)
      // Friday June 14 is Yesterday, Saturday June 15 is Today
      const thisWeekDates = [
        new Date(2024, 5, 9, 10, 0, 0),  // Sunday
        new Date(2024, 5, 10, 10, 0, 0), // Monday
        new Date(2024, 5, 11, 10, 0, 0), // Tuesday
        new Date(2024, 5, 12, 10, 0, 0), // Wednesday
        new Date(2024, 5, 13, 10, 0, 0), // Thursday
      ];
      
      for (const date of thisWeekDates) {
        const category = getDateCategory(date, now);
        expect(category).toBe('This Week');
      }
    });

    it('should assign "This Month" category for dates within the current month but not this week (Req 6.1)', () => {
      // June 15, 2024 is a Saturday, week starts Sunday June 9
      const now = new Date(2024, 5, 15, 12, 0, 0);
      
      // Test dates in June but before this week
      const thisMonthDates = [
        new Date(2024, 5, 1, 10, 0, 0),  // June 1
        new Date(2024, 5, 5, 10, 0, 0),  // June 5
        new Date(2024, 5, 8, 10, 0, 0),  // June 8 (Saturday before this week)
      ];
      
      for (const date of thisMonthDates) {
        const category = getDateCategory(date, now);
        expect(category).toBe('This Month');
      }
    });

    it('should assign "Older" category for dates before the current month (Req 6.1)', () => {
      const now = new Date(2024, 5, 15, 12, 0, 0); // June 15, 2024
      
      const olderDates = [
        new Date(2024, 4, 31, 10, 0, 0),  // May 31
        new Date(2024, 0, 1, 10, 0, 0),   // January 1
        new Date(2023, 11, 25, 10, 0, 0), // December 25, 2023
      ];
      
      for (const date of olderDates) {
        const category = getDateCategory(date, now);
        expect(category).toBe('Older');
      }
    });
  });

  describe('Grouping Preserves Order', () => {
    it('should maintain descending order within each group (Req 6.1)', () => {
      fc.assert(
        fc.property(
          conversationListArb,
          dateArb,
          (conversations, now) => {
            const sorted = sortConversations(conversations);
            const groups = groupConversations(sorted, now);
            
            // Property: Within each group, conversations should be in descending order
            for (const group of groups) {
              for (let i = 0; i < group.conversations.length - 1; i++) {
                expect(group.conversations[i].updatedAt.getTime()).toBeGreaterThanOrEqual(
                  group.conversations[i + 1].updatedAt.getTime()
                );
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should order groups in correct category order (Today, Yesterday, This Week, This Month, Older) (Req 6.1)', () => {
      fc.assert(
        fc.property(
          conversationListArb,
          dateArb,
          (conversations, now) => {
            const sorted = sortConversations(conversations);
            const groups = groupConversations(sorted, now);
            
            const categoryOrder: DateCategory[] = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];
            const groupCategories = groups.map(g => g.category);
            
            // Property: Groups should appear in the correct order
            for (let i = 0; i < groupCategories.length - 1; i++) {
              const currentIndex = categoryOrder.indexOf(groupCategories[i]);
              const nextIndex = categoryOrder.indexOf(groupCategories[i + 1]);
              expect(currentIndex).toBeLessThan(nextIndex);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include all conversations in groups (no data loss) (Req 6.1)', () => {
      fc.assert(
        fc.property(
          conversationListArb,
          dateArb,
          (conversations, now) => {
            const sorted = sortConversations(conversations);
            const groups = groupConversations(sorted, now);
            
            const totalInGroups = groups.reduce((sum, g) => sum + g.conversations.length, 0);
            
            // Property: Total conversations in groups should equal original count
            expect(totalInGroups).toBe(conversations.length);
            
            // Property: All original IDs should be present in groups
            const originalIds = new Set(conversations.map(c => c.id));
            const groupedIds = new Set(groups.flatMap(g => g.conversations.map(c => c.id)));
            expect(groupedIds).toEqual(originalIds);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Full Ordering Pipeline', () => {
    it('should produce globally descending order when flattening groups (Req 6.1)', () => {
      fc.assert(
        fc.property(
          conversationListArb,
          dateArb,
          (conversations, now) => {
            const ordered = getOrderedConversations(conversations, now);
            
            // Property: The flattened list should be in descending order by updatedAt
            for (let i = 0; i < ordered.length - 1; i++) {
              expect(ordered[i].updatedAt.getTime()).toBeGreaterThanOrEqual(
                ordered[i + 1].updatedAt.getTime()
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty conversation list (Req 6.1)', () => {
      const ordered = getOrderedConversations([]);
      expect(ordered).toEqual([]);
    });

    it('should handle single conversation (Req 6.1)', () => {
      fc.assert(
        fc.property(
          conversationArb,
          dateArb,
          (conversation, now) => {
            const ordered = getOrderedConversations([conversation], now);
            
            expect(ordered.length).toBe(1);
            expect(ordered[0].id).toBe(conversation.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle conversations with identical timestamps (Req 6.1)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 10 }),
          dateArb,
          dateArb,
          (count, timestamp, now) => {
            const conversations: Conversation[] = Array.from({ length: count }, (_, i) => ({
              id: `conv-${i}`,
              title: `Conversation ${i}`,
              createdAt: timestamp,
              updatedAt: timestamp,
            }));
            
            const ordered = getOrderedConversations(conversations, now);
            
            // Property: All conversations should be present
            expect(ordered.length).toBe(count);
            
            // Property: All should have the same timestamp
            for (const conv of ordered) {
              expect(conv.updatedAt.getTime()).toBe(timestamp.getTime());
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle dates at midnight boundaries correctly (Req 6.1)', () => {
      const now = new Date(2024, 5, 15, 0, 0, 0); // Midnight June 15
      
      // Just before midnight on June 14 should be Yesterday
      const justBeforeMidnight = new Date(2024, 5, 14, 23, 59, 59);
      expect(getDateCategory(justBeforeMidnight, now)).toBe('Yesterday');
      
      // Midnight June 15 should be Today
      const atMidnight = new Date(2024, 5, 15, 0, 0, 0);
      expect(getDateCategory(atMidnight, now)).toBe('Today');
    });

    it('should handle week boundary correctly (Req 6.1)', () => {
      // June 15, 2024 is Saturday, week starts Sunday June 9
      const now = new Date(2024, 5, 15, 12, 0, 0);
      
      // Saturday June 8 should be This Month (before this week)
      const beforeWeek = new Date(2024, 5, 8, 12, 0, 0);
      expect(getDateCategory(beforeWeek, now)).toBe('This Month');
      
      // Sunday June 9 should be This Week
      const startOfWeek = new Date(2024, 5, 9, 0, 0, 0);
      expect(getDateCategory(startOfWeek, now)).toBe('This Week');
    });

    it('should handle month boundary correctly (Req 6.1)', () => {
      const now = new Date(2024, 5, 15, 12, 0, 0); // June 15
      
      // May 31 should be Older
      const lastDayPrevMonth = new Date(2024, 4, 31, 12, 0, 0);
      expect(getDateCategory(lastDayPrevMonth, now)).toBe('Older');
      
      // June 1 should be This Month
      const firstDayThisMonth = new Date(2024, 5, 1, 12, 0, 0);
      expect(getDateCategory(firstDayThisMonth, now)).toBe('This Month');
    });
  });
});
