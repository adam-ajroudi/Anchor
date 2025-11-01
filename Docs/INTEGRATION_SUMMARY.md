# Bluetooth Ring Integration - Implementation Summary

## Overview
Successfully integrated the Python Bluetooth listener (`main.py`) with the Electron app. The app now supports both keyboard shortcuts and Bluetooth ring button presses to toggle the image overlay.

## Changes Made

### 1. Fixed Keyboard Shortcut Behavior ✅

**Problem:** Holding Alt+F triggered the overlay multiple times rapidly.

**Solution:** 
- Added `isShortcutPressed` flag to track press state
- Modified `registerMainShortcut()` to only trigger once per press cycle
- Updated `startKeyCheckTimer()` to reset the flag when keys are released
- Keys must be fully released before the shortcut can trigger again

**Code Changes in `src/main.ts`:**
```typescript
let isShortcutPressed = false;

function registerMainShortcut() {
    const registered = globalShortcut.register(SHORTCUT, () => {
        if (!isShortcutPressed) {  // Only trigger if not already pressed
            isShortcutPressed = true;
            toggleOverlay();
            startKeyCheckTimer();  // Monitors for key release
        }
    });
}
```

### 2. Implemented Toggle Behavior ✅

**Problem:** Previous version showed overlay on press and hid on release. Needed toggle functionality.

**Solution:**
- Created new `toggleOverlay()` function
- First trigger shows overlay, second trigger hides it
- Works for both keyboard shortcut and Bluetooth button
- Removed automatic image cycling (keeps same image until manually changed)

**Code Changes in `src/main.ts`:**
```typescript
function toggleOverlay() {
    if (isOverlayVisible) {
        hideOverlay();
    } else {
        showOverlay();
    }
}
```

### 3. Python Subprocess Integration ✅

**Solution:**
- Added `spawn` import from Node.js `child_process` module
- Created `pythonProcess` variable to track subprocess
- Implemented `startPythonScript()` function that:
  - Locates `main.py` in workspace root
  - Spawns Python process with stdout/stderr capture
  - Logs all Python output to Electron console
  - Detects "BUTTON PRESSED!" in output
  - Triggers `toggleOverlay()` when button press detected
  - Logs "Successfully connected" messages
- Implemented `stopPythonScript()` for cleanup
- Integrated into app lifecycle:
  - Starts in `app.whenReady()`
  - Stops in `app.on('will-quit')`

**Code Changes in `src/main.ts`:**
```typescript
import { spawn, ChildProcess } from 'child_process';

let pythonProcess: ChildProcess | null = null;

function startPythonScript() {
    const scriptPath = path.join(app.getAppPath(), '..', 'main.py');
    pythonProcess = spawn('python', [scriptPath], {
        cwd: workspaceRoot,
        shell: true
    });
    
    pythonProcess.stdout?.on('data', (data) => {
        const output = data.toString().trim();
        console.log(`[Python]: ${output}`);
        
        if (output.includes('BUTTON PRESSED!')) {
            console.log('🔵 Bluetooth ring button detected');
            toggleOverlay();
        }
        
        if (output.includes('Successfully connected')) {
            console.log('✅ Bluetooth ring connected!');
        }
    });
}
```

## How to Build and Run

### Prerequisites
- Node.js and npm installed
- Python 3.x installed
- Bluetooth enabled on your system
- Zikr Ring Lite paired and available

### Build Steps
```bash
cd FocusRing-MVP-main
npm install
npm run build
npm start
```

### Expected Behavior

1. **App Startup:**
   - Electron app launches
   - DevTools window opens (in development mode)
   - Python script starts automatically
   - Console shows: "Starting Python script: ..."
   - Console shows: "Scanning for 'Zikr Ring Lite'..."

2. **Bluetooth Connection:**
   - When ring is found and connected
   - Console shows: "✅ Bluetooth ring connected successfully!"
   - All Python output visible in DevTools console with `[Python]:` prefix

3. **Keyboard Shortcut (Alt+F):**
   - **First press:** Shows image overlay
   - **Second press:** Hides image overlay
   - **Holding keys:** No multiple triggers - must release and press again
   - Console shows: "Alt+F pressed" and "Alt+F released"

4. **Bluetooth Ring Button:**
   - **First click:** Shows image overlay
   - **Second click:** Hides image overlay
   - Console shows: "🔵 Bluetooth ring button detected - toggling overlay"

5. **Debugging:**
   - All Python output appears in Electron DevTools console
   - Python errors appear with `[Python Error]:` prefix
   - Connection status updates logged
   - Button press events logged

## Testing Checklist

- [ ] App starts without errors
- [ ] Python script launches automatically
- [ ] Python output visible in DevTools console
- [ ] "Scanning for 'Zikr Ring Lite'..." message appears
- [ ] Bluetooth connection establishes (if ring is available)
- [ ] Alt+F shows overlay on first press
- [ ] Alt+F hides overlay on second press
- [ ] Holding Alt+F doesn't trigger multiple times
- [ ] Ring button click shows overlay (first click)
- [ ] Ring button click hides overlay (second click)
- [ ] Both triggers work independently
- [ ] Python process terminates when Electron closes

## Troubleshooting

### Python script not starting
- Check console for "Python script not found" error
- Verify `main.py` exists in workspace root (parent of FocusRing-MVP-main)
- Ensure Python is in system PATH

### Bluetooth not connecting
- Check if ring is powered on and in range
- Verify ring is paired with Windows Bluetooth settings
- Check Python console output for error messages

### Overlay not appearing
- Check if images exist in `FocusRing-MVP-main/images/` folder
- Look for image loading errors in DevTools console
- Verify `index.html` has `focusImage` element

### Multiple triggers when holding Alt+F
- This has been fixed - should only trigger once per press
- If issue persists, check console logs for "Alt+F released" messages

## File Structure
```
Capstone/
├── main.py                          # Bluetooth listener (not modified)
├── ziker.py                         # Service scanner (not modified)
└── FocusRing-MVP-main/
    ├── src/
    │   ├── main.ts                  # ✏️ MODIFIED - Main integration logic
    │   ├── renderer.ts              # No changes needed
    │   ├── preload.ts               # No changes needed
    │   └── index.html               # No changes needed
    ├── images/                      # Overlay images
    ├── package.json
    └── tsconfig.json
```

## Technical Notes

### Communication Flow
```
Bluetooth Ring → Python Script → stdout → Electron Process → toggleOverlay()
Keyboard (Alt+F) → Electron globalShortcut → toggleOverlay()
```

### Process Management
- Python subprocess runs as child process of Electron
- Inherits environment variables from Electron
- stdout/stderr piped to Electron console
- Automatically terminated when Electron quits
- Error handling for process crashes/failures

### State Management
- `isOverlayVisible`: Tracks overlay visibility
- `isShortcutPressed`: Prevents multiple keyboard triggers
- `pythonProcess`: Reference to subprocess for cleanup
- `currentImageIndex`: Which image to display (not auto-incremented)

## Next Steps

1. **Test the integration:**
   - Build and run the app
   - Test keyboard shortcut behavior
   - Test Bluetooth button (if ring is available)

2. **Optional enhancements:**
   - Add UI indicator for Bluetooth connection status
   - Add ability to cycle through images
   - Add configuration for which image to show
   - Add notification when ring connects/disconnects

## Dependencies

No new npm packages required! All functionality uses built-in Node.js modules:
- `child_process` - For spawning Python subprocess
- `path` - For file path handling
- `fs` - For file system operations

Python dependencies (already in main.py):
- `asyncio` - Async event loop
- `bleak` - Bluetooth Low Energy library

