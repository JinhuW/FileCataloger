/**
 * Component Migration Utilities
 *
 * Handles migration from legacy RenameComponent to new ComponentInstance system.
 * Creates default component definitions for legacy types.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ComponentDefinition,
  ComponentInstance,
  LegacyRenameComponent,
} from '../../shared/types/componentDefinition';
import type { SavedPattern } from '@shared/types';

// ============================================================================
// Default Component Definitions for Legacy Types
// ============================================================================

/**
 * Create default component definitions for legacy component types
 */
export function createDefaultComponentDefinitions(): Map<string, ComponentDefinition> {
  const now = Date.now();
  const definitions = new Map<string, ComponentDefinition>();

  // Date component
  const dateComponent: ComponentDefinition = {
    id: 'default-date',
    name: 'Date',
    type: 'date',
    icon: '📅',
    color: '#10b981',
    scope: 'global',
    config: {
      dateFormat: 'YYYYMMDD',
      dateSource: 'current',
    },
    metadata: {
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
      isTemplate: true,
      favorite: false,
    },
  };
  definitions.set(dateComponent.id, dateComponent);

  // File Name component (as Text type)
  const fileNameComponent: ComponentDefinition = {
    id: 'default-filename',
    name: 'File Name',
    type: 'text',
    icon: '📄',
    color: '#64748b',
    scope: 'global',
    config: {
      defaultValue: '',
      placeholder: 'Original file name',
      maxLength: 200,
    },
    metadata: {
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
      isTemplate: true,
      favorite: false,
    },
  };
  definitions.set(fileNameComponent.id, fileNameComponent);

  // Counter component
  const counterComponent: ComponentDefinition = {
    id: 'default-counter',
    name: 'Counter',
    type: 'number',
    icon: '🔢',
    color: '#8b5cf6',
    scope: 'global',
    config: {
      numberFormat: 'padded',
      padding: 3,
      prefix: '',
      autoIncrement: true,
      startNumber: 1,
      incrementStep: 1,
    },
    metadata: {
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
      isTemplate: true,
      favorite: false,
    },
  };
  definitions.set(counterComponent.id, counterComponent);

  // Text component
  const textComponent: ComponentDefinition = {
    id: 'default-text',
    name: 'Text',
    type: 'text',
    icon: '📝',
    color: '#64748b',
    scope: 'global',
    config: {
      defaultValue: '',
      placeholder: 'Enter text...',
      maxLength: 200,
    },
    metadata: {
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
      isTemplate: true,
      favorite: false,
    },
  };
  definitions.set(textComponent.id, textComponent);

  // Project component (as Select type)
  const projectComponent: ComponentDefinition = {
    id: 'default-project',
    name: 'Project',
    type: 'select',
    icon: '📁',
    color: '#3b82f6',
    scope: 'global',
    config: {
      options: [],
      allowInlineCreate: true,
      defaultOption: undefined,
    },
    metadata: {
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
      isTemplate: true,
      favorite: false,
    },
  };
  definitions.set(projectComponent.id, projectComponent);

  return definitions;
}

// ============================================================================
// Migration Functions
// ============================================================================

/**
 * Migrate legacy RenameComponent to ComponentInstance
 */
export function migrateLegacyComponent(
  legacy: LegacyRenameComponent,
  defaultDefinitions: Map<string, ComponentDefinition>
): ComponentInstance {
  let definitionId: string;
  let value: any = undefined;
  let overrides: any = undefined;

  switch (legacy.type) {
    case 'date':
      definitionId = 'default-date';
      // Apply format override if specified
      if (legacy.format) {
        overrides = { dateFormat: legacy.format };
      }
      break;

    case 'fileName':
      definitionId = 'default-filename';
      // File name is typically resolved from context, no value needed
      break;

    case 'counter':
      definitionId = 'default-counter';
      // Counter auto-increments, no value needed
      // Could parse format for padding if needed
      break;

    case 'text':
      definitionId = 'default-text';
      value = legacy.value || '';
      break;

    case 'project':
      definitionId = 'default-project';
      // If legacy has a value, it might be a selected project
      // We'll need to create an option for it or leave it empty
      value = legacy.value;
      break;

    default:
      // Fallback to text component
      definitionId = 'default-text';
      value = legacy.value || '';
  }

  const definition = defaultDefinitions.get(definitionId);

  return {
    id: legacy.id || uuidv4(),
    definitionId,
    name: definition?.name || 'Unknown',
    type: definition?.type || 'text',
    value,
    overrides,
  };
}

