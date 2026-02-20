/**
 * Property Test: Conversation Search Filtering
 * 
 * Feature: claude-desktop-alternative, Property 19: Conversation Search Filtering
 * 
 * *For any* search query, the filtered conversation list SHALL contain only conversations
 * where the title or message content contains the search query (case-insensitive).
 * 
 * **Validates: Requirements 6.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Types
// ============================================================================

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
}

// ============================================================================
// Functions under test (extracted search filtering logic)
// ============================================================================

/**
 * Filter conversations by search query.
 * Matches against title or message content (case-insensitive).
 */
function filterConversationsBySearch(
  conversations: Conversation[],
  query: string
): Conversation[] {
  // Empty query returns all conversations
  if (!query || query.trim() === '') {
    return conversations;
  }

  const normalizedQuery = query.toLowerCase();

  return conversations.filter(conversation => {
    // Check if title matches (case-insensitive)
    if (conversation.title.toLowerCase().includes(normalizedQuery)) {
      return true;
    }

    // Check if any message content matches (case-insensitive)
    return conversation.messages.some(message =>
      message.content.toLowerCase().includes(normalizedQuery)
    );
  });
}

/**
 * Check if a conversation matches a search query.
 * Used for validation in tests.
 */
function conversationMatchesQuery(
  conversation: Conversation,
  query: string
): boolean {
  const normalizedQuery = query.toLowerCase();
  
  // Check title match
  if (conversation.title.toLowerCase().includes(normalizedQuery)) {
    return true;
  }
  
  // Check message content match
  return conversation.messages.some(message =>
    message.content.toLowerCase().includes(normalizedQuery)
  );
}

// ============================================================================
// Arbitraries for generating test data
// ============================================================================

/**
 * Arbitrary for generating a valid conversation ID
 */
const conversationIdArb = fc.uuid();

/**
 * Arbitrary for generating a message ID
 */
const messageIdArb = fc.uuid();

/**
 * Arbitrary for generating a conversation title (alphanumeric with spaces)
 */
const titleArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,49}$/)
  .filter(s => s.trim().length > 0);

/**
 * Arbitrary for generating message content (alphanumeric with spaces and punctuation)
 */
const contentArb = fc.stringMatching(/^[A-Za-z0-9 .,!?]{1,100}$/)
  .filter(s => s.trim().length > 0);

/**
 * Arbitrary for generating a search query (shorter strings for matching)
 */
const searchQueryArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,9}$/)
  .filter(s => s.trim().length > 0);

/**
 * Arbitrary for generating a date within a reasonable range
 */
const dateArb = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2030-12-31'),
}).filter(d => !isNaN(d.getTime()));

/**
 * Arbitrary for generating a message role
 */
const roleArb = fc.constantFrom<'user' | 'assistant' | 'system' | 'tool'>('user', 'assistant', 'system', 'tool');

/**
 * Arbitrary for generating a message
 */
const messageArb = fc.record({
  id: messageIdArb,
  role: roleArb,
  content: contentArb,
  timestamp: dateArb,
});

/**
 * Arbitrary for generating a conversation with messages
 */
const conversationArb = fc.record({
  id: conversationIdArb,
  title: titleArb,
  createdAt: dateArb,
  updatedAt: dateArb,
  messages: fc.array(messageArb, { minLength: 0, maxLength: 10 }),
}).map(conv => ({
  ...conv,
  // Ensure updatedAt is >= createdAt
  updatedAt: conv.updatedAt >= conv.createdAt ? conv.updatedAt : conv.createdAt,
}));

/**
 * Arbitrary for generating a list of conversations with unique IDs
 */
const conversationListArb = fc.array(conversationArb, { minLength: 0, maxLength: 20 })
  .map(convs => {
    // Ensure unique IDs
    const seen = new Set<string>();
    return convs.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  });

// ============================================================================
// Property Tests
// ============================================================================

