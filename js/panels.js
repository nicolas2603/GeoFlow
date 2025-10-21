/**
 * Geoflow Panels Module
 * Handles side panel management and navigation
 */

const GeoflowPanels = {
    currentPanel: null,

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

        if (GeoflowConfig.isFeatureEnabled('enr')) {
            const btnEnr = document.getElementById('btn-enr');
            if (btnEnr) {
                btnEnr.addEventListener('click', () => this.showPanel('enr'));
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
     * Show a specific panel
     * @param {string} type - Panel type (layers, draw, measure, tools)
     */
    showPanel(type) {
        // Check if feature is enabled using GeoflowConfig method
        if (!GeoflowConfig.isFeatureEnabled(type)) {
            GeoflowUtils.showToast('Fonctionnalité désactivée', 'warning');
            return;
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

        // Update button states - exclude btn-legend from being deactivated
        document.querySelectorAll('.tool-btn').forEach(b => {
            if (b.id !== 'btn-legend') {
                b.classList.remove('active');
            }
        });
        
        if (btn) {
            btn.classList.add('active');
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
            case 'enr':
                title.textContent = 'Applications métier';
                content.innerHTML = GeoflowEnr.getPanelContent();
                GeoflowEnr.attachListeners();
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
            case 'calepinage':
                title.textContent = 'Calepinage';
                content.innerHTML = GeoflowCalepinage.getPanelContent();
                GeoflowCalepinage.attachListeners();
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
        
        // Remove active state from all buttons except btn-legend
        document.querySelectorAll('.tool-btn').forEach(b => {
            if (b.id !== 'btn-legend') {
                b.classList.remove('active');
            }
        });
        
        this.currentPanel = null;
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