/**
 * Demo Page Entry Point
 *
 * Standalone page to test the meta-component system
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { PatternBuilderDemo } from '../../components/demo/PatternBuilderDemo';
import '../../styles/globals.css';

const root = document.getElementById('root');

if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <PatternBuilderDemo />
    </React.StrictMode>
  );
}
