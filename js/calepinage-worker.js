/**
 * Geoflow Calepinage Web Worker - VERSION CORRIGÉE
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
            if (data.config && data.config.mode === 'plantation') {
                optimizePlantationGrid(data);
            } else {
                optimizeLayout(data);
            }
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
        const isVertical = Math.abs((config.orientation % 180) - 90) < 1e-6;

        // ÉCHANGE des dimensions selon l'orientation
        const panelW = isVertical ? config.panelWidth : config.panelLength;
        const panelH = isVertical ? config.panelLength : config.panelWidth;

        // Conversion factors
        const latCenter = (minLat + maxLat) / 2;
        const metersPerDegreeLat = 111320;
        const metersPerDegreeLng = 111320 * Math.cos(latCenter * Math.PI / 180);

        // CORRECTION CRITIQUE : Échange des espacements en mode tracker
        let hSpacingToUse, vSpacingToUse;
        if (isVertical) {
            // Mode tracker : échanger les espacements
            hSpacingToUse = config.vSpacing;  // v_spacing → espacement horizontal (entre colonnes)
            vSpacingToUse = config.hSpacing;  // h_spacing → espacement vertical (entre lignes)
        } else {
            // Mode standard : espacements normaux
            hSpacingToUse = config.hSpacing;
            vSpacingToUse = config.vSpacing;
        }

        // Calcul des pas avec les bons espacements
        const axialStepLen = (panelW + hSpacingToUse) / metersPerDegreeLng;  // Pas entre colonnes
        const stepPerp = (panelH + vSpacingToUse) / metersPerDegreeLat;     // Pas entre lignes
        const panelLatSize = panelH / metersPerDegreeLat;
        const panelLngSize = panelW / metersPerDegreeLng;

        /* console.log(`Mode ${isVertical ? 'TRACKER' : 'STANDARD'}:`, {
            panelW, panelH,
            hSpacingToUse, vSpacingToUse,
            axialStepLen: axialStepLen * metersPerDegreeLng,
            stepPerp: stepPerp * metersPerDegreeLat
        }); */

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
                        config,
                        hSpacingToUse,  // Passer les espacements corrects
                        isVertical
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
                        rowOffset, colOffset, anchor, config, hSpacingToUse, isVertical) {
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
    
    // CORRECTION : Utiliser latCenter pour le calcul, pas startLat
    const latCenter = (minLat + maxLat) / 2;
    const metersPerDegreeLng = 111320 * Math.cos(latCenter * Math.PI / 180);
    const hSpacingLng = hSpacingToUse / metersPerDegreeLng;
    const halfPanelLngSize = panelLngSize / 2;
    
    // Fill row by row
    // LOGIQUE DIFFÉRENTE selon le mode :
    // - Mode STANDARD : scan fin pour trouver le premier panneau, puis pas fixes
    // - Mode TRACKER : grille fixe pour aligner les colonnes verticalement
    
    if (isVertical) {
        // MODE TRACKER : Grille fixe pour alignement vertical des colonnes
        for (let lat = startLat; 
             latDirection > 0 ? (lat + panelLatSize <= endLat) : (lat >= endLat); 
             lat += latDirection * stepPerp) {
            
            const centerLat = lat + panelLatSize / 2;
            
            // Parcourir la grille fixe de colonnes
            for (let lng = searchStartLng;
                 lngDirection > 0 ? (lng + panelLngSize <= searchEndLng) : (lng >= searchEndLng);
                 lng += lngDirection * axialStepLen) {
                
                let placed = false;
                
                // Try full panel at this grid position
                const centerLng = lng + panelLngSize / 2;
                const rect = createRotatedRectangle(
                    [centerLng, centerLat], 
                    panelLngSize,
                    panelLatSize,
                    isVertical
                );
                
                if (isPanelFullyContained(rect, buffered)) {
                    panels.push({
                        geometry: rect,
                        type: 'full',
                        center: [centerLng, centerLat]
                    });
                    placed = true;
                }
                
                // Try half panel if full didn't fit
                if (!placed && config.allowHalf) {
                    const centerLngHalf = lng + halfPanelLngSize / 2;
                    const halfRect = createRotatedRectangle(
                        [centerLngHalf, centerLat], 
                        halfPanelLngSize,
                        panelLatSize,
                        isVertical
                    );
                    
                    if (isPanelFullyContained(halfRect, buffered)) {
                        panels.push({
                            geometry: halfRect,
                            type: 'half',
                            center: [centerLngHalf, centerLat]
                        });
                        placed = true;
                    }
                }
            }
        }
    } else {
        // MODE STANDARD : Scan fin pour le premier panneau, puis continuation avec pas fixes
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
                const rect = createRotatedRectangle(
                    [centerLng, centerLat], 
                    panelLngSize,
                    panelLatSize,
                    isVertical
                );
                
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
                    const halfRect = createRotatedRectangle(
                        [centerLng, centerLat], 
                        halfPanelLngSize, 
                        panelLatSize, 
                        isVertical
                    );
                    
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
            
            // Continue filling row with fixed steps
            if (nextPanelLng !== null) {
                let lng = nextPanelLng;
                
                while ((lngDirection > 0 && lng + halfPanelLngSize <= searchEndLng) || 
                       (lngDirection < 0 && lng >= searchEndLng)) {
                    let placed = false;
                    
                    // Try full panel
                    if ((lngDirection > 0 && lng + panelLngSize <= searchEndLng) || 
                        (lngDirection < 0 && lng >= searchEndLng + panelLngSize)) {
                        
                        const centerLng = lng + panelLngSize / 2;
                        const rect = createRotatedRectangle(
                            [centerLng, centerLat], 
                            panelLngSize, 
                            panelLatSize, 
                            isVertical
                        );
                        
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
                        const halfRect = createRotatedRectangle(
                            [centerLng, centerLat], 
                            halfPanelLngSize, 
                            panelLatSize, 
                            isVertical
                        );
                        
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
    }
    
    return panels;
}

/**
 * Optimize plantation grid (similar to solar tracker optimization)
 * Tests 400 configurations to maximize tree count
 */
function optimizePlantationGrid(data) {
    const { polygon, config } = data;
    
    try {
        postProgress(0, 'Initialisation de la grille...');
        
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

        // Tree dimensions (always square for plantation)
        const treeDiameter = config.panelWidth; // panelWidth = panelLength = diameter
        
        // Conversion factors
        const latCenter = (minLat + maxLat) / 2;
        const metersPerDegreeLat = 111320;
        const metersPerDegreeLng = 111320 * Math.cos(latCenter * Math.PI / 180);

        // Grid spacing (tree diameter + spacing)
        const gridStepLng = (treeDiameter + config.hSpacing) / metersPerDegreeLng;
        const gridStepLat = (treeDiameter + config.vSpacing) / metersPerDegreeLat;
        
        // Tree size in degrees
        const treeSizeLat = treeDiameter / metersPerDegreeLat;
        const treeSizeLng = treeDiameter / metersPerDegreeLng;

        postProgress(5, 'Optimisation de la grille...');

        // Optimization: test 4 anchors × 10 row offsets × 10 col offsets = 400 configs
        const anchorModes = ['bottom_left', 'bottom_right', 'top_left', 'top_right'];
        const optimizationSteps = 10;
        const totalConfigs = anchorModes.length * optimizationSteps * optimizationSteps;
        
        let bestPanels = [];
        let bestConfig = null;
        let configIndex = 0;

        for (const anchor of anchorModes) {
            for (let i = 0; i < optimizationSteps; i++) {
                const rowOffset = (i / optimizationSteps) * gridStepLat;
                
                for (let j = 0; j < optimizationSteps; j++) {
                    const colOffset = (j / optimizationSteps) * gridStepLng;
                    
                    // Generate grid with this configuration
                    const testPanels = fillPlantationGrid(
                        buffered,
                        minLat, maxLat, minLng, maxLng,
                        gridStepLat, gridStepLng,
                        treeSizeLat, treeSizeLng,
                        rowOffset, colOffset,
                        anchor
                    );
                    
                    if (testPanels.length > bestPanels.length) {
                        bestPanels = testPanels;
                        bestConfig = { 
                            anchor, 
                            rowOffset, 
                            colOffset, 
                            count: testPanels.length 
                        };
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
 * Fill plantation grid with specific offsets and anchor mode
 */
function fillPlantationGrid(buffered, minLat, maxLat, minLng, maxLng, 
                            gridStepLat, gridStepLng, 
                            treeSizeLat, treeSizeLng,
                            rowOffset, colOffset, anchor) {
    const panels = [];
    
    // Determine starting positions based on anchor
    let startLat, endLat, latDirection;
    let startLng, endLng, lngDirection;
    
    switch(anchor) {
        case 'bottom_left':
            startLat = minLat + rowOffset;
            endLat = maxLat;
            latDirection = 1;
            startLng = minLng + colOffset;
            endLng = maxLng;
            lngDirection = 1;
            break;
            
        case 'bottom_right':
            startLat = minLat + rowOffset;
            endLat = maxLat;
            latDirection = 1;
            startLng = maxLng - colOffset - treeSizeLng;
            endLng = minLng;
            lngDirection = -1;
            break;
            
        case 'top_left':
            startLat = maxLat - rowOffset - treeSizeLat;
            endLat = minLat;
            latDirection = -1;
            startLng = minLng + colOffset;
            endLng = maxLng;
            lngDirection = 1;
            break;
            
        case 'top_right':
            startLat = maxLat - rowOffset - treeSizeLat;
            endLat = minLat;
            latDirection = -1;
            startLng = maxLng - colOffset - treeSizeLng;
            endLng = minLng;
            lngDirection = -1;
            break;
    }
    
    let row = 0;
    
    // Fill grid from starting position
    for (let lat = startLat; 
         latDirection > 0 ? (lat + treeSizeLat <= endLat) : (lat >= endLat); 
         lat += latDirection * gridStepLat) {
        
        let col = 0;
        
        for (let lng = startLng;
             lngDirection > 0 ? (lng + treeSizeLng <= endLng) : (lng >= endLng);
             lng += lngDirection * gridStepLng) {
            
            // Calculate tree center
            const centerLat = lat + treeSizeLat / 2;
            const centerLng = lng + treeSizeLng / 2;
            
            // Create square representing tree crown
            const treeSquare = turf.polygon([[
                [lng, lat],
                [lng, lat + treeSizeLat],
                [lng + treeSizeLng, lat + treeSizeLat],
                [lng + treeSizeLng, lat],
                [lng, lat]
            ]]);
            
            // Check if tree is fully contained in buffered polygon
            try {
                const contained = turf.booleanContains(buffered, treeSquare);
                if (contained) {
                    // Additional check with intersection area
                    const intersection = turf.intersect(treeSquare, buffered);
                    if (intersection) {
                        const treeArea = turf.area(treeSquare);
                        const intersectionArea = turf.area(intersection);
                        const ratio = intersectionArea / treeArea;
                        
                        if (ratio > 0.99) {
                            panels.push({
                                geometry: treeSquare,
                                type: 'full',
                                center: [centerLng, centerLat],
                                row: row,
                                col: col
                            });
                        }
                    }
                }
            } catch (e) {
                // Ignore trees that cause errors
            }
            
            col++;
        }
        
        row++;
    }
    
    return panels;
}

/**
 * Create rotated rectangle
 * CORRECTION MAJEURE : Pas de rotation géométrique, juste réorganisation conceptuelle
 */
function createRotatedRectangle(center, width, height, isVertical) {
    const [cx, cy] = center;
    const dx = width / 2;
    const dy = height / 2;
    
    // Créer le rectangle de base (non rotationné géométriquement)
    let points = [
        [-dx, -dy],  // Coin 0: bas-gauche
        [-dx, +dy],  // Coin 1: haut-gauche  
        [+dx, +dy],  // Coin 2: haut-droit
        [+dx, -dy],  // Coin 3: bas-droit
        [-dx, -dy]   // Fermeture
    ];
    
    // CORRECTION CRITIQUE : En mode tracker, réorganiser les coins comme dans QGIS
    // coords = [coords[1], coords[2], coords[3], coords[0]]
    if (isVertical) {
        points = [
            points[1],  // Nouveau coin 0 = ancien coin 1 (haut-gauche)
            points[2],  // Nouveau coin 1 = ancien coin 2 (haut-droit)
            points[3],  // Nouveau coin 2 = ancien coin 3 (bas-droit)
            points[0],  // Nouveau coin 3 = ancien coin 0 (bas-gauche)
            points[1]   // Fermeture
        ];
    }
    
    // Translater vers le centre
    points = points.map(([x, y]) => [cx + x, cy + y]);
    
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