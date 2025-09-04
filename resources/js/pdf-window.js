// Global variables
let selectedVersions = {};
let selectedPreferences = {};
let preferencesData = {};
let vrvToolkit;
let selectedFiles = [];
//let workUri = "xmldb:exist:///db/apps/edirom/adelson_e_salvini_model/content/works/edirom_work_adelson.xml";
//let workUri = "xmldb:exist:///db/apps/edirom/init-test/content/works/edirom_work_test.xml";
let editionUri = edition; //"xmldb:exist:///db/apps/edirom/init-test/content/ediromEditions/edirom_edition_example.xml";

// Initialize Verovio when ready
document.addEventListener('DOMContentLoaded', function() {
    if (typeof verovio !== 'undefined') {
        verovio.module.onRuntimeInitialized = () => {
            vrvToolkit = new verovio.toolkit();
            console.log('Verovio toolkit initialized');
        };
    }
    
    // Initialize the application
    init();
});

// Initialize the application
async function init() {
    try {
        const movements = await fetchMovements();
        preferencesData = await fetchAlternativesPreferences(editionUri);
        initializeDefaultSelections(movements);
        const movementsHTML = generateMovementsHTML(movements);
        document.getElementById('content').innerHTML = movementsHTML;
    } catch (error) {
        console.error('Error initializing:', error);
        document.getElementById('content').innerHTML = `
            <div class="tei_body">
                <h1>Error</h1>
                <section class="teidiv0">
                    <p>Unable to load movements. Please try again later.</p>
                    <p style="color: red; font-size: 14px;">Error: ${error.message}</p>
                </section>
            </div>
        `;
    }
}

// Function to fetch movements from backend XML
async function fetchMovements() {
    try {
        const response = await fetch(appBasePath + "data/xql/getMovementsAlternatives.xql?uri=" + workUri);
        const xmlText = await response.text();
        
        // Parse XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        
        // Extract movements and their versions
        const movementNodes = xmlDoc.querySelectorAll("work > work");
        console.log(movementNodes);
        const movements = [];
        
        movementNodes.forEach(function(movementNode) {
            const movementId = movementNode.getAttribute('xml:id');
            const titleElement = movementNode.querySelector('titleStmt title');
            const title = titleElement ? titleElement.textContent : 'Untitled Movement';
            
            // Extract all versions for this movement
            const relationNodes = movementNode.querySelectorAll('relation[rel="hasVersion"]');
            const versions = [];
            
            relationNodes.forEach(function(relationNode) {
                const versionId = relationNode.getAttribute('xml:id');
                const target = relationNode.getAttribute('target');
                const descElement = relationNode.querySelector('desc');
                const description = descElement ? descElement.textContent : 'Version';
                
                versions.push({
                    id: versionId,
                    target: target,
                    description: description
                });
            });
            
            movements.push({
                id: movementId,
                title: title,
                versions: versions
            });
        });
        
        return movements;
        
    } catch (error) {
        console.error('Error fetching movements:', error);
        // Return sample data as fallback based on your XML structure
        return [
            {
                id: 'work-mv1',
                title: 'N.1',
                versions: [
                    { id: 'work-mv1-main', target: 'numero01_merge_vMain.mei', description: 'Main version' },
                    { id: 'work-mv1-alt', target: 'numero01_merge_vAlt.mei', description: 'Alternative version' }
                ]
            },
            {
                id: 'work-mv3',
                title: 'N.3',
                versions: [
                    { id: 'work-mv3-main', target: 'numero03_merge.mei', description: 'Version' }
                ]
            },
            {
                id: 'work-mv5',
                title: 'N.5',
                versions: [
                    { id: 'work-mv5-first', target: 'numero05_merge_vFirst.mei', description: 'First version' },
                    { id: 'work-mv5-second', target: 'numero05_vBis.mei', description: 'Second version' }
                ]
            }
        ];
    }
}

