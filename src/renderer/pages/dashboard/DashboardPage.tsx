/**
 * @file DashboardPage.tsx
 * @description Main dashboard component for FileCataloger.
 * Displays real-time system status, analytics, and controls for the application.
 * This component runs in the main application window (not shelf windows).
 *
 * @features
 * - Real-time status monitoring of core modules
 * - Live analytics dashboard with performance metrics
 * - System information display
 * - Manual shelf creation controls
 * - Animated UI with Framer Motion
 *
 * @ipc-communication
 * - app:get-status - Fetches current application status
 * - app:status - Listens for status updates
 * - app:create-shelf - Creates a new shelf manually
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { logger } from '@shared/logger';
import { AppStatus } from '@shared/types';
import { isAppStatus } from '@renderer/utils/typeGuards';
import { useIPC } from '@renderer/hooks/useIPC';

export const DashboardPage: React.FC = () => {
  const [appStatus, setAppStatus] = useState<AppStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { invoke, on, isConnected } = useIPC();

  const fetchAppStatus = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      const status = await invoke('app:get-status', null);
      if (isAppStatus(status)) {
        setAppStatus(status);
      } else {
        throw new Error('Invalid app status received');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch app status';
      logger.error('Failed to fetch app status:', error);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [invoke]);

  useEffect(() => {
    if (isConnected) {
      fetchAppStatus();
    } else {
      logger.warn('Electron API not available - running in browser?');
      setIsLoading(false);
    }

    // Listen for status updates
    let cleanup: (() => void) | undefined;

    if (isConnected) {
      cleanup = on('app:status', (status: unknown) => {
        if (isAppStatus(status)) {
          setAppStatus(status);
          setIsLoading(false);
        } else if (process.env.NODE_ENV === 'development') {
          logger.warn('Received invalid app status:', status);
        }
      });
    }

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [isConnected, fetchAppStatus, on]);

  const createShelf = async () => {
    try {
      setError(null);
      await invoke('app:create-shelf', {
        position: { x: 200, y: 200 },
        isPinned: true,
        isVisible: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create shelf';
      logger.error('Failed to create shelf:', error);
      setError(errorMessage);
    }
  };

  const getStatusColor = (isActive: boolean) => (isActive ? 'bg-green-500' : 'bg-red-500');
  const getStatusText = (isActive: boolean) => (isActive ? 'Active' : 'Inactive');

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.header
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-5xl font-bold text-gray-800 mb-2">🚀 FileCataloger</h1>
          <p className="text-gray-600 text-lg">
            Advanced temporary file shelf system with gesture controls
          </p>
          {appStatus?.isRunning && (
            <motion.div
              className="inline-flex items-center mt-4 px-4 py-2 bg-green-100 border border-green-300 rounded-lg"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <span className="text-green-700 font-semibold">System Running</span>
            </motion.div>
          )}
        </motion.header>

        {/* Error Display */}
        {error && (
          <motion.div
            className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center">
              <span className="text-red-500 mr-2">⚠️</span>
              <p className="text-red-700">{error}</p>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-500 hover:text-red-700"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}

        {/* Main Status Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Core Modules Status */}
          <motion.div
            className="bg-white rounded-lg shadow-lg p-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h2 className="text-xl font-semibold mb-4 text-gray-800 flex items-center">
              <span className="mr-2">⚡</span>
              Core Modules
            </h2>

            {isLoading ? (
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-3"></div>
                <div className="h-4 bg-gray-200 rounded mb-3"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div
                      className={`w-3 h-3 rounded-full mr-3 ${getStatusColor(isConnected)}`}
                    ></div>
                    <span className="text-gray-700">Electron API</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-600">
                    {getStatusText(isConnected)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div
                      className={`w-3 h-3 rounded-full mr-3 ${getStatusColor(appStatus?.modules.mouseTracker || false)}`}
                    ></div>
                    <span className="text-gray-700">Mouse Tracking</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-600">
                    {getStatusText(appStatus?.modules.mouseTracker || false)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div
                      className={`w-3 h-3 rounded-full mr-3 ${getStatusColor(appStatus?.modules.shakeDetector || false)}`}
                    ></div>
                    <span className="text-gray-700">Shake Detection</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-600">
                    {getStatusText(appStatus?.modules.shakeDetector || false)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div
                      className={`w-3 h-3 rounded-full mr-3 ${getStatusColor(appStatus?.modules.dragDetector || false)}`}
                    ></div>
                    <span className="text-gray-700">Drag Detection</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-600">
                    {getStatusText(appStatus?.modules.dragDetector || false)}
                  </span>
                </div>
              </div>
            )}
          </motion.div>

          {/* Analytics */}
          <motion.div
            className="bg-white rounded-lg shadow-lg p-6"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="text-xl font-semibold mb-4 text-gray-800 flex items-center">
              <span className="mr-2">📊</span>
              Live Analytics
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Active Shelves</span>
                <span className="text-2xl font-bold text-blue-600">
                  {appStatus?.activeShelves || 0}
                </span>
              </div>

              {appStatus?.analytics.shakeDetector && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Total Shakes</span>
                  <span className="text-lg font-semibold text-green-600">
                    {appStatus.analytics.shakeDetector.shakesDetected}
                  </span>
                </div>
              )}

              {appStatus?.analytics.dragDetector && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Total Drags</span>
                  <span className="text-lg font-semibold text-purple-600">
                    {appStatus.analytics.dragDetector.dragsDetected}
                  </span>
                </div>
              )}

              {appStatus?.analytics.mouseTracker && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Mouse Events/sec</span>
                  <span className="text-lg font-semibold text-orange-600">
                    {Math.round(appStatus.analytics.mouseTracker.eventsPerSecond || 0)}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Controls */}
        <motion.div
          className="bg-white rounded-lg shadow-lg p-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <h2 className="text-xl font-semibold mb-4 text-gray-800 flex items-center">
            <span className="mr-2">🎮</span>
            Controls
          </h2>

          <div className="flex flex-wrap gap-4">
            <button
              onClick={createShelf}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
              disabled={!isConnected}
            >
              Create Test Shelf
            </button>

            <button
              onClick={fetchAppStatus}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
              disabled={!isConnected}
            >
              Refresh Status
            </button>
          </div>
        </motion.div>

        {/* System Information */}
        <motion.div
          className="bg-white rounded-lg shadow-lg p-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <h2 className="text-xl font-semibold mb-4 text-gray-800 flex items-center">
            <span className="mr-2">💻</span>
            System Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <p>
                <strong>Platform:</strong> {process.platform}
              </p>
              <p>
                <strong>Architecture:</strong> {process.arch}
              </p>
              <p>
                <strong>Node Version:</strong> {process.versions.node}
              </p>
            </div>
            <div>
              <p>
                <strong>Electron Version:</strong> {process.versions.electron}
              </p>
              <p>
                <strong>Chrome Version:</strong> {process.versions.chrome}
              </p>
              <p>
                <strong>V8 Version:</strong> {process.versions.v8}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Usage Instructions */}
        <motion.div
          className="bg-gray-50 border border-gray-200 rounded-lg p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <span className="mr-2">💡</span>
            How to Use FileCataloger
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
            <div>
              <h4 className="font-semibold mb-2">Gesture Controls</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>
                  <strong>Shake cursor:</strong> Quickly move mouse left-right to show shelf
                </li>
                <li>
                  <strong>Drag files:</strong> Drag files from anywhere to trigger shelves
                </li>
                <li>
                  <strong>Pin shelves:</strong> Click pin icon to keep shelf visible
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Features</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>
                  <strong>Smart detection:</strong> Advanced algorithms for gesture recognition
                </li>
                <li>
                  <strong>File management:</strong> Temporary storage for files and content
                </li>
                <li>
                  <strong>Performance:</strong> Optimized for minimal resource usage
                </li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