describe('Property 19: Conversation Search Filtering', () => {
  describe('Title Matching', () => {
    it('should find conversations where title contains the search query (case-insensitive) (Req 6.5)', () => {
      fc.assert(
        fc.property(
          searchQueryArb,
          titleArb,
          (searchTerm, otherTitle) => {
            // Ensure otherTitle doesn't contain searchTerm
            fc.pre(!otherTitle.toLowerCase().includes(searchTerm.toLowerCase()));

            // Create conversation with title containing search term
            const matchingConv: Conversation = {
              id: 'matching-conv',
              title: `Test ${searchTerm} conversation`,
              createdAt: new Date(),
              updatedAt: new Date(),
              messages: [],
            };

            // Create conversation without search term in title
            const nonMatchingConv: Conversation = {
              id: 'non-matching-conv',
              title: otherTitle,
              createdAt: new Date(),
              updatedAt: new Date(),
              messages: [],
            };

            const conversations = [matchingConv, nonMatchingConv];
            const results = filterConversationsBySearch(conversations, searchTerm);

            // Property: Only matching conversation is returned
            expect(results.length).toBe(1);
            expect(results[0].id).toBe(matchingConv.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be case-insensitive when matching titles (Req 6.5)', () => {
      fc.assert(
        fc.property(
          searchQueryArb,
          (searchTerm) => {
            // Create conversation with uppercase title
            const conv: Conversation = {
              id: 'test-conv',
              title: `TITLE ${searchTerm.toUpperCase()} HERE`,
              createdAt: new Date(),
              updatedAt: new Date(),
              messages: [],
            };

            // Search with lowercase
            const results = filterConversationsBySearch([conv], searchTerm.toLowerCase());

            // Property: Case-insensitive match works
            expect(results.length).toBe(1);
            expect(results[0].id).toBe(conv.id);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Message Content Matching', () => {
    it('should find conversations where message content contains the search query (Req 6.5)', () => {
      fc.assert(
        fc.property(
          searchQueryArb,
          titleArb,
          titleArb,
          contentArb,
          (searchTerm, title1, title2, nonMatchingContent) => {
            // Ensure titles don't contain search term
            fc.pre(!title1.toLowerCase().includes(searchTerm.toLowerCase()));
            fc.pre(!title2.toLowerCase().includes(searchTerm.toLowerCase()));
            // Ensure non-matching content doesn't contain search term
            fc.pre(!nonMatchingContent.toLowerCase().includes(searchTerm.toLowerCase()));

            // Create conversation with message containing search term
            const matchingConv: Conversation = {
              id: 'matching-conv',
              title: title1,
              createdAt: new Date(),
              updatedAt: new Date(),
              messages: [{
                id: 'msg-1',
                role: 'user',
                content: `Message with ${searchTerm} inside`,
                timestamp: new Date(),
              }],
            };

            // Create conversation without search term in messages
            const nonMatchingConv: Conversation = {
              id: 'non-matching-conv',
              title: title2,
              createdAt: new Date(),
              updatedAt: new Date(),
              messages: [{
                id: 'msg-2',
                role: 'user',
                content: nonMatchingContent,
                timestamp: new Date(),
              }],
            };

            const conversations = [matchingConv, nonMatchingConv];
            const results = filterConversationsBySearch(conversations, searchTerm);

            // Property: Only conversation with matching message is returned
            expect(results.length).toBe(1);
            expect(results[0].id).toBe(matchingConv.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should match any message in conversation, not just the first (Req 6.5)', () => {
      fc.assert(
        fc.property(
          searchQueryArb,
          fc.array(contentArb, { minLength: 2, maxLength: 5 }),
          (searchTerm, otherContents) => {
            // Ensure other contents don't contain search term
            fc.pre(otherContents.every(c => !c.toLowerCase().includes(searchTerm.toLowerCase())));

            // Create conversation with multiple messages
            const messages: Message[] = otherContents.map((content, i) => ({
              id: `msg-${i}`,
              role: 'user' as const,
              content,
              timestamp: new Date(),
            }));

            // Add message with search term at the end
            messages.push({
              id: 'msg-last',
              role: 'assistant',
              content: `Response with ${searchTerm}`,
              timestamp: new Date(),
            });

            const conv: Conversation = {
              id: 'test-conv',
              title: 'Test conversation',
              createdAt: new Date(),
              updatedAt: new Date(),
              messages,
            };

            const results = filterConversationsBySearch([conv], searchTerm);

            // Property: Conversation is found via later message
            expect(results.length).toBe(1);
            expect(results[0].id).toBe(conv.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be case-insensitive when matching message content (Req 6.5)', () => {
      fc.assert(
        fc.property(
          searchQueryArb,
          (searchTerm) => {
            const conv: Conversation = {
              id: 'test-conv',
              title: 'Test',
              createdAt: new Date(),
              updatedAt: new Date(),
              messages: [{
                id: 'msg-1',
                role: 'user',
                content: `MESSAGE ${searchTerm.toUpperCase()} HERE`,
                timestamp: new Date(),
              }],
            };

            // Search with lowercase
            const results = filterConversationsBySearch([conv], searchTerm.toLowerCase());

            // Property: Case-insensitive match works
            expect(results.length).toBe(1);
            expect(results[0].id).toBe(conv.id);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Combined Title and Content Matching', () => {
    it('should find conversations matching either title or content (Req 6.5)', () => {
      fc.assert(
        fc.property(
          searchQueryArb,
          titleArb,
          (searchTerm, otherTitle) => {
            // Ensure otherTitle doesn't contain search term
            fc.pre(!otherTitle.toLowerCase().includes(searchTerm.toLowerCase()));

            // Create conversation with matching title
            const titleMatchConv: Conversation = {
              id: 'title-match',
              title: `Title ${searchTerm}`,
              createdAt: new Date(),
              updatedAt: new Date(),
              messages: [],
            };

            // Create conversation with matching message content
            const contentMatchConv: Conversation = {
              id: 'content-match',
              title: otherTitle,
              createdAt: new Date(),
              updatedAt: new Date(),
              messages: [{
                id: 'msg-1',
                role: 'user',
                content: `Content ${searchTerm} here`,
                timestamp: new Date(),
              }],
            };

            const conversations = [titleMatchConv, contentMatchConv];
            const results = filterConversationsBySearch(conversations, searchTerm);

            // Property: Both conversations are returned
            expect(results.length).toBe(2);
            expect(results.find(c => c.id === titleMatchConv.id)).toBeDefined();
            expect(results.find(c => c.id === contentMatchConv.id)).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not return duplicate when matching both title and content (Req 6.5)', () => {
      fc.assert(
        fc.property(
          searchQueryArb,
          (searchTerm) => {
            // Create conversation with search term in both title and message
            const conv: Conversation = {
              id: 'test-conv',
              title: `Title ${searchTerm}`,
              createdAt: new Date(),
              updatedAt: new Date(),
              messages: [{
                id: 'msg-1',
                role: 'user',
                content: `Message ${searchTerm}`,
                timestamp: new Date(),
              }],
            };

            const results = filterConversationsBySearch([conv], searchTerm);

            // Property: Only one result (no duplicates)
            expect(results.length).toBe(1);
            expect(results[0].id).toBe(conv.id);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Empty Results', () => {
    it('should return empty array when no matches found (Req 6.5)', () => {
      fc.assert(
        fc.property(
          searchQueryArb,
          titleArb,
          contentArb,
          (searchTerm, title, content) => {
            // Ensure neither title nor content contains search term
            fc.pre(!title.toLowerCase().includes(searchTerm.toLowerCase()));
            fc.pre(!content.toLowerCase().includes(searchTerm.toLowerCase()));

            const conv: Conversation = {
              id: 'test-conv',
              title,
              createdAt: new Date(),
              updatedAt: new Date(),
              messages: [{
                id: 'msg-1',
                role: 'user',
                content,
                timestamp: new Date(),
              }],
            };

            const results = filterConversationsBySearch([conv], searchTerm);

            // Property: No results returned
            expect(results).toEqual([]);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Empty Search Query', () => {
    it('should return all conversations when search query is empty (Req 6.5)', () => {
      fc.assert(
        fc.property(
          conversationListArb,
          (conversations) => {
            const results = filterConversationsBySearch(conversations, '');

            // Property: All conversations returned
            expect(results.length).toBe(conversations.length);
            for (const conv of conversations) {
              expect(results.find(r => r.id === conv.id)).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return all conversations when search query is whitespace only (Req 6.5)', () => {
      fc.assert(
        fc.property(
          conversationListArb,
          (conversations) => {
            const results = filterConversationsBySearch(conversations, '   ');

            // Property: All conversations returned
            expect(results.length).toBe(conversations.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('All Matching Conversations Returned', () => {
    it('should return all matching conversations (Req 6.5)', () => {
      fc.assert(
        fc.property(
          searchQueryArb,
          fc.integer({ min: 2, max: 5 }),
          (searchTerm, count) => {
            // Create multiple conversations with matching titles
            const conversations: Conversation[] = Array.from({ length: count }, (_, i) => ({
              id: `conv-${i}`,
              title: `Conv ${i} ${searchTerm}`,
              createdAt: new Date(),
              updatedAt: new Date(),
              messages: [],
            }));

            const results = filterConversationsBySearch(conversations, searchTerm);

            // Property: All matching conversations are returned
            expect(results.length).toBe(count);
            for (const conv of conversations) {
              expect(results.find(r => r.id === conv.id)).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Data Integrity', () => {
    it('should preserve conversation data when filtering (Req 6.5)', () => {
      fc.assert(
        fc.property(
          conversationListArb,
          searchQueryArb,
          (conversations, query) => {
            const results = filterConversationsBySearch(conversations, query);

            // Property: Each result should match an original conversation exactly
            for (const result of results) {
              const original = conversations.find(c => c.id === result.id);
              expect(original).toBeDefined();
              expect(result.title).toBe(original!.title);
              expect(result.messages.length).toBe(original!.messages.length);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not mutate original conversations array (Req 6.5)', () => {
      fc.assert(
        fc.property(
          conversationListArb,
          searchQueryArb,
          (conversations, query) => {
            const originalIds = conversations.map(c => c.id);
            filterConversationsBySearch(conversations, query);
            const currentIds = conversations.map(c => c.id);

            // Property: Original array should not be mutated
            expect(currentIds).toEqual(originalIds);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Validation Helper', () => {
    it('should correctly identify matching conversations (Req 6.5)', () => {
      fc.assert(
        fc.property(
          conversationListArb,
          searchQueryArb,
          (conversations, query) => {
            const results = filterConversationsBySearch(conversations, query);

            // Property: All results should match according to validation helper
            for (const result of results) {
              expect(conversationMatchesQuery(result, query)).toBe(true);
            }

            // Property: All non-results should not match
            const nonResults = conversations.filter(c => !results.find(r => r.id === c.id));
            for (const nonResult of nonResults) {
              expect(conversationMatchesQuery(nonResult, query)).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty conversations list (Req 6.5)', () => {
      fc.assert(
        fc.property(
          searchQueryArb,
          (query) => {
            const results = filterConversationsBySearch([], query);
            expect(results).toEqual([]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle conversations with no messages (Req 6.5)', () => {
      fc.assert(
        fc.property(
          searchQueryArb,
          titleArb,
          (searchTerm, otherTitle) => {
            fc.pre(!otherTitle.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchingConv: Conversation = {
              id: 'matching',
              title: `Title ${searchTerm}`,
              createdAt: new Date(),
              updatedAt: new Date(),
              messages: [],
            };

            const nonMatchingConv: Conversation = {
              id: 'non-matching',
              title: otherTitle,
              createdAt: new Date(),
              updatedAt: new Date(),
              messages: [],
            };

            const results = filterConversationsBySearch([matchingConv, nonMatchingConv], searchTerm);

            // Property: Only title-matching conversation returned
            expect(results.length).toBe(1);
            expect(results[0].id).toBe(matchingConv.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle single character search query (Req 6.5)', () => {
      const conv: Conversation = {
        id: 'test-conv',
        title: 'Test A conversation',
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [],
      };

      const results = filterConversationsBySearch([conv], 'A');
      expect(results.length).toBe(1);
      expect(results[0].id).toBe(conv.id);
    });
  });
});
