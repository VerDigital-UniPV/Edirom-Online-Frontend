window.vrvToolkit = new verovio.toolkit();

// === BYO State and Tools === //
let appXPath = [];
let meiString = "";
const parser = new DOMParser();
let meiDOM;
let meiApps = [];

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
        breaks: "line", // Added for the studi
        appXPathQuery: appXPath,
        svgAdditionalAttribute: [
            "lem@source",
            "rdg@source",
            "lem@resp"
        ],
    };

    const url = `${appBasePath}/data/xql/getMusicInMdiv.xql?uri=${uri}&edition=${edition}&movementId=${movementId}`;

    $.get(url, function (data) {
        meiString = data;
        meiDOM = parser.parseFromString(data, "application/xml");

        const svg = vrvToolkit.renderData(data, options);
        renderSVG(svg);

        retrieveApp(meiDOM);
        initData();
    }, 'text');
}

function renderSVG(svg) {
    $("#output").find("*").off();  // Unbind all handlers
    $("#output").html(svg);       // Insert new SVG
}

function initData() {
    page = 1;
    pageCount = vrvToolkit.getPageCount();

    // Restore saved page if it exists and is valid
    if (window.savedPage && window.savedPage <= pageCount && window.savedPage > 0) {
        console.log(`Restoring page ${window.savedPage}`)
        page = window.savedPage;
        // Clear the saved page
        window.savedPage = null;
        var svg = vrvToolkit.renderToSVG(page);
        
        renderSVG(svg);
    }
    
    updatePageData();
    setupApparatusInteraction(); // Add BYO interaction
    
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
        let appObj = {};
        appObj.id = app.getAttribute("xml:id");
        appObj.section = app.closest("section")?.getAttribute("xml:id");
        appObj.measure = app.closest("measure")?.getAttribute("n");
        
        // Find all measures that contain elements from this apparatus
        let measureIds = new Set();
        
        // Try different selectors for xml:id depending on browser/parser
        let allElements = app.querySelectorAll("*[xml\\:id]");
        if (allElements.length === 0) {
            // Fallback for different XML parsers
            allElements = app.querySelectorAll("*");
            allElements = Array.from(allElements).filter(el => el.hasAttribute("xml:id"));
        }
        
        allElements.forEach((element) => {
            let closestMeasure = element.closest("measure");
            if (closestMeasure) {
                let measureId = closestMeasure.getAttribute("xml:id");
                if (measureId) {
                    measureIds.add(measureId);
                }
            }
        });
        
        // If no measures found from elements, try to find measures that contain this app
        if (measureIds.size === 0) {
            let parentMeasure = app.closest("measure");
            if (parentMeasure && parentMeasure.getAttribute("xml:id")) {
                measureIds.add(parentMeasure.getAttribute("xml:id"));
            }
        }
        
        // Convert Set to sorted array and get first/last measures
        let measureIdArray = Array.from(measureIds).sort();
        appObj.startMeasureId = measureIdArray.length > 0 ? measureIdArray[0] : null;
        appObj.endMeasureId = measureIdArray.length > 0 ? measureIdArray[measureIdArray.length - 1] : null;
        appObj.measureRange = measureIdArray;
        
        console.log(`App ${appObj.id}: measures ${appObj.startMeasureId} to ${appObj.endMeasureId}`, measureIdArray);
        
        let children = [];
        for (let i = 0; i < app.children.length; i++) {
            rdgObj = {};
            rdgObj.tag = app.children[i].tagName;
            rdgObj.id = app.children[i].getAttribute("xml:id");
            rdgObj.source = app.children[i].getAttribute("source") != null
                ? app.children[i].getAttribute("source")
                : "edition";
            children.push(rdgObj);
            // draw appSpans in Verovio rendering if app has no measure
            if (appObj.measure == undefined) {
                drawAppSpans(app.children[i]); // TODO See what to do with this. The boxes around seems already enough
            }
        }
        appObj.children = children;
        meiApps.push(appObj);
    });
    console.log(meiApps);
}

// New function to draw apparatus spans
function drawAppSpans(rdgEl) { // TODO See what to do with this. The boxes around seems already enough
    let rdgSource = rdgEl.getAttribute("source");
    let rdgElChildrenIds = [];
    for (child of rdgEl.children) {
        let childID = child.getAttribute("xml:id");
        rdgElChildrenIds.push(childID);
        let svgEl = document.querySelector("g#" + childID);
        svgEl?.setAttribute("data-source", rdgSource);
    }
}

// New function to setup apparatus interaction
function setupApparatusInteraction() {
    console.log("Setting up apparatus interaction...");
    meiApps.forEach((app) => {
        let $appRendering = $("#output svg g.app[data-id='" + app.id + "']");
        console.log(`App ${app.id}:`, $appRendering.length > 0 ? "found" : "not found");
        if ($appRendering.length > 0) {
            // Remove existing event listeners using jQuery
            $appRendering.off('click');
            
            // Add class to handle visualization in css
            $appRendering.addClass("appSelectable")

            // Add click handler using jQuery
            $appRendering.on('click', function(e) {
                console.log("Apparatus clicked:", app.id);
                e.stopPropagation();
                showApparatusSelection(app);
            });
        }
    });
}

let previewToolkitInstance = null;

