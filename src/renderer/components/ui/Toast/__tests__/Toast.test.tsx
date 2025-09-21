import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { Toast, ToastContainer } from '../Toast';

describe('Toast', () => {
  const defaultProps = {
    id: 'test-toast',
    type: 'success' as const,
    title: 'Test Toast',
    message: 'This is a test message',
    onDismiss: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders toast with title and message', () => {
    render(<Toast {...defaultProps} />);
    expect(screen.getByText('Test Toast')).toBeInTheDocument();
    expect(screen.getByText('This is a test message')).toBeInTheDocument();
  });

  it('renders success toast with correct styling', () => {
    render(<Toast {...defaultProps} type="success" />);
    const toast = screen.getByText('Test Toast').closest('div');
    expect(toast).toHaveStyle({
      background: 'rgba(34, 197, 94, 0.2)',
      border: '1px solid rgba(34, 197, 94, 0.5)',
    });
  });

  it('renders error toast with correct styling', () => {
    render(<Toast {...defaultProps} type="error" />);
    const toast = screen.getByText('Test Toast').closest('div');
    expect(toast).toHaveStyle({
      background: 'rgba(239, 68, 68, 0.2)',
      border: '1px solid rgba(239, 68, 68, 0.5)',
    });
  });

  it('renders warning toast with correct styling', () => {
    render(<Toast {...defaultProps} type="warning" />);
    const toast = screen.getByText('Test Toast').closest('div');
    expect(toast).toHaveStyle({
      background: 'rgba(245, 158, 11, 0.2)',
      border: '1px solid rgba(245, 158, 11, 0.5)',
    });
  });

  it('renders info toast with correct styling', () => {
    render(<Toast {...defaultProps} type="info" />);
    const toast = screen.getByText('Test Toast').closest('div');
    expect(toast).toHaveStyle({
      background: 'rgba(59, 130, 246, 0.2)',
      border: '1px solid rgba(59, 130, 246, 0.5)',
    });
  });

  it('calls onDismiss when close button is clicked', () => {
    render(<Toast {...defaultProps} />);
    const closeButton = screen.getByLabelText('Dismiss notification');
    fireEvent.click(closeButton);
    expect(defaultProps.onDismiss).toHaveBeenCalledWith('test-toast');
  });

  it('auto-dismisses after duration', async () => {
    render(<Toast {...defaultProps} duration={3000} />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(defaultProps.onDismiss).toHaveBeenCalledWith('test-toast');
    });
  });

  it('does not auto-dismiss when duration is 0', () => {
    render(<Toast {...defaultProps} duration={0} />);

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(defaultProps.onDismiss).not.toHaveBeenCalled();
  });

  it('renders without message', () => {
    render(<Toast {...defaultProps} message={undefined} />);
    expect(screen.getByText('Test Toast')).toBeInTheDocument();
    expect(screen.queryByText('This is a test message')).not.toBeInTheDocument();
  });

  it('shows progress bar when duration is set', () => {
    const { container } = render(<Toast {...defaultProps} duration={5000} />);
    const progressBar = container.querySelector('div[style*="transformOrigin: left"]');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveStyle({ height: '2px' });
  });

  it('does not show progress bar when duration is 0', () => {
    const { container } = render(<Toast {...defaultProps} duration={0} />);
    const progressBar = container.querySelector('div[style*="transformOrigin: left"]');
    expect(progressBar).not.toBeInTheDocument();
  });
});

describe('ToastContainer', () => {
  it('renders children', () => {
    render(
      <ToastContainer>
        <div data-testid="test-child">Test Child</div>
      </ToastContainer>
    );
    expect(screen.getByTestId('test-child')).toBeInTheDocument();
  });

  it('positions container correctly', () => {
    render(
      <ToastContainer>
        <div>Test</div>
      </ToastContainer>
    );
    const container = screen.getByText('Test').parentElement;
    expect(container).toHaveStyle({
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: '1000',
    });
  });
});
