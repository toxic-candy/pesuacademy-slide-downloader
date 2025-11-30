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
    let courseName = 'Unknown_Course';

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
                    let courseName = 'Unknown_Course'; // Local to the injected script
                    let firstUnitFolderName = 'Unknown_Course'; // To capture the folder name for the first unit

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

                    // Step 2: Determine the current unit by checking for highlighted/active unit tab
                    let currentUnitNumber = null;

                    // Debug: Log all links with "Unit X" pattern (with or without colon)
                    console.log('=== UNIT DETECTION DEBUG ===');
                    const debugLinks = document.querySelectorAll('a');
                    let unitLinksFound = [];
                    for (const link of debugLinks) {
                        const text = link.textContent.trim();
                        // Match "Unit 1", "Unit 1:", "Unit 2", etc.
                        if (text.match(/^Unit\s+(\d+)/i)) {
                            const parentLi = link.closest('li');
                            unitLinksFound.push({
                                text: text.substring(0, 50),
                                hasParentLi: !!parentLi,
                                parentLiClasses: parentLi ? parentLi.className : 'none',
                                linkClasses: link.className
                            });
                        }
                    }
                    console.log('Unit links found:', unitLinksFound);

                    // Method 1: Check all links with "Unit X" pattern and find the one in an active parent
                    // Match "Unit 1", "Unit 1:", "Unit 2", etc. (with or without colon)
                    const allLinks = document.querySelectorAll('a');
                    for (const link of allLinks) {
                        const text = link.textContent.trim();
                        const match = text.match(/^Unit\s+(\d+)/i);  // Removed colon requirement
                        if (match) {
                            // Check if link or its parent LI has active class
                            const parentLi = link.closest('li');
                            if (parentLi && (parentLi.classList.contains('active') ||
                                parentLi.classList.contains('selected') ||
                                parentLi.classList.contains('current'))) {
                                currentUnitNumber = match[1];
                                console.log('Found active unit tab (via parent LI):', text, '-> Unit', currentUnitNumber);
                                break;
                            }
                        }
                    }

                    // Method 2: Check for A elements with active class directly
                    if (!currentUnitNumber) {
                        const links = document.querySelectorAll('a.active, a.selected, a[aria-selected="true"], a[aria-current="page"]');
                        for (const link of links) {
                            const text = link.textContent.trim();
                            const match = text.match(/^Unit\s+(\d+)/i);  // Removed colon requirement
                            if (match) {
                                currentUnitNumber = match[1];
                                console.log('Found active unit tab (via A.active):', text, '-> Unit', currentUnitNumber);
                                break;
                            }
                        }
                    }

                    // Method 3: Look for LI elements with active class (broader search)
                    if (!currentUnitNumber) {
                        const listItems = document.querySelectorAll('li.active, li.selected, li.current');
                        for (const li of listItems) {
                            const link = li.querySelector('a');
                            if (link) {
                                const text = link.textContent.trim();
                                const match = text.match(/^Unit\s+(\d+)/i);  // Removed colon requirement
                                if (match) {
                                    currentUnitNumber = match[1];
                                    console.log('Found active unit tab (via LI.active):', text, '-> Unit', currentUnitNumber);
                                    break;
                                }
                            }
                        }
                    }

                    console.log('Current unit number:', currentUnitNumber || 'Not detected');
                    console.log('=== END DEBUG ===');

                    // Counter for sequential numbering of slides
                    let slideCounter = 0;

                    // Step 3: For each numbered link, click it, extract slides, and navigate back
                    for (let i = 0; i < clickableLinks.length; i++) {
                        try {
                            // Use the current unit number for all slides in this scan
                            const unitNumber = currentUnitNumber;

                            // Click the numbered link (this navigates to a new page/view)
                            clickableLinks[i].click();

                            // Wait for navigation and new content to load
                            await new Promise(resolve => setTimeout(resolve, 1500));

                            // Extract course name from the unit page (only on first iteration)
                            if (i === 0) {
                                // Look for course name in links (like "UE23CS351A : Database Management System")
                                const allLinks = document.querySelectorAll('a');
                                for (const link of allLinks) {
                                    const text = link.textContent.trim();
                                    // Look for pattern like "CODE : Course Name"
                                    if (text.includes(':') && text.length > 10 && text.length < 100 &&
                                        !text.includes('Profile') && !text.includes('My Courses')) {
                                        courseName = text.split(':')[1].trim(); // Take part after colon
                                        break;
                                    }
                                }
                                console.log('Extracted course name:', courseName);
                            }

                            // Create folder name for this unit
                            let folderName = courseName
                                .replace(/[<>:"/\\|?*]/g, '_')
                                .replace(/\s+/g, '_')
                                .replace(/_+/g, '_')
                                .replace(/^_|_$/g, '')
                                .substring(0, 50);

                            if (unitNumber) {
                                folderName = `${folderName}_Unit_${unitNumber}`;
                            }

                            if (i === 0) {
                                firstUnitFolderName = folderName; // Capture for the outer scope
                            }

                            // Check if there's a "Slides" tab and click it
                            const slidesTab = Array.from(document.querySelectorAll('a, button, div[role="tab"]')).find(el =>
                                el.textContent.trim().toLowerCase() === 'slides'
                            );

                            if (slidesTab) {
                                console.log('Found Slides tab, clicking it...');
                                slidesTab.click();
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            }

                            // Now we're on the slide topics page - find all slide links
                            // Look for: loadIframe links, direct download links, AND downloadcoursedoc divs
                            const allLinks = document.querySelectorAll('a');
                            const slideLinks = Array.from(allLinks).filter(link => {
                                const onclick = link.getAttribute('onclick');
                                const href = link.href || '';

                                // Include if has loadIframe OR is a direct download link
                                return (onclick && onclick.includes('loadIframe')) ||
                                    href.toLowerCase().endsWith('.pdf') ||
                                    href.toLowerCase().endsWith('.pptx') ||
                                    href.toLowerCase().endsWith('.ppt');
                            });

                            // Also look for div elements with downloadcoursedoc (Graph Theory style)
                            const downloadDivs = Array.from(document.querySelectorAll('div[onclick*="downloadcoursedoc"]'));

                            console.log(`Found ${slideLinks.length} slide links and ${downloadDivs.length} download divs on page ${i + 1}`);

                            slideLinks.forEach(slideLink => {
                                let url = null;
                                let name = slideLink.textContent.trim();

                                // Try to get URL from onclick attribute first (loadIframe pattern)
                                const onclickAttr = slideLink.getAttribute('onclick');
                                if (onclickAttr) {
                                    const match = onclickAttr.match(/loadIframe\s*\(\s*['"]([^'"]+)['"]/);
                                    if (match && match[1]) {
                                        url = match[1];
                                    }
                                }

                                // If no onclick, try href (direct download links)
                                if (!url && slideLink.href) {
                                    const href = slideLink.href;
                                    if (href.toLowerCase().endsWith('.pdf') ||
                                        href.toLowerCase().endsWith('.pptx') ||
                                        href.toLowerCase().endsWith('.ppt')) {
                                        url = href;
                                    }
                                }

                                if (url) {

                                    // Skip if already processed
                                    if (processedUrls.has(url)) return;
                                    processedUrls.add(url);

                                    // Convert relative URLs to absolute
                                    if (!url.startsWith('http')) {
                                        url = new URL(url, window.location.origin).href;
                                    }

                                    // If name is empty, try to get it from link text again
                                    if (!name || name.length < 3) {
                                        name = slideLink.textContent.trim();
                                    }

                                    // Determine file extension from URL
                                    let extension = '';
                                    if (url.toLowerCase().includes('.pdf')) extension = '.pdf';
                                    else if (url.toLowerCase().includes('.pptx')) extension = '.pptx';
                                    else if (url.toLowerCase().includes('.ppt')) extension = '.ppt';

                                    // Remove extension from name if it's already there
                                    if (extension && name.toLowerCase().endsWith(extension.toLowerCase())) {
                                        name = name.substring(0, name.length - extension.length);
                                    }

                                    // Fallback name if still empty
                                    if (!name || name.trim() === '') {
                                        name = 'slide_' + (slides.length + 1);
                                    }

                                    // Add sequential numbering to the base name
                                    slideCounter++;
                                    name = `${slideCounter}. ${name}`;

                                    // Add extension at the end
                                    if (extension) {
                                        name += extension;
                                    }

                                    slides.push({ url, name, folderName });
                                    console.log(`Found slide: ${name} -> ${url}`);
                                }
                            });

                            // Process downloadcoursedoc divs (Graph Theory style)
                            // Extract the document IDs and store them for later download
                            for (const downloadDiv of downloadDivs) {
                                try {
                                    // Extract the document ID from onclick="downloadcoursedoc('ID')"
                                    const onclickAttr = downloadDiv.getAttribute('onclick');
                                    const match = onclickAttr.match(/downloadcoursedoc\s*\(\s*['"]([^'"]+)['"]/);

                                    if (match && match[1]) {
                                        const docId = match[1];

                                        // Construct the download URL using the actual endpoint
                                        // The downloadcoursedoc function uses: referenceMeterials/downloadcoursedoc/ID
                                        const url = `https://www.pesuacademy.com/Academy/s/referenceMeterials/downloadcoursedoc/${docId}`;

                                        // Skip if already processed
                                        if (processedUrls.has(url)) continue;
                                        processedUrls.add(url);

                                        // Get the name from the div's text content or nearby elements
                                        let name = downloadDiv.textContent.trim();

                                        // If name is too long or empty, try to find a better name
                                        if (!name || name.length > 100) {
                                            const parent = downloadDiv.closest('.content-type-area') || downloadDiv.parentElement;
                                            const heading = parent ? parent.querySelector('h1, h2, h3, h4, h5, strong') : null;
                                            if (heading) {
                                                name = heading.textContent.trim();
                                            }
                                        }

                                        // Determine extension (default to pptx for Graph Theory)
                                        let extension = '.pptx';
                                        if (name && name.match(/\.(pdf|pptx|ppt)$/i)) {
                                            const match = name.match(/\.(pdf|pptx|ppt)$/i);
                                            extension = match[0].toLowerCase();
                                            // Remove extension from name
                                            name = name.substring(0, name.length - extension.length);
                                        }

                                        // Fallback name if still empty
                                        if (!name || name.trim() === '') {
                                            name = 'slide_' + (slides.length + 1);
                                        }

                                        // Add sequential numbering to the base name
                                        slideCounter++;
                                        name = `${slideCounter}. ${name}`;

                                        // Add extension at the end
                                        name += extension;

                                        slides.push({ url, name, folderName });
                                        console.log(`Found downloadcoursedoc slide: ${name} -> ${url}`);
                                    }
                                } catch (error) {
                                    console.error('Error processing download div:', error);
                                }
                            }

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
                slides: foundSlides,
                courseName: courseName
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


