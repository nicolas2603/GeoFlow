/**
 * Geoflow Panels Module
 * Handles side panel management and navigation
 */

const GeoflowPanels = {
    currentPanel: null,
    parentPanel: null, // Store the parent panel when in a sub-panel

    /**
     * Panel hierarchy - maps sub-panels to their parent panels
     * This is automatically built based on which module calls showPanel
     */
    panelHierarchy: {
        // Main panels (have buttons in toolbar)
        'layers': null,
        'draw': null,
        'measure': null,
        'metier': null,
        'tools': null,
        'legend': null,
        
        // Sub-panels will be dynamically registered
        // Format: 'sub-panel-name': 'parent-panel-name'
    },

    /**
     * Initialize panel controls
     */
    init() {
        // Panel buttons - only if features are enabled
        if (GeoflowConfig.isFeatureEnabled('layers')) {
            const btnLayers = document.getElementById('btn-layers');
            if (btnLayers) {
                btnLayers.addEventListener('click', () => this.showPanel('layers'));
            }
        }

        if (GeoflowConfig.isFeatureEnabled('draw')) {
            const btnDraw = document.getElementById('btn-draw');
            if (btnDraw) {
                btnDraw.addEventListener('click', () => this.showPanel('draw'));
            }
        }

        if (GeoflowConfig.isFeatureEnabled('measure')) {
            const btnMeasure = document.getElementById('btn-measure');
            if (btnMeasure) {
                btnMeasure.addEventListener('click', () => this.showPanel('measure'));
            }
        }

        if (GeoflowConfig.isFeatureEnabled('metier')) {
            const btnEnr = document.getElementById('btn-metier');
            if (btnEnr) {
                btnEnr.addEventListener('click', () => this.showPanel('metier'));
            }
        }

        if (GeoflowConfig.isFeatureEnabled('tools')) {
            const btnTools = document.getElementById('btn-tools');
            if (btnTools) {
                btnTools.addEventListener('click', () => this.showPanel('tools'));
            }
        }
        
        // Close button
        document.getElementById('panel-close').addEventListener('click', () => this.closePanel());

        // Legend widget
        if (GeoflowConfig.isFeatureEnabled('legend')) {
            const btnLegend = document.getElementById('btn-legend');
            const legendClose = document.getElementById('legend-widget-close');
            
            if (btnLegend) {
                btnLegend.addEventListener('click', () => this.toggleLegend());
            }
            if (legendClose) {
                legendClose.addEventListener('click', () => this.toggleLegend());
            }
        }
    },

    /**
     * Register a sub-panel with its parent
     * @param {string} subPanel - Sub-panel identifier
     * @param {string} parentPanel - Parent panel identifier
     */
    registerSubPanel(subPanel, parentPanel) {
        this.panelHierarchy[subPanel] = parentPanel;
    },

    /**
     * Check if a panel is a sub-panel
     * @param {string} type - Panel type
     * @returns {boolean}
     */
    isSubPanel(type) {
        return this.panelHierarchy[type] !== null && this.panelHierarchy[type] !== undefined;
    },

    /**
     * Get parent panel for a sub-panel
     * @param {string} type - Sub-panel type
     * @returns {string|null}
     */
    getParentPanel(type) {
        return this.panelHierarchy[type] || null;
    },

    /**
     * Show a specific panel
     * @param {string} type - Panel type (layers, draw, measure, tools, etc.)
     * @param {string} parentPanel - Optional parent panel (for automatic sub-panel registration)
     */
    showPanel(type, parentPanel = null) {
        // Check if feature is enabled using GeoflowConfig method
        if (!GeoflowConfig.isFeatureEnabled(type)) {
            GeoflowUtils.showToast('Fonctionnalité désactivée', 'warning');
            return;
        }

        // Auto-register sub-panel if parentPanel is provided
        if (parentPanel && !this.panelHierarchy.hasOwnProperty(type)) {
            this.registerSubPanel(type, parentPanel);
        }

        const panel = document.getElementById('panel');
        const content = document.getElementById('panel-content');
        const title = document.getElementById('panel-title');
        const btn = document.getElementById(`btn-${type}`);

        // Toggle if same panel clicked
        if (this.currentPanel === type) {
            this.closePanel();
            return;
        }

        // Cleanup previous panel before switching
        if (this.currentPanel) {
            this.cleanupCurrentPanel();
        }

        // Determine if this is a sub-panel
        const isSubPanel = this.isSubPanel(type);
        const parentType = isSubPanel ? this.getParentPanel(type) : null;

        // Update button states - exclude btn-legend from being deactivated
        document.querySelectorAll('.tool-btn').forEach(b => {
            if (b.id !== 'btn-legend') {
                b.classList.remove('active', 'sub-active');
            }
        });
        
        if (isSubPanel && parentType) {
            // Sub-panel: parent gets sub-active
            const parentBtn = document.getElementById(`btn-${parentType}`);
            if (parentBtn) {
                parentBtn.classList.add('sub-active');
            }
            this.parentPanel = parentType;
        } else if (btn) {
            // Main panel: btn gets active
            btn.classList.add('active');
            this.parentPanel = null;
        }

        this.currentPanel = type;
        
        // Load panel content
        switch(type) {
            case 'layers':
                title.textContent = 'Couches';
                content.innerHTML = GeoflowLayers.getPanelContent();
                GeoflowLayers.attachListeners();
                break;
            case 'draw':
                title.textContent = 'Dessiner';
                content.innerHTML = GeoflowDraw.getPanelContent();
                GeoflowDraw.attachListeners();
                break;
            case 'measure':
                title.textContent = 'Mesurer';
                content.innerHTML = GeoflowMeasure.getPanelContent();
                GeoflowMeasure.attachListeners();
                break;
            case 'metier':
                title.textContent = 'Applications métiers';
                content.innerHTML = GeoflowMetier.getPanelContent();
                GeoflowMetier.attachListeners();
                break;
            case 'calepinage':
                title.textContent = 'Calepinage';
                content.innerHTML = GeoflowCalepinage.getPanelContent();
                GeoflowCalepinage.attachListeners();
                break;
            case 'tools':
                title.textContent = 'Outils';
                content.innerHTML = GeoflowTools.getPanelContent();
                GeoflowTools.attachListeners();
                break;
            case 'print':
                title.textContent = 'Imprimer';
                content.innerHTML = GeoflowPrint.getPanelContent();
                GeoflowPrint.attachListeners();
                break;
            case 'export':
                title.textContent = 'Exporter';
                content.innerHTML = GeoflowExport.getPanelContent();
                GeoflowExport.attachListeners();
                break;
            case 'share':
                title.textContent = 'Partager';
                content.innerHTML = GeoflowShare.getPanelContent();
                GeoflowShare.attachListeners();
                break;
            case 'external-source':
                title.textContent = 'Ajouter une couche externe';
                content.innerHTML = GeoflowExternalSources.getPanelContent();
                GeoflowExternalSources.attachListeners();
                break;
            case 'ai-search':
                title.textContent = 'Recherche intelligente';
                content.innerHTML = GeoflowLayerSearch.getPanelContent();
                GeoflowLayerSearch.attachListeners();
                break;
            default:
                // Try to load dynamically if module exists
                const moduleName = 'Geoflow' + type.charAt(0).toUpperCase() + type.slice(1);
                if (window[moduleName]) {
                    title.textContent = type.charAt(0).toUpperCase() + type.slice(1);
                    content.innerHTML = window[moduleName].getPanelContent();
                    if (window[moduleName].attachListeners) {
                        window[moduleName].attachListeners();
                    }
                } else {
                    content.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">Panel non trouvé</div>';
                }
                break;
        }

        panel.classList.add('active');
    },

    /**
     * Close the active panel
     */
    closePanel() {
        // Cleanup before closing
        this.cleanupCurrentPanel();
        
        document.getElementById('panel').classList.remove('active');
        
        // Remove active and sub-active state from all buttons except btn-legend
        document.querySelectorAll('.tool-btn').forEach(b => {
            if (b.id !== 'btn-legend') {
                b.classList.remove('active', 'sub-active');
            }
        });
        
        this.currentPanel = null;
        this.parentPanel = null;
    },

    /**
     * Cleanup the current panel's active states
     */
    cleanupCurrentPanel() {
        if (!this.currentPanel) return;

        // Cleanup Draw panel
        if (this.currentPanel === 'draw') {
            this.cleanupDrawMode();
        }

        // Cleanup Measure panel
        if (this.currentPanel === 'measure') {
            this.cleanupMeasureMode();
        }
    },

    /**
     * Cleanup draw mode
     */
    cleanupDrawMode() {
        if (typeof GeoflowDraw !== 'undefined') {
            // Call the module's cleanup method if available
            if (typeof GeoflowDraw.disableActiveDrawing === 'function') {
                GeoflowDraw.disableActiveDrawing();
            }

            // Additional cleanup for Leaflet.Draw
            if (GeoflowMap.map) {
                // Disable any active drawing mode
                GeoflowMap.map.off('draw:drawstart');
                GeoflowMap.map.off('draw:drawstop');
                
                // Try to disable edit/delete modes
                try {
                    if (GeoflowMap.map._editEnabled) {
                        GeoflowMap.map.fire('draw:editstop');
                    }
                    if (GeoflowMap.map._deleteEnabled) {
                        GeoflowMap.map.fire('draw:deletestop');
                    }
                } catch (e) {
                    // Ignore errors
                }

                // Reset cursor
                const mapElement = document.getElementById('map');
                if (mapElement) {
                    mapElement.style.cursor = '';
                }
            }
        }
    },

    /**
     * Cleanup measure mode
     */
    cleanupMeasureMode() {
        if (typeof GeoflowMeasure !== 'undefined') {
            // Call the module's cleanup method if available
            if (typeof GeoflowMeasure.disableActiveMeasure === 'function') {
                GeoflowMeasure.disableActiveMeasure();
            }

            // Reset cursor
            const mapElement = document.getElementById('map');
            if (mapElement) {
                mapElement.style.cursor = '';
            }
        }
    },

    /**
     * Toggle legend widget
     */
    toggleLegend() {
        if (typeof GeoflowLegend !== 'undefined') {
            GeoflowLegend.toggle();
        }
    }
};