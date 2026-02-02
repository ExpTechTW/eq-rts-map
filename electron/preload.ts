import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.send('install-update'),

  onUpdateChecking: (callback: () => void) => ipcRenderer.on('update-checking', callback),
  onUpdateAvailable: (callback: (info: any) => void) => ipcRenderer.on('update-available', (_event, info) => callback(info)),
  onUpdateNotAvailable: (callback: (info: any) => void) => ipcRenderer.on('update-not-available', (_event, info) => callback(info)),
  onUpdateError: (callback: (error: string) => void) => ipcRenderer.on('update-error', (_event, error) => callback(error)),
  onUpdateDownloadProgress: (callback: (progress: any) => void) => ipcRenderer.on('update-download-progress', (_event, progress) => callback(progress)),
  onUpdateDownloaded: (callback: (info: any) => void) => ipcRenderer.on('update-downloaded', (_event, info) => callback(info)),
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update-checking');
    ipcRenderer.removeAllListeners('update-available');
    ipcRenderer.removeAllListeners('update-not-available');
    ipcRenderer.removeAllListeners('update-error');
    ipcRenderer.removeAllListeners('update-download-progress');
    ipcRenderer.removeAllListeners('update-downloaded');
  },

  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  oauthExchange: (code: string, redirectUri: string, codeVerifier: string) =>
    ipcRenderer.invoke('oauth-exchange', code, redirectUri, codeVerifier),
  oauthUserInfo: (accessToken: string) =>
    ipcRenderer.invoke('oauth-userinfo', accessToken),
  onOAuthCallback: (callback: (params: { code: string; state: string }) => void) => {
    const fn = (_: unknown, params: { code: string; state: string }) => callback(params);
    ipcRenderer.on('oauth-callback', fn);
    return () => ipcRenderer.removeListener('oauth-callback', fn);
  },

  getAudioPath: (audioFile: string) => ipcRenderer.invoke('get-audio-path', audioFile),

  setDockBadge: (text: string) => ipcRenderer.invoke('set-dock-badge', text),
  clearDockBadge: () => ipcRenderer.invoke('clear-dock-badge'),
  bounceDock: (type?: 'critical' | 'informational') => ipcRenderer.invoke('bounce-dock', type),

  quitApp: () => ipcRenderer.invoke('quit-app'),
  showWindow: () => ipcRenderer.invoke('show-window'),
  forceQuit: () => ipcRenderer.invoke('force-quit'),
});
