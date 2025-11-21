/**
 * Geoflow Calepinage Module - Version optimisée avec Web Worker uniquement
 * Generates solar panel layouts within polygons
 * Matches QGIS plugin logic: 4 anchors × 10 row offsets × 10 col offsets = 400 configs
 */

const GeoflowCalepinage = {
    // Mode actif: 'solar' ou 'plantation'
    currentMode: 'solar',
    
    // Modèles de panneaux solaires prédéfinis
    solarPanelModels: {
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

    // Modèles d'arbres fruitiers prédéfinis
    plantationModels: {
        'custom': {
            name: 'Saisie manuelle',
            diameter: null
        },
        'pommier': {
            name: 'Pommier',
            diameter: 6,
            description: 'Couronne adulte ~6m'
        },
        'poirier': {
            name: 'Poirier',
            diameter: 5,
            description: 'Couronne adulte ~5m'
        },
        'cerisier': {
            name: 'Cerisier',
            diameter: 8,
            description: 'Couronne adulte ~8m'
        },
        'prunier': {
            name: 'Prunier',
            diameter: 5,
            description: 'Couronne adulte ~5m'
        },
        'abricotier': {
            name: 'Abricotier',
            diameter: 6,
            description: 'Couronne adulte ~6m'
        },
        'pecher': {
            name: 'Pêcher',
            diameter: 4,
            description: 'Couronne adulte ~4m'
        },
        'olivier': {
            name: 'Olivier',
            diameter: 7,
            description: 'Couronne adulte ~7m'
        },
        'noyer': {
            name: 'Noyer',
            diameter: 12,
            description: 'Couronne adulte ~12m'
        },
        'chataignier': {
            name: 'Châtaignier',
            diameter: 15,
            description: 'Couronne adulte ~15m'
        }
    },

    // Configuration par défaut
    defaultConfig: {
        solar: {
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
        plantation: {
            model: 'custom',
            treeDiameter: 6.0,
            hSpacing: 8.0,
            vSpacing: 8.0,
            edgeMargin: 1.0,
            orientation: 0,
            calculateCoverage: false
        }
    },

    // Stockage des résultats
    generatedPanels: [],
    resultLayer: null,

    /**
     * Get panel content HTML with tabs
     */
    getPanelContent() {
        return `
            <!-- Onglets de sélection du mode -->
            <div style="margin-bottom: 14px;">
				<label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
					Type de calepinage
				</label>
				<div class="tool-grid" style="grid-template-columns: repeat(3, 1fr);">
					<div class="tool-card mode-card ${this.currentMode === 'solar' ? 'active' : ''}" data-mode="solar">
						<i class="fa-solid fa-solar-panel"></i>
						<div class="tool-card-label">Panneaux</div>
					</div>
					<div class="tool-card mode-card ${this.currentMode === 'plantation' ? 'active' : ''}" data-mode="plantation">
						<i class="fa-solid fa-tree"></i>
						<div class="tool-card-label">Plantations</div>
					</div>
					<div class="tool-card mode-card" data-mode="future" style="opacity: 0.4; cursor: not-allowed;">
						<i class="fa-solid fa-plus"></i>
						<div class="tool-card-label">À venir</div>
					</div>
				</div>
			</div>

            <!-- Contenu pour panneaux solaires -->
            <div id="solar-content" style="display: ${this.currentMode === 'solar' ? 'block' : 'none'};">
                ${this.getSolarContent()}
            </div>

            <!-- Contenu pour plantations -->
            <div id="plantation-content" style="display: ${this.currentMode === 'plantation' ? 'block' : 'none'};">
                ${this.getPlantationContent()}
            </div>

            <!-- Barre de progression (commune) -->
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

            <!-- Statistiques (communes) -->
            <div id="calepinage-stats" style="display: none; margin-top: 14px;">
                <div style="padding: 12px; background: var(--hover-bg); border-radius: 8px; border-left: 3px solid var(--primary);">
                    <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">
                        <i class="fa-solid fa-chart-simple"></i> Résultats
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                        <div>
                            <div style="font-size: 0.7rem; color: var(--text-secondary);" id="stat-full-label">Tables entières</div>
                            <div style="font-size: 1rem; font-weight: 600; color: var(--primary);" id="stat-full">0</div>
                        </div>
                        <div>
                            <div style="font-size: 0.7rem; color: var(--text-secondary);" id="stat-half-label">Demi-tables</div>
                            <div style="font-size: 1rem; font-weight: 600; color: #3b82f6;" id="stat-half">0</div>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <div>
                            <div style="font-size: 0.7rem; color: var(--text-secondary);" id="stat-area-label">Surface</div>
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
                        <i class="fa-solid fa-download"></i> <span id="export-label">Panneaux</span>
                    </button>
                    <button class="btn btn-sm btn-warning flex-fill" id="covering-export-geojson" disabled>
                        <i class="fa-solid fa-download"></i> Recouvrement
                    </button>
                </div>
            </div>
        `;
    },
	
	/**
     * Get solar panel content
     */
    getSolarContent() {
        const config = this.defaultConfig.solar;
        
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
                    <label style="display: block; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px;">
                        Longueur (m)
                    </label>
                    <input type="number" id="calepinage-length" class="form-control form-control-sm" 
                           value="${config.panelLength}" step="0.1" min="0.1">
                </div>
                <div>
                    <label style="display: block; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px;">
                        Largeur (m)
                    </label>
                    <input type="number" id="calepinage-width" class="form-control form-control-sm" 
                           value="${config.panelWidth}" step="0.1" min="0.1">
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
                               value="${config.hSpacing}" step="0.1" min="0">
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px;">
                            Interrang (m)
                        </label>
                        <input type="number" id="calepinage-v-spacing" class="form-control form-control-sm" 
                               value="${config.vSpacing}" step="0.1" min="0">
                    </div>
                </div>
            </div>

            <!-- Marge de sécurité -->
            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 0.75rem; color: var(--text-primary); margin-bottom: 6px;">
                    Marge de sécurité (m)
                </label>
                <input type="number" id="calepinage-margin" class="form-control form-control-sm" 
                       value="${config.edgeMargin}" step="0.1" min="0">
            </div>

            <!-- Options -->
            <div style="margin-bottom: 14px;">
                <div class="form-check" style="margin-bottom: 6px;">
                    <input class="form-check-input" type="checkbox" id="calepinage-tracker">
                    <label class="form-check-label" for="calepinage-tracker" style="font-size: 0.85rem;">
                        <i class="fa-solid fa-rotate"></i> Orientation Nord-Sud (mode Tracker)
                    </label>
                </div>
                <div class="form-check" style="margin-bottom: 6px;">
                    <input class="form-check-input" type="checkbox" id="calepinage-half">
                    <label class="form-check-label" for="calepinage-half" style="font-size: 0.85rem;">
                        <i class="fa-solid fa-scissors"></i> Autoriser les demi-tables
                    </label>
                </div>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="calepinage-recouvrement">
                    <label class="form-check-label" for="calepinage-recouvrement" style="font-size: 0.85rem;">
                        <i class="fa-solid fa-calculator"></i> Calculer le recouvrement
                    </label>
                </div>
            </div>

            <!-- Boutons d'action -->
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                <button class="btn btn-sm btn-primary flex-fill" id="calepinage-generate">
                    <i class="fa-solid fa-grip"></i> Générer
                </button>
                <button class="btn btn-sm btn-danger" id="calepinage-clear" style="width: 44px;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
    },

    /**
     * Get plantation content
     */
    getPlantationContent() {
        const config = this.defaultConfig.plantation;
        
        return `
            <!-- Sélection de l'espèce -->
            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
                    Espèce d'arbre
                </label>
                <select id="plantation-model" class="form-select form-select-sm">
                    <option value="custom">Saisie manuelle</option>
                    <option value="pommier">Pommier (couronne ~6m)</option>
                    <option value="poirier">Poirier (couronne ~5m)</option>
                    <option value="cerisier">Cerisier (couronne ~8m)</option>
                    <option value="prunier">Prunier (couronne ~5m)</option>
                    <option value="abricotier">Abricotier (couronne ~6m)</option>
                    <option value="pecher">Pêcher (couronne ~4m)</option>
                    <option value="olivier">Olivier (couronne ~7m)</option>
                    <option value="noyer">Noyer (couronne ~12m)</option>
                    <option value="chataignier">Châtaignier (couronne ~15m)</option>
                </select>
            </div>

            <!-- Dimensions -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px;">
                <div>
                    <label style="display: block; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px;">
                        Diamètre (m)
                    </label>
                    <input type="number" id="plantation-diameter" class="form-control form-control-sm" 
                       value="${config.treeDiameter}" step="0.5" min="0.5">
                </div>
                <div>
               
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
                            Entre arbres (m)
                        </label>
                        <input type="number" id="plantation-h-spacing" class="form-control form-control-sm" 
                               value="${config.hSpacing}" step="0.5" min="0">
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px;">
                            Interrang (m)
                        </label>
                        <input type="number" id="plantation-v-spacing" class="form-control form-control-sm" 
                               value="${config.vSpacing}" step="0.5" min="0">
                    </div>
                </div>
            </div>

            <!-- Marge de sécurité -->
            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 0.75rem; color: var(--text-primary); margin-bottom: 6px;">
                    Marge de sécurité (m)
                </label>
                <input type="number" id="plantation-margin" class="form-control form-control-sm" 
                       value="${config.edgeMargin}" step="0.5" min="0">
            </div>

            <!-- Options -->
            <div style="margin-bottom: 14px;">
                <div class="form-check" style="padding-left: 1.5rem;">
                    <input class="form-check-input" type="checkbox" id="plantation-recouvrement">
                    <label class="form-check-label" for="plantation-recouvrement" style="font-size: 0.85rem;">
                        <i class="fa-solid fa-calculator"></i> Calculer le recouvrement
                    </label>
                </div>
            </div>

            <!-- Boutons d'action -->
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                <button class="btn btn-sm btn-primary flex-fill" id="plantation-generate">
                    <i class="fa-solid fa-grip"></i> Générer
                </button>
                <button class="btn btn-sm btn-danger" id="plantation-clear" style="width: 44px;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
    },

    /**
     * Attach event listeners
     */
    attachListeners() {
		// Mode cards
		document.querySelectorAll('.mode-card').forEach(card => {
			card.addEventListener('click', (e) => {
				const mode = e.currentTarget.dataset.mode;
				this.switchMode(mode);
			});
		});

		// 🔧 FIX : Délégation d'événements pour les boutons generate et clear
		const panelContent = document.getElementById('panel-content');
		
		panelContent.addEventListener('click', (e) => {
			const target = e.target.closest('button');
			if (!target) return;

			// Bouton Générer (solar ou plantation)
			if (target.id === 'calepinage-generate' || target.id === 'plantation-generate') {
				this.generate();
			}
			
			// Bouton Effacer (solar ou plantation)
			if (target.id === 'calepinage-clear' || target.id === 'plantation-clear') {
				this.clearResults();
			}
			
			// Bouton Export panneaux/plantations
			if (target.id === 'calepinage-export-geojson') {
				this.exportToGeoJSON();
			}
			
			// Bouton Export recouvrement
			if (target.id === 'covering-export-geojson') {
				this.exportCoveringToGeoJSON();
			}
		});

		// Délégation pour les selects
		panelContent.addEventListener('change', (e) => {
			if (e.target.id === 'calepinage-model') {
				this.onSolarModelChange(e.target.value);
			}
			
			if (e.target.id === 'plantation-model') {
				this.onPlantationModelChange(e.target.value);
			}
			
			// Tracker checkbox logic
			if (e.target.id === 'calepinage-tracker') {
				const halfCheck = document.getElementById('calepinage-half');
				if (halfCheck) {
					if (e.target.checked) {
						halfCheck.checked = false;
						halfCheck.disabled = true;
					} else {
						halfCheck.disabled = false;
					}
				}
			}
		});
	},
	
	/**
     * Switch between solar and plantation mode
     */
    switchMode(mode) {
		if (mode === 'future') {
			return;
		}
		
		this.currentMode = mode;
		
		// Update cards
		document.querySelectorAll('.mode-card').forEach(card => {
			const isActive = card.dataset.mode === mode;
			card.classList.toggle('active', isActive);
		});
		
		// Show/hide content
		document.getElementById('solar-content').style.display = mode === 'solar' ? 'block' : 'none';
		document.getElementById('plantation-content').style.display = mode === 'plantation' ? 'block' : 'none';
		
		// Update stats labels
		this.updateStatsLabels();
		
		// Clear previous results
		this.clearResults();
	},
	
	/**
     * Update stats labels based on mode
     */
    updateStatsLabels() {
        const statHalfContainer = document.getElementById('stat-half-label')?.parentElement;
		
		if (this.currentMode === 'solar') {
            document.getElementById('stat-full-label').textContent = 'Tables entières';
            document.getElementById('stat-half-label').textContent = 'Demi-tables';
            document.getElementById('stat-area-label').textContent = 'Surface panneaux';
            document.getElementById('export-label').textContent = 'Panneaux';
			
			if (statHalfContainer) {
				statHalfContainer.style.display = 'block';
			}
        } else {
            document.getElementById('stat-full-label').textContent = 'Arbres';
            document.getElementById('stat-half-label').textContent = 'Demi-espaces';
            document.getElementById('stat-area-label').textContent = 'Surface couverte';
            document.getElementById('export-label').textContent = 'Plantations';
			
			if (statHalfContainer) {
				statHalfContainer.style.display = 'none';
			}
        }
    },

    onSolarModelChange(modelKey) {
        const model = this.solarPanelModels[modelKey];
        
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

    onPlantationModelChange(modelKey) {
        const model = this.plantationModels[modelKey];
        
        const diameterInput = document.getElementById('plantation-diameter');

        if (model && model.diameter) {
            diameterInput.value = model.diameter;
            diameterInput.disabled = true;
            
            if (model.description) {
                GeoflowUtils.showToast(model.description, 'info');
            }
        } else {
            diameterInput.disabled = false;
        }
    },

    getConfig() {
        if (this.currentMode === 'solar') {
            return {
                mode: 'solar',
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
        } else {
            const diameter = parseFloat(document.getElementById('plantation-diameter')?.value || 6.0);
            return {
                mode: 'plantation',
                model: document.getElementById('plantation-model')?.value || 'custom',
                panelLength: diameter,  // Use diameter as "length"
                panelWidth: diameter,   // Use diameter as "width" (circular)
                hSpacing: parseFloat(document.getElementById('plantation-h-spacing')?.value || 8.0),
                vSpacing: parseFloat(document.getElementById('plantation-v-spacing')?.value || 8.0),
                edgeMargin: parseFloat(document.getElementById('plantation-margin')?.value || 2.0),
                orientation: 0,  // Always 0 for plantations
                allowHalf: false,  // Never allow half for plantations
                calculateCoverage: document.getElementById('plantation-recouvrement')?.checked || false
            };
        }
    },

    validateConfig(config) {
        const errors = [];

        if (config.panelLength <= 0 || config.panelLength > 100) {
            errors.push(config.mode === 'solar' ? 'Longueur invalide (0.1 - 100m)' : 'Diamètre invalide (0.5 - 100m)');
        }
        if (config.mode === 'solar' && (config.panelWidth <= 0 || config.panelWidth > 50)) {
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

        // Récupérer les layers depuis le bon endroit
        let drawnLayers = [];
        
        // Si annotations existe, chercher dans drawLayerGroup ET importLayerGroup
        if (typeof GeoflowAnnotations !== 'undefined') {
            if (GeoflowAnnotations.drawLayerGroup) {
                drawnLayers = [...drawnLayers, ...GeoflowAnnotations.drawLayerGroup.getLayers()];
            }
            if (GeoflowAnnotations.importLayerGroup) {
                drawnLayers = [...drawnLayers, ...GeoflowAnnotations.importLayerGroup.getLayers()];
            }
        } else {
            // Fallback sur drawnItems classique
            drawnLayers = GeoflowDraw.drawnItems.getLayers();
        }
        
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
            worker = new Worker('js/addons/calepinage-worker.js');
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
			
			// Adapter le label selon le mode
			let label, panelArea, popupContent;
			
			if (config.mode === 'plantation') {
				label = panel.type === 'full' ? 'Arbre complet' : 'Demi-espace';
				const diameter = config.panelLength; // Le diamètre
				panelArea = Math.PI * Math.pow(diameter / 2, 2); // Surface du cercle
				
				popupContent = `
					<div class="feature-popup">
						<h6><i class="fa-solid fa-tree"></i> Arbre #${i + 1}</h6>
						<table>
							<tr><td>Type</td><td>${label}</td></tr>
							<tr><td>Diamètre couronne</td><td>${diameter.toFixed(1)} m</td></tr>
							<tr><td>Surface couverte</td><td>${panelArea.toFixed(2)} m²</td></tr>
						</table>
					</div>
				`;
			} else {
				label = panel.type === 'full' ? 'Table entière' : 'Demi-table';
				panelArea = panel.type === 'full' 
					? config.panelLength * config.panelWidth 
					: (config.panelLength / 2) * config.panelWidth;
				
				popupContent = `
					<div class="feature-popup">
						<h6><i class="fa-solid fa-solar-panel"></i> Panneau #${i + 1}</h6>
						<table>
							<tr><td>Type</td><td>${label}</td></tr>
							<tr><td>Surface</td><td>${panelArea.toFixed(2)} m²</td></tr>
							<tr><td>Orientation</td><td>${config.orientation === 0 ? 'Horizontal' : 'Vertical'}</td></tr>
						</table>
					</div>
				`;
			}

			const layer = L.geoJSON(panel.geometry, {
				style: {
					color: color,
					weight: 1,
					fillColor: color,
					fillOpacity: 0.8
				}
			});

			layer.bindPopup(popupContent);
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
	 * Calculate exact coverage using tracing algorithm via Web Worker
	 * Port of QGIS plugin coverage_logic.py
	 */
	calculateExactCoverage(panels, config, originalPolygon) {
		return new Promise((resolve, reject) => {
			try {
				// Check if Web Worker is supported
				if (typeof Worker === 'undefined') {
					console.warn('⚠️ Web Workers not supported, falling back to concave hull');
					resolve(this.calculateCoverageWithConcaveHull(panels, config, originalPolygon));
					return;
				}
				
				// Create worker
				let worker;
				try {
					worker = new Worker('js/addons/coverage-worker.js');
				} catch (error) {
					console.error('❌ Error creating coverage worker:', error);
					resolve(this.calculateCoverageWithConcaveHull(panels, config, originalPolygon));
					return;
				}
				
				// Handle messages from worker
				worker.onmessage = (e) => {
					const { type } = e.data;
					
					if (type === 'PROGRESS') {
						const { progress, message } = e.data;
						
					} else if (type === 'RESULT') {
						const { success, boundaryPoints, boundaryPolygon, hullArea, segmentCount, method, error, stack } = e.data;
						
						worker.terminate(); // Clean up worker
						
						if (!success || error) {
							console.error('❌ Coverage tracing error:', error);
							if (stack) console.error(stack);
							console.warn('⚠️ Falling back to concave hull method');
							resolve(this.calculateCoverageWithConcaveHull(panels, config, originalPolygon));
							return;
						}
						
						if (!boundaryPoints || boundaryPoints.length < 4) {
							console.warn('⚠️ Invalid boundary points, falling back to concave hull');
							resolve(this.calculateCoverageWithConcaveHull(panels, config, originalPolygon));
							return;
						}
						
						// Calculate total panel area
						const totalPanelArea = this.calculateTotalPanelArea(panels, config);
						
						// Calculate coverage rate
						const coverageRate = (totalPanelArea / hullArea) * 100;
						
						//console.log(`✅ Exact coverage: ${coverageRate.toFixed(1)}% (${totalPanelArea.toFixed(0)}m² / ${hullArea.toFixed(0)}m²)`);
						//console.log(`📊 Traced with ${segmentCount} segments`);
						
						resolve({
							rate: coverageRate,
							hullArea: hullArea,
							panelArea: totalPanelArea,
							hull: boundaryPolygon,
							method: method,
							tracedPoints: boundaryPoints.length
						});
					}
				};
				
				// Handle worker errors
				worker.onerror = (error) => {
					console.error('❌ Coverage worker error:', error);
					worker.terminate();
					console.warn('⚠️ Falling back to concave hull method');
					resolve(this.calculateCoverageWithConcaveHull(panels, config, originalPolygon));
				};
				
				// Send work to worker
				worker.postMessage({
					type: 'TRACE_BOUNDARY',
					data: {
						panels: panels,
						hSpacing: config.hSpacing,
						vSpacing: config.vSpacing,
						orientation: config.orientation
					}
				});
				
			} catch (error) {
				console.error('❌ Error in exact coverage calculation:', error);
				console.error(error.stack);
				resolve(this.calculateCoverageWithConcaveHull(panels, config, originalPolygon));
			}
		});
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
	async displayStats(panels, config, polygon) {
		const fullPanels = panels.filter(p => p.type === 'full');
		const halfPanels = panels.filter(p => p.type === 'half');

		// Calcul de la surface des panneaux
		const surfaceFull = config.panelLength * config.panelWidth;
		const surfaceHalf = (config.panelLength / 2) * config.panelWidth;
		const countFull = fullPanels.length;
		const countHalf = halfPanels.length;
		
		const totalPanelArea = (countFull * surfaceFull) + (countHalf * surfaceHalf);
		
		// Update stats display - partie basique
		document.getElementById('stat-full').textContent = countFull;
		document.getElementById('stat-half').textContent = countHalf;
		document.getElementById('stat-area').textContent = totalPanelArea.toFixed(0) + ' m²';

		// Calcul du recouvrement seulement si demandé
		if (config.calculateCoverage) {
			// Utiliser l'algorithme de traçage exact via Web Worker
			const coverageResult = await this.calculateExactCoverage(panels, config, polygon);
			
			const methodLabels = {
				'exact_tracing': '✓ Traçage exact',
				'concave_hull': '⚠ Enveloppe concave',
				'basic': '⚠ Calcul basique',
				'failed': '✗ Échec',
				'none': '-'
			};
			
			const methodLabel = methodLabels[coverageResult.method] || coverageResult.method;
			
			const hullAreaM2 = coverageResult.hullArea;
			const tauxRecouvrement = (totalPanelArea * 100) / hullAreaM2;
			
			/* console.log(`📊 Calcul du taux de recouvrement:`);
			console.log(`   Tables entières: ${countFull} × ${surfaceFull.toFixed(2)}m² = ${(countFull * surfaceFull).toFixed(2)}m²`);
			console.log(`   Demi-tables: ${countHalf} × ${surfaceHalf.toFixed(2)}m² = ${(countHalf * surfaceHalf).toFixed(2)}m²`);
			console.log(`   Surface panneaux totale: ${totalPanelArea.toFixed(2)}m²`);
			console.log(`   Surface enveloppe: ${hullAreaM2.toFixed(2)}m²`);
			console.log(`   Taux: ${tauxRecouvrement.toFixed(1)}%`); */
			
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