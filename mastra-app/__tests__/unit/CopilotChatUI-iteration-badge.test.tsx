/**
 * Integration tests for CopilotChatUI iteration badge display
 * 
 * Tests the working badge display during autonomous iteration loops.
 * Validates: Requirements 16.2
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CopilotChatUI } from '@/components/CopilotChatUI';

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

describe('CopilotChatUI - Iteration Badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock conversations API
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/api/conversations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ conversations: [] }),
        });
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  it('should display working badge when iteration_update event is received', async () => {
    // Mock chat API with iteration_update event
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/api/conversations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ conversations: [] }),
        });
      }
      
      if (url === '/api/chat') {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            // Send iteration_update event
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  iteration_update: {
                    current: 3,
                    max: 5,
                    strategy: 'Retrying with SDO_GEOM function',
                  },
                })}\n\n`
              )
            );
            
            // Send some content
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: 'Processing...' })}\n\n`)
            );
            
            // Send done
            setTimeout(() => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
              controller.close();
            }, 100);
          },
        });

        return Promise.resolve({
          ok: true,
          body: stream,
        });
      }
      
      return Promise.reject(new Error('Not found'));
    });

    render(<CopilotChatUI />);

    // Type a message
    const input = screen.getByPlaceholderText('How can I help you today?');
    fireEvent.change(input, { target: { value: 'Test query' } });
    
    // Submit the message
    const form = input.closest('form');
    if (form) {
      fireEvent.submit(form);
    }

    // Wait for the working badge to appear
    await waitFor(() => {
      expect(screen.getByText(/Working\.\.\. 3\/5/)).toBeInTheDocument();
    });

    // Verify strategy is displayed
    expect(screen.getByText('Retrying with SDO_GEOM function')).toBeInTheDocument();
  });

  it('should hide working badge when stream completes', async () => {
    // Mock chat API with iteration_update event followed by completion
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/api/conversations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ conversations: [] }),
        });
      }
      
      if (url === '/api/chat') {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            // Send iteration_update event
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  iteration_update: { current: 2, max: 5 },
                })}\n\n`
              )
            );
            
            // Send content
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: 'Done!' })}\n\n`)
            );
            
            // Send done
            setTimeout(() => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
              controller.close();
            }, 100);
          },
        });

        return Promise.resolve({
          ok: true,
          body: stream,
        });
      }
      
      return Promise.reject(new Error('Not found'));
    });

    render(<CopilotChatUI />);

    // Type and submit a message
    const input = screen.getByPlaceholderText('How can I help you today?');
    fireEvent.change(input, { target: { value: 'Test query' } });
    
    const form = input.closest('form');
    if (form) {
      fireEvent.submit(form);
    }

    // Wait for the working badge to appear
    await waitFor(() => {
      expect(screen.getByText(/Working\.\.\. 2\/5/)).toBeInTheDocument();
    });

    // Wait for the stream to complete and badge to disappear
    await waitFor(
      () => {
        expect(screen.queryByText(/Working\.\.\./)).not.toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('should update working badge when iteration count changes', async () => {
    // Mock chat API with multiple iteration_update events
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/api/conversations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ conversations: [] }),
        });
      }
      
      if (url === '/api/chat') {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            // Send first iteration
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  iteration_update: { current: 1, max: 5, strategy: 'Step 1' },
                })}\n\n`
              )
            );
            
            setTimeout(() => {
              // Send second iteration
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    iteration_update: { current: 2, max: 5, strategy: 'Step 2' },
                  })}\n\n`
                )
              );
            }, 50);
            
            setTimeout(() => {
              // Send done
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
              controller.close();
            }, 150);
          },
        });

        return Promise.resolve({
          ok: true,
          body: stream,
        });
      }
      
      return Promise.reject(new Error('Not found'));
    });

    render(<CopilotChatUI />);

    // Type and submit a message
    const input = screen.getByPlaceholderText('How can I help you today?');
    fireEvent.change(input, { target: { value: 'Test query' } });
    
    const form = input.closest('form');
    if (form) {
      fireEvent.submit(form);
    }

    // Wait for first iteration
    await waitFor(() => {
      expect(screen.getByText(/Working\.\.\. 1\/5/)).toBeInTheDocument();
      expect(screen.getByText('Step 1')).toBeInTheDocument();
    });

    // Wait for second iteration
    await waitFor(() => {
      expect(screen.getByText(/Working\.\.\. 2\/5/)).toBeInTheDocument();
      expect(screen.getByText('Step 2')).toBeInTheDocument();
    });
  });

  it('should reset iteration state on new message submission', async () => {
    let callCount = 0;
    
    // Mock chat API
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/api/conversations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ conversations: [] }),
        });
      }
      
      if (url === '/api/chat') {
        callCount++;
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            if (callCount === 1) {
              // First call - send iteration update
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    iteration_update: { current: 3, max: 5 },
                  })}\n\n`
                )
              );
            }
            
            // Send done
            setTimeout(() => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
              controller.close();
            }, 50);
          },
        });

        return Promise.resolve({
          ok: true,
          body: stream,
        });
      }
      
      return Promise.reject(new Error('Not found'));
    });

    render(<CopilotChatUI />);

    // First message
    const input = screen.getByPlaceholderText('How can I help you today?');
    fireEvent.change(input, { target: { value: 'First query' } });
    
    let form = input.closest('form');
    if (form) {
      fireEvent.submit(form);
    }

    // Wait for iteration badge
    await waitFor(() => {
      expect(screen.getByText(/Working\.\.\. 3\/5/)).toBeInTheDocument();
    });

    // Wait for completion
    await waitFor(
      () => {
        expect(screen.queryByText(/Working\.\.\./)).not.toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    // Second message - should not show iteration badge from first call
    fireEvent.change(input, { target: { value: 'Second query' } });
    form = input.closest('form');
    if (form) {
      fireEvent.submit(form);
    }

    // Badge should not appear for second call (no iteration_update event)
    await waitFor(
      () => {
        expect(screen.queryByText(/Working\.\.\./)).not.toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });
});
