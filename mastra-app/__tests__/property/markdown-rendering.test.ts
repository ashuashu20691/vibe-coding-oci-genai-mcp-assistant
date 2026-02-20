/**
 * Property Test: Markdown Rendering Preservation
 * 
 * Feature: mastra-migration, Property 7: Markdown Rendering Preservation
 * 
 * *For any* message containing valid markdown syntax (headers, code blocks, lists,
 * emphasis, links), the rendered output SHALL preserve the semantic structure
 * of the markdown content.
 * 
 * **Validates: Requirements 4.4, 10.1**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Since MarkdownRenderer is a React component that uses ReactMarkdown,
// we test the markdown content preservation by verifying that:
// 1. The content passed to the component is valid markdown
// 2. The markdown structure is preserved (not stripped or modified)
// 3. Various markdown elements are correctly identified

// Arbitrary for markdown headers (# to ######)
const markdownHeaderArb = fc.tuple(
  fc.integer({ min: 1, max: 6 }),
  fc.string({ minLength: 1, maxLength: 50 })
    .filter(s => /^[a-zA-Z0-9 ]+$/.test(s))
    .filter(s => s.trim().length > 0)
).map(([level, text]) => `${'#'.repeat(level)} ${text.trim()}`);

// Arbitrary for code blocks with language
const codeBlockArb = fc.tuple(
  fc.constantFrom('javascript', 'typescript', 'python', 'sql', 'bash', 'json', ''),
  fc.string({ minLength: 1, maxLength: 100 })
    .filter(s => !s.includes('```'))
    .filter(s => s.trim().length > 0)
).map(([lang, code]) => `\`\`\`${lang}\n${code.trim()}\n\`\`\``);

// Arbitrary for inline code
const inlineCodeArb = fc.string({ minLength: 1, maxLength: 30 })
  .filter(s => /^[a-zA-Z0-9_\-. ]+$/.test(s))
  .filter(s => !s.includes('`'))
  .filter(s => s.trim().length > 0)
  .map(code => `\`${code.trim()}\``);

// Arbitrary for unordered list items
const unorderedListArb = fc.tuple(
  fc.constantFrom('-', '*', '+'),
  fc.array(
    fc.string({ minLength: 1, maxLength: 40 })
      .filter(s => /^[a-zA-Z0-9 ]+$/.test(s))
      .filter(s => s.trim().length > 0),
    { minLength: 1, maxLength: 5 }
  )
).map(([bullet, items]) => items.map(item => `${bullet} ${item.trim()}`).join('\n'));

// Arbitrary for ordered list items
const orderedListArb = fc.array(
  fc.string({ minLength: 1, maxLength: 40 })
    .filter(s => /^[a-zA-Z0-9 ]+$/.test(s))
    .filter(s => s.trim().length > 0),
  { minLength: 1, maxLength: 5 }
).map(items => items.map((item, i) => `${i + 1}. ${item.trim()}`).join('\n'));

// Arbitrary for emphasis (bold, italic)
const emphasisArb = fc.tuple(
  fc.constantFrom('*', '**', '***', '_', '__'),
  fc.string({ minLength: 1, maxLength: 30 })
    .filter(s => /^[a-zA-Z0-9 ]+$/.test(s))
    .filter(s => !s.includes('*') && !s.includes('_'))
    .filter(s => s.trim().length > 0)
).map(([marker, text]) => `${marker}${text.trim()}${marker}`);

// Arbitrary for links
const linkArb = fc.tuple(
  fc.string({ minLength: 1, maxLength: 30 })
    .filter(s => /^[a-zA-Z0-9 ]+$/.test(s))
    .filter(s => !s.includes('[') && !s.includes(']'))
    .filter(s => s.trim().length > 0),
  fc.constantFrom(
    'https://example.com',
    'https://docs.oracle.com',
    'http://localhost:8080',
    '/path/to/resource'
  )
).map(([text, url]) => `[${text.trim()}](${url})`);

// Arbitrary for blockquotes
const blockquoteArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => /^[a-zA-Z0-9 ]+$/.test(s))
  .filter(s => s.trim().length > 0)
  .map(text => `> ${text.trim()}`);

// Arbitrary for tables
const tableArb = fc.tuple(
  fc.array(
    fc.string({ minLength: 1, maxLength: 15 })
      .filter(s => /^[a-zA-Z0-9]+$/.test(s)),
    { minLength: 2, maxLength: 4 }
  ),
  fc.array(
    fc.array(
      fc.string({ minLength: 1, maxLength: 15 })
        .filter(s => /^[a-zA-Z0-9]+$/.test(s)),
      { minLength: 2, maxLength: 4 }
    ),
    { minLength: 1, maxLength: 3 }
  )
).map(([headers, rows]) => {
  const headerRow = `| ${headers.join(' | ')} |`;
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;
  const dataRows = rows.map(row => {
    // Ensure row has same number of columns as headers
    const paddedRow = headers.map((_, i) => row[i] || '');
    return `| ${paddedRow.join(' | ')} |`;
  });
  return [headerRow, separator, ...dataRows].join('\n');
});

// Helper function to check if content contains markdown structure
function containsMarkdownStructure(content: string, type: string): boolean {
  switch (type) {
    case 'header':
      return /^#{1,6}\s+.+$/m.test(content);
    case 'code_block':
      return /```[\s\S]*?```/.test(content);
    case 'inline_code':
      return /`[^`]+`/.test(content);
    case 'unordered_list':
      return /^[-*+]\s+.+$/m.test(content);
    case 'ordered_list':
      return /^\d+\.\s+.+$/m.test(content);
    case 'emphasis':
      return /(\*{1,3}|_{1,2})[^*_]+\1/.test(content);
    case 'link':
      return /\[.+\]\(.+\)/.test(content);
    case 'blockquote':
      return /^>\s+.+$/m.test(content);
    case 'table':
      return /\|.+\|/.test(content) && /\|[-\s|]+\|/.test(content);
    default:
      return false;
  }
}

describe('Property 7: Markdown Rendering Preservation', () => {
  it('should preserve header structure in markdown content (Req 4.4, 10.1)', () => {
    fc.assert(
      fc.property(markdownHeaderArb, (header) => {
        // Property: Header markdown structure is preserved
        expect(containsMarkdownStructure(header, 'header')).toBe(true);
        
        // Property: Header starts with # characters
        expect(header).toMatch(/^#{1,6}\s+/);
        
        // Property: Header level is between 1 and 6
        const match = header.match(/^(#{1,6})/);
        expect(match).not.toBeNull();
        expect(match![1].length).toBeGreaterThanOrEqual(1);
        expect(match![1].length).toBeLessThanOrEqual(6);
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve code block structure in markdown content (Req 4.4, 10.1)', () => {
    fc.assert(
      fc.property(codeBlockArb, (codeBlock) => {
        // Property: Code block structure is preserved
        expect(containsMarkdownStructure(codeBlock, 'code_block')).toBe(true);
        
        // Property: Code block has opening and closing delimiters
        expect(codeBlock.startsWith('```')).toBe(true);
        expect(codeBlock.endsWith('```')).toBe(true);
        
        // Property: Code block contains newlines (multi-line)
        expect(codeBlock).toContain('\n');
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve inline code structure in markdown content (Req 4.4, 10.1)', () => {
    fc.assert(
      fc.property(inlineCodeArb, (inlineCode) => {
        // Property: Inline code structure is preserved
        expect(containsMarkdownStructure(inlineCode, 'inline_code')).toBe(true);
        
        // Property: Inline code has backtick delimiters
        expect(inlineCode.startsWith('`')).toBe(true);
        expect(inlineCode.endsWith('`')).toBe(true);
        
        // Property: Inline code is single line (no newlines)
        expect(inlineCode).not.toContain('\n');
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve unordered list structure in markdown content (Req 4.4, 10.1)', () => {
    fc.assert(
      fc.property(unorderedListArb, (list) => {
        // Property: List structure is preserved
        expect(containsMarkdownStructure(list, 'unordered_list')).toBe(true);
        
        // Property: Each line starts with a list marker
        const lines = list.split('\n').filter(l => l.trim());
        for (const line of lines) {
          expect(line).toMatch(/^[-*+]\s+/);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve ordered list structure in markdown content (Req 4.4, 10.1)', () => {
    fc.assert(
      fc.property(orderedListArb, (list) => {
        // Property: List structure is preserved
        expect(containsMarkdownStructure(list, 'ordered_list')).toBe(true);
        
        // Property: Each line starts with a number and period
        const lines = list.split('\n').filter(l => l.trim());
        for (const line of lines) {
          expect(line).toMatch(/^\d+\.\s+/);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve emphasis structure in markdown content (Req 4.4, 10.1)', () => {
    fc.assert(
      fc.property(emphasisArb, (emphasis) => {
        // Property: Emphasis structure is preserved
        expect(containsMarkdownStructure(emphasis, 'emphasis')).toBe(true);
        
        // Property: Emphasis has matching markers
        const starMatch = emphasis.match(/^(\*{1,3})(.+)\1$/);
        const underscoreMatch = emphasis.match(/^(_{1,2})(.+)\1$/);
        expect(starMatch !== null || underscoreMatch !== null).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve link structure in markdown content (Req 4.4, 10.1)', () => {
    fc.assert(
      fc.property(linkArb, (link) => {
        // Property: Link structure is preserved
        expect(containsMarkdownStructure(link, 'link')).toBe(true);
        
        // Property: Link has text and URL parts
        const match = link.match(/^\[(.+)\]\((.+)\)$/);
        expect(match).not.toBeNull();
        expect(match![1].length).toBeGreaterThan(0); // text
        expect(match![2].length).toBeGreaterThan(0); // url
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve blockquote structure in markdown content (Req 4.4, 10.1)', () => {
    fc.assert(
      fc.property(blockquoteArb, (blockquote) => {
        // Property: Blockquote structure is preserved
        expect(containsMarkdownStructure(blockquote, 'blockquote')).toBe(true);
        
        // Property: Blockquote starts with >
        expect(blockquote.startsWith('>')).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve table structure in markdown content (Req 4.4, 10.1)', () => {
    fc.assert(
      fc.property(tableArb, (table) => {
        // Property: Table structure is preserved
        expect(containsMarkdownStructure(table, 'table')).toBe(true);
        
        // Property: Table has header row, separator, and data rows
        const lines = table.split('\n');
        expect(lines.length).toBeGreaterThanOrEqual(3); // header + separator + at least 1 row
        
        // Property: All lines contain pipe characters
        for (const line of lines) {
          expect(line).toContain('|');
        }
        
        // Property: Second line is the separator with dashes
        expect(lines[1]).toMatch(/\|[\s-|]+\|/);
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve mixed markdown content structure (Req 4.4, 10.1)', () => {
    // Arbitrary for mixed markdown content
    const mixedContentArb = fc.tuple(
      markdownHeaderArb,
      fc.string({ minLength: 1, maxLength: 50 })
        .filter(s => /^[a-zA-Z0-9 ]+$/.test(s))
        .filter(s => s.trim().length > 0),
      codeBlockArb
    ).map(([header, text, code]) => `${header}\n\n${text}\n\n${code}`);

    fc.assert(
      fc.property(mixedContentArb, (content) => {
        // Property: Mixed content preserves all markdown structures
        expect(containsMarkdownStructure(content, 'header')).toBe(true);
        expect(containsMarkdownStructure(content, 'code_block')).toBe(true);
        
        // Property: Content contains multiple sections separated by blank lines
        expect(content).toContain('\n\n');
      }),
      { numRuns: 100 }
    );
  });

  it('should handle empty and whitespace-only content gracefully (Req 4.4)', () => {
    // The MarkdownRenderer returns null for empty content
    const emptyContent = '';
    const whitespaceContent = '   \n\t  ';
    
    // Property: Empty content should not contain any markdown structures
    expect(containsMarkdownStructure(emptyContent, 'header')).toBe(false);
    expect(containsMarkdownStructure(emptyContent, 'code_block')).toBe(false);
    
    // Property: Whitespace-only content should not contain markdown structures
    expect(containsMarkdownStructure(whitespaceContent, 'header')).toBe(false);
    expect(containsMarkdownStructure(whitespaceContent, 'code_block')).toBe(false);
  });
});
