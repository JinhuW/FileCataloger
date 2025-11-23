/**
 * @file idGenerator.ts
 * @description Centralized ID generation utility for consistent unique identifiers across the application.
 */

/**
 * Generates a cryptographically secure unique identifier using the Web Crypto API.
 * This is the recommended approach for generating IDs in modern browsers.
 *
 * @returns A RFC4122 version 4 UUID string
 * @example
 * const id = generateUniqueId(); // "550e8400-e29b-41d4-a716-446655440000"
 */
export function generateUniqueId(): string {
  return crypto.randomUUID();
}

/**
 * Generates a unique ID with a specific prefix for better debugging and type identification.
 *
 * @param prefix - The prefix to add to the ID (e.g., 'toast', 'instance', 'component')
 * @returns A unique ID string with the specified prefix
 * @example
 * const toastId = generatePrefixedId('toast'); // "toast-550e8400-e29b-41d4-a716-446655440000"
 */
export function generatePrefixedId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
