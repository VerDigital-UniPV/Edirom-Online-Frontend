window.vrvToolkit = new verovio.toolkit();

// === BYO State and Tools === //
var appXPath = new Set();
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

    var body = document.body;
    var html = document.documentElement;

    var height = Math.max( body.scrollHeight, body.offsetHeight, 
                    html.clientHeight, html.scrollHeight, html.offsetHeight );
    var width = Math.max( body.scrollWidth, body.offsetWidth, 
                    html.clientWidth, html.scrollWidth, html.offsetWidth );
    
    var initHeight = Math.floor(height * 100.0 / 33.0) - 35;
    var initWidth = Math.floor(width * 100.0 / 33.0);

    var initHeight = Math.floor(height * 100.0 / 33.0) - 35;
    var initWidth = Math.floor(width * 100.0 / 33.0);

    const options = {
        scale: 25,
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

    /* Load the file using HTTP GET */
    var url = appBasePath + "/data/xql/getMusicInMdiv.xql?uri=" + uri + "&edition=" + edition    + "&movementId=" + movementId;

    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok: ' + response.status);
            return response.text();
        })
        .then(data => {
            meiString = data;
            meiDOM = parser.parseFromString(data, "application/xml");

            saveMainToolkitState(options, data);

            const svg = vrvToolkit.renderData(data, options);
            renderSVG(svg);

            retrieveApp(meiDOM);
            initData();
        })
        .catch(error => {
            console.error('Error loading movement data:', error);
            document.getElementById('output').textContent = 'Error loading movement.';
        });
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
        
        // create tooltip
        const tip = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
        tip.setAttributeNS(null, "class", "tip");
        tip.setAttributeNS(null, "data-refs", annotId);
        tip.style.position = 'absolute';
        tip.style.display = 'none';
        tip.style.height = 'auto';
        tip.style.maxWidth = '300px';
        tip.style.background = 'rgb(218, 218, 218)';
        tip.style.border = '1px solid black';
        tip.style.borderRadius = '5px';
        tip.style.padding = '5px';
        tip.style.zIndex = '10';
        tip.innerHTML = "Error getting annotation.";

        // do AJAX call to get annotation content with fetch
        fetch(appBasePath + 'data/xql/getAnnotation.xql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                uri: uri + '#' + annotId,
                target: 'tip',
                edition: edition
            })
        })
        .then(response => response.text())
        .then(data => {
            tip.innerHTML = data;
        })
        .catch(error => {
            tip.innerHTML = "Error fetching annotation.";
            console.error('Error fetching annotation:', error);
        });

        document.body.appendChild(tip);
        
        annotIcon.addEventListener('click', (e) => {
            parent.loadLink(uri + '#' + annotId);
        });

        annotIcon.addEventListener('mouseover', (e) => {
            annotIcon.style.cursor = 'pointer';

            // position and show tooltip
            const bbox = annotIcon.getBoundingClientRect();
            const tip = document.querySelector('.tip[data-refs="' + annotIcon.getAttributeNS(null, "data-id") + '"]');
            tip.style.left = (bbox.x + window.scrollX - 20) + 'px';
            tip.style.top = (bbox.y + window.scrollY + 20) + 'px';
            tip.style.display = 'block';
        });

        annotIcon.addEventListener('mouseout', (e) => {
            annotIcon.style.cursor = 'default';
            // hide all tooltips
            document.querySelectorAll('.tip').forEach((tip) => {
                tip.style.display = 'none';
            });
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
        let corresp = app.getAttribute("corresp");
        let annotID = corresp ? corresp.replace("#", "") : null;

        meiApps.push({
            id: appId,
            section: section,
            measure: measure,
            annotID: annotID
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

function getAnnotById(annotId) {
    const annots = meiDOM.getElementsByTagName("annot");
    for (let i = 0; i < annots.length; i++) {
        const id = annots[i].getAttributeNS("http://www.w3.org/XML/1998/namespace", "id");
        if (id === annotId) return annots[i];
    }
    return null;
}

function getElementById(liId) {
    const elements = meiDOM.getElementsByTagName("*");
    for (let i = 0; i < elements.length; i++) {
        const id = elements[i].getAttributeNS("http://www.w3.org/XML/1998/namespace", "id");
        if (id === liId) return elements[i];
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
                
                let collected = $();
                let $start = $appRendering;

                while ($start.length) {

                    // If they are siblings the normal nextUntil works
                    collected = collected.add($start.nextUntil($appEnd)).add($start, $appEnd);

                    if ($start.parent()[0] === $appEnd.parent()[0]) {
                        console.log("Same parent")
                        break;
                    }
                    else {
                        console.log("Not same parent")
                    }

                    // Not siblings climb up
                    let $parent = $start.parent();

                    // Move start to the parent's first child (same hierarchical level)
                    $start = $parent.next().children().first();

                    // Continue loop until siblings are reached
                }

                $appRendering = collected;
            } else {
                console.log(`App ${appRef.id} empty!`)
                const svgNS = "http://www.w3.org/2000/svg";
                const $star = $(document.createElementNS(svgNS, "polygon"))
                .attr({
                    points: "300,0 370.8,210.6 600,229.2 414.6,370.8 485.4,600 300,458.4 114.6,600 185.4,370.8 0,229.2 229.2,210.6",
                    fill: "gold",
                    stroke: "black",
                    'stroke-width': 2
                });

                function isVisibleGraphic(el) {
                    //return el.getBBox !== undefined && !el.classList.contains("sb");
                    return el.classList.contains("measure");
                }

                // Find previous and next relevant SVG element
                const $prev = $appRendering.prevAll().filter(function () { return isVisibleGraphic(this); }).first();
                const $next = $appRendering.nextAll().filter(function () { return isVisibleGraphic(this); }).first();

                console.log(
                    "prev:",
                    $prev.length ? $prev.attr("data-id") : null,
                    "next:",
                    $next.length ? $next.attr("data-id") : null
                );

                let x = 0, y = 0;

                if ($prev.length > 0) {
                    const bboxPrev = $prev[0].getBBox();
                    x = bboxPrev.x + bboxPrev.width + 10;
                    y = bboxPrev.y - 600;            // baseline placement above prev

                    if ($next.length > 0) {
                        const bboxNext = $next[0].getBBox();

                        // Ensure star stays above both prev and next
                        const highestY = Math.min(bboxPrev.y, bboxNext.y);
                        y = highestY - 600;
                    }
                    else {
                        console.log("No next element found.")
                    }
                } else {
                    console.warn("No suitable previous element found. Placing star at default position.");
                }

                $star.attr("transform", `translate(${x}, ${y})`);

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

    const annotEl = appRef.annotID ? getAnnotById(appRef.annotID) : null;
    let annotTitle = ""
    let annotText = "";
    if (!annotEl) {
        console.error(`Annot with id ${appRef.annotID} not found in MEI DOM.`);
    }
    else {
        annotTitle = annotEl.querySelector("title").innerHTML
        const ps = annotEl.querySelectorAll("p")
        annotText = Array.from(ps).reduce((acc, p) => acc + p.innerHTML, "");
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
            width: 80%;
            height: 80%;
            overflow-y: auto;
            font-family: Arial, sans-serif;
            text-align: center;
        ">
            <h3 style="margin-top: 0;">Select the alternative version</h3>
            <h4 style="margin-top: 0;">${annotTitle}</h3>
            <span><small>${annotText}</small></span>
            <div id="apparatus-content">
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
        let selectionHtml = `<div id="reading-options" style="text-align: left; display: flex;">`;

        let previewXPathMap = new Map()
        
        children.forEach((child) => {
            const childId = child.getAttribute("xml:id");
            const corresp = child.getAttribute("corresp");
            let liID =  corresp ? corresp.replace("#", "") : null;
            let previewXPath = new Set(basicPreviewXPath);
            // Preview XPath with/without corresp 
            updatePreviewXPath(corresp, previewXPath, childId);
            previewXPathMap.set(childId, previewXPath);
            
            const liEl = liID ? getElementById(liID) : null;
            let versionTitle = "";
            let versionText = "";
            if (!liEl) {
                console.error(`No element with id ${liID} found in MEI DOM.`);
            }
            else {
                const title = liEl.querySelector("title")
                if (title) {
                    versionTitle = title.innerHTML
                }
                versionText = liEl.innerHTML;
            }
            
            

            selectionHtml += `
                <div class="apparatus-selection-option" 
                    data-app-ref-id="${appRef.id}"
                    data-preview-xpath="${previewXPath}"
                    data-reading-id="${childId}">
                    <div style="margin-bottom: 10px;">
                        <strong>${versionTitle}</strong>
                        <br><small>${versionText}</small>
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