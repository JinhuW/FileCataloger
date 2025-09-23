import React from 'react';
import { createRoot } from 'react-dom/client';
import { PluginManager } from '../preferences/plugins';
import { logger } from '@shared/logger';
import '../../styles/globals.css';

// Initialize React app
function initializeApp(): void {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    logger.error('Root element not found');
    return;
  }

  const root = createRoot(rootElement);
  root.render(<PluginManager />);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
