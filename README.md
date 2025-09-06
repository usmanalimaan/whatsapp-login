# WhatsApp Web Login Manager

A Chrome extension that allows you to manage WhatsApp Web login sessions, detect login status, facilitate sign-out, and display QR codes for authentication.

## Features

- **Login Status Detection**: Automatically detects if you're logged into WhatsApp Web
- **One-Click Sign Out**: Sign out from WhatsApp Web with a single click
- **QR Code Display**: Shows the QR code for easy authentication
- **Visual Status Indicator**: Clear visual feedback of your login status
- **Cross-Tab Support**: Works even when WhatsApp Web is open in another tab

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension folder
5. The extension will appear in your Chrome toolbar

## Usage

### Basic Operation

1. **Click the extension icon** in your Chrome toolbar
2. The popup will show your current WhatsApp Web status:
   - **Green dot**: Logged in
   - **Red dot**: Logged out
   - **Gray dot**: Loading or not on WhatsApp Web

### Login Status Detection

The extension automatically detects your login status by:
- Checking for the presence of chat lists and other logged-in indicators
- Monitoring DOM elements specific to WhatsApp Web
- Fallback checks using localStorage data

### Signing Out

1. When logged in, click the **"Sign Out"** button
2. The extension will attempt to:
   - Simulate clicking the menu → logout option
   - If that fails, clear relevant cookies and localStorage
   - Force refresh the page to apply changes

### QR Code Authentication

1. When logged out, the extension will display the QR code
2. Open WhatsApp on your phone
3. Go to Settings → Linked Devices → Link a Device
4. Scan the QR code displayed in the extension popup

### Not on WhatsApp Web

If you're not currently on WhatsApp Web:
- Click **"Open WhatsApp Web"** to navigate to the site
- The extension will focus an existing WhatsApp Web tab if one is open

## File Structure

```
whatsapp-web-manager/
├── manifest.json          # Extension configuration
├── contentScript.js       # Main logic for interacting with WhatsApp Web
├── background.js          # Background service worker
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
├── icons/                # Extension icons (16x16, 48x48, 128x128)
└── README.md             # This file
```

## Technical Details

### Architecture

- **Content Script**: Injected into WhatsApp Web pages to detect status and perform actions
- **Background Script**: Manages cross-tab communication and cookie operations
- **Popup**: Provides the user interface for status display and controls

### Login Detection Methods

1. **Primary Method**: DOM element detection
   - `[data-testid="chat-list"]` for logged-in state
   - `.landing-wrapper` or `#initial_startup` for logged-out state

2. **Fallback Method**: localStorage inspection
   - Checks for WhatsApp-specific storage keys
   - Validates session data presence

### Sign Out Methods

1. **UI Simulation**: Programmatically clicks menu and logout options
2. **Storage Clearing**: Removes localStorage, sessionStorage, and cookies
3. **Force Refresh**: Reloads the page to apply changes

### QR Code Extraction

- Locates the QR code canvas element
- Converts canvas to data URL for display
- Handles multiple QR code formats and fallbacks

## Permissions Explained

- **activeTab**: Required to interact with the current WhatsApp Web tab
- **cookies**: Needed for the sign-out functionality
- **storage**: Used for extension state management
- **scripting**: Required to inject content scripts

## Browser Compatibility

- Chrome 88+ (Manifest V3 support required)
- Chromium-based browsers (Edge, Brave, etc.)

## Troubleshooting

### Extension Not Working

1. **Refresh WhatsApp Web**: Press F5 or Ctrl+R on the WhatsApp Web page
2. **Reload Extension**: Go to chrome://extensions/, find the extension, and click reload
3. **Check Console**: Open Developer Tools (F12) and check for error messages

### Sign Out Issues

1. **Manual Fallback**: If automatic sign-out fails, manually click the menu and logout
2. **Clear Data**: Use Chrome's built-in tools to clear WhatsApp Web data
3. **Restart Browser**: Close and reopen Chrome completely

### QR Code Not Showing

1. **Refresh**: Click the "Refresh QR Code" button
2. **Page Reload**: Refresh the WhatsApp Web page
3. **Check Network**: Ensure you have a stable internet connection

## Privacy & Security

- **No Data Collection**: The extension does not collect or transmit any personal data
- **Local Processing**: All operations happen locally in your browser
- **No External Servers**: No communication with external services
- **Open Source**: All code is available for inspection

## Development

### Building from Source

1. Clone the repository
2. Modify the source files as needed
3. Load the unpacked extension in Chrome

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Version History

- **v1.0.0**: Initial release with basic login detection, sign-out, and QR code features

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Support

For issues, questions, or feature requests, please:
1. Check the troubleshooting section above
2. Search existing issues on GitHub
3. Create a new issue with detailed information

## Disclaimer

This extension is not affiliated with, endorsed by, or officially connected to WhatsApp or Meta. WhatsApp is a trademark of Meta Platforms, Inc.