// Function to fetch alternatives preferences from backend XML
async function fetchAlternativesPreferences(edition) {
    try {
        const response = await fetch(appBasePath + "data/xql/getAlternativesPreferences.xql?edition="+ edition);
        const xmlText = await response.text();
        
        // Parse XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");

        const files = xmlDoc.querySelectorAll("file");
        const preferencesByFile = {};

        files.forEach(function(file) {
            // Extract preferences
            const prefs = file.querySelectorAll("preference");
            const preferences = [];
            const filename = file.getAttribute("target")

            prefs.forEach(function (pref) {
                preferences.push({
                    name:  pref.querySelector('name').innerHTML,
                    query: pref.querySelector('query').innerHTML
                })
            });

            preferencesByFile[filename] = preferences;
        });

        console.log(preferencesByFile);
        
        return preferencesByFile;
        
    } catch (error) {
        console.error('Error fetching alternatives preferences:', error);
        return {};
    }
}

// Function to generate movements selection HTML
function generateMovementsHTML(movements) {
    let movementsHTML = `
        <div class="tei_body">
            <h1>Select Number Versions</h1>
            <section class="teidiv0">
                <p>Please select a version for each number:</p>
                <div class="movements-container">
    `;

    movements.forEach(function(movement) {
        movementsHTML += `
            <div class="movement-section">
                <h2>${movement.title}</h2>
                <div class="versions-container" data-movement-id="${movement.id}">
        `;

        // Add version options for this movement
        movement.versions.forEach(function(version, index) {
            const isFirst = index === 0;
            const hasPreferences = preferencesData[version.target] && preferencesData[version.target].length > 0;
            
            movementsHTML += `
                <div class="version-item ${isFirst ? 'selected' : ''}" 
                        data-version-id="${version.id}" 
                        data-target="${version.target}"
                        onclick="selectVersion('${movement.id}', '${version.id}', this)">
                    <input type="radio" name="movement-${movement.id}" value="${version.id}" ${isFirst ? 'checked' : ''} />
                    <div>
                        <div class="version-description">
                            <strong>${version.description}</strong>
                        </div>
                        <div class="version-target">Target: ${version.target}</div>
                    </div>
                </div>
            `;
            
            // Add preferences submenu if preferences exist for this version
            if (hasPreferences) {
                movementsHTML += generatePreferencesSubmenu(movement.id, version.id, version.target, isFirst);
            }
        });

        movementsHTML += `
                </div>
            </div>
        `;
    });

    movementsHTML += `
                </div>
                <div class="center">
                    <button class="action-button" onclick="handleMovementAction()">
                        Proceed with Selected Versions
                    </button>
                    <button class="action-button print-button" id="printButton" style="display: none;" onclick="openPrintDialog()">
                        Print Scores
                    </button>
                </div>
            </section>
        </div>
    `;

    return movementsHTML;
}

// Generate preferences submenu HTML
function generatePreferencesSubmenu(movementId, versionId, target, isVisible) {
    const preferences = preferencesData[target] || [];
    if (preferences.length === 0) return '';
    
    let submenuHTML = `
        <div class="preferences-submenu" id="preferences-${movementId}-${versionId}" 
             style="display: ${isVisible ? 'block' : 'none'}; margin-left: 20px; margin-top: 10px; 
                    border-left: 3px solid #ccc; padding-left: 15px;">
            <h4>Select Preferences:</h4>
    `;
    
    preferences.forEach(function(preference, index) {
        const isLast = index === preferences.length - 1;
        submenuHTML += `
            <div class="preference-item ${isLast ? 'selected' : ''}" 
                 data-preference-name="${preference.name}"
                 data-preference-query="${preference.query}"
                 onclick="selectPreference('${movementId}', '${versionId}', '${preference.name}', "${preference.query}", this)">
                <input type="radio" name="preference-${movementId}-${versionId}" 
                       value="${preference.name}" ${isLast ? 'checked' : ''} />
                <label>${preference.name}</label>
            </div>
        `;
    });
    
    submenuHTML += `</div>`;
    return submenuHTML;
}

