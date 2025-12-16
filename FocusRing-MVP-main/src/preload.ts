import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    // Overlay content listeners (for renderer.ts)
    onShowImage: (callback: (imagePath: string) => void) => {
        ipcRenderer.on('show-image', (_event, imagePath) => callback(imagePath));
    },
    onShowQuote: (callback: (quote: string) => void) => {
        ipcRenderer.on('show-quote', (_event, quote) => callback(quote));
    },
    onShowMetric: (callback: (data: { value: number; label: string }) => void) => {
        ipcRenderer.on('show-metric', (_event, data) => callback(data));
    },
    onClearOverlay: (callback: () => void) => {
        ipcRenderer.on('clear-overlay', () => callback());
    },
    onStatusLog: (callback: (data: { message: string, type: string, timestamp: string }) => void) => {
        ipcRenderer.on('status-log', (_event, data) => callback(data));
    },
    // Navigation
    goBack: () => ipcRenderer.send('go-back'),

    // Control methods
    startRingConnection: () => ipcRenderer.send('start-ring-connection'),
    stopRingConnection: () => ipcRenderer.send('stop-ring-connection'),
    activateSession: () => ipcRenderer.send('activate-session'),
    quitApp: () => ipcRenderer.send('quit-app'),
    getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),
    openSessionSetup: () => ipcRenderer.send('open-session-setup'),

    // Authentication methods
    signIn: (email: string, password: string) => ipcRenderer.invoke('auth-sign-in', email, password),
    signUp: (email: string, password: string) => ipcRenderer.invoke('auth-sign-up', email, password),
    signOut: () => ipcRenderer.invoke('auth-sign-out'),
    checkSession: () => ipcRenderer.invoke('auth-check-session'),

    // Gemini Content Generation
    generateSessionContent: (task: string, reward: string) => ipcRenderer.invoke('generate-session-content', task, reward),
    getFallbackContent: () => ipcRenderer.invoke('get-fallback-content'),
    generateImage: (prompt: string) => ipcRenderer.invoke('generate-image', prompt),
    saveSessionContent: (content: any) => ipcRenderer.invoke('save-session-content', content),
    sessionContentReady: () => ipcRenderer.send('session-content-ready'),
    getSessionContent: () => ipcRenderer.invoke('get-session-content'),

    // Status updates for the control window
    onConnectionStatus: (callback: (status: any) => void) => {
        ipcRenderer.on('connection-status', (_event, status) => callback(status));
    },
    onStatsUpdated: (callback: (data: { today: number }) => void) => {
        ipcRenderer.on('stats-updated', (_event, data) => callback(data));
    },
    // Auth state change listener
    onAuthStateChange: (callback: (isAuthenticated: boolean) => void) => {
        ipcRenderer.on('auth-state-change', (_event, isAuthenticated) => callback(isAuthenticated));
    }
});

