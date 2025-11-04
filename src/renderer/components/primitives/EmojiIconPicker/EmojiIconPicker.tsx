/**
 * EmojiIconPicker.tsx
 *
 * Professional emoji picker using emoji-picker-react library.
 * Provides comprehensive emoji selection with search and categories.
 */

import React, { useRef, useEffect } from 'react';
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';

export interface EmojiIconPickerProps {
  selectedIcon: string;
  onSelect: (icon: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const EmojiIconPicker: React.FC<EmojiIconPickerProps> = ({
  selectedIcon: _selectedIcon,
  onSelect,
  isOpen,
  onClose,
}) => {
  const pickerRef = useRef<HTMLDivElement>(null);

  // Handle emoji selection
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onSelect(emojiData.emoji);
    onClose();
  };

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay to prevent immediate close
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={pickerRef}
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10000,
      }}
    >
      <EmojiPicker
        onEmojiClick={handleEmojiClick}
        theme={Theme.LIGHT}
        width={350}
        height={400}
        searchPlaceHolder="Search emojis..."
        previewConfig={{ showPreview: false }}
        emojiStyle="native"
        lazyLoadEmojis={false}
      />
    </div>
  );
};
