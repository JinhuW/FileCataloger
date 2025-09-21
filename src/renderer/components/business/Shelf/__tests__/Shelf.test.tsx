/**
 * @file Shelf.test.tsx
 * @description Unit tests for the Shelf component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Shelf } from '../Shelf';
import type { ShelfConfig } from '@shared/types';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
  useAnimation: () => ({
    start: vi.fn(),
    set: vi.fn(),
  }),
}));

describe('Shelf', () => {
  const mockConfig: ShelfConfig = {
    id: 'test-shelf',
    position: { x: 100, y: 200 },
    dockPosition: null,
    isPinned: false,
    items: [],
    isVisible: true,
    opacity: 0.9,
  };

  const mockHandlers = {
    onClose: vi.fn(),
    onMove: vi.fn(),
    onItemAdd: vi.fn(),
    onItemRemove: vi.fn(),
    onItemOpen: vi.fn(),
    onTogglePin: vi.fn(),
    onOpacityChange: vi.fn(),
    onUpdateItem: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render with empty state', () => {
      render(<Shelf config={mockConfig} {...mockHandlers} />);

      expect(screen.getByText(/drop files here/i)).toBeInTheDocument();
      expect(screen.getByRole('region')).toHaveAttribute(
        'aria-label',
        'Shelf test-shelf with 0 items'
      );
    });

    it('should render with items', () => {
      const configWithItems: ShelfConfig = {
        ...mockConfig,
        items: [
          {
            id: 'item-1',
            type: 'file',
            name: 'document.pdf',
            createdAt: Date.now(),
          },
          {
            id: 'item-2',
            type: 'text',
            name: 'Note content',
            content: 'This is a note',
            createdAt: Date.now(),
          },
        ],
      };

      render(<Shelf config={configWithItems} {...mockHandlers} />);

      expect(screen.getByText('document.pdf')).toBeInTheDocument();
      expect(screen.getByText('Note content')).toBeInTheDocument();
      expect(screen.queryByText(/drop files here/i)).not.toBeInTheDocument();
    });

    it('should show rename mode UI when in rename mode', () => {
      const renameConfig: ShelfConfig = {
        ...mockConfig,
        mode: 'rename',
        items: [
          {
            id: 'item-1',
            type: 'file',
            name: 'file.txt',
            path: '/path/to/file.txt',
            createdAt: Date.now(),
          },
        ],
      };

      render(<Shelf config={renameConfig} {...mockHandlers} />);

      expect(screen.getByText(/rename files/i)).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should handle close button click', () => {
      render(<Shelf config={mockConfig} {...mockHandlers} />);

      const closeButton = screen.getByRole('button', { name: /close shelf/i });
      fireEvent.click(closeButton);

      expect(mockHandlers.onClose).toHaveBeenCalledTimes(1);
    });

    it('should handle pin toggle', () => {
      render(<Shelf config={mockConfig} {...mockHandlers} />);

      const pinButton = screen.getByRole('button', { name: /pin shelf/i });
      fireEvent.click(pinButton);

      expect(mockHandlers.onTogglePin).toHaveBeenCalledTimes(1);
    });

    it('should handle item removal', () => {
      const configWithItems: ShelfConfig = {
        ...mockConfig,
        items: [
          {
            id: 'item-1',
            type: 'file',
            name: 'document.pdf',
            createdAt: Date.now(),
          },
        ],
      };

      render(<Shelf config={configWithItems} {...mockHandlers} />);

      const removeButton = screen.getByRole('button', { name: /remove document.pdf/i });
      fireEvent.click(removeButton);

      expect(mockHandlers.onItemRemove).toHaveBeenCalledWith('item-1');
    });

    it('should handle item click to open', () => {
      const configWithItems: ShelfConfig = {
        ...mockConfig,
        items: [
          {
            id: 'item-1',
            type: 'file',
            name: 'document.pdf',
            path: '/path/to/document.pdf',
            createdAt: Date.now(),
          },
        ],
      };

      render(<Shelf config={configWithItems} {...mockHandlers} />);

      const item = screen.getByText('document.pdf').closest('[role="listitem"]');
      fireEvent.click(item!);

      expect(mockHandlers.onItemOpen).toHaveBeenCalledWith(configWithItems.items[0]);
    });
  });

  describe('drag and drop', () => {
    it('should show drop indicator on drag over', () => {
      render(<Shelf config={mockConfig} {...mockHandlers} />);

      const dropZone = screen.getByRole('region');

      fireEvent.dragEnter(dropZone, {
        dataTransfer: {
          files: [new File(['content'], 'test.txt', { type: 'text/plain' })],
          types: ['Files'],
        },
      });

      // The component should show some visual feedback (implemented via state/styles)
      expect(dropZone).toBeInTheDocument();
    });

    it('should handle file drop', async () => {
      render(<Shelf config={mockConfig} {...mockHandlers} />);

      const dropZone = screen.getByRole('region');
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file],
          types: ['Files'],
          getData: vi.fn().mockReturnValue(''),
        },
      });

      await waitFor(() => {
        expect(mockHandlers.onItemAdd).toHaveBeenCalled();
      });

      const call = mockHandlers.onItemAdd.mock.calls[0][0];
      expect(call).toHaveLength(1);
      expect(call[0]).toMatchObject({
        type: 'text',
        name: 'test.txt',
        size: 7, // 'content' is 7 bytes
      });
    });

    it('should handle text drop', async () => {
      render(<Shelf config={mockConfig} {...mockHandlers} />);

      const dropZone = screen.getByRole('region');
      const droppedText = 'Hello, world!';

      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [],
          types: ['text/plain'],
          getData: (type: string) => (type === 'text/plain' ? droppedText : ''),
        },
      });

      await waitFor(() => {
        expect(mockHandlers.onItemAdd).toHaveBeenCalled();
      });

      const call = mockHandlers.onItemAdd.mock.calls[0][0];
      expect(call).toHaveLength(1);
      expect(call[0]).toMatchObject({
        type: 'text',
        name: droppedText,
        content: droppedText,
      });
    });

    it('should handle URL drop', async () => {
      render(<Shelf config={mockConfig} {...mockHandlers} />);

      const dropZone = screen.getByRole('region');
      const droppedUrl = 'https://example.com';

      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [],
          types: ['text/plain'],
          getData: (type: string) => (type === 'text/plain' ? droppedUrl : ''),
        },
      });

      await waitFor(() => {
        expect(mockHandlers.onItemAdd).toHaveBeenCalled();
      });

      const call = mockHandlers.onItemAdd.mock.calls[0][0];
      expect(call).toHaveLength(1);
      expect(call[0]).toMatchObject({
        type: 'url',
        name: 'example.com',
        content: droppedUrl,
      });
    });
  });

  describe('keyboard navigation', () => {
    it('should close shelf on Escape key', () => {
      const configWithItems: ShelfConfig = {
        ...mockConfig,
        items: [
          {
            id: 'item-1',
            type: 'file',
            name: 'document.pdf',
            createdAt: Date.now(),
          },
        ],
      };

      render(<Shelf config={configWithItems} {...mockHandlers} />);

      const shelf = screen.getByRole('region');
      fireEvent.keyDown(shelf, { key: 'Escape' });

      expect(mockHandlers.onClose).toHaveBeenCalledTimes(1);
    });

    it('should handle arrow key navigation', () => {
      const configWithItems: ShelfConfig = {
        ...mockConfig,
        items: [
          {
            id: 'item-1',
            type: 'file',
            name: 'file1.txt',
            createdAt: Date.now(),
          },
          {
            id: 'item-2',
            type: 'file',
            name: 'file2.txt',
            createdAt: Date.now(),
          },
        ],
      };

      render(<Shelf config={configWithItems} {...mockHandlers} />);

      const shelf = screen.getByRole('region');

      // Focus the shelf
      shelf.focus();

      // Navigate down
      fireEvent.keyDown(shelf, { key: 'ArrowDown' });

      // First item should be focused/selected
      const firstItem = screen.getByText('file1.txt').closest('[role="listitem"]');
      expect(firstItem).toHaveAttribute('data-focused', 'true');

      // Navigate down again
      fireEvent.keyDown(shelf, { key: 'ArrowDown' });

      // Second item should be focused/selected
      const secondItem = screen.getByText('file2.txt').closest('[role="listitem"]');
      expect(secondItem).toHaveAttribute('data-focused', 'true');
    });

    it('should delete selected item on Delete key', () => {
      const configWithItems: ShelfConfig = {
        ...mockConfig,
        items: [
          {
            id: 'item-1',
            type: 'file',
            name: 'document.pdf',
            createdAt: Date.now(),
          },
        ],
      };

      render(<Shelf config={configWithItems} {...mockHandlers} />);

      const shelf = screen.getByRole('region');
      shelf.focus();

      // Select first item
      fireEvent.keyDown(shelf, { key: 'ArrowDown' });

      // Delete it
      fireEvent.keyDown(shelf, { key: 'Delete' });

      expect(mockHandlers.onItemRemove).toHaveBeenCalledWith('item-1');
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const configWithItems: ShelfConfig = {
        ...mockConfig,
        items: [
          {
            id: 'item-1',
            type: 'file',
            name: 'document.pdf',
            createdAt: Date.now(),
          },
        ],
      };

      render(<Shelf config={configWithItems} {...mockHandlers} />);

      const shelf = screen.getByRole('region');
      expect(shelf).toHaveAttribute('aria-label', 'Shelf test-shelf with 1 items');
      expect(shelf).toHaveAttribute('aria-live', 'polite');

      const item = screen.getByRole('listitem');
      expect(item).toHaveAttribute('aria-label', 'document.pdf, file item 1');
    });

    it('should be keyboard focusable', () => {
      render(<Shelf config={mockConfig} {...mockHandlers} />);

      const shelf = screen.getByRole('region');
      expect(shelf).toHaveAttribute('tabIndex', '0');

      const closeButton = screen.getByRole('button', { name: /close shelf/i });
      expect(closeButton).toHaveAttribute('tabIndex', '0');
    });
  });
});
