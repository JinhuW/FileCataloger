import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner, LoadingOverlay } from '../LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders with default size', () => {
    const { container } = render(<LoadingSpinner />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
  });

  it('renders with small size', () => {
    const { container } = render(<LoadingSpinner size="small" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '16');
    expect(svg).toHaveAttribute('height', '16');
  });

  it('renders with large size', () => {
    const { container } = render(<LoadingSpinner size="large" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '32');
    expect(svg).toHaveAttribute('height', '32');
  });

  it('applies custom color', () => {
    const { container } = render(<LoadingSpinner color="#ff0000" />);
    const circles = container.querySelectorAll('circle');
    circles.forEach(circle => {
      expect(circle).toHaveAttribute('stroke', '#ff0000');
    });
  });

  it('applies custom styles', () => {
    const { container } = render(<LoadingSpinner style={{ margin: '10px' }} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveStyle({ margin: '10px' });
  });
});

describe('LoadingOverlay', () => {
  it('renders without message', () => {
    render(<LoadingOverlay />);
    const overlay = screen.getByRole('img', { hidden: true }).parentElement?.parentElement;
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveStyle({
      position: 'absolute',
      display: 'flex',
      backdropFilter: 'blur(4px)',
    });
  });

  it('renders with message', () => {
    render(<LoadingOverlay message="Loading data..." />);
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  it('includes a LoadingSpinner', () => {
    const { container } = render(<LoadingOverlay />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '32'); // Large size
  });

  it('has proper z-index for overlay', () => {
    render(<LoadingOverlay />);
    const overlay = screen.getByRole('img', { hidden: true }).parentElement?.parentElement;
    expect(overlay).toHaveStyle({ zIndex: '100' });
  });
});
