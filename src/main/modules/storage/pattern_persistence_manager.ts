import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import * as crypto from 'crypto';
import { z } from 'zod';
import { SavedPattern, RenameComponent } from '@shared/types';
import { logger } from '../utils/logger';

// Validation schemas
const RenameComponentSchema = z.object({
  id: z.string(),
  type: z.enum(['date', 'fileName', 'counter', 'text', 'project']),
  value: z.string().optional(),
  format: z.string().optional(),
  placeholder: z.string().optional(),
});

const SavedPatternSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  components: z.array(RenameComponentSchema).min(0).max(20),
  createdAt: z.number(),
  updatedAt: z.number(),
  metadata: z
    .object({
      description: z.string().optional(),
      usageCount: z.number().optional(),
      lastUsed: z.number().optional(),
      favorite: z.boolean().optional(),
    })
    .optional(),
});

interface ListOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'usageCount';
  sortOrder?: 'asc' | 'desc';
  favorite?: boolean;
  tags?: string[];
}

interface PatternUsageStats {
  totalPatterns: number;
  mostUsedPattern: SavedPattern | null;
  recentPatterns: SavedPattern[];
  favoritePatterns: SavedPattern[];
}

export class PatternPersistenceManager {
  private static instance: PatternPersistenceManager;
  private db: Database.Database | null = null;
  private cache: Map<string, SavedPattern> = new Map();
  private statements: Map<string, Database.Statement> = new Map();

  private constructor() {
    this.initializeDatabase();
  }

  public static getInstance(): PatternPersistenceManager {
    if (!PatternPersistenceManager.instance) {
      PatternPersistenceManager.instance = new PatternPersistenceManager();
    }
    return PatternPersistenceManager.instance;
  }

  private initializeDatabase(): void {
    try {
      const dbPath = path.join(app.getPath('userData'), 'patterns.db');
      this.db = new Database(dbPath);

      // Enable WAL mode for better performance
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 1000');

      this.createTables();
      this.prepareStatements();

      logger.info('Pattern database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize pattern database:', error);
      this.db = null;
    }
  }

  private createTables(): void {
    if (!this.db) return;

    // Patterns table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS patterns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        usage_count INTEGER DEFAULT 0,
        is_built_in INTEGER DEFAULT 0,
        is_default INTEGER DEFAULT 0,
        description TEXT,
        metadata TEXT
      );
    `);

    // Pattern components table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pattern_components (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern_id TEXT NOT NULL,
        component_order INTEGER NOT NULL,
        component_type TEXT NOT NULL,
        component_config TEXT NOT NULL,
        FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE
      );
    `);

    // Pattern tags table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pattern_tags (
        pattern_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (pattern_id, tag),
        FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE
      );
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_patterns_name ON patterns(name);
      CREATE INDEX IF NOT EXISTS idx_patterns_usage ON patterns(usage_count DESC);
      CREATE INDEX IF NOT EXISTS idx_patterns_updated ON patterns(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_components_pattern ON pattern_components(pattern_id, component_order);
      CREATE INDEX IF NOT EXISTS idx_tags_pattern ON pattern_tags(pattern_id);
      CREATE INDEX IF NOT EXISTS idx_tags_tag ON pattern_tags(tag);
    `);
  }

  private prepareStatements(): void {
    if (!this.db) return;

    // Basic CRUD operations
    this.statements.set(
      'insertPattern',
      this.db.prepare(`
      INSERT OR REPLACE INTO patterns (id, name, created_at, updated_at, usage_count, is_built_in, is_default, description, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    );

    this.statements.set(
      'selectPattern',
      this.db.prepare(`
      SELECT * FROM patterns WHERE id = ?
    `)
    );

    this.statements.set(
      'deletePattern',
      this.db.prepare(`
      DELETE FROM patterns WHERE id = ?
    `)
    );

    this.statements.set(
      'insertComponent',
      this.db.prepare(`
      INSERT INTO pattern_components (pattern_id, component_order, component_type, component_config)
      VALUES (?, ?, ?, ?)
    `)
    );

    this.statements.set(
      'selectComponents',
      this.db.prepare(`
      SELECT * FROM pattern_components WHERE pattern_id = ? ORDER BY component_order
    `)
    );

    this.statements.set(
      'deleteComponents',
      this.db.prepare(`
      DELETE FROM pattern_components WHERE pattern_id = ?
    `)
    );

    this.statements.set(
      'insertTag',
      this.db.prepare(`
      INSERT OR IGNORE INTO pattern_tags (pattern_id, tag) VALUES (?, ?)
    `)
    );

    this.statements.set(
      'selectTags',
      this.db.prepare(`
      SELECT tag FROM pattern_tags WHERE pattern_id = ?
    `)
    );

    this.statements.set(
      'deleteTags',
      this.db.prepare(`
      DELETE FROM pattern_tags WHERE pattern_id = ?
    `)
    );

    this.statements.set(
      'incrementUsage',
      this.db.prepare(`
      UPDATE patterns SET usage_count = usage_count + 1, updated_at = ? WHERE id = ?
    `)
    );
  }

  // CRUD Operations

  public async savePattern(pattern: SavedPattern): Promise<void> {
    if (!this.db) {
      logger.warn('Database not available, pattern save skipped');
      return;
    }

    try {
      // Validate pattern data
      const validatedPattern = SavedPatternSchema.parse(pattern);

      const insertPattern = this.statements.get('insertPattern');
      const insertComponent = this.statements.get('insertComponent');
      const insertTag = this.statements.get('insertTag');
      const deleteComponents = this.statements.get('deleteComponents');
      const deleteTags = this.statements.get('deleteTags');

      const transaction = this.db.transaction(() => {
        // Insert/update pattern
        insertPattern!.run(
          validatedPattern.id,
          validatedPattern.name,
          validatedPattern.createdAt,
          validatedPattern.updatedAt,
          validatedPattern.metadata?.usageCount || 0,
          0, // is_built_in (removed - always 0)
          0, // is_default (removed - always 0)
          validatedPattern.metadata?.description || null,
          validatedPattern.metadata ? JSON.stringify(validatedPattern.metadata) : null
        );

        // Delete existing components and tags
        deleteComponents!.run(validatedPattern.id);
        deleteTags!.run(validatedPattern.id);

        // Insert components
        validatedPattern.components.forEach((component, index) => {
          insertComponent!.run(
            validatedPattern.id,
            index,
            component.type,
            JSON.stringify(component)
          );
        });

        // Insert tags if any
        if (validatedPattern.metadata?.favorite) {
          insertTag!.run(validatedPattern.id, 'favorite');
        }
      });

      transaction();

      // Update cache
      this.cache.set(validatedPattern.id, validatedPattern);

      logger.debug('Pattern saved successfully:', validatedPattern.id);
    } catch (error) {
      logger.error('Failed to save pattern:', error);
      throw error;
    }
  }

  public async loadPattern(id: string): Promise<SavedPattern | null> {
    // Check cache first
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }

    if (!this.db) return null;

    try {
      const selectPattern = this.statements.get('selectPattern');
      const selectComponents = this.statements.get('selectComponents');
      const selectTags = this.statements.get('selectTags');

      const patternRow = selectPattern!.get(id) as any;
      if (!patternRow) return null;

      const componentsRows = selectComponents!.all(id) as any[];
      const tagsRows = selectTags!.all(id) as any[];

      // Reconstruct pattern
      const components: RenameComponent[] = componentsRows.map(row =>
        JSON.parse(row.component_config)
      );

      const tags = tagsRows.map(row => row.tag);

      const pattern: SavedPattern = {
        id: patternRow.id,
        name: patternRow.name,
        components,
        createdAt: patternRow.created_at,
        updatedAt: patternRow.updated_at,
        metadata: {
          ...(patternRow.metadata ? JSON.parse(patternRow.metadata) : {}),
          usageCount: patternRow.usage_count,
          favorite: tags.includes('favorite'),
        },
      };

      // Update cache
      this.cache.set(id, pattern);

      return pattern;
    } catch (error) {
      logger.error('Failed to load pattern:', error);
      return null;
    }
  }

  public async updatePattern(id: string, updates: Partial<SavedPattern>): Promise<void> {
    const existingPattern = await this.loadPattern(id);
    if (!existingPattern) {
      throw new Error(`Pattern not found: ${id}`);
    }

    const updatedPattern: SavedPattern = {
      ...existingPattern,
      ...updates,
      updatedAt: Date.now(),
    };

    await this.savePattern(updatedPattern);
  }

  public async deletePattern(id: string): Promise<boolean> {
    if (!this.db) return false;

    try {
      const pattern = await this.loadPattern(id);
      if (!pattern) return false;

      const deletePattern = this.statements.get('deletePattern');
      const result = deletePattern!.run(id);

      // Remove from cache
      this.cache.delete(id);

      logger.debug('Pattern deleted successfully:', id);
      return result.changes > 0;
    } catch (error) {
      logger.error('Failed to delete pattern:', error);
      throw error;
    }
  }

  public async listPatterns(options: ListOptions = {}): Promise<SavedPattern[]> {
    if (!this.db) return [];

    const {
      limit = 50,
      offset = 0,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      favorite,
      tags = [],
    } = options;

    try {
      let query = `
        SELECT DISTINCT p.* FROM patterns p
      `;

      const conditions: string[] = [];
      const params: any[] = [];

      if (favorite !== undefined) {
        if (favorite) {
          query += ` JOIN pattern_tags pt ON p.id = pt.pattern_id`;
          conditions.push('pt.tag = ?');
          params.push('favorite');
        } else {
          query += ` LEFT JOIN pattern_tags pt ON p.id = pt.pattern_id AND pt.tag = 'favorite'`;
          conditions.push('pt.pattern_id IS NULL');
        }
      }

      if (tags.length > 0) {
        query += ` JOIN pattern_tags pt2 ON p.id = pt2.pattern_id`;
        conditions.push(`pt2.tag IN (${tags.map(() => '?').join(', ')})`);
        params.push(...tags);
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ` ORDER BY p.${sortBy} ${sortOrder.toUpperCase()}`;
      query += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const rows = this.db.prepare(query).all(...params) as any[];

      const patterns: SavedPattern[] = [];
      for (const row of rows) {
        const pattern = await this.loadPattern(row.id);
        if (pattern) {
          patterns.push(pattern);
        }
      }

      return patterns;
    } catch (error) {
      logger.error('Failed to list patterns:', error);
      return [];
    }
  }

  // Batch operations

  public async saveMultiplePatterns(patterns: SavedPattern[]): Promise<void> {
    if (!this.db) {
      logger.warn('Database not available, batch pattern save skipped');
      return;
    }

    const transaction = this.db.transaction(() => {
      for (const pattern of patterns) {
        this.savePattern(pattern);
      }
    });

    transaction();
  }

  public async deleteMultiplePatterns(ids: string[]): Promise<number> {
    if (!this.db) return 0;

    let deletedCount = 0;
    for (const id of ids) {
      const deleted = await this.deletePattern(id);
      if (deleted) deletedCount++;
    }
    return deletedCount;
  }

  // Search and filter

  public async searchPatterns(query: string): Promise<SavedPattern[]> {
    if (!this.db || !query.trim()) return [];

    try {
      const searchQuery = `
        SELECT DISTINCT p.* FROM patterns p
        WHERE p.name LIKE ? OR p.description LIKE ?
        ORDER BY p.updated_at DESC
        LIMIT 20
      `;

      const searchTerm = `%${query.trim()}%`;
      const rows = this.db.prepare(searchQuery).all(searchTerm, searchTerm) as any[];

      const patterns: SavedPattern[] = [];
      for (const row of rows) {
        const pattern = await this.loadPattern(row.id);
        if (pattern) {
          patterns.push(pattern);
        }
      }

      return patterns;
    } catch (error) {
      logger.error('Failed to search patterns:', error);
      return [];
    }
  }

  public async getPatternsByTag(tag: string): Promise<SavedPattern[]> {
    return this.listPatterns({ tags: [tag] });
  }

  public async getRecentPatterns(limit: number = 10): Promise<SavedPattern[]> {
    return this.listPatterns({ limit, sortBy: 'updatedAt', sortOrder: 'desc' });
  }

  public async getFavoritePatterns(): Promise<SavedPattern[]> {
    return this.listPatterns({ favorite: true });
  }

  // Import/Export

  public async exportPattern(id: string): Promise<string> {
    const pattern = await this.loadPattern(id);
    if (!pattern) {
      throw new Error(`Pattern not found: ${id}`);
    }

    const exportData = {
      version: '1.0.0',
      pattern,
      exportDate: new Date().toISOString(),
      appVersion: app.getVersion(),
      checksum: this.generateChecksum(pattern),
    };

    return JSON.stringify(exportData, null, 2);
  }

  public async exportAllPatterns(): Promise<string> {
    const patterns = await this.listPatterns();

    const exportData = {
      version: '1.0.0',
      patterns,
      exportDate: new Date().toISOString(),
      appVersion: app.getVersion(),
      checksum: this.generateChecksum(patterns),
    };

    return JSON.stringify(exportData, null, 2);
  }

  public async importPattern(data: string): Promise<SavedPattern> {
    try {
      const importData = JSON.parse(data);

      // Validate format
      if (!importData.pattern || !importData.version) {
        throw new Error('Invalid pattern export format');
      }

      // Verify checksum
      const expectedChecksum = this.generateChecksum(importData.pattern);
      if (importData.checksum !== expectedChecksum) {
        throw new Error('Pattern data integrity check failed');
      }

      const pattern = SavedPatternSchema.parse(importData.pattern);

      // Generate new ID to avoid conflicts
      pattern.id = `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      pattern.createdAt = Date.now();
      pattern.updatedAt = Date.now();

      await this.savePattern(pattern);

      return pattern;
    } catch (error) {
      logger.error('Failed to import pattern:', error);
      throw error;
    }
  }

  public async importPatterns(data: string): Promise<SavedPattern[]> {
    try {
      const importData = JSON.parse(data);

      if (!importData.patterns || !Array.isArray(importData.patterns)) {
        throw new Error('Invalid patterns export format');
      }

      const importedPatterns: SavedPattern[] = [];

      for (const patternData of importData.patterns) {
        try {
          const singleExport = {
            version: importData.version,
            pattern: patternData,
            checksum: this.generateChecksum(patternData),
          };

          const pattern = await this.importPattern(JSON.stringify(singleExport));
          importedPatterns.push(pattern);
        } catch (error) {
          logger.warn('Failed to import individual pattern:', error);
          // Continue with other patterns
        }
      }

      return importedPatterns;
    } catch (error) {
      logger.error('Failed to import patterns:', error);
      throw error;
    }
  }

  // Usage tracking

  public async incrementUsageCount(id: string): Promise<void> {
    if (!this.db) return;

    try {
      const incrementUsage = this.statements.get('incrementUsage');
      incrementUsage!.run(Date.now(), id);

      // Update cache
      const cachedPattern = this.cache.get(id);
      if (cachedPattern && cachedPattern.metadata) {
        cachedPattern.metadata.usageCount = (cachedPattern.metadata.usageCount || 0) + 1;
        cachedPattern.metadata.lastUsed = Date.now();
      }
    } catch (error) {
      logger.error('Failed to increment usage count:', error);
    }
  }

  public async getUsageStats(): Promise<PatternUsageStats> {
    if (!this.db) {
      return {
        totalPatterns: 0,
        mostUsedPattern: null,
        recentPatterns: [],
        favoritePatterns: [],
      };
    }

    try {
      const totalPatterns = this.db.prepare('SELECT COUNT(*) as count FROM patterns').get() as {
        count: number;
      };

      const mostUsedRow = this.db
        .prepare('SELECT id FROM patterns ORDER BY usage_count DESC LIMIT 1')
        .get() as { id: string } | undefined;
      const mostUsedPattern = mostUsedRow ? await this.loadPattern(mostUsedRow.id) : null;

      const recentPatterns = await this.getRecentPatterns(5);
      const favoritePatterns = await this.getFavoritePatterns();

      return {
        totalPatterns: totalPatterns.count,
        mostUsedPattern,
        recentPatterns,
        favoritePatterns,
      };
    } catch (error) {
      logger.error('Failed to get usage stats:', error);
      throw error;
    }
  }

  // Maintenance

  public async vacuum(): Promise<void> {
    if (!this.db) return;

    try {
      this.db.exec('VACUUM');
      logger.info('Pattern database vacuumed successfully');
    } catch (error) {
      logger.error('Failed to vacuum pattern database:', error);
    }
  }

  public async backup(): Promise<string> {
    const exportData = await this.exportAllPatterns();
    const backupPath = path.join(app.getPath('userData'), `patterns-backup-${Date.now()}.json`);

    const fs = await import('fs/promises');
    await fs.writeFile(backupPath, exportData, 'utf8');

    logger.info('Pattern backup created:', backupPath);
    return backupPath;
  }

  public async restore(backupPath: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const data = await fs.readFile(backupPath, 'utf8');

      await this.importPatterns(data);
      logger.info('Pattern backup restored successfully');
    } catch (error) {
      logger.error('Failed to restore pattern backup:', error);
      throw error;
    }
  }

  // Private utility methods

  private generateChecksum(data: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.cache.clear();
    this.statements.clear();
  }
}

// Export singleton
export const patternPersistenceManager = PatternPersistenceManager.getInstance();
