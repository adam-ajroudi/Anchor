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
});