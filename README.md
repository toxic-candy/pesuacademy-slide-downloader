# PESU Academy Slide Downloader

A Chrome extension for batch downloading and merging course slides from PESU Academy.

## Features

- **Automatic Detection** - Scans and detects all slides in a course unit
- **Batch Download** - Download all slides with a single click
- **PDF Merge** - Combine multiple PDFs into a single document
- **Progress Tracking** - Real-time progress indicators
- **Organized Storage** - Files saved to `PESU_Slides` folder with proper naming
- **Smart Deduplication** - Prevents duplicate downloads

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked** and select the extension folder
5. The extension icon will appear in your toolbar

## Usage

1. Navigate to PESU Academy and log in
2. Open any course page with slides
3. Click the extension icon
4. Click **Scan for Slides**
5. Use **Download All** to download slides or **Merge PDFs** to combine them

## File Structure

```
├── manifest.json       # Extension configuration
├── popup.html         # User interface
├── popup.css          # Styling
├── popup.js           # UI logic
├── content.js         # Page interaction
├── background.js      # Download and merge handler
├── pdf-lib.min.js     # PDF processing library
└── icons/             # Extension icons
```

## Technical Details

The extension uses:
- Chrome Extensions Manifest V3
- pdf-lib for PDF merging
- Content scripts for page interaction
- Service workers for background processing

## Troubleshooting

**No slides detected**
- Verify you're on a course page with slides
- Ensure the page has fully loaded

**Downloads not starting**
- Check Chrome download permissions
- Verify you're logged into PESU Academy

**Extension not loading**
- Check for errors in `chrome://extensions/`
- Reload the extension

## Privacy

- Runs only on `pesuacademy.com` domain
- No data collection or external transmission
- All processing happens locally

## License

Educational use for PESU students.

## Version

1.0
