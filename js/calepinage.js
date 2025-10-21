/**
 * Geoflow Calepinage Module - Version avec optimisation complète
 * Generates solar panel layouts within polygons
 * Matches QGIS plugin logic: 4 anchors × 10 row offsets × 10 col offsets = 400 configs
 */

const GeoflowCalepinage = {
    // Modèles de panneaux prédéfinis
    panelModels: {
        'custom': {
            name: 'Saisie manuelle',
            length: null,
            width: null
        },
        '2V24': {
            name: '2V24 Standard',
            length: 27.68,
            width: 4.95,
            description: 'Configuration classique 27.68x4.95m'
        },
        'tracker': {
            name: 'Tracker',
            length: 35.5,
            width: 4.8,
            description: 'Tracker standard 35.5x4.8m'
        }
    },

    // Configuration par défaut
    defaultConfig: {
        model: 'custom',
        panelLength: 27.68,
        panelWidth: 4.95,
        hSpacing: 0.2,
        vSpacing: 3.0,
        edgeMargin: 1.0,
        orientation: 0,
        allowHalf: false
    },

    // Stockage des résultats
    generatedPanels: [],
    resultLayer: null,

    /**
     * Get panel content HTML
     */
    getPanelContent() {
        return `
            <!-- Aide -->
            <div style="margin-bottom: 14px; padding: 10px; background: rgba(59, 130, 246, 0.1); border-radius: 6px; border-left: 3px solid #3b82f6;">
                <div style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">
                    <strong style="color: var(--text-primary);">Mode d'emploi :</strong><br>
                    1. Dessinez un polygone sur la carte<br>
                    2. Configurez les paramètres<br>
                    3. Cliquez sur "Générer"
                </div>
            </div>
			
			<!-- Sélection du modèle -->
            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
                    Modèle de panneau
                </label>
                <select id="calepinage-model" class="form-select form-select-sm">
                    <option value="custom">Saisie manuelle</option>
                    <option value="2V24">2V24 Standard (27.68×4.95m)</option>
                    <option value="tracker">Tracker (35.5×4.8m)</option>
                </select>
            </div>

            <!-- Dimensions -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px;">
                <div>
                    <label style="display: block; font-size: 0.75rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 4px;">
                        Longueur (m)
                    </label>
                    <input type="number" id="calepinage-length" class="form-control form-control-sm" 
                           value="${this.defaultConfig.panelLength}" step="0.1" min="0.1">
                </div>
                <div>
                    <label style="display: block; font-size: 0.75rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 4px;">
                        Largeur (m)
                    </label>
                    <input type="number" id="calepinage-width" class="form-control form-control-sm" 
                           value="${this.defaultConfig.panelWidth}" step="0.1" min="0.1">
                </div>
            </div>

            <!-- Espacements -->
            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
                    Espacements
                </label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div>
                        <label style="display: block; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px;">
                            Entre panneaux (m)
                        </label>
                        <input type="number" id="calepinage-h-spacing" class="form-control form-control-sm" 
                               value="${this.defaultConfig.hSpacing}" step="0.1" min="0">
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px;">
                            Interrang (m)
                        </label>
                        <input type="number" id="calepinage-v-spacing" class="form-control form-control-sm" 
                               value="${this.defaultConfig.vSpacing}" step="0.1" min="0">
                    </div>
                </div>
            </div>

            <!-- Marge de sécurité -->
            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
                    Marge de sécurité (m)
                </label>
                <input type="number" id="calepinage-margin" class="form-control form-control-sm" 
                       value="${this.defaultConfig.edgeMargin}" step="0.1" min="0">
            </div>

            <!-- Options -->
            <div style="margin-bottom: 14px;">
                <div class="form-check" style="padding-left: 1.5rem; margin-bottom: 6px;">
                    <input class="form-check-input" type="checkbox" id="calepinage-tracker">
                    <label class="form-check-label" for="calepinage-tracker" style="font-size: 0.85rem;">
                        <i class="fa-solid fa-rotate"></i> Mode Tracker (vertical)
                    </label>
                </div>
                <div class="form-check" style="padding-left: 1.5rem;">
                    <input class="form-check-input" type="checkbox" id="calepinage-half">
                    <label class="form-check-label" for="calepinage-half" style="font-size: 0.85rem;">
                        <i class="fa-solid fa-scissors"></i> Autoriser les demi-tables
                    </label>
                </div>
            </div>

            <!-- Boutons d'action -->
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                <button class="btn btn-sm btn-primary flex-fill" id="calepinage-generate">
                    <i class="fa-solid fa-solar-panel"></i> Générer
                </button>
				<button class="btn btn-sm btn-success flex-fill" id="calepinage-export-geojson" disabled>
                    <i class="fa-solid fa-download"></i> GeoJSON
                </button>
                <button class="btn btn-sm btn-danger" id="calepinage-clear" style="width: 44px;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>

            <!-- Barre de progression -->
            <div id="calepinage-progress" style="display: none; margin-bottom: 14px;">
                <div style="background: var(--hover-bg); border-radius: 8px; padding: 12px; border-left: 3px solid var(--primary);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-primary);">
                            <i class="fa-solid fa-spinner fa-spin"></i> <span id="progress-message">Calcul en cours...</span>
                        </div>
                        <div style="font-size: 0.85rem; font-weight: 600; color: var(--primary);" id="progress-percent">0%</div>
                    </div>
                    <div style="width: 100%; height: 8px; background: rgba(0,0,0,0.1); border-radius: 4px; overflow: hidden;">
                        <div id="progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, var(--primary), #10b981); transition: width 0.3s ease; border-radius: 4px;"></div>
                    </div>
                    <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 6px;" id="progress-details">
                        Préparation...
                    </div>
                </div>
            </div>

            <!-- Statistiques -->
            <div id="calepinage-stats" style="display: none;">
                <div style="padding: 12px; background: var(--hover-bg); border-radius: 8px; border-left: 3px solid var(--primary);">
                    <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">
                        <i class="fa-solid fa-chart-simple"></i> Résultats
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                        <div>
                            <div style="font-size: 0.7rem; color: var(--text-secondary);">Tables entières</div>
                            <div style="font-size: 1rem; font-weight: 600; color: var(--primary);" id="stat-full">0</div>
                        </div>
                        <div>
                            <div style="font-size: 0.7rem; color: var(--text-secondary);">Demi-tables</div>
                            <div style="font-size: 1rem; font-weight: 600; color: #3b82f6;" id="stat-half">0</div>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <div>
                            <div style="font-size: 0.7rem; color: var(--text-secondary);">Surface panneaux</div>
                            <div style="font-size: 0.9rem; font-weight: 600;" id="stat-area">0 m²</div>
                        </div>
                        <div>
                            <div style="font-size: 0.7rem; color: var(--text-secondary);">Taux couverture</div>
                            <div style="font-size: 0.9rem; font-weight: 600; color: #10b981;" id="stat-coverage">0%</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Attach event listeners
     */
    attachListeners() {
        const modelSelect = document.getElementById('calepinage-model');
        if (modelSelect) {
            modelSelect.addEventListener('change', (e) => {
                this.onModelChange(e.target.value);
            });
        }

        const trackerCheck = document.getElementById('calepinage-tracker');
        const halfCheck = document.getElementById('calepinage-half');
        if (trackerCheck && halfCheck) {
            trackerCheck.addEventListener('change', (e) => {
                if (e.target.checked) {
                    halfCheck.checked = false;
                    halfCheck.disabled = true;
                } else {
                    halfCheck.disabled = false;
                }
            });
        }

        const generateBtn = document.getElementById('calepinage-generate');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                this.generate();
            });
        }

        const clearBtn = document.getElementById('calepinage-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearResults();
            });
        }

        const exportGeoJsonBtn = document.getElementById('calepinage-export-geojson');
        if (exportGeoJsonBtn) {
            exportGeoJsonBtn.addEventListener('click', () => {
                this.exportToGeoJSON();
            });
        }
    },

    onModelChange(modelKey) {
        const model = this.panelModels[modelKey];
        
        const lengthInput = document.getElementById('calepinage-length');
        const widthInput = document.getElementById('calepinage-width');

        if (model && model.length && model.width) {
            lengthInput.value = model.length;
            widthInput.value = model.width;
            lengthInput.disabled = true;
            widthInput.disabled = true;
            
            if (model.description) {
                GeoflowUtils.showToast(model.description, 'info');
            }
        } else {
            lengthInput.disabled = false;
            widthInput.disabled = false;
        }
    },

    getConfig() {
        return {
            model: document.getElementById('calepinage-model')?.value || 'custom',
            panelLength: parseFloat(document.getElementById('calepinage-length')?.value || 27.68),
            panelWidth: parseFloat(document.getElementById('calepinage-width')?.value || 4.95),
            hSpacing: parseFloat(document.getElementById('calepinage-h-spacing')?.value || 0.2),
            vSpacing: parseFloat(document.getElementById('calepinage-v-spacing')?.value || 3.0),
            edgeMargin: parseFloat(document.getElementById('calepinage-margin')?.value || 1.0),
            orientation: document.getElementById('calepinage-tracker')?.checked ? 90 : 0,
            allowHalf: document.getElementById('calepinage-half')?.checked || false
        };
    },

    validateConfig(config) {
        const errors = [];

        if (config.panelLength <= 0 || config.panelLength > 100) {
            errors.push('Longueur invalide (0.1 - 100m)');
        }
        if (config.panelWidth <= 0 || config.panelWidth > 50) {
            errors.push('Largeur invalide (0.1 - 50m)');
        }
        if (config.hSpacing < 0 || config.hSpacing > 50) {
            errors.push('Espacement horizontal invalide (0 - 50m)');
        }
        if (config.vSpacing < 0 || config.vSpacing > 100) {
            errors.push('Espacement vertical invalide (0 - 100m)');
        }
        if (config.edgeMargin < 0 || config.edgeMargin > 50) {
            errors.push('Marge invalide (0 - 50m)');
        }

        return errors;
    },

    /**
     * Create rotated rectangle with proper coordinate system
     */
    createRotatedRectangle(center, width, height, angle) {
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
    },

    /**
     * STRICT containment test
     */
    isPanelFullyContained(panelRect, bufferedPolygon) {
        try {
            const contained = turf.booleanContains(bufferedPolygon, panelRect);
            
            if (!contained) {
                return false;
            }
            
            try {
                const intersection = turf.intersect(panelRect, bufferedPolygon);
                if (!intersection) {
                    return false;
                }
                
                const panelArea = turf.area(panelRect);
                const intersectionArea = turf.area(intersection);
                const ratio = intersectionArea / panelArea;
                
                return ratio > 0.99;
            } catch (e) {
                return contained;
            }
            
        } catch (e) {
            console.warn('Containment test failed:', e);
            return false;
        }
    },

    /**
     * OPTIMIZED FILL - matching QGIS plugin logic exactly
     * Tests 4 anchor modes × 10 row offsets × 10 col offsets = 400 configurations
     */
    fillPolygonOptimized(polygon, config) {
        const panels = [];
        
        try {
            // 1. Apply edge margin buffer
            let buffered = turf.buffer(polygon, -config.edgeMargin / 1000, {units: 'kilometers'});
            
            if (!buffered) {
                console.warn('Buffer resulted in empty geometry');
                return panels;
            }

            // Handle GeometryCollection
            if (buffered.geometry.type === 'GeometryCollection') {
                const polys = buffered.geometry.geometries.filter(g => g.type === 'Polygon');
                if (polys.length === 0) return panels;
                buffered = turf.polygon(polys[0].coordinates);
            }

            // 2. Get bounding box
            const bbox = turf.bbox(buffered);
            const [minLng, minLat, maxLng, maxLat] = bbox;

            // 3. Calculate panel dimensions based on orientation
            const isVertical = config.orientation === 90;
            const panelW = isVertical ? config.panelWidth : config.panelLength;
            const panelH = isVertical ? config.panelLength : config.panelWidth;

            // 4. Conversion factors (degrees to meters)
            const latCenter = (minLat + maxLat) / 2;
            const metersPerDegreeLat = 111320;
            const metersPerDegreeLng = 111320 * Math.cos(latCenter * Math.PI / 180);

            // 5. Calculate steps
            const axialStepLen = (panelW + config.hSpacing) / metersPerDegreeLng;  // Step along rows
            const stepPerp = (panelH + config.vSpacing) / metersPerDegreeLat;      // Step between rows
            const panelLatSize = panelH / metersPerDegreeLat;
            const panelLngSize = panelW / metersPerDegreeLng;

            console.log('Optimization config:', {
                panelW: panelW.toFixed(2) + 'm',
                panelH: panelH.toFixed(2) + 'm',
                axialStepLen: (axialStepLen * metersPerDegreeLng).toFixed(2) + 'm',
                stepPerp: (stepPerp * metersPerDegreeLat).toFixed(2) + 'm',
                bbox: bbox.map(v => v.toFixed(6))
            });

            // 6. OPTIMIZATION LOOP - matching QGIS exactly
            const anchorModes = ['bottom_left', 'bottom_right', 'top_left', 'top_right'];
            const optimizationSteps = 10;  // Same as QGIS Config.OPTIMIZATION_STEPS
            
            let bestPanels = [];
            let bestConfig = null;
            
            console.log(`Starting optimization: ${anchorModes.length} anchors × ${optimizationSteps}² offsets = ${anchorModes.length * optimizationSteps * optimizationSteps} configurations`);

            // For each anchor mode
            for (const anchor of anchorModes) {
                // For each row offset (10 steps)
                for (let i = 0; i < optimizationSteps; i++) {
                    const rowOffset = (i / optimizationSteps) * stepPerp;
                    
                    // For each column offset (10 steps)
                    for (let j = 0; j < optimizationSteps; j++) {
                        const colOffset = (j / optimizationSteps) * axialStepLen;
                        
                        // Fill with this configuration
                        const testPanels = this.fillWithOffsets(
                            buffered,
                            minLat, maxLat, minLng, maxLng,
                            stepPerp, axialStepLen,
                            panelLatSize, panelLngSize,
                            rowOffset, colOffset,
                            anchor,
                            config
                        );
                        
                        // Keep best
                        if (testPanels.length > bestPanels.length) {
                            bestPanels = testPanels;
                            bestConfig = { anchor, rowOffset, colOffset, count: testPanels.length };
                            console.log(`  New best: ${testPanels.length} panels (${anchor}, row=${i}, col=${j})`);
                        }
                    }
                }
            }

            console.log('Best configuration:', bestConfig);
            return bestPanels;

        } catch (error) {
            console.error('Error in fillPolygonOptimized:', error);
            throw error;
        }
    },

    /**
     * Fill with specific offsets and anchor mode
     * WITH FINE SCAN to start each row at polygon edge
     */
    fillWithOffsets(buffered, minLat, maxLat, minLng, maxLng, 
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
            
            // FINE SCAN: Find the first valid position on this row
            const scanStep = axialStepLen / 50; // Ultra-fine scan (2% of panel width)
            let nextPanelLng = null; // Position for NEXT panel (after first)
            let firstPanelPlaced = false;
            
            // Scan to find the first valid position
            for (let lng = searchStartLng;
                 lngDirection > 0 ? (lng + panelLngSize <= searchEndLng) : (lng >= searchEndLng);
                 lng += lngDirection * scanStep) {
                
                const centerLng = lng + panelLngSize / 2;
                
                const rect = this.createRotatedRectangle(
                    [centerLng, centerLat],
                    panelLngSize,
                    panelLatSize,
                    config.orientation
                );
                
                if (this.isPanelFullyContained(rect, buffered)) {
                    // Add this first panel
                    panels.push({
                        geometry: rect,
                        type: 'full',
                        center: [centerLng, centerLat]
                    });
                    firstPanelPlaced = true;
                    
                    // Calculate position for NEXT panel: current position + panel width + spacing
                    nextPanelLng = lng + lngDirection * (panelLngSize + hSpacingLng);
                    break;
                }
            }
            
            // If no full panel fits at start, try half panel if allowed
            if (!firstPanelPlaced && config.allowHalf) {
                for (let lng = searchStartLng;
                     lngDirection > 0 ? (lng + halfPanelLngSize <= searchEndLng) : (lng >= searchEndLng);
                     lng += lngDirection * scanStep) {
                    
                    const centerLng = lng + halfPanelLngSize / 2;
                    
                    const halfRect = this.createRotatedRectangle(
                        [centerLng, centerLat],
                        halfPanelLngSize,
                        panelLatSize,
                        config.orientation
                    );
                    
                    if (this.isPanelFullyContained(halfRect, buffered)) {
                        panels.push({
                            geometry: halfRect,
                            type: 'half',
                            center: [centerLng, centerLat]
                        });
                        firstPanelPlaced = true;
                        
                        // Next panel position: current + half panel + spacing
                        nextPanelLng = lng + lngDirection * (halfPanelLngSize + hSpacingLng);
                        break;
                    }
                }
            }
            
            // If we found a valid start, continue filling this row with regular spacing
            if (nextPanelLng !== null) {
                let lng = nextPanelLng;
                
                while (lngDirection > 0 ? (lng + halfPanelLngSize <= searchEndLng) : (lng >= searchEndLng)) {
                    let centerLng = lng + panelLngSize / 2;
                    let placed = false;
                    
                    // Try full panel first (ONLY if it fits completely)
                    if ((lngDirection > 0 && lng + panelLngSize <= searchEndLng) || 
                        (lngDirection < 0 && lng >= searchEndLng + panelLngSize)) {
                        
                        const rect = this.createRotatedRectangle(
                            [centerLng, centerLat],
                            panelLngSize,
                            panelLatSize,
                            config.orientation
                        );
                        
                        if (this.isPanelFullyContained(rect, buffered)) {
                            panels.push({
                                geometry: rect,
                                type: 'full',
                                center: [centerLng, centerLat]
                            });
                            
                            // Advance by full panel + spacing
                            lng += lngDirection * (panelLngSize + hSpacingLng);
                            placed = true;
                            continue; // Go to next iteration immediately
                        }
                    }
                    
                    // If full panel didn't fit AND half panels allowed, try half panel
                    if (!placed && config.allowHalf && 
                        ((lngDirection > 0 && lng + halfPanelLngSize <= searchEndLng) || 
                         (lngDirection < 0 && lng >= searchEndLng + halfPanelLngSize))) {
                        
                        centerLng = lng + halfPanelLngSize / 2;
                        
                        const halfRect = this.createRotatedRectangle(
                            [centerLng, centerLat],
                            halfPanelLngSize,
                            panelLatSize,
                            config.orientation
                        );
                        
                        if (this.isPanelFullyContained(halfRect, buffered)) {
                            panels.push({
                                geometry: halfRect,
                                type: 'half',
                                center: [centerLng, centerLat]
                            });
                            
                            // Advance by HALF panel + spacing
                            lng += lngDirection * (halfPanelLngSize + hSpacingLng);
                            placed = true;
                            continue; // Go to next iteration immediately
                        }
                    }
                    
                    // If nothing placed, stop this row
                    if (!placed) {
                        break;
                    }
                }
            }
        }
        
        return panels;
    },

    /**
     * Add half panels at the end of each row
     */
    addHalfPanelsAtRowEnds(fullPanels, buffered, panelLatSize, panelLngSize, config, anchor, lngDirection) {
        const halfPanels = [];
        
        if (fullPanels.length === 0) return halfPanels;
        
        const halfPanelLngSize = panelLngSize / 2;
        const sampleLat = fullPanels[0]?.center[1] || 0;
        const metersPerDegreeLng = 111320 * Math.cos(sampleLat * Math.PI / 180);
        const hSpacingLng = config.hSpacing / metersPerDegreeLng;
        
        // Group panels by row
        const rows = new Map();
        fullPanels.forEach(panel => {
            const rowKey = Math.round(panel.center[1] * 100000);
            if (!rows.has(rowKey)) {
                rows.set(rowKey, []);
            }
            rows.get(rowKey).push(panel);
        });
        
        // For each row, try to add a half panel at the end
        rows.forEach((rowPanels, rowKey) => {
            if (rowPanels.length === 0) return;
            
            // Sort by longitude
            rowPanels.sort((a, b) => lngDirection * (a.center[0] - b.center[0]));
            
            // Get last panel
            const lastPanel = rowPanels[rowPanels.length - 1];
            const centerLat = lastPanel.center[1];
            
            // Calculate position for half panel
            const halfCenterLng = lastPanel.center[0] + 
                                 lngDirection * (panelLngSize/2 + hSpacingLng + halfPanelLngSize/2);
            
            const rect = this.createRotatedRectangle(
                [halfCenterLng, centerLat],
                halfPanelLngSize,
                panelLatSize,
                config.orientation
            );
            
            if (this.isPanelFullyContained(rect, buffered)) {
                halfPanels.push({
                    geometry: rect,
                    type: 'half',
                    center: [halfCenterLng, centerLat]
                });
            }
        });
        
        return halfPanels;
    },

    /**
     * Export panels to GeoJSON matching QGIS plugin format
     */
    exportToGeoJSON() {
        if (this.generatedPanels.length === 0) {
            GeoflowUtils.showToast('Aucun panneau à exporter', 'warning');
            return;
        }

        const config = this.getConfig();
        
        // Create FeatureCollection matching QGIS format
        const featureCollection = {
            type: 'FeatureCollection',
            crs: {
                type: 'name',
                properties: {
                    name: 'EPSG:4326'
                }
            },
            features: this.generatedPanels.map((panel, index) => ({
                type: 'Feature',
                id: index,
                properties: {
                    id: index,
                    table: panel.type === 'full' ? 'full table' : 'half table',
                    ilot: 1,
                    v_spacing: config.vSpacing,
                    length_m: panel.type === 'full' ? config.panelLength : config.panelLength / 2,
                    width_m: config.panelWidth,
                    area_m2: panel.type === 'full' 
                        ? config.panelLength * config.panelWidth 
                        : (config.panelLength / 2) * config.panelWidth,
                    orientation: config.orientation,
                    h_spacing: config.hSpacing
                },
                geometry: panel.geometry.geometry
            }))
        };

        // Create blob and download
        const jsonString = JSON.stringify(featureCollection, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `calepinage_${Date.now()}.geojson`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        GeoflowUtils.showToast(`${this.generatedPanels.length} panneau(x) exporté(s)`, 'success');
    },

    /**
     * Export statistics to CSV
     */
    exportStatsToCSV() {
        if (this.generatedPanels.length === 0) {
            GeoflowUtils.showToast('Aucune donnée à exporter', 'warning');
            return;
        }

        const config = this.getConfig();
        
        // Create CSV header
        let csv = 'id,type,length_m,width_m,area_m2,center_lng,center_lat,orientation,h_spacing,v_spacing,ilot\n';
        
        // Add data rows
        this.generatedPanels.forEach((panel, index) => {
            const type = panel.type === 'full' ? 'full table' : 'half table';
            const length = panel.type === 'full' ? config.panelLength : config.panelLength / 2;
            const width = config.panelWidth;
            const area = length * width;
            const [lng, lat] = panel.center;
            
            csv += `${index},"${type}",${length},${width},${area},${lng},${lat},${config.orientation},${config.hSpacing},${config.vSpacing},1\n`;
        });

        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `calepinage_stats_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        GeoflowUtils.showToast('Statistiques exportées', 'success');
    },

    /**
     * Show progress bar
     */
    showProgress() {
        const progressDiv = document.getElementById('calepinage-progress');
        const statsDiv = document.getElementById('calepinage-stats');
        
        if (progressDiv) {
            progressDiv.style.display = 'block';
        }
        if (statsDiv) {
            statsDiv.style.display = 'none';
        }
        
        // Disable generate button during calculation
        const generateBtn = document.getElementById('calepinage-generate');
        if (generateBtn) {
            generateBtn.disabled = true;
        }
    },

    /**
     * Update progress bar
     */
    updateProgress(percent, message, details = '') {
        const progressBar = document.getElementById('progress-bar');
        const progressPercent = document.getElementById('progress-percent');
        const progressMessage = document.getElementById('progress-message');
        const progressDetails = document.getElementById('progress-details');
        
        if (progressBar) {
            progressBar.style.width = percent + '%';
        }
        if (progressPercent) {
            progressPercent.textContent = Math.round(percent) + '%';
        }
        if (progressMessage) {
            progressMessage.textContent = message;
        }
        if (progressDetails && details) {
            progressDetails.textContent = details;
        }
    },

    /**
     * Hide progress bar
     */
    hideProgress() {
        const progressDiv = document.getElementById('calepinage-progress');
        if (progressDiv) {
            progressDiv.style.display = 'none';
        }
        
        // Re-enable generate button
        const generateBtn = document.getElementById('calepinage-generate');
        if (generateBtn) {
            generateBtn.disabled = false;
        }
    },
    async generate() {
        if (!GeoflowDraw || !GeoflowDraw.drawnItems) {
            GeoflowUtils.showToast('Module de dessin non disponible', 'error');
            return;
        }

        const drawnLayers = GeoflowDraw.drawnItems.getLayers();
        if (drawnLayers.length === 0) {
            GeoflowUtils.showToast('Dessinez d\'abord une zone sur la carte', 'warning');
            return;
        }

        const layer = drawnLayers[drawnLayers.length - 1];
        const geoJson = layer.toGeoJSON();

        if (geoJson.geometry.type !== 'Polygon' && geoJson.geometry.type !== 'MultiPolygon') {
            GeoflowUtils.showToast('Sélectionnez un polygone valide', 'warning');
            return;
        }

        const config = this.getConfig();
        const errors = this.validateConfig(config);

        if (errors.length > 0) {
            GeoflowUtils.showToast(errors.join('<br>'), 'error');
            return;
        }

        try {
            let polygon = geoJson;
            if (geoJson.geometry.type === 'MultiPolygon') {
                const polygons = geoJson.geometry.coordinates.map((coords, i) => 
                    turf.polygon(coords, {index: i})
                );
                polygon = polygons.reduce((largest, current) => {
                    return turf.area(current) > turf.area(largest) ? current : largest;
                });
            }

            // Try to use Web Worker if available
            if (typeof Worker !== 'undefined' && this.useWebWorker) {
                this.generateWithWorker(polygon, config);
            } else {
                // Fallback to main thread
                this.generateInMainThread(polygon, config);
            }

        } catch (error) {
            GeoflowUtils.hideLoading();
            console.error('Erreur génération calepinage:', error);
            GeoflowUtils.showToast('Erreur: ' + error.message, 'error');
        }
    },

    /**
     * Generate using Web Worker (non-blocking)
     */
    generateWithWorker(polygon, config) {
        this.showProgress();
        this.updateProgress(0, 'Initialisation...', 'Démarrage du calcul en arrière-plan');
        
        // Create worker
        const worker = new Worker('js/calepinage-worker.js');
        
        // Handle messages from worker
        worker.onmessage = (e) => {
            const { type } = e.data;
            
            if (type === 'PROGRESS') {
                const { progress, message } = e.data;
                this.updateProgress(progress, 'Optimisation en cours', message);
                
            } else if (type === 'RESULT') {
                const { panels, bestConfig, totalTested, error } = e.data;
                
                worker.terminate(); // Clean up worker
                
                if (error) {
                    this.hideProgress();
                    GeoflowUtils.showToast('Erreur: ' + error, 'error');
                    return;
                }
                
                if (panels.length === 0) {
                    this.hideProgress();
                    GeoflowUtils.showToast('Aucun panneau généré', 'warning');
                    return;
                }
                
                console.log('Best configuration:', bestConfig);
                console.log(`Tested ${totalTested} configurations`);
                
                this.updateProgress(100, 'Finalisation...', 'Affichage des résultats');
                
                // Small delay to show 100% before hiding
                setTimeout(() => {
                    this.displayPanels(panels, config);
                    this.displayStats(panels, config, polygon);
                    this.hideProgress();
                    
                    GeoflowUtils.showToast(
                        `${panels.length} panneau(x) généré(s) • ${totalTested} configs testées`, 
                        'success'
                    );
                }, 300);
            }
        };
        
        // Handle worker errors
        worker.onerror = (error) => {
            console.error('Worker error:', error);
            worker.terminate();
            this.hideProgress();
            
            // Fallback to main thread
            console.log('Worker failed, falling back to main thread...');
            GeoflowUtils.showToast('Calcul en thread principal...', 'info');
            this.generateInMainThread(polygon, config);
        };
        
        // Send work to worker
        worker.postMessage({
            type: 'OPTIMIZE',
            data: {
                polygon: polygon,
                config: config
            }
        });
    },

    /**
     * Generate in main thread (blocking, fallback)
     */
    async generateInMainThread(polygon, config) {
        this.showProgress();
        this.updateProgress(0, 'Calcul en cours...', 'Traitement dans le thread principal');
        
        // Small delay to let UI update
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            console.log('🔄 Starting optimization in main thread...');
            const startTime = performance.now();
            
            // Simulate progress updates (since we can't get real progress in main thread)
            const progressInterval = setInterval(() => {
                const elapsed = (performance.now() - startTime) / 1000;
                const estimatedProgress = Math.min(90, (elapsed / 5) * 100); // Estimate 5s total
                this.updateProgress(
                    estimatedProgress, 
                    'Calcul en cours...', 
                    `${Math.round(elapsed)}s écoulées`
                );
            }, 200);
            
            const panels = this.fillPolygonOptimized(polygon, config);
            const duration = ((performance.now() - startTime) / 1000).toFixed(2);
            
            clearInterval(progressInterval);
            
            console.log(`✅ Optimization complete in ${duration}s: ${panels.length} panels`);

            if (panels.length === 0) {
                this.hideProgress();
                GeoflowUtils.showToast('Aucun panneau généré', 'warning');
                return;
            }

            this.updateProgress(100, 'Terminé !', `${panels.length} panneaux générés en ${duration}s`);
            
            setTimeout(() => {
                this.displayPanels(panels, config);
                this.displayStats(panels, config, polygon);
                this.hideProgress();
                
                GeoflowUtils.showToast(`${panels.length} panneau(x) généré(s) en ${duration}s`, 'success');
            }, 300);

        } catch (error) {
            this.hideProgress();
            console.error('Erreur génération:', error);
            GeoflowUtils.showToast('Erreur: ' + error.message, 'error');
        }
    },

    // Flag to enable/disable Web Worker (default: true)
    useWebWorker: true,

    displayPanels(panels, config) {
        this.clearResults();

        this.resultLayer = L.featureGroup();

        panels.forEach((panel, i) => {
            const color = panel.type === 'full' ? '#2563eb' : '#06b6d4';
            const label = panel.type === 'full' ? 'Table entière' : 'Demi-table';

            const layer = L.geoJSON(panel.geometry, {
                style: {
                    color: color,
                    weight: 1,
                    fillColor: color,
                    fillOpacity: 0.3
                }
            });

            const panelArea = panel.type === 'full' 
                ? config.panelLength * config.panelWidth 
                : (config.panelLength / 2) * config.panelWidth;

            layer.bindPopup(`
                <div class="feature-popup">
                    <h6><i class="fa-solid fa-solar-panel"></i> Panneau #${i + 1}</h6>
                    <table>
                        <tr><td>Type</td><td>${label}</td></tr>
                        <tr><td>Surface</td><td>${panelArea.toFixed(2)} m²</td></tr>
                        <tr><td>Orientation</td><td>${config.orientation === 0 ? 'Horizontal' : 'Vertical'}</td></tr>
                    </table>
                </div>
            `);

            this.resultLayer.addLayer(layer);
        });

        GeoflowDraw.drawnItems.addLayer(this.resultLayer);
        this.generatedPanels = panels;

        // Enable export buttons
        document.getElementById('calepinage-export-geojson').disabled = false;

        if (typeof GeoflowLegend !== 'undefined') {
            GeoflowLegend.requestUpdate();
        }
    },

    displayStats(panels, config, polygon) {
        const fullPanels = panels.filter(p => p.type === 'full');
        const halfPanels = panels.filter(p => p.type === 'half');

        const fullArea = fullPanels.length * config.panelLength * config.panelWidth;
        const halfArea = halfPanels.length * (config.panelLength / 2) * config.panelWidth;
        const totalPanelArea = fullArea + halfArea;

        const zoneArea = turf.area(polygon);
        const coverageRate = (totalPanelArea / zoneArea) * 100;

        document.getElementById('stat-full').textContent = fullPanels.length;
        document.getElementById('stat-half').textContent = halfPanels.length;
        document.getElementById('stat-area').textContent = totalPanelArea.toFixed(0) + ' m²';
        document.getElementById('stat-coverage').textContent = coverageRate.toFixed(1) + '%';

        document.getElementById('calepinage-stats').style.display = 'block';
    },

    clearResults() {
        if (this.resultLayer) {
            GeoflowDraw.drawnItems.removeLayer(this.resultLayer);
            this.resultLayer = null;
        }

        this.generatedPanels = [];

        // Disable export buttons
        const exportGeoJsonBtn = document.getElementById('calepinage-export-geojson');
        if (exportGeoJsonBtn) exportGeoJsonBtn.disabled = true;

        const statsDiv = document.getElementById('calepinage-stats');
        if (statsDiv) {
            statsDiv.style.display = 'none';
        }

        if (typeof GeoflowLegend !== 'undefined') {
            GeoflowLegend.requestUpdate();
        }

        GeoflowUtils.showToast('Résultats effacés', 'success');
    }
};