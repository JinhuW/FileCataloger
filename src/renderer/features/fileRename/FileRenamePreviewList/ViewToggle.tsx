import React from 'react';
import { motion } from 'framer-motion';

export type ViewMode = 'list' | 'tree';

interface ViewToggleProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}

export const ViewToggle: React.FC<ViewToggleProps> = ({ view, onChange }) => {
  return (
    <div
      style={{
        display: 'flex',
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        borderRadius: 6,
        padding: 2,
        gap: 2,
        position: 'relative',
      }}
    >
      {/* Background indicator */}
      <motion.div
        layout
        layoutId="view-toggle-bg"
        style={{
          position: 'absolute',
          top: 2,
          left: view === 'list' ? 2 : '50%',
          width: 'calc(50% - 3px)',
          height: 'calc(100% - 4px)',
          backgroundColor: 'rgba(66, 153, 225, 0.3)',
          borderRadius: 4,
          border: '1px solid rgba(66, 153, 225, 0.5)',
        }}
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 30,
        }}
      />

      {/* List View Button */}
      <button
        onClick={() => onChange('list')}
        style={{
          position: 'relative',
          zIndex: 1,
          background: 'none',
          border: 'none',
          color: view === 'list' ? '#4299e1' : '#718096',
          cursor: 'pointer',
          padding: '4px 12px',
          fontSize: 12,
          fontWeight: 500,
          borderRadius: 4,
          transition: 'color 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 60,
          justifyContent: 'center',
        }}
        title="List view"
      >
        {/* List icon */}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
          <rect
            x="1"
            y="2"
            width="12"
            height="2"
            rx="0.5"
            fill="currentColor"
            opacity={view === 'list' ? 1 : 0.6}
          />
          <rect
            x="1"
            y="6"
            width="12"
            height="2"
            rx="0.5"
            fill="currentColor"
            opacity={view === 'list' ? 1 : 0.6}
          />
          <rect
            x="1"
            y="10"
            width="12"
            height="2"
            rx="0.5"
            fill="currentColor"
            opacity={view === 'list' ? 1 : 0.6}
          />
        </svg>
        List
      </button>

      {/* Tree View Button */}
      <button
        onClick={() => onChange('tree')}
        style={{
          position: 'relative',
          zIndex: 1,
          background: 'none',
          border: 'none',
          color: view === 'tree' ? '#4299e1' : '#718096',
          cursor: 'pointer',
          padding: '4px 12px',
          fontSize: 12,
          fontWeight: 500,
          borderRadius: 4,
          transition: 'color 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 60,
          justifyContent: 'center',
        }}
        title="Tree view"
      >
        {/* Tree icon */}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
          <rect
            x="1"
            y="2"
            width="8"
            height="2"
            rx="0.5"
            fill="currentColor"
            opacity={view === 'tree' ? 1 : 0.6}
          />
          <rect
            x="3"
            y="6"
            width="8"
            height="2"
            rx="0.5"
            fill="currentColor"
            opacity={view === 'tree' ? 1 : 0.6}
          />
          <rect
            x="3"
            y="10"
            width="8"
            height="2"
            rx="0.5"
            fill="currentColor"
            opacity={view === 'tree' ? 1 : 0.6}
          />
          <path
            d="M2 3V10.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity={view === 'tree' ? 1 : 0.6}
          />
          <path
            d="M2 7H3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity={view === 'tree' ? 1 : 0.6}
          />
          <path
            d="M2 11H3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity={view === 'tree' ? 1 : 0.6}
          />
        </svg>
        Tree
      </button>
    </div>
  );
};
