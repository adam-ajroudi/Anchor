import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as remoteMain from '@electron/remote/main';
import { spawn, ChildProcess } from 'child_process';
import { database } from './database'; // Import database placeholder

// Initialize @electron/remote
remoteMain.initialize();

let overlayWindow: BrowserWindow | null = null;
let controlWindow: BrowserWindow | null = null; // Replaces statusWindow
let imagePaths: string[] = [];
const SHORTCUT = process.platform === 'darwin' ? 'Option+F' : 'Alt+F';

// Timer for checking if keys are still held
let keyCheckInterval: NodeJS.Timeout | null = null;
let isOverlayVisible = false;

// Python subprocess management
let pythonProcess: ChildProcess | null = null;
let pythonRetryInterval: NodeJS.Timeout | null = null;
let isBluetoothConnected = false;

// Shortcut state tracking to prevent multiple rapid triggers
let isShortcutPressed = false;

/**
 * Helper function to check if a file is a valid image based on extension.
 */
function isValidImageFile(filename: string): boolean {
    const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
    const ext = path.extname(filename).toLowerCase();
    return validExtensions.includes(ext);
}

/**
 * Dynamically loads all image files from the images folder.
 * Scans the directory and filters for valid image file extensions.
 */
function loadImagePaths() {
    const workspaceDir = app.getAppPath();
    const imagesDir = path.join(workspaceDir, 'images');

    console.log(`App path: ${workspaceDir}`);
    console.log(`Scanning images directory: ${imagesDir}`);

    // Check if images directory exists
    if (!fs.existsSync(imagesDir)) {
        console.error(`Images directory does not exist: ${imagesDir}`);
        imagePaths = [];
        return;
    }

    try {
        // Read all files from the images directory
        const allFiles = fs.readdirSync(imagesDir);

        // Filter for valid image files only
        const imageFiles = allFiles.filter(isValidImageFile);

        if (imageFiles.length === 0) {
            console.warn('No valid image files found in images directory');
            imagePaths = [];
            return;
        }

        // Create absolute paths for each image file
        imagePaths = imageFiles.map(file => path.join(imagesDir, file));

        console.log(`Found ${imagePaths.length} image(s):`);
        imagePaths.forEach((imagePath, index) => {
            const exists = fs.existsSync(imagePath);
            console.log(`  ${index}: ${path.basename(imagePath)} - Exists: ${exists}`);
        });

    } catch (error) {
        console.error('Error loading image paths:', error);
        imagePaths = [];
    }
}

/**
 * Creates the Bluetooth status window to show connection logs.
 */
/**
 * Creates the Control Window (Startup/Dashboard/Connection).
 */
function createControlWindow() {
    controlWindow = new BrowserWindow({
        width: 900,
        height: 700,
        frame: true,
        resizable: false, // Keep it fixed for the design
        title: 'Focus Ring Control',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            // devTools: !app.isPackaged // Optional: Keep enabled for debugging if needed, but requested off by default
        },
    });

    // Remove menu for cleaner look
    controlWindow.setMenuBarVisibility(false);

    // Enable @electron/remote
    remoteMain.enable(controlWindow.webContents);

    controlWindow.loadFile(path.join(__dirname, '..', 'src', 'startup.html'));

    controlWindow.on('closed', () => {
        controlWindow = null;
        // If control window closes, we might want to quit app or keep running in tray?
        // For MVP, closing control window usually implies quitting if no overlay is active, 
        // but let's leave standard behavior.
    });
}

/**
 * Sends a log message to the status window.
 */
/**
 * Sends a log message to the control window.
 */
function sendStatusLog(message: string, type: 'info' | 'success' | 'error' = 'info') {
    if (controlWindow && !controlWindow.isDestroyed()) {
        controlWindow.webContents.send('status-log', { message, type, timestamp: new Date().toLocaleTimeString() });
    }
}

// Removed closeStatusWindow since we want the control window to stay open 
// or be manually navigated by the user.

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
    // if (!app.isPackaged) {
    //     overlayWindow.webContents.openDevTools({ mode: 'detach' });
    // }

    overlayWindow.on('closed', () => {
        overlayWindow = null;
    });

    // Make window non-focusable to prevent stealing focus
    overlayWindow.setFocusable(false);
}

/**
 * Shows the overlay window with a randomly selected image.
 * Picks a new random image each time the overlay is displayed.
 */
