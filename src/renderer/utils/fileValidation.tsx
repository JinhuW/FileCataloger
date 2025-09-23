/**
 * @file fileValidation.ts
 * @description Utility functions for validating file paths and names during rename operations.
 * Checks for system limitations on path and filename lengths.
 */

import React from 'react';
import { ShelfItem } from '@shared/types';

/**
 * Maximum allowed path length (common across most file systems)
 */
export const MAX_PATH_LENGTH = 1024;

/**
 * Maximum allowed filename length (common across most file systems)
 */
export const MAX_FILENAME_LENGTH = 255;

/**
 * Validation result for a single file
 */
export interface FileValidationResult {
  file: ShelfItem;
  originalPath: string;
  newPath: string;
  newFilename: string;
  pathTooLong: boolean;
  filenameTooLong: boolean;
  pathLength: number;
  filenameLength: number;
  missingPath?: boolean;
}

/**
 * Overall validation result
 */
export interface ValidationSummary {
  isValid: boolean;
  totalFiles: number;
  pathIssues: FileValidationResult[];
  filenameIssues: FileValidationResult[];
  missingPathIssues: FileValidationResult[];
  allResults: FileValidationResult[];
}

/**
 * Validates file paths and names for rename operations
 * @param files - Array of files to validate
 * @param newNames - Map of file IDs to their new names
 * @param destinationPath - The destination directory path
 * @returns Validation summary with detailed results
 */
export function validateFileRenames(
  files: ShelfItem[],
  newNames: Map<string, string>,
  destinationPath: string
): ValidationSummary {
  const results: FileValidationResult[] = [];
  const pathIssues: FileValidationResult[] = [];
  const filenameIssues: FileValidationResult[] = [];
  const missingPathIssues: FileValidationResult[] = [];

  for (const file of files) {
    const newName = newNames.get(file.id);
    if (!newName) continue;

    // Check if the file has a valid path
    const missingPath = !file.path || !file.path.includes('/');

    // Construct the full new path
    const newPath = `${destinationPath}/${newName}`;

    // Check lengths
    const pathLength = newPath.length;
    const filenameLength = newName.length;
    const pathTooLong = pathLength > MAX_PATH_LENGTH;
    const filenameTooLong = filenameLength > MAX_FILENAME_LENGTH;

    const result: FileValidationResult = {
      file,
      originalPath: file.path || '',
      newPath,
      newFilename: newName,
      pathTooLong,
      filenameTooLong,
      pathLength,
      filenameLength,
      missingPath,
    };

    results.push(result);

    if (missingPath) {
      missingPathIssues.push(result);
    }
    if (pathTooLong) {
      pathIssues.push(result);
    }
    if (filenameTooLong) {
      filenameIssues.push(result);
    }
  }

  return {
    isValid: pathIssues.length === 0 && filenameIssues.length === 0 && missingPathIssues.length === 0,
    totalFiles: files.length,
    pathIssues,
    filenameIssues,
    missingPathIssues,
    allResults: results,
  };
}

/**
 * Formats validation issues for display in the warning dialog
 * @param summary - Validation summary
 * @returns Formatted message and details for the warning dialog
 */
