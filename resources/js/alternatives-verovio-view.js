window.vrvToolkit = new verovio.toolkit();

// === BYO State and Tools === //
let appXPath = new Set();
let meiString = "";
const parser = new DOMParser();
let meiDOM;
let meiApps = [];

// Add a flag to prevent multiple simultaneous re-renders
let isRerendering = false;

// === Main toolkit state management === //
let mainToolkitState = {
    options: null,
    data: null,
    currentPage: 1,
    pageCount: 0
};

// === Edition Labels Map === //
const versions = new Map();
versions.set("edition", "Edition");
versions.set("#curwenEdition", "Curwen");
versions.set("#SeaSongs", "Whall");
versions.set("#a-hugill", "Hugill (a)");
versions.set("#b-hugill", "Hugill (b)");
// TODO: Map the version to a name in the manifestation.
// It is not easy because the shortend name is nowhere in the mei file.
// Also we do not want something too long or big, but a shortend name.
// Maybe define a list of priorities from the manifestations in the xml from which to get this version Map with names.
// Something like identifier > title > respStmt persName etc...

// === Global Event Hook === //
const vrvToolkitDataInitialized = new Event("vrvToolkitDataInitialized");
window.addEventListener('vrvToolkitDataInitialized', (e) => {on_vrvToolkitDataInitialized()}, false);

// === Entry Point === //
showMovement(movementId);

function showMovement(movementId) {
    showLoader();
    window.movementId = movementId;

    const initHeight = Math.floor($(document).height() * 100.0 / 33.0) - 35;
    const initWidth = Math.floor($(document).width() * 100.0 / 33.0);

    const options = {
        scale: 33,
        pageHeight: initHeight,
        pageWidth: initWidth,
        adjustPageHeight: 1,
        footer: "none",
        header: "none",
        svgBoundingBoxes: false,
        svgHtml5: true,
        xmlIdChecksum: false,
        removeIds: false,
        //breaks: "line", // Added for the studi
        appXPathQuery: Array.from(appXPath),
        svgAdditionalAttribute: [
            "lem@source",
            "rdg@source",
            "lem@resp",
            "rdg@corresp"
        ],
    };

    console.log("Current appXPath in showMovement: ", appXPath);

    const url = `${appBasePath}/data/xql/getMusicInMdiv.xql?uri=${uri}&edition=${edition}&movementId=${movementId}`;

    $.get(url, function (data) {
        meiString = data;
        meiDOM = parser.parseFromString(data, "application/xml");

        saveMainToolkitState(options, data);

        const svg = vrvToolkit.renderData(data, options);
        renderSVG(svg);

        retrieveApp(meiDOM);
        initData();
    }, 'text');
}

function saveMainToolkitState(options, data) {
    mainToolkitState.options = {...options}; // Clone options
    mainToolkitState.data = data;
    mainToolkitState.pageCount = vrvToolkit.getPageCount();
}

function restoreMainToolkitState() {
    if (!mainToolkitState.options || !mainToolkitState.data) {
        console.warn("No main toolkit state to restore");
        return;
    }
    
    vrvToolkit.resetOptions();
    vrvToolkit.setOptions(mainToolkitState.options);
    vrvToolkit.loadData(mainToolkitState.data);
    mainToolkitState.pageCount = vrvToolkit.getPageCount();
}

function renderSVG(svg) {
    $("#output").find("*").off();  // Unbind all handlers
    $("#output").html(svg);       // Insert new SVG
}

function initData() {
    page = 1;
    pageCount = vrvToolkit.getPageCount();
    mainToolkitState.currentPage = page;
    mainToolkitState.pageCount = pageCount;

    // Restore saved page if it exists and is valid
    if (window.savedPage && window.savedPage <= pageCount && window.savedPage > 0) {
        console.log(`Restoring page ${window.savedPage} (pageCount: ${pageCount})`)
        page = window.savedPage;
        mainToolkitState.currentPage = page;
        // Clear the saved page
        window.savedPage = null;
        var svg = vrvToolkit.renderToSVG(page);
        
        renderSVG(svg);
    }
    
    updatePageData();
    setupApparatusInteraction(); // Add BYO interaction
    setupCorrespHighlighting();
    
    //dispatch vrvToolkitDataInitialized event
    window.dispatchEvent(vrvToolkitDataInitialized);
}

