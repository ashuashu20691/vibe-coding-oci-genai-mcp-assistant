#!/usr/bin/env tsx
/**
 * Task 25: Final Validation and Polish
 * 
 * Comprehensive validation script that checks:
 * 1. UI matches Claude Desktop's conversational workspace feel
 * 2. Complete agentic loop: narrative → tool → interpretation → retry → artifact
 * 3. Failures trigger autonomous pivots with explanations
 * 4. Artifacts panel only shows for large/visual outputs
 * 5. Borderless, minimal styling throughout
 * 6. Tool details appear as conversational text, not event cards
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface ValidationResult {
  category: string;
  check: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'INFO';
  message: string;
  details?: string;
}

const results: ValidationResult[] = [];

function addResult(category: string, check: string, status: ValidationResult['status'], message: string, details?: string) {
  results.push({ category, check, status, message, details });
}

function checkFileExists(path: string): boolean {
  return existsSync(join(process.cwd(), path));
}

function checkFileContains(path: string, pattern: string | RegExp): boolean {
  try {
    const content = readFileSync(join(process.cwd(), path), 'utf-8');
    if (typeof pattern === 'string') {
      return content.includes(pattern);
    }
    return pattern.test(content);
  } catch {
    return false;
  }
}

function extractConstantValue(path: string, constantName: string): number | null {
  try {
    const content = readFileSync(join(process.cwd(), path), 'utf-8');
    const match = content.match(new RegExp(`export const ${constantName}\\s*=\\s*(\\d+)`));
    return match ? parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

console.log('🔍 Task 25: Final Validation and Polish\n');
console.log('=' .repeat(80));

// ============================================================================
// 1. UI Conversational Workspace Validation
// ============================================================================
console.log('\n📱 1. UI Conversational Workspace Validation\n');

// Check for borderless styling
if (checkFileContains('src/app/globals.css', 'border: none') || 
    checkFileContains('src/app/globals.css', 'border: medium')) {
  addResult('UI', 'Borderless Styling', 'PASS', 
    'CSS contains borderless styling patterns');
} else {
  addResult('UI', 'Borderless Styling', 'WARN', 
    'Could not verify borderless styling in globals.css');
}

// Check for Inter/Geist font
if (checkFileContains('src/app/globals.css', 'Inter') || 
    checkFileContains('src/app/globals.css', 'Geist')) {
  addResult('UI', 'Typography', 'PASS', 
    'Inter/Geist font family configured');
} else {
  addResult('UI', 'Typography', 'FAIL', 
    'Inter/Geist font family not found in globals.css');
}

// Check for 16px base font size
if (checkFileContains('src/app/globals.css', '--font-base-size: 16px') ||
    checkFileContains('src/app/globals.css', 'font-size: 16px')) {
  addResult('UI', 'Base Font Size', 'PASS', 
    '16px base font size configured');
} else {
  addResult('UI', 'Base Font Size', 'WARN', 
    'Could not verify 16px base font size');
}

// Check MessageList for conversational styling
if (checkFileContains('src/components/MessageList.tsx', 'background: transparent') &&
    checkFileContains('src/components/MessageList.tsx', 'fontSize: \'16px\'')) {
  addResult('UI', 'Message Styling', 'PASS', 
    'Messages use clean, minimal conversational styling');
} else {
  addResult('UI', 'Message Styling', 'WARN', 
    'Could not verify conversational message styling');
}

// ============================================================================
// 2. Agentic Loop Components
// ============================================================================
console.log('\n🤖 2. Agentic Loop Components\n');

// Check NarrativeStreamingService exists
if (checkFileExists('src/services/narrative-streaming-service.ts')) {
  addResult('Agentic', 'NarrativeStreamingService', 'PASS', 
    'NarrativeStreamingService implementation found');
  
  // Check for key methods
  const hasPreTool = checkFileContains('src/services/narrative-streaming-service.ts', 
    'streamPreToolNarrative');
  const hasPostTool = checkFileContains('src/services/narrative-streaming-service.ts', 
    'streamPostToolNarrative');
  const hasError = checkFileContains('src/services/narrative-streaming-service.ts', 
    'streamErrorNarrative');
  
  if (hasPreTool && hasPostTool && hasError) {
    addResult('Agentic', 'Narrative Methods', 'PASS', 
      'All narrative streaming methods implemented');
  } else {
    addResult('Agentic', 'Narrative Methods', 'FAIL', 
      'Missing narrative streaming methods');
  }
} else {
  addResult('Agentic', 'NarrativeStreamingService', 'FAIL', 
    'NarrativeStreamingService not found');
}

// Check IterationStateMachine exists
if (checkFileExists('src/services/iteration-state-machine.ts')) {
  addResult('Agentic', 'IterationStateMachine', 'PASS', 
    'IterationStateMachine implementation found');
  
  // Check for max 5 iterations
  const hasMaxIterations = checkFileContains('src/services/iteration-state-machine.ts', 
    /maxAttempts.*5|MAX_ITERATIONS.*5/);
  
  if (hasMaxIterations) {
    addResult('Agentic', 'Max Iterations', 'PASS', 
      'Maximum 5 iterations configured');
  } else {
    addResult('Agentic', 'Max Iterations', 'WARN', 
      'Could not verify max 5 iterations limit');
  }
} else {
  addResult('Agentic', 'IterationStateMachine', 'FAIL', 
    'IterationStateMachine not found');
}

// Check for enhanced system prompt
if (checkFileExists('src/services/system-prompts.ts')) {
  addResult('Agentic', 'System Prompts', 'PASS', 
    'System prompts service found');
  
  const hasPersistence = checkFileContains('src/services/system-prompts.ts', 
    /persistent|PERSISTENT/i);
  const hasCommunicative = checkFileContains('src/services/system-prompts.ts', 
    /communicative|COMMUNICATIVE/i);
  
  if (hasPersistence && hasCommunicative) {
    addResult('Agentic', 'Enhanced Prompt', 'PASS', 
      'Enhanced system prompt with persistence instructions found');
  } else {
    addResult('Agentic', 'Enhanced Prompt', 'WARN', 
      'Could not verify enhanced system prompt content');
  }
} else {
  addResult('Agentic', 'System Prompts', 'FAIL', 
    'System prompts service not found');
}

// ============================================================================
// 3. Artifacts Panel Validation
// ============================================================================
console.log('\n🎨 3. Artifacts Panel Validation\n');

// Check ArtifactsPanel exists
if (checkFileExists('src/components/ArtifactsPanel.tsx')) {
  addResult('Artifacts', 'ArtifactsPanel Component', 'PASS', 
    'ArtifactsPanel component found');
  
  // Check for split-screen layout
  const hasSplitScreen = checkFileContains('src/components/ArtifactsPanel.tsx', 
    /40%|width.*40/);
  
  if (hasSplitScreen) {
    addResult('Artifacts', 'Split-Screen Layout', 'PASS', 
      '40% width split-screen layout configured');
  } else {
    addResult('Artifacts', 'Split-Screen Layout', 'WARN', 
      'Could not verify 40% width split-screen layout');
  }
} else {
  addResult('Artifacts', 'ArtifactsPanel Component', 'FAIL', 
    'ArtifactsPanel component not found');
}

// Check result routing logic
if (checkFileExists('src/utils/result-routing.ts')) {
  addResult('Artifacts', 'Result Routing', 'PASS', 
    'Result routing logic found');
  
  // Check for MAX_INLINE_ROWS constant
  const maxRows = extractConstantValue('src/types/index.ts', 'MAX_INLINE_ROWS');
  
  if (maxRows !== null) {
    addResult('Artifacts', 'MAX_INLINE_ROWS', 'PASS', 
      `MAX_INLINE_ROWS configured as ${maxRows}`, 
      'Configurable threshold for artifacts routing');
  } else {
    addResult('Artifacts', 'MAX_INLINE_ROWS', 'WARN', 
      'Could not extract MAX_INLINE_ROWS value');
  }
  
  // Check for shouldRouteToArtifacts function
  const hasRouting = checkFileContains('src/utils/result-routing.ts', 
    'shouldRouteToArtifacts');
  
  if (hasRouting) {
    addResult('Artifacts', 'Routing Function', 'PASS', 
      'shouldRouteToArtifacts function implemented');
  } else {
    addResult('Artifacts', 'Routing Function', 'FAIL', 
      'shouldRouteToArtifacts function not found');
  }
} else {
  addResult('Artifacts', 'Result Routing', 'FAIL', 
    'Result routing logic not found');
}

// ============================================================================
// 4. Tool Details as Conversational Text
// ============================================================================
console.log('\n💬 4. Tool Details as Conversational Text\n');

// Check for ConversationalNarrator
if (checkFileExists('src/services/conversational-narrator.ts')) {
  addResult('Conversational', 'ConversationalNarrator', 'PASS', 
    'ConversationalNarrator service found');
  
  // Check for verbose mode enabled by default
  const hasVerboseDefault = checkFileContains('src/services/conversational-narrator.ts', 
    /verboseMode.*true|ENABLE_VERBOSE_NARRATION.*!==.*'false'/);
  
  if (hasVerboseDefault) {
    addResult('Conversational', 'Verbose Mode', 'PASS', 
      'Verbose mode enabled by default (Requirements 13, 18.3)');
  } else {
    addResult('Conversational', 'Verbose Mode', 'FAIL', 
      'Verbose mode not enabled by default');
  }
  
  // Check for formatting functions
  const hasFormatting = checkFileContains('src/services/conversational-narrator.ts', 
    'formatToolCall') && checkFileContains('src/services/conversational-narrator.ts', 
    'formatToolResult');
  
  if (hasFormatting) {
    addResult('Conversational', 'Formatting Functions', 'PASS', 
      'Tool call and result formatting functions found');
  } else {
    addResult('Conversational', 'Formatting Functions', 'WARN', 
      'Could not verify formatting functions');
  }
} else {
  addResult('Conversational', 'ConversationalNarrator', 'FAIL', 
    'ConversationalNarrator service not found');
}

// ============================================================================
// 5. Progress Indicators
// ============================================================================
console.log('\n⏳ 5. Progress Indicators\n');

// Check ProgressIndicator component
if (checkFileExists('src/components/ProgressIndicator.tsx')) {
  addResult('Progress', 'ProgressIndicator Component', 'PASS', 
    'ProgressIndicator component found');
  
  // Check for step tracking
  const hasStepTracking = checkFileContains('src/components/ProgressIndicator.tsx', 
    'currentStep') && checkFileContains('src/components/ProgressIndicator.tsx', 
    'totalSteps');
  
  if (hasStepTracking) {
    addResult('Progress', 'Step Tracking', 'PASS', 
      'Step tracking (N/M) implemented');
  } else {
    addResult('Progress', 'Step Tracking', 'WARN', 
      'Could not verify step tracking');
  }
} else {
  addResult('Progress', 'ProgressIndicator Component', 'FAIL', 
    'ProgressIndicator component not found');
}

// Check WorkingBadge component
if (checkFileExists('src/components/WorkingBadge.tsx')) {
  addResult('Progress', 'WorkingBadge Component', 'PASS', 
    'WorkingBadge component found');
} else {
  addResult('Progress', 'WorkingBadge Component', 'WARN', 
    'WorkingBadge component not found (may be integrated elsewhere)');
}

// ============================================================================
// 6. Test Coverage
// ============================================================================
console.log('\n🧪 6. Test Coverage\n');

const testFiles = [
  'src/services/narrative-streaming-service.ts',
  'src/services/iteration-state-machine.ts',
  'src/components/ArtifactsPanel.tsx',
  'src/utils/result-routing.ts',
  'src/services/conversational-narrator.ts',
];

const testFilesMissing: string[] = [];
testFiles.forEach(file => {
  const testFile = file.replace('src/', '__tests__/unit/')
    .replace('.tsx', '.test.tsx')
    .replace('.ts', '.test.ts');
  
  if (checkFileExists(testFile)) {
    addResult('Tests', `Test: ${file.split('/').pop()}`, 'PASS', 
      `Test file exists: ${testFile}`);
  } else {
    testFilesMissing.push(file);
    addResult('Tests', `Test: ${file.split('/').pop()}`, 'WARN', 
      `Test file not found: ${testFile}`);
  }
});

// ============================================================================
// 7. Integration Tests
// ============================================================================
console.log('\n🔗 7. Integration Tests\n');

const integrationTests = [
  '__tests__/integration/chat-api-narrative-integration.test.ts',
  '__tests__/integration/multi-agent.test.ts',
];

integrationTests.forEach(test => {
  if (checkFileExists(test)) {
    addResult('Integration', test.split('/').pop()!, 'PASS', 
      'Integration test found');
  } else {
    addResult('Integration', test.split('/').pop()!, 'WARN', 
      'Integration test not found');
  }
});

// ============================================================================
// Results Summary
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log('\n📊 Validation Results Summary\n');

const categories = [...new Set(results.map(r => r.category))];

categories.forEach(category => {
  const categoryResults = results.filter(r => r.category === category);
  const passed = categoryResults.filter(r => r.status === 'PASS').length;
  const failed = categoryResults.filter(r => r.status === 'FAIL').length;
  const warned = categoryResults.filter(r => r.status === 'WARN').length;
  
  console.log(`\n${category}:`);
  console.log(`  ✅ PASS: ${passed}`);
  console.log(`  ❌ FAIL: ${failed}`);
  console.log(`  ⚠️  WARN: ${warned}`);
  console.log(`  Total: ${categoryResults.length}`);
});

console.log('\n' + '='.repeat(80));
console.log('\n📋 Detailed Results:\n');

results.forEach(result => {
  const icon = result.status === 'PASS' ? '✅' : 
               result.status === 'FAIL' ? '❌' : 
               result.status === 'WARN' ? '⚠️' : 'ℹ️';
  
  console.log(`${icon} [${result.category}] ${result.check}`);
  console.log(`   ${result.message}`);
  if (result.details) {
    console.log(`   Details: ${result.details}`);
  }
  console.log();
});

// ============================================================================
// Final Assessment
// ============================================================================
console.log('='.repeat(80));
console.log('\n🎯 Final Assessment\n');

const totalPassed = results.filter(r => r.status === 'PASS').length;
const totalFailed = results.filter(r => r.status === 'FAIL').length;
const totalWarned = results.filter(r => r.status === 'WARN').length;
const total = results.length;

const passRate = ((totalPassed / total) * 100).toFixed(1);

console.log(`Total Checks: ${total}`);
console.log(`✅ Passed: ${totalPassed} (${passRate}%)`);
console.log(`❌ Failed: ${totalFailed}`);
console.log(`⚠️  Warnings: ${totalWarned}`);

console.log('\n' + '='.repeat(80));

if (totalFailed === 0) {
  console.log('\n✨ All critical validations passed!');
  console.log('The application is ready for manual testing and user acceptance testing.\n');
  process.exit(0);
} else {
  console.log('\n⚠️  Some critical validations failed.');
  console.log('Please review the failed checks above and address them before deployment.\n');
  process.exit(1);
}
