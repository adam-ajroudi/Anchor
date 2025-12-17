# Anchor ⚓

[![Electron](https://img.shields.io/badge/Electron-30.0.6-47848F?logo=electron)](https://www.electronjs.org/)
[![Python](https://img.shields.io/badge/Python-3.8+-3776AB?logo=python)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> An interactive attention redirection system that externalizes the cognitive act of refocusing through physical interaction.

https://github.com/user-attachments/assets/25ac02c5-d45a-48d2-ba29-9866bc7f87aa



## Abstract

Maintaining sustained attention is a significant challenge in the modern digital environment, particularly for individuals with neurodevelopmental conditions like ADHD. This capstone project, "Anchor," introduces an interactive system designed to combat distraction by externalizing and reinforcing the cognitive act of attentional redirection. The system pairs a physical input device (a smart ring) with a companion desktop application. Upon recognizing a moment of distraction, the user clicks the button in the smart ring, triggering immediate, personalized, AI-generated motivational content via the software interface. Each click event is logged, enabling the system to provide a data-driven dashboard that visualizes focus patterns over time. The project culminates in a complete software system that implements the core feedback, visualizations, motivation, and analytics features. To prototype the intended smart ring interaction, user input is handled by reverse-engineering the Bluetooth connection of a commercial tallying ring, which serves as a proof-of-concept controller for the core feedback loop. The hypothesis is that by translating the mental act of attentional redirection into a physical form, like a simple click, users can separate the refocus action from self-judgment and guilt, thereby building a stronger and less mentally taxing habit of attention redirection. This project also includes a theoretical exploration of how the collected dataset could be utilized by machine learning algorithms in future iterations to deliver predictive nudges and increasingly personalized reinforcement.

## 🚀 Installation & Setup

You can run Anchor in two ways: by installing the pre-built application (Recommended) or by running it manually from the source code (for developers).

### Option 1: Install the Application (Recommended)

**Best for users who just want to use the app.**

#### Windows
1. Download the latest installer (`Anchor Setup 1.0.0.exe`) from the [Releases](https://github.com/adam-ajroudi/Anchor/releases) page.
2. Run the installer and finish the setup.
3. **Important: Configure API Keys**
   - Navigate to the installation directory:
     `C:\Users\<YourUsername>\AppData\Local\Programs\Anchor\resources\`
     *(Note: This folder opens automatically if you browse to the app location)*
   - Locate the file named `.env.example`.
   - Copy and paste it in the same folder, then rename the copy to `.env`.
   - Open `.env` with Notepad.
   - Fill in your API keys (see [Getting API Keys](#getting-api-keys) below).
   - Save the file and restart Anchor.

#### macOS
1. Download `Anchor-1.0.0.dmg` from Releases.
2. Drag Anchor to your Applications folder.
3. **Important: Configure API Keys**
   - Right-click Anchor in Applications -> "Show Package Contents".
   - Navigate to `Contents/Resources/`.
   - Locate `.env.example`.
   - Copy it to `.env` in the same folder.
   - Open `.env` with TextEdit, fill in keys, and save.

---

### Option 2: Run from Source (Unpacked)

**Best for developers or if you want to modify the code.**

#### Prerequisites
- **Node.js** (v18+)
- **Python** (v3.8+)
- **Git**

#### Steps (Windows & Mac)
1. **Clone the repository**
   ```bash
   git clone https://github.com/adam-ajroudi/Anchor.git
   cd Anchor/FocusRing-MVP-main
   ```

2. **Install Dependencies**
   ```bash
   npm install
   pip install bleak asyncio
   ```

3. **Configure API Keys**
   - Locate `.env.example` in the `FocusRing-MVP-main` folder.
   - Rename it to `.env` (or copy it to `.env`).
   - Open it and fill in your keys.

4. **Run the App**
   ```bash
   npm start
   ```

---

### 🔑 Getting API Keys

To use Anchor, you need two free API keys:

1. **Gemini API Key** (for AI content)
   - Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
   - Click "Create API Key".
   - Copy the key into `GEMINI_API_KEY=` in your `.env` file.

2. **Supabase** (for data sync)
   - Go to [Supabase](https://supabase.com) and create a free project.
   - In Project Settings -> API, copy the "Project URL" to `SUPABASE_URL=`.
   - Copy the "anon" / "public" key to `SUPABASE_ANON_KEY=`.

## 🎮 Usage

### Triggering Focus Overlay

**Method 1: Bluetooth Ring**
- Press the button on your Zikr Ring Lite
- A random motivational image appears on screen

**Method 2: Keyboard Shortcut**
- Press `Alt+F` to manually trigger the overlay
- Press again to hide

### Adding Your Own Images

Simply drop any images into the `FocusRing-MVP-main/images/` folder:
- Supported formats: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp`
- Images are automatically detected on startup
- A random image is selected each time the overlay appears

## 🏗️ Architecture

```
┌─────────────────┐          ┌──────────────────┐
│  Bluetooth Ring │  Button  │  Python Script   │
│  (Zikr Ring)    │ ────────>│    (main.py)     │
└─────────────────┘  Press   └──────────────────┘
                                      │
                                      │ stdout
                                      ▼
                              ┌──────────────────┐
                              │  Electron App    │
                              │   (main.ts)      │
                              └──────────────────┘
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
                  ┌─────────────┐         ┌─────────────┐
                  │   Overlay   │         │   Status    │
                  │   Window    │         │   Window    │
                  └─────────────┘         └─────────────┘
```
```mermaid
sequenceDiagram
    participant User as User
    participant SessionUI as Session Setup UI
    participant Main as Electron Main
    participant Gemini as Gemini API
    participant Supabase as Supabase

    User->>SessionUI: Enter task & reward → Generate
    SessionUI->>Main: invoke generateSessionContent(task, reward)
    Main->>Gemini: request quotes + image prompts
    Gemini-->>Main: JSON payload (quotes + prompts) / error
    Main-->>SessionUI: parsed GeneratedContent

    note right of SessionUI: User reviews & approves items
    User->>SessionUI: Approve prompts → Request images
    SessionUI->>Main: invoke generateImage(prompt)
    Main->>Gemini: request image generation
    Gemini-->>Main: base64 image or error
    Main->>Supabase: uploadImage(base64)
    Supabase-->>Main: public URL

    User->>SessionUI: Save session
    SessionUI->>Main: saveSessionContent(quotes, images)
    Main->>Supabase: insert session & assets
    Supabase-->>Main: confirmation
    Main->>SessionUI: sessionContentReady
```

```mermaid
sequenceDiagram
    participant User as User
    participant LoginUI as Login UI
    participant Main as Electron Main
    participant SupabaseAuth as Supabase Auth
    participant Control as Control Window

    User->>LoginUI: Sign in (email,password)
    LoginUI->>Main: invoke signIn(email,password)
    Main->>SupabaseAuth: auth.signInWithPassword()
    alt success
        SupabaseAuth-->>Main: user & session
        Main->>LoginUI: auth-state-change(true)
        Main->>Control: open/show control window
    else failure
        SupabaseAuth-->>Main: error
        Main-->>LoginUI: error message
    end
```

**Key Components:**
- **`main.py`**: Bluetooth listener that detects ring button presses
- **`FocusRing-MVP-main/src/main.ts`**: Electron main process, coordinates all windows
- **`FocusRing-MVP-main/src/renderer.ts`**: Overlay window renderer
- **`FocusRing-MVP-main/src/preload.ts`**: IPC bridge (context isolation)

## 📁 Project Structure

```
Anchor/
├── main.py                          # Bluetooth ring listener
├── ziker.py                         # BLE service scanner utility
├── FocusRing-MVP-main/             # Electron application
│   ├── src/
│   │   ├── main.ts                 # Main process (orchestrator)
│   │   ├── renderer.ts             # Overlay renderer
│   │   ├── preload.ts              # IPC bridge
│   │   ├── index.html              # Overlay UI
│   │   └── status.html             # Status window UI
│   ├── images/                     # Motivational images
│   ├── dist/                       # Compiled JavaScript (gitignored)
│   ├── package.json
│   └── tsconfig.json
└── Docs/                           # Documentation
    ├── ARCHITECTURE.md
    ├── INTEGRATION_SUMMARY.md
    ├── DEBUGGING_GUIDE.md
    └── BLUETOOTH_STATUS_WINDOW.md
```

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [**Architecture Overview**](Docs/ARCHITECTURE.md) | System design, data flow, and component interaction |
| [**Setup Instructions**](FocusRing-MVP-main/SETUP_INSTRUCTIONS.md) | Detailed installation and configuration guide |
| [**Integration Summary**](Docs/INTEGRATION_SUMMARY.md) | How Bluetooth and Electron components work together |
| [**Debugging Guide**](Docs/DEBUGGING_GUIDE.md) | Troubleshooting common issues |
| [**Bluetooth Status Window**](Docs/BLUETOOTH_STATUS_WINDOW.md) | Connection monitoring features |

## 🧪 Testing the System

### Manual Testing Checklist

1. **Bluetooth Connection**
   ```bash
   # Test standalone Python script
   python main.py
   # Should detect and connect to ring
   ```

2. **Image Display**
   - Add test images to `FocusRing-MVP-main/images/`
   - Run `npm start`
   - Press ring button or `Alt+F`
   - Verify random image appears centered on screen

3. **Graceful Shutdown**
   - Run the app, wait for Bluetooth connection
   - Press `Ctrl+C` to stop
   - Check logs for "Bluetooth device disconnected successfully"
   - Restart app - should reconnect immediately

### Expected Behavior

✅ **On Startup:**
```
App path: C:\...\FocusRing-MVP-main
Scanning images directory: C:\...\images
Found 4 image(s):
  0: 1.png - Exists: true
  1: 2.jpg - Exists: true
  ...
Alt+F registered successfully.
[Python]: Scanning for 'Zikr Ring Lite'...
[Python]: Found device: XX:XX:XX:XX:XX:XX. Connecting...
[Python]: Successfully connected to XX:XX:XX:XX:XX:XX
```

✅ **On Button Press:**
```
----> BUTTON PRESSED! <----
Bluetooth ring button detected - toggling overlay
Showing random image 3/4: 3.jpg
Successfully loaded image (image/jpeg)
```

## 🔬 Technical Features

### Current Implementation
- ✅ **Dynamic Image Loading**: Automatically scans images folder
- ✅ **Random Selection**: Different image each trigger
- ✅ **Graceful Bluetooth Disconnection**: Proper cleanup on exit
- ✅ **Dual Input Methods**: Ring button + keyboard shortcut
- ✅ **Real-time Status Window**: Connection monitoring
- ✅ **Automatic Reconnection**: Retry logic for dropped connections
- ✅ **Cross-process Communication**: Python ↔ Electron via stdout

### Reverse-Engineered Bluetooth Protocol
The system uses the **Zikr Ring Lite** as a proof-of-concept input device:

## 🛠️ Development

### Build Commands

```bash
cd to FocusRing-MVP-main

# Production build
npm run build

# Start application
npm start
```


## 👤 Author

[**Adam Ajroudi**  ]([url](https://www.linkedin.com/in/adam-ajroudi/))

## 🙏 Acknowledgments

- Reverse-engineered Bluetooth protocol from Zikr Ring Lite device
- Built with Electron, TypeScript, and Python Bleak
- Inspired by research on attention management and ADHD support systems