function updatePageData() {
    $("#page").html(page);
    $("#pageCount").html(pageCount);
    
    document.querySelectorAll('.annot.editorialComment:not(.bounding-box), .annot.annotRef:not(.bounding-box)').forEach((annot) => {
        const measure = annot.closest('.measure');
        const staff1 = measure.querySelector('.staff path').getBBox();
        const annotId = annot.getAttributeNS(null, 'data-id');
        
        const annotCount = measure.querySelectorAll('.annotIcon').length;

        const xmlns = "http://www.w3.org/2000/svg";
        const annotIcon = document.createElementNS(xmlns, "rect");
        annotIcon.setAttributeNS(null, "data-id", annotId);
        annotIcon.setAttributeNS(null, "class", 'annotIcon ' + annot.getAttributeNS(null, 'class'));
        annotIcon.setAttributeNS(null, "x", staff1.x + 100 + (annotCount * 450));
        annotIcon.setAttributeNS(null, "y", staff1.y - 700);
        annotIcon.setAttributeNS(null, "width", 350);
        annotIcon.setAttributeNS(null, "height", 250);

        measure.append(annotIcon);
        
        annotIcon.addEventListener('click', (e) => {
            parent.loadLink(uri + '#' + annotId);
        });
        
        Tipped.create(annotIcon, {
            ajax: {
                url: appBasePath + 'data/xql/getAnnotation.xql',
                type: 'post',
                data: {
                    uri: uri + '#' + annotId,
                    target: 'tip',
                    edition: edition
                }
            },
            target: 'mouse', 
            hideDelay: 1000,
            skin: 'gray',
            containment: {
                  selector: '#output',
                  padding: 0
                }
            });
    });
}

// New function to retrieve apparatus from MEI
function retrieveApp(meiDOM) {
    meiApps = [];
    let apps = meiDOM.querySelectorAll("app");
    console.log(apps.length + " apparati in current mei file.");

    apps.forEach((app) => {
        let appId = app.getAttribute("xml:id");
        let section = app.closest("section")?.getAttribute("xml:id");
        let measure = app.closest("measure")?.getAttribute("n");

        meiApps.push({
            id: appId,
            section: section,
            measure: measure
        });
    });

    console.log("Reduced apparatus list:", meiApps);
}

function getAppById(appId) {
    const apps = meiDOM.getElementsByTagName("app");
    for (let i = 0; i < apps.length; i++) {
        const id = apps[i].getAttributeNS("http://www.w3.org/XML/1998/namespace", "id");
        if (id === appId) return apps[i];
    }
    return null;
}

