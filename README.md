# PESU Academy Slide Downloader

A Chrome extension to mass download slides (PDFs and PPTX files) from PESU Academy courses.

## Features

✨ **Automatic Slide Detection** - Automatically expands and scans ALL slides in a unit  
🤖 **Auto-Expansion** - No need to manually click each "Click here to view content" link  
⬇️ **Batch Download** - Download all slides from a course with one click  
📊 **Progress Tracking** - Visual progress bar showing download status  
🎨 **Modern UI** - Clean, intuitive interface with premium design  
📁 **Organized Downloads** - All slides saved to `PESU_Slides` folder in your Downloads  
⚡ **Fast & Efficient** - Processes multiple slides quickly with smart duplicate detection  

## Installation

1. **Download the Extension**
   - Clone or download this repository to your computer
   - Or download as ZIP and extract to a folder

2. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **Developer mode** (toggle in top-right corner)
   - Click **Load unpacked**
   - Select the cloned folder
   - The extension icon should appear in your toolbar

3. **Pin the Extension** (Optional)
   - Click the puzzle piece icon in Chrome toolbar
   - Find "PESU Academy Slide Downloader"
   - Click the pin icon to keep it visible

## Usage

1. **Log into PESU Academy**
   - Go to https://www.pesuacademy.com/Academy/
   - Log in with your credentials

2. **Navigate to a Course**
   - Click on "My Courses"
   - Select any course (e.g., Software Engineering)
   - You should see a table with units/topics and a "Slides" column

3. **Scan for Slides**
   - Click the extension icon in your toolbar
   - Click the **"Scan for Slides"** button
   - The extension will detect all slides on the current page

4. **Download Slides**
   - Review the detected slides in the popup
   - Click **"Download All"** to start batch download
   - All slides will be saved to your Downloads folder in `PESU_Slides/`

## How It Works

The extension works by:
1. **Auto-expanding all slide links** - Automatically clicks each "Click here to view content" link on the page
2. **Waiting for content to load** - Gives each slide section time to load (500ms per slide)
3. **Extracting slide URLs** - Detects links with `onclick="loadIframe(...)"` patterns and extracts file URLs
4. **Smart duplicate detection** - Ensures each slide is only downloaded once
5. **Batch downloading** - Uses Chrome's Downloads API to download all files efficiently
6. **Organizing files** - Automatically saves with proper names and extensions in organized folders

**No manual clicking required!** Just navigate to a course page and click "Scan for Slides" - the extension handles the rest.

## File Structure

```
Downloader/
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup interface
├── popup.css             # Popup styling
├── popup.js              # Popup logic
├── content.js            # Content script for page interaction
├── background.js         # Background service worker for downloads
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # This file
```

## Troubleshooting

**No slides detected?**
- Make sure you're on a course page with slides (not the main profile page)
- Check that the page has loaded completely
- Look for "Click here to view content" links in the Slides column

**Downloads not starting?**
- Check Chrome's download permissions
- Ensure pop-ups are not blocked
- Check the browser console (F12) for error messages

**Extension not loading?**
- Verify all files are in the correct folder
- Check for errors in `chrome://extensions/`
- Try reloading the extension

## Privacy & Security

- This extension only runs on `pesuacademy.com` domain
- No data is collected or sent to external servers
- All downloads happen directly from PESU Academy to your computer
- The extension requires download permissions to save files

## Support

For issues or questions:
- Check the browser console for error messages (F12 → Console tab)
- Verify you're logged into PESU Academy
- Ensure you're on a page with slides

## Version

Current version: 1.0

## License

This extension is for educational purposes for PESU students.
