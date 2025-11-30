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
    let unitsByFolder = {}; // Track units by folder name

    scanButton.addEventListener('click', async () => {
        status.textContent = 'Auto-expanding all slides...';
        slidesList.innerHTML = '';
        foundSlides = [];
        unitsByFolder = {};
        resultsSection.classList.add('hidden');
        progressBar.classList.add('hidden');
        scanButton.disabled = true;

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: async () => {
                    const slides = [];
                    const processedUrls = new Set();
                    let courseName = 'Unknown_Course';
                    let firstUnitFolderName = 'Unknown_Course';

                    const allClickableLinks = Array.from(document.querySelectorAll('a[title="Click here to view content"]'));

                    const clickableLinks = allClickableLinks.filter(link => {
                        const cell = link.closest('td');
                        if (!cell) return false;

                        const row = cell.parentElement;
                        const cellIndex = Array.from(row.children).indexOf(cell);

                        const table = row.closest('table');
                        if (!table) return false;

                        const headerRow = table.querySelector('tr');
                        if (!headerRow) return false;

                        const headers = Array.from(headerRow.querySelectorAll('th, td'));
                        const columnHeader = headers[cellIndex];

                        if (columnHeader && columnHeader.textContent.trim().toLowerCase() === 'slides') {
                            return true;
                        }

                        return false;
                    });

                    console.log(`Found ${clickableLinks.length} clickable slide links to process`);

                    let currentUnitNumber = null;

                    console.log('=== UNIT DETECTION DEBUG ===');
                    const debugLinks = document.querySelectorAll('a');
                    let unitLinksFound = [];
                    for (const link of debugLinks) {
                        const text = link.textContent.trim();
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

                    const allLinks = document.querySelectorAll('a');
                    for (const link of allLinks) {
                        const text = link.textContent.trim();
                        const match = text.match(/^Unit\s+(\d+)/i);
                        if (match) {
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

                    if (!currentUnitNumber) {
                        const links = document.querySelectorAll('a.active, a.selected, a[aria-selected="true"], a[aria-current="page"]');
                        for (const link of links) {
                            const text = link.textContent.trim();
                            const match = text.match(/^Unit\s+(\d+)/i);
                            if (match) {
                                currentUnitNumber = match[1];
                                console.log('Found active unit tab (via A.active):', text, '-> Unit', currentUnitNumber);
                                break;
                            }
                        }
                    }

                    if (!currentUnitNumber) {
                        const listItems = document.querySelectorAll('li.active, li.selected, li.current');
                        for (const li of listItems) {
                            const link = li.querySelector('a');
                            if (link) {
                                const text = link.textContent.trim();
                                const match = text.match(/^Unit\s+(\d+)/i);
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

                    let slideCounter = 0;

                    for (let i = 0; i < clickableLinks.length; i++) {
                        try {
                            const unitNumber = currentUnitNumber;

                            clickableLinks[i].click();

                            await new Promise(resolve => setTimeout(resolve, 1500));

                            if (i === 0) {
                                const allLinks = document.querySelectorAll('a');
                                for (const link of allLinks) {
                                    const text = link.textContent.trim();
                                    if (text.includes(':') && text.length > 10 && text.length < 100 &&
                                        !text.includes('Profile') && !text.includes('My Courses')) {
                                        courseName = text.split(':')[1].trim();
                                        break;
                                    }
                                }
                                console.log('Extracted course name:', courseName);
                            }

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
                                firstUnitFolderName = folderName;
                            }

                            const slidesTab = Array.from(document.querySelectorAll('a, button, div[role="tab"]')).find(el =>
                                el.textContent.trim().toLowerCase() === 'slides'
                            );

                            if (slidesTab) {
                                console.log('Found Slides tab, clicking it...');
                                slidesTab.click();
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            }

                            const allLinks = document.querySelectorAll('a');
                            const slideLinks = Array.from(allLinks).filter(link => {
                                const onclick = link.getAttribute('onclick');
                                const href = link.href || '';

                                return (onclick && onclick.includes('loadIframe')) ||
                                    href.toLowerCase().endsWith('.pdf') ||
                                    href.toLowerCase().endsWith('.pptx') ||
                                    href.toLowerCase().endsWith('.ppt');
                            });

                            const downloadDivs = Array.from(document.querySelectorAll('div[onclick*="downloadcoursedoc"]'));

                            console.log(`Found ${slideLinks.length} slide links and ${downloadDivs.length} download divs on page ${i + 1}`);

                            slideLinks.forEach(slideLink => {
                                let url = null;
                                let name = slideLink.textContent.trim();

                                const onclickAttr = slideLink.getAttribute('onclick');
                                if (onclickAttr) {
                                    const match = onclickAttr.match(/loadIframe\s*\(\s*['"]([^'"]+)['"]/);
                                    if (match && match[1]) {
                                        url = match[1];
                                    }
                                }

                                if (!url && slideLink.href) {
                                    const href = slideLink.href;
                                    if (href.toLowerCase().endsWith('.pdf') ||
                                        href.toLowerCase().endsWith('.pptx') ||
                                        href.toLowerCase().endsWith('.ppt')) {
                                        url = href;
                                    }
                                }

                                if (url) {

                                    if (processedUrls.has(url)) return;
                                    processedUrls.add(url);

                                    if (!url.startsWith('http')) {
                                        url = new URL(url, window.location.origin).href;
                                    }

                                    if (!name || name.length < 3) {
                                        name = slideLink.textContent.trim();
                                    }

                                    let extension = '';
                                    if (url.toLowerCase().includes('.pdf')) extension = '.pdf';
                                    else if (url.toLowerCase().includes('.pptx')) extension = '.pptx';
                                    else if (url.toLowerCase().includes('.ppt')) extension = '.ppt';
                                    else if (url.includes('downloadslidecoursedoc')) extension = '.pdf'; // Default for slide docs

                                    if (extension && name.toLowerCase().endsWith(extension.toLowerCase())) {
                                        name = name.substring(0, name.length - extension.length);
                                    }

                                    if (!name || name.trim() === '') {
                                        name = 'slide_' + (slides.length + 1);
                                    }

                                    slideCounter++;
                                    name = `${slideCounter}. ${name}`;

                                    if (extension) {
                                        name += extension;
                                    }

                                    slides.push({ url, name, folderName });
                                    console.log(`Found slide: ${name} -> ${url}`);
                                }
                            });

                            for (const downloadDiv of downloadDivs) {
                                try {
                                    const onclickAttr = downloadDiv.getAttribute('onclick');
                                    const match = onclickAttr.match(/downloadcoursedoc\s*\(\s*['"]([^'"]+)['"]/);

                                    if (match && match[1]) {
                                        const docId = match[1];

                                        const url = `https://www.pesuacademy.com/Academy/s/referenceMeterials/downloadcoursedoc/${docId}`;

                                        if (processedUrls.has(url)) continue;
                                        processedUrls.add(url);

                                        let name = downloadDiv.textContent.trim();

                                        if (!name || name.length > 100) {
                                            const parent = downloadDiv.closest('.content-type-area') || downloadDiv.parentElement;
                                            const heading = parent ? parent.querySelector('h1, h2, h3, h4, h5, strong') : null;
                                            if (heading) {
                                                name = heading.textContent.trim();
                                            }
                                        }

                                        let extension = '.pptx';
                                        if (name && name.match(/\.(pdf|pptx|ppt)$/i)) {
                                            const match = name.match(/\.(pdf|pptx|ppt)$/i);
                                            extension = match[0].toLowerCase();
                                            name = name.substring(0, name.length - extension.length);
                                        }

                                        if (!name || name.trim() === '') {
                                            name = 'slide_' + (slides.length + 1);
                                        }

                                        slideCounter++;
                                        name = `${slideCounter}. ${name}`;

                                        name += extension;

                                        slides.push({ url, name, folderName });
                                        console.log(`Found downloadcoursedoc slide: ${name} -> ${url}`);
                                    }
                                } catch (error) {
                                    console.error('Error processing download div:', error);
                                }
                            }

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

                // Group slides by folder (unit)
                unitsByFolder = {};
                foundSlides.forEach(slide => {
                    if (!unitsByFolder[slide.folderName]) {
                        unitsByFolder[slide.folderName] = [];
                    }
                    unitsByFolder[slide.folderName].push(slide);
                });

                if (foundSlides.length > 0) {
                    slideCount.textContent = foundSlides.length;
                    resultsSection.classList.remove('hidden');
                    status.textContent = 'Ready to download!';

                    // Display slides grouped by unit
                    Object.keys(unitsByFolder).forEach(folderName => {
                        const unitHeader = document.createElement('div');
                        unitHeader.className = 'unit-header';
                        unitHeader.textContent = folderName;
                        slidesList.appendChild(unitHeader);

                        const pdfCount = unitsByFolder[folderName].filter(s => s.name.toLowerCase().endsWith('.pdf')).length;

                        // Add merge button for each unit with PDFs
                        if (pdfCount > 1) {
                            const mergeUnitBtn = document.createElement('button');
                            mergeUnitBtn.className = 'btn-merge-unit';
                            mergeUnitBtn.textContent = `🔗 Merge ${pdfCount} PDFs`;
                            mergeUnitBtn.onclick = () => mergeUnitPDFs(folderName);
                            slidesList.appendChild(mergeUnitBtn);
                        }

                        unitsByFolder[folderName].forEach(slide => {
                            const slideItem = document.createElement('div');
                            slideItem.className = 'slide-item';

                            const icon = document.createElement('span');
                            icon.className = 'slide-icon';
                            icon.textContent = slide.name.toLowerCase().endsWith('.pdf') ? '📄' : '📊';

                            const name = document.createElement('span');
                            name.className = 'slide-name';
                            name.textContent = slide.name;

                            slideItem.appendChild(icon);
                            slideItem.appendChild(name);
                            slidesList.appendChild(slideItem);
                        });
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


    // Merge PDFs for a specific unit
    async function mergeUnitPDFs(folderName) {
        const unitPDFs = unitsByFolder[folderName].filter(slide => slide.name.toLowerCase().endsWith('.pdf'));

        if (unitPDFs.length < 2) {
            status.textContent = 'Need at least 2 PDFs to merge';
            return;
        }

        status.textContent = `Merging ${unitPDFs.length} PDFs from ${folderName}...`;
        progressBar.classList.remove('hidden');

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'mergePDFs',
                slides: unitPDFs,
                outputName: `${folderName}_Merged.pdf`
            });

            if (response && response.success) {
                status.textContent = `✅ ${folderName} PDFs merged successfully!`;
                progressFill.style.width = '100%';

                setTimeout(() => {
                    progressBar.classList.add('hidden');
                    progressFill.style.width = '0%';
                }, 2000);
            } else {
                status.textContent = 'Merge failed: ' + (response.error || 'Unknown error');
            }
        } catch (error) {
            status.textContent = 'Error: ' + error.message;
            console.error('Merge error:', error);
        }
    }

    // Listen for download progress updates
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'downloadProgress') {
            const percent = (message.downloaded / message.total) * 100;
            progressFill.style.width = percent + '%';
            status.textContent = `Downloading ${message.downloaded}/${message.total}...`;
        } else if (message.type === 'mergeProgress') {
            const percent = (message.current / message.total) * 100;
            progressFill.style.width = percent + '%';
            status.textContent = `Merging PDF ${message.current}/${message.total}...`;
        }
    });
});