// New function to render preview for apparatus selection
function renderPreview(app, rdgId, targetDiv) {
    if (!previewToolkitInstance) {
        previewToolkitInstance = new verovio.toolkit();
    }
    const previewTk = previewToolkitInstance;
    console.log(`Rendering preview for apparatus ${app.id}, reading ${rdgId}`);
    
    previewTk.setOptions({
        appXPathQuery: ["./*[@xml:id='" + rdgId + "']"],
        xmlIdChecksum: true,
        pageWidth: 600,
        scale: 35, // Slightly larger scale for better visibility of small sections
        adjustPageHeight: true,
        footer: "none",
        header: "none",
        breaks: "none"
    });
    
    try {
        previewTk.loadData(meiString);
        
        // Use the measure range information from the app object
        if (app.startMeasureId && app.endMeasureId) {
            console.log(`Selecting measures: ${app.startMeasureId} to ${app.endMeasureId}`);
            
            previewTk.select({ start: app.startMeasureId, end : app.endMeasureId });
            
            previewTk.redoLayout();
        } else if (app.measure) {
            // Fall back to original measure number if available
            console.log(`Using fallback measure: ${app.measure}`);
            previewTk.select({ measure: app.measure });
            previewTk.redoLayout();
        }
        
        targetDiv.innerHTML = previewTk.renderToSVG(1);
        
        // Highlight the selected reading
        setTimeout(() => {
            let $reading = $(targetDiv).find("svg g.rdg[id='" + rdgId + "']");
            console.log(`Reading ${rdgId}:`, $reading.length > 0 ? "found" : "not found");
            $reading.addClass("rdgCurrentPreview");
            
            // Also highlight any child elements of this reading
            $reading.find("*").addClass("rdgCurrentPreview");
        }, 100);
        
    } catch (error) {
        console.error("Error in renderPreview:", error);
        targetDiv.innerHTML = '<span style="color: #999;">Preview error: ' + error.message + '</span>';
    }
}

// New function to show apparatus selection modal/popup
function showApparatusSelection(app) {
    // Create a simple selection interface
    let selectionHtml = `
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
        ">
            <h3 style="margin-top: 0;">Select Reading for Apparatus ${app.id}</h3>
            <div id="reading-options">
    `;
    
    app.children.forEach((child, index) => {
        let sources = child.source.split(" ");
        let versionText = sources
            .map((source) => versions.get(source) || source)
            .join(" / ");
            
        selectionHtml += `
            <div class="apparatus-selection-option" 
                 onclick="selectReading('${child.id}', '${app.id}')" 
                 data-reading-id="${child.id}">
                <div style="margin-bottom: 10px;">
                    <strong>${versionText}</strong>
                    <br><small>ID: ${child.id}</small>
                    ${child.affectedElements ? `<br><small>Affects ${child.affectedElements.length} elements</small>` : ''}
                </div>
                <div id="preview-${child.id}" class="apparatus-preview-container">
                    <span style="color: #666;">Loading preview...</span>
                </div>
            </div>
        `;
    });
    
    selectionHtml += `
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
    
    // Add to body
    $('body').append(selectionHtml);
    
    // Generate previews for each reading
    app.children.forEach((child) => {
        const previewDiv = document.getElementById("preview-" + child.id);
        if (previewDiv) {
            try {
                renderPreview(app, child.id, previewDiv);
            } catch (error) {
                console.error("Error rendering preview for " + child.id, error);
                previewDiv.innerHTML = '<span style="color: #999;">Preview unavailable</span>';
            }
        }
    });
}

// Helper function to highlight selection option
function highlightSelectionOption(rdgId) {
    // Remove previous highlights
    $('.apparatus-selection-option').removeClass('selected');
    
    // Highlight the selected option
    $(`.apparatus-selection-option[data-reading-id="${rdgId}"]`).addClass('selected');
}

// New function to select a reading
function selectReading(rdgId, appId) {
    console.log(`Selected reading ${rdgId} for apparatus ${appId}`);

    // Store current page before re-rendering
    window.savedPage = page;

    // Update appXPath to include the selected reading
    let newXPath = "./*[@xml:id='" + rdgId + "']";

    // Add to beginning of appXPath array (or replace existing)
    if (Array.isArray(appXPath)) {
        // Remove any existing xpath for this apparatus
        appXPath = appXPath.filter(xpath => !xpath.includes(appId));
        // Add new xpath at beginning
        appXPath.unshift(newXPath);
    } else {
        appXPath = [newXPath];
    }

    console.log("Updated appXPath:", appXPath);

    // Close selection interface
    closeApparatusSelection();

    // Clean up preview toolkit instance to free memory
    if (window.previewToolkitInstance) {
        try {
            window.previewToolkitInstance.setOptions({});
        } catch (e) {
            console.warn("Failed to reset preview toolkit options", e);
        }
        window.previewToolkitInstance = null;
    }

    // Re-render with new selection
    showMovement(window.movementId);
}

// New function to close apparatus selection
function closeApparatusSelection() {
    $('#apparatus-selection').remove();
    $('#apparatus-overlay').remove();

    console.log("Apparatus selection modal closed.");
}

function getMeasureIds() {
    var measureIds = "";
    $("#output svg .measure").each(function(n, measure) { measureIds += measure.id + ","; } );
    return measureIds;
}

function prevPage() {
    if(page == 1) return;
    page--;
    var svg = vrvToolkit.renderToSVG(page);
    renderSVG(svg);
    updatePageData();
    setupApparatusInteraction();
}

function nextPage() {
    if(page == pageCount) return;
    page++;
    var svg = vrvToolkit.renderToSVG(page);
    renderSVG(svg);
    updatePageData();
    setupApparatusInteraction();
}

/**
 * Switch to page as defined by global page variable.
 */
function showPage() {
    if(page == 0) return;
    var svg = vrvToolkit.renderToSVG(page);
    renderSVG(svg);
    updatePageData();
    setupApparatusInteraction();
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