// New function to setup apparatus interaction
function setupApparatusInteraction() {
    console.log("Setting up apparatus interaction...");
    meiApps.forEach((appRef) => {
        let $appRendering = $("#output svg g.app[data-id='" + appRef.id + "']");
        //console.log(`App ${appRef.id}:`, $appRendering.length > 0 ? "found" : "not found");
        if ($appRendering.length > 0 && !hasVisibleChild($appRendering)) {
            let $appEnd = $("#output svg g.systemMilestoneEnd." + appRef.id);
            if ($appRendering.hasClass("systemElementStart") && $appEnd.length > 0 && !isBetweenEmpty($appRendering, $appEnd)) {
                console.log(`App ${appRef.id} spans several measures!`)
                $appRendering = $appRendering.nextUntil($appEnd).addBack().add($appEnd);
                // TODO: extend also to next system if necessary
            } else {
                console.log(`App ${appRef.id} empty!`)
                const svgNS = "http://www.w3.org/2000/svg";
                const $star = $(document.createElementNS(svgNS, "polygon"))
                .attr({
                    points: "150,0 185.4,105.3 300,114.6 207.3,185.4 242.7,300 150,229.2 57.3,300 92.7,185.4 0,114.6 114.6,105.3",
                    fill: "gold",
                    stroke: "black",
                    'stroke-width': 2
                });

                // Find the last visible SVG element before $appRendering
                const $prev = $appRendering.prevAll().filter(function () {
                    return this.getBBox !== undefined; // Must be an SVG graphics element
                }).first();

                if ($prev.length > 0) {
                    const bbox = $prev[0].getBBox(); // Get bounding box of the element

                    // Position the star just right next to it
                    const x = bbox.x + bbox.width + 10;
                    const y = bbox.y - 10; // Add 10px spacing

                    $star.attr("transform", `translate(${x}, ${y})`);
                } else {
                    console.warn('No suitable previous element found. Placing star at default position.');
                    $star.attr("transform", "translate(0, 0)");
                }

                // Append the star to the group
                $appRendering.append($star);
            }
        }

        if ($appRendering.length > 0) {
            // Remove existing event listeners using jQuery
            $appRendering.off('click');
            
            // Add classes to handle visualization in css
            $appRendering.children().addClass("rdgSelectable");
            $appRendering.children().hover(
                function (event) { // mouseenter
                    event.stopPropagation();
                    $appRendering.children().addClass('rdgSelectableHighlight');
                    $appRendering.children().removeClass("rdgSelectable");
                },
                function (event) { // mouseleave
                    event.stopPropagation();
                    $appRendering.children().removeClass('rdgSelectableHighlight');
                    $appRendering.children().addClass("rdgSelectable");
                }
            );

            // Add click handler using jQuery
            $appRendering.on('click', function(e) {
                console.log("Apparatus clicked:", appRef.id);
                e.stopPropagation();
                showApparatusSelection(appRef);
            });
        }
    });
}

function setupCorrespHighlighting() {
    console.log("Setting up corresp highlighting...")
    document.querySelectorAll('#output svg g.rdg[data-corresp]').forEach(element => {
        element.addEventListener('mouseenter', () => {
            const correspGroup = element.getAttribute('data-corresp');
            document.querySelectorAll(`#output svg g.rdg[data-corresp="${correspGroup}"]`).forEach(el => {
            el.classList.add('rdgSelectableHighlight');
            });
        });

        element.addEventListener('mouseleave', () => {
            const correspGroup = element.getAttribute('data-corresp');
            document.querySelectorAll(`#output svg g.rdg[data-corresp="${correspGroup}"]`).forEach(el => {
            el.classList.remove('rdgSelectableHighlight');
            });
        });
    });

}

function hasVisibleChild($node) {
    let hasVisible = false;
    $node.find("*").each(function() {
        const tag = this.tagName.toLowerCase();
        if (tag === 'desc' || tag === 'title' || tag === 'g') return; // skip metadata and groups
        hasVisible = true;
        return false; // break out of .each()
    });
    return hasVisible;
}

function isBetweenEmpty($start, $end) {
    let isEmpty = true;

    // Traverse siblings between start and end
    let $node = $start.next();
    while ($node.length && !$node.is($end)) {
        // Skip nodes with class 'annot'
        if (!$node.hasClass("annot")) {
            if (hasVisibleChild($node)) {
                isEmpty = false;
                break;
            }
        }

        $node = $node.next();
    }

    return isEmpty;
}

