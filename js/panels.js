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
        // Panel buttons
        document.getElementById('btn-layers').addEventListener('click', () => this.showPanel('layers'));
        document.getElementById('btn-draw').addEventListener('click', () => this.showPanel('draw'));
        document.getElementById('btn-measure').addEventListener('click', () => this.showPanel('measure'));
        document.getElementById('btn-tools').addEventListener('click', () => this.showPanel('tools'));
        
        // Close button
        document.getElementById('panel-close').addEventListener('click', () => this.closePanel());

        // Legend widget
        document.getElementById('btn-legend').addEventListener('click', () => this.toggleLegend());
        document.getElementById('legend-widget-close').addEventListener('click', () => this.toggleLegend());
    },

    /**
     * Show a specific panel
     * @param {string} type - Panel type (layers, draw, measure, tools)
     */
    showPanel(type) {
        const panel = document.getElementById('panel');
        const content = document.getElementById('panel-content');
        const title = document.getElementById('panel-title');
        const btn = document.getElementById(`btn-${type}`);

        // Toggle if same panel clicked
        if (this.currentPanel === type) {
            this.closePanel();
            return;
        }

        // Update button states
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

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
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        this.currentPanel = null;
    },

    /**
     * Toggle legend widget
     */
    toggleLegend() {
        const widget = document.getElementById('legend-widget');
        const btn = document.getElementById('btn-legend');
        widget.classList.toggle('active');
        btn.classList.toggle('active');
    }
};