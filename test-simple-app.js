const { app, Tray, Menu } = require('electron');
const path = require('path');

let tray = null;

app.whenReady().then(() => {
  console.log('App ready, creating tray...');
  
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  console.log('Icon path:', iconPath);
  
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Test Item 1', type: 'normal' },
    { label: 'Test Item 2', type: 'normal' },
    { type: 'separator' },
    { label: 'Quit', type: 'normal', click: () => app.quit() }
  ]);
  
  tray.setToolTip('Test App');
  tray.setContextMenu(contextMenu);
  
  console.log('Tray created successfully!');
});

app.on('window-all-closed', (e) => {
  e.preventDefault(); // Prevent app from quitting
});