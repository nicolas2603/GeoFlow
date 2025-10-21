/**
 * Geoflow Calepinage Web Worker
 * Performs heavy optimization in background thread
 */

// Import Turf.js in worker context
self.importScripts('https://cdn.jsdelivr.net/npm/@turf/turf@6/turf.min.js');

/**
 * Main message handler
 */
self.onmessage = function(e) {
    const { type, data } = e.data;
    
    switch(type) {
        case 'OPTIMIZE':
            optimizeLayout(data);
            break;
            
        default:
            console.warn('Unknown worker message type:', type);
    }
};

/**
 * Optimize panel layout (main computation)
 */
function optimizeLayout(data) {
    const { polygon, config } = data;
    
    try {
        // Send progress update
        postProgress(0, 'Initialisation...');
        
        // Apply buffer
        let buffered = turf.buffer(polygon, -config.edgeMargin / 1000, {units: 'kilometers'});
        
        if (!buffered || buffered.geometry.type === 'GeometryCollection') {
            const polys = buffered.geometry.geometries.filter(g => g.type === 'Polygon');
            if (polys.length === 0) {
                postResult({ panels: [], error: 'Buffer vide' });
                return;
            }
            buffered = turf.polygon(polys[0].coordinates);
        }

        // Get bounding box
        const bbox = turf.bbox(buffered);
        const [minLng, minLat, maxLng, maxLat] = bbox;

        // Calculate dimensions
        const isVertical = config.orientation === 90;
        const panelW = isVertical ? config.panelWidth : config.panelLength;
        const panelH = isVertical ? config.panelLength : config.panelWidth;

        // Conversion factors
        const latCenter = (minLat + maxLat) / 2;
        const metersPerDegreeLat = 111320;
        const metersPerDegreeLng = 111320 * Math.cos(latCenter * Math.PI / 180);

        // Steps
        const axialStepLen = (panelW + config.hSpacing) / metersPerDegreeLng;
        const stepPerp = (panelH + config.vSpacing) / metersPerDegreeLat;
        const panelLatSize = panelH / metersPerDegreeLat;
        const panelLngSize = panelW / metersPerDegreeLng;

        // Optimization loop
        const anchorModes = ['bottom_left', 'bottom_right', 'top_left', 'top_right'];
        const optimizationSteps = 10;
        const totalConfigs = anchorModes.length * optimizationSteps * optimizationSteps;
        
        let bestPanels = [];
        let bestConfig = null;
        let configIndex = 0;

        postProgress(5, `Test de ${totalConfigs} configurations...`);

        for (const anchor of anchorModes) {
            for (let i = 0; i < optimizationSteps; i++) {
                const rowOffset = (i / optimizationSteps) * stepPerp;
                
                for (let j = 0; j < optimizationSteps; j++) {
                    const colOffset = (j / optimizationSteps) * axialStepLen;
                    
                    // Fill with this configuration
                    const testPanels = fillWithOffsets(
                        buffered,
                        minLat, maxLat, minLng, maxLng,
                        stepPerp, axialStepLen,
                        panelLatSize, panelLngSize,
                        rowOffset, colOffset,
                        anchor,
                        config
                    );
                    
                    if (testPanels.length > bestPanels.length) {
                        bestPanels = testPanels;
                        bestConfig = { anchor, rowOffset, colOffset, count: testPanels.length };
                    }
                    
                    configIndex++;
                    
                    // Update progress every 10 configs
                    if (configIndex % 10 === 0) {
                        const progress = 5 + (configIndex / totalConfigs) * 90;
                        postProgress(progress, `${configIndex}/${totalConfigs} configs testées`);
                    }
                }
            }
        }

        postProgress(100, 'Terminé !');
        
        // Send result
        postResult({
            panels: bestPanels,
            bestConfig: bestConfig,
            totalTested: totalConfigs
        });

    } catch (error) {
        postResult({ 
            panels: [], 
            error: error.message,
            stack: error.stack 
        });
    }
}

/**
 * Fill with specific offsets and anchor mode
 */
function fillWithOffsets(buffered, minLat, maxLat, minLng, maxLng, 
                        stepPerp, axialStepLen, panelLatSize, panelLngSize,
                        rowOffset, colOffset, anchor, config) {
    const panels = [];
    
    // Determine starting positions based on anchor
    let startLat, endLat, latDirection;
    let searchStartLng, searchEndLng, lngDirection;
    
    switch(anchor) {
        case 'bottom_left':
            startLat = minLat + rowOffset;
            endLat = maxLat;
            latDirection = 1;
            searchStartLng = minLng + colOffset;
            searchEndLng = maxLng;
            lngDirection = 1;
            break;
            
        case 'bottom_right':
            startLat = minLat + rowOffset;
            endLat = maxLat;
            latDirection = 1;
            searchStartLng = maxLng - colOffset - panelLngSize;
            searchEndLng = minLng;
            lngDirection = -1;
            break;
            
        case 'top_left':
            startLat = maxLat - rowOffset - panelLatSize;
            endLat = minLat;
            latDirection = -1;
            searchStartLng = minLng + colOffset;
            searchEndLng = maxLng;
            lngDirection = 1;
            break;
            
        case 'top_right':
            startLat = maxLat - rowOffset - panelLatSize;
            endLat = minLat;
            latDirection = -1;
            searchStartLng = maxLng - colOffset - panelLngSize;
            searchEndLng = minLng;
            lngDirection = -1;
            break;
    }
    
    const metersPerDegreeLng = 111320 * Math.cos(startLat * Math.PI / 180);
    const hSpacingLng = config.hSpacing / metersPerDegreeLng;
    const halfPanelLngSize = panelLngSize / 2;
    
    // Fill row by row
    for (let lat = startLat; 
         latDirection > 0 ? (lat + panelLatSize <= endLat) : (lat >= endLat); 
         lat += latDirection * stepPerp) {
        
        const centerLat = lat + panelLatSize / 2;
        
        // Fine scan for first panel
        const scanStep = axialStepLen / 50;
        let nextPanelLng = null;
        let firstPanelPlaced = false;
        
        for (let lng = searchStartLng;
             lngDirection > 0 ? (lng + panelLngSize <= searchEndLng) : (lng >= searchEndLng);
             lng += lngDirection * scanStep) {
            
            const centerLng = lng + panelLngSize / 2;
            const rect = createRotatedRectangle([centerLng, centerLat], panelLngSize, panelLatSize, config.orientation);
            
            if (isPanelFullyContained(rect, buffered)) {
                panels.push({
                    geometry: rect,
                    type: 'full',
                    center: [centerLng, centerLat]
                });
                firstPanelPlaced = true;
                nextPanelLng = lng + lngDirection * (panelLngSize + hSpacingLng);
                break;
            }
        }
        
        // Try half panel if no full panel fits
        if (!firstPanelPlaced && config.allowHalf) {
            for (let lng = searchStartLng;
                 lngDirection > 0 ? (lng + halfPanelLngSize <= searchEndLng) : (lng >= searchEndLng);
                 lng += lngDirection * scanStep) {
                
                const centerLng = lng + halfPanelLngSize / 2;
                const halfRect = createRotatedRectangle([centerLng, centerLat], halfPanelLngSize, panelLatSize, config.orientation);
                
                if (isPanelFullyContained(halfRect, buffered)) {
                    panels.push({
                        geometry: halfRect,
                        type: 'half',
                        center: [centerLng, centerLat]
                    });
                    firstPanelPlaced = true;
                    nextPanelLng = lng + lngDirection * (halfPanelLngSize + hSpacingLng);
                    break;
                }
            }
        }
        
        // Continue filling row
        if (nextPanelLng !== null) {
            let lng = nextPanelLng;
            
            while ((lngDirection > 0 && lng + halfPanelLngSize <= searchEndLng) || 
                   (lngDirection < 0 && lng >= searchEndLng)) {
                let placed = false;
                
                // Try full panel
                if ((lngDirection > 0 && lng + panelLngSize <= searchEndLng) || 
                    (lngDirection < 0 && lng >= searchEndLng + panelLngSize)) {
                    
                    const centerLng = lng + panelLngSize / 2;
                    const rect = createRotatedRectangle([centerLng, centerLat], panelLngSize, panelLatSize, config.orientation);
                    
                    if (isPanelFullyContained(rect, buffered)) {
                        panels.push({
                            geometry: rect,
                            type: 'full',
                            center: [centerLng, centerLat]
                        });
                        lng += lngDirection * (panelLngSize + hSpacingLng);
                        placed = true;
                        continue;
                    }
                }
                
                // Try half panel
                if (!placed && config.allowHalf &&
                    ((lngDirection > 0 && lng + halfPanelLngSize <= searchEndLng) || 
                     (lngDirection < 0 && lng >= searchEndLng + halfPanelLngSize))) {
                    
                    const centerLng = lng + halfPanelLngSize / 2;
                    const halfRect = createRotatedRectangle([centerLng, centerLat], halfPanelLngSize, panelLatSize, config.orientation);
                    
                    if (isPanelFullyContained(halfRect, buffered)) {
                        panels.push({
                            geometry: halfRect,
                            type: 'half',
                            center: [centerLng, centerLat]
                        });
                        lng += lngDirection * (halfPanelLngSize + hSpacingLng);
                        placed = true;
                        continue;
                    }
                }
                
                if (!placed) break;
            }
        }
    }
    
    return panels;
}

/**
 * Create rotated rectangle
 */
function createRotatedRectangle(center, width, height, angle) {
    const [cx, cy] = center;
    const dx = width / 2;
    const dy = height / 2;

    let points = [
        [-dx, -dy], [-dx, +dy], [+dx, +dy], [+dx, -dy], [-dx, -dy]
    ];

    if (angle !== 0) {
        const rad = angle * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        points = points.map(([x, y]) => [
            cx + (cos * x - sin * y),
            cy + (sin * x + cos * y)
        ]);
    } else {
        points = points.map(([x, y]) => [cx + x, cy + y]);
    }

    return turf.polygon([points]);
}

/**
 * Test if panel is fully contained
 */
function isPanelFullyContained(panelRect, bufferedPolygon) {
    try {
        const contained = turf.booleanContains(bufferedPolygon, panelRect);
        if (!contained) return false;
        
        try {
            const intersection = turf.intersect(panelRect, bufferedPolygon);
            if (!intersection) return false;
            
            const panelArea = turf.area(panelRect);
            const intersectionArea = turf.area(intersection);
            const ratio = intersectionArea / panelArea;
            
            return ratio > 0.99;
        } catch (e) {
            return contained;
        }
    } catch (e) {
        return false;
    }
}

/**
 * Send progress update to main thread
 */
function postProgress(percent, message) {
    self.postMessage({
        type: 'PROGRESS',
        progress: percent,
        message: message
    });
}

/**
 * Send final result to main thread
 */
function postResult(result) {
    self.postMessage({
        type: 'RESULT',
        ...result
    });
}