function showOverlay() {
    if (!overlayWindow || imagePaths.length === 0) {
        console.log('Cannot show overlay: ' +
            (!overlayWindow ? 'No overlay window' : 'No images found'));
        return;
    }

    // Pick a random image from the available images
    const randomIndex = Math.floor(Math.random() * imagePaths.length);
    const imageToShow = imagePaths[randomIndex];

    console.log(`Showing random image ${randomIndex + 1}/${imagePaths.length}: ${path.basename(imageToShow)}`);

    if (fs.existsSync(imageToShow)) {
        try {
            // Read the image directly as binary data
            const imageData = fs.readFileSync(imageToShow);

            // Convert to base64 with the proper mime type
            const base64Image = imageData.toString('base64');
            const mimeType = getMimeType(imageToShow);

            // Create a data URL that the renderer can use directly
            const dataUrl = `data:${mimeType};base64,${base64Image}`;
            console.log(`Successfully loaded image (${mimeType})`);

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

    // Note: Removed automatic image cycling - keeping same image
}

/**
 * Toggles the overlay visibility.
 * First call shows the overlay, second call hides it.
 */
function toggleOverlay() {
    if (isOverlayVisible) {
        hideOverlay();
    } else {
        showOverlay();
    }
}

/**
 * Checks periodically if the keyboard shortcut has been released.
 * When released, resets the isShortcutPressed flag to allow next trigger.
 */
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
            globalShortcut.register(SHORTCUT, () => { });
            keyReleased = true;
            // Clean up the temporary registration
            globalShortcut.unregister(SHORTCUT);
        } catch (e) {
            // If we get here, the shortcut is still being held down
            keyReleased = false;
        }

        if (keyReleased) {
            // Keys released - reset the flag to allow next trigger
            console.log(`${SHORTCUT} released`);
            isShortcutPressed = false;
            clearInterval(keyCheckInterval!);
            keyCheckInterval = null;

            // Restore the main shortcut handler
            registerMainShortcut();
        }
    }, 100); // Check every 100ms
}

/**
 * Registers the main keyboard shortcut handler.
 * Only triggers once per press cycle (prevents multiple triggers when held).
 */
function registerMainShortcut() {
    // Unregister first to avoid duplicates
    try {
        globalShortcut.unregister(SHORTCUT);
    } catch (e) {
        console.warn(`Error unregistering shortcut: ${e}`);
    }

    // Register the shortcut
    const registered = globalShortcut.register(SHORTCUT, () => {
        // Only process if shortcut hasn't been triggered yet in this press cycle
        if (!isShortcutPressed) {
            console.log(`${SHORTCUT} pressed`);
            isShortcutPressed = true;

            // Log to database placeholder
            database.logClick(new Date().toISOString());

            // Toggle overlay visibility
            toggleOverlay();

            // Start checking for key release
            startKeyCheckTimer();
        }
    });

    if (registered) {
        console.log(`${SHORTCUT} registered successfully.`);
    } else {
        console.error(`Failed to register ${SHORTCUT}.`);
    }
}

/**
 * Starts the Python Bluetooth listener script as a subprocess.
 * Captures stdout/stderr for debugging and parses output for button press events.
 * Automatically retries if connection fails.
 */
function startPythonScript() {
    try {
        // Get the path to main.py in the workspace root (parent of app directory)
        const appPath = app.getAppPath();
        const workspaceRoot = path.join(appPath, '..');
        const scriptPath = path.join(workspaceRoot, 'main.py');

        const logMsg = `Starting Python script: ${scriptPath}`;
        console.log(logMsg);
        sendStatusLog(logMsg, 'info');

        console.log(`Working directory: ${workspaceRoot}`);

        // Check if the script exists
        if (!fs.existsSync(scriptPath)) {
            const errMsg = `Python script not found at: ${scriptPath}`;
            console.error(errMsg);
            sendStatusLog(errMsg, 'error');
            sendStatusLog('Will retry in 5 seconds...', 'info');
            scheduleRetry();
            return;
        }

        // Spawn the Python process with unbuffered output (-u flag)
        // This ensures we see output in real-time on Windows
        const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
        pythonProcess = spawn(pythonCommand, ['-u', scriptPath], {
            cwd: workspaceRoot,
            shell: true
        });

        sendStatusLog('Python Bluetooth listener started', 'success');

        // Handle stdout - log all output and detect button presses
        pythonProcess.stdout?.on('data', (data) => {
            const output = data.toString().trim();
            console.log(`[Python]: ${output}`);

            // Send to status window
            sendStatusLog(output, 'info');

            // Detect successful connection
            if (output.includes('Successfully connected')) {
                console.log('✅ Bluetooth ring connected successfully!');
                sendStatusLog('✅ BLUETOOTH RING CONNECTED!', 'success');
                isBluetoothConnected = true;

                // We do NOT close the window anymore, user can choose to leave it or minimize it.
                // Optionally notify UI to switch state, but logs are enough for now.
            }

            // Detect subscription success
            if (output.includes('Successfully subscribed to notifications')) {
                sendStatusLog('✅ Ready to receive button presses!', 'success');
            }

            // Detect button press trigger
            if (output.includes('BUTTON PRESSED!')) {
                console.log('🔵 Bluetooth ring button detected - toggling overlay');
                toggleOverlay();
            }

            // Detect scanning
            if (output.includes('Scanning for')) {
                sendStatusLog('🔍 Scanning for Zikr Ring Lite...', 'info');
            }

            // Detect device found
            if (output.includes('Found device:')) {
                sendStatusLog('📱 Ring found! Connecting...', 'info');
            }

            // Detect could not find device
            if (output.includes('Could not find a device')) {
                sendStatusLog('❌ Ring not found. Make sure it\'s powered on and nearby.', 'error');
                sendStatusLog('Will retry in 5 seconds...', 'info');
            }
        });

        // Handle stderr - log errors
        pythonProcess.stderr?.on('data', (data) => {
            const error = data.toString().trim();
            console.error(`[Python Error]: ${error}`);
            sendStatusLog(`Error: ${error}`, 'error');
        });

        // Handle process exit
        pythonProcess.on('exit', (code, signal) => {
            const exitMsg = `Python process exited with code ${code}`;
            console.log(exitMsg);

            if (!isBluetoothConnected) {
                sendStatusLog(exitMsg, 'error');
                sendStatusLog('Retrying connection in 5 seconds...', 'info');
                scheduleRetry();
            }

            pythonProcess = null;
        });

        // Handle process errors
        pythonProcess.on('error', (err) => {
            const errMsg = `Failed to start Python: ${err.message}`;
            console.error(errMsg);
            sendStatusLog(errMsg, 'error');
            sendStatusLog('Make sure Python is installed and in PATH', 'error');
            sendStatusLog('Retrying in 5 seconds...', 'info');
            pythonProcess = null;
            scheduleRetry();
        });

    } catch (err) {
        const errMsg = `Error starting Python script: ${err}`;
        console.error(errMsg);
        sendStatusLog(errMsg, 'error');
        pythonProcess = null;
        scheduleRetry();
    }
}

/**
 * Schedules a retry of the Python script after 5 seconds.
 */
function scheduleRetry() {
    // Clear any existing retry timer
    if (pythonRetryInterval) {
        clearTimeout(pythonRetryInterval);
    }

    // Only retry if Bluetooth is not connected
    if (!isBluetoothConnected) {
        pythonRetryInterval = setTimeout(() => {
            console.log('Retrying Python Bluetooth connection...');
            sendStatusLog('🔄 Retrying connection...', 'info');
            startPythonScript();
        }, 5000); // Retry after 5 seconds
    }
}

/**
 * Stops the Python subprocess gracefully.
 * Sends SIGTERM first to allow proper Bluetooth disconnection, then force kills if needed.
 */
function stopPythonScript() {
    // Clear retry timer
    if (pythonRetryInterval) {
        clearTimeout(pythonRetryInterval);
        pythonRetryInterval = null;
    }

    if (pythonProcess) {
        console.log('Stopping Python Bluetooth listener...');
        try {
            // Store reference to avoid race condition with exit handler
            const processToKill = pythonProcess;

            // Send SIGTERM to allow graceful shutdown and Bluetooth disconnect
            processToKill.kill('SIGTERM');

            // Give it 2 seconds to disconnect gracefully
            const killTimeout = setTimeout(() => {
                // Check if process still exists and hasn't exited
                if (processToKill && !processToKill.killed && processToKill.exitCode === null) {
                    console.log('Force killing Python process...');
                    try {
                        processToKill.kill('SIGKILL');
                    } catch (killErr) {
                        console.error(`Error force killing process: ${killErr}`);
                    }
                }
            }, 2000);

            // Clean up when process exits
            processToKill.once('exit', () => {
                clearTimeout(killTimeout);
                pythonProcess = null;
                isBluetoothConnected = false;
                console.log('Python process terminated and Bluetooth disconnected');
            });

        } catch (err) {
            console.error(`Error stopping Python process: ${err}`);
            pythonProcess = null;
        }
    }
}

app.whenReady().then(() => {
    loadImagePaths(); // Load images on startup
    createOverlayWindow();
    createControlWindow(); // Show the new startup/control UI

    // Setup IPC Handlers
    ipcMain.on('start-ring-connection', () => {
        startPythonScript();
    });

    ipcMain.on('stop-ring-connection', () => {
        stopPythonScript();
    });

    ipcMain.handle('get-dashboard-stats', async () => {
        return await database.getDailyStats();
    });

    registerMainShortcut();

    // Note: Python script is NO LONGER started automatically here.
    // startPythonScript();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            loadImagePaths(); // Reload images if app was inactive
            createOverlayWindow();
        }
    });
});

app.on('will-quit', () => {
    // Stop Python subprocess
    stopPythonScript();

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