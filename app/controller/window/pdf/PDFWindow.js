/**
 *  Edirom Online
 *  Copyright (C) 2014 The Edirom Project
 *  http://www.edirom.de
 *
 *  Edirom Online is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  Edirom Online is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with Edirom Online.  If not, see <http://www.gnu.org/licenses/>.
 */
Ext.define('EdiromOnline.controller.window.pdf.PDFWindow', {

    extend: 'Ext.app.Controller',

    views: [
        'window.pdf.PDFWindow'
    ],

    init: function() {
        this.control({
            'PDFWindow': {
               afterlayout : this.onAfterLayout
            }
        });
    },

    onAfterLayout: function(view) {

        var me = this;

        if(view.initialized) return;
        view.initialized = true;

        // Function to fetch movements from backend XML
        async function fetchMovements() {
            try {
                const response = await fetch("@backend.url@data/xql/getMovementsAlternatives.xql?uri=" + "xmldb:exist:///db/apps/edirom/adelson_e_salvini_model/content/works/edirom_work_adelson.xml"); //TODO Generalize
                const xmlText = await response.text();
                
                // Parse XML
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "text/xml");
                
                // Extract movements and their versions
                const movementNodes = xmlDoc.querySelectorAll("work > work");
                console.log(movementNodes)
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

        // Function to generate movements selection HTML
        function generateMovementsHTML(movements) {
            let movementsHTML = `
                <div class="tei_body">
                    <h1>Select Movement Versions</h1>
                    <section class="teidiv0">
                        <p>Please select a version for each movement:</p>
                        <div class="movements-container" style="margin: 20px 0;">
            `;

            movements.forEach(function(movement) {
                movementsHTML += `
                    <div class="movement-section" style="margin: 25px 0; padding: 20px; border: 2px solid #ddd; border-radius: 8px; background: #fafafa;">
                        <h2 style="margin: 0 0 15px 0; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 8px;">${movement.title}</h2>
                        <div class="versions-container" data-movement-id="${movement.id}">
                `;

                // Add version options for this movement
                movement.versions.forEach(function(version, index) {
                    const isFirst = index === 0;
                    movementsHTML += `
                        <div class="version-item ${isFirst ? 'selected' : ''}" 
                             style="margin: 8px 0; padding: 12px; border: 2px solid ${isFirst ? '#2196F3' : '#ccc'}; border-radius: 5px; cursor: pointer; background: ${isFirst ? '#e3f2fd' : '#ffffff'}; display: flex; align-items: center;" 
                             data-version-id="${version.id}" 
                             data-target="${version.target}"
                             onclick="window.selectVersion('${movement.id}', '${version.id}', this)">
                            <input type="radio" name="movement-${movement.id}" value="${version.id}" ${isFirst ? 'checked' : ''} 
                                   style="margin-right: 10px;" />
                            <div>
                                <strong style="color: #333;">${version.description}</strong>
                                <br>
                                <span style="font-size: 0.9em; color: #666;">Target: ${version.target}</span>
                            </div>
                        </div>
                    `;
                });

                movementsHTML += `
                        </div>
                    </div>
                `;
            });

            movementsHTML += `
                        </div>
                        <div style="text-align: center; margin-top: 30px;">
                            <button id="movements-action-btn" 
                                    style="padding: 15px 30px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; font-weight: bold;"
                                    onclick="window.handleMovementAction()">
                                Proceed with Selected Versions
                            </button>
                        </div>
                    </section>
                </div>
            `;

            return movementsHTML;
        }

        // Initialize selections storage and methods
        view.selectedVersions = {};
        
        // Make functions globally available for HTML onclick handlers
        window.selectVersion = function(movementId, versionId, element) {
            const container = element.parentElement;
            
            // Remove selection from all versions in this movement
            const versionItems = container.querySelectorAll('.version-item');
            versionItems.forEach(function(item) {
                item.classList.remove('selected');
                item.style.background = '#ffffff';
                item.style.borderColor = '#ccc';
                const radio = item.querySelector('input[type="radio"]');
                if (radio) radio.checked = false;
            });
            
            // Add selection to clicked version
            element.classList.add('selected');
            element.style.background = '#e3f2fd';
            element.style.borderColor = '#2196F3';
            const radio = element.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
            
            // Store the selection
            view.selectedVersions[movementId] = {
                versionId: versionId,
                target: element.getAttribute('data-target')
            };
            
            console.log('Selected version for', movementId, ':', versionId);
            console.log('Current selections:', view.selectedVersions);
        };
        
        window.handleMovementAction = function() {
            console.log('Final selected versions:', view.selectedVersions);
            
            // Validate that all movements have selections
            const allMovements = Object.keys(view.selectedVersions);
            if (allMovements.length === 0) {
                alert('Please select versions for the movements.');
                return;
            }
            
            // Process the selected versions
            window.processSelectedVersions(view.selectedVersions);
        };

        window.processSelectedVersions = async function(selectedVersions) {
            // You now have access to view.selectedVersions which contains:
            // {
            //   'work-mv1': { versionId: 'work-mv1-main', target: 'numero01_merge_vMain.mei' },
            //   'work-mv3': { versionId: 'work-mv3-main', target: 'numero03_merge.mei' },
            //   'work-mv5': { versionId: 'work-mv5-first', target: 'numero05_merge_vFirst.mei' }
            // }
            var selectedFiles = [];
            for (var key in selectedVersions) {
                if (selectedVersions.hasOwnProperty(key)) {
                    var movement = selectedVersions[key];
                    console.log(movement.target);
                    const mei = await fetch("@backend.url@data/xql/getMusicInMdiv.xql?uri=" + movement.target);
                    selectedFiles.push(mei)
                }
            }
            processFiles();
        };

        async function processFiles() {
            if (!vrvToolkit) {
                updateStatus("⚠️ Verovio is not ready yet.");
                return;
            }
            if (selectedFiles.length === 0) {
                updateStatus('Please select MEI files first.');
                return;
            }

            const processButton = document.getElementById('processButton');
            const progressBar = document.getElementById('progressBar');
            const scoresContainer = document.getElementById('scoresContainer');
            const printButton = document.getElementById('printButton');
            const instructions = document.getElementById('instructions');

            processButton.disabled = true;
            showLoadingBar(true);
            scoresContainer.innerHTML = '';
            printButton.style.display = 'none';
            instructions.style.display = 'none';

            try {
                updateStatus('Processing MEI files...');

                for (let i = 0; i < selectedFiles.length; i++) {
                    const file = selectedFiles[i];
                    const progress = ((i + 1) / selectedFiles.length) * 100;
                    progressBar.style.width = progress + '%';
                    updateStatus(`Processing ${file.name} (${i + 1}/${selectedFiles.length})`);

                    const meiData = await readFileAsText(file);

                    try {
                        // Set options before loading
                        vrvToolkit.setOptions({
                            pageWidth: 2100,
                            pageHeight: 2970,
                            scale: 40,
                            adjustPageHeight: true,
                            breaks: "auto",
                            footer: "none",
                            header: "none"
                        });

                        vrvToolkit.loadData(meiData);
                        const pageCount = vrvToolkit.getPageCount();

                        const scoreSection = document.createElement('div');
                        scoreSection.className = 'score-section';

                        const titleDiv = document.createElement('div');
                        titleDiv.className = 'score-title';
                        titleDiv.textContent = `${file.name} (${pageCount} pages)`;
                        scoreSection.appendChild(titleDiv);

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
                        updateStatus(`Error processing ${file.name}: ${err.message}`);
                    }
                }

                updateStatus(`✅ Successfully processed ${selectedFiles.length} files! Ready to print.`);
                progressBar.style.width = '100%';
                printButton.style.display = 'block';
                instructions.style.display = 'block';

            } catch (err) {
                console.error('Error processing files:', err);
                updateStatus(`❌ Error processing files: ${err.message}`);
            } finally {
                processButton.disabled = false;
                setTimeout(() => showLoadingBar(false), 1500);
            }
        }

        function openPrintDialog() {
            window.scrollTo(0, 0);
            setTimeout(() => window.print(), 100);
        }

        function readFileAsText(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsText(file);
            });
        }

        function updateStatus(message) {
            document.getElementById('status').textContent = message;
        }

        function showLoadingBar(show) {
            const progressContainer = document.getElementById('progressContainer');
            const progressBar = document.getElementById('progressBar');
            if (show) {
                progressContainer.style.display = 'block';
                progressBar.style.width = '10%'; // small kick-off so it's visible
            } else {
                progressBar.style.width = '0%';
                progressContainer.style.display = 'none';
            }
        }

        // Auto-select first version for each movement when data loads
        view.initializeDefaultSelections = function(movements) {
            view.selectedVersions = {};
            movements.forEach(function(movement) {
                if (movement.versions.length > 0) {
                    const firstVersion = movement.versions[0];
                    view.selectedVersions[movement.id] = {
                        versionId: firstVersion.id,
                        target: firstVersion.target
                    };
                }
            });
        };

        // Fetch movements and display them
        fetchMovements().then(function(movements) {
            view.initializeDefaultSelections(movements);
            const movementsHTML = generateMovementsHTML(movements);
            view.setResult(movementsHTML);
        }).catch(function(error) {
            console.error('Error displaying movements:', error);
            view.setResult(`
                <div class="tei_body">
                    <h1>Error</h1>
                    <section class="teidiv0">
                        <p>Unable to load movements. Please try again later.</p>
                    </section>
                </div>
            `);
        });
    }
});
