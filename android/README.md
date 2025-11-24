# rep+ Android

rep+ for Android - A powerful HTTP request interceptor and security testing tool for Android devices.

## Overview

rep+ Android brings the functionality of the Chrome DevTools extension to Android, allowing you to:

- **Capture HTTP/HTTPS Traffic**: Intercept network requests from any app using PCAPdroid
- **Replay & Modify Requests**: Edit and resend captured requests with custom headers, body, and parameters
- **Security Testing**: Perform Burp Suite-style attacks (Sniper, Battering Ram, Pitchfork, Cluster Bomb)
- **Secret Scanner**: Find hardcoded API keys and secrets in captured JavaScript files
- **AI-Powered Analysis**: Integrated Anthropic Claude for explaining requests and suggesting attack vectors
- **No Root Required**: Uses PCAPdroid's VPN-based capture (no root access needed)

## Architecture

### Key Components

1. **WebView UI**: The existing Chrome extension UI runs in an Android WebView
2. **PCAPdroid Integration**: Captures traffic from all apps via UDP exporter mode
3. **JavaScript Bridge**: Native Android functions exposed to JavaScript
4. **HTTP Client**: Custom Kotlin HTTP client for replaying requests
5. **SQLite Storage**: Local database for request history

### How It Works

```
[Other Apps] → [PCAPdroid VPN] → [UDP Socket] → [rep+ Service]
                                                       ↓
                                                 [Parse HTTP]
                                                       ↓
                                                 [WebView UI]
                                                       ↓
                                            [Modify & Replay] → [HTTP Client]
```

## Installation

### Prerequisites

- Android 5.0 (API 21) or higher
- PCAPdroid app (required for traffic capture)

### Build from Source

See [BUILD.md](BUILD.md) for detailed build instructions.

Quick build with Bazel:
```bash
cd android
bazel build //app:rep_plus
adb install bazel-bin/app/rep_plus.apk
```

### Install PCAPdroid

1. **F-Droid** (Recommended):
   ```
   https://f-droid.org/packages/com.emanuelef.remote_capture/
   ```

2. **Google Play Store**:
   ```
   https://play.google.com/store/apps/details?id=com.emanuelef.remote_capture
   ```

## Usage

### First Run

1. **Launch rep+**
2. **Grant Permissions**: Allow storage and network access
3. **Install PCAPdroid** if not already installed

### Capturing Traffic

1. **Start Capture**: Tap the capture button in rep+
2. **Grant VPN Permission**: PCAPdroid will request VPN access
3. **Approve**: rep+ will start receiving traffic
4. **Browse**: Use other apps; their requests appear in rep+

### Replaying Requests

1. **Select Request**: Tap any captured request from the sidebar
2. **Edit**: Modify method, headers, or body
3. **Send**: Tap the send button to replay
4. **View Response**: See the response in real-time

### Bulk Attacks

1. **Select Request**
2. **Mark Parameters**: Highlight parameters and click "Add Position" (§)
3. **Choose Attack Type**: Sniper, Battering Ram, Pitchfork, or Cluster Bomb
4. **Configure Payloads**: Add wordlists or number ranges
5. **Start Attack**: View results with diff highlighting

### Secret Scanning

1. **Capture Traffic**: Ensure JavaScript files are captured
2. **Open Secrets Scanner**: Tap the secrets icon
3. **Scan**: Automatically finds API keys, tokens, and credentials
4. **Review**: Check confidence scores and filter results

### AI Features

1. **Configure API Key**: Settings → AI Settings → Enter Anthropic API key
2. **Explain Request**: Select request → AI → Explain
3. **Suggest Attacks**: AI → Suggest Attack Vectors
4. **Highlight & Explain**: Select any text → Context Menu → Explain with AI

## Features

### ✅ Implemented

- WebView-based UI with Android bridge
- PCAPdroid integration for traffic capture
- HTTP request/response replay
- SQLite database for request storage
- JavaScript bridge for native functions
- Basic packet parsing and HTTP reconstruction

### 🚧 Work in Progress

- Advanced TCP stream reassembly
- SSL/TLS certificate pinning bypass
- Bulk attack engine (Sniper, Battering Ram, etc.)
- Secret scanner entropy analysis
- Response diff view
- Export/Import functionality

### 📋 Planned

- Network traffic graph visualization
- Custom interceptor rules
- Request fuzzing templates
- WebSocket support
- HTTP/2 and HTTP/3 support
- Built-in proxy mode (alternative to PCAPdroid)

## Architecture Details

### Network Capture Flow

```kotlin
PCAPdroid (VPN)
  → UDP packets (port 5123)
  → CaptureService
  → TCP reassembly
  → HTTP parser
  → Broadcast to MainActivity
  → WebView UI
```

### JavaScript Bridge API

The Android bridge exposes these functions to JavaScript:

