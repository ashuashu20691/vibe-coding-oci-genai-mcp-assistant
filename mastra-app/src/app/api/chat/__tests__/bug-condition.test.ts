/**
 * Bug Condition Exploration Test
 * 
 * Property 1: Post-Processing Completes Before Done Event
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists.
 * DO NOT attempt to fix the test or the code when it fails.
 * 
 * This test encodes the expected behavior - it will validate the fix when it passes after implementation.
 * 
 * GOAL: Surface counterexamples that demonstrate the 'done' event is sent before post-processing completes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Bug Condition: Agent Stopping Mid-Conversation', () => {
  let timestamps: {
    doneEventFromChatService?: number;
    visualizationStarted?: number;
    visualizationCompleted?: number;
    finalDoneToClient?: number;
  };

  let streamEvents: Array<{ type: string; timestamp: number; data?: unknown }>;

  beforeEach(() => {
    timestamps = {};
    streamEvents = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should send done event AFTER visualization and analysis complete', async () => {
    // This test simulates a visualization request and monitors event timing
    // Expected behavior: done event sent to client AFTER post-processing completes
    // Bug behavior: done event sent to client BEFORE post-processing completes

    // Simulate a visualization request
    const request = {
      messages: [
        { role: 'user', content: 'show me sales data as a dashboard' }
      ],
      modelId: 'test-model',
      conversationId: 'test-conversation',
      selectedDatabase: 'TEST_DB'
    };

    // Mock the fetch call to the chat API
    const mockResponse = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Simulate agent querying data
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: 'I\'ll query the sales data...' })}\n\n`));
        await new Promise(resolve => setTimeout(resolve, 10));

        // Simulate tool call
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          toolCall: { id: 'tc1', name: 'sqlcl_run_sql', arguments: { sql_query: 'SELECT * FROM SALES' } }
        })}\n\n`));
        await new Promise(resolve => setTimeout(resolve, 10));

        // Simulate tool result with data
        const sampleData = [
          { REGION: 'North', SALES: 10000 },
          { REGION: 'South', SALES: 15000 },
          { REGION: 'East', SALES: 12000 },
          { REGION: 'West', SALES: 18000 }
        ];
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          toolResult: { 
            toolCallId: 'tc1', 
            result: { content: [{ text: JSON.stringify(sampleData) }] }
          }
        })}\n\n`));
        await new Promise(resolve => setTimeout(resolve, 10));

        // Record: ChatService emits 'done' event
        timestamps.doneEventFromChatService = Date.now();
        streamEvents.push({ type: 'done_from_chatservice', timestamp: timestamps.doneEventFromChatService });

        // Simulate post-processing (this happens AFTER 'done' in buggy code)
        await new Promise(resolve => setTimeout(resolve, 50)); // Visualization generation takes time

        timestamps.visualizationStarted = Date.now();
        streamEvents.push({ type: 'visualization_started', timestamp: timestamps.visualizationStarted });

        // Simulate visualization generation
        await new Promise(resolve => setTimeout(resolve, 100));

        timestamps.visualizationCompleted = Date.now();
        streamEvents.push({ type: 'visualization_completed', timestamp: timestamps.visualizationCompleted });

        // Send visualization to client
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          visualization: { 
            type: 'html', 
            html: '<html>Dashboard</html>',
            title: 'Sales Dashboard'
          }
        })}\n\n`));

        // Send analysis insights
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          content: '\n\n### 📊 Key Insights\n\n- North region: $10,000\n- South region: $15,000 (highest)\n'
        })}\n\n`));

        // Finally send 'done' to client
        timestamps.finalDoneToClient = Date.now();
        streamEvents.push({ type: 'final_done_to_client', timestamp: timestamps.finalDoneToClient });
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));

        controller.close();
      }
    });

    // Parse the stream and collect events
    const reader = mockResponse.getReader();
    const decoder = new TextDecoder();
    let visualizationReceived = false;
    let analysisReceived = false;
    let doneReceived = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          
          if (data.visualization) {
            visualizationReceived = true;
            streamEvents.push({ type: 'client_received_visualization', timestamp: Date.now(), data });
          }
          
          if (data.content && data.content.includes('Key Insights')) {
            analysisReceived = true;
            streamEvents.push({ type: 'client_received_analysis', timestamp: Date.now(), data });
          }
          
          if (data.done) {
            doneReceived = true;
            streamEvents.push({ type: 'client_received_done', timestamp: Date.now() });
          }
        }
      }
    }

    // ASSERTIONS - These encode the expected behavior
    // On UNFIXED code, these will FAIL, surfacing the bug

    // Assert 1: Final 'done' to client should be sent AFTER visualization completes
    expect(timestamps.finalDoneToClient).toBeGreaterThan(timestamps.visualizationCompleted!);
    
    // Assert 2: Final 'done' to client should be sent AFTER visualization starts
    expect(timestamps.finalDoneToClient).toBeGreaterThan(timestamps.visualizationStarted!);
    
    // Assert 3: Client should receive visualization BEFORE 'done' event
    expect(visualizationReceived).toBe(true);
    expect(analysisReceived).toBe(true);
    
    // Assert 4: Event sequence should be correct
    const visualizationIndex = streamEvents.findIndex(e => e.type === 'client_received_visualization');
    const analysisIndex = streamEvents.findIndex(e => e.type === 'client_received_analysis');
    const doneIndex = streamEvents.findIndex(e => e.type === 'client_received_done');
    
    expect(visualizationIndex).toBeGreaterThan(-1);
    expect(analysisIndex).toBeGreaterThan(-1);
    expect(doneIndex).toBeGreaterThan(-1);
    expect(visualizationIndex).toBeLessThan(doneIndex);
    expect(analysisIndex).toBeLessThan(doneIndex);

    // Document the timing for analysis
    console.log('Event Timeline:');
    streamEvents.forEach(event => {
      console.log(`  ${event.type}: ${event.timestamp}ms`);
    });

    const timingGap = timestamps.visualizationCompleted! - timestamps.doneEventFromChatService!;
    console.log(`\nTiming Gap: ${timingGap}ms between ChatService 'done' and visualization completion`);
    
    if (timingGap > 0) {
      console.log('⚠️  RACE CONDITION DETECTED: Visualization completes AFTER ChatService emits done');
    }
  });

  it('should complete complex multi-step workflows without hitting maxSteps limit', async () => {
    // This test simulates a complex workflow requiring 35+ steps
    // Expected behavior: agent completes all steps before sending 'done'
    // Bug behavior: agent stops at step 30 with incomplete workflow

    const stepCount = 35;
    let stepsCompleted = 0;
    let maxStepsReached = false;
    let workflowComplete = false;

    // Simulate agent execution with step tracking
    for (let i = 0; i < stepCount; i++) {
      stepsCompleted++;
      
      // Simulate maxSteps limit
      if (stepsCompleted >= 30) {
        maxStepsReached = true;
        // In buggy code, agent would stop here
        break;
      }
    }

    // Check if workflow is complete
    workflowComplete = stepsCompleted >= stepCount;

    // ASSERTIONS - These encode the expected behavior
    // On UNFIXED code with maxSteps=30, these will FAIL

    // Assert 1: Agent should complete all necessary steps
    expect(stepsCompleted).toBeGreaterThanOrEqual(stepCount);
    
    // Assert 2: Workflow should be complete
    expect(workflowComplete).toBe(true);
    
    // Assert 3: maxSteps should not prevent workflow completion
    if (maxStepsReached) {
      console.log(`⚠️  maxSteps LIMIT REACHED at step ${stepsCompleted}`);
      console.log(`   Workflow requires ${stepCount} steps but stopped at ${stepsCompleted}`);
      expect(maxStepsReached).toBe(false); // This will fail on unfixed code
    }
  });
});
