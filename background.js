// Background service worker for handling downloads

console.log('PESU Academy Slide Downloader background service worker loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'downloadSlides') {
        handleBatchDownload(request.slides, sender.tab?.id)
            .then(() => {
                sendResponse({ success: true });
            })
            .catch(error => {
                console.error('Download error:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // Keep message channel open for async response
    }
});

async function handleBatchDownload(slides, tabId) {
    let downloadedCount = 0;
    const total = slides.length;

    for (const slide of slides) {
        try {
            // Sanitize filename to remove invalid characters
            const sanitizedName = sanitizeFilename(slide.name);

            // Start download
            await new Promise((resolve, reject) => {
                chrome.downloads.download({
                    url: slide.url,
                    filename: `PESU_Slides/${sanitizedName}`,
                    conflictAction: 'uniquify',
                    saveAs: false
                }, (downloadId) => {
                    if (chrome.runtime.lastError) {
                        console.error(`Failed to download ${slide.name}:`, chrome.runtime.lastError.message);
                        reject(chrome.runtime.lastError);
                    } else {
                        console.log(`Download started: ${slide.name} (ID: ${downloadId})`);
                        downloadedCount++;

                        // Send progress update to popup
                        if (tabId) {
                            chrome.tabs.sendMessage(tabId, {
                                type: 'downloadProgress',
                                downloaded: downloadedCount,
                                total: total
                            }).catch(() => {
                                // Popup might be closed, ignore error
                            });
                        }

                        resolve(downloadId);
                    }
                });
            });

            // Small delay between downloads to avoid overwhelming the server
            await sleep(300);

        } catch (error) {
            console.error(`Error downloading ${slide.name}:`, error);
            // Continue with next download even if one fails
        }
    }

    console.log(`Batch download complete: ${downloadedCount}/${total} files`);
}

function sanitizeFilename(filename) {
    // Remove or replace invalid filename characters
    return filename
        .replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid chars with underscore
        .replace(/\s+/g, '_')            // Replace spaces with underscore
        .replace(/_+/g, '_')             // Replace multiple underscores with single
        .replace(/^_|_$/g, '')           // Remove leading/trailing underscores
        .substring(0, 200);              // Limit length
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Track download completion
chrome.downloads.onChanged.addListener((delta) => {
    if (delta.state && delta.state.current === 'complete') {
        console.log(`Download completed: ID ${delta.id}`);
    } else if (delta.state && delta.state.current === 'interrupted') {
        console.error(`Download interrupted: ID ${delta.id}`);
    }
});