/**
 * Migrate legacy SavedPattern to new format
 */
export function migrateLegacyPattern(
  pattern: SavedPattern,
  defaultDefinitions: Map<string, ComponentDefinition>
): SavedPattern {
  // Check if pattern components are already ComponentInstance
  if (pattern.components.length === 0) {
    return pattern;
  }

  const firstComponent = pattern.components[0];

  // Check if it's already a ComponentInstance (has definitionId)
  if ('definitionId' in firstComponent) {
    return pattern; // Already migrated
  }

  // Migrate legacy components
  const migratedComponents = (pattern.components as LegacyRenameComponent[]).map(component =>
    migrateLegacyComponent(component, defaultDefinitions)
  );

  return {
    ...pattern,
    components: migratedComponents,
    componentDefinitions: Array.from(defaultDefinitions.values()),
    updatedAt: Date.now(),
  };
}

/**
 * Migrate all patterns from storage
 */
export function migrateAllPatterns(
  patterns: SavedPattern[],
  defaultDefinitions: Map<string, ComponentDefinition>
): SavedPattern[] {
  return patterns.map(pattern => migrateLegacyPattern(pattern, defaultDefinitions));
}

// ============================================================================
// Migration Detection
// ============================================================================

/**
 * Check if a pattern needs migration
 */
export function needsMigration(pattern: SavedPattern): boolean {
  if (pattern.components.length === 0) {
    return false;
  }

  const firstComponent = pattern.components[0];

  // If component has definitionId, it's already migrated
  return !('definitionId' in firstComponent);
}

/**
 * Check if migration has been completed
 */
export function isMigrationComplete(patterns: SavedPattern[]): boolean {
  return patterns.every(pattern => !needsMigration(pattern));
}

// ============================================================================
// Migration Status
// ============================================================================

export interface MigrationStatus {
  completed: boolean;
  totalPatterns: number;
  migratedPatterns: number;
  needsMigration: number;
  errors: string[];
}

/**
 * Get migration status for all patterns
 */
export function getMigrationStatus(patterns: SavedPattern[]): MigrationStatus {
  const totalPatterns = patterns.length;
  const patternsNeedingMigration = patterns.filter(p => needsMigration(p));
  const needsMigrationCount = patternsNeedingMigration.length;
  const migratedCount = totalPatterns - needsMigrationCount;

  return {
    completed: needsMigrationCount === 0,
    totalPatterns,
    migratedPatterns: migratedCount,
    needsMigration: needsMigrationCount,
    errors: [],
  };
}

// ============================================================================
// Migration Execution
// ============================================================================

export interface MigrationResult {
  success: boolean;
  migratedPatterns: SavedPattern[];
  defaultDefinitions: Map<string, ComponentDefinition>;
  status: MigrationStatus;
  errors: string[];
}

/**
 * Execute complete migration process
 */
export function executeMigration(patterns: SavedPattern[]): MigrationResult {
  const errors: string[] = [];

  try {
    // Create default component definitions
    const defaultDefinitions = createDefaultComponentDefinitions();

    // Migrate all patterns
    const migratedPatterns = migrateAllPatterns(patterns, defaultDefinitions);

    // Get final status
    const status = getMigrationStatus(migratedPatterns);

    return {
      success: true,
      migratedPatterns,
      defaultDefinitions,
      status,
      errors,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown migration error');

    return {
      success: false,
      migratedPatterns: patterns,
      defaultDefinitions: new Map(),
      status: {
        completed: false,
        totalPatterns: patterns.length,
        migratedPatterns: 0,
        needsMigration: patterns.length,
        errors,
      },
      errors,
    };
  }
}
