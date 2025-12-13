import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    // Define specific channels for security
    onShowImage: (callback: (imagePath: string) => void) => {
        ipcRenderer.on('show-image', (_event, imagePath) => callback(imagePath));
    },
    onStatusLog: (callback: (data: { message: string, type: string, timestamp: string }) => void) => {
        ipcRenderer.on('status-log', (_event, data) => callback(data));
    },
    // No need to expose hide, main process handles window visibility

    // Control methods
    startRingConnection: () => ipcRenderer.send('start-ring-connection'),
    stopRingConnection: () => ipcRenderer.send('stop-ring-connection'),
    activateSession: () => ipcRenderer.send('activate-session'),
    quitApp: () => ipcRenderer.send('quit-app'),
    getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),

    // Status updates for the control window
    onConnectionStatus: (callback: (status: any) => void) => {
        ipcRenderer.on('connection-status', (_event, status) => callback(status));
    },
    onStatsUpdated: (callback: (data: { today: number }) => void) => {
        ipcRenderer.on('stats-updated', (_event, data) => callback(data));
    }
});