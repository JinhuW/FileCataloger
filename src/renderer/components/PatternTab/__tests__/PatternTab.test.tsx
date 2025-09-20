import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PatternTab } from '../PatternTab';

describe('PatternTab', () => {
  const defaultProps = {
    id: 'test-pattern',
    name: 'Test Pattern',
    active: false,
    editable: true,
    onClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the pattern name', () => {
    render(<PatternTab {...defaultProps} />);
    expect(screen.getByText('Test Pattern')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    render(<PatternTab {...defaultProps} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(defaultProps.onClick).toHaveBeenCalledTimes(1);
  });

  it('shows active state styling', () => {
    render(<PatternTab {...defaultProps} active={true} />);
    const button = screen.getByRole('button');
    expect(button).toHaveStyle({ background: 'rgba(59, 130, 246, 0.2)' });
  });

  it('shows close button for editable patterns', () => {
    const onClose = vi.fn();
    render(<PatternTab {...defaultProps} onClose={onClose} />);
    const closeButton = screen.getByLabelText(`Close ${defaultProps.name} pattern`);
    expect(closeButton).toBeInTheDocument();

    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not show close button for non-editable patterns', () => {
    render(<PatternTab {...defaultProps} editable={false} />);
    expect(screen.queryByLabelText(`Close ${defaultProps.name} pattern`)).not.toBeInTheDocument();
  });

  it('enters rename mode on double click for editable patterns', async () => {
    const onRename = vi.fn();
    render(<PatternTab {...defaultProps} onRename={onRename} />);

    const button = screen.getByRole('button');
    await userEvent.dblClick(button);

    const input = screen.getByLabelText('Rename pattern');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('Test Pattern');
  });

  it('saves renamed pattern on Enter key', async () => {
    const onRename = vi.fn();
    render(<PatternTab {...defaultProps} onRename={onRename} />);

    const button = screen.getByRole('button');
    await userEvent.dblClick(button);

    const input = screen.getByLabelText('Rename pattern');
    await userEvent.clear(input);
    await userEvent.type(input, 'New Pattern Name');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(onRename).toHaveBeenCalledWith('New Pattern Name');
    });
  });

  it('cancels rename on Escape key', async () => {
    const onRename = vi.fn();
    render(<PatternTab {...defaultProps} onRename={onRename} />);

    const button = screen.getByRole('button');
    await userEvent.dblClick(button);

    const input = screen.getByLabelText('Rename pattern');
    await userEvent.clear(input);
    await userEvent.type(input, 'New Pattern Name');
    await userEvent.keyboard('{Escape}');

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByText('Test Pattern')).toBeInTheDocument();
  });

  it('supports drag and drop operations', () => {
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();
    const onDragOver = vi.fn();
    const onDrop = vi.fn();

    render(
      <PatternTab
        {...defaultProps}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDrop={onDrop}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('draggable', 'true');

    fireEvent.dragStart(button);
    expect(onDragStart).toHaveBeenCalled();

    fireEvent.dragEnd(button);
    expect(onDragEnd).toHaveBeenCalled();

    fireEvent.dragOver(button);
    expect(onDragOver).toHaveBeenCalled();

    fireEvent.drop(button);
    expect(onDrop).toHaveBeenCalled();
  });

  it('shows dragging state', () => {
    render(<PatternTab {...defaultProps} isDragging={true} />);
    const container = screen.getByRole('button').parentElement;
    expect(container).toHaveStyle({ opacity: '0.5' });
  });

  it('handles context menu', () => {
    const onContextMenu = vi.fn();
    render(<PatternTab {...defaultProps} onContextMenu={onContextMenu} />);

    const button = screen.getByRole('button');
    fireEvent.contextMenu(button);
    expect(onContextMenu).toHaveBeenCalled();
  });

  it('has proper accessibility attributes', () => {
    render(<PatternTab {...defaultProps} active={true} />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', `Pattern: ${defaultProps.name}`);
    expect(button).toHaveAttribute('aria-current', 'page');
  });
});
