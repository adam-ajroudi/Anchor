# Debugging Guide - Bluetooth Ring Integration

## Quick Debug Checklist

### 1. Check Python Script Startup
Open DevTools (automatically opens in development mode) and look for:
```
Starting Python script: C:\Users\...\Capstone\main.py
Working directory: C:\Users\...\Capstone
Python Bluetooth listener started successfully
[Python]: Scanning for 'Zikr Ring Lite'...
```

**If you don't see this:**
- Python might not be in PATH
- `main.py` might not exist in the correct location
- Check for error: "Python script not found at: ..."

### 2. Check Bluetooth Connection
Look for in DevTools console:
```
[Python]: Found device: XX:XX:XX:XX:XX:XX. Connecting...
[Python]: Successfully connected to XX:XX:XX:XX:XX:XX
✅ Bluetooth ring connected successfully!
[Python]: Successfully subscribed to notifications.
[Python]: Setup complete. Waiting for button clicks.
```

**If you don't see this:**
- Ring might not be powered on
- Ring might be out of range
- Ring might be connected to another device
- Bluetooth might be disabled on your computer

### 3. Check Button Press Detection
When you press the ring button, look for:
```
[Python]: ----> BUTTON PRESSED! <----
🔵 Bluetooth ring button detected - toggling overlay
Alt+F pressed
```

**If you don't see this:**
- Ring might not be sending data
- Python script might have crashed (check stderr)
- Look for: `[Python Error]:` messages

### 4. Check Keyboard Shortcut
Press Alt+F and look for:
```
Alt+F pressed
```

Release Alt+F and look for:
```
Alt+F released
```

Press Alt+F again and verify it triggers again:
```
Alt+F pressed
```

**If shortcuts trigger multiple times while holding:**
- This was the bug we fixed
- Check that `isShortcutPressed` flag is being used
- Verify `startKeyCheckTimer()` is running

## Console Commands for Debugging

Open DevTools Console (Ctrl+Shift+I) and try these:

### Check if Python process is running
```javascript
// This won't work directly, but you can check logs for:
// "Python Bluetooth listener started successfully"
```

### Check overlay state
```javascript
// In the main process, these variables exist:
// isOverlayVisible - should be true/false
// isShortcutPressed - should be true/false
// pythonProcess - should be the child process object
```

### Manually trigger overlay (for testing)
This would require adding an IPC channel, but you can test via shortcuts.

## Common Issues and Solutions

### Issue: "npm: The term 'npm' is not recognized"
**Solution:** 
- Add Node.js to your system PATH
- Or use full path: `C:\Program Files\nodejs\npm.cmd`
- Restart terminal after installation

### Issue: "python: The term 'python' is not recognized"
**Solution:**
- Add Python to system PATH
- Or modify `main.ts` line 263 to use full path:
```typescript
pythonProcess = spawn('C:\\Python39\\python.exe', [scriptPath], {
```

### Issue: Python script exits immediately
**Check console for:**
```
Python process exited with code 1 and signal null
```
**Common causes:**
- Python dependencies not installed: `pip install bleak`
- Bluetooth adapter not available
- Ring name mismatch in main.py

### Issue: Ring connects but button doesn't trigger
**Check:**
- Look for "[Python]: Received data from..." messages
- The data format might have changed
- Verify `BUTTON_PRESS_VALUE = b'\x01\x00\x00\x00'` in main.py

### Issue: Overlay shows but won't hide
**Check:**
- Look for second "Alt+F pressed" or "BUTTON PRESSED!" message
- Verify `isOverlayVisible` is being set correctly
- Check if `hideOverlay()` is being called

### Issue: Keyboard shortcut triggers multiple times
**This was fixed! But if it happens:**
- Verify `isShortcutPressed` flag is being checked
- Verify `startKeyCheckTimer()` is being called
- Check for "Alt+F released" messages

## Verbose Python Logging

To get more debug info from Python, modify `main.py`:

Add after imports:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

This will show Bluetooth packet details in Electron console.

## Monitoring Python Output in Real-Time

The Python output is automatically piped to Electron's console. To see it:

1. Start the app with: `npm start`
2. DevTools should open automatically (development mode)
3. Look for `[Python]:` prefixed messages
4. Errors appear as `[Python Error]:` 

## Testing Bluetooth Without the Ring

If you want to test the integration without the physical ring:

1. Modify `main.py` to simulate button presses:
```python
async def test_mode():
    while True:
        await asyncio.sleep(5)  # Wait 5 seconds
        print("----> BUTTON PRESSED! <----")  # Electron will detect this

# Replace asyncio.run(main()) with:
asyncio.run(test_mode())
```

2. This will trigger the overlay every 5 seconds

## Performance Monitoring

### Check subprocess memory usage
Windows Task Manager → Details → Look for `python.exe`
- Should use ~20-50MB for Bluetooth listening
- If much higher, there might be a memory leak

### Check Electron memory usage
Windows Task Manager → Details → Look for `electron.exe`
- Multiple processes are normal (main, renderer, GPU)
- Total should be under 200MB for this simple app

## Log File Locations

Electron logs are only in DevTools console (not written to file by default).

To add file logging, modify `main.ts`:
```typescript
const logFile = path.join(app.getPath('userData'), 'app.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Then pipe Python output:
pythonProcess.stdout?.on('data', (data) => {
    const output = data.toString().trim();
    console.log(`[Python]: ${output}`);
    logStream.write(`[Python]: ${output}\n`);
});
```

## Emergency Stop

If Python process doesn't stop when closing Electron:

**Windows Task Manager:**
1. Ctrl+Shift+Esc
2. Details tab
3. Find `python.exe` processes
4. End Task

**PowerShell:**
```powershell
Get-Process python | Stop-Process
```

## Useful DevTools Shortcuts

- `Ctrl+Shift+I` - Open DevTools
- `Ctrl+Shift+C` - Inspect element
- `Ctrl+R` - Reload renderer process
- `Ctrl+Shift+R` - Hard reload (clears cache)
- `F12` - Toggle DevTools

## Testing the Complete Flow

### Manual Test Script
1. ✅ Start app: `npm start`
2. ✅ Verify DevTools opens
3. ✅ Check for "Python Bluetooth listener started"
4. ✅ Check for "Scanning for 'Zikr Ring Lite'..."
5. ✅ Wait for "✅ Bluetooth ring connected successfully!"
6. ✅ Press Alt+F → Overlay appears
7. ✅ Check console: "Alt+F pressed"
8. ✅ Press Alt+F again → Overlay disappears
9. ✅ Check console: "Alt+F released" then "Alt+F pressed"
10. ✅ Press ring button → Overlay appears
11. ✅ Check console: "🔵 Bluetooth ring button detected"
12. ✅ Press ring button again → Overlay disappears
13. ✅ Close app
14. ✅ Check console: "Stopping Python Bluetooth listener..."
15. ✅ Check console: "Python process terminated"

### Automated Test (Future Enhancement)
Consider adding unit tests with Jest/Vitest for:
- `toggleOverlay()` function
- Python subprocess spawning
- Shortcut registration logic
- Key press/release detection

## Contact/Support

If you encounter issues not covered here:
1. Check the full `INTEGRATION_SUMMARY.md`
2. Review the inline comments in `src/main.ts`
3. Check Python's `main.py` for Bluetooth-specific issues
4. Verify all dependencies are installed (`npm install`, `pip install bleak`)

