# Anchor System Architecture

## Overview

Anchor is a multi-process system that bridges physical hardware interaction (Bluetooth smart ring) with desktop software (Electron application) to provide immediate visual feedback for attention redirection.

## System Components

### 1. Hardware Layer: Bluetooth Smart Ring

**Device**: Zikr Ring Lite (commercial tallying device)

**Role**: Physical input device for triggering attention redirection

**Technical Specs**:
- Bluetooth Low Energy (BLE) device
- Battery-powered wearable ring
- Single button interface
- Device Name: `Zikr Ring Lite`
- MAC Address: Device-specific (e.g., `34:DD:7E:26:26:5B`)

**Communication Protocol**:
```
Service UUID: 0000d002-0000-1000-8000-00805f9b34fb
Notification Format: Q07,XXXX,YYYYY,0,0
- XXXX: Sequence counter
- YYYYY: Event value (>0 = button press)
```

### 2. Bluetooth Listener: Python Script

**File**: `main.py`

**Technology**: Python 3.8+ with Bleak library

**Responsibilities**:
1. **Device Discovery**: Scans for Bluetooth devices named "Zikr Ring Lite"
2. **Connection Management**: Establishes and maintains BLE connection
3. **Notification Handling**: Subscribes to characteristic notifications
4. **Event Detection**: Parses notification data to detect button presses
5. **Output Signaling**: Prints "BUTTON PRESSED!" to stdout when triggered
6. **Graceful Shutdown**: Handles SIGTERM/SIGINT for proper disconnection

**Data Flow**:
```python
BLE Notification → notification_handler() → Parse Data → 
Detect Button Press → print("BUTTON PRESSED!") → stdout
```

**Key Functions**:
- `notification_handler()`: Called on every BLE notification
- `cleanup_connection()`: Disconnects from device properly
- `signal_handler()`: Handles termination signals
- `main()`: Async event loop managing connection lifecycle

### 3. Desktop Application: Electron

**Directory**: `FocusRing-MVP-main/`

**Technology**: Electron 30.0.6 + TypeScript 5.4

#### 3a. Main Process (`src/main.ts`)

**Role**: Application orchestrator and process manager

**Responsibilities**:
1. **Window Management**: Creates and controls overlay and status windows
2. **Python Subprocess**: Spawns and monitors `main.py` Bluetooth listener
3. **Image Management**: Loads and randomly selects motivational images
4. **Input Handling**: Registers global keyboard shortcuts (`Alt+F`)
5. **IPC Coordination**: Sends commands to renderer processes
6. **Lifecycle Management**: Handles app startup and graceful shutdown

**Key Windows**:
```typescript
overlayWindow: BrowserWindow  // Full-screen transparent overlay
statusWindow: BrowserWindow   // Bluetooth connection status
```

**Process Monitoring**:
```typescript
pythonProcess.stdout → Parse Output → 
Detect "BUTTON PRESSED!" → toggleOverlay()
```

**State Management**:
- `imagePaths`: Array of absolute paths to image files
- `isOverlayVisible`: Current overlay state
- `isBluetoothConnected`: Connection status
- `pythonProcess`: Reference to child process

#### 3b. Preload Script (`src/preload.ts`)

**Role**: Security bridge between main and renderer processes

**Technology**: Electron Context Isolation + Context Bridge

**Exposed API**:
```typescript
window.electronAPI = {
  onShowImage: (callback) => void
  onStatusLog: (callback) => void
}
```

**Security Model**:
- Prevents direct Node.js access from renderer
- Whitelists specific IPC channels
- Type-safe communication via TypeScript interfaces

#### 3c. Overlay Renderer (`src/renderer.ts`)

**Role**: Displays motivational images to user

**Technology**: TypeScript + DOM APIs

**Lifecycle**:
1. Load HTML (`index.html`)
2. Wait for `show-image` IPC event
3. Receive base64-encoded image data
4. Set image `src` attribute
5. Display centered full-screen image

**Image Display**:
```typescript
electronWindow.electronAPI.onShowImage((dataUrl) => {
  focusImage.src = dataUrl;  // data:image/png;base64,...
});
```

### 4. Image System

**Storage**: `FocusRing-MVP-main/images/`

**Loading Strategy**: Dynamic file scanning at startup

**Selection Strategy**: Random selection on each trigger

**Supported Formats**: PNG, JPG, JPEG, GIF, WEBP, BMP

**Processing Pipeline**:
```
1. Scan Directory → fs.readdirSync()
2. Filter Valid Extensions → isValidImageFile()
3. Build Absolute Paths → path.join()
4. Random Selection → Math.random()
5. Read File → fs.readFileSync()
6. Encode Base64 → imageData.toString('base64')
7. Create Data URL → data:image/png;base64,...
8. Send to Renderer → IPC
```

## Communication Flow

### End-to-End Button Press Flow

