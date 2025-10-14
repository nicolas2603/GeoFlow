/**
 * GeoFlow Panels Module
 * Handles side panel management and navigation
 */

const GeoFlowPanels = {
    currentPanel: null,

    /**
     * Initialize panel controls
     */
    init() {
        // Panel buttons - only if features are enabled
        if (GeoFlowConfig.isFeatureEnabled('layers')) {
            const btnLayers = document.getElementById('btn-layers');
            if (btnLayers) {
                btnLayers.addEventListener('click', () => this.showPanel('layers'));
            }
        }

        if (GeoFlowConfig.isFeatureEnabled('draw')) {
            const btnDraw = document.getElementById('btn-draw');
            if (btnDraw) {
                btnDraw.addEventListener('click', () => this.showPanel('draw'));
            }
        }

        if (GeoFlowConfig.isFeatureEnabled('measure')) {
            const btnMeasure = document.getElementById('btn-measure');
            if (btnMeasure) {
                btnMeasure.addEventListener('click', () => this.showPanel('measure'));
            }
        }

        if (GeoFlowConfig.isFeatureEnabled('tools')) {
            const btnTools = document.getElementById('btn-tools');
            if (btnTools) {
                btnTools.addEventListener('click', () => this.showPanel('tools'));
            }
        }
        
        // Close button
        document.getElementById('panel-close').addEventListener('click', () => this.closePanel());

        // Legend widget
        if (GeoFlowConfig.isFeatureEnabled('legend')) {
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
        // Check if feature is enabled using GeoFlowConfig method
        if (!GeoFlowConfig.isFeatureEnabled(type)) {
            GeoFlowUtils.showToast('Fonctionnalité désactivée', 'warning');
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
                content.innerHTML = GeoFlowLayers.getPanelContent();
                GeoFlowLayers.attachListeners();
                break;
            case 'draw':
                title.textContent = 'Dessiner';
                content.innerHTML = GeoFlowDraw.getPanelContent();
                GeoFlowDraw.attachListeners();
                break;
            case 'measure':
                title.textContent = 'Mesurer';
                content.innerHTML = GeoFlowMeasure.getPanelContent();
                GeoFlowMeasure.attachListeners();
                break;
            case 'tools':
                title.textContent = 'Outils';
                content.innerHTML = GeoFlowTools.getPanelContent();
                GeoFlowTools.attachListeners();
                break;
        }

        panel.classList.add('active');
    },

    /**
     * Close the active panel
     */
    closePanel() {
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
     * Toggle legend widget
     */
    toggleLegend() {
        if (!GeoFlowConfig.isFeatureEnabled('legend')) {
            GeoFlowUtils.showToast('Légende désactivée', 'warning');
            return;
        }

        const widget = document.getElementById('legend-widget');
        const btn = document.getElementById('btn-legend');
        
        if (widget) {
            widget.classList.toggle('active');
        }
        if (btn) {
            btn.classList.toggle('active');
        }
    }
};