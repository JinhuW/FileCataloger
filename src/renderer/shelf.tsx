import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Shelf } from './components/Shelf';
import { ShelfConfig, ShelfItem } from '@shared/types';
import './styles/globals.css';

/**
 * Shelf window renderer entry point
 */
const ShelfWindow: React.FC = () => {
  const [config, setConfig] = useState<ShelfConfig>({
    id: 'default',
    position: { x: 0, y: 0 },
    dockPosition: null,
    isPinned: true,
    items: [],
    isVisible: true,
    opacity: 0.95
  });
  
  // Debug window API
  console.log('🌐 Window API debug on mount:');
  console.log('  - window.api:', window.api);
  console.log('  - window.electronAPI:', window.electronAPI);
  console.log('  - typeof window.api:', typeof window.api);
  console.log('  - typeof window.electronAPI:', typeof window.electronAPI);

  useEffect(() => {
    // Listen for configuration updates from main process
    if (window.api) {
      window.api.on('shelf:config', (...args: unknown[]) => {
        const newConfig = args[0] as ShelfConfig;
        console.log('🆔 Received shelf config:', newConfig.id, 'with', newConfig.items.length, 'items');
        setConfig(newConfig);
      });

      window.api.on('shelf:add-item', (...args: unknown[]) => {
        const item = args[0] as ShelfItem;
        setConfig(prev => ({
          ...prev,
          items: [...prev.items, item]
        }));
      });

      window.api.on('shelf:remove-item', (...args: unknown[]) => {
        const itemId = args[0] as string;
        setConfig(prev => ({
          ...prev,
          items: prev.items.filter(item => item.id !== itemId)
        }));
      });
    }

    return () => {
      if (window.api) {
        window.api.removeAllListeners('shelf:config');
        window.api.removeAllListeners('shelf:add-item');
        window.api.removeAllListeners('shelf:remove-item');
      }
    };
  }, []);

  const handleConfigChange = (changes: Partial<ShelfConfig>) => {
    const newConfig = { ...config, ...changes };
    setConfig(newConfig);
    
    // Notify main process of configuration changes
    if (window.api) {
      window.api.invoke('shelf:update-config', config.id, changes);
    }
  };

  const handleItemAdd = (item: ShelfItem) => {
    console.log('🔔 handleItemAdd called for shelf', config.id, 'with item:', item);
    
    // Update local state first
    setConfig(prev => {
      const newConfig = {
        ...prev,
        items: [...prev.items, item]
      };
      console.log('📊 Updated local config, now has', newConfig.items.length, 'items');
      
      // Immediately notify backend that shelf has items
      if (window.api && prev.items.length === 0 && newConfig.items.length > 0) {
        console.log('🔔 First item added! Notifying backend to persist shelf');
        // Send a simple message that shelf now has content
        window.api.send('shelf:files-dropped', { 
          shelfId: prev.id, 
          files: [item.name] // Just send something to trigger persistence
        });
      }
      
      return newConfig;
    });
    
    // Notify main process
    if (window.api) {
      console.log('📡 Sending shelf:add-item IPC call for shelf', config.id);
      window.api.invoke('shelf:add-item', config.id, item)
        .then(result => {
          console.log('✅ IPC shelf:add-item succeeded:', result);
        })
        .catch(err => {
          console.error('❌ Failed to add item via IPC:', err);
          console.error('Shelf ID:', config.id);
          console.error('Item:', item);
        });
    } else {
      console.error('❌ window.api is not available!');
    }
  };

  const handleItemRemove = (itemId: string) => {
    setConfig(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }));
    
    // Notify main process
    if (window.api) {
      window.api.invoke('shelf:remove-item', config.id, itemId);
    }
  };

  const handleClose = () => {
    if (window.api) {
      window.api.invoke('shelf:close', config.id);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'transparent',
      padding: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Shelf
        config={config}
        onConfigChange={handleConfigChange}
        onItemAdd={handleItemAdd}
        onItemRemove={handleItemRemove}
        onClose={handleClose}
      />
    </div>
  );
};

// Mount the application
const container = document.getElementById('root');
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <ShelfWindow />
    </React.StrictMode>
  );
} else {
  console.error('Failed to find root element');
}