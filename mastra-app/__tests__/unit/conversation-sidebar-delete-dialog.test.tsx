import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationSidebar } from '@/components/ConversationSidebar';
import { Conversation } from '@/types';

// Mock fetch
global.fetch = vi.fn();

describe('ConversationSidebar - Delete Confirmation Dialog', () => {
  const mockConversations: Conversation[] = [
    {
      id: '1',
      title: 'Test Conversation',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: '2',
      title: 'Another Conversation',
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockConversations,
    });
  });

  it('should show delete confirmation dialog when delete button is clicked', async () => {
    const onSelectConversation = vi.fn();
    const onNewConversation = vi.fn();
    const onDeleteConversation = vi.fn();

    render(
      <ConversationSidebar
        currentConversationId="1"
        onSelectConversation={onSelectConversation}
        onNewConversation={onNewConversation}
        onDeleteConversation={onDeleteConversation}
        dbConnected={true}
      />
    );

    // Wait for conversations to load
    await waitFor(() => {
      expect(screen.getByText('Test Conversation')).toBeInTheDocument();
    });

    // Find the conversation item and hover to show action buttons
    const conversationItem = screen.getByText('Test Conversation').closest('button');
    expect(conversationItem).toBeInTheDocument();

    // Find delete button (it should be in the hover actions)
    const deleteButtons = screen.getAllByLabelText('Delete conversation');
    const deleteButton = deleteButtons[0];
    
    // Click delete button
    fireEvent.click(deleteButton);

    // Dialog should appear
    await waitFor(() => {
      expect(screen.getByText('Delete conversation')).toBeInTheDocument();
    });

    // Dialog should show the conversation title
    expect(screen.getByText(/Test Conversation/)).toBeInTheDocument();
    expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument();
  });

  it('should close dialog when Cancel is clicked', async () => {
    const onSelectConversation = vi.fn();
    const onNewConversation = vi.fn();
    const onDeleteConversation = vi.fn();

    render(
      <ConversationSidebar
        currentConversationId="1"
        onSelectConversation={onSelectConversation}
        onNewConversation={onNewConversation}
        onDeleteConversation={onDeleteConversation}
        dbConnected={true}
      />
    );

    // Wait for conversations to load
    await waitFor(() => {
      expect(screen.getByText('Test Conversation')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButtons = screen.getAllByLabelText('Delete conversation');
    fireEvent.click(deleteButtons[0]);

    // Wait for dialog
    await waitFor(() => {
      expect(screen.getByText('Delete conversation')).toBeInTheDocument();
    });

    // Click Cancel
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByText('Delete conversation')).not.toBeInTheDocument();
    });

    // Delete should not have been called
    expect(onDeleteConversation).not.toHaveBeenCalled();
  });

  it('should delete conversation when Delete is clicked', async () => {
    const onSelectConversation = vi.fn();
    const onNewConversation = vi.fn();
    const onDeleteConversation = vi.fn();

    // Mock successful delete
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockConversations,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

    render(
      <ConversationSidebar
        currentConversationId="1"
        onSelectConversation={onSelectConversation}
        onNewConversation={onNewConversation}
        onDeleteConversation={onDeleteConversation}
        dbConnected={true}
      />
    );

    // Wait for conversations to load
    await waitFor(() => {
      expect(screen.getByText('Test Conversation')).toBeInTheDocument();
    });

    // Find the Test Conversation item
    const testConversationItem = screen.getByText('Test Conversation').closest('button');
    expect(testConversationItem).toBeInTheDocument();

    // Find the delete button within the Test Conversation item
    const deleteButtonInItem = testConversationItem!.querySelector('[aria-label="Delete conversation"]') as HTMLElement;
    expect(deleteButtonInItem).toBeInTheDocument();
    
    // Click delete button
    fireEvent.click(deleteButtonInItem);

    // Wait for dialog
    await waitFor(() => {
      expect(screen.getByText('Delete conversation')).toBeInTheDocument();
    });

    // Click Delete
    const deleteButton = screen.getByRole('button', { name: /Delete/i });
    fireEvent.click(deleteButton);

    // Callback should be called
    await waitFor(() => {
      expect(onDeleteConversation).toHaveBeenCalledWith('1');
    });
  });

  it('should show conversation title in dialog', async () => {
    const onSelectConversation = vi.fn();
    const onNewConversation = vi.fn();
    const onDeleteConversation = vi.fn();

    render(
      <ConversationSidebar
        currentConversationId="2"
        onSelectConversation={onSelectConversation}
        onNewConversation={onNewConversation}
        onDeleteConversation={onDeleteConversation}
        dbConnected={true}
      />
    );

    // Wait for conversations to load
    await waitFor(() => {
      expect(screen.getByText('Another Conversation')).toBeInTheDocument();
    });

    // Click delete button for second conversation
    const deleteButtons = screen.getAllByLabelText('Delete conversation');
    fireEvent.click(deleteButtons[1]);

    // Dialog should show the correct conversation title
    await waitFor(() => {
      expect(screen.getByText(/Another Conversation/)).toBeInTheDocument();
    });
  });

  it('should show "Untitled" for conversations without a title', async () => {
    const conversationsWithoutTitle: Conversation[] = [
      {
        id: '1',
        title: '',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    ];

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => conversationsWithoutTitle,
    });

    const onSelectConversation = vi.fn();
    const onNewConversation = vi.fn();
    const onDeleteConversation = vi.fn();

    render(
      <ConversationSidebar
        currentConversationId="1"
        onSelectConversation={onSelectConversation}
        onNewConversation={onNewConversation}
        onDeleteConversation={onDeleteConversation}
        dbConnected={true}
      />
    );

    // Wait for conversations to load
    await waitFor(() => {
      expect(screen.getByText('Untitled')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButtons = screen.getAllByLabelText('Delete conversation');
    fireEvent.click(deleteButtons[0]);

    // Dialog should show "Untitled"
    await waitFor(() => {
      const dialogTitle = screen.getByRole('heading', { name: /Delete conversation/i });
      expect(dialogTitle).toBeInTheDocument();
      // Check that the dialog description contains "Untitled"
      const dialogDescription = screen.getByText(/Are you sure you want to delete/);
      expect(dialogDescription).toHaveTextContent('Untitled');
    });
  });
});
