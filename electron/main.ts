import path from 'path';
import { app, BrowserWindow, ipcMain, shell, nativeImage, Tray, Menu } from 'electron';
import { autoUpdater } from 'electron-updater';
import serve from 'electron-serve';

const isProd = app.isPackaged;
const loadURL = serve({
  directory: 'out',
  scheme: 'app'
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
}

const setupDock = () => {
  if (process.platform === 'darwin' && app.dock) {
    const iconPath = isProd
      ? path.join(process.resourcesPath, 'icons', 'app.png')
      : path.join(app.getAppPath(), 'public', 'icons', 'app.png');

    try {
      const dockIcon = nativeImage.createFromPath(iconPath);
      if (!dockIcon.isEmpty()) {
        app.dock.setIcon(dockIcon);
      }
    } catch (error) {
    }

    app.dock.setBadge('');
  }
};

const createTray = () => {
  const iconPath = isProd
    ? path.join(process.resourcesPath, 'icons', process.platform === 'win32' ? 'app.ico' : 'app.png')
    : path.join(app.getAppPath(), 'public', 'icons', process.platform === 'win32' ? 'app.ico' : 'app.png');

  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '顯示視窗',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          if (!mainWindow.isVisible()) {
            mainWindow.show();
          }
          mainWindow.focus();
        }
      }
    },
    {
      label: '隱藏視窗',
      click: () => {
        if (mainWindow) {
          mainWindow.hide();
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('EQ RTS Map');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
};

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let pendingDeepLinkUrl: string | null = null;

const OAUTH_REDIRECT_SCHEME = 'eq-rts-map';
const API_BASE = 'https://manager.exptech.com.tw';
const OAUTH_CLIENT_ID = '20260202';

const createMainWindow = async (): Promise<BrowserWindow> => {
  const window = new BrowserWindow({
    width: 840,
    height: 630,
    maximizable: false,
    resizable: false,
    fullscreenable: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  window.on('close', (event) => {
    if (isQuitting) {
      return;
    }
    
    event.preventDefault();
    window.hide();
  });

  if (isProd) {
    await loadURL(window);
    await window.loadURL('app://-/home.html');
    window.setMenu(null);
  } else {
    await window.loadURL('http://localhost:3000/home');
  }

  return window;
};

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;
autoUpdater.allowDowngrade = false;

if (app.isPackaged) {
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'ExpTechTW',
    repo: 'eq-rts-map',
    vPrefixedTagName: false,
  });
}

autoUpdater.on('checking-for-update', () => {
  if (mainWindow) {
    mainWindow.webContents.send('update-checking');
  }
});

autoUpdater.on('update-available', (info) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info);
  }
});

autoUpdater.on('update-not-available', (info) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-not-available', info);
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info);
  }

  setTimeout(() => {
    isQuitting = true;
    autoUpdater.quitAndInstall(true, true);
  }, 3000);
});

autoUpdater.on('error', (err) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-error', err.message);
  }
});

app.on('second-instance', (_event, commandLine: string[]) => {
  const url = commandLine.find((arg) => arg.startsWith(`${OAUTH_REDIRECT_SCHEME}://`));
  if (url) sendOAuthCallbackFromUrl(url);
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
    mainWindow.moveTop();
  }
});

// macOS: open-url 可能在 app ready 之前觸發，必須在模組頂層註冊
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (mainWindow && !mainWindow.isDestroyed()) {
    sendOAuthCallbackFromUrl(url);
    mainWindow.show();
    mainWindow.focus();
  } else {
    // window 尚未建立，暫存 URL 等 ready 後處理
    pendingDeepLinkUrl = url;
  }
});

function sendOAuthCallbackFromUrl(url: string) {
  try {
    const u = new URL(url);
    const code = u.searchParams.get('code');
    const state = u.searchParams.get('state');
    if (code && state && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('oauth-callback', { code, state });
    }
  } catch (_) {}
}

// --- IPC Handlers（模組頂層註冊，避免 renderer 載入時 handler 尚未就緒）---

