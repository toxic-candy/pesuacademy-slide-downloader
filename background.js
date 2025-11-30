// Background service worker for handling downloads and PDF merging

console.log('PESU Academy Slide Downloader background service worker loaded');

// Import PDF-lib from local file
importScripts('pdf-lib.min.js');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'downloadSlides') {
        const courseName = request.courseName || 'Unknown_Course';
        handleBatchDownload(request.slides, courseName, sender.tab?.id)
            .then(() => {
                sendResponse({ success: true });
            })
            .catch(error => {
                console.error('Download error:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // Keep message channel open for async response
    } else if (request.type === 'mergePDFs') {
        handlePDFMerge(request.slides, request.outputName, sender.tab?.id)
            .then(() => {
                sendResponse({ success: true });
            })
            .catch(error => {
                console.error('Merge error:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
});

async function handleBatchDownload(slides, courseName, tabId) {
    let downloadedCount = 0;
    const total = slides.length;

    for (const slide of slides) {
        try {
            const sanitizedName = sanitizeFilename(slide.name);
            const folderName = slide.folderName || courseName || 'Unknown_Course';

            await new Promise((resolve, reject) => {
                chrome.downloads.download({
                    url: slide.url,
                    filename: `PESU_Slides/${folderName}/${sanitizedName}`,
                    conflictAction: 'uniquify',
                    saveAs: false
                }, (downloadId) => {
                    if (chrome.runtime.lastError) {
                        console.error(`Failed to download ${slide.name}:`, chrome.runtime.lastError.message);
                        reject(chrome.runtime.lastError);
                    } else {
                        console.log(`Download started: ${slide.name} (ID: ${downloadId})`);
                        downloadedCount++;

                        if (tabId) {
                            chrome.tabs.sendMessage(tabId, {
                                type: 'downloadProgress',
                                downloaded: downloadedCount,
                                total: total
                            }).catch(() => { });
                        }

                        resolve(downloadId);
                    }
                });
            });

            await sleep(300);

        } catch (error) {
            console.error(`Error downloading ${slide.name}:`, error);
        }
    }

    console.log(`Batch download complete: ${downloadedCount}/${total} files`);
}

async function handlePDFMerge(slides, outputName, tabId) {
    console.log(`Starting PDF merge for ${slides.length} files`);

    try {
        // Create a new PDF document
        const mergedPdf = await PDFLib.PDFDocument.create();
        let processedCount = 0;

        // Download and merge each PDF
        for (const slide of slides) {
            try {
                console.log(`Fetching PDF: ${slide.name}`);

                // Send progress update
                if (tabId) {
                    chrome.tabs.sendMessage(tabId, {
                        type: 'mergeProgress',
                        current: processedCount + 1,
                        total: slides.length
                    }).catch(() => { });
                }

                // Fetch the PDF file
                const response = await fetch(slide.url);
                if (!response.ok) {
                    throw new Error(`Failed to fetch ${slide.name}: ${response.status}`);
                }

                const pdfBytes = await response.arrayBuffer();

                // Load the PDF
                const pdf = await PDFLib.PDFDocument.load(pdfBytes);

                // Copy all pages from this PDF to the merged PDF
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => {
                    mergedPdf.addPage(page);
                });

                console.log(`Added ${copiedPages.length} pages from ${slide.name}`);
                processedCount++;

            } catch (error) {
                console.error(`Error processing ${slide.name}:`, error);
                // Continue with other PDFs even if one fails
            }
        }

        // Save the merged PDF
        const mergedPdfBytes = await mergedPdf.save();

        // Convert to base64 data URL (URL.createObjectURL not available in service workers)
        // Process in chunks to avoid stack overflow on large files
        const uint8Array = new Uint8Array(mergedPdfBytes);
        const chunkSize = 0x8000; // 32KB chunks
        let binaryString = '';

        for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
            binaryString += String.fromCharCode.apply(null, chunk);
        }

        const base64 = btoa(binaryString);
        const dataUrl = `data:application/pdf;base64,${base64}`;

        // Download the merged PDF
        const sanitizedOutputName = sanitizeFilename(outputName);

        chrome.downloads.download({
            url: dataUrl,
            filename: `PESU_Slides/${sanitizedOutputName}`,
            conflictAction: 'uniquify',
            saveAs: false
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                console.error('Failed to download merged PDF:', chrome.runtime.lastError);
            } else {
                console.log(`Merged PDF downloaded successfully (ID: ${downloadId})`);
            }
        });

        console.log(`Successfully merged ${processedCount} PDFs`);

    } catch (error) {
        console.error('Error in PDF merge process:', error);
        throw error;
    }
}

function sanitizeFilename(filename) {
    return filename
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 200);
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