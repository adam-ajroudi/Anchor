import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as remoteMain from '@electron/remote/main';

// Initialize @electron/remote
remoteMain.initialize();

let overlayWindow: BrowserWindow | null = null;
let imagePaths: string[] = [];
let currentImageIndex = 0;
const SHORTCUT = 'Alt+F';

// Timer for checking if keys are still held
let keyCheckInterval: NodeJS.Timeout | null = null;
let isOverlayVisible = false;

function loadImagePaths() {
    // We know these images exist in the images folder at the root of the project
    const workspaceDir = app.getAppPath();
    console.log(`App path: ${workspaceDir}`);
    
    // Hard code the list of known images
    const imageFiles = [
        '0_gHANif08o4nJZF14.png',
        'istockphoto-1257169887-612x612.jpg',
        'istockphoto-1830236402-612x612.jpg',
        'Screenshot 2025-04-23 202743.png'
    ];
    
    // Create absolute paths for each file
    imagePaths = imageFiles.map(file => {
        // This is the absolute path to each image
        const absolutePath = path.join(workspaceDir, 'images', file);
        return absolutePath;
    });

    console.log("Hard-coded image paths:");
    imagePaths.forEach((imagePath, index) => {
        const exists = fs.existsSync(imagePath);
        console.log(`Image ${index}: ${imagePath} - Exists: ${exists}`);
    });
    
    currentImageIndex = 0;
}

function createOverlayWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    overlayWindow = new BrowserWindow({
        width: width,
        height: height,
        x: primaryDisplay.workArea.x,
        y: primaryDisplay.workArea.y,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            devTools: !app.isPackaged
        },
    });

    // Enable @electron/remote for this window
    remoteMain.enable(overlayWindow.webContents);

    overlayWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

    // Open DevTools in development mode
    if (!app.isPackaged) {
        overlayWindow.webContents.openDevTools({ mode: 'detach' });
    }

    overlayWindow.on('closed', () => {
        overlayWindow = null;
    });

    // Make window non-focusable to prevent stealing focus
    overlayWindow.setFocusable(false);
}

function showOverlay() {
    if (!overlayWindow || imagePaths.length === 0) {
        console.log('Cannot show overlay: ' + 
            (!overlayWindow ? 'No overlay window' : 'No images found'));
        return;
    }
    
    const imageToShow = imagePaths[currentImageIndex];
    console.log(`Showing image index ${currentImageIndex}: ${imageToShow}`);
    
    if (fs.existsSync(imageToShow)) {
        console.log(`Image file exists when attempting to show`);
        
        try {
            // Read the image directly as binary data
            const imageData = fs.readFileSync(imageToShow);
            
            // Convert to base64 with the proper mime type
            const base64Image = imageData.toString('base64');
            const mimeType = getMimeType(imageToShow);
            
            // Create a data URL that the renderer can use directly
            const dataUrl = `data:${mimeType};base64,${base64Image}`;
            console.log(`Created data URL for image with mime type: ${mimeType}`);
            
            // Send the data URL to the renderer
            overlayWindow.webContents.send('show-image', dataUrl);
        } catch (err) {
            console.error('Error processing image:', err);
        }
    } else {
        console.error(`Image file does not exist: ${imageToShow}`);
    }
    
    overlayWindow.show();
    isOverlayVisible = true;
}

// Helper function to determine MIME type from file extension
function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.png': return 'image/png';
        case '.jpg': 
        case '.jpeg': return 'image/jpeg';
        case '.gif': return 'image/gif';
        case '.webp': return 'image/webp';
        case '.bmp': return 'image/bmp';
        default: return 'image/png';
    }
}

function hideOverlay() {
    if (!overlayWindow) return;
    
    console.log('Hiding overlay.');
    overlayWindow.hide();
    isOverlayVisible = false;
    
    // Advance to next image after hiding
    currentImageIndex = (currentImageIndex + 1) % (imagePaths.length || 1);
    console.log(`Next image index will be: ${currentImageIndex}`);
}

// Check if Alt+F is still being held down by periodically checking globalShortcut
function startKeyCheckTimer() {
    // Clear existing timer if any
    if (keyCheckInterval) {
        clearInterval(keyCheckInterval);
        keyCheckInterval = null;
    }

    // Start a new timer that checks if shortcut is still registered
    keyCheckInterval = setInterval(() => {
        // Test if the shortcut is released by trying to register a temporary handler
        let keyReleased = false;
        
        try {
            // If this succeeds without error, it means the shortcut is not currently pressed
            globalShortcut.register(SHORTCUT, () => {});
            keyReleased = true;
            // Clean up the temporary registration
            globalShortcut.unregister(SHORTCUT);
        } catch (e) {
            // If we get here, the shortcut is still being held down
            keyReleased = false;
        }

        if (keyReleased && isOverlayVisible) {
            // If keys were released and overlay is visible, hide it
            hideOverlay();
            clearInterval(keyCheckInterval!);
            keyCheckInterval = null;
            
            // Restore the main shortcut handler
            registerMainShortcut();
        } else if (keyReleased) {
            // Just cleanup if overlay isn't visible
            clearInterval(keyCheckInterval!);
            keyCheckInterval = null;
            // Make sure main shortcut is registered
            registerMainShortcut();
        }
    }, 100); // Check every 100ms
}

// Register the main shortcut handler
function registerMainShortcut() {
    // Unregister first to avoid duplicates
    try {
        globalShortcut.unregister(SHORTCUT);
    } catch (e) {
        console.warn(`Error unregistering shortcut: ${e}`);
    }
    
    // Register the shortcut
    const registered = globalShortcut.register(SHORTCUT, () => {
        console.log(`${SHORTCUT} pressed`);
        
        // When shortcut is pressed, show overlay and start checking for release
        showOverlay();
        startKeyCheckTimer();
    });
    
    if (registered) {
        console.log(`${SHORTCUT} registered successfully.`);
    } else {
        console.error(`Failed to register ${SHORTCUT}.`);
    }
}

app.whenReady().then(() => {
    loadImagePaths(); // Load images on startup
    createOverlayWindow();
    registerMainShortcut();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            loadImagePaths(); // Reload images if app was inactive
            createOverlayWindow();
        }
    });
});

app.on('will-quit', () => {
    // Unregister all shortcuts
    globalShortcut.unregisterAll();
    
    // Clear any timers
    if (keyCheckInterval) {
        clearInterval(keyCheckInterval);
        keyCheckInterval = null;
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});