export function formatValidationWarning(summary: ValidationSummary): {
  message: string;
  details: React.ReactNode;
} {
  const issues: string[] = [];

  if (summary.missingPathIssues.length > 0) {
    issues.push(
      `${summary.missingPathIssues.length} file${summary.missingPathIssues.length > 1 ? 's have' : ' has'} no valid path information`
    );
  }

  if (summary.pathIssues.length > 0) {
    issues.push(
      `${summary.pathIssues.length} file${summary.pathIssues.length > 1 ? 's' : ''} exceed the maximum path length of ${MAX_PATH_LENGTH} characters`
    );
  }

  if (summary.filenameIssues.length > 0) {
    issues.push(
      `${summary.filenameIssues.length} file${summary.filenameIssues.length > 1 ? 's' : ''} exceed the maximum filename length of ${MAX_FILENAME_LENGTH} characters`
    );
  }

  const message = summary.missingPathIssues.length > 0
    ? issues.join(' and ') + '. Files without paths cannot be renamed.'
    : issues.join(' and ') + '. These files may not be renamed successfully on some file systems.';

  const details = (
    <div>
      {summary.missingPathIssues.length > 0 && (
        <div style={{ marginBottom: (summary.pathIssues.length > 0 || summary.filenameIssues.length > 0) ? '16px' : 0 }}>
          <h4
            style={{
              margin: '0 0 8px',
              fontSize: '12px',
              color: 'rgba(239, 68, 68, 0.9)',
              textTransform: 'uppercase',
            }}
          >
            Missing Path Information ({summary.missingPathIssues.length} file
            {summary.missingPathIssues.length > 1 ? 's' : ''})
          </h4>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px' }}>
            {summary.missingPathIssues.slice(0, 5).map((issue, index) => (
              <li
                key={index}
                style={{ marginBottom: '8px', wordBreak: 'break-all', lineHeight: 1.4 }}
              >
                <div style={{ color: 'rgba(255, 255, 255, 0.6)' }}>{issue.file.name}</div>
                <div
                  style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '11px', marginTop: '2px' }}
                >
                  Drag files from Finder to ensure full paths are captured
                </div>
              </li>
            ))}
            {summary.missingPathIssues.length > 5 && (
              <li style={{ color: 'rgba(255, 255, 255, 0.4)', fontStyle: 'italic' }}>
                ...and {summary.missingPathIssues.length - 5} more
              </li>
            )}
          </ul>
        </div>
      )}

      {summary.pathIssues.length > 0 && (
        <div style={{ marginBottom: summary.filenameIssues.length > 0 ? '16px' : 0 }}>
          <h4
            style={{
              margin: '0 0 8px',
              fontSize: '12px',
              color: 'rgba(251, 191, 36, 0.9)',
              textTransform: 'uppercase',
            }}
          >
            Path Too Long ({summary.pathIssues.length} file
            {summary.pathIssues.length > 1 ? 's' : ''})
          </h4>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px' }}>
            {summary.pathIssues.slice(0, 5).map((issue, index) => (
              <li
                key={index}
                style={{ marginBottom: '8px', wordBreak: 'break-all', lineHeight: 1.4 }}
              >
                <div style={{ color: 'rgba(255, 255, 255, 0.6)' }}>{issue.newFilename}</div>
                <div
                  style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '11px', marginTop: '2px' }}
                >
                  ({issue.pathLength} chars)
                </div>
              </li>
            ))}
            {summary.pathIssues.length > 5 && (
              <li style={{ color: 'rgba(255, 255, 255, 0.4)', fontStyle: 'italic' }}>
                ...and {summary.pathIssues.length - 5} more
              </li>
            )}
          </ul>
        </div>
      )}

      {summary.filenameIssues.length > 0 && (
        <div>
          <h4
            style={{
              margin: '0 0 8px',
              fontSize: '12px',
              color: 'rgba(251, 191, 36, 0.9)',
              textTransform: 'uppercase',
            }}
          >
            Filename Too Long ({summary.filenameIssues.length} file
            {summary.filenameIssues.length > 1 ? 's' : ''})
          </h4>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px' }}>
            {summary.filenameIssues.slice(0, 5).map((issue, index) => (
              <li
                key={index}
                style={{ marginBottom: '8px', wordBreak: 'break-all', lineHeight: 1.4 }}
              >
                <div style={{ color: 'rgba(255, 255, 255, 0.6)' }}>{issue.newFilename}</div>
                <div
                  style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '11px', marginTop: '2px' }}
                >
                  ({issue.filenameLength} chars)
                </div>
              </li>
            ))}
            {summary.filenameIssues.length > 5 && (
              <li style={{ color: 'rgba(255, 255, 255, 0.4)', fontStyle: 'italic' }}>
                ...and {summary.filenameIssues.length - 5} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );

  return { message, details };
}
