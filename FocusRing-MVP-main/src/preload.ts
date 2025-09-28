import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    // Define specific channels for security
    onShowImage: (callback: (imagePath: string) => void) => {
        ipcRenderer.on('show-image', (_event, imagePath) => callback(imagePath));
    },
    // No need to expose hide, main process handles window visibility
});