```
┌─────────────┐
│ User Presses│
│ Ring Button │
└──────┬──────┘
       │ (BLE)
       ▼
┌─────────────────────────────────┐
│ Zikr Ring Lite                  │
│ Sends BLE Notification          │
│ Data: Q07,0042,233217,0,0       │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│ main.py (Python Process)        │
│ notification_handler()          │
│ • Parses: "Q07,0042,233217,0,0" │
│ • Detects: 233217 > 0           │
│ • Prints: "BUTTON PRESSED!"     │
└──────┬──────────────────────────┘
       │ (stdout pipe)
       ▼
┌─────────────────────────────────┐
│ main.ts (Electron Main)         │
│ pythonProcess.stdout.on('data') │
│ • Reads stdout                  │
│ • Detects "BUTTON PRESSED!"     │
│ • Calls: toggleOverlay()        │
└──────┬──────────────────────────┘
       │
       ├─────────────┬─────────────┐
       ▼             ▼             ▼
┌───────────┐ ┌───────────┐ ┌───────────┐
│ Check     │ │ Select    │ │ Read      │
│ Overlay   │ │ Random    │ │ Image     │
│ State     │ │ Image     │ │ File      │
└─────┬─────┘ └─────┬─────┘ └─────┬─────┘
      │             │             │
      │             ▼             ▼
      │      Math.random()   fs.readFileSync()
      │             │             │
      │             └─────┬───────┘
      │                   ▼
      │            base64 encode
      │                   │
      └────────┬──────────┘
               ▼
    ┌─────────────────────┐
    │ overlayWindow       │
    │ .webContents        │
    │ .send('show-image') │
    └──────┬──────────────┘
           │ (IPC)
           ▼
    ┌─────────────────────┐
    │ renderer.ts         │
    │ onShowImage()       │
    │ • Receives data URL │
    │ • Sets img.src      │
    └──────┬──────────────┘
           ▼
    ┌─────────────────────┐
    │ Browser Renders     │
    │ Image Centered      │
    │ Full Screen         │
    └─────────────────────┘
```

### Keyboard Shortcut Flow

```
User Presses Alt+F
       ↓
globalShortcut.register() callback
       ↓
toggleOverlay()
       ↓
[Same as above from "Check Overlay State"]
```

## Process Lifecycle

### Startup Sequence

```
1. app.whenReady()
   ├─> loadImagePaths()          // Scan images folder
   ├─> createOverlayWindow()     // Create hidden overlay
   ├─> createStatusWindow()      // Create status monitor
   ├─> registerMainShortcut()    // Register Alt+F
   └─> startPythonScript()       // Spawn Python subprocess
         ├─> Show status window
         ├─> spawn('python', ['main.py'])
         └─> Monitor stdout for events
              └─> Wait for "Successfully connected"
                   └─> Close status window
```

### Shutdown Sequence

```
1. app.on('will-quit')
   └─> stopPythonScript()
         ├─> Send SIGTERM to Python
         ├─> Wait 2 seconds
         │    └─> Python receives signal
         │         └─> signal_handler()
         │              └─> shutdown_event.set()
         │                   └─> cleanup_connection()
         │                        ├─> stop_notify()
         │                        └─> disconnect()
         │                             └─> Exit
         └─> Timeout: Force SIGKILL if needed

2. globalShortcut.unregisterAll()
3. Close all windows
4. app.quit()
```

## State Management

### Application State

| Variable | Scope | Purpose |
|----------|-------|---------|
| `imagePaths` | Main Process | Array of image file paths |
| `isOverlayVisible` | Main Process | Current overlay visibility |
| `isBluetoothConnected` | Main Process | Bluetooth connection status |
| `pythonProcess` | Main Process | Child process reference |
| `overlayWindow` | Main Process | BrowserWindow reference |
| `statusWindow` | Main Process | Status window reference |

### Synchronization

**Problem**: Main process and renderer process are separate
**Solution**: IPC (Inter-Process Communication)

```typescript
// Main → Renderer
overlayWindow.webContents.send('show-image', dataUrl);

// Renderer listens
ipcRenderer.on('show-image', (event, dataUrl) => {
  // Update UI
});
```

## Security Considerations

### Context Isolation
- ✅ Renderer processes cannot access Node.js APIs directly
- ✅ Only whitelisted IPC channels available
- ✅ No remote code execution vulnerabilities

### Bluetooth Security
- ⚠️ Currently connects to any device named "Zikr Ring Lite"
- 🔒 Future: Add MAC address whitelist
- 🔒 Future: Implement pairing/authentication

### Content Security Policy
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               img-src 'self' data: file:;">
```

## Error Handling

### Bluetooth Connection Failures
```
main.py: Device not found
    ↓
Python exits with code 0
    ↓
main.ts detects exit
    ↓
Retry after 5 seconds
```

### Image Loading Failures
```
File not found or invalid
    ↓
Log error to console
    ↓
Continue with next trigger
```

### Process Crashes
```
Python process crash
    ↓
pythonProcess.on('exit')
    ↓
Check exit code
    ↓
Retry connection
```

## Performance Considerations

### Image Loading
- ✅ Images loaded on-demand (not preloaded)
- ✅ Base64 encoding happens in main process
- ⚠️ Large images (>10MB) may cause delay

### Process Communication
- ✅ Stdout pipe is efficient for event signaling
- ✅ No polling - event-driven architecture
- ✅ IPC uses Chromium's efficient message passing

### Memory Management
- ✅ Only one image in memory at a time
- ✅ Previous image data garbage collected
- ✅ Windows hidden (not destroyed) for faster toggle

## Future Architecture Enhancements

1. **Data Persistence Layer**
   - SQLite database for logging clicks
   - Timestamp, context, and duration tracking

2. **Analytics Service**
   - Background service analyzing click patterns
   - ML model for predictive nudges

3. **Content Generation Service**
   - LLM API integration
   - Dynamic, personalized motivational content

4. **Web Dashboard**
   - Visualization of focus patterns
   - Progress tracking and goal setting

5. **Multi-device Sync**
   - Cloud backend for data synchronization
   - Cross-platform application

