import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as remoteMain from '@electron/remote/main';
import { spawn, ChildProcess } from 'child_process';
import { database } from './database';
import { signIn, signUp, signOut, getSession } from './supabase';
import { generateSessionContent, getFallbackContent, GeneratedContent, generateImage } from './gemini';

// Initialize @electron/remote
remoteMain.initialize();

let overlayWindow: BrowserWindow | null = null;
let controlWindow: BrowserWindow | null = null;
let loginWindow: BrowserWindow | null = null;
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

// Session tracking - clicks only count when session is active (after user confirms connection)
let isSessionActive = false;

// Click counter for multi-modal feedback rotation (0=image, 1=quote, 2=metric)
let clickCount = 0;

// Store current session content (quotes from Gemini)
let sessionQuotes: string[] = [];

// Store AI-generated images (data URLs)
let sessionImages: string[] = [];

// Navigation history for back button
let navigationHistory: string[] = [];

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
 * Creates the Control Window (Startup/Dashboard/Connection).
 */
function createControlWindow() {
    controlWindow = new BrowserWindow({
        width: 1100,
        height: 850,
        frame: true,
        resizable: true,
        autoHideMenuBar: true,
        title: 'Anchor - Focus Ring Control',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            devTools: true,
            webSecurity: false
        },
    });

    controlWindow.setMenuBarVisibility(true);
    controlWindow.autoHideMenuBar = false;
    remoteMain.enable(controlWindow.webContents);
    controlWindow.loadFile(path.join(__dirname, '..', 'src', 'startup.html'));

    controlWindow.on('closed', () => {
        controlWindow = null;
    });
}

/**
 * Creates the Login Window for authentication.
 */
function createLoginWindow() {
    loginWindow = new BrowserWindow({
        width: 500,
        height: 650,
        frame: true,
        resizable: false,
        autoHideMenuBar: true,
        title: 'Anchor - Login',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            devTools: true,
        },
    });

    remoteMain.enable(loginWindow.webContents);
    loginWindow.loadFile(path.join(__dirname, '..', 'src', 'login.html'));

    loginWindow.on('closed', () => {
        loginWindow = null;
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
    // Use full bounds (including taskbar area) for truly fullscreen overlay
    const { width, height, x, y } = primaryDisplay.bounds;

    overlayWindow = new BrowserWindow({
        width: width,
        height: height,
        x: x,
        y: y,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        show: false,
        fullscreen: false, // Don't use native fullscreen, manage manually
        resizable: false,
        movable: false,
        useContentSize: true, // Use content size for more accurate rendering
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            devTools: !app.isPackaged,
            zoomFactor: 1.0 // Prevent zoom scaling issues
        },
    });

    // Enable @electron/remote for this window
    remoteMain.enable(overlayWindow.webContents);

    overlayWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

    overlayWindow.on('closed', () => {
        overlayWindow = null;
    });

    // Make window non-focusable to prevent stealing focus
    overlayWindow.setFocusable(false);

    // Ensure consistent zoom level
    overlayWindow.webContents.setZoomFactor(1.0);
}

/**
 * Shows the overlay window with rotating content types.
 * Uses clickCount % 3 to determine what to show:
 *   0 = Visual Anchor (image)
 *   1 = Semantic Anchor (quote)
 *   2 = Metric Anchor (current stats)
 */
async function showOverlay() {
    if (!overlayWindow) {
        console.log('Cannot show overlay: No overlay window');
        return;
    }

    // Determine content type based on click count
    const contentType = clickCount % 3;
    clickCount++;

    console.log(`Showing overlay - Click #${clickCount}, Content type: ${contentType}`);

    switch (contentType) {
        case 0:
            // Visual Anchor - show random image
            await showImageAnchor();
            break;
        case 1:
            // Semantic Anchor - show quote
            await showQuoteAnchor();
            break;
        case 2:
            // Metric Anchor - show today's stats
            await showMetricAnchor();
            break;
    }

    overlayWindow.show();
    isOverlayVisible = true;
}

/**
 * Shows a random image - prioritizes AI-generated images, falls back to local folder
 */
async function showImageAnchor() {
    if (!overlayWindow) {
        console.log('No overlay window');
        return;
    }

    // Prioritize AI-generated images if available
    if (sessionImages.length > 0) {
        const randomIndex = Math.floor(Math.random() * sessionImages.length);
        const imageData = sessionImages[randomIndex];
        console.log(`Showing AI-GENERATED IMAGE anchor #${randomIndex + 1}`);
        overlayWindow.webContents.send('show-image', imageData);
        return;
    }

    // Fall back to local images folder
    if (imagePaths.length === 0) {
        console.log('No images available, falling back to quote');
        await showQuoteAnchor();
        return;
    }

    const randomIndex = Math.floor(Math.random() * imagePaths.length);
    const imageToShow = imagePaths[randomIndex];

    console.log(`Showing LOCAL IMAGE anchor: ${path.basename(imageToShow)}`);

    if (fs.existsSync(imageToShow)) {
        try {
            const imageData = fs.readFileSync(imageToShow);
            const base64Image = imageData.toString('base64');
            const mimeType = getMimeType(imageToShow);
            const dataUrl = `data:${mimeType};base64,${base64Image}`;
            overlayWindow.webContents.send('show-image', dataUrl);
        } catch (err) {
            console.error('Error processing image:', err);
        }
    }
}

/**
 * Shows a random quote from session content or fallback
 */
async function showQuoteAnchor() {
    if (!overlayWindow) return;

    // Default fallback quotes
    const fallbackQuotes = [
        "Every moment of awareness is a victory. You noticed—that's the hardest part.",
        "Focus isn't about never drifting. It's about gently returning, again and again.",
        "You're building something powerful with each redirect. Keep going."
    ];

    const quotes = sessionQuotes.length > 0 ? sessionQuotes : fallbackQuotes;
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

    console.log(`Showing QUOTE anchor: "${randomQuote.substring(0, 50)}..."`);
    overlayWindow.webContents.send('show-quote', randomQuote);
}

/**
 * Shows the current day's click count and streak
 */
async function showMetricAnchor() {
    if (!overlayWindow) return;

    try {
        const stats = await database.getDailyStats();
        // If Supabase returned 0 but we have local clicks, use local count
        const displayValue = stats.today > 0 ? stats.today : clickCount;
        const label = stats.today > 0 ? 'Redirects Today' : 'Session Redirects';

        console.log(`Showing METRIC anchor: ${displayValue} ${label}`);
        overlayWindow.webContents.send('show-metric', {
            value: displayValue,
            label: label
        });
    } catch (err) {
        console.error('Error getting stats for metric:', err);
        overlayWindow.webContents.send('show-metric', {
            value: clickCount,
            label: 'Session Redirects'
        });
    }
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

    // Clear content first to prevent flash of old content on next show
    overlayWindow.webContents.send('clear-overlay');

    overlayWindow.hide();
    isOverlayVisible = false;
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

            // Check if we're about to HIDE the overlay (user returning to focus)
            const wasVisible = isOverlayVisible;

            // Toggle overlay visibility
            toggleOverlay();

            // Log to database only when HIDING (completing the focus cycle)
            // This counts as 1 full redirect (user got distracted, saw anchor, returned)
            if (isSessionActive && wasVisible) {
                (async () => {
                    const newCount = await database.logClick(new Date().toISOString());
                    console.log(`Logged 1 redirect. New count: ${newCount}`);
                    if (controlWindow && !controlWindow.isDestroyed()) {
                        controlWindow.webContents.send('stats-updated', { today: newCount });
                    }
                })();
            }

            // Simple debounce to reset the pressed state
            setTimeout(() => {
                isShortcutPressed = false;
            }, 500);
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
        // Spawn the Python process
        // Note: Using shell: false allows better process control, but we need to ensure 'python' is in PATH.
        // If not found, we might fallback to shell: true or try full path.
        const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
        pythonProcess = spawn(pythonCommand, ['-u', scriptPath], {
            cwd: workspaceRoot,
            shell: false // Changed to false to get direct PID for the python process
        });

        sendStatusLog('Python Bluetooth listener started', 'info');

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

                // Log click to database if session is active
                if (isSessionActive) {
                    (async () => {
                        const newCount = await database.logClick(new Date().toISOString());
                        if (controlWindow && !controlWindow.isDestroyed()) {
                            controlWindow.webContents.send('stats-updated', { today: newCount });
                        }
                    })();
                }
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

            // Force kill after timeout
            const killTimeout = setTimeout(() => {
                if (processToKill && !processToKill.killed) {
                    console.log('Force killing Python process...');
                    try {
                        processToKill.kill('SIGKILL');

                        // Extra measure for Windows: Taskkill by PID
                        if (process.platform === 'win32') {
                            require('child_process').exec(`taskkill /pid ${processToKill.pid} /T /F`);
                        }
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

app.whenReady().then(async () => {
    loadImagePaths();
    createOverlayWindow();

    // Check for existing session
    console.log('Checking for existing session...');
    const { isAuthenticated } = await getSession();

    if (isAuthenticated) {
        console.log('User is authenticated, showing control window');
        createControlWindow();
    } else {
        console.log('No session found, showing login window');
        createLoginWindow();
    }

    // Authentication IPC Handlers
    ipcMain.handle('auth-sign-in', async (_event, email: string, password: string) => {
        const result = await signIn(email, password);
        if (result.user && !result.error) {
            // Close login window and open control window
            if (loginWindow) {
                loginWindow.close();
            }
            createControlWindow();
        }
        return result;
    });

    ipcMain.handle('auth-sign-up', async (_event, email: string, password: string) => {
        const result = await signUp(email, password);
        if (result.user && !result.error) {
            // Close login window and open control window
            if (loginWindow) {
                loginWindow.close();
            }
            createControlWindow();
        }
        return result;
    });

    ipcMain.handle('auth-sign-out', async () => {
        const result = await signOut();
        if (!result.error) {
            // Close control window and show login
            if (controlWindow) {
                controlWindow.close();
            }
            createLoginWindow();
        }
        return result;
    });

    ipcMain.handle('auth-check-session', async () => {
        return await getSession();
    });

    // Existing IPC Handlers
    ipcMain.on('start-ring-connection', () => {
        isSessionActive = false;
        startPythonScript();
    });

    ipcMain.on('stop-ring-connection', () => {
        isSessionActive = false;
        stopPythonScript();
    });

    ipcMain.on('activate-session', () => {
        isSessionActive = true;
        console.log('Session activated - click tracking enabled');
    });

    ipcMain.handle('get-dashboard-stats', async () => {
        return await database.getDailyStats();
    });

    // Open Session Setup Window
    ipcMain.on('open-session-setup', () => {
        if (controlWindow) {
            navigationHistory.push('startup.html');
            controlWindow.loadFile(path.join(__dirname, '..', 'src', 'session-setup.html'));
        }
    });

    // Navigation: Go back to previous page
    ipcMain.on('go-back', () => {
        if (controlWindow && navigationHistory.length > 0) {
            const previousPage = navigationHistory.pop();
            console.log(`Navigating back to: ${previousPage}`);
            controlWindow.loadFile(path.join(__dirname, '..', 'src', previousPage!));
        } else if (controlWindow) {
            // Default: go to startup
            controlWindow.loadFile(path.join(__dirname, '..', 'src', 'startup.html'));
        }
    });

    // Gemini Content Generation IPC Handlers
    ipcMain.handle('generate-session-content', async (_event, task: string, reward: string) => {
        return await generateSessionContent(task, reward);
    });

    ipcMain.handle('get-fallback-content', async () => {
        return getFallbackContent();
    });

    // Generate a single image from a prompt
    ipcMain.handle('generate-image', async (_event, prompt: string) => {
        return await generateImage(prompt);
    });

    // Session content storage
    let currentSessionContent: GeneratedContent | null = null;


    ipcMain.handle('save-session-content', async (_event, content: GeneratedContent & { images?: string[] }) => {
        currentSessionContent = content;
        // Populate sessionQuotes for multi-modal overlay
        if (content.quotes && content.quotes.length > 0) {
            sessionQuotes = content.quotes;
            console.log('Session quotes loaded:', sessionQuotes.length, 'quotes');
        }
        // Store generated images if provided (use module-level sessionImages)
        if (content.images && content.images.length > 0) {
            sessionImages = content.images;
            console.log('AI-generated images loaded:', sessionImages.length, 'images');
        }
        console.log('Session content saved:', content);
        return { success: true };
    });

    ipcMain.on('session-content-ready', () => {
        // Navigate control window back to connection/dashboard
        if (controlWindow) {
            controlWindow.loadFile(path.join(__dirname, '..', 'src', 'startup.html'));
        }
    });

    // Get current session content for overlay
    ipcMain.handle('get-session-content', async () => {
        return currentSessionContent;
    });

    ipcMain.on('quit-app', () => {
        console.log('Quit app requested from UI');
        app.quit();
    });

    registerMainShortcut();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            loadImagePaths();
            createOverlayWindow();
        }
    });
});

app.on('will-quit', async () => {
    console.log('App is quitting - syncing logs and cleaning up...');

    // Sync any pending logs to Supabase before quitting
    try {
        const result = await database.syncPendingLogs();
        console.log(`Synced ${result.synced} logs, ${result.errors} errors`);
    } catch (err) {
        console.error('Error syncing logs on quit:', err);
    }

    // Force kill Python process synchronously to ensure cleanup before exit
    if (pythonProcess && pythonProcess.pid) {
        try {
            console.log(`Killing Python process (PID: ${pythonProcess.pid})...`);
            if (process.platform === 'win32') {
                // Use execSync for synchronous kill on Windows
                require('child_process').execSync(`taskkill /pid ${pythonProcess.pid} /T /F`, { stdio: 'ignore' });
            } else {
                pythonProcess.kill('SIGKILL');
            }
            console.log('Python process killed successfully');
        } catch (err) {
            console.error('Error killing Python process:', err);
        }
        pythonProcess = null;
    }

    // Unregister all shortcuts
    globalShortcut.unregisterAll();

    // Clear any timers
    if (keyCheckInterval) {
        clearInterval(keyCheckInterval);
        keyCheckInterval = null;
    }

    if (pythonRetryInterval) {
        clearTimeout(pythonRetryInterval);
        pythonRetryInterval = null;
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});