// Electron hovedprosess. Denne pakker den lokale nettsiden i renderer/ som en
// ekte skrivebordsapp. Ingen server, ingen sky - alt kjorer paa maskinen din.
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1120,
    height: 820,
    minWidth: 820,
    minHeight: 620,
    backgroundColor: '#12161f',
    title: 'Bekymringstreet',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      // Ingen nodeIntegration - renderer er bare vanlig HTML/CSS/JS og
      // lagrer data lokalt via nettleserens localStorage.
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Aapne eventuelle eksterne lenker i standardnettleseren, ikke inne i appen.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