```javascript
// Capture control
Android.startCapture()
Android.stopCapture()

// Request operations
Android.sendRequest(requestJson)  // Returns response JSON
Android.saveRequest(requestJson)
Android.getRequests()             // Returns JSON array
Android.clearRequests()

// UI
Android.showToast(message)
```

### File Structure

```
app/src/main/
├── AndroidManifest.xml
├── kotlin/com/rep/plus/
│   ├── MainActivity.kt           # Main activity with WebView
│   ├── network/
│   │   ├── CaptureService.kt     # UDP receiver & packet parser
│   │   ├── PCAPdroidReceiver.kt  # Status broadcast receiver
│   │   └── HttpClient.kt         # HTTP replay engine
│   ├── storage/
│   │   └── RequestDatabase.kt    # SQLite database
│   └── utils/
│       └── PCAPdroidHelper.kt    # PCAPdroid intent builder
├── res/                          # Android resources
└── assets/web/
    ├── panel.html                # Main UI
    ├── android-bridge.js         # JS↔Native bridge
    ├── js/                       # Original Chrome extension JS
    ├── css/                      # Styles
    └── lib/                      # Libraries (marked, diff, etc.)
```

## Permissions

### Required Permissions

- `INTERNET`: Send HTTP requests
- `ACCESS_NETWORK_STATE`: Check connectivity

### Optional Permissions

- `WRITE_EXTERNAL_STORAGE`: Export captures (Android ≤9)
- `READ_EXTERNAL_STORAGE`: Import captures (Android ≤12)

### PCAPdroid Permissions

PCAPdroid requires:
- `VPN Service`: Intercept traffic without root
- `Accessibility` (optional): Capture app names

## Troubleshooting

### Traffic Not Captured

1. **Check PCAPdroid**: Ensure PCAPdroid is running and VPN is active
2. **Check Capture Status**: Verify rep+ shows "Capturing..."
3. **Check Port**: Ensure UDP port 5123 is not blocked
4. **Restart Both Apps**: Stop capture, close both apps, restart

### Requests Not Appearing

1. **Check App Filter**: Ensure you're not filtering specific apps in PCAPdroid
2. **Check Protocol**: Only HTTP/HTTPS is parsed (not WebSocket, gRPC, etc.)
3. **Check Logs**: Use `adb logcat | grep "CaptureService"` to debug

### Build Errors

See [BUILD.md](BUILD.md) troubleshooting section.

### VPN Permission Denied

- Android only allows one VPN at a time
- Check Settings → VPN → Ensure no other VPN is active
- Some enterprise/MDM profiles block VPN access

## Comparison with Chrome Extension

| Feature | Chrome Extension | Android App |
|---------|-----------------|-------------|
| **Platform** | Chrome DevTools | Android |
| **Capture Method** | Chrome's webRequest API | PCAPdroid VPN |
| **Root Required** | No | No |
| **All Apps** | Browser only | All apps |
| **SSL Intercept** | Built-in | PCAPdroid config |
| **UI** | Native DevTools panel | WebView |
| **Performance** | Fast | Moderate |

## Security Considerations

### Responsible Use

rep+ is designed for:
- **Security Testing**: Authorized penetration testing
- **Bug Bounty Hunting**: With explicit permission
- **Development**: Testing your own apps
- **Education**: Learning about HTTP protocols

**Do NOT use for:**
- Intercepting others' traffic without permission
- Bypassing app security measures for malicious purposes
- Stealing credentials or sensitive data
- Any illegal activity

### Data Privacy

- All data is stored **locally** on your device
- No data is sent to external servers (except your own HTTP requests)
- AI features require Anthropic API key (your responsibility)
- Clear data with "Clear All" button

### PCAPdroid Security

- PCAPdroid runs locally and doesn't send traffic to servers
- VPN service processes traffic on-device
- Review PCAPdroid's privacy policy: https://emanuele-f.github.io/PCAPdroid/

## Contributing

This is an experimental port of the Chrome extension. Contributions welcome!

### Areas for Improvement

1. **Better TCP Reassembly**: Current implementation is basic
2. **HTTP/2 Support**: Only HTTP/1.1 is parsed correctly
3. **WebSocket Support**: Not yet implemented
4. **Performance**: Optimize packet parsing
5. **UI**: Make UI more mobile-friendly

## License

Same as the original rep+ project.

## Credits

- **Original rep+**: [bscript/rep](https://github.com/bscript/rep)
- **PCAPdroid**: [emanuele-f/PCAPdroid](https://github.com/emanuele-f/PCAPdroid)
- **Android Conversion**: Created with Claude Code

## Support

For issues specific to the Android version, please open an issue with the `android` label.

For PCAPdroid-related questions, see: https://github.com/emanuele-f/PCAPdroid/issues

---

**Note**: This is an experimental port. Some features from the Chrome extension may not work perfectly on Android. Contributions and feedback are welcome!
