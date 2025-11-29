// Content script - runs in the context of PESU Academy pages
// This script can be used for additional functionality if needed

console.log('PESU Academy Slide Downloader content script loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'scanPage') {
        // Scan for slides and send back results
        const slides = findSlides();
        sendResponse({ slides });
    }
    return true;
});

function findSlides() {
    const slides = [];
    const links = document.querySelectorAll('a[onclick*="loadIframe"]');

    links.forEach(link => {
        // Check if this is a slide link (by title attribute)
        if (!link.title || link.title.trim() !== 'Click here to view content') {
            return; // Skip non-slide links
        }

        const onclickAttr = link.getAttribute('onclick');
        const match = onclickAttr.match(/loadIframe\s*\(\s*['"]([^'"]+)['"]/);

        if (match && match[1]) {
            let url = match[1];
            if (!url.startsWith('http')) {
                url = new URL(url, window.location.origin).href;
            }

            let name = link.textContent.trim();
            if (name === 'Click here to view content' || name === '') {
                const parent = link.closest('tr') || link.closest('div');
                if (parent) {
                    const headings = parent.querySelectorAll('h3, h4, h5, strong, b');
                    if (headings.length > 0) {
                        name = headings[0].textContent.trim();
                    }
                }
            }

            let extension = '';
            if (url.toLowerCase().includes('.pdf')) extension = '.pdf';
            else if (url.toLowerCase().includes('.pptx')) extension = '.pptx';
            else if (url.toLowerCase().includes('.ppt')) extension = '.ppt';

            if (extension && !name.toLowerCase().endsWith(extension)) {
                name += extension;
            }

            if (!name || name === extension) {
                name = 'slide_' + (slides.length + 1) + extension;
            }

            slides.push({ url, name });
        }
    });

    return slides;
}

// Helper function to auto-expand all slide sections (optional feature)
function expandAllSlideSections() {
    const slideLinks = document.querySelectorAll('a[onclick*="loadIframe"]');
    slideLinks.forEach(link => {
        if (link.textContent.includes('Click here to view content')) {
            link.click();
        }
    });
}
