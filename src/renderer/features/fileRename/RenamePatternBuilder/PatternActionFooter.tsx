/**
 * @file PatternActionFooter.tsx
 * @description Footer section with destination path display and save button.
 */

import React, { useCallback } from 'react';

export interface PatternActionFooterProps {
  destinationPath: string;
  hasFiles: boolean;
  instanceCount: number;
  onPathEdit: () => void;
  onRename: () => void;
}

export const PatternActionFooter: React.FC<PatternActionFooterProps> = React.memo(
  ({ destinationPath, hasFiles, instanceCount, onPathEdit, onRename }) => {
    const canRename = hasFiles && instanceCount > 0;

    const handlePathMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    }, []);

    const handlePathMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    }, []);

    return (
      <div
        style={{
          marginTop: '16px',
          marginBottom: '16px',
          display: 'flex',
          gap: '8px',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        {/* Path Display */}
        {destinationPath && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '10px 12px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                overflow: 'hidden',
                minWidth: 0,
                minHeight: '44px',
                maxHeight: '80px',
              }}
              title={destinationPath}
              onClick={onPathEdit}
              onMouseEnter={handlePathMouseEnter}
              onMouseLeave={handlePathMouseLeave}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px',
                  overflow: 'hidden',
                  flex: 1,
                  minWidth: 0,
                  wordBreak: 'break-all',
                  lineHeight: '20px',
                }}
              >
                {destinationPath
                  .split('/')
                  .filter(Boolean)
                  .map((segment, index, array) => (
                    <React.Fragment key={index}>
                      <span
                        style={{
                          color: 'rgba(255, 255, 255, 0.7)',
                          fontSize: '12px',
                          wordBreak: 'break-all',
                        }}
                      >
                        {segment}
                      </span>
                      {index < array.length - 1 && (
                        <span
                          style={{
                            color: 'rgba(255, 255, 255, 0.3)',
                            fontSize: '12px',
                            flexShrink: 0,
                          }}
                        >
                          ›
                        </span>
                      )}
                    </React.Fragment>
                  ))}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onRename}
          disabled={!canRename}
          style={{
            background: canRename ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '8px',
            color: canRename ? '#fff' : 'rgba(255, 255, 255, 0.3)',
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: canRename ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
            flexShrink: 0,
          }}
          aria-label="Save and rename files"
        >
          Save
        </button>
      </div>
    );
  }
);

PatternActionFooter.displayName = 'PatternActionFooter';
