# MMM-GoogleDrivePhotos

A MagicMirror² module that displays random photos from a Google Drive folder with smooth crossfade transitions.

![MagicMirror](https://img.shields.io/badge/MagicMirror²-Module-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- 🖼️ Display photos from any Google Drive folder
- 🔀 Randomize photo order (shuffle mode)
- ✨ Smooth crossfade transitions between photos
- 📅 Optional photo metadata display (date, filename)
- 🔄 Auto-refresh to catch newly added photos
- 📱 Responsive sizing to fit your display
- 🎨 Multiple display modes (cover, contain, fill)
- 📂 Optional recursive subfolder search

## Why Google Drive instead of Google Photos?

Google deprecated the Google Photos Library API in March 2025, removing the ability for third-party apps to access your photo library. Google Drive's API still works, so this module uses Drive instead. Simply upload your photos to a Drive folder!

## Installation

### 1. Clone the Module

```bash
cd ~/MagicMirror/modules
git clone https://github.com/yourusername/MMM-GoogleDrivePhotos.git
cd MMM-GoogleDrivePhotos
npm install
```

Or copy the module folder manually to `~/MagicMirror/modules/MMM-GoogleDrivePhotos`

### 2. Set Up Google Cloud Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)

2. Create a new project (or select an existing one)

3. Enable the **Google Drive API**:
   - In the left menu, go to **APIs & Services** → **Library**
   - Search for "Google Drive API"
   - Click "Enable"

4. Configure OAuth consent screen:
   - Go to **Google Auth platform** → **Branding**
   - Fill in app name and support email
   - Go to **Google Auth platform** → **Audience**
   - Set to "External" and add your email as a **Test user**
   - Go to **Google Auth platform** → **Data Access**
   - Click "Add or Remove Scopes"
   - Add: `https://www.googleapis.com/auth/drive.readonly`
   - Click "Update"

5. Create OAuth credentials:
   - Go to **Google Auth platform** → **Clients**
   - Click **+ Create Client**
   - Choose **Desktop app**
   - Name it (e.g., "MagicMirror Photos")
   - Click "Create"

6. Download the credentials:
   - After creation, download the JSON file
   - Save it as `credentials.json` in the module folder:
     ```
     ~/MagicMirror/modules/MMM-GoogleDrivePhotos/credentials.json
     ```

### 3. Authenticate with Google Drive

Run the authentication script:

```bash
cd ~/MagicMirror/modules/MMM-GoogleDrivePhotos
npm run auth
```

This will:
1. Open a URL for you to authenticate with Google
2. Ask you to paste the authorization code (from the URL bar)
3. Save your token for future use
4. List some of your Drive folders

### 4. Get Your Folder ID

1. Open Google Drive in your browser
2. Navigate to (or create) a folder containing your photos
3. Look at the URL:
   ```
   https://drive.google.com/drive/folders/1ABC123xyz789...
   ```
4. Copy the folder ID (the part after `/folders/`)

### 5. Configure MagicMirror

Add the module to your `~/MagicMirror/config/config.js`:

```javascript
{
  module: "MMM-GoogleDrivePhotos",
  position: "fullscreen_below", // or any position you prefer
  config: {
    folderId: "YOUR_FOLDER_ID_HERE", // Required: paste your folder ID
    updateInterval: 30000,            // Change photo every 30 seconds
    transitionSpeed: 2000,            // 2 second fade transition
    mode: "contain",                  // "cover", "contain", or "fill"
    shuffle: true,                    // Randomize photo order
    showPhotoInfo: false,             // Show date/filename overlay
    recursiveSearch: false,           // Include subfolders
  }
},
```

### 6. Restart MagicMirror

```bash
pm2 restart MagicMirror
# or
cd ~/MagicMirror && npm start
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `folderId` | string | `""` | **Required.** Google Drive folder ID |
| `updateInterval` | number | `30000` | Time between photos (ms) |
| `transitionSpeed` | number | `2000` | Crossfade duration (ms) |
| `maxWidth` | string | `"100%"` | Maximum photo width |
| `maxHeight` | string | `"100%"` | Maximum photo height |
| `opacity` | number | `1.0` | Photo opacity (0.0-1.0) |
| `mode` | string | `"contain"` | Display mode: `cover`, `contain`, `fill` |
| `showPhotoInfo` | boolean | `false` | Show photo date/filename |
| `shuffle` | boolean | `true` | Randomize photo order |
| `recursiveSearch` | boolean | `false` | Include photos from subfolders |
| `refreshInterval` | number | `1800000` | Refresh folder contents (ms, default 30 min) |

### Display Modes

- **`contain`**: Fit entire photo within the frame (may have letterboxing)
- **`cover`**: Fill the frame completely (may crop edges)
- **`fill`**: Stretch to fill (may distort aspect ratio)

## Uploading Photos

Simply upload photos to your Google Drive folder:

1. Open [Google Drive](https://drive.google.com)
2. Navigate to your photos folder
3. Drag and drop photos, or click "New" → "File upload"

The module will automatically detect new photos on the next refresh (every 30 minutes by default).

## Supported Image Formats

- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)
- BMP (.bmp)
- TIFF (.tiff)

## Position Options

The module works best in these positions:

- `fullscreen_below` - Full screen behind other modules
- `fullscreen_above` - Full screen in front of other modules
- `middle_center` - Centered in the middle region
- Standard positions: `top_left`, `top_center`, `top_right`, etc.

## Interacting with Other Modules

Send notifications to control the slideshow:

```javascript
// Skip to next photo
this.sendNotification("GDRIVEPHOTOS_NEXT");
```

## Troubleshooting

### "credentials.json not found"
Download the OAuth credentials from Google Cloud Console and save as `credentials.json` in the module folder.

### "Not authenticated"
Run `npm run auth` in the module folder.

### "No photos found in folder"
- Verify the folder ID is correct
- Make sure the folder contains image files (not just other files)
- Check that the files aren't in the trash

### 403 Permission Denied
- Make sure you added the `drive.readonly` scope in Data Access
- Delete `token.json` and re-authenticate: `rm token.json && npm run auth`
- Verify your email is listed as a test user

### Photos not loading
- Check MagicMirror logs: `pm2 logs MagicMirror`
- Some photos may be too large - try smaller images
- Ensure network connectivity

### Token expires frequently
The module automatically refreshes tokens. If issues persist, delete `token.json` and re-authenticate.

## Tips

- **Organize photos**: Create a dedicated "MagicMirror" folder in Drive
- **Sync from phone**: Use the Google Drive app to auto-upload phone photos
- **Share folders**: You can use photos from shared folders too
- **Subfolders**: Enable `recursiveSearch: true` to include all subfolders

## License

MIT License - feel free to modify and share!

## Credits

Built for MagicMirror² - [https://magicmirror.builders/](https://magicmirror.builders/)
