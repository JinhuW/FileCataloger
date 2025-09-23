import React, { useState, useRef, useEffect, useMemo } from 'react';
import { debounce } from 'lodash';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingSpinner } from '@renderer/components/primitives';
import { useToast } from '@renderer/stores';
import { logger } from '@shared/logger';

interface PluginSearchResult {
  name: string;
  version: string;
  description: string;
  author: string | { name: string };
  keywords: string[];
  downloads?: number;
  lastPublished?: string;
}

interface PluginSearchProps {
  onInstall: (packageName: string, version?: string) => Promise<void>;
}

export const PluginSearch: React.FC<PluginSearchProps> = ({ onInstall }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PluginSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // Debounced search function
  const debouncedSearch = useMemo(
    () =>
      debounce(async (searchQuery: string) => {
        if (!searchQuery.trim()) {
          setResults([]);
          return;
        }

        setLoading(true);
        try {
          const response = await window.api.invoke('plugin:search', {
            query: searchQuery,
            limit: 20,
          });

          if (response.success) {
            setResults(response.data);
          } else {
            throw new Error(response.error);
          }
        } catch (error) {
          logger.error('Plugin search failed:', error);
          toast.showError('Search Failed', error.message || 'Failed to search plugins');
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, 500),
    [toast]
  );

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  const handleInstall = async (packageName: string, version?: string) => {
    setInstalling(packageName);
    try {
      await onInstall(packageName, version);
      // Remove from results after successful install
      setResults(results.filter(r => r.name !== packageName));
    } finally {
      setInstalling(null);
    }
  };

  const formatAuthorName = (author: string | { name: string }): string => {
    return typeof author === 'string' ? author : author.name;
  };

  const formatDownloads = (downloads?: number): string => {
    if (!downloads) return '';
    if (downloads >= 1000000) return `${(downloads / 1000000).toFixed(1)}M`;
    if (downloads >= 1000) return `${(downloads / 1000).toFixed(1)}K`;
    return downloads.toString();
  };

  return (
    <div className="plugin-search">
      {/* Search Input */}
      <div className="search-container">
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search npm for FileCataloger plugins..."
          className="search-input"
        />
        {loading && (
          <div className="search-loading">
            <LoadingSpinner size="small" />
          </div>
        )}
      </div>

      {/* Search Results */}
      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="search-results"
          >
            {results.map(result => (
              <motion.div
                key={result.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="plugin-search-item"
              >
                <div className="plugin-info">
                  <div className="plugin-header">
                    <h4 className="plugin-name">{result.name}</h4>
                    <span className="plugin-version">v{result.version}</span>
                  </div>
                  <p className="plugin-description">{result.description}</p>
                  <div className="plugin-meta">
                    <span className="plugin-author">by {formatAuthorName(result.author)}</span>
                    {result.downloads && (
                      <span className="plugin-downloads">
                        {formatDownloads(result.downloads)} downloads/week
                      </span>
                    )}
                  </div>
                  {result.keywords && result.keywords.length > 0 && (
                    <div className="plugin-keywords">
                      {result.keywords.slice(0, 5).map(keyword => (
                        <span key={keyword} className="keyword-tag">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="plugin-actions">
                  <button
                    onClick={() => handleInstall(result.name, result.version)}
                    disabled={installing === result.name}
                    className="install-button"
                  >
                    {installing === result.name ? <LoadingSpinner size="small" /> : 'Install'}
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .plugin-search {
          margin-bottom: 24px;
        }

        .search-container {
          position: relative;
          margin-bottom: 16px;
        }

        .search-input {
          width: 100%;
          padding: 12px 16px;
          padding-right: 48px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #fff;
          font-size: 14px;
          transition: all 0.2s;
        }

        .search-input:focus {
          outline: none;
          background: rgba(255, 255, 255, 0.08);
          border-color: #3b82f6;
        }

        .search-loading {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
        }

        .search-results {
          max-height: 400px;
          overflow-y: auto;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
        }

        .plugin-search-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          transition: background 0.2s;
        }

        .plugin-search-item:last-child {
          border-bottom: none;
        }

        .plugin-search-item:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .plugin-info {
          flex: 1;
          min-width: 0;
        }

        .plugin-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .plugin-name {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .plugin-version {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
        }

        .plugin-description {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
          margin: 0 0 8px;
          line-height: 1.4;
        }

        .plugin-meta {
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 8px;
        }

        .plugin-keywords {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .keyword-tag {
          font-size: 11px;
          padding: 2px 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          color: rgba(255, 255, 255, 0.7);
        }

        .plugin-actions {
          flex-shrink: 0;
          margin-left: 16px;
        }

        .install-button {
          padding: 8px 16px;
          background: #3b82f6;
          border: none;
          border-radius: 6px;
          color: #fff;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          min-width: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .install-button:hover:not(:disabled) {
          background: #2563eb;
        }

        .install-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
