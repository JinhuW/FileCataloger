/**
 * @file ui.ts
 * @description UI-related TypeScript type definitions for the FileCataloger application.
 * Includes types for tooltips, modals, and other UI components.
 */

import type { ReactNode } from 'react';

/**
 * Tooltip positioning options
 */
export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right' | 'auto';

/**
 * Tooltip content types for different contexts
 */
export type TooltipContentType =
  | 'text' // Simple text content
  | 'metadata' // File metadata with formatted sections
  | 'component-description' // Rename pattern component descriptions
  | 'action'; // Action button descriptions

/**
 * File metadata displayed in tooltips
 */
export interface FileMetadata {
  /** Full file system path */
  fullPath: string;
  /** File size in bytes */
  size: number;
  /** Formatted file size (e.g., "1.5 MB") */
  formattedSize: string;
  /** File type/extension */
  type: string;
  /** Creation date */
  createdAt: Date;
  /** Last modified date */
  modifiedAt: Date;
  /** File permissions (if available) */
  permissions?: string;
}

/**
 * Component description for rename pattern components
 */
export interface ComponentDescription {
  /** Component name */
  name: string;
  /** Short description of what the component does */
  description: string;
  /** Example output */
  example?: string;
  /** Available options or parameters */
  options?: string[];
}

/**
 * Rich tooltip content structure
 */
export interface TooltipContent {
  /** Content type */
  type: TooltipContentType;
  /** Simple text content */
  text?: string;
  /** File metadata content */
  metadata?: FileMetadata;
  /** Component description content */
  componentDescription?: ComponentDescription;
  /** Custom React node content */
  customContent?: ReactNode;
}

/**
 * Custom tooltip component props
 */
export interface CustomTooltipProps {
  /** Element to wrap with tooltip */
  children: ReactNode;
  /** Tooltip content - can be string or structured content */
  content: string | TooltipContent;
  /** Preferred position (will auto-adjust for viewport) */
  position?: TooltipPosition;
  /** Delay before showing tooltip in milliseconds */
  showDelay?: number;
  /** Delay before hiding tooltip in milliseconds */
  hideDelay?: number;
  /** Whether to show arrow pointing to target */
  showArrow?: boolean;
  /** Custom max width in pixels */
  maxWidth?: number;
  /** Whether tooltip is disabled */
  disabled?: boolean;
  /** Custom z-index */
  zIndex?: number;
  /** Additional CSS class name */
  className?: string;
  /** Whether to follow mouse movement */
  followMouse?: boolean;
  /** Custom offset from target element in pixels */
  offset?: number;
}

/**
 * Calculated tooltip positioning data
 */
export interface TooltipPositionData {
  /** X coordinate */
  x: number;
  /** Y coordinate */
  y: number;
  /** Final resolved position after viewport collision detection */
  resolvedPosition: TooltipPosition;
  /** Arrow position if enabled */
  arrowPosition?: {
    x: number;
    y: number;
    rotation: number;
  };
}

/**
 * Tooltip state managed by useTooltip hook
 */
export interface TooltipState {
  /** Whether tooltip is currently visible */
  isVisible: boolean;
  /** Current position data */
  position: TooltipPositionData | null;
  /** Target element bounding rectangle */
  targetRect: {
    top: number;
    left: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  } | null;
}