// Updated function to render preview using single toolkit
function renderPreview(appRef, rdgId, corresp, targetDiv, previewXPath) {
    console.log(`Rendering preview for apparatus ${appRef.id}, reading ${rdgId}`);
    const appEl = getAppById(appRef.id);
    if (!appEl) {
        targetDiv.innerHTML = '<span style="color: #999;">App not found</span>';
        return;
    }

    // Save current main toolkit state
    const currentPage = page;
    
    console.log(`Rendering preview for apparatus ${appRef.id}, reading ${rdgId}`);
    
    // Configure toolkit for preview
    const previewOptions = {
        appXPathQuery: Array.from(previewXPath),
        xmlIdChecksum: true,
        pageWidth: 600,
        scale: 35, // Slightly larger scale for better visibility of small sections
        adjustPageHeight: true,
        svgHtml5: true,
        footer: "none",
        header: "none",
        breaks: "none"
    };
    console.log(previewXPath)
    
    try {
        vrvToolkit.setOptions(previewOptions);
        vrvToolkit.loadData(meiString);
        
        // Measure range lookup can now be dynamically computed from `appEl`
        const measureIdArray = getMeasureIdsForApp(appEl);
        const measureStartId = measureIdArray[0] || null;
        const measureEndId = measureIdArray.at(-1) || null;

        console.log(`Selecting measures: ${measureStartId} to ${measureEndId}`);

        if (measureStartId && measureEndId) {
            vrvToolkit.select({ start: measureStartId, end: measureEndId });
            vrvToolkit.redoLayout();
        }

        const previewSvg = vrvToolkit.renderToSVG(1);
        targetDiv.innerHTML = previewSvg;
        
        // Highlight the selected reading
        setTimeout(() => {
            let $reading = $(targetDiv).find("svg g.rdg[data-id='" + rdgId + "']");
            console.log(`Reading ${rdgId}:`, $reading.length > 0 ? "found" : "not found");
            $reading.addClass("rdgCurrentPreview");
            
            // Also highlight any child elements of this reading
            $reading.find("*").addClass("rdgCurrentPreview");

            // Highlight the entire corresp if present
            let $correspondence = $(targetDiv).find("svg g.rdg[data-corresp='" + corresp + "']");
            $correspondence.addClass("rdgCurrentPreview");
            $correspondence.find("*").addClass("rdgCurrentPreview");
        }, 100);
        
    } catch (error) {
        console.error("Error in renderPreview:", error);
        targetDiv.innerHTML = '<span style="color: #999;">Preview error: ' + error.message + '</span>';
    } finally {
        // Restore main toolkit state after preview
        restoreMainToolkitState();
    }
}

function getMeasureIdsForApp(appEl) { // TODO: See if what was used previously to create the copy can be used again here
    const measureIds = new Set();

    const walker = document.createTreeWalker(appEl, NodeFilter.SHOW_ELEMENT, null, false);

    while (walker.nextNode()) {
        const el = walker.currentNode;

        const id = el.getAttributeNS("http://www.w3.org/XML/1998/namespace", "id");
        if (!id) continue;

        const measureEl = el.closest("measure");
        if (measureEl) {
            const measureId = measureEl.getAttributeNS("http://www.w3.org/XML/1998/namespace", "id");
            if (measureId) {
                measureIds.add(measureId);
            }
        }
    }

    return Array.from(measureIds).sort();  // Sort to get first and last
}

