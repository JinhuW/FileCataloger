/**
 * @file PatternDialogs.tsx
 * @description Modal dialogs for pattern builder: new pattern dialog and component limit warning.
 */

import React, { useCallback } from 'react';
import { PATTERN_VALIDATION } from '@renderer/constants/namingPatterns';

export interface NewPatternDialogProps {
  isOpen: boolean;
  patternName: string;
  onPatternNameChange: (name: string) => void;
  onClose: () => void;
  onCreate: () => void;
}

export const NewPatternDialog: React.FC<NewPatternDialogProps> = React.memo(
  ({ isOpen, patternName, onPatternNameChange, onClose, onCreate }) => {
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
          onCreate();
        } else if (e.key === 'Escape') {
          onClose();
        }
      },
      [onCreate, onClose]
    );

    const handleCancel = useCallback(() => {
      onPatternNameChange('');
      onClose();
    }, [onPatternNameChange, onClose]);

    if (!isOpen) return null;

    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: '#1a1a1a',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: '24px',
            width: '400px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <h3 style={{ color: '#fff', marginTop: 0 }}>Create New Pattern</h3>
          <input
            type="text"
            placeholder="Pattern name"
            value={patternName}
            onChange={e => onPatternNameChange(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              padding: '10px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '14px',
              marginBottom: '16px',
            }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              onClick={handleCancel}
              style={{
                padding: '8px 16px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={onCreate}
              disabled={!patternName.trim()}
              style={{
                padding: '8px 16px',
                background: patternName.trim() ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                cursor: patternName.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Create
            </button>
          </div>
        </div>
      </div>
    );
  }
);

NewPatternDialog.displayName = 'NewPatternDialog';

export interface ComponentLimitWarningDialogProps {
  isOpen: boolean;
  dontShowAgain: boolean;
  onDontShowAgainChange: (checked: boolean) => void;
  onClose: () => void;
}

export const ComponentLimitWarningDialog: React.FC<ComponentLimitWarningDialogProps> = React.memo(
  ({ isOpen, dontShowAgain, onDontShowAgainChange, onClose }) => {
    const handleButtonMouseEnter = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.background = '#2563eb';
      e.currentTarget.style.transform = 'translateY(-1px)';
      e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.35)';
    }, []);

    const handleButtonMouseLeave = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.background = '#3b82f6';
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.25)';
    }, []);

    if (!isOpen) return null;

    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: 'linear-gradient(145deg, #1f1f1f 0%, #1a1a1a 100%)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            padding: '32px',
            width: '460px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.1) inset',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header with icon and title */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                flexShrink: 0,
              }}
            >
              ⚠️
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3
                style={{
                  color: '#fff',
                  fontSize: '20px',
                  fontWeight: 600,
                  margin: '0 0 8px',
                  letterSpacing: '-0.02em',
                }}
              >
                Component Limit Reached
              </h3>
              <p
                style={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  margin: 0,
                }}
              >
                You can only add up to{' '}
                <span
                  style={{
                    color: '#3b82f6',
                    fontWeight: 600,
                  }}
                >
                  {PATTERN_VALIDATION.MAX_COMPONENTS} components
                </span>{' '}
                per naming pattern. Please remove some components before adding more.
              </p>
            </div>
          </div>

          {/* Footer with checkbox and button */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
            }}
          >
            {/* Don't show again checkbox - left side */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={e => onDontShowAgainChange(e.target.checked)}
                style={{
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer',
                  accentColor: '#3b82f6',
                }}
              />
              <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '13px' }}>
                Don&apos;t show again
              </span>
            </label>

            {/* Got it button - right side */}
            <button
              onClick={onClose}
              style={{
                padding: '10px 24px',
                background: '#3b82f6',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
              }}
              onMouseEnter={handleButtonMouseEnter}
              onMouseLeave={handleButtonMouseLeave}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  }
);

ComponentLimitWarningDialog.displayName = 'ComponentLimitWarningDialog';