// Auto-select first version and preference for each movement when data loads
function initializeDefaultSelections(movements) {
    selectedVersions = {};
    selectedPreferences = {};
    
    movements.forEach(function(movement) {
        if (movement.versions.length > 0) {
            const firstVersion = movement.versions[0];
            selectedVersions[movement.id] = {
                versionId: firstVersion.id,
                target: firstVersion.target
            };
            
            // Initialize default preference for this version
            const preferences = preferencesData[firstVersion.target] || [];
            if (preferences.length > 0) {
                selectedPreferences[movement.id] = {
                    versionId: firstVersion.id,
                    preferenceName: preferences[preferences.length-1].name,
                    preferenceQuery: preferences[preferences.length-1].query
                };
            }
        }
    });
}

// Select version function
function selectVersion(movementId, versionId, element) {
    const container = element.parentElement;
    const target = element.getAttribute('data-target');
    
    // Remove selection from all versions in this movement
    const versionItems = container.querySelectorAll('.version-item');
    versionItems.forEach(function(item) {
        item.classList.remove('selected');
        const radio = item.querySelector('input[type="radio"]');
        if (radio) radio.checked = false;
    });
    
    // Hide all preferences submenus for this movement
    const preferencesMenus = container.querySelectorAll('.preferences-submenu');
    preferencesMenus.forEach(function(menu) {
        menu.style.display = 'none';
    });
    
    // Add selection to clicked version
    element.classList.add('selected');
    const radio = element.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
    
    // Show preferences submenu for selected version if it exists
    const preferencesSubmenu = document.getElementById(`preferences-${movementId}-${versionId}`);
    if (preferencesSubmenu) {
        preferencesSubmenu.style.display = 'block';
        
        // Auto-select first preference
        const firstPreferenceItem = preferencesSubmenu.querySelector('.preference-item');
        if (firstPreferenceItem) {
            const preferenceName = firstPreferenceItem.getAttribute('data-preference-name');
            const preferenceQuery = firstPreferenceItem.getAttribute('data-preference-query');
            selectedPreferences[movementId] = {
                versionId: versionId,
                preferenceName: preferenceName,
                preferenceQuery: preferenceQuery
            };
        }
    } else {
        // Clear preferences selection if no preferences available
        delete selectedPreferences[movementId];
    }
    
    // Store the version selection
    selectedVersions[movementId] = {
        versionId: versionId,
        target: target
    };
    
    console.log('Selected version for', movementId, ':', versionId);
    console.log('Current selections:', selectedVersions);
    console.log('Current preferences:', selectedPreferences);
}

// Select preference function
function selectPreference(movementId, versionId, preferenceName, preferenceQuery, element) {
    const container = element.parentElement;
    
    // Remove selection from all preferences in this submenu
    const preferenceItems = container.querySelectorAll('.preference-item');
    preferenceItems.forEach(function(item) {
        item.classList.remove('selected');
        const radio = item.querySelector('input[type="radio"]');
        if (radio) radio.checked = false;
    });
    
    // Add selection to clicked preference
    element.classList.add('selected');
    const radio = element.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
    
    // Store the preference selection
    selectedPreferences[movementId] = {
        versionId: versionId,
        preferenceName: preferenceName,
        preferenceQuery: preferenceQuery
    };
    
    console.log('Selected preference for', movementId, ':', preferenceName);
    console.log('Current preferences:', selectedPreferences);
}

// Handle movement action
function handleMovementAction() {
    console.log('Final selected versions:', selectedVersions);
    console.log('Final selected preferences:', selectedPreferences);
    
    // Validate that all movements have selections
    const allMovements = Object.keys(selectedVersions);
    if (allMovements.length === 0) {
        alert('Please select versions for the numbers.');
        return;
    }
    
    // Process the selected versions with their preferences
    processSelectedVersions(selectedVersions, selectedPreferences);
}