// New function to show apparatus selection modal/popup
function showApparatusSelection(appRef) {
    const appEl = getAppById(appRef.id);
    if (!appEl) {
        console.error(`App with id ${appRef.id} not found in MEI DOM.`);
        return;
    }

    const children = Array.from(appEl.children);

    // Immediately display the window with loading indicator
    let loadingHtml = `
        <div id="apparatus-selection" style="
            position: fixed; 
            top: 50%; 
            left: 50%; 
            transform: translate(-50%, -50%); 
            background: white; 
            border: 2px solid #ccc; 
            padding: 20px; 
            z-index: 1000;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            border-radius: 8px;
            max-width: 700px;
            max-height: 80vh;
            overflow-y: auto;
            font-family: Arial, sans-serif;
            text-align: center;
        ">
            <h3 style="margin-top: 0;">Select Reading for Apparatus ${appRef.id}</h3>
            <div id="apparatus-content">
                <!-- Loading indicator (clone the existing loader) -->
                <div class="loading-container" style="padding: 40px;">Loading previews...</div>
            </div>
            <div style="margin-top: 15px; text-align: center;">
                <button onclick="closeApparatusSelection()" style="
                    padding: 8px 16px; 
                    background: #007bff; 
                    color: white; 
                    border: none; 
                    border-radius: 4px; 
                    cursor: pointer;
                    font-size: 14px;
                ">Cancel</button>
            </div>
        </div>
        <div id="apparatus-overlay" style="
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100%; 
            height: 100%; 
            background: rgba(0, 0, 0, 0.5); 
            z-index: 999;
        " onclick="closeApparatusSelection()"></div>
    `;
    
    // Add to body immediately
    $('body').append(loadingHtml);

    // Retrive all possible alternatives involved in this apparatus and remove them from the basicPreviewXPath
    let basicPreviewXPath = new Set(appXPath);
    children.forEach((child) => {
            const childId = child.getAttribute("xml:id");
            const corresp = child.getAttribute("corresp");
            basicPreviewXPath.delete("./*[@corresp='" + corresp + "']");
            basicPreviewXPath.delete("./*[@xml:id='" + childId + "']");
    });
    
    // Use setTimeout to allow the UI to update, then load content
    setTimeout(() => {
        // Build the actual content
        let selectionHtml = `<div id="reading-options" style="text-align: left;">`;

        let previewXPathMap = new Map()
        
        children.forEach((child) => {
            const childId = child.getAttribute("xml:id");
            const sourceAttr = child.getAttribute("source") || "edition";
            const corresp = child.getAttribute("corresp");
            let previewXPath = new Set(basicPreviewXPath);
            // Preview XPath with/without corresp 
            updatePreviewXPath(corresp, previewXPath, childId);
            previewXPathMap.set(childId, previewXPath);

            const sources = sourceAttr.split(" ");
            let versionText = sources
                .map((source) => versions.get(source) || source)
                .join(" / ");
                
            selectionHtml += `
                <div class="apparatus-selection-option" 
                    data-app-ref-id="${appRef.id}"
                    data-preview-xpath="${previewXPath}"
                    data-reading-id="${childId}">
                    <div style="margin-bottom: 10px;">
                        <strong>${versionText}</strong>
                        <br><small>ID: ${childId}</small>
                        <br><small>Correspondence group: ${corresp}</small>
                    </div>
                    <div id="preview-${childId}" class="apparatus-preview-container">
                        <span style="color: #666;">Loading preview...</span>
                    </div>
                </div>
            `;
        });
        
        selectionHtml += `</div>`;
        
        // Replace the loading content with actual content
        $('#apparatus-content').html(selectionHtml);

        // Add event listened for click on apparatus selection option
        document.querySelectorAll('.apparatus-selection-option').forEach(element => {
            element.addEventListener('click', function(event) {
                event.preventDefault();
                event.stopPropagation();
                
                console.log("Apparatus option clicked"); // Debug log
                
                const childId = this.dataset.readingId;
                const appRefId = this.dataset.appRefId;
                const previewXPath = previewXPathMap.get(childId);
                
                console.log(`Selecting reading ${childId} for apparatus ${appRefId}`); // Debug log
                
                selectReading(childId, appRefId, previewXPath);
            });
        });
        
        // Generate previews for each reading
        children.forEach((child) => {
            const childId = child.getAttribute("xml:id");
            const previewDiv = document.getElementById("preview-" + childId);
            const corresp = child.getAttribute("corresp");
            const previewXPath = previewXPathMap.get(childId)
            
            if (previewDiv) {
                try {
                    renderPreview(appRef, childId, corresp, previewDiv, previewXPath);
                } catch (error) {
                    console.error("Error rendering preview for " + childId, error);
                    previewDiv.innerHTML = '<span style="color: #999;">Preview unavailable</span>';
                }
            }
        });
    }, 5); // Small delay to ensure UI updates
}