ipcMain.handle('oauth-exchange', async (
  _event,
  code: string,
  redirectUri: string,
  codeVerifier: string
) => {
  if (!OAUTH_CLIENT_ID) {
    throw new Error('OAuth client_id not configured');
  }
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: OAUTH_CLIENT_ID,
    code_verifier: codeVerifier,
  });
  const res = await fetch(`${API_BASE}/api/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `token exchange failed: ${res.status}`);
  }
  const data = (await res.json()) as { access_token: string };
  return { accessToken: data.access_token };
});

ipcMain.handle('oauth-userinfo', async (_event, accessToken: string) => {
  const res = await fetch(`${API_BASE}/api/v1/oauth2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`userinfo failed: ${res.status}`);
  }
  return await res.json();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: result?.updateInfo };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.on('install-update', () => {
  isQuitting = true;
  autoUpdater.quitAndInstall(true, true);
});

ipcMain.handle('open-external', async (_event, url: string) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-audio-path', async (_event, audioFile: string) => {
  if (isProd) {
    return path.join(process.resourcesPath, 'audios', audioFile);
  } else {
    return path.join(app.getAppPath(), 'public', 'audios', audioFile);
  }
});

ipcMain.handle('set-dock-badge', async (_event, text: string) => {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setBadge(text);
    return { success: true };
  }
  return { success: false, error: 'Not on macOS' };
});

ipcMain.handle('clear-dock-badge', async () => {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setBadge('');
    return { success: true };
  }
  return { success: false, error: 'Not on macOS' };
});

ipcMain.handle('bounce-dock', async (_event, type: 'critical' | 'informational' = 'informational') => {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.bounce(type);
    return { success: true };
  }
  return { success: false, error: 'Not on macOS' };
});

ipcMain.handle('quit-app', async () => {
  try {
    isQuitting = true;

    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        window.removeAllListeners();
      }
    });

    app.quit();
    return { success: true };
  } catch (error: any) {
    app.exit(0);
    return { success: true, message: 'Force quit' };
  }
});

ipcMain.handle('show-window', async () => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }

      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }

      mainWindow.focus();
      mainWindow.moveTop();
      mainWindow.setAlwaysOnTop(true);

      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.setAlwaysOnTop(false);
        }
      }, 100);

      return { success: true };
    } else {
      mainWindow = await createMainWindow();
      return { success: true, message: 'Window created' };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('force-quit', async () => {
  try {
    isQuitting = true;

    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        window.removeAllListeners();
        window.destroy();
      }
    });

    app.exit(0);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

(async () => {
  await app.whenReady();

  // 註冊自訂協議
  // 開發模式需傳 execPath + args，否則協議連結無法喚起正確的程序
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(OAUTH_REDIRECT_SCHEME, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  } else {
    // 打包後：macOS 透過 Info.plist，Windows 透過 NSIS 註冊表已處理
    // 這裡作為 fallback（Linux AppImage 等情況仍需要）
    app.setAsDefaultProtocolClient(OAUTH_REDIRECT_SCHEME);
  }

  // Windows / Linux: 首次啟動時 OS 透過 argv 傳入協議 URL
  const protocolUrl = process.argv.find((arg) => arg.startsWith(`${OAUTH_REDIRECT_SCHEME}://`));
  if (protocolUrl) {
    pendingDeepLinkUrl = protocolUrl;
  }

  setupDock();
  createTray();

  mainWindow = await createMainWindow();

  // 處理啟動前暫存的 deep link URL（macOS open-url 或 Windows/Linux argv）
  if (pendingDeepLinkUrl) {
    sendOAuthCallbackFromUrl(pendingDeepLinkUrl);
    pendingDeepLinkUrl = null;
  }

  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch(() => {});
    setInterval(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 300000);
  }
})();

app.on('window-all-closed', () => {
  if (!tray && process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.removeAllListeners();
  }

  if (tray) {
    tray.destroy();
    tray = null;
  }
});

app.on('activate', async () => {
  try {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = await createMainWindow();
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      
      mainWindow.focus();
      mainWindow.moveTop();
    } else {
      mainWindow = await createMainWindow();
    }
  } catch (error) {
    try {
      mainWindow = await createMainWindow();
    } catch (createError) {
    }
  }
});
