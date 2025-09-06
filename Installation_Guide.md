# WhatsApp Web Login Manager - Installation Guide

## Quick Start

### Step 1: Download the Extension Files

1. Create a new folder on your computer called `whatsapp-web-manager`
2. Save all the following files in this folder:
   - `manifest.json`
   - `contentScript.js`
   - `background.js`
   - `popup.html`
   - `popup.js`

### Step 2: Create Icons Folder (Optional)

Create an `icons` folder inside your extension folder and add these icon files:
- `icon-16.png` (16x16 pixels)
- `icon-48.png` (48x48 pixels) 
- `icon-128.png` (128x128 pixels)

*Note: If you don't have icons, the extension will still work but won't have custom icons.*

### Step 3: Load the Extension in Chrome

1. **Open Chrome Extensions Page**
   - Type `chrome://extensions/` in your address bar, OR
   - Click the three dots menu → More tools → Extensions

2. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Select your `whatsapp-web-manager` folder
   - Click "Select Folder"

4. **Pin the Extension (Recommended)**
   - Click the puzzle piece icon in Chrome's toolbar
   - Find "WhatsApp Web Login Manager"
   - Click the pin icon to keep it visible

## File Structure

Your folder should look like this:

```
whatsapp-web-manager/
├── manifest.json
├── contentScript.js
├── background.js
├── popup.html
├── popup.js
├── icons/ (optional)
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── README.md (optional)
```

## Testing the Installation

1. **Navigate to WhatsApp Web**
   - Go to `https://web.whatsapp.com`

2. **Click the Extension Icon**
   - Look for the WhatsApp Web Manager icon in your toolbar
   - Click it to open the popup

3. **Verify Functionality**
   - The popup should show your login status
   - If logged out, it should display a QR code
   - If logged in, it should show a sign-out button

## Troubleshooting Installation

### "Failed to load extension" Error

**Possible causes:**
- Missing required files
- Incorrect file names
- Invalid JSON in manifest.json

**Solutions:**
1. Check that all files are in the folder
2. Verify file names match exactly (case-sensitive)
3. Validate your manifest.json using a JSON validator

### Extension Appears but Doesn't Work

**Possible causes:**
- Incorrect file content
- Browser compatibility issues
- Permission problems

**Solutions:**
1. Check the Chrome console for errors (F12)
2. Reload the extension from chrome://extensions/
3. Try refreshing the WhatsApp Web page

### Icons Not Showing

**This is normal if you don't have icon files.** The extension will use default Chrome icons.

**To add custom icons:**
1. Create 16x16, 48x48, and 128x128 pixel PNG images
2. Name them `icon-16.png`, `icon-48.png`, `icon-128.png`
3. Place them in an `icons` folder
4. Reload the extension

## Updating the Extension

When you make changes to the code:

1. **Save your changes** to the appropriate files
2. **Go to chrome://extensions/**
3. **Find your extension** in the list
4. **Click the reload icon** (circular arrow)
5. **Test the changes**

## Uninstalling

To remove the extension:

1. Go to `chrome://extensions/`
2. Find "WhatsApp Web Login Manager"
3. Click "Remove"
4. Confirm the removal

## Next Steps

Once installed, check out the main README.md for:
- How to use all the features
- Troubleshooting common issues
- Technical details about how it works

## Security Notes

- This extension only works on WhatsApp Web (`web.whatsapp.com`)
- It doesn't send any data to external servers
- All processing happens locally in your browser
- You can review all the source code before installation