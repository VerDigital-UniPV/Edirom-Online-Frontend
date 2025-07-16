window.vrvToolkit = new verovio.toolkit();

// Initialize appXPath variable
let appXPath = [];

// New variables for BYO functionality
let meiString = "";
const parser = new DOMParser();
let meiDOM;
let meiApps = [];
const versions = new Map();
versions.set("edition", "Edition");
versions.set("#curwenEdition", "Curwen");
versions.set("#SeaSongs", "Whall");
versions.set("#a-hugill", "Hugill (a)");
versions.set("#b-hugill", "Hugill (b)");

showMovement(movementId);

/* add event as constant */
const vrvToolkitDataInitialized = new Event("vrvToolkitDataInitialized");

/* add event listener to window */
window.addEventListener('vrvToolkitDataInitialized', (e) => {on_vrvToolkitDataInitialized()}, false);

function showMovement(movementId) {        
    
    showLoader();
    
    window.movementId = movementId;
    
    var initHeight = Math.floor($(document).height() * 100.0 / 33.0) - 35;
    var initWidth = Math.floor($(document).width() * 100.0 / 33.0);

    var options = {
        'scale': 33,
	    'pageHeight': initHeight,
	    'pageWidth': initWidth,
	    'adjustPageHeight': 1,
        'footer': "none",
	    'header': 'none',
	    'svgBoundingBoxes': false,
	    'svgHtml5': true,
        'xmlIdChecksum': false,
        'removeIds': false,
        'breaks' : 'line', // Added for the studi
        'appXPathQuery': appXPath,
        'svgAdditionalAttribute': ["lem@source", "rdg@source", "lem@resp"],
    };

    /* Load the file using HTTP GET */
    var url = appBasePath + "/data/xql/getMusicInMdiv.xql?uri=" + uri + "&edition=" + edition + "&movementId=" + movementId;
    $.get(url, function( data ) {
        // Store the MEI data for BYO functionality
        meiString = data;
        meiDOM = parser.parseFromString(data, "application/xml");
        
        var svg = vrvToolkit.renderData(data, options);
        $("#output").html(svg);
        
        // Initialize BYO functionality after rendering
        retrieveApp(meiDOM);
        initData();
    }, 'text');
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
        $("#output").html(svg);
    }
    
    updatePageData();
    setupApparatusInteraction(); // Add BYO interaction

    // Optional: call debug function
    // debugAppMeasures();
    
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
    
    // Re-setup apparatus interaction after page update
    setupApparatusInteraction();
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
                drawAppSpans(app.children[i]);
            }
        }
        appObj.children = children;
        meiApps.push(appObj);
    });
    console.log(meiApps);
}

// New function to draw apparatus spans
function drawAppSpans(rdgEl) {
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
            
            // Set cursor style and add click handler using jQuery
            $appRendering.css('cursor', 'pointer').css('outline', '10px dashed blue').on('click', function(e) { // TODO: use classes instead
                console.log("Apparatus clicked:", app.id);
                e.stopPropagation();
                showApparatusSelection(app);
            });
        }
    });
}

// New function to render measure preview for apparatus selection
function renderPreview(app, rdgId, targetDiv) {
    // Create a temporary toolkit instance for preview rendering
    const previewTk = new verovio.toolkit();
    console.log(`Rendering preview for apparatus ${app.id}, reading ${rdgId}`);
    
    previewTk.setOptions({
        appXPathQuery: ["./*[@xml:id='" + rdgId + "']"],
        xmlIdChecksum: true,
        pageWidth: 600,
        scale: 25,
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
            previewTk.select({ measureRange: app.measure });
            previewTk.redoLayout();
        }
        // If no measure info available, show entire piece (no select call)
        
        targetDiv.innerHTML = previewTk.renderToSVG(1);
        
        // Highlight the selected reading
        setTimeout(() => {
            let $reading = $(targetDiv).find("svg g.rdg[id='" + rdgId + "']");
            console.log(`Reading ${rdgId}:`, $reading.length > 0 ? "found" : "not found");
            $reading.css({
                'fill': 'blue',
                'stroke': 'blue'
            });
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
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
        ">
            <h3>Select Reading for Apparatus ${app.id}</h3>
            <div id="reading-options">
    `;
    
    app.children.forEach((child, index) => {
        let sources = child.source.split(" ");
        let versionText = sources
            .map((source) => versions.get(source) || source)
            .join(" / ");
            
        selectionHtml += `
            <div style="margin: 10px 0; padding: 15px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;" 
                 onclick="selectReading('${child.id}', '${app.id}')" 
                 onmouseover="this.style.backgroundColor='#f0f0f0'" 
                 onmouseout="this.style.backgroundColor='white'">
                <div style="margin-bottom: 10px;">
                    <strong>${versionText}</strong>
                    <br><small>ID: ${child.id}</small>
                </div>
                <div id="preview-${child.id}" style="
                    border: 1px solid #eee; 
                    padding: 10px; 
                    background: #fafafa;
                    min-height: 60px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <span style="color: #666;">Loading preview...</span>
                </div>
            </div>
        `;
    });
    
    selectionHtml += `
            </div>
            <button onclick="closeApparatusSelection()" style="
                margin-top: 15px; 
                padding: 8px 16px; 
                background: #007bff; 
                color: white; 
                border: none; 
                border-radius: 4px; 
                cursor: pointer;
            ">Cancel</button>
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
                renderPreview(app, child.id, previewDiv); // Pass full app object
            } catch (error) {
                console.error("Error rendering preview for " + child.id, error);
                previewDiv.innerHTML = '<span style="color: #999;">Preview unavailable</span>';
            }
        }
    });
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
    
    // Re-render with new selection
    showMovement(window.movementId);
}

// New function to close apparatus selection
function closeApparatusSelection() {
    $('#apparatus-selection').remove();
    $('#apparatus-overlay').remove();
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
    $("#output").html(svg);
    updatePageData();
}

function nextPage() {
    if(page == pageCount) return;
    page++;
    var svg = vrvToolkit.renderToSVG(page);
    $("#output").html(svg);
    updatePageData();
}

/**
 * Switch to page as defined by global page variable.
 */
function showPage() {
    if(page == 0) return;
    var svg = vrvToolkit.renderToSVG(page);
    $("#output").html(svg);
    updatePageData();
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

function debugAppMeasures() {
    console.log("=== Apparatus Measure Debug Info ===");
    meiApps.forEach(app => {
        console.log(`App ${app.id}:`);
        console.log(`  - Section: ${app.section}`);
        console.log(`  - Measure (n): ${app.measure}`);
        console.log(`  - Start Measure ID: ${app.startMeasureId}`);
        console.log(`  - End Measure ID: ${app.endMeasureId}`);
        console.log(`  - All Measures: [${app.measureRange.join(', ')}]`);
        console.log(`  - Children: ${app.children.length}`);
        app.children.forEach(child => {
            console.log(`    - ${child.tag} (${child.id}): ${child.source}`);
        });
        console.log("");
    });
}