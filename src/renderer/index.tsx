/**
 * @file index.tsx
 * @description Main entry point for the FileCataloger dashboard/status window.
 * This file bootstraps the React application that displays system metrics and
 * application status. It's loaded when the main application window is created.
 *
 * @usage This is the entry point for the main application window, not shelf windows.
 * Shelf windows use shelf.tsx as their entry point.
 */

import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/globals.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container not found');
}

const root = createRoot(container);
root.render(<App />);
