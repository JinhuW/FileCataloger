/**
 * @file WarningDialog.tsx
 * @description Modal dialog component for displaying warnings to users, with customizable actions.
 * Used for path/filename length validation warnings during rename operations.
 *
 * @props {boolean} isOpen - Whether the dialog is visible
 * @props {function} onClose - Callback when dialog is closed
 * @props {string} title - Dialog title
 * @props {string} message - Warning message to display
 * @props {React.ReactNode} details - Optional detailed information or list of issues
 * @props {function} onConfirm - Optional callback for confirm action (if not provided, shows OK button)
 * @props {string} confirmText - Text for confirm button (default: "Continue Anyway")
 * @props {string} cancelText - Text for cancel button (default: "Cancel")
 *
 * @features
 * - Modal overlay with backdrop blur effect
 * - Warning icon with animated entrance
 * - Customizable action buttons
 * - Smooth fade-in/out animations
 * - Keyboard escape key support
 * - Click outside to close
 * - Scrollable details section for long content
 *
 * @usage
 * ```tsx
 * <WarningDialog
 *   isOpen={showWarning}
 *   onClose={() => setShowWarning(false)}
 *   title="Path Length Warning"
 *   message="Some file paths exceed the maximum length of 1024 characters"
 *   details={<ul>{problematicFiles.map(f => <li>{f}</li>)}</ul>}
 *   onConfirm={handleProceedWithRename}
 * />
 * ```
 */

import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface WarningDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  details?: React.ReactNode;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export const WarningDialog: React.FC<WarningDialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  details,
  onConfirm,
  confirmText = 'Continue Anyway',
  cancelText = 'Cancel',
}) => {
  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleBackdropClick}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={e => e.stopPropagation()}
            style={{
              background: 'rgba(30, 30, 30, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              minWidth: '400px',
              maxWidth: '600px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '24px 24px 20px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                }}
              >
                {/* Warning Icon */}
                <motion.div
                  initial={{ rotate: 0 }}
                  animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  style={{
                    width: '48px',
                    height: '48px',
                    background: 'rgba(251, 191, 36, 0.1)',
                    border: '1px solid rgba(251, 191, 36, 0.3)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="rgba(251, 191, 36, 0.9)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </motion.div>

                {/* Title and Message */}
                <div style={{ flex: 1 }}>
                  <h3
                    style={{
                      margin: '0 0 8px',
                      fontSize: '18px',
                      fontWeight: 600,
                      color: 'rgba(251, 191, 36, 0.9)',
                    }}
                  >
                    {title}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '14px',
                      color: 'rgba(255, 255, 255, 0.8)',
                      lineHeight: 1.5,
                    }}
                  >
                    {message}
                  </p>
                </div>
              </div>
            </div>

            {/* Details Section */}
            {details && (
              <div
                style={{
                  flex: 1,
                  padding: '20px 24px',
                  overflowY: 'auto',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '16px',
                    fontSize: '13px',
                    color: 'rgba(255, 255, 255, 0.7)',
                    lineHeight: 1.6,
                  }}
                >
                  {details}
                </div>
              </div>
            )}

            {/* Actions */}
            <div
              style={{
                padding: '20px 24px',
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: 'rgba(255, 255, 255, 0.8)',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
              >
                {onConfirm ? cancelText : 'OK'}
              </button>

              {onConfirm && (
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  style={{
                    background: 'rgba(251, 191, 36, 0.2)',
                    border: '1px solid rgba(251, 191, 36, 0.4)',
                    borderRadius: '8px',
                    color: 'rgba(251, 191, 36, 0.9)',
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(251, 191, 36, 0.3)';
                    e.currentTarget.style.borderColor = 'rgba(251, 191, 36, 0.5)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(251, 191, 36, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(251, 191, 36, 0.4)';
                  }}
                >
                  {confirmText}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WarningDialog;