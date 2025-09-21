import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders with title only', () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('renders with icon', () => {
    render(<EmptyState icon="📁" title="No files" />);
    expect(screen.getByText('📁')).toBeInTheDocument();
    expect(screen.getByText('No files')).toBeInTheDocument();
  });

  it('renders with description', () => {
    render(
      <EmptyState title="No patterns" description="Create your first pattern to get started" />
    );
    expect(screen.getByText('No patterns')).toBeInTheDocument();
    expect(screen.getByText('Create your first pattern to get started')).toBeInTheDocument();
  });

  it('renders with action button', () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        title="No items"
        action={{
          label: 'Add Item',
          onClick: handleClick,
        }}
      />
    );

    const button = screen.getByText('Add Item');
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe('BUTTON');
  });

  it('calls action onClick when button is clicked', () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        title="No items"
        action={{
          label: 'Add Item',
          onClick: handleClick,
        }}
      />
    );

    const button = screen.getByText('Add Item');
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies custom styles', () => {
    const { container } = render(
      <EmptyState title="No items" style={{ backgroundColor: 'red', padding: '20px' }} />
    );

    const emptyState = container.firstChild as HTMLElement;
    expect(emptyState).toHaveStyle({
      backgroundColor: 'red',
      padding: '20px',
    });
  });

  it('renders full example with all props', () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        icon="🎯"
        title="No patterns created"
        description="Start building your custom naming patterns"
        action={{
          label: 'Create Pattern',
          onClick: handleClick,
        }}
      />
    );

    expect(screen.getByText('🎯')).toBeInTheDocument();
    expect(screen.getByText('No patterns created')).toBeInTheDocument();
    expect(screen.getByText('Start building your custom naming patterns')).toBeInTheDocument();
    expect(screen.getByText('Create Pattern')).toBeInTheDocument();
  });

  it('has proper layout styling', () => {
    const { container } = render(<EmptyState title="No items" />);
    const emptyState = container.firstChild as HTMLElement;

    expect(emptyState).toHaveStyle({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
    });
  });

  it('icon has proper styling', () => {
    render(<EmptyState icon="📁" title="No files" />);
    const iconElement = screen.getByText('📁').parentElement;

    expect(iconElement).toHaveStyle({
      fontSize: '48px',
      marginBottom: '16px',
      opacity: '0.8',
    });
  });

  it('title has proper styling', () => {
    render(<EmptyState title="No items found" />);
    const titleElement = screen.getByText('No items found');

    expect(titleElement.tagName).toBe('H3');
    expect(titleElement).toHaveStyle({
      color: 'rgba(255, 255, 255, 0.9)',
      fontSize: '16px',
      fontWeight: '600',
    });
  });
});