// Process selected versions with preferences
async function processSelectedVersions(selectedVersions, selectedPreferences) {
    selectedFiles = [];
    for (var key in selectedVersions) {
        if (selectedVersions.hasOwnProperty(key)) {
            var movement = selectedVersions[key];
            var preference = selectedPreferences[key];
            
            console.log('Processing movement:', key);
            console.log('Target:', movement.target);
            console.log('Preference:', preference);
            
            try {
                let fetchUrl = appBasePath + "data/xql/getMusicInMdiv.xql?uri=" + movement.target;
                
                const response = await fetch(fetchUrl);
                const meiText = await response.text();
                
                selectedFiles.push({
                    name: movement.target,
                    content: meiText,
                    preferenceQuery: preference ? preference.preferenceQuery : ''
                });
            } catch (error) {
                console.error('Error fetching MEI file:', error);
            }
        }
    }
    processFiles();
}

// Process files with Verovio
async function processFiles() {
    if (!vrvToolkit) {
        console.log("⚠️ Verovio is not ready yet.");
        return;
    }
    if (selectedFiles.length === 0) {
        console.log('Please select MEI files first.');
        return;
    }

    const progressBar = document.getElementById('progressBar');
    const scoresContainer = document.getElementById('scoresContainer');
    const printButton = document.getElementById('printButton');

    document.body.classList.add('loading');
    showLoadingBar(true);
    scoresContainer.innerHTML = '';
    printButton.style.display = 'none';

    try {
        console.log('Processing MEI files...');

        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            const progress = ((i + 1) / selectedFiles.length) * 100;
            progressBar.style.width = progress + '%';
            console.log(`Processing ${file.name} with preference: ${file.preferenceQuery} (${i + 1}/${selectedFiles.length})`);
            const appXPath = new Set(file.preferenceQuery.split(","));

            try {
                // Set options before loading
                vrvToolkit.setOptions({
                    pageWidth: 2100,
                    pageHeight: 2970,
                    scale: 40,
                    adjustPageHeight: false,
                    appXPathQuery: Array.from(appXPath),
                    breaks: "auto",
                    footer: "none",
                    header: "none"
                });

                vrvToolkit.loadData(file.content);
                const pageCount = vrvToolkit.getPageCount();

                const scoreSection = document.createElement('div');
                scoreSection.className = 'score-section';

                for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
                    const svg = vrvToolkit.renderToSVG(pageNum, {});
                    if (svg && svg.trim() !== "") {
                        const pageDiv = document.createElement('div');
                        pageDiv.className = 'score-page';
                        pageDiv.innerHTML = svg;
                        scoreSection.appendChild(pageDiv);
                    }
                }

                scoresContainer.appendChild(scoreSection);

            } catch (err) {
                console.error(`Error processing ${file.name}:`, err);
                console.log(`Error processing ${file.name}: ${err.message}`);
            }
        }

        console.log(`✅ Successfully processed ${selectedFiles.length} files! Ready to print.`);
        progressBar.style.width = '100%';
        printButton.style.display = 'inline-block';

    } catch (err) {
        console.error('Error processing files:', err);
        console.log(`❌ Error processing files: ${err.message}`);
    } finally {
        document.body.classList.remove('loading');
        setTimeout(() => showLoadingBar(false), 1500);
    }
}

// Print dialog
function openPrintDialog() {
    window.scrollTo(0, 0);
    setTimeout(() => window.print(), 100);
}

// Show/hide loading bar
function showLoadingBar(show) {
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    if (show) {
        progressContainer.style.display = 'block';
        progressBar.style.width = '10%';
    } else {
        progressBar.style.width = '0%';
        progressContainer.style.display = 'none';
    }
}