# AI Renaming Module - Implementation Guide

## Overview

This document provides a comprehensive implementation guide for adding a standalone AI renaming module to FileCataloger. The module will support multiple AI providers (OpenAI, Ollama, LM Studio), perform comprehensive file analysis, and generate intelligent filenames based on context.

**Key Features:**

- ✨ Multi-provider support (not limited to OpenAI)
- 🔒 Security-first design with API key encryption
- 📁 Comprehensive file analysis (EXIF, PDF text, content sampling)
- 🎨 Output formatting (case styles, length limits)
- 🌐 Not limited to specific file types
- ⚡ Extensible architecture for future providers

**Inspired by:** [ai-renamer](https://github.com/ozgrozer/ai-renamer) - Adopting factory pattern, prompt engineering, and provider abstraction strategies.

---

## Architecture Overview

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Renderer Process                      │
│  ┌────────────────┐         ┌──────────────────┐           │
│  │ Component UI   │────────▶│ Component Store  │           │
│  │ (AI Config)    │         │ (Zustand)        │           │
│  └────────────────┘         └──────────────────┘           │
│           │                           │                      │
│           │ IPC: ai:generate-filename │                      │
│           └───────────────────────────┼──────────────────────┘
│                                       │
│                                       ▼
┌─────────────────────────────────────────────────────────────┐
│                         Main Process                         │
│  ┌──────────────────┐                                       │
│  │ AI Naming Handler│                                       │
│  │    (IPC)         │                                       │
│  └────────┬─────────┘                                       │
│           │                                                  │
│  ┌────────▼──────────┐    ┌─────────────────────┐         │
│  │ Prompt Builder    │    │ File Analyzer       │         │
│  │ Service           │    │ Service             │         │
│  └────────┬──────────┘    └──────────┬──────────┘         │
│           │                            │                     │
│           │         ┌──────────────────▼──────────┐        │
│           └────────▶│  AI Provider Factory        │        │
│                     └──────────────────┬──────────┘        │
│                                        │                     │
│              ┌─────────────────────────┼──────────┐        │
│              │                         │          │         │
│     ┌────────▼─────┐    ┌─────────────▼───┐   ┌─▼──────┐ │
│     │ OpenAI       │    │ Ollama          │   │LM Studio│ │
│     │ Provider     │    │ Provider        │   │Provider │ │
│     └──────────────┘    └─────────────────┘   └─────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Patterns

1. **Factory Pattern**: `AIProviderFactory` creates provider instances based on config
2. **Strategy Pattern**: Each provider implements the `AIProvider` interface
3. **Service Layer**: Separation of concerns (analysis, prompt building, generation)
4. **IPC Boundary**: Clear separation between renderer and main processes

---

## Implementation Roadmap

### Phase 1: Core Infrastructure ⏱️ Week 1

#### 1.1 Install Dependencies

```bash
yarn add openai axios file-type exifreader pdf-parse change-case
yarn add -D @types/node @types/pdf-parse
```

**Dependencies explained:**

- `openai` (4.67.3+): Official OpenAI SDK with TypeScript support
- `axios` (1.7.9+): HTTP client for Ollama and LM Studio APIs
- `file-type` (19.6.0+): MIME type detection via magic numbers
- `exifreader` (4.23.5+): EXIF metadata extraction from images
- `pdf-parse` (1.1.1+): PDF text extraction
- `change-case` (5.4.4+): Case transformation utilities

#### 1.2 Create AI Provider Infrastructure

##### Step 1.2.1: Define Common Types

**File:** `src/main/services/ai/types.ts`

```typescript
/**
 * Common types and interfaces for AI renaming module
 */

export type AIProviderType = 'openai' | 'ollama' | 'lm-studio';

export interface AIProviderConfig {
  provider: AIProviderType;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export interface AIGenerationOptions {
  prompt: string;
  images?: string[]; // File paths or base64 data URLs
  maxTokens?: number;
  temperature?: number;
}

export interface AIGenerationResult {
  success: boolean;
  filename?: string;
  error?: string;
}

/**
 * Base interface that all AI providers must implement
 */
export interface AIProvider {
  /**
   * Generate a filename based on the provided prompt and context
   */
  generateFileName(options: AIGenerationOptions): Promise<string>;

  /**
   * List available models from the provider
   */
  listModels(): Promise<string[]>;

  /**
   * Test connection to the provider
   */
  testConnection(): Promise<boolean>;
}

/**
 * File analysis result
 */
export interface FileAnalysis {
  path: string;
  name: string;
  extension: string;
  size: number;
  mimeType?: string;
  created?: Date;
  modified?: Date;
  metadata?: Record<string, any>;
  contentSample?: string;
  imageData?: string;
}

/**
 * Prompt context for building AI prompts
 */
export interface PromptContext {
  userInstruction: string;
  fileAnalysis: FileAnalysis;
  batchContext?: {
    fileIndex: number;
    totalFiles: number;
    siblingFiles: string[];
  };
  outputConstraints: {
    maxLength: number;
    caseStyle: string;
    language: string;
    allowSpecialChars: boolean;
  };
}
```

**TODO:**

- [ ] Create `src/main/services/ai/types.ts`
- [ ] Add all type definitions above
- [ ] Ensure TypeScript strict mode compliance
- [ ] Add JSDoc comments for all interfaces

##### Step 1.2.2: Create AI Provider Factory

**File:** `src/main/services/ai/AIProviderFactory.ts`

```typescript
import { AIProvider, AIProviderConfig, AIProviderType } from './types';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { OllamaProvider } from './providers/OllamaProvider';
import { LMStudioProvider } from './providers/LMStudioProvider';
import { Logger } from '@main/utils/logger';

/**
 * Factory for creating AI provider instances
 * Uses factory pattern for extensibility
 */
export class AIProviderFactory {
  /**
   * Create an AI provider instance based on config
   * @throws Error if provider type is not supported
   */
  static create(config: AIProviderConfig): AIProvider {
    Logger.debug('Creating AI provider', { provider: config.provider });

    switch (config.provider) {
      case 'openai':
        return new OpenAIProvider(config);

      case 'ollama':
        return new OllamaProvider(config);

      case 'lm-studio':
        return new LMStudioProvider(config);

      default:
        const exhaustiveCheck: never = config.provider;
        throw new Error(`Unsupported AI provider: ${exhaustiveCheck}`);
    }
  }

  /**
   * Get list of supported provider types
   */
  static getSupportedProviders(): AIProviderType[] {
    return ['openai', 'ollama', 'lm-studio'];
  }

  /**
   * Validate provider config
   */
  static validateConfig(config: AIProviderConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.provider) {
      errors.push('Provider type is required');
    }

    if (config.provider === 'openai' && !config.apiKey) {
      errors.push('OpenAI requires an API key');
    }

    if (config.baseUrl && !this.isValidUrl(config.baseUrl)) {
      errors.push('Base URL is not valid');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}
```

**TODO:**

- [ ] Create `src/main/services/ai/AIProviderFactory.ts`
- [ ] Implement factory pattern with switch statement
- [ ] Add config validation method
- [ ] Add error handling with Logger
- [ ] Ensure exhaustive type checking for switch

##### Step 1.2.3: Implement OpenAI Provider

**File:** `src/main/services/ai/providers/OpenAIProvider.ts`

```typescript
import OpenAI from 'openai';
import { AIProvider, AIProviderConfig, AIGenerationOptions } from '../types';
import { Logger } from '@main/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * OpenAI API provider implementation
 * Supports GPT-4, GPT-4 Vision, GPT-3.5-turbo
 */
export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;

    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || 'https://api.openai.com/v1',
    });

    Logger.info('OpenAI provider initialized', {
      baseUrl: config.baseUrl || 'https://api.openai.com/v1',
      model: config.model || 'gpt-4o',
    });
  }

  async generateFileName(options: AIGenerationOptions): Promise<string> {
    try {
      const model = this.config.model || 'gpt-4o';

      Logger.debug('Generating filename with OpenAI', {
        model,
        promptLength: options.prompt.length,
        hasImages: !!options.images?.length,
      });

      // Build message content
      const content: OpenAI.Chat.ChatCompletionContentPart[] = [
        { type: 'text', text: options.prompt },
      ];

      // Add images if provided (for vision models)
      if (options.images && options.images.length > 0) {
        for (const imagePath of options.images) {
          const imageUrl = this.encodeImageToDataUrl(imagePath);
          content.push({
            type: 'image_url',
            image_url: { url: imageUrl },
          });
        }
      }

      // Call OpenAI API
      const response = await this.client.chat.completions.create({
        model,
        messages: [
          {
            role: 'user',
            content,
          },
        ],
        max_tokens: options.maxTokens || 50,
        temperature: options.temperature || 0.7,
      });

      const rawFilename = response.choices[0]?.message?.content || '';

      if (!rawFilename) {
        throw new Error('OpenAI returned empty response');
      }

      // Sanitize filename
      const sanitized = this.sanitizeFilename(rawFilename);

      Logger.info('Filename generated successfully', {
        raw: rawFilename,
        sanitized,
        model,
      });

      return sanitized;
    } catch (error) {
      Logger.error('OpenAI filename generation failed', { error });
      throw this.handleError(error);
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const models = await this.client.models.list();
      return models.data.map(m => m.id);
    } catch (error) {
      Logger.error('Failed to list OpenAI models', { error });
      throw this.handleError(error);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch (error) {
      Logger.warn('OpenAI connection test failed', { error });
      return false;
    }
  }

  /**
   * Encode image file to base64 data URL
   */
  private encodeImageToDataUrl(filePath: string): string {
    try {
      const buffer = fs.readFileSync(filePath);
      const base64 = buffer.toString('base64');
      const mimeType = this.getMimeType(filePath);
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      Logger.error('Failed to encode image', { filePath, error });
      throw new Error(`Failed to encode image: ${filePath}`);
    }
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
    };
    return mimeTypes[ext] || 'image/jpeg';
  }

  /**
   * Sanitize filename to remove invalid characters
   */
  private sanitizeFilename(name: string): string {
    return name
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '') // Remove invalid chars
      .replace(/^\.+/, '') // Remove leading dots
      .replace(/\s+/g, '_') // Replace spaces with underscore
      .substring(0, 255); // Limit length
  }

  /**
   * Extract error message from OpenAI error
   */
  private handleError(error: any): Error {
    const message =
      error?.response?.data?.error?.message || error?.message || 'Unknown OpenAI error';
    return new Error(message);
  }
}
```

**TODO:**

- [ ] Create `src/main/services/ai/providers/OpenAIProvider.ts`
- [ ] Install OpenAI SDK: `yarn add openai`
- [ ] Implement all AIProvider interface methods
- [ ] Add image encoding for vision models
- [ ] Add filename sanitization (security critical!)
- [ ] Add comprehensive error handling
- [ ] Add logging at key points
- [ ] Test with GPT-4o and GPT-3.5-turbo

##### Step 1.2.4: Implement Ollama Provider

**File:** `src/main/services/ai/providers/OllamaProvider.ts`

```typescript
import axios, { AxiosInstance } from 'axios';
import { AIProvider, AIProviderConfig, AIGenerationOptions } from '../types';
import { Logger } from '@main/utils/logger';
import * as fs from 'fs';

/**
 * Ollama local AI provider implementation
 * Supports local models like llava, llama3, etc.
 */
export class OllamaProvider implements AIProvider {
  private client: AxiosInstance;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
    const baseUrl = config.baseUrl || 'http://127.0.0.1:11434';

    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 60000, // 60 second timeout for local models
    });

    Logger.info('Ollama provider initialized', {
      baseUrl,
      model: config.model || 'llava:13b',
    });
  }

  async generateFileName(options: AIGenerationOptions): Promise<string> {
    try {
      const model = this.config.model || 'llava:13b';

      Logger.debug('Generating filename with Ollama', {
        model,
        promptLength: options.prompt.length,
        hasImages: !!options.images?.length,
      });

      // Encode images to base64 (Ollama requires base64, not data URLs)
      const images = options.images?.map(imagePath => {
        const buffer = fs.readFileSync(imagePath);
        return buffer.toString('base64');
      });

      // Call Ollama API
      const response = await this.client.post('/api/generate', {
        model,
        prompt: options.prompt,
        images,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          num_predict: options.maxTokens || 50,
        },
      });

      const rawFilename = response.data.response || '';

      if (!rawFilename) {
        throw new Error('Ollama returned empty response');
      }

      // Sanitize filename
      const sanitized = this.sanitizeFilename(rawFilename);

      Logger.info('Filename generated successfully', {
        raw: rawFilename,
        sanitized,
        model,
      });

      return sanitized;
    } catch (error) {
      Logger.error('Ollama filename generation failed', { error });
      throw this.handleError(error);
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await this.client.get('/api/tags');
      return response.data.models.map((m: any) => m.name);
    } catch (error) {
      Logger.error('Failed to list Ollama models', { error });
      throw this.handleError(error);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/api/tags');
      return true;
    } catch (error) {
      Logger.warn('Ollama connection test failed', { error });
      return false;
    }
  }

  private sanitizeFilename(name: string): string {
    return name
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/^\.+/, '')
      .replace(/\s+/g, '_')
      .substring(0, 255);
  }

  private handleError(error: any): Error {
    const message = error?.response?.data?.error || error?.message || 'Unknown Ollama error';
    return new Error(message);
  }
}
```

**TODO:**

- [ ] Create `src/main/services/ai/providers/OllamaProvider.ts`
- [ ] Implement Ollama-specific API format
- [ ] Handle base64 image encoding (different from OpenAI)
- [ ] Add timeout for local processing
- [ ] Test with llava (vision) and llama3 (text) models

##### Step 1.2.5: Implement LM Studio Provider

**File:** `src/main/services/ai/providers/LMStudioProvider.ts`

```typescript
import axios, { AxiosInstance } from 'axios';
import { AIProvider, AIProviderConfig, AIGenerationOptions } from '../types';
import { Logger } from '@main/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * LM Studio local AI provider implementation
 * Uses OpenAI-compatible API format
 */
export class LMStudioProvider implements AIProvider {
  private client: AxiosInstance;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
    const baseUrl = config.baseUrl || 'http://127.0.0.1:1234';

    this.client = axios.create({
      baseURL: `${baseUrl}/v1`,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    Logger.info('LM Studio provider initialized', {
      baseUrl: `${baseUrl}/v1`,
      model: config.model,
    });
  }

  async generateFileName(options: AIGenerationOptions): Promise<string> {
    try {
      // LM Studio uses OpenAI-compatible format
      const model = this.config.model || 'local-model';

      Logger.debug('Generating filename with LM Studio', {
        model,
        promptLength: options.prompt.length,
        hasImages: !!options.images?.length,
      });

      // Build message content (OpenAI format)
      const content: any[] = [{ type: 'text', text: options.prompt }];

      // Add images if supported
      if (options.images && options.images.length > 0) {
        for (const imagePath of options.images) {
          const imageUrl = this.encodeImageToDataUrl(imagePath);
          content.push({
            type: 'image_url',
            image_url: { url: imageUrl },
          });
        }
      }

      // Call LM Studio API (OpenAI-compatible)
      const response = await this.client.post('/chat/completions', {
        model,
        messages: [
          {
            role: 'user',
            content,
          },
        ],
        max_tokens: options.maxTokens || 50,
        temperature: options.temperature || 0.7,
      });

      const rawFilename = response.data.choices[0]?.message?.content || '';

      if (!rawFilename) {
        throw new Error('LM Studio returned empty response');
      }

      // Sanitize filename
      const sanitized = this.sanitizeFilename(rawFilename);

      Logger.info('Filename generated successfully', {
        raw: rawFilename,
        sanitized,
        model,
      });

      return sanitized;
    } catch (error) {
      Logger.error('LM Studio filename generation failed', { error });
      throw this.handleError(error);
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await this.client.get('/models');
      return response.data.data.map((m: any) => m.id);
    } catch (error) {
      Logger.error('Failed to list LM Studio models', { error });
      throw this.handleError(error);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/models');
      return true;
    } catch (error) {
      Logger.warn('LM Studio connection test failed', { error });
      return false;
    }
  }

  private encodeImageToDataUrl(filePath: string): string {
    try {
      const buffer = fs.readFileSync(filePath);
      const base64 = buffer.toString('base64');
      const mimeType = this.getMimeType(filePath);
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      Logger.error('Failed to encode image', { filePath, error });
      throw new Error(`Failed to encode image: ${filePath}`);
    }
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    return mimeTypes[ext] || 'image/jpeg';
  }

  private sanitizeFilename(name: string): string {
    return name
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/^\.+/, '')
      .replace(/\s+/g, '_')
      .substring(0, 255);
  }

  private handleError(error: any): Error {
    const message =
      error?.response?.data?.error?.message || error?.message || 'Unknown LM Studio error';
    return new Error(message);
  }
}
```

**TODO:**

- [ ] Create `src/main/services/ai/providers/LMStudioProvider.ts`
- [ ] Use OpenAI-compatible API format
- [ ] Test with local models in LM Studio

---

### Phase 2: File Analysis Service ⏱️ Week 1

#### Step 2.1: Create File Analyzer Service

**File:** `src/main/services/ai/FileAnalyzerService.ts`

```typescript
import { FileAnalysis } from './types';
import { fileTypeFromBuffer } from 'file-type';
import ExifReader from 'exifreader';
import { Logger } from '@main/utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Analyzes files to extract metadata and content for AI context
 * Supports images (EXIF), PDFs (text), text files (content sampling)
 */
export class FileAnalyzerService {
  private readonly MAX_CONTENT_LENGTH = 1024;

  /**
   * Analyze a file and extract relevant information
   */
  async analyzeFile(
    filePath: string,
    options: {
      includeMetadata?: boolean;
      includeContent?: boolean;
      maxContentLength?: number;
    } = {}
  ): Promise<FileAnalysis> {
    try {
      Logger.debug('Analyzing file', { filePath, options });

      // Get basic file stats
      const stats = await fs.stat(filePath);
      const buffer = await fs.readFile(filePath);

      const analysis: FileAnalysis = {
        path: filePath,
        name: path.basename(filePath),
        extension: path.extname(filePath),
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
      };

      // Detect MIME type via magic numbers
      const fileType = await fileTypeFromBuffer(buffer);
      if (fileType) {
        analysis.mimeType = fileType.mime;
      }

      // Extract metadata if requested
      if (options.includeMetadata) {
        analysis.metadata = await this.extractMetadata(filePath, buffer, fileType);
      }

      // Extract content sample if requested
      if (options.includeContent) {
        const maxLength = options.maxContentLength || this.MAX_CONTENT_LENGTH;
        analysis.contentSample = await this.extractContent(filePath, buffer, fileType, maxLength);
      }

      Logger.debug('File analysis complete', {
        filePath,
        mimeType: analysis.mimeType,
        hasMetadata: !!analysis.metadata,
        hasContent: !!analysis.contentSample,
      });

      return analysis;
    } catch (error) {
      Logger.error('File analysis failed', { filePath, error });
      throw new Error(`Failed to analyze file: ${error.message}`);
    }
  }

  /**
   * Extract metadata based on file type
   */
  private async extractMetadata(
    filePath: string,
    buffer: Buffer,
    fileType?: { ext: string; mime: string }
  ): Promise<Record<string, any>> {
    const metadata: Record<string, any> = {};

    try {
      // Image EXIF data
      if (fileType?.mime.startsWith('image/')) {
        const tags = ExifReader.load(buffer);
        metadata.exif = {
          camera: tags.Model?.description,
          dateTaken: tags.DateTime?.description,
          gps: tags.GPSLatitude
            ? {
                lat: tags.GPSLatitude.description,
                lon: tags.GPSLongitude.description,
              }
            : undefined,
          dimensions: {
            width: tags.ImageWidth?.value,
            height: tags.ImageHeight?.value,
          },
        };
      }

      // PDF metadata
      if (fileType?.ext === 'pdf') {
        // Basic PDF metadata (title, author, etc.)
        // Would require pdf-parse library
        metadata.pdf = await this.extractPDFMetadata(buffer);
      }
    } catch (error) {
      Logger.warn('Metadata extraction failed', { filePath, error });
      // Don't throw, just return partial metadata
    }

    return metadata;
  }

  /**
   * Extract content sample based on file type
   */
  private async extractContent(
    filePath: string,
    buffer: Buffer,
    fileType?: { ext: string; mime: string },
    maxLength: number = 1024
  ): Promise<string | undefined> {
    try {
      // Plain text files
      if (!fileType || fileType.mime.startsWith('text/')) {
        return buffer.toString('utf8', 0, Math.min(buffer.length, maxLength));
      }

      // PDF text extraction
      if (fileType?.ext === 'pdf') {
        const pdfParse = await import('pdf-parse');
        const data = await pdfParse.default(buffer);
        return data.text.substring(0, maxLength);
      }

      // For other types, return undefined
      return undefined;
    } catch (error) {
      Logger.warn('Content extraction failed', { filePath, error });
      return undefined;
    }
  }

  /**
   * Extract PDF metadata using pdf-parse
   */
  private async extractPDFMetadata(buffer: Buffer): Promise<any> {
    try {
      const pdfParse = await import('pdf-parse');
      const data = await pdfParse.default(buffer);
      return {
        pages: data.numpages,
        info: data.info,
        metadata: data.metadata,
      };
    } catch (error) {
      Logger.warn('PDF metadata extraction failed', { error });
      return {};
    }
  }
}
```

**TODO:**

- [ ] Create `src/main/services/ai/FileAnalyzerService.ts`
- [ ] Install dependencies: `yarn add file-type exifreader pdf-parse`
- [ ] Implement MIME type detection
- [ ] Implement EXIF extraction for images
- [ ] Implement PDF text extraction
- [ ] Implement text content sampling
- [ ] Add comprehensive error handling
- [ ] Test with various file types:
  - [ ] JPEG with EXIF
  - [ ] PNG without EXIF
  - [ ] PDF with text
  - [ ] TXT file
  - [ ] Binary file

---

### Phase 3: Prompt Engineering ⏱️ Week 2

#### Step 3.1: Create Prompt Builder Service

**File:** `src/main/services/ai/PromptBuilderService.ts`

````typescript
import { PromptContext, FileAnalysis } from './types';
import { Logger } from '@main/utils/logger';

/**
 * Builds context-aware prompts for AI filename generation
 * Includes file analysis, user instructions, and output constraints
 */
export class PromptBuilderService {
  /**
   * Build a comprehensive prompt from context
   */
  buildPrompt(context: PromptContext): string {
    Logger.debug('Building AI prompt', {
      hasMetadata: !!context.fileAnalysis.metadata,
      hasContent: !!context.fileAnalysis.contentSample,
      caseStyle: context.outputConstraints.caseStyle,
    });

    const sections = [
      this.buildSystemSection(),
      this.buildFileContextSection(context.fileAnalysis),
      this.buildBatchContextSection(context.batchContext),
      this.buildUserInstructionSection(context.userInstruction),
      this.buildConstraintsSection(context.outputConstraints),
    ];

    const prompt = sections.filter(s => s).join('\n\n');

    Logger.debug('Prompt built successfully', {
      length: prompt.length,
      sections: sections.filter(s => s).length,
    });

    return prompt;
  }

  /**
   * System instruction section
   */
  private buildSystemSection(): string {
    return `You are a file naming assistant. Generate a single, descriptive filename based on the provided context.`;
  }

  /**
   * File context section with metadata and content
   */
  private buildFileContextSection(analysis: FileAnalysis): string {
    const parts = [
      `File Information:`,
      `- Current name: ${analysis.name}`,
      `- Type: ${analysis.extension} ${analysis.mimeType ? `(${analysis.mimeType})` : ''}`,
      `- Size: ${this.formatSize(analysis.size)}`,
      `- Modified: ${analysis.modified?.toLocaleDateString() || 'unknown'}`,
    ];

    // Add metadata if available
    if (analysis.metadata) {
      parts.push(`\nMetadata:`);

      // EXIF data for images
      if (analysis.metadata.exif) {
        const exif = analysis.metadata.exif;
        if (exif.camera) parts.push(`- Camera: ${exif.camera}`);
        if (exif.dateTaken) parts.push(`- Date taken: ${exif.dateTaken}`);
        if (exif.dimensions) {
          parts.push(`- Dimensions: ${exif.dimensions.width}x${exif.dimensions.height}`);
        }
      }

      // PDF data
      if (analysis.metadata.pdf) {
        const pdf = analysis.metadata.pdf;
        if (pdf.pages) parts.push(`- Pages: ${pdf.pages}`);
        if (pdf.info?.Title) parts.push(`- Title: ${pdf.info.Title}`);
        if (pdf.info?.Author) parts.push(`- Author: ${pdf.info.Author}`);
      }
    }

    // Add content sample if available
    if (analysis.contentSample) {
      parts.push(`\nContent preview (first 500 chars):`);
      parts.push('```');
      parts.push(analysis.contentSample.substring(0, 500));
      parts.push('```');
    }

    return parts.join('\n');
  }

  /**
   * Batch context section for multi-file operations
   */
  private buildBatchContextSection(batch?: PromptContext['batchContext']): string | null {
    if (!batch) return null;

    const parts = [
      `Batch Context:`,
      `- Processing file ${batch.fileIndex + 1} of ${batch.totalFiles}`,
    ];

    if (batch.siblingFiles.length > 0) {
      const shown = batch.siblingFiles.slice(0, 5);
      const more =
        batch.siblingFiles.length > 5 ? `, and ${batch.siblingFiles.length - 5} more` : '';
      parts.push(`- Other files in batch: ${shown.join(', ')}${more}`);
    }

    return parts.join('\n');
  }

  /**
   * User instruction section
   */
  private buildUserInstructionSection(instruction: string): string {
    return `User Instructions:\n${instruction}`;
  }

  /**
   * Output constraints section
   */
  private buildConstraintsSection(constraints: PromptContext['outputConstraints']): string {
    const parts = [
      `Output Requirements:`,
      `- Format: ${constraints.caseStyle} (example: ${this.exampleCase(constraints.caseStyle)})`,
      `- Max length: ${constraints.maxLength} characters`,
      `- Language: ${constraints.language}`,
      `- Special characters: ${constraints.allowSpecialChars ? 'allowed' : 'NOT allowed (use only letters, numbers, dash, underscore)'}`,
      `- NO file extension (will be added automatically)`,
      `- NO quotes or extra text`,
      `- Respond with ONLY the filename, nothing else`,
    ];

    return parts.join('\n');
  }

  /**
   * Format file size in human-readable format
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Get example of case style
   */
  private exampleCase(style: string): string {
    const examples: Record<string, string> = {
      camelCase: 'projectReport2024',
      PascalCase: 'ProjectReport2024',
      snake_case: 'project_report_2024',
      'kebab-case': 'project-report-2024',
      SCREAMING_SNAKE_CASE: 'PROJECT_REPORT_2024',
    };
    return examples[style] || 'example-name';
  }
}
````

**TODO:**

- [ ] Create `src/main/services/ai/PromptBuilderService.ts`
- [ ] Implement structured prompt building
- [ ] Add file context section
- [ ] Add metadata formatting
- [ ] Add content preview
- [ ] Add output constraints
- [ ] Add case style examples
- [ ] Test with various file types and contexts

---

### Phase 4: Type System & Component Integration ⏱️ Week 2

#### Step 4.1: Update Shared Types

**File:** `src/shared/types/componentDefinition.ts`

```typescript
// Add 'ai' to ComponentType
export type ComponentType = 'text' | 'select' | 'date' | 'number' | 'ai';

// Add AI config interface
export interface AIConfig {
  namingInstruction: string;
  provider: 'openai' | 'ollama' | 'lm-studio';
  model?: string;
  includeMetadata: boolean;
  includeContent: boolean;
  maxContentLength: number;
  outputCaseStyle:
    | 'camelCase'
    | 'PascalCase'
    | 'snake_case'
    | 'kebab-case'
    | 'SCREAMING_SNAKE_CASE';
  outputMaxLength: number;
  outputLanguage: string;
}

// Update ComponentConfig union
export type ComponentConfig =
  | { type: 'text'; config: TextConfig }
  | { type: 'select'; config: SelectConfig }
  | { type: 'date'; config: DateConfig }
  | { type: 'number'; config: NumberConfig }
  | { type: 'ai'; config: AIConfig };

// Add type guard
export function isAIComponent(
  component: ComponentDefinition
): component is ComponentDefinition & { type: 'ai'; config: AIConfig } {
  return component.type === 'ai';
}
```

**TODO:**

- [ ] Update `src/shared/types/componentDefinition.ts`
- [ ] Add `'ai'` to ComponentType union
- [ ] Add AIConfig interface
- [ ] Update ComponentConfig union type
- [ ] Add isAIComponent type guard
- [ ] Run `yarn typecheck` to verify

#### Step 4.2: Update Enums

**File:** `src/shared/enums.ts`

```typescript
export enum ComponentType {
  TEXT = 'text',
  SELECT = 'select',
  DATE = 'date',
  NUMBER = 'number',
  AI = 'ai', // Add this line
}
```

**TODO:**

- [ ] Update `src/shared/enums.ts`
- [ ] Add `AI = 'ai'` to ComponentType enum
- [ ] Verify no other enums need updating

#### Step 4.3: Update Component Metadata

**File:** `src/renderer/constants/componentTypes.ts`

```typescript
// Add to COMPONENT_TYPE_METADATA array
{
  type: 'ai' as const,
  label: 'AI Naming',
  icon: '🤖',
  color: '#9333EA',  // Purple
  description: 'Use AI to generate intelligent file names based on content and context',
}

// Add to DEFAULT_COMPONENT_CONFIGS
ai: {
  namingInstruction: '',
  provider: 'openai',
  model: undefined,
  includeMetadata: true,
  includeContent: false,
  maxContentLength: 1024,
  outputCaseStyle: 'kebab-case',
  outputMaxLength: 100,
  outputLanguage: 'English',
}
```

**TODO:**

- [ ] Update `src/renderer/constants/componentTypes.ts`
- [ ] Add AI metadata with icon, color, description
- [ ] Add default AI config
- [ ] Verify defaults are sensible

---

## [CONTINUED IN NEXT SECTION DUE TO LENGTH...]

This is Part 1 of the implementation guide. Would you like me to continue with:

- Phase 5: IPC Layer & Configuration
- Phase 6: UI Components
- Phase 7: Testing & Validation
- Appendices (Security, Performance, Troubleshooting)
