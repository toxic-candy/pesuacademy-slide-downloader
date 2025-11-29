document.addEventListener('DOMContentLoaded', () => {
    const scanButton = document.getElementById('scanButton');
    const downloadButton = document.getElementById('downloadButton');
    const slidesList = document.getElementById('slidesList');
    const status = document.getElementById('status');
    const slideCount = document.getElementById('slideCount');
    const resultsSection = document.getElementById('resultsSection');
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');

    let foundSlides = [];

    scanButton.addEventListener('click', async () => {
        status.textContent = 'Auto-expanding all slides...';
        slidesList.innerHTML = '';
        foundSlides = [];
        resultsSection.classList.add('hidden');
        progressBar.classList.add('hidden');
        scanButton.disabled = true;

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // Inject and execute the async slide finding function with navigation
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: async () => {
                    const slides = [];
                    const processedUrls = new Set();

                    // Step 1: Find all numbered links with title="Click here to view content"
                    // Filter to only include links from the "Slides" column
                    const allClickableLinks = Array.from(document.querySelectorAll('a[title="Click here to view content"]'));

                    // Filter to only get links from the Slides column
                    const clickableLinks = allClickableLinks.filter(link => {
                        // Check if this link is in the Slides column by looking at the table structure
                        const cell = link.closest('td');
                        if (!cell) return false;

                        // Get the column index
                        const row = cell.parentElement;
                        const cellIndex = Array.from(row.children).indexOf(cell);

                        // Find the header row to check column name
                        const table = row.closest('table');
                        if (!table) return false;

                        const headerRow = table.querySelector('tr');
                        if (!headerRow) return false;

                        const headers = Array.from(headerRow.querySelectorAll('th, td'));
                        const columnHeader = headers[cellIndex];

                        // Check if this column is "Slides"
                        if (columnHeader && columnHeader.textContent.trim().toLowerCase() === 'slides') {
                            return true;
                        }

                        return false;
                    });

                    console.log(`Found ${clickableLinks.length} clickable slide links to process`);

                    // Step 2: For each numbered link, click it, extract slides, and navigate back
                    for (let i = 0; i < clickableLinks.length; i++) {
                        try {
                            // Click the numbered link (this navigates to a new page/view)
                            clickableLinks[i].click();

                            // Wait for navigation and new content to load
                            await new Promise(resolve => setTimeout(resolve, 1500));

                            // Now we're on the slide topics page - find all slide links
                            const slideLinks = document.querySelectorAll('a[onclick*="loadIframe"]');

                            console.log(`Found ${slideLinks.length} slide links on page ${i + 1}`);

                            slideLinks.forEach(slideLink => {
                                const onclickAttr = slideLink.getAttribute('onclick');
                                const match = onclickAttr.match(/loadIframe\s*\(\s*['"]([^'"]+)['"]/);

                                if (match && match[1]) {
                                    let url = match[1];

                                    // Skip if already processed
                                    if (processedUrls.has(url)) return;
                                    processedUrls.add(url);

                                    // Convert relative URLs to absolute
                                    if (!url.startsWith('http')) {
                                        url = new URL(url, window.location.origin).href;
                                    }

                                    // Get slide name from link text
                                    let name = slideLink.textContent.trim();

                                    // Determine file extension from URL
                                    let extension = '';
                                    if (url.toLowerCase().includes('.pdf')) extension = '.pdf';
                                    else if (url.toLowerCase().includes('.pptx')) extension = '.pptx';
                                    else if (url.toLowerCase().includes('.ppt')) extension = '.ppt';

                                    // Add extension if not present
                                    if (extension && !name.toLowerCase().endsWith(extension)) {
                                        name += extension;
                                    }

                                    // Fallback name
                                    if (!name || name === extension) {
                                        name = 'slide_' + (slides.length + 1) + extension;
                                    }

                                    slides.push({ url, name });
                                    console.log(`Found slide: ${name} -> ${url}`);
                                }
                            });

                            // Navigate back to the units page
                            const backButton = document.querySelector('a:has-text("Back to Units")') ||
                                document.querySelector('button:has-text("Back to Units")') ||
                                Array.from(document.querySelectorAll('a, button')).find(el =>
                                    el.textContent.includes('Back to Units') ||
                                    el.textContent.includes('Course Units')
                                );

                            if (backButton) {
                                backButton.click();
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            } else {
                                console.warn('Could not find Back to Units button');
                                window.history.back();
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            }

                        } catch (error) {
                            console.error(`Error processing slide link ${i}:`, error);
                        }
                    }

                    console.log(`Total slides found: ${slides.length}`);
                    return slides;
                }
            });

            if (results && results[0] && results[0].result) {
                foundSlides = results[0].result;

                if (foundSlides.length > 0) {
                    slideCount.textContent = foundSlides.length;
                    resultsSection.classList.remove('hidden');
                    status.textContent = 'Ready to download!';

                    foundSlides.forEach(slide => {
                        const slideItem = document.createElement('div');
                        slideItem.className = 'slide-item';

                        const icon = document.createElement('span');
                        icon.className = 'slide-icon';
                        icon.textContent = slide.name.endsWith('.pdf') ? '📄' : '📊';

                        const name = document.createElement('span');
                        name.className = 'slide-name';
                        name.textContent = slide.name;

                        slideItem.appendChild(icon);
                        slideItem.appendChild(name);
                        slidesList.appendChild(slideItem);
                    });
                } else {
                    status.textContent = 'No slides found on this page. Navigate to a course page with slides.';
                }
            }
        } catch (error) {
            status.textContent = 'Error: ' + error.message;
            console.error('Scan error:', error);
        } finally {
            scanButton.disabled = false;
        }
    });

    downloadButton.addEventListener('click', async () => {
        if (foundSlides.length === 0) return;

        downloadButton.disabled = true;
        status.textContent = 'Starting downloads...';
        progressBar.classList.remove('hidden');

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'downloadSlides',
                slides: foundSlides
            });

            if (response && response.success) {
                status.textContent = `✅ Downloaded ${foundSlides.length} slide(s)!`;
                progressFill.style.width = '100%';

                setTimeout(() => {
                    downloadButton.disabled = false;
                    progressBar.classList.add('hidden');
                    progressFill.style.width = '0%';
                }, 2000);
            } else {
                status.textContent = 'Download failed. Check console for details.';
                downloadButton.disabled = false;
            }
        } catch (error) {
            status.textContent = 'Error: ' + error.message;
            downloadButton.disabled = false;
            console.error('Download error:', error);
        }
    });

    // Listen for download progress updates
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'downloadProgress') {
            const percent = (message.downloaded / message.total) * 100;
            progressFill.style.width = percent + '%';
            status.textContent = `Downloading ${message.downloaded}/${message.total}...`;
        }
    });
});


