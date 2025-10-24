/**
 * Geoflow Calepinage Module - Version optimisée avec Web Worker uniquement
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
        allowHalf: false,
        calculateCoverage: false
    },

    // Stockage des résultats
    generatedPanels: [],
    resultLayer: null,

    /**
     * Get panel content HTML
     */
    getPanelContent() {
        return `
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
                        <i class="fa-solid fa-rotate"></i> Orientation Nord-Sud (mode Tracker)
                    </label>
                </div>
                <div class="form-check" style="padding-left: 1.5rem; margin-bottom: 6px;">
                    <input class="form-check-input" type="checkbox" id="calepinage-half">
                    <label class="form-check-label" for="calepinage-half" style="font-size: 0.85rem;">
                        <i class="fa-solid fa-scissors"></i> Autoriser les demi-tables
                    </label>
                </div>
                <div class="form-check" style="padding-left: 1.5rem;">
                    <input class="form-check-input" type="checkbox" id="calepinage-recouvrement">
                    <label class="form-check-label" for="calepinage-recouvrement" style="font-size: 0.85rem;">
                        <i class="fa-solid fa-calculator"></i> Calculer le recouvrement
                    </label>
                </div>
            </div>

            <!-- Boutons d'action -->
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                <button class="btn btn-sm btn-primary flex-fill" id="calepinage-generate">
                    <i class="fa-solid fa-solar-panel"></i> Générer
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
            <div id="calepinage-stats" style="display: none; margin-top: 14px;">
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
                <div style="display: flex; gap: 8px; margin-top: 10px;">
                    <button class="btn btn-sm btn-success flex-fill" id="calepinage-export-geojson" disabled>
                        <i class="fa-solid fa-download"></i> Panneaux
                    </button>
                    <button class="btn btn-sm btn-warning flex-fill" id="covering-export-geojson" disabled>
                        <i class="fa-solid fa-download"></i> Recouvrement
                    </button>
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
        
        const exportCoveringBtn = document.getElementById('covering-export-geojson');
        if (exportCoveringBtn) {
            exportCoveringBtn.addEventListener('click', () => {
                this.exportCoveringToGeoJSON();
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
            allowHalf: document.getElementById('calepinage-half')?.checked || false,
            calculateCoverage: document.getElementById('calepinage-recouvrement')?.checked || false
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
                    h_spacing: config.hSpacing,
                    source: '©Geoflow',
                    date: new Date().toISOString()
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

        GeoflowUtils.showToast('Couche des panneaux exportée', 'success');
    },
    
    /**
     * Export boundary polygon (covering) to GeoJSON
     */
    exportCoveringToGeoJSON() {
        if (!this.boundaryPolygon) {
            GeoflowUtils.showToast('Aucun polygone de recouvrement disponible', 'warning');
            return;
        }

        // Lecture des valeurs depuis le panneau de stats
        const coverageValue = document.getElementById('stat-coverage')?.textContent?.replace('%', '').trim() || null;
        const fullCount = parseInt(document.getElementById('stat-full')?.textContent || 0);
        const halfCount = parseInt(document.getElementById('stat-half')?.textContent || 0);
        const areaText = document.getElementById('stat-area')?.textContent?.replace('m²', '').trim() || '0';
        const areaM2 = parseFloat(areaText.replace(',', '.')) || 0;

        // Création de la feature GeoJSON
        const featureCollection = {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                id: 0,
                properties: {
                    id: 0,
                    area_m2: areaM2,
                    full_table: fullCount,
                    half_table: halfCount,
                    covering: coverageValue ? parseFloat(coverageValue) : null,
                    source: '©Geoflow',
                    date: new Date().toISOString()
                },
                geometry: this.boundaryPolygon.geometry
            }]
        };

        // Export en .geojson
        const jsonString = JSON.stringify(featureCollection, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `covering_${Date.now()}.geojson`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        GeoflowUtils.showToast('Polygone de recouvrement exporté avec statistiques', 'success');
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

    /**
     * Main generate function - Uses Web Worker only
     */
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

            // Check if Web Worker is supported
            if (typeof Worker === 'undefined') {
                this.hideProgress();
                GeoflowUtils.showToast('Les Web Workers ne sont pas supportés par votre navigateur. Cette fonctionnalité nécessite un navigateur moderne.', 'error');
                return;
            }

            // Use Web Worker
            this.generateWithWorker(polygon, config);

        } catch (error) {
            this.hideProgress();
            console.error('Erreur génération calepinage:', error);
            GeoflowUtils.showToast('Erreur: ' + error.message, 'error');
        }
    },

    /**
     * Generate using Web Worker
     */
    generateWithWorker(polygon, config) {
        this.showProgress();
        this.updateProgress(0, 'Initialisation...', 'Démarrage du calcul en arrière-plan');
        
        // Create worker
        let worker;
        try {
            worker = new Worker('js/calepinage-worker.js');
        } catch (error) {
            this.hideProgress();
            console.error('Erreur lors de la création du Worker:', error);
            GeoflowUtils.showToast(
                'Impossible de charger le module de calcul. Vérifiez que le fichier calepinage-worker.js est présent dans le dossier js/', 
                'error'
            );
            return;
        }
        
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
                    GeoflowUtils.showToast('Erreur lors du calcul: ' + error, 'error');
                    return;
                }
                
                if (panels.length === 0) {
                    this.hideProgress();
                    GeoflowUtils.showToast('Aucun panneau généré avec les paramètres actuels', 'warning');
                    return;
                }
                
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
            console.error('Erreur du Web Worker:', error);
            worker.terminate();
            this.hideProgress();
            
            GeoflowUtils.showToast(
                'Erreur lors du calcul dans le Web Worker. Vérifiez la console pour plus de détails.', 
                'error'
            );
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
     * Display panels on the map
     */
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
                    fillOpacity: 0.8
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
   
    /**
     * Calculate exact coverage using tracing algorithm
     * Port of QGIS plugin coverage_logic.py
     */
    calculateExactCoverage(panels, config, originalPolygon) {
        try {
            console.log('🎯 Calculating exact coverage with tracing algorithm...');
            
            // ENABLE DEBUG MODE - uncomment to see detailed segment visualization
            //GeoflowCoverageTracing.enableDebug(GeoflowMap.map, this.resultLayer);
            
            // Increase max iterations for complex layouts
            GeoflowCoverageTracing.maxIterations = 50000;
            
            // Trace boundary using the exact QGIS algorithm
            const boundaryPoints = GeoflowCoverageTracing.traceCoverageBoundary(
                panels, 
                config.hSpacing, 
                config.vSpacing, 
                config.orientation
            );
            
            // Disable debug after tracing
            //GeoflowCoverageTracing.disableDebug();
            
            if (!boundaryPoints || boundaryPoints.length < 4) {
                console.warn('⚠️ Tracing failed, falling back to concave hull');
                return this.calculateCoverageWithConcaveHull(panels, config, originalPolygon);
            }
            
            // Create polygon from traced points
            const boundaryPolygon = turf.polygon([boundaryPoints]);
            
            // Calculate areas
            const hullArea = turf.area(boundaryPolygon);
            const totalPanelArea = this.calculateTotalPanelArea(panels, config);
            
            // Calculate coverage rate
            const coverageRate = (totalPanelArea / hullArea) * 100;
            
            console.log(`✅ Exact coverage: ${coverageRate.toFixed(1)}% (${totalPanelArea.toFixed(0)}m² / ${hullArea.toFixed(0)}m²)`);
            
            return {
                rate: coverageRate,
                hullArea: hullArea,
                panelArea: totalPanelArea,
                hull: boundaryPolygon,
                method: 'exact_tracing',
                tracedPoints: boundaryPoints.length
            };
            
        } catch (error) {
            console.error('❌ Error in exact coverage calculation:', error);
            console.error(error.stack);
            return this.calculateCoverageWithConcaveHull(panels, config, originalPolygon);
        }
    },
    
    /**
     * Calculate coverage with concave hull (fallback method)
     */
    calculateCoverageWithConcaveHull(panels, config, originalPolygon) {
        if (panels.length === 0) return { rate: 0, hullArea: 0, panelArea: 0, hull: null, method: 'none' };

        try {
            console.log('📐 Calculating coverage with concave hull (fallback)...');
            
            // Extract all panel corner points
            const allPoints = [];
            panels.forEach(panel => {
                const coords = panel.geometry.geometry.coordinates[0];
                coords.forEach(coord => {
                    allPoints.push(turf.point(coord));
                });
            });

            // Create FeatureCollection
            const pointCollection = turf.featureCollection(allPoints);

            // Calculate concave hull
            const maxEdgeKm = Math.max(config.panelLength, config.panelWidth) / 500;
            let hull = turf.concave(pointCollection, { maxEdge: maxEdgeKm, units: 'kilometers' });

            // Fallback to convex hull if concave fails
            if (!hull) {
                console.warn('⚠️ Concave hull failed, using convex hull');
                hull = turf.convex(pointCollection);
            }

            if (!hull) {
                console.error('❌ Both concave and convex hull failed');
                return { rate: 0, hullArea: 0, panelArea: 0, hull: null, method: 'failed' };
            }

            // Calculate areas
            const hullArea = turf.area(hull);
            const totalPanelArea = this.calculateTotalPanelArea(panels, config);

            // Calculate coverage rate
            const coverageRate = (totalPanelArea / hullArea) * 100;

            console.log(`✅ Concave hull coverage: ${coverageRate.toFixed(1)}%`);

            return {
                rate: coverageRate,
                hullArea: hullArea,
                panelArea: totalPanelArea,
                hull: hull,
                method: 'concave_hull'
            };

        } catch (error) {
            console.error('❌ Error calculating coverage with concave hull:', error);
            
            // Last resort: use basic calculation
            const totalPanelArea = this.calculateTotalPanelArea(panels, config);
            const zoneArea = originalPolygon ? turf.area(originalPolygon) : totalPanelArea;
            const basicRate = (totalPanelArea / zoneArea) * 100;
            
            return {
                rate: basicRate,
                hullArea: zoneArea,
                panelArea: totalPanelArea,
                hull: originalPolygon,
                method: 'basic'
            };
        }
    },
    
    /**
     * Calculate total panel area
     */
    calculateTotalPanelArea(panels, config) {
        const fullArea = panels.filter(p => p.type === 'full').length * 
                         config.panelLength * config.panelWidth;
        const halfArea = panels.filter(p => p.type === 'half').length * 
                         (config.panelLength / 2) * config.panelWidth;
        return fullArea + halfArea;
    },
    
    /**
     * Display statistics with exact coverage calculation
     */
    displayStats(panels, config, polygon) {
        const fullPanels = panels.filter(p => p.type === 'full');
        const halfPanels = panels.filter(p => p.type === 'half');

        // Calcul de la surface des panneaux
        const surfaceFull = config.panelLength * config.panelWidth;  // m²
        const surfaceHalf = (config.panelLength / 2) * config.panelWidth;  // m²
        const countFull = fullPanels.length;
        const countHalf = halfPanels.length;
        
        // Surface totale des panneaux
        const totalPanelArea = (countFull * surfaceFull) + (countHalf * surfaceHalf);
        
        // Update stats display - partie basique
        document.getElementById('stat-full').textContent = countFull;
        document.getElementById('stat-half').textContent = countHalf;
        document.getElementById('stat-area').textContent = totalPanelArea.toFixed(0) + ' m²';

        // Calcul du recouvrement seulement si demandé
        if (config.calculateCoverage) {
            // Utiliser l'algorithme de traçage exact
            const coverageResult = this.calculateExactCoverage(panels, config, polygon);
            
            const methodLabels = {
                'exact_tracing': '✓ Traçage exact',
                'concave_hull': '⚠ Enveloppe concave',
                'basic': '⚠ Calcul basique',
                'failed': '✗ Échec',
                'none': '-'
            };
            
            const methodLabel = methodLabels[coverageResult.method] || coverageResult.method;
            
            // Surface de l'enveloppe en m²
            const hullAreaM2 = coverageResult.hullArea;
            
            // Taux de recouvrement
            const tauxRecouvrement = (totalPanelArea * 100) / hullAreaM2;
            
            console.log(`📊 Calcul du taux de recouvrement:`);
            console.log(`   Tables entières: ${countFull} × ${surfaceFull.toFixed(2)}m² = ${(countFull * surfaceFull).toFixed(2)}m²`);
            console.log(`   Demi-tables: ${countHalf} × ${surfaceHalf.toFixed(2)}m² = ${(countHalf * surfaceHalf).toFixed(2)}m²`);
            console.log(`   Surface panneaux totale: ${totalPanelArea.toFixed(2)}m²`);
            console.log(`   Surface enveloppe: ${hullAreaM2.toFixed(2)}m²`);
            console.log(`   Taux: ${tauxRecouvrement.toFixed(1)}%`);
            
            // Afficher l'enveloppe sur la carte
            if (coverageResult.hull && this.resultLayer) {
                this.boundaryPolygon = coverageResult.hull;
                document.getElementById('covering-export-geojson').disabled = false;
                
                const hullStyle = {
                    color: '#ef4444',
                    weight: 2,
                    fillColor: 'transparent',
                    opacity: 0.8
                };
                
                const hullLayer = L.geoJSON(coverageResult.hull, {
                    style: hullStyle
                });
                
                hullLayer.bindPopup(`
                    <div class="feature-popup">
                        <h6><i class="fa-solid fa-vector-square"></i> Enveloppe de recouvrement</h6>
                        <table>
                            <tr>
                                <td>Méthode</td>
                                <td style="font-weight: 600;">${methodLabel}</td>
                            </tr>
                            ${coverageResult.tracedPoints ? `
                            <tr>
                                <td>Points tracés</td>
                                <td>${coverageResult.tracedPoints}</td>
                            </tr>
                            ` : ''}
                            <tr>
                                <td>Tables entières</td>
                                <td>${countFull}</td>
                            </tr>
                            <tr>
                                <td>Demi-tables</td>
                                <td>${countHalf}</td>
                            </tr>
                            <tr>
                                <td>Surface panneaux</td>
                                <td>${totalPanelArea.toFixed(0)} m²</td>
                            </tr>
                            <tr>
                                <td>Surface enveloppe</td>
                                <td>${hullAreaM2.toFixed(0)} m²</td>
                            </tr>
                            <tr>
                                <td>Taux</td>
                                <td style="font-weight: 600; color: #10b981;">${tauxRecouvrement.toFixed(1)}%</td>
                            </tr>
                        </table>
                    </div>
                `);
                
                this.resultLayer.addLayer(hullLayer);
            }

            document.getElementById('stat-coverage').textContent = tauxRecouvrement.toFixed(1) + '%';
        } else {
            // Si le calcul n'est pas demandé, afficher "non calculé"
            document.getElementById('stat-coverage').textContent = 'non calculé';
            document.getElementById('stat-coverage').style.color = 'var(--text-secondary)';
        }

        document.getElementById('calepinage-stats').style.display = 'block';
    },

    /**
     * Clear results
     */
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