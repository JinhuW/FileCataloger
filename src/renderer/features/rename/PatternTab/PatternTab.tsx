import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

export interface PatternTabProps {
  id: string;
  name: string;
  active: boolean;
  editable: boolean;
  isDragging?: boolean;
  onClick: () => void;
  onClose?: () => void;
  onRename?: (newName: string) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

export const PatternTab = React.memo<PatternTabProps>(
  ({
    id: _id,
    name,
    active,
    editable,
    isDragging = false,
    onClick,
    onClose,
    onRename,
    onContextMenu,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop,
  }) => {
    const [isRenaming, setIsRenaming] = useState(false);
    const [tempName, setTempName] = useState(name);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (isRenaming && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, [isRenaming]);

    const handleDoubleClick = () => {
      if (editable && onRename) {
        setIsRenaming(true);
        setTempName(name);
      }
    };

    const handleRename = () => {
      if (tempName.trim() && tempName !== name) {
        onRename?.(tempName.trim());
      }
      setIsRenaming(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleRename();
      } else if (e.key === 'Escape') {
        setIsRenaming(false);
        setTempName(name);
      }
    };

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{
          opacity: isDragging ? 0.5 : 1,
          scale: isDragging ? 0.95 : 1,
        }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          minWidth: '120px',
          maxWidth: '200px',
        }}
      >
        <button
          onClick={onClick}
          onDoubleClick={handleDoubleClick}
          onContextMenu={onContextMenu}
          draggable={editable && !isRenaming}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={onDragOver}
          onDrop={onDrop}
          style={{
            flex: 1,
            background: active ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
            border: '1px solid ' + (active ? '#3b82f6' : 'rgba(255, 255, 255, 0.2)'),
            borderRadius: '6px',
            padding: '6px 12px',
            paddingRight: editable && onClose ? '32px' : '12px',
            color: active ? '#3b82f6' : 'rgba(255, 255, 255, 0.6)',
            fontSize: '12px',
            cursor: isDragging ? 'grabbing' : 'pointer',
            transition: 'all 0.2s',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
          title={name}
          aria-label={`Pattern: ${name}`}
          aria-current={active ? 'page' : undefined}
        >
          {isRenaming ? (
            <input
              ref={inputRef}
              type="text"
              value={tempName}
              onChange={e => setTempName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={handleKeyDown}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'inherit',
                font: 'inherit',
                width: '100%',
                padding: 0,
                margin: 0,
              }}
              aria-label="Rename pattern"
            />
          ) : (
            name
          )}
        </button>

        {editable && onClose && (
          <button
            onClick={e => {
              e.stopPropagation();
              onClose();
            }}
            style={{
              position: 'absolute',
              right: '4px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.4)',
              cursor: 'pointer',
              padding: '4px',
              fontSize: '10px',
              borderRadius: '3px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)';
              e.currentTarget.style.background = 'transparent';
            }}
            aria-label={`Close ${name} pattern`}
          >
            ✕
          </button>
        )}
      </motion.div>
    );
  }
);

PatternTab.displayName = 'PatternTab';
