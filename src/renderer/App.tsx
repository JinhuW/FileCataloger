/**
 * @file App.tsx
 * @description App wrapper component that provides global providers and renders the DashboardPage.
 * This component runs in the main application window (not shelf windows).
 */

import React from 'react';
import { AppProviders } from './app/providers/AppProviders';
import { DashboardPage } from './pages/dashboard/DashboardPage';

const App: React.FC = () => {
  return (
    <AppProviders>
      <DashboardPage />
    </AppProviders>
  );
};

export default App;