function updatePreviewXPath(corresp, previewXPath, childId) {
    if (corresp) { // Apply the change everywhere there is this correspondence
        console.log(`Rendering preview with corresp ${corresp}`);
        previewXPath.add("./*[@corresp='" + corresp + "']");

    } else { // Apply the change locally
        console.log(`Rendering preview with reading ${childId}`);
        previewXPath.add("./*[@xml:id='" + childId + "']");
    }
}

// Helper function to highlight selection option
function highlightSelectionOption(rdgId) {
    // Remove previous highlights
    $('.apparatus-selection-option').removeClass('selected');
    
    // Highlight the selected option
    $(`.apparatus-selection-option[data-reading-id="${rdgId}"]`).addClass('selected');
}

// New function to select a reading
function selectReading(rdgId, appId, selectedPreviewXPath) {
    console.log(`Selected reading ${rdgId} for apparatus ${appId}`);

    // Store current page before re-rendering
    window.savedPage = page;

    // Update appXPath to include the selected reading
    appXPath = new Set(selectedPreviewXPath);

    console.log("Updated appXPath:", appXPath);

    // Close selection interface
    closeApparatusSelection();

    // Re-render with new selection (this will restore the main toolkit state)
    setTimeout(() => {
        // Re-render with new selection
        showMovement(window.movementId);
    }, 100);
}

// New function to close apparatus selection
function closeApparatusSelection() {
    $('#apparatus-selection').remove();
    $('#apparatus-overlay').remove();

    console.log("Apparatus selection modal closed.");
}

function getMeasureIds() { // TODO: the function is there in the original verovio-view, but not used
    var measureIds = "";
    $("#output svg .measure").each(function(n, measure) { measureIds += measure.id + ","; } );
    return measureIds;
}

function prevPage() {
    if(page == 1) return;
    page--;
    mainToolkitState.currentPage = page;
    var svg = vrvToolkit.renderToSVG(page);
    renderSVG(svg);
    updatePageData();
    setupApparatusInteraction();
    setupCorrespHighlighting();
}

function nextPage() {
    if(page == pageCount) return;
    page++;
    mainToolkitState.currentPage = page;
    var svg = vrvToolkit.renderToSVG(page);
    renderSVG(svg);
    updatePageData();
    setupApparatusInteraction();
    setupCorrespHighlighting();
}

/**
 * Switch to page as defined by global page variable.
 */
function showPage() {
    if(page == 0) return;
    mainToolkitState.currentPage = page;
    var svg = vrvToolkit.renderToSVG(page);
    renderSVG(svg);
    updatePageData();
    setupApparatusInteraction();
    setupCorrespHighlighting();
}

function showLoader() {
    $("#output").empty();
    $(".lds-roller").clone().appendTo("#output");
}

/**
 * Show a measure in verovio if the goto measure function is called from the GUI.
 * Calls showMovement() if call to measure doesn't match current movement.
 * @param {string} movementId - The XML-ID of the selected movement.
 * @param {string} measureId - The XML-ID of the selected measure.
 */
function showMeasure(movementId, measureId) {
    
    if (measureId == undefined) return;
    window.measureId = measureId;
    
    if(vrvToolkit.getPageWithElement(measureId) == 0) {
        showMovement(movementId);
    } else if(window.movementId == movementId) {
        if (page == vrvToolkit.getPageWithElement(measureId)) return;
        page = vrvToolkit.getPageWithElement(measureId);
        mainToolkitState.currentPage = page;
        showPage();
    }
}

/**
 * Callback function on dispatch of vrvToolkitDataInitialized event
 */
function on_vrvToolkitDataInitialized(){
    console.log("event fired and catched");
    if (window.measureId == undefined ) return; 
    showMeasure(window.movementId, window.measureId);
}