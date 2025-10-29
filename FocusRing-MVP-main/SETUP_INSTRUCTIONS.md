# Setup Instructions

## Prerequisites Installation

### 1. Node.js Installation ✅ (You've done this!)
- Download from: https://nodejs.org/
- Choose the LTS (Long Term Support) version
- During installation, make sure "Add to PATH" is checked
- **Important: Restart your terminal (or computer) after installation**

### 2. Python Installation
- Download from: https://www.python.org/downloads/
- During installation, **CHECK "Add Python to PATH"** (very important!)
- Verify installation:
  ```powershell
  python --version
  ```

### 3. Python Dependencies
Install the Bluetooth library needed by `main.py`:
```powershell
pip install bleak
```

## Project Setup

### Step 1: Verify Node.js is Working
After restarting your terminal, verify Node.js is installed:
```powershell
node --version
npm --version
```

You should see version numbers like:
```
v20.x.x
10.x.x
```

### Step 2: Navigate to Project Directory
```powershell
cd C:\Users\adama\OneDrive\Documents\Developer\Capstone\FocusRing-MVP-main
```

### Step 3: Install Project Dependencies
This will install Electron and all other required packages:
```powershell
npm install
```

According to the [Electron documentation](https://www.electronjs.org/docs/latest/tutorial/installation), npm will automatically download the Electron binary during installation.

### Step 4: Build the TypeScript Code
Compile TypeScript to JavaScript:
```powershell
npm run build
```

This runs the TypeScript compiler (`tsc`) which creates JavaScript files in the `dist/` folder.

### Step 5: Run the Application
Start the Electron app:
```powershell
npm start
```

This will:
- Launch the Electron app
- Automatically start the Python Bluetooth listener
- Open DevTools for debugging (in development mode)

## What to Expect When Running

### Console Output (in DevTools)

When the app starts successfully, you should see:

```
Alt+F registered successfully.
Starting Python script: C:\Users\...\main.py
Working directory: C:\Users\...\Capstone
Python Bluetooth listener started successfully
[Python]: Scanning for 'Zikr Ring Lite'...
```

### If Ring is Connected

When the Zikr Ring Lite is found and connected:
```
[Python]: Found device: XX:XX:XX:XX:XX:XX. Connecting...
[Python]: Successfully connected to XX:XX:XX:XX:XX:XX
✅ Bluetooth ring connected successfully!
[Python]: Enabling notifications for characteristic...
[Python]: Successfully subscribed to notifications.
[Python]: Setup complete. Waiting for button clicks. Press Ctrl+C to stop.
```

### Testing the Overlay

1. **Keyboard Shortcut:**
   - Press **Alt+F** → Image overlay appears
   - Press **Alt+F** again → Image overlay disappears
   - Console shows: `Alt+F pressed`

2. **Bluetooth Ring:**
   - Click ring button → Image overlay appears
   - Click ring button again → Image overlay disappears
   - Console shows: `🔵 Bluetooth ring button detected - toggling overlay`

## Troubleshooting

### "node is not recognized"
- You need to restart your terminal or computer after installing Node.js
- Close all terminal windows and open a new one
- Or restart your computer

### "python is not recognized"
- Python wasn't added to PATH during installation
- Reinstall Python and check "Add Python to PATH"
- Or manually add Python to PATH in Windows Environment Variables

### "npm install" fails with network errors
- You might be behind a proxy or firewall
- Try again with verbose logging: `npm install --verbose`
- See [Electron installation troubleshooting](https://www.electronjs.org/docs/latest/tutorial/installation#troubleshooting)

### "Cannot find module 'electron'"
- The npm install didn't complete successfully
- Delete `node_modules` folder and `package-lock.json`
- Run `npm install` again

### Python script doesn't start
- Check if `main.py` exists in the parent directory of FocusRing-MVP-main
- Verify Python is installed: `python --version`
- Check DevTools console for error messages

### Ring doesn't connect
- Ensure Bluetooth is enabled on your computer
- Make sure ring is charged and powered on
- Verify ring is not connected to another device
- Check if ring is in range (within a few feet)

### Overlay doesn't appear
- Check if images exist in `FocusRing-MVP-main/images/` folder
- Look for errors in DevTools console
- Try pressing Alt+F multiple times

## Quick Command Reference

```powershell
# Navigate to project
cd C:\Users\adama\OneDrive\Documents\Developer\Capstone\FocusRing-MVP-main

# Install dependencies (only needed once)
npm install

# Build TypeScript (after code changes)
npm run build

# Run the app
npm start

# Install Python dependencies (only needed once)
pip install bleak
```

## Project Structure
```
Capstone/
├── main.py                      # Python Bluetooth listener
├── ziker.py                     # Bluetooth scanner utility
└── FocusRing-MVP-main/
    ├── package.json             # npm dependencies
    ├── tsconfig.json            # TypeScript config
    ├── src/
    │   ├── main.ts              # Main Electron process (modified)
    │   ├── renderer.ts          # Renderer process
    │   ├── preload.ts           # Preload script
    │   └── index.html           # UI
    ├── images/                  # Overlay images
    └── dist/                    # Compiled JavaScript (auto-generated)
```

## Development Workflow

1. Make code changes in `src/*.ts` files
2. Run `npm run build` to compile TypeScript
3. Run `npm start` to test
4. Check DevTools console for errors

Alternatively, use watch mode to auto-compile on changes:
```powershell
# In one terminal:
npm run watch

# In another terminal:
npm start
```

## Additional Resources

- [Electron Documentation](https://www.electronjs.org/docs/latest/)
- [Electron Installation Guide](https://www.electronjs.org/docs/latest/tutorial/installation)
- [Node.js Downloads](https://nodejs.org/)
- [Python Downloads](https://www.python.org/downloads/)
- [Bleak (Python Bluetooth Library)](https://github.com/hbldh/bleak)

## Next Steps After Setup

Once everything is running:

1. Test the keyboard shortcut (Alt+F)
2. Test the Bluetooth ring button (if you have the ring)
3. Check that both triggers work independently
4. Verify the toggle behavior (show/hide)
5. Read `INTEGRATION_SUMMARY.md` for technical details
6. Read `DEBUGGING_GUIDE.md` if you encounter issues

## Need Help?

If you encounter issues:
1. Check `DEBUGGING_GUIDE.md` for common problems
2. Look at DevTools console for error messages
3. Verify all prerequisites are installed
4. Make sure terminal was restarted after Node